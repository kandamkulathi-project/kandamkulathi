import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, test } from "node:test";
import { transaction } from "../../packages/database/src/client.ts";
import {
  CommerceCatalogueRepository,
  readCommerceCatalogue,
  readCommerceProduct,
} from "../../packages/database/src/commerce-catalogue.ts";
import { testDatabase } from "./support.mjs";

let fixture;
const actor = randomUUID();
const other = randomUUID();
const location = randomUUID();
const policy = randomUUID();
const sku = randomUUID();
const secondSku = randomUUID();
const batch = randomUUID();
const address = {
  recipientName: "Synthetic Customer",
  line1: "Synthetic Street 1",
  city: "Thrissur",
  region: "Kerala",
  postalCode: "680001",
  country: "IN",
  contactPhone: "+919999999999",
};
const row = (overrides = {}) => ({
  skuId: sku,
  sku: "SYNTH-1",
  name: "Synthetic",
  variant: "100ml",
  description: "Synthetic fixture only",
  imageUrl: "https://example.invalid/image",
  concerns: ["fixture"],
  approvedBy: actor,
  consultOnly: false,
  unitPaise: 101,
  taxPolicyId: policy,
  locationId: location,
  batchId: batch,
  batchCode: "B1",
  expiresOn: "2035-01-01",
  quantity: 1,
  minimumShelfLifeDays: 10,
  ...overrides,
});
const run = (callback, who = actor) =>
  fixture.runtime("core", (context) =>
    callback(new CommerceCatalogueRepository(context, who), context),
  );
const cart = (lines = [{ skuId: sku, quantity: 1 }]) => ({ locationId: location, lines });
const checkout = async (input = cart(), operationId = randomUUID()) => {
  const quote = await run((repository) => repository.quote(input));
  return {
    ...input,
    operationId,
    confirmed: true,
    deliveryAddress: address,
    versions: Object.fromEntries(quote.lines.map((line) => [line.skuId, line.version])),
    quoteKey: quote.quoteKey,
  };
};
const totals = async () =>
  (
    await fixture.source.query(`SELECT
 (SELECT count(*)::int FROM core.commerce_orders) orders,
 (SELECT count(*)::int FROM core.commerce_reservations) reservations,
 (SELECT count(*)::int FROM platform.outbox) jobs,
 (SELECT coalesce(sum(reserved),0)::int FROM core.commerce_batches) reserved`)
  ).rows[0];
before(
  async () => {
    fixture = await testDatabase();
    // Migration journal registration belongs to coordinator. Do not silently skip this SQL.
    const exists = (
      await fixture.source.query("SELECT to_regclass('core.commerce_orders') AS name")
    ).rows[0].name;
    if (!exists)
      await fixture.source.query(
        readFileSync(
          new URL(
            "../../packages/database/migrations/0020_commerce_catalogue.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
  },
  { timeout: 30000 },
);
after(async () => fixture?.close());
beforeEach(async () => {
  await fixture.reset();
  await fixture.source.query(
    "TRUNCATE core.commerce_reservation_expirations,core.commerce_order_addresses,core.commerce_staff_grants,core.commerce_clinic_locations,core.commerce_reservations,core.commerce_order_lines,core.commerce_orders,core.commerce_batches,core.commerce_skus,core.commerce_imports,core.commerce_import_grants,core.commerce_tax_policies,core.commerce_locations,core.commerce_checkout_policies",
  );
  await fixture.source.query(
    "INSERT INTO core.commerce_checkout_policies VALUES(true,600,$1,'synthetic-approved-hold-v1',true)",
    [actor],
  );
  await fixture.source.query("INSERT INTO core.commerce_locations VALUES($1,'Synthetic clinic')", [
    location,
  ]);
  await fixture.source.query(
    "INSERT INTO core.commerce_tax_policies VALUES($1,500,'exclusive','half_up_line',$2,true)",
    [policy, actor],
  );
  await fixture.source.query("INSERT INTO core.commerce_import_grants VALUES($1,$2)", [
    actor,
    location,
  ]);
  const report = await run((repository) =>
    repository.importOpening(randomUUID(), [row()], { rows: 1, units: 1, baseValuePaise: 101 }),
  );
  assert.equal(report.valid, true);
});

test("real driver: checkout persists exact amount, reservation and one outbox; duplicate is idempotent", async () => {
  const input = await checkout();
  const first = await run((repository) => repository.checkout(input));
  const second = await run((repository) => repository.checkout(input));
  assert.deepEqual(first, second);
  assert.equal(first.amountPaise, 106);
  const stored = (
    await fixture.source.query(
      "SELECT address FROM core.commerce_order_addresses WHERE order_id=$1",
      [first.orderId],
    )
  ).rows[0];
  assert.deepEqual(stored.address, address);
  const order = (
    await fixture.source.query(
      "SELECT request_key,source,hold_policy_reference,extract(epoch FROM expires_at-created_at)::int AS duration FROM core.commerce_orders WHERE id=$1",
      [first.orderId],
    )
  ).rows[0];
  assert.match(order.request_key, /^[a-f0-9]{64}$/);
  assert.equal(order.source, "web");
  assert.equal(order.hold_policy_reference, "synthetic-approved-hold-v1");
  assert.equal(order.duration, 600);
  assert.deepEqual(await totals(), { orders: 1, reservations: 1, jobs: 1, reserved: 1 });
  await assert.rejects(
    run((repository) => repository.checkout({ ...input, quoteKey: "tampered" })),
    /operation_conflict/,
  );
});

test("public catalogue has exact safe projection, keyset pagination and no fabricated actor", async () => {
  await run((repository) =>
    repository.importOpening(
      randomUUID(),
      [row({ skuId: secondSku, sku: "SYNTH-2", batchId: randomUUID() })],
      { rows: 1, units: 1, baseValuePaise: 101 },
    ),
  );
  await fixture.runtime("core", async (context) => {
    const first = await readCommerceCatalogue(context, { limit: 1 });
    assert.equal(first.items.length, 1);
    assert.equal(first.items[0].stockStatus, "available");
    assert.equal(first.items[0].unitPaise, 101);
    assert(first.nextCursor);
    const second = await readCommerceCatalogue(context, { limit: 1, after: first.nextCursor });
    assert.equal(second.items.length, 1);
    assert.equal(second.nextCursor, null);
    assert.notEqual(first.items[0].skuId, second.items[0].skuId);
    assert.equal((await context.client.query("SELECT * FROM core.commerce_batches")).rowCount, 0);
    assert.equal((await readCommerceProduct(context, sku)).skuId, sku);
    assert.equal(await readCommerceProduct(context, randomUUID()), null);
  });
  await fixture.source.query("UPDATE core.commerce_batches SET recalled=true WHERE sku_id=$1", [
    sku,
  ]);
  await fixture.runtime("core", async (context) =>
    assert.equal((await readCommerceProduct(context, sku)).stockStatus, "unavailable"),
  );
  await fixture.source.query("UPDATE core.commerce_skus SET published=false WHERE id=$1", [sku]);
  await fixture.runtime("core", async (context) =>
    assert.equal(await readCommerceProduct(context, sku), null),
  );
});

test("hold policy missing or withdrawn denies; immutable address stays owner-only despite staff order visibility", async () => {
  const input = await checkout();
  await fixture.source.query("UPDATE core.commerce_checkout_policies SET active=false");
  await assert.rejects(
    run((repository) => repository.checkout(input)),
    /denied/,
  );
  await fixture.source.query("UPDATE core.commerce_checkout_policies SET active=true");
  await run((repository) => repository.checkout(input));
  await fixture.source.query(
    "CREATE POLICY commerce_test_staff_read ON core.commerce_orders FOR SELECT TO k_core_runtime USING(true)",
  );
  try {
    await run(async (_repository, { client }) => {
      await transaction(client, async () => {
        await client.query("SELECT set_config('app.actor_id',$1,true)", [other]);
        assert.equal((await client.query("SELECT * FROM core.commerce_orders")).rowCount, 1);
        assert.equal(
          (await client.query("SELECT * FROM core.commerce_order_addresses")).rowCount,
          0,
        );
      });
      await assert.rejects(
        client.query("UPDATE core.commerce_order_addresses SET address='{}'::jsonb"),
        /permission denied/,
      );
      await assert.rejects(
        client.query("DELETE FROM core.commerce_order_addresses"),
        /permission denied/,
      );
    }, other);
  } finally {
    await fixture.source.query("DROP POLICY commerce_test_staff_read ON core.commerce_orders");
  }
});

test("transaction authorization runs after actor context, denies before writes and clears context on failure", async () => {
  const input = await checkout();
  await fixture.runtime("core", async (context) => {
    let called = 0;
    const repository = new CommerceCatalogueRepository(context, actor, {
      source: "native",
      authorizeTransaction: async ({ client }) => {
        called++;
        assert.equal(
          (await client.query("SELECT current_setting('app.actor_id',true) AS actor")).rows[0]
            .actor,
          actor,
        );
        throw new Error("synthetic revoked session");
      },
    });
    await assert.rejects(repository.checkout(input), /synthetic revoked session/);
    await assert.rejects(repository.quote(cart()), /synthetic revoked session/);
    assert.equal(called, 2);
    assert.equal((await context.client.query("SELECT * FROM core.commerce_orders")).rowCount, 0);
  });
  assert.deepEqual(await totals(), { orders: 0, reservations: 0, jobs: 0, reserved: 0 });
  await fixture.runtime("core", async (context) => {
    await new CommerceCatalogueRepository(context, actor, {
      source: "native",
      authorizeTransaction: async () => {},
    }).checkout(input);
  });
  assert.equal(
    (await fixture.source.query("SELECT source FROM core.commerce_orders")).rows[0].source,
    "native",
  );
});

test("restricted backup role can pg_dump commerce schema with RLS enabled", () => {
  assert(process.env.PG_BIN_DIR, "PostgreSQL 17 client tools required");
  const target = new URL(fixture.urls.backup);
  const bytes = execFileSync(
    `${process.env.PG_BIN_DIR}/pg_dump`,
    ["--format=custom", "--schema=core", "--enable-row-security"],
    {
      env: {
        ...process.env,
        PGHOST: target.hostname,
        PGPORT: target.port,
        PGDATABASE: target.pathname.slice(1),
        PGUSER: decodeURIComponent(target.username),
        PGPASSWORD: decodeURIComponent(target.password),
      },
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  assert(bytes.length > 100);
});

test("concurrent last unit across independent Neon sessions: exactly one winner", async () => {
  const inputs = await Promise.all([checkout(), checkout()]);
  const results = await Promise.allSettled(
    inputs.map((input) => run((repository) => repository.checkout(input))),
  );
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(
    results.filter(
      (result) => result.status === "rejected" && result.reason.code === "stock_shortage",
    ).length,
    1,
  );
  assert.deepEqual(await totals(), { orders: 1, reservations: 1, jobs: 1, reserved: 1 });
});

test("concurrent same-operation retries return one persisted order and one stock effect", async () => {
  const input = await checkout();
  const results = await Promise.all([
    run((repository) => repository.checkout(input)),
    run((repository) => repository.checkout(input)),
  ]);
  assert.equal(results[0].orderId, results[1].orderId);
  assert.deepEqual(await totals(), { orders: 1, reservations: 1, jobs: 1, reserved: 1 });
});

test("real PostgreSQL lock timeout retries are bounded and leave no partial operation", async () => {
  await fixture.source.query("BEGIN");
  await fixture.source.query("SELECT id FROM core.commerce_skus WHERE id=$1 FOR UPDATE", [sku]);
  let attempts = 0;
  try {
    await fixture.runtime("core", async (context) => {
      const repository = new CommerceCatalogueRepository(context, actor, {
        authorizeTransaction: async () => {
          attempts++;
        },
      });
      await assert.rejects(repository.quote(cart()), /retry_exhausted/);
      assert.equal((await context.client.query("SELECT * FROM core.commerce_orders")).rowCount, 0);
    });
    assert.equal(attempts, 3);
  } finally {
    await fixture.source.query("ROLLBACK");
  }
  assert.deepEqual(await totals(), { orders: 0, reservations: 0, jobs: 0, reserved: 0 });
  assert.equal((await run((repository) => repository.quote(cart()))).amountPaise, 106);
});

test("FEFO excludes expiry, recall and insufficient shelf life", async () => {
  await fixture.source.query("UPDATE core.commerce_batches SET on_hand=0");
  const early = randomUUID();
  const later = randomUUID();
  for (const [id, days, recalled] of [
    [randomUUID(), -1, false],
    [randomUUID(), 3, false],
    [randomUUID(), 15, true],
    [early, 20, false],
    [later, 30, false],
  ]) {
    await fixture.source.query(
      "INSERT INTO core.commerce_batches(id,sku_id,location_id,batch_code,expires_on,on_hand,recalled) VALUES($1::uuid,$2,$3,$1::uuid::text,CURRENT_DATE+$4::int,1,$5)",
      [id, sku, location, days, recalled],
    );
  }
  await run(async (repository) => repository.checkout(await checkout()));
  assert.equal(
    (await fixture.source.query("SELECT batch_id FROM core.commerce_reservations")).rows[0]
      .batch_id,
    early,
  );
});

test("multi-item shortage rolls back earlier allocation, order, lines and outbox", async () => {
  await run((repository) =>
    repository.importOpening(
      randomUUID(),
      [row({ skuId: secondSku, sku: "SYNTH-2", batchId: randomUUID() })],
      { rows: 1, units: 1, baseValuePaise: 101 },
    ),
  );
  const sorted = [sku, secondSku].sort();
  await fixture.source.query("UPDATE core.commerce_batches SET on_hand=0 WHERE sku_id=$1", [
    sorted[1],
  ]);
  const input = await checkout(cart(sorted.map((skuId) => ({ skuId, quantity: 1 }))));
  await assert.rejects(
    run((repository) => repository.checkout(input)),
    /stock_shortage/,
  );
  assert.deepEqual(await totals(), { orders: 0, reservations: 0, jobs: 0, reserved: 0 });
});

test("current versions, price/tax changes, absent policy and consult-only deny", async () => {
  const input = await checkout();
  await fixture.source.query("UPDATE core.commerce_skus SET unit_paise=200,version=2");
  await assert.rejects(
    run((repository) => repository.checkout(input)),
    /stale_version/,
  );
  const current = await checkout();
  await fixture.source.query("UPDATE core.commerce_tax_policies SET rate_bps=1000");
  await assert.rejects(
    run((repository) => repository.checkout(current)),
    /stale_version/,
  );
  await fixture.source.query("UPDATE core.commerce_tax_policies SET active=false");
  await assert.rejects(
    run((repository) => repository.quote(cart())),
    /denied/,
  );
  await fixture.source.query("UPDATE core.commerce_tax_policies SET active=true");
  await fixture.source.query("UPDATE core.commerce_skus SET consult_only=true");
  await assert.rejects(
    run((repository) => repository.quote(cart())),
    /denied/,
  );
  assert.deepEqual(await totals(), { orders: 0, reservations: 0, jobs: 0, reserved: 0 });
});

test("RLS fails closed, owner only and pooled transaction scope clears on commit/rollback", async () => {
  await run(async (repository) => repository.checkout(await checkout()));
  await run(async (_repository, { client }) => {
    assert.equal((await client.query("SELECT * FROM core.commerce_orders")).rowCount, 0);
    await assert.rejects(
      client.query("UPDATE core.commerce_skus SET unit_paise=0"),
      /permission denied/,
    );
    await assert.rejects(
      client.query("INSERT INTO core.commerce_import_grants VALUES($1,$2)", [other, location]),
      /permission denied/,
    );
  });
  await run(async (repository, { client }) => {
    await repository.quote(cart());
    assert.equal((await client.query("SELECT * FROM core.commerce_orders")).rowCount, 0);
    await assert.rejects(repository.checkout(await checkout()), /stock_shortage/);
    assert.equal((await client.query("SELECT * FROM core.commerce_orders")).rowCount, 0);
  });
  await run(async (_repository, { client }) => {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.actor_id',$1,true)", [other]);
    assert.equal((await client.query("SELECT * FROM core.commerce_orders")).rowCount, 0);
    assert.equal((await client.query("SELECT * FROM core.commerce_reservations")).rowCount, 0);
    await client.query("ROLLBACK");
  }, other);
});

test("actor identity alone cannot read or reserve batches; checkout capability is transaction-local", async () => {
  await fixture.runtime("core", async (context) => {
    await transaction(context.client, async () => {
      await context.client.query("SELECT set_config('app.actor_id',$1,true)", [actor]);
      assert.equal((await context.client.query("SELECT * FROM core.commerce_batches")).rowCount, 0);
      assert.equal(
        (
          await context.client.query(
            "UPDATE core.commerce_batches SET reserved=reserved+1 WHERE id=$1 RETURNING id",
            [batch],
          )
        ).rowCount,
        0,
      );
    });
    const repository = new CommerceCatalogueRepository(context, actor);
    await repository.quote(cart());
    assert.equal(
      (
        await context.client.query(
          "SELECT nullif(current_setting('app.commerce_mode',true),'') AS mode",
        )
      ).rows[0].mode,
      null,
    );
    await transaction(context.client, async () => {
      await context.client.query("SELECT set_config('app.actor_id',$1,true)", [actor]);
      assert.equal((await context.client.query("SELECT * FROM core.commerce_batches")).rowCount, 0);
    });
    const input = await checkout(cart([{ skuId: sku, quantity: 2 }]));
    await assert.rejects(repository.checkout(input), /stock_shortage/);
    assert.equal(
      (
        await context.client.query(
          "SELECT nullif(current_setting('app.commerce_mode',true),'') AS mode",
        )
      ).rows[0].mode,
      null,
    );
  });
  assert.deepEqual(await totals(), { orders: 0, reservations: 0, jobs: 0, reserved: 0 });
});

test("import authorization, invalid references and duplicate IDs are all-or-nothing", async () => {
  const next = row({ skuId: secondSku, sku: "SYNTH-2", batchId: randomUUID() });
  await assert.rejects(
    run(
      (repository) =>
        repository.importOpening(randomUUID(), [next], { rows: 1, units: 1, baseValuePaise: 101 }),
      other,
    ),
    /import denied/,
  );
  const invalid = { ...next, locationId: randomUUID() };
  const referenceReport = await run((repository) =>
    repository.importOpening(randomUUID(), [invalid], { rows: 1, units: 1, baseValuePaise: 101 }),
  );
  assert.deepEqual(referenceReport.errors, [{ row: 1, code: "unknown_location" }]);
  const invalidReport = await run((repository) =>
    repository.importOpening(randomUUID(), [next], { rows: 1, units: 2, baseValuePaise: 101 }),
  );
  assert.equal(invalidReport.valid, false);
  assert.equal(
    (await fixture.source.query("SELECT count(*)::int n FROM core.commerce_skus")).rows[0].n,
    1,
  );
  const op = randomUUID();
  await run((repository) =>
    repository.importOpening(op, [next], { rows: 1, units: 1, baseValuePaise: 101 }),
  );
  await run((repository) =>
    repository.importOpening(op, [next], { rows: 1, units: 1, baseValuePaise: 101 }),
  );
  assert.equal(
    (await fixture.source.query("SELECT count(*)::int n FROM core.commerce_skus")).rows[0].n,
    2,
  );
});

test("opening imports reuse identical SKUs for multiple FEFO batches within and across operations", async () => {
  const earlierBatch = randomUUID();
  const laterBatch = randomUUID();
  const rows = [
    row({
      skuId: secondSku,
      sku: "SYNTH-2",
      batchId: laterBatch,
      batchCode: "LATER",
      expiresOn: "2034-01-01",
    }),
    row({
      skuId: secondSku,
      sku: "SYNTH-2",
      batchId: earlierBatch,
      batchCode: "EARLIER",
      expiresOn: "2033-01-01",
    }),
  ];
  const report = await run((repository) =>
    repository.importOpening(randomUUID(), rows, { rows: 2, units: 2, baseValuePaise: 202 }),
  );
  assert.equal(report.valid, true);
  const additional = row({
    skuId: secondSku,
    sku: "SYNTH-2",
    batchId: randomUUID(),
    batchCode: "ADDITIONAL",
    expiresOn: "2036-01-01",
  });
  assert.equal(
    (
      await run((repository) =>
        repository.importOpening(randomUUID(), [additional], {
          rows: 1,
          units: 1,
          baseValuePaise: 101,
        }),
      )
    ).valid,
    true,
  );
  assert.equal(
    (
      await fixture.source.query("SELECT count(*)::int n FROM core.commerce_skus WHERE id=$1", [
        secondSku,
      ])
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await fixture.source.query(
        "SELECT count(*)::int n FROM core.commerce_batches WHERE sku_id=$1",
        [secondSku],
      )
    ).rows[0].n,
    3,
  );
  const input = await checkout(cart([{ skuId: secondSku, quantity: 2 }]));
  await run((repository) => repository.checkout(input));
  const reserved = (
    await fixture.source.query("SELECT batch_id FROM core.commerce_reservations ORDER BY batch_id")
  ).rows.map((entry) => entry.batch_id);
  assert.deepEqual(reserved, [earlierBatch, laterBatch].sort());
});

test("authoritative import reports reference/metadata/batch row errors and never overwrites SKU prices", async () => {
  const changed = row({ batchId: randomUUID(), batchCode: "NEW", unitPaise: 102 });
  const next = row({ batchId: randomUUID(), batchCode: "NEW2" });
  const report = await run((repository) =>
    repository.importOpening(randomUUID(), [next, changed], {
      rows: 2,
      units: 2,
      baseValuePaise: 203,
    }),
  );
  assert.equal(report.valid, false);
  assert(report.errors.some((error) => error.row === 2 && error.code === "conflicting_sku"));
  const persistedConflict = await run((repository) =>
    repository.importOpening(randomUUID(), [changed], { rows: 1, units: 1, baseValuePaise: 102 }),
  );
  assert.deepEqual(persistedConflict.errors, [{ row: 1, code: "conflicting_sku" }]);
  const remapped = row({ skuId: randomUUID(), batchId: randomUUID(), batchCode: "MAPPING" });
  const remappedReport = await run((repository) =>
    repository.importOpening(randomUUID(), [remapped], { rows: 1, units: 1, baseValuePaise: 101 }),
  );
  assert.deepEqual(remappedReport.errors, [{ row: 1, code: "conflicting_sku" }]);
  const duplicate = await run((repository) =>
    repository.importOpening(randomUUID(), [row()], { rows: 1, units: 1, baseValuePaise: 101 }),
  );
  assert.deepEqual(duplicate.errors, [{ row: 1, code: "duplicate_batch" }]);
  const badRows = [
    row({ batchId: randomUUID(), batchCode: "MISSINGLOC", locationId: randomUUID() }),
    row({
      batchId: randomUUID(),
      batchCode: "MISSINGTAX",
      taxPolicyId: randomUUID(),
      skuId: randomUUID(),
      sku: "UNKNOWN-TAX",
    }),
  ];
  const references = await run((repository) =>
    repository.importOpening(randomUUID(), badRows, { rows: 2, units: 2, baseValuePaise: 202 }),
  );
  assert.deepEqual(references.errors, [
    { row: 1, code: "unknown_location" },
    { row: 2, code: "unapproved_tax" },
  ]);
  assert.equal(
    (await fixture.source.query("SELECT unit_paise FROM core.commerce_skus WHERE id=$1", [sku]))
      .rows[0].unit_paise,
    "101",
  );
  assert.equal(
    (await fixture.source.query("SELECT count(*)::int n FROM core.commerce_batches")).rows[0].n,
    1,
  );
});

test("forced outbox failure rolls back all business effects", async () => {
  const input = await checkout();
  await fixture.source.query(`CREATE FUNCTION core.commerce_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic outbox failure'; END $$;
    CREATE TRIGGER commerce_test_fail BEFORE INSERT ON platform.outbox FOR EACH ROW EXECUTE FUNCTION core.commerce_test_fail()`);
  try {
    await assert.rejects(
      run((repository) => repository.checkout(input)),
      (error) =>
        error.cause?.code === "P0001" && error.cause.message === "synthetic outbox failure",
    );
    assert.deepEqual(await totals(), { orders: 0, reservations: 0, jobs: 0, reserved: 0 });
  } finally {
    await fixture.source.query(
      "DROP TRIGGER commerce_test_fail ON platform.outbox; DROP FUNCTION core.commerce_test_fail()",
    );
  }
});
