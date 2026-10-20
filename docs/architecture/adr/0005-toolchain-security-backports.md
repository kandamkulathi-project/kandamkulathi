# ADR 0005: Verified local patches for toolchain vulnerabilities

**Date:** 2026-10-19. **Status:** Implemented on the fix branch; independent senior review Pending. This changes dependency verification, not the agreed application stack, feature scope, requirements or release approval. **Owners:** Devadathan and Mathew; no author self-approval.

## Context

The current published node-forge and braces packages have high-severity advisories with no published fixed versions. Both arrive through the approved Expo toolchain. GitHub reported an Actions service incident that delayed result publication. When the documentation job log became available, it showed `P1-TIN-001: missing member task`: an ambiguous name glob selected Tinu's standalone test manual before her member plan on Linux. The checker now selects the six exact member documents; a reversed-glob-order regression protects portability. A queued status alone is never treated as a failed or passed test.

Sources: [Forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [upstream Forge proposed fix](https://github.com/digitalbazaar/forge/pull/1152), [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [upstream braces report/recommendation](https://github.com/micromatch/braces/issues/70), [pnpm native patch mechanism](https://pnpm.io/cli/patch), [GitHub status](https://www.githubstatus.com/).

## Implementation

1. Apply exact-version pnpm patches through the committed workspace configuration and lockfile. Package versions/names stay truthful; no repackaged fake release, unknown fork, ignored advisory or disabled security test is introduced.
2. Backport the nested DigestAlgorithm cardinality check from Forge PR 1152, whose reviewed source snapshot was head `ceba34402e329f0365134f23fe19898756527d65`. The upstream PR was open/unmerged at investigation, so it is not described as an upstream-approved release. Reject extra children both with and without optional NULL parameters. Preserve valid signatures and supported omitted SHA256 parameters.
3. Limit braces parser AST container depth to 100 before recursive walkers can run. Count parentheses and mixed containers as well as braces; preserve quoted/escaped text and normal lists/ranges. Excessive nesting throws a deliberate SyntaxError with `ERR_BRACES_MAX_DEPTH`. This limit is for development glob patterns and changes no company application requirement. Hand-built untrusted AST objects must not be supplied to the library; the parser guard protects parsed string input, not arbitrary externally constructed AST graphs.
4. Keep the full registry scan. Because registry advisory matching cannot recognize modified source at unchanged base versions, verify local remediation through exact SHA-256 hashes of patch files and installed source, package identity/version, every discovered installed copy, advisory content fingerprint, and executed real-library regression tests. A known ID by itself is insufficient proof. Do not mute findings or report a clean registry scan.
5. CI uses `pnpm security:check` for the dependency decision and preserves the unmodified registry JSON as a private CI artifact for seven days. It classifies the two exact source-remediated findings as `VERIFIED_LOCAL_PATCH`; unknown/changed/unverified findings at every severity now fail. Invalid/offline audit results, missing/tampered patch or source, missing copies, changed versions/advisory scope, muted findings and failed regressions also fail. The original `pnpm audit --audit-level high` remains available and still reports the base-version findings.

## Evidence and review

Before applying patches, the security regression pack produced nine failures, including acceptance of the malformed DigestAlgorithm variants and missing depth rejection. With patches, all 15 library tests passed, including valid SHA1/SHA256/SHA384/SHA512 signatures, altered-message rejection, parameter variants, parser entrypoints, nesting boundaries and normal glob behavior. Eleven additional policy tests cover fail-closed decisions, including package aliases and uninstalled platform binaries. These are local test results; they do not imply remote Linux CI, native device acceptance, cryptographic audit or phase approval.

Senior review must examine the source changes, upstream provenance, fixtures, hashes and the patch-aware decision itself before merging. The subsequent security-automation work removed the two moderate findings using narrow fixed-release overrides; see [current evidence](../../security/DEPENDENCY_RISKS.md). All prior company requirements, team assignments, phases and production gates stay in force.

## Maintenance and removal

Review upstream status before each phase gate/release and dependency update. Prefer an official fixed release once available: remove the corresponding patch/proof record, upgrade a compatible parent/dependency, adapt regression tests and rerun frozen install, registry audit, validation, exports and device tests as applicable. Do not refresh a fingerprint solely to silence a changed advisory. A removed/obsolete patch must not silently leave an affected dependency installed. Keep the regressions after removing the backport.

Rollback is not removal of a safety fix to restore a green build. If compatibility fails, stop the affected toolchain path, preserve evidence and prepare a reviewed corrected fix. No live deployment or resource/account change is included.
