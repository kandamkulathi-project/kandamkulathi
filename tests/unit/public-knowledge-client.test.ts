import { describe, expect, it } from "vitest";
import {
  loadPublicKnowledge,
  publicKnowledgeView,
} from "../../packages/client/src/public-knowledge";
import {
  publicKnowledgeId,
  publicKnowledgeInput,
  publicKnowledgeReply,
} from "../fixtures/public-knowledge";

const json = (value: unknown, status = 200) => Response.json(value, { status });
const load = (
  transport: typeof fetch,
  input: unknown = publicKnowledgeInput,
  signal = new AbortController().signal,
) =>
  loadPublicKnowledge({ origin: "https://api.clinic.org", local: false, input, signal, transport });

describe("canonical public knowledge adapter", () => {
  it("consumes the canonical safety/approval schema instead of accepting partial or rebound display proof", () => {
    const first = publicKnowledgeReply.blocks[0];
    if (!first) throw new Error("Missing synthetic fixture block");
    for (const blocks of [
      publicKnowledgeReply.blocks.slice(0, 3),
      publicKnowledgeReply.blocks.map((block) => ({ ...block, kind: "monograph" })),
      publicKnowledgeReply.blocks.map((block) => ({ ...block, reference: first.reference })),
      publicKnowledgeReply.blocks.map((block) => ({
        ...block,
        approval: { ...block.approval, contentHash: "b".repeat(64) },
      })),
    ])
      expect(publicKnowledgeView({ ...publicKnowledgeReply, blocks })).toEqual({ status: "error" });
  });
  it("uses canonical proof and preserves separate clinical kinds, provenance, exact plaintext and approvals", () => {
    const result = publicKnowledgeView(publicKnowledgeReply);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Synthetic view missing");
    expect(result.sections.map((section) => section.kind)).toEqual([
      "monograph",
      "dosage",
      "contraindication",
      "safety",
    ]);
    for (const [index, section] of result.sections.entries()) {
      const source = publicKnowledgeReply.blocks[index];
      expect(section.body).toBe(source?.text);
      expect(section.approval).toEqual(source?.approval);
      expect(section.citations).toEqual(source?.citations);
      expect(section.reference).toEqual(source?.reference);
      expect(Object.hasOwn(section, "permissions")).toBe(false);
      expect(Object.hasOwn(section, "reviewUntil")).toBe(false);
    }
  });
  it("sends only a validated canonical public request to the fixed origin/route, uncached and without session credentials", async () => {
    const result = await load(async (input, init) => {
      expect(String(input)).toBe("https://api.clinic.org/v1/knowledge/public-product");
      expect(init).toMatchObject({
        method: "POST",
        cache: "no-store",
        redirect: "error",
        credentials: "omit",
      });
      expect(new Headers(init?.headers).has("Authorization")).toBe(false);
      expect(JSON.parse(String(init?.body))).toEqual(publicKnowledgeInput);
      return json(publicKnowledgeReply);
    });
    expect(result.status).toBe("ready");
  });
  it("rejects invalid requests before transport and rejects cross-product or cross-language positive replies", async () => {
    let calls = 0;
    const transport: typeof fetch = async () => {
      calls++;
      return json(publicKnowledgeReply);
    };
    expect(
      await load(transport, { ...publicKnowledgeInput, clinicalHistory: "not permitted" }),
    ).toEqual({ status: "error" });
    expect(calls).toBe(0);
    for (const body of [
      { ...publicKnowledgeReply, productId: "10000000-0000-4000-8000-000000000099" },
      {
        ...publicKnowledgeReply,
        language: "ml",
        blocks: publicKnowledgeReply.blocks.map((block) => ({ ...block, language: "ml" })),
      },
      { ...publicKnowledgeReply, generatedAdvice: "untrusted prose" },
    ])
      expect(await load(async () => json(body))).toEqual({ status: "error" });
  });
  it("keeps canonical denial/unavailability reasons and never coerces an HTTP failure into successful content", async () => {
    for (const reason of ["CURRENT_STATE_CHANGED", "SAFETY_BLOCKS_UNAVAILABLE", "STALE_REFERENCE"])
      expect(await load(async () => json({ status: "blocked", reason }, 409))).toEqual({
        status: "blocked",
        reason,
      });
    expect(
      await load(async () => json({ status: "not-ready", reason: "NOT_CONFIGURED" }, 503)),
    ).toEqual({ status: "not-ready", reason: "NOT_CONFIGURED" });
    expect(await load(async () => json({}, 401))).toEqual({ status: "anonymous" });
    expect(await load(async () => json({}, 403))).toEqual({ status: "denied" });
    expect(await load(async () => json({ error: { code: "FEATURE_UNAVAILABLE" } }, 503))).toEqual({
      status: "unavailable",
    });
    expect(await load(async () => json(publicKnowledgeReply, 500))).toEqual({ status: "error" });
    expect(await load(async () => json({ status: "blocked", reason: "STALE_REFERENCE" }))).toEqual({
      status: "error",
    });
  });
  it("fences aborts before and after transport, malformed JSON, oversized bodies and network failures", async () => {
    const abort = new AbortController();
    abort.abort();
    let calls = 0;
    expect(
      await load(
        async () => {
          calls++;
          return json(publicKnowledgeReply);
        },
        publicKnowledgeInput,
        abort.signal,
      ),
    ).toEqual({ status: "error" });
    expect(calls).toBe(0);
    const late = new AbortController();
    expect(
      await load(
        async () => {
          late.abort();
          return json(publicKnowledgeReply);
        },
        publicKnowledgeInput,
        late.signal,
      ),
    ).toEqual({ status: "error" });
    for (const transport of [
      async () =>
        new Response(JSON.stringify(publicKnowledgeReply), {
          headers: { "Content-Type": "application/json-malformed" },
        }),
      async () => new Response("{", { headers: { "Content-Type": "application/json" } }),
      async () =>
        new Response("x".repeat(2 * 1024 * 1024 + 1), {
          headers: { "Content-Type": "application/json" },
        }),
      async () => {
        throw new Error("Synthetic private provider diagnostics must not escape");
      },
    ])
      expect(await load(transport)).toEqual({ status: "error" });
    expect(publicKnowledgeView({ productId: publicKnowledgeId })).toEqual({ status: "error" });
  });
});
