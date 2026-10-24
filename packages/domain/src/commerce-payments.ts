import {
  type ApprovedRefund,
  type CreatePayment,
  createPaymentSchema,
  type PaymentIntent,
  type ProviderOrder,
  type RefundRequest,
  refundRequestSchema,
  type VerifiedPaymentEvent,
} from "../../contracts/src/commerce-payments.ts";

export class PaymentError extends Error {
  readonly code: "denied" | "conflict" | "invalid_provider" | "unconfigured";
  constructor(code: "denied" | "conflict" | "invalid_provider" | "unconfigured") {
    super(`Payment operation rejected: ${code}.`);
    this.code = code;
  }
}
export interface PaymentProvider {
  readonly accountId: string;
  createOrder(intent: PaymentIntent): Promise<ProviderOrder>;
  reconcileOrder(intent: PaymentIntent): Promise<ProviderOrder | null>;
  reconcileCapture(
    intent: PaymentIntent,
    order: ProviderOrder,
  ): Promise<VerifiedPaymentEvent | null>;
  verifyWebhook(raw: Uint8Array, signature: string, eventId: string): Promise<VerifiedPaymentEvent>;
}
export interface PaymentStore {
  open(actorId: string, input: CreatePayment, accountId: string): Promise<PaymentIntent>;
  get(actorId: string, intentId: string): Promise<PaymentIntent>;
  claimCreate(actorId: string, intentId: string): Promise<PaymentIntent | null>;
  bindOrder(actorId: string, intentId: string, order: ProviderOrder): Promise<void>;
  markUnknown(actorId: string, intentId: string): Promise<void>;
  receive(event: VerifiedPaymentEvent): Promise<"applied" | "duplicate" | "rejected">;
  requestRefund(actorId: string, input: RefundRequest): Promise<string>;
}
export interface RefundPolicy {
  /** Trusted server policy repository; missing/unapproved/currently denied returns null. */
  decide(
    actorId: string,
    intent: PaymentIntent,
    amountPaise: number,
  ): Promise<ApprovedRefund | null>;
}
export type PaymentReceiptSink = Pick<PaymentStore, "receive">;
export function assertProviderOrder(intent: PaymentIntent, order: ProviderOrder): void {
  if (
    order.reference !== intent.operationId ||
    order.amountPaise !== intent.amountPaise ||
    order.currency !== intent.currency ||
    (intent.providerOrderId !== null && intent.providerOrderId !== order.id)
  )
    throw new PaymentError("invalid_provider");
}

export class CommercePayments {
  private readonly store: PaymentStore;
  private readonly provider: PaymentProvider;
  private readonly receipts: PaymentReceiptSink;
  constructor(
    store: PaymentStore,
    provider: PaymentProvider,
    receipts: PaymentReceiptSink = store,
  ) {
    this.store = store;
    this.provider = provider;
    this.receipts = receipts;
  }

  get(actorId: string, intentId: string): Promise<PaymentIntent> {
    return this.store.get(actorId, intentId);
  }

  async create(actorId: string, input: unknown): Promise<PaymentIntent> {
    const intent = await this.store.open(
      actorId,
      createPaymentSchema.parse(input),
      this.provider.accountId,
    );
    const claimed = await this.store.claimCreate(actorId, intent.id);
    if (!claimed) return this.store.get(actorId, intent.id);
    // The durable claim has committed. Any lost response/commit must never trigger another create.
    try {
      const order = await this.provider.createOrder(claimed);
      assertProviderOrder(claimed, order);
      await this.store.bindOrder(actorId, claimed.id, order);
    } catch {
      await this.store.markUnknown(actorId, claimed.id);
    }
    return this.store.get(actorId, intent.id);
  }

  async reconcile(actorId: string, intentId: string): Promise<PaymentIntent> {
    const intent = await this.store.get(actorId, intentId);
    if (intent.accountId !== this.provider.accountId) throw new PaymentError("invalid_provider");
    if (["creating", "unknown", "ready", "failed"].includes(intent.state)) {
      const order = await this.provider.reconcileOrder(intent);
      if (order) {
        assertProviderOrder(intent, order);
        await this.store.bindOrder(actorId, intent.id, order);
        const captured = await this.provider.reconcileCapture(intent, order);
        if (captured && (await this.receipts.receive(captured)) === "rejected")
          throw new PaymentError("invalid_provider");
      }
    }
    return this.store.get(actorId, intentId);
  }

  async webhook(raw: Uint8Array, signature: string, eventId: string) {
    const verified = await this.provider.verifyWebhook(raw, signature, eventId);
    const result = await this.receipts.receive(verified);
    if (result === "rejected") throw new PaymentError("invalid_provider");
    return result;
  }

  requestRefund(actorId: string, input: unknown): Promise<string> {
    return this.store.requestRefund(actorId, refundRequestSchema.parse(input));
  }
}
