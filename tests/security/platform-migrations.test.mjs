import assert from "node:assert/strict";
import test from "node:test";
import { migrationSet } from "../../scripts/platform/database.mjs";

const first = { id: "0000_first", sha256: "a".repeat(64) };
const second = { id: "0001_second", sha256: "b".repeat(64) };

test("migration identity is canonical without mutating input or replacing actual checksums", () => {
  const rows = [second, first];
  assert.deepEqual(migrationSet(rows), [first, second]);
  assert.deepEqual(rows, [second, first]);
  const changed = { ...first, sha256: "c".repeat(64) };
  assert.deepEqual(migrationSet([changed]), [changed]);
  assert.notDeepEqual(migrationSet([changed]), migrationSet([first]));
});

test("migration ledger rejects missing, malformed, duplicate and unexpected fields", () => {
  for (const rows of [
    null,
    [],
    [null],
    [first, first],
    [{ ...first, id: "../migration" }],
    [{ ...first, sha256: "invalid" }],
    [{ ...first, sha256: "A".repeat(64) }],
    [{ id: first.id }],
    [{ ...first, extra: "not-part-of-ledger-identity" }],
  ])
    assert.throws(() => migrationSet(rows));
});
