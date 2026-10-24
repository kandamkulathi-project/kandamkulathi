import { describe, expect, it, vi } from "vitest";
import {
  type CommerceDependencies,
  type CommerceOperations,
  registerCommerceRoutes,
} from "../../apps/core-api/src/commerce";
import { CommerceError } from "../../packages/contracts/src/commerce-catalogue";
import { createService } from "../../packages/server/src/index";
import {
  after,
  before,
  customerFixture,
  ids,
  now,
  physicianAuthority,
  physicianIdentity,
} from "../unit/identity-fixtures";

const order = {
  orderId: ids.other,
  locationId: ids.clinic,
  amountPaise: 12345,
  currency: "INR",
  status: "reserved",
  version: 1,
  source: "web",
  createdAt: before,
  expiresAt: after,
};
const cart = { locationId: ids.clinic, lines: [{ skuId: ids.other, quantity: 1 }] };
const deliveryAddress = {
  recipientName: "Synthetic Customer",
  line1: "1 Synthetic Street",
  city: "Test City",
  region: "Test Region",
  postalCode: "680001",
  country: "IN",
  contactPhone: "+919876543210",
};
const checkout = {
  ...cart,
  deliveryAddress,
  operationId: ids.assignment,
  confirmed: true,
  quoteKey: "server-quote",
  versions: { [ids.other]: 1 },
};
const payment = {
  intentId: ids.assignment,
  operationId: ids.other,
  subject: { kind: "order", id: ids.other },
  amountPaise: 12345,
  currency: "INR",
  state: "unknown",
  providerOrderId: null,
};

/** HTTP wiring fixtures only. Actual money/stock/RLS guarantees are exercised against PostgreSQL separately. */
function fixture(staff = false) {
  const customer = customerFixture();
  const identity = staff ? physicianIdentity() : customer.identity;
  const authority = staff ? physicianAuthority() : customer.authority;
  if (staff)
    authority.memberships = authority.memberships.map((entry) => ({
      ...entry,
      workspace: "staff",
    }));
  const unavailable = async (): Promise<never> => {
    throw new CommerceError("unavailable");
  };
  const operations: CommerceOperations = {
    clinics: vi.fn(unavailable),
    staffClinics: vi.fn(async () => ({
      items: [
        {
          clinicId: ids.clinic,
          locationId: ids.patient,
          name: "Synthetic approved clinic",
          actions: ["orders:read"],
        },
      ],
    })),
    catalogue: vi.fn(unavailable),
    product: vi.fn(async () => null),
    quote: vi.fn(unavailable),
    checkout: vi.fn(async () => ({
      orderId: ids.other,
      amountPaise: 12345,
      currency: "INR",
      status: "reserved",
      expiresAt: after,
    })),
    orders: vi.fn(async () => ({ items: [order], nextCursor: null })),
    order: vi.fn(async () => null),
    batches: vi.fn(async () => ({ items: [], nextCursor: null })),
    importOpening: vi.fn(unavailable),
    createPayment: vi.fn(async () => payment),
    payment: vi.fn(async () => payment),
    reconcilePayment: vi.fn(async () => payment),
    refund: vi.fn(unavailable),
    webhook: vi.fn(async () => "applied" as const),
  };
  const dependencies: CommerceDependencies = {
    verifySession: vi.fn(async () => ({ status: "verified" as const, identity })),
    loadCurrentAuthority: vi.fn(async () => authority),
    loadCommerceGrants: vi.fn(async () => [
      {
        id: ids.other,
        actorId: ids.actor,
        membershipId: ids.membership,
        clinicId: ids.clinic,
        action: "orders:read",
        validFrom: before,
        expiresAt: after,
        revokedAt: null,
      },
    ]),
    verifyMutationRequest: vi.fn(async () => "allowed" as const),
    now: () => now,
    run: vi.fn(async (_principal, callback) => callback(operations)),
  };
  const app = createService("core-api", () => {}, {
    registerRoutes: (service) => registerCommerceRoutes(service, dependencies),
  });
  const request = (path: string, init?: RequestInit) =>
    app.fetch(new Request(`http://localhost${path}`, init), { APP_ENV: "local" });
  const post = (path: string, value: unknown) =>
    request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
  return { app, request, post, dependencies, operations, authority };
}

async function denial(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  const body = await response.json();
  expect(body).toMatchObject({ error: { code, requestId: response.headers.get("X-Request-ID") } });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(JSON.stringify(body)).not.toMatch(/diagnostic|secret|SELECT|stack/);
}

describe("commerce HTTP authorization and strict contract boundary", () => {
  it("default composition is unavailable, not a successful empty catalogue or anonymous checkout", async () => {
    const app = createService("core-api", () => {}, { registerRoutes: registerCommerceRoutes });
    for (const [path, code] of [
      ["/v1/catalogue", "COMMERCE_UNAVAILABLE"],
      ["/v1/orders", "IDENTITY_UNAVAILABLE"],
    ]) {
      const response = await app.fetch(new Request(`http://localhost${path}`), {
        APP_ENV: "local",
      });
      await denial(response, 503, code ?? "");
    }
  });
  it("public browsing does not require identity or clinical intake", async () => {
    const { request, dependencies, operations } = fixture();
    await denial(await request("/v1/catalogue"), 503, "COMMERCE_UNAVAILABLE");
    expect(dependencies.verifySession).not.toHaveBeenCalled();
    expect(operations.catalogue).toHaveBeenCalledWith({ limit: 25 });
  });
  it("clinic directory is public but unavailable until approved names exist, never an invented empty success", async () => {
    const { request, dependencies, operations } = fixture();
    await denial(await request("/v1/commerce/clinics"), 503, "COMMERCE_UNAVAILABLE");
    expect(dependencies.verifySession).not.toHaveBeenCalled();
    vi.mocked(operations.clinics).mockResolvedValue({
      items: [{ clinicId: ids.clinic, locationId: ids.patient, name: "Synthetic approved clinic" }],
    });
    expect(await (await request("/v1/commerce/clinics")).json()).toEqual({
      items: [{ clinicId: ids.clinic, locationId: ids.patient, name: "Synthetic approved clinic" }],
    });
    await denial(await request("/v1/commerce/clinics?clinicId=forged"), 400, "INVALID_INPUT");
  });
  it("staff directory requires current staff workspace and does not accept client clinic grants", async () => {
    const customer = fixture();
    await denial(await customer.request("/v1/staff/commerce/clinics"), 403, "FORBIDDEN");
    expect(customer.operations.staffClinics).not.toHaveBeenCalled();
    const staff = fixture(true);
    expect((await staff.request("/v1/staff/commerce/clinics")).status).toBe(200);
    expect(staff.dependencies.run).toHaveBeenCalledWith(
      expect.objectContaining({ directory: true, clinicId: null, action: null }),
      expect.any(Function),
    );
    await denial(
      await staff.request("/v1/staff/commerce/clinics?actions=stock:read"),
      400,
      "INVALID_INPUT",
    );
    staff.authority.memberships = [];
    await denial(await staff.request("/v1/staff/commerce/clinics"), 403, "FORBIDDEN");
  });
  it.each([
    "limit=0",
    "limit=101",
    "limit=2.5",
    "after=other-owner",
    "ownerId=forged",
    "limit=NaN",
  ])("rejects invalid/unbounded/unrecognized page %s", async (query) => {
    const { request, operations } = fixture();
    await denial(await request(`/v1/orders?${query}`), 400, "INVALID_INPUT");
    expect(operations.orders).not.toHaveBeenCalled();
  });
  it("owner history uses verified principal, not request actor/role headers", async () => {
    const { request, dependencies } = fixture();
    const response = await request("/v1/orders?limit=2", {
      headers: { "X-Actor-ID": ids.patientActor, "X-Role": "admin" },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [order], nextCursor: null });
    expect(dependencies.run).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: ids.actor, clinicId: null }),
      expect.any(Function),
    );
  });
  it("cross-owner/absent detail uses the same not-found response", async () => {
    const { request } = fixture();
    await denial(await request(`/v1/orders/${ids.other}`), 404, "NOT_FOUND");
  });
  it("requires explicit current clinic/action grant for staff, not customer or physician access", async () => {
    const customer = fixture();
    await denial(
      await customer.request(`/v1/staff/clinics/${ids.clinic}/orders`),
      403,
      "FORBIDDEN",
    );
    expect(customer.operations.orders).not.toHaveBeenCalled();
    const staff = fixture(true);
    expect((await staff.request(`/v1/staff/clinics/${ids.clinic}/orders`)).status).toBe(200);
    expect(staff.operations.orders).toHaveBeenCalledWith({ limit: 25 }, ids.clinic);
    await denial(await staff.request(`/v1/staff/clinics/${ids.other}/orders`), 403, "FORBIDDEN");
    await denial(await staff.request(`/v1/staff/clinics/${ids.clinic}/batches`), 403, "FORBIDDEN");
  });
  it("rechecks revocation on each call and never falls back to a successful history", async () => {
    const { request, authority, operations } = fixture();
    expect((await request("/v1/orders")).status).toBe(200);
    authority.sessionRevokedAt = before;
    await denial(await request("/v1/orders"), 401, "UNAUTHENTICATED");
    expect(operations.orders).toHaveBeenCalledOnce();
  });
  it.each(["denied", "unavailable"] as const)(
    "mutation transport %s prevents checkout/provider work",
    async (decision) => {
      const { post, dependencies, operations } = fixture();
      dependencies.verifyMutationRequest = async () => decision;
      await denial(
        await post("/v1/checkout", checkout),
        decision === "denied" ? 403 : 503,
        decision === "denied" ? "FORBIDDEN" : "IDENTITY_UNAVAILABLE",
      );
      expect(operations.checkout).not.toHaveBeenCalled();
    },
  );
  it.each([
    { amountPaise: 1 },
    { ownerId: ids.patientActor },
    { source: "phone" },
    { paid: true },
    { method: "COD" },
  ])("rejects client authoritative checkout overrides %j", async (override) => {
    const { post, operations } = fixture();
    await denial(await post("/v1/checkout", { ...checkout, ...override }), 400, "INVALID_INPUT");
    expect(operations.checkout).not.toHaveBeenCalled();
  });
  it("returns only the persisted reserved state, not a paid browser confirmation", async () => {
    const { post, operations } = fixture();
    const response = await post("/v1/checkout", checkout);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      orderId: ids.other,
      amountPaise: 12345,
      currency: "INR",
      status: "reserved",
      expiresAt: after,
    });
    expect(operations.checkout).toHaveBeenCalledWith(checkout);
  });
  it.each([
    undefined,
    {},
    { ...deliveryAddress, postalCode: "000001" },
    { ...deliveryAddress, country: "US" },
    { ...deliveryAddress, contactPhone: "phone" },
    { ...deliveryAddress, recipientName: " " },
  ])("requires structurally valid delivery collection before reserving %j", async (address) => {
    const { post, operations } = fixture();
    await denial(
      await post("/v1/checkout", { ...checkout, deliveryAddress: address }),
      400,
      "INVALID_INPUT",
    );
    expect(operations.checkout).not.toHaveBeenCalled();
  });
  it.each(["stale_version", "stock_shortage", "operation_conflict"] as const)(
    "preserves actionable %s conflict",
    async (code) => {
      const { post, operations } = fixture();
      operations.checkout = async () => {
        throw new CommerceError(code);
      };
      await denial(await post("/v1/checkout", checkout), 409, code.toUpperCase());
    },
  );
  it("rejects invalid JSON/content type without calling business operations", async () => {
    const { request, operations } = fixture();
    for (const init of [
      { headers: { "Content-Type": "application/json" }, body: "{" },
      { headers: { "Content-Type": "text/plain" }, body: JSON.stringify(checkout) },
    ])
      await denial(
        await request("/v1/checkout", { method: "POST", ...init }),
        400,
        "INVALID_INPUT",
      );
    expect(operations.checkout).not.toHaveBeenCalled();
  });
  it("payment unknown remains pending reconciliation, never paid", async () => {
    const { post, request, operations } = fixture();
    const input = {
      operationId: ids.other,
      subject: { kind: "order", id: ids.other },
      method: "razorpay",
    };
    const response = await post("/v1/payments", input);
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(payment);
    expect(operations.createPayment).toHaveBeenCalledWith(input);
    expect((await request(`/v1/payments/${ids.assignment}`)).status).toBe(200);
    await denial(
      await post(`/v1/orders/${ids.patient}/payment-intents`, input),
      400,
      "INVALID_INPUT",
    );
    await denial(await post("/v1/payments", { ...input, amountPaise: 1 }), 400, "INVALID_INPUT");
  });
  it("webhook passes untouched raw bytes, signature and event ID to verified provider service", async () => {
    const { request, dependencies, operations } = fixture();
    const payload = '{\n  "event": "payment.captured"\n}';
    const response = await request("/v1/payments/razorpay/webhook", {
      method: "POST",
      headers: { "X-Razorpay-Signature": "ab".repeat(32), "X-Razorpay-Event-Id": "evt_synthetic" },
      body: payload,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, disposition: "applied" });
    expect(operations.webhook).toHaveBeenCalledWith(
      new TextEncoder().encode(payload),
      "ab".repeat(32),
      "evt_synthetic",
    );
    expect(dependencies.verifySession).not.toHaveBeenCalled();
    expect(dependencies.verifyMutationRequest).not.toHaveBeenCalled();
  });
  it("explicit reconciliation reuses the owner intent and cannot accept a new amount or paid assertion", async () => {
    const { post, operations } = fixture();
    expect((await post(`/v1/payments/${ids.assignment}/reconcile`, {})).status).toBe(200);
    expect(operations.reconcilePayment).toHaveBeenCalledWith(ids.assignment);
    expect(operations.createPayment).not.toHaveBeenCalled();
    await denial(
      await post(`/v1/payments/${ids.assignment}/reconcile`, { paid: true, amountPaise: 1 }),
      400,
      "INVALID_INPUT",
    );
    expect(operations.reconcilePayment).toHaveBeenCalledOnce();
  });
  it("missing provider proof or browser-paid assertion cannot mark paid", async () => {
    const { post, operations } = fixture();
    await denial(
      await post("/v1/payments/razorpay/webhook", { paid: true }),
      400,
      "PAYMENT_VERIFICATION_FAILED",
    );
    expect(operations.webhook).not.toHaveBeenCalled();
  });
  it("sanitizes storage failures and malformed private response rather than exposing diagnostics", async () => {
    const { request, operations } = fixture();
    operations.orders = async () => {
      throw new Error("secret SELECT diagnostic");
    };
    await denial(await request("/v1/orders"), 503, "COMMERCE_UNAVAILABLE");
    operations.orders = async () => ({
      items: [order],
      nextCursor: null,
      privateDiagnostics: "secret",
    });
    await denial(await request("/v1/orders"), 503, "COMMERCE_UNAVAILABLE");
  });
});
