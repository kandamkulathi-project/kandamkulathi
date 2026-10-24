import { platformConfig } from "@kandamkulathi/server/config";
import type { PaymentProvider } from "../../../packages/domain/src/commerce-payments";
import { RazorpayAdapter } from "../../../packages/providers/src/razorpay";

/** Trusted operator bindings only. This P1 adapter supports explicitly approved test accounts. */
export function configuredCommercePaymentProvider(
  bindings: Record<string, unknown>,
): PaymentProvider | undefined {
  try {
    const config = platformConfig(bindings);
    if (config.PROVIDER_MODE !== "sandbox" || bindings.RAZORPAY_CONFIGURATION_APPROVED !== "true")
      return undefined;
    const text = (name: string) =>
      typeof bindings[name] === "string" ? (bindings[name] as string) : "";
    return new RazorpayAdapter({
      accountId: text("RAZORPAY_ACCOUNT_ID"),
      keyId: text("RAZORPAY_KEY_ID"),
      keySecret: text("RAZORPAY_KEY_SECRET"),
      webhookSecret: text("RAZORPAY_WEBHOOK_SECRET"),
    });
  } catch {
    // Missing/malformed provider configuration must not break public catalogue reads.
    return undefined;
  }
}
