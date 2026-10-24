import { consentBootstrapSchema } from "../../../packages/contracts/src/consent-bootstrap.ts";
import {
  type CurrentAuthority,
  currentAuthoritySchema,
  type VerifiedIdentity,
  verifiedIdentitySchema,
} from "../../../packages/contracts/src/identity.ts";
import { type DatabaseClient, transaction } from "../../../packages/database/src/client.ts";
import { loadApprovedPrivacyPolicyInTransaction } from "../../../packages/database/src/consent-bootstrap.ts";
import type { IdentityDenial } from "../../../packages/server/src/authorization.ts";
import { hasCurrentConsent } from "../../../packages/server/src/authorization-consent.ts";
import type {
  IdentityDependencies,
  registerIdentityRoutes,
} from "../../../packages/server/src/identity.ts";
import type { IdentityClient } from "./identity-runtime.ts";

export interface ConsentBootstrapDependencies {
  verifySession: IdentityDependencies["verifySession"];
  withClient: IdentityClient;
  now: () => number;
  /** REQUIRED actual parent loader: identity locks + current browser fence, same client/Tx. */
  loadCurrentAuthorityInTransaction(
    client: DatabaseClient,
    identity: VerifiedIdentity,
    request: Request,
  ): Promise<unknown>;
  /** REQUIRED canonical domain logic, excluding ONLY privacy; no fabricated consent/grant. */
  evaluateEligibility(
    identity: VerifiedIdentity,
    authority: CurrentAuthority,
    now: number,
  ): { allowed: true } | IdentityDenial;
}

/** Explicit parent composition; no default provider, bypass or detached authority snapshot. */
export function createConsentBootstrapRuntime(dependencies: ConsentBootstrapDependencies) {
  return dependencies;
}

export function registerConsentBootstrapRoutes(
  app: Parameters<typeof registerIdentityRoutes>[0],
  runtime: ReturnType<typeof createConsentBootstrapRuntime>,
) {
  app.get("/v1/consent-bootstrap", async (context) => {
    context.header("Cache-Control", "no-store");
    const deny = (status: 401 | 403 | 503, code: string) =>
      context.json(
        {
          error: {
            code,
            message: "Consent bootstrap is unavailable.",
            requestId: context.get("requestId"),
          },
        },
        status,
      );
    try {
      const verification = await runtime.verifySession(context.req.raw);
      if (verification.status === "unauthenticated") return deny(401, "UNAUTHENTICATED");
      if (verification.status !== "verified") return deny(503, "IDENTITY_UNAVAILABLE");
      const identity = verifiedIdentitySchema.parse(verification.identity);
      const result = await runtime.withClient((client) =>
        transaction(client, async () => {
          const authority = currentAuthoritySchema.parse(
            await runtime.loadCurrentAuthorityInTransaction(client, identity, context.req.raw),
          );
          const now = runtime.now();
          const eligibility = runtime.evaluateEligibility(identity, authority, now);
          if (!eligibility.allowed) return eligibility;
          const requirement = {
            purpose: "privacy" as const,
            version: authority.privacyVersion,
            actorId: identity.actorId,
          };
          if (hasCurrentConsent(authority.consents, requirement, now))
            return { allowed: false as const, status: 403 as const, code: "FORBIDDEN" as const };
          const policy = await loadApprovedPrivacyPolicyInTransaction(
            client,
            authority.privacyVersion,
            now,
          );
          return {
            allowed: true as const,
            bootstrap: consentBootstrapSchema.parse({
              actorId: identity.actorId,
              sessionId: identity.sessionId,
              expiresAt: new Date(
                Math.min(Date.parse(identity.expiresAt), Date.parse(authority.sessionExpiresAt)),
              ).toISOString(),
              requirement,
              policy,
            }),
          };
        }),
      );
      return result.allowed ? context.json(result.bootstrap) : deny(result.status, result.code);
    } catch {
      return deny(503, "IDENTITY_UNAVAILABLE");
    }
  });
}
