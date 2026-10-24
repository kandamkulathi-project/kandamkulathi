import { CommerceError } from "../../contracts/src/commerce-catalogue.ts";

/** Technical safety envelope, not a cancellation/refund/fee policy. Even failed intents
 * may have provider-side uncertainty: this foundation refuses every existing intent. */
export function assertUnpaidOrderCancellation(input: {
  status: string;
  version: number;
  expectedVersion: number;
  hasPaymentIntent: boolean;
}): void {
  if (input.status !== "reserved" || input.hasPaymentIntent)
    throw new CommerceError("operation_conflict");
  if (input.version !== input.expectedVersion) throw new CommerceError("stale_version");
}
