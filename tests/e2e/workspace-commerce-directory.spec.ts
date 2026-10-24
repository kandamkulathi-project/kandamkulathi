import { expect, test } from "@playwright/test";
import {
  staffCommerceIds,
  staffCommerceOrderPage,
} from "../../apps/workspaces/src/staff/testing/commerce-fixtures";

// Actual root integration contract: coordinator must mount StaffCommerceWorkspace.
// No alternate test app, raw UUID entry, or browser-evaluated replacement component.
const origin = "http://127.0.0.1:5173";
const clinic = {
  clinicId: "aaaaaaaa-0000-4000-8000-000000000101",
  locationId: "aaaaaaaa-0000-4000-8000-000000000102",
  name: "Synthetic approved clinic",
  actions: ["orders:read"],
};

for (const directory of ["ready", "empty", "denied", "invalid"] as const) {
  test(`actual staff root uses approved commerce directory: ${directory}`, async ({ page }) => {
    const reads: string[] = [];
    await page.route("http://127.0.0.1:8787/v1/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Cache-Control": "no-store",
      };
      if (path === "/v1/session")
        return route.fulfill({
          headers,
          json: {
            userId: "dbdfb43b-cde1-4102-95ce-ab0654d1b6cc",
            expiresAt: "2099-01-01T00:00:00Z",
            workspaces: ["staff"],
          },
        });
      if (path === "/v1/staff/commerce/clinics")
        return route.fulfill({
          headers,
          status: directory === "denied" ? 403 : 200,
          json: {
            items:
              directory === "empty" ? [] : directory === "invalid" ? [clinic, clinic] : [clinic],
          },
        });
      if (path === `/v1/staff/clinics/${clinic.clinicId}/orders`) {
        reads.push(path);
        return route.fulfill({
          headers,
          json: {
            ...staffCommerceOrderPage,
            items: staffCommerceOrderPage.items.map((order) => ({
              ...order,
              locationId: clinic.locationId,
            })),
          },
        });
      }
      if (/\/v1\/staff\/clinics\//.test(path)) reads.push(path);
      return route.fulfill({ headers, status: 503, json: {} });
    });
    await page.goto(`${origin}/staff`);
    const root = page.locator("[data-commerce-directory-state]");
    await expect(root).toHaveAttribute(
      "data-commerce-directory-state",
      directory === "invalid" ? "error" : directory,
    );
    if (directory !== "ready") {
      await expect(page.getByTestId("staff-clinic-select")).toHaveCount(0);
      expect(reads).toEqual([]);
      return;
    }
    expect(reads).toEqual([]);
    await page.getByTestId("staff-clinic-select").selectOption(clinic.clinicId);
    const table = page.getByRole("table");
    await expect(
      table.getByRole("cell", { name: staffCommerceIds.order, exact: true }),
    ).toBeVisible();
    await expect(table.getByRole("cell", { name: clinic.name, exact: true })).toBeVisible();
    expect(reads).toEqual([`/v1/staff/clinics/${clinic.clinicId}/orders`]);
    await page.getByRole("button", { name: "Batches", exact: true }).click();
    await expect(page.locator("[data-staff-state]")).toHaveAttribute("data-staff-state", "denied");
    await page.getByRole("button", { name: "Doctor schedules", exact: true }).click();
    await expect(page.locator("[data-staff-state]")).toHaveAttribute(
      "data-staff-state",
      "unavailable",
    );
    expect(reads).toHaveLength(1);
  });
}
