import {
  type ApprovedEntry,
  draftSchema,
  type KnowledgeReply,
  publicSourceUrl,
  reviewReady,
  type saveDraftSchema,
  transcriptSchema,
} from "@kandamkulathi/contracts/client-knowledge";
import { type KnowledgeRecord, knowledgeRecordSchema } from "@kandamkulathi/contracts/knowledge";
import { apiOrigin } from "./index";
import type { SensitiveClient, SensitiveResult } from "./sensitive";

export type KnowledgeRecordView = Readonly<{
  id: string;
  revision: number;
  state: KnowledgeRecord["state"];
  kind: KnowledgeRecord["content"]["kind"];
  locale: KnowledgeRecord["content"]["language"];
  title: string;
  body: string;
  contentHash: string;
  sources: KnowledgeRecord["content"]["sources"];
  citations: KnowledgeRecord["content"]["citations"];
  approval: Exclude<KnowledgeRecord, { state: "draft" }>["approval"] | null;
  withdrawal: Extract<KnowledgeRecord, { state: "withdrawn" }>["withdrawal"] | null;
}>;

/**
 * Strict display projection of canonical content/provenance, NOT publication authorization.
 * Keep each clinical kind separate. Never invent the proposed editor DTO's safety/permissions/deadline.
 * The caller must obtain this from an authorized, current server read, never directly from model output.
 */
export function knowledgeRecordView(input: unknown): SensitiveResult<KnowledgeRecordView> {
  const parsed = knowledgeRecordSchema.safeParse(input);
  if (!parsed.success) return { status: "error" };
  const record = parsed.data;
  return {
    status: "ready",
    data: {
      id: record.content.entryId,
      revision: record.content.revision,
      state: record.state,
      kind: record.content.kind,
      locale: record.content.language,
      title: record.content.title,
      body: record.content.text,
      contentHash: record.contentHash,
      sources: record.content.sources,
      citations: record.content.citations,
      approval: record.state === "draft" ? null : record.approval,
      withdrawal: record.state === "withdrawn" ? record.withdrawal : null,
    },
  };
}

/** Retry an uncertain intent, not a completed action. Keep the identity only in this client lifetime. */
export function companionIntent(uuid: () => string = () => crypto.randomUUID()) {
  let pending: { key: string; id: string } | undefined;
  return {
    reserve(key: string) {
      if (!pending || pending.key !== key) pending = { key, id: uuid() };
      return pending.id;
    },
    finish(id: string, status: SensitiveResult<unknown>["status"]) {
      if (
        pending?.id === id &&
        ["ready", "anonymous", "denied", "conflict", "expired"].includes(status)
      )
        pending = undefined;
    },
    clear() {
      pending = undefined;
    },
  };
}

/** Reject unrelated positives before the request adapter retires the original wire retry key. */
export function knowledgeSaveResultSchema(input: ReturnType<typeof saveDraftSchema.parse>) {
  return draftSchema.refine(
    (draft) =>
      (input.id === null || draft.id === input.id) &&
      draft.revision > (input.expectedRevision ?? 0) &&
      draft.state === "draft" &&
      JSON.stringify(draft.document) === JSON.stringify(input.document),
    "Save response must match the submitted document and advance its known revision",
  );
}

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
  allowQuery?: (url: URL) => boolean,
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
      url.href.includes("#")
    )
      throw new Error("Invalid API request");
    if (url.search) {
      let allowed = false;
      if ((init?.method ?? "GET").toUpperCase() === "GET" && String(input) === url.href) {
        try {
          allowed = allowQuery?.(new URL(url.href)) === true;
        } catch {
          // Callback/configuration failure never permits a credentialed query.
        }
      }
      if (!allowed) throw new Error("Invalid API request");
    }
    const token = await read();
    if (!active() || init?.signal?.aborted) throw new Error("Stale API request");
    const headers = new Headers(init?.headers);
    if (token) {
      if (!/^[A-Za-z0-9._~-]{16,2048}$/.test(token)) throw new Error("Invalid session credential");
      headers.set("Authorization", `Bearer ${token}`);
    }
    return transport(url.href, { ...init, headers });
  };
}
