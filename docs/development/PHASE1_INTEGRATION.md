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
- The completion working tree mounts the owner-only, version-confirmed unpaid-order
  cancellation scaffold (`0028`) and independently routed durable template notice
  (`0029`). Both require externally approved, unseeded policies/capabilities. Notice
  uncertainty never resends automatically; disabling approval prevents new sends.
- Bounded native transcription is mounted behind an explicit nonproduction build
  flag and complete approved EN/ML/TA notices. Recording, notice acknowledgement,
  upload, editable review and Send remain separate actions. Server admission (`0030`)
  enforces approved per-actor lifetime quota/concurrency before provider work; unknown
  work retains its quota/slot pending controlled reconciliation. Cleanup failures
  remain visible and retryable after logout or feature rollback.
- Native/browser WebRTC adapters and an isolated synthetic two-member Durable Object
  harness provide the technical compatibility path, not clinical grant issuance.
  Actual default-off development diagnostic controls are mounted through workspace
  and native app roots, separately from clinical authority. Exact SDK/plugin pins
  and relay-only transport do not certify signed-device support.

Separate saved-address/account editing, reorder, courier fulfillment and generated
invoice/return workflows are explicitly unavailable in this slice. Full production
voice/video/push delivery is later-phase work; bounded Phase 1 proofs still require
actual approved provider/device evidence. Final combined verification and review
are being completed; do not reclassify missing integration
as an external approval blocker.

## Verification and handoff

The pre-final-native baseline passed `pnpm verify` with 1,710 tests/122 files,
17 QA guards and 96 security regressions; its browser campaigns passed 195/195.
These are historical scoped results, not final committed-candidate evidence.
The native owner reported 62 existing focused tests and scoped security checks;
the platform owner reported 103/103 platform, 31/31 booking/payments and 15/15
commerce jobs after the authorization fix. The integrating candidate must execute
its registered-journal combined checks and receive fresh independent review.

Committed core candidate `dbda202d35b947bd633620fb3ad0aeafd0734016` passed its
mandatory gate: 1,715 tests/122 files, 17 QA guards, 96 security cases, 195 browser
cases, 103 platform cases, builds/types, security/mobile checks and 23 documentation
tests. Its clean `verify:p1-local` failed because the later development browser
campaign deleted the main browser binding. Output isolation and a reproducing
actual-CLI regression are fixed in the completion working tree; no clean-candidate
pass is claimed until rerun. GitHub also exposed the 30-request native-auth test's
generic 10-second I/O budget; a scoped 20-second budget preserves every rate assertion.

The first completion gate stopped on duplicate registered-transcription fixture setup
and a cancellation SQL-privilege regression. Both were corrected without changing
the existing paid-mutation assertions. The second gate passed 1,790 main tests,
44 video/control tests and 204 E2E cases, but its platform campaign hung in the
booking financial-callback rollback case and was cancelled by the 600-second
command budget after 16 passes. It is **not** a passing mandatory gate; no completion
commit was created. Subsequent bounded platform execution completed without hanging:
87 cases passed and 17 catalogue cases exposed an explicit reset list missing the
new cancellation foreign-key table. That fixture list is corrected without CASCADE
or changed assertions. The stock-release boundary fix now has independent static
review and 42 passing PostgreSQL/unit cases, including 11 unchanged payment-order
tests; it is integrated for another complete gate. No hang cause is claimed.

User-directed manual testing is documented in the [manual handoff](PHASE1_MANUAL_TESTING.md).
No broad test-scope expansion is planned; minimal feature/review regressions and
existing required checks are not waived. Default unavailable-state checks cannot prove positive business
journeys without approved configuration and isolated synthetic data.

Jira `KAN-1` and `KAN-57` record integration progress separately from acceptance.
PR #10's original normal merge was rejected by required approval policy. The user
subsequently authorized a PR-only bypass for `mathew1046` and ready PR merges to
`dev`; this is not self-approval or permission to waive checks/findings. Integration
is published as [PR #11](https://github.com/kandamkulathi-project/kandamkulathi/pull/11).
CodeRabbit reviewed the older owner/security PRs; its PR #11 review was **skipped**
because 535 files exceed the 300-file limit. A green bot status is not review evidence.
Scoped independent reviews and review corrections remain required. No promotion
to `main`, deployment or G1 approval is authorized by this document.

Actual company policies/content/opening data, provider/callback configuration and
receipts, signed supported-device results, hosted operational proofs and independent
security/clinical/financial review remain pending. Record exact commit/build and
environment evidence; do not substitute a JavaScript export for device acceptance.
