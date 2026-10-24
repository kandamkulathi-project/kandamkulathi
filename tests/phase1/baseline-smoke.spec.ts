import { expect, test } from "@playwright/test";

// No intercepted responses, session fixtures or provider-success assertions.
// These checks deliberately bind the e5161d7 scaffold contract, not future business APIs.
const services = [
  { name: "core-api", origin: "http://127.0.0.1:8787" },
  { name: "companion", origin: "http://127.0.0.1:8788" },
] as const;
const workspace = "http://127.0.0.1:5173";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

for (const service of services) {
  test(`${service.name}: liveness does not imply application readiness`, async ({ request }) => {
    const live = await request.get(`${service.origin}/health/live`);
    expect(live.status()).toBe(200);
    expect(await live.json()).toEqual({
      service: service.name,
      status: "alive",
      stage: "scaffold",
    });
    const ready = await request.get(`${service.origin}/health/ready`);
    expect(ready.status()).toBe(503);
    expect(ready.headers()["cache-control"]).toBe("no-store");
    expect(await ready.json()).toEqual({
      error: {
        code: "APPLICATION_NOT_READY",
        message: "Application integrations and acceptance are pending.",
        requestId: ready.headers()["x-request-id"],
      },
    });
    const status = await request.get(`${service.origin}/v1/system/status`);
    expect(status.status()).toBe(200);
    expect(await status.json()).toMatchObject({
      service: service.name,
      ready: false,
      capabilities: {
        identity: "pending",
        commerce: "pending",
        consultations: "pending",
        companion: "pending",
      },
    });
  });

  test(`${service.name}: forged claims never produce a successful business response`, async ({
    request,
  }) => {
    const ids = new Set<string>();
    for (const path of ["/v1/session", "/v1/orders/synthetic-other-owner", "/v1/clinical/notes"]) {
      const response = await request.get(`${service.origin}${path}`, {
        headers: {
          "X-Role": "administrator",
          "X-Actor-ID": "synthetic-customer-A",
          "X-Clinic-ID": "synthetic-clinic-B",
          "X-Request-ID": "client-supplied-value",
        },
      });
      expect(response.status()).toBe(503);
      const id = response.headers()["x-request-id"] ?? "";
      expect(id).toMatch(uuid);
      expect(ids.has(id)).toBe(false);
      ids.add(id);
      expect(response.headers()["cache-control"]).toBe("no-store");
      expect(await response.json()).toEqual({
        error: {
          code: "FEATURE_UNAVAILABLE",
          message: "This feature is not implemented in the starter.",
          requestId: id,
        },
      });
    }
    // Unavailable is not proof of authenticated owner/clinic/RLS enforcement.
  });

  test(`${service.name}: oversized mutations fail at the actual Worker boundary`, async ({
    request,
  }) => {
    const response = await request.post(`${service.origin}/v1/checkout`, {
      data: "x".repeat(64 * 1024 + 1),
      headers: { "Content-Type": "text/plain" },
    });
    expect(response.status()).toBe(413);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers()["x-request-id"]).toMatch(uuid);
    expect(await response.json()).toEqual({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request exceeds the allowed size.",
        requestId: response.headers()["x-request-id"],
      },
    });
  });

  test(`${service.name}: browser can read approved-origin errors but not opaque-origin errors`, async ({
    page,
    browser,
  }) => {
    await page.goto(workspace);
    const approved = await page.evaluate(async (origin) => {
      const response = await fetch(`${origin}/v1/session`, { credentials: "include" });
      return {
        status: response.status,
        requestId: response.headers.get("X-Request-ID"),
        body: await response.json(),
      };
    }, service.origin);
    expect(approved.status).toBe(503);
    expect(approved.requestId).toMatch(uuid);
    expect(approved.body.error.requestId).toBe(approved.requestId);
    // A fresh about:blank context supplies an opaque Origin:null; no route mocking.
    const isolated = await browser.newContext();
    try {
      const opaquePage = await isolated.newPage();
      const blocked = await opaquePage.evaluate(async (origin) => {
        try {
          await fetch(`${origin}/v1/session`, { credentials: "include" });
          return false;
        } catch (error) {
          return error instanceof TypeError;
        }
      }, service.origin);
      expect(blocked).toBe(true);
    } finally {
      await isolated.close();
    }
    // CORS controls response readability, not server-side authentication or side effects.
  });
}
