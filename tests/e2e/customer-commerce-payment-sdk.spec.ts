import { expect, type Page, test } from "@playwright/test";
import { commercePaymentCheckoutSchema } from "../../packages/contracts/src/commerce-checkout";
import { commercePaymentViewSchema } from "../../packages/contracts/src/commerce-http";
import { createPaymentSchema } from "../../packages/contracts/src/commerce-payments";

const orderId = "00000000-0000-4000-8000-000000000001";
const intentId = "00000000-0000-4000-8000-000000000002";
const locationId = "00000000-0000-4000-8000-000000000003";
const providerOrderId = "order_synthetic123";
async function fixtures(page: Page, outcome: "callback" | "cancel" = "callback") {
  await page.addInitScript(
    ({ outcome }) => {
      type Options = {
        key: string;
        order_id: string;
        amount: number;
        currency: string;
        handler(value: unknown): void;
        modal: { ondismiss(): void };
      };
      const state = {
        opens: 0,
        closes: 0,
        options: null as null | Pick<Options, "key" | "order_id" | "amount" | "currency">,
      };
      Object.defineProperty(window, "__syntheticCheckout", { value: state });
      Object.defineProperty(window, "Razorpay", {
        value: class {
          constructor(private options: Options) {
            state.options = {
              key: options.key,
              order_id: options.order_id,
              amount: options.amount,
              currency: options.currency,
            };
          }
          open() {
            state.opens++;
            if (outcome === "cancel") this.options.modal.ondismiss();
            else
              this.options.handler({
                status: "paid",
                amount: 1,
                razorpay_payment_id: "untrusted-return",
              });
          }
          close() {
            state.closes++;
          }
        },
      });
    },
    { outcome },
  );
  await page.route("**/__test/session", (route) =>
    route.fulfill({
      json: {
        userId: locationId,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        workspaces: ["customer"],
      },
    }),
  );
  await page.route("**/v1/catalogue?*", (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  const summary = {
    orderId,
    locationId,
    amountPaise: 12000,
    currency: "INR",
    status: "reserved",
    version: 1,
    source: "web",
    createdAt: "2026-10-24T10:00:00.000Z",
    expiresAt: "2026-10-25T10:00:00.000Z",
  };
  await page.route("**/v1/orders?*", (route) =>
    route.fulfill({ json: { items: [summary], nextCursor: null } }),
  );
  await page.route(`**/v1/orders/${orderId}`, (route) =>
    route.fulfill({
      json: {
        ...summary,
        deliveryAddress: null,
        lines: [
          {
            skuId: locationId,
            quantity: 1,
            version: 1,
            unitPaise: 12000,
            taxPaise: 0,
            amountPaise: 12000,
            taxPolicyId: locationId,
          },
        ],
        documents: [],
        fulfillment: "unavailable",
      },
    }),
  );
  let operationId = "";
  let creates = 0;
  const payment = (state = "ready") =>
    commercePaymentViewSchema.parse({
      intentId,
      operationId,
      subject: { kind: "order", id: orderId },
      providerOrderId,
      amountPaise: 12000,
      currency: "INR",
      state,
    });
  const metadata = () =>
    commercePaymentCheckoutSchema.parse({
      keyId: "rzp_test_demo",
      providerOrderId,
      amountPaise: 12000,
      currency: "INR",
      intentId,
      operationId,
      subject: { kind: "order", id: orderId },
    });
  await page.route(`**/v1/orders/${orderId}/payment-intents`, (route) => {
    operationId = createPaymentSchema.parse(route.request().postDataJSON()).operationId;
    creates++;
    return route.fulfill({ status: 202, json: payment() });
  });
  await page.route(`**/v1/payments/${intentId}/checkout`, (route) => {
    expect(route.request().method()).toBe("GET");
    expect(route.request().postData()).toBeNull();
    return route.fulfill({ json: metadata() });
  });
  await page.route(`**/v1/payments/${intentId}`, (route) =>
    route.fulfill({ json: payment(outcome === "cancel" ? "ready" : "unknown") }),
  );
  await page.route(`**/v1/payments/${intentId}/reconcile`, (route) => {
    expect(route.request().postDataJSON()).toEqual({});
    return route.fulfill({ json: payment("captured") });
  });
  await page.goto("http://127.0.0.1:5184/runtime-commerce");
  await page.getByRole("button", { name: `View order ${orderId}`, exact: true }).click();
  await page
    .getByRole("button", {
      name: "Request or retry identical Razorpay payment intent",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: `Payment intent for order ${orderId}: ready` }),
  ).toBeVisible();
  return { metadata, creates: () => creates };
}
const sdk = (page: Page) =>
  page.evaluate(
    () =>
      Object.getOwnPropertyDescriptor(window, "__syntheticCheckout")?.value as {
        opens: number;
        closes: number;
        options: unknown;
      },
  );
test("canonical ready intent opens reviewed SDK and callback only reads server; reconcile establishes capture", async ({
  page,
}, testInfo) => {
  const fixture = await fixtures(page);
  await page.getByRole("button", { name: "Pay with Razorpay", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: `Payment intent for order ${orderId}: unknown` }),
  ).toBeVisible();
  expect((await sdk(page)).options).toEqual({
    key: "rzp_test_demo",
    order_id: providerOrderId,
    amount: 12000,
    currency: "INR",
  });
  expect((await sdk(page)).opens).toBe(1);
  expect(fixture.creates()).toBe(1);
  await expect(
    page.getByRole("status").filter({ hasText: `Payment intent for order ${orderId}: captured` }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Reconcile existing payment", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: `Payment intent for order ${orderId}: captured` }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("canonical-payment-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("canonical-payment-mobile.png"),
    fullPage: true,
  });
});
test("SDK cancellation retains the same intent and explicit SDK retry never creates another charge", async ({
  page,
}) => {
  const fixture = await fixtures(page, "cancel");
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole("button", { name: "Pay with Razorpay", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: `Payment intent for order ${orderId}: ready` }),
    ).toBeVisible();
  }
  expect(fixture.creates()).toBe(1);
  expect((await sdk(page)).opens).toBe(2);
});
test("mismatched canonical checkout metadata never opens SDK", async ({ page }) => {
  const fixture = await fixtures(page);
  await page.route(`**/v1/payments/${intentId}/checkout`, (route) =>
    route.fulfill({ json: { ...fixture.metadata(), amountPaise: 1 } }),
  );
  await page.getByRole("button", { name: "Pay with Razorpay", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("response could not be verified");
  expect((await sdk(page)).opens).toBe(0);
  expect(fixture.creates()).toBe(1);
});
test("owner denial clears private payment and prevents SDK launch", async ({ page }) => {
  await fixtures(page);
  await page.route(`**/v1/payments/${intentId}/checkout`, (route) =>
    route.fulfill({ status: 403, json: { error: { code: "FORBIDDEN" } } }),
  );
  await page.getByRole("button", { name: "Pay with Razorpay", exact: true }).click();
  await expect(page.locator('[data-authoritative-private="cleared"]')).toBeVisible();
  expect((await sdk(page)).opens).toBe(0);
});
test("revocation during metadata prevents a late SDK launch", async ({ page }) => {
  const fixture = await fixtures(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/v1/payments/${intentId}/checkout`, async (route) => {
    await gate;
    await route.fulfill({ json: fixture.metadata() }).catch(() => undefined);
  });
  const requested = page.waitForRequest(`**/v1/payments/${intentId}/checkout`);
  await page.getByRole("button", { name: "Pay with Razorpay", exact: true }).click();
  await requested;
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  release();
  await expect(page.locator('[data-authoritative-private="cleared"]')).toBeVisible();
  expect((await sdk(page)).opens).toBe(0);
});
