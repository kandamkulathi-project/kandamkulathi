import {
  type ApprovedEntry,
  type KnowledgeReply,
  publicSourceUrl,
  reviewReady,
  transcriptSchema,
} from "@kandamkulathi/contracts/knowledge";
import { apiOrigin } from "./index";
import type { SensitiveClient, SensitiveResult } from "./sensitive";

/** Ignore generated free text: medical content/safety/citations come from a fresh approved source snapshot. */
export async function currentAnswer(
  client: SensitiveClient,
  reply: KnowledgeReply,
  now = Date.now,
): Promise<SensitiveResult<ApprovedEntry[]>> {
  if (reply.kind !== "answer") return { status: "unavailable" };
  if (new Set(reply.references.map((item) => item.id)).size !== reply.references.length)
    return { status: "error" };
  const results = await Promise.all(
    reply.references.map(async (ref) => {
      const result = await client.approvedEntry(ref.id);
      if (result.status !== "ready") return null;
      const entry = result.data;
      return entry.id === ref.id &&
        entry.revision === ref.revision &&
        entry.state === "approved" &&
        entry.approvedBy &&
        entry.document.locale === reply.locale &&
        Date.parse(entry.reviewUntil) > now() &&
        reviewReady(entry.document) &&
        publicSourceUrl(entry.document.sourceUrl)
        ? entry
        : null;
    }),
  );
  return results.every(
    (entry): entry is ApprovedEntry => entry !== null && Date.parse(entry.reviewUntil) > now(),
  )
    ? { status: "ready", data: results }
    : { status: "unavailable" };
}

/** A transcript can populate an editable draft; it cannot send a message or confirm a tool. */
export function reviewedTranscript(input: unknown, locale: "en" | "ml" | "ta") {
  const parsed = transcriptSchema.safeParse(input);
  return parsed.success && parsed.data.locale === locale
    ? { text: parsed.data.text, sendRequiresConfirmation: true as const }
    : null;
}

/** A native credential is attached only to this approved API, with a second lifetime check after storage I/O. */
export function nativeApiTransport(
  origin: string,
  local: boolean,
  read: () => Promise<string | null>,
  active: () => boolean,
  transport = fetch,
): typeof fetch {
  const approved = apiOrigin(origin, local);
  return async (input, init) => {
    const url = new URL(String(input));
    if (
      !active() ||
      url.origin !== approved ||
      !url.pathname.startsWith("/v1/") ||
      url.username ||
      url.password ||
      url.hash ||
      url.search
    )
      throw new Error("Invalid API request");
    const token = await read();
    if (!active() || init?.signal?.aborted) throw new Error("Stale API request");
    const headers = new Headers(init?.headers);
    if (token) {
      if (!/^[A-Za-z0-9._~-]{16,2048}$/.test(token)) throw new Error("Invalid session credential");
      headers.set("Authorization", `Bearer ${token}`);
    }
    return transport(input, { ...init, headers });
  };
}
