import { expect, test } from "@playwright/test";
import { type NativeSignInBackend, nativeSignInController } from "../../apps/mobile/src/signIn";
import { credentialVault } from "../../packages/client/src/index";
import { session } from "../fixtures/sensitive";

for (const status of ["ready", "anonymous", "denied", "unavailable"] as const) {
  test(`native sign-in controller journey: verified session ${status} determines persistence`, async () => {
    // Synthetic ports only; no native/provider or login HTTP readiness claim.
    const credential = "synthetic_native_credential_0123456789";
    let stored: string | null = null;
    let writes = 0;
    const vault = credentialVault(
      {
        get: async () => stored,
        set: async (_key, value) => {
          writes++;
          stored = value;
        },
        remove: async () => {
          stored = null;
        },
      },
      "local",
    );
    const flow = nativeSignInController({
      active: () => true,
      vault,
      backend: {
        start: async () => ({ status: "ready", data: "https://identity.example.org/authorize" }),
        exchange: async () => ({ status: "ready", data: credential }),
        session: async (transient) => {
          expect(transient).toBe(credential);
          expect(await vault.read()).toBeNull();
          return status === "ready" ? { status, data: session } : { status };
        },
      },
      attempt: async () => ({
        proof: {
          state: "s".repeat(64),
          redirectUri: "kandamkulathi-local://auth/return",
          codeChallenge: "c".repeat(43),
          codeChallengeMethod: "S256",
        },
        codeVerifier: "v".repeat(64),
        open: async () => ({
          status: "server-verification-required",
          purpose: "auth",
          reference: "synthetic-code",
        }),
      }),
    });
    expect(await flow.start()).toEqual(status === "ready" ? { status, data: session } : { status });
    expect(await vault.read()).toBe(status === "ready" ? credential : null);
    expect(writes).toBe(status === "ready" ? 1 : 0);
    await flow.dispose();
  });
}

test("native sign-in controller journey: background during an OS write removes the late credential", async () => {
  // No page/device fixture; actual controller + serialized vault, synthetic backend/OS ports.
  // These ports do NOT implement missing native login/exchange HTTP endpoints or native SDK proof.
  let stored: string | null = null;
  let writing = false;
  let release = () => {};
  const vault = credentialVault(
    {
      get: async () => stored,
      set: async (_key, value) => {
        writing = true;
        await new Promise<void>((resolve) => (release = resolve));
        stored = value;
      },
      remove: async () => {
        stored = null;
      },
    },
    "local",
  );
  let exchanges = 0;
  let verified = 0;
  const backend: NativeSignInBackend = {
    start: async () => ({ status: "ready", data: "https://identity.example.org/authorize" }),
    exchange: async () => {
      exchanges++;
      return { status: "ready", data: "synthetic_native_credential_0123456789" };
    },
    session: async () => {
      verified++;
      return { status: "ready", data: session };
    },
  };
  let active = true;
  const flow = nativeSignInController({
    backend,
    vault,
    active: () => active,
    attempt: async () => ({
      proof: {
        state: "s".repeat(64),
        redirectUri: "kandamkulathi-local://auth/return",
        codeChallenge: "c".repeat(43),
        codeChallengeMethod: "S256",
      },
      codeVerifier: "v".repeat(64),
      open: async () => ({
        status: "server-verification-required",
        purpose: "auth",
        reference: "synthetic-code",
      }),
    }),
  });
  const pending = flow.start();
  await expect.poll(() => writing).toBe(true);
  expect(exchanges).toBe(1);
  expect(verified).toBe(1);
  active = false;
  const cleanup = flow.dispose();
  release();
  await cleanup;
  expect(await pending).toEqual({ status: "anonymous" });
  expect(await vault.read()).toBeNull();
  active = true; // A warm resume cannot revive a disposed attempt.
  expect(await flow.start()).toEqual({ status: "anonymous" });
  expect(exchanges).toBe(1);
});
