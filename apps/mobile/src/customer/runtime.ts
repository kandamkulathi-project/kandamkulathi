import { apiOrigin } from "@kandamkulathi/client";
import { nativeApiTransport } from "@kandamkulathi/client/knowledge";
import type { ClientSession } from "@kandamkulathi/contracts/client";
import { formatMoney, type Locale } from "@kandamkulathi/i18n";
import { bookingOffersQuerySchema } from "../../../../packages/contracts/src/booking-offers";
import { commercePageSchema } from "../../../../packages/contracts/src/commerce-access";
import { commerceCataloguePageSchema } from "../../../../packages/contracts/src/commerce-catalogue";
import { commerceClinicsSchema } from "../../../../packages/contracts/src/commerce-clinics";
import { commerceOrderPageSchema } from "../../../../packages/contracts/src/commerce-orders";
import type { BookingCustomerApi } from "../../../workspaces/src/customer/booking/contracts";
import { createBookingRuntimeApi } from "../../../workspaces/src/customer/booking/runtimeAdapter";
import { createBookingRuntimeOptions } from "../../../workspaces/src/customer/booking/runtimeOptions";
import { createAuthoritativeCommerceApi } from "../../../workspaces/src/customer/commerce/authoritative-api";
import type { Reply } from "../../../workspaces/src/customer/commerce/contracts";
import { commercePresentationSchemas } from "../../../workspaces/src/customer/commerce/domainSchemas";
import { type NativeCommerceAdapter, nativeSessionAllowed } from "./commerce";
import type { CommerceLocation } from "./commerceController";
import {
  createNativeCommerceHardware,
  type NativeCommerceHardwareOptions,
} from "./commerceHardware";

/** Narrow read-only exception; the shared bearer adapter still validates origin/path first. */
export function nativeCustomerApiTransport(
  origin: string,
  local: boolean,
  read: () => Promise<string | null>,
  active: () => boolean,
  transport = fetch,
): typeof fetch {
  return nativeApiTransport(origin, local, read, active, transport, (url) => {
    if (!["/v1/booking-offers", "/v1/catalogue", "/v1/orders"].includes(url.pathname)) return false;
    const keys = [...url.searchParams.keys()];
    if (new Set(keys).size !== keys.length) return false;
    const query = Object.fromEntries(url.searchParams);
    if (url.pathname !== "/v1/booking-offers") return commercePageSchema.safeParse(query).success;
    return bookingOffersQuerySchema.safeParse({
      ...query,
      ...(query.limit === undefined ? {} : { limit: Number(query.limit) }),
    }).success;
  });
}

export type NativeCustomerRuntimeOptions = {
  origin: string;
  local: boolean;
  locale: Locale;
  session: ClientSession;
  /** Existing approved-origin native bearer adapter; never a browser cookie/CSRF shim. */
  transport: typeof fetch;
  active(): boolean;
  onRevoked(): void;
  /** Existing Expo Crypto binding on-device, not assumed global Web Crypto support. */
  uuid(): string;
  /** Same existing lifetime-scoped native SDK instance; never create a second checkout lock. */
  openCheckout?: NativeCommerceHardwareOptions["open"];
};

/** Real read-boundary composition for the existing native presentation, not full native checkout. */
export function createNativeCustomerRuntime(options: NativeCustomerRuntimeOptions) {
  const origin = apiOrigin(options.origin, options.local);
  let disposed = false;
  let revoked: "anonymous" | "denied" = "anonymous";
  const pending = new Set<AbortController>();
  const current = () => !disposed && options.active() && nativeSessionAllowed(options.session);
  function dispose() {
    disposed = true;
    for (const controller of pending) controller.abort();
    pending.clear();
  }
  async function guard<T>(
    signal: AbortSignal,
    action: (signal: AbortSignal) => Promise<T>,
  ): Promise<T | { status: "anonymous" | "denied" | "error" }> {
    if (!current()) return { status: revoked };
    if (signal.aborted) return { status: "error" };
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    pending.add(controller);
    try {
      const result = await action(controller.signal);
      return !current()
        ? { status: revoked }
        : controller.signal.aborted
          ? { status: "error" }
          : result;
    } catch {
      return { status: current() ? "error" : revoked };
    } finally {
      signal.removeEventListener("abort", abort);
      pending.delete(controller);
    }
  }
  const transport: typeof fetch = async (input, init) => {
    if (!current() || init?.signal?.aborted) throw Error("Inactive customer lifetime");
    const response = await options.transport(input, { ...init, credentials: "omit" });
    if (!current() || init?.signal?.aborted) throw Error("Inactive customer lifetime");
    if (response.status === 401 || response.status === 403) {
      revoked = response.status === 403 ? "denied" : "anonymous";
      dispose();
      options.onRevoked();
    }
    return response;
  };
  const booking = createBookingRuntimeApi({
    ...createBookingRuntimeOptions({ origin, local: options.local, transport }),
    createOperationIds: () => ({ operationId: options.uuid(), bookingId: options.uuid() }),
  });
  const api: BookingCustomerApi = {
    directory: (signal) => guard(signal, (active) => booking.directory(active)),
    slots: (input, signal) => guard(signal, (active) => booking.slots(input, active)),
    appointments: (signal) => guard(signal, (active) => booking.appointments(active)),
    hold: (input, signal) => guard(signal, (active) => booking.hold(input, active)),
    read: (input, signal) => guard(signal, (active) => booking.read(input, active)),
  };
  const commands = createAuthoritativeCommerceApi(
    {
      origin,
      fetch: transport,
      credentials: "omit",
      async authorizeMutation(signal) {
        if (!current() || signal.aborted) throw Error("Inactive customer lifetime");
        // Actual native bearer verification is server-owned. No fabricated cookie/CSRF headers.
        return {};
      },
    },
    commercePresentationSchemas,
  );
  const commerceApi: typeof commands = {
    ...commands,
    catalogue: (signal, after) => guard(signal, (active) => commands.catalogue(active, after)),
    product: (id, signal) => guard(signal, (active) => commands.product(id, active)),
    orders: (signal, after) => guard(signal, (active) => commands.orders(active, after)),
    order: (id, signal) => guard(signal, (active) => commands.order(id, active)),
    quote: (input, signal) => guard(signal, (active) => commands.quote(input, active)),
    checkout: (input, signal) => guard(signal, (active) => commands.checkout(input, active)),
    createPayment: (id, input, signal) =>
      guard(signal, (active) => commands.createPayment(id, input, active)),
    readPayment: (expected, signal) =>
      guard(signal, (active) => commands.readPayment(expected, active)),
    reconcilePayment: (expected, signal) =>
      guard(signal, (active) => commands.reconcilePayment(expected, active)),
    checkoutMetadata: (expected, signal) =>
      guard(signal, (active) => commands.checkoutMetadata(expected, active)),
  };
  const hardware = options.openCheckout
    ? createNativeCommerceHardware({ api: commerceApi, open: options.openCheckout })
    : undefined;
  const loadLocations = (signal: AbortSignal): Promise<Reply<CommerceLocation[]>> =>
    guard(signal, async (active) => {
      const response = await transport(`${origin}/v1/commerce/clinics`, {
        method: "GET",
        signal: active,
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        headers: { Accept: "application/json" },
      });
      if (response.status === 401) return { status: "anonymous" };
      if (response.status === 403 || response.status === 404) return { status: "denied" };
      if (response.status === 503) return { status: "unavailable" };
      if (
        response.status !== 200 ||
        response.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase() !==
          "application/json"
      )
        return { status: "error" };
      const body = await response.text();
      if (body.length > 2 * 1024 * 1024) return { status: "error" };
      const directory = commerceClinicsSchema.parse(JSON.parse(body));
      const locations = directory.items.map((item) => ({
        reference: item.locationId,
        title: item.name,
      }));
      if (new Set(locations.map((location) => location.reference)).size !== locations.length)
        return { status: "error" };
      return { status: "ready", data: locations };
    });
  const commerce: NativeCommerceAdapter = {
    load: ({ section }, signal) =>
      guard(signal, async (active) => {
        // No persisted-cart read contract exists. Do not display an empty/successful fake cart.
        if (section === "cart") return { status: "unavailable" };
        if (section !== "catalogue" && section !== "orders") return { status: "error" };
        const response = await transport(`${origin}/v1/${section}`, {
          method: "GET",
          signal: active,
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          headers: { Accept: "application/json" },
        });
        if (response.status === 401) return { status: "anonymous" };
        if (response.status === 403 || response.status === 404) return { status: "denied" };
        if (response.status === 503) return { status: "unavailable" };
        if (
          response.status !== 200 ||
          response.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase() !==
            "application/json"
        )
          return { status: "error" };
        const body = await response.text();
        if (body.length > 2 * 1024 * 1024) return { status: "error" };
        const raw: unknown = JSON.parse(body);
        const rows =
          section === "catalogue"
            ? commerceCataloguePageSchema.parse(raw).items.map((product) => ({
                id: product.skuId,
                title: product.name,
                detail: `${product.variant} · ${formatMoney(product.unitPaise, options.locale)} · ${product.stockStatus}`,
              }))
            : commerceOrderPageSchema.parse(raw).items.map((order) => ({
                id: order.orderId,
                title: order.orderId,
                detail: `${order.status} · ${formatMoney(order.amountPaise, options.locale)}`,
              }));
        return { status: "ready", data: { section, rows } };
      }),
  };
  return { api, commerce, commerceApi, hardware, loadLocations, active: current, dispose };
}
