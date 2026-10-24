import type { PublicKnowledgeResult } from "../../packages/contracts/src/knowledge";

export const publicKnowledgeId = "10000000-0000-4000-8000-000000000001";
export const publicKnowledgeHash = "a".repeat(64);
export const publicKnowledgeInput = {
  schemaVersion: 1,
  mode: "public-product",
  productId: publicKnowledgeId,
  language: "en",
  candidates: [
    { entryId: publicKnowledgeId, revision: 1, contentHash: publicKnowledgeHash, origin: "exact" },
  ],
};
// Synthetic transport shape only; not approved medical text or evidence of current server authority.
export const publicKnowledgeReply: Extract<PublicKnowledgeResult, { status: "ready" }> = {
  status: "ready",
  schemaVersion: 1,
  productId: publicKnowledgeId,
  productRevision: 1,
  language: "en",
  blocks: (["monograph", "dosage", "contraindication", "safety"] as const).map((kind, index) => ({
    reference: {
      entryId: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      revision: 1,
      contentHash: publicKnowledgeHash,
    },
    kind,
    language: "en",
    title: `Synthetic ${kind}`,
    text: ` Synthetic ${kind} plaintext, not medical guidance. `,
    citations: [
      {
        sourceId: publicKnowledgeId,
        title: "Synthetic public source",
        publicUrl: "https://clinic.org/source",
      },
    ],
    approval: {
      approverId: publicKnowledgeId,
      approverDisplayName: "Synthetic reviewer, not a clinical approval",
      approvedAt: "2026-10-23T00:00:00Z",
      contentHash: publicKnowledgeHash,
    },
  })),
};
