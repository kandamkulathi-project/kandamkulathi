import { describe, expect, it, vi } from "vitest";
import { nativeSessionLifecycle } from "../../apps/mobile/src/sessionLifecycle";
import { credentialVault, loadSession } from "../../packages/client/src/index";
import { sensitiveClient } from "../../packages/client/src/sensitive";
import { context, session } from "../fixtures/sensitive";

// Node runtime journey through the SAME fence used above NativeSessionControls.
// Synthetic HTTP/storage ports do not prove React Native rendering, SecureStore or device acceptance.
describe("native logout runtime journey", () => {
  it.each(["failed", "pending"])(
    "does not reload a retained credential after 503 logout and %s removal",
    async (removal) => {
      const lifecycle = nativeSessionLifecycle();
      const token = "synthetic".repeat(4);
      let completeRemoval: () => void = () => {};
      const remove = vi.fn(async () => {
        if (removal === "failed") throw new Error("Synthetic storage failure");
        await new Promise<void>((resolve) => {
          completeRemoval = resolve;
        });
      });
      const get = vi.fn(async () => token);
      const vault = credentialVault({ get, set: async () => {}, remove }, "local");
      const transport = vi.fn<TestFetch>(async (url, init) => {
        expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${token}`);
        return String(url).endsWith("/logout")
          ? new Response("{}", { status: 503 })
          : Response.json(String(url).endsWith("/context") ? context : session);
      });
      const authenticated: typeof fetch = async (url, init) => {
        const credential = await vault.read();
        const headers = new Headers(init?.headers);
        if (credential) headers.set("Authorization", `Bearer ${credential}`);
        return transport(url, { ...init, headers });
      };
      let privateView = false;
      let storageFailed = false;
      let cleanup = Promise.resolve();
      const bootstrap = async () => {
        const isCurrent = lifecycle.begin();
        const result = await loadSession(
          "https://api.example.com",
          false,
          new AbortController().signal,
          authenticated,
        );
        if (isCurrent()) privateView = result.status === "ready";
      };
      await bootstrap();
      expect(privateView).toBe(true);
      const client = sensitiveClient({
        origin: "https://api.example.com",
        local: false,
        session,
        transport: authenticated,
        onRevoked() {
          lifecycle.block();
          privateView = false;
          cleanup = vault.clear().catch(() => {
            storageFailed = true;
          });
        },
      });
      // Like the component, block synchronously before awaiting the remote result.
      lifecycle.block();
      privateView = false;
      expect(await client.signOut()).toEqual({ status: "unavailable" });
      const requestsAfterLogout = transport.mock.calls.length;
      const readsAfterLogout = get.mock.calls.length;
      const passiveRefresh = vi.fn(() => void bootstrap());
      for (let i = 0; i < 3; i++) {
        lifecycle.suspend();
        lifecycle.resume(passiveRefresh);
      }
      await Promise.resolve();
      expect(passiveRefresh).not.toHaveBeenCalled();
      expect(privateView).toBe(false);
      expect(transport).toHaveBeenCalledTimes(requestsAfterLogout);
      expect(get).toHaveBeenCalledTimes(readsAfterLogout);
      expect(remove).toHaveBeenCalledOnce();
      if (removal === "pending") completeRemoval();
      await cleanup;
      expect(storageFailed).toBe(removal === "failed");

      lifecycle.retry(); // Only an explicit user retry may read a still-valid credential.
      await bootstrap();
      expect(privateView).toBe(true);
      expect(get).toHaveBeenCalledTimes(readsAfterLogout + 1);
      client.dispose();
    },
  );
});

import type { TestFetch } from "../fixtures/fetch";
