import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { inside, repository, snapshot } from "./evidence.mjs";

/** Records metadata/hashes only; never test titles, messages, health payloads, tokens or error bodies. */
export default class CandidateReporter {
  constructor(options = {}) {
    this.root = options.repositoryRoot ?? repository;
    assert(
      !process.env.KANDAMKULATHI_VERIFICATION_RUN_ID ||
        /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
          process.env.KANDAMKULATHI_VERIFICATION_RUN_ID,
        ),
      "Invalid verification run identifier",
    );
    this.runId = process.env.KANDAMKULATHI_VERIFICATION_RUN_ID ?? randomUUID();
    this.attempts = { passed: 0, failed: 0, timedOut: 0, skipped: 0, interrupted: 0 };
  }
  onBegin(_config, suite) {
    this.startedAt = new Date().toISOString();
    this.plannedTests = suite.allTests().length;
    try {
      this.before = snapshot(this.root);
    } catch {
      this.invalid = true;
    }
  }
  onTestEnd(_test, result) {
    if (Object.hasOwn(this.attempts, result.status)) this.attempts[result.status]++;
    else this.invalid = true;
  }
  async onEnd(result) {
    let after;
    try {
      after = snapshot(this.root);
      assert(!this.invalid && this.plannedTests > 0 && this.before);
      assert.deepEqual(after, this.before);
    } catch {
      this.invalid = true;
    }
    const report = {
      format: 1,
      runId: this.runId,
      scope: "local-only",
      phaseDecision: "not-issued",
      startedAt: this.startedAt,
      endedAt: new Date().toISOString(),
      bindingStatus: this.invalid ? "failed" : "passed",
      testStatus: result.status,
      plannedTests: this.plannedTests,
      attempts: this.attempts,
      before: this.before,
      after,
    };
    try {
      const path = inside(this.root, "test-results/p1-candidate-binding.json");
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    } catch {
      this.invalid = true;
    }
    if (this.invalid) {
      console.error(
        "Candidate evidence failed: source/build changed, missing artifacts or evidence unavailable.",
      );
      return { status: "failed" };
    }
  }
}
