import { z } from "zod";
import {
  type BookingSlot,
  bookingFeeSnapshotSchema,
  bookingIdSchema,
  bookingSlotSchema,
  clinicTimezoneSchema,
  consultationModalitySchema,
  revisionSchema,
  utcInstantSchema,
} from "./booking.ts";

const approval = {
  publicationApprovalId: bookingIdSchema,
  approvedByActorId: bookingIdSchema,
  approvedAt: utcInstantSchema,
};
export const bookingClinicMetadataSchema = z.strictObject({
  clinicId: bookingIdSchema,
  revision: revisionSchema,
  displayName: z.string().trim().min(1).max(160),
  clinicTimezone: clinicTimezoneSchema,
  ...approval,
});
export const bookingServiceMetadataSchema = z.strictObject({
  serviceId: bookingIdSchema,
  revision: revisionSchema,
  displayName: z.string().trim().min(1).max(160),
  ...approval,
});
export const bookingOfferScopeSchema = z.strictObject({
  doctorId: bookingIdSchema,
  clinicId: bookingIdSchema,
  serviceId: bookingIdSchema,
  availabilityId: bookingIdSchema,
  availabilityRevision: revisionSchema,
  modality: consultationModalitySchema,
});
export const bookingMetadataResponseSchema = z.strictObject({
  serverNow: utcInstantSchema,
  clinics: z.array(bookingClinicMetadataSchema).max(200),
  services: z.array(bookingServiceMetadataSchema).max(200),
  scopes: z.array(bookingOfferScopeSchema).max(200),
});
export const bookingOffersQuerySchema = z
  .strictObject({
    doctorId: bookingIdSchema,
    clinicId: bookingIdSchema,
    serviceId: bookingIdSchema,
    modality: consultationModalitySchema,
    from: utcInstantSchema,
    until: utcInstantSchema,
    limit: z.number().int().min(1).max(100).default(50),
  })
  .refine(
    (value) =>
      value.from < value.until &&
      Date.parse(value.until) - Date.parse(value.from) <= 7 * 86_400_000,
    "Offer search must be increasing and at most seven days",
  );
/** Stable public selection identity, NOT a reservation or authorization token. */
export const bookingOfferSlotId = (slot: BookingSlot): string =>
  `offer:${slot.availabilityId}:${slot.availabilityRevision}:${slot.modality}:${slot.interval.start}`;
export const bookingOfferSchema = z
  .strictObject({
    slotId: z.string().min(1).max(180),
    serviceId: bookingIdSchema,
    slot: bookingSlotSchema,
    fee: bookingFeeSnapshotSchema,
  })
  .superRefine((value, context) => {
    if (
      value.slotId !== bookingOfferSlotId(value.slot) ||
      value.slot.doctorId !== value.fee.doctorId ||
      value.slot.clinicId !== value.fee.clinicId ||
      value.slot.modality !== value.fee.modality
    ) {
      context.addIssue({
        code: "custom",
        message: "Offer identity and fee must match the canonical slot",
      });
    }
  });
export const bookingOffersResponseSchema = z.strictObject({
  serverNow: utcInstantSchema,
  offers: z.array(bookingOfferSchema).max(100),
  truncated: z.boolean(),
});
export type BookingOffersQuery = z.infer<typeof bookingOffersQuerySchema>;
export type BookingOffer = z.infer<typeof bookingOfferSchema>;
export type BookingMetadataResponse = z.infer<typeof bookingMetadataResponseSchema>;
export type BookingOffersResponse = z.infer<typeof bookingOffersResponseSchema>;
