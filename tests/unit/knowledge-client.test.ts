import { describe, expect, it, vi } from "vitest";
import {
  currentAnswer,
  nativeApiTransport,
  reviewedTranscript,
} from "../../packages/client/src/knowledge";
import { sensitiveClient } from "../../packages/client/src/sensitive";
import {
  publicSourceUrl,
  replySchema,
  reviewReady,
  saveDraftSchema,
} from "../../packages/contracts/src/knowledge";
import { entry, knowledgeDraft, reply } from "../fixtures/knowledge";
import { context, otherReference, reference, session } from "../fixtures/sensitive";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function setup(handler: (url: string) => Response | Promise<Response>) {
  const transport = vi.fn<typeof fetch>(async (input) =>
    String(input).endsWith("/security/context") ? json(context) : handler(String(input)),
  );
  const client = sensitiveClient({
    origin: "https://companion.example.com",
    local: false,
    session,
    transport,
  });
  return { client, transport };
}
describe("knowledge links and versioned documents", () => {
  it.each([
    "javascript:alert(1)",
    "data:text/html,hello",
    "http://example.org/a",
    "https://u:p@example.org/a",
    "https://example.org/a?token=private",
    "https://example.org/a#token",
    "https://127.0.0.1/a",
    "https://[::1]/a",
    "https://api.localhost/a",
    "https://api.internal/a",
    "https://example.org\\evil",
    "https://example.org/\na",
  ])("rejects unsafe/private source link %s", (url) => expect(publicSourceUrl(url)).toBeNull());
  it("accepts a public HTTPS reference without fetching it or embedding query credentials", () =>
    expect(publicSourceUrl(entry.document.sourceUrl)).toBe(entry.document.sourceUrl));
  it("does not let drafts supply approval, author, status or grants", () => {
    const input = { id: null, expectedRevision: null, document: entry.document };
    expect(saveDraftSchema.safeParse(input).success).toBe(true);
    for (const extra of [
      { state: "approved" },
      { authorId: otherReference },
      { permissions: { approve: true } },
    ])
      expect(saveDraftSchema.safeParse({ ...input, ...extra }).success).toBe(false);
    expect(saveDraftSchema.safeParse({ ...input, id: reference }).success).toBe(false);
    expect(
      reviewReady({ ...entry.document, safety: { ...entry.document.safety, warnings: "" } }),
    ).toBe(false);
  });
  it("rejects arbitrary generated text and executable proposals in a reply envelope", () => {
    expect(replySchema.safeParse({ ...reply, text: "Unverified clinical advice" }).success).toBe(
      false,
    );
    expect(
      replySchema.safeParse({
        kind: "action_required",
        id: reference,
        locale: "en",
        execute: { route: "/v1/payments" },
      }).success,
    ).toBe(false);
  });
});
describe("current approved source rendering boundary", () => {
  it("loads matching current sources uncached and preserves exact approved safety blocks", async () => {
    const { client, transport } = setup(() => json(entry));
    expect(await currentAnswer(client, reply)).toEqual({ status: "ready", data: [entry] });
    expect(transport.mock.calls[0]).toMatchObject([
      `https://companion.example.com/v1/knowledge/approved/${reference}`,
      { cache: "no-store", credentials: "include", redirect: "error" },
    ]);
    client.dispose();
  });
  it.each([
    "draft",
    "withdrawn",
    "revision",
    "locale",
    "expired",
    "approver",
    "name",
    "safety",
    "foreign",
  ])("does not render %s knowledge", async (kind) => {
    const bad = {
      ...entry,
      ...(kind === "draft" || kind === "withdrawn" ? { state: kind } : {}),
      ...(kind === "revision" ? { revision: 2 } : {}),
      ...(kind === "locale" ? { document: { ...entry.document, locale: "ml" } } : {}),
      ...(kind === "expired" ? { reviewUntil: "2020-01-01T00:00:00Z" } : {}),
      ...(kind === "approver" ? { approvedBy: null } : {}),
      ...(kind === "name" ? { approvedBy: { id: otherReference, displayName: "" } } : {}),
      ...(kind === "safety"
        ? { document: { ...entry.document, safety: { ...entry.document.safety, warnings: "" } } }
        : {}),
      ...(kind === "foreign" ? { id: otherReference } : {}),
    };
    const { client } = setup(() => json(bad));
    expect(await currentAnswer(client, reply)).toEqual({ status: "unavailable" });
    client.dispose();
  });
  it("fails the entire answer if a source is denied, missing or duplicated", async () => {
    const { client } = setup(() => json({}, 403));
    expect((await currentAnswer(client, reply)).status).toBe("unavailable");
    expect(
      (
        await currentAnswer(client, {
          ...reply,
          references: [
            { id: reference, revision: 1 },
            { id: reference, revision: 1 },
          ],
        })
      ).status,
    ).toBe("error");
    client.dispose();
  });
  it("checks review expiry after asynchronous retrieval, not at the start of a slow request", async () => {
    let now = Date.now();
    const expiry = new Date(now + 1000).toISOString();
    const { client } = setup(() => {
      now += 1001;
      return json({ ...entry, reviewUntil: expiry });
    });
    expect((await currentAnswer(client, reply, () => now)).status).toBe("unavailable");
    client.dispose();
  });
  it("fences a response after session disposal", async () => {
    let resolve!: (value: Response) => void;
    const { client } = setup(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const result = currentAnswer(client, reply);
    client.dispose();
    resolve(json(entry));
    expect((await result).status).toBe("unavailable");
  });
  it("rechecks all expiries after the slowest reference finishes", async () => {
    let now = Date.now();
    let finish!: (value: Response) => void;
    const { client } = setup((url) =>
      url.endsWith(reference)
        ? json({ ...entry, reviewUntil: new Date(now + 1000).toISOString() })
        : new Promise((resolve) => {
            finish = resolve;
          }),
    );
    const result = currentAnswer(
      client,
      {
        ...reply,
        references: [
          { id: reference, revision: 1 },
          { id: otherReference, revision: 1 },
        ],
      },
      () => now,
    );
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    now += 1001;
    finish(json({ ...entry, id: otherReference }));
    expect((await result).status).toBe("unavailable");
    client.dispose();
  });
});
describe("chat, handoff and independent review", () => {
  it("uses the separate Companion origin, scoped CSRF and stable message operation keys", async () => {
    const { client, transport } = setup(() => json(reply));
    const input = { operationId: reference, locale: "en", message: "Synthetic question" };
    expect((await client.chat(input)).status).toBe("ready");
    expect((await client.chat(input)).status).toBe("ready");
    const posts = transport.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(2);
    expect(posts[0]?.[0]).toBe("https://companion.example.com/v1/chat/replies");
    expect(new Headers(posts[0]?.[1]?.headers).get("X-CSRF-Token")).toBe(context.csrfToken);
    expect(new Headers(posts[0]?.[1]?.headers).get("Idempotency-Key")).toBe(
      new Headers(posts[1]?.[1]?.headers).get("Idempotency-Key"),
    );
    client.dispose();
  });
  it("keeps a provider outage unavailable and never fabricates human attendance", async () => {
    const { client } = setup(() => json({}, 503));
    expect(
      (await client.chat({ operationId: reference, locale: "en", message: "Synthetic" })).status,
    ).toBe("unavailable");
    expect((await client.requestHandoff(reference, "en")).status).toBe("unavailable");
    client.dispose();
    const queued = setup(() => json({ id: reference, status: "queued" }));
    expect(await queued.client.requestHandoff(reference, "en")).toMatchObject({
      status: "ready",
      data: { status: "queued" },
    });
    queued.client.dispose();
  });
  it.each(["self", "stale", "safety", "grant"])(
    "rejects %s approval without a privileged POST",
    async (kind) => {
      const candidate = {
        ...knowledgeDraft,
        state: "in_review",
        authorId: kind === "self" ? reference : otherReference,
        revision: kind === "stale" ? 2 : 1,
        permissions: { edit: false, approve: kind !== "grant", withdraw: false },
        ...(kind === "safety"
          ? { document: { ...entry.document, safety: { ...entry.document.safety, redFlags: "" } } }
          : {}),
      };
      const { client, transport } = setup(() => json(candidate));
      expect((await client.reviewKnowledge(reference, 1, "approve")).status).toBe(
        kind === "stale" ? "conflict" : "denied",
      );
      expect(transport.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
      client.dispose();
    },
  );
  it("asks for review separately and never changes a record locally to approved", async () => {
    const { client, transport } = setup((url) =>
      json(
        url.endsWith("request_review") ? { ...knowledgeDraft, state: "in_review" } : knowledgeDraft,
      ),
    );
    expect(await client.reviewKnowledge(reference, 1, "request_review")).toMatchObject({
      status: "ready",
      data: { state: "in_review" },
    });
    expect(JSON.parse(String(transport.mock.calls.at(-1)?.[1]?.body))).toEqual({
      expectedRevision: 1,
    });
    client.dispose();
  });
});
describe("native credential and voice boundaries", () => {
  it("sends an OS credential only to the exact approved API", async () => {
    const read = vi.fn(async () => "synthetic-session-token");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({}));
    const send = nativeApiTransport("https://api.example.com", false, read, () => true, fetcher);
    for (const url of [
      "https://evil.example/v1/session",
      "https://api.example.com/v1/session?token=private",
      "https://api.example.com/not-v1",
      "http://api.example.com/v1/session",
    ])
      await expect(send(url)).rejects.toThrow();
    expect(read).not.toHaveBeenCalled();
    await send("https://api.example.com/v1/session");
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe(
      "Bearer synthetic-session-token",
    );
  });
  it("does not send a credential retrieved after background/logout invalidation", async () => {
    let active = true;
    let resolve!: (value: string) => void;
    const fetcher = vi.fn<typeof fetch>();
    const send = nativeApiTransport(
      "https://api.example.com",
      false,
      () =>
        new Promise((done) => {
          resolve = done;
        }),
      () => active,
      fetcher,
    );
    const pending = send("https://api.example.com/v1/session");
    active = false;
    resolve("synthetic-session-token");
    await expect(pending).rejects.toThrow("Stale API");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("accepts editable transcript text only with explicit review and matching language", () => {
    const input = {
      id: reference,
      locale: "en",
      text: "Synthetic ambiguous number 1 or 7",
      needsReview: true,
    };
    expect(reviewedTranscript(input, "en")).toEqual({
      text: input.text,
      sendRequiresConfirmation: true,
    });
    expect(reviewedTranscript({ ...input, needsReview: false }, "en")).toBeNull();
    expect(reviewedTranscript(input, "ml")).toBeNull();
    expect(reviewedTranscript({ ...input, execute: { purchase: true } }, "en")).toBeNull();
  });
});
