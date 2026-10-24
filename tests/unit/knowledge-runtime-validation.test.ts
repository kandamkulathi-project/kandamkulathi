import { describe, expect, it } from "vitest";
import {
  knowledgeContentSchema,
  publicKnowledgeResultSchema,
} from "../../packages/contracts/src/knowledge";
import { authorizePublicKnowledge } from "../../packages/domain/src/knowledge/index";
import { knowledgeFixture } from "./knowledge.fixtures";

describe("knowledge public-source and response regressions", () => {
  it.each([
    "https://localhost/source",
    "https://a.localhost/source",
    "https://clinic.internal/source",
    "https://clinic.local/source",
    "https://127.0.0.1/source",
    "https://127.1/source",
    "https://2130706433/source",
    "https://0x7f000001/source",
    "https://10.0.0.1/source",
    "https://169.254.169.254/source",
    "https://[::1]/source",
    "https://[fc00::1]/source",
    "https://[::ffff:127.0.0.1]/source",
    "https://clinic/source",
    "https://user:pass@clinic.com/source",
    "https://clinic.com:8443/source",
    "https://clinic.com/source?token=x",
    "http://clinic.com/source",
  ])("rejects nonpublic or credential-bearing lexical URL %s", async (url) => {
    const fixture = await knowledgeFixture();
    const content = structuredClone(fixture.monograph.content);
    content.sources = content.sources.map((source) => ({ ...source, publicUrl: url }));
    content.citations = content.citations.map((citation) => ({ ...citation, publicUrl: url }));
    expect(knowledgeContentSchema.safeParse(content).success).toBe(false);
  });
  it("preserves exact primary/safety blocks and rejects tampered response bindings", async () => {
    const fixture = await knowledgeFixture();
    const result = await authorizePublicKnowledge(
      fixture.request,
      fixture.repository,
      fixture.authority,
    );
    expect(publicKnowledgeResultSchema.safeParse(result).success).toBe(true);
    if (result.status !== "ready") throw new Error("Fixture not ready");
    const tampered = {
      ...result,
      blocks: result.blocks.map((block, index) =>
        index === 0
          ? { ...block, approval: { ...block.approval, contentHash: "0".repeat(64) } }
          : block,
      ),
    };
    expect(publicKnowledgeResultSchema.safeParse(tampered).success).toBe(false);
    expect(
      publicKnowledgeResultSchema.safeParse({ ...result, blocks: result.blocks.slice(0, 3) })
        .success,
    ).toBe(false);
    expect(
      publicKnowledgeResultSchema.safeParse({
        ...result,
        blocks: [result.blocks[0], result.blocks[0], ...result.blocks.slice(2)],
      }).success,
    ).toBe(false);
    expect(
      publicKnowledgeResultSchema.safeParse({
        status: "blocked",
        reason: "NOT_APPROVED",
        blocks: result.blocks,
      }).success,
    ).toBe(false);
  });
});
