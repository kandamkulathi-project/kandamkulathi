import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  validateSyntheticImport,
  validateSyntheticImportText,
} from "../../scripts/import-support/validate";

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`../fixtures/denzil-import/${name}.json`, import.meta.url), "utf8"),
  );
describe("synthetic import dry-run only", () => {
  it("keeps doctor/clinic candidate references separate from opening writes and approval", () => {
    const register = fixture("reference-register");
    expect(register.companyReferenceApproval).toBe("pending");
    expect(register.clinics).toEqual([
      {
        fixtureId: "syn-clinic-a",
        candidateLocationId: "00000000-0000-4000-8000-000000000101",
        label: "Synthetic clinic A",
      },
    ]);
    expect(register.doctors[0]).toMatchObject({
      candidateDoctorId: "00000000-0000-4000-8000-000000000201",
      clinicFixtureIds: [register.clinics[0].fixtureId],
    });
    expect(fixture("valid").rows[0].id).toBe(register.clinics[0].fixtureId);
    expect(validateSyntheticImport(register)).toMatchObject({
      status: "invalid-input",
      readyForWrite: false,
    });
  });
  it("reconciles deterministic fixtures without mutating input or authorizing writes", () => {
    const input = fixture("valid");
    const before = JSON.stringify(input);
    const report = validateSyntheticImport(input);
    expect(report).toMatchObject({
      status: "dry-run",
      readyForWrite: false,
      acceptedRows: 4,
      invalidRows: [],
      controls: { match: true, actual: input.expected },
      review: "JOSIN_REVIEW_REQUIRED",
    });
    expect(JSON.stringify(input)).toBe(before);
  });
  it("reports every duplicate, expiry, price and reference issue with 1-based row numbers and totals", () => {
    const report = validateSyntheticImport(fixture("invalid"));
    expect(report).toMatchObject({
      status: "dry-run",
      acceptedRows: 1,
      invalidRows: [
        { row: 2, codes: ["DUPLICATE_ID"] },
        { row: 3, codes: ["INVALID_PRICE"] },
        {
          row: 4,
          codes: ["EXPIRY_REVIEW", "INVALID_CLINIC_REFERENCE", "INVALID_VARIANT_REFERENCE"],
        },
        { row: 5, codes: ["DUPLICATE_ID"] },
      ],
      controls: {
        match: false,
        actual: {
          clinics: 1,
          products: 0,
          variants: 0,
          batches: 0,
          units: 0,
          retailExtensionPaise: 0,
        },
        differences: {
          clinics: 0,
          products: -1,
          variants: -1,
          batches: -1,
          units: -8,
          retailExtensionPaise: -100000,
        },
      },
    });
    expect(JSON.stringify(report)).not.toContain("Duplicate synthetic item");
  });
  it("handles dependencies independent of file order and propagates invalid parents", () => {
    const input = fixture("valid");
    input.rows.reverse();
    expect(validateSyntheticImport(input)).toMatchObject({
      status: "dry-run",
      controls: { match: true },
    });
    input.rows[3].extra = "not allowed";
    expect(validateSyntheticImport(input)).toMatchObject({
      status: "dry-run",
      acceptedRows: 2,
      invalidRows: [
        { row: 1, codes: ["INVALID_CLINIC_REFERENCE"] },
        { row: 4, codes: ["INVALID_FIELDS"] },
      ],
    });
  });
  it("rejects descendants of an invalid product rather than reporting their stock as accepted", () => {
    const input = fixture("valid");
    input.rows[1].label = "";
    expect(validateSyntheticImport(input)).toMatchObject({
      status: "dry-run",
      acceptedRows: 1,
      invalidRows: [
        { row: 2, codes: ["INVALID_LABEL"] },
        { row: 3, codes: ["INVALID_PRODUCT_REFERENCE"] },
        { row: 4, codes: ["INVALID_VARIANT_REFERENCE"] },
      ],
    });
  });
  it("invalidates a duplicate identity even when one occurrence has malformed fields", () => {
    const input = fixture("valid");
    input.rows.push({ ...input.rows[2], pricePaise: "12500" });
    expect(validateSyntheticImport(input)).toMatchObject({
      invalidRows: [
        { row: 3, codes: ["DUPLICATE_ID"] },
        { row: 4, codes: ["INVALID_VARIANT_REFERENCE"] },
        { row: 5, codes: ["DUPLICATE_ID", "INVALID_PRICE"] },
      ],
    });
  });
  it.each([
    { pricePaise: 1.1 },
    { pricePaise: -1 },
    { pricePaise: "12500" },
    { productId: "syn-missing" },
  ])("rejects invalid variant input %#", (fields) => {
    const input = fixture("valid");
    Object.assign(input.rows[2], fields);
    expect(validateSyntheticImport(input)).toMatchObject({ status: "dry-run", acceptedRows: 2 });
  });
  it.each([
    { quantity: 1.1 },
    { quantity: -1 },
    { expiresOn: "2027-02-29" },
    { expiresOn: "2026-10-24" },
    { clinicId: "syn-missing" },
    { variantId: "syn-missing" },
  ])("rejects invalid batch input %#", (fields) => {
    const input = fixture("valid");
    Object.assign(input.rows[3], fields);
    expect(validateSyntheticImport(input)).toMatchObject({ status: "dry-run", acceptedRows: 3 });
  });
  it("reports mismatched controls independently of valid rows; zero rows do not imply approved stock", () => {
    const input = fixture("valid");
    input.expected.units = 9;
    expect(validateSyntheticImport(input)).toMatchObject({
      status: "dry-run",
      acceptedRows: 4,
      controls: { match: false, differences: { units: -1 } },
    });
    input.rows = [];
    expect(validateSyntheticImport(input)).toMatchObject({
      status: "dry-run",
      acceptedRows: 0,
      invalidRows: [],
      controls: { match: false },
    });
  });
  it("fails closed on unsafe arithmetic instead of rounded control totals", () => {
    const input = fixture("valid");
    input.rows[2].pricePaise = Number.MAX_SAFE_INTEGER;
    expect(validateSyntheticImport(input)).toEqual({
      status: "invalid-input",
      readyForWrite: false,
      reason: "CONTROL_TOTAL_OVERFLOW",
    });
  });
  it.each([
    null,
    [],
    {},
    { ...fixture("valid"), synthetic: false },
    { ...fixture("valid"), authorization: "admin" },
    { ...fixture("valid"), asOf: "yesterday" },
    { ...fixture("valid"), rows: Array(10001).fill(null) },
  ])("rejects malformed or non-synthetic envelopes %#", (input) => {
    expect(validateSyntheticImport(input)).toMatchObject({
      status: "invalid-input",
      readyForWrite: false,
    });
  });
  it("rejects malformed JSON, oversized text and invalid controls", () => {
    expect(validateSyntheticImportText("{")).toMatchObject({ reason: "INVALID_JSON" });
    expect(validateSyntheticImportText(" ".repeat(2_000_001))).toMatchObject({
      reason: "INPUT_TOO_LARGE",
    });
    const input = fixture("valid");
    input.expected.units = "8";
    expect(validateSyntheticImport(input)).toMatchObject({ reason: "INVALID_CONTROLS" });
  });
});
