import { describe, expect, it } from "vitest";
import {
  type ApprovedKnowledge,
  type KnowledgeContent,
  mandatorySafetyKinds,
} from "../../packages/contracts/src/knowledge";
import {
  authorizePublicKnowledge,
  reconcilePublishedKnowledge,
  referenceOf,
  sha256,
} from "../../packages/domain/src/knowledge/index";
import { knowledgeFixture, knowledgeId, resealSynthetic } from "./knowledge.fixtures";

async function mixedCaseSafetyFixture() {
  const fixture = await knowledgeFixture();
  const canonical: ApprovedKnowledge[] = [];
  for (const [index, kind] of mandatorySafetyKinds.entries()) {
    const reference = fixture.product.knowledge.en[kind];
    const original = reference && fixture.entries.get(reference.entryId);
    if (original?.state !== "approved") throw new Error("Expected synthetic safety record");
    const record = await resealSynthetic({
      ...original,
      content: { ...original.content, entryId: `abcdef0${index + 1}-2345-4678-8abc-abcdef123456` },
    });
    fixture.entries.delete(original.content.entryId);
    fixture.entries.set(record.content.entryId, record);
    fixture.product.knowledge.en[kind] = referenceOf(record);
    canonical.push(record);
  }
  const mixed = canonical.map((record) => ({
    ...record,
    content: {
      ...record.content,
      entryId: record.content.entryId.replace(/[a-f]/g, (letter, offset: number) =>
        offset % 2 === 0 ? letter.toUpperCase() : letter,
      ),
    },
  }));
  fixture.read.loadMandatoryBlocks.mockImplementation(async (_productId, language) =>
    language === "en" ? mixed : [],
  );
  return { ...fixture, canonical, mixed };
}

/** Historical version-1 encoding before UUID parsing: deliberately retains raw spelling. */
async function historicalRawHash(value: KnowledgeContent): Promise<string> {
  return sha256(
    new TextEncoder().encode(
      JSON.stringify([
        value.schemaVersion,
        value.entryId,
        value.revision,
        value.previousContentHash,
        value.visibility,
        value.scope,
        value.productId,
        value.language,
        value.kind,
        value.title,
        value.text,
        value.editorId,
        value.sources.map((source) => [
          source.sourceId,
          source.revision,
          source.sha256,
          source.visibility,
          source.publicUrl,
        ]),
        value.citations.map((citation) => [citation.sourceId, citation.title, citation.publicUrl]),
      ]),
    ),
  );
}

describe("canonical mandatory safety lookup hints", () => {
  it("authorizes mixed-case alphabetic safety UUIDs with canonical hashes and canonical final fences", async () => {
    const fixture = await mixedCaseSafetyFixture();
    const result = await authorizePublicKnowledge(
      fixture.request,
      fixture.repository,
      fixture.authority,
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Expected synthetic safety result");
    expect(result.blocks.slice(1).map((block) => block.reference)).toEqual(
      fixture.canonical.map(referenceOf),
    );
    expect(result.blocks.slice(1).map((block) => block.text)).toEqual(
      fixture.canonical.map((record) => record.content.text),
    );
    expect(fixture.read.confirmCurrent.mock.calls[0]?.[0].entries.slice(1)).toEqual(
      fixture.canonical,
    );
    expect(
      fixture.mixed.every(
        (record) => record.content.entryId !== record.content.entryId.toLowerCase(),
      ),
    ).toBe(true);
  });

  it("reconciles mixed-case alphabetic mandatory UUIDs without false coverage gaps", async () => {
    const fixture = await mixedCaseSafetyFixture();
    const result = await reconcilePublishedKnowledge(fixture.repository, fixture.authority);
    expect(result).toMatchObject({ status: "reconciled", coveredSlots: 4, gapSlots: 8 });
    if (result.status !== "reconciled") throw new Error("Expected synthetic coverage report");
    expect(
      result.rows
        .filter((row) => row.language === "en")
        .every((row) => row.outcome === "covered" && row.reason === null),
    ).toBe(true);
    expect(fixture.read.confirmCurrent.mock.calls[0]?.[0].entries.slice(1)).toEqual(
      fixture.canonical,
    );
  });

  it.each([
    "malformed-id",
    "malformed-record",
    "private",
    "forged-hash",
    "unauthorized-approval",
    "historical-hash",
  ] as const)(
    "still rejects %s safety after hint selection in authorization and coverage",
    async (condition) => {
      const fixture = await mixedCaseSafetyFixture();
      const record = fixture.mixed[0];
      if (!record) throw new Error("Expected mixed-case safety fixture");
      let hostile: unknown;
      if (condition === "malformed-id")
        hostile = { ...record, content: { ...record.content, entryId: "not-a-uuid" } };
      if (condition === "malformed-record")
        hostile = { ...record, content: { ...record.content, sources: [] } };
      if (condition === "private")
        hostile = { ...record, content: { ...record.content, visibility: "private" } };
      if (condition === "unauthorized-approval")
        hostile = { ...record, approval: { ...record.approval, approverId: knowledgeId(999) } };
      if (condition === "forged-hash" || condition === "historical-hash") {
        const contentHash =
          condition === "forged-hash" ? "f".repeat(64) : await historicalRawHash(record.content);
        expect(contentHash).not.toBe(record.contentHash);
        hostile = { ...record, contentHash, approval: { ...record.approval, contentHash } };
        fixture.product.knowledge.en.dosage = {
          ...referenceOf(record),
          entryId: record.content.entryId.toLowerCase(),
          contentHash,
        };
      }
      fixture.read.loadMandatoryBlocks.mockImplementation(async (_productId, language) =>
        language === "en" ? [hostile, ...fixture.mixed.slice(1)] : [],
      );
      const reason =
        condition === "malformed-id"
          ? "MISSING_PRIMARY"
          : condition === "unauthorized-approval"
            ? "APPROVER_UNAUTHORIZED"
            : "INVALID_PROVENANCE";
      expect(
        await authorizePublicKnowledge(fixture.request, fixture.repository, fixture.authority),
      ).toEqual({ status: "blocked", reason });
      const coverage = await reconcilePublishedKnowledge(fixture.repository, fixture.authority);
      expect(coverage).toMatchObject({ status: "reconciled", coveredSlots: 3, gapSlots: 9 });
      if (coverage.status !== "reconciled") throw new Error("Expected synthetic gap report");
      expect(
        coverage.rows.find((row) => row.language === "en" && row.kind === "dosage"),
      ).toMatchObject({ outcome: "gap", reason });
    },
  );
});
