import { describe, expect, it, vi } from "vitest";
import { createKnowledgeIndexHandler } from "../../apps/core-api/src/knowledge-index";
import type { DatabaseContext } from "../../packages/database/src/client";
import { knowledgeVectorId } from "../../packages/database/src/knowledge-index";
import { projectPublicKnowledge } from "../../packages/domain/src/knowledge/index";
import {
  createKnowledgeIndexProvider,
  type KnowledgeVectorizeBinding,
} from "../../packages/providers/src/knowledge-index";
import type { TestFetch } from "../fixtures/fetch";
import { knowledgeFixture } from "./knowledge.fixtures";

const protocolEmbedding = () => ({
  object: "list",
  model: "text-embedding-3-small",
  data: [
    {
      object: "embedding",
      index: 0,
      embedding: Array.from({ length: 1536 }, (_, i) => (i === 0 ? 0.5 : 0)),
    },
  ],
  usage: { prompt_tokens: 1, total_tokens: 1 },
});
describe("knowledge index binding protocol (synthetic vectors only in tests)", () => {
  async function setup() {
    const fixture = await knowledgeFixture();
    const projection = await projectPublicKnowledge(
      {
        entryId: fixture.monograph.content.entryId,
        revision: fixture.monograph.content.revision,
        contentHash: fixture.monograph.contentHash,
      },
      fixture.repository,
      fixture.authority,
    );
    if (projection.status !== "projected") throw new Error("Fixture projection failed");
    const vectorize = {
      upsert: vi.fn<KnowledgeVectorizeBinding["upsert"]>(async () => ({
        mutationId: "synthetic-upsert",
      })),
      deleteByIds: vi.fn<KnowledgeVectorizeBinding["deleteByIds"]>(async () => ({
        mutationId: "synthetic-delete",
      })),
      query: vi.fn<KnowledgeVectorizeBinding["query"]>(async () => ({
        matches: [{ id: "untrusted", score: 0.9, metadata: { ...projection.reference } }],
      })),
    };
    const fetcher = vi.fn<TestFetch>(async () => Response.json(protocolEmbedding()));
    return {
      fixture,
      projection,
      vectorize,
      fetcher,
      provider: createKnowledgeIndexProvider({
        vectorize,
        apiKey: "synthetic-not-a-secret",
        namespace: "synthetic-index",
        fetch: fetcher,
      }),
    };
  }
  it("uses actual OpenAI protocol, reference metadata and Vectorize v2 mutation receipts", async () => {
    const { projection, vectorize, fetcher, provider } = await setup();
    const id = await knowledgeVectorId(projection.reference);
    await provider.upsert(projection, id, async () => true);
    const call = fetcher.mock.calls[0];
    if (!call) throw new Error("Embedding protocol not invoked");
    const [url, request] = call;
    expect(url).toBe("https://api.openai.com/v1/embeddings");
    expect(JSON.parse(request?.body as string)).toEqual({
      model: "text-embedding-3-small",
      dimensions: 1536,
      input: `${projection.title}\n${projection.text}`,
      encoding_format: "float",
    });
    expect(vectorize.upsert.mock.calls[0]?.[0]).toBeDefined();
    const serialized = JSON.stringify(vectorize.upsert.mock.calls);
    expect(serialized).toContain(projection.reference.contentHash);
    expect(serialized).not.toContain(projection.text);
    expect(await knowledgeVectorId({ ...projection.reference })).toBe(id);
    await provider.remove([id]);
    expect(vectorize.deleteByIds).toHaveBeenCalledWith([id]);
  });
  it("rechecks authorization after embeddings, never upserts revoked content", async () => {
    const { projection, vectorize, provider } = await setup();
    await provider.upsert(
      projection,
      await knowledgeVectorId(projection.reference),
      async () => false,
    );
    expect(vectorize.upsert).not.toHaveBeenCalled();
  });
  it("missing binding/key, provider errors, malformed/zero vectors and uncertain mutations reject", async () => {
    const { projection, vectorize, fetcher, provider } = await setup();
    const id = await knowledgeVectorId(projection.reference);
    await expect(
      createKnowledgeIndexProvider({ namespace: "synthetic-index" }).remove([]),
    ).rejects.toThrow("binding");
    await expect(
      createKnowledgeIndexProvider({ namespace: "synthetic-index", vectorize }).upsert(
        projection,
        id,
        async () => true,
      ),
    ).rejects.toThrow("binding");
    fetcher.mockResolvedValueOnce(new Response("provider private diagnostics", { status: 429 }));
    await expect(provider.upsert(projection, id, async () => true)).rejects.toThrow("unavailable");
    const bad = protocolEmbedding();
    bad.data[0]?.embedding.fill(0);
    fetcher.mockResolvedValueOnce(Response.json(bad));
    await expect(provider.upsert(projection, id, async () => true)).rejects.toThrow("Invalid");
    vectorize.upsert.mockRejectedValueOnce(new Error("uncertain network"));
    await expect(provider.upsert(projection, id, async () => true)).rejects.toThrow("uncertain");
  });
  it("semantic query contains only public-seed embedding and rejects invalid vector references", async () => {
    const { projection, vectorize, provider } = await setup();
    expect(await provider.search(projection)).toEqual([
      { ...projection.reference, origin: "vector" },
    ]);
    expect(vectorize.query).toHaveBeenCalledWith(expect.any(Array), {
      topK: 20,
      namespace: "synthetic-index",
      returnMetadata: "all",
      filter: { language: "en", kind: "monograph" },
    });
    vectorize.query.mockResolvedValueOnce({
      matches: [{ id: "forged", score: 0.9, metadata: { entryId: "bad" } }],
    });
    expect(await provider.search(projection)).toEqual([]);
  });
  it("pre-aborted external handler performs no DB step", async () => {
    const controller = new AbortController();
    controller.abort();
    const query = vi.fn();
    const context = { client: { query } } as unknown as DatabaseContext;
    const handler = createKnowledgeIndexHandler({ namespace: "synthetic-index" });
    await expect(
      handler(context, {} as Parameters<typeof handler>[1], controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(query).not.toHaveBeenCalled();
  });
  it("combines external abort with embedding timeout and never upserts an aborted embedding", async () => {
    const { projection, vectorize, fetcher, provider } = await setup();
    const controller = new AbortController();
    const id = await knowledgeVectorId(projection.reference);
    fetcher.mockImplementationOnce(async (_url, request) => {
      const combined = request?.signal;
      expect(combined).not.toBe(controller.signal);
      if (!combined) throw new Error("Missing combined signal");
      controller.abort();
      expect(combined.aborted).toBe(true);
      // Even a transport that returns after abort cannot authorize an upsert.
      return Response.json(protocolEmbedding());
    });
    await expect(
      provider.upsert(projection, id, async () => true, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(vectorize.upsert).not.toHaveBeenCalled();
  });
  it("aborting during a non-abortable upsert preserves uncertainty and rejects late success", async () => {
    const { projection, vectorize, provider } = await setup();
    const controller = new AbortController();
    let remoteEffectCompleted = false;
    let successContinuation = false;
    vectorize.upsert.mockImplementationOnce(async () => {
      controller.abort();
      await Promise.resolve();
      remoteEffectCompleted = true;
      return { mutationId: "synthetic-late-mutation" };
    });
    const work = provider
      .upsert(
        projection,
        await knowledgeVectorId(projection.reference),
        async () => true,
        controller.signal,
      )
      .then(() => {
        successContinuation = true;
      });
    await expect(work).rejects.toMatchObject({ name: "AbortError" });
    expect(remoteEffectCompleted).toBe(true);
    expect(successContinuation).toBe(false);
    // No false claim that abort rolled back Vectorize; IDs remain reserved in PostgreSQL.
    expect(vectorize.deleteByIds).not.toHaveBeenCalled();
  });
  it("post-delete abort prevents another non-abortable batch", async () => {
    const { vectorize, provider } = await setup();
    const controller = new AbortController();
    vectorize.deleteByIds.mockImplementationOnce(async () => {
      controller.abort();
      return { mutationId: "synthetic-late-delete" };
    });
    await expect(
      provider.remove(
        Array.from({ length: 1001 }, () => "synthetic-id"),
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(vectorize.deleteByIds).toHaveBeenCalledTimes(1);
  });
});
