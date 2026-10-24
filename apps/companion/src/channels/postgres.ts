import type { DurableChannelInbox } from "@kandamkulathi/contracts/channels";
import { postgresChannelInbox } from "@kandamkulathi/database/channels";
import { withDatabase } from "@kandamkulathi/database/client";
import { platformConfig } from "@kandamkulathi/server/config";

/** Construct only from Worker bindings; the connection opens after signature/body validation. */
export function channelInboxFromBindings(bindings: unknown): DurableChannelInbox | undefined {
  if (!bindings || typeof bindings !== "object") return undefined;
  const values = bindings as Record<string, unknown>;
  const config = platformConfig(values);
  if (!config.DATABASE_URL) return undefined;
  const url = config.DATABASE_URL;
  const proxy =
    typeof values.LOCAL_DATABASE_PROXY === "string" ? values.LOCAL_DATABASE_PROXY : undefined;
  return {
    commitBatch: (receipts) =>
      withDatabase(
        url,
        config.APP_ENV,
        "k_core_runtime",
        (context) => postgresChannelInbox(context).commitBatch(receipts),
        proxy,
        config.RESOURCE_NAMESPACE,
      ),
  };
}
