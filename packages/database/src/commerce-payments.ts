import { z } from "zod";
import {
  type AuthoritativePayment,
  authoritativePaymentSchema,
  type CreatePayment,
  createPaymentSchema,
  type PaymentIntent,
  type PaymentState,
  type PaymentSubject,
  type ProviderOrder,
  type RefundRequest,
  refundRequestSchema,
  type VerifiedPaymentEvent,
} from "../../contracts/src/commerce-payments.ts";
import {
  assertProviderOrder,
  PaymentError,
  type PaymentStore,
  type RefundPolicy,
} from "../../domain/src/commerce-payments.ts";
import { type DatabaseContext, inTransaction, transaction } from "./client.ts";
import { enqueue } from "./outbox.ts";

export interface PaymentAuthority {
  /** Trusted SQL-only implementation. Lock authoritative subject in context, enforce current ownership/payability.
   * Never call another network service, create a snapshot from HTTP input or open another transaction here. */
  lock(context: DatabaseContext, subject: PaymentSubject): Promise<AuthoritativePayment | null>;
  /** SQL-only provider association; required for booking. CAS with persisted authorityRevision. */
  bind?(context: DatabaseContext, intent: PaymentIntent, order: ProviderOrder): Promise<void>;
}
export interface PaymentApplication {
  /** JOBS connection, ACTIVE caller-owned transaction. Receipt UUID and ledger already inserted.
   * Apply order/booking state or durable late-payment obligation, without nesting/network.
   * Any error rolls back receipt, ledger, application and outbox together. */
  apply(
    context: DatabaseContext,
    intent: PaymentIntent,
    event: VerifiedPaymentEvent,
    verificationReference: string,
  ): Promise<void>;
}
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
const fromRow = (row: IntentRow): PaymentIntent => ({
  id: row.id,
  operationId: row.operation_id,
  subject: { kind: row.subject_kind, id: row.subject_id },
  ownerId: row.owner_id,
  amountPaise: Number(row.amount_paise),
  currency: row.currency,
  accountId: row.account_id,
  state: row.state,
  providerOrderId: row.provider_order_id,
  ...(row.authority_revision === null ? {} : { authorityRevision: row.authority_revision }),
});

export class CommercePaymentRepository implements PaymentStore {
  private readonly context: DatabaseContext;
  private readonly authority: PaymentAuthority;
  private readonly refundPolicy: RefundPolicy | undefined;
  private readonly application: PaymentApplication | undefined;
  private readonly authorizeTransaction:
    | ((context: DatabaseContext, actorId: string) => Promise<void>)
    | undefined;
  constructor(
    context: DatabaseContext,
    authority: PaymentAuthority,
    refundPolicy?: RefundPolicy,
    application?: PaymentApplication,
    authorizeTransaction?: (context: DatabaseContext, actorId: string) => Promise<void>,
  ) {
    this.context = context;
    this.authority = authority;
    this.refundPolicy = refundPolicy;
    this.application = application;
    this.authorizeTransaction = authorizeTransaction;
  }

  private scoped<T>(actorId: string | null, work: () => Promise<T>): Promise<T> {
    if (actorId !== null) z.uuid().parse(actorId);
    return transaction(this.context.client, async () => {
      await this.context.client.query(
        "SELECT set_config('app.actor_id',$1,true),set_config('app.payment_system',$2,true)",
        [actorId ?? "", actorId === null ? "verified" : ""],
      );
      if (actorId !== null) await this.authorizeTransaction?.(this.context, actorId);
      return work();
    });
  }
  private async lock(id: string): Promise<PaymentIntent> {
    z.uuid().parse(id);
    const row = (
      await this.context.client.query<IntentRow>(
        "SELECT * FROM core.commerce_payment_intents WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!row) throw new PaymentError("denied");
    return fromRow(row);
  }
  private async obligation(operationId: string, subjectId: string): Promise<void> {
    const timing = (
      await this.context.client.query<{ now: Date }>("SELECT clock_timestamp() AS now")
    ).rows[0];
    if (!timing) throw new PaymentError("conflict");
    await enqueue(this.context, {
      id: crypto.randomUUID(),
      operationId,
      channel: "financial",
      kind: "commerce.reconcile",
      subjectId,
      revision: 1,
      dueAt: timing.now,
      deadlineAt: new Date(timing.now.getTime() + 86400000),
    });
  }

  async open(actorId: string, input: CreatePayment, accountId: string): Promise<PaymentIntent> {
    const request = createPaymentSchema.parse(input);
    z.string()
      .regex(/^acc_[A-Za-z0-9]{1,80}$/)
      .parse(accountId);
    return this.scoped(actorId, async () => {
      const { client } = this.context;
      // Shared subject lock serializes fresh operation IDs for the same order/booking.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        `payment:${request.subject.kind}:${request.subject.id}`,
      ]);
      const existing = (
        await client.query<IntentRow>(
          "SELECT * FROM core.commerce_payment_intents WHERE operation_id=$1 OR (subject_kind=$2 AND subject_id=$3) FOR UPDATE",
          [request.operationId, request.subject.kind, request.subject.id],
        )
      ).rows;
      if (existing.length) {
        const row = existing[0];
        if (
          existing.length !== 1 ||
          !row ||
          row.operation_id !== request.operationId ||
          row.account_id !== accountId ||
          row.subject_kind !== request.subject.kind ||
          row.subject_id !== request.subject.id ||
          row.owner_id !== actorId
        )
          throw new PaymentError("conflict");
        return fromRow(row);
      }
      const snapshot = await this.authority.lock(this.context, request.subject);
      if (!snapshot) throw new PaymentError("denied");
      const authoritative = authoritativePaymentSchema.parse(snapshot);
      if (
        request.subject.kind === "booking" &&
        (!this.authority.bind || authoritative.authorityRevision === undefined)
      )
        throw new PaymentError("unconfigured");
      if (
        !authoritative.payable ||
        authoritative.ownerId !== actorId ||
        authoritative.subject.id !== request.subject.id ||
        authoritative.subject.kind !== request.subject.kind
      )
        throw new PaymentError("denied");
      const id = crypto.randomUUID();
      const row = (
        await client.query<IntentRow>(
          `INSERT INTO core.commerce_payment_intents
        (id,operation_id,subject_kind,subject_id,owner_id,amount_paise,currency,account_id,authority_revision)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING RETURNING *`,
          [
            id,
            request.operationId,
            request.subject.kind,
            request.subject.id,
            actorId,
            authoritative.amountPaise,
            authoritative.currency,
            accountId,
            authoritative.authorityRevision ?? null,
          ],
        )
      ).rows[0];
      if (!row) throw new PaymentError("conflict");
      await this.obligation(id, id);
      return fromRow(row);
    });
  }

  get(actorId: string, intentId: string): Promise<PaymentIntent> {
    return this.scoped(actorId, () => this.lock(intentId));
  }
  claimCreate(actorId: string, intentId: string): Promise<PaymentIntent | null> {
    return this.scoped(actorId, async () => {
      const intent = await this.lock(intentId);
      if (intent.state !== "pending") return null;
      // Recheck subject after the intent was opened: do not create for expired/cancelled orders.
      const current = await this.authority.lock(this.context, intent.subject);
      if (!current) throw new PaymentError("denied");
      const snapshot = authoritativePaymentSchema.parse(current);
      if (
        !snapshot.payable ||
        snapshot.ownerId !== actorId ||
        snapshot.subject.kind !== intent.subject.kind ||
        snapshot.subject.id !== intent.subject.id ||
        snapshot.amountPaise !== intent.amountPaise ||
        snapshot.currency !== intent.currency ||
        snapshot.authorityRevision !== intent.authorityRevision
      )
        throw new PaymentError("conflict");
      await this.context.client.query(
        "UPDATE core.commerce_payment_intents SET state='creating' WHERE id=$1",
        [intent.id],
      );
      return { ...intent, state: "creating" };
    });
  }
  bindOrder(actorId: string, intentId: string, order: ProviderOrder): Promise<void> {
    return this.scoped(actorId, async () => {
      const intent = await this.lock(intentId);
      assertProviderOrder(intent, order);
      if (intent.state === "pending") throw new PaymentError("conflict");
      if (intent.providerOrderId === null && this.authority.bind)
        await this.authority.bind(this.context, intent, order);
      await this.context.client.query(
        `UPDATE core.commerce_payment_intents SET provider_order_id=$2,
        state=CASE WHEN state IN ('creating','unknown') THEN 'ready' ELSE state END WHERE id=$1`,
        [intentId, order.id],
      );
    });
  }
  markUnknown(actorId: string, intentId: string): Promise<void> {
    return this.scoped(actorId, async () => {
      await this.lock(intentId);
      await this.context.client.query(
        "UPDATE core.commerce_payment_intents SET state='unknown' WHERE id=$1 AND state='creating'",
        [intentId],
      );
    });
  }

  receive(event: VerifiedPaymentEvent): Promise<"applied" | "duplicate" | "rejected"> {
    return this.scoped(null, () => this.receiveInTransaction(event));
  }

  /** Trusted JOBS-only fenced completion: caller owns the active transaction and COMMIT.
   * Receipt, ledger, business application and outbox share that boundary; no provider I/O. */
  async receiveInTransaction(
    event: VerifiedPaymentEvent,
  ): Promise<"applied" | "duplicate" | "rejected"> {
    if (!inTransaction(this.context.client)) throw new PaymentError("denied");
    const role = (
      await this.context.client.query<{ jobs: boolean }>(
        "SELECT pg_has_role(current_user,'k_jobs_runtime','member') AS jobs",
      )
    ).rows[0];
    if (!role?.jobs) throw new PaymentError("denied");
    await this.context.client.query(
      "SELECT set_config('app.actor_id','',true),set_config('app.payment_system','verified',true)",
    );
    if (event.outcome === "captured" && !this.application) throw new PaymentError("unconfigured");
    const { client } = this.context;
    // Event identity is durable; altered replay is never treated as a successful duplicate.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `receipt:${event.accountId}:${event.eventId}`,
    ]);
    const priors = (
      await client.query<{ digest: string; result: string }>(
        "SELECT digest,result FROM core.commerce_payment_receipts WHERE account_id=$1 AND event_id=$2",
        [event.accountId, event.eventId],
      )
    ).rows;
    const matching = priors.find((prior) => prior.digest === event.digest);
    if (matching) return matching.result === "applied" ? "duplicate" : "rejected";
    const row = (
      await client.query<IntentRow>(
        "SELECT * FROM core.commerce_payment_intents WHERE operation_id=$1 FOR UPDATE",
        [event.reference],
      )
    ).rows[0];
    const intent = row ? fromRow(row) : null;
    let valid =
      priors.length === 0 &&
      intent !== null &&
      intent.accountId === event.accountId &&
      intent.amountPaise === event.amountPaise &&
      intent.currency === event.currency &&
      (intent.providerOrderId === null || intent.providerOrderId === event.id) &&
      intent.state !== "pending";
    const existing = intent
      ? (
          await client.query<{ payment_id: string }>(
            "SELECT payment_id FROM core.commerce_payment_ledger WHERE intent_id=$1",
            [intent.id],
          )
        ).rows[0]
      : undefined;
    if (existing && event.outcome === "captured" && existing.payment_id !== event.paymentId)
      valid = false;
    // A provider payment cannot be credited to two intents, even with different event IDs.
    if (valid && event.outcome === "captured") {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        `capture:${event.accountId}:${event.paymentId}`,
      ]);
      const reused = await client.query(
        "SELECT id FROM core.commerce_payment_ledger WHERE account_id=$1 AND payment_id=$2 AND intent_id<>$3",
        [event.accountId, event.paymentId, intent?.id],
      );
      if (reused.rowCount) valid = false;
    }
    const receiptId = crypto.randomUUID();
    await client.query(
      `INSERT INTO core.commerce_payment_receipts(id,account_id,event_id,digest,intent_id,outcome,result,
          provider_order_id,payment_id,business_reference,amount_paise,currency)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        receiptId,
        event.accountId,
        event.eventId,
        event.digest,
        intent?.id ?? null,
        event.outcome,
        valid ? "applied" : "rejected",
        event.id,
        event.paymentId,
        event.reference,
        event.amountPaise,
        event.currency,
      ],
    );
    if (!valid || !intent) {
      if (event.outcome === "captured") {
        const obligationId = crypto.randomUUID();
        const inserted = await client.query(
          `INSERT INTO core.commerce_payment_obligations
            (id,account_id,payment_id,provider_order_id,business_reference,intent_id,receipt_id,amount_paise,currency,reason)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(account_id,payment_id) DO NOTHING RETURNING id`,
          [
            obligationId,
            event.accountId,
            event.paymentId,
            event.id,
            event.reference,
            intent?.id ?? null,
            receiptId,
            event.amountPaise,
            event.currency,
            priors.length
              ? "replay_mismatch"
              : existing
                ? "additional_capture"
                : "capture_mismatch",
          ],
        );
        if (inserted.rowCount === 1) await this.obligation(obligationId, obligationId);
      }
      return "rejected";
    }
    if (event.outcome === "captured" && !existing) {
      await client.query(
        "UPDATE core.commerce_payment_intents SET state='captured',provider_order_id=$2 WHERE id=$1",
        [intent.id, event.id],
      );
      const effectId = crypto.randomUUID();
      await client.query(
        `INSERT INTO core.commerce_payment_ledger(id,intent_id,account_id,payment_id,amount_paise,currency)
          VALUES($1,$2,$3,$4,$5,$6)`,
        [
          effectId,
          intent.id,
          event.accountId,
          event.paymentId,
          intent.amountPaise,
          intent.currency,
        ],
      );
      await this.application?.apply(
        this.context,
        { ...intent, state: "captured", providerOrderId: event.id },
        event,
        receiptId,
      );
      await this.obligation(effectId, intent.id);
    } else if (event.outcome === "failed" && intent.state !== "captured") {
      await client.query(
        "UPDATE core.commerce_payment_intents SET state='failed',provider_order_id=$2 WHERE id=$1",
        [intent.id, event.id],
      );
    }
    return "applied";
  }

  requestRefund(actorId: string, input: RefundRequest): Promise<string> {
    const request = refundRequestSchema.parse(input);
    return this.scoped(actorId, async () => {
      const intent = await this.lock(request.intentId);
      if (intent.ownerId !== actorId || intent.state !== "captured")
        throw new PaymentError("denied");
      const { client } = this.context;
      const prior = (
        await client.query<{ id: string; intent_id: string; amount_paise: string }>(
          "SELECT id,intent_id,amount_paise FROM core.commerce_payment_refunds WHERE operation_id=$1",
          [request.operationId],
        )
      ).rows[0];
      if (prior) {
        if (prior.intent_id !== intent.id || Number(prior.amount_paise) !== request.amountPaise)
          throw new PaymentError("conflict");
        return prior.id;
      }
      // SQL-only policy callback runs under intent lock. No policy supplied means DENY, not a guessed window/percentage.
      const policy = await this.refundPolicy?.decide(actorId, intent, request.amountPaise);
      if (
        !policy ||
        !Number.isSafeInteger(policy.maximumPaise) ||
        policy.maximumPaise < request.amountPaise ||
        !z.uuid().safeParse(policy.approvedBy).success ||
        !policy.version ||
        policy.version.length > 128
      )
        throw new PaymentError("denied");
      const total = (
        await client.query<{ total: string }>(
          "SELECT coalesce(sum(amount_paise),0)::text AS total FROM core.commerce_payment_refunds WHERE intent_id=$1 AND state<>'failed'",
          [intent.id],
        )
      ).rows[0];
      if (
        !total ||
        BigInt(total.total) + BigInt(request.amountPaise) >
          BigInt(Math.min(intent.amountPaise, policy.maximumPaise))
      )
        throw new PaymentError("conflict");
      const id = crypto.randomUUID();
      await client.query(
        `INSERT INTO core.commerce_payment_refunds(id,operation_id,intent_id,actor_id,amount_paise,policy_version,approved_by)
        VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          id,
          request.operationId,
          intent.id,
          actorId,
          request.amountPaise,
          policy.version,
          policy.approvedBy,
        ],
      );
      await this.obligation(id, intent.id);
      return id;
    });
  }
}
