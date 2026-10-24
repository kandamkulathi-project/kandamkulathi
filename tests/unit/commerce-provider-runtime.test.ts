import { describe, expect, it } from "vitest";
import { configuredCommercePaymentProvider } from "../../apps/core-api/src/commerce-provider";

const synthetic = {
  APP_ENV: "local",
  PROVIDER_MODE: "sandbox",
  RAZORPAY_CONFIGURATION_APPROVED: "true",
  RAZORPAY_ACCOUNT_ID: "acc_synthetic",
  RAZORPAY_KEY_ID: "rzp_test_synthetic",
  RAZORPAY_KEY_SECRET: "synthetic-provider-fixture-not-a-credential",
  RAZORPAY_WEBHOOK_SECRET: "synthetic-webhook-fixture-not-a-credential",
};

describe("configured commerce payment provider", () => {
  it("constructs an explicitly approved test account without contacting a provider", () => {
    expect(configuredCommercePaymentProvider(synthetic)?.accountId).toBe("acc_synthetic");
  });

  it.each([
    {},
    { RAZORPAY_CONFIGURATION_APPROVED: "false" },
    { RAZORPAY_CONFIGURATION_APPROVED: true },
    { RAZORPAY_CONFIGURATION_APPROVED: undefined },
    { RAZORPAY_KEY_SECRET: "" },
    { RAZORPAY_WEBHOOK_SECRET: "" },
    { RAZORPAY_KEY_ID: "rzp_live_synthetic" },
    { RAZORPAY_ACCOUNT_ID: "unbound" },
    { PROVIDER_MODE: "stub" },
    { PROVIDER_MODE: "live", ALLOW_LIVE_PAYMENTS: "true" },
    { APP_ENV: "preview", RESOURCE_NAMESPACE: "kandamkulathi-production" },
  ])("leaves absent, unapproved and incompatible configuration unavailable: %j", (overrides) => {
    const bindings = Object.keys(overrides).length === 0 ? {} : { ...synthetic, ...overrides };
    expect(configuredCommercePaymentProvider(bindings)).toBeUndefined();
  });
});
