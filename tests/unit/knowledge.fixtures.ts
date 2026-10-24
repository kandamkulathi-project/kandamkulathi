import { isDeepStrictEqual } from "node:util";
import { vi } from "vitest";
import {
  type ApprovedKnowledge,
  type KnowledgeContent,
  type KnowledgeProduct,
  type KnowledgeRecord,
  type PublicKnowledgeRequest,
  productKnowledgeKinds,
} from "../../packages/contracts/src/knowledge";
import {
  hashKnowledgeContent,
  type KnowledgeAuthority,
  type KnowledgeReadFence,
  referenceOf,
  sha256,
  type TrustedKnowledgeRepository,
} from "../../packages/domain/src/knowledge/index";

// Synthetic protocol fixtures only. No source, person or text is physician-approved.
export const knowledgeId = (value: number) =>
  `10000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
export const syntheticSourceBytes = new TextEncoder().encode(
  "SYNTHETIC public source bytes; no medical content",
);
export const syntheticTime = "2026-10-23T00:00:00Z";

export async function knowledgeFixture() {
  const editorId = knowledgeId(2);
  const approverId = knowledgeId(3);
  const authority: KnowledgeAuthority = {
    currentActor: vi.fn(async (permission) => ({
      actorId: permission === "edit" ? editorId : approverId,
      displayName: "Synthetic protocol reviewer (not a physician approval)",
      authorityVersion: 1,
      evidenceId: knowledgeId(4),
    })),
    isApprovalCurrent: vi.fn(
      async (approval) =>
        approval.approverId === approverId &&
        approval.authorityVersion === 1 &&
        approval.evidenceId === knowledgeId(4),
    ),
  };
  const entries = new Map<string, KnowledgeRecord>();
  const product: KnowledgeProduct = {
    schemaVersion: 1,
    productId: knowledgeId(1),
    revision: 1,
    published: true,
    knowledge: { en: {}, ml: {}, ta: {} },
  };
  for (const [index, kind] of productKnowledgeKinds.entries()) {
    const content: KnowledgeContent = {
      schemaVersion: 1,
      entryId: knowledgeId(10 + index),
      revision: 1,
      previousContentHash: null,
      visibility: "public",
      scope: "catalogue",
      productId: product.productId,
      language: "en",
      kind,
      title: `Synthetic ${kind}`,
      text: ` SYNTHETIC ${kind} test block.\nNot medical guidance. `,
      editorId,
      sources: [
        {
          sourceId: knowledgeId(5),
          revision: 1,
          sha256: await sha256(syntheticSourceBytes),
          visibility: "public",
          publicUrl: "https://synthetic.invalid/source",
        },
      ],
      citations: [
        {
          sourceId: knowledgeId(5),
          title: "Synthetic source, not reviewed medical content",
          publicUrl: "https://synthetic.invalid/source",
        },
      ],
    };
    const contentHash = await hashKnowledgeContent(content);
    const record: ApprovedKnowledge = {
      state: "approved",
      content,
      contentHash,
      approval: {
        approverId,
        approverDisplayName: "Synthetic protocol reviewer (not a physician approval)",
        authorityVersion: 1,
        evidenceId: knowledgeId(4),
        approvedAt: syntheticTime,
        contentHash,
      },
    };
    entries.set(content.entryId, record);
    product.knowledge.en[kind] = referenceOf(record);
  }
  const monograph = entries.get(knowledgeId(10));
  if (monograph?.state !== "approved") throw new Error("Synthetic fixture construction failed");
  const request: PublicKnowledgeRequest = {
    schemaVersion: 1,
    mode: "public-product",
    productId: product.productId,
    language: "en",
    candidates: [{ ...referenceOf(monograph), origin: "vector" }],
  };
  const loadProduct = vi.fn(async () => structuredClone(product));
  const loadEntry = vi.fn(
    async (entryId: string): Promise<unknown> => structuredClone(entries.get(entryId) ?? null),
  );
  const loadMandatoryBlocks = vi.fn(
    async (_productId: string, language: "en" | "ml" | "ta"): Promise<readonly unknown[]> => {
      return ["dosage", "contraindication", "safety"].flatMap((kind) => {
        const reference =
          product.knowledge[language][kind as "dosage" | "contraindication" | "safety"];
        const entry = reference && entries.get(reference.entryId);
        return entry ? [structuredClone(entry)] : [];
      });
    },
  );
  const confirmCurrent = vi.fn(async (fence: KnowledgeReadFence) => {
    if (fence.product && !isDeepStrictEqual(fence.product, product)) return false;
    for (const entry of fence.entries) {
      if (
        !isDeepStrictEqual(entry, entries.get(entry.content.entryId)) ||
        !(await authority.isApprovalCurrent(entry.approval, entry.content))
      )
        return false;
    }
    return true;
  });
  const confirmInventoryCurrent = vi.fn(async () => true);
  const read = {
    loadProduct,
    loadEntry,
    loadMandatoryBlocks,
    confirmCurrent,
    confirmInventoryCurrent,
  };
  const inventory: unknown[] = [product];
  const repository: TrustedKnowledgeRepository = {
    withCurrentRead: async (operation) => operation(read),
    withPublishedInventory: async (operation) => operation(structuredClone(inventory), read),
  };
  return { authority, repository, entries, product, request, read, monograph, inventory };
}

export async function resealSynthetic(record: ApprovedKnowledge): Promise<ApprovedKnowledge> {
  const contentHash = await hashKnowledgeContent(record.content);
  return { ...record, contentHash, approval: { ...record.approval, contentHash } };
}
