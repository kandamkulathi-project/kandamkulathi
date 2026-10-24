# P1 unpaid order cancellation scaffold

Technical foundation for P1-O04 only; not Phase 2 cancellation/return/refund policy,
provider approval, company acceptance or G1. Existing refund requests are unchanged.
No UI or provider operation is added.

## Integrated composition / migration contract

Commit `c396c41` registers the migration and mounts the endpoint through
the existing event-bound Core runtime. The details below describe that existing binding;
final combined checks and independent acceptance remain separate.

- Additive `0028_order_cancellation.sql` is registered after 0027 in the migration journal,
  followed by the separate notice and transcription migrations 0029 and 0030.
- Before the Core unavailable catch-all, the runtime already imports from
  `apps/core-api/src/commerce-cancellation.ts` and calls
  `registerCommerceCancellationRoutes(app, configuredCommerceCancellationDependencies(bindings, identity, request, commerce))`
  with the existing event-bound identity runtime and commerce dependencies. Do not register
  the migration or mount the route a second time when following this handoff.
- Direct source exports are available in `packages/contracts/src/commerce-cancellation.ts`,
  `packages/domain/src/commerce-cancellation.ts` and
  `packages/database/src/commerce-cancellation.ts`. No package export map change required
  for the supplied Core adapter; public package exports remain coordinator-owned.

## Contract and safeguards

`POST /v1/orders/:id/cancel` accepts only
`{ operationId: UUID, expectedVersion: positive integer, confirmed: true }`.
An authenticated current customer must own the order. Staff read grants confer no
cancellation permission. The existing request-bound mutation/session checks and
shared identity/consent locks run again inside the authoritative transaction.

The database must contain an active, externally approved
`core.commerce_cancellation_policy` row. The migration seeds **none**; controlled
provisioning, finance/company approval and independent review remain Pending.
Runtime cannot create, approve, change or activate this policy. Missing/inactive
configuration returns 503 with no effects. Approval only enables the narrow technical
transition, not invented fees, refund eligibility or settlement rules.

Only a version-matched `reserved` order with **no payment intent at all** is eligible.
Pending, creating, ready, unknown, captured and failed intents all return conflict;
failed payment is not proof that money cannot arrive. Paid/expired/reconciliation
states also conflict. No payment metadata, checkout grant, address or financial ledger
is rewritten. Successful response is
`{ orderId, operationId, status: "cancelled", version, refund: "not_applicable" }`.

The same advisory subject fence as payment creation precedes the order lock, so a
new payment intent cannot race the missing-intent check. Deterministically locked
batches and held reservation totals are checked before release. Batch reserved counts,
reservation release timestamps, order version, append-only policy-attributed
cancellation record and one `commerce.reconcile` outbox record commit or roll back
together. No charge/refund ledger entry is fabricated for unpaid stock release.
The existing reconciliation worker does not acknowledge cancellation audit operations
as captured-money success: these outbox operations remain unrecognized/retry/manual
review under its existing rules. No automatic cancellation notification or financial
settlement is claimed; a later reviewed consumer can recognize the audit proof.

Identical retries return the stored result after current authorization, including
when policy has subsequently been disabled. Reusing the operation for another order,
changing expected version, or a different operation for an already cancelled order
conflicts. No provider call or runtime role switching occurs. Core retains **no**
SQL UPDATE privilege on order status/version and cannot mark paid, even when no row
is visible. The only status write is a controlled-owner `SECURITY DEFINER` function,
`core.commerce_cancel_prepared_order(uuid,uuid,integer)`, with a fixed
`pg_catalog,core,platform` search path and PUBLIC execution revoked. It accepts no
desired status: only `reserved` to `cancelled` for the exact owner/version is possible.
It reacquires the canonical payment subject fence and order/session/policy locks,
checks a live actor-bound session and absence of **any** payment intent, and requires
matching cancellation audit and pending outbox proof from this same transaction
(`xmin`). The adapter prepares only audit/outbox; it does not release stock.
The function locks reservation/batch sources in canonical SKU/FEFO/batch order,
requires all reservations still held with full line quantities and adequate reserved
stock (including other held reservations on a shared batch), then **performs** each
exact quantity decrement and reservation release before changing order status.
Source batches/reservations touched earlier in this transaction are rejected,
including no-op, insufficient or excessive caller stock decrements and writes in
released SAVEPOINTs (child transaction status is checked as well). A changed `xmin`
is not arithmetic proof: the function owns the arithmetic. No cancellation-specific
Core reservation UPDATE grant or batch mutation policy is added. The pre-existing
checkout stock capability is unchanged; this is a bounded cancellation guarantee,
not prevention or repair of all stock corruption through that separate capability.
All writes roll back on any denial. The existing Core lock-only RLS
policy and all immutable earlier migrations remain unchanged. A SELECT-only,
same-transaction cancellation-proof policy on the FORCE-RLS outbox lets the controlled
function owner verify its proof without inheriting a runtime role or bypassing RLS.
Independent security
and finance re-review of this permission-boundary change is required.

## Focused verification / manual handoff

Run the cancellation unit test and HTTP/PostgreSQL integration test under the shared
PostgreSQL lock using the registered migration journal. The integration suite also
executes successful transitions under a NOLOGIN, non-superuser/NOBYPASSRLS function
owner inheriting the controlled migration owner's rights and existing FORCE-RLS
policy role; runtime roles receive no such membership. Direct SQL negative cases
cover wrong actor/mode, missing session, existing intent, stale version, proof
from a prior transaction and caller no-op/insufficient/excessive/SAVEPOINT stock pre-mutations
with exact before/after rollback checks. The unchanged paid-mutation permission
regression must pass.

After approved controlled policy provisioning on synthetic data: reserve an unpaid
order, confirm cancellation with its current version, and verify one cancellation,
one outbox record, released reservations, decremented reserved count and unchanged
on-hand/financial ledger. Retry the same body; counts must not change. Try an order
with any payment intent, another owner's order, revoked session, stale version and
unconfirmed input; none may release stock. Disable policy; new operations must fail
closed. Real provider/device, full-candidate gates and independent security/financial
review belong to the coordinator and remain required.
