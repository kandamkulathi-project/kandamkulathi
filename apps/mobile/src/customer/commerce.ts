import type { ClientSession } from "../../../workspaces/src/customer/booking/contracts";
import { customerSession, object } from "../../../workspaces/src/customer/booking/contracts";

/** Presentation-only projection from the reviewed commerce adapter. No totals,
 * payment success, stock eligibility or owner authorization is calculated here.
 * Rows are explicitly display text, not actionable product/order identifiers.
 */
export type NativeCommercePage = {
  section: "catalogue" | "cart" | "orders";
  rows: { id: string; title: string; detail: string }[];
};
export interface NativeCommerceAdapter {
  load(input: { section: NativeCommercePage["section"] }, signal: AbortSignal): Promise<unknown>;
}
/** Parent-mounted interactive commerce replaces this legacy projection by opt-out. */
export function nativeCommerceEnabled(showCommerce?: boolean): boolean {
  return showCommerce !== false;
}
export function parseNativeCommerce(
  value: unknown,
  section: NativeCommercePage["section"],
): NativeCommercePage {
  const page = object(value, ["section", "rows"]);
  if (page.section !== section || !Array.isArray(page.rows) || page.rows.length > 1000)
    throw Error("Invalid page");
  const rows = page.rows.map((raw: unknown) => {
    const row = object(raw, ["id", "title", "detail"]);
    for (const key of ["id", "title", "detail"])
      if (typeof row[key] !== "string" || !row[key] || (row[key] as string).length > 2000)
        throw Error("Invalid row");
    return { id: row.id as string, title: row.title as string, detail: row.detail as string };
  });
  if (new Set(rows.map((r) => r.id)).size !== rows.length) throw Error("Duplicate row");
  return { section, rows };
}
export function nativeSessionAllowed(session: ClientSession | null) {
  return customerSession(session, Date.now()) !== null;
}
export function nativeCommerceAllowed(
  section: NativeCommercePage["section"],
  session: ClientSession | null,
) {
  return section === "catalogue" || nativeSessionAllowed(session);
}
