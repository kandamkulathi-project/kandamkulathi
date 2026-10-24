import { expect, type Page, type Route, test } from "@playwright/test";
import {
  appointment,
  choices,
  consents,
  context,
  grant,
  payment,
  receipt,
  reference,
  session,
} from "../fixtures/sensitive";

const origin = "http://127.0.0.1:5173";
const api = "http://127.0.0.1:8787";
const headers = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Credentials": "true",
  "Cache-Control": "no-store",
};
async function fixture(page: Page, workspaces = session.workspaces) {
  // Explicit test-only fixtures. These do not prove authentication, financial state, RLS or provider acceptance.
  await page.route(`${api}/v1/session`, (route) =>
    route.fulfill({
      contentType: "application/json",
      headers,
      body: JSON.stringify({ ...session, workspaces }),
    }),
  );
  await page.route(`${api}/v1/security/context`, (route) =>
    route.fulfill({ contentType: "application/json", headers, body: JSON.stringify(context) }),
  );
}
async function choose(page: Page, button: string) {
  await page.getByLabel("Private record reference", { exact: true }).fill(reference);
  await page.getByRole("button", { name: button, exact: true }).click();
}
async function noPrivateStorage(page: Page) {
  expect(
    await page.evaluate(async () => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
      caches: await caches.keys(),
      databases: (await indexedDB.databases()).map((db) => db.name),
    })),
  ).toEqual({ local: [], session: [], caches: [], databases: [] });
}
test("real Core rejects unavailable sensitive mutations while credentialed preflight remains restricted", async ({
  page,
}) => {
  // No route interception: this sends real OPTIONS and POST requests to the actual local Worker.
  await page.goto(`${origin}/customer`);
  const result = await page.evaluate(async () => {
    const response = await fetch(
      "http://127.0.0.1:8787/v1/payments/10000000-0000-4000-8000-000000000001/reconcile",
      {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": "synthetic-not-a-real-token",
          "Idempotency-Key": "20000000-0000-4000-8000-000000000002",
        },
        body: "{}",
      },
    );
    return {
      status: response.status,
      body: await response.json(),
      cache: response.headers.get("Cache-Control"),
    };
  });
  expect(result).toMatchObject({
    status: 503,
    body: { error: { code: "IDENTITY_UNAVAILABLE" } },
    cache: "no-store",
  });
  await expect(page.locator("[data-session-state]")).toHaveAttribute(
    "data-session-state",
    "unavailable",
  );
  await expect(page.getByRole("button", { name: "Pay current total" })).toHaveCount(0);
  await noPrivateStorage(page);
});
test("versioned required consent is independent of optional marketing and private policy text is escaped", async ({
  page,
}) => {
  await fixture(page);
  let saved: unknown;
  await page.route(`${api}/v1/consents/current`, (route) =>
    route.fulfill({
      contentType: "application/json",
      headers,
      body: JSON.stringify({
        ...consents,
        privacyText: "<img src=x onerror=alert(1)> Synthetic privacy text",
      }),
    }),
  );
  await page.route(`${api}/v1/consents`, async (route) => {
    saved = route.request().postDataJSON();
    expect(route.request().headers()["x-csrf-token"]).toBe(context.csrfToken);
    expect(route.request().headers()["idempotency-key"]).toMatch(/^[a-f0-9-]{36}$/);
    await route.fulfill({
      contentType: "application/json",
      headers,
      body: JSON.stringify({ ...consents, ...choices }),
    });
  });
  await page.goto(`${origin}/customer`);
  await page.getByRole("button", { name: "Load current consent versions" }).click();
  await expect(page.getByRole("button", { name: "Save consent choices" })).toBeDisabled();
  await page.getByLabel("I accept the required account terms", { exact: true }).check();
  await expect(page.getByRole("button", { name: "Save consent choices" })).toBeDisabled();
  await page.getByLabel("I accept the required privacy policy", { exact: true }).check();
  await expect(page.getByLabel("Optional: receive marketing messages")).not.toBeChecked();
  await expect(
    page.getByLabel("I consent to the consultation (required for clinical access)"),
  ).not.toBeChecked();
  await expect(page.locator("[data-sensitive-state] img")).toHaveCount(0);
  await page.getByRole("button", { name: "Save consent choices" }).click();
  await expect.poll(() => saved).toEqual(choices);
  await noPrivateStorage(page);
});
test("hide and show revalidates the session and recreates a usable sensitive client", async ({
  page,
}) => {
  await fixture(page);
  let reads = 0;
  await page.route(`${api}/v1/consents/current`, (route) => {
    reads++;
    return route.fulfill({
      contentType: "application/json",
      headers,
      body: JSON.stringify(consents),
    });
  });
  await page.goto(`${origin}/customer`);
  const load = page.getByRole("button", { name: "Load current consent versions" });
  const accept = page.getByLabel("I accept the required account terms", { exact: true });
  await load.click();
  await expect(accept).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(accept).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("[data-session-state]")).toHaveAttribute("data-session-state", "ready");
  await expect(accept).toHaveCount(0); // Private state does not silently return.
  await load.click();
  await expect(accept).toBeVisible();
  expect(reads).toBe(2);
  await noPrivateStorage(page);
});

test("completed consent actions get new keys under durable server replay", async ({ page }) => {
  await fixture(page);
  let current = { ...consents, ...choices };
  const replay = new Map<string, typeof current>();
  await page.route(`${api}/v1/consents/current`, (route) =>
    route.fulfill({
      contentType: "application/json",
      headers,
      body: JSON.stringify(current),
    }),
  );
  await page.route(`${api}/v1/consents`, (route) => {
    const key = route.request().headers()["idempotency-key"] ?? "";
    expect(key).not.toBe("");
    if (!replay.has(key)) {
      current = { ...current, ...route.request().postDataJSON() };
      replay.set(key, current);
    }
    return route.fulfill({
      contentType: "application/json",
      headers,
      body: JSON.stringify(replay.get(key)),
    });
  });
  await page.goto(`${origin}/customer`);
  await page.getByRole("button", { name: "Load current consent versions" }).click();
  const consultation = page.getByLabel(
    "I consent to the consultation (required for clinical access)",
  );
  await expect(consultation).not.toBeChecked();
  for (const accepted of [false, true, false]) {
    await consultation.setChecked(accepted);
    await page.getByRole("button", { name: "Save consent choices" }).click();
    await expect(page.locator("[data-sensitive-state]")).toHaveAttribute(
      "data-sensitive-state",
      "current",
    );
    await expect.poll(() => current.consultationAccepted).toBe(accepted);
    await expect(consultation).toBeChecked({ checked: accepted });
  }
  expect(replay.size).toBe(3);
  await noPrivateStorage(page);
});

test("receipt-free reconciliation sees a later paid state with a replaying backend", async ({
  page,
}) => {
  await fixture(page);
  const replay = new Map<string, unknown>();
  let verifications = 0;
  await page.route(`${api}/v1/payments/${reference}`, (route) =>
    route.fulfill({
      contentType: "application/json",
      headers,
      body: JSON.stringify({ ...payment, checkout: null, status: "pending" }),
    }),
  );
  await page.route(`${api}/v1/payments/${reference}/reconcile`, (route) => {
    expect(route.request().postDataJSON()).toEqual({});
    const key = route.request().headers()["idempotency-key"] ?? "";
    expect(key).not.toBe("");
    if (!replay.has(key))
      replay.set(key, {
        ...payment,
        checkout: null,
        status: ++verifications === 1 ? "pending" : "paid",
      });
    return route.fulfill({
      contentType: "application/json",
      headers,
      body: JSON.stringify(replay.get(key)),
    });
  });
  await page.goto(`${origin}/customer`);
  await choose(page, "Load payment");
  await page.getByRole("button", { name: "Reconcile payment", exact: true }).click();
  await expect.poll(() => verifications).toBe(1);
  await expect(page.locator("[data-payment-state]")).toHaveAttribute(
    "data-payment-state",
    "pending",
  );
  await page.getByRole("button", { name: "Reconcile payment", exact: true }).click();
  await expect(page.locator("[data-payment-state]")).toHaveAttribute("data-payment-state", "paid");
  expect(verifications).toBe(2);
  await noPrivateStorage(page);
});

test("real browser checkout adapter sends current options and reconciles SDK success to pending, then server paid", async ({
  page,
}) => {
  await fixture(page);
  let reconciliations = 0;
  await page.route(`${api}/v1/payments/${reference}`, (route) =>
    route.fulfill({ contentType: "application/json", headers, body: JSON.stringify(payment) }),
  );
  await page.route(`${api}/v1/payments/${reference}/reconcile`, async (route) => {
    reconciliations++;
    if (reconciliations === 1) expect(route.request().postDataJSON()).toEqual({ receipt });
    await route.fulfill({
      contentType: "application/json",
      headers,
      body: JSON.stringify({
        ...payment,
        checkout: null,
        status: reconciliations === 1 ? "pending" : "paid",
      }),
    });
  });
  // Execute the actual app adapter with the external provider replaced by a synthetic checkout.
  // This cannot establish Razorpay sandbox/native acceptance.
  await page.addInitScript((result) => {
    class SyntheticCheckout {
      private options: { handler(value: unknown): void; amount: number; order_id: string };
      constructor(options: { handler(value: unknown): void; amount: number; order_id: string }) {
        this.options = options;
      }
      open() {
        if (this.options.amount !== 19900 || this.options.order_id !== "order_synthetic")
          throw new Error("Wrong current quote");
        setTimeout(() => this.options.handler(result), 30);
      }
      close() {}
    }
    Object.defineProperty(window, "Razorpay", { value: SyntheticCheckout });
  }, receipt);
  await page.goto(`${origin}/customer`);
  await choose(page, "Load payment");
  await expect(page.getByText("₹199.00", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Pay current total", exact: true }).dblclick();
  await expect(page.locator("[data-payment-state]")).toHaveAttribute(
    "data-payment-state",
    "pending",
  );
  expect(reconciliations).toBe(1);
  await expect(page.getByText("Payment confirmed by server", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Reconcile payment", exact: true }).click();
  await expect(page.locator("[data-payment-state]")).toHaveAttribute("data-payment-state", "paid");
  await noPrivateStorage(page);
});
test("a changed quote stops SDK launch and a denied refresh clears a previously loaded record", async ({
  page,
}) => {
  await fixture(page);
  let reads = 0;
  await page.route(`${api}/v1/payments/${reference}`, (route) =>
    route.fulfill({
      contentType: "application/json",
      headers,
      body: JSON.stringify({ ...payment, revision: ++reads === 1 ? "quote-1" : "quote-2" }),
    }),
  );
  await page.route("https://checkout.razorpay.com/**", () => {
    throw new Error("Checkout must not load for a stale quote");
  });
  await page.goto(`${origin}/customer`);
  await choose(page, "Load payment");
  await page.getByRole("button", { name: "Pay current total", exact: true }).click();
  await expect(page.locator("[data-sensitive-state]")).toHaveAttribute(
    "data-sensitive-state",
    "conflict",
  );
  await expect(page.locator("[data-payment-state]")).toHaveCount(0);
  await choose(page, "Load payment");
  await page.route(`${api}/v1/payments/${reference}/reconcile`, (route) =>
    route.fulfill({ status: 403, contentType: "application/json", headers, body: "{}" }),
  );
  await page.getByRole("button", { name: "Reconcile payment", exact: true }).click();
  await expect(page.locator("[data-sensitive-state]")).toHaveAttribute(
    "data-sensitive-state",
    "denied",
  );
  await expect(page.locator("[data-payment-state]")).toHaveCount(0);
});
test("hold expiry and missing clinical identity never become confirmation or a private join", async ({
  page,
}) => {
  await fixture(page);
  await page.route(`${api}/v1/appointments/${reference}`, (route) =>
    route.fulfill({
      contentType: "application/json",
      headers,
      body: JSON.stringify({
        ...appointment,
        status: "held",
        holdExpiresAt: new Date(Date.now() + 1500).toISOString(),
        identityVerified: false,
        consentCurrent: false,
      }),
    }),
  );
  await page.goto(`${origin}/customer`);
  await choose(page, "Load appointment");
  await expect(page.locator("[data-booking-state]")).toHaveAttribute("data-booking-state", "held");
  await expect(
    page.getByRole("button", { name: "Check private consultation membership" }),
  ).toBeDisabled();
  await expect(page.locator("[data-booking-state]")).toHaveAttribute(
    "data-booking-state",
    "expired",
  );
  await expect(page.getByText("Appointment confirmed", { exact: true })).toHaveCount(0);
});
test("approved intake permits unknown answers only through server handoff and never generates a recommendation", async ({
  page,
}) => {
  await fixture(page);
  const required = { ...appointment, intake: { ...appointment.intake, status: "required" } };
  await page.route(`${api}/v1/appointments/${reference}`, (route) =>
    route.fulfill({ contentType: "application/json", headers, body: JSON.stringify(required) }),
  );
  let submitted: { answers: { disposition: string }[] } | undefined;
  await page.route(`${api}/v1/appointments/${reference}/intake`, async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      headers,
      body: JSON.stringify({
        ...appointment,
        intake: { ...appointment.intake, status: "handoff" },
      }),
    });
  });
  await page.goto(`${origin}/customer`);
  await choose(page, "Load appointment");
  for (const question of appointment.intake.questions)
    await expect(page.getByLabel(question.label, { exact: true })).toBeVisible();
  await page
    .getByLabel("Prefer not to answer: Synthetic medication question", { exact: true })
    .check();
  await page.getByRole("button", { name: "Submit for clinical review" }).click();
  await expect(
    page.getByText("Clarification or physician handoff is required before personalized guidance.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(submitted?.answers).toHaveLength(5);
  expect(submitted?.answers.map((answer) => answer.disposition)).toEqual([
    "unknown",
    "declined",
    "unknown",
    "unknown",
    "unknown",
  ]);
  await expect(
    page.getByRole("button", { name: "Check private consultation membership" }),
  ).toBeDisabled();
  await noPrivateStorage(page);
});
test("backgrounding clears loaded clinical summaries and a revoked assignment returns denied on refresh", async ({
  page,
}) => {
  await fixture(page, ["physician"]);
  await page.route(`${api}/v1/appointments/${reference}`, (route) =>
    route.fulfill({
      contentType: "application/json",
      headers,
      body: JSON.stringify({ ...appointment, role: "physician" }),
    }),
  );
  await page.goto(`${origin}/physician`);
  await choose(page, "Load appointment");
  await expect(
    page.getByText("Synthetic physician · Synthetic clinic · Synthetic consultation"),
  ).toBeVisible();
  await expect(page.getByLabel("Synthetic age question")).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    page.getByText("Synthetic physician · Synthetic clinic · Synthetic consultation"),
  ).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("[data-session-state]")).toHaveAttribute("data-session-state", "ready");
  await page.route(`${api}/v1/appointments/${reference}`, (route) =>
    route.fulfill({ status: 403, contentType: "application/json", headers, body: "{}" }),
  );
  await choose(page, "Load appointment");
  await expect(page.locator("[data-sensitive-state]")).toHaveAttribute(
    "data-sensitive-state",
    "denied",
  );
  await noPrivateStorage(page);
});
test("new sensitive controls remain usable in Malayalam and Tamil on a narrow screen", async ({
  page,
}) => {
  await fixture(page);
  await page.setViewportSize({ width: 360, height: 850 });
  await page.goto(`${origin}/customer`);
  for (const locale of ["ml", "ta"]) {
    await page.locator("header select").selectOption(locale);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.locator("[data-sensitive-state]")).toBeVisible();
  }
});
test("failed remote logout clears loaded private views without claiming revocation", async ({
  page,
}) => {
  await fixture(page);
  let sessionReads = 0;
  await page.route(`${api}/v1/session`, (route) => {
    sessionReads++;
    return route.fulfill({
      contentType: "application/json",
      headers,
      body: JSON.stringify(session),
    });
  });
  await page.route(`${api}/v1/payments/${reference}`, (route) =>
    route.fulfill({ contentType: "application/json", headers, body: JSON.stringify(payment) }),
  );
  await page.route(`${api}/v1/session/logout`, (route) =>
    route.fulfill({ status: 503, contentType: "application/json", headers, body: "{}" }),
  );
  await page.goto(`${origin}/customer`);
  await choose(page, "Load payment");
  await expect(page.locator("[data-payment-state]")).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.locator("[data-session-state]")).toHaveAttribute(
    "data-session-state",
    "anonymous",
  );
  await expect(page.locator("[data-payment-state]")).toHaveCount(0);
  await expect(page.getByText("Server session revoked.", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText(
      "Session ended. Sign in again. Remote sign-out is confirmed only by the server.",
      { exact: true },
    ),
  ).toBeVisible();
  const readsAfterLogout = sessionReads;
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })),
  );
  for (const hidden of [true, false]) {
    await page.evaluate((hidden) => {
      Object.defineProperty(document, "hidden", { configurable: true, value: hidden });
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    }, hidden);
    await expect(page.locator("[data-session-state]")).toHaveAttribute(
      "data-session-state",
      "anonymous",
    );
    await expect(page.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
    await expect(page.locator("[data-payment-state]")).toHaveCount(0);
  }
  expect(sessionReads).toBe(readsAfterLogout);
  // An explicit user action may check the still-valid server cookie; passive resume may not.
  await page.getByRole("button", { name: "Check access again", exact: true }).click();
  await expect(page.locator("[data-session-state]")).toHaveAttribute("data-session-state", "ready");
  expect(sessionReads).toBe(readsAfterLogout + 1);
  await expect(page.locator("[data-payment-state]")).toHaveCount(0);
  await noPrivateStorage(page);
});
test("expiry closes checkout and ignores its late provider success without reconciliation", async ({
  page,
}) => {
  const expiresAt = new Date(Date.now() + 4500).toISOString();
  await fixture(page);
  await page.route(`${api}/v1/session`, (route) =>
    route.fulfill({
      contentType: "application/json",
      headers,
      body: JSON.stringify({ ...session, expiresAt }),
    }),
  );
  await page.route(`${api}/v1/security/context`, (route) =>
    route.fulfill({
      contentType: "application/json",
      headers,
      body: JSON.stringify({ ...context, expiresAt }),
    }),
  );
  await page.route(`${api}/v1/payments/${reference}`, (route) =>
    route.fulfill({ contentType: "application/json", headers, body: JSON.stringify(payment) }),
  );
  let reconciliations = 0;
  await page.route(`${api}/v1/payments/${reference}/reconcile`, async (route) => {
    reconciliations++;
    await route.fulfill({ status: 503, headers, body: "{}" });
  });
  await page.addInitScript(() => {
    class SyntheticCheckout {
      constructor(options: { handler(value: unknown): void }) {
        Object.defineProperty(window, "lateCheckout", { value: options.handler });
      }
      open() {
        Object.defineProperty(window, "checkoutOpened", { value: true });
      }
      close() {
        Object.defineProperty(window, "checkoutClosed", { value: true });
      }
    }
    Object.defineProperty(window, "Razorpay", { value: SyntheticCheckout });
  });
  await page.goto(`${origin}/customer`);
  await choose(page, "Load payment");
  await page.getByRole("button", { name: "Pay current total", exact: true }).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "checkoutOpened"))).toBe(true);
  await expect(page.locator("[data-session-state]")).toHaveAttribute(
    "data-session-state",
    "anonymous",
    { timeout: 7000 },
  );
  expect(await page.evaluate(() => Reflect.get(window, "checkoutClosed"))).toBe(true);
  await page.evaluate((value) => {
    const handler: (data: unknown) => void = Reflect.get(window, "lateCheckout");
    handler(value);
  }, receipt);
  await expect(page.locator("[data-payment-state]")).toHaveCount(0);
  expect(reconciliations).toBe(0);
  await noPrivateStorage(page);
});
test("a visible physician summary is cleared when periodic refresh observes revoked assignment", async ({
  page,
}) => {
  await page.clock.install();
  await fixture(page, ["physician"]);
  let reads = 0;
  await page.route(`${api}/v1/appointments/${reference}`, (route) =>
    route.fulfill({
      status: ++reads === 1 ? 200 : 403,
      contentType: "application/json",
      headers,
      body: reads === 1 ? JSON.stringify({ ...appointment, role: "physician" }) : "{}",
    }),
  );
  await page.goto(`${origin}/physician`);
  await choose(page, "Load appointment");
  await expect(page.locator("[data-booking-state]")).toHaveAttribute(
    "data-booking-state",
    "confirmed",
  );
  await page.clock.fastForward(15001);
  await expect(page.locator("[data-sensitive-state]")).toHaveAttribute(
    "data-sensitive-state",
    "denied",
  );
  await expect(page.locator("[data-booking-state]")).toHaveCount(0);
  expect(reads).toBe(2);
});
test("explicit checkout loads the fixed official script and cancellation still reconciles", async ({
  page,
}) => {
  await fixture(page);
  let scripts = 0;
  await page.route("https://checkout.razorpay.com/v1/checkout.js", async (route) => {
    scripts++;
    await route.fulfill({
      contentType: "application/javascript",
      body: "window.Razorpay = class { constructor(options) { this.options = options; } open() { this.options.modal.ondismiss(); } close() {} };",
    });
  });
  await page.route(`${api}/v1/payments/${reference}`, (route) =>
    route.fulfill({ contentType: "application/json", headers, body: JSON.stringify(payment) }),
  );
  let reconciled = false;
  await page.route(`${api}/v1/payments/${reference}/reconcile`, async (route) => {
    expect(route.request().postDataJSON()).toEqual({});
    reconciled = true;
    await route.fulfill({
      contentType: "application/json",
      headers,
      body: JSON.stringify({ ...payment, checkout: null, status: "pending" }),
    });
  });
  await page.goto(`${origin}/customer`);
  await choose(page, "Load payment");
  expect(scripts).toBe(0);
  await page.getByRole("button", { name: "Pay current total", exact: true }).click();
  await expect(page.locator("[data-payment-state]")).toHaveAttribute(
    "data-payment-state",
    "pending",
  );
  expect(scripts).toBe(1);
  expect(reconciled).toBe(true);
  await expect(
    page.locator('script[src="https://checkout.razorpay.com/v1/checkout.js"]'),
  ).toHaveAttribute("referrerpolicy", "no-referrer");
});
test("valid membership stays private and reports transport pending without acquiring media", async ({
  page,
}) => {
  await fixture(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        Object.defineProperty(window, "unexpectedMedia", { value: true });
        throw new Error("Must not acquire media before transport integration");
      },
    });
  });
  await page.route(`${api}/v1/appointments/${reference}`, (route) =>
    route.fulfill({ contentType: "application/json", headers, body: JSON.stringify(appointment) }),
  );
  await page.route(`${api}/v1/appointments/${reference}/video-grants`, (route) =>
    route.fulfill({
      contentType: "application/json",
      headers,
      body: JSON.stringify({ ...grant, expiresAt: new Date(Date.now() + 60000).toISOString() }),
    }),
  );
  await page.goto(`${origin}/customer`);
  await choose(page, "Load appointment");
  await page
    .getByRole("button", { name: "Check private consultation membership", exact: true })
    .click();
  await expect(page.locator("[data-sensitive-state]")).toHaveAttribute(
    "data-sensitive-state",
    "transportPending",
  );
  await expect(page.locator("body")).not.toContainText(grant.ticket);
  expect(await page.evaluate(() => Reflect.get(window, "unexpectedMedia"))).toBeUndefined();
  await noPrivateStorage(page);
});
test("a checkout expiring during SDK download cannot launch the provider", async ({ page }) => {
  await page.clock.install();
  await fixture(page);
  let expiresAt = "";
  let pendingScript: Route | undefined;
  await page.route("https://checkout.razorpay.com/v1/checkout.js", (route) => {
    pendingScript = route;
  });
  await page.route(`${api}/v1/payments/${reference}`, (route) =>
    route.fulfill({
      contentType: "application/json",
      headers,
      body: JSON.stringify({ ...payment, expiresAt }),
    }),
  );
  await page.route(`${api}/v1/payments/${reference}/reconcile`, (route) =>
    route.fulfill({
      contentType: "application/json",
      headers,
      body: JSON.stringify({ ...payment, expiresAt, status: "expired", checkout: null }),
    }),
  );
  await page.goto(`${origin}/customer`);
  expiresAt = await page.evaluate(() => new Date(Date.now() + 5000).toISOString());
  await choose(page, "Load payment");
  await page.getByRole("button", { name: "Pay current total", exact: true }).click();
  await expect.poll(() => Boolean(pendingScript)).toBe(true);
  await page.clock.fastForward(6000);
  if (!pendingScript) throw new Error("Checkout script request was not observed");
  await pendingScript.fulfill({
    contentType: "application/javascript",
    body: "window.Razorpay = class { constructor(options) { this.options = options; } open() { window.expiredCheckoutOpened = true; this.options.modal.ondismiss(); } close() {} };",
  });
  await expect(page.locator("[data-payment-state]")).toHaveAttribute(
    "data-payment-state",
    "expired",
  );
  expect(await page.evaluate(() => Reflect.get(window, "expiredCheckoutOpened"))).toBeUndefined();
});
