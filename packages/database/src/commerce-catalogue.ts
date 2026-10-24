import { z } from "zod";
import {
  type CartInput,
  type CheckoutInput,
  type CommerceCataloguePage,
  type CommerceCheckout,
  CommerceError,
  type CommerceProduct,
  type CommerceQuote,
  cartSchema,
  checkoutSchema,
  commerceCataloguePageSchema,
  commerceProductSchema,
  type ImportControls,
  type ImportReport,
} from "../../contracts/src/commerce-catalogue.ts";
import {
  priceLine,
  safePaise,
  validateOpeningImport,
} from "../../domain/src/commerce-catalogue.ts";
import { type DatabaseContext, transaction } from "./client.ts";
import { enqueue } from "./outbox.ts";

type SkuRow = {
  id: string;
  unit_paise: string;
  version: number;
  tax_policy_id: string;
  consult_only: boolean;
  minimum_shelf_life_days: number;
};
type OrderRow = {
  id: string;
  amount_paise: string;
  currency: "INR";
  status: string;
  expires_at: Date;
  request_key: string;
  current: boolean;
};
const orderResult = (row: OrderRow): CommerceCheckout => {
  if (row.status !== "reserved") throw new CommerceError("operation_conflict");
  if (!row.current) throw new CommerceError("unavailable");
  return {
    orderId: row.id,
    amountPaise: safePaise(BigInt(row.amount_paise)),
    currency: row.currency,
    status: "reserved",
    expiresAt: row.expires_at.toISOString(),
  };
};

export type CommercePage = { limit: number; after?: string };
export type CommerceOrderSource = "web" | "native";
export type CommerceCatalogueOptions = {
  source?: CommerceOrderSource;
  authorizeTransaction?: (context: DatabaseContext) => Promise<void>;
};
const publicProjection = `SELECT id AS "skuId",sku,name,variant,description,image_url AS "imageUrl",concerns,
 unit_paise::text AS "unitPaise",version,consult_only AS "consultOnly",
 CASE WHEN core.commerce_stock_visible(id) THEN 'available' ELSE 'unavailable' END AS "stockStatus"
 FROM core.commerce_skus WHERE published`;
const publicProduct = (row: Record<string, unknown>): CommerceProduct =>
  commerceProductSchema.parse({
    ...row,
    unitPaise: safePaise(BigInt(String(row.unitPaise))),
  });

/** Public read, no fabricated actor/context. Stock is a safe display hint, never purchase authority. */
export async function readCommerceCatalogue(
  context: DatabaseContext,
  page: CommercePage,
): Promise<CommerceCataloguePage> {
  const parsed = z
    .strictObject({ limit: z.number().int().min(1).max(100), after: z.uuid().optional() })
    .parse(page);
  const rows = (
    await context.client.query(
      `${publicProjection} AND ($2::uuid IS NULL OR id>$2::uuid) ORDER BY id LIMIT $1`,
      [parsed.limit + 1, parsed.after ?? null],
    )
  ).rows;
  const items = rows.slice(0, parsed.limit).map(publicProduct);
  return commerceCataloguePageSchema.parse({
    items,
    nextCursor: rows.length > parsed.limit ? (items.at(-1)?.skuId ?? null) : null,
  });
}

export async function readCommerceProduct(
  context: DatabaseContext,
  id: string,
): Promise<CommerceProduct | null> {
  z.uuid().parse(id);
  const row = (await context.client.query(`${publicProjection} AND id=$1`, [id])).rows[0];
  return row ? publicProduct(row) : null;
}

/** Construct only with a server-verified actor. All mutable authority is loaded under DB locks. */
export class CommerceCatalogueRepository {
  private readonly actorId: string;
  private readonly context: DatabaseContext;
  private readonly source: CommerceOrderSource;
  private readonly authorizeTransaction: ((context: DatabaseContext) => Promise<void>) | undefined;
  constructor(context: DatabaseContext, actorId: string, options: CommerceCatalogueOptions = {}) {
    this.context = context;
    this.actorId = z.uuid().parse(actorId);
    this.source = z.enum(["web", "native"]).parse(options.source ?? "web");
    this.authorizeTransaction = options.authorizeTransaction;
  }

  private async scoped<T>(work: () => Promise<T>): Promise<T> {
    // Retry only server-confirmed aborted transactions, never uncertain COMMIT/network failures.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await transaction(this.context.client, async () => {
          await this.context.client.query("SET LOCAL TIME ZONE 'UTC'");
          await this.context.client.query("SELECT set_config('app.actor_id',$1,true)", [
            this.actorId,
          ]);
          await this.authorizeTransaction?.(this.context);
          return work();
        });
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== "40P01" && code !== "40001" && code !== "55P03") throw error;
        if (attempt === 2) throw new CommerceError("retry_exhausted");
      }
    }
    throw new CommerceError("retry_exhausted");
  }

  catalogue(page: CommercePage): Promise<CommerceCataloguePage> {
    return readCommerceCatalogue(this.context, page);
  }
  product(id: string): Promise<CommerceProduct | null> {
    return readCommerceProduct(this.context, id);
  }

  private async price(input: CartInput): Promise<{ quote: CommerceQuote; skus: SkuRow[] }> {
    const { client } = this.context;
    // Trusted transaction-only capability; never taken from request JSON or public reads.
    await client.query("SELECT set_config('app.commerce_mode','checkout',true)");
    const ids = input.lines.map((line) => line.skuId).sort();
    const skus = (
      await client.query<SkuRow>(
        `SELECT id,unit_paise,version,tax_policy_id,consult_only,minimum_shelf_life_days
      FROM core.commerce_skus WHERE id=ANY($1::uuid[]) AND published ORDER BY id FOR SHARE`,
        [ids],
      )
    ).rows;
    if (skus.length !== ids.length) throw new CommerceError("unavailable");
    const policyIds = [...new Set(skus.map((sku) => sku.tax_policy_id))].sort();
    const policies = (
      await client.query<{ id: string; rate_bps: number }>(
        `SELECT id,rate_bps FROM core.commerce_tax_policies
      WHERE id=ANY($1::uuid[]) AND active AND basis='exclusive' AND rounding='half_up_line' ORDER BY id FOR SHARE`,
        [policyIds],
      )
    ).rows;
    const lines = skus.map((sku) => {
      if (sku.consult_only) throw new CommerceError("denied");
      const policy = policies.find((item) => item.id === sku.tax_policy_id);
      const line = input.lines.find((item) => item.skuId === sku.id);
      if (!policy || !line) throw new CommerceError("denied");
      return priceLine({
        skuId: sku.id,
        quantity: line.quantity,
        version: sku.version,
        unitPaise: safePaise(BigInt(sku.unit_paise)),
        taxPolicyId: policy.id,
        rateBps: policy.rate_bps,
      });
    });
    const amountPaise = safePaise(
      lines.reduce((total, line) => total + BigInt(line.amountPaise), 0n),
    );
    // A comparison token, NOT an authorization credential; recomputed under locks on checkout.
    const quoteKey = JSON.stringify({ locationId: input.locationId, lines, amountPaise });
    return { quote: { lines, amountPaise, currency: "INR", quoteKey }, skus };
  }

  async quote(input: CartInput): Promise<CommerceQuote> {
    const cart = cartSchema.parse(input);
    return this.scoped(async () => (await this.price(cart)).quote);
  }

  async checkout(input: CheckoutInput): Promise<CommerceCheckout> {
    const cart = checkoutSchema.parse(input);
    const source = this.source;
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        JSON.stringify({
          ...cart,
          source,
          lines: [...cart.lines].sort((a, b) => a.skuId.localeCompare(b.skuId)),
          versions: Object.fromEntries(Object.entries(cart.versions).sort()),
        }),
      ),
    );
    // Do not leak the address into staff-readable operation fingerprints on orders.
    const requestKey = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    return this.scoped(async () => {
      const { client } = this.context;
      // Serializes duplicate operation IDs before inspecting persisted state.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        cart.operationId,
      ]);
      const existing = (
        await client.query<OrderRow>(
          "SELECT *,expires_at>clock_timestamp() AS current FROM core.commerce_orders WHERE operation_id=$1",
          [cart.operationId],
        )
      ).rows[0];
      if (existing) {
        if (existing.request_key !== requestKey) throw new CommerceError("operation_conflict");
        return orderResult(existing);
      }
      const holdPolicy = (
        await client.query<{ hold_seconds: number; approval_reference: string }>(
          "SELECT hold_seconds,approval_reference FROM core.commerce_checkout_policies WHERE singleton AND active FOR SHARE",
        )
      ).rows[0];
      if (!holdPolicy) throw new CommerceError("denied");
      const { quote, skus } = await this.price(cart);
      if (
        quote.quoteKey !== cart.quoteKey ||
        quote.lines.some((line) => cart.versions[line.skuId] !== line.version)
      )
        throw new CommerceError("stale_version");
      const orderId = crypto.randomUUID();
      const timing = (
        await client.query<{ now: Date; expires: Date }>(
          "SELECT clock_timestamp() AS now, clock_timestamp()+make_interval(secs=>$1::integer) AS expires",
          [holdPolicy.hold_seconds],
        )
      ).rows[0];
      if (!timing) throw new CommerceError("unavailable");
      await client.query(
        `INSERT INTO core.commerce_orders(id,operation_id,actor_id,location_id,request_key,amount_paise,expires_at,source,hold_policy_reference)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          orderId,
          cart.operationId,
          this.actorId,
          cart.locationId,
          requestKey,
          quote.amountPaise,
          timing.expires,
          source,
          holdPolicy.approval_reference,
        ],
      );
      await client.query(
        "INSERT INTO core.commerce_order_addresses(order_id,address) VALUES($1,$2::jsonb)",
        [orderId, JSON.stringify(cart.deliveryAddress)],
      );
      // Sorted SKU order then deterministic FEFO order. Guard failures abort every dependent write.
      for (const line of quote.lines) {
        const sku = skus.find((item) => item.id === line.skuId);
        if (!sku) throw new CommerceError("unavailable");
        await client.query(
          `INSERT INTO core.commerce_order_lines(order_id,sku_id,quantity,sku_version,unit_paise,tax_paise,amount_paise,tax_policy_id,tax_rate_bps)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            orderId,
            line.skuId,
            line.quantity,
            line.version,
            line.unitPaise,
            line.taxPaise,
            line.amountPaise,
            line.taxPolicyId,
            line.rateBps,
          ],
        );
        const batches = (
          await client.query<{ id: string; available: number }>(
            `SELECT id,on_hand-reserved AS available FROM core.commerce_batches
          WHERE sku_id=$1 AND location_id=$2 AND NOT recalled AND expires_on>CURRENT_DATE+$3::integer AND on_hand>reserved
          ORDER BY expires_on,id FOR UPDATE`,
            [line.skuId, cart.locationId, sku.minimum_shelf_life_days],
          )
        ).rows;
        let remaining = line.quantity;
        for (const batch of batches) {
          if (remaining === 0) break;
          const quantity = Math.min(remaining, batch.available);
          const updated = await client.query(
            `UPDATE core.commerce_batches SET reserved=reserved+$2 WHERE id=$1
            AND on_hand-reserved >= $2 AND NOT recalled AND expires_on>CURRENT_DATE+$3::integer RETURNING id`,
            [batch.id, quantity, sku.minimum_shelf_life_days],
          );
          if (updated.rowCount !== 1) throw new CommerceError("stock_shortage");
          await client.query(
            "INSERT INTO core.commerce_reservations(order_id,sku_id,batch_id,quantity) VALUES($1,$2,$3,$4)",
            [orderId, line.skuId, batch.id, quantity],
          );
          remaining -= quantity;
        }
        if (remaining !== 0) throw new CommerceError("stock_shortage");
      }
      await enqueue(this.context, {
        id: crypto.randomUUID(),
        operationId: cart.operationId,
        channel: "financial",
        kind: "commerce.reconcile",
        subjectId: orderId,
        revision: 1,
        dueAt: timing.now,
        deadlineAt: new Date(timing.now.getTime() + 86400000),
      });
      return {
        orderId,
        amountPaise: quote.amountPaise,
        currency: "INR",
        status: "reserved",
        expiresAt: timing.expires.toISOString(),
      };
    });
  }

  async importOpening(
    operationId: string,
    rows: unknown[],
    controls: ImportControls,
  ): Promise<ImportReport> {
    z.uuid().parse(operationId);
    return this.scoped(async () => {
      const today = (
        await this.context.client.query<{ today: string }>("SELECT CURRENT_DATE::text AS today")
      ).rows[0]?.today;
      if (!today) throw new CommerceError("unavailable");
      const validated = validateOpeningImport(rows, controls, today);
      if (!validated.report.valid) return validated.report;
      const payload = JSON.stringify(validated.rows);
      const prior = (
        await this.context.client.query<{ compatible: boolean }>(
          "SELECT request_key=$2::jsonb::text AS compatible FROM core.commerce_imports WHERE operation_id=$1",
          [operationId, payload],
        )
      ).rows[0];
      if (prior) {
        if (!prior.compatible) throw new CommerceError("operation_conflict");
        return validated.report;
      }
      const result = await this.context.client.query<{ errors: ImportReport["errors"] }>(
        "SELECT core.commerce_opening_import($1,$2::jsonb,$3::jsonb) AS errors",
        [operationId, payload, JSON.stringify(controls)],
      );
      const errors = z
        .array(z.strictObject({ row: z.number().int().positive(), code: z.string().min(1) }))
        .parse(result.rows[0]?.errors);
      if (errors.length) return { ...validated.report, valid: false, errors };
      return validated.report;
    });
  }
}
