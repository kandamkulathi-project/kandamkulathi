import { afterEach, describe, expect, it, vi } from "vitest";
import {
  approverId,
  editorId,
  syntheticRecord,
} from "../../apps/workspaces/src/content/__fixtures__/records";
import {
  createAuthoringLane,
  type PreparedAuthoringAttempt,
} from "../../apps/workspaces/src/content/authoring-attempt";
import {
  authoringRequest,
  draftCommand,
  persistedTransition,
} from "../../apps/workspaces/src/content/authoring-dto";
import {
  type AuthoringContext,
  AuthoringRejection,
  bindSourceAuthorization,
  mutationBody,
} from "../../apps/workspaces/src/content/authoring-port";
import { knowledgeRecordSchema } from "../../packages/contracts/src/knowledge";

afterEach(() => vi.useRealTimers());
function prepared(): PreparedAuthoringAttempt {
  return {
    checkCurrentAuthority: vi.fn(async () => true),
    submit: vi.fn(async () => ({ placeholder: "Exact backend codec remains owner-supplied" })),
    persistedRecord: () => syntheticRecord(),
    readCurrent: vi.fn(async () => ({ status: "ready" as const, data: syntheticRecord() })),
  };
}

describe("knowledge authoring orchestration seam — synthetic codec, not transport/grant evidence", () => {
  it("publishes success only after exact receipt decoding AND a fresh matching current read", async () => {
    const publish = vi.fn();
    const operation = prepared();
    await createAuthoringLane(publish).run(operation);
    expect(publish.mock.calls.map(([state]) => state.status)).toEqual([
      "checking",
      "submitting",
      "reloading",
      "ready",
    ]);
    expect(operation.submit).toHaveBeenCalledTimes(1);
    expect(operation.readCurrent).toHaveBeenCalledTimes(1);
  });
  it("does not dispatch when authoritative validation rejects stale/scope/actor authority", async () => {
    const publish = vi.fn();
    const operation = { ...prepared(), checkCurrentAuthority: vi.fn(async () => false) };
    await createAuthoringLane(publish).run(operation);
    expect(publish).toHaveBeenLastCalledWith({ status: "denied" });
    expect(operation.submit).not.toHaveBeenCalled();
  });
  it("treats malformed receipt or transport failure after dispatch as uncertain, never saved", async () => {
    for (const override of [
      { persistedRecord: () => null },
      {
        submit: async () => {
          throw new Error("private failure");
        },
      },
    ]) {
      const publish = vi.fn();
      const operation = { ...prepared(), ...override };
      const lane = createAuthoringLane(publish);
      await lane.run(operation);
      expect(publish).toHaveBeenLastCalledWith({ status: "unknown" });
      expect(await lane.run(operation)).toBe(false);
    }
  });
  it("sanitizes a pre-dispatch authority failure without making a mutation", async () => {
    const publish = vi.fn();
    const operation = {
      ...prepared(),
      checkCurrentAuthority: async () => {
        throw new Error("private authority error");
      },
    };
    await createAuthoringLane(publish).run(operation);
    expect(publish).toHaveBeenLastCalledWith({ status: "error" });
    expect(operation.submit).not.toHaveBeenCalled();
  });
  it.each([
    [401, "denied"],
    [403, "denied"],
    [409, "conflict"],
    [400, "invalid"],
    [503, "pending"],
  ] as const)(
    "clears an explicit HTTP %i failure and never retries the mutation",
    async (httpStatus, outcome) => {
      const publish = vi.fn();
      const operation = {
        ...prepared(),
        submit: vi.fn(async () => mutationBody({ httpStatus, body: null })),
      };
      const lane = createAuthoringLane(publish);
      await lane.run(operation);
      expect(publish).toHaveBeenLastCalledWith({ status: outcome });
      expect(await lane.run(operation)).toBe(false);
      expect(operation.submit).toHaveBeenCalledTimes(1);
      expect(operation.readCurrent).not.toHaveBeenCalled();
    },
  );
  it("rejects a concurrently changed current record rather than showing receipt-only success", async () => {
    const publish = vi.fn();
    await createAuthoringLane(publish).run({
      ...prepared(),
      readCurrent: async () => ({ status: "ready", data: syntheticRecord("approved") }),
    });
    expect(publish).toHaveBeenLastCalledWith({ status: "conflict" });
    expect(publish.mock.calls.some(([state]) => state.status === "ready")).toBe(false);
  });
  it("removes success when the post-mutation read is denied", async () => {
    const publish = vi.fn();
    await createAuthoringLane(publish).run({
      ...prepared(),
      readCurrent: async () => ({ status: "denied" }),
    });
    expect(publish).toHaveBeenLastCalledWith({ status: "denied" });
  });
  it("fences session/authority invalidation before dispatch and duplicate concurrent attempts", async () => {
    let authorize: ((value: boolean) => void) | undefined;
    const publish = vi.fn();
    const operation = {
      ...prepared(),
      checkCurrentAuthority: () =>
        new Promise<boolean>((resolve) => {
          authorize = resolve;
        }),
    };
    const lane = createAuthoringLane(publish);
    const first = lane.run(operation);
    expect(await lane.run(operation)).toBe(false);
    lane.invalidate();
    authorize?.(true);
    await first;
    expect(operation.submit).not.toHaveBeenCalled();
    expect(publish.mock.calls).toEqual([[{ status: "checking" }]]);
  });
  it("fences a late persisted reply after session invalidation", async () => {
    let finish: ((value: unknown) => void) | undefined;
    const publish = vi.fn();
    const operation = {
      ...prepared(),
      submit: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    };
    const lane = createAuthoringLane(publish);
    const attempt = lane.run(operation);
    await vi.waitFor(() => expect(finish).toBeDefined());
    lane.invalidate();
    finish?.({});
    await attempt;
    expect(operation.readCurrent).not.toHaveBeenCalled();
    expect(publish.mock.calls.map(([state]) => state.status)).toEqual(["checking", "submitting"]);
  });
  it("times out an in-flight mutation as unknown and fences late completion", async () => {
    vi.useFakeTimers();
    let finish: ((value: unknown) => void) | undefined;
    const publish = vi.fn();
    const lane = createAuthoringLane(publish, 20);
    const attempt = lane.run({
      ...prepared(),
      submit: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    await vi.advanceTimersByTimeAsync(20);
    expect(publish).toHaveBeenLastCalledWith({ status: "unknown" });
    finish?.({});
    await attempt;
    expect(publish).toHaveBeenLastCalledWith({ status: "unknown" });
  });
});

describe("Mathew frozen knowledge mutation DTOs", () => {
  it("prepares complete chained content and exact matching source uploads, not a legacy title-only DTO", () => {
    const previous = syntheticRecord();
    const command = draftCommand(
      previous,
      editorId.toUpperCase(),
      "Updated synthetic title",
      "Updated synthetic text",
      [
        {
          sourceId: previous.content.sources[0]?.sourceId.toUpperCase() ?? "",
          bytesBase64: "eA==",
        },
      ],
    );
    expect(command?.action).toBe("edit");
    if (command?.action !== "edit") throw new Error("Expected draft command");
    expect(command.content.revision).toBe(2);
    expect(command.content.previousContentHash).toBe(previous.contentHash);
    expect(command.content.editorId).toBe(editorId);
    expect(command.content.sources).toEqual(previous.content.sources);
    expect(authoringRequest(command)).toEqual({
      path: "/v1/knowledge/drafts",
      body: { content: command.content, sources: command.sources },
    });
    expect(draftCommand(previous, editorId, "Title", "Text", [])).toBeNull();
    expect(
      draftCommand(previous, editorId, "Title", "Text", [
        { ...command.sources[0], sourceId: editorId, bytesBase64: "eA==" },
      ]),
    ).toBeNull();
    expect(draftCommand(previous, editorId, " ", "Text", command.sources)).toBeNull();
  });
  it("accepts only exact persisted responses bound to the submitted independent approval", () => {
    const previous = syntheticRecord();
    const next = syntheticRecord("approved");
    const command = {
      action: "approve" as const,
      entryId: previous.content.entryId,
      revision: previous.content.revision,
      contentHash: previous.contentHash,
    };
    expect(authoringRequest(command)).toEqual({
      path: `/v1/knowledge/${command.entryId}/approve`,
      body: { revision: 1, contentHash: command.contentHash },
    });
    expect(
      persistedTransition(
        { status: "persisted", record: next },
        command,
        previous,
        approverId.toUpperCase(),
      )?.state,
    ).toBe("approved");
    expect(
      persistedTransition({ status: "candidate", record: next }, command, previous, approverId),
    ).toBeNull();
    expect(
      persistedTransition(
        { status: "persisted", record: next, extra: true },
        command,
        previous,
        approverId,
      ),
    ).toBeNull();
    expect(
      persistedTransition(
        { status: "persisted", record: next },
        command,
        previous,
        editorId.toUpperCase(),
      ),
    ).toBeNull();
    expect(
      persistedTransition(
        { status: "persisted", record: next },
        { ...command, revision: 2 },
        previous,
        approverId,
      ),
    ).toBeNull();
  });
  it("requires exact chained draft text/actor and preserved withdrawal approval", () => {
    const previous = syntheticRecord();
    const command = draftCommand(previous, editorId, "New title", "New text", [
      { sourceId: previous.content.sources[0]?.sourceId ?? "", bytesBase64: "eA==" },
    ]);
    if (command?.action !== "edit") throw new Error("Expected draft");
    const record = { state: "draft", contentHash: "c".repeat(64), content: command.content };
    expect(
      persistedTransition({ status: "persisted", record }, command, previous, editorId)?.content
        .title,
    ).toBe("New title");
    expect(
      persistedTransition(
        {
          status: "persisted",
          record: { ...record, content: { ...record.content, text: "Different" } },
        },
        command,
        previous,
        editorId,
      ),
    ).toBeNull();
    const approved = syntheticRecord("approved");
    const withdrawn = syntheticRecord("withdrawn");
    if (approved.state !== "approved" || withdrawn.state !== "withdrawn")
      throw new Error("Expected fixtures");
    const withdrawal = {
      action: "withdraw" as const,
      entryId: approved.content.entryId,
      revision: 1,
      contentHash: approved.contentHash,
    };
    expect(
      persistedTransition(
        { status: "persisted", record: withdrawn },
        withdrawal,
        approved,
        approverId,
      )?.state,
    ).toBe("withdrawn");
    expect(
      persistedTransition(
        {
          status: "persisted",
          record: { ...withdrawn, approval: { ...withdrawn.approval, authorityVersion: 2 } },
        },
        withdrawal,
        approved,
        approverId,
      ),
    ).toBeNull();
  });
});

describe("internal authoring source projection binding (no production source wire DTO supplied)", () => {
  const record = knowledgeRecordSchema.parse(syntheticRecord());
  const context: AuthoringContext = {
    session: {
      userId: approverId.toUpperCase(),
      expiresAt: "2099-10-20T10:00:00Z",
      workspaces: ["physician"],
    },
    record,
    permission: "approve",
  };
  const projection = {
    actor: {
      actorId: approverId,
      displayName: "Synthetic authority",
      authorityVersion: 1,
      evidenceId: "abcdefab-5555-4555-8555-555555555555",
    },
    record,
    permission: "approve",
    expiresAt: "2099-10-20T10:00:00Z",
  };
  it("binds canonical actor, record/version/scope, permission and current expiry without workspace inference", () => {
    expect(bindSourceAuthorization(projection, context)?.actor.actorId).toBe(approverId);
    expect(
      bindSourceAuthorization(projection, {
        ...context,
        session: { ...context.session, workspaces: [] },
      })?.actor.actorId,
    ).toBe(approverId);
    // Workspace presentation is separately gated. It supplies no authoring grant.
    expect(bindSourceAuthorization(null, context)).toBeNull();
  });
  it("rejects same-principal UUID alias self-approval, stale expiry and mismatched authority binding", () => {
    const editorContext = { ...context, session: { ...context.session, userId: editorId } };
    expect(
      bindSourceAuthorization(
        { ...projection, actor: { ...projection.actor, actorId: editorId.toUpperCase() } },
        editorContext,
      ),
    ).toBeNull();
    expect(
      bindSourceAuthorization({ ...projection, expiresAt: "2000-10-20T10:00:00Z" }, context),
    ).toBeNull();
    expect(bindSourceAuthorization({ ...projection, permission: "edit" }, context)).toBeNull();
    expect(
      bindSourceAuthorization(
        { ...projection, record: { ...record, content: { ...record.content, language: "ml" } } },
        context,
      ),
    ).toBeNull();
    expect(
      bindSourceAuthorization(
        { ...projection, record: { ...record, contentHash: "c".repeat(64) } },
        context,
      ),
    ).toBeNull();
    expect(
      bindSourceAuthorization(
        {
          ...projection,
          record: {
            ...record,
            content: { ...record.content, revision: 2, previousContentHash: record.contentHash },
          },
        },
        context,
      ),
    ).toBeNull();
    expect(
      bindSourceAuthorization(projection, {
        ...context,
        session: { ...context.session, expiresAt: "2000-10-20T10:00:00Z" },
      }),
    ).toBeNull();
    expect(
      bindSourceAuthorization(
        { ...projection, actor: { ...projection.actor, actorId: editorId } },
        context,
      ),
    ).toBeNull();
    expect(bindSourceAuthorization({ ...projection, canApprove: true }, context)).toBeNull();
  });
  it.each([
    [401, "denied"],
    [403, "denied"],
    [409, "conflict"],
    [400, "invalid"],
    [503, "pending"],
  ] as const)("maps explicit HTTP %i without leaking a response body", (httpStatus, outcome) => {
    try {
      mutationBody({ httpStatus, body: { private: "must not render" } });
      throw new Error("Expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthoringRejection);
      expect((error as AuthoringRejection).outcome).toBe(outcome);
    }
  });
});
