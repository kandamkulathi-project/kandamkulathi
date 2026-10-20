import { mediaProbe } from "@kandamkulathi/client/media";
import { foundation, type Locale } from "@kandamkulathi/i18n";
import { useEffect, useRef, useState } from "react";

export function DeviceCheck({ locale }: { locale: Locale }) {
  const text = foundation[locale];
  const [state, setState] = useState("idle");
  const video = useRef<HTMLVideoElement>(null);
  const probe = useRef<ReturnType<typeof mediaProbe> | null>(null);
  useEffect(() => {
    const controller = mediaProbe(
      (constraints) => navigator.mediaDevices.getUserMedia(constraints),
      (next, stream) => {
        setState(next);
        if (video.current) video.current.srcObject = stream ?? null;
      },
    );
    probe.current = controller;
    const pause = () => {
      if (document.hidden) controller.stop();
    };
    document.addEventListener("visibilitychange", pause);
    window.addEventListener("pagehide", controller.stop);
    return () => {
      controller.dispose();
      probe.current = null;
      document.removeEventListener("visibilitychange", pause);
      window.removeEventListener("pagehide", controller.stop);
    };
  }, []);
  return (
    <section aria-label={text.devices}>
      <h2>{text.devices}</h2>
      <div className="actions">
        <button
          type="button"
          disabled={state === "requesting"}
          onClick={() => void probe.current?.start("camera")}
        >
          {text.camera}
        </button>
        <button
          type="button"
          disabled={state === "requesting"}
          onClick={() => void probe.current?.start("microphone")}
        >
          {text.microphone}
        </button>
        <button type="button" onClick={() => probe.current?.stop()}>
          {text.stop}
        </button>
      </div>
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        aria-label={text.camera}
        hidden={state !== "active"}
      />
      <p role="status">
        {state === "denied"
          ? text.permissionDenied
          : state === "requesting"
            ? text.loading
            : state === "active"
              ? text.mediaActive
              : text.pending}
      </p>
    </section>
  );
}
