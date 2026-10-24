/** Synthetic nonclinical protocol data. Hashes are placeholders, not integrity/approval proof. */
export const editorId = "abcdefab-1111-4111-8111-111111111111";
export const approverId = "abcdefab-2222-4222-8222-222222222222";
export function syntheticRecord(state: "draft" | "approved" | "withdrawn" = "draft") {
  const draft = {
    state: "draft" as const,
    contentHash: "a".repeat(64),
    content: {
      schemaVersion: 1 as const,
      entryId: "abcdefab-3333-4333-8333-333333333333",
      revision: 1,
      previousContentHash: null,
      visibility: "public" as const,
      scope: "institution" as const,
      productId: null,
      language: "en" as const,
      kind: "reference" as const,
      title: "Synthetic reference title",
      text: "Synthetic text only.\nNo medical content or approval.",
      editorId,
      sources: [
        {
          sourceId: "abcdefab-4444-4444-8444-444444444444",
          revision: 1,
          sha256: "b".repeat(64),
          visibility: "public" as const,
          publicUrl: "https://example.com/synthetic-reference",
        },
      ],
      citations: [
        {
          sourceId: "abcdefab-4444-4444-8444-444444444444",
          title: "Synthetic source",
          publicUrl: "https://example.com/synthetic-reference",
        },
      ],
    },
  };
  if (state === "draft") return draft;
  const approved = {
    ...draft,
    state: "approved" as const,
    approval: {
      approverId,
      approverDisplayName: "Synthetic reviewer — not physician approval",
      authorityVersion: 1,
      evidenceId: "abcdefab-5555-4555-8555-555555555555",
      approvedAt: "2026-10-20T10:00:00Z",
      contentHash: draft.contentHash,
    },
  };
  return state === "approved"
    ? approved
    : {
        ...approved,
        state: "withdrawn" as const,
        withdrawal: {
          actorId: approverId,
          withdrawnAt: "2026-10-20T11:00:00Z",
          evidenceId: "abcdefab-6666-4666-8666-666666666666",
        },
      };
}
