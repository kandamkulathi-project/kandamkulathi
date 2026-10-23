import { describe, expect, it, vi } from "vitest";
import {
  type DatabaseClient,
  inTransaction,
  transaction,
} from "../../packages/database/src/client";

describe("exclusive transaction lifecycle", () => {
  it("reserves before BEGIN settles, rejects overlap and allows sequential reuse", async () => {
    let begin: (() => void) | undefined;
    const query = vi.fn(async (sql: string) => {
      if (sql === "BEGIN" && !begin)
        await new Promise<void>((resolve) => {
          begin = resolve;
        });
      return { command: sql, rows: [] };
    });
    const client = { query } as unknown as DatabaseClient;
    const callback = vi.fn(async () => 42);
    const first = transaction(client, callback);
    expect(inTransaction(client)).toBe(true);
    const overlap = vi.fn(async () => 0);
    await expect(transaction(client, overlap)).rejects.toThrow("Overlapping or nested");
    expect(overlap).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
    begin?.();
    await expect(first).resolves.toBe(42);
    expect(inTransaction(client)).toBe(false);
    await expect(transaction(client, async () => 43)).resolves.toBe(43);
  });

  it("failed BEGIN clears reservation without entering callback or rolling back another boundary", async () => {
    const query = vi
      .fn()
      .mockRejectedValueOnce(new Error("begin-failed"))
      .mockImplementation(async (sql: string) => ({ command: sql, rows: [] }));
    const client = { query } as unknown as DatabaseClient;
    const callback = vi.fn(async () => 42);
    await expect(transaction(client, callback)).rejects.toThrow("begin-failed");
    expect(callback).not.toHaveBeenCalled();
    expect(query.mock.calls).toEqual([["BEGIN"]]);
    expect(inTransaction(client)).toBe(false);
    await expect(transaction(client, async () => 43)).resolves.toBe(43);
  });

  it.each(["SET LOCAL statement_timeout = '5s'", "COMMIT", "ROLLBACK"])(
    "releases reservation when %s fails",
    async (failure) => {
      let failOnce = true;
      const query = vi.fn(async (sql: string) => {
        if (sql === failure && failOnce) {
          failOnce = false;
          throw new Error("synthetic-query-failure");
        }
        return { command: sql, rows: [] };
      });
      const client = { query } as unknown as DatabaseClient;
      await expect(
        transaction(client, async () => {
          if (failure === "ROLLBACK") throw new Error("callback-failed");
        }),
      ).rejects.toThrow("synthetic-query-failure");
      expect(inTransaction(client)).toBe(false);
      await expect(transaction(client, async () => 42)).resolves.toBe(42);
    },
  );

  it("rejects nested callbacks while allowing the outer transaction to roll back and release", async () => {
    const query = vi.fn(async () => {});
    const client = { query } as unknown as DatabaseClient;
    const nested = vi.fn(async () => {});
    await expect(transaction(client, () => transaction(client, nested))).rejects.toThrow(
      "Overlapping or nested",
    );
    expect(nested).not.toHaveBeenCalled();
    expect(query.mock.calls.at(-1)).toEqual(["ROLLBACK"]);
    expect(inTransaction(client)).toBe(false);
  });

  it.each(["ROLLBACK", "", "SELECT"])(
    "rejects a non-COMMIT command tag %s without retrying the callback",
    async (tag) => {
      let first = true;
      const query = vi.fn(async (sql: string) => {
        if (sql === "COMMIT" && first) {
          first = false;
          return { command: tag, rows: [] };
        }
        return { command: sql, rows: [] };
      });
      const client = { query } as unknown as DatabaseClient;
      const callback = vi.fn(async () => "discarded-result");
      await expect(transaction(client, callback)).rejects.toThrow("did not commit");
      expect(callback).toHaveBeenCalledTimes(1);
      expect(query.mock.calls.at(-1)).toEqual(["COMMIT"]);
      expect(inTransaction(client)).toBe(false);
      await expect(transaction(client, async () => 42)).resolves.toBe(42);
    },
  );
});
