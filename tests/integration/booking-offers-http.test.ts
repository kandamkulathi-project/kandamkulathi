import { expect, it, vi } from "vitest";
import { registerBookingOffersRoutes } from "../../apps/core-api/src/booking-offers.ts";
import { createService } from "../../packages/server/src/index.ts";

it("rejects malformed/repeated/unknown query arguments before storage and fails unavailable without metadata", async () => {
  const withContext = vi.fn(async () => {
    throw new Error("private-storage-detail");
  });
  const app = createService("core-api", () => {}, {
    registerRoutes: (app) => registerBookingOffersRoutes(app, { withContext }),
  });
  for (const path of [
    "/v1/booking-offers",
    "/v1/booking-offers?doctorId=bad",
    "/v1/booking-offers?limit=1&limit=2",
  ]) {
    expect((await app.request(path, {}, { APP_ENV: "local" })).status).toBe(400);
  }
  expect(withContext).not.toHaveBeenCalled();
  const response = await app.request("/v1/booking-metadata", {}, { APP_ENV: "local" });
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.text()).not.toContain("private-storage-detail");
});
