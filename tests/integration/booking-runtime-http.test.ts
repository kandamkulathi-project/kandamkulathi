import { describe, expect, it, vi } from "vitest";
import {
  type BookingDependencies,
  registerBookingRoutes,
} from "../../apps/core-api/src/booking.ts";
import { bookingRecordSchema } from "../../packages/contracts/src/booking.ts";
import { createService } from "../../packages/server/src/index.ts";

const id = "00000000-0000-4000-8000-000000000001";
const identity = {
  actorId: id,
  sessionId: id,
  organizationId: null,
  authenticatedAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2030-01-01T00:00:00.000Z",
  mfa: null,
};
function fixture(overrides: Partial<BookingDependencies> = {}) {
  const dependencies: BookingDependencies = {
    verifySession: async () => ({ status: "unauthenticated" }),
    verifyMutation: async () => "denied",
    loadAuthority: async () => {
      throw new Error("Current authority adapter unavailable");
    },
    withContext: vi.fn(async () => {
      throw new Error("Database unavailable");
    }),
    ...overrides,
  };
  const app = createService("core-api", () => {}, {
    registerRoutes: (app) => registerBookingRoutes(app, dependencies),
  });
  return {
    dependencies,
    request: (path: string, init?: RequestInit) => app.request(path, init, { APP_ENV: "local" }),
  };
}

describe("booking runtime HTTP boundary", () => {
  it("invalid stored state is unavailable, not a customer validation error", async () => {
    const { request } = fixture({
      withContext: async () => {
        bookingRecordSchema.parse({});
        throw new Error("unreachable");
      },
    });
    const response = await request("/v1/doctors");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: "BOOKING_UNAVAILABLE" } });
  });
  it("does not accept forged actors or reach SQL without verified session", async () => {
    const { request, dependencies } = fixture();
    const response = await request("/v1/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Actor": id },
      body: JSON.stringify({ patient: "private-value" }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).not.toContain("private-value");
    expect(dependencies.withContext).not.toHaveBeenCalled();
  });

  it("requires mutation proof before parsing or persisting the request", async () => {
    const { request, dependencies } = fixture({
      verifySession: async () => ({
        status: "verified",
        identity,
      }),
    });
    expect((await request("/v1/bookings", { method: "POST", body: "malformed" })).status).toBe(403);
    expect(dependencies.withContext).not.toHaveBeenCalled();
  });

  it("rejects malformed input and availability IDs before database access", async () => {
    const { request, dependencies } = fixture({
      verifySession: async () => ({
        status: "verified",
        identity,
      }),
      verifyMutation: async () => "allowed",
    });
    expect(
      (
        await request("/v1/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
    ).toBe(400);
    expect((await request("/v1/availability?doctorId=invalid")).status).toBe(400);
    expect(dependencies.withContext).not.toHaveBeenCalled();
  });

  it("keeps missing adapters and unsupported history/join truthfully unavailable", async () => {
    const { request } = fixture();
    expect((await request("/v1/doctors")).status).toBe(503);
    expect((await request("/v1/bookings/history")).status).toBe(503);
    expect((await request(`/v1/bookings/${id}/join`)).status).toBe(503);
    expect((await request("/v1/bookings/capture", { method: "POST" })).status).toBe(503);
  });

  it("preserves mutation authority outages as unavailable before parsing or SQL", async () => {
    const { request, dependencies } = fixture({
      verifySession: async () => ({ status: "verified", identity }),
      verifyMutation: async () => "unavailable",
    });
    const response = await request("/v1/bookings", { method: "POST", body: "malformed" });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: "IDENTITY_UNAVAILABLE" } });
    expect(dependencies.withContext).not.toHaveBeenCalled();
  });
});
