import type { VerifiedIdentity } from "../../contracts/src/identity.ts";
import { PaymentError } from "../../domain/src/commerce-payments.ts";
import {
  applyVerifiedBookingPayment,
  authorizeBookingInTransaction,
  type BookingAuthorityLoader,
  BookingRuntimeError,
  bindBookingPaymentOrder,
  loadBookingPaymentTarget,
} from "./booking.ts";
import type { PaymentApplication, PaymentAuthority } from "./commerce-payments.ts";

async function bookingCall<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (cause) {
    if (cause instanceof BookingRuntimeError)
      throw new PaymentError(
        cause.code === "DENIED"
          ? "denied"
          : cause.code === "CONFLICT"
            ? "conflict"
            : "unconfigured",
      );
    throw cause;
  }
}

/** Canonical booking fee/binding adapter. No fee, hold or late-payment policy is duplicated here. */
export function createCommerceBookingPaymentHandlers(
  identity: VerifiedIdentity | null,
  loadAuthority?: BookingAuthorityLoader,
): { authority: PaymentAuthority; application: PaymentApplication } {
  return {
    authority: {
      async lock(context, subject) {
        if (subject.kind !== "booking" || !identity || !loadAuthority)
          throw new PaymentError("unconfigured");
        await bookingCall(() =>
          authorizeBookingInTransaction(context, identity, "booking:create", loadAuthority),
        );
        const target = await bookingCall(() => loadBookingPaymentTarget(context, subject.id));
        return {
          subject,
          ownerId: target.ownerId,
          amountPaise: target.amountPaise,
          currency: target.currency,
          payable: true,
          authorityRevision: target.revision,
        };
      },
      async bind(context, intent, order) {
        if (
          intent.subject.kind !== "booking" ||
          !identity ||
          !loadAuthority ||
          intent.authorityRevision === undefined
        )
          throw new PaymentError("unconfigured");
        await bookingCall(() =>
          authorizeBookingInTransaction(context, identity, "booking:create", loadAuthority),
        );
        const revision = intent.authorityRevision;
        await bookingCall(() =>
          bindBookingPaymentOrder(context, intent.subject.id, revision, order.id),
        );
      },
    },
    application: {
      async apply(context, intent, event, verificationReference) {
        if (
          intent.subject.kind !== "booking" ||
          event.outcome !== "captured" ||
          intent.state !== "captured"
        )
          throw new PaymentError("denied");
        await bookingCall(() =>
          applyVerifiedBookingPayment(context, {
            provider: "razorpay",
            eventId: event.eventId,
            paymentId: event.paymentId,
            orderId: event.id,
            bookingId: intent.subject.id,
            amountPaise: intent.amountPaise,
            currency: intent.currency,
            verificationReference,
            status: "captured",
          }),
        );
      },
    },
  };
}
