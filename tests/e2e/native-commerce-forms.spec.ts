import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import {
  NativeCommerceController,
  type NativeCommerceRecovery,
} from "../../apps/mobile/src/customer/commerceController";
import { createAuthoritativeCommerceApi } from "../../apps/workspaces/src/customer/commerce/authoritative-api";
import { commercePresentationSchemas } from "../../apps/workspaces/src/customer/commerce/domainSchemas";
import { type ClientSession, sessionSchema } from "../../packages/contracts/src/client";
import { nativeCustomerCatalogue, nativeCustomerSession } from "../fixtures/native-customer";

const locationId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const operationId = "33333333-3333-4333-8333-333333333333";
const paymentOperationId = "44444444-4444-4444-8444-444444444444";
const intentId = "55555555-5555-4555-8555-555555555555";
const firstProduct = nativeCustomerCatalogue.items[0];
if (!firstProduct) throw Error("Synthetic fixture is missing its product");
const skuId = firstProduct.skuId;
const quote = {
  lines: [
    {
      skuId,
      quantity: 1,
      version: 1,
      unitPaise: 15000,
      taxPaise: 750,
      amountPaise: 15750,
      taxPolicyId: locationId,
      rateBps: 500,
    },
  ],
  amountPaise: 15750,
  currency: "INR",
  quoteKey: "synthetic-authoritative-quote",
};
const reservation = {
  orderId,
  amountPaise: 15750,
  currency: "INR",
  status: "reserved",
  expiresAt: "2099-01-01T00:00:00Z",
};
const payment = {
  intentId,
  operationId: paymentOperationId,
  subject: { kind: "order", id: orderId },
  amountPaise: 15750,
  currency: "INR",
  state: "unknown",
  providerOrderId: null,
};
async function body(request: IncomingMessage): Promise<unknown> {
  let text = "";
  for await (const chunk of request) text += String(chunk);
  return text ? (JSON.parse(text) as unknown) : null;
}
test("native editable address/cart -> server quote -> explicit reserve -> same payment read/reconcile across uncertain HTTP", async () => {
  const calls: { path: string; method: string; payload: unknown }[] = [];
  let lostCheckout = true;
  let lostPayment = true;
  const server = createServer((request, response) => {
    void (async () => {
      expect(request.headers.authorization).toBe("Bearer synthetic-native-bearer");
      expect(request.headers.cookie).toBeUndefined();
      expect(request.headers["x-csrf-token"]).toBeUndefined();
      const path = request.url ?? "";
      const payload = await body(request);
      calls.push({ path, method: request.method ?? "", payload });
      if (path === "/v1/checkout" && lostCheckout) {
        lostCheckout = false;
        response.destroy();
        return;
      }
      if (path.endsWith("/payment-intents") && lostPayment) {
        lostPayment = false;
        response.destroy();
        return;
      }
      const value =
        path === "/v1/session"
          ? nativeCustomerSession
          : path.startsWith("/v1/catalogue")
            ? nativeCustomerCatalogue
            : path === "/v1/cart/quote"
              ? quote
              : path === "/v1/checkout"
                ? reservation
                : payment;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(value));
    })().catch((error: unknown) => {
      response.destroy(error instanceof Error ? error : new Error("Fixture failure"));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let ids = 0;
  // Synthetic stand-in for the parent's approved native bearer transport, not production auth.
  const transport: typeof fetch = (url, init) => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", "Bearer synthetic-native-bearer");
    return fetch(url, { ...init, credentials: "omit", headers });
  };
  const api = createAuthoritativeCommerceApi(
    { origin, fetch: transport, authorizeMutation: async () => ({}) },
    commercePresentationSchemas,
  );
  const createController = (
    session: ClientSession = nativeCustomerSession,
    recovery?: NativeCommerceRecovery,
  ) =>
    new NativeCommerceController({
      api,
      locations: [{ reference: locationId, title: "Synthetic approved location" }],
      session: () => session,
      active: () => true,
      uuid: () => (++ids === 1 ? operationId : paymentOperationId),
      recovery,
    });
  let controller = createController();
  const backgroundAndRevalidate = async () => {
    const recovery = controller.snapshotRecovery();
    if (!recovery) throw Error("Missing synthetic recovery");
    controller.dispose();
    const session = sessionSchema.parse(
      await (await transport(`${origin}/v1/session`, { credentials: "omit" })).json(),
    );
    controller = createController(session, recovery);
  };
  try {
    await controller.loadCatalogue();
    controller.selectLocation(locationId);
    controller.setQuantity(skuId, 1);
    controller.setAddress("recipientName", "Synthetic Recipient");
    controller.setAddress("line1", "Synthetic House");
    controller.setAddress("city", "Thrissur");
    controller.setAddress("region", "Kerala");
    controller.setAddress("postalCode", "680001");
    controller.setAddress("contactPhone", "+919876543210");
    await controller.requestQuote();
    expect(controller.getSnapshot().quote?.amountPaise).toBe(15750);
    expect(calls.filter((call) => call.path === "/v1/checkout")).toHaveLength(0);
    await controller.confirmCheckout();
    expect(controller.getSnapshot().recovery).toBe("checkout");
    await backgroundAndRevalidate();
    await controller.confirmCheckout();
    expect(controller.getSnapshot().reservation?.status).toBe("reserved");
    const checkouts = calls.filter((call) => call.path === "/v1/checkout");
    expect(checkouts).toHaveLength(2);
    expect(checkouts[1]?.payload).toEqual(checkouts[0]?.payload);
    expect(checkouts[0]?.payload).toMatchObject({
      operationId,
      quoteKey: quote.quoteKey,
      deliveryAddress: { country: "IN", postalCode: "680001" },
    });
    await controller.createPayment();
    expect(controller.getSnapshot().recovery).toBe("payment");
    await backgroundAndRevalidate();
    await controller.createPayment();
    expect(controller.getSnapshot().payment?.state).toBe("unknown");
    await controller.refreshPayment();
    await controller.refreshPayment(true);
    await controller.createPayment();
    const creates = calls.filter((call) => call.path.endsWith("/payment-intents"));
    expect(creates).toHaveLength(2);
    expect(creates[1]?.payload).toEqual(creates[0]?.payload);
    expect(calls).toContainEqual({
      path: `/v1/payments/${intentId}`,
      method: "GET",
      payload: null,
    });
    expect(calls).toContainEqual({
      path: `/v1/payments/${intentId}/reconcile`,
      method: "POST",
      payload: {},
    });
    expect(ids).toBe(2);
  } finally {
    controller.dispose();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
