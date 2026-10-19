# Data model and invariant requirements

This is the schema design contract, not executed DDL. Mathew/Josin design and Devadathan operates reviewed migrations; Drizzle definitions and actual migration IDs must be added during scaffolding. [ADR 0002](adr/0002-domain-transactions.md) and canonical tests govern proof.

| Domain | Required entities / source of truth | Constraints / oracle |
|---|---|---|
| Identity/scope | customer, staff organization/role, clinic, patient/guardian, assignment, session mapping, consent/version/audit | Verified identity; non-owner runtime; transaction-local role/clinic/patient/owner context; pool-error cleanup. No client-selected role. |
| Commerce | SKU/variant/concern, price/tax, cart, order/source/history, line, payment/refund/invoice/credit-note ledger | Money integer paise, stable operation/provider references, current authoritative totals, finance-approved rounding/numbering/state. |
| Inventory | location, batch/expiry/recall/shelf life, reservation/hold, stock movement/adjustment, transfer dispatch/receipt | FEFO eligible stock, deterministic locks, checked guards, nonnegative availability, all-or-nothing multi-item effect, traceable returns/recall. |
| Appointments | doctor/public approved profile, clinic hours/leave/fee/type/slot/buffer, hold/confirmation/cancel/reschedule/refund | Doctor-global interval exclusion including buffers across clinics, reviewed btree_gist/GiST, valid adjacency, explicit expiry/late-payment obligations. Staff OP booking shares canonical lifecycle. |
| Clinical | consented consultation/notes, signed versioned recommendation, physician schedule/dose/unit/food/timezone/refill | Assigned permitted record/past-order scope, immutable signed versions, current recommendation-to-cart checks; no assistant dose edit. |
| Knowledge | source/provenance/hash/type/scope/language, draft/approval/version/withdrawal, mandatory safety translations | All required products/public physician profiles covered; primary current approval authorizes output. Public vector index derived only. |
| Engagement | channel identity-link, thread/current agent/callback/unanswered state, transcript/media expiry, opt-in, segment/campaign/cart-reminder | Authenticated link proof; no phone matching alone; bot race suppression, no unchecked transcript action; current consent/quiet-hour/deadline/suppression. |
| Commercial growth | bundle/course allocation, distributor approval/MOQ/pack/terms, referral/credit/reversal ledger, verified review/moderation | Current terms/eligibility/caps, one award/reversal, no self-upgrade/overdraw/consult-only bypass; finance approves fixtures. |
| Jobs/reporting | outbox/claim/lease/provider reconciliation/DLQ, immutable facts, projections/usage attribution | Durable obligation + at-most-one authorized business effect; retries/faults retain obligations. Reports reconcile replay/refund; KB usage uses a defined deduplicated entry/version metric. |

## Shared conventions

- Use immutable identifiers, explicit FK/check/unique/version constraints and audit references. UTC instants plus explicit clinic timezone; approved half-open/time-boundary policy; supported timestamp precision recorded.
- Transactions short; lock resources in deterministic order, use bounded retry and verify affected row counts. Order/stock/payment/booking/credit/outbox atomicity is tested on real PostgreSQL/driver, not inferred from mocks.
- Runtime, migration, backup and report roles are least-privilege and separate. RLS context is transaction-local and reset on rollback/error/pool reuse. Owner bypass credentials are never used to “prove” runtime privacy.
- Keep private clinical/customer fields out of public caches/RAG/analytics; use minimal consented summaries. Issued/signed financial/clinical history is amended through approved auditable versions, not silently overwritten.
- Every external effect has a stable business identity, provider reference, permitted state transitions and uncertain-result reconciliation. Deduplicating delivery IDs alone is insufficient when semantic effects can be delivered with different event IDs.
- Retention/guardian/deletion/financial retention is company-approved policy. Seven-day recovery history is not the clinical retention period. Include private R2 object version/hash manifests in restore validation.

## Migration PR requirements

Record requirement/package, ordered migration ID, lock/latency/volume impact, forward compatibility, backfill ownership/restartability, old-client/API compatibility and restore/rollback strategy. Use expand/migrate/contract when needed; postpone destructive contract steps until supported clients and operations permit. Test on isolated realistic synthetic data. No automatic feature-preview production migrations. No one-off manual balance/ledger edits to make tests pass.
