import { expect, type Page, type Route, test } from "@playwright/test";
import { entry, knowledgeDraft } from "../fixtures/knowledge";
import { context, otherReference, reference, session } from "../fixtures/sensitive";

// Explicit test-only mounting of the unchanged proposed-client editor, not ContentWorkspace.
const web = "http://127.0.0.1:15375";
const editorUrl = `${web}/__legacy-knowledge/staff`;
const core = "http://127.0.0.1:8787";
const headers = { "Access-Control-Allow-Origin": web, "Access-Control-Allow-Credentials": "true" };
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(body) });

async function fixture(page: Page) {
  // Synthetic browser contracts only, not real authorization, persistence or approval-ledger proof.
  // Proposed-client DTOs are not canonical authoring envelopes; no Worker routes are changed.
  await page.route(`${core}/v1/session`, (route) =>
    json(route, { ...session, workspaces: ["staff"] }),
  );
  await page.route(`${core}/v1/security/context`, (route) => json(route, context));
}
async function fillDraft(page: Page, title = "Synthetic recoverable draft") {
  const editor = page.locator("[data-editor-state]");
  await editor.getByRole("button", { name: "Start a new draft" }).click();
  await editor.getByLabel("Title", { exact: true }).fill(title);
  await editor.getByLabel("Content", { exact: true }).fill(entry.document.body);
  await editor.getByLabel("Public source URL").fill(entry.document.sourceUrl);
  await editor.getByLabel("Source SHA-256").fill(entry.document.sourceDigest);
}

test("a committed lost creation locks edits and retries exactly once; a future intent gets a new key", async ({
  page,
}) => {
  await fixture(page);
  const ledger = new Map<string, unknown>();
  const requests: { key: string; body: unknown }[] = [];
  await page.route(`${core}/v1/knowledge/drafts`, async (route) => {
    const key = route.request().headers()["idempotency-key"] ?? "";
    const body = route.request().postDataJSON();
    requests.push({ key, body });
    if (!ledger.has(key))
      ledger.set(key, {
        ...knowledgeDraft,
        id: ledger.size ? otherReference : reference,
        document: body.document,
      });
    if (requests.length === 1) return route.abort("failed"); // The synthetic write already committed.
    return json(route, ledger.get(key));
  });
  await page.goto(editorUrl);
  await fillDraft(page);
  const editor = page.locator("[data-editor-state]");
  await editor.getByRole("button", { name: "Save as draft", exact: true }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(editor).toHaveAttribute("data-editor-state", "unknown");
  expect(requests).toHaveLength(1);
  await expect(editor.getByLabel("Title", { exact: true })).toHaveValue(
    "Synthetic recoverable draft",
  );
  await expect(editor.getByLabel("Title", { exact: true })).toBeDisabled();
  await expect(editor.getByLabel("Knowledge reference", { exact: true })).toBeDisabled();
  await expect(editor.getByRole("button", { name: "Start a new draft" })).toBeDisabled();
  await expect(editor.getByRole("button", { name: "Load current draft" })).toBeDisabled();
  await expect(editor).toContainText("Fields are locked");
  await editor.getByRole("button", { name: "Retry the same draft save" }).click();
  await expect(editor).toHaveAttribute("data-editor-state", "current");
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  expect(ledger.size).toBe(1);
  await expect(editor.getByLabel("Title", { exact: true })).toBeEnabled();
  await expect(editor.locator("[data-knowledge-status]")).toHaveAttribute(
    "data-knowledge-status",
    "draft",
  );
  await fillDraft(page, "Synthetic future intention");
  await editor.getByRole("button", { name: "Save as draft", exact: true }).click();
  await expect(editor).toHaveAttribute("data-editor-state", "current");
  expect(ledger.size).toBe(2);
  expect(requests[2]?.key).not.toBe(requests[0]?.key);
});

for (const denied of [401, 403]) {
  test(`an uncertain save clears recovery fields and identity after ${denied}`, async ({
    page,
  }) => {
    await fixture(page);
    let reject = false;
    let writes = 0;
    await page.route(`${core}/v1/security/context`, (route) =>
      json(route, reject ? {} : context, reject ? denied : 200),
    );
    await page.route(`${core}/v1/knowledge/drafts`, (route) => {
      writes++;
      return route.abort("failed");
    });
    await page.goto(editorUrl);
    await fillDraft(page);
    const editor = page.locator("[data-editor-state]");
    await editor.getByRole("button", { name: "Save as draft", exact: true }).click();
    await expect(editor).toHaveAttribute("data-editor-state", "unknown");
    reject = true;
    await editor.getByRole("button", { name: "Retry the same draft save" }).click();
    if (denied === 401) {
      await expect(editor).toHaveCount(0);
      await expect(page.locator("[data-session-state]")).toHaveAttribute(
        "data-session-state",
        "anonymous",
      );
    } else {
      await expect(editor).toHaveAttribute("data-editor-state", "denied");
      await expect(editor.getByRole("button", { name: "Start a new draft" })).toBeEnabled();
    }
    await expect(page.getByLabel("Title", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retry the same draft save" })).toHaveCount(0);
    expect(writes).toBe(1);
    expect(await page.locator("body").innerText()).not.toContain("Synthetic recoverable draft");
  });
}

test("a conflicted update reloads the latest revision instead of replaying the old document", async ({
  page,
}) => {
  await fixture(page);
  let current = knowledgeDraft;
  const writes: { expectedRevision: number; document: { body: string } }[] = [];
  await page.route(`${core}/v1/knowledge/drafts/${reference}`, (route) => json(route, current));
  await page.route(`${core}/v1/knowledge/drafts`, (route) => {
    const body = route.request().postDataJSON();
    writes.push(body);
    if (writes.length === 1) {
      current = {
        ...knowledgeDraft,
        revision: 2,
        document: { ...entry.document, body: "Synthetic newer server source" },
      };
      return json(route, {}, 409);
    }
    return json(route, { ...current, revision: 3, document: body.document });
  });
  await page.goto(editorUrl);
  const editor = page.locator("[data-editor-state]");
  await editor.getByLabel("Knowledge reference", { exact: true }).fill(reference);
  await editor.getByRole("button", { name: "Load current draft" }).click();
  await editor.getByLabel("Content", { exact: true }).fill("Synthetic stale local edit");
  await editor.getByRole("button", { name: "Save as draft", exact: true }).click();
  await expect(editor).toHaveAttribute("data-editor-state", "conflict");
  await expect(editor.getByLabel("Content", { exact: true })).toHaveCount(0);
  await editor.getByRole("button", { name: "Load current draft" }).click();
  await expect(editor.getByLabel("Content", { exact: true })).toHaveValue(
    "Synthetic newer server source",
  );
  await editor.getByRole("button", { name: "Save as draft", exact: true }).click();
  await expect(editor).toHaveAttribute("data-editor-state", "current");
  expect(writes[1]?.expectedRevision).toBe(2);
  expect(writes[1]?.document.body).toBe("Synthetic newer server source");
});

for (const lifecycle of ["navigation", "logout", "scope"] as const) {
  test(`${lifecycle} clears pending recovery and fences a late creation response`, async ({
    page,
  }) => {
    await fixture(page);
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started = false;
    await page.route(`${core}/v1/knowledge/drafts`, async (route) => {
      started = true;
      await held;
      await json(route, knowledgeDraft).catch(() => {});
    });
    await page.goto(editorUrl);
    await fillDraft(page);
    await page.getByRole("button", { name: "Save as draft", exact: true }).click();
    await expect.poll(() => started).toBe(true);
    if (lifecycle === "navigation") {
      await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    } else if (lifecycle === "logout") {
      await page.route(`${core}/v1/session/logout`, (route) => json(route, {}, 503));
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
    } else {
      await page.route(`${core}/v1/session`, (route) =>
        json(route, { ...session, workspaces: ["customer"] }),
      );
      await page.getByRole("button", { name: "Check access again", exact: true }).click();
      await expect(page.locator("[data-session-state]")).toHaveAttribute(
        "data-session-state",
        "denied",
      );
    }
    await expect(page.locator("[data-editor-state]")).toHaveCount(0);
    release();
    if (lifecycle === "navigation") {
      await page.evaluate(() =>
        window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
      );
      await expect(page.locator("[data-editor-state]")).toHaveAttribute(
        "data-editor-state",
        "pending",
      );
    }
    await expect(page.getByLabel("Title", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retry the same draft save" })).toHaveCount(0);
  });
}
