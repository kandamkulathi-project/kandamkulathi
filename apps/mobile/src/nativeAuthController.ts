import type { SensitiveResult } from "@kandamkulathi/client/sensitive";
import type { ClientSession } from "@kandamkulathi/contracts/client";
import type { NativeBootstrap, nativeAuthHttp } from "./nativeAuthHttp";
import type { NativeSignInBackend, NativeSignInResult } from "./signIn";

type Status =
  | NativeSignInResult["status"]
  | "idle"
  | "loading"
  | "consent_required"
  | "logout_pending";
export type NativeAuthState = {
  status: Status;
  policy?: NativeBootstrap;
  session?: ClientSession;
  browserHandoff: boolean;
};
type SessionResult = SensitiveResult<ClientSession>;
export function nativeAuthController(options: {
  api: ReturnType<typeof nativeAuthHttp>;
  vault: { read(): Promise<string | null>; clear(): Promise<void> };
  createSignIn(
    backend: NativeSignInBackend,
    handoff: (active: boolean) => void,
  ): { start(): Promise<NativeSignInResult>; dispose(): Promise<void> };
  active(): boolean;
  uuid(): string;
  onBrowserHandoff?(active: boolean): void;
  onAuthenticated(session: ClientSession): void;
  now?: () => number;
}) {
  let state: NativeAuthState = { status: "idle", browserHandoff: false };
  const listeners = new Set<(state: NativeAuthState) => void>();
  let epoch = 0;
  let flow: ReturnType<typeof options.createSignIn> | undefined;
  let ephemeral: string | undefined;
  let policy: NativeBootstrap | undefined;
  let settle: ((value: SessionResult) => void) | undefined;
  let sessionSignal: AbortSignal | undefined;
  let busy = false;
  let deciding = false;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let pendingLogout: { credential: string; id: string } | undefined;
  const emit = (status: Status, extra: Partial<NativeAuthState> = {}) => {
    state = {
      status,
      browserHandoff: state.browserHandoff,
      ...(policy ? { policy } : {}),
      ...extra,
    };
    for (const listener of listeners) listener(state);
  };
  const current = (attempt: number) => attempt === epoch && options.active();
  const erase = () => {
    ephemeral = undefined;
    policy = undefined;
    clearTimeout(expiry);
  };
  let revoking: Promise<void> | undefined;
  async function revokeOnce() {
    if (!pendingLogout) return;
    const operation = pendingLogout;
    let result: Awaited<ReturnType<typeof options.api.logout>>;
    try {
      result = await options.api.logout(
        operation.credential,
        operation.id,
        new AbortController().signal,
      );
    } catch {
      if (pendingLogout === operation) emit("logout_pending");
      return;
    }
    if (pendingLogout !== operation) return;
    if (result.status === "ready") {
      pendingLogout = undefined;
      if (state.status === "logout_pending") emit("anonymous");
    } else emit("logout_pending");
  }
  function revoke() {
    revoking ??= revokeOnce().finally(() => {
      revoking = undefined;
    });
    return revoking;
  }
  function rememberRevoke(credential: string | undefined) {
    if (credential) pendingLogout ??= { credential, id: options.uuid() };
  }
  async function showPolicy(
    credential: string,
    signal: AbortSignal,
    attempt: number,
  ): Promise<SessionResult> {
    const bootstrap = await options.api.bootstrap(credential, signal);
    if (!current(attempt) || signal.aborted) return { status: "anonymous" };
    if (bootstrap.status !== "ready") return bootstrap;
    policy = bootstrap.data;
    emit("consent_required", { policy });
    return new Promise<SessionResult>((resolve) => {
      let completed = false;
      const finish = (value: SessionResult) => {
        if (completed) return;
        completed = true;
        signal.removeEventListener("abort", cancel);
        settle = undefined;
        resolve(value);
      };
      const cancel = () => {
        rememberRevoke(ephemeral);
        erase();
        finish({ status: "anonymous" });
        void revoke();
      };
      settle = finish;
      sessionSignal = signal;
      signal.addEventListener("abort", cancel, { once: true });
      expiry = setTimeout(
        () => {
          rememberRevoke(ephemeral);
          erase();
          finish({ status: "expired" });
        },
        Math.min(
          2147483647,
          Math.max(0, Date.parse(bootstrap.data.expiresAt) - (options.now ?? Date.now)()),
        ),
      );
      if (signal.aborted) cancel();
    });
  }
  const api = {
    getSnapshot: () => state,
    subscribe(listener: (value: NativeAuthState) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async start() {
      if (busy) return;
      if (pendingLogout) {
        emit("logout_pending");
        return;
      }
      if (!options.active()) {
        emit("anonymous");
        return;
      }
      busy = true;
      const attempt = ++epoch;
      emit("loading");
      const backend: NativeSignInBackend = {
        start: options.api.start,
        async exchange(input, signal) {
          const result = await options.api.exchange(input, signal);
          if (result.status === "ready") {
            if (!current(attempt) || signal.aborted) {
              rememberRevoke(result.data);
              void revoke();
              return { status: "anonymous" };
            }
            ephemeral = result.data;
          }
          return result;
        },
        async session(credential, signal) {
          const result = await options.api.session(credential, signal);
          if (!current(attempt) || signal.aborted) return { status: "anonymous" };
          return result.status === "denied" ? showPolicy(credential, signal, attempt) : result;
        },
      };
      try {
        flow = options.createSignIn(backend, (active) => {
          if (!current(attempt)) return;
          state = { ...state, browserHandoff: active };
          options.onBrowserHandoff?.(active);
          for (const listener of listeners) listener(state);
        });
        const result = await flow.start();
        if (!current(attempt)) return;
        if (result.status === "ready") {
          erase();
          emit("ready", { session: result.data });
          options.onAuthenticated(result.data);
        } else {
          rememberRevoke(ephemeral);
          erase();
          emit(result.status);
          await revoke();
        }
      } catch {
        if (current(attempt)) {
          rememberRevoke(ephemeral);
          erase();
          emit("error");
          await revoke();
        }
      } finally {
        busy = false;
      }
    },
    async decide(decision: "granted" | "declined") {
      if (
        deciding ||
        state.status !== "consent_required" ||
        !ephemeral ||
        !policy ||
        !settle ||
        !sessionSignal ||
        !options.active()
      )
        return;
      const attempt = epoch;
      const credential = ephemeral;
      const approved = policy;
      const signal = sessionSignal;
      if (Date.parse(approved.expiresAt) <= (options.now ?? Date.now)()) {
        settle({ status: "expired" });
        return;
      }
      deciding = true;
      emit("loading", { policy: approved });
      try {
        const result = await options.api.consent(credential, approved, decision, signal);
        if (!current(attempt) || signal.aborted) return;
        if (result.status !== "ready") {
          if (result.status === "anonymous") {
            settle?.(result);
            return;
          }
          // A committed/lost POST is reconciled by an explicit session check, not an automatic repeat.
          emit(result.status, { policy: approved });
          return;
        }
        if (decision === "declined") {
          settle?.({ status: "denied" });
          return;
        }
        const session = await options.api.session(credential, signal);
        if (!current(attempt) || signal.aborted) return;
        if (session.status === "ready") {
          if (
            session.data.userId !== approved.actorId ||
            Date.parse(session.data.expiresAt) > Date.parse(approved.expiresAt)
          )
            settle?.({ status: "denied" });
          else settle?.(session);
        } else if (session.status === "anonymous") settle?.(session);
        else emit(session.status, { policy: approved });
      } catch {
        if (current(attempt)) emit("unknown", { policy: approved });
      } finally {
        deciding = false;
      }
    },
    async checkConsent() {
      if (deciding || !ephemeral || !settle || !sessionSignal) return;
      const attempt = epoch;
      const credential = ephemeral;
      const signal = sessionSignal;
      deciding = true;
      emit("loading");
      try {
        const session = await options.api.session(credential, signal);
        if (!current(attempt) || signal.aborted) return;
        if (session.status === "ready" || session.status === "anonymous") {
          if (
            session.status === "ready" &&
            (!policy ||
              session.data.userId !== policy.actorId ||
              Date.parse(session.data.expiresAt) > Date.parse(policy.expiresAt))
          )
            settle?.({ status: "denied" });
          else settle?.(session);
          return;
        }
        if (session.status !== "denied") {
          emit(session.status);
          return;
        }
        const result = await options.api.bootstrap(credential, signal);
        if (!current(attempt) || signal.aborted) return;
        if (result.status === "ready") {
          if (
            result.data.actorId !== policy?.actorId ||
            result.data.sessionId !== policy.sessionId
          ) {
            settle?.({ status: "denied" });
            return;
          }
          policy = result.data;
          emit("consent_required", { policy });
        } else emit(result.status);
      } catch {
        if (current(attempt)) emit("unknown");
      } finally {
        deciding = false;
      }
    },
    async cancel() {
      epoch++;
      rememberRevoke(ephemeral);
      erase();
      settle?.({ status: "anonymous" });
      state = { status: "cancelled", browserHandoff: false };
      options.onBrowserHandoff?.(false);
      for (const listener of listeners) listener(state);
      try {
        await flow?.dispose();
      } catch {
        emit("error");
        throw new Error("Native credential cleanup failed");
      }
      await revoke();
    },
    async background() {
      if (!state.browserHandoff) await api.cancel();
    },
    async logout() {
      // Start the serialized read BEFORE disposing sign-in can clear this same OS vault.
      const saved = options.vault.read();
      epoch++;
      emit("anonymous");
      rememberRevoke(ephemeral);
      erase();
      settle?.({ status: "anonymous" });
      state = { status: "anonymous", browserHandoff: false };
      options.onBrowserHandoff?.(false);
      let failed = false;
      try {
        rememberRevoke((await saved) ?? undefined);
      } catch {
        failed = true;
      }
      try {
        await flow?.dispose();
      } catch {
        failed = true;
      }
      try {
        await options.vault.clear();
      } catch {
        failed = true;
      }
      await revoke();
      if (failed) {
        emit("error");
        throw Error("Native credential cleanup failed");
      }
    },
    retryLogout: revoke,
  };
  return api;
}
