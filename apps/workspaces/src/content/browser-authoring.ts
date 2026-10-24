import {
  type KnowledgeAuthoringTransport,
  knowledgeAuthoringRequestMaxBytes,
  knowledgeAuthoringResponseMaxBytes,
} from "@kandamkulathi/contracts/knowledge-authoring";

/** Pair only with the root's verified-epoch browser transport (real cookie + fresh CSRF). */
export function createBrowserAuthoringTransport(
  origin: string,
  transport: typeof fetch,
): KnowledgeAuthoringTransport {
  return async (request) => {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(5000)]);
    const body = request.method === "POST" ? JSON.stringify(request.body) : undefined;
    if (
      body !== undefined &&
      new TextEncoder().encode(body).byteLength > knowledgeAuthoringRequestMaxBytes
    )
      throw new Error("Knowledge request exceeds transport limit");
    signal.throwIfAborted();
    const response = await transport(`${origin}${request.path}`, {
      method: request.method,
      cache: "no-store",
      credentials: "include",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body }),
      signal,
    });
    signal.throwIfAborted();
    if (!response.body) throw new Error("Knowledge response body unavailable");
    const reader = response.body.getReader();
    const abort = () => {
      void reader.cancel().catch(() => {});
    };
    signal.addEventListener("abort", abort, { once: true });
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        signal.throwIfAborted();
        const chunk = await reader.read();
        signal.throwIfAborted();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > knowledgeAuthoringResponseMaxBytes)
          throw new Error("Knowledge response exceeds transport limit");
        chunks.push(chunk.value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const decoded: unknown = JSON.parse(
        new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes),
      );
      signal.throwIfAborted();
      return { httpStatus: response.status, body: decoded };
    } finally {
      signal.removeEventListener("abort", abort);
      await reader.cancel();
    }
  };
}
