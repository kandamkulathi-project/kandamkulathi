# Phase 1 Test-Run Register â€” Foundations & Core Journeys (G1)

**Document ID:** KND-QA-REG-001
**Version:** 1.0
**Baseline Date:** 2026-10-23
**QA Lead / Test Coordinator:** Tinu (Role: QA Coordination, Fixtures, Basic Regression, Evidence Collection & Gate Reports; no feature development ownership)
**Governing Canon:** [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md)
**Supporting Plans:** [Kandamkulathi_10_Tinu_QA_and_Test_Cases_All_Phases.md](../implementation/Kandamkulathi_10_Tinu_QA_and_Test_Cases_All_Phases.md), [Kandamkulathi_02_Phase_1_Foundations_and_Core_Journeys.md](../implementation/Kandamkulathi_02_Phase_1_Foundations_and_Core_Journeys.md), [TEST_STRATEGY.md](TEST_STRATEGY.md)
**Current Monorepo Baseline SHA:** `a6fb539930e56c1a58eca424834322800deee977` (Branch: `dev`)
**Assigned Task:** KAN-98 / P1-TIN-001

---

## 1. Governance and Authority Rules

1. **Source of Truth:** This register operationalizes canonical test groups `P1-T01`â€“`P1-T20` defined in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#L231). Canonical titles, procedure steps, and variation IDs are preserved without alteration.
2. **Status Definitions and Consistency:**
   - **Pending:** Prerequisites are available and the test has not yet been executed.
   - **Blocked:** The test cannot be executed because an implementation, environment, dependency, approved oracle, or other required prerequisite is missing. A known missing prerequisite strictly prevents a test from being marked `Pending`.
   - **Pass:** The test was actually executed against an identified candidate and all acceptance criteria were met with recorded evidence. A missing or partial implementation must never be marked `Pass`.
   - **Fail:** The test was actually executed against an identified candidate and one or more acceptance criteria failed.
3. **Execution-Result Integrity:** Statically inspecting source code, finding that an endpoint returns a 503 stub, or identifying unbuilt routes does not constitute runtime test execution. Rows where `Exec Date` is `Unexecuted` explicitly state `Not executed` and preserve identifiable repository-inspection findings without representing source-code observations as runtime test results.
4. **Independent Role Boundary:** Tinu coordinates QA, records execution evidence, logs defects, and verifies gate readiness without owning feature-development implementation. Feature implementations, migrations, security scans, load tests, and domain oracles remain owned by their respective domain leads.

---

## 2. Master Summary: Phase 1 Canonical Test Groups (P1-T01â€“P1-T20)

| Group ID | Canonical Title | Traceability (Req / Output / Package) | Domain Owner | Current Status | Primary Blocker / Reason |
|---|---|---|---|---|---|
| **P1-T01** | Reproducible candidate and secret isolation | R36, R38 / P1-O01 / P1-DEV-001 | Devadathan | **Blocked** | Missing candidate freeze manifest, deployed isolated environment, and secret scanning pipeline for bundles. |
| **P1-T02** | Identity, MFA and session failure paths | R03, R36 / P1-O02 / P1-MAT-001 | Mathew | **Blocked** | WorkOS integration, staff MFA enforcement, and session revocation routes are not implemented in source. |
| **P1-T03** | Patient/clinic authorization and pooled RLS cleanup | R14, R32, R36 / P1-O02 / P1-MAT-001 | Mathew | **Blocked** | PostgreSQL database tables, connection pooling, and Row-Level Security (RLS) policies are completely missing. |
| **P1-T04** | Authoritative prices and all-or-nothing reservations | R02, R05, R07, R15 / P1-O04 / P1-JOS-002 | Josin | **Blocked** | Server-authoritative cart pricing, multi-batch reservation transaction, and rollback logic are not implemented. |
| **P1-T05** | Last-unit FEFO and unsafe batch exclusion | R05 / P1-O04 / P1-JOS-002 | Josin | **Blocked** | Inventory batch ledger, FEFO query logic, and concurrency row locking are not implemented. |
| **P1-T06** | Payment authenticity, deduplication and uncertainty | R02, R07, R12 / P1-O04 / P1-JOS-003 | Josin | **Blocked** | Razorpay webhook endpoint, signature verification, payment ledger, and reconciliation job are not implemented. |
| **P1-T07** | Cross-clinic booking interval exclusion | R11, R12, R32 / P1-O05 / P1-MAT-002 | Mathew | **Blocked** | Clinic scheduling tables, doctor availability, and cross-clinic interval exclusion locks are not implemented. |
| **P1-T08** | Booking expiry and late payment obligations | R11, R12 / P1-O05 / P1-MAT-002 | Mathew | **Blocked** | Slot hold TTL timer, late payment reconciliation, and rebook/refund obligation handling are not implemented. |
| **P1-T09** | Web roles, current state and denied identifiers | R01, R02, R03, R04, R11, R12, R14 / P1-O06 / P1-DEV-003 | Devadathan | **Blocked** | Integrated web customer shop, staff desk, physician panel, and deep-link authorization checks are not implemented. |
| **P1-T10** | Real-device payment return and network resilience | R02, R03, R25 / P1-O06 / P1-DEV-002 | Devadathan | **Blocked** | Native mobile Razorpay SDK integration, deep-link return handler, and physical device test builds are missing. |
| **P1-T11** | Private video SDK proof and denial paths | R13, R14, R25 / P1-O06 / P1-DEV-002 | Devadathan | **Blocked** | WebRTC signaling via Durable Objects, TURN credential generation, and native video call views are not implemented. |
| **P1-T12** | Knowledge approval, freshness and mandatory safety | R16, R17, R19 / P1-O07 / P1-MAT-003 | Mathew | **Blocked** | Knowledge base storage, approval state filtering, vector retrieval, and physician-approved oracle are missing. |
| **P1-T13** | Urgency, injection and confirmed-tool boundaries | R18, R19, R20 / P1-O07 / P1-MAT-003 | Mathew | **Blocked** | Emergency red-flag escalation, prompt injection filters, and 2-step tool confirmation boundary are missing. |
| **P1-T14** | Provider identity and voice confirmation proof | R21, R24, R36 / P1-O07 / P1-MAT-004 | Mathew | **Blocked** | WhatsApp Cloud API webhook, voice transcription pipeline, and account-link proof mechanism are not implemented. |
| **P1-T15** | Content separation, takeover and core locales | R16, R20, R22 / P1-O06 / P1-DEN-002 | Denzil / Mathew | **Blocked** | Static locale strings exist, but KB editor self-approval prevention and staff chat takeover are not implemented. |
| **P1-T16** | Whole-current-app security review | R36, R38 / P1-O09 / P1-DEV-004 | Devadathan | **Blocked** | Offline scanner scripts exist, but authenticated penetration testing and mobile bundle reviews require app implementation. |
| **P1-T17** | Outbox, lease and duplicate job crash safety | R08, R10, R36, R38 / P1-O08 / P1-DEV-001 | Devadathan | **Blocked** | PostgreSQL outbox table, queue consumer, lease heartbeat, crash recovery, and DLQ redrive are missing. |
| **P1-T18** | Encrypted restore and compatible rollback smoke | R36, R38 / P1-O08 / P1-DEV-001 | Devadathan | **Blocked** | Automated encrypted backup scripts, isolated restore test harness, and Worker rollback verification are missing. |
| **P1-T19** | Initial current-slice load baseline | R02, R12, R38 / P1-O09 / P1-DEV-001 | Devadathan | **Blocked** | Business API endpoints to load-test do not exist; load testing harness scripts are not present in repository. |
| **P1-T20** | Alerts, dependencies and G1 evidence completeness | R36, R38 / P1-O09 / P1-TIN-090 | Tinu / Devadathan | **Blocked** | Missing alerting transport integration; prerequisite test evidence across P1-T01â€“P1-T19 is incomplete. |

---

## 3. Detailed Canonical Test-Run Records (P1-T01 to P1-T20)

### P1-T01 â€” Reproducible candidate and secret isolation
- **Traceability:** R36, R38 | Output: P1-O01 | Packages: P1-DEV-001, P1-TIN-001
- **Domain Operator:** Devadathan (Platform Lead) | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Readiness manifest complete; frozen Git candidate tag; synthetic seed scripts; isolated staging environment; clean reset harness; candidate metadata and baseline control totals recorded.
- **Approved Expected Result:** Clean build and deployment reproduces identical schema/contract hashes; missing/wrong credentials fail fast safely; client bundles contain no private secrets.
- **Repository Grounding:** [.env.example](../../.env.example), [packages/server/src/index.ts](../../packages/server/src/index.ts), [.github/workflows/application.yml](../../.github/workflows/application.yml).
- **Existing Tests:** [tests/security/policy.test.mjs](../../tests/security/policy.test.mjs), [tests/integration/http.test.ts](../../tests/integration/http.test.ts).

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T01.S02-V01`` | Clean build & deploy from checkout; compare schema/artifact hashes | Missing | Not provisioned | Unexecuted | Not executed; No deployment pipeline | **Blocked** | Reproducible deployment harness missing (Devadathan) | N/A | Pending execution |
| ``P1-T01.S03-V01`` | Missing DB credentials and wrong provider keys fail-fast test | Missing | Not provisioned | Unexecuted | Not executed; Runtime config unverified | **Blocked** | Runtime config schema missing (Devadathan) | N/A | Pending execution |
| ``P1-T01.S04-V01`` | Public web bundle inspection for hardcoded credentials | Missing | Not provisioned | Unexecuted | Not executed; Build output not evaluated | **Blocked** | Web build needs candidate bundle inspection (Devadathan) | N/A | Pending execution |
| ``P1-T01.S04-V02`` | Native mobile JS bundle inspection for secrets/signing keys | Missing | Not provisioned | Unexecuted | Not executed; Native bundle not evaluated | **Blocked** | Mobile export bundle inspection needed (Devadathan) | N/A | Pending execution |
| ``P1-T01.S04-V03`` | Deployment and server execution logs inspection for secret leakage | Missing | Not provisioned | Unexecuted | Not executed; No execution logs | **Blocked** | Logging redaction pipeline missing (Devadathan) | N/A | Pending execution |

---

### P1-T02 â€” Identity, MFA and session failure paths
- **Traceability:** R03, R36 | Output: P1-O02 | Packages: P1-MAT-001, P1-DEV-003, P1-TIN-001
- **Domain Operator:** Mathew (Backend Lead) with Devadathan | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** WorkOS test tenant; customer-A/B accounts; staff account with required org & enforced MFA; no-MFA staff fixture; expired/revoked session tokens.
- **Approved Expected Result:** Valid customer/staff sign in to permitted scopes; staff MFA strictly enforced; expired/revoked/invalid tokens denied with 401/403/404; zero privileged leakage.
- **Repository Grounding:** [packages/providers/src/index.ts](../../packages/providers/src/index.ts#L2) (`"workos"` returns `NOT_IMPLEMENTED`), [packages/server/src/index.ts](../../packages/server/src/index.ts).
- **Existing Tests:** [tests/integration/http.test.ts](../../tests/integration/http.test.ts#L21) (verifies fabricated role returns 503 `FEATURE_UNAVAILABLE`).

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T02.S02-V01`` | Customer web/native sign-in through WorkOS AuthKit | Missing | Not provisioned | Unexecuted | Not executed; Auth routes return 503 | **Blocked** | WorkOS integration missing (Mathew) | N/A | Pending execution |
| ``P1-T02.S02-V02`` | Staff sign-in with organization verification and mandatory MFA | Missing | Not provisioned | Unexecuted | Not executed; Auth routes return 503 | **Blocked** | Staff org & MFA checks missing (Mathew) | N/A | Pending execution |
| ``P1-T02.S03-V01`` | Staff endpoint access with customer token | Missing | Not provisioned | Unexecuted | Not executed; Endpoints not implemented | **Blocked** | RBAC middleware missing (Mathew) | N/A | Pending execution |
| ``P1-T02.S03-V02`` | Staff endpoint access with wrong-org staff token | Missing | Not provisioned | Unexecuted | Not executed; Endpoints not implemented | **Blocked** | Org tenancy check missing (Mathew) | N/A | Pending execution |
| ``P1-T02.S03-V03`` | Access with expired or revoked session token | Missing | Not provisioned | Unexecuted | Not executed; Endpoints not implemented | **Blocked** | Session revocation missing (Mathew) | N/A | Pending execution |
| ``P1-T02.S03-V04`` | Access with altered actor/clinic/role claims | Missing | Not provisioned | Unexecuted | Not executed; Endpoints not implemented | **Blocked** | Claim tampering validation missing (Mathew) | N/A | Pending execution |
| ``P1-T02.S04-V01`` | Session expiry, explicit logout, and CSRF token mismatch | Missing | Not provisioned | Unexecuted | Not executed; Endpoints not implemented | **Blocked** | Session lifecycle routes missing (Mathew) | N/A | Pending execution |

---

### P1-T03 â€” Patient/clinic authorization and pooled RLS cleanup
- **Traceability:** R14, R32, R36 | Output: P1-O02 | Packages: P1-MAT-001, P1-TIN-001
- **Domain Operator:** Mathew (Backend Lead) | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Neon PostgreSQL 17 test database; synthetic fixtures: `customer-A`, `customer-B`, `clinic-A`, `clinic-B`, `doctor-assigned`, `doctor-unassigned`.
- **Approved Expected Result:** Permitted reads return authorized records; cross-patient and cross-clinic IDs yield 404/empty data; transaction rollback clears session-local context on pooled connection.
- **Repository Grounding:** [packages/database/src/schema.ts](../../packages/database/src/schema.ts#L4) (empty `clinical` schema only).
- **Existing Tests:** None for database or RLS.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T03.S02-V01`` | Patient-A queries Patient-B record ID via API and direct SQL | Missing | Not provisioned | Unexecuted | Not executed; No clinical tables or API | **Blocked** | Clinical tables & RLS missing (Mathew) | N/A | Pending execution |
| ``P1-T03.S02-V02`` | Clinic-A staff queries Clinic-B records | Missing | Not provisioned | Unexecuted | Not executed; No clinic tables or API | **Blocked** | Clinic tenant isolation missing (Mathew) | N/A | Pending execution |
| ``P1-T03.S02-V03`` | Doctor-unassigned queries patient clinical consultation notes | Missing | Not provisioned | Unexecuted | Not executed; No consultation tables | **Blocked** | Doctor assignment RLS missing (Mathew) | N/A | Pending execution |
| ``P1-T03.S03-V01`` | Transaction exception clears transaction-local RLS context | Missing | Not provisioned | Unexecuted | Not executed; No DB pool client | **Blocked** | Transaction RLS context cleanup missing (Mathew) | N/A | Pending execution |
| ``P1-T03.S03-V02`` | Reused pooled connection by distinct actor has no inherited state | Missing | Not provisioned | Unexecuted | Not executed; No DB pool client | **Blocked** | Neon pooling integration missing (Mathew) | N/A | Pending execution |
| ``P1-T03.S04-V01`` | Revoked doctor access immediately denies subsequent reads | Missing | Not provisioned | Unexecuted | Not executed; No revocation logic | **Blocked** | Role revocation handling missing (Mathew) | N/A | Pending execution |

---

### P1-T04 â€” Authoritative prices and all-or-nothing reservations
- **Traceability:** R02, R05, R07, R15 | Output: P1-O04 | Packages: P1-JOS-002, P1-MAT-005, P1-TIN-001
- **Domain Operator:** Josin (Commerce Lead) with Mathew | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** `PRICE-GOLDEN` rules; products `P-RETAIL-V1`, `P-CONSULT`; tampered quantity/pricing/role payloads; multi-batch reservation fixtures; simulated final-guard failure.
- **Approved Expected Result:** Server reprices client-altered carts to authoritative values; rejects invalid/tampered quantities and role tiers; failed final-guard aborts the entire transaction leaving zero reservation, order, or outbox deltas.
- **Repository Grounding:** [packages/domain/src/index.ts](../../packages/domain/src/index.ts#L3) (`lineSubtotalPaise`), [packages/contracts/src/index.ts](../../packages/contracts/src/index.ts#L24).
- **Existing Tests:** [tests/unit/money.test.ts](../../tests/unit/money.test.ts) (subtotal arithmetic unit test).

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T04.S02-V01`` | Client alters unit price or currency; server reprices authoritatively | Missing | Not provisioned | Unexecuted | Not executed; Checkout API returns 503 | **Blocked** | Authoritative checkout API missing (Josin) | N/A | Pending execution |
| ``P1-T04.S02-V02`` | Client submits stale cart with changed price/tax rules | Missing | Not provisioned | Unexecuted | Not executed; Cart API returns 503 | **Blocked** | Cart validation API missing (Josin) | N/A | Pending execution |
| ``P1-T04.S02-V03`` | Client alters quantity or role/pricing tier; server rejects manipulation | Missing | Not provisioned | Unexecuted | Not executed; Checkout API returns 503 | **Blocked** | Authoritative checkout & quantity validation missing (Josin) | N/A | Pending execution |
| ``P1-T04.S03-V01`` | Multi-item cart triggers final-batch guard failure inside transaction | Missing | Not provisioned | Unexecuted | Not executed; Reservation DB logic missing | **Blocked** | Atomic reservation transaction missing (Josin) | N/A | Pending execution |
| ``P1-T04.S04-V01`` | Database audit confirms zero partial order/reservation/outbox records | Missing | Not provisioned | Unexecuted | Not executed; DB tables missing | **Blocked** | Commerce schema missing (Josin/Mathew) | N/A | Pending execution |

---

### P1-T05 â€” Last-unit FEFO and unsafe batch exclusion
- **Traceability:** R05 | Output: P1-O04 | Packages: P1-JOS-002, P1-MAT-005, P1-TIN-001
- **Domain Operator:** Josin (Commerce Lead) and Mathew | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Exactly 1 available unit of `B-LAST`; batches `B-EARLY`, `B-LATE`; unsafe batches `B-EXPIRED`, `B-RECALLED`, `B-SHORTLIFE`; concurrency barrier harness.
- **Approved Expected Result:** Concurrent requests reserve up to available balance without oversell; losers receive clean conflict; expired/recalled/short-life batches are strictly excluded.
- **Repository Grounding:** [packages/contracts/src/index.ts](../../packages/contracts/src/index.ts#L25) (`quantitySchema`).
- **Existing Tests:** None for inventory or concurrency.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T05.S02-V01`` | Two concurrent checkouts race for 1 available unit (`B-LAST`) | Missing | Not provisioned | Unexecuted | Not executed; No checkout route or DB | **Blocked** | Inventory reservation locks missing (Josin) | N/A | Pending execution |
| ``P1-T05.S03-V01`` | FEFO reservation allocates `B-EARLY` prior to `B-LATE` | Missing | Not provisioned | Unexecuted | Not executed; No batch tables | **Blocked** | FEFO query logic missing (Josin) | N/A | Pending execution |
| ``P1-T05.S03-V02`` | Expired batch `B-EXPIRED` is excluded from checkout eligibility | Missing | Not provisioned | Unexecuted | Not executed; No batch tables | **Blocked** | Batch eligibility filters missing (Josin) | N/A | Pending execution |
| ``P1-T05.S03-V03`` | Recalled batch `B-RECALLED` is excluded from checkout eligibility | Missing | Not provisioned | Unexecuted | Not executed; No batch tables | **Blocked** | Recall quarantine logic missing (Josin) | N/A | Pending execution |
| ``P1-T05.S03-V04`` | Near-expiry batch `B-SHORTLIFE` excluded under shelf-life rule | Missing | Not provisioned | Unexecuted | Not executed; No batch tables | **Blocked** | Minimum shelf-life rules missing (Josin) | N/A | Pending execution |
| ``P1-T05.S04-V01`` | Retrying conflicting checkout request does not produce negative stock | Missing | Not provisioned | Unexecuted | Not executed; No checkout route | **Blocked** | Idempotent checkout retry missing (Josin) | N/A | Pending execution |

---

### P1-T06 â€” Payment authenticity, deduplication and uncertainty
- **Traceability:** R02, R07, R12 | Output: P1-O04 | Packages: P1-JOS-003, P1-MAT-005, P1-TIN-001
- **Domain Operator:** Josin (Commerce Lead) with Mathew & Devadathan | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Razorpay sandbox keys; payment success/failure/cancellation payloads; valid webhook signature; forged HMAC signature payload; duplicate/reordered event payloads; network drop injection tool.
- **Approved Expected Result:** Only authentic sandbox webhook advances paid status; payment failure and cancellation retain accurate unpaid status; browser return cannot spoof payment; forged/duplicate events rejected; dropped responses reconcile by operation ID.
- **Repository Grounding:** [packages/providers/src/index.ts](../../packages/providers/src/index.ts#L3) (`"razorpay"` returns `NOT_IMPLEMENTED`).
- **Existing Tests:** None for webhooks or payments.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T06.S02-V01`` | Sandbox payment success event transitions order to paid | Missing | Not provisioned | Unexecuted | Not executed; No payment routes | **Blocked** | Razorpay payment adapter missing (Josin) | N/A | Pending execution |
| ``P1-T06.S02-V02`` | Sandbox payment failure event maintains accurate unpaid/failure state | Missing | Not provisioned | Unexecuted | Not executed; No payment routes | **Blocked** | Razorpay payment failure handling missing (Josin) | N/A | Pending execution |
| ``P1-T06.S02-V03`` | User cancellation in checkout preserves unpaid/cancelled state without charge | Missing | Not provisioned | Unexecuted | Not executed; No payment routes | **Blocked** | Payment cancellation flow missing (Josin) | N/A | Pending execution |
| ``P1-T06.S02-V04`` | Browser-return redirect / spoofing rejected; paid state requires provider webhook | Missing | Not provisioned | Unexecuted | Not executed; No order routes | **Blocked** | Server-authoritative state missing (Josin) | N/A | Pending execution |
| ``P1-T06.S03-V01`` | Webhook with valid HMAC signature accepted | Missing | Not provisioned | Unexecuted | Not executed; No webhook endpoint | **Blocked** | Webhook verification endpoint missing (Josin) | N/A | Pending execution |
| ``P1-T06.S03-V02`` | Webhook with forged HMAC signature rejected with 401 | Missing | Not provisioned | Unexecuted | Not executed; No webhook endpoint | **Blocked** | Webhook signature validator missing (Josin) | N/A | Pending execution |
| ``P1-T06.S03-V03`` | Duplicate webhook delivery produces exactly one payment ledger entry | Missing | Not provisioned | Unexecuted | Not executed; No ledger schema | **Blocked** | Payment deduplication missing (Josin) | N/A | Pending execution |
| ``P1-T06.S03-V04`` | Webhook with mismatched amount or currency rejected | Missing | Not provisioned | Unexecuted | Not executed; No webhook endpoint | **Blocked** | Payment invariant validation missing (Josin) | N/A | Pending execution |
| ``P1-T06.S04-V01`` | Dropped provider response leaves order in explicit reconcilable state | Missing | Not provisioned | Unexecuted | Not executed; No reconciliation job | **Blocked** | Payment reconciliation job missing (Josin) | N/A | Pending execution |

---

### P1-T07 â€” Cross-clinic booking interval exclusion
- **Traceability:** R11, R12, R32 | Output: P1-O05 | Packages: P1-MAT-002, P1-JOS-003, P1-TIN-001
- **Domain Operator:** Mathew (Backend Lead) with Josin | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Clinics `clinic-A`, `clinic-B`; shared doctor `D-SHARED`; overlapping buffer intervals; adjacent slot fixtures; booking race barrier.
- **Approved Expected Result:** Shared physician cannot be booked for overlapping intervals across clinics including travel buffers; valid adjacent half-open intervals succeed.
- **Repository Grounding:** [packages/database/src/schema.ts](../../packages/database/src/schema.ts#L5) (empty `clinical` schema).
- **Existing Tests:** None for appointments or bookings.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T07.S02-V01`` | Concurrent booking race for same doctor across clinic-A & clinic-B | Missing | Not provisioned | Unexecuted | Not executed; No booking API or DB | **Blocked** | Cross-clinic booking exclusion missing (Mathew) | N/A | Pending execution |
| ``P1-T07.S03-V01`` | Overlapping buffer interval prevents conflicting second booking | Missing | Not provisioned | Unexecuted | Not executed; No booking engine | **Blocked** | Buffer interval logic missing (Mathew) | N/A | Pending execution |
| ``P1-T07.S03-V02`` | Valid half-open adjacent interval succeeds without conflict | Missing | Not provisioned | Unexecuted | Not executed; No booking engine | **Blocked** | Slot boundary logic missing (Mathew) | N/A | Pending execution |
| ``P1-T07.S03-V03`` | Doctor leave calendar blocks slot generation and booking | Missing | Not provisioned | Unexecuted | Not executed; No leave schema | **Blocked** | Doctor leave schema & logic missing (Mathew) | N/A | Pending execution |
| ``P1-T07.S04-V01`` | Active slot hold excludes concurrent hold or confirmation | Missing | Not provisioned | Unexecuted | Not executed; No hold engine | **Blocked** | Slot hold mechanism missing (Mathew) | N/A | Pending execution |

---

### P1-T08 â€” Booking expiry and late payment obligations
- **Traceability:** R11, R12 | Output: P1-O05 | Packages: P1-MAT-002, P1-JOS-003, P1-TIN-001
- **Domain Operator:** Mathew (Backend Lead) and Josin | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Configured slot hold TTL (e.g., 10 minutes); controllable server clock; delayed sandbox payment event; changed consultation fee fixture; duplicate refund attempt payload.
- **Approved Expected Result:** Payment before TTL confirms slot; payment after TTL rejects slot confirmation and creates exactly 1 rebook/refund obligation; fees use immutable booking snapshot; duplicate refund requests strictly rejected.
- **Repository Grounding:** [packages/contracts/src/index.ts](../../packages/contracts/src/index.ts).
- **Existing Tests:** None.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T08.S02-V01`` | Fee payment completed before slot hold TTL expiry confirms booking | Missing | Not provisioned | Unexecuted | Not executed; No appointment routes | **Blocked** | Booking confirmation API missing (Mathew) | N/A | Pending execution |
| ``P1-T08.S02-V02`` | Fee payment completed exactly at hold TTL boundary | Missing | Not provisioned | Unexecuted | Not executed; No hold timer | **Blocked** | Hold TTL boundary logic missing (Mathew) | N/A | Pending execution |
| ``P1-T08.S02-V03`` | Fee payment completed after hold TTL expiry rejects slot confirmation | Missing | Not provisioned | Unexecuted | Not executed; No hold timer | **Blocked** | Hold expiry handler missing (Mathew) | N/A | Pending execution |
| ``P1-T08.S03-V01`` | Doctor fee changed during hold; checkout uses snapshot fee | Missing | Not provisioned | Unexecuted | Not executed; No fee snapshot logic | **Blocked** | Fee snapshot invariant missing (Mathew/Josin) | N/A | Pending execution |
| ``P1-T08.S03-V02`` | Customer cancellation obeys policy-defined refund rules | Missing | Not provisioned | Unexecuted | Not executed; No cancellation API | **Blocked** | Appointment refund policy missing (Josin) | N/A | Pending execution |
| ``P1-T08.S03-V03`` | Duplicate refund request rejected; ledger records at most one refund | Missing | Not provisioned | Unexecuted | Not executed; No refund API | **Blocked** | Refund deduplication and ledger invariants missing (Josin/Mathew) | N/A | Pending execution |
| ``P1-T08.S04-V01`` | Late payment generates exactly 1 durable rebook-or-refund obligation | Missing | Not provisioned | Unexecuted | Not executed; No obligation table | **Blocked** | Rebook/refund obligation engine missing (Mathew) | N/A | Pending execution |

---

### P1-T09 â€” Web roles, current state and denied identifiers
- **Traceability:** R01, R02, R03, R04, R11, R12, R14 | Output: P1-O06 | Packages: P1-DEV-003, P1-PAU-001, P1-PAU-003, P1-DEN-003, P1-TIN-001
- **Domain Operator:** Tinu with Paul / Denzil; Devadathan supports | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Deployed public web and workspaces applications; customer-A, staff, and physician test accounts; unowned order/booking URLs.
- **Approved Expected Result:** Allowed journeys render accurate backend state; direct URL navigation to foreign identifiers returns 404/denial with zero private field leaks.
- **Repository Grounding:** [apps/workspaces/src/main.tsx](../../apps/workspaces/src/main.tsx), [apps/web-public/src/components/Welcome.tsx](../../apps/web-public/src/components/Welcome.tsx).
- **Existing Tests:** [tests/e2e/starter.spec.ts](../../tests/e2e/starter.spec.ts#L17) (browser smoke checking placeholder notice).

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T09.S02-V01`` | Customer completes catalogue browsing, cart, and booking on web | Missing | Not provisioned | Unexecuted | Not executed; Web UI is static preview | **Blocked** | Customer web journeys missing (Paul/Devadathan) | N/A | Pending execution |
| ``P1-T09.S02-V02`` | Staff order desk navigation renders current order states | Missing | Not provisioned | Unexecuted | Not executed; Workspace is static text | **Blocked** | Staff order desk UI missing (Denzil/Devadathan) | N/A | Pending execution |
| ``P1-T09.S02-V03`` | Physician panel renders assigned consultations only | Missing | Not provisioned | Unexecuted | Not executed; Workspace is static text | **Blocked** | Physician panel UI missing (Denzil/Devadathan) | N/A | Pending execution |
| ``P1-T09.S03-V01`` | Direct URL navigation to foreign customer order ID returns 404 | Missing | Not provisioned | Unexecuted | Not executed; No order routing | **Blocked** | Client deep-link authorization missing (Devadathan) | N/A | Pending execution |
| ``P1-T09.S03-V02`` | Direct URL navigation to forbidden staff route redirects safely | Missing | Not provisioned | Unexecuted | Not executed; No workspace router | **Blocked** | Workspace route guard missing (Devadathan) | N/A | Pending execution |
| ``P1-T09.S04-V01`` | Session expiry during active workflow presents clear sign-in return | Missing | Not provisioned | Unexecuted | Not executed; No auth state handler | **Blocked** | Client session return logic missing (Devadathan) | N/A | Pending execution |

---

### P1-T10 â€” Real-device payment return and network resilience
- **Traceability:** R02, R03, R25 | Output: P1-O06 | Packages: P1-DEV-002, P1-PAU-004, P1-TIN-001
- **Domain Operator:** Tinu / Paul; Devadathan owns adapters | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Physical Android & iOS test devices; signed Expo development builds; Razorpay sandbox checkout; network proxy/throttle.
- **Approved Expected Result:** Real-device payment callback returns to owned order; repeated taps, backgrounding, and network drops do not create duplicate purchases or false paid state.
- **Repository Grounding:** [apps/mobile/App.tsx](../../apps/mobile/App.tsx), [apps/mobile/app.json](../../apps/mobile/app.json).
- **Existing Tests:** None for native devices or payments.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T10.S02-V01`` | Android device launches sandbox payment and returns via deep link | Missing | Not provisioned | Unexecuted | Not executed; Mobile app is placeholder | **Blocked** | Android payment integration missing (Devadathan) | N/A | Pending execution |
| ``P1-T10.S02-V02`` | iOS device launches sandbox payment and returns via universal link | Missing | Not provisioned | Unexecuted | Not executed; Mobile app is placeholder | **Blocked** | iOS payment integration missing (Devadathan) | N/A | Pending execution |
| ``P1-T10.S03-V01`` | Repeated taps on native checkout submit button are debounced | Missing | Not provisioned | Unexecuted | Not executed; Mobile app is placeholder | **Blocked** | Native checkout UI missing (Paul/Devadathan) | N/A | Pending execution |
| ``P1-T10.S03-V02`` | App backgrounded and resumed during payment submission | Missing | Not provisioned | Unexecuted | Not executed; Mobile app is placeholder | **Blocked** | Native lifecycle handling missing (Devadathan) | N/A | Pending execution |
| ``P1-T10.S03-V03`` | Network disconnected during payment callback return | Missing | Not provisioned | Unexecuted | Not executed; Mobile app is placeholder | **Blocked** | Network resilience handler missing (Devadathan) | N/A | Pending execution |
| ``P1-T10.S04-V01`` | Reconnect reconciles to true server status without duplicate charge | Missing | Not provisioned | Unexecuted | Not executed; Mobile app is placeholder | **Blocked** | Native order polling missing (Devadathan) | N/A | Pending execution |

---

### P1-T11 â€” Private video SDK proof and denial paths
- **Traceability:** R13, R14, R25 | Output: P1-O06 | Packages: P1-DEV-002, P1-MAT-001, P1-TIN-001
- **Domain Operator:** Devadathan (Platform Lead); Mathew validates access | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Web browser; physical Android & iOS devices; booked consultation fixture; valid/expired room tokens; WebRTC/TURN credentials.
- **Approved Expected Result:** Booked patient and assigned doctor join private media call; unassigned participant or expired token rejected; camera/mic denials recover gracefully.
- **Repository Grounding:** [packages/providers/src/index.ts](../../packages/providers/src/index.ts#L8) (`"video"` returns `NOT_IMPLEMENTED`).
- **Existing Tests:** None for video or WebRTC.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T11.S02-V01`` | Booked patient and assigned doctor join private call on web | Missing | Not provisioned | Unexecuted | Not executed; Video provider not built | **Blocked** | WebRTC signaling adapter missing (Devadathan) | N/A | Pending execution |
| ``P1-T11.S02-V02`` | Patient and doctor join private call across Android and iOS devices | Missing | Not provisioned | Unexecuted | Not executed; Native video UI missing | **Blocked** | Native WebRTC bridge missing (Devadathan) | N/A | Pending execution |
| ``P1-T11.S03-V01`` | Unassigned doctor attempting to join room is rejected | Missing | Not provisioned | Unexecuted | Not executed; Room auth missing | **Blocked** | Room authorization missing (Mathew) | N/A | Pending execution |
| ``P1-T11.S03-V02`` | Foreign customer attempting to join room is rejected | Missing | Not provisioned | Unexecuted | Not executed; Room auth missing | **Blocked** | Room authorization missing (Mathew) | N/A | Pending execution |
| ``P1-T11.S03-V03`` | Expired or revoked room token fails to connect | Missing | Not provisioned | Unexecuted | Not executed; Token service missing | **Blocked** | Room token validation missing (Mathew) | N/A | Pending execution |
| ``P1-T11.S04-V01`` | Camera and microphone permission denial handled with safe fallback | Missing | Not provisioned | Unexecuted | Not executed; Native video UI missing | **Blocked** | Native permission UI missing (Devadathan) | N/A | Pending execution |
| ``P1-T11.S04-V02`` | Network disconnection during active call rejoins cleanly on recovery | Missing | Not provisioned | Unexecuted | Not executed; Native video UI missing | **Blocked** | WebRTC reconnect handling missing (Devadathan) | N/A | Pending execution |

---

### P1-T12 â€” Knowledge approval, freshness and mandatory safety
- **Traceability:** R16, R17, R19 | Output: P1-O07 | Packages: P1-MAT-003, P1-TIN-001
- **Domain Operator:** Mathew (AI Technical Lead); Physician approves oracle | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Approved medical oracle; KB fixtures `KB-A` (approved public), `KB-D` (draft), `KB-W` (withdrawn), `KB-P` (private); vector retrieval index.
- **Approved Expected Result:** Model responses cite currently approved public entries and mandatory safety blocks; draft, private, or withdrawn entries are rejected; missing safety produces safe handoff.
- **Repository Grounding:** [apps/companion/src/index.ts](../../apps/companion/src/index.ts), [packages/providers/src/index.ts](../../packages/providers/src/index.ts#L5) (`"openai"` returns `NOT_IMPLEMENTED`).
- **Existing Tests:** None for RAG, KB, or LLM.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T12.S02-V01`` | Query on approved product monograph (`KB-A`) returns cited medical answer | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | Grounded RAG pipeline missing (Mathew) | N/A | Pending execution |
| ``P1-T12.S02-V02`` | Response contains versioned citation to approved source and physician | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | Citation attribution missing (Mathew) | N/A | Pending execution |
| ``P1-T12.S03-V01`` | Vector similarity hit on draft monograph (`KB-D`) is rejected | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | KB approval state gate missing (Mathew) | N/A | Pending execution |
| ``P1-T12.S03-V02`` | Vector similarity hit on withdrawn monograph (`KB-W`) is rejected | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | KB withdrawal exclusion missing (Mathew) | N/A | Pending execution |
| ``P1-T12.S03-V03`` | Query matching private internal clinic notes (`KB-P`) yields no leak | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | Corpus privacy isolation missing (Mathew) | N/A | Pending execution |
| ``P1-T12.S04-V01`` | Missing mandatory primary safety block produces approved safe handoff | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | Mandatory safety injector missing (Mathew) | N/A | Pending execution |

---

### P1-T13 â€” Urgency, injection and confirmed-tool boundaries
- **Traceability:** R18, R19, R20 | Output: P1-O07 | Packages: P1-MAT-003, P1-TIN-001
- **Domain Operator:** Mathew (AI Technical Lead) with Physician; Tinu records | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Physician-approved red-flag test pack; consult-only SKU prompts; prompt injection test cases; 2-step tool confirmation fixtures.
- **Approved Expected Result:** Emergency symptoms trigger urgent escalation without sales; injection attempts fail; tools display current state and require explicit customer confirmation.
- **Repository Grounding:** [apps/companion/src/index.ts](../../apps/companion/src/index.ts).
- **Existing Tests:** None for emergency escalation or prompt injection.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T13.S02-V01`` | Red-flag medical symptom input triggers approved emergency escalation | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | Red-flag detector missing (Mathew) | N/A | Pending execution |
| ``P1-T13.S02-V02`` | Red-flag conversation blocks automated cart addition or checkout link | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | No-sale conversation lock missing (Mathew) | N/A | Pending execution |
| ``P1-T13.S03-V01`` | Prompt injection attempting to bypass disclaimers is safely refused | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | Prompt injection filters missing (Mathew) | N/A | Pending execution |
| ``P1-T13.S03-V02`` | Prompt injection attempting unauthorized tool execution is rejected | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | Tool authorization boundary missing (Mathew) | N/A | Pending execution |
| ``P1-T13.S04-V01`` | Tool proposal requires explicit customer confirmation before write | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | 2-step tool confirmation missing (Mathew) | N/A | Pending execution |
| ``P1-T13.S04-V02`` | Replayed, tampered, or expired tool confirmation is rejected | Missing | Not provisioned | Unexecuted | Not executed; Companion API returns 503 | **Blocked** | Confirmation nonce validation missing (Mathew) | N/A | Pending execution |

---

### P1-T14 â€” Provider identity and voice confirmation proof
- **Traceability:** R21, R24, R36 | Output: P1-O07 | Packages: P1-MAT-004, P1-DEV-002, P1-TIN-001
- **Domain Operator:** Mathew (Backend Lead); Devadathan native support | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** WhatsApp Cloud API sandbox; account-link proof mechanism; clear and ambiguous synthetic audio voice notes.
- **Approved Expected Result:** Authenticated provider messages map only to verified customer; forged webhooks rejected; ambiguous voice transcripts require confirmation before tool action.
- **Repository Grounding:** [packages/providers/src/index.ts](../../packages/providers/src/index.ts#L6) (`"whatsapp"` returns `NOT_IMPLEMENTED`).
- **Existing Tests:** None for WhatsApp or voice.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T14.S02-V01`` | Incoming WhatsApp text message processed via verified webhook | Missing | Not provisioned | Unexecuted | Not executed; Webhook returns 503 | **Blocked** | WhatsApp webhook handler missing (Mathew) | N/A | Pending execution |
| ``P1-T14.S02-V02`` | WhatsApp customer completes authenticated account-linking flow | Missing | Not provisioned | Unexecuted | Not executed; Link service missing | **Blocked** | Account linking service missing (Mathew) | N/A | Pending execution |
| ``P1-T14.S03-V01`` | Forged WhatsApp webhook signature rejected | Missing | Not provisioned | Unexecuted | Not executed; Webhook returns 503 | **Blocked** | WhatsApp signature check missing (Mathew) | N/A | Pending execution |
| ``P1-T14.S03-V02`` | Replayed account-linking token rejected | Missing | Not provisioned | Unexecuted | Not executed; Link service missing | **Blocked** | Link token replay protection missing (Mathew) | N/A | Pending execution |
| ``P1-T14.S04-V01`` | Clear audio voice note transcribed accurately into reviewable text | Missing | Not provisioned | Unexecuted | Not executed; Audio service missing | **Blocked** | Audio transcription service missing (Mathew) | N/A | Pending execution |
| ``P1-T14.S04-V02`` | Ambiguous audio transcript requires customer clarification | Missing | Not provisioned | Unexecuted | Not executed; Audio service missing | **Blocked** | Transcript ambiguity check missing (Mathew) | N/A | Pending execution |

---

### P1-T15 â€” Content separation, takeover and core locales
- **Traceability:** R16, R20, R22 | Output: P1-O06 | Packages: P1-DEN-002, P1-PAU-001, P1-TIN-001
- **Domain Operator:** Tinu / Denzil / Paul; Mathew / Devadathan review | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Content editor account; physician approver account; active chat session; translated UI strings in English, Malayalam, Tamil.
- **Approved Expected Result:** Editor cannot approve own medical content; human agent takeover pauses AI bot replies; core UI screens render usable fonts/strings across all 3 locales.
- **Repository Grounding:** [packages/i18n/src/index.ts](../../packages/i18n/src/index.ts), [packages/ui/src/index.tsx](../../packages/ui/src/index.tsx), [apps/workspaces/src/main.tsx](../../apps/workspaces/src/main.tsx).
- **Existing Tests:** [tests/e2e/starter.spec.ts](../../tests/e2e/starter.spec.ts#L3) (verifies language switcher for `en`, `ml`, `ta`).

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T15.S02-V01`` | Content editor drafts monograph; cannot approve or publish directly | Missing | Not provisioned | Unexecuted | Not executed; No KB admin UI | **Blocked** | KB approval workflow missing (Mathew/Denzil) | N/A | Pending execution |
| ``P1-T15.S02-V02`` | Separate physician approver account reviews and approves monograph | Missing | Not provisioned | Unexecuted | Not executed; No KB admin UI | **Blocked** | Physician approval UI missing (Mathew/Denzil) | N/A | Pending execution |
| ``P1-T15.S03-V01`` | Staff takes over active chat; AI bot replies immediately pause | Missing | Not provisioned | Unexecuted | Not executed; No chat service | **Blocked** | Human takeover state missing (Mathew/Devadathan) | N/A | Pending execution |
| `P1-T15.S04-V01` | English (`en`) UI strings, fonts, keyboard navigation, error states | `a6fb539` | Local browser | 2026-10-23 | Starter preview displays `en` (2026-10-23); full screens unbuilt | **Blocked** | Core application screens and UI strings missing (Paul/Denzil) | N/A | Pending full app |
| `P1-T15.S04-V02` | Malayalam (`ml`) UI strings, complex fonts, keyboard navigation | `a6fb539` | Local browser | 2026-10-23 | Starter preview switches `ml` (2026-10-23); full screens unbuilt | **Blocked** | Core application screens and UI strings missing (Paul/Denzil) | N/A | Pending full app |
| `P1-T15.S04-V03` | Tamil (`ta`) UI strings, fonts, keyboard navigation, error states | `a6fb539` | Local browser | 2026-10-23 | Starter preview switches `ta` (2026-10-23); full screens unbuilt | **Blocked** | Core application screens and UI strings missing (Paul/Denzil) | N/A | Pending full app |

---

### P1-T16 â€” Whole-current-app security review
- **Traceability:** R36, R38 | Output: P1-O09 | Packages: P1-DEV-004, P1-MAT-005, P1-TIN-001
- **Domain Operator:** Devadathan and Mathew operate; Tinu tracks | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Authenticated test accounts across all roles; clean candidate checkout; Gitleaks, Opengrep, pnpm audit; security triage matrix.
- **Approved Expected Result:** Whole-candidate code, dependency, secret, and config scans complete; authenticated injection/CSRF/CORS/IDOR checks show zero untriaged critical/high findings.
- **Repository Grounding:** [scripts/security/check.mjs](../../scripts/security/check.mjs), [scripts/security/scan.mjs](../../scripts/security/scan.mjs), [packages/server/src/index.ts](../../packages/server/src/index.ts).
- **Existing Tests:** [tests/security/*.test.mjs](../../tests/security), [tests/security-scanners/*.test.mjs](../../tests/security-scanners).

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| `P1-T16.S02-V01` | Dependency audit and candidate security patch verification | `a6fb539` | Local / CI | 2026-10-20 | Historical bootstrap patches passed (2026-10-20); candidate scan blocked | **Blocked** | Candidate freeze tag and CI pipeline missing (Devadathan) | N/A | Pending candidate tag |
| `P1-T16.S02-V02` | Complete Git history, workspace, and native bundle secret scan via Gitleaks | `a6fb539` | Local / CI | 2026-10-20 | Historical dev secret scan passed (2026-10-20); candidate scan blocked | **Blocked** | Candidate freeze tag and native bundle scan missing (Devadathan) | N/A | Pending candidate tag |
| `P1-T16.S02-V03` | Pinned offline SAST scan via Opengrep against candidate codebase | `a6fb539` | Local / CI | 2026-10-20 | Historical dev SAST passed (2026-10-20); candidate scan blocked | **Blocked** | Candidate freeze tag and full app SAST missing (Devadathan) | N/A | Pending candidate tag |
| ``P1-T16.S03-V01`` | Authenticated injection and IDOR record-access testing | Missing | Not provisioned | Unexecuted | Not executed; Endpoints not implemented | **Blocked** | Business endpoints missing (Mathew/Devadathan) | N/A | Pending execution |
| ``P1-T16.S03-V02`` | Session fixation, cookie security (`no-store`), and CORS rules | Missing | Not provisioned | Unexecuted | Not executed; Only scaffold tested | **Blocked** | Production auth & CORS missing (Devadathan) | N/A | Pending execution |
| ``P1-T16.S04-V01`` | Formal security triage sign-off with zero unresolved blockers | Missing | Not provisioned | Unexecuted | Not executed; No triage session | **Blocked** | Full candidate security review needed (Devadathan/Mathew) | N/A | Pending execution |

---

### P1-T17 â€” Outbox, lease and duplicate job crash safety
- **Traceability:** R08, R10, R36, R38 | Output: P1-O08 | Packages: P1-DEV-001, P1-MAT-004, P1-TIN-001
- **Domain Operator:** Devadathan / Mathew; Josin validates financial effect | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** PostgreSQL transactional outbox; queue consumer; simulated worker crash failpoints; lease expiry harness; Dead Letter Queue (DLQ).
- **Approved Expected Result:** Crash after claim or publish preserves durable obligation; lease expiry / duplicate redelivery executes exactly once; exhausted retries route to DLQ safely.
- **Repository Grounding:** [packages/database/src/schema.ts](../../packages/database/src/schema.ts#L6) (empty `engagement` schema).
- **Existing Tests:** None for outbox or queue workers.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T17.S02-V01`` | Worker crash immediately after outbox record claim | Missing | Not provisioned | Unexecuted | Not executed; Outbox schema missing | **Blocked** | Outbox worker missing (Devadathan/Mathew) | N/A | Pending execution |
| ``P1-T17.S02-V02`` | Worker crash after external provider accept but before ack | Missing | Not provisioned | Unexecuted | Not executed; Outbox worker missing | **Blocked** | Outbox ack handling missing (Devadathan/Mathew) | N/A | Pending execution |
| ``P1-T17.S03-V01`` | Lease expired job redelivered concurrently to second worker | Missing | Not provisioned | Unexecuted | Not executed; Queue infra missing | **Blocked** | Lease heartbeat missing (Devadathan) | N/A | Pending execution |
| ``P1-T17.S03-V02`` | Duplicate consumer execution results in single business effect | Missing | Not provisioned | Unexecuted | Not executed; Domain consumer missing | **Blocked** | Idempotent consumer missing (Josin/Mathew) | N/A | Pending execution |
| ``P1-T17.S04-V01`` | Failed job exhausts retries and routes to Dead Letter Queue (DLQ) | Missing | Not provisioned | Unexecuted | Not executed; DLQ not configured | **Blocked** | DLQ routing missing (Devadathan) | N/A | Pending execution |
| ``P1-T17.S04-V02`` | Manual redrive from DLQ resolves outbox obligation safely | Missing | Not provisioned | Unexecuted | Not executed; DLQ redrive missing | **Blocked** | DLQ redrive tooling missing (Devadathan) | N/A | Pending execution |

---

### P1-T18 â€” Encrypted restore and compatible rollback smoke
- **Traceability:** R36, R38 | Output: P1-O08 | Packages: P1-DEV-001, P1-TIN-001
- **Domain Operator:** Devadathan (Platform Lead); Josin / Mathew validate totals | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Synthetic encrypted database dump; decryption key; isolated restore target database; prior compatible Worker release bundle.
- **Approved Expected Result:** Encrypted dump restores schema, roles, and data cleanly into isolation within 2 hours; control totals match; previous Worker version runs safely on additive schema.
- **Repository Grounding:** [.env.example](../../.env.example#L11) (`DATABASE_ADMIN_URL`).
- **Existing Tests:** None for backup, restore, or rollback.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T18.S02-V01`` | Decrypt synthetic backup and restore schema/data to isolated DB | Missing | Not provisioned | Unexecuted | Not executed; Restore scripts missing | **Blocked** | Database backup/restore scripts missing (Devadathan) | N/A | Pending execution |
| ``P1-T18.S03-V01`` | Validate restored database roles, RLS policies, and object hashes | Missing | Not provisioned | Unexecuted | Not executed; Restore scripts missing | **Blocked** | Backup validation harness missing (Devadathan) | N/A | Pending execution |
| ``P1-T18.S03-V02`` | Verify restored money, stock, and booking ledger control totals | Missing | Not provisioned | Unexecuted | Not executed; Ledgers missing | **Blocked** | Domain control totals validator missing (Josin/Mathew) | N/A | Pending execution |
| ``P1-T18.S04-V01`` | Run previous compatible Worker against restored schema | Missing | Not provisioned | Unexecuted | Not executed; Version history missing | **Blocked** | Rollback compatibility smoke harness missing (Devadathan) | N/A | Pending execution |

---

### P1-T19 â€” Initial current-slice load baseline
- **Traceability:** R02, R12, R38 | Output: P1-O09 | Packages: P1-DEV-001, P1-TIN-001
- **Domain Operator:** Devadathan (Platform Lead); Mathew / Josin assess invariants | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Deployed current-slice candidate; 10 dynamic rps load generation tool (e.g., k6); controlled sandbox provider adapters; baseline control totals.
- **Approved Expected Result:** 10 dynamic requests/sec for 10 minutes executes without invariant violations or connection pool exhaustion; p50/p95 latency and resource metrics recorded honestly.
- **Repository Grounding:** [apps/core-api/wrangler.jsonc](../../apps/core-api/wrangler.jsonc).
- **Existing Tests:** None for performance or load.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T19.S02-V01`` | 10 dynamic rps for 10 minutes on realistic checkout/booking slice | Missing | Not provisioned | Unexecuted | Not executed; API endpoints return 503 | **Blocked** | Business endpoints missing (Devadathan/Josin/Mathew) | N/A | Pending execution |
| ``P1-T19.S03-V01`` | Record p50 and p95 response latencies, error counts, CPU usage | Missing | Not provisioned | Unexecuted | Not executed; Metrics not collected | **Blocked** | Observability metrics pipeline missing (Devadathan) | N/A | Pending execution |
| ``P1-T19.S03-V02`` | Monitor database connection pool saturation and transaction lock wait | Missing | Not provisioned | Unexecuted | Not executed; Database not connected | **Blocked** | Database pool observability missing (Devadathan) | N/A | Pending execution |
| ``P1-T19.S04-V01`` | Reconcile before/after inventory and financial ledgers for zero drift | Missing | Not provisioned | Unexecuted | Not executed; Ledgers missing | **Blocked** | Control total reconciliation scripts missing (Josin) | N/A | Pending execution |

---

### P1-T20 â€” Alerts, dependencies and G1 evidence completeness
- **Traceability:** R36, R38 | Output: P1-O09 | Packages: P1-TIN-090, P1-DEV-080, P1-TIN-001
- **Domain Operator:** Tinu coordinates; Devadathan & Company Owners participate | **QA Coordinator:** Tinu
- **Preconditions & Fixtures:** Operational alert sink; external readiness register; all test results and defect records across P1-T01 through P1-T19.
- **Approved Expected Result:** Simulated failure delivers redacted, actionable alert; external dependencies accurately recorded; formal G1 gate decision signed with zero unresolved blockers.
- **Repository Grounding:** [docs/governance/EXTERNAL_READINESS_REGISTER.md](../governance/EXTERNAL_READINESS_REGISTER.md), [docs/quality/GATE_REPORT_TEMPLATE.md](GATE_REPORT_TEMPLATE.md).
- **Existing Tests:** None for alerting.

| Subcase / Run ID | Variation Description | Candidate SHA / Tag | Environment | Exec Date | Actual Result | Status | Blocker & Domain Owner | Defect Ref | Retest & Sign-off |
|---|---|---|---|---|---|---|---|---|---|
| ``P1-T20.S02-V01`` | Trigger synthetic server fault; confirm redacted alert receipt | Missing | Not provisioned | Unexecuted | Not executed; Alert sink not wired | **Blocked** | Alert routing & PHI redaction missing (Devadathan) | N/A | Pending execution |
| `P1-T20.S03-V01` | Verify every due requirement/output/package against actual evidence | `a6fb539` | Documentation | 2026-10-23 | Register reviewed (2026-10-23); actual requirement evidence blocked | **Blocked** | Prerequisite requirement evidence and external accounts missing (All Owners / Devadathan) | N/A | Pending requirement evidence |
| ``P1-T20.S04-V01`` | Compile G1 gate evidence package and record formal gate decision | Missing | Not provisioned | Unexecuted | Not executed; Prerequisite tests blocked | **Blocked** | Blocked by missing P1 implementations (All Owners) | N/A | Pending execution |

---

## 4. Blocker and Handoff Summary Register

All blockers are grounded in repository evidence and mapped to documented primary owners:

| Blocker ID | Affected Canonical Test Cases | Required Implementation / Deliverable | Responsible Domain Owner | Target Package / Branch |
|---|---|---|---|---|
| **BLK-01** | `P1-T01`, `P1-T16`, `P1-T18`, `P1-T19`, `P1-T20` | Staging environment deployment, candidate tag, release manifest, and bundle secret scanning | **Devadathan** (Platform Lead) | `P1-DEV-001` / `feature/p1-devadathan-platform-foundation` |
| **BLK-02** | `P1-T02`, `P1-T03`, `P1-T09` | WorkOS AuthKit, staff MFA, session revocation, and RBAC middleware | **Mathew** (Backend Lead) | `P1-MAT-001` / `feature/p1-mathew-identity-clinical-contracts` |
| **BLK-03** | `P1-T03`, `P1-T04`, `P1-T05`, `P1-T07`, `P1-T17` | Neon PostgreSQL 17 client, relational tables, migrations, RLS policies, and non-owner roles | **Mathew** (Backend Lead) with Josin | `P1-MAT-001`, `P1-JOS-001` |
| **BLK-04** | `P1-T04`, `P1-T05`, `P1-T06` | Server-authoritative pricing, FEFO inventory allocation, and Razorpay sandbox payments | **Josin** (Commerce Lead) with Mathew | `P1-JOS-002`, `P1-JOS-003` |
| **BLK-05** | `P1-T07`, `P1-T08` | Cross-clinic doctor booking engine, hold TTL expiry, and late payment reconciliation | **Mathew** (Backend Lead) with Josin | `P1-MAT-002` / `feature/p1-mathew-booking-clinical-core` |
| **BLK-06** | `P1-T12`, `P1-T13` | Knowledge base schema, grounded RAG, emergency red-flag filters, and tool confirmation | **Mathew** (AI Technical Lead) | `P1-MAT-003` / `feature/p1-mathew-safe-rag-foundation` |
| **BLK-07** | `P1-T14` | WhatsApp Cloud API webhook, audio transcription, and account-link proof | **Mathew** (Backend Lead) with Devadathan | `P1-MAT-004` / `feature/p1-mathew-channel-job-contracts` |
| **BLK-08** | `P1-T15` | KB editor self-approval prevention and staff chat takeover pause logic | **Denzil** with Mathew | `P1-DEN-002` / `feature/p1-denzil-approved-content-locales` |
| **BLK-09** | `P1-T10`, `P1-T11` | Physical Android/iOS builds, native Razorpay bridge, and WebRTC signaling Durable Objects | **Devadathan** (Mobile Lead) with Paul | `P1-DEV-002` / `feature/p1-devadathan-web-native-sdk-proof` |
| **BLK-10** | `P1-T17` | PostgreSQL transactional outbox table, queue consumer, lease heartbeat, and DLQ | **Devadathan** with Mathew | `P1-DEV-001` / `feature/p1-devadathan-platform-foundation` |
| **BLK-11** | `P1-T18` | Automated encrypted database backup scripts and isolated restore verification harness | **Devadathan** (Platform Lead) | `P1-DEV-001` / `feature/p1-devadathan-platform-foundation` |
| **BLK-12** | `P1-T19` | 10 rps / 10 min load testing harness and performance metrics observation | **Devadathan** with Josin & Mathew | `P1-DEV-001`, `P1-DEV-090` |
| **BLK-13** | `P1-T20` | Operational alert webhook/transport and PHI/PII log redaction filter | **Devadathan** (Platform Lead) | `P1-DEV-001` / `feature/p1-devadathan-platform-foundation` |

---

## 5. Execution Rules and Evidence Protocol

1. **Evidence Storage:** Test run outputs, redacted screenshots, request/response headers, and transaction audit logs must be recorded in the designated QA evidence store. No live credentials or unredacted patient data may be committed to Git.
2. **Defect Tracking:** Any failed assertion must be logged using [DEFECT_TEMPLATE.md](DEFECT_TEMPLATE.md) and linked to the specific Subcase / Run ID in this register.
3. **Independent Retesting:** After a domain owner merges a fix to `dev`, Tinu must independently retest the failing subcase plus all impacted cumulative critical paths on a newly tagged candidate.
4. **Gate G1 Decision Criteria:** G1 can only be recommended for **Pass** when all 20 canonical groups have complete evidence, zero unresolved critical/high defects, and signed company oracles.
