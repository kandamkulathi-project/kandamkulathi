import { afterEach, describe, expect, it, vi } from "vitest";
import { privateVideoTransport, videoMembership } from "../../packages/client/src/private-video";
import { grant, membership, now, ports } from "./fixtures";

afterEach(() => vi.useRealTimers());
describe("synthetic SDK-port proof (NOT native device proof)", () => {
  it("authorizes before capture, negotiates real port methods; only peer connected emits connected", async () => {
    const p = ports(),
      state = vi.fn();
    const open = vi.fn(async () => {
      expect(p.sdk.capture).not.toHaveBeenCalled();
      return p.session;
    });
    const connect = privateVideoTransport({
      ...p,
      signaling: { open },
      participantId: "synthetic-a",
      now: () => now,
      onState: state,
    });
    const connection = await connect(grant, new AbortController().signal);
    expect(p.peer.addTracks).toHaveBeenCalledWith(p.media);
    expect(p.session.send).toHaveBeenCalled();
    expect(p.peer.remote).toHaveBeenCalledWith({
      type: "answer",
      sdp: "synthetic SDP: not device proof",
    });
    expect(state).not.toHaveBeenCalledWith("connected");
    p.state("connected");
    expect(state).toHaveBeenCalledWith("connected");
    connection.close();
    connection.close();
    expect(p.peer.close).toHaveBeenCalledTimes(1);
    expect(p.sdk.stop).toHaveBeenCalledTimes(1);
  });
  it.each([
    { participantId: "intruder" },
    { peerId: "synthetic-a" },
    { notBefore: now + 1 },
    { expiresAt: now },
    { expiresAt: now + 60001 },
    { revision: "stale" },
    { connectionId: "public-room" },
    { relays: [] },
  ])("denies membership before any camera capture: %j", async (delta) => {
    const p = ports();
    p.session.membership = { ...membership, ...delta };
    const connect = privateVideoTransport({
      sdk: p.sdk,
      signaling: { open: async () => p.session },
      participantId: "synthetic-a",
      now: () => now,
    });
    await expect(connect(grant, new AbortController().signal)).rejects.toThrow();
    expect(p.sdk.capture).not.toHaveBeenCalled();
    expect(p.session.close).toHaveBeenCalledOnce();
  });
  it("stops late media after abort and rejects duplicate setup", async () => {
    const p = ports();
    let resolve!: (media: typeof p.media) => void;
    p.sdk.capture = vi.fn(
      () =>
        new Promise<typeof p.media>((done) => {
          resolve = done;
        }),
    );
    const connect = privateVideoTransport({
      sdk: p.sdk,
      signaling: { open: async () => p.session },
      participantId: "synthetic-a",
      now: () => now,
    });
    const controller = new AbortController();
    const opening = connect(grant, controller.signal);
    await vi.waitFor(() => expect(p.sdk.capture).toHaveBeenCalled());
    await expect(connect(grant, controller.signal)).rejects.toThrow();
    controller.abort();
    await expect(opening).rejects.toThrow();
    resolve(p.media);
    await Promise.resolve();
    expect(p.sdk.stop).toHaveBeenCalledWith(p.media);
    expect(p.sdk.peer).not.toHaveBeenCalled();
  });
  it.each(["revoke", "disconnect", "expiry", "setup-timeout"])(
    "cleans resources on %s",
    async (reason) => {
      vi.useFakeTimers();
      const p = ports();
      const connect = privateVideoTransport({
        sdk: p.sdk,
        signaling: { open: async () => p.session },
        participantId: "synthetic-a",
        now: () => now,
      });
      await connect(grant, new AbortController().signal);
      if (reason === "revoke") p.revoke();
      if (reason === "disconnect") p.state("disconnected");
      if (reason === "expiry") {
        p.state("connected");
        await vi.advanceTimersByTimeAsync(60000);
      }
      if (reason === "setup-timeout") await vi.advanceTimersByTimeAsync(30000);
      expect(p.sdk.stop).toHaveBeenCalledOnce();
      expect(p.session.close).toHaveBeenCalledOnce();
    },
  );
  it("fails permission denial without creating a peer", async () => {
    const p = ports();
    p.sdk.capture = vi.fn(async () => {
      throw new Error("denied");
    });
    const connect = privateVideoTransport({
      sdk: p.sdk,
      signaling: { open: async () => p.session },
      participantId: "synthetic-a",
      now: () => now,
    });
    await expect(connect(grant, new AbortController().signal)).rejects.toThrow("denied");
    expect(p.sdk.peer).not.toHaveBeenCalled();
    expect(p.session.close).toHaveBeenCalledOnce();
  });
  it("validates and copies the approved relay list", () => {
    expect(videoMembership(membership, grant, "synthetic-a", now).relays).toEqual(
      membership.relays,
    );
  });
});
