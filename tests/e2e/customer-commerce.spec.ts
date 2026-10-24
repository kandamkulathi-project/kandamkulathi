import { expect, type Page, test } from "@playwright/test";
import {
  commerceCatalogue,
  commerceOwner,
  commercePrivate,
} from "../unit/customer-commerce.fixtures";

// Test-owned coordinator harness only: tests/customer-ui/playwright.config.ts.
const base = "http://127.0.0.1:5184";
const prefix = "/__test/commerce/";
async function fixtures(page: Page, overrides: Record<string, unknown> = {}) {
  await page.route("**/__test/session", (route) =>
    route.fulfill({
      json: {
        userId: commerceOwner,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        workspaces: ["customer"],
      },
    }),
  );
  const replies: Record<string, unknown> = {
    catalogue: { status: "ready", data: commerceCatalogue },
    private: { status: "ready", data: commercePrivate },
    ...overrides,
  };
  await page.route(`**${prefix}*`, (route) => {
    const name = new URL(route.request().url()).pathname.slice(prefix.length);
    return route.fulfill({ json: replies[name] ?? { status: "unavailable" } });
  });
  await page.goto(`${base}/commerce`);
}

test("catalogue filters/detail, server cart totals and order detail are accessible", async ({
  page,
}) => {
  await fixtures(page);
  await page.getByRole("combobox", { name: "Category", exact: true }).selectOption("category-a");
  await page.getByRole("combobox", { name: "Concern", exact: true }).selectOption("concern-a");
  await page.getByText("Synthetic product", { exact: true }).click();
  await expect(page.getByText("Approved-description fixture, not medical advice.")).toBeVisible();
  await expect(page.getByText("Purchase: consult only", { exact: false })).toBeVisible();
  await expect(page.getByText("Server total:", { exact: false }).first()).toContainText("250.00");
  await page.getByText("Order SYNTHETIC-001 — pending", { exact: true }).click();
  await expect(page.getByText("Payment: pending", { exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Product variant", exact: true })
    .selectOption("variant-a");
  await expect(
    page.getByLabel("Product variant").getByRole("option", { name: /Restricted/ }),
  ).toHaveCount(0);
});

test("invalid address and fractional quantity never submit a mutation", async ({ page }) => {
  await fixtures(page);
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") mutations.push(request.url());
  });
  const quantity = page.getByLabel("Quantity for Synthetic pack");
  await quantity.fill("1.5");
  await page.getByRole("button", { name: "Update quantity" }).click();
  expect(
    await quantity.evaluate((input) => (input as HTMLInputElement).validity.stepMismatch),
  ).toBe(true);
  for (const [label, value] of [
    ["Recipient", "Synthetic recipient"],
    ["Address line", "1 Test Street"],
    ["City", "Test City"],
    ["State", "Kerala"],
    ["Pincode", "000000"],
    ["Phone", "invalid-phone"],
  ]) {
    if (label && value) await page.getByLabel(label, { exact: true }).fill(value);
  }
  await page.getByRole("button", { name: "Save address" }).click();
  await expect(page.getByRole("alert")).toContainText("six-digit Indian pincode");
  expect(mutations).toEqual([]);
});

test("stale prices prohibit checkout and read refresh recovers current server state", async ({
  page,
}) => {
  await fixtures(page, {
    private: {
      status: "ready",
      data: { ...commercePrivate, cart: { ...commercePrivate.cart, pricing: "stale" } },
    },
  });
  await expect(page.getByRole("alert")).toContainText("Prices have changed");
  await page
    .getByRole("combobox", { name: "Delivery address", exact: true })
    .selectOption("address-a");
  await expect(page.getByRole("button", { name: "Request checkout" })).toBeDisabled();
  await page.route(`**${prefix}private`, (route) =>
    route.fulfill({ json: { status: "ready", data: commercePrivate } }),
  );
  await page.getByRole("button", { name: "Refresh account and cart" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Delivery address", exact: true })
    .selectOption("address-a");
  await expect(page.getByRole("button", { name: "Request checkout" })).toBeEnabled();
});

test("checkout duplicate submits are fenced; authoritative pending is not payment success", async ({
  page,
}) => {
  await fixtures(page);
  let calls = 0;
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**${prefix}checkout`, async (route) => {
    calls++;
    expect(route.request().method()).toBe("POST");
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({ input: { addressId: "address-a" }, revision: "revision-1" });
    expect(body.operationId).toMatch(/^[0-9a-f-]{36}$/);
    await pending;
    await route.fulfill({
      json: {
        status: "ready",
        data: { ...commercePrivate, revision: "revision-2", operation: "pending" },
      },
    });
  });
  await page
    .getByRole("combobox", { name: "Delivery address", exact: true })
    .selectOption("address-a");
  await page.getByRole("button", { name: "Request checkout" }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect.poll(() => calls).toBe(1);
  release?.();
  await expect(page.getByText("Operation: pending.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Request checkout" })).toBeDisabled();
  await expect(page.getByText("Payment: paid", { exact: true })).toHaveCount(0);
});

for (const [status, http] of [
  ["anonymous", 401],
  ["denied", 403],
  ["unavailable", 503],
  ["error", 500],
] as const) {
  test(`private ${status} removes personal content and allows explicit read retry`, async ({
    page,
  }) => {
    await fixtures(page, { private: { status } });
    await page.route(`**${prefix}private`, (route) =>
      route.fulfill({ status: http, json: { status } }),
    );
    await page.getByRole("button", { name: "Refresh account and cart" }).click();
    await expect(page.getByText("Synthetic customer", { exact: true })).toHaveCount(0);
    await expect(page.locator(`[data-commerce-private="${status}"]`)).toBeVisible();
    await page.route(`**${prefix}private`, (route) =>
      route.fulfill({ json: { status: "ready", data: commercePrivate } }),
    );
    await page.getByRole("button", { name: "Refresh account and cart" }).click();
    await expect(page.getByText("Synthetic customer", { exact: true })).toBeVisible();
  });
}

test("empty catalogue and owner mismatch do not expose private records", async ({ page }) => {
  await fixtures(page, {
    catalogue: { status: "ready", data: { categories: [], concerns: [], products: [] } },
    private: { status: "ready", data: { ...commercePrivate, ownerId: "another-owner" } },
  });
  await expect(page.getByText("No items to display.", { exact: true })).toBeVisible();
  await expect(page.locator('[data-commerce-private="error"]')).toBeVisible();
  await expect(page.getByText("Synthetic customer", { exact: true })).toHaveCount(0);
});

test("backgrounding clears private forms until session refresh", async ({ page }) => {
  await fixtures(page);
  await page.getByLabel("Recipient", { exact: true }).fill("PRIVATE DRAFT");
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
  await expect(page.locator('[data-commerce-private="cleared"]')).toBeVisible();
  await expect(page.getByLabel("Recipient", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Synthetic customer", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Check access again" }).click();
  await expect(page.getByLabel("Recipient", { exact: true })).toHaveValue("");
});

test("360px layout, keyboard and reduced motion preserve usable controls", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fixtures(page);
  // Settle the authenticated mount before measuring a keyboard traversal; the
  // fixture adapter is re-bound when the verified session first arrives.
  await expect(page.getByText("Synthetic customer", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Category", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("combobox", { name: "Concern", exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "Save address" })).toHaveCSS("min-height", "44px");
  await page.getByText("Synthetic product", { exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("commerce-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: testInfo.outputPath("commerce-desktop.png"), fullPage: true });
});
