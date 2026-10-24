import type { ServiceApp } from "@kandamkulathi/server";
import { platformConfig } from "@kandamkulathi/server/config";
import {
  type CommerceCancellationRequest,
  type CommerceCancellationResult,
  commerceCancellationRequestSchema,
  commerceCancellationResultSchema,
} from "../../../packages/contracts/src/commerce-cancellation";
import { CommerceError } from "../../../packages/contracts/src/commerce-catalogue";
import { canonicalUuidSchema } from "../../../packages/contracts/src/identifiers";
import { withDatabase } from "../../../packages/database/src/client";
import { cancelUnpaidCommerceOrder } from "../../../packages/database/src/commerce-cancellation";
import type { CommerceDependencies } from "./commerce";
import {
  authorizeCommerceRequest,
  CommerceAuthorityError,
  type CommerceIdentityDependencies,
  type CommercePrincipal,
} from "./commerce-authorization";
import type { CommerceDatabaseOptions } from "./commerce-database";
import { revalidateCommerceTransaction } from "./commerce-identity";
import type { createConfiguredIdentityRuntime } from "./runtime";

/** Event-bound root adapter. Policy still comes only from controlled PostgreSQL configuration. */
export function configuredCommerceCancellationDependencies(
  bindings: Record<string, unknown>,
  identity: ReturnType<typeof createConfiguredIdentityRuntime>,
  request: Request | undefined,
  commerce: CommerceDependencies,
): CommerceCancellationDependencies | undefined {
  try {
    const config = platformConfig(bindings);
    if (!config.DATABASE_URL || !request) return undefined;
    return createCommerceCancellationDependencies({
      environment: config.APP_ENV,
      coreDatabaseUrl: config.DATABASE_URL,
      resourceNamespace: config.RESOURCE_NAMESPACE,
      ...(typeof bindings.LOCAL_DATABASE_PROXY === "string"
        ? { localProxy: bindings.LOCAL_DATABASE_PROXY }
        : {}),
      identity: commerce,
      async guardInTransaction(context, principal) {
        await identity.withSessionInTransaction(
          context.client,
          request,
          principal.identity,
          async () => {},
        );
      },
    });
  } catch {
    return undefined;
  }
}

export interface CommerceCancellationDependencies extends CommerceIdentityDependencies {
  verifyMutationRequest: CommerceDependencies["verifyMutationRequest"];
  cancel(
    principal: CommercePrincipal,
    orderId: string,
    input: CommerceCancellationRequest,
  ): Promise<CommerceCancellationResult>;
}

export function createCommerceCancellationDependencies(
  options: Pick<
    CommerceDatabaseOptions,
    "environment" | "coreDatabaseUrl" | "resourceNamespace" | "localProxy"
  > & {
    identity: CommerceIdentityDependencies & Pick<CommerceDependencies, "verifyMutationRequest">;
    guardInTransaction: NonNullable<CommerceDatabaseOptions["guardInTransaction"]>;
  },
): CommerceCancellationDependencies {
  return {
    ...options.identity,
    cancel(principal, orderId, input) {
      // Never interpret staff read grants as cancellation authority.
      if (principal.clinicId !== null || principal.directory) throw new CommerceError("denied");
      return withDatabase(
        options.coreDatabaseUrl,
        options.environment,
        "k_core_runtime",
        (context) =>
          cancelUnpaidCommerceOrder(context, principal.actorId, orderId, input, async (active) => {
            await options.guardInTransaction(active, principal);
            await revalidateCommerceTransaction(active, principal);
          }),
        options.localProxy,
        options.resourceNamespace,
      );
    },
  };
}

/** Mount before root catch-all. No UI or provider call; absent adapters fail closed. */
export function registerCommerceCancellationRoutes(
  app: ServiceApp,
  dependencies?: CommerceCancellationDependencies,
): void {
  app.post("/v1/orders/:id/cancel", async (context) => {
    context.header("Cache-Control", "private, no-store");
    const fail = (code: string, status: 400 | 401 | 403 | 409 | 503) =>
      context.json(
        {
          error: {
            code,
            message: "Order cancellation is unavailable or not permitted.",
            requestId: context.get("requestId"),
          },
        },
        status,
      );
    if (!dependencies) return fail("COMMERCE_UNAVAILABLE", 503);
    const principal = await authorizeCommerceRequest(context.req.raw, dependencies, {
      kind: "customer",
    });
    if (!principal.allowed) return fail(principal.code, principal.status);
    try {
      const transport = await dependencies.verifyMutationRequest(context.req.raw, principal);
      if (transport !== "allowed")
        return fail(
          transport === "denied" ? "FORBIDDEN" : "IDENTITY_UNAVAILABLE",
          transport === "denied" ? 403 : 503,
        );
      const id = canonicalUuidSchema.safeParse(context.req.param("id"));
      if (
        !id.success ||
        context.req.param("id") !== id.data ||
        new URL(context.req.url).search ||
        !/^application\/json(?:\s*;|$)/i.test(context.req.header("Content-Type") ?? "")
      )
        return fail("INVALID_INPUT", 400);
      let raw: unknown;
      try {
        raw = await context.req.json();
      } catch {
        return fail("INVALID_INPUT", 400);
      }
      const input = commerceCancellationRequestSchema.safeParse(raw);
      if (!input.success) return fail("INVALID_INPUT", 400);
      return context.json(
        commerceCancellationResultSchema.parse(
          await dependencies.cancel(principal, id.data, input.data),
        ),
      );
    } catch (cause) {
      if (cause instanceof CommerceAuthorityError)
        return fail(cause.denial.code, cause.denial.status);
      if (cause instanceof CommerceError) {
        if (cause.code === "denied") return fail("COMMERCE_DENIED", 403);
        if (["operation_conflict", "stale_version", "stock_shortage"].includes(cause.code))
          return fail(cause.code.toUpperCase(), 409);
      }
      return fail("COMMERCE_UNAVAILABLE", 503);
    }
  });
}
