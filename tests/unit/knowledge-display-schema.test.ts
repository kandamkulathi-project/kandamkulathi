import { describe, expect, it } from "vitest";
import {
  approvedKnowledgeBlockSchema,
  publicKnowledgeResultSchema,
} from "../../packages/contracts/src/knowledge";
import { authorizePublicKnowledge } from "../../packages/domain/src/knowledge/index";
import { knowledgeFixture } from "./knowledge.fixtures";

async function ready() {
  const fixture = await knowledgeFixture();
  const result = await authorizePublicKnowledge(
    fixture.request,
    fixture.repository,
    fixture.authority,
  );
  if (result.status !== "ready") throw new Error("Synthetic protocol fixture should be ready.");
  return structuredClone(result);
}
describe("strict approved knowledge display contracts", () => {
  it("accepts canonical separately approved monograph and mandatory safety blocks without rewriting text", async () => {
    const result = await ready();
    expect(publicKnowledgeResultSchema.parse(result)).toEqual(result);
    expect(result.blocks.map((block) => block.kind)).toEqual([
      "monograph",
      "dosage",
      "contraindication",
      "safety",
    ]);
  });
  it("rejects a mismatched approval hash or invalid approving identity", async () => {
    const result = await ready();
    const block = result.blocks[0];
    if (!block) throw new Error("Synthetic approved block fixture missing");
    expect(
      approvedKnowledgeBlockSchema.safeParse({
        ...block,
        approval: { ...block.approval, contentHash: "0".repeat(64) },
      }).success,
    ).toBe(false);
    expect(
      approvedKnowledgeBlockSchema.safeParse({
        ...block,
        approval: { ...block.approval, approverId: "unverified" },
      }).success,
    ).toBe(false);
  });
  it("rejects missing, duplicated, relabeled or mixed-language safety blocks", async () => {
    const result = await ready();
    expect(
      publicKnowledgeResultSchema.safeParse({ ...result, blocks: result.blocks.slice(0, 3) })
        .success,
    ).toBe(false);
    expect(
      publicKnowledgeResultSchema.safeParse({
        ...result,
        blocks: [result.blocks[0], result.blocks[1], result.blocks[2], result.blocks[2]],
      }).success,
    ).toBe(false);
    expect(
      publicKnowledgeResultSchema.safeParse({
        ...result,
        blocks: result.blocks.map((block, index) =>
          index === 3 ? { ...block, kind: "faq" } : block,
        ),
      }).success,
    ).toBe(false);
    expect(
      publicKnowledgeResultSchema.safeParse({
        ...result,
        blocks: result.blocks.map((block, index) =>
          index === 3 ? { ...block, language: "ml" } : block,
        ),
      }).success,
    ).toBe(false);
  });
  it("keeps blocked/not-ready responses distinct and rejects fabricated clinical summary fields", async () => {
    expect(
      publicKnowledgeResultSchema.safeParse({
        status: "blocked",
        reason: "SAFETY_BLOCKS_UNAVAILABLE",
      }).success,
    ).toBe(true);
    expect(
      publicKnowledgeResultSchema.safeParse({ status: "not-ready", reason: "NOT_CONFIGURED" })
        .success,
    ).toBe(true);
    expect(
      publicKnowledgeResultSchema.safeParse({ ...(await ready()), integratedSafety: "fabricated" })
        .success,
    ).toBe(false);
  });
});
