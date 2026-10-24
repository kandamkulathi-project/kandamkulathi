import { z } from "zod";
import { canonicalUuidSchema } from "./identifiers";
import { moneyPaiseSchema } from "./index";

export const bookingIdSchema = canonicalUuidSchema;
export const revisionSchema = z.number().int().safe().positive();
export const durationMsSchema = z.number().int().safe().nonnegative();
/** Canonical UTC, millisecond precision. No offsets, local dates or calendar rollover. */
export const utcInstantSchema = z.iso.datetime({ precision: 3 }).refine((value) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}, "Expected a real canonical UTC instant with millisecond precision");
export const clinicTimezoneSchema = z
  .string()
  .max(100)
  .refine((value) => {
    if (value !== "UTC" && !value.includes("/")) return false;
    try {
      new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
      return true;
    } catch {
      return false;
    }
  }, "Expected an IANA timezone");
export const bookingIntervalSchema = z
  .strictObject({ start: utcInstantSchema, end: utcInstantSchema })
  .refine(({ start, end }) => start < end, "Interval must be nonempty and increasing");
export const bookingBuffersSchema = z.strictObject({
  beforeMs: durationMsSchema,
  afterMs: durationMsSchema,
});
export const consultationModalitySchema = z.enum(["online", "in_clinic"]);
export const bookingStateSchema = z.enum(["held", "confirmed", "expired", "cancelled"]);

/** Server-issued approved fee; not accepted as a customer booking argument. */
export const bookingFeeSnapshotSchema = z.strictObject({
  feeId: bookingIdSchema,
  revision: revisionSchema,
  doctorId: bookingIdSchema,
  clinicId: bookingIdSchema,
  modality: consultationModalitySchema,
  amountPaise: moneyPaiseSchema,
  currency: z.literal("INR"),
  approvedPolicyId: bookingIdSchema,
});
export const doctorAvailabilitySchema = z.strictObject({
  id: bookingIdSchema,
  revision: revisionSchema,
  doctorId: bookingIdSchema,
  clinicId: bookingIdSchema,
  clinicTimezone: clinicTimezoneSchema,
  window: bookingIntervalSchema,
  slotLengthMs: durationMsSchema.refine((value) => value > 0),
  buffers: bookingBuffersSchema,
  modalities: z
    .array(consultationModalitySchema)
    .min(1)
    .max(2)
    .refine((v) => new Set(v).size === v.length),
});
export const doctorLeaveSchema = z.strictObject({
  id: bookingIdSchema,
  revision: revisionSchema,
  doctorId: bookingIdSchema,
  // Global leave applies across every clinic and modality.
  interval: bookingIntervalSchema,
});
export const doctorDirectoryEntrySchema = z.strictObject({
  doctorId: bookingIdSchema,
  revision: revisionSchema,
  departmentId: bookingIdSchema,
  clinicIds: z.array(bookingIdSchema).min(1),
  displayName: z.string().trim().min(1).max(160),
  qualifications: z.array(z.string().trim().min(1).max(200)).min(1),
  languages: z.array(z.string().trim().min(2).max(35)).min(1),
  approvedPhotoObjectId: bookingIdSchema,
  publicationApprovalId: bookingIdSchema,
});
export const bookingProvenanceSchema = z.discriminatedUnion("source", [
  z.strictObject({ source: z.literal("online"), customerId: bookingIdSchema }),
  z.strictObject({ source: z.literal("front_desk"), staffId: bookingIdSchema }),
]);
export const bookingSlotSchema = z.strictObject({
  doctorId: bookingIdSchema,
  clinicId: bookingIdSchema,
  clinicTimezone: clinicTimezoneSchema,
  availabilityId: bookingIdSchema,
  availabilityRevision: revisionSchema,
  interval: bookingIntervalSchema,
  buffers: bookingBuffersSchema,
  modality: consultationModalitySchema,
});
/** Client request contains neither actor, fee, end time, nor hold duration. */
export const holdBookingRequestSchema = z.strictObject({
  doctorId: bookingIdSchema,
  clinicId: bookingIdSchema,
  ownerId: bookingIdSchema,
  availabilityId: bookingIdSchema,
  expectedAvailabilityRevision: revisionSchema,
  modality: consultationModalitySchema,
  start: utcInstantSchema,
});

export const verifiedBookingPaymentSchema = z.strictObject({
  provider: z.literal("razorpay"),
  eventId: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
  paymentId: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
  orderId: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
  bookingId: bookingIdSchema,
  amountPaise: moneyPaiseSchema,
  currency: z.literal("INR"),
  // The adapter must verify signature AND reconcile captured payment/order/amount.
  verificationReference: bookingIdSchema,
  status: z.literal("captured"),
});
export const bookingPaymentRecordSchema = z.strictObject({
  payment: verifiedBookingPaymentSchema,
  disposition: z.enum(["applied", "rebook_or_refund_required"]),
});
export const bookingRecordSchema = z
  .strictObject({
    id: bookingIdSchema,
    revision: revisionSchema,
    ownerId: bookingIdSchema,
    state: bookingStateSchema,
    provenance: bookingProvenanceSchema,
    slot: bookingSlotSchema,
    fee: bookingFeeSnapshotSchema,
    policyId: bookingIdSchema,
    policyRevision: revisionSchema,
    createdAt: utcInstantSchema,
    holdExpiresAt: utcInstantSchema,
    paymentOrderId: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
    payments: z.array(bookingPaymentRecordSchema),
  })
  .superRefine((value, ctx) => {
    const invalid = (message: string) => ctx.addIssue({ code: "custom", message });
    if (
      !(value.createdAt < value.holdExpiresAt && value.holdExpiresAt <= value.slot.interval.start)
    ) {
      invalid("Hold expiry must be after creation and no later than the slot start");
    }
    if (
      value.fee.doctorId !== value.slot.doctorId ||
      value.fee.clinicId !== value.slot.clinicId ||
      value.fee.modality !== value.slot.modality ||
      value.fee.approvedPolicyId !== value.policyId
    )
      invalid("Fee snapshot must match the booking and policy");
    if (value.provenance.source === "front_desk" && value.slot.modality !== "in_clinic") {
      invalid("Front desk booking is an in-clinic appointment");
    }
    if (value.provenance.source === "online" && value.provenance.customerId !== value.ownerId) {
      invalid("Online source must match the owner");
    }
    if (
      new Set(value.payments.map((p) => p.payment.paymentId)).size !== value.payments.length ||
      new Set(value.payments.map((p) => p.payment.eventId)).size !== value.payments.length
    ) {
      invalid("Payment business identities and event identities must be unique");
    }
    const applied = value.payments.filter((p) => p.disposition === "applied");
    if (
      applied.length > 1 ||
      (value.state === "confirmed" && applied.length !== 1) ||
      ((value.state === "held" || value.state === "expired") && applied.length > 0)
    ) {
      invalid("Only one captured payment can confirm a booking");
    }
    for (const { payment, disposition } of value.payments) {
      if (payment.bookingId !== value.id) invalid("Payment must belong to this booking");
      if (
        disposition === "applied" &&
        (payment.orderId !== value.paymentOrderId ||
          payment.amountPaise !== value.fee.amountPaise ||
          payment.currency !== value.fee.currency)
      ) {
        invalid("Applied payment must match the authoritative order and fee");
      }
    }
  });

/** All values supplied by a reviewed server policy, never defaulted here. */
export const bookingPolicySchema = z.strictObject({
  id: bookingIdSchema,
  revision: revisionSchema,
  holdDurationMs: durationMsSchema.refine((value) => value > 0),
});
/** Construct only from current verified identity/scope; this is NOT an authentication API. */
export const bookingAuthoritySchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("customer"), customerId: bookingIdSchema }),
  z.strictObject({
    kind: z.literal("front_desk"),
    staffId: bookingIdSchema,
    clinicIds: z.array(bookingIdSchema).min(1),
    organizationVerified: z.literal(true),
    mfaVerified: z.literal(true),
  }),
  z.strictObject({ kind: z.literal("payment_service"), verificationReference: bookingIdSchema }),
  z.strictObject({ kind: z.literal("expiry_service") }),
]);

export const bookingActionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("expire") }),
  z.strictObject({ kind: z.literal("cancel") }),
  z.strictObject({ kind: z.literal("payment_captured"), payment: verifiedBookingPaymentSchema }),
]);

/** No unreviewed notes, recommendations or dose schedules are accepted or emitted. */
export const bookingClinicalFoundationSchema = z.strictObject({
  status: z.literal("unavailable"),
  reason: z.literal("REVIEWED_CLINICAL_POLICY_REQUIRED"),
});

export type BookingInterval = z.infer<typeof bookingIntervalSchema>;
export type BookingBuffers = z.infer<typeof bookingBuffersSchema>;
export type DoctorAvailability = z.infer<typeof doctorAvailabilitySchema>;
export type DoctorLeave = z.infer<typeof doctorLeaveSchema>;
export type BookingSlot = z.infer<typeof bookingSlotSchema>;
export type BookingFeeSnapshot = z.infer<typeof bookingFeeSnapshotSchema>;
export type HoldBookingRequest = z.infer<typeof holdBookingRequestSchema>;
export type BookingRecord = z.infer<typeof bookingRecordSchema>;
export type BookingPolicy = z.infer<typeof bookingPolicySchema>;
export type BookingAuthority = z.infer<typeof bookingAuthoritySchema>;
export type BookingAction = z.infer<typeof bookingActionSchema>;
export type VerifiedBookingPayment = z.infer<typeof verifiedBookingPaymentSchema>;
