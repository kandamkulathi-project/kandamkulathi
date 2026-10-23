import {
  type KnowledgeContent,
  type KnowledgeRecord,
  knowledgeAuthorityActorSchema,
  knowledgeContentSchema,
  knowledgeRecordSchema,
} from "@kandamkulathi/contracts/knowledge";
import { hashKnowledgeContent, immutable, sha256, validateKnowledgeRecord } from "./integrity";
import type { KnowledgeAuthority } from "./ports";

export type KnowledgeTransitionResult =
  | { status: "blocked"; reason: "INVALID_TRANSITION" | "INVALID_PROVENANCE" | "FORBIDDEN" }
  | { status: "not-ready"; reason: "AUTHORITY_UNAVAILABLE" }
  | {
      status: "candidate";
      /** Persist atomically with CAS + immutable audit; null means entry must not already exist. */
      expected: {
        entryId: string;
        revision: number;
        contentHash: string;
        state: KnowledgeRecord["state"];
      } | null;
      next: KnowledgeRecord;
    };

function candidate(
  previous: KnowledgeRecord | null,
  next: KnowledgeRecord,
): KnowledgeTransitionResult {
  return immutable({
    status: "candidate" as const,
    expected: previous
      ? {
          entryId: previous.content.entryId,
          revision: previous.content.revision,
          contentHash: previous.contentHash,
          state: previous.state,
        }
      : null,
    next,
  });
}

/** Source bytes are local, public, pre-reviewed ingestion input. No URL is fetched. */
export async function draftKnowledge(
  input: unknown,
  previousInput: unknown | null,
  sourceBytes: ReadonlyMap<string, Uint8Array>,
  authority: KnowledgeAuthority,
): Promise<KnowledgeTransitionResult> {
  const parsed = knowledgeContentSchema.safeParse(input);
  if (!parsed.success) return { status: "blocked", reason: "INVALID_PROVENANCE" };
  const content = parsed.data;
  const previous = previousInput === null ? null : await validateKnowledgeRecord(previousInput);
  if (previousInput !== null && !previous)
    return { status: "blocked", reason: "INVALID_PROVENANCE" };
  if (
    previous
      ? content.entryId !== previous.content.entryId ||
        content.revision !== previous.content.revision + 1 ||
        content.previousContentHash !== previous.contentHash
      : content.revision !== 1
  )
    return { status: "blocked", reason: "INVALID_TRANSITION" };
  for (const source of content.sources) {
    const bytes = sourceBytes.get(source.sourceId);
    if (!bytes || (await sha256(bytes)) !== source.sha256)
      return { status: "blocked", reason: "INVALID_PROVENANCE" };
  }
  try {
    const parsedActor = knowledgeAuthorityActorSchema.safeParse(
      await authority.currentActor("edit", content),
    );
    if (!parsedActor.success || parsedActor.data.actorId !== content.editorId)
      return { status: "blocked", reason: "FORBIDDEN" };
    return candidate(previous, {
      state: "draft",
      content,
      contentHash: await hashKnowledgeContent(content),
    });
  } catch {
    return { status: "not-ready", reason: "AUTHORITY_UNAVAILABLE" };
  }
}

export async function approveKnowledge(
  input: unknown,
  approvedAt: string,
  authority: KnowledgeAuthority,
): Promise<KnowledgeTransitionResult> {
  const record = await validateKnowledgeRecord(input);
  if (record?.state !== "draft") return { status: "blocked", reason: "INVALID_TRANSITION" };
  try {
    const parsedActor = knowledgeAuthorityActorSchema.safeParse(
      await authority.currentActor("approve", record.content),
    );
    if (!parsedActor.success || parsedActor.data.actorId === record.content.editorId)
      return { status: "blocked", reason: "FORBIDDEN" };
    const actor = parsedActor.data;
    const parsed = knowledgeRecordSchema.safeParse({
      ...record,
      state: "approved",
      approval: {
        approverId: actor.actorId,
        approverDisplayName: actor.displayName,
        authorityVersion: actor.authorityVersion,
        evidenceId: actor.evidenceId,
        approvedAt,
        contentHash: record.contentHash,
      },
    });
    if (!parsed.success) return { status: "blocked", reason: "INVALID_PROVENANCE" };
    return candidate(record, parsed.data);
  } catch {
    return { status: "not-ready", reason: "AUTHORITY_UNAVAILABLE" };
  }
}

export async function withdrawKnowledge(
  input: unknown,
  withdrawnAt: string,
  authority: KnowledgeAuthority,
): Promise<KnowledgeTransitionResult> {
  const record = await validateKnowledgeRecord(input);
  if (record?.state !== "approved") return { status: "blocked", reason: "INVALID_TRANSITION" };
  try {
    const parsedActor = knowledgeAuthorityActorSchema.safeParse(
      await authority.currentActor("withdraw", record.content),
    );
    if (!parsedActor.success) return { status: "blocked", reason: "FORBIDDEN" };
    const actor = parsedActor.data;
    const parsed = knowledgeRecordSchema.safeParse({
      ...record,
      state: "withdrawn",
      withdrawal: { actorId: actor.actorId, withdrawnAt, evidenceId: actor.evidenceId },
    });
    if (!parsed.success) return { status: "blocked", reason: "INVALID_PROVENANCE" };
    return candidate(record, parsed.data);
  } catch {
    return { status: "not-ready", reason: "AUTHORITY_UNAVAILABLE" };
  }
}

export type { KnowledgeContent };
