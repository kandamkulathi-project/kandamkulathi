import { z } from "zod";
import { consentRequirementSchema } from "./consent";
import { canonicalUuidSchema } from "./identifiers";

/** Text is preserved byte-for-byte: no trim, markdown conversion or invented copy. */
export const approvedPrivacyPolicySchema = z.strictObject({
  text: z.string().min(1).max(65536),
  revision: z.string().min(1).max(128),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  approvalReference: z.string().min(1).max(1024),
});

/** Not a ClientSession and never a grant to enter a workspace. */
export const consentBootstrapSchema = z
  .strictObject({
    actorId: canonicalUuidSchema,
    sessionId: canonicalUuidSchema,
    expiresAt: z.iso.datetime(),
    requirement: consentRequirementSchema.options[0],
    policy: approvedPrivacyPolicySchema,
  })
  .refine((value) => value.actorId === value.requirement.actorId, "Consent subject mismatch");
export type ConsentBootstrap = z.infer<typeof consentBootstrapSchema>;
