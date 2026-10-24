import { z } from "zod";
import {
  type KnowledgeReference,
  knowledgeCandidateSchema,
} from "../../contracts/src/knowledge.ts";
import type { PublicIndexProjection } from "../../domain/src/knowledge/index.ts";

/** Structural subset of the real Workers Vectorize v2 binding, not an HTTP imitation. */
export interface KnowledgeVectorizeBinding {
  upsert(
    vectors: {
      id: string;
      values: number[];
      namespace?: string;
      metadata?: Record<string, string | number | boolean>;
    }[],
  ): Promise<{ mutationId: string }>;
  deleteByIds(ids: string[]): Promise<{ mutationId: string }>;
  query(
    vector: number[],
    options: {
      topK: number;
      namespace: string;
      returnMetadata: "all";
      filter: Record<string, string>;
    },
  ): Promise<{ matches: { id: string; score: number; metadata?: Record<string, unknown> }[] }>;
}
export type KnowledgeIndexProviderOptions = {
  vectorize?: KnowledgeVectorizeBinding;
  apiKey?: string;
  namespace: string;
  /** Inject transport only for deterministic protocol tests. Runtime uses native fetch. */
  fetch?: typeof fetch;
};
const embeddingSchema = z.strictObject({
  object: z.literal("list"),
  data: z
    .array(
      z.object({
        object: z.literal("embedding"),
        index: z.literal(0),
        embedding: z.array(z.number().finite()).length(1536),
      }),
    )
    .length(1),
  model: z.literal("text-embedding-3-small"),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative(),
  }),
});
export function createKnowledgeIndexProvider(options: KnowledgeIndexProviderOptions) {
  const namespace = z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{1,62}$/)
    .parse(options.namespace);
  function binding() {
    if (!options.vectorize) throw new Error("Knowledge Vectorize binding unavailable.");
    return options.vectorize;
  }
  async function embed(projection: PublicIndexProjection, signal?: AbortSignal) {
    signal?.throwIfAborted();
    binding();
    if (!options.apiKey) throw new Error("Knowledge embeddings binding unavailable.");
    const timeout = AbortSignal.timeout(8000);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const response = await (options.fetch ?? fetch)("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { authorization: `Bearer ${options.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        dimensions: 1536,
        input: `${projection.title}\n${projection.text}`,
        encoding_format: "float",
      }),
      signal: requestSignal,
    });
    requestSignal.throwIfAborted();
    if (!response.ok) throw new Error("Knowledge embedding provider unavailable.");
    const parsed = embeddingSchema.parse(await response.json());
    requestSignal.throwIfAborted();
    const values = parsed.data[0]?.embedding;
    if (!values?.some((n) => n !== 0)) throw new Error("Invalid knowledge embedding.");
    return values;
  }
  function mutation(result: { mutationId: string }) {
    z.string().min(1).parse(result.mutationId);
  }
  return {
    async upsert(
      projection: PublicIndexProjection,
      id: string,
      authorize: () => Promise<boolean>,
      signal?: AbortSignal,
    ) {
      signal?.throwIfAborted();
      z.string()
        .regex(/^[a-f0-9]{64}$/)
        .parse(id);
      const values = await embed(projection, signal);
      signal?.throwIfAborted();
      const authorized = await authorize();
      signal?.throwIfAborted();
      if (!authorized) return;
      mutation(
        await binding().upsert([
          {
            id,
            values,
            namespace,
            metadata: {
              ...projection.reference,
              language: projection.language,
              kind: projection.kind,
              ...(projection.productId ? { productId: projection.productId } : {}),
            },
          },
        ]),
      );
      // Vectorize has no abort API: an aborted call may have changed remote state.
      // Do not turn that uncertainty into a successful platform checkpoint.
      signal?.throwIfAborted();
    },
    async remove(ids: string[], signal?: AbortSignal) {
      signal?.throwIfAborted();
      // Missing binding must fail even on a no-op plan, never report fake success.
      const vectorize = binding();
      for (let start = 0; start < ids.length; start += 1000) {
        signal?.throwIfAborted();
        mutation(await vectorize.deleteByIds(ids.slice(start, start + 1000)));
        signal?.throwIfAborted();
      }
    },
    /** Only an approved immutable PUBLIC reference may seed semantic search. No patient prompts. */
    async search(projection: PublicIndexProjection, signal?: AbortSignal) {
      signal?.throwIfAborted();
      const values = await embed(projection, signal);
      signal?.throwIfAborted();
      const result = await binding().query(values, {
        topK: 20,
        namespace,
        returnMetadata: "all",
        filter: { language: projection.language, kind: "monograph" },
      });
      signal?.throwIfAborted();
      const candidates: (KnowledgeReference & { origin: "vector" })[] = [];
      for (const match of result.matches.slice(0, 20)) {
        if (!Number.isFinite(match.score)) continue;
        const parsed = knowledgeCandidateSchema.safeParse({
          entryId: match.metadata?.entryId,
          revision: match.metadata?.revision,
          contentHash: match.metadata?.contentHash,
          origin: "vector",
        });
        if (parsed.success) candidates.push({ ...parsed.data, origin: "vector" });
      }
      return candidates;
    },
  };
}
