import { afterEach, describe, expect, it, vi } from "vitest";
import { nativeCustomerSession } from "../fixtures/native-customer";
import {
  address,
  locationId,
  operationId,
  payment,
  paymentOperationId,
  quote,
  setup,
  skuId,
} from "./native-commerce-forms.fixtures";

afterEach(() => vi.useRealTimers());
describe("native commerce forms controller", () => {
  it("requires directory selection, valid canonical address, SKU and explicit post-quote confirmation", async () => {
    const { controller: c, api, fill } = setup();
    await c.confirmCheckout();
    await c.requestQuote();
    expect(api.quote).not.toHaveBeenCalled();
    expect(api.checkout).not.toHaveBeenCalled();
    expect(c.getSnapshot().status).toBe("invalid");
    await fill();
    await c.requestQuote();
    expect(api.quote).toHaveBeenCalledWith(
      { locationId, lines: [{ skuId, quantity: 1 }] },
      expect.any(AbortSignal),
    );
    expect(api.checkout).not.toHaveBeenCalled();
    await c.confirmCheckout();
    expect(api.checkout).toHaveBeenCalledWith(
      {
        locationId,
        lines: [{ skuId, quantity: 1 }],
        deliveryAddress: address,
        operationId,
        confirmed: true,
        quoteKey: quote.quoteKey,
        versions: { [skuId]: 1 },
      },
      expect.any(AbortSignal),
    );
    expect(c.getSnapshot().reservation?.amountPaise).toBe(15751);
  });
  it.each(["postalCode", "contactPhone", "region", "recipientName", "line1", "city"] as const)(
    "rejects invalid %s using the shared address schema",
    async (field) => {
      const { controller: c, api, fill } = setup();
      await fill();
      c.setAddress(field, "");
      await c.requestQuote();
      expect(c.getSnapshot().status).toBe("invalid");
      expect(api.quote).not.toHaveBeenCalled();
    },
  );
  it("does not accept arbitrary location/SKU IDs or out-of-schema quantities", async () => {
    const { controller: c, fill } = setup();
    await fill();
    c.selectLocation("not-in-directory");
    c.setQuantity(locationId, 2);
    c.setQuantity(skuId, 1001);
    c.setQuantity(skuId, 1.1);
    expect(c.getSnapshot().locationId).toBe(locationId);
    expect(c.getSnapshot().lines).toEqual([{ skuId, quantity: 1 }]);
  });
  it("supports quantity changes/removal and invalidates quote on each edit", async () => {
    const { controller: c, fill } = setup();
    await fill();
    await c.requestQuote();
    c.setQuantity(skuId, 2);
    expect(c.getSnapshot().quote).toBeNull();
    await c.requestQuote();
    c.setAddress("line2", "Edited");
    expect(c.getSnapshot().quote).toBeNull();
    c.setQuantity(skuId, 0);
    expect(c.getSnapshot().lines).toEqual([]);
  });
  it("clears previous quote before a failed refresh so it cannot confirm stale data", async () => {
    const { controller: c, api, fill } = setup();
    await fill();
    await c.requestQuote();
    api.quote.mockResolvedValueOnce({ status: "conflict" });
    await c.requestQuote();
    await c.confirmCheckout();
    expect(c.getSnapshot().quote).toBeNull();
    expect(api.checkout).not.toHaveBeenCalled();
  });
  it("serializes double confirmation and keeps the exact checkout ID/body after a lost response", async () => {
    const { controller: c, api, uuid, fill } = setup();
    await fill();
    await c.requestQuote();
    api.checkout.mockRejectedValueOnce(new Error("lost reply"));
    await Promise.all([c.confirmCheckout(), c.confirmCheckout()]);
    expect(api.checkout).toHaveBeenCalledTimes(1);
    expect(c.getSnapshot().recovery).toBe("checkout");
    c.setAddress("city", "Changed");
    c.setQuantity(skuId, 3);
    await c.requestQuote();
    expect(c.getSnapshot().address.city).toBe(address.city);
    await c.confirmCheckout();
    expect(api.checkout.mock.calls[1]?.[0]).toEqual(api.checkout.mock.calls[0]?.[0]);
    expect(uuid).toHaveBeenCalledTimes(1);
  });
  it("keeps same payment operation after uncertain creation, then only reads/reconciles the existing intent", async () => {
    const { controller: c, api, uuid, fill } = setup();
    await fill();
    await c.requestQuote();
    await c.confirmCheckout();
    api.createPayment.mockRejectedValueOnce(new Error("unknown"));
    await Promise.all([c.createPayment(), c.createPayment()]);
    expect(c.getSnapshot().recovery).toBe("payment");
    await c.createPayment();
    expect(api.createPayment.mock.calls[0]?.[1]).toEqual(api.createPayment.mock.calls[1]?.[1]);
    expect(api.createPayment.mock.calls[1]?.[1]).toMatchObject({ operationId: paymentOperationId });
    await c.createPayment();
    await c.refreshPayment();
    await c.refreshPayment(true);
    expect(api.createPayment).toHaveBeenCalledTimes(2);
    expect(api.readPayment).toHaveBeenCalledWith(payment, expect.any(AbortSignal));
    expect(api.reconcilePayment).toHaveBeenCalledWith(payment, expect.any(AbortSignal));
    expect(uuid).toHaveBeenCalledTimes(2);
    expect(c.getSnapshot().payment?.state).toBe("unknown");
  });
  it.each(["anonymous", "denied"] as const)(
    "clears all private state and permanently fences on %s",
    async (status) => {
      const { controller: c, api, revoked, fill } = setup();
      await fill();
      api.quote.mockResolvedValueOnce({ status });
      await c.requestQuote();
      expect(c.getSnapshot()).toMatchObject({
        status,
        catalogue: null,
        lines: [],
        address: { recipientName: "" },
      });
      await c.loadCatalogue();
      expect(api.catalogue).toHaveBeenCalledTimes(1);
      expect(revoked).toHaveBeenCalledOnce();
    },
  );
  it.each(["logout", "expire", "deactivate"] as const)(
    "fences late completion following %s",
    async (action) => {
      const fixture = setup();
      const { controller: c, api, fill } = fixture;
      await fill();
      let finish = () => {};
      api.quote.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = () => resolve({ status: "ready", data: quote });
          }),
      );
      const request = c.requestQuote();
      fixture[action]();
      finish();
      await request;
      expect(c.getSnapshot()).toMatchObject({ status: "anonymous", quote: null, lines: [] });
    },
  );
  it("background aborts, hides private data, rejects late success and resumes SAME checkout identity", async () => {
    const { controller: c, api, fill } = setup();
    await fill();
    await c.requestQuote();
    let finish = () => {};
    api.checkout.mockImplementationOnce(
      (_command, signal) =>
        new Promise((resolve) => {
          finish = () => {
            expect(signal.aborted).toBe(true);
            resolve({ status: "error" });
          };
        }),
    );
    const request = c.confirmCheckout();
    c.setForeground(false);
    expect(c.getSnapshot()).toMatchObject({
      status: "anonymous",
      quote: null,
      address: { recipientName: "" },
    });
    finish();
    await request;
    c.setForeground(true);
    expect(c.getSnapshot().recovery).toBe("checkout");
    await c.confirmCheckout();
    expect(api.checkout.mock.calls[1]?.[0]).toEqual(api.checkout.mock.calls[0]?.[0]);
  });
  it("bounds hung requests and ignores late responses even if transport disregards abort", async () => {
    vi.useFakeTimers();
    const { controller: c, api, fill } = setup();
    await fill();
    let finish = () => {};
    api.quote.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ status: "ready", data: quote });
        }),
    );
    const request = c.requestQuote();
    await vi.advanceTimersByTimeAsync(15000);
    expect(c.getSnapshot().status).toBe("error");
    finish();
    await request;
    expect(c.getSnapshot().quote).toBeNull();
  });
  it("rejects a broken UUID dependency without issuing a mutation", async () => {
    const { controller: c, api, uuid, fill } = setup();
    await fill();
    await c.requestQuote();
    uuid.mockReset().mockReturnValue("broken");
    await c.confirmCheckout();
    expect(c.getSnapshot().status).toBe("invalid");
    expect(api.checkout).not.toHaveBeenCalled();
  });
  it("carries no ordinary unconfirmed draft or address across unmount", async () => {
    const { controller: c, fill } = setup();
    await fill();
    await c.requestQuote();
    expect(c.snapshotRecovery()).toBeNull();
  });
  it("restores immutable same-session exact uncertain checkout across actual controller disposal/remount", async () => {
    const first = setup();
    await first.fill();
    await first.controller.requestQuote();
    first.api.checkout.mockResolvedValueOnce({ status: "error" });
    await first.controller.confirmCheckout();
    first.controller.setForeground(false);
    const recovery = first.controller.snapshotRecovery();
    if (!recovery) throw Error("Missing test recovery");
    expect(Object.isFrozen(recovery)).toBe(true);
    expect(Object.isFrozen(recovery.checkout.deliveryAddress)).toBe(true);
    first.controller.dispose();
    const second = setup(recovery);
    expect(second.controller.getSnapshot()).toMatchObject({ restored: true, recovery: "checkout" });
    await second.controller.loadCatalogue();
    expect(second.controller.getSnapshot().recovery).toBe("checkout");
    second.controller.setAddress("city", "Must not change");
    await second.controller.confirmCheckout();
    expect(second.api.checkout.mock.calls[0]?.[0]).toEqual(first.api.checkout.mock.calls[0]?.[0]);
    expect(second.uuid).not.toHaveBeenCalled();
    expect(second.controller.getSnapshot().restored).toBe(false);
  });
  it("restores uncertain payment initiation across remount without a second operation identity", async () => {
    const first = setup();
    await first.fill();
    await first.controller.requestQuote();
    await first.controller.confirmCheckout();
    first.api.createPayment.mockResolvedValueOnce({ status: "error" });
    await first.controller.createPayment();
    const recovery = first.controller.snapshotRecovery();
    if (!recovery) throw Error("Missing test recovery");
    first.controller.dispose();
    const second = setup(recovery);
    await second.controller.createPayment();
    expect(second.api.createPayment.mock.calls[0]?.[1]).toEqual(
      first.api.createPayment.mock.calls[0]?.[1],
    );
    expect(second.uuid).not.toHaveBeenCalled();
  });
  it("restored known intent is only read/reconciled, never newly created or declared current captured", async () => {
    const first = setup();
    await first.fill();
    await first.controller.requestQuote();
    await first.controller.confirmCheckout();
    await first.controller.createPayment();
    const recovery = first.controller.snapshotRecovery();
    if (!recovery) throw Error("Missing test recovery");
    first.controller.dispose();
    const second = setup(recovery);
    expect(second.controller.getSnapshot().restored).toBe(true);
    await second.controller.createPayment();
    await second.controller.refreshPayment(true);
    expect(second.api.createPayment).not.toHaveBeenCalled();
    expect(second.api.reconcilePayment).toHaveBeenCalledWith(payment, expect.any(AbortSignal));
    expect(second.controller.getSnapshot().restored).toBe(false);
  });
  it.each(["owner", "expiry", "scope", "fabricated", "expired"] as const)(
    "rejects recovery after %s change",
    async (change) => {
      const first = setup();
      await first.fill();
      await first.controller.requestQuote();
      await first.controller.confirmCheckout();
      const recovery = first.controller.snapshotRecovery();
      if (!recovery) throw Error("Missing test recovery");
      first.controller.dispose();
      if (change === "expired") {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2100-01-01"));
      }
      const session = {
        ...nativeCustomerSession,
        ...(change === "owner" ? { userId: locationId } : {}),
        ...(change === "expiry" ? { expiresAt: "2098-01-01T00:00:00Z" } : {}),
        ...(change === "scope" ? { workspaces: [] } : {}),
      };
      const second = setup(change === "fabricated" ? { ...recovery } : recovery, session);
      expect(second.controller.getSnapshot()).toMatchObject({
        status: "anonymous",
        restored: false,
        reservation: null,
        lines: [],
      });
      await second.controller.createPayment();
      expect(second.api.createPayment).not.toHaveBeenCalled();
    },
  );
  it("clears saved background recovery immediately on observed logout", async () => {
    const fixture = setup();
    await fixture.fill();
    await fixture.controller.requestQuote();
    await fixture.controller.confirmCheckout();
    fixture.controller.setForeground(false);
    fixture.logout();
    fixture.controller.checkAuthority();
    expect(fixture.controller.snapshotRecovery()).toBeNull();
    fixture.controller.setForeground(true);
    expect(fixture.controller.getSnapshot().address.recipientName).toBe("");
  });
});
