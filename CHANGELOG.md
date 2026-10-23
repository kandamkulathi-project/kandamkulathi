# Changelog

## 2026-10-23 — PR #7 cumulative candidate alignment (G1 Pending)

- Incorporate updated PR #6 at `47be5ba`, including the reviewed `dev` foundation, PR #5's review regressions and the combined navigation/explicit-operation-ID fixes. Preserve P1-DEV-090's source/build binding and negative controls unchanged.
- Correct dependency status: PR #4 is merged; PR #5/#6 remain open for independent review. Require fresh exact-head local evidence and hosted CI after the merge; prior candidate evidence is historical only.
- Cloud setup, actual backend/provider/native/operational evidence and all canonical phase acceptance remain Pending/Blocked. No shared branch, deployment, resource or approval is changed.

## 2026-10-22 — P1-DEV-090 local cumulative verification (G1 Pending)

- Added clean committed-candidate verification using the full existing gate and full-history/index secret scan, with immutable-per-run ignored evidence bundles and source/config/build/log hashes.
- Bound browser runs to source and all five build roots before/after execution; changed/missing source/artifacts fail the run. Added unit and actual-browser negative controls for false/stale/empty/drifting evidence and prepared metadata retention in application CI.
- Recorded all 20 canonical G1 groups' supporting local coverage, missing prerequisites, dependency PRs and independent handoffs. Cloud, integrated backend/provider, load/jobs/recovery/alerts, real-device and company/phase approval remain Pending; company scope, stack and six-member allocations are unchanged.

## 2026-10-23 — PR #6 dependency/conflict alignment (independent review Pending)

- Incorporate P1-DEV-003's `d779e0b` fixes and the reviewed `dev` foundation at `b71429c`, preserving the knowledge/editor/artifact-security additions.
- Combine synchronous page-navigation fencing with sticky logout blocking. Normal page restoration revalidates; navigation, visibility, expiry and persisted pageshow cannot undo logout. Extend browser coverage for both normal resume and failed-logout navigation.
- Retain replay-aware consent/payment tests and retryable native audio cleanup. Cloud, provider/device integration, independent review and phase acceptance remain Pending.
- Preserve explicit chat/handoff operation IDs as their request keys across replay, retaining the original stable-message assertion and adding committed-response-loss/duplicate-click coverage; later distinct actions still use new IDs.

## P1-DEV-003 review corrections — 2026-10-23 (independent review Pending)

- Retire mutation keys after validated results or definitive rejections; preserve ambiguous retries. Add replay-aware consent withdrawal and receipt-free payment polling regressions, including a server-committed lost response.
- Preserve the local logout block across visibility, page restoration and automatic expiry; explicit user retry remains available. Extend browser coverage to assert no passive session reads or private-content restoration.
- Retain independent stop/deletion obligations after recording cleanup failure, retry unfinished work and block new capture until cleanup succeeds. Cover failed stop, deletion, partial preparation and disposal; installed-device evidence remains Pending.
- Incorporate the reviewed PR #4 squash merge from `dev`, resolving foundation conflicts without merging this feature or changing company requirements, stack, assignments or phase gates. Add Tinu's independent retest register.

## 2026-10-22 — P1-DEV-004 local frontend security (integration/review Pending)

- Added structured public knowledge draft/review/withdrawal shells, independent approval controls and strict current-source cited Companion rendering on web/native. Safety blocks remain approved plaintext; unsupported actions execute nothing and human help is only explicitly queued.
- Added version/expiry/source/session negative regressions, including expiry while parallel references load, unsaved editor review, refresh concurrency and pagehide suspension. Actual local Worker 503/CORS cases remain unmocked.
- Added built-client artifact auditing to free local/CI security gates, restrictive workspace frame/cache headers and exact-origin native credential transport. Preserved the stack, canonical requirements, six-member plans and Pending cloud/backend/native/company/independent acceptance.

## 2026-10-22 — P1-DEV-003 local sensitive clients (review/integration Pending)

- Recheck operation expiry at actual SDK launch after asynchronous setup. A permanent Chromium regression first reproduced checkout opening after expiry while its script was delayed; shared/native/browser deadline guards now prevent it and retain server reconciliation.

- Added strict proposed consent/security/payment/booking/intake/membership contracts, session-bound uncached requests, CSRF/idempotency preparation, synchronous duplicate protection and stale-response fencing.
- Added minimal web/native consent and clinical views, current-price checks before Razorpay checkout, server-only payment reconciliation, booking expiry and consultation access/expiry controls. Optional marketing remains separate; no diagnosis or private-call success is fabricated.
- Pinned the official native Razorpay adapter and retained the agreed stack. Native compilation/devices, actual APIs/providers/signaling, cloud setup, independent review and all phase acceptance remain Pending.
- Added permanent unit/HTTP/Chromium boundary regressions, including an unmocked sensitive POST to the unavailable local Worker. Recorded the PR #4 base dependency and owner/Tinu handoffs in `docs/development/SENSITIVE_CLIENT_FLOWS.md`; canonical company requirements, six-member plans and gates are unchanged.

## Unreleased

### PR #7 committed-source integrity — 2026-10-24 (independent review Pending)

- Reject assume-unchanged/skip-worktree masking, including unmodified files and missing/malformed masking evidence, without changing users' Git flags or weakening source/build parity checks.
- Add deterministic masked-source and real browser-free reporter CLI regressions; keep prior hosted evidence historical, not an allegation that its bytes differed.
- Integrate repaired native logout, correlated draft recovery and reviewed PostgreSQL platform gates. Preserve both candidate metadata retention and actual PostgreSQL CI; real domain/provider/device acceptance remains blocked.

### PR #6 uncertain-save correction — 2026-10-24 (independent review Pending)

- Preserve immutable pending draft input and the transmitted operation identity after lost or uncorrelated responses; lock new intent/review until explicit recovery and clear recovery on authorization/lifecycle denial.
- Correlate successful save responses before retiring wire idempotency keys; add unit and browser regressions for committed-but-lost creation, mismatched updates, definitive recovery and stale responses.
- Integrate the corrected native logout lifecycle and reviewed platform predecessor without discarding Companion cleanup, configuration/telemetry or PostgreSQL gates. Synthetic browser fixtures echo submitted documents instead of fabricating absent content.
- Keep Astro foreground supervision under agent detection, preventing an orphan preview from occupying the next candidate's test port; retain strict non-reuse in browser gates.
- Keep server-rendered locale controls disabled until hydration attaches handlers and give loaded draft text a stable accessible label; regression tests retain real locale and conflict-recovery assertions.

### PR #5 native logout correction — 2026-10-24 (independent review Pending)

- Preserve local logout denial across passive native lifecycle refreshes, including combined remote logout and credential-removal failures; only explicit revalidation may retry access.
- Add reproducing native-controller/component journeys while retaining the supported-device acceptance requirement; synthetic native tests do not establish real SecureStore or device behavior.
- Integrate reviewed platform `dev` without discarding its environment guards, Cron/Queue handlers or real PostgreSQL gates. Isolate external scanners from inherited Git-hook selectors, with environment and real-scanner regressions; preserve staged-index selection and all fail-closed checks.

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
