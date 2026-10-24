import type { ClientSession } from "@kandamkulathi/contracts/client";
import { type Payment, referenceSchema } from "@kandamkulathi/contracts/sensitive";
import { nativeSessionAllowed } from "./customer/commerce";

/** One volatile reference, never a payment/checkout/receipt or bearer. The caller must
 * supply a freshly verified session and the SHA-256 of its pinned native credential.
 * Restoring is navigation only: explicitly load/reconcile before offering checkout.
 */
export function nativeLegacyPaymentRecoveryBroker() {
  type Scope = { ownerId: string; expiresAt: string; credentialHash: string };
  let saved: { reference: string; scope: Scope } | null = null;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  const scope = (session: ClientSession, credentialHash: string): Scope | null =>
    nativeSessionAllowed(session) && /^[a-f0-9]{64}$/.test(credentialHash)
      ? { ownerId: session.userId, expiresAt: session.expiresAt, credentialHash }
      : null;
  function clear() {
    clearTimeout(expiry);
    expiry = undefined;
    saved = null;
  }
  function scheduleExpiry() {
    clearTimeout(expiry);
    if (!saved) return;
    const remaining = Date.parse(saved.scope.expiresAt) - Date.now();
    if (remaining <= 0) clear();
    else expiry = setTimeout(scheduleExpiry, Math.min(2147483647, remaining));
  }
  return {
    /** Call inside the invoked payment action, using the already-authorized API view. */
    remember(session: ClientSession, credentialHash: string, reference: string, payment: Payment) {
      clear(); // A new authorized attempt explicitly replaces the older reference.
      const current = scope(session, credentialHash);
      if (
        !current ||
        !referenceSchema.safeParse(reference).success ||
        payment.id !== reference ||
        payment.status !== "requires_payment" ||
        !payment.checkout ||
        !(Date.parse(payment.expiresAt) > Date.now())
      )
        return false;
      saved = { reference, scope: current };
      scheduleExpiry();
      return true;
    },
    restore(session: ClientSession, credentialHash: string): string | null {
      const current = scope(session, credentialHash);
      if (
        !current ||
        (saved &&
          (saved.scope.ownerId !== current.ownerId ||
            saved.scope.expiresAt !== current.expiresAt ||
            saved.scope.credentialHash !== current.credentialHash))
      )
        clear();
      // Non-consuming so another background/remount before Load cannot lose it again.
      return saved?.reference ?? null;
    },
    clear,
  };
}
