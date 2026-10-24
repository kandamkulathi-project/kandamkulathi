import { describe, expect, it } from "vitest";
import worker from "../../apps/core-api/src/index";

describe("default Core commerce composition", () => {
  it.each(["/v1/catalogue", "/v1/products/10000000-0000-4000-8000-000000000001"])(
    "registers the real %s boundary without manufacturing storage",
    async (path) => {
      const response = await worker.fetch(new Request(`http://localhost${path}`), {
        APP_ENV: "local",
      });
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ error: { code: "COMMERCE_UNAVAILABLE" } });
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    },
  );

  it("keeps platform and identity guards ahead of commerce despite forged ownership", async () => {
    const invalidEnvironment = await worker.fetch(new Request("http://localhost/v1/catalogue"));
    expect(invalidEnvironment.status).toBe(503);
    expect(await invalidEnvironment.json()).toMatchObject({
      error: { code: "CONFIGURATION_INVALID" },
    });
    const forged = await worker.fetch(
      new Request("http://localhost/v1/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: "forged", source: "staff", amountPaise: 1 }),
      }),
      { APP_ENV: "local" },
    );
    expect(forged.status).toBe(503);
    expect(await forged.json()).toMatchObject({ error: { code: "IDENTITY_UNAVAILABLE" } });
  });
});
