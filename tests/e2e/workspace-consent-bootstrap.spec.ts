import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { consentBootstrapLabels } from "../../packages/i18n/src/consent-bootstrap";

for (const eligible of [true, false]) {
  test(`actual denied root ${eligible ? "verifies explicit privacy consent before entry" : "never turns a generic denial into consent authority"}`, async ({
    page,
  }) => {
    const actorId = "10000000-0000-4000-8000-000000000001";
    const sessionId = "10000000-0000-4000-8000-000000000002";
    const expiresAt = new Date(Date.now() + 120000).toISOString();
    const policyText = "Synthetic policy only — not company legal approval. <b>Plain text</b>";
    const requirement = { purpose: "privacy", version: "synthetic-privacy-v1", actorId };
    const labels = consentBootstrapLabels.en;
    let granted = false;
    let posts = 0;
    let bootstrapReads = 0;
    const headers = {
      "Access-Control-Allow-Origin": "http://127.0.0.1:15374",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Content-Type,X-CSRF-Token",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Cache-Control": "no-store",
    };
    await page.route("http://127.0.0.1:8787/v1/**", (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      if (path === "/v1/session")
        return route.fulfill({
          status: granted ? 200 : 403,
          json: granted
            ? { userId: actorId, expiresAt, workspaces: ["customer"] }
            : { error: { code: "FORBIDDEN" } },
          headers,
        });
      if (path === "/v1/consent-bootstrap") {
        bootstrapReads++;
        return route.fulfill({
          status: eligible ? 200 : 403,
          json: eligible
            ? {
                actorId,
                sessionId,
                expiresAt,
                requirement,
                policy: {
                  text: policyText,
                  revision: "synthetic-r1",
                  sha256: createHash("sha256").update(policyText).digest("hex"),
                  approvalReference: "synthetic-not-legal-approval",
                },
              }
            : { error: { code: "FORBIDDEN" } },
          headers,
        });
      }
      if (path === "/v1/security/context")
        return route.fulfill({
          json: {
            userId: actorId,
            sessionId,
            expiresAt,
            csrfToken: "synthetic-root-bootstrap-actual-context-token",
          },
          headers,
        });
      if (path === "/v1/consents" && request.method() === "POST") {
        posts++;
        expect(request.headers()["x-csrf-token"]).toBe(
          "synthetic-root-bootstrap-actual-context-token",
        );
        expect(request.postDataJSON()).toEqual({ requirement, decision: "granted" });
        granted = true;
        return route.fulfill({
          status: 201,
          json: { id: "10000000-0000-4000-8000-000000000003" },
          headers,
        });
      }
      return route.fulfill({
        status: 503,
        json: { error: { code: "FEATURE_UNAVAILABLE" } },
        headers,
      });
    });
    await page.goto("http://127.0.0.1:15374/customer/shop");
    await expect(page.locator("[data-session-state]")).toHaveAttribute(
      "data-session-state",
      "denied",
    );
    const bootstrap = page.locator(".consent-bootstrap");
    await expect(bootstrap).toBeVisible();
    expect(bootstrapReads).toBe(0);
    await bootstrap.getByRole("button", { name: labels.review, exact: true }).click();
    if (!eligible) {
      await expect(bootstrap.getByText(labels.denied, { exact: true })).toBeVisible();
      await expect(bootstrap.getByRole("checkbox")).toHaveCount(0);
      expect(posts).toBe(0);
      return;
    }
    await expect(bootstrap.getByText(policyText, { exact: true })).toBeVisible();
    await expect(bootstrap.locator("b")).toHaveCount(0);
    await expect(bootstrap.getByRole("button", { name: labels.grant, exact: true })).toBeDisabled();
    await bootstrap.getByRole("checkbox", { name: labels.agree, exact: true }).check();
    await bootstrap.getByRole("button", { name: labels.grant, exact: true }).click();
    await expect(page.locator("[data-session-state]")).toHaveAttribute(
      "data-session-state",
      "ready",
    );
    expect(posts).toBe(1);
    await expect(bootstrap).toHaveCount(0);
  });
}
