import { createHash, createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { PaymentIntent } from "../../packages/contracts/src/commerce-payments.ts";
import { RazorpayAdapter } from "../../packages/providers/src/razorpay.ts";
import type { TestFetch } from "../fixtures/fetch";

const operationId = "10000000-0000-4000-8000-000000000001";
const configuration = {
  accountId: "acc_synthetic",
  keyId: "rzp_test_synthetic",
  keySecret: "synthetic-api-only",
  webhookSecret: "synthetic-webhook-only",
};
const intent: PaymentIntent = {
  id: "10000000-0000-4000-8000-000000000002",
  operationId,
  subject: { kind: "order", id: "10000000-0000-4000-8000-000000000003" },
  ownerId: "10000000-0000-4000-8000-000000000004",
  amountPaise: 12345,
  currency: "INR",
  accountId: "acc_synthetic",
  state: "creating",
  providerOrderId: null,
};
const order = {
  entity: "order",
  id: "order_synthetic",
  amount: 12345,
  currency: "INR",
  receipt: operationId,
};
const envelope = () => ({
  entity: "event",
  account_id: "acc_synthetic",
  event: "payment.captured",
  payload: {
    payment: {
      entity: {
        entity: "payment",
        id: "pay_synthetic",
        order_id: "order_synthetic",
        amount: 12345,
        currency: "INR",
        status: "captured",
        captured: true,
      },
    },
  },
});
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const sign = (raw: Uint8Array) =>
  createHmac("sha256", configuration.webhookSecret).update(raw).digest("hex");
const transportFor = (value: unknown) => vi.fn<TestFetch>(async () => Response.json(value));

describe("Razorpay raw authentication and authoritative reference checks", () => {
  it("uses real REST order shape, fixed HTTPS and explicit test credentials without automatic retries", async () => {
    const transport = transportFor(order);
    const adapter = new RazorpayAdapter(configuration, transport);
    expect(await adapter.createOrder(intent)).toEqual({
      id: order.id,
      reference: operationId,
      amountPaise: 12345,
      currency: "INR",
    });
    expect(transport).toHaveBeenCalledOnce();
    const [url, init] = transport.mock.calls[0] ?? [];
    expect(url).toBe("https://api.razorpay.com/v1/orders");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      amount: 12345,
      currency: "INR",
      receipt: operationId,
      partial_payment: false,
    });
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
  it("verifies untouched bytes before fetching the provider order reference", async () => {
    const raw = bytes(envelope());
    const transport = transportFor(order);
    const adapter = new RazorpayAdapter(configuration, transport);
    expect(await adapter.verifyWebhook(raw, sign(raw), "evt_synthetic")).toEqual({
      id: order.id,
      reference: operationId,
      amountPaise: 12345,
      currency: "INR",
      accountId: "acc_synthetic",
      eventId: "evt_synthetic",
      digest: createHash("sha256").update(raw).digest("hex"),
      paymentId: "pay_synthetic",
      outcome: "captured",
    });
    expect(transport.mock.calls[0]?.[0]).toBe("https://api.razorpay.com/v1/orders/order_synthetic");
  });
  it("preserves standard UTF-8 BOM decoding and signs the complete original webhook bytes", async () => {
    const raw = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes(envelope())]);
    const response = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes(order)]);
    const transport = vi.fn<TestFetch>(async () => new Response(response));
    const adapter = new RazorpayAdapter(configuration, transport);
    expect(await adapter.createOrder(intent)).toMatchObject({ id: order.id });
    expect(await adapter.verifyWebhook(raw, sign(raw), "evt_bom_synthetic")).toMatchObject({
      digest: createHash("sha256").update(raw).digest("hex"),
      paymentId: "pay_synthetic",
      outcome: "captured",
    });
  });
  it.each(["", "0", "zz".repeat(32), "00".repeat(32)])(
    "denies malformed/incorrect signature %s before parsing/network",
    async (signature) => {
      const transport = transportFor(order);
      await expect(
        new RazorpayAdapter(configuration, transport).verifyWebhook(
          bytes(envelope()),
          signature,
          "evt_1",
        ),
      ).rejects.toThrow();
      expect(transport).not.toHaveBeenCalled();
    },
  );
  it("rejects byte-level tampering, invalid JSON, event IDs and oversized bodies", async () => {
    const transport = transportFor(order);
    const adapter = new RazorpayAdapter(configuration, transport);
    const raw = bytes(envelope());
    await expect(
      adapter.verifyWebhook(bytes({ ...envelope(), extra: true }), sign(raw), "evt_1"),
    ).rejects.toThrow();
    await expect(
      adapter.verifyWebhook(bytes("not-json"), sign(bytes("not-json")), "evt_1"),
    ).rejects.toThrow();
    await expect(adapter.verifyWebhook(raw, sign(raw), "bad event\n")).rejects.toThrow();
    await expect(
      adapter.verifyWebhook(new Uint8Array(262145), sign(raw), "evt_1"),
    ).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
  it.each(["account", "currency", "amount", "order", "status", "captured"])(
    "rejects signed %s mismatch",
    async (field) => {
      const value = envelope();
      const payment = value.payload.payment.entity;
      if (field === "account") value.account_id = "acc_wrong";
      if (field === "currency") payment.currency = "USD";
      if (field === "amount") payment.amount++;
      if (field === "order") payment.order_id = "order_other";
      if (field === "status") payment.status = "authorized";
      if (field === "captured") payment.captured = false;
      const raw = bytes(value);
      await expect(
        new RazorpayAdapter(configuration, transportFor(order)).verifyWebhook(
          raw,
          sign(raw),
          "evt_1",
        ),
      ).rejects.toThrow();
    },
  );
  it.each([
    { ...order, amount: 1 },
    { ...order, currency: "USD" },
    { ...order, receipt: "10000000-0000-4000-8000-000000000009" },
  ])("rejects create response mismatch", async (response) => {
    await expect(
      new RazorpayAdapter(configuration, transportFor(response)).createOrder(intent),
    ).rejects.toThrow();
  });
  it("reconciles by receipt without POST; empty and ambiguous responses never authorize retry", async () => {
    const transport = transportFor({ entity: "collection", count: 0, items: [] });
    const adapter = new RazorpayAdapter(configuration, transport);
    expect(await adapter.reconcileOrder({ ...intent, state: "unknown" })).toBeNull();
    expect(transport.mock.calls[0]?.[0]).toContain(`receipt=${operationId}`);
    expect(transport.mock.calls[0]?.[1]?.method).toBe("GET");
    await expect(
      new RazorpayAdapter(
        configuration,
        transportFor({ entity: "collection", count: 2, items: [order, order] }),
      ).reconcileOrder(intent),
    ).rejects.toThrow();
  });
  it("reconciles a captured payment via authenticated provider fetch, not browser data", async () => {
    const transport = transportFor({
      entity: "collection",
      count: 1,
      items: [envelope().payload.payment.entity],
    });
    const adapter = new RazorpayAdapter(configuration, transport);
    const normalized = {
      id: order.id,
      reference: operationId,
      amountPaise: 12345,
      currency: "INR" as const,
    };
    expect(await adapter.reconcileCapture(intent, normalized)).toMatchObject({
      paymentId: "pay_synthetic",
      outcome: "captured",
      eventId: "reconcile_pay_synthetic",
    });
    expect(transport.mock.calls[0]?.[0]).toBe(
      "https://api.razorpay.com/v1/orders/order_synthetic/payments",
    );
  });
  it("sanitizes provider failures and never retries POST", async () => {
    const transport = vi.fn<TestFetch>(async () => {
      throw new Error("private provider detail");
    });
    await expect(new RazorpayAdapter(configuration, transport).createOrder(intent)).rejects.toThrow(
      "Payment operation rejected: invalid_provider.",
    );
    expect(transport).toHaveBeenCalledOnce();
  });
  it("requires complete explicit configuration and rejects live keys", () => {
    expect(() => new RazorpayAdapter({ ...configuration, keySecret: "" })).toThrow();
    expect(() => new RazorpayAdapter({ ...configuration, keyId: "rzp_live_synthetic" })).toThrow();
  });
});
