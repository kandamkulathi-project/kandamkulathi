# Changelog

## Unreleased

### P1-DEV-001 PR #3 correctness fixes — 2026-10-21 (independent retest Pending)

- Reserve each transaction connection synchronously before awaiting `BEGIN`, reject overlapping/nested callers and release on every exit, including a failed `BEGIN`.
- Preserve successfully queued final-attempt work during its delivery/recovery window; keep five-attempt exhaustion, deadlines, fencing and receipt deduplication.
- Bind encrypted exports to the installed migration IDs/checksums in their consistent database snapshot and compare the restored ledger against authenticated metadata before reporting validation success. Reject newer or changed schemas with an incompatible checkout and quarantine failed restore targets.
- Add reproducing real PostgreSQL regressions, transaction/migration unit tests, a final-publication real Worker/Queue case and a linked independent retest register for Tinu. Applied migration files, company requirements, team assignments and deferred cloud setup are unchanged.

### Node 24 security runtime update — 2026-10-21

- Updated both runtime pins and the installation minimum to Node 24.22.1 after the official release feed identified it as a security release. The Node 24 stack and pnpm pin are unchanged.
- Added a regression for patch-release blocking, consistent developer/CI pins and rejection of the superseded runtime; runtime security verification remains fail-closed. [Official Node release feed](https://nodejs.org/dist/index.json).

### P1-DEV-001 local platform foundation (independent review Pending)

- Added isolated environment/resource/provider guards, approved-field telemetry, SLI reporting and a local synthetic alert receiver test.
- Added Neon PostgreSQL 17 event-scoped transactions, separate non-owner roles, immutable controlled migrations, transport RLS/column controls and leased/idempotent Cron/Queue delivery with explicit retries/DLQs.
- Added consistent-snapshot AES-256-GCM export, isolated authenticated restore, synthetic probe seed/reset, target deployment locks and versioned artifact/compatibility/dry-build tooling.
- Added real PostgreSQL and local workerd Cron/Queue E2E checks to the existing application CI and local commit gate; added a loopback-only k6 liveness smoke and setup/handoff evidence.
- Fixed CI's missing PostgreSQL 17 client package by configuring the official signed PGDG source before the fallback installation; repository regression checks reject missing or unauthenticated sources.
- User selected local completion. No company provisioning/deployment, hosted database/alert/rollback proof, domain completion or phase acceptance is implied.

### Security automation (independent review Pending)

- Added checksum-pinned free Opengrep/Gitleaks scans, fixed vendored rules, live official Node security checks and real scanner negative controls.
- Added local commit gates, daily two-branch security workflow and weekly dependency/action update PR configuration. Scheduled/default-branch activation still requires reviewed integration into main.
- Removed moderate esbuild/uuid findings using narrow parent/version overrides, with actual Drizzle transform, esbuild CORS, UUID bounds and Xcode parser/writer regressions. Every unremediated severity now blocks dependency verification; two existing proven local high patches remain visible.
- Prepared required-check/review branch policies. GitHub rejected access/entitlement: this private repository needs an eligible plan and repository-admin activation. No remote protection, reviewer approval, phase acceptance or production deployment is claimed.

### Added

- Repository-wide AGENTS instructions and contributor/security guidance.
- Reviewed current master, phase/member plans, canonical QA cases and integrated review.
- Architecture/ADR, data/security, development, testing, operations and handover documentation.
- GitHub PR/issue/CODEOWNERS templates and pinned documentation-check workflow.
- Portable repository/document checker and explicit readiness registers.

### Status

Application starter and local platform implementation exist with the scoped evidence above. No released version, company production deployment, provider approval or phase acceptance is claimed. Record subsequent changes with R/package IDs and actual validation evidence.

## 2026-10-19 — Initial application starter

- Added pinned pnpm/Node monorepo with public/workspace/mobile previews, separate local Workers, shared typed boundaries and real application CI.
- Added integer/HTTP tests, Chromium/local-workerd smoke tests and explicit unavailable/readiness behavior; no live provider actions.
- Kept reviewed requirements, six-member work assignments, branches and Tinu cases unchanged. Recorded the user-authorized initial main/dev baseline exception. All business features and phase acceptance remain Pending.

## 2026-10-19 — Toolchain security follow-up (review Pending)

- Added exact-version pnpm source patches for the two high Expo-toolchain findings, preserving all direct versions, stack choices, company requirements and team assignments.
- Added real-library signature/glob regressions and fail-closed proof-policy controls. Original vulnerable libraries failed nine cases before patching; the 15 library tests passed after patching.
- Replaced the registry-only dependency decision with installed-source/patch/advisory proof plus executed regressions and a fresh full scan. Raw findings remain visible and are retained as a CI artifact; moderate findings remain Open.
- Fixed the Linux documentation failure `P1-TIN-001: missing member task`: the checker now selects the six exact member documents instead of an order-dependent name glob that could choose Tinu's standalone test manual. Added a reversed-order regression test.
- GitHub's Actions incident delayed result publication. Remote verification and independent senior review remain required before merge.
