# Canonical customer web payment SDK bridge

Scoped delta against the coordinator's exact current `AuthoritativeCommerceCustomerViews.tsx`,
`authoritative-api.ts` and `domainSchemas.ts`, not the earlier full Paul snapshot. Their baseline
SHA-256 manifest is `/tmp/opencode/paul-sdk-baseline-sha256.txt`; existing SAST-compatible code,
browser transport, native credentials behavior and root registrations are preserved.

## Runtime wiring

The existing `CustomerRuntimeViews` composition automatically gains an explicit **Pay with
Razorpay** action when the current authoritative intent is `ready` and the canonical checkout
parser is configured. No root App, shared manifest, checkout SDK implementation or legacy
`SensitiveFlows` DTO is changed.

Shared API method, reused unchanged by native:

```ts
checkoutMetadata(
  expected: CommercePaymentView,
  signal: AbortSignal,
): Promise<Reply<CommercePaymentCheckout>>
```

`AuthoritativeCommerceSchemas.paymentCheckout` is the optional schema port;
`commercePresentationSchemas` binds the exact `commercePaymentCheckoutSchema` from
`packages/contracts/src/commerce-checkout.ts`. Missing schema/metadata remains unavailable.
The metadata request is the frozen `GET /v1/payments/:intentId/checkout`, with no body or new
charge. Before SDK launch the adapter verifies intent, operation, subject kind/order ID,
provider order, amount and currency against the current `ready` payment. Unknown fields,
unapproved/live keys and malformed metadata are rejected by the shared parser. Session and
owner checks remain server-enforced; credentials and reviewed root transport are unchanged.

`customer/commerce/browserPayment.ts` wraps the existing `browserCheckout(true)` SDK port.
It maps `keyId -> key`, `providerOrderId -> order_id`, `amountPaise -> amount` and `INR` without
calculating or accepting a client amount. This P1 bridge is sandbox-only. There is no secret,
patient prefill or provider callback receipt stored or submitted by the UI.

SDK return, dismissal and errors trigger only `readPayment(expected, signal)` for the same
intent. SDK callbacks never establish capture. The existing explicit reconcile action sends
canonical `{}` to the frozen reconcile route; webhook/provider reconciliation determines the
authoritative result. Cancellation/retry preserves the intent/operation and never calls create
intent again. A duplicate launch is fenced. Session expiry, private-boundary unmount,
pagehide/backgrounding or abort closes the SDK and fences late metadata/callback work.

## Verification and prerequisites

- Final focused run: all 19 canonical API/SDK unit tests, scoped TypeScript and all five rendered
  browser tests passed. Desktop/360px screenshots were visually inspected with no horizontal
  overflow. Actual logs are `/tmp/opencode/paul-sdk-final-unit.log`,
  `/tmp/opencode/paul-sdk-final-types.log` and `/tmp/opencode/paul-sdk-final-e2e.log`.
- Browser cases cover ready intent -> canonical metadata -> reviewed SDK -> authoritative read,
  ignored fake-paid callback, explicit reconcile, cancellation/retry, changed amount, 403 and
  revocation during metadata. All synthetic SDK constructors/HTTP responses are test-owned only.
- The sparse Paul lane copies the exact leader-owned `checkout.ts` and `sensitive.ts`, plus the
  exact Josin checkout schema, as **separate prerequisites**, never as Paul-authored patch content.
  Source fingerprints: `/tmp/opencode/paul-sdk-prereq-sha256.txt`.
- Test-only Vite/Vitest aliases resolve the existing sensitive-contract prerequisite without a
  shared manifest change. Local scoped TypeScript uses the external
  `/tmp/opencode/paul-sdk-types.tsconfig.json` alias for the same reason; the coordinator's actual
  package export registration is authoritative for combined verification.

This is software verification with a synthetic SDK port, not evidence of an actual Razorpay
charge, configured company test key, sandbox-provider acceptance or native-device behavior.
No full gates, commit, push, root registration or deployment were performed in this delta.
