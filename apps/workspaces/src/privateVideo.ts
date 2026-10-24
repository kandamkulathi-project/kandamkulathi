import {
  type AuthorizedVideoSignaling,
  privateVideoTransport,
  type VideoSdk,
  type VideoState,
} from "@kandamkulathi/client/private-video";
import type { VideoGrant } from "@kandamkulathi/contracts/sensitive";

/** Real browser WebRTC, relay-only. No localhost bypass and no provider or grant defaults. */
export const browserVideoSdk: VideoSdk<MediaStream> = {
  capture: () => navigator.mediaDevices.getUserMedia({ audio: true, video: true }),
  stop: (stream) => {
    for (const track of stream.getTracks()) track.stop();
  },
  peer(relays, remote, state) {
    const pc = new RTCPeerConnection({ iceServers: relays, iceTransportPolicy: "relay" });
    pc.ontrack = (event) => {
      for (const stream of event.streams) remote(stream);
    };
    pc.onconnectionstatechange = () => state(pc.connectionState);
    return {
      addTracks: (stream) => {
        for (const track of stream.getTracks()) pc.addTrack(track, stream);
      },
      offer: () => pc.createOffer(),
      answer: () => pc.createAnswer(),
      local: (description) => pc.setLocalDescription(description),
      remote: (description) => pc.setRemoteDescription(description),
      description: () => pc.localDescription,
      gathered: () => pc.iceGatheringState === "complete",
      onGathered(listener) {
        pc.addEventListener("icegatheringstatechange", listener);
        return () => pc.removeEventListener("icegatheringstatechange", listener);
      },
      close() {
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
      },
    };
  },
};

/** Call only after an explicit user action. Unmount/logout must call dispose.
 * Hidden pages terminate; visibility return never passively rejoins. */
export function browserPrivateVideo(options: {
  signaling: AuthorizedVideoSignaling;
  participantId: string;
  local: HTMLVideoElement;
  remote: HTMLVideoElement;
  onState: (state: VideoState) => void;
}) {
  let disposed = false;
  const controller = new AbortController();
  options.local.muted = true;
  options.local.playsInline = options.remote.playsInline = true;
  const show = (element: HTMLVideoElement, stream: MediaStream | null) => {
    element.srcObject = stream;
    // Autoplay rejection is not a connected-media claim; caller can expose native play controls.
    if (stream)
      void element.play().catch(() => {
        element.controls = true;
      });
  };
  const connect = privateVideoTransport({
    sdk: browserVideoSdk,
    signaling: options.signaling,
    participantId: options.participantId,
    onState: options.onState,
    onLocal: (stream) => show(options.local, stream),
    onRemote: (stream) => show(options.remote, stream),
  });
  const stop = () => controller.abort();
  const hidden = () => {
    if (document.visibilityState !== "visible") stop();
  };
  document.addEventListener("visibilitychange", hidden);
  window.addEventListener("pagehide", stop);
  return {
    connect(grant: VideoGrant, signal: AbortSignal) {
      if (disposed || document.visibilityState !== "visible")
        return Promise.reject(new Error("Video unavailable"));
      return connect(grant, AbortSignal.any([signal, controller.signal]));
    },
    dispose() {
      disposed = true;
      stop();
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", stop);
    },
  };
}
