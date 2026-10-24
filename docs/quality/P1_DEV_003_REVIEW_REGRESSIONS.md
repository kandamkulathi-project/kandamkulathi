# P1-DEV-003 independent review retest register

Prepared 23 October 2026 for PR #5, `feature/p1-devadathan-sensitive-client-flows` → `dev`. Owner: Devadathan; independent sensitive reviewer: Mathew; financial-contract reviewer: Josin; retest coordinator: Tinu. All company requirements, six-member assignments and phase gates remain unchanged. This supplements [Tinu's canonical cases](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md), without marking them passed.

The previous candidate was `3e8803846335d7f374a324dd723b3eed80f97c12`. PR #4 is now merged into the reviewed foundation at `b71429c2f5c3b606be6f87dbadbdf000152d34e4`; this feature incorporates that base. PR #3 remains a separate prerequisite. Cloud setup, real business APIs/providers, native binaries/devices and phase acceptance remain Pending.

## Evidence rules and prerequisites

- Record the tested commit SHA, date, exact case/variation, expected and actual results, environment and restricted evidence location. Use synthetic records and test-mode providers only; retain no secrets, policy receipts, recordings or patient data in Git/logs.
- Use the pinned Node/pnpm versions and install from the frozen lockfile. Stop only your own local preview before browser tests; the test runner owns its public/workspace/Core/Companion servers. Do not terminate another member's occupied ports.
- Automated checks below execute portable client code and browser fixtures; they do not establish durable server idempotency, real consent storage, WorkOS logout, provider verification or native file deletion. Repeat the relevant journeys against reviewed unmocked integrations before acceptance.
- The implementation's focused regressions reproduced the defects before the fixes, then passed locally. **Independent retest: Pending for every row below.** Tinu must record her own result on the final pushed head; a green author/CI run does not close independent review.

## DEV003-REVIEW-001 — completed action identity and replay

Requirements: R03/R04/R05/R11/R13/R22/R36; relevant canonical consent, checkout, session and financial replay variations. Automated sources: `tests/unit/sensitive-client.test.ts`, `tests/e2e/sensitive-flows.spec.ts`.

1. In a fresh customer session, load current approved consent versions with required account/privacy choices accepted and consultation consent false. Enable a synthetic durable replay store keyed by authenticated session/route/idempotency identity. Reusing a stored key must return its saved response without repeating the state change.
2. Save false; change consultation consent to true and save; change it back to false and save. Wait for each definitive response before the next action. Inspect the resulting server state as well as the displayed response.
3. Expected: three distinct operation identities and three completed save actions, with two consent-value transitions (false → true → false); final server/UI consent false. A cached first withdrawal must not replace the final withdrawal. Optional marketing remains separate.
4. Load one existing pending payment. Reconcile without a provider receipt and receive pending. Make the synthetic verified provider state paid, then explicitly reconcile the same payment again without a receipt.
5. Expected: two operation identities and two current-state verifications; the second result is paid. No new order, booking or charge is created by either poll. Only verified server state may establish paid.
6. Simulate the server committing/storing the first reconciliation result, then dropping its response. Retry the same unresolved operation.
7. Expected: the client reports unknown and does not retry automatically; the explicit retry uses the same identity and replays the committed result with exactly one effect/verification. After that definitive response, a later new poll uses a new identity.
8. Repeat with 403, 409 and 410 responses: a later corrected user action gets a fresh identity. Repeat with 503, 500, malformed JSON/schema, disconnect and request timeout: unresolved identity remains available for retry. Never treat these failures as successful execution.
9. Complete more than 64 distinct consent actions in one lifetime. Expected: completed actions do not consume the 64 unresolved-operation slots. When unresolved slots are full, reject new actions without evicting an ambiguous operation or issuing a request under a replacement identity.

Acceptance beyond fixtures: Mathew verifies actual authenticated session/CSRF/consent persistence; Josin verifies reconciliation remains read/verify-only and cannot duplicate a financial effect. Independent/provider evidence: **Pending**.

## DEV003-REVIEW-002 — failed logout stays blocked during resume

Requirements: R03/R22/R36; canonical private-state/session/logout and lifecycle cases. Automated source: failed-logout case in `tests/e2e/sensitive-flows.spec.ts`, plus existing expiry/background/session tests.

1. Start with a verified customer fixture session and load a private payment summary. Count `GET /v1/session` requests. Configure logout to return 503 while the fixture cookie/session endpoint remains valid.
2. Select **Sign out**. Expected: session UI becomes anonymous; the loaded summary and signed-in controls disappear. The UI does not claim confirmed server revocation.
3. Trigger `visibilitychange` with the document hidden, then visible. Dispatch a persisted `pageshow` on each transition. Repeat page restoration while the document is already visible.
4. Expected after every event: session remains anonymous, private summaries and Sign out stay absent, no passive session fetch occurs. An expiry timer or late response must not clear the block.
5. Select **Check access again** explicitly. Expected: exactly one new session request is allowed. If the server still accepts its cookie, ready may return; the old private summary remains cleared and requires a fresh authorized record request. This does not claim the earlier logout succeeded remotely.
6. Repeat with an actually revoked/expired server session and with an account change. Expected: anonymous/denied or the newly authorized minimum view; no old subject's data returns. Test actual browser tab switching and back/forward restoration during integration acceptance.

The automated persisted-page event is a browser regression, not proof of all browsers' back/forward cache behavior. Independent unmocked WorkOS/revocation evidence: **Pending**.

## DEV003-REVIEW-003 — audio cleanup failure remains retryable

Requirements: R19/R22/R36; canonical microphone, permission, media teardown and private-file cases. Automated source: `tests/unit/client.test.ts`, portable recording controller. Native end-to-end execution below: **Pending supported Android/iPhone development binaries and an approved diagnostic fault adapter**.

1. Use a synthetic local recording only. In an engineer-controlled diagnostic build, make the recording port's first deletion reject after stop has completed. Record only stop/delete counters and file-exists flags, never audio bytes or file content. Tinu should obtain this diagnostic setup from Devadathan; no fault mode is added to the production UI.
2. Start microphone capture, then select Stop. Expected: failure is surfaced; stop succeeded once; deletion failed once; retained cleanup is unresolved. Selecting microphone again must not request permission, prepare another file or start another capture.
3. Retry Stop. Expected: deletion is retried and succeeds; the completed stop is not repeated. Only then may another explicit capture start. Verify the actual previous file no longer exists in the app sandbox.
4. Repeat the deletion failure, then dispose the controller via navigation/unmount. Expected: pending deletion is retried, stop remains at one call, and no new capture occurs. Repeated disposal after successful cleanup is harmless.
5. Make the first stop reject instead. Expected: cleanup failure remains visible; deletion does not run while stopping is unresolved; new capture stays blocked. Retry Stop or dispose. Expected: stop retries successfully, then deletion succeeds; no duplicate completed deletion.
6. Make preparation allocate a synthetic resource and then reject; also fail its first cleanup stop. Expected: failed partial preparation keeps cleanup pending, another Start does nothing, and disposal retries stop followed by deletion.
7. While stop/deletion is waiting, press microphone/Stop repeatedly and background the app. Expected: lifecycle cleanup is serialized; no overlapping new recording or premature idle/success. Restore, retry unresolved cleanup and verify microphone indicators/tracks and retained-file state.
8. Repeat permission denial, permission revoked during capture, the 15-second capture limit, locked-device/resume and navigation/disposal on each supported OS. Expected: no new recording without permission and unresolved cleanup stays blocked. Confirm actual Expo recorder/file semantics, not only synthetic counters.

A controller retry is possible only while its owning runtime remains available. Installed-device teardown, app termination/restart retention policy and real filesystem behavior require the existing native privacy review; portable tests do not establish those properties. Independent/native evidence: **Pending**.

## Execution and handoff

Run `pnpm verify`, `pnpm test:e2e`, the security/native compatibility commands and repository guards in [the command registry](../development/COMMANDS.md). Focused reproduction commands are `pnpm exec vitest run tests/unit/client.test.ts tests/unit/sensitive-client.test.ts` and, after building, `pnpm exec playwright test tests/e2e/sensitive-flows.spec.ts`.

Record the final head and all six hosted CI conclusions in the PR. Keep PR #5 open for Mathew's independent sensitive review, Josin's financial-contract review and Tinu's regression tracking. Missing actual backend/provider/native/cloud prerequisites are Pending or Blocked; author fixtures cannot mark integration readiness or a phase gate passed.
