# Phase 1 integrated software candidate

The `feature/p1-phase1-backlog-integration` candidate combines the six owner lanes.
It is not a release or G1 decision. The phase/member plans, 38 company requirements
and independent acceptance obligations are unchanged.

## Implemented software boundaries

- Core registers persisted identity, required privacy bootstrap, exclusive native
  bearer authentication, booking offers/holds, canonical commerce checkout and
  knowledge indexing. Browser mutations use the verified session epoch and fresh
  CSRF; commerce requires current explicit grants, never role-based elevation.
- Customer web/native views consume the canonical catalogue, clinic directory,
  address-input, quote/reservation, payment and booking contracts. Clinic IDs and
  inventory-location IDs remain distinct. Server authority determines ownership,
  source, stock, fee and totals. Provider returns never establish payment success.
- Native sign-in, exact-policy consent, real session verification, shared serialized
  secure storage and uncertain native logout are mounted in the actual app. See
  [native auth client](NATIVE_AUTH_CLIENT.md). Missing approved server/provider
  configuration remains unavailable; no synthetic session unlocks private views.
  Additive migration `0027_native_expired_logout` permits an expired opaque handle
  only to revoke/reconcile its exact persisted session/provider binding, preventing
  expired policy review from permanently blocking sign-in. Ordinary authentication
  and business mutation expiry remain unchanged; remote uncertainty stays pending.
- Staff reads and source-backed knowledge authoring use canonical APIs. Authoring
  requires matching source bytes and one approved Core/Companion browser origin;
  independently authorized approval/withdrawal and current primary-source checks
  remain server-owned. Distinct root keys isolate sensitive sibling lifecycles.
- External jobs commit preflight before external effects and fence completion;
  commerce reconciliation retains its dedicated authority path. Unresolved expired
  financial work becomes durable `dead / financial_review_required`, never success.
- Migration `0026_outbox_payment_authorization` narrows payment outbox inserts to
  persisted financial obligations, captured ledgers or reservation expirations.
  Applied migration files are unchanged. Recovery is pause-and-roll-forward; do not
  restore the broader policy and reopen fabricated reconciliation obligations.
- QA tooling, synthetic fixtures, candidate-bound evidence and existing browser,
  unit, real PostgreSQL and security campaigns remain integrated.

Separate saved-address/account editing, reorder, courier fulfillment and generated
invoice/return workflows are explicitly unavailable in this slice. Private video,
voice and push retain their documented unfinished adapters/device proofs; do not
reclassify missing software as a company approval blocker.

## Verification and handoff

The pre-final-native baseline passed `pnpm verify` with 1,710 tests/122 files,
17 QA guards and 96 security regressions; its browser campaigns passed 195/195.
These are historical scoped results, not final committed-candidate evidence.
The native owner reported 62 existing focused tests and scoped security checks;
the platform owner reported 103/103 platform, 31/31 booking/payments and 15/15
commerce jobs after the authorization fix. The integrating candidate must execute
its registered-journal combined checks and receive fresh independent review.

User-directed manual testing is documented in the [manual handoff](PHASE1_MANUAL_TESTING.md).
No further test implementation expansion is planned; existing required checks are
not waived. Default local unavailable-state checks cannot prove positive business
journeys without approved configuration and isolated synthetic data.

Jira `KAN-1` and `KAN-57` record integration progress separately from acceptance.
PR #10's normal merge was rejected by required approval policy; the author cannot
self-approve. Earlier PR heads retain their own review/conflict status. No admin
bypass, promotion to `main`, deployment or G1 approval is authorized by this document.

Actual company policies/content/opening data, provider/callback configuration and
receipts, signed supported-device results, hosted operational proofs and independent
security/clinical/financial review remain pending. Record exact commit/build and
environment evidence; do not substitute a JavaScript export for device acceptance.
