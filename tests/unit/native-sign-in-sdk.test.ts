import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  open: vi.fn(),
  write: vi.fn(async () => {}),
  remove: vi.fn(async () => {}),
}));
vi.mock("../../apps/mobile/node_modules/expo-web-browser", () => ({
  openAuthSessionAsync: sdk.open,
}));
vi.mock("../../apps/mobile/node_modules/expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
  getItemAsync: vi.fn(async () => null),
  setItemAsync: sdk.write,
  deleteItemAsync: sdk.remove,
}));
vi.mock("../../apps/mobile/node_modules/expo-crypto", async () => {
  const { createHash } = await import("node:crypto");
  return {
    getRandomBytes: (length: number) => new Uint8Array(length).fill(7),
    CryptoDigestAlgorithm: { SHA256: "SHA-256" },
    CryptoEncoding: { BASE64: "base64" },
    digestStringAsync: vi.fn(async (_algorithm: string, value: string) =>
      createHash("sha256").update(value).digest("base64"),
    ),
  };
});

import { nativeSignIn } from "../../apps/mobile/src/nativeSignIn";
import type { NativeSignInBackend } from "../../apps/mobile/src/signIn";
import { session } from "../fixtures/sensitive";

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());
function setup(mutate: (url: URL) => void = () => {}) {
  const redirectUri = "kandamkulathi-local://auth/return";
  const backend: NativeSignInBackend = {
    start: async (proof) => {
      const url = new URL("https://identity.example.org/authorize");
      for (const [key, value] of Object.entries({
        state: proof.state,
        redirect_uri: proof.redirectUri,
        code_challenge: proof.codeChallenge,
        code_challenge_method: proof.codeChallengeMethod,
      }))
        url.searchParams.set(key, value);
      mutate(url);
      return { status: "ready", data: url.href };
    },
    exchange: vi.fn<NativeSignInBackend["exchange"]>().mockResolvedValue({
      status: "ready",
      data: "synthetic_credential_0123456789",
    }),
    session: async () => ({ status: "ready", data: session }),
  };
  sdk.open.mockImplementation(async (url: string) => ({
    type: "success",
    url: `${redirectUri}?code=synthetic-code&state=${new URL(url).searchParams.get("state")}`,
  }));
  const flow = nativeSignIn({
    environment: "local",
    redirectUri,
    authorizationOrigin: "https://identity.example.org",
    backend,
    active: () => true,
  });
  return { flow, backend, redirectUri };
}

describe("native Expo SDK sign-in adapter (SDKs mocked, not device/provider proof)", () => {
  it("uses S256 base64url PKCE and the existing system-browser/device-only vault", async () => {
    const { flow, backend, redirectUri } = setup();
    expect(await flow.start()).toEqual({ status: "ready", data: session });
    const target = new URL(sdk.open.mock.calls[0]?.[0]);
    const verifier = "07".repeat(32);
    expect(target.searchParams.get("code_challenge")).toBe(
      createHash("sha256").update(verifier).digest("base64url"),
    );
    expect(target.searchParams.get("code_challenge_method")).toBe("S256");
    expect(sdk.open).toHaveBeenCalledWith(target.href, redirectUri);
    expect(backend.exchange).toHaveBeenCalledWith(
      expect.objectContaining({ codeVerifier: verifier }),
      expect.any(AbortSignal),
    );
    expect(sdk.write).toHaveBeenCalledWith(
      "kandamkulathi.local.auth",
      "synthetic_credential_0123456789",
      { keychainAccessible: 6 },
    );
  });

  it.each(["state", "redirect_uri", "code_challenge", "code_challenge_method"])(
    "rejects duplicate %s before opening the SDK",
    async (key) => {
      const { flow, backend } = setup((url) => url.searchParams.append(key, "other"));
      expect(await flow.start()).toEqual({ status: "rejected" });
      expect(sdk.open).not.toHaveBeenCalled();
      expect(backend.exchange).not.toHaveBeenCalled();
      expect(sdk.write).not.toHaveBeenCalled();
    },
  );

  it("treats browser cancellation as cancellation without exchange/persistence", async () => {
    const { flow, backend } = setup();
    sdk.open.mockResolvedValueOnce({ type: "cancel" });
    expect(await flow.start()).toEqual({ status: "cancelled" });
    expect(backend.exchange).not.toHaveBeenCalled();
    expect(sdk.write).not.toHaveBeenCalled();
  });

  it("keeps the SDK lock after disposal until the actual system browser settles", async () => {
    const first = setup();
    let release: (result: { type: string }) => void = () => {};
    sdk.open.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    const pending = first.flow.start();
    await vi.waitFor(() => expect(sdk.open).toHaveBeenCalledTimes(1));
    await first.flow.dispose();
    const second = setup();
    expect(await second.flow.start()).toEqual({ status: "busy" });
    expect(sdk.open).toHaveBeenCalledTimes(1);
    release({ type: "cancel" });
    expect(await pending).toEqual({ status: "anonymous" });
    expect(await second.flow.start()).toEqual({ status: "ready", data: session });
    expect(sdk.open).toHaveBeenCalledTimes(2);
  });

  it("does not open a browser after the bounded attempt expires during backend start", async () => {
    vi.useFakeTimers();
    const { flow, backend } = setup(() => vi.setSystemTime(Date.now() + 5 * 60 * 1000));
    expect(await flow.start()).toEqual({ status: "rejected" });
    expect(sdk.open).not.toHaveBeenCalled();
    expect(backend.exchange).not.toHaveBeenCalled();
  });

  it.each(["state", "redirect_uri", "code_challenge", "code_challenge_method"])(
    "rejects a mismatched %s without SDK launch",
    async (key) => {
      const { flow } = setup((url) => url.searchParams.set(key, "mismatch"));
      expect(await flow.start()).toEqual({ status: "rejected" });
      expect(sdk.open).not.toHaveBeenCalled();
      expect(sdk.write).not.toHaveBeenCalled();
    },
  );

  it("does not send PKCE state to an unrelated origin", async () => {
    const { flow } = setup((url) => {
      url.hostname = "other.example.org";
    });
    expect(await flow.start()).toEqual({ status: "rejected" });
    expect(sdk.open).not.toHaveBeenCalled();
  });

  it("rejects an unrelated browser return", async () => {
    const { flow, backend } = setup();
    sdk.open.mockResolvedValueOnce({
      type: "success",
      url: "kandamkulathi-dev://auth/return?code=other&state=other",
    });
    expect(await flow.start()).toEqual({ status: "rejected" });
    expect(backend.exchange).not.toHaveBeenCalled();
  });
});
