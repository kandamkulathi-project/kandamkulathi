# Kandamkulathi Digital Commerce & Companion

> **Named team allocation update — 19 October 2026:** The six individual plans numbered 05–10 now govern named ownership, branches and person-hour allocation. Mathew owns backend/AI and critical domain review; Devadathan owns frontend/mobile/platform/release; Josin owns commerce with Mathew’s review; Paul and Denzil own bounded support/UI/content work; Tinu leads QA with no critical product feature assignment. Original E1–E6 IDs below remain technical scope references, not a direct mapping to these people. The previous per-E-role ownership/hour/day grids are superseded by the named plans. All R01–R38 acceptance criteria, phase outputs, 10-day window, protected test gates and overall phase hour/category totals remain unchanged. See [the named team plans](Kandamkulathi_05_Mathew_All_Phases.md) and [Tinu’s standalone detailed test cases](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md).

## Document 02 — Phase 1: Foundations and Verified Core Journeys

| Document control | Baseline |
|---|---|
| ID / version / prepared | KND-PH1-002 / 1.0 / 19 October 2026 |
| Governing document | [Kandamkulathi_01_Master_Implementation_Plan_3_Phases.md](Kandamkulathi_01_Master_Implementation_Plan_3_Phases.md) |
| Window | Days 1–3 · 19–21 October 2026 |
| Team capacity | Six engineers × 3 working days = 18 person-days / 144 planning hours |
| Gate | G1 — cumulative tests of the entire currently implemented app; no unresolved blockers |
| Fixed architecture | Workers Paid + Neon PostgreSQL 17, WorkOS, R2, Vectorize, Queues/Cron, Durable Objects/WebRTC/TURN and the agreed provider integrations |
| Status | Planned. Work packages, tests, provider approvals and gate results are pending; this document claims no completed implementation. |

## 1. Objective, boundaries and planning conditions

Establish a secured deployed foundation and working shopping/payment and doctor/booking slices, then pass broad cumulative testing of the entire currently implemented app.

All 38 company requirements remain mandatory. The six-engineer team and ten-working-day calendar are unchanged; 24–25 October provide no development capacity. This phase plan supplies exact work packages and allocations for its window. The later member documents will collect each person's assignments across phases without adding work, changing IDs or creating extra capacity.

**Estimate basis:** Hours below are provisional remaining-effort allocations for adapting audited reusable modules, tested native adapters and available company content—not validated estimates for building this whole product from scratch. No application repository/reuse evidence has been supplied to this planning exercise. Day 1 must verify the actual baseline and bottom-up fit. If assets, approvals or effort do not fit, record the affected R IDs and revised full-scope forecast; never compress the protected testing or hide a missing requirement.

One person-day is eight planning hours including coordination, code review, test work and documentation. B = build/integration/hardening, V = verification, E = environment/release/handover, C = protected defect/retest reserve. Company clinical/finance/privacy/operations reviewers provide acceptance; they are not additional engineers. Review effort belongs inside the reviewers' existing allocations.

Testing supplies risk/coverage evidence; it cannot prove the absence of every possible bug or vulnerability. A gate requires zero unresolved critical/high security findings and zero clinical/privacy/financial/core-workflow or required-acceptance blockers, triaged findings and exact-candidate evidence. No document may label an untested implementation “bug-free.”


### Current branch and QA authority

All named package branches in section 4 start from current `dev` and PR to `dev`; no direct shared-branch development. Freeze exact candidate SHA/build/config/model/KB for the broad campaign, issue new immutable candidate tags after fixes, and retest affected/critical cases. Devadathan promotes reviewed G1/G2 Pass or Phase 3 prelaunch Go to `main`; P1/P2 do not auto-deploy publicly. Final G3/tag follows postdeployment checks. Full Git rules are master §15.1/member plans.

Use [Tinu’s standalone test cases](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) as the canonical detailed execution source; this phase’s compact test catalogue retains original IDs/pass conditions and named specialist support.

## 2. Entry conditions and dependency control

Use the master scope, company data/clinical policies, provider-account readiness and named reviewer backups. Keep a dependency register with owner, evidence, due day, affected work packages/R IDs and escalation. A mocked dependency can support isolated development but cannot prove provider integration or required public readiness. Independent work may proceed in isolation while a dependency is resolved; dependent acceptance cannot.

Public/clinical/financial records use PostgreSQL from the beginning. Development can use Neon Free/synthetic data within actual quotas and controlled dispatcher windows; no D1/SQLite-to-PostgreSQL rewrite is planned. Final performance/recovery verification uses paid production-equivalent configuration no later than Day 7. Never use live patient records or production billing/messages in general fixtures/scanners/load tests.

## 3. Required integrated outputs

The following output IDs and acceptance descriptions are inherited from the master. Work-package hours include implementation plus domain integration; output completion also needs the phase's verification and gate evidence.

| Output | Integrated deliverable | Required evidence |
|---|---|---|
| P1-O01 | Repository, reproducible environments and CI | Web/API/mobile builds run; isolated secrets/bindings; reviewed migrations; synthetic seed/reset; release/build identifiers and test artifacts retained. |
| P1-O02 | Identity, roles and sensitive-record boundaries | Customer/staff/doctor identity mapping; mandatory staff MFA; clinic/patient scopes; session revocation and pooled RLS-context tests. |
| P1-O03 | Core data model and opening imports | Product/variant/price/concern, clinic, doctor, batch, order/payment ledger, appointment/consent, approved KB and outbox contracts; validated opening-data import process. |
| P1-O04 | Shopping/payment transaction slice | Product → cart → authoritative price/stock reservation → provider sandbox payment → verified webhook → order visibility; cancellation/refund scaffold with proven idempotent state transitions. |
| P1-O05 | Appointment transaction slice | Directory/hours/fees → slot hold → fee payment → confirmation; cross-clinic overlap protection, hold expiry and late-payment behavior demonstrated. |
| P1-O06 | Working channels and administration skeleton | Customer web and native journeys; staff catalogue/order/doctor/stock foundations; launch-language resource structure; real-device auth/payment/video compatibility evidence. |
| P1-O07 | Approved KB/Companion foundation | Structured draft/approval/version records, initial exact/vector retrieval, source traceability, human fallback and backend tool authorization boundary. Medical output is limited to approved test content. |
| P1-O08 | Reliable work and observability foundation | Atomic outbox, scheduled/leased dispatch, queue acknowledgment/retry/DLQ, trace IDs, redacted logs, alert test and first encrypted backup/restore smoke. |
| P1-O09 | Gate G1 evidence package | Current-app regression/security results, concurrency and early performance evidence, issue triage, company review and recorded proceed/rework decision. |

## 4. Capacity and exact work-package register

The named register below is authoritative for execution, branches and exclusive capacity. B = implementation/QA preparation, V = verification, E = environment/handover, C = conditional reserve. Old E1–E6 IDs in section 7 are retained unbudgeted **technical references**, not six additional people or a second schedule.

| Person | B h | V h | E h | C h | Total h |
|---|---:|---:|---:|---:|---:|
| Mathew | 18 | 4 | 0 | 2 | 24 |
| Josin | 17 | 4 | 1 | 2 | 24 |
| Devadathan | 17 | 4 | 1 | 2 | 24 |
| Paul | 16 | 4 | 2 | 2 | 24 |
| Denzil | 16 | 4 | 2 | 2 | 24 |
| Tinu | 8 | 12 | 2 | 2 | 24 |
| **Total** | **92** | **32** | **8** | **12** | **144** |

| Named package | Owner | Category | Hours | Exact branch from `dev`; PR to `dev` | Source technical references |
|---|---|---|---:|---|---|
| P1-MAT-001 — Identity, scoped access and clinical contracts | Mathew | B | 4 | `feature/p1-mathew-identity-clinical-contracts` | P1-E1-001, P1-E1-002 |
| P1-MAT-002 — Booking, doctor availability and clinical foundation | Mathew | B | 4 | `feature/p1-mathew-booking-clinical-core` | P1-E1-003, P1-E1-004 |
| P1-MAT-003 — Approved knowledge and safe chatbot foundation | Mathew | B | 5 | `feature/p1-mathew-safe-rag-foundation` | P1-E5-001, P1-E5-002 |
| P1-MAT-004 — Privileged messaging, voice and durable job contracts | Mathew | B | 3 | `feature/p1-mathew-channel-job-contracts` | P1-E5-003, P1-E5-004, P1-E6-003 |
| P1-MAT-005 — Critical transaction and authorization review | Mathew | B | 2 | `feature/p1-mathew-critical-domain-review` | P1-E1-004, P1-E2-002, P1-E2-003, P1-E6-002 |
| P1-MAT-090 — G1 verification and cumulative regression | Mathew | V | 4 | `test/p1-mathew-g1-verification` | P1-E1-090, P1-E5-090 |
| P1-MAT-099 — Protected defect/retest reserve | Mathew | C | 2 | `fix/p1-mathew-bug-001` | P1-E1-099, P1-E5-099 |
| P1-JOS-001 — Commerce schema and validated opening data | Josin | B | 4 | `feature/p1-josin-commerce-data-imports` | P1-E2-001 |
| P1-JOS-002 — Authoritative pricing and atomic FEFO checkout | Josin | B | 5 | `feature/p1-josin-fefo-checkout` | P1-E2-002 |
| P1-JOS-003 — Payments, signed events and refund foundation | Josin | B | 5 | `feature/p1-josin-payment-ledger` | P1-E2-003 |
| P1-JOS-004 — Order/account/staff APIs and client integration | Josin | B | 3 | `feature/p1-josin-orders-core-api` | P1-E2-004 |
| P1-JOS-090 — G1 verification and cumulative regression | Josin | V | 4 | `test/p1-josin-g1-verification` | P1-E2-090 |
| P1-JOS-080 — Environment, acceptance and handover support | Josin | E | 1 | `chore/p1-josin-readiness-handover` |  |
| P1-JOS-099 — Protected defect/retest reserve | Josin | C | 2 | `fix/p1-josin-bug-001` | P1-E2-099 |
| P1-DEV-001 — Environment, CI, security and operations foundation | Devadathan | B | 5 | `feature/p1-devadathan-platform-foundation` | P1-E6-001, P1-E6-002, P1-E6-003 |
| P1-DEV-002 — Shared frontend/mobile foundation and risky SDK proof | Devadathan | B | 5 | `feature/p1-devadathan-web-native-sdk-proof` | P1-E3-001, P1-E4-001, P1-E4-004 |
| P1-DEV-003 — Sensitive session, payment and clinical client integration | Devadathan | B | 4 | `feature/p1-devadathan-sensitive-client-flows` | P1-E3-002, P1-E3-003, P1-E4-002, P1-E4-003 |
| P1-DEV-004 — Cross-client quality and backend peer review | Devadathan | B | 3 | `feature/p1-devadathan-frontend-security-review` | P1-E3-004, P1-E4-004, P1-E6-002 |
| P1-DEV-090 — G1 verification and cumulative regression | Devadathan | V | 4 | `test/p1-devadathan-g1-verification` | P1-E3-090, P1-E4-090, P1-E6-090 |
| P1-DEV-080 — Environment, acceptance and handover support | Devadathan | E | 1 | `chore/p1-devadathan-readiness-handover` | P1-E6-080 |
| P1-DEV-099 — Protected defect/retest reserve | Devadathan | C | 2 | `fix/p1-devadathan-bug-001` | P1-E3-099, P1-E4-099, P1-E6-099 |
| P1-PAU-001 — Customer catalogue/product screens | Paul | B | 5 | `feature/p1-paul-catalogue-ui` | P1-E3-002, P1-E4-002 |
| P1-PAU-002 — Cart, address, order and account presentation | Paul | B | 5 | `feature/p1-paul-cart-account-ui` | P1-E3-002, P1-E4-002 |
| P1-PAU-003 — Directory, booking and appointment presentation | Paul | B | 4 | `feature/p1-paul-booking-ui` | P1-E3-003, P1-E4-003 |
| P1-PAU-004 — Native view assembly and device evidence | Paul | B | 2 | `feature/p1-paul-native-screen-assembly` | P1-E4-001, P1-E4-004 |
| P1-PAU-090 — G1 verification and cumulative regression | Paul | V | 4 | `test/p1-paul-g1-verification` | P1-E3-090, P1-E4-090 |
| P1-PAU-080 — Environment, acceptance and handover support | Paul | E | 2 | `chore/p1-paul-readiness-handover` |  |
| P1-PAU-099 — Protected defect/retest reserve | Paul | C | 2 | `fix/p1-paul-bug-001` | P1-E3-099, P1-E4-099 |
| P1-DEN-001 — Catalogue/import validation support | Denzil | B | 4 | `feature/p1-denzil-import-fixtures` | P1-E2-001 |
| P1-DEN-002 — Approved content, locales and KB editor presentation | Denzil | B | 4 | `feature/p1-denzil-approved-content-locales` | P1-E3-001, P1-E3-004, P1-E5-001 |
| P1-DEN-003 — Read-only staff operational views | Denzil | B | 4 | `feature/p1-denzil-staff-read-views` | P1-E3-003 |
| P1-DEN-004 — Template fixtures, store inputs and quick guides | Denzil | B | 4 | `feature/p1-denzil-templates-store-guides` | P1-E4-004, P1-E5-003, P1-E5-004 |
| P1-DEN-090 — G1 verification and cumulative regression | Denzil | V | 4 | `test/p1-denzil-g1-verification` | P1-E3-090, P1-E5-090 |
| P1-DEN-080 — Environment, acceptance and handover support | Denzil | E | 2 | `chore/p1-denzil-readiness-handover` |  |
| P1-DEN-099 — Protected defect/retest reserve | Denzil | C | 2 | `fix/p1-denzil-bug-001` | P1-E3-099, P1-E5-099 |
| P1-TIN-001 — Prepare Phase 1 cases and gate tracking | Tinu | B | 3 | `test/p1-tinu-foundation-test-cases` | P1-E6-002, P1-E5-004 |
| P1-TIN-002 — Prepare synthetic test accounts and boundary fixtures | Tinu | B | 3 | `test/p1-tinu-synthetic-qa-fixtures` | P1-E1-002, P1-E2-001, P1-E6-003 |
| P1-TIN-003 — Basic repeatable smoke automation | Tinu | B | 2 | `test/p1-tinu-foundation-regression` | P1-E6-002 |
| P1-TIN-090 — G1 verification and cumulative regression | Tinu | V | 12 | `test/p1-tinu-g1-verification` | P1-E1-090, P1-E2-090, P1-E3-090, P1-E4-090, P1-E5-090, P1-E6-090 |
| P1-TIN-080 — Environment, acceptance and handover support | Tinu | E | 2 | `chore/p1-tinu-readiness-handover` | P1-E1-080, P1-E6-080 |
| P1-TIN-099 — Protected defect/retest reserve | Tinu | C | 2 | `fix/p1-tinu-bug-001` | P1-E1-099, P1-E2-099, P1-E3-099, P1-E4-099, P1-E5-099, P1-E6-099 |

Branch suffix `bug-001` is an issue-ID example; create a fix branch only for an actual defect. Review-only/test-execution work requires evidence, not an empty application branch. Full implementation boundaries, inputs, reviewers and acceptance are in the linked member documents; all phases use the same register.

## 5. Daily sequencing and handoff timing

| Person | Day 1: B/V/E/C hours | Day 2: B/V/E/C hours | Day 3: B/V/E/C hours |
|---|---|---|---|
| Mathew | 8 / 0 / 0 / 0 | 8 / 0 / 0 / 0 | 2 / 4 / 0 / 2 |
| Josin | 7 / 0 / 1 / 0 | 8 / 0 / 0 / 0 | 2 / 4 / 0 / 2 |
| Devadathan | 7 / 0 / 1 / 0 | 8 / 0 / 0 / 0 | 2 / 4 / 0 / 2 |
| Paul | 6 / 0 / 2 / 0 | 8 / 0 / 0 / 0 | 2 / 4 / 0 / 2 |
| Denzil | 6 / 0 / 2 / 0 | 8 / 0 / 0 / 0 | 2 / 4 / 0 / 2 |
| Tinu | 5 / 2 / 1 / 0 | 3 / 4 / 1 / 0 | 0 / 6 / 0 / 2 |

Every cell totals eight hours and each person’s daily categories reconcile to section 4 and their member document. These are capacity slices, not an invented second package allocation; follow each member’s named task order and peer handoffs. Reviews/coordination/meetings are included; reserve is conditional and otherwise supports verification/handover. The final four hours of the last day are V for all six. Tinu has two additional earlier V hours that day; B/C activity belongs earlier, never in the protected final campaign. Automated background runtime may overlap, but staff/operator/reviewer hours cannot be double-booked. If actual effort does not fit, reforecast rather than taking test capacity.

## 6. Phase-specific implementation contracts and readiness

### 6.1 Readiness and contract handoffs

| Due point | Handoff | Owner / consumers | Blocker treatment |
|---|---|---|---|
| Day 1 first session | Reuse evidence, named reviewers, account/device/signing availability and company data/clinical-policy gaps | Mathew/Devadathan with all six and company owners | Record remaining estimates/approval gaps before depending on them. A prototype is not proof of tested commerce reuse. |
| Day 1 contract freeze | Entity IDs, states, permissions, errors, money/timestamps, API/events, outbox and provider adapter interfaces | Mathew/Josin/Devadathan publish; Devadathan with Paul/Denzil/Devadathan/Mathew consume | Review shared contracts before implementation diverges. Stable interfaces can unblock isolated work while real endpoints are completed. |
| Day 1 endpoint/platform proof | Company cloud access, PostgreSQL driver/roles/extension, native auth/payment/video proofs and actual provider test access | Devadathan/Mathew/Devadathan/Mathew | Remaining CI polish may continue Day 2; unsupported database/native/provider paths require immediate reforecast. |
| Day 2 integration | Authoritative identity/catalogue/cart/booking/payment APIs and durable receipt/outbox | Mathew/Josin publish; Devadathan with Paul/Denzil/Devadathan/Mathew integrate | A stub can support UI development but is replaced by actual shared endpoints before G1. |
| Day 3 morning | Real queue dispatch/consumer and core channel integration; all core clients on one candidate | Devadathan/Mathew/Mathew/Josin with Devadathan with Paul/Denzil/Devadathan | Complete real effect/replay and restore evidence before candidate freeze; spend defect reserve if necessary and update forecast if insufficient. |
| Day 3 final half-day | Frozen candidate, fixtures, credentials for isolated testing and complete G1 inventory | Tinu coordinates all six; Devadathan/Mathew operate specialist checks | Protect four hours per engineer for broad testing; optional polish does not displace this window. |

Day-grid references can span contracts and implementation: a consumer can code against a frozen interface before its provider finishes, but integration acceptance waits for the real provider. Cross-phase work is not silently pulled into the protected G1 test slot.

### 6.2 Proposed repository and API boundaries

Use one modular repository, with proposed components `apps/api`, `apps/companion`, `apps/storefront`, `apps/workspaces`, `apps/mobile`, `packages/contracts`, `packages/domain`, `packages/db`, `packages/providers`, `packages/test-fixtures`, `ops` and `docs`. Confirm names against the actual reusable repository on Day 1; these are implementation targets, not files already present. Keep business rules in shared server domain services; do not duplicate stock/payment/permission logic in clients or assistant prompts.

| Proposed API family | Required Phase 1 contract and behavior |
|---|---|
| `/v1/session` and staff boundaries | Verified session/actor/role/clinic scope; revoked/expired identity rejected; customer sessions cannot enter staff organization routes. |
| `/v1/catalogue`, `/v1/products`, `/v1/concerns` | Public approved description/variant/price/stock-display fields; pagination and current versions; no patient/private fields. |
| `/v1/cart`, `/v1/checkout`, `/v1/orders` | Current totals/eligibility, explicit confirmation and stable idempotency; owner-only order state; stale/short-stock responses are safe and actionable. |
| `/v1/payments` and provider webhooks | Raw-body signature verification, amount/currency/reference checks, durable receipt and provider reconciliation; browser return is informational. |
| `/v1/doctors`, `/v1/availability`, `/v1/bookings` | Location/fee/schedule, interval holds, payment/current version and late-event policies; cross-clinic doctor conflict enforced in PostgreSQL. |
| `/v1/staff/*`, `/v1/clinical/*` | Explicit role/clinic/assignment/consent filters, safe pagination, sensitive action audit and transaction-local RLS. |
| `/v1/knowledge`, `/v1/companion` | Draft/approved/withdrawn versions, provenance/language/safety blocks, bounded cited output and authenticated typed tools. |
| Internal events and jobs | Event ID/type/version/aggregate/version/occurred-at, operation/causation references, minimal payload; consumers deduplicate and recheck current state. |

All mutations validate typed input, identity, ownership and current state. Standardize success/error envelopes, correlation IDs, conflict/retry semantics and safe HTTP responses. Require idempotency for business operations with duplicate-effect risk. Never put credentials, full patient messages, private bearer URLs or stack traces into client errors/analytics. Exact request/response schemas and provider-specific method details are reviewed in the shared contract package during P1-E1-001/P1-E2-001.

### 6.3 Data and state rules to implement now

Create core/clinical/engagement schemas with foreign keys, unique business/provider references, quantities/currency/version checks and explicit status transitions. Use integer paise, UTC plus explicit clinic timezone and immutable financial events. Opening imports validate catalogue/batch/doctor relationships and produce errors/control totals; historical patient/order migration is excluded.

Orders and bookings have separate state machines from payments. Reservation expiry never erases a real payment; late payment follows reallocation/rebook-or-refund. One short database transaction creates domain changes and outbox; a provider/network call occurs after commit. A zero-row guarded UPDATE rolls back the dependent operation rather than allowing an unconditional invoice/outbox insert. Doctor occupancy uses the full buffered interval and explicit expired hold states; a moving current-time predicate is not the conflict constraint.

Make the initial KB/retrieval path safe before more channels use it: current approved public versions only, mandatory safety blocks separately loaded, no generated dosage, strict typed/authorized tool proposals, explicit confirmation and urgent/human fallback. Record physician/prompt/model/KB versions and minimum necessary investigation metadata.


## 7. Retained technical specifications — unbudgeted source references

The six labels E1–E6 below identify source technical domains only. Every old package has **zero separate current allocation**; its work is split by the named section 4 register/member boundaries. They are not six extra people. Review/implementation instructions here must be read with the named contract and role restrictions.

### E1 — Technical lead / clinical backend

#### P1-E1-001 — Freeze domain contracts, clinical schema and access model

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O02, P1-O03. **Requirements:** R11, R12, R14, R15, R36.

**Inputs/dependencies:** Day 1 company/reuse readiness; coordinate P1-E2-001 and P1-E6-001.

**Implementation / execution:** Publish the actor/clinic/patient role matrix and ownership rules for customer, physician, front desk, warehouse, finance, content editor/approver and administrator. Define directory, availability, booking/hold, consent, clinical note and signed recommendation schemas; include UTC timestamps, explicit clinic timezone, money in paise, version fields and immutable audit references. Agree the shared API/error/event/idempotency contracts with E2/E3/E4/E5 before dependent screens diverge. Classify private fields and record opening-data validation rules.

**Done when:** Reviewed contracts and migrations support two clinics and a doctor working across locations; all consumers use the same identifiers/state names. No patient history is migrated beyond the approved opening data.

**Tests/evidence:** Contract/schema review, field-classification map, seed validation and role-permission fixtures.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E1-002 — Implement verified identity and scoped authorization

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O02. **Requirements:** R03, R14, R18, R19, R36.

**Inputs/dependencies:** P1-E1-001; P1-E6-001; actual WorkOS test configuration.

**Implementation / execution:** Implement verified customer and organization-scoped staff session middleware; validate issuer/audience/expiry/session and required staff organization/MFA policy. Add cookie/CSRF rules for web and shared native session contracts. Apply role/clinic/patient filters and transaction-local RLS context using non-owner runtime roles. Build deny-by-default helpers for assistant tools and privileged routes; record safe 401/403/not-found responses and revocation behavior. Never accept a client-supplied actor or clinic as authorization. Review clarification C03: Capture versioned required sign-up/privacy consent without bundling marketing opt-in; record and enforce required consultation identity/consent before private video/clinical access. Before personalized medical recommendation, follow physician-approved minimal intake including age/current medication and pregnancy/child/red-flag routing; unknown or declined required information uses approved clarification/handoff. Do not impose clinical intake on ordinary public catalogue browsing or infer a diagnosis. Verify configured transport and at-rest protection for clinical database/private objects/backups and approved processor flows using actual configuration/provider evidence; no plaintext secret/health-content evidence dump.

**Done when:** Customer login cannot enter staff routes; patient/clinic crossover and pooled connection reuse fail closed. Secrets and owner credentials are absent from client bundles.

**Tests/evidence:** Positive/negative role tests, expired/revoked session cases, cross-patient/clinic and reused pooled-client results.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E1-003 — Implement directory, availability and paid booking invariants

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O03, P1-O05. **Requirements:** R11, R12, R32.

**Inputs/dependencies:** P1-E1-001 P1-E1-002; payment adapter contract from P1-E2-003.

**Implementation / execution:** Implement clinic/department/doctor records, per-location hours/languages/fees, leave and online/in-clinic availability. Add btree_gist/GiST doctor-interval exclusion including buffers and half-open boundaries across clinics. Implement held/confirmed/expired/cancelled states, hold ownership/version, explicit expiry and fee snapshot. Connect payment confirmation and late-payment rebook-or-refund obligations without network calls inside transactions.

**Done when:** One booked doctor cannot overlap across clinics; adjacent valid slots work; held/late/duplicate payments cannot create duplicate confirmations.

**Tests/evidence:** Concurrent-slot, buffer, leave, expired-hold and late-webhook integration tests; booking/payment/outbox control totals.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E1-004 — Expose clinical/admin foundations and review core transactions

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O02, P1-O05, P1-O06. **Requirements:** R10, R14, R15, R36.

**Inputs/dependencies:** P1-E1-002 P1-E1-003; P1-E2-002 P1-E2-003.

**Implementation / execution:** Expose assigned-consultation/consent and clinical-record API foundations required by staff/doctor screens. Define physician-authored schedule and signed consult-to-cart contracts for Phase 2, with immutable versions and actor audit. Review E2 reservation/payment state transitions and rollback guards; pair on pool/RLS cleanup. Provide the shared authorization adapter for E5 internal tools and E4 video membership checks.

**Done when:** Available clinical/admin routes enforce the role matrix; Phase 2 schedule/recommendation contracts are frozen and critical transaction review findings are closed.

**Tests/evidence:** API contract examples, assignment/consent negative tests and reviewed transaction PRs.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E1-080 — Record readiness/contract decisions and the initial forecast

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O03, P1-O09. **Requirements:** R36, R38.

**Inputs/dependencies:** Phase prerequisites and applicable company owners; tested candidate before public release.

**Implementation / execution:** Record named company reviewers, approved scope/contracts/data classification, reuse proof and remaining-effort review. Publish decisions/risks/dependencies with owners and required-by times; preserve all 38 requirements and the protected testing allocation.

**Done when:** Required environment/release/handover records are complete for the due milestone; external approvals remain explicit and public release depends on G3.

**Tests/evidence:** Configuration/approval/training/release register with ownership, timestamps, build IDs and safe verification results.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E1-090 — Clinical/access/booking cumulative verification

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O09. **Requirements:** R11, R12, R14, R15, R18, R36.

**Inputs/dependencies:** All currently due phase deliverables; frozen candidate and common test fixtures.

**Implementation / execution:** Execute current role/clinic/patient and pooled-RLS negatives, doctor overlap/buffer/expiry/payment tests, consent and private-record checks. Review commerce transaction guards and initial assistant authorization/safety. Reproduce failures and sign clinical/access evidence with the physician reviewer.

**Done when:** Mandatory owned tests and shared critical regression are executed; failures have reproducible defects and fix/retest evidence. No phase is declared bug-free or accepted with unresolved blockers.

**Tests/evidence:** G1 test report, exact candidate metadata, defects/retests and company review evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E1-099 — Protected defect/retest contingency

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O09. **Requirements:** R36, R38.

**Inputs/dependencies:** Actual findings from continuous tests or the phase campaign.

**Implementation / execution:** Reserve this time for reproducing, containing, fixing and independently retesting phase defects. Link every use to the affected R IDs and source work package. Apply root-cause review and risk-based cumulative regression. If no defects consume it, use it for broader verification/handover; do not add new scope. If blockers exceed the reserve, record Rework/No-go and revise the forecast without weakening the gate.

**Done when:** All blocker fixes have evidence; unused time is recorded transparently. The reserve is not an estimate that every possible bug can be repaired within it.

**Tests/evidence:** Defect time/retest log, changed-candidate evidence map and updated remaining-effort forecast.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

### E2 — Commerce backend

#### P1-E2-001 — Establish commerce schema, opening imports and ledger contracts

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O03. **Requirements:** R01, R02, R05, R07, R09, R26, R31, R33.

**Inputs/dependencies:** Shared contract review with P1-E1-001; P1-E6-001.

**Implementation / execution:** Define SKU/variant/concern, prices/tax basis, stock locations/batches, cart, order, reservation, payment/refund ledger and invoice-series foundations. Include quantity/version checks, currency, provider/business references and unique idempotency keys. Prepare schema contracts for subscriptions, bundles, distributor pricing and loyalty/referral reversals so Phase 2 does not replace core IDs. Import/validate opening catalogue and batch balances with row-level error reports; reject invalid expiry, price, duplicate SKU and location references.

**Done when:** Validated seed/import artifacts reconcile to company opening totals; unsafe data is reported rather than silently corrected.

**Tests/evidence:** Schema/migration review, invalid import fixtures, balance reconciliation and foreign-key/unique/check-constraint tests.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E2-002 — Implement authoritative cart pricing and atomic FEFO reservations

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O04. **Requirements:** R01, R02, R05, R26.

**Inputs/dependencies:** P1-E2-001; P1-E1-002; queue/outbox schema contract.

**Implementation / execution:** Build cart/pricing APIs that recompute current prices, quantities, taxes and consult-only eligibility from authoritative state. Lock relevant availability/batch rows in deterministic order and reserve eligible FEFO stock with order/hold/outbox atomically. Enforce nonnegative available balance, expiry/shelf-life/recall exclusion and all-or-nothing multi-item reservation. Use guarded updates with checked row counts, bounded conflict retries and current-version confirmation. Public cached stock never authorizes a purchase.

**Done when:** Last-unit and stale-cart races preserve stock; shortage rolls back the whole order/reservation/outbox; client totals are ignored.

**Tests/evidence:** Race/property fixtures, rollback after a failed guard, expired/recalled batch cases and persisted control totals.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E2-003 — Integrate payment creation, signed webhooks and idempotent state transitions

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O04, P1-O05. **Requirements:** R02, R07, R09, R12.

**Inputs/dependencies:** P1-E2-002; provider sandbox readiness; durable outbox schema from P1-E6-001 (queue execution integrates on Day 3).

**Implementation / execution:** Create provider checkout outside the reservation transaction using stable business references. Verify webhook signatures against raw payload, provider account, amount/currency and expected reference; durably record receipt before acknowledgement. Deduplicate events and handle out-of-order/ambiguous outcomes. Confirm paid order or booking with ledgers/outbox in a short transaction. Build cancellation/refund state-machine foundations and provider reconciliation interfaces; define recurring mandate hooks needed in Phase 2. COD uses a separate policy/state path.

**Done when:** Real sandbox success/failure/cancel and duplicate events produce one authorized financial effect; browser callbacks cannot mark paid; lost provider responses enter reconciliation.

**Tests/evidence:** Signed/invalid/replayed/mismatched webhook tests, uncertain-result simulation, booking link and ledger/outbox records.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E2-004 — Deliver authorized order visibility, operations APIs and core integration

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O04, P1-O06. **Requirements:** R03, R04, R05, R06, R07.

**Inputs/dependencies:** P1-E2-001 P1-E2-003; web/native consumers.

**Implementation / execution:** Expose owner-scoped order summary/detail and minimal staff order/stock views with safe pagination and source fields. Define shipping/tracking/invoice/export/return contracts and staff order-source audit required by Phase 2. Integrate web/native checkout and order/booking confirmation against shared fixtures. Add traceable state errors and safe restart/reconciliation behavior. Review availability/booking coupling with E1 and publish event schemas for E5 messages.

**Done when:** The purchase slice is usable from real clients and persisted state matches visible order/payment status; missing ownership or stale state is rejected.

**Tests/evidence:** Web/native contract results, order-ID access negatives, persisted order/stock/ledger reconciliation and event samples.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E2-090 — Commerce/financial cumulative verification

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O09. **Requirements:** R01, R02, R03, R04, R05, R07, R09, R12.

**Inputs/dependencies:** All currently due phase deliverables; frozen candidate and common test fixtures.

**Implementation / execution:** Run core purchase/COD/payment/refund-foundation and booking-payment cases; race the last unit, fail one item in a multibatch reservation, replay/alter webhook amounts and inspect order/ledger/outbox balances. Validate invalid imports and client tampering; independently review E1 booking transactions.

**Done when:** Mandatory owned tests and shared critical regression are executed; failures have reproducible defects and fix/retest evidence. No phase is declared bug-free or accepted with unresolved blockers.

**Tests/evidence:** G1 test report, exact candidate metadata, defects/retests and company review evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E2-099 — Protected defect/retest contingency

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O09. **Requirements:** R36, R38.

**Inputs/dependencies:** Actual findings from continuous tests or the phase campaign.

**Implementation / execution:** Reserve this time for reproducing, containing, fixing and independently retesting phase defects. Link every use to the affected R IDs and source work package. Apply root-cause review and risk-based cumulative regression. If no defects consume it, use it for broader verification/handover; do not add new scope. If blockers exceed the reserve, record Rework/No-go and revise the forecast without weakening the gate.

**Done when:** All blocker fixes have evidence; unused time is recorded transparently. The reserve is not an estimate that every possible bug can be repaired within it.

**Tests/evidence:** Defect time/retest log, changed-candidate evidence map and updated remaining-effort forecast.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

### E3 — Web / staff / content

#### P1-E3-001 — Build reusable web/workspace foundation and language system

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O01, P1-O06. **Requirements:** R01, R03, R14, R22, R36.

**Inputs/dependencies:** P1-E1-001 identity/contracts; P1-E6-001.

**Implementation / execution:** Wire Astro public pages and React workspaces with shared components, routing, query/error handling and session boundaries. Define customer/staff/doctor navigation from the role matrix; UI hiding never substitutes for API checks. Set up EN/ML/TA resources, fonts, formatters, accessible labels and keyboard/focus behavior. Define public/private cache boundaries and versioned publication hooks. Reuse approved design assets and avoid hard-coded clinical wording.

**Done when:** Builds/rendering and private-route session behavior work; all core strings use resources; no sensitive query is shared through public caching.

**Tests/evidence:** Build/type results, route/session tests, keyboard/font screenshots and cache-header checks.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E3-002 — Implement catalogue, cart, checkout and account/order slice

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O04, P1-O06. **Requirements:** R01, R02, R03.

**Inputs/dependencies:** P1-E3-001; P1-E2-001 through P1-E2-004.

**Implementation / execution:** Connect catalogue/concern/product/variant views to current APIs, optimize R2 images, and handle stock/consult-only labels using approved content. Implement cart, address collection, authoritative totals, enabled payment/COD controls, confirmation and order detail. Show price/stock changes and pending/failed payment states clearly; prevent double submission without treating UI controls as idempotency. Add login/return navigation and owner-only order views.

**Done when:** An authenticated customer completes sandbox purchase and sees the correct persisted order; tampered/stale checkout shows a safe actionable response.

**Tests/evidence:** Browser journeys covering success/cancel/failure/stale stock, session return and another-user order access.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E3-003 — Implement directory, booking and staff/physician skeleton screens

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O05, P1-O06. **Requirements:** R04, R05, R11, R12, R14, R32.

**Inputs/dependencies:** P1-E3-001; P1-E1-003 P1-E1-004; staff APIs.

**Implementation / execution:** Build doctor/location/service/fee/slot selection, hold expiry, paid booking confirmation and accessible error/pending states. Provide staff catalogue/order/batch and doctor schedule/assigned-consultation screens for the Phase 1 slice. Display consent/assignment boundaries and restrict actions through the same contracts. Include empty, loading, forbidden, conflict and retry states; keep minimum necessary patient information visible for each role.

**Done when:** Staff and customer flows reflect live API state; a slot conflict or revoked assignment cannot remain falsely confirmed in the UI.

**Tests/evidence:** Customer/staff/doctor browser fixtures, slot-race UI outcome, consent/forbidden tests and three-language layout smoke.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E3-004 — Build approved-content editor foundation and integrate channel shells

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O06, P1-O07. **Requirements:** R16, R17, R20, R22, R30.

**Inputs/dependencies:** P1-E3-001; P1-E5-001 P1-E5-002.

**Implementation / execution:** Create structured KB draft, source/provenance, product/concern scope, required safety blocks, approval/version and withdrawal UI foundation. Separate editor and physician approval actions. Integrate a cited chat/human-fallback shell, safe session handling and approved response rendering; prepare review/handoff layout contracts. Define review moderation and seasonal/content publication hooks for Phase 2. Keep medical blocks distinct from model-generated nonclinical text.

**Done when:** Drafts cannot self-publish or appear in approved retrieval; the core chat/editor path is testable and Phase 2 publication/handoff contracts are agreed.

**Tests/evidence:** Editor/approver negatives, draft/stale retrieval tests, citation rendering and safe fallback browser evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E3-090 — Web/workspace cumulative verification

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O09. **Requirements:** R01, R02, R03, R11, R12, R14, R16, R22, R36.

**Inputs/dependencies:** All currently due phase deliverables; frozen candidate and common test fixtures.

**Implementation / execution:** Run browser customer/staff/doctor journeys and negative ownership/role paths, session expiry, stale totals/slot conflicts, private cache and safe errors. Check keyboard/fonts/EN-ML-TA layouts, editor versus approver and cited/fallback chat rendering; independently retest API fixes through the UI.

**Done when:** Mandatory owned tests and shared critical regression are executed; failures have reproducible defects and fix/retest evidence. No phase is declared bug-free or accepted with unresolved blockers.

**Tests/evidence:** G1 test report, exact candidate metadata, defects/retests and company review evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E3-099 — Protected defect/retest contingency

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O09. **Requirements:** R36, R38.

**Inputs/dependencies:** Actual findings from continuous tests or the phase campaign.

**Implementation / execution:** Reserve this time for reproducing, containing, fixing and independently retesting phase defects. Link every use to the affected R IDs and source work package. Apply root-cause review and risk-based cumulative regression. If no defects consume it, use it for broader verification/handover; do not add new scope. If blockers exceed the reserve, record Rework/No-go and revise the forecast without weakening the gate.

**Done when:** All blocker fixes have evidence; unused time is recorded transparently. The reserve is not an estimate that every possible bug can be repaired within it.

**Tests/evidence:** Defect time/retest log, changed-candidate evidence map and updated remaining-effort forecast.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

### E4 — Android / iOS

#### P1-E4-001 — Prove native build, identity, payment and video compatibility

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O01, P1-O06. **Requirements:** R02, R13, R24, R25, R36.

**Inputs/dependencies:** Day 1 signing/device/accounts readiness; P1-E1-002; provider sandbox.

**Implementation / execution:** Create reproducible Android/iOS development builds with required native modules, environment separation and secure credential storage. Prove system-browser sign-in/return, provider checkout/return and a private web/native WebRTC call on real devices. Verify camera/microphone permission denial, app background/resume and callback links. Record supported SDK/OS/build versions and account production eligibility; a simulator-only or Expo Go demonstration is insufficient.

**Done when:** Both native builds run on real devices and the risky adapters work; unsupported components trigger an immediate effort/architecture forecast, not a hidden later task.

**Tests/evidence:** Signed build identifiers, device/OS matrix, auth/payment-return logs without secrets and web/native video proof.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E4-002 — Implement shared native shopping/account/checkout slice

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O04, P1-O06. **Requirements:** R01, R02, R03, R22, R25.

**Inputs/dependencies:** P1-E4-001; commerce API; E3 shared contracts/locales.

**Implementation / execution:** Connect catalogue/product/concern, cart, addresses, current totals, payment/COD and order confirmation/history detail to shared APIs. Handle reconnect, cancel, app resume, repeated taps and pending payment reconciliation without false success. Use locale resources, accessible touch targets/fonts and secure sessions. No database or provider secret is bundled in the app; local caches contain only permitted data and clear on logout where required.

**Done when:** The same sandbox purchase produces matching native/web/API state on Android and iOS, including safe failure/pending outcomes.

**Tests/evidence:** Real-device purchase/account journeys, duplicate-tap/provider-return tests, private-cache/logout inspection and language smoke.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E4-003 — Implement native directory/booking and consultation shell

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O05, P1-O06. **Requirements:** R11, R12, R13, R14, R25.

**Inputs/dependencies:** P1-E4-001; P1-E1-003 P1-E1-004.

**Implementation / execution:** Build doctor/location/fee/slot UI, booking holds/payment/confirmation and appointment history. Integrate the proven consultation component with backend-issued membership credentials; define join-window and revocation behavior for Phase 2 completion. Exercise cross-clinic conflict responses, expired holds, back navigation and app resume. Prepare native notes/recommendation visibility contracts limited to the customer scope.

**Done when:** Native booking uses the authoritative reservation path; private call access proof is bound to the booked patient and assigned doctor.

**Tests/evidence:** Device booking/race/expiry results and unauthorized/expired-room credential tests.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E4-004 — Prepare chat/voice/push contracts and store-release inputs

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O06, P1-O07. **Requirements:** R17, R21, R22, R24, R25.

**Inputs/dependencies:** P1-E4-001; E5 channel contracts; company Apple/Google owners.

**Implementation / execution:** Integrate a safe cited-chat shell and editable voice-input UI contract; prove microphone capture/upload boundaries without unchecked actions. Register push/deep-link routing contracts and define authenticated link behavior. Prepare company app identifiers, listing text/screenshots plan, privacy/permission disclosures, review accounts and signing/recovery records. Track external production eligibility from Day 1; no claim of store approval is made.

**Done when:** Phase 2 channels have working native interfaces/contracts and store prerequisites are exposed with named owners and deadlines.

**Tests/evidence:** Voice permission/UI proof, push/deep-link samples, store-readiness register and secret-free release configuration.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E4-090 — Real-device cumulative verification

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O09. **Requirements:** R02, R11, R12, R13, R22, R24, R25, R36.

**Inputs/dependencies:** All currently due phase deliverables; frozen candidate and common test fixtures.

**Implementation / execution:** Run Android/iOS auth/checkout/return/order/booking and adapter smoke on actual devices, including denial/resume/poor network/deep links. Inspect private cache/logout and bundled credentials; record the exact binary/OS/device. Recheck any core/native integration fixes.

**Done when:** Mandatory owned tests and shared critical regression are executed; failures have reproducible defects and fix/retest evidence. No phase is declared bug-free or accepted with unresolved blockers.

**Tests/evidence:** G1 test report, exact candidate metadata, defects/retests and company review evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E4-099 — Protected defect/retest contingency

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O09. **Requirements:** R36, R38.

**Inputs/dependencies:** Actual findings from continuous tests or the phase campaign.

**Implementation / execution:** Reserve this time for reproducing, containing, fixing and independently retesting phase defects. Link every use to the affected R IDs and source work package. Apply root-cause review and risk-based cumulative regression. If no defects consume it, use it for broader verification/handover; do not add new scope. If blockers exceed the reserve, record Rework/No-go and revise the forecast without weakening the gate.

**Done when:** All blocker fixes have evidence; unused time is recorded transparently. The reserve is not an estimate that every possible bug can be repaired within it.

**Tests/evidence:** Defect time/retest log, changed-candidate evidence map and updated remaining-effort forecast.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

### E5 — AI / messaging / integrations

#### P1-E5-001 — Implement approved knowledge model and bounded ingestion

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O03, P1-O07. **Requirements:** R01, R16, R17, R19, R22, R23.

**Inputs/dependencies:** P1-E1-001; P1-E3-004; physician-reviewed seed content.

**Implementation / execution:** Implement KB provenance, language, scope, draft/approved/withdrawn versions, physician approval and mandatory safety-block records. Import reviewed text into a structured editor pipeline, hash/version sources and index only approved public chunks in Vectorize. Define exact SKU/alias/keyword resolution, translation availability and withdrawal events. Keep patient notes/conversations outside the public corpus; do not assume arbitrary PDF OCR/scanning inside a normal Worker. Review clarification C01: Reconcile every published catalogue product to its physician-approved monograph/dosage/contraindication and required EN/ML/TA safety translations. No published product is an unexplained coverage gap. G1 records the complete inventory/gap register and an approved sample; G2 closes required product coverage and demonstrates approved edit/withdrawal propagation within a company-agreed measured freshness deadline. The illustrative morning-to-afternoon statement is not an invented numeric provider SLA. Include approved public physician profiles and the required knowledge types; approval is not satisfied by catalogue text alone.

**Done when:** Approved seed data is traceable to physician/version; draft, private or withdrawn content never authorizes an answer.

**Tests/evidence:** Approval/import/withdrawal fixtures, public/private separation and indexed-versus-primary version checks.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E5-002 — Implement controlled retrieval, responses and tool boundaries

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O07. **Requirements:** R14, R17, R18, R19, R20, R36.

**Inputs/dependencies:** P1-E5-001; E1 authorization adapter; Companion Worker binding.

**Implementation / execution:** Build exact/keyword/vector retrieval with primary approval/version filtering and independent loading of mandatory safety/dosage/contraindication blocks. Render approved medical text separately from bounded model-generated nonclinical wording. Implement typed tool proposals with identity/ownership/current-state checks, explicit confirmation and safe human fallback. Add red-flag/consult-only routing, per-account limits, expiring model-concurrency leases, timeouts and prompt-injection defenses. Log versioned decisions with minimum health content. Review clarification C03: Capture versioned required sign-up/privacy consent without bundling marketing opt-in; record and enforce required consultation identity/consent before private video/clinical access. Before personalized medical recommendation, follow physician-approved minimal intake including age/current medication and pregnancy/child/red-flag routing; unknown or declined required information uses approved clarification/handoff. Do not impose clinical intake on ordinary public catalogue browsing or infer a diagnosis. Verify configured transport and at-rest protection for clinical database/private objects/backups and approved processor flows using actual configuration/provider evidence; no plaintext secret/health-content evidence dump.

**Done when:** The initial assistant answers only within approved scope; untrusted text cannot grant tools or alter dosage; urgent test input does not start a sale.

**Tests/evidence:** Cited-answer, missing-safety, injection, unauthorized-tool, stale-index and red-flag seed tests.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E5-003 — Prove messaging/voice providers and event-consumer contracts

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O06, P1-O08. **Requirements:** R08, R10, R20, R21, R24, R27, R29.

**Inputs/dependencies:** Provider test accounts; P1-E2-003 event schema; P1-E6-003 interface agreed on Day 1 and real queue integration on Day 3.

**Implementation / execution:** Prove WhatsApp inbound verification/signature handling, durable event receipt and deduplication using actual company/provider test access. Define account-linking, secure checkout links, delivery callbacks and staff-reply contracts; phone-number matching alone is not identity. Exercise bounded voice transcription into reviewable text and expose ambiguity/permission handling. Implement an initial order-event notification consumer and consent/template routing contracts for Phase 2; redact private payloads from queues/logs.

**Done when:** At least one real provider test interaction and one durable event-driven notice are demonstrated; channel approvals/quotas are tracked separately from code.

**Tests/evidence:** Webhook/provider contract results, voice transcript confirmation flow, event deduplication and account-link misuse tests.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E5-004 — Prepare evaluation pack, human-routing state and integration evidence

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O07, P1-O09. **Requirements:** R17, R19, R20, R22, R23, R35.

**Inputs/dependencies:** P1-E5-002 P1-E5-003; named physician/language reviewers.

**Implementation / execution:** Create the versioned evaluation set structure: at least 120 launch-language and 40 additional-language/Romanized scenarios by G2, with physician-approved expected outcomes and critical-case labels. Implement handoff/callback state foundations so the bot can pause, record agent ownership and avoid double replies. Define conversation-to-cart/order/booking/handoff event contracts without health analytics leakage. Run initial critical cases and prepare reproducible G1 evidence.

**Done when:** Initial critical cases pass and remaining G2 case approvals have owners/deadlines; handoff state and metric contracts are integrated, not just diagrams.

**Tests/evidence:** Evaluation manifest, initial results, human-takeover race proof and privacy-reviewed event schema.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E5-090 — Companion/channel cumulative verification

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O09. **Requirements:** R08, R16, R17, R18, R19, R20, R21, R24, R36.

**Inputs/dependencies:** All currently due phase deliverables; frozen candidate and common test fixtures.

**Implementation / execution:** Run initial approved/stale/private retrieval, mandatory safety and unauthorized/injected tool cases. Verify urgency stops sales, transcript review, webhook/account-link duplication, bot pause and current notification idempotency. Record physician expectations and outstanding G2 evaluation approvals.

**Done when:** Mandatory owned tests and shared critical regression are executed; failures have reproducible defects and fix/retest evidence. No phase is declared bug-free or accepted with unresolved blockers.

**Tests/evidence:** G1 test report, exact candidate metadata, defects/retests and company review evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E5-099 — Protected defect/retest contingency

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O09. **Requirements:** R36, R38.

**Inputs/dependencies:** Actual findings from continuous tests or the phase campaign.

**Implementation / execution:** Reserve this time for reproducing, containing, fixing and independently retesting phase defects. Link every use to the affected R IDs and source work package. Apply root-cause review and risk-based cumulative regression. If no defects consume it, use it for broader verification/handover; do not add new scope. If blockers exceed the reserve, record Rework/No-go and revise the forecast without weakening the gate.

**Done when:** All blocker fixes have evidence; unused time is recorded transparently. The reserve is not an estimate that every possible bug can be repaired within it.

**Tests/evidence:** Defect time/retest log, changed-candidate evidence map and updated remaining-effort forecast.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

### E6 — Platform / quality / release

#### P1-E6-001 — Implement reproducible runtime/database/security configuration

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O01, P1-O02, P1-O03. **Requirements:** R36, R38.

**Inputs/dependencies:** Company account access; E1/E2 schema/contracts.

**Implementation / execution:** Provision versioned Worker/service/database bindings and isolated development resources with restricted credentials. Configure Neon pooled runtime and direct administration endpoints, tested PostgreSQL version/extension, non-owner roles and migration execution. Implement CI type/build/critical-test/secret/dependency checks, deployment locking and synthetic seed/reset workflows. Verify no production credentials are used by preview apps and no client bundle contains secrets.

**Done when:** The foundation deploys reproducibly with approved role/binding boundaries and actual Worker-to-Neon transaction tests.

**Tests/evidence:** CI run, environment inventory, migration/rollback smoke, TLS/role tests and artifact hashes.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E6-002 — Build test harness, redacted observability and rollback foundation

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O01, P1-O08, P1-O09. **Requirements:** R10, R36, R38.

**Inputs/dependencies:** P1-E6-001; domain fixtures from E1/E2/E5.

**Implementation / execution:** Wire real PostgreSQL integration fixtures, browser journeys and a real-device evidence template. Add request/event correlation, scrubbed error logs, health checks, basic latency/error/pool metrics and an independent alert test. Configure versioned deploy/rollback and a current-schema compatibility check. Prepare controlled provider adapters and initial k6 workload without sending bulk traffic to live providers. Review clarification C08: Measure healthy-state due-to-claim pickup p95 below two minutes with agreed server timestamps/sample size while preserving current consent/version/deadline suppression. During fault/backlog tests separately measure deadline recovery and alerts. Configure a defined 30-day core-availability SLI/dashboard and 99.9% internal objective, exclusions and owner; ten-day prelaunch tests cannot prove achieved monthly availability and do not imply a paid vendor SLA or 24-hour clinician staffing.

**Done when:** Critical journey and scan reports are generated by CI; alert receipt and prior-version rollback are demonstrated.

**Tests/evidence:** Automated report links, redaction/alert checks, rollback timing and initial load-script manifest.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E6-003 — Implement queue platform and encrypted backup/restore smoke

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O08. **Requirements:** R08, R10, R36, R38.

**Inputs/dependencies:** P1-E6-001; shared outbox/due-job migrations.

**Implementation / execution:** Configure financial/clinical/engagement queue consumers, explicit retry/DLQ settings and one-minute production dispatcher contract. Implement short SKIP LOCKED/lease claim primitives without holding a transaction during publish or provider calls. Trigger duplicate/crash/reclaim/redrive cases and persist idempotent receipt evidence. Export an initial synthetic database using a restricted runner, encrypt independently, restore with roles/extensions and verify R2 manifest linkage.

**Done when:** A claimed job survives a crash and duplicate redelivery without repeating its effect; the initial encrypted backup is recoverable.

**Tests/evidence:** Queue/lease/DLQ traces, exported manifest, decryption/restore logs and control totals.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E6-080 — Provision account/environment/CI and evidence infrastructure

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O01, P1-O09. **Requirements:** R36, R38.

**Inputs/dependencies:** Phase prerequisites and applicable company owners; tested candidate before public release.

**Implementation / execution:** Set up company-owned deployment/billing access and recovery, preview/shared development resources, restricted secret/role inventory, signing/build runner access and evidence storage. Record actual quotas/usage, schedule controlled test windows and separate synthetic/test providers from live production. Coordinate native store eligibility and account dependencies.

**Done when:** Required environment/release/handover records are complete for the due milestone; external approvals remain explicit and public release depends on G3.

**Tests/evidence:** Configuration/approval/training/release register with ownership, timestamps, build IDs and safe verification results.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E6-090 — Platform/security/load/recovery cumulative verification

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O09. **Requirements:** R36, R38.

**Inputs/dependencies:** All currently due phase deliverables; frozen candidate and common test fixtures.

**Implementation / execution:** Run the whole current candidate through build/code/dependency/secret/config checks and authenticated staged review; triage findings with owners. Execute 10 rps for 10 minutes, monitor errors/pools, test lease/DLQ/replay, alert, encrypted restore and rollback. Assemble G1 evidence and residual scope/effort register.

**Done when:** Mandatory owned tests and shared critical regression are executed; failures have reproducible defects and fix/retest evidence. No phase is declared bug-free or accepted with unresolved blockers.

**Tests/evidence:** G1 test report, exact candidate metadata, defects/retests and company review evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P1-E6-099 — Protected defect/retest contingency

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P1-O09. **Requirements:** R36, R38.

**Inputs/dependencies:** Actual findings from continuous tests or the phase campaign.

**Implementation / execution:** Reserve this time for reproducing, containing, fixing and independently retesting phase defects. Link every use to the affected R IDs and source work package. Apply root-cause review and risk-based cumulative regression. If no defects consume it, use it for broader verification/handover; do not add new scope. If blockers exceed the reserve, record Rework/No-go and revise the forecast without weakening the gate.

**Done when:** All blocker fixes have evidence; unused time is recorded transparently. The reserve is not an estimate that every possible bug can be repaired within it.

**Tests/evidence:** Defect time/retest log, changed-candidate evidence map and updated remaining-effort forecast.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

### Integrated review: explicit proposal acceptance details

These details clarify existing R IDs from the company proposals/accepted master; they do not add a later release or another architecture. They must be included in the existing named package estimates. Prove reuse/review capacity on Day 1 and reforecast if the clarified work does not fit; the unchanged 480-hour budget is not new evidence of feasibility.

| Clarification | Source / requirements | Named execution packages | Acceptance and testing |
|---|---|---|---|
| C01 — Complete approved product knowledge and bounded refresh | Companion pp. 4, 8–9: initial approved knowledge covers every website product; updated approved content reaches answers. R01, R16, R17 | P1-MAT-003, P1-DEN-002 | Reconcile every published catalogue product to its physician-approved monograph/dosage/contraindication and required EN/ML/TA safety translations. No published product is an unexplained coverage gap. G1 records the complete inventory/gap register and an approved sample; G2 closes required product coverage and demonstrates approved edit/withdrawal propagation within a company-agreed measured freshness deadline. The illustrative morning-to-afternoon statement is not an invented numeric provider SLA. Include approved public physician profiles and the required knowledge types; approval is not satisfied by catalogue text alone. Evidence: P1-T12, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C02 — Knowledge entry usage analytics | Companion p. 6: staff can see which knowledge entries the assistant uses most. R16, R35 | Inherited acceptance; named domain owner remains accountable | Record privacy-minimized answer-to-approved-entry/version attribution, not raw health prompts in general analytics. Content reviewers can view most-used entry/version counts with date filters and freshness labels. Define whether counts represent used answer entries or retrieval hits; count retries once by stable answer/event identity and reconcile known fixtures. Unauthorized roles cannot access the content report. Evidence: , relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C03 — Explicit intake and consent checkpoints | Companion pp. 5, 7: age/current medication screening, pregnancy/children/red flags; sign-up consent and recorded video consultation identity/consent. R14, R19, R36 | P1-MAT-001, P1-MAT-003, P1-DEV-003 | Capture versioned required sign-up/privacy consent without bundling marketing opt-in; record and enforce required consultation identity/consent before private video/clinical access. Before personalized medical recommendation, follow physician-approved minimal intake including age/current medication and pregnancy/child/red-flag routing; unknown or declined required information uses approved clarification/handoff. Do not impose clinical intake on ordinary public catalogue browsing or infer a diagnosis. Verify configured transport and at-rest protection for clinical database/private objects/backups and approved processor flows using actual configuration/provider evidence; no plaintext secret/health-content evidence dump. Evidence: P1-T02, P1-T13, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C04 — Front-desk outpatient booking and permitted patient order history | Companion pp. 6, 8: staff enter outpatient bookings; assigned doctors see permitted patient past orders. R03, R11, R12, R14 | P1-MAT-002 | Authorized front desk creates an in-clinic outpatient appointment in the same canonical booking lifecycle with source/staff actor and correct clinic fee/payment/refund state; use the same global doctor overlap constraints. It cannot be confused with a walk-in product order. Assigned physicians see policy-permitted past purchases in the linked patient view; unassigned/revoked/cross-patient/clinic access remains denied. Doctor management also includes approved qualifications/photo, slot length and online/in-clinic/both availability settings; front-desk operational readiness is demonstrated before public launch. Evidence: , relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C05 — Automatic invoice delivery, not only PDF generation | Ecommerce pp. 3–4, 6: GST invoice generated and sent with every order. R07, R08 | Inherited acceptance; named domain owner remains accountable | After the finance-approved issuance milestone, create a durable idempotent invoice-ready delivery obligation and send the customer an approved private/scoped invoice link or document through the permitted transactional channel. Generated PDF alone is not delivery evidence. Verify receipt, one effective delivery/reconciliation, retries, expiry/ownership and customer history; no public invoice URL or marketing-consent shortcut. Evidence: , relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C06 — New-product, restock and seasonal past-buyer campaigns | Ecommerce pp. 3, 7: opted-in past buyers segmented by what they bought; new-product, restock and seasonal campaigns. R27, R28 | Inherited acceptance; named domain owner remains accountable | Demonstrate all three approved campaign types: new product, restock and seasonal offer. Build consented prior-purchase segments from authorized commerce facts, with preview/counts, quotas, quiet hours, current opt-out and deduplicated attribution. No raw clinical notes or inferred health-interest audience without explicit business/privacy approval; live sending uses company-controlled approved recipients. Evidence: , relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C07 — Explicit maintenance calendar and ownership | Ecommerce pp. 6, 8; Companion pp. 7–8: security updates/app releases/priority fixes, monthly flagged-conversation review, knowledge-update allowance and quarterly report. R37, R38 | Inherited acceptance; named domain owner remains accountable | Hand over a dated maintenance calendar: daily reconciliation; weekly access/job/backup/capacity/security checks; monthly physician review of flagged conversations and knowledge changes; quarterly operating/performance report. Name primary/backup owners, priority-fix/security/app-release workflow, and the proposal’s up-to-eight-hours-per-month knowledge-maintenance allowance with an agreed overflow/response process. These are support obligations/operating labor, not extra sprint capacity, new subscription pricing, or automatically created reminders. Evidence: , relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C08 — Numeric job pickup and availability measurement | Accepted master §§11–12: healthy-state due-job pickup p95 <2 minutes and 99.9% monthly core availability objective. R10, R38 | P1-DEV-001 | Measure healthy-state due-to-claim pickup p95 below two minutes with agreed server timestamps/sample size while preserving current consent/version/deadline suppression. During fault/backlog tests separately measure deadline recovery and alerts. Configure a defined 30-day core-availability SLI/dashboard and 99.9% internal objective, exclusions and owner; ten-day prelaunch tests cannot prove achieved monthly availability and do not imply a paid vendor SLA or 24-hour clinician staffing. Evidence: P1-T20, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |

## 8. Integrated journeys to demonstrate before G1

| Journey | Concrete sequence | Required persisted outcome |
|---|---|---|
| Core purchase | Catalogue → cart → login/address → current price/eligible batch hold → real sandbox checkout → signed webhook → order detail | One order/payment/reservation set, correct paise/stock and durable outbox; cancelled/failed/ambiguous return is not falsely paid. |
| Core booking | Doctor/location/fee → interval hold → fee payment → confirmation → customer/doctor view | One buffered doctor interval across clinics, correct hold ownership/payment status and no duplicate confirmation. |
| Staff/current clinical scope | Staff-org MFA → scoped order/batch or assigned-consultation/consent view → audited authorized action | Correct role/clinic/patient visibility and no pooled context crossover; forbidden users receive no sensitive object. |
| Approved Companion | Reviewed seed KB → approved public index → cited response or safe fallback → typed authorized read/action proposal | Current source/version evidence, full safety block and no unconfirmed side effect; urgency stops automated selling. |
| Durable event and recovery | Domain commit → outbox/lease → real queue consume → one test notice → crash/duplicate/redrive → encrypted restore | One logical effect, recoverable control totals and safe current-state recheck. |
| Native/provider feasibility | Real Android/iOS sign-in/payment return/booking, web-native private call and editable voice/push-link proof | Supported adapters, safe permissions/session handling and recorded external account/approval readiness. |

## 9. Broad cumulative G1 test campaign

Continuous tests run during Days 1–2; freeze before the protected Day 3 final half-day. Run code/dependency/secret/config checks, automated domain/API/browser tests, manual authenticated misuse and real-device tests against all currently reachable features. Include another engineer's independent review/retest for critical paths. Every case below is mandatory for implemented scope; not-yet-built Phase 2 behavior is explicitly tracked, not counted as passed.

| Test ID | Owner / independent support | Required challenge and pass condition |
|---|---|---|
| P1-T01 | Tinu coordinates; Devadathan operates; Tinu records | Clean build/deploy/seed reproduces the same schema/contracts; wrong environment/secret is blocked and client bundles contain no credentials. |
| P1-T02 | Tinu coordinates; Mathew with Devadathan | Expired/revoked/invalid session and customer-to-staff login fail; staff organization MFA and CSRF/session rules work. |
| P1-T03 | Tinu coordinates; Mathew operates; Tinu observes | Patient A/doctor/clinic boundaries and reused pooled clients never expose Patient B/another clinic; context resets on error/rollback. |
| P1-T04 | Tinu coordinates; Josin operates; Mathew reviews | Client price/quantity/role tampering and stale cart are repriced/rejected; failed multibatch guard leaves no partial order/reservation/outbox. |
| P1-T05 | Tinu coordinates; Josin and Mathew | Concurrent last-unit requests preserve nonnegative available stock; expired/recalled/insufficient-shelf-life batches cannot be reserved. |
| P1-T06 | Tinu coordinates; Josin; Mathew/Devadathan support | Valid/invalid/duplicate/out-of-order/mismatched payment event and lost provider response produce at most one authorized transition and a reconcilable unknown state. |
| P1-T07 | Tinu coordinates; Mathew; Josin for payment state | Two customers, overlapping buffers and doctor in two clinics cannot book conflicting active intervals; valid adjacency succeeds. |
| P1-T08 | Tinu coordinates; Mathew and Josin | Expired hold, delayed payment, leave/current fee and cancellation/refund foundation follow the approved rebook/refund obligation; no false confirmation. |
| P1-T09 | Tinu coordinates; Tinu with Paul/Denzil; Devadathan supports | Web customer/staff/doctor flows, owner-only order lookup, denied IDs, session return and conflicts reflect actual backend state. |
| P1-T10 | Tinu coordinates; Tinu/Paul; Devadathan owns adapters | Real Android/iOS sign-in/payment return, repeat tap, app resume and dropped network do not create duplicate purchases or false paid state. |
| P1-T11 | Tinu coordinates; Devadathan operates; Mathew validates access | Web-native call and denied/expired/wrong participant access, mic/camera denial and resume demonstrate a viable private adapter. |
| P1-T12 | Tinu coordinates; Mathew; physician approves expected wording | Draft/private/withdrawn/stale KB and missing mandatory safety content never generate unchecked medical text; citations identify current approval. |
| P1-T13 | Tinu coordinates; Mathew with physician; Tinu records | Urgent/consult-only/injection/unauthorized-tool/confirmation replay cases produce approved escalation/denial without an automated sale or dosage alteration. |
| P1-T14 | Tinu coordinates; Mathew; Devadathan native support | Actual provider webhook/account-link/voice proof: forged/duplicate identity/events fail; an unchecked/ambiguous transcript cannot trigger an action. |
| P1-T15 | Tinu coordinates; Tinu/Denzil/Paul; Mathew/Devadathan review | Editor cannot self-approve; handoff state pauses the bot; EN/ML/TA core strings/fonts/keyboard states are usable. |
| P1-T16 | Tinu coordinates; Devadathan and Mathew operate; Tinu tracks | Whole current candidate code/dependency/secret/config and authenticated injection/record-ID/cookie/CORS/private-link review has no untriaged or blocking findings. |
| P1-T17 | Tinu coordinates; Devadathan/Mathew; Josin validates financial effect | Crash after claim/publish, duplicate consume, lease expiry and DLQ/redrive do not repeat the business effect or lose the durable obligation. |
| P1-T18 | Tinu coordinates; Devadathan operates; Josin/Mathew validate totals | Encrypted synthetic backup decrypts/restores into isolation with correct role/object references and control totals; previous Worker version runs against schema. |
| P1-T19 | Tinu coordinates; Devadathan operates; Mathew/Josin assess invariants | Ten minutes at 10 dynamic requests/second on the current realistic mix has no invariant/access breach or unexplained resource leak; record p95/errors/CPU/pool/locks, even if tuning remains. |
| P1-T20 | Tinu coordinates; Tinu coordinates; Devadathan and company owners | Alert receipt, redaction, dependency/readiness status, remaining work and R/output evidence are complete; blockers cannot be hidden as passed tests. |

The smoke load is a foundation benchmark, not final certification for 1,000+ users. Real provider contract cases run at controlled volume; high-volume adapters are explicit. Synthetic fixtures include two clinics, shared doctors, several batch states, consult-only items, failed payments and permitted/forbidden roles.

## 10. Environment, tooling and quality execution

Keep preview/shared development independent of production; use PostgreSQL and the actual Worker driver for integration, not SQLite as a substitute. Run the real dispatcher during controlled tests and keep it idle otherwise to preserve development quotas. CI runs typed builds, reviewed PostgreSQL migration/domain tests, browser journeys and code/dependency/secret checks. Record native binaries/devices and authenticated manual security evidence; use staged load adapters and redacted logs.

Publish code/schema/API/event/fixture versions and minimally scoped test credentials before G1. A reviewer can reset synthetic data and reproduce every financial/booking test without real charges. The encryption/backup runner operates outside the API Worker; protect keys and restore only into an isolated target. No broad scanner or load generator targets provider infrastructure or real patient data.

## 11. Gate G1 exit and Phase 2 handoff

Pass only when P1-O01–P1-O09 and all current-scope mandatory cases have evidence, no blocker/untriaged finding remains, core clients use actual integrated services, and native/provider feasibility is proven. Required Phase 2 features remain explicitly incomplete rather than falsely accepted. Missing tested reuse, unsafe access/transactions, unsupported adapters or failed restore requires Rework and a revised forecast.

Handover includes frozen contracts/schema/roles/state machines; opening-data validation; running endpoints and web/native core builds; provider adapter/event/outbox/queue interfaces; approved KB/evaluation seeds; environment/secret/account inventory; test fixture/reset and CI reports; initial backup/rollback proof; company decisions and approval/dependency register. All 120+40 G2 evaluation expectations and remaining language/content approvals have accountable company reviewers and due dates.


## 12. Evidence, defect handling and Gate G1 decision

Every task includes reviewed changes/configuration, schema compatibility, positive and negative cases, integrated UI/provider behavior, redacted telemetry and evidence against its R/output IDs. Source packages use the agreed modular repository; no extra independently operated backend is introduced. Suggested evidence organization is `artifacts/P1/<candidate>/`, with restricted access and no unnecessary patient/secrets content. These are proposed repository artifact paths, not files already generated by this planning exercise.

The gate report records commit/web/API/native builds, schema/config, model/prompt/KB versions, database compute/pool, dataset/devices/networks/provider modes, planned/executed/passed/failed/blocked tests, scans/manual findings, control totals, resource/recovery results, defects/fixes/retests, company reviews and external approvals. Initial state is Pending. Preserve failed runs and append retest results rather than rewriting history.

P0/Critical and P1/High issues stop acceptance. P2/Medium blocks if it violates a requirement, safety/privacy/money/access invariant or a due performance/recovery gate; other limited-impact issues require documented company acceptance, owner and fix date. P3/Low may remain only if genuinely nonblocking. All scan alerts are triaged; a false positive needs evidence. No confirmed critical/high vulnerability is waived to meet the calendar.

A fix creates a new candidate: reproduce the defect, independently review, run the reproducing/affected tests and cumulative critical suite, then rerun load/recovery/native/clinical tests where the change invalidates them. Do not blindly repeat unrelated long tests after a cosmetic edit, and do not reuse invalid evidence after a transaction/security/config change. No untested patch reaches public users.

Tinu assembles evidence, domain owners validate their work, and Mathew/Devadathan record the technical recommendation and company reviewers accept their domains. The decision is Pass or Rework; final public-release Go/No-go and safe postdeployment closure belong to G3. If blockers/approvals/effort prevent the gate, keep the full company scope and publish the revised forecast. No additional engineers, weekend construction or hidden overtime are assumed.

## 13. Company requirement coverage and acceptance trace

The final company acceptance below is retained for traceability, not declared complete in G1. Phase 1 tests only implemented foundations; full functional/company/public milestones remain due in P2/P3. Named package links replace obsolete per-E-role assignments.

| Requirement / company source | Final acceptance evidence | Named accountable owner | Master readiness milestone | Named Phase 1 packages | G1 scope status |
|---|---|---|---|---|---|
| R01 — Catalogue and shop by health concern; E4-5, C4 | All current-site products imported with variants, approved descriptions, images, prices, concern filters and stock visibility. Brand/certification claims approved by the clinic. | Josin | P2 functional; P3 company acceptance | P1-MAT-003, P1-MAT-005, P1-JOS-001, P1-JOS-002, P1-JOS-090, P1-DEV-002, P1-DEV-003, P1-DEV-090, P1-PAU-001, P1-PAU-002, P1-PAU-090, P1-DEN-001, P1-DEN-002, P1-DEN-090, P1-TIN-002, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R02 — Cart and Indian checkout; E3-4, C4 | Web and native purchase through enabled UPI/card/net-banking/eligible EMI methods; COD rules enforced server-side; totals cannot be altered by clients. | Josin | P2 functional; P3 company acceptance | P1-MAT-005, P1-JOS-001, P1-JOS-002, P1-JOS-003, P1-JOS-090, P1-DEV-002, P1-DEV-003, P1-DEV-090, P1-PAU-001, P1-PAU-002, P1-PAU-004, P1-PAU-090, P1-DEN-001, P1-DEN-090, P1-TIN-002, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R03 — Accounts, addresses, history, reorder, tracking; E3, C4 | Verified user sees only their orders/invoices; repeat order uses current price, eligibility and available stock; tracking updates visible. | Mathew + Josin | P2 functional; P3 company acceptance | P1-MAT-001, P1-MAT-002, P1-JOS-004, P1-JOS-090, P1-DEV-002, P1-DEV-003, P1-DEV-090, P1-PAU-001, P1-PAU-002, P1-PAU-090, P1-DEN-002, P1-DEN-090, P1-TIN-002, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R04 — Unified order desk including phone/walk-in/WhatsApp; E6, C6 | Staff create and fulfill an order with a recorded source; WhatsApp checkout produces the same order record; packing lists and cancellation/return/refund states are usable. | Josin | P2 functional; P3 company acceptance | P1-JOS-004, P1-JOS-090, P1-DEV-003, P1-PAU-003, P1-DEN-003, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R05 — Batch/expiry, low stock and near-expiry operations; E6, C6 | Batch ledger, expiry/shelf-life exclusion, FEFO allocation, low-stock alerts, adjustments and a recall lookup from batch to customers. Concurrent last-unit test passes. | Josin | P2 functional; P3 company acceptance | P1-MAT-005, P1-JOS-001, P1-JOS-002, P1-JOS-004, P1-JOS-090, P1-DEV-003, P1-PAU-003, P1-DEN-001, P1-DEN-003, P1-TIN-002, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R06 — Courier and pan-India fulfillment; E6-7 | Pincode serviceability, rates, courier label, pickup, tracking and COD reconciliation tested with the selected courier. Unserviceable addresses cannot check out. | Josin | P2 functional; P3 company acceptance | P1-JOS-004 | Current delivered subset only; full acceptance Pending P2/P3. |
| R07 — GST invoices, reconciliation and accounts export; E3, E6, C6 | Finance-approved CGST/SGST/IGST cases, numbering, PDF/translated display labels, refund credit-note process and monthly CSV export; a live charge/refund is reconciled. Issued invoices are automatically delivered through an approved private transactional link/document and delivery is reconciled, not merely generated. | Josin | P2 functional; P3 company acceptance | P1-MAT-005, P1-JOS-001, P1-JOS-003, P1-JOS-004, P1-JOS-090, P1-DEN-001, P1-TIN-002, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R08 — Automated WhatsApp/SMS order updates; E3-4 | Confirmation, dispatch, out-for-delivery and delivery messages use real events/tracking links, approved templates and deduplication. Transactional invoice-ready delivery follows the finance-approved issuance milestone with receipt/retry/ownership evidence. | Mathew | P2 functional; P3 company acceptance | P1-MAT-004, P1-MAT-090, P1-DEV-001, P1-DEN-004, P1-DEN-090, P1-TIN-002, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R09 — Recurring subscriptions; E4, E7, C4 | Authorize a real eligible mandate; cycle billing, exactly one renewal order, payment failure, pause/resume/cancel and stock-shortage handling verified. An accelerated sandbox renewal exercises the full cycle. | Josin | P2 functional; P3 company acceptance | P1-MAT-005, P1-JOS-001, P1-JOS-003, P1-JOS-090, P1-DEN-001, P1-TIN-002, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R10 — Refill and daily medicine schedules; E4, C4 | Physician-authored dose, morning/evening and before/after-food instructions drive timezone-aware reminders; refill quantity/due date uses the approved schedule or confirmed customer interval; edits/cancellation stop stale reminders. | Mathew | P2 functional; P3 company acceptance | P1-MAT-002, P1-MAT-004, P1-MAT-005, P1-DEV-001, P1-DEV-004, P1-DEN-004, P1-TIN-001, P1-TIN-002, P1-TIN-003 | Current delivered subset only; full acceptance Pending P2/P3. |
| R11 — Physician directory, locations, slots, leave and fees; C4, C6 | Staff configure departments, credentials, languages, per-location hours, online/in-clinic slots, leave and default/per-doctor fees. Cross-location double booking is prevented. Authorized front desk can create source/actor-audited in-clinic outpatient bookings through the same doctor-global booking service; doctor qualifications/photo, slot length and online/in-clinic/both settings are included. | Mathew | P2 functional; P3 company acceptance | P1-MAT-001, P1-MAT-002, P1-MAT-090, P1-DEV-003, P1-DEV-090, P1-PAU-003, P1-PAU-090, P1-DEN-003, P1-DEN-090, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R12 — Booking, fee payment, reschedule/cancel/refund; E4, C4 | One slot cannot be sold twice; holds expire; late payment is reconciled; notifications and policy-based refunds work. Staff-created outpatient appointments obey the same interval, fee, hold/payment, cancellation and refund invariants as customer bookings. | Mathew + Josin | P2 functional; P3 company acceptance | P1-MAT-001, P1-MAT-002, P1-MAT-005, P1-MAT-090, P1-JOS-003, P1-JOS-090, P1-DEV-003, P1-DEV-090, P1-PAU-003, P1-PAU-090, P1-DEN-003, P1-DEN-090, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R13 — Embedded video consultations; C4 | Patient and assigned doctor join a private call inside web/native apps; permissions, poor network, reconnect and unauthorized joining are tested. | Devadathan + Mathew | P2 functional; P3 company acceptance | P1-DEV-002, P1-DEV-003, P1-DEV-090, P1-PAU-003, P1-PAU-004, P1-PAU-090, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R14 — Physician panel and linked patient record; E6, E8, C6 | Doctor sees assigned consultations, permitted history and consented chat summary; records identity/consent, notes and recommendations with an audit trail. Assigned physicians see policy-permitted patient past orders; recorded identity/required consultation consent is enforced before private consultation access. | Mathew | P2 functional; P3 company acceptance | P1-MAT-001, P1-MAT-002, P1-MAT-003, P1-MAT-005, P1-MAT-090, P1-DEV-002, P1-DEV-003, P1-DEV-090, P1-PAU-003, P1-PAU-090, P1-DEN-002, P1-DEN-003, P1-DEN-090, P1-TIN-002, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R15 — Consult-to-cart; E4, C3-4 | Signed physician recommendation becomes an editable patient basket; consult-only products require a valid matching recommendation; dosage remains unchanged by the assistant. | Mathew + Josin | P2 functional; P3 company acceptance | P1-MAT-001, P1-MAT-002, P1-MAT-005, P1-MAT-090, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R16 — Approved knowledge-base editor; C4, C6 | Product monographs, departments/treatments, FAQs, policies and selected Ayurveda references support draft, named approval, version history, withdrawal and reviewed dosage/safety translations. All published catalogue products have required approved monographs and launch-language safety blocks by G2, with approved public physician profiles among the knowledge types; content reviewers see reconciled most-used-entry/version analytics and measured edit/withdrawal freshness. | Mathew | P2 functional; P3 company acceptance | P1-MAT-003, P1-MAT-090, P1-DEV-004, P1-DEV-090, P1-PAU-090, P1-DEN-002, P1-DEN-090, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R17 — Grounded, cited Companion; C3-4, C7 | Responses trace to currently approved entries and approving physician; missing/stale/unsupported medical knowledge produces an approved handoff response. | Mathew | P2 functional; P3 company acceptance | P1-MAT-003, P1-MAT-004, P1-MAT-090, P1-DEV-002, P1-DEV-004, P1-PAU-004, P1-DEN-002, P1-DEN-004, P1-DEN-090, P1-TIN-001, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R18 — Conversational product/order/refill/slot actions; C3-4 | Authenticated tools retrieve authorized records; add-to-cart, booking and payment steps require an explicit customer confirmation and display real current state. | Mathew | P2 functional; P3 company acceptance | P1-MAT-001, P1-MAT-003, P1-MAT-090, P1-DEN-090, P1-TIN-002, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R19 — Red flags, consult-only rules and disclaimers; C5, C7 | Physician test pack passes emergency/high-risk escalation; no diagnosis/cure promise; required disclaimer and named approval appear. No automated sale is initiated from a flagged conversation. Physician-approved minimal intake covers age/current medication and pregnancy/child/red-flag routing before personalized medical recommendation; unknown required data is clarified or handed off, never guessed. | Mathew | P2 functional; P3 company acceptance | P1-MAT-001, P1-MAT-003, P1-MAT-004, P1-MAT-090, P1-DEV-003, P1-DEN-002, P1-DEN-004, P1-DEN-090, P1-TIN-001, P1-TIN-002, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R20 — Human handoff, callback and conversation review; C3, C6-7 | Staff take over an active chat with summary; assistant pauses; after-hours callback queues, WhatsApp acknowledgement, unanswered-question queue and resolution reporting work. | Mathew | P2 functional; P3 company acceptance | P1-MAT-003, P1-MAT-004, P1-MAT-090, P1-DEV-004, P1-DEN-002, P1-DEN-004, P1-DEN-090, P1-TIN-001, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R21 — Same assistant on WhatsApp; C3-5, C8 | Real clinic number supports text/voice input, safe product actions, identity-linked order lookup, booking and a secure Razorpay checkout flow from the conversation. Staff can reply through the console. | Mathew | P2 functional; P3 company acceptance | P1-MAT-004, P1-MAT-090, P1-DEV-002, P1-DEV-004, P1-PAU-004, P1-DEN-004, P1-DEN-090, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R22 — English, Malayalam and Tamil application; C4 | Store, native app, menus, checkout, invoice labels and notifications have reviewed translations, usable fonts and no missing keys; medical wording is physician-reviewed. | Devadathan | P2 functional; P3 company acceptance | P1-MAT-003, P1-MAT-004, P1-DEV-002, P1-DEV-003, P1-DEV-004, P1-DEV-090, P1-PAU-001, P1-PAU-002, P1-PAU-004, P1-PAU-090, P1-DEN-002, P1-DEN-004, P1-DEN-090, P1-TIN-001, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R23 — Other Indian-language and Romanized conversations; C4 | Evaluate Hindi/Kannada/Telugu plus launch languages and representative Romanized inputs; preserve approved clinical text and fall back safely when a translation cannot be verified. | Mathew | P2 functional; P3 company acceptance | P1-MAT-003, P1-MAT-004, P1-DEN-002, P1-DEN-004, P1-TIN-001 | Current delivered subset only; full acceptance Pending P2/P3. |
| R24 — Voice input; C4, C8 | Web/mobile microphone and WhatsApp voice messages transcribe into editable/reviewable text; permission denial and ambiguous numbers/units are handled. No action is triggered directly from an unchecked transcript. | Devadathan + Mathew | P2 functional; P3 company acceptance | P1-MAT-004, P1-MAT-090, P1-DEV-002, P1-DEV-004, P1-DEV-090, P1-PAU-004, P1-PAU-090, P1-DEN-004, P1-DEN-090, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R25 — Complete Android and iOS customer apps; E8, C8 | Both production apps include store, checkout, assistant, booking/video, reminders, subscriptions, history, loyalty and referrals; signed, reviewed, publicly obtainable releases. | Devadathan | P2 complete builds; P3 public store releases | P1-DEV-002, P1-DEV-003, P1-DEV-004, P1-DEV-090, P1-PAU-001, P1-PAU-002, P1-PAU-003, P1-PAU-004, P1-PAU-090, P1-DEN-004, P1-TIN-090 | Current delivered subset only; full acceptance Pending P2/P3. |
| R26 — Bundles and discounted courses; E7 | Approved product kits/course prices calculate consistently across channels and cannot bypass consult-only or stock restrictions. | Josin | P2 functional; P3 company acceptance | P1-MAT-005, P1-JOS-001, P1-JOS-002, P1-DEN-001, P1-TIN-002 | Current delivered subset only; full acceptance Pending P2/P3. |
| R27 — Opt-in WhatsApp campaigns and segments; E3, E7 | Staff send/schedule an approved template to a consented segment; opt-outs, quotas, delivery results and purchase attribution are visible. Health-interest segmentation requires explicit business/privacy approval. New-product, restock and seasonal campaigns work for consented prior-purchase segments, with current opt-out/quotas and no unauthorized clinical audience inference. | Mathew | P2 functional; P3 company acceptance | P1-MAT-004, P1-DEN-004 | Current delivered subset only; full acceptance Pending P2/P3. |
| R28 — Seasonal offers and landing pages; E7 | Staff publish/schedule a branded campaign page and valid promotion; start/end times and redemption limits are enforced; the first clinic-approved campaign is configured for launch. | Josin + Mathew | P2 functional; P3 company acceptance | Readiness/input only; no functional G1 acceptance claimed | Current delivered subset only; full acceptance Pending P2/P3. |
| R29 — Abandoned-cart recovery; E7 | Eligible consented cart receives one scheduled reminder after the approved delay; completed/cancelled carts and unsubscribed users are suppressed; recovery link is scoped and expiring. | Mathew | P2 functional; P3 company acceptance | P1-MAT-004, P1-DEN-004 | Current delivered subset only; full acceptance Pending P2/P3. |
| R30 — Verified-buyer reviews and physician content; E7 | Review eligibility checks completed purchase; moderation and publication controls work; approved physician notes are visible beside products. | Josin + Mathew | P2 functional; P3 company acceptance | P1-DEV-004, P1-DEN-002 | Current delivered subset only; full acceptance Pending P2/P3. |
| R31 — Referrals and loyalty; E7, C8 | Share link, eligible first-order credit, points/credit ledger, redemption caps, refund reversal and basic self-referral/fraud prevention pass. | Josin | P2 functional; P3 company acceptance | P1-JOS-001, P1-DEN-001, P1-TIN-002 | Current delivered subset only; full acceptance Pending P2/P3. |
| R32 — Multiple clinics; E8 | Location-specific stock, physician availability, staff access and sales reports work for two configured clinics; inter-location stock moves retain batch traceability. | Mathew + Josin | P2 functional; P3 company acceptance | P1-MAT-002, P1-DEV-003, P1-PAU-003, P1-DEN-003 | Current delivered subset only; full acceptance Pending P2/P3. |
| R33 — Wholesale/distributor ordering; E8 | Approved business account sees assigned price list, MOQ/pack size and permitted payment terms; account approval, fulfillment and GST records are auditable. | Josin | P2 functional; P3 company acceptance | P1-JOS-001, P1-DEN-001, P1-TIN-002 | Current delivered subset only; full acceptance Pending P2/P3. |
| R34 — SEO and shopping/business listings; E3, E7 | Product schema, canonical URLs, language alternates, sitemap, redirects and merchant product feed validate; company listing linkage is configured. Required merchant/feed approvals are recorded; approval pending is distinguished from a working feed and remains an open launch requirement. | Devadathan | P2 validated feeds/pages; P3 required listing approvals | Readiness/input only; no functional G1 acceptance claimed | Current delivered subset only; full acceptance Pending P2/P3. |
| R35 — Sales, retention and clinical conversion reports; E6-7, C6, C8 | Product/concern/city/clinic sales, repeat rate, refill due/lapsed, subscription state, conversation-to-cart/order/booking/handoff, and consultation-to-order metrics reconcile to operational records. Permissioned content reports also show defined, deduplicated knowledge-entry/version answer-usage counts without raw health prompts. | Josin + Mathew | P2 functional; P3 company acceptance | P1-MAT-004, P1-DEN-004, P1-TIN-001 | Current delivered subset only; full acceptance Pending P2/P3. |
| R36 — Roles, privacy, audit and ownership; C6-7 | Per-role and per-record tests pass; sensitive actions are logged; accounts, source, data and deployment access belong to the company; consent/retention workflows operate. Versioned required sign-up/privacy consent remains distinct from optional marketing consent; per-consultation identity/consent and private access are enforced. | Mathew + Devadathan | P2 functional; P3 company acceptance | P1-MAT-001, P1-MAT-002, P1-MAT-003, P1-MAT-004, P1-MAT-005, P1-MAT-090, P1-MAT-099, P1-JOS-099, P1-DEV-001, P1-DEV-002, P1-DEV-003, P1-DEV-004, P1-DEV-090, P1-DEV-080, P1-DEV-099, P1-PAU-004, P1-PAU-090, P1-PAU-099, P1-DEN-002, P1-DEN-090, P1-DEN-099, P1-TIN-001, P1-TIN-002, P1-TIN-003, P1-TIN-090, P1-TIN-080, P1-TIN-099 | Current delivered subset only; full acceptance Pending P2/P3. |
| R37 — Onboarding and recorded training; C8 | Front desk, warehouse, finance and physicians each complete role-specific scenarios; recordings, guides, access recovery and incident contacts are handed over. | Devadathan + domain owners | P2 guide drafts; P3 recorded training/acceptance | Readiness/input only; no functional G1 acceptance claimed | Current delivered subset only; full acceptance Pending P2/P3. |
| R38 — Production operations and maintenance readiness; E6, C8 | Monitoring, backups, tested restore, release/rollback, payment reconciliation, escalation ownership and scheduled content-review procedures are operating. Handover explicitly includes monthly physician flagged-conversation review, quarterly operating reports, security/app-release/priority-fix workflow, proposed eight-hour monthly knowledge-update allowance and agreed overflow; healthy due-job pickup p95 <2 minutes and a defined 99.9% rolling-month internal availability objective are measured/configured, not claimed as prelaunch achieved SLA. | Devadathan | P1 foundations; P2 integrated controls; P3 recovery/operations proof | P1-MAT-004, P1-MAT-005, P1-MAT-099, P1-JOS-099, P1-DEV-001, P1-DEV-004, P1-DEV-090, P1-DEV-080, P1-DEV-099, P1-PAU-099, P1-DEN-099, P1-TIN-001, P1-TIN-002, P1-TIN-003, P1-TIN-090, P1-TIN-080, P1-TIN-099 | Current delivered subset only; full acceptance Pending P2/P3. |

## 14. Completion and handoff checklist

- [ ] Every due phase output and work package has reviewed integration evidence and reconciled hours/dependencies.
- [ ] All current/due mandatory functional, negative-security, clinical, device and resilience tests have executed and passed.
- [ ] No unresolved blocker or untriaged finding remains; fixes identify the tested candidate and independent retest.
- [ ] Requirement statuses distinguish implemented/integrated/tested/company-accepted/publicly-verified and expose external dependencies.
- [ ] Environment/data/provider modes, actual resource usage and cost/approval risks are recorded.
- [ ] Company reviewers accept their due milestones; G1 report and decision are stored with exact artifacts.
- [ ] Next-phase inputs or final handover are complete; no required feature is silently deferred or disabled.

**Document boundary:** This is the detailed Phase 1 execution plan. Member execution documents will repeat these assigned IDs, inputs, deliverables and checks across all phases; they will not alter this gate, architecture, scope or capacity.
