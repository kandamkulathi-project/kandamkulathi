import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type BootstrapState,
  createConsentBootstrapClient,
} from "../../packages/client/src/consent-bootstrap";
import { consentBootstrapLabels } from "../../packages/i18n/src/consent-bootstrap";
import type { TestFetch } from "../fixtures/fetch";

const actorId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const recordId = "33333333-3333-4333-8333-333333333333";
const instant = Date.parse("2026-10-24T10:00:00Z");
const expiry = new Date(instant + 60_000).toISOString();
const text = "Synthetic test policy ONLY.\n<b>Plain text</b>\nസ്വകാര്യത தனியுரிமை";
const disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  vi.useRealTimers();
});
async function fixture() {
  const sha256 = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))),
  )
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return {
    actorId,
    sessionId,
    expiresAt: expiry,
    requirement: { purpose: "privacy", version: "synthetic-v1", actorId },
    policy: { text, revision: "synthetic-r1", sha256, approvalReference: "synthetic-only" },
  };
}
const context = {
  userId: actorId,
  sessionId,
  expiresAt: expiry,
  csrfToken: "synthetic_csrf_012345678901234567890123456789",
};
const session = { userId: actorId, expiresAt: expiry, workspaces: ["customer"] };
async function setup(
  options: {
    bootstrap?: unknown;
    ctx?: unknown;
    post?: () => Promise<Response>;
    sessionAfter?: () => Promise<Response>;
  } = {},
) {
  const bootstrap = options.bootstrap ?? (await fixture());
  const states: BootstrapState[] = [];
  let posts = 0;
  const transport = vi.fn<TestFetch>(async (input, init) => {
    const request = new Request(input, init);
    expect(request.credentials).toBe("include");
    expect(request.cache).toBe("no-store");
    expect(request.redirect).toBe("error");
    if (request.url.endsWith("/session"))
      return posts && options.sessionAfter
        ? options.sessionAfter()
        : posts
          ? Response.json(session)
          : Response.json({}, { status: 403 });
    if (request.url.endsWith("/consent-bootstrap")) return Response.json(bootstrap);
    if (request.url.endsWith("/context")) return Response.json(options.ctx ?? context);
    expect(request.url).toBe("https://api.example.test/v1/consents");
    expect(request.headers.get("X-CSRF-Token")).toBe(context.csrfToken);
    expect(await request.json()).toEqual({
      requirement: (await fixture()).requirement,
      decision: "granted",
    });
    expect(request.headers.has("authorization")).toBe(false);
    posts++;
    return options.post ? options.post() : Response.json({ id: recordId }, { status: 201 });
  });
  const onVerified = vi.fn();
  const client = createConsentBootstrapClient({
    origin: "https://api.example.test",
    local: false,
    now: () => instant,
    transport,
    onChange: (state) => states.push(state),
    onVerified,
  });
  disposers.push(client.dispose);
  return { ...client, states, transport, onVerified, posts: () => posts };
}
describe("browser privacy bootstrap", () => {
  it("does not fetch until explicit review, verifies exact policy and fresh context, then persisted ID and real session", async () => {
    const client = await setup();
    expect(client.transport).not.toHaveBeenCalled();
    await client.load();
    expect(client.states.at(-1)).toEqual({ status: "ready", bootstrap: await fixture() });
    expect(client.onVerified).not.toHaveBeenCalled();
    await client.grant();
    expect(client.states.map((state) => state.status)).toEqual([
      "loading",
      "ready",
      "submitting",
      "verifying",
      "verified",
    ]);
    expect(client.onVerified).toHaveBeenCalledOnce();
    expect(client.posts()).toBe(1);
    expect(client.transport.mock.calls.map(([input]) => String(input).split("/v1/")[1])).toEqual([
      "session",
      "consent-bootstrap",
      "security/context",
      "consents",
      "session",
    ]);
  });
  it.each(["extra", "actor", "hash", "expired"])("rejects invalid bootstrap: %s", async (kind) => {
    const bootstrap = await fixture();
    const value =
      kind === "extra"
        ? { ...bootstrap, workspaces: [] }
        : kind === "actor"
          ? { ...bootstrap, actorId: recordId }
          : kind === "hash"
            ? { ...bootstrap, policy: { ...bootstrap.policy, sha256: "0".repeat(64) } }
            : { ...bootstrap, expiresAt: new Date(instant).toISOString() };
    const client = await setup({ bootstrap: value });
    await client.load();
    await client.grant();
    expect(client.states.at(-1)?.status).toBe(kind === "expired" ? "expired" : "error");
    expect(client.posts()).toBe(0);
  });
  it.each(["actor", "session", "expired", "longer", "extra"])(
    "never sends consent for invalid context: %s",
    async (kind) => {
      const ctx =
        kind === "actor"
          ? { ...context, userId: recordId }
          : kind === "session"
            ? { ...context, sessionId: recordId }
            : kind === "expired"
              ? { ...context, expiresAt: new Date(instant).toISOString() }
              : kind === "longer"
                ? { ...context, expiresAt: new Date(instant + 60001).toISOString() }
                : { ...context, ignored: true };
      const client = await setup({ ctx });
      await client.load();
      await client.grant();
      expect(client.states.at(-1)?.status).toBe("error");
      expect(client.posts()).toBe(0);
    },
  );
  it.each([403, 503])("does not render policy on endpoint %s", async (status) => {
    const states: BootstrapState[] = [];
    const transport = vi.fn<TestFetch>(async () => Response.json({}, { status }));
    const client = createConsentBootstrapClient({
      origin: "https://api.example.test",
      local: false,
      transport,
      onChange: (state) => states.push(state),
      onVerified: vi.fn(),
    });
    disposers.push(client.dispose);
    await client.load();
    expect(states.at(-1)?.status).toBe(status === 403 ? "denied" : "unavailable");
  });
  it.each(["network", "503", "invalid201"])(
    "keeps uncertain POST %s unknown and never repeats",
    async (kind) => {
      const client = await setup({
        post: async () => {
          if (kind === "network") throw new Error("Synthetic disconnect");
          return kind === "503"
            ? Response.json({}, { status: 503 })
            : Response.json({ saved: true }, { status: 201 });
        },
      });
      await client.load();
      await client.grant();
      await client.grant();
      expect(client.states.at(-1)?.status).toBe("unknown");
      expect(client.posts()).toBe(1);
      expect(client.onVerified).not.toHaveBeenCalled();
      await client.load();
      expect(client.posts()).toBe(1);
      expect(client.onVerified).toHaveBeenCalledOnce();
    },
  );
  it.each(["denied", "wrongActor", "expired", "extra", "network"])(
    "requires valid post-consent session: %s",
    async (kind) => {
      const client = await setup({
        sessionAfter: async () => {
          if (kind === "network") throw new Error("Synthetic outage");
          return kind === "denied"
            ? Response.json({}, { status: 403 })
            : Response.json(
                kind === "wrongActor"
                  ? { ...session, userId: recordId }
                  : kind === "expired"
                    ? { ...session, expiresAt: new Date(instant).toISOString() }
                    : { ...session, fabricated: true },
              );
        },
      });
      await client.load();
      await client.grant();
      expect(client.onVerified).not.toHaveBeenCalled();
      expect(client.states.at(-1)?.status).toBe(kind === "denied" ? "denied" : "recorded");
    },
  );
  it("single-flights concurrent reads and writes", async () => {
    const client = await setup();
    const a = client.load();
    const b = client.load();
    expect(a).toBe(b);
    await a;
    const first = client.grant();
    const second = client.grant();
    expect(first).toBe(second);
    await first;
    expect(client.posts()).toBe(1);
  });
  it("cancel and dispose fence ignored-abort late completions; fresh instance works", async () => {
    let release: ((response: Response) => void) | undefined;
    const states: BootstrapState[] = [];
    const onVerified = vi.fn();
    const transport = vi.fn<TestFetch>(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const client = createConsentBootstrapClient({
      origin: "https://api.example.test",
      local: false,
      transport,
      onChange: (state) => states.push(state),
      onVerified,
    });
    const pending = client.load();
    await Promise.resolve();
    client.cancel();
    client.dispose();
    release?.(Response.json(session));
    await pending;
    expect(states.at(-1)?.status).toBe("cancelled");
    expect(onVerified).not.toHaveBeenCalled();
    const fresh = await setup();
    await fresh.load();
    expect(fresh.states.at(-1)?.status).toBe("ready");
  });
  it("bounds streamed response bytes before JSON parsing", async () => {
    let count = 0;
    let cancelled = false;
    const states: BootstrapState[] = [];
    const transport = vi.fn<TestFetch>(async () =>
      ++count === 1
        ? Response.json({}, { status: 403 })
        : new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array(400_001));
              },
              cancel() {
                cancelled = true;
              },
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
    );
    const client = createConsentBootstrapClient({
      origin: "https://api.example.test",
      local: false,
      transport,
      onChange: (state) => states.push(state),
      onVerified: vi.fn(),
    });
    disposers.push(client.dispose);
    await client.load();
    expect(states.at(-1)?.status).toBe("error");
    expect(cancelled).toBe(true);
  });
  it("aborts an actual pending read after five seconds", async () => {
    vi.useFakeTimers();
    let aborted = false;
    const states: BootstrapState[] = [];
    const transport = vi.fn<TestFetch>(
      async (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            aborted = true;
            reject(new DOMException("Abort", "AbortError"));
          });
        }),
    );
    const client = createConsentBootstrapClient({
      origin: "https://api.example.test",
      local: false,
      transport,
      onChange: (state) => states.push(state),
      onVerified: vi.fn(),
    });
    disposers.push(client.dispose);
    const pending = client.load();
    await vi.advanceTimersByTimeAsync(5000);
    await pending;
    expect(aborted).toBe(true);
    expect(states.at(-1)?.status).toBe("unavailable");
  });
  it("has matching operational resource keys for all three languages", () => {
    for (const locale of ["ml", "ta"] as const) {
      expect(Object.keys(consentBootstrapLabels[locale])).toEqual(
        Object.keys(consentBootstrapLabels.en),
      );
      expect(
        Object.values(consentBootstrapLabels[locale]).every((value) => value.trim().length > 0),
      ).toBe(true);
    }
  });

  it("disposal before the queued task begins performs no network work", async () => {
    const client = await setup();
    const pending = client.load();
    client.dispose();
    await pending;
    expect(client.transport).not.toHaveBeenCalled();
    expect(client.states).toEqual([]);
  });

  it("unknown writes remain unknown after the bootstrap's original expiry", async () => {
    vi.useFakeTimers();
    const client = await setup({
      post: async () => {
        throw new Error("Synthetic disconnect");
      },
    });
    await client.load();
    await client.grant();
    await vi.advanceTimersByTimeAsync(120000);
    expect(client.states.at(-1)?.status).toBe("unknown");
    expect(client.posts()).toBe(1);
  });

  it("rejects a configured unapproved origin before network activity", () => {
    for (const origin of [
      "http://api.example.test",
      "https://api.example.test/path",
      "https://actor@api.example.test",
    ])
      expect(() =>
        createConsentBootstrapClient({
          origin,
          local: false,
          onChange: vi.fn(),
          onVerified: vi.fn(),
        }),
      ).toThrow();
  });

  it("aborts a pending POST at five seconds without automatically repeating it", async () => {
    vi.useFakeTimers();
    const states: BootstrapState[] = [];
    const bootstrap = await fixture();
    let posts = 0;
    const transport = vi.fn<TestFetch>(async (input, init) => {
      const path = String(input);
      if (path.endsWith("/session")) return Response.json({}, { status: 403 });
      if (path.endsWith("/consent-bootstrap")) return Response.json(bootstrap);
      if (path.endsWith("/context")) return Response.json(context);
      posts++;
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Abort", "AbortError")),
        );
      });
    });
    const client = createConsentBootstrapClient({
      origin: "https://api.example.test",
      local: false,
      now: () => instant,
      transport,
      onChange: (state) => states.push(state),
      onVerified: vi.fn(),
    });
    disposers.push(client.dispose);
    await client.load();
    const pending = client.grant();
    await vi.advanceTimersByTimeAsync(5000);
    await pending;
    await client.grant();
    expect(states.at(-1)?.status).toBe("unknown");
    expect(posts).toBe(1);
  });
});
