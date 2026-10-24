import { expect, test } from "@playwright/test";

const session = "http://127.0.0.1:8787/v1/session";
const approved = [
  "http://localhost:4321",
  "http://127.0.0.1:4321",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

test("actual local Core grants only the four exact configured local origins", async ({
  request,
}) => {
  for (const origin of approved) {
    const response = await request.get(session, { headers: { Origin: origin } });
    expect(response.status()).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "IDENTITY_UNAVAILABLE" } });
    expect(response.headers()["access-control-allow-origin"]).toBe(origin);
    expect(response.headers()["access-control-allow-credentials"]).toBe("true");
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers().vary?.split(/,\s*/)).toContain("Origin");

    const preflight = await request.fetch(session, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    expect(preflight.status()).toBe(204);
    expect(preflight.headers()["access-control-allow-origin"]).toBe(origin);
    expect(preflight.headers()["access-control-allow-credentials"]).toBe("true");
    expect(preflight.headers()["access-control-allow-methods"]?.split(/,\s*/)).toEqual([
      "GET",
      "HEAD",
      "OPTIONS",
      "POST",
    ]);
    expect(preflight.headers()["cache-control"]).toBe("no-store");
    expect(preflight.headers().vary?.split(/,\s*/)).toContain("Origin");
  }
});

test("actual local Core denies cross-origin mutations and permits approved preflight", async ({
  request,
}) => {
  for (const origin of ["null", "https://example.invalid", "http://localhost:5173/"]) {
    const response = await request.post("http://127.0.0.1:8787/v1/checkout", {
      headers: { Origin: origin },
      data: { confirmation: true },
    });
    expect(response.status()).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "ORIGIN_FORBIDDEN" } });
    expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
    expect(response.headers()["cache-control"]).toBe("no-store");
  }
  const response = await request.fetch("http://127.0.0.1:8787/v1/checkout", {
    method: "OPTIONS",
    headers: {
      Origin: "http://127.0.0.1:5173",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,x-csrf-token,idempotency-key",
    },
  });
  expect(response.status()).toBe(204);
  expect(response.headers()["access-control-allow-origin"]).toBe("http://127.0.0.1:5173");
  expect(response.headers()["access-control-allow-headers"]?.toLowerCase()).toContain(
    "x-csrf-token",
  );
  expect(response.headers()["access-control-allow-headers"]?.toLowerCase()).toContain(
    "idempotency-key",
  );
});

test("actual local Core gives no credentialed CORS grant to absent or inexact origins", async ({
  request,
}) => {
  // Protocol checks, not a substitute for the separate unmocked Chromium JSON/console test.
  for (const origin of [
    undefined,
    "null",
    "*",
    "https://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://localhost:5174",
    "http://127.0.0.2:5173",
    "http://localhost.example:5173",
    "http://localhost:5173/",
    "http://LOCALHOST:5173",
    "https://example.invalid",
  ]) {
    const headers: Record<string, string> = origin === undefined ? {} : { Origin: origin };
    const response = await request.get(session, { headers });
    expect(response.status()).toBe(503);
    expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
    expect(response.headers()["access-control-allow-credentials"]).toBeUndefined();
    expect(response.headers()["cache-control"]).toBe("no-store");
    const preflight = await request.fetch(session, {
      method: "OPTIONS",
      headers: { ...headers, "Access-Control-Request-Method": "GET" },
    });
    expect(preflight.status()).toBe(204);
    expect(preflight.headers()["access-control-allow-origin"]).toBeUndefined();
    expect(preflight.headers()["access-control-allow-credentials"]).toBeUndefined();
    expect(preflight.headers()["cache-control"]).toBe("no-store");
  }
});
