import { expect, test } from "@playwright/test";
import { bookingOffersQuerySchema } from "../../packages/contracts/src/booking-offers";
import {
  booking,
  directory,
  now,
  runtimeMetadata,
  runtimeOffers,
  selection,
  session,
} from "../unit/customer-booking-fixtures";

test("runtime booking uses canonical metadata/scopes/offers and trusted hold/read clock", async ({
  page,
}, testInfo) => {
  await page.clock.install({ time: new Date(now) });
  await page.route("**/__test/session", (route) => route.fulfill({ json: session }));
  let metadataCalls = 0;
  await page.route("**/v1/booking-metadata", (route) => {
    metadataCalls++;
    return route.fulfill({ json: runtimeMetadata });
  });
  await page.route("**/v1/doctors", (route) =>
    route.fulfill({ json: { doctors: directory.doctors } }),
  );
  await page.route("**/v1/booking-offers?*", (route) => {
    const params = Object.fromEntries(new URL(route.request().url()).searchParams);
    expect(bookingOffersQuerySchema.parse({ ...params, limit: Number(params.limit) })).toEqual({
      ...selection,
      modality: "online",
      from: now,
      until: "2026-10-25T09:00:00.000Z",
      limit: 50,
    });
    return route.fulfill({ json: runtimeOffers });
  });
  const bodies: { bookingId: string; operationId: string; request: unknown }[] = [];
  await page.route("**/v1/bookings", (route) => {
    const body = route.request().postDataJSON();
    expect(body.request).not.toHaveProperty("fee");
    expect(body.request).not.toHaveProperty("serverNow");
    bodies.push(body);
    return route.fulfill({
      json: { persisted: true, booking: { ...booking, id: body.bookingId } },
    });
  });
  await page.route("**/v1/bookings/*", (route) =>
    route.fulfill({ json: { persisted: true, booking: { ...booking, id: bodies[0]?.bookingId } } }),
  );
  await page.goto("http://127.0.0.1:5184/runtime-booking");
  await page
    .getByRole("combobox", { name: "Clinic", exact: true })
    .selectOption(selection.clinicId);
  await page
    .getByRole("combobox", { name: "Doctor", exact: true })
    .selectOption(selection.doctorId);
  await page
    .getByRole("combobox", { name: "Service", exact: true })
    .selectOption(selection.serviceId);
  await expect(page.getByText(/Only part of the current offer inventory/)).toBeVisible();
  await page.getByRole("button", { name: "Hold this appointment" }).click();
  const held = page.getByRole("region", {
    name: "Appointment held — payment verification pending",
  });
  await expect(held).toBeVisible();
  await held.getByRole("button", { name: "Check current status" }).click();
  await expect(held).toBeVisible();
  expect(bodies).toHaveLength(1);
  expect(metadataCalls).toBeGreaterThanOrEqual(3);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("runtime-booking-mobile.png"),
    fullPage: true,
  });
});
test("runtime metadata unavailable is explicit and malformed canonical offers never enable hold", async ({
  page,
}) => {
  await page.clock.install({ time: new Date(now) });
  await page.route("**/__test/session", (route) => route.fulfill({ json: session }));
  await page.route("**/v1/booking-metadata", (route) =>
    route.fulfill({ status: 503, json: { error: { code: "BOOKING_METADATA_UNAVAILABLE" } } }),
  );
  await page.goto("http://127.0.0.1:5184/runtime-booking");
  await expect(page.locator('[data-booking-state="unavailable"]')).toBeVisible();
  await page.route("**/v1/booking-metadata", (route) => route.fulfill({ json: runtimeMetadata }));
  await page.route("**/v1/doctors", (route) =>
    route.fulfill({ json: { doctors: directory.doctors } }),
  );
  await page.route("**/v1/booking-offers?*", (route) =>
    route.fulfill({
      json: { ...runtimeOffers, offers: [{ ...runtimeOffers.offers[0], slotId: "forged" }] },
    }),
  );
  await page.getByRole("button", { name: "Check access again", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Clinic", exact: true })
    .selectOption(selection.clinicId);
  await page
    .getByRole("combobox", { name: "Doctor", exact: true })
    .selectOption(selection.doctorId);
  await page
    .getByRole("combobox", { name: "Service", exact: true })
    .selectOption(selection.serviceId);
  await expect(page.getByRole("button", { name: "Hold this appointment" })).toHaveCount(0);
  await expect(
    page.getByText("We could not check access. Try again.", { exact: true }),
  ).toBeVisible();
});
