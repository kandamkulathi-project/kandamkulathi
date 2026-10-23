import type { Environment } from "./config";

export type PlatformEvent = {
  event:
    | "http_request"
    | "job_claim"
    | "job_complete"
    | "job_retry"
    | "job_suppressed"
    | "platform_failure"
    | "alert_probe";
  service: "core-api" | "companion";
  environment: Environment | "invalid";
  requestId?: string;
  jobId?: string;
  status?: number;
  durationMs?: number;
  pickupMs?: number;
  route?: "liveness" | "readiness" | "system" | "api" | "unmatched";
};
export type LogSink = (record: Readonly<Record<string, string | number | boolean>>) => void;
const defaultSink: LogSink = (record) => console.log(JSON.stringify(record));
const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Construct from an allowlist; never serialize request, payload, exception or arbitrary context. */
export function emitEvent(input: PlatformEvent, sink: LogSink = defaultSink): void {
  const record: Record<string, string | number | boolean> = {
    timestamp: new Date().toISOString(),
    event: input.event,
    service: input.service,
    environment: input.environment,
  };
  for (const key of ["requestId", "jobId"] as const) {
    const value = input[key];
    if (value && id.test(value)) record[key] = value;
  }
  for (const key of ["status", "durationMs", "pickupMs"] as const) {
    const value = input[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0)
      record[key] = Math.round(value);
  }
  if (input.route) {
    record.route = input.route;
    record.sliEligible =
      input.route === "api" &&
      (input.status ?? 0) >= 200 &&
      ((input.status ?? 0) < 400 || (input.status ?? 0) >= 500);
    record.sliFailure = record.sliEligible === true && (input.status ?? 0) >= 500;
  }
  try {
    sink(Object.freeze(record));
  } catch {
    // Telemetry must never repeat an effect or turn a committed transaction into an HTTP retry.
  }
}

export function routeCategory(path: string): NonNullable<PlatformEvent["route"]> {
  if (path === "/health/live") return "liveness";
  if (path === "/health/ready") return "readiness";
  if (path === "/v1/system/status") return "system";
  if (path.startsWith("/v1/")) return "api";
  return "unmatched";
}
