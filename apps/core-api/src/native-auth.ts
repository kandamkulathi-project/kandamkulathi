import type { IdentityDependencies, registerIdentityRoutes } from "@kandamkulathi/server/identity";
import { canonicalUuidSchema } from "../../../packages/contracts/src/identifiers.ts";
import type { VerifiedIdentity } from "../../../packages/contracts/src/identity.ts";
import {
  nativeCredentialSchema,
  nativeExchangeSchema,
  nativeLogoutKeySchema,
  nativeStartSchema,
} from "../../../packages/contracts/src/native-auth.ts";
import {
  type DatabaseClient,
  inTransaction,
  transaction,
} from "../../../packages/database/src/client.ts";
import {
  linkWorkosSession,
  loadCurrentAuthorityInTransaction,
  withIdentityTransaction,
} from "../../../packages/database/src/identity.ts";
import {
  claimNativeLogout,
  cleanupNativeAuth,
  consumeNativeAttempt,
  finishNativeLogout,
  guardNativeSession,
  nativeAdmission,
  ownsNativeLogout,
  readNativeSession,
} from "../../../packages/database/src/native-auth.ts";
import {
  createWorkosVerifier,
  type WorkosOptions,
} from "../../../packages/providers/src/workos/index.ts";
import { createNativeWorkosOAuth } from "../../../packages/providers/src/workos/native-oauth.ts";
import {
  createWebSecrets,
  digest,
  randomSecret,
} from "../../../packages/providers/src/workos/oauth.ts";

type WithClient = <T>(callback: (client: DatabaseClient) => Promise<T>) => Promise<T>;
type App = Parameters<typeof registerIdentityRoutes>[0];
export interface NativeAuthOptions extends WorkosOptions {
  apiOrigin: string;
  environment: "local" | "dev" | "staging" | "production";
  /** Explicit environment approval, not mere SDK callback support. No inferred defaults. */
  allowedRedirects: readonly { environment: string; redirectUri: string }[];
  encryptionKey: string;
  attemptTtlSeconds: number;
  sessionTtlSeconds: number;
  organizationMappings?: Readonly<Record<string, string>>;
}
class NativeAuthError extends Error {
  readonly status: 400 | 401 | 403 | 409 | 429 | 503;
  readonly code: string;
  constructor(status: 400 | 401 | 403 | 409 | 429 | 503, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
const denied = () => new NativeAuthError(401, "UNAUTHENTICATED");
const unavailable = () => new NativeAuthError(503, "IDENTITY_UNAVAILABLE");
const bearer = (request: Request) => {
  const header = request.headers.get("authorization");
  const parsed = nativeCredentialSchema.safeParse(
    header?.startsWith("Bearer ") ? header.slice(7) : null,
  );
  return parsed.success ? parsed.data : null;
};
const supportedRedirect = (environment: string) => `kandamkulathi-${environment}://auth/return`;

/** Explicit native bearer composition. Does not alter web cookies, web logout or root dispatch. */
export function createNativeAuthRuntime(
  options: NativeAuthOptions,
  withClient: WithClient,
  transport: typeof fetch = fetch,
  now = Date.now,
) {
  let secrets: ReturnType<typeof createWebSecrets> | null = null;
  try {
    const origin = new URL(options.apiOrigin);
    if (
      options.approved &&
      options.apiKey &&
      /^client_[A-Za-z0-9]+$/.test(options.clientId) &&
      /^https:\/\/[^/?#@]+\/?$/.test(options.issuer) &&
      origin.protocol === "https:" &&
      origin.origin === options.apiOrigin &&
      ["local", "dev", "staging", "production"].includes(options.environment) &&
      options.allowedRedirects.some(
        (entry) =>
          entry.environment === options.environment &&
          entry.redirectUri === supportedRedirect(options.environment),
      ) &&
      Number.isInteger(options.attemptTtlSeconds) &&
      options.attemptTtlSeconds >= 30 &&
      options.attemptTtlSeconds <= 600 &&
      Number.isInteger(options.sessionTtlSeconds) &&
      options.sessionTtlSeconds >= 30 &&
      options.sessionTtlSeconds <= 900
    )
      secrets = createWebSecrets(
        options.encryptionKey,
        `native|${options.environment}|${options.apiOrigin}`,
      );
  } catch {
    /* Fail closed; never echo configuration. */
  }
  const requireSecrets = () => {
    if (!secrets) throw unavailable();
    return secrets;
  };
  const nativeRequest = (request: Request) =>
    new URL(request.url).origin === options.apiOrigin &&
    !request.headers.has("cookie") &&
    !request.headers.has("origin") &&
    !request.headers.has("sec-fetch-site");
  const requireRequest = (request: Request, anonymous = false) => {
    requireSecrets();
    if (!nativeRequest(request) || (anonymous && request.headers.has("authorization")))
      throw new NativeAuthError(403, "FORBIDDEN");
  };
  const requireRedirect = (redirect: string) => {
    if (
      redirect !== supportedRedirect(options.environment) ||
      !options.allowedRedirects.some(
        (entry) => entry.environment === options.environment && entry.redirectUri === redirect,
      )
    )
      throw new NativeAuthError(403, "FORBIDDEN");
  };
  const admit = async (lane: Parameters<typeof nativeAdmission>[1]) => {
    if (!(await withClient((client) => nativeAdmission(client, lane))))
      throw new NativeAuthError(429, "RATE_LIMITED");
  };
  // Every HTTPS call, including JWKS and each live-session page, spends durable budget.
  // Admission commits before external I/O; this transport is never called with a held transaction.
  const budgetedTransport: typeof fetch = async (input, init) => {
    await admit("provider");
    return transport(input, init);
  };
  const oauth = createNativeWorkosOAuth(options, budgetedTransport, now);
  const verifyProvider = createWorkosVerifier(options, budgetedTransport, now);
  const verifyNative = async (request: Request) => {
    requireRequest(request);
    const credential = bearer(request);
    if (!credential) return { status: "unauthenticated" } as const;
    await admit("session");
    const hash = await digest(credential);
    const row = await withClient((client) =>
      transaction(client, () => readNativeSession(client, hash)),
    );
    if (!row || row.revoked_at || row.expires_at.getTime() <= now())
      return { status: "unauthenticated" } as const;
    const token = await requireSecrets().open(row.access_ciphertext, `access|${hash}`);
    const provider = await verifyProvider(
      new Request(options.apiOrigin, { headers: { Authorization: `Bearer ${token}` } }),
    );
    if (provider.status !== "verified") return provider;
    if (
      provider.session.userId !== row.provider_user_id ||
      provider.session.sessionId !== row.provider_session_id
    )
      return { status: "unauthenticated" } as const;
    const identity = await withClient((client) => linkWorkosSession(client, provider.session));
    if (
      !identity ||
      identity.actorId !== row.actor_id ||
      identity.sessionId !== row.session_id ||
      Date.parse(identity.authenticatedAt) > now() ||
      Date.parse(identity.expiresAt) <= now()
    )
      return { status: "unauthenticated" } as const;
    identity.expiresAt = new Date(
      Math.min(Date.parse(identity.expiresAt), row.expires_at.getTime()),
    ).toISOString();
    // Preprivacy authentication is NOT a ClientSession and confers no grants.
    const active = await withClient((client) =>
      transaction(client, async () => {
        const authority = await loadCurrentAuthorityInTransaction(client, identity);
        await guardNativeSession(client, hash, identity, now());
        return (
          authority.accountStatus === "active" &&
          !authority.sessionRevokedAt &&
          Date.parse(authority.sessionExpiresAt) > now()
        );
      }),
    );
    if (!active) return { status: "unauthenticated" } as const;
    return { status: "verified", identity, hash } as const;
  };
  const dependencies: IdentityDependencies = {
    now,
    async verifySession(request) {
      try {
        const verified = await verifyNative(request);
        if (verified.status !== "verified") return { status: verified.status };
        return { status: "verified", identity: verified.identity };
      } catch (error) {
        if (error instanceof NativeAuthError && error.status === 403)
          return { status: "unauthenticated" };
        return { status: "unavailable" };
      }
    },
    loadCurrentAuthority: (identity) =>
      withClient((client) =>
        withIdentityTransaction(client, identity, async (authority) => authority),
      ),
  };
  const withNativeSessionInTransaction = async <T>(
    client: DatabaseClient,
    request: Request,
    identity: VerifiedIdentity,
    callback: (
      authority: Awaited<ReturnType<typeof loadCurrentAuthorityInTransaction>>,
    ) => Promise<T>,
  ) => {
    if (!inTransaction(client)) throw new Error("Native guard requires platform transaction");
    requireRequest(request);
    const credential = bearer(request);
    if (!credential) throw denied();
    const authority = await loadCurrentAuthorityInTransaction(client, identity);
    await guardNativeSession(client, await digest(credential), identity, now());
    if (
      authority.accountStatus !== "active" ||
      authority.sessionRevokedAt ||
      Date.parse(authority.sessionExpiresAt) <= now() ||
      Date.parse(identity.authenticatedAt) > now() ||
      Date.parse(identity.expiresAt) <= now()
    )
      throw denied();
    return callback(authority);
  };
  const verifyMutationRequest = async (
    request: Request,
    binding: { actorId: string; sessionId: string },
  ): Promise<"allowed" | "denied" | "unavailable"> => {
    try {
      const actor = canonicalUuidSchema.safeParse(binding.actorId);
      const session = canonicalUuidSchema.safeParse(binding.sessionId);
      if (!actor.success || !session.success) return "denied";
      const verified = await verifyNative(request);
      if (verified.status === "unavailable") return "unavailable";
      return verified.status === "verified" &&
        verified.identity.actorId === actor.data &&
        verified.identity.sessionId === session.data
        ? "allowed"
        : "denied";
    } catch (error) {
      return error instanceof NativeAuthError && error.status === 403 ? "denied" : "unavailable";
    }
  };
  const start = async (request: Request, input: unknown) => {
    requireRequest(request, true);
    const proof = nativeStartSchema.safeParse(input);
    if (!proof.success) throw new NativeAuthError(400, "INVALID_INPUT");
    requireRedirect(proof.data.redirectUri);
    await admit("start");
    const stateHash = await digest(proof.data.state);
    const accepted = await withClient((client) =>
      transaction(client, async () => {
        const result = await client.query("SELECT core.native_auth_start($1,$2,$3,$4) accepted", [
          stateHash,
          proof.data.redirectUri,
          proof.data.codeChallenge,
          new Date(now() + options.attemptTtlSeconds * 1000),
        ]);
        return result.rows[0]?.accepted === true;
      }),
    );
    if (!accepted) throw new NativeAuthError(409, "ATTEMPT_REJECTED");
    return { authorizationUrl: oauth.authorizationUrl(proof.data) };
  };
  const exchange = async (request: Request, input: unknown) => {
    requireRequest(request, true);
    const parsed = nativeExchangeSchema.safeParse(input);
    if (!parsed.success) throw new NativeAuthError(400, "INVALID_INPUT");
    const data = parsed.data;
    requireRedirect(data.redirectUri);
    await admit("exchange");
    const stateHash = await digest(data.state);
    const challenge = await digest(data.codeVerifier);
    const consumed = await withClient((client) =>
      consumeNativeAttempt(client, stateHash, data.redirectUri, challenge),
    );
    if (!consumed) throw denied();
    // COMMITTED consumption precedes ALL provider calls. Never retry uncertain exchange.
    const tokens = await oauth.exchange(data.code, data.codeVerifier, data.redirectUri);
    const provider = await verifyProvider(
      new Request(options.apiOrigin, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }),
    );
    if (provider.status !== "verified")
      throw provider.status === "unavailable" ? unavailable() : denied();
    if (provider.session.userId !== tokens.userId) throw denied();
    let organization: string | null = null;
    if (provider.session.organizationId) {
      const mapped = canonicalUuidSchema.safeParse(
        options.organizationMappings?.[provider.session.organizationId],
      );
      if (!mapped.success) throw new NativeAuthError(403, "FORBIDDEN");
      organization = mapped.data;
    }
    const credential = `n1_${randomSecret()}`;
    const hash = await digest(credential);
    const expires = new Date(
      Math.min(Date.parse(provider.session.expiresAt), now() + options.sessionTtlSeconds * 1000),
    );
    const ciphertext = await requireSecrets().seal(tokens.accessToken, `access|${hash}`);
    const enrolled = await withClient((client) =>
      transaction(client, async () => {
        const result = await client.query(
          "SELECT * FROM core.native_auth_enroll($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            hash,
            provider.session.userId,
            provider.session.sessionId,
            provider.session.organizationId,
            organization,
            provider.session.issuedAt,
            provider.session.expiresAt,
            expires,
            ciphertext,
          ],
        );
        return result.rowCount === 1;
      }),
    );
    if (!enrolled) throw new NativeAuthError(403, "FORBIDDEN");
    return { credential: nativeCredentialSchema.parse(credential) };
  };
  const localLogout = async (request: Request, key: string) => {
    requireRequest(request);
    if (!nativeLogoutKeySchema.safeParse(key).success)
      throw new NativeAuthError(400, "INVALID_INPUT");
    const credential = bearer(request);
    if (!credential) throw denied();
    await admit("logout");
    const hash = await digest(credential);
    const keyHash = await digest(key);
    const prior = await withClient((client) =>
      transaction(client, () => readNativeSession(client, hash)),
    );
    if (prior?.revoked_at) {
      // A consumed credential is usable ONLY for this exact idempotent logout result.
      if (prior.logout_key_hash !== keyHash || prior.expires_at.getTime() + 86400000 <= now())
        throw denied();
      return { hash, pending: prior.pending };
    }
    // An expired handle can revoke ONLY its persisted identity/provider binding.
    // The database independently enforces expiry and that complete binding. Never
    // pass this lookup through ordinary authentication or revive an expired JWT.
    const expired = prior !== null && prior.expires_at.getTime() <= now();
    const current = expired ? null : await verifyNative(request);
    if (!expired && current?.status !== "verified")
      throw current?.status === "unavailable" ? unavailable() : denied();
    const actorId = expired
      ? prior.actor_id
      : current?.status === "verified"
        ? current.identity.actorId
        : null;
    const sessionId = expired
      ? prior.session_id
      : current?.status === "verified"
        ? current.identity.sessionId
        : null;
    const revoked = await withClient((client) =>
      transaction(client, async () => {
        const result = await client.query(
          expired
            ? "SELECT core.native_auth_revoke_expired($1,$2,$3,$4) revoked"
            : "SELECT core.native_auth_revoke($1,$2,$3,$4) revoked",
          [hash, actorId, sessionId, keyHash],
        );
        return result.rows[0]?.revoked === true;
      }),
    );
    if (!revoked) throw new NativeAuthError(409, "LOGOUT_CONFLICT");
    return { hash, pending: true };
  };
  const maintenance = (withJobsClient: WithClient) => {
    const reconcile = async (handleHash?: string) => {
      requireSecrets();
      const claim = await withJobsClient((client) => claimNativeLogout(client, handleHash));
      if (!claim) return false;
      let complete = false;
      try {
        // Leases are committed before external I/O. Re-read ownership before a provider effect.
        if (!(await withJobsClient((client) => ownsNativeLogout(client, claim)))) return false;
        if (await oauth.active(claim.provider_user_id, claim.provider_session_id)) {
          if (!(await withJobsClient((client) => ownsNativeLogout(client, claim)))) return false;
          await oauth.revoke(claim.provider_session_id);
          complete = !(await oauth.active(claim.provider_user_id, claim.provider_session_id));
        } else complete = true;
      } catch {
        /* Unknown provider state stays pending. Next lease reconciles BEFORE retry. */
      }
      return withJobsClient((client) => finishNativeLogout(client, claim, complete));
    };
    return {
      reconcile,
      async run() {
        requireSecrets();
        for (let index = 0; index < 5; index++) await reconcile();
        await withJobsClient(cleanupNativeAuth);
      },
    };
  };
  return {
    dependencies,
    start,
    exchange,
    localLogout,
    verifyMutationRequest,
    withNativeSessionInTransaction,
    maintenance,
    async logoutComplete(hash: string) {
      return withClient((client) =>
        transaction(client, async () => {
          const row = await readNativeSession(client, hash);
          return !!row?.revoked_at && !row.pending;
        }),
      );
    },
  };
}

type Runtime = ReturnType<typeof createNativeAuthRuntime>;
type Maintenance = ReturnType<Runtime["maintenance"]>;
/** Strict bounded JSON; body/token/provider exceptions never enter responses or logs. */
async function readBody(request: Request): Promise<unknown> {
  if (request.headers.get("content-type") !== "application/json" || !request.body)
    throw new NativeAuthError(400, "INVALID_INPUT");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > 4096) throw new NativeAuthError(400, "INVALID_INPUT");
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes));
  } catch {
    throw new NativeAuthError(400, "INVALID_INPUT");
  }
}
export function registerNativeAuthRoutes(app: App, runtime: Runtime, maintenance?: Maintenance) {
  for (const operation of ["start", "exchange", "logout"] as const) {
    app.post(`/v1/native-auth/${operation}`, async (context) => {
      context.header("Cache-Control", "no-store");
      try {
        if (new URL(context.req.url).search) throw new NativeAuthError(400, "INVALID_INPUT");
        const body = await readBody(context.req.raw);
        if (operation === "start") return context.json(await runtime.start(context.req.raw, body));
        if (operation === "exchange")
          return context.json(await runtime.exchange(context.req.raw, body));
        if (
          body === null ||
          typeof body !== "object" ||
          Array.isArray(body) ||
          Object.keys(body).length !== 0
        )
          throw new NativeAuthError(400, "INVALID_INPUT");
        const result = await runtime.localLogout(
          context.req.raw,
          context.req.header("idempotency-key") ?? "",
        );
        if (result.pending && maintenance) await maintenance.reconcile(result.hash);
        if (!(await runtime.logoutComplete(result.hash)))
          throw new NativeAuthError(503, "LOGOUT_PENDING");
        return context.json({ revoked: true });
      } catch (error) {
        const safe = error instanceof NativeAuthError ? error : unavailable();
        if (safe.status === 429) context.header("Retry-After", "60");
        return context.json(
          {
            error: {
              code: safe.code,
              message:
                operation === "logout"
                  ? "Logout not confirmed."
                  : "Sign in could not complete. Restart sign in.",
            },
          },
          safe.status,
        );
      }
    });
  }
}
