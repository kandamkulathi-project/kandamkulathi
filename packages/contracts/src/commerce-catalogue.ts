import { z } from "zod";
import { deliveryAddressSchema } from "./commerce-address.ts";

export const paiseSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const cartSchema = z
  .strictObject({
    locationId: z.uuid(),
    lines: z
      .array(z.strictObject({ skuId: z.uuid(), quantity: z.number().int().min(1).max(1000) }))
      .min(1)
      .max(100),
  })
  .refine(
    (cart) => new Set(cart.lines.map((line) => line.skuId)).size === cart.lines.length,
    "Duplicate SKU",
  );
export const checkoutSchema = z
  .strictObject({
    ...cartSchema.shape,
    deliveryAddress: deliveryAddressSchema,
    operationId: z.uuid(),
    confirmed: z.literal(true),
    quoteKey: z.string().min(1).max(50000),
    versions: z.record(z.string(), z.number().int().positive()),
  })
  .refine(
    (cart) => new Set(cart.lines.map((line) => line.skuId)).size === cart.lines.length,
    "Duplicate SKU",
  );
export type CartInput = z.infer<typeof cartSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export const pricedLineSchema = z.strictObject({
  skuId: z.uuid(),
  quantity: z.number().int().min(1).max(1000),
  version: z.number().int().positive(),
  unitPaise: paiseSchema,
  taxPaise: paiseSchema,
  amountPaise: paiseSchema,
  taxPolicyId: z.uuid(),
  rateBps: z.number().int().min(0).max(10000),
});
export type PricedLine = z.infer<typeof pricedLineSchema>;
export const commerceQuoteSchema = z.strictObject({
  lines: z.array(pricedLineSchema).min(1).max(100),
  amountPaise: paiseSchema,
  currency: z.literal("INR"),
  quoteKey: z.string().min(1).max(50000),
});
export type CommerceQuote = z.infer<typeof commerceQuoteSchema>;
export const commerceCheckoutSchema = z.strictObject({
  orderId: z.uuid(),
  amountPaise: paiseSchema,
  currency: z.literal("INR"),
  status: z.literal("reserved"),
  expiresAt: z.iso.datetime(),
});
export type CommerceCheckout = z.infer<typeof commerceCheckoutSchema>;
export const commerceProductSchema = z.strictObject({
  skuId: z.uuid(),
  sku: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  variant: z.string().min(1).max(120),
  description: z.string().max(10000),
  imageUrl: z.url().refine((value) => value.startsWith("https://")),
  concerns: z.array(z.string().min(1).max(80)).max(30),
  unitPaise: paiseSchema,
  version: z.number().int().positive(),
  consultOnly: z.boolean(),
  stockStatus: z.enum(["available", "unavailable", "unknown"]),
});
export type CommerceProduct = z.infer<typeof commerceProductSchema>;
export const commerceCataloguePageSchema = z.strictObject({
  items: z.array(commerceProductSchema).max(100),
  nextCursor: z.uuid().nullable(),
});
export type CommerceCataloguePage = z.infer<typeof commerceCataloguePageSchema>;
export const openingRowSchema = z.strictObject({
  skuId: z.uuid(),
  sku: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  variant: z.string().trim().min(1).max(120),
  description: z.string().max(10000),
  imageUrl: z.url().refine((value) => value.startsWith("https://")),
  concerns: z.array(z.string().min(1).max(80)).max(30),
  approvedBy: z.uuid(),
  consultOnly: z.boolean(),
  unitPaise: paiseSchema,
  taxPolicyId: z.uuid(),
  locationId: z.uuid(),
  batchId: z.uuid(),
  batchCode: z.string().min(1).max(80),
  expiresOn: z.iso.date(),
  quantity: z.number().int().positive().max(1000000),
  minimumShelfLifeDays: z.number().int().nonnegative().max(3650),
});
export type OpeningRow = z.infer<typeof openingRowSchema>;
export type ImportReport = {
  valid: boolean;
  errors: { row: number; code: string }[];
  totals: { rows: number; units: number; baseValuePaise: number };
};
export type ImportControls = ImportReport["totals"];
export class CommerceError extends Error {
  readonly code:
    | "invalid_input"
    | "denied"
    | "stale_version"
    | "unavailable"
    | "stock_shortage"
    | "operation_conflict"
    | "retry_exhausted";
  constructor(code: CommerceError["code"]) {
    super(code);
    this.code = code;
  }
}
