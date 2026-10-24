import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createCommerceCancellationDependencies,
  registerCommerceCancellationRoutes,
} from "../../apps/core-api/src/commerce-cancellation";
import { revalidateCommerceTransaction } from "../../apps/core-api/src/commerce-identity";
import type { DatabaseContext } from "../../packages/database/src/client";
import { transaction } from "../../packages/database/src/client";
import { createCommerceFinancialHandlers } from "../../packages/database/src/commerce-payment-orders";
import { CommercePaymentRepository } from "../../packages/database/src/commerce-payments";
import { loadCurrentAuthorityInTransaction } from "../../packages/database/src/identity";
import { enqueue } from "../../packages/database/src/outbox";
import { createService } from "../../packages/server/src/index";
import { customerFixture, ids } from "../unit/identity-fixtures";

interface Fixture {
  source: { query: DatabaseContext["client"]["query"] };
  urls: { core: string };
  localProxy: string;
  runtime<T>(role: "core", work: (context: DatabaseContext) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
let fixture: Fixture;
const functionOwner = `k_cancel_owner_${randomUUID().replaceAll("-", "")}`;
let originalOwner: string | undefined;
let functionOwnerCreated = false;
const location = ids.clinic;
const sku = ids.patient;
const batch = ids.consultation;
const tax = ids.assignment;
const base = customerFixture();
const from = new Date(Date.now() - 3600000).toISOString();
const until = new Date(Date.now() + 3600000).toISOString();
const identity = { ...base.identity, authenticatedAt: from, expiresAt: until };
const request = { operationId: ids.other, expectedVersion: 1, confirmed: true };
const orderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001";
let sequence = 1;
const nextId = () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++sequence).padStart(12, "0")}`;

async function seedOrder(id = nextId()) {
  await fixture.source.query(
    `INSERT INTO core.commerce_orders(id,operation_id,actor_id,location_id,request_key,amount_paise,expires_at,hold_policy_reference)
    VALUES($1,$1,$2,$3,'synthetic',100,clock_timestamp()+interval '1 hour','synthetic-hold')`,
    [id, ids.actor, location],
  );
  await fixture.source.query(
    `INSERT INTO core.commerce_order_lines(order_id,sku_id,quantity,sku_version,unit_paise,tax_paise,amount_paise,tax_policy_id,tax_rate_bps)
    VALUES($1,$2,2,1,50,0,100,$3,0)`,
    [id, sku, tax],
  );
  await fixture.source.query("UPDATE core.commerce_batches SET reserved=reserved+2 WHERE id=$1", [
    batch,
  ]);
  await fixture.source.query(
    "INSERT INTO core.commerce_reservations(order_id,sku_id,batch_id,quantity) VALUES($1,$2,$3,2)",
    [id, sku, batch],
  );
  return id;
}

/** Synthetic same-transaction proof fixture for direct SQL boundary tests. */
async function prepareProof(context: DatabaseContext, id: string, operation: string) {
  const { client } = context;
  await loadCurrentAuthorityInTransaction(client, identity);
  await client.query(
    "SELECT set_config('app.actor_id',$1,true),set_config('app.commerce_mode','cancellation',true)",
    [ids.actor],
  );
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    `payment:order:${id}`,
  ]);
  await client.query("SELECT id FROM core.commerce_orders WHERE id=$1 FOR UPDATE", [id]);
  await client.query(
    "INSERT INTO core.commerce_order_cancellations(operation_id,order_id,actor_id,expected_version,resulting_version,policy_reference) VALUES($1,$2,$3,1,2,'synthetic-approved-unpaid-only')",
    [operation, id, ids.actor],
  );
  const now = new Date();
  await enqueue(context, {
    id: nextId(),
    operationId: operation,
    subjectId: id,
    channel: "financial",
    kind: "commerce.reconcile",
    revision: 1,
    dueAt: now,
    deadlineAt: new Date(now.getTime() + 86400000),
  });
}

function app(
  options: {
    mutation?: "allowed" | "denied";
    unauthenticated?: boolean;
    beforeFence?: () => Promise<void>;
  } = {},
) {
  const dependencies = createCommerceCancellationDependencies({
    environment: "local",
    coreDatabaseUrl: fixture.urls.core,
    localProxy: fixture.localProxy,
    identity: {
      async verifySession() {
        return options.unauthenticated
          ? { status: "unauthenticated" }
          : { status: "verified", identity };
      },
      loadCurrentAuthority: () =>
        fixture.runtime("core", (context) =>
          transaction(context.client, () =>
            loadCurrentAuthorityInTransaction(context.client, identity),
          ),
        ),
      async loadCommerceGrants() {
        return [];
      },
      async verifyMutationRequest() {
        return options.mutation ?? "allowed";
      },
    },
    // Synthetic transport seam only; real identity/session/consent is fenced by factory in this same transaction.
    async guardInTransaction() {
      await options.beforeFence?.();
    },
  });
  return createService("core-api", () => {}, {
    registerRoutes(service) {
      registerCommerceCancellationRoutes(service, dependencies);
    },
  });
}
function cancel(id: string, input: unknown = request, options: Parameters<typeof app>[0] = {}) {
  return app(options).fetch(
    new Request(`http://localhost/v1/orders/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
    { APP_ENV: "local" },
  );
}

describe("unpaid cancellation — HTTP and real PostgreSQL Core-role transaction", () => {
  beforeAll(async () => {
    const supportPath = "../platform/support.mjs";
    fixture = await (await import(supportPath)).testDatabase();
    expect(
      (
        await fixture.source.query(
          "SELECT id FROM public.k_platform_migrations WHERE id='0028_order_cancellation'",
        )
      ).rows,
    ).toEqual([{ id: "0028_order_cancellation" }]);
    originalOwner = (await fixture.source.query<{ owner: string }>("SELECT current_user AS owner"))
      .rows[0]?.owner;
    // Test the existing controlled-owner policies without superuser/BYPASSRLS execution.
    // This NOLOGIN test owner inherits the migration-owner's object rights/policy role,
    // not its special superuser attribute. No runtime role receives this membership.
    await fixture.source.query(
      `CREATE ROLE ${functionOwner} NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE INHERIT`,
    );
    functionOwnerCreated = true;
    const grant = (
      await fixture.source.query<{ sql: string }>(
        "SELECT format('GRANT %I TO %I',current_user,$1::text) AS sql",
        [functionOwner],
      )
    ).rows[0]?.sql;
    if (!grant) throw new Error("Synthetic function owner provisioning failed");
    await fixture.source.query(grant);
    await fixture.source.query(
      `ALTER FUNCTION core.commerce_cancel_prepared_order(uuid,uuid,integer) OWNER TO ${functionOwner}`,
    );
    await fixture.source.query(
      "INSERT INTO core.identity_actors(id,provider_user_id,status) VALUES($1,'synthetic_cancel_actor','active')",
      [ids.actor],
    );
    await fixture.source.query(
      "INSERT INTO core.identity_policy(privacy_version,consultation_version,marketing_version,approval_reference) VALUES('privacy-v1','consultation-v1','marketing-v1','synthetic')",
    );
    await fixture.source.query(
      `INSERT INTO core.identity_sessions(id,actor_id,provider_user_id,provider_session_id,authenticated_at,expires_at)
      VALUES($1,$2,'synthetic_cancel_actor','synthetic_cancel_session',$3,$4)`,
      [ids.session, ids.actor, from, until],
    );
    await fixture.source.query(
      "INSERT INTO core.identity_memberships(id,actor_id,record) VALUES($1,$2,$3::jsonb)",
      [
        ids.membership,
        ids.actor,
        JSON.stringify({ ...base.authority.memberships[0], validFrom: from, expiresAt: until }),
      ],
    );
    await fixture.source.query(
      "INSERT INTO core.identity_consents(id,actor_id,record) VALUES($1,$2,$3::jsonb)",
      [ids.other, ids.actor, JSON.stringify({ ...base.authority.consents[0], decidedAt: from })],
    );
    await fixture.source.query(
      "INSERT INTO core.commerce_locations(id,name) VALUES($1,'synthetic')",
      [location],
    );
    await fixture.source.query(
      "INSERT INTO core.commerce_tax_policies(id,rate_bps,basis,rounding,approved_by,active) VALUES($1,0,'exclusive','half_up_line',$2,true)",
      [tax, ids.actor],
    );
    await fixture.source.query(
      `INSERT INTO core.commerce_skus(id,sku,name,variant,description,image_url,concerns,approved_by,consult_only,unit_paise,tax_policy_id,minimum_shelf_life_days)
      VALUES($1,'synthetic-cancel','Synthetic','one','synthetic','https://example.invalid/product.png','{}',$2,false,50,$3,0)`,
      [sku, ids.actor, tax],
    );
    await fixture.source.query(
      "INSERT INTO core.commerce_batches(id,sku_id,location_id,batch_code,expires_on,on_hand) VALUES($1,$2,$3,'synthetic',CURRENT_DATE+365,100)",
      [batch, sku, location],
    );
    await seedOrder(orderId);
    const authority = await fixture.runtime("core", (context) =>
      transaction(context.client, () =>
        loadCurrentAuthorityInTransaction(context.client, identity),
      ),
    );
    expect(authority.actorId).toBe(ids.actor);
  }, 60000);
  afterAll(async () => {
    try {
      if (functionOwnerCreated && originalOwner) {
        const restore = (
          await fixture.source.query<{ sql: string }>(
            "SELECT format('ALTER FUNCTION core.commerce_cancel_prepared_order(uuid,uuid,integer) OWNER TO %I',$1::text) AS sql",
            [originalOwner],
          )
        ).rows[0]?.sql;
        if (!restore) throw new Error("Synthetic function owner cleanup failed");
        await fixture.source.query(restore);
        await fixture.source.query(`DROP ROLE ${functionOwner}`);
      }
    } finally {
      await fixture?.close();
    }
  });

  it("denies an unconfigured policy without releasing stock", async () => {
    expect((await cancel(orderId)).status).toBe(503);
    expect(
      (
        await fixture.source.query("SELECT reserved FROM core.commerce_batches WHERE id=$1", [
          batch,
        ])
      ).rows[0],
    ).toEqual({ reserved: 2 });
    await fixture.source.query(
      "INSERT INTO core.commerce_cancellation_policy(approved_by,approval_reference,active) VALUES($1,'synthetic-approved-unpaid-only',true)",
      [ids.actor],
    );
  });
  it("atomically cancels and releases once across concurrent identical confirmations", async () => {
    const responses = await Promise.all([cancel(orderId), cancel(orderId)]);
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        orderId,
        operationId: request.operationId,
        status: "cancelled",
        version: 2,
        refund: "not_applicable",
      });
    }
    expect(
      (
        await fixture.source.query(
          "SELECT reserved,on_hand FROM core.commerce_batches WHERE id=$1",
          [batch],
        )
      ).rows[0],
    ).toEqual({ reserved: 0, on_hand: 100 });
    expect(
      (
        await fixture.source.query(
          "SELECT state,released_at IS NOT NULL AS released FROM core.commerce_reservations WHERE order_id=$1",
          [orderId],
        )
      ).rows,
    ).toEqual([{ state: "released", released: true }]);
    expect(
      (
        await fixture.source.query(
          "SELECT count(*)::int AS count FROM core.commerce_order_cancellations",
        )
      ).rows[0],
    ).toEqual({ count: 1 });
    expect(
      (
        await fixture.source.query(
          "SELECT operation_id,subject_id,kind FROM platform.outbox WHERE operation_id=$1",
          [request.operationId],
        )
      ).rows,
    ).toEqual([
      { operation_id: request.operationId, subject_id: orderId, kind: "commerce.reconcile" },
    ]);
    expect(
      (
        await fixture.source.query(
          "SELECT count(*)::int AS count FROM core.commerce_payment_ledger",
        )
      ).rows[0],
    ).toEqual({ count: 0 });
    expect((await cancel(orderId, { ...request, expectedVersion: 2 })).status).toBe(409);
    expect((await cancel(orderId, { ...request, operationId: nextId() })).status).toBe(409);
    const second = await seedOrder();
    expect((await cancel(second)).status).toBe(409);
  });
  it("allows exactly the prepared unpaid transition through the non-superuser SQL function", async () => {
    const id = await seedOrder();
    const operation = nextId();
    const before = (
      await fixture.source.query<{ reserved: number; on_hand: number }>(
        "SELECT reserved,on_hand FROM core.commerce_batches WHERE id=$1",
        [batch],
      )
    ).rows[0];
    if (!before) throw new Error("Synthetic batch is missing");
    const changed = await fixture.runtime("core", (context) =>
      transaction(context.client, async () => {
        await prepareProof(context, id, operation);
        return context.client.query(
          "SELECT core.commerce_cancel_prepared_order($1,$2,1) AS version",
          [id, operation],
        );
      }),
    );
    expect(changed.rows).toEqual([{ version: 2 }]);
    expect(
      (
        await fixture.source.query(
          "SELECT reserved,on_hand FROM core.commerce_batches WHERE id=$1",
          [batch],
        )
      ).rows,
    ).toEqual([{ reserved: before.reserved - 2, on_hand: before.on_hand }]);
    expect(
      (
        await fixture.source.query(
          "SELECT state,released_at IS NOT NULL AS released FROM core.commerce_reservations WHERE order_id=$1",
          [id],
        )
      ).rows,
    ).toEqual([{ state: "released", released: true }]);
  });
  it.each(["pending", "creating", "ready", "unknown", "captured", "failed"])(
    "never cancels an order with a %s payment intent",
    async (state) => {
      const id = await seedOrder();
      await fixture.source.query(
        `INSERT INTO core.commerce_payment_intents(id,operation_id,subject_kind,subject_id,owner_id,amount_paise,currency,account_id,state,provider_order_id)
      VALUES($1,$1,'order',$2,$3,100,'INR','acc_synthetic',$4,$5)`,
        [
          nextId(),
          id,
          ids.actor,
          state,
          ["ready", "captured", "failed"].includes(state) ? `order_${sequence}` : null,
        ],
      );
      expect((await cancel(id, { ...request, operationId: nextId() })).status).toBe(409);
      expect(
        (await fixture.source.query("SELECT status FROM core.commerce_orders WHERE id=$1", [id]))
          .rows[0],
      ).toEqual({ status: "reserved" });
    },
  );
  it("rejects stale, foreign-owner, invalid, unauthenticated and CSRF-denied confirmations", async () => {
    const id = await seedOrder();
    expect(
      (await cancel(id, { ...request, operationId: nextId(), expectedVersion: 2 })).status,
    ).toBe(409);
    expect((await cancel(id, { ...request, confirmed: false })).status).toBe(400);
    expect((await cancel(id, { ...request, refundPaise: 100 })).status).toBe(400);
    expect((await cancel(id, request, { unauthenticated: true })).status).toBe(401);
    expect((await cancel(id, request, { mutation: "denied" })).status).toBe(403);
    await fixture.source.query("UPDATE core.commerce_orders SET actor_id=$2 WHERE id=$1", [
      id,
      ids.patientActor,
    ]);
    expect((await cancel(id, { ...request, operationId: nextId() })).status).toBe(403);
  });
  it("rechecks revoked identity even for an idempotent successful operation", async () => {
    await fixture.source.query(
      "UPDATE core.identity_sessions SET revoked_at=clock_timestamp() WHERE id=$1",
      [ids.session],
    );
    expect((await cancel(orderId)).status).toBe(401);
    await fixture.source.query("UPDATE core.identity_sessions SET revoked_at=NULL WHERE id=$1", [
      ids.session,
    ]);
    const response = await cancel(orderId, request, {
      beforeFence: async () => {
        await fixture.source.query(
          "UPDATE core.identity_sessions SET revoked_at=clock_timestamp() WHERE id=$1",
          [ids.session],
        );
      },
    });
    expect(response.status).toBe(401);
    await fixture.source.query("UPDATE core.identity_sessions SET revoked_at=NULL WHERE id=$1", [
      ids.session,
    ]);
  });
  it("rolls back batch, reservation, audit and order if durable enqueue fails", async () => {
    const id = await seedOrder();
    const op = nextId();
    await fixture.source.query(
      `INSERT INTO platform.outbox(id,operation_id,subject_id,channel,kind,revision,due_at,deadline_at,next_attempt_at)
      VALUES($1,$1,$2,'financial','commerce.reconcile',1,clock_timestamp(),clock_timestamp()+interval '1 hour',clock_timestamp())`,
      [op, ids.other],
    );
    const before = (
      await fixture.source.query("SELECT reserved FROM core.commerce_batches WHERE id=$1", [batch])
    ).rows;
    expect((await cancel(id, { ...request, operationId: op })).status).toBe(503);
    expect(
      (
        await fixture.source.query("SELECT reserved FROM core.commerce_batches WHERE id=$1", [
          batch,
        ])
      ).rows,
    ).toEqual(before);
    expect(
      (
        await fixture.source.query("SELECT status,version FROM core.commerce_orders WHERE id=$1", [
          id,
        ])
      ).rows,
    ).toEqual([{ status: "reserved", version: 1 }]);
    expect(
      (
        await fixture.source.query(
          "SELECT state FROM core.commerce_reservations WHERE order_id=$1",
          [id],
        )
      ).rows,
    ).toEqual([{ state: "held" }]);
    expect(
      (
        await fixture.source.query(
          "SELECT operation_id FROM core.commerce_order_cancellations WHERE order_id=$1",
          [id],
        )
      ).rows,
    ).toEqual([]);
  });
  it("serializes cancellation with canonical payment creation without partial stock release", async () => {
    const id = await seedOrder();
    await fixture.source.query(
      "INSERT INTO core.commerce_order_addresses(order_id,address) VALUES($1,$2::jsonb)",
      [
        id,
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
    const cancelOp = nextId();
    const paymentOp = nextId();
    const principal = {
      allowed: true as const,
      actorId: ids.actor,
      sessionId: ids.session,
      clinicId: null,
      action: null,
      identity,
    };
    const [cancellation, payment] = await Promise.all([
      cancel(id, { ...request, operationId: cancelOp }),
      fixture
        .runtime("core", (context) =>
          new CommercePaymentRepository(
            context,
            createCommerceFinancialHandlers().authority,
            undefined,
            undefined,
            (active) => revalidateCommerceTransaction(active, principal),
          ).open(
            ids.actor,
            { operationId: paymentOp, subject: { kind: "order", id }, method: "razorpay" },
            "acc_synthetic",
          ),
        )
        .then(
          () => "opened",
          () => "denied",
        ),
    ]);
    const status = (
      await fixture.source.query<{ status: string }>(
        "SELECT status FROM core.commerce_orders WHERE id=$1",
        [id],
      )
    ).rows[0]?.status;
    const intents = (
      await fixture.source.query(
        "SELECT id FROM core.commerce_payment_intents WHERE subject_id=$1",
        [id],
      )
    ).rows;
    const reservations = (
      await fixture.source.query("SELECT state FROM core.commerce_reservations WHERE order_id=$1", [
        id,
      ])
    ).rows;
    if (status === "cancelled") {
      expect(cancellation.status).toBe(200);
      expect(payment).toBe("denied");
      expect(intents).toHaveLength(0);
      expect(reservations).toEqual([{ state: "released" }]);
    } else {
      expect(status).toBe("reserved");
      expect(cancellation.status).toBe(409);
      expect(payment).toBe("opened");
      expect(intents).toHaveLength(1);
      expect(reservations).toEqual([{ state: "held" }]);
    }
  });
  it("preserves Core SQL permission denial and executes only the controlled non-superuser function", async () => {
    const id = await seedOrder();
    await expect(
      fixture.runtime("core", (context) =>
        transaction(context.client, async () => {
          await context.client.query("SELECT set_config('app.actor_id',$1,true)", [ids.actor]);
          await context.client.query(
            "UPDATE core.commerce_orders SET status='paid',version=version+1 WHERE id=$1",
            [id],
          );
        }),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      fixture.runtime("core", (context) =>
        context.client.query("UPDATE core.commerce_cancellation_policy SET active=false"),
      ),
    ).rejects.toThrow(/permission denied/);
    expect(
      (
        await fixture.source.query(`SELECT r.rolsuper,r.rolbypassrls,p.prosecdef,p.proconfig,
      c.relforcerowsecurity,pg_has_role(p.proowner,c.relowner,'member') AS owner_policy_member
      FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
      CROSS JOIN pg_class c WHERE p.oid='core.commerce_cancel_prepared_order(uuid,uuid,integer)'::regprocedure
      AND c.oid='core.commerce_orders'::regclass`)
      ).rows[0],
    ).toMatchObject({
      rolsuper: false,
      rolbypassrls: false,
      prosecdef: true,
      relforcerowsecurity: true,
      owner_policy_member: true,
    });
    const config = (
      await fixture.source.query<{ proconfig: string[] }>(
        "SELECT proconfig FROM pg_proc WHERE oid='core.commerce_cancel_prepared_order(uuid,uuid,integer)'::regprocedure",
      )
    ).rows[0]?.proconfig;
    expect(config?.map((value) => value.replaceAll(" ", ""))).toContain(
      "search_path=pg_catalog,core,platform",
    );
    expect(
      (
        await fixture.runtime("core", (context) =>
          context.client.query(
            "SELECT has_column_privilege(current_user,'core.commerce_orders','status','UPDATE') AS status,has_column_privilege(current_user,'core.commerce_orders','version','UPDATE') AS version,has_column_privilege(current_user,'core.commerce_reservations','state','UPDATE') AS release",
          ),
        )
      ).rows,
    ).toEqual([{ status: false, version: false, release: false }]);
    expect(
      (
        await fixture.source.query("SELECT status,version FROM core.commerce_orders WHERE id=$1", [
          id,
        ])
      ).rows,
    ).toEqual([{ status: "reserved", version: 1 }]);
  });
  it.each(["wrong_actor", "wrong_mode", "existing_intent", "stale_version", "missing_session"])(
    "direct prepared transition refuses %s and rolls back its proof",
    async (reason) => {
      const id = await seedOrder();
      const operation = nextId();
      await expect(
        fixture.runtime("core", (context) =>
          transaction(context.client, async () => {
            await prepareProof(context, id, operation);
            if (reason === "wrong_actor")
              await context.client.query(
                "SELECT set_config('app.actor_id',$1,true),set_config('identity.actor_id',$1,true)",
                [ids.patientActor],
              );
            if (reason === "wrong_mode")
              await context.client.query("SELECT set_config('app.commerce_mode','checkout',true)");
            if (reason === "missing_session")
              await context.client.query("SELECT set_config('identity.internal_session','',true)");
            if (reason === "existing_intent")
              await context.client.query(
                "INSERT INTO core.commerce_payment_intents(id,operation_id,subject_kind,subject_id,owner_id,amount_paise,currency,account_id) VALUES($1,$1,'order',$2,$3,100,'INR','acc_synthetic')",
                [nextId(), id, ids.actor],
              );
            await context.client.query("SELECT core.commerce_cancel_prepared_order($1,$2,$3)", [
              id,
              operation,
              reason === "stale_version" ? 2 : 1,
            ]);
          }),
        ),
      ).rejects.toMatchObject({ code: "42501" });
      expect(
        (
          await fixture.source.query(
            "SELECT status,version FROM core.commerce_orders WHERE id=$1",
            [id],
          )
        ).rows,
      ).toEqual([{ status: "reserved", version: 1 }]);
      expect(
        (
          await fixture.source.query(
            "SELECT state FROM core.commerce_reservations WHERE order_id=$1",
            [id],
          )
        ).rows,
      ).toEqual([{ state: "held" }]);
      expect(
        (
          await fixture.source.query(
            "SELECT operation_id FROM core.commerce_order_cancellations WHERE order_id=$1",
            [id],
          )
        ).rows,
      ).toEqual([]);
      expect(
        (
          await fixture.source.query("SELECT id FROM platform.outbox WHERE operation_id=$1", [
            operation,
          ])
        ).rows,
      ).toEqual([]);
    },
  );
  it("refuses proof from an earlier transaction even with matching actor, policy, version and operation", async () => {
    const id = await seedOrder();
    const operation = nextId();
    await fixture.runtime("core", (context) =>
      transaction(context.client, () => prepareProof(context, id, operation)),
    );
    await expect(
      fixture.runtime("core", (context) =>
        transaction(context.client, async () => {
          await loadCurrentAuthorityInTransaction(context.client, identity);
          await context.client.query(
            "SELECT set_config('app.actor_id',$1,true),set_config('app.commerce_mode','cancellation',true)",
            [ids.actor],
          );
          await context.client.query("SELECT core.commerce_cancel_prepared_order($1,$2,1)", [
            id,
            operation,
          ]);
        }),
      ),
    ).rejects.toMatchObject({ code: "42501" });
    expect(
      (await fixture.source.query("SELECT status FROM core.commerce_orders WHERE id=$1", [id]))
        .rows,
    ).toEqual([{ status: "reserved" }]);
  });
  it.each([
    { label: "no-op", decrement: 0, savepoint: false },
    { label: "insufficient", decrement: 1, savepoint: false },
    { label: "excessive", decrement: 3, savepoint: false },
    { label: "savepoint no-op", decrement: 0, savepoint: true },
  ])(
    "rejects $label caller stock pre-mutation and rolls back exact before-counts",
    async ({ decrement, savepoint }) => {
      const id = await seedOrder();
      const operation = nextId();
      const before = (
        await fixture.source.query<{ reserved: number; on_hand: number }>(
          "SELECT reserved,on_hand FROM core.commerce_batches WHERE id=$1",
          [batch],
        )
      ).rows[0];
      if (!before) throw new Error("Synthetic batch is missing");
      expect(before.reserved).toBeGreaterThanOrEqual(4);
      await expect(
        fixture.runtime("core", (context) =>
          transaction(context.client, async () => {
            await prepareProof(context, id, operation);
            // Exercise the pre-existing checkout stock capability, not a new cancellation grant.
            await context.client.query("SELECT set_config('app.commerce_mode','checkout',true)");
            if (savepoint) await context.client.query("SAVEPOINT synthetic_stock_write");
            const changed = await context.client.query(
              "UPDATE core.commerce_batches SET reserved=reserved-$2 WHERE id=$1 RETURNING reserved",
              [batch, decrement],
            );
            expect(changed.rows).toEqual([{ reserved: before.reserved - decrement }]);
            if (savepoint) await context.client.query("RELEASE SAVEPOINT synthetic_stock_write");
            await context.client.query(
              "SELECT set_config('app.commerce_mode','cancellation',true)",
            );
            await context.client.query("SELECT core.commerce_cancel_prepared_order($1,$2,1)", [
              id,
              operation,
            ]);
          }),
        ),
      ).rejects.toMatchObject({ code: "42501" });
      expect(
        (
          await fixture.source.query(
            "SELECT reserved,on_hand FROM core.commerce_batches WHERE id=$1",
            [batch],
          )
        ).rows,
      ).toEqual([before]);
      expect(
        (
          await fixture.source.query(
            "SELECT status,version FROM core.commerce_orders WHERE id=$1",
            [id],
          )
        ).rows,
      ).toEqual([{ status: "reserved", version: 1 }]);
      expect(
        (
          await fixture.source.query(
            "SELECT state,released_at FROM core.commerce_reservations WHERE order_id=$1",
            [id],
          )
        ).rows,
      ).toEqual([{ state: "held", released_at: null }]);
      expect(
        (
          await fixture.source.query(
            "SELECT operation_id FROM core.commerce_order_cancellations WHERE order_id=$1",
            [id],
          )
        ).rows,
      ).toEqual([]);
      expect(
        (
          await fixture.source.query("SELECT id FROM platform.outbox WHERE operation_id=$1", [
            operation,
          ])
        ).rows,
      ).toEqual([]);
    },
  );
});
