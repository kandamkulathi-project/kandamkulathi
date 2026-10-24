import { bookingOfferSlotId } from "../../packages/contracts/src/booking-offers";
import { directory, ids, now, offer, owner, selection } from "../unit/customer-booking-fixtures";

export { directory, offer, selection };
export const nativeCustomerSession = {
  userId: owner,
  expiresAt: "2099-01-01T00:00:00Z",
  workspaces: ["customer" as const],
};
export const nativeCustomerMetadata = {
  serverNow: now,
  clinics: [
    {
      clinicId: selection.clinicId,
      revision: 1,
      displayName: "Synthetic Clinic",
      clinicTimezone: "Asia/Kolkata",
      publicationApprovalId: ids[6],
      approvedByActorId: owner,
      approvedAt: now,
    },
  ],
  services: [
    {
      serviceId: selection.serviceId,
      revision: 1,
      displayName: "Synthetic Consultation",
      publicationApprovalId: ids[6],
      approvedByActorId: owner,
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
};
export const nativeCustomerOffers = {
  serverNow: now,
  offers: [{ ...offer, slotId: bookingOfferSlotId(offer.slot) }],
  truncated: false,
};
export const nativeCustomerCatalogue = {
  items: [
    {
      skuId: owner,
      sku: "synthetic",
      name: "Synthetic product",
      variant: "Synthetic variant",
      description: "Synthetic non-medical display fixture",
      imageUrl: "https://clinic.example/synthetic.png",
      concerns: [],
      unitPaise: 15000,
      version: 1,
      consultOnly: false,
      stockStatus: "unknown",
    },
  ],
  nextCursor: null,
};
export const nativeCustomerOrders = {
  items: [
    {
      orderId: owner,
      locationId: selection.clinicId,
      amountPaise: 15000,
      currency: "INR",
      status: "reconciliation_required",
      version: 1,
      source: "native",
      createdAt: now,
      expiresAt: "2099-01-01T00:00:00.000Z",
    },
  ],
  nextCursor: null,
};
export const nativeCustomerCart = {
  locationId: selection.clinicId,
  lines: [{ skuId: owner, quantity: 1 }],
};
export const nativeCustomerClinicDirectory = {
  items: [
    {
      clinicId: nativeCustomerSession.userId,
      locationId: nativeCustomerCart.locationId,
      name: "Synthetic approved commerce location",
    },
  ],
};
export const nativeCustomerQuote = {
  lines: [
    {
      skuId: owner,
      quantity: 1,
      version: 1,
      unitPaise: 15000,
      taxPaise: 0,
      amountPaise: 15000,
      taxPolicyId: owner,
      rateBps: 0,
    },
  ],
  amountPaise: 15000,
  currency: "INR",
  quoteKey: "synthetic-authoritative-quote",
};
export const nativeCustomerReservation = {
  orderId: owner,
  amountPaise: 15000,
  currency: "INR",
  status: "reserved",
  expiresAt: "2099-01-01T00:00:00.000Z",
};
export const nativeCustomerPayment = {
  intentId: owner,
  operationId: owner,
  subject: { kind: "order" as const, id: owner },
  amountPaise: 15000,
  currency: "INR" as const,
  state: "unknown" as const,
  providerOrderId: null,
};
