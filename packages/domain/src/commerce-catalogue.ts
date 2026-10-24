import {
  CommerceError,
  type ImportControls,
  type ImportReport,
  type OpeningRow,
  openingRowSchema,
  type PricedLine,
} from "../../contracts/src/commerce-catalogue.ts";

export function safePaise(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new CommerceError("invalid_input");
  return Number(value);
}

/** Only the explicitly approved exclusive-base, half-up per-line policy is supported. */
export function priceLine(input: {
  skuId: string;
  quantity: number;
  version: number;
  unitPaise: number;
  taxPolicyId: string;
  rateBps: number;
}): PricedLine {
  if (
    ![input.quantity, input.version, input.unitPaise, input.rateBps].every(Number.isSafeInteger) ||
    input.quantity < 1 ||
    input.quantity > 1000 ||
    input.version < 1 ||
    input.unitPaise < 0 ||
    input.rateBps < 0 ||
    input.rateBps > 10000
  )
    throw new CommerceError("invalid_input");
  const base = BigInt(input.unitPaise) * BigInt(input.quantity);
  const tax = (base * BigInt(input.rateBps) + 5000n) / 10000n;
  return {
    skuId: input.skuId,
    quantity: input.quantity,
    version: input.version,
    unitPaise: input.unitPaise,
    taxPolicyId: input.taxPolicyId,
    rateBps: input.rateBps,
    taxPaise: safePaise(tax),
    amountPaise: safePaise(base + tax),
  };
}

export function validateOpeningImport(
  rows: unknown[],
  controls: ImportControls,
  today: string,
): { report: ImportReport; rows: OpeningRow[] } {
  const errors: ImportReport["errors"] = [];
  const parsed: OpeningRow[] = [];
  const skus = new Map<string, string>();
  const ids = new Map<string, string>();
  const batches = new Set<string>();
  const batchKeys = new Set<string>();
  let units = 0;
  let value = 0n;
  if (rows.length < 1 || rows.length > 10000) errors.push({ row: 0, code: "row_limit" });
  rows.forEach((row, index) => {
    const result = openingRowSchema.safeParse(row);
    if (!result.success) {
      errors.push({ row: index + 1, code: "invalid_row" });
      return;
    }
    const item = result.data;
    const metadata = openingSkuMetadata(item);
    if (
      (skus.has(item.sku) && skus.get(item.sku) !== item.skuId) ||
      (ids.has(item.skuId) && ids.get(item.skuId) !== metadata)
    )
      errors.push({ row: index + 1, code: "conflicting_sku" });
    const batchKey = JSON.stringify([item.skuId, item.locationId, item.batchCode]);
    if (batches.has(item.batchId) || batchKeys.has(batchKey))
      errors.push({ row: index + 1, code: "duplicate_batch" });
    if (item.expiresOn <= today) errors.push({ row: index + 1, code: "invalid_expiry" });
    skus.set(item.sku, item.skuId);
    ids.set(item.skuId, metadata);
    batches.add(item.batchId);
    batchKeys.add(batchKey);
    parsed.push(item);
    units += item.quantity;
    value += BigInt(item.unitPaise) * BigInt(item.quantity);
  });
  const totals = {
    rows: rows.length,
    units,
    baseValuePaise: value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : -1,
  };
  if (
    totals.baseValuePaise < 0 ||
    Object.keys(totals).some(
      (key) => totals[key as keyof ImportControls] !== controls[key as keyof ImportControls],
    )
  )
    errors.push({ row: 0, code: "control_totals" });
  return { report: { valid: errors.length === 0, errors, totals }, rows: parsed };
}

/** Opening rows may repeat identical SKU metadata across distinct batches/locations. */
export function openingSkuMetadata(item: OpeningRow): string {
  return JSON.stringify({
    skuId: item.skuId,
    sku: item.sku,
    name: item.name,
    variant: item.variant,
    description: item.description,
    imageUrl: item.imageUrl,
    concerns: item.concerns,
    approvedBy: item.approvedBy,
    consultOnly: item.consultOnly,
    unitPaise: item.unitPaise,
    taxPolicyId: item.taxPolicyId,
    minimumShelfLifeDays: item.minimumShelfLifeDays,
  });
}
