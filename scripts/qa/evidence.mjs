import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export const registerPath = fileURLToPath(
  new URL("../../docs/quality/P1_TEST_RUN_REGISTER.md", import.meta.url),
);
const digest = (value) => createHash("sha256").update(value).digest("hex");
const sha = /^[a-f0-9]{40}$/;
const hash = /^[a-f0-9]{64}$/;
const text = (value) => typeof value === "string" && value.trim().length > 0;
const present = (value) => text(value) && !/^(missing|pending|unknown|n\/a)$/i.test(value);

// Derive IDs and requirement/output links from the reviewed register, not a second case list.
export function readInventory(markdown) {
  const groups = new Map();
  const runs = [];
  let group;
  for (const line of markdown.split("\n")) {
    const heading = /^### (P1-T\d{2}) —/.exec(line);
    if (heading) group = heading[1];
    if (group && line.startsWith("- **Traceability:**")) {
      groups.set(group, {
        requirements: [...new Set(line.match(/\bR\d{2}\b/g))],
        outputs: [...new Set(line.match(/\bP1-O\d{2}\b/g))],
      });
    }
    if (!/^\| `+P1-T\d{2}\.S\d{2}-V\d+`+ \|/.test(line)) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    const id = cells[0].replaceAll("`", "");
    assert.equal(id.slice(0, 6), group, "Run outside its canonical group");
    assert(groups.has(group), "Missing group traceability");
    assert.equal(cells.length, 10, "Register columns changed; review parser");
    runs.push({
      id,
      group,
      variation: cells[1],
      ...groups.get(group),
      aggregate: /parent checkpoint|no aggregate Pass/i.test(cells[1]),
      blocker: cells[7],
    });
  }
  assert.equal(groups.size, 20, "Expected all twenty G1 groups");
  assert(runs.length > 0, "Missing run inventory");
  assert.equal(new Set(runs.map((run) => run.id)).size, runs.length, "Duplicate run ID");
  return runs;
}

export function candidateFingerprint(candidate) {
  assert(candidate && typeof candidate === "object" && !Array.isArray(candidate));
  const keys = [
    "sha",
    "artifacts",
    "schema",
    "config",
    "providers",
    "fixtures",
    "model",
    "prompt",
    "kb",
  ];
  assert.deepEqual(Object.keys(candidate).sort(), [...keys].sort(), "Candidate keys changed");
  assert(sha.test(candidate.sha), "Candidate requires a full lowercase Git SHA");
  for (const key of keys.slice(1)) assert(present(candidate[key]), `Missing candidate ${key}`);
  return digest(JSON.stringify(keys.map((key) => [key, candidate[key]])));
}

export function createLedger(markdown, candidate) {
  const fingerprint = candidateFingerprint(candidate);
  return {
    version: 1,
    registerDigest: digest(markdown),
    candidate,
    runs: readInventory(markdown).map((run) => ({
      id: run.id,
      requirements: run.requirements,
      outputs: run.outputs,
      fingerprint,
      status: "Blocked",
      blocker: run.blocker,
      executor: "",
      reviewer: "",
      expected: "",
      actual: "",
      startedAt: "",
      endedAt: "",
      oracle: "",
      context: { role: "", channel: "", device: "", os: "", locale: "", fixtureIds: [] },
      evidence: [],
      defects: [],
    })),
  };
}

const kinds = [
  "local-synthetic",
  "real-postgresql",
  "provider-sandbox",
  "native-device",
  "deployed-candidate",
  "company-review",
];
function requiredKinds(group) {
  const required = ["deployed-candidate"];
  if (
    ["P1-T03", "P1-T04", "P1-T05", "P1-T06", "P1-T07", "P1-T08", "P1-T17", "P1-T18"].includes(group)
  )
    required.push("real-postgresql");
  if (["P1-T02", "P1-T06", "P1-T10", "P1-T14"].includes(group)) required.push("provider-sandbox");
  if (["P1-T10", "P1-T11"].includes(group)) required.push("native-device");
  if (["P1-T12", "P1-T13", "P1-T15", "P1-T20"].includes(group)) required.push("company-review");
  return required;
}

// Structural readiness only: evidence bytes and reviewer authority still need independent review.
export function validateLedger(ledger, markdown, expectedCandidate) {
  assert.equal(ledger.version, 1, "Unsupported ledger version");
  assert.equal(
    ledger.registerDigest,
    digest(markdown),
    "Stale register: regenerate/reconcile rows",
  );
  const fingerprint = candidateFingerprint(expectedCandidate);
  assert.equal(candidateFingerprint(ledger.candidate), fingerprint, "Stale candidate metadata");
  const inventory = readInventory(markdown);
  assert(Array.isArray(ledger.runs), "Missing run rows");
  assert.equal(ledger.runs.length, inventory.length, "Missing or additional runs");
  const byId = new Map(ledger.runs.map((run) => [run.id, run]));
  assert.equal(byId.size, ledger.runs.length, "Duplicate run result");
  const counts = { Pending: 0, Blocked: 0, Passed: 0, Failed: 0 };
  const requirements = Object.fromEntries(
    Array.from({ length: 38 }, (_, index) => [
      `R${String(index + 1).padStart(2, "0")}`,
      { ...counts },
    ]),
  );
  for (const canonical of inventory) {
    const run = byId.get(canonical.id);
    assert(run, `Missing run ${canonical.id}`);
    assert.equal(run.fingerprint, fingerprint, `Stale run ${run.id}`);
    assert.deepEqual(
      run.requirements,
      canonical.requirements,
      `Changed requirement traceability ${run.id}`,
    );
    assert.deepEqual(run.outputs, canonical.outputs, `Changed output traceability ${run.id}`);
    assert(Object.hasOwn(counts, run.status), `Invalid status ${run.id}`);
    counts[run.status]++;
    for (const requirement of canonical.requirements) {
      assert(Object.hasOwn(requirements, requirement), "Unknown company requirement");
      requirements[requirement][run.status]++;
    }
    assert(
      Array.isArray(run.evidence) && Array.isArray(run.defects),
      "Invalid evidence/defect list",
    );
    for (const artifact of run.evidence) {
      assert(kinds.includes(artifact.kind), "Invalid evidence kind");
      assert(hash.test(artifact.sha256), "Missing evidence digest");
      const url = new URL(artifact.url);
      assert(
        url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash,
        "Use a restricted HTTPS artifact reference without credentials/query/fragment",
      );
    }
    if (run.status === "Blocked") assert(present(run.blocker), `Missing blocker ${run.id}`);
    else assert.equal(run.blocker, "", `Unresolved blocker ${run.id}`);
    if (!["Passed", "Failed"].includes(run.status)) continue;
    assert(!canonical.aggregate, `Parent checkpoint cannot have aggregate outcome ${run.id}`);
    for (const key of ["executor", "reviewer", "expected", "actual", "oracle"])
      assert(present(run[key]), `Missing ${key} ${run.id}`);
    assert.notEqual(
      run.executor.trim().toLowerCase(),
      run.reviewer.trim().toLowerCase(),
      "Independent reviewer required",
    );
    assert(run.context && typeof run.context === "object", "Missing execution context");
    for (const key of ["role", "channel", "device", "os", "locale"]) {
      assert(present(run.context[key]), `Missing execution context ${key}`);
    }
    assert(
      Array.isArray(run.context.fixtureIds) &&
        run.context.fixtureIds.length > 0 &&
        run.context.fixtureIds.every(present),
      "Missing exact synthetic fixture IDs",
    );
    for (const key of ["startedAt", "endedAt"])
      assert(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(run[key]) &&
          Number.isFinite(Date.parse(run[key])) &&
          new Date(run[key]).toISOString() === run[key],
        "Use exact UTC timestamps",
      );
    assert(Date.parse(run.endedAt) >= Date.parse(run.startedAt), "End precedes start");
    assert(run.evidence.length > 0, "Executed result needs evidence");
    if (run.status === "Failed")
      assert(
        run.defects.length > 0 && run.defects.every(present),
        "Failed result needs defect reference",
      );
    if (run.status === "Passed") {
      for (const kind of requiredKinds(canonical.group))
        assert(
          run.evidence.some((artifact) => artifact.kind === kind),
          `Missing ${kind} evidence ${run.id}; synthetic checks cannot pass acceptance`,
        );
    }
  }
  return {
    counts,
    requirements,
    gate: "Not evaluated",
    note: "Structural validation is not evidence authenticity, company acceptance or G1 approval.",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [command, candidateFile, ledgerFile, ...extra] = process.argv.slice(2);
    assert(
      ["init", "validate"].includes(command) && candidateFile && extra.length === 0,
      "Usage: node scripts/qa/evidence.mjs init CANDIDATE.json | validate CANDIDATE.json LEDGER.json",
    );
    assert(command === "validate" ? ledgerFile : !ledgerFile, "Unexpected/missing ledger argument");
    const candidate = JSON.parse(readFileSync(candidateFile, "utf8"));
    const markdown = readFileSync(registerPath, "utf8");
    const result =
      command === "init"
        ? createLedger(markdown, candidate)
        : validateLedger(JSON.parse(readFileSync(ledgerFile, "utf8")), markdown, candidate);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    // Do not echo potentially private user-supplied ledger values or file contents.
    console.error(
      error instanceof assert.AssertionError
        ? "QA evidence rejected: validation assertion failed; inspect the ledger privately."
        : "QA evidence rejected: invalid command, file or JSON.",
    );
    process.exitCode = 1;
  }
}
