import { afterEach, describe, expect, it, vi } from "vitest";
import {
  approverId,
  editorId,
  syntheticRecord,
} from "../../apps/workspaces/src/content/__fixtures__/records";
import {
  contentSession,
  contentSessionKey,
  isRecordedEditor,
  parseContent,
  requestContent,
  validLocalDraft,
} from "../../apps/workspaces/src/content/model";
import { staffContent } from "../../packages/i18n/src/staff-content";

const session = { userId: editorId, expiresAt: "2026-10-24T12:00:00Z", workspaces: ["staff"] };
const now = Date.parse("2026-10-24T10:00:00Z");
afterEach(() => vi.useRealTimers());

describe("bounded content presentation", () => {
  it.each(["draft", "approved", "withdrawn"] as const)(
    "parses %s and preserves exact supplied content",
    (state) => {
      const input = syntheticRecord(state);
      const result = parseContent({ status: "ready", data: input });
      expect(result.status).toBe("ready");
      if (result.status !== "ready") throw new Error("Expected record");
      expect(result.record.content.text).toBe(input.content.text);
      expect(result.record.state).toBe(state);
      expect(result.record.content.sources).toEqual(input.content.sources);
    },
  );
  it("rejects self-approved UUID aliases without mutating input", () => {
    const input = syntheticRecord("approved");
    if (input.state !== "approved") throw new Error("Fixture");
    input.approval.approverId = editorId.toUpperCase();
    expect(parseContent({ status: "ready", data: input })).toEqual({ status: "invalid" });
    expect(input.approval.approverId).toBe(editorId.toUpperCase());
  });
  it("recognizes editor aliases separately from an independent actor", () => {
    const parsed = parseContent({ status: "ready", data: syntheticRecord() });
    if (parsed.status !== "ready") throw new Error("Fixture");
    expect(isRecordedEditor(editorId.toUpperCase(), parsed.record)).toBe(true);
    expect(isRecordedEditor(approverId, parsed.record)).toBe(false);
    expect(isRecordedEditor("invalid", parsed.record)).toBe(false);
  });
  it.each([
    (r: ReturnType<typeof syntheticRecord>) => ({ ...r, secret: "unexpected" }),
    (r: ReturnType<typeof syntheticRecord>) => ({ ...r, contentHash: "A".repeat(64) }),
    (r: ReturnType<typeof syntheticRecord>) => ({ ...r, content: { ...r.content, revision: 2 } }),
    (r: ReturnType<typeof syntheticRecord>) => ({
      ...r,
      content: { ...r.content, text: "x".repeat(16001) },
    }),
    (r: ReturnType<typeof syntheticRecord>) => ({
      ...r,
      content: {
        ...r.content,
        sources: [{ ...r.content.sources[0], publicUrl: "javascript:alert(1)" }],
      },
    }),
    (r: ReturnType<typeof syntheticRecord>) => ({
      ...r,
      content: { ...r.content, sources: [{ ...r.content.sources[0], visibility: "private" }] },
    }),
  ])("fails closed on malformed/extra/provenance input %#", (mutate) => {
    expect(parseContent({ status: "ready", data: mutate(syntheticRecord()) })).toEqual({
      status: "invalid",
    });
  });
  it("rejects invalid approval hashes and withdrawal chronology", () => {
    const input = syntheticRecord("withdrawn");
    if (input.state !== "withdrawn") throw new Error("Fixture");
    expect(
      parseContent({
        status: "ready",
        data: { ...input, approval: { ...input.approval, contentHash: "c".repeat(64) } },
      }).status,
    ).toBe("invalid");
    expect(
      parseContent({
        status: "ready",
        data: {
          ...input,
          withdrawal: { ...input.withdrawal, withdrawnAt: "2026-10-19T10:00:00Z" },
        },
      }).status,
    ).toBe("invalid");
  });
  it("keeps empty, denied, pending, loading and error distinct", () => {
    expect(parseContent({ status: "ready", data: null })).toEqual({ status: "empty" });
    expect(parseContent({ status: "unavailable" })).toEqual({ status: "pending" });
    for (const status of ["denied", "loading", "error", "anonymous"] as const)
      expect(parseContent({ status })).toEqual({ status });
  });
  it.each([
    undefined,
    null,
    {},
    { status: "saved" },
    { status: "ready" },
    { status: "denied", data: "private" },
  ])("rejects malformed resource envelopes %#", (input) => {
    expect(parseContent(input)).toEqual({ status: "invalid" });
    expect(contentSession(input, now)).toEqual({ status: "invalid" });
  });
  it("requires strict current staff/physician metadata, never an authoring grant", () => {
    expect(contentSession({ status: "ready", data: session }, now).status).toBe("ready");
    expect(
      contentSession({ status: "ready", data: { ...session, workspaces: ["physician"] } }, now)
        .status,
    ).toBe("ready");
    expect(
      contentSession({ status: "ready", data: { ...session, workspaces: ["customer"] } }, now)
        .status,
    ).toBe("denied");
    expect(
      contentSession({ status: "ready", data: { ...session, workspaces: [] } }, now).status,
    ).toBe("denied");
    expect(
      contentSession({ status: "ready", data: session }, Date.parse(session.expiresAt)).status,
    ).toBe("anonymous");
    expect(
      contentSession({ status: "ready", data: { ...session, canApprove: true } }, now).status,
    ).toBe("invalid");
    expect(
      contentSession({ status: "ready", data: { ...session, userId: "invalid" } }, now).status,
    ).toBe("invalid");
  });
  it("validates bounded nonblank local fields, not approval", () => {
    expect(validLocalDraft("Title", "Text")).toBe(true);
    expect(validLocalDraft(" ", "Text")).toBe(false);
    expect(validLocalDraft("Title", "\n")).toBe(false);
    expect(validLocalDraft("x".repeat(201), "Text")).toBe(false);
    expect(validLocalDraft("Title", "x".repeat(16001))).toBe(false);
    expect(validLocalDraft("x".repeat(200), "x".repeat(16000))).toBe(true);
  });
  it("invalidates draft scope on principal, expiry or same-principal workspace changes", () => {
    const base = { ...session, workspaces: ["staff"] as ["staff"] };
    expect(contentSessionKey({ ...base, userId: editorId.toUpperCase() })).toBe(
      contentSessionKey(base),
    );
    expect(contentSessionKey({ ...base, userId: approverId })).not.toBe(contentSessionKey(base));
    expect(contentSessionKey({ ...base, expiresAt: "2026-10-24T11:00:00Z" })).not.toBe(
      contentSessionKey(base),
    );
    expect(contentSessionKey({ ...base, workspaces: ["physician"] })).not.toBe(
      contentSessionKey(base),
    );
    expect(contentSessionKey({ ...base, workspaces: ["physician", "staff"] })).toBe(
      contentSessionKey({ ...base, workspaces: ["staff", "physician"] }),
    );
  });
  it("cancels readers and discards late success after scope invalidation", async () => {
    let finish: ((value: { status: "ready"; data: unknown }) => void) | undefined;
    let signal: AbortSignal | undefined;
    const publish = vi.fn();
    const cancel = requestContent((input) => {
      signal = input;
      return new Promise((resolve) => {
        finish = resolve;
      });
    }, publish);
    await Promise.resolve();
    cancel();
    finish?.({ status: "ready", data: syntheticRecord() });
    await vi.waitFor(() => expect(signal?.aborted).toBe(true));
    expect(publish.mock.calls).toEqual([[{ status: "loading" }]]);
  });
  it("times out without later restoring data", async () => {
    vi.useFakeTimers();
    let finish: ((value: { status: "ready"; data: unknown }) => void) | undefined;
    const publish = vi.fn();
    const cancel = requestContent(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      publish,
      20,
    );
    await vi.advanceTimersByTimeAsync(20);
    finish?.({ status: "ready", data: syntheticRecord() });
    await vi.advanceTimersByTimeAsync(0);
    expect(publish.mock.calls).toEqual([[{ status: "loading" }], [{ status: "error" }]]);
    cancel();
  });
  it("sanitizes thrown reads and allows an explicit retry", async () => {
    const publish = vi.fn();
    const cancel = requestContent(() => {
      throw new Error("Private details");
    }, publish);
    await vi.waitFor(() => expect(publish).toHaveBeenLastCalledWith({ status: "error" }));
    cancel();
    const retry = requestContent(
      async () => ({ status: "ready", data: syntheticRecord() }),
      publish,
    );
    await vi.waitFor(() => expect(publish.mock.lastCall?.[0].status).toBe("ready"));
    retry();
  });
  it("has identical nonempty nonclinical keys in EN/ML/TA", () => {
    for (const locale of ["en", "ml", "ta"] as const) {
      expect(Object.keys(staffContent[locale]).sort()).toEqual(Object.keys(staffContent.en).sort());
      expect(Object.values(staffContent[locale]).every((value) => value.trim().length > 0)).toBe(
        true,
      );
    }
  });
});
