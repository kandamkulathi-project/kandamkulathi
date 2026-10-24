import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { after, before, beforeEach, test } from "node:test";
import { inTransaction } from "../../packages/database/src/client.ts";
import { CommercePaymentRepository } from "../../packages/database/src/commerce-payments.ts";
import { CommercePayments } from "../../packages/domain/src/commerce-payments.ts";
import { RazorpayAdapter } from "../../packages/providers/src/razorpay.ts";
import { testDatabase } from "./support.mjs";

// Synthetic business fixtures. Randomness in shared support isolates database/role resource names only.
const owner = "30000000-0000-4000-8000-000000000001";
const other = "30000000-0000-4000-8000-000000000002";
const subjectId = "30000000-0000-4000-8000-000000000003";
const operationId = "30000000-0000-4000-8000-000000000004";
const refundOperation = "30000000-0000-4000-8000-000000000005";
const configuration = {
  accountId: "acc_synthetic",
  keyId: "rzp_test_synthetic",
  keySecret: "synthetic-api",
  webhookSecret: "synthetic-webhook",
};
const request = { operationId, subject: { kind: "order", id: subjectId }, method: "razorpay" };
const order = {
  entity: "order",
  id: "order_synthetic",
  receipt: operationId,
  amount: 12345,
  currency: "INR",
};
const payment = {
  entity: "payment",
  id: "pay_synthetic",
  order_id: order.id,
  amount: 12345,
  currency: "INR",
  status: "captured",
  captured: true,
};
const event = {
  id: order.id,
  reference: operationId,
  amountPaise: 12345,
  currency: "INR",
  accountId: "acc_synthetic",
  paymentId: payment.id,
  outcome: "captured",
  eventId: "evt_synthetic",
  digest: "a".repeat(64),
};
const approvedPolicy = {
  decide: async () => ({ version: "synthetic-fixture-v1", approvedBy: other, maximumPaise: 12345 }),
};
let fixture;
let postCount;
let failPost;
const authority = {
  async lock(context, subject) {
    assert(inTransaction(context.client), "authority must share the payment transaction");
    const row = (
      await context.client.query(
        "SELECT * FROM core.payment_test_subjects WHERE id=$1 AND kind=$2 FOR UPDATE",
        [subject.id, subject.kind],
      )
    ).rows[0];
    return row
      ? {
          subject,
          ownerId: row.owner_id,
          amountPaise: Number(row.amount_paise),
          currency: row.currency,
          payable: row.payable,
          authorityRevision: 1,
        }
      : null;
  },
  async bind(context, intent, providerOrder) {
    assert(inTransaction(context.client));
    assert.equal(intent.authorityRevision, 1);
    assert.equal(providerOrder.id, order.id);
  },
};
const application = {
  async apply(context, intent, verified, receiptId) {
    assert(inTransaction(context.client));
    assert.equal(
      (
        await context.client.query("SELECT id FROM core.commerce_payment_receipts WHERE id=$1", [
          receiptId,
        ])
      ).rowCount,
      1,
    );
    assert.equal(
      (
        await context.client.query(
          "SELECT id FROM core.commerce_payment_ledger WHERE intent_id=$1",
          [intent.id],
        )
      ).rowCount,
      1,
    );
    await context.client.query(
      "INSERT INTO core.payment_test_application(intent_id,receipt_id,payment_id) VALUES($1,$2,$3)",
      [intent.id, receiptId, verified.paymentId],
    );
  },
};
const receiptSink = {
  receive: (verified) =>
    fixture.runtime("jobs", (context) =>
      new CommercePaymentRepository(context, authority, undefined, application).receive(verified),
    ),
};
const run = (actor, callback, policy, role = "core") =>
  fixture.runtime(role, async (context) => {
    const repository = new CommercePaymentRepository(context, authority, policy, application);
    const adapter = new RazorpayAdapter(configuration, async (url, init) => {
      assert(
        !inTransaction(context.client),
        "provider call must never hold payment transaction locks",
      );
      assert.equal(new URL(url).hostname, "api.razorpay.com");
      if (init.method === "POST") {
        postCount++;
        if (failPost) throw new Error("Synthetic lost response; provider may have created order.");
        assert.deepEqual(JSON.parse(init.body), {
          amount: 12345,
          currency: "INR",
          receipt: operationId,
          partial_payment: false,
        });
        return Response.json(order);
      }
      if (url.endsWith("/payments"))
        return Response.json({ entity: "collection", count: 1, items: [payment] });
      if (url.includes("?receipt="))
        return Response.json({ entity: "collection", count: 1, items: [order] });
      return Response.json(order);
    });
    return callback(
      new CommercePayments(repository, adapter, receiptSink),
      repository,
      context,
      actor,
    );
  });
const runJobs = (actor, callback) => run(actor, callback, undefined, "jobs");
const create = (input = request) => run(owner, (service) => service.create(owner, input));
const scalar = async (sql, parameters = []) =>
  Object.values((await fixture.source.query(sql, parameters)).rows[0])[0];

before(async () => {
  fixture = await testDatabase();
  // The coordinator owns shared journal registration. Apply only this additive migration explicitly in the isolated DB.
  const registered = await fixture.source.query(
    "SELECT id FROM public.k_platform_migrations WHERE id='0021_commerce_payments'",
  );
  if (registered.rowCount === 0)
    await fixture.source.query(
      readFileSync(
        new URL("../../packages/database/migrations/0021_commerce_payments.sql", import.meta.url),
        "utf8",
      ),
    );
  await fixture.source.query(`CREATE TABLE core.payment_test_subjects (
    id uuid PRIMARY KEY, kind text NOT NULL, owner_id uuid NOT NULL, amount_paise bigint NOT NULL,
    currency text NOT NULL DEFAULT 'INR', payable boolean NOT NULL DEFAULT true);
    GRANT SELECT,UPDATE(id) ON core.payment_test_subjects TO k_core_runtime;
    ALTER TABLE core.payment_test_subjects ENABLE ROW LEVEL SECURITY;
    ALTER TABLE core.payment_test_subjects FORCE ROW LEVEL SECURITY;
    CREATE POLICY authority_owner ON core.payment_test_subjects TO k_core_runtime
    USING(owner_id=nullif(current_setting('app.actor_id',true),'')::uuid)
    WITH CHECK(owner_id=nullif(current_setting('app.actor_id',true),'')::uuid);
    CREATE TABLE core.payment_test_application(intent_id uuid PRIMARY KEY REFERENCES core.commerce_payment_intents,
      receipt_id uuid NOT NULL REFERENCES core.commerce_payment_receipts(id), payment_id text NOT NULL);
    GRANT SELECT,INSERT ON core.payment_test_application TO k_jobs_runtime;
    ALTER TABLE core.payment_test_application ENABLE ROW LEVEL SECURITY;
    ALTER TABLE core.payment_test_application FORCE ROW LEVEL SECURITY;
    CREATE POLICY jobs_application ON core.payment_test_application TO k_jobs_runtime USING(true) WITH CHECK(true);`);
});
after(async () => {
  await fixture?.close();
});
beforeEach(async () => {
  await fixture.source.query(`TRUNCATE core.commerce_payment_receipts,core.commerce_payment_ledger,
    core.commerce_payment_refunds,core.commerce_payment_intents,core.payment_test_subjects,core.payment_test_application,platform.outbox CASCADE`);
  await fixture.source.query(
    "INSERT INTO core.payment_test_subjects(id,kind,owner_id,amount_paise) VALUES($1,'order',$2,12345)",
    [subjectId, owner],
  );
  postCount = 0;
  failPost = false;
});

test("authoritative subject binding, input validation, ownership and stable operation identity", async () => {
  await assert.rejects(run(other, (service) => service.create(other, request)));
  for (const injected of [
    { amountPaise: 1 },
    { ownerId: other },
    { method: "cod" },
    { paid: true },
  ])
    await assert.rejects(create({ ...request, ...injected }));
  const intent = await create();
  assert.equal(intent.amountPaise, 12345);
  assert.equal(intent.ownerId, owner);
  assert.equal(intent.state, "ready");
  assert.equal((await create()).id, intent.id);
  assert.equal(postCount, 1);
  await assert.rejects(create({ ...request, operationId: refundOperation }));
  await assert.rejects(run(other, (service) => service.reconcile(other, intent.id)));
  assert.equal(await scalar("SELECT count(*)::int FROM core.commerce_payment_intents"), 1);
});

test("concurrent creates and process restart cannot issue a second provider POST", async () => {
  const results = await Promise.all([create(), create()]);
  assert.equal(results[0].id, results[1].id);
  assert.equal(postCount, 1);
  assert.equal((await create()).providerOrderId, order.id);
  assert.equal(await scalar("SELECT count(*)::int FROM platform.outbox"), 1);
});

test("uncertain provider outcome survives restart and is reconciled by reads including missed capture", async () => {
  failPost = true;
  const intent = await create();
  assert.equal(intent.state, "unknown");
  failPost = false;
  assert.equal((await create()).state, "unknown");
  assert.equal(postCount, 1);
  const reconciled = await run(owner, (service) => service.reconcile(owner, intent.id));
  assert.equal(reconciled.state, "captured");
  assert.equal(postCount, 1);
  assert.equal(await scalar("SELECT count(*)::int FROM core.commerce_payment_ledger"), 1);
  assert.equal(await scalar("SELECT count(*)::int FROM core.payment_test_application"), 1);
});

test("crash immediately after create claim never retries POST, even without unknown checkpoint", async () => {
  const claimed = await run(owner, async (_service, repo) => {
    const intent = await repo.open(owner, request, configuration.accountId);
    return repo.claimCreate(owner, intent.id);
  });
  assert.equal(claimed.state, "creating");
  assert.equal((await create()).state, "creating");
  assert.equal(postCount, 0);
});

test("expired/changed authoritative subject cannot be charged after intent creation", async () => {
  const intent = await run(owner, (_service, repo) =>
    repo.open(owner, request, configuration.accountId),
  );
  await fixture.source.query("UPDATE core.payment_test_subjects SET payable=false");
  await assert.rejects(run(owner, (_service, repo) => repo.claimCreate(owner, intent.id)));
  assert.equal(postCount, 0);
  assert.equal(
    (await run(owner, (service) => service.reconcile(owner, intent.id))).state,
    "pending",
  );
});

test("concurrent webhook redelivery has one persisted financial ledger and outbox effect", async () => {
  const intent = await create();
  const outcomes = await Promise.all([
    runJobs(owner, (_service, repo) => repo.receive(event)),
    runJobs(owner, (_service, repo) => repo.receive(event)),
    runJobs(owner, (_service, repo) => repo.receive({ ...event, eventId: "evt_second" })),
  ]);
  assert(outcomes.includes("duplicate"));
  assert.equal(await scalar("SELECT count(*)::int FROM core.commerce_payment_ledger"), 1);
  assert.equal(
    await scalar("SELECT sum(amount_paise)::int FROM core.commerce_payment_ledger"),
    12345,
  );
  assert.equal(await scalar("SELECT count(*)::int FROM platform.outbox"), 2);
  assert.equal(
    (await run(owner, (_service, repo) => repo.get(owner, intent.id))).state,
    "captured",
  );
  assert.equal(
    await runJobs(owner, (_service, repo) => repo.receive({ ...event, digest: "b".repeat(64) })),
    "rejected",
  );
  assert.equal(
    await runJobs(owner, (_service, repo) =>
      repo.receive({ ...event, eventId: "evt_double", paymentId: "pay_other" }),
    ),
    "rejected",
  );
  assert.equal(
    await scalar(
      "SELECT count(*)::int FROM core.commerce_payment_obligations WHERE payment_id='pay_other'",
    ),
    1,
  );
  assert.equal(
    await runJobs(owner, (_service, repo) =>
      repo.receive({ ...event, eventId: "evt_double", paymentId: "pay_other" }),
    ),
    "rejected",
  );
  assert.equal(
    await scalar(
      "SELECT count(*)::int FROM core.commerce_payment_obligations WHERE payment_id='pay_other'",
    ),
    1,
  );
  const rejected = (
    await fixture.source.query(
      "SELECT provider_order_id,payment_id,amount_paise,currency FROM core.commerce_payment_receipts WHERE event_id='evt_double'",
    )
  ).rows[0];
  assert.deepEqual(rejected, {
    provider_order_id: order.id,
    payment_id: "pay_other",
    amount_paise: "12345",
    currency: "INR",
  });
  assert.equal(await scalar("SELECT count(*)::int FROM core.commerce_payment_ledger"), 1);
});

test("amount, currency, account, business and provider reference mismatches are durably rejected", async () => {
  await create();
  let counter = 0;
  for (const mismatch of [
    { amountPaise: 1 },
    { currency: "USD" },
    { accountId: "acc_wrong" },
    { reference: refundOperation },
    { id: "order_wrong" },
  ]) {
    const result = await runJobs(owner, (_service, repo) =>
      repo.receive({ ...event, ...mismatch, eventId: `evt_bad_${counter++}` }),
    );
    assert.equal(result, "rejected");
  }
  assert.equal(
    await scalar(
      "SELECT count(*)::int FROM core.commerce_payment_receipts WHERE result='rejected'",
    ),
    5,
  );
  assert.equal(await scalar("SELECT count(*)::int FROM core.commerce_payment_ledger"), 0);
});

test("late capture is retained after failure/cancellation; stale failure cannot erase money", async () => {
  const intent = await create();
  await runJobs(owner, (_service, repo) =>
    repo.receive({ ...event, eventId: "evt_failed", outcome: "failed", paymentId: "pay_failed" }),
  );
  assert.equal((await run(owner, (_service, repo) => repo.get(owner, intent.id))).state, "failed");
  await fixture.source.query("UPDATE core.payment_test_subjects SET payable=false");
  await runJobs(owner, (_service, repo) => repo.receive(event));
  await runJobs(owner, (_service, repo) =>
    repo.receive({ ...event, eventId: "evt_stale", outcome: "failed", paymentId: "pay_failed" }),
  );
  assert.equal(
    (await run(owner, (_service, repo) => repo.get(owner, intent.id))).state,
    "captured",
  );
  assert.equal(await scalar("SELECT count(*)::int FROM core.commerce_payment_ledger"), 1);
  assert.equal(await scalar("SELECT payable FROM core.payment_test_subjects"), false);
});

test("receipt, ledger, state and outbox roll back together when the outbox write fails", async () => {
  const intent = await create();
  await fixture.source.query(`CREATE FUNCTION core.payment_test_outbox_failure() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'synthetic outbox failure'; END $$;
    CREATE TRIGGER payment_test_outbox_failure BEFORE INSERT ON platform.outbox
    FOR EACH ROW EXECUTE FUNCTION core.payment_test_outbox_failure();`);
  try {
    await assert.rejects(runJobs(owner, (_service, repo) => repo.receive(event)));
    assert.equal(await scalar("SELECT count(*)::int FROM core.commerce_payment_receipts"), 0);
    assert.equal(await scalar("SELECT count(*)::int FROM core.commerce_payment_ledger"), 0);
    assert.equal(await scalar("SELECT count(*)::int FROM core.payment_test_application"), 0);
    assert.equal((await run(owner, (_service, repo) => repo.get(owner, intent.id))).state, "ready");
  } finally {
    await fixture.source.query(
      "DROP TRIGGER payment_test_outbox_failure ON platform.outbox; DROP FUNCTION core.payment_test_outbox_failure()",
    );
  }
  assert.equal(await runJobs(owner, (_service, repo) => repo.receive(event)), "applied");
});

test("real non-owner RLS denies unscoped/other-owner reads and immutable financial mutation", async () => {
  const intent = await create();
  await runJobs(owner, (_service, repo) => repo.receive(event));
  await run(other, async (_service, repo, context) => {
    await assert.rejects(repo.get(other, intent.id));
    assert.equal(
      (await context.client.query("SELECT id FROM core.commerce_payment_intents")).rowCount,
      0,
    );
    assert.equal(
      (await context.client.query("SELECT id FROM core.commerce_payment_ledger")).rowCount,
      0,
    );
    await assert.rejects(
      context.client.query("UPDATE core.commerce_payment_ledger SET amount_paise=1"),
    );
    await assert.rejects(context.client.query("DELETE FROM core.commerce_payment_receipts"));
    assert.equal(
      (
        await context.client.query(
          "SELECT nullif(current_setting('app.actor_id',true),'') AS actor",
        )
      ).rows[0].actor,
      null,
    );
  });
});

test("CORE cannot receive verified payments; JOBS cannot create owner payment intents", async () => {
  await create();
  await assert.rejects(run(owner, (_service, repo) => repo.receive(event)));
  await assert.rejects(
    runJobs(owner, (_service, repo) => repo.open(owner, request, configuration.accountId)),
  );
  assert.equal(await scalar("SELECT count(*)::int FROM core.commerce_payment_ledger"), 0);
});

test("missing application denies capture and application failure rolls back every fact", async () => {
  await create();
  await fixture.runtime("jobs", async (context) => {
    await assert.rejects(new CommercePaymentRepository(context, authority).receive(event));
    const failing = {
      async apply() {
        throw new Error("Synthetic application failure");
      },
    };
    await assert.rejects(
      new CommercePaymentRepository(context, authority, undefined, failing).receive(event),
    );
  });
  assert.equal(await scalar("SELECT count(*)::int FROM core.commerce_payment_receipts"), 0);
  assert.equal(await scalar("SELECT count(*)::int FROM core.commerce_payment_ledger"), 0);
  assert.equal(await scalar("SELECT count(*)::int FROM core.payment_test_application"), 0);
  assert.equal(await scalar("SELECT count(*)::int FROM platform.outbox"), 1);
});

test("altered event replay retains capture evidence and a deduplicated reconciliation obligation", async () => {
  await create();
  await runJobs(owner, (_service, repo) => repo.receive(event));
  const altered = { ...event, digest: "c".repeat(64), paymentId: "pay_additional" };
  assert.equal(await runJobs(owner, (_service, repo) => repo.receive(altered)), "rejected");
  assert.equal(await runJobs(owner, (_service, repo) => repo.receive(altered)), "rejected");
  assert.equal(
    await scalar(
      "SELECT count(*)::int FROM core.commerce_payment_receipts WHERE event_id='evt_synthetic'",
    ),
    2,
  );
  assert.equal(await scalar("SELECT count(*)::int FROM core.commerce_payment_obligations"), 1);
  assert.equal(
    await scalar("SELECT reason FROM core.commerce_payment_obligations"),
    "replay_mismatch",
  );
  assert.equal(await scalar("SELECT count(*)::int FROM core.commerce_payment_ledger"), 1);
  assert.equal(await scalar("SELECT count(*)::int FROM core.payment_test_application"), 1);
  assert.equal(await scalar("SELECT count(*)::int FROM platform.outbox"), 3);
});

test("refund policy defaults deny; approved requests are durable, scoped and bounded under concurrency", async () => {
  const intent = await create();
  await runJobs(owner, (_service, repo) => repo.receive(event));
  const refund = { operationId: refundOperation, intentId: intent.id, amountPaise: 7000 };
  await assert.rejects(run(owner, (service) => service.requestRefund(owner, refund)));
  await assert.rejects(
    run(other, (service) => service.requestRefund(other, refund), approvedPolicy),
  );
  const id = await run(owner, (service) => service.requestRefund(owner, refund), approvedPolicy);
  assert.equal(
    await run(owner, (service) => service.requestRefund(owner, refund), approvedPolicy),
    id,
  );
  await assert.rejects(
    run(
      owner,
      (service) => service.requestRefund(owner, { ...refund, amountPaise: 1 }),
      approvedPolicy,
    ),
  );
  const concurrent = await Promise.allSettled(
    [6000, 5000].map((amountPaise, index) =>
      run(
        owner,
        (service) =>
          service.requestRefund(owner, {
            ...refund,
            amountPaise,
            operationId: `30000000-0000-4000-8000-00000000001${index}`,
          }),
        approvedPolicy,
      ),
    ),
  );
  assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(
    await scalar("SELECT sum(amount_paise)::int FROM core.commerce_payment_refunds"),
    12000,
  );
  assert.equal(await scalar("SELECT count(*)::int FROM platform.outbox"), 4);
  assert.equal(postCount, 1, "refund foundation must not send provider refunds");
});

test("booking payment linkage writes only financial records, never booking/clinical state", async () => {
  await fixture.source.query("UPDATE core.payment_test_subjects SET kind='booking'");
  const intent = await create({ ...request, subject: { kind: "booking", id: subjectId } });
  await runJobs(owner, (_service, repo) => repo.receive(event));
  assert.equal(intent.subject.kind, "booking");
  assert.equal(await scalar("SELECT payable FROM core.payment_test_subjects"), true);
  assert.equal(await scalar("SELECT count(*)::int FROM core.commerce_payment_ledger"), 1);
});

test("approved refund aggregate cap includes prior requests, not just each request", async () => {
  const intent = await create();
  await runJobs(owner, (_service, repo) => repo.receive(event));
  const policy = {
    decide: async () => ({ version: "synthetic-cap", approvedBy: other, maximumPaise: 8000 }),
  };
  await run(
    owner,
    (service) =>
      service.requestRefund(owner, {
        operationId: refundOperation,
        intentId: intent.id,
        amountPaise: 7000,
      }),
    policy,
  );
  await assert.rejects(
    run(
      owner,
      (service) =>
        service.requestRefund(owner, {
          operationId: other,
          intentId: intent.id,
          amountPaise: 2000,
        }),
      policy,
    ),
  );
  assert.equal(
    await scalar("SELECT sum(amount_paise)::int FROM core.commerce_payment_refunds"),
    7000,
  );
});

test("backup profile has schema usage and read-only access through FORCE RLS", async () => {
  await create();
  await runJobs(owner, (_service, repo) =>
    repo.receive({ ...event, paymentId: "pay_unmatched", amountPaise: 1 }),
  );
  try {
    await fixture.source.query("SET ROLE k_backup_runtime");
    assert.equal(await scalar("SELECT count(*)::int FROM core.commerce_payment_intents"), 1);
    assert.equal(await scalar("SELECT count(*)::int FROM core.commerce_payment_receipts"), 1);
    assert.equal(await scalar("SELECT count(*)::int FROM core.commerce_payment_obligations"), 1);
    await assert.rejects(fixture.source.query("DELETE FROM core.commerce_payment_obligations"));
  } finally {
    await fixture.source.query("RESET ROLE");
  }
});

test("HTTP-ready raw webhook boundary acknowledges only committed receipts, denies browser-paid and cross-owner input", async () => {
  // Isolated test HTTP harness, NOT production authentication/routes. Coordinator wires verified identity and these services.
  const server = createServer(async (req, res) => {
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 262144) throw new Error("too large");
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks);
      let result;
      if (req.url === "/webhook") {
        result = await run(owner, (service) =>
          service.webhook(
            raw,
            String(req.headers["x-razorpay-signature"] ?? ""),
            String(req.headers["x-razorpay-event-id"] ?? ""),
          ),
        );
      } else {
        const actor =
          req.headers.authorization === "synthetic-owner-session"
            ? owner
            : req.headers.authorization === "synthetic-other-session"
              ? other
              : null;
        if (!actor) {
          res.writeHead(401).end();
          return;
        }
        if (req.url !== "/intents") {
          res.writeHead(404).end();
          return;
        }
        result = await run(actor, (service) =>
          service.create(actor, JSON.parse(raw.toString("utf8"))),
        );
      }
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result));
    } catch {
      res.writeHead(400).end("Rejected");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = (path, body, headers = {}) =>
    fetch(`${base}${path}`, {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers,
    });
  try {
    assert.equal((await send("/intents", request)).status, 401);
    assert.equal(
      (await send("/intents", request, { Authorization: "synthetic-other-session" })).status,
      400,
    );
    assert.equal(
      (
        await send(
          "/intents",
          { ...request, paid: true },
          { Authorization: "synthetic-owner-session" },
        )
      ).status,
      400,
    );
    const response = await send("/intents", request, { Authorization: "synthetic-owner-session" });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).state, "ready");
    assert.equal(
      (await send("/browser-paid", {}, { Authorization: "synthetic-owner-session" })).status,
      404,
    );
    const raw = JSON.stringify({
      entity: "event",
      account_id: configuration.accountId,
      event: "payment.captured",
      payload: { payment: { entity: payment } },
    });
    const signature = createHmac("sha256", configuration.webhookSecret).update(raw).digest("hex");
    const headers = { "x-razorpay-signature": signature, "x-razorpay-event-id": "evt_http" };
    assert.equal((await send("/webhook", `${raw} `, headers)).status, 400);
    assert.equal((await send("/webhook", raw, headers)).status, 200);
    assert.equal(await (await send("/webhook", raw, headers)).json(), "duplicate");
    assert.equal(await scalar("SELECT count(*)::int FROM core.commerce_payment_ledger"), 1);
    assert.equal(await scalar("SELECT count(*)::int FROM core.commerce_payment_receipts"), 1);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
