import { describe, expect, it, vi } from "vitest";
import { nativeCompanionOperations } from "../../apps/mobile/src/companionOperations";
import type { SensitiveClient, SensitiveResult } from "../../packages/client/src/sensitive";
import type { Handoff, KnowledgeReply } from "../../packages/contracts/src/client-knowledge";
import { reply } from "../fixtures/knowledge";
import { reference } from "../fixtures/sensitive";

const queued: Handoff = { id: reference, status: "queued" };
function operationId(input: unknown) {
  if (typeof input === "object" && input && "operationId" in input) return input.operationId;
  throw new Error("Expected chat input");
}
function setup() {
  let next = 0;
  const chat = vi.fn<SensitiveClient["chat"]>().mockResolvedValue({ status: "ready", data: reply });
  const requestHandoff = vi
    .fn<SensitiveClient["requestHandoff"]>()
    .mockResolvedValue({ status: "ready", data: queued });
  const operations = nativeCompanionOperations(
    { chat, requestHandoff },
    () => `operation-${++next}`,
  );
  return { operations, chat, requestHandoff };
}

describe("native Companion explicit action identities", () => {
  it("retires completed identical sends and handoffs", async () => {
    const { operations, chat, requestHandoff } = setup();
    await operations.send("Synthetic question", "en");
    await operations.send("Synthetic question", "en");
    expect(chat.mock.calls.map(([input]) => operationId(input))).toEqual([
      "operation-1",
      "operation-2",
    ]);
    await operations.requestHandoff("en");
    await operations.requestHandoff("en");
    expect(requestHandoff.mock.calls.map(([id]) => id)).toEqual(["operation-3", "operation-4"]);
  });

  it.each(["unknown", "unavailable", "error", "busy"] as const)(
    "retains an unchanged %s retry and separates changed locale/payload intents",
    async (status) => {
      const { operations, chat } = setup();
      chat.mockResolvedValue({ status });
      await operations.send("Synthetic question", "en");
      await operations.send("Synthetic question", "en");
      await operations.send("Edited question", "en");
      await operations.send("Synthetic question", "ml");
      expect(chat.mock.calls.map(([input]) => operationId(input))).toEqual([
        "operation-1",
        "operation-1",
        "operation-2",
        "operation-3",
      ]);
    },
  );

  it.each(["unknown", "unavailable", "error", "busy"] as const)(
    "retains %s handoffs without reusing an identity across languages",
    async (status) => {
      const { operations, requestHandoff } = setup();
      requestHandoff.mockResolvedValue({ status });
      await operations.requestHandoff("en");
      await operations.requestHandoff("en");
      await operations.requestHandoff("ta");
      expect(requestHandoff.mock.calls.map(([id]) => id)).toEqual([
        "operation-1",
        "operation-1",
        "operation-2",
      ]);
    },
  );

  it.each(["anonymous", "denied", "conflict", "expired"] as const)(
    "retires definitively rejected %s actions",
    async (status) => {
      const { operations, chat, requestHandoff } = setup();
      chat.mockResolvedValue({ status });
      requestHandoff.mockResolvedValue({ status });
      await operations.send("Synthetic question", "en");
      await operations.send("Synthetic question", "en");
      await operations.requestHandoff("en");
      await operations.requestHandoff("en");
      expect(chat.mock.calls[0]?.[0]).not.toEqual(chat.mock.calls[1]?.[0]);
      expect(requestHandoff.mock.calls[0]?.[0]).not.toBe(requestHandoff.mock.calls[1]?.[0]);
    },
  );

  it("keeps a thrown/uncertain operation retryable and releases its busy lock", async () => {
    const { operations, chat, requestHandoff } = setup();
    chat.mockRejectedValueOnce(new Error("Synthetic disconnect"));
    requestHandoff.mockRejectedValueOnce(new Error("Synthetic disconnect"));
    expect(await operations.send("Synthetic question", "en")).toEqual({ status: "unknown" });
    await operations.send("Synthetic question", "en");
    expect(chat.mock.calls[0]?.[0]).toEqual(chat.mock.calls[1]?.[0]);
    expect(await operations.requestHandoff("en")).toEqual({ status: "unknown" });
    await operations.requestHandoff("en");
    expect(requestHandoff.mock.calls[0]?.[0]).toBe(requestHandoff.mock.calls[1]?.[0]);
  });

  it("rejects overlapping presses without allocating or sending another action", async () => {
    const { operations, chat, requestHandoff } = setup();
    let finish: ((result: SensitiveResult<KnowledgeReply>) => void) | undefined;
    chat.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const first = operations.send("Synthetic question", "en");
    expect(await operations.send("Synthetic question", "en")).toEqual({ status: "busy" });
    expect(await operations.requestHandoff("en")).toEqual({ status: "busy" });
    expect(chat).toHaveBeenCalledTimes(1);
    expect(requestHandoff).not.toHaveBeenCalled();
    finish?.({ status: "ready", data: reply });
    await first;
    await operations.requestHandoff("en");
    expect(requestHandoff.mock.calls[0]?.[0]).toBe("operation-2");
  });

  it("does not confuse chat and handoff uncertainty or retain completed action history", async () => {
    const { operations, chat, requestHandoff } = setup();
    requestHandoff.mockResolvedValueOnce({ status: "unknown" });
    await operations.requestHandoff("en");
    for (let i = 0; i < 65; i++) await operations.send(`Synthetic question ${i}`, "en");
    await operations.requestHandoff("en");
    expect(chat).toHaveBeenCalledTimes(65);
    expect(new Set(chat.mock.calls.map(([input]) => operationId(input))).size).toBe(65);
    expect(requestHandoff.mock.calls.map(([id]) => id)).toEqual(["operation-1", "operation-1"]);
  });
});
