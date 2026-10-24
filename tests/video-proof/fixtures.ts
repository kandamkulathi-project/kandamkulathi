import { vi } from "vitest";
import type { AuthorizedVideoSession, VideoSdk } from "../../packages/client/src/private-video";
export const now = 1800000000000;
export const grant = {
  appointmentId: "11111111-1111-4111-8111-111111111111",
  revision: "r1",
  ticket: "a".repeat(43),
  expiresAt: new Date(now + 60000).toISOString(),
};
export const membership = {
  appointmentId: grant.appointmentId,
  revision: grant.revision,
  participantId: "synthetic-a",
  peerId: "synthetic-b",
  connectionId: "c".repeat(43),
  notBefore: now - 1000,
  expiresAt: now + 60000,
  role: "offerer",
  relays: [
    {
      urls: ["turns:relay.example.test:443?transport=tcp"],
      username: "ephemeral",
      credential: "synthetic-only",
    },
  ],
};
export const offer = { type: "offer", sdp: "synthetic SDP: not device proof" };
export const answer = { type: "answer", sdp: "synthetic SDP: not device proof" };
export function ports() {
  let revoke = () => {};
  let state = (_value: string) => {};
  const media = { synthetic: true };
  const peer = {
    addTracks: vi.fn(),
    offer: vi.fn(async () => offer),
    answer: vi.fn(async () => answer),
    local: vi.fn(async () => {}),
    remote: vi.fn(async () => {}),
    description: () => offer,
    gathered: () => true,
    onGathered: () => () => {},
    close: vi.fn(),
  };
  const sdk: VideoSdk<typeof media> = {
    capture: vi.fn(async () => media),
    stop: vi.fn(),
    peer: vi.fn((_relays, _remote, changed) => {
      state = changed;
      return peer;
    }),
  };
  const session: AuthorizedVideoSession = {
    membership,
    send: vi.fn(async () => {}),
    receive: vi.fn(async () => answer),
    onRevoked: (callback) => {
      revoke = callback;
      return vi.fn();
    },
    close: vi.fn(),
  };
  return {
    sdk,
    session,
    peer,
    media,
    revoke: () => revoke(),
    state: (value: string) => state(value),
  };
}
