import { describe, expect, it, vi } from "vitest";
import { NativeCommerceController } from "../../apps/mobile/src/customer/commerceController";
import {
  nativeCommerceRecoveryBroker,
  nativeCredentialLifetime,
} from "../../apps/mobile/src/customer/recovery";
import {
  createNativeCustomerRuntime,
  nativeCustomerApiTransport,
} from "../../apps/mobile/src/customer/runtime";
import {
  nativeCustomerCart,
  nativeCustomerCatalogue,
  nativeCustomerQuote,
  nativeCustomerSession,
} from "../fixtures/native-customer";

const credentialHash = "a".repeat(64);
async function pendingCheckout() {
  const runtime = createNativeCustomerRuntime({
    origin: "https://api.example.com",
    local: false,
    locale: "en",
    session: nativeCustomerSession,
    active: () => true,
    onRevoked() {},
    uuid: () => crypto.randomUUID(),
    transport: nativeCustomerApiTransport(
      "https://api.example.com",
      false,
      async () => "synthetic_native_bearer_12345",
      () => true,
      async (input) => {
        const path = new URL(String(input)).pathname;
        if (path === "/v1/checkout") throw Error("Synthetic lost checkout acknowledgement");
        return Response.json(
          path === "/v1/catalogue" ? nativeCustomerCatalogue : nativeCustomerQuote,
        );
      },
    ),
  });
  const options = {
    api: runtime.commerceApi,
    locations: [{ reference: nativeCustomerCart.locationId, title: "Synthetic approved location" }],
    session: () => nativeCustomerSession,
    active: () => true,
    uuid: () => crypto.randomUUID(),
  };
  const controller = new NativeCommerceController(options);
  await controller.loadCatalogue();
  controller.selectLocation(nativeCustomerCart.locationId);
  controller.setQuantity(nativeCustomerSession.userId, 1);
  const address = {
    recipientName: "Synthetic customer",
    line1: "1 Synthetic Street",
    city: "Synthetic City",
    region: "Kerala",
    postalCode: "680001",
    country: "IN",
    contactPhone: "+919999999999",
  };
  for (const key of [
    "recipientName",
    "line1",
    "city",
    "region",
    "postalCode",
    "contactPhone",
  ] as const)
    controller.setAddress(key, address[key]);
  await controller.requestQuote();
  await controller.confirmCheckout();
  return { runtime, controller, options };
}
describe("volatile native checkout revalidation handoff", () => {
  it("binds the recovery digest to the actual bootstrap credential and rejects rotation/removal before another request", async () => {
    let token: string | null = "synthetic_first_credential";
    const changed = vi.fn();
    const lifetime = nativeCredentialLifetime(async () => token, changed);
    const digest = vi.fn(async (value: string) => {
      expect(value).toBe(token);
      return credentialHash;
    });
    await expect(lifetime.hash(digest)).rejects.toThrow("Native credential unavailable");
    expect(await lifetime.read()).toBe(token);
    expect(await lifetime.hash(digest)).toBe(credentialHash);
    token = "synthetic_different_credential";
    await expect(lifetime.read()).rejects.toThrow("Native credential lifetime changed");
    await expect(lifetime.hash(digest)).rejects.toThrow("Native credential unavailable");
    await expect(lifetime.read()).rejects.toThrow("Inactive native credential lifetime");
    expect(changed).toHaveBeenCalledTimes(1);
    const removed = nativeCredentialLifetime(async () => token, changed);
    await removed.read();
    token = null;
    await expect(removed.read()).rejects.toThrow("Native credential lifetime changed");
    expect(changed).toHaveBeenCalledTimes(2);
  });
  it("fences delayed credential/digest completions after logout or background disposal", async () => {
    let releaseRead: (value: string) => void = () => {};
    const pendingRead = nativeCredentialLifetime(
      () =>
        new Promise((resolve) => {
          releaseRead = resolve;
        }),
      vi.fn(),
    );
    const read = pendingRead.read();
    pendingRead.clear();
    releaseRead("synthetic_credential");
    await expect(read).rejects.toThrow("Inactive native credential lifetime");
    let releaseHash: (value: string) => void = () => {};
    const pendingHash = nativeCredentialLifetime(async () => "synthetic_credential", vi.fn());
    await pendingHash.read();
    const hash = pendingHash.hash(
      () =>
        new Promise((resolve) => {
          releaseHash = resolve;
        }),
    );
    pendingHash.clear();
    releaseHash(credentialHash);
    await expect(hash).rejects.toThrow("Inactive native credential lifetime");
  });
  it("erases a retained confirmed address/command at authority expiry even without a foreground read", async () => {
    const { controller, runtime } = await pendingCheckout();
    vi.useFakeTimers();
    const expiry = Date.parse(nativeCustomerSession.expiresAt);
    try {
      vi.setSystemTime(expiry - 500);
      const broker = nativeCommerceRecoveryBroker();
      broker.attach(controller, nativeCustomerSession, credentialHash);
      broker.capture();
      await vi.advanceTimersByTimeAsync(500);
      vi.setSystemTime(expiry - 250);
      expect(broker.take(nativeCustomerSession, credentialHash)).toBeNull();
      broker.clear();
    } finally {
      vi.useRealTimers();
      controller.dispose();
      runtime.dispose();
    }
  });
  it("captures before disposal and consumes the same module-issued exact command only after same-session/credential revalidation", async () => {
    const { runtime, controller, options } = await pendingCheckout();
    const broker = nativeCommerceRecoveryBroker();
    const original = controller.snapshotRecovery();
    expect(original?.checkout.operationId).toBeTruthy();
    broker.attach(controller, nativeCustomerSession, credentialHash);
    broker.capture();
    controller.dispose();
    runtime.dispose();
    const recovery = broker.take(nativeCustomerSession, credentialHash);
    expect(recovery?.checkout).toEqual(original?.checkout);
    const replacement = new NativeCommerceController({ ...options, recovery });
    expect(replacement.getSnapshot().recovery).toBe("checkout");
    expect(replacement.snapshotRecovery()?.checkout.operationId).toBe(
      original?.checkout.operationId,
    );
    expect(broker.take(nativeCustomerSession, credentialHash)).toBeNull();
    replacement.dispose();
  });
  it("does not carry across logout/revocation, another credential, changed owner/session expiry or expired authority", async () => {
    const { controller, runtime } = await pendingCheckout();
    for (const session of [
      nativeCustomerSession,
      { ...nativeCustomerSession, userId: "20000000-0000-4000-8000-000000000002" },
      { ...nativeCustomerSession, expiresAt: "2098-01-01T00:00:00Z" },
      { ...nativeCustomerSession, expiresAt: "2020-01-01T00:00:00Z" },
    ]) {
      const broker = nativeCommerceRecoveryBroker();
      broker.attach(controller, nativeCustomerSession, credentialHash);
      broker.capture();
      expect(
        broker.take(session, session === nativeCustomerSession ? "b".repeat(64) : credentialHash),
      ).toBeNull();
    }
    const broker = nativeCommerceRecoveryBroker();
    broker.attach(controller, nativeCustomerSession, credentialHash);
    broker.capture();
    broker.clear();
    expect(broker.take(nativeCustomerSession, credentialHash)).toBeNull();
    controller.dispose();
    runtime.dispose();
  });
});
