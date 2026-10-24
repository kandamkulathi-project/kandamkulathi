import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createKnowledgeAuthoringRuntime,
  registerKnowledgeAuthoringRoutes,
} from "../../apps/companion/src/knowledge/authoring";
import { createKnowledgePostgresRuntime } from "../../apps/companion/src/knowledge/postgres";
import {
  type CurrentAuthority,
  currentAuthoritySchema,
  type VerifiedIdentity,
} from "../../packages/contracts/src/identity";
import { knowledgeAuthoringResultSchema } from "../../packages/contracts/src/knowledge-authoring";
import type { DatabaseClient, DatabaseContext } from "../../packages/database/src/client";
import { hashKnowledgeContent } from "../../packages/domain/src/knowledge/index";
import { createService } from "../../packages/server/src/index";
import { knowledgeFixture, knowledgeId } from "../unit/knowledge.fixtures";

interface Harness {
  source: DatabaseClient;
  runtime<T>(role: "core", callback: (context: DatabaseContext) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
type Loader = (client: DatabaseClient, identity: VerifiedIdentity) => Promise<CurrentAuthority>;
describe("authoring GET real PostgreSQL17 with actual identity schema/loader", () => {
  let db: Harness, fixture: Awaited<ReturnType<typeof knowledgeFixture>>, load: Loader;
  const editor = knowledgeId(2),
    reviewer = knowledgeId(3),
    outsider = knowledgeId(9),
    org = knowledgeId(51);
  const viewId = knowledgeId(70),
    reviewViewId = knowledgeId(71),
    approveId = knowledgeId(72);
  const expires = new Date(Date.now() + 3600000).toISOString(),
    authenticated = new Date(Date.now() - 60000).toISOString();
  const identity = (actor: string): VerifiedIdentity => ({
    actorId: actor,
    sessionId: knowledgeId(actor === editor ? 80 : actor === reviewer ? 81 : 82),
    organizationId: org,
    authenticatedAt: authenticated,
    expiresAt: expires,
    mfa: { verifiedAt: authenticated, expiresAt: expires },
  });
  let guards = 0;
  const withClient = <T>(operation: (client: DatabaseClient) => Promise<T>) =>
    db.runtime("core", ({ client }) => operation(client));
  const runtime = () =>
    createKnowledgeAuthoringRuntime({
      withClient,
      loadCurrentAuthorityInTransaction: load,
      guardSessionInTransaction: async () => {
        guards++;
      },
    });
  const read = (actor = reviewer, permission = "view", id = knowledgeId(10)) =>
    runtime().readAuthoring(identity(actor), id, { permission });
  beforeAll(async () => {
    const supportPath = "../platform/support.mjs";
    const { testDatabase } = (await import(supportPath)) as { testDatabase(): Promise<Harness> };
    db = await testDatabase();
    const schema = await db.source.query<{ identity: string | null; knowledge: string | null }>(
      "SELECT to_regclass('core.identity_actors')::text AS identity,to_regclass('core.knowledge_grants')::text AS knowledge",
    );
    if (!schema.rows[0]?.identity)
      await db.source.query(
        await readFile(
          process.env.KNOWLEDGE_AUTHORING_IDENTITY_MIGRATION ??
            new URL("../../packages/database/migrations/0002_mathew_identity.sql", import.meta.url),
          "utf8",
        ),
      );
    if (!schema.rows[0]?.knowledge)
      await db.source.query(
        await readFile(
          new URL("../../packages/database/migrations/0004_mathew_knowledge.sql", import.meta.url),
          "utf8",
        ),
      );
    // Integrated checkout uses its actual shared loader directly. An explicit
    // prerequisite-module path lets this isolated lane test the SAME reviewed
    // source before parent synchronization; unify only the platform client module
    // so the real shared inTransaction WeakSet is not duplicated across worktrees.
    const override = process.env.KNOWLEDGE_AUTHORING_IDENTITY_MODULE;
    if (override) {
      const clientPath = fileURLToPath(new URL("./client.ts", pathToFileURL(override)));
      vi.doMock(clientPath, () => import("../../packages/database/src/client"));
    }
    const modulePath =
      override ??
      fileURLToPath(new URL("../../packages/database/src/identity.ts", import.meta.url));
    const module = (await import(modulePath)) as { loadCurrentAuthorityInTransaction: Loader };
    load = module.loadCurrentAuthorityInTransaction;
    fixture = await knowledgeFixture();
    await db.source.query(
      "INSERT INTO core.identity_policy(singleton,privacy_version,consultation_version,marketing_version,approval_reference) VALUES(true,'privacy-test','consult-test','marketing-test','synthetic-approved-policy')",
    );
    for (const actor of [editor, reviewer, outsider]) {
      const subject = identity(actor);
      await db.source.query(
        "INSERT INTO core.identity_actors(id,provider_user_id,status) VALUES($1,$2,'active')",
        [actor, `synthetic-${actor}`],
      );
      await db.source.query(
        `INSERT INTO core.identity_sessions(id,actor_id,provider_user_id,provider_session_id,
        provider_organization_id,organization_id,authenticated_at,expires_at,mfa_verified_at,mfa_expires_at,mfa_evidence_reference)
        VALUES($1,$2,$3,$4,'synthetic-org',$5,$6,$7,$6,$7,'synthetic-mfa-evidence')`,
        [
          subject.sessionId,
          actor,
          `synthetic-${actor}`,
          `synthetic-session-${actor}`,
          org,
          authenticated,
          expires,
        ],
      );
      const consentId = crypto.randomUUID();
      await db.source.query(
        "INSERT INTO core.identity_consents(id,actor_id,record) VALUES($1,$2,$3)",
        [
          consentId,
          actor,
          JSON.stringify({
            id: consentId,
            actorId: actor,
            recordedByActorId: actor,
            purpose: "privacy",
            version: "privacy-test",
            decision: "granted",
            decidedAt: authenticated,
            expiresAt: null,
            revokedAt: null,
          }),
        ],
      );
    }
    const draft = {
      state: "draft",
      content: fixture.monograph.content,
      contentHash: fixture.monograph.contentHash,
    };
    await db.source.query("INSERT INTO core.knowledge_entries(entry_id,record) VALUES($1,$2)", [
      draft.content.entryId,
      JSON.stringify(draft),
    ]);
    const source = draft.content.sources[0];
    if (!source) throw new Error("Missing synthetic source");
    await db.source.query(
      "INSERT INTO core.knowledge_sources(source_id,revision,sha256,public_url,public_rights_evidence_id) VALUES($1,$2,$3,$4,$5)",
      [source.sourceId, source.revision, source.sha256, source.publicUrl, knowledgeId(60)],
    );
    for (const [id, actor, permission] of [
      [viewId, editor, "view"],
      [reviewViewId, reviewer, "view"],
      [approveId, reviewer, "approve"],
      [knowledgeId(73), editor, "edit"],
      [knowledgeId(74), editor, "approve"],
      [knowledgeId(75), outsider, "edit"],
    ])
      await db.source.query(
        `INSERT INTO core.knowledge_grants(id,actor_id,organization_id,permission,scope,product_id,language,kind,
        display_name,authority_version,evidence_id,physician_qualified,valid_from,expires_at)
        VALUES($1,$2,$3,$4,'catalogue',$5,'en','monograph','Synthetic named reviewer',1,$6,true,$7,$8)`,
        [
          id,
          actor,
          org,
          permission,
          draft.content.productId,
          knowledgeId(4),
          authenticated,
          expires,
        ],
      );
  }, 30000);
  afterAll(async () => {
    await db?.close();
  });
  it("explicit view+action returns exact current record and real minimum expiry through HTTP", async () => {
    const response = await read(reviewer, "approve");
    expect(response.httpStatus).toBe(200);
    expect(guards).toBeGreaterThan(0);
    const parsed = knowledgeAuthoringResultSchema.parse(response.body);
    if (parsed.status !== "ready") throw new Error("Missing authorized read");
    expect(parsed.record.state).toBe("draft");
    expect(parsed.capability.actor.actorId).toBe(reviewer);
    expect(Date.parse(parsed.capability.expiresAt)).toBeLessThanOrEqual(Date.parse(expires));
    expect(parsed.capability.scope).toBe(parsed.record.content.scope);
    const app = createService("companion", undefined, {
      registerRoutes: (app) =>
        registerKnowledgeAuthoringRoutes(app, {
          runtime: runtime(),
          verifySession: async () => ({ status: "verified", identity: identity(reviewer) }),
        }),
    });
    const http = await app.request(
      `http://localhost/v1/knowledge/${knowledgeId(10)}/authoring?permission=approve`,
      {},
      { APP_ENV: "local" },
    );
    expect(http.status).toBe(200);
    expect(http.headers.get("cache-control")).toContain("no-store");
    expect(knowledgeAuthoringResultSchema.safeParse(await http.json()).success).toBe(true);
  });
  it("action grant never implies view; wrong scope, missing entries and selfapproval disclose no record", async () => {
    for (const result of [
      await read(outsider, "edit"),
      await read(editor, "approve"),
      await read(editor, "view", knowledgeId(999)),
    ]) {
      expect(result.httpStatus).toBe(403);
      expect(result.body).not.toHaveProperty("record");
    }
    await db.source.query("UPDATE core.knowledge_grants SET language='ml' WHERE id=$1", [
      reviewViewId,
    ]);
    expect((await read(reviewer, "approve")).httpStatus).toBe(403);
    await db.source.query("UPDATE core.knowledge_grants SET language='en' WHERE id=$1", [
      reviewViewId,
    ]);
  });
  it("rechecks real session, privacy, qualification and revoked view/action grants per request", async () => {
    await db.source.query(
      "UPDATE core.knowledge_grants SET revoked_at=clock_timestamp() WHERE id=$1",
      [reviewViewId],
    );
    expect((await read(reviewer, "approve")).httpStatus).toBe(403);
    await db.source.query("UPDATE core.knowledge_grants SET revoked_at=NULL WHERE id=$1", [
      reviewViewId,
    ]);
    await db.source.query(
      "UPDATE core.knowledge_grants SET physician_qualified=false WHERE id=$1",
      [approveId],
    );
    expect((await read(reviewer, "approve")).httpStatus).toBe(403);
    await db.source.query("UPDATE core.knowledge_grants SET physician_qualified=true WHERE id=$1", [
      approveId,
    ]);
    await db.source.query(
      "UPDATE core.identity_sessions SET revoked_at=clock_timestamp() WHERE id=$1",
      [identity(reviewer).sessionId],
    );
    expect((await read(reviewer, "approve")).httpStatus).toBe(401);
    await db.source.query("UPDATE core.identity_sessions SET revoked_at=NULL WHERE id=$1", [
      identity(reviewer).sessionId,
    ]);
    await db.source.query(
      "UPDATE core.identity_consents SET record=jsonb_set(record,'{decision}','\"declined\"') WHERE actor_id=$1",
      [reviewer],
    );
    expect((await read(reviewer, "approve")).httpStatus).toBe(403);
    await db.source.query(
      "UPDATE core.identity_consents SET record=jsonb_set(record,'{decision}','\"granted\"') WHERE actor_id=$1",
      [reviewer],
    );
  });
  it("locks current record/grants through commit; concurrent revocation cannot pass the read fence", async () => {
    let lockObserved = false;
    const guarded = createKnowledgeAuthoringRuntime({
      withClient: (operation) =>
        withClient(async (client) => {
          const result = await operation(client);
          return result;
        }),
      loadCurrentAuthorityInTransaction: load,
      guardSessionInTransaction: async (client) => {
        expect(
          currentAuthoritySchema.safeParse(await load(client, identity(reviewer))).success,
        ).toBe(true);
        // Test physical identity row fence held by actual loader, not a fake token.
        await db.source.query("SET lock_timeout='100ms'");
        try {
          await expect(
            db.source.query(
              "UPDATE core.identity_sessions SET revoked_at=clock_timestamp() WHERE id=$1",
              [identity(reviewer).sessionId],
            ),
          ).rejects.toThrow(/lock timeout/);
          lockObserved = true;
        } finally {
          await db.source.query("SET lock_timeout=0");
        }
      },
    });
    expect(
      (await guarded.readAuthoring(identity(reviewer), knowledgeId(10), { permission: "approve" }))
        .httpStatus,
    ).toBe(200);
    expect(lockObserved).toBe(true);
  });
  it("holds exact entry and view/action grant row fences until commit, not only identity locks", async () => {
    for (const target of ["grant", "entry"] as const) {
      await db.source.query("BEGIN");
      let pending: ReturnType<typeof read> | undefined;
      try {
        // Block the last independent source-rights read. At this point the
        // production path has already acquired entry + view + action row locks.
        await db.source.query("UPDATE core.knowledge_sources SET revoked_at=NULL");
        pending = read(reviewer, "approve");
        await vi.waitFor(
          async () => {
            await db.source.query("SELECT pg_stat_clear_snapshot()");
            const blocked = await db.source.query<{
              count: number;
            }>(`SELECT count(*)::int AS count FROM pg_stat_activity
            WHERE datname=current_database() AND wait_event_type='Lock'
            AND query LIKE 'SELECT source_id FROM core.knowledge_sources%'`);
            expect(blocked.rows[0]?.count).toBeGreaterThan(0);
          },
          { timeout: 2000, interval: 20 },
        );
        await db.source.query("SET LOCAL lock_timeout='100ms'");
        if (target === "grant")
          await expect(
            db.source.query(
              "UPDATE core.knowledge_grants SET revoked_at=clock_timestamp() WHERE id=$1",
              [approveId],
            ),
          ).rejects.toThrow(/lock timeout/);
        else
          await expect(
            db.source.query("UPDATE core.knowledge_entries SET record=record WHERE entry_id=$1", [
              knowledgeId(10),
            ]),
          ).rejects.toThrow(/lock timeout/);
      } finally {
        await db.source.query("ROLLBACK");
      }
      if (!pending) throw new Error("Missing concurrent read");
      expect((await pending).httpStatus).toBe(200);
    }
  });
  it("read capability is not a write token: stale CAS is rejected after a concurrent new revision", async () => {
    const capability = await read(reviewer, "approve");
    expect(capability.httpStatus).toBe(200);
    const next = {
      ...fixture.monograph.content,
      revision: 2,
      previousContentHash: fixture.monograph.contentHash,
    };
    const contentHash = await hashKnowledgeContent(next);
    await db.source.query("UPDATE core.knowledge_entries SET record=$1 WHERE entry_id=$2", [
      JSON.stringify({ state: "draft", content: next, contentHash }),
      next.entryId,
    ]);
    const mutations = createKnowledgePostgresRuntime({
      withClient,
      loadCurrentAuthorityInTransaction: load,
    });
    await expect(
      mutations.approve(identity(reviewer), next.entryId, {
        revision: 1,
        contentHash: fixture.monograph.contentHash,
      }),
    ).rejects.toThrow("compare-and-swap");
    const current = await read(reviewer, "approve");
    expect(current.httpStatus).toBe(200);
    if (current.body.status !== "ready") throw new Error("Missing new current record");
    expect(current.body.record.content.revision).toBe(2);
    expect(current.body.record).not.toHaveProperty("approval");
  });
});
