import { validateCurrentIdentity } from "@kandamkulathi/server/authorization";
import { commerceActionSchema } from "../../../packages/contracts/src/commerce-access";
import { CommerceError } from "../../../packages/contracts/src/commerce-catalogue";
import { commerceStaffClinicsSchema } from "../../../packages/contracts/src/commerce-clinics";
import type { DatabaseContext } from "../../../packages/database/src/client";
import { transaction } from "../../../packages/database/src/client";
import { loadCommerceClinicsInTransaction } from "../../../packages/database/src/commerce-clinics";
import { loadCommerceGrantsInTransaction } from "../../../packages/database/src/commerce-orders";
import { loadCurrentAuthorityInTransaction } from "../../../packages/database/src/identity";
import {
  CommerceAuthorityError,
  type CommercePrincipal,
  evaluateCommerceAuthority,
} from "./commerce-authorization";

/** Shared identity row locks and explicit commerce grant locks live through the domain COMMIT. */
export async function revalidateCommerceTransaction(
  context: DatabaseContext,
  principal: CommercePrincipal,
): Promise<void> {
  const authority = await loadCurrentAuthorityInTransaction(context.client, principal.identity);
  const current = validateCurrentIdentity(principal.identity, authority, Date.now());
  if (!current.allowed) throw new CommerceAuthorityError(current);
  await context.client.query("SELECT set_config('app.actor_id',$1,true)", [
    current.identity.actorId,
  ]);
  const grants =
    principal.clinicId === null && !principal.directory
      ? []
      : await loadCommerceGrantsInTransaction(context, current.identity.actorId);
  const target = principal.directory
    ? { kind: "staff_directory" as const }
    : principal.clinicId === null
      ? { kind: "customer" as const }
      : principal.action
        ? { kind: "staff" as const, clinicId: principal.clinicId, action: principal.action }
        : null;
  if (!target) throw new CommerceAuthorityError({ allowed: false, status: 403, code: "FORBIDDEN" });
  const decision = evaluateCommerceAuthority(current, target, grants, Date.now());
  if (!decision.allowed) throw new CommerceAuthorityError(decision);
}

export async function readCommerceStaffClinics(
  context: DatabaseContext,
  principal: CommercePrincipal,
  guardInTransaction?: (context: DatabaseContext) => Promise<void>,
) {
  return transaction(context.client, async () => {
    if (!principal.directory) throw new CommerceError("denied");
    await guardInTransaction?.(context);
    await revalidateCommerceTransaction(context, principal);
    const current = validateCurrentIdentity(
      principal.identity,
      await loadCurrentAuthorityInTransaction(context.client, principal.identity),
      Date.now(),
    );
    if (!current.allowed) throw new CommerceError("denied");
    const grants = await loadCommerceGrantsInTransaction(context, principal.actorId);
    const clinics = await loadCommerceClinicsInTransaction(context);
    const items = clinics.flatMap((clinic) => {
      const actions = commerceActionSchema.options.filter(
        (action) =>
          evaluateCommerceAuthority(
            current,
            { kind: "staff", clinicId: clinic.clinicId, action },
            grants,
            Date.now(),
          ).allowed,
      );
      return actions.length ? [{ ...clinic, actions }] : [];
    });
    return commerceStaffClinicsSchema.parse({ items });
  });
}
