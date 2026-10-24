import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { executeCommerceReconcile } from "../../apps/core-api/src/commerce-jobs";
import {
  type DatabaseContext,
  inTransaction,
  transaction,
} from "../../packages/database/src/client";
import { createCommerceFinancialHandlers } from "../../packages/database/src/commerce-payment-orders";
import { CommercePaymentRepository } from "../../packages/database/src/commerce-payments";
import { expireCommerceReservations } from "../../packages/database/src/commerce-reservations";
import {
  acquireExecution,
  type ClaimedJob,
  enqueue,
  releaseExecution,
} from "../../packages/database/src/outbox";
import { decideBookingHold } from "../../packages/domain/src/booking/index";

interface Fixture {
  source: { query: DatabaseContext["client"]["query"] };
  runtime<T>(kind: "core" | "jobs", work: (context: DatabaseContext) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
const actor = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const location = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab";
const sku = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac";
const batch = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad";
const tax = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaae";
const handlers = createCommerceFinancialHandlers();
const bindings = {
  APP_ENV: "local",
  RESOURCE_NAMESPACE: "kandamkulathi-local",
  PROVIDER_MODE: "sandbox",
  ALLOW_LIVE_SENDS: "false",
  ALLOW_LIVE_PAYMENTS: "false",
  RAZORPAY_CONFIGURATION_APPROVED: "true",
  RAZORPAY_ACCOUNT_ID: "acc_synthetic",
  RAZORPAY_KEY_ID: "rzp_test_synthetic",
  RAZORPAY_KEY_SECRET: "synthetic-local-only",
  RAZORPAY_WEBHOOK_SECRET: "synthetic-local-only",
};
let fixture: Fixture;
let server: Server;
let origin: string;
const nativeFetch = fetch;
const providerOrders = new Map<string, { id: string; receipt: string }>();
const requests: string[] = [];
let captured = true;
let wrongAmount = false;
let beforeRequest: (() => Promise<void>) | undefined;

async function ready() {
  const orderId = randomUUID();
  const operationId = randomUUID();
  await fixture.source.query(
    `INSERT INTO core.commerce_orders(id,operation_id,actor_id,location_id,request_key,amount_paise,expires_at,source,hold_policy_reference)
     VALUES($1,$1,$2,$3,'synthetic',12345,clock_timestamp()+interval '1 hour','web','synthetic-approved')`,
    [orderId, actor, location],
  );
  await fixture.source.query(
    "INSERT INTO core.commerce_order_addresses(order_id,address) VALUES($1,$2::jsonb)",
    [
      orderId,
      JSON.stringify({
        recipientName: "Synthetic",
        line1: "1 Test Street",
        city: "Test City",
        region: "Test",
        postalCode: "680001",
        country: "IN",
        contactPhone: "+919876543210",
      }),
    ],
  );
  await fixture.source.query(
    `INSERT INTO core.commerce_order_lines(order_id,sku_id,quantity,sku_version,unit_paise,tax_paise,amount_paise,tax_policy_id,tax_rate_bps)
     VALUES($1,$2,1,1,12345,0,12345,$3,0)`,
    [orderId, sku, tax],
  );
  await fixture.source.query("UPDATE core.commerce_batches SET reserved=reserved+1 WHERE id=$1", [
    batch,
  ]);
  await fixture.source.query(
    "INSERT INTO core.commerce_reservations(order_id,sku_id,batch_id,quantity) VALUES($1,$2,$3,1)",
    [orderId, sku, batch],
  );
  const intent = await fixture.runtime("core", async (context) => {
    const repository = new CommercePaymentRepository(context, handlers.authority);
    const intent = await repository.open(
      actor,
      { operationId, subject: { kind: "order", id: orderId }, method: "razorpay" },
      "acc_synthetic",
    );
    await repository.claimCreate(actor, intent.id);
    await repository.markUnknown(actor, intent.id);
    return intent;
  });
  providerOrders.set(operationId, {
    id: `order_${operationId.replaceAll("-", "")}`,
    receipt: operationId,
  });
  const row = (
    await fixture.source.query<{ id: string }>(
      "SELECT id FROM platform.outbox WHERE operation_id=$1",
      [intent.id],
    )
  ).rows[0];
  if (!row) throw new Error("Missing durable intent job");
  return { intent, jobId: row.id, orderId };
}
async function claim(jobId: string): Promise<ClaimedJob> {
  const result = await fixture.runtime("jobs", ({ client }) =>
    acquireExecution(client, { schemaVersion: 1, id: jobId, channel: "financial" }),
  );
  if (typeof result === "string") throw new Error(`Unexpected claim ${result}`);
  return result;
}

async function readyBooking(late = false) {
  const bookingId = randomUUID();
  const intentId = randomUUID();
  const operationId = randomUUID();
  const doctorId = randomUUID();
  const availabilityId = randomUUID();
  const providerOrderId = `order_${operationId.replaceAll("-", "")}`;
  const clock = (await fixture.source.query<{ now: Date }>("SELECT clock_timestamp() AS now"))
    .rows[0];
  if (!clock) throw new Error("Missing database time");
  const now = clock.now.getTime();
  const iso = (offset: number) => new Date(now + offset).toISOString();
  // Synthetic policy supplied explicitly to the canonical decision; no production defaults.
  const policy = { id: randomUUID(), revision: 1, holdDurationMs: 3600000 };
  const availability = {
    id: availabilityId,
    revision: 1,
    doctorId,
    clinicId: location,
    clinicTimezone: "Asia/Kolkata",
    window: { start: iso(7200000), end: iso(14400000) },
    slotLengthMs: 1800000,
    buffers: { beforeMs: 0, afterMs: 0 },
    modalities: ["online" as const],
  };
  const fee = {
    feeId: randomUUID(),
    revision: 1,
    doctorId,
    clinicId: location,
    modality: "online" as const,
    amountPaise: 12345,
    currency: "INR" as const,
    approvedPolicyId: policy.id,
  };
  const request = {
    doctorId,
    clinicId: location,
    ownerId: actor,
    availabilityId,
    expectedAvailabilityRevision: 1,
    modality: "online" as const,
    start: availability.window.start,
  };
  const decision = decideBookingHold({
    request,
    authority: { kind: "customer", customerId: actor },
    now: late ? iso(-7200000) : iso(0),
    bookingId,
    paymentOrderId: providerOrderId,
    availability,
    leaves: [],
    occupied: [],
    fee,
    policy,
  });
  if (decision.kind !== "hold_intent") throw new Error("Synthetic canonical hold denied");
  const booking = decision.booking;
  await fixture.source.query(
    "INSERT INTO clinical.mathew_booking_directory(doctor_id,document,published) VALUES($1,$2,true)",
    [doctorId, { doctorId }],
  );
  await fixture.source.query(
    "INSERT INTO clinical.mathew_booking_configuration(availability_id,doctor_id,availability,policy,fees,enabled) VALUES($1,$2,$3,$4,$5,true)",
    [availabilityId, doctorId, availability, policy, JSON.stringify([fee])],
  );
  await fixture.source.query(
    `INSERT INTO clinical.mathew_booking_booking(id,operation_id,request,owner_id,doctor_id,clinic_id,revision,state,occupied,expires_at,document)
    VALUES($1,$2,$3,$4,$5,$6,1,'held',tstzrange($7,$8,'[)'),$9,$10)`,
    [
      bookingId,
      randomUUID(),
      request,
      actor,
      doctorId,
      location,
      booking.slot.interval.start,
      booking.slot.interval.end,
      booking.holdExpiresAt,
      booking,
    ],
  );
  await fixture.source.query(
    `INSERT INTO core.commerce_payment_intents(id,operation_id,subject_kind,subject_id,owner_id,amount_paise,currency,account_id,state,provider_order_id,authority_revision)
    VALUES($1,$2,'booking',$3,$4,12345,'INR','acc_synthetic','unknown',$5,1)`,
    [intentId, operationId, bookingId, actor, providerOrderId],
  );
  const jobId = randomUUID();
  // Initial intent reconciliation is enqueued by CORE (CommercePaymentRepository.open).
  // JOBS may only enqueue follow-up work bound to persisted financial obligations.
  await fixture.runtime("core", (context) =>
    transaction(context.client, () =>
      enqueue(context, {
        id: jobId,
        operationId: intentId,
        subjectId: intentId,
        channel: "financial",
        kind: "commerce.reconcile",
        revision: 1,
        dueAt: clock.now,
        deadlineAt: new Date(now + 86400000),
      }),
    ),
  );
  providerOrders.set(operationId, { id: providerOrderId, receipt: operationId });
  return { bookingId, intentId, jobId };
}
async function counts(jobId: string, intentId: string) {
  return (
    await fixture.source.query(
      `SELECT o.status,(SELECT count(*)::int FROM core.commerce_payment_ledger WHERE intent_id=$2) AS ledger,
     (SELECT count(*)::int FROM platform.receipts WHERE job_id=o.id) AS receipts
     FROM platform.outbox o WHERE o.id=$1`,
      [jobId, intentId],
    )
  ).rows[0];
}

describe("commerce jobs — real PostgreSQL and synthetic localhost provider protocol", () => {
  beforeAll(async () => {
    const support = "../platform/support.mjs";
    fixture = await (await import(support)).testDatabase();
    // testDatabase applies the canonical journal; never replay or repair migrations here.
    expect(
      (
        await fixture.source.query("SELECT id FROM public.k_platform_migrations WHERE id=$1", [
          "0024_commerce_reconcile_jobs_access",
        ])
      ).rows,
    ).toEqual([{ id: "0024_commerce_reconcile_jobs_access" }]);
    await fixture.source.query(
      "INSERT INTO core.commerce_locations(id,name) VALUES($1,'Synthetic')",
      [location],
    );
    await fixture.source.query(
      "INSERT INTO core.commerce_tax_policies(id,rate_bps,basis,rounding,approved_by,active) VALUES($1,0,'exclusive','half_up_line',$2,true)",
      [tax, actor],
    );
    await fixture.source.query(
      "INSERT INTO core.commerce_skus(id,sku,name,variant,description,image_url,concerns,approved_by,consult_only,unit_paise,tax_policy_id,minimum_shelf_life_days) VALUES($1,'synthetic','Synthetic','one','synthetic','https://example.invalid/synthetic','{}',$2,false,12345,$3,0)",
      [sku, actor, tax],
    );
    await fixture.source.query(
      "INSERT INTO core.commerce_batches(id,sku_id,location_id,batch_code,expires_on,on_hand) VALUES($1,$2,$3,'synthetic',CURRENT_DATE+365,100)",
      [batch, sku, location],
    );
    server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      res.setHeader("Content-Type", "application/json");
      if (req.method !== "GET") {
        res.writeHead(405).end();
        return;
      }
      if (url.pathname === "/v1/orders") {
        const order = providerOrders.get(url.searchParams.get("receipt") ?? "");
        res.end(
          JSON.stringify({
            entity: "collection",
            count: order ? 1 : 0,
            items: order ? [{ entity: "order", amount: 12345, currency: "INR", ...order }] : [],
          }),
        );
      } else if (url.pathname.endsWith("/payments")) {
        const orderId = url.pathname.split("/")[3];
        res.end(
          JSON.stringify({
            entity: "collection",
            count: captured ? 1 : 0,
            items: captured
              ? [
                  {
                    entity: "payment",
                    id: `pay_${orderId?.slice(6)}`,
                    order_id: orderId,
                    amount: wrongAmount ? 1 : 12345,
                    currency: "INR",
                    status: "captured",
                    captured: true,
                  },
                ]
              : [],
          }),
        );
      } else {
        const order = [...providerOrders.values()].find((order) =>
          url.pathname.endsWith(`/${order.id}`),
        );
        if (!order) {
          res.writeHead(404).end("{}");
          return;
        }
        res.end(JSON.stringify({ entity: "order", amount: 12345, currency: "INR", ...order }));
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Local provider unavailable");
    origin = `http://127.0.0.1:${address.port}`;
    vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.origin !== "https://api.razorpay.com")
        throw new Error("Unexpected external request blocked");
      requests.push(`${init?.method} ${url.pathname}${url.search}`);
      await beforeRequest?.();
      return nativeFetch(`${origin}${url.pathname}${url.search}`, init);
    });
  }, 60000);
  beforeEach(() => {
    requests.length = 0;
    captured = true;
    wrongAmount = false;
    beforeRequest = undefined;
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    if (server)
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    await fixture?.close();
  });

  it("canonical jobs access migration permits verified refund review but not unverified reads or mutations", async () => {
    const { intent } = await ready();
    const refund = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaff";
    await fixture.source.query(
      "INSERT INTO core.commerce_payment_refunds(id,operation_id,intent_id,actor_id,amount_paise,policy_version,approved_by) VALUES($1,$1,$2,$3,1,'synthetic-only',$3)",
      [refund, intent.id, actor],
    );
    await fixture.runtime("jobs", async ({ client }) => {
      expect(
        (await client.query("SELECT id FROM core.commerce_payment_refunds WHERE id=$1", [refund]))
          .rows,
      ).toEqual([]);
      await transaction(client, async () => {
        await client.query("SELECT set_config('app.payment_system','verified',true)");
        expect(
          (await client.query("SELECT id FROM core.commerce_payment_refunds WHERE id=$1", [refund]))
            .rows,
        ).toEqual([{ id: refund }]);
      });
      await expect(
        client.query("DELETE FROM core.commerce_payment_refunds WHERE id=$1", [refund]),
      ).rejects.toMatchObject({ code: "42501" });
    });
    expect(
      (
        await fixture.source.query(`SELECT policyname FROM pg_policies WHERE schemaname='core'
          AND policyname IN ('refund_jobs_review','expiry_financial_reference') ORDER BY policyname`)
      ).rows,
    ).toEqual([{ policyname: "expiry_financial_reference" }, { policyname: "refund_jobs_review" }]);
  });

  it("reconciles an unknown intent by stable receipt with GET only, atomically pays and completes; duplicate delivery is terminal", async () => {
    const { intent, jobId, orderId } = await ready();
    const job = await claim(jobId);
    await fixture.runtime("jobs", async (context) => {
      beforeRequest = async () => {
        expect(inTransaction(context.client)).toBe(false);
      };
      expect(await executeCommerceReconcile(context, job, bindings)).toBe("succeeded");
    });
    expect(requests).toEqual([
      `GET /v1/orders?receipt=${intent.operationId}&count=2&skip=0`,
      `GET /v1/orders/order_${intent.operationId.replaceAll("-", "")}/payments`,
    ]);
    expect(await counts(jobId, intent.id)).toEqual({ status: "succeeded", ledger: 1, receipts: 1 });
    expect(
      (await fixture.source.query("SELECT status FROM core.commerce_orders WHERE id=$1", [orderId]))
        .rows[0]?.status,
    ).toBe("paid");
    expect(
      await fixture.runtime("jobs", ({ client }) =>
        acquireExecution(client, { schemaVersion: 1, id: jobId, channel: "financial" }),
      ),
    ).toBe("terminal");
    const effects = (
      await fixture.source.query<{ id: string }>(
        "SELECT id FROM platform.outbox WHERE subject_id=$1 AND id<>$2",
        [intent.id, jobId],
      )
    ).rows;
    expect(effects).toHaveLength(1);
    const effect = effects[0];
    if (!effect) throw new Error("Missing capture follow-up");
    const effectJob = await claim(effect.id);
    expect(
      await fixture.runtime("jobs", (context) => executeCommerceReconcile(context, effectJob, {})),
    ).toBe("succeeded");
    expect(requests).toHaveLength(2);
  });

  it("does not reacquire a concurrent active lease or repeat a provider POST", async () => {
    const { intent, jobId } = await ready();
    const results = await Promise.all([
      claim(jobId).catch(() => "busy"),
      claim(jobId).catch(() => "busy"),
    ]);
    expect(results.filter((result) => result === "busy")).toHaveLength(1);
    const job = results.find((result): result is ClaimedJob => typeof result !== "string");
    if (!job) throw new Error("No lease acquired");
    expect(
      await fixture.runtime("jobs", (context) => executeCommerceReconcile(context, job, bindings)),
    ).toBe("succeeded");
    expect(await counts(jobId, intent.id)).toMatchObject({ ledger: 1, receipts: 1 });
    expect(requests.every((request) => request.startsWith("GET "))).toBe(true);
  });

  it("rejects stale completion after provider I/O loses its lease; no receipt/ledger/order partial application", async () => {
    const { intent, jobId } = await ready();
    const old = await claim(jobId);
    beforeRequest = async () => {
      await fixture.source.query(
        "UPDATE platform.outbox SET lease_token=gen_random_uuid() WHERE id=$1",
        [jobId],
      );
    };
    expect(
      await fixture.runtime("jobs", (context) => executeCommerceReconcile(context, old, bindings)),
    ).toBe("stale");
    expect(await counts(jobId, intent.id)).toEqual({
      status: "processing",
      ledger: 0,
      receipts: 0,
    });
  });

  it("persists late-capture money and review obligation but never ACKs either unresolved job", async () => {
    const { intent, jobId, orderId } = await ready();
    await fixture.source.query(
      "UPDATE core.commerce_orders SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour' WHERE id=$1",
      [orderId],
    );
    const job = await claim(jobId);
    await expect(
      fixture.runtime("jobs", (context) => executeCommerceReconcile(context, job, bindings)),
    ).rejects.toMatchObject({ reason: "unresolved" });
    expect(await counts(jobId, intent.id)).toEqual({
      status: "processing",
      ledger: 1,
      receipts: 0,
    });
    const review = (
      await fixture.source.query<{ id: string }>(
        "SELECT o.id FROM platform.outbox o JOIN core.commerce_order_payment_obligations r ON r.id=o.subject_id WHERE r.intent_id=$1",
        [intent.id],
      )
    ).rows[0];
    if (!review) throw new Error("Missing late-capture review obligation");
    const reviewJob = await claim(review.id);
    await expect(
      fixture.runtime("jobs", (context) => executeCommerceReconcile(context, reviewJob, bindings)),
    ).rejects.toMatchObject({ reason: "policy_review" });
    await fixture.runtime("jobs", ({ client }) => releaseExecution(client, job));
  });

  it("missing configuration, absent order/capture and mismatched amounts remain retryable with no completion", async () => {
    for (const scenario of ["config", "order", "capture", "amount"]) {
      const { intent, jobId } = await ready();
      const job = await claim(jobId);
      captured = scenario !== "capture";
      wrongAmount = scenario === "amount";
      if (scenario === "order") providerOrders.delete(intent.operationId);
      await expect(
        fixture.runtime("jobs", (context) =>
          executeCommerceReconcile(context, job, scenario === "config" ? {} : bindings),
        ),
      ).rejects.toThrow();
      expect(await counts(jobId, intent.id)).toEqual({
        status: "processing",
        ledger: 0,
        receipts: 0,
      });
    }
    expect(requests.every((request) => request.startsWith("GET "))).toBe(true);
  });

  it("a core connection cannot use the trusted jobs entrypoint", async () => {
    const { jobId } = await ready();
    const job = await claim(jobId);
    await expect(
      fixture.runtime("core", (context) => executeCommerceReconcile(context, job, bindings)),
    ).rejects.toMatchObject({ code: "denied" });
    expect(requests).toEqual([]);
  });

  it("rolls receipt, ledger and order application back when the fenced platform receipt cannot commit", async () => {
    const { intent, jobId, orderId } = await ready();
    const job = await claim(jobId);
    await fixture.source.query(`CREATE FUNCTION platform.commerce_jobs_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'synthetic receipt failure'; END $$;
      CREATE TRIGGER commerce_jobs_test_failure BEFORE INSERT ON platform.receipts
      FOR EACH ROW EXECUTE FUNCTION platform.commerce_jobs_test_failure()`);
    try {
      await expect(
        fixture.runtime("jobs", (context) => executeCommerceReconcile(context, job, bindings)),
      ).rejects.toThrow("synthetic receipt failure");
      expect(await counts(jobId, intent.id)).toEqual({
        status: "processing",
        ledger: 0,
        receipts: 0,
      });
      expect(
        (
          await fixture.source.query("SELECT status FROM core.commerce_orders WHERE id=$1", [
            orderId,
          ])
        ).rows[0]?.status,
      ).toBe("reserved");
      expect(
        (
          await fixture.source.query(
            "SELECT count(*)::int AS count FROM core.commerce_payment_receipts WHERE intent_id=$1",
            [intent.id],
          )
        ).rows[0]?.count,
      ).toBe(0);
    } finally {
      await fixture.source.query(
        "DROP TRIGGER commerce_jobs_test_failure ON platform.receipts; DROP FUNCTION platform.commerce_jobs_test_failure()",
      );
    }
  });

  it("recognizes reservation-expiry order UUIDs, accounts for capture, and leaves policy work unresolved", async () => {
    const { intent, orderId } = await ready();
    await fixture.source.query(
      "UPDATE core.commerce_orders SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour' WHERE id=$1",
      [orderId],
    );
    await fixture.runtime("jobs", (context) => expireCommerceReservations(context));
    const expiry = (
      await fixture.source.query<{ id: string }>(
        "SELECT o.id FROM platform.outbox o JOIN core.commerce_reservation_expirations e ON e.id=o.operation_id WHERE o.subject_id=$1",
        [orderId],
      )
    ).rows[0];
    if (!expiry) throw new Error("Missing expiry job");
    const job = await claim(expiry.id);
    await expect(
      fixture.runtime("jobs", (context) => executeCommerceReconcile(context, job, bindings)),
    ).rejects.toMatchObject({ reason: "unresolved" });
    expect(await counts(expiry.id, intent.id)).toEqual({
      status: "processing",
      ledger: 1,
      receipts: 0,
    });
  });

  it("rolls back applied capture when the lease expires at the last receipt/completion boundary", async () => {
    const { intent, jobId, orderId } = await ready();
    const job = await claim(jobId);
    await fixture.source.query(`CREATE FUNCTION platform.commerce_jobs_test_expire() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN UPDATE platform.outbox SET lease_until=clock_timestamp()-interval '1 second' WHERE id=NEW.job_id;
      RETURN NEW; END $$;
      CREATE TRIGGER commerce_jobs_test_expire BEFORE INSERT ON platform.receipts
      FOR EACH ROW EXECUTE FUNCTION platform.commerce_jobs_test_expire()`);
    try {
      await expect(
        fixture.runtime("jobs", (context) => executeCommerceReconcile(context, job, bindings)),
      ).rejects.toMatchObject({ code: "conflict" });
      expect(await counts(jobId, intent.id)).toEqual({
        status: "processing",
        ledger: 0,
        receipts: 0,
      });
      expect(
        (
          await fixture.source.query("SELECT status FROM core.commerce_orders WHERE id=$1", [
            orderId,
          ])
        ).rows[0]?.status,
      ).toBe("reserved");
    } finally {
      await fixture.source.query(
        "DROP TRIGGER commerce_jobs_test_expire ON platform.receipts; DROP FUNCTION platform.commerce_jobs_test_expire()",
      );
    }
  });

  it("classifies refund and rejected-capture UUIDs as policy review, never an intent success probe", async () => {
    const { intent, jobId } = await ready();
    const refund = randomUUID();
    await fixture.source.query(
      "INSERT INTO core.commerce_payment_refunds(id,operation_id,intent_id,actor_id,amount_paise,policy_version,approved_by) VALUES($1,$1,$2,$3,1,'synthetic-only',$3)",
      [refund, intent.id, actor],
    );
    const refundJobId = randomUUID();
    await fixture.source.query(
      `INSERT INTO platform.outbox(id,operation_id,channel,kind,subject_id,revision,due_at,deadline_at,next_attempt_at)
      SELECT $1,$2,channel,kind,subject_id,revision,due_at,deadline_at,due_at FROM platform.outbox WHERE id=$3`,
      [refundJobId, refund, jobId],
    );
    const refundJob = await claim(refundJobId);
    await expect(
      fixture.runtime("jobs", (context) => executeCommerceReconcile(context, refundJob, bindings)),
    ).rejects.toMatchObject({ reason: "policy_review" });
    const event = {
      id: `order_${intent.operationId.replaceAll("-", "")}`,
      reference: intent.operationId,
      amountPaise: 1,
      currency: "INR" as const,
      eventId: `evt_${randomUUID()}`,
      digest: "ab".repeat(32),
      accountId: "acc_synthetic",
      paymentId: `pay_${randomUUID().replaceAll("-", "")}`,
      outcome: "captured" as const,
    };
    expect(
      await fixture.runtime("jobs", (context) =>
        new CommercePaymentRepository(
          context,
          handlers.authority,
          undefined,
          handlers.application,
        ).receive(event),
      ),
    ).toBe("rejected");
    const rejected = (
      await fixture.source.query<{ id: string }>(
        "SELECT o.id FROM platform.outbox o JOIN core.commerce_payment_obligations r ON r.id=o.subject_id WHERE r.intent_id=$1",
        [intent.id],
      )
    ).rows[0];
    if (!rejected) throw new Error("Missing rejected-capture job");
    const rejectedJob = await claim(rejected.id);
    await expect(
      fixture.runtime("jobs", (context) =>
        executeCommerceReconcile(context, rejectedJob, bindings),
      ),
    ).rejects.toMatchObject({ reason: "policy_review" });
    expect(requests).toEqual([]);
    expect(await counts(refundJobId, intent.id)).toEqual({
      status: "processing",
      ledger: 0,
      receipts: 0,
    });
  });

  it("never applies provider evidence after the financial deadline passes while its lease is still valid", async () => {
    const { intent, jobId } = await ready();
    const job = await claim(jobId);
    beforeRequest = async () => {
      await fixture.source.query(
        "UPDATE platform.outbox SET due_at=clock_timestamp()-interval '2 hours',deadline_at=clock_timestamp()-interval '1 hour' WHERE id=$1",
        [jobId],
      );
    };
    expect(
      await fixture.runtime("jobs", (context) => executeCommerceReconcile(context, job, bindings)),
    ).toBe("stale");
    expect(await counts(jobId, intent.id)).toEqual({
      status: "processing",
      ledger: 0,
      receipts: 0,
    });
    expect(
      (
        await fixture.source.query(
          "SELECT lease_until>clock_timestamp() AS valid FROM platform.outbox WHERE id=$1",
          [jobId],
        )
      ).rows[0]?.valid,
    ).toBe(true);
  });

  it("rolls back financial application when the deadline elapses at the final receipt/completion checkpoint", async () => {
    const { intent, jobId } = await ready();
    const job = await claim(jobId);
    // Controlled-owner test hook only, not production runtime privilege or policy.
    await fixture.source.query(`CREATE FUNCTION platform.commerce_jobs_test_deadline() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
      BEGIN UPDATE platform.outbox SET due_at=clock_timestamp()-interval '2 hours',deadline_at=clock_timestamp()-interval '1 hour' WHERE id=NEW.job_id;
      RETURN NEW; END $$;
      CREATE TRIGGER commerce_jobs_test_deadline BEFORE INSERT ON platform.receipts
      FOR EACH ROW EXECUTE FUNCTION platform.commerce_jobs_test_deadline()`);
    try {
      await expect(
        fixture.runtime("jobs", (context) => executeCommerceReconcile(context, job, bindings)),
      ).rejects.toMatchObject({ code: "conflict" });
      expect(await counts(jobId, intent.id)).toEqual({
        status: "processing",
        ledger: 0,
        receipts: 0,
      });
    } finally {
      await fixture.source.query(
        "DROP TRIGGER commerce_jobs_test_deadline ON platform.receipts; DROP FUNCTION platform.commerce_jobs_test_deadline()",
      );
    }
  });

  it("applies actual canonical booking payment through JOBS without a customer session, matching provider/account and committing receipt/ledger/confirmation together", async () => {
    const { bookingId, intentId, jobId } = await readyBooking();
    const job = await claim(jobId);
    await fixture.runtime("jobs", async (context) => {
      beforeRequest = async () => {
        expect(inTransaction(context.client)).toBe(false);
      };
      expect(await executeCommerceReconcile(context, job, bindings)).toBe("succeeded");
    });
    expect(await counts(jobId, intentId)).toEqual({ status: "succeeded", ledger: 1, receipts: 1 });
    const booking = (
      await fixture.source.query(
        "SELECT state,revision,document FROM clinical.mathew_booking_booking WHERE id=$1",
        [bookingId],
      )
    ).rows[0];
    expect(booking).toMatchObject({
      state: "confirmed",
      revision: 2,
      document: {
        payments: [
          {
            disposition: "applied",
            payment: { provider: "razorpay", bookingId, amountPaise: 12345, currency: "INR" },
          },
        ],
      },
    });
    const proof = await fixture.source.query(
      `SELECT p.provider,l.account_id,d.receipt_id FROM clinical.mathew_booking_payment p
      JOIN clinical.mathew_booking_delivery d ON d.provider=p.provider AND d.payment_id=p.payment_id
      JOIN core.commerce_payment_ledger l ON l.payment_id=p.payment_id AND l.intent_id=$1
      JOIN core.commerce_payment_receipts r ON r.id=d.receipt_id AND r.intent_id=l.intent_id AND r.account_id=l.account_id
      WHERE p.booking_id=$2`,
      [intentId, bookingId],
    );
    expect(proof.rows).toHaveLength(1);
    expect(proof.rows[0]).toMatchObject({ provider: "razorpay", account_id: "acc_synthetic" });
    expect(requests).toHaveLength(2);
    expect(requests.every((request) => request.startsWith("GET "))).toBe(true);
  });

  it("accounts for canonical late booking capture but cannot ACK the booking review obligation", async () => {
    const { bookingId, intentId, jobId } = await readyBooking(true);
    const job = await claim(jobId);
    await expect(
      fixture.runtime("jobs", (context) => executeCommerceReconcile(context, job, bindings)),
    ).rejects.toMatchObject({ reason: "unresolved" });
    expect(await counts(jobId, intentId)).toEqual({ status: "processing", ledger: 1, receipts: 0 });
    const review = (
      await fixture.source.query<{ id: string }>(
        "SELECT o.id FROM platform.outbox o JOIN clinical.mathew_booking_obligation b ON b.id=o.subject_id WHERE b.booking_id=$1",
        [bookingId],
      )
    ).rows[0];
    if (!review) throw new Error("Missing canonical booking review obligation");
    const reviewJob = await claim(review.id);
    await expect(
      fixture.runtime("jobs", (context) => executeCommerceReconcile(context, reviewJob, bindings)),
    ).rejects.toMatchObject({ reason: "policy_review" });
  });
});
