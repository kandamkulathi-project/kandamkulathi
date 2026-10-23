# Starter status and first handoffs

**Baseline:** 2026-10-19. Purpose: give all six members the same runnable code and reviewed documents. No G1/G2/G3 approval, completed requirement, live service or production deployment is implied. All R01–R38 and existing assignments remain required.

**Mathew local backend candidate, 2026-10-23:** identity/consent authorization, deterministic booking intents, approved public knowledge checks and authenticated WhatsApp ingress contracts have unit/HTTP and fail-closed Worker test coverage. Successful synthetic ports/intents do not prove WorkOS, PostgreSQL/RLS/concurrency, physician approval or provider delivery. Default business integrations remain unavailable. See [handoff and remaining work](MATHEW_BACKLOG_HANDOFF.md); independent human reviews and all package/phase acceptance remain Pending.

**P1-DEV-002 local update, 2026-10-20:** [Client foundation](CLIENT_FOUNDATION.md) implements shared state/session/return/link contracts, bounded capture/cleanup, native storage/configuration adapters, reusable UI and offline language fonts. Company/provider/cloud/real-device/native-build proof remains [Pending](../operations/NATIVE_READINESS.md). JavaScript/config-plugin tests do not establish native SDK or phase acceptance.

**Audit status:** the original two high Expo-toolchain findings have local source backports and executed regressions, with independent review Pending. The registry still reports the original base versions; the two moderate findings are addressed by a targeted esbuild override and upstream Xcode uuid-dependency removal, with real parent-resolved tests. [Dependency remediation](../security/DEPENDENCY_RISKS.md) and [ADR 0005](../architecture/adr/0005-toolchain-security-backports.md) explain the verified-source decision and unchanged raw findings. A passed verification check is not upstream remediation, independent review or phase approval.

## Implemented foundation

Twelve application/shared workspaces plus the private repository root: five applications and seven shared packages, exact dependency lockfile, supported Node/pnpm pins, strict TypeScript, Biome, unit/HTTP tests, browser/local-workerd smoke tests and read-only GitHub CI. Public/workspace/mobile development screens share EN/ML/TA development labels. API errors carry server-generated request IDs and no-store headers. Only status/liveness endpoints return success; readiness stays unavailable. No role selector grants access and no provider adapter simulates a successful side effect.

`packages/server` centralizes the HTTP boundary for the two isolated Workers. It is neither a verified identity layer nor domain authorization. `packages/database` supplies Drizzle namespace declarations only; no credentials, tables, migration, runtime connection or RLS exists. `packages/providers` reports unavailable; it is not a fake payment/AI/auth adapter. The small integer-paise helper supplies validation, not tax/pricing/stock/ledger policy.

## First handoffs by member

| Member | Work from assigned P1 branch and plan | Starter boundary to extend |
|---|---|---|
| Mathew | Identity, scope/RLS, clinical/backend and safe Companion contracts | `apps/core-api`, `apps/companion`, `packages/server`, `packages/contracts`, `packages/database`, `packages/providers`; replace only reviewed unavailable routes, backed by real tests. |
| Devadathan | Platform/frontends/native SDK/device proof and release interfaces | Three client apps, shared UI, scoped config, preview/staging and CI; independently review Mathew's sensitive changes. |
| Josin | Commerce tables/domain/APIs and provider lifecycle under Mathew review | Domain modules, database commerce definitions, Core commerce routes and reviewed client adapters. No client-authoritative pricing or fake paid status. |
| Paul | Bounded customer presentation and device support from supplied contracts | Devadathan-approved screens/components; no identity/payment/native SDK shortcuts. |
| Denzil | Bounded admin/content/locales/report/SEO presentation and guides | Reviewed shared labels/content fixtures, public/workspace screens and documentation. Development labels are not approved medical translation. |
| Tinu | Fixtures, execution/retest and broad phase evidence | Run starter checks, then the complete applicable canonical cases. Missing feature = Blocked/Not implemented, never Passed. Owners provide real domain oracles and specialist execution. |

Use [the member index](../implementation/INDEX.md) for exact package IDs, branches and hours; this handoff adds no separate allocation or alternate branch names. Base each feature on the latest `dev`, PR back to `dev`, then run the full applicable phase campaign before milestone promotion.

## Explicitly Pending

- Every company business journey: catalogue/stock/cart/order/finance/wholesale/referral/subscriptions, clinical bookings/records/video, human support, approved multilingual medical Companion and all channels.
- Neon PostgreSQL 17 runtime driver, non-owner roles/RLS/context cleanup, migrations/seeds, transactional locks/invariants/outbox and real database CI. No alternative development database is used.
- WorkOS verified identity/org/MFA, private route/file/object authorization, secret/environment policies implemented in code.
- Razorpay/Shiprocket/WhatsApp/SMS/email/push/OpenAI/video adapters and real signed callback/uncertainty/reconciliation cases. `.env.example` keys alone enable nothing.
- Approved content/assets/translations, domain policies/oracles, source licensing, accounts and processing/residency approvals.
- Native identifiers/signing/development builds, Android/iOS actual-device SDK proof and public releases. Current Expo export is JavaScript bundle validation only.
- Cloudflare resources/bindings, paid plan/account setup, Neon resources and controlled migrations, observability/redaction/alerts, deployment/rollback/restore, rate limits, abuse controls and all production budgets.
- Full security, clinical/finance/AI evaluation, concurrency, load/soak/recovery, UAT/training and phase-gate evidence. Starter CI cannot establish 1,000+ daily-user capacity.
- Active GitHub branch protections/required reviews and real CODEOWNERS handles. The example ownership file remains inactive.

The health endpoints describe only this scaffold: `/health/live` 200 means HTTP execution is alive; `/health/ready` 503 means application readiness is missing. Before implementing a ready state, define all mandatory dependency health, accepted config and failure semantics in the same change. Never change 503 to 200 merely to satisfy a hosting health probe. CORS presently permits the four exact loopback web origins only when `APP_ENV=local`; CORS is not authorization. Production CORS and identity are separate reviewed work.

## Verified compatibility sources

Local bootstrap checks on 2026-10-19 passed: lint, strict typechecks (including Astro diagnostics), 23 unit/HTTP tests, both web builds, both Worker dry bundles, Android/iOS JavaScript exports, Expo compatibility/configuration, four Chromium/local-workerd smoke tests, documentation traceability and five documentation guard tests. The original registry audit failed with four findings. The follow-up fix adds 15 library regression tests, eleven proof-policy tests and exact-version local security patches; the raw report remains unchanged. See ADR 0005 for the before/after evidence and review boundary. Native installation/device tests, real database/provider tests and all phase gates were not run. Remote Linux CI is a separate result; file creation/local success does not establish it.

Versions were checked against official documentation and npm metadata at bootstrap, then locked and exercised. [Astro prerequisites](https://docs.astro.build/install-and-setup/), [Expo SDK compatibility](https://docs.expo.dev/versions/latest/), [Expo monorepos](https://docs.expo.dev/guides/monorepos/), [Hono Workers](https://hono.dev/docs/getting-started/cloudflare-workers), [Workers local tool requirements](https://developers.cloudflare.com/workers/wrangler/install-and-update/), [Drizzle/Neon transaction choices](https://orm.drizzle.team/docs/connect-neon) and [Node releases](https://nodejs.org/en/about/previous-releases). TypeScript 6 is retained because the selected Astro checker declares support for TS5/6. Expo 58 uses React 19.3/React Native 0.88; native package changes must follow Expo compatibility checks.
