import { describe, expect, it, vi } from "vitest";
import type { ApprovedKnowledge } from "../../packages/contracts/src/knowledge";
import { authorizePublicKnowledge, referenceOf } from "../../packages/domain/src/knowledge/index";
import {
  knowledgeFixture,
  knowledgeId,
  resealSynthetic,
  syntheticTime,
} from "./knowledge.fixtures";

describe("current-primary public knowledge authorization", () => {
  it.each(["exact", "alias", "keyword", "vector"] as const)(
    "treats %s references only as candidates, loads independent safety and preserves exact blocks",
    async (origin) => {
      const fixture = await knowledgeFixture();
      const request = {
        ...fixture.request,
        candidates: [{ ...referenceOf(fixture.monograph), origin }],
      };
      const result = await authorizePublicKnowledge(request, fixture.repository, fixture.authority);
      expect(result.status).toBe("ready");
      if (result.status !== "ready") throw new Error("Expected synthetic ready decision");
      expect(fixture.read.loadEntry).toHaveBeenCalledWith(fixture.monograph.content.entryId);
      expect(fixture.read.loadMandatoryBlocks).toHaveBeenCalledWith(
        fixture.product.productId,
        "en",
      );
      expect(result.blocks.map((block) => block.kind)).toEqual([
        "monograph",
        "dosage",
        "contraindication",
        "safety",
      ]);
      for (const block of result.blocks) {
        const primary = fixture.entries.get(block.reference.entryId);
        expect(block.text).toBe(primary?.content.text);
        expect(block.citations).toEqual(primary?.content.citations);
        expect(block.approval.contentHash).toBe(block.reference.contentHash);
      }
      expect(Object.isFrozen(result.blocks[1]?.citations[0])).toBe(true);
      expect(fixture.read.confirmCurrent).toHaveBeenCalledTimes(1);
    },
  );

  it("blocks nonexistent primary despite plausible vector hit and never returns candidate text", async () => {
    const fixture = await knowledgeFixture();
    fixture.entries.delete(fixture.monograph.content.entryId);
    expect(
      await authorizePublicKnowledge(fixture.request, fixture.repository, fixture.authority),
    ).toEqual({ status: "blocked", reason: "MISSING_PRIMARY" });
    expect(fixture.read.confirmCurrent).not.toHaveBeenCalled();
  });

  it.each(["draft", "withdrawn"] as const)(
    "blocks %s records even when cached vector hashes still match",
    async (state) => {
      const fixture = await knowledgeFixture();
      const { content, contentHash, approval } = fixture.monograph;
      fixture.entries.set(
        content.entryId,
        state === "draft"
          ? { state, content, contentHash }
          : {
              state,
              content,
              contentHash,
              approval,
              withdrawal: {
                actorId: knowledgeId(3),
                withdrawnAt: syntheticTime,
                evidenceId: knowledgeId(4),
              },
            },
      );
      expect(
        await authorizePublicKnowledge(fixture.request, fixture.repository, fixture.authority),
      ).toEqual({ status: "blocked", reason: "NOT_APPROVED" });
    },
  );

  it("blocks a concurrent new revision instead of serving a still-existing old vector revision", async () => {
    const fixture = await knowledgeFixture();
    const revised = await resealSynthetic({
      ...fixture.monograph,
      content: {
        ...fixture.monograph.content,
        revision: 2,
        previousContentHash: fixture.monograph.contentHash,
        text: "SYNTHETIC current revision",
      },
    });
    fixture.entries.set(revised.content.entryId, revised);
    expect(
      await authorizePublicKnowledge(fixture.request, fixture.repository, fixture.authority),
    ).toEqual({ status: "blocked", reason: "STALE_REFERENCE" });
  });

  it.each(["product", "language", "kind"])(
    "blocks wrong %s even with a matching, resealed primary hash",
    async (boundary) => {
      const fixture = await knowledgeFixture();
      const content = structuredClone(fixture.monograph.content);
      if (boundary === "product") content.productId = knowledgeId(99);
      if (boundary === "language") content.language = "ta";
      if (boundary === "kind") content.kind = "dosage";
      const wrong = await resealSynthetic({ ...fixture.monograph, content });
      fixture.entries.set(content.entryId, wrong);
      fixture.request.candidates = [{ ...referenceOf(wrong), origin: "vector" }];
      fixture.product.knowledge.en.monograph = referenceOf(wrong);
      expect(
        await authorizePublicKnowledge(fixture.request, fixture.repository, fixture.authority),
      ).toEqual({ status: "blocked", reason: "SCOPE_MISMATCH" });
    },
  );

  it("blocks product manifest substitution and unpublished products", async () => {
    const fixture = await knowledgeFixture();
    fixture.product.knowledge.en.monograph = {
      ...referenceOf(fixture.monograph),
      contentHash: "a".repeat(64),
    };
    expect(
      await authorizePublicKnowledge(fixture.request, fixture.repository, fixture.authority),
    ).toEqual({ status: "blocked", reason: "STALE_REFERENCE" });
    fixture.product.published = false;
    expect(
      await authorizePublicKnowledge(fixture.request, fixture.repository, fixture.authority),
    ).toEqual({ status: "blocked", reason: "PRODUCT_UNAVAILABLE" });
  });

  it("fails closed for missing, partial and duplicate independent safety blocks", async () => {
    for (const size of [0, 1, 4]) {
      const fixture = await knowledgeFixture();
      fixture.read.loadMandatoryBlocks.mockResolvedValue(
        Array.from({ length: size }, () => fixture.monograph),
      );
      expect(
        await authorizePublicKnowledge(fixture.request, fixture.repository, fixture.authority),
      ).toEqual({ status: "blocked", reason: "SAFETY_BLOCKS_UNAVAILABLE" });
    }
    const fixture = await knowledgeFixture();
    fixture.read.loadMandatoryBlocks.mockResolvedValue([
      fixture.monograph,
      fixture.monograph,
      fixture.monograph,
    ]);
    expect(
      await authorizePublicKnowledge(fixture.request, fixture.repository, fixture.authority),
    ).toEqual({ status: "blocked", reason: "MISSING_PRIMARY" });
  });

  it.each(["withdrawn", "stale", "wrong-language", "tampered"])(
    "blocks %s mandatory safety even when monograph is current",
    async (condition) => {
      const fixture = await knowledgeFixture();
      const entry = fixture.entries.get(knowledgeId(11));
      if (entry?.state !== "approved") throw new Error("Expected synthetic safety fixture");
      if (condition === "withdrawn")
        fixture.entries.set(entry.content.entryId, {
          ...entry,
          state: "withdrawn",
          withdrawal: {
            actorId: knowledgeId(3),
            withdrawnAt: syntheticTime,
            evidenceId: knowledgeId(4),
          },
        });
      if (condition === "stale")
        fixture.product.knowledge.en.dosage = { ...referenceOf(entry), revision: 2 };
      if (condition === "wrong-language") {
        const wrong = await resealSynthetic({
          ...entry,
          content: { ...entry.content, language: "ml" },
        });
        fixture.entries.set(entry.content.entryId, wrong);
        fixture.product.knowledge.en.dosage = referenceOf(wrong);
      }
      if (condition === "tampered")
        fixture.entries.set(entry.content.entryId, {
          ...entry,
          content: { ...entry.content, text: "unsealed replacement" },
        });
      const reasons = {
        withdrawn: "NOT_APPROVED",
        stale: "STALE_REFERENCE",
        "wrong-language": "SCOPE_MISMATCH",
        tampered: "INVALID_PROVENANCE",
      };
      expect(
        await authorizePublicKnowledge(fixture.request, fixture.repository, fixture.authority),
      ).toEqual({ status: "blocked", reason: reasons[condition as keyof typeof reasons] });
    },
  );

  it("does not fall back from unavailable requested ML/TA safety to English", async () => {
    const fixture = await knowledgeFixture();
    for (const language of ["ml", "ta"] as const) {
      const result = await authorizePublicKnowledge(
        { ...fixture.request, language },
        fixture.repository,
        fixture.authority,
      );
      expect(result).toEqual({ status: "blocked", reason: "MISSING_PRIMARY" });
    }
  });

  it("rechecks named approval authority and safely reports authority/primary outages without exception details", async () => {
    const fixture = await knowledgeFixture();
    fixture.authority.isApprovalCurrent = vi.fn(async () => false);
    expect(
      await authorizePublicKnowledge(fixture.request, fixture.repository, fixture.authority),
    ).toEqual({ status: "blocked", reason: "APPROVER_UNAUTHORIZED" });
    fixture.authority.isApprovalCurrent = vi.fn(async () => {
      throw new Error("private authority error");
    });
    expect(
      await authorizePublicKnowledge(fixture.request, fixture.repository, fixture.authority),
    ).toEqual({ status: "not-ready", reason: "AUTHORITY_UNAVAILABLE" });
    fixture.read.loadProduct.mockRejectedValue(new Error("private database error"));
    expect(
      await authorizePublicKnowledge(fixture.request, fixture.repository, fixture.authority),
    ).toEqual({ status: "not-ready", reason: "PRIMARY_UNAVAILABLE" });
  });

  it("fences withdrawal between candidate read and response materialization", async () => {
    const fixture = await knowledgeFixture();
    const original = fixture.read.loadMandatoryBlocks.getMockImplementation();
    fixture.read.loadMandatoryBlocks.mockImplementation(async (productId, language) => {
      if (!original) throw new Error("Missing synthetic mock");
      const safety = await original(productId, language);
      const entry = fixture.monograph;
      fixture.entries.set(entry.content.entryId, {
        ...entry,
        state: "withdrawn",
        withdrawal: {
          actorId: knowledgeId(3),
          withdrawnAt: syntheticTime,
          evidenceId: knowledgeId(4),
        },
      });
      return safety;
    });
    expect(
      await authorizePublicKnowledge(fixture.request, fixture.repository, fixture.authority),
    ).toEqual({ status: "blocked", reason: "CURRENT_STATE_CHANGED" });
  });

  it("does not bypass a failed current-state fence on repeated requests", async () => {
    const fixture = await knowledgeFixture();
    fixture.read.confirmCurrent.mockResolvedValue(false);
    for (let attempt = 0; attempt < 2; attempt++)
      expect(
        await authorizePublicKnowledge(fixture.request, fixture.repository, fixture.authority),
      ).toEqual({ status: "blocked", reason: "CURRENT_STATE_CHANGED" });
  });

  it("fences a concurrent product manifest revision and reviewer revocation after successful initial checks", async () => {
    const fixture = await knowledgeFixture();
    const original = fixture.read.loadMandatoryBlocks.getMockImplementation();
    fixture.read.loadMandatoryBlocks.mockImplementation(async (productId, language) => {
      if (!original) throw new Error("Missing synthetic mock");
      const blocks = await original(productId, language);
      fixture.product.revision += 1;
      return blocks;
    });
    expect(
      await authorizePublicKnowledge(fixture.request, fixture.repository, fixture.authority),
    ).toEqual({ status: "blocked", reason: "CURRENT_STATE_CHANGED" });

    const revoked = await knowledgeFixture();
    let authorityChecks = 0;
    revoked.authority.isApprovalCurrent = vi.fn(async () => ++authorityChecks <= 4);
    expect(
      await authorizePublicKnowledge(revoked.request, revoked.repository, revoked.authority),
    ).toEqual({ status: "blocked", reason: "CURRENT_STATE_CHANGED" });
    expect(authorityChecks).toBe(5);
  });

  it("does not let generated text, roles, intake or vectors replace approved medical blocks", async () => {
    const fixture = await knowledgeFixture();
    const invalid = [
      { ...fixture.request, generatedText: "replacement" },
      { ...fixture.request, intake: {} },
      { ...fixture.request, role: "approver" },
      { ...fixture.request, scope: "clinical" },
      {
        ...fixture.request,
        candidates: [{ ...fixture.request.candidates[0], text: "replacement" }],
      },
      { ...fixture.request, candidates: [] },
      { ...fixture.request, schemaVersion: 2 },
    ];
    for (const input of invalid)
      expect(await authorizePublicKnowledge(input, fixture.repository, fixture.authority)).toEqual({
        status: "blocked",
        reason: "INVALID_REQUEST",
      });
    expect(
      await authorizePublicKnowledge(
        { mode: "personalized" },
        fixture.repository,
        fixture.authority,
      ),
    ).toEqual({ status: "blocked", reason: "PERSONALIZED_POLICY_UNAVAILABLE" });
    expect(fixture.read.loadEntry).not.toHaveBeenCalled();
  });

  it("rejects a validly rehashed source/citation tamper without the original reference", async () => {
    const fixture = await knowledgeFixture();
    const tampered: ApprovedKnowledge = await resealSynthetic({
      ...fixture.monograph,
      content: {
        ...fixture.monograph.content,
        sources: fixture.monograph.content.sources.map((source) => ({
          ...source,
          sha256: "a".repeat(64),
        })),
      },
    });
    fixture.entries.set(tampered.content.entryId, tampered);
    expect(
      await authorizePublicKnowledge(fixture.request, fixture.repository, fixture.authority),
    ).toEqual({ status: "blocked", reason: "STALE_REFERENCE" });
  });
});
