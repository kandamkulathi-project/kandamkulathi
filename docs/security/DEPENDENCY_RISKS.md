# Dependency remediation and remaining risks

**Updated:** 2026-10-19. **Status:** Two high findings locally source-patched with verification; independent senior review Pending. Two moderate findings remain Open. No phase, production or cryptographic-audit approval is asserted. **Owners:** Devadathan and Mathew; no author self-approval.

## Current findings

The raw registry report still contains two high and two moderate findings because it matches the original package versions, not modified source. No published fixed versions for the high findings were available during investigation. No versions were fabricated, packages renamed, advisories ignored or severity thresholds reduced.

| Finding | Dependency path | Remediation / remaining action |
|---|---|---|
| [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), high | Expo CLI and code-signing-certificates → node-forge 1.4.0 | Local exact-version patch rejects extra nested DigestAlgorithm children, following [upstream PR 1152](https://github.com/digitalbazaar/forge/pull/1152). That PR was unmerged; this is a reviewable backport, not a published upstream fix. Real-library signature regressions pass. Senior review Pending. |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), high | Expo Metro → metro-file-map → micromatch → braces 3.0.3 | Local exact-version patch bounds parsed AST container nesting to 100, following the [upstream report's guard recommendation](https://github.com/micromatch/braces/issues/70). Covers brace/parenthesis/mixed nesting; normal glob and escaping cases pass. Arbitrary untrusted hand-built ASTs are outside this parser guard. Senior review Pending. |
| [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99), moderate | Drizzle Kit → esbuild-kit loader/core-utils → esbuild 0.18.20 | Open. Development-server request/read exposure. Starter uses offline generation and never starts this esbuild server; that observation is not closure. Upgrade a maintained compatible loader/tool path and verify database tooling. |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq), moderate | Expo config-plugins → xcode → uuid 7.0.3 | Open. Buffer bounds issue for specific UUID APIs. Upgrade a compatible maintained tool path and verify native configuration/builds; JavaScript exports alone are not native proof. |

## Verification rather than an advisory exclusion

`pnpm security:check` first verifies every discovered installed node-forge/braces copy: actual package identity/version, exact changed-source SHA-256 and committed patch SHA-256 against `security-remediations.json`. It then runs the real Expo-resolved library regressions and obtains the complete fresh registry audit. Only the two exact advisory-content fingerprints with verified installed code can be classified `VERIFIED_LOCAL_PATCH`.

Unknown/changed/unverified high or critical findings fail. Missing/tampered files, unexpected versions, additional unpatched copies, changed advisory scope, failed regressions, invalid/offline audit responses and muted advisories fail. The CLI prints every finding; CI retains the untouched JSON as `dependency-audit-<run id>` for seven days and includes the disposition in the job summary. A green verification result means the stated source-remediation checks passed; **it does not mean the registry reports zero vulnerabilities**.

`pnpm audit --audit-level high` remains available, unsuppressed, and currently returns nonzero for the unchanged base-version findings. Do not delete the raw report, add ignore IDs, automatically refresh fingerprints or replace this verification with an unconditional success. [ADR 0005](../architecture/adr/0005-toolchain-security-backports.md) records provenance, evidence, maintenance and removal.

## Release and maintenance

These are development/build-tool paths in the starter. That is not proof of non-exploitability in a future native/signing/session feature. Keep development services private and inputs trusted. Review the patches and verification policy independently before merge, then rerun applicable device/signing/update workflows before relying on them. The current work preserves all application requirements, stack choices, six-member assignments and phase gates.

Review upstream fixes before each phase/release and dependency update. Prefer official compatible fixed releases, remove superseded patches/proof records deliberately and retain the regression tests. A changed/new finding requires fresh security review, not a scanner waiver. No unresolved confirmed high vulnerability or missing independent required review passes a production gate.
