import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import { createNativeCommerceHardware } from "../../apps/mobile/src/customer/commerceHardware";
import { createAuthoritativeCommerceApi } from "../../apps/workspaces/src/customer/commerce/authoritative-api";
import { commercePresentationSchemas } from "../../apps/workspaces/src/customer/commerce/domainSchemas";
import type { CommercePaymentView } from "../../packages/contracts/src/commerce-http";

const intentId = "55555555-5555-4555-8555-555555555555";
const payment: CommercePaymentView = {
  intentId,
  operationId: "44444444-4444-4444-8444-444444444444",
  subject: { kind: "order", id: "22222222-2222-4222-8222-222222222222" },
  providerOrderId: "order_synthetic123",
  amountPaise: 15751,
  currency: "INR",
  state: "ready",
};
const metadata = {
  intentId,
  operationId: payment.operationId,
  subject: payment.subject,
  providerOrderId: payment.providerOrderId,
  amountPaise: payment.amountPaise,
  currency: "INR",
  keyId: "rzp_test_synthetic123",
};

for (const outcome of ["success", "cancel", "unknown", "denied"] as const) {
  test(`canonical native metadata -> synthetic SDK ${outcome} -> only original intent read/reconcile`, async () => {
    const calls: { path: string; method: string; body: string }[] = [];
    const server = createServer((request, response) => {
      void (async () => {
        expect(request.headers.authorization).toBe("Bearer synthetic_native_hardware");
        expect(request.headers.cookie).toBeUndefined();
        expect(request.headers["x-csrf-token"]).toBeUndefined();
        let body = "";
        for await (const chunk of request) body += String(chunk);
        const path = request.url ?? "";
        calls.push({ path, method: request.method ?? "", body });
        const status = outcome === "denied" && path.endsWith("/checkout") ? 403 : 200;
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify(
            status === 403
              ? {}
              : path.endsWith("/checkout")
                ? metadata
                : { ...payment, state: "unknown" },
          ),
        );
      })().catch((error: unknown) =>
        response.destroy(error instanceof Error ? error : Error("Synthetic fixture failure")),
      );
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const transport: typeof fetch = (input, init) => {
      expect(init?.credentials).toBe("omit");
      const headers = new Headers(init?.headers);
      headers.set("Authorization", "Bearer synthetic_native_hardware");
      return fetch(input, { ...init, headers });
    };
    const api = createAuthoritativeCommerceApi(
      { origin, credentials: "omit", fetch: transport, authorizeMutation: async () => ({}) },
      commercePresentationSchemas,
    );
    let opened = 0;
    const hardware = createNativeCommerceHardware({
      api,
      open: async (input, current) => {
        expect(current()).toBe(true);
        expect(input).toEqual({
          key: metadata.keyId,
          order_id: metadata.providerOrderId,
          amount: metadata.amountPaise,
          currency: "INR",
        });
        opened++;
        if (outcome === "cancel") throw Error("Synthetic cancellation");
        return outcome === "success"
          ? { state: "captured", razorpay_payment_id: "untrusted_payload" }
          : undefined;
      },
    });
    try {
      const result = await hardware.launch(
        payment,
        new AbortController().signal,
        () => true,
        () => {},
      );
      expect(result).toMatchObject(
        outcome === "denied"
          ? { status: "denied" }
          : { status: "ready", data: { state: "unknown", intentId } },
      );
      expect(opened).toBe(outcome === "denied" ? 0 : 1);
      expect(calls).toEqual(
        outcome === "denied"
          ? [{ path: `/v1/payments/${intentId}/checkout`, method: "GET", body: "" }]
          : [
              { path: `/v1/payments/${intentId}/checkout`, method: "GET", body: "" },
              { path: `/v1/payments/${intentId}`, method: "GET", body: "" },
              { path: `/v1/payments/${intentId}/reconcile`, method: "POST", body: "{}" },
            ],
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
}
