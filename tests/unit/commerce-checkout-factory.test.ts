import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeCommerceRequest } from "../../apps/core-api/src/commerce-authorization";
import {
  type CommerceCheckoutOptions,
  createCommerceCheckoutDependencies,
} from "../../apps/core-api/src/commerce-checkout";
import { type DatabaseContext, inTransaction } from "../../packages/database/src/client";
import { customerFixture, ids, now } from "./identity-fixtures";

const mocks = vi.hoisted(() => ({ database: vi.fn(), revalidate: vi.fn() }));
vi.mock("../../packages/database/src/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../packages/database/src/client")>()),
  withDatabase: mocks.database,
}));
vi.mock("../../apps/core-api/src/commerce-identity", () => ({
  revalidateCommerceTransaction: mocks.revalidate,
}));

function fixture() {
  const customer = customerFixture();
  const identity = {
    verifySession: vi.fn(async () => ({
      status: "verified" as const,
      identity: customer.identity,
    })),
    loadCurrentAuthority: vi.fn(async () => customer.authority),
    loadCommerceGrants: vi.fn(async () => []),
    now: () => now,
  };
  const provider = {
    accountId: "acc_synthetic",
    createOrder: vi.fn(),
    reconcileOrder: vi.fn(),
    reconcileCapture: vi.fn(),
    verifyWebhook: vi.fn(),
  };
  const query = vi.fn(async (sql: string) => ({
    command: sql === "COMMIT" ? "COMMIT" : "SELECT",
    rowCount: 1,
    rows: sql.includes("commerce_payment_intents")
      ? [
          {
            id: ids.assignment,
            operation_id: ids.other,
            subject_kind: "order",
            subject_id: ids.consultation,
            owner_id: ids.actor,
            amount_paise: "12345",
            currency: "INR",
            account_id: provider.accountId,
            state: "ready",
            provider_order_id: "order_synthetic",
          },
        ]
      : sql.includes("FROM core.commerce_orders")
        ? [
            {
              actor_id: ids.actor,
              amount_paise: "12345",
              currency: "INR",
              version: 1,
              payable: true,
            },
          ]
        : [],
  }));
  const context = { client: { query } } as unknown as DatabaseContext;
  mocks.database.mockImplementation(async (_url, _environment, _role, work) => work(context));
  const guard = vi.fn(async (active: DatabaseContext) =>
    expect(inTransaction(active.client)).toBe(true),
  );
  const options: CommerceCheckoutOptions = {
    environment: "local",
    coreDatabaseUrl: "trusted-core-url",
    localProxy: "127.0.0.1:12345",
    resourceNamespace: "trusted-namespace",
    identity,
    paymentProvider: provider,
    keyId: "rzp_test_synthetic",
    guardInTransaction: guard,
  };
  return {
    options,
    provider,
    query,
    guard,
    context,
    async run(overrides: Partial<CommerceCheckoutOptions> = {}) {
      const dependencies = createCommerceCheckoutDependencies({ ...options, ...overrides });
      const principal = await authorizeCommerceRequest(
        new Request("https://example.invalid"),
        dependencies,
        { kind: "customer" },
      );
      if (!principal.allowed) throw new Error("invalid synthetic authority");
      return dependencies.checkout(principal, ids.assignment);
    },
  };
}
beforeEach(() => {
  vi.resetAllMocks();
});
describe("checkout trusted factory", () => {
  it("passes actual root transport and orders guard before revalidation before read, never provider network", async () => {
    const f = fixture();
    const network = vi.spyOn(globalThis, "fetch");
    try {
      expect(await f.run()).toMatchObject({
        keyId: "rzp_test_synthetic",
        providerOrderId: "order_synthetic",
        amountPaise: 12345,
      });
      expect(mocks.database).toHaveBeenCalledWith(
        "trusted-core-url",
        "local",
        "k_core_runtime",
        expect.any(Function),
        "127.0.0.1:12345",
        "trusted-namespace",
      );
      expect(f.guard.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.revalidate.mock.invocationCallOrder[0] ?? 0,
      );
      const readIndex = f.query.mock.calls.findIndex(([sql]) =>
        sql.includes("commerce_payment_intents"),
      );
      expect(mocks.revalidate.mock.invocationCallOrder[0]).toBeLessThan(
        f.query.mock.invocationCallOrder[readIndex] ?? 0,
      );
      for (const method of [
        f.provider.createOrder,
        f.provider.reconcileOrder,
        f.provider.reconcileCapture,
        f.provider.verifyWebhook,
      ])
        expect(method).not.toHaveBeenCalled();
      expect(network).not.toHaveBeenCalled();
    } finally {
      network.mockRestore();
    }
  });
  it.each([undefined, "", "rzp_live_synthetic", "rzp_test_", "public", "rzp_test_has whitespace"])(
    "invalid/missing key %s does not open DB or call providers",
    async (keyId) => {
      const f = fixture();
      const options = { ...f.options };
      if (keyId === undefined) delete options.keyId;
      else options.keyId = keyId;
      const { keyId: _ignored, ...withoutKey } = options;
      const dependencies = createCommerceCheckoutDependencies(
        keyId === undefined ? withoutKey : options,
      );
      const principal = await authorizeCommerceRequest(
        new Request("https://example.invalid"),
        dependencies,
        { kind: "customer" },
      );
      if (!principal.allowed) throw new Error("invalid fixture");
      await expect(dependencies.checkout(principal, ids.assignment)).rejects.toMatchObject({
        code: "unconfigured",
      });
      expect(mocks.database).not.toHaveBeenCalled();
      expect(f.provider.createOrder).not.toHaveBeenCalled();
    },
  );
  it("test key alone without approved actual provider stays unavailable", async () => {
    const f = fixture();
    const options = { ...f.options };
    delete options.paymentProvider;
    const dependencies = createCommerceCheckoutDependencies(options);
    const principal = await authorizeCommerceRequest(
      new Request("https://example.invalid"),
      dependencies,
      { kind: "customer" },
    );
    if (!principal.allowed) throw new Error("invalid fixture");
    await expect(dependencies.checkout(principal, ids.assignment)).rejects.toMatchObject({
      code: "unconfigured",
    });
    expect(mocks.database).not.toHaveBeenCalled();
  });
  it.each(["", "acc_", "other_account", "acc_synthetic injected"])(
    "invalid actual provider account %s cannot open DB",
    async (accountId) => {
      const f = fixture();
      f.provider.accountId = accountId;
      await expect(f.run()).rejects.toMatchObject({ code: "unconfigured" });
      expect(mocks.database).not.toHaveBeenCalled();
      expect(f.provider.createOrder).not.toHaveBeenCalled();
    },
  );
  it("current request fence denial precedes revalidation/payment read and rolls back", async () => {
    const f = fixture();
    f.guard.mockRejectedValue(new Error("revoked cookie"));
    await expect(f.run()).rejects.toThrow("revoked cookie");
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(f.query.mock.calls.some(([sql]) => sql.includes("commerce_payment_intents"))).toBe(
      false,
    );
    expect(f.query).toHaveBeenLastCalledWith("ROLLBACK");
  });
});
