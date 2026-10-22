import { expect, type Page, type Route, test } from "@playwright/test";
import { foundation } from "../../packages/i18n/src/foundation";
import { knowledgeText } from "../../packages/i18n/src/knowledge";
import { entry, knowledgeDraft, reply } from "../fixtures/knowledge";
import { context, otherReference, reference, session } from "../fixtures/sensitive";

const web = "http://127.0.0.1:5173";
const core = "http://127.0.0.1:8787";
const companion = "http://127.0.0.1:8788";
const headers = {
  "Access-Control-Allow-Origin": web,
  "Access-Control-Allow-Credentials": "true",
  "Cache-Control": "no-store",
};
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) });
async function fixture(page: Page, workspaces = session.workspaces) {
  // Synthetic positive API contracts only. Actual Workers remain unavailable until Mathew's integration.
  await page.route(`${core}/v1/session`, (route) => json(route, { ...session, workspaces }));
  for (const api of [core, companion])
    await page.route(`${api}/v1/security/context`, (route) => json(route, context));
}
async function ask(page: Page) {
  await page
    .getByLabel("Editable message draft", { exact: true })
    .fill("Synthetic approved question");
  await page.getByRole("button", { name: "Send reviewed message", exact: true }).click();
}
async function noPrivateStorage(page: Page) {
  expect(
    await page.evaluate(async () => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
      caches: await caches.keys(),
      db: await indexedDB.databases(),
    })),
  ).toEqual({ local: [], session: [], caches: [], db: [] });
}

test("actual Companion and Core remain credentialed, uncached 503 services without invented chat success", async ({
  page,
}) => {
  await page.goto(web);
  const result = await page.evaluate(async () =>
    Promise.all(
      [8787, 8788].map(async (port) => {
        const response = await fetch(`http://127.0.0.1:${port}/v1/chat/replies`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        return {
          status: response.status,
          body: await response.json(),
          cache: response.headers.get("Cache-Control"),
        };
      }),
    ),
  );
  for (const response of result)
    expect(response).toMatchObject({
      status: 503,
      body: { error: { code: "FEATURE_UNAVAILABLE" } },
      cache: "no-store",
    });
  await expect(page.locator("[data-session-state]")).toHaveAttribute(
    "data-session-state",
    "unavailable",
  );
  await expect(page.locator("[data-chat-state] button").first()).toBeDisabled();
  await noPrivateStorage(page);
});

test("verified session reaches actual Companion unavailability through its real CORS policy", async ({
  page,
}) => {
  await fixture(page);
  // Remove just Companion context fixture: both context and mutation services are genuinely unavailable.
  await page.unroute(`${companion}/v1/security/context`);
  await page.goto(web);
  await ask(page);
  await expect(page.locator("[data-chat-state]")).toHaveAttribute("data-chat-state", "unavailable");
  await expect(page.locator("[data-approved-revision]")).toHaveCount(0);
});

test("only current approved cited plaintext and all safety blocks render; withdrawal removes them", async ({
  page,
}) => {
  await fixture(page);
  const content = {
    ...entry,
    document: { ...entry.document, body: "<img src=x onerror=alert(1)> Synthetic approved source" },
  };
  let withdrawn = false;
  await page.route(`${companion}/v1/chat/replies`, (route) => {
    expect(route.request().headers()["x-csrf-token"]).toBe(context.csrfToken);
    expect(route.request().postDataJSON().locale).toBe("en");
    return json(route, reply);
  });
  await page.route(`${companion}/v1/knowledge/approved/${reference}`, (route) =>
    json(route, { ...content, state: withdrawn ? "withdrawn" : "approved" }),
  );
  await page.goto(web);
  await ask(page);
  const article = page.locator("[data-approved-revision]");
  await expect(article).toHaveAttribute("data-approved-revision", "1");
  await expect(article).toContainText(content.document.body);
  await expect(article).toContainText("Approved by: Synthetic reviewing physician");
  await expect(article.locator("img, script, iframe")).toHaveCount(0);
  for (const value of Object.values(entry.document.safety))
    await expect(article).toContainText(value);
  await expect(article.getByRole("link")).toHaveAttribute("href", entry.document.sourceUrl);
  await expect(article.getByRole("link")).toHaveAttribute("rel", "noopener noreferrer");
  await expect(article.getByRole("link")).toHaveAttribute("referrerpolicy", "no-referrer");
  withdrawn = true;
  await page.getByRole("button", { name: "Recheck current sources" }).click();
  await expect(article).toHaveCount(0);
  await expect(page.locator("[data-chat-state]")).toHaveAttribute("data-chat-state", "unavailable");
  await noPrivateStorage(page);
});

for (const invalid of ["draft", "revision", "expired", "safety", "url", "generated"] as const) {
  test(`does not render ${invalid} knowledge or generated clinical prose`, async ({ page }) => {
    await fixture(page);
    await page.route(`${companion}/v1/chat/replies`, (route) =>
      json(
        route,
        invalid === "generated" ? { ...reply, text: "Synthetic unsafe generated advice" } : reply,
      ),
    );
    await page.route(`${companion}/v1/knowledge/approved/${reference}`, (route) =>
      json(route, {
        ...entry,
        ...(invalid === "draft" ? { state: "draft" } : {}),
        ...(invalid === "revision" ? { revision: 2 } : {}),
        ...(invalid === "expired" ? { reviewUntil: "2020-01-01T00:00:00Z" } : {}),
        ...(invalid === "safety"
          ? { document: { ...entry.document, safety: { ...entry.document.safety, warnings: "" } } }
          : {}),
        ...(invalid === "url"
          ? { document: { ...entry.document, sourceUrl: "javascript:alert(1)" } }
          : {}),
      }),
    );
    await page.goto(web);
    await ask(page);
    await expect(page.locator("[data-chat-state]")).toHaveAttribute(
      "data-chat-state",
      invalid === "generated" ? "unknown" : "unavailable",
    );
    await expect(page.locator("[data-approved-revision]")).toHaveCount(0);
    await expect(page.locator("[data-chat-state]")).not.toContainText(entry.document.body);
  });
}

test("AI action/intake proposals execute no action; human handoff requires a separate explicit request", async ({
  page,
}) => {
  await fixture(page);
  let kind = "action_required";
  let handoffs = 0;
  await page.route(`${companion}/v1/chat/replies`, (route) =>
    json(route, { kind, id: reference, locale: "en" }),
  );
  await page.route(`${companion}/v1/support/handoffs`, (route) => {
    handoffs++;
    return json(route, { id: reference, status: "queued" });
  });
  const forbidden: string[] = [];
  page.on("request", (request) => {
    if (/\/v1\/(payments|orders|appointments|voice)/.test(request.url()))
      forbidden.push(request.url());
  });
  await page.goto(web);
  await ask(page);
  await expect(page.locator("[data-chat-state]")).toContainText("No action was executed");
  expect(handoffs).toBe(0);
  kind = "intake_required";
  await ask(page);
  await expect(page.locator("[data-chat-state]")).toContainText(
    "approved identity, consent and intake process",
  );
  expect(handoffs).toBe(0);
  await page.getByRole("button", { name: "Request care-team help" }).click();
  await expect(page.locator("[data-chat-state]")).toContainText(
    "Request queued. A live agent has not joined.",
  );
  expect(handoffs).toBe(1);
  expect(forbidden).toEqual([]);
});

test("late chat responses cannot restore content or drafts after backgrounding", async ({
  page,
}) => {
  await fixture(page);
  let release!: () => void;
  const paused = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  await page.route(`${companion}/v1/chat/replies`, async (route) => {
    started = true;
    await paused;
    await json(route, reply).catch(() => {});
  });
  await page.route(`${companion}/v1/knowledge/approved/${reference}`, (route) =>
    json(route, entry),
  );
  await page.goto(web);
  await ask(page);
  await expect.poll(() => started).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  release();
  await expect(page.getByLabel("Editable message draft", { exact: true })).toHaveValue("");
  await expect(page.locator("[data-approved-revision]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send reviewed message" })).toHaveCount(0);
  await noPrivateStorage(page);
});

test("a session resolving in the same turn as pagehide cannot restore access", async ({ page }) => {
  await page.addInitScript((value) => {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (!String(input).endsWith("/v1/session")) return original(input, init);
      document.documentElement.dataset.testSessionHeld = "true";
      // Deliberately ignore AbortSignal to exercise the generation fence, not fetch cancellation.
      return new Promise((resolve) =>
        window.addEventListener(
          "synthetic-session-release",
          () =>
            resolve(
              new Response(JSON.stringify(value), {
                headers: { "Content-Type": "application/json" },
              }),
            ),
          { once: true },
        ),
      );
    };
  }, session);
  await page.goto(web);
  await expect(page.locator("html")).toHaveAttribute("data-test-session-held", "true");
  await page.evaluate(() => {
    window.dispatchEvent(new Event("synthetic-session-release"));
    window.dispatchEvent(new Event("pagehide"));
  });
  await expect(page.locator("[data-session-state]")).toHaveAttribute(
    "data-session-state",
    "anonymous",
  );
  await expect(page.getByRole("button", { name: "Send reviewed message" })).toHaveCount(0);
});

test("source approval expiry removes visible content without another user action", async ({
  page,
}) => {
  await fixture(page);
  await page.clock.install();
  const expiry = await page.evaluate(() => new Date(Date.now() + 3000).toISOString());
  await page.route(`${companion}/v1/chat/replies`, (route) => json(route, reply));
  await page.route(`${companion}/v1/knowledge/approved/${reference}`, (route) =>
    json(route, { ...entry, reviewUntil: expiry }),
  );
  await page.goto(web);
  await ask(page);
  await expect(page.locator("[data-approved-revision]")).toHaveCount(1);
  await page.clock.fastForward(3001);
  await expect(page.locator("[data-approved-revision]")).toHaveCount(0);
  await expect(page.locator("[data-chat-state]")).toHaveAttribute("data-chat-state", "unavailable");
});

test("editor saves a draft with provenance and scopes, then requests review separately; unsaved edits block review", async ({
  page,
}) => {
  await fixture(page, ["staff"]);
  let current = knowledgeDraft;
  let saved: unknown;
  await page.route(`${core}/v1/knowledge/drafts`, (route) => {
    saved = route.request().postDataJSON();
    current = {
      ...knowledgeDraft,
      document: {
        ...knowledgeDraft.document,
        kind: "nonclinical",
        title: "Synthetic public draft",
        body: "Synthetic source content",
        productIds: [reference],
        concernIds: [otherReference],
      },
    };
    return json(route, current);
  });
  await page.route(`${core}/v1/knowledge/drafts/${reference}`, (route) => json(route, current));
  await page.route(`${core}/v1/knowledge/drafts/${reference}/request_review`, (route) => {
    expect(route.request().postDataJSON()).toEqual({ expectedRevision: 1 });
    current = {
      ...current,
      state: "in_review",
      permissions: { edit: false, approve: false, withdraw: false },
    };
    return json(route, current);
  });
  await page.goto(`${web}/staff`);
  await page.getByRole("button", { name: "Start a new draft" }).click();
  const editor = page.locator("[data-editor-state]");
  await expect(editor.getByRole("button", { name: "Save as draft" })).toBeDisabled();
  await editor.getByLabel("Title", { exact: true }).fill("Synthetic public draft");
  await editor.getByLabel("Content", { exact: true }).fill("Synthetic source content");
  await editor.getByLabel("Public source URL").fill(entry.document.sourceUrl);
  await editor.getByLabel("Source SHA-256").fill(entry.document.sourceDigest);
  await editor.getByLabel("Product UUIDs (comma separated)").fill(reference);
  await editor.getByLabel("Concern UUIDs (comma separated)").fill(otherReference);
  await editor.getByRole("button", { name: "Save as draft" }).click();
  await expect(editor.locator("[data-knowledge-status]")).toHaveAttribute(
    "data-knowledge-status",
    "draft",
  );
  expect(saved).toMatchObject({
    id: null,
    expectedRevision: null,
    document: {
      sourceDigest: entry.document.sourceDigest,
      productIds: [reference],
      concernIds: [otherReference],
    },
  });
  expect(Object.keys(saved as object).sort()).toEqual(["document", "expectedRevision", "id"]);
  const requestReview = editor.getByRole("button", { name: "Request independent review" });
  await expect(requestReview).toBeEnabled();
  await editor.getByLabel("Title", { exact: true }).fill("Unsaved local change");
  await expect(requestReview).toBeDisabled();
  await editor.getByLabel("Title", { exact: true }).fill("Synthetic public draft");
  await requestReview.click();
  await expect(editor.locator("[data-knowledge-status]")).toHaveAttribute(
    "data-knowledge-status",
    "in_review",
  );
  await expect(editor.getByRole("button", { name: "Approve current revision" })).toBeDisabled();
  await noPrivateStorage(page);
});

test("physician cannot self-approve; independent approval and withdrawal require current server grants", async ({
  page,
}) => {
  await fixture(page, ["physician"]);
  let current = {
    ...knowledgeDraft,
    state: "in_review",
    permissions: { edit: false, approve: true, withdraw: false },
  };
  let approvals = 0;
  await page.route(`${core}/v1/knowledge/drafts/${reference}`, (route) => json(route, current));
  await page.route(`${core}/v1/knowledge/drafts/${reference}/approve`, (route) => {
    approvals++;
    current = {
      ...current,
      state: "approved",
      permissions: { edit: false, approve: false, withdraw: true },
    };
    return json(route, current);
  });
  await page.route(`${core}/v1/knowledge/drafts/${reference}/withdraw`, (route) => {
    current = {
      ...current,
      state: "withdrawn",
      permissions: { edit: false, approve: false, withdraw: false },
    };
    return json(route, current);
  });
  await page.goto(`${web}/physician`);
  await page.getByLabel("Knowledge reference", { exact: true }).fill(reference);
  await page.getByRole("button", { name: "Load current draft" }).click();
  await expect(page.getByRole("button", { name: "Approve current revision" })).toBeDisabled();
  expect(approvals).toBe(0);
  current = { ...current, authorId: otherReference };
  await page.getByRole("button", { name: "Load current draft" }).click();
  await page.getByRole("button", { name: "Approve current revision" }).click();
  await expect(page.locator("[data-knowledge-status]")).toHaveAttribute(
    "data-knowledge-status",
    "approved",
  );
  expect(approvals).toBe(1);
  await page.getByRole("button", { name: "Withdraw current revision" }).click();
  await expect(page.locator("[data-knowledge-status]")).toHaveAttribute(
    "data-knowledge-status",
    "withdrawn",
  );
});

test("editor grant revocation clears content and denies mutation instead of retaining a stale form", async ({
  page,
}) => {
  await fixture(page, ["staff"]);
  let denied = false;
  await page.route(`${core}/v1/knowledge/drafts/${reference}`, (route) =>
    json(route, denied ? {} : knowledgeDraft, denied ? 403 : 200),
  );
  await page.goto(`${web}/staff`);
  await page.getByLabel("Knowledge reference", { exact: true }).fill(reference);
  await page.getByRole("button", { name: "Load current draft" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(entry.document.title);
  denied = true;
  await page.getByRole("button", { name: "Load current draft" }).click();
  await expect(page.locator("[data-editor-state]")).toHaveAttribute("data-editor-state", "denied");
  await expect(page.getByLabel("Title", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve current revision" })).toHaveCount(0);
});

test("workspace sends restrictive frame/cache headers and browser rejects embedding", async ({
  page,
  request,
}) => {
  const response = await request.get(web);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  await page.goto(web);
  await page.setContent(`<iframe title="Denied workspace embedding" src="${web}"></iframe>`);
  await expect
    .poll(() => page.frames().some((frame) => frame.url().startsWith("chrome-error://")))
    .toBe(true);
});

test("overlapping source refreshes cannot restore an earlier approved snapshot", async ({
  page,
}) => {
  await fixture(page);
  await page.route(`${companion}/v1/chat/replies`, (route) => json(route, reply));
  let reads = 0;
  let release!: () => void;
  const paused = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`${companion}/v1/knowledge/approved/${reference}`, async (route) => {
    reads++;
    if (reads > 1) await paused;
    await json(route, { ...entry, state: reads > 1 ? "withdrawn" : "approved" });
  });
  await page.goto(web);
  await ask(page);
  await expect(page.locator("[data-approved-revision]")).toHaveCount(1);
  await page.getByRole("button", { name: "Recheck current sources" }).evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });
  await expect.poll(() => reads).toBe(2);
  await expect(page.getByRole("button", { name: "Recheck current sources" })).toBeDisabled();
  await expect(page.locator("[data-approved-revision]")).toHaveCount(0);
  release();
  await expect(page.locator("[data-chat-state]")).toHaveAttribute("data-chat-state", "unavailable");
  expect(reads).toBe(2);
});

for (const locale of ["ml", "ta"] as const) {
  test(`cited chat uses ${locale} approved text and fits a narrow screen`, async ({ page }) => {
    await fixture(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.route(`${companion}/v1/chat/replies`, (route) => {
      expect(route.request().postDataJSON().locale).toBe(locale);
      return json(route, { ...reply, locale });
    });
    await page.route(`${companion}/v1/knowledge/approved/${reference}`, (route) =>
      json(route, { ...entry, document: { ...entry.document, locale } }),
    );
    await page.goto(web);
    await page.getByRole("combobox").selectOption(locale);
    await page
      .getByLabel(foundation[locale].draft, { exact: true })
      .fill("Synthetic localized question");
    await page.getByRole("button", { name: knowledgeText[locale].send, exact: true }).click();
    await expect(page.locator("[data-approved-revision]")).toContainText(entry.document.body);
    await expect(page.locator("[data-chat-state]")).toContainText(knowledgeText[locale].citations);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
  });
}

test("stale editor revision conflicts before approval and customer cannot open the staff editor", async ({
  page,
}) => {
  await fixture(page, ["physician"]);
  let reads = 0;
  let writes = 0;
  await page.route(`${core}/v1/knowledge/drafts/${reference}`, (route) =>
    json(route, {
      ...knowledgeDraft,
      authorId: otherReference,
      state: "in_review",
      revision: ++reads,
      permissions: { edit: false, approve: true, withdraw: false },
    }),
  );
  await page.route(`${core}/v1/knowledge/drafts/${reference}/approve`, (route) => {
    writes++;
    return json(route, {}, 409);
  });
  await page.goto(`${web}/physician`);
  await page.getByLabel("Knowledge reference", { exact: true }).fill(reference);
  await page.getByRole("button", { name: "Load current draft" }).click();
  await page.getByRole("button", { name: "Approve current revision" }).click();
  await expect(page.locator("[data-editor-state]")).toHaveAttribute(
    "data-editor-state",
    "conflict",
  );
  await expect(page.locator("[data-knowledge-status]")).toHaveCount(0);
  expect(writes).toBe(0);
  await fixture(page, ["customer"]);
  await page.goto(`${web}/staff`);
  await expect(page.locator("[data-session-state]")).toHaveAttribute(
    "data-session-state",
    "denied",
  );
  await expect(page.locator("[data-editor-state]")).toHaveCount(0);
});
