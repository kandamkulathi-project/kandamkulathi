// Coordinator must integrate these exact domain-owned source files first.
// Type-only imports keep this lane from copying business contracts or rules.

import type { DeliveryAddress } from "../../../../../packages/contracts/src/commerce-address";
import type {
  CartInput,
  CheckoutInput,
  CommerceCheckout,
  CommerceQuote,
} from "../../../../../packages/contracts/src/commerce-catalogue";
import type { CommercePaymentCheckout } from "../../../../../packages/contracts/src/commerce-checkout";
import type { CommercePaymentView } from "../../../../../packages/contracts/src/commerce-http";
import type {
  CommerceOrderDetail,
  CommerceOrderPage,
  CommerceOrderSummary,
} from "../../../../../packages/contracts/src/commerce-orders";
import type { CreatePayment } from "../../../../../packages/contracts/src/commerce-payments";
import type { Reply } from "./contracts";

/** Structural schema port: inject the authoritative shared Zod schemas, not a
 * client reimplementation of eligibility, tax, pricing or checkout validation. */
export type RuntimeSchema<T> = { parse(value: unknown): T };
export type AuthoritativeCart = CartInput;
export type AuthoritativeCheckoutInput = CheckoutInput;
export type AuthoritativeQuote = CommerceQuote;
export type AuthoritativeReservation = CommerceCheckout;
export type AuthoritativeOrder = CommerceOrderSummary;
export type AuthoritativeOrderDetail = CommerceOrderDetail;
export type AuthoritativePaymentInput = CreatePayment;
export type AuthoritativePayment = CommercePaymentView;
export type AuthoritativeDeliveryAddress = DeliveryAddress;
export type AuthoritativePage<T> = { items: T[]; nextCursor: string | null };

/** Public product schema was not yet frozen in the domain handoff. The owner
 * supplies its parser AND an approved presentation-only projection explicitly. */
export type ApprovedProductPresentation = {
  reference: string;
  title: string;
  description: string;
  concerns: string[];
  /** Server-backed variant identifiers and approved display names; never infer SKUs. */
  variants?: { reference: string; title: string }[];
  displayPricePaise?: number;
  stockStatus?: "available" | "unavailable" | "unknown";
  consultOnly?: boolean;
  image?: { src: string; alt: string };
};
export type AuthoritativeCommerceSchemas<Product> = {
  cataloguePage?: RuntimeSchema<AuthoritativePage<Product>>;
  product?: RuntimeSchema<Product>;
  presentProduct?: (product: Product) => ApprovedProductPresentation;
  cart?: RuntimeSchema<AuthoritativeCart>;
  checkoutInput?: RuntimeSchema<AuthoritativeCheckoutInput>;
  quote?: RuntimeSchema<AuthoritativeQuote>;
  reservation?: RuntimeSchema<AuthoritativeReservation>;
  orderPage?: RuntimeSchema<CommerceOrderPage>;
  orderDetail?: RuntimeSchema<AuthoritativeOrderDetail>;
  paymentInput?: RuntimeSchema<CreatePayment>;
  payment?: RuntimeSchema<CommercePaymentView>;
  paymentCheckout?: RuntimeSchema<CommercePaymentCheckout>;
  reconcileInput?: RuntimeSchema<Record<string, never>>;
  deliveryAddress?: RuntimeSchema<DeliveryAddress>;
};
export type AuthoritativeTransport = {
  origin: string;
  /** Browser cookie transport by default; native bearer transport must omit cookies. */
  credentials?: "include" | "omit";
  /** Senior-owned CSRF/current-origin transport authorization. Missing denies
   * mutations; no arbitrary cookie/header is constructed by this module. */
  authorizeMutation?: (signal: AbortSignal) => Promise<HeadersInit>;
  fetch?: typeof globalThis.fetch;
};

/** Compose the customer command from the current server quote. The server owns
 * source/actor attribution; no client source or computed amount is submitted. */
export function customerCheckoutInput(
  input: {
    cart: AuthoritativeCart;
    quote: AuthoritativeQuote;
    deliveryAddress: AuthoritativeDeliveryAddress;
    operationId: string;
  },
  schema: RuntimeSchema<AuthoritativeCheckoutInput>,
): AuthoritativeCheckoutInput {
  return schema.parse({
    ...input.cart,
    deliveryAddress: input.deliveryAddress,
    operationId: input.operationId,
    confirmed: true,
    quoteKey: input.quote.quoteKey,
    versions: Object.fromEntries(input.quote.lines.map((line) => [line.skuId, line.version])),
  });
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function reference(value: string) {
  if (!uuid.test(value)) throw new Error("Invalid reference");
  return value;
}
export function approvedImageSource(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
export function createAuthoritativeCommerceApi<Product>(
  transport: AuthoritativeTransport,
  schemas: AuthoritativeCommerceSchemas<Product>,
) {
  const url = new URL(transport.origin);
  if (
    url.origin !== transport.origin ||
    url.username ||
    url.password ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))
    )
  )
    throw new Error("Invalid API origin");
  const fetcher = transport.fetch ?? globalThis.fetch;
  async function request<T>(
    path: string,
    schema: RuntimeSchema<T> | undefined,
    signal: AbortSignal,
    body?: unknown,
  ): Promise<Reply<T>> {
    if (!schema || (body !== undefined && !transport.authorizeMutation))
      return { status: "unavailable" };
    try {
      const headers = new Headers(
        body === undefined ? undefined : await transport.authorizeMutation?.(signal),
      );
      headers.set("Accept", "application/json");
      if (body !== undefined) headers.set("Content-Type", "application/json");
      const response = await fetcher(`${transport.origin}${path}`, {
        signal,
        credentials: transport.credentials ?? "include",
        cache: "no-store",
        redirect: "error",
        method: body === undefined ? "GET" : "POST",
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (response.status === 401) return { status: "anonymous" };
      if (response.status === 403 || response.status === 404) return { status: "denied" };
      if (response.status === 409) return { status: "conflict" };
      if (response.status === 503) return { status: "unavailable" };
      if (!response.ok || !response.headers.get("Content-Type")?.includes("application/json"))
        return { status: "error" };
      return { status: "ready", data: schema.parse(await response.json()) };
    } catch {
      return { status: "error" };
    }
  }
  function page(after?: string) {
    return `?limit=25${after ? `&after=${reference(after)}` : ""}`;
  }
  async function paymentState(
    expected: CommercePaymentView,
    signal: AbortSignal,
    reconcile: boolean,
  ): Promise<Reply<CommercePaymentView>> {
    if (!schemas.payment || (reconcile && !schemas.reconcileInput))
      return { status: "unavailable" };
    try {
      const target = schemas.payment.parse(expected);
      if (target.subject.kind !== "order") return { status: "error" };
      const reply = await request(
        `/v1/payments/${reference(target.intentId)}${reconcile ? "/reconcile" : ""}`,
        schemas.payment,
        signal,
        reconcile ? schemas.reconcileInput?.parse({}) : undefined,
      );
      if (
        reply.status === "ready" &&
        (reply.data.intentId !== target.intentId ||
          reply.data.operationId !== target.operationId ||
          reply.data.subject.kind !== "order" ||
          reply.data.subject.id !== target.subject.id)
      )
        return { status: "error" };
      return reply;
    } catch {
      return { status: "error" };
    }
  }
  return {
    schemas,
    async checkoutMetadata(
      expected: CommercePaymentView,
      signal: AbortSignal,
    ): Promise<Reply<CommercePaymentCheckout>> {
      if (!schemas.payment || !schemas.paymentCheckout) return { status: "unavailable" };
      try {
        const target = schemas.payment.parse(expected);
        if (target.state !== "ready" || target.subject.kind !== "order" || !target.providerOrderId)
          return { status: "unavailable" };
        const reply = await request(
          `/v1/payments/${reference(target.intentId)}/checkout`,
          schemas.paymentCheckout,
          signal,
        );
        if (
          reply.status === "ready" &&
          (reply.data.intentId !== target.intentId ||
            reply.data.operationId !== target.operationId ||
            reply.data.subject.kind !== target.subject.kind ||
            reply.data.subject.id !== target.subject.id ||
            reply.data.providerOrderId !== target.providerOrderId ||
            reply.data.amountPaise !== target.amountPaise ||
            reply.data.currency !== target.currency)
        )
          return { status: "error" };
        return reply;
      } catch {
        return { status: "error" };
      }
    },
    readPayment: (expected: CommercePaymentView, signal: AbortSignal) =>
      paymentState(expected, signal, false),
    reconcilePayment: (expected: CommercePaymentView, signal: AbortSignal) =>
      paymentState(expected, signal, true),
    catalogue: (signal: AbortSignal, after?: string) =>
      request(`/v1/catalogue${page(after)}`, schemas.cataloguePage, signal),
    product: (id: string, signal: AbortSignal) =>
      request(`/v1/products/${reference(id)}`, schemas.product, signal),
    orders: (signal: AbortSignal, after?: string) =>
      request(`/v1/orders${page(after)}`, schemas.orderPage, signal),
    order: (id: string, signal: AbortSignal) =>
      request(`/v1/orders/${reference(id)}`, schemas.orderDetail, signal),
    async quote(input: unknown, signal: AbortSignal): Promise<Reply<AuthoritativeQuote>> {
      if (!schemas.cart) return { status: "unavailable" };
      try {
        return await request("/v1/cart/quote", schemas.quote, signal, schemas.cart.parse(input));
      } catch {
        return { status: "error" };
      }
    },
    async checkout(input: unknown, signal: AbortSignal): Promise<Reply<AuthoritativeReservation>> {
      if (!schemas.checkoutInput) return { status: "unavailable" };
      try {
        return await request(
          "/v1/checkout",
          schemas.reservation,
          signal,
          schemas.checkoutInput.parse(input),
        );
      } catch {
        return { status: "error" };
      }
    },
    async createPayment(
      orderId: string,
      input: unknown,
      signal: AbortSignal,
    ): Promise<Reply<CommercePaymentView>> {
      if (!schemas.paymentInput) return { status: "unavailable" };
      try {
        const parsed = schemas.paymentInput.parse(input);
        if (parsed.subject.kind !== "order" || parsed.subject.id !== reference(orderId))
          return { status: "error" };
        const reply = await request(
          `/v1/orders/${reference(orderId)}/payment-intents`,
          schemas.payment,
          signal,
          parsed,
        );
        if (
          reply.status === "ready" &&
          (reply.data.subject.kind !== "order" ||
            reply.data.subject.id !== orderId ||
            reply.data.operationId !== parsed.operationId)
        )
          return { status: "error" };
        return reply;
      } catch {
        return { status: "error" };
      }
    },
  };
}
