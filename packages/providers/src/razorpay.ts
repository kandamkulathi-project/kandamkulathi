/// <reference types="node" />
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type {
  PaymentIntent,
  ProviderOrder,
  VerifiedPaymentEvent,
} from "../../contracts/src/commerce-payments.ts";
import {
  assertProviderOrder,
  PaymentError,
  type PaymentProvider,
} from "../../domain/src/commerce-payments.ts";

const identifier = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9]{1,80}$`));
const paise = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const orderSchema = z.object({
  entity: z.literal("order"),
  id: identifier("order"),
  amount: paise,
  currency: z.literal("INR"),
  receipt: z.uuid(),
});
const configSchema = z
  .object({
    accountId: identifier("acc"),
    keyId: z.string().regex(/^rzp_test_[A-Za-z0-9]+$/),
    keySecret: z.string().min(1).max(256),
    webhookSecret: z.string().min(1).max(256),
  })
  .strict();
export type RazorpayConfiguration = z.infer<typeof configSchema>;
const normalize = (input: unknown): ProviderOrder => {
  const order = orderSchema.parse(input);
  return {
    id: order.id,
    reference: order.receipt,
    amountPaise: order.amount,
    currency: order.currency,
  };
};

/** Test-mode REST adapter. No implicit credentials, SDK retries, configurable hosts or live-key fallback. */
export class RazorpayAdapter implements PaymentProvider {
  readonly accountId: string;
  private readonly configuration: RazorpayConfiguration;
  private readonly transport: typeof fetch;
  constructor(configuration: RazorpayConfiguration, transport: typeof fetch = fetch) {
    const parsed = configSchema.safeParse(configuration);
    if (!parsed.success) throw new PaymentError("unconfigured");
    this.configuration = parsed.data;
    this.accountId = parsed.data.accountId;
    this.transport = transport;
  }

  private async request(path: string, body?: object): Promise<unknown> {
    try {
      const response = await this.transport(`https://api.razorpay.com/v1/${path}`, {
        method: body ? "POST" : "GET",
        redirect: "error",
        signal: AbortSignal.timeout(8000),
        headers: {
          Authorization: `Basic ${btoa(`${this.configuration.keyId}:${this.configuration.keySecret}`)}`,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok || !response.body) throw new Error("Provider request failed.");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 262144) throw new Error("Provider response exceeded limit.");
          chunks.push(value);
        }
      } finally {
        await reader.cancel();
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes));
    } catch {
      // Never expose credentials, raw provider errors, private bodies or an uncertain-success claim.
      throw new PaymentError("invalid_provider");
    }
  }

  async createOrder(intent: PaymentIntent): Promise<ProviderOrder> {
    if (intent.accountId !== this.accountId || intent.state !== "creating")
      throw new PaymentError("denied");
    const order = normalize(
      await this.request("orders", {
        amount: intent.amountPaise,
        currency: intent.currency,
        receipt: intent.operationId,
        partial_payment: false,
      }),
    );
    assertProviderOrder(intent, order);
    return order;
  }

  async reconcileOrder(intent: PaymentIntent): Promise<ProviderOrder | null> {
    if (intent.accountId !== this.accountId) throw new PaymentError("invalid_provider");
    if (intent.providerOrderId) {
      const id = identifier("order").parse(intent.providerOrderId);
      const order = normalize(await this.request(`orders/${id}`));
      assertProviderOrder(intent, order);
      return order;
    }
    // Receipt is unique. Two matches, a truncated/invalid collection or any mismatch require review.
    const collection = z
      .object({
        entity: z.literal("collection"),
        count: z.number().int().min(0).max(2),
        items: z.array(orderSchema).max(2),
      })
      .parse(
        await this.request(
          `orders?receipt=${encodeURIComponent(intent.operationId)}&count=2&skip=0`,
        ),
      );
    if (collection.count !== collection.items.length || collection.count > 1)
      throw new PaymentError("invalid_provider");
    if (!collection.items[0]) return null; // absence never authorizes another POST
    const order = normalize(collection.items[0]);
    assertProviderOrder(intent, order);
    return order;
  }

  async reconcileCapture(
    intent: PaymentIntent,
    order: ProviderOrder,
  ): Promise<VerifiedPaymentEvent | null> {
    if (intent.accountId !== this.accountId) throw new PaymentError("invalid_provider");
    assertProviderOrder(intent, order);
    const collection = z
      .object({
        entity: z.literal("collection"),
        count: z.number().int().min(0).max(100),
        items: z
          .array(
            z.object({
              entity: z.literal("payment"),
              id: identifier("pay"),
              order_id: identifier("order"),
              amount: paise,
              currency: z.literal("INR"),
              status: z.string(),
              captured: z.boolean(),
            }),
          )
          .max(100),
      })
      .parse(await this.request(`orders/${identifier("order").parse(order.id)}/payments`));
    if (collection.count !== collection.items.length || collection.count === 100)
      throw new PaymentError("invalid_provider");
    const captures = collection.items.filter((payment) => payment.status === "captured");
    if (captures.length > 1) throw new PaymentError("invalid_provider");
    const payment = captures[0];
    if (!payment) return null;
    if (
      !payment.captured ||
      payment.order_id !== order.id ||
      payment.amount !== intent.amountPaise ||
      payment.currency !== intent.currency
    )
      throw new PaymentError("invalid_provider");
    const event = {
      ...order,
      accountId: this.accountId,
      paymentId: payment.id,
      outcome: "captured" as const,
    };
    return {
      ...event,
      eventId: `reconcile_${payment.id}`,
      digest: createHash("sha256").update(JSON.stringify(event)).digest("hex"),
    };
  }

  async verifyWebhook(
    raw: Uint8Array,
    signature: string,
    eventId: string,
  ): Promise<VerifiedPaymentEvent> {
    if (
      !raw.byteLength ||
      raw.byteLength > 262144 ||
      !/^[a-fA-F0-9]{64}$/.test(signature) ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(eventId)
    )
      throw new PaymentError("invalid_provider");
    const expected = createHmac("sha256", this.configuration.webhookSecret).update(raw).digest();
    const supplied = Buffer.from(signature, "hex");
    if (!timingSafeEqual(expected, supplied)) throw new PaymentError("invalid_provider");
    const envelope = z
      .object({
        entity: z.literal("event"),
        account_id: identifier("acc"),
        event: z.enum(["payment.captured", "payment.failed"]),
        payload: z.object({
          payment: z.object({
            entity: z.object({
              entity: z.literal("payment"),
              id: identifier("pay"),
              order_id: identifier("order"),
              amount: paise,
              currency: z.literal("INR"),
              status: z.enum(["captured", "failed"]),
              captured: z.boolean(),
            }),
          }),
        }),
      })
      .parse(JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(raw)));
    const payment = envelope.payload.payment.entity;
    const captured = envelope.event === "payment.captured";
    if (
      envelope.account_id !== this.accountId ||
      payment.status !== (captured ? "captured" : "failed") ||
      payment.captured !== captured
    )
      throw new PaymentError("invalid_provider");
    // Payment webhooks omit receipt. Retrieve the order under configured account credentials before trusting its reference.
    const order = normalize(await this.request(`orders/${payment.order_id}`));
    if (
      order.id !== payment.order_id ||
      order.amountPaise !== payment.amount ||
      order.currency !== payment.currency
    )
      throw new PaymentError("invalid_provider");
    return {
      ...order,
      eventId,
      digest: createHash("sha256").update(raw).digest("hex"),
      accountId: this.accountId,
      paymentId: payment.id,
      outcome: captured ? "captured" : "failed",
    };
  }
}
