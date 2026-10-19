# Kandamkulathi Digital Commerce & Companion

> **Named team allocation update — 19 October 2026:** The six individual plans numbered 05–10 now govern named ownership, branches and person-hour allocation. Mathew owns backend/AI and critical domain review; Devadathan owns frontend/mobile/platform/release; Josin owns commerce with Mathew’s review; Paul and Denzil own bounded support/UI/content work; Tinu leads QA with no critical product feature assignment. Original E1–E6 IDs below remain technical scope references, not a direct mapping to these people. The previous per-E-role ownership/hour/day grids are superseded by the named plans. All R01–R38 acceptance criteria, phase outputs, 10-day window, protected test gates and overall phase hour/category totals remain unchanged. See [the named team plans](Kandamkulathi_05_Mathew_All_Phases.md) and [Tinu’s standalone detailed test cases](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md).

## Document 04 — Phase 3: Production Verification, Acceptance and Launch

| Document control | Baseline |
|---|---|
| ID / version / prepared | KND-PH3-004 / 1.0 / 19 October 2026 |
| Governing document | [Kandamkulathi_01_Master_Implementation_Plan_3_Phases.md](Kandamkulathi_01_Master_Implementation_Plan_3_Phases.md) |
| Window | Days 7–10 · 27–30 October 2026 |
| Team capacity | Six engineers × 4 working days = 24 person-days / 192 planning hours |
| Gate | G3 — cumulative tests of the entire currently implemented app; no unresolved blockers |
| Fixed architecture | Workers Paid + Neon PostgreSQL 17, WorkOS, R2, Vectorize, Queues/Cron, Durable Objects/WebRTC/TURN and the agreed provider integrations |
| Status | Planned. Work packages, tests, provider approvals and gate results are pending; this document claims no completed implementation. |

## 1. Objective, boundaries and planning conditions

Prove the complete candidate on paid production-equivalent settings, repair and retest defects, obtain company/provider/store acceptance, and close G3 only after safe public deployment verification and handover.

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
| P3-O01 | Production-equivalent environment | Workers Paid and Neon Launch activated, production driver/pool/roles, always-active compute, seven-day history, isolated R2/queues/identity and alerts verified. |
| P3-O02 | Final functional/security/clinical regression | All cumulative suites against the exact release candidate; reviewed scan findings; device/language/access/AI reports; every release blocker closed and retested. |
| P3-O03 | Capacity and resilience proof | Sustained/burst/soak workload, transaction contention, autoscaling/cold-cache path, job recovery and provider outages pass Section 11 thresholds. |
| P3-O04 | Recovery and rollback proof | PITR and independent pg_restore/object recovery, connection cutover, prior-version deployment and payment/booking reconciliation exercised. |
| P3-O05 | Business and channel acceptance | Opening balances/data, company UAT, live merchant/templates/courier/listing eligibility, clinically approved content and actual public store approvals. |
| P3-O06 | Company handover | Recorded role training, operating guides, service/repository ownership, credential recovery, support/incident rota and measured budget dashboard. |
| P3-O07 | Gate G3 and release record | Prelaunch decision attached to the tested candidate, safe production verification, publicly installed Android/iOS, required web/WhatsApp availability and final acceptance signatures. |

## 4. Capacity and exact work-package register

The named register below is authoritative for execution, branches and exclusive capacity. B = implementation/QA preparation, V = verification, E = environment/handover, C = conditional reserve. Old E1–E6 IDs in section 7 are retained unbudgeted **technical references**, not six additional people or a second schedule.

| Person | B h | V h | E h | C h | Total h |
|---|---:|---:|---:|---:|---:|
| Mathew | 7 | 12 | 6 | 7 | 32 |
| Josin | 7 | 12 | 6 | 7 | 32 |
| Devadathan | 8 | 10 | 7 | 7 | 32 |
| Paul | 6 | 13 | 7 | 6 | 32 |
| Denzil | 6 | 13 | 7 | 6 | 32 |
| Tinu | 2 | 20 | 3 | 7 | 32 |
| **Total** | **36** | **80** | **36** | **40** | **192** |

| Named package | Owner | Category | Hours | Exact branch from `dev`; PR to `dev` | Source technical references |
|---|---|---|---:|---|---|
| P3-MAT-001 — Fix verified clinical/access/AI findings | Mathew | B | 4 | `feature/p3-mathew-clinical-ai-hardening` | P3-E1-001, P3-E5-001 |
| P3-MAT-002 — Cross-domain transaction and channel hardening | Mathew | B | 3 | `feature/p3-mathew-transaction-channel-hardening` | P3-E1-002, P3-E5-002 |
| P3-MAT-090 — G3 verification and cumulative regression | Mathew | V | 12 | `test/p3-mathew-g3-verification` | P3-E1-090, P3-E5-090 |
| P3-MAT-080 — Environment, acceptance and handover support | Mathew | E | 6 | `chore/p3-mathew-readiness-handover` | P3-E1-080, P3-E5-080 |
| P3-MAT-099 — Protected defect/retest reserve | Mathew | C | 7 | `fix/p3-mathew-bug-001` | P3-E1-099, P3-E5-099 |
| P3-JOS-001 — Resolve verified commerce edge cases | Josin | B | 4 | `feature/p3-josin-commerce-hardening` | P3-E2-001 |
| P3-JOS-002 — Finance/provider recovery and reconciliation | Josin | B | 3 | `feature/p3-josin-recovery-control-totals` | P3-E2-002 |
| P3-JOS-090 — G3 verification and cumulative regression | Josin | V | 12 | `test/p3-josin-g3-verification` | P3-E2-090 |
| P3-JOS-080 — Environment, acceptance and handover support | Josin | E | 6 | `chore/p3-josin-readiness-handover` | P3-E2-080 |
| P3-JOS-099 — Protected defect/retest reserve | Josin | C | 7 | `fix/p3-josin-bug-001` | P3-E2-099 |
| P3-DEV-001 — Paid platform, performance and recovery corrections | Devadathan | B | 4 | `feature/p3-devadathan-performance-recovery-hardening` | P3-E6-001, P3-E6-002 |
| P3-DEV-002 — Sensitive frontend/native corrections and complete builds | Devadathan | B | 4 | `feature/p3-devadathan-native-client-hardening` | P3-E4-001, P3-E4-002, P3-E3-001 |
| P3-DEV-090 — G3 verification and cumulative regression | Devadathan | V | 10 | `test/p3-devadathan-g3-verification` | P3-E3-090, P3-E4-090, P3-E6-090 |
| P3-DEV-080 — Environment, acceptance and handover support | Devadathan | E | 7 | `chore/p3-devadathan-readiness-handover` | P3-E3-080, P3-E4-080, P3-E6-080 |
| P3-DEV-099 — Protected defect/retest reserve | Devadathan | C | 7 | `fix/p3-devadathan-bug-001` | P3-E3-099, P3-E4-099, P3-E6-099 |
| P3-PAU-001 — Bounded customer UI corrections | Paul | B | 3 | `feature/p3-paul-customer-ui-fixes` | P3-E3-001 |
| P3-PAU-002 — Native presentation/device corrections | Paul | B | 3 | `feature/p3-paul-device-ux-fixes` | P3-E4-001, P3-E4-002 |
| P3-PAU-090 — G3 verification and cumulative regression | Paul | V | 13 | `test/p3-paul-g3-verification` | P3-E3-090, P3-E4-090 |
| P3-PAU-080 — Environment, acceptance and handover support | Paul | E | 7 | `chore/p3-paul-readiness-handover` | P3-E3-080, P3-E4-080 |
| P3-PAU-099 — Protected defect/retest reserve | Paul | C | 6 | `fix/p3-paul-bug-001` | P3-E3-099, P3-E4-099 |
| P3-DEN-001 — Bounded staff/content corrections | Denzil | B | 3 | `feature/p3-denzil-admin-content-fixes` | P3-E3-001, P3-E5-002 |
| P3-DEN-002 — SEO, reports and operating material corrections | Denzil | B | 3 | `feature/p3-denzil-seo-report-fixes` | P3-E3-002 |
| P3-DEN-090 — G3 verification and cumulative regression | Denzil | V | 13 | `test/p3-denzil-g3-verification` | P3-E3-090, P3-E5-090 |
| P3-DEN-080 — Environment, acceptance and handover support | Denzil | E | 7 | `chore/p3-denzil-readiness-handover` | P3-E3-080, P3-E5-080 |
| P3-DEN-099 — Protected defect/retest reserve | Denzil | C | 6 | `fix/p3-denzil-bug-001` | P3-E3-099, P3-E5-099 |
| P3-TIN-001 — Maintain final cases, fixtures and smoke checks | Tinu | B | 2 | `test/p3-tinu-qa-maintenance` | P3-E6-002 |
| P3-TIN-090 — G3 verification and cumulative regression | Tinu | V | 20 | `test/p3-tinu-g3-verification` | P3-E1-090, P3-E2-090, P3-E3-090, P3-E4-090, P3-E5-090, P3-E6-090 |
| P3-TIN-080 — Environment, acceptance and handover support | Tinu | E | 3 | `chore/p3-tinu-readiness-handover` | P3-E1-080, P3-E2-080, P3-E3-080, P3-E4-080, P3-E5-080, P3-E6-080 |
| P3-TIN-099 — Protected defect/retest reserve | Tinu | C | 7 | `fix/p3-tinu-bug-001` | P3-E1-099, P3-E2-099, P3-E3-099, P3-E4-099, P3-E5-099, P3-E6-099 |

Branch suffix `bug-001` is an issue-ID example; create a fix branch only for an actual defect. Review-only/test-execution work requires evidence, not an empty application branch. Full implementation boundaries, inputs, reviewers and acceptance are in the linked member documents; all phases use the same register.

## 5. Daily sequencing and handoff timing

| Person | Day 7: B/V/E/C hours | Day 8: B/V/E/C hours | Day 9: B/V/E/C hours | Day 10: B/V/E/C hours |
|---|---|---|---|---|
| Mathew | 3 / 4 / 0 / 1 | 2 / 4 / 0 / 2 | 2 / 3 / 2 / 1 | 0 / 1 / 4 / 3 |
| Josin | 3 / 4 / 0 / 1 | 2 / 4 / 0 / 2 | 2 / 3 / 2 / 1 | 0 / 1 / 4 / 3 |
| Devadathan | 3 / 3 / 1 / 1 | 3 / 3 / 0 / 2 | 2 / 3 / 2 / 1 | 0 / 1 / 4 / 3 |
| Paul | 3 / 4 / 0 / 1 | 2 / 4 / 0 / 2 | 1 / 3 / 3 / 1 | 0 / 2 / 4 / 2 |
| Denzil | 3 / 4 / 0 / 1 | 2 / 4 / 0 / 2 | 1 / 3 / 3 / 1 | 0 / 2 / 4 / 2 |
| Tinu | 1 / 6 / 0 / 1 | 0 / 6 / 0 / 2 | 1 / 5 / 1 / 1 | 0 / 3 / 2 / 3 |

Every cell totals eight hours and each person’s daily categories reconcile to section 4 and their member document. These are capacity slices, not an invented second package allocation; follow each member’s named task order and peer handoffs. Reviews/coordination/meetings are included; reserve is conditional and otherwise supports verification/handover. Automated background runtime may overlap, but staff/operator/reviewer hours cannot be double-booked. If actual effort does not fit, reforecast rather than taking test capacity.

## 6. Paid verification, candidate control and critical dependencies

### 6.1 Entry conditions and environment parity

G2 is passed; all required application features are implemented and integrated, the 120+40 physician-reviewed evaluation and complete native candidates exist, and known blockers are closed. Training/public approvals/final timed operations proof remain due. A missing required feature triggers G2 Rework and a forecast change rather than being hidden inside this phase’s 36 team hours of bounded hardening/QA maintenance.

On Day 7, Devadathan activates the paid verification environment before final integration/capacity/recovery acceptance: Workers Paid; Neon Launch PostgreSQL 17/Singapore; verified extension, pool/direct endpoints, roles/RLS, production-compatible migrations; 0.25–1 CU initial autoscaling and scale-to-zero disabled; explicit seven-day history; independent encrypted nightly backup; isolated R2/queues/WorkOS/test-provider credentials and live-ready domain/secret configuration. Record actual max connections/settings rather than assuming a pool's advertised client limit equals compute capacity.

Generate representative synthetic retained data with at least 3,000 customers and 10,000 orders, relevant active carts/holds/jobs/clinical assignments and realistic batch/ledger/audit/index distributions. Align size with expected retained data and the prior 5 GB cost model where relevant; avoid padded blobs or only empty fresh tables. Never clone production health data into test environments or leak it through profiling/scanner artifacts.

### 6.2 Candidate and external approval milestones

| Due point | Required milestone | Owner / dependency |
|---|---|---|
| Day 7 first session | Paid environment, safe provider modes, exact candidate/schema/model/KB/native identities and fixture control totals | Devadathan/Mathew publish; others perform independent device/content checks until integration endpoint is verified. |
| Day 7 after paid integration/device regression | Submit complete tested Android/iOS candidate with review accounts/listing/privacy assets | Devadathan/company account owners. Unclosed native/security/clinical blocker prevents submission/release claims; later binary fixes require retest and resubmission. |
| Day 8 | Sustained/burst/soak, race/outage/priority, restore/cutover/rollback and alert evidence | Devadathan orchestrates; each domain engineer verifies its invariants and repairs/retests demonstrated defects. |
| Day 9 | Company clinical/finance/warehouse/front-desk/support UAT, recorded training, opening balances, final regression and actual approval status | All six with named company reviewers. Missing approvals/feature acceptance remain explicit G3 blockers. |
| Day 10 before rollout | Exact candidate, zero blockers, valid inherited test evidence, all required public/provider readiness and recorded Go/No-go | Mathew/Devadathan and company product/clinical/finance/operations owners. |
| Day 10 after rollout | Safe production checks, public apps/web/WhatsApp, provider/ledger/job verification, alerts/support and ownership handover | All six; G3/Phase 3 closes only after these pass. |

Candidate identity includes source commit, Worker/web/native artifacts, database schema and relevant configuration, provider modes, model/prompt, KB/translation versions and test data manifest. Configuration/content changes can invalidate tests even without a code commit. A later fix increments the candidate and triggers the affected/critical regression; do not use a Day 7 report to approve changed Day 10 logic.

### 6.3 Operating responsibilities and budget checks

Devadathan/Mathew coordinate incidents and rollback; Josin owns provider/finance/stock reconciliation; Mathew AI/messages/jobs; Devadathan native/video and store responses; Devadathan with Paul/Denzil web/content/report presentation. Company clinical/operations contacts and primary/backups must receive an actual test alert and know escalation/stop authority. Staff/physician training is recorded and exercises real roles, not just a generic feature slideshow.

Measure average CU-hours, history/staging, CPU/pool/locks, R2 retention, model tokens/audio and messages with the declared traffic. Carry forward the master's approximately ₹4,022 modeled minimum core and ₹10,233 full-service scenario; provision ₹11,000–₹13,000 at roughly 0.25–0.5 average production CU. A month near 1 average CU is about ₹15,746 for that full-service scenario. Taxes/payment/shipping/labor and optional paid services remain separate. These are planning assumptions, not an instruction to stop required work when a free allowance is exhausted.


## 7. Retained technical specifications — unbudgeted source references

The six labels E1–E6 below identify source technical domains only. Every old package has **zero separate current allocation**; its work is split by the named section 4 register/member boundaries. They are not six extra people. Review/implementation instructions here must be read with the named contract and role restrictions.

### E1 — Technical lead / clinical backend

#### P3-E1-001 — Harden access, clinical and booking behavior on the paid candidate

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O01, P3-O02. **Requirements:** R10, R11, R12, R14, R15, R18, R19, R32, R36.

**Inputs/dependencies:** G2; P3-E6-001; final company policy/content decisions.

**Implementation / execution:** Review the production runtime roles, transaction-local RLS context, staff-organization MFA, revoked sessions, assignment and consent boundaries. Check interval exclusion/hold expiry and clinical/recommendation versions on the actual paid endpoint. Close proven configuration/logic defects with independent review; update error/timeout behavior and cross-channel contracts only where necessary. No new required feature is deferred into this task.

**Done when:** The paid candidate retains the same validated authorization/clinical invariants; all changes identify affected regression/evaluation.

**Tests/evidence:** Reviewed diffs, production-equivalent policy/role tests and exact candidate manifest.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E1-002 — Review concurrency, resilience and release correctness across domains

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O02, P3-O03, P3-O04. **Requirements:** R02, R05, R07, R12, R15, R18, R36, R38.

**Inputs/dependencies:** P3-E2-001; P3-E6-002; domain failure evidence.

**Implementation / execution:** Inspect stock/payment/booking/credit locks, transaction boundaries, uncertain commit handling and pool/lock timeouts under load. Verify retry/idempotency and restored access controls; challenge negative security/clinical tests and review blocker fixes from other owners. Approve measured sizing changes and schema-compatible rollback; record technical risks and readiness rather than inferring readiness from test counts.

**Done when:** Independent review finds no unresolved critical invariant or access gap and any changed component has valid retest evidence.

**Tests/evidence:** Cross-domain review notes, failure/control totals, retest map and technical gate recommendation.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E1-080 — Lead clinical/privacy acceptance, doctor training and technical release decision

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O05, P3-O06, P3-O07. **Requirements:** R25, R36, R37, R38.

**Inputs/dependencies:** Phase prerequisites and applicable company owners; tested candidate before public release.

**Implementation / execution:** Run physician/privacy/doctor training scenarios on the final UI; obtain approved medical/language/guardian/retention/signature decisions. Review all domain evidence and remaining defects with E6. Record technical Go/No-go and safe postdeployment clinical/access confirmation; do not approve a required feature or risk by omission. Review clarification C07: Hand over a dated maintenance calendar: daily reconciliation; weekly access/job/backup/capacity/security checks; monthly physician review of flagged conversations and knowledge changes; quarterly operating/performance report. Name primary/backup owners, priority-fix/security/app-release workflow, and the proposal’s up-to-eight-hours-per-month knowledge-maintenance allowance with an agreed overflow/response process. These are support obligations/operating labor, not extra sprint capacity, new subscription pricing, or automatically created reminders.

**Done when:** Required environment/release/handover records are complete for the due milestone; external approvals remain explicit and public release depends on G3.

**Tests/evidence:** Configuration/approval/training/release register with ownership, timestamps, build IDs and safe verification results.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E1-090 — Final clinical/security/booking UAT and independent retest

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O07. **Requirements:** R10, R11, R12, R14, R15, R18, R19, R32, R36.

**Inputs/dependencies:** All currently due phase deliverables; frozen candidate and common test fixtures.

**Implementation / execution:** Execute full clinical/access/guardian/assignment/retention UAT and all booking conflict/expiry/refund/signed-cart cases on the exact paid candidate. Verify production roles/MFA/pool reuse and evaluate critical AI repeats with physicians. Participate in finance/restore/security review and validate each blocker fix plus cross-domain critical regression; document final acceptance.

**Done when:** Mandatory owned tests and shared critical regression are executed; failures have reproducible defects and fix/retest evidence. No phase is declared bug-free or accepted with unresolved blockers.

**Tests/evidence:** G3 test report, exact candidate metadata, defects/retests and company review evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E1-099 — Protected defect/retest contingency

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O07. **Requirements:** R36, R38.

**Inputs/dependencies:** Actual findings from continuous tests or the phase campaign.

**Implementation / execution:** Reserve this time for reproducing, containing, fixing and independently retesting phase defects. Link every use to the affected R IDs and source work package. Apply root-cause review and risk-based cumulative regression. If no defects consume it, use it for broader verification/handover; do not add new scope. If blockers exceed the reserve, record Rework/No-go and revise the forecast without weakening the gate.

**Done when:** All blocker fixes have evidence; unused time is recorded transparently. The reserve is not an estimate that every possible bug can be repaired within it.

**Tests/evidence:** Defect time/retest log, changed-candidate evidence map and updated remaining-effort forecast.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

### E2 — Commerce backend

#### P3-E2-001 — Harden financial, inventory and operational edge cases

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O02, P3-O03. **Requirements:** R02, R04, R05, R06, R07, R09, R26, R31, R33.

**Inputs/dependencies:** G2 full commerce candidate; finance/warehouse UAT; P3-E6-001.

**Implementation / execution:** Recheck server-side pricing/tax rounding, FEFO/expiry/recall, provider references, invoice series, refunds/returns/COD, renewal shortages, distributor terms and credit reversals on paid configuration. Fix only demonstrated defects and profile slow/contended queries; retain consistent lock order and current price/clinical eligibility. Update migrations/tests with independent review; reconcile visible UI and durable ledger state.

**Done when:** Known financial/warehouse/credit edge cases preserve balances and no performance fix weakens eligibility, stock or audit.

**Tests/evidence:** Reviewed hardening changes, tax/ledger/stock comparison and targeted concurrent tests.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E2-002 — Verify provider reconciliation and restore/replay safety

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O03, P3-O04, P3-O05. **Requirements:** R02, R06, R07, R09, R12, R31, R35, R38.

**Inputs/dependencies:** P3-E6-002; webhook/job replay harness; available live provider eligibility.

**Implementation / execution:** Exercise delayed/out-of-order/missing events, lost provider responses, duplicate refunds/renewals/labels and database cutover. Compare provider charge/refund/mandate/shipment status to restored order/ledger/batch/booking totals. Complete minimal company-authorized live charge/refund proof and COD accounting readiness without bulk production traffic. Verify report rebuilding and credit reversals after replay; publish finance recovery guidance.

**Done when:** No replay duplicates a financial/stock effect; ambiguous outcomes resolve to recorded obligations and reports reconcile after restore.

**Tests/evidence:** Provider-to-ledger comparison, controlled live references, restore checkpoint/control totals and finance runbook.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E2-080 — Lead finance/warehouse acceptance, training and live reconciliation

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O05, P3-O06, P3-O07. **Requirements:** R25, R36, R37, R38.

**Inputs/dependencies:** Phase prerequisites and applicable company owners; tested candidate before public release.

**Implementation / execution:** Train finance/warehouse on orders, packing/returns/recall/transfer, GST/credit notes, subscriptions, COD and credit/distributor controls. Verify signed opening balances, company tax/policy decisions and minimal authorized live payment/refund references. Record acceptance, reconciliation/incident responsibilities and postdeployment money/stock checks.

**Done when:** Required environment/release/handover records are complete for the due milestone; external approvals remain explicit and public release depends on G3.

**Tests/evidence:** Configuration/approval/training/release register with ownership, timestamps, build IDs and safe verification results.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E2-090 — Final finance/inventory/provider/capacity/recovery verification

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O07. **Requirements:** R01, R02, R03, R04, R05, R06, R07, R09, R12, R26, R31, R33, R35, R38.

**Inputs/dependencies:** All currently due phase deliverables; frozen candidate and common test fixtures.

**Implementation / execution:** Own last-unit/multibatch and payment/renewal/refund race tests under sustained/burst/soak and provider failures. Reconcile GST/COD/transfer/credit/distributor/report fixtures, minimal live charge/refund and post-restore events. Validate opening balances and after-cutover state with finance/warehouse; independently retest critical fixes.

**Done when:** Mandatory owned tests and shared critical regression are executed; failures have reproducible defects and fix/retest evidence. No phase is declared bug-free or accepted with unresolved blockers.

**Tests/evidence:** G3 test report, exact candidate metadata, defects/retests and company review evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E2-099 — Protected defect/retest contingency

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O07. **Requirements:** R36, R38.

**Inputs/dependencies:** Actual findings from continuous tests or the phase campaign.

**Implementation / execution:** Reserve this time for reproducing, containing, fixing and independently retesting phase defects. Link every use to the affected R IDs and source work package. Apply root-cause review and risk-based cumulative regression. If no defects consume it, use it for broader verification/handover; do not add new scope. If blockers exceed the reserve, record Rework/No-go and revise the forecast without weakening the gate.

**Done when:** All blocker fixes have evidence; unused time is recorded transparently. The reserve is not an estimate that every possible bug can be repaired within it.

**Tests/evidence:** Defect time/retest log, changed-candidate evidence map and updated remaining-effort forecast.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

### E3 — Web / staff / content

#### P3-E3-001 — Harden complete web/workspace UX, language and data presentation

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O02, P3-O05. **Requirements:** R01, R03, R04, R07, R14, R16, R20, R22, R28, R30, R33, R35.

**Inputs/dependencies:** G2 web candidate; company UAT and final approved content.

**Implementation / execution:** Repair demonstrated EN/ML/TA, font/accessibility, focus/keyboard, responsive, loading/conflict/pending and role-navigation defects. Reconcile invoice, subscription, referral/distributor and reporting displays with the authoritative API. Verify no private cache, analytics event, source map or exported value leaks patient/credential data. Preserve complete required workflows and safe confirmation UI while improving public-page performance.

**Done when:** UAT and visual/accessibility fixes are integrated without breaking role, financial or clinical rendering; all launch resources are reviewed.

**Tests/evidence:** Browser/locale/accessibility before/after evidence, cache/export checks and reviewed fixes.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E3-002 — Validate public SEO, feeds, campaigns and operating guides

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O02, P3-O05, P3-O06. **Requirements:** R27, R28, R29, R30, R34, R35, R37.

**Inputs/dependencies:** P2-E3-003 P2-E3-004; final production URLs/company approvals.

**Implementation / execution:** Validate canonical/language alternates/schema/sitemap/redirects, product feed availability and listing references on the release domain. Confirm first approved campaign configuration, template/consent/suppression behavior and live approvals with company owners. Finish operational guide screenshots and report definitions/freshness. Inspect public indexing boundaries so private/account/clinical URLs and signed links are not published.

**Done when:** Required public artifacts validate and approval states are explicit; training guides match the final UI and no private route is exposed through feeds/indexing.

**Tests/evidence:** SEO/feed validation, approval register, campaign suppression proof and versioned guides.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E3-080 — Lead web/content/front-desk handover and public content verification

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O05, P3-O06, P3-O07. **Requirements:** R25, R36, R37, R38.

**Inputs/dependencies:** Phase prerequisites and applicable company owners; tested candidate before public release.

**Implementation / execution:** Record front-desk/content/admin training and role guides matching the final UI; verify approved copy/translations, first campaign, SEO/feed/listing references, accessible workflows and report definitions. Obtain company acceptance/ownership and perform final live web/public-private cache smoke with safe accounts.

**Done when:** Required environment/release/handover records are complete for the due milestone; external approvals remain explicit and public release depends on G3.

**Tests/evidence:** Configuration/approval/training/release register with ownership, timestamps, build IDs and safe verification results.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E3-090 — Final browser/language/accessibility/growth/report UAT

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O07. **Requirements:** R01, R03, R04, R07, R14, R16, R20, R22, R27, R28, R29, R30, R31, R33, R34, R35, R37.

**Inputs/dependencies:** All currently due phase deliverables; frozen candidate and common test fixtures.

**Implementation / execution:** Run complete browser/customer/staff/physician/support/content journeys, authenticated misuse, all launch resources and representative mobile browser/accessibility. Validate LCP/cache/privacy, report totals/freshness/exports, first approved campaign, review/wholesale/credit flows, SEO/feed/listing readiness and company role scenarios. Retest fixes against the final web artifact.

**Done when:** Mandatory owned tests and shared critical regression are executed; failures have reproducible defects and fix/retest evidence. No phase is declared bug-free or accepted with unresolved blockers.

**Tests/evidence:** G3 test report, exact candidate metadata, defects/retests and company review evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E3-099 — Protected defect/retest contingency

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O07. **Requirements:** R36, R38.

**Inputs/dependencies:** Actual findings from continuous tests or the phase campaign.

**Implementation / execution:** Reserve this time for reproducing, containing, fixing and independently retesting phase defects. Link every use to the affected R IDs and source work package. Apply root-cause review and risk-based cumulative regression. If no defects consume it, use it for broader verification/handover; do not add new scope. If blockers exceed the reserve, record Rework/No-go and revise the forecast without weakening the gate.

**Done when:** All blocker fixes have evidence; unused time is recorded transparently. The reserve is not an estimate that every possible bug can be repaired within it.

**Tests/evidence:** Defect time/retest log, changed-candidate evidence map and updated remaining-effort forecast.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

### E4 — Android / iOS

#### P3-E4-001 — Harden final Android/iOS behavior and production API compatibility

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O02, P3-O05. **Requirements:** R02, R03, R10, R12, R13, R17, R22, R24, R25, R31, R36.

**Inputs/dependencies:** G2 complete native candidates; paid API; approved store assets.

**Implementation / execution:** Repair demonstrated payment-return, network resume, session/deep-link, video/voice permission/reconnect, private-cache and language/accessibility defects on actual supported devices. Verify the release API works with the approved candidate and prior supported app contract during staged rollout. Produce a new signed build for every binary change; bind tests and store submission to that build. No remote switch may hide required customer scope to claim completion.

**Done when:** Both signed candidates pass device/API parity and review-account checks, with no debug secrets or unsupported native adapter.

**Tests/evidence:** Build hashes/device recordings, contract/permission/cache tests and reviewed native fixes.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E4-002 — Verify consultation network quality and signing/store readiness

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O02, P3-O03, P3-O05. **Requirements:** R13, R21, R24, R25, R36.

**Inputs/dependencies:** P3-E4-001; authenticated signaling/TURN; company store owners.

**Implementation / execution:** Exercise web/Android/iOS calls, mic/camera denial, reconnect/background, expired/revoked/guessed rooms and representative poor networks. Record negotiated bitrate/relay use and private participant authorization. Recheck signing/permissions/privacy disclosures, app links, provider returns and public store eligibility. Coordinate review fixes without losing candidate/evidence linkage; submission or TestFlight is not public availability.

**Done when:** Private native/web consultations are accepted on representative networks and complete releasable packages are ready for actual store approval.

**Tests/evidence:** Network/video/security matrix, bitrate/relay report, privacy/signing checklist and store status evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E4-080 — Submit complete apps, respond to review and verify public native delivery

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O05, P3-O06, P3-O07. **Requirements:** R25, R36, R37, R38.

**Inputs/dependencies:** Phase prerequisites and applicable company owners; tested candidate before public release.

**Implementation / execution:** Submit the complete tested signed candidate after Day 7 paid regression; track company-owned store references and approval blockers daily. Rebuild/resubmit only reviewed and retested changes. Verify signing/privacy/review account handover, actual public Android/iOS installation, customer parity and native payment/video/voice/push smoke. Submission/internal/TestFlight is not final delivery.

**Done when:** Required environment/release/handover records are complete for the due milestone; external approvals remain explicit and public release depends on G3.

**Tests/evidence:** Configuration/approval/training/release register with ownership, timestamps, build IDs and safe verification results.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E4-090 — Final release-binary/device/video/voice/store verification

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O07. **Requirements:** R02, R03, R09, R10, R11, R12, R13, R15, R17, R18, R19, R20, R22, R23, R24, R25, R26, R31, R33, R36.

**Inputs/dependencies:** All currently due phase deliverables; frozen candidate and common test fixtures.

**Implementation / execution:** Run full Android/iOS parity and the device/OS/network/permission/payment-return/deep-link/security matrix using signed release builds. Exercise simultaneous private consultations and voice ambiguity, notification consent, session revocation and app resume. Verify store review accounts and publicly installed builds match approved APIs/features; retest native changes with exact build identity.

**Done when:** Mandatory owned tests and shared critical regression are executed; failures have reproducible defects and fix/retest evidence. No phase is declared bug-free or accepted with unresolved blockers.

**Tests/evidence:** G3 test report, exact candidate metadata, defects/retests and company review evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E4-099 — Protected defect/retest contingency

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O07. **Requirements:** R36, R38.

**Inputs/dependencies:** Actual findings from continuous tests or the phase campaign.

**Implementation / execution:** Reserve this time for reproducing, containing, fixing and independently retesting phase defects. Link every use to the affected R IDs and source work package. Apply root-cause review and risk-based cumulative regression. If no defects consume it, use it for broader verification/handover; do not add new scope. If blockers exceed the reserve, record Rework/No-go and revise the forecast without weakening the gate.

**Done when:** All blocker fixes have evidence; unused time is recorded transparently. The reserve is not an estimate that every possible bug can be repaired within it.

**Tests/evidence:** Defect time/retest log, changed-candidate evidence map and updated remaining-effort forecast.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

### E5 — AI / messaging / integrations

#### P3-E5-001 — Harden clinical safety, tool authorization and human routing

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O02, P3-O03. **Requirements:** R16, R17, R18, R19, R20, R22, R23, R24, R36.

**Inputs/dependencies:** G2 approved content/evaluation; final model/prompt/KB versions.

**Implementation / execution:** Recheck primary approval/withdrawal, mandatory safety blocks, exact/vector aliases, additional-language fallback, Romanized/voice ambiguity and urgent/consult-only behavior. Challenge prompt injection, cross-account tools, confirmation replay, human takeover and saturation. Fix demonstrated defects with physician review and rerun affected critical cases; no generated clinical wording or cheaper fallback bypasses the approved policy.

**Done when:** The final versioned candidate passes every critical clinical/access case and medical blocks trace to current approved versions.

**Tests/evidence:** Repeatable 120+40 evaluation, changed-case retest, tool/takeover/urgent negatives and physician approval.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E5-002 — Verify messaging reliability, attribution and channel readiness

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O02, P3-O03, P3-O05. **Requirements:** R08, R09, R10, R20, R21, R27, R29, R35, R38.

**Inputs/dependencies:** Actual live/test channel access; E1 schedules/E2 events; P3-E6-002.

**Implementation / execution:** Inspect signed inbound events, account linking, secure payment/video links, delivery callbacks, agent ownership and stale reply suppression. Exercise duplicates, timeout/unknown delivery, expired media, consent revocation, missed clinical deadlines and campaign backlog. Reconcile conversion metrics and message/model/audio usage. Confirm required templates/senders and clinic number are live with company owners; do not send bulk campaigns as a load test.

**Done when:** The required channel work remains durable/consented, important jobs are not starved and actual live readiness is documented.

**Tests/evidence:** Channel/provider references, replay/suppression/deadline traces, attribution totals and actual usage forecast.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E5-080 — Lead support/marketing/clinical-content training and channel activation

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O05, P3-O06, P3-O07. **Requirements:** R25, R36, R37, R38.

**Inputs/dependencies:** Phase prerequisites and applicable company owners; tested candidate before public release.

**Implementation / execution:** Record support/content/marketing training for handoff/callback, urgent escalation, KB approval/withdrawal, consented campaigns, message/AI failure and safe replay. Verify required live templates/sender/number and authorized minimal channel checks. Hand over evaluation/content-review ownership, provider usage/cost dashboard and support escalation contacts. Review clarification C07: Hand over a dated maintenance calendar: daily reconciliation; weekly access/job/backup/capacity/security checks; monthly physician review of flagged conversations and knowledge changes; quarterly operating/performance report. Name primary/backup owners, priority-fix/security/app-release workflow, and the proposal’s up-to-eight-hours-per-month knowledge-maintenance allowance with an agreed overflow/response process. These are support obligations/operating labor, not extra sprint capacity, new subscription pricing, or automatically created reminders.

**Done when:** Required environment/release/handover records are complete for the due milestone; external approvals remain explicit and public release depends on G3.

**Tests/evidence:** Configuration/approval/training/release register with ownership, timestamps, build IDs and safe verification results.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E5-090 — Final physician-reviewed AI/channel/schedule/outage verification

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O07. **Requirements:** R08, R10, R16, R17, R18, R19, R20, R21, R22, R23, R24, R27, R29, R35, R38.

**Inputs/dependencies:** All currently due phase deliverables; frozen candidate and common test fixtures.

**Implementation / execution:** Repeat the complete 120+40 evaluation on frozen model/prompt/KB versions, plus repeatability of critical cases, withdrawal/injection/tool/confirmation/takeover and saturated/failed-model paths. Test real/test WhatsApp/voice, late/revoked schedule/consent, delivery ambiguity, marketing backlog isolation and reports. Validate templates/number/sender readiness, missed-deadline escalation and measured usage.

**Done when:** Mandatory owned tests and shared critical regression are executed; failures have reproducible defects and fix/retest evidence. No phase is declared bug-free or accepted with unresolved blockers.

**Tests/evidence:** G3 test report, exact candidate metadata, defects/retests and company review evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E5-099 — Protected defect/retest contingency

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O07. **Requirements:** R36, R38.

**Inputs/dependencies:** Actual findings from continuous tests or the phase campaign.

**Implementation / execution:** Reserve this time for reproducing, containing, fixing and independently retesting phase defects. Link every use to the affected R IDs and source work package. Apply root-cause review and risk-based cumulative regression. If no defects consume it, use it for broader verification/handover; do not add new scope. If blockers exceed the reserve, record Rework/No-go and revise the forecast without weakening the gate.

**Done when:** All blocker fixes have evidence; unused time is recorded transparently. The reserve is not an estimate that every possible bug can be repaired within it.

**Tests/evidence:** Defect time/retest log, changed-candidate evidence map and updated remaining-effort forecast.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

### E6 — Platform / quality / release

#### P3-E6-001 — Activate and verify isolated paid production-equivalent resources

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O01. **Requirements:** R25, R36, R38.

**Inputs/dependencies:** G2; company-owned Workers/Neon access; reviewed configuration.

**Implementation / execution:** Activate Workers Paid and Neon Launch verification resources with PostgreSQL 17, required extension, pooled runtime/direct administration, isolated roles/secrets/queues/R2 and seven-day history. Disable production scale-to-zero, verify initial 0.25–1 CU bounds/effective connection limits and document sizing changes. Seed realistic synthetic retained data and pin schema/model/KB/build manifests. Validate TLS, logs/alerts, billing controls and no production side effects in test resources.

**Done when:** Day 7 verification runs the chosen production architecture with measurable settings and safe provider test adapters; no Free-tier performance result substitutes for it.

**Tests/evidence:** Resource/role/config manifest, seed/control totals, billing/history/scale settings and endpoint smoke report.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E6-002 — Harden performance, recovery automation and incident controls

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O03, P3-O04, P3-O06. **Requirements:** R02, R05, R12, R36, R38.

**Inputs/dependencies:** P3-E6-001; all domain owners; existing load/restore scripts.

**Implementation / execution:** Profile CPU/cache/pool/locks/query round trips and job backlog during the declared workloads. Review caching/index/concurrency/timeouts and queue priorities; implement only measured corrections. Validate encrypted independent pg_dump, PITR/object references, roles/RLS restoration, safe endpoint cutover and previous-version schema compatibility. Test alert receipt, secret rotation/recovery and incident/rollback authority; record achieved recovery times instead of assuming targets pass.

**Done when:** Performance/recovery configuration is reproducible, observed bottlenecks have reviewed fixes and alert/reconciliation paths are exercised.

**Tests/evidence:** Versioned k6/resource profiles, restore/cutover/rollback logs, alert receipt and operations runbook.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E6-080 — Coordinate G3, controlled deployment, recovery ownership and support handover

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O01, P3-O06, P3-O07. **Requirements:** R25, R36, R37, R38.

**Inputs/dependencies:** Phase prerequisites and applicable company owners; tested candidate before public release.

**Implementation / execution:** Assemble exact-candidate prelaunch evidence/signatures; execute approved additive migrations/backend/web rollout and coordinate native/channel activation. Run internal safe live checks before widening release, observe agreed metrics and exercise rollback if triggers fire. Hand over company service/source/data/billing/recovery ownership, encrypted backup recovery, incident/on-call rota and measured costs. Close G3 only after all required public channels and checks pass. Review clarification C07: Hand over a dated maintenance calendar: daily reconciliation; weekly access/job/backup/capacity/security checks; monthly physician review of flagged conversations and knowledge changes; quarterly operating/performance report. Name primary/backup owners, priority-fix/security/app-release workflow, and the proposal’s up-to-eight-hours-per-month knowledge-maintenance allowance with an agreed overflow/response process. These are support obligations/operating labor, not extra sprint capacity, new subscription pricing, or automatically created reminders.

**Done when:** Required environment/release/handover records are complete for the due milestone; external approvals remain explicit and public release depends on G3.

**Tests/evidence:** Configuration/approval/training/release register with ownership, timestamps, build IDs and safe verification results.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E6-090 — Final security, load/soak, resilience, recovery and evidence coordination

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O07. **Requirements:** R10, R25, R36, R38.

**Inputs/dependencies:** All currently due phase deliverables; frozen candidate and common test fixtures.

**Implementation / execution:** Coordinate final authenticated risk-based security review and triage, 60 rps/30 minutes, 120 rps/5 minutes and 20 rps/4-hour soak with correct metadata and controlled providers. Measure cold-cache/autoscaling/pool/locks and jobs, execute PITR/independent restore/object/cutover/rollback/alert drills, and gather independent domain evidence. Record achieved results and exact-candidate G3 evidence without claiming universal bug absence. Review clarification C08: Measure healthy-state due-to-claim pickup p95 below two minutes with agreed server timestamps/sample size while preserving current consent/version/deadline suppression. During fault/backlog tests separately measure deadline recovery and alerts. Configure a defined 30-day core-availability SLI/dashboard and 99.9% internal objective, exclusions and owner; ten-day prelaunch tests cannot prove achieved monthly availability and do not imply a paid vendor SLA or 24-hour clinician staffing.

**Done when:** Mandatory owned tests and shared critical regression are executed; failures have reproducible defects and fix/retest evidence. No phase is declared bug-free or accepted with unresolved blockers.

**Tests/evidence:** G3 test report, exact candidate metadata, defects/retests and company review evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P3-E6-099 — Protected defect/retest contingency

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P3-O07. **Requirements:** R36, R38.

**Inputs/dependencies:** Actual findings from continuous tests or the phase campaign.

**Implementation / execution:** Reserve this time for reproducing, containing, fixing and independently retesting phase defects. Link every use to the affected R IDs and source work package. Apply root-cause review and risk-based cumulative regression. If no defects consume it, use it for broader verification/handover; do not add new scope. If blockers exceed the reserve, record Rework/No-go and revise the forecast without weakening the gate.

**Done when:** All blocker fixes have evidence; unused time is recorded transparently. The reserve is not an estimate that every possible bug can be repaired within it.

**Tests/evidence:** Defect time/retest log, changed-candidate evidence map and updated remaining-effort forecast.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

### Integrated review: explicit proposal acceptance details

These details clarify existing R IDs from the company proposals/accepted master; they do not add a later release or another architecture. They must be included in the existing named package estimates. Prove reuse/review capacity on Day 1 and reforecast if the clarified work does not fit; the unchanged 480-hour budget is not new evidence of feasibility.

| Clarification | Source / requirements | Named execution packages | Acceptance and testing |
|---|---|---|---|
| C01 — Complete approved product knowledge and bounded refresh | Companion pp. 4, 8–9: initial approved knowledge covers every website product; updated approved content reaches answers. R01, R16, R17 | P3-MAT-001 | Reconcile every published catalogue product to its physician-approved monograph/dosage/contraindication and required EN/ML/TA safety translations. No published product is an unexplained coverage gap. G1 records the complete inventory/gap register and an approved sample; G2 closes required product coverage and demonstrates approved edit/withdrawal propagation within a company-agreed measured freshness deadline. The illustrative morning-to-afternoon statement is not an invented numeric provider SLA. Include approved public physician profiles and the required knowledge types; approval is not satisfied by catalogue text alone. Evidence: P3-T09, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C02 — Knowledge entry usage analytics | Companion p. 6: staff can see which knowledge entries the assistant uses most. R16, R35 | P3-DEN-002 | Record privacy-minimized answer-to-approved-entry/version attribution, not raw health prompts in general analytics. Content reviewers can view most-used entry/version counts with date filters and freshness labels. Define whether counts represent used answer entries or retrieval hits; count retries once by stable answer/event identity and reconcile known fixtures. Unauthorized roles cannot access the content report. Evidence: P3-T15, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C03 — Explicit intake and consent checkpoints | Companion pp. 5, 7: age/current medication screening, pregnancy/children/red flags; sign-up consent and recorded video consultation identity/consent. R14, R19, R36 | P3-MAT-001 | Capture versioned required sign-up/privacy consent without bundling marketing opt-in; record and enforce required consultation identity/consent before private video/clinical access. Before personalized medical recommendation, follow physician-approved minimal intake including age/current medication and pregnancy/child/red-flag routing; unknown or declined required information uses approved clarification/handoff. Do not impose clinical intake on ordinary public catalogue browsing or infer a diagnosis. Verify configured transport and at-rest protection for clinical database/private objects/backups and approved processor flows using actual configuration/provider evidence; no plaintext secret/health-content evidence dump. Evidence: P3-T08, P3-T10, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C04 — Front-desk outpatient booking and permitted patient order history | Companion pp. 6, 8: staff enter outpatient bookings; assigned doctors see permitted patient past orders. R03, R11, R12, R14 | P3-MAT-001 | Authorized front desk creates an in-clinic outpatient appointment in the same canonical booking lifecycle with source/staff actor and correct clinic fee/payment/refund state; use the same global doctor overlap constraints. It cannot be confused with a walk-in product order. Assigned physicians see policy-permitted past purchases in the linked patient view; unassigned/revoked/cross-patient/clinic access remains denied. Doctor management also includes approved qualifications/photo, slot length and online/in-clinic/both availability settings; front-desk operational readiness is demonstrated before public launch. Evidence: P3-T07, P3-T08, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C05 — Automatic invoice delivery, not only PDF generation | Ecommerce pp. 3–4, 6: GST invoice generated and sent with every order. R07, R08 | P3-JOS-002 | After the finance-approved issuance milestone, create a durable idempotent invoice-ready delivery obligation and send the customer an approved private/scoped invoice link or document through the permitted transactional channel. Generated PDF alone is not delivery evidence. Verify receipt, one effective delivery/reconciliation, retries, expiry/ownership and customer history; no public invoice URL or marketing-consent shortcut. Evidence: P3-T06, P3-T17, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C06 — New-product, restock and seasonal past-buyer campaigns | Ecommerce pp. 3, 7: opted-in past buyers segmented by what they bought; new-product, restock and seasonal campaigns. R27, R28 | P3-MAT-002, P3-DEN-001 | Demonstrate all three approved campaign types: new product, restock and seasonal offer. Build consented prior-purchase segments from authorized commerce facts, with preview/counts, quotas, quiet hours, current opt-out and deduplicated attribution. No raw clinical notes or inferred health-interest audience without explicit business/privacy approval; live sending uses company-controlled approved recipients. Evidence: P3-T16, P3-T17, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C07 — Explicit maintenance calendar and ownership | Ecommerce pp. 6, 8; Companion pp. 7–8: security updates/app releases/priority fixes, monthly flagged-conversation review, knowledge-update allowance and quarterly report. R37, R38 | P3-MAT-080, P3-DEV-080, P3-DEN-080, P3-TIN-080 | Hand over a dated maintenance calendar: daily reconciliation; weekly access/job/backup/capacity/security checks; monthly physician review of flagged conversations and knowledge changes; quarterly operating/performance report. Name primary/backup owners, priority-fix/security/app-release workflow, and the proposal’s up-to-eight-hours-per-month knowledge-maintenance allowance with an agreed overflow/response process. These are support obligations/operating labor, not extra sprint capacity, new subscription pricing, or automatically created reminders. Evidence: P3-T28, P3-T29, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C08 — Numeric job pickup and availability measurement | Accepted master §§11–12: healthy-state due-job pickup p95 <2 minutes and 99.9% monthly core availability objective. R10, R38 | P3-DEV-001, P3-DEV-090 | Measure healthy-state due-to-claim pickup p95 below two minutes with agreed server timestamps/sample size while preserving current consent/version/deadline suppression. During fault/backlog tests separately measure deadline recovery and alerts. Configure a defined 30-day core-availability SLI/dashboard and 99.9% internal objective, exclusions and owner; ten-day prelaunch tests cannot prove achieved monthly availability and do not imply a paid vendor SLA or 24-hour clinician staffing. Evidence: P3-T21, P3-T23, P3-T28, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |

## 8. Production verification campaigns and ownership

| Campaign | Primary coordination | Required independent participation |
|---|---|---|
| Full business and company UAT | Mathew/Josin/Devadathan with Paul/Denzil | Physicians, finance, warehouse/front desk and company product owner run scope-specific scenarios; Devadathan/Mathew verify channel parity. |
| Security/privacy/access | Devadathan/Mathew | Domain owners independently test ownership, pooled RLS/MFA, clinical/customer records, tool/confirmation misuse, files, sessions and final config/artifacts. |
| Clinical/language/voice/handoff | Mathew/Mathew | Physician/language reviewers approve expected results; Devadathan with Paul/Denzil/Devadathan exercise real web/native/WhatsApp rendering, transcript ambiguity and escalation. |
| Device/video/store | Devadathan | Mathew validates participant/clinical permissions, Mathew voice/chat, Devadathan build/network/credential evidence and company account owners actual store eligibility. |
| Capacity/resilience | Devadathan | Josin verifies financial/stock invariants, Mathew bookings/access, Mathew queue/AI/marketing priority and Devadathan with Paul/Denzil/Devadathan UX/channel behavior. |
| Recovery/rollback/provider replay | Devadathan/Josin | Mathew validates roles/RLS/clinical/booking state, Mathew job/KB/suppression recovery, Devadathan with Paul/Denzil/Devadathan clients and company finance/operations control totals. |
| Public release and handover | Devadathan/Mathew | Each owner supplies actual final evidence and training; company signatories authorize release and accept ownership/support. |

## 9. Broad final G3 test catalogue

Re-execute the entire G1/G2 critical suite and all required acceptance paths on the exact paid candidate. The cases below add final evidence; passing a subset does not replace the inherited tests. A required test blocked by a provider/device/data issue blocks the relevant acceptance rather than being marked skipped/pass.

| Test ID | Owner / support | Challenge and mandatory result |
|---|---|---|
| P3-T01 | Tinu coordinates; Devadathan/Mathew; Tinu records | Paid environment parity, schema/extension/driver/pool/roles/history/always-active compute and safe provider modes are verified; all artifacts identify the same candidate. |
| P3-T02 | Tinu coordinates; Mathew/Devadathan operate; Tinu tracks | Every role/customer/clinic/patient/tool route has owner/scope negatives, revoked/expired sessions and pooled-context cleanup; customer auth cannot bypass staff MFA. |
| P3-T03 | Tinu coordinates; Devadathan/Mathew operate; Tinu tracks | Final code/dependency/secret/config/artifact and authenticated manual/dynamic review is triaged; no unresolved critical/high or access/acceptance blocker. |
| P3-T04 | Tinu coordinates; Josin/Mathew | Stock/price/tax/consult-only race and partial-reservation rollback under concurrent last-unit/multibatch attempts; zero negative/oversold stock or duplicate business effects. |
| P3-T05 | Tinu coordinates; Josin/Devadathan; Mathew reviews | Duplicate/out-of-order/missing/mismatched payment/refund/renewal/mandate/ship events and uncertain COMMIT/provider reply reconcile safely. |
| P3-T06 | Tinu coordinates; Josin with finance/warehouse; Tinu | GST/series/credit notes/returns/COD/distributor/credits/bundles/reorder and safe exports reconcile against finance fixtures and provider states. |
| P3-T07 | Tinu coordinates; Mathew/Josin; front desk/physician | Cross-clinic doctor overlap/buffers/leave/reschedule/hold expiry/late payment/refund under simultaneous requests; zero double-confirmed occupied intervals. |
| P3-T08 | Tinu coordinates; Mathew/Devadathan with physician/privacy owner | Consent/guardian/assigned notes/signed recommendation/dose/refill access, version, retention/deletion/export and revoked assignment policy pass final UAT. |
| P3-T09 | Tinu coordinates; Mathew and physician; Tinu records/scoring | Full 120 EN/ML/TA plus 40 additional-language/Romanized cases; all critical cases pass, no fabricated dosage/prohibited action/record leak, 100% medical blocks trace to approved versions and at least 95% supported noncritical task completion. |
| P3-T10 | Tinu coordinates; Mathew/physician; Tinu coordinates | Repeat each case flagged critical at least three times on frozen versions; urgent/injection/consult-only/tool/confirmation/withdrawal/missing-safety outcomes remain safe. Sample success is not universal safety proof. |
| P3-T11 | Tinu coordinates; Mathew; Denzil/Tinu support UI | Account-link replay, bot/agent race, consented summary, after-hours callback/unanswered resolution and expired payment/media links preserve identity/current ownership. |
| P3-T12 | Tinu coordinates; Devadathan/Mathew; Paul/Tinu devices | Web/native/WhatsApp voice, ambiguous unit/number review, permission denial and no unchecked action; required push/link destinations reauthorize session. |
| P3-T13 | Tinu coordinates; Devadathan operates; Mathew access; Paul/Tinu devices | Private web/Android/iOS consultations, denied/wrong/expired/revoked room and poor network/reconnect/resume pass; test at least five simultaneous two-person calls as an initial peak scenario. |
| P3-T14 | Tinu coordinates; Devadathan; Paul/Tinu devices; company store owner | Complete signed native feature parity, prior supported API contract, no debug/secret exposure, accessible supported devices/OS/EN-ML-TA and actual public install. |
| P3-T15 | Tinu coordinates; Tinu/Paul/Denzil; Devadathan/Josin/Mathew review | Public content/private cache/analytics/export and all locale/accessibility checks pass; promotion/review/wholesale/credit and report totals remain correct. |
| P3-T16 | Tinu coordinates; Denzil/Tinu; Devadathan; company marketing/listing owner | Canonical/alternate/schema/sitemap/redirect/feed/live required listing approvals and first company-approved seasonal campaign are verified; private URLs excluded. |
| P3-T17 | Tinu coordinates; Mathew/Josin/Devadathan with company owners | Live required clinic number/templates/SMS sender/merchant/mandate/courier eligibility with minimal authorized checks, no bulk spam or provider load testing. |
| P3-T18 | Tinu coordinates; Devadathan/Mathew; Tinu observes | Ten active model generations plus overload requests enforce bounded leases/rate/timeout/retry/human fallback; core checkout/booking remains available during AI failure. |
| P3-T19 | Tinu coordinates; Devadathan operates; Mathew/Josin invariants | Thirty minutes at 60 dynamic rps, stated mix and realistic retained data; read p95 <500 ms, write p95 <1 s, unexpected server errors <1%, zero invariant/access breach. |
| P3-T20 | Tinu coordinates; Devadathan operates; Mathew/Josin interpret | Five minutes at 120 dynamic rps; bounded retry/conflict behavior, no false success, duplicate effect, unbounded pool queue or correctness violation. |
| P3-T21 | Tinu coordinates; Devadathan operates; all owners inspect domains | Four-hour soak at 20 dynamic rps with bounded jobs/AI/video; no connection/memory/lease leak, unexplained growth or missed accepted workflow deadline. |
| P3-T22 | Tinu coordinates; Devadathan; Mathew/Josin query review | Minimum-compute/cold-cache/autoscaling ramp, CPU/cache/pool/locks/query round trips and client locations recorded; tune/resize if gates fail rather than assuming warm enlarged compute proves minimum capacity. |
| P3-T23 | Tinu coordinates; Devadathan/Mathew; Josin reconciles | Marketing/campaign backlog plus queue crashes/redeliveries/outbox publish uncertainty; financial/clinical work retains bounded progress, deadline/version/consent suppression and safe DLQ recovery. |
| P3-T24 | Tinu coordinates; Devadathan/Mathew/Josin | Provider/network/database interruptions fail closed for authoritative confirmations, uncertain results reconcile by stable operation ID and direct workflows survive model outage. |
| P3-T25 | Tinu coordinates; Devadathan operates; Mathew/Josin validate | Restore within the configured history to isolated validation/cutover; recovery point objective ≤15 minutes and full restore/validation/resume objective ≤2 h demonstrated on the tested data. |
| P3-T26 | Tinu coordinates; Devadathan; Mathew/Josin and company recovery owner | Independent encrypted dump decryption/pg_restore, roles/extensions/RLS/object hashes/manifests and provider/booking/stock/job/credit control totals pass; record up-to-24 h independent-backup recovery point separately. |
| P3-T27 | Tinu coordinates; Devadathan operates; Mathew/Josin reconcile | Prior Worker/web version works with additive schema; measured rollback objective ≤15 minutes; mobile compatibility and provider reconciliation retained. |
| P3-T28 | Tinu coordinates; Devadathan/domain owners; Denzil assets; Tinu checks | Real alert receipt/redaction, credential/recovery ownership, incident/stop/escalation rota and cost dashboard work; company training recordings/guides match the final app. |
| P3-T29 | Tinu coordinates; Tinu coordinates; Mathew/Devadathan/company approve | All R01–R38 signed final acceptance, no blocker/invalid evidence, actual public/store/provider readiness and exact-candidate Go/No-go record before rollout. |
| P3-T30 | Tinu coordinates; All six with company owners; Devadathan operates | Safe postdeployment web/native/WhatsApp purchase/booking/consultation/tool/job checks, control totals and observation pass; final ownership/handover and G3 closure recorded. |

## 10. Execution design: load, failure, security and recovery

### 10.1 Performance and user experience

Use 65% catalogue/product reads, 15% account/order/tracking, 10% cart/availability, 5% checkout writes and 5% booking writes. Record cached/static traffic separately. Validate customer-facing success/conflict/pending results, not only HTTP status. Initial tuning objective is core in-database transaction p95 below 100 ms excluding transport, with no sustained pool/lock backlog. Public key-page mobile LCP target is below 2.5 seconds on representative Indian networks; representative nonclinical first useful assistant output p95 below five seconds while medical blocks wait for checks. Report provider latency separately and perform actual bounded provider/AI/media tests in addition to high-volume controlled adapters.

Day 8 plan: execute sustained/burst runs, launch the four-hour automated soak with live alerts, and run recovery against an isolated target while domain engineers verify invariants/UAT. Elapsed automation time and attended engineer time are different: the soak does not require six people idle for four hours, but active monitoring/analysis is counted in V. Do not corrupt/restore the database serving a claimed steady-state soak. Label deliberate failure windows separately from healthy-load metrics. If a fix invalidates the run, repeat the relevant run and reforecast if time is insufficient.

The 1,000-DAU baseline is not 1,000 simultaneous users. A 3,000-account fixture and declared peak tests form a planning envelope, not an unmeasured guarantee. Provider rate limits, cost and network quality remain recorded assumptions.

### Protected measurement windows and fault-test isolation

Devadathan and Tinu publish a run-window/resource manifest before G3: target database/compute/Worker/queue/object IDs, candidate/config, dataset/reset ownership, operator/observer, provider mode and expected cost. Keep sustained/burst baseline and four-hour soak protected from unrelated deployments, seed resets, time travel, destructive fault injection, restore/cutover, scanner storms and ad hoc queries. Bounded jobs/AI/video are included only as declared workload; scheduled backup/report work is explicitly included or separately measured.

Run recovery/rollback/provider-fault/security mutation campaigns on separately verified isolated targets with independent resource contention boundaries, or serialize them after baseline/soak. A separate logical schema alone is not independent compute. Verify endpoints/queue/provider modes before each drill; never restore or fault the active measured candidate. Record cooldown/warmup and before/after correctness controls. No full load test is aimed at live payment/messaging/video providers.

The Day 8 plan is a dependency/window plan, not permission for one senior to operate several simultaneous destructive tests. Allocate actual operator/reviewer time inside the named hours; automation may run in the background with assigned observation. If target isolation, elapsed windows, staffed time or metered temporary resources do not fit, serialize/reforecast and update measured usage/cost rather than accepting confounded metrics or hidden overtime.

### 10.2 Security/clinical/device review

Run authenticated staged code/dependency/secret/config and risk-based dynamic/manual checks for every role/channel/tool; include object IDs, price/role tampering, replay/CSRF/session/cookie/CORS, private files/cache/export, pool context and native links/bundles. Peer review critical money/clinical/access fixes. Scanners and coverage numbers do not establish absence of every vulnerability.

Physicians/language reviewers approve expected clinical outcomes, unsupported-language fallback and urgent escalation. Preserve source/model/prompt/translation/KB versions. Repeat critical nondeterministic cases and test changes of identity/consent/current state between proposal and confirmation. Device evidence identifies binary/OS/network and permission paths; a simulator, internal distribution or web-only call does not prove native public delivery.

### 10.3 Recovery and rollback

Verify seven-day paid history plus independent nightly encrypted dumps retaining seven daily/four weekly copies subject to approved policy, and immutable private/source R2 versions/manifests. Runner/key access is company-owned and separate from the API runtime. Test restore with role grants/RLS, btree_gist and private object bytes; record start/end/checkpoints/control totals and endpoint/secret cutover. Native releases retain compatible APIs; code rollback cannot reverse real payments/shipments/notifications.

Independent nightly export has up to 24-hour recovery point; cross-provider recovery time is measured separately and is not assumed equal to the two-hour in-provider objective. Reconcile charges/refunds/mandates/shipments/stock/booking/credits/outbox after restoration and suppress obsolete reminders. A restored database with unverified real-world balances does not pass.

## 11. Gate G3, deployment sequence and company handover

### 11.1 Prelaunch Go/No-go

Before rollout, Mathew/Devadathan and company product, physician and finance/operations owners review exact candidate, all required tests/metrics/recovery evidence, residual issues, clinical/privacy/finance decisions and all 38 acceptance clauses. No unresolved critical/high vulnerability, P0/P1 or requirement-blocking P2 remains. All scanners/findings and failed/blocked tests are triaged with valid fix/retest. Store apps and required merchant/listing/templates/methods are approved/active; submission or conditional account support does not count.

### 11.2 Controlled release and rollback triggers

1. Reconfirm immutable backup/checkpoint, additive migration/compatibility, current production settings, secret access and named incident/rollback contacts.
2. Deploy approved migrations/backend/web artifacts with exact hashes. Do not run destructive schema changes during launch. Verify internal health/roles/queues and safe company test accounts.
3. Complete minimal authorized live purchase/refund/booking/consultation and required channel checks; compare provider/ledger/stock/appointment/outbox state. No bulk load, campaign spam or destructive security test in production.
4. Coordinate actual public web/WhatsApp and both approved native releases; verify download/install, feature availability, payment returns/private calls and authenticated links. All customer requirements remain available.
5. Observe initial operating metrics for at least 60 minutes on Day 10: errors/p95/pool/locks, job ages/deadlines, invariant/control totals and real provider delivery/reconciliation. Low traffic limits this evidence; capacity comes from prior tests.
6. Stop/widening or roll back on any unauthorized record exposure, unsafe medical response, duplicate charge/booking, oversold stock, broken critical journey, unexplained ledger divergence, unavailable required channel or sustained breach of tested latency/error/job objectives. Preserve audit/data, contain and reconcile with the incident owners. A rollback or unresolved required-channel failure leaves Phase 3 incomplete.

### 11.3 Final operating handover

Hand over company-owned source/licenses/builds/config/schema/roles/service and billing accounts; restricted credential/encryption recovery; all R01–R38 acceptance and build/test/scan/clinical/device/performance/recovery reports; recorded finance/warehouse/front-desk/doctor/support/content/admin training; opening-data balances and provider approvals; operational/reconciliation/content-review/retention/backup/rollback/incident/on-call guides; actual measured usage/cost forecast and permitted minor-issue owners/dates.

Close G3 only after prelaunch Go and safe postdeployment checks, publicly installed Android/iOS, working web/WhatsApp/workspaces and company handover. A required approval or safety/capacity/recovery gap on Day 10 is No-go/Rework with explicit R IDs and revised forecast. The weekend is support for delivered operations, not hidden feature-build time.


## 12. Evidence, defect handling and Gate G3 decision

Every task includes reviewed changes/configuration, schema compatibility, positive and negative cases, integrated UI/provider behavior, redacted telemetry and evidence against its R/output IDs. Source packages use the agreed modular repository; no extra independently operated backend is introduced. Suggested evidence organization is `artifacts/P3/<candidate>/`, with restricted access and no unnecessary patient/secrets content. These are proposed repository artifact paths, not files already generated by this planning exercise.

The gate report records commit/web/API/native builds, schema/config, model/prompt/KB versions, database compute/pool, dataset/devices/networks/provider modes, planned/executed/passed/failed/blocked tests, scans/manual findings, control totals, resource/recovery results, defects/fixes/retests, company reviews and external approvals. Initial state is Pending. Preserve failed runs and append retest results rather than rewriting history.

P0/Critical and P1/High issues stop acceptance. P2/Medium blocks if it violates a requirement, safety/privacy/money/access invariant or a due performance/recovery gate; other limited-impact issues require documented company acceptance, owner and fix date. P3/Low may remain only if genuinely nonblocking. All scan alerts are triaged; a false positive needs evidence. No confirmed critical/high vulnerability is waived to meet the calendar.

A fix creates a new candidate: reproduce the defect, independently review, run the reproducing/affected tests and cumulative critical suite, then rerun load/recovery/native/clinical tests where the change invalidates them. Do not blindly repeat unrelated long tests after a cosmetic edit, and do not reuse invalid evidence after a transaction/security/config change. No untested patch reaches public users.

Tinu assembles evidence, domain owners validate their work, and Mathew/Devadathan record the technical recommendation and company reviewers accept their domains. The decision is Pass or Rework; final public-release Go/No-go and safe postdeployment closure belong to G3. If blockers/approvals/effort prevent the gate, keep the full company scope and publish the revised forecast. No additional engineers, weekend construction or hidden overtime are assumed.

## 13. Company requirement coverage and acceptance trace

The company requirement and updated acceptance text below is synchronized with the reviewed master. Its readiness milestone distinguishes Phase 2 functional testing from Phase 3 final company/public/operational acceptance; full launch wording is not a claim of public delivery at G2. Package links identify implementation/verification responsibility; the master accountable workstream remains responsible even where another engineer supplies evidence.

| Requirement / company source | Original acceptance evidence | Accountable workstream | Master readiness milestone | Phase work-package coverage |
|---|---|---|---|---|
| R01 — Catalogue and shop by health concern; E4-5, C4 | All current-site products imported with variants, approved descriptions, images, prices, concern filters and stock visibility. Brand/certification claims approved by the clinic. | Josin | P2 functional; P3 company acceptance | P3-MAT-001, P3-JOS-090, P3-DEV-002, P3-DEV-090, P3-PAU-001, P3-PAU-090, P3-DEN-001, P3-DEN-090, P3-TIN-090 |
| R02 — Cart and Indian checkout; E3-4, C4 | Web and native purchase through enabled UPI/card/net-banking/eligible EMI methods; COD rules enforced server-side; totals cannot be altered by clients. | Josin | P2 functional; P3 company acceptance | P3-MAT-002, P3-JOS-001, P3-JOS-002, P3-JOS-090, P3-DEV-001, P3-DEV-002, P3-DEV-090, P3-PAU-002, P3-PAU-090, P3-TIN-001, P3-TIN-090 |
| R03 — Accounts, addresses, history, reorder, tracking; E3, C4 | Verified user sees only their orders/invoices; repeat order uses current price, eligibility and available stock; tracking updates visible. | Mathew + Josin | P2 functional; P3 company acceptance | P3-MAT-001, P3-JOS-090, P3-DEV-002, P3-DEV-090, P3-PAU-001, P3-PAU-002, P3-PAU-090, P3-DEN-001, P3-DEN-090, P3-TIN-090 |
| R04 — Unified order desk including phone/walk-in/WhatsApp; E6, C6 | Staff create and fulfill an order with a recorded source; WhatsApp checkout produces the same order record; packing lists and cancellation/return/refund states are usable. | Josin | P2 functional; P3 company acceptance | P3-JOS-001, P3-JOS-090, P3-DEV-002, P3-DEV-090, P3-PAU-001, P3-PAU-090, P3-DEN-001, P3-DEN-090, P3-TIN-090 |
| R05 — Batch/expiry, low stock and near-expiry operations; E6, C6 | Batch ledger, expiry/shelf-life exclusion, FEFO allocation, low-stock alerts, adjustments and a recall lookup from batch to customers. Concurrent last-unit test passes. | Josin | P2 functional; P3 company acceptance | P3-MAT-002, P3-JOS-001, P3-JOS-090, P3-DEV-001, P3-TIN-001, P3-TIN-090 |
| R06 — Courier and pan-India fulfillment; E6-7 | Pincode serviceability, rates, courier label, pickup, tracking and COD reconciliation tested with the selected courier. Unserviceable addresses cannot check out. | Josin | P2 functional; P3 company acceptance | P3-JOS-001, P3-JOS-002, P3-JOS-090, P3-TIN-090 |
| R07 — GST invoices, reconciliation and accounts export; E3, E6, C6 | Finance-approved CGST/SGST/IGST cases, numbering, PDF/translated display labels, refund credit-note process and monthly CSV export; a live charge/refund is reconciled. Issued invoices are automatically delivered through an approved private transactional link/document and delivery is reconciled, not merely generated. | Josin | P2 functional; P3 company acceptance | P3-MAT-002, P3-JOS-001, P3-JOS-002, P3-JOS-090, P3-DEV-002, P3-DEV-090, P3-PAU-001, P3-PAU-090, P3-DEN-001, P3-DEN-090, P3-TIN-090 |
| R08 — Automated WhatsApp/SMS order updates; E3-4 | Confirmation, dispatch, out-for-delivery and delivery messages use real events/tracking links, approved templates and deduplication. Transactional invoice-ready delivery follows the finance-approved issuance milestone with receipt/retry/ownership evidence. | Mathew | P2 functional; P3 company acceptance | P3-MAT-002, P3-MAT-090, P3-JOS-002, P3-DEN-001, P3-DEN-090, P3-TIN-090 |
| R09 — Recurring subscriptions; E4, E7, C4 | Authorize a real eligible mandate; cycle billing, exactly one renewal order, payment failure, pause/resume/cancel and stock-shortage handling verified. An accelerated sandbox renewal exercises the full cycle. | Josin | P2 functional; P3 company acceptance | P3-MAT-002, P3-JOS-001, P3-JOS-002, P3-JOS-090, P3-DEV-090, P3-PAU-090, P3-DEN-001, P3-TIN-090 |
| R10 — Refill and daily medicine schedules; E4, C4 | Physician-authored dose, morning/evening and before/after-food instructions drive timezone-aware reminders; refill quantity/due date uses the approved schedule or confirmed customer interval; edits/cancellation stop stale reminders. | Mathew | P2 functional; P3 company acceptance | P3-MAT-001, P3-MAT-002, P3-MAT-090, P3-DEV-001, P3-DEV-002, P3-DEV-090, P3-PAU-002, P3-PAU-090, P3-DEN-001, P3-DEN-090, P3-TIN-090 |
| R11 — Physician directory, locations, slots, leave and fees; C4, C6 | Staff configure departments, credentials, languages, per-location hours, online/in-clinic slots, leave and default/per-doctor fees. Cross-location double booking is prevented. Authorized front desk can create source/actor-audited in-clinic outpatient bookings through the same doctor-global booking service; doctor qualifications/photo, slot length and online/in-clinic/both settings are included. | Mathew | P2 functional; P3 company acceptance | P3-MAT-001, P3-MAT-090, P3-DEV-090, P3-PAU-090, P3-TIN-090 |
| R12 — Booking, fee payment, reschedule/cancel/refund; E4, C4 | One slot cannot be sold twice; holds expire; late payment is reconciled; notifications and policy-based refunds work. Staff-created outpatient appointments obey the same interval, fee, hold/payment, cancellation and refund invariants as customer bookings. | Mathew + Josin | P2 functional; P3 company acceptance | P3-MAT-001, P3-MAT-002, P3-MAT-090, P3-JOS-002, P3-JOS-090, P3-DEV-001, P3-DEV-002, P3-DEV-090, P3-PAU-002, P3-PAU-090, P3-TIN-001, P3-TIN-090 |
| R13 — Embedded video consultations; C4 | Patient and assigned doctor join a private call inside web/native apps; permissions, poor network, reconnect and unauthorized joining are tested. | Devadathan + Mathew | P2 functional; P3 company acceptance | P3-DEV-002, P3-DEV-090, P3-PAU-002, P3-PAU-090, P3-TIN-090 |
| R14 — Physician panel and linked patient record; E6, E8, C6 | Doctor sees assigned consultations, permitted history and consented chat summary; records identity/consent, notes and recommendations with an audit trail. Assigned physicians see policy-permitted patient past orders; recorded identity/required consultation consent is enforced before private consultation access. | Mathew | P2 functional; P3 company acceptance | P3-MAT-001, P3-MAT-090, P3-DEV-002, P3-DEV-090, P3-PAU-001, P3-PAU-090, P3-DEN-001, P3-DEN-090, P3-TIN-090 |
| R15 — Consult-to-cart; E4, C3-4 | Signed physician recommendation becomes an editable patient basket; consult-only products require a valid matching recommendation; dosage remains unchanged by the assistant. | Mathew + Josin | P2 functional; P3 company acceptance | P3-MAT-001, P3-MAT-002, P3-MAT-090, P3-DEV-090, P3-PAU-090, P3-TIN-090 |
| R16 — Approved knowledge-base editor; C4, C6 | Product monographs, departments/treatments, FAQs, policies and selected Ayurveda references support draft, named approval, version history, withdrawal and reviewed dosage/safety translations. All published catalogue products have required approved monographs and launch-language safety blocks by G2, with approved public physician profiles among the knowledge types; content reviewers see reconciled most-used-entry/version analytics and measured edit/withdrawal freshness. | Mathew | P2 functional; P3 company acceptance | P3-MAT-001, P3-MAT-090, P3-DEV-002, P3-DEV-090, P3-PAU-001, P3-PAU-090, P3-DEN-001, P3-DEN-002, P3-DEN-090, P3-TIN-090 |
| R17 — Grounded, cited Companion; C3-4, C7 | Responses trace to currently approved entries and approving physician; missing/stale/unsupported medical knowledge produces an approved handoff response. | Mathew | P2 functional; P3 company acceptance | P3-MAT-001, P3-MAT-090, P3-DEV-002, P3-DEV-090, P3-PAU-002, P3-PAU-090, P3-DEN-090, P3-TIN-090 |
| R18 — Conversational product/order/refill/slot actions; C3-4 | Authenticated tools retrieve authorized records; add-to-cart, booking and payment steps require an explicit customer confirmation and display real current state. | Mathew | P2 functional; P3 company acceptance | P3-MAT-001, P3-MAT-002, P3-MAT-090, P3-DEV-090, P3-PAU-090, P3-DEN-090, P3-TIN-090 |
| R19 — Red flags, consult-only rules and disclaimers; C5, C7 | Physician test pack passes emergency/high-risk escalation; no diagnosis/cure promise; required disclaimer and named approval appear. No automated sale is initiated from a flagged conversation. Physician-approved minimal intake covers age/current medication and pregnancy/child/red-flag routing before personalized medical recommendation; unknown required data is clarified or handed off, never guessed. | Mathew | P2 functional; P3 company acceptance | P3-MAT-001, P3-MAT-090, P3-DEV-090, P3-PAU-090, P3-DEN-090, P3-TIN-090 |
| R20 — Human handoff, callback and conversation review; C3, C6-7 | Staff take over an active chat with summary; assistant pauses; after-hours callback queues, WhatsApp acknowledgement, unanswered-question queue and resolution reporting work. | Mathew | P2 functional; P3 company acceptance | P3-MAT-001, P3-MAT-002, P3-MAT-090, P3-DEV-002, P3-DEV-090, P3-PAU-001, P3-PAU-090, P3-DEN-001, P3-DEN-090, P3-TIN-090 |
| R21 — Same assistant on WhatsApp; C3-5, C8 | Real clinic number supports text/voice input, safe product actions, identity-linked order lookup, booking and a secure Razorpay checkout flow from the conversation. Staff can reply through the console. | Mathew | P2 functional; P3 company acceptance | P3-MAT-002, P3-MAT-090, P3-DEV-002, P3-PAU-002, P3-DEN-001, P3-DEN-090, P3-TIN-090 |
| R22 — English, Malayalam and Tamil application; C4 | Store, native app, menus, checkout, invoice labels and notifications have reviewed translations, usable fonts and no missing keys; medical wording is physician-reviewed. | Devadathan | P2 functional; P3 company acceptance | P3-MAT-001, P3-MAT-090, P3-DEV-002, P3-DEV-090, P3-PAU-001, P3-PAU-002, P3-PAU-090, P3-DEN-001, P3-DEN-090, P3-TIN-090 |
| R23 — Other Indian-language and Romanized conversations; C4 | Evaluate Hindi/Kannada/Telugu plus launch languages and representative Romanized inputs; preserve approved clinical text and fall back safely when a translation cannot be verified. | Mathew | P2 functional; P3 company acceptance | P3-MAT-001, P3-MAT-090, P3-DEV-090, P3-PAU-090, P3-DEN-090, P3-TIN-090 |
| R24 — Voice input; C4, C8 | Web/mobile microphone and WhatsApp voice messages transcribe into editable/reviewable text; permission denial and ambiguous numbers/units are handled. No action is triggered directly from an unchecked transcript. | Devadathan + Mathew | P2 functional; P3 company acceptance | P3-MAT-001, P3-MAT-090, P3-DEV-002, P3-DEV-090, P3-PAU-002, P3-PAU-090, P3-DEN-090, P3-TIN-090 |
| R25 — Complete Android and iOS customer apps; E8, C8 | Both production apps include store, checkout, assistant, booking/video, reminders, subscriptions, history, loyalty and referrals; signed, reviewed, publicly obtainable releases. | Devadathan | P2 complete builds; P3 public store releases | P3-MAT-080, P3-JOS-080, P3-DEV-001, P3-DEV-002, P3-DEV-090, P3-DEV-080, P3-PAU-002, P3-PAU-090, P3-PAU-080, P3-DEN-080, P3-TIN-090, P3-TIN-080 |
| R26 — Bundles and discounted courses; E7 | Approved product kits/course prices calculate consistently across channels and cannot bypass consult-only or stock restrictions. | Josin | P2 functional; P3 company acceptance | P3-JOS-001, P3-JOS-090, P3-DEV-090, P3-PAU-090, P3-TIN-090 |
| R27 — Opt-in WhatsApp campaigns and segments; E3, E7 | Staff send/schedule an approved template to a consented segment; opt-outs, quotas, delivery results and purchase attribution are visible. Health-interest segmentation requires explicit business/privacy approval. New-product, restock and seasonal campaigns work for consented prior-purchase segments, with current opt-out/quotas and no unauthorized clinical audience inference. | Mathew | P2 functional; P3 company acceptance | P3-MAT-002, P3-MAT-090, P3-DEV-090, P3-PAU-090, P3-DEN-001, P3-DEN-002, P3-DEN-090, P3-TIN-090 |
| R28 — Seasonal offers and landing pages; E7 | Staff publish/schedule a branded campaign page and valid promotion; start/end times and redemption limits are enforced; the first clinic-approved campaign is configured for launch. | Josin + Mathew | P2 functional; P3 company acceptance | P3-MAT-002, P3-DEV-002, P3-DEV-090, P3-PAU-001, P3-PAU-090, P3-DEN-001, P3-DEN-002, P3-DEN-090, P3-TIN-090 |
| R29 — Abandoned-cart recovery; E7 | Eligible consented cart receives one scheduled reminder after the approved delay; completed/cancelled carts and unsubscribed users are suppressed; recovery link is scoped and expiring. | Mathew | P2 functional; P3 company acceptance | P3-MAT-002, P3-MAT-090, P3-DEV-090, P3-PAU-090, P3-DEN-001, P3-DEN-002, P3-DEN-090, P3-TIN-090 |
| R30 — Verified-buyer reviews and physician content; E7 | Review eligibility checks completed purchase; moderation and publication controls work; approved physician notes are visible beside products. | Josin + Mathew | P2 functional; P3 company acceptance | P3-DEV-002, P3-DEV-090, P3-PAU-001, P3-PAU-090, P3-DEN-001, P3-DEN-002, P3-DEN-090, P3-TIN-090 |
| R31 — Referrals and loyalty; E7, C8 | Share link, eligible first-order credit, points/credit ledger, redemption caps, refund reversal and basic self-referral/fraud prevention pass. | Josin | P2 functional; P3 company acceptance | P3-JOS-001, P3-JOS-002, P3-JOS-090, P3-DEV-002, P3-DEV-090, P3-PAU-002, P3-PAU-090, P3-DEN-090, P3-TIN-090 |
| R32 — Multiple clinics; E8 | Location-specific stock, physician availability, staff access and sales reports work for two configured clinics; inter-location stock moves retain batch traceability. | Mathew + Josin | P2 functional; P3 company acceptance | P3-MAT-001, P3-MAT-090, P3-TIN-090 |
| R33 — Wholesale/distributor ordering; E8 | Approved business account sees assigned price list, MOQ/pack size and permitted payment terms; account approval, fulfillment and GST records are auditable. | Josin | P2 functional; P3 company acceptance | P3-JOS-001, P3-JOS-090, P3-DEV-002, P3-DEV-090, P3-PAU-001, P3-PAU-090, P3-DEN-001, P3-DEN-090, P3-TIN-090 |
| R34 — SEO and shopping/business listings; E3, E7 | Product schema, canonical URLs, language alternates, sitemap, redirects and merchant product feed validate; company listing linkage is configured. Required merchant/feed approvals are recorded; approval pending is distinguished from a working feed and remains an open launch requirement. | Devadathan | P2 validated feeds/pages; P3 required listing approvals | P3-DEV-090, P3-PAU-090, P3-DEN-002, P3-DEN-090, P3-TIN-090 |
| R35 — Sales, retention and clinical conversion reports; E6-7, C6, C8 | Product/concern/city/clinic sales, repeat rate, refill due/lapsed, subscription state, conversation-to-cart/order/booking/handoff, and consultation-to-order metrics reconcile to operational records. Permissioned content reports also show defined, deduplicated knowledge-entry/version answer-usage counts without raw health prompts. | Josin + Mathew | P2 functional; P3 company acceptance | P3-MAT-002, P3-MAT-090, P3-JOS-002, P3-JOS-090, P3-DEV-002, P3-DEV-090, P3-PAU-001, P3-PAU-090, P3-DEN-001, P3-DEN-002, P3-DEN-090, P3-TIN-090 |
| R36 — Roles, privacy, audit and ownership; C6-7 | Per-role and per-record tests pass; sensitive actions are logged; accounts, source, data and deployment access belong to the company; consent/retention workflows operate. Versioned required sign-up/privacy consent remains distinct from optional marketing consent; per-consultation identity/consent and private access are enforced. | Mathew + Devadathan | P2 functional; P3 company acceptance | P3-MAT-001, P3-MAT-002, P3-MAT-090, P3-MAT-080, P3-MAT-099, P3-JOS-080, P3-JOS-099, P3-DEV-001, P3-DEV-002, P3-DEV-090, P3-DEV-080, P3-DEV-099, P3-PAU-002, P3-PAU-090, P3-PAU-080, P3-PAU-099, P3-DEN-080, P3-DEN-099, P3-TIN-001, P3-TIN-090, P3-TIN-080, P3-TIN-099 |
| R37 — Onboarding and recorded training; C8 | Front desk, warehouse, finance and physicians each complete role-specific scenarios; recordings, guides, access recovery and incident contacts are handed over. | Devadathan + domain owners | P2 guide drafts; P3 recorded training/acceptance | P3-MAT-080, P3-JOS-080, P3-DEV-090, P3-DEV-080, P3-PAU-090, P3-PAU-080, P3-DEN-002, P3-DEN-090, P3-DEN-080, P3-TIN-090, P3-TIN-080 |
| R38 — Production operations and maintenance readiness; E6, C8 | Monitoring, backups, tested restore, release/rollback, payment reconciliation, escalation ownership and scheduled content-review procedures are operating. Handover explicitly includes monthly physician flagged-conversation review, quarterly operating reports, security/app-release/priority-fix workflow, proposed eight-hour monthly knowledge-update allowance and agreed overflow; healthy due-job pickup p95 <2 minutes and a defined 99.9% rolling-month internal availability objective are measured/configured, not claimed as prelaunch achieved SLA. | Devadathan | P1 foundations; P2 integrated controls; P3 recovery/operations proof | P3-MAT-002, P3-MAT-090, P3-MAT-080, P3-MAT-099, P3-JOS-002, P3-JOS-090, P3-JOS-080, P3-JOS-099, P3-DEV-001, P3-DEV-090, P3-DEV-080, P3-DEV-099, P3-PAU-080, P3-PAU-099, P3-DEN-001, P3-DEN-090, P3-DEN-080, P3-DEN-099, P3-TIN-001, P3-TIN-090, P3-TIN-080, P3-TIN-099 |

## 14. Completion and handoff checklist

- [ ] Every due phase output and work package has reviewed integration evidence and reconciled hours/dependencies.
- [ ] All current/due mandatory functional, negative-security, clinical, device and resilience tests have executed and passed.
- [ ] No unresolved blocker or untriaged finding remains; fixes identify the tested candidate and independent retest.
- [ ] Requirement statuses distinguish implemented/integrated/tested/company-accepted/publicly-verified and expose external dependencies.
- [ ] Environment/data/provider modes, actual resource usage and cost/approval risks are recorded.
- [ ] Company reviewers accept their due milestones; G3 report and decision are stored with exact artifacts.
- [ ] Next-phase inputs or final handover are complete; no required feature is silently deferred or disabled.

**Document boundary:** This is the detailed Phase 3 execution plan. Member execution documents will repeat these assigned IDs, inputs, deliverables and checks across all phases; they will not alter this gate, architecture, scope or capacity.
