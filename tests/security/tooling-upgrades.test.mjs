import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { describe, it } from "node:test";

const mobile = createRequire(new URL("../../apps/mobile/package.json", import.meta.url));
const expo = createRequire(mobile.resolve("expo/package.json"));
const config = createRequire(expo.resolve("@expo/config-plugins/package.json"));
const xcode = config("xcode");
const native = createRequire(config.resolve("xcode/package.json"));
const uuid = native("uuid");
const database = createRequire(new URL("../../packages/database/package.json", import.meta.url));
const kit = createRequire(database.resolve("drizzle-kit"));
const loader = createRequire(kit.resolve("@esbuild-kit/esm-loader"));
const core = createRequire(loader.resolve("@esbuild-kit/core-utils"));
const esbuild = core("esbuild");

describe("actual native/SQL toolchain dependency upgrades", () => {
  it("keeps Xcode's CommonJS UUID generation and project read/write working", () => {
    assert.equal(native("uuid/package.json").version, "11.1.1");
    const folder = mkdtempSync(join(tmpdir(), "kandamkulathi-xcode-"));
    try {
      const filename = join(folder, "project.pbxproj");
      writeFileSync(
        filename,
        "// !$*UTF8*$!\n{archiveVersion = 1; classes = {}; objectVersion = 56; objects = {}; rootObject = AAAAAAAAAAAAAAAAAAAAAAAA;}\n",
      );
      const project = xcode.project(filename).parseSync();
      const ids = new Set(Array.from({ length: 100 }, () => project.generateUuid()));
      assert.equal(ids.size, 100);
      for (const id of ids) assert.match(id, /^[0-9A-F]{24}$/);
      writeFileSync(filename, project.writeSync());
      assert.equal(xcode.project(filename).parseSync().hash.project.objectVersion, 56);
      assert(readFileSync(filename, "utf8").includes("rootObject"));
    } finally {
      const within = relative(resolve(tmpdir()), resolve(folder));
      assert(within && !within.startsWith("..") && !isAbsolute(within));
      rmSync(folder, { recursive: true, force: true });
    }
  });
  it("rejects UUID buffer truncation while preserving normal namespace UUIDs", () => {
    for (const method of ["v3", "v5"]) {
      assert.equal(uuid[method]("hello.example", uuid[method].DNS).length, 36);
      assert.throws(() => uuid[method]("x", uuid[method].DNS, new Uint8Array(8), 4), RangeError);
    }
    assert.throws(() => uuid.v6({}, new Uint8Array(8), 4), RangeError);
  });
  it("preserves the Drizzle loader's TypeScript transform path", async () => {
    assert.equal(esbuild.version, "0.28.2");
    const transformed = loader("@esbuild-kit/core-utils").transformSync(
      "export const amount: number = 123;",
      "/synthetic/schema.ts",
    );
    assert(transformed.code.includes("123"));
    assert(!transformed.code.includes(": number"));
    assert(transformed.map);
  });
  it("does not grant an arbitrary origin access to esbuild's development server", async () => {
    const context = await esbuild.context({
      stdin: { contents: "console.log('synthetic')" },
      write: false,
    });
    try {
      const { port } = await context.serve({ host: "127.0.0.1", port: 0 });
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        headers: { Origin: "https://untrusted.invalid" },
      });
      assert.equal(response.headers.get("access-control-allow-origin"), null);
    } finally {
      await context.dispose();
    }
  });
});
