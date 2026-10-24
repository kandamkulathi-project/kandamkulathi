import { browserCheckout } from "../../checkout";
import type { AuthoritativePayment, createAuthoritativeCommerceApi } from "./authoritative-api";
import type { Reply } from "./contracts";

export type BrowserPaymentApi = Pick<
  ReturnType<typeof createAuthoritativeCommerceApi>,
  "checkoutMetadata" | "readPayment"
>;
export type BrowserCheckoutPort = ReturnType<typeof browserCheckout>;
/** P1 sandbox bridge. The SDK callback/receipt is deliberately ignored: only the
 * existing intent's verified HTTP read can change displayed financial state. */
export function createBrowserPayment(
  api: BrowserPaymentApi,
  isCurrent: () => boolean,
  createCheckout: () => BrowserCheckoutPort = () => browserCheckout(true),
) {
  let disposed = false;
  let opening = false;
  let active: BrowserCheckoutPort | undefined;
  let controller: AbortController | undefined;
  const current = () => !disposed && isCurrent() && !controller?.signal.aborted;
  return {
    dispose() {
      disposed = true;
      controller?.abort();
      active?.dispose();
      active = undefined;
    },
    async launch(
      expected: AuthoritativePayment,
      signal: AbortSignal,
    ): Promise<Reply<AuthoritativePayment>> {
      if (disposed || opening || signal.aborted || !isCurrent()) return { status: "unavailable" };
      if (expected.state !== "ready") return { status: "unavailable" };
      opening = true;
      controller = new AbortController();
      const abort = () => {
        controller?.abort();
        active?.dispose();
      };
      signal.addEventListener("abort", abort, { once: true });
      try {
        const metadata = await api.checkoutMetadata(expected, controller.signal);
        if (!current()) return { status: "anonymous" };
        if (metadata.status !== "ready") return metadata;
        active = createCheckout();
        const value = metadata.data;
        try {
          await active.open(
            {
              key: value.keyId,
              order_id: value.providerOrderId,
              amount: value.amountPaise,
              currency: value.currency,
            },
            current,
          );
        } catch {
          // Dismissal, SDK failure and uncertain provider results all require a
          // server read. Never recreate the intent or mark a callback as paid.
        }
        if (!current()) return { status: "anonymous" };
        return await api.readPayment(expected, controller.signal);
      } catch {
        return { status: "error" };
      } finally {
        signal.removeEventListener("abort", abort);
        active?.dispose();
        active = undefined;
        opening = false;
      }
    },
  };
}
