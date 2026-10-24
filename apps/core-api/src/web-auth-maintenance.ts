import type { registerIdentityRoutes } from "@kandamkulathi/server/identity";
import { canonicalUuidSchema } from "../../../packages/contracts/src/identifiers.ts";
import type { DatabaseClient } from "../../../packages/database/src/client.ts";
import {
  type AuthOperation,
  admitAuthOperation,
  admitProviderActor,
  admitProviderCall,
  claimPendingLogouts,
  cleanupWebAuth,
  finishLogoutClaim,
  type LogoutClaim,
  type LogoutFailure,
  ownsLogoutLease,
} from "../../../packages/database/src/web-auth-maintenance.ts";
import { decode64, encode64 } from "../../../packages/providers/src/workos/oauth.ts";

type WithClient = <T>(callback: (client: DatabaseClient) => Promise<T>) => Promise<T>;
export type AdmissionDecision = "allowed" | "denied" | "unavailable";
export interface WebAuthMaintenanceOptions {
  approved: boolean;
  apiKey: string;
  apiOrigin: string;
  rateKey: string;
}
export interface WebAuthMaintenanceHooks {
  withAdmissionClient: WithClient;
  withMaintenanceClient: WithClient;
  /** Platform-proven remote address only. Never trust an arbitrary forwarding header. */
  trustedRemoteAddress(request: Request): string | null;
}
type ProviderState = "active" | "inactive";
class MaintenanceError extends Error {
  readonly code: LogoutFailure | "lease_lost" | "admission_denied" | "admission_unavailable";
  constructor(code: LogoutFailure | "lease_lost" | "admission_denied" | "admission_unavailable") {
    super(code);
    this.code = code;
  }
}
function normalizedAddress(input: string | null): string | null {
  if (!input || input.length > 64 || input !== input.trim()) return null;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(input)) {
    const parts = input.split(".").map(Number);
    return parts.every((value) => value <= 255) ? parts.join(".") : null;
  }
  if (!/^[0-9a-fA-F:.]+$/.test(input) || !input.includes(":")) return null;
  try {
    return new URL(`http://[${input}]`).hostname.toLowerCase();
  } catch {
    return null;
  }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new MaintenanceError("provider_state_invalid");
  return value as Record<string, unknown>;
}
async function readJson(response: Response): Promise<unknown> {
  if (!response.ok || !response.body) throw new MaintenanceError("provider_unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > 65536) throw new MaintenanceError("provider_state_invalid");
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new MaintenanceError("provider_state_invalid");
  }
}

/** Shared PostgreSQL admission and Cron lifecycle, not an in-memory/distributed queue. */
export function createWebAuthMaintenance(
  options: WebAuthMaintenanceOptions,
  hooks: WebAuthMaintenanceHooks,
  transport: typeof fetch = fetch,
) {
  let key: Promise<CryptoKey> | null = null;
  try {
    const bytes = decode64(options.rateKey);
    const origin = new URL(options.apiOrigin);
    if (
      options.approved &&
      options.apiKey.length > 0 &&
      options.apiKey.length <= 1024 &&
      origin.protocol === "https:" &&
      origin.origin === options.apiOrigin &&
      bytes.byteLength === 32
    )
      key = crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, [
        "sign",
      ]);
  } catch {
    /* fail unavailable, never echo configuration */
  }
  const pseudonym = async (value: string) => {
    if (!key) throw new MaintenanceError("admission_unavailable");
    return encode64(
      new Uint8Array(
        await crypto.subtle.sign(
          "HMAC",
          await key,
          new TextEncoder().encode(`web-auth-v1|${options.apiOrigin}|${value}`),
        ),
      ),
    );
  };
  const requests = new WeakMap<Request, ReturnType<typeof makeRequest>>();
  const makeRequest = (request: Request) => {
    let admitted = false;
    let networkCalls = 0;
    let boundActor: { id: string; hash: string } | null = null;
    const actorDecisions = new Map<string, Promise<AdmissionDecision>>();
    const subjects = async () => {
      if (!key || new URL(request.url).origin !== options.apiOrigin)
        throw new MaintenanceError("admission_unavailable");
      const address = normalizedAddress(hooks.trustedRemoteAddress(request));
      if (!address) throw new MaintenanceError("admission_unavailable");
      return { global: await pseudonym("global"), ip: await pseudonym(`ip|${address}`) };
    };
    let subjectPromise: ReturnType<typeof subjects> | null = null;
    const subject = () => {
      if (!subjectPromise) subjectPromise = subjects();
      return subjectPromise;
    };
    const admit = async (operation: AuthOperation): Promise<AdmissionDecision> => {
      if (admitted) return "allowed";
      try {
        const hashes = await subject();
        const allowed = await hooks.withAdmissionClient((client) =>
          admitAuthOperation(client, hashes.global, hashes.ip, operation),
        );
        admitted = allowed;
        return allowed ? "allowed" : "denied";
      } catch {
        return "unavailable";
      }
    };
    const admitActor = (actorId: string): Promise<AdmissionDecision> => {
      const parsed = canonicalUuidSchema.safeParse(actorId);
      if (!parsed.success || !admitted) return Promise.resolve("denied");
      if (boundActor && boundActor.id !== parsed.data) return Promise.resolve("denied");
      const cached = actorDecisions.get(parsed.data);
      if (cached) return cached;
      const decision = (async (): Promise<AdmissionDecision> => {
        try {
          const hash = await pseudonym(`actor|${parsed.data}`);
          const allowed = await hooks.withAdmissionClient((client) =>
            admitProviderActor(client, hash),
          );
          if (!allowed || (boundActor && boundActor.id !== parsed.data)) return "denied";
          boundActor = { id: parsed.data, hash };
          return "allowed";
        } catch {
          return "unavailable";
        }
      })();
      actorDecisions.set(parsed.data, decision);
      return decision;
    };
    const boundedTransport: typeof fetch = async (input, init) => {
      if (!admitted) throw new MaintenanceError("admission_unavailable");
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (
        url.origin !== "https://api.workos.com" ||
        url.username ||
        url.password ||
        !(
          url.pathname.startsWith("/sso/jwks/") ||
          url.pathname === "/user_management/authenticate" ||
          url.pathname === "/user_management/sessions/revoke" ||
          /^\/user_management\/users\/user_[A-Za-z0-9]+\/sessions$/.test(url.pathname)
        )
      )
        throw new MaintenanceError("admission_denied");
      if (++networkCalls > 24) throw new MaintenanceError("admission_denied");
      const hashes = await subject();
      if (
        !(await hooks.withAdmissionClient((client) =>
          admitProviderCall(client, hashes.global, hashes.ip, boundActor?.hash),
        ))
      )
        throw new MaintenanceError("admission_denied");
      // Bound even an accidentally unbounded injected provider caller. Existing
      // WorkOS clients also set their own tighter per-call deadline.
      const signals = [AbortSignal.timeout(5000)];
      if (init?.signal) signals.push(init.signal);
      return transport(input, { ...init, redirect: "error", signal: AbortSignal.any(signals) });
    };
    return { admit, admitActor, transport: boundedTransport };
  };
  const forRequest = (request: Request) => {
    const existing = requests.get(request);
    if (existing) return existing;
    const created = makeRequest(request);
    requests.set(request, created);
    return created;
  };
  const runCron = async () => {
    if (!key) throw new MaintenanceError("admission_unavailable");
    let providerCalls = 0;
    const request = async (claim: LogoutClaim, url: string, init?: RequestInit) => {
      if (providerCalls >= 48) throw new MaintenanceError("budget_exhausted");
      if (!(await hooks.withMaintenanceClient((client) => ownsLogoutLease(client, claim))))
        throw new MaintenanceError("lease_lost");
      providerCalls++;
      try {
        return await transport(url, {
          ...init,
          redirect: "error",
          signal: AbortSignal.timeout(4000),
          headers: { ...init?.headers, Authorization: `Bearer ${options.apiKey}` },
        });
      } catch {
        throw new MaintenanceError("provider_unavailable");
      }
    };
    const state = async (claim: LogoutClaim): Promise<ProviderState> => {
      let cursor: string | undefined;
      const cursors = new Set<string>();
      for (let page = 0; page < 10; page++) {
        const url = new URL(
          `https://api.workos.com/user_management/users/${claim.provider_user_id}/sessions`,
        );
        url.searchParams.set("limit", "100");
        if (cursor) url.searchParams.set("after", cursor);
        const result = object(await readJson(await request(claim, url.href)));
        if (!Array.isArray(result.data) || result.data.length > 100)
          throw new MaintenanceError("provider_state_invalid");
        for (const raw of result.data) {
          const session = object(raw);
          if (
            typeof session.id !== "string" ||
            !/^session_[A-Za-z0-9]+$/.test(session.id) ||
            session.user_id !== claim.provider_user_id ||
            session.status !== "active" ||
            typeof session.expires_at !== "string" ||
            !Number.isFinite(Date.parse(session.expires_at)) ||
            (session.ended_at != null &&
              (typeof session.ended_at !== "string" ||
                !Number.isFinite(Date.parse(session.ended_at))))
          )
            throw new MaintenanceError("provider_state_invalid");
          if (session.id === claim.provider_session_id)
            return session.ended_at != null || Date.parse(session.expires_at) <= Date.now()
              ? "inactive"
              : "active";
        }
        const after = object(result.list_metadata).after;
        if (after === null) return "inactive";
        if (
          typeof after !== "string" ||
          !/^session_[A-Za-z0-9]+$/.test(after) ||
          cursors.has(after)
        )
          throw new MaintenanceError("provider_state_invalid");
        cursors.add(after);
        cursor = after;
      }
      throw new MaintenanceError("provider_state_invalid");
    };
    const summary = {
      claimed: 0,
      completed: 0,
      pending: 0,
      stale: 0,
      providerCalls: 0,
      cleanupMore: false,
      cleanup: { attempts: 0, windows: 0, tokens: 0, sessions: 0 },
    };
    const claims = await hooks.withMaintenanceClient((client) => claimPendingLogouts(client, 5));
    summary.claimed = claims.length;
    for (const claim of claims) {
      let outcome: { complete: true } | { complete: false; failure: LogoutFailure };
      try {
        if ((await state(claim)) === "inactive") outcome = { complete: true };
        else {
          // Every retry first proves this exact provider user/session is active.
          // Lost POST replies are reconciled by another authenticated state read,
          // never immediately repeated as a blind revoke.
          try {
            const response = await request(
              claim,
              "https://api.workos.com/user_management/sessions/revoke",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: claim.provider_session_id }),
              },
            );
            await response.body?.cancel();
            if (!response.ok) throw new MaintenanceError("provider_unavailable");
          } catch (error) {
            if (
              error instanceof MaintenanceError &&
              (error.code === "lease_lost" || error.code === "budget_exhausted")
            )
              throw error;
          }
          outcome =
            (await state(claim)) === "inactive"
              ? { complete: true }
              : { complete: false, failure: "provider_still_active" };
        }
      } catch (error) {
        if (error instanceof MaintenanceError && error.code === "lease_lost") {
          summary.stale++;
          continue;
        }
        const failure =
          error instanceof MaintenanceError &&
          ["provider_state_invalid", "provider_still_active", "budget_exhausted"].includes(
            error.code,
          )
            ? (error.code as LogoutFailure)
            : "provider_unavailable";
        outcome = { complete: false, failure };
      }
      if (
        !(await hooks.withMaintenanceClient((client) => finishLogoutClaim(client, claim, outcome)))
      ) {
        summary.stale++;
        continue;
      }
      if (outcome.complete) summary.completed++;
      else summary.pending++;
    }
    // Capacity exceeds this admission's maximum per-minute expired-key arrivals.
    // Remains bounded at 32 short transactions / 3,200 rows per table per Cron.
    for (let batch = 0; batch < 32; batch++) {
      const cleaned = await hooks.withMaintenanceClient((client) => cleanupWebAuth(client, 100));
      summary.cleanup.attempts += cleaned.attempts;
      summary.cleanup.windows += cleaned.windows;
      summary.cleanup.tokens += cleaned.tokens;
      summary.cleanup.sessions += cleaned.sessions;
      summary.cleanupMore = Object.values(cleaned).some((value) => value === 100);
      if (!summary.cleanupMore) break;
    }
    summary.providerCalls = providerCalls;
    return summary;
  };
  return { forRequest, runCron };
}

const operations: Readonly<Record<string, AuthOperation>> = {
  "GET /v1/auth/start": "start",
  "GET /v1/auth/authorize": "authorize",
  "GET /v1/auth/callback": "callback",
  "GET /v1/session": "session",
  "GET /v1/security/context": "context",
  "POST /v1/session/logout": "logout",
};
/** Register BEFORE auth routes. Additional private cookie paths are parent-owned;
 * public catalogue browsing is not turned into an identity/rate-policy dependency.
 */
export function registerWebAuthAdmission(
  app: Parameters<typeof registerIdentityRoutes>[0],
  maintenance: ReturnType<typeof createWebAuthMaintenance>,
  protectedCookiePrefixes: readonly string[] = [],
) {
  if (protectedCookiePrefixes.some((path) => !/^\/v1\/[A-Za-z0-9/_-]+$/.test(path)))
    throw new Error("Invalid protected auth path");
  app.use("/v1/*", async (context, next) => {
    const request = context.req.raw;
    const path = new URL(request.url).pathname;
    const operation =
      operations[`${request.method} ${path}`] ??
      (protectedCookiePrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) &&
      request.headers.get("cookie")?.includes("__Host-k_session=")
        ? "session"
        : undefined);
    if (!operation) return next();
    // Shared identity rejects mixed credentials before provider work; native owns bearer admission.
    if (path === "/v1/session" && request.headers.has("authorization")) return next();
    const result = await maintenance.forRequest(request).admit(operation);
    if (result === "allowed") return next();
    context.header("Cache-Control", "no-store");
    if (result === "denied") context.header("Retry-After", "60");
    return context.json(
      {
        error: {
          code: result === "denied" ? "AUTH_RATE_LIMITED" : "IDENTITY_UNAVAILABLE",
          message: "Authentication request cannot proceed.",
          requestId: context.get("requestId"),
        },
      },
      result === "denied" ? 429 : 503,
    );
  });
}
