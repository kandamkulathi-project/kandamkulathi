import { whatsappWebhookPath } from "@kandamkulathi/contracts/channels";
import { createService, type ServiceApp } from "@kandamkulathi/server";
import { channelInboxFromBindings } from "./postgres";
import {
  handleWhatsAppWebhook,
  type WhatsAppDependencies,
  whatsappConfigFromBindings,
} from "./whatsapp";

export function registerChannelRoutes(
  app: ServiceApp,
  dependencies: WhatsAppDependencies = {},
): void {
  app.all(whatsappWebhookPath, (context) => {
    const inbox = dependencies.inbox ?? channelInboxFromBindings(context.env);
    return handleWhatsAppWebhook(
      context.req.raw,
      {
        ...dependencies,
        config: dependencies.config ?? whatsappConfigFromBindings(context.env),
        ...(inbox ? { inbox } : {}),
      },
      context.get("requestId"),
    );
  });
}

/** Unconfigured environments remain unavailable; configured ingress uses real PostgreSQL. */
export function createCompanionService(dependencies: WhatsAppDependencies = {}) {
  return createService("companion", undefined, {
    registerRoutes: (app) => registerChannelRoutes(app, dependencies),
  });
}
