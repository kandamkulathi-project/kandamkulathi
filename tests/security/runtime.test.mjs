import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assessRuntime } from "../../scripts/security/runtime.mjs";

const now = new Date("2026-10-19T00:00:00Z");
const data = () => ({
  releases: [
    { version: "v24.22.0", security: false },
    { version: "v24.18.1", security: true },
  ],
  schedule: { v24: { end: "2028-04-30" } },
  advisories: {
    fixture: { vulnerable: "24.x", patched: "^24.18.1", cve: ["synthetic"], severity: "low" },
  },
});
describe("Node official-feed security decisions", () => {
  it("accepts a supported published version containing the security fixes", () => {
    assert.deepEqual(assessRuntime("24.22.0", data(), now), []);
  });
  it("blocks vulnerable versions regardless of advisory severity", () => {
    const source = data();
    source.releases.push({ version: "v24.18.0", security: false });
    assert(assessRuntime("24.18.0", source, now).some((item) => item.id === "fixture"));
  });
  it("blocks new security releases even if the advisory feed has not caught up", () => {
    const source = data();
    source.releases.unshift({ version: "v24.23.0", security: true });
    assert.equal(assessRuntime("24.22.0", source, now).length, 1);
  });
  it("rejects EOL versions, unpublished pins, empty feeds and malformed advisory ranges", () => {
    assert.throws(() => assessRuntime("24.22.0", data(), new Date("2029-01-01")), /end-of-life/);
    assert.throws(() => assessRuntime("24.99.0", data(), now), /Unpublished/);
    assert.throws(() => assessRuntime("24.22.0", { ...data(), advisories: {} }, now), /Missing/);
    const source = data();
    source.advisories.fixture.patched = "malformed range";
    assert.throws(() => assessRuntime("24.22.0", source, now), /Invalid patched range/);
  });
});
