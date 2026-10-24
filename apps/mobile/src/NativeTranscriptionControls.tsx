import type { Locale } from "@kandamkulathi/i18n";
import { setAudioModeAsync, useAudioRecorder } from "expo-audio";
import Constants from "expo-constants";
import { File } from "expo-file-system";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { AppState, Button, Switch, Text, View } from "react-native";
import { transcriptionText } from "../../../packages/i18n/src/transcription";
import type { nativeTranscription, TranscriptionState } from "./transcription";
import { expoTranscriptionCapture, transcriptionRecordingOptions } from "./transcriptionCapture";
import { createOwnedTranscription, transcriptionCleanup } from "./transcriptionCleanup";

export interface NativeTranscriptionAccess {
  origin: string;
  local: boolean;
  readCredential(): Promise<string | null>;
  current(): boolean;
}
export function approvedTranscriptionNotice(
  extra: unknown,
  locale: Locale,
): { version: string; notice: string } | undefined {
  if (
    !extra ||
    typeof extra !== "object" ||
    Reflect.get(extra, "transcriptionProofApproved") !== true
  )
    return;
  const policy: unknown = Reflect.get(extra, "transcriptionProcessingPolicy");
  if (!policy || typeof policy !== "object") return;
  const version: unknown = Reflect.get(policy, "version");
  const notices: unknown = Reflect.get(policy, "notices");
  if (
    typeof version !== "string" ||
    !version.trim() ||
    version.length > 128 ||
    !notices ||
    typeof notices !== "object"
  )
    return;
  for (const language of ["en", "ml", "ta"]) {
    const value: unknown = Reflect.get(notices, language);
    if (typeof value !== "string" || !value.trim() || value.length > 12000) return;
  }
  return { version, notice: Reflect.get(notices, locale) as string };
}
type Props = {
  access: NativeTranscriptionAccess | undefined;
  locale: Locale;
  fontFamily: string | undefined;
  revision: number;
  draftFence: { readonly current: number };
  disabled: boolean;
  onReview(text: string): void;
  onBusy(busy: boolean): void;
};
// Cleanup registry handles must not close over the component's props or private draft.
function audioCapture(recorder: Parameters<typeof expoTranscriptionCapture>[0]) {
  const capture = expoTranscriptionCapture(recorder);
  let file: File | undefined;
  const rememberFile = () => {
    try {
      if (recorder.uri) file = new File(recorder.uri);
    } catch {
      /* A released SDK handle cannot replace an already captured cleanup path. */
    }
  };
  return {
    ...capture,
    async prepare() {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      try {
        await capture.prepare();
      } finally {
        rememberFile();
      }
    },
    record() {
      capture.record();
      rememberFile();
    },
    async stop() {
      rememberFile();
      try {
        await capture.stop();
      } finally {
        rememberFile();
      }
    },
    async discard() {
      // Keep deletion retryable after useAudioRecorder releases its native handle.
      if (file) {
        if (file.exists) file.delete();
      } else await capture.discard();
      await setAudioModeAsync({ allowsRecording: false });
    },
  };
}
export function NativeTranscriptionControls(props: Props) {
  const policy = approvedTranscriptionNotice(Constants.expoConfig?.extra, props.locale);
  if (!policy || !props.access)
    return (
      <View style={{ gap: 12 }}>
        <Text style={{ fontFamily: props.fontFamily }}>
          {transcriptionText[props.locale].unavailable}
        </Text>
        <DetachedCleanupNotice locale={props.locale} fontFamily={props.fontFamily} />
      </View>
    );
  return (
    <ActiveTranscriptionControls
      key={`${props.locale}:${policy.version}:${policy.notice}`}
      {...props}
      access={props.access}
      policy={policy}
    />
  );
}

function DetachedCleanupNotice({
  locale,
  fontFamily,
}: {
  locale: Locale;
  fontFamily: string | undefined;
}) {
  const state = useSyncExternalStore(
    transcriptionCleanup.subscribe,
    transcriptionCleanup.snapshot,
    transcriptionCleanup.snapshot,
  );
  if (state === "idle") return null;
  const text = transcriptionText[locale];
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontFamily }} accessibilityLiveRegion="polite">
        {text.states[state]}
      </Text>
      <Button
        title={text.retryCleanup}
        disabled={state === "cleaning"}
        onPress={() => {
          void transcriptionCleanup.retry();
        }}
      />
    </View>
  );
}

function ActiveTranscriptionControls({
  access,
  locale,
  fontFamily,
  revision,
  draftFence,
  disabled,
  policy,
  onReview,
  onBusy,
}: Props & {
  access: NativeTranscriptionAccess;
  policy: { version: string; notice: string };
}) {
  const recorder = useAudioRecorder(transcriptionRecordingOptions);
  const resource = useRef<
    (ReturnType<typeof nativeTranscription> & { upload(): Promise<void> }) | undefined
  >(undefined);
  const cleanupState = useSyncExternalStore(
    transcriptionCleanup.subscribe,
    transcriptionCleanup.snapshot,
    transcriptionCleanup.snapshot,
  );
  const pendingCleanup = cleanupState !== "idle";
  const [state, setState] = useState<TranscriptionState>("idle");
  const [accepted, setAccepted] = useState<string>();
  const [ready, setReady] = useState(false);
  const [preparingUpload, setPreparingUpload] = useState(false);
  const review = useEffectEvent(onReview);
  const activity = useEffectEvent(onBusy);
  const text = transcriptionText[locale];
  useEffect(() => {
    let active = true;
    let credential: string | undefined;
    let uploading = false;
    const lifetime = createOwnedTranscription({
      origin: access.origin,
      local: access.local,
      capture: audioCapture(recorder),
    });
    const controller = lifetime.controller;
    lifetime.attach({
      credential: () => credential,
      current: () =>
        active &&
        !transcriptionCleanup.pending() &&
        revision === draftFence.current &&
        !disabled &&
        AppState.currentState === "active" &&
        access.current(),
      review: (value) => {
        if (active) review(value);
      },
      changed: (value) => {
        if (!active) return;
        setState(value);
        activity(
          value === "recording" ||
            value === "requesting" ||
            value === "loading" ||
            value === "cleaning",
        );
      },
    });
    // This effect owns both the controller and its credential closure; StrictMode cleanup
    // invalidates only that effect's instance, never a memoized replacement.
    const owned = {
      ...controller,
      start() {
        if (!active || transcriptionCleanup.pending()) return Promise.resolve();
        return controller.start();
      },
      stop() {
        if (!active || transcriptionCleanup.pending()) return Promise.resolve();
        return controller.stop();
      },
      async upload() {
        if (!active || transcriptionCleanup.pending() || uploading) return;
        uploading = true;
        setPreparingUpload(true);
        activity(true);
        await (async () => {
          try {
            const value = await access.readCredential();
            if (!active || disabled || AppState.currentState !== "active" || !access.current())
              return;
            credential = value ?? undefined;
            await controller.transcribe(policy.version);
          } catch {
            if (active) setState("denied");
          } finally {
            uploading = false;
            credential = undefined;
            if (active) {
              setPreparingUpload(false);
              activity(false);
            }
          }
        })();
      },
    };
    resource.current = owned;
    setAccepted(undefined);
    setState("idle");
    setReady(false);
    setPreparingUpload(false);
    void transcriptionCleanup.settle().then(
      (clean) => {
        if (active) {
          setReady(true);
          if (!clean) setState("cleanup-error");
        }
      },
      () => {
        if (active) setState("unknown");
      },
    );
    const subscription = AppState.addEventListener("change", (value) => {
      if (value !== "active") {
        credential = undefined;
        setAccepted(undefined);
        void controller.invalidate().catch(() => {
          if (active) setState("unknown");
        });
      }
    });
    return () => {
      active = false;
      credential = undefined;
      resource.current = undefined;
      subscription.remove();
      activity(false);
      lifetime.detach();
      void transcriptionCleanup.retire(controller);
    };
  }, [access, recorder, revision, draftFence, disabled, policy.version]);
  const busy =
    preparingUpload ||
    state === "requesting" ||
    state === "recording" ||
    state === "loading" ||
    state === "cleaning" ||
    cleanupState === "cleaning";
  const canUpload =
    ready &&
    !disabled &&
    !pendingCleanup &&
    state === "clip" &&
    accepted === policy.version &&
    !preparingUpload;
  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={{ fontFamily }}>
        {text.title}
      </Text>
      <Text accessibilityLiveRegion="polite" style={{ fontFamily }}>
        {text.states[cleanupState !== "idle" ? cleanupState : state]}
      </Text>
      <Button
        title={text.record}
        disabled={!ready || disabled || busy || pendingCleanup}
        onPress={() => {
          setAccepted(undefined);
          void resource.current?.start();
        }}
      />
      <Button
        title={text.stop}
        disabled={state !== "recording"}
        onPress={() => void resource.current?.stop()}
      />
      <Text style={{ fontFamily }}>
        {text.version}: {policy.version}
      </Text>
      <Text style={{ fontFamily }}>{policy.notice}</Text>
      <Text style={{ fontFamily }}>{text.acknowledge}</Text>
      <Switch
        accessibilityLabel={text.acknowledge}
        value={accepted === policy.version}
        disabled={disabled || busy || state !== "clip"}
        onValueChange={(value) => setAccepted(value ? policy.version : undefined)}
      />
      <Button
        title={text.upload}
        disabled={!canUpload}
        onPress={() => {
          if (!canUpload) return;
          setAccepted(undefined);
          void resource.current?.upload();
        }}
      />
      <Button
        title={text.discard}
        disabled={
          !ready || disabled || preparingUpload || (state !== "clip" && state !== "recording")
        }
        onPress={() => {
          setAccepted(undefined);
          void resource.current?.invalidate().catch(() => setState("unknown"));
        }}
      />
      {state === "review" && <Text style={{ fontFamily }}>{text.review}</Text>}
      {(pendingCleanup || state === "cleanup-error") && (
        <Button
          title={text.retryCleanup}
          disabled={busy || preparingUpload}
          onPress={async () => {
            const owned = resource.current;
            setAccepted(undefined);
            if (transcriptionCleanup.pending()) {
              setState("cleaning");
              onBusy(true);
              const clean = await transcriptionCleanup.retry();
              if (resource.current !== owned) return;
              // A fresh effect has no local file; detached older handles alone blocked it.
              setState(clean ? "idle" : "cleanup-error");
              onBusy(false);
            } else await owned?.invalidate();
          }}
        />
      )}
    </View>
  );
}
