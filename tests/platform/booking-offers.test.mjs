import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { registerHooks } from "node:module";
import { after, before, test } from "node:test";
import { testDatabase } from "./support.mjs";

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (
        (specifier.startsWith("./") || specifier.startsWith("../")) &&
        !/\.[a-z]+$/i.test(specifier)
      )
        return next(`${specifier}.ts`, context);
      throw error;
    }
  },
});
const { readBookingMetadata, readBookingOffers } = await import(
  "../../packages/database/src/booking-offers.ts"
);
const { decideBookingHold } = await import("../../packages/domain/src/booking/index.ts");
const { persistBookingHold } = await import("../../packages/database/src/booking.ts");
const { createService } = await import("../../packages/server/src/index.ts");
const { registerBookingOffersRoutes } = await import("../../apps/core-api/src/booking-offers.ts");
let fixture;
const doctorId = randomUUID(),
  clinicId = randomUUID(),
  serviceId = randomUUID(),
  availabilityId = randomUUID(),
  policyId = randomUUID();
const start = "2030-01-01T10:00:00.000Z",
  until = "2030-01-01T12:00:00.000Z";
const approval = {
  publicationApprovalId: randomUUID(),
  approvedByActorId: randomUUID(),
  approvedAt: "2026-01-01T00:00:00.000Z",
};
const availability = {
  id: availabilityId,
  revision: 1,
  doctorId,
  clinicId,
  clinicTimezone: "Asia/Kolkata",
  window: { start, end: until },
  slotLengthMs: 1800000,
  buffers: { beforeMs: 0, afterMs: 0 },
  modalities: ["online"],
};
const policy = { id: policyId, revision: 1, holdDurationMs: 60000 };
const fee = {
  feeId: randomUUID(),
  revision: 1,
  doctorId,
  clinicId,
  modality: "online",
  amountPaise: 50000,
  currency: "INR",
  approvedPolicyId: policyId,
};
const query = { doctorId, clinicId, serviceId, modality: "online", from: start, until };
const offers = () => fixture.runtime("core", (context) => readBookingOffers(context, query));
async function configuredMetadata() {
  await fixture.source.query(
    "INSERT INTO clinical.mathew_booking_clinic_metadata(clinic_id,document,published) VALUES($1,$2,true)",
    [
      clinicId,
      {
        clinicId,
        revision: 1,
        displayName: "Synthetic approved clinic",
        clinicTimezone: "Asia/Kolkata",
        ...approval,
      },
    ],
  );
  await fixture.source.query(
    "INSERT INTO clinical.mathew_booking_service_metadata(service_id,document,published) VALUES($1,$2,true)",
    [serviceId, { serviceId, revision: 1, displayName: "Synthetic approved service", ...approval }],
  );
  await fixture.source.query(
    "INSERT INTO clinical.mathew_booking_offer_service(availability_id,modality,service_id) VALUES($1,'online',$2)",
    [availabilityId, serviceId],
  );
}
async function occupy(
  slotStart = start,
  {
    state = "held",
    expires = "2029-12-31T00:00:00.000Z",
    otherClinic = false,
    beforeMs = 0,
    afterMs = 0,
  } = {},
) {
  const ownerId = randomUUID(),
    id = randomUUID();
  const decision = decideBookingHold({
    request: {
      doctorId,
      clinicId,
      ownerId,
      availabilityId,
      expectedAvailabilityRevision: 1,
      modality: "online",
      start: slotStart,
    },
    authority: { kind: "customer", customerId: ownerId },
    now: "2025-12-31T23:59:00.000Z",
    bookingId: id,
    paymentOrderId: `unbound_${id}`,
    availability,
    leaves: [],
    occupied: [],
    fee,
    policy,
  });
  assert.equal(decision.kind, "hold_intent");
  const record = structuredClone(decision.booking);
  record.state = state;
  record.holdExpiresAt = expires;
  if (otherClinic) {
    record.slot.clinicId = randomUUID();
    record.fee.clinicId = record.slot.clinicId;
  }
  record.slot.buffers = { beforeMs, afterMs };
  await fixture.source.query(
    `INSERT INTO clinical.mathew_booking_booking(id,operation_id,request,owner_id,doctor_id,clinic_id,revision,state,occupied,expires_at,document)
    VALUES($1,$2,'{}',$3,$4,$5,1,$6,tstzrange($7,$8,'[)'),$9,$10)`,
    [
      id,
      randomUUID(),
      ownerId,
      doctorId,
      record.slot.clinicId,
      state,
      new Date(Date.parse(slotStart) - beforeMs),
      new Date(Date.parse(record.slot.interval.end) + afterMs),
      expires,
      record,
    ],
  );
  return record;
}
before(
  async () => {
    fixture = await testDatabase();
    await fixture.source.query(
      "INSERT INTO clinical.mathew_booking_directory(doctor_id,document,published) VALUES($1,$2,true)",
      [
        doctorId,
        {
          doctorId,
          revision: 1,
          departmentId: randomUUID(),
          clinicIds: [clinicId],
          displayName: "Synthetic physician",
          qualifications: ["Synthetic credential"],
          languages: ["en"],
          approvedPhotoObjectId: randomUUID(),
          publicationApprovalId: randomUUID(),
        },
      ],
    );
    await fixture.source.query(
      "INSERT INTO clinical.mathew_booking_configuration(availability_id,doctor_id,availability,policy,fees,enabled) VALUES($1,$2,$3,$4,$5,true)",
      [availabilityId, doctorId, availability, policy, JSON.stringify([fee])],
    );
  },
  { timeout: 30000 },
);
after(async () => {
  await fixture?.close();
});
test("missing named approved metadata is unavailable; controlled metadata yields exact grid, fee, stable IDs and DB clock", async () => {
  await assert.rejects(offers(), /UNAVAILABLE/);
  await configuredMetadata();
  const before = Date.now(),
    result = await offers(),
    after = Date.now();
  assert.equal(result.offers.length, 4);
  assert.equal(result.truncated, false);
  assert.ok(
    Date.parse(result.serverNow) >= before - 1000 && Date.parse(result.serverNow) <= after + 1000,
  );
  assert.deepEqual(
    result.offers.map((value) => value.slot.interval.start),
    [start, "2030-01-01T10:30:00.000Z", "2030-01-01T11:00:00.000Z", "2030-01-01T11:30:00.000Z"],
  );
  assert.equal(result.offers[0].fee.amountPaise, 50000);
  assert.equal(result.offers[0].slotId, (await offers()).offers[0].slotId);
  const named = await fixture.runtime("core", readBookingMetadata);
  assert.equal(named.clinics[0].displayName, "Synthetic approved clinic");
});
test("doctor-global private holds hide offers across clinics, include buffers and retain elapsed holds until explicit state change", async () => {
  const held = await occupy(start, {
    otherClinic: true,
    afterMs: 1,
    expires: "2026-01-01T00:00:00.000Z",
  });
  const result = await offers();
  assert.deepEqual(
    result.offers.map((value) => value.slot.interval.start),
    ["2030-01-01T11:00:00.000Z", "2030-01-01T11:30:00.000Z"],
  );
  await fixture.runtime("core", async (context) => {
    assert.equal(
      (await context.client.query("SELECT id,owner_id FROM clinical.mathew_booking_booking"))
        .rowCount,
      0,
    );
    await assert.rejects(
      context.client.query("SET ROLE k_booking_offer_reader"),
      /permission denied/,
    );
  });
  assert.equal(JSON.stringify(result).includes(held.ownerId), false);
  assert.equal(JSON.stringify(result).includes(held.id), false);
  await fixture.source.query("DELETE FROM clinical.mathew_booking_booking WHERE id=$1", [held.id]);
  await occupy(start, { state: "expired", expires: "2026-01-01T00:00:00.000Z" });
  assert.equal((await offers()).offers.length, 4);
});
test("exact buffered adjacency works, global leave removes intervals, stale availability revision is not offered", async () => {
  const held = await occupy(start);
  assert.equal((await offers()).offers[0].slot.interval.start, "2030-01-01T10:30:00.000Z");
  const leave = {
    id: randomUUID(),
    doctorId,
    revision: 1,
    interval: { start: "2030-01-01T10:30:00.000Z", end: "2030-01-01T11:00:00.000Z" },
  };
  await fixture.source.query(
    "INSERT INTO clinical.mathew_booking_leave(id,doctor_id,document) VALUES($1,$2,$3)",
    [leave.id, doctorId, leave],
  );
  assert.equal((await offers()).offers[0].slot.interval.start, "2030-01-01T11:00:00.000Z");
  const stale = await fixture.runtime("core", (context) =>
    context.client.query(
      "SELECT * FROM clinical.mathew_booking_available_offer_starts($1,2,'online',$2,$3,50)",
      [availabilityId, start, until],
    ),
  );
  assert.deepEqual(stale.rows[0].slot_starts, []);
  await fixture.source.query("DELETE FROM clinical.mathew_booking_leave WHERE id=$1", [leave.id]);
  await fixture.source.query("DELETE FROM clinical.mathew_booking_booking WHERE id=$1", [held.id]);
});
test("technical bounds are truthful and metadata withdrawal fails closed", async () => {
  const result = await fixture.runtime("core", (context) =>
    readBookingOffers(context, { ...query, limit: 1 }),
  );
  assert.equal(result.offers.length, 1);
  assert.equal(result.truncated, true);
  await fixture.source.query(
    "UPDATE clinical.mathew_booking_service_metadata SET published=false WHERE service_id=$1",
    [serviceId],
  );
  await assert.rejects(offers(), /UNAVAILABLE/);
  await fixture.source.query(
    "UPDATE clinical.mathew_booking_service_metadata SET published=true WHERE service_id=$1",
    [serviceId],
  );
  await fixture.source.query(
    "UPDATE clinical.mathew_booking_directory SET document=jsonb_set(document,'{clinicIds}',$2::jsonb) WHERE doctor_id=$1",
    [doctorId, JSON.stringify([randomUUID()])],
  );
  await assert.rejects(offers(), /UNAVAILABLE/);
  await fixture.source.query(
    "UPDATE clinical.mathew_booking_directory SET document=jsonb_set(document,'{clinicIds}',$2::jsonb) WHERE doctor_id=$1",
    [doctorId, JSON.stringify([clinicId])],
  );
});
test("real HTTP loopback E2E exposes approved metadata/offers/clock only, rejects invented query and a stale offer cannot win a hold", async () => {
  const app = createService("core-api", () => {}, {
    registerRoutes: (app) =>
      registerBookingOffersRoutes(app, {
        withContext: (callback) => fixture.runtime("core", callback),
      }),
  });
  const server = createServer(async (request, response) => {
    try {
      const result = await app.fetch(new Request(`http://127.0.0.1${request.url}`), {
        APP_ENV: "local",
      });
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch {
      response.writeHead(500);
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`${base}/v1/booking-offers?${new URLSearchParams(query)}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const offered = await response.json();
    assert.equal((await fetch(`${base}/v1/booking-metadata`)).status, 200);
    assert.equal(
      (
        await fetch(
          `${base}/v1/booking-offers?${new URLSearchParams({ ...query, serverNow: start })}`,
        )
      ).status,
      400,
    );
    const owner = {
      actorId: randomUUID(),
      sessionId: randomUUID(),
      organizationId: null,
      authenticatedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2031-01-01T00:00:00.000Z",
      mfa: null,
    };
    await fixture.source.query(
      "INSERT INTO clinical.mathew_booking_grant(id,actor_id,action,scope,valid_from,expires_at) VALUES($1,$2,'booking:create','self','2026-01-01','2031-01-01')",
      [randomUUID(), owner.actorId],
    );
    const selected = offered.offers[0].slot;
    const occupied = await occupy(selected.interval.start);
    await assert.rejects(
      fixture.runtime("core", (context) =>
        persistBookingHold(
          context,
          owner,
          {
            operationId: randomUUID(),
            bookingId: randomUUID(),
            request: {
              doctorId,
              clinicId,
              ownerId: owner.actorId,
              availabilityId,
              expectedAvailabilityRevision: selected.availabilityRevision,
              modality: "online",
              start: selected.interval.start,
            },
          },
          async () => ({ kind: "customer", customerId: owner.actorId }),
        ),
      ),
      /CONFLICT/,
    );
    assert.equal(
      (
        await (await fetch(`${base}/v1/booking-offers?${new URLSearchParams(query)}`)).json()
      ).offers.some((value) => value.slot.interval.start === selected.interval.start),
      false,
    );
    await fixture.source.query("DELETE FROM clinical.mathew_booking_booking WHERE id=$1", [
      occupied.id,
    ]);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
