# Commerce runtime integration candidate

This is owned-source implementation evidence, not phase, finance, clinical or release approval.

## Root composition

Register `registerCommerceRoutes(app, createCommerceDatabaseDependencies(options))` from
`apps/core-api/src/commerce.ts` and `commerce-database.ts`. This lane does not edit the
shared application entrypoint, environment schema, package manifests or dependency lock.
Pass separate approved CORE/JOBS runtime URLs, environment, current shared identity
dependencies and its actual mutation verifier. No combined-role credential. Provider
work runs after database transactions; explicit reconciliation applies financial receipts
on a separate JOBS connection. Configure only the approved Razorpay adapter. Missing
provider configuration, refund policy, tax approval, hold policy or clinical eligibility
denies/unavailable; it must not be replaced with a fabricated success.

The fifth payment repository constructor argument revalidates the actual shared identity
and commerce action/grant inside every owner transaction, before reads or writes.
Catalogue/order repositories receive the same transaction guard. JOBS receipt application
does not depend on an unexpired customer browser session: captured money must remain
durably accounted for. Staff grants require the matching current membership, clinic and
action; their writers serialize on the shared identity actor fence.

Root supplies the actual configured identity mutation verifier and request-bound
`guardInTransaction(context,principal)`. The latter runs in every existing owner transaction,
before commerce identity/grant revalidation and effects. Bind it to canonical configured
identity `withSessionInTransaction(client,request,principal,callback)` for both cookie and
native authority. Do not open an outer/nested transaction or do provider network work there.
Actual cookie/logout locking and rollback have focused PostgreSQL coverage. JOBS signed
receipts have no owner principal and intentionally do not require a live customer session.
Pass trusted `resourceNamespace` from deployment configuration to preserve preview isolation;
the database transport receives it as its sixth argument. Never accept it from HTTP input.

## Frozen client payment handshake

Shared schemas live in `packages/contracts/src/commerce-http.ts` and
`commerce-payments.ts`. Responses never expose owner/account IDs or provider secrets.

| Route | Body | Success |
| --- | --- | --- |
| POST `/v1/orders/:id/payment-intents` | `createPaymentSchema`: operationId, subject `{kind:"order",id}`, method `"razorpay"`; URL/body ID must match | 202 payment view |
| POST `/v1/payments` | same create schema, also supports canonical booking subject | 202 payment view |
| GET `/v1/payments/:id` | none | 200 payment view, no provider call |
| POST `/v1/payments/:id/reconcile` | exactly `{}` (`commerceReconcileRequestSchema`) | 200 payment view |

Reconcile never creates another provider order/charge. `unknown` is not paid.
`commercePaymentViewSchema` is the exact response contract. Owner scope and mutation
transport verification apply independently of client visibility. Error envelopes use
400 invalid input, 401 authentication, 403 denied, 404 absent record, 409 stale/conflict,
503 unavailable. Raw signed webhook bytes are verified by the provider adapter, not
parsed/re-serialized by the HTTP route. Browser return data never asserts payment.

Checkout requires a strict delivery address and immutable private owner snapshot. Source
is server configuration (`web` default), never client input. Saved-address book, reorder,
shipment tracking and invoice generation are not implemented and remain unavailable.

## Database and scheduled work

### Approved named clinic selection

Canonical validators are `commerceClinicsSchema` and `commerceStaffClinicsSchema` in
`packages/contracts/src/commerce-clinics.ts`:

- GET `/v1/commerce/clinics`: public `200 {items:[{clinicId,locationId,name}]}`.
- GET `/v1/staff/commerce/clinics`: current staff/MFA `200` with the same item fields plus
  `actions: CommerceAction[]`, containing only matching current membership/grant actions.
- Both routes reject query parameters. Absent/invalid/future-approved naming metadata or
  no active approved inventory association is `503 COMMERCE_UNAVAILABLE`, never invented names.
- Names come only from canonical `clinical.mathew_booking_clinic_metadata`, parsed with
  Mathew's `bookingClinicMetadataSchema`. `core.commerce_clinic_locations` is an explicitly
  approved admin-only association, not another naming registry; it has no seeded approvals.
- Customer checkout sends the selected `locationId`. Staff route `:clinicId` is canonical
  and is resolved to its explicit inventory location within the owner transaction. Never
  substitute one UUID for the other or accept client/environment clinic grants.

Apply canonical identity `0002_mathew_identity.sql` and booking `0003_mathew_booking.sql`
(including its approved metadata slice), then commerce migrations
`0020_commerce_catalogue`, `0021_commerce_payments`, `0022_commerce_orders_access`,
`0023_commerce_clinic_directory` through
the shared migration journal. Root owns journal merging alongside other lanes. Canonical
booking source/migrations belong to Mathew; do not copy the local prerequisite snapshots
from this lane as commerce-owned source.

Schedule `expireCommerceReservations(jobsContext, limit)` from the trusted JOBS Cron path
(limit 1–100). It is not a public endpoint. It serializes with capture on order locks,
releases held quantities once, appends expiry history and financial outbox atomically,
and never releases paid allocations. Late capture remains a reconciliation obligation.
No scheduled handler may ACK `commerce.reconcile` as completed without actual reconciliation.
Current handler registration remains a root integration task, not claimed operational proof.

CORE may acquire row locks but a restrictive UPDATE policy prevents order mutations.
Staff order visibility does not expose delivery addresses. Runtime roles cannot inherit
controlled-owner policies; existing role proof must remain enabled. Review migrations,
privileges, provisioning and rollback independently before release.

## Provenance and verification handoff

Parent branch: `feature/p1-josin-commerce-completion`, base `3825c000`.
Catalogue/domain/import/FEFO source originated in the isolated Josin schema agent;
durable payment/provider source originated in the isolated payment agent. Parent owns
HTTP/contracts, current authorization integration, order reads, order/booking financial
composition, reservation expiry and integration corrections/tests.

Owned export excludes shared identity/WorkOS/booking prerequisite snapshots, shared
migration journal and dependency remediation. All source is uncommitted by coordinator
authorization; coordinator owns combined mandatory gates and the final commit.

Focused results before the final identity/guard regression additions: 95 unit/HTTP tests
and 14 real PostgreSQL tests passed; focused Playwright HTTP E2E previously passed (1).
See the external frozen export manifest for the latest exact results and remaining deltas.
No external payment, message, deployment, push or PR operation was performed. Actual
provider sandbox/live, native device, approved-policy and independent financial/security
review evidence remains pending. Full `pnpm verify` and `pnpm test:e2e` are coordinator
gates, not claimed here. Named directory/transaction guard changes are delivered as a separate
delta against the frozen base; inventory location names alone are not publication approval.
