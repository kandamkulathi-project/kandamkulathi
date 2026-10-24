# Persisted booking runtime — P1-MAT-002 candidate

This additive local implementation is registered in the configured Core Worker;
absent real storage/authority stays unavailable. It does not close package, company
or phase acceptance. It uses the existing
[platform connection/transaction/outbox](PLATFORM_FOUNDATION.md), existing
[booking contracts and decisions](BOOKING_FOUNDATION.md), PostgreSQL 17 and
`0003_mathew_booking.sql`. The integrating owner owns migration-journal changes.
No provider adapters, commerce policies or private clinical routes are introduced.

## Invariants and boundaries

- `clinical.mathew_booking_*` stores approved directory entries, concrete availability,
  leave, immutable booking snapshots, revisions/audit, unique payment/event identities
  and durable pending rebook/refund obligations. Only trusted provisioning may write
  publication/configuration/leave; no HTTP administrative bypass exists.
- The database enforces actual doctor-global `btree_gist` exclusion on half-open
  buffered intervals for held/confirmed records. Clinic and modality are deliberately
  absent from the exclusion key. Expiry must commit before an interval is released.
  A directory-row lock fences concurrent configuration/leave mutation. Approved
  schedule/leave changes affecting existing holds still require operational policy.
- Holds use stable operation/booking UUIDs, advisory serialization, canonical validated
  requests, immutable server fee/slot/policy snapshots, checked insert and audit in one
  shared transaction. Reusing an operation with different facts conflicts. A retry
  after uncertain COMMIT reconciles by the same identities; it never invents a new
  charge or silently retries the transaction helper.
- `BookingAuthorityLoader(context, principal)` is REQUIRED; it must read and lock
  actual current identity/account/session/grants in that same transaction through
  commit. No separate authority cache/default exists. The identity owner must supply
  the reviewed adapter and explicit booking permission, not just workspace entry.
  Only customer-owner or current front-desk in-clinic scope is accepted. Transaction-
  local RLS settings are derived from that loader, never client headers or JSON.
  The jobs role alone can update booking state or write payment/reconciliation facts.
  Core can only CAS-bind a provider order by updating revision/document; a database
  trigger rejects core changes to state/payment history, fee or other snapshots.
- Explicit action grants are stored separately from identity in
  `clinical.mathew_booking_grant`: `booking:create` and `booking:read`, each with
  `self` or explicit `clinic` scope and a current validity/revocation window. These
  are authoritative action grants, not cached identity or workspace-role aliases.
  A per-actor grant fence is locked through booking commit; every grant insertion,
  edit/revocation and deletion takes its conflicting write lock, preventing phantoms.
  Runtime roles cannot provision grants. The loader must still validate and lock real
  current identity first; candidate customer/front-desk scope is intersected with the
  exact action grants. Neither workspace entry nor a role label confers booking access.
  The company-approved provisioning matrix remains Pending; default absence denies.
- `expireDueBookingHolds` uses bounded `FOR UPDATE SKIP LOCKED` pickup and checked CAS
  plus audit. The booking deadline row itself is the durable expiry obligation. Cron
  must invoke it using the jobs connection; no overloaded notification job is used.
- A new hold has an explicit internal `unbound_UUID` order identity, not a provider
  order or checkout success. Financial integration reads the authoritative held target,
  creates/reconciles the provider order outside locks, then CAS-binds its reference in
  a short transaction. The original fee is not repriced and an existing provider order
  cannot be rebound. Orphan/unknown creation outcomes remain financial reconciliation.
- The financial owner verifies signature/account/capture/order/amount/currency and
  inserts its durable receipt, then calls `applyVerifiedBookingPayment` in the SAME
  jobs-role transaction as its receipt/ledger. The callback asserts the shared active
  transaction. No public mark-paid route, provider call or refund occurs under locks.
  Global payment and event identity registries survive alias deliveries. Exact captures
  confirm once; terminal/late/additional/mismatched/policy-changed captures retain money
  facts and create one pending review/reconciliation obligation with atomic outbox.
- Existing `commerce.reconcile` financial transport carries only the obligation UUID.
  The integrating financial handler must explicitly route that subject to this domain
  or fail unavailable. The one-day notification/recovery window is a technical transport
  budget, **not** an approved refund deadline or permission to discard money. Durable
  obligations remain pending across dead/suppressed outbox rows; fulfillment, alerts,
  settlement and reviewed redrive remain the financial owner's integration work.
- The optional `applyVerifiedBookingCapture` wrapper reads an immutable SQL-provisioned
  receipt for isolated fixtures. Runtime roles cannot manufacture its evidence. Main
  commerce integration uses its own durable receipt and the same-transaction callback.

## Exact integration seams

Parent-only package changes (not edited by this slice): add database package exports
`"./booking": "./src/booking.ts"`, and direct workspace dependencies
`"@kandamkulathi/contracts": "workspace:*"`,
`"@kandamkulathi/domain": "workspace:*"` to the database package. It already depends
on Zod. Reconcile the lockfile normally; do not bypass the frozen installation gate.
Current Core imports use explicit source paths so no missing export is simulated.

```ts
// Inside createService("core-api", sink, { registerRoutes(app) { ... } }):
registerBookingRoutes(app, {
  verifySession, // identityRuntime.dependencies.verifySession -> { status: "verified", identity: VerifiedIdentity }
  verifyMutation, // real CSRF/origin/session binding or reviewed native bearer proof
  withContext, // callback => withDatabase(..., "k_core_runtime", callback)
  loadAuthority, // identity-owned locked current BookingAuthorityLoader; SQL only
});
```

`BookingPrincipal` is exactly shared `VerifiedIdentity`; it retains actor/session,
organization and MFA proof, not a lossy ID pair. Inside the required loader, call
`loadCurrentAuthorityInTransaction(context.client, identity)` from the identity
owner's `identity.ts`, then the reviewed action-specific booking authorization
against that locked current authority. The helper must remain in this transaction
through domain commit. Do not infer booking privileges solely from workspace entry.
The integrating `loadBookingAuthority` adapter calls the real identity-owned helper,
validates current privacy/session/account state, organization/MFA and current membership,
then lets the booking transaction intersect that candidate scope with explicit action
grants. Ambiguous mixed customer/staff sessions fail closed. Approved provisioning
remains required; no WorkOS claim or booking privilege is invented.
The integrating owner registers these routes before `createService`'s fallback and
adds migration 0003 to its journal. Environment guards stay before registration.

Financial exports from `packages/database/src/booking.ts`:

```ts
loadBookingPaymentTarget(context, bookingId);
bindBookingPaymentOrder(context, bookingId, expectedRevision, orderId);
applyVerifiedBookingPayment(context, verifiedPayment, expectedRevision?);
// Capture requires JOBS; target/bind also support scoped CORE. Do not nest transactions.
authorizeBookingInTransaction(context, identity, action, loadAuthority);
// Call this FIRST for CORE financial target/bind, using actual VerifiedIdentity.
expireDueBookingHolds(context, limit?); // owns its bounded transaction
```

The first returns booking ID, owner, revision, integer amount/currency, order identity
and immutable hold deadline. Financial HTTP entry must still verify caller ownership;
an internal jobs credential is not end-user authentication. Callback returns the
persisted `BookingRecord`; inspect its matching payment's disposition for application
versus pending reconciliation. Its optional explicit revision is CAS-checked; omitted
revision uses the freshly locked row. Alias retries may carry an old revision.

## HTTP/client contract

| Route | Successful response |
|---|---|
| `GET /v1/doctors` | `{ doctors: DoctorDirectoryEntry[] }` |
| `GET /v1/doctors/:id/availability` | `{ windows: { availability: DoctorAvailability, fees: BookingFeeSnapshot[] }[] }` |
| `GET /v1/availability?doctorId=UUID` | Same window response; canonical alias |
| `POST /v1/bookings` | `{ booking: BookingRecord, persisted: true }` |
| `GET /v1/bookings/:id` | Same persisted booking response after current scope checks |

POST body is strictly `{operationId, bookingId, request: HoldBookingRequest}`; all
fields of `request` come from the existing shared contract. Preserve operation/booking
IDs across retries. No fee, end time, actor, payment result or hold duration is accepted.
A successful hold is HELD, not paid/confirmed. Windows are configured possibilities,
not a promise that a slot remains free; final exclusion decides. Empty published data
returns empty arrays. The current bounded directory/window listing cap is 100; pagination
is not yet implemented and larger approved inventories require that integration.

Errors have `{error:{code}}`: 400 `INVALID_REQUEST`, 401 `UNAUTHENTICATED`, 403
`FORBIDDEN`, 409 `BOOKING_CONFLICT`, 503 `IDENTITY_UNAVAILABLE`/`BOOKING_UNAVAILABLE`.
`createService` retains `no-store`, body limits and safe errors. History, consultation
join, cancellation/reschedule, clinical content and provider checkout routes remain
unavailable. Do not infer an invented policy or make unavailable UI report success.
Browser mutation support uses the coordinator's shared exact `BROWSER_ALLOWED_ORIGINS`
policy; mutation proof is never replaced by CORS alone.
The parent-provided `@kandamkulathi/server/bearer-mutation` helper can be injected as
`verifyMutation: async request => verifyBearerMutation(request, bindings) ? "allowed" : "denied"` with its
explicit approved-origin configuration. It rejects cookies and requires nonambient
bearer credentials; web cookie support requires the separate real session/CSRF
adapter, never a weakened bearer helper or fabricated session.
The real session adapter preserves `unavailable` as 503 `IDENTITY_UNAVAILABLE`,
distinct from a denied mutation's 403 `FORBIDDEN`.

## Verification and remaining work

Authored tests:

- `tests/unit/booking-runtime.test.ts`: strict request rejection and active transaction guard.
- `tests/integration/booking-runtime-http.test.ts`: forged actor, CSRF, malformed input,
  safe unavailable states and private payload non-echo.
- `tests/platform/booking-runtime.test.mjs`: existing isolated PostgreSQL/proxy/non-owner
  harness, actual GiST races/buffers/adjacency, operation retry/conflict, current scope/
  revocation/RLS cleanup, front-desk/global leave, payment alias/event conflict/additional
  capture, expiry/late capture, callback rollback, receipt-write denial and real loopback
  HTTP E2E against PostgreSQL with synthetic provider proof. It applies 0003 explicitly
  only while the parent-owned migration journal has not registered it.

Commands: `pnpm test`, `pnpm test:platform`, `pnpm verify`, `pnpm test:e2e`, security,
mobile and repository checks from the [registry](COMMANDS.md). Every browser/precommit
run must hold `/tmp/opencode/kandamkulathi-p1-e2e.lock`. Use the coordinator's private
tool environment without printing its local synthetic credentials.

**Actual current result:** initial frozen installation failed `ENOSPC`; the subsequent
approved unique `/home` virtual-store installation succeeded with pinned Node
24.22.1/pnpm 10.34.7 and installed hooks. Repository/document checks and all 14 repository
unit tests passed. Focused unit/HTTP suite: **7 passed**. The PostgreSQL suite's **11
cases failed at setup** because the supplied server installation lacks
`btree_gist.control`; none of its database assertions ran, and no exclusion/concurrency
pass is claimed. Root TypeScript, database-package and core-api-package typechecks
subsequently passed under the shared lock. Per coordinator speed
instruction, no full per-agent precommit/full gate/commit is attempted; source remains
uncommitted for combined parent verification. Parent integration must supply package/journal changes,
current-identity adapter, financial receipt/ledger callback/handler, Cron wiring, approved
operational inputs, independent security/financial review and canonical Tinu acceptance.
Real provider/WorkOS/native/customer/front-desk/physician acceptance remains Pending.
