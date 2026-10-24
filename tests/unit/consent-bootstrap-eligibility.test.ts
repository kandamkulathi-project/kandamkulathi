import { describe, expect, it } from "vitest";
import {
  evaluateConsentBootstrapEligibility,
  projectSession,
  validateCurrentIdentity,
} from "../../packages/server/src/authorization";
import { ids, instant, now, physicianAuthority, physicianIdentity } from "./identity-fixtures";

describe("dedicated preprivacy eligibility does not loosen normal authorization", () => {
  it("permits only bootstrap eligibility without projecting a session or granting normal access", () => {
    const identity = physicianIdentity();
    const authority = physicianAuthority();
    authority.consents = [];
    expect(evaluateConsentBootstrapEligibility(identity, authority, now)).toEqual({
      allowed: true,
    });
    expect(validateCurrentIdentity(identity, authority, now)).toMatchObject({
      allowed: false,
      status: 403,
    });
    expect(projectSession(identity, authority, now)).toMatchObject({ allowed: false, status: 403 });
  });
  it("retains account, actor, expiry, revocation, organization, membership and independent MFA denials", () => {
    const identity = physicianIdentity();
    const authority = physicianAuthority();
    authority.consents = [];
    for (const bad of [
      { ...authority, accountStatus: "disabled" },
      { ...authority, sessionRevokedAt: instant },
      { ...authority, sessionExpiresAt: instant },
      { ...authority, actorId: ids.other },
      { ...authority, memberships: [] },
      {
        ...authority,
        memberships: authority.memberships.map((member) => ({ ...member, revokedAt: instant })),
      },
      {
        ...authority,
        memberships: authority.memberships.map((member) => ({ ...member, actions: [] })),
      },
    ])
      expect(evaluateConsentBootstrapEligibility(identity, bad, now).allowed).toBe(false);
    expect(
      evaluateConsentBootstrapEligibility(
        { ...identity, organizationId: ids.other },
        authority,
        now,
      ).allowed,
    ).toBe(false);
    expect(
      evaluateConsentBootstrapEligibility({ ...identity, mfa: null }, authority, now).allowed,
    ).toBe(false);
    expect(
      evaluateConsentBootstrapEligibility(
        { ...identity, mfa: { verifiedAt: instant, expiresAt: instant } },
        authority,
        now,
      ).allowed,
    ).toBe(false);
  });
});
