import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  candidateFingerprint,
  createLedger,
  readInventory,
  registerPath,
  validateLedger,
} from "../../scripts/qa/evidence.mjs";

const markdown = readFileSync(registerPath, "utf8");
const candidate = {
  sha: "e5161d76218136021c1f70e77f1a62f73e6a34b7",
  artifacts: "synthetic-build-digest-reference",
  schema: "synthetic-schema-v1",
  config: "synthetic-config-v1",
  providers: "synthetic-only-no-sends",
  fixtures: "synthetic-fixtures-v1",
  model: "not-used: local-only",
  prompt: "not-used: local-only",
  kb: "not-used: local-only",
};
const ledger = () => createLedger(markdown, candidate);
test("dedicated runner registers Node cases, not Playwright specs, without shell expansion", () => {
  const result = spawnSync(
    process.execPath,
    [new URL("../../scripts/qa/test.mjs", import.meta.url).pathname, "--list"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const files = JSON.parse(result.stdout);
  assert(files.includes("tests/phase1/evidence.test.mjs"));
  assert(files.every((file) => file.endsWith(".test.mjs")));
  assert.deepEqual(files, [...files].sort());
});
function executed(run) {
  Object.assign(run, {
    status: "Passed",
    blocker: "",
    executor: "operator-a",
    reviewer: "reviewer-b",
    expected: "Synthetic validator oracle",
    actual: "Synthetic validator assertion",
    oracle: "synthetic-reference-only",
    context: {
      role: "synthetic-operator",
      channel: "cli",
      device: "synthetic-host",
      os: "synthetic-linux",
      locale: "en",
      fixtureIds: ["synthetic-fixture-A"],
    },
    startedAt: "2026-10-24T00:00:00.000Z",
    endedAt: "2026-10-24T00:00:01.000Z",
    evidence: [
      {
        kind: "local-synthetic",
        url: "https://evidence.example.invalid/restricted/synthetic",
        sha256: "a".repeat(64),
      },
    ],
  });
}

test("canonical inventory retains every unique detailed run with requirement/output traceability", () => {
  const inventory = readInventory(markdown);
  assert.equal(new Set(inventory.map((run) => run.group)).size, 20);
  for (const run of inventory) {
    assert(run.requirements.length > 0 && run.outputs.length > 0);
    assert(run.variation.length > 0 && run.blocker.length > 0);
  }
  assert(inventory.some((run) => run.id === "P1-T04.S02-V12"));
  assert.throws(() => readInventory(`${markdown}\n${markdown}`), /Duplicate/);
});

test("deterministic initialization cannot turn source inventory into acceptance", () => {
  assert.deepEqual(ledger(), ledger());
  const result = validateLedger(ledger(), markdown, candidate);
  assert.equal(result.counts.Blocked, readInventory(markdown).length);
  assert.equal(result.counts.Passed, 0);
  assert.equal(Object.keys(result.requirements).length, 38);
  assert(result.requirements.R36.Blocked > 0);
  assert.equal(result.requirements.R37.Passed, 0);
  assert.equal(result.gate, "Not evaluated");
});

test("candidate fingerprints ignore property order, but invalidate every version change", () => {
  assert.equal(
    candidateFingerprint(candidate),
    candidateFingerprint(Object.fromEntries(Object.entries(candidate).reverse())),
  );
  for (const key of Object.keys(candidate)) {
    const changed = { ...candidate, [key]: key === "sha" ? "b".repeat(40) : "new-version" };
    assert.throws(() => validateLedger(ledger(), markdown, changed), /Stale candidate/);
  }
  assert.throws(
    () => candidateFingerprint({ ...candidate, model: "Missing" }),
    /Missing candidate/,
  );
  assert.throws(() => candidateFingerprint({ ...candidate, sha: "e5161d7" }), /full lowercase/);
});

test("missing, duplicated, stale and unresolved rows fail closed", () => {
  for (const mutate of [
    (value) => value.runs.pop(),
    (value) => {
      value.runs[1] = value.runs[0];
    },
    (value) => {
      value.runs[0].fingerprint = "a".repeat(64);
    },
    (value) => {
      value.runs[0].status = "Pending";
    },
    (value) => {
      value.runs[0].blocker = "";
    },
    (value) => {
      value.runs[0].requirements = ["R01"];
    },
    (value) => {
      value.runs[0].outputs = [];
    },
  ]) {
    const value = ledger();
    mutate(value);
    assert.throws(() => validateLedger(value, markdown, candidate));
  }
  assert.throws(() => validateLedger(ledger(), `${markdown}\n`, candidate), /Stale register/);
});

test("synthetic proof never passes database, provider, native or company cases", () => {
  for (const group of ["P1-T03", "P1-T06", "P1-T10", "P1-T12"]) {
    const value = ledger();
    const run = value.runs.find((row) => row.id.startsWith(`${group}.`));
    executed(run);
    assert.throws(() => validateLedger(value, markdown, candidate), /Missing deployed-candidate/);
    run.evidence.push({ ...run.evidence[0], kind: "deployed-candidate" });
    assert.throws(() => validateLedger(value, markdown, candidate), /Missing .* evidence/);
  }
});

test("self review, aggregate passes, missing defects, inverted time and credential URLs are rejected", () => {
  for (const mutate of [
    (run) => {
      run.reviewer = " OPERATOR-A ";
    },
    (run) => {
      run.expected = "";
    },
    (run) => {
      run.endedAt = "2026-10-23T00:00:00.000Z";
    },
    (run) => {
      run.startedAt = "2026-02-30T00:00:00.000Z";
    },
    (run) => {
      run.context.locale = "";
    },
    (run) => {
      run.context.fixtureIds = [];
    },
    (run) => {
      run.evidence[0].url += "?token=synthetic";
    },
    (run) => {
      run.evidence[0].sha256 = "abc";
    },
  ]) {
    const value = ledger();
    executed(value.runs[0]);
    mutate(value.runs[0]);
    assert.throws(() => validateLedger(value, markdown, candidate));
  }
  const value = ledger();
  const parent = readInventory(markdown).find((run) => run.aggregate);
  executed(value.runs.find((run) => run.id === parent.id));
  assert.throws(() => validateLedger(value, markdown, candidate), /Parent checkpoint/);
  const failure = ledger();
  executed(failure.runs[0]);
  failure.runs[0].status = "Failed";
  assert.throws(() => validateLedger(failure, markdown, candidate), /defect reference/);
  failure.runs[0].defects = ["SYNTHETIC-DEFECT-001"];
  assert.equal(validateLedger(failure, markdown, candidate).counts.Failed, 1);
});

test("CLI roundtrip validates an all-blocked ledger and redacts invalid input", () => {
  const directory = mkdtempSync(join(tmpdir(), "kav-qa-evidence-"));
  try {
    const candidateFile = join(directory, "candidate.json");
    const ledgerFile = join(directory, "ledger.json");
    writeFileSync(candidateFile, JSON.stringify(candidate));
    const script = new URL("../../scripts/qa/evidence.mjs", import.meta.url).pathname;
    const init = spawnSync(process.execPath, [script, "init", candidateFile], { encoding: "utf8" });
    assert.equal(init.status, 0, init.stderr);
    writeFileSync(ledgerFile, init.stdout);
    const valid = spawnSync(process.execPath, [script, "validate", candidateFile, ledgerFile], {
      encoding: "utf8",
    });
    assert.equal(valid.status, 0, valid.stderr);
    assert.equal(JSON.parse(valid.stdout).gate, "Not evaluated");
    writeFileSync(ledgerFile, "PRIVATE-SYNTHETIC-MARKER");
    const invalid = spawnSync(process.execPath, [script, "validate", candidateFile, ledgerFile], {
      encoding: "utf8",
    });
    assert.notEqual(invalid.status, 0);
    assert(!invalid.stderr.includes("PRIVATE-SYNTHETIC-MARKER"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
