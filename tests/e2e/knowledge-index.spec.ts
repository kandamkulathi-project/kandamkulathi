import { expect, test } from "@playwright/test";

// Parent MUST register the actual Core route. An absent route (404) fails this case.
test("Core public search fails truthfully without configured primary/vector resources", async ({
  request,
}) => {
  const response = await request.post("http://127.0.0.1:8787/v1/knowledge/search", {
    data: { term: "synthetic", language: "en" },
  });
  expect(response.status()).toBe(503);
  expect(await response.json()).toEqual({ status: "not-ready", reason: "NOT_CONFIGURED" });
  expect(response.headers()["cache-control"]).toBe("no-store");
  const privateInput = await request.post("http://127.0.0.1:8787/v1/knowledge/search", {
    data: { term: "synthetic", language: "en", patientPrompt: "SYNTHETIC forbidden field" },
  });
  expect(privateInput.status()).toBe(400);
});
