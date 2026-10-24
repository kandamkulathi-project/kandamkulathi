import { z } from "zod";

// Proposed P1-DEV-003 boundary contracts. Backend/domain-owner review is still required.
const id = z.string().uuid();
const revision = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9._-]+$/);
const text = z.string().min(1).max(240);
export const referenceSchema = id;
export const securityContextSchema = z
  .object({
    userId: id,
    sessionId: id,
    expiresAt: z.iso.datetime(),
    csrfToken: z
      .string()
      .min(32)
      .max(256)
      .regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();
export type SecurityContext = z.infer<typeof securityContextSchema>;
export const consentSchema = z
  .object({
    signupVersion: revision,
    privacyVersion: revision,
    consultationVersion: revision,
    signupAccepted: z.boolean(),
    privacyAccepted: z.boolean(),
    consultationAccepted: z.boolean(),
    marketingAccepted: z.boolean(),
    signupText: z.string().min(1).max(6000),
    privacyText: z.string().min(1).max(6000),
    consultationText: z.string().min(1).max(6000),
  })
  .strict();
export type Consent = z.infer<typeof consentSchema>;
export const consentSubmissionSchema = consentSchema
  .omit({ signupText: true, privacyText: true, consultationText: true })
  .extend({
    signupAccepted: z.literal(true),
    privacyAccepted: z.literal(true),
  });
export const checkoutSchema = z
  .object({
    key: z.string().regex(/^rzp_(test|live)_[A-Za-z0-9]{4,80}$/),
    order_id: z.string().regex(/^order_[A-Za-z0-9]{4,100}$/),
    amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    currency: z.literal("INR"),
  })
  .strict();
export type Checkout = z.infer<typeof checkoutSchema>;
export const paymentSchema = z
  .object({
    id,
    revision,
    status: z.enum(["requires_payment", "pending", "paid", "failed", "cancelled", "expired"]),
    amountPaise: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    currency: z.literal("INR"),
    expiresAt: z.iso.datetime(),
    checkout: checkoutSchema.nullable(),
  })
  .strict()
  .refine(
    (value) =>
      value.checkout === null ||
      (value.status === "requires_payment" && value.checkout.amount === value.amountPaise),
    "Checkout must match the current payable amount",
  );
export type Payment = z.infer<typeof paymentSchema>;
export const providerReceiptSchema = z
  .object({
    razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]{4,100}$/),
    razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]{4,100}$/),
    razorpay_signature: z.string().regex(/^[a-fA-F0-9]{64}$/),
  })
  .strict();
export type ProviderReceipt = z.infer<typeof providerReceiptSchema>;
export const intakeQuestionSchema = z
  .object({
    id: z.enum(["age", "medication", "pregnancy", "child", "red_flags"]),
    label: text,
    required: z.boolean(),
  })
  .strict();
export const appointmentSchema = z
  .object({
    id,
    revision,
    role: z.enum(["customer", "physician", "staff"]),
    doctor: text,
    clinic: text,
    service: text,
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    holdExpiresAt: z.iso.datetime().nullable(),
    status: z.enum(["held", "payment_pending", "confirmed", "cancelled", "expired", "completed"]),
    identityVerified: z.boolean(),
    consentCurrent: z.boolean(),
    intake: z
      .object({
        policyVersion: revision,
        physicianApproved: z.boolean(),
        status: z.enum(["required", "accepted", "handoff"]),
        questions: z.array(intakeQuestionSchema).max(5),
      })
      .strict(),
  })
  .strict()
  .refine(
    (value) => Date.parse(value.endsAt) > Date.parse(value.startsAt),
    "Invalid appointment window",
  )
  .refine(
    (value) =>
      new Set(value.intake.questions.map((q) => q.id)).size === value.intake.questions.length,
    "Duplicate question",
  );
export type Appointment = z.infer<typeof appointmentSchema>;
export const intakeSubmissionSchema = z
  .object({
    revision,
    policyVersion: revision,
    answers: z
      .array(
        z
          .object({
            id: intakeQuestionSchema.shape.id,
            value: z.string().trim().min(1).max(500),
            disposition: z.enum(["answered", "unknown", "declined"]),
          })
          .strict(),
      )
      .max(5),
  })
  .strict()
  .refine(
    (value) => new Set(value.answers.map((a) => a.id)).size === value.answers.length,
    "Duplicate answer",
  );
export type IntakeSubmission = z.infer<typeof intakeSubmissionSchema>;
export const videoGrantSchema = z
  .object({
    appointmentId: id,
    revision,
    expiresAt: z.iso.datetime(),
    ticket: z
      .string()
      .min(32)
      .max(2048)
      .regex(/^[A-Za-z0-9._-]+$/),
  })
  .strict();
export type VideoGrant = z.infer<typeof videoGrantSchema>;
export const signInSchema = z.object({ redirectPath: z.literal("/v1/auth/authorize") }).strict();
export const logoutSchema = z.object({ revoked: z.literal(true) }).strict();
