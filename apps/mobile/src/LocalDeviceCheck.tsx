import { foundation, type Locale } from "@kandamkulathi/i18n";
import { Camera, CameraView } from "expo-camera";
import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";
import { AppState, Button, Text, View } from "react-native";
import { LocalAudioCheck } from "./LocalAudioCheck";
import { nativeVault } from "./native";

export function LocalDeviceCheck({ locale }: { locale: Locale }) {
  const text = foundation[locale];
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<
    "pending" | "completed" | "permissionDenied" | "mediaActive" | "checkFailed"
  >("pending");
  const generation = useRef(0);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stop = () => {
    generation.current++;
    clearTimeout(timer.current);
    setCamera(false);
    setBusy(false);
    setStatus("pending");
  };
  const stopRef = useRef(stop);
  stopRef.current = stop;
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") stopRef.current();
    });
    return () => {
      mounted.current = false;
      generation.current++;
      clearTimeout(timer.current);
      subscription.remove();
    };
  }, []);
  const check = async (kind: "camera" | "notifications" | "storage") => {
    if (busy) return;
    setBusy(true);
    const current = ++generation.current;
    const valid = () => mounted.current && current === generation.current;
    try {
      if (kind === "storage") {
        const vault = nativeVault("local", "diagnostic");
        try {
          await vault.write("synthetic-local-check");
          if ((await vault.read()) !== "synthetic-local-check")
            throw new Error("Storage check failed");
        } finally {
          await vault.clear();
        }
        if (valid()) setStatus("completed");
      } else {
        const permission =
          kind === "camera"
            ? await Camera.requestCameraPermissionsAsync()
            : await Notifications.requestPermissionsAsync();
        if (!valid()) return;
        if (!permission.granted) {
          setStatus("permissionDenied");
          return;
        }
        if (kind === "camera") {
          setCamera(true);
          setStatus("mediaActive");
          timer.current = setTimeout(() => stopRef.current(), 15000);
        } else setStatus("completed");
      }
    } catch {
      if (valid()) setStatus("checkFailed");
    } finally {
      if (valid()) setBusy(false);
    }
  };
  return (
    <View style={{ gap: 12 }} accessibilityLabel={text.devices}>
      <Text accessibilityRole="header">{text.devices}</Text>
      {(["camera", "notifications", "storage"] as const).map((kind) => (
        <Button
          key={kind}
          title={text[kind]}
          disabled={busy || camera}
          onPress={() => void check(kind)}
        />
      ))}
      <Button title={text.stop} onPress={stop} />
      {camera && <CameraView facing="front" style={{ height: 220 }} />}
      <Text accessibilityLiveRegion="polite">{text[status]}</Text>
      <Text>{text.storageHelp}</Text>
      <LocalAudioCheck locale={locale} />
    </View>
  );
}
