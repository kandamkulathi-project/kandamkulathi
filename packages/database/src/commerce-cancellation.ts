import {
  type CommerceCancellationRequest,
  type CommerceCancellationResult,
  commerceCancellationRequestSchema,
  commerceCancellationResultSchema,
} from "../../contracts/src/commerce-cancellation.ts";
import { CommerceError } from "../../contracts/src/commerce-catalogue.ts";
import { canonicalUuidSchema } from "../../contracts/src/identifiers.ts";
import { assertUnpaidOrderCancellation } from "../../domain/src/commerce-cancellation.ts";
import { type DatabaseContext, transaction } from "./client.ts";
import { enqueue } from "./outbox.ts";

/** Required SQL-only current identity/session fence; caller owns a non-owner Core connection. */
export async function cancelUnpaidCommerceOrder(
  context: DatabaseContext,
  actorId: string,
  orderId: string,
  input: CommerceCancellationRequest,
  authorizeTransaction: (context: DatabaseContext) => Promise<void>,
): Promise<CommerceCancellationResult> {
  canonicalUuidSchema.parse(actorId);
  canonicalUuidSchema.parse(orderId);
  const request = commerceCancellationRequestSchema.parse(input);
  return transaction(context.client, async () => {
    const { client } = context;
    await client.query(
      "SELECT set_config('app.actor_id',$1,true),set_config('app.commerce_mode','cancellation',true)",
      [actorId],
    );
    await authorizeTransaction(context);
    // Same subject fence and lock order as payment creation; never race a missing intent.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `cancellation:${request.operationId}`,
    ]);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `payment:order:${orderId}`,
    ]);
    const order = (
      await client.query<{ actor_id: string; status: string; version: number }>(
        "SELECT actor_id,status,version FROM core.commerce_orders WHERE id=$1 FOR UPDATE",
        [orderId],
      )
    ).rows[0];
    if (!order || order.actor_id !== actorId) throw new CommerceError("denied");
    const prior = (
      await client.query<{
        operation_id: string;
        order_id: string;
        expected_version: number;
        resulting_version: number;
      }>(
        "SELECT operation_id,order_id,expected_version,resulting_version FROM core.commerce_order_cancellations WHERE operation_id=$1 OR order_id=$2",
        [request.operationId, orderId],
      )
    ).rows;
    const result = (version: number) =>
      commerceCancellationResultSchema.parse({
        orderId,
        operationId: request.operationId,
        status: "cancelled",
        version,
        refund: "not_applicable",
      });
    if (prior.length) {
      const saved = prior[0];
      if (
        prior.length !== 1 ||
        !saved ||
        saved.operation_id !== request.operationId ||
        saved.order_id !== orderId ||
        saved.expected_version !== request.expectedVersion ||
        order.status !== "cancelled"
      )
        throw new CommerceError("operation_conflict");
      return result(saved.resulting_version);
    }
    const intents = await client.query(
      "SELECT id FROM core.commerce_payment_intents WHERE subject_kind='order' AND subject_id=$1",
      [orderId],
    );
    assertUnpaidOrderCancellation({
      ...order,
      expectedVersion: request.expectedVersion,
      hasPaymentIntent: intents.rows.length !== 0,
    });
    const policy = (
      await client.query<{ approval_reference: string }>(
        "SELECT approval_reference FROM core.commerce_cancellation_policy WHERE active FOR SHARE",
      )
    ).rows[0];
    if (!policy) throw new CommerceError("unavailable");
    await client.query(
      `INSERT INTO core.commerce_order_cancellations(operation_id,order_id,actor_id,expected_version,resulting_version,policy_reference) VALUES($1,$2,$3,$4,$5,$6)`,
      [
        request.operationId,
        orderId,
        actorId,
        order.version,
        order.version + 1,
        policy.approval_reference,
      ],
    );
    const timestamp = (await client.query<{ now: Date }>("SELECT clock_timestamp() AS now")).rows[0]
      ?.now;
    if (!timestamp) throw new CommerceError("unavailable");
    await enqueue(context, {
      id: crypto.randomUUID(),
      operationId: request.operationId,
      subjectId: orderId,
      channel: "financial",
      kind: "commerce.reconcile",
      revision: 1,
      dueAt: timestamp,
      deadlineAt: new Date(timestamp.getTime() + 86400000),
    });
    // The bounded SQL transition locks/checks untouched held stock and performs
    // the exact decrement/release itself; caller-prepared row touches are not proof.
    const changed = await client.query<{ version: number }>(
      "SELECT core.commerce_cancel_prepared_order($1,$2,$3) AS version",
      [orderId, request.operationId, order.version],
    );
    if (changed.rows[0]?.version !== order.version + 1)
      throw new CommerceError("operation_conflict");
    // No charge/refund ledger entries: no payment intent exists. Append-only cancellation
    // record + released reservation rows are the stock-release audit trail.
    return result(order.version + 1);
  });
}
