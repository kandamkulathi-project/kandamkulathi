import { z } from "zod";
import { type DatabaseClient, type DatabaseContext, inTransaction, transaction } from "./client.ts";
import { outbox } from "./schema.ts";

export const channelSchema = z.enum(["financial", "clinical", "engagement"]);
export type Channel = z.infer<typeof channelSchema>;
export const envelopeSchema = z
  .object({ schemaVersion: z.literal(1), id: z.uuid(), channel: channelSchema })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
const jobSchema = z
  .object({
    id: z.uuid(),
    operationId: z.uuid(),
    channel: channelSchema,
    kind: z.enum([
      "platform.probe",
      "commerce.reconcile",
      "clinical.reminder",
      "engagement.notify",
    ]),
    subjectId: z.uuid(),
    revision: z.number().int().positive(),
    dueAt: z.date(),
    deadlineAt: z.date(),
  })
  .strict()
  .refine((job) => job.deadlineAt > job.dueAt);
export type NewJob = z.infer<typeof jobSchema>;
export type ClaimedJob = NewJob & { leaseToken: string; pickupMs: number };
export type QueuePublisher = (channel: Channel, body: Envelope) => Promise<void>;
type Row = {
  id: string;
  operation_id: string;
  channel: Channel;
  kind: NewJob["kind"];
  subject_id: string;
  revision: number;
  due_at: Date;
  deadline_at: Date;
  lease_token: string;
  pickup_ms: number;
  status: string;
};
const fromRow = (row: Row): ClaimedJob => ({
  id: row.id,
  operationId: row.operation_id,
  channel: row.channel,
  kind: row.kind,
  subjectId: row.subject_id,
  revision: row.revision,
  dueAt: row.due_at,
  deadlineAt: row.deadline_at,
  leaseToken: row.lease_token,
  pickupMs: Number(row.pickup_ms),
});

/** Call inside the SAME transaction as the authoritative business write. Does not commit or publish. */
export async function enqueue(context: DatabaseContext, input: NewJob): Promise<string> {
  const job = jobSchema.parse(input);
  if (!inTransaction(context.client))
    throw new Error("Enqueue requires the shared transaction boundary.");
  const inserted = await context.db
    .insert(outbox)
    .values({ ...job, nextAttemptAt: job.dueAt })
    .onConflictDoNothing({ target: [outbox.operationId, outbox.kind] })
    .returning({ id: outbox.id });
  if (inserted[0]) return inserted[0].id;
  const existing = await context.client.query<{ id: string; compatible: boolean }>(
    `SELECT id,
    channel = $3 AND subject_id = $4 AND revision = $5 AND due_at = $6 AND deadline_at = $7 AS compatible
    FROM platform.outbox WHERE operation_id = $1 AND kind = $2`,
    [
      job.operationId,
      job.kind,
      job.channel,
      job.subjectId,
      job.revision,
      job.dueAt,
      job.deadlineAt,
    ],
  );
  if (!existing.rows[0]?.compatible)
    throw new Error("Operation identity was reused with conflicting inputs.");
  return existing.rows[0].id;
}

export async function claimDue(
  client: DatabaseClient,
  limit = 20,
  channel?: Channel,
): Promise<ClaimedJob[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid claim limit.");
  if (channel !== undefined) channelSchema.parse(channel);
  return transaction(client, async () => {
    await client.query(
      `WITH expired AS (SELECT id FROM platform.outbox
      WHERE status NOT IN ('succeeded','suppressed','dead') AND deadline_at <= clock_timestamp()
      AND (lease_until IS NULL OR lease_until <= clock_timestamp()) FOR UPDATE SKIP LOCKED LIMIT $1)
      UPDATE platform.outbox o SET status = 'suppressed', failure_code = 'deadline_elapsed',
      lease_token = NULL, lease_until = NULL FROM expired e WHERE o.id = e.id`,
      [limit],
    );
    // Once a notification has reached execution, its execution budget/backoff applies.
    // Publication exhaustion only expires never-consumed notifications; the deadline still wins.
    await client.query(
      `WITH exhausted AS (SELECT id FROM platform.outbox
      WHERE status NOT IN ('succeeded','suppressed','dead') AND (execution_attempts >= 5 OR
      (publish_attempts >= 5 AND execution_attempts = 0
      AND (status <> 'queued' OR next_attempt_at <= clock_timestamp())))
      AND (lease_until IS NULL OR lease_until <= clock_timestamp()) FOR UPDATE SKIP LOCKED LIMIT $1)
      UPDATE platform.outbox o SET status = 'dead', failure_code = 'retry_exhausted',
      lease_token = NULL, lease_until = NULL FROM exhausted e WHERE o.id = e.id`,
      [limit],
    );
    const claimed = await client.query<Row>(
      `WITH candidates AS (
      SELECT id FROM platform.outbox WHERE status IN ('pending','dispatching','queued','processing')
      AND due_at <= clock_timestamp() AND deadline_at > clock_timestamp()
      AND next_attempt_at <= clock_timestamp() AND publish_attempts < 5 AND execution_attempts < 5
      AND ($2::text IS NULL OR channel = $2)
      AND (lease_until IS NULL OR lease_until <= clock_timestamp())
      ORDER BY due_at, id FOR UPDATE SKIP LOCKED LIMIT $1
    ) UPDATE platform.outbox o SET status = 'dispatching', lease_token = gen_random_uuid(),
      lease_until = clock_timestamp() + interval '30 seconds', publish_attempts = o.publish_attempts + 1,
      claimed_at = clock_timestamp() FROM candidates c WHERE o.id = c.id
      RETURNING o.*, greatest(0, extract(epoch FROM (o.claimed_at - o.due_at)) * 1000)::float8 AS pickup_ms`,
      [limit, channel ?? null],
    );
    return claimed.rows.map(fromRow);
  });
}

/** The claim transaction has committed before a network publisher is invoked. */
export async function publishClaim(
  client: DatabaseClient,
  job: ClaimedJob,
  publish: QueuePublisher,
): Promise<boolean> {
  return publishClaims(client, [job], async (channel, bodies) =>
    publish(channel, bodies[0] as Envelope),
  );
}

/** One broker batch and one fenced checkpoint. Uncertain partial delivery is safe to redeliver. */
export async function publishClaims(
  client: DatabaseClient,
  jobs: ClaimedJob[],
  publish: (channel: Channel, bodies: Envelope[]) => Promise<void>,
): Promise<boolean> {
  const channel = jobs[0]?.channel;
  if (!channel || jobs.length > 100 || jobs.some((job) => job.channel !== channel))
    throw new Error("Invalid publication batch.");
  const identities = [jobs.map((job) => job.id), jobs.map((job) => job.leaseToken)];
  try {
    await publish(
      channel,
      jobs.map((job) => ({ schemaVersion: 1, id: job.id, channel: job.channel })),
    );
  } catch {
    await client.query(
      `UPDATE platform.outbox o SET status = 'pending', failure_code = 'publish_failed',
      lease_token = NULL, lease_until = NULL, next_attempt_at = clock_timestamp() + interval '30 seconds'
      FROM unnest($1::uuid[],$2::uuid[]) AS batch(id,token)
      WHERE o.id = batch.id AND o.lease_token = batch.token AND o.status = 'dispatching'`,
      identities,
    );
    return false;
  }
  // A very fast consumer may already have completed the job; never overwrite its state.
  await client.query(
    `UPDATE platform.outbox o SET status = 'queued', lease_token = NULL, lease_until = NULL,
    next_attempt_at = clock_timestamp() + interval '5 minutes', failure_code = NULL
    FROM unnest($1::uuid[],$2::uuid[]) AS batch(id,token)
    WHERE o.id = batch.id AND o.lease_token = batch.token AND o.status = 'dispatching'`,
    identities,
  );
  return true;
}

export type Decision = "allow" | "consent_revoked" | "version_changed" | "not_authorized";
export type TransactionalHandler = {
  /** Re-read authoritative consent/version/assignment under appropriate locks; no cached/queue authorization. */
  decide: (context: DatabaseContext, job: ClaimedJob) => Promise<Decision>;
  /** Bounded SQL only, using this transaction. External providers need separately reconciled operations. */
  apply: (context: DatabaseContext, job: ClaimedJob) => Promise<void>;
};
export type Handlers = Partial<Record<NewJob["kind"], TransactionalHandler>>;
export const probeHandlers: Handlers = {
  "platform.probe": {
    decide: async () => "allow",
    apply: async ({ client }, job) => {
      await client.query(
        "INSERT INTO platform.probe_effects(operation_id) VALUES ($1) ON CONFLICT DO NOTHING",
        [job.operationId],
      );
    },
  },
};

export async function acquireExecution(
  client: DatabaseClient,
  input: Envelope,
): Promise<ClaimedJob | "terminal" | "busy"> {
  const body = envelopeSchema.parse(input);
  return transaction(client, async () => {
    const result = await client.query<Row>(
      `SELECT *, 0::float8 AS pickup_ms FROM platform.outbox WHERE id = $1 FOR UPDATE`,
      [body.id],
    );
    const row = result.rows[0];
    if (!row || row.channel !== body.channel)
      throw new Error("Queue reference does not match its authoritative job.");
    if (["succeeded", "suppressed", "dead"].includes(row.status)) return "terminal";
    const acquired = await client.query<Row>(
      `UPDATE platform.outbox SET status = 'processing',
      lease_token = gen_random_uuid(), lease_until = clock_timestamp() + interval '30 seconds',
      next_attempt_at = clock_timestamp() + interval '30 seconds',
      execution_attempts = execution_attempts + 1 WHERE id = $1 AND execution_attempts < 5
      AND due_at <= clock_timestamp()
      AND (execution_attempts = 0 OR status IN ('dispatching','queued')
        OR next_attempt_at <= clock_timestamp())
      AND (status = 'dispatching' OR lease_until IS NULL OR lease_until <= clock_timestamp())
      RETURNING *, 0::float8 AS pickup_ms`,
      [body.id],
    );
    return acquired.rows[0] ? fromRow(acquired.rows[0]) : "busy";
  });
}

export async function executeClaim(
  context: DatabaseContext,
  job: ClaimedJob,
  handlers: Handlers,
): Promise<"succeeded" | "suppressed" | "stale"> {
  return transaction(context.client, async () => {
    const owned = await context.client.query<{ valid: boolean; expired: boolean }>(
      `SELECT
      lease_token = $2 AND status = 'processing' AND lease_until > clock_timestamp() AS valid,
      deadline_at <= clock_timestamp() AS expired FROM platform.outbox WHERE id = $1 FOR UPDATE`,
      [job.id, job.leaseToken],
    );
    if (!owned.rows[0]?.valid) return "stale";
    const handler = handlers[job.kind];
    let decision: Decision | "deadline_elapsed";
    if (owned.rows[0].expired) decision = "deadline_elapsed";
    else {
      if (!handler) throw new Error("No reviewed domain handler is registered.");
      decision = await handler.decide(context, job);
    }
    if (decision === "allow") {
      const fresh = (
        await context.client.query<{ lease_valid: boolean; expired: boolean }>(
          `SELECT
        lease_until > clock_timestamp() AS lease_valid, deadline_at <= clock_timestamp() AS expired
        FROM platform.outbox WHERE id=$1`,
          [job.id],
        )
      ).rows[0];
      if (!fresh?.lease_valid) return "stale";
      if (fresh.expired) decision = "deadline_elapsed";
    }
    if (decision !== "allow") {
      await context.client.query(
        `UPDATE platform.outbox SET status = 'suppressed', failure_code = $2,
        lease_token = NULL, lease_until = NULL WHERE id = $1`,
        [job.id, decision],
      );
      return "suppressed";
    }
    if (!handler) throw new Error("No reviewed domain handler is registered.");
    const receipt = await context.client.query(
      `SELECT 1 FROM platform.receipts WHERE operation_id = $1 AND kind = $2`,
      [job.operationId, job.kind],
    );
    if (receipt.rows.length === 0) {
      await handler.apply(context, job);
      await context.client.query(
        "INSERT INTO platform.receipts(operation_id,kind,job_id) VALUES ($1,$2,$3)",
        [job.operationId, job.kind, job.id],
      );
    }
    await context.client.query(
      `UPDATE platform.outbox SET status = 'succeeded', completed_at = clock_timestamp(),
      lease_token = NULL, lease_until = NULL, failure_code = NULL WHERE id = $1`,
      [job.id],
    );
    return "succeeded";
  });
}

export async function releaseExecution(client: DatabaseClient, job: ClaimedJob): Promise<void> {
  await client.query(
    `UPDATE platform.outbox SET status = 'pending', failure_code = 'execution_failed',
    lease_token = NULL, lease_until = NULL, next_attempt_at = clock_timestamp() + interval '30 seconds'
    WHERE id = $1 AND lease_token = $2 AND status = 'processing'`,
    [job.id, job.leaseToken],
  );
}
