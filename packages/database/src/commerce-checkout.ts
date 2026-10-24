import { z } from "zod";
import {
  type CommercePaymentCheckout,
  commercePaymentCheckoutSchema,
} from "../../contracts/src/commerce-checkout.ts";
import { canonicalUuidSchema } from "../../contracts/src/identifiers.ts";
import type { VerifiedIdentity } from "../../contracts/src/identity.ts";
import { PaymentError } from "../../domain/src/commerce-payments.ts";
import {
  authorizeBookingInTransaction,
  type BookingAuthorityLoader,
  BookingRuntimeError,
  loadBookingPaymentTarget,
} from "./booking.ts";
import { type DatabaseContext, transaction } from "./client.ts";
import { loadCommerceOrderPaymentTarget } from "./commerce-payment-orders.ts";

export interface CommerceCheckoutReadOptions {
  actorId: string;
  identity: VerifiedIdentity;
  accountId: string;
  keyId: string;
  bookingAuthorityLoader?: BookingAuthorityLoader | undefined;
  /** Request fence then current identity revalidation; SQL only in this caller-owned transaction. */
  authorizeTransaction(context: DatabaseContext): Promise<void>;
}

/** Read-only business operation. Locks/current authority remain held until the DTO is validated. */
export async function readCommerceCheckout(
  context: DatabaseContext,
  intentId: string,
  options: CommerceCheckoutReadOptions,
): Promise<CommercePaymentCheckout> {
  canonicalUuidSchema.parse(intentId);
  commercePaymentCheckoutSchema.shape.keyId.parse(options.keyId);
  z.string()
    .regex(/^acc_[A-Za-z0-9]{1,80}$/)
    .parse(options.accountId);
  return transaction(context.client, async () => {
    await options.authorizeTransaction(context);
    const row = (
      await context.client.query<{
        id: string;
        operation_id: string;
        subject_kind: "order" | "booking";
        subject_id: string;
        owner_id: string;
        amount_paise: string;
        currency: string;
        account_id: string;
        state: string;
        provider_order_id: string | null;
      }>(
        `SELECT id,operation_id,subject_kind,subject_id,owner_id,amount_paise,currency,
        account_id,state,provider_order_id FROM core.commerce_payment_intents WHERE id=$1 FOR UPDATE`,
        [intentId],
      )
    ).rows[0];
    if (!row || row.owner_id !== options.actorId) throw new PaymentError("denied");
    if (row.account_id !== options.accountId) throw new PaymentError("unconfigured");
    if (row.state !== "ready" || row.provider_order_id === null) throw new PaymentError("conflict");
    const dto = commercePaymentCheckoutSchema.parse({
      keyId: options.keyId,
      providerOrderId: row.provider_order_id,
      amountPaise: Number(row.amount_paise),
      currency: row.currency,
      intentId: row.id,
      operationId: row.operation_id,
      subject: { kind: row.subject_kind, id: row.subject_id },
    });
    let target: { ownerId: string; amountPaise: number; currency: string };
    if (dto.subject.kind === "order") {
      const order = await loadCommerceOrderPaymentTarget(context, dto.subject);
      if (!order || order.ownerId !== options.actorId) throw new PaymentError("denied");
      if (!order.payable) throw new PaymentError("conflict");
      target = order;
    } else {
      if (!options.bookingAuthorityLoader) throw new PaymentError("unconfigured");
      let booking: Awaited<ReturnType<typeof loadBookingPaymentTarget>>;
      try {
        await authorizeBookingInTransaction(
          context,
          options.identity,
          "booking:create",
          options.bookingAuthorityLoader,
        );
        booking = await loadBookingPaymentTarget(context, dto.subject.id);
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
      if (booking.ownerId !== options.actorId) throw new PaymentError("denied");
      // Binding increments booking revision; the saved pre-bind revision is not current authority.
      if (booking.paymentOrderId !== dto.providerOrderId) throw new PaymentError("conflict");
      target = booking;
    }
    if (target.amountPaise !== dto.amountPaise || target.currency !== dto.currency)
      throw new PaymentError("conflict");
    return dto;
  });
}
