import { createHash } from "node:crypto";
import { expect, type Page, type Route, test } from "@playwright/test";
import { consentBootstrapLabels } from "../../packages/i18n/src/consent-bootstrap";

const actorId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const recordId = "33333333-3333-4333-8333-333333333333";
const text =
  "Synthetic approved-policy fixture ONLY.\n<b>This is plain policy text, not markup.</b>\nസ്വകാര്യത தனியுரிமை\n" +
  "Read this synthetic policy. ".repeat(30);
async function mount(
  page: Page,
  options: {
    bootstrapStatus?: number;
    invalidHash?: boolean;
    mismatch?: boolean;
    unknown?: boolean;
    afterStatus?: number;
    contextWait?: Promise<void>;
  } = {},
) {
  let posts = 0;
  const paths: string[] = [];
  const expiresAt = new Date(Date.now() + 120000).toISOString();
  const bootstrap = {
    actorId,
    sessionId,
    expiresAt,
    requirement: { purpose: "privacy", version: "synthetic-v1", actorId },
    policy: {
      text,
      revision: "synthetic-r1",
      approvalReference: "synthetic-only-no-legal-approval",
      sha256: options.invalidHash
        ? "0".repeat(64)
        : createHash("sha256").update(text).digest("hex"),
    },
  };
  const json = (route: Route, value: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify(value),
    });
  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    paths.push(path);
    if (path === "/v1/session")
      return posts
        ? json(
            route,
            { userId: actorId, expiresAt, workspaces: ["customer"] },
            options.afterStatus ?? 200,
          )
        : json(route, {}, 403);
    if (path === "/v1/consent-bootstrap")
      return json(route, bootstrap, options.bootstrapStatus ?? 200);
    if (path === "/v1/security/context") {
      await options.contextWait;
      return json(route, {
        userId: actorId,
        sessionId: options.mismatch ? recordId : sessionId,
        expiresAt,
        csrfToken: "synthetic_csrf_012345678901234567890123456789",
      });
    }
    expect(path).toBe("/v1/consents");
    expect(request.method()).toBe("POST");
    expect(request.headers()["x-csrf-token"]).toBe("synthetic_csrf_012345678901234567890123456789");
    expect(request.postDataJSON()).toEqual({
      requirement: bootstrap.requirement,
      decision: "granted",
    });
    posts++;
    return options.unknown ? route.abort("connectionreset") : json(route, { id: recordId }, 201);
  });
  await page.goto("/__test-consent-bootstrap");
  return { paths, posts: () => posts };
}
const review = (page: Page) =>
  page.getByRole("button", { name: "Review privacy policy", exact: true }).click();
test("DEV StrictMode: explicit read, exact plain text, checkbox, persisted consent and verified session", async ({
  page,
}) => {
  const fixture = await mount(page);
  expect(fixture.paths).toEqual([]);
  await review(page);
  await expect(page.locator(".consent-bootstrap-policy")).toHaveText(text);
  expect(await page.locator(".consent-bootstrap-policy").textContent()).toBe(text);
  await expect(page.locator(".consent-bootstrap-policy b")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Give consent and continue" })).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Give consent and continue" }).click();
  await expect(page.getByLabel("Verified callbacks")).toHaveText("1");
  expect(fixture.posts()).toBe(1);
  expect(fixture.paths).toEqual([
    "/v1/session",
    "/v1/consent-bootstrap",
    "/v1/security/context",
    "/v1/consents",
    "/v1/session",
  ]);
});
test("decline does not record; remount owns fresh resources", async ({ page }) => {
  const fixture = await mount(page);
  await review(page);
  await page.getByRole("button", { name: "Decline / cancel" }).click();
  await expect(page.locator(".consent-bootstrap").getByRole("status")).toHaveText(
    consentBootstrapLabels.en.cancelled,
  );
  expect(fixture.posts()).toBe(0);
  await page.getByRole("button", { name: "Toggle test mount" }).click();
  await page.getByRole("button", { name: "Toggle test mount" }).click();
  await review(page);
  await expect(page.getByRole("checkbox")).not.toBeChecked();
});
for (const status of [403, 503])
  test(`bootstrap ${status} is not a consent requirement`, async ({ page }) => {
    const fixture = await mount(page, { bootstrapStatus: status });
    await review(page);
    await expect(page.getByRole("alert")).toHaveText(
      status === 403 ? consentBootstrapLabels.en.denied : consentBootstrapLabels.en.unavailable,
    );
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    expect(fixture.posts()).toBe(0);
  });
test("policy integrity and actual context bindings fail closed", async ({ page }) => {
  await mount(page, { invalidHash: true });
  await review(page);
  await expect(page.getByRole("alert")).toHaveText(consentBootstrapLabels.en.error);
  await page.unroute("**/v1/**");
  const fixture = await mount(page, { mismatch: true });
  await review(page);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Give consent and continue" }).click();
  await expect(page.getByRole("alert")).toHaveText(consentBootstrapLabels.en.error);
  expect(fixture.posts()).toBe(0);
});
test("unknown result never repeats POST; explicit reload reconciles current session", async ({
  page,
}) => {
  const fixture = await mount(page, { unknown: true });
  await review(page);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Give consent and continue" }).click();
  await expect(page.getByRole("alert")).toHaveText(consentBootstrapLabels.en.unknown);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  expect(fixture.posts()).toBe(1);
  await page.getByRole("button", { name: "Reload session and policy" }).click();
  await expect(page.getByLabel("Verified callbacks")).toHaveText("1");
  expect(fixture.posts()).toBe(1);
});
test("201 does not imply workspace access", async ({ page }) => {
  await mount(page, { afterStatus: 403 });
  await review(page);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Give consent and continue" }).click();
  await expect(page.getByRole("alert")).toHaveText(consentBootstrapLabels.en.denied);
  await expect(page.getByLabel("Verified callbacks")).toHaveText("0");
});
test("unmount while context is pending prevents a late POST", async ({ page }) => {
  let release: (() => void) | undefined;
  const contextWait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fixture = await mount(page, { contextWait });
  await review(page);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Give consent and continue" }).click();
  await expect.poll(() => fixture.paths.includes("/v1/security/context")).toBe(true);
  await page.getByRole("button", { name: "Toggle test mount" }).click();
  release?.();
  await page.getByRole("button", { name: "Toggle test mount" }).click();
  await review(page);
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  expect(fixture.posts()).toBe(0);
});
test("desktop/mobile EN/ML/TA preserve policy text and reflow", async ({ page }) => {
  await mount(page);
  await review(page);
  for (const width of [1100, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ["en", "ml", "ta"] as const) {
      await page.getByRole("combobox").selectOption(locale);
      await expect(
        page.getByRole("heading", { name: consentBootstrapLabels[locale].title }),
      ).toBeVisible();
      expect(await page.locator(".consent-bootstrap-policy").textContent()).toBe(text);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/opencode/p1-web-consent-${width}-${locale}.png`,
        fullPage: true,
      });
    }
  }
  await page.getByRole("checkbox").focus();
  await expect(page.getByRole("checkbox")).toBeFocused();
});
