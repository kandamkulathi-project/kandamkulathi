import { z } from "zod";
import { canonicalUuidSchema } from "./identifiers";

export const consentVersionSchema = z.string().trim().min(1).max(128);
const actorConsentScope = { actorId: canonicalUuidSchema };
const consultationConsentScope = {
  ...actorConsentScope,
  patientId: canonicalUuidSchema,
  clinicId: canonicalUuidSchema,
  consultationId: canonicalUuidSchema,
};
export const consentRequirementSchema = z.discriminatedUnion("purpose", [
  z.strictObject({
    purpose: z.literal("privacy"),
    version: consentVersionSchema,
    ...actorConsentScope,
  }),
  z.strictObject({
    purpose: z.literal("marketing"),
    version: consentVersionSchema,
    ...actorConsentScope,
  }),
  z.strictObject({
    purpose: z.literal("consultation"),
    version: consentVersionSchema,
    ...consultationConsentScope,
  }),
]);
const decisionFields = {
  id: canonicalUuidSchema,
  recordedByActorId: canonicalUuidSchema,
  decision: z.enum(["granted", "declined"]),
  decidedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable(),
};
/** Current authoritative decisions, never a client assertion or a persistence implementation. */
export const consentRecordSchema = z.discriminatedUnion("purpose", [
  z.strictObject({
    purpose: z.literal("privacy"),
    version: consentVersionSchema,
    ...actorConsentScope,
    ...decisionFields,
  }),
  z.strictObject({
    purpose: z.literal("marketing"),
    version: consentVersionSchema,
    ...actorConsentScope,
    ...decisionFields,
  }),
  z.strictObject({
    purpose: z.literal("consultation"),
    version: consentVersionSchema,
    ...consultationConsentScope,
    ...decisionFields,
  }),
]);
export type ConsentRequirement = z.infer<typeof consentRequirementSchema>;
export type ConsentRecord = z.infer<typeof consentRecordSchema>;
