import { describe, expect, it } from "vitest";
import {
  knowledgeKinds,
  knowledgeLanguages,
  productKnowledgeKinds,
} from "../../packages/contracts/src/knowledge";
import inventory from "../fixtures/denzil-readiness/content-inventory.json";
import inputs from "../fixtures/denzil-readiness/evaluation-inputs.json";
import register from "../fixtures/denzil-readiness/register.json";

describe("Denzil synthetic readiness fixtures", () => {
  it("does not report unknown content inventory as zero gaps or an approved sample", () => {
    expect(inventory.schemaVersion).toBe(1);
    expect(inventory.fixtureKind).toBe("pending-content-source-register");
    expect(inventory.inventoryStatus).toBe("pending-complete-current-published-inventory");
    expect(inventory.requiredLanguages).toEqual([...knowledgeLanguages]);
    expect(inventory.requiredProductKinds).toEqual([...productKnowledgeKinds]);
    expect([...inventory.requiredProductKinds, ...inventory.requiredInstitutionKinds]).toEqual([
      ...knowledgeKinds,
    ]);
    expect(inventory.owner).toBe("Mathew");
    expect(inventory.reviewer).toBe("company-physician");
    for (const value of [
      inventory.publishedProductCount,
      inventory.expectedProductLanguageKindSlots,
      inventory.coveredSlots,
      inventory.gapSlots,
      inventory.approvedSample,
      inventory.inventorySourceRevision,
      inventory.companyFreshnessDeadline,
      inventory.measuredEditFreshness,
      inventory.measuredWithdrawalFreshness,
    ]) {
      expect(value).toBeNull();
    }
  });
  it("records all message obligations without inventing text or receipts", () => {
    expect(register.schemaVersion).toBe(1);
    expect(register.fixtureKind).toBe("synthetic-readiness-only");
    expect(register.templates.map((row) => row.id)).toEqual([
      "order-confirmation",
      "order-dispatch",
      "order-out-for-delivery",
      "order-delivered",
      "invoice-ready",
      "callback-acknowledgement",
      "knowledge-unavailable-handoff",
    ]);
    for (const row of register.templates) {
      expect(row).toEqual({
        id: row.id,
        owner: "Mathew",
        reviewer:
          row.id === "invoice-ready"
            ? "company-finance"
            : row.id === "knowledge-unavailable-handoff"
              ? "company-physician"
              : "company-operations",
        languages: ["en", "ml", "ta"],
        approvedText: null,
        approvedVersion: null,
        providerReceipt: null,
        status: "pending-company-copy",
      });
    }
  });

  it("does not confuse a JavaScript export or missing receipt with store approval", () => {
    expect(register.stores.map((row) => row.platform)).toEqual(["android", "ios"]);
    for (const row of register.stores) {
      expect(row).toEqual({
        platform: row.platform,
        owner: "Devadathan",
        companyAccountId: null,
        applicationId: null,
        approvedListingCopy: null,
        privacyDisclosureEvidence: null,
        signedBuildId: null,
        submissionReceipt: null,
        publicListingUrl: null,
        status: "pending-company-inputs",
      });
    }
  });

  it("keeps multilingual evaluation inputs separate from approved responses", () => {
    expect(inputs.schemaVersion).toBe(1);
    expect(inputs.fixtureKind).toBe("synthetic-evaluation-input-only");
    expect(inputs.cases.map((row) => row.language)).toEqual([
      "en",
      "ml",
      "ta",
      "romanized-unverified",
      "unverified",
    ]);
    expect(new Set(inputs.cases.map((row) => row.id)).size).toBe(5);
    expect(inputs.cases.map((row) => row.expectedBoundary)).toEqual([
      "authenticated-owner-lookup-required",
      "interface-language-only-no-medical-translation",
      "interface-language-only-no-medical-translation",
      "approved-fallback-required-no-invented-clinical-text",
      "approved-fallback-required-no-invented-clinical-text",
    ]);
    for (const row of inputs.cases) {
      expect(Object.keys(row).sort()).toEqual(["expectedBoundary", "id", "input", "language"]);
      expect(row.input.length).toBeGreaterThan(0);
    }
  });
});
