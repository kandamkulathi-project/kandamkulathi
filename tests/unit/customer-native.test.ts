import { describe, expect, it } from "vitest";
import {
  nativeCommerceAllowed,
  nativeCommerceEnabled,
  parseNativeCommerce,
} from "../../apps/mobile/src/customer/commerce";
import { directoryChoices } from "../../apps/workspaces/src/customer/booking/contracts";
import { directory, ids, runtimeMetadata, selection } from "./customer-booking-fixtures";

describe("native customer commerce projection", () => {
  it("retains legacy commerce by default and explicitly disables it for parent-mounted forms", () => {
    expect(nativeCommerceEnabled()).toBe(true);
    expect(nativeCommerceEnabled(true)).toBe(true);
    expect(nativeCommerceEnabled(false)).toBe(false);
  });
  it("filters native clinic/doctor/service choices through the canonical published scopes", () => {
    const scoped = {
      ...directory,
      clinics: [...directory.clinics, { id: ids[11]!, name: "Unscoped synthetic clinic" }],
      services: [...directory.services, { id: ids[11]!, name: "Unscoped synthetic service" }],
      scopes: runtimeMetadata.scopes,
    };
    expect(directoryChoices(scoped).clinics).toEqual(directory.clinics);
    expect(directoryChoices(scoped, selection.clinicId, selection.doctorId).doctors).toEqual(
      directory.doctors,
    );
    expect(directoryChoices(scoped, selection.clinicId, selection.doctorId).services).toEqual(
      directory.services,
    );
    expect(directoryChoices(scoped, ids[11]!, selection.doctorId).doctors).toEqual([]);
    expect(directoryChoices(scoped, selection.clinicId, ids[11]!).services).toEqual([]);
  });
  it("allows public catalogue without login/intake but denies private cart and orders", () => {
    expect(nativeCommerceAllowed("catalogue", null)).toBe(true);
    expect(nativeCommerceAllowed("cart", null)).toBe(false);
    expect(nativeCommerceAllowed("orders", null)).toBe(false);
    expect(
      nativeCommerceAllowed("orders", {
        userId: "00000000-0000-4000-8000-000000000001",
        expiresAt: "2020-01-01T00:00:00.000Z",
        workspaces: ["customer"],
      }),
    ).toBe(false);
  });
  it.each(["catalogue", "cart", "orders"] as const)(
    "accepts authoritative %s display rows only",
    (section) => {
      const page = {
        section,
        rows: [
          { id: "synthetic-row", title: "Synthetic title", detail: "Server supplied display" },
        ],
      };
      expect(parseNativeCommerce(page, section)).toEqual(page);
      expect(parseNativeCommerce({ section, rows: [] }, section).rows).toEqual([]);
    },
  );
  it("rejects wrong sections, business flags, duplicate and malformed rows", () => {
    expect(() => parseNativeCommerce({ section: "cart", rows: [], paid: true }, "cart")).toThrow();
    expect(() => parseNativeCommerce({ section: "orders", rows: [] }, "cart")).toThrow();
    const row = { id: "test", title: "title", detail: "detail" };
    expect(() => parseNativeCommerce({ section: "cart", rows: [row, row] }, "cart")).toThrow();
    expect(() =>
      parseNativeCommerce({ section: "cart", rows: [{ ...row, title: null }] }, "cart"),
    ).toThrow();
  });
});
