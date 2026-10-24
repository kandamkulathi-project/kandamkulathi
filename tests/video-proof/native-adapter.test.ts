import { beforeEach, expect, it, vi } from "vitest";
import { grant, membership } from "./fixtures";

const port = vi.hoisted(() => {
  const stop = vi.fn(),
    release = vi.fn();
  const stream = { getTracks: () => [{ stop }], release };
  const events = new Map<string, (event: never) => void>();
  const peer = {
    connectionState: "connected",
    iceGatheringState: "complete",
    localDescription: { type: "offer", sdp: "synthetic native port, not device proof" },
    addTrack: vi.fn(),
    createOffer: vi.fn(async () => ({ type: "offer", sdp: "synthetic" })),
    createAnswer: vi.fn(async () => ({ type: "answer", sdp: "synthetic" })),
    setLocalDescription: vi.fn(async () => {}),
    setRemoteDescription: vi.fn(async () => {}),
    close: vi.fn(),
    addEventListener: vi.fn((name, fn) => events.set(name, fn)),
    removeEventListener: vi.fn(),
  };
  return {
    stop,
    release,
    stream,
    peer,
    events,
    capture: vi.fn(async () => stream),
    construct: vi.fn(),
    background: undefined as undefined | ((state: string) => void),
    remove: vi.fn(),
    ownership: "standalone",
    os: "android",
  };
});
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return port.os;
    },
  },
  AppState: {
    currentState: "active",
    addEventListener: (_name: string, fn: (state: string) => void) => {
      port.background = fn;
      return { remove: port.remove };
    },
  },
}));
vi.mock("expo-constants", () => ({
  default: {
    get appOwnership() {
      return port.ownership;
    },
  },
}));
vi.mock("react-native-webrtc", () => ({
  mediaDevices: { getUserMedia: port.capture },
  RTCPeerConnection: class {
    constructor(config: unknown) {
      port.construct(config);
      Object.assign(this, port.peer);
    }
  },
  RTCSessionDescription: class {
    constructor(public description: unknown) {}
  },
}));

import { nativePrivateVideo, nativeVideoSdk } from "../../apps/mobile/src/privateVideo";

beforeEach(() => {
  vi.clearAllMocks();
  port.ownership = "standalone";
  port.os = "android";
});
it("uses official SDK capture/peer API, relay-only and releases tracks/native stream", async () => {
  const sdk = await nativeVideoSdk();
  const stream = await sdk.capture();
  const peer = sdk.peer(membership.relays, vi.fn(), vi.fn());
  peer.addTracks(stream);
  await peer.offer();
  expect(port.capture).toHaveBeenCalledWith({ audio: true, video: true });
  expect(port.construct).toHaveBeenCalledWith({
    iceServers: membership.relays,
    iceTransportPolicy: "relay",
  });
  expect(port.peer.addTrack).toHaveBeenCalled();
  peer.close();
  sdk.stop(stream);
  expect(port.peer.close).toHaveBeenCalledOnce();
  expect(port.stop).toHaveBeenCalledOnce();
  expect(port.release).toHaveBeenCalledOnce();
});
it("rejects Expo Go and web without capturing media", async () => {
  port.ownership = "expo";
  await expect(nativeVideoSdk()).rejects.toThrow("development build");
  port.ownership = "standalone";
  port.os = "web";
  await expect(nativeVideoSdk()).rejects.toThrow();
  expect(port.capture).not.toHaveBeenCalled();
});
it("background/dispose during lazy SDK setup cannot mount late or automatically rejoin", async () => {
  const open = vi.fn();
  const onLocal = vi.fn();
  const owner = nativePrivateVideo({
    signaling: { open },
    participantId: "synthetic-a",
    onState: vi.fn(),
    onLocal,
    onRemote: vi.fn(),
  });
  const pending = owner.connect(grant, new AbortController().signal);
  port.background?.("background");
  await expect(pending).rejects.toThrow();
  await expect(owner.connect(grant, new AbortController().signal)).rejects.toThrow();
  owner.dispose();
  expect(port.remove).toHaveBeenCalledOnce();
  expect(open).not.toHaveBeenCalled();
  expect(port.capture).not.toHaveBeenCalled();
  expect(onLocal).not.toHaveBeenCalled();
});
