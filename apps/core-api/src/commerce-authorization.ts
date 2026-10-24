import {
  type IdentityDenial,
  identityUnavailable,
  unauthenticated,
  validateCurrentIdentity,
} from "@kandamkulathi/server/authorization";
import type { IdentityDependencies } from "@kandamkulathi/server/identity";
import {
  type CommerceAction,
  commerceGrantsSchema,
} from "../../../packages/contracts/src/commerce-access";
import {
  type VerifiedIdentity,
  verifiedIdentitySchema,
} from "../../../packages/contracts/src/identity";

export interface CommerceIdentityDependencies extends IdentityDependencies {
  /** Reload explicit commerce grants from trusted storage on every staff request. */
  loadCommerceGrants(actorId: string): Promise<unknown>;
}

export type CommercePrincipal = {
  allowed: true;
  actorId: string;
  sessionId: string;
  clinicId: string | null;
  identity: VerifiedIdentity;
  action: CommerceAction | null;
  directory?: true;
};
export type CommerceTarget =
  | { kind: "customer" }
  | { kind: "staff_directory" }
  | { kind: "staff"; clinicId: string; action: CommerceAction };
export class CommerceAuthorityError extends Error {
  constructor(readonly denial: IdentityDenial) {
    super(denial.code);
  }
}

const forbidden = (): IdentityDenial => ({ allowed: false, status: 403, code: "FORBIDDEN" });
const active = (
  value: { validFrom: string; expiresAt: string; revokedAt: string | null },
  now: number,
) =>
  value.revokedAt === null &&
  Date.parse(value.validFrom) <= now &&
  Date.parse(value.expiresAt) > now;

/** Uses shared current identity/required privacy consent; ordinary commerce is not clinical access. */
export async function authorizeCommerceRequest(
  request: Request,
  dependencies: CommerceIdentityDependencies,
  target: CommerceTarget,
): Promise<CommercePrincipal | IdentityDenial> {
  try {
    const verification = await dependencies.verifySession(request);
    if (verification.status === "unauthenticated") return unauthenticated();
    if (verification.status !== "verified") return identityUnavailable();
    const identity = verifiedIdentitySchema.safeParse(verification.identity);
    if (!identity.success) return identityUnavailable();
    const now = (dependencies.now ?? Date.now)();
    const current = validateCurrentIdentity(
      identity.data,
      await dependencies.loadCurrentAuthority(identity.data),
      now,
    );
    if (!current.allowed) return current;
    const grants =
      target.kind !== "customer"
        ? await dependencies.loadCommerceGrants(current.identity.actorId)
        : [];
    return evaluateCommerceAuthority(current, target, grants, now);
  } catch {
    return identityUnavailable();
  }
}

/** Shared pure decision reused after SQL row locks; no second provider/network lookup in transactions. */
export function evaluateCommerceAuthority(
  current: Extract<ReturnType<typeof validateCurrentIdentity>, { allowed: true }>,
  target: CommerceTarget,
  grantInput: unknown,
  now: number,
): CommercePrincipal | IdentityDenial {
  const memberships = current.authority.memberships.filter(
    (membership) =>
      active(membership, now) &&
      membership.actions.includes("workspace:enter") &&
      membership.organizationId === current.identity.organizationId,
  );
  if (target.kind === "customer") {
    return memberships.some((membership) => membership.workspace === "customer")
      ? {
          allowed: true,
          actorId: current.identity.actorId,
          sessionId: current.identity.sessionId,
          clinicId: null,
          identity: current.identity,
          action: null,
        }
      : forbidden();
  }
  const mfa = current.identity.mfa;
  if (!mfa || Date.parse(mfa.verifiedAt) > now || Date.parse(mfa.expiresAt) <= now)
    return forbidden();
  const grants = commerceGrantsSchema.safeParse(grantInput);
  if (!grants.success) return identityUnavailable();
  if (target.kind === "staff_directory") {
    return memberships.some(
      (membership) => membership.workspace === "staff" && membership.organizationId !== null,
    )
      ? {
          allowed: true,
          actorId: current.identity.actorId,
          sessionId: current.identity.sessionId,
          identity: current.identity,
          clinicId: null,
          action: null,
          directory: true,
        }
      : forbidden();
  }
  const permitted = grants.data.some(
    (grant) =>
      grant.actorId === current.identity.actorId &&
      grant.clinicId === target.clinicId &&
      grant.action === target.action &&
      active(grant, now) &&
      memberships.some(
        (membership) =>
          membership.id === grant.membershipId &&
          membership.workspace === "staff" &&
          membership.organizationId !== null &&
          membership.clinicId === target.clinicId,
      ),
  );
  return permitted
    ? {
        allowed: true,
        actorId: current.identity.actorId,
        sessionId: current.identity.sessionId,
        clinicId: target.clinicId,
        identity: current.identity,
        action: target.action,
      }
    : forbidden();
}
