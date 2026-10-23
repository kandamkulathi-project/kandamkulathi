import type {
  ApprovedKnowledge,
  KnowledgeApproval,
  KnowledgeAuthorityActor,
  KnowledgeContent,
  KnowledgeLanguage,
  KnowledgeProduct,
} from "@kandamkulathi/contracts/knowledge";

/** Trusted server wiring, never a role/header supplied by a caller. No default grants. */
export interface KnowledgeAuthority {
  currentActor(
    permission: "edit" | "approve" | "withdraw",
    content: KnowledgeContent,
  ): Promise<KnowledgeAuthorityActor | null>;
  /** Must verify current named approval, evidence, permission, medical qualification and scope. */
  isApprovalCurrent(approval: KnowledgeApproval, content: KnowledgeContent): Promise<boolean>;
}

export type KnowledgeReadFence = Readonly<{
  product: KnowledgeProduct | null;
  entries: readonly ApprovedKnowledge[];
}>;

export interface CurrentKnowledgeRead {
  loadProduct(productId: string): Promise<unknown>;
  /** Returns the CURRENT primary revision, not a revision requested by a vector hit. */
  loadEntry(entryId: string): Promise<unknown>;
  /** Independent authoritative manifest lookup; not vector-selected or candidate-supplied. */
  loadMandatoryBlocks(productId: string, language: KnowledgeLanguage): Promise<readonly unknown[]>;
  /**
   * Final atomic current-state fence covering product manifest, publication and each entry's
   * revision/hash/approval/withdrawal AND current approver authority versions/revocations.
   * True is the read decision's linearization point.
   * Implement using the platform transaction/locking path; snapshot equality alone is insufficient.
   * Successful row/grant fences remain protected until the enclosing operation commits.
   */
  confirmCurrent(fence: KnowledgeReadFence): Promise<boolean>;
  /** Includes inventory membership/new publications, not just the listed row revisions. */
  confirmInventoryCurrent(products: readonly KnowledgeProduct[]): Promise<boolean>;
}

/** This port is NOT a durable repository implementation or proof of PostgreSQL/RLS safety. */
export interface TrustedKnowledgeRepository {
  /** One short primary operation; release successful fences only at commit, never between reads. */
  withCurrentRead<T>(operation: (read: CurrentKnowledgeRead) => Promise<T>): Promise<T>;
  /** Complete current published inventory, with a matching consistent primary read context. */
  withPublishedInventory<T>(
    operation: (products: readonly unknown[], read: CurrentKnowledgeRead) => Promise<T>,
  ): Promise<T>;
}
