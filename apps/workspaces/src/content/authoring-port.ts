import { type ClientSession, sessionSchema } from "@kandamkulathi/contracts/client";
import {
  type KnowledgeAuthorityActor,
  type KnowledgeRecord,
  knowledgeAuthorityActorSchema,
  knowledgeIdSchema,
  knowledgeRecordSchema,
} from "@kandamkulathi/contracts/knowledge";
import type { AuthoringCommand, SourceUpload } from "./authoring-dto";

export type AuthoringPermission = AuthoringCommand["action"];
export interface AuthoringContext {
  session: ClientSession;
  record: KnowledgeRecord;
  permission: AuthoringPermission;
}

/**
 * Internal UI projection, NOT a new backend grant response schema. The backend-owner codec
 * must strictly parse the actual source response and verify current qualification/scope.
 * The UI independently binds the projection to the displayed record and canonical session.
 */
export interface SourceAuthorization {
  actor: KnowledgeAuthorityActor;
  record: KnowledgeRecord;
  permission: AuthoringPermission;
  expiresAt: string;
}

export interface ContentAuthoringPort {
  readSource(context: AuthoringContext, signal: AbortSignal): Promise<unknown>;
  /** Mandatory exact owner-supplied transport codec. No default/grants derived from workspaces. */
  decodeSource(input: unknown): SourceAuthorization | null;
  /** Root-provided real web cookie/CSRF or verified bearer transport; no auth is fabricated here. */
  submit(
    command: AuthoringCommand,
    signal: AbortSignal,
  ): Promise<{ httpStatus: number; body: unknown }>;
  /** Legacy programmatic-port compatibility only; the editor requires actual local file selections. */
  sourceUploads?: readonly SourceUpload[];
}

export function bindSourceAuthorization(
  input: unknown,
  context: AuthoringContext,
  now = Date.now(),
): SourceAuthorization | null {
  if (
    !input ||
    typeof input !== "object" ||
    Object.keys(input).sort().join(",") !== "actor,expiresAt,permission,record" ||
    !("actor" in input) ||
    !("expiresAt" in input) ||
    !("permission" in input) ||
    !("record" in input)
  )
    return null;
  const actor = knowledgeAuthorityActorSchema.safeParse(input.actor);
  const record = knowledgeRecordSchema.safeParse(input.record);
  const session = sessionSchema.safeParse(context.session);
  const expected = knowledgeRecordSchema.safeParse(context.record);
  const sessionActor = knowledgeIdSchema.safeParse(context.session.userId);
  const expiry = sessionSchema.safeParse({
    userId: context.session.userId,
    expiresAt: input.expiresAt,
    workspaces: [],
  });
  if (
    !actor.success ||
    !record.success ||
    !session.success ||
    !expected.success ||
    !["edit", "approve", "withdraw"].includes(context.permission) ||
    !sessionActor.success ||
    !expiry.success ||
    actor.data.actorId !== sessionActor.data ||
    input.permission !== context.permission ||
    JSON.stringify(record.data) !== JSON.stringify(expected.data) ||
    Date.parse(expiry.data.expiresAt) <= now ||
    Date.parse(context.session.expiresAt) <= now
  )
    return null;
  if (
    context.permission === "approve" &&
    (expected.data.state !== "draft" || actor.data.actorId === expected.data.content.editorId)
  )
    return null;
  if (context.permission === "withdraw" && expected.data.state !== "approved") return null;
  return {
    actor: actor.data,
    record: record.data,
    permission: context.permission,
    expiresAt: expiry.data.expiresAt,
  };
}

export async function loadSourceAuthorization(
  port: ContentAuthoringPort,
  context: AuthoringContext,
  signal: AbortSignal,
): Promise<SourceAuthorization | null> {
  const source = await port.readSource(context, signal);
  if (signal.aborted) return null;
  return bindSourceAuthorization(port.decodeSource(source), context);
}

/** Classified local UI outcome; raw bodies/exception messages are never rendered. */
export class AuthoringRejection extends Error {
  constructor(readonly outcome: "denied" | "conflict" | "invalid" | "pending" | "oversized") {
    super("Authoring request was not accepted");
  }
}

export function mutationBody(response: { httpStatus: number; body: unknown }): unknown {
  if (
    !response ||
    typeof response !== "object" ||
    Object.keys(response).sort().join(",") !== "body,httpStatus"
  )
    throw new Error("Invalid transport wrapper");
  if (response.httpStatus === 401 || response.httpStatus === 403)
    throw new AuthoringRejection("denied");
  if (response.httpStatus === 409) throw new AuthoringRejection("conflict");
  if (response.httpStatus === 400) throw new AuthoringRejection("invalid");
  if (response.httpStatus === 413) throw new AuthoringRejection("oversized");
  if (response.httpStatus === 503) throw new AuthoringRejection("pending");
  if (response.httpStatus !== 200 && response.httpStatus !== 201)
    throw new Error("Uncertain mutation response");
  return response.body;
}
