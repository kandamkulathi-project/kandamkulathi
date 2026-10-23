import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import wrangler from "../../apps/core-api/node_modules/wrangler/wrangler-dist/cli.js";
import { digest } from "../../scripts/platform/database.mjs";

test("actual local R2 bindings isolate public/private bytes and recover a content-addressed object by its manifest", {
  timeout: 30000,
}, async () => {
  const directory = resolve(".local-data", `platform-r2-${randomBytes(5).toString("hex")}`);
  mkdirSync(directory, { recursive: true });
  const main = resolve(directory, "binding-test.js");
  writeFileSync(main, "export default {fetch(){return new Response('Synthetic binding harness')}}");
  const configPath = resolve(directory, "wrangler.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      name: "kandamkulathi-local-r2-test",
      main,
      compatibility_date: "2026-10-19",
      r2_buckets: [
        { binding: "PUBLIC_FILES", bucket_name: "kandamkulathi-local-public" },
        { binding: "PRIVATE_FILES", bucket_name: "kandamkulathi-local-private" },
      ],
    }),
  );
  const proxy = await wrangler.getPlatformProxy({ configPath, persist: false });
  try {
    const bytes = Buffer.from("synthetic-private-object");
    const sha256 = digest(bytes);
    const key = `sha256/${sha256}`;
    await proxy.env.PRIVATE_FILES.put(key, bytes);
    assert.equal(await proxy.env.PUBLIC_FILES.get(key), null);
    await proxy.env.PUBLIC_FILES.put(key, Buffer.from("different-public-object"));
    const object = await proxy.env.PRIVATE_FILES.get(key);
    assert(object);
    const recovered = Buffer.from(await object.arrayBuffer());
    assert(recovered.equals(bytes));
    assert.equal(digest(recovered), sha256);
    const manifest = { bucket: "kandamkulathi-local-private", key, sha256, size: object.size };
    assert.equal(manifest.size, bytes.length);
    assert.equal(manifest.key.slice(7), digest(recovered));
  } finally {
    await proxy.dispose();
  }
});
