import type { ServiceApp } from "@kandamkulathi/server";
import { validateCurrentIdentity } from "@kandamkulathi/server/authorization";
import { z } from "zod";
import {
  type CurrentAuthority,
  type VerifiedIdentity,
  verifiedIdentitySchema,
} from "../../../../packages/contracts/src/identity.ts";
import {
  knowledgeIdSchema,
  knowledgeKinds,
  knowledgeLanguageSchema,
} from "../../../../packages/contracts/src/knowledge.ts";
import {
  type KnowledgeAuthoringResult,
  knowledgeAuthoringQuerySchema,
  knowledgeAuthoringResponseWithinLimit,
  knowledgeAuthoringResultSchema,
} from "../../../../packages/contracts/src/knowledge-authoring.ts";
import { type DatabaseClient, transaction } from "../../../../packages/database/src/client.ts";
import { validateKnowledgeRecord } from "../../../../packages/domain/src/knowledge/index.ts";

const metadataSchema = z.strictObject({
  scope: z.enum(["catalogue", "institution"]),
  productId: knowledgeIdSchema.nullable(),
  language: knowledgeLanguageSchema,
  kind: z.enum(knowledgeKinds),
});
type Grant = {
  actor_id: string;
  display_name: string;
  authority_version: number;
  evidence_id: string;
  expires_at: Date | string;
};
const forbidden = (): KnowledgeAuthoringResult => ({ status: "blocked", reason: "FORBIDDEN" });
type ReadResult = { httpStatus: 200 | 400 | 401 | 403 | 503; body: KnowledgeAuthoringResult };

/** Same platform transaction + actual identity loader and real per-request web
 * guard. No existing runtime file is replaced, and capabilities never authorize writes.
 */
export function createKnowledgeAuthoringRuntime(options: {
  withClient: <T>(operation: (client: DatabaseClient) => Promise<T>) => Promise<T>;
  loadCurrentAuthorityInTransaction: (
    client: DatabaseClient,
    identity: VerifiedIdentity,
  ) => Promise<CurrentAuthority>;
  guardSessionInTransaction: (client: DatabaseClient, identity: VerifiedIdentity) => Promise<void>;
}) {
  return {
    async readAuthoring(
      identityInput: unknown,
      entryIdInput: unknown,
      queryInput: unknown,
    ): Promise<ReadResult> {
      const identity = verifiedIdentitySchema.safeParse(identityInput),
        id = knowledgeIdSchema.safeParse(entryIdInput);
      const query = knowledgeAuthoringQuerySchema.safeParse(queryInput);
      if (!identity.success)
        return { httpStatus: 401, body: { status: "blocked", reason: "UNAUTHENTICATED" } };
      if (!id.success || !query.success)
        return { httpStatus: 400, body: { status: "blocked", reason: "INVALID_REQUEST" } };
      try {
        return await options.withClient((client) =>
          transaction(client, async (): Promise<ReadResult> => {
            await client.query("SELECT pg_advisory_xact_lock_shared(173403,3)");
            const principal = identity.data;
            const current = await options.loadCurrentAuthorityInTransaction(client, principal);
            await options.guardSessionInTransaction(client, principal);
            const active = validateCurrentIdentity(principal, current, Date.now());
            if (!active.allowed)
              return {
                httpStatus: active.status,
                body:
                  active.status === 503
                    ? { status: "not-ready", reason: "PRIMARY_UNAVAILABLE" }
                    : {
                        status: "blocked",
                        reason: active.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
                      },
              };
            const mfa = principal.mfa;
            if (
              !principal.organizationId ||
              !mfa ||
              Date.parse(mfa.verifiedAt) > Date.now() ||
              Date.parse(mfa.expiresAt) <= Date.now()
            )
              return { httpStatus: 403, body: forbidden() };
            // Metadata only before the explicit view grant. Do not load text,
            // citations, sources or named approval for unauthorized callers.
            const row = await client.query<{ metadata: unknown }>(
              `SELECT jsonb_build_object(
            'scope',record->'content'->'scope','productId',record->'content'->'productId',
            'language',record->'content'->'language','kind',record->'content'->'kind') AS metadata
            FROM core.knowledge_entries WHERE entry_id=$1 FOR SHARE`,
              [id.data],
            );
            if (!row.rows[0]) return { httpStatus: 403, body: forbidden() };
            const metadata = metadataSchema.parse(row.rows[0].metadata);
            async function grant(permission: string): Promise<Grant | null> {
              const result = await client.query<Grant>(
                `SELECT actor_id,display_name,authority_version,evidence_id,expires_at
              FROM core.knowledge_grants WHERE actor_id=$1 AND organization_id=$2 AND permission=$3
              AND scope=$4 AND product_id IS NOT DISTINCT FROM $5::uuid AND language=$6 AND kind=$7
              AND revoked_at IS NULL AND valid_from<=clock_timestamp() AND expires_at>clock_timestamp()
              AND ($3<>'approve' OR physician_qualified)
              ORDER BY expires_at DESC,id FOR SHARE`,
                [
                  principal.actorId,
                  principal.organizationId,
                  permission,
                  metadata.scope,
                  metadata.productId,
                  metadata.language,
                  metadata.kind,
                ],
              );
              return result.rows[0] ?? null;
            }
            const view = await grant("view");
            if (!view) return { httpStatus: 403, body: forbidden() };
            const permission = query.data.permission;
            const action = permission === "view" ? view : await grant(permission);
            if (!action) return { httpStatus: 403, body: forbidden() };
            const full = await client.query<{ record: unknown }>(
              "SELECT record FROM core.knowledge_entries WHERE entry_id=$1 FOR SHARE",
              [id.data],
            );
            const record = await validateKnowledgeRecord(full.rows[0]?.record);
            if (
              !record ||
              record.content.entryId !== id.data ||
              record.content.scope !== metadata.scope ||
              record.content.productId !== metadata.productId ||
              record.content.language !== metadata.language ||
              record.content.kind !== metadata.kind
            )
              throw new Error("Invalid knowledge primary");
            if (
              permission === "approve" &&
              (record.state !== "draft" || record.content.editorId === principal.actorId)
            )
              return { httpStatus: 403, body: forbidden() };
            if (permission === "withdraw" && record.state !== "approved")
              return { httpStatus: 403, body: forbidden() };
            if (permission === "edit" || permission === "approve") {
              for (const source of record.content.sources) {
                const registered = await client.query(
                  `SELECT source_id FROM core.knowledge_sources
                WHERE source_id=$1 AND revision=$2 AND sha256=$3 AND public_url=$4
                AND revoked_at IS NULL FOR SHARE`,
                  [source.sourceId, source.revision, source.sha256, source.publicUrl],
                );
                if (!registered.rowCount) return { httpStatus: 403, body: forbidden() };
              }
            }
            const privacyExpiries = current.consents
              .filter(
                (consent) =>
                  consent.purpose === "privacy" &&
                  consent.actorId === principal.actorId &&
                  consent.version === current.privacyVersion &&
                  consent.decision === "granted" &&
                  consent.revokedAt === null &&
                  consent.expiresAt !== null,
              )
              .map((consent) => Date.parse(consent.expiresAt as string));
            const expiry = Math.min(
              Date.parse(principal.expiresAt),
              Date.parse(current.sessionExpiresAt),
              Date.parse(mfa.expiresAt),
              new Date(view.expires_at).getTime(),
              new Date(action.expires_at).getTime(),
              ...privacyExpiries,
            );
            // Locks protect concurrent revocation/revision updates; time still advances.
            const clock = await client.query<{ instant: Date | string }>(
              "SELECT clock_timestamp() AS instant",
            );
            const instant = new Date(clock.rows[0]?.instant ?? NaN).getTime();
            if (
              !Number.isFinite(instant) ||
              !Number.isFinite(expiry) ||
              expiry <= instant ||
              !validateCurrentIdentity(principal, current, instant).allowed
            )
              return { httpStatus: 403, body: forbidden() };
            const body = knowledgeAuthoringResultSchema.parse({
              status: "ready",
              schemaVersion: 1,
              record,
              capability: {
                actor: {
                  actorId: action.actor_id,
                  displayName: action.display_name,
                  authorityVersion: action.authority_version,
                  evidenceId: action.evidence_id,
                },
                organizationId: principal.organizationId,
                permission,
                ...metadata,
                entryId: record.content.entryId,
                revision: record.content.revision,
                contentHash: record.contentHash,
                expiresAt: new Date(expiry).toISOString(),
              },
            });
            if (!knowledgeAuthoringResponseWithinLimit(body))
              throw new Error("Authoring response too large");
            return { httpStatus: 200, body };
          }),
        );
      } catch {
        return { httpStatus: 503, body: { status: "not-ready", reason: "PRIMARY_UNAVAILABLE" } };
      }
    },
  };
}

export type KnowledgeAuthoringRoutes = {
  runtime: ReturnType<typeof createKnowledgeAuthoringRuntime>;
  verifySession: (
    request: Request,
  ) => Promise<
    | { status: "verified"; identity: VerifiedIdentity }
    | { status: "unauthenticated" }
    | { status: "unavailable" }
  >;
};
/** Register in parent alongside, not instead of, the existing mutation routes. */
export function registerKnowledgeAuthoringRoutes(
  app: ServiceApp,
  configured?:
    | KnowledgeAuthoringRoutes
    | ((bindings: unknown, request: Request) => KnowledgeAuthoringRoutes | undefined),
) {
  app.get("/v1/knowledge/:entryId/authoring", async (context) => {
    context.header("Cache-Control", "private, no-store");
    context.header("Vary", "Cookie, Authorization, Origin");
    try {
      const dependencies =
        typeof configured === "function" ? configured(context.env, context.req.raw) : configured;
      if (!dependencies)
        return context.json({ status: "not-ready", reason: "NOT_CONFIGURED" }, 503);
      const verification = await dependencies.verifySession(context.req.raw);
      if (verification.status !== "verified")
        return context.json(
          verification.status === "unauthenticated"
            ? { status: "blocked", reason: "UNAUTHENTICATED" }
            : { status: "not-ready", reason: "PRIMARY_UNAVAILABLE" },
          verification.status === "unauthenticated" ? 401 : 503,
        );
      const url = new URL(context.req.url);
      if (
        [...url.searchParams.keys()].some((key) => key !== "permission") ||
        url.searchParams.getAll("permission").length > 1
      )
        return context.json({ status: "blocked", reason: "INVALID_REQUEST" }, 400);
      const query = url.searchParams.has("permission")
        ? { permission: url.searchParams.get("permission") }
        : {};
      const result = await dependencies.runtime.readAuthoring(
        verification.identity,
        context.req.param("entryId"),
        query,
      );
      return context.json(result.body, result.httpStatus);
    } catch {
      return context.json({ status: "not-ready", reason: "PRIMARY_UNAVAILABLE" }, 503);
    }
  });
}
