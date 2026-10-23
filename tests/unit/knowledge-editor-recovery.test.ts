import { describe, expect, it } from "vitest";
import { createKnowledgeRecovery } from "../../apps/workspaces/src/knowledgeRecovery";
import { sensitiveClient } from "../../packages/client/src/sensitive";
import { entry, knowledgeDraft } from "../fixtures/knowledge";
import { context, otherReference, reference, session } from "../fixtures/sensitive";

const input = () => ({
  id: null,
  expectedRevision: null,
  document: structuredClone(entry.document),
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("session-local knowledge editor save recovery", () => {
  it("recovers a committed lost response once, then gives a future intent a new operation", async () => {
    const recovery = createKnowledgeRecovery();
    const ledger = new Map<string, unknown>();
    const keys: string[] = [];
    let lost = false;
    let effects = 0;
    const client = sensitiveClient({
      origin: "https://api.example.com",
      local: false,
      session,
      uuid: () => (keys.length === 0 ? reference : otherReference),
      transport: async (url, init) => {
        if (String(url).endsWith("/security/context")) return json(context);
        const key = new Headers(init?.headers).get("Idempotency-Key") ?? "";
        keys.push(key);
        if (!ledger.has(key)) {
          effects++;
          ledger.set(key, { ...knowledgeDraft, document: JSON.parse(String(init?.body)).document });
        }
        if (!lost) {
          lost = true;
          throw new Error("Synthetic committed draft response lost");
        }
        return json(ledger.get(key));
      },
    });
    const first = recovery.reserve(input(), reference);
    expect(first).toBeDefined();
    if (!first) throw new Error("Expected first save");
    const send = (attempt: typeof first) =>
      client.saveKnowledgeDraft(attempt.operation.input, attempt.operation.operationId);
    const lostResult = await send(first);
    expect(lostResult.status).toBe("unknown");
    expect(recovery.finish(first, lostResult.status)).toBe(true);
    expect(recovery.pending).toBe(first.operation);
    // Even an attempted new identity/edited document must not alter an unresolved operation.
    const edited = input();
    edited.document.title = "A different synthetic intention";
    const retry = recovery.reserve(edited, otherReference);
    expect(retry?.operation).toBe(first.operation);
    if (!retry) throw new Error("Expected retry");
    const result = await send(retry);
    expect(result.status).toBe("ready");
    recovery.finish(retry, result.status);
    expect(effects).toBe(1);
    expect(keys).toEqual([reference, reference]);
    expect(recovery.pending).toBeUndefined();
    const future = recovery.reserve(edited, otherReference);
    expect(future?.operation.operationId).toBe(otherReference);
    if (!future) throw new Error("Expected future intent");
    recovery.finish(future, (await send(future)).status);
    expect(effects).toBe(2);
    expect(keys).toEqual([reference, reference, otherReference]);
    client.dispose();
  });

  it("copies and freezes every editable part of the original payload", () => {
    const recovery = createKnowledgeRecovery();
    const original = input();
    original.document.productIds.push(reference);
    const attempt = recovery.reserve(original, reference);
    original.document.title = "Unsaved change";
    original.document.safety.warnings = "Changed warning";
    original.document.productIds.push(otherReference);
    expect(attempt?.operation.input.document.title).toBe(entry.document.title);
    expect(attempt?.operation.input.document.safety.warnings).toBe(entry.document.safety.warnings);
    expect(attempt?.operation.input.document.productIds).toEqual([reference]);
    expect(() => attempt?.operation.input.document.productIds.push(otherReference)).toThrow();
  });

  it.each(["unknown", "unavailable", "error", "busy"] as const)(
    "keeps the immutable operation after %s",
    (status) => {
      const recovery = createKnowledgeRecovery();
      const attempt = recovery.reserve(input(), reference);
      if (!attempt) throw new Error("Expected save");
      recovery.finish(attempt, status);
      expect(recovery.pending).toBe(attempt.operation);
    },
  );

  it.each(["ready", "anonymous", "denied", "conflict", "expired"] as const)(
    "clears content and recovery identity after definitive %s",
    (status) => {
      const recovery = createKnowledgeRecovery();
      const attempt = recovery.reserve(input(), reference);
      if (!attempt) throw new Error("Expected save");
      recovery.finish(attempt, status);
      expect(recovery.pending).toBeUndefined();
      expect(recovery.reserve(input(), otherReference)?.operation.operationId).toBe(otherReference);
    },
  );

  it("reserves synchronously against double clicks and ignores duplicate late completions", () => {
    const recovery = createKnowledgeRecovery();
    const first = recovery.reserve(input(), reference);
    if (!first) throw new Error("Expected save");
    expect(recovery.reserve(input(), reference)).toBeUndefined();
    recovery.finish(first, "unknown");
    const retry = recovery.reserve(input(), reference);
    if (!retry) throw new Error("Expected retry");
    expect(recovery.finish(first, "ready")).toBe(false);
    expect(recovery.pending).toBe(retry.operation);
    expect(recovery.finish(retry, "ready")).toBe(true);
  });

  it("fences cancelled responses and releases hidden content on lifecycle/scope clearing", () => {
    const recovery = createKnowledgeRecovery();
    const previous = recovery.reserve(input(), reference);
    if (!previous) throw new Error("Expected save");
    recovery.clear();
    expect(recovery.pending).toBeUndefined();
    const current = recovery.reserve(input(), otherReference);
    expect(recovery.finish(previous, "ready")).toBe(false);
    expect(recovery.pending).toBe(current?.operation);
    recovery.clear();
    expect(recovery.pending).toBeUndefined();
  });

  it("does not let a conflicted save overwrite a newly loaded source revision", () => {
    const recovery = createKnowledgeRecovery();
    const first = recovery.reserve({ ...input(), id: reference, expectedRevision: 1 }, reference);
    if (!first) throw new Error("Expected save");
    recovery.finish(first, "conflict");
    const latest = { ...input(), id: reference, expectedRevision: 2 };
    latest.document.body = "New server source revision";
    const next = recovery.reserve(latest, otherReference);
    expect(next?.operation.input).toEqual(latest);
    expect(recovery.finish(first, "ready")).toBe(false);
    expect(recovery.pending?.input.expectedRevision).toBe(2);
  });

  it("rejects invalid input and invalid operation identities without retaining content", () => {
    const recovery = createKnowledgeRecovery();
    expect(recovery.reserve({ ...input(), expectedRevision: 1 }, reference)).toBeUndefined();
    expect(recovery.reserve(input(), "invalid-operation")).toBeUndefined();
    expect(recovery.pending).toBeUndefined();
  });
});
