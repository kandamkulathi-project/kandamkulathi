import { apiOrigin, type Resource } from "@kandamkulathi/client";

export const staffKinds = ["orders", "batches", "schedules"] as const;
export type StaffKind = (typeof staffKinds)[number];
export type StaffRow = { id: string; clinicLabel: string } & (
  | {
      kind: "orders";
      status: string;
      reference: string;
      totalPaise: number;
      metadata?: {
        locationId: string;
        currency: "INR";
        version: number;
        source: string;
        createdAt: string;
        expiresAt: string;
      };
    }
  | ({
      kind: "batches";
      productLabel: string;
      batchCode: string;
      expiresOn: string;
    } & ( // Legacy fixtures stay supported without pretending missing stock facts are zero/false.
      | {
          quantity: number;
          status: string;
          onHand?: never;
          reserved?: never;
          recalled?: never;
          locationId?: never;
          skuId?: never;
        }
      | {
          onHand: number;
          reserved: number;
          recalled: boolean;
          locationId: string;
          skuId: string;
          quantity?: never;
          status?: never;
        }
    ))
  | {
      kind: "schedules";
      status: string;
      doctorLabel: string;
      startsAt: string;
      endsAt: string;
      modeLabel: string;
    }
);
export type StaffPage = { rows: StaffRow[]; nextCursor: string | null };
export type StaffQuery = { cursor: string | null; limit: number; status: string };
export type StaffResult = Resource<StaffPage>;
export type StaffReader = (
  kind: StaffKind,
  query: StaffQuery,
  signal: AbortSignal,
) => Promise<StaffResult>;

const token = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,256}$/.test(value);
const label = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= 160 &&
  !Array.from(value).some(
    (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
  );
const integer = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid object");
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).sort().join(",") !== keys.sort().join(","))
    throw new Error("Invalid fields");
}
export function calendarDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
const instant = (value: unknown): value is string => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value) ||
    !calendarDate(value.slice(0, 10)) ||
    !Number.isFinite(Date.parse(value))
  )
    return false;
  const comparable = value.includes(".")
    ? value.replace(
        /\.(\d+)Z$/,
        (_, precision: string) => `.${precision.padEnd(3, "0").slice(0, 3)}Z`,
      )
    : value.replace("Z", ".000Z");
  return new Date(value).toISOString() === comparable;
};

/** Presentation-only proposal. Domain owners must map reviewed, field-minimized contracts here. */
export function parseStaffPage(input: unknown, kind: StaffKind, query: StaffQuery): StaffPage {
  const page = object(input);
  exact(page, ["version", "rows", "nextCursor"]);
  if (
    page.version !== 1 ||
    !Array.isArray(page.rows) ||
    page.rows.length > query.limit ||
    !(page.nextCursor === null || token(page.nextCursor)) ||
    (page.nextCursor !== null && page.nextCursor === query.cursor)
  )
    throw new Error("Invalid page");
  const ids = new Set<string>();
  const rows = page.rows.map((inputRow): StaffRow => {
    const row = object(inputRow);
    const common = ["id", "clinicLabel"];
    if (!token(row.id) || ids.has(row.id) || !label(row.clinicLabel))
      throw new Error("Invalid row");
    ids.add(row.id);
    const base = { id: row.id, clinicLabel: row.clinicLabel };
    if (kind === "orders") {
      exact(row, [
        ...common,
        "status",
        "reference",
        "totalPaise",
        ...(row.metadata === undefined ? [] : ["metadata"]),
      ]);
      if (!label(row.status) || !label(row.reference) || !integer(row.totalPaise))
        throw new Error("Invalid order");
      let metadata: Extract<StaffRow, { kind: "orders" }>["metadata"];
      if (row.metadata !== undefined) {
        const value = object(row.metadata);
        exact(value, ["locationId", "currency", "version", "source", "createdAt", "expiresAt"]);
        if (
          !token(value.locationId) ||
          value.currency !== "INR" ||
          !integer(value.version) ||
          value.version < 1 ||
          !label(value.source) ||
          !instant(value.createdAt) ||
          !instant(value.expiresAt)
        )
          throw new Error("Invalid order metadata");
        metadata = {
          locationId: value.locationId,
          currency: value.currency,
          version: value.version,
          source: value.source,
          createdAt: value.createdAt,
          expiresAt: value.expiresAt,
        };
      }
      return {
        ...base,
        kind,
        status: row.status,
        reference: row.reference,
        totalPaise: row.totalPaise,
        ...(metadata ? { metadata } : {}),
      };
    }
    if (kind === "batches") {
      if (!label(row.productLabel) || !label(row.batchCode) || !calendarDate(row.expiresOn))
        throw new Error("Invalid batch");
      const batch = {
        ...base,
        kind,
        productLabel: row.productLabel,
        batchCode: row.batchCode,
        expiresOn: row.expiresOn,
      };
      if (row.onHand !== undefined) {
        exact(row, [
          ...common,
          "productLabel",
          "batchCode",
          "expiresOn",
          "onHand",
          "reserved",
          "recalled",
          "locationId",
          "skuId",
        ]);
        if (
          !integer(row.onHand) ||
          !integer(row.reserved) ||
          typeof row.recalled !== "boolean" ||
          !token(row.locationId) ||
          !token(row.skuId)
        )
          throw new Error("Invalid stock fields");
        return {
          ...batch,
          kind,
          onHand: row.onHand,
          reserved: row.reserved,
          recalled: row.recalled,
          locationId: row.locationId,
          skuId: row.skuId,
        };
      }
      exact(row, [...common, "status", "productLabel", "batchCode", "expiresOn", "quantity"]);
      if (!label(row.status) || !integer(row.quantity)) throw new Error("Invalid legacy batch");
      return { ...batch, kind, status: row.status, quantity: row.quantity };
    }
    exact(row, [...common, "status", "doctorLabel", "startsAt", "endsAt", "modeLabel"]);
    if (
      !label(row.status) ||
      !label(row.doctorLabel) ||
      !label(row.modeLabel) ||
      !instant(row.startsAt) ||
      !instant(row.endsAt) ||
      Date.parse(row.endsAt) <= Date.parse(row.startsAt)
    )
      throw new Error("Invalid schedule");
    return {
      ...base,
      kind,
      status: row.status,
      doctorLabel: row.doctorLabel,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      modeLabel: row.modeLabel,
    };
  });
  return { rows, nextCursor: page.nextCursor as string | null };
}

export function parseStaffQuery(input: unknown, permittedStatuses: readonly string[]): StaffQuery {
  const query = object(input);
  exact(query, ["cursor", "limit", "status"]);
  if (
    !(query.cursor === null || token(query.cursor)) ||
    !integer(query.limit) ||
    query.limit < 1 ||
    query.limit > 100 ||
    typeof query.status !== "string" ||
    (query.status !== "" && (!token(query.status) || !permittedStatuses.includes(query.status)))
  )
    throw new Error("Invalid query");
  return { cursor: query.cursor, limit: query.limit, status: query.status };
}

async function boundedJson(response: Response, signal: AbortSignal): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (signal.aborted) throw new Error("Aborted");
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 256_000) throw new Error("Response too large");
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

/** No default endpoint, role inference, storage, mutation, redirect or automatic retry. */
export function createStaffReader(
  config: {
    origin: string;
    local: boolean;
    endpoints: Partial<Record<StaffKind, string>>;
    /** Required owner-supplied shared-schema parser + field-minimized presentation mapping. */
    decoders?: Partial<Record<StaffKind, (input: unknown) => unknown>>;
    /** Actual commerce pagination is `after`; `cursor` is only for explicit test protocols. */
    cursorParameter?: "after" | "cursor";
    /** Omit for current commerce endpoints, which do not support status filtering. */
    statusParameter?: "status";
    statuses?: Partial<Record<StaffKind, readonly string[]>>;
  },
  transport: typeof fetch = fetch,
): StaffReader {
  return async (kind, input, signal) => {
    try {
      const origin = apiOrigin(config.origin, config.local);
      const query = parseStaffQuery(input, config.statuses?.[kind] ?? []);
      const path = config.endpoints[kind];
      const decode = config.decoders?.[kind];
      if (!path || !decode) return { status: "unavailable" };
      if (!/^\/v1\/staff\/[a-z0-9/-]+$/.test(path) || path.includes("//") || path.endsWith("/"))
        return { status: "error" };
      const url = new URL(path, origin);
      url.searchParams.set("limit", String(query.limit));
      if (query.cursor) url.searchParams.set(config.cursorParameter ?? "after", query.cursor);
      if (query.status) {
        if (!config.statusParameter) return { status: "error" };
        url.searchParams.set(config.statusParameter, query.status);
      }
      if (signal.aborted) return { status: "error" };
      const response = await transport(url.toString(), {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        signal,
        headers: { Accept: "application/json" },
      });
      if (signal.aborted) return { status: "error" };
      if (response.status === 401) return { status: "anonymous" };
      if (response.status === 403) return { status: "denied" };
      if ([404, 501, 503].includes(response.status)) return { status: "unavailable" };
      if (
        !response.ok ||
        !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")
      )
        return { status: "error" };
      const body = await boundedJson(response, signal);
      if (signal.aborted) return { status: "error" };
      return { status: "ready", data: parseStaffPage(decode(body), kind, query) };
    } catch {
      return { status: "error" };
    }
  };
}
