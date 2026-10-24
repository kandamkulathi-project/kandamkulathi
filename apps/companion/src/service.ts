import { createService } from "@kandamkulathi/server";
import { registerChannelRoutes } from "./channels";
import type { WhatsAppDependencies } from "./channels/whatsapp";
import { registerKnowledgeAuthoringRoutes } from "./knowledge/authoring";
import { registerKnowledgeRuntimeRoutes } from "./knowledge/runtime";
import { type KnowledgeDependencies, registerKnowledgeRoutes } from "./knowledge/service";
import { knowledgeAuthoringRuntimeFromBindings, knowledgeRuntimeFromBindings } from "./runtime";

export type CompanionDependencies = Readonly<{
  knowledge?: KnowledgeDependencies;
  whatsapp?: WhatsAppDependencies;
}>;

/** Composition is trusted server code, never request-selected repositories or authority. */
export function createCompanionApi(dependencies: CompanionDependencies = {}) {
  return createService("companion", undefined, {
    registerRoutes: (app) => {
      if (dependencies.knowledge) registerKnowledgeRoutes(app, dependencies.knowledge);
      else {
        registerKnowledgeRuntimeRoutes(app, knowledgeRuntimeFromBindings);
        registerKnowledgeAuthoringRoutes(app, knowledgeAuthoringRuntimeFromBindings);
      }
      registerChannelRoutes(app, dependencies.whatsapp);
    },
  });
}
