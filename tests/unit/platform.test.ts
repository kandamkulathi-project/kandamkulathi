import { describe, expect, it } from "vitest";
import {
  ConfigurationError,
  databaseTarget,
  platformConfig,
  requireProviderPermission,
} from "../../packages/server/src/config";
import { emitEvent } from "../../packages/server/src/observability";

const sandbox = {
  APP_ENV: "dev",
  RESOURCE_NAMESPACE: "kandamkulathi-dev",
  PROVIDER_MODE: "sandbox",
};
describe("environment isolation", () => {
  it("requires explicit remote modes and isolated resource names", () => {
    expect(platformConfig({ APP_ENV: "local" }).PROVIDER_MODE).toBe("stub");
    expect(platformConfig(sandbox).APP_ENV).toBe("dev");
    for (const env of [
      {},
      { APP_ENV: "dev" },
      { ...sandbox, RESOURCE_NAMESPACE: "kandamkulathi-production" },
      { ...sandbox, APP_ENV: "preview" },
    ])
      expect(() => platformConfig(env)).toThrow(ConfigurationError);
  });
  it.each(["ALLOW_LIVE_PAYMENTS", "ALLOW_LIVE_SENDS"])(
    "denies %s in every nonproduction environment",
    (flag) => {
      for (const APP_ENV of ["local", "preview", "dev", "staging"]) {
        expect(() =>
          platformConfig({
            ...sandbox,
            APP_ENV,
            RESOURCE_NAMESPACE: `kandamkulathi-${APP_ENV}`,
            [flag]: "true",
          }),
        ).toThrow(ConfigurationError);
      }
    },
  );
  it("keeps administrative and recovery secrets out of Workers", () => {
    for (const key of ["DATABASE_ADMIN_URL", "DATABASE_MIGRATION_URL", "BACKUP_KEY_B64"]) {
      expect(() => platformConfig({ ...sandbox, [key]: "sensitive-value" })).toThrow(
        "Platform configuration is invalid.",
      );
    }
  });
  it("requires explicit live operation grants, even in production", () => {
    const config = platformConfig({
      ...sandbox,
      APP_ENV: "production",
      RESOURCE_NAMESPACE: "kandamkulathi-production",
      PROVIDER_MODE: "live",
    });
    expect(() => requireProviderPermission(config, "payment")).toThrow(ConfigurationError);
    expect(() =>
      requireProviderPermission({ ...config, ALLOW_LIVE_PAYMENTS: "true" }, "payment"),
    ).not.toThrow();
    expect(() =>
      requireProviderPermission({ ...config, ALLOW_LIVE_PAYMENTS: "true" }, "send"),
    ).toThrow(ConfigurationError);
  });
  it("validates pooled verified TLS endpoints and rejects owner/connection-option bypasses", () => {
    const url =
      "postgresql://runtime:synthetic@ep-test-pooler.ap-southeast-1.aws.neon.tech/k_dev?sslmode=verify-full";
    expect(databaseTarget(url, "dev").hostname).toContain("-pooler.");
    for (const bad of [
      url.replace("-pooler", ""),
      url.replace("verify-full", "no-verify"),
      url.replace("runtime", "neondb_owner"),
      `${url}&options=-c%20role%3Dpostgres`,
      "postgresql://runtime:synthetic@127.0.0.1/k_dev",
    ]) {
      expect(() => databaseTarget(bad, "dev")).toThrow(ConfigurationError);
    }
    expect(
      databaseTarget("postgresql://runtime:synthetic@127.0.0.1/k_local", "local").hostname,
    ).toBe("127.0.0.1");
  });
});

describe("privacy-safe telemetry", () => {
  it("drops arbitrary properties, raw paths, invalid identifiers and nonfinite metrics", () => {
    const records: unknown[] = [];
    emitEvent(
      {
        event: "http_request",
        service: "core-api",
        environment: "dev",
        requestId: "secret",
        route: "api",
        status: 503,
        durationMs: Number.NaN,
        ...{
          password: "synthetic-password",
          prompt: "private-health-text",
          error: new Error("secret"),
        },
      },
      (record) => records.push(record),
    );
    expect(JSON.stringify(records)).not.toMatch(
      /secret|password|prompt|private-health|durationMs|requestId/,
    );
    expect(records[0]).toMatchObject({ sliEligible: true, sliFailure: true, status: 503 });
  });
  it("excludes health and intentional client errors from the core availability SLI", () => {
    const records: Readonly<Record<string, unknown>>[] = [];
    for (const [route, status] of [
      ["liveness", 200],
      ["api", 403],
      ["api", 200],
    ] as const) {
      emitEvent(
        { event: "http_request", service: "core-api", environment: "dev", route, status },
        (record) => records.push(record),
      );
    }
    expect(records.map((record) => record.sliEligible)).toEqual([false, false, true]);
    expect(() =>
      emitEvent({ event: "job_complete", service: "core-api", environment: "dev" }, () => {
        throw new Error("offline");
      }),
    ).not.toThrow();
  });
});
