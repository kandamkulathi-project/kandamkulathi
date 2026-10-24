import { z } from "zod";
import { paymentSubjectSchema } from "./commerce-payments";

/** Public SDK launch data only; never provider credentials, ownership or patient data. */
export const commercePaymentCheckoutSchema = z
  .object({
    keyId: z.string().regex(/^rzp_test_[A-Za-z0-9]{1,80}$/),
    providerOrderId: z.string().regex(/^order_[A-Za-z0-9]{1,80}$/),
    amountPaise: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    currency: z.literal("INR"),
    intentId: z.uuid(),
    operationId: z.uuid(),
    subject: paymentSubjectSchema,
  })
  .strict();

export type CommercePaymentCheckout = z.infer<typeof commercePaymentCheckoutSchema>;
