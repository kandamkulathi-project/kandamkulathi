import type { PublicKnowledgeResult } from "@kandamkulathi/contracts/knowledge";
import {
  authorizePublicKnowledge,
  type KnowledgeAuthority,
  type TrustedKnowledgeRepository,
} from "@kandamkulathi/domain/knowledge";
import { createService, type ServiceApp } from "@kandamkulathi/server";

export type KnowledgeDependencies = Readonly<{
  repository: TrustedKnowledgeRepository;
  authority: KnowledgeAuthority;
}>;

export function createKnowledgeService(dependencies?: KnowledgeDependencies) {
  return {
    async publicProduct(input: unknown): Promise<PublicKnowledgeResult> {
      if (!dependencies) return { status: "not-ready", reason: "NOT_CONFIGURED" };
      return authorizePublicKnowledge(input, dependencies.repository, dependencies.authority);
    },
  };
}

export function registerKnowledgeRoutes(
  app: ServiceApp,
  dependencies?: KnowledgeDependencies,
): void {
  const service = createKnowledgeService(dependencies);
  app.post("/v1/knowledge/public-product", async (context) => {
    if (
      context.req.header("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase() !==
      "application/json"
    )
      return context.json({ status: "blocked", reason: "INVALID_REQUEST" }, 400);
    let input: unknown;
    try {
      input = await context.req.json();
    } catch {
      return context.json({ status: "blocked", reason: "INVALID_REQUEST" }, 400);
    }
    const result = await service.publicProduct(input);
    const status =
      result.status === "ready"
        ? 200
        : result.status === "not-ready"
          ? 503
          : result.reason === "INVALID_REQUEST"
            ? 400
            : 409;
    return context.json(result, status);
  });
  // Never collect intake, diagnose, classify red flags or invent a handoff policy.
  app.post("/v1/knowledge/personalized", (context) =>
    context.json({ status: "blocked", reason: "PERSONALIZED_POLICY_UNAVAILABLE" }, 503),
  );
}

/** Trusted composition root only. HTTP payloads/headers cannot provide dependencies or authority. */
export function createCompanion(dependencies?: KnowledgeDependencies) {
  return createService("companion", undefined, {
    registerRoutes: (app) => registerKnowledgeRoutes(app, dependencies),
  });
}
