import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function summarize(records, now = new Date()) {
  for (const row of records) {
    assert(Number.isFinite(Date.parse(row.timestamp)), "Invalid telemetry timestamp");
    assert(
      ["local", "preview", "dev", "staging", "production"].includes(row.environment),
      "Unattributed telemetry requires reconciliation",
    );
    if (row.event === "http_request")
      assert(
        Number.isInteger(row.status) && row.status >= 100 && row.status <= 599,
        "Invalid HTTP telemetry",
      );
    if (row.event === "job_claim")
      assert(
        /^[a-f0-9-]{36}$/.test(row.jobId ?? "") &&
          Number.isFinite(row.pickupMs) &&
          row.pickupMs >= 0,
        "Invalid job telemetry",
      );
  }
  const end = now.getTime();
  const start = end - 30 * 86400000;
  const relevant = records.filter(
    (row) =>
      row.service === "core-api" &&
      ["local", "preview", "dev", "staging", "production"].includes(row.environment) &&
      Date.parse(row.timestamp) >= start &&
      Date.parse(row.timestamp) <= end,
  );
  // Do not merge environments or silently combine local and production evidence.
  const environments = new Set(relevant.map((row) => row.environment));
  assert(environments.size <= 1, "A report must describe one isolated environment");
  const http = relevant.filter(
    (row) =>
      row.event === "http_request" &&
      row.route === "api" &&
      Number.isInteger(row.status) &&
      ((row.status >= 200 && row.status < 400) || (row.status >= 500 && row.status < 600)),
  );
  const failures = http.filter((row) => row.status >= 500).length;
  const jobs = relevant.filter(
    (row) =>
      row.event === "job_claim" &&
      /^[a-f0-9-]{36}$/.test(row.jobId ?? "") &&
      Number.isFinite(row.pickupMs) &&
      row.pickupMs >= 0,
  );
  // One observation per durable job: retain its FIRST claim, including slow pickups.
  const first = new Map();
  for (const row of [...jobs].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))) {
    if (!first.has(row.jobId)) first.set(row.jobId, row.pickupMs);
  }
  const timings = [...first.values()].sort((a, b) => a - b);
  const p95 = timings.length ? timings[Math.ceil(timings.length * 0.95) - 1] : null;
  return {
    windowDays: 30,
    environment: [...environments][0] ?? null,
    eligibleRequests: http.length,
    failures,
    availability: http.length ? 1 - failures / http.length : null,
    targetAvailability: 0.999,
    observedJobs: timings.length,
    pickupP95Ms: p95,
    targetPickupP95Ms: 120000,
    minimumJobSamples: 100,
    pickupObjectiveObserved: timings.length >= 100 && p95 < 120000,
    // A file of sampled logs cannot prove uninterrupted retention/collection for the whole month.
    monthlyCoverageVerified: false,
    phaseAcceptance: "pending",
  };
}

/** Safe test event only. External delivery requires an explicitly approved endpoint and operator invocation. */
export async function alertProbe(
  endpoint,
  { environment, namespace, approvedExternal = false } = {},
) {
  assert(
    ["local", "preview", "dev", "staging"].includes(environment),
    "P1 alert tests are nonproduction only",
  );
  const url = new URL(endpoint);
  const local = url.protocol === "http:" && url.hostname === "127.0.0.1";
  assert(
    local || (approvedExternal && url.protocol === "https:"),
    "Explicit approved TLS endpoint required",
  );
  assert(
    !url.username && !url.password && !url.search && !url.hash,
    "Alert credentials must not be in URLs",
  );
  assert(
    namespace === `kandamkulathi-${environment}` ||
      (environment === "preview" && /^kandamkulathi-preview-[a-z0-9-]+$/.test(namespace)),
    "Wrong alert namespace",
  );
  const response = await fetch(url, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(5000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "alert_probe",
      environment,
      namespace,
      severity: "test",
      message: "Synthetic platform alert delivery test; no patient or financial data.",
    }),
  });
  assert(response.ok, "Alert endpoint rejected the test");
  await response.body?.cancel();
  return { accepted: true, recipientReceiptVerified: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv[2] === "summary") {
      const records = readFileSync(process.argv[3], "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      console.log(JSON.stringify(summarize(records), null, 2));
    } else {
      assert.equal(process.argv[2], "alert-test");
      console.log(
        JSON.stringify(
          await alertProbe(process.env.PLATFORM_ALERT_TEST_URL, {
            environment: process.env.APP_ENV,
            namespace: process.env.RESOURCE_NAMESPACE,
            approvedExternal: process.env.APPROVED_ALERT_TEST === "true",
          }),
        ),
      );
    }
  } catch {
    console.error(
      "Telemetry report/test failed. Verify one environment, valid records and an explicitly approved alert target.",
    );
    process.exitCode = 1;
  }
}
