import { recordingProbe } from "@kandamkulathi/client/capture";
import { foundation, type Locale } from "@kandamkulathi/i18n";
import { AudioModule, RecordingPresets, useAudioRecorder } from "expo-audio";
import { File } from "expo-file-system";
import { useEffect, useRef, useState } from "react";
import { AppState, Button, Text, View } from "react-native";

export function LocalAudioCheck({ locale }: { locale: Locale }) {
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const probe = useRef<ReturnType<typeof recordingProbe> | null>(null);
  const [state, setState] = useState("idle");
  const text = foundation[locale];
  useEffect(() => {
    const controller = recordingProbe(
      {
        permission: async () => (await AudioModule.requestRecordingPermissionsAsync()).granted,
        prepare: () => recorder.prepareToRecordAsync(),
        record: () => recorder.record({ forDuration: 15 }),
        stop: () => recorder.stop(),
        discard: async () => {
          if (recorder.uri) {
            const file = new File(recorder.uri);
            if (file.exists) file.delete();
          }
        },
      },
      setState,
    );
    probe.current = controller;
    const lifecycle = AppState.addEventListener("change", (value) => {
      if (value !== "active") void controller.stop().catch(() => setState("failed"));
    });
    return () => {
      lifecycle.remove();
      probe.current = null;
      void controller.dispose().catch(() => {});
    };
  }, [recorder]);
  return (
    <View style={{ gap: 12 }}>
      <Button
        title={text.microphone}
        disabled={state === "requesting" || state === "active"}
        onPress={() => void probe.current?.start()}
      />
      <Button
        title={text.stop}
        onPress={() => void probe.current?.stop().catch(() => setState("failed"))}
      />
      <Text accessibilityLiveRegion="polite">
        {state === "active"
          ? text.mediaActive
          : state === "denied"
            ? text.permissionDenied
            : state === "failed"
              ? text.checkFailed
              : state === "requesting"
                ? text.loading
                : text.pending}
      </Text>
    </View>
  );
}
