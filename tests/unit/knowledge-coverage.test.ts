import { describe, expect, it } from "vitest";
import {
  authorizePublicKnowledge,
  projectPublicKnowledge,
  reconcilePublishedKnowledge,
  referenceOf,
} from "../../packages/domain/src/knowledge/index";
import {
  knowledgeFixture,
  knowledgeId,
  resealSynthetic,
  syntheticTime,
} from "./knowledge.fixtures";

describe("published inventory reconciliation and derived public indexing", () => {
  it("reconciles a complete synthetic EN/ML/TA inventory and renders only the requested exact locale", async () => {
    const fixture = await knowledgeFixture();
    for (const [offset, language] of [
      [100, "ml"],
      [200, "ta"],
    ] as const) {
      for (const [index, original] of [...fixture.entries.values()]
        .filter((record) => record.content.language === "en")
        .entries()) {
        if (original.state !== "approved")
          throw new Error("Expected synthetic approved protocol record");
        const entry = await resealSynthetic({
          ...original,
          content: {
            ...original.content,
            entryId: knowledgeId(offset + index),
            language,
            text: `SYNTHETIC ${language} protocol block; not reviewed medical translation.`,
          },
        });
        fixture.entries.set(entry.content.entryId, entry);
        const kind = entry.content.kind;
        if (
          kind !== "monograph" &&
          kind !== "dosage" &&
          kind !== "contraindication" &&
          kind !== "safety"
        )
          throw new Error("Expected product fixture kind");
        fixture.product.knowledge[language][kind] = referenceOf(entry);
      }
      const reference = fixture.product.knowledge[language].monograph;
      if (!reference) throw new Error("Expected synthetic monograph reference");
      const answer = await authorizePublicKnowledge(
        { ...fixture.request, language, candidates: [{ ...reference, origin: "vector" }] },
        fixture.repository,
        fixture.authority,
      );
      expect(answer.status).toBe("ready");
      if (answer.status !== "ready") throw new Error("Expected synthetic locale result");
      expect(
        answer.blocks.every(
          (block) => block.language === language && block.text.includes(`SYNTHETIC ${language}`),
        ),
      ).toBe(true);
    }
    expect(await reconcilePublishedKnowledge(fixture.repository, fixture.authority)).toMatchObject({
      status: "reconciled",
      publishedProducts: 1,
      expectedSlots: 12,
      coveredSlots: 12,
      gapSlots: 0,
    });
  });

  it("records every EN/ML/TA product slot including explicit translation gaps", async () => {
    const fixture = await knowledgeFixture();
    const result = await reconcilePublishedKnowledge(fixture.repository, fixture.authority);
    expect(result.status).toBe("reconciled");
    if (result.status !== "reconciled") throw new Error("Expected inventory report");
    expect(result).toMatchObject({
      publishedProducts: 1,
      expectedSlots: 12,
      coveredSlots: 4,
      gapSlots: 8,
    });
    expect(
      result.rows.filter((row) => row.language === "en").every((row) => row.outcome === "covered"),
    ).toBe(true);
    expect(
      result.rows
        .filter((row) => row.language !== "en")
        .every((row) => row.reason === "MISSING_REFERENCE"),
    ).toBe(true);
    expect(fixture.read.loadMandatoryBlocks).toHaveBeenCalledTimes(3);
    expect(fixture.read.confirmInventoryCurrent).toHaveBeenCalledTimes(1);
  });

  it("reports stale and withdrawn coverage, rather than treating catalogue presence as approval", async () => {
    const fixture = await knowledgeFixture();
    fixture.product.knowledge.en.monograph = { ...referenceOf(fixture.monograph), revision: 2 };
    const entry = fixture.entries.get(knowledgeId(11));
    if (entry?.state !== "approved") throw new Error("Expected synthetic fixture");
    fixture.entries.set(entry.content.entryId, {
      ...entry,
      state: "withdrawn",
      withdrawal: {
        actorId: knowledgeId(3),
        withdrawnAt: syntheticTime,
        evidenceId: knowledgeId(4),
      },
    });
    const result = await reconcilePublishedKnowledge(fixture.repository, fixture.authority);
    if (result.status !== "reconciled") throw new Error("Expected gap report");
    expect(result.coveredSlots).toBe(2);
    expect(result.rows[0]?.reason).toBe("STALE_REFERENCE");
    expect(result.rows[1]?.reason).toBe("NOT_APPROVED");
  });

  it("rejects incomplete/invalid inventory and changed inventory membership", async () => {
    const fixture = await knowledgeFixture();
    fixture.inventory.push(fixture.product);
    expect(await reconcilePublishedKnowledge(fixture.repository, fixture.authority)).toEqual({
      status: "not-ready",
      reason: "PRIMARY_UNAVAILABLE",
    });
    fixture.inventory.pop();
    fixture.read.confirmInventoryCurrent.mockResolvedValue(false);
    expect(await reconcilePublishedKnowledge(fixture.repository, fixture.authority)).toEqual({
      status: "blocked",
      reason: "CURRENT_STATE_CHANGED",
    });
  });

  it("projects only current approved public fields, never editor/private/audit information", async () => {
    const fixture = await knowledgeFixture();
    const result = await projectPublicKnowledge(
      referenceOf(fixture.monograph),
      fixture.repository,
      fixture.authority,
    );
    expect(result.status).toBe("projected");
    if (result.status !== "projected") throw new Error("Expected public projection");
    expect(result.text).toBe(fixture.monograph.content.text);
    expect(result.sources[0]?.sha256).toBe(fixture.monograph.content.sources[0]?.sha256);
    expect(result.derived).toBe(true);
    expect(Object.keys(result)).not.toContain("approval");
    expect(JSON.stringify(result)).not.toMatch(/editorId|evidenceId|patientId|authorityVersion/);
  });

  it("supports approved public institution profile projection without claiming a real physician fixture", async () => {
    const fixture = await knowledgeFixture();
    const profile = await resealSynthetic({
      ...fixture.monograph,
      content: {
        ...fixture.monograph.content,
        kind: "physician-profile",
        scope: "institution",
        productId: null,
        text: "SYNTHETIC profile protocol text; no real physician or approval.",
      },
    });
    fixture.entries.set(profile.content.entryId, profile);
    const projection = await projectPublicKnowledge(
      referenceOf(profile),
      fixture.repository,
      fixture.authority,
    );
    expect(projection).toMatchObject({
      status: "projected",
      kind: "physician-profile",
      scope: "institution",
      productId: null,
      text: profile.content.text,
    });
    expect(fixture.read.loadProduct).not.toHaveBeenCalled();
    expect(fixture.read.confirmCurrent).toHaveBeenCalledWith({ product: null, entries: [profile] });
  });

  it.each(["private", "withdrawn", "unpublished", "stale", "fence"])(
    "never projects %s content",
    async (condition) => {
      const fixture = await knowledgeFixture();
      if (condition === "private")
        fixture.read.loadEntry.mockResolvedValue({
          ...fixture.monograph,
          content: { ...fixture.monograph.content, visibility: "private" },
        });
      if (condition === "withdrawn")
        fixture.entries.set(fixture.monograph.content.entryId, {
          ...fixture.monograph,
          state: "withdrawn",
          withdrawal: {
            actorId: knowledgeId(3),
            withdrawnAt: syntheticTime,
            evidenceId: knowledgeId(4),
          },
        });
      if (condition === "unpublished") fixture.product.published = false;
      if (condition === "stale")
        fixture.product.knowledge.en.monograph = { ...referenceOf(fixture.monograph), revision: 2 };
      if (condition === "fence") fixture.read.confirmCurrent.mockResolvedValue(false);
      const result = await projectPublicKnowledge(
        referenceOf(fixture.monograph),
        fixture.repository,
        fixture.authority,
      );
      expect(result.status).toBe("blocked");
      expect(result).not.toHaveProperty("text");
    },
  );
});
