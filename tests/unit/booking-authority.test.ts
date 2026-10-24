import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadBookingAuthority } from "../../apps/core-api/src/booking-authority";
import type { DatabaseContext } from "../../packages/database/src/client";
import { loadCurrentAuthorityInTransaction } from "../../packages/database/src/identity";
import {
  customerFixture,
  ids,
  instant,
  physicianAuthority,
  physicianIdentity,
} from "./identity-fixtures";

vi.mock("../../packages/database/src/identity", () => ({
  loadCurrentAuthorityInTransaction: vi.fn(),
}));
const context = {
  client: { query: vi.fn(async () => ({ rows: [{ now: new Date(instant) }] })) },
} as unknown as DatabaseContext;
function staffAuthority() {
  const authority = physicianAuthority();
  const member = authority.memberships[0];
  if (!member) throw new Error("Synthetic membership fixture missing");
  member.workspace = "staff";
  return authority;
}
describe("current identity to booking candidate scope", () => {
  beforeEach(() => vi.clearAllMocks());
  it("derives self scope from current eligible customer identity, not request IDs", async () => {
    const { identity, authority } = customerFixture();
    vi.mocked(loadCurrentAuthorityInTransaction).mockResolvedValue(authority);
    expect(await loadBookingAuthority(context, identity)).toEqual({
      kind: "customer",
      customerId: ids.actor,
    });
    expect(loadCurrentAuthorityInTransaction).toHaveBeenCalledWith(context.client, identity);
  });
  it("derives candidate staff clinics only with organization and live independent MFA", async () => {
    const authority = staffAuthority();
    vi.mocked(loadCurrentAuthorityInTransaction).mockResolvedValue(authority);
    expect(await loadBookingAuthority(context, physicianIdentity())).toMatchObject({
      kind: "front_desk",
      clinicIds: [ids.clinic],
      organizationVerified: true,
      mfaVerified: true,
    });
    await expect(
      loadBookingAuthority(context, { ...physicianIdentity(), mfa: null }),
    ).rejects.toMatchObject({ code: "DENIED" });
  });
  it("denies revoked sessions and physician workspace rather than inferring front-desk permission", async () => {
    const authority = physicianAuthority();
    vi.mocked(loadCurrentAuthorityInTransaction).mockResolvedValue(authority);
    await expect(loadBookingAuthority(context, physicianIdentity())).rejects.toMatchObject({
      code: "DENIED",
    });
    authority.sessionRevokedAt = instant;
    const member = authority.memberships[0];
    if (!member) throw new Error("Synthetic membership fixture missing");
    member.workspace = "staff";
    await expect(loadBookingAuthority(context, physicianIdentity())).rejects.toMatchObject({
      code: "DENIED",
    });
  });
  it("does not silently choose broader staff scope from an ambiguous mixed session", async () => {
    const authority = staffAuthority();
    const member = authority.memberships[0];
    if (!member) throw new Error("Synthetic membership fixture missing");
    authority.memberships.push({
      ...member,
      id: ids.other,
      workspace: "customer",
    });
    vi.mocked(loadCurrentAuthorityInTransaction).mockResolvedValue(authority);
    await expect(loadBookingAuthority(context, physicianIdentity())).rejects.toMatchObject({
      code: "DENIED",
    });
  });
});
