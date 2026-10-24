import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { registerHooks } from "node:module";
import { after, before, test } from "node:test";
import { testDatabase } from "./support.mjs";

// Existing shared contracts use bundler-style relative imports. Resolve just those
// TS imports in this Node PostgreSQL harness; production Workers use their bundler.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (
        (specifier.startsWith("./") || specifier.startsWith("../")) &&
        !/\.[a-z]+$/i.test(specifier)
      ) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});
const booking = await import("../../packages/database/src/booking.ts");
const { transaction, inTransaction } = await import("../../packages/database/src/client.ts");
let fixture;

test("jobs reconciliation enqueue privilege cannot create unrelated or fabricated transport obligations", async () => {
  await fixture.runtime("jobs", async ({ client }) => {
    for (const kind of ["platform.probe", "commerce.reconcile"]) {
      await assert.rejects(
        client.query(
          `INSERT INTO platform.outbox(id,operation_id,channel,kind,subject_id,revision,due_at,deadline_at,next_attempt_at)
         VALUES($1,$2,'financial',$3,$2,1,clock_timestamp(),clock_timestamp()+interval '1 day',clock_timestamp())`,
          [randomUUID(), randomUUID(), kind],
        ),
      );
    }
  });
});
before(
  async () => {
    fixture = await testDatabase();
    // Parent owns the journal. Apply this additive slice explicitly until integrated.
    const exists = await fixture.source.query(
      "SELECT to_regclass('clinical.mathew_booking_booking') AS name",
    );
    if (!exists.rows[0].name)
      await fixture.source.query(
        await readFile(
          new URL("../../packages/database/migrations/0003_mathew_booking.sql", import.meta.url),
          "utf8",
        ),
      );
    await fixture.source.query(`CREATE TABLE clinical.booking_runtime_authority_fixture (
    session_id uuid PRIMARY KEY, subject_id uuid NOT NULL, authority jsonb NOT NULL, revoked boolean NOT NULL DEFAULT false);
    GRANT SELECT, UPDATE(session_id) ON clinical.booking_runtime_authority_fixture TO k_core_runtime;`);
    await fixture.source.query(`CREATE TABLE clinical.booking_runtime_financial_receipt_fixture(id uuid PRIMARY KEY);
    GRANT SELECT, INSERT ON clinical.booking_runtime_financial_receipt_fixture TO k_jobs_runtime;`);
  },
  { timeout: 30000 },
);
after(async () => {
  await fixture?.close();
});

const loadAuthority = async (context, principal) => {
  assert.equal(inTransaction(context.client), true);
  const result = await context.client.query(
    `SELECT authority FROM clinical.booking_runtime_authority_fixture
    WHERE session_id=$1 AND subject_id=$2 AND NOT revoked FOR SHARE`,
    [principal.sessionId, principal.actorId],
  );
  if (!result.rows[0]) throw new booking.BookingRuntimeError("DENIED");
  return result.rows[0].authority;
};
async function identity(
  kind = "customer",
  clinicIds = [],
  actions = ["booking:create", "booking:read"],
) {
  const principal = {
    actorId: randomUUID(),
    sessionId: randomUUID(),
    organizationId: null,
    authenticatedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2030-01-01T00:00:00.000Z",
    mfa: null,
  };
  if (kind === "front_desk") {
    principal.organizationId = randomUUID();
    principal.mfa = {
      verifiedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2030-01-01T00:00:00.000Z",
    };
  }
  const authority =
    kind === "customer"
      ? { kind, customerId: principal.actorId }
      : {
          kind,
          staffId: principal.actorId,
          clinicIds,
          organizationVerified: true,
          mfaVerified: true,
        };
  await fixture.source.query(
    "INSERT INTO clinical.booking_runtime_authority_fixture(session_id,subject_id,authority) VALUES($1,$2,$3)",
    [principal.sessionId, principal.actorId, authority],
  );
  for (const action of actions) {
    for (const clinicId of kind === "customer" ? [null] : clinicIds) {
      await fixture.source.query(
        `INSERT INTO clinical.mathew_booking_grant(id,actor_id,action,scope,clinic_id,valid_from,expires_at)
        VALUES($1,$2,$3,$4,$5,'2020-01-01T00:00:00.000Z','2031-01-01T00:00:00.000Z')`,
        [
          randomUUID(),
          principal.actorId,
          action,
          kind === "customer" ? "self" : "clinic",
          clinicId,
        ],
      );
    }
  }
  return principal;
}
async function scheduling({
  doctorId = randomUUID(),
  clinicId = randomUUID(),
  duration = 60000,
  before = 0,
  after = 0,
  start = "2030-01-01T10:00:00.000Z",
} = {}) {
  const availabilityId = randomUUID();
  const policy = { id: randomUUID(), revision: 1, holdDurationMs: duration };
  const availability = {
    id: availabilityId,
    revision: 1,
    doctorId,
    clinicId,
    clinicTimezone: "Asia/Kolkata",
    window: { start, end: "2030-01-01T18:00:00.000Z" },
    slotLengthMs: 1800000,
    buffers: { beforeMs: before, afterMs: after },
    modalities: ["online", "in_clinic"],
  };
  const fees = ["online", "in_clinic"].map((modality) => ({
    feeId: randomUUID(),
    revision: 1,
    doctorId,
    clinicId,
    modality,
    amountPaise: 50000,
    currency: "INR",
    approvedPolicyId: policy.id,
  }));
  const document = {
    doctorId,
    revision: 1,
    departmentId: randomUUID(),
    clinicIds: [clinicId],
    displayName: "Synthetic physician",
    qualifications: ["Synthetic approved credential"],
    languages: ["en"],
    approvedPhotoObjectId: randomUUID(),
    publicationApprovalId: randomUUID(),
  };
  await fixture.source.query(
    "INSERT INTO clinical.mathew_booking_directory(doctor_id,document,published) VALUES($1,$2,true) ON CONFLICT DO NOTHING",
    [doctorId, document],
  );
  await fixture.source.query(
    "INSERT INTO clinical.mathew_booking_configuration(availability_id,doctor_id,availability,policy,fees,enabled) VALUES($1,$2,$3,$4,$5,true)",
    [availabilityId, doctorId, availability, policy, JSON.stringify(fees)],
  );
  return { doctorId, clinicId, availabilityId, start };
}
function command(resource, principal, overrides = {}) {
  return {
    bookingId: randomUUID(),
    operationId: randomUUID(),
    request: {
      doctorId: resource.doctorId,
      clinicId: resource.clinicId,
      ownerId: principal.actorId,
      availabilityId: resource.availabilityId,
      expectedAvailabilityRevision: 1,
      modality: "online",
      start: resource.start,
      ...overrides,
    },
  };
}
const hold = (principal, input) =>
  fixture.runtime("core", (context) =>
    booking.persistBookingHold(context, principal, input, loadAuthority),
  );
async function bind(record, orderId) {
  return fixture.runtime("jobs", (context) =>
    transaction(context.client, () =>
      booking.bindBookingPaymentOrder(context, record.id, record.revision, orderId),
    ),
  );
}
const payment = (record, overrides = {}) => ({
  provider: "razorpay",
  eventId: `event_${randomUUID()}`,
  paymentId: `pay_${randomUUID()}`,
  orderId: record.paymentOrderId,
  bookingId: record.id,
  amountPaise: record.fee.amountPaise,
  currency: "INR",
  verificationReference: randomUUID(),
  status: "captured",
  ...overrides,
});
async function capture(proof, revision) {
  // Trusted financial test fixture provisions verified evidence, not a public API.
  await fixture.source.query(
    "INSERT INTO clinical.mathew_booking_verified_capture(id,document) VALUES($1,$2)",
    [proof.verificationReference, proof],
  );
  return fixture.runtime("jobs", (context) =>
    booking.applyVerifiedBookingCapture(context, proof.verificationReference, revision),
  );
}

test("real PostgreSQL doctor-global exclusion rejects concurrent cross-clinic holds, including buffers; exact adjacency succeeds", async () => {
  const left = await scheduling({ after: 300000 });
  const right = await scheduling({ doctorId: left.doctorId, start: "2030-01-01T10:30:00.000Z" });
  const a = await identity();
  const b = await identity();
  const outcomes = await Promise.allSettled([
    hold(a, command(left, a)),
    hold(b, command(right, b)),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  const winner = outcomes.find((outcome) => outcome.status === "fulfilled").value;
  const occupied = await fixture.source.query(
    "SELECT lower(occupied) AS start,upper(occupied) AS finish FROM clinical.mathew_booking_booking WHERE id=$1",
    [winner.id],
  );
  const adjacent = await scheduling({
    doctorId: left.doctorId,
    start: occupied.rows[0].finish.toISOString(),
  });
  assert.equal((await hold(a, command(adjacent, a))).state, "held");
});

test("same operation retry is durable, different facts conflict, current revocation and owner/RLS denial survive pooled cleanup", async () => {
  const resource = await scheduling();
  const owner = await identity();
  const other = await identity();
  const input = command(resource, owner);
  const [first, replay] = await Promise.all([hold(owner, input), hold(owner, input)]);
  assert.deepEqual(first, replay);
  await assert.rejects(
    hold(owner, { ...input, request: { ...input.request, start: "2030-01-01T11:00:00.000Z" } }),
    /CONFLICT/,
  );
  await assert.rejects(
    fixture.runtime("core", (context) =>
      booking.readBooking(context, other, first.id, loadAuthority),
    ),
    /DENIED/,
  );
  await fixture.runtime("core", async (context) => {
    assert.equal(
      (
        await context.client.query("SELECT * FROM clinical.mathew_booking_booking WHERE id=$1", [
          first.id,
        ])
      ).rowCount,
      0,
    );
  });
  await fixture.source.query(
    "UPDATE clinical.booking_runtime_authority_fixture SET revoked=true WHERE session_id=$1",
    [owner.sessionId],
  );
  await assert.rejects(hold(owner, input), /DENIED/);
  assert.equal(
    (
      await fixture.source.query(
        "SELECT * FROM clinical.mathew_booking_audit WHERE booking_id=$1",
        [first.id],
      )
    ).rowCount,
    1,
  );
});

test("current authority fence blocks concurrent revocation until domain commit; the next request is denied", async () => {
  const resource = await scheduling();
  const owner = await identity();
  let signalEntered;
  let release;
  const entered = new Promise((resolve) => {
    signalEntered = resolve;
  });
  const permitted = new Promise((resolve) => {
    release = resolve;
  });
  const commandInput = command(resource, owner);
  const writing = fixture.runtime("core", (context) =>
    booking.persistBookingHold(context, owner, commandInput, async (...args) => {
      const value = await loadAuthority(...args);
      signalEntered();
      await permitted;
      return value;
    }),
  );
  await entered;
  try {
    await fixture.source.query("BEGIN");
    await fixture.source.query("SET LOCAL lock_timeout = '100ms'");
    await assert.rejects(
      fixture.source.query(
        "UPDATE clinical.booking_runtime_authority_fixture SET revoked=true WHERE session_id=$1",
        [owner.sessionId],
      ),
      (error) => error.code === "55P03",
    );
  } finally {
    await fixture.source.query("ROLLBACK");
    release();
  }
  const saved = await writing;
  assert.equal(saved.state, "held");
  await fixture.source.query(
    "UPDATE clinical.booking_runtime_authority_fixture SET revoked=true WHERE session_id=$1",
    [owner.sessionId],
  );
  await assert.rejects(hold(owner, commandInput), /DENIED/);
});

test("provider order binding CAS is idempotent and cannot rebind or mutate the fee snapshot", async () => {
  const resource = await scheduling();
  const owner = await identity();
  const held = await hold(owner, command(resource, owner));
  const orderId = `order_${randomUUID()}`;
  const [first, replay] = await Promise.all([bind(held, orderId), bind(held, orderId)]);
  assert.deepEqual(first, replay);
  assert.equal(first.revision, held.revision + 1);
  await assert.rejects(bind(first, `order_${randomUUID()}`), /CONFLICT/);
  await assert.rejects(
    fixture.runtime("jobs", (context) =>
      transaction(context.client, () =>
        context.client.query(
          `UPDATE clinical.mathew_booking_booking SET revision=revision+1,
      document=jsonb_set(jsonb_set(document,'{revision}',to_jsonb(revision+1)),'{fee,amountPaise}','1'::jsonb) WHERE id=$1`,
          [held.id],
        ),
      ),
    ),
    /immutable/,
  );
  const target = await fixture.runtime("jobs", (context) =>
    transaction(context.client, () => booking.loadBookingPaymentTarget(context, held.id)),
  );
  assert.equal(target.amountPaise, held.fee.amountPaise);
});

test("scoped CORE financial adapter can read/bind but cannot mark paid or change payment audit", async () => {
  const resource = await scheduling();
  const owner = await identity();
  const held = await hold(owner, command(resource, owner));
  const orderId = `order_${randomUUID()}`;
  const bound = await fixture.runtime("core", (context) =>
    transaction(context.client, async () => {
      await booking.authorizeBookingInTransaction(context, owner, "booking:create", loadAuthority);
      const target = await booking.loadBookingPaymentTarget(context, held.id);
      assert.equal(target.amountPaise, held.fee.amountPaise);
      return booking.bindBookingPaymentOrder(context, held.id, target.revision, orderId);
    }),
  );
  assert.equal(bound.paymentOrderId, orderId);
  await assert.rejects(
    fixture.runtime("core", (context) =>
      transaction(context.client, async () => {
        await booking.authorizeBookingInTransaction(
          context,
          owner,
          "booking:create",
          loadAuthority,
        );
        await context.client.query(
          "UPDATE clinical.mathew_booking_booking SET state='confirmed' WHERE id=$1",
          [held.id],
        );
      }),
    ),
    /permission denied/,
  );
  await assert.rejects(
    fixture.runtime("core", (context) =>
      transaction(context.client, async () => {
        await booking.authorizeBookingInTransaction(
          context,
          owner,
          "booking:create",
          loadAuthority,
        );
        await context.client.query(
          `UPDATE clinical.mathew_booking_booking SET revision=revision+1,
      document=jsonb_set(jsonb_set(document,'{revision}',to_jsonb(revision+1)),'{payments}','[{}]'::jsonb) WHERE id=$1`,
          [held.id],
        );
      }),
    ),
    /Financial state requires the jobs role/,
  );
});

test("workspace/current identity alone cannot grant booking actions; read/create are distinct and revoked explicit grants deny", async () => {
  const resource = await scheduling();
  const withoutGrant = await identity("customer", [], []);
  await assert.rejects(hold(withoutGrant, command(resource, withoutGrant)), /DENIED/);
  const readOnly = await identity("customer", [], ["booking:read"]);
  await assert.rejects(hold(readOnly, command(resource, readOnly)), /DENIED/);
  const createOnly = await identity("customer", [], ["booking:create"]);
  const input = command(resource, createOnly);
  const saved = await hold(createOnly, input);
  await assert.rejects(
    fixture.runtime("core", (context) =>
      booking.readBooking(context, createOnly, saved.id, loadAuthority),
    ),
    /DENIED/,
  );
  await fixture.source.query(
    "UPDATE clinical.mathew_booking_grant SET revoked_at=clock_timestamp() WHERE actor_id=$1",
    [createOnly.actorId],
  );
  await assert.rejects(hold(createOnly, input), /DENIED/);
});

test("invalid grid/stale availability, forged owner and missing MFA fail before persistence", async () => {
  const resource = await scheduling();
  const owner = await identity();
  const other = await identity();
  await assert.rejects(
    hold(owner, command(resource, owner, { expectedAvailabilityRevision: 2 })),
    /CONFLICT/,
  );
  await assert.rejects(
    hold(owner, command(resource, owner, { start: "2030-01-01T10:00:00.001Z" })),
    /CONFLICT/,
  );
  await assert.rejects(hold(owner, command(resource, other)), /DENIED/);
  const staff = await identity("front_desk", [resource.clinicId]);
  await assert.rejects(
    hold({ ...staff, mfa: null }, command(resource, owner, { modality: "in_clinic" })),
    /DENIED/,
  );
  assert.equal(
    (
      await fixture.source.query(
        "SELECT * FROM clinical.mathew_booking_booking WHERE doctor_id=$1",
        [resource.doctorId],
      )
    ).rowCount,
    0,
  );
});

test("front desk shares canonical booking lifecycle and cannot book online or outside clinic; leave remains global", async () => {
  const resource = await scheduling();
  const staff = await identity("front_desk", [resource.clinicId]);
  const patient = await identity();
  await assert.rejects(hold(staff, command(resource, patient)), /DENIED/);
  const record = await hold(staff, command(resource, patient, { modality: "in_clinic" }));
  assert.deepEqual(record.provenance, { source: "front_desk", staffId: staff.actorId });
  const other = await scheduling({
    doctorId: resource.doctorId,
    start: "2030-01-01T13:00:00.000Z",
  });
  await assert.rejects(hold(staff, command(other, patient, { modality: "in_clinic" })), /DENIED/);
  const leave = {
    id: randomUUID(),
    revision: 1,
    doctorId: resource.doctorId,
    interval: { start: "2030-01-01T13:00:00.000Z", end: "2030-01-01T14:00:00.000Z" },
  };
  await fixture.source.query(
    "INSERT INTO clinical.mathew_booking_leave(id,doctor_id,document) VALUES($1,$2,$3)",
    [leave.id, leave.doctorId, leave],
  );
  await assert.rejects(hold(patient, command(other, patient)), /CONFLICT/);
});

test("verified capture confirms once, aliases persist, reused event conflicts, and additional capture creates one obligation/outbox", async () => {
  const resource = await scheduling();
  const owner = await identity();
  const record = await bind(await hold(owner, command(resource, owner)), `order_${randomUUID()}`);
  const proof = payment(record);
  const confirmed = await capture(proof, record.revision);
  assert.equal(confirmed.state, "confirmed");
  const alias = { ...proof, eventId: `event_${randomUUID()}`, verificationReference: randomUUID() };
  assert.equal((await capture(alias, 1)).revision, confirmed.revision);
  const conflicting = payment(record, { eventId: alias.eventId });
  await assert.rejects(capture(conflicting, confirmed.revision), /CONFLICT/);
  const extra = payment(record);
  const result = await capture(extra, confirmed.revision);
  assert.equal(result.payments.length, 2);
  assert.equal(result.payments[1].disposition, "rebook_or_refund_required");
  assert.equal(
    (
      await fixture.source.query(
        "SELECT * FROM clinical.mathew_booking_delivery WHERE payment_id=$1",
        [proof.paymentId],
      )
    ).rowCount,
    2,
  );
  assert.equal(
    (
      await fixture.source.query(
        "SELECT * FROM clinical.mathew_booking_obligation WHERE booking_id=$1",
        [record.id],
      )
    ).rowCount,
    1,
  );
  assert.equal(
    (
      await fixture.source.query(
        "SELECT * FROM platform.outbox WHERE subject_id IN (SELECT id FROM clinical.mathew_booking_obligation WHERE booking_id=$1)",
        [record.id],
      )
    ).rowCount,
    1,
  );
});

test("expiry releases only after explicit CAS commit; late capture never reoccupies and has one reconciliation obligation", async () => {
  const resource = await scheduling({ duration: 3000 });
  const owner = await identity();
  const record = await bind(await hold(owner, command(resource, owner)), `order_${randomUUID()}`);
  await fixture.source.query("SELECT pg_sleep(3.05)");
  const fresh = await scheduling({ doctorId: resource.doctorId });
  await assert.rejects(hold(owner, command(fresh, owner)), /CONFLICT/);
  const expired = await Promise.all([
    fixture.runtime("jobs", (context) => booking.expireDueBookingHolds(context)),
    fixture.runtime("jobs", (context) => booking.expireDueBookingHolds(context)),
  ]);
  assert.equal(expired[0] + expired[1] >= 1, true);
  const replacement = await hold(owner, command(fresh, owner));
  assert.equal(replacement.state, "held");
  const proof = payment(record);
  const late = await capture(proof, record.revision + 1);
  assert.equal(late.state, "expired");
  assert.equal(late.payments[0].disposition, "rebook_or_refund_required");
  const alias = { ...proof, eventId: `event_${randomUUID()}`, verificationReference: randomUUID() };
  await capture(alias, 1);
  assert.equal(
    (
      await fixture.source.query(
        "SELECT * FROM clinical.mathew_booking_obligation WHERE booking_id=$1",
        [record.id],
      )
    ).rowCount,
    1,
  );
});

test("same-transaction financial callback rolls back booking/payment/outbox with caller failure; unverified runtime receipt writes denied", async () => {
  const resource = await scheduling();
  const owner = await identity();
  const record = await bind(await hold(owner, command(resource, owner)), `order_${randomUUID()}`);
  const proof = payment(record);
  await assert.rejects(
    fixture.runtime("jobs", (context) =>
      transaction(context.client, async () => {
        await context.client.query(
          "INSERT INTO clinical.booking_runtime_financial_receipt_fixture(id) VALUES($1)",
          [proof.verificationReference],
        );
        await booking.applyVerifiedBookingPayment(context, proof);
        throw new Error("Synthetic caller failure");
      }),
    ),
    /Synthetic caller failure/,
  );
  assert.equal(
    (
      await fixture.source.query(
        "SELECT * FROM clinical.booking_runtime_financial_receipt_fixture WHERE id=$1",
        [proof.verificationReference],
      )
    ).rowCount,
    0,
  );
  const stored = await fixture.source.query(
    "SELECT document FROM clinical.mathew_booking_booking WHERE id=$1",
    [record.id],
  );
  assert.equal(stored.rows[0].document.state, "held");
  assert.equal(
    (
      await fixture.source.query(
        "SELECT * FROM clinical.mathew_booking_payment WHERE booking_id=$1",
        [record.id],
      )
    ).rowCount,
    0,
  );
  await assert.rejects(
    fixture.runtime("core", (context) =>
      context.client.query(
        "INSERT INTO clinical.mathew_booking_verified_capture(id,document) VALUES($1,$2)",
        [proof.verificationReference, proof],
      ),
    ),
    /permission denied/,
  );
});

test("HTTP E2E over loopback uses real PostgreSQL for directory, both availability paths, hold/read, idempotent retry and current revocation", async () => {
  const { createService } = await import("../../packages/server/src/index.ts");
  const { registerBookingRoutes } = await import("../../apps/core-api/src/booking.ts");
  const resource = await scheduling();
  const principal = await identity();
  const app = createService("core-api", () => {}, {
    registerRoutes: (app) =>
      registerBookingRoutes(app, {
        // Explicit synthetic provider proof; this test proves HTTP/SQL, not WorkOS.
        verifySession: async () => ({ status: "verified", identity: principal }),
        verifyMutation: async (request) =>
          request.headers.get("X-Synthetic-CSRF") === "accepted" ? "allowed" : "denied",
        loadAuthority,
        withContext: (callback) => fixture.runtime("core", callback),
      }),
  });
  const server = createServer(async (request, response) => {
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const input = new Request(`http://127.0.0.1${request.url}`, {
        method: request.method,
        headers: request.headers,
        ...(request.method === "POST" ? { body: Buffer.concat(chunks) } : {}),
      });
      const output = await app.fetch(input, { APP_ENV: "local" });
      response.writeHead(output.status, Object.fromEntries(output.headers));
      response.end(Buffer.from(await output.arrayBuffer()));
    } catch {
      response.writeHead(500);
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const directory = await fetch(`${base}/v1/doctors`);
    assert.equal(directory.status, 200);
    assert.equal(directory.headers.get("cache-control"), "no-store");
    assert.equal(
      (await directory.json()).doctors.some((entry) => entry.doctorId === resource.doctorId),
      true,
    );
    const alias = await (
      await fetch(`${base}/v1/availability?doctorId=${resource.doctorId}`)
    ).json();
    const nested = await (
      await fetch(`${base}/v1/doctors/${resource.doctorId}/availability`)
    ).json();
    assert.deepEqual(alias, nested);
    const input = command(resource, principal);
    const post = (payload = input, csrf = "accepted") =>
      fetch(`${base}/v1/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Synthetic-CSRF": csrf },
        body: JSON.stringify(payload),
      });
    assert.equal((await post(input, "rejected")).status, 403);
    assert.equal((await post({ ...input, fee: 1 })).status, 400);
    const first = await post();
    assert.equal(first.status, 200);
    const saved = await first.json();
    assert.equal(saved.persisted, true);
    assert.equal(saved.booking.state, "held");
    const replay = await post();
    assert.equal(replay.status, 200);
    assert.deepEqual(await replay.json(), saved);
    assert.equal((await fetch(`${base}/v1/bookings/${input.bookingId}`)).status, 200);
    await fixture.source.query(
      "UPDATE clinical.booking_runtime_authority_fixture SET revoked=true WHERE session_id=$1",
      [principal.sessionId],
    );
    assert.equal((await fetch(`${base}/v1/bookings/${input.bookingId}`)).status, 403);
    assert.equal((await post()).status, 403);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
