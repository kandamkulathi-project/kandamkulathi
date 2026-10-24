import { describe, expect, it, vi } from "vitest";
import {
  approverId,
  editorId,
  syntheticRecord,
} from "../../apps/workspaces/src/content/__fixtures__/records";
import { draftCommand } from "../../apps/workspaces/src/content/authoring-dto";
import {
  AuthoringRejection,
  loadSourceAuthorization,
  mutationBody,
} from "../../apps/workspaces/src/content/authoring-port";
import { createContentHttpIntegration } from "../../apps/workspaces/src/content/http-source";
import { knowledgeRecordSchema } from "../../packages/contracts/src/knowledge";
import type {
  KnowledgeAuthoringPermission,
  KnowledgeAuthoringTransport,
} from "../../packages/contracts/src/knowledge-authoring";

const session = {
  userId: editorId.toUpperCase(),
  expiresAt: "2099-10-20T10:00:00Z",
  workspaces: ["staff"] as ["staff"],
};
const record = knowledgeRecordSchema.parse(syntheticRecord());
const origins = {
  coreOrigin: "https://api.example.com",
  companionOrigin: "https://api.example.com",
  local: false,
};
function ready(permission: KnowledgeAuthoringPermission = "view", actorId = editorId) {
  return {
    status: "ready",
    schemaVersion: 1,
    record,
    capability: {
      actor: {
        actorId,
        displayName: "Synthetic authority",
        authorityVersion: 1,
        evidenceId: "abcdefab-5555-4555-8555-555555555555",
      },
      organizationId: "abcdefab-8888-4888-8888-888888888888",
      permission,
      scope: record.content.scope,
      productId: record.content.productId,
      language: record.content.language,
      kind: record.content.kind,
      entryId: record.content.entryId,
      revision: record.content.revision,
      contentHash: record.contentHash,
      expiresAt: "2099-10-20T10:00:00Z",
    },
  };
}
function integration(transport: KnowledgeAuthoringTransport) {
  return createContentHttpIntegration({
    ...origins,
    session,
    entryId: record.content.entryId.toUpperCase(),
    transport,
  });
}
const signal = () => new AbortController().signal;

describe("canonical owner knowledge-authoring HTTP codec + required root transport", () => {
  it("uses the exact no-query view route and permission action route; binds all canonical metadata", async () => {
    const transport = vi.fn(async (request: Parameters<KnowledgeAuthoringTransport>[0]) => ({
      httpStatus: 200,
      body: ready(request.path.includes("?permission=edit") ? "edit" : "view"),
    }));
    const api = integration(transport);
    expect(api.status).toBe("configured");
    if (api.status !== "configured") throw new Error("Expected configured");
    expect(await api.readRecord(signal())).toEqual({ status: "ready", data: record });
    expect(transport.mock.calls[0]?.[0].path).toBe(
      `/v1/knowledge/${record.content.entryId}/authoring`,
    );
    const grant = await loadSourceAuthorization(
      api.authoring,
      { session, record, permission: "edit" },
      signal(),
    );
    expect(grant?.actor.actorId).toBe(editorId);
    expect(grant?.expiresAt).toBe("2099-10-20T10:00:00Z");
    expect(transport.mock.lastCall?.[0].path).toBe(
      `/v1/knowledge/${record.content.entryId}/authoring?permission=edit`,
    );
    expect(Object.keys(transport.mock.lastCall?.[0] ?? {}).sort()).toEqual([
      "method",
      "path",
      "signal",
    ]);
  });
  it("keeps different/invalid origins explicitly pending with no HTTP/cookie/CSRF workaround", async () => {
    const transport = vi.fn(async () => ({ httpStatus: 200, body: ready() }));
    for (const companionOrigin of [
      "https://other.example.com",
      "https://api.example.com:8443",
      "http://api.example.com",
      "https://api.example.com/path",
    ]) {
      const api = createContentHttpIntegration({
        ...origins,
        companionOrigin,
        session,
        entryId: record.content.entryId,
        transport,
      });
      expect(api.status).toBe("pending");
      expect(await api.readRecord(signal())).toEqual({ status: "unavailable" });
    }
    expect(transport).not.toHaveBeenCalled();
  });
  it("rejects extra, missing, stale, wrong-scope, wrong-actor and oversized canonical success data", async () => {
    for (const body of [
      { ...ready(), arbitraryRole: "physician" },
      { ...ready(), capability: { ...ready().capability, expiresAt: undefined } },
      { ...ready(), capability: { ...ready().capability, expiresAt: "2000-10-20T10:00:00Z" } },
      { ...ready(), capability: { ...ready().capability, language: "ml" } },
      ready("view", approverId),
      { ...ready(), padding: "x".repeat(65536) },
    ]) {
      const api = integration(async () => ({ httpStatus: 200, body }));
      expect(await api.readRecord(signal())).toEqual({ status: "error" });
    }
  });
  it("cannot convert a view capability, stale action or UUID-alias self-approval into permission", async () => {
    for (const body of [
      ready("view"),
      { ...ready("edit"), capability: { ...ready("edit").capability, revision: 2 } },
      ready("approve", editorId.toUpperCase()),
    ]) {
      const api = integration(async () => ({ httpStatus: 200, body }));
      if (api.status !== "configured") throw new Error("Expected configured");
      expect(
        await loadSourceAuthorization(
          api.authoring,
          {
            session,
            record,
            permission: body.capability.permission === "approve" ? "approve" : "edit",
          },
          signal(),
        ),
      ).toBeNull();
    }
  });
  it("maps anonymous/denied/pending/error reads without partial content or raw exception output", async () => {
    for (const [httpStatus, body, status] of [
      [401, { status: "blocked", reason: "UNAUTHENTICATED" }, "anonymous"],
      [403, { status: "blocked", reason: "FORBIDDEN" }, "denied"],
      [503, { status: "not-ready", reason: "NOT_CONFIGURED" }, "unavailable"],
      [503, ready(), "error"],
      [200, { record }, "error"],
    ] as const)
      expect(await integration(async () => ({ httpStatus, body })).readRecord(signal())).toEqual({
        status,
      });
    expect(
      await integration(async () => {
        throw new Error("private transport detail");
      }).readRecord(signal()),
    ).toEqual({ status: "error" });
    const controller = new AbortController();
    controller.abort();
    const transport = vi.fn(async () => ({ httpStatus: 200, body: ready() }));
    expect(await integration(transport).readRecord(controller.signal)).toEqual({ status: "error" });
    expect(transport).not.toHaveBeenCalled();
  });
  it("uses canonical strict draft serialization, enforces whole JSON size and preserves server413", async () => {
    const transport = vi.fn(async (_request: Parameters<KnowledgeAuthoringTransport>[0]) => ({
      httpStatus: 413,
      body: null,
    }));
    const api = integration(transport);
    if (api.status !== "configured") throw new Error("Expected configured");
    const upload = { sourceId: record.content.sources[0]?.sourceId ?? "", bytesBase64: "eA==" };
    const command = draftCommand(record, editorId, "Title", "Text", [upload]);
    if (!command) throw new Error("Expected draft");
    const response = await api.authoring.submit(command, signal());
    expect(response.httpStatus).toBe(413);
    try {
      mutationBody(response);
      throw new Error("Expected413");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthoringRejection);
      expect((error as AuthoringRejection).outcome).toBe("oversized");
    }
    expect(transport.mock.calls[0]?.[0]).toEqual({
      method: "POST",
      path: "/v1/knowledge/drafts",
      body: { content: command.action === "edit" ? command.content : null, sources: [upload] },
      signal: expect.any(AbortSignal),
    });
    const large = draftCommand(record, editorId, "Title", "x".repeat(16000), [
      { ...upload, bytesBase64: btoa("x".repeat(48000)) },
    ]);
    if (!large) throw new Error("Expected complete draft");
    await expect(api.authoring.submit(large, signal())).rejects.toThrow(
      "Authoring request body exceeds byte limit",
    );
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
