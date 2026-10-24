import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceBrowserTransport } from "../../apps/workspaces/src/browserTransport";
import type { TestFetch } from "../fixtures/fetch";

const origin = "https://api.example.test";
const userId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const now = Date.now();
const session = { userId, expiresAt: new Date(now + 60000).toISOString(), workspaces: [] };
const context = {
  userId,
  sessionId,
  expiresAt: new Date(now + 30000).toISOString(),
  csrfToken: "synthetic_csrf_fixture_01234567890123456789",
};
const disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  vi.useRealTimers();
});
function setup(transport: typeof fetch, active = () => true) {
  const onRevoked = vi.fn();
  const client = createWorkspaceBrowserTransport({
    origin,
    local: false,
    session,
    active,
    onRevoked,
    transport,
  });
  disposers.push(client.dispose);
  return { ...client, onRevoked };
}
const post = {
  method: "POST",
  headers: { "Content-Type": "application/json", "Idempotency-Key": "caller-operation" },
  body: '{"value":1}',
};

describe("root browser transport", () => {
  it("provides only a paired lifecycle permit, with actual CSRF fetched exactly once on POST", async () => {
    const underlying = vi.fn<TestFetch>(async (input, init) => {
      const request = new Request(input, init);
      if (request.url.endsWith("/context")) return Response.json(context);
      expect(request.headers.has("x-csrf-token")).toBe(true);
      return new Response(null, { status: 204 });
    });
    const client = setup(underlying);
    const signal = new AbortController().signal;
    const permit = await client.authorizeMutation(signal);
    expect([...new Headers(permit)]).toEqual([]);
    expect(underlying).not.toHaveBeenCalled();
    expect(
      (await client.transport(`${origin}/v1/orders`, { method: "POST", headers: permit, signal }))
        .status,
    ).toBe(204);
    expect(underlying).toHaveBeenCalledTimes(2);
  });

  it.each(["aborted", "inactive", "expired", "disposed"])(
    "denies a lifecycle permit when %s without network work",
    async (state) => {
      vi.useFakeTimers();
      vi.setSystemTime(now);
      const underlying = vi.fn<TestFetch>();
      const client = setup(underlying, () => state !== "inactive");
      const controller = new AbortController();
      if (state === "aborted") controller.abort();
      if (state === "expired") vi.setSystemTime(now + 60001);
      if (state === "disposed") client.dispose();
      await expect(client.authorizeMutation(controller.signal)).rejects.toMatchObject({
        name: "AbortError",
      });
      expect(underlying).not.toHaveBeenCalled();
    },
  );

  it("does not let an earlier lifecycle permit bypass an epoch invalidated before POST", async () => {
    let active = true;
    const underlying = vi.fn<TestFetch>();
    const client = setup(underlying, () => active);
    const signal = new AbortController().signal;
    const permit = await client.authorizeMutation(signal);
    active = false;
    await expect(
      client.transport(`${origin}/v1/orders`, { method: "POST", headers: permit, signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(underlying).not.toHaveBeenCalled();
  });

  it.each([
    "http://api.example.test",
    `${origin}/`,
    `${origin}/path`,
    `${origin}?x=1`,
    "https://actor@api.example.test",
  ])("rejects noncanonical or insecure configured origin", (value) => {
    expect(() =>
      createWorkspaceBrowserTransport({
        origin: value,
        local: false,
        session,
        active: () => true,
        onRevoked: () => {},
      }),
    ).toThrow();
  });

  it.each([401, 403, 503])("context status %s blocks mutation without retry", async (status) => {
    const underlying = vi.fn<TestFetch>(async () => new Response(null, { status }));
    const client = setup(underlying);
    await expect(client.transport(`${origin}/v1/orders`, post)).rejects.toThrow();
    expect(underlying).toHaveBeenCalledTimes(1);
    expect(client.onRevoked).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
  });

  it("denies invalid context JSON and does not dispatch a mutation", async () => {
    const underlying = vi.fn<TestFetch>(async () => new Response("not JSON"));
    const client = setup(underlying);
    await expect(client.transport(`${origin}/v1/orders`, post)).rejects.toThrow();
    expect(underlying).toHaveBeenCalledTimes(1);
  });

  it("fences a context that expires while the business response is pending", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const underlying = vi.fn<TestFetch>(async (input) => {
      if (String(input).endsWith("/context")) return Response.json(context);
      vi.setSystemTime(now + 30001);
      return new Response();
    });
    const client = setup(underlying);
    await expect(client.transport(`${origin}/v1/orders`, post)).rejects.toThrow(
      "Security context expired",
    );
    expect(underlying).toHaveBeenCalledTimes(2);
  });

  it("never dispatches network work for an already aborted caller", async () => {
    const controller = new AbortController();
    controller.abort();
    const underlying = vi.fn<TestFetch>();
    const client = setup(underlying);
    await expect(
      client.transport(`${origin}/v1/orders`, { ...post, signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(underlying).not.toHaveBeenCalled();
  });

  it("fetches a fresh strict context for each POST and preserves caller operation/body and response identity", async () => {
    const requests: Request[] = [];
    const response = new Response("denied", { status: 403 });
    const client = setup(async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      return request.url.endsWith("/context") ? Response.json(context) : response;
    });
    for (let i = 0; i < 2; i++)
      expect(await client.transport(`${origin}/v1/orders`, post)).toBe(response);
    expect(requests.map((r) => new URL(r.url).pathname)).toEqual([
      "/v1/security/context",
      "/v1/orders",
      "/v1/security/context",
      "/v1/orders",
    ]);
    for (const request of requests) {
      expect(request.credentials).toBe("include");
      expect(request.cache).toBe("no-store");
      expect(request.redirect).toBe("error");
    }
    const mutation = requests[1];
    expect(mutation?.headers.has("x-csrf-token")).toBe(true);
    expect(mutation?.headers.get("idempotency-key")).toBe("caller-operation");
    expect(mutation?.headers.get("content-type")).toBe("application/json");
    expect(await mutation?.text()).toBe(post.body);
    expect(client.onRevoked).not.toHaveBeenCalled();
  });

  it("allows query-bearing GET without context or invented operation IDs", async () => {
    const underlying = vi.fn<TestFetch>(async (input, init) => {
      const request = new Request(input, init);
      expect(request.headers.has("idempotency-key")).toBe(false);
      return new Response(null, { status: 204 });
    });
    const client = setup(underlying);
    expect((await client.transport(`${origin}/v1/catalogue?limit=10&cursor=next`)).status).toBe(
      204,
    );
    expect(underlying).toHaveBeenCalledTimes(1);
  });

  it.each([
    "https://other.example.test/v1/orders",
    `${origin}/v1/orders#`,
    `${origin}/v1/orders#x`,
    `${origin}/v1/../admin`,
    `${origin}/v1/%2fadmin`,
    `${origin}/v1/orders?a=1&a=2`,
    `${origin}/v1/orders?a=1&%61=2`,
    "https://actor:password@api.example.test/v1/orders",
    `${origin}/admin`,
    `${origin}/v1//../orders`,
  ])("rejects unsafe URLs before network: %s", async (url) => {
    const underlying = vi.fn<TestFetch>();
    const client = setup(underlying);
    await expect(client.transport(url)).rejects.toThrow();
    expect(underlying).not.toHaveBeenCalled();
  });

  it.each([
    { method: "PUT" },
    { method: "DELETE" },
    { method: "HEAD" },
    { headers: { Authorization: "Bearer synthetic" } },
    { headers: { "X-CSRF-Token": "untrusted" } },
  ])("rejects unsupported request options", async (init) => {
    const underlying = vi.fn<TestFetch>();
    const client = setup(underlying);
    await expect(client.transport(`${origin}/v1/orders`, init)).rejects.toThrow();
    expect(underlying).not.toHaveBeenCalled();
  });

  it.each([
    { ...context, userId: sessionId },
    { ...context, expiresAt: new Date(now - 1000).toISOString() },
    { ...context, expiresAt: new Date(now + 120000).toISOString() },
    { ...context, workspaces: ["staff"] },
    { ...context, csrfToken: "short" },
    {},
  ])("blocks mutation for mismatched, expired or malformed context", async (value) => {
    const underlying = vi.fn<TestFetch>(async () => Response.json(value));
    const client = setup(underlying);
    await expect(client.transport(`${origin}/v1/orders`, post)).rejects.toThrow();
    expect(underlying).toHaveBeenCalledTimes(1);
  });

  it("pins the first session ID for the entire transport lifetime", async () => {
    let reads = 0;
    let mutations = 0;
    const client = setup(async (input) => {
      if (String(input instanceof Request ? input.url : input).endsWith("/context"))
        return Response.json({ ...context, sessionId: reads++ ? userId : sessionId });
      mutations++;
      return new Response();
    });
    await client.transport(`${origin}/v1/orders`, post);
    await expect(client.transport(`${origin}/v1/orders`, post)).rejects.toThrow();
    expect(mutations).toBe(1);
  });

  it.each(["context", "business"])(
    "disposal aborts pending %s and fences a late ignored-abort response",
    async (phase) => {
      let resolve: (response: Response) => void = () => {};
      let started: () => void = () => {};
      const ready = new Promise<void>((r) => {
        started = r;
      });
      let signal: AbortSignal | null | undefined;
      const client = setup(async (input, init) => {
        const url = input instanceof Request ? input.url : String(input);
        if (phase === "business" && url.endsWith("/context")) return Response.json(context);
        signal = init?.signal;
        started();
        return new Promise<Response>((r) => {
          resolve = r;
        });
      });
      const result = client.transport(`${origin}/v1/orders`, post);
      await ready;
      client.dispose();
      expect(signal?.aborted).toBe(true);
      resolve(Response.json(context));
      await expect(result).rejects.toMatchObject({ name: "AbortError" });
    },
  );

  it("propagates caller abort without mutation or retry", async () => {
    const controller = new AbortController();
    const reason = new Error("caller cancelled");
    const underlying = vi.fn<TestFetch>(async () => {
      controller.abort(reason);
      return Response.json(context);
    });
    const client = setup(underlying);
    await expect(
      client.transport(`${origin}/v1/orders`, { ...post, signal: controller.signal }),
    ).rejects.toBe(reason);
    expect(underlying).toHaveBeenCalledTimes(1);
  });

  it("fences inactive epochs and expiry after a response", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    let active = true;
    const underlying = vi.fn<TestFetch>(async () => {
      active = false;
      return new Response();
    });
    const client = setup(underlying, () => active);
    await expect(client.transport(`${origin}/v1/orders`)).rejects.toMatchObject({
      name: "AbortError",
    });
    active = true;
    vi.setSystemTime(now + 60001);
    await expect(client.transport(`${origin}/v1/orders`)).rejects.toThrow();
    expect(underlying).toHaveBeenCalledTimes(1);
    expect(client.onRevoked).toHaveBeenCalledOnce();
  });

  it.each([401, 403, 503])(
    "returns original business status %s without retry; only 401 revokes",
    async (status) => {
      const response = new Response(null, { status });
      const underlying = vi.fn<TestFetch>(async () => response);
      const client = setup(underlying);
      expect(await client.transport(`${origin}/v1/orders`)).toBe(response);
      expect(underlying).toHaveBeenCalledTimes(1);
      expect(client.onRevoked).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
    },
  );

  it("does not retry a network-uncertain POST", async () => {
    const underlying = vi.fn<TestFetch>(async (input) => {
      if (String(input).endsWith("/context")) return Response.json(context);
      throw new TypeError("Synthetic network failure");
    });
    const client = setup(underlying);
    await expect(client.transport(`${origin}/v1/orders`, post)).rejects.toThrow();
    expect(underlying).toHaveBeenCalledTimes(2);
  });
});
