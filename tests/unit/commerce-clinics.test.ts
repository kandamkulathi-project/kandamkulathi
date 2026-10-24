import { describe, expect, it } from "vitest";
import {
  commerceClinicsSchema,
  commerceStaffClinicsSchema,
} from "../../packages/contracts/src/commerce-clinics";
import { ids } from "./identity-fixtures";

describe("commerce clinic selection contracts", () => {
  const clinic = {
    clinicId: ids.clinic,
    locationId: ids.patient,
    name: "Synthetic approved clinic",
  };
  it("keeps canonical clinic and explicitly mapped inventory identity distinct", () => {
    expect(commerceClinicsSchema.parse({ items: [clinic] })).toEqual({ items: [clinic] });
    expect(
      commerceStaffClinicsSchema.parse({ items: [{ ...clinic, actions: ["orders:read"] }] }),
    ).toEqual({ items: [{ ...clinic, actions: ["orders:read"] }] });
  });
  it("rejects unnamed, forged or unscoped staff selections", () => {
    for (const item of [
      { ...clinic, name: " " },
      { ...clinic, clinicId: "forged" },
      { ...clinic, role: "admin" },
    ])
      expect(commerceClinicsSchema.safeParse({ items: [item] }).success).toBe(false);
    expect(
      commerceStaffClinicsSchema.safeParse({ items: [{ ...clinic, actions: [] }] }).success,
    ).toBe(false);
    expect(
      commerceStaffClinicsSchema.safeParse({ items: [{ ...clinic, actions: ["admin"] }] }).success,
    ).toBe(false);
  });
});
