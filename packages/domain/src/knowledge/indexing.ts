import {
  type KnowledgeContent,
  type KnowledgeFailure,
  type KnowledgeReference,
  knowledgeProductSchema,
  knowledgeReferenceSchema,
  productKnowledgeKinds,
} from "@kandamkulathi/contracts/knowledge";
import { checkApprovedRecord, sameReference } from "./authorize";
import { immutable } from "./integrity";
import type { KnowledgeAuthority, TrustedKnowledgeRepository } from "./ports";

export type PublicIndexProjection = Readonly<{
  status: "projected";
  schemaVersion: 1;
  derived: true;
  reference: Readonly<KnowledgeReference>;
  scope: KnowledgeContent["scope"];
  productId: string | null;
  language: KnowledgeContent["language"];
  kind: KnowledgeContent["kind"];
  title: string;
  text: string;
  sources: readonly Readonly<KnowledgeContent["sources"][number]>[];
  citations: readonly Readonly<KnowledgeContent["citations"][number]>[];
}>;

/** No embeddings/provider call. A projection remains a candidate, never response authority. */
export async function projectPublicKnowledge(
  referenceInput: unknown,
  repository: TrustedKnowledgeRepository,
  authority: KnowledgeAuthority,
): Promise<PublicIndexProjection | KnowledgeFailure> {
  const parsed = knowledgeReferenceSchema.safeParse(referenceInput);
  if (!parsed.success) return { status: "blocked", reason: "INVALID_REQUEST" };
  try {
    return await repository.withCurrentRead(async (read) => {
      const result = await checkApprovedRecord(
        await read.loadEntry(parsed.data.entryId),
        parsed.data,
        authority,
      );
      if (result.status !== "valid") return result;
      const { content } = result.record;
      let product = null;
      if (content.productId !== null) {
        const parsedProduct = knowledgeProductSchema.safeParse(
          await read.loadProduct(content.productId),
        );
        if (
          !parsedProduct.success ||
          !parsedProduct.data.published ||
          parsedProduct.data.productId !== content.productId
        )
          return { status: "blocked", reason: "PRODUCT_UNAVAILABLE" };
        product = parsedProduct.data;
        const kind = productKnowledgeKinds.find((kind) => kind === content.kind);
        const reference = kind && product.knowledge[content.language][kind];
        if (!reference || !sameReference(reference, parsed.data))
          return { status: "blocked", reason: "STALE_REFERENCE" };
      }
      if (!(await read.confirmCurrent({ product, entries: [result.record] })))
        return { status: "blocked", reason: "CURRENT_STATE_CHANGED" };
      return immutable({
        status: "projected",
        schemaVersion: 1,
        derived: true,
        reference: parsed.data,
        scope: content.scope,
        productId: content.productId,
        language: content.language,
        kind: content.kind,
        title: content.title,
        text: content.text,
        sources: content.sources,
        citations: content.citations,
      });
    });
  } catch {
    return { status: "not-ready", reason: "PRIMARY_UNAVAILABLE" };
  }
}
