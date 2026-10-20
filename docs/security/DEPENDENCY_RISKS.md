# Dependency remediation and remaining risks

**Updated:** 2026-10-19. **Status:** Two high findings locally source-patched with verification; independent senior review Pending. The two moderate findings have been removed through targeted fixed-release overrides and real-library regressions. No phase, production or cryptographic-audit approval is asserted. **Owners:** Devadathan and Mathew; no author self-approval.

## Current findings

The latest raw registry report contains only the two high findings whose original package versions remain locally source-patched. No published fixed versions for those high findings were available during investigation. The moderate findings no longer appear after the overrides below. No versions were fabricated, packages renamed or advisories ignored; the gate now blocks unremediated findings at every severity.

| Finding | Dependency path | Remediation / remaining action |
|---|---|---|
| [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), high | Expo CLI and code-signing-certificates → node-forge 1.4.0 | Local exact-version patch rejects extra nested DigestAlgorithm children, following [upstream PR 1152](https://github.com/digitalbazaar/forge/pull/1152). That PR was unmerged; this is a reviewable backport, not a published upstream fix. Real-library signature regressions pass. Senior review Pending. |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), high | Expo Metro → metro-file-map → micromatch → braces 3.0.3 | Local exact-version patch bounds parsed AST container nesting to 100, following the [upstream report's guard recommendation](https://github.com/micromatch/braces/issues/70). Covers brace/parenthesis/mixed nesting; normal glob and escaping cases pass. Arbitrary untrusted hand-built ASTs are outside this parser guard. Senior review Pending. |
| [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99), moderate | Drizzle Kit → esbuild-kit loader/core-utils → esbuild | Fixed by exact `@esbuild-kit/core-utils@3.3.2>esbuild: 0.28.2` override. Real parent-resolved TypeScript transform and an actual loopback esbuild server confirm compatibility and absence of arbitrary-origin CORS access. Drizzle/Neon remain unchanged. The deprecated loader still needs ordinary upstream maintenance. |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq), moderate | Expo config-plugins → xcode → uuid | Fixed by exact `xcode@3.0.1>uuid: 11.1.1` override. This published security backport retains CommonJS, unlike uuid 12+. Tests exercise actual parent-resolved v3/v5/v6 bounds, valid namespace UUIDs, 100 Xcode identifiers and PBX project parser/writer round trip. JavaScript/native-project tooling tests do not prove signed native device behavior. |

## Verification rather than an advisory exclusion

`pnpm security:check` first verifies every discovered installed node-forge/braces copy: actual package identity/version, exact changed-source SHA-256 and committed patch SHA-256 against `security-remediations.json`. It then runs the real Expo-resolved library regressions and obtains the complete fresh registry audit. Only the two exact advisory-content fingerprints with verified installed code can be classified `VERIFIED_LOCAL_PATCH`.

Unknown/changed/unverified findings at every severity fail. Missing/tampered files, unexpected versions, additional unpatched copies, changed advisory scope, failed regressions, invalid/offline audit responses and muted advisories fail. The CLI prints every finding; CI retains the untouched JSON as `dependency-audit-<run id>` for seven days and includes the disposition in the job summary. A green verification result means the stated source-remediation checks passed; **it does not mean the registry reports zero vulnerabilities**.

`pnpm audit --audit-level high` remains available, unsuppressed, and currently returns nonzero for the unchanged base-version findings. Do not delete the raw report, add ignore IDs, automatically refresh fingerprints or replace this verification with an unconditional success. [ADR 0005](../architecture/adr/0005-toolchain-security-backports.md) records provenance, evidence, maintenance and removal.

## Release and maintenance

These are development/build-tool paths in the starter. That is not proof of non-exploitability in a future native/signing/session feature. Keep development services private and inputs trusted. Review the patches and verification policy independently before merge, then rerun applicable device/signing/update workflows before relying on them. The current work preserves all application requirements, stack choices, six-member assignments and phase gates.

Review upstream fixes before each phase/release and dependency update. Prefer official compatible fixed releases, remove superseded patches/proof records deliberately and retain the regression tests. A changed/new finding requires fresh security review, not a scanner waiver. No unresolved confirmed high vulnerability or missing independent required review passes a production gate.
