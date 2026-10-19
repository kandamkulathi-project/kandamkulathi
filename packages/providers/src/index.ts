export type ProviderName =
  | "workos"
  | "razorpay"
  | "shiprocket"
  | "openai"
  | "whatsapp"
  | "notifications"
  | "video";
export type ProviderAvailability = { available: false; reason: "NOT_IMPLEMENTED" };
/** Availability is explicit; credentials alone never make an unimplemented adapter ready. */
export function providerAvailability(_provider: ProviderName): ProviderAvailability {
  return { available: false, reason: "NOT_IMPLEMENTED" };
}
