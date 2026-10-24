import {
  type NoticeProvider,
  noticeCapabilitySchema,
} from "../../contracts/src/channel-notices.ts";
import { channelInboxReceiptSchema } from "../../contracts/src/channels.ts";
import { maySubmitNotice } from "../../domain/src/channel-notices.ts";
import { channelIngressHandler } from "./channels.ts";
import { transaction } from "./client.ts";
import type { ExternalHandler } from "./outbox-external.ts";

/** This route owns only persisted mathew_channel_processing obligations. No new platform job kind. */
export function channelNoticeHandler(
  capabilityId?: string,
  provider?: NoticeProvider,
): ExternalHandler {
  return async (context, job, signal) => {
    const { client } = context;
    // Human routing is an independent committed obligation, never conditional on a test send.
    await transaction(client, async () => {
      const fence = await client.query(
        `SELECT id FROM platform.outbox WHERE id=$1 AND operation_id=$2 AND subject_id=$3
         AND kind='engagement.notify' AND channel='engagement' AND revision=$4
         AND status='processing' AND lease_token=$5 AND lease_until>clock_timestamp()
         AND deadline_at>clock_timestamp() FOR UPDATE`,
        [job.id, job.operationId, job.subjectId, job.revision, job.leaseToken],
      );
      if (!fence.rowCount || (await channelIngressHandler.decide(context, job)) !== "allow")
        throw new Error("Notice ingress unavailable.");
      await channelIngressHandler.apply(context, job);
    });
    const submission = await transaction(client, async () => {
      // Lock the current platform fence before consuming a quota or reserving an effect.
      const fence = await client.query(
        `SELECT id FROM platform.outbox WHERE id=$1 AND operation_id=$2 AND subject_id=$3
         AND kind='engagement.notify' AND channel='engagement' AND revision=$4
         AND status='processing' AND lease_token=$5 AND lease_until>clock_timestamp()
         AND due_at<=clock_timestamp() AND deadline_at>clock_timestamp() FOR UPDATE`,
        [job.id, job.operationId, job.subjectId, job.revision, job.leaseToken],
      );
      if (!fence.rowCount) throw new Error("Notice execution fence unavailable.");
      const ingress = await channelIngressHandler.decide(context, job);
      if (ingress !== "allow") throw new Error("Notice ingress unavailable.");
      const previous = await client.query<{ state: string }>(
        "SELECT state FROM engagement.channel_notices WHERE inbox_id=$1 FOR UPDATE",
        [job.subjectId],
      );
      if (previous.rows[0]) {
        if (["accepted", "suppressed"].includes(previous.rows[0].state)) return null;
        // A prior process may have died after commit or after provider acceptance. No resend.
        if (previous.rows[0].state === "sending")
          await client.query(
            "UPDATE engagement.channel_notices SET state='unknown' WHERE inbox_id=$1",
            [job.subjectId],
          );
        return "blocked" as const;
      }
      const suppress = async (
        reason: "configuration_unavailable" | "approval_unavailable" | "ineligible",
      ) => {
        await client.query(
          `INSERT INTO engagement.channel_notices(inbox_id,operation_id,state,lease_token,suppression_reason)
           VALUES($1,$2,'suppressed',$3,$4)`,
          [job.subjectId, job.operationId, job.leaseToken, reason],
        );
        return null;
      };
      if (!capabilityId || !provider) return suppress("configuration_unavailable");
      const row = (
        await client.query<{ capability: unknown; revision: number; used: number; now: Date }>(
          `SELECT capability,revision,used,clock_timestamp() AS now
         FROM engagement.channel_notice_capabilities WHERE id=$1 FOR UPDATE`,
          [capabilityId],
        )
      ).rows[0];
      if (!row?.capability || typeof row.capability !== "object")
        return suppress("approval_unavailable");
      const parsedCap = noticeCapabilitySchema.safeParse({
        ...row.capability,
        id: capabilityId,
        revision: row.revision,
        used: row.used,
      });
      if (!parsedCap.success) return suppress("approval_unavailable");
      const cap = parsedCap.data;
      const eventRow = (
        await client.query<{ event: unknown }>(
          "SELECT event FROM engagement.mathew_channel_inbox WHERE id=$1",
          [job.subjectId],
        )
      ).rows[0];
      const event = channelInboxReceiptSchema.shape.event.parse(eventRow?.event);
      if (!maySubmitNotice(cap, event, row.now.getTime())) return suppress("ineligible");
      await client.query(
        `INSERT INTO engagement.channel_notices(inbox_id,operation_id,capability_id,capability_revision,state,lease_token)
         VALUES ($1,$2,$3,$4,'sending',$5)`,
        [job.subjectId, job.operationId, capabilityId, cap.revision, job.leaseToken],
      );
      return {
        operationId: job.operationId,
        recipientId: cap.recipientId,
        phoneNumberId: cap.phoneNumberId,
        templateName: cap.templateName,
        language: cap.language,
      };
    });
    if (submission === null) return; // Durable accepted OR explicitly suppressed notice; human route is complete.
    if (submission === "blocked") throw new Error("Notice requires operator reconciliation.");
    // A committed sending reservation survives cancellation/crash. Provider I/O is never in SQL.
    signal.throwIfAborted();
    if (!provider) throw new Error("Notice provider unavailable.");
    const result = await provider.send(submission, signal);
    await transaction(client, async () => {
      // Serialize platform lease replacement/release through COMMIT, not just an EXISTS snapshot.
      const fence = await client.query(
        `SELECT id FROM platform.outbox WHERE id=$1 AND lease_token=$2
         AND status='processing' AND lease_until>clock_timestamp()
         AND deadline_at>clock_timestamp() FOR UPDATE`,
        [job.id, job.leaseToken],
      );
      if (fence.rowCount !== 1) throw new Error("Notice completion fence expired.");
      const updated = await client.query(
        `UPDATE engagement.channel_notices n SET state=$4,provider_message_id=$5
         WHERE n.inbox_id=$1 AND n.operation_id=$2 AND n.lease_token=$3 AND n.state='sending'
         AND EXISTS (SELECT 1 FROM platform.outbox o WHERE o.id=$6 AND o.lease_token=$3
           AND o.status='processing' AND o.lease_until>clock_timestamp() AND o.deadline_at>clock_timestamp())
         RETURNING inbox_id`,
        [
          job.subjectId,
          job.operationId,
          job.leaseToken,
          result.state,
          result.state === "accepted" ? result.providerMessageId : null,
          job.id,
        ],
      );
      if (updated.rowCount !== 1) throw new Error("Notice completion fence expired.");
    });
    if (result.state !== "accepted") throw new Error("Notice not acknowledged by provider.");
  };
}
