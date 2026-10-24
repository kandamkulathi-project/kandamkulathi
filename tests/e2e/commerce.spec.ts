import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import worker from "../../apps/core-api/src/index";

// Real loopback HTTP, deliberately unavailable deployment composition. No provider or payment is simulated.
let server: Server;
let base: string;
test.beforeAll(async () => {
  server = createServer(async (incoming, outgoing) => {
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(",") : value);
    }
    const init: RequestInit = { method: incoming.method ?? "GET", headers };
    if (chunks.length) init.body = Buffer.concat(chunks);
    const response = await worker.fetch(new Request(`${base}${incoming.url ?? "/"}`, init), {
      APP_ENV: "local",
    });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Loopback HTTP fixture failed.");
  base = `http://127.0.0.1:${address.port}`;
});

test("default Core commerce rejects malformed IDs and never trusts forged ownership", async ({
  request,
}) => {
  const invalid = await request.get(`${base}/v1/products/not-a-canonical-id`);
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toMatchObject({ error: { code: "INVALID_INPUT" } });
  const forged = await request.post(`${base}/v1/checkout`, {
    headers: { Authorization: "Bearer forged", "X-Actor-ID": "administrator" },
    data: { ownerId: "administrator", source: "staff", amountPaise: 1 },
  });
  expect(forged.status()).toBe(503);
  expect(await forged.json()).toMatchObject({ error: { code: "IDENTITY_UNAVAILABLE" } });
});
test.afterAll(async () => {
  server?.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server?.close((cause) => (cause ? reject(cause) : resolve())),
  );
});

test("commerce HTTP never presents unavailable integrations as empty or successful business operations", async ({
  request,
}) => {
  const catalogue = await request.get(`${base}/v1/catalogue`);
  expect(catalogue.status()).toBe(503);
  expect(await catalogue.json()).toMatchObject({ error: { code: "COMMERCE_UNAVAILABLE" } });
  const clinics = await request.get(`${base}/v1/commerce/clinics`);
  expect(clinics.status()).toBe(503);
  expect(await clinics.json()).toMatchObject({ error: { code: "COMMERCE_UNAVAILABLE" } });
  const staffClinics = await request.get(`${base}/v1/staff/commerce/clinics`, {
    headers: { "X-Role": "admin" },
  });
  expect(staffClinics.status()).toBe(503);
  expect(await staffClinics.json()).toMatchObject({ error: { code: "IDENTITY_UNAVAILABLE" } });
  for (const headers of [
    {},
    { Authorization: "Bearer fabricated", "X-Role": "admin", "X-MFA": "true" },
    { Cookie: "session=fabricated", "X-Actor-ID": "a1111111-a111-4111-8111-111111111111" },
  ]) {
    const response = await request.get(`${base}/v1/orders`, { headers });
    expect(response.status()).toBe(503);
    const result = await response.json();
    expect(result).toMatchObject({ error: { code: "IDENTITY_UNAVAILABLE" } });
    expect(result).not.toHaveProperty("items");
    expect(response.headers()["x-request-id"]).toBe(result.error.requestId);
    expect(response.headers()["cache-control"]).toBe("no-store");
  }
  const checkout = await request.post(`${base}/v1/checkout`, {
    data: { paid: true, amountPaise: 1 },
  });
  expect(checkout.status()).toBe(503);
  expect(await checkout.json()).toMatchObject({ error: { code: "IDENTITY_UNAVAILABLE" } });
  const callback = await request.post(`${base}/v1/payments/razorpay/webhook`, {
    data: { paid: true },
  });
  expect(callback.status()).toBe(400);
  expect(await callback.json()).toMatchObject({ error: { code: "PAYMENT_VERIFICATION_FAILED" } });
});
