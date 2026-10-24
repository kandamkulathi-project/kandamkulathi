import assert from "node:assert/strict";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { sha256, verifyInstalledPatches } from "../../scripts/security/policy.mjs";

function fixture(context) {
  const base = mkdtempSync(join(tmpdir(), "dependency-location-"));
  context.after(() => rmSync(base, { recursive: true, force: true }));
  const root = join(base, "checkout");
  const installedRoot = join(base, "generated", "node_modules");
  const packageRoot = join(installedRoot, ".pnpm", "example", "node_modules", "example");
  mkdirSync(join(root, "patches"), { recursive: true });
  mkdirSync(join(packageRoot, "lib"), { recursive: true });
  writeFileSync(
    join(packageRoot, "package.json"),
    JSON.stringify({ name: "example", version: "1.0.0" }),
  );
  writeFileSync(join(packageRoot, "lib/verify.js"), "fixed source");
  writeFileSync(join(root, "patches/example.patch"), "fixed patch");
  symlinkSync(installedRoot, join(root, "node_modules"), "junction");
  const manifest = {
    schemaVersion: 1,
    remediations: [
      {
        advisory: "GHSA-synthetic",
        package: "example",
        version: "1.0.0",
        patch: "patches/example.patch",
        patchSha256: sha256("fixed patch"),
        files: { "lib/verify.js": sha256("fixed source") },
      },
    ],
  };
  const verify = (path = packageRoot, read = readFileSync, from = "example") =>
    verifyInstalledPatches(root, manifest, [{ dependencies: { example: { from, path } } }], read);
  return { base, root, installedRoot, packageRoot, manifest, verify };
}

describe("installed dependency real-root containment", () => {
  it("never reads external metadata, including unrelated and aliased package identities", (context) => {
    const { base, installedRoot, packageRoot, verify } = fixture(context);
    const outside = join(base, "outside");
    cpSync(packageRoot, outside, { recursive: true });
    const escaped = join(installedRoot, "escaped");
    symlinkSync(outside, escaped, "junction");
    for (const path of [outside, escaped]) {
      for (const from of ["example", "npm:example@1.0.0", "unrelated"]) {
        const reads = [];
        assert.throws(
          () =>
            verify(
              path,
              (file, encoding) => {
                reads.push(file);
                return readFileSync(file, encoding);
              },
              from,
            ),
          /Unexpected dependency location/,
        );
        assert.deepEqual(reads, []);
      }
    }
  });

  it("never reads an escaped identity even when the package directory is installed", (context) => {
    const { base, packageRoot, verify } = fixture(context);
    const outside = join(base, "identity.json");
    cpSync(join(packageRoot, "package.json"), outside);
    rmSync(join(packageRoot, "package.json"));
    symlinkSync(outside, join(packageRoot, "package.json"));
    const reads = [];
    assert.throws(
      () =>
        verify(packageRoot, (file, encoding) => {
          reads.push(file);
          return readFileSync(file, encoding);
        }),
      /Package identity/,
    );
    assert.deepEqual(reads, []);
  });

  it("allows repository workspace metadata without treating it as installed patch evidence", (context) => {
    const { root, packageRoot, manifest } = fixture(context);
    const workspace = join(root, "packages", "local");
    mkdirSync(workspace, { recursive: true });
    writeFileSync(
      join(workspace, "package.json"),
      JSON.stringify({ name: "local", version: "1.0.0" }),
    );
    const tree = [
      {
        dependencies: {
          local: { from: "local", path: workspace },
          example: { from: "example", path: packageRoot },
        },
      },
    ];
    assert.equal(verifyInstalledPatches(root, manifest, tree).size, 1);
    writeFileSync(
      join(workspace, "package.json"),
      JSON.stringify({ name: "example", version: "1.0.0" }),
    );
    assert.throws(
      () => verifyInstalledPatches(root, manifest, tree),
      /Unexpected dependency location/,
    );
  });

  it("rejects workspace package and identity escapes before reading them", (context) => {
    const { base, root, packageRoot, verify } = fixture(context);
    const outside = join(base, "outside");
    cpSync(packageRoot, outside, { recursive: true });
    mkdirSync(join(root, "packages"));
    const workspace = join(root, "packages", "local");
    symlinkSync(outside, workspace, "junction");
    const reads = [];
    const read = (file, encoding) => {
      reads.push(file);
      return readFileSync(file, encoding);
    };
    assert.throws(() => verify(workspace, read, "local"), /Unexpected dependency location/);
    rmSync(workspace);
    mkdirSync(workspace);
    symlinkSync(join(outside, "package.json"), join(workspace, "package.json"));
    assert.throws(() => verify(workspace, read, "local"), /Package identity/);
    assert.deepEqual(reads, []);
  });

  it("does not skip invalid absent paths as optional binaries", (context) => {
    const { base, packageRoot, verify } = fixture(context);
    for (const path of [join(base, "absent"), `${packageRoot}/../absent`, "relative/absent"]) {
      const reads = [];
      assert.throws(
        () =>
          verify(path, (file) => {
            reads.push(file);
          }),
        /Unexpected dependency location/,
      );
      assert.deepEqual(reads, []);
    }
  });

  it("accepts only the checkout's relocated node_modules root, using real or lexical package paths", (context) => {
    const { root, packageRoot, verify } = fixture(context);
    assert.equal(verify(packageRoot).size, 1);
    assert.equal(verify(join(root, "node_modules/.pnpm/example/node_modules/example")).size, 1);
  });

  it("rejects an escaped nested package symlink even when identity and source hashes match", (context) => {
    const { base, installedRoot, packageRoot, verify } = fixture(context);
    const outside = join(base, "outside");
    cpSync(packageRoot, outside, { recursive: true });
    const escapedPackage = join(installedRoot, "escaped-package");
    symlinkSync(outside, escapedPackage, "junction");
    assert.throws(() => verify(escapedPackage), /Unexpected dependency location/);
  });

  it("rejects sibling, lookalike-prefix and unrelated external virtual stores", (context) => {
    const { base, installedRoot, packageRoot, verify } = fixture(context);
    for (const outside of [
      join(base, "sibling"),
      `${installedRoot}-lookalike`,
      join(base, "external/.pnpm/example"),
    ]) {
      mkdirSync(dirname(outside), { recursive: true });
      cpSync(packageRoot, outside, { recursive: true });
      assert.throws(() => verify(outside), /Unexpected dependency location/);
    }
  });

  it("rejects traversal even when its resolved destination is inside the installed root", (context) => {
    const { packageRoot, verify } = fixture(context);
    assert.throws(() => verify(`${packageRoot}/../example`), /Unexpected dependency location/);
  });

  it("rejects missing, dangling and non-directory installed roots", (context) => {
    const { root, installedRoot, verify } = fixture(context);
    rmSync(join(root, "node_modules"));
    assert.throws(() => verify(), /ENOENT/);
    symlinkSync(join(installedRoot, "missing"), join(root, "node_modules"), "junction");
    assert.throws(() => verify(), /ENOENT/);
    rmSync(join(root, "node_modules"));
    writeFileSync(join(root, "node_modules"), "not a directory");
    assert.throws(() => verify(), /root must be a directory/);
  });

  it("rejects an escaped nested source directory despite matching source bytes", (context) => {
    const { base, packageRoot, verify } = fixture(context);
    const outside = join(base, "outside-source");
    mkdirSync(outside);
    writeFileSync(join(outside, "verify.js"), "fixed source");
    rmSync(join(packageRoot, "lib"), { recursive: true });
    symlinkSync(outside, join(packageRoot, "lib"), "junction");
    assert.throws(() => verify(), /Source must remain in its package/);
  });
});
