import {
  type TranscriptionReply,
  transcriptionLimits,
  validateTranscriptionAudio,
} from "../../contracts/src/transcription";

export const transcriptionEndpoint = "https://api.openai.com/v1/audio/transcriptions";
export const transcriptionModel = "gpt-transcribe";

export function createTranscriptionProvider(
  bindings: Record<string, unknown>,
  transport: (url: string, init?: RequestInit) => Promise<Response> = fetch,
) {
  const key = bindings.OPENAI_API_KEY;
  const version = bindings.TRANSCRIPTION_PROCESSING_POLICY_VERSION;
  const ready =
    bindings.TRANSCRIPTION_CONFIGURATION_APPROVED === "true" &&
    bindings.TRANSCRIPTION_PROCESSING_APPROVED === "true" &&
    typeof version === "string" &&
    version.length > 0 &&
    version.length <= 128 &&
    typeof key === "string" &&
    key.length > 0 &&
    key.length <= 1024;
  return {
    policyVersion: ready ? (version as string) : undefined,
    async transcribe(bytes: Uint8Array, signal: AbortSignal): Promise<TranscriptionReply> {
      if (!ready) return { status: "not-configured" };
      try {
        validateTranscriptionAudio(bytes);
      } catch {
        return { status: "invalid" };
      }
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(abort, 20000);
      try {
        signal.throwIfAborted();
        const form = new FormData();
        form.set("model", transcriptionModel);
        form.set("file", new Blob([new Uint8Array(bytes)], { type: "audio/mp4" }), "clip.m4a");
        const response = await transport(transcriptionEndpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: form,
          signal: controller.signal,
          redirect: "error",
        });
        if (!response.ok) {
          await response.body?.cancel();
          return { status: response.status === 429 ? "rate-limited" : "unknown" };
        }
        if (!response.headers.get("content-type")?.includes("application/json") || !response.body) {
          await response.body?.cancel();
          return { status: "unknown" };
        }
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > transcriptionLimits.responseBytes) {
              await reader.cancel();
              return { status: "unknown" };
            }
            chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }
        controller.signal.throwIfAborted();
        const body = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          body.set(chunk, offset);
          offset += chunk.length;
        }
        const result: unknown = JSON.parse(
          new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(body),
        );
        if (
          !result ||
          typeof result !== "object" ||
          !("text" in result) ||
          typeof result.text !== "string" ||
          result.text.length > 4000
        )
          return { status: "unknown" };
        const text = result.text.trim();
        return text ? { status: "review", text } : { status: "empty" };
      } catch {
        return { status: "unknown" };
      } finally {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
      }
    },
  };
}
