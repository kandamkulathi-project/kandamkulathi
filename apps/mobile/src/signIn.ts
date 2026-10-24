import type { SensitiveResult } from "@kandamkulathi/client/sensitive";
import { type ClientSession, sessionSchema } from "@kandamkulathi/contracts/client";

type Result<T> = SensitiveResult<T>;
export type NativeSignInResult = Result<ClientSession> | { status: "cancelled" | "rejected" };
export interface NativeAuthorizationProof {
  state: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}
/** Local composition ports, NOT implemented HTTP routes or an agreed backend DTO. */
export interface NativeSignInBackend {
  start(proof: NativeAuthorizationProof, signal: AbortSignal): Promise<Result<string>>;
  exchange(
    input: { state: string; redirectUri: string; code: string; codeVerifier: string },
    signal: AbortSignal,
  ): Promise<Result<string>>;
  session(credential: string, signal: AbortSignal): Promise<Result<ClientSession>>;
}
export interface NativeSignInAttempt {
  proof: NativeAuthorizationProof;
  codeVerifier: string;
  open(
    url: string,
  ): Promise<
    | { status: "cancelled" | "rejected" }
    | { status: "busy" }
    | { status: "server-verification-required"; purpose: "auth" | "payment"; reference: string }
  >;
}

/** One explicitly started sign-in; a code/storage write alone never establishes a session. */
export function nativeSignInController(options: {
  backend: NativeSignInBackend;
  attempt(): Promise<NativeSignInAttempt>;
  vault: { write(credential: string): Promise<void>; clear(): Promise<void> };
  active(): boolean;
  now?: () => number;
}) {
  let disposed = false;
  let busy = false;
  let controller: AbortController | undefined;
  let needsClear = false;
  let cleanup: Promise<void> | undefined;
  const current = () => !disposed && options.active() && !controller?.signal.aborted;
  const clearWrite = () => {
    // SecureStore's serialized vault fences queued writes immediately and removes an in-flight one.
    cleanup ??= options.vault.clear().then(
      () => {
        needsClear = false;
      },
      (error: unknown) => {
        cleanup = undefined; // Explicit disposal can retry a failed OS deletion.
        throw error;
      },
    );
    // A root lifecycle callback need not await this synchronously. start/dispose still expose failure.
    void cleanup.catch(() => {});
    return cleanup;
  };
  return {
    async dispose() {
      disposed = true;
      controller?.abort();
      if (needsClear) await clearWrite();
    },
    async start(): Promise<NativeSignInResult> {
      if (!current()) return { status: "anonymous" };
      if (busy) return { status: "busy" };
      if (needsClear) return { status: "error" };
      busy = true;
      cleanup = undefined;
      controller = new AbortController();
      const signal = controller.signal;
      try {
        const attempt = await options.attempt();
        if (!current()) return { status: "anonymous" };
        const started = await options.backend.start(attempt.proof, signal);
        if (!current()) return { status: "anonymous" };
        if (started.status !== "ready") return started;
        const returned = await attempt.open(started.data);
        if (!current()) return { status: "anonymous" };
        if (returned.status !== "server-verification-required") return returned;
        if (returned.purpose !== "auth") return { status: "rejected" };
        const exchanged = await options.backend.exchange(
          {
            state: attempt.proof.state,
            redirectUri: attempt.proof.redirectUri,
            code: returned.reference,
            codeVerifier: attempt.codeVerifier,
          },
          signal,
        );
        if (!current()) return { status: "anonymous" };
        if (exchanged.status !== "ready") return exchanged;
        const credential = exchanged.data;
        if (!/^[A-Za-z0-9._~-]{16,2048}$/.test(credential)) return { status: "error" };
        const verified = await options.backend.session(credential, signal);
        if (!current()) return { status: "anonymous" };
        if (verified.status !== "ready") return verified;
        const session = sessionSchema.safeParse(verified.data);
        if (!session.success || Date.parse(session.data.expiresAt) <= (options.now ?? Date.now)())
          return { status: "error" };
        needsClear = true;
        await options.vault.write(credential);
        if (!current()) {
          await clearWrite();
          return { status: "anonymous" };
        }
        if (Date.parse(session.data.expiresAt) <= (options.now ?? Date.now)()) {
          await clearWrite();
          return { status: "expired" };
        }
        needsClear = false; // Ownership transfers to the root's verified-session/logout lifecycle.
        return { status: "ready", data: session.data };
      } catch {
        // Partial persistence is uncertain too; remove it before allowing any later root bootstrap.
        if (needsClear) {
          try {
            await clearWrite();
          } catch {
            return { status: "error" };
          }
        }
        return { status: current() ? "unknown" : "anonymous" };
      } finally {
        busy = false;
      }
    },
  };
}
