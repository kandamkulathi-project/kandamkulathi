import type { VerifiedIdentity } from "@kandamkulathi/contracts/identity";
import { verifiedIdentitySchema } from "@kandamkulathi/contracts/identity";
import type { Hono } from "hono";
import {
  type IdentityDenial,
  identityUnavailable,
  projectSession,
  unauthenticated,
} from "./authorization";
import type { ServiceRuntime } from "./index";

export type SessionVerification =
  | { status: "verified"; identity: unknown }
  | { status: "unauthenticated" }
  | { status: "unavailable" };

export interface IdentityDependencies {
  /** Must perform real provider verification; never decode-only or trust request role/scope headers. */
  verifySession(request: Request): Promise<SessionVerification>;
  /** Must reload current session/account/membership/assignment/consent from authoritative storage. */
  loadCurrentAuthority(identity: VerifiedIdentity): Promise<unknown>;
  now?: () => number;
}

export const unavailableIdentityDependencies: IdentityDependencies = {
  async verifySession() {
    return { status: "unavailable" };
  },
  async loadCurrentAuthority() {
    return null;
  },
};

const safeMessages = {
  UNAUTHENTICATED: "Authentication is required.",
  FORBIDDEN: "Access is not permitted.",
  IDENTITY_UNAVAILABLE: "Identity verification is unavailable.",
} as const;

/** Read-only boundary; login/callback/mutations await verified provider + CSRF integration. */
export function registerIdentityRoutes(
  app: Hono<ServiceRuntime>,
  dependencies: IdentityDependencies,
): void {
  app.get("/v1/session", async (context) => {
    context.header("Cache-Control", "no-store");
    const deny = (result: IdentityDenial) =>
      context.json(
        {
          error: {
            code: result.code,
            message: safeMessages[result.code],
            requestId: context.get("requestId"),
          },
        },
        result.status,
      );
    try {
      const verification = await dependencies.verifySession(context.req.raw);
      if (verification.status === "unauthenticated") return deny(unauthenticated());
      if (verification.status !== "verified") return deny(identityUnavailable());
      const identity = verifiedIdentitySchema.safeParse(verification.identity);
      if (!identity.success) return deny(identityUnavailable());
      const authority = await dependencies.loadCurrentAuthority(identity.data);
      const result = projectSession(identity.data, authority, (dependencies.now ?? Date.now)());
      return result.allowed ? context.json(result.session) : deny(result);
    } catch {
      // No provider exception, credential, health content or storage error is reflected/logged here.
      return deny(identityUnavailable());
    }
  });
}
