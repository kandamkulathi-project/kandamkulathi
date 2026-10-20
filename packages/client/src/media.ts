/** Browser-only local capture. No recorder, persistence or network/upload side effect. */
export function mediaProbe(
  acquire: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
  changed: (state: "idle" | "requesting" | "active" | "denied", stream?: MediaStream) => void,
) {
  let generation = 0;
  let active: MediaStream | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const release = () => {
    generation++;
    clearTimeout(timer);
    active?.getTracks().forEach((track) => {
      track.stop();
    });
    active = undefined;
  };
  return {
    async start(kind: "camera" | "microphone") {
      if (disposed) return;
      release();
      const current = generation;
      changed("requesting");
      try {
        const stream = await acquire({ video: kind === "camera", audio: kind === "microphone" });
        if (disposed || current !== generation) {
          stream.getTracks().forEach((track) => {
            track.stop();
          });
          return;
        }
        active = stream;
        changed("active", stream);
        timer = setTimeout(() => {
          release();
          changed("idle");
        }, 30000);
      } catch {
        if (!disposed && current === generation) changed("denied");
      }
    },
    stop() {
      release();
      if (!disposed) changed("idle");
    },
    dispose() {
      disposed = true;
      release();
    },
  };
}
