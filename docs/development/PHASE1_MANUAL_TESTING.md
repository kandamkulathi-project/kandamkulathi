# Phase 1 manual testing handoff

This checklist exercises the integrated software; it does not grant G1, clinical,
financial, provider or release approval. Use synthetic records and provider test mode
only. Never use real patients, live charges or production credentials.

Check the [candidate and verification record](PHASE1_INTEGRATION.md) before testing.
Use the exact reviewed commit supplied in the delivery handoff and record
`git rev-parse HEAD`; do not assume an older open PR or a passing local run is the
final merged candidate. Hosted software failures remain blockers independently
of missing company/provider/device approvals.

## 1. Start the application

Use Node **24.22.1**, pnpm **10.34.7** and PostgreSQL **17**. Preserve local changes
before updating your checkout. Install with `pnpm install --frozen-lockfile`, then run:

```sh
pnpm dev
```

- Public site: <http://127.0.0.1:4321>
- Workspaces: <http://127.0.0.1:5173>
- Core liveness: <http://127.0.0.1:8787/health/live>
- Companion liveness: <http://127.0.0.1:8788/health/live>
- Native development server, in a second terminal: `pnpm dev:mobile`.

The default checkout intentionally has no approved identity, provider account or
business data. Unavailable private services in this configuration are expected;
they are **not** successful authenticated business tests. Merely entering URLs or
setting an approval flag does not supply approved configuration.

For positive journeys, have the responsible owner prepare an isolated approved
environment, migrated database, synthetic customer/staff/physician accounts and
current explicit grants/consents. Seed approved synthetic products, prices, tax
policy, stock, clinic-to-inventory-location mappings, doctors, slots and fees using
the documented owner-controlled process. Do not invent tax or clinical policies.
Use [setup](SETUP.md), [web authentication](WEB_AUTH_RUNTIME.md),
[native authentication](NATIVE_AUTH_RUNTIME.md), [commerce](COMMERCE_RUNTIME.md)
and [booking](BOOKING_RUNTIME.md). For the mounted native sign-in and privacy flow,
use [native client configuration and manual steps](NATIVE_AUTH_CLIENT.md).
Keep server secrets out of frontend variables.

Web authentication requires approved HTTPS callback/cookie configuration, including
when testing locally. Native authentication needs the approved environment-specific
callback `kandamkulathi-ENV://auth/return`. Real native payment requires a compatible
development binary with the pinned native SDK; Expo Go and a browser viewport do
not prove native compatibility. See [native prerequisites](../operations/NATIVE_READINESS.md).

## 2. Default, unconfigured smoke check

1. Open both web pages. Switch English, Malayalam and Tamil; check narrow-screen
   layout, keyboard focus, labels and readable errors.
2. Visit `/customer/shop`, `/customer/appointments`, `/staff/knowledge` and
   `/physician/knowledge` on the workspace site. Missing identity must not expose
   private records or enable payment, booking or authoring.
3. Check that an unknown route does not fall back to a private ready screen.
4. Missing provider/content configuration must say unavailable or pending, never
   show a fake successful login, payment, appointment or approved response.

## 3. Configured web journeys

| Journey | Manual steps | Expected result |
|---|---|---|
| Identity and privacy | Complete approved browser sign-in. If privacy consent is required, review the exact policy, first decline, then explicitly check agreement and submit. | Decline writes nothing. Only an authoritative verified session opens a workspace; recorded consent alone does not imply access. |
| Shopping | Open `/customer/shop`; select a mapped clinic/location and product variant, edit quantity, enter a synthetic delivery address, review the quote and explicitly reserve. | Current server prices/tax/stock determine the total. Reservation is not payment success. Invalid input or insufficient stock has a visible error. |
| Payment and orders | Start the provider test checkout for the reserved order. Try cancellation, then a fresh supported test payment; inspect the original intent/order after verification. | A callback alone never shows paid. Pending/unknown remains explicit until signed server processing/reconciliation confirms it. No duplicate charge/order after repeated taps or refresh. |
| Booking | Open `/customer/appointments`; select a doctor, clinic and available slot, review the current fee, hold and pay in test mode. Try an expired hold and competing attempts for the same slot. | No client-selected fee or confirmation. Only authoritative current booking/payment state confirms; unavailable, expired and conflicting slots remain distinct. |
| Staff scope | With an MFA-eligible scoped staff account, open `/staff`; inspect orders and stock for the assigned clinic. Try another clinic and a customer-only account. | Only explicit current grants allow reads. Foreign clinic/owner data stays hidden. An unavailable service is not an empty successful list. |
| Knowledge authoring | Open `/staff/knowledge` or `/physician/knowledge`; select a supplied canonical entry UUID. Attach the matching approved synthetic public source files, edit and save a new draft revision. | Matching source bytes and fresh server authority are required. The persisted revision reloads. Invalid/mismatched sources cannot save. |
| Independent approval | Use a different explicitly authorized physician to approve the current draft, then withdraw it. Attempt self-approval and a stale revision. | Self-approval and stale grants/revisions deny or conflict. Withdrawal must prevent subsequent current public use. |
| Companion | On Overview, explicitly send a synthetic public-information request. Try missing, withdrawn or wrong-language knowledge. | Only current approved cited content can be shown; otherwise truthful fallback/unavailable. No invented clinical advice or implicit action. |

Browser knowledge authoring requires Core and Companion routes under the **same
approved API origin**, paired with the current browser session and fresh CSRF.
The default separate loopback origins intentionally cannot establish that cookie
audience. Do not work around it by copying cookies or disabling origin checks.

Separate saved-address/account editing, reorder, courier fulfillment and generated
invoice/return workflows are unavailable in this slice. Do not record them as passed
because a placeholder or empty list renders.

## 4. Native and interruption checks

On a supported Android development binary and an iPhone development binary:

1. Sign in using the system browser. Exercise cancel, cold/warm return, expired or
   repeated callback, required privacy consent and a denied account. A callback must
   not itself grant a session; credentials must not persist before verified access.
2. Repeat shopping/address/reservation/payment and doctor/slot/fee/booking journeys.
   Exercise provider success, cancel, timeout and network loss. Only the original
   intent's server state establishes success.
3. Background during sign-in, policy review, payment and a private read. Return and
   refresh. Old callbacks/responses must not restore revoked access or private data.
4. Sign out, restart and switch accounts. Exercise a failed remote logout: private
   views must clear without claiming confirmed remote revocation. Check secure-store
   failure and that the previous account cannot be reused silently.
5. Exercise EN/ML/TA, large text, screen reader, keyboard and OS permission denial.

Video, voice, push, signing and provider acceptance retain their explicit device
and service prerequisites in the native readiness register; JavaScript exports or
local diagnostics do not replace those proofs.

## 5. Bounded completion proofs

Use only approved synthetic data and controlled policy provisioning; migrations
seed no approvals. Missing approval/configuration is **Blocked**, not a successful
business outcome.

- **Unpaid cancellation:** follow [cancellation setup](COMMERCE_CANCELLATION.md).
  Reserve an order without any payment intent; explicitly confirm its current
  version and cancel. Verify one cancellation/audit/outbox record, released batch
  reservations and unchanged financial ledger. Repeat the same request, use another
  owner, change the version, disable policy, and try an order with any payment
  intent. None may duplicate release or authorize a paid cancellation.
- **Native transcription:** follow [processing and build configuration](TRANSCRIPTION_PROOF.md)
  and [server admission](TRANSCRIPTION_ADMISSION_PROOF.md). Record a short approved
  synthetic clip; recording/Stop must not upload. Read the exact notice, acknowledge
  it and explicitly upload. Review/edit the returned text; Send is separate. Test
  denied microphone, oversize audio, stale notice, exhausted quota, concurrent
  uploads, background/logout, stop/discard failure and feature rollback. Cleanup
  failures must stay visible/retryable; late text must not repopulate the draft.
- **Initial durable notice:** follow [notice capability setup](CHANNEL_NOTICES.md).
  Exercise an authenticated provider event from the explicitly approved synthetic
  sender and record the actual provider receipt. Repeat the event; there must be
  one send. Disable approval, exhaust quota and send audio/status/non-approved
  events: human routing must remain available without an unapproved notice.
  Simulate lost provider response: unknown must not automatically resend.
- **Private video compatibility:** follow the isolated
  [SDK/TURN proof](P1_VIDEO_SDK_PROOF.md). Use short-lived synthetic participant
  grants, never a clinical booking or patient data. Prove actual web ↔ signed
  Android/iPhone media through TURN, permission denial, leave, expiry, background,
  revocation and restart failure. Mocked SDP, SDK-port tests and JS exports are not
  device compatibility evidence.

## 6. Record and report

For every run record the commit, environment, role, synthetic record IDs, device/OS
or browser, steps, expected/actual outcome and screenshots. Mark missing prerequisites
**Blocked**, not Passed. Do not include tokens, cookies, secrets or private records.
Use the [defect template](../quality/DEFECT_TEMPLATE.md) and
[canonical Phase 1 cases](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md).

Manual results supplement existing checks; they do not waive mandatory commit/PR
checks or independent review. Merging to `dev` is not promotion to `main`, deployment
or G1 approval.
