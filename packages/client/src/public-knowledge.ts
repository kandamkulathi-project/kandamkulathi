import {
  publicKnowledgeRequestSchema,
  publicKnowledgeResultSchema,
} from "@kandamkulathi/contracts/knowledge";
import { apiOrigin } from "./index";

/** Project the canonical server proof without collapsing clinical kinds into invented safety fields. */
export function publicKnowledgeView(input: unknown) {
  const parsed = publicKnowledgeResultSchema.safeParse(input);
  if (!parsed.success) return { status: "error" } as const;
  const result = parsed.data;
  if (result.status !== "ready") return result;
  return {
    status: "ready" as const,
    schemaVersion: result.schemaVersion,
    productId: result.productId,
    productRevision: result.productRevision,
    locale: result.language,
    sections: result.blocks.map((block) => ({
      reference: block.reference,
      kind: block.kind,
      locale: block.language,
      title: block.title,
      body: block.text,
      citations: block.citations,
      approval: block.approval,
    })),
  };
}

/** Public, read-only retrieval through the canonical API; this is not chat or a medical-policy engine. */
export async function loadPublicKnowledge(options: {
  origin: string;
  local: boolean;
  input: unknown;
  signal: AbortSignal;
  transport?: typeof fetch;
}) {
  const parsed = publicKnowledgeRequestSchema.safeParse(options.input);
  if (!parsed.success || options.signal.aborted) return { status: "error" } as const;
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 5000);
  try {
    const response = await (options.transport ?? fetch)(
      `${apiOrigin(options.origin, options.local)}/v1/knowledge/public-product`,
      {
        method: "POST",
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      },
    );
    if (controller.signal.aborted) return { status: "error" } as const;
    if (response.status === 401) return { status: "anonymous" } as const;
    if (response.status === 403) return { status: "denied" } as const;
    const fallback = () =>
      response.status === 503
        ? ({ status: "unavailable" } as const)
        : ({ status: "error" } as const);
    if (
      response.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase() !==
      "application/json"
    )
      return fallback();
    const reader = response.body?.getReader();
    if (!reader) return fallback();
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 2 * 1024 * 1024 || controller.signal.aborted) {
        await reader.cancel();
        return { status: "error" } as const;
      }
      chunks.push(value);
    }
    if (controller.signal.aborted) return { status: "error" } as const;
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const result = publicKnowledgeView(JSON.parse(new TextDecoder().decode(bytes)));
    if (result.status === "error") return fallback();
    if (result.status === "ready")
      return response.status === 200 &&
        result.productId === parsed.data.productId &&
        result.locale === parsed.data.language
        ? result
        : ({ status: "error" } as const);
    if (result.status === "not-ready") return response.status === 503 ? result : fallback();
    return [400, 409].includes(response.status) ? result : fallback();
  } catch {
    return { status: "error" } as const;
  } finally {
    clearTimeout(timeout);
    options.signal.removeEventListener("abort", abort);
  }
}
