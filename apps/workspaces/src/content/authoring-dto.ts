import {
  type KnowledgeContent,
  type KnowledgeRecord,
  knowledgeContentSchema,
  knowledgeIdSchema,
  knowledgeRecordSchema,
  knowledgeReferenceSchema,
} from "@kandamkulathi/contracts/knowledge";

/** Transport DTOs frozen by Mathew's knowledge API handoff; no caller actor/grant fields. */
export type SourceUpload = { sourceId: string; bytesBase64: string };
export type AuthoringCommand =
  | { action: "edit"; content: KnowledgeContent; sources: SourceUpload[] }
  | { action: "approve" | "withdraw"; entryId: string; revision: number; contentHash: string };

/** Exact frozen endpoint body. Internal action/context metadata never becomes caller grants. */
export function authoringRequest(command: AuthoringCommand) {
  if (command.action === "edit")
    return {
      path: "/v1/knowledge/drafts",
      body: { content: command.content, sources: command.sources },
    };
  const reference = knowledgeReferenceSchema.parse({
    entryId: command.entryId,
    revision: command.revision,
    contentHash: command.contentHash,
  });
  return {
    path: `/v1/knowledge/${reference.entryId}/${command.action}`,
    body: { revision: reference.revision, contentHash: reference.contentHash },
  };
}

export function draftCommand(
  previous: KnowledgeRecord,
  actorId: string,
  title: string,
  text: string,
  uploads: readonly SourceUpload[],
): AuthoringCommand | null {
  const actor = knowledgeIdSchema.safeParse(actorId);
  const content = knowledgeContentSchema.safeParse({
    ...previous.content,
    title,
    text,
    revision: previous.content.revision + 1,
    previousContentHash: previous.contentHash,
    editorId: actor.success ? actor.data : actorId,
  });
  if (!actor.success || !content.success || !title.trim() || !text.trim()) return null;
  const sources: SourceUpload[] = [];
  if (!Array.isArray(uploads)) return null;
  for (const upload of uploads) {
    if (
      !upload ||
      typeof upload !== "object" ||
      Object.keys(upload).sort().join(",") !== "bytesBase64,sourceId"
    )
      return null;
    const sourceId = knowledgeIdSchema.safeParse(upload.sourceId);
    if (
      !sourceId.success ||
      typeof upload.bytesBase64 !== "string" ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(upload.bytesBase64)
    )
      return null;
    if (
      sources.some((source) => source.sourceId === sourceId.data) ||
      !content.data.sources.some((source) => source.sourceId === sourceId.data)
    )
      return null;
    sources.push({ sourceId: sourceId.data, bytesBase64: upload.bytesBase64 });
  }
  if (sources.length !== content.data.sources.length) return null;
  return { action: "edit", content: content.data, sources };
}

/** Exact success body and transition binding, not proof of server authorization/durability. */
export function persistedTransition(
  input: unknown,
  command: AuthoringCommand,
  previous: KnowledgeRecord,
  actorId: string,
): KnowledgeRecord | null {
  if (
    !input ||
    typeof input !== "object" ||
    Object.keys(input).sort().join(",") !== "record,status" ||
    !("status" in input) ||
    input.status !== "persisted" ||
    !("record" in input)
  )
    return null;
  const parsed = knowledgeRecordSchema.safeParse(input.record);
  const actor = knowledgeIdSchema.safeParse(actorId);
  if (!parsed.success || !actor.success) return null;
  const next = parsed.data;
  if (next.content.entryId !== previous.content.entryId) return null;
  if (command.action === "edit") {
    return next.state === "draft" &&
      next.content.editorId === actor.data &&
      next.content.revision === previous.content.revision + 1 &&
      next.content.previousContentHash === previous.contentHash &&
      JSON.stringify(next.content) === JSON.stringify(command.content)
      ? next
      : null;
  }
  if (
    command.entryId !== previous.content.entryId ||
    command.revision !== previous.content.revision ||
    command.contentHash !== previous.contentHash ||
    next.contentHash !== previous.contentHash ||
    JSON.stringify(next.content) !== JSON.stringify(previous.content)
  )
    return null;
  if (command.action === "approve") {
    return previous.state === "draft" &&
      next.state === "approved" &&
      next.approval.approverId === actor.data &&
      actor.data !== previous.content.editorId
      ? next
      : null;
  }
  return previous.state === "approved" &&
    next.state === "withdrawn" &&
    next.withdrawal.actorId === actor.data &&
    JSON.stringify(next.approval) === JSON.stringify(previous.approval)
    ? next
    : null;
}
