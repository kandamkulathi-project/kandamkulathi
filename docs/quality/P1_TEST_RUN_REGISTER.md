# Phase 1 Test-Run Register — Foundations & Core Journeys (G1)

**Document ID:** KND-QA-REG-001
**Version:** 1.1
**Inventory Review Date:** 2026-10-24 (source inspection, not a campaign execution)
**QA Lead / Test Coordinator:** Tinu (Role: QA Coordination, Fixtures, Basic Regression, Evidence Collection & Gate Reports; no feature development ownership)
**Governing Canon:** [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md)
**Supporting Plans:** [Kandamkulathi_10_Tinu_QA_and_Test_Cases_All_Phases.md](../implementation/Kandamkulathi_10_Tinu_QA_and_Test_Cases_All_Phases.md), [Kandamkulathi_02_Phase_1_Foundations_and_Core_Journeys.md](../implementation/Kandamkulathi_02_Phase_1_Foundations_and_Core_Journeys.md), [TEST_STRATEGY.md](TEST_STRATEGY.md)
**Historical inspection baseline:** `a6fb539930e56c1a58eca424834322800deee977`; not current `dev` and not a frozen acceptance candidate.
**Current reviewed dev inventory:** `cfa4c4821a7db9c39fa27dd2ee0541d71111a741`; refresh this snapshot when integrating further work. No execution result is transferred to this SHA.
**Assigned Task:** KAN-98 / P1-TIN-001

---

## 1. Governance and Authority Rules

1. **Source of Truth:** This register operationalizes canonical test groups `P1-T01`–`P1-T20` defined in [the canonical campaign](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#5-phase-1--g1--detailed-campaign-procedures). Existing IDs remain stable; new IDs append missing variations. Descriptions below are execution checkpoints, not alternative clinical/financial policy. The linked canonical action and expected result govern every row.
2. **Status Definitions and Consistency:**
   - **Pending:** Prerequisites are available and the test has not yet been executed.
   - **Blocked:** The test cannot be executed because an implementation, environment, dependency, approved oracle, or other required prerequisite is missing. A known missing prerequisite strictly prevents a test from being marked `Pending`.
   - **Pass:** The test was actually executed against an identified candidate and all acceptance criteria were met with recorded evidence. A missing or partial implementation must never be marked `Pass`.
   - **Fail:** The test was actually executed against an identified candidate and one or more acceptance criteria failed.
3. **Execution-Result Integrity:** Statically inspecting source code, finding that an endpoint returns a 503 stub, or identifying unbuilt routes does not constitute runtime test execution. Rows where `Exec Date` is `Unexecuted` explicitly state `Not executed` and preserve identifiable repository-inspection findings without representing source-code observations as runtime test results.
4. **Independent Role Boundary:** Tinu coordinates QA, records execution evidence, logs defects, and verifies gate readiness without owning feature-development implementation. Feature implementations, migrations, security scans, load tests, and domain oracles remain owned by their respective domain leads.
5. **No aggregate Pass:** every role, channel, language, boundary and fault selected under the [mandatory matrix](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#91-how-to-turn-each-procedure-into-exact-run-rows) needs its own run record. Compound legacy descriptions are split into additional rows below; a parent/checkpoint row cannot pass its unrun children. Before a campaign, bind the actual supported combinations and add suffixed run IDs without renumbering existing IDs. Missing matrix/approved values blocks execution; no full Cartesian product or invented policy is implied.
6. **Common steps 1 and 5:** for every run bind the manifest, authorized reset, baseline totals, exact candidate/artifact/schema/config/provider/model/prompt/KB, fixture/golden versions, role/channel/device/OS/locale, executor, reviewer, start/end timestamps and restricted evidence URL. Refresh/reopen and reconcile UI/API/persisted/provider state separately for each required variation. Use the [canonical result row](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#96-reusable-execution-result-row); absent evidence, executor or sign-off remains Missing, never fabricated. All rows here remain Blocked; no campaign execution is claimed.

### 1.1 Source inventory and acceptance boundary

PR #3 and PR #4 are merged into the reviewed `dev` snapshot. PR #5–#7 and PR #9 are open at this inventory review and do not supply merged functionality or acceptance. In particular [PR #9](https://github.com/kandamkulathi-project/kandamkulathi/pull/9), head `3825c0003cb7f56911ff530dc770e73453167a13`, is not `dev`; its proposed backend work cannot close this register's blockers. Reconcile again after each reviewed merge.

| Layer / source at current dev SHA | Implemented module or test inventory (source inspection only) | Still required for canonical acceptance |
|---|---|---|
| [Client foundation](https://github.com/kandamkulathi-project/kandamkulathi/blob/cfa4c4821a7db9c39fa27dd2ee0541d71111a741/docs/development/CLIENT_FOUNDATION.md), [browser cases](https://github.com/kandamkulathi-project/kandamkulathi/blob/cfa4c4821a7db9c39fa27dd2ee0541d71111a741/tests/e2e/client-foundation.spec.ts) | Shared session/request states, grant-filtered navigation, return/link validation, editable draft shells, bundled EN/ML/TA fonts; synthetic unit/browser/media fixtures and an unmocked local Core 503 browser regression exist. | Verified WorkOS sessions, real domain records and journeys, real sandbox checkout/video/voice/push, signed Android/iOS device execution and company approval. A module or synthetic fixture is not provider/device acceptance. |
| [Database/outbox](https://github.com/kandamkulathi-project/kandamkulathi/blob/cfa4c4821a7db9c39fa27dd2ee0541d71111a741/packages/database/src/outbox.ts), [Worker/Queue cases](https://github.com/kandamkulathi-project/kandamkulathi/blob/cfa4c4821a7db9c39fa27dd2ee0541d71111a741/tests/platform/worker.test.mjs), [platform case inventory](https://github.com/kandamkulathi-project/kandamkulathi/tree/cfa4c4821a7db9c39fa27dd2ee0541d71111a741/tests/platform) | PostgreSQL driver, migrations, non-owner profiles, synthetic RLS/probes, fenced outbox/retry/receipt transport and actual local PostgreSQL/workerd test definitions exist. | Actual company Neon/Queues/Cron bindings and identity/clinical/commerce policies, domain consumers and stable-ID external reconciliation. Synthetic SQL guarantees do not prove patient/clinic authorization. |
| [Backup tools](https://github.com/kandamkulathi-project/kandamkulathi/blob/cfa4c4821a7db9c39fa27dd2ee0541d71111a741/scripts/platform/backup.mjs), [release tools](https://github.com/kandamkulathi-project/kandamkulathi/blob/cfa4c4821a7db9c39fa27dd2ee0541d71111a741/scripts/platform/release.mjs), [platform limits](https://github.com/kandamkulathi-project/kandamkulathi/blob/cfa4c4821a7db9c39fa27dd2ee0541d71111a741/docs/operations/P1_PLATFORM_FOUNDATION.md) | Authenticated encrypted export/isolated restore, migration/object metadata validation, frozen artifact/config preparation and compatibility checks have implementation/test definitions. | Independent company storage/key access, real R2 recovery, approved domain totals and timed deployed restore/rollback. Dry builds are not deployment/rollback evidence. |
| [Telemetry/load tools](https://github.com/kandamkulathi-project/kandamkulathi/blob/cfa4c4821a7db9c39fa27dd2ee0541d71111a741/scripts/platform/metrics.mjs), [load smoke](https://github.com/kandamkulathi-project/kandamkulathi/blob/cfa4c4821a7db9c39fa27dd2ee0541d71111a741/tests/load/platform.js) | Redacted structured metrics, local alert-receiver checks and a loopback five-user/30-second liveness script exist. | Named recipient receipt, retained operational dashboards and the canonical realistic 10-rps/10-minute business baseline; a health smoke cannot substitute. |
| [Application CI](../../.github/workflows/application.yml), [security CI](../../.github/workflows/security.yml) | CI exists: application, dependency, documentation, SAST, secrets and runtime checks. | Fresh exact-candidate checks, artifact/log inspection, authenticated business review and deployment/device/provider evidence. The historical PR #8 application run [39987280748](https://github.com/kandamkulathi-project/kandamkulathi/actions/runs/39987280748) passed verify then failed Expo compatibility (58.0.16 vs ~58.0.17); browser tests were skipped. Current dev has the Expo patch; only new CI can establish the integrated result. |

Group-level source links below identify relevant files, not evidence that a test ran. Original baseline-only comments are explicitly historical; the immutable current inventory above supersedes their implementation/test inventory. All historical browser/scanner/review observations without retained artifacts are **UNVERIFIED**: no executor, actual run URL, screenshot or reviewer/sign-off was supplied. Reported dates are historical claims, not verified execution dates.

Tinu's historical source references are retained: [starter status](../development/STARTER_STATUS.md) contextualizes the preview/security observations, [ADR 0005](../architecture/adr/0005-toolchain-security-backports.md) describes the bootstrap toolchain patches, and [repository checker](../../scripts/check_repository.py) describes documentation validation only. None supplies missing historical execution artifacts or upgrades those observations to Pass. Historical statements that platform modules were absent do not describe the reviewed current-dev modules above.

### 1.2 Concurrent register reconciliation

The nine run IDs added by Tinu in `de85351ebb4838c83f9f2f1a8e5d0abe9afb8636` retain their published meanings. The original 116 IDs are unchanged. Only conflicting additions from local `d5329d01b05e07c5a977e772324c8478808e9bb6` move to previously unused IDs:

| Local addition before reconciliation | Preserved meaning at new ID | Published Tinu ID retained |
|---|---|---|
| Local `P1-T04.S02-V04` | Currency tampering → `P1-T04.S02-V12` | `P1-T04.S02-V04`: consult-only SKU without valid matching recommendation |
| Local `P1-T06.S03-V06` | Account-only mismatch → `P1-T06.S03-V10` | `P1-T06.S03-V06`: account/reference parent checkpoint; reference child remains S03-V07 |
| Local `P1-T13.S02-V03` | English consult-only → `P1-T13.S02-V08` | `P1-T13.S02-V03`: EN/ML/TA consultation parent checkpoint; ML/TA children remain S02-V04/V05 |
| Local `P1-T14.S04-V03` | Transcript edit → `P1-T14.S04-V11` | `P1-T14.S04-V03`: edit/cancel/confirm parent checkpoint; cancel/confirm children remain S04-V04/V05 |

Equivalent reorder, identical-slot race, leave/stale-confirmation, stale-vector and duplicate-provider IDs combine both descriptions without changing meaning. Compound parent checkpoints have **no aggregate Pass** and cannot replace independent child evidence. Payment sequence children S03-V11/V12/V13 separately retain refund-before-capture, settlement-before-authorization and capture-before-authorization fixtures; provider-approved transition rules remain prerequisites, not invented finance policy.

---

## 2. Master Summary: Phase 1 Canonical Test Groups (P1-T01–P1-T20)

| Group ID | Canonical Title | Traceability (Req / Output / Package) | Domain Owner | Current Status | Primary Blocker / Reason |
|---|---|---|---|---|---|
| **P1-T01** | Reproducible candidate and secret isolation | R36, R38 / P1-O01 / P1-DEV-001 | Devadathan | **Blocked** | GitHub application/security/documentation CI and manifest/config tools exist; immutable candidate freeze manifest (`rc-p1-g1-xx`), isolated staging deployment and deployed bundle/log secret evidence missing. |
| **P1-T02** | Identity, MFA and session failure paths | R03, R36 / P1-O02 / P1-MAT-001 | Mathew | **Blocked** | WorkOS integration, staff MFA enforcement, and session revocation routes are not implemented in source. |
| **P1-T03** | Patient/clinic authorization and pooled RLS cleanup | R14, R32, R36 / P1-O02 / P1-MAT-001 | Mathew | **Blocked** | Platform driver/roles/synthetic RLS exist; verified patient/clinic/doctor policies and hosted pooled-scope evidence missing. |
| **P1-T04** | Authoritative prices and all-or-nothing reservations | R02, R05, R07, R15 / P1-O04 / P1-JOS-002 | Josin | **Blocked** | Server-authoritative cart pricing, multi-batch reservation transaction, and rollback logic are not implemented. |
| **P1-T05** | Last-unit FEFO and unsafe batch exclusion | R05 / P1-O04 / P1-JOS-002 | Josin | **Blocked** | Inventory batch ledger, FEFO query logic, and concurrency row locking are not implemented. |
| **P1-T06** | Payment authenticity, deduplication and uncertainty | R02, R07, R12 / P1-O04 / P1-JOS-003 | Josin | **Blocked** | Razorpay webhook endpoint, signature verification, payment ledger, and reconciliation job are not implemented. |
| **P1-T07** | Cross-clinic booking interval exclusion | R11, R12, R32 / P1-O05 / P1-MAT-002 | Mathew | **Blocked** | Clinic scheduling tables, doctor availability, and cross-clinic interval exclusion locks are not implemented. |
| **P1-T08** | Booking expiry and late payment obligations | R11, R12 / P1-O05 / P1-MAT-002 | Mathew | **Blocked** | Slot hold TTL timer, late payment reconciliation, and rebook/refund obligation handling are not implemented. |
| **P1-T09** | Web roles, current state and denied identifiers | R01, R02, R03, R04, R11, R12, R14 / P1-O06 / P1-DEV-003 | Devadathan | **Blocked** | Navigation/session shells and tests exist; integrated domain journeys and server ownership enforcement still missing. |
| **P1-T10** | Real-device payment return and network resilience | R02, R03, R25 / P1-O06 / P1-DEV-002 | Devadathan | **Blocked** | Return/link adapters exist; actual WorkOS/Razorpay integration, signed builds and physical device evidence missing. |
| **P1-T11** | Private video SDK proof and denial paths | R13, R14, R25 / P1-O06 / P1-DEV-002 | Devadathan | **Blocked** | WebRTC signaling via Durable Objects, TURN credential generation, and native video call views are not implemented. |
| **P1-T12** | Knowledge approval, freshness and mandatory safety | R16, R17, R19 / P1-O07 / P1-MAT-003 | Mathew | **Blocked** | Knowledge base storage, approval state filtering, vector retrieval, and physician-approved oracle are missing. |
| **P1-T13** | Urgency, injection and confirmed-tool boundaries | R18, R19, R20 / P1-O07 / P1-MAT-003 | Mathew | **Blocked** | Emergency red-flag escalation, prompt injection filters, and 2-step tool confirmation boundary are missing. |
| **P1-T14** | Provider identity and voice confirmation proof | R21, R24, R36 / P1-O07 / P1-MAT-004 | Mathew | **Blocked** | WhatsApp Cloud API webhook, voice transcription pipeline, and account-link proof mechanism are not implemented. |
| **P1-T15** | Content separation, takeover and core locales | R16, R20, R22 / P1-O06 / P1-DEN-002 | Denzil / Mathew | **Blocked** | Bundled fonts/locale UI tests exist; approved full-screen translations, KB approval and bot takeover remain missing. |
| **P1-T16** | Whole-current-app security review | R36, R38 / P1-O09 / P1-DEV-004 | Devadathan | **Blocked** | Offline scanner scripts exist, but authenticated penetration testing and mobile bundle reviews require app implementation. |
| **P1-T17** | Outbox, lease and duplicate job crash safety | R08, R10, R36, R38 / P1-O08 / P1-DEV-001 | Devadathan | **Blocked** | Local transport/schema/fencing tests exist; deployed delivery/redrive, domain effects and provider reconciliation evidence missing. |
| **P1-T18** | Encrypted restore and compatible rollback smoke | R36, R38 / P1-O08 / P1-DEV-001 | Devadathan | **Blocked** | Local encrypted restore/compatibility tooling exists; company recovery storage, domain controls and timed deployed rollback missing. |
| **P1-T19** | Initial current-slice load baseline | R02, R12, R38 / P1-O09 / P1-DEV-001 | Devadathan | **Blocked** | Health-only load smoke exists; realistic business slice, approved data/mix and canonical baseline evidence missing. |
| **P1-T20** | Alerts, dependencies and G1 evidence completeness | R36, R38 / P1-O09 / P1-TIN-090 | Tinu / Devadathan | **Blocked** | Local alert/metrics tools exist; named recipient receipt and P1-T01–P1-T19 campaign evidence incomplete. |

---

## 3. Detailed Canonical Test-Run Records (P1-T01 to P1-T20)

### P1-T01 — Reproducible candidate and secret isolation
- **Canonical actions and expected results:** [P1-T01](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#p1-t01--reproducible-candidate-and-secret-isolation).
- **Traceability:** R36, R38 | Output: P1-O01 | Packages: P1-DEV-001, P1-TIN-001
- **Domain Operator:** Devadathan (Platform Lead) | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Readiness manifest complete; frozen Git candidate tag; synthetic seed scripts; isolated staging environment; clean reset harness; candidate metadata and baseline control totals recorded.
- **Approved Expected Result:** Clean build and deployment reproduces identical schema/contract hashes; missing/wrong credentials fail fast safely; client bundles contain no private secrets.
- **Repository Grounding:** [.env.example](../../.env.example), [packages/server/src/index.ts](../../packages/server/src/index.ts), [.github/workflows/application.yml](../../.github/workflows/application.yml).
- **Existing Tests:** [tests/security/policy.test.mjs](../../tests/security/policy.test.mjs), [tests/integration/http.test.ts](../../tests/integration/http.test.ts).

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T01.S02-V01`` | Clean build & deploy from checkout; compare schema/artifact hashes | Missing | Not provisioned | Unexecuted | Not executed; CI workflows and manifest/dry-build tools exist, deployment unverified | **Blocked** | Frozen candidate tag, isolated staging target and reviewed migrations/seeds missing (Devadathan) | N/A | Pending execution |
| ``P1-T01.S03-V01`` | Missing DB credentials fail safely without live calls | Missing | Not provisioned | Unexecuted | Not executed; Local runtime config validation exists | **Blocked** | Frozen isolated target and credential-fault evidence missing (Devadathan) | N/A | Pending execution |
| ``P1-T01.S04-V01`` | Public web bundle inspection for hardcoded credentials | Missing | Not provisioned | Unexecuted | Not executed; Build output not evaluated | **Blocked** | Web build needs candidate bundle inspection (Devadathan) | N/A | Pending execution |
| ``P1-T01.S04-V02`` | Native mobile JS bundle inspection for secrets/signing keys | Missing | Not provisioned | Unexecuted | Not executed; Native bundle not evaluated | **Blocked** | Mobile export bundle inspection needed (Devadathan) | N/A | Pending execution |
| ``P1-T01.S04-V03`` | Deployment and server execution logs inspection for secret leakage | Missing | Not provisioned | Unexecuted | Not executed; Local redacted telemetry exists | **Blocked** | Exact deployed candidate/log evidence missing (Devadathan) | N/A | Pending execution |
| `P1-T01.S03-V02` | Wrong-environment provider credentials fail safely without live calls | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved isolated credential fixtures missing (Devadathan) | N/A | Pending execution |
| `P1-T01.S03-V03` | Disabled bindings fail safely without partially accepting deployment | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Deployed binding-fault fixture missing (Devadathan) | N/A | Pending execution |
| `P1-T01.S04-V04` | Error-output inspection reveals no secret or private environment value | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Exact-candidate error artifacts missing (Devadathan) | N/A | Pending execution |

---

### P1-T02 — Identity, MFA and session failure paths
- **Canonical actions and expected results:** [P1-T02](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#p1-t02--identity-mfa-and-session-failure-paths).
- **Traceability:** R03, R36 | Output: P1-O02 | Packages: P1-MAT-001, P1-DEV-003, P1-TIN-001
- **Domain Operator:** Mathew (Backend Lead) with Devadathan | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** WorkOS test tenant; customer-A/B accounts; staff account with required org & enforced MFA; no-MFA staff fixture; expired/revoked session tokens.
- **Canonical Expected Result Summary:** Valid actors enter only permitted scope; staff organization/MFA enforced; invalid scope/session/CSRF denied under the approved route contract without privileged effects or retained private views. No status code is invented here.
- **Repository Grounding:** [packages/providers/src/index.ts](../../packages/providers/src/index.ts#L2) (`"workos"` returns `NOT_IMPLEMENTED`), [packages/server/src/index.ts](../../packages/server/src/index.ts).
- **Existing Tests:** [tests/integration/http.test.ts](../../tests/integration/http.test.ts#L21) (verifies fabricated role returns 503 `FEATURE_UNAVAILABLE`).

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T02.S02-V01`` | Customer web sign-in through WorkOS AuthKit | Missing | Not provisioned | Unexecuted | Not executed; Verified auth unavailable | **Blocked** | WorkOS integration missing (Mathew) | N/A | Pending execution |
| ``P1-T02.S02-V02`` | Staff web sign-in with organization verification and mandatory MFA | Missing | Not provisioned | Unexecuted | Not executed; Verified auth unavailable | **Blocked** | Staff org & MFA checks missing (Mathew) | N/A | Pending execution |
| ``P1-T02.S03-V01`` | Staff endpoint access with customer token | Missing | Not provisioned | Unexecuted | Not executed; Endpoints not implemented | **Blocked** | RBAC middleware missing (Mathew) | N/A | Pending execution |
| ``P1-T02.S03-V02`` | Staff endpoint access with wrong-org staff token | Missing | Not provisioned | Unexecuted | Not executed; Endpoints not implemented | **Blocked** | Org tenancy check missing (Mathew) | N/A | Pending execution |
| ``P1-T02.S03-V03`` | Access with expired session token is denied without privileged effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Verified session endpoint missing (Mathew) | N/A | Pending execution |
| ``P1-T02.S03-V04`` | Access with altered actor claim is denied without privileged effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Verified claim validation missing (Mathew) | N/A | Pending execution |
| ``P1-T02.S04-V01`` | Session expiry removes privileged views and has safe sign-in return | Missing | Not provisioned | Unexecuted | Not executed; Synthetic client state tests exist | **Blocked** | Actual WorkOS lifecycle integration missing (Mathew/Devadathan) | N/A | Pending execution |
| `P1-T02.S02-V03` | Android customer sign-in returns only permitted scope | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Signed device and WorkOS fixture missing (Devadathan/Mathew) | N/A | Pending execution |
| `P1-T02.S02-V04` | iOS customer sign-in returns only permitted scope | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Signed device and WorkOS fixture missing (Devadathan/Mathew) | N/A | Pending execution |
| `P1-T02.S03-V05` | Revoked session token is denied without privileged effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Actual revocation fixture missing (Mathew) | N/A | Pending execution |
| `P1-T02.S03-V06` | Invalid session token is denied without privileged effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Verified session endpoint missing (Mathew) | N/A | Pending execution |
| `P1-T02.S03-V07` | Altered clinic claim is denied without privileged effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Clinic scope enforcement missing (Mathew) | N/A | Pending execution |
| `P1-T02.S03-V08` | Altered role claim is denied without privileged effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Verified role enforcement missing (Mathew) | N/A | Pending execution |
| `P1-T02.S03-V09` | Staff without required MFA is denied privileged scope | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Actual no-MFA staff fixture missing (Mathew) | N/A | Pending execution |
| `P1-T02.S04-V02` | Explicit logout clears privileged views | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Verified logout integration missing (Mathew/Devadathan) | N/A | Pending execution |
| `P1-T02.S04-V03` | CSRF mismatch is rejected without privileged side effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved CSRF contract and fixture missing (Mathew) | N/A | Pending execution |

---

### P1-T03 — Patient/clinic authorization and pooled RLS cleanup
- **Canonical actions and expected results:** [P1-T03](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#p1-t03--patientclinic-authorization-and-pooled-rls-cleanup).
- **Traceability:** R14, R32, R36 | Output: P1-O02 | Packages: P1-MAT-001, P1-TIN-001
- **Domain Operator:** Mathew (Backend Lead) | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Neon PostgreSQL 17 test database; synthetic fixtures: `customer-A`, `customer-B`, `clinic-A`, `clinic-B`, `doctor-assigned`, `doctor-unassigned`.
- **Canonical Expected Result Summary:** Permitted reads succeed; foreign identifiers reveal no fields/files; error/rollback clears scope and reassignment/revocation enforces current assignment/consent with privacy-minimized audit.
- **Repository Grounding:** [schema entry point](../../packages/database/src/schema.ts); empty clinical namespace was a historical a6fb539 observation, not a claim that current platform tables are absent.
- **Existing Tests:** Current dev has platform PostgreSQL role/RLS/transaction fixtures (section 1.1); no merged verified patient/clinic authorization acceptance.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T03.S02-V01`` | Patient-A queries Patient-B record ID via API and direct SQL | Missing | Not provisioned | Unexecuted | Not executed; No clinical tables or API | **Blocked** | Clinical tables & RLS missing (Mathew) | N/A | Pending execution |
| ``P1-T03.S02-V02`` | Clinic-A staff queries Clinic-B records | Missing | Not provisioned | Unexecuted | Not executed; No clinic tables or API | **Blocked** | Clinic tenant isolation missing (Mathew) | N/A | Pending execution |
| ``P1-T03.S02-V03`` | Doctor-unassigned queries patient clinical consultation notes | Missing | Not provisioned | Unexecuted | Not executed; No consultation tables | **Blocked** | Doctor assignment RLS missing (Mathew) | N/A | Pending execution |
| ``P1-T03.S03-V01`` | Transaction exception clears transaction-local patient RLS context | Missing | Not provisioned | Unexecuted | Not executed; Synthetic platform fixtures exist | **Blocked** | Verified clinical scope and pooled target evidence missing (Mathew) | N/A | Pending execution |
| ``P1-T03.S03-V02`` | Reused pooled connection by distinct actor has no inherited state | Missing | Not provisioned | Unexecuted | Not executed; Driver implementation exists | **Blocked** | Actual clinical pooled-scope fixture missing (Mathew) | N/A | Pending execution |
| ``P1-T03.S04-V01`` | Revoked doctor access immediately denies subsequent reads | Missing | Not provisioned | Unexecuted | Not executed; No revocation logic | **Blocked** | Role revocation handling missing (Mathew) | N/A | Pending execution |
| `P1-T03.S02-V04` | Authorized assigned doctor reads only currently permitted records | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Verified clinical assignment/consent fixtures missing (Mathew) | N/A | Pending execution |
| `P1-T03.S03-V03` | Explicit transaction rollback clears patient scope | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Actual clinical RLS/pool target missing (Mathew) | N/A | Pending execution |
| `P1-T03.S04-V02` | Reassigned doctor loses old patient access on subsequent read | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Reassignment enforcement missing (Mathew) | N/A | Pending execution |
| `P1-T03.S04-V03` | Revoked consent denies subsequent export without leaked fields/files | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved export/consent contract missing (Mathew) | N/A | Pending execution |
| `P1-T03.S04-V04` | Denied read/export audit excludes unnecessary private content | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Clinical audit fixtures missing (Mathew) | N/A | Pending execution |

---

### P1-T04 — Authoritative prices and all-or-nothing reservations
- **Canonical actions and expected results:** [P1-T04](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#p1-t04--authoritative-prices-and-all-or-nothing-reservations).
- **Traceability:** R02, R05, R07, R15 | Output: P1-O04 | Packages: P1-JOS-002, P1-MAT-005, P1-TIN-001
- **Domain Operator:** Josin (Commerce Lead) with Mathew | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** `PRICE-GOLDEN` rules; products `P-RETAIL-V1`, `P-CONSULT`; tampered quantity/pricing/role payloads; multi-batch reservation fixtures; simulated final-guard failure.
- **Approved Expected Result:** Server reprices client-altered carts to authoritative values; rejects invalid/tampered quantities and role tiers; failed final-guard aborts the entire transaction leaving zero reservation, order, or outbox deltas.
- **Repository Grounding:** [packages/domain/src/index.ts](../../packages/domain/src/index.ts#L3) (`lineSubtotalPaise`), [packages/contracts/src/index.ts](../../packages/contracts/src/index.ts#L24).
- **Existing Tests:** [tests/unit/money.test.ts](../../tests/unit/money.test.ts) (subtotal arithmetic unit test).

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T04.S02-V01`` | Client alters unit price; server reprices/rejects under golden rules | Missing | Not provisioned | Unexecuted | Not executed; Checkout unavailable | **Blocked** | Authoritative checkout API missing (Josin) | N/A | Pending execution |
| ``P1-T04.S02-V02`` | Client submits stale cart with changed price/tax rules | Missing | Not provisioned | Unexecuted | Not executed; Cart API returns 503 | **Blocked** | Cart validation API missing (Josin) | N/A | Pending execution |
| ``P1-T04.S02-V03`` | Client alters role/pricing tier; only authorized eligibility proceeds | Missing | Not provisioned | Unexecuted | Not executed; Checkout unavailable | **Blocked** | Authoritative checkout missing (Josin) | N/A | Pending execution |
| ``P1-T04.S02-V04`` | Consult-only SKU (`P-CONSULT`) checkout attempted without valid matching recommendation | Missing | Not provisioned | Unexecuted | Not executed; Cart API returns 503 | **Blocked** | Consult-to-cart prescription validation missing (Josin/Mathew) | N/A | Pending execution |
| ``P1-T04.S03-V01`` | Multi-item cart triggers final-batch guard failure inside transaction | Missing | Not provisioned | Unexecuted | Not executed; Reservation DB logic missing | **Blocked** | Atomic reservation transaction missing (Josin) | N/A | Pending execution |
| ``P1-T04.S04-V01`` | Database audit confirms zero partial order/reservation/outbox records | Missing | Not provisioned | Unexecuted | Not executed; DB tables missing | **Blocked** | Commerce schema missing (Josin/Mathew) | N/A | Pending execution |
| `P1-T04.S02-V12` | Altered currency is rejected/repriced under approved contract | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | PRICE-GOLDEN and checkout missing (Josin) | N/A | Pending execution |
| `P1-T04.S02-V05` | Valid minimum quantity proceeds with authoritative totals | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved quantity bounds and checkout missing (Josin) | N/A | Pending execution |
| `P1-T04.S02-V06` | Valid maximum quantity proceeds only within eligibility/stock | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved quantity bounds and stock fixture missing (Josin) | N/A | Pending execution |
| `P1-T04.S02-V07` | Zero quantity is safely rejected without partial effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Checkout validation fixture missing (Josin) | N/A | Pending execution |
| `P1-T04.S02-V08` | Negative quantity is safely rejected without partial effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Checkout validation fixture missing (Josin) | N/A | Pending execution |
| `P1-T04.S02-V09` | Prohibited fractional quantity is safely rejected | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved quantity policy and checkout missing (Josin) | N/A | Pending execution |
| `P1-T04.S02-V10` | Quantity above availability/cap is safely rejected | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved availability/cap fixtures missing (Josin) | N/A | Pending execution |
| `P1-T04.S02-V11` | Stale total correction is explained and explicitly reconfirmed | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Integrated repricing UI and PRICE-GOLDEN missing (Josin/Devadathan) | N/A | Pending execution |
| `P1-T04.S04-V02` | Failed final guard leaves zero stock/ledger delta and preserves prior records | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Domain ledger/control helpers missing (Josin/Mathew) | N/A | Pending execution |

---

### P1-T05 — Last-unit FEFO and unsafe batch exclusion
- **Canonical actions and expected results:** [P1-T05](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#p1-t05--last-unit-fefo-and-unsafe-batch-exclusion).
- **Traceability:** R05 | Output: P1-O04 | Packages: P1-JOS-002, P1-MAT-005, P1-TIN-001
- **Domain Operator:** Josin (Commerce Lead) and Mathew | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Exactly 1 available unit of `B-LAST`; batches `B-EARLY`, `B-LATE`; unsafe batches `B-EXPIRED`, `B-RECALLED`, `B-SHORTLIFE`; concurrency barrier harness.
- **Approved Expected Result:** Concurrent requests reserve up to available balance without oversell; losers receive clean conflict; expired/recalled/short-life batches are strictly excluded.
- **Repository Grounding:** [packages/contracts/src/index.ts](../../packages/contracts/src/index.ts#L25) (`quantitySchema`).
- **Existing Tests:** No merged inventory/FEFO acceptance tests; current dev has platform transport concurrency fixtures, which do not prove stock reservation invariants.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T05.S02-V01`` | Two concurrent checkouts race for 1 available unit (`B-LAST`) | Missing | Not provisioned | Unexecuted | Not executed; No checkout route or DB | **Blocked** | Inventory reservation locks missing (Josin) | N/A | Pending execution |
| ``P1-T05.S03-V01`` | FEFO reservation allocates `B-EARLY` prior to `B-LATE` | Missing | Not provisioned | Unexecuted | Not executed; No batch tables | **Blocked** | FEFO query logic missing (Josin) | N/A | Pending execution |
| ``P1-T05.S03-V02`` | Expired batch `B-EXPIRED` is excluded from checkout eligibility | Missing | Not provisioned | Unexecuted | Not executed; No batch tables | **Blocked** | Batch eligibility filters missing (Josin) | N/A | Pending execution |
| ``P1-T05.S03-V03`` | Recalled batch `B-RECALLED` is excluded from checkout eligibility | Missing | Not provisioned | Unexecuted | Not executed; No batch tables | **Blocked** | Recall quarantine logic missing (Josin) | N/A | Pending execution |
| ``P1-T05.S03-V04`` | Near-expiry batch `B-SHORTLIFE` excluded under shelf-life rule | Missing | Not provisioned | Unexecuted | Not executed; No batch tables | **Blocked** | Minimum shelf-life rules missing (Josin) | N/A | Pending execution |
| ``P1-T05.S04-V01`` | Retrying conflicting checkout request does not produce negative stock | Missing | Not provisioned | Unexecuted | Not executed; No checkout route | **Blocked** | Idempotent checkout retry missing (Josin) | N/A | Pending execution |
| `P1-T05.S04-V02` | Stale checkout retry cannot duplicate order/reservation or oversell | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Reviewed race/replay harness and checkout missing (Josin) | N/A | Pending execution |

---

### P1-T06 — Payment authenticity, deduplication and uncertainty
- **Canonical actions and expected results:** [P1-T06](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#p1-t06--payment-authenticity-deduplication-and-uncertainty).
- **Traceability:** R02, R07, R12 | Output: P1-O04 | Packages: P1-JOS-003, P1-MAT-005, P1-TIN-001
- **Domain Operator:** Josin (Commerce Lead) with Mathew & Devadathan | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Razorpay sandbox keys; payment success/failure/cancellation payloads; valid webhook signature; forged HMAC signature payload; duplicate/reordered event payloads; network drop injection tool.
- **Canonical Expected Result Summary:** Trusted applicable provider evidence alone advances state; invalid/mismatched events have no effect, valid duplicates are harmlessly idempotent; unknown results reconcile by stable operation ID with at most one authorized ledger/outbox effect.
- **Repository Grounding:** [packages/providers/src/index.ts](../../packages/providers/src/index.ts#L3) (`"razorpay"` returns `NOT_IMPLEMENTED`).
- **Existing Tests:** None for webhooks or payments.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T06.S02-V01`` | Sandbox payment success event transitions order to paid | Missing | Not provisioned | Unexecuted | Not executed; No payment routes | **Blocked** | Razorpay payment adapter missing (Josin) | N/A | Pending execution |
| ``P1-T06.S02-V02`` | Sandbox payment failure event maintains accurate unpaid/failure state | Missing | Not provisioned | Unexecuted | Not executed; No payment routes | **Blocked** | Razorpay payment failure handling missing (Josin) | N/A | Pending execution |
| ``P1-T06.S02-V03`` | User cancellation in checkout preserves unpaid/cancelled state without charge | Missing | Not provisioned | Unexecuted | Not executed; No payment routes | **Blocked** | Payment cancellation flow missing (Josin) | N/A | Pending execution |
| ``P1-T06.S02-V04`` | Browser-return redirect / spoofing rejected; paid state requires provider webhook | Missing | Not provisioned | Unexecuted | Not executed; No order routes | **Blocked** | Server-authoritative state missing (Josin) | N/A | Pending execution |
| ``P1-T06.S03-V01`` | Webhook with valid HMAC signature accepted | Missing | Not provisioned | Unexecuted | Not executed; No webhook endpoint | **Blocked** | Webhook verification endpoint missing (Josin) | N/A | Pending execution |
| ``P1-T06.S03-V02`` | Forged signature is rejected under approved provider contract | Missing | Not provisioned | Unexecuted | Not executed; No webhook endpoint | **Blocked** | Webhook signature validator missing (Josin) | N/A | Pending execution |
| ``P1-T06.S03-V03`` | Valid duplicate webhook delivery produces at most one authorized payment effect | Missing | Not provisioned | Unexecuted | Not executed; No domain ledger schema | **Blocked** | Payment deduplication missing (Josin) | N/A | Pending execution |
| ``P1-T06.S03-V04`` | Mismatched amount event cannot cause a money effect | Missing | Not provisioned | Unexecuted | Not executed; No webhook endpoint | **Blocked** | Payment invariant validation missing (Josin) | N/A | Pending execution |
| ``P1-T06.S04-V01`` | Dropped provider response leaves order in explicit reconcilable state | Missing | Not provisioned | Unexecuted | Not executed; No reconciliation job | **Blocked** | Payment reconciliation job missing (Josin) | N/A | Pending execution |
| `P1-T06.S02-V05` | Pending provider state stays truthful in client/server, never false paid | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Sandbox payment fixtures and integrated UI missing (Josin/Devadathan) | N/A | Pending execution |
| `P1-T06.S03-V05` | Payment webhook delivered out of order (refund before capture / settlement before authorization); reordered-event parent checkpoint, no aggregate Pass; children S03-V11–V13 | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved sequence/transition rules and sandbox fixtures missing (Josin) | N/A | Pending execution |
| `P1-T06.S03-V06` | Webhook with account or order/entity reference mismatch rejected; parent checkpoint, no aggregate Pass; separate account S03-V10 and reference S03-V07 runs | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Payment account/reference verification and fixtures missing (Josin) | N/A | Pending execution |
| `P1-T06.S03-V07` | Mismatched business/provider reference event causes no money effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Reference verifier/fixtures missing (Josin) | N/A | Pending execution |
| `P1-T06.S03-V08` | Mismatched currency event causes no money effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Currency verifier/golden fixtures missing (Josin) | N/A | Pending execution |
| `P1-T06.S03-V09` | Same semantic payment with new delivery ID remains one authorized effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Business-ID deduplication fixtures missing (Josin) | N/A | Pending execution |
| `P1-T06.S03-V10` | Mismatched provider account event causes no money effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Provider account verifier/fixtures missing (Josin/Mathew) | N/A | Pending execution |
| `P1-T06.S03-V11` | Reordered refund before capture obeys approved transition contract without repeated money effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved provider refund/capture ordering fixture missing (Josin) | N/A | Pending execution |
| `P1-T06.S03-V12` | Reordered settlement before authorization obeys approved transition contract without false paid state | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved provider settlement/authorization fixture missing (Josin) | N/A | Pending execution |
| `P1-T06.S03-V13` | Reordered capture before authorization obeys approved transition contract without repeated effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved provider capture/authorization fixture missing (Josin) | N/A | Pending execution |
| `P1-T06.S04-V02` | Missing callback is reconciled by original operation without a fresh charge | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Missing-event reconciliation harness missing (Josin) | N/A | Pending execution |
| `P1-T06.S04-V03` | COMMIT-result-unknown remains durable/reconcilable without blind retry | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Domain commit-uncertainty harness missing (Josin/Mathew) | N/A | Pending execution |
| `P1-T06.S04-V04` | Lost acknowledgement after provider acceptance reconciles one ledger/outbox effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Controlled provider-accept/ack fault missing (Josin) | N/A | Pending execution |

---

### P1-T07 — Cross-clinic booking interval exclusion
- **Canonical actions and expected results:** [P1-T07](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#p1-t07--cross-clinic-booking-interval-exclusion).
- **Traceability:** R11, R12, R32 | Output: P1-O05 | Packages: P1-MAT-002, P1-JOS-003, P1-TIN-001
- **Domain Operator:** Mathew (Backend Lead) with Josin | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Clinics `clinic-A`, `clinic-B`; shared doctor `D-SHARED`; overlapping buffer intervals; adjacent slot fixtures; booking race barrier.
- **Approved Expected Result:** Shared physician cannot be booked for overlapping intervals across clinics including travel buffers; valid adjacent half-open intervals succeed.
- **Repository Grounding:** [schema entry point](../../packages/database/src/schema.ts); empty clinical namespace was historical; platform tables now exist, booking policies remain separate work.
- **Existing Tests:** None for appointments or bookings.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T07.S02-V01`` | Concurrent booking race for same doctor across clinic-A & clinic-B | Missing | Not provisioned | Unexecuted | Not executed; No booking API or DB | **Blocked** | Cross-clinic booking exclusion missing (Mathew) | N/A | Pending execution |
| ``P1-T07.S02-V02`` | Concurrent slot race/conflict: two customers attempt confirming the identical occupied interval in the same clinic; at most one wins | Missing | Not provisioned | Unexecuted | Not executed; No booking API or DB | **Blocked** | Slot race concurrency lock and synchronized barrier missing (Mathew) | N/A | Pending execution |
| ``P1-T07.S03-V01`` | Overlapping buffer interval prevents conflicting second booking | Missing | Not provisioned | Unexecuted | Not executed; No booking engine | **Blocked** | Buffer interval logic missing (Mathew) | N/A | Pending execution |
| ``P1-T07.S03-V02`` | Valid half-open adjacent interval succeeds without conflict | Missing | Not provisioned | Unexecuted | Not executed; No booking engine | **Blocked** | Slot boundary logic missing (Mathew) | N/A | Pending execution |
| ``P1-T07.S03-V03`` | Doctor leave calendar blocks slot generation and booking | Missing | Not provisioned | Unexecuted | Not executed; No leave schema | **Blocked** | Doctor leave schema & logic missing (Mathew) | N/A | Pending execution |
| ``P1-T07.S04-V01`` | Active slot hold excludes concurrent hold or confirmation | Missing | Not provisioned | Unexecuted | Not executed; No hold engine | **Blocked** | Slot hold mechanism missing (Mathew) | N/A | Pending execution |
| `P1-T07.S03-V04` | Doctor location constraints prevent unavailable-clinic booking | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved location/availability fixture missing (Mathew) | N/A | Pending execution |
| `P1-T07.S04-V02` | Valid adjacent appointments both succeed with matching held/confirmed state | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Booking state/read-only control helpers missing (Mathew) | N/A | Pending execution |
| `P1-T07.S04-V03` | Conflicting confirmation cannot tell two customers they own the interval | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Booking confirmation race harness missing (Mathew) | N/A | Pending execution |

---

### P1-T08 — Booking expiry and late payment obligations
- **Canonical actions and expected results:** [P1-T08](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#p1-t08--booking-expiry-and-late-payment-obligations).
- **Traceability:** R11, R12 | Output: P1-O05 | Packages: P1-MAT-002, P1-JOS-003, P1-TIN-001
- **Domain Operator:** Mathew (Backend Lead) and Josin | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Company-approved hold TTL/inclusivity and fee/leave/cancellation/refund policy; controllable server clock; delayed sandbox payment event; changed fee/leave fixture; duplicate refund payload. No example TTL is a chosen policy.
- **Canonical Expected Result Summary:** Server expiry boundaries and signed fee/leave/cancel/refund policy apply; no false confirmation or duplicate refund. Rebook/refund obligation is durable, fee snapshot immutable and pending/resolved UI truthful.
- **Repository Grounding:** [packages/contracts/src/index.ts](../../packages/contracts/src/index.ts).
- **Existing Tests:** None.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T08.S02-V01`` | Fee payment completed before slot hold TTL expiry confirms booking | Missing | Not provisioned | Unexecuted | Not executed; No appointment routes | **Blocked** | Booking confirmation API missing (Mathew) | N/A | Pending execution |
| ``P1-T08.S02-V02`` | Fee payment completed exactly at hold TTL boundary | Missing | Not provisioned | Unexecuted | Not executed; No hold timer | **Blocked** | Hold TTL boundary logic missing (Mathew) | N/A | Pending execution |
| ``P1-T08.S02-V03`` | Fee payment completed after hold TTL expiry rejects slot confirmation | Missing | Not provisioned | Unexecuted | Not executed; No hold timer | **Blocked** | Hold expiry handler missing (Mathew) | N/A | Pending execution |
| ``P1-T08.S03-V01`` | Doctor fee changed during hold; checkout uses snapshot fee | Missing | Not provisioned | Unexecuted | Not executed; No fee snapshot logic | **Blocked** | Fee snapshot invariant missing (Mathew/Josin) | N/A | Pending execution |
| ``P1-T08.S03-V02`` | Customer cancellation obeys policy-defined refund rules | Missing | Not provisioned | Unexecuted | Not executed; No cancellation API | **Blocked** | Appointment refund policy missing (Josin) | N/A | Pending execution |
| ``P1-T08.S03-V03`` | Duplicate refund request produces no duplicate refund under signed policy | Missing | Not provisioned | Unexecuted | Not executed; No refund API | **Blocked** | Refund deduplication and ledger invariants missing (Josin/Mathew) | N/A | Pending execution |
| ``P1-T08.S04-V01`` | Late payment generates exactly 1 durable rebook-or-refund obligation | Missing | Not provisioned | Unexecuted | Not executed; No obligation table | **Blocked** | Rebook/refund obligation engine missing (Mathew) | N/A | Pending execution |
| `P1-T08.S03-V04` | Doctor leave approved while slot held; stale confirmation attempt is rejected without false confirmation under signed leave-change policy | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved leave-change policy and current-state booking engine missing (Mathew) | N/A | Pending execution |
| `P1-T08.S03-V05` | Stale confirmation after current fee/state change cannot falsely confirm | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Current-state confirmation/approved policy missing (Mathew/Josin) | N/A | Pending execution |
| `P1-T08.S04-V02` | Pending rebook/refund UI matches durable unresolved obligation | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Domain obligation and UI integration missing (Mathew/Devadathan) | N/A | Pending execution |
| `P1-T08.S04-V03` | Resolved rebook/refund UI and reconciled totals match one outcome | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved resolution/control helpers missing (Mathew/Josin) | N/A | Pending execution |

---

### P1-T09 — Web roles, current state and denied identifiers
- **Canonical actions and expected results:** [P1-T09](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#p1-t09--web-roles-current-state-and-denied-identifiers).
- **Traceability:** R01, R02, R03, R04, R11, R12, R14 | Output: P1-O06 | Packages: P1-DEV-003, P1-PAU-001, P1-PAU-003, P1-DEN-003, P1-TIN-001
- **Domain Operator:** Tinu with Paul / Denzil; Devadathan supports | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Deployed public web and workspaces applications; customer-A, staff, and physician test accounts; unowned order/booking URLs.
- **Canonical Expected Result Summary:** Allowed journeys render real current backend records; foreign identifiers reveal no unauthorized fields/files/actions under the approved route contract; session return/conflict/pending UI matches authoritative state.
- **Repository Grounding:** [apps/workspaces/src/main.tsx](../../apps/workspaces/src/main.tsx), [apps/web-public/src/components/Welcome.tsx](../../apps/web-public/src/components/Welcome.tsx).
- **Existing Tests:** [starter smoke](../../tests/e2e/starter.spec.ts) plus current client state/grant/expiry/CORS/browser cases in section 1.1; these do not establish real authenticated domain journeys.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T09.S02-V01`` | Customer completes purchase on integrated web app | Missing | Not provisioned | Unexecuted | Not executed; Client shells exist | **Blocked** | Integrated real purchase journey missing (Paul/Devadathan/Josin) | N/A | Pending execution |
| ``P1-T09.S02-V02`` | Staff order desk navigation renders current order states | Missing | Not provisioned | Unexecuted | Not executed; Navigation/session foundation exists | **Blocked** | Integrated staff order records missing (Denzil/Devadathan) | N/A | Pending execution |
| ``P1-T09.S02-V03`` | Physician panel renders assigned consultations only | Missing | Not provisioned | Unexecuted | Not executed; Navigation/session foundation exists | **Blocked** | Verified clinical records/assignment missing (Mathew/Devadathan) | N/A | Pending execution |
| ``P1-T09.S03-V01`` | Direct foreign customer order ID reveals no unauthorized fields/files/actions | Missing | Not provisioned | Unexecuted | Not executed; No domain order routing | **Blocked** | Server-backed order ownership fixture missing (Mathew/Devadathan) | N/A | Pending execution |
| ``P1-T09.S03-V02`` | Direct forbidden staff route reveals no unauthorized data/action | Missing | Not provisioned | Unexecuted | Not executed; Synthetic route/grant tests exist | **Blocked** | Verified server-backed scope enforcement missing (Mathew/Devadathan) | N/A | Pending execution |
| ``P1-T09.S04-V01`` | Session expiry during active workflow presents safe sign-in return | Missing | Not provisioned | Unexecuted | Not executed; Synthetic expiry tests exist | **Blocked** | Integrated WorkOS/domain lifecycle missing (Mathew/Devadathan) | N/A | Pending execution |
| `P1-T09.S02-V04` | Customer completes booking using real current backend records | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Booking journey and domain API missing (Mathew/Devadathan) | N/A | Pending execution |
| `P1-T09.S03-V03` | Refreshed foreign record deep link exposes no private fields/files | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Actual record ownership/refresh fixture missing (Mathew/Devadathan) | N/A | Pending execution |
| `P1-T09.S04-V02` | Browser clients race same slot and display only authoritative ownership | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Synchronized booking race and integrated browser fixture missing (Mathew/Devadathan) | N/A | Pending execution |
| `P1-T09.S04-V03` | Losing browser renders honest conflict with safe current-state recovery | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Booking conflict response/UI missing (Mathew/Devadathan) | N/A | Pending execution |
| `P1-T09.S04-V04` | Uncertain browser outcome renders pending until backend reconciliation | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Domain pending/reconciliation fixture missing (Josin/Mathew/Devadathan) | N/A | Pending execution |

---

### P1-T10 — Real-device payment return and network resilience
- **Canonical actions and expected results:** [P1-T10](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#p1-t10--real-device-payment-return-and-network-resilience).
- **Traceability:** R02, R03, R25 | Output: P1-O06 | Packages: P1-DEV-002, P1-PAU-004, P1-TIN-001
- **Domain Operator:** Tinu / Paul; Devadathan owns adapters | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Physical Android & iOS test devices; signed Expo development builds; Razorpay sandbox checkout; network proxy/throttle.
- **Approved Expected Result:** Real-device payment callback returns to owned order; repeated taps, backgrounding, and network drops do not create duplicate purchases or false paid state.
- **Repository Grounding:** [apps/mobile/App.tsx](../../apps/mobile/App.tsx), [apps/mobile/app.json](../../apps/mobile/app.json).
- **Existing Tests:** Client callback/replay/storage/notification fixtures and native configuration/media tests exist at current dev (section 1.1); no actual signed-device payment acceptance is recorded.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T10.S02-V01`` | Android signed-device auth/checkout return reaches the owned order | Missing | Not provisioned | Unexecuted | Not executed; Local return adapter exists | **Blocked** | Actual signed-device auth/payment integration missing (Devadathan) | N/A | Pending execution |
| ``P1-T10.S02-V02`` | iOS signed-device auth/checkout return reaches the owned order | Missing | Not provisioned | Unexecuted | Not executed; Local return adapter exists | **Blocked** | Actual signed-device auth/payment integration missing (Devadathan) | N/A | Pending execution |
| ``P1-T10.S03-V01`` | Repeated checkout taps cannot create duplicate purchase/false paid state | Missing | Not provisioned | Unexecuted | Not executed; Local adapters exist | **Blocked** | Actual device checkout journey missing (Paul/Devadathan/Josin) | N/A | Pending execution |
| ``P1-T10.S03-V02`` | App background/resume during payment preserves one true outcome | Missing | Not provisioned | Unexecuted | Not executed; Local lifecycle foundation exists | **Blocked** | Actual signed-device/provider lifecycle evidence missing (Devadathan) | N/A | Pending execution |
| ``P1-T10.S03-V03`` | Network disconnect during payment return cannot fabricate success | Missing | Not provisioned | Unexecuted | Not executed; Local return adapter exists | **Blocked** | Actual device/provider fault fixture missing (Devadathan/Josin) | N/A | Pending execution |
| ``P1-T10.S04-V01`` | Reconnect reconciles true server/provider status without duplicate charge | Missing | Not provisioned | Unexecuted | Not executed; Domain reconciliation unavailable | **Blocked** | Signed-device/provider reconciliation missing (Devadathan/Josin) | N/A | Pending execution |
| `P1-T10.S03-V04` | Native checkout cancellation does not falsely charge/mark paid | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Signed-device/provider cancel fixture missing (Devadathan/Josin) | N/A | Pending execution |
| `P1-T10.S03-V05` | Native restart during payment recovers original operation without duplicate | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Signed-device restart/reconciliation fixture missing (Devadathan/Josin) | N/A | Pending execution |
| `P1-T10.S03-V06` | Network drop during submission remains truthful pending/error until known | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Signed-device submission-fault fixture missing (Devadathan/Josin) | N/A | Pending execution |

---

### P1-T11 — Private video SDK proof and denial paths
- **Canonical actions and expected results:** [P1-T11](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#p1-t11--private-video-sdk-proof-and-denial-paths).
- **Traceability:** R13, R14, R25 | Output: P1-O06 | Packages: P1-DEV-002, P1-MAT-001, P1-TIN-001
- **Domain Operator:** Devadathan (Platform Lead); Mathew validates access | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Web browser; physical Android & iOS devices; booked consultation fixture; valid/expired room tokens; WebRTC/TURN credentials.
- **Approved Expected Result:** Booked patient and assigned doctor join private media call; unassigned participant or expired token rejected; camera/mic denials recover gracefully.
- **Repository Grounding:** [packages/providers/src/index.ts](../../packages/providers/src/index.ts#L8) (`"video"` returns `NOT_IMPLEMENTED`).
- **Existing Tests:** Current dev has synthetic browser MediaStream cleanup/denial and native permission/configuration tests; no authenticated private web/native video acceptance.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T11.S02-V01`` | Booked patient and assigned doctor join private call on web | Missing | Not provisioned | Unexecuted | Not executed; Video provider not built | **Blocked** | WebRTC signaling adapter missing (Devadathan) | N/A | Pending execution |
| ``P1-T11.S02-V02`` | Patient and doctor join private call across Android and iOS devices | Missing | Not provisioned | Unexecuted | Not executed; Native video UI missing | **Blocked** | Native WebRTC bridge missing (Devadathan) | N/A | Pending execution |
| ``P1-T11.S03-V01`` | Unassigned doctor attempting to join room is rejected | Missing | Not provisioned | Unexecuted | Not executed; Room auth missing | **Blocked** | Room authorization missing (Mathew) | N/A | Pending execution |
| ``P1-T11.S03-V02`` | Foreign customer attempting to join room is rejected | Missing | Not provisioned | Unexecuted | Not executed; Room auth missing | **Blocked** | Room authorization missing (Mathew) | N/A | Pending execution |
| ``P1-T11.S03-V03`` | Expired room token fails to connect or expose media | Missing | Not provisioned | Unexecuted | Not executed; Token service missing | **Blocked** | Room token validation missing (Mathew) | N/A | Pending execution |
| ``P1-T11.S04-V01`` | Camera permission denial during private call has safe usable fallback | Missing | Not provisioned | Unexecuted | Not executed; Local diagnostics exist | **Blocked** | Actual authenticated call/device fixture missing (Devadathan) | N/A | Pending execution |
| ``P1-T11.S04-V02`` | Network disconnection during active call rejoins cleanly on recovery | Missing | Not provisioned | Unexecuted | Not executed; Native video UI missing | **Blocked** | WebRTC reconnect handling missing (Devadathan) | N/A | Pending execution |
| `P1-T11.S03-V04` | Revoked room token fails to join or expose media | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Current membership/token revocation fixture missing (Mathew) | N/A | Pending execution |
| `P1-T11.S03-V05` | Unowned room ID cannot reveal another participant's media | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Private room authorization missing (Mathew) | N/A | Pending execution |
| `P1-T11.S04-V03` | Microphone permission denial during private call has safe usable fallback | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Actual call/device permission fixture missing (Devadathan) | N/A | Pending execution |
| `P1-T11.S04-V04` | Camera reallow permits only current authorized room membership | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Actual call/device permission fixture missing (Devadathan/Mathew) | N/A | Pending execution |
| `P1-T11.S04-V05` | Microphone reallow permits only current authorized room membership | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Actual call/device permission fixture missing (Devadathan/Mathew) | N/A | Pending execution |
| `P1-T11.S04-V06` | Background/resume revalidates membership before private media rejoins | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Signed-device private-call lifecycle fixture missing (Devadathan/Mathew) | N/A | Pending execution |

---

### P1-T12 — Knowledge approval, freshness and mandatory safety
- **Canonical actions and expected results:** [P1-T12](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#p1-t12--knowledge-approval-freshness-and-mandatory-safety).
- **Traceability:** R16, R17, R19 | Output: P1-O07 | Packages: P1-MAT-003, P1-TIN-001
- **Domain Operator:** Mathew (AI Technical Lead); Physician approves oracle | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Approved medical oracle; KB fixtures `KB-A` (approved public), `KB-D` (draft), `KB-W` (withdrawn), `KB-P` (private); vector retrieval index.
- **Canonical Expected Result Summary:** Only current primary-approved public source versions and mandatory safety blocks authorize medical output; draft/private/stale/withdrawn index hits cannot. Missing required context uses the approved safe fallback, never fabricated medical text.
- **Repository Grounding:** [apps/companion/src/index.ts](../../apps/companion/src/index.ts), [packages/providers/src/index.ts](../../packages/providers/src/index.ts#L5) (`"openai"` returns `NOT_IMPLEMENTED`).
- **Existing Tests:** None for RAG, KB, or LLM.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T12.S02-V01`` | Query on approved product monograph (`KB-A`) returns cited medical answer | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | Grounded RAG pipeline missing (Mathew) | N/A | Pending execution |
| ``P1-T12.S02-V02`` | Response contains versioned citation to approved source and physician | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | Citation attribution missing (Mathew) | N/A | Pending execution |
| ``P1-T12.S03-V01`` | Vector similarity hit on draft monograph (`KB-D`) is rejected | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | KB approval state gate missing (Mathew) | N/A | Pending execution |
| ``P1-T12.S03-V02`` | Vector similarity hit on withdrawn monograph (`KB-W`) is rejected | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | KB withdrawal exclusion missing (Mathew) | N/A | Pending execution |
| ``P1-T12.S03-V03`` | Query matching private internal clinic notes (`KB-P`) yields no leak | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | Corpus privacy isolation missing (Mathew) | N/A | Pending execution |
| ``P1-T12.S03-V04`` | Stale vector embedding hit pointing to outdated/superseded KB source version is rejected; primary-version change cannot authorize medical output | Missing | Not provisioned | Unexecuted | Not executed; Companion unavailable | **Blocked** | Versioned KB/vector freshness validation and physician oracle missing (Mathew) | N/A | Pending execution |
| ``P1-T12.S04-V01`` | Missing mandatory primary safety block produces approved safe handoff | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | Mandatory safety injector missing (Mathew) | N/A | Pending execution |
| `P1-T12.S03-V05` | Previously approved source withdrawn while vector/cache remains cannot authorize output | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Withdrawal/invalidation fixture and approved freshness policy missing (Mathew) | N/A | Pending execution |
| `P1-T12.S04-V02` | Missing required approved translation produces approved fallback, not invented medical wording | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Physician-approved translation oracle missing (Mathew/company physician) | N/A | Pending execution |

---

### P1-T13 — Urgency, injection and confirmed-tool boundaries
- **Canonical actions and expected results:** [P1-T13](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#p1-t13--urgency-injection-and-confirmed-tool-boundaries).
- **Traceability:** R18, R19, R20 | Output: P1-O07 | Packages: P1-MAT-003, P1-TIN-001
- **Domain Operator:** Mathew (AI Technical Lead) with Physician; Tinu records | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Physician-approved red-flag test pack; consult-only SKU prompts; prompt injection test cases; 2-step tool confirmation fixtures.
- **Approved Expected Result:** Emergency symptoms trigger urgent escalation without sales; injection attempts fail; tools display current state and require explicit customer confirmation.
- **Repository Grounding:** [apps/companion/src/index.ts](../../apps/companion/src/index.ts).
- **Existing Tests:** None for emergency escalation or prompt injection.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T13.S02-V01`` | English red-flag prompt triggers approved escalation/disclaimer and no automated sale | Missing | Not provisioned | Unexecuted | Not executed; Companion unavailable | **Blocked** | Physician-approved prompt/oracle and safety integration missing (Mathew) | N/A | Pending execution |
| ``P1-T13.S02-V02`` | Red-flag conversation blocks automated cart addition or checkout link | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | No-sale conversation lock missing (Mathew) | N/A | Pending execution |
| ``P1-T13.S02-V03`` | Consult-only product prompt in core languages (`en`, `ml`, `ta`) triggers approved physician consultation recommendation; parent checkpoint, no aggregate Pass; English S02-V08, Malayalam S02-V04, Tamil S02-V05 recorded separately | Missing | Not provisioned | Unexecuted | Not executed; Companion unavailable | **Blocked** | Physician-approved multilingual consult-only oracles and integration missing (Mathew) | N/A | Pending execution |
| ``P1-T13.S03-V01`` | Prompt injection attempting to bypass disclaimers is safely refused | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | Prompt injection filters missing (Mathew) | N/A | Pending execution |
| ``P1-T13.S03-V02`` | Prompt injection attempting unauthorized tool execution is rejected | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | Tool authorization boundary missing (Mathew) | N/A | Pending execution |
| ``P1-T13.S04-V01`` | Tool proposal requires explicit customer confirmation before write | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | 2-step tool confirmation missing (Mathew) | N/A | Pending execution |
| ``P1-T13.S04-V02`` | Replayed confirmation has no repeated or unauthorized effect | Missing | Not provisioned | Unexecuted | Not executed; Companion unavailable | **Blocked** | Fresh authorized confirmation fixture missing (Mathew) | N/A | Pending execution |
| `P1-T13.S02-V08` | English consult-only prompt uses approved escalation/disclaimer with no automated sale | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Physician-approved English consult-only oracle missing (Mathew/company physician) | N/A | Pending execution |
| `P1-T13.S02-V04` | Malayalam consult-only prompt uses approved escalation/disclaimer with no automated sale | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Physician-approved Malayalam consult-only oracle missing (Mathew/company physician) | N/A | Pending execution |
| `P1-T13.S02-V05` | Tamil consult-only prompt uses approved escalation/disclaimer with no automated sale | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Physician-approved Tamil consult-only oracle missing (Mathew/company physician) | N/A | Pending execution |
| `P1-T13.S02-V06` | Malayalam red-flag prompt uses approved escalation/disclaimer with no automated sale | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Physician-approved Malayalam red-flag oracle missing (Mathew/company physician) | N/A | Pending execution |
| `P1-T13.S02-V07` | Tamil red-flag prompt uses approved escalation/disclaimer with no automated sale | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Physician-approved Tamil red-flag oracle missing (Mathew/company physician) | N/A | Pending execution |
| `P1-T13.S03-V03` | Injection through retrieved source cannot override safety/permission rules | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved source-injection fixture missing (Mathew) | N/A | Pending execution |
| `P1-T13.S03-V04` | Injection through tool fields/role claims cannot override authorization | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved tool-field fixture missing (Mathew) | N/A | Pending execution |
| `P1-T13.S03-V05` | Cross-user action without valid identity exposes no private records or effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Verified identity and cross-user action fixtures missing (Mathew) | N/A | Pending execution |
| `P1-T13.S04-V03` | Cancelled confirmation has no unauthorized sale or repeated effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Authorized cancelled-confirmation fixture missing (Mathew) | N/A | Pending execution |
| `P1-T13.S04-V04` | Tool action preserves physician-approved dosage without alteration | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Signed dosage oracle and tool integration missing (Mathew/company physician) | N/A | Pending execution |
| `P1-T13.S04-V05` | Tampered confirmation has no unauthorized effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Bound confirmation fixture missing (Mathew) | N/A | Pending execution |
| `P1-T13.S04-V06` | Expired confirmation has no unauthorized effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved expiry policy and controlled-clock fixture missing (Mathew) | N/A | Pending execution |
| `P1-T13.S04-V07` | Stale actor/state/amount/slot confirmation has no unauthorized effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Current-state tool contract/fixtures missing (Mathew/Josin) | N/A | Pending execution |

---

### P1-T14 — Provider identity and voice confirmation proof
- **Canonical actions and expected results:** [P1-T14](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#p1-t14--provider-identity-and-voice-confirmation-proof).
- **Traceability:** R21, R24, R36 | Output: P1-O07 | Packages: P1-MAT-004, P1-DEV-002, P1-TIN-001
- **Domain Operator:** Mathew (Backend Lead); Devadathan native support | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** WhatsApp Cloud API sandbox; account-link proof mechanism; clear and ambiguous synthetic audio voice notes.
- **Approved Expected Result:** Authenticated provider messages map only to verified customer; forged webhooks rejected; ambiguous voice transcripts require confirmation before tool action.
- **Repository Grounding:** [packages/providers/src/index.ts](../../packages/providers/src/index.ts#L6) (`"whatsapp"` returns `NOT_IMPLEMENTED`).
- **Existing Tests:** Current dev has editable draft and local media-capture lifecycle fixtures; no real WhatsApp identity-linking/transcription/confirmed-action acceptance.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T14.S02-V01`` | Incoming WhatsApp text message processed via verified webhook | Missing | Not provisioned | Unexecuted | Not executed; Webhook returns 503 | **Blocked** | WhatsApp webhook handler missing (Mathew) | N/A | Pending execution |
| ``P1-T14.S02-V02`` | WhatsApp customer completes authenticated account-linking flow | Missing | Not provisioned | Unexecuted | Not executed; Link service missing | **Blocked** | Account linking service missing (Mathew) | N/A | Pending execution |
| ``P1-T14.S03-V01`` | Forged WhatsApp webhook signature rejected | Missing | Not provisioned | Unexecuted | Not executed; Webhook returns 503 | **Blocked** | WhatsApp signature check missing (Mathew) | N/A | Pending execution |
| ``P1-T14.S03-V02`` | Replayed account-linking token rejected | Missing | Not provisioned | Unexecuted | Not executed; Link service missing | **Blocked** | Link token replay protection missing (Mathew) | N/A | Pending execution |
| ``P1-T14.S03-V03`` | Duplicate provider event payload delivery deduplicated safely without double processing or cross-account leak | Missing | Not provisioned | Unexecuted | Not executed; Webhook unavailable | **Blocked** | Provider event-ID/business deduplication fixtures missing (Mathew) | N/A | Pending execution |
| ``P1-T14.S04-V01`` | Clear audio voice note transcribed accurately into reviewable text | Missing | Not provisioned | Unexecuted | Not executed; Audio service missing | **Blocked** | Audio transcription service missing (Mathew) | N/A | Pending execution |
| ``P1-T14.S04-V02`` | Ambiguous audio transcript requires customer clarification | Missing | Not provisioned | Unexecuted | Not executed; Audio service missing | **Blocked** | Transcript ambiguity check missing (Mathew) | N/A | Pending execution |
| `P1-T14.S02-V03` | Actual provider media maps only to authenticated linked customer | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved provider media/account fixture missing (Mathew) | N/A | Pending execution |
| `P1-T14.S03-V04` | Forged account-link proof cannot map another customer | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Account-link proof implementation/fixtures missing (Mathew) | N/A | Pending execution |
| `P1-T14.S03-V05` | Replayed provider event identity has no unauthorized effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Provider identity replay fixture missing (Mathew) | N/A | Pending execution |
| `P1-T14.S04-V11` | Edit transcript before confirmation; unchecked original triggers no action | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Actual transcription and authorized tool fixture missing (Mathew/Devadathan) | N/A | Pending execution |
| `P1-T14.S04-V04` | Cancel transcript before confirmation; no tool action occurs | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Actual transcription cancellation fixture missing (Mathew/Devadathan) | N/A | Pending execution |
| `P1-T14.S04-V05` | Confirm reviewed transcript only against fresh authorized tool state | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Current-state tool/confirmation integration missing (Mathew) | N/A | Pending execution |
| `P1-T14.S04-V06` | Ambiguous spoken number cannot execute unchecked action | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved number-ambiguity audio/oracle missing (Mathew/company physician) | N/A | Pending execution |
| `P1-T14.S04-V07` | Ambiguous spoken unit cannot execute unchecked action | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved unit-ambiguity audio/oracle missing (Mathew/company physician) | N/A | Pending execution |
| `P1-T14.S04-V08` | Oversize voice media is handled safely without unchecked tool action | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved media limit/provider fixture missing (Mathew/Devadathan) | N/A | Pending execution |
| `P1-T14.S04-V09` | Expired provider media cannot authorize unchecked transcript action | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved media-expiry fixture missing (Mathew) | N/A | Pending execution |
| `P1-T14.S04-V10` | Microphone permission denial leaves safe reviewable text path without action | Missing | Not provisioned | Unexecuted | Not executed; Local permission UI fixtures exist | **Blocked** | Actual supported-device/provider voice path missing (Devadathan/Mathew) | N/A | Pending execution |
| ``P1-T14.S04-V03`` | Customer edits, cancels, or confirms transcribed voice draft prior to execution; cancelled draft produces zero action; parent checkpoint, no aggregate Pass; children S04-V11 (edit), S04-V04 (cancel), S04-V05 (fresh confirm) | Missing | Not provisioned | Unexecuted | Not executed; Local editable draft exists, actual audio/tool integration unavailable | **Blocked** | Actual provider voice draft lifecycle and authorized action evidence missing (Mathew/Devadathan) | N/A | Pending execution |

---

### P1-T15 — Content separation, takeover and core locales
- **Canonical actions and expected results:** [P1-T15](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#p1-t15--content-separation-takeover-and-core-locales).
- **Traceability:** R16, R20, R22 | Output: P1-O06 | Packages: P1-DEN-002, P1-PAU-001, P1-TIN-001
- **Domain Operator:** Tinu / Denzil / Paul; Mathew / Devadathan review | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Content editor account; physician approver account; active chat session; translated UI strings in English, Malayalam, Tamil.
- **Approved Expected Result:** Editor cannot approve own medical content; human agent takeover pauses AI bot replies; core UI screens render usable fonts/strings across all 3 locales.
- **Repository Grounding:** [packages/i18n/src/index.ts](../../packages/i18n/src/index.ts), [packages/ui/src/index.tsx](../../packages/ui/src/index.tsx), [apps/workspaces/src/main.tsx](../../apps/workspaces/src/main.tsx).
- **Existing Tests:** [starter locale smoke](../../tests/e2e/starter.spec.ts) and current dev's client-foundation font/keyboard/narrow-layout fixtures (section 1.1); no full approved clinical/content UI acceptance.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T15.S02-V01`` | Content editor drafts monograph; cannot approve or publish directly | Missing | Not provisioned | Unexecuted | Not executed; No KB admin UI | **Blocked** | KB approval workflow missing (Mathew/Denzil) | N/A | Pending execution |
| ``P1-T15.S02-V02`` | Separate physician approver account reviews and approves monograph | Missing | Not provisioned | Unexecuted | Not executed; No KB admin UI | **Blocked** | Physician approval UI missing (Mathew/Denzil) | N/A | Pending execution |
| ``P1-T15.S03-V01`` | Staff takes over active chat; AI bot replies immediately pause | Missing | Not provisioned | Unexecuted | Not executed; No chat service | **Blocked** | Human takeover state missing (Mathew/Devadathan) | N/A | Pending execution |
| `P1-T15.S04-V01` | English UI strings/fonts/keyboard/error checkpoint | Historical `a6fb539` only | Reported local browser | Reported 2026-10-23 | UNVERIFIED historical en preview observation; no artifacts/executor supplied | **Blocked** | Full approved screens and exact-candidate evidence missing (Paul/Denzil) | N/A | Missing evidence/sign-off |
| `P1-T15.S04-V02` | Malayalam UI strings/fonts/keyboard/error checkpoint | Historical `a6fb539` only | Reported local browser | Reported 2026-10-23 | UNVERIFIED historical ml preview observation; no artifacts/executor supplied | **Blocked** | Full approved screens and exact-candidate evidence missing (Paul/Denzil) | N/A | Missing evidence/sign-off |
| `P1-T15.S04-V03` | Tamil UI strings/fonts/keyboard/error checkpoint | Historical `a6fb539` only | Reported local browser | Reported 2026-10-23 | UNVERIFIED historical ta preview observation; no artifacts/executor supplied | **Blocked** | Full approved screens and exact-candidate evidence missing (Paul/Denzil) | N/A | Missing evidence/sign-off |
| `P1-T15.S02-V03` | Direct editor publication cannot make draft retrievable as approved | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Current KB approval/retrieval fixture missing (Mathew/Denzil) | N/A | Pending execution |
| `P1-T15.S03-V02` | Takeover pauses already-pending bot generation/action | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Bot ownership and concurrent-generation fixture missing (Mathew) | N/A | Pending execution |
| `P1-T15.S03-V03` | New customer message after takeover receives only current-owner handling | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Actual staff takeover/message fixture missing (Mathew/Devadathan) | N/A | Pending execution |
| `P1-T15.S04-V04` | English strings and physician-approved medical wording remain unchanged | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved full-screen English/content oracle missing (Paul/Denzil/company physician) | N/A | Pending execution |
| `P1-T15.S04-V05` | English fonts remain usable with supported text scaling | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Full-screen supported-device typography matrix missing (Paul/Denzil) | N/A | Pending execution |
| `P1-T15.S04-V06` | English keyboard navigation and visible focus remain usable | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Full-screen keyboard/focus matrix missing (Paul/Denzil) | N/A | Pending execution |
| `P1-T15.S04-V07` | English error states display approved useful labels | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Integrated error fixtures and approved strings missing (Paul/Denzil) | N/A | Pending execution |
| `P1-T15.S04-V08` | Malayalam strings and physician-approved medical wording remain unchanged | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved full-screen Malayalam/content oracle missing (Paul/Denzil/company physician) | N/A | Pending execution |
| `P1-T15.S04-V09` | Malayalam fonts remain usable with supported text scaling | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Full-screen supported-device typography matrix missing (Paul/Denzil) | N/A | Pending execution |
| `P1-T15.S04-V10` | Malayalam keyboard navigation and visible focus remain usable | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Full-screen keyboard/focus matrix missing (Paul/Denzil) | N/A | Pending execution |
| `P1-T15.S04-V11` | Malayalam error states display approved useful labels | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Integrated error fixtures and approved strings missing (Paul/Denzil) | N/A | Pending execution |
| `P1-T15.S04-V12` | Tamil strings and physician-approved medical wording remain unchanged | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved full-screen Tamil/content oracle missing (Paul/Denzil/company physician) | N/A | Pending execution |
| `P1-T15.S04-V13` | Tamil fonts remain usable with supported text scaling | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Full-screen supported-device typography matrix missing (Paul/Denzil) | N/A | Pending execution |
| `P1-T15.S04-V14` | Tamil keyboard navigation and visible focus remain usable | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Full-screen keyboard/focus matrix missing (Paul/Denzil) | N/A | Pending execution |
| `P1-T15.S04-V15` | Tamil error states display approved useful labels | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Integrated error fixtures and approved strings missing (Paul/Denzil) | N/A | Pending execution |

---

### P1-T16 — Whole-current-app security review
- **Canonical actions and expected results:** [P1-T16](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#p1-t16--whole-current-app-security-review).
- **Traceability:** R36, R38 | Output: P1-O09 | Packages: P1-DEV-004, P1-MAT-005, P1-TIN-001
- **Domain Operator:** Devadathan and Mathew operate; Tinu tracks | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Authenticated test accounts across all roles; clean candidate checkout; Gitleaks, Opengrep, pnpm audit; security triage matrix.
- **Canonical Expected Result Summary:** Exact-candidate code/config/dependency/artifact findings captured; authenticated ownership/session/private-resource review has no untriaged or blocking findings. Every finding has evidence/reviewer and blockers have independent retests; real false positives require rationale.
- **Repository Grounding:** [scripts/security/check.mjs](../../scripts/security/check.mjs), [scripts/security/scan.mjs](../../scripts/security/scan.mjs), [packages/server/src/index.ts](../../packages/server/src/index.ts).
- **Existing Tests:** [tests/security/*.test.mjs](../../tests/security), [tests/security-scanners/*.test.mjs](../../tests/security-scanners).

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| `P1-T16.S02-V01` | Dependency audit and candidate security patch verification | Historical `a6fb539` only | Reported local / CI | Reported 2026-10-20 | UNVERIFIED historical patch observation; artifacts/executor missing | **Blocked** | CI exists; frozen candidate/artifact evidence missing (Devadathan) | N/A | Missing evidence/sign-off |
| `P1-T16.S02-V02` | Git history/workspace/native secret-scan checkpoint | Historical `a6fb539` only | Reported local / CI | Reported 2026-10-20 | UNVERIFIED historical secret-scan observation; artifacts/executor missing | **Blocked** | Frozen candidate and artifact-specific scans missing (Devadathan) | N/A | Missing evidence/sign-off |
| `P1-T16.S02-V03` | Pinned SAST scan against exact candidate codebase | Historical `a6fb539` only | Reported local / CI | Reported 2026-10-20 | UNVERIFIED historical SAST observation; artifacts/executor missing | **Blocked** | Frozen candidate and retained scan evidence missing (Devadathan) | N/A | Missing evidence/sign-off |
| ``P1-T16.S03-V01`` | Authenticated injection reveals no blocking vulnerability | Missing | Not provisioned | Unexecuted | Not executed; Business endpoints unavailable | **Blocked** | Verified business account/endpoint fixtures missing (Mathew/Devadathan) | N/A | Pending execution |
| ``P1-T16.S03-V02`` | Session fixation reveals no blocking vulnerability | Missing | Not provisioned | Unexecuted | Not executed; Synthetic boundary tests exist | **Blocked** | Actual verified-session fixtures missing (Mathew/Devadathan) | N/A | Pending execution |
| ``P1-T16.S04-V01`` | Formal security triage sign-off with zero unresolved blockers | Missing | Not provisioned | Unexecuted | Not executed; No triage session | **Blocked** | Full candidate security review needed (Devadathan/Mathew) | N/A | Pending execution |
| `P1-T16.S02-V04` | Exact candidate configuration/runtime findings are captured | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Frozen candidate/config scan evidence missing (Devadathan) | N/A | Pending execution |
| `P1-T16.S02-V05` | Web artifact secret/config findings are captured | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Frozen web bytes and artifact scan evidence missing (Devadathan) | N/A | Pending execution |
| `P1-T16.S02-V06` | Native artifact secret/config findings are captured | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Signed native output and scan evidence missing (Devadathan) | N/A | Pending execution |
| `P1-T16.S03-V03` | Authenticated record-ID ownership denial reveals no protected data | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Actual role/record fixtures missing (Mathew) | N/A | Pending execution |
| `P1-T16.S03-V04` | Cookie security follows approved session contract | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved production cookie/session contract missing (Mathew/Devadathan) | N/A | Pending execution |
| `P1-T16.S03-V05` | CSRF attack has no unauthorized effect | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Actual authenticated write/CSRF fixtures missing (Mathew) | N/A | Pending execution |
| `P1-T16.S03-V06` | CORS grants only approved origins/credentials under actual deployment | Missing | Not provisioned | Unexecuted | Not executed; Local CORS regression exists | **Blocked** | Approved deployed company origin fixtures missing (Mathew/Devadathan) | N/A | Pending execution |
| `P1-T16.S03-V07` | Private file ownership denies unauthorized access | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Actual private-file authorization fixture missing (Mathew) | N/A | Pending execution |
| `P1-T16.S03-V08` | Private link expiry/ownership cannot be bypassed | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved private-link TTL and fixture missing (Mathew) | N/A | Pending execution |
| `P1-T16.S03-V09` | Private cache/refresh/back behavior cannot expose stale authorized data | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Actual authenticated private views missing (Mathew/Devadathan) | N/A | Pending execution |
| `P1-T16.S04-V02` | Every blocker independently retested on fixed exact candidate | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Reproducible finding/fix/retest evidence missing (Mathew/Devadathan/Tinu) | N/A | Pending execution |
| `P1-T16.S04-V03` | Each genuine false-positive decision has reproducible evidence/reviewer rationale | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Complete candidate findings/triage register missing (Mathew/Devadathan) | N/A | Pending execution |

---

### P1-T17 — Outbox, lease and duplicate job crash safety
- **Canonical actions and expected results:** [P1-T17](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#p1-t17--outbox-lease-and-duplicate-job-crash-safety).
- **Traceability:** R08, R10, R36, R38 | Output: P1-O08 | Packages: P1-DEV-001, P1-MAT-004, P1-TIN-001
- **Domain Operator:** Devadathan / Mathew; Josin validates financial effect | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** PostgreSQL transactional outbox; queue consumer; simulated worker crash failpoints; lease expiry harness; Dead Letter Queue (DLQ).
- **Canonical Expected Result Summary:** Claim/publish/ack loss preserves durable obligation; lease expiry/concurrent redelivery produces one permitted business effect under the reviewed deduplication contract. Diagnosed DLQ redrive is auditable and reconciles provider/domain state once; transport exhaustion never settles money by itself.
- **Repository Grounding:** Current dev database/outbox and Worker implementation is linked in section 1.1; the empty historical schema is not the current inventory.
- **Existing Tests:** Real local PostgreSQL/workerd crash/retry/fencing/receipt/transport regressions exist (section 1.1), using synthetic probes rather than real provider/domain acceptance.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T17.S02-V01`` | Worker crash immediately after durable outbox claim preserves obligation | Missing | Not provisioned | Unexecuted | Not executed; Local claim/crash tests exist | **Blocked** | Exact deployed candidate and domain obligation fixture missing (Devadathan/Mathew) | N/A | Pending execution |
| ``P1-T17.S02-V02`` | Worker crash after external provider acceptance but before ack preserves obligation | Missing | Not provisioned | Unexecuted | Not executed; Local transport tests exist | **Blocked** | Actual domain/provider reconciliation fixture missing (Devadathan/Mathew/Josin) | N/A | Pending execution |
| ``P1-T17.S03-V01`` | Expired lease redelivered concurrently cannot repeat business effect | Missing | Not provisioned | Unexecuted | Not executed; Local fencing/reclaim tests exist | **Blocked** | Deployed queue/domain fixture missing (Devadathan/Mathew) | N/A | Pending execution |
| ``P1-T17.S03-V02`` | Duplicate consumer execution results in single business effect | Missing | Not provisioned | Unexecuted | Not executed; Domain consumer missing | **Blocked** | Idempotent consumer missing (Josin/Mathew) | N/A | Pending execution |
| ``P1-T17.S04-V01`` | Failed job exhaustion/DLQ preserves outstanding business obligation | Missing | Not provisioned | Unexecuted | Not executed; Local retry/DLQ configuration exists | **Blocked** | Actual DLQ retention/alert/domain evidence missing (Devadathan/Mathew) | N/A | Pending execution |
| ``P1-T17.S04-V02`` | Diagnosed DLQ redrive safely reconciles provider/domain/audit once | Missing | Not provisioned | Unexecuted | Not executed; Local transport tooling exists | **Blocked** | Reviewed domain redrive policy and deployed evidence missing (Devadathan/Mathew/Josin) | N/A | Pending execution |
| `P1-T17.S02-V03` | Crash after queue publication before ack preserves durable work | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Exact deployed queue/domain fault fixture missing (Devadathan) | N/A | Pending execution |
| `P1-T17.S02-V04` | Failure before claim leaves due obligation available for bounded processing | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Deployed current-domain obligation fixture missing (Devadathan/Mathew) | N/A | Pending execution |
| `P1-T17.S03-V03` | Stale domain version suppresses obsolete effect at execution time | Missing | Not provisioned | Unexecuted | Not executed; Synthetic decide fixtures exist | **Blocked** | Actual domain version policy/handler missing (Mathew/Josin) | N/A | Pending execution |
| `P1-T17.S03-V04` | Revoked consent suppresses now-unauthorized job effect | Missing | Not provisioned | Unexecuted | Not executed; Synthetic decide fixtures exist | **Blocked** | Verified current consent/domain handler missing (Mathew) | N/A | Pending execution |
| `P1-T17.S03-V05` | Deadline boundary obeys approved before/at/after policy without stale execution | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved deadline/precision matrix and domain fixtures missing (Mathew/Josin) | N/A | Pending execution |

---

### P1-T18 — Encrypted restore and compatible rollback smoke
- **Canonical actions and expected results:** [P1-T18](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#p1-t18--encrypted-restore-and-compatible-rollback-smoke).
- **Traceability:** R36, R38 | Output: P1-O08 | Packages: P1-DEV-001, P1-TIN-001
- **Domain Operator:** Devadathan (Platform Lead); Josin / Mathew validate totals | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Synthetic encrypted database dump; decryption key; isolated restore target database; prior compatible Worker release bundle.
- **Approved Expected Result:** Encrypted dump restores schema, roles, and data cleanly into isolation within 2 hours; control totals match; previous Worker version runs safely on additive schema.
- **Repository Grounding:** Restricted backup/export, isolated restore and frozen release compatibility tools at current dev are linked in section 1.1. Controlled recovery credentials are never runtime credentials.
- **Existing Tests:** Platform PostgreSQL encrypted-restore/migration/grant/R2 byte-hash/release regressions exist; company independent storage, actual domain totals and deployed rollback acceptance remain missing.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T18.S02-V01`` | Decrypt synthetic backup and restore schema/data to isolated DB | Missing | Not provisioned | Unexecuted | Not executed; Local authenticated restore tools exist | **Blocked** | Company-controlled isolated target/key/storage evidence missing (Devadathan) | N/A | Pending execution |
| ``P1-T18.S03-V01`` | Validate restored database roles/RLS/object-hash checkpoint | Missing | Not provisioned | Unexecuted | Not executed; Local restore/R2 tests exist | **Blocked** | Actual clinical RLS/object recovery evidence missing (Devadathan/Mathew) | N/A | Pending execution |
| ``P1-T18.S03-V02`` | Verify restored money, stock, and booking ledger control totals | Missing | Not provisioned | Unexecuted | Not executed; Ledgers missing | **Blocked** | Domain control totals validator missing (Josin/Mathew) | N/A | Pending execution |
| ``P1-T18.S04-V01`` | Prior compatible Worker runs safely on additive restored schema | Missing | Not provisioned | Unexecuted | Not executed; Frozen artifact/compatibility tooling exists | **Blocked** | Exact prior deployed Worker and timed core smoke missing (Devadathan) | N/A | Pending execution |
| `P1-T18.S02-V02` | Restored extensions and controlled recovery access match approved manifest | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Actual recovery role/extension inventory missing (Devadathan) | N/A | Pending execution |
| `P1-T18.S03-V03` | Restored RLS denies unauthorized actual patient/clinic access | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Domain policies and scoped restore fixture missing (Mathew) | N/A | Pending execution |
| `P1-T18.S03-V04` | Recovered private object references and bytes match source hashes | Missing | Not provisioned | Unexecuted | Not executed; Synthetic local R2 proof exists | **Blocked** | Company R2/independent object recovery evidence missing (Devadathan) | N/A | Pending execution |
| `P1-T18.S03-V05` | Restored job totals and known record samples match source controls | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved domain totals/sample manifest missing (Mathew/Josin) | N/A | Pending execution |
| `P1-T18.S04-V02` | Rollback smoke performs no destructive schema change or duplicate live provider replay | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Isolated deployed rollback/provider controls missing (Devadathan/Josin) | N/A | Pending execution |

---

### P1-T19 — Initial current-slice load baseline
- **Canonical actions and expected results:** [P1-T19](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#p1-t19--initial-current-slice-load-baseline).
- **Traceability:** R02, R12, R38 | Output: P1-O09 | Packages: P1-DEV-001, P1-TIN-001
- **Domain Operator:** Devadathan (Platform Lead); Mathew / Josin assess invariants | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Deployed current-slice candidate; 10 dynamic rps load generation tool (e.g., k6); controlled sandbox provider adapters; baseline control totals.
- **Approved Expected Result:** 10 dynamic requests/sec for 10 minutes executes without invariant violations or connection pool exhaustion; p50/p95 latency and resource metrics recorded honestly.
- **Repository Grounding:** [apps/core-api/wrangler.jsonc](../../apps/core-api/wrangler.jsonc).
- **Existing Tests:** Current dev has a loopback-only five-user/30-second health smoke (section 1.1), not the required realistic 10-rps/10-minute business baseline.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T19.S02-V01`` | 10 dynamic rps for 10 minutes on realistic checkout/booking slice | Missing | Not provisioned | Unexecuted | Not executed; API endpoints return 503 | **Blocked** | Business endpoints missing (Devadathan/Josin/Mathew) | N/A | Pending execution |
| ``P1-T19.S03-V01`` | Record p50/p95, errors and CPU for canonical business run | Missing | Not provisioned | Unexecuted | Not executed; Metrics tools exist | **Blocked** | Realistic domain mix/target and retained run series missing (Devadathan) | N/A | Pending execution |
| ``P1-T19.S03-V02`` | Monitor database connection pool saturation and transaction lock wait | Missing | Not provisioned | Unexecuted | Not executed; Local database driver/tests exist | **Blocked** | Actual domain workload/target pool and lock series missing (Devadathan) | N/A | Pending execution |
| ``P1-T19.S04-V01`` | Reconcile before/after inventory and financial ledgers for zero drift | Missing | Not provisioned | Unexecuted | Not executed; Ledgers missing | **Blocked** | Control total reconciliation scripts missing (Josin) | N/A | Pending execution |
| `P1-T19.S03-V03` | Measure backlog and authorized response correctness without hiding false success/leaks | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Actual business dataset/mix and metrics window missing (Devadathan/Mathew) | N/A | Pending execution |
| `P1-T19.S04-V02` | Booking/job/access controls remain correct across the load run | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Approved booking/job/access control helpers missing (Mathew) | N/A | Pending execution |
| `P1-T19.S04-V03` | Resource recovery and tuning gaps are recorded without hiding failures | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Protected actual load window and resource series missing (Devadathan) | N/A | Pending execution |

---

### P1-T20 — Alerts, dependencies and G1 evidence completeness
- **Canonical actions and expected results:** [P1-T20](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#p1-t20--alerts-dependencies-and-g1-evidence-completeness).
- **Traceability:** R36, R38 | Output: P1-O09 | Packages: P1-TIN-090, P1-DEV-080, P1-TIN-001
- **Domain Operator:** Tinu coordinates; Devadathan & Company Owners participate | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Operational alert sink; external readiness register; all test results and defect records across P1-T01 through P1-T19.
- **Canonical Expected Result Summary:** Actual recipient receives actionable redacted failure/operation reference. All due evidence/dependencies have owner/version; failed/blocked/pending work and remaining effort remain explicit. Authorized reviewers record Pass/Rework/No-go honestly; only a Pass permits the documented promotion gate.
- **Repository Grounding:** [docs/governance/EXTERNAL_READINESS_REGISTER.md](../governance/EXTERNAL_READINESS_REGISTER.md), [docs/quality/GATE_REPORT_TEMPLATE.md](GATE_REPORT_TEMPLATE.md).
- **Existing Tests:** Current dev has metrics/SLI/redaction and local alert receiver checks; HTTP receiver acceptance is not named company recipient receipt or achieved monthly availability.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T20.S02-V01`` | Trigger synthetic server fault; confirm actual named recipient alert receipt | Missing | Not provisioned | Unexecuted | Not executed; Local redaction/receiver tools exist | **Blocked** | Approved operational routing and recipient confirmation missing (Devadathan) | N/A | Pending execution |
| `P1-T20.S03-V01` | Verify every due requirement/output/package against actual evidence | Historical `a6fb539` only | Reported documentation inspection | Reported 2026-10-23 | UNVERIFIED historical review observation; no artifact/executor supplied | **Blocked** | Actual candidate requirement evidence and external accounts missing (All Owners/Devadathan) | N/A | Missing evidence/sign-off |
| ``P1-T20.S04-V01`` | Compile G1 gate evidence package and record formal gate decision | Missing | Not provisioned | Unexecuted | Not executed; Prerequisite tests blocked | **Blocked** | Blocked by missing P1 implementations (All Owners) | N/A | Pending execution |
| `P1-T20.S02-V02` | Received alert has actionable failure/operation ID and no private content | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Authorized recipient evidence and exact fault fixture missing (Devadathan) | N/A | Pending execution |
| `P1-T20.S03-V02` | Provider/store/account dependencies and independent reviewers have actual owner/version evidence | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Company dependency/reviewer approvals missing (Company Owners/Tinu) | N/A | Pending execution |
| `P1-T20.S04-V02` | Failed/blocked/pending inventory and remaining-effort risk inform explicit Rework/No-go when required | Missing | Not provisioned | Unexecuted | Not executed | **Blocked** | Candidate campaign and authorized gate review missing (All Owners/Tinu) | N/A | Pending execution |

---

## 4. Blocker and Handoff Summary Register

These are remaining acceptance gaps, not claims that the merged local modules are absent. Section 1.1 records the source/version boundary; the same owners supply missing deployment, domain and independent evidence.

| Blocker ID | Affected Canonical Test Cases | Required Implementation / Deliverable | Responsible Domain Owner | Target Package / Branch |
|---|---|---|---|---|
| **BLK-01** | `P1-T01`, `P1-T16`, `P1-T18`, `P1-T19`, `P1-T20` | Staging environment deployment, candidate freeze tag (`rc-p1-g1-xx`), release manifest verification, and deployed bundle secret scanning (CI workflows in `.github/workflows/` exist; cloud deployment target and freeze tag missing) | **Devadathan** (Platform Lead) | `P1-DEV-001` / `feature/p1-devadathan-platform-foundation` |
| **BLK-02** | `P1-T02`, `P1-T03`, `P1-T09` | WorkOS AuthKit, staff MFA, session revocation, and RBAC middleware | **Mathew** (Backend Lead) | `P1-MAT-001` / `feature/p1-mathew-identity-clinical-contracts` |
| **BLK-03** | `P1-T03`, `P1-T04`, `P1-T05`, `P1-T07`, `P1-T17` | Domain relational tables, verified clinical/commerce RLS and actual hosted Neon scoped-driver proof; platform driver/roles/migrations already exist | **Mathew** (Backend Lead) with Josin | `P1-MAT-001`, `P1-JOS-001` |
| **BLK-04** | `P1-T04`, `P1-T05`, `P1-T06` | Server-authoritative pricing, FEFO inventory allocation, and Razorpay sandbox payments | **Josin** (Commerce Lead) with Mathew | `P1-JOS-002`, `P1-JOS-003` |
| **BLK-05** | `P1-T07`, `P1-T08` | Cross-clinic doctor booking engine, hold TTL expiry, and late payment reconciliation | **Mathew** (Backend Lead) with Josin | `P1-MAT-002` / `feature/p1-mathew-booking-clinical-core` |
| **BLK-06** | `P1-T12`, `P1-T13` | Knowledge base schema, grounded RAG, emergency red-flag filters, and tool confirmation | **Mathew** (AI Technical Lead) | `P1-MAT-003` / `feature/p1-mathew-safe-rag-foundation` |
| **BLK-07** | `P1-T14` | WhatsApp Cloud API webhook, audio transcription, and account-link proof | **Mathew** (Backend Lead) with Devadathan | `P1-MAT-004` / `feature/p1-mathew-channel-job-contracts` |
| **BLK-08** | `P1-T15` | KB editor self-approval prevention and staff chat takeover pause logic | **Denzil** with Mathew | `P1-DEN-002` / `feature/p1-denzil-approved-content-locales` |
| **BLK-09** | `P1-T10`, `P1-T11` | Actual signed Android/iOS auth/payment/video proofs and private signaling; local link/storage/media adapters already exist | **Devadathan** (Mobile Lead) with Paul | `P1-DEV-002` / `feature/p1-devadathan-web-native-sdk-proof` |
| **BLK-10** | `P1-T17` | Deployed queue/DLQ delivery/redrive, real domain handlers and provider reconciliation evidence; local outbox/lease/receipt modules exist | **Devadathan** with Mathew | `P1-DEV-001` / `feature/p1-devadathan-platform-foundation` |
| **BLK-11** | `P1-T18` | Independent company backup/key/object storage, domain controls and timed deployed recovery/rollback evidence; local encrypted restore tools exist | **Devadathan** (Platform Lead) | `P1-DEV-001` / `feature/p1-devadathan-platform-foundation` |
| **BLK-12** | `P1-T19` | Realistic 10 rps / 10 min business load, dataset/mix and retained metrics; local health smoke exists | **Devadathan** with Josin & Mathew | `P1-DEV-001`, `P1-DEV-090` |
| **BLK-13** | `P1-T20` | Actual operational routing, named recipient receipt and private-data review; local alert/redaction tools exist | **Devadathan** (Platform Lead) | `P1-DEV-001` / `feature/p1-devadathan-platform-foundation` |

---

## 5. Execution Rules and Evidence Protocol

1. **Evidence Storage:** Test run outputs, redacted screenshots, request/response headers, and transaction audit logs must be recorded in the designated QA evidence store. No live credentials or unredacted patient data may be committed to Git.
2. **Defect Tracking:** Any failed assertion must be logged using [DEFECT_TEMPLATE.md](DEFECT_TEMPLATE.md) and linked to the specific Subcase / Run ID in this register.
3. **Independent Retesting:** After a domain owner merges a fix to `dev`, Tinu must independently retest the failing subcase plus all impacted cumulative critical paths on a newly tagged candidate.
4. **Gate G1 Decision Criteria:** G1 can only be recommended for **Pass** when all 20 canonical groups have complete evidence, zero unresolved critical/high defects, and signed company oracles.
