import type {
  BookingCustomerApi,
  BookingRecord,
  Offer,
} from "../../apps/workspaces/src/customer/booking/contracts";
import {
  bookingMetadataResponseSchema,
  bookingOfferSlotId,
} from "../../packages/contracts/src/booking-offers";

export const ids = Array.from(
  { length: 12 },
  (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
);
export const owner = ids[0]!;
export const doctorId = ids[1]!;
export const clinicId = ids[2]!;
export const serviceId = ids[3]!;
export const now = "2026-10-24T09:00:00.000Z";
export const session = {
  userId: owner,
  expiresAt: "2026-10-24T12:00:00.000Z",
  workspaces: ["customer" as const],
};
export const directory = {
  doctors: [
    {
      doctorId,
      revision: 1,
      departmentId: ids[4]!,
      clinicIds: [clinicId],
      displayName: "Synthetic Doctor",
      qualifications: ["Synthetic qualification"],
      languages: ["en"],
      approvedPhotoObjectId: ids[5]!,
      publicationApprovalId: ids[6]!,
    },
  ],
  clinics: [{ id: clinicId, name: "Synthetic Clinic" }],
  services: [{ id: serviceId, name: "Synthetic Consultation" }],
};
export const selection = { doctorId, clinicId, serviceId };
export const offer: Offer = {
  serviceId,
  slot: {
    doctorId,
    clinicId,
    clinicTimezone: "Asia/Kolkata",
    availabilityId: ids[7]!,
    availabilityRevision: 1,
    interval: { start: "2026-10-24T10:00:00.000Z", end: "2026-10-24T10:15:00.000Z" },
    buffers: { beforeMs: 0, afterMs: 0 },
    modality: "online",
  },
  fee: {
    feeId: ids[8]!,
    revision: 1,
    doctorId,
    clinicId,
    modality: "online",
    amountPaise: 15000,
    currency: "INR",
    approvedPolicyId: ids[9]!,
  },
};
export const booking: BookingRecord = {
  id: ids[10]!,
  revision: 1,
  ownerId: owner,
  state: "held",
  provenance: { source: "online", customerId: owner },
  slot: offer.slot,
  fee: offer.fee,
  policyId: ids[9]!,
  policyRevision: 1,
  createdAt: now,
  holdExpiresAt: "2026-10-24T09:01:00.000Z",
  paymentOrderId: "synthetic_pending",
  payments: [],
};
export const runtimeMetadata = bookingMetadataResponseSchema.parse({
  serverNow: now,
  clinics: [
    {
      clinicId,
      revision: 1,
      displayName: "Synthetic Clinic",
      clinicTimezone: "Asia/Kolkata",
      publicationApprovalId: ids[6],
      approvedByActorId: ids[0],
      approvedAt: now,
    },
  ],
  services: [
    {
      serviceId,
      revision: 1,
      displayName: "Synthetic Consultation",
      publicationApprovalId: ids[6],
      approvedByActorId: ids[0],
      approvedAt: now,
    },
  ],
  scopes: [
    {
      ...selection,
      availabilityId: offer.slot.availabilityId,
      availabilityRevision: 1,
      modality: "online",
    },
  ],
});
export const runtimeOffers = {
  serverNow: now,
  offers: [{ ...offer, slotId: bookingOfferSlotId(offer.slot) }],
  truncated: true,
};
export const ready = <T>(data: T) => ({ status: "ready" as const, data });
export function fixtureApi(overrides: Partial<BookingCustomerApi> = {}): BookingCustomerApi {
  return {
    directory: async () => ready(directory),
    slots: async () => ready({ serverNow: now, offers: [offer] }),
    appointments: async () => ready({ serverNow: now, bookings: [] }),
    hold: async () => ready({ serverNow: now, booking }),
    read: async () => ready({ serverNow: now, booking }),
    ...overrides,
  };
}
