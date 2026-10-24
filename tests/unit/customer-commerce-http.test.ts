import { describe, expect, it, vi } from "vitest";
import {
  type AuthoritativeCart,
  type AuthoritativeCheckoutInput,
  type AuthoritativeQuote,
  type AuthoritativeReservation,
  approvedImageSource,
  createAuthoritativeCommerceApi,
  type RuntimeSchema,
} from "../../apps/workspaces/src/customer/commerce/authoritative-api";
import {
  commercePaymentViewSchema,
  commerceReconcileRequestSchema,
} from "../../packages/contracts/src/commerce-http";
import { createPaymentSchema } from "../../packages/contracts/src/commerce-payments";

const locationId = "00000000-0000-4000-8000-000000000001";
const skuId = "00000000-0000-4000-8000-000000000002";
const operationId = "00000000-0000-4000-8000-000000000003";
const cart: AuthoritativeCart = { locationId, lines: [{ skuId, quantity: 2 }] };
const quote: AuthoritativeQuote = {
  lines: [
    {
      skuId,
      quantity: 2,
      version: 3,
      unitPaise: 100,
      taxPaise: 10,
      amountPaise: 210,
      taxPolicyId: locationId,
      rateBps: 500,
    },
  ],
  amountPaise: 210,
  currency: "INR",
  quoteKey: "synthetic-quote",
};
const checkout: AuthoritativeCheckoutInput = {
  ...cart,
  deliveryAddress: {
    recipientName: "Synthetic recipient",
    line1: "1 Test Street",
    city: "Test City",
    region: "Kerala",
    postalCode: "680001",
    country: "IN",
    contactPhone: "+919999999999",
  },
  operationId,
  confirmed: true,
  quoteKey: quote.quoteKey,
  versions: { [skuId]: 3 },
};
const reserved: AuthoritativeReservation = {
  orderId: operationId,
  amountPaise: 210,
  currency: "INR",
  status: "reserved",
  expiresAt: "2026-10-24T12:00:00.000Z",
};
// A deliberately finite synthetic schema test double, not a copy of domain rules.
function fixtureSchema<T>(expected: T): RuntimeSchema<T> {
  return {
    parse(value) {
      if (JSON.stringify(value) !== JSON.stringify(expected))
        throw new Error("Invalid synthetic fixture");
      return expected;
    },
  };
}
const schemas = {
  cart: fixtureSchema(cart),
  quote: fixtureSchema(quote),
  checkoutInput: fixtureSchema(checkout),
  reservation: fixtureSchema(reserved),
};
const signal = () => new AbortController().signal;
describe("authoritative customer commerce HTTP adapter", () => {
  it("omits native cookies when requested without changing bearer transport or canonical API", async () => {
    const fetcher = vi.fn<TestFetch>().mockResolvedValue(Response.json(quote));
    const api = createAuthoritativeCommerceApi(
      {
        origin: "https://api.example.invalid",
        credentials: "omit",
        fetch: fetcher,
        authorizeMutation: async () => ({ Authorization: "Bearer synthetic-test-only" }),
      },
      schemas,
    );
    expect(await api.quote(cart, signal())).toEqual({ status: "ready", data: quote });
    expect(fetcher.mock.calls[0]?.[1]?.credentials).toBe("omit");
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe(
      "Bearer synthetic-test-only",
    );
  });
  it("reads/reconciles only an existing intent using frozen GET and strict empty-body POST", async () => {
    const payment = commercePaymentViewSchema.parse({
      intentId: skuId,
      operationId,
      subject: { kind: "order", id: locationId },
      amountPaise: 210,
      currency: "INR",
      state: "unknown",
      providerOrderId: null,
    });
    const fetcher = vi
      .fn<TestFetch>()
      .mockResolvedValueOnce(Response.json(payment))
      .mockResolvedValueOnce(Response.json({ ...payment, state: "captured" }))
      .mockResolvedValueOnce(Response.json({ ...payment, intentId: locationId }));
    const api = createAuthoritativeCommerceApi(
      {
        origin: "https://api.example.invalid",
        fetch: fetcher,
        authorizeMutation: async () => ({}),
      },
      { payment: commercePaymentViewSchema, reconcileInput: commerceReconcileRequestSchema },
    );
    expect(await api.readPayment(payment, signal())).toEqual({ status: "ready", data: payment });
    expect(await api.reconcilePayment(payment, signal())).toEqual({
      status: "ready",
      data: { ...payment, state: "captured" },
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe(`https://api.example.invalid/v1/payments/${skuId}`);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: "GET" });
    expect(fetcher.mock.calls[0]?.[1]?.body).toBeUndefined();
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      `https://api.example.invalid/v1/payments/${skuId}/reconcile`,
    );
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({ method: "POST", body: "{}" });
    expect(await api.readPayment(payment, signal())).toEqual({ status: "error" });
  });
  it("uses canonical payment route without interpreting pending/unknown as captured", async () => {
    const input = {
      operationId,
      subject: { kind: "order" as const, id: operationId },
      method: "razorpay" as const,
    };
    const payment = {
      intentId: operationId,
      operationId,
      subject: input.subject,
      amountPaise: 210,
      currency: "INR" as const,
      state: "unknown" as const,
      providerOrderId: null,
    };
    const fetcher = vi.fn<TestFetch>().mockResolvedValue(Response.json(payment, { status: 202 }));
    const api = createAuthoritativeCommerceApi(
      {
        origin: "https://api.example.invalid",
        fetch: fetcher,
        authorizeMutation: async () => ({}),
      },
      { paymentInput: createPaymentSchema, payment: commercePaymentViewSchema },
    );
    expect(await api.createPayment(operationId, input, signal())).toEqual({
      status: "ready",
      data: payment,
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      `https://api.example.invalid/v1/orders/${operationId}/payment-intents`,
    );
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual(input);
  });
  it("rejects route/body mismatch, booking subjects and client-controlled fields before HTTP", async () => {
    const fetcher = vi.fn<TestFetch>();
    const api = createAuthoritativeCommerceApi(
      {
        origin: "https://api.example.invalid",
        fetch: fetcher,
        authorizeMutation: async () => ({}),
      },
      { paymentInput: createPaymentSchema, payment: commercePaymentViewSchema },
    );
    const input = { operationId, subject: { kind: "order", id: operationId }, method: "razorpay" };
    for (const body of [
      { ...input, subject: { kind: "booking", id: operationId } },
      { ...input, subject: { kind: "order", id: skuId } },
      { ...input, ownerId: skuId },
      { ...input, amountPaise: 1 },
      { ...input, source: "web" },
    ]) {
      expect(await api.createPayment(operationId, body, signal())).toEqual({ status: "error" });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("preserves payment retry identity and rejects a response for another order or operation", async () => {
    const input = { operationId, subject: { kind: "order", id: operationId }, method: "razorpay" };
    const payment = {
      intentId: skuId,
      operationId,
      subject: input.subject,
      amountPaise: 210,
      currency: "INR",
      state: "pending",
      providerOrderId: null,
    };
    const fetcher = vi
      .fn<TestFetch>()
      .mockRejectedValueOnce(Error("uncertain"))
      .mockResolvedValueOnce(Response.json(payment))
      .mockResolvedValueOnce(Response.json({ ...payment, subject: { kind: "order", id: skuId } }))
      .mockResolvedValueOnce(Response.json({ ...payment, operationId: skuId }));
    const api = createAuthoritativeCommerceApi(
      {
        origin: "https://api.example.invalid",
        fetch: fetcher,
        authorizeMutation: async () => ({}),
      },
      { paymentInput: createPaymentSchema, payment: commercePaymentViewSchema },
    );
    expect(await api.createPayment(operationId, input, signal())).toEqual({ status: "error" });
    expect(await api.createPayment(operationId, input, signal())).toEqual({
      status: "ready",
      data: payment,
    });
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(fetcher.mock.calls[1]?.[1]?.body);
    expect(await api.createPayment(operationId, input, signal())).toEqual({ status: "error" });
    expect(await api.createPayment(operationId, input, signal())).toEqual({ status: "error" });
  });
  it("uses frozen quote/checkout routes and only validated server amounts", async () => {
    const fetcher = vi
      .fn<TestFetch>()
      .mockResolvedValueOnce(Response.json(quote))
      .mockResolvedValueOnce(Response.json(reserved, { status: 201 }));
    const api = createAuthoritativeCommerceApi(
      {
        origin: "https://api.example.invalid",
        fetch: fetcher,
        authorizeMutation: async () => ({ "X-Test-CSRF": "synthetic" }),
      },
      schemas,
    );
    expect(await api.quote(cart, signal())).toEqual({ status: "ready", data: quote });
    expect(await api.checkout(checkout, signal())).toEqual({ status: "ready", data: reserved });
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://api.example.invalid/v1/cart/quote");
    expect(fetcher.mock.calls[1]?.[0]).toBe("https://api.example.invalid/v1/checkout");
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual(checkout);
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
      credentials: "include",
      cache: "no-store",
      redirect: "error",
      method: "POST",
    });
  });
  it("retries only the caller-supplied identical operation/body after uncertainty", async () => {
    const fetcher = vi
      .fn<TestFetch>()
      .mockRejectedValueOnce(new Error("unknown provider result"))
      .mockResolvedValueOnce(Response.json(reserved));
    const api = createAuthoritativeCommerceApi(
      {
        origin: "https://api.example.invalid",
        fetch: fetcher,
        authorizeMutation: async () => ({}),
      },
      schemas,
    );
    expect(await api.checkout(checkout, signal())).toEqual({ status: "error" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await api.checkout(checkout, signal())).toEqual({ status: "ready", data: reserved });
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(fetcher.mock.calls[1]?.[1]?.body);
  });
  it("denies mutations without senior transport authorization or authoritative validators", async () => {
    const fetcher = vi.fn<TestFetch>();
    const noAuthorization = createAuthoritativeCommerceApi(
      { origin: "https://api.example.invalid", fetch: fetcher },
      schemas,
    );
    expect(await noAuthorization.quote(cart, signal())).toEqual({ status: "unavailable" });
    const noSchemas = createAuthoritativeCommerceApi(
      {
        origin: "https://api.example.invalid",
        fetch: fetcher,
        authorizeMutation: async () => ({}),
      },
      {},
    );
    expect(await noSchemas.checkout(checkout, signal())).toEqual({ status: "unavailable" });
    expect(await noSchemas.catalogue(signal())).toEqual({ status: "unavailable" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects invalid/overridden input before network calls", async () => {
    const fetcher = vi.fn<TestFetch>();
    const api = createAuthoritativeCommerceApi(
      {
        origin: "https://api.example.invalid",
        fetch: fetcher,
        authorizeMutation: async () => ({}),
      },
      schemas,
    );
    expect(
      await api.checkout({ ...checkout, amountPaise: 1, ownerId: "attacker" }, signal()),
    ).toEqual({ status: "error" });
    expect(await api.quote({ ...cart, lines: [] }, signal())).toEqual({ status: "error" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    [401, "anonymous"],
    [403, "denied"],
    [404, "denied"],
    [409, "conflict"],
    [503, "unavailable"],
    [500, "error"],
  ] as const)("maps HTTP %s without exposing backend messages", async (status, expected) => {
    const fetcher = vi
      .fn<TestFetch>()
      .mockResolvedValue(
        Response.json(
          { error: { code: "TEST", message: "private diagnostic", requestId: "test" } },
          { status },
        ),
      );
    const api = createAuthoritativeCommerceApi(
      { origin: "https://api.example.invalid", fetch: fetcher },
      { orderPage: fixtureSchema({ items: [], nextCursor: null }) },
    );
    expect(await api.orders(signal())).toEqual({ status: expected });
  });
  it("validates bare owner-order responses, pagination references and forwards abort", async () => {
    const response = { items: [], nextCursor: null };
    const fetcher = vi.fn<TestFetch>().mockResolvedValue(Response.json(response));
    const api = createAuthoritativeCommerceApi(
      { origin: "http://127.0.0.1:8787", fetch: fetcher },
      { orderPage: fixtureSchema(response) },
    );
    const controller = new AbortController();
    expect(await api.orders(controller.signal, operationId)).toEqual({
      status: "ready",
      data: response,
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      `http://127.0.0.1:8787/v1/orders?limit=25&after=${operationId}`,
    );
    expect(fetcher.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
    expect(() => api.order("../../private", signal())).toThrow();
  });
  it("does not turn malformed or HTML success responses into a reservation", async () => {
    const fetcher = vi
      .fn<TestFetch>()
      .mockResolvedValueOnce(Response.json({ ...reserved, status: "paid" }))
      .mockResolvedValueOnce(
        new Response("<html>login</html>", { headers: { "Content-Type": "text/html" } }),
      );
    const api = createAuthoritativeCommerceApi(
      {
        origin: "https://api.example.invalid",
        fetch: fetcher,
        authorizeMutation: async () => ({}),
      },
      schemas,
    );
    expect(await api.checkout(checkout, signal())).toEqual({ status: "error" });
    expect(await api.checkout(checkout, signal())).toEqual({ status: "error" });
  });
  it.each([
    "http://example.invalid",
    "https://api.example.invalid/path",
    "https://user:pass@example.invalid",
    "javascript:alert(1)",
  ])("rejects unapproved transport origin %s", (origin) => {
    expect(() => createAuthoritativeCommerceApi({ origin }, {})).toThrow();
  });
  it("only renders approved HTTPS image sources, never data/script/protocol-relative URLs", () => {
    expect(approvedImageSource("https://images.example.invalid/approved.webp")).toBe(
      "https://images.example.invalid/approved.webp",
    );
    for (const value of [
      "javascript:alert(1)",
      "data:image/svg+xml,test",
      "//evil.invalid/image",
      "http://images.example.invalid/test",
      "https://user:password@images.example.invalid/test",
    ])
      expect(approvedImageSource(value)).toBeNull();
  });
});

import type { TestFetch } from "../fixtures/fetch";
