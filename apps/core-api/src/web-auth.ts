import type { IdentityDependencies, registerIdentityRoutes } from "@kandamkulathi/server/identity";
import { canonicalUuidSchema } from "../../../packages/contracts/src/identifiers.ts";
import {
  type VerifiedIdentity,
  verifiedIdentitySchema,
} from "../../../packages/contracts/src/identity.ts";
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
  createWorkosVerifier,
  type WorkosOptions,
  type WorkosSession,
} from "../../../packages/providers/src/workos/index.ts";
import {
  createWebSecrets,
  createWorkosOAuth,
  digest,
  randomSecret,
} from "../../../packages/providers/src/workos/oauth.ts";

type WithClient = <T>(callback: (client: DatabaseClient) => Promise<T>) => Promise<T>;
type App = Parameters<typeof registerIdentityRoutes>[0];
export interface WebAuthOptions extends WorkosOptions {
  apiOrigin: string;
  callbackUrl: string;
  returnUrl: string;
  allowedReturnUrls: readonly string[];
  cookieKey: string;
  attemptTtlSeconds: number;
  sessionTtlSeconds: number;
  /** Approved provider-org -> internal-org mapping. No mapping means no staff enrollment. */
  organizationMappings?: Readonly<Record<string, string>>;
}
export interface WebAuthHooks {
  /** Inject the coordinator's browser-origins policy, not a second origin allowlist. */
  approvedBrowserOrigin(origin: string, requestURL: string): boolean;
  admitActor?(actorId: string): Promise<"allowed" | "denied" | "unavailable">;
}
const sessionCookie = "__Host-k_session";
const attemptCookie = "__Host-k_auth_attempt";
const secretPattern = /^[A-Za-z0-9_-]{43}$/;
const set = async (client: DatabaseClient, name: string, value: string) => {
  await client.query("SELECT set_config($1,$2,true)", [name, value]);
};
const cookie = (name: string, value: string, maxAge: number) =>
  `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAge))}`;
function readCookie(request: Request, name: string): string | null {
  const matches = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((value) => value.trim())
    .filter((value) => value.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  const value = matches[0]?.slice(name.length + 1);
  return value && value.length < 4096 ? value : null;
}
class WebAuthError extends Error {
  readonly status: 400 | 401 | 403 | 409 | 503;
  readonly code: string;
  constructor(status: 400 | 401 | 403 | 409 | 503, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
function validConfiguration(options: WebAuthOptions) {
  try {
    const origin = new URL(options.apiOrigin);
    const callback = new URL(options.callbackUrl);
    const destination = new URL(options.returnUrl);
    return (
      options.approved &&
      !!options.apiKey &&
      /^client_[A-Za-z0-9]+$/.test(options.clientId) &&
      /^https:\/\/[^/?#@]+\/?$/.test(options.issuer) &&
      origin.protocol === "https:" &&
      origin.origin === options.apiOrigin &&
      !origin.username &&
      !origin.password &&
      callback.origin === origin.origin &&
      callback.pathname === "/v1/auth/callback" &&
      !callback.search &&
      !callback.hash &&
      destination.protocol === "https:" &&
      !destination.username &&
      !destination.password &&
      options.allowedReturnUrls.includes(options.returnUrl) &&
      Number.isInteger(options.attemptTtlSeconds) &&
      options.attemptTtlSeconds >= 30 &&
      options.attemptTtlSeconds <= 600 &&
      Number.isInteger(options.sessionTtlSeconds) &&
      options.sessionTtlSeconds >= 30 &&
      options.sessionTtlSeconds <= 86400
    );
  } catch {
    return false;
  }
}

/** Explicit web-only composition; native bearer transport is intentionally unaffected. */
export function createWebAuthRuntime(
  options: WebAuthOptions,
  withClient: WithClient,
  hooks: WebAuthHooks,
  transport: typeof fetch = fetch,
  now = Date.now,
) {
  const verifyProvider = createWorkosVerifier(options, transport, now);
  const oauth = createWorkosOAuth(options, options.callbackUrl, transport);
  let secrets: ReturnType<typeof createWebSecrets> | null = null;
  try {
    if (validConfiguration(options))
      secrets = createWebSecrets(options.cookieKey, options.apiOrigin);
  } catch {
    /* unavailable */
  }
  const requireSecrets = () => {
    if (!secrets) throw new WebAuthError(503, "IDENTITY_UNAVAILABLE");
    return secrets;
  };
  const localRequest = (request: Request) => new URL(request.url).origin === options.apiOrigin;
  const browserRequest = (request: Request, requireOrigin: boolean) => {
    if (!localRequest(request)) return false;
    const origin = request.headers.get("origin");
    return origin
      ? hooks.approvedBrowserOrigin(origin, request.url)
      : !requireOrigin && request.headers.get("sec-fetch-site") !== "cross-site";
  };
  const openCookie = async (request: Request, name: string, purpose: string) => {
    const material = requireSecrets();
    const value = readCookie(request, name);
    if (!value) return null;
    try {
      const plain = await material.open(value, purpose);
      return secretPattern.test(plain) ? plain : null;
    } catch {
      return null;
    }
  };
  const readLocalSession = async (handle: string, client: DatabaseClient, lock = false) => {
    await set(client, "identity.web_handle", await digest(handle));
    const result = await client.query(
      `SELECT * FROM core.identity_web_sessions WHERE handle_hash=$1${lock ? " FOR SHARE" : ""}`,
      [await digest(handle)],
    );
    return result.rows[0];
  };
  const verifyCookie = async (request: Request) => {
    requireSecrets();
    if (!localRequest(request) || request.headers.has("authorization"))
      return { status: "unauthenticated" } as const;
    const handle = await openCookie(request, sessionCookie, "session-cookie");
    if (!handle) return { status: "unauthenticated" } as const;
    const row = await withClient((client) =>
      transaction(client, () => readLocalSession(handle, client)),
    );
    if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= now())
      return { status: "unauthenticated" } as const;
    if (hooks.admitActor && (await hooks.admitActor(row.actor_id)) !== "allowed")
      return { status: "unavailable" } as const;
    let accessToken: string;
    try {
      accessToken = await requireSecrets().open(
        row.access_token_ciphertext,
        `provider-token|${await digest(handle)}`,
      );
    } catch {
      return { status: "unavailable" } as const;
    }
    const provider = await verifyProvider(
      new Request(options.apiOrigin, { headers: { authorization: `Bearer ${accessToken}` } }),
    );
    if (provider.status !== "verified") return provider;
    const identity = await withClient((client) => linkWorkosSession(client, provider.session));
    if (!identity || identity.actorId !== row.actor_id || identity.sessionId !== row.session_id)
      return { status: "unauthenticated" } as const;
    identity.expiresAt = new Date(
      Math.min(Date.parse(identity.expiresAt), new Date(row.expires_at).getTime()),
    ).toISOString();
    if (Date.parse(identity.authenticatedAt) > now() || Date.parse(identity.expiresAt) <= now())
      return { status: "unauthenticated" } as const;
    return {
      status: "verified",
      identity,
      handle,
      providerSessionId: provider.session.sessionId,
    } as const;
  };
  const dependencies: IdentityDependencies = {
    now,
    async verifySession(request) {
      try {
        const result = await verifyCookie(request);
        if (result.status !== "verified") return { status: result.status };
        return { status: "verified", identity: result.identity };
      } catch {
        return { status: "unavailable" };
      }
    },
    loadCurrentAuthority: (identity) =>
      withClient((client) =>
        withIdentityTransaction(client, identity, async (authority) => authority),
      ),
  };
  const verifyMutationRequest = async (
    request: Request,
    bindings: { actorId: string; sessionId: string },
  ): Promise<"allowed" | "denied" | "unavailable"> => {
    try {
      requireSecrets();
      if (!browserRequest(request, true)) return "denied";
      const result = await verifyCookie(request);
      if (result.status === "unavailable") return "unavailable";
      if (result.status !== "verified") return "denied";
      const actor = canonicalUuidSchema.safeParse(bindings.actorId);
      const session = canonicalUuidSchema.safeParse(bindings.sessionId);
      if (
        !actor.success ||
        !session.success ||
        result.identity.actorId !== actor.data ||
        result.identity.sessionId !== session.data
      )
        return "denied";
      return (await requireSecrets().verifyCsrf(
        `${result.handle}|${actor.data}|${session.data}`,
        request.headers.get("x-csrf-token") ?? "",
      ))
        ? "allowed"
        : "denied";
    } catch {
      return "unavailable";
    }
  };
  const withWebSessionInTransaction = async <T>(
    client: DatabaseClient,
    request: Request,
    input: VerifiedIdentity,
    callback: (
      authority: Awaited<ReturnType<typeof loadCurrentAuthorityInTransaction>>,
    ) => Promise<T>,
  ) => {
    if (!inTransaction(client)) throw new Error("Web session requires platform transaction");
    const identity = verifiedIdentitySchema.parse(input);
    const authority = await loadCurrentAuthorityInTransaction(client, identity);
    const handle = await openCookie(request, sessionCookie, "session-cookie");
    if (!handle || !localRequest(request)) throw new WebAuthError(401, "UNAUTHENTICATED");
    const row = await readLocalSession(handle, client, true);
    if (
      !row ||
      row.revoked_at ||
      row.actor_id !== identity.actorId ||
      row.session_id !== identity.sessionId ||
      new Date(row.expires_at).getTime() <= now()
    )
      throw new WebAuthError(401, "UNAUTHENTICATED");
    return callback(authority);
  };
  const enrollAndPersist = async (provider: WorkosSession, accessToken: string, handle: string) => {
    let organizationId: string | null = null;
    if (provider.organizationId) {
      const mapped = canonicalUuidSchema.safeParse(
        options.organizationMappings?.[provider.organizationId],
      );
      if (!mapped.success) throw new WebAuthError(403, "FORBIDDEN");
      organizationId = mapped.data;
    }
    const expires = new Date(
      Math.min(Date.parse(provider.expiresAt), now() + options.sessionTtlSeconds * 1000),
    );
    if (expires.getTime() <= now()) throw new WebAuthError(401, "UNAUTHENTICATED");
    const hash = await digest(handle);
    const ciphertext = await requireSecrets().seal(accessToken, `provider-token|${hash}`);
    await withClient((client) =>
      transaction(client, async () => {
        const policy = await client.query("SELECT singleton FROM core.identity_policy FOR SHARE");
        if (policy.rowCount !== 1) throw new WebAuthError(503, "IDENTITY_UNAVAILABLE");
        await set(client, "identity.web_verified_user", provider.userId);
        await set(client, "identity.provider_user", provider.userId);
        await set(client, "identity.provider_session", provider.sessionId);
        const actors = await client.query(
          "SELECT id,status FROM core.identity_actors WHERE provider_user_id=$1 FOR UPDATE",
          [provider.userId],
        );
        const actor = actors.rows[0];
        if (actor?.status !== "active") throw new WebAuthError(403, "FORBIDDEN");
        await set(client, "identity.actor_id", actor.id);
        await set(client, "identity.web_organization", organizationId ?? "");
        const id = crypto.randomUUID();
        await client.query(
          `INSERT INTO core.identity_sessions(id,actor_id,provider_user_id,provider_session_id,provider_organization_id,
        organization_id,authenticated_at,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(provider_session_id) DO NOTHING`,
          [
            id,
            actor.id,
            provider.userId,
            provider.sessionId,
            provider.organizationId,
            organizationId,
            provider.issuedAt,
            provider.expiresAt,
          ],
        );
        const sessions = await client.query(
          "SELECT * FROM core.identity_sessions WHERE provider_session_id=$1 FOR SHARE",
          [provider.sessionId],
        );
        const session = sessions.rows[0];
        if (
          !session ||
          session.actor_id !== actor.id ||
          session.organization_id !== organizationId ||
          session.revoked_at ||
          new Date(session.expires_at).getTime() <= now()
        )
          throw new WebAuthError(401, "UNAUTHENTICATED");
        await set(client, "identity.internal_session", session.id);
        await set(client, "identity.web_handle", hash);
        await client.query(
          `INSERT INTO core.identity_web_sessions(handle_hash,actor_id,session_id,access_token_ciphertext,expires_at)
        VALUES ($1,$2,$3,$4,$5)`,
          [hash, actor.id, session.id, ciphertext, expires],
        );
      }),
    );
    return expires;
  };
  return {
    options,
    dependencies,
    withClient,
    verifyMutationRequest,
    withWebSessionInTransaction,
    requireSecrets,
    oauth,
    verifyProvider,
    verifyCookie,
    openCookie,
    browserRequest,
    localRequest,
    enrollAndPersist,
    readLocalSession,
    now,
  };
}

export function registerWebAuthRoutes(app: App, runtime: ReturnType<typeof createWebAuthRuntime>) {
  const fail = (error: unknown) =>
    error instanceof WebAuthError ? error : new WebAuthError(503, "IDENTITY_UNAVAILABLE");
  const completeLogout = async (hash: string, actorId: string, providerSessionId: string) => {
    try {
      await runtime.oauth.revoke(providerSessionId);
      await runtime.withClient((client) =>
        transaction(client, async () => {
          await set(client, "identity.actor_id", actorId);
          await set(client, "identity.web_handle", hash);
          await client.query(
            "UPDATE core.identity_web_sessions SET revocation_pending=false WHERE handle_hash=$1 AND revoked_at IS NOT NULL",
            [hash],
          );
        }),
      );
    } catch {
      throw new WebAuthError(503, "LOGOUT_PENDING");
    }
  };
  // No provider credentials, authorization codes, state, tokens or cookie material enter errors/logs.
  app.get("/v1/auth/start", async (context) => {
    context.header("Cache-Control", "no-store");
    try {
      runtime.requireSecrets();
      if (!runtime.browserRequest(context.req.raw, false)) throw new WebAuthError(403, "FORBIDDEN");
      return context.json({ redirectPath: "/v1/auth/authorize" });
    } catch (error) {
      const denied = fail(error);
      return context.json(
        { error: { code: denied.code, message: "Sign in unavailable." } },
        denied.status,
      );
    }
  });
  app.get("/v1/auth/authorize", async (context) => {
    context.header("Cache-Control", "no-store");
    context.header("Referrer-Policy", "no-referrer");
    try {
      const secrets = runtime.requireSecrets();
      if (!runtime.browserRequest(context.req.raw, false) || new URL(context.req.url).search)
        throw new WebAuthError(403, "FORBIDDEN");
      const browser =
        (await runtime.openCookie(context.req.raw, attemptCookie, "attempt-cookie")) ??
        randomSecret();
      const state = randomSecret();
      const verifier = randomSecret();
      const browserHash = await digest(browser);
      const stateHash = await digest(state);
      const ciphertext = await secrets.seal(verifier, `pkce|${browserHash}|${stateHash}`);
      const expiry = new Date(runtime.now() + runtime.options.attemptTtlSeconds * 1000);
      await runtime.withClient((client) =>
        transaction(client, async () => {
          await set(client, "identity.web_browser", browserHash);
          await client.query(
            `INSERT INTO core.identity_web_attempts(browser_hash,state_hash,verifier_ciphertext,expires_at)
          VALUES ($1,$2,$3,$4) ON CONFLICT(browser_hash) DO UPDATE SET state_hash=EXCLUDED.state_hash,
          verifier_ciphertext=EXCLUDED.verifier_ciphertext,expires_at=EXCLUDED.expires_at,consumed_at=NULL`,
            [browserHash, stateHash, ciphertext, expiry],
          );
        }),
      );
      context.header(
        "Set-Cookie",
        cookie(
          attemptCookie,
          await secrets.seal(browser, "attempt-cookie"),
          runtime.options.attemptTtlSeconds,
        ),
      );
      return context.redirect(await runtime.oauth.authorizationUrl(state, verifier), 302);
    } catch (error) {
      const denied = fail(error);
      return context.json(
        { error: { code: denied.code, message: "Sign in unavailable." } },
        denied.status,
      );
    }
  });
  app.get("/v1/auth/callback", async (context) => {
    context.header("Cache-Control", "no-store");
    context.header("Referrer-Policy", "no-referrer");
    try {
      const secrets = runtime.requireSecrets();
      const url = new URL(context.req.url);
      if (
        !runtime.localRequest(context.req.raw) ||
        url.searchParams.getAll("state").length !== 1 ||
        url.searchParams.getAll("code").length !== 1 ||
        Array.from(url.searchParams.keys()).some((key) => key !== "state" && key !== "code")
      )
        throw new WebAuthError(400, "INVALID_CALLBACK");
      const state = url.searchParams.get("state") ?? "";
      const code = url.searchParams.get("code") ?? "";
      if (!secretPattern.test(state) || !/^[A-Za-z0-9_-]{1,2048}$/.test(code))
        throw new WebAuthError(400, "INVALID_CALLBACK");
      const browser = await runtime.openCookie(context.req.raw, attemptCookie, "attempt-cookie");
      if (!browser) throw new WebAuthError(401, "INVALID_CALLBACK");
      const browserHash = await digest(browser);
      const stateHash = await digest(state);
      // Consume and COMMIT before external exchange. An uncertain provider reply never
      // permits code replay: the user must restart sign-in with a fresh attempt.
      const ciphertext = await runtime.withClient((client) =>
        transaction(client, async () => {
          await set(client, "identity.web_browser", browserHash);
          const result = await client.query(
            `UPDATE core.identity_web_attempts SET consumed_at=$3
          WHERE browser_hash=$1 AND state_hash=$2 AND consumed_at IS NULL AND expires_at>$3 RETURNING verifier_ciphertext`,
            [browserHash, stateHash, new Date(runtime.now())],
          );
          if (result.rowCount !== 1) throw new WebAuthError(401, "INVALID_CALLBACK");
          return result.rows[0].verifier_ciphertext as string;
        }),
      );
      context.header("Set-Cookie", cookie(attemptCookie, "", 0));
      const verifier = await secrets.open(ciphertext, `pkce|${browserHash}|${stateHash}`);
      const exchange = await runtime.oauth.exchange(code, verifier);
      const verification = await runtime.verifyProvider(
        new Request(runtime.options.apiOrigin, {
          headers: { authorization: `Bearer ${exchange.accessToken}` },
        }),
      );
      if (verification.status !== "verified")
        throw new WebAuthError(
          verification.status === "unavailable" ? 503 : 401,
          "IDENTITY_UNAVAILABLE",
        );
      if (verification.session.userId !== exchange.userId)
        throw new WebAuthError(401, "INVALID_CALLBACK");
      const handle = randomSecret();
      const expires = await runtime.enrollAndPersist(
        verification.session,
        exchange.accessToken,
        handle,
      );
      context.header(
        "Set-Cookie",
        cookie(
          sessionCookie,
          await secrets.seal(handle, "session-cookie"),
          (expires.getTime() - runtime.now()) / 1000,
        ),
        { append: true },
      );
      return context.redirect(runtime.options.returnUrl, 303);
    } catch (error) {
      const denied = fail(error);
      return context.json(
        { error: { code: denied.code, message: "Sign in could not complete. Restart sign in." } },
        denied.status,
      );
    }
  });
  app.get("/v1/security/context", async (context) => {
    context.header("Cache-Control", "no-store");
    try {
      runtime.requireSecrets();
      if (!runtime.browserRequest(context.req.raw, false)) throw new WebAuthError(403, "FORBIDDEN");
      const result = await runtime.verifyCookie(context.req.raw);
      if (result.status !== "verified")
        throw new WebAuthError(result.status === "unavailable" ? 503 : 401, "UNAUTHENTICATED");
      // Capture context without requiring existing privacy consent, so required
      // consent bootstrap and logout remain possible. No scope/grant is returned.
      await runtime.withClient((client) =>
        transaction(client, async () => {
          const authority = await loadCurrentAuthorityInTransaction(client, result.identity);
          if (
            authority.accountStatus !== "active" ||
            authority.sessionRevokedAt ||
            Date.parse(authority.sessionExpiresAt) <= runtime.now()
          )
            throw new WebAuthError(401, "UNAUTHENTICATED");
        }),
      );
      return context.json({
        userId: result.identity.actorId,
        sessionId: result.identity.sessionId,
        csrfToken: await runtime
          .requireSecrets()
          .csrf(`${result.handle}|${result.identity.actorId}|${result.identity.sessionId}`),
        expiresAt: result.identity.expiresAt,
      });
    } catch (error) {
      const denied = fail(error);
      return context.json(
        { error: { code: denied.code, message: "Session context unavailable." } },
        denied.status,
      );
    }
  });
  app.post("/v1/session/logout", async (context) => {
    context.header("Cache-Control", "no-store");
    try {
      runtime.requireSecrets();
      const body = await context.req.text();
      if (context.req.header("content-type") !== "application/json" || body.trim() !== "{}")
        throw new WebAuthError(400, "INVALID_INPUT");
      const key = context.req.header("idempotency-key") ?? "";
      if (!/^[A-Za-z0-9_-]{16,128}$/.test(key)) throw new WebAuthError(400, "INVALID_INPUT");
      if (!runtime.browserRequest(context.req.raw, true) || context.req.header("authorization"))
        throw new WebAuthError(403, "FORBIDDEN");
      // A consumed logout credential can only replay this exact logout result;
      // it cannot authenticate any business route or change its idempotency key.
      const priorHandle = await runtime.openCookie(
        context.req.raw,
        sessionCookie,
        "session-cookie",
      );
      if (priorHandle) {
        const prior = await runtime.withClient((client) =>
          transaction(client, () => runtime.readLocalSession(priorHandle, client)),
        );
        if (prior?.revoked_at) {
          if (
            prior.logout_key !== key ||
            new Date(prior.expires_at).getTime() <= runtime.now() ||
            !(await runtime
              .requireSecrets()
              .verifyCsrf(
                `${priorHandle}|${prior.actor_id}|${prior.session_id}`,
                context.req.header("x-csrf-token") ?? "",
              ))
          )
            throw new WebAuthError(403, "FORBIDDEN");
          context.header("Set-Cookie", cookie(sessionCookie, "", 0));
          if (prior.revocation_pending) {
            const providerId = await runtime.withClient((client) =>
              transaction(client, async () => {
                await set(client, "identity.actor_id", prior.actor_id);
                await set(client, "identity.internal_session", prior.session_id);
                const session = await client.query(
                  "SELECT provider_session_id FROM core.identity_sessions WHERE id=$1",
                  [prior.session_id],
                );
                if (!session.rows[0]) throw new WebAuthError(503, "LOGOUT_PENDING");
                return session.rows[0].provider_session_id as string;
              }),
            );
            await completeLogout(await digest(priorHandle), prior.actor_id, providerId);
          }
          return context.json({ revoked: true });
        }
      }
      const result = await runtime.verifyCookie(context.req.raw);
      if (result.status !== "verified")
        throw new WebAuthError(result.status === "unavailable" ? 503 : 401, "UNAUTHENTICATED");
      const permitted = await runtime.verifyMutationRequest(context.req.raw, result.identity);
      if (permitted !== "allowed")
        throw new WebAuthError(permitted === "unavailable" ? 503 : 403, "FORBIDDEN");
      const hash = await digest(result.handle);
      await runtime.withClient((client) =>
        transaction(client, async () => {
          await set(client, "identity.actor_id", result.identity.actorId);
          await set(client, "identity.internal_session", result.identity.sessionId);
          await set(client, "identity.web_handle", hash);
          const revoked = await client.query(
            `UPDATE core.identity_web_sessions SET revoked_at=$2,revocation_pending=true,logout_key=$3
          WHERE handle_hash=$1 AND revoked_at IS NULL RETURNING handle_hash`,
            [hash, new Date(runtime.now()), key],
          );
          if (revoked.rowCount !== 1) throw new WebAuthError(409, "LOGOUT_CONFLICT");
          await client.query("UPDATE core.identity_sessions SET revoked_at=$2 WHERE id=$1", [
            result.identity.sessionId,
            new Date(runtime.now()),
          ]);
        }),
      );
      context.header("Set-Cookie", cookie(sessionCookie, "", 0));
      await completeLogout(hash, result.identity.actorId, result.providerSessionId);
      return context.json({ revoked: true });
    } catch (error) {
      const denied = fail(error);
      return context.json(
        { error: { code: denied.code, message: "Logout could not be confirmed." } },
        denied.status,
      );
    }
  });
}
