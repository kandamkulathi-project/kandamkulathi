import type { IdentityDependencies, registerIdentityRoutes } from "@kandamkulathi/server/identity";
import { canonicalUuidSchema } from "../../../packages/contracts/src/identifiers.ts";
import {
  type VerifiedIdentity,
  verifiedIdentitySchema,
} from "../../../packages/contracts/src/identity.ts";
import type { DatabaseClient } from "../../../packages/database/src/client.ts";
import {
  consentMutationSchema,
  IdentityMutationError,
  linkWorkosSession,
  recordSelfConsent,
  withIdentityTransaction,
} from "../../../packages/database/src/identity.ts";
import {
  createWorkosVerifier,
  type WorkosOptions,
} from "../../../packages/providers/src/workos/index.ts";

export type IdentityClient = <T>(callback: (client: DatabaseClient) => Promise<T>) => Promise<T>;
export type IdentityMutationDecision = "allowed" | "denied" | "unavailable";
/** Explicit composition only. No environment flag or development fixture activates identity. */
export function createIdentityRuntime(
  options: WorkosOptions,
  withClient: IdentityClient,
  transport: typeof fetch = fetch,
  now = Date.now,
) {
  const verify = createWorkosVerifier(options, transport, now);
  const dependencies: IdentityDependencies = {
    now,
    async verifySession(request) {
      const result = await verify(request);
      if (result.status !== "verified") return result;
      const identity = await withClient((client) => linkWorkosSession(client, result.session));
      return identity ? { status: "verified", identity } : { status: "unauthenticated" };
    },
    loadCurrentAuthority(identity) {
      return withClient((client) =>
        withIdentityTransaction(client, identity, async (authority) => authority),
      );
    },
  };
  const verifyMutationRequest = async (
    request: Request,
    bindings: { actorId: string; sessionId: string },
  ): Promise<IdentityMutationDecision> => {
    // This transport supports nonambient native/server bearers only. Cookie-CSRF
    // and browser Origin policy require separately reviewed adapters, not CORS.
    if (request.headers.has("cookie") || request.headers.has("origin")) return "denied";
    const actor = canonicalUuidSchema.safeParse(bindings.actorId);
    const session = canonicalUuidSchema.safeParse(bindings.sessionId);
    if (!actor.success || !session.success) return "denied";
    try {
      const verification = await dependencies.verifySession(request);
      if (verification.status === "unavailable") return "unavailable";
      if (verification.status !== "verified") return "denied";
      const identity = verifiedIdentitySchema.safeParse(verification.identity);
      if (!identity.success) return "unavailable";
      const instant = now();
      if (!Number.isFinite(instant)) return "unavailable";
      return identity.data.actorId === actor.data &&
        identity.data.sessionId === session.data &&
        Date.parse(identity.data.authenticatedAt) <= instant &&
        Date.parse(identity.data.expiresAt) > instant
        ? "allowed"
        : "denied";
    } catch {
      return "unavailable";
    }
  };
  return { dependencies, withClient, now, verifyMutationRequest };
}

/** Bearer-only mutation. Cookies never authenticate this route; no refresh/login/CSRF-cookie flow. */
export function registerIdentityRuntimeRoutes(
  app: Parameters<typeof registerIdentityRoutes>[0],
  runtime: ReturnType<typeof createIdentityRuntime>,
  web?: {
    verifyMutationRequest: ReturnType<typeof createIdentityRuntime>["verifyMutationRequest"];
    guard(client: DatabaseClient, request: Request, identity: VerifiedIdentity): Promise<void>;
  },
) {
  app.post("/v1/consents", async (context) => {
    context.header("Cache-Control", "no-store");
    const deny = (status: 400 | 401 | 403 | 409 | 503, code: string) =>
      context.json(
        {
          error: {
            code,
            message: "Consent could not be recorded.",
            requestId: context.get("requestId"),
          },
        },
        status,
      );
    try {
      // Credentialed browser cookies and cross-origin submissions are deliberately unsupported.
      if (!web && (context.req.header("cookie") || context.req.header("origin")))
        return deny(403, "FORBIDDEN");
      if (context.req.header("content-type") !== "application/json")
        return deny(400, "INVALID_INPUT");
      const body = await context.req.text();
      if (body.length > 4096) return deny(400, "INVALID_INPUT");
      let input: unknown;
      try {
        input = JSON.parse(body);
      } catch {
        return deny(400, "INVALID_INPUT");
      }
      const mutation = consentMutationSchema.safeParse(input);
      if (!mutation.success) return deny(400, "INVALID_INPUT");
      const result = await runtime.dependencies.verifySession(context.req.raw);
      if (result.status === "unauthenticated") return deny(401, "UNAUTHENTICATED");
      if (result.status !== "verified") return deny(503, "IDENTITY_UNAVAILABLE");
      const identity = verifiedIdentitySchema.parse(result.identity);
      if (web) {
        const decision = await web.verifyMutationRequest(context.req.raw, identity);
        if (decision !== "allowed")
          return deny(
            decision === "denied" ? 403 : 503,
            decision === "denied" ? "FORBIDDEN" : "IDENTITY_UNAVAILABLE",
          );
      }
      if (mutation.data.requirement.actorId !== identity.actorId) return deny(403, "FORBIDDEN");
      const recorded = await runtime.withClient((client) =>
        recordSelfConsent(
          client,
          identity,
          mutation.data,
          runtime.now(),
          web ? () => web.guard(client, context.req.raw, identity) : undefined,
        ),
      );
      return context.json(recorded, 201);
    } catch (error) {
      if (error instanceof IdentityMutationError)
        return deny(
          error.status,
          error.status === 401
            ? "UNAUTHENTICATED"
            : error.status === 403
              ? "FORBIDDEN"
              : "CONFLICT",
        );
      return deny(503, "IDENTITY_UNAVAILABLE");
    }
  });
}
