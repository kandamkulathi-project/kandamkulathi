# Changelog

## Unreleased

### GitHub CodeRabbit completion review corrections — 2026-10-24

- Make cluster-wide runtime-role bootstrap safe across concurrent isolated databases; validate every profile after narrowly handled creation collisions and commit the role-only transaction before atomic schema/grant/ledger migration. Add real PostgreSQL collision/unsafe-role regressions and document rollback boundaries.
- Restrict the real WhatsApp sender to permitted production live mode; keep terminal notice receipts immutable and process definitive rejection without resend or fabricated acceptance.
- Release transcription concurrency for explicitly allowlisted provider rejections while retaining lifetime usage and unknown-outcome fences.
- Distinguish private-video setup failure from normal post-setup closure without weakening media cleanup or late-callback guards. Correct integrated setup and verification handoffs.
- Stabilize native/web auth PostgreSQL fixtures around the real rate-limit minute, explicitly verify legitimate rollover, and assert committed revocation at provider entry. Share real authenticated-session setup; give only the six-request expiry/logout aggregate a documented 20-second I/O budget. Production limits, provider deadlines and security assertions remain unchanged.

### Phase 1 bounded completion and review corrections — 2026-10-24 (acceptance Pending)

- Mount explicitly confirmed unpaid cancellation (0028), independently routed durable notice (0029), and native transcription with approved notices, review-only draft insertion, retained cleanup obligations and server-enforced quota/concurrency admission (0030). No policies or approvals are seeded.
- Add exact native WebRTC/plugin dependencies, relay-only browser/native adapters and isolated synthetic DO signaling; actual signed-device/TURN/provider evidence remains Pending.
- Correct CodeRabbit findings in blocked-anonymous browser action lifetimes, bounded grant retries, native reference-only checkout recovery, per-root/text-asset audit coverage, citation host validation, foreign Git environment isolation and historical phase-scope documentation.
- Preserve main browser evidence across subsequent campaigns and verify retention with the actual Playwright CLI. Give the 30-request real-PostgreSQL rate-cap case an explicit I/O budget without changing its assertions. No skipped or failing gate is treated as passed.
- Fence known browser session expiry locally as anonymous without awaiting network revalidation; retain passive-restoration denial and explicit sign-in recovery. Cover unresolved revalidation and timer-clamped deadlines without weakening the original expiry assertion.

### PR #5/#6 client history consolidation — 2026-10-24

- Preserve P1-DEV-003's uncertain-save correction: retire mutation identities after validated results or definitive rejection, retain the same identity after an ambiguous response, and correlate consent/payment recovery with authoritative reads.
- Preserve P1-DEV-003's native logout and capture corrections: sticky private-access fencing survives failed remote logout/navigation, and interrupted recording cleanup remains retryable. These historical deliveries did not establish native-device or provider acceptance.
- Preserve P1-DEV-004's source-backed editor/cited Companion and built-client security-audit history, including stale-save correlation, source/artifact checks and explicit chat/handoff identities. Integrated effect-owned lifetimes correct the original StrictMode defects; completed intentional actions retire identities while uncertain retries retain them.
- Consolidate the 2026-10-23 PR #6 dependency/conflict alignment and frontend-security corrections without treating the original heads as approved. Earlier independent review, actual APIs/providers and device/G1 acceptance were Pending at delivery; current exact-candidate evidence supersedes historical verification claims.

### Phase 1 parallel backlog integration — 2026-10-24 (verification and independent review Pending)

- Preserve existing owner implementation candidates and the incumbent interface while integrating separately authored Phase 1 changes. Company/provider/device acceptance and G1 remain Pending.
- Add an exact browser-origin mutation boundary with denial before feature execution, preserving separate authentication, current authorization and CSRF obligations.
- Add Tinu's deterministic fixture aliases, candidate-bound evidence ledger and mandatory Node QA regressions; no mock or aggregate row can grant canonical acceptance.
- Integrate canonical persisted identity/privacy, commerce/payment, booking, source-backed knowledge authoring, scoped staff reads and EN/ML/TA web/native journeys; mount actual native sign-in/consent/verified secure-vault/logout controls without fabricating provider success.
- Bind financial outbox insertion to persisted obligations/ledger/expiration references with additive migration 0026; preserve immutable migrations and existing authorization assertions. Keep uncertain expired financial work in durable financial review.
- Repair expired native privacy-session logout with narrowly bound additive migration 0027; preserve expired business-auth denial, provider-confirmed revocation and stable-key pending reconciliation. Preserve unavailable versus denied admission through Companion and booking mutation adapters.
- Publish a scoped [integration register](docs/development/PHASE1_INTEGRATION.md) and [manual testing handoff](docs/development/PHASE1_MANUAL_TESTING.md); final combined checks and independent review remain required before commit/merge. No G1 or device/provider acceptance is implied.

### PR #8 QA register correction — 2026-10-24 (independent review Pending)

- Reconcile canonical Phase 1 variant coverage, distinguish historical unverified observations from current implementation and pending acceptance, and repair UTF-8 punctuation without inventing execution or approval evidence.
- Integrate current reviewed platform/client `dev`, preserving newline-terminated runtime pins and required Expo compatibility checks. Isolate external scanner Git-hook context with unit and real-scanner controls, retaining all authored-source targets, rules and mandatory gates.
- Preserve foreground Astro supervision under agent detection so repeated browser campaigns do not leave a preview server occupying a later candidate's port.

### Mathew/platform integration — 2026-10-24 (independent review Pending)

- Merge reviewed platform PR #3 from `dev`, preserving safe configuration/logging, PostgreSQL transport infrastructure, real database CI/hooks and Core Cron/Queue handlers alongside the identity fetch boundary.
- Keep third-argument feature registration behind platform guards, preserve both Companion registrations, and extend composition regressions for explicit local test configuration and invalid-environment denial before adapter access. Business adapters and all domain/provider/clinical acceptance remain Pending.

### Local development supervision — 2026-10-23 (review Pending)

- Keep Astro dev and preview in the foreground under agent detection so `pnpm dev` does not stop sibling services after a successful background launcher exit and Playwright can supervise preview cleanup.
- Add a script contract regression and actual four-service browser/Worker lifecycle campaign to `pnpm test:e2e`; readiness and business/provider acceptance remain Pending.
- Isolate external scanners from inherited Git hook repository selectors, while preserving Git's actual candidate index. This prevents generated ignored bundles being parsed as authored source during linked-worktree commits; rules and fail-closed gates are unchanged, with real scanner and environment regressions.

### P1-DEV-001 PR #3 second review — 2026-10-23 (independent retest Pending)

- Keep successful final-publication jobs eligible for execution retries; enforce execution backoff without spending attempts on immediate duplicate delivery, while retaining deadlines and bounded budgets.
- Reject a PostgreSQL `ROLLBACK` command tag returned by `COMMIT` after a callback catches an aborted statement, rather than reporting discarded writes as success.
- Reserve backup destinations synchronously before database work; publish complete artifact/manifest pairs without replacing existing output and clean up only invocation-owned files.
- Add real PostgreSQL regression/recovery cases and command-tag unit coverage; preserve all earlier platform/Worker tests, applied migration digests and cloud/independent acceptance blockers. This fixes the retained PostgreSQL path; it does not implement or certify the separately planned D1 adaptation.
- Align Expo 58 to exact patch 58.0.17 after the SDK compatibility gate rejected 58.0.16; retain React/React Native/Node/pnpm and the existing stack.
- Carry the client branch's actual Xcode 4 security regressions with the SDK patch: require upstream legacy-uuid removal, valid project generation/round trip, collision handling and entropy failure. Remove the obsolete Xcode 3 uuid override; retain all installed-source/registry security gates.

### P1-DEV-001 PR #3 correctness fixes — 2026-10-21 (independent retest Pending)

- Reserve each transaction connection synchronously before awaiting `BEGIN`, reject overlapping/nested callers and release on every exit, including a failed `BEGIN`.
- Preserve successfully queued final-attempt work during its delivery/recovery window; keep five-attempt exhaustion, deadlines, fencing and receipt deduplication.
- Bind encrypted exports to the installed migration IDs/checksums in their consistent database snapshot and compare the restored ledger against authenticated metadata before reporting validation success. Reject newer or changed schemas with an incompatible checkout and quarantine failed restore targets.
- Add reproducing real PostgreSQL regressions, transaction/migration unit tests, a final-publication real Worker/Queue case and a linked independent retest register for Tinu. Applied migration files, company requirements, team assignments and deferred cloud setup are unchanged.

### P1-DEV-002 credentialed CORS correction — 2026-10-22 (independent review Pending)

- Align the shared HTTP boundary with the session client's credentialed requests, granting CORS only to the four existing exact local web origins in explicit local mode. Other origins and unconfigured nonlocal environments remain denied; allowed methods and session authorization are unchanged.
- Add the reproducing unmocked Chromium-to-Core 503/unavailable regression and HTTP GET/preflight/denial coverage. Keep synthetic session/grant tests and all cloud/native/provider acceptance pending.
- Refresh the six exact Expo SDK 58 patch pins required by the live compatibility check: Expo 58.0.17, Audio 58.0.10, Camera 58.0.12, Constants 58.0.13, Linking 58.0.14 and Notifications 58.1.6. Retain SDK 58, React/React Native, all other direct pins and the existing native/security checks.
- Track upstream config-plugins' Xcode 4 dependency, which removes uuid; remove the obsolete uuid override and replace its retired buffer-API test with actual native cryptographic-ID collision/entropy-failure coverage, preserving identifier and project read/write assertions.

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

### P1-DEV-002 local client foundation (review and real-device proof Pending)

- Added shared session/grant, single-use callback, notification-reference and cited-reply contracts; uncached request states and expiry/background invalidation without fake sign-in or payment success.
- Added reusable controls, workspace navigation, editable Companion draft shell, complete development label keys and bundled licensed Malayalam/Tamil fonts.
- Added Expo-matched secure storage, browser return, linking, camera/audio/notification/font modules, isolated company-input build guards and native transport/backup/background-audio policy.
- Added permission/capture cleanup regressions, actual Expo native config-plugin inspection, browser access/expiry/layout/lifecycle tests and explicit junior/domain handoffs. Cloud/provider/native SDK compilation, actual device/store proof and all phase acceptance remain Pending.

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
