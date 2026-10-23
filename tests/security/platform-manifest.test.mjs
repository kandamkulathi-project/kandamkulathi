import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateManifest } from "../../scripts/platform/manifest.mjs";
import { renderConfig } from "../../scripts/platform/render-config.mjs";

const planned = () =>
  JSON.parse(readFileSync(new URL("../../config/environments/dev.json", import.meta.url)));
test("planned inventory is explicit and cannot authorize deployment", () => {
  assert.equal(validateManifest(planned()).status, "planned");
  assert.throws(() => validateManifest(planned(), { provisioned: true }));
});
test("Core and Companion render separate safe bindings with explicit queue failure handling", () => {
  const core = renderConfig(planned(), "core-api");
  assert.equal(core.queues.consumers.length, 3);
  assert(
    core.queues.consumers.every(
      (queue) => queue.max_retries === 5 && queue.dead_letter_queue.endsWith("-dlq"),
    ),
  );
  assert.deepEqual(core.triggers.crons, []);
  assert.equal(core.observability.logs.invocation_logs, false);
  const companion = renderConfig(planned(), "companion");
  assert.deepEqual(companion.queues.consumers, []);
  assert.deepEqual(companion.r2_buckets, []);
  const staging = JSON.parse(
    readFileSync(new URL("../../config/environments/staging.json", import.meta.url)),
  );
  assert.deepEqual(renderConfig(staging, "core-api").triggers.crons, ["* * * * *"]);
});
test("wrong database/provider/resource boundaries are rejected", () => {
  const mutations = [
    (value) => {
      value.resources.privateBucket = "kandamkulathi-production-private";
    },
    (value) => {
      value.database.majorVersion = 18;
    },
    (value) => {
      value.database.runtimeRole = "neondb_owner";
    },
    (value) => {
      value.providerMode = "live";
    },
    (value) => {
      delete value.resources.clinicalDlq;
    },
  ];
  for (const mutate of mutations) {
    const value = planned();
    mutate(value);
    assert.throws(() => validateManifest(value));
  }
});
