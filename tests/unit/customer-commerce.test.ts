import { describe, expect, it, vi } from "vitest";
import {
  parseAddress,
  parseCatalogue,
  parsePrivate,
  parseQuantity,
  parseReply,
} from "../../apps/workspaces/src/customer/commerce/contracts";
import {
  CommerceResource,
  type ResourceState,
} from "../../apps/workspaces/src/customer/commerce/resource";
import { commerceCatalogue, commerceOwner, commercePrivate } from "./customer-commerce.fixtures";

describe("customer commerce presentation contracts", () => {
  it("preserves authoritative totals rather than recomputing them", () => {
    expect(parsePrivate(commercePrivate, commerceOwner).cart.totalPaise).toBe(25000);
    expect(parseCatalogue(commerceCatalogue).products[0]?.variants[0]?.pricePaise).toBe(12000);
  });
  it("accepts empty collections and every pending/reconciliation state", () => {
    expect(parseCatalogue({ categories: [], concerns: [], products: [] }).products).toEqual([]);
    expect(
      parsePrivate(
        {
          ...commercePrivate,
          cart: { ...commercePrivate.cart, lines: [], totalPaise: 0 },
          addresses: [],
          orders: [],
          operation: "reconciliation_required",
        },
        commerceOwner,
      ).operation,
    ).toBe("reconciliation_required");
    expect(
      parsePrivate(
        {
          ...commercePrivate,
          orders: [{ ...commercePrivate.orders[0], payment: "reconciliation_required" }],
        },
        commerceOwner,
      ).orders[0]?.payment,
    ).toBe("reconciliation_required");
  });
  it.each(["anonymous", "denied", "unavailable", "error", "conflict"])(
    "retains %s without private payload",
    (status) => {
      expect(parseReply({ status }, parseCatalogue)).toEqual({ status });
      expect(() => parseReply({ status, data: commercePrivate }, parseCatalogue)).toThrow();
    },
  );
  it("rejects other owners, extra fields, invented payment status and invalid paise", () => {
    expect(() => parsePrivate(commercePrivate, "different-owner")).toThrow("Owner");
    expect(() => parsePrivate({ ...commercePrivate, admin: true }, commerceOwner)).toThrow();
    expect(() =>
      parsePrivate(
        { ...commercePrivate, cart: { ...commercePrivate.cart, totalPaise: 1.5 } },
        commerceOwner,
      ),
    ).toThrow();
    expect(() =>
      parsePrivate(
        { ...commercePrivate, orders: [{ ...commercePrivate.orders[0], payment: "success" }] },
        commerceOwner,
      ),
    ).toThrow();
    expect(() =>
      parsePrivate(
        {
          ...commercePrivate,
          cart: { ...commercePrivate.cart, totalPaise: Number.MAX_SAFE_INTEGER + 1 },
        },
        commerceOwner,
      ),
    ).toThrow();
  });
  it("rejects duplicates and broken taxonomy references", () => {
    expect(() =>
      parseCatalogue({
        ...commerceCatalogue,
        products: [...commerceCatalogue.products, ...commerceCatalogue.products],
      }),
    ).toThrow();
    expect(() => parseCatalogue({ ...commerceCatalogue, categories: [] })).toThrow();
    expect(() =>
      parsePrivate(
        {
          ...commercePrivate,
          addresses: [...commercePrivate.addresses, ...commercePrivate.addresses],
        },
        commerceOwner,
      ),
    ).toThrow();
    expect(() =>
      parsePrivate(
        {
          ...commercePrivate,
          cart: {
            ...commercePrivate.cart,
            lines: [...commercePrivate.cart.lines, ...commercePrivate.cart.lines],
          },
        },
        commerceOwner,
      ),
    ).toThrow();
  });
  it.each(["-1", "1.5", "1e2", "", " ", "1000", NaN, Infinity, null])(
    "rejects invalid quantity %s",
    (value) => {
      expect(() => parseQuantity(value)).toThrow();
    },
  );
  it("allows explicit removal without applying a stock rule", () => {
    expect(parseQuantity("0")).toBe(0);
    expect(parseQuantity("999")).toBe(999);
  });
  it("validates address shape and bounded ordinary fields, not serviceability", () => {
    const first = commercePrivate.addresses[0];
    if (!first) throw new Error("Missing synthetic fixture address");
    const { id: _id, serviceability: _serviceability, ...address } = first;
    expect(parseAddress(address)).toEqual(address);
    expect(() => parseAddress({ ...address, pincode: "000000" })).toThrow();
    expect(() => parseAddress({ ...address, phone: "not-phone" })).toThrow();
    expect(() => parseAddress({ ...address, recipient: " " })).toThrow();
    expect(() => parseAddress({ ...address, city: "x".repeat(101) })).toThrow();
    expect(() => parseAddress({ ...address, serviceability: "available" })).toThrow();
  });
});

describe("commerce request lifecycle", () => {
  it("prevents duplicate in-flight submission", async () => {
    const states: ResourceState<number>[] = [];
    const resource = new CommerceResource<number>((state) => states.push(state));
    let resolve!: (value: unknown) => void;
    const call = vi.fn(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const first = resource.run(call, Number);
    await resource.run(call, Number);
    expect(call).toHaveBeenCalledTimes(1);
    resolve({ status: "ready", data: 2 });
    await first;
    expect(states).toEqual([{ status: "loading" }, { status: "ready", data: 2 }]);
  });
  it("clears and aborts private requests, fencing late replies even when abort is ignored", async () => {
    const states: ResourceState<number>[] = [];
    const resource = new CommerceResource<number>((state) => states.push(state));
    let resolve!: (value: unknown) => void;
    let signal!: AbortSignal;
    const old = resource.run((received) => {
      signal = received;
      return new Promise((done) => {
        resolve = done;
      });
    }, Number);
    resource.clear();
    expect(signal.aborted).toBe(true);
    await resource.run(async () => ({ status: "denied" }), Number);
    resolve({ status: "ready", data: 999 });
    await old;
    expect(states.at(-1)).toEqual({ status: "denied" });
    expect(states.some((state) => state.status === "ready")).toBe(false);
  });
  it("turns malformed data/network errors into a redacted error and permits explicit read retry", async () => {
    const emit = vi.fn();
    const resource = new CommerceResource(emit);
    await resource.run(
      async () => ({ status: "ready", data: { ...commercePrivate, ownerId: "other" } }),
      (value) => parsePrivate(value, commerceOwner),
    );
    expect(emit).toHaveBeenLastCalledWith({ status: "error" });
    await resource.run(async () => {
      throw new Error("private provider detail");
    }, Number);
    expect(emit).toHaveBeenLastCalledWith({ status: "error" });
    await resource.run(
      async () => ({ status: "ready", data: commercePrivate }),
      (value) => parsePrivate(value, commerceOwner),
    );
    expect(emit).toHaveBeenLastCalledWith({ status: "ready", data: commercePrivate });
  });
  it("bounds hanging adapters and does not auto-retry a mutation", async () => {
    vi.useFakeTimers();
    try {
      const emit = vi.fn();
      const call = vi.fn(() => new Promise(() => {}));
      const resource = new CommerceResource(emit);
      const run = resource.run(call, Number);
      await vi.advanceTimersByTimeAsync(5000);
      await run;
      expect(emit).toHaveBeenLastCalledWith({ status: "error" });
      expect(call).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
