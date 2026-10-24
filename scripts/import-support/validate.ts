/** Synthetic local draft format only. No database, network, write adapter or production rules. */
type Clinic = { kind: "clinic"; id: string; label: string };
type Product = { kind: "product"; id: string; label: string };
type Variant = { kind: "variant"; id: string; productId: string; pricePaise: number };
type Batch = {
  kind: "batch";
  id: string;
  variantId: string;
  clinicId: string;
  expiresOn: string;
  quantity: number;
};
type Row = Clinic | Product | Variant | Batch;
export type Controls = {
  clinics: number;
  products: number;
  variants: number;
  batches: number;
  units: number;
  retailExtensionPaise: number;
};
export type ImportIssue = { row: number; codes: string[] };
export type ImportReport =
  | { status: "invalid-input"; readyForWrite: false; reason: string }
  | {
      status: "dry-run";
      readyForWrite: false;
      synthetic: true;
      asOf: string;
      inputRows: number;
      acceptedRows: number;
      invalidRows: ImportIssue[];
      controls: { expected: Controls; actual: Controls; differences: Controls; match: boolean };
      review: "JOSIN_REVIEW_REQUIRED";
    };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_OBJECT");
  return value as Record<string, unknown>;
}
function exact(row: Record<string, unknown>, keys: string[]) {
  if (Object.keys(row).sort().join(",") !== keys.sort().join(","))
    throw new Error("INVALID_FIELDS");
}
function id(value: unknown): string {
  if (typeof value !== "string" || !/^syn-[a-z0-9-]{1,60}$/.test(value))
    throw new Error("INVALID_SYNTHETIC_ID");
  return value;
}
function integer(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(code);
  return value;
}
function label(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 160 ||
    Array.from(value).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    throw new Error("INVALID_LABEL");
  return value;
}
function date(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new Error("INVALID_DATE");
  return value;
}
function parseRow(input: unknown): Row {
  const row = record(input);
  const key = id(row.id);
  if (row.kind === "clinic" || row.kind === "product") {
    exact(row, ["kind", "id", "label"]);
    return { kind: row.kind, id: key, label: label(row.label) };
  }
  if (row.kind === "variant") {
    exact(row, ["kind", "id", "productId", "pricePaise"]);
    return {
      kind: row.kind,
      id: key,
      productId: id(row.productId),
      pricePaise: integer(row.pricePaise, "INVALID_PRICE"),
    };
  }
  if (row.kind === "batch") {
    exact(row, ["kind", "id", "variantId", "clinicId", "expiresOn", "quantity"]);
    return {
      kind: row.kind,
      id: key,
      variantId: id(row.variantId),
      clinicId: id(row.clinicId),
      expiresOn: date(row.expiresOn),
      quantity: integer(row.quantity, "INVALID_QUANTITY"),
    };
  }
  throw new Error("INVALID_KIND");
}
const emptyControls = (): Controls => ({
  clinics: 0,
  products: 0,
  variants: 0,
  batches: 0,
  units: 0,
  retailExtensionPaise: 0,
});
const controlKeys = Object.keys(emptyControls()) as (keyof Controls)[];
function parseControls(input: unknown): Controls {
  const value = record(input);
  exact(value, [...controlKeys]);
  const result = emptyControls();
  for (const key of controlKeys) result[key] = integer(value[key], "INVALID_CONTROLS");
  return result;
}

export function validateSyntheticImport(input: unknown): ImportReport {
  try {
    const envelope = record(input);
    exact(envelope, ["version", "synthetic", "asOf", "rows", "expected"]);
    if (
      envelope.version !== 1 ||
      envelope.synthetic !== true ||
      !Array.isArray(envelope.rows) ||
      envelope.rows.length > 10000
    )
      throw new Error("INVALID_ENVELOPE");
    const asOf = date(envelope.asOf);
    const expected = parseControls(envelope.expected);
    const issues = new Map<number, Set<string>>();
    const add = (index: number, code: string) => {
      const codes = issues.get(index) ?? new Set<string>();
      codes.add(code);
      issues.set(index, codes);
    };
    const rows: (Row | null)[] = envelope.rows.map((inputRow, index) => {
      try {
        return parseRow(inputRow);
      } catch (error) {
        add(index, error instanceof Error ? error.message : "INVALID_ROW");
        return null;
      }
    });
    // Duplicate keys invalidate every occurrence, including an otherwise malformed occurrence.
    const identities = new Map<string, number[]>();
    envelope.rows.forEach((inputRow, index) => {
      if (!inputRow || typeof inputRow !== "object" || Array.isArray(inputRow)) return;
      const raw = inputRow as Record<string, unknown>;
      if (
        !["clinic", "product", "variant", "batch"].includes(String(raw.kind)) ||
        typeof raw.id !== "string"
      )
        return;
      const key = `${raw.kind}:${raw.id}`;
      identities.set(key, [...(identities.get(key) ?? []), index]);
    });
    for (const indices of identities.values())
      if (indices.length > 1) for (const index of indices) add(index, "DUPLICATE_ID");
    const valid = (kind: Row["kind"], key: string) =>
      rows.some((row, index) => row?.kind === kind && row.id === key && !issues.has(index));
    // Validate in dependency order, independent of file order; invalid parents never contribute.
    rows.forEach((row, index) => {
      if (row?.kind === "variant" && !valid("product", row.productId))
        add(index, "INVALID_PRODUCT_REFERENCE");
    });
    rows.forEach((row, index) => {
      if (row?.kind !== "batch") return;
      if (!valid("variant", row.variantId)) add(index, "INVALID_VARIANT_REFERENCE");
      if (!valid("clinic", row.clinicId)) add(index, "INVALID_CLINIC_REFERENCE");
      // Synthetic fixture convention, not an authoritative shelf-life/FEFO policy.
      if (row.expiresOn <= asOf) add(index, "EXPIRY_REVIEW");
    });
    const actual = emptyControls();
    rows.forEach((row, index) => {
      if (!row || issues.has(index)) return;
      if (row.kind === "clinic") actual.clinics++;
      if (row.kind === "product") actual.products++;
      if (row.kind === "variant") actual.variants++;
      if (row.kind === "batch") {
        const variant = rows.find(
          (candidate): candidate is Variant =>
            candidate?.kind === "variant" && candidate.id === row.variantId,
        );
        if (!variant) throw new Error("INVALID_VARIANT_REFERENCE");
        const extension = row.quantity * variant.pricePaise;
        if (
          !Number.isSafeInteger(extension) ||
          !Number.isSafeInteger(actual.units + row.quantity) ||
          !Number.isSafeInteger(actual.retailExtensionPaise + extension)
        )
          throw new Error("CONTROL_TOTAL_OVERFLOW");
        actual.batches++;
        actual.units += row.quantity;
        actual.retailExtensionPaise += extension;
      }
    });
    const differences = emptyControls();
    for (const key of controlKeys) differences[key] = actual[key] - expected[key];
    return {
      status: "dry-run",
      readyForWrite: false,
      synthetic: true,
      asOf,
      inputRows: rows.length,
      acceptedRows: rows.length - issues.size,
      invalidRows: [...issues]
        .sort(([a], [b]) => a - b)
        .map(([row, codes]) => ({ row: row + 1, codes: [...codes].sort() })),
      controls: {
        expected,
        actual,
        differences,
        match: controlKeys.every((key) => differences[key] === 0),
      },
      review: "JOSIN_REVIEW_REQUIRED",
    };
  } catch (error) {
    return {
      status: "invalid-input",
      readyForWrite: false,
      reason: error instanceof Error ? error.message : "INVALID_INPUT",
    };
  }
}

export function validateSyntheticImportText(text: string): ImportReport {
  if (new TextEncoder().encode(text).byteLength > 2_000_000)
    return { status: "invalid-input", readyForWrite: false, reason: "INPUT_TOO_LARGE" };
  try {
    return validateSyntheticImport(JSON.parse(text));
  } catch {
    return { status: "invalid-input", readyForWrite: false, reason: "INVALID_JSON" };
  }
}
