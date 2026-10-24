import { describe, expect, it } from "vitest";
import { deliveryAddressSchema } from "../../packages/contracts/src/commerce-address.ts";
import { cartSchema, checkoutSchema } from "../../packages/contracts/src/commerce-catalogue.ts";
import {
  priceLine,
  safePaise,
  validateOpeningImport,
} from "../../packages/domain/src/commerce-catalogue.ts";

const id = "11111111-1111-4111-8111-111111111111";
const row = {
  skuId: id,
  sku: "SYNTH-1",
  name: "Synthetic",
  variant: "100ml",
  description: "Synthetic fixture only",
  imageUrl: "https://example.invalid/image",
  concerns: ["fixture"],
  approvedBy: id,
  consultOnly: false,
  unitPaise: 101,
  taxPolicyId: id,
  locationId: id,
  batchId: id,
  batchCode: "B1",
  expiresOn: "2030-01-01",
  quantity: 2,
  minimumShelfLifeDays: 10,
};

describe("commerce catalogue contracts and money", () => {
  it("rounds approved exclusive tax half up per line using exact integer arithmetic", () => {
    const result = priceLine({
      skuId: id,
      quantity: 3,
      version: 1,
      unitPaise: 101,
      taxPolicyId: id,
      rateBps: 500,
    });
    expect(result.taxPaise).toBe(15);
    expect(result.amountPaise).toBe(318);
    expect(
      priceLine({
        skuId: id,
        quantity: 1,
        version: 1,
        unitPaise: 1,
        taxPolicyId: id,
        rateBps: 5000,
      }).taxPaise,
    ).toBe(1);
  });
  it("preserves exact totals across deterministic quantity/rate boundaries", () => {
    for (const quantity of [1, 2, 99, 1000])
      for (const unitPaise of [0, 1, 99, 10001])
        for (const rateBps of [0, 1, 500, 5000, 10000]) {
          const priced = priceLine({
            skuId: id,
            quantity,
            version: 1,
            unitPaise,
            taxPolicyId: id,
            rateBps,
          });
          const base = BigInt(quantity) * BigInt(unitPaise);
          expect(BigInt(priced.amountPaise)).toBe(base + BigInt(priced.taxPaise));
          expect(BigInt(priced.taxPaise)).toBe((base * BigInt(rateBps) + 5000n) / 10000n);
        }
  });
  it("rejects fractional, negative and unsafe money, including overflow", () => {
    expect(() => safePaise(9007199254740992n)).toThrow("invalid_input");
    for (const unitPaise of [-1, 1.1, Number.MAX_SAFE_INTEGER]) {
      expect(() =>
        priceLine({ skuId: id, quantity: 2, version: 1, unitPaise, taxPolicyId: id, rateBps: 500 }),
      ).toThrow();
    }
  });
  it("rejects duplicate cart items, forged prices and absent confirmation", () => {
    const cart = { locationId: id, lines: [{ skuId: id, quantity: 1 }] };
    expect(cartSchema.safeParse({ ...cart, lines: [...cart.lines, ...cart.lines] }).success).toBe(
      false,
    );
    expect(cartSchema.safeParse({ ...cart, amountPaise: 1 }).success).toBe(false);
    expect(
      checkoutSchema.safeParse({
        ...cart,
        operationId: id,
        versions: { [id]: 1 },
        quoteKey: "x",
        confirmed: false,
      }).success,
    ).toBe(false);
  });
  it("requires a structurally valid delivery snapshot without claiming serviceability", () => {
    const deliveryAddress = {
      recipientName: " Synthetic Customer ",
      line1: " Fixture Road ",
      city: "Thrissur",
      region: "Kerala",
      postalCode: "680001",
      country: "IN",
      contactPhone: "+919999999999",
    };
    expect(deliveryAddressSchema.parse(deliveryAddress).recipientName).toBe("Synthetic Customer");
    const input = {
      locationId: id,
      lines: [{ skuId: id, quantity: 1 }],
      operationId: id,
      confirmed: true,
      versions: { [id]: 1 },
      quoteKey: "current",
      deliveryAddress,
    };
    expect(checkoutSchema.safeParse(input).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...input, source: "web" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...input, deliveryAddress: undefined }).success).toBe(false);
    for (const postalCode of ["012345", "68000", "6800011"])
      expect(deliveryAddressSchema.safeParse({ ...deliveryAddress, postalCode }).success).toBe(
        false,
      );
    expect(
      deliveryAddressSchema.safeParse({ ...deliveryAddress, contactPhone: "9999999999" }).success,
    ).toBe(false);
    expect(deliveryAddressSchema.safeParse({ ...deliveryAddress, approved: true }).success).toBe(
      false,
    );
  });
  it("reports row errors and mismatched controls without silently repairing inputs", () => {
    const controls = { rows: 1, units: 2, baseValuePaise: 202 };
    expect(validateOpeningImport([row], controls, "2026-10-24").report.valid).toBe(true);
    expect(
      validateOpeningImport([{ ...row, expiresOn: "2026-10-24" }], controls, "2026-10-24").report
        .errors,
    ).toContainEqual({ row: 1, code: "invalid_expiry" });
    expect(validateOpeningImport([row, row], controls, "2026-10-24").report.errors).toEqual(
      expect.arrayContaining([
        { row: 2, code: "duplicate_batch" },
        { row: 0, code: "control_totals" },
      ]),
    );
    expect(
      validateOpeningImport([{ ...row, unitPaise: -1 }], controls, "2026-10-24").report.errors[0],
    ).toEqual({ row: 1, code: "invalid_row" });
  });
  it("allows identical SKU metadata across distinct batches but rejects conflicting SKU mappings", () => {
    const next = {
      ...row,
      batchId: "22222222-2222-4222-8222-222222222222",
      batchCode: "B2",
      expiresOn: "2031-01-01",
    };
    const controls = { rows: 2, units: 4, baseValuePaise: 404 };
    expect(validateOpeningImport([row, next], controls, "2026-10-24").report.valid).toBe(true);
    expect(
      validateOpeningImport(
        [row, { ...next, unitPaise: 102 }],
        { ...controls, baseValuePaise: 406 },
        "2026-10-24",
      ).report.errors,
    ).toContainEqual({ row: 2, code: "conflicting_sku" });
    expect(
      validateOpeningImport(
        [row, { ...next, skuId: "33333333-3333-4333-8333-333333333333" }],
        controls,
        "2026-10-24",
      ).report.errors,
    ).toContainEqual({ row: 2, code: "conflicting_sku" });
    expect(
      validateOpeningImport([row, { ...next, batchCode: row.batchCode }], controls, "2026-10-24")
        .report.errors,
    ).toContainEqual({ row: 2, code: "duplicate_batch" });
  });
});
