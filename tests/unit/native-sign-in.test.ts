import { describe, expect, it, vi } from "vitest";
import { type NativeSignInBackend, nativeSignInController } from "../../apps/mobile/src/signIn";
import { session } from "../fixtures/sensitive";

const credential = "synthetic_native_credential_0123456789";
function setup() {
  const proof = {
    state: "s".repeat(64),
    redirectUri: "kandamkulathi-local://auth/return",
    codeChallenge: "c".repeat(43),
    codeChallengeMethod: "S256" as const,
  };
  const open = vi.fn(async (_url: string) => ({
    status: "server-verification-required" as const,
    purpose: "auth" as const,
    reference: "synthetic-single-use-code",
  }));
  const attempt = vi.fn(async () => ({ proof, codeVerifier: "v".repeat(64), open }));
  const backend = {
    start: vi.fn<NativeSignInBackend["start"]>().mockResolvedValue({
      status: "ready",
      data: "https://identity.example.org/authorize",
    }),
    exchange: vi.fn<NativeSignInBackend["exchange"]>().mockResolvedValue({
      status: "ready",
      data: credential,
    }),
    session: vi.fn<NativeSignInBackend["session"]>().mockResolvedValue({
      status: "ready",
      data: session,
    }),
  };
  const vault = { write: vi.fn(async (_token: string) => {}), clear: vi.fn(async () => {}) };
  let active = true;
  const flow = nativeSignInController({ backend, vault, attempt, active: () => active });
  return { proof, open, attempt, backend, vault, flow, suspend: () => (active = false) };
}

describe("composable native sign-in (synthetic backend ports, not a working login API)", () => {
  it("exchanges the guarded code and verifies the transient credential before SecureStore ownership", async () => {
    const { flow, backend, proof, vault } = setup();
    expect(await flow.start()).toEqual({ status: "ready", data: session });
    expect(backend.start).toHaveBeenCalledWith(proof, expect.any(AbortSignal));
    expect(backend.start.mock.calls[0]?.[0]).not.toHaveProperty("codeVerifier");
    expect(backend.exchange).toHaveBeenCalledWith(
      {
        state: proof.state,
        redirectUri: proof.redirectUri,
        code: "synthetic-single-use-code",
        codeVerifier: "v".repeat(64),
      },
      expect.any(AbortSignal),
    );
    expect(backend.session).toHaveBeenCalledWith(credential, expect.any(AbortSignal));
    expect(backend.session.mock.invocationCallOrder[0]).toBeLessThan(
      vault.write.mock.invocationCallOrder[0] ?? 0,
    );
    expect(vault.write).toHaveBeenCalledWith(credential);
    await flow.dispose();
    expect(vault.clear).not.toHaveBeenCalled(); // Root now owns the verified session's logout.
  });

  for (const stage of ["start", "exchange", "session"] as const) {
    it.each(["anonymous", "denied", "unavailable"] as const)(
      `preserves %s from ${stage} without storing a credential`,
      async (status) => {
        const { flow, backend, vault } = setup();
        backend[stage].mockResolvedValue({ status });
        expect(await flow.start()).toEqual({ status });
        expect(vault.write).not.toHaveBeenCalled();
      },
    );
  }

  it("fences cancellation and overlapping presses while the actual browser is outstanding", async () => {
    const { flow, open, backend, suspend } = setup();
    let release = () => {};
    open.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => (release = resolve));
      return { status: "server-verification-required", purpose: "auth", reference: "late-code" };
    });
    const first = flow.start();
    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect(await flow.start()).toEqual({ status: "busy" });
    suspend();
    await flow.dispose();
    release();
    expect(await first).toEqual({ status: "anonymous" });
    expect(backend.exchange).not.toHaveBeenCalled();
    expect(backend.start.mock.calls[0]?.[1].aborted).toBe(true);
  });

  it.each(["attempt", "start", "exchange", "session", "write"] as const)(
    "does not restore access after disposal during %s",
    async (stage) => {
      const state = setup();
      let entered = false;
      let release = () => {};
      const wait = async () => {
        entered = true;
        await new Promise<void>((resolve) => (release = resolve));
      };
      if (stage === "attempt") {
        const original = state.attempt.getMockImplementation();
        state.attempt.mockImplementationOnce(async () => {
          await wait();
          if (!original) throw new Error("Missing fixture");
          return original();
        });
      } else if (stage === "write") state.vault.write.mockImplementationOnce(wait);
      else if (stage === "session")
        state.backend.session.mockImplementationOnce(async () => {
          await wait();
          return { status: "ready", data: session };
        });
      else
        state.backend[stage].mockImplementationOnce(async () => {
          await wait();
          return {
            status: "ready",
            data: stage === "start" ? "https://identity.example.org/authorize" : credential,
          };
        });
      const pending = state.flow.start();
      await vi.waitFor(() => expect(entered).toBe(true));
      state.suspend();
      const cleanup = state.flow.dispose();
      release();
      await cleanup;
      expect(await pending).toEqual({ status: "anonymous" });
      if (stage === "write") expect(state.vault.clear).toHaveBeenCalledTimes(1);
      else expect(state.vault.write).not.toHaveBeenCalled();
    },
  );

  it.each(["short", "x".repeat(2049), "synthetic token with spaces", "秘密".repeat(16)])(
    "rejects malformed/oversize credential without verification or persistence (%#)",
    async (value) => {
      const { flow, backend, vault } = setup();
      backend.exchange.mockResolvedValue({ status: "ready", data: value });
      expect(await flow.start()).toEqual({ status: "error" });
      expect(backend.session).not.toHaveBeenCalled();
      expect(vault.write).not.toHaveBeenCalled();
    },
  );

  it("does not persist an expired session", async () => {
    const { flow, backend, vault } = setup();
    backend.session.mockResolvedValue({
      status: "ready",
      data: { ...session, expiresAt: "2000-01-01T00:00:00Z" },
    });
    expect(await flow.start()).toEqual({ status: "error" });
    expect(vault.write).not.toHaveBeenCalled();
  });

  it("removes a credential if the verified session expires during OS persistence", async () => {
    const state = setup();
    let now = Date.parse("2098-12-31T23:59:59Z");
    const flow = nativeSignInController({
      backend: state.backend,
      attempt: state.attempt,
      vault: state.vault,
      active: () => true,
      now: () => now,
    });
    state.vault.write.mockImplementationOnce(async () => {
      now += 1000;
    });
    expect(await flow.start()).toEqual({ status: "expired" });
    expect(state.vault.clear).toHaveBeenCalledTimes(1);
  });

  it("surfaces failed persistence/deletion and permits an explicit cleanup retry, never a new login", async () => {
    const { flow, vault, backend } = setup();
    vault.write.mockRejectedValueOnce(new Error("Synthetic OS write failure"));
    vault.clear.mockRejectedValueOnce(new Error("Synthetic OS deletion failure"));
    expect(await flow.start()).toEqual({ status: "error" });
    expect(await flow.start()).toEqual({ status: "error" });
    expect(backend.start).toHaveBeenCalledTimes(1);
    await flow.dispose();
    expect(vault.clear).toHaveBeenCalledTimes(2);
    expect(await flow.start()).toEqual({ status: "anonymous" });
  });

  it("never persists or automatically retries an uncertain exchange", async () => {
    const { flow, backend, vault } = setup();
    backend.exchange.mockRejectedValueOnce(new Error("Synthetic connection lost"));
    expect(await flow.start()).toEqual({ status: "unknown" });
    expect(backend.exchange).toHaveBeenCalledTimes(1);
    expect(vault.write).not.toHaveBeenCalled();
  });
});
