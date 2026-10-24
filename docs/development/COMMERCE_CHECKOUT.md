# Read-only native payment checkout metadata

Bounded P1 software feature for R02/R03/R12/R25/R36. Local synthetic verification is not provider, device, financial-policy or company acceptance. Independent financial/security review and root integration remain required.

## Frozen contract

`GET /v1/payments/:id/checkout` accepts a canonical lower-case UUID path and no query string or body. Customer identity comes from `authorizeCommerceRequest`, never request-supplied ownership or grants.

Direct response: `commercePaymentCheckoutSchema` / `CommercePaymentCheckout` from `packages/contracts/src/commerce-checkout.ts`:

```ts
{ keyId, providerOrderId, amountPaise, currency: "INR", intentId, operationId, subject }
```

The strict schema allows only a publishable `rzp_test_` key, actual `order_` provider binding, positive safe integer paise, and the existing payment subject. No account ID, secret, owner, address, source or health data is returned. All route responses use `Cache-Control: private, no-store`.

| Status | Meaning |
| --- | --- |
| 200 | READY persisted intent and currently payable, owner-matched authoritative target |
| 400 | Invalid/noncanonical UUID, query string or body |
| 401 / 403 | Authentication/current authorization failure or foreign target |
| 409 | Non-READY, null/unbound binding, expired hold, changed amount/currency or stale target |
| 503 | Missing/unapproved/invalid provider configuration or missing canonical booking loader; unavailable trusted dependencies |

## Root-owned integration

New API module exports `createCommerceCheckoutDependencies(options: CommerceCheckoutOptions): CommerceCheckoutDependencies` and `registerCommerceCheckoutRoutes(app: ServiceApp, dependencies?: CommerceCheckoutDependencies): void`. Root registers separately before the shared unavailable catch-all. No root runtime, manifest, existing commerce module or contracts index is changed by this slice.

`CommerceCheckoutOptions` imports transport/guard/booking-loader fields from `CommerceDatabaseOptions` and requires `identity: CommerceIdentityDependencies`. It accepts optional `paymentProvider: PaymentProvider` and `keyId: string`.

Root MUST obtain `paymentProvider` from its existing `configuredCommercePaymentProvider(bindings)` actual approved sandbox gate. Only when that gate succeeds may root pass `keyId` from the SAME approved bindings. A public test key alone is insufficient. Root owns approval and key-to-account association; the feature checks the actual provider account against the persisted intent. No HTTP grants, config overrides, secrets or synthetic success adapter are permitted.

The factory uses trusted `environment`, `coreDatabaseUrl`, `localProxy`, `resourceNamespace`, `bookingAuthorityLoader` and request-bound `guardInTransaction` from root. In one caller-owned transaction it runs the request guard BEFORE `revalidateCommerceTransaction`, then reads/locks the real persisted intent. No nested transaction or network is permitted in these hooks.

- Order authority reuses `loadCommerceOrderPaymentTarget`: current owner, reserved/nonexpired order, authoritative amount/currency and private address existence.
- Booking authority reuses `authorizeBookingInTransaction` with the current canonical grant and `loadBookingPaymentTarget`: held/nonexpired booking, current owner/fee/currency and actual bound `paymentOrderId` matching the intent. Missing canonical loader fails closed. A saved pre-bind intent revision may legitimately precede the immutable booking bind increment; equality with the old revision is deliberately not used as authority.
- Only the root-approved provider's account identity is read. No provider method, GET, POST, SDK, charge, capture, reconciliation, ledger, booking bind or paid-state mutation occurs here. Paid decisions remain server webhook/reconciliation responsibilities.

Before SDK launch, native consumers must compare metadata with their known READY payment view: intent ID, operation ID, subject kind/ID, provider order ID, amount and currency. A mismatch requires reload, not replacement with client totals. The metadata is not payment success evidence.

## Focused verification

Checkout-named tests cover the strict DTO, factory transport/configuration, guard ordering, no provider calls, HTTP success/denial/status handling and real PostgreSQL non-owner identity/commerce/booking RLS. Synthetic fixtures are isolated; PostgreSQL transport is real, not an in-memory substitute. READY/null is rejected defensively in unit tests and prohibited by the actual database constraint.

```sh
pnpm exec vitest run tests/unit/commerce-checkout.test.ts tests/unit/commerce-checkout-factory.test.ts tests/integration/commerce-checkout-http.test.ts
flock /tmp/opencode/kandamkulathi-p1-e2e.lock pnpm exec vitest run tests/integration/commerce-checkout-postgres.test.ts
```

Source the approved local tools environment privately before checks and use the assigned generated-file TMPDIR. All PostgreSQL/platform/E2E/build work must share that lock without nesting. Full gates, root registration, real sandbox configuration, native supported-device launch, independent review and acceptance remain with the coordinator; this slice does not claim them.
