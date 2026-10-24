import { vi } from "vitest";
import {
  type NativeCommerceCommands,
  NativeCommerceController,
  type NativeCommerceRecovery,
} from "../../apps/mobile/src/customer/commerceController";
import type { ClientSession } from "../../packages/contracts/src/client";
import type {
  CommerceCataloguePage,
  CommerceCheckout,
  CommerceQuote,
} from "../../packages/contracts/src/commerce-catalogue";
import type { CommercePaymentView } from "../../packages/contracts/src/commerce-http";
import { nativeCustomerCatalogue, nativeCustomerSession } from "../fixtures/native-customer";

export const locationId = "11111111-1111-4111-8111-111111111111";
export const orderId = "22222222-2222-4222-8222-222222222222";
export const operationId = "33333333-3333-4333-8333-333333333333";
export const paymentOperationId = "44444444-4444-4444-8444-444444444444";
export const intentId = "55555555-5555-4555-8555-555555555555";
export const catalogue = nativeCustomerCatalogue as CommerceCataloguePage;
const firstProduct = catalogue.items[0];
if (!firstProduct) throw Error("Synthetic fixture is missing its product");
export const skuId = firstProduct.skuId;
export const locations = [{ reference: locationId, title: "Synthetic approved location" }];
export const address = {
  recipientName: "Synthetic Recipient",
  line1: "Synthetic House",
  line2: "",
  city: "Thrissur",
  region: "Kerala",
  postalCode: "680001",
  country: "IN",
  contactPhone: "+919876543210",
};
export const quote: CommerceQuote = {
  lines: [
    {
      skuId,
      quantity: 1,
      version: 1,
      unitPaise: 15000,
      taxPaise: 751,
      amountPaise: 15751,
      taxPolicyId: locationId,
      rateBps: 500,
    },
  ],
  amountPaise: 15751,
  currency: "INR",
  quoteKey: "synthetic-server-quote",
};
export const reservation: CommerceCheckout = {
  orderId,
  amountPaise: 15751,
  currency: "INR",
  status: "reserved",
  expiresAt: "2099-01-01T00:00:00Z",
};
export const payment: CommercePaymentView = {
  intentId,
  operationId: paymentOperationId,
  subject: { kind: "order", id: orderId },
  amountPaise: 15751,
  currency: "INR",
  state: "unknown",
  providerOrderId: null,
};
export function setup(
  recovery?: NativeCommerceRecovery,
  initialSession: ClientSession = nativeCustomerSession,
) {
  let session: ClientSession | null = initialSession;
  let active = true;
  const api = {
    catalogue: vi.fn<NativeCommerceCommands["catalogue"]>(async () => ({
      status: "ready",
      data: catalogue,
    })),
    quote: vi.fn<NativeCommerceCommands["quote"]>(async () => ({ status: "ready", data: quote })),
    checkout: vi.fn<NativeCommerceCommands["checkout"]>(async () => ({
      status: "ready",
      data: reservation,
    })),
    createPayment: vi.fn<NativeCommerceCommands["createPayment"]>(async () => ({
      status: "ready",
      data: payment,
    })),
    readPayment: vi.fn<NativeCommerceCommands["readPayment"]>(async () => ({
      status: "ready",
      data: payment,
    })),
    reconcilePayment: vi.fn<NativeCommerceCommands["reconcilePayment"]>(async () => ({
      status: "ready",
      data: payment,
    })),
  };
  const uuid = vi.fn().mockReturnValueOnce(operationId).mockReturnValue(paymentOperationId);
  const revoked = vi.fn();
  const controller = new NativeCommerceController({
    api,
    locations,
    session: () => session,
    active: () => active,
    uuid,
    onRevoked: revoked,
    recovery,
  });
  async function fill() {
    await controller.loadCatalogue();
    controller.selectLocation(locationId);
    controller.setQuantity(skuId, 1);
    for (const [key, value] of Object.entries(address))
      controller.setAddress(key as keyof typeof address, value);
  }
  return {
    controller,
    api,
    uuid,
    revoked,
    fill,
    logout: () => {
      session = null;
    },
    expire: () => {
      session = { ...nativeCustomerSession, expiresAt: "2000-01-01T00:00:00Z" };
    },
    deactivate: () => {
      active = false;
    },
  };
}
