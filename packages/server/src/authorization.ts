import { type ClientSession, workspaceNames } from "@kandamkulathi/contracts/client";
import {
  authorizationRequestSchema,
  type CurrentAuthority,
  currentAuthoritySchema,
  type VerifiedIdentity,
  verifiedIdentitySchema,
} from "@kandamkulathi/contracts/identity";
import { hasCurrentConsent } from "./authorization-consent";

export type IdentityDenial =
  | { allowed: false; status: 401; code: "UNAUTHENTICATED" }
  | { allowed: false; status: 403; code: "FORBIDDEN" }
  | { allowed: false; status: 503; code: "IDENTITY_UNAVAILABLE" };
export const identityUnavailable = (): IdentityDenial => ({
  allowed: false,
  status: 503,
  code: "IDENTITY_UNAVAILABLE",
});
export const unauthenticated = (): IdentityDenial => ({
  allowed: false,
  status: 401,
  code: "UNAUTHENTICATED",
});
const forbidden = (): IdentityDenial => ({ allowed: false, status: 403, code: "FORBIDDEN" });

type CurrentIdentity = {
  allowed: true;
  identity: VerifiedIdentity;
  authority: CurrentAuthority;
};
function validateIdentitySession(
  identityInput: unknown,
  authorityInput: unknown,
  now: number,
): CurrentIdentity | IdentityDenial {
  const identity = verifiedIdentitySchema.safeParse(identityInput);
  const authority = currentAuthoritySchema.safeParse(authorityInput);
  if (!identity.success || !authority.success || !Number.isFinite(now))
    return identityUnavailable();
  const verified = identity.data;
  const current = authority.data;
  if (verified.actorId !== current.actorId || verified.sessionId !== current.sessionId) {
    return identityUnavailable();
  }
  if (
    Date.parse(verified.authenticatedAt) > now ||
    Date.parse(verified.expiresAt) <= now ||
    Date.parse(current.sessionExpiresAt) <= now ||
    current.sessionRevokedAt !== null
  ) {
    return unauthenticated();
  }
  if (current.accountStatus !== "active") return forbidden();
  return { allowed: true, identity: verified, authority: current };
}

export function validateCurrentIdentity(
  identityInput: unknown,
  authorityInput: unknown,
  now: number,
): CurrentIdentity | IdentityDenial {
  const result = validateIdentitySession(identityInput, authorityInput, now);
  if (!result.allowed) return result;
  const { identity: verified, authority: current } = result;
  if (
    !hasCurrentConsent(
      current.consents,
      { purpose: "privacy", version: current.privacyVersion, actorId: verified.actorId },
      now,
    )
  ) {
    return forbidden();
  }
  return { allowed: true, identity: verified, authority: current };
}

function active(
  window: { validFrom: string; expiresAt: string; revokedAt: string | null },
  now: number,
): boolean {
  return (
    window.revokedAt === null &&
    Date.parse(window.validFrom) <= now &&
    Date.parse(window.expiresAt) > now
  );
}

function eligibleMemberships(current: CurrentIdentity, now: number) {
  return current.authority.memberships.filter((membership) => {
    if (!active(membership, now)) return false;
    if (membership.organizationId !== current.identity.organizationId) return false;
    if (membership.workspace === "customer") return true;
    const mfa = current.identity.mfa;
    return mfa !== null && Date.parse(mfa.verifiedAt) <= now && Date.parse(mfa.expiresAt) > now;
  });
}

/** Eligibility ONLY for the dedicated consent bootstrap. This grants no workspace
 * or domain access; normal authorization still requires current privacy consent.
 * The bootstrap must independently require missing consent and approved policy text.
 */
export function evaluateConsentBootstrapEligibility(
  identityInput: unknown,
  authorityInput: unknown,
  now: number,
): { allowed: true } | IdentityDenial {
  const current = validateIdentitySession(identityInput, authorityInput, now);
  if (!current.allowed) return current;
  return eligibleMemberships(current, now).some((member) =>
    member.actions.includes("workspace:enter"),
  )
    ? { allowed: true }
    : forbidden();
}

/** Explicit current grants only. Every private scope additionally needs self-link or assignment. */
export function authorizeAccess(
  identityInput: unknown,
  authorityInput: unknown,
  requestInput: unknown,
  now: number,
): { allowed: true } | IdentityDenial {
  const request = authorizationRequestSchema.safeParse(requestInput);
  if (!request.success) return forbidden();
  const current = validateCurrentIdentity(identityInput, authorityInput, now);
  if (!current.allowed) return current;
  const target = request.data;
  const memberships = eligibleMemberships(current, now).filter(
    (membership) =>
      membership.workspace === target.workspace &&
      membership.actions.includes("workspace:enter") &&
      membership.actions.includes(target.action),
  );
  if (target.action === "workspace:enter") {
    return memberships.length > 0 ? { allowed: true } : forbidden();
  }
  for (const membership of memberships) {
    if (membership.clinicId !== target.clinicId) continue;
    const assignment = current.authority.assignments.find(
      (entry) =>
        entry.membershipId === membership.id &&
        entry.patientId === target.patientId &&
        entry.clinicId === target.clinicId &&
        entry.consultationId === target.consultationId &&
        entry.actions.includes(target.action) &&
        active(entry, now),
    );
    const isSelf =
      membership.workspace === "customer" &&
      current.authority.selfPatientLinks.some(
        (link) => link.patientId === target.patientId && active(link, now),
      );
    // Staff cannot substitute their own patient link for an assigned patient relationship.
    if (!isSelf && (membership.workspace === "customer" || !assignment)) continue;
    const patientActorId = isSelf ? current.identity.actorId : assignment?.patientActorId;
    if (
      hasCurrentConsent(
        current.authority.consents,
        {
          purpose: "consultation",
          version: current.authority.consultationConsentVersion,
          actorId: patientActorId,
          patientId: target.patientId,
          clinicId: target.clinicId,
          consultationId: target.consultationId,
        },
        now,
      )
    ) {
      return { allowed: true };
    }
  }
  return forbidden();
}

/** Deliberately excludes provider IDs, organizations, roles, patient IDs and consent history. */
export function projectSession(
  identityInput: unknown,
  authorityInput: unknown,
  now: number,
): { allowed: true; session: ClientSession } | IdentityDenial {
  const current = validateCurrentIdentity(identityInput, authorityInput, now);
  if (!current.allowed) return current;
  const memberships = eligibleMemberships(current, now);
  const workspaces = workspaceNames.filter((workspace) =>
    memberships.some(
      (membership) =>
        membership.workspace === workspace && membership.actions.includes("workspace:enter"),
    ),
  );
  if (workspaces.length === 0) return forbidden();
  return {
    allowed: true,
    session: {
      userId: current.identity.actorId,
      expiresAt: new Date(
        Math.min(
          Date.parse(current.identity.expiresAt),
          Date.parse(current.authority.sessionExpiresAt),
        ),
      ).toISOString(),
      workspaces,
    },
  };
}
