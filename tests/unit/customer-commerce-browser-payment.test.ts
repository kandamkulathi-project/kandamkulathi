import { describe, expect, it, vi } from "vitest";
import { createAuthoritativeCommerceApi } from "../../apps/workspaces/src/customer/commerce/authoritative-api";
import {
  type BrowserCheckoutPort,
  createBrowserPayment,
} from "../../apps/workspaces/src/customer/commerce/browserPayment";
import { commercePaymentCheckoutSchema } from "../../packages/contracts/src/commerce-checkout";
import { commercePaymentViewSchema } from "../../packages/contracts/src/commerce-http";
import type { TestFetch } from "../fixtures/fetch";

const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const payment = commercePaymentViewSchema.parse({
  intentId: id,
  operationId: id,
  subject: { kind: "order", id },
  amountPaise: 12000,
  currency: "INR",
  state: "ready",
  providerOrderId: "order_synthetic123",
});
const metadata = commercePaymentCheckoutSchema.parse({
  intentId: id,
  operationId: id,
  subject: payment.subject,
  keyId: "rzp_test_synthetic123",
  providerOrderId: payment.providerOrderId,
  amountPaise: 12000,
  currency: "INR",
});
const signal = () => new AbortController().signal;
function apiFor(fetcher: typeof fetch) {
  return createAuthoritativeCommerceApi(
    { origin: "https://api.example.test", credentials: "omit", fetch: fetcher },
    { payment: commercePaymentViewSchema, paymentCheckout: commercePaymentCheckoutSchema },
  );
}
describe("canonical checkout metadata", () => {
  it("reads only exact current ready intent metadata, without cookies/body or a new intent", async () => {
    const fetcher = vi.fn<TestFetch>().mockResolvedValue(Response.json(metadata));
    expect(await apiFor(fetcher).checkoutMetadata(payment, signal())).toEqual({
      status: "ready",
      data: metadata,
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe(`https://api.example.test/v1/payments/${id}/checkout`);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: "GET",
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
    });
    expect(fetcher.mock.calls[0]?.[1]?.body).toBeUndefined();
    expect(
      await apiFor(fetcher).checkoutMetadata({ ...payment, state: "unknown" }, signal()),
    ).toEqual({ status: "unavailable" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    { intentId: other },
    { operationId: other },
    { subject: { kind: "order", id: other } },
    { subject: { kind: "booking", id } },
    { providerOrderId: "order_another123" },
    { amountPaise: 1 },
    { currency: "USD" },
    { keyId: "rzp_live_notapproved" },
    { ownerId: other },
  ])("rejects changed identity/amount/authority or unknown fields %j", async (change) => {
    const fetcher = vi.fn<TestFetch>().mockResolvedValue(Response.json({ ...metadata, ...change }));
    expect(await apiFor(fetcher).checkoutMetadata(payment, signal())).toEqual({ status: "error" });
  });
  it.each([
    [401, "anonymous"],
    [403, "denied"],
    [409, "conflict"],
    [503, "unavailable"],
  ] as const)("preserves metadata HTTP %s", async (status, expected) => {
    expect(
      await apiFor(
        vi.fn<TestFetch>().mockResolvedValue(Response.json({}, { status })),
      ).checkoutMetadata(payment, signal()),
    ).toEqual({ status: expected });
  });
});
describe("browser canonical SDK bridge", () => {
  it.each(["callback", "cancel", "error"])(
    "uses reviewed SDK mapping, ignores %s and displays only a same-intent server read",
    async (outcome) => {
      const fetcher = vi
        .fn<TestFetch>()
        .mockResolvedValueOnce(Response.json(metadata))
        .mockResolvedValueOnce(Response.json({ ...payment, state: "unknown" }));
      const open = vi.fn<BrowserCheckoutPort["open"]>().mockImplementation(async () => {
        if (outcome !== "callback") throw Error("Provider outcome uncertain");
        return { status: "paid", amount: 1, razorpay_payment_id: "untrusted-callback" };
      });
      const dispose = vi.fn();
      const bridge = createBrowserPayment(
        apiFor(fetcher),
        () => true,
        () => ({ open, dispose }),
      );
      expect(await bridge.launch(payment, signal())).toEqual({
        status: "ready",
        data: { ...payment, state: "unknown" },
      });
      expect(open.mock.calls[0]?.[0]).toEqual({
        key: metadata.keyId,
        order_id: metadata.providerOrderId,
        amount: 12000,
        currency: "INR",
      });
      expect(fetcher.mock.calls[1]?.[0]).toBe(`https://api.example.test/v1/payments/${id}`);
      expect(
        fetcher.mock.calls.every(([, init]) => init?.method === "GET" && init?.body === undefined),
      ).toBe(true);
      expect(dispose).toHaveBeenCalledOnce();
    },
  );
  it("does not open after revocation during metadata and fences duplicate launches", async () => {
    let finish!: (response: Response) => void;
    const fetcher = vi.fn<TestFetch>(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const open = vi.fn<BrowserCheckoutPort["open"]>();
    const bridge = createBrowserPayment(
      apiFor(fetcher),
      () => true,
      () => ({ open, dispose: vi.fn() }),
    );
    const pending = bridge.launch(payment, signal());
    expect(await bridge.launch(payment, signal())).toEqual({ status: "unavailable" });
    bridge.dispose();
    finish(Response.json(metadata));
    expect(await pending).toEqual({ status: "anonymous" });
    expect(open).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("closes an already-open SDK on lifetime disposal and ignores its late callback", async () => {
    const fetcher = vi.fn<TestFetch>().mockResolvedValue(Response.json(metadata));
    let started!: () => void;
    const opened = new Promise<void>((resolve) => {
      started = resolve;
    });
    let finish!: (value: unknown) => void;
    const open = vi.fn<BrowserCheckoutPort["open"]>(
      () =>
        new Promise((resolve) => {
          finish = resolve;
          started();
        }),
    );
    const dispose = vi.fn(() => finish({ status: "paid" }));
    const bridge = createBrowserPayment(
      apiFor(fetcher),
      () => true,
      () => ({ open, dispose }),
    );
    const pending = bridge.launch(payment, signal());
    await opened;
    bridge.dispose();
    expect(await pending).toEqual({ status: "anonymous" });
    expect(dispose).toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
