import { validateCurrentIdentity } from "@kandamkulathi/server/authorization";
import type { Environment } from "@kandamkulathi/server/config";
import type {
  CurrentAuthority,
  VerifiedIdentity,
} from "../../../../packages/contracts/src/identity.ts";
import type {
  KnowledgeApproval,
  KnowledgeContent,
} from "../../../../packages/contracts/src/knowledge.ts";
import { type DatabaseClient, withDatabase } from "../../../../packages/database/src/client.ts";
import { createPostgresKnowledge } from "../../../../packages/database/src/knowledge.ts";
import {
  authorizePublicKnowledge,
  type KnowledgeAuthority,
} from "../../../../packages/domain/src/knowledge/index.ts";

export type KnowledgeClient = <T>(operation: (client: DatabaseClient) => Promise<T>) => Promise<T>;
export type KnowledgeIdentityLoader = (
  client: DatabaseClient,
  identity: VerifiedIdentity,
) => Promise<CurrentAuthority>;
type Grant = {
  actor_id: string;
  display_name: string;
  authority_version: number;
  evidence_id: string;
};

/** Runtime composition uses verified WorkOS identity and the shared identity loader.
 * All policy is explicitly provisioned in knowledge_grants, never inferred from roles.
 */
export function createKnowledgePostgresRuntime(options: {
  withClient: KnowledgeClient;
  loadCurrentAuthorityInTransaction: KnowledgeIdentityLoader;
  guardSessionInTransaction?: (client: DatabaseClient, identity: VerifiedIdentity) => Promise<void>;
}) {
  async function sessionCurrent(client: DatabaseClient, identity: VerifiedIdentity) {
    const current = await options.loadCurrentAuthorityInTransaction(client, identity);
    await options.guardSessionInTransaction?.(client, identity);
    const now = Date.now();
    return (
      validateCurrentIdentity(identity, current, now).allowed &&
      current.actorId === identity.actorId &&
      current.sessionId === identity.sessionId &&
      current.accountStatus === "active" &&
      current.sessionRevokedAt === null &&
      Date.parse(current.sessionExpiresAt) > now &&
      Date.parse(identity.expiresAt) > now &&
      Date.parse(identity.authenticatedAt) <= now &&
      identity.organizationId !== null &&
      identity.mfa !== null &&
      Date.parse(identity.mfa.verifiedAt) <= now &&
      Date.parse(identity.mfa.expiresAt) > now
    );
  }
  function adapter(client: DatabaseClient, identity?: VerifiedIdentity) {
    async function sourcesCurrent(content: KnowledgeContent) {
      for (const source of content.sources) {
        const result = await client.query(
          `SELECT source_id FROM core.knowledge_sources
          WHERE source_id=$1 AND revision=$2 AND sha256=$3 AND public_url=$4
          AND revoked_at IS NULL FOR SHARE`,
          [source.sourceId, source.revision, source.sha256, source.publicUrl],
        );
        if (!result.rowCount) return false;
      }
      return true;
    }
    async function grant(
      actorId: string,
      permission: string,
      content: KnowledgeContent,
      approval?: KnowledgeApproval,
    ): Promise<Grant | null> {
      // Actor status + exact grant/evidence/version are held through domain commit.
      const actors = await client.query(
        "SELECT id FROM core.identity_actors WHERE id=$1 AND status='active' FOR SHARE",
        [actorId],
      );
      if (!actors.rowCount) return null;
      const rows = await client.query<Grant>(
        `SELECT actor_id,display_name,authority_version,evidence_id
        FROM core.knowledge_grants WHERE actor_id=$1 AND permission=$2 AND scope=$3
        AND product_id IS NOT DISTINCT FROM $4::uuid AND language=$5 AND kind=$6
        AND valid_from <= clock_timestamp() AND expires_at > clock_timestamp() AND revoked_at IS NULL
        AND ($2 <> 'approve' OR physician_qualified)
        AND ($7::int IS NULL OR (authority_version=$7 AND evidence_id=$8::uuid AND display_name=$9))
        AND ($10::uuid IS NULL OR organization_id=$10)
        ORDER BY id FOR SHARE`,
        [
          actorId,
          permission,
          content.scope,
          content.productId,
          content.language,
          content.kind,
          approval?.authorityVersion ?? null,
          approval?.evidenceId ?? null,
          approval?.approverDisplayName ?? null,
          approval ? null : (identity?.organizationId ?? null),
        ],
      );
      return rows.rows[0] ?? null;
    }
    const authority: KnowledgeAuthority = {
      async currentActor(permission, content) {
        if (
          !identity ||
          !(await sessionCurrent(client, identity)) ||
          (permission !== "withdraw" && !(await sourcesCurrent(content)))
        )
          return null;
        const row = await grant(identity.actorId, permission, content);
        return row
          ? {
              actorId: row.actor_id,
              displayName: row.display_name,
              authorityVersion: row.authority_version,
              evidenceId: row.evidence_id,
            }
          : null;
      },
      async isApprovalCurrent(approval, content) {
        return (
          (await sourcesCurrent(content)) &&
          !!(await grant(approval.approverId, "approve", content, approval))
        );
      },
    };
    const store = createPostgresKnowledge(
      (operation) => operation(client),
      authority,
      async (_client, request) => {
        if (request.permission === "read") {
          for (const record of request.entries) {
            if (
              record.state !== "approved" ||
              !(await authority.isApprovalCurrent(record.approval, record.content))
            )
              return false;
          }
          return true;
        }
        if (request.permission === "manage-product") return false; // catalogue sync uses separately reviewed provisioner
        return !!(await authority.currentActor(request.permission, request.content));
      },
    );
    return { store, authority };
  }
  return {
    async publicProduct(input: unknown) {
      try {
        return await options.withClient(async (client) => {
          const { store, authority } = adapter(client);
          return authorizePublicKnowledge(input, store.repository, authority);
        });
      } catch {
        return { status: "not-ready" as const, reason: "PRIMARY_UNAVAILABLE" as const };
      }
    },
    draft: (identity: VerifiedIdentity, input: unknown, sources: ReadonlyMap<string, Uint8Array>) =>
      options.withClient((client) => adapter(client, identity).store.draft(input, sources)),
    approve: (
      identity: VerifiedIdentity,
      id: string,
      expected: { revision: number; contentHash: string },
    ) => options.withClient((client) => adapter(client, identity).store.approve(id, expected)),
    withdraw: (
      identity: VerifiedIdentity,
      id: string,
      expected: { revision: number; contentHash: string },
    ) => options.withClient((client) => adapter(client, identity).store.withdraw(id, expected)),
    search: (input: unknown) => options.withClient((client) => adapter(client).store.search(input)),
  };
}

/** Explicit binding composition. Caller validates secret/config presence; absent
 * configuration must not call this factory or expose placeholder credentials.
 */
export function createKnowledgeWorkerRuntime(options: {
  connectionString: string;
  environment: Environment;
  localProxy?: string;
  namespace?: string;
  loadCurrentAuthorityInTransaction: KnowledgeIdentityLoader;
  guardSessionInTransaction?: (client: DatabaseClient, identity: VerifiedIdentity) => Promise<void>;
}) {
  const withClient: KnowledgeClient = (operation) =>
    withDatabase(
      options.connectionString,
      options.environment,
      "k_core_runtime",
      ({ client }) => operation(client),
      options.localProxy,
      options.namespace,
    );
  return createKnowledgePostgresRuntime({
    withClient,
    loadCurrentAuthorityInTransaction: options.loadCurrentAuthorityInTransaction,
    ...(options.guardSessionInTransaction
      ? { guardSessionInTransaction: options.guardSessionInTransaction }
      : {}),
  });
}
