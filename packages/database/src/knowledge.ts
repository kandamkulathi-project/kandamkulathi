import { z } from "zod";
import {
  type KnowledgeContent,
  type KnowledgeProduct,
  type KnowledgeRecord,
  knowledgeContentSchema,
  knowledgeIdSchema,
  knowledgeProductSchema,
  mandatorySafetyKinds,
} from "../../contracts/src/knowledge.ts";
import {
  approveKnowledge,
  type CurrentKnowledgeRead,
  draftKnowledge,
  type KnowledgeAuthority,
  type KnowledgeReadFence,
  type KnowledgeTransitionResult,
  referenceOf,
  type TrustedKnowledgeRepository,
  validateKnowledgeRecord,
  withdrawKnowledge,
} from "../../domain/src/knowledge/index.ts";
import { type DatabaseClient, transaction } from "./client.ts";

/** Must use this client to lock current grant/evidence/qualification rows until commit.
 * No network calls, caller roles, cached authority or unconditional true implementations.
 * Product management permission is an integration policy, never inferred from edit.
 */
export type KnowledgeAuthorityFence = (
  client: DatabaseClient,
  request:
    | { permission: "read"; entries: readonly KnowledgeRecord[] }
    | { permission: "edit" | "approve" | "withdraw"; content: KnowledgeContent }
    | { permission: "manage-product"; product: KnowledgeProduct },
) => Promise<boolean>;
type Run = <T>(operation: (client: DatabaseClient) => Promise<T>) => Promise<T>;
const lock = (client: DatabaseClient, write: boolean) =>
  client.query(
    write
      ? "SELECT pg_advisory_xact_lock(173403,3)"
      : "SELECT pg_advisory_xact_lock_shared(173403,3)",
  );
const equal = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const left = Object.entries(a);
  return (
    left.length === Object.keys(b).length &&
    left.every(
      ([key, value]) => Object.hasOwn(b, key) && equal(value, (b as Record<string, unknown>)[key]),
    )
  );
};
async function entry(client: DatabaseClient, id: string): Promise<unknown> {
  return (
    (
      await client.query<{ record: unknown }>(
        "SELECT record FROM core.knowledge_entries WHERE entry_id=$1 FOR SHARE",
        [knowledgeIdSchema.parse(id)],
      )
    ).rows[0]?.record ?? null
  );
}
async function product(client: DatabaseClient, id: string): Promise<unknown> {
  return (
    (
      await client.query<{ manifest: unknown }>(
        "SELECT manifest FROM core.knowledge_products WHERE product_id=$1 FOR SHARE",
        [knowledgeIdSchema.parse(id)],
      )
    ).rows[0]?.manifest ?? null
  );
}

/** Each run must acquire an event-scoped Core connection through withDatabase. */
export function createPostgresKnowledge(
  run: Run,
  authority: KnowledgeAuthority,
  fence: KnowledgeAuthorityFence,
) {
  const within = <T>(write: boolean, operation: (client: DatabaseClient) => Promise<T>) =>
    run((client) =>
      transaction(client, async () => {
        await lock(client, write);
        return operation(client);
      }),
    );
  const readPort = (client: DatabaseClient): CurrentKnowledgeRead => ({
    loadEntry: (id) => entry(client, id),
    loadProduct: (id) => product(client, id),
    async loadMandatoryBlocks(id, language) {
      const manifest = knowledgeProductSchema.safeParse(await product(client, id));
      if (!manifest.success) return [];
      const inputs: unknown[] = [];
      for (const kind of mandatorySafetyKinds) {
        const ref = manifest.data.knowledge[language][kind];
        if (ref) inputs.push(await entry(client, ref.entryId));
      }
      return inputs;
    },
    async confirmCurrent(current: KnowledgeReadFence) {
      if (
        current.product &&
        !equal(await product(client, current.product.productId), current.product)
      )
        return false;
      for (const record of current.entries)
        if (!equal(await entry(client, record.content.entryId), record)) return false;
      return fence(client, { permission: "read", entries: current.entries });
    },
    async confirmInventoryCurrent(products) {
      const rows = await client.query<{ manifest: unknown }>(
        "SELECT manifest FROM core.knowledge_products WHERE manifest->>'published'='true' ORDER BY product_id",
      );
      const sorted = [...products].sort((a, b) => a.productId.localeCompare(b.productId));
      return equal(
        rows.rows.map((row) => row.manifest),
        sorted,
      );
    },
  });
  const repository: TrustedKnowledgeRepository = {
    withCurrentRead: (operation) => within(false, (client) => operation(readPort(client))),
    withPublishedInventory: (operation) =>
      within(false, async (client) => {
        const rows = await client.query<{ manifest: unknown }>(
          "SELECT manifest FROM core.knowledge_products WHERE manifest->>'published'='true' ORDER BY product_id",
        );
        return operation(
          rows.rows.map((row) => row.manifest),
          readPort(client),
        );
      }),
  };
  async function persist(client: DatabaseClient, result: KnowledgeTransitionResult) {
    if (result.status !== "candidate") return result;
    const next = result.next;
    const current = await validateKnowledgeRecord(await entry(client, next.content.entryId));
    if (
      result.expected
        ? !current ||
          !equal(result.expected, {
            entryId: current.content.entryId,
            revision: current.content.revision,
            contentHash: current.contentHash,
            state: current.state,
          })
        : current !== null
    )
      throw new Error("Knowledge compare-and-swap conflict.");
    await client.query("SELECT set_config('app.knowledge_write','authorized',true)");
    await client.query(
      "INSERT INTO core.knowledge_entries(entry_id,record) VALUES($1,$2) ON CONFLICT(entry_id) DO UPDATE SET record=EXCLUDED.record",
      [next.content.entryId, JSON.stringify(next)],
    );
    await client.query(
      "INSERT INTO core.knowledge_history(event_id,entry_id,record) VALUES($1,$2,$3)",
      [crypto.randomUUID(), next.content.entryId, JSON.stringify(next)],
    );
    await client.query(
      "INSERT INTO core.knowledge_index_obligations(id,entry_id,reference,action) VALUES($1,$2,$3,$4)",
      [
        crypto.randomUUID(),
        next.content.entryId,
        JSON.stringify({
          entryId: next.content.entryId,
          revision: next.content.revision,
          contentHash: next.contentHash,
        }),
        next.state === "approved" ? "refresh" : "remove",
      ],
    );
    return { status: "persisted" as const, record: next };
  }
  async function mutate(
    id: string,
    permission: "approve" | "withdraw",
    expected: { revision: number; contentHash: string },
  ) {
    return within(true, async (client) => {
      const current = await validateKnowledgeRecord(await entry(client, id));
      if (
        current &&
        (current.content.revision !== expected.revision ||
          current.contentHash !== expected.contentHash)
      )
        throw new Error("Knowledge compare-and-swap conflict.");
      if (!current || !(await fence(client, { permission, content: current.content })))
        return { status: "blocked" as const, reason: "FORBIDDEN" as const };
      const now = new Date().toISOString();
      return persist(
        client,
        permission === "approve"
          ? await approveKnowledge(current, now, authority)
          : await withdrawKnowledge(current, now, authority),
      );
    });
  }
  return {
    repository,
    approve: (id: string, expected: { revision: number; contentHash: string }) =>
      mutate(id, "approve", expected),
    withdraw: (id: string, expected: { revision: number; contentHash: string }) =>
      mutate(id, "withdraw", expected),
    draft: (input: unknown, bytes: ReadonlyMap<string, Uint8Array>) =>
      within(true, async (client) => {
        const content = knowledgeContentSchema.parse(input);
        if (!(await fence(client, { permission: "edit", content })))
          return { status: "blocked" as const, reason: "FORBIDDEN" as const };
        return persist(
          client,
          await draftKnowledge(content, await entry(client, content.entryId), bytes, authority),
        );
      }),
    /** Authoritative catalogue synchronization, never an HTTP-selected partial inventory. */
    saveProduct: (input: unknown, expectedRevision: number | null, terms: unknown) =>
      within(true, async (client) => {
        const next = knowledgeProductSchema.parse(input);
        const aliases = z
          .array(
            z.strictObject({
              term: z.string().trim().min(1).max(200),
              origin: z.enum(["exact", "alias", "keyword"]),
            }),
          )
          .max(100)
          .parse(terms);
        if (!(await fence(client, { permission: "manage-product", product: next })))
          throw new Error("Knowledge product permission denied.");
        const previous = await product(client, next.productId);
        if (
          expectedRevision === null
            ? previous !== null || next.revision !== 1
            : !previous ||
              knowledgeProductSchema.parse(previous).revision !== expectedRevision ||
              next.revision !== expectedRevision + 1
        )
          throw new Error("Knowledge product compare-and-swap conflict.");
        await client.query("SELECT set_config('app.knowledge_write','authorized',true)");
        await client.query(
          "INSERT INTO core.knowledge_products(product_id,manifest) VALUES($1,$2) ON CONFLICT(product_id) DO UPDATE SET manifest=EXCLUDED.manifest",
          [next.productId, JSON.stringify(next)],
        );
        await client.query("DELETE FROM core.knowledge_terms WHERE product_id=$1", [
          next.productId,
        ]);
        for (const alias of aliases)
          await client.query(
            "INSERT INTO core.knowledge_terms(product_id,term,origin) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
            [next.productId, alias.term.toLocaleLowerCase("en-US"), alias.origin],
          );
        // Publication/manifest changes also invalidate old projections. Consumers recheck
        // CURRENT primary state, not the captured reference or action, before effects.
        await client.query(
          `INSERT INTO core.knowledge_index_obligations(id,entry_id,reference,action)
        SELECT gen_random_uuid(),entry_id,jsonb_build_object('entryId',entry_id,'revision',
        (record->'content'->>'revision')::int,'contentHash',record->>'contentHash'),'refresh'
        FROM core.knowledge_entries WHERE record->'content'->>'productId'=$1`,
          [next.productId],
        );
        return next;
      }),
    /** Bounded deterministic hints; no model, vectors or private corpus. */
    search: (input: unknown) =>
      within(false, async (client) => {
        const query = z
          .strictObject({
            term: z.string().trim().min(1).max(200),
            language: z.enum(["en", "ml", "ta"]),
          })
          .parse(input);
        const rows = await client.query<{ record: unknown; origin: "exact" | "alias" | "keyword" }>(
          `SELECT e.record,t.origin FROM core.knowledge_terms t
        JOIN core.knowledge_products p USING(product_id)
        JOIN core.knowledge_entries e ON e.entry_id=(p.manifest->'knowledge'->$2->'monograph'->>'entryId')::uuid
        WHERE p.manifest->>'published'='true' AND e.record->>'state'='approved'
        AND t.term=$1 ORDER BY CASE t.origin WHEN 'exact' THEN 0 WHEN 'alias' THEN 1 ELSE 2 END,t.product_id LIMIT 20`,
          [query.term.toLocaleLowerCase("en-US"), query.language],
        );
        const results = [];
        for (const row of rows.rows) {
          const record = await validateKnowledgeRecord(row.record);
          if (
            record?.state !== "approved" ||
            record.content.language !== query.language ||
            record.content.kind !== "monograph" ||
            !record.content.productId
          )
            continue;
          const manifest = knowledgeProductSchema.parse(
            await product(client, record.content.productId),
          );
          if (
            !equal(manifest.knowledge[query.language].monograph, referenceOf(record)) ||
            !(await authority.isApprovalCurrent(record.approval, record.content)) ||
            !(await fence(client, { permission: "read", entries: [record] }))
          )
            continue;
          results.push({
            productId: record.content.productId,
            ...referenceOf(record),
            origin: row.origin,
          });
        }
        return results;
      }),
  };
}
