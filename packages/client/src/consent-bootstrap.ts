import { sessionSchema } from "../../contracts/src/client";
import {
  type ConsentBootstrap,
  consentBootstrapSchema,
} from "../../contracts/src/consent-bootstrap";
import { canonicalUuidSchema } from "../../contracts/src/identifiers";
import { securityContextSchema } from "../../contracts/src/sensitive";
import { apiOrigin } from "./index";

export type BootstrapState =
  | { status: "ready"; bootstrap: ConsentBootstrap }
  | {
      status:
        | "idle"
        | "loading"
        | "submitting"
        | "verifying"
        | "verified"
        | "unknown"
        | "recorded"
        | "expired"
        | "anonymous"
        | "denied"
        | "unavailable"
        | "error"
        | "cancelled";
    };

function verifyPersistedConsent(value: unknown): void {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    !("id" in value) ||
    !canonicalUuidSchema.safeParse(value.id).success
  )
    throw new Error("Invalid persisted consent result");
}
const responseLimit = 400_000; // UTF-8 JSON may escape every policy character.

/** Bound raw bytes before decoding/parsing; Content-Length is not trusted. */
async function readJson(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? ""))
    throw new Error("Invalid response type");
  if (!response.body) throw new Error("Missing response body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let complete = false;
  const abort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    for (;;) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > responseLimit) throw new Error("Response too large");
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    complete = true;
    return value;
  } finally {
    signal.removeEventListener("abort", abort);
    if (!complete) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Separate pre-privacy path: never constructs or weakens a ClientSession transport. */
export function createConsentBootstrapClient(options: {
  origin: string;
  local: boolean;
  onChange(state: BootstrapState): void;
  onVerified(): void;
  transport?: typeof fetch;
  now?: () => number;
}) {
  const origin = apiOrigin(options.origin, options.local);
  const transport = options.transport ?? fetch;
  const now = options.now ?? Date.now;
  let state: BootstrapState = { status: "idle" };
  let disposed = false;
  let generation = 0;
  let slot: { controller: AbortController; promise: Promise<void> } | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let subject: string | undefined;
  const publish = (next: BootstrapState) => {
    if (!disposed) {
      state = next;
      options.onChange(next);
    }
  };
  const stop = () => {
    generation++;
    clearTimeout(expiry);
    slot?.controller.abort();
    slot = undefined;
  };
  const run = (work: (signal: AbortSignal, check: () => void) => Promise<void>) => {
    if (disposed) return Promise.resolve();
    if (slot) return slot.promise;
    const epoch = ++generation;
    const controller = new AbortController();
    const check = () => {
      controller.signal.throwIfAborted();
      if (disposed || epoch !== generation) throw new DOMException("Inactive", "AbortError");
    };
    const timeout = setTimeout(() => controller.abort(), 5000);
    // Defer work until the slot exists, including for synchronous synthetic transports.
    const promise = Promise.resolve()
      .then(() => {
        if (!disposed && epoch === generation && !controller.signal.aborted)
          return work(controller.signal, check);
      })
      .finally(() => {
        clearTimeout(timeout);
        if (epoch === generation) slot = undefined;
      });
    slot = { controller, promise };
    return promise;
  };
  const request = async (path: string, signal: AbortSignal, init?: RequestInit) =>
    transport(`${origin}${path}`, {
      ...init,
      method: init?.method ?? "GET",
      credentials: "include",
      cache: "no-store",
      redirect: "error",
      signal,
      headers: { Accept: "application/json", ...init?.headers },
    });
  const failure = (response: Response): BootstrapState => ({
    status:
      response.status === 401
        ? "anonymous"
        : response.status === 403
          ? "denied"
          : response.status === 503
            ? "unavailable"
            : "error",
  });
  const verifySession = async (signal: AbortSignal, check: () => void) => {
    const response = await request("/v1/session", signal);
    check();
    if (response.status !== 200) return response;
    const session = sessionSchema.parse(await readJson(response, signal));
    check();
    if (Date.parse(session.expiresAt) <= now() || (subject && session.userId !== subject))
      throw new Error("Session mismatch or expiry");
    clearTimeout(expiry);
    publish({ status: "verified" });
    options.onVerified();
    return undefined;
  };
  const load = () =>
    run(async (signal, check) => {
      clearTimeout(expiry);
      publish({ status: "loading" });
      try {
        // Reconcile first, including after uncertain writes. Never repeat a POST here.
        const sessionResponse = await verifySession(signal, check);
        if (!sessionResponse) return;
        if (sessionResponse.status !== 403) {
          publish(failure(sessionResponse));
          return;
        }
        const response = await request("/v1/consent-bootstrap", signal);
        check();
        if (response.status !== 200) {
          publish(failure(response));
          return;
        }
        const bootstrap = consentBootstrapSchema.parse(await readJson(response, signal));
        check();
        const hash = Array.from(
          new Uint8Array(
            await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bootstrap.policy.text)),
          ),
        )
          .map((value) => value.toString(16).padStart(2, "0"))
          .join("");
        check();
        if (hash !== bootstrap.policy.sha256) throw new Error("Policy integrity mismatch");
        if (Date.parse(bootstrap.expiresAt) <= now()) {
          publish({ status: "expired" });
          return;
        }
        subject = bootstrap.actorId;
        const schedule = () => {
          const remaining = Date.parse(bootstrap.expiresAt) - now();
          if (remaining <= 0) {
            const status =
              state.status === "submitting"
                ? "unknown"
                : state.status === "verifying"
                  ? "recorded"
                  : "expired";
            stop();
            publish({ status });
          } else expiry = setTimeout(schedule, Math.min(remaining, 2147483647));
        };
        schedule();
        publish({ status: "ready", bootstrap });
      } catch {
        if (!disposed && !signal.aborted) publish({ status: "error" });
        else if (!disposed && slot?.controller.signal === signal)
          publish({ status: "unavailable" });
      }
    });
  const grant = () => {
    if (slot || state.status !== "ready" || disposed) return slot?.promise ?? Promise.resolve();
    const bootstrap = state.bootstrap;
    return run(async (signal, check) => {
      let sent = false;
      let persisted = false;
      publish({ status: "submitting" });
      const fresh = () => {
        check();
        if (Date.parse(bootstrap.expiresAt) <= now()) throw new Error("Expired bootstrap");
      };
      try {
        fresh();
        const response = await request("/v1/security/context", signal);
        fresh();
        if (response.status !== 200) {
          publish(failure(response));
          return;
        }
        const context = securityContextSchema.parse(await readJson(response, signal));
        fresh();
        const expiresAt = Date.parse(context.expiresAt);
        if (
          context.userId !== bootstrap.actorId ||
          context.sessionId !== bootstrap.sessionId ||
          expiresAt <= now() ||
          expiresAt > Date.parse(bootstrap.expiresAt)
        )
          throw new Error("Security context mismatch");
        fresh();
        if (expiresAt <= now()) throw new Error("Expired context");
        // Canonical current recordSelfConsent contract has NO operationId/replay guarantee.
        sent = true;
        const result = await request("/v1/consents", signal, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": context.csrfToken },
          body: JSON.stringify({ requirement: bootstrap.requirement, decision: "granted" }),
        });
        fresh();
        if (result.status !== 201) {
          publish(
            result.status === 401 || result.status === 403
              ? failure(result)
              : { status: "unknown" },
          );
          return;
        }
        verifyPersistedConsent(await readJson(result, signal));
        fresh();
        persisted = true;
        publish({ status: "verifying" });
        const denied = await verifySession(signal, check);
        if (denied) publish(failure(denied));
      } catch {
        if (!disposed && slot?.controller.signal === signal)
          publish({ status: persisted ? "recorded" : sent ? "unknown" : "error" });
      } finally {
        // A settled unknown result must not later turn into an apparent safe expiry.
        if (slot?.controller.signal === signal) clearTimeout(expiry);
      }
    });
  };
  return {
    load,
    grant,
    cancel() {
      stop();
      publish({ status: "cancelled" });
    },
    dispose() {
      disposed = true;
      stop();
    },
  };
}
