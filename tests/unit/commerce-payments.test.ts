import { describe, expect, it, vi } from "vitest";
import {
  createPaymentSchema,
  type PaymentIntent,
  refundRequestSchema,
} from "../../packages/contracts/src/commerce-payments.ts";
import {
  assertProviderOrder,
  CommercePayments,
  type PaymentProvider,
  type PaymentStore,
} from "../../packages/domain/src/commerce-payments.ts";

const id = "20000000-0000-4000-8000-000000000001";
const request = {
  operationId: id,
  subject: { kind: "order" as const, id },
  method: "razorpay" as const,
};
const intent: PaymentIntent = {
  id,
  operationId: id,
  subject: request.subject,
  ownerId: id,
  amountPaise: 100,
  currency: "INR",
  accountId: "acc_test",
  state: "pending",
  providerOrderId: null,
};
const order = { id: "order_test", reference: id, amountPaise: 100, currency: "INR" as const };
const setup = () => {
  const store: PaymentStore = {
    open: vi.fn(async () => intent),
    get: vi.fn(async () => ({ ...intent, state: "unknown" as const })),
    claimCreate: vi.fn(async () => ({ ...intent, state: "creating" as const })),
    bindOrder: vi.fn(async () => {}),
    markUnknown: vi.fn(async () => {}),
    receive: vi.fn(async () => "applied" as const),
    requestRefund: vi.fn(async () => id),
  };
  const provider: PaymentProvider = {
    accountId: "acc_test",
    createOrder: vi.fn(async () => order),
    reconcileOrder: vi.fn(async () => null),
    reconcileCapture: vi.fn(async () => null),
    verifyWebhook: vi.fn(),
  };
  return { store, provider, service: new CommercePayments(store, provider) };
};
describe("commerce payment orchestration boundaries", () => {
  it("accepts only stable identity, never client totals, owner, paid flag, COD or callback claims", () => {
    expect(createPaymentSchema.parse(request)).toEqual(request);
    for (const extra of [
      { amountPaise: 1 },
      { ownerId: id },
      { paid: true },
      { currency: "USD" },
      { method: "cod" },
    ])
      expect(createPaymentSchema.safeParse({ ...request, ...extra }).success).toBe(false);
    for (const amountPaise of [0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])
      expect(
        refundRequestSchema.safeParse({ operationId: id, intentId: id, amountPaise }).success,
      ).toBe(false);
  });
  it("commits the create claim before provider work and only binds a validated response", async () => {
    const { store, provider, service } = setup();
    await service.create(id, request);
    expect(vi.mocked(store.claimCreate).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(provider.createOrder).mock.invocationCallOrder[0] ?? 0,
    );
    expect(store.bindOrder).toHaveBeenCalledWith(id, id, order);
    expect(store.markUnknown).not.toHaveBeenCalled();
  });
  it("does not POST after a durable attempt already exists", async () => {
    const { store, provider, service } = setup();
    vi.mocked(store.claimCreate).mockResolvedValue(null);
    await service.create(id, request);
    expect(provider.createOrder).not.toHaveBeenCalled();
  });
  it("persists uncertainty on lost response or bind failure, without retry", async () => {
    for (const phase of ["provider", "bind"]) {
      const { store, provider, service } = setup();
      if (phase === "provider")
        vi.mocked(provider.createOrder).mockRejectedValue(new Error("lost"));
      else vi.mocked(store.bindOrder).mockRejectedValue(new Error("commit unknown"));
      expect((await service.create(id, request)).state).toBe("unknown");
      expect(store.markUnknown).toHaveBeenCalledWith(id, id);
      expect(provider.createOrder).toHaveBeenCalledOnce();
    }
  });
  it("never contacts provider when durable claim persistence failed", async () => {
    const { store, provider, service } = setup();
    vi.mocked(store.claimCreate).mockRejectedValue(new Error("commit unknown"));
    await expect(service.create(id, request)).rejects.toThrow();
    expect(provider.createOrder).not.toHaveBeenCalled();
  });
  it("reconciles only by reads; no match remains unknown", async () => {
    const { provider, service } = setup();
    expect((await service.reconcile(id, id)).state).toBe("unknown");
    expect(provider.reconcileOrder).toHaveBeenCalledOnce();
    expect(provider.createOrder).not.toHaveBeenCalled();
  });
  it("GET reads persisted state without any external reconciliation", async () => {
    const { store, provider, service } = setup();
    await service.get(id, id);
    expect(store.get).toHaveBeenCalledWith(id, id);
    expect(provider.reconcileOrder).not.toHaveBeenCalled();
    expect(provider.createOrder).not.toHaveBeenCalled();
  });
  it("explicit reconciliation delivers capture to a separate JOBS receipt sink, not CORE store", async () => {
    const { store, provider } = setup();
    const verified = {
      ...order,
      accountId: "acc_test",
      paymentId: "pay_test",
      outcome: "captured" as const,
      eventId: "evt",
      digest: "a".repeat(64),
    };
    vi.mocked(provider.reconcileOrder).mockResolvedValue(order);
    vi.mocked(provider.reconcileCapture).mockResolvedValue(verified);
    const receipts = { receive: vi.fn(async () => "applied" as const) };
    await new CommercePayments(store, provider, receipts).reconcile(id, id);
    expect(receipts.receive).toHaveBeenCalledWith(verified);
    expect(store.receive).not.toHaveBeenCalled();
    expect(provider.createOrder).not.toHaveBeenCalled();
  });
  it("rejects reference, amount and currency mismatches", () => {
    for (const changed of [
      { ...order, reference: "20000000-0000-4000-8000-000000000099" },
      { ...order, amountPaise: 1 },
      { ...order, id: "order_other" },
    ]) {
      const expected =
        changed.id === "order_other" ? { ...intent, providerOrderId: "order_test" } : intent;
      expect(() => assertProviderOrder(expected, changed)).toThrow();
    }
  });
  it("does not acknowledge failed verification or durable receipt failure", async () => {
    const { store, provider, service } = setup();
    vi.mocked(provider.verifyWebhook).mockRejectedValue(new Error("bad signature"));
    await expect(service.webhook(new Uint8Array(), "", "evt")).rejects.toThrow();
    expect(store.receive).not.toHaveBeenCalled();
    vi.mocked(provider.verifyWebhook).mockResolvedValue({
      ...order,
      accountId: "acc_test",
      paymentId: "pay_test",
      outcome: "captured",
      eventId: "evt",
      digest: "a".repeat(64),
    });
    vi.mocked(store.receive).mockRejectedValue(new Error("database unavailable"));
    await expect(service.webhook(new Uint8Array(), "", "evt")).rejects.toThrow();
    vi.mocked(store.receive).mockResolvedValue("rejected");
    await expect(service.webhook(new Uint8Array(), "", "evt")).rejects.toThrow();
  });
});
