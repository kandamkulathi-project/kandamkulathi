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
