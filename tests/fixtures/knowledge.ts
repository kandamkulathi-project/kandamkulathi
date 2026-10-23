import type {
  ApprovedEntry,
  KnowledgeDraft,
  KnowledgeReply,
} from "../../packages/contracts/src/knowledge";
import { otherReference, reference } from "./sensitive";
export const entry: ApprovedEntry = {
  id: reference,
  revision: 1,
  state: "approved",
  approvedBy: { id: otherReference, displayName: "Synthetic reviewing physician" },
  reviewUntil: "2099-01-01T00:00:00Z",
  document: {
    locale: "en",
    kind: "medical",
    title: "Synthetic knowledge entry",
    body: "Synthetic source content. No medical advice.",
    sourceUrl: "https://example.org/approved-source",
    sourceDigest: "a".repeat(64),
    productIds: [],
    concernIds: [],
    safety: {
      warnings: "Synthetic warning block",
      redFlags: "Synthetic routing block",
      consultOnly: "Synthetic consultation restriction",
      disclaimer: "Synthetic disclaimer block",
    },
  },
};
export const knowledgeDraft: KnowledgeDraft = {
  id: reference,
  revision: 1,
  authorId: reference,
  state: "draft",
  document: entry.document,
  permissions: { edit: true, approve: false, withdraw: false },
};
export const reply: Extract<KnowledgeReply, { kind: "answer" }> = {
  kind: "answer",
  id: otherReference,
  locale: "en",
  references: [{ id: reference, revision: 1 }],
};
