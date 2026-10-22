# Actual command registry

Run from repository root with Node 24.22.1/pnpm 10.34.7. All application commands exist; their evidence covers only the starter behavior described below. Python checks are independent and use Python 3.13 standard library.

| Purpose | Command | Scope and side effects |
|---|---|---|
| Reproducible install | `pnpm install --frozen-lockfile` | Downloads exact locked packages; allowed build scripts limited by workspace configuration. No provider setup. |
| Four local web/API servers | `pnpm dev` | Loopback ports 4321/5173/8787/8788; no public deployment. |
| Individual local service | `pnpm dev:public`, `pnpm dev:workspaces`, `pnpm dev:core`, `pnpm dev:companion` | Same local services, separately operated. |
| Mobile Metro server | `pnpm dev:mobile` | Expo development server; LAN/emulator permissions may be needed. |
| Lint and formatting check | `pnpm lint` | Biome supported code/config files; docs/Python checked separately. |
| Format supported files | `pnpm format` | Writes formatting changes. Review resulting diff. |
| Typecheck all workspaces | `pnpm typecheck` | Strict TS, Astro diagnostics and Expo TS; no credentials. |
| Unit + HTTP/client boundary tests | `pnpm test` | Integer arithmetic, Hono HTTP safety, strict session/grant/return/link contracts, storage ordering, locale formatting and capture cancellation/cleanup. Node runtime and synthetic ports; not native-device/database proof. |
| Interactive focused tests | `pnpm test:watch` | Vitest watch; stop manually. |
| Build starter artifacts | `pnpm build` | Static Astro/Vite assets, Expo Android/iOS JS exports and both Worker dry bundles. Writes ignored `dist` output; no deploy/native signing. |
| Security regressions and policy controls | `pnpm test:security` | Expo-resolved Forge/braces and patch-decision regressions; mobile input/secret guards and actual Expo iOS/Android plugin introspection for local/dev fixtures. No native compilation or signing. |
| Verified dependency decision | `pnpm security:check` | Checks installed source/patch/advisory fingerprints, runs exploit regressions, scans the full registry and saves untouched JSON in ignored `test-results`. Any unremediated severity or missing proof fails. |
| Local commit gate | `pnpm precommit` | Full application/security/browser/docs verification of staged-clean inputs; refuses shared-branch commits. Installed automatically by local `pnpm install`, or `pnpm hooks:install`. |
| Security tool setup | `pnpm security:tools` | Downloads fixed official Opengrep/Gitleaks releases; verifies artifact and executable hashes. Cached binaries are rechecked before use. |
| Source/workflow SAST | `pnpm security:sast` | Offline pinned vendor/project rules over app/package/script/workflow code. Findings, invalid parsing/config and execution failure block. |
| History and staged secrets | `pnpm security:secrets` | Full fetched history and index snapshot; Gitleaks defaults with values redacted, no local waivers. CI fetches all history. |
| Local staged secrets | `pnpm security:secrets:staged` | Full Git index snapshot including forced tracked ignored files; no historical scan on every local commit. |
| Node security | `pnpm security:runtime` | Live official Node advisory/release/support checks; requires pinned actual Node, fails on unavailable/invalid feeds or security blockers. |
| Actual scanner detection tests | `pnpm test:security:scanners` | Real CLI unsafe/safe/malformed-source, staged ignored-file/inline-comment and removed-history-secret negative controls. Synthetic Git fixtures only. |
| Main application verification | `pnpm verify` | Lint → typechecks → unit/HTTP tests → security regressions/policy controls → builds; nonzero on failure. |
| Expo compatibility/config | `pnpm mobile:check` | Dependency check and public config resolution; no device/store claim. |
| Raw registry advisories | `pnpm audit --audit-level high` | Unsuppressed base-version scan; still returns nonzero for the two locally patched packages. Use with installed-source verification, never describe it as a clean scan. |
| Browser installation | `pnpm exec playwright install chromium` | Downloads the pinned test browser. Linux CI additionally installs OS dependencies. |
| Browser + actual Worker runtime | `pnpm test:e2e` | Builds, then Chromium UI/locale/mobile-width tests and actual local workerd requests; owns four ports, no reused servers. |
| CI E2E after build | `pnpm exec playwright test` | Same tests; assumes current build artifacts exist. |
| Offline SQL generation | `pnpm db:generate` | Generates SQL from reviewed Drizzle definitions. Namespaces-only starter is not an implemented schema. No connection/migration/push. |
| Docs and traceability | `python scripts/check_repository.py` | Links, 38 requirements, 109 package/branch assignments, 480 hours, case IDs, limited secret patterns and CI wiring. No app execution claim. |
| Docs guard negative controls | `python -m unittest discover -s tests/repository -v` | Ambiguous member/manual selection under reversed filesystem order, missing app CI contract, portable links, source inventory, secret redaction and fenced examples. |
| Diff/state | `git diff --check`, `git status --short --branch` | Review local state; no destructive action. |

## Continuous integration

P1-DEV-003 adds sensitive session/CSRF, current-price/payment reconciliation, consent/intake, booking/membership and lifecycle regressions to the existing unit and browser commands. [Exact local scope and pending integrations](SENSITIVE_CLIENT_FLOWS.md) distinguishes fixtures from the actual Worker 503 cases. There is no new provider execution command, native binary build or cloud dependency in these tests.

[Application workflow](../../.github/workflows/application.yml) executes locked install, verification, Expo compatibility, dependency audit and Chromium/workerd E2E on PRs/pushes to `dev`/`main`. [Documentation workflow](../../.github/workflows/documentation.yml) executes independent Python checks. Actions use pinned commits, read-only permissions, no persisted checkout credentials and no provider/deployment secrets. There is no public deployment workflow.

The independent `dependency-audit` job executes the security test pack and `pnpm security:check`, then retains the raw report for seven days. Exact source remediations are [documented](../security/DEPENDENCY_RISKS.md) with independent review Pending; all unremediated severities fail. The [security workflow](../../.github/workflows/security.yml) adds `sast`, `secret-scanning` and `runtime-security`; daily two-branch scans begin after default-branch integration. [Automation/enforcement](../security/SECURITY_AUTOMATION.md) explains clone setup, licensing, scheduled activation, included Actions minutes and the current GitHub plan/admin protection blocker. Remote results are not implied by local success.

Database/RLS/transactions/concurrency, real WorkOS sessions/MFA, live provider callbacks, native signed builds/device SDK tests, AI evals, security assessment, load/soak/recovery and phase acceptance are **not implemented by this starter**. Each responsible member must add real commands/resources/evidence with their feature. No fake passing migration, security, load or provider script exists. Clinical/finance and real-device cases remain in the canonical manual.

For each new operational/test command record workspace/runtime, inputs, provider mode/resources, synthetic fixtures/reset, expected result, side effects, owner, CI job and validated candidate. Only mark a phase/requirement Passed with its own executed evidence.
