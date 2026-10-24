# Commerce reconciliation worker

Candidate implementation; financial/security review and company-provider acceptance remain pending.

`executeCommerceReconcile(context, job, bindings)` in
`apps/core-api/src/commerce-jobs.ts` returns `"succeeded" | "stale"` or throws for
retry/review. Root calls it **directly after committed `acquireExecution`**, outside
`executeClaim` and without an outer transaction. Do not wrap it in the generic external
engine: commerce owns stronger atomic financial application and transport completion.

The worker checks the authoritative job identity, operation, subject, revision, processing
state, lease token, lease expiry and deadline. Provider reconciliation is GET-only, outside
database transactions, through the root-owned `configuredCommercePaymentProvider` approved
sandbox gate. It never creates a provider order, charge, refund or customer session.

After provider reads, the worker rechecks the fence in a short JOBS transaction. Existing
`CommercePaymentRepository.receiveInTransaction` commits the verified receipt, integer-paise
ledger, canonical order/booking application and dependent obligations/outbox together with
the platform receipt and job completion. Platform receipt insertion precedes the success
update because receipt RLS requires a processing job. Lease/deadline loss or completion
failure rolls back all those facts. No provider network call holds SQL locks.

Only exact authoritative intent/operation relationships are recognized. Initial checkout,
intent creation, capture-ledger and reservation-expiry events have distinct identities;
caller-supplied queue fields cannot authorize arbitrary subject reconciliation. A booking
requires the canonical Razorpay/provider-account-bound payment record and confirmed booking.

Refund requests and rejected/late/additional-capture or booking-review obligations are not
successful reconciliation probes. They remain durable pending review and throw for retry.
Missing provider configuration, unknown provider outcomes and unsupported subjects also
cannot be acknowledged as successful business operations. The root/platform owner routes
expired financial work to durable `dead` review state without a success receipt or ordinary
notification suppression. Dead-lettering does not settle or erase captured money.

Migration `0024_commerce_reconcile_jobs_access.sql` permits verified JOBS read-only refund
classification and expiry references. It grants no refund approval, dispatch or mutation.
Root owns migration-journal registration, queue/Cron registration and the actual review path.
Scheduled stock expiry separately calls `expireCommerceReservations(context,100)`.

## Focused evidence

Five unit and fourteen real PostgreSQL/localhost-provider tests pass, independently rerun
in the parent. Cases include unknown-order GET reconciliation, duplicate/concurrent leases,
provider uncertainty, rejected/refund/expiry review IDs, receipt-write failure, lease/deadline
loss before and during completion, and canonical booking happy/late captures without a live
user session. Late booking money is accounted for but neither its original nor review job
is falsely acknowledged. Core-role access is denied.

These are synthetic local protocol/database proofs, not real Razorpay settlement, approved
refund policy, production operation or native-device evidence. Root combined mandatory gates,
Worker queue integration, independent review and final commit remain coordinator-owned.
