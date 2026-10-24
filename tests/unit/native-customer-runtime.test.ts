import { describe, expect, it, vi } from "vitest";
import {
  createNativeCustomerRuntime,
  nativeCustomerApiTransport,
} from "../../apps/mobile/src/customer/runtime";
import type { ClientSession } from "../../packages/contracts/src/client";
import type { TestFetch } from "../fixtures/fetch";
import {
  directory,
  nativeCustomerCart,
  nativeCustomerCatalogue,
  nativeCustomerClinicDirectory,
  nativeCustomerMetadata,
  nativeCustomerOffers,
  nativeCustomerOrders,
  nativeCustomerPayment,
  nativeCustomerQuote,
  nativeCustomerReservation,
  nativeCustomerSession,
  offer,
  selection,
} from "../fixtures/native-customer";
import { booking } from "./customer-booking-fixtures";

const signal = () => new AbortController().signal;
function setup(fetcher: TestFetch, session: ClientSession = nativeCustomerSession) {
  let active = true;
  const revoked = vi.fn();
  const runtime = createNativeCustomerRuntime({
    origin: "https://api.example.com",
    local: false,
    locale: "en",
    session,
    transport: nativeCustomerApiTransport(
      "https://api.example.com",
      false,
      async () => "synthetic_native_bearer_12345",
      () => active,
      fetcher,
    ),
    active: () => active,
    onRevoked: revoked,
    uuid: () => crypto.randomUUID(),
  });
  return {
    runtime,
    revoked,
    background: () => {
      active = false;
    },
  };
}
describe("native customer runtime composition", () => {
  it("reads exact ready-intent SDK metadata through the bearer transport and fences it after disposal", async () => {
    const payment = {
      ...nativeCustomerPayment,
      state: "ready" as const,
      providerOrderId: "order_synthetic123",
    };
    const metadata = {
      keyId: "rzp_test_synthetic123",
      providerOrderId: payment.providerOrderId,
      intentId: payment.intentId,
      operationId: payment.operationId,
      subject: payment.subject,
      amountPaise: payment.amountPaise,
      currency: payment.currency,
    };
    const fetcher = vi.fn<TestFetch>(async (input, init) => {
      expect(String(input)).toBe(
        `https://api.example.com/v1/payments/${payment.intentId}/checkout`,
      );
      expect(init?.method).toBe("GET");
      expect(init?.credentials).toBe("omit");
      expect(init?.body).toBeUndefined();
      expect(new Headers(init?.headers).get("Authorization")).toBe(
        "Bearer synthetic_native_bearer_12345",
      );
      return Response.json(metadata);
    });
    const { runtime } = setup(fetcher);
    expect(await runtime.commerceApi.checkoutMetadata(payment, signal())).toEqual({
      status: "ready",
      data: metadata,
    });
    runtime.dispose();
    expect(await runtime.commerceApi.checkoutMetadata(payment, signal())).toEqual({
      status: "anonymous",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("uses the real approved directory locationId, never substitutes its different clinicId", async () => {
    const fetcher = vi.fn<TestFetch>(async (input) => {
      expect(String(input)).toBe("https://api.example.com/v1/commerce/clinics");
      return Response.json(nativeCustomerClinicDirectory);
    });
    const { runtime } = setup(fetcher);
    expect(await runtime.loadLocations(signal())).toEqual({
      status: "ready",
      data: [
        { reference: nativeCustomerCart.locationId, title: "Synthetic approved commerce location" },
      ],
    });
    expect(nativeCustomerClinicDirectory.items[0]?.clinicId).not.toBe(
      nativeCustomerCart.locationId,
    );
  });
  it("keeps unavailable/empty directories truthful and refuses unknown or ambiguous native location rows", async () => {
    const empty = setup(async () => Response.json({ items: [] })).runtime;
    expect(await empty.loadLocations(signal())).toEqual({ status: "ready", data: [] });
    const unavailable = setup(async () => Response.json({}, { status: 503 })).runtime;
    expect(await unavailable.loadLocations(signal())).toEqual({ status: "unavailable" });
    for (const data of [
      { ...nativeCustomerClinicDirectory, fabricatedDefault: true },
      { items: [...nativeCustomerClinicDirectory.items, ...nativeCustomerClinicDirectory.items] },
    ]) {
      expect(await setup(async () => Response.json(data)).runtime.loadLocations(signal())).toEqual({
        status: "error",
      });
    }
  });
  it("composes canonical cart/quote/checkout/payment APIs with bearer-only mutation and same-intent reconciliation", async () => {
    const fetcher = vi.fn<TestFetch>(async (url, init) => {
      expect(init?.credentials).toBe("omit");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer synthetic_native_bearer_12345");
      expect(headers.has("X-CSRF-Token")).toBe(false);
      expect(headers.has("Cookie")).toBe(false);
      const path = new URL(String(url)).pathname;
      return Response.json(
        path === "/v1/cart/quote"
          ? nativeCustomerQuote
          : path === "/v1/checkout"
            ? nativeCustomerReservation
            : path === "/v1/catalogue"
              ? nativeCustomerCatalogue
              : nativeCustomerPayment,
      );
    });
    const { runtime } = setup(fetcher);
    expect((await runtime.commerceApi.catalogue(signal())).status).toBe("ready");
    expect(await runtime.commerceApi.quote(nativeCustomerCart, signal())).toMatchObject({
      status: "ready",
      data: nativeCustomerQuote,
    });
    const input = {
      ...nativeCustomerCart,
      operationId: nativeCustomerSession.userId,
      deliveryAddress: {
        recipientName: "Synthetic customer",
        line1: "1 Synthetic Street",
        city: "Synthetic City",
        region: "Kerala",
        postalCode: "680001",
        country: "IN",
        contactPhone: "+919999999999",
      },
      confirmed: true,
      quoteKey: nativeCustomerQuote.quoteKey,
      versions: { [nativeCustomerSession.userId]: 1 },
    };
    expect(await runtime.commerceApi.checkout(input, signal())).toEqual({
      status: "ready",
      data: nativeCustomerReservation,
    });
    expect(
      await runtime.commerceApi.createPayment(
        nativeCustomerSession.userId,
        {
          operationId: nativeCustomerPayment.operationId,
          subject: nativeCustomerPayment.subject,
          method: "razorpay",
        },
        signal(),
      ),
    ).toEqual({ status: "ready", data: nativeCustomerPayment });
    expect(await runtime.commerceApi.readPayment(nativeCustomerPayment, signal())).toEqual({
      status: "ready",
      data: nativeCustomerPayment,
    });
    expect(await runtime.commerceApi.reconcilePayment(nativeCustomerPayment, signal())).toEqual({
      status: "ready",
      data: nativeCustomerPayment,
    });
    const paymentUrls = fetcher.mock.calls.slice(-2).map(([url]) => new URL(String(url)).pathname);
    expect(paymentUrls).toEqual([
      `/v1/payments/${nativeCustomerPayment.intentId}`,
      `/v1/payments/${nativeCustomerPayment.intentId}/reconcile`,
    ]);
    expect(fetcher.mock.calls.at(-1)?.[1]?.body).toBe("{}");
    const count = fetcher.mock.calls.length;
    runtime.dispose();
    expect(await runtime.commerceApi.checkout(input, signal())).toEqual({ status: "anonymous" });
    expect(fetcher).toHaveBeenCalledTimes(count);
  });
  it("loads canonical catalogue and owner-filtered orders with the native bearer and never presents reconciliation as paid", async () => {
    const fetcher = vi.fn<TestFetch>(async (url, init) => {
      expect(init).toMatchObject({
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
      });
      expect(new Headers(init?.headers).get("Authorization")).toBe(
        "Bearer synthetic_native_bearer_12345",
      );
      return Response.json(
        String(url).endsWith("catalogue") ? nativeCustomerCatalogue : nativeCustomerOrders,
      );
    });
    const { runtime } = setup(fetcher);
    expect(await runtime.commerce.load({ section: "catalogue" }, signal())).toMatchObject({
      status: "ready",
      data: {
        section: "catalogue",
        rows: [{ id: nativeCustomerSession.userId, title: "Synthetic product" }],
      },
    });
    expect(await runtime.commerce.load({ section: "orders" }, signal())).toMatchObject({
      status: "ready",
      data: {
        section: "orders",
        rows: [{ detail: expect.stringContaining("reconciliation_required") }],
      },
    });
    expect(await runtime.commerce.load({ section: "cart" }, signal())).toEqual({
      status: "unavailable",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("binds real metadata and doctor contracts instead of fabricated labels or client availability", async () => {
    const { runtime } = setup(async (url) =>
      Response.json(
        String(url).endsWith("booking-metadata")
          ? nativeCustomerMetadata
          : { doctors: directory.doctors },
      ),
    );
    expect(await runtime.api.directory(signal())).toEqual({
      status: "ready",
      data: { ...directory, scopes: nativeCustomerMetadata.scopes },
    });
  });
  it("uses the shared concrete offers builder and trusted database clock with the native query exception", async () => {
    const fetcher = vi.fn<TestFetch>(async (url) =>
      Response.json(
        String(url).includes("booking-offers?") ? nativeCustomerOffers : nativeCustomerMetadata,
      ),
    );
    const { runtime } = setup(fetcher);
    expect(await runtime.api.slots(selection, signal())).toEqual({
      status: "ready",
      data: { serverNow: nativeCustomerMetadata.serverNow, offers: [offer], truncated: false },
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const url = new URL(String(fetcher.mock.calls[1]?.[0]));
    expect(url.pathname).toBe("/v1/booking-offers");
    expect(url.searchParams.get("from")).toBe(nativeCustomerMetadata.serverNow);
  });
  it("keeps the same Expo-supplied hold identifiers after a lost acknowledgement and fetches a fresh DB clock", async () => {
    const bodies: string[] = [];
    const { runtime } = setup(async (url, init) => {
      if (String(url).endsWith("booking-metadata")) return Response.json(nativeCustomerMetadata);
      bodies.push(String(init?.body));
      if (bodies.length === 1) throw Error("Synthetic lost acknowledgement");
      const input: { bookingId: string } = JSON.parse(String(init?.body));
      return Response.json({ booking: { ...booking, id: input.bookingId }, persisted: true });
    });
    const input = {
      ownerId: nativeCustomerSession.userId,
      doctorId: selection.doctorId,
      clinicId: selection.clinicId,
      availabilityId: offer.slot.availabilityId,
      expectedAvailabilityRevision: 1,
      modality: "online" as const,
      start: offer.slot.interval.start,
    };
    expect(await runtime.api.hold(input, signal())).toEqual({ status: "error" });
    expect(await runtime.api.hold(input, signal())).toMatchObject({
      status: "ready",
      data: { serverNow: nativeCustomerMetadata.serverNow },
    });
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toBe(bodies[1]);
    expect(JSON.parse(bodies[0] ?? "{}").request).not.toHaveProperty("fee");
  });
  it.each([401, 403, 503])(
    "preserves unavailable/revoked boundary %s, invalidates private lifetime only for revoked authority",
    async (status) => {
      const fetcher = vi.fn<TestFetch>(async () => Response.json({}, { status }));
      const { runtime, revoked } = setup(fetcher);
      expect(await runtime.commerce.load({ section: "orders" }, signal())).toEqual({
        status: status === 503 ? "unavailable" : status === 403 ? "denied" : "anonymous",
      });
      expect(revoked).toHaveBeenCalledTimes(status === 503 ? 0 : 1);
      if (status !== 503) {
        expect(await runtime.commerce.load({ section: "orders" }, signal())).toEqual({
          status: status === 403 ? "denied" : "anonymous",
        });
        expect(fetcher).toHaveBeenCalledTimes(1);
      }
    },
  );
  it("rejects malformed/cross-envelope catalogue and orders, including unknown clinical/owner fields", async () => {
    for (const body of [
      { ...nativeCustomerCatalogue, ownerId: nativeCustomerSession.userId },
      {
        ...nativeCustomerCatalogue,
        items: [{ ...nativeCustomerCatalogue.items[0], unitPaise: -1 }],
      },
      nativeCustomerOrders,
    ]) {
      const { runtime } = setup(async () => Response.json(body));
      expect(await runtime.commerce.load({ section: "catalogue" }, signal())).toEqual({
        status: "error",
      });
    }
  });
  it("aborts in-flight requests and fences late successful reads across background/disposal", async () => {
    let release: (response: Response) => void = () => {};
    const fetcher = vi.fn<TestFetch>(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const { runtime, background } = setup(fetcher);
    const result = runtime.commerce.load({ section: "orders" }, signal());
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    background();
    runtime.dispose();
    expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    release(Response.json(nativeCustomerOrders));
    expect(await result).toEqual({ status: "anonymous" });
    expect(await runtime.api.directory(signal())).toEqual({ status: "anonymous" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not call transport for an expired/non-customer session or already-aborted request", async () => {
    const fetcher = vi.fn<TestFetch>();
    const { runtime } = setup(fetcher);
    const controller = new AbortController();
    controller.abort();
    expect(await runtime.commerce.load({ section: "orders" }, controller.signal)).toEqual({
      status: "error",
    });
    expect(fetcher).not.toHaveBeenCalled();
    for (const session of [
      { ...nativeCustomerSession, expiresAt: "2020-01-01T00:00:00Z" },
      { ...nativeCustomerSession, workspaces: ["physician" as const] },
    ]) {
      const { runtime: invalid } = setup(fetcher, session);
      expect(await invalid.commerce.load({ section: "orders" }, signal())).toEqual({
        status: "anonymous",
      });
      expect(await invalid.api.directory(signal())).toEqual({ status: "anonymous" });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});
