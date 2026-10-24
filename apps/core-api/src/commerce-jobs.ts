import {
  authoritativePaymentSchema,
  createPaymentSchema,
  type PaymentIntent,
  type PaymentState,
  type VerifiedPaymentEvent,
} from "../../../packages/contracts/src/commerce-payments.ts";
import {
  type DatabaseContext,
  inTransaction,
  transaction,
} from "../../../packages/database/src/client.ts";
import { createCommerceBookingPaymentHandlers } from "../../../packages/database/src/commerce-payment-bookings.ts";
import { createCommerceFinancialHandlers } from "../../../packages/database/src/commerce-payment-orders.ts";
import { CommercePaymentRepository } from "../../../packages/database/src/commerce-payments.ts";
import type { ClaimedJob } from "../../../packages/database/src/outbox.ts";
import {
  assertProviderOrder,
  PaymentError,
} from "../../../packages/domain/src/commerce-payments.ts";
import { configuredCommercePaymentProvider } from "./commerce-provider.ts";

type IntentRow = {
  id: string;
  operation_id: string;
  subject_kind: "order" | "booking";
  subject_id: string;
  owner_id: string;
  amount_paise: string;
  currency: "INR";
  account_id: string;
  state: PaymentState;
  provider_order_id: string | null;
  authority_revision: number | null;
};

export class CommerceReconciliationUnavailable extends Error {
  constructor(
    readonly reason: "policy_review" | "unresolved" | "unrecognized" | "provider_unavailable",
  ) {
    super(`Commerce reconciliation unavailable: ${reason}.`);
  }
}

async function system(context: DatabaseContext): Promise<void> {
  const role = (
    await context.client.query<{ jobs: boolean }>(
      "SELECT pg_has_role(current_user,'k_jobs_runtime','member') AS jobs",
    )
  ).rows[0];
  if (!role?.jobs) throw new PaymentError("denied");
  await context.client.query("SELECT set_config('app.payment_system','verified',true)");
}

/** Lock the authoritative job, never trust a caller's copied operation/subject fields. */
async function fence(context: DatabaseContext, job: ClaimedJob): Promise<boolean> {
  return (
    (
      await context.client.query<{ valid: boolean }>(
        `SELECT lease_token=$2 AND status='processing' AND lease_until>clock_timestamp() AND deadline_at>clock_timestamp()
      AND channel='financial' AND kind='commerce.reconcile' AND operation_id=$3
      AND subject_id=$4 AND revision=$5 AS valid
      FROM platform.outbox WHERE id=$1 FOR UPDATE`,
        [job.id, job.leaseToken, job.operationId, job.subjectId, job.revision],
      )
    ).rows[0]?.valid === true
  );
}

async function loadIntent(context: DatabaseContext, job: ClaimedJob): Promise<PaymentIntent> {
  // These UUIDs represent money awaiting an approved decision, not a provider lookup probe.
  const review = await context.client.query(
    `SELECT id FROM core.commerce_payment_obligations WHERE id=$1
     UNION ALL SELECT id FROM core.commerce_order_payment_obligations WHERE id=$1
     UNION ALL SELECT id FROM clinical.mathew_booking_obligation WHERE id=$1
     UNION ALL SELECT id FROM core.commerce_payment_refunds WHERE id=$2 AND intent_id=$1`,
    [job.subjectId, job.operationId],
  );
  if (review.rows.length) throw new CommerceReconciliationUnavailable("policy_review");
  // Intent creation, signed-capture ledger and reservation expiry use different operation IDs.
  // A refund UUID (also subject=intent) must never fall through to an intent-success ACK.
  const rows = (
    await context.client.query<IntentRow>(
      `SELECT i.* FROM core.commerce_payment_intents i WHERE
     (i.id=$1 AND (i.id=$2 OR EXISTS(SELECT 1 FROM core.commerce_payment_ledger l
       WHERE l.id=$2 AND l.intent_id=i.id))) OR
     (i.subject_kind='order' AND i.subject_id=$1 AND (EXISTS(
       SELECT 1 FROM core.commerce_reservation_expirations e WHERE e.order_id=$1 AND e.id=$2)
       OR EXISTS(SELECT 1 FROM core.commerce_orders o WHERE o.id=$1 AND o.operation_id=$2)))`,
      [job.subjectId, job.operationId],
    )
  ).rows;
  if (rows.length !== 1) throw new CommerceReconciliationUnavailable("unrecognized");
  const row = rows[0];
  if (!row) throw new CommerceReconciliationUnavailable("unrecognized");
  const { payable: _, ...authority } = authoritativePaymentSchema.parse({
    subject: { kind: row.subject_kind, id: row.subject_id },
    ownerId: row.owner_id,
    amountPaise: Number(row.amount_paise),
    currency: row.currency,
    payable: false,
    ...(row.authority_revision === null ? {} : { authorityRevision: row.authority_revision }),
  });
  return {
    ...authority,
    id: createPaymentSchema.shape.operationId.parse(row.id),
    operationId: createPaymentSchema.shape.operationId.parse(row.operation_id),
    accountId: row.account_id,
    state: row.state,
    providerOrderId: row.provider_order_id,
  };
}

async function settled(context: DatabaseContext, intent: PaymentIntent): Promise<boolean> {
  if (intent.state !== "captured") return false;
  const proof = await context.client.query(
    `SELECT l.id FROM core.commerce_payment_ledger l JOIN core.commerce_payment_receipts r
     ON r.intent_id=l.intent_id AND r.account_id=l.account_id AND r.payment_id=l.payment_id
     WHERE l.intent_id=$1 AND l.account_id=$2 AND l.amount_paise=$3 AND l.currency=$4
     AND r.result='applied' AND r.outcome='captured' AND r.provider_order_id=$5
     AND r.amount_paise=l.amount_paise AND r.currency=l.currency`,
    [intent.id, intent.accountId, intent.amountPaise, intent.currency, intent.providerOrderId],
  );
  if (!proof.rows.length) return false;
  const reviews = await context.client.query(
    `SELECT id FROM core.commerce_payment_obligations WHERE intent_id=$1
     UNION ALL SELECT id FROM core.commerce_order_payment_obligations WHERE intent_id=$1
     UNION ALL SELECT id FROM core.commerce_payment_refunds WHERE intent_id=$1 AND state IN ('requested','unknown')`,
    [intent.id],
  );
  if (reviews.rows.length) return false;
  // Reuse the canonical application's durable result; do not infer clinical/refund policy.
  const application =
    intent.subject.kind === "order"
      ? await context.client.query(
          "SELECT id FROM core.commerce_orders WHERE id=$1 AND status='paid'",
          [intent.subject.id],
        )
      : await context.client.query(
          `SELECT b.id FROM clinical.mathew_booking_booking b
       JOIN clinical.mathew_booking_payment p ON p.booking_id=b.id AND p.provider='razorpay'
       JOIN core.commerce_payment_ledger l ON l.payment_id=p.payment_id AND l.intent_id=$2 AND l.account_id=$3
       WHERE b.id=$1 AND b.state='confirmed'
       AND NOT EXISTS(SELECT 1 FROM clinical.mathew_booking_obligation o WHERE o.booking_id=b.id)`,
          [intent.subject.id, intent.id, intent.accountId],
        );
  return application.rows.length === 1;
}

/** External-work path: acquireExecution MUST have committed before calling this function.
 * No createOrder/POST, browser session, nested transaction or provider I/O under SQL locks.
 * Throwing means retry/DLQ, never successful completion of unresolved financial work.
 */
export async function executeCommerceReconcile(
  context: DatabaseContext,
  job: ClaimedJob,
  bindings: Record<string, unknown>,
): Promise<"succeeded" | "stale"> {
  if (inTransaction(context.client)) throw new PaymentError("conflict");
  if (job.kind !== "commerce.reconcile" || job.channel !== "financial")
    throw new PaymentError("denied");
  const snapshot = await transaction(context.client, async () => {
    await system(context);
    if (!(await fence(context, job))) return null;
    return loadIntent(context, job);
  });
  if (!snapshot) return "stale";

  let event: VerifiedPaymentEvent | null = null;
  // Captured money already has canonical receipt/application evidence; no unnecessary external call.
  if (snapshot.state !== "captured") {
    const provider = configuredCommercePaymentProvider(bindings);
    if (!provider) throw new CommerceReconciliationUnavailable("provider_unavailable");
    if (provider.accountId !== snapshot.accountId) throw new PaymentError("invalid_provider");
    const order = await provider.reconcileOrder(snapshot);
    if (!order) throw new CommerceReconciliationUnavailable("unresolved");
    assertProviderOrder(snapshot, order);
    event = await provider.reconcileCapture(snapshot, order);
    if (!event) throw new CommerceReconciliationUnavailable("unresolved");
    assertProviderOrder(snapshot, event);
    if (event.accountId !== snapshot.accountId || event.outcome !== "captured")
      throw new PaymentError("invalid_provider");
  }

  const result = await transaction(context.client, async () => {
    await system(context);
    if (!(await fence(context, job))) return "stale" as const;
    const current = await loadIntent(context, job);
    if (current.id !== snapshot.id || current.operationId !== snapshot.operationId)
      throw new PaymentError("conflict");
    if (event) {
      const handlers = createCommerceFinancialHandlers(createCommerceBookingPaymentHandlers(null));
      const repository = new CommercePaymentRepository(
        context,
        handlers.authority,
        undefined,
        handlers.application,
      );
      // Parent-owned SQL-only boundary: receipt+ledger+canonical application join this fenced tx.
      await repository.receiveInTransaction(event);
    }
    const applied = await loadIntent(context, job);
    const resolved = await settled(context, applied);
    if (!(await fence(context, job))) throw new PaymentError("conflict");
    if (!resolved) return "unresolved" as const;
    // Receipt RLS requires the still-processing authoritative job; insert before completing it.
    await context.client.query(
      `INSERT INTO platform.receipts(operation_id,kind,job_id) VALUES($1,'commerce.reconcile',$2)
       ON CONFLICT(operation_id,kind) DO NOTHING`,
      [job.operationId, job.id],
    );
    // Recheck time after all bounded SQL. Throw on lease loss so financial changes roll back too.
    const completed = await context.client.query(
      `UPDATE platform.outbox SET status='succeeded',completed_at=clock_timestamp(),
       failure_code=NULL,lease_token=NULL,lease_until=NULL
        WHERE id=$1 AND lease_token=$2 AND status='processing' AND lease_until>clock_timestamp() AND deadline_at>clock_timestamp()
       RETURNING id`,
      [job.id, job.leaseToken],
    );
    if (completed.rowCount !== 1) throw new PaymentError("conflict");
    return "succeeded" as const;
  });
  // Commit durable rejected/late-capture evidence, but NEVER ACK the unresolved job.
  if (result === "unresolved") throw new CommerceReconciliationUnavailable("unresolved");
  return result;
}
