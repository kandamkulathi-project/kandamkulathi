import type { VideoGrant } from "@kandamkulathi/contracts/sensitive";
import type { AuthorizedVideoSignaling, Description } from "./private-video";

type ProofResponse = Pick<Response, "ok" | "headers" | "body">;
/** Only the browser/Expo fetch surface actually used here; no Worker-only Response fields. */
export type ProofFetch = (
  url: URL,
  init: {
    method: "POST";
    cache: "no-store";
    credentials: "omit";
    redirect: "error";
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<ProofResponse>;

/** No text()/JSON fallback: native callers must supply a streaming fetch (Expo SDK 58 expo/fetch). */
async function boundedProofResponse(
  response: ProofResponse,
  signal: AbortSignal,
): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Streaming proof response unavailable");
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    signal.throwIfAborted();
    if (Number(response.headers.get("content-length")) > 70000)
      throw new Error("Invalid proof response");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 70000) throw new Error("Invalid proof response");
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch (error) {
    cancel();
    throw error;
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

/** Explicit synthetic-proof transport only. URL is fixed by the build/operator, never grant data.
 * Clinical production signaling is not configured by this adapter. */
export function technicalVideoSignaling(
  endpoint: string,
  request: ProofFetch = fetch,
): AuthorizedVideoSignaling {
  const url = new URL(endpoint);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/p1-private-video-proof"
  )
    throw new Error("Private proof HTTPS endpoint required");
  return {
    async open(grant: VideoGrant, outer: AbortSignal) {
      const controller = new AbortController();
      const abort = () => controller.abort();
      outer.addEventListener("abort", abort, { once: true });
      if (outer.aborted) abort();
      let revoked: (() => void) | undefined;
      let closed = false;
      const call = async (
        action: string,
        description?: Description,
        signal = controller.signal,
      ) => {
        const attempt = new AbortController();
        const stop = () => attempt.abort();
        signal.addEventListener("abort", stop, { once: true });
        if (signal.aborted) stop();
        let deadline: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_resolve, reject) => {
          deadline = setTimeout(() => {
            attempt.abort();
            reject(new Error("Private proof timed out"));
          }, 5000);
        });
        const work = async () => {
          const response = await request(url, {
            method: "POST",
            cache: "no-store",
            credentials: "omit",
            redirect: "error",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${grant.ticket}`,
            },
            body: JSON.stringify({
              action,
              appointmentId: grant.appointmentId,
              revision: grant.revision,
              ...(description ? { description } : {}),
            }),
            signal: attempt.signal,
          });
          if (!response.ok) {
            revoked?.();
            throw new Error("Private proof unavailable");
          }
          return boundedProofResponse(response, attempt.signal);
        };
        try {
          return await Promise.race([work(), timeout]);
        } finally {
          // Also cancel unread error bodies and fetch implementations that resolve after timeout.
          attempt.abort();
          clearTimeout(deadline);
          signal.removeEventListener("abort", stop);
        }
      };
      let timer: ReturnType<typeof setTimeout> | undefined;
      const close = () => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        // Best-effort immediate peer notification; deadline/poll still enforce closure if offline.
        const leave = new AbortController();
        const deadline = setTimeout(() => leave.abort(), 1000);
        void call("leave", undefined, leave.signal)
          .catch(() => {})
          .finally(() => clearTimeout(deadline));
        abort();
        outer.removeEventListener("abort", abort);
      };
      try {
        const membership = await call("join");
        const poll = async () => {
          try {
            await call("status");
            if (!closed)
              timer = setTimeout(() => {
                void poll();
              }, 1000);
          } catch {
            if (!controller.signal.aborted) revoked?.();
          }
        };
        timer = setTimeout(() => {
          void poll();
        }, 1000);
        return {
          membership,
          async send(description) {
            await call("send", description);
          },
          async receive(signal) {
            while (!signal.aborted && !controller.signal.aborted) {
              const result = await call("receive");
              if (result !== null) return result;
              await new Promise<void>((resolve, reject) => {
                const stop = () => {
                  clearTimeout(delay);
                  reject(new Error("Proof closed"));
                };
                const delay = setTimeout(() => {
                  controller.signal.removeEventListener("abort", stop);
                  resolve();
                }, 200);
                controller.signal.addEventListener("abort", stop, { once: true });
              });
            }
            throw new Error("Proof closed");
          },
          onRevoked(listener) {
            revoked = listener;
            return () => {
              revoked = undefined;
            };
          },
          close,
        };
      } catch (error) {
        close();
        throw error;
      }
    },
  };
}
