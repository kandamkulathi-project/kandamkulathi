import { expect, test } from "@playwright/test";

// Parent registers registerKnowledgeRuntimeRoutes(undefined) in actual Worker.
// This is the default-runtime fail-closed journey, not a configured content demo.
test("unconfigured mutation runtime cannot acquire grants from browser payloads", async ({
  request,
}) => {
  for (const path of [
    "drafts",
    "10000000-0000-4000-8000-000000000010/approve",
    "10000000-0000-4000-8000-000000000010/withdraw",
  ]) {
    const response = await request.post(`http://127.0.0.1:8788/v1/knowledge/${path}`, {
      headers: { Authorization: "Bearer fabricated", "X-Role": "physician" },
      data: { revision: 1, contentHash: "a".repeat(64) },
    });
    expect(response.status()).toBe(503);
    expect(await response.json()).toEqual({ status: "not-ready", reason: "NOT_CONFIGURED" });
    expect(response.headers()["cache-control"]).toBe("no-store");
  }
});
