# P1-DEV-001 implementation and evidence

Owner: Devadathan. Required independent reviewer: Mathew. Branch: `feature/p1-devadathan-platform-foundation`; base is updated `dev` including PR #2. This record supplements the assigned plan and does not change company scope or phase gates.

## Baseline inspection

Already implemented: locked runtimes/dependencies, five runnable clients/services, shared HTTP safety boundary, unit/browser/local-workerd tests, lint/type/build checks, SAST, secrets/runtime/dependency scanning, local commit gates and daily security workflow definitions. PR #2 is merged into `dev`. Shared branches are still not protected because of the private repository's GitHub plan restriction. Schedules activate when their configuration reaches the default branch.

Previously missing: runtime environment isolation, database implementation, durable transport, safe telemetry, deployment/recovery commands and actual resource evidence. Authentication and business/clinical policies belong to Mathew/Josin's packages; no placeholder domain handler may report successful execution.

## Environment configuration

`packages/server/src/config.ts` validates explicit environment, resource namespace and provider mode. Live payments/sends are denied outside production; production requires a separate explicit grant for each live operation. Administrative database URLs and recovery keys are rejected in Worker bindings. Missing database credentials do not imply readiness. Every future provider adapter must call the permission guard immediately before a side effect, in addition to its domain authorization and idempotency checks.

`config/environments/*.json` inventories ten distinct environment-prefixed resource names. These are planned identifiers, not assertions that company accounts or resources exist. A provisioned manifest requires actual account, Neon project/branch, paired direct/pooled endpoints, region and restricted evidence reference. Use a unique preview namespace per independent preview; no production resource can be inherited. Manifest structure alone does not independently verify company ownership or remote isolation.

`scripts/platform/render-config.mjs` renders an ignored standalone Wrangler config from an inventory for Core or Companion. It declares separate public/private R2 buckets, three operational queues and three DLQs, bounded consumer concurrency/retries, and a one-minute staging/production Cron. Preview/dev periodic dispatch is disabled to avoid uncontrolled compute usage. Core resources are not bound to Companion. No credentials are read into generated configuration; no `--remote`, resource creation or deployment is performed by generation. Rendering a planned manifest is useful for dry builds; actual deployment requires provisioned evidence and review.

## Telemetry and availability

Structured records allow only event/service/environment, server UUID correlation, categorical route, status and bounded timing. URLs, query parameters, authorization, cookies, bodies, prompts, provider exceptions and clinical data are never serialized. Native invocation logging and traces are disabled in rendered configurations; query-string redaction is also enabled. Logging sink failures do not retry completed work. Review platform-managed exception/tail retention separately before handling private data.

The core HTTP SLI uses eligible API responses (2xx/3xx and 5xx), excluding health/system routes and intentional 4xx responses. Thirty-day availability is `1 - sum(sliFailure)/sum(sliEligible)`; zero samples mean no evidence. Internal objective is 99.9%; planned maintenance is included unless the company explicitly approves and records an exclusion. Service owner: Devadathan; incident backup: Mathew. A starter's unavailable API responses count as failures, not achieved availability. Actual dashboards, alert routing/receipt, retention, costs and a full thirty-day observation remain external verification.

Queue pickup uses database server `clock_timestamp()` for due and claim timestamps. The healthy p95 objective is less than 120 seconds; sample count, late claims, expired/suppressed jobs and fault/backlog recovery must be reported separately. Never remove slow successful eligible jobs from the denominator. This objective does not override consent, revision, deadline or financial reconciliation rules.

## Acceptance status

Code/test evidence is recorded with the implementation commits. Company-owned resource provisioning, actual Worker-to-Neon transport/role proof, independent security review, restricted secret storage, real alert receipt, encrypted export in independent company storage, R2 byte/hash verification, paid configuration and timed deployed rollback remain Pending until executed on isolated approved resources. Local PostgreSQL proof is not live Neon proof. G1 and all company requirements remain Pending.

## Local implementation completion matrix — 2026-10-20

The user explicitly selected **finish locally; cloud setup Pending**. The following records implementation boundaries rather than changing the assigned package's acceptance criteria.

| Assigned portion | Implemented local result | External/integration acceptance still required |
|---|---|---|
| Environment/secret/resource separation | Validated modes, namespaces, same-target/distinct runtime logins, forbidden administrative secrets, paired endpoint inventory and separate Core/Companion config rendering | Company ownership, actual resource IDs/isolation, restricted secret storage/rotation and actual bindings |
| Existing CI/security/branch gates | PR #2 baseline reused; real database/Worker transport tests added inside `application-checks` and the local commit gate | Independent review, new remote CI run and GitHub plan-supported branch protection; schedules still require main integration |
| PostgreSQL/Drizzle/non-owner roles | Generated schema plus custom constraints/roles/RLS/column grants, exact migration digests, serialized guarded runner, real Neon-driver sessions | Hosted Neon pooled/direct TLS, region/permissions/extension proof; business tables and verified identity/clinical scope remain Mathew/Josin's work |
| Atomic outbox/queues | Shared transaction enqueue, canonical UUID references, `SKIP LOCKED`, fenced 30-second leases, bounded batch publication and current-state decision interface | Actual company Queues/Cron delivery, domain handlers/provider-operation reconciliation, production quota/latency evidence |
| Retry/crash/duplicate/reclaim/DLQ | SQL effects/receipts atomically committed; partial publish, fast consumers, duplicate delivery, crash/rollback, stale fencing and retry exhaustion tests | Actual DLQ retention/alert/redrive proof with current domain rules; dead transport never resolves a financial obligation |
| Synthetic fixtures | Fresh random test DBs/logins plus local-only probe seed/reset preserving domain obligations and refusing active leases | Approved domain fixtures/seeds owned by Mathew/Josin; no company data imported |
| Observability/availability/alerting | Metadata-only logs, core failure denominator including misconfiguration, first-claim pickup reporting, no fake coverage/pass and local receiver acceptance test | Real dashboards, retained 30-day aggregates/coverage, backup/DLQ/spend alerts and named recipient receipt |
| Backup/restore | Restricted role, consistent snapshot, streaming AES-256-GCM, bound migration/object metadata, full authentication before restore, empty separate target, grants/RLS/receipt/control checks and tamper/wrong-key rejection; actual local R2 public/private separation and content-addressed byte/hash recovery test | Independent company storage/key access, actual company R2 recovery, approved domain totals, real PITR/account-loss/timed resume proof |
| Versioned deployment/rollback foundation | Fresh dry-built frozen Worker artifacts, source/inventory/migration hashes, database target lock and API/schema compatibility tests | Remote deployment runner/credential wiring, approved route configuration, actual prior-version deploy/rollback and timed business/device/provider smoke |
| Initial load harness | Real k6 2.3.0 loopback-only liveness smoke: five users, 30 seconds, 150 successful requests, no failures, p95 about 33 ms | Final Indian-client/mixed business workload, 60/120 rps/soak, retained data and AI/video/provider concurrency; no daily-user capacity certification |

Dispatcher guardrails now use up to 100 references per broker batch, round-robin channel selection, and at most 1,000 claims or 20 seconds of dispatch work per Cron run. Empty channels stop the loop; no busy polling runs between Cron events. These are engineering caps to be profiled/tuned, not measured production throughput. A local real-workerd test drains a 30-job spike across all three queues in one dispatch, with one durable effect/receipt per job. Record saturation/backlog/claim metrics and reforecast if intended production demand exceeds measured capacity.

## Handoff and evidence discipline

First foundation commit: `994512c` (environment/telemetry/resource isolation); the subsequent transport/recovery implementation carries its tests and this updated record. Exact current commit references and executed result summaries are recorded in delivery. Restricted full logs, ciphertext, temporary native tools and generated manifests stay ignored; no key, password, production data or signed binary enters Git. New hosted CI is not implied by local checks. No source-patch/security finding is suppressed.

Transport/recovery commit `2fa4c03` passed the full local gate and actual artifact preparation/dry builds. Follow-up preflight review added a reproducing PostgreSQL regression for an unexpectedly inherited server-file role: it failed against the earlier validation and passed after runtime/backup validation was shared and restricted to the single expected role profile. Bootstrap now also refuses profiles inheriting other roles. A real synthetic Git repository tests dirty inputs and a changed clean revision during artifact preparation. These guards do not modify applied migration digests or authorize a cloud deployment.

Mathew independently reviews migrations/role boundaries, driver/transaction behavior, current-state handler contract, retry/reconciliation assumptions and recovery controls. Josin validates the eventual financial/stock/provider totals; Tinu runs the canonical phase cases after integration. The local RLS/consent/version fixtures are synthetic driver/contract proofs, not completed WorkOS or clinical authorization. P1-DEV-002 shared UI/native SDK work remains a separate assigned branch/package.

Verified implementation references: [Neon driver configuration](https://github.com/neondatabase/serverless/blob/main/CONFIG.md), [Cloudflare Queue configuration](https://developers.cloudflare.com/queues/configuration/configure-queues/), [Queue retries/DLQs](https://developers.cloudflare.com/queues/configuration/batching-retries/) and [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/). The pinned installed tools/actual local executions are the evidence for this code; vendor documentation is not a substitute for company-resource verification.
