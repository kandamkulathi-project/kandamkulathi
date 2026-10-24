import { z } from "zod";
import {
  type KnowledgeReference,
  knowledgeReferenceSchema,
} from "../../contracts/src/knowledge.ts";
import {
  type KnowledgeAuthority,
  type PublicIndexProjection,
  projectPublicKnowledge,
  referenceOf,
  sha256,
  validateKnowledgeRecord,
} from "../../domain/src/knowledge/index.ts";
import { type DatabaseContext, inTransaction, transaction } from "./client.ts";
import { createPostgresKnowledge } from "./knowledge.ts";
import { type ClaimedJob, enqueue } from "./outbox.ts";

/** Dispatcher bridge only. The ledger and canonical outbox remain distinct durable facts.
 * Caller supplies the operational deadline budget; it is not a company freshness SLA.
 */
export async function bridgeKnowledgeIndexObligations(
  context: DatabaseContext,
  deadlineMs: number,
  limit = 100,
) {
  z.number().int().min(1000).max(86400000).parse(deadlineMs);
  z.number().int().min(1).max(100).parse(limit);
  return transaction(context.client, async () => {
    // Serialize bridge scans without requiring UPDATE privileges on the append-only ledger.
    await context.client.query("SELECT pg_advisory_xact_lock(173403,6)");
    const pending = await context.client.query<{ id: string; due_at: Date }>(
      `SELECT k.id,clock_timestamp() AS due_at FROM core.knowledge_index_obligations k
       WHERE NOT EXISTS(SELECT 1 FROM core.knowledge_index_bridges b WHERE b.obligation_id=k.id)
       ORDER BY k.created_at,k.id LIMIT $1`,
      [limit],
    );
    for (const row of pending.rows) {
      const id = await enqueue(context, {
        id: row.id,
        operationId: row.id,
        subjectId: row.id,
        revision: 1,
        kind: "knowledge.index",
        channel: "engagement",
        dueAt: row.due_at,
        deadlineAt: new Date(row.due_at.getTime() + deadlineMs),
      });
      await context.client.query(
        "INSERT INTO core.knowledge_index_bridges(obligation_id,job_id) VALUES($1,$2)",
        [row.id, id],
      );
    }
    return pending.rows.length;
  });
}

export const knowledgeVectorId = (reference: KnowledgeReference) =>
  sha256(
    new TextEncoder().encode(
      JSON.stringify(
        knowledgeReferenceSchema.parse({
          entryId: reference.entryId,
          revision: reference.revision,
          contentHash: reference.contentHash,
        }),
      ),
    ),
  );

/** Uses the same domain projection and primary repository as public reads. No providers. */
export async function currentKnowledgeProjection(context: DatabaseContext, entryId: string) {
  if (inTransaction(context.client))
    throw new Error("Projection requires its own short transaction.");
  const { client } = context;
  const authority: KnowledgeAuthority = {
    currentActor: async () => null,
    async isApprovalCurrent(approval, content) {
      for (const source of content.sources) {
        const result = await client.query(
          `SELECT source_id FROM core.knowledge_sources
          WHERE source_id=$1 AND revision=$2 AND sha256=$3 AND public_url=$4 AND revoked_at IS NULL FOR SHARE`,
          [source.sourceId, source.revision, source.sha256, source.publicUrl],
        );
        if (!result.rowCount) return false;
      }
      const actor = await client.query(
        "SELECT id FROM core.identity_actors WHERE id=$1 AND status='active' FOR SHARE",
        [approval.approverId],
      );
      if (!actor.rowCount) return false;
      const result = await client.query(
        `SELECT id FROM core.knowledge_grants WHERE actor_id=$1
        AND permission='approve' AND scope=$2 AND product_id IS NOT DISTINCT FROM $3::uuid
        AND language=$4 AND kind=$5 AND physician_qualified AND revoked_at IS NULL
        AND valid_from<=clock_timestamp() AND expires_at>clock_timestamp()
        AND authority_version=$6 AND evidence_id=$7 AND display_name=$8 FOR SHARE`,
        [
          approval.approverId,
          content.scope,
          content.productId,
          content.language,
          content.kind,
          approval.authorityVersion,
          approval.evidenceId,
          approval.approverDisplayName,
        ],
      );
      return !!result.rowCount;
    },
  };
  const store = createPostgresKnowledge(
    (run) => run(client),
    authority,
    async (_client, request) => {
      if (request.permission !== "read") return false;
      for (const record of request.entries)
        if (
          record.state !== "approved" ||
          !(await authority.isApprovalCurrent(record.approval, record.content))
        )
          return false;
      return true;
    },
  );
  // The outer lookup is only a hint. projectPublicKnowledge reloads and fences the reference.
  const row = await client.query<{ record: unknown }>(
    "SELECT record FROM core.knowledge_entries WHERE entry_id=$1",
    [entryId],
  );
  const record = await validateKnowledgeRecord(row.rows[0]?.record);
  if (!record) return { status: "blocked" as const, reason: "MISSING_PRIMARY" as const };
  if (record.state !== "approved")
    return { status: "blocked" as const, reason: "NOT_APPROVED" as const };
  return projectPublicKnowledge(referenceOf(record), store.repository, authority);
}

export type KnowledgeIndexPlan = {
  entryId: string;
  projection: PublicIndexProjection | null;
  vectorId: string | null;
  obsoleteIds: string[];
};

/** Called outside the platform execution transaction; reserves IDs before uncertain effects. */
export async function prepareKnowledgeIndex(
  context: DatabaseContext,
  job: ClaimedJob,
): Promise<KnowledgeIndexPlan> {
  if (
    job.kind !== "knowledge.index" ||
    job.channel !== "engagement" ||
    job.revision !== 1 ||
    job.subjectId !== job.operationId
  )
    throw new Error("Invalid knowledge index job.");
  const obligation = await context.client.query<{ entry_id: string }>(
    `SELECT k.entry_id FROM core.knowledge_index_obligations k JOIN core.knowledge_index_bridges b
     ON b.obligation_id=k.id WHERE k.id=$1 AND b.job_id=$2`,
    [job.operationId, job.id],
  );
  const entryId = obligation.rows[0]?.entry_id;
  if (!entryId) throw new Error("Missing knowledge bridge.");
  const result = await currentKnowledgeProjection(context, entryId);
  if (result.status === "not-ready") throw new Error("Knowledge primary unavailable.");
  const projection = result.status === "projected" ? result : null;
  const vectorId = projection ? await knowledgeVectorId(projection.reference) : null;
  return transaction(context.client, async () => {
    if (projection && vectorId)
      await context.client.query(
        "INSERT INTO core.knowledge_index_vectors(vector_id,entry_id,reference) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [vectorId, entryId, JSON.stringify(projection.reference)],
      );
    const ids = await context.client.query<{ vector_id: string }>(
      "SELECT vector_id FROM core.knowledge_index_vectors WHERE entry_id=$1 AND vector_id IS DISTINCT FROM $2",
      [entryId, vectorId],
    );
    return { entryId, projection, vectorId, obsoleteIds: ids.rows.map((row) => row.vector_id) };
  });
}
