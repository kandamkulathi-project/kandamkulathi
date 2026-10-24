import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createKnowledgePostgresRuntime } from "../../apps/companion/src/knowledge/postgres";
import { registerKnowledgeRuntimeRoutes } from "../../apps/companion/src/knowledge/runtime";
import type { CurrentAuthority, VerifiedIdentity } from "../../packages/contracts/src/identity";
import type { DatabaseClient, DatabaseContext } from "../../packages/database/src/client";
import { createService } from "../../packages/server/src/index";
import { knowledgeFixture, knowledgeId, syntheticSourceBytes } from "../unit/knowledge.fixtures";

interface Harness {
  source: DatabaseClient;
  runtime<T>(role: "core", callback: (context: DatabaseContext) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
describe("knowledge runtime real PostgreSQL + HTTP (synthetic identity, no WorkOS proof)", () => {
  let db: Harness;
  let fixture: Awaited<ReturnType<typeof knowledgeFixture>>;
  let runtime: ReturnType<typeof createKnowledgePostgresRuntime>;
  const editor = knowledgeId(2),
    approver = knowledgeId(3);
  const identity = (actorId: string): VerifiedIdentity => ({
    actorId,
    sessionId: knowledgeId(50),
    organizationId: knowledgeId(51),
    authenticatedAt: new Date(Date.now() - 60000).toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    mfa: {
      verifiedAt: new Date(Date.now() - 60000).toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
  });
  const withClient = <T>(callback: (client: DatabaseClient) => Promise<T>) =>
    db.runtime("core", ({ client }) => callback(client));
  beforeAll(async () => {
    const supportPath = "../platform/support.mjs";
    const { testDatabase } = (await import(supportPath)) as { testDatabase(): Promise<Harness> };
    db = await testDatabase();
    // The journal installs the actual shared identity and KB schema. Synthetic
    // verified-session fixture below isolates KB policy; identity's pack tests its loader.
    await db.source.query(
      "INSERT INTO core.identity_actors(id,provider_user_id,status) VALUES($1,'synthetic-kb-editor','active'),($2,'synthetic-kb-reviewer','active')",
      [editor, approver],
    );
    fixture = await knowledgeFixture();
    const source = fixture.monograph.content.sources[0];
    if (!source) throw new Error("Synthetic source missing");
    await db.source.query(
      "INSERT INTO core.knowledge_sources(source_id,revision,sha256,public_url,public_rights_evidence_id) VALUES($1,$2,$3,$4,$5)",
      [source.sourceId, source.revision, source.sha256, source.publicUrl, knowledgeId(60)],
    );
    for (const record of fixture.entries.values())
      for (const [actor, permission] of [
        [editor, "edit"],
        [approver, "approve"],
        [approver, "withdraw"],
        [editor, "approve"],
      ])
        await db.source.query(
          `INSERT INTO core.knowledge_grants(id,actor_id,permission,scope,product_id,language,kind,display_name,
      authority_version,evidence_id,physician_qualified,valid_from,expires_at,organization_id) VALUES($1,$2,$3,'catalogue',$4,'en',$5,$6,1,$7,true,clock_timestamp()-interval '1 day',clock_timestamp()+interval '1 day',$8)`,
          [
            crypto.randomUUID(),
            actor,
            permission,
            fixture.product.productId,
            record.content.kind,
            "Synthetic protocol reviewer (not a physician approval)",
            knowledgeId(4),
            knowledgeId(51),
          ],
        );
    runtime = createKnowledgePostgresRuntime({
      withClient,
      loadCurrentAuthorityInTransaction: async (client, subject) => {
        const actor = await client.query(
          "SELECT status FROM core.identity_actors WHERE id=$1 FOR SHARE",
          [subject.actorId],
        );
        return {
          actorId: subject.actorId,
          sessionId: subject.sessionId,
          accountStatus: actor.rows[0]?.status ?? "disabled",
          sessionExpiresAt: subject.expiresAt,
          sessionRevokedAt: null,
          privacyVersion: "synthetic",
          consultationConsentVersion: "synthetic",
          memberships: [],
          selfPatientLinks: [],
          assignments: [],
          consents: [
            {
              id: knowledgeId(91),
              actorId: subject.actorId,
              recordedByActorId: subject.actorId,
              purpose: "privacy",
              version: "synthetic",
              decision: "granted",
              decidedAt: "2020-01-01T00:00:00Z",
              expiresAt: null,
              revokedAt: null,
            },
          ],
        } as CurrentAuthority;
      },
    });
  }, 30000);
  afterAll(async () => {
    await db?.close();
  });
  const app = () =>
    createService("companion", undefined, {
      registerRoutes: (app) =>
        registerKnowledgeRuntimeRoutes(app, {
          runtime,
          verifyMutation: (request) => (request.headers.has("origin") ? "denied" : "allowed"),
          verifySession: async (request) => ({
            status: "verified",
            identity: identity(
              request.headers.get("authorization") === "Bearer reviewer" ? approver : editor,
            ),
          }),
        }),
    });
  const send = (
    path: string,
    input: unknown,
    bearer = "editor",
    headers: Record<string, string> = {},
  ) =>
    app().request(
      `http://localhost${path}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${bearer}`,
          ...headers,
        },
        body: JSON.stringify(input),
      },
      { APP_ENV: "local" },
    );
  const draftInput = (content: typeof fixture.monograph.content) => ({
    content,
    sources: [
      {
        sourceId: knowledgeId(5),
        bytesBase64: Buffer.from(syntheticSourceBytes).toString("base64"),
      },
    ],
  });
  const expected = () => ({
    revision: fixture.monograph.content.revision,
    contentHash: fixture.monograph.contentHash,
  });

  it("denies ambient, hostile origin, malformed and unauthorized scope without writes", async () => {
    expect(
      (
        await send("/v1/knowledge/drafts", draftInput(fixture.monograph.content), "editor", {
          cookie: "ambient=1",
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await send("/v1/knowledge/drafts", draftInput(fixture.monograph.content), "editor", {
          origin: "https://attacker.com",
        })
      ).status,
    ).toBe(403);
    expect((await send("/v1/knowledge/drafts", { content: {} })).status).toBe(400);
    const wrong = structuredClone(fixture.monograph.content);
    wrong.productId = knowledgeId(999);
    expect((await send("/v1/knowledge/drafts", draftInput(wrong))).status).toBe(403);
    expect((await db.source.query("SELECT * FROM core.knowledge_history")).rowCount).toBe(0);
    await expect(
      withClient((client) =>
        client.query("INSERT INTO core.knowledge_entries(entry_id,record) VALUES($1,$2)", [
          fixture.monograph.content.entryId,
          JSON.stringify(fixture.monograph),
        ]),
      ),
    ).rejects.toThrow();
  });
  it("persists draft+audit+obligation atomically; selfapproval fails, separate qualified approval succeeds", async () => {
    for (const record of fixture.entries.values()) {
      expect((await send("/v1/knowledge/drafts", draftInput(record.content))).status).toBe(201);
      expect(
        (
          await send(`/v1/knowledge/${record.content.entryId}/approve`, {
            revision: 1,
            contentHash: record.contentHash,
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await send(
            `/v1/knowledge/${record.content.entryId}/approve`,
            { revision: 1, contentHash: record.contentHash },
            "reviewer",
          )
        ).status,
      ).toBe(200);
    }
    expect((await db.source.query("SELECT * FROM core.knowledge_history")).rowCount).toBe(8);
    expect((await db.source.query("SELECT * FROM core.knowledge_index_obligations")).rowCount).toBe(
      8,
    );
    expect(
      (
        await send(
          `/v1/knowledge/${fixture.monograph.content.entryId}/approve`,
          { revision: 1, contentHash: "0".repeat(64) },
          "reviewer",
        )
      ).status,
    ).toBe(409);
    expect((await db.source.query("SELECT * FROM core.knowledge_history")).rowCount).toBe(8);
    await db.source.query(
      "INSERT INTO core.knowledge_products(product_id,manifest) VALUES($1,$2)",
      [fixture.product.productId, JSON.stringify(fixture.product)],
    );
    await db.source.query(
      "INSERT INTO core.knowledge_terms(product_id,term,origin) VALUES($1,'synthetic','exact'),($1,'alias','alias'),($1,'keyword','keyword')",
      [fixture.product.productId],
    );
    for (const term of ["synthetic", "alias", "keyword"])
      expect(await runtime.search({ term, language: "en" })).toHaveLength(1);
    const response = await send("/v1/knowledge/public-product", fixture.request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.blocks.map((block: { kind: string }) => block.kind)).toEqual([
      "monograph",
      "dosage",
      "contraindication",
      "safety",
    ]);
    expect(body.blocks[0].text).toBe(fixture.monograph.content.text);
  });
  it("current revoked qualifications, source rights and missing independent safety fail closed", async () => {
    await db.source.query(
      "UPDATE core.knowledge_grants SET physician_qualified=false WHERE actor_id=$1 AND permission='approve'",
      [approver],
    );
    expect((await runtime.publicProduct(fixture.request)).status).toBe("blocked");
    expect(await runtime.search({ term: "synthetic", language: "en" })).toHaveLength(0);
    await db.source.query(
      "UPDATE core.knowledge_grants SET physician_qualified=true WHERE actor_id=$1 AND permission='approve'",
      [approver],
    );
    await db.source.query("UPDATE core.knowledge_sources SET revoked_at=clock_timestamp()");
    expect((await runtime.publicProduct(fixture.request)).status).toBe("blocked");
    await db.source.query("UPDATE core.knowledge_sources SET revoked_at=NULL");
    const missing = structuredClone(fixture.product);
    delete missing.knowledge.en.safety;
    await db.source.query("UPDATE core.knowledge_products SET manifest=$1", [
      JSON.stringify(missing),
    ]);
    expect(await runtime.publicProduct(fixture.request)).toEqual({
      status: "blocked",
      reason: "SAFETY_BLOCKS_UNAVAILABLE",
    });
    await db.source.query("UPDATE core.knowledge_products SET manifest=$1", [
      JSON.stringify(fixture.product),
    ]);
    expect((await runtime.publicProduct(fixture.request)).status).toBe("ready");
  });
  it("history failure rolls back current revision and index obligation; Core cannot rewrite audit", async () => {
    await db.source.query(`CREATE FUNCTION core.knowledge_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$;
      CREATE TRIGGER knowledge_test_fail BEFORE INSERT ON core.knowledge_history FOR EACH ROW EXECUTE FUNCTION core.knowledge_test_fail()`);
    const next = {
      ...fixture.monograph.content,
      revision: 2,
      previousContentHash: fixture.monograph.contentHash,
    };
    try {
      expect((await send("/v1/knowledge/drafts", draftInput(next))).status).toBe(503);
    } finally {
      await db.source.query(
        "DROP TRIGGER knowledge_test_fail ON core.knowledge_history; DROP FUNCTION core.knowledge_test_fail()",
      );
    }
    expect(
      (
        await db.source.query("SELECT record FROM core.knowledge_entries WHERE entry_id=$1", [
          next.entryId,
        ])
      ).rows[0].record.state,
    ).toBe("approved");
    expect((await db.source.query("SELECT * FROM core.knowledge_history")).rowCount).toBe(8);
    expect((await db.source.query("SELECT * FROM core.knowledge_index_obligations")).rowCount).toBe(
      8,
    );
    await expect(
      withClient((client) => client.query("UPDATE core.knowledge_history SET record='{}'")),
    ).rejects.toThrow();
    await expect(
      withClient((client) => client.query("UPDATE core.knowledge_entries SET record=record")),
    ).rejects.toThrow();
  });
  it("concurrent withdrawal has one effect; stale candidate and private payload never answer", async () => {
    const responses = await Promise.all(
      [1, 2].map(() =>
        send(`/v1/knowledge/${fixture.monograph.content.entryId}/withdraw`, expected(), "reviewer"),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await runtime.search({ term: "synthetic", language: "en" })).toHaveLength(0);
    const read = await send("/v1/knowledge/public-product", fixture.request);
    expect(read.status).toBe(409);
    expect(await read.json()).not.toHaveProperty("blocks");
    expect(
      (
        await send(
          "/v1/knowledge/drafts",
          draftInput({ ...fixture.monograph.content, visibility: "private" } as never),
        )
      ).status,
    ).toBe(400);
    expect((await db.source.query("SELECT * FROM core.knowledge_history")).rowCount).toBe(9);
  });
  it("updates only by chained draft CAS, never reuses withdrawn approval or serves stale index hits", async () => {
    const next = {
      ...fixture.monograph.content,
      revision: 2,
      previousContentHash: fixture.monograph.contentHash,
    };
    const revisions = await Promise.all(
      [1, 2].map(() => send("/v1/knowledge/drafts", draftInput(next))),
    );
    expect(revisions.map((response) => response.status).sort()).toEqual([201, 409]);
    const created = revisions.find((response) => response.status === 201);
    if (!created) throw new Error("Draft not created");
    const draft = await created.json();
    expect(draft.record.state).toBe("draft");
    expect(draft.record.content.previousContentHash).toBe(fixture.monograph.contentHash);
    expect((await runtime.publicProduct(fixture.request)).status).toBe("blocked");
    const current = { revision: 2, contentHash: draft.record.contentHash };
    expect((await send(`/v1/knowledge/${next.entryId}/approve`, current, "reviewer")).status).toBe(
      200,
    );
    expect(await runtime.publicProduct(fixture.request)).toEqual({
      status: "blocked",
      reason: "STALE_REFERENCE",
    });
    expect(await runtime.search({ term: "synthetic", language: "en" })).toHaveLength(0);
    expect((await db.source.query("SELECT * FROM core.knowledge_history")).rowCount).toBe(11);
  });
});
