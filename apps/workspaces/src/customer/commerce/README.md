# Customer commerce presentation handoff — KAN91–96

`CommerceCustomerViews` (`index.ts`) extends incumbent workspace styles and shared
Button/Notice; it performs no root registration and ships no fixture.
The coordinator PRODUCT.md/DESIGN.md were read in the sibling integration worktree. No shared
documents, dependencies, locales or other worktrees were changed.

## Integration

### Authoritative HTTP entry — use for real services

`AuthoritativeCommerceCustomerViews<Product>({locale,session,transport,schemas,onRefreshSession?})`
is the HTTP-backed entry added after the real API handoff. Keep `transport` and
`schemas` references stable. `createAuthoritativeCommerceApi` performs credentialed,
no-store, abortable, no-redirect reads and mutations at the exact handed-off routes.
It constructs no payment request and no authorization proof. Mutations require
the senior-owned `transport.authorizeMutation(signal)` CSRF/origin adapter.

Inject **actual shared Zod schema objects**, not permissive casts. Wire types in
`authoritative-api.ts` are direct type-only imports from domain source files, not
copies. Those source files must be integrated by the coordinator before the final
combined typecheck can pass. Source authority:

- Josin schema worktree `packages/contracts/src/commerce-catalogue.ts`:
  `cartSchema`, `checkoutSchema`, `CommerceQuote`, `CommerceCheckout`.
- Josin worktree `packages/contracts/src/commerce-orders.ts`:
  `commerceOrderPageSchema`, `commerceOrderDetailSchema`.
- Schema worktree `commerce-address.ts`: `DeliveryAddress` and
  `deliveryAddressSchema` (being added at the latest handoff). Inline address
  collection is required and included in the checkout body; the shared address
  and checkout schemas validate it. Draft input survives conflict/unavailable.
- Payment worktree `commerce-payments.ts`: `CreatePayment`, `createPaymentSchema`;
  Josin worktree `commerce-http.ts`: `CommercePaymentView`,
  `commercePaymentViewSchema`. Customer POST `/v1/orders/:id/payment-intents` creates only an intent;
  202/pending/unknown is never rendered as captured or a paid order. Explicit
  retries retain the same payment operation ID, subject and method.
- The public catalogue/product schema and quote/reservation **response** validators
  were not present in the source at handoff inspection. These are integration
  prerequisites, not locally invented schemas. Missing schema ports return unavailable
  without requests. Coordinator owns shared files/exports and validator integration.
- Once frozen, supply `cataloguePage`, `product`, and an approved `presentProduct`
  presentation-only mapper. No product SQL/camelCase fields are guessed here.

HTTP methods: GET `/v1/catalogue?limit=25&after=UUID`, `/v1/products/:id`,
`/v1/orders?limit=25&after=UUID`, `/v1/orders/:id`; POST `/v1/cart/quote`,
`/v1/checkout`. Bare payloads are parsed with injected authoritative schemas;
401/403/404/409/503 are redacted to truthful UI states. Private errors revoke
visible records. The draft cart is explicitly not saved or reserved; only the
current server quote is confirmed. Reservation is **not paid**. An uncertain
checkout keeps its identical body/operationId for explicit retry, never starts a
new operation, and offers owner-order refresh. Owner order detail renders the
immutable delivery snapshot. Saved addressbook CRUD, profile editing, reorder,
tracking, invoice retrieval and provider SDK launch are individually unavailable.

Optional approved images use an HTTPS-only source with no URL credentials,
escaped alt text, fixed width/height, lazy loading and no-referrer. No images or
clinical content were invented; actual approved image data still needs the schema.

### Proposed aggregate entry — adapter design only

The earlier aggregate `CommerceCustomerViews` remains integrable for test fixtures
and future reviewed adapters, **not a claim that the missing aggregate API exists**.
Do not adapt unavailable addresses/profile/reorder into successful empty data.

Inject `locale`, optional `api: CommerceApi`, and `session: CommerceSession`.
The ready session contains the existing `ClientSession` and an `epoch` changed
after every session revalidation. Optional `onRefreshSession`, `onSignIn`, and
`onSignOut` callbacks belong to the senior-owned authentication adapter. Logout
clears private presentation immediately but is not claimed complete by the UI.
Background/page restoration, expiry, owner/epoch change, denied/error responses
and unmount clear private forms/records and fence aborted late replies.

Exact proposed methods, input fields and strict output projections are in
`contracts.ts`: `catalogue(context)`, `readPrivate(context)`,
`addItem({variantId,quantity},context)`, `setQuantity({variantId,quantity},context)`,
`saveAddress(AddressInput,context)`, `requestCheckout({addressId},context)`,
`reorder({orderId},context)`. Request context is `{locale,signal}`; mutation
context additionally carries CSPRNG `operationId` and server `revision`.
Each method returns `{status:"ready",data}` or a payload-free
`anonymous|denied|unavailable|error|conflict` status. Missing adapters display
unavailable, never browser-local success. HTTP paths remain domain-owner work.

Josin's accessible `commerce-access.ts` was inspected: its grants/document
references do not provide these catalogue/cart/address projections. These are
therefore proposed integration interfaces, not accepted backend contracts.
Map/review with Josin/Mathew before real API wiring. Server must enforce owner,
revision/idempotency, current eligibility, stock, serviceability and money rules.
Read refresh after uncertain mutation must reconcile server operation status;
never return `operation:"idle"` while an earlier operation remains uncertain.
No mutation is automatically retried, no tax/stock/payment calculation exists,
and all displayed totals/payment/order status come from validated projections.
Checkout only requests the reviewed server flow; provider SDK integration is not
implemented. Images/invoices were not added without an approved asset/link port.

New interface labels are English and explicitly marked; existing EN/ML/TA
foundation state strings and currency formatting are reused. Denzil/company
locale review remains required. No medical claims or translations were authored.

## Tests and wiring

- `tests/unit/customer-commerce.test.ts`: strict projections, invalid inputs,
  owner checks, empty/pending, redacted failures, duplicate-submit lock,
  timeout/no auto-retry, abort and ignored-abort late responses.
- `tests/unit/customer-commerce.fixtures.ts`: synthetic test-only fixtures.
- `tests/unit/customer-commerce-http.test.ts`: frozen HTTP routes, schema/CSRF
  prerequisites, exact operation retries, malformed data, redacted failures,
  approved image URL checks, no-store/abort and request body constraints.
- `tests/e2e/customer-commerce-http.spec.ts`: real browser fetch boundary with
  test-only finite parsers and routed authoritative quote/reservation fixtures;
  verifies an uncertain explicit retry uses identical body/operation ID.
- `tests/e2e/customer-commerce.spec.ts`: leader-owned harness `/commerce` on
  port 5184. Test adapter uses `GET /__test/session` (bare ClientSession),
  `GET /__test/commerce/{catalogue,private}` and
  `POST /__test/commerce/{add,quantity,address,checkout,reorder}` with
  `{input,revision,operationId}`. Test routes provide deterministic projections;
  HTTP 401/403/409/503 map to anonymous/denied/conflict/unavailable.

The original aggregate and browser harness remain for presentation regression;
do not wire aggregate fixtures into real services. Use the authoritative entry for
the implemented routes and inject actual shared schemas after integration.

The leader owns harness/config and integrated browser screenshots, desktop/mobile
inspection and full gates. Native/device/provider/production acceptance is not
claimed. Preserve changes uncommitted while shared security/mobile gates fail.

## Actual worker verification / preserved snapshot

- Frozen dependency install and local hook installation completed without changing
  the manifest/lockfile.
- Scoped Vitest: **42 passing tests**, two test files.
- Scoped Biome formatting/lint: passed after fixes.
- Workspace typecheck passed before the authoritative handoff. The final check is
  **blocked** by the five absent domain contract source files listed above (plus
  cascading inferred-type errors). Shared integration must supply them; they were
  intentionally not copied into this worker's restricted source ownership.
- E2E specs are authored, **not executed in this worktree**. Coordinator-owned
  harness/schema integration and desktop/mobile browser inspection remain pending.
- Full verify/e2e/security/mobile/precommit not rerun here after the leader reported
  shared security/mobile failures. No passing full-gate or production claim.
- No commit, push, PR, merge or deployment. Preserve the source/tests for leader
  snapshot copy and independent domain/frontend review.
