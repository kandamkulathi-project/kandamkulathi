import { expect, type Page, test } from "@playwright/test";
import {
  booking,
  directory,
  ids,
  now,
  offer,
  ready,
  selection,
  session,
} from "../unit/customer-booking-fixtures";

const base = "http://127.0.0.1:5184";
async function fixtures(page: Page) {
  await page.clock.install({ time: new Date(now) });
  await page.route("**/__test/session", (route) => route.fulfill({ json: session }));
  await page.route("**/__test/booking/directory", (route) =>
    route.fulfill({ json: ready(directory) }),
  );
  await page.route("**/__test/booking/appointments", (route) =>
    route.fulfill({ json: ready({ serverNow: now, bookings: [] }) }),
  );
  await page.route("**/__test/booking/slots", (route) =>
    route.fulfill({ json: ready({ serverNow: now, offers: [offer] }) }),
  );
  await page.route("**/__test/booking/hold", (route) =>
    route.fulfill({ json: ready({ serverNow: now, booking }) }),
  );
  await page.route("**/__test/booking/read", (route) =>
    route.fulfill({
      json: ready({
        serverNow: "2026-10-24T09:02:00.000Z",
        booking: { ...booking, revision: 2, state: "expired" },
      }),
    }),
  );
}
async function choose(page: Page) {
  await page
    .getByRole("combobox", { name: "Clinic", exact: true })
    .selectOption(selection.clinicId);
  await page
    .getByRole("combobox", { name: "Doctor", exact: true })
    .selectOption(selection.doctorId);
  await page
    .getByRole("combobox", { name: "Service", exact: true })
    .selectOption(selection.serviceId);
}
test("authoritative hold, countdown, explicit server expiry and keyboard/mobile presentation", async ({
  page,
}, testInfo) => {
  await fixtures(page);
  await page.setViewportSize({ width: 360, height: 780 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/booking`);
  await choose(page);
  await expect(page.getByRole("button", { name: "Hold this appointment" })).toBeVisible();
  await page.getByRole("button", { name: "Hold this appointment" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Appointment held — payment verification pending", { exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(61000);
  await expect(
    page.getByText("Hold deadline reached. Check the server for the current status.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Confirmed by the server", { exact: true })).toHaveCount(0);
  await page
    .getByRole("region", { name: "Appointment held — payment verification pending" })
    .getByRole("button", { name: "Check current status" })
    .click();
  await expect(page.getByText("Hold expired", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("booking-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: testInfo.outputPath("booking-desktop.png"), fullPage: true });
});
test("conflict and malformed output never become a booking; explicit refresh recovers", async ({
  page,
}) => {
  await fixtures(page);
  await page.route("**/__test/booking/hold", (route) =>
    route.fulfill({ status: 409, json: { error: { code: "BOOKING_CONFLICT" } } }),
  );
  await page.goto(`${base}/booking`);
  await choose(page);
  await page.getByRole("button", { name: "Hold this appointment" }).click();
  await expect(page.getByRole("alert")).toContainText("no longer available");
  await page.getByRole("button", { name: "Check current status" }).first().click();
  await expect(page.getByRole("button", { name: "Hold this appointment" })).toBeVisible();
  await page.route("**/__test/booking/hold", (route) =>
    route.fulfill({ json: ready({ serverNow: now, booking: { ...booking, state: "confirmed" } }) }),
  );
  await page.getByRole("button", { name: "Hold this appointment" }).click();
  await expect(page.getByText(/The hold outcome is unknown/)).toBeVisible();
  await expect(page.getByText("Confirmed by the server", { exact: true })).toHaveCount(0);
});
test("revocation clears private appointments and malformed owner history is rejected", async ({
  page,
}) => {
  await fixtures(page);
  await page.route("**/__test/booking/appointments", (route) =>
    route.fulfill({
      json: ready({
        serverNow: now,
        bookings: [
          { ...booking, ownerId: ids[11], provenance: { source: "online", customerId: ids[11] } },
        ],
      }),
    }),
  );
  await page.goto(`${base}/booking`);
  await expect(page.getByRole("alert")).toContainText("could not check access");
  await expect(
    page.getByText("Appointment held — payment verification pending", { exact: true }),
  ).toHaveCount(0);
  await page.route("**/__test/booking/appointments", (route) =>
    route.fulfill({ status: 403, json: { error: { code: "FORBIDDEN" } } }),
  );
  await page.getByRole("button", { name: "Check current status" }).last().click();
  await expect(page.locator("[data-booking-state=denied]")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Clinic", exact: true })).toHaveCount(0);
});
test("unavailable directory has truthful retry; no fabricated slots or success", async ({
  page,
}) => {
  await fixtures(page);
  await page.route("**/__test/booking/directory", (route) =>
    route.fulfill({ status: 503, json: { error: { code: "BOOKING_UNAVAILABLE" } } }),
  );
  await page.goto(`${base}/booking`);
  await expect(page.getByText("This service is not available yet.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hold this appointment" })).toHaveCount(0);
  await page.route("**/__test/booking/directory", (route) =>
    route.fulfill({ json: ready(directory) }),
  );
  await page.getByRole("button", { name: "Check access again" }).click();
  await expect(page.getByRole("combobox", { name: "Clinic", exact: true })).toBeVisible();
});
