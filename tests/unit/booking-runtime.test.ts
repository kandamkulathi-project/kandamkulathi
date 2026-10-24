import { describe, expect, it } from "vitest";
import {
  applyVerifiedBookingPayment,
  persistedHoldSchema,
} from "../../packages/database/src/booking.ts";
import type { DatabaseContext } from "../../packages/database/src/client.ts";

const id = "00000000-0000-4000-8000-000000000001";
describe("persisted booking boundary", () => {
  it("rejects injected fee, actor, payment and end-time fields", () => {
    const input = {
      operationId: id,
      bookingId: id,
      request: {
        doctorId: id,
        clinicId: id,
        ownerId: id,
        availabilityId: id,
        expectedAvailabilityRevision: 1,
        modality: "online",
        start: "2030-01-01T10:00:00.000Z",
      },
    };
    expect(persistedHoldSchema.parse(input)).toEqual(input);
    for (const extra of [
      { actor: id },
      { fee: 1 },
      { payment: "captured" },
      { end: "2030-01-01T11:00:00.000Z" },
    ]) {
      expect(
        persistedHoldSchema.safeParse({ ...input, request: { ...input.request, ...extra } })
          .success,
      ).toBe(false);
    }
    expect(
      persistedHoldSchema.safeParse({ ...input, authority: { kind: "customer", customerId: id } })
        .success,
    ).toBe(false);
  });

  it("financial callback refuses autocommit before any SQL/effect", async () => {
    const context = { client: {} } as DatabaseContext;
    await expect(applyVerifiedBookingPayment(context, {} as never)).rejects.toThrow("UNAVAILABLE");
  });
});
