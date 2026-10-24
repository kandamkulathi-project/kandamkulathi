import {
  channelInboxReceiptSchema,
  type DurableChannelInbox,
} from "@kandamkulathi/contracts/channels";
import { type DatabaseContext, transaction } from "./client.ts";
import { enqueue, type TransactionalHandler } from "./outbox.ts";

/** Bound by trusted composition to an event-scoped runtime connection, after webhook verification. */
export function postgresChannelInbox(context: DatabaseContext): DurableChannelInbox {
  return {
    async commitBatch(input) {
      const receipts = channelInboxReceiptSchema.array().max(100).parse(input);
      return transaction(context.client, async () => {
        let inserted = 0;
        let duplicates = 0;
        // Stable order prevents reversed provider batches acquiring unique-key locks in opposite order.
        for (const receipt of [...receipts].sort((a, b) =>
          a.semanticKey < b.semanticKey ? -1 : a.semanticKey > b.semanticKey ? 1 : 0,
        )) {
          const id = crypto.randomUUID();
          const result = await context.client.query<{ id: string }>(
            `INSERT INTO engagement.mathew_channel_inbox(id,semantic_key,content_sha256,event)
             VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (semantic_key) DO NOTHING RETURNING id`,
            [id, receipt.semanticKey, receipt.contentSha256, JSON.stringify(receipt.event)],
          );
          if (!result.rows[0]) {
            const existing = await context.client.query<{ content_sha256: string }>(
              `SELECT content_sha256 FROM engagement.mathew_channel_inbox WHERE semantic_key=$1`,
              [receipt.semanticKey],
            );
            if (existing.rows[0]?.content_sha256 !== receipt.contentSha256)
              throw new Error("Channel event identity conflicts with committed content.");
            duplicates++;
            continue;
          }
          const operationId = crypto.randomUUID();
          await context.client.query(
            `INSERT INTO engagement.mathew_channel_processing(inbox_id,operation_id) VALUES ($1,$2)`,
            [id, operationId],
          );
          const clock = await context.client.query<{ now: Date }>(
            "SELECT clock_timestamp() AS now",
          );
          const now = clock.rows[0]?.now;
          if (!now) throw new Error("Database clock unavailable.");
          await enqueue(context, {
            id: crypto.randomUUID(),
            operationId,
            channel: "engagement",
            kind: "engagement.notify",
            subjectId: id,
            revision: 1,
            dueAt: now,
            // Transport pickup window only; expiry never deletes the durable processing obligation.
            deadlineAt: new Date(now.getTime() + 86_400_000),
          });
          inserted++;
        }
        return { outcome: "committed" as const, inserted, duplicates };
      });
    },
  };
}

/** Routes unlinked inbound events to durable human review; it does not claim a message was sent. */
export const channelIngressHandler: TransactionalHandler = {
  async decide({ client }, job) {
    const result = await client.query<{ revision: number; state: string; operation_id: string }>(
      `SELECT i.revision,i.state,p.operation_id FROM engagement.mathew_channel_inbox i
       JOIN engagement.mathew_channel_processing p ON p.inbox_id=i.id
       WHERE i.id=$1 FOR UPDATE OF i,p`,
      [job.subjectId],
    );
    const row = result.rows[0];
    if (!row) throw new Error("No channel ingress obligation matches this job.");
    if (row.operation_id !== job.operationId) return "not_authorized";
    return row.revision === job.revision ? "allow" : "version_changed";
  },
  async apply({ client }, job) {
    const result = await client.query(
      `UPDATE engagement.mathew_channel_processing SET state='awaiting_human'
       WHERE inbox_id=$1 AND operation_id=$2 RETURNING inbox_id`,
      [job.subjectId, job.operationId],
    );
    if (result.rowCount !== 1) throw new Error("Channel processing obligation missing.");
    await client.query(
      `UPDATE engagement.mathew_channel_inbox SET state='awaiting_human' WHERE id=$1`,
      [job.subjectId],
    );
  },
};
