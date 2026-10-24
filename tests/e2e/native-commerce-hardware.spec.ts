import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import { createNativeCommerceHardware } from "../../apps/mobile/src/customer/commerceHardware";
import { nativeCredentialLifetime } from "../../apps/mobile/src/customer/recovery";
import { nativeLegacyPaymentRecoveryBroker } from "../../apps/mobile/src/nativeLegacyPaymentRecovery";
import { createAuthoritativeCommerceApi } from "../../apps/workspaces/src/customer/commerce/authoritative-api";
import { commercePresentationSchemas } from "../../apps/workspaces/src/customer/commerce/domainSchemas";
import { loadSession } from "../../packages/client/src/index";
import { nativeApiTransport } from "../../packages/client/src/knowledge";
import { paymentFlow, sensitiveClient } from "../../packages/client/src/sensitive";
import type { CommercePaymentView } from "../../packages/contracts/src/commerce-http";
import {
  context,
  payment as legacyPayment,
  receipt,
  reference,
  session,
} from "../fixtures/sensitive";

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

test("legacy native checkout background return restores only its reference after fresh authority, then explicitly reads/reconciles", async () => {
  const calls: { path: string; method: string; body: string }[] = [];
  let backgrounded = false;
  const server = createServer((request, response) => {
    void (async () => {
      expect(request.headers.authorization).toBe("Bearer synthetic_legacy_native_bearer");
      let body = "";
      for await (const chunk of request) body += String(chunk);
      const path = request.url ?? "";
      calls.push({ path, method: request.method ?? "", body });
      const data =
        path === "/v1/session"
          ? session
          : path === "/v1/security/context"
            ? context
            : path === `/v1/payments/${reference}/reconcile`
              ? { ...legacyPayment, status: "paid", checkout: null }
              : backgrounded
                ? { ...legacyPayment, status: "pending", checkout: null }
                : legacyPayment;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(data));
    })().catch((error: unknown) =>
      response.destroy(error instanceof Error ? error : Error("Synthetic fixture failure")),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const broker = nativeLegacyPaymentRecoveryBroker();
  const bootstrap = async () => {
    let active = true;
    const lifetime = nativeCredentialLifetime(
      async () => "synthetic_legacy_native_bearer",
      () => {
        broker.clear();
      },
    );
    const transport = nativeApiTransport(origin, true, lifetime.read, () => active);
    const authority = await loadSession(origin, true, new AbortController().signal, transport);
    if (authority.status !== "ready") throw Error("Expected fresh synthetic authority");
    const hash = await lifetime.hash(async (value) =>
      createHash("sha256").update(value).digest("hex"),
    );
    const client = sensitiveClient({ origin, local: true, session: authority.data, transport });
    return {
      session: authority.data,
      hash,
      client,
      suspend() {
        active = false;
        lifetime.clear();
        client.dispose();
      },
    };
  };
  let release: (value: unknown) => void = () => {};
  let opened = 0;
  let first: Awaited<ReturnType<typeof bootstrap>> | undefined;
  let resumed: Awaited<ReturnType<typeof bootstrap>> | undefined;
  try {
    first = await bootstrap();
    const loaded = await first.client.payment(reference);
    if (loaded.status !== "ready") throw Error("Expected authorized payment view");
    const flow = paymentFlow(first.client, async () => {
      opened++;
      expect(broker.restore(session, first?.hash ?? "")).toBe(reference);
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    // Same sequence as the invoked Pay action, not button preflight.
    expect(broker.remember(first.session, first.hash, reference, loaded.data)).toBe(true);
    const paying = flow.pay(reference, loaded.data);
    await expect.poll(() => opened).toBe(1);
    backgrounded = true;
    flow.dispose();
    first.suspend();
    release(receipt); // Late SDK payload is not retained or sent by the disposed flow.
    expect(await paying).toEqual({ status: "anonymous" });
    const beforeResume = calls.length;
    resumed = await bootstrap();
    const restored = broker.restore(resumed.session, resumed.hash);
    expect(restored).toBe(reference);
    expect(broker.restore(resumed.session, resumed.hash)).toBe(reference);
    expect(calls.slice(beforeResume).map((call) => call.path)).toEqual(["/v1/session"]);
    expect(opened).toBe(1); // Bootstrap/restore neither reloads private views nor opens checkout.
    if (!restored) throw Error("Expected reference-only recovery");
    // Explicit Load, then explicit Reconcile: only the server may establish paid state.
    expect(await resumed.client.payment(restored)).toMatchObject({
      status: "ready",
      data: { status: "pending", checkout: null },
    });
    expect(await resumed.client.reconcile(restored)).toMatchObject({
      status: "ready",
      data: { status: "paid", checkout: null },
    });
    expect(opened).toBe(1);
    expect(calls.filter((call) => call.method === "POST")).toEqual([
      { path: `/v1/payments/${reference}/reconcile`, method: "POST", body: "{}" },
    ]);
    broker.clear();
    expect(broker.restore(resumed.session, resumed.hash)).toBeNull();
  } finally {
    broker.clear();
    first?.suspend();
    resumed?.suspend();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
