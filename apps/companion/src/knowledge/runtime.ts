import type { ServiceApp } from "@kandamkulathi/server";
import { z } from "zod";
import {
  type VerifiedIdentity,
  verifiedIdentitySchema,
} from "../../../../packages/contracts/src/identity.ts";
import {
  knowledgeContentSchema,
  knowledgeHashSchema,
  knowledgeIdSchema,
} from "../../../../packages/contracts/src/knowledge.ts";
import type { IdentityMutationDecision } from "../../../core-api/src/identity-runtime";
import type { createKnowledgePostgresRuntime } from "./postgres.ts";

export const knowledgeDraftMutationSchema = z.strictObject({
  content: knowledgeContentSchema,
  sources: z
    .array(
      z.strictObject({
        sourceId: knowledgeIdSchema,
        bytesBase64: z
          .string()
          .min(4)
          .max(64000)
          .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
      }),
    )
    .min(1)
    .max(20),
});
export const knowledgeExpectedMutationSchema = z.strictObject({
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  contentHash: knowledgeHashSchema,
});
export type KnowledgeRuntimeRoutes = {
  runtime: ReturnType<typeof createKnowledgePostgresRuntime>;
  verifySession: (
    request: Request,
  ) => Promise<
    | { status: "verified"; identity: VerifiedIdentity }
    | { status: "unauthenticated" }
    | { status: "unavailable" }
  >;
  /** Server-selected verified native bearer or real cookie-session/CSRF adapter. */
  verifyMutation: (
    request: Request,
    bindings: unknown,
  ) => IdentityMutationDecision | Promise<IdentityMutationDecision>;
  authentication?: "verified-session";
};

/** Parent must register INSTEAD OF registerKnowledgeRoutes (same read URL). */
export function registerKnowledgeRuntimeRoutes(
  app: ServiceApp,
  configured?:
    | KnowledgeRuntimeRoutes
    | ((bindings: unknown, request: Request) => KnowledgeRuntimeRoutes | undefined),
) {
  app.post("/v1/knowledge/public-product", async (context) => {
    context.header("Cache-Control", "no-store");
    const dependencies =
      typeof configured === "function" ? configured(context.env, context.req.raw) : configured;
    if (
      context.req.header("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json"
    )
      return context.json({ status: "blocked", reason: "INVALID_REQUEST" }, 400);
    let input: unknown;
    try {
      input = await context.req.json();
    } catch {
      return context.json({ status: "blocked", reason: "INVALID_REQUEST" }, 400);
    }
    if (!dependencies) return context.json({ status: "not-ready", reason: "NOT_CONFIGURED" }, 503);
    const result = await dependencies.runtime.publicProduct(input);
    return context.json(
      result,
      result.status === "ready"
        ? 200
        : result.status === "not-ready"
          ? 503
          : result.reason === "INVALID_REQUEST"
            ? 400
            : 409,
    );
  });
  app.post("/v1/knowledge/personalized", (context) =>
    context.json({ status: "blocked", reason: "PERSONALIZED_POLICY_UNAVAILABLE" }, 503),
  );
  for (const operation of ["drafts", "approve", "withdraw"] as const) {
    const path =
      operation === "drafts" ? "/v1/knowledge/drafts" : `/v1/knowledge/:entryId/${operation}`;
    app.post(path, async (context) => {
      context.header("Cache-Control", "no-store");
      const dependencies =
        typeof configured === "function" ? configured(context.env, context.req.raw) : configured;
      if (!dependencies)
        return context.json({ status: "not-ready", reason: "NOT_CONFIGURED" }, 503);
      try {
        // Always reject ambient authentication, even if a parent transport hook is defective.
        if (
          dependencies.authentication !== "verified-session" &&
          (context.req.header("cookie") ||
            !/^Bearer [^\s]+$/.test(context.req.header("authorization") ?? ""))
        )
          return context.json({ status: "blocked", reason: "FORBIDDEN" }, 401);
        const mutation = await dependencies.verifyMutation(context.req.raw, context.env);
        if (mutation === "unavailable")
          return context.json({ status: "not-ready", reason: "AUTHORITY_UNAVAILABLE" }, 503);
        if (mutation !== "allowed")
          return context.json({ status: "blocked", reason: "FORBIDDEN" }, 403);
        if (
          context.req.header("content-type")?.split(";")[0]?.trim().toLowerCase() !==
          "application/json"
        )
          return context.json({ status: "blocked", reason: "INVALID_REQUEST" }, 400);
        const verified = await dependencies.verifySession(context.req.raw);
        if (verified.status !== "verified")
          return context.json(
            { status: "not-ready", reason: "AUTHORITY_UNAVAILABLE" },
            verified.status === "unauthenticated" ? 401 : 503,
          );
        const identity = verifiedIdentitySchema.parse(verified.identity);
        let input: unknown;
        try {
          input = await context.req.json();
        } catch {
          return context.json({ status: "blocked", reason: "INVALID_REQUEST" }, 400);
        }
        if (operation === "drafts") {
          const parsed = knowledgeDraftMutationSchema.safeParse(input);
          if (
            !parsed.success ||
            parsed.data.content.editorId !== identity.actorId ||
            new Set(parsed.data.sources.map((source) => source.sourceId)).size !==
              parsed.data.sources.length
          )
            return context.json({ status: "blocked", reason: "INVALID_REQUEST" }, 400);
          const sources = new Map(
            parsed.data.sources.map((source) => [
              source.sourceId,
              Uint8Array.from(atob(source.bytesBase64), (char) => char.charCodeAt(0)),
            ]),
          );
          const result = await dependencies.runtime.draft(identity, parsed.data.content, sources);
          return context.json(
            result,
            result.status === "persisted"
              ? 201
              : result.status === "not-ready"
                ? 503
                : result.reason === "FORBIDDEN"
                  ? 403
                  : 409,
          );
        }
        const id = knowledgeIdSchema.safeParse(context.req.param("entryId"));
        const expected = knowledgeExpectedMutationSchema.safeParse(input);
        if (!id.success || !expected.success)
          return context.json({ status: "blocked", reason: "INVALID_REQUEST" }, 400);
        const result = await dependencies.runtime[operation](identity, id.data, expected.data);
        return context.json(
          result,
          result.status === "persisted"
            ? 200
            : result.status === "not-ready"
              ? 503
              : result.reason === "FORBIDDEN"
                ? 403
                : 409,
        );
      } catch (error) {
        // No SQL/provider details or submitted text enters response/logs.
        if (error instanceof Error && error.message === "Knowledge compare-and-swap conflict.")
          return context.json({ status: "blocked", reason: "CURRENT_STATE_CHANGED" }, 409);
        return context.json({ status: "not-ready", reason: "PRIMARY_UNAVAILABLE" }, 503);
      }
    });
  }
}
