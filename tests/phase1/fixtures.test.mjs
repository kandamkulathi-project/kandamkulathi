import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  canonicalSource,
  createCatalogue,
  fixtureId,
  identityScenario,
  knowledgeScenario,
  providerReplayScenario,
  stockScenario,
  ttlBoundaries,
} from "./fixtures.mjs";

const root = new URL("../../", import.meta.url);
const clock = {
  t0: "2026-10-19T00:00:00.000Z",
  ttlMs: 2000,
  precisionMs: 1,
  atBoundary: "expired",
};

test("catalogue aliases and groups resolve to canonical11, not a separate oracle", () => {
  const source = readFileSync(new URL(canonicalSource, root), "utf8");
  const inventory = readFileSync(new URL("docs/quality/P1_TEST_RUN_REGISTER.md", root), "utf8");
  const catalogue = createCatalogue();
  assert.equal(catalogue.fixtures.length, 24);
  assert.equal(new Set(catalogue.fixtures.map(({ id }) => id)).size, 24);
  for (const fixture of catalogue.fixtures) {
    assert(source.includes(fixture.alias), `Missing canonical alias ${fixture.alias}`);
    assert.equal(fixture.binding, "Unbound");
    for (const id of fixture.cases) {
      assert(source.includes(`### ${id} —`), `Missing canonical case ${id}`);
      assert(inventory.includes(id), `Missing current inventory group ${id}`);
    }
  }
  assert.equal(catalogue.acceptance, "Blocked");
});

test("deterministic references are fresh copies and reject unknown/prototype aliases", () => {
  const first = createCatalogue();
  const second = createCatalogue();
  assert.deepEqual(first, second);
  first.fixtures[0].cases.push("invented");
  assert.deepEqual(createCatalogue(), second);
  assert.notEqual(fixtureId("customer-A"), fixtureId("customer-B"));
  for (const alias of ["customer-C", "__proto__", "", undefined]) {
    assert.throws(() => fixtureId(alias), /Unknown canonical/);
  }
});

test("identity boundaries keep owners and clinics distinct without pretending to verify sessions", () => {
  const scenario = identityScenario();
  for (const key of ["actor", "patientReference", "clinic", "privateOrderReference"]) {
    assert.notEqual(scenario.customers[0][key], scenario.customers[1][key]);
  }
  assert.equal(new Set(scenario.doctors.map(({ actor }) => actor)).size, 3);
  assert(scenario.staffRoles.includes("content editor"));
  assert(scenario.staffRoles.includes("physician approver"));
  assert.deepEqual(scenario.sessionVariants, [
    "active",
    "expired",
    "revoked",
    "wrong-org",
    "no-MFA",
  ]);
  assert.equal(scenario.signedPermissionMatrix, null);
  assert.equal(scenario.credentials, null);
});

test("knowledge fixtures distinguish publication from visibility and never supply medical answers", () => {
  const scenario = knowledgeScenario();
  assert.deepEqual(
    scenario.sources
      .filter(({ state, visibility }) => state === "approved" && visibility === "public")
      .map(({ alias }) => alias),
    ["KB-A"],
  );
  assert.deepEqual(scenario.variants, ["missing-safety", "missing-translation", "stale-vector"]);
  assert.equal(scenario.physicianSignedOracle, null);
  assert.equal(scenario.medicalText, null);
  for (const { alias } of scenario.sources) assert(fixtureId(alias));
});

test("boundary coordinates preserve explicit precision and inclusivity, without choosing a TTL", () => {
  assert.deepEqual(
    ttlBoundaries(clock).map(({ at }) => at),
    ["2026-10-19T00:00:01.999Z", "2026-10-19T00:00:02.000Z", "2026-10-19T00:00:02.001Z"],
  );
  const seconds = ttlBoundaries({ ...clock, precisionMs: 1000, atBoundary: "valid" });
  assert.equal(seconds[0].at, "2026-10-19T00:00:01.000Z");
  assert(seconds.every(({ boundaryPolicyInput }) => boundaryPolicyInput === "valid"));
});

test("missing, invalid, unaligned and unsafe clock policy inputs fail closed", () => {
  for (const patch of [
    { ttlMs: undefined },
    { ttlMs: 0 },
    { ttlMs: -1 },
    { ttlMs: 1.5 },
    { ttlMs: Number.MAX_SAFE_INTEGER },
    { precisionMs: 0 },
    { precisionMs: 3 },
    { atBoundary: undefined },
    { atBoundary: "guess" },
    { t0: "2026-02-30T00:00:00.000Z" },
    { t0: "2026-10-19" },
  ])
    assert.throws(() => ttlBoundaries({ ...clock, ...patch }));
});

test("canonical stock facts keep last-unit race independent and policy-dependent fields unbound", () => {
  const scenario = stockScenario();
  assert.deepEqual(
    scenario.batches.slice(0, 2).map(({ quantity }) => quantity),
    [3, 5],
  );
  assert.deepEqual(scenario.fourUnitExpectedAllocation, [
    { alias: "B-EARLY", quantity: 3 },
    { alias: "B-LATE", quantity: 1 },
  ]);
  assert.equal(scenario.batches[2].quantity, 1);
  assert.equal(scenario.batches[2].independentRaceFixture, true);
  assert.equal(scenario.baseUnitPaise * 2, 20000);
  assert.equal(scenario.finalTaxAndTotal, null);
  assert.equal(scenario.eligibilityPolicy, null);
  assert.deepEqual(scenario.rollbackExpectedDelta, {
    orders: 0,
    reservations: 0,
    ledger: 0,
    outbox: 0,
  });
  for (const alias of scenario.ineligibleAliases) assert(fixtureId(alias));
});

test("replay fixture distinguishes transport duplication from semantic duplication", () => {
  const { deliveries, providerContract, variants } = providerReplayScenario();
  assert.deepEqual(deliveries[0], deliveries[1]);
  assert.notEqual(deliveries[0].deliveryId, deliveries[2].deliveryId);
  assert.equal(new Set(deliveries.map(({ semanticEvent }) => semanticEvent)).size, 1);
  assert.equal(providerContract, null);
  assert(variants.includes("commit-unknown"));
  assert(variants.includes("lost-response"));
});

test("CLI journey emits reproducible unbound catalogue and refuses destructive/target arguments", () => {
  const invoke = (...args) =>
    spawnSync(process.execPath, ["scripts/qa/fixtures.mjs", ...args], {
      cwd: root,
      encoding: "utf8",
    });
  const first = invoke("catalogue");
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout, invoke("catalogue").stdout);
  assert.deepEqual(JSON.parse(first.stdout), createCatalogue());
  for (const args of [[], ["reset"], ["seed"], ["catalogue", "--production"]]) {
    const result = invoke(...args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Usage:/);
  }
});
