import type { ConsentRecord } from "../../packages/contracts/src/consent";
import type {
  AuthorizationRequest,
  CurrentAuthority,
  VerifiedIdentity,
} from "../../packages/contracts/src/identity";

// Deterministic synthetic authority only; not WorkOS, PostgreSQL, RLS or clinical-policy evidence.
export const ids = {
  actor: "a1111111-a111-4111-8111-111111111111",
  session: "b2222222-b222-4222-8222-222222222222",
  organization: "c3333333-c333-4333-8333-333333333333",
  clinic: "d4444444-d444-4444-8444-444444444444",
  patient: "e5555555-e555-4555-8555-555555555555",
  consultation: "f6666666-f666-4666-8666-666666666666",
  membership: "a7777777-a777-4777-8777-777777777777",
  assignment: "b8888888-b888-4888-8888-888888888888",
  patientActor: "c9999999-c999-4999-8999-999999999999",
  other: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
} as const;
export const before = "2026-10-23T09:00:00.000Z";
export const instant = "2026-10-23T10:00:00.000Z";
export const after = "2026-10-23T11:00:00.000Z";
export const now = Date.parse(instant);
const window = { validFrom: before, expiresAt: after, revokedAt: null };

export function privacyConsent(
  actorId: string = ids.actor,
): Extract<ConsentRecord, { purpose: "privacy" }> {
  return {
    id: ids.other,
    purpose: "privacy",
    actorId,
    recordedByActorId: actorId,
    version: "privacy-v1",
    decision: "granted",
    decidedAt: before,
    expiresAt: null,
    revokedAt: null,
  };
}
export function consultationConsent(
  actorId: string = ids.patientActor,
): Extract<ConsentRecord, { purpose: "consultation" }> {
  return {
    ...privacyConsent(actorId),
    id: ids.consultation,
    purpose: "consultation",
    patientId: ids.patient,
    clinicId: ids.clinic,
    consultationId: ids.consultation,
    version: "consultation-v1",
  };
}
export function physicianIdentity(): VerifiedIdentity {
  return {
    actorId: ids.actor,
    sessionId: ids.session,
    organizationId: ids.organization,
    authenticatedAt: before,
    expiresAt: after,
    mfa: { verifiedAt: before, expiresAt: after },
  };
}
export function physicianAuthority(): CurrentAuthority {
  return {
    actorId: ids.actor,
    sessionId: ids.session,
    accountStatus: "active",
    sessionExpiresAt: after,
    sessionRevokedAt: null,
    privacyVersion: "privacy-v1",
    consultationConsentVersion: "consultation-v1",
    memberships: [
      {
        id: ids.membership,
        workspace: "physician",
        organizationId: ids.organization,
        clinicId: ids.clinic,
        actions: ["workspace:enter", "clinical:read", "consultation:join"],
        ...window,
      },
    ],
    selfPatientLinks: [],
    assignments: [
      {
        id: ids.assignment,
        membershipId: ids.membership,
        patientId: ids.patient,
        patientActorId: ids.patientActor,
        clinicId: ids.clinic,
        consultationId: ids.consultation,
        actions: ["clinical:read", "consultation:join"],
        ...window,
      },
    ],
    consents: [privacyConsent(), consultationConsent()],
  };
}
export function customerFixture() {
  const identity = { ...physicianIdentity(), organizationId: null, mfa: null };
  const authority = physicianAuthority();
  authority.memberships = authority.memberships.map((membership) => ({
    ...membership,
    workspace: "customer",
    organizationId: null,
  }));
  authority.assignments = [];
  authority.selfPatientLinks = [{ patientId: ids.patient, ...window }];
  authority.consents = [privacyConsent(), consultationConsent(ids.actor)];
  return { identity, authority };
}
export function clinicalRequest(): AuthorizationRequest {
  return {
    action: "clinical:read",
    workspace: "physician",
    patientId: ids.patient,
    clinicId: ids.clinic,
    consultationId: ids.consultation,
  };
}
