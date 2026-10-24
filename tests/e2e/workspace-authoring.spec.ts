import { expect, test } from "@playwright/test";
import { editorId, syntheticRecord } from "../../apps/workspaces/src/content/__fixtures__/records";
import {
  knowledgeContentSchema,
  knowledgeRecordSchema,
} from "../../packages/contracts/src/knowledge";

test("actual staff root selects a record and saves actual matching source bytes through fresh CSRF", async ({
  page,
}) => {
  const session = { userId: editorId, expiresAt: "2099-01-01T00:00:00Z", workspaces: ["staff"] };
  let current = knowledgeRecordSchema.parse(syntheticRecord());
  const source = current.content.sources[0];
  if (!source) throw new Error("Missing synthetic source");
  source.sha256 = "2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881";
  let posts = 0;
  let contexts = 0;
  const headers = {
    "Access-Control-Allow-Origin": "http://127.0.0.1:15374",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type,X-CSRF-Token",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Cache-Control": "no-store",
  };
  await page.route("http://127.0.0.1:8787/v1/**", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.pathname === "/v1/session") return route.fulfill({ json: session, headers });
    if (url.pathname === "/v1/security/context") {
      contexts++;
      return route.fulfill({
        json: {
          userId: editorId,
          sessionId: "10000000-0000-4000-8000-000000000002",
          expiresAt: session.expiresAt,
          csrfToken: "synthetic-authoring-csrf-from-real-root-context",
        },
        headers,
      });
    }
    if (request.method() === "GET" && url.pathname.endsWith("/authoring")) {
      const permission = url.searchParams.get("permission") ?? "view";
      if (!["view", "edit"].includes(permission))
        return route.fulfill({
          status: 403,
          json: { status: "blocked", reason: "FORBIDDEN" },
          headers,
        });
      return route.fulfill({
        json: {
          status: "ready",
          schemaVersion: 1,
          record: current,
          capability: {
            actor: {
              actorId: editorId,
              displayName: "Synthetic editor",
              authorityVersion: 1,
              evidenceId: "10000000-0000-4000-8000-000000000003",
            },
            organizationId: "10000000-0000-4000-8000-000000000004",
            permission,
            scope: current.content.scope,
            productId: current.content.productId,
            language: current.content.language,
            kind: current.content.kind,
            entryId: current.content.entryId,
            revision: current.content.revision,
            contentHash: current.contentHash,
            expiresAt: session.expiresAt,
          },
        },
        headers,
      });
    }
    if (url.pathname === "/v1/knowledge/drafts" && request.method() === "POST") {
      posts++;
      expect(contexts).toBe(1);
      expect(request.headers()["x-csrf-token"]).toBe(
        "synthetic-authoring-csrf-from-real-root-context",
      );
      const body = request.postDataJSON();
      expect(body.sources).toEqual([{ sourceId: source.sourceId, bytesBase64: "eA==" }]);
      current = knowledgeRecordSchema.parse({
        state: "draft",
        content: knowledgeContentSchema.parse(body.content),
        contentHash: "c".repeat(64),
      });
      return route.fulfill({ json: { status: "persisted", record: current }, headers });
    }
    return route.fulfill({
      status: 503,
      json: { status: "not-ready", reason: "NOT_CONFIGURED" },
      headers,
    });
  });
  await page.goto("http://127.0.0.1:15374/staff/knowledge");
  await page.getByRole("textbox", { name: "Entry ID", exact: true }).fill(current.content.entryId);
  await page.locator("form").getByRole("button", { name: "Refresh record" }).click();
  await expect(page.getByLabel("Local title draft", { exact: true })).toBeVisible();
  await page.getByLabel(`File for source ${source.sourceId}`, { exact: true }).setInputFiles({
    name: "synthetic-public-source.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("x"),
  });
  await page.getByLabel("Local title draft", { exact: true }).fill("Synthetic root-saved revision");
  await page.getByRole("button", { name: "Save new draft revision" }).click();
  await expect.poll(() => posts).toBe(1);
  await expect(page.getByLabel("Local title draft", { exact: true })).toHaveValue(
    "Synthetic root-saved revision",
  );
  await expect(page.getByText("2", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/workspace-authoring-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/workspace-authoring-mobile.png", fullPage: true });
});
