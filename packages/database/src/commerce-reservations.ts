import { CommerceError } from "../../contracts/src/commerce-catalogue.ts";
import { type DatabaseContext, transaction } from "./client.ts";
import { enqueue } from "./outbox.ts";

/** Trusted jobs-only scheduled sweep, not a public endpoint. Never releases paid/reconciliation stock. */
export async function expireCommerceReservations(
  context: DatabaseContext,
  limit = 100,
): Promise<{ expiredOrderIds: string[] }> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new CommerceError("invalid_input");
  return transaction(context.client, async () => {
    const { client } = context;
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    const role = (
      await client.query<{ jobs: boolean }>(
        "SELECT pg_has_role(current_user,'k_jobs_runtime','member') AS jobs",
      )
    ).rows[0];
    if (!role?.jobs) throw new CommerceError("denied");
    await client.query("SELECT set_config('app.commerce_expiry','verified',true)");
    const orders = (
      await client.query<{ id: string; version: number }>(
        `SELECT id,version FROM core.commerce_orders
      WHERE status='reserved' AND expires_at<=clock_timestamp() ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED`,
        [limit],
      )
    ).rows;
    const expiredOrderIds: string[] = [];
    for (const order of orders) {
      const reservations = (
        await client.query<{ batch_id: string; quantity: number }>(
          `SELECT r.batch_id,r.quantity
        FROM core.commerce_reservations r JOIN core.commerce_batches b ON b.id=r.batch_id
        WHERE r.order_id=$1 AND r.state='held' ORDER BY r.sku_id,b.expires_on,b.id FOR UPDATE OF r,b`,
          [order.id],
        )
      ).rows;
      for (const reservation of reservations) {
        const changed = await client.query(
          "UPDATE core.commerce_batches SET reserved=reserved-$2 WHERE id=$1 AND reserved>=$2 RETURNING id",
          [reservation.batch_id, reservation.quantity],
        );
        if (changed.rowCount !== 1) throw new CommerceError("stock_shortage");
        const released = await client.query(
          "UPDATE core.commerce_reservations SET state='released',released_at=clock_timestamp() WHERE order_id=$1 AND batch_id=$2 AND state='held' RETURNING order_id",
          [order.id, reservation.batch_id],
        );
        if (released.rowCount !== 1) throw new CommerceError("operation_conflict");
      }
      const changed = await client.query(
        "UPDATE core.commerce_orders SET status='expired',version=version+1 WHERE id=$1 AND version=$2 AND status='reserved' RETURNING id",
        [order.id, order.version],
      );
      if (changed.rowCount !== 1) throw new CommerceError("operation_conflict");
      const id = crypto.randomUUID();
      await client.query(
        "INSERT INTO core.commerce_reservation_expirations(order_id,id) VALUES($1,$2)",
        [order.id, id],
      );
      const timestamp = (await client.query<{ now: Date }>("SELECT clock_timestamp() AS now"))
        .rows[0]?.now;
      if (!timestamp) throw new CommerceError("unavailable");
      await enqueue(context, {
        id: crypto.randomUUID(),
        operationId: id,
        subjectId: order.id,
        channel: "financial",
        kind: "commerce.reconcile",
        revision: 1,
        dueAt: timestamp,
        deadlineAt: new Date(timestamp.getTime() + 86400000),
      });
      expiredOrderIds.push(order.id);
    }
    return { expiredOrderIds };
  });
}
