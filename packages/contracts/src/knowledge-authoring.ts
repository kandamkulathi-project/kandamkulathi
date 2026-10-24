import { z } from "zod";
import { type ClientSession, sessionSchema } from "./client";
import {
  type KnowledgeAuthorityActor,
  type KnowledgeContent,
  type KnowledgeRecord,
  knowledgeAuthorityActorSchema,
  knowledgeContentSchema,
  knowledgeHashSchema,
  knowledgeIdSchema,
  knowledgeKinds,
  knowledgeLanguageSchema,
  knowledgeRecordSchema,
  knowledgeReferenceSchema,
} from "./knowledge";

export const knowledgeAuthoringResponseMaxBytes = 64 * 1024;
export const knowledgeAuthoringRequestMaxBytes = 64 * 1024;
export const knowledgeSourceBase64MaxChars = 64000;
export const knowledgeSourceDecodedMaxBytes = 48000;
export const knowledgeSourceMaxCount = 20;
/** Transport must cap raw response bytes before JSON parsing as well. */
export function knowledgeAuthoringResponseWithinLimit(input: unknown): boolean {
  try {
    return (
      new TextEncoder().encode(JSON.stringify(input)).byteLength <=
      knowledgeAuthoringResponseMaxBytes
    );
  } catch {
    return false;
  }
}

export const knowledgeAuthoringPermissionSchema = z.enum(["view", "edit", "approve", "withdraw"]);
export type KnowledgeAuthoringPermission = z.infer<typeof knowledgeAuthoringPermissionSchema>;
export const knowledgeAuthoringQuerySchema = z.strictObject({
  permission: knowledgeAuthoringPermissionSchema.default("view"),
});
export const knowledgeAuthoringCapabilitySchema = z.strictObject({
  actor: knowledgeAuthorityActorSchema,
  organizationId: knowledgeIdSchema,
  permission: knowledgeAuthoringPermissionSchema,
  scope: z.enum(["catalogue", "institution"]),
  productId: knowledgeIdSchema.nullable(),
  language: knowledgeLanguageSchema,
  kind: z.enum(knowledgeKinds),
  entryId: knowledgeIdSchema,
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  contentHash: knowledgeHashSchema,
  expiresAt: z.iso.datetime(),
});
export const knowledgeAuthoringResultSchema = z.discriminatedUnion("status", [
  z
    .strictObject({
      status: z.literal("ready"),
      schemaVersion: z.literal(1),
      record: knowledgeRecordSchema,
      capability: knowledgeAuthoringCapabilitySchema,
    })
    .superRefine(({ record, capability }, context) => {
      const content = record.content;
      if (
        capability.scope !== content.scope ||
        capability.productId !== content.productId ||
        capability.language !== content.language ||
        capability.kind !== content.kind ||
        capability.entryId !== content.entryId ||
        capability.revision !== content.revision ||
        capability.contentHash !== record.contentHash
      )
        context.addIssue({
          code: "custom",
          message: "Capability must bind the complete record scope/reference",
        });
      if (
        capability.permission === "approve" &&
        (record.state !== "draft" || capability.actor.actorId === content.editorId)
      )
        context.addIssue({
          code: "custom",
          message: "Independent approval of current draft required",
        });
      if (capability.permission === "withdraw" && record.state !== "approved")
        context.addIssue({ code: "custom", message: "Withdrawal requires current approval" });
    }),
  z.strictObject({
    status: z.literal("blocked"),
    reason: z.enum(["FORBIDDEN", "INVALID_REQUEST", "UNAUTHENTICATED"]),
  }),
  z.strictObject({
    status: z.literal("not-ready"),
    reason: z.enum(["NOT_CONFIGURED", "PRIMARY_UNAVAILABLE"]),
  }),
]);
export type KnowledgeAuthoringResult = z.infer<typeof knowledgeAuthoringResultSchema>;
export type KnowledgeAuthoringReady = Extract<KnowledgeAuthoringResult, { status: "ready" }>;
export type KnowledgeAuthoringAction = Exclude<KnowledgeAuthoringPermission, "view">;
export type KnowledgeAuthoringCommand =
  | {
      action: "edit";
      content: KnowledgeContent;
      sources: { sourceId: string; bytesBase64: string }[];
    }
  | { action: "approve" | "withdraw"; entryId: string; revision: number; contentHash: string };
export type KnowledgeAuthoringContext = {
  session: ClientSession;
  record: KnowledgeRecord;
  permission: KnowledgeAuthoringAction;
};
export type DecodedKnowledgeAuthoringSource = {
  actor: KnowledgeAuthorityActor;
  record: KnowledgeRecord;
  permission: KnowledgeAuthoringAction;
  expiresAt: string;
};

/** Exact transport decoder, not independent proof of authorization or a write token. */
export function decodeKnowledgeAuthoringSource(
  input: unknown,
  now = Date.now(),
): DecodedKnowledgeAuthoringSource | null {
  if (!knowledgeAuthoringResponseWithinLimit(input)) return null;
  const parsed = knowledgeAuthoringResultSchema.safeParse(input);
  if (
    !parsed.success ||
    parsed.data.status !== "ready" ||
    parsed.data.capability.permission === "view" ||
    !Number.isFinite(now) ||
    Date.parse(parsed.data.capability.expiresAt) <= now
  )
    return null;
  const { record, capability } = parsed.data;
  if (capability.permission === "view") return null;
  return {
    record,
    actor: capability.actor,
    permission: capability.permission,
    expiresAt: capability.expiresAt,
  };
}

export function decodeKnowledgeAuthoringRecord(
  input: unknown,
  expected: { actorId: string; entryId: string },
  now = Date.now(),
): KnowledgeRecord | null {
  if (!knowledgeAuthoringResponseWithinLimit(input)) return null;
  const parsed = knowledgeAuthoringResultSchema.safeParse(input);
  const actor = knowledgeIdSchema.safeParse(expected.actorId),
    entry = knowledgeIdSchema.safeParse(expected.entryId);
  if (
    !parsed.success ||
    parsed.data.status !== "ready" ||
    !actor.success ||
    !entry.success ||
    parsed.data.capability.permission !== "view" ||
    parsed.data.capability.actor.actorId !== actor.data ||
    parsed.data.record.content.entryId !== entry.data ||
    !Number.isFinite(now) ||
    Date.parse(parsed.data.capability.expiresAt) <= now
  )
    return null;
  return parsed.data.record;
}

export type KnowledgeAuthoringTransport = (request: {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  signal: AbortSignal;
}) => Promise<{ httpStatus: number; body: unknown }>;

/** Structurally implements Denzil's ContentAuthoringPort with a mandatory exact
 * codec. Supply the parent's REAL web cookie/CSRF or verified bearer transport.
 * No credentials, role inference, CSRF, authority caching or automatic retry here.
 */
export function createDecodedContentAuthoringPort(
  transport: KnowledgeAuthoringTransport,
  options: {
    sourceUploads?: readonly { sourceId: string; bytesBase64: string }[];
    now?: () => number;
  } = {},
) {
  const now = options.now ?? Date.now;
  return {
    ...(options.sourceUploads
      ? { sourceUploads: options.sourceUploads.map((source) => ({ ...source })) }
      : {}),
    async readSource(context: KnowledgeAuthoringContext, signal: AbortSignal): Promise<unknown> {
      const session = sessionSchema.parse(context.session);
      const actor = knowledgeIdSchema.parse(session.userId);
      const record = knowledgeRecordSchema.parse(context.record);
      const permission = knowledgeAuthoringPermissionSchema
        .exclude(["view"])
        .parse(context.permission);
      if (signal.aborted || Date.parse(session.expiresAt) <= now()) return null;
      const response = await transport({
        method: "GET",
        path: `/v1/knowledge/${record.content.entryId}/authoring?permission=${permission}`,
        signal,
      });
      if (signal.aborted) return null;
      if (response.httpStatus === 401 || response.httpStatus === 403 || response.httpStatus === 404)
        return null;
      if (response.httpStatus !== 200) throw new Error("Authoring authority unavailable");
      const decoded = decodeKnowledgeAuthoringSource(response.body, now());
      if (
        !decoded ||
        decoded.actor.actorId !== actor ||
        decoded.permission !== permission ||
        JSON.stringify(decoded.record) !== JSON.stringify(record) ||
        Date.parse(session.expiresAt) <= now()
      )
        return null;
      return response.body;
    },
    decodeSource: (input: unknown) => decodeKnowledgeAuthoringSource(input, now()),
    async submit(command: KnowledgeAuthoringCommand, signal: AbortSignal) {
      if (signal.aborted) throw new Error("Authoring submission cancelled before dispatch");
      if (command.action === "edit") {
        const content = knowledgeContentSchema.parse(command.content);
        const sources = z
          .array(
            z.strictObject({
              sourceId: knowledgeIdSchema,
              bytesBase64: z
                .string()
                .min(4)
                .max(knowledgeSourceBase64MaxChars)
                .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
            }),
          )
          .min(1)
          .max(knowledgeSourceMaxCount)
          .parse(command.sources);
        if (
          new Set(sources.map((source) => source.sourceId)).size !== sources.length ||
          sources.length !== content.sources.length ||
          sources.some(
            (source) => !content.sources.some((item) => item.sourceId === source.sourceId),
          )
        )
          throw new Error("Invalid public source bindings");
        const body = { content, sources };
        if (
          new TextEncoder().encode(JSON.stringify(body)).byteLength >
          knowledgeAuthoringRequestMaxBytes
        )
          throw new Error("Authoring request body exceeds byte limit");
        return transport({
          method: "POST",
          path: "/v1/knowledge/drafts",
          body,
          signal,
        });
      }
      const action = z.enum(["approve", "withdraw"]).parse(command.action);
      const reference = knowledgeReferenceSchema.parse({
        entryId: command.entryId,
        revision: command.revision,
        contentHash: command.contentHash,
      });
      return transport({
        method: "POST",
        path: `/v1/knowledge/${reference.entryId}/${action}`,
        body: { revision: reference.revision, contentHash: reference.contentHash },
        signal,
      });
    },
  };
}
