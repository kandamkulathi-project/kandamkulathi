import { createServer } from "node:http";
import { expect, it, vi } from "vitest";
import { technicalVideoRoom } from "../../apps/core-api/src/private-video-proof";
import { technicalVideoSignaling } from "../../packages/client/src/private-video-http";
import { grant, membership, now } from "./fixtures";

it("private synthetic pair: denies guessed key/replay/origin, exchanges peer-only SDP and closes peer on leave", async () => {
  const room = technicalVideoRoom(
    {
      syntheticOnly: true,
      allowedOrigin: "https://proof.example.test",
      members: [
        { ticket: grant.ticket, membership },
        {
          ticket: "b".repeat(43),
          membership: {
            ...membership,
            participantId: "synthetic-b",
            peerId: "synthetic-a",
            role: "answerer",
          },
        },
      ],
    },
    () => now,
  );
  const call = (
    action: string,
    ticket = grant.ticket,
    extra = {},
    origin = "https://proof.example.test",
  ) =>
    room(
      new Request("https://signal.example.test/p1-private-video-proof", {
        method: "POST",
        headers: { authorization: `Bearer ${ticket}`, origin },
        body: JSON.stringify({
          action,
          appointmentId: grant.appointmentId,
          revision: grant.revision,
          ...extra,
        }),
      }),
    );
  expect((await call("join", "guessed")).status).toBe(403);
  expect((await call("join", grant.ticket, {}, "https://evil.test")).status).toBe(403);
  expect((await call("join")).status).toBe(200);
  expect((await call("join")).status).toBe(409);
  expect((await call("join", "b".repeat(43))).status).toBe(200);
  expect(
    (await call("send", grant.ticket, { description: { type: "answer", sdp: "wrong role" } }))
      .status,
  ).toBe(400);
  await call("send", grant.ticket, { description: { type: "offer", sdp: "synthetic only" } });
  expect(await (await call("receive", "b".repeat(43))).json()).toEqual({
    type: "offer",
    sdp: "synthetic only",
  });
  expect(await (await call("receive")).json()).toBe(null);
  await call("leave");
  expect((await call("status", "b".repeat(43))).status).toBe(403);
});

it.each([undefined, "1"])(
  "enforces streamed UTF-8 byte limit with absent/false Content-Length=%s and cancels overflow",
  async (contentLength) => {
    const cancelled = vi.fn();
    const signaling = technicalVideoSignaling(
      "https://signal.example.test/p1-private-video-proof",
      async (_input, init) => {
        if (JSON.parse(String(init?.body)).action === "leave") return Response.json(null);
        let count = 0;
        return new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              // Each chunk is 30 KB despite having only 10,000 characters.
              controller.enqueue(new TextEncoder().encode("€".repeat(10000)));
              if (++count === 10) controller.close();
            },
            cancel: cancelled,
          }),
          { headers: contentLength ? { "Content-Length": contentLength } : {} },
        );
      },
    );
    await expect(signaling.open(grant, new AbortController().signal)).rejects.toThrow(
      "Invalid proof response",
    );
    expect(cancelled).toHaveBeenCalledOnce();
  },
);

it("fails unavailable without streaming body and never calls unbounded text fallback", async () => {
  const text = vi.fn(async () => JSON.stringify(membership));
  const signaling = technicalVideoSignaling(
    "https://signal.example.test/p1-private-video-proof",
    async () =>
      ({
        ok: true,
        body: undefined,
        headers: new Headers({ "Content-Length": "10" }),
        text,
      }) as unknown as Response,
  );
  await expect(signaling.open(grant, new AbortController().signal)).rejects.toThrow(
    "Streaming proof response unavailable",
  );
  expect(text).not.toHaveBeenCalled();
});

it("cancels a stalled response reader on abort without waiting for the body", async () => {
  const cancelled = vi.fn();
  const reading = vi.fn();
  const controller = new AbortController();
  const signaling = technicalVideoSignaling(
    "https://signal.example.test/p1-private-video-proof",
    async (_input, init) =>
      JSON.parse(String(init?.body)).action === "leave"
        ? Response.json(null)
        : new Response(new ReadableStream<Uint8Array>({ pull: reading, cancel: cancelled })),
  );
  const opening = signaling.open(grant, controller.signal);
  const failed = expect(opening).rejects.toThrow();
  await vi.waitFor(() => expect(reading).toHaveBeenCalled());
  controller.abort();
  await failed;
  expect(cancelled).toHaveBeenCalled();
});

it("accepts a valid chunked JSON response at the exact byte cap", async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(membership));
  const signaling = technicalVideoSignaling(
    "https://signal.example.test/p1-private-video-proof",
    async (_input, init) =>
      JSON.parse(String(init?.body)).action === "leave"
        ? Response.json(null)
        : new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(bytes.subarray(0, 10));
                controller.enqueue(bytes.subarray(10));
                controller.enqueue(new TextEncoder().encode(" ".repeat(70000 - bytes.byteLength)));
                controller.close();
              },
            }),
          ),
  );
  const session = await signaling.open(grant, new AbortController().signal);
  expect(session.membership).toEqual(membership);
  session.close();
});

it("actual loopback chunked HTTP without Content-Length is cancelled before the full oversized body", async () => {
  let written = 0;
  let closed!: () => void;
  const cancelled = new Promise<void>((resolve) => {
    closed = resolve;
  });
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    if (JSON.parse(Buffer.concat(chunks).toString()).action === "leave") {
      response.end("null");
      return;
    }
    response.setHeader("Content-Type", "application/json");
    const timer = setInterval(() => {
      response.write(" ".repeat(30000));
      if (++written === 10) response.end(JSON.stringify(membership));
    }, 5);
    response.on("close", () => {
      clearInterval(timer);
      closed();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Synthetic HTTP fixture unavailable");
    const signaling = technicalVideoSignaling(
      "https://signal.example.test/p1-private-video-proof",
      (_url, init) => fetch(`http://127.0.0.1:${address.port}`, init),
    );
    await expect(signaling.open(grant, new AbortController().signal)).rejects.toThrow(
      "Invalid proof response",
    );
    await cancelled;
    expect(written).toBeLessThan(10);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

it("HTTP adapter authenticates ticket in header only and rejects unsafe endpoint", async () => {
  expect(() =>
    technicalVideoSignaling("http://signal.example.test/p1-private-video-proof"),
  ).toThrow();
  expect(() =>
    technicalVideoSignaling("https://signal.example.test/p1-private-video-proof?ticket=secret"),
  ).toThrow();
  const calls: Request[] = [];
  const signaling = technicalVideoSignaling(
    "https://signal.example.test/p1-private-video-proof",
    async (input, init) => {
      const request = new Request(input, init);
      calls.push(request);
      return Response.json(membership);
    },
  );
  const session = await signaling.open(grant, new AbortController().signal);
  const first = calls[0];
  if (!first) throw new Error("Expected authenticated request");
  expect(first.headers.get("authorization")).toBe(`Bearer ${grant.ticket}`);
  expect(first.url).not.toContain(grant.ticket);
  session.close();
});

it("revokes on a stalled authority heartbeat rather than retaining an unverified active call", async () => {
  vi.useFakeTimers();
  try {
    const signaling = technicalVideoSignaling(
      "https://signal.example.test/p1-private-video-proof",
      async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as { action: string };
        if (body.action === "status") return new Promise<Response>(() => {});
        return Response.json(membership);
      },
    );
    const session = await signaling.open(grant, new AbortController().signal);
    const revoked = vi.fn();
    session.onRevoked(revoked);
    await vi.advanceTimersByTimeAsync(6000);
    expect(revoked).toHaveBeenCalledOnce();
    session.close();
    await vi.advanceTimersByTimeAsync(1000);
  } finally {
    vi.useRealTimers();
  }
});

it("a body that finishes after the window cannot join", async () => {
  let clock = now;
  const room = technicalVideoRoom(
    {
      syntheticOnly: true,
      allowedOrigin: "https://proof.example.test",
      members: [
        { ticket: grant.ticket, membership },
        {
          ticket: "b".repeat(43),
          membership: {
            ...membership,
            participantId: "synthetic-b",
            peerId: "synthetic-a",
            role: "answerer",
          },
        },
      ],
    },
    () => clock,
  );
  let feed: ReadableStreamDefaultController<Uint8Array> | undefined;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      feed = controller;
    },
  });
  const pending = room(
    new Request("https://signal.example.test/p1-private-video-proof", {
      method: "POST",
      headers: { authorization: `Bearer ${grant.ticket}` },
      body,
      duplex: "half",
    } as RequestInit),
  );
  clock = now + 60000;
  feed?.enqueue(
    new TextEncoder().encode(
      JSON.stringify({
        action: "join",
        appointmentId: grant.appointmentId,
        revision: grant.revision,
      }),
    ),
  );
  feed?.close();
  expect((await pending).status).toBe(403);
});
