import { z } from "zod";
import { canonicalUuidSchema } from "./identifiers.ts";
import { moneyPaiseSchema } from "./index.ts";

/** Public projection deliberately excludes account, owner and internal provider diagnostics. */
export const commercePaymentViewSchema = z.strictObject({
  intentId: canonicalUuidSchema,
  operationId: canonicalUuidSchema,
  subject: z.strictObject({ kind: z.enum(["order", "booking"]), id: canonicalUuidSchema }),
  amountPaise: moneyPaiseSchema,
  currency: z.literal("INR"),
  state: z.enum(["pending", "creating", "ready", "unknown", "captured", "failed"]),
  providerOrderId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,120}$/)
    .nullable(),
});
export type CommercePaymentView = z.infer<typeof commercePaymentViewSchema>;
export const commerceRefundViewSchema = z.strictObject({
  refundId: canonicalUuidSchema,
  status: z.literal("pending"),
});
export const commerceReconcileRequestSchema = z.strictObject({});
export const commerceWebhookViewSchema = z.strictObject({
  received: z.literal(true),
  disposition: z.enum(["applied", "duplicate"]),
});
export const commerceImportRequestSchema = z.strictObject({
  operationId: canonicalUuidSchema,
  rows: z.array(z.unknown()).min(1).max(10000),
  controls: z.strictObject({
    rows: z.number().int().positive().max(10000),
    units: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    baseValuePaise: moneyPaiseSchema,
  }),
});
export const commerceImportReportSchema = z.strictObject({
  valid: z.boolean(),
  errors: z
    .array(z.strictObject({ row: z.number().int().nonnegative(), code: z.string().min(1).max(80) }))
    .max(20000),
  totals: z.strictObject({
    rows: z.number().int().nonnegative(),
    units: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    baseValuePaise: moneyPaiseSchema,
  }),
});
