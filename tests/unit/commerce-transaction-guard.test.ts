import { describe, expect, it, vi } from "vitest";
import { type DatabaseContext, inTransaction } from "../../packages/database/src/client";
import { CommercePaymentRepository } from "../../packages/database/src/commerce-payments";
import { PaymentError } from "../../packages/domain/src/commerce-payments";
import { ids } from "./identity-fixtures";

describe("commerce payment transaction authority guard", () => {
  it("fenced receipt API cannot open its own transaction or act outside an active one", async () => {
    const query = vi.fn();
    const context = { client: { query } } as unknown as DatabaseContext;
    const store = new CommercePaymentRepository(context, { lock: vi.fn() });
    await expect(
      store.receiveInTransaction({
        id: "order_synthetic",
        reference: ids.other,
        amountPaise: 1,
        currency: "INR",
        eventId: "evt_synthetic",
        digest: "ab".repeat(32),
        accountId: "acc_synthetic",
        paymentId: "pay_synthetic",
        outcome: "captured",
      }),
    ).rejects.toThrow("denied");
    expect(query).not.toHaveBeenCalled();
  });
  it.each(["get", "claimCreate", "markUnknown"] as const)(
    "%s denies inside active transaction before payment reads and rolls back",
    async (method) => {
      // Transport spy only: business persistence and RLS are verified separately on PostgreSQL.
      const query = vi.fn(async (_sql: string, ..._parameters: unknown[]) => ({
        rows: [],
        rowCount: 0,
        command: "ROLLBACK",
      }));
      const context = { client: { query } } as unknown as DatabaseContext;
      const authority = { lock: vi.fn() };
      const guard = vi.fn(async (active: DatabaseContext, actorId: string) => {
        expect(active).toBe(context);
        expect(actorId).toBe(ids.actor);
        expect(inTransaction(active.client)).toBe(true);
        throw new PaymentError("denied");
      });
      const store = new CommercePaymentRepository(context, authority, undefined, undefined, guard);
      await expect(store[method](ids.actor, ids.other)).rejects.toThrow("denied");
      expect(guard).toHaveBeenCalledOnce();
      expect(authority.lock).not.toHaveBeenCalled();
      expect(
        query.mock.calls.some((call) => String(call[0]).includes("commerce_payment_intents")),
      ).toBe(false);
      expect(query).toHaveBeenLastCalledWith("ROLLBACK");
      expect(inTransaction(context.client)).toBe(false);
    },
  );
});
