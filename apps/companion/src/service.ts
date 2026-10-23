import { createService } from "@kandamkulathi/server";
import { registerChannelRoutes } from "./channels";
import type { WhatsAppDependencies } from "./channels/whatsapp";
import { type KnowledgeDependencies, registerKnowledgeRoutes } from "./knowledge/service";

export type CompanionDependencies = Readonly<{
  knowledge?: KnowledgeDependencies;
  whatsapp?: WhatsAppDependencies;
}>;

/** Composition is trusted server code, never request-selected repositories or authority. */
export function createCompanionApi(dependencies: CompanionDependencies = {}) {
  return createService("companion", undefined, {
    registerRoutes: (app) => {
      registerKnowledgeRoutes(app, dependencies.knowledge);
      registerChannelRoutes(app, dependencies.whatsapp);
    },
  });
}
