export interface RecordingPort {
  permission(): Promise<boolean>;
  prepare(): Promise<void>;
  record(): void;
  stop(): Promise<void>;
  discard(): Promise<void>;
}
/** Serial lifecycle for a local, bounded native recording; no upload capability. */
export function recordingProbe(
  port: RecordingPort,
  changed: (state: "idle" | "requesting" | "active" | "denied" | "failed") => void,
) {
  let generation = 0;
  let busy = false;
  let prepared = false;
  let disposed = false;
  let stopping = 0;
  let task = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = async () => {
    if (!prepared) return;
    prepared = false;
    try {
      await port.stop();
    } finally {
      await port.discard();
    }
  };
  const stop = () => {
    generation++;
    clearTimeout(timer);
    busy = true;
    stopping++;
    task = task
      .then(cleanup, cleanup)
      .then(() => {
        if (!disposed) changed("idle");
      })
      .finally(() => {
        busy = false;
        stopping--;
      });
    return task;
  };
  return {
    start() {
      if (disposed || busy || prepared || stopping > 0) return task;
      busy = true;
      const current = ++generation;
      changed("requesting");
      task = (async () => {
        try {
          const granted = await port.permission();
          if (disposed || generation !== current) return;
          if (!granted) {
            changed("denied");
            return;
          }
          await port.prepare();
          prepared = true;
          if (disposed || generation !== current) {
            await cleanup();
            return;
          }
          port.record();
          changed("active");
          timer = setTimeout(() => {
            void stop().catch(() => {
              if (!disposed) changed("failed");
            });
          }, 15000);
        } catch {
          await cleanup().catch(() => {});
          if (!disposed && current === generation) changed("failed");
        } finally {
          busy = false;
        }
      })();
      return task;
    },
    stop,
    async dispose() {
      disposed = true;
      await stop();
    },
  };
}
