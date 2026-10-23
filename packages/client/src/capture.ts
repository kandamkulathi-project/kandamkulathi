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
  let stopPending = false;
  let discardPending = false;
  let disposed = false;
  let stopping = 0;
  let task = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = async () => {
    if (stopPending) {
      await port.stop();
      stopPending = false;
    }
    if (discardPending) {
      await port.discard();
      discardPending = false;
    }
  };
  const stop = () => {
    generation++;
    clearTimeout(timer);
    busy = true;
    stopping++;
    task = task
      .then(cleanup, cleanup)
      .then(
        () => {
          if (!disposed) changed("idle");
        },
        (error: unknown) => {
          if (!disposed) changed("failed");
          throw error;
        },
      )
      .finally(() => {
        busy = false;
        stopping--;
      });
    return task;
  };
  return {
    start() {
      if (disposed || busy || stopPending || discardPending || stopping > 0)
        return task.catch(() => {}); // Refused starts must not leak a previous cleanup rejection.
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
          // Preparation may allocate a file before failing; retain both cleanup obligations.
          stopPending = true;
          discardPending = true;
          await port.prepare();
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
