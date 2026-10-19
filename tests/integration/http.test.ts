import { describe, expect, it } from "vitest";
import { errorSchema, healthSchema, systemStatusSchema } from "../../packages/contracts/src/index";
import { createService } from "../../packages/server/src/index";

describe.each(["core-api", "companion"] as const)("%s HTTP boundary", (service) => {
  const app = createService(service);
  const request = (path: string, init?: RequestInit, env = { APP_ENV: "local" }) =>
    app.request(`http://localhost${path}`, init, env);
  it("separates liveness from application readiness", async () => {
    const live = await request("/health/live");
    expect(live.status).toBe(200);
    expect(healthSchema.parse(await live.json()).service).toBe(service);
    const ready = await request("/health/ready");
    expect(ready.status).toBe(503);
    expect(errorSchema.parse(await ready.json()).error.code).toBe("APPLICATION_NOT_READY");
  });
  it("never claims implemented capabilities", async () => {
    const response = await request("/v1/system/status");
    expect(systemStatusSchema.parse(await response.json()).ready).toBe(false);
  });
  it.each(["/v1/orders", "/v1/clinical/patients", "/v1/chat"])(
    "cannot execute unfinished %s with a fabricated role",
    async (path) => {
      const response = await request(path, {
        method: "POST",
        headers: { Authorization: "Bearer fabricated", "X-Role": "admin" },
        body: "{}",
      });
      expect(response.status).toBe(503);
      expect(errorSchema.parse(await response.json()).error.code).toBe("FEATURE_UNAVAILABLE");
    },
  );
  it("uses server request IDs, safe errors and private-cache prevention", async () => {
    const response = await request("/missing", {
      headers: { "X-Request-ID": "attacker-controlled" },
    });
    expect(response.status).toBe(404);
    const body = errorSchema.parse(await response.json());
    expect(response.headers.get("x-request-id")).toBe(body.error.requestId);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(JSON.stringify(body)).not.toMatch(/stack|attacker-controlled|Bearer/);
  });
  it("allows local frontend CORS only in the explicit local environment", async () => {
    const local = await request("/health/live", { headers: { Origin: "http://127.0.0.1:4321" } });
    expect(local.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:4321");
    for (const [origin, env] of [
      ["https://untrusted.invalid", "local"],
      ["http://127.0.0.1:4321", "production"],
    ]) {
      const response = await request(
        "/health/live",
        { headers: { Origin: origin ?? "" } },
        { APP_ENV: env ?? "" },
      );
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    }
  });
  it("rejects oversized requests before business handling", async () => {
    const response = await request("/v1/orders", { method: "POST", body: "a".repeat(65537) });
    expect(response.status).toBe(413);
    expect(errorSchema.parse(await response.json()).error.code).toBe("PAYLOAD_TOO_LARGE");
  });
});
