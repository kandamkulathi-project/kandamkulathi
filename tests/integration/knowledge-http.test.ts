import { describe, expect, it, vi } from "vitest";
import companion from "../../apps/companion/src/index";
import { createCompanion } from "../../apps/companion/src/knowledge/service";
import { knowledgeFixture, knowledgeId, syntheticTime } from "../unit/knowledge.fixtures";

const request = (
  app: ReturnType<typeof createCompanion>,
  input: Parameters<typeof app.request>[0],
  init?: RequestInit,
) => app.request(input, init, { APP_ENV: "local" });

describe("Companion knowledge HTTP adapter (synthetic injected authority/repository only)", () => {
  it("stays unavailable in the actual unconfigured composition root despite fabricated authority headers", async () => {
    const fixture = await knowledgeFixture();
    const response = await request(companion, "http://localhost/v1/knowledge/public-product", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Role": "physician-approver",
        Authorization: "Bearer fabricated",
      },
      body: JSON.stringify(fixture.request),
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "not-ready", reason: "NOT_CONFIGURED" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("serves exact cited public blocks with no intake/session when trusted test dependencies authorize", async () => {
    const fixture = await knowledgeFixture();
    const app = createCompanion(fixture);
    const response = await request(app, "http://localhost/v1/knowledge/public-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fixture.request),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ready");
    expect(body.blocks).toHaveLength(4);
    expect(body.blocks[0].text).toBe(fixture.monograph.content.text);
    expect(body.blocks[0].citations).toEqual(fixture.monograph.content.citations);
    expect(body.blocks[0].approval.approverId).toBe(knowledgeId(3));
    expect(JSON.stringify(body)).not.toMatch(/editorId|evidenceId|authorityVersion/);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    "invalid",
    "missing",
    "stale",
    "withdrawn",
    "authority",
    "scope",
    "safety",
    "concurrent",
  ])("denies hostile %s requests without leaking blocks", async (condition) => {
    const fixture = await knowledgeFixture();
    let input: unknown = fixture.request;
    const reasons = {
      invalid: "INVALID_REQUEST",
      missing: "MISSING_PRIMARY",
      stale: "STALE_REFERENCE",
      withdrawn: "NOT_APPROVED",
      authority: "APPROVER_UNAUTHORIZED",
      scope: "SCOPE_MISMATCH",
      safety: "SAFETY_BLOCKS_UNAVAILABLE",
      concurrent: "CURRENT_STATE_CHANGED",
    };
    if (condition === "invalid")
      input = {
        ...fixture.request,
        approval: { role: "physician" },
        generatedText: "replace approved text",
      };
    if (condition === "missing") fixture.entries.delete(fixture.monograph.content.entryId);
    if (condition === "stale")
      input = {
        ...fixture.request,
        candidates: fixture.request.candidates.map((candidate) => ({ ...candidate, revision: 2 })),
      };
    if (condition === "withdrawn")
      fixture.entries.set(fixture.monograph.content.entryId, {
        ...fixture.monograph,
        state: "withdrawn",
        withdrawal: {
          actorId: knowledgeId(3),
          withdrawnAt: syntheticTime,
          evidenceId: knowledgeId(4),
        },
      });
    if (condition === "authority") fixture.authority.isApprovalCurrent = vi.fn(async () => false);
    if (condition === "scope") input = { ...fixture.request, productId: knowledgeId(99) };
    if (condition === "scope")
      fixture.read.loadProduct.mockResolvedValue({
        ...fixture.product,
        productId: knowledgeId(99),
      });
    if (condition === "safety") fixture.read.loadMandatoryBlocks.mockResolvedValue([]);
    if (condition === "concurrent") fixture.read.confirmCurrent.mockResolvedValue(false);
    const app = createCompanion(fixture);
    const response = await request(app, "http://localhost/v1/knowledge/public-product", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Role": "admin" },
      body: JSON.stringify(input),
    });
    expect(response.status).toBe(condition === "invalid" ? 400 : 409);
    const body = await response.json();
    expect(body).toEqual({ status: "blocked", reason: reasons[condition as keyof typeof reasons] });
    expect(body).not.toHaveProperty("blocks");
  });

  it("returns safe not-ready errors when primary or authority fails", async () => {
    const fixture = await knowledgeFixture();
    fixture.read.loadProduct.mockRejectedValue(new Error("restricted database details"));
    const response = await request(
      createCompanion(fixture),
      "http://localhost/v1/knowledge/public-product",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fixture.request),
      },
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "not-ready", reason: "PRIMARY_UNAVAILABLE" });
  });

  it("rejects malformed/unsupported JSON, oversized bodies and wrong methods", async () => {
    for (const headers of [
      { "Content-Type": "application/json" },
      { "Content-Type": "text/plain" },
    ]) {
      const response = await request(companion, "http://localhost/v1/knowledge/public-product", {
        method: "POST",
        headers,
        body: "not-json",
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ status: "blocked", reason: "INVALID_REQUEST" });
    }
    const oversized = await request(companion, "http://localhost/v1/knowledge/public-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "a".repeat(65537),
    });
    expect(oversized.status).toBe(413);
    const get = await request(companion, "http://localhost/v1/knowledge/public-product");
    expect(get.status).toBe(503);
    expect(await get.json()).toMatchObject({ error: { code: "FEATURE_UNAVAILABLE" } });
  });

  it("never enables personalization, content approval or fixture routes through HTTP", async () => {
    const fixture = await knowledgeFixture();
    const app = createCompanion(fixture);
    const response = await request(app, "http://localhost/v1/knowledge/personalized", {
      method: "POST",
      body: "No intake is parsed",
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "blocked",
      reason: "PERSONALIZED_POLICY_UNAVAILABLE",
    });
    for (const path of ["approve", "withdraw", "fixtures", "index"]) {
      const unavailable = await request(app, `http://localhost/v1/knowledge/${path}`, {
        method: "POST",
        headers: { "X-Role": "physician" },
      });
      expect(unavailable.status).toBe(503);
      expect(await unavailable.json()).toMatchObject({ error: { code: "FEATURE_UNAVAILABLE" } });
    }
    expect(fixture.authority.currentActor).not.toHaveBeenCalled();
    expect(fixture.read.loadEntry).not.toHaveBeenCalled();
  });
});
