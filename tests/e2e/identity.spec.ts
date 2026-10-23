import { expect, test } from "@playwright/test";

// Real local workerd, production composition, no route interception or injected authority.
test("Core identity remains unavailable rather than trusting fabricated session, scope or MFA", async ({
  request,
}) => {
  const base = "http://127.0.0.1:8787";
  for (const headers of [
    {},
    { Authorization: "Bearer fabricated", "X-Role": "admin", "X-MFA": "true" },
    { Cookie: "session=fabricated", "X-Actor-ID": "11111111-1111-4111-8111-111111111111" },
    { "X-Verified-User": "11111111-1111-4111-8111-111111111111", "X-Workspaces": "physician" },
  ]) {
    const response = await request.get(`${base}/v1/session`, { headers });
    expect(response.status()).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ error: { code: "IDENTITY_UNAVAILABLE" } });
    expect(body).not.toHaveProperty("userId");
    expect(body).not.toHaveProperty("workspaces");
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-request-id"]).toBe(body.error.requestId);
    expect(response.headers()["set-cookie"]).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/fabricated|Bearer|stack|patientId/);
  }
  // The unfinished session endpoint cannot mutate cookies or consent through POST.
  const mutation = await request.post(`${base}/v1/session`, { data: {} });
  expect(mutation.status()).toBe(503);
  expect(await mutation.json()).toMatchObject({ error: { code: "FEATURE_UNAVAILABLE" } });
  expect(mutation.headers()["set-cookie"]).toBeUndefined();
});
