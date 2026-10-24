import Constants from "expo-constants";
import { type ComponentType, useEffect, useRef, useState } from "react";
import { AppState, Button, Platform, Text, TextInput, View } from "react-native";
import type { MediaStream, RTCVideoViewProps } from "react-native-webrtc";
import {
  type ProofSnapshot,
  proofControlLabels,
  videoProofControls,
} from "../../../packages/client/src/video-proof-controls";
import {
  invitedVideoSignaling,
  videoProofEndpoint,
} from "../../../packages/client/src/video-proof-invitation";
import { nativePrivateVideo } from "./privateVideo";
import { nativeStreamingSignaling } from "./privateVideoSignaling";

/** English operator-only diagnostics. No SDK import, media or invitation in disabled/production builds. */
export function NativeVideoProof({ fontFamily }: { fontFamily: string | undefined }) {
  const extra = Constants.expoConfig?.extra;
  const config: unknown = extra?.p1VideoProof;
  if (
    !__DEV__ ||
    !["local", "dev"].includes(String(extra?.environment)) ||
    typeof config !== "object" ||
    config === null ||
    !("enabled" in config) ||
    config.enabled !== true
  )
    return null;
  const endpoint: unknown = "endpoint" in config ? config.endpoint : undefined;
  return <NativeVideoProofControls endpoint={endpoint} fontFamily={fontFamily} />;
}

export function NativeVideoProofControls({
  endpoint,
  fontFamily,
}: {
  endpoint: unknown;
  fontFamily: string | undefined;
}) {
  const [raw, setRaw] = useState("");
  const [snapshot, setSnapshot] = useState<ProofSnapshot>({ state: "needs-invitation" });
  const [configured, setConfigured] = useState(false);
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [Renderer, setRenderer] = useState<ComponentType<RTCVideoViewProps>>();
  const controls = useRef<ReturnType<typeof videoProofControls> | null>(null);
  useEffect(() => {
    let approved: string;
    try {
      approved = videoProofEndpoint(endpoint);
    } catch {
      setConfigured(false);
      setSnapshot({ state: "unavailable" });
      return;
    }
    setConfigured(true);
    setSnapshot({ state: "needs-invitation" });
    const current = videoProofControls({
      endpoint: approved,
      onChange: setSnapshot,
      onClear() {
        setRaw("");
        setLocal(null);
        setRemote(null);
        setRenderer(undefined);
      },
      async create(invitation, signal, onState) {
        // Import renderer only on explicit Join. Abort/epoch fences prevent late mounts.
        if (
          Platform.OS === "web" ||
          Constants.appOwnership === "expo" ||
          AppState.currentState !== "active"
        )
          throw new Error("Native development build required");
        const sdk = await import("react-native-webrtc");
        if (signal.aborted) throw new Error("Proof stopped");
        setRenderer(() => sdk.RTCView);
        return nativePrivateVideo({
          signaling: invitedVideoSignaling(
            invitation,
            Date.now,
            nativeStreamingSignaling(invitation.endpoint),
          ),
          participantId: invitation.member.participantId,
          onState,
          onLocal: (stream) => {
            if (!signal.aborted) setLocal(stream);
          },
          onRemote: (stream) => {
            if (!signal.aborted) setRemote(stream);
          },
        });
      },
    });
    controls.current = current;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") current.stop();
    });
    return () => {
      controls.current = null;
      current.dispose();
      subscription.remove();
    };
  }, [endpoint]);
  const active = ["authorizing", "permissions", "negotiating", "connected"].includes(
    snapshot.state,
  );
  return (
    <View
      accessibilityLabel="Synthetic video compatibility check"
      style={{ gap: 16, marginVertical: 24 }}
    >
      <Text accessibilityRole="header" style={{ fontFamily, fontSize: 20 }}>
        Synthetic video compatibility check
      </Text>
      <Text style={{ fontFamily }}>
        English technical diagnostics only — not a consultation. Synthetic participants only; never
        enter patient data. No clinical identity, consent or assignment is granted.
      </Text>
      <Text style={{ fontFamily }}>Private server-issued synthetic invitation JSON</Text>
      <TextInput
        accessibilityLabel="Private server-issued synthetic invitation JSON"
        secureTextEntry
        autoComplete="off"
        textContentType="none"
        autoCorrect={false}
        autoCapitalize="none"
        maxLength={4096}
        value={raw}
        onChangeText={setRaw}
        editable={configured && !active && snapshot.state !== "armed"}
        style={{ minHeight: 48, borderWidth: 1, padding: 12, fontFamily }}
      />
      <Button
        title="Load private invitation"
        disabled={!configured || active || snapshot.state === "armed" || !raw}
        onPress={() => {
          const input = raw;
          setRaw("");
          controls.current?.load(input);
        }}
      />
      {snapshot.state === "armed" && (
        <Text style={{ fontFamily }}>
          Participant {snapshot.participantId} ↔ peer {snapshot.peerId}. Expires{" "}
          {new Date(snapshot.expiresAt ?? 0).toISOString()}.
        </Text>
      )}
      <Text accessibilityLiveRegion="polite" style={{ fontFamily }}>
        {proofControlLabels[snapshot.state]}
      </Text>
      <Button
        title="Join synthetic video proof"
        disabled={snapshot.state !== "armed"}
        onPress={() => {
          void controls.current?.start();
        }}
      />
      <Button
        title="Stop and clear invitation"
        disabled={!active && snapshot.state !== "armed"}
        onPress={() => controls.current?.stop()}
      />
      {Renderer && local && (
        <View>
          <Text style={{ fontFamily }}>Local camera (muted)</Text>
          <Renderer
            streamURL={local.toURL()}
            mirror
            objectFit="contain"
            style={{ height: 220, width: "100%" }}
          />
        </View>
      )}
      {Renderer && remote && (
        <View>
          <Text style={{ fontFamily }}>Remote synthetic participant</Text>
          <Renderer
            streamURL={remote.toURL()}
            objectFit="contain"
            style={{ height: 220, width: "100%" }}
          />
        </View>
      )}
      <Text style={{ fontFamily }}>
        Invitation is memory-only and consumed once. Background, expiry or revocation stops media. A
        peer connection is not signed-device/TURN acceptance; verify bidirectional camera and audio
        manually.
      </Text>
    </View>
  );
}
