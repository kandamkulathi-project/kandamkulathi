import { expect, it, vi } from "vitest";
import worker, { P1VideoProofRoom } from "../../apps/core-api/src/private-video-proof-worker";
import { grant, membership, now } from "./fixtures";

it("DO restart is unavailable rather than permitting ticket replay after memory eviction", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const storage = new Map();
  let initialized = Promise.resolve();
  // Deliberately narrow deterministic DO storage double; not a real workerd persistence proof.
  const state = {
    storage: {
      get: async (key) => storage.get(key),
      put: async (key, value) => {
        storage.set(key, value);
      },
    },
    blockConcurrencyWhile: (callback) => {
      initialized = callback();
      return initialized;
    },
  };
  const env = {
    P1_VIDEO_PROOF_CONFIG: JSON.stringify({
      syntheticOnly: true,
      allowedOrigin: "https://proof.example.test",
      members: [
        { ticket: grant.ticket, membership },
        {
          ticket: "b".repeat(43),
          membership: {
            ...membership,
            role: "answerer",
            participantId: "synthetic-b",
            peerId: "synthetic-a",
          },
        },
      ],
    }),
    P1_VIDEO_ROOMS: {},
  };
  try {
    const first = new P1VideoProofRoom(state, env);
    await initialized;
    const request = () =>
      new Request("https://signal.example.test/p1-private-video-proof", {
        method: "POST",
        headers: { authorization: `Bearer ${grant.ticket}` },
        body: JSON.stringify({
          action: "join",
          appointmentId: grant.appointmentId,
          revision: grant.revision,
        }),
      });
    expect((await first.fetch(request())).status).toBe(200);
    const restarted = new P1VideoProofRoom(state, env);
    await initialized;
    expect((await restarted.fetch(request())).status).toBe(503);
  } finally {
    vi.useRealTimers();
  }
});

const proofConfig = () => ({
  syntheticOnly: true,
  allowedOrigin: "https://proof.example.test",
  members: [
    { ticket: grant.ticket, membership },
    {
      ticket: "b".repeat(43),
      membership: {
        ...membership,
        role: "answerer",
        participantId: "synthetic-b",
        peerId: "synthetic-a",
      },
    },
  ],
});
const proofRequest = (action = "join", overrides = {}) =>
  new Request("https://signal.example.test/p1-private-video-proof", {
    method: "POST",
    headers: { authorization: `Bearer ${grant.ticket}`, origin: "https://proof.example.test" },
    body: JSON.stringify({ action, appointmentId: grant.appointmentId, revision: grant.revision }),
    ...overrides,
  });

it("public boundary rejects unauthenticated/method/origin/window/partial config before DO lookup; OPTIONS is stateless", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const lookup = vi.fn(() => "synthetic-id");
  const dispatch = vi.fn(async () => new Response(null));
  const env = {
    P1_VIDEO_PROOF_CONFIG: JSON.stringify(proofConfig()),
    P1_VIDEO_ROOMS: { idFromName: lookup, get: () => ({ fetch: dispatch }) },
  };
  try {
    for (const request of [
      proofRequest("join", { method: "GET", body: undefined }),
      proofRequest("join", { headers: {} }),
      proofRequest("join", {
        headers: { authorization: `Bearer ${grant.ticket}`, origin: "https://evil.test" },
      }),
    ])
      expect((await worker.fetch(request, env)).status).toBe(403);
    expect(
      (
        await worker.fetch(
          proofRequest("join", {
            method: "OPTIONS",
            body: undefined,
            headers: { origin: "https://proof.example.test" },
          }),
          env,
        )
      ).status,
    ).toBe(200);
    expect(lookup).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    for (const config of [
      { ...proofConfig(), members: [proofConfig().members[0]] },
      { ...proofConfig(), syntheticOnly: false },
      {
        ...proofConfig(),
        members: proofConfig().members.map((m) => ({
          ...m,
          membership: { ...m.membership, notBefore: now + 1 },
        })),
      },
      {
        ...proofConfig(),
        members: proofConfig().members.map((m) => ({
          ...m,
          membership: { ...m.membership, expiresAt: now },
        })),
      },
    ])
      expect(
        (
          await worker.fetch(proofRequest(), {
            ...env,
            P1_VIDEO_PROOF_CONFIG: JSON.stringify(config),
          })
        ).status,
      ).toBe(503);
    expect(lookup).not.toHaveBeenCalled();
    expect((await worker.fetch(proofRequest(), env)).status).toBe(200);
    expect(lookup).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});

it("unused DO survives unauthorized requests and restart; only accepted join persists marker, concurrent duplicate is denied", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const storage = new Map();
  let initialized = Promise.resolve();
  const state = {
    storage: {
      get: async (key) => storage.get(key),
      put: vi.fn(async (key, value) => storage.set(key, value)),
    },
    blockConcurrencyWhile(callback) {
      initialized = callback();
      return initialized;
    },
  };
  const env = { P1_VIDEO_PROOF_CONFIG: JSON.stringify(proofConfig()), P1_VIDEO_ROOMS: {} };
  try {
    const first = new P1VideoProofRoom(state, env);
    await initialized;
    expect(
      (await first.fetch(proofRequest("join", { method: "GET", body: undefined }))).status,
    ).toBe(403);
    expect(
      (await first.fetch(proofRequest("join", { method: "OPTIONS", body: undefined, headers: {} })))
        .status,
    ).toBe(200);
    expect((await first.fetch(proofRequest("join", { headers: {} }))).status).toBe(403);
    expect((await first.fetch(proofRequest("join", { body: "{}" }))).status).toBe(403);
    expect(state.storage.put).not.toHaveBeenCalled();
    const restarted = new P1VideoProofRoom(state, env);
    await initialized;
    const results = await Promise.all([
      restarted.fetch(proofRequest()),
      restarted.fetch(proofRequest()),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(state.storage.put).toHaveBeenCalledExactlyOnceWith("started", true);
    const consumed = new P1VideoProofRoom(state, env);
    await initialized;
    expect((await consumed.fetch(proofRequest())).status).toBe(503);
  } finally {
    vi.useRealTimers();
  }
});

it("failed marker persistence never publishes membership", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  let initialized;
  const state = {
    storage: {
      get: async () => undefined,
      put: async () => {
        throw new Error("synthetic storage failure");
      },
    },
    blockConcurrencyWhile(callback) {
      initialized = callback();
      return initialized;
    },
  };
  try {
    const room = new P1VideoProofRoom(state, {
      P1_VIDEO_PROOF_CONFIG: JSON.stringify(proofConfig()),
    });
    await initialized;
    const result = await room.fetch(proofRequest());
    expect(result.status).toBe(503);
    expect(await result.text()).not.toContain(membership.relays[0].credential);
  } finally {
    vi.useRealTimers();
  }
});

it("concurrent first joins by both members await one durable marker before receiving membership", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  let initialized;
  let persist;
  const writing = new Promise((resolve) => {
    persist = resolve;
  });
  const put = vi.fn(async () => writing);
  const state = {
    storage: { get: async () => undefined, put },
    blockConcurrencyWhile(callback) {
      initialized = callback();
      return initialized;
    },
  };
  try {
    const room = new P1VideoProofRoom(state, {
      P1_VIDEO_PROOF_CONFIG: JSON.stringify(proofConfig()),
    });
    await initialized;
    let published = 0;
    const first = room.fetch(proofRequest()).then((result) => {
      published++;
      return result;
    });
    const second = room
      .fetch(proofRequest("join", { headers: { authorization: `Bearer ${"b".repeat(43)}` } }))
      .then((result) => {
        published++;
        return result;
      });
    await vi.waitFor(() => expect(put).toHaveBeenCalledOnce());
    expect(published).toBe(0);
    persist();
    expect((await first).status).toBe(200);
    expect((await second).status).toBe(200);
    expect(put).toHaveBeenCalledExactlyOnceWith("started", true);
  } finally {
    vi.useRealTimers();
  }
});
