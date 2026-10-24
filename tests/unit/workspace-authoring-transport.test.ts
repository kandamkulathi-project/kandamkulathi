import { describe, expect, it, vi } from "vitest";
import { createBrowserAuthoringTransport } from "../../apps/workspaces/src/content/browser-authoring";
import type { TestFetch } from "../fixtures/fetch";

const read = (signal = new AbortController().signal) => ({
  method: "GET" as const,
  path: "/v1/knowledge/10000000-0000-4000-8000-000000000001/authoring",
  signal,
});
describe("root knowledge raw HTTP boundary", () => {
  it("uses the paired transport and preserves HTTP outcomes after bounded JSON decoding", async () => {
    const fetcher = vi.fn<TestFetch>(async () =>
      Response.json({ status: "blocked", reason: "FORBIDDEN" }, { status: 403 }),
    );
    const transport = createBrowserAuthoringTransport("https://core.example", fetcher);
    expect(await transport(read())).toEqual({
      httpStatus: 403,
      body: { status: "blocked", reason: "FORBIDDEN" },
    });
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: "GET",
      credentials: "include",
      cache: "no-store",
      redirect: "error",
    });
  });
  it("caps the actual UTF-8 JSON body before making any mutation request", async () => {
    const fetcher = vi.fn<TestFetch>();
    await expect(
      createBrowserAuthoringTransport(
        "https://core.example",
        fetcher,
      )({ ...read(), method: "POST", body: { text: "മ".repeat(22000) } }),
    ).rejects.toThrow("request exceeds");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("cancels an oversized stream before JSON parsing", async () => {
    const cancel = vi.fn();
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(65537));
        },
        cancel,
      }),
    );
    const fetcher = vi.fn<TestFetch>(async () => response);
    await expect(
      createBrowserAuthoringTransport("https://core.example", fetcher)(read()),
    ).rejects.toThrow("response exceeds");
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("aborts body reading even after response headers have arrived", async () => {
    const cancel = vi.fn();
    const controller = new AbortController();
    const fetcher = vi.fn<TestFetch>(async () => new Response(new ReadableStream({ cancel })));
    const pending = createBrowserAuthoringTransport(
      "https://core.example",
      fetcher,
    )(read(controller.signal));
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("rejects malformed UTF-8 or JSON and never turns it into a successful record", async () => {
    const fetcher = vi.fn<TestFetch>(async () => new Response(new Uint8Array([0xff])));
    await expect(
      createBrowserAuthoringTransport("https://core.example", fetcher)(read()),
    ).rejects.toThrow();
  });
});
