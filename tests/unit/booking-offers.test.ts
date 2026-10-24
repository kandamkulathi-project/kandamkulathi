import { describe, expect, it } from "vitest";
import {
  bookingOfferSchema,
  bookingOfferSlotId,
  bookingOffersQuerySchema,
} from "../../packages/contracts/src/booking-offers.ts";

const id = "00000000-0000-4000-8000-000000000001";
const query = {
  doctorId: id,
  clinicId: id,
  serviceId: id,
  modality: "online",
  from: "2030-01-01T00:00:00.000Z",
  until: "2030-01-02T00:00:00.000Z",
};
describe("canonical booking offers", () => {
  it("bounds search and rejects client clocks, unknown fields, ambiguous time and invalid limits", () => {
    expect(bookingOffersQuerySchema.parse(query).limit).toBe(50);
    for (const change of [
      { serverNow: query.from },
      { until: query.from },
      { until: "2030-02-01T00:00:00.000Z" },
      { limit: 101 },
      { limit: 0 },
      { from: "2030-01-01" },
    ])
      expect(bookingOffersQuerySchema.safeParse({ ...query, ...change }).success).toBe(false);
  });
  it("binds stable selection identity and fee to the canonical existing slot", () => {
    const slot = {
      doctorId: id,
      clinicId: id,
      clinicTimezone: "Asia/Kolkata",
      availabilityId: id,
      availabilityRevision: 2,
      interval: { start: query.from, end: "2030-01-01T00:30:00.000Z" },
      buffers: { beforeMs: 0, afterMs: 0 },
      modality: "online" as const,
    };
    const offer = {
      slotId: bookingOfferSlotId(slot),
      serviceId: id,
      slot,
      fee: {
        feeId: id,
        revision: 1,
        doctorId: id,
        clinicId: id,
        modality: "online",
        amountPaise: 50000,
        currency: "INR",
        approvedPolicyId: id,
      },
    };
    expect(bookingOfferSchema.safeParse(offer).success).toBe(true);
    expect(bookingOfferSchema.safeParse({ ...offer, slotId: "invented" }).success).toBe(false);
    expect(
      bookingOfferSchema.safeParse({ ...offer, fee: { ...offer.fee, modality: "in_clinic" } })
        .success,
    ).toBe(false);
  });
});
