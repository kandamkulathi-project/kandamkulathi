# Commerce catalogue / FEFO handoff

P1-JOS-001/002 candidate; finance/warehouse and independent Mathew review required.

## Integration contract (early freeze)

- Source modules: `packages/{contracts,domain,database}/src/commerce-catalogue.ts`.
  Coordinator must add package subpath exports; this worktree cannot edit manifests.
- Migration `0020_commerce_catalogue.sql` must be registered by the coordinator in
  `packages/database/migrations/meta/_journal.json` (actual runner uses that journal).
  Until registration, tests explicitly apply this migration after platform setup.
- `CommerceCatalogueRepository(context, actorId)` uses the existing event-scoped
  DatabaseContext, transaction and enqueue helpers. Actor UUID must come from verified
  server identity, never request JSON. No external calls inside transactions.
- `quote(input)` returns current versioned lines and integer-paise totals;
  `checkout(input)` requires those versions and explicit confirmation, returns
  persisted `orderId`, `amountPaise`, `currency`, `expiresAt`, `status`.
- Frozen response schemas: `commerceProductSchema`, `commerceCataloguePageSchema`,
  `commerceQuoteSchema`, `commerceCheckoutSchema`. Public standalone functions
  `readCommerceCatalogue(context,{limit,after?})`, `readCommerceProduct(context,id)`
  need no actor. Product shape uses `skuId` and aggregate `stockStatus` only.
- Constructor third argument is options `{source?: "web" | "native", authorizeTransaction?:
  (context: DatabaseContext) => Promise<void>}`, default source `"web"`.
  The guard runs after actor context is set at the start of every scoped transaction
  (including retries), before domain reads/writes. Backend must inject its current
  authoritative SQL identity/session guard; it must not perform network work.
  No client source override. Other channels need a later authorized composition.
- Checkout requires structurally validated `deliveryAddress`; the immutable snapshot
  is `core.commerce_order_addresses(order_id,address)`, explicitly owner-only even
  when staff gain order visibility. No runtime update/delete. Orders retain only a
  SHA-256 operation fingerprint, never the address. Address validation does not
  establish courier serviceability.
- Hold duration has **no default**: provision an active approved singleton in
  `core.commerce_checkout_policies(hold_seconds,approved_by,approval_reference,active)`.
  Missing policy denies. The order snapshots its approval reference.
- Payment FK target: `core.commerce_orders(id uuid primary key)`, owner `actor_id`,
  `amount_paise bigint`, `currency='INR'`, `status='reserved'`, `expires_at`,
  `operation_id uuid unique`, `version integer`. Payment agent owns extensions,
  not changes to this migration. Checkout never asserts paid status.
- Reservations: `core.commerce_reservations` link order, SKU and batch, quantity;
  stock is `on_hand - reserved`. Parent owns expiry/release in
  `commerce-reservations.ts` and migration `0022`, including held/released states,
  guarded decrements and atomic expiry/outbox. This migration creates initial rows
  only; parent must wire scheduled expiry. Lock order then sorted SKU/batch rows.
- Financial outbox uses existing `commerce.reconcile` with subject=order UUID,
  operation=checkout UUID. Unsupported handlers remain pending/denied, not success.

## Payment callback handoff

Per final coordinator ownership, the parent implements order capture/payment
application in its separate module/migration; there is **no payment state helper**
in this catalogue module. Compose its trusted callback inside the verified receipt,
ledger and financial outbox transaction; never use a browser return as payment proof.
Lock order, sorted SKUs then FEFO batches and preserve current expiry/recall/shelf
life, reservation totals and guarded stock updates. Late payment requires durable
reconciliation, not false paid or silent release/refund.

Expiry date calculations use UTC, explicitly set transaction-locally. Parent-owned
expiry and verified payment application must serialize on the order lock. Expiry
never erases a capture: late capture requires the payment owner's durable financial
reconciliation. CORE has no order-status UPDATE privilege.

## Safety policy

Prices are exclusive-base paise. Only explicit finance-approved tax policies with
integer basis points and `half_up_line` rounding are supported; absent/withdrawn
policy denies checkout. No implicit zero-tax default. Consult-only sales deny until
the clinical owner supplies a current authoritative eligibility implementation.
Published content approval is explicit. Import is all-or-nothing with row errors
and supplied row/unit/base-value control totals. Staff import grants are provisioned
administratively in `core.commerce_import_grants`; clients cannot self-grant.
Multiple rows/operations may reuse a SKU only when **all SKU metadata is identical**;
each row supplies a distinct batch UUID and SKU/location/batch-code identity. Existing
SKU metadata/prices are never overwritten. Conflicting SKU IDs/text/metadata and
duplicate batches are rejected. The import definer returns authoritative row-indexed
`unknown_location`, `unapproved_tax`, `conflicting_sku` and `duplicate_batch` errors
before any write. It serializes opening imports with advisory key `(871295,20)` and
locks relevant grants/reference/SKU rows, preventing concurrent import races from
turning expected conflicts into partial writes or unstructured SQL failures.
FEFO excludes recalled and expired stock and observes minimum remaining shelf life.
Locks are sorted SKU first, then expiry/batch UUID. No SKIP LOCKED checkout.

Public catalogue reads are approved records only; private orders/reservations are
actor-scoped with FORCE RLS. Backups have read-only policies. Runtime cannot delete
records or mutate approved prices, tax policies, catalogue or opening balances.
Batch reads/reservations additionally require transaction-local
`app.commerce_mode=checkout`, set only by private quote/checkout pricing. Actor
identity alone does not expose clinic batches. Public catalogue uses the restricted
aggregate stock function, not checkout context. Later staff batch policies must
independently require authoritative actor/clinic/stock-read grants. GUCs are trusted
server composition capabilities, never request-supplied authorization.
Import uses a restricted SECURITY DEFINER function with a fixed search path and
checks an administratively provisioned actor/location grant.

## Verification / integration work still required

Focused tests: `pnpm exec vitest run tests/unit/commerce-catalogue.test.ts` and
`node --test tests/platform/commerce-catalogue.test.mjs`, with the latter under the
shared `/tmp/opencode/kandamkulathi-p1-e2e.lock` and the privately sourced PG 17
environment. The real-PG pack covers independent-session last-unit and duplicate
operation races, FEFO expiry/recall/shelf life, rollback of multi-item shortage and
outbox failures, authoritative price/tax/hold policies, import errors/control totals,
public projection/keyset pagination, scoped guards/context cleanup, immutable address
privacy even with staff order visibility, and restricted-role pg_dump.

Coordinator must register migration 20, expose package subpaths, inject the current
identity/session SQL guard, compose payment application and HTTP authorization/CSRF,
and run integrated browser/security/platform gates. No migration has been applied
to shared/company resources. This worktree has no enabled courier serviceability,
clinical eligibility, reservation release or tax-policy provisioning workflow.
Only synthetic explicit policies belong in fixtures, never production defaults.
