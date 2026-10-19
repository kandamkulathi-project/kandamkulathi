# ADR 0002 — Deterministic domain services and durable outbox

**Status:** Accepted design constraint. **Owners:** Mathew/Josin; independent senior review by Devadathan where applicable.

All clients/providers/assistant tools use shared deterministic authorized domain services. PostgreSQL owns current money/stock/booking/clinical/credit state. Commit business changes, ledger/reservation and outbox atomically in short transactions; no external network call inside locks. Verify actual driver/RLS/constraint behavior.

After commit, bounded workers dispatch durable obligations with stable business/provider references, leases/retry/DLQ and consent/version/deadline checks. Delivery is at-least-once; effects must be idempotent/reconciled, not assumed globally exactly-once. Unknown COMMIT/provider results remain explicit and reconcile before retry. Marketing/model failure cannot starve core financial/clinical work.

Typed AI actions require current authenticated scope and explicit fresh confirmation; model/retrieved text cannot mutate tables or choose authorization. Approved medical text/primary safety blocks are separate from generation. Restore/replay follows provider/domain reconciliation before resuming.

Consequences: extra state-machine/outbox/ledger/reconciliation work is required; a queue acknowledgement alone does not prove a completed business effect. Tests must inspect persisted/provider totals under races/crashes, not only HTTP status. No discarded ledger/audit record to hide a failing invariant.
