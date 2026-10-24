# Paul — Phase 1 customer presentation handoff

Scope: KAN91–96 / P1-PAU-001–004, 080, 090. This is bounded presentation implementation, not G1 acceptance, production release or an implemented business backend. The prerequisite is `origin/feature/p1-mathew-backlog-foundations` at `3825c00`.

## Ownership and integration

Two independent `openai/gpt-6.1-sol` workers implement commerce and booking/native in separate worktrees. The coordinator owns shared `DESIGN.md` and `PRODUCT.md`; Paul owns composition and the test harness. No dependencies or lockfiles change in this lane. Existing workspace/native visual rules are retained; no alternative visual identity or new component library is introduced.

- Commerce: `apps/workspaces/src/customer/commerce/`.
- Booking: `apps/workspaces/src/customer/booking/`.
- Combined controlled presentation: `apps/workspaces/src/customer/CustomerJourneyViews.tsx`.
- Native assembly: `apps/mobile/src/customer/`.
- Test-only fixture application: `tests/customer-ui/`. Never import it into application registration or a production bundle.

Root application/index registrations intentionally remain unchanged. The coordinator should mount `CustomerJourneyViews` inside the customer-authorized workspace boundary, supplying a section derived from its route and reviewed senior adapters. A section switch unmounts the previous view; no hidden private view is retained.

**Runtime wiring:** prefer `CustomerRuntimeViews`, which uses the canonical domain schemas directly and the concrete HTTP adapters. `CustomerJourneyViews` is the reusable projection composition used by isolated presentation tests; its aggregate commerce port is not an implemented HTTP API.

```tsx
import { CustomerRuntimeViews } from "./customer";

// Inside the root's existing authorized customer boundary. The root owns these
// route matches; no new root registration is made by Paul's scoped modules.
<CustomerRuntimeViews
  locale={locale}
  session={customerSession}
  section={pathname === "/customer/appointments" ? "booking" : "commerce"}
  commerceTransport={reviewedCommerceTransport}
  locations={approvedClinicDirectory}
  bookingRuntime={reviewedBookingRuntimeOptions}
  consultation={reviewedConsultationAdapter}
  onRefreshSession={reloadVerifiedSession}
  onSignIn={beginReviewedSignIn}
  onSignOut={beginReviewedSignOut}
/>
```

`reviewedCommerceTransport` supplies the exact API origin and senior-owned mutation authorization; no missing CSRF/native proof is replaced with a dummy header. The canonical product mapper supplies named variants, image, price and stock/consultation labels. Clinic/variant selections never ask a customer to type UUIDs. If approved location/variant metadata is absent, quote submission remains unavailable.

The concrete booking runtime is now exported from `apps/workspaces/src/customer/index.ts` and `booking/index.ts`:

```tsx
import { createBookingRuntimeOptions, CustomerRuntimeViews } from "./customer";
const bookingRuntime = createBookingRuntimeOptions({
  origin: approvedApiOrigin,
  local: isApprovedLocalDevelopment,
  transport: reviewedBookingTransport,
});
// Memoize per verified runtime/session lifetime, then pass this object:
<CustomerRuntimeViews {...existingCustomerProps} bookingRuntime={bookingRuntime} />
```

`createBookingRuntimeOptions(connection: BookingRuntimeConnection): BookingRuntimeOptions` lives in `booking/runtimeOptions.ts`; its transport signature is `(url: string, init: RequestInit) => Promise<Response>`. It uses strict direct `packages/contracts/src/booking-offers.ts` imports (exact Mathew-parent prerequisite), actual metadata/doctors/offer GETs, named directory/scoped selection and CSPRNG operation IDs retained by `createBookingRuntimeApi`. Offer searches start at freshly fetched database `serverNow`, span 24 hours and request at most 50 offers per permitted modality. Every result is checked against selected service/doctor/clinic/modality, canonical identity, availability revision and requested bounds. Truncation is visible; offers are not reservations. Hold/read HTTP bodies lack a clock, so the adapter awaits another authoritative metadata GET after persistence. Clock failure fails closed, never falling back to the browser time. Client elapsed time is only used for displaying a countdown after this server anchor.

Native owners may reuse this builder and the same runtime adapter; no duplicate metadata mapper is needed. The current `CustomerNativeViews` commerce lists are read-only: native cart/address/checkout/payment forms remain missing software, separate from physical-device/provider acceptance. The web implementation does not close those native features.

```tsx
<CustomerJourneyViews
  locale={locale}
  session={customerSession}
  section={customerSection}
  onSectionChange={navigateCustomerSection}
  commerce={reviewedCommercePresentationAdapter}
  booking={reviewedBookingPresentationAdapter}
  consultation={reviewedConsultationAdapter}
  onRefreshSession={reloadVerifiedSession}
  onSignIn={beginReviewedSignIn}
  onSignOut={beginReviewedSignOut}
/>
```

`customerSession` is `{status: "ready", session: ClientSession, epoch: string}` only after senior session verification; other presentation states are loading/anonymous/denied/unavailable/error/conflict. `epoch` changes after invalidation/re-verification, even when the same account returns. Navigation is not authorization: every private API must verify ownership and current eligibility server-side.

## Strict adapter contracts

The module contracts are presentation ports, **not claims that HTTP endpoints exist**. API owners must map reviewed authoritative schemas to these projections, preserve errors and validate responses; do not create an in-memory success adapter in application code.

### Commerce

`CommerceApi` in `commerce/contracts.ts` supplies `catalogue`, `readPrivate`, `addItem`, `setQuantity`, `saveAddress`, `requestCheckout`, `reorder`. Calls receive an abort signal and locale. Mutations additionally carry the last server revision and a stable operation ID. Replies are ready/data or anonymous/denied/unavailable/error/conflict. Catalogue taxonomy, product variants, display prices, stock and purchase labels come from the API. Private data carries matching owner ID, revision, account, cart, addresses, orders and operation state. Integer-paise amounts are rendered, never recalculated. Unknown mutation outcomes must reconcile rather than repeat an operation blindly.

### Booking

`BookingCustomerApi` in `booking/contracts.ts` supplies directory, slots, appointments, hold and read; `BookingConsultationAdapter` supplies join. Replies are strictly parsed against existing shared booking schemas plus bounded presentation projections. Server time anchors hold display; a timer does not confirm, cancel or refund a booking. Join never constructs a room URL or grants consent locally. Missing adapters remain unavailable.

### Backend-owner handoff required

Mathew/Josin/Devadathan must confirm exact HTTP routes, envelope mapping, request correlation/idempotency/CSRF or native transport, owner-scoped projections and current-state semantics. The UI does not substitute proposed route names for implemented APIs. Required real-provider sandbox journeys and persisted-state integration remain open until those adapters exist and independent tests pass.

The runtime handoffs distinguish available from missing capabilities:

- Commerce: `GET /v1/catalogue`, `GET /v1/products/:id`, `POST /v1/cart/quote`, `POST /v1/checkout` (reserved, not paid), owner-scoped `GET /v1/orders` and `GET /v1/orders/:id`. Canonical parsers are wired directly. Inline delivery collection is implemented; saved addresses, reorder, profile edits, fulfillment documents and tracking are unavailable. Checkout never submits client `source` or computed totals; the server assigns web attribution.
- Booking: `GET /v1/doctors`, `GET /v1/doctors/:id/availability`, `GET /v1/availability?doctorId=UUID`, `POST /v1/bookings`, `GET /v1/bookings/:id`. Configured windows are not proof of free inventory. Hold body is exactly `{operationId, bookingId, request}`; preserve those IDs across uncertain retries. History/join/cancel/reschedule remain unavailable. The internal `unbound_…` payment-order placeholder is not a provider payment link.

Backend registration remains conditional on real verified authority and mutation transport dependencies. No production registration is enabled by this UI lane.

## Test harness

The test-owned Vite server on loopback port 5184 renders the real components and incumbent CSS. Playwright supplies deterministic synthetic API responses under `/__test/`; no synthetic records are shipped in application code. The harness is started by `playwright.config.ts`, so the ordinary E2E suite includes these cases. A focused run is:

```sh
flock /tmp/opencode/kandamkulathi-p1-e2e.lock pnpm exec playwright test --config tests/customer-ui/playwright.config.ts
```

Fixture session is a bare strict `ClientSession` at `GET /__test/session`; commerce fixture routes are catalogue/private reads and add/quantity/address/checkout/reorder mutations; booking fixture routes are directory/appointments reads and slots/hold/read mutations. These are test contracts only, not production API routes.

## Remaining acceptance gates

- Current baseline dependency scan reports eight unremediated advisories in Zod, undici and fast-uri; shared dependency owner must remediate and rerun all gates. No suppression or local exception is added.
- Current baseline Expo compatibility requires updated Expo, dev-client, file-system and font pins; Devadathan owns that shared change.
- New customer labels remain draft English where existing foundation keys are insufficient. Denzil/company-reviewed EN/ML/TA customer vocabulary and approved medical/product source content remain required.
- Signed Android/iOS builds, supported-device navigation/permissions/backgrounding, real auth/payment/video and store assets remain Pending. Browser mobile-width screenshots and JavaScript exports do not close these gates.
- Independent Devadathan UI review plus Mathew/Josin clinical/financial boundary review, Tinu canonical retest and company acceptance are required. No self-approval or push/PR/merge/deploy occurs in this lane.

## Actual lane verification

Payment creation uses `POST /v1/orders/:id/payment-intents` with the exact canonical `createPaymentSchema` body. The adapter rejects booking subjects, route/body order mismatches and responses for another order/operation; canonical strict parsing rejects client owner, source and amount fields. Unknown/unavailable outcomes retain the same operation ID and body for explicit retry. Provider launch remains unavailable; an intent is never treated as captured payment.

Confirmed existing-intent controls use `GET /v1/payments/:id` with no body and `POST /v1/payments/:id/reconcile` with canonical `commerceReconcileRequestSchema.parse({})`. Both parse `commercePaymentViewSchema` and fence intent/order/operation identity. These check/reconcile existing authority; they never create a new intent, charge or provider checkout. Provider capture is displayed only if returned by the authoritative response.

Payment corrective delta verification: 24 HTTP/domain unit tests passed (`/tmp/opencode/paul-payment-unit.log`), scoped workspace typecheck passed (`/tmp/opencode/paul-payment-typecheck.log`), and all three runtime browser cases passed (`/tmp/opencode/paul-payment-e2e-final.log`). Later concrete builder/payment read-reconcile verification passed 59 scoped unit tests plus root/workspace typechecks. The nine-case focused browser run passed eight cases, including the actual payment read/reconcile flow; its remaining new booking test used an incorrect retry label. After correcting that locator without weakening its assertions, both canonical booking browser cases passed (`/tmp/opencode/paul-booking-runtime-final.log`). Provider SDK behavior is not implemented.

- Frozen prerequisite install and local hook setup passed. A later frozen install of the coordinator's three-file dependency candidate passed with `CI=true` (pnpm required explicit noninteractive permission to refresh this lane's generated modules).
- Initial prerequisite `pnpm verify` passed: 21 test files / 471 tests, 58 security regressions and web/native-JavaScript/Worker builds. This predates the new customer modules and is not their final verification.
- Integrated customer unit run passed: five test files / 74 tests, including a regression against the actual strict canonical checkout parser and the exact checkout command composer used by the UI.
- Final integrated `pnpm typecheck` passed across all workspaces using the exact canonical commerce files copied from Josin's parent worktree. All shared contract copies remain separate prerequisites, not Paul-owned patch content. Source SHA-256 manifest: `/tmp/opencode/paul-canonical-prereq-sha256.txt`.
- Initial SAST, Node runtime-security, repository check and documentation guard tests passed. Initial dependency/mobile checks failed as described above; the coordinator's dependency repair is a separate prerequisite, not a feature-owned edit.
- Focused browser suite passed all 18 tests under the shared lock (`/tmp/opencode/paul-customer-e2e-final.log`). This includes the HTTP-backed `CustomerRuntimeViews` composition, canonical response parsing, inline-address rejection, no client source/totals, unknown reservation retry with identical body/operation ID, owner denial, booking expiry/conflict and responsive keyboard behavior. Fixtures intercept exact HTTP routes only in test code; this is not live-backend/provider verification.
- After adding an image-error fallback, both runtime browser cases passed again (`/tmp/opencode/paul-runtime-final.log`). Desktop and 360px screenshots were visually inspected; evidence is preserved at `/tmp/opencode/paul-rendered-evidence/runtime-commerce-desktop.png` and `/tmp/opencode/paul-rendered-evidence/runtime-commerce-mobile.png`. No horizontal overflow or page errors were observed. No physical-device verification has run in this lane.

The coordinator must run the required combined `pnpm verify`, `pnpm test:e2e`, platform, mobile, security/scanner and documentation gates on the integrated candidate. Full feature acceptance and a commit remain blocked until those checks actually pass. Worker source is preserved uncommitted; nothing was pushed, registered in root apps, merged or deployed.
