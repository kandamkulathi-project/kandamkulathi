import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PaymentIntent,
  VerifiedPaymentEvent,
} from "../../packages/contracts/src/commerce-payments";
import type { DatabaseContext } from "../../packages/database/src/client";
import { createCommerceBookingPaymentHandlers } from "../../packages/database/src/commerce-payment-bookings";
import { after, ids, physicianIdentity } from "./identity-fixtures";

const booking = vi.hoisted(() => ({
  authorize: vi.fn(),
  target: vi.fn(),
  bind: vi.fn(),
  apply: vi.fn(),
}));
vi.mock("../../packages/database/src/booking.ts", () => ({
  BookingRuntimeError: class extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  },
  authorizeBookingInTransaction: booking.authorize,
  loadBookingPaymentTarget: booking.target,
  bindBookingPaymentOrder: booking.bind,
  applyVerifiedBookingPayment: booking.apply,
}));
const context = {} as DatabaseContext;
const intent: PaymentIntent = {
  id: ids.assignment,
  operationId: ids.other,
  subject: { kind: "booking", id: ids.consultation },
  ownerId: ids.actor,
  amountPaise: 50000,
  currency: "INR",
  accountId: "acc_synthetic",
  state: "captured",
  providerOrderId: "order_synthetic",
  authorityRevision: 4,
};
const event: VerifiedPaymentEvent = {
  id: "order_synthetic",
  reference: ids.other,
  amountPaise: 50000,
  currency: "INR",
  eventId: "evt_synthetic",
  digest: "ab".repeat(32),
  accountId: "acc_synthetic",
  paymentId: "pay_synthetic",
  outcome: "captured",
};
beforeEach(() => {
  vi.clearAllMocks();
  booking.target.mockResolvedValue({
    bookingId: ids.consultation,
    ownerId: ids.actor,
    revision: 4,
    amountPaise: 50000,
    currency: "INR",
    paymentOrderId: "unbound_synthetic",
    holdExpiresAt: after,
  });
});

describe("canonical booking financial adapter — no duplicate booking policy", () => {
  it("requires real identity loader and explicit booking action before authoritative target read", async () => {
    const identity = physicianIdentity();
    const loader = vi.fn();
    const handlers = createCommerceBookingPaymentHandlers(identity, loader);
    expect(await handlers.authority.lock(context, intent.subject)).toEqual({
      subject: intent.subject,
      ownerId: ids.actor,
      amountPaise: 50000,
      currency: "INR",
      payable: true,
      authorityRevision: 4,
    });
    expect(booking.authorize).toHaveBeenCalledWith(context, identity, "booking:create", loader);
    expect(booking.authorize.mock.invocationCallOrder[0]).toBeLessThan(
      booking.target.mock.invocationCallOrder[0] ?? 0,
    );
  });
  it("missing booking authority denies instead of fabricating a fee or binding", async () => {
    const handlers = createCommerceBookingPaymentHandlers(null);
    await expect(handlers.authority.lock(context, intent.subject)).rejects.toThrow();
    expect(booking.target).not.toHaveBeenCalled();
    expect(booking.bind).not.toHaveBeenCalled();
  });
  it("binds provider order with saved authoritative revision only after current booking reauthorization", async () => {
    const identity = physicianIdentity();
    const loader = vi.fn();
    const handlers = createCommerceBookingPaymentHandlers(identity, loader);
    await handlers.authority.bind?.(context, intent, event);
    expect(booking.authorize).toHaveBeenCalledWith(context, identity, "booking:create", loader);
    expect(booking.bind).toHaveBeenCalledWith(context, ids.consultation, 4, "order_synthetic");
  });
  it("JOBS receipt adapter builds exactly existing VerifiedBookingPayment, without browser session or provider network", async () => {
    const handlers = createCommerceBookingPaymentHandlers(null);
    await handlers.application.apply(context, intent, event, ids.patient);
    expect(booking.apply).toHaveBeenCalledWith(context, {
      provider: "razorpay",
      eventId: "evt_synthetic",
      paymentId: "pay_synthetic",
      orderId: "order_synthetic",
      bookingId: ids.consultation,
      amountPaise: 50000,
      currency: "INR",
      verificationReference: ids.patient,
      status: "captured",
    });
    expect(booking.authorize).not.toHaveBeenCalled();
  });
  it("does not turn a failed event into a confirmed booking", async () => {
    await expect(
      createCommerceBookingPaymentHandlers(null).application.apply(
        context,
        intent,
        { ...event, outcome: "failed" },
        ids.patient,
      ),
    ).rejects.toThrow();
    expect(booking.apply).not.toHaveBeenCalled();
  });
});
