import { z } from "zod";
import { canonicalUuidSchema } from "./identifiers.ts";
import { authorityWindowShape } from "./identity.ts";

/** Explicit authoritative grants, not role labels or client-provided scopes. */
export const commerceActionSchema = z.enum([
  "orders:read",
  "stock:read",
  "catalogue:import",
  "refunds:request",
]);
export type CommerceAction = z.infer<typeof commerceActionSchema>;
export const commerceGrantSchema = z.strictObject({
  id: canonicalUuidSchema,
  actorId: canonicalUuidSchema,
  membershipId: canonicalUuidSchema,
  clinicId: canonicalUuidSchema,
  action: commerceActionSchema,
  ...authorityWindowShape,
});
export const commerceGrantsSchema = z.array(commerceGrantSchema).max(500);
export type CommerceGrant = z.infer<typeof commerceGrantSchema>;

/** Bounded keyset pagination: UUIDs are opaque references, never access credentials. */
export const commercePageSchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  after: canonicalUuidSchema.optional(),
});
export type CommercePage = z.infer<typeof commercePageSchema>;

export const orderSourceSchema = z.enum(["web", "native", "phone", "walk_in", "whatsapp"]);
export type OrderSource = z.infer<typeof orderSourceSchema>;

/** No public invoice/tracking bearer URL is part of the order projection. */
export const commerceDocumentReferenceSchema = z.strictObject({
  id: canonicalUuidSchema,
  kind: z.enum(["invoice", "credit_note", "return", "shipment"]),
  status: z.enum(["pending", "ready", "failed", "reconciliation_required"]),
  version: z.number().int().positive(),
});
export type CommerceDocumentReference = z.infer<typeof commerceDocumentReferenceSchema>;
