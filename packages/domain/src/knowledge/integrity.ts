import {
  type KnowledgeContent,
  type KnowledgeRecord,
  knowledgeContentSchema,
  knowledgeIdSchema,
  knowledgeRecordSchema,
} from "@kandamkulathi/contracts/knowledge";

/** Explicit field ordering, not insertion order from an external JSON object. */
export async function hashKnowledgeContent(input: KnowledgeContent): Promise<string> {
  const value = knowledgeContentSchema.parse(input);
  return sha256(
    new TextEncoder().encode(
      JSON.stringify([
        value.schemaVersion,
        value.entryId,
        value.revision,
        value.previousContentHash,
        value.visibility,
        value.scope,
        value.productId,
        value.language,
        value.kind,
        value.title,
        value.text,
        value.editorId,
        value.sources.map((source) => [
          source.sourceId,
          source.revision,
          source.sha256,
          source.visibility,
          source.publicUrl,
        ]),
        value.citations.map((citation) => [citation.sourceId, citation.title, citation.publicUrl]),
      ]),
    ),
  );
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function validateKnowledgeRecord(input: unknown): Promise<KnowledgeRecord | null> {
  const parsed = knowledgeRecordSchema.safeParse(input);
  if (!parsed.success) return null;
  if ((await hashKnowledgeContent(parsed.data.content)) !== parsed.data.contentHash) return null;
  return parsed.data;
}

/** Canonical manifest ID selects a hint only; the original record still requires full validation. */
export function findKnowledgeRecordByIdHint(inputs: readonly unknown[], entryId: string): unknown {
  return inputs.find((input) => {
    if (typeof input !== "object" || input === null || !("content" in input)) return false;
    const content = input.content;
    if (typeof content !== "object" || content === null || !("entryId" in content)) return false;
    const hint = knowledgeIdSchema.safeParse(content.entryId);
    return hint.success && hint.data === entryId;
  });
}

/** Deep-freeze copies only; never freeze an adapter's mutable database/test object. */
export function immutable<T>(value: T): T {
  const copy: T = structuredClone(value);
  function freeze(item: unknown): void {
    if (typeof item !== "object" || item === null) return;
    for (const child of Object.values(item)) freeze(child);
    Object.freeze(item);
  }
  freeze(copy);
  return copy;
}
