import { z } from "zod";
import { workspaceSchema } from "./client";
import { consentRecordSchema, consentVersionSchema } from "./consent";
import { canonicalUuidSchema } from "./identifiers";

export const authorityWindowShape = {
  validFrom: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  revokedAt: z.iso.datetime().nullable(),
};
export const accessActionSchema = z.enum(["workspace:enter", "clinical:read", "consultation:join"]);
export type AccessAction = z.infer<typeof accessActionSchema>;
/** Internal normalized identity, NOT a definition of WorkOS token claims. */
export const verifiedIdentitySchema = z.strictObject({
  actorId: canonicalUuidSchema,
  sessionId: canonicalUuidSchema,
  organizationId: canonicalUuidSchema.nullable(),
  authenticatedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  mfa: z.strictObject({ verifiedAt: z.iso.datetime(), expiresAt: z.iso.datetime() }).nullable(),
});
export type VerifiedIdentity = z.infer<typeof verifiedIdentitySchema>;

export const accessMembershipSchema = z
  .strictObject({
    id: canonicalUuidSchema,
    workspace: workspaceSchema,
    organizationId: canonicalUuidSchema.nullable(),
    clinicId: canonicalUuidSchema.nullable(),
    actions: z.array(accessActionSchema).max(3),
    ...authorityWindowShape,
  })
  .refine(
    (value) =>
      value.workspace === "customer" || (value.organizationId !== null && value.clinicId !== null),
    "Staff access requires an organization and clinic.",
  );
export const clinicalAssignmentSchema = z.strictObject({
  id: canonicalUuidSchema,
  membershipId: canonicalUuidSchema,
  patientId: canonicalUuidSchema,
  patientActorId: canonicalUuidSchema,
  clinicId: canonicalUuidSchema,
  consultationId: canonicalUuidSchema,
  actions: z.array(accessActionSchema.exclude(["workspace:enter"])).max(2),
  ...authorityWindowShape,
});
export const selfPatientLinkSchema = z.strictObject({
  patientId: canonicalUuidSchema,
  ...authorityWindowShape,
});
/** Reload for each request; no role labels, implicit administrator powers or client grants. */
export const currentAuthoritySchema = z.strictObject({
  actorId: canonicalUuidSchema,
  sessionId: canonicalUuidSchema,
  accountStatus: z.enum(["active", "disabled"]),
  sessionExpiresAt: z.iso.datetime(),
  sessionRevokedAt: z.iso.datetime().nullable(),
  privacyVersion: consentVersionSchema,
  consultationConsentVersion: consentVersionSchema,
  memberships: z.array(accessMembershipSchema).max(100),
  selfPatientLinks: z.array(selfPatientLinkSchema).max(100),
  assignments: z.array(clinicalAssignmentSchema).max(1000),
  consents: z.array(consentRecordSchema).max(1000),
});
export type CurrentAuthority = z.infer<typeof currentAuthoritySchema>;
export const authorizationRequestSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("workspace:enter"), workspace: workspaceSchema }),
  ...(["clinical:read", "consultation:join"] as const).map((action) =>
    z.strictObject({
      action: z.literal(action),
      workspace: workspaceSchema,
      patientId: canonicalUuidSchema,
      clinicId: canonicalUuidSchema,
      consultationId: canonicalUuidSchema,
    }),
  ),
]);
export type AuthorizationRequest = z.infer<typeof authorizationRequestSchema>;
