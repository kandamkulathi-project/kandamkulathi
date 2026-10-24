import type { ServiceApp } from "@kandamkulathi/server";
import { unavailableIdentityDependencies } from "@kandamkulathi/server/identity";
import {
  type CommercePage,
  commercePageSchema,
} from "../../../packages/contracts/src/commerce-access";
import {
  type CartInput,
  type CheckoutInput,
  CommerceError,
  cartSchema,
  checkoutSchema,
  commerceCataloguePageSchema,
  commerceCheckoutSchema,
  commerceProductSchema,
  commerceQuoteSchema,
} from "../../../packages/contracts/src/commerce-catalogue";
import {
  commerceClinicsSchema,
  commerceStaffClinicsSchema,
} from "../../../packages/contracts/src/commerce-clinics";
import {
  commerceImportReportSchema,
  commerceImportRequestSchema,
  commercePaymentViewSchema,
  commerceReconcileRequestSchema,
  commerceRefundViewSchema,
  commerceWebhookViewSchema,
} from "../../../packages/contracts/src/commerce-http";
import {
  commerceBatchPageSchema,
  commerceOrderDetailSchema,
  commerceOrderPageSchema,
} from "../../../packages/contracts/src/commerce-orders";
import {
  createPaymentSchema,
  refundRequestSchema,
} from "../../../packages/contracts/src/commerce-payments";
import { canonicalUuidSchema } from "../../../packages/contracts/src/identifiers";
import { PaymentError } from "../../../packages/domain/src/commerce-payments";
import {
  authorizeCommerceRequest,
  CommerceAuthorityError,
  type CommerceIdentityDependencies,
  type CommercePrincipal,
} from "./commerce-authorization";

type HttpContext = Parameters<Parameters<ServiceApp["onError"]>[0]>[1];
type ImportRequest = ReturnType<typeof commerceImportRequestSchema.parse>;
type PaymentRequest = ReturnType<typeof createPaymentSchema.parse>;
type RefundRequest = ReturnType<typeof refundRequestSchema.parse>;

/** Trusted per-event services; no client can supply actor, clinic grants or provider implementations. */
export interface CommerceOperations {
  clinics(): Promise<unknown>;
  staffClinics(): Promise<unknown>;
  catalogue(page: CommercePage): Promise<unknown>;
  product(id: string): Promise<unknown | null>;
  quote(input: CartInput): Promise<unknown>;
  checkout(input: CheckoutInput): Promise<unknown>;
  orders(page: CommercePage, clinicId?: string): Promise<unknown>;
  order(id: string, clinicId?: string): Promise<unknown | null>;
  batches(page: CommercePage, clinicId: string): Promise<unknown>;
  importOpening(input: ImportRequest, clinicId: string): Promise<unknown>;
  createPayment(input: PaymentRequest): Promise<unknown>;
  payment(id: string): Promise<unknown>;
  reconcilePayment(id: string): Promise<unknown>;
  refund(input: RefundRequest): Promise<string>;
  webhook(raw: Uint8Array, signature: string, eventId: string): Promise<"applied" | "duplicate">;
}
export interface CommerceDependencies extends CommerceIdentityDependencies {
  /** Cookie CSRF/origin or verified native bearer transport; CORS alone is never sufficient. */
  verifyMutationRequest(
    request: Request,
    principal: CommercePrincipal,
  ): Promise<"allowed" | "denied" | "unavailable">;
  /** Owns one event-scoped runtime connection; public reads have no fabricated actor. */
  run<T>(
    principal: CommercePrincipal | null,
    work: (operations: CommerceOperations) => Promise<T>,
  ): Promise<T>;
}
export const unavailableCommerceDependencies: CommerceDependencies = {
  ...unavailableIdentityDependencies,
  async loadCommerceGrants() {
    return [];
  },
  async verifyMutationRequest() {
    return "unavailable";
  },
  async run() {
    throw new CommerceError("unavailable");
  },
};

function error(context: HttpContext, code: string, status: 400 | 401 | 403 | 404 | 409 | 503) {
  const message =
    status === 400
      ? "Commerce input is invalid."
      : status === 401
        ? "Authentication is required."
        : status === 403
          ? "Access is not permitted."
          : status === 404
            ? "Record was not found."
            : status === 409
              ? "Commerce state changed. Reload before confirming."
              : "Commerce is unavailable.";
  return context.json({ error: { code, message, requestId: context.get("requestId") } }, status);
}
function failure(context: HttpContext, cause: unknown) {
  if (cause instanceof CommerceAuthorityError)
    return error(context, cause.denial.code, cause.denial.status);
  if (cause instanceof CommerceError) {
    const status =
      cause.code === "invalid_input"
        ? 400
        : cause.code === "denied"
          ? 403
          : ["stale_version", "stock_shortage", "operation_conflict"].includes(cause.code)
            ? 409
            : 503;
    const code =
      cause.code === "unavailable"
        ? "COMMERCE_UNAVAILABLE"
        : cause.code === "denied"
          ? "COMMERCE_DENIED"
          : cause.code.toUpperCase();
    return error(context, code, status);
  }
  if (cause instanceof PaymentError) {
    return cause.code === "denied"
      ? error(context, "COMMERCE_DENIED", 403)
      : cause.code === "conflict"
        ? error(context, "OPERATION_CONFLICT", 409)
        : cause.code === "invalid_provider"
          ? error(context, "PAYMENT_VERIFICATION_FAILED", 400)
          : error(context, "COMMERCE_UNAVAILABLE", 503);
  }
  // Parse failures in trusted responses are not blamed on clients; never expose provider/SQL details.
  return error(context, "COMMERCE_UNAVAILABLE", 503);
}
const page = (context: HttpContext) => commercePageSchema.safeParse(context.req.query());

/** Register before the shared unavailable catch-all. Defaults fail closed until real adapters exist. */
export function registerCommerceRoutes(
  app: ServiceApp,
  dependencies: CommerceDependencies = unavailableCommerceDependencies,
): void {
  const principal = async (
    context: HttpContext,
    staffAction?: "orders:read" | "stock:read" | "catalogue:import",
  ) => {
    const clinic = staffAction
      ? canonicalUuidSchema.safeParse(context.req.param("clinicId"))
      : null;
    if (clinic && !clinic.success) return error(context, "INVALID_INPUT", 400);
    const result = await authorizeCommerceRequest(
      context.req.raw,
      dependencies,
      staffAction && clinic?.success
        ? { kind: "staff", clinicId: clinic.data, action: staffAction }
        : { kind: "customer" },
    );
    return result.allowed ? result : error(context, result.code, result.status);
  };
  const mutation = async (context: HttpContext, actor: CommercePrincipal) => {
    try {
      const decision = await dependencies.verifyMutationRequest(context.req.raw, actor);
      return decision === "allowed"
        ? null
        : error(
            context,
            decision === "denied" ? "FORBIDDEN" : "IDENTITY_UNAVAILABLE",
            decision === "denied" ? 403 : 503,
          );
    } catch {
      return error(context, "IDENTITY_UNAVAILABLE", 503);
    }
  };
  const body = async (context: HttpContext): Promise<unknown> => {
    if (!/^application\/json(?:\s*;|$)/i.test(context.req.header("Content-Type") ?? ""))
      throw new CommerceError("invalid_input");
    try {
      return await context.req.json();
    } catch {
      throw new CommerceError("invalid_input");
    }
  };

  app.get("/v1/commerce/clinics", async (context) => {
    if (new URL(context.req.url).search) return error(context, "INVALID_INPUT", 400);
    try {
      return context.json(
        commerceClinicsSchema.parse(await dependencies.run(null, (service) => service.clinics())),
      );
    } catch (cause) {
      return failure(context, cause);
    }
  });
  app.get("/v1/staff/commerce/clinics", async (context) => {
    const actor = await authorizeCommerceRequest(context.req.raw, dependencies, {
      kind: "staff_directory",
    });
    if (!actor.allowed) return error(context, actor.code, actor.status);
    if (new URL(context.req.url).search) return error(context, "INVALID_INPUT", 400);
    try {
      return context.json(
        commerceStaffClinicsSchema.parse(
          await dependencies.run(actor, (service) => service.staffClinics()),
        ),
      );
    } catch (cause) {
      return failure(context, cause);
    }
  });
  app.get("/v1/catalogue", async (context) => {
    const parsed = page(context);
    if (!parsed.success) return error(context, "INVALID_INPUT", 400);
    try {
      return context.json(
        commerceCataloguePageSchema.parse(
          await dependencies.run(null, (service) => service.catalogue(parsed.data)),
        ),
      );
    } catch (cause) {
      return failure(context, cause);
    }
  });
  app.get("/v1/products/:id", async (context) => {
    const id = canonicalUuidSchema.safeParse(context.req.param("id"));
    if (!id.success) return error(context, "INVALID_INPUT", 400);
    try {
      const product = await dependencies.run(null, (service) => service.product(id.data));
      return product === null
        ? error(context, "NOT_FOUND", 404)
        : context.json(commerceProductSchema.parse(product));
    } catch (cause) {
      return failure(context, cause);
    }
  });
  for (const route of ["/v1/cart", "/v1/cart/quote"] as const)
    app.post(route, async (context) => {
      const actor = await principal(context);
      if (actor instanceof Response) return actor;
      const blocked = await mutation(context, actor);
      if (blocked) return blocked;
      try {
        const input = cartSchema.safeParse(await body(context));
        if (!input.success) return error(context, "INVALID_INPUT", 400);
        return context.json(
          commerceQuoteSchema.parse(
            await dependencies.run(actor, (service) => service.quote(input.data)),
          ),
        );
      } catch (cause) {
        return failure(context, cause);
      }
    });
  app.post("/v1/checkout", async (context) => {
    const actor = await principal(context);
    if (actor instanceof Response) return actor;
    const blocked = await mutation(context, actor);
    if (blocked) return blocked;
    try {
      const input = checkoutSchema.safeParse(await body(context));
      if (!input.success) return error(context, "INVALID_INPUT", 400);
      return context.json(
        commerceCheckoutSchema.parse(
          await dependencies.run(actor, (service) => service.checkout(input.data)),
        ),
        201,
      );
    } catch (cause) {
      return failure(context, cause);
    }
  });

  for (const scope of ["customer", "staff"] as const) {
    const base = scope === "customer" ? "/v1/orders" : "/v1/staff/clinics/:clinicId/orders";
    app.get(base, async (context) => {
      const actor = await principal(context, scope === "staff" ? "orders:read" : undefined);
      if (actor instanceof Response) return actor;
      const parsed = page(context);
      if (!parsed.success) return error(context, "INVALID_INPUT", 400);
      try {
        return context.json(
          commerceOrderPageSchema.parse(
            await dependencies.run(actor, (service) =>
              service.orders(parsed.data, actor.clinicId ?? undefined),
            ),
          ),
        );
      } catch (cause) {
        return failure(context, cause);
      }
    });
    app.get(`${base}/:id`, async (context) => {
      const actor = await principal(context, scope === "staff" ? "orders:read" : undefined);
      if (actor instanceof Response) return actor;
      const id = canonicalUuidSchema.safeParse(context.req.param("id"));
      if (!id.success) return error(context, "INVALID_INPUT", 400);
      try {
        const result = await dependencies.run(actor, (service) =>
          service.order(id.data, actor.clinicId ?? undefined),
        );
        return result === null
          ? error(context, "NOT_FOUND", 404)
          : context.json(commerceOrderDetailSchema.parse(result));
      } catch (cause) {
        return failure(context, cause);
      }
    });
  }
  app.get("/v1/staff/clinics/:clinicId/batches", async (context) => {
    const actor = await principal(context, "stock:read");
    if (actor instanceof Response) return actor;
    const parsed = page(context);
    if (!parsed.success || !actor.clinicId) return error(context, "INVALID_INPUT", 400);
    const clinic = actor.clinicId;
    try {
      return context.json(
        commerceBatchPageSchema.parse(
          await dependencies.run(actor, (service) => service.batches(parsed.data, clinic)),
        ),
      );
    } catch (cause) {
      return failure(context, cause);
    }
  });
  app.post("/v1/staff/clinics/:clinicId/catalogue/import", async (context) => {
    const actor = await principal(context, "catalogue:import");
    if (actor instanceof Response) return actor;
    const blocked = await mutation(context, actor);
    if (blocked) return blocked;
    try {
      const input = commerceImportRequestSchema.safeParse(await body(context));
      if (!input.success || !actor.clinicId) return error(context, "INVALID_INPUT", 400);
      const clinic = actor.clinicId;
      return context.json(
        commerceImportReportSchema.parse(
          await dependencies.run(actor, (service) => service.importOpening(input.data, clinic)),
        ),
      );
    } catch (cause) {
      return failure(context, cause);
    }
  });

  for (const route of ["/v1/payments", "/v1/orders/:id/payment-intents"] as const)
    app.post(route, async (context) => {
      const actor = await principal(context);
      if (actor instanceof Response) return actor;
      const blocked = await mutation(context, actor);
      if (blocked) return blocked;
      try {
        const input = createPaymentSchema.safeParse(await body(context));
        if (!input.success) return error(context, "INVALID_INPUT", 400);
        if (
          route !== "/v1/payments" &&
          (input.data.subject.kind !== "order" || input.data.subject.id !== context.req.param("id"))
        )
          return error(context, "INVALID_INPUT", 400);
        return context.json(
          commercePaymentViewSchema.parse(
            await dependencies.run(actor, (service) => service.createPayment(input.data)),
          ),
          202,
        );
      } catch (cause) {
        return failure(context, cause);
      }
    });
  app.get("/v1/payments/:id", async (context) => {
    const actor = await principal(context);
    if (actor instanceof Response) return actor;
    const id = canonicalUuidSchema.safeParse(context.req.param("id"));
    if (!id.success) return error(context, "INVALID_INPUT", 400);
    try {
      return context.json(
        commercePaymentViewSchema.parse(
          await dependencies.run(actor, (service) => service.payment(id.data)),
        ),
      );
    } catch (cause) {
      return failure(context, cause);
    }
  });
  app.post("/v1/payments/:id/reconcile", async (context) => {
    const actor = await principal(context);
    if (actor instanceof Response) return actor;
    const blocked = await mutation(context, actor);
    if (blocked) return blocked;
    const id = canonicalUuidSchema.safeParse(context.req.param("id"));
    if (!id.success) return error(context, "INVALID_INPUT", 400);
    try {
      if (!commerceReconcileRequestSchema.safeParse(await body(context)).success)
        return error(context, "INVALID_INPUT", 400);
      return context.json(
        commercePaymentViewSchema.parse(
          await dependencies.run(actor, (service) => service.reconcilePayment(id.data)),
        ),
      );
    } catch (cause) {
      return failure(context, cause);
    }
  });
  app.post("/v1/payments/:id/refunds", async (context) => {
    const actor = await principal(context);
    if (actor instanceof Response) return actor;
    const blocked = await mutation(context, actor);
    if (blocked) return blocked;
    try {
      const input = refundRequestSchema.safeParse(await body(context));
      if (!input.success || input.data.intentId !== context.req.param("id"))
        return error(context, "INVALID_INPUT", 400);
      const refundId = await dependencies.run(actor, (service) => service.refund(input.data));
      return context.json(commerceRefundViewSchema.parse({ refundId, status: "pending" }), 202);
    } catch (cause) {
      return failure(context, cause);
    }
  });
  app.post("/v1/payments/razorpay/webhook", async (context) => {
    const signature = context.req.header("X-Razorpay-Signature") ?? "";
    const eventId = context.req.header("X-Razorpay-Event-Id") ?? "";
    if (!/^[a-fA-F0-9]{64}$/.test(signature) || !/^[A-Za-z0-9_-]{1,120}$/.test(eventId))
      return error(context, "PAYMENT_VERIFICATION_FAILED", 400);
    try {
      const raw = new Uint8Array(await context.req.arrayBuffer());
      const disposition = await dependencies.run(null, (service) =>
        service.webhook(raw, signature, eventId),
      );
      return context.json(commerceWebhookViewSchema.parse({ received: true, disposition }));
    } catch (cause) {
      return failure(context, cause);
    }
  });
}
