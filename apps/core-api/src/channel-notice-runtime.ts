import { platformConfig, requireProviderPermission } from "@kandamkulathi/server/config";
import { canonicalUuidSchema } from "../../../packages/contracts/src/identifiers.ts";
import { channelNoticeHandler } from "../../../packages/database/src/channel-notices.ts";
import type { ExternalHandler } from "../../../packages/database/src/outbox-external.ts";
import { whatsappNoticeProvider } from "../../../packages/providers/src/whatsapp-notice.ts";

/** Server bindings only. Missing approval/provider configuration is unavailable, never a noop send. */
export function configuredChannelNoticeHandler(env: Record<string, unknown>): ExternalHandler {
  try {
    const config = platformConfig(env);
    requireProviderPermission(config, "send");
    const capability = canonicalUuidSchema.safeParse(env.CHANNEL_NOTICE_CAPABILITY_ID);
    if (
      !capability.success ||
      config.PROVIDER_MODE === "stub" ||
      typeof env.WHATSAPP_NOTICE_ACCESS_TOKEN !== "string" ||
      !env.WHATSAPP_NOTICE_ACCESS_TOKEN ||
      typeof env.WHATSAPP_GRAPH_VERSION !== "string"
    )
      throw new Error("Approved notice configuration unavailable.");
    return channelNoticeHandler(
      capability.data,
      whatsappNoticeProvider({
        accessToken: env.WHATSAPP_NOTICE_ACCESS_TOKEN,
        graphVersion: env.WHATSAPP_GRAPH_VERSION,
      }),
    );
  } catch {
    // Missing/denied send configuration must not starve the separate durable human route.
    return channelNoticeHandler();
  }
}
