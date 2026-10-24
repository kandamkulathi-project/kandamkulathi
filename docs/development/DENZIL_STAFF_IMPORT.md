# Denzil Phase 1 — staff reads and synthetic import support

Candidate for P1-DEN-001 / P1-DEN-003 only. Company, domain, security and phase acceptance remain **Pending**. No staff API, role matrix, import acceptance, stock mutation or database write is implemented here. R01/R05/R11/R32/R36 and P1-O03/P1-O05/P1-O06 remain integrated requirements, not completed by these fixtures.

## Leader integration

Export: `apps/workspaces/src/staff/index.ts` → `StaffReadViews`, `createStaffReader` and `createCommerceStaffReader`.

```ts
interface StaffReadViewsProps {
  session: Resource<ClientSession>;
  reader?: StaffReader;
  locale?: Locale; // defaults to "en"
  statuses?: Partial<Record<"orders" | "batches" | "schedules", readonly string[]>>;
}
type StaffReader = (
  kind: "orders" | "batches" | "schedules",
  query: { cursor: string | null; limit: number; status: string },
  signal: AbortSignal,
) => Promise<Resource<StaffPage>>;
```

Use the existing `useSession` result unchanged. Embed only in the staff shell. Missing `reader` renders Pending; non-staff grants render Denied without reading. Grants filter presentation only: **the server must verify current identity, staff MFA/organization, scope and record access on every read**. Parent session lifecycle invalidation remains necessary. Never turn a 403 into fixture data or infer permission from a filter.

`createStaffReader({ origin, local, endpoints, decoders?, statuses?, cursorParameter?, statusParameter? }, transport?)` accepts explicitly reviewed `/v1/staff/...` GET paths per view. There are **no default paths or decoders**. A decoder must use the owner's actual shared schema and map parsed data to the presentation protocol below. Missing endpoint **or decoder**, 404, 501 or 503 → Pending; 401 → sign-in required; 403 → Denied; network/HTML/invalid schema/oversized response → Error. Requests are credentialed, uncached and redirect-denying. The component uses a five-second timeout, aborts/fences superseded requests, hides records immediately on request/session changes, expires sessions and clears on background/pagehide. After backgrounding, refresh explicitly requests current records; no cache is reused. Session/data are never persisted or logged.

### Actual commerce DTO adapter — root mounting and live verification pending

`createCommerceStaffReader({ origin, local, clinicId, locationId?, clinicName? }, transport?)` parses the exact owner `canonicalUuidSchema`, `commercePageSchema`, `commerceOrderPageSchema` and `commerceBatchPageSchema` before mapping safe fields. The root supplies an approved directory association: clinic and location are distinct UUID domains, never inferred equal. Missing location mapping returns Pending without fetching; both supplied UUIDs are canonicalized/validated. Optional clinicName is bounded nonempty safe display text only; raw location IDs remain in order metadata and batch rows. Canonical files are imported relatively; the parent owns merging shared prerequisites and exports. No schema or server policy is copied into the adapter. Use a reader instance memoized by origin/environment/clinic/location/name, pass existing `useSession` output and leave `statuses` absent:

```tsx
<StaffReadViews session={result} reader={reader} locale={locale} />
```

The inspected owner handoff and actual `apps/core-api/src/commerce.ts` registration specify `GET /v1/staff/clinics/:clinicId/orders` and `/batches`, bare `{ items, nextCursor }`, pagination `limit`/`after` and current explicit server grants. No `/v1/staff/orders` alias was observed or guessed. A direct route-freeze message to Josin could not be delivered because the local session API returned 401; coordinator must confirm before release. **Do not point an identity decoder at these routes**: their payloads do not match `parseStaffPage`.

- `after` is the reader's default cursor parameter. Its UI requests limit 20, within the owner's 1–100 bound; owner default is 25.
- Orders retain every summary field: `orderId → id/reference`, `locationId → clinicLabel` and metadata, `amountPaise → totalPaise`, exact server status, currency/version/source/createdAt/expiresAt metadata. Source, version and timestamps have separate columns.
- Batches retain `batchId → id`, `skuId → productLabel/skuId` (identifier, not invented name), `locationId → clinicLabel/locationId`, exact batchCode/expiresOn, and **separate onHand, reserved and recalled fields/columns**. `recalled` displays the server boolean literally. No quantity subtraction, clamping, availability label or business status is invented, even if reserved exceeds onHand. Legacy quantity/status fixtures remain compatible; missing new legacy facts display a localized “Not provided”, never zero or false.
- Requests route by clinicId; DTO location IDs must match the explicitly supplied locationId, not clinicId. Mismatches fail closed as projection-integrity errors; optional names are never authorization evidence. The server must still authorize every read. Directory fetching, approved association selection and permission/action policy stay outside this factory.
- Actual endpoints do **not support status filters**: leave component `statuses` and reader `statusParameter` absent. Nonempty filters without an explicit status parameter are rejected before transport, never silently sent. `cursorParameter: "cursor"` / `statusParameter: "status"` are explicitly used only by the isolated synthetic test protocol.
- Exact clinic selection is a server-issued scope/input hint, not a permission. Server current staff organization/MFA and `orders:read` / `stock:read` checks remain mandatory. No role grant logic is copied.
- Booking handoff has public directory/availability and scoped single-booking reads, **no reviewed staff schedule list endpoint**. Leave schedules endpoint/decoder absent → Pending. Do not substitute public availability for private staff schedules.

The concrete commerce transport/DTO adapter is implemented; root mounting, actual authenticated Worker/database integration, route-owner confirmation and production acceptance remain Pending. No live commerce, booking or import journey is claimed by synthetic adapter tests.

The local strict version-1 response is a **presentation proposal**, not a competing domain contract. Mathew/Josin must review and map their shared contracts to it before enabling endpoints:

- Envelope: `{ version: 1, rows: [...], nextCursor: string | null }`, no extra fields.
- Every row: `id`, `clinicLabel`. Order/schedule status is exact server text; production batch rows have no invented status.
- Orders: `status`, `reference`, `totalPaise` (safe nonnegative integer paise), optional complete summary metadata as above.
- Batches: `productLabel`, `batchCode`, `expiresOn` (valid ISO calendar date); either legacy `quantity/status` or complete `onHand/reserved/recalled/locationId/skuId`. Mixed/incomplete projections fail strict parsing.
- Schedules: `doctorLabel`, `startsAt`, `endsAt` (valid UTC timestamps, end after start), `modeLabel`. No patient or clinical fields. Display timezone is Asia/Kolkata.
- IDs/cursors use bounded token syntax. At most 20 rows per UI page (reader maximum 100), unique IDs, response maximum 256 KB, labels maximum 160 characters. Unknown/private fields fail closed. Status labels originate at the server; no local state machine is inferred.
- Filters are explicit reviewed status-token lists shared between reader and component, defaulting to no filter options, and require an endpoint with actual filter support. They are not grants. Filter/view changes reset pagination; previous/next are cursor-based; loops are rejected/disabled. Totals are not extrapolated beyond the current page.

The UI reuses existing shared Button/Notice/client states/money/date formatting and incumbent workspace colors/type/spacing. No dependency, root wiring, package export or shared design file is changed. Optional `locale: Locale` defaults to `en`. `packages/i18n/src/staff-read.ts` supplies strictly identical EN/ML/TA keys marked **draft-unreviewed-nonclinical**, with an existing foundation denial label reused. It is temporarily imported relatively until parent export agreement. Approved server status/clinic/product/doctor/mode values are displayed verbatim, never guessed or medically translated. Monetary/date displays use the selected locale and Asia/Kolkata. Parent owns translation review and must retain existing bundled fonts.

## Synthetic import dry-run

Run with the pinned Node 24 toolchain:

```sh
node scripts/import-support/dry-run.ts tests/fixtures/denzil-import/valid.json
node scripts/import-support/dry-run.ts tests/fixtures/denzil-import/invalid.json
```

The CLI reads **one local file**, emits only a JSON issue/control report and never writes a file, calls a network service or opens a database. Exit 0 means synthetic checks/controls match, **not import approval**. Exit 1 means invalid input, invalid rows or mismatched totals; exit 2 means file/usage failure. `readyForWrite` is always false and review is always `JOSIN_REVIEW_REQUIRED`.

The version-1 envelope requires `synthetic: true`, a deterministic `asOf` ISO date, at most 10,000 rows/2 MB and exact expected controls. IDs must use the `syn-` namespace. Rows are clinic/product/variant/batch drafts; examples are in `tests/fixtures/denzil-import/`. These are **not Josin's authoritative template**. No approval, clinical text, GST/discount/wholesale rules, FEFO, shelf-life thresholds, opening-balance or inventory valuation rules are fabricated.

Josin's received `commerce-catalogue.ts` defines `openingRowSchema` / `OpeningRow`, `ImportReport` and `ImportControls`; those are deliberately **not copied here**. The local structural fixture check is not a substitute for that owner validator. Parent integration must pass owner-template raw rows to Josin's validation boundary and keep actual writes with Josin. `reference-register.json` separately records exact synthetic clinic/doctor fixture identifiers and candidate UUIDs, with company-reference approval Pending. It is not an opening import, physician approval, permission assignment or an actual company mapping.

Checks cover field/type/date validity, integer prices/quantities, all duplicate identities (including malformed duplicates), product/variant/clinic references and dependency propagation independent of file order. Expiry on/before `asOf` receives `EXPIRY_REVIEW`, a synthetic-fixture convention only; Josin/company must supply real expiry/shelf-life rules. Rejected rows never contribute to accepted controls. Issues use original 1-based row numbers, fixed codes and no raw cell values.

Reports compare expected/actual/difference for clinic/product/variant/batch counts, accepted batch units and **synthetic retail extension** (units × draft variant price, integer paise). Retail extension is neither opening stock valuation nor a ledger/finance figure. Unsafe aggregate arithmetic fails closed. Empty files truthfully yield zero accepted rows; zero totals are not evidence that company inventory is empty. Valid files and reports must be handed to Josin for authoritative validation and separately approved writes.

## Focused checks and parent handoff

```sh
pnpm exec vitest run tests/unit/denzil-staff-read.test.ts tests/unit/denzil-staff-commerce.test.ts tests/unit/denzil-import-validation.test.ts
pnpm --filter @kandamkulathi/workspaces typecheck
pnpm exec tsc --noEmit
```

`tests/e2e/denzil-staff-read.spec.ts` starts a serial isolated Vite fixture on port 5183 using `src/staff/testing/fixture.html`; the production app does not import/build this test entry. Cases exercise success, pagination/filter resets, unauthorized/customer grants, malformed/private fields, loading/empty/Pending, retries, stale responses, timeout, expiry/page lifecycle and narrow keyboard layout. Narrow ML/TA cases verify translated interface labels, localized money and unchanged server statuses. A bounded EN-desktop/ML-narrow/TA-narrow screenshot set is captured into test artifacts when the parent runs the cases; no screenshots have been executed/inspected by this agent. `denzil-staff-import.spec.ts` exercises the real local CLI success/failure reports. These are synthetic protocol/UI checks, not real authorization/RLS/device/import proofs.

Additional real-shared-DTO unit/E2E cases exercise lossless separate stock facts, order summary metadata, exact clinic routes/UUID keyset pagination, malformed UUID/cursor/unknown fields, 401/403/503, explicit recovery and lifecycle clearing. They use the actual owner schema imports with synthetic HTTP bodies; they do not prove server grants/RLS.

Per parent instruction, browser execution, full verify/precommit/security/build gates and commits are deferred. The parent must serialize browser/full gates using `/tmp/opencode/kandamkulathi-p1-e2e.lock`, independently review the candidate and mount the real adapter. Do not mark phase acceptance or import acceptance complete from these local checks. The parent's Tamil select/label min-width fix is retained unchanged from the follow-up comparison baseline.
