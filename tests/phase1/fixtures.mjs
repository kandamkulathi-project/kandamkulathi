import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const canonicalSource =
  "docs/implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md";

// These are logical references, not credentials, WorkOS subjects or seeded database IDs.
const definitions = [
  ["customer-A", ["P1-T02", "P1-T03"], "identity/scope"],
  ["customer-B", ["P1-T02", "P1-T03"], "identity/scope"],
  ["clinic-A", ["P1-T03", "P1-T07"], "identity/scope"],
  ["clinic-B", ["P1-T03", "P1-T07"], "identity/scope"],
  ["doctor-assigned", ["P1-T03", "P1-T11"], "identity/scope"],
  ["doctor-unassigned", ["P1-T03", "P1-T11"], "identity/scope"],
  ["doctor-revoked", ["P1-T03"], "identity/scope"],
  ["D-SHARED", ["P1-T07"], "booking/clinical"],
  ["P-RETAIL-V1", ["P1-T04", "P1-T05"], "catalogue/stock"],
  ["P-RETAIL-V2", ["P1-T04"], "catalogue/stock"],
  ["P-CONSULT", ["P1-T04", "P1-T13"], "catalogue/stock"],
  ["B-EARLY", ["P1-T05"], "catalogue/stock"],
  ["B-LATE", ["P1-T05"], "catalogue/stock"],
  ["B-EXPIRED", ["P1-T05"], "catalogue/stock"],
  ["B-RECALLED", ["P1-T05"], "catalogue/stock"],
  ["B-SHORTLIFE", ["P1-T05"], "catalogue/stock"],
  ["B-LAST", ["P1-T05"], "catalogue/stock"],
  ["PRICE-GOLDEN", ["P1-T04", "P1-T06"], "money/providers"],
  ["TAX-GOLDEN", ["P1-T04", "P1-T06"], "money/providers"],
  ["RX/REC-GOLDEN", ["P1-T04", "P1-T13"], "booking/clinical"],
  ["KB-A", ["P1-T12"], "knowledge/AI"],
  ["KB-D", ["P1-T12", "P1-T15"], "knowledge/AI"],
  ["KB-W", ["P1-T12"], "knowledge/AI"],
  ["KB-P", ["P1-T12"], "knowledge/AI"],
];

/** @param {string} alias */
export function fixtureId(alias) {
  assert(
    definitions.some(([name]) => name === alias),
    "Unknown canonical fixture alias",
  );
  return `qa-p1-${createHash("sha256").update(`KND-QA-011:1:${alias}`).digest("hex").slice(0, 24)}`;
}

export function createCatalogue() {
  return {
    version: 1,
    synthetic: true,
    source: canonicalSource,
    sourceSections: ["2.2", "3"],
    acceptance: "Blocked",
    limitation:
      "Logical fixture data only; not transaction, RLS, provider, device or clinical/finance acceptance.",
    fixtures: definitions.map(([alias, cases, group]) => ({
      alias,
      id: fixtureId(alias),
      cases: [...cases],
      group,
      binding: "Unbound",
    })),
    requiredInputs: [
      "isolated environment and reviewed seed/reset binding",
      "verified actors, signed role/clinic/assignment/consent matrix",
      "T0, server precision and signed TTL/buffer/shelf-life inclusivity rules",
      "signed PRICE/TAX-GOLDEN amounts and finance policy versions",
      "signed RX/REC-GOLDEN and physician-approved medical/safety translations",
      "provider sandbox contract, supported devices and candidate manifest",
    ],
  };
}

export function identityScenario() {
  return {
    customers: ["A", "B"].map((suffix) => ({
      actor: fixtureId(`customer-${suffix}`),
      patientReference: `synthetic-patient-${suffix}`,
      clinic: fixtureId(`clinic-${suffix}`),
      privateOrderReference: `synthetic-order-${suffix}`,
    })),
    doctors: ["assigned", "unassigned", "revoked"].map((state) => ({
      actor: fixtureId(`doctor-${state}`),
      assignmentVariant: state,
      patientReference: "synthetic-patient-A",
    })),
    staffRoles: [
      "front desk",
      "warehouse",
      "finance",
      "content editor",
      "physician approver",
      "administrator",
    ],
    sessionVariants: ["active", "expired", "revoked", "wrong-org", "no-MFA"],
    signedPermissionMatrix: null,
    credentials: null,
    cases: ["P1-T02", "P1-T03", "P1-T11"],
  };
}

export function knowledgeScenario() {
  return {
    sources: [
      { alias: "KB-A", state: "approved", visibility: "public" },
      { alias: "KB-D", state: "draft", visibility: "public" },
      { alias: "KB-W", state: "withdrawn", visibility: "public" },
      { alias: "KB-P", state: "approved", visibility: "private" },
    ],
    variants: ["missing-safety", "missing-translation", "stale-vector"],
    requiredLanguages: ["EN", "ML", "TA"],
    physicianSignedOracle: null,
    medicalText: null,
    cases: ["P1-T12", "P1-T13", "P1-T15"],
  };
}

/**
 * Generates time coordinates only, never decides whether an operation is authorized.
 * @param {{t0: string, ttlMs: number, precisionMs: number, atBoundary: 'valid' | 'expired'}} input
 */
export function ttlBoundaries({ t0, ttlMs, precisionMs, atBoundary }) {
  assert(
    typeof t0 === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(t0),
    "Explicit UTC T0 required",
  );
  const start = Date.parse(t0);
  assert(Number.isFinite(start) && new Date(start).toISOString() === t0, "Invalid T0");
  assert(Number.isSafeInteger(ttlMs) && ttlMs > 0, "Explicit positive TTL required");
  assert(Number.isSafeInteger(precisionMs) && precisionMs > 0, "Explicit precision required");
  assert(
    ttlMs % precisionMs === 0 && start % precisionMs === 0,
    "Boundary must align with precision",
  );
  assert(["valid", "expired"].includes(atBoundary), "Explicit inclusivity required");
  const boundary = start + ttlMs;
  assert(Number.isSafeInteger(boundary + precisionMs), "Unsafe time arithmetic");
  return [-precisionMs, 0, precisionMs].map((offsetMs) => ({
    offsetMs,
    at: new Date(boundary + offsetMs).toISOString(),
    boundaryPolicyInput: atBoundary,
  }));
}

// Facts from canonical §2.2, not an alternative FEFO/pricing implementation.
export function stockScenario() {
  return {
    product: fixtureId("P-RETAIL-V1"),
    clinic: fixtureId("clinic-A"),
    baseUnitPaise: 10000,
    finalTaxAndTotal: null,
    batches: [
      { alias: "B-EARLY", quantity: 3, expiryOrder: 1 },
      { alias: "B-LATE", quantity: 5, expiryOrder: 2 },
      { alias: "B-LAST", quantity: 1, independentRaceFixture: true },
    ],
    fourUnitExpectedAllocation: [
      { alias: "B-EARLY", quantity: 3 },
      { alias: "B-LATE", quantity: 1 },
    ],
    ineligibleAliases: ["B-EXPIRED", "B-RECALLED", "B-SHORTLIFE"],
    eligibilityPolicy: null,
    rollbackExpectedDelta: { orders: 0, reservations: 0, ledger: 0, outbox: 0 },
  };
}

// No fabricated HMAC, provider event schema or medical answer is supplied here.
export function providerReplayScenario() {
  return {
    operationId: "synthetic-p1-payment-operation-A",
    deliveries: [
      { deliveryId: "synthetic-delivery-A", semanticEvent: "synthetic-capture-A" },
      { deliveryId: "synthetic-delivery-A", semanticEvent: "synthetic-capture-A" },
      { deliveryId: "synthetic-delivery-B", semanticEvent: "synthetic-capture-A" },
    ],
    variants: [
      "invalid-signature",
      "wrong-account",
      "wrong-reference",
      "wrong-amount",
      "wrong-currency",
      "lost-response",
      "commit-unknown",
    ],
    providerContract: null,
    cases: ["P1-T06", "P1-T17"],
  };
}
