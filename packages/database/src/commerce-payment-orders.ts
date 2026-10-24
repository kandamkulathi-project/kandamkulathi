import type {
  AuthoritativePayment,
  PaymentIntent,
  PaymentSubject,
  VerifiedPaymentEvent,
} from "../../contracts/src/commerce-payments.ts";
import { PaymentError } from "../../domain/src/commerce-payments.ts";
import { type DatabaseContext, inTransaction } from "./client.ts";
import type { PaymentApplication, PaymentAuthority } from "./commerce-payments.ts";
import { enqueue } from "./outbox.ts";

function active(context: DatabaseContext): void {
  if (!inTransaction(context.client)) throw new PaymentError("denied");
}

export async function loadCommerceOrderPaymentTarget(
  context: DatabaseContext,
  subject: PaymentSubject,
): Promise<AuthoritativePayment | null> {
  active(context);
  await context.client.query("SET LOCAL TIME ZONE 'UTC'");
  if (subject.kind !== "order") return null;
  const row = (
    await context.client.query<{
      actor_id: string;
      amount_paise: string;
      currency: "INR";
      version: number;
      payable: boolean;
    }>(
      `SELECT actor_id,amount_paise,currency,version,
    status='reserved' AND expires_at>clock_timestamp()
    AND EXISTS(SELECT 1 FROM core.commerce_order_addresses a WHERE a.order_id=core.commerce_orders.id) AS payable
    FROM core.commerce_orders WHERE id=$1 FOR UPDATE`,
      [subject.id],
    )
  ).rows[0];
  return row
    ? {
        subject,
        ownerId: row.actor_id,
        amountPaise: Number(row.amount_paise),
        currency: row.currency,
        payable: row.payable,
        authorityRevision: row.version,
      }
    : null;
}

/** Only the jobs-role signed-receipt transaction may call this; no external or nested transaction. */
export async function applyVerifiedCommerceOrderPayment(
  context: DatabaseContext,
  intent: PaymentIntent,
  event: VerifiedPaymentEvent,
  verificationReference: string,
): Promise<void> {
  active(context);
  await context.client.query("SET LOCAL TIME ZONE 'UTC'");
  if (
    intent.subject.kind !== "order" ||
    event.outcome !== "captured" ||
    intent.state !== "captured"
  )
    throw new PaymentError("denied");
  const { client } = context;
  // Require the verified receipt AND one-effect ledger already present in the same transaction.
  const proof = await client.query(
    `SELECT r.id FROM core.commerce_payment_receipts r
    JOIN core.commerce_payment_ledger l ON l.intent_id=r.intent_id
    WHERE r.id=$1 AND r.intent_id=$2 AND r.account_id=$3 AND r.event_id=$4 AND r.digest=$5 AND r.result='applied'
    AND l.payment_id=$6 AND l.amount_paise=$7 AND l.currency=$8`,
    [
      verificationReference,
      intent.id,
      event.accountId,
      event.eventId,
      event.digest,
      event.paymentId,
      intent.amountPaise,
      intent.currency,
    ],
  );
  if (proof.rowCount !== 1) throw new PaymentError("denied");
  const order = (
    await client.query<{
      id: string;
      actor_id: string;
      amount_paise: string;
      currency: string;
      status: string;
      version: number;
      current: boolean;
      has_address: boolean;
    }>(
      `SELECT id,actor_id,amount_paise,currency,status,version,expires_at>clock_timestamp() AS current,
    EXISTS(SELECT 1 FROM core.commerce_order_addresses a WHERE a.order_id=core.commerce_orders.id) AS has_address
    FROM core.commerce_orders WHERE id=$1 FOR UPDATE`,
      [intent.subject.id],
    )
  ).rows[0];
  let reason: "late_hold" | "unsafe_stock" | "state_changed" | null = null;
  if (
    !order?.has_address ||
    order.actor_id !== intent.ownerId ||
    BigInt(order.amount_paise) !== BigInt(intent.amountPaise) ||
    order.currency !== intent.currency ||
    !["reserved", "expired"].includes(order.status)
  )
    reason = "state_changed";
  else if (order.status === "expired" || !order.current) reason = "late_hold";
  else {
    // Recheck withdrawal/recall/expiry under the same deterministic locks as reservation.
    const batches = (
      await client.query<{ sku_id: string; quantity: number; eligible: boolean }>(
        `SELECT r.sku_id,r.quantity,
      NOT b.recalled AND b.expires_on>CURRENT_DATE+s.minimum_shelf_life_days
      AND b.reserved>=r.quantity AND s.published AND NOT s.consult_only AS eligible
      FROM core.commerce_reservations r JOIN core.commerce_batches b ON b.id=r.batch_id
      JOIN core.commerce_skus s ON s.id=r.sku_id WHERE r.order_id=$1 AND r.state='held'
      ORDER BY s.id,b.expires_on,b.id FOR UPDATE OF b FOR SHARE OF s`,
        [order.id],
      )
    ).rows;
    const lines = (
      await client.query<{ sku_id: string; quantity: number }>(
        "SELECT sku_id,quantity FROM core.commerce_order_lines WHERE order_id=$1 ORDER BY sku_id",
        [order.id],
      )
    ).rows;
    if (
      !lines.length ||
      batches.some((batch) => !batch.eligible) ||
      lines.some(
        (line) =>
          batches
            .filter((batch) => batch.sku_id === line.sku_id)
            .reduce((total, batch) => total + batch.quantity, 0) !== line.quantity,
      )
    )
      reason = "unsafe_stock";
  }
  if (reason === null && order) {
    const changed = await client.query(
      "UPDATE core.commerce_orders SET status='paid',version=version+1 WHERE id=$1 AND status='reserved' AND version=$2 RETURNING id",
      [order.id, order.version],
    );
    if (changed.rowCount !== 1) throw new PaymentError("conflict");
    return;
  }
  if (order && order.status !== "paid")
    await client.query(
      "UPDATE core.commerce_orders SET status='reconciliation_required',version=version+1 WHERE id=$1",
      [order.id],
    );
  const id = crypto.randomUUID();
  const obligation = await client.query<{ id: string }>(
    `INSERT INTO core.commerce_order_payment_obligations(id,intent_id,subject_id,receipt_id,reason)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(intent_id) DO NOTHING RETURNING id`,
    [id, intent.id, intent.subject.id, verificationReference, reason ?? "state_changed"],
  );
  if (obligation.rowCount === 1) {
    const timestamp = (await client.query<{ now: Date }>("SELECT clock_timestamp() AS now")).rows[0]
      ?.now;
    if (!timestamp) throw new PaymentError("conflict");
    await enqueue(context, {
      id: crypto.randomUUID(),
      operationId: id,
      subjectId: id,
      channel: "financial",
      kind: "commerce.reconcile",
      revision: 1,
      dueAt: timestamp,
      deadlineAt: new Date(timestamp.getTime() + 86400000),
    });
  }
}

/** Booking adapters must wrap Mathew's canonical target/bind/apply functions; missing hooks deny. */
export function createCommerceFinancialHandlers(booking?: {
  authority: PaymentAuthority;
  application: PaymentApplication;
}): { authority: PaymentAuthority; application: PaymentApplication } {
  return {
    authority: {
      lock: (context, subject) =>
        subject.kind === "order"
          ? loadCommerceOrderPaymentTarget(context, subject)
          : booking
            ? booking.authority.lock(context, subject)
            : Promise.resolve(null),
      async bind(context, intent, order) {
        if (intent.subject.kind === "booking") {
          if (!booking?.authority.bind) throw new PaymentError("unconfigured");
          await booking.authority.bind(context, intent, order);
        }
      },
    },
    application: {
      async apply(context, intent, event, reference) {
        if (intent.subject.kind === "order")
          return applyVerifiedCommerceOrderPayment(context, intent, event, reference);
        if (!booking) throw new PaymentError("unconfigured");
        await booking.application.apply(context, intent, event, reference);
      },
    },
  };
}
