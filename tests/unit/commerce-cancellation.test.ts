import { describe, expect, it } from "vitest";
import { commerceCancellationRequestSchema } from "../../packages/contracts/src/commerce-cancellation";
import { assertUnpaidOrderCancellation } from "../../packages/domain/src/commerce-cancellation";
import { ids } from "./identity-fixtures";

describe("unpaid cancellation safety envelope", () => {
  const safe = { status: "reserved", version: 1, expectedVersion: 1, hasPaymentIntent: false };
  it("allows only the versioned unpaid reservation", () => {
    expect(() => assertUnpaidOrderCancellation(safe)).not.toThrow();
    expect(() => assertUnpaidOrderCancellation({ ...safe, expectedVersion: 2 })).toThrow(
      "stale_version",
    );
  });
  it.each(["paid", "expired", "cancelled", "reconciliation_required"])("refuses %s", (status) => {
    expect(() => assertUnpaidOrderCancellation({ ...safe, status })).toThrow("operation_conflict");
  });
  it("refuses every existing intent, including failed or uncertain provider work", () => {
    expect(() => assertUnpaidOrderCancellation({ ...safe, hasPaymentIntent: true })).toThrow(
      "operation_conflict",
    );
  });
  it("requires explicit confirmation and rejects caller financial/identity policy", () => {
    const input = { operationId: ids.other, expectedVersion: 1, confirmed: true };
    expect(commerceCancellationRequestSchema.safeParse(input).success).toBe(true);
    for (const change of [
      { confirmed: false },
      { expectedVersion: 0 },
      { actorId: ids.actor },
      { refundPaise: 100 },
      { policy: "approved" },
    ])
      expect(commerceCancellationRequestSchema.safeParse({ ...input, ...change }).success).toBe(
        false,
      );
  });
});
