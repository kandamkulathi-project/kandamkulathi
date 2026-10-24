import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CommercePrincipal } from "../../apps/core-api/src/commerce-authorization";
import { revalidateCommerceTransaction } from "../../apps/core-api/src/commerce-identity";
import { bookingRecordSchema } from "../../packages/contracts/src/booking";
import type { BookingAuthorityLoader } from "../../packages/database/src/booking";
import { type DatabaseContext, inTransaction } from "../../packages/database/src/client";
import { readCommerceCheckout } from "../../packages/database/src/commerce-checkout";
import { ids } from "../unit/identity-fixtures";

interface Fixture {
  source: { query: DatabaseContext["client"]["query"] };
  runtime<T>(role: "core", work: (context: DatabaseContext) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
let fixture: Fixture;
let principal: CommercePrincipal;
const clock = Date.now();
const instant = (offset: number) => new Date(clock + offset).toISOString();
const before = instant(-3600000),
  after = instant(3600000);
const loader: BookingAuthorityLoader = async (context, identity) => {
  expect(inTransaction(context.client)).toBe(true);
  expect(identity.actorId).toBe(ids.actor);
  return { kind: "customer", customerId: ids.actor };
};
async function orderIntent(state = "ready", owner = ids.actor as string) {
  const subjectId = randomUUID(),
    intentId = randomUUID(),
    operationId = randomUUID();
  const providerOrderId = `order_${intentId.replaceAll("-", "")}`;
  await fixture.source.query(
    `INSERT INTO core.commerce_orders(id,operation_id,actor_id,location_id,request_key,amount_paise,expires_at,source,hold_policy_reference) VALUES($1,$1,$2,$3,'synthetic',12345,$4,'native','synthetic-policy')`,
    [subjectId, owner, ids.clinic, after],
  );
  await fixture.source.query(
    "INSERT INTO core.commerce_order_addresses(order_id,address) VALUES($1,$2::jsonb)",
    [
      subjectId,
      JSON.stringify({
        recipientName: "Synthetic",
        line1: "1 Synthetic Street",
        city: "Test",
        region: "Test",
        postalCode: "680001",
        country: "IN",
        contactPhone: "+919876543210",
      }),
    ],
  );
  await fixture.source.query(
    `INSERT INTO core.commerce_payment_intents(id,operation_id,subject_kind,subject_id,owner_id,amount_paise,currency,account_id,state,provider_order_id,authority_revision) VALUES($1,$2,'order',$3,$4,12345,'INR','acc_synthetic',$5,$6,1)`,
    [intentId, operationId, subjectId, owner, state, state === "pending" ? null : providerOrderId],
  );
  return { intentId, subjectId, operationId, providerOrderId };
}
async function bookingIntent(
  options: { expired?: boolean; binding?: boolean; owner?: string } = {},
) {
  const subjectId = randomUUID(),
    intentId = randomUUID(),
    operationId = randomUUID();
  const providerOrderId = `order_${intentId.replaceAll("-", "")}`;
  const owner = options.owner ?? ids.actor;
  // Separate synthetic doctor avoids scheduling interactions; configuration is trusted fixture data only.
  const doctorId = randomUUID(),
    availabilityId = randomUUID();
  await fixture.source.query(
    "INSERT INTO clinical.mathew_booking_directory(doctor_id,document) VALUES($1,$2::jsonb)",
    [doctorId, JSON.stringify({ doctorId })],
  );
  await fixture.source.query(
    "INSERT INTO clinical.mathew_booking_configuration(availability_id,doctor_id,availability,policy,fees) VALUES($1,$2,$3::jsonb,'{}','[]')",
    [availabilityId, doctorId, JSON.stringify({ id: availabilityId, doctorId })],
  );
  const document = bookingRecordSchema.parse({
    id: subjectId,
    revision: 2,
    ownerId: owner,
    state: "held",
    provenance: { source: "online", customerId: owner },
    slot: {
      doctorId,
      clinicId: ids.clinic,
      clinicTimezone: "Asia/Kolkata",
      availabilityId,
      availabilityRevision: 1,
      interval: { start: instant(7200000), end: instant(9000000) },
      buffers: { beforeMs: 0, afterMs: 0 },
      modality: "online",
    },
    fee: {
      feeId: ids.other,
      revision: 1,
      doctorId,
      clinicId: ids.clinic,
      modality: "online",
      amountPaise: 12345,
      currency: "INR",
      approvedPolicyId: ids.assignment,
    },
    policyId: ids.assignment,
    policyRevision: 1,
    createdAt: before,
    holdExpiresAt: options.expired ? instant(-1000) : after,
    paymentOrderId: options.binding === false ? `unbound_${subjectId}` : providerOrderId,
    payments: [],
  });
  await fixture.source.query(
    `INSERT INTO clinical.mathew_booking_booking(id,operation_id,request,owner_id,doctor_id,clinic_id,revision,state,occupied,expires_at,document) VALUES($1,$2,'{}',$3,$4,$5,2,'held',tstzrange($6,$7,'[)'),$8,$9::jsonb)`,
    [
      subjectId,
      operationId,
      owner,
      doctorId,
      ids.clinic,
      document.slot.interval.start,
      document.slot.interval.end,
      document.holdExpiresAt,
      JSON.stringify(document),
    ],
  );
  await fixture.source.query(
    `INSERT INTO core.commerce_payment_intents(id,operation_id,subject_kind,subject_id,owner_id,amount_paise,currency,account_id,state,provider_order_id,authority_revision) VALUES($1,$2,'booking',$3,$4,12345,'INR','acc_synthetic','ready',$5,1)`,
    [intentId, operationId, subjectId, owner, providerOrderId],
  );
  return { intentId, subjectId, operationId, providerOrderId };
}
const read = (
  intentId: string,
  guard: (context: DatabaseContext) => Promise<void> = async () => {},
  bookingAuthorityLoader: BookingAuthorityLoader | undefined = loader,
) =>
  fixture.runtime("core", (context) =>
    readCommerceCheckout(context, intentId, {
      actorId: principal.actorId,
      identity: principal.identity,
      accountId: "acc_synthetic",
      keyId: "rzp_test_synthetic",
      bookingAuthorityLoader,
      async authorizeTransaction(active) {
        await guard(active);
        await revalidateCommerceTransaction(active, principal);
      },
    }),
  );

describe("checkout metadata — real PostgreSQL 17, non-owner identity/commerce/booking RLS", () => {
  beforeAll(async () => {
    const supportPath = "../platform/support.mjs";
    fixture = await (await import(supportPath)).testDatabase();
    for (const [table, file] of [
      ["core.identity_actors", "0002_mathew_identity.sql"],
      ["clinical.mathew_booking_booking", "0003_mathew_booking.sql"],
      ["core.commerce_skus", "0020_commerce_catalogue.sql"],
      ["core.commerce_payment_intents", "0021_commerce_payments.sql"],
      ["core.commerce_staff_grants", "0022_commerce_orders_access.sql"],
    ]) {
      if (
        !(await fixture.source.query("SELECT to_regclass($1) AS relation", [table])).rows[0]
          ?.relation
      )
        await fixture.source.query(
          await readFile(
            new URL(`../../packages/database/migrations/${file}`, import.meta.url),
            "utf8",
          ),
        );
    }
    await fixture.source.query(
      "INSERT INTO core.identity_actors(id,provider_user_id,status) VALUES($1,'synthetic_customer','active')",
      [ids.actor],
    );
    await fixture.source.query(
      "INSERT INTO core.identity_policy(privacy_version,consultation_version,marketing_version,approval_reference) VALUES('synthetic-v1','synthetic-v1','synthetic-v1','synthetic-approved')",
    );
    await fixture.source.query(
      `INSERT INTO core.identity_sessions(id,actor_id,provider_user_id,provider_session_id,authenticated_at,expires_at) VALUES($1,$2,'synthetic_customer','synthetic_session',$3,$4)`,
      [ids.session, ids.actor, before, after],
    );
    await fixture.source.query(
      "INSERT INTO core.identity_memberships(id,actor_id,record) VALUES($1,$2,$3::jsonb)",
      [
        ids.membership,
        ids.actor,
        JSON.stringify({
          id: ids.membership,
          workspace: "customer",
          organizationId: null,
          clinicId: null,
          actions: ["workspace:enter"],
          validFrom: before,
          expiresAt: after,
          revokedAt: null,
        }),
      ],
    );
    await fixture.source.query(
      "INSERT INTO core.identity_consents(id,actor_id,record) VALUES($1,$2,$3::jsonb)",
      [
        ids.other,
        ids.actor,
        JSON.stringify({
          id: ids.other,
          purpose: "privacy",
          actorId: ids.actor,
          recordedByActorId: ids.actor,
          version: "synthetic-v1",
          decision: "granted",
          decidedAt: before,
          expiresAt: null,
          revokedAt: null,
        }),
      ],
    );
    await fixture.source.query(
      "INSERT INTO core.commerce_locations(id,name) VALUES($1,'synthetic')",
      [ids.clinic],
    );
    await fixture.source.query(
      `INSERT INTO clinical.mathew_booking_grant(id,actor_id,action,scope,valid_from,expires_at) VALUES($1,$2,'booking:create','self',$3,$4)`,
      [ids.assignment, ids.actor, before, after],
    );
    principal = {
      allowed: true,
      actorId: ids.actor,
      sessionId: ids.session,
      clinicId: null,
      action: null,
      identity: {
        actorId: ids.actor,
        sessionId: ids.session,
        organizationId: null,
        authenticatedAt: before,
        expiresAt: after,
        mfa: null,
      },
    };
  }, 60000);
  afterAll(async () => {
    await fixture?.close();
  });
  it("current reserved order returns canonical DTO repeatedly without financial writes or provider fetch", async () => {
    const f = await orderIntent();
    const network = vi.spyOn(globalThis, "fetch");
    try {
      const result = await read(f.intentId);
      expect(result).toEqual({
        keyId: "rzp_test_synthetic",
        providerOrderId: f.providerOrderId,
        intentId: f.intentId,
        operationId: f.operationId,
        subject: { kind: "order", id: f.subjectId },
        amountPaise: 12345,
        currency: "INR",
      });
      expect(await read(f.intentId)).toEqual(result);
      expect(network).not.toHaveBeenCalled();
      expect(
        (
          await fixture.source.query(
            "SELECT state FROM core.commerce_payment_intents WHERE id=$1",
            [f.intentId],
          )
        ).rows[0]?.state,
      ).toBe("ready");
      expect(
        (
          await fixture.source.query("SELECT status FROM core.commerce_orders WHERE id=$1", [
            f.subjectId,
          ])
        ).rows[0]?.status,
      ).toBe("reserved");
      expect(
        (await fixture.source.query("SELECT count(*)::int AS n FROM core.commerce_payment_ledger"))
          .rows[0]?.n,
      ).toBe(0);
    } finally {
      network.mockRestore();
    }
  });
  it.each(["pending", "creating", "unknown", "captured", "failed"])(
    "denies non-READY %s, including persisted null pending binding",
    async (state) => {
      const f = await orderIntent(state);
      await expect(read(f.intentId)).rejects.toMatchObject({ code: "conflict" });
    },
  );
  it("real persisted READY/null binding is forbidden by the database, not fabricated by fixtures", async () => {
    const f = await orderIntent();
    await expect(
      fixture.source.query(
        "UPDATE core.commerce_payment_intents SET provider_order_id=NULL WHERE id=$1",
        [f.intentId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it.each(["expired", "amount", "address"])("rejects current order %s", async (change) => {
    const f = await orderIntent();
    if (change === "expired")
      await fixture.source.query(
        "UPDATE core.commerce_orders SET created_at=clock_timestamp()-interval '1 hour',expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
        [f.subjectId],
      );
    if (change === "amount")
      await fixture.source.query("UPDATE core.commerce_orders SET amount_paise=12346 WHERE id=$1", [
        f.subjectId,
      ]);
    if (change === "address")
      await fixture.source.query("DELETE FROM core.commerce_order_addresses WHERE order_id=$1", [
        f.subjectId,
      ]);
    await expect(read(f.intentId)).rejects.toMatchObject({ code: "conflict" });
  });
  it("cross-owner intent is invisible under actual RLS", async () => {
    const f = await orderIntent("ready", ids.patientActor);
    await expect(read(f.intentId)).rejects.toMatchObject({ code: "denied" });
  });
  it("owner-visible intent cannot grant access to a foreign authoritative subject", async () => {
    const f = await orderIntent("ready", ids.patientActor);
    await fixture.source.query("UPDATE core.commerce_payment_intents SET owner_id=$1 WHERE id=$2", [
      ids.actor,
      f.intentId,
    ]);
    await expect(read(f.intentId)).rejects.toMatchObject({ code: "denied" });
  });
  it("current session revocation after request authorization denies", async () => {
    const f = await orderIntent();
    await fixture.source.query(
      "UPDATE core.identity_sessions SET revoked_at=clock_timestamp() WHERE id=$1",
      [ids.session],
    );
    try {
      await expect(read(f.intentId)).rejects.toMatchObject({ denial: { status: 401 } });
    } finally {
      await fixture.source.query("UPDATE core.identity_sessions SET revoked_at=NULL WHERE id=$1", [
        ids.session,
      ]);
    }
  });
  it("request guard is already transactional and its failure denies before identity/financial effects", async () => {
    const f = await orderIntent();
    await expect(
      read(f.intentId, async (active) => {
        expect(inTransaction(active.client)).toBe(true);
        throw new Error("synthetic cookie revoked");
      }),
    ).rejects.toThrow("synthetic cookie revoked");
  });
  it("revoked privacy consent denies under current identity locks", async () => {
    const f = await orderIntent();
    await fixture.source.query(
      "UPDATE core.identity_consents SET record=jsonb_set(record,'{revokedAt}',to_jsonb($1::text)) WHERE id=$2",
      [instant(-1000), ids.other],
    );
    try {
      await expect(read(f.intentId)).rejects.toMatchObject({ denial: { status: 403 } });
    } finally {
      await fixture.source.query(
        "UPDATE core.identity_consents SET record=jsonb_set(record,'{revokedAt}','null'::jsonb) WHERE id=$1",
        [ids.other],
      );
    }
  });
  it("bound held booking accepts persisted pre-bind intent revision 1/current immutable booking revision 2", async () => {
    const f = await bookingIntent();
    expect(await read(f.intentId)).toMatchObject({
      subject: { kind: "booking", id: f.subjectId },
      providerOrderId: f.providerOrderId,
    });
  });
  it.each([{ expired: true }, { binding: false }])(
    "denies stale/unbound booking %j",
    async (options) => {
      const f = await bookingIntent(options);
      await expect(read(f.intentId)).rejects.toMatchObject({ code: "conflict" });
    },
  );
  it("canonical held booking fee must match the persisted intent amount", async () => {
    const f = await bookingIntent();
    await fixture.source.query(
      "UPDATE core.commerce_payment_intents SET amount_paise=12346 WHERE id=$1",
      [f.intentId],
    );
    await expect(read(f.intentId)).rejects.toMatchObject({ code: "conflict" });
  });
  it("owner-visible intent cannot grant a foreign booking", async () => {
    const f = await bookingIntent({ owner: ids.patientActor });
    await fixture.source.query("UPDATE core.commerce_payment_intents SET owner_id=$1 WHERE id=$2", [
      ids.actor,
      f.intentId,
    ]);
    await expect(read(f.intentId)).rejects.toMatchObject({ code: "denied" });
  });
  it("missing canonical booking authority loader denies", async () => {
    const f = await bookingIntent();
    await expect(
      fixture.runtime("core", (context) =>
        readCommerceCheckout(context, f.intentId, {
          actorId: principal.actorId,
          identity: principal.identity,
          keyId: "rzp_test_synthetic",
          accountId: "acc_synthetic",
          authorizeTransaction: (active) => revalidateCommerceTransaction(active, principal),
        }),
      ),
    ).rejects.toMatchObject({ code: "unconfigured" });
  });
  it("revoked canonical booking grant denies even when commerce customer membership remains valid", async () => {
    const f = await bookingIntent();
    await fixture.source.query(
      "UPDATE clinical.mathew_booking_grant SET revoked_at=clock_timestamp() WHERE id=$1",
      [ids.assignment],
    );
    try {
      await expect(read(f.intentId)).rejects.toMatchObject({ code: "denied" });
    } finally {
      await fixture.source.query(
        "UPDATE clinical.mathew_booking_grant SET revoked_at=NULL WHERE id=$1",
        [ids.assignment],
      );
    }
  });
});
