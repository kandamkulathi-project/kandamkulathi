import { apiOrigin } from "@kandamkulathi/client";
import {
  type TranscriptionReply,
  transcriptionReplySchema,
  transcriptionRequestSchema,
} from "../../../packages/contracts/src/transcription";

export interface TranscriptionCapturePort {
  permission(): Promise<boolean>;
  prepare(): Promise<void>;
  record(): void;
  stop(): Promise<void>;
  encoded(): Promise<string>;
  discard(): Promise<void>;
}
export type TranscriptionState =
  | TranscriptionReply["status"]
  | "idle"
  | "requesting"
  | "recording"
  | "clip"
  | "cleaning"
  | "cleanup-error"
  | "loading";

/** A private in-memory proof. Parent invalidates on background, draft edit, logout/session change.
 * Nothing here sends a Companion message. Only a current result can replace the editable draft.
 */
export function nativeTranscription(options: {
  origin: string;
  local: boolean;
  capture: TranscriptionCapturePort;
  credential(): string | undefined;
  current(): boolean;
  changed(state: TranscriptionState): void;
  review(text: string): void;
  transport?: (url: string, init?: RequestInit) => Promise<Response>;
}) {
  const origin = apiOrigin(options.origin, options.local);
  let epoch = 0;
  let busy = false;
  let recording = false;
  let clip = false;
  let pendingStop = false;
  let pendingDiscard = false;
  let cleanupRequested = false;
  let disposed = false;
  let activeDone = Promise.resolve();
  let settled: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  const cleanup = async () => {
    if (pendingStop) {
      await options.capture.stop();
      pendingStop = false;
      recording = false;
    }
    if (pendingDiscard) {
      await options.capture.discard();
      pendingDiscard = false;
    }
  };
  const begin = () => {
    busy = true;
    activeDone = new Promise<void>((resolve) => {
      settled = resolve;
    });
  };
  // The active operation owns the drain. Never stop/delete concurrently with prepare,
  // stop, or encoded/upload; failures retain their obligation for an explicit retry.
  const finish = async (failedAttempt?: number) => {
    try {
      while (cleanupRequested) {
        cleanupRequested = false;
        options.changed("cleaning");
        try {
          await cleanup();
          options.changed(failedAttempt !== undefined && valid(failedAttempt) ? "unknown" : "idle");
        } catch {
          cleanupRequested = false;
          options.changed("cleanup-error");
          break;
        }
      }
    } finally {
      busy = false;
      settled?.();
    }
  };
  const valid = (attempt: number) => !disposed && attempt === epoch && options.current();
  const stop = async () => {
    if (busy || !recording) return;
    begin();
    clearTimeout(timer);
    const attempt = epoch;
    try {
      await options.capture.stop();
      pendingStop = false;
      recording = false;
      if (valid(attempt)) {
        clip = true;
        options.changed("clip");
      } else cleanupRequested = true;
    } catch {
      recording = false;
      clip = false;
      cleanupRequested = true;
      if (valid(attempt)) options.changed("unknown");
    } finally {
      await finish(attempt);
    }
  };
  const invalidate = async () => {
    epoch++;
    clip = false;
    recording = false;
    clearTimeout(timer);
    controller?.abort();
    cleanupRequested = true;
    options.changed("cleaning");
    // Nonblocking when busy: the operation's finally drains even after rejection.
    // dispose() additionally awaits that operation for lifecycle owners that need it.
    if (!busy) {
      begin();
      await finish();
    }
  };
  return {
    async start() {
      if (busy || recording || disposed || !options.current()) return;
      begin();
      const attempt = ++epoch;
      clip = false;
      options.changed("requesting");
      try {
        try {
          await cleanup();
        } catch {
          options.changed("cleanup-error");
          return;
        }
        if (!valid(attempt)) return;
        if (!(await options.capture.permission())) {
          if (valid(attempt)) options.changed("denied");
          return;
        }
        if (!valid(attempt)) return;
        pendingStop = pendingDiscard = true;
        await options.capture.prepare();
        if (!valid(attempt)) {
          cleanupRequested = true;
          return;
        }
        options.capture.record();
        recording = true;
        options.changed("recording");
        timer = setTimeout(() => {
          void stop();
        }, 14500);
      } catch {
        cleanupRequested = true;
        if (valid(attempt)) options.changed("unknown");
      } finally {
        await finish(attempt);
      }
    },
    stop,
    /** Must be a separate actual user press after displaying the approved processing notice. */
    async transcribe(acceptedPolicyVersion: string) {
      if (busy || disposed || !clip || !options.current()) return;
      const credential = options.credential();
      if (!credential || !/^n1_[A-Za-z0-9_.-]+$/.test(credential)) {
        options.changed("denied");
        return;
      }
      begin();
      clip = false; // Never replay an uncertain upload automatically.
      const attempt = ++epoch;
      controller = new AbortController();
      const activeController = controller;
      const timeout = setTimeout(() => activeController.abort(), 25000);
      let dispatched = false;
      options.changed("loading");
      try {
        const input = transcriptionRequestSchema.parse({
          contentType: "audio/mp4",
          audio: await options.capture.encoded(),
          processingPolicyVersion: acceptedPolicyVersion,
          action: "transcribe-for-review",
        });
        if (!valid(attempt)) return;
        dispatched = true;
        const response = await (options.transport ?? fetch)(`${origin}/v1/transcription`, {
          method: "POST",
          credentials: "omit",
          redirect: "error",
          cache: "no-store",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${credential}` },
          body: JSON.stringify(input),
          signal: activeController.signal,
        });
        // React Native fetch does not consistently expose ReadableStream; use the bounded server
        // contract plus Content-Length when available, then validate the final small DTO.
        const length = Number(response.headers.get("content-length") ?? "0");
        if (length > 24000) throw new Error("Invalid response");
        const raw = await response.text();
        if (raw.length > 24000) throw new Error("Invalid response");
        const result = transcriptionReplySchema.parse(JSON.parse(raw));
        if (!valid(attempt)) return;
        if (activeController.signal.aborted) {
          options.changed("unknown");
          return;
        }
        if (result.status === "review" && response.ok) options.review(result.text);
        options.changed(result.status === "review" && !response.ok ? "unknown" : result.status);
      } catch {
        if (valid(attempt)) options.changed(dispatched ? "unknown" : "invalid");
      } finally {
        clearTimeout(timeout);
        controller = undefined;
        // Preserve the result state on successful deletion, but never conceal failure.
        if (!cleanupRequested) {
          try {
            await cleanup();
          } catch {
            options.changed("cleanup-error");
          }
        }
        await finish();
      }
    },
    invalidate,
    /** Terminal, awaitable unmount cleanup. False retains an obligation: retry dispose.
     * No background retry loop and no rejection for expected native cleanup failures.
     */
    async dispose() {
      disposed = true;
      await invalidate();
      await activeDone;
      return !pendingStop && !pendingDiscard;
    },
  };
}
