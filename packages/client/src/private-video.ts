import { type VideoGrant, videoGrantSchema } from "@kandamkulathi/contracts/sensitive";

export type Description = { type: "offer" | "answer"; sdp: string };
export type Relay = { urls: string[]; username: string; credential: string };
/** Server-authenticated response, not an assertion of clinical eligibility by this client. */
export interface VideoMembership {
  appointmentId: string;
  revision: string;
  participantId: string;
  peerId: string;
  connectionId: string;
  notBefore: number;
  expiresAt: number;
  role: "offerer" | "answerer";
  relays: Relay[];
}
export interface AuthorizedVideoSession {
  membership: unknown;
  /** Bounded, ordered, peer-only SDP channel. Never broadcast a room. */
  send(description: Description, signal: AbortSignal): Promise<void>;
  receive(signal: AbortSignal): Promise<unknown>;
  onRevoked(close: () => void): () => void;
  close(): void;
}
export interface AuthorizedVideoSignaling {
  /** Authenticate ticket in a body/header (never URL), consume once, authorize before resolving.
   * Server must recheck identity/consent/assignment/window and bind both peer IDs + connection ID.
   * A technical synthetic harness may supply its own isolated authority, never a clinical grant. */
  open(grant: VideoGrant, signal: AbortSignal): Promise<AuthorizedVideoSession>;
}
export interface VideoPeer<S> {
  addTracks(stream: S): void;
  offer(): Promise<unknown>;
  answer(): Promise<unknown>;
  local(description: Description): Promise<void>;
  remote(description: Description): Promise<void>;
  description(): unknown;
  gathered(): boolean;
  onGathered(listener: () => void): () => void;
  close(): void;
}
export interface VideoSdk<S> {
  capture(): Promise<S>;
  stop(stream: S): void;
  peer(relays: Relay[], remote: (stream: S) => void, state: (value: string) => void): VideoPeer<S>;
}
export type VideoState = "authorizing" | "permissions" | "negotiating" | "connected" | "closed";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const bounded = (value: unknown, min: number, max: number): value is string =>
  typeof value === "string" && value.length >= min && value.length <= max;

export function videoDescription(value: unknown, expected?: Description["type"]): Description {
  if (
    !record(value) ||
    !["offer", "answer"].includes(String(value.type)) ||
    (expected && value.type !== expected) ||
    !bounded(value.sdp, 1, 65536)
  )
    throw new Error("Invalid video description");
  return { type: value.type as Description["type"], sdp: value.sdp };
}

export function videoMembership(
  value: unknown,
  grant: VideoGrant,
  participant: string,
  now: number,
): VideoMembership {
  if (
    !record(value) ||
    value.appointmentId !== grant.appointmentId ||
    value.revision !== grant.revision ||
    value.participantId !== participant ||
    !bounded(value.peerId, 1, 128) ||
    value.peerId === participant ||
    !bounded(value.connectionId, 32, 128) ||
    !/^[A-Za-z0-9_-]+$/.test(value.connectionId) ||
    !Number.isSafeInteger(value.notBefore) ||
    !Number.isSafeInteger(value.expiresAt) ||
    Number(value.notBefore) > now ||
    Number(value.expiresAt) <= now ||
    Number(value.expiresAt) > Date.parse(grant.expiresAt) ||
    !["offerer", "answerer"].includes(String(value.role)) ||
    !Array.isArray(value.relays) ||
    value.relays.length < 1 ||
    value.relays.length > 4
  )
    throw new Error("Video membership denied");
  const relays: Relay[] = value.relays.map((relay: unknown) => {
    if (
      !record(relay) ||
      !Array.isArray(relay.urls) ||
      relay.urls.length < 1 ||
      relay.urls.length > 4 ||
      !relay.urls.every(
        (url: unknown) =>
          bounded(url, 8, 256) &&
          /^turns?:[a-zA-Z0-9.-]+(?::[0-9]{1,5})?(?:\?transport=(?:udp|tcp))?$/.test(url),
      ) ||
      !bounded(relay.username, 1, 256) ||
      !bounded(relay.credential, 1, 256)
    )
      throw new Error("Approved TURN configuration required");
    return {
      urls: [...relay.urls] as string[],
      username: relay.username,
      credential: relay.credential,
    };
  });
  return {
    appointmentId: grant.appointmentId,
    revision: grant.revision,
    participantId: participant,
    peerId: value.peerId,
    connectionId: value.connectionId,
    notBefore: Number(value.notBefore),
    expiresAt: Number(value.expiresAt),
    role: value.role as VideoMembership["role"],
    relays,
  };
}

/** One explicit attempt per owner; no automatic reconnect, media preview or synthetic success. */
export function privateVideoTransport<S>(options: {
  sdk: VideoSdk<S>;
  signaling: AuthorizedVideoSignaling;
  participantId: string;
  onState?: (state: VideoState) => void;
  onLocal?: (stream: S | null) => void;
  onRemote?: (stream: S | null) => void;
  now?: () => number;
}) {
  let active = false;
  const now = options.now ?? Date.now;
  return async (input: VideoGrant, outer: AbortSignal): Promise<{ close(): void }> => {
    if (active || outer.aborted) throw new Error("Video attempt unavailable");
    const grant = videoGrantSchema.parse(input);
    if (
      !bounded(options.participantId, 1, 128) ||
      Date.parse(grant.expiresAt) <= now() ||
      Date.parse(grant.expiresAt) - now() > 300000
    )
      throw new Error("Video grant expired");
    active = true;
    const controller = new AbortController();
    const signal = controller.signal;
    let session: AuthorizedVideoSession | undefined;
    let peer: VideoPeer<S> | undefined;
    let local: S | undefined;
    const remotes = new Set<S>();
    let revoke: (() => void) | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      controller.abort();
      clearTimeout(deadline);
      clearTimeout(setup);
      outer.removeEventListener("abort", close);
      revoke?.();
      peer?.close();
      if (local) options.sdk.stop(local);
      for (const stream of remotes) options.sdk.stop(stream);
      session?.close();
      active = false;
      options.onLocal?.(null);
      options.onRemote?.(null);
      options.onState?.("closed");
    };
    // No permission dialog or signaling exchange can retain a pending call indefinitely.
    const setup = setTimeout(close, 30000);
    outer.addEventListener("abort", close, { once: true });
    deadline = setTimeout(close, Date.parse(grant.expiresAt) - now());
    function alive() {
      if (signal.aborted) throw new Error("Video attempt closed");
    }
    function wait<T>(work: Promise<T>, late?: (value: T) => void): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const abort = () => reject(new Error("Video attempt closed"));
        if (signal.aborted) abort();
        else signal.addEventListener("abort", abort, { once: true });
        work.then(
          (value) => {
            signal.removeEventListener("abort", abort);
            if (signal.aborted) late?.(value);
            else resolve(value);
          },
          (error: unknown) => {
            signal.removeEventListener("abort", abort);
            reject(error);
          },
        );
      });
    }
    async function gatheredDescription(current: VideoPeer<S>): Promise<Description> {
      if (!current.gathered()) {
        let unsubscribe: (() => void) | undefined;
        try {
          await wait(
            new Promise<void>((resolve) => {
              unsubscribe = current.onGathered(() => {
                if (current.gathered()) resolve();
              });
              if (current.gathered()) resolve();
            }),
          );
        } finally {
          unsubscribe?.();
        }
      }
      alive();
      return videoDescription(current.description());
    }
    try {
      options.onState?.("authorizing");
      session = await wait(options.signaling.open(grant, signal), (late) => late.close());
      alive();
      const member = videoMembership(session.membership, grant, options.participantId, now());
      clearTimeout(deadline);
      deadline = setTimeout(close, member.expiresAt - now());
      revoke = session.onRevoked(close);
      if (closed) revoke();
      alive();
      options.onState?.("permissions");
      local = await wait(options.sdk.capture(), (late) => options.sdk.stop(late));
      alive();
      peer = options.sdk.peer(
        member.relays,
        (stream) => {
          if (closed) {
            options.sdk.stop(stream);
            return;
          }
          remotes.add(stream);
          options.onRemote?.(stream);
        },
        (state) => {
          if (closed) return;
          if (state === "connected") {
            clearTimeout(setup);
            options.onState?.("connected");
          }
          // Fail closed: explicit retry must reacquire a fresh authority/grant.
          if (["failed", "disconnected", "closed"].includes(state)) close();
        },
      );
      peer.addTracks(local);
      options.onLocal?.(local);
      alive();
      options.onState?.("negotiating");
      if (member.role === "offerer") {
        await wait(peer.local(videoDescription(await wait(peer.offer()), "offer")));
        await wait(session.send(await gatheredDescription(peer), signal));
        const answer = videoDescription(await wait(session.receive(signal)), "answer");
        alive();
        await wait(peer.remote(answer));
      } else {
        const offer = videoDescription(await wait(session.receive(signal)), "offer");
        alive();
        await wait(peer.remote(offer));
        await wait(peer.local(videoDescription(await wait(peer.answer()), "answer")));
        await wait(session.send(await gatheredDescription(peer), signal));
      }
      alive();
      // Keep the setup deadline until the actual peer reports connected, not merely SDP success.
      return { close };
    } catch (error) {
      close();
      throw error;
    }
  };
}
