import type { ClientSession } from "@kandamkulathi/contracts/client";
import { nativeSessionAllowed } from "./commerce";
import type { NativeCommerceController, NativeCommerceRecovery } from "./commerceController";

type Scope = { ownerId: string; expiresAt: string; credentialHash: string };

/** Pin one OS credential for this verified lifetime; rotation requires a new authoritative bootstrap. */
export function nativeCredentialLifetime(
  read: () => Promise<string | null>,
  onChanged: () => void,
) {
  let initialized = false;
  let credential: string | null = null;
  let invalid = false;
  return {
    async read() {
      if (invalid) throw Error("Inactive native credential lifetime");
      const value = await read();
      if (invalid) throw Error("Inactive native credential lifetime");
      if (initialized && value !== credential) {
        invalid = true;
        credential = null;
        onChanged();
        throw Error("Native credential lifetime changed");
      }
      initialized = true;
      credential = value;
      return value;
    },
    async hash(digest: (value: string) => Promise<string>) {
      if (invalid || !initialized || !credential) throw Error("Native credential unavailable");
      const result = await digest(credential);
      if (invalid) throw Error("Inactive native credential lifetime");
      return result;
    },
    clear() {
      invalid = true;
      credential = null;
    },
  };
}

/** Volatile handoff across ordinary background revalidation only; never persisted or serialized. */
export function nativeCommerceRecoveryBroker() {
  let attached: {
    controller: Pick<NativeCommerceController, "snapshotRecovery">;
    scope: Scope;
  } | null = null;
  let saved: { recovery: NativeCommerceRecovery; scope: Scope } | null = null;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  function clearSaved() {
    clearTimeout(expiry);
    expiry = undefined;
    saved = null;
  }
  function scheduleExpiry() {
    clearTimeout(expiry);
    if (!saved) return;
    const remaining = Date.parse(saved.scope.expiresAt) - Date.now();
    if (remaining <= 0) {
      clearSaved();
      return;
    }
    expiry = setTimeout(scheduleExpiry, Math.min(2147483647, remaining));
  }
  const scope = (session: ClientSession, credentialHash: string): Scope | null =>
    nativeSessionAllowed(session) && /^[a-f0-9]{64}$/.test(credentialHash)
      ? { ownerId: session.userId, expiresAt: session.expiresAt, credentialHash }
      : null;
  const same = (left: Scope, right: Scope) =>
    left.ownerId === right.ownerId &&
    left.expiresAt === right.expiresAt &&
    left.credentialHash === right.credentialHash;
  return {
    attach(
      controller: Pick<NativeCommerceController, "snapshotRecovery">,
      session: ClientSession,
      credentialHash: string,
    ) {
      const current = scope(session, credentialHash);
      attached = current ? { controller, scope: current } : null;
      if (!current || (saved && !same(saved.scope, current))) clearSaved();
    },
    detach(controller: Pick<NativeCommerceController, "snapshotRecovery">) {
      if (attached?.controller === controller) attached = null;
    },
    capture() {
      if (!attached) return;
      const recovery = attached.controller.snapshotRecovery();
      saved = recovery ? { recovery, scope: attached.scope } : null;
      scheduleExpiry();
      attached = null;
    },
    take(session: ClientSession, credentialHash: string): NativeCommerceRecovery | null {
      const previous = saved;
      clearSaved();
      const current = scope(session, credentialHash);
      return previous && current && same(previous.scope, current) ? previous.recovery : null;
    },
    clear() {
      attached = null;
      clearSaved();
    },
  };
}
