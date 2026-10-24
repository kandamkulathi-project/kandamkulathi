# Commerce payments — P1-JOS-003

Status: isolated implementation; independent financial/security review and provider/company acceptance Pending. No external payment calls are authorized by this document.

## Early integration contract

- Dedicated source modules: `packages/contracts/src/commerce-payments.ts`, `packages/domain/src/commerce-payments.ts`, `packages/providers/src/razorpay.ts`, `packages/database/src/commerce-payments.ts`. Coordinator owns package exports and HTTP wiring; this change does not edit package manifests or barrel files.
- Intent creation accepts only `operationId`, `subject: { kind: "order" | "booking", id }` and `method: "razorpay"`. Actor identity comes from verified server middleware, never the request body. Amount, owner, INR currency and payability come from `PaymentAuthority.lock(context, subject)` inside the SAME PostgreSQL transaction. The injected trusted repository must lock and validate the authoritative order/booking row; no client snapshot is accepted.
- No dependency on unagreed order columns and no order/reservation migration. The schema agent's early document was absent at initial inspection; its subsequent handoff identifies `core.commerce_orders` with `actor_id`, `amount_paise`, INR, reserved state, expiry and version. Coordinator injects the trusted loader/application; payments does not duplicate FEFO or booking decisions.
- `PaymentStore` persists intents, create-attempt state, verified receipt digests, ledger effects, refund requests and transactional platform outbox obligations. Each call uses the existing event-scoped `DatabaseContext` and shared `transaction`/`enqueue` abstractions.
- Provider create is claimed durably BEFORE the network call. A crash, timeout or lost response remains reconciliation-required. Never repeat an attempted create; reconcile by receipt/reference or known provider order ID. Empty provider search is NOT permission to create again.
- Raw webhook bytes and signature go directly to the adapter before parsing. HTTP must return non-2xx for verification/storage failure and acknowledge only after receipt/effect commit. Browser callbacks are informational and have no paid mutation path.
- Refunds require an injected approved, versioned policy decision and authorized actor; absent policy denies. COD is denied: no approved COD rules are supplied. No refunds are sent by this foundation. Mandate execution is not implemented or implied.

Migration registration and deployment are coordinator-owned. The uniquely named additive `0021_commerce_payments.sql` migration is supplied, but shared Drizzle journal edits are intentionally excluded; tests apply it explicitly after baseline migrations until registration. Do not deploy a candidate without registering and reviewing it.

## Exact constructors and transaction hooks

```ts
new CommercePaymentRepository(context, authority, refundPolicy?, application?)
new CommercePayments(store, provider, receipts?)
```

`PaymentAuthority.lock(context, subject)` returns `AuthoritativePayment | null` inside the active shared transaction. Amount/owner/currency/payability must be loaded and locked from authoritative SQL. Optional `authorityRevision` is persisted; booking requires it and `authority.bind(context, intent, providerOrder)`. Binding runs on CORE inside the intent binding transaction, once for a previously unbound provider order, and must use a guarded booking revision. Failed binding enters financial uncertainty, not simulated success. Authority callbacks may not nest transactions or perform network calls.

`PaymentApplication.apply(context, intent, verifiedEvent, verificationReference)` returns `Promise<void>`. It runs on the JOBS connection in the SAME active transaction after durable receipt UUID and capture-ledger insertion, before outbox and commit. It must apply authoritative order/booking financial state or record the owning domain's durable late-payment obligation. Failure rolls back receipt, ledger, application and outbox. Missing callback denies capture as unconfigured. Payments never directly mutates clinical tables.

For booking, adapt to existing `VerifiedBookingPayment` and await the booking owner's `applyVerifiedBookingPayment`: provider razorpay; event/payment IDs from verifiedEvent; orderId = verifiedEvent.id; bookingId = intent.subject.id; amount/currency from intent; verificationReference = receipt UUID; status captured. Never expose this proof as an HTTP request contract. Booking owns expiry, confirmation and rebook/refund disposition. CORE booking loader/bind must satisfy booking RLS and controlled mutation privileges; until integration supplies them, booking creation is unavailable.

`CommercePayments.get(actorId, intentId)` only reads persisted owner-scoped state. Create/get/refund and provider-order binding use CORE; webhook receipt and capture application use JOBS. For explicit CORE reconciliation, supply `receipts: PaymentReceiptSink` wrapping an event-scoped JOBS repository `receive(event)` call, after provider reads and outside any CORE transaction. Do not combine profile memberships. Repository `bindOrder`/`markUnknown` require actorId as their first argument. Internal methods accept trusted typed input only, never raw HTTP objects.

Migration `packages/database/migrations/0021_commerce_payments.sql` is independent of order/booking DDL and must be registered by coordinator at index 21. It gives backup schema usage/read-only access, enables FORCE RLS, keeps CORE owner-scoped and restricts receipt/capture writes to JOBS. Receipt digests and ledger are append-only to runtime; no raw webhook bodies/private provider data are stored. The 24-hour outbox transport deadline is not a payment/refund obligation deadline: transport exhaustion must not erase unsettled money.

Rejected captured mismatches, additional captures and altered-event replays retain safe provider order/payment IDs, business reference, paise and currency in receipts. Each distinct provider payment gets one `core.commerce_payment_obligations` row and atomic outbox notification for review/reconciliation. No order-paid or guessed refund effect is applied. Receipts use `(account_id,event_id,digest)` identity under an event-level transaction lock: a different digest for an existing event is durably rejected, never mistaken for an accepted duplicate. Identical rejected deliveries stay rejected without duplicating obligations. The obligation row remains authoritative after transport expiry; external finance resolution is not implemented.

## Verification and limits

Commands use the repository's pinned Node/pnpm and explicit isolated PostgreSQL 17 configuration from [platform setup](PLATFORM_FOUNDATION.md). Never print connection values. All full builds, verify, platform, E2E and precommit commands share `flock /tmp/opencode/kandamkulathi-p1-e2e.lock` in this multi-worktree campaign; do not acquire it twice in one command chain.

```sh
pnpm exec vitest run tests/unit/commerce-payments.test.ts tests/unit/razorpay.test.ts
flock /tmp/opencode/kandamkulathi-p1-e2e.lock node --test tests/platform/commerce-payments.test.mjs
flock /tmp/opencode/kandamkulathi-p1-e2e.lock pnpm verify
flock /tmp/opencode/kandamkulathi-p1-e2e.lock pnpm test:platform
flock /tmp/opencode/kandamkulathi-p1-e2e.lock pnpm test:e2e
```

Owner: Josin; review: Mathew/security and company finance. The focused PostgreSQL pack is discovered by existing `test:platform` CI/commit gates. It creates only random isolated synthetic databases/logins through existing support, uses the real Neon WebSocket driver and non-owner profiles, and removes only those test resources. It explicitly applies migration 0021 only until coordinator journal registration, then uses the registered migration. No new dependencies. The HTTP test uses a clearly synthetic loopback harness and injected provider transport; it is not proof of production authentication or coordinator routes. Unit tests prove REST/HMAC contracts without external sends. Real Razorpay sandbox/native/company acceptance, financial policies, recurring mandates, provider refunds, operational reconciliation handlers and independent review remain Pending.
