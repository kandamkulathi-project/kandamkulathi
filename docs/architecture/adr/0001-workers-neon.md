# ADR 0001 — Workers Paid and Neon PostgreSQL

**Status:** Accepted planning decision; implementation evidence Pending. **Decision owners:** Devadathan/Mathew; user-selected architecture. **Recorded:** 19 October 2026.

## Context and decision

All commerce/clinical/AI/web/native/WhatsApp requirements remain in scope, with low operating cost and roughly 1,000 daily users initially. Use Workers Paid/Hono/TypeScript for Core/Companion entry points, Neon PostgreSQL 17/Drizzle as authoritative core/clinical/engagement data, WorkOS identity, R2/Vectorize/Queues/Cron and private WebRTC/TURN integration. Use PostgreSQL during development; no D1 rewrite. Full stack and actual gates remain in [the master](../../implementation/Kandamkulathi_01_Master_Implementation_Plan_3_Phases.md).

## Consequences

Reuse PostgreSQL constraints/transactions/RLS and validate the actual serverless driver/pool/latency/extensions. Schemas share compute. Synthetic conditional Free development transitions to paid equivalent by D7; production stays awake with measured initial 0.25–1 CU tuning range, seven-day history and independent encrypted exports. Singapore/processor flows require company approval; India-only residency and premium vendor SLA are not assumed. Provider/channel/voice/store/payment/fulfillment/support labor remains distinct from base hosting; current prices/entitlements require recheck.

## Superseded alternatives

Earlier Medusa/AWS, private RDS/Cognito and D1 baselines, plus the older Neon schedule, remain in [archive](../../archive/README.md). None supplies a second execution plan. A future change requires privacy/migration/effort/retest/cost impact and reviewer approval; do not switch based solely on free-tier headline storage.

## Proof before release

Actual provider/device/reuse proof, transaction/RLS/booking invariants, full features, measured capacity/security/clinical/rollback/recovery, public channels and company acceptance. This ADR approves a design choice, not capacity or delivery results.
