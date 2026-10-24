import { nativeTranscription, type TranscriptionState } from "./transcription";

type CleanupObligation = { dispose(): Promise<boolean> };
/** Retains only detached cleanup handles, never transcripts, notices, credentials or React owners.
 * Each retirement attempts disposal once. A failure blocks new capture until an explicit retry.
 */
export function createTranscriptionCleanupRegistry() {
  const pending = new Set<CleanupObligation>();
  const running = new Map<CleanupObligation, Promise<boolean>>();
  const listeners = new Set<() => void>();
  let retry: Promise<boolean> | undefined;
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const attempt = (item: CleanupObligation): Promise<boolean> => {
    const existing = running.get(item);
    if (existing) return existing;
    pending.add(item);
    // Invoke synchronously: Expo retains hook objects through synchronous consumer
    // cleanup only, then schedules their release on the next microtask.
    const perform = async () => item.dispose();
    const task = perform()
      .then(
        (ok) => {
          if (ok) pending.delete(item);
          return ok;
        },
        () => false,
      )
      .finally(() => {
        running.delete(item);
        notify();
      });
    running.set(item, task);
    notify();
    return task;
  };
  const settle = async () => {
    await Promise.all([...running.values()]);
    return pending.size === 0;
  };
  return {
    pending: () => pending.size > 0,
    snapshot: (): "idle" | "cleaning" | "cleanup-error" =>
      running.size > 0 ? "cleaning" : pending.size > 0 ? "cleanup-error" : "idle",
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    retire: attempt,
    settle,
    retry() {
      if (retry) return retry;
      retry = (async () => {
        await settle();
        for (const item of [...pending]) await attempt(item);
        return pending.size === 0;
      })().finally(() => {
        retry = undefined;
      });
      return retry;
    },
  };
}
export const transcriptionCleanup = createTranscriptionCleanupRegistry();

type Owner = {
  current(): boolean;
  credential(): string | undefined;
  changed(state: TranscriptionState): void;
  review(text: string): void;
};
/** Call detach BEFORE registry retention: the remaining controller closes over only
 * transport primitives, the capture/file cleanup port, and an empty callback cell.
 */
export function createOwnedTranscription(
  options: Pick<Parameters<typeof nativeTranscription>[0], "origin" | "local" | "capture">,
) {
  let callbacks: Owner | undefined;
  const controller = nativeTranscription({
    ...options,
    current: () => callbacks?.current() ?? false,
    credential: () => callbacks?.credential(),
    changed: (state) => callbacks?.changed(state),
    review: (text) => callbacks?.review(text),
  });
  return {
    controller,
    attach(owner: Owner) {
      callbacks = owner;
    },
    detach() {
      callbacks = undefined;
    },
  };
}
