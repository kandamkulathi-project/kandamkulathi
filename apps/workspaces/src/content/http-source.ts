import { apiOrigin } from "@kandamkulathi/client";
import { type ClientSession, sessionSchema } from "@kandamkulathi/contracts/client";
import { knowledgeIdSchema } from "@kandamkulathi/contracts/knowledge";
import {
  createDecodedContentAuthoringPort,
  decodeKnowledgeAuthoringRecord,
  type KnowledgeAuthoringTransport,
  knowledgeAuthoringResultSchema,
} from "@kandamkulathi/contracts/knowledge-authoring";
import { AuthoringRejection } from "./authoring-port";
import type { ContentReader } from "./model";
import { withinKnowledgeBodyLimit } from "./source-files";

export { createDecodedContentAuthoringPort } from "@kandamkulathi/contracts/knowledge-authoring";

/** No credentials/cookies/CSRF are created or copied here. REQUIRED transport is root-owned. */
export function createContentHttpIntegration(options: {
  session: ClientSession;
  entryId: string;
  coreOrigin: string;
  companionOrigin: string;
  local: boolean;
  transport: KnowledgeAuthoringTransport;
}) {
  if (typeof options.transport !== "function")
    throw new Error("Real approved HTTP transport required");
  const session = sessionSchema.parse(options.session);
  const actorId = knowledgeIdSchema.parse(session.userId);
  const entryId = knowledgeIdSchema.parse(options.entryId);
  let sameOrigin = false;
  try {
    sameOrigin =
      apiOrigin(options.coreOrigin, options.local) ===
      apiOrigin(options.companionOrigin, options.local);
  } catch {
    /* Invalid origins never receive credentialed requests. */
  }
  if (!sameOrigin) {
    const readRecord: ContentReader = async () => ({ status: "unavailable" });
    return {
      status: "pending" as const,
      reason: "SAME_APPROVED_ORIGIN_REQUIRED" as const,
      readRecord,
    };
  }
  const transport: KnowledgeAuthoringTransport = (request) => {
    if (request.method === "POST" && !withinKnowledgeBodyLimit(request.body))
      throw new AuthoringRejection("oversized");
    return options.transport(request);
  };
  const readRecord: ContentReader = async (signal) => {
    if (signal.aborted) return { status: "error" };
    if (Date.parse(session.expiresAt) <= Date.now()) return { status: "anonymous" };
    try {
      const response = await transport({
        method: "GET",
        path: `/v1/knowledge/${entryId}/authoring`,
        signal,
      });
      if (signal.aborted) return { status: "error" };
      if (Date.parse(session.expiresAt) <= Date.now()) return { status: "anonymous" };
      if (response.httpStatus === 401) return { status: "anonymous" };
      if (response.httpStatus === 403) return { status: "denied" };
      if (response.httpStatus === 503) {
        const failure = knowledgeAuthoringResultSchema.safeParse(response.body);
        return {
          status: failure.success && failure.data.status === "not-ready" ? "unavailable" : "error",
        };
      }
      if (response.httpStatus !== 200) return { status: "error" };
      const record = decodeKnowledgeAuthoringRecord(response.body, { actorId, entryId });
      return record ? { status: "ready", data: record } : { status: "error" };
    } catch {
      return { status: "error" };
    }
  };
  return {
    status: "configured" as const,
    readRecord,
    authoring: createDecodedContentAuthoringPort(transport),
  };
}
