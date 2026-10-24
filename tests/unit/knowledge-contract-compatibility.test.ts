import { describe, expect, it } from "vitest";
import { knowledgeRecordView } from "../../packages/client/src/knowledge";
import { draftSchema } from "../../packages/contracts/src/client-knowledge";
import {
  type KnowledgeRecord,
  knowledgeRecordSchema,
} from "../../packages/contracts/src/knowledge";
import { knowledgeDraft } from "../fixtures/knowledge";

const id = "10000000-0000-4000-8000-000000000001";
const sourceId = "10000000-0000-4000-8000-000000000002";
const approverId = "10000000-0000-4000-8000-000000000003";
const hash = "a".repeat(64);
const record: KnowledgeRecord = {
  state: "approved",
  contentHash: hash,
  content: {
    schemaVersion: 1,
    entryId: id,
    revision: 1,
    previousContentHash: null,
    visibility: "public",
    scope: "catalogue",
    productId: id,
    language: "en",
    kind: "safety",
    title: "Synthetic safety block",
    text: " Synthetic plaintext; not medical guidance. ",
    editorId: id,
    sources: [
      {
        sourceId,
        revision: 1,
        sha256: hash,
        visibility: "public",
        publicUrl: "https://clinic.org/source",
      },
    ],
    citations: [{ sourceId, title: "Synthetic source", publicUrl: "https://clinic.org/source" }],
  },
  approval: {
    approverId,
    approverDisplayName: "Synthetic reviewer, not clinical approval",
    authorityVersion: 1,
    evidenceId: sourceId,
    approvedAt: "2026-10-23T00:00:00Z",
    contentHash: hash,
  },
};

describe("canonical knowledge and client DTO compatibility", () => {
  it("keeps both schemas explicit; neither silently accepts the other's records", () => {
    expect(knowledgeRecordSchema.safeParse(record).success).toBe(true);
    expect(draftSchema.safeParse(knowledgeDraft).success).toBe(true);
    expect(knowledgeRecordSchema.safeParse(knowledgeDraft).success).toBe(false);
    expect(draftSchema.safeParse(record).success).toBe(false);
    expect(knowledgeRecordView(knowledgeDraft)).toEqual({ status: "error" });
  });
  it("preserves clinical kind, exact plaintext, provenance and approval without inventing editor permissions", () => {
    const result = knowledgeRecordView(record);
    expect(result).toMatchObject({
      status: "ready",
      data: {
        id,
        revision: 1,
        state: "approved",
        kind: "safety",
        locale: "en",
        title: record.content.title,
        body: record.content.text,
        contentHash: hash,
        sources: record.content.sources,
        citations: record.content.citations,
        approval: record.approval,
        withdrawal: null,
      },
    });
    if (result.status !== "ready") throw new Error("Expected synthetic record view");
    for (const name of ["permissions", "reviewUntil", "safety"])
      expect(Object.hasOwn(result.data, name)).toBe(false);
  });
  it("preserves draft and withdrawn state instead of upgrading them to approved", () => {
    const draft = { state: "draft", content: record.content, contentHash: hash };
    expect(knowledgeRecordView(draft)).toMatchObject({
      status: "ready",
      data: { state: "draft", approval: null },
    });
    const withdrawn = {
      ...record,
      state: "withdrawn",
      withdrawal: { actorId: id, withdrawnAt: "2026-10-24T00:00:00Z", evidenceId: sourceId },
    };
    expect(knowledgeRecordView(withdrawn)).toMatchObject({
      status: "ready",
      data: { state: "withdrawn", withdrawal: withdrawn.withdrawal },
    });
  });
  it("rejects unknown fields, broken approval binding and self approval", () => {
    for (const input of [
      { ...record, generatedAdvice: "untrusted" },
      { ...record, approval: { ...record.approval, contentHash: "b".repeat(64) } },
      { ...record, approval: { ...record.approval, approverId: id } },
    ])
      expect(knowledgeRecordView(input)).toEqual({ status: "error" });
  });
});
