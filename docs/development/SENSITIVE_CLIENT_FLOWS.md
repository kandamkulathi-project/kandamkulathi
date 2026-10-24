# P1-DEV-003 — Sensitive client integration

Owner: Devadathan. Sensitive reviewer: Mathew; financial behavior reviewer: Josin. Prepared 22 October 2026 on `feature/p1-devadathan-sensitive-client-flows` → `dev`.

**Local client source is implemented. Real API/provider integration, cloud setup, native compilation/device verification, independent review and phase acceptance remain Pending.** No client fixture establishes authentication, ownership, payment, clinical safety or a private call. Core still returns `503 FEATURE_UNAVAILABLE` for these unfinished APIs.

## Baseline and branch dependency

Created from fetched `origin/dev` at `a6fb539930e56c1a58eca424834322800deee977`, then locally fast-forwarded to the P1-DEV-002 candidate `a82e8fcc9fb5f557a88a2362689f6b710a43521b` as an explicit dependency. On 23 October, PR #4 was already squash-merged into `dev` as `b71429c2f5c3b606be6f87dbadbdf000152d34e4`. This review revision incorporates that reviewed base into this feature branch, resolving the duplicate-foundation conflicts while preserving its credentialed, restricted local CORS and security pins. PR #3's platform/database code remains separate. No shared branch, remote resource or deployment was changed by this revision.

Already present: shared session/return/link contracts, workspace grant presentation, uncached requests, native secure storage, lifecycle cleanup, media diagnostics, three-language fonts and security tooling. This package supplies the missing sensitive client controls, not the other members' domain implementations.

## Local implementation

| Surface | Behavior and boundary |
|---|---|
| Sign-in | An uncached response may name only the fixed same-API `/v1/auth/authorize` continuation. Arbitrary redirect URLs/extra fields fail validation. WorkOS state/PKCE, cookies, return destinations and native code exchange remain server integration work. |
| Session/CSRF | Memory-only security context must match the verified subject, session ID and expiry. Mutations fetch fresh context, send `X-CSRF-Token` and stable per-action `Idempotency-Key`, and reserve the mutation slot before awaiting. These client checks do not implement server authorization/CSRF or durable idempotency. |
| Requests | Fixed UUID routes; included credentials; no-store; no redirects; bounded 64 KiB response; five-second abort. 401 invalidates the local lifetime, 403 clears the view, 409 requires refresh, 410 expires, 503 stays unavailable. A lost/malformed mutation response is uncertain; no automatic mutation retry. |
| Logout | Clear private views and the client lifetime even if remote revocation fails. Passive visibility/page restoration and expiry cannot clear that local block or re-fetch the cookie. Only explicit **Check access again** can revalidate it. Native also attempts OS credential removal and surfaces storage errors. An unsuccessful logout does not confirm server revocation; an explicit later session refresh can still find a valid cookie until the server revokes it. |
| Consent | Display escaped server-supplied policy text and versions. Required account/privacy choices, separate consultation consent and optional marketing remain distinct. Submit only versions/choices; the server must record the verified subject, actual timestamp and immutable policy revision. |
| Payment | Show current integer-paise amount/status, then re-fetch before SDK launch. Changed amount/revision requires another user review; expired operations cannot launch. Success/cancel/failure/malformed SDK outcomes all require reconciliation. Only server state can display paid. Unknown outcomes never create a replacement charge automatically. |
| SDK | Browser loads the official Razorpay script only for an explicit valid pay action. Native pins `react-native-razorpay@3.0.0`, lazy-loads it for a supported native development build and rejects Expo Go. Loopback web/nonproduction native rejects live keys. No patient prefill, clinical notes, private token or arbitrary callback URL enters checkout. Automatic SDK retry is disabled. |
| SDK lifecycle | Browser checkout closes on disposal/timeout. Native 3.0.0 has no programmatic close API: late outcomes are fenced, and the SDK lock stays held until the actual SDK settles even after lifecycle/timeout cancellation. Re-entry must reconcile current state; this needs real-device verification. |
| Booking | Minimal doctor/clinic/service/timing/role/status/identity/consent/intake summary. Held/payment-pending expiry is checked each second; expiry never becomes confirmation. Visible appointments refresh every 15 seconds. Resume clears private views and requires fresh session/record access; the server must enforce revocation immediately on every operation. |
| Intake | Only customer-scope, identity-verified, currently consented, physician-approved questions are editable. IDs cover age, medication, pregnancy, child and red flags. Empty values become unknown for approved server clarification/handoff; the contract also supports declined answers. No diagnosis, dosage, eligibility or red-flag policy is invented. Public catalogue browsing has no clinical intake. |
| Consultation | UI gates grant requests on booking, identity, consent, approved accepted intake and join window. Shared `consultationAccess` re-fetches the appointment, binds exact grant reference/revision/deadline, fences delayed setup and closes on deadline/leave/disposal. Its transport port awaits reviewed signaling integration. UI explicitly reports transport Pending and starts no call or camera. |
| Native session | Shared validated API with SecureStore bearer attached only to the exact configured API origin. No credential goes to the provider. Resume creates a fresh session/client; background, expiry, account change and logout discard private state/SDK results. Native auth provisioning and installed-device verification remain Pending. |
| Privacy | No browser local/session storage, IndexedDB, Cache API, service worker, private query link, analytics or client logging. Tickets stay in memory and are not rendered. Actual hosting/database/object/backup encryption and approved processor flows need configuration evidence. |

Mutation-key memory is bounded to 64 **unresolved** distinct actions per local client lifetime. Retain the key across lost, timed-out, malformed and server-failure responses; retire it after a schema-valid successful response or definitive 403/409/410 rejection. A successful reconciliation returning business status `pending` still completes that poll: a later user poll gets a new identity and current provider verification. A repeated consent choice after intervening changes is also a new action. Never evict an ambiguous operation to free space. A full session/client refresh starts a new lifetime; backend operation uniqueness must survive refreshes. Reconcile must never create a new charge/order/booking. Reconnecting video always requires fresh membership.

Native recording cleanup tracks stopping and file deletion separately. A failed step stays pending; Stop or dispose retries only unfinished steps. Deletion waits for successful stop, and new capture stays blocked until both finish. Partial preparation also retains cleanup obligations. Portable-controller tests do not prove Expo/native filesystem behavior; the installed-device cleanup campaign stays Pending.

## Proposed API contracts — backend/domain review Pending

Schemas: `packages/contracts/src/sensitive.ts`; requests: `packages/client/src/sensitive.ts`. No auth bypass or successful domain route was added to Core. Review names/envelopes against API conventions before integration; change both clients, contracts and tests together if the reviewed backend differs.

| Request | Required response / server boundary |
|---|---|
| `GET /v1/auth/start` | Exact `{redirectPath: "/v1/auth/authorize"}`. Server owns approved WorkOS redirect, state/PKCE and safe return destinations. |
| `GET /v1/session` | Existing verified user/expiry/workspace contract. Native bearer and web cookie must enforce the same authorization policy. |
| `GET /v1/security/context` | Verified user UUID/session UUID/expiry/CSRF token; session-bound, uncached, protected against invalid origin and expired contexts. |
| `GET /v1/consents/current` | Current approved policy texts/versions and this subject's flags. No invented legal or medical policy. |
| `POST /v1/consents` | Versioned choices → current consent. Record subject/time on server; conflict stale versions; marketing stays optional. |
| `POST /v1/session/logout` | `{revoked: true}` only after actual revocation. Unconfirmed failures remain uncertain. |
| `GET /v1/payments/:id` | Owner-authorized current amount/revision/status, nullable public SDK options. Validate current stock/tax/price/policy/hold before issuing a payable operation. Client amounts are never authoritative. |
| `POST /v1/payments/:id/reconcile` | Current state after actual provider verification. Optional receipt is only an order/payment/signature hint; verify using server secrets and captured state. Never create another charge. |
| `GET /v1/appointments/:id` | Owner/assigned-physician/permitted-staff minimum summary. Enforce clinic, assignment and clinical policy on the server. |
| `POST /v1/appointments/:id/intake` | Current revision/policy plus bounded answers/dispositions → refreshed summary. Physician-approved unknown/declined/child/pregnancy/red-flag routing must precede any personalized recommendation. |
| `POST /v1/appointments/:id/video-grants` | Current revision → short-lived, single-use actor/session/appointment-bound ticket. Recheck assignment, current identity/consent/intake, paid/confirmed status and time window. Revoke on membership/session/consent changes. |

All POSTs need server identity, scope/ownership, approved Origin/CSRF and domain-appropriate durable idempotency. Local CORS now allows POST with exactly `Content-Type`, `X-CSRF-Token`, `Idempotency-Key`, retaining P1-DEV-002's four exact local origins. Unconfigured remote origins stay denied. This enables transport, not a business operation; absent APIs still return 503. Production origins, cookie/SameSite policy, native exchange and server CSRF remain Pending.

The private transport must authenticate before SDP/ICE/media, keep bearer tickets out of URLs/logs, use approved TURN, recheck membership on reconnect, and close sockets/peers/tracks on revoke/expiry/background/leave. A local camera preview cannot prove that boundary. WebRTC remains the stack; no unnecessary broad-permission native plugin was added before its assigned proof/integration work.

## Evidence and limits

The 23 October review regressions first reproduced stale replay keys, lost audio cleanup retries, and lifecycle logout unblocking on the previous source/build. Permanent replay-aware unit/browser cases now cover repeated consent withdrawal and receipt-free pending-to-paid polling; the lost-response case commits a synthetic replay record before disconnecting. The failed-logout browser case checks hide/show, persisted pageshow, no passive session reads and explicit retry. Stop/deletion failures and partial preparation have retry/blocking unit cases. Exact steps, expected results and independent/native evidence status: [review retest register](../quality/P1_DEV_003_REVIEW_REGRESSIONS.md).

Checkout adapters receive a live operation-deadline/lifecycle guard and recheck it after browser script download/native initialization and immediately before SDK launch. A browser regression held the script until after expiry and reproduced an unwanted SDK launch on `9d8306c`; the permanent guard prevents it and still reconciles server state. No expired operation is retried as a new payment.

The local grant adapter refuses expired grants or lifetimes above five minutes; Mathew must confirm the final shorter server policy during contract review. Current local join bounds use the appointment start/end; incorporate a separately approved early-join window in the reviewed contract if required. Appointment revocation can take up to the 15-second presentation refresh to disappear, while the real server/transport must revoke access immediately. No live call exists in this candidate.

- `tests/unit/sensitive-client.test.ts`: strict consent/money/intake schemas; subject/session/expiry/CSRF/idempotency; concurrent submission; uncertain/stale response; redirects/logout; SDK success/cancel/malformed/foreign order; changed price; hold/grant/window checks; delayed media/leave; membership deadline and unknown/declined handoff.
- `tests/integration/http.test.ts`: actual Hono origin/header preflight and unavailable routes. A preflight pass is not server CSRF/auth proof.
- `tests/e2e/sensitive-flows.spec.ts`: unmocked Chromium→local Worker sensitive POST/503; fixture consent, actual application SDK adapter/reconciliation, changed price, forbidden reference, hold expiry, intake/handoff, background/revoked assignment and ML/TA narrow layout. Storage inspections use synthetic private records.
- Fixtures exist only under `tests/fixtures`; production apps import no test records or fake business-success API. The external Razorpay replacement does not establish a sandbox charge, signed callback, persisted invariant, native SDK or real private call.
- Existing security/runtime/dependency/scanner/native-plugin checks stay mandatory. Raw locally patched advisories remain visible. Android/iOS JavaScript export does not compile, link or install the new native SDK.

Run the existing [full verification and commit gate](COMMANDS.md). Keep all canonical phase/company cases Pending until independently executed with real prerequisites; fixture passes never close the acceptance register.

## Handoff and remaining acceptance

| Owner | Next action |
|---|---|
| Mathew | Independent sensitive review; actual WorkOS/native exchange, CSRF/origin policy, clinical scope, consent ledger and private signaling. Provide isolated non-owner PostgreSQL/RLS and revocation evidence. |
| Josin + Mathew | Review payment envelope/options; server-created Razorpay orders, captured-payment verification, durable financial/booking invariants and refunds. Prove loss/replay/cancel cannot duplicate or falsely confirm. |
| Devadathan | Integrate approved APIs/transport; compile company development binaries and execute Android/iPhone auth/checkout/resume, SecureStore, membership/media/TURN and language/accessibility campaigns. Cloud setup stays deferred. |
| Paul + Denzil | Use shared controls/contracts. Their feature forms/staff/content implementations were absent from this candidate, so review is Pending. Review actual incoming changes for escaped policy text, separate marketing, minimum scope, current totals/status, uncertain outcomes and lifecycle cleanup. |
| Tinu | Track canonical P1-T02/P1-T06/P1-T08/P1-T09/P1-T10/P1-T11/C03 and relevant F-R variants. Re-run local regressions, then repeat against unmocked reviewed APIs/providers on both native platforms. Missing prerequisites are Blocked. |
| Company/domain approvers | Approve policy texts, identity/intake/routing, translations, processors/residency and supported devices. No company policy is invented or accepted here. |

Traceability: **P1-DEV-003**, retained P1-E3-002/P1-E3-003/P1-E4-002/P1-E4-003; **R01, R02, R03, R04, R05, R11, R12, R13, R14, R19, R22, R25, R32, R36**; **P1-O04/P1-O05/P1-O06**. Only Devadathan's local portion changes; all requirements, six members, tasks, hours, branches and gates are preserved. Catalogue/cart/address/history/directory/staff-content screens remain with their named owners; these reference-based integration controls do not replace those journeys.

Primary references checked: [Razorpay web integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [official native SDK](https://github.com/razorpay/react-native-razorpay). Broad peer ranges and successful JavaScript export are not native compatibility certification.
