import { afterEach, describe, expect, it, vi } from "vitest";
import { NativeCommerceController } from "../../apps/mobile/src/customer/commerceController";
import {
  createNativeCommerceHardware,
  type NativeCommerceHardwareApi,
  type NativeCommerceHardwareOptions,
} from "../../apps/mobile/src/customer/commerceHardware";
import type { CommercePaymentCheckout } from "../../packages/contracts/src/commerce-checkout";
import type { CommercePaymentView } from "../../packages/contracts/src/commerce-http";
import { nativeCustomerSession } from "../fixtures/native-customer";
import {
  address,
  locationId,
  locations,
  operationId,
  payment,
  paymentOperationId,
  setup,
  skuId,
} from "./native-commerce-forms.fixtures";

const ready: CommercePaymentView = {
  ...payment,
  state: "ready",
  providerOrderId: "order_synthetic123",
};
const metadata: CommercePaymentCheckout = {
  keyId: "rzp_test_synthetic123",
  providerOrderId: "order_synthetic123",
  intentId: ready.intentId,
  operationId: ready.operationId,
  subject: ready.subject,
  amountPaise: ready.amountPaise,
  currency: "INR",
};
function hardwareFixture() {
  let active = true;
  const api = {
    checkoutMetadata: vi.fn<NativeCommerceHardwareApi["checkoutMetadata"]>(async () => ({
      status: "ready",
      data: metadata,
    })),
    readPayment: vi.fn<NativeCommerceHardwareApi["readPayment"]>(async () => ({
      status: "ready",
      data: { ...ready, state: "unknown" },
    })),
    reconcilePayment: vi.fn<NativeCommerceHardwareApi["reconcilePayment"]>(async () => ({
      status: "ready",
      data: { ...ready, state: "unknown" },
    })),
  };
  const open = vi.fn<NativeCommerceHardwareOptions["open"]>(async () => ({
    state: "captured",
    razorpay_payment_id: "untrusted_callback",
  }));
  const hardware = createNativeCommerceHardware({ api, open });
  const abort = new AbortController();
  const stage = vi.fn();
  return {
    api,
    open,
    hardware,
    abort,
    stage,
    current: () => active,
    deactivate: () => {
      active = false;
    },
    launch: () => hardware.launch(ready, abort.signal, () => active, stage),
  };
}
afterEach(() => vi.useRealTimers());
describe("native hardware canonical checkout bridge", () => {
  it("maps only canonical SDK fields and never trusts a successful callback as captured", async () => {
    const f = hardwareFixture();
    expect(await f.launch()).toMatchObject({
      status: "ready",
      data: { state: "unknown", intentId: ready.intentId },
    });
    expect(f.open).toHaveBeenCalledWith(
      {
        key: metadata.keyId,
        order_id: metadata.providerOrderId,
        amount: metadata.amountPaise,
        currency: "INR",
      },
      expect.any(Function),
    );
    expect(f.api.readPayment).toHaveBeenCalledWith(ready, expect.any(AbortSignal));
    expect(f.api.reconcilePayment).toHaveBeenCalledWith(ready, expect.any(AbortSignal));
    expect(f.stage.mock.calls.map(([value]) => value)).toEqual([
      "metadata",
      "opening",
      "reconciling",
    ]);
  });
  it.each(["cancel", "error", "unknown"])(
    "reads/reconciles the same intent after SDK %s",
    async () => {
      const f = hardwareFixture();
      f.open.mockRejectedValueOnce(new Error("Synthetic SDK outcome"));
      expect(await f.launch()).toMatchObject({ status: "ready", data: { state: "unknown" } });
      expect(f.api.reconcilePayment).toHaveBeenCalledWith(ready, expect.any(AbortSignal));
    },
  );
  it.each([
    "intentId",
    "operationId",
    "subject.kind",
    "subject.id",
    "providerOrderId",
    "amountPaise",
    "currency",
    "keyId",
  ])("denies changed or invalid metadata %s before SDK", async (field) => {
    const f = hardwareFixture();
    const altered = { ...metadata, subject: { ...metadata.subject } };
    if (field === "intentId") altered.intentId = locationId;
    if (field === "operationId") altered.operationId = operationId;
    if (field === "subject.kind") altered.subject.kind = "booking";
    if (field === "subject.id") altered.subject.id = locationId;
    if (field === "providerOrderId") altered.providerOrderId = "order_foreign123";
    if (field === "amountPaise") altered.amountPaise++;
    if (field === "currency") Object.assign(altered, { currency: "USD" });
    if (field === "keyId") altered.keyId = "rzp_live_notapproved";
    f.api.checkoutMetadata.mockResolvedValueOnce({ status: "ready", data: altered });
    expect(await f.launch()).toEqual({ status: "error" });
    expect(f.open).not.toHaveBeenCalled();
  });
  it.each(["anonymous", "denied", "conflict", "unavailable", "error"] as const)(
    "preserves metadata %s without launching SDK",
    async (status) => {
      const f = hardwareFixture();
      f.api.checkoutMetadata.mockResolvedValueOnce({ status });
      expect(await f.launch()).toEqual({ status });
      expect(f.open).not.toHaveBeenCalled();
    },
  );
  it.each(["unknown", "captured", "failed", "creating", "pending"] as const)(
    "never opens a %s payment",
    async (state) => {
      const f = hardwareFixture();
      expect(
        await f.hardware.launch({ ...ready, state }, f.abort.signal, f.current, f.stage),
      ).toEqual({ status: "conflict" });
      expect(f.api.checkoutMetadata).not.toHaveBeenCalled();
    },
  );
  it("serializes SDK launches while pending", async () => {
    const f = hardwareFixture();
    let settle = () => {};
    f.open.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = () => resolve(undefined);
        }),
    );
    const first = f.launch();
    await vi.waitFor(() => expect(f.open).toHaveBeenCalledOnce());
    expect(await f.launch()).toEqual({ status: "conflict" });
    settle();
    await first;
    expect(f.open).toHaveBeenCalledOnce();
  });
  it("does not launch on a late metadata reply after authority loss", async () => {
    const f = hardwareFixture();
    f.api.checkoutMetadata.mockImplementationOnce(async () => {
      f.deactivate();
      return { status: "ready", data: metadata };
    });
    expect(await f.launch()).toEqual({ status: "error" });
    expect(f.open).not.toHaveBeenCalled();
  });
  it("aborts/fences late SDK callbacks and never reads after background/logout", async () => {
    const f = hardwareFixture();
    let settle = () => {};
    f.open.mockImplementationOnce(
      (_input, current) =>
        new Promise((resolve) => {
          settle = () => {
            expect(current()).toBe(false);
            resolve({ state: "captured" });
          };
        }),
    );
    const result = f.launch();
    await vi.waitFor(() => expect(f.open).toHaveBeenCalledOnce());
    f.abort.abort();
    expect(await result).toEqual({ status: "error" });
    settle();
    expect(f.api.readPayment).not.toHaveBeenCalled();
    expect(f.api.reconcilePayment).not.toHaveBeenCalled();
  });
  it("times out stalled metadata and does not later open", async () => {
    vi.useFakeTimers();
    const f = hardwareFixture();
    let settle = () => {};
    f.api.checkoutMetadata.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = () => resolve({ status: "ready", data: metadata });
        }),
    );
    const result = f.launch();
    await vi.advanceTimersByTimeAsync(15000);
    expect(await result).toEqual({ status: "error" });
    settle();
    expect(f.open).not.toHaveBeenCalled();
  });
  it("allows the existing five-minute SDK window, then only reconciles original identity", async () => {
    vi.useFakeTimers();
    const f = hardwareFixture();
    f.open.mockImplementationOnce(() => new Promise(() => {}));
    const result = f.launch();
    await vi.advanceTimersByTimeAsync(15000);
    expect(f.api.readPayment).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(await result).toMatchObject({ status: "ready", data: { state: "unknown" } });
    expect(f.open).toHaveBeenCalledOnce();
    expect(f.api.reconcilePayment).toHaveBeenCalledWith(ready, expect.any(AbortSignal));
  });
  it("rejects changed payment binding from subsequent GET", async () => {
    const f = hardwareFixture();
    f.api.readPayment.mockResolvedValueOnce({
      status: "ready",
      data: { ...ready, amountPaise: ready.amountPaise + 1 },
    });
    expect(await f.launch()).toEqual({ status: "error" });
    expect(f.api.reconcilePayment).not.toHaveBeenCalled();
  });
  it("rejects changed payment binding from subsequent reconciliation", async () => {
    const f = hardwareFixture();
    f.api.reconcilePayment.mockResolvedValueOnce({
      status: "ready",
      data: { ...ready, providerOrderId: "order_foreign123" },
    });
    expect(await f.launch()).toEqual({ status: "error" });
  });
  it("accepts captured only from current server state, not from the SDK", async () => {
    const f = hardwareFixture();
    f.open.mockRejectedValueOnce(Error("cancelled"));
    f.api.readPayment.mockResolvedValueOnce({
      status: "ready",
      data: { ...ready, state: "captured" },
    });
    expect(await f.launch()).toMatchObject({ status: "ready", data: { state: "captured" } });
    expect(f.api.reconcilePayment).not.toHaveBeenCalled();
  });
});

async function controllerFixture() {
  const basic = setup();
  const f = hardwareFixture();
  basic.api.createPayment.mockResolvedValue({ status: "ready", data: ready });
  const uuid = vi.fn().mockReturnValueOnce(operationId).mockReturnValue(paymentOperationId);
  const controller = new NativeCommerceController({
    api: basic.api,
    locations,
    session: () => nativeCustomerSession,
    active: f.current,
    uuid,
    hardware: f.hardware,
  });
  await controller.loadCatalogue();
  controller.selectLocation(locationId);
  controller.setQuantity(skuId, 1);
  for (const [key, value] of Object.entries(address))
    controller.setAddress(key as keyof typeof address, value);
  await controller.requestQuote();
  await controller.confirmCheckout();
  await controller.createPayment();
  return { ...f, basic, uuid, controller };
}
describe("controller explicit hardware action", () => {
  it("clears private state on metadata authorization failure rather than opening hardware", async () => {
    const f = await controllerFixture();
    f.api.checkoutMetadata.mockResolvedValueOnce({ status: "denied" });
    await f.controller.openPayment();
    expect(f.controller.getSnapshot()).toMatchObject({
      status: "denied",
      payment: null,
      hardware: "idle",
      lines: [],
    });
    expect(f.controller.snapshotRecovery()).toBeNull();
    expect(f.open).not.toHaveBeenCalled();
  });
  it("leaves hardware unavailable when no existing native SDK port is supplied", async () => {
    const basic = setup();
    await basic.controller.openPayment();
    expect(basic.controller.getSnapshot().status).toBe("unavailable");
    expect(basic.api.createPayment).not.toHaveBeenCalled();
  });
  it("does not open automatically after payment initiation, then keeps unknown intent after explicit SDK action", async () => {
    const f = await controllerFixture();
    expect(f.open).not.toHaveBeenCalled();
    await f.controller.openPayment();
    expect(f.controller.getSnapshot()).toMatchObject({
      hardware: "awaiting_server",
      payment: { state: "unknown", intentId: ready.intentId },
    });
    await f.controller.openPayment();
    expect(f.open).toHaveBeenCalledOnce();
    expect(f.basic.api.createPayment).toHaveBeenCalledOnce();
  });
  it("does not use the ordinary 15-second controller HTTP timer during SDK presentation", async () => {
    vi.useFakeTimers();
    const f = await controllerFixture();
    let settle = () => {};
    f.open.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = () => resolve(undefined);
        }),
    );
    const result = f.controller.openPayment();
    await vi.advanceTimersByTimeAsync(15000);
    expect(f.controller.getSnapshot()).toMatchObject({ status: "loading", hardware: "opening" });
    await f.controller.openPayment();
    expect(f.open).toHaveBeenCalledOnce();
    settle();
    await result;
  });
  it("requires a fresh authoritative read before reopening after an unverified SDK outcome", async () => {
    const f = await controllerFixture();
    f.api.readPayment.mockResolvedValueOnce({ status: "error" });
    await f.controller.openPayment();
    expect(f.controller.getSnapshot()).toMatchObject({
      hardware: "awaiting_server",
      restored: true,
      payment: { state: "ready" },
    });
    await f.controller.openPayment();
    expect(f.open).toHaveBeenCalledOnce();
    expect(f.basic.api.createPayment).toHaveBeenCalledOnce();
  });
  it("retains original intent across background remount; restored intent requires fresh server read before opening", async () => {
    const f = await controllerFixture();
    let settle = () => {};
    f.open.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = () => resolve({ state: "captured" });
        }),
    );
    const result = f.controller.openPayment();
    await vi.waitFor(() => expect(f.open).toHaveBeenCalledOnce());
    const recovery = f.controller.snapshotRecovery();
    if (!recovery) throw Error("Missing synthetic recovery");
    f.controller.dispose();
    await result;
    settle();
    const next = new NativeCommerceController({
      api: f.basic.api,
      locations,
      session: () => nativeCustomerSession,
      active: () => true,
      uuid: f.uuid,
      hardware: f.hardware,
      recovery,
    });
    await next.openPayment();
    expect(f.open).toHaveBeenCalledOnce();
    await next.refreshPayment();
    expect(f.basic.api.readPayment).toHaveBeenCalledWith(ready, expect.any(AbortSignal));
    expect(f.basic.api.createPayment).toHaveBeenCalledOnce();
    expect(f.uuid).toHaveBeenCalledTimes(2);
  });
});
