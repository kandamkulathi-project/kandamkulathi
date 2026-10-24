import { type Resource, workspaceAccess } from "@kandamkulathi/client";
import { type ClientSession, sessionSchema } from "@kandamkulathi/contracts/client";
import {
  type KnowledgeRecord,
  knowledgeIdSchema,
  knowledgeRecordSchema,
} from "@kandamkulathi/contracts/knowledge";

export type ContentState =
  | { status: "ready"; record: KnowledgeRecord }
  | {
      status:
        | "loading"
        | "empty"
        | "invalid"
        | "error"
        | "denied"
        | "pending"
        | "anonymous"
        | "conflict"
        | "unknown"
        | "oversized";
    };

/** A trusted integration supplies transport outcomes; every external payload is still unknown. */
export type ContentReader = (signal: AbortSignal) => Promise<Resource<unknown>>;

function resourceEnvelope(input: unknown): input is Resource<unknown> {
  if (!input || typeof input !== "object" || !("status" in input)) return false;
  const keys = Object.keys(input).sort().join(",");
  if (input.status === "ready") return keys === "data,status";
  return (
    keys === "status" &&
    typeof input.status === "string" &&
    ["loading", "anonymous", "denied", "unavailable", "error"].includes(input.status)
  );
}

/** Any changed presentation scope remounts the reader and discards its drafts. */
export function contentSessionKey(session: ClientSession): string {
  return `${session.userId.toLowerCase()}:${session.expiresAt}:${[...session.workspaces].sort().join(",")}`;
}

export function contentSession(
  input: unknown,
  now = Date.now(),
):
  | { status: "ready"; session: ClientSession }
  | { status: "loading" | "invalid" | "error" | "denied" | "pending" | "anonymous" } {
  if (!resourceEnvelope(input)) return { status: "invalid" };
  if (input.status !== "ready")
    return { status: input.status === "unavailable" ? "pending" : input.status };
  const parsed = sessionSchema.safeParse(input.data);
  if (!parsed.success) return { status: "invalid" };
  if (Date.parse(parsed.data.expiresAt) <= now) return { status: "anonymous" };
  if (
    !workspaceAccess(parsed.data, "staff", now) &&
    !workspaceAccess(parsed.data, "physician", now)
  )
    return { status: "denied" };
  return { status: "ready", session: parsed.data };
}

export function parseContent(input: unknown): ContentState {
  if (!resourceEnvelope(input)) return { status: "invalid" };
  if (input.status !== "ready")
    return { status: input.status === "unavailable" ? "pending" : input.status };
  if (input.data === null) return { status: "empty" };
  const parsed = knowledgeRecordSchema.safeParse(input.data);
  return parsed.success ? { status: "ready", record: parsed.data } : { status: "invalid" };
}

export function isRecordedEditor(actorId: unknown, record: KnowledgeRecord): boolean {
  const actor = knowledgeIdSchema.safeParse(actorId);
  const editor = knowledgeIdSchema.safeParse(record.content.editorId);
  return actor.success && editor.success && actor.data === editor.data;
}

export function validLocalDraft(title: string, text: string): boolean {
  return (
    title.trim().length > 0 && title.length <= 200 && text.trim().length > 0 && text.length <= 16000
  );
}

/** Late, cancelled and timed-out results cannot restore a previous record. No retry/mutation. */
export function requestContent(
  reader: ContentReader,
  publish: (state: ContentState) => void,
  timeoutMs = 5000,
) {
  const controller = new AbortController();
  let active = true;
  publish({ status: "loading" });
  const timer = setTimeout(() => {
    if (!active) return;
    active = false;
    controller.abort();
    publish({ status: "error" });
  }, timeoutMs);
  void Promise.resolve()
    .then(() => {
      if (!active) return;
      return reader(controller.signal);
    })
    .then((result) => {
      if (active) publish(parseContent(result));
    })
    .catch(() => {
      if (active) publish({ status: "error" });
    })
    .finally(() => clearTimeout(timer));
  return () => {
    active = false;
    controller.abort();
    clearTimeout(timer);
  };
}
