import { createServer } from "node:http";
import { expect, test } from "@playwright/test";
import {
  createNativeCustomerRuntime,
  nativeCustomerApiTransport,
} from "../../apps/mobile/src/customer/runtime";
import {
  directory,
  nativeCustomerCart,
  nativeCustomerCatalogue,
  nativeCustomerClinicDirectory,
  nativeCustomerMetadata,
  nativeCustomerOffers,
  nativeCustomerOrders,
  nativeCustomerPayment,
  nativeCustomerSession,
  offer,
  selection,
} from "../fixtures/native-customer";

test("native runtime uses actual loopback HTTP metadata/offers/catalogue/orders and fences revoked authority", async () => {
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
  let opened = 0;
  const requests: { url: string; authorization: string | undefined; cookie: string | undefined }[] =
    [];
  let deny = false;
  const server = createServer((request, response) => {
    const url = request.url ?? "";
    requests.push({
      url,
      authorization: request.headers.authorization,
      cookie: request.headers.cookie,
    });
    response.writeHead(deny ? 403 : 200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(
      JSON.stringify(
        deny
          ? { error: { code: "FORBIDDEN" } }
          : url === `/v1/payments/${payment.intentId}/checkout`
            ? metadata
            : url === `/v1/payments/${payment.intentId}`
              ? { ...payment, state: "captured" }
              : url.startsWith("/v1/booking-offers?")
                ? nativeCustomerOffers
                : url === "/v1/booking-metadata"
                  ? nativeCustomerMetadata
                  : url === "/v1/doctors"
                    ? { doctors: directory.doctors }
                    : url === "/v1/commerce/clinics"
                      ? nativeCustomerClinicDirectory
                      : url.startsWith("/v1/catalogue")
                        ? nativeCustomerCatalogue
                        : nativeCustomerOrders,
      ),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  let revocations = 0;
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw Error("Synthetic fixture unavailable");
    const origin = `http://127.0.0.1:${address.port}`;
    const runtime = createNativeCustomerRuntime({
      origin,
      local: true,
      locale: "en",
      session: nativeCustomerSession,
      active: () => true,
      transport: nativeCustomerApiTransport(
        origin,
        true,
        async () => "synthetic_native_bearer_12345",
        () => true,
      ),
      uuid: () => crypto.randomUUID(),
      openCheckout: async (input, current) => {
        expect(current()).toBe(true);
        expect(requests.at(-1)?.url).toBe(`/v1/payments/${payment.intentId}/checkout`);
        expect(input).toEqual({
          key: metadata.keyId,
          order_id: metadata.providerOrderId,
          amount: metadata.amountPaise,
          currency: "INR",
        });
        opened++;
        return { forgedSdkStatus: "paid" }; // ignored; only the next HTTP read is authoritative
      },
      onRevoked: () => {
        revocations++;
      },
    });
    const signal = () => new AbortController().signal;
    expect(opened).toBe(0);
    expect(runtime.hardware).toBeDefined();
    const paid = await runtime.hardware?.launch(payment, signal(), runtime.active, () => {});
    expect(paid).toEqual({ status: "ready", data: { ...payment, state: "captured" } });
    expect(opened).toBe(1);
    expect(requests.at(-1)?.url).toBe(`/v1/payments/${payment.intentId}`);
    expect(await runtime.loadLocations(signal())).toEqual({
      status: "ready",
      data: [
        { reference: nativeCustomerCart.locationId, title: "Synthetic approved commerce location" },
      ],
    });
    expect((await runtime.commerceApi.catalogue(signal())).status).toBe("ready");
    expect(await runtime.api.directory(signal())).toEqual({
      status: "ready",
      data: { ...directory, scopes: nativeCustomerMetadata.scopes },
    });
    expect(await runtime.api.slots(selection, signal())).toEqual({
      status: "ready",
      data: { serverNow: nativeCustomerMetadata.serverNow, offers: [offer], truncated: false },
    });
    expect(await runtime.commerce.load({ section: "catalogue" }, signal())).toMatchObject({
      status: "ready",
    });
    expect(await runtime.commerce.load({ section: "orders" }, signal())).toMatchObject({
      status: "ready",
    });
    const beforeCart = requests.length;
    expect(await runtime.commerce.load({ section: "cart" }, signal())).toEqual({
      status: "unavailable",
    });
    expect(requests).toHaveLength(beforeCart);
    expect(
      requests.every(
        (request) =>
          request.authorization === "Bearer synthetic_native_bearer_12345" &&
          request.cookie === undefined,
      ),
    ).toBe(true);
    const offersRequest = requests.find((request) => request.url.startsWith("/v1/booking-offers?"));
    expect(new URL(`${origin}${offersRequest?.url}`).searchParams.get("from")).toBe(
      nativeCustomerMetadata.serverNow,
    );
    deny = true;
    expect(await runtime.commerce.load({ section: "orders" }, signal())).toEqual({
      status: "denied",
    });
    expect(revocations).toBe(1);
    const afterDenied = requests.length;
    expect(await runtime.api.directory(signal())).toEqual({ status: "denied" });
    expect(await runtime.commerceApi.quote(nativeCustomerCart, signal())).toEqual({
      status: "denied",
    });
    expect(requests).toHaveLength(afterDenied);
    runtime.dispose();
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
