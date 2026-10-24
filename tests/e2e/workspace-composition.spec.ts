import { expect, type Page, test } from "@playwright/test";
import { context as securityContext, session as sensitiveSession } from "../fixtures/sensitive";
import {
  booking,
  session as customerSession,
  directory,
  ids,
  now,
  runtimeMetadata,
  runtimeOffers,
  selection,
} from "../unit/customer-booking-fixtures";

const origin = "http://127.0.0.1:5173";
test("actual root Companion remains usable after development StrictMode effect restart", async ({
  page,
}) => {
  let submitted = 0;
  const headers = {
    "Access-Control-Allow-Origin": "http://127.0.0.1:5184",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type,X-CSRF-Token,Idempotency-Key",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Cache-Control": "no-store",
  };
  await page.route("http://127.0.0.1:8787/v1/session", (route) =>
    route.fulfill({ json: sensitiveSession, headers }),
  );
  await page.route("http://127.0.0.1:8788/v1/**", (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const path = new URL(request.url()).pathname;
    if (path === "/v1/security/context") return route.fulfill({ json: securityContext, headers });
    if (path === "/v1/chat/replies" && request.method() === "POST") {
      submitted++;
      expect(request.headers()["x-csrf-token"]).toBe(securityContext.csrfToken);
      return route.fulfill({
        status: 503,
        headers,
        json: { error: { code: "FEATURE_UNAVAILABLE" } },
      });
    }
    return route.fulfill({
      status: 503,
      headers,
      json: { error: { code: "FEATURE_UNAVAILABLE" } },
    });
  });
  await page.goto("http://127.0.0.1:5184/workspace.html");
  const companion = page.locator("[data-chat-state]");
  await companion.getByLabel("Editable message draft").fill("Synthetic public information request");
  await companion.getByRole("button", { name: "Send reviewed message" }).click();
  await expect.poll(() => submitted).toBe(1);
  await expect(companion).toHaveAttribute("data-chat-state", "unavailable");
});
async function session(page: Page, workspaces: string[]) {
  await page.route("http://127.0.0.1:8787/v1/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({
        userId: "dbdfb43b-cde1-4102-95ce-ab0654d1b6cc",
        expiresAt: "2099-01-01T00:00:00Z",
        workspaces,
      }),
    }),
  );
}

test("nested customer routes mount the real views only within verified grants", async ({
  page,
}) => {
  await session(page, ["customer"]);
  await page.goto(`${origin}/customer/appointments`);
  await expect(page.locator("[data-session-state]")).toHaveAttribute("data-session-state", "ready");
  await expect(page.getByRole("link", { name: "Consultations", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator(".customer-booking")).toBeVisible();
  await page.goto(`${origin}/staff/knowledge`);
  await expect(page.locator("[data-session-state]")).toHaveAttribute(
    "data-session-state",
    "denied",
  );
  await expect(page.locator(".content-editor")).toHaveCount(0);
  await expect(page.locator(".staff-read")).toHaveCount(0);
});

test("staff knowledge root mounts the editor without inventing records or authority", async ({
  page,
}) => {
  await session(page, ["staff"]);
  await page.goto(`${origin}/staff/knowledge`);
  await expect(page.getByRole("heading", { name: "Knowledge editor", exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Source/authoring integration pending. Browser authoring requires the same approved Core and Companion origin.",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Entry ID", exact: true })).toBeVisible();
  await expect(page.locator(".content-editor").getByRole("textbox")).toHaveCount(0);
});

test("unknown deep routes cannot fall back to a ready private or overview surface", async ({
  page,
}) => {
  await session(page, ["customer", "staff"]);
  await page.goto(`${origin}/staff/knowledge/unknown`);
  await expect(page.locator("[data-session-state]")).toHaveAttribute(
    "data-session-state",
    "unavailable",
  );
  await expect(page.locator(".content-editor, .staff-read, .customer-booking")).toHaveCount(0);
  await expect(page.getByLabel("Editable message draft")).toHaveCount(0);
});
test("a physician-only session reaches its knowledge surface without being granted staff access", async ({
  page,
}) => {
  await session(page, ["physician"]);
  await page.goto(`${origin}/physician/knowledge`);
  await expect(page.locator("[data-session-state]")).toHaveAttribute("data-session-state", "ready");
  await expect(page.getByRole("textbox", { name: "Entry ID", exact: true })).toHaveCount(1);
  await expect(page.getByRole("textbox", { name: "Entry ID", exact: true })).toBeVisible();
  await page.goto(`${origin}/staff/knowledge`);
  await expect(page.locator("[data-session-state]")).toHaveAttribute(
    "data-session-state",
    "denied",
  );
  await expect(page.getByRole("textbox", { name: "Entry ID", exact: true })).toHaveCount(0);
});

for (const contextMatches of [true, false]) {
  test(`actual workspace booking root ${contextMatches ? "persists through" : "rejects mismatched"} synthetic CSRF authority`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date(now) });
    let metadataReads = 0;
    const holds: { bookingId: string; operationId: string; request: unknown }[] = [];
    await page.route("http://127.0.0.1:8787/v1/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type,X-CSRF-Token,Idempotency-Key",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Cache-Control": "no-store",
      };
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      if (path === "/v1/session") return route.fulfill({ json: customerSession, headers });
      if (path === "/v1/booking-metadata") {
        metadataReads++;
        return route.fulfill({ json: runtimeMetadata, headers });
      }
      if (path === "/v1/doctors")
        return route.fulfill({ json: { doctors: directory.doctors }, headers });
      if (path === "/v1/booking-offers") return route.fulfill({ json: runtimeOffers, headers });
      if (path === "/v1/security/context")
        return route.fulfill({
          json: {
            userId: contextMatches ? customerSession.userId : ids[11],
            sessionId: "20000000-0000-4000-8000-000000000001",
            csrfToken: "synthetic-csrf-context-token-for-root-test",
            expiresAt: customerSession.expiresAt,
          },
          headers,
        });
      if (path === "/v1/bookings" && request.method() === "POST") {
        expect(request.headers()["x-csrf-token"]).toBe(
          "synthetic-csrf-context-token-for-root-test",
        );
        const body = request.postDataJSON();
        holds.push(body);
        return route.fulfill({
          json: { persisted: true, booking: { ...booking, id: body.bookingId } },
          headers,
        });
      }
      return route.fulfill({
        status: 503,
        json: { error: { code: "FEATURE_UNAVAILABLE" } },
        headers,
      });
    });
    await page.goto(`${origin}/customer/appointments`);
    await page
      .getByRole("combobox", { name: "Clinic", exact: true })
      .selectOption(selection.clinicId);
    await page
      .getByRole("combobox", { name: "Doctor", exact: true })
      .selectOption(selection.doctorId);
    await page
      .getByRole("combobox", { name: "Service", exact: true })
      .selectOption(selection.serviceId);
    await page.getByRole("button", { name: "Hold this appointment" }).click();
    if (contextMatches) {
      await expect(
        page.getByRole("region", { name: "Appointment held — payment verification pending" }),
      ).toBeVisible();
      expect(holds).toHaveLength(1);
      expect(metadataReads).toBeGreaterThanOrEqual(2);
    } else {
      await expect(
        page
          .locator(".customer-booking")
          .getByText("We could not check access. Try again.", { exact: true }),
      ).toBeVisible();
      expect(holds).toHaveLength(0);
      await expect(
        page.getByRole("region", { name: "Appointment held — payment verification pending" }),
      ).toHaveCount(0);
    }
  });
}
