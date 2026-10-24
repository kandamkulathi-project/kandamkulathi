import { expect, type Page, test } from "@playwright/test";
import { checkoutSchema } from "../../packages/contracts/src/commerce-catalogue";
import {
  commercePaymentViewSchema,
  commerceReconcileRequestSchema,
} from "../../packages/contracts/src/commerce-http";
import { createPaymentSchema } from "../../packages/contracts/src/commerce-payments";

const skuId = "00000000-0000-4000-8000-000000000001";
const locationId = "00000000-0000-4000-8000-000000000010";
const ownerId = "00000000-0000-4000-8000-000000000020";
const orderId = "00000000-0000-4000-8000-000000000030";
const product = {
  skuId,
  sku: "SYNTHETIC",
  name: "Synthetic product",
  variant: "Synthetic pack",
  description: "Synthetic public catalogue fixture; not medical advice.",
  imageUrl: "https://images.example.test/product.webp",
  concerns: ["Synthetic concern"],
  unitPaise: 12000,
  version: 3,
  consultOnly: false,
  stockStatus: "unknown",
};
async function runtimeFixtures(page: Page) {
  await page.route("**/__test/session", (route) =>
    route.fulfill({
      json: {
        userId: ownerId,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        workspaces: ["customer"],
      },
    }),
  );
  await page.route("**/v1/catalogue?*", (route) =>
    route.fulfill({ json: { items: [product], nextCursor: null } }),
  );
  await page.route("**/v1/orders?*", (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.route("https://images.example.test/**", (route) =>
    route.fulfill({ status: 404, body: "Synthetic image unavailable" }),
  );
  await page.route("**/v1/cart/quote", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ locationId, lines: [{ skuId, quantity: 1 }] });
    await route.fulfill({
      json: {
        lines: [
          {
            skuId,
            quantity: 1,
            version: 3,
            unitPaise: 12000,
            taxPaise: 0,
            amountPaise: 12000,
            taxPolicyId: locationId,
            rateBps: 0,
          },
        ],
        amountPaise: 12000,
        currency: "INR",
        quoteKey: "synthetic-current-quote",
      },
    });
  });
}
test("runtime customer route validates inline address and reserves through canonical HTTP without client source", async ({
  page,
}, testInfo) => {
  await runtimeFixtures(page);
  const bodies: unknown[] = [];
  await page.route("**/v1/checkout", async (route) => {
    const body: unknown = route.request().postDataJSON();
    checkoutSchema.parse(body);
    expect(body).not.toHaveProperty("source");
    expect(body).not.toHaveProperty("amountPaise");
    bodies.push(body);
    await route.fulfill(
      bodies.length === 1
        ? { status: 503, json: { error: { code: "COMMERCE_UNAVAILABLE" } } }
        : {
            status: 201,
            json: {
              orderId,
              amountPaise: 12000,
              currency: "INR",
              status: "reserved",
              expiresAt: "2026-10-25T10:00:00.000Z",
            },
          },
    );
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5184/runtime-commerce");
  await page.getByText("Synthetic product", { exact: true }).click();
  await expect(page.getByText("Product image unavailable.", { exact: true })).toBeVisible();
  await expect(page.getByText("Stock: unknown", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Clinic", exact: true }).selectOption(locationId);
  await page.getByRole("combobox", { name: "Product variant 1", exact: true }).selectOption(skuId);
  await page.getByRole("button", { name: "Get current server quote", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "I confirm these current items and the server total." })
    .check();
  await page.getByRole("button", { name: "Reserve order", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Check the delivery address");
  expect(bodies).toEqual([]);
  for (const [name, value] of [
    ["Recipient name", "Synthetic recipient"],
    ["Address line 1", "1 Test Street"],
    ["City", "Test City"],
    ["State / region", "Kerala"],
    ["Postal code", "680001"],
    ["Contact phone (E164)", "+919999999999"],
  ]) {
    if (!name || !value) throw Error("Invalid fixture");
    await page.getByRole("textbox", { name, exact: true }).fill(value);
  }
  await page
    .getByRole("checkbox", { name: "I confirm these current items and the server total." })
    .check();
  await page.getByRole("button", { name: "Reserve order", exact: true }).click();
  await expect(page.getByText(/The reservation outcome is uncertain/)).toBeVisible();
  await page.getByRole("button", { name: "Retry identical reservation", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: `Order ${orderId} is reserved` }),
  ).toContainText("Payment has not been confirmed");
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
  expect(errors).toEqual([]);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("runtime-commerce-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: testInfo.outputPath("runtime-commerce-desktop.png"),
    fullPage: true,
  });
});
test("runtime owner denial clears private checkout fields instead of displaying successful empty data", async ({
  page,
}) => {
  await runtimeFixtures(page);
  await page.route("**/v1/orders?*", (route) =>
    route.fulfill({ status: 403, json: { error: { code: "FORBIDDEN" } } }),
  );
  await page.goto("http://127.0.0.1:5184/runtime-commerce");
  await expect(page.locator('[data-authoritative-private="cleared"]')).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Recipient name", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Recheck session", exact: true })).toBeVisible();
});
test("runtime payment uses order-specific canonical command and identical retry without claiming capture", async ({
  page,
}) => {
  await runtimeFixtures(page);
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
            skuId,
            quantity: 1,
            version: 3,
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
  const bodies: unknown[] = [];
  let paymentOperationId = "";
  await page.route(`**/v1/orders/${orderId}/payment-intents`, async (route) => {
    const body = createPaymentSchema.parse(route.request().postDataJSON());
    expect(body.subject).toEqual({ kind: "order", id: orderId });
    expect(body).not.toHaveProperty("ownerId");
    expect(body).not.toHaveProperty("amountPaise");
    expect(body).not.toHaveProperty("source");
    bodies.push(body);
    paymentOperationId = body.operationId;
    await route.fulfill(
      bodies.length === 1
        ? { status: 503, json: { error: { code: "COMMERCE_UNAVAILABLE" } } }
        : {
            status: 202,
            json: commercePaymentViewSchema.parse({
              intentId: skuId,
              operationId: body.operationId,
              subject: body.subject,
              amountPaise: 12000,
              currency: "INR",
              state: "unknown",
              providerOrderId: null,
            }),
          },
    );
  });
  await page.goto("http://127.0.0.1:5184/runtime-commerce");
  await page.getByRole("button", { name: `View order ${orderId}`, exact: true }).click();
  const request = page.getByRole("button", {
    name: "Request or retry identical Razorpay payment intent",
    exact: true,
  });
  await request.click();
  await expect(
    page.getByRole("status").filter({
      hasText: "This service is unavailable. Integration or policy approval is pending.",
    }),
  ).toBeVisible();
  await request.click();
  await expect(
    page.getByRole("status").filter({ hasText: `Payment intent for order ${orderId}: unknown` }),
  ).toContainText("Pending, ready and unknown are not captured");
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
  await page.route(`**/v1/payments/${skuId}`, (route) => {
    expect(route.request().method()).toBe("GET");
    expect(route.request().postData()).toBeNull();
    return route.fulfill({
      json: commercePaymentViewSchema.parse({
        intentId: skuId,
        operationId: paymentOperationId,
        subject: { kind: "order", id: orderId },
        amountPaise: 12000,
        currency: "INR",
        state: "unknown",
        providerOrderId: null,
      }),
    });
  });
  await page.route(`**/v1/payments/${skuId}/reconcile`, (route) => {
    expect(route.request().method()).toBe("POST");
    expect(commerceReconcileRequestSchema.parse(route.request().postDataJSON())).toEqual({});
    return route.fulfill({
      json: commercePaymentViewSchema.parse({
        intentId: skuId,
        operationId: paymentOperationId,
        subject: { kind: "order", id: orderId },
        amountPaise: 12000,
        currency: "INR",
        state: "captured",
        providerOrderId: "synthetic_provider_order",
      }),
    });
  });
  await page.getByRole("button", { name: "Refresh payment status", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: `Payment intent for order ${orderId}: unknown` }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reconcile existing payment", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: `Payment intent for order ${orderId}: captured` }),
  ).toBeVisible();
  expect(bodies).toHaveLength(2);
});
