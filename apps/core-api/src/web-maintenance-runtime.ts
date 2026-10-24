import { withDatabase } from "@kandamkulathi/database/client";
import { platformConfig } from "@kandamkulathi/server/config";
import { createWebAuthMaintenance } from "./web-auth-maintenance";

/** `cf` is Worker request metadata, not an HTTP forwarding header or client DTO. */
export function trustedCloudflareClientAddress(request: Request): string | null {
  const cf: unknown = Reflect.get(request, "cf");
  if (!cf || typeof cf !== "object" || !Reflect.has(cf, "colo")) return null;
  const colo: unknown = Reflect.get(cf, "colo");
  if (typeof colo !== "string" || !/^[A-Z]{3}$/.test(colo)) return null;
  return request.headers.get("CF-Connecting-IP");
}

/** Missing approval, secret or platform address stays unavailable, never uncapped. */
export function createConfiguredWebMaintenance(bindings: Record<string, unknown>) {
  const text = (name: string) =>
    typeof bindings[name] === "string" ? (bindings[name] as string) : "";
  return createWebAuthMaintenance(
    {
      approved: bindings.WORKOS_CONFIGURATION_APPROVED === "true",
      apiKey: text("WORKOS_API_KEY"),
      apiOrigin: text("WEB_AUTH_API_ORIGIN"),
      rateKey: text("WEB_AUTH_RATE_KEY"),
    },
    {
      withAdmissionClient: async (callback) => {
        const config = platformConfig(bindings);
        if (!config.DATABASE_URL) throw new Error("Auth admission storage unavailable.");
        return withDatabase(
          config.DATABASE_URL,
          config.APP_ENV,
          "k_core_runtime",
          ({ client }) => callback(client),
          text("LOCAL_DATABASE_PROXY") || undefined,
          config.RESOURCE_NAMESPACE,
        );
      },
      withMaintenanceClient: async (callback) => {
        const config = platformConfig(bindings);
        if (!config.DATABASE_WORKER_URL) throw new Error("Auth maintenance storage unavailable.");
        return withDatabase(
          config.DATABASE_WORKER_URL,
          config.APP_ENV,
          "k_jobs_runtime",
          ({ client }) => callback(client),
          text("LOCAL_DATABASE_PROXY") || undefined,
          config.RESOURCE_NAMESPACE,
        );
      },
      trustedRemoteAddress: trustedCloudflareClientAddress,
    },
  );
}
