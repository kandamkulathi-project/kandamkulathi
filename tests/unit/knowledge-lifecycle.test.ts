import { describe, expect, it, vi } from "vitest";
import {
  knowledgeContentSchema,
  knowledgeRecordSchema,
} from "../../packages/contracts/src/knowledge";
import {
  approveKnowledge,
  draftKnowledge,
  hashKnowledgeContent,
  withdrawKnowledge,
} from "../../packages/domain/src/knowledge/index";
import {
  knowledgeFixture,
  knowledgeId,
  syntheticSourceBytes,
  syntheticTime,
} from "./knowledge.fixtures";

describe("synthetic knowledge lifecycle and provenance (not clinical approval)", () => {
  it("seals source bytes, separates editor from approver and binds immutable CAS expectations", async () => {
    const fixture = await knowledgeFixture();
    const sources = new Map([[knowledgeId(5), syntheticSourceBytes]]);
    const draft = await draftKnowledge(fixture.monograph.content, null, sources, fixture.authority);
    expect(draft.status).toBe("candidate");
    if (draft.status !== "candidate") throw new Error("Expected draft candidate");
    expect(draft.expected).toBeNull();
    expect(draft.next.state).toBe("draft");
    const approval = await approveKnowledge(draft.next, syntheticTime, fixture.authority);
    expect(approval.status).toBe("candidate");
    if (approval.status !== "candidate") throw new Error("Expected approval candidate");
    expect(approval.expected).toEqual({
      entryId: knowledgeId(10),
      revision: 1,
      contentHash: draft.next.contentHash,
      state: "draft",
    });
    expect(approval.next.content.text).toBe(draft.next.content.text);
    expect(approval.next.content.citations).toEqual(draft.next.content.citations);
    expect(Object.isFrozen(approval.next.content.citations)).toBe(true);
    expect(() => {
      approval.next.content.text = "overwrite";
    }).toThrow();
    const withdrawal = await withdrawKnowledge(approval.next, syntheticTime, fixture.authority);
    expect(withdrawal.status).toBe("candidate");
    if (withdrawal.status !== "candidate") throw new Error("Expected withdrawal candidate");
    expect(withdrawal.next.state).toBe("withdrawn");
    expect(withdrawal.next.contentHash).toBe(approval.next.contentHash);
    expect(
      await withdrawKnowledge(approval.next, "2026-10-22T00:00:00Z", fixture.authority),
    ).toEqual({ status: "blocked", reason: "INVALID_PROVENANCE" });
    expect(await approveKnowledge(withdrawal.next, syntheticTime, fixture.authority)).toEqual({
      status: "blocked",
      reason: "INVALID_TRANSITION",
    });
  });

  it("requires a fresh chained revision for edits and never mutates the approved revision", async () => {
    const fixture = await knowledgeFixture();
    const before = structuredClone(fixture.monograph);
    const changed = {
      ...before.content,
      revision: 2,
      previousContentHash: before.contentHash,
      text: "SYNTHETIC next revision",
    };
    const result = await draftKnowledge(
      changed,
      before,
      new Map([[knowledgeId(5), syntheticSourceBytes]]),
      fixture.authority,
    );
    expect(result.status).toBe("candidate");
    if (result.status !== "candidate") throw new Error("Expected revised candidate");
    expect(result.next.contentHash).not.toBe(before.contentHash);
    expect(result.expected?.revision).toBe(1);
    expect(fixture.monograph).toEqual(before);
    for (const input of [
      { ...changed, revision: 3 },
      { ...changed, previousContentHash: "a".repeat(64) },
      { ...changed, entryId: knowledgeId(99) },
    ]) {
      expect(
        await draftKnowledge(
          input,
          before,
          new Map([[knowledgeId(5), syntheticSourceBytes]]),
          fixture.authority,
        ),
      ).toEqual({ status: "blocked", reason: "INVALID_TRANSITION" });
    }
  });

  it("rejects unauthorized editing, self-approval, unauthorized approval/withdrawal and authority outages", async () => {
    const fixture = await knowledgeFixture();
    const draft = {
      content: fixture.monograph.content,
      contentHash: fixture.monograph.contentHash,
      state: "draft" as const,
    };
    fixture.authority.currentActor = vi.fn(async () => null);
    expect(
      await draftKnowledge(
        draft.content,
        null,
        new Map([[knowledgeId(5), syntheticSourceBytes]]),
        fixture.authority,
      ),
    ).toEqual({ status: "blocked", reason: "FORBIDDEN" });
    expect(await approveKnowledge(draft, syntheticTime, fixture.authority)).toEqual({
      status: "blocked",
      reason: "FORBIDDEN",
    });
    expect(await withdrawKnowledge(fixture.monograph, syntheticTime, fixture.authority)).toEqual({
      status: "blocked",
      reason: "FORBIDDEN",
    });
    fixture.authority.currentActor = vi.fn(async () => ({
      actorId: draft.content.editorId,
      displayName: "Synthetic editor",
      authorityVersion: 1,
      evidenceId: knowledgeId(4),
    }));
    expect(await approveKnowledge(draft, syntheticTime, fixture.authority)).toEqual({
      status: "blocked",
      reason: "FORBIDDEN",
    });
    fixture.authority.currentActor = vi.fn(async () => {
      throw new Error("restricted authority failure");
    });
    expect(await approveKnowledge(draft, syntheticTime, fixture.authority)).toEqual({
      status: "not-ready",
      reason: "AUTHORITY_UNAVAILABLE",
    });
  });

  it("rejects missing/mismatched source bytes, tampered approved text and forged provenance", async () => {
    const fixture = await knowledgeFixture();
    for (const bytes of [
      new Map(),
      new Map([[knowledgeId(5), new TextEncoder().encode("different")]]),
    ]) {
      expect(
        await draftKnowledge(fixture.monograph.content, null, bytes, fixture.authority),
      ).toEqual({ status: "blocked", reason: "INVALID_PROVENANCE" });
    }
    const tampered = {
      ...fixture.monograph,
      content: { ...fixture.monograph.content, text: "changed without new hash" },
    };
    expect(await withdrawKnowledge(tampered, syntheticTime, fixture.authority)).toEqual({
      status: "blocked",
      reason: "INVALID_TRANSITION",
    });
    expect(
      knowledgeRecordSchema.safeParse({
        ...fixture.monograph,
        approval: { ...fixture.monograph.approval, approverId: fixture.monograph.content.editorId },
      }).success,
    ).toBe(false);
    expect(
      knowledgeRecordSchema.safeParse({
        ...fixture.monograph,
        approval: { ...fixture.monograph.approval, contentHash: "f".repeat(64) },
      }).success,
    ).toBe(false);
  });

  it("rejects mixed-case aliases of the editor through both approval and record validation", async () => {
    const fixture = await knowledgeFixture();
    const editorId = "abcdef01-2345-4678-8abc-abcdef123456";
    const content = { ...fixture.monograph.content, editorId };
    const contentHash = await hashKnowledgeContent(content);
    const draft = { state: "draft" as const, content, contentHash };
    fixture.authority.currentActor = vi.fn(async () => ({
      actorId: editorId.toUpperCase(),
      displayName: "Synthetic editor alias",
      authorityVersion: 1,
      evidenceId: knowledgeId(4),
    }));
    expect(await approveKnowledge(draft, syntheticTime, fixture.authority)).toEqual({
      status: "blocked",
      reason: "FORBIDDEN",
    });
    for (const [storedEditorId, approverId] of [
      [editorId, editorId.toUpperCase()],
      [editorId.toUpperCase(), editorId],
      [editorId, editorId],
    ]) {
      expect(
        knowledgeRecordSchema.safeParse({
          state: "approved",
          content: { ...content, editorId: storedEditorId },
          contentHash,
          approval: { ...fixture.monograph.approval, contentHash, approverId },
        }).success,
      ).toBe(false);
    }

    const approverId = "fedcba98-7654-4321-8abc-abcdef123456";
    fixture.authority.currentActor = vi.fn(async () => ({
      actorId: approverId.toUpperCase(),
      displayName: "Synthetic independent reviewer",
      authorityVersion: 1,
      evidenceId: knowledgeId(4),
    }));
    const approval = await approveKnowledge(draft, syntheticTime, fixture.authority);
    expect(approval.status).toBe("candidate");
    if (approval.status !== "candidate" || approval.next.state !== "approved")
      throw new Error("Expected independent synthetic approval");
    expect(approval.next.approval.approverId).toBe(approverId);
    expect(approval.next.contentHash).toBe(contentHash);
    expect(knowledgeRecordSchema.parse(approval.next)).toEqual(approval.next);
  });

  it("normalizes trusted actor/evidence IDs without permitting self-approval or malformed grants", async () => {
    const fixture = await knowledgeFixture();
    const editorId = "abcdef01-2345-4678-8abc-abcdef123456";
    const content = { ...fixture.monograph.content, editorId };
    const contentHash = await hashKnowledgeContent(content);
    const draft = { state: "draft" as const, content, contentHash };
    for (const uppercaseField of ["actorId", "evidenceId"] as const) {
      fixture.authority.currentActor = vi.fn(async () => {
        const actor = {
          actorId: editorId,
          displayName: "Synthetic protocol actor",
          authorityVersion: 1,
          evidenceId: "bcdef012-3456-4789-8abc-abcdef123456",
        };
        return { ...actor, [uppercaseField]: actor[uppercaseField].toUpperCase() };
      });
      const draftResult = await draftKnowledge(
        content,
        null,
        new Map([[knowledgeId(5), syntheticSourceBytes]]),
        fixture.authority,
      );
      expect(draftResult.status).toBe("candidate");
      if (draftResult.status !== "candidate")
        throw new Error("Expected normalized synthetic editor");
      expect(draftResult.next.content.editorId).toBe(editorId);
      expect(await approveKnowledge(draft, syntheticTime, fixture.authority)).toEqual({
        status: "blocked",
        reason: "FORBIDDEN",
      });
      const withdrawal = await withdrawKnowledge(
        fixture.monograph,
        syntheticTime,
        fixture.authority,
      );
      expect(withdrawal.status).toBe("candidate");
      if (withdrawal.status !== "candidate" || withdrawal.next.state !== "withdrawn")
        throw new Error("Expected normalized synthetic withdrawal");
      expect(withdrawal.next.withdrawal.actorId).toBe(editorId);
      expect(withdrawal.next.withdrawal.evidenceId).toBe("bcdef012-3456-4789-8abc-abcdef123456");
    }
    for (const invalidField of ["actorId", "evidenceId"] as const) {
      fixture.authority.currentActor = vi.fn(async () => ({
        actorId: editorId,
        displayName: "Synthetic actor",
        authorityVersion: 1,
        evidenceId: knowledgeId(4),
        [invalidField]: "not-a-uuid",
      }));
      expect(
        await draftKnowledge(
          content,
          null,
          new Map([[knowledgeId(5), syntheticSourceBytes]]),
          fixture.authority,
        ),
      ).toEqual({ status: "blocked", reason: "FORBIDDEN" });
      expect(await approveKnowledge(draft, syntheticTime, fixture.authority)).toEqual({
        status: "blocked",
        reason: "FORBIDDEN",
      });
      expect(await withdrawKnowledge(fixture.monograph, syntheticTime, fixture.authority)).toEqual({
        status: "blocked",
        reason: "FORBIDDEN",
      });
    }
  });

  it("strictly versions public knowledge and checks kind/scope, citation links and revision history", async () => {
    const { monograph } = await knowledgeFixture();
    const badInputs = [
      { ...monograph.content, schemaVersion: 2 },
      { ...monograph.content, visibility: "private" },
      { ...monograph.content, patientId: knowledgeId(99) },
      { ...monograph.content, productId: null },
      { ...monograph.content, scope: "institution" },
      { ...monograph.content, revision: 2 },
      {
        ...monograph.content,
        sources: [{ ...monograph.content.sources[0], visibility: "private" }],
      },
      {
        ...monograph.content,
        citations: [
          { sourceId: knowledgeId(5), title: "Mismatched", publicUrl: "https://different.invalid" },
        ],
      },
    ];
    for (const input of badInputs)
      expect(knowledgeContentSchema.safeParse(input).success).toBe(false);
    const reordered = Object.fromEntries(Object.entries(monograph.content).reverse());
    expect(await hashKnowledgeContent(knowledgeContentSchema.parse(reordered))).toBe(
      monograph.contentHash,
    );
  });
});
