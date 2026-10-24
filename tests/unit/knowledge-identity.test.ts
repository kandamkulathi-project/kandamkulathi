import { describe, expect, it } from "vitest";
import {
  knowledgeContentSchema,
  knowledgeHashSchema,
  knowledgeIdSchema,
  knowledgeProductSchema,
  knowledgeRecordSchema,
  knowledgeReferenceSchema,
} from "../../packages/contracts/src/knowledge";
import {
  authorizePublicKnowledge,
  hashKnowledgeContent,
  projectPublicKnowledge,
  referenceOf,
} from "../../packages/domain/src/knowledge/index";
import { knowledgeFixture, resealSynthetic, syntheticTime } from "./knowledge.fixtures";

const lowerId = "abcdef01-2345-4678-8abc-abcdef123456";
const upperId = lowerId.toUpperCase();

describe("canonical knowledge identity and hash boundaries", () => {
  it("normalizes all UUID-bearing schemas before comparisons and hashing while rejecting uppercase hashes", async () => {
    const fixture = await knowledgeFixture();
    expect(knowledgeIdSchema.parse(upperId)).toBe(lowerId);
    for (const field of ["entryId", "editorId", "productId"] as const)
      expect(
        knowledgeContentSchema.parse({ ...fixture.monograph.content, [field]: upperId })[field],
      ).toBe(lowerId);
    const provenance = knowledgeContentSchema.parse({
      ...fixture.monograph.content,
      sources: fixture.monograph.content.sources.map((source) => ({
        ...source,
        sourceId: upperId,
      })),
      citations: fixture.monograph.content.citations.map((citation) => ({
        ...citation,
        sourceId: upperId,
      })),
    });
    expect(provenance.sources[0]?.sourceId).toBe(lowerId);
    expect(provenance.citations[0]?.sourceId).toBe(lowerId);
    expect(
      knowledgeContentSchema.safeParse({
        ...provenance,
        sources: [
          ...provenance.sources,
          ...provenance.sources.map((source) => ({ ...source, sourceId: upperId })),
        ],
      }).success,
    ).toBe(false);
    for (const field of ["approverId", "evidenceId"] as const) {
      const record = knowledgeRecordSchema.parse({
        ...fixture.monograph,
        approval: { ...fixture.monograph.approval, [field]: upperId },
      });
      if (record.state !== "approved") throw new Error("Expected synthetic approved record");
      expect(record.approval[field]).toBe(lowerId);
    }
    for (const field of ["actorId", "evidenceId"] as const) {
      const record = knowledgeRecordSchema.parse({
        ...fixture.monograph,
        state: "withdrawn",
        withdrawal: {
          actorId: lowerId,
          evidenceId: lowerId,
          withdrawnAt: syntheticTime,
          [field]: upperId,
        },
      });
      if (record.state !== "withdrawn") throw new Error("Expected synthetic withdrawn record");
      expect(record.withdrawal[field]).toBe(lowerId);
    }
    expect(knowledgeProductSchema.parse({ ...fixture.product, productId: upperId }).productId).toBe(
      lowerId,
    );
    expect(
      knowledgeProductSchema.parse({
        ...fixture.product,
        knowledge: {
          ...fixture.product.knowledge,
          en: {
            ...fixture.product.knowledge.en,
            monograph: { ...referenceOf(fixture.monograph), entryId: upperId },
          },
        },
      }).knowledge.en.monograph?.entryId,
    ).toBe(lowerId);
    expect(
      knowledgeReferenceSchema.parse({ ...referenceOf(fixture.monograph), entryId: upperId })
        .entryId,
    ).toBe(lowerId);
    expect(knowledgeHashSchema.safeParse(fixture.monograph.contentHash.toUpperCase()).success).toBe(
      false,
    );
    expect(
      knowledgeContentSchema.safeParse({
        ...fixture.monograph.content,
        sources: fixture.monograph.content.sources.map((source) => ({
          ...source,
          sha256: source.sha256.toUpperCase(),
        })),
      }).success,
    ).toBe(false);
    expect(knowledgeRecordSchema.parse(fixture.monograph)).toEqual(fixture.monograph);
    expect(await hashKnowledgeContent(fixture.monograph.content)).toBe(
      fixture.monograph.contentHash,
    );
    expect(await hashKnowledgeContent({ ...fixture.monograph.content, editorId: upperId })).toBe(
      await hashKnowledgeContent({ ...fixture.monograph.content, editorId: lowerId }),
    );
    expect(
      await hashKnowledgeContent({
        ...provenance,
        sources: provenance.sources.map((source) => ({ ...source, sourceId: upperId })),
        citations: provenance.citations.map((citation) => ({ ...citation, sourceId: upperId })),
      }),
    ).toBe(await hashKnowledgeContent(provenance));
  });

  it("passes canonical references through primary lookup and fences for UUID aliases without rewriting hashes", async () => {
    const fixture = await knowledgeFixture();
    const editorId = "fedcba98-7654-4321-8abc-abcdef123456";
    const monograph = await resealSynthetic({
      ...fixture.monograph,
      content: { ...fixture.monograph.content, entryId: lowerId, editorId },
    });
    fixture.entries.delete(fixture.monograph.content.entryId);
    fixture.entries.set(lowerId, monograph);
    fixture.product.knowledge.en.monograph = referenceOf(monograph);
    fixture.request.candidates = [
      { ...referenceOf(monograph), entryId: upperId, origin: "vector" },
    ];
    fixture.read.loadEntry.mockResolvedValue({
      ...monograph,
      content: { ...monograph.content, entryId: upperId, editorId: editorId.toUpperCase() },
    });
    const result = await authorizePublicKnowledge(
      fixture.request,
      fixture.repository,
      fixture.authority,
    );
    expect(result.status).toBe("ready");
    expect(fixture.read.loadEntry).toHaveBeenCalledWith(lowerId);
    const fence = fixture.read.confirmCurrent.mock.calls[0]?.[0];
    expect(fence?.entries[0]).toEqual(monograph);
    expect(fence?.product).toEqual(fixture.product);
    if (result.status !== "ready") throw new Error("Expected synthetic canonical result");
    expect(result.blocks[0]?.reference).toEqual(referenceOf(monograph));
    expect(
      await projectPublicKnowledge(
        { ...referenceOf(monograph), entryId: upperId },
        fixture.repository,
        fixture.authority,
      ),
    ).toMatchObject({ status: "projected", reference: referenceOf(monograph) });
    fixture.read.loadEntry.mockClear();
    for (const badReference of [
      { ...referenceOf(monograph), entryId: "not-a-uuid" },
      { ...referenceOf(monograph), contentHash: monograph.contentHash.toUpperCase() },
    ]) {
      expect(
        await authorizePublicKnowledge(
          { ...fixture.request, candidates: [{ ...badReference, origin: "vector" }] },
          fixture.repository,
          fixture.authority,
        ),
      ).toEqual({ status: "blocked", reason: "INVALID_REQUEST" });
      expect(
        await projectPublicKnowledge(badReference, fixture.repository, fixture.authority),
      ).toEqual({ status: "blocked", reason: "INVALID_REQUEST" });
    }
    expect(fixture.read.loadEntry).not.toHaveBeenCalled();
  });
});
