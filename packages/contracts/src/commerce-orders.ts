import { z } from "zod";
import { commerceDocumentReferenceSchema, orderSourceSchema } from "./commerce-access.ts";
import { deliveryAddressSchema } from "./commerce-address.ts";
import { canonicalUuidSchema } from "./identifiers.ts";
import { moneyPaiseSchema } from "./index.ts";

export const commerceOrderSummarySchema = z.strictObject({
  orderId: canonicalUuidSchema,
  locationId: canonicalUuidSchema,
  amountPaise: moneyPaiseSchema,
  currency: z.literal("INR"),
  status: z.enum(["reserved", "paid", "expired", "cancelled", "reconciliation_required"]),
  version: z.number().int().positive(),
  source: orderSourceSchema,
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});
export type CommerceOrderSummary = z.infer<typeof commerceOrderSummarySchema>;
export const commerceOrderLineSchema = z.strictObject({
  skuId: canonicalUuidSchema,
  quantity: z.number().int().min(1).max(1000),
  version: z.number().int().positive(),
  unitPaise: moneyPaiseSchema,
  taxPaise: moneyPaiseSchema,
  amountPaise: moneyPaiseSchema,
  taxPolicyId: canonicalUuidSchema,
});
export const commerceOrderDetailSchema = commerceOrderSummarySchema.extend({
  deliveryAddress: deliveryAddressSchema.nullable(),
  lines: z.array(commerceOrderLineSchema).min(1).max(100),
  documents: z.array(commerceDocumentReferenceSchema).max(100),
  fulfillment: z.literal("unavailable"),
});
export type CommerceOrderDetail = z.infer<typeof commerceOrderDetailSchema>;
export const commerceOrderPageSchema = z.strictObject({
  items: z.array(commerceOrderSummarySchema).max(100),
  nextCursor: canonicalUuidSchema.nullable(),
});
export type CommerceOrderPage = z.infer<typeof commerceOrderPageSchema>;
export const commerceBatchSchema = z.strictObject({
  batchId: canonicalUuidSchema,
  skuId: canonicalUuidSchema,
  locationId: canonicalUuidSchema,
  batchCode: z.string().min(1).max(80),
  expiresOn: z.iso.date(),
  recalled: z.boolean(),
  onHand: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
});
export const commerceBatchPageSchema = z.strictObject({
  items: z.array(commerceBatchSchema).max(100),
  nextCursor: canonicalUuidSchema.nullable(),
});
export type CommerceBatchPage = z.infer<typeof commerceBatchPageSchema>;
