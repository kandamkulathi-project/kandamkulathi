import {
  type ApprovedKnowledge,
  type ApprovedKnowledgeBlock,
  type KnowledgeFailure,
  type KnowledgeReference,
  knowledgeProductSchema,
  mandatorySafetyKinds,
  type PublicKnowledgeRequest,
  type PublicKnowledgeResult,
  publicKnowledgeRequestSchema,
} from "@kandamkulathi/contracts/knowledge";
import { findKnowledgeRecordByIdHint, immutable, validateKnowledgeRecord } from "./integrity";
import type { CurrentKnowledgeRead, KnowledgeAuthority, TrustedKnowledgeRepository } from "./ports";

export function referenceOf(record: ApprovedKnowledge): KnowledgeReference {
  return {
    entryId: record.content.entryId,
    revision: record.content.revision,
    contentHash: record.contentHash,
  };
}

export function sameReference(left: KnowledgeReference, right: KnowledgeReference): boolean {
  return (
    left.entryId === right.entryId &&
    left.revision === right.revision &&
    left.contentHash === right.contentHash
  );
}

export async function checkApprovedRecord(
  input: unknown,
  reference: KnowledgeReference,
  authority: KnowledgeAuthority,
): Promise<{ status: "valid"; record: ApprovedKnowledge } | KnowledgeFailure> {
  if (input === null || input === undefined)
    return { status: "blocked", reason: "MISSING_PRIMARY" };
  const record = await validateKnowledgeRecord(input);
  if (!record) return { status: "blocked", reason: "INVALID_PROVENANCE" };
  if (record.state !== "approved") return { status: "blocked", reason: "NOT_APPROVED" };
  if (!sameReference(reference, referenceOf(record)))
    return { status: "blocked", reason: "STALE_REFERENCE" };
  try {
    if (!(await authority.isApprovalCurrent(record.approval, record.content)))
      return { status: "blocked", reason: "APPROVER_UNAUTHORIZED" };
  } catch {
    return { status: "not-ready", reason: "AUTHORITY_UNAVAILABLE" };
  }
  return { status: "valid", record };
}

function matchesScope(
  record: ApprovedKnowledge,
  request: PublicKnowledgeRequest,
  kind: string,
): boolean {
  const content = record.content;
  return (
    content.productId === request.productId &&
    content.language === request.language &&
    content.scope === "catalogue" &&
    content.visibility === "public" &&
    content.kind === kind
  );
}

function blockOf(record: ApprovedKnowledge): ApprovedKnowledgeBlock {
  return {
    reference: referenceOf(record),
    kind: record.content.kind,
    language: record.content.language,
    title: record.content.title,
    text: record.content.text,
    citations: record.content.citations,
    approval: {
      approverId: record.approval.approverId,
      approverDisplayName: record.approval.approverDisplayName,
      approvedAt: record.approval.approvedAt,
      contentHash: record.approval.contentHash,
    },
  };
}

async function authorizeWithinRead(
  request: PublicKnowledgeRequest,
  read: CurrentKnowledgeRead,
  authority: KnowledgeAuthority,
): Promise<PublicKnowledgeResult> {
  const parsed = knowledgeProductSchema.safeParse(await read.loadProduct(request.productId));
  if (!parsed.success || !parsed.data.published || parsed.data.productId !== request.productId)
    return { status: "blocked", reason: "PRODUCT_UNAVAILABLE" };
  const product = parsed.data;
  const expected = product.knowledge[request.language];
  if (!expected.monograph) return { status: "blocked", reason: "MISSING_PRIMARY" };
  const entries: ApprovedKnowledge[] = [];
  for (const candidate of request.candidates) {
    // Even an exact/alias hit must be looked up in CURRENT primary state.
    const result = await checkApprovedRecord(
      await read.loadEntry(candidate.entryId),
      candidate,
      authority,
    );
    if (result.status !== "valid") return result;
    if (!matchesScope(result.record, request, "monograph"))
      return { status: "blocked", reason: "SCOPE_MISMATCH" };
    if (!sameReference(candidate, expected.monograph))
      return { status: "blocked", reason: "STALE_REFERENCE" };
    if (!entries.some((entry) => entry.content.entryId === candidate.entryId))
      entries.push(result.record);
  }
  // Safety is fetched independently, never from the candidates or vector ranking.
  const safetyInputs = await read.loadMandatoryBlocks(request.productId, request.language);
  if (safetyInputs.length !== mandatorySafetyKinds.length)
    return { status: "blocked", reason: "SAFETY_BLOCKS_UNAVAILABLE" };
  const safetyRecords: ApprovedKnowledge[] = [];
  for (const kind of mandatorySafetyKinds) {
    const reference = expected[kind];
    if (!reference) return { status: "blocked", reason: "SAFETY_BLOCKS_UNAVAILABLE" };
    // The ID is a lookup hint only; validation below checks the entire primary record.
    const input = findKnowledgeRecordByIdHint(safetyInputs, reference.entryId);
    const result = await checkApprovedRecord(input, reference, authority);
    if (result.status !== "valid") return result;
    if (!matchesScope(result.record, request, kind))
      return { status: "blocked", reason: "SCOPE_MISMATCH" };
    safetyRecords.push(result.record);
  }
  entries.push(...safetyRecords);
  if (!(await read.confirmCurrent({ product, entries })))
    return { status: "blocked", reason: "CURRENT_STATE_CHANGED" };
  return immutable({
    status: "ready",
    schemaVersion: 1,
    productId: product.productId,
    productRevision: product.revision,
    language: request.language,
    blocks: entries.map(blockOf),
  });
}

/** Public browsing takes no intake or identity fields. Personalization is intentionally unsupported. */
export async function authorizePublicKnowledge(
  input: unknown,
  repository: TrustedKnowledgeRepository,
  authority: KnowledgeAuthority,
): Promise<PublicKnowledgeResult> {
  if (
    typeof input === "object" &&
    input !== null &&
    "mode" in input &&
    input.mode === "personalized"
  )
    return { status: "blocked", reason: "PERSONALIZED_POLICY_UNAVAILABLE" };
  const parsed = publicKnowledgeRequestSchema.safeParse(input);
  if (!parsed.success) return { status: "blocked", reason: "INVALID_REQUEST" };
  try {
    return await repository.withCurrentRead((read) =>
      authorizeWithinRead(parsed.data, read, authority),
    );
  } catch {
    return { status: "not-ready", reason: "PRIMARY_UNAVAILABLE" };
  }
}
