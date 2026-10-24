import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createKnowledgePostgresRuntime } from "../../apps/companion/src/knowledge/postgres";
import {
  createKnowledgeIndexHandler,
  registerKnowledgeIndexRoutes,
} from "../../apps/core-api/src/knowledge-index";
import type { DatabaseClient, DatabaseContext } from "../../packages/database/src/client";
import { inTransaction, transaction } from "../../packages/database/src/client";
import {
  bridgeKnowledgeIndexObligations,
  currentKnowledgeProjection,
} from "../../packages/database/src/knowledge-index";
import { acquireExecution } from "../../packages/database/src/outbox";
import type { KnowledgeVectorizeBinding } from "../../packages/providers/src/knowledge-index";
import { createKnowledgeIndexProvider } from "../../packages/providers/src/knowledge-index";
import { createService } from "../../packages/server/src/index";
import { knowledgeFixture, knowledgeId } from "../unit/knowledge.fixtures";

interface Harness {
  source: DatabaseClient;
  runtime<T>(role: "core" | "jobs", run: (context: DatabaseContext) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
describe("knowledge index real PostgreSQL bridge and external consumer", () => {
  let db: Harness;
  let fixture: Awaited<ReturnType<typeof knowledgeFixture>>;
  beforeAll(async () => {
    const support = "../platform/support.mjs";
    const { testDatabase } = (await import(support)) as { testDatabase: () => Promise<Harness> };
    db = await testDatabase();
    // testDatabase applies the canonical journal; never repair a missing migration here.
    expect(
      (
        await db.source.query("SELECT id FROM public.k_platform_migrations WHERE id=$1", [
          "0006_mathew_knowledge_index",
        ])
      ).rows,
    ).toEqual([{ id: "0006_mathew_knowledge_index" }]);
    fixture = await knowledgeFixture();
    await db.source.query(
      "INSERT INTO core.identity_actors(id,provider_user_id,status) VALUES($1,'synthetic-index-approver','active')",
      [knowledgeId(3)],
    );
    const source = fixture.monograph.content.sources[0];
    if (!source) throw new Error("Synthetic source missing");
    await db.source.query(
      "INSERT INTO core.knowledge_sources(source_id,revision,sha256,public_url,public_rights_evidence_id) VALUES($1,$2,$3,$4,$5)",
      [source.sourceId, source.revision, source.sha256, source.publicUrl, knowledgeId(70)],
    );
    await db.source.query(
      "INSERT INTO core.knowledge_products(product_id,manifest) VALUES($1,$2)",
      [fixture.product.productId, JSON.stringify(fixture.product)],
    );
    for (const record of fixture.entries.values()) {
      await db.source.query("INSERT INTO core.knowledge_entries(entry_id,record) VALUES($1,$2)", [
        record.content.entryId,
        JSON.stringify(record),
      ]);
      await db.source.query(
        `INSERT INTO core.knowledge_grants(id,actor_id,organization_id,permission,scope,product_id,
    language,kind,display_name,authority_version,evidence_id,physician_qualified,valid_from,expires_at)
    VALUES($1,$2,$3,'approve','catalogue',$4,'en',$5,$6,1,$7,true,clock_timestamp()-interval '1 day',clock_timestamp()+interval '1 day')`,
        [
          crypto.randomUUID(),
          knowledgeId(3),
          knowledgeId(51),
          fixture.product.productId,
          record.content.kind,
          fixture.monograph.approval.approverDisplayName,
          knowledgeId(4),
        ],
      );
    }
  }, 30000);
  afterAll(async () => {
    await db?.close();
  });
  const obligation = async (id: string) =>
    db.source.query(
      "INSERT INTO core.knowledge_index_obligations(id,entry_id,reference,action) VALUES($1,$2,$3,'refresh')",
      [
        id,
        fixture.monograph.content.entryId,
        JSON.stringify(fixture.product.knowledge.en.monograph),
      ],
    );
  it("canonical migration installs forced RLS and jobs-only index insert privileges", async () => {
    const schema = await db.source.query(`SELECT relname,relrowsecurity,relforcerowsecurity
      FROM pg_class WHERE oid IN ('core.knowledge_index_bridges'::regclass,'core.knowledge_index_vectors'::regclass)
      ORDER BY relname`);
    expect(schema.rows).toEqual([
      { relname: "knowledge_index_bridges", relrowsecurity: true, relforcerowsecurity: true },
      { relname: "knowledge_index_vectors", relrowsecurity: true, relforcerowsecurity: true },
    ]);
    for (const role of ["core", "jobs"] as const) {
      await db.runtime(role, async ({ client }) => {
        expect(
          (
            await client.query(`SELECT
              has_table_privilege(current_user,'core.knowledge_index_bridges','INSERT') AS insert,
              has_table_privilege(current_user,'core.knowledge_index_vectors','DELETE') AS delete`)
          ).rows,
        ).toEqual([{ insert: role === "jobs", delete: false }]);
      });
    }
  });
  it("rolls back bridge and outbox together; concurrent bridges enqueue once", async () => {
    await obligation(knowledgeId(80));
    await db.source.query(
      "ALTER TABLE core.knowledge_index_bridges ADD CONSTRAINT synthetic_bridge_failure CHECK(false) NOT VALID",
    );
    await expect(
      db.runtime("jobs", (c) => bridgeKnowledgeIndexObligations(c, 60000)),
    ).rejects.toThrow();
    expect(
      (await db.source.query("SELECT * FROM platform.outbox WHERE kind='knowledge.index'"))
        .rowCount,
    ).toBe(0);
    await db.source.query(
      "ALTER TABLE core.knowledge_index_bridges DROP CONSTRAINT synthetic_bridge_failure",
    );
    const results = await Promise.all([
      db.runtime("jobs", (c) => bridgeKnowledgeIndexObligations(c, 60000)),
      db.runtime("jobs", (c) => bridgeKnowledgeIndexObligations(c, 60000)),
    ]);
    expect(results.sort()).toEqual([0, 1]);
    expect((await db.source.query("SELECT * FROM core.knowledge_index_bridges")).rowCount).toBe(1);
    await expect(
      db.runtime("core", (c) =>
        c.client.query(
          "INSERT INTO core.knowledge_index_bridges(obligation_id,job_id) VALUES($1,$1)",
          [knowledgeId(80)],
        ),
      ),
    ).rejects.toThrow();
    await expect(
      db.runtime("jobs", (c) =>
        c.client.query(
          "UPDATE core.knowledge_index_obligations SET completed_at=clock_timestamp()",
        ),
      ),
    ).rejects.toThrow();
  });
  it("actual HTTP vector consumer independently reloads primary safety and approval", async () => {
    const runtime = createKnowledgePostgresRuntime({
      withClient: (run) => db.runtime("core", ({ client }) => run(client)),
      loadCurrentAuthorityInTransaction: async () => {
        throw new Error("No identity needed for public retrieval");
      },
    });
    const projection = fixture.product.knowledge.en.monograph;
    if (!projection) throw new Error("Synthetic monograph missing");
    const provider = createKnowledgeIndexProvider({
      namespace: "synthetic-index",
      apiKey: "synthetic-not-a-secret",
      vectorize: {
        upsert: async () => ({ mutationId: "synthetic" }),
        deleteByIds: async () => ({ mutationId: "synthetic" }),
        query: async () => ({
          matches: [{ id: "untrusted-derived-id", score: 0.9, metadata: { ...projection } }],
        }),
      },
      fetch: async () =>
        Response.json({
          object: "list",
          model: "text-embedding-3-small",
          data: [
            {
              object: "embedding",
              index: 0,
              embedding: Array.from({ length: 1536 }, (_, i) => (i === 0 ? 0.5 : 0)),
            },
          ],
          usage: { prompt_tokens: 1, total_tokens: 1 },
        }),
    });
    const app = createService("core-api", undefined, {
      registerRoutes: (app) =>
        registerKnowledgeIndexRoutes(app, () => ({
          withDatabase: (run) => db.runtime("jobs", run),
          provider,
          exact: runtime.search,
          publicProduct: runtime.publicProduct,
        })),
    });
    const send = () =>
      app.request(
        "http://localhost/v1/knowledge/search",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            term: "synthetic",
            language: "en",
            semanticReference: projection,
          }),
        },
        { APP_ENV: "local" },
      );
    const response = await send();
    expect(response.status).toBe(200);
    expect((await response.json()).products[0].blocks).toHaveLength(4);
    await db.source.query("UPDATE core.knowledge_grants SET physician_qualified=false");
    expect((await send()).status).toBe(409);
    await db.source.query("UPDATE core.knowledge_grants SET physician_qualified=true");
    await db.source.query("UPDATE core.knowledge_sources SET revoked_at=clock_timestamp()");
    expect((await send()).status).toBe(409);
    await db.source.query("UPDATE core.knowledge_sources SET revoked_at=NULL");
    const unpublished = { ...fixture.product, published: false };
    await db.source.query("UPDATE core.knowledge_products SET manifest=$1", [
      JSON.stringify(unpublished),
    ]);
    expect((await send()).status).toBe(409);
    await db.source.query("UPDATE core.knowledge_products SET manifest=$1", [
      JSON.stringify(fixture.product),
    ]);
    await expect(
      db.runtime("jobs", ({ client }) =>
        client.query("UPDATE core.knowledge_entries SET record=record"),
      ),
    ).rejects.toThrow();
  });
  it("dispatches real binding protocols outside locks; duplicate execution stable, withdrawal deletes reserved IDs", async () => {
    let calls = 0;
    const vectorize: KnowledgeVectorizeBinding = {
      upsert: vi.fn(async () => {
        calls++;
        return { mutationId: "synthetic-upsert" };
      }),
      deleteByIds: vi.fn(async () => ({ mutationId: "synthetic-delete" })),
      query: vi.fn(async () => ({ matches: [] })),
    };
    const handler = createKnowledgeIndexHandler({
      namespace: "synthetic-index",
      vectorize,
      apiKey: "synthetic-not-a-secret",
      fetch: async () =>
        Response.json({
          object: "list",
          model: "text-embedding-3-small",
          data: [
            {
              object: "embedding",
              index: 0,
              embedding: Array.from({ length: 1536 }, (_, i) => (i === 0 ? 0.5 : 0)),
            },
          ],
          usage: { prompt_tokens: 1, total_tokens: 1 },
        }),
    });
    await db.runtime("jobs", async (context) => {
      const signal = new AbortController().signal;
      const claim = await acquireExecution(context.client, {
        schemaVersion: 1,
        id: knowledgeId(80),
        channel: "engagement",
      });
      if (typeof claim === "string") throw new Error("Missing claim");
      expect(inTransaction(context.client)).toBe(false);
      const initial = await currentKnowledgeProjection(context, fixture.monograph.content.entryId);
      expect(initial.status, JSON.stringify(initial)).toBe("projected");
      await handler(context, claim, signal);
      await handler(context, claim, signal);
      expect(calls).toBe(2);
      expect(
        (await context.client.query("SELECT * FROM core.knowledge_index_vectors")).rowCount,
      ).toBe(1);
      const aborted = new AbortController();
      let lateMutationCompleted = false;
      vi.spyOn(vectorize, "upsert").mockImplementationOnce(async () => {
        aborted.abort();
        await Promise.resolve();
        lateMutationCompleted = true;
        return { mutationId: "synthetic-late-mutation" };
      });
      await expect(handler(context, claim, aborted.signal)).rejects.toMatchObject({
        name: "AbortError",
      });
      expect(lateMutationCompleted).toBe(true);
      expect(
        (await context.client.query("SELECT * FROM core.knowledge_index_vectors")).rowCount,
      ).toBe(1);
      expect(
        (await context.client.query("SELECT * FROM platform.receipts WHERE kind='knowledge.index'"))
          .rowCount,
      ).toBe(0);
      await expect(
        transaction(context.client, () => handler(context, claim, signal)),
      ).rejects.toThrow("locks");
      await expect(
        createKnowledgeIndexHandler({ namespace: "synthetic-index" })(context, claim, signal),
      ).rejects.toThrow("binding");
      const withdrawn = {
        ...fixture.monograph,
        state: "withdrawn",
        withdrawal: {
          actorId: knowledgeId(3),
          evidenceId: knowledgeId(4),
          withdrawnAt: new Date().toISOString(),
        },
      };
      await db.source.query("UPDATE core.knowledge_entries SET record=$2 WHERE entry_id=$1", [
        fixture.monograph.content.entryId,
        JSON.stringify(withdrawn),
      ]);
      await handler(context, claim, signal);
      expect(vectorize.deleteByIds).toHaveBeenCalledWith([expect.stringMatching(/^[a-f0-9]{64}$/)]);
      expect(calls).toBe(2);
      expect(
        (await currentKnowledgeProjection(context, fixture.monograph.content.entryId)).status,
      ).toBe("blocked");
    });
  });
});
