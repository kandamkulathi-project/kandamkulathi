import { expect, type Route, test } from "@playwright/test";
import { knowledgeDraft } from "../fixtures/knowledge";
import { context, otherReference, reference, session } from "../fixtures/sensitive";

const web = "http://127.0.0.1:5173";
const core = "http://127.0.0.1:8787";
const headers = { "Access-Control-Allow-Origin": web, "Access-Control-Allow-Credentials": "true" };
const json = (route: Route, body: unknown) =>
  route.fulfill({ headers, contentType: "application/json", body: JSON.stringify(body) });

for (const mismatch of ["id", "version"] as const) {
  test(`a committed save with a wrong ${mismatch} keeps controls locked and retries the exact wire action`, async ({
    page,
  }) => {
    // Synthetic contracts only: not real backend commits, authorization or approval-ledger proof.
    await page.route(`${core}/v1/session`, (route) =>
      json(route, { ...session, workspaces: ["staff"] }),
    );
    await page.route(`${core}/v1/security/context`, (route) => json(route, context));
    await page.route(`${core}/v1/knowledge/drafts/${reference}`, (route) =>
      json(route, knowledgeDraft),
    );
    const ledger = new Map<string, unknown>();
    const requests: { key: string; payload: string | null }[] = [];
    await page.route(`${core}/v1/knowledge/drafts`, (route) => {
      const request = route.request();
      const key = request.headers()["idempotency-key"] ?? "";
      const body = request.postDataJSON();
      requests.push({ key, payload: request.postData() });
      if (!ledger.has(key))
        ledger.set(key, { ...knowledgeDraft, revision: 2, document: body.document });
      if (requests.length === 1)
        return json(route, {
          ...knowledgeDraft,
          id: mismatch === "id" ? otherReference : reference,
          revision: mismatch === "version" ? 1 : 2,
          document: body.document,
        });
      return json(route, ledger.get(key));
    });
    await page.goto(`${web}/staff`);
    const editor = page.locator("[data-editor-state]");
    await editor.getByLabel("Knowledge reference", { exact: true }).fill(reference);
    await editor.getByRole("button", { name: "Load current draft" }).click();
    await editor.getByLabel("Title", { exact: true }).fill("Synthetic correlated update");
    await editor.getByRole("button", { name: "Save as draft", exact: true }).click();
    await expect(editor).toHaveAttribute("data-editor-state", "unknown");
    await expect(editor.getByLabel("Title", { exact: true })).toHaveValue(
      "Synthetic correlated update",
    );
    await expect(editor.getByLabel("Title", { exact: true })).toBeDisabled();
    await expect(editor.getByLabel("Knowledge reference", { exact: true })).toHaveValue(reference);
    for (const name of [
      "Start a new draft",
      "Load current draft",
      "Request independent review",
      "Approve current revision",
    ])
      await expect(editor.getByRole("button", { name, exact: true })).toBeDisabled();
    await expect(editor.locator("[data-knowledge-status]")).toHaveAttribute(
      "data-knowledge-status",
      "draft",
    );
    await editor.getByRole("button", { name: "Retry the same draft save" }).click();
    await expect(editor).toHaveAttribute("data-editor-state", "current");
    expect(requests).toHaveLength(2);
    expect(requests[0]?.key).toMatch(/^[a-f0-9-]{36}$/);
    expect(requests[1]).toEqual(requests[0]);
    expect(ledger.size).toBe(1);
    await expect(editor.getByLabel("Knowledge reference", { exact: true })).toHaveValue(reference);
    await expect(editor.getByLabel("Title", { exact: true })).toBeEnabled();
    await expect(editor.getByRole("button", { name: "Start a new draft" })).toBeEnabled();
    await expect(editor.locator("[data-knowledge-status]")).toContainText("v2");
  });
}
