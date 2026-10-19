# API, event and provider contract conventions

**Owners:** Mathew for identity/clinical/tools; Josin for commerce; Devadathan for client/platform integration. Actual routes/header names/schema versions/OpenAPI/request collections must be frozen in the scaffold/domain PR. This is a design contract, not a claim that endpoints already exist.

## Request authority and validation

Validate external shape/size/type/encoding at the boundary using shared typed schemas. Identity comes from verified session/organization/MFA and current server scope, not payload actor/clinic/role. Explicitly distinguish public from customer/staff/physician/report/tool/file routes. Never accept client price/tax/eligibility or a model-selected permission as authoritative. Validate private object/media ownership and link expiry independently of route visibility.

Record for each operation: required actor/scope, input schema, permitted current states/version/consent, idempotency semantics, success/pending/conflict/denied response, domain/outbox/provider effects, safe error code and operation/request IDs. Hide private resource existence according to the reviewed 401/403/404 contract; do not guess a different status in frontend tests.

## Mutation and retry

Bind stable business operation identity to actor, intent and current server state; freeze the actual request header/body convention in OpenAPI. An idempotency key is not permission. Repeating the same authorized operation returns its real outcome without duplicate side effect; reusing the identity for a changed operation is rejected under the defined contract. Tool confirmation additionally binds actor/amount/product/slot/version/expiry, with explicit customer review and one-use checks.

Use integer paise, strict quantities and approved UTC/clinic-time boundaries. Commit authoritative ledger/stock/booking/credit/outbox atomically with bounded concurrency handling. External provider calls occur outside locks. Document uncertain COMMIT/provider replies as pending/reconciliation states; a lost reply must not cause a new charge/booking/shipment. Browser callbacks never mark paid.

## Response, list and export behavior

Use consistent typed error/current-state codes and safe human messages, with redacted operation/request references. No stack trace/secret/private record in public errors. List/report endpoints require scoped pagination/filter bounds, deterministic order and freshness definitions; no unbounded clinical/financial export. Escape hostile rendered/CSV text and authorize file bytes/current private links. Show truthful loading/empty/forbidden/conflict/pending/offline/retry state in every required client/locale.

## Events and callbacks

Version events with business ID, entity/version/type, actor/scope reference, creation/due/deadline and minimum required payload. No raw health text/private bearer link in general queue/analytics. Verify raw-body provider authenticity/account/amount/currency/reference and permitted current transition. Deduplicate semantic effects even across different delivery IDs; keep receipt/reconciliation/audit history.

Consumers verify current ownership/consent/version/deadline before effects, use leases/bounded retry/DLQ and reconcile unknown provider results before redrive. Separate financial/clinical progress from marketing backlog. Invoice-ready notices, stock/order updates, schedules, callbacks, campaign and usage facts share these durable controls; no disconnected screen-only success.

## Compatibility and evidence

Version schema/API/tool/provider changes and update every web/native/WhatsApp/job consumer. Preserve prior supported native contracts through additive migrations/rollout/rollback. Publish actual collection/UI map/fixture/oracle/driver/SDK/provider-mode manifest to Tinu and client owners before acceptance. Positive, denied, changed-state, replay, expiry, concurrent and fault cases assert persisted/provider totals as well as UI/status. Update the canonical cases and ADR/runbook when a contract changes.
