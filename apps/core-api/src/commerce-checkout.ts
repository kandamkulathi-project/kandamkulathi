import type { ServiceApp } from "@kandamkulathi/server";
import { unavailableIdentityDependencies } from "@kandamkulathi/server/identity";
import {
  type CommercePaymentCheckout,
  commercePaymentCheckoutSchema,
} from "../../../packages/contracts/src/commerce-checkout";
import { canonicalUuidSchema } from "../../../packages/contracts/src/identifiers";
import { withDatabase } from "../../../packages/database/src/client";
import { readCommerceCheckout } from "../../../packages/database/src/commerce-checkout";
import { PaymentError, type PaymentProvider } from "../../../packages/domain/src/commerce-payments";
import {
  authorizeCommerceRequest,
  CommerceAuthorityError,
  type CommerceIdentityDependencies,
  type CommercePrincipal,
} from "./commerce-authorization";
import type { CommerceDatabaseOptions } from "./commerce-database";
import { revalidateCommerceTransaction } from "./commerce-identity";

export interface CommerceCheckoutDependencies extends CommerceIdentityDependencies {
  checkout(principal: CommercePrincipal, intentId: string): Promise<CommercePaymentCheckout>;
}
export type CommerceCheckoutOptions = Pick<
  CommerceDatabaseOptions,
  | "environment"
  | "coreDatabaseUrl"
  | "localProxy"
  | "resourceNamespace"
  | "bookingAuthorityLoader"
  | "guardInTransaction"
> & {
  identity: CommerceIdentityDependencies;
  /** Root's actual approved sandbox gate result; this module never calls provider methods. */
  paymentProvider?: PaymentProvider;
  keyId?: string;
};

export function createCommerceCheckoutDependencies(
  options: CommerceCheckoutOptions,
): CommerceCheckoutDependencies {
  return {
    ...options.identity,
    async checkout(principal, intentId) {
      const key = commercePaymentCheckoutSchema.shape.keyId.safeParse(options.keyId);
      const accountId = options.paymentProvider?.accountId;
      if (
        !key.success ||
        typeof accountId !== "string" ||
        !/^acc_[A-Za-z0-9]{1,80}$/.test(accountId)
      )
        throw new PaymentError("unconfigured");
      return withDatabase(
        options.coreDatabaseUrl,
        options.environment,
        "k_core_runtime",
        (context) =>
          readCommerceCheckout(context, intentId, {
            actorId: principal.actorId,
            identity: principal.identity,
            accountId,
            keyId: key.data,
            ...(options.bookingAuthorityLoader
              ? { bookingAuthorityLoader: options.bookingAuthorityLoader }
              : {}),
            async authorizeTransaction(active) {
              await options.guardInTransaction?.(active, principal);
              await revalidateCommerceTransaction(active, principal);
            },
          }),
        options.localProxy,
        options.resourceNamespace,
      );
    },
  };
}

const unavailable: CommerceCheckoutDependencies = {
  ...unavailableIdentityDependencies,
  async loadCommerceGrants() {
    return [];
  },
  async checkout() {
    throw new PaymentError("unconfigured");
  },
};

/** Root registers this separately, before the unavailable catch-all. */
export function registerCommerceCheckoutRoutes(
  app: ServiceApp,
  dependencies: CommerceCheckoutDependencies = unavailable,
): void {
  app.get("/v1/payments/:id/checkout", async (context) => {
    context.header("Cache-Control", "private, no-store");
    const error = (code: string, status: 400 | 401 | 403 | 409 | 503) =>
      context.json(
        {
          error: {
            code,
            message: "Checkout metadata is unavailable.",
            requestId: context.get("requestId"),
          },
        },
        status,
      );
    const id = canonicalUuidSchema.safeParse(context.req.param("id"));
    const url = new URL(context.req.url);
    if (
      !id.success ||
      context.req.param("id") !== id.data ||
      url.href.includes("?") ||
      context.req.raw.body !== null
    )
      return error("INVALID_INPUT", 400);
    const principal = await authorizeCommerceRequest(context.req.raw, dependencies, {
      kind: "customer",
    });
    if (!principal.allowed) return error(principal.code, principal.status);
    try {
      return context.json(
        commercePaymentCheckoutSchema.parse(await dependencies.checkout(principal, id.data)),
      );
    } catch (cause) {
      if (cause instanceof CommerceAuthorityError)
        return error(cause.denial.code, cause.denial.status);
      if (cause instanceof PaymentError) {
        if (cause.code === "denied") return error("COMMERCE_DENIED", 403);
        if (cause.code === "conflict") return error("OPERATION_CONFLICT", 409);
      }
      return error("COMMERCE_UNAVAILABLE", 503);
    }
  });
}
