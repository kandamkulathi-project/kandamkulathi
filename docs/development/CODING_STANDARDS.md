# Coding standards and interface discipline

## Contracts and module boundaries

Use strict TypeScript and reviewed typed validation at every API/event/provider/tool boundary. Keep shared contracts/version/error/current-state/idempotency semantics in one package; validate untrusted payloads without accepting actor/clinic/price/role as authority. Use explicit success/pending/conflict/forbidden/reconciliation states. No unchecked `any` to hide unsafe external data. Pin dependencies/lockfile; upgrades changing contracts/SDK/driver/model behavior need official compatibility evidence and relevant retests.

Domain services own deterministic money/stock/booking/clinical/credit rules; clients render current state and providers are adapters. Do not copy tax/permission/dose logic into web/native/chat screens. Use focused modules with clear ownership rather than premature independently deployed microservices. Sensitive code gets independent senior review.

## Money, data, time and jobs

Integer paise with finance-approved rounding/series/currency; quantities validated; UTC instants with explicit clinic timezone and approved boundary precision. Named immutable versions/audit/reference IDs. Short PostgreSQL transactions, no network inside locks, checked guards/constraints and domain/outbox atomicity. Stable operation IDs and unknown-result reconciliation; no random new key used to blindly retry money effects. Jobs recheck consent/version/deadline and suppress obsolete work; priority/capacity is bounded.

## UI/native/locales

Use approved reusable components/query adapters/resources. EN/ML/TA whole-application labels, fonts and approved medical translations; no hardcoded clinical wording. Include loading/empty/error/forbidden/conflict/pending/offline/resume paths, keyboard/focus/labels/text scaling/touch targets. Safe rendering, private cache/logout and authenticated deep links. A button-disabled state is not a security control. SDK/payment/video/voice/signing changes remain with Devadathan and relevant backend owner.

## Errors and observability

Return reviewed safe contract errors with operation/request IDs, not stack traces/keys/health payloads. Redact log/analytics/private links; keep clinical investigation evidence restricted. Preserve original provider/domain history and unknown obligations. No swallowing failed guards, missing consent or webhook mismatch to create UI success.

## Tests and review

Use approved deterministic synthetic oracles. Assert public behavior and persisted/provider invariants, not an implementation mirror. Real PostgreSQL role/RLS/race tests and real-device SDK proofs are needed where those are the claim. Cover negative/expiry/replay/concurrent/fault cases appropriate to changed risk. Do not add costly irrelevant repetition after checks pass; broader repeated campaigns are justified by affected evidence/new failures. Changes to gates, expected medical/finance rules or fixtures require reviewer/domain justification.

Keep changes bounded. Document why a difficult rule exists near its code. Remove unused code only within scope, never refactor unrelated work to make a small change convenient. Update schema/contracts/test/runbook/ADR and changelog together when behavior changes.
