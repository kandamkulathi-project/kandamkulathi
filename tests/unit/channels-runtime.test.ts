import { describe, expect, it, vi } from "vitest";
import { postgresChannelInbox } from "../../packages/database/src/channels";
import type { DatabaseContext } from "../../packages/database/src/client";

describe("persisted channel ingress input boundary", () => {
  it("rejects malformed receipts before opening a transaction", async () => {
    const query = vi.fn();
    const inbox = postgresChannelInbox({ client: { query } } as unknown as DatabaseContext);
    await expect(
      inbox.commitBatch([{ semanticKey: "x", contentSha256: "invalid", event: {} }] as never),
    ).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
  it("rejects batches above the bounded provider receipt limit", async () => {
    const query = vi.fn();
    const inbox = postgresChannelInbox({ client: { query } } as unknown as DatabaseContext);
    await expect(inbox.commitBatch(new Array(101).fill({}) as never)).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
});
