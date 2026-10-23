import { describe, expect, it } from "vitest";
import { createKnowledgeRecovery } from "../../apps/workspaces/src/knowledgeRecovery";
import { sensitiveClient } from "../../packages/client/src/sensitive";
import { entry, knowledgeDraft } from "../fixtures/knowledge";
import { context, otherReference, reference, session } from "../fixtures/sensitive";

const json = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
const update = () => ({
  id: reference,
  expectedRevision: 1,
  document: structuredClone(entry.document),
});

describe("knowledge save response correlation before wire identity retirement", () => {
  it.each(["id", "version", "document", "state"] as const)(
    "keeps exact payload/key after a committed update returns mismatched %s",
    async (mismatch) => {
      const recovery = createKnowledgeRecovery();
      const ledger = new Map<string, unknown>();
      const requests: { key: string; body: unknown }[] = [];
      let creations = 0;
      const client = sensitiveClient({
        origin: "https://api.example.com",
        local: false,
        session,
        uuid: () => (requests.length === 0 ? reference : otherReference),
        transport: async (url, init) => {
          if (String(url).endsWith("/security/context")) return json(context);
          const key = new Headers(init?.headers).get("Idempotency-Key") ?? "";
          const body = JSON.parse(String(init?.body));
          requests.push({ key, body });
          if (!ledger.has(key)) {
            creations++;
            ledger.set(key, { ...knowledgeDraft, revision: 2, document: body.document });
          }
          if (requests.length === 1)
            return json({
              ...knowledgeDraft,
              revision: mismatch === "version" ? 1 : 2,
              id: mismatch === "id" ? otherReference : reference,
              state: mismatch === "state" ? "approved" : "draft",
              document:
                mismatch === "document"
                  ? { ...entry.document, body: "Unrelated source" }
                  : body.document,
            });
          return json(ledger.get(key));
        },
      });
      const first = recovery.reserve(update(), reference);
      if (!first) throw new Error("Expected initial save");
      const send = (attempt: typeof first) =>
        client.saveKnowledgeDraft(attempt.operation.input, attempt.operation.operationId);
      const mismatched = await send(first);
      expect(mismatched.status).toBe("unknown");
      recovery.finish(first, mismatched.status);
      expect(recovery.pending).toBe(first.operation);
      const retry = recovery.reserve({ ...update(), expectedRevision: 5 }, otherReference);
      if (!retry) throw new Error("Expected same-save retry");
      const result = await send(retry);
      expect(result.status).toBe("ready");
      expect(requests[1]).toEqual(requests[0]);
      expect(creations).toBe(1);
      recovery.finish(retry, result.status);
      expect(recovery.pending).toBeUndefined();
      client.dispose();
    },
  );

  it("accepts a correlated creation with a server-assigned ID that the client could not know", async () => {
    const input = { id: null, expectedRevision: null, document: entry.document };
    const client = sensitiveClient({
      origin: "https://api.example.com",
      local: false,
      session,
      transport: async (url) =>
        json(
          String(url).endsWith("/security/context")
            ? context
            : { ...knowledgeDraft, id: otherReference },
        ),
    });
    expect(await client.saveKnowledgeDraft(input, reference)).toMatchObject({
      status: "ready",
      data: { id: otherReference, revision: 1, state: "draft" },
    });
    client.dispose();
  });

  it("does not resolve an uncertain creation with unrelated but schema-valid content", async () => {
    const requests: { key: string; body: string }[] = [];
    const client = sensitiveClient({
      origin: "https://api.example.com",
      local: false,
      session,
      uuid: () => (requests.length === 0 ? reference : otherReference),
      transport: async (url, init) => {
        if (String(url).endsWith("/security/context")) return json(context);
        requests.push({
          key: new Headers(init?.headers).get("Idempotency-Key") ?? "",
          body: String(init?.body),
        });
        return json(
          requests.length === 1
            ? { ...knowledgeDraft, document: { ...entry.document, title: "Other draft" } }
            : knowledgeDraft,
        );
      },
    });
    const input = { id: null, expectedRevision: null, document: entry.document };
    expect((await client.saveKnowledgeDraft(input, reference)).status).toBe("unknown");
    expect((await client.saveKnowledgeDraft(input, reference)).status).toBe("ready");
    expect(requests[1]).toEqual(requests[0]);
    client.dispose();
  });
});
