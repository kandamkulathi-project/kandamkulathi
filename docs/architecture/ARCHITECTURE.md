# Architecture baseline

**Decision:** accepted planning architecture; implementation/proofs Pending. [Master](../implementation/Kandamkulathi_01_Master_Implementation_Plan_3_Phases.md) and [ADR 0001](adr/0001-workers-neon.md) govern changes.

| Boundary | Component | Responsibility / limitation |
|---|---|---|
| Public web | Astro + selective React | Public approved catalogue/content; cache safe public data only. |
| Workspaces | React/Vite | Customer/staff/physician/support; API enforces scope regardless of UI. |
| Native | Expo/React Native | Complete Android/iOS; proven real-device native auth/payment/video/voice/push adapters and public release. |
| Identity | WorkOS AuthKit | Verified sessions and required staff organization/MFA; validate real account eligibility. |
| Core API | Workers Paid / Hono / TypeScript / Zod | Deterministic commerce/clinical APIs and current-state authorization. |
| Companion | Separate Worker entry/budget | Approved retrieval/rendering/typed action proposals; cannot block core during AI outage. |
| Authoritative data | Neon PostgreSQL 17 / Drizzle | core/clinical/engagement schemas, short transactions, non-owner runtime and RLS; schemas share compute. |
| Derived public search | Vectorize plus exact/alias/keyword lookup | Approved public knowledge only; primary approval/version/safety blocks rechecked. |
| Files | R2 public/private separation | Private authenticated/expiring access; immutable source/object hashes and recovery manifests. |
| Durable work | PostgreSQL outbox + Cron/Queues | Idempotent financial/clinical/engagement obligations, leases, deadline/consent/version checks and reconciliation. |
| Consultation transport | Authenticated Durable Object signaling + WebRTC/TURN | Private membership/join windows and actual device/network/TURN proof. |
| Providers | Razorpay, Shiprocket, WhatsApp, SMS/email/push, backend OpenAI | Scoped adapters, authentic callbacks, bounded uncertainty/fallback; actual approvals/usage charges required. |

## Request/transaction boundaries

Verify identity/scope -> validate current input/consent/version -> execute short authoritative transaction with ledger/reservation/outbox -> commit -> perform/reconcile external provider work by stable operation ID. No external call holds database locks. Unknown results are explicit durable states, never blindly repeated charges. Confirmation freshness and domain invariants apply equally to web/native/WhatsApp/staff/tools.

Use a supported verified Neon driver/transaction path, pooled runtime versus controlled administrative endpoints and certificate validation. Prove locks/RLS/extension behavior on the real selected driver. No raw owner database credential in a Worker/client. No second backend/database, Redis/Kafka/Kubernetes or new auth/payment/video stack is implied.

## Environment progression

Use PostgreSQL during development, synthetic data and isolated resources. Neon Free is conditional on actual quotas/controlled dispatch, not a promise. Paid production-equivalent verification begins no later than D7. Initial production plan is Singapore, scale-to-zero disabled, 0.25–1 CU tuning range, configured seven-day history, independent encrypted exports. Region/processor approval is required; no India-only residency claim. Tune/resize against measured gates and update costs; starting size is not measured capacity.

## Established starter layout — business implementation Pending

```text
apps/web-public      apps/workspaces      apps/mobile
apps/core-api        apps/companion
packages/contracts  packages/domain      packages/database
packages/providers  packages/ui          packages/i18n
tests/unit          tests/integration    tests/e2e
```

The starter establishes these directories and `packages/server` for the shared HTTP boundary. P1-DEV-001 adds runtime isolation, telemetry, transport-only PostgreSQL tables/roles, event-scoped Neon transactions, leased Cron/Queue delivery and local recovery/release tests. Business tables/policies, provider/model integration and company-resource verification remain Pending. See [platform handoff](../development/PLATFORM_FOUNDATION.md), [starter status](../development/STARTER_STATUS.md) and [commands](../development/COMMANDS.md). Maintain interface/consumer ownership and additive migration compatibility.
