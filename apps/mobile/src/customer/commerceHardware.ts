import type { Checkout } from "@kandamkulathi/contracts/sensitive";
import { checkoutSchema } from "@kandamkulathi/contracts/sensitive";
import { commercePaymentCheckoutSchema } from "../../../../packages/contracts/src/commerce-checkout";
import {
  type CommercePaymentView,
  commercePaymentViewSchema,
} from "../../../../packages/contracts/src/commerce-http";
import type { createAuthoritativeCommerceApi } from "../../../workspaces/src/customer/commerce/authoritative-api";
import type { Reply } from "../../../workspaces/src/customer/commerce/contracts";

type CanonicalCommerceApi = ReturnType<typeof createAuthoritativeCommerceApi>;
export type NativeCommerceHardwareApi = Pick<
  CanonicalCommerceApi,
  "checkoutMetadata" | "readPayment" | "reconcilePayment"
>;
export type NativeCommerceHardwareStage = "metadata" | "opening" | "reconciling";
export interface NativeCommerceHardware {
  launch(
    payment: CommercePaymentView,
    signal: AbortSignal,
    current: () => boolean,
    stage: (value: NativeCommerceHardwareStage) => void,
  ): Promise<Reply<CommercePaymentView>>;
}
export type NativeCommerceHardwareOptions = {
  api: NativeCommerceHardwareApi;
  /** Parent binds the SAME existing nativeCheckout instance, retaining its global SDK lock. */
  open(input: Checkout, isCurrent: () => boolean): Promise<unknown>;
};

/** Bounds waiting without pretending that abort cancels a provider operation. The existing
 * nativeCheckout port retains the actual SDK lock until the real SDK settles. */
async function bounded<T>(
  signal: AbortSignal,
  milliseconds: number,
  action: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const abort = new AbortController();
  let cancel = () => {};
  const cancelled = new Promise<never>((_resolve, reject) => {
    cancel = () => {
      abort.abort();
      reject(Error("Reconciliation required"));
    };
  });
  signal.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, milliseconds);
  try {
    if (signal.aborted) cancel();
    return await Promise.race([
      cancelled,
      Promise.resolve().then(() => {
        if (abort.signal.aborted) throw Error("Inactive checkout lifetime");
        return action(abort.signal);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}
function samePayment(expected: CommercePaymentView, actual: CommercePaymentView) {
  return (
    actual.intentId === expected.intentId &&
    actual.operationId === expected.operationId &&
    actual.subject.kind === expected.subject.kind &&
    actual.subject.id === expected.subject.id &&
    actual.providerOrderId === expected.providerOrderId &&
    actual.amountPaise === expected.amountPaise &&
    actual.currency === expected.currency
  );
}

/** Explicit-button adapter only. No SDK callback payload is read, retained or trusted as money. */
export function createNativeCommerceHardware(
  options: NativeCommerceHardwareOptions,
): NativeCommerceHardware {
  let busy = false;
  return {
    async launch(raw, signal, current, stage) {
      const alive = () => !signal.aborted && current();
      if (!alive()) return { status: "error" };
      if (busy) return { status: "conflict" };
      busy = true;
      try {
        const payment = commercePaymentViewSchema.parse(raw);
        if (
          payment.state !== "ready" ||
          payment.subject.kind !== "order" ||
          !payment.providerOrderId
        )
          return { status: "conflict" };
        stage("metadata");
        const reply = await bounded(signal, 15000, (active) =>
          options.api.checkoutMetadata(payment, active),
        );
        if (!alive()) return { status: "error" };
        if (reply.status !== "ready") return reply;
        const metadata = commercePaymentCheckoutSchema.parse(reply.data);
        if (
          metadata.intentId !== payment.intentId ||
          metadata.operationId !== payment.operationId ||
          metadata.subject.kind !== payment.subject.kind ||
          metadata.subject.id !== payment.subject.id ||
          metadata.providerOrderId !== payment.providerOrderId ||
          metadata.amountPaise !== payment.amountPaise ||
          metadata.currency !== payment.currency
        )
          return { status: "error" };
        const input = checkoutSchema.parse({
          key: metadata.keyId,
          order_id: metadata.providerOrderId,
          amount: metadata.amountPaise,
          currency: metadata.currency,
        });
        if (!alive()) return { status: "error" };
        stage("opening");
        try {
          await bounded(signal, 5 * 60 * 1000, async () => {
            if (!alive()) throw Error("Inactive checkout lifetime");
            await options.open(input, alive); // discard success, cancel, error and unknown payloads alike
          });
        } catch {
          /* Cancellation, timeout and ambiguous replies all require authoritative state. */
        }
        if (!alive()) return { status: "error" };
        stage("reconciling");
        const read = await bounded(signal, 15000, (active) =>
          options.api.readPayment(payment, active),
        );
        if (!alive()) return { status: "error" };
        if (read.status !== "ready") return read;
        const observed = commercePaymentViewSchema.parse(read.data);
        if (!samePayment(payment, observed)) return { status: "error" };
        if (observed.state === "captured" || observed.state === "failed")
          return { status: "ready", data: observed };
        const reconciled = await bounded(signal, 15000, (active) =>
          options.api.reconcilePayment(payment, active),
        );
        if (!alive()) return { status: "error" };
        if (reconciled.status !== "ready") return reconciled;
        const result = commercePaymentViewSchema.parse(reconciled.data);
        return samePayment(payment, result)
          ? { status: "ready", data: result }
          : { status: "error" };
      } catch {
        return { status: "error" };
      } finally {
        busy = false;
      }
    },
  };
}
