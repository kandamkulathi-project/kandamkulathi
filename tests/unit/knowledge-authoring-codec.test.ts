import { describe, expect, it, vi } from "vitest";
import {
  createDecodedContentAuthoringPort,
  decodeKnowledgeAuthoringRecord,
  decodeKnowledgeAuthoringSource,
  knowledgeAuthoringResponseMaxBytes,
  knowledgeAuthoringResultSchema,
} from "../../packages/contracts/src/knowledge-authoring";
import { knowledgeFixture, knowledgeId } from "./knowledge.fixtures";

async function source(permission: "view" | "edit" | "approve" | "withdraw" = "edit") {
  const fixture = await knowledgeFixture();
  const record =
    permission === "approve"
      ? {
          state: "draft" as const,
          content: fixture.monograph.content,
          contentHash: fixture.monograph.contentHash,
        }
      : fixture.monograph;
  return {
    status: "ready" as const,
    schemaVersion: 1 as const,
    record,
    capability: {
      actor: {
        actorId: knowledgeId(3),
        displayName: "Synthetic protocol reviewer",
        authorityVersion: 1,
        evidenceId: knowledgeId(4),
      },
      permission,
      organizationId: knowledgeId(51),
      scope: record.content.scope,
      productId: record.content.productId,
      language: record.content.language,
      kind: record.content.kind,
      entryId: record.content.entryId,
      revision: record.content.revision,
      contentHash: record.contentHash,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    },
  };
}
describe("exact knowledge authoring codec and complete Denzil port", () => {
  it("decodes only the exact canonical envelope, preserves text and does not infer roles", async () => {
    const envelope = await source();
    const projection = decodeKnowledgeAuthoringSource(envelope);
    expect(projection).toEqual({
      actor: envelope.capability.actor,
      record: envelope.record,
      permission: "edit",
      expiresAt: envelope.capability.expiresAt,
    });
    expect(decodeKnowledgeAuthoringSource({ ...envelope, canApprove: true })).toBeNull();
    expect(
      decodeKnowledgeAuthoringSource({
        ...envelope,
        capability: { ...envelope.capability, workspace: "physician" },
      }),
    ).toBeNull();
    expect(decodeKnowledgeAuthoringSource({ status: "blocked", reason: "FORBIDDEN" })).toBeNull();
    expect(
      decodeKnowledgeAuthoringSource({
        ...envelope,
        capability: { ...envelope.capability, expiresAt: "2020-01-01T00:00:00Z" },
      }),
    ).toBeNull();
  });
  it.each(["scope", "productId", "language", "kind", "entryId", "revision", "contentHash"])(
    "rejects scope/reference mismatch %s",
    async (key) => {
      const envelope = await source();
      const wrong: Record<string, unknown> = {
        scope: "institution",
        productId: knowledgeId(99),
        language: "ml",
        kind: "faq",
        entryId: knowledgeId(100),
        revision: 2,
        contentHash: "0".repeat(64),
      };
      expect(
        knowledgeAuthoringResultSchema.safeParse({
          ...envelope,
          capability: { ...envelope.capability, [key]: wrong[key] },
        }).success,
      ).toBe(false);
    },
  );
  it("cannot fabricate same-actor approval, an approved draft capability or draft withdrawal", async () => {
    const envelope = await source("approve");
    expect(decodeKnowledgeAuthoringSource(envelope)?.permission).toBe("approve");
    expect(
      decodeKnowledgeAuthoringSource({
        ...envelope,
        capability: {
          ...envelope.capability,
          actor: {
            ...envelope.capability.actor,
            actorId: envelope.record.content.editorId.toUpperCase(),
          },
        },
      }),
    ).toBeNull();
    expect(
      decodeKnowledgeAuthoringSource({
        ...(await source("edit")),
        capability: envelope.capability,
      }),
    ).toBeNull();
    expect(
      decodeKnowledgeAuthoringSource({
        ...envelope,
        capability: { ...envelope.capability, permission: "withdraw" },
      }),
    ).toBeNull();
    expect(decodeKnowledgeAuthoringSource(await source("view"))).toBeNull();
  });
  it("binds explicit view record to canonical actor/entry and caps responses", async () => {
    const envelope = await source("view");
    expect(
      decodeKnowledgeAuthoringRecord(envelope, {
        actorId: knowledgeId(3).toUpperCase(),
        entryId: envelope.record.content.entryId,
      })?.content.text,
    ).toBe(envelope.record.content.text);
    expect(
      decodeKnowledgeAuthoringRecord(envelope, {
        actorId: knowledgeId(99),
        entryId: envelope.record.content.entryId,
      }),
    ).toBeNull();
    expect(
      decodeKnowledgeAuthoringRecord(await source("edit"), {
        actorId: knowledgeId(3),
        entryId: envelope.record.content.entryId,
      }),
    ).toBeNull();
    expect(
      decodeKnowledgeAuthoringSource({
        ...(await source()),
        record: {
          ...envelope.record,
          content: {
            ...envelope.record.content,
            title: "x".repeat(knowledgeAuthoringResponseMaxBytes),
          },
        },
      }),
    ).toBeNull();
  });
  it("implements exact readSource/decodeSource/submit rather than leaving codec optional", async () => {
    const envelope = await source("approve");
    const transport = vi.fn(async () => ({ httpStatus: 200, body: envelope }));
    const port = createDecodedContentAuthoringPort(transport);
    const session = {
      userId: knowledgeId(3),
      expiresAt: envelope.capability.expiresAt,
      workspaces: [],
    };
    const signal = new AbortController().signal;
    const raw = await port.readSource(
      { session, record: envelope.record, permission: "approve" },
      signal,
    );
    expect(port.decodeSource(raw)?.permission).toBe("approve");
    expect(transport).toHaveBeenCalledWith({
      method: "GET",
      path: `/v1/knowledge/${envelope.record.content.entryId}/authoring?permission=approve`,
      signal,
    });
    await port.submit(
      {
        action: "approve",
        entryId: envelope.record.content.entryId,
        revision: 1,
        contentHash: envelope.record.contentHash,
      },
      signal,
    );
    expect(transport).toHaveBeenLastCalledWith({
      method: "POST",
      path: `/v1/knowledge/${envelope.record.content.entryId}/approve`,
      body: { revision: 1, contentHash: envelope.record.contentHash },
      signal,
    });
    expect(
      await port.readSource(
        {
          session: { ...session, userId: knowledgeId(90) },
          record: envelope.record,
          permission: "approve",
        },
        signal,
      ),
    ).toBeNull();
    expect(
      await port.readSource({ session, record: envelope.record, permission: "edit" }, signal),
    ).toBeNull();
    expect(
      await port.readSource(
        {
          session,
          record: { ...envelope.record, content: { ...envelope.record.content, title: "changed" } },
          permission: "approve",
        },
        signal,
      ),
    ).toBeNull();
  });
  it("does not dispatch expired/aborted reads and never retries failed mutations", async () => {
    const envelope = await source();
    const transport = vi.fn(async () => {
      throw new Error("synthetic transport failure");
    });
    const port = createDecodedContentAuthoringPort(transport);
    const controller = new AbortController();
    controller.abort();
    const context = {
      session: { userId: knowledgeId(3), expiresAt: envelope.capability.expiresAt, workspaces: [] },
      record: envelope.record,
      permission: "edit" as const,
    };
    expect(await port.readSource(context, controller.signal)).toBeNull();
    expect(transport).not.toHaveBeenCalled();
    await expect(
      port.submit(
        {
          action: "withdraw",
          entryId: envelope.record.content.entryId,
          revision: 1,
          contentHash: envelope.record.contentHash,
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow("synthetic transport failure");
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("preflights actual UTF-8 whole JSON body, not a multiplied per-source allowance", async () => {
    const fixture = await knowledgeFixture();
    const transport = vi.fn(async () => ({ httpStatus: 201, body: {} }));
    const port = createDecodedContentAuthoringPort(transport);
    const content = { ...fixture.monograph.content, text: "അ".repeat(16000) };
    await expect(
      port.submit(
        {
          action: "edit",
          content,
          sources: content.sources.map((source) => ({
            sourceId: source.sourceId,
            bytesBase64: "eHh4".repeat(16000),
          })),
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow("Authoring request body exceeds byte limit");
    expect(transport).not.toHaveBeenCalled();
  });
});
