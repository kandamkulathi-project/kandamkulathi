import { describe, expect, it, vi } from "vitest";
import {
  authorizeCommerceRequest,
  type CommerceIdentityDependencies,
} from "../../apps/core-api/src/commerce-authorization";
import type { CommerceGrant } from "../../packages/contracts/src/commerce-access";
import {
  after,
  before,
  customerFixture,
  ids,
  instant,
  now,
  physicianAuthority,
  physicianIdentity,
} from "./identity-fixtures";

const request = new Request("http://localhost/v1/orders", {
  headers: { "X-Role": "administrator", "X-Clinic-ID": ids.clinic },
});
const staffTarget = { kind: "staff", clinicId: ids.clinic, action: "orders:read" } as const;
const grant: CommerceGrant = {
  id: ids.other,
  actorId: ids.actor,
  membershipId: ids.membership,
  clinicId: ids.clinic,
  action: "orders:read",
  validFrom: before,
  expiresAt: after,
  revokedAt: null,
};
function fixture() {
  const identity = physicianIdentity();
  const authority = physicianAuthority();
  authority.memberships = authority.memberships.map((membership) => ({
    ...membership,
    workspace: "staff",
  }));
  const grants = [structuredClone(grant)];
  const dependencies: CommerceIdentityDependencies = {
    verifySession: vi.fn(async () => ({ status: "verified" as const, identity })),
    loadCurrentAuthority: vi.fn(async () => authority),
    loadCommerceGrants: vi.fn(async () => grants),
    now: () => now,
  };
  return { identity, authority, grants, dependencies };
}

describe("commerce current authorization", () => {
  it("requires explicit action, clinic and membership instead of trusting staff role or headers", async () => {
    const { dependencies, grants } = fixture();
    expect(await authorizeCommerceRequest(request, dependencies, staffTarget)).toMatchObject({
      allowed: true,
      actorId: ids.actor,
      sessionId: ids.session,
      clinicId: ids.clinic,
    });
    grants.length = 0;
    expect(await authorizeCommerceRequest(request, dependencies, staffTarget)).toMatchObject({
      status: 403,
    });
  });
  it.each([
    { actorId: ids.other },
    { membershipId: ids.other },
    { clinicId: ids.other },
    { action: "stock:read" as const },
    { validFrom: after },
    { expiresAt: instant },
    { revokedAt: before },
  ])("denies stale or mismatched grant %j", async (changes) => {
    const { dependencies, grants } = fixture();
    Object.assign(grants[0] ?? {}, changes);
    expect(await authorizeCommerceRequest(request, dependencies, staffTarget)).toMatchObject({
      status: 403,
    });
  });
  it("customer commerce requires current customer membership but not clinical consent", async () => {
    const { identity, authority } = customerFixture();
    authority.consents = authority.consents.filter((consent) => consent.purpose === "privacy");
    const dependencies = fixture().dependencies;
    dependencies.verifySession = async () => ({ status: "verified", identity });
    dependencies.loadCurrentAuthority = async () => authority;
    expect(
      await authorizeCommerceRequest(request, dependencies, { kind: "customer" }),
    ).toMatchObject({ allowed: true, actorId: ids.actor });
    expect(dependencies.loadCommerceGrants).not.toHaveBeenCalled();
    expect(await authorizeCommerceRequest(request, dependencies, staffTarget)).toMatchObject({
      status: 403,
    });
  });
  it.each([
    "expired",
    "revoked",
    "disabled",
    "privacy",
    "mfa",
    "organization",
    "clinic",
    "membership",
  ])("rechecks current %s", async (scenario) => {
    const { identity, authority, dependencies } = fixture();
    if (scenario === "expired") authority.sessionExpiresAt = instant;
    if (scenario === "revoked") authority.sessionRevokedAt = before;
    if (scenario === "disabled") authority.accountStatus = "disabled";
    if (scenario === "privacy") authority.consents = [];
    if (scenario === "mfa") identity.mfa = null;
    if (scenario === "organization") identity.organizationId = ids.other;
    const membership = authority.memberships[0];
    if (membership && scenario === "clinic") membership.clinicId = ids.other;
    if (membership && scenario === "membership") membership.revokedAt = before;
    expect(await authorizeCommerceRequest(request, dependencies, staffTarget)).toMatchObject({
      allowed: false,
    });
  });
  it("does not load authority or grants after authentication fails", async () => {
    const { dependencies } = fixture();
    dependencies.verifySession = async () => ({ status: "unauthenticated" });
    expect(await authorizeCommerceRequest(request, dependencies, staffTarget)).toMatchObject({
      status: 401,
    });
    expect(dependencies.loadCurrentAuthority).not.toHaveBeenCalled();
    expect(dependencies.loadCommerceGrants).not.toHaveBeenCalled();
  });
  it("fails unavailable without exposing storage exceptions or malformed grants", async () => {
    const { dependencies } = fixture();
    dependencies.loadCommerceGrants = async () => {
      throw new Error("secret database diagnostic");
    };
    expect(await authorizeCommerceRequest(request, dependencies, staffTarget)).toEqual({
      allowed: false,
      status: 503,
      code: "IDENTITY_UNAVAILABLE",
    });
    dependencies.loadCommerceGrants = async () => [{ ...grant, role: "admin" }];
    expect(await authorizeCommerceRequest(request, dependencies, staffTarget)).toMatchObject({
      status: 503,
    });
  });
});
