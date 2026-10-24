import { beforeEach, describe, expect, it, vi } from "vitest";
import { commercePaymentCheckoutSchema } from "../../packages/contracts/src/commerce-checkout";
import { type DatabaseContext, inTransaction } from "../../packages/database/src/client";
import { readCommerceCheckout } from "../../packages/database/src/commerce-checkout";
import { customerFixture, ids } from "./identity-fixtures";

const booking = vi.hoisted(() => ({ authorize: vi.fn(), target: vi.fn() }));
vi.mock("../../packages/database/src/booking.ts", () => ({
  BookingRuntimeError: class extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  },
  authorizeBookingInTransaction: booking.authorize,
  loadBookingPaymentTarget: booking.target,
}));
const dto = {
  keyId: "rzp_test_synthetic",
  providerOrderId: "order_synthetic",
  amountPaise: 12345,
  currency: "INR",
  intentId: ids.assignment,
  operationId: ids.other,
  subject: { kind: "order", id: ids.consultation },
};
function fixture(overrides: Record<string, unknown> = {}) {
  const row = {
    id: dto.intentId,
    operation_id: dto.operationId,
    subject_kind: "order",
    subject_id: dto.subject.id,
    owner_id: ids.actor,
    amount_paise: "12345",
    currency: "INR",
    account_id: "acc_synthetic",
    state: "ready",
    provider_order_id: dto.providerOrderId,
    authority_revision: 1,
    ...overrides,
  };
  const order = {
    actor_id: String(ids.actor),
    amount_paise: "12345",
    currency: "INR",
    version: 1,
    payable: true,
  };
  const query = vi.fn(async (sql: string) => ({
    rows: sql.includes("commerce_payment_intents")
      ? [row]
      : sql.includes("FROM core.commerce_orders")
        ? [order]
        : [],
    rowCount: 1,
    command: sql === "COMMIT" ? "COMMIT" : "SELECT",
  }));
  const context = { client: { query } } as unknown as DatabaseContext;
  const authorizeTransaction = vi.fn(async (active: DatabaseContext) => {
    expect(active).toBe(context);
    expect(inTransaction(active.client)).toBe(true);
  });
  const options = {
    actorId: ids.actor,
    identity: customerFixture().identity,
    accountId: "acc_synthetic",
    keyId: dto.keyId,
    authorizeTransaction,
    bookingAuthorityLoader: vi.fn(),
  };
  return {
    row,
    order,
    query,
    context,
    options,
    run: () => readCommerceCheckout(context, dto.intentId, options),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  booking.target.mockResolvedValue({
    ownerId: ids.actor,
    amountPaise: 12345,
    currency: "INR",
    revision: 2,
    paymentOrderId: dto.providerOrderId,
  });
});
describe("minimal checkout contract", () => {
  it("accepts exactly the frozen public launch DTO", () =>
    expect(commercePaymentCheckoutSchema.parse(dto)).toEqual(dto));
  it.each([
    { keyId: "rzp_live_synthetic" },
    { keyId: "rzp_test_" },
    { keyId: "secret" },
    { amountPaise: 0 },
    { amountPaise: Number.MAX_SAFE_INTEGER + 1 },
    { amountPaise: 1.5 },
    { currency: "USD" },
    { providerOrderId: "unbound_synthetic" },
    { ownerId: ids.actor },
    { accountId: "acc_synthetic" },
    { keySecret: "synthetic" },
    { paid: true },
  ])("rejects unsafe or extra launch data %j", (change) =>
    expect(commercePaymentCheckoutSchema.safeParse({ ...dto, ...change }).success).toBe(false),
  );
});
describe("checkout SQL boundary (transport spies, not RLS proof)", () => {
  it("returns only launch DTO, guards before reads, commits one transaction and performs no business writes", async () => {
    const f = fixture();
    expect(await f.run()).toEqual(dto);
    expect(f.options.authorizeTransaction.mock.invocationCallOrder[0]).toBeLessThan(
      f.query.mock.invocationCallOrder[4] ?? 0,
    );
    const sql = f.query.mock.calls.map(([sql]) => sql);
    expect(sql.filter((sql) => sql === "BEGIN")).toHaveLength(1);
    expect(sql.at(-1)).toBe("COMMIT");
    expect(sql.some((sql) => /^(INSERT|UPDATE|DELETE)/.test(sql))).toBe(false);
  });
  it.each(["pending", "creating", "unknown", "captured", "failed"])(
    "rejects non-READY %s",
    async (state) => {
      await expect(fixture({ state }).run()).rejects.toMatchObject({ code: "conflict" });
    },
  );
  it("rejects READY with null binding", async () =>
    await expect(fixture({ provider_order_id: null }).run()).rejects.toMatchObject({
      code: "conflict",
    }));
  it("denies foreign owner", async () =>
    await expect(fixture({ owner_id: ids.patientActor }).run()).rejects.toMatchObject({
      code: "denied",
    }));
  it("rejects different provider account", async () =>
    await expect(fixture({ account_id: "acc_other" }).run()).rejects.toMatchObject({
      code: "unconfigured",
    }));
  it.each(["amount", "expired", "owner"])("revalidates current order %s", async (change) => {
    const f = fixture();
    if (change === "amount") f.order.amount_paise = "12346";
    if (change === "expired") f.order.payable = false;
    if (change === "owner") f.order.actor_id = ids.patientActor;
    await expect(f.run()).rejects.toMatchObject({
      code: change === "owner" ? "denied" : "conflict",
    });
  });
  it("a revoked request guard prevents all payment reads and rolls back", async () => {
    const f = fixture();
    f.options.authorizeTransaction.mockRejectedValue(new Error("revoked"));
    await expect(f.run()).rejects.toThrow("revoked");
    expect(f.query.mock.calls.some(([sql]) => sql.includes("commerce_payment_intents"))).toBe(
      false,
    );
    expect(f.query).toHaveBeenLastCalledWith("ROLLBACK");
  });
  it("booking uses current canonical grant/fee/binding, not old pre-bind revision equality", async () => {
    const f = fixture({ subject_kind: "booking" });
    expect(await f.run()).toEqual({ ...dto, subject: { ...dto.subject, kind: "booking" } });
    expect(booking.authorize).toHaveBeenCalledWith(
      f.context,
      f.options.identity,
      "booking:create",
      f.options.bookingAuthorityLoader,
    );
    expect(booking.authorize.mock.invocationCallOrder[0]).toBeLessThan(
      booking.target.mock.invocationCallOrder[0] ?? 0,
    );
  });
  it("missing canonical booking loader fails closed", async () => {
    const f = fixture({ subject_kind: "booking" });
    await expect(
      readCommerceCheckout(f.context, dto.intentId, {
        ...f.options,
        bookingAuthorityLoader: undefined,
      }),
    ).rejects.toMatchObject({ code: "unconfigured" });
    expect(booking.authorize).not.toHaveBeenCalled();
  });
  it.each([null, "order_other", "unbound_synthetic"])(
    "rejects booking binding %s",
    async (paymentOrderId) => {
      booking.target.mockResolvedValue({
        ownerId: ids.actor,
        amountPaise: 12345,
        currency: "INR",
        paymentOrderId,
      });
      await expect(fixture({ subject_kind: "booking" }).run()).rejects.toMatchObject({
        code: "conflict",
      });
    },
  );
  it("revoked booking grant denies before fee/binding read", async () => {
    booking.authorize.mockRejectedValueOnce(new Error("revoked grant"));
    await expect(fixture({ subject_kind: "booking" }).run()).rejects.toThrow("revoked grant");
    expect(booking.target).not.toHaveBeenCalled();
  });
});
