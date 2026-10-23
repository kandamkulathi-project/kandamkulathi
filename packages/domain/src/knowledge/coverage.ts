import {
  type ApprovedKnowledge,
  type KnowledgeBlockedReason,
  type KnowledgeFailure,
  type KnowledgeLanguage,
  type KnowledgeProduct,
  knowledgeLanguages,
  knowledgeProductSchema,
  productKnowledgeKinds,
} from "@kandamkulathi/contracts/knowledge";
import { checkApprovedRecord } from "./authorize";
import { findKnowledgeRecordByIdHint, immutable } from "./integrity";
import type { KnowledgeAuthority, TrustedKnowledgeRepository } from "./ports";

export type KnowledgeCoverageRow = Readonly<{
  productId: string;
  productRevision: number;
  language: KnowledgeLanguage;
  kind: (typeof productKnowledgeKinds)[number];
  outcome: "covered" | "gap";
  reason: KnowledgeBlockedReason | "MISSING_REFERENCE" | null;
}>;
export type KnowledgeCoverageResult =
  | KnowledgeFailure
  | Readonly<{
      status: "reconciled";
      publishedProducts: number;
      expectedSlots: number;
      coveredSlots: number;
      gapSlots: number;
      rows: readonly KnowledgeCoverageRow[];
    }>;

/** Complete trusted inventory, never a caller-selected list or a fabricated approval sample. */
export async function reconcilePublishedKnowledge(
  repository: TrustedKnowledgeRepository,
  authority: KnowledgeAuthority,
): Promise<KnowledgeCoverageResult> {
  try {
    return await repository.withPublishedInventory(async (inputs, read) => {
      const products: KnowledgeProduct[] = [];
      for (const input of inputs) {
        const parsed = knowledgeProductSchema.safeParse(input);
        if (
          !parsed.success ||
          !parsed.data.published ||
          products.some((product) => product.productId === parsed.data.productId)
        )
          return { status: "not-ready", reason: "PRIMARY_UNAVAILABLE" };
        products.push(parsed.data);
      }
      products.sort((a, b) => a.productId.localeCompare(b.productId));
      const rows: KnowledgeCoverageRow[] = [];
      for (const product of products) {
        const validEntries: ApprovedKnowledge[] = [];
        for (const language of knowledgeLanguages) {
          const safety = await read.loadMandatoryBlocks(product.productId, language);
          for (const kind of productKnowledgeKinds) {
            const reference = product.knowledge[language][kind];
            let reason: KnowledgeCoverageRow["reason"] = "MISSING_REFERENCE";
            if (reference) {
              const primary =
                kind === "monograph"
                  ? await read.loadEntry(reference.entryId)
                  : findKnowledgeRecordByIdHint(safety, reference.entryId);
              const result = await checkApprovedRecord(primary, reference, authority);
              if (result.status === "not-ready") return result;
              if (result.status === "blocked") reason = result.reason;
              else if (
                result.record.content.productId !== product.productId ||
                result.record.content.language !== language ||
                result.record.content.kind !== kind ||
                result.record.content.scope !== "catalogue"
              )
                reason = "SCOPE_MISMATCH";
              else {
                reason = null;
                validEntries.push(result.record);
              }
            }
            rows.push({
              productId: product.productId,
              productRevision: product.revision,
              language,
              kind,
              outcome: reason ? "gap" : "covered",
              reason,
            });
          }
        }
        if (!(await read.confirmCurrent({ product, entries: validEntries })))
          return { status: "blocked", reason: "CURRENT_STATE_CHANGED" };
      }
      if (!(await read.confirmInventoryCurrent(products)))
        return { status: "blocked", reason: "CURRENT_STATE_CHANGED" };
      const coveredSlots = rows.filter((row) => row.outcome === "covered").length;
      return immutable({
        status: "reconciled",
        publishedProducts: products.length,
        expectedSlots: rows.length,
        coveredSlots,
        gapSlots: rows.length - coveredSlots,
        rows,
      });
    });
  } catch {
    return { status: "not-ready", reason: "PRIMARY_UNAVAILABLE" };
  }
}
