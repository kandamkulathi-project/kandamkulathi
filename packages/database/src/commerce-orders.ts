import {
  type CommercePage,
  commerceGrantsSchema,
  commercePageSchema,
} from "../../contracts/src/commerce-access.ts";
import {
  type CommerceBatchPage,
  type CommerceOrderDetail,
  type CommerceOrderPage,
  commerceBatchPageSchema,
  commerceOrderDetailSchema,
  commerceOrderPageSchema,
} from "../../contracts/src/commerce-orders.ts";
import { canonicalUuidSchema } from "../../contracts/src/identifiers.ts";
import { type DatabaseContext, inTransaction, transaction } from "./client.ts";

export async function loadCommerceGrantsInTransaction(context: DatabaseContext, actorId: string) {
  if (!inTransaction(context.client))
    throw new Error("Commerce grants require an active transaction.");
  canonicalUuidSchema.parse(actorId);
  const result = await context.client.query<{
    id: string;
    actor_id: string;
    membership_id: string;
    clinic_id: string;
    action: string;
    valid_from: Date;
    expires_at: Date;
    revoked_at: Date | null;
  }>(
    `SELECT id,actor_id,membership_id,clinic_id,action,valid_from,expires_at,revoked_at
    FROM core.commerce_staff_grants WHERE actor_id=$1 ORDER BY id LIMIT 501 FOR SHARE`,
    [actorId],
  );
  return commerceGrantsSchema.parse(
    result.rows.map((row) => ({
      id: row.id,
      actorId: row.actor_id,
      membershipId: row.membership_id,
      clinicId: row.clinic_id,
      action: row.action,
      validFrom: row.valid_from.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      revokedAt: row.revoked_at?.toISOString() ?? null,
    })),
  );
}

type OrderRow = {
  id: string;
  location_id: string;
  amount_paise: string;
  currency: string;
  status: string;
  version: number;
  source: string;
  created_at: Date;
  expires_at: Date;
};
const summary = (row: OrderRow) => ({
  orderId: row.id,
  locationId: row.location_id,
  amountPaise: Number(row.amount_paise),
  currency: row.currency,
  status: row.status,
  version: row.version,
  source: row.source,
  createdAt: row.created_at.toISOString(),
  expiresAt: row.expires_at.toISOString(),
});

/** Caller supplies only server-verified identity; no database credentials or scopes from requests. */
export class CommerceOrdersRepository {
  readonly actorId: string;
  constructor(
    private readonly context: DatabaseContext,
    actorId: string,
    private readonly authorizeTransaction?: (context: DatabaseContext) => Promise<void>,
    private readonly resolveClinicLocation?: (
      context: DatabaseContext,
      clinicId: string,
    ) => Promise<string>,
  ) {
    this.actorId = canonicalUuidSchema.parse(actorId);
  }

  private async scoped<T>(callback: () => Promise<T>): Promise<T> {
    return transaction(this.context.client, async () => {
      await this.context.client.query("SELECT set_config('app.actor_id',$1,true)", [this.actorId]);
      await this.authorizeTransaction?.(this.context);
      return callback();
    });
  }

  async grants() {
    return this.scoped(() => loadCommerceGrantsInTransaction(this.context, this.actorId));
  }

  async orders(page: CommercePage, clinicId?: string): Promise<CommerceOrderPage> {
    const parsed = commercePageSchema.parse(page);
    const clinic = clinicId === undefined ? null : canonicalUuidSchema.parse(clinicId);
    return this.scoped(async () => {
      const location =
        clinic === null
          ? null
          : ((await this.resolveClinicLocation?.(this.context, clinic)) ?? clinic);
      const result = await this.context.client.query<OrderRow>(
        `SELECT id,location_id,amount_paise,currency,status,version,source,created_at,expires_at
        FROM core.commerce_orders WHERE ($1::uuid IS NULL OR id>$1)
        AND (($2::uuid IS NULL AND actor_id=$3) OR location_id=$2)
        ORDER BY id LIMIT $4`,
        [parsed.after ?? null, location, this.actorId, parsed.limit + 1],
      );
      const items = result.rows.slice(0, parsed.limit).map(summary);
      return commerceOrderPageSchema.parse({
        items,
        nextCursor: result.rows.length > parsed.limit ? (items.at(-1)?.orderId ?? null) : null,
      });
    });
  }

  async order(orderId: string, clinicId?: string): Promise<CommerceOrderDetail | null> {
    const id = canonicalUuidSchema.parse(orderId);
    const clinic = clinicId === undefined ? null : canonicalUuidSchema.parse(clinicId);
    return this.scoped(async () => {
      const location =
        clinic === null
          ? null
          : ((await this.resolveClinicLocation?.(this.context, clinic)) ?? clinic);
      const row = (
        await this.context.client.query<OrderRow>(
          `SELECT id,location_id,amount_paise,currency,status,version,source,created_at,expires_at
        FROM core.commerce_orders WHERE id=$1 AND (($2::uuid IS NULL AND actor_id=$3) OR location_id=$2)`,
          [id, location, this.actorId],
        )
      ).rows[0];
      if (!row) return null;
      const address =
        clinic === null
          ? ((
              await this.context.client.query<{ address: unknown }>(
                "SELECT address FROM core.commerce_order_addresses WHERE order_id=$1",
                [id],
              )
            ).rows[0]?.address ?? null)
          : null;
      const lines = (
        await this.context.client.query<{
          sku_id: string;
          quantity: number;
          sku_version: number;
          unit_paise: string;
          tax_paise: string;
          amount_paise: string;
          tax_policy_id: string;
        }>(
          `SELECT sku_id,quantity,sku_version,unit_paise,tax_paise,amount_paise,tax_policy_id
        FROM core.commerce_order_lines WHERE order_id=$1 ORDER BY sku_id LIMIT 101`,
          [id],
        )
      ).rows;
      return commerceOrderDetailSchema.parse({
        ...summary(row),
        deliveryAddress: address,
        lines: lines.map((line) => ({
          skuId: line.sku_id,
          quantity: line.quantity,
          version: line.sku_version,
          unitPaise: Number(line.unit_paise),
          taxPaise: Number(line.tax_paise),
          amountPaise: Number(line.amount_paise),
          taxPolicyId: line.tax_policy_id,
        })),
        documents: [],
        fulfillment: "unavailable",
      });
    });
  }

  async batches(page: CommercePage, clinicId: string): Promise<CommerceBatchPage> {
    const parsed = commercePageSchema.parse(page);
    const clinic = canonicalUuidSchema.parse(clinicId);
    return this.scoped(async () => {
      const location = (await this.resolveClinicLocation?.(this.context, clinic)) ?? clinic;
      const result = await this.context.client.query<{
        id: string;
        sku_id: string;
        location_id: string;
        batch_code: string;
        expires_on: string;
        recalled: boolean;
        on_hand: number;
        reserved: number;
      }>(
        `SELECT id,sku_id,location_id,batch_code,expires_on::text,recalled,on_hand,reserved
        FROM core.commerce_batches WHERE location_id=$1 AND ($2::uuid IS NULL OR id>$2)
        ORDER BY id LIMIT $3`,
        [location, parsed.after ?? null, parsed.limit + 1],
      );
      const items = result.rows.slice(0, parsed.limit).map((row) => ({
        batchId: row.id,
        skuId: row.sku_id,
        locationId: row.location_id,
        batchCode: row.batch_code,
        expiresOn: row.expires_on,
        recalled: row.recalled,
        onHand: row.on_hand,
        reserved: row.reserved,
      }));
      return commerceBatchPageSchema.parse({
        items,
        nextCursor: result.rows.length > parsed.limit ? (items.at(-1)?.batchId ?? null) : null,
      });
    });
  }
}
