import { describe, expect, it, vi } from "vitest";
import {
  type CommerceCheckoutDependencies,
  registerCommerceCheckoutRoutes,
} from "../../apps/core-api/src/commerce-checkout";
import { commercePaymentCheckoutSchema } from "../../packages/contracts/src/commerce-checkout";
import { PaymentError } from "../../packages/domain/src/commerce-payments";
import { createService } from "../../packages/server/src/index";
import { customerFixture, ids, now } from "../unit/identity-fixtures";

const dto = commercePaymentCheckoutSchema.parse({
  keyId: "rzp_test_synthetic",
  providerOrderId: "order_synthetic",
  amountPaise: 12345,
  currency: "INR",
  intentId: ids.assignment,
  operationId: ids.other,
  subject: { kind: "order", id: ids.consultation },
});
function fixture() {
  const customer = customerFixture();
  const dependencies: CommerceCheckoutDependencies = {
    verifySession: vi.fn(async () => ({
      status: "verified" as const,
      identity: customer.identity,
    })),
    loadCurrentAuthority: vi.fn(async () => customer.authority),
    loadCommerceGrants: vi.fn(async () => []),
    now: () => now,
    checkout: vi.fn(async () => dto),
  };
  const app = createService("core-api", () => {}, {
    registerRoutes: (app) => registerCommerceCheckoutRoutes(app, dependencies),
  });
  return {
    dependencies,
    customer,
    request: (suffix: string = ids.assignment, method = "GET") =>
      app.fetch(new Request(`http://localhost/v1/payments/${suffix}/checkout`, { method }), {
        APP_ENV: "local",
      }),
    query: (query: string) =>
      app.fetch(new Request(`http://localhost/v1/payments/${ids.assignment}/checkout${query}`), {
        APP_ENV: "local",
      }),
  };
}
describe("checkout metadata HTTP journey", () => {
  it("authenticated current customer gets only frozen private no-store DTO", async () => {
    const f = fixture();
    const response = await f.request();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(dto);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(f.dependencies.checkout).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: ids.actor, clinicId: null }),
      ids.assignment,
    );
  });
  it.each(["bad", ids.assignment.toUpperCase(), `${ids.assignment}%20`])(
    "invalid route UUID %s is 400 without reads",
    async (id) => {
      const f = fixture();
      expect((await f.request(id)).status).toBe(400);
      expect(f.dependencies.checkout).not.toHaveBeenCalled();
    },
  );
  it.each(["?amountPaise=1", "?ownerId=foreign", "?paid=true", "?keyId=rzp_test_injected", "?x="])(
    "rejects query injection %s",
    async (query) => {
      const f = fixture();
      expect((await f.query(query)).status).toBe(400);
      expect(f.dependencies.checkout).not.toHaveBeenCalled();
    },
  );
  it("unauthenticated receives 401 without metadata read", async () => {
    const f = fixture();
    vi.mocked(f.dependencies.verifySession).mockResolvedValue({ status: "unauthenticated" });
    expect((await f.request()).status).toBe(401);
    expect(f.dependencies.checkout).not.toHaveBeenCalled();
  });
  it("revoked authority receives 401 without metadata read", async () => {
    const f = fixture();
    f.customer.authority.sessionRevokedAt = new Date(now - 1).toISOString();
    expect((await f.request()).status).toBe(401);
    expect(f.dependencies.checkout).not.toHaveBeenCalled();
  });
  it.each([
    ["conflict", 409],
    ["denied", 403],
    ["unconfigured", 503],
  ] as const)("maps %s without leaking internal details", async (code, status) => {
    const f = fixture();
    vi.mocked(f.dependencies.checkout).mockRejectedValue(new PaymentError(code));
    const response = await f.request();
    expect(response.status).toBe(status);
    expect(JSON.stringify(await response.json())).not.toContain("acc_");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("does not expose a malformed trusted DTO as success", async () => {
    const f = fixture();
    vi.mocked(f.dependencies.checkout).mockResolvedValue({ ...dto, keyId: "rzp_live_forbidden" });
    expect((await f.request()).status).toBe(503);
  });
});
