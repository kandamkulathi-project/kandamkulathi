# Approved booking metadata and concrete offers

Local additive candidate for P1-MAT-002; company approvals and integrated acceptance
remain Pending. This adds public read-only discovery to the
[persisted booking runtime](BOOKING_RUNTIME.md), not another hold/payment lifecycle.
No company clinic/service names are invented or bundled as runtime defaults.

## Parent integration: append, never replace

Only append the SQL suffix beginning `-- APPENDED OFFER SLICE:` from
`packages/database/migrations/0003_mathew_booking.sql` into the parent's migration.
**Do not replace that migration wholesale:** the parent has independent restricted
JOBS/outbox policy fixes absent from this worktree's earlier prefix. Preserve them.
The parent owns its migration journal/checksum coordination. This suffix is for the
still-unreleased combined candidate; never edit an already deployed migration ledger.
The SQL introduces approved clinic/service metadata, explicit availability/modality
service mappings and a restricted public inventory function. No existing booking,
grant, payment or outbox behavior is rewritten.

New modules/exports (current explicit-source imports require no manifest changes):

- `packages/contracts/src/booking-offers.ts`: strict clinic/service/scope/query/offer/
  response schemas, `bookingOfferSlotId`, associated response/query/offer types.
- `packages/database/src/booking-offers.ts`: `readBookingMetadata(context)` and
  `readBookingOffers(context, input)`, both return strict shared response contracts.
- `apps/core-api/src/booking-offers.ts`: `registerBookingOffersRoutes(app, {withContext})`.
  The context factory supplies an event-scoped **CORE** connection. Register before
  the default unavailable fallback alongside existing booking/identity routes.

Optional parent-owned package subpaths: contracts `./booking-offers` ->
`./src/booking-offers.ts`; database `./booking-offers` -> `./src/booking-offers.ts`.
No shared index, package, dependency, lockfile, browser/session or CORS edit is included.
These are GET-only routes; parent shared `BROWSER_ALLOWED_ORIGINS` handling and strict
native bearer mutation helpers remain unchanged. There is no `allowBearerMutations`
option in this handoff. Browser identity is a separate active integration, not declared
permanently unsupported by this feature.

## Exact HTTP contract

`GET /v1/booking-metadata` returns:

```ts
{
  serverNow: string; // canonical PostgreSQL UTC milliseconds
  clinics: { clinicId: string; revision: number; displayName: string;
    clinicTimezone: string; publicationApprovalId: string;
    approvedByActorId: string; approvedAt: string }[];
  services: { serviceId: string; revision: number; displayName: string;
    publicationApprovalId: string; approvedByActorId: string; approvedAt: string }[];
  scopes: { doctorId: string; clinicId: string; serviceId: string;
    availabilityId: string; availabilityRevision: number;
    modality: "online" | "in_clinic" }[];
}
```

Use existing `/v1/doctors` for approved physician names/profile metadata. `scopes`
connects those doctors to the approved clinic/service labels and exact current
availability/modality. No client guesswork from UUIDs, hardcoded labels or fictional
clinic/service inventory is required. There is no new staff schedule-write API;
existing window reads remain the exact configured schedule read handoff.

`GET /v1/booking-offers` requires `doctorId`, `clinicId`, `serviceId`, `modality`,
`from`, `until`; optional integer `limit` defaults to 50, maximum 100. Times must be
canonical UTC milliseconds, increasing, at most seven days apart. Duplicate query
keys, unknown fields (including client `serverNow`), malformed IDs/dates and invalid
limits return 400 `INVALID_REQUEST` before SQL.

```ts
{
  serverNow: string;
  offers: {
    slotId: string; serviceId: string;
    slot: BookingSlot; // exact existing shared contract, including availabilityRevision
    fee: BookingFeeSnapshot; // exact approved integer-paise INR snapshot
  }[];
  truncated: boolean;
}
```

Slot identity is stable `offer:AVAILABILITY_UUID:REVISION:MODALITY:UTC_START` and is
validated against the nested canonical slot. It is **not** a reservation, checkout
token or authorization capability. To hold, use existing POST `/v1/bookings`, taking
doctor/clinic/availability/revision/modality/start from the selected offer and the
actual authenticated owner. Preserve new booking/operation UUIDs on retry. Do not
send a fee, end time, slotId or client clock as invented hold authority. Another
customer can win after discovery; existing hold GiST/CAS/current-authority checks
remain authoritative and return a truthful conflict.
The offer fee is a discovery snapshot, not permission to charge after a fee change;
clients must display/confirm the actual held booking's authoritative fee before
entering the existing financial flow.

Successful responses are `no-store`. Valid complete configuration with no free slots
returns `offers: []`, not simulated availability. Missing/unpublished/malformed named
metadata, inconsistent timezone/fee/policy or unavailable database yields 503
`BOOKING_METADATA_UNAVAILABLE` / `BOOKING_OFFERS_UNAVAILABLE`, with no private error
echo. Service mapping is explicit for each enabled published availability modality;
incomplete mappings fail closed rather than silently drop required metadata.

## Clock, grid, leave, occupancy and bounds

Both reads use the platform transaction helper with a short repeatable-read,
read-only snapshot. PostgreSQL `transaction_timestamp()` is the consistent returned
`serverNow` and function clock. Candidates align to the existing window's exact slot
grid, fit fully inside both the window and requested range, start in the future and
allow the current policy hold duration to finish by slot start. No clinician-specific
lead time, fee, grace period, recurrence or refund policy is invented.

Occupancy checks compare the proposed full buffered half-open interval against
doctor-global leave and all persisted held/confirmed occupied intervals, regardless
of clinic, modality or owner. A held row with an elapsed deadline still occupies the
interval until explicit expiry commits; expired/cancelled states do not. Exact
buffered adjacency remains available. Current published directory/configuration,
revision, modality and approved named mapping are rechecked by the inventory function.

Engineering bounds: maximum 200 published clinics, services and expanded schedule
scopes; larger/incomplete inventories fail unavailable (never silently truncate
metadata). A selected request can span at most 20 scopes, scans at most 2,000 grid
candidates per scope and returns at most `limit` offers sorted by start/identity.
`truncated: true` indicates either additional offers or the scan cap; narrow the
range to continue. These are technical budgets, not physician booking policies.

## Privacy and database privilege review boundary

CORE retains its existing owner/clinic RLS on booking rows. Public discovery never
receives private booking rows, customer/booking/payment IDs, count breakdowns or
arbitrary custom occupancy intervals. `clinical.mathew_booking_available_offer_starts`
returns **only configured free start instants and a truncation boolean**. Inputs bind
one published approved configuration/revision/modality and a bounded range; callers
cannot query arbitrary doctor intervals or off-grid probes.

The SQL function is fixed, SELECT-only, `STABLE SECURITY DEFINER` with fixed
`search_path = pg_catalog, pg_temp`, fully qualified tables, no dynamic SQL and no
PUBLIC execution. CORE receives only EXECUTE. Its owner is a dedicated NOLOGIN,
NOINHERIT, non-superuser, non-BYPASSRLS role `k_booking_offer_reader` with SELECT only
on the seven required tables, explicit SELECT-only booking inventory RLS policy and
schema USAGE. Runtime logins never inherit/can SET ROLE to it. The temporary CREATE
grant needed to transfer function ownership is revoked in the migration. No private
row API, RLS disabling, broad runtime membership, data mutation or auth policy bypass
is introduced. Independent security review remains required before acceptance.

Controlled provisioning owns the approved documents and mapping; runtime roles have
no INSERT/UPDATE/DELETE grants on metadata. Approval references, approver actor UUID,
approved time, actual company names and clinic IANA timezone must come from approved
persisted input. No seed silently fills them. The admin/migration context must retain
the normal role/grant/recovery review; the new non-login reader role must be included
when reviewing schema/role restore compatibility.

## Verification

Focused tests: `tests/unit/booking-offers.test.ts`,
`tests/integration/booking-offers-http.test.ts`,
`tests/platform/booking-offers.test.mjs`. Real PostgreSQL uses the existing isolated
platform fixture/proxy/non-owner harness. Cases cover missing/withdrawn metadata,
trusted clock/exact grid/fee/IDs, cross-clinic private held occupancy, elapsed holds,
terminal state visibility, buffers/adjacency, global leave, stale revisions, limits,
RLS/direct-role denial, safe HTTP errors, loopback HTTP E2E and a stale offer losing
the authoritative hold. Synthetic names/approvals are tests only, never company data.

Final focused rerun passed **3 unit/HTTP tests**, root/database/core-api TypeScript
checks and **all 5 actual PostgreSQL cases**, including loopback HTTP E2E and current
physician-clinic membership withdrawal regression. Repository checks and all 14
repository unit tests passed. The delivered source candidate is frozen/uncommitted.
No duplicate full verification,
browser campaign, commit, push or deployment is attempted; parent owns combined gates
and final registration. Parent already provisioned btree_gist and owns its prior
outbox/channel fixes; neither is replaced by this slice.
