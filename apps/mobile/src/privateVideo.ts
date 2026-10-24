import {
  type AuthorizedVideoSignaling,
  privateVideoTransport,
  type VideoSdk,
  type VideoState,
} from "@kandamkulathi/client/private-video";
import type { VideoGrant } from "@kandamkulathi/contracts/sensitive";
import Constants from "expo-constants";
import { AppState, Platform } from "react-native";
import type { MediaStream } from "react-native-webrtc";

/** Import native code only after explicit join; Expo Go and web are truthfully unavailable. */
export async function nativeVideoSdk(): Promise<VideoSdk<MediaStream>> {
  if (Platform.OS === "web" || Constants.appOwnership === "expo")
    throw new Error("A native WebRTC development build is required");
  const { mediaDevices, RTCPeerConnection, RTCSessionDescription } = await import(
    "react-native-webrtc"
  );
  return {
    capture: () => mediaDevices.getUserMedia({ audio: true, video: true }),
    stop: (stream) => {
      for (const track of stream.getTracks()) track.stop();
      stream.release();
    },
    peer(relays, remote, state) {
      const pc = new RTCPeerConnection({ iceServers: relays, iceTransportPolicy: "relay" });
      const track = (event: { streams: MediaStream[] }) => {
        for (const stream of event.streams) remote(stream);
      };
      const changed = () => state(pc.connectionState);
      pc.addEventListener("track", track);
      pc.addEventListener("connectionstatechange", changed);
      return {
        addTracks: (stream) => {
          for (const item of stream.getTracks()) pc.addTrack(item, stream);
        },
        offer: () => pc.createOffer(),
        answer: () => pc.createAnswer(),
        local: (description) => pc.setLocalDescription(new RTCSessionDescription(description)),
        remote: (description) => pc.setRemoteDescription(new RTCSessionDescription(description)),
        description: () => pc.localDescription,
        gathered: () => pc.iceGatheringState === "complete",
        onGathered(listener) {
          pc.addEventListener("icegatheringstatechange", listener);
          return () => pc.removeEventListener("icegatheringstatechange", listener);
        },
        close() {
          pc.removeEventListener("track", track);
          pc.removeEventListener("connectionstatechange", changed);
          pc.close();
        },
      };
    },
  };
}

/** Mount contract: render supplied streams with SDK RTCView/toURL, never treat preview as joined.
 * Instantiate once per mounted owner; dispose on unmount/logout. Fresh mount + grant after background. */
export function nativePrivateVideo(options: {
  signaling: AuthorizedVideoSignaling;
  participantId: string;
  onState: (state: VideoState) => void;
  onLocal: (stream: MediaStream | null) => void;
  onRemote: (stream: MediaStream | null) => void;
}) {
  const controller = new AbortController();
  let pending = false;
  const subscription = AppState.addEventListener("change", (state) => {
    if (state !== "active") controller.abort();
  });
  return {
    async connect(grant: VideoGrant, outer: AbortSignal) {
      if (
        pending ||
        controller.signal.aborted ||
        outer.aborted ||
        AppState.currentState !== "active"
      )
        throw new Error("Native video unavailable");
      pending = true;
      // Explicit linked signal: compatible with Hermes without relying on AbortSignal.any.
      const attempt = new AbortController();
      const abort = () => attempt.abort();
      controller.signal.addEventListener("abort", abort, { once: true });
      outer.addEventListener("abort", abort, { once: true });
      const unsubscribe = () => {
        controller.signal.removeEventListener("abort", abort);
        outer.removeEventListener("abort", abort);
      };
      try {
        const sdk = await nativeVideoSdk();
        if (attempt.signal.aborted) throw new Error("Native video closed");
        const connect = privateVideoTransport({
          ...options,
          sdk,
          onState(state) {
            if (state === "closed") {
              pending = false;
              unsubscribe();
            }
            options.onState(state);
          },
        });
        return await connect(grant, attempt.signal);
      } catch (error) {
        pending = false;
        unsubscribe();
        throw error;
      }
    },
    dispose() {
      controller.abort();
      subscription.remove();
    },
  };
}
