import { expect, test } from "@playwright/test";
import { nativeSessionLifecycle } from "../../apps/mobile/src/sessionLifecycle";
import { credentialVault, loadSession } from "../../packages/client/src/index";
import { sensitiveClient } from "../../packages/client/src/sensitive";
import { context, session } from "../fixtures/sensitive";

test("native controller journey: failed logout remains blocked until explicit revalidation", async () => {
  // Node-only journey, intentionally no page/device fixture. This executes the native
  // lifecycle controller with synthetic ports; it is NOT installed-native end-to-end proof.
  const lifecycle = nativeSessionLifecycle();
  const token = "synthetic_native_bearer_0123456789012345";
  let credentialReads = 0;
  let sessionReads = 0;
  let cleanupFailed = false;
  let cleanup = Promise.resolve();
  let privateView = false;
  const vault = credentialVault(
    {
      get: async () => {
        credentialReads++;
        return token;
      },
      set: async () => {},
      remove: async () => {
        throw new Error("Synthetic deletion failure");
      },
    },
    "local",
  );
  const transport: typeof fetch = async (url) => {
    if (String(url).endsWith("/logout")) return new Response("{}", { status: 503 });
    if (String(url).endsWith("/context")) return Response.json(context);
    sessionReads++;
    await vault.read();
    return Response.json(session);
  };
  const bootstrap = async () => {
    const isCurrent = lifecycle.begin();
    const result = await loadSession(
      "https://api.example.com",
      false,
      new AbortController().signal,
      transport,
    );
    if (isCurrent()) privateView = result.status === "ready";
  };
  await bootstrap();
  expect(privateView).toBe(true);
  const client = sensitiveClient({
    origin: "https://api.example.com",
    local: false,
    session,
    transport,
    onRevoked() {
      lifecycle.block();
      privateView = false;
      cleanup = vault.clear().catch(() => {
        cleanupFailed = true;
      });
    },
  });
  lifecycle.block();
  privateView = false;
  expect(await client.signOut()).toEqual({ status: "unavailable" });
  await cleanup;
  expect(cleanupFailed).toBe(true);
  for (let i = 0; i < 2; i++) {
    lifecycle.suspend();
    lifecycle.resume(() => void bootstrap());
  }
  expect(privateView).toBe(false);
  expect(sessionReads).toBe(1);
  expect(credentialReads).toBe(1);
  lifecycle.retry();
  await bootstrap();
  expect(sessionReads).toBe(2);
  expect(privateView).toBe(true);
  client.dispose();
});
