import { describe, expect, it, vi } from "vitest";
import type { TestFetch } from "../fixtures/fetch";

describe("shared browser/native fetch test signature", () => {
  it("retains URL, string and Request inputs without narrowing the merged global overloads", async () => {
    const transport = vi.fn<TestFetch>(async () => Response.json({ status: "synthetic" }));
    const compatible: typeof fetch = transport;
    const url = new URL("https://api.example.com/v1/session");
    const request = new Request(url.href);
    for (const input of [url.href, url, request]) {
      const response = await compatible(input, { cache: "no-store" });
      expect(await response.json()).toEqual({ status: "synthetic" });
    }
    expect(transport.mock.calls.map(([input]) => input)).toEqual([url.href, url, request]);
    expect(transport).toHaveBeenCalledTimes(3);
  });
});
