import type { ServiceApp } from "@kandamkulathi/server";
import { z } from "zod";
import {
  knowledgeReferenceSchema,
  type PublicKnowledgeResult,
} from "../../../packages/contracts/src/knowledge.ts";
import { type DatabaseContext, inTransaction } from "../../../packages/database/src/client.ts";
import {
  currentKnowledgeProjection,
  knowledgeVectorId,
  prepareKnowledgeIndex,
} from "../../../packages/database/src/knowledge-index.ts";
import type { ClaimedJob } from "../../../packages/database/src/outbox.ts";
import {
  createKnowledgeIndexProvider,
  type KnowledgeIndexProviderOptions,
} from "../../../packages/providers/src/knowledge-index.ts";

/** Platform external-effect hook: invoke only after execution lease transaction commits.
 * Platform alone owns deadline, lease-token checkpoint, receipt, retry/deadletter and ACK.
 * This function must reject on uncertain/missing providers; it never ACKs or writes receipts.
 */
export function createKnowledgeIndexHandler(options: KnowledgeIndexProviderOptions) {
  const provider = createKnowledgeIndexProvider(options);
  return async (context: DatabaseContext, job: ClaimedJob, signal: AbortSignal): Promise<void> => {
    const step = async <T>(run: () => Promise<T>): Promise<T> => {
      signal.throwIfAborted();
      const result = await run();
      signal.throwIfAborted();
      return result;
    };
    signal.throwIfAborted();
    if (inTransaction(context.client))
      throw new Error("Knowledge provider cannot hold database locks.");
    const plan = await step(() => prepareKnowledgeIndex(context, job));
    await provider.remove(plan.obsoleteIds, signal);
    if (!plan.projection || !plan.vectorId) return;
    // Recheck after potentially slow deletion, before embeddings/upsert.
    const fresh = await step(() => currentKnowledgeProjection(context, plan.entryId));
    if (fresh.status === "not-ready") throw new Error("Knowledge primary unavailable.");
    if (
      fresh.status !== "projected" ||
      (await step(() => knowledgeVectorId(fresh.reference))) !== plan.vectorId
    )
      return;
    await provider.upsert(
      fresh,
      plan.vectorId,
      async () => {
        const current = await step(() => currentKnowledgeProjection(context, plan.entryId));
        if (current.status === "not-ready") throw new Error("Knowledge primary unavailable.");
        return (
          current.status === "projected" &&
          (await step(() => knowledgeVectorId(current.reference))) === plan.vectorId
        );
      },
      signal,
    );
    // Concurrent withdrawal/revision during network work cannot authorize this derived hit.
    // Best-effort removal is REQUIRED here; failure propagates to platform retry.
    const after = await step(() => currentKnowledgeProjection(context, plan.entryId));
    if (after.status === "not-ready") throw new Error("Knowledge primary unavailable.");
    if (
      after.status !== "projected" ||
      (await step(() => knowledgeVectorId(after.reference))) !== plan.vectorId
    )
      await provider.remove([plan.vectorId], signal);
    signal.throwIfAborted();
  };
}

const searchSchema = z.strictObject({
  term: z.string().trim().min(1).max(200),
  language: z.enum(["en", "ml", "ta"]),
  semanticReference: knowledgeReferenceSchema.optional(),
});
type SearchDependencies = {
  withDatabase: <T>(run: (context: DatabaseContext) => Promise<T>) => Promise<T>;
  provider: ReturnType<typeof createKnowledgeIndexProvider>;
  exact: (input: { term: string; language: "en" | "ml" | "ta" }) => Promise<
    {
      productId: string;
      entryId: string;
      revision: number;
      contentHash: string;
      origin: "exact" | "alias" | "keyword";
    }[]
  >;
  /** MUST be the existing authorizePublicKnowledge-backed runtime.publicProduct. */
  publicProduct: (input: unknown) => Promise<PublicKnowledgeResult>;
};
/** No free-text query reaches OpenAI. Vector mode requires a current approved public seed.
 * Exact and vector hints are never returned without independent primary + safety-block fences.
 */
export function registerKnowledgeIndexRoutes(
  app: ServiceApp,
  resolve: (bindings: unknown) => SearchDependencies | undefined,
) {
  app.post("/v1/knowledge/search", async (c) => {
    let input: z.infer<typeof searchSchema>;
    try {
      input = searchSchema.parse(await c.req.json());
    } catch {
      return c.json({ status: "blocked", reason: "INVALID_REQUEST" }, 400);
    }
    const dependencies = resolve(c.env);
    if (!dependencies) return c.json({ status: "not-ready", reason: "NOT_CONFIGURED" }, 503);
    try {
      const hints: {
        productId: string;
        entryId: string;
        revision: number;
        contentHash: string;
        origin: "exact" | "alias" | "keyword" | "vector";
      }[] = await dependencies.exact({ term: input.term, language: input.language });
      if (input.semanticReference) {
        const semanticReference = input.semanticReference;
        const projection = await dependencies.withDatabase((context) =>
          currentKnowledgeProjection(context, semanticReference.entryId),
        );
        if (projection.status === "not-ready")
          return c.json({ status: "not-ready", reason: "PRIMARY_UNAVAILABLE" }, 503);
        if (
          projection.status !== "projected" ||
          projection.language !== input.language ||
          (await knowledgeVectorId(projection.reference)) !==
            (await knowledgeVectorId(input.semanticReference))
        )
          return c.json({ status: "blocked", reason: "STALE_REFERENCE" }, 409);
        const candidates = await dependencies.provider.search(projection);
        for (const candidate of candidates) {
          const current = await dependencies.withDatabase((context) =>
            currentKnowledgeProjection(context, candidate.entryId),
          );
          if (current.status === "not-ready")
            return c.json({ status: "not-ready", reason: "PRIMARY_UNAVAILABLE" }, 503);
          if (
            current.status === "projected" &&
            current.productId &&
            current.kind === "monograph" &&
            current.language === input.language &&
            (await knowledgeVectorId(current.reference)) === (await knowledgeVectorId(candidate))
          )
            hints.push({ ...candidate, productId: current.productId, origin: "vector" });
        }
      }
      const products: PublicKnowledgeResult[] = [];
      const seen = new Set<string>();
      for (const hint of hints.slice(0, 40)) {
        if (seen.has(hint.productId)) continue;
        seen.add(hint.productId);
        const result = await dependencies.publicProduct({
          schemaVersion: 1,
          mode: "public-product",
          productId: hint.productId,
          language: input.language,
          candidates: [
            {
              entryId: hint.entryId,
              revision: hint.revision,
              contentHash: hint.contentHash,
              origin: hint.origin,
            },
          ],
        });
        if (result.status === "not-ready") return c.json(result, 503);
        if (result.status === "ready") products.push(result);
      }
      return c.json({ status: "ready", products });
    } catch {
      return c.json({ status: "not-ready", reason: "PRIMARY_UNAVAILABLE" }, 503);
    }
  });
}
