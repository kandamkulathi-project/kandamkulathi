import type { BookingAuthority } from "@kandamkulathi/contracts/booking";
import { loadCurrentAuthorityInTransaction } from "@kandamkulathi/database/identity";
import { validateCurrentIdentity } from "@kandamkulathi/server/authorization";
import {
  type BookingAuthorityLoader,
  BookingRuntimeError,
} from "../../../packages/database/src/booking.ts";

/** Current workspace eligibility supplies candidate scope, never the separate booking action grant. */
export const loadBookingAuthority: BookingAuthorityLoader = async (context, identity) => {
  const authority = await loadCurrentAuthorityInTransaction(context.client, identity);
  const clock = await context.client.query<{ now: Date }>("SELECT clock_timestamp() AS now");
  const date = clock.rows[0]?.now;
  if (!date) throw new BookingRuntimeError("UNAVAILABLE");
  const now = date.getTime();
  const current = validateCurrentIdentity(identity, authority, now);
  if (!current.allowed)
    throw new BookingRuntimeError(current.status === 503 ? "UNAVAILABLE" : "DENIED");
  const memberships = current.authority.memberships.filter(
    (member) =>
      member.organizationId === identity.organizationId &&
      member.revokedAt === null &&
      Date.parse(member.validFrom) <= now &&
      Date.parse(member.expiresAt) > now &&
      member.actions.includes("workspace:enter"),
  );
  const customer = memberships.some((member) => member.workspace === "customer");
  const clinics = [
    ...new Set(
      memberships.flatMap((member) =>
        member.workspace === "staff" && member.clinicId !== null ? [member.clinicId] : [],
      ),
    ),
  ];
  const staff =
    clinics.length > 0 &&
    identity.organizationId !== null &&
    identity.mfa !== null &&
    Date.parse(identity.mfa.verifiedAt) <= now &&
    Date.parse(identity.mfa.expiresAt) > now;
  // An ambiguous session never silently chooses the broader staff capability.
  if (customer === staff) throw new BookingRuntimeError("DENIED");
  const candidate: BookingAuthority = customer
    ? { kind: "customer", customerId: identity.actorId }
    : {
        kind: "front_desk",
        staffId: identity.actorId,
        clinicIds: clinics,
        organizationVerified: true,
        mfaVerified: true,
      };
  // authorizeBookingInTransaction intersects this with separately locked action-specific grants.
  return candidate;
};
