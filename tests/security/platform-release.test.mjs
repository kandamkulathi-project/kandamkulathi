import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { prepareArtifact, privatePath, verifyArtifact } from "../../scripts/platform/release.mjs";

test("frozen release binds Worker bytes, inventory and schema; changes and path escape fail", () => {
  const root = resolve(".local-data", `artifact-test-${randomBytes(6).toString("hex")}`);
  mkdirSync(root, { recursive: true });
  const core = resolve(root, "core-input.js");
  const companion = resolve(root, "companion-input.js");
  writeFileSync(core, "export default {fetch(){return new Response('synthetic')}}");
  writeFileSync(companion, "export default {fetch(){return new Response('synthetic')}}");
  const manifest = JSON.parse(
    readFileSync(new URL("../../config/environments/dev.json", import.meta.url)),
  );
  const path = resolve(root, "release", "artifact.json");
  prepareArtifact({
    sourceSha: "a".repeat(40),
    manifest,
    output: path,
    bundles: { "core-api": core, companion },
  });
  assert.equal(verifyArtifact(path, manifest).apiVersion, 1);
  assert.throws(() => verifyArtifact(path, { ...manifest, namespace: "kandamkulathi-production" }));
  writeFileSync(resolve(root, "release", "core-api.js"), "modified");
  assert.throws(() => verifyArtifact(path, manifest));
  assert.throws(() => privatePath(".local-data/../../escaped.json"));
  assert.throws(() =>
    prepareArtifact({
      sourceSha: "a".repeat(40),
      manifest,
      output: path,
      bundles: { "core-api": core, companion },
    }),
  );
});
