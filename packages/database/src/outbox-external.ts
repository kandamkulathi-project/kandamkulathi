import { type DatabaseContext, inTransaction, transaction } from "./client.ts";
import type { ClaimedJob } from "./outbox.ts";

/**
 * Runs outside a platform transaction. Resolve ONLY after domain-owned committed
 * prepare/effect/reconciliation/checkpoint, not merely provider acceptance.
 * Recheck current approval/version/ownership in the domain; use stable provider
 * operation IDs and durable receipts to reconcile uncertain retries and overlap
 * with superseding leases. The platform fence is NOT domain authorization.
 *
 * Honor signal for every network request AND response stream, and before domain
 * checkpoints. Cancellation cannot retract a provider effect. An ignoring handler
 * cannot be forcibly stopped by JavaScript: we await it (never orphan work with
 * Promise.race), but never acknowledge its late result. Do not leave detached work
 * or an open transaction on context.client when returning/rejecting.
 */
export type ExternalHandler = (
  context: DatabaseContext,
  job: ClaimedJob,
  signal: AbortSignal,
) => Promise<void>;

type Result = "succeeded" | "suppressed" | "stale" | "dead";
class StaleCompletion extends Error {}

/** Short SQL-only boundary, both before and after external work. */
async function checkpoint(
  context: DatabaseContext,
  job: ClaimedJob,
  completed: boolean,
): Promise<Result | "ready"> {
  try {
    return await transaction(context.client, async () => {
      const { rows } = await context.client.query<{ valid: boolean; expired: boolean }>(
        `SELECT lease_token = $2 AND status = 'processing'
        AND lease_until > clock_timestamp() AND due_at <= clock_timestamp()
        AND operation_id = $3 AND channel = $4 AND kind = $5
        AND subject_id = $6 AND revision = $7 AND due_at = $8 AND deadline_at = $9 AS valid,
        deadline_at <= clock_timestamp() AS expired
      FROM platform.outbox WHERE id = $1 FOR UPDATE`,
        [
          job.id,
          job.leaseToken,
          job.operationId,
          job.channel,
          job.kind,
          job.subjectId,
          job.revision,
          job.dueAt,
          job.deadlineAt,
        ],
      );
      if (!rows[0]?.valid) return "stale";
      // Financial expiry is a durable review/DLQ disposition, never settlement.
      // Ordinary expiry after an effect remains unacknowledged for reconciliation.
      if (rows[0].expired) {
        const financialReview = job.kind === "commerce.reconcile";
        if (completed && !financialReview) return "stale";
        const suppressed = await context.client.query(
          `UPDATE platform.outbox SET status = $3, failure_code = $4,
        lease_token = NULL, lease_until = NULL WHERE id = $1 AND lease_token = $2
        AND status = 'processing' AND lease_until > clock_timestamp()
        AND deadline_at <= clock_timestamp() RETURNING id`,
          [
            job.id,
            job.leaseToken,
            financialReview ? "dead" : "suppressed",
            financialReview ? "financial_review_required" : "deadline_elapsed",
          ],
        );
        return suppressed.rows.length > 0 ? (financialReview ? "dead" : "suppressed") : "stale";
      }
      const receipt = await context.client.query<{ job_id: string }>(
        "SELECT job_id FROM platform.receipts WHERE operation_id = $1 AND kind = $2",
        [job.operationId, job.kind],
      );
      if (receipt.rows[0] && receipt.rows[0].job_id !== job.id)
        throw new Error("External operation receipt does not match its authoritative job.");
      if (!completed && receipt.rows.length === 0) return "ready";
      // Insert while the authoritative row is still processing (receipt RLS).
      // A failed final fence throws so the transaction rolls back that receipt.
      if (receipt.rows.length === 0) {
        const inserted = await context.client.query(
          `INSERT INTO platform.receipts(operation_id,kind,job_id)
        SELECT $3,$4,id FROM platform.outbox WHERE id = $1 AND lease_token = $2
        AND status = 'processing' AND lease_until > clock_timestamp()
        AND deadline_at > clock_timestamp() RETURNING job_id`,
          [job.id, job.leaseToken, job.operationId, job.kind],
        );
        if (inserted.rows.length === 0) return "stale";
      }
      const finished = await context.client.query(
        `UPDATE platform.outbox SET status = 'succeeded', completed_at = clock_timestamp(),
        lease_token = NULL, lease_until = NULL, failure_code = NULL
        WHERE id = $1 AND lease_token = $2 AND status = 'processing'
        AND lease_until > clock_timestamp() AND deadline_at > clock_timestamp()
        RETURNING id`,
        [job.id, job.leaseToken],
      );
      if (finished.rows.length === 0) throw new StaleCompletion();
      return "succeeded";
    });
  } catch (error) {
    if (error instanceof StaleCompletion) return "stale";
    throw error;
  }
}

/**
 * acquireExecution's 30-second lease is not extended. Preflight commits before
 * calling the handler; failures/uncertainty throw for existing releaseExecution
 * retry/DLQ handling. Node 24 and Workers support AbortSignal.timeout.
 * Concurrent deliveries must first use acquireExecution, never share a claim.
 */
export async function executeExternalClaim(
  context: DatabaseContext,
  job: ClaimedJob,
  handler: ExternalHandler,
): Promise<Result> {
  if (inTransaction(context.client))
    throw new Error("External execution cannot run inside a platform transaction.");
  const preflight = await checkpoint(context, job, false);
  if (preflight !== "ready") return preflight;
  const signal = AbortSignal.timeout(10_000);
  const started = performance.now();
  await handler(context, job, signal);
  signal.throwIfAborted();
  // Timers cannot fire while synchronous work blocks the event loop.
  if (performance.now() - started >= 10_000)
    throw new Error("External execution exceeded its ten-second budget.");
  const result = await checkpoint(context, job, true);
  if (result === "ready") throw new Error("External completion did not checkpoint.");
  return result;
}
