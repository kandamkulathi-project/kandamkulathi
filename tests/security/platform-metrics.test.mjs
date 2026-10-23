import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import { alertProbe, summarize } from "../../scripts/platform/metrics.mjs";

const now = new Date("2026-10-20T00:00:00Z");
const record = (extra) => ({
  timestamp: now.toISOString(),
  service: "core-api",
  environment: "dev",
  ...extra,
});
test("SLI excludes health, invalid/old/private routes and mixed environments; zero samples are not success", () => {
  const input = [
    record({ event: "http_request", route: "api", status: 200 }),
    record({ event: "http_request", route: "api", status: 503 }),
    record({ event: "http_request", route: "api", status: 403 }),
    record({ event: "http_request", route: "liveness", status: 200 }),
    record({ event: "http_request", route: "api", status: 200, timestamp: "2025-01-01T00:00:00Z" }),
  ];
  const report = summarize(input, now);
  assert.equal(report.eligibleRequests, 2);
  assert.equal(report.availability, 0.5);
  assert.equal(report.monthlyCoverageVerified, false);
  assert.throws(
    () =>
      summarize([record({ event: "job_claim", jobId: randomUUID(), pickupMs: Number.NaN })], now),
    /Invalid job telemetry/,
  );
  assert.equal(summarize([], now).availability, null);
  assert.throws(
    () => summarize([...input, record({ environment: "production" })], now),
    /one isolated environment/,
  );
});
test("healthy job p95 includes slow first pickup, deduplicates retries and requires a stated sample count", () => {
  const inputs = Array.from({ length: 100 }, (_, index) =>
    record({ event: "job_claim", jobId: randomUUID(), pickupMs: index >= 94 ? 130000 : 500 }),
  );
  inputs.push({
    ...inputs[99],
    timestamp: new Date(now.getTime() + 1000).toISOString(),
    pickupMs: 1,
  });
  const result = summarize(inputs, new Date(now.getTime() + 2000));
  assert.equal(result.observedJobs, 100);
  assert.equal(result.pickupP95Ms, 130000);
  assert.equal(result.pickupObjectiveObserved, false);
  assert.equal(summarize(inputs.slice(0, 5), now).pickupObjectiveObserved, false);
});
test("actual local alert HTTP delivery contains only synthetic context, and rejection is not a successful receipt", async () => {
  const payloads = [];
  let reject = false;
  const server = createServer(async (request, response) => {
    let text = "";
    for await (const bytes of request) text += bytes;
    payloads.push(JSON.parse(text));
    response.writeHead(reject ? 503 : 202).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/test`;
  try {
    assert.deepEqual(
      await alertProbe(endpoint, { environment: "local", namespace: "kandamkulathi-local" }),
      { accepted: true, recipientReceiptVerified: false },
    );
    assert.equal(payloads[0].event, "alert_probe");
    assert(!JSON.stringify(payloads).includes("Bearer"));
    reject = true;
    await assert.rejects(
      alertProbe(endpoint, { environment: "local", namespace: "kandamkulathi-local" }),
    );
    await assert.rejects(
      alertProbe("http://external.invalid/test", {
        environment: "dev",
        namespace: "kandamkulathi-dev",
      }),
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
