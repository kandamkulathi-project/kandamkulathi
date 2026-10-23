import { whatsappWebhookPath } from "@kandamkulathi/contracts/channels";
import { createService, type ServiceApp } from "@kandamkulathi/server";
import {
  handleWhatsAppWebhook,
  type WhatsAppDependencies,
  whatsappConfigFromBindings,
} from "./whatsapp";

export function registerChannelRoutes(
  app: ServiceApp,
  dependencies: WhatsAppDependencies = {},
): void {
  app.all(whatsappWebhookPath, (context) =>
    handleWhatsAppWebhook(
      context.req.raw,
      {
        ...dependencies,
        config: dependencies.config ?? whatsappConfigFromBindings(context.env),
      },
      context.get("requestId"),
    ),
  );
}

/** No default receipt repository: production stays unavailable until a reviewed durable adapter exists. */
export function createCompanionService(dependencies: WhatsAppDependencies = {}) {
  return createService("companion", undefined, {
    registerRoutes: (app) => registerChannelRoutes(app, dependencies),
  });
}
