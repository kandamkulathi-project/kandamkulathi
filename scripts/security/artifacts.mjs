import assert from "node:assert/strict";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execute } from "./scan.mjs";
import { root, tool } from "./tools.mjs";

export const clientRoots = ["apps/web-public/dist", "apps/workspaces/dist", "apps/mobile/dist"];
// These are backend-only identifiers and known test-record markers, not a claim to detect all private content.
const forbidden = [
  "DATABASE_ADMIN_URL",
  "WORKOS_COOKIE_PASSWORD",
  "OPENAI_API_KEY",
  "RAZORPAY_KEY_SECRET",
  "Synthetic physician",
  "synthetic_membership_0123456789",
  "Synthetic knowledge entry",
  "Synthetic reviewing physician",
];
export async function auditClientArtifacts(targets = clientRoots) {
  const local = join(root, ".local-data");
  mkdirSync(local, { recursive: true });
  const folder = mkdtempSync(join(local, "client-artifacts-"));
  let scanned = 0;
  try {
    const visit = (path) => {
      const metadata = lstatSync(path);
      assert(!metadata.isSymbolicLink(), "Client artifact symlinks require review");
      if (metadata.isDirectory()) {
        for (const name of readdirSync(path)) visit(join(path, name));
        return;
      }
      assert(
        !/\.(map|pem|key|sql)$/i.test(path) && !/(^|[/\\])\.env($|\.)/.test(path),
        "Private/source-map file in client artifacts",
      );
      if (!/\.(js|mjs|cjs|hbc|html|json|css)$/i.test(path)) return;
      assert(metadata.size <= 32 * 1024 * 1024, "Client artifact exceeds bounded audit size");
      const bytes = readFileSync(path);
      for (const marker of forbidden)
        assert(
          !bytes.includes(Buffer.from(marker)),
          "Backend/private fixture marker in client artifact",
        );
      // HBC string tables retain literal bytes. Extract printable strings so Gitleaks does not skip binary bundles.
      const printable = Array.from(bytes.toString("latin1"), (character) => {
        const code = character.charCodeAt(0);
        return (code >= 32 && code <= 126) || [9, 10, 13].includes(code) ? character : "\n";
      }).join("");
      writeFileSync(join(folder, `client-${scanned++}.txt`), printable);
    };
    for (const target of targets) {
      const absolute = resolve(root, target);
      const within = relative(root, absolute);
      assert(
        within && !within.startsWith("..") && !isAbsolute(within),
        "Artifact target must stay inside the repository",
      );
      visit(absolute);
    }
    assert(scanned > 0, "No client artifacts scanned; build before auditing");
    await tool("gitleaks");
    const ignore = join(folder, "empty-ignore");
    writeFileSync(ignore, "");
    const result = execute(
      "gitleaks",
      [
        "dir",
        "--no-banner",
        "--redact=100",
        "--ignore-gitleaks-allow",
        "--gitleaks-ignore-path",
        ignore,
        "--config",
        join(root, ".security/gitleaks.toml"),
        folder,
      ],
      root,
    );
    assert.equal(
      result.status,
      0,
      "Client artifact secret scan failed (credential values withheld)",
    );
    return { scanned };
  } finally {
    const within = relative(local, folder);
    assert(
      within && !within.startsWith("..") && !isAbsolute(within),
      "Unsafe artifact audit cleanup",
    );
    rmSync(folder, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await auditClientArtifacts();
    console.log(
      `Client artifact audit passed: ${result.scanned} text/Hermes artifacts; no configured marker/secret findings.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
