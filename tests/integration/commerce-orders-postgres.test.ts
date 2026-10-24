import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CommercePrincipal } from "../../apps/core-api/src/commerce-authorization";
import { revalidateCommerceTransaction } from "../../apps/core-api/src/commerce-identity";
import { type DatabaseContext, transaction } from "../../packages/database/src/client";
import { commerceLocationForClinic } from "../../packages/database/src/commerce-clinics";
import { CommerceOrdersRepository } from "../../packages/database/src/commerce-orders";
import { ids } from "../unit/identity-fixtures";

interface Fixture {
  source: { query: DatabaseContext["client"]["query"] };
  runtime<T>(kind: "core", work: (context: DatabaseContext) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
let fixture: Fixture;
const secondClinic = "d4444444-d444-4444-8444-444444444445";
const locationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1";
const secondLocation = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2";
const secondOrder = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab";
const skuId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac";
const batchId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad";
const taxId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaae";
const address = {
  recipientName: "Synthetic Customer",
  line1: "1 Synthetic Street",
  city: "Test City",
  region: "Test Region",
  postalCode: "680001",
  country: "IN",
  contactPhone: "+919876543210",
};

describe("commerce order visibility — real PostgreSQL non-owner RLS", () => {
  beforeAll(async () => {
    // Existing fail-closed platform fixture validates loopback PostgreSQL 17 and creates isolated DB/roles.
    const supportPath = "../platform/support.mjs";
    const support = await import(supportPath);
    fixture = await support.testDatabase();
    expect(
      (
        await fixture.source.query("SELECT id FROM public.k_platform_migrations WHERE id=$1", [
          "0023_commerce_clinic_directory",
        ])
      ).rows,
    ).toEqual([{ id: "0023_commerce_clinic_directory" }]);
    await fixture.source.query(
      "INSERT INTO core.identity_actors(id,provider_user_id,status) VALUES($1,'synthetic_actor','active'),($2,'synthetic_staff','active')",
      [ids.actor, ids.patientActor],
    );
    await fixture.source.query(
      "INSERT INTO core.identity_memberships(id,actor_id,record) VALUES($1,$2,$3::jsonb)",
      [
        ids.membership,
        ids.patientActor,
        JSON.stringify({
          id: ids.membership,
          workspace: "staff",
          organizationId: ids.organization,
          clinicId: ids.clinic,
          actions: ["workspace:enter"],
          validFrom: new Date(Date.now() - 3600000).toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          revokedAt: null,
        }),
      ],
    );
    await fixture.source.query(
      "INSERT INTO core.commerce_locations(id,name) VALUES($1,'synthetic-one'),($2,'synthetic-two')",
      [locationId, secondLocation],
    );
    for (const [clinicId, location, displayName] of [
      [ids.clinic, locationId, "Synthetic approved clinic one"],
      [secondClinic, secondLocation, "Synthetic approved clinic two"],
    ] as const) {
      await fixture.source.query(
        "INSERT INTO clinical.mathew_booking_clinic_metadata(clinic_id,document,published) VALUES($1,$2::jsonb,true)",
        [
          clinicId,
          JSON.stringify({
            clinicId,
            revision: 1,
            displayName,
            clinicTimezone: "Asia/Kolkata",
            publicationApprovalId: ids.assignment,
            approvedByActorId: ids.actor,
            approvedAt: new Date(Date.now() - 3600000).toISOString(),
          }),
        ],
      );
      await fixture.source.query(
        "INSERT INTO core.commerce_clinic_locations(clinic_id,location_id,approved_by,approval_reference,active) VALUES($1,$2,$3,'synthetic-mapping-approval',true)",
        [clinicId, location, ids.actor],
      );
    }
    await fixture.source.query(
      "INSERT INTO core.commerce_tax_policies(id,rate_bps,basis,rounding,approved_by,active) VALUES($1,0,'exclusive','half_up_line',$2,true)",
      [taxId, ids.actor],
    );
    await fixture.source.query(
      `INSERT INTO core.commerce_skus(id,sku,name,variant,description,image_url,concerns,approved_by,consult_only,unit_paise,tax_policy_id,minimum_shelf_life_days)
      VALUES($1,'synthetic-sku','Synthetic product','one','synthetic only','https://example.invalid/product.png','{}',$2,false,12345,$3,0)`,
      [skuId, ids.actor, taxId],
    );
    for (const [id, actor, location] of [
      [ids.other, ids.actor, locationId],
      [secondOrder, ids.patientActor, secondLocation],
    ]) {
      await fixture.source.query(
        `INSERT INTO core.commerce_orders(id,operation_id,actor_id,location_id,request_key,amount_paise,expires_at,source,hold_policy_reference)
        VALUES($1,$1,$2,$3,'synthetic',12345,clock_timestamp()+interval '1 hour','web','synthetic-approved-hold')`,
        [id, actor, location],
      );
      await fixture.source.query(
        `INSERT INTO core.commerce_order_lines(order_id,sku_id,quantity,sku_version,unit_paise,tax_paise,amount_paise,tax_policy_id,tax_rate_bps)
        VALUES($1,$2,1,1,12345,0,12345,$3,0)`,
        [id, skuId, taxId],
      );
      await fixture.source.query(
        "INSERT INTO core.commerce_order_addresses(order_id,address) VALUES($1,$2::jsonb)",
        [id, JSON.stringify(address)],
      );
    }
    await fixture.source.query(
      `INSERT INTO core.commerce_batches(id,sku_id,location_id,batch_code,expires_on,on_hand)
      VALUES($1,$2,$3,'synthetic-batch',CURRENT_DATE+365,10)`,
      [batchId, skuId, locationId],
    );
  }, 60000);
  afterAll(async () => {
    await fixture?.close();
  });

  it("canonical grant foreign key rejects inventory locations as clinic identities", async () => {
    expect(locationId).not.toBe(ids.clinic);
    expect(
      (
        await fixture.source.query(
          "SELECT clinic_id,location_id FROM core.commerce_clinic_locations ORDER BY clinic_id",
        )
      ).rows,
    ).toEqual([
      { clinic_id: ids.clinic, location_id: locationId },
      { clinic_id: secondClinic, location_id: secondLocation },
    ]);
    await expect(
      fixture.source.query(
        `INSERT INTO core.commerce_staff_grants(id,actor_id,membership_id,clinic_id,action,valid_from,expires_at)
        VALUES($1,$2,$3,$4,'orders:read',clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour')`,
        [taxId, ids.patientActor, ids.membership, locationId],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("owner list/detail returns persisted totals while other owner detail is absent", async () => {
    const result = await fixture.runtime("core", async (context) => {
      const repository = new CommerceOrdersRepository(context, ids.actor);
      return {
        page: await repository.orders({ limit: 25 }),
        own: await repository.order(ids.other),
        other: await repository.order(secondOrder),
      };
    });
    expect(result.page.items.map((order) => order.orderId)).toEqual([ids.other]);
    expect(result.own).toMatchObject({
      amountPaise: 12345,
      currency: "INR",
      source: "web",
      fulfillment: "unavailable",
      documents: [],
      deliveryAddress: address,
      lines: [{ quantity: 1, amountPaise: 12345 }],
    });
    expect(result.other).toBeNull();
  });
  it("the composed repository revalidates real shared identity in the same transaction and immediately denies revoked sessions", async () => {
    const validFrom = new Date(Date.now() - 3600000).toISOString();
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    await fixture.source.query(
      "INSERT INTO core.identity_policy(privacy_version,consultation_version,marketing_version,approval_reference) VALUES('synthetic-v1','synthetic-v1','synthetic-v1','synthetic-approval')",
    );
    await fixture.source.query(
      `INSERT INTO core.identity_sessions(id,actor_id,provider_user_id,provider_session_id,authenticated_at,expires_at)
      VALUES($1,$2,'synthetic_actor','synthetic_session',$3,$4)`,
      [ids.session, ids.actor, validFrom, expiresAt],
    );
    await fixture.source.query(
      "INSERT INTO core.identity_memberships(id,actor_id,record) VALUES($1,$2,$3::jsonb)",
      [
        ids.other,
        ids.actor,
        JSON.stringify({
          id: ids.other,
          workspace: "customer",
          organizationId: null,
          clinicId: null,
          actions: ["workspace:enter"],
          validFrom,
          expiresAt,
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
          decidedAt: validFrom,
          expiresAt: null,
          revokedAt: null,
        }),
      ],
    );
    const principal: CommercePrincipal = {
      allowed: true,
      actorId: ids.actor,
      sessionId: ids.session,
      clinicId: null,
      action: null,
      identity: {
        actorId: ids.actor,
        sessionId: ids.session,
        organizationId: null,
        authenticatedAt: validFrom,
        expiresAt,
        mfa: null,
      },
    };
    const read = () =>
      fixture.runtime("core", (context) =>
        new CommerceOrdersRepository(context, ids.actor, (active) =>
          revalidateCommerceTransaction(active, principal),
        ).order(ids.other),
      );
    expect((await read())?.orderId).toBe(ids.other);
    await fixture.source.query(
      "UPDATE core.identity_sessions SET revoked_at=clock_timestamp() WHERE id=$1",
      [ids.session],
    );
    await expect(read()).rejects.toThrow();
    await fixture.source.query("UPDATE core.identity_sessions SET revoked_at=NULL WHERE id=$1", [
      ids.session,
    ]);
    expect((await read())?.orderId).toBe(ids.other);
  });
  it("raw RLS with missing or other owner context cannot read private order/lines", async () => {
    await fixture.runtime("core", async (context) => {
      expect((await context.client.query("SELECT id FROM core.commerce_orders")).rows).toEqual([]);
      await transaction(context.client, async () => {
        await context.client.query("SELECT set_config('app.actor_id',$1,true)", [ids.patientActor]);
        expect(
          (
            await context.client.query("SELECT id FROM core.commerce_orders WHERE id=$1", [
              ids.other,
            ])
          ).rows,
        ).toEqual([]);
        expect(
          (
            await context.client.query(
              "SELECT order_id FROM core.commerce_order_lines WHERE order_id=$1",
              [ids.other],
            )
          ).rows,
        ).toEqual([]);
        expect(
          (
            await context.client.query(
              "SELECT address FROM core.commerce_order_addresses WHERE order_id=$1",
              [ids.other],
            )
          ).rows,
        ).toEqual([]);
      });
      expect(
        (
          await context.client.query(
            "SELECT nullif(current_setting('app.actor_id',true),'') AS actor",
          )
        ).rows[0]?.actor,
      ).toBeNull();
    });
  });
  it("current staff grants permit only the granted action and clinic; revocation takes effect", async () => {
    await fixture.source.query(
      `INSERT INTO core.commerce_staff_grants(id,actor_id,membership_id,clinic_id,action,valid_from,expires_at)
      VALUES($1,$2,$3,$4,'orders:read',clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour')`,
      [ids.assignment, ids.patientActor, ids.membership, ids.clinic],
    );
    const read = () =>
      fixture.runtime("core", async (context) => {
        const repository = new CommerceOrdersRepository(
          context,
          ids.patientActor,
          undefined,
          commerceLocationForClinic,
        );
        return {
          orders: await repository.orders({ limit: 25 }, ids.clinic),
          batches: await repository.batches({ limit: 25 }, ids.clinic),
          grants: await repository.grants(),
        };
      });
    const current = await read();
    expect(current.orders.items.map((order) => order.orderId)).toEqual([ids.other]);
    expect(current.batches.items).toEqual([]);
    expect(current.grants).toMatchObject([{ action: "orders:read", clinicId: ids.clinic }]);
    await fixture.runtime("core", async (context) => {
      const detail = await new CommerceOrdersRepository(
        context,
        ids.patientActor,
        undefined,
        commerceLocationForClinic,
      ).order(ids.other, ids.clinic);
      expect(detail?.deliveryAddress).toBeNull();
      await transaction(context.client, async () => {
        await context.client.query("SELECT set_config('app.actor_id',$1,true)", [ids.patientActor]);
        expect(
          (
            await context.client.query(
              "SELECT address FROM core.commerce_order_addresses WHERE order_id=$1",
              [ids.other],
            )
          ).rows,
        ).toEqual([]);
      });
    });
    await fixture.source.query(
      "UPDATE core.commerce_staff_grants SET revoked_at=clock_timestamp() WHERE id=$1",
      [ids.assignment],
    );
    expect((await read()).orders.items).toEqual([]);
  });
  it("separate stock grant exposes only the scoped batch projection and never permits grant mutations", async () => {
    await fixture.source.query(
      `INSERT INTO core.commerce_staff_grants(id,actor_id,membership_id,clinic_id,action,valid_from,expires_at)
      VALUES($1,$2,$3,$4,'stock:read',clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour')`,
      [ids.consultation, ids.patientActor, ids.membership, ids.clinic],
    );
    await fixture.runtime("core", async (context) => {
      const repository = new CommerceOrdersRepository(
        context,
        ids.patientActor,
        undefined,
        commerceLocationForClinic,
      );
      expect((await repository.batches({ limit: 1 }, ids.clinic)).items).toMatchObject([
        { batchId, onHand: 10, reserved: 0 },
      ]);
      expect((await repository.batches({ limit: 1 }, secondClinic)).items).toEqual([]);
      await expect(
        context.client.query(
          "UPDATE core.commerce_staff_grants SET action='catalogue:import' WHERE actor_id=$1",
          [ids.patientActor],
        ),
      ).rejects.toThrow(/permission denied/);
    });
  });
  it("customer keyset cursor is bounded and stable without leaking another owner", async () => {
    const result = await fixture.runtime("core", (context) =>
      new CommerceOrdersRepository(context, ids.actor).orders({ limit: 1, after: ids.other }),
    );
    expect(result).toEqual({ items: [], nextCursor: null });
    await expect(
      fixture.runtime("core", (context) =>
        new CommerceOrdersRepository(context, ids.actor).orders({ limit: 101 }),
      ),
    ).rejects.toThrow();
  });
  it("delivery snapshots cannot be edited by the runtime after checkout", async () => {
    await fixture.runtime("core", async (context) => {
      await expect(
        context.client.query(
          "UPDATE core.commerce_order_addresses SET address='{}'::jsonb WHERE order_id=$1",
          [ids.other],
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        context.client.query("DELETE FROM core.commerce_order_addresses WHERE order_id=$1", [
          ids.other,
        ]),
      ).rejects.toThrow(/permission denied/);
    });
    expect(
      (
        await fixture.source.query(
          "SELECT address FROM core.commerce_order_addresses WHERE order_id=$1",
          [ids.other],
        )
      ).rows[0]?.address,
    ).toEqual(address);
  });
});
