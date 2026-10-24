import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { expect, type Page, test } from "@playwright/test";
import {
  staffCommerceIds as ids,
  staffCommerceAssociation,
  staffCommerceBatchPage,
  staffCommerceOrderPage,
} from "../../apps/workspaces/src/staff/testing/commerce-fixtures";
import { formatMoney } from "../../packages/i18n/src/index";
import { staffReadLabels } from "../../packages/i18n/src/staff-read";

// Separate dev-only HTML entry; no root wiring or production fixture fallback.
// This file owns its server and runs serially, including under the root fullyParallel config.
test.describe.configure({ mode: "serial" });
const origin = "http://127.0.0.1:5183";
const entry = `${origin}/src/staff/testing/fixture.html`;
let server: ChildProcess | undefined;
test.beforeAll(async () => {
  server = spawn(
    process.execPath,
    [
      resolve("apps/workspaces/node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      "5183",
      "--strictPort",
    ],
    {
      cwd: resolve("apps/workspaces"),
      stdio: "pipe",
    },
  );
  let output = "";
  server.stderr?.on("data", (chunk) => {
    output += String(chunk);
  });
  server.stdout?.on("data", (chunk) => {
    output += String(chunk);
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Fixture server failed: ${output}`);
    try {
      if ((await fetch(entry)).ok) return;
    } catch {
      /* startup not yet listening */
    }
    await delay(100);
  }
  throw new Error(`Fixture server did not start: ${output}`);
});
test.afterAll(async () => {
  if (server && server.exitCode === null) {
    const exited = once(server, "exit");
    server.kill("SIGTERM");
    await exited;
  }
});
const order = {
  id: "syn-order-a",
  reference: "Synthetic order A",
  clinicLabel: "Synthetic clinic A",
  status: "confirmed",
  totalPaise: 12500,
};
async function response(
  page: Page,
  status = 200,
  body: unknown = { version: 1, rows: [order], nextCursor: null },
) {
  await page.route(`${origin}/v1/staff/**`, (route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }),
  );
}

test("success: orders, server pagination/filter, batches and schedules remain read-only", async ({
  page,
}, testInfo) => {
  const requests: { url: string; method: string }[] = [];
  await page.route(`${origin}/v1/staff/**`, async (route) => {
    const url = new URL(route.request().url());
    requests.push({ url: url.toString(), method: route.request().method() });
    const rows = url.pathname.endsWith("batches")
      ? [
          {
            id: "batch-a",
            clinicLabel: "Synthetic clinic A",
            status: "available",
            productLabel: "Synthetic item",
            batchCode: "B-1",
            expiresOn: "2027-10-24",
            quantity: 8,
          },
        ]
      : url.pathname.endsWith("schedules")
        ? [
            {
              id: "slot-a",
              clinicLabel: "Synthetic clinic A",
              status: "available",
              doctorLabel: "Synthetic doctor A",
              startsAt: "2026-10-24T10:00:00Z",
              endsAt: "2026-10-24T10:30:00Z",
              modeLabel: "In clinic",
            },
          ]
        : [
            {
              ...order,
              reference: url.searchParams.has("cursor") ? "Synthetic order B" : "Synthetic order A",
            },
          ];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        version: 1,
        rows,
        nextCursor:
          url.pathname.endsWith("orders") && !url.searchParams.has("cursor") ? "page_2" : null,
      }),
    });
  });
  await page.goto(entry);
  await expect(page.getByRole("cell", { name: "Synthetic order A", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByRole("cell", { name: "Synthetic order B", exact: true })).toBeVisible();
  await page.getByLabel("Status filter").selectOption("confirmed");
  await expect(page.getByText("Page 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Synthetic order A", exact: true })).toBeVisible();
  expect(
    requests.some(({ url }) => url.includes("status=confirmed") && !url.includes("cursor=")),
  ).toBe(true);
  await page.getByRole("button", { name: "Batches", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Synthetic item / B-1" })).toBeVisible();
  await page.getByRole("button", { name: "Doctor schedules", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Synthetic doctor A" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Starts (IST)" })).toBeVisible();
  expect(requests.every(({ method }) => method === "GET")).toBe(true);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  await page.screenshot({ path: testInfo.outputPath("staff-en-desktop.png"), fullPage: true });
});

test("invalid response, forbidden response and customer grant never expose rows; refresh can recover", async ({
  page,
}) => {
  await response(page, 200, {
    version: 1,
    rows: [{ ...order, privateNotes: "never render" }],
    nextCursor: null,
  });
  await page.goto(entry);
  await expect(page.locator("[data-staff-state]")).toHaveAttribute("data-staff-state", "error");
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.unroute(`${origin}/v1/staff/**`);
  await response(page, 403);
  await page.getByRole("button", { name: "Refresh records" }).click();
  await expect(page.getByRole("alert")).toContainText(staffReadLabels.en.denied);
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.unroute(`${origin}/v1/staff/**`);
  await response(page);
  await page.getByRole("button", { name: "Refresh records" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  let calls = 0;
  await page.unroute(`${origin}/v1/staff/**`);
  await page.route(`${origin}/v1/staff/**`, (route) => {
    calls++;
    return route.abort();
  });
  await page.goto(`${entry}?mode=customer`);
  await expect(page.locator("[data-staff-state]")).toHaveAttribute("data-staff-state", "denied");
  expect(calls).toBe(0);
});

test("loading, empty, missing adapter, unavailable endpoint and anonymous states are truthful", async ({
  page,
}) => {
  await page.route(`${origin}/v1/staff/**`, async (route) => {
    await delay(200);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ version: 1, rows: [], nextCursor: null }),
    });
  });
  await page.goto(entry);
  await expect(page.locator("[data-staff-state]")).toHaveAttribute("data-staff-state", "loading");
  await expect(page.getByText("No records match this view.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
  await page.goto(`${entry}?mode=missing`);
  await expect(page.getByRole("status")).toContainText("Pending");
  await page.unroute(`${origin}/v1/staff/**`);
  await response(page, 503);
  await page.goto(entry);
  await expect(page.getByRole("status")).toContainText("Pending");
  await page.unroute(`${origin}/v1/staff/**`);
  await response(page, 401);
  await page.getByRole("button", { name: "Refresh records" }).click();
  await expect(page.getByRole("status")).toContainText("Sign in again");
});

test("late ignored-abort responses cannot replace a newer filter result", async ({ page }) => {
  await page.goto(`${entry}?mode=late`);
  await page.getByLabel("Status filter").selectOption("packed");
  await expect(page.getByText("No records match this view.")).toBeVisible();
  await page.waitForTimeout(500); // beyond the deliberately stale fixture completion
  await expect(page.getByText("Late synthetic order")).toHaveCount(0);
  await expect(page.getByText("No records match this view.")).toBeVisible();
});

test("timeout, expiry and page lifecycle remove private content", async ({ page }) => {
  await page.clock.install();
  await page.goto(`${entry}?mode=timeout`);
  await page.clock.fastForward(5100);
  await expect(page.locator("[data-staff-state]")).toHaveAttribute("data-staff-state", "error");
  await response(page);
  await page.goto(`${entry}?mode=expiry`);
  await expect(page.getByRole("table")).toBeVisible();
  await page.clock.fastForward(2100);
  await expect(page.locator("[data-staff-state]")).toHaveAttribute("data-staff-state", "anonymous");
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.goto(entry);
  await expect(page.getByRole("table")).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Pending");
});

test("narrow layout and keyboard keep controls/table reachable without page overflow", async ({
  page,
}) => {
  await response(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(entry);
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "Orders", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Batches", exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const locale of ["ml", "ta"] as const) {
  test(`narrow ${locale} labels, money and server statuses remain distinct`, async ({
    page,
  }, testInfo) => {
    const text = staffReadLabels[locale];
    await response(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${entry}?locale=${locale}`);
    await expect(page.getByRole("heading", { name: text.records, exact: true })).toBeVisible();
    await expect(page.getByLabel(text.filter)).toBeVisible();
    await expect(
      page.getByRole("cell", { name: formatMoney(12500, locale), exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: "confirmed", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: text.next, exact: true })).toBeDisabled();
    await page.getByRole("button", { name: text.orders, exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: text.batches, exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`staff-${locale}-narrow.png`),
      fullPage: true,
    });
  });
}

test("real shared commerce DTOs retain separate stock facts and order metadata on exact clinic routes", async ({
  page,
}) => {
  const calls: URL[] = [];
  await page.route(`${origin}/v1/staff/**`, async (route) => {
    const url = new URL(route.request().url());
    calls.push(url);
    expect(route.request().method()).toBe("GET");
    expect(url.pathname).toMatch(new RegExp(`^/v1/staff/clinics/${ids.clinic}/(orders|batches)$`));
    expect(url.searchParams.has("status")).toBe(false);
    const body = url.pathname.endsWith("batches")
      ? staffCommerceBatchPage
      : url.searchParams.has("after")
        ? { items: [], nextCursor: null }
        : staffCommerceOrderPage;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto(`${entry}?mode=commerce`);
  await expect(page.getByRole("cell", { name: ids.order, exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "phone", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "3", exact: true })).toBeVisible();
  await expect(page.getByLabel("Status filter")).toBeDisabled();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText(staffReadLabels.en.empty)).toBeVisible();
  expect(
    calls.some(
      (url) => url.searchParams.get("after") === ids.next && url.searchParams.get("limit") === "20",
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Batches", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: `${ids.sku} / Synthetic batch A`, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: staffCommerceAssociation.clinicName, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: staffReadLabels.en.units, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: staffReadLabels.en.reserved, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: staffReadLabels.en.recalled, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "8", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "3", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "true", exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.getByRole("button", { name: "Refresh records" }).click();
  await expect(page.getByRole("cell", { name: "true", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Doctor schedules", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Pending");
});

test("real DTO malformed UUID/cursor/private fields and auth failures fail closed, then recover", async ({
  page,
}) => {
  for (const body of [
    { ...staffCommerceOrderPage, nextCursor: "invalid-cursor" },
    {
      ...staffCommerceOrderPage,
      items: [{ ...staffCommerceOrderPage.items[0], locationId: ids.clinic }],
    },
    {
      ...staffCommerceOrderPage,
      items: [{ ...staffCommerceOrderPage.items[0], orderId: "invalid-uuid" }],
    },
    {
      ...staffCommerceOrderPage,
      items: [{ ...staffCommerceOrderPage.items[0], patientName: "must not render" }],
    },
  ]) {
    await response(page, 200, body);
    await page.goto(`${entry}?mode=commerce`);
    await expect(page.locator("[data-staff-state]")).toHaveAttribute("data-staff-state", "error");
    await expect(page.getByRole("table")).toHaveCount(0);
    await page.unroute(`${origin}/v1/staff/**`);
  }
  for (const [code, status] of [
    [401, "anonymous"],
    [403, "denied"],
    [503, "unavailable"],
  ] as const) {
    await response(page, code);
    await page.getByRole("button", { name: "Refresh records" }).click();
    await expect(page.locator("[data-staff-state]")).toHaveAttribute("data-staff-state", status);
    await expect(page.getByRole("table")).toHaveCount(0);
    await page.unroute(`${origin}/v1/staff/**`);
  }
  await response(page, 200, staffCommerceOrderPage);
  await page.getByRole("button", { name: "Refresh records" }).click();
  await expect(page.getByRole("cell", { name: ids.order, exact: true })).toBeVisible();
});

test("real batch DTO missing reserved is an error, not zero; retry preserves false and zero flags", async ({
  page,
}) => {
  let valid = false;
  await page.route(`${origin}/v1/staff/**`, (route) => {
    const body = route.request().url().includes("/batches")
      ? {
          items: [
            {
              ...staffCommerceBatchPage.items[0],
              reserved: valid ? 9 : undefined,
              onHand: 0,
              recalled: false,
            },
          ],
          nextCursor: null,
        }
      : staffCommerceOrderPage;
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto(`${entry}?mode=commerce`);
  await expect(page.getByRole("cell", { name: ids.order, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Batches", exact: true }).click();
  await expect(page.locator("[data-staff-state]")).toHaveAttribute("data-staff-state", "error");
  await expect(page.getByRole("table")).toHaveCount(0);
  valid = true;
  await page.getByRole("button", { name: "Refresh records" }).click();
  for (const value of ["0", "9", "false"])
    await expect(page.getByRole("cell", { name: value, exact: true })).toBeVisible();
});
