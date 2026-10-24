import { expect, type Page, type Route, test } from "@playwright/test";
import { knowledgeDraft } from "../fixtures/knowledge";
import { consents, context, payment, receipt, reference, session } from "../fixtures/sensitive";

const web = "http://127.0.0.1:15374";
const api = "http://127.0.0.1:8787";
const headers = { "Access-Control-Allow-Origin": web, "Access-Control-Allow-Credentials": "true" };
const json = (route: Route, data: unknown, status = 200) =>
  route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(data) });

async function fixtures(page: Page, staff = false) {
  // Legacy sensitive/editor DTOs are synthetic: these are NOT backend acceptance tests.
  await page.route(`${api}/v1/session`, (route) =>
    json(route, staff ? { ...session, workspaces: ["staff"] } : session),
  );
  await page.route(`${api}/v1/security/context`, (route) => json(route, context));
}
async function harness(page: Page) {
  await page.goto(`${web}/__strict-lifecycle`);
}

test("actual Vite DEV StrictMode application sends consent requests after replay", async ({
  page,
}) => {
  await fixtures(page);
  let reads = 0;
  await page.route(`${api}/v1/consents/current`, (route) => {
    reads++;
    return json(route, consents);
  });
  await page.goto(`${web}/customer`);
  await expect(page.locator('[data-session-state="ready"]')).toBeVisible();
  // Prove this was dev source, not a production-preview build.
  expect(await page.locator('script[src="/@vite/client"]').count()).toBe(1);
  await page.getByRole("button", { name: "Load current consent versions" }).click();
  await expect(page.locator("[data-sensitive-state]")).toHaveAttribute(
    "data-sensitive-state",
    "current",
  );
  await expect(
    page.getByLabel("I accept the required account terms", { exact: true }),
  ).toBeVisible();
  expect(reads).toBe(1);
});

test("Vite DEV StrictMode sensitive mount with an existing session sends fresh consent HTTP", async ({
  page,
}) => {
  await fixtures(page);
  let reads = 0;
  await page.route(`${api}/v1/consents/current`, (route) => {
    reads++;
    return json(route, consents);
  });
  await harness(page);
  await page.getByRole("button", { name: "Load current consent versions" }).click();
  await expect(page.locator("[data-sensitive-state]")).toHaveAttribute(
    "data-sensitive-state",
    "current",
  );
  expect(reads).toBe(1);
});

test("Vite DEV StrictMode editor loads and saves after replay; invalid references never request", async ({
  page,
}) => {
  await fixtures(page, true);
  let reads = 0;
  let saves = 0;
  await page.route(`${api}/v1/knowledge/drafts/${reference}`, (route) => {
    reads++;
    return json(route, knowledgeDraft);
  });
  await page.route(`${api}/v1/knowledge/drafts`, (route) => {
    saves++;
    expect(route.request().headers()["x-csrf-token"]).toBe(context.csrfToken);
    expect(route.request().headers()["idempotency-key"]).toMatch(/^[a-f0-9-]{36}$/);
    return json(route, {
      ...knowledgeDraft,
      revision: 2,
      document: route.request().postDataJSON().document,
    });
  });
  // The integrated staff route deliberately renders the newer pending-policy editor instead.
  // Exercise this legacy component directly without inventing an integration or changing routing.
  await harness(page);
  const editor = page.locator("[data-editor-state]");
  await editor.getByLabel("Knowledge reference", { exact: true }).fill("invalid");
  await expect(editor.getByRole("button", { name: "Load current draft" })).toBeDisabled();
  expect(reads).toBe(0);
  await editor.getByLabel("Knowledge reference", { exact: true }).fill(reference);
  await editor.getByRole("button", { name: "Load current draft" }).click();
  await expect(editor).toHaveAttribute("data-editor-state", "current");
  await editor.getByLabel("Title", { exact: true }).fill("Synthetic StrictMode revision");
  await editor.getByRole("button", { name: "Save as draft", exact: true }).click();
  await expect(editor.locator("[data-knowledge-status]")).toContainText("v2");
  expect({ reads, saves }).toEqual({ reads: 1, saves: 1 });
});

test("replayed checkout launches; real unmount closes it and blocks late callbacks, then fresh remount pays", async ({
  page,
}) => {
  await fixtures(page);
  await page.route(`${api}/v1/payments/${reference}`, (route) => json(route, payment));
  let reconciles = 0;
  await page.route(`${api}/v1/payments/${reference}/reconcile`, (route) => {
    reconciles++;
    return json(route, { ...payment, status: "paid", checkout: null });
  });
  await page.addInitScript(() => {
    const events: string[] = [];
    const callbacks: (() => void)[] = [];
    Object.assign(window, { lifecycleSDK: { events, callbacks } });
    window.Razorpay = class {
      constructor(options: { handler(value: unknown): void }) {
        callbacks.push(() =>
          options.handler({
            razorpay_order_id: "order_synthetic",
            razorpay_payment_id: "pay_synthetic",
            razorpay_signature: "a".repeat(64),
          }),
        );
      }
      open() {
        events.push("open");
      }
      close() {
        events.push("close");
      }
    };
  });
  await harness(page);
  const load = async () => {
    await page.getByLabel("Private record reference", { exact: true }).fill(reference);
    await page.getByRole("button", { name: "Load payment", exact: true }).click();
    await page.getByRole("button", { name: "Pay current total" }).click();
  };
  const events = () => page.evaluate(() => Reflect.get(window, "lifecycleSDK").events);
  await load();
  await expect.poll(events).toEqual(["open"]);
  await page.getByRole("button", { name: "Toggle private components" }).click();
  await expect.poll(events).toEqual(["open", "close"]);
  await page.getByRole("button", { name: "Toggle private components" }).click();
  await load();
  await expect.poll(events).toEqual(["open", "close", "open"]);
  await page.evaluate(() => Reflect.get(window, "lifecycleSDK").callbacks[0]());
  expect(reconciles).toBe(0);
  await page.evaluate(() => Reflect.get(window, "lifecycleSDK").callbacks[1]());
  await expect(page.locator("[data-payment-state]")).toHaveAttribute("data-payment-state", "paid");
  expect(reconciles).toBe(1);
  expect(receipt.razorpay_order_id).toBe(payment.checkout?.order_id);
});

for (const surface of ["consent", "draft"] as const) {
  test(`${surface}: background aborts a pending request and remount rejects its late response`, async ({
    page,
  }) => {
    await fixtures(page);
    const endpoint =
      surface === "consent" ? "/v1/consents/current" : `/v1/knowledge/drafts/${reference}`;
    let release: (() => void) | undefined;
    let requested = false;
    await page.route(`${api}${endpoint}`, async (route) => {
      requested = true;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await json(route, surface === "consent" ? consents : knowledgeDraft).catch(() => {});
    });
    await harness(page);
    if (surface === "draft")
      await page.getByLabel("Knowledge reference", { exact: true }).fill(reference);
    await page
      .getByRole("button", {
        name: surface === "consent" ? "Load current consent versions" : "Load current draft",
      })
      .click();
    await expect.poll(() => requested).toBe(true);
    const failed = page.waitForEvent(
      "requestfailed",
      (request) => request.url() === `${api}${endpoint}`,
    );
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await failed;
    await page.getByRole("button", { name: "Toggle private components" }).click();
    await page.getByRole("button", { name: "Toggle private components" }).click();
    release?.();
    await expect(
      page.locator(surface === "consent" ? "[data-sensitive-state]" : "[data-editor-state]"),
    ).toHaveAttribute(
      surface === "consent" ? "data-sensitive-state" : "data-editor-state",
      "pending",
    );
    await expect(
      page.getByLabel(surface === "consent" ? "I accept the required account terms" : "Title", {
        exact: true,
      }),
    ).toHaveCount(0);
  });
}

for (const surface of ["consent", "draft"] as const) {
  test(`${surface}: authorization denial and revocation clear private content after replay`, async ({
    page,
  }) => {
    await fixtures(page);
    let status = 200;
    const endpoint =
      surface === "consent" ? "/v1/consents/current" : `/v1/knowledge/drafts/${reference}`;
    await page.route(`${api}${endpoint}`, (route) =>
      json(route, surface === "consent" ? consents : knowledgeDraft, status),
    );
    await harness(page);
    const load = async () => {
      if (surface === "draft")
        await page.getByLabel("Knowledge reference", { exact: true }).fill(reference);
      await page
        .getByRole("button", {
          name: surface === "consent" ? "Load current consent versions" : "Load current draft",
        })
        .click();
    };
    const content = page.getByLabel(
      surface === "consent" ? "I accept the required account terms" : "Title",
      { exact: true },
    );
    const state = surface === "consent" ? "data-sensitive-state" : "data-editor-state";
    await load();
    await expect(content).toBeVisible();
    status = 403;
    await load();
    await expect(page.locator(`[${state}]`)).toHaveAttribute(state, "denied");
    await expect(content).toHaveCount(0);
    status = 401;
    await load();
    await expect(page.locator(`[${state}]`)).toHaveAttribute(state, "anonymous");
    await expect(content).toHaveCount(0);
    if (surface === "draft")
      await expect(page.getByLabel("Knowledge reference", { exact: true })).toHaveValue("");
  });
}
