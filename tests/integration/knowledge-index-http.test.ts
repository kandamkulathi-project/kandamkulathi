import { describe, expect, it, vi } from "vitest";
import { registerKnowledgeIndexRoutes } from "../../apps/core-api/src/knowledge-index";
import { authorizePublicKnowledge } from "../../packages/domain/src/knowledge/index";
import { createKnowledgeIndexProvider } from "../../packages/providers/src/knowledge-index";
import { createService } from "../../packages/server/src/index";
import { knowledgeFixture } from "../unit/knowledge.fixtures";

describe("knowledge index actual HTTP consumer with independent primary safety fence", () => {
  async function setup(configured = true) {
    const fixture = await knowledgeFixture();
    const exact = vi.fn(async () => [
      {
        productId: fixture.product.productId,
        entryId: fixture.monograph.content.entryId,
        revision: fixture.monograph.content.revision,
        contentHash: fixture.monograph.contentHash,
        origin: "exact" as const,
      },
    ]);
    const provider = createKnowledgeIndexProvider({ namespace: "synthetic-index" });
    const app = createService("core-api", undefined, {
      registerRoutes: (app) =>
        registerKnowledgeIndexRoutes(app, () =>
          configured
            ? {
                exact,
                provider,
                withDatabase: async () => {
                  throw new Error("No semantic source configured");
                },
                publicProduct: (input) =>
                  authorizePublicKnowledge(input, fixture.repository, fixture.authority),
              }
            : undefined,
        ),
    });
    const send = (input: unknown) =>
      app.request(
        "http://localhost/v1/knowledge/search",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        { APP_ENV: "local" },
      );
    return { fixture, send, exact };
  }
  it("serves exact approved public text and independent safety blocks", async () => {
    const { send } = await setup();
    const response = await send({ term: "synthetic", language: "en" });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.products[0].blocks).toHaveLength(4);
  });
  it("withdrawn primary, missing safety and revoked approval cannot be bypassed by exact hints", async () => {
    const { fixture, send } = await setup();
    const safety = fixture.product.knowledge.en.safety;
    if (!safety) throw new Error("Synthetic safety missing");
    fixture.entries.delete(safety.entryId);
    expect((await (await send({ term: "synthetic", language: "en" })).json()).products).toEqual([]);
    fixture.authority.isApprovalCurrent = async () => false;
    expect((await (await send({ term: "synthetic", language: "en" })).json()).products).toEqual([]);
  });
  it("rejects invalid/private prompt fields and exposes truthful missing configuration/provider", async () => {
    const { send, exact } = await setup();
    expect((await send({ term: "x", language: "en", patientPrompt: "private" })).status).toBe(400);
    expect(exact).not.toHaveBeenCalled();
    expect(
      (
        await send({
          term: "x",
          language: "en",
          semanticReference: (await knowledgeFixture()).request.candidates[0],
        })
      ).status,
    ).toBe(400);
    expect((await (await setup(false)).send({ term: "x", language: "en" })).status).toBe(503);
  });
});
