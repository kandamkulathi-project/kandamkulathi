import { platformConfig } from "@kandamkulathi/server/config";
import { loadBookingAuthority } from "./booking-authority";
import { type CommerceDependencies, unavailableCommerceDependencies } from "./commerce";
import { createCommerceCheckoutDependencies } from "./commerce-checkout";
import { createCommerceDatabaseDependencies } from "./commerce-database";
import { configuredCommercePaymentProvider } from "./commerce-provider";
import type { createConfiguredIdentityRuntime } from "./runtime";

type IdentityRuntime = ReturnType<typeof createConfiguredIdentityRuntime>;

/** One instance per incoming Worker request; no mutable request/authentication cache. */
export function configuredCommerceDependencies(
  bindings: Record<string, unknown>,
  identity: IdentityRuntime,
  request?: Request,
): CommerceDependencies {
  const text = (name: string) =>
    typeof bindings[name] === "string" ? (bindings[name] as string) : "";
  try {
    const config = platformConfig(bindings);
    if (!config.DATABASE_URL || !config.DATABASE_WORKER_URL) return unavailableCommerceDependencies;
    const paymentProvider = configuredCommercePaymentProvider(bindings);
    return createCommerceDatabaseDependencies({
      environment: config.APP_ENV,
      coreDatabaseUrl: config.DATABASE_URL,
      jobsDatabaseUrl: config.DATABASE_WORKER_URL,
      resourceNamespace: config.RESOURCE_NAMESPACE,
      ...(text("LOCAL_DATABASE_PROXY") ? { localProxy: text("LOCAL_DATABASE_PROXY") } : {}),
      identity: identity.dependencies,
      verifyMutationRequest: (incoming, principal) => {
        // Tests/compositions may omit the event request for public reads only.
        if (!request || request !== incoming) return Promise.resolve("unavailable");
        return identity.mutation(incoming, principal.identity);
      },
      guardInTransaction: async (context, principal) => {
        if (!request) throw new Error("Commerce event session unavailable.");
        await identity.withSessionInTransaction(
          context.client,
          request,
          principal.identity,
          async () => {},
        );
      },
      // Attribution is server-owned; an unverified header cannot bypass domain identity checks.
      orderSource: request?.headers.has("authorization") ? "native" : "web",
      bookingAuthorityLoader: loadBookingAuthority,
      ...(paymentProvider ? { paymentProvider } : {}),
    });
  } catch {
    return unavailableCommerceDependencies;
  }
}

/** Read-only metadata shares the exact approved provider/key gate and current domain authority. */
export function configuredCommerceCheckoutDependencies(
  bindings: Record<string, unknown>,
  identity: IdentityRuntime,
  request: Request | undefined,
  commerce: CommerceDependencies,
) {
  try {
    const config = platformConfig(bindings);
    if (!config.DATABASE_URL || !request) return undefined;
    const paymentProvider = configuredCommercePaymentProvider(bindings);
    const keyId = bindings.RAZORPAY_KEY_ID;
    return createCommerceCheckoutDependencies({
      environment: config.APP_ENV,
      coreDatabaseUrl: config.DATABASE_URL,
      resourceNamespace: config.RESOURCE_NAMESPACE,
      ...(typeof bindings.LOCAL_DATABASE_PROXY === "string"
        ? { localProxy: bindings.LOCAL_DATABASE_PROXY }
        : {}),
      identity: commerce,
      guardInTransaction: async (context, principal) => {
        await identity.withSessionInTransaction(
          context.client,
          request,
          principal.identity,
          async () => {},
        );
      },
      bookingAuthorityLoader: loadBookingAuthority,
      ...(paymentProvider && typeof keyId === "string" ? { paymentProvider, keyId } : {}),
    });
  } catch {
    return undefined;
  }
}
