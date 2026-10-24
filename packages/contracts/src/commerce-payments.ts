import { z } from "zod";

export const paymentSubjectSchema = z
  .object({
    kind: z.enum(["order", "booking"]),
    id: z.uuid(),
  })
  .strict();
export const createPaymentSchema = z
  .object({
    operationId: z.uuid(),
    subject: paymentSubjectSchema,
    method: z.literal("razorpay"),
  })
  .strict();
export const refundRequestSchema = z
  .object({
    operationId: z.uuid(),
    intentId: z.uuid(),
    amountPaise: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
export const authoritativePaymentSchema = z
  .object({
    subject: paymentSubjectSchema,
    ownerId: z.uuid(),
    amountPaise: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    currency: z.literal("INR"),
    payable: z.boolean(),
    authorityRevision: z.number().int().positive().optional(),
  })
  .strict();
export type PaymentSubject = z.infer<typeof paymentSubjectSchema>;
export type CreatePayment = z.infer<typeof createPaymentSchema>;
export type RefundRequest = z.infer<typeof refundRequestSchema>;
export type AuthoritativePayment = z.infer<typeof authoritativePaymentSchema>;
export type PaymentState = "pending" | "creating" | "ready" | "unknown" | "captured" | "failed";
export type PaymentIntent = Omit<AuthoritativePayment, "payable"> & {
  id: string;
  operationId: string;
  accountId: string;
  state: PaymentState;
  providerOrderId: string | null;
};
export type ProviderOrder = {
  id: string;
  reference: string;
  amountPaise: number;
  currency: "INR";
};
export type VerifiedPaymentEvent = ProviderOrder & {
  eventId: string;
  digest: string;
  accountId: string;
  paymentId: string;
  outcome: "captured" | "failed";
};
export type ApprovedRefund = {
  version: string;
  approvedBy: string;
  /** Aggregate approved refund ceiling, including prior outstanding/processed requests. */
  maximumPaise: number;
};
/** Financial linkage only: the booking service owns expiry, rebooking and clinical mutation. */
export type BookingPaymentLink = {
  bookingId: string;
  intentId: string;
  operationId: string;
  outcome: "captured" | "refund_requested";
};
/** Phase 2 extension boundary; not authorization or an implemented recurring debit. */
export type MandatePaymentLink = {
  mandateId: string;
  cycleOperationId: string;
  intentId: string;
};
