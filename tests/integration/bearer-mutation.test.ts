import { describe, expect, it } from "vitest";
import { createService } from "../../packages/server/src/index";

describe("shared browser origin policy used by bearer APIs", () => {
  it("allows approved mutation preflight without treating it as an authorization grant", async () => {
    const response = await createService("core-api").request(
      "/v1/example",
      {
        method: "OPTIONS",
        headers: { Origin: "http://127.0.0.1:5173", "Access-Control-Request-Method": "POST" },
      },
      { APP_ENV: "local" },
    );
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
  });
  it("retains the coordinator shared boundary rather than defining a second bearer origin policy", async () => {
    const response = await createService("core-api").request(
      "/v1/example",
      {
        method: "OPTIONS",
        headers: {
          Origin: "http://127.0.0.1:5173",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization,content-type",
        },
      },
      { APP_ENV: "local" },
    );
    expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5173");
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });
  it("never reflects an unapproved frontend origin", async () => {
    const response = await createService("core-api").request(
      "/v1/example",
      {
        method: "OPTIONS",
        headers: { Origin: "https://untrusted.example", "Access-Control-Request-Method": "POST" },
      },
      { APP_ENV: "local" },
    );
    expect(response.headers.has("access-control-allow-origin")).toBe(false);
    expect(response.status).toBe(403);
  });
});
