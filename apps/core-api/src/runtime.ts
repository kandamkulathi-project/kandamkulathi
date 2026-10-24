import { withDatabase } from "@kandamkulathi/database/client";
import { evaluateConsentBootstrapEligibility } from "@kandamkulathi/server/authorization";
import { approvedBearerOrigin, verifyBearerMutation } from "@kandamkulathi/server/bearer-mutation";
import { platformConfig } from "@kandamkulathi/server/config";
import { z } from "zod";
import type { CurrentAuthority, VerifiedIdentity } from "../../../packages/contracts/src/identity";
import { verifiedIdentitySchema } from "../../../packages/contracts/src/identity";
import type { DatabaseClient } from "../../../packages/database/src/client";
import { loadCurrentAuthorityInTransaction } from "../../../packages/database/src/identity";
import { createTranscriptionProvider } from "../../../packages/providers/src/transcription";
import { type BookingDependencies, registerBookingRoutes } from "./booking";
import { loadBookingAuthority } from "./booking-authority";
import { registerBookingOffersRoutes } from "./booking-offers";
import { registerCommerceRoutes } from "./commerce";
import {
  configuredCommerceCancellationDependencies,
  registerCommerceCancellationRoutes,
} from "./commerce-cancellation";
import { registerCommerceCheckoutRoutes } from "./commerce-checkout";
import {
  configuredCommerceCheckoutDependencies,
  configuredCommerceDependencies,
} from "./commerce-runtime";
import { createConsentBootstrapRuntime, registerConsentBootstrapRoutes } from "./consent-bootstrap";
import { createCoreApi } from "./identity";
import { createIdentityRuntime, registerIdentityRuntimeRoutes } from "./identity-runtime";
import { registerKnowledgeIndexRoutes } from "./knowledge-index";
import { knowledgeSearchRuntimeFromBindings } from "./knowledge-runtime";
import { createNativeAuthRuntime, registerNativeAuthRoutes } from "./native-auth";
import { registerTranscriptionRoutes } from "./transcription";
import { createWebAuthRuntime, registerWebAuthRoutes } from "./web-auth";
import { registerWebAuthAdmission } from "./web-auth-maintenance";
import { createConfiguredWebMaintenance } from "./web-maintenance-runtime";

/** Bind only trusted Worker configuration. Absent approved provider/policy input stays unavailable. */
export function createConfiguredIdentityRuntime(
  bindings: Record<string, unknown>,
  request?: Request,
) {
  const eventRequest = request;
  const text = (key: string) =>
    typeof bindings[key] === "string" ? (bindings[key] as string) : "";
  const identity = createIdentityRuntime(
    {
      apiKey: text("WORKOS_API_KEY"),
      clientId: text("WORKOS_CLIENT_ID"),
      issuer: text("WORKOS_ISSUER"),
      ...(text("WORKOS_AUDIENCE") ? { audience: text("WORKOS_AUDIENCE") } : {}),
      approved: bindings.WORKOS_CONFIGURATION_APPROVED === "true",
    },
    async (callback) => {
      const config = platformConfig(bindings);
      if (!config.DATABASE_URL) throw new Error("Identity storage unavailable.");
      return withDatabase(
        config.DATABASE_URL,
        config.APP_ENV,
        "k_core_runtime",
        ({ client }) => callback(client),
        text("LOCAL_DATABASE_PROXY") || undefined,
        config.RESOURCE_NAMESPACE,
      );
    },
  );
  const list = (key: string): string[] =>
    text(key)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  let organizationMappings: Record<string, string> | undefined;
  let mappingValid = true;
  if (text("WORKOS_ORGANIZATION_MAPPINGS")) {
    try {
      const value: unknown = JSON.parse(text("WORKOS_ORGANIZATION_MAPPINGS"));
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        Object.values(value).some((entry) => typeof entry !== "string")
      )
        mappingValid = false;
      else organizationMappings = value as Record<string, string>;
    } catch {
      mappingValid = false;
    }
  }
  const nativeEnvironment = z
    .enum(["local", "dev", "staging", "production"])
    .safeParse(bindings.APP_ENV ?? "local");
  const nativeRedirects = z
    .array(
      z.strictObject({
        environment: z.enum(["local", "dev", "staging", "production"]),
        redirectUri: z.string().min(1).max(256),
      }),
    )
    .max(4)
    .safeParse(
      (() => {
        try {
          return JSON.parse(text("NATIVE_AUTH_ALLOWED_REDIRECTS"));
        } catch {
          return undefined;
        }
      })(),
    );
  const native = createNativeAuthRuntime(
    {
      apiKey: text("WORKOS_API_KEY"),
      clientId: text("WORKOS_CLIENT_ID"),
      issuer: text("WORKOS_ISSUER"),
      ...(text("WORKOS_AUDIENCE") ? { audience: text("WORKOS_AUDIENCE") } : {}),
      approved:
        bindings.WORKOS_CONFIGURATION_APPROVED === "true" &&
        bindings.NATIVE_AUTH_CONFIGURATION_APPROVED === "true" &&
        mappingValid &&
        nativeEnvironment.success &&
        nativeRedirects.success,
      // Unsupported preview/invalid environments can never activate this fallback.
      environment: nativeEnvironment.success ? nativeEnvironment.data : "local",
      allowedRedirects: nativeRedirects.success ? nativeRedirects.data : [],
      apiOrigin: text("NATIVE_AUTH_API_ORIGIN"),
      encryptionKey: text("NATIVE_AUTH_ENCRYPTION_KEY"),
      attemptTtlSeconds: 300,
      sessionTtlSeconds: 900,
      ...(organizationMappings ? { organizationMappings } : {}),
    },
    identity.withClient,
  );
  const nativeJobs = native.maintenance(async (callback) => {
    const config = platformConfig(bindings);
    if (!config.DATABASE_WORKER_URL) throw new Error("Native maintenance storage unavailable.");
    return withDatabase(
      config.DATABASE_WORKER_URL,
      config.APP_ENV,
      "k_jobs_runtime",
      ({ client }) => callback(client),
      text("LOCAL_DATABASE_PROXY") || undefined,
      config.RESOURCE_NAMESPACE,
    );
  });
  const isNative = (incoming: Request) =>
    incoming.headers.get("authorization")?.startsWith("Bearer n1_") === true;
  const maintenance = createConfiguredWebMaintenance(bindings);
  const admission = request ? maintenance.forRequest(request) : undefined;
  const web = createWebAuthRuntime(
    {
      apiKey: text("WORKOS_API_KEY"),
      clientId: text("WORKOS_CLIENT_ID"),
      issuer: text("WORKOS_ISSUER"),
      ...(text("WORKOS_AUDIENCE") ? { audience: text("WORKOS_AUDIENCE") } : {}),
      approved: bindings.WORKOS_CONFIGURATION_APPROVED === "true" && mappingValid,
      apiOrigin: text("WEB_AUTH_API_ORIGIN"),
      callbackUrl: text("WEB_AUTH_CALLBACK_URL"),
      returnUrl: text("WEB_AUTH_RETURN_URL"),
      allowedReturnUrls: list("WEB_AUTH_ALLOWED_RETURN_URLS"),
      cookieKey: text("WEB_AUTH_COOKIE_KEY"),
      attemptTtlSeconds: 300,
      sessionTtlSeconds: 3600,
      ...(organizationMappings ? { organizationMappings } : {}),
    },
    identity.withClient,
    {
      approvedBrowserOrigin: (origin, url) => approvedBearerOrigin(origin, url, bindings),
      admitActor: (actorId) => admission?.admitActor(actorId) ?? Promise.resolve("unavailable"),
    },
    admission?.transport ??
      (async () => {
        throw new Error("Web event admission unavailable.");
      }),
  );
  const dependencies: typeof identity.dependencies = {
    ...identity.dependencies,
    verifySession: async (request) => {
      if (request.headers.has("cookie") && request.headers.has("authorization"))
        return { status: "unauthenticated" };
      if (!request.headers.has("cookie"))
        return isNative(request)
          ? native.dependencies.verifySession(request)
          : identity.dependencies.verifySession(request);
      if (
        request !== eventRequest ||
        !admission ||
        (await admission.admit("session")) !== "allowed"
      )
        return { status: "unavailable" };
      return web.dependencies.verifySession(request);
    },
  };
  const mutation = async (request: Request, binding: { actorId: string; sessionId: string }) => {
    if (request.headers.has("cookie") && request.headers.has("authorization"))
      return "denied" as const;
    if (request.headers.has("cookie")) {
      if (
        request !== eventRequest ||
        !admission ||
        (await admission.admit("session")) !== "allowed"
      )
        return "unavailable" as const;
      return web.verifyMutationRequest(request, binding);
    }
    if (isNative(request)) return native.verifyMutationRequest(request, binding);
    return (await verifyBearerMutation(request, bindings))
      ? ("allowed" as const)
      : ("denied" as const);
  };
  const withSessionInTransaction = async <T>(
    client: DatabaseClient,
    request: Request,
    principal: VerifiedIdentity,
    callback: (authority: CurrentAuthority) => Promise<T>,
  ): Promise<T> => {
    if (request.headers.has("cookie") && request.headers.has("authorization"))
      throw new Error("Ambiguous session transport.");
    if (request.headers.has("cookie"))
      return web.withWebSessionInTransaction(client, request, principal, callback);
    if (isNative(request))
      return native.withNativeSessionInTransaction(client, request, principal, callback);
    if (request.headers.has("authorization"))
      return callback(await loadCurrentAuthorityInTransaction(client, principal));
    throw new Error("Verified session transport required");
  };
  return {
    identity,
    web,
    native,
    nativeJobs,
    maintenance,
    dependencies,
    mutation,
    withSessionInTransaction,
  };
}

export function createConfiguredCoreApi(bindings: Record<string, unknown>, request?: Request) {
  const configuredIdentity = createConfiguredIdentityRuntime(bindings, request);
  const { identity, web, dependencies, mutation } = configuredIdentity;
  const text = (key: string) =>
    typeof bindings[key] === "string" ? (bindings[key] as string) : "";
  const withContext: BookingDependencies["withContext"] = async (callback) => {
    const config = platformConfig(bindings);
    if (!config.DATABASE_URL) throw new Error("Booking storage unavailable.");
    return withDatabase(
      config.DATABASE_URL,
      config.APP_ENV,
      "k_core_runtime",
      callback,
      text("LOCAL_DATABASE_PROXY") || undefined,
      config.RESOURCE_NAMESPACE,
    );
  };
  return createCoreApi(
    dependencies,
    (app) => {
      registerWebAuthRoutes(app, web);
      registerNativeAuthRoutes(app, configuredIdentity.native, configuredIdentity.nativeJobs);
      registerConsentBootstrapRoutes(
        app,
        createConsentBootstrapRuntime({
          verifySession: dependencies.verifySession,
          withClient: identity.withClient,
          now: identity.now,
          evaluateEligibility: evaluateConsentBootstrapEligibility,
          loadCurrentAuthorityInTransaction: (client, principal, incoming) =>
            configuredIdentity.withSessionInTransaction(
              client,
              incoming,
              principal,
              async (authority) => authority,
            ),
        }),
      );
      registerIdentityRuntimeRoutes(
        app,
        { ...identity, dependencies },
        {
          verifyMutationRequest: mutation,
          guard: async (client, request, principal) => {
            await configuredIdentity.withSessionInTransaction(
              client,
              request,
              principal,
              async () => {},
            );
          },
        },
      );
      registerBookingRoutes(app, {
        verifySession: dependencies.verifySession,
        verifyMutation: async (request) => {
          if (!request.headers.has("cookie"))
            return verifyBearerMutation(request, bindings) ? "allowed" : "denied";
          const verified = await dependencies.verifySession(request);
          if (verified.status !== "verified")
            return verified.status === "unavailable" ? "unavailable" : "denied";
          const principal = verifiedIdentitySchema.safeParse(verified.identity);
          return principal.success ? mutation(request, principal.data) : "unavailable";
        },
        guardInTransaction: async (database, request, principal) => {
          await configuredIdentity.withSessionInTransaction(
            database.client,
            request,
            principal,
            async () => {},
          );
        },
        loadAuthority: loadBookingAuthority,
        withContext,
      });
      registerBookingOffersRoutes(app, { withContext });
      registerKnowledgeIndexRoutes(app, knowledgeSearchRuntimeFromBindings);
      const commerce = configuredCommerceDependencies(bindings, configuredIdentity, request);
      registerCommerceRoutes(app, commerce);
      registerCommerceCancellationRoutes(
        app,
        configuredCommerceCancellationDependencies(bindings, configuredIdentity, request, commerce),
      );
      registerTranscriptionRoutes(app, configuredIdentity, createTranscriptionProvider(bindings));
      registerCommerceCheckoutRoutes(
        app,
        configuredCommerceCheckoutDependencies(bindings, configuredIdentity, request, commerce),
      );
    },
    (app) =>
      registerWebAuthAdmission(app, configuredIdentity.maintenance, [
        "/v1/consents",
        "/v1/bookings",
        "/v1/orders",
        "/v1/checkout",
        "/v1/cart",
        "/v1/payments",
        "/v1/staff",
        "/v1/consent-bootstrap",
      ]),
  );
}
