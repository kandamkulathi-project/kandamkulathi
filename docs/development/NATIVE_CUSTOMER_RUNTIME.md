# Native customer runtime composition

This local source candidate binds the existing React Native customer views to real
HTTP contracts. It is not native/provider/company acceptance or a claim that all
Phase 1 customer software is complete.

`apps/mobile/src/customer/runtime.ts` exports `createNativeCustomerRuntime` and
`nativeCustomerApiTransport`. `NativeSensitiveFlows` mounts the views only after a
fresh verified customer session and composes the existing SecureStore bearer and
Expo Crypto UUID bindings. Logout, revocation, expiry, background and unmount dispose
the runtime, abort reads and fence late results. Resume uses the incumbent full
session revalidation/remount. Locale changes recreate the locale-bound runtime.
No root `App.tsx` or workspace root is changed.

## Actual contracts and prerequisites

- Paul owns `customer/booking/runtimeOptions.ts`, `runtimeAdapter.ts` and
  `contracts.ts`; integrate those together. Native reuses the concrete builder,
  including `GET /v1/booking-metadata`, `/v1/doctors`, bounded
  `/v1/booking-offers` discovery and a fresh trusted DB clock after persisted
  holds/reads. Canonical `booking-offers.ts` remains Mathew-owned and unchanged.
  No client clinic/service registry, free-slot calculation or policy clock is added.
- Hold IDs come from existing Expo Crypto, overriding the builder's browser-global
  UUID factory. An uncertain retry retains both original operation/booking IDs.
  History/consultation join are not invented where their runtime ports remain absent.
- Catalogue and orders use the actual canonical commerce page schemas and real
  `GET /v1/catalogue` and `/v1/orders` endpoints, with native bearer transport,
  `credentials: omit`, `no-store`, fixed routes and no client ownership filter.
  Private order ownership/current authority remains server-enforced. Reconciliation
  states are displayed as such, never treated as payment capture.
- The initial native view displays a server page of rows, not complete order detail,
  editable checkout or an all-pages result. There is no persisted-cart read endpoint:
  the initial cart list explicitly reports unavailable, not a successful empty cart.

The shared bearer adapter still denies every query by default. Its optional query
policy is evaluated only after approved origin/path/credential/fragment checks and
only for GET; exceptions/non-true results deny. The policy receives a detached URL
clone, and the actual request pins the validated URL before asynchronous credential
storage. Native customer wiring permits only exact `/v1/booking-offers` queries
validated by the canonical bounded-query schema, rejecting duplicate/unknown fields,
path tricks and mutation queries. Existing default-denial assertions are retained.

The Expo TypeScript configuration needs additive
`compilerOptions.allowImportingTsExtensions: true` because canonical server-shared
contracts use explicit `.ts` imports. This changes neither strictness nor emitted
code (`noEmit` remains true). The actual mobile manifest must declare
`@kandamkulathi/contracts: workspace:*`, then refresh installed workspace links.

## Exact remaining software versus external proof

The follow-up forms delta implements native editable cart, customer-selected
location, canonical Indian address fields, server quote/explicit confirmed checkout,
stable uncertainty/reconciliation and payment-intent initiation/read controls.
`NativeCommerceRuntimeViews` validates the actual approved `GET /v1/commerce/clinics`
directory with Mathew/Josin's unchanged `commerceClinicsSchema`, using `locationId`
and `name` (never substituting `clinicId`). It instantiates the controller only after
that read succeeds. The old read-only commerce list is disabled with Paul's
`showCommerce: false` option; the existing booking views remain mounted.

The command runtime directly reuses `createAuthoritativeCommerceApi` and canonical
`commercePresentationSchemas`, with Paul's explicit `credentials: omit` option,
the native bearer adapter and a current-lifetime mutation guard. Each API method
is abort/lifetime-fenced, including payment read/reconcile of the original intent.
Only catalogue/orders keyset GET queries additionally pass the canonical strict
`commercePageSchema`; duplicate/unknown fields and other query routes stay denied.
Missing native provider configuration or payment SDK capture is never replaced by
an invented payment success. See the [forms and uncertainty handoff](../../apps/mobile/src/customer/NATIVE_COMMERCE_HANDOFF.md).

The outer native lifecycle now brokers only module-issued, deep-frozen confirmed
commands across ordinary background/locale/session-refresh revalidation. The slot
is volatile memory, single-consume and bound to identical owner, session expiry and
SHA-256 of the actual bootstrap OS credential; no address/token enters storage or
logs. Capture happens before child/runtime disposal, never from cleanup ordering
alone. Explicit logout, 401/403, credential rotation/removal, authority expiry or
scope replacement clears/fences it. Only a fresh session and directory read can
restore the same command, visibly last-known until retry/read/reconcile. Arbitrary
serialized/reconstructed snapshots are rejected by the controller. Process-death
durable recovery is not claimed; authorized server history remains necessary.

The operational EN/ML/TA copy is wired from the shared draft resources;
the displayed notice correctly retains Pending company language review. Synthetic
host rendering checks address accessibility names, validation announcements, empty
states and quote confirmation in all three locales, not RN layout/device support.

The canonical checkout metadata follow-up supplies explicit provider launch only
for a freshly read READY intent. It reads actual `GET /v1/payments/:id/checkout`
through the same bearer/current-lifetime transport, parses the unchanged canonical
schema and compares intent, operation, subject, provider order, amount and currency
before mapping public `keyId` to the existing SDK `key`. It uses the SAME root
`nativeCheckout` instance and its global busy lock, not another SDK wrapper.
Callback payloads are discarded: only authoritative same-intent read/reconcile can
change the payment projection. Before launch the controller marks its known view
last-known; cancel/error/timeout cannot reopen checkout without a fresh server read.
Background/disposal fences completions and retains the existing immutable recovery
identity, never inventing a paid state. Hardware/metadata waiting is bounded and
does not release the real SDK lock early. Supported builds, provider configuration,
signing and physical Android/iPhone checks remain separate external acceptance.

**Software still not closed by these forms:** native auth/bootstrap integration is
a separate active delta. Neither synthetic SDK-port tests nor installing the native
SDK prove an actual provider payment or supported-device compatibility.
Native order details/pagination, booking history/cancel/reschedule/payment and
consultation media/join also require their actual implemented API/UI contracts.

Mathew's current web-auth source now implements browser `GET /v1/auth/start`,
`/v1/auth/authorize`, `/v1/auth/callback`, `/v1/security/context` and
`POST /v1/session/logout`. They are cookie/browser/CSRF flows, not native bearer
issuance. The logout route explicitly rejects an Authorization bearer. Real
`GET /v1/session` verifies a configured bearer and reloads current authority.
The native protocol owner is separately implementing `/v1/native-auth/start`,
`/exchange`, `/logout` and exact consent-bootstrap policy contracts. Native handles
are bounded opaque credentials, not provider tokens exposed to the UI. Required
policy consent must be explicitly confirmed using actual approved policy text,
then a fresh full session must succeed before saving the ephemeral credential.
These early contracts are not proof of completed client/server integration. There
is no refresh contract: expiry requires signing in again. Never bind the PKCE SDK
to browser-only cookie routes, manufacture a `ClientSession` while consent is
pending or report `{revoked:true}` after an uncertain native logout.

**External verification still required:** approved provider/company configuration,
callback allowlists/credentials, signed development/release builds, supported
Android/iPhone SDK/AppState returns, native media/payment hardware/provider outcomes,
store submission and independent security/clinical/finance/G1 acceptance. No local
controller or loopback HTTP case closes those milestones.

## Focused verification scope

Unit regressions cover canonical metadata/offers, native bearer scoping, strict
commerce projection, uncertainty identity, trusted clock, revocation/expiry/abort,
late-result disposal, query default denial and URL-retargeting controls. A Playwright
Node test traverses a real synthetic loopback HTTP boundary; it does not render RN
or prove a physical SDK. The normal root Playwright configuration initially stopped
before the test because this isolated snapshot had no public preview build. The
focused HTTP-only configuration runs no preview servers; full combined builds,
browser/mobile/security/platform gates and exact committed-candidate evidence remain
the coordinator's responsibility. No checks are bypassed for a commit or acceptance.
