import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  PaymentIntent,
  VerifiedPaymentEvent,
} from "../../packages/contracts/src/commerce-payments";
import {
  type DatabaseContext,
  inTransaction,
  transaction,
} from "../../packages/database/src/client";
import {
  applyVerifiedCommerceOrderPayment,
  createCommerceFinancialHandlers,
} from "../../packages/database/src/commerce-payment-orders";
import {
  CommercePaymentRepository,
  type PaymentApplication,
} from "../../packages/database/src/commerce-payments";
import { expireCommerceReservations } from "../../packages/database/src/commerce-reservations";
import { ids } from "../unit/identity-fixtures";

interface Fixture {
  source: { query: DatabaseContext["client"]["query"] };
  runtime<T>(kind: "core" | "jobs", work: (context: DatabaseContext) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
let fixture: Fixture;
const skuId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac";
const batchId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad";
const taxId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaae";
const handlers = createCommerceFinancialHandlers();

async function readyIntent(): Promise<{ intent: PaymentIntent; event: VerifiedPaymentEvent }> {
  const orderId = randomUUID();
  const operationId = randomUUID();
  // Isolated authoritative fixtures for callback tests; checkout/import invariants have their own tests.
  await fixture.source.query(
    `INSERT INTO core.commerce_orders(id,operation_id,actor_id,location_id,request_key,amount_paise,expires_at,source,hold_policy_reference)
    VALUES($1,$1,$2,$3,'synthetic',12345,clock_timestamp()+interval '1 hour','web','synthetic-approved-hold')`,
    [orderId, ids.actor, ids.clinic],
  );
  await fixture.source.query(
    "INSERT INTO core.commerce_order_addresses(order_id,address) VALUES($1,$2::jsonb)",
    [
      orderId,
      JSON.stringify({
        recipientName: "Synthetic Customer",
        line1: "1 Synthetic Street",
        city: "Test City",
        region: "Test Region",
        postalCode: "680001",
        country: "IN",
        contactPhone: "+919876543210",
      }),
    ],
  );
  await fixture.source.query(
    `INSERT INTO core.commerce_order_lines(order_id,sku_id,quantity,sku_version,unit_paise,tax_paise,amount_paise,tax_policy_id,tax_rate_bps)
    VALUES($1,$2,1,1,12345,0,12345,$3,0)`,
    [orderId, skuId, taxId],
  );
  await fixture.source.query("UPDATE core.commerce_batches SET reserved=reserved+1 WHERE id=$1", [
    batchId,
  ]);
  await fixture.source.query(
    "INSERT INTO core.commerce_reservations(order_id,sku_id,batch_id,quantity) VALUES($1,$2,$3,1)",
    [orderId, skuId, batchId],
  );
  const providerId = `order_${operationId.replaceAll("-", "")}`;
  const intent = await fixture.runtime("core", async (context) => {
    const repository = new CommercePaymentRepository(
      context,
      handlers.authority,
      undefined,
      handlers.application,
    );
    const opened = await repository.open(
      ids.actor,
      { operationId, subject: { kind: "order", id: orderId }, method: "razorpay" },
      "acc_synthetic",
    );
    await repository.claimCreate(ids.actor, opened.id);
    await repository.bindOrder(ids.actor, opened.id, {
      id: providerId,
      reference: operationId,
      amountPaise: 12345,
      currency: "INR",
    });
    return opened;
  });
  return {
    intent,
    event: {
      id: providerId,
      reference: operationId,
      amountPaise: 12345,
      currency: "INR",
      eventId: `evt_${operationId.replaceAll("-", "")}`,
      digest: "ab".repeat(32),
      accountId: "acc_synthetic",
      paymentId: `pay_${operationId.replaceAll("-", "")}`,
      outcome: "captured",
    },
  };
}
const receive = (
  event: VerifiedPaymentEvent,
  application: PaymentApplication = handlers.application,
) =>
  fixture.runtime("jobs", (context) =>
    new CommercePaymentRepository(context, handlers.authority, undefined, application).receive(
      event,
    ),
  );

describe("order financial application — actual PostgreSQL, internal verified-proof fixtures", () => {
  beforeAll(async () => {
    const supportPath = "../platform/support.mjs";
    fixture = await (await import(supportPath)).testDatabase();
    for (const [table, file] of [
      ["core.identity_actors", "0002_mathew_identity.sql"],
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
    if (
      !(
        await fixture.source.query(
          "SELECT 1 FROM pg_policies WHERE schemaname='core' AND tablename='commerce_payment_refunds' AND policyname='refund_jobs_review'",
        )
      ).rowCount
    )
      await fixture.source.query(
        await readFile(
          new URL(
            "../../packages/database/migrations/0024_commerce_reconcile_jobs_access.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
    await fixture.source.query(
      "INSERT INTO core.commerce_locations(id,name) VALUES($1,'synthetic')",
      [ids.clinic],
    );
    await fixture.source.query(
      "INSERT INTO core.commerce_tax_policies(id,rate_bps,basis,rounding,approved_by,active) VALUES($1,0,'exclusive','half_up_line',$2,true)",
      [taxId, ids.actor],
    );
    await fixture.source.query(
      `INSERT INTO core.commerce_skus(id,sku,name,variant,description,image_url,concerns,approved_by,consult_only,unit_paise,tax_policy_id,minimum_shelf_life_days)
      VALUES($1,'synthetic','Synthetic','one','synthetic','https://example.invalid/synthetic','{}',$2,false,12345,$3,0)`,
      [skuId, ids.actor, taxId],
    );
    await fixture.source.query(
      "INSERT INTO core.commerce_batches(id,sku_id,location_id,batch_code,expires_on,on_hand) VALUES($1,$2,$3,'synthetic',CURRENT_DATE+365,100)",
      [batchId, skuId, ids.clinic],
    );
  }, 60000);
  afterAll(async () => {
    await fixture?.close();
  });

  it("concurrent duplicate capture commits one ledger/order transition, without inventing fulfillment", async () => {
    const { intent, event } = await readyIntent();
    expect(await Promise.all([receive(event), receive(event)])).toEqual(
      expect.arrayContaining(["applied", "duplicate"]),
    );
    expect(
      (
        await fixture.source.query("SELECT status,version FROM core.commerce_orders WHERE id=$1", [
          intent.subject.id,
        ])
      ).rows[0],
    ).toEqual({ status: "paid", version: 2 });
    expect(
      (
        await fixture.source.query(
          "SELECT count(*)::int AS count FROM core.commerce_payment_ledger WHERE intent_id=$1",
          [intent.id],
        )
      ).rows[0]?.count,
    ).toBe(1);
    const batch = (
      await fixture.source.query("SELECT on_hand,reserved FROM core.commerce_batches WHERE id=$1", [
        batchId,
      ])
    ).rows[0];
    expect(batch?.on_hand).toBe(100);
    expect(batch?.reserved).toBeGreaterThan(0);
  });
  it("fenced JOBS receipt completion uses the caller transaction and rolls back all financial effects if completion fails", async () => {
    const { intent, event } = await readyIntent();
    await fixture.runtime("jobs", async (context) => {
      const repository = new CommercePaymentRepository(
        context,
        handlers.authority,
        undefined,
        handlers.application,
      );
      await expect(repository.receiveInTransaction(event)).rejects.toThrow("denied");
      await expect(
        transaction(context.client, async () => {
          expect(await repository.receiveInTransaction(event)).toBe("applied");
          throw new Error("synthetic fenced completion failed");
        }),
      ).rejects.toThrow("fenced completion failed");
      expect(
        (
          await context.client.query(
            "SELECT nullif(current_setting('app.payment_system',true),'') AS proof",
          )
        ).rows[0]?.proof,
      ).toBeNull();
    });
    await expect(
      fixture.runtime("core", (context) =>
        transaction(context.client, () =>
          new CommercePaymentRepository(
            context,
            handlers.authority,
            undefined,
            handlers.application,
          ).receiveInTransaction(event),
        ),
      ),
    ).rejects.toThrow("denied");
    expect(
      (
        await fixture.source.query(
          "SELECT count(*)::int AS count FROM core.commerce_payment_receipts WHERE event_id=$1",
          [event.eventId],
        )
      ).rows[0]?.count,
    ).toBe(0);
    expect(
      (
        await fixture.source.query(
          "SELECT count(*)::int AS count FROM core.commerce_payment_ledger WHERE intent_id=$1",
          [intent.id],
        )
      ).rows[0]?.count,
    ).toBe(0);
    expect(
      (
        await fixture.source.query("SELECT status FROM core.commerce_orders WHERE id=$1", [
          intent.subject.id,
        ])
      ).rows[0]?.status,
    ).toBe("reserved");
    expect(await receive(event)).toBe("applied");
  });
  it("owner payment reads reauthorize inside the actual transaction and a revoked guard cannot mutate the intent", async () => {
    const { intent } = await readyIntent();
    await fixture.runtime("core", async (context) => {
      let allowed = true;
      let calls = 0;
      const repository = new CommercePaymentRepository(
        context,
        handlers.authority,
        undefined,
        handlers.application,
        async (active, actorId) => {
          expect(active).toBe(context);
          expect(inTransaction(active.client)).toBe(true);
          expect(actorId).toBe(ids.actor);
          expect(
            (await active.client.query("SELECT current_setting('app.actor_id') AS actor")).rows[0]
              ?.actor,
          ).toBe(ids.actor);
          calls++;
          if (!allowed) throw new Error("synthetic revoked authority");
        },
      );
      expect((await repository.get(ids.actor, intent.id)).id).toBe(intent.id);
      allowed = false;
      await expect(repository.markUnknown(ids.actor, intent.id)).rejects.toThrow(
        "revoked authority",
      );
      expect(calls).toBe(2);
    });
    expect(
      (
        await fixture.source.query("SELECT state FROM core.commerce_payment_intents WHERE id=$1", [
          intent.id,
        ])
      ).rows[0]?.state,
    ).toBe("ready");
  });
  it.each(["expired", "recalled"])(
    "accounts %s capture with durable reconciliation rather than losing paid money",
    async (scenario) => {
      const { intent, event } = await readyIntent();
      if (scenario === "expired")
        await fixture.source.query(
          "UPDATE core.commerce_orders SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour' WHERE id=$1",
          [intent.subject.id],
        );
      else
        await fixture.source.query("UPDATE core.commerce_batches SET recalled=true WHERE id=$1", [
          batchId,
        ]);
      expect(await receive(event)).toBe("applied");
      expect(
        (
          await fixture.source.query("SELECT status FROM core.commerce_orders WHERE id=$1", [
            intent.subject.id,
          ])
        ).rows[0]?.status,
      ).toBe("reconciliation_required");
      const obligation = (
        await fixture.source.query(
          "SELECT id,reason,state FROM core.commerce_order_payment_obligations WHERE intent_id=$1",
          [intent.id],
        )
      ).rows[0];
      expect(obligation).toMatchObject({
        reason: scenario === "expired" ? "late_hold" : "unsafe_stock",
        state: "pending",
      });
      expect(
        (
          await fixture.source.query(
            "SELECT count(*)::int AS count FROM platform.outbox WHERE subject_id=$1",
            [obligation?.id],
          )
        ).rows[0]?.count,
      ).toBe(1);
      await fixture.source.query("UPDATE core.commerce_batches SET recalled=false WHERE id=$1", [
        batchId,
      ]);
    },
  );
  it("application failure rolls back receipt, ledger, order state and dependent outbox", async () => {
    const { intent, event } = await readyIntent();
    const failure: PaymentApplication = {
      async apply(...args) {
        await handlers.application.apply(...args);
        throw new Error("Synthetic rollback proof");
      },
    };
    await expect(receive(event, failure)).rejects.toThrow("Synthetic rollback proof");
    expect(
      (
        await fixture.source.query("SELECT status,version FROM core.commerce_orders WHERE id=$1", [
          intent.subject.id,
        ])
      ).rows[0],
    ).toEqual({ status: "reserved", version: 1 });
    expect(
      (
        await fixture.source.query(
          "SELECT count(*)::int AS count FROM core.commerce_payment_receipts WHERE event_id=$1",
          [event.eventId],
        )
      ).rows[0]?.count,
    ).toBe(0);
    expect(
      (
        await fixture.source.query(
          "SELECT count(*)::int AS count FROM core.commerce_payment_ledger WHERE intent_id=$1",
          [intent.id],
        )
      ).rows[0]?.count,
    ).toBe(0);
    expect(await receive(event)).toBe("applied");
  });
  it("concurrent expiry releases exactly once and a later capture remains a durable financial obligation", async () => {
    const { intent, event } = await readyIntent();
    const before = (
      await fixture.source.query("SELECT reserved FROM core.commerce_batches WHERE id=$1", [
        batchId,
      ])
    ).rows[0]?.reserved;
    await fixture.source.query(
      "UPDATE core.commerce_orders SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour' WHERE id=$1",
      [intent.subject.id],
    );
    const results = await Promise.all([
      fixture.runtime("jobs", (context) => expireCommerceReservations(context)),
      fixture.runtime("jobs", (context) => expireCommerceReservations(context)),
    ]);
    expect(
      results.flatMap((result) => result.expiredOrderIds).filter((id) => id === intent.subject.id),
    ).toHaveLength(1);
    expect(
      (
        await fixture.source.query("SELECT reserved FROM core.commerce_batches WHERE id=$1", [
          batchId,
        ])
      ).rows[0]?.reserved,
    ).toBe(before - 1);
    expect(
      (
        await fixture.source.query(
          "SELECT state,released_at FROM core.commerce_reservations WHERE order_id=$1",
          [intent.subject.id],
        )
      ).rows[0],
    ).toMatchObject({ state: "released", released_at: expect.any(Date) });
    expect(await receive(event)).toBe("applied");
    expect(
      (
        await fixture.source.query("SELECT status FROM core.commerce_orders WHERE id=$1", [
          intent.subject.id,
        ])
      ).rows[0]?.status,
    ).toBe("reconciliation_required");
    expect(
      (
        await fixture.source.query(
          "SELECT reason FROM core.commerce_order_payment_obligations WHERE intent_id=$1",
          [intent.id],
        )
      ).rows[0]?.reason,
    ).toBe("late_hold");
  });
  it("expiry cannot release paid allocations or run through the core role", async () => {
    const { intent, event } = await readyIntent();
    expect(await receive(event)).toBe("applied");
    const before = (
      await fixture.source.query("SELECT reserved FROM core.commerce_batches WHERE id=$1", [
        batchId,
      ])
    ).rows[0]?.reserved;
    await fixture.source.query(
      "UPDATE core.commerce_orders SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour' WHERE id=$1",
      [intent.subject.id],
    );
    const result = await fixture.runtime("jobs", (context) => expireCommerceReservations(context));
    expect(result.expiredOrderIds).not.toContain(intent.subject.id);
    expect(
      (
        await fixture.source.query("SELECT reserved FROM core.commerce_batches WHERE id=$1", [
          batchId,
        ])
      ).rows[0]?.reserved,
    ).toBe(before);
    await expect(
      fixture.runtime("core", (context) => expireCommerceReservations(context)),
    ).rejects.toThrow();
  });
  it("a failed expiry stock guard rolls back state, release history and outbox", async () => {
    const { intent } = await readyIntent();
    const before = (
      await fixture.source.query("SELECT reserved FROM core.commerce_batches WHERE id=$1", [
        batchId,
      ])
    ).rows[0]?.reserved;
    await fixture.source.query(
      "UPDATE core.commerce_orders SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour' WHERE id=$1",
      [intent.subject.id],
    );
    await fixture.source.query("UPDATE core.commerce_batches SET reserved=0 WHERE id=$1", [
      batchId,
    ]);
    try {
      await expect(
        fixture.runtime("jobs", (context) => expireCommerceReservations(context)),
      ).rejects.toThrow();
      expect(
        (
          await fixture.source.query("SELECT status FROM core.commerce_orders WHERE id=$1", [
            intent.subject.id,
          ])
        ).rows[0]?.status,
      ).toBe("reserved");
      expect(
        (
          await fixture.source.query(
            "SELECT state FROM core.commerce_reservations WHERE order_id=$1",
            [intent.subject.id],
          )
        ).rows[0]?.state,
      ).toBe("held");
      expect(
        (
          await fixture.source.query(
            "SELECT count(*)::int AS count FROM core.commerce_reservation_expirations WHERE order_id=$1",
            [intent.subject.id],
          )
        ).rows[0]?.count,
      ).toBe(0);
    } finally {
      await fixture.source.query("UPDATE core.commerce_batches SET reserved=$2 WHERE id=$1", [
        batchId,
        before,
      ]);
      await fixture.runtime("jobs", (context) => expireCommerceReservations(context));
    }
  });
  it("requires active signed-receipt transaction and denies arbitrary core paid mutations", async () => {
    const { intent, event } = await readyIntent();
    await expect(
      fixture.runtime("jobs", (context) =>
        applyVerifiedCommerceOrderPayment(
          context,
          { ...intent, state: "captured" },
          event,
          randomUUID(),
        ),
      ),
    ).rejects.toThrow();
    await fixture.runtime("core", async (context) => {
      await expect(
        context.client.query("UPDATE core.commerce_orders SET status='paid' WHERE id=$1", [
          intent.subject.id,
        ]),
      ).rejects.toThrow(/permission denied/);
    });
    await fixture.runtime("jobs", async (context) => {
      expect((await context.client.query("SELECT id FROM core.commerce_orders")).rows).toEqual([]);
    });
  });
  it("JOBS may only read refund obligations in verified financial context, never approve or dispatch them", async () => {
    const { intent } = await readyIntent();
    const id = randomUUID();
    await fixture.source.query(
      "INSERT INTO core.commerce_payment_refunds(id,operation_id,intent_id,actor_id,amount_paise,policy_version,approved_by) VALUES($1,$1,$2,$3,1,'synthetic-approved-v1',$3)",
      [id, intent.id, ids.actor],
    );
    await fixture.runtime("jobs", async (context) => {
      expect(
        (
          await context.client.query("SELECT id FROM core.commerce_payment_refunds WHERE id=$1", [
            id,
          ])
        ).rows,
      ).toEqual([]);
      await transaction(context.client, async () => {
        await context.client.query("SELECT set_config('app.payment_system','verified',true)");
        expect(
          (
            await context.client.query(
              "SELECT state FROM core.commerce_payment_refunds WHERE id=$1",
              [id],
            )
          ).rows[0]?.state,
        ).toBe("requested");
      });
      await expect(
        context.client.query(
          "UPDATE core.commerce_payment_refunds SET state='processed' WHERE id=$1",
          [id],
        ),
      ).rejects.toThrow();
      expect(
        (
          await context.client.query("SELECT id FROM core.commerce_payment_refunds WHERE id=$1", [
            id,
          ])
        ).rows,
      ).toEqual([]);
    });
  });
});
