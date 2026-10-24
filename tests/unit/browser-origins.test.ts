import { describe, expect, it } from "vitest";
import { browserOrigins, unsafeBrowserMethod } from "../../packages/server/src/browser-origins";
import { createService } from "../../packages/server/src/index";

describe("explicit browser origin configuration", () => {
  it("keeps local origins fixed and remote origins denied by default", () => {
    expect(browserOrigins("local", undefined)).toHaveLength(4);
    expect(browserOrigins("production", undefined)).toEqual([]);
    expect(browserOrigins("staging", "https://shop.example, https://staff.example")).toEqual([
      "https://shop.example",
      "https://staff.example",
    ]);
  });

  it.each([
    "*",
    "null",
    "https://shop.example/",
    "https://SHOP.example",
    "http://shop.example",
    "https://user:password@shop.example",
    "https://shop.example?allowed=true",
    "https://shop.example#allowed",
    "https://localhost",
    "https://127.0.0.1",
    "https://[::1]",
    "https://shop.example,",
    "https://shop.example,https://shop.example",
  ])("rejects invalid configuration without reflecting it: %s", (value) => {
    expect(() => browserOrigins("production", value)).toThrow("Platform configuration is invalid.");
  });

  it("rejects wrong types, oversized lists and overrides of local origins", () => {
    expect(() => browserOrigins("production", ["https://shop.example"])).toThrow();
    expect(() => browserOrigins("production", "x".repeat(2049))).toThrow();
    expect(() =>
      browserOrigins(
        "production",
        Array.from({ length: 9 }, (_, i) => `https://s${i}.example`).join(","),
      ),
    ).toThrow();
    expect(() => browserOrigins("local", "https://shop.example")).toThrow();
  });

  it("recognizes both actual and preflight mutations", () => {
    expect(unsafeBrowserMethod("GET")).toBe(false);
    expect(unsafeBrowserMethod("OPTIONS", "GET")).toBe(false);
    expect(unsafeBrowserMethod("POST")).toBe(true);
    expect(unsafeBrowserMethod("OPTIONS", "DELETE")).toBe(true);
  });
});

describe("browser mutation boundary", () => {
  const bindings = { APP_ENV: "local" };

  it("advertises only implemented browser methods and explicit bearer/CSRF headers", async () => {
    const app = createService("core-api");
    const response = await app.request(
      "/v1/checkout",
      {
        method: "OPTIONS",
        headers: {
          Origin: "http://127.0.0.1:5173",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization,content-type,x-role",
        },
      },
      bindings,
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET,HEAD,OPTIONS,POST");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type,Authorization,X-CSRF-Token,Idempotency-Key",
    );
    expect(response.headers.get("Access-Control-Allow-Headers")).not.toMatch(/x-role/i);
  });

  it.each(["null", "https://attacker.example", "http://localhost:5173/", ""])(
    "rejects disallowed origin %s before calling the registered route",
    async (origin) => {
      let calls = 0;
      const app = createService("core-api", undefined, {
        registerRoutes(service) {
          service.post("/v1/mutation-probe", (context) => {
            calls++;
            return context.json({ authenticated: false }, 401);
          });
        },
      });
      for (const method of ["POST", "PATCH", "DELETE", "OPTIONS"]) {
        const response = await app.request(
          "/v1/mutation-probe",
          {
            method,
            headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
          },
          bindings,
        );
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ error: { code: "ORIGIN_FORBIDDEN" } });
        expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
      }
      expect(calls).toBe(0);
    },
  );

  it("does not treat an approved origin as authenticated", async () => {
    let calls = 0;
    const app = createService("core-api", undefined, {
      registerRoutes(service) {
        service.post("/v1/mutation-probe", (context) => {
          calls++;
          return context.json({ error: { code: "UNAUTHENTICATED" } }, 401);
        });
      },
    });
    for (const origin of [undefined, "http://127.0.0.1:5173"]) {
      const response = await app.request(
        "/v1/mutation-probe",
        { method: "POST", headers: origin === undefined ? {} : { Origin: origin } },
        bindings,
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: { code: "UNAUTHENTICATED" } });
    }
    expect(calls).toBe(2);
  });

  it("grants only a configured exact HTTPS origin outside local development", async () => {
    const app = createService("core-api");
    const env = {
      APP_ENV: "staging",
      RESOURCE_NAMESPACE: "kandamkulathi-staging",
      PROVIDER_MODE: "sandbox",
      BROWSER_ALLOWED_ORIGINS: "https://shop.example",
    };
    for (const origin of ["https://shop.example", "https://shop.example.attacker.example"]) {
      const response = await app.request("/v1/system/status", { headers: { Origin: origin } }, env);
      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        origin === "https://shop.example" ? origin : null,
      );
    }
    const invalid = await app.request(
      "/v1/system/status",
      {},
      { ...env, BROWSER_ALLOWED_ORIGINS: "*" },
    );
    expect(invalid.status).toBe(503);
    expect(await invalid.text()).not.toContain("https://shop.example");
  });
});
