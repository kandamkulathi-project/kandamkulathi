# Kandamkulathi Digital Commerce & Companion

> **Named team allocation update — 19 October 2026:** The six individual plans numbered 05–10 now govern named ownership, branches and person-hour allocation. Mathew owns backend/AI and critical domain review; Devadathan owns frontend/mobile/platform/release; Josin owns commerce with Mathew’s review; Paul and Denzil own bounded support/UI/content work; Tinu leads QA with no critical product feature assignment. Original E1–E6 IDs below remain technical scope references, not a direct mapping to these people. The previous per-E-role ownership/hour/day grids are superseded by the named plans. All R01–R38 acceptance criteria, phase outputs, 10-day window, protected test gates and overall phase hour/category totals remain unchanged. See [the named team plans](Kandamkulathi_05_Mathew_All_Phases.md) and [Tinu’s standalone detailed test cases](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md).

## Document 03 — Phase 2: Complete Features and Integrated Application

| Document control | Baseline |
|---|---|
| ID / version / prepared | KND-PH2-003 / 1.0 / 19 October 2026 |
| Governing document | [Kandamkulathi_01_Master_Implementation_Plan_3_Phases.md](Kandamkulathi_01_Master_Implementation_Plan_3_Phases.md) |
| Window | Days 4–6 · 22, 23 and 26 October 2026 |
| Team capacity | Six engineers × 3 working days = 18 person-days / 144 planning hours |
| Gate | G2 — cumulative tests of the entire currently implemented app; no unresolved blockers |
| Fixed architecture | Workers Paid + Neon PostgreSQL 17, WorkOS, R2, Vectorize, Queues/Cron, Durable Objects/WebRTC/TURN and the agreed provider integrations |
| Status | Planned. Work packages, tests, provider approvals and gate results are pending; this document claims no completed implementation. |

## 1. Objective, boundaries and planning conditions

Complete every required application feature across web, Android/iOS, WhatsApp and workspaces, prove functional integration and pass the full cumulative G2 gate. Training completion/public approvals/final operational certification remain Phase 3.

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
| P2-O01 | Commerce, accounts and operations | R01–R09 and R26: complete catalogue/concern browsing, native/web checkout and COD, accounts/history/reorder/tracking, unified staff/WhatsApp orders, FEFO/expiry/recall, shipping/COD settlement, GST/credit notes/export, order messages, true mandate renewals and bundles/courses. |
| P2-O02 | Clinical and multiclinic | R10–R15 and R32: dose/refill schedules, directory/location fees/hours/leave, paid/rescheduled/refunded bookings, private video, assigned-patient physician workspace/consent/notes, signed consult-to-cart and two-clinic operations. |
| P2-O03 | Companion and communication | R16–R24: KB approval/withdrawal/translations, cited current retrieval, authorized confirmed actions, red flags/consult-only/disclaimers, live handoff/callback/review, real WhatsApp text/voice flow, three-language UI and safe additional-language/Romanized handling. |
| P2-O04 | Native parity | R25: Android/iOS complete customer flows for store, checkout, AI, booking/video, reminders, subscriptions, history, loyalty and referrals; signed complete candidate builds and real-device regression. Public store releases occur in Phase 3. |
| P2-O05 | Growth, wholesale and reporting | R27–R31 and R33–R35: opted-in segmented campaigns, seasonal pages/promotions, abandoned-cart suppression, moderated verified reviews/physician content, referral/loyalty reversal, distributor terms/MOQ/prices, SEO/feeds/listing configuration and reconciled reports. |
| P2-O06 | Security, operations and handover preparation | R36–R38: complete role/record restrictions, protected audit, retention/consent/deletion/export handling, monitors/alerts/recovery configuration, draft runbooks, role training materials and production data-validation tools. |
| P2-O07 | Integrated release and evidence | All required features integrated in web/native/WhatsApp and staff workspaces; complete R01–R38 tracker with evidence level, external approvals and company acceptance status; Gate G2 report. |

## 4. Capacity and exact work-package register

The named register below is authoritative for execution, branches and exclusive capacity. B = implementation/QA preparation, V = verification, E = environment/handover, C = conditional reserve. Old E1–E6 IDs in section 7 are retained unbudgeted **technical references**, not six additional people or a second schedule.

| Person | B h | V h | E h | C h | Total h |
|---|---:|---:|---:|---:|---:|
| Mathew | 18 | 4 | 0 | 2 | 24 |
| Josin | 18 | 4 | 0 | 2 | 24 |
| Devadathan | 18 | 4 | 0 | 2 | 24 |
| Paul | 17 | 4 | 1 | 2 | 24 |
| Denzil | 17 | 4 | 1 | 2 | 24 |
| Tinu | 8 | 12 | 2 | 2 | 24 |
| **Total** | **96** | **32** | **4** | **12** | **144** |

| Named package | Owner | Category | Hours | Exact branch from `dev`; PR to `dev` | Source technical references |
|---|---|---|---:|---|---|
| P2-MAT-001 — Clinical records, scheduling and physician reminders | Mathew | B | 5 | `feature/p2-mathew-clinical-lifecycle` | P2-E1-001, P2-E1-002, P2-E1-003 |
| P2-MAT-002 — Complete multilingual safe assistant and typed actions | Mathew | B | 5 | `feature/p2-mathew-safe-rag-tools` | P2-E5-001, P2-E5-004 |
| P2-MAT-003 — WhatsApp, voice and staff handoff backend | Mathew | B | 3 | `feature/p2-mathew-whatsapp-handoff` | P2-E5-003 |
| P2-MAT-004 — Reliable financial/clinical/engagement handlers | Mathew | B | 2 | `feature/p2-mathew-engagement-job-handlers` | P2-E5-002, P2-E6-002 |
| P2-MAT-005 — Complete authorization and financial/clinical peer review | Mathew | B | 3 | `feature/p2-mathew-critical-review-rls` | P2-E1-004, P2-E6-001, P2-E2-002, P2-E2-003 |
| P2-MAT-090 — G2 verification and cumulative regression | Mathew | V | 4 | `test/p2-mathew-g2-verification` | P2-E1-090, P2-E5-090 |
| P2-MAT-099 — Protected defect/retest reserve | Mathew | C | 2 | `fix/p2-mathew-bug-001` | P2-E1-099, P2-E5-099 |
| P2-JOS-001 — Fulfillment, returns, batches and GST | Josin | B | 4 | `feature/p2-josin-fulfillment-gst` | P2-E2-001 |
| P2-JOS-002 — Real recurring subscriptions and renewals | Josin | B | 4 | `feature/p2-josin-mandate-subscriptions` | P2-E2-002 |
| P2-JOS-003 — Bundles, distributor terms, loyalty and referrals | Josin | B | 6 | `feature/p2-josin-bundles-wholesale-credits` | P2-E2-003 |
| P2-JOS-004 — Unified orders, reconciliation and report facts | Josin | B | 4 | `feature/p2-josin-orderdesk-report-facts` | P2-E2-004 |
| P2-JOS-090 — G2 verification and cumulative regression | Josin | V | 4 | `test/p2-josin-g2-verification` | P2-E2-090 |
| P2-JOS-099 — Protected defect/retest reserve | Josin | C | 2 | `fix/p2-josin-bug-001` | P2-E2-099 |
| P2-DEV-001 — Sensitive customer/physician/support workspaces | Devadathan | B | 5 | `feature/p2-devadathan-clinical-sensitive-workspaces` | P2-E3-001, P2-E3-002 |
| P2-DEV-002 — Native private video, voice, push and deep links | Devadathan | B | 5 | `feature/p2-devadathan-native-realtime-sdks` | P2-E4-002, P2-E4-003 |
| P2-DEV-003 — Platform reliability and Day 7 paid readiness | Devadathan | B | 4 | `feature/p2-devadathan-platform-release-readiness` | P2-E6-001, P2-E6-002, P2-E6-003 |
| P2-DEV-004 — Full web/native integration and security review | Devadathan | B | 4 | `feature/p2-devadathan-full-client-integration` | P2-E4-001, P2-E4-004, P2-E3-004 |
| P2-DEV-090 — G2 verification and cumulative regression | Devadathan | V | 4 | `test/p2-devadathan-g2-verification` | P2-E3-090, P2-E4-090, P2-E6-090 |
| P2-DEV-099 — Protected defect/retest reserve | Devadathan | C | 2 | `fix/p2-devadathan-bug-001` | P2-E3-099, P2-E4-099, P2-E6-099 |
| P2-PAU-001 — Complete customer shopping/account/booking UI | Paul | B | 5 | `feature/p2-paul-complete-customer-journeys` | P2-E3-001, P2-E4-001, P2-E4-002 |
| P2-PAU-002 — Subscription, referral, loyalty and distributor UI | Paul | B | 5 | `feature/p2-paul-subscription-credit-wholesale-ui` | P2-E3-003, P2-E4-001 |
| P2-PAU-003 — Native feature parity and device journey support | Paul | B | 4 | `feature/p2-paul-device-parity` | P2-E4-001, P2-E4-002, P2-E4-003, P2-E4-004 |
| P2-PAU-004 — Accessibility, locales and failure usability | Paul | B | 3 | `feature/p2-paul-accessible-error-ux` | P2-E3-001, P2-E3-004, P2-E4-004 |
| P2-PAU-090 — G2 verification and cumulative regression | Paul | V | 4 | `test/p2-paul-g2-verification` | P2-E3-090, P2-E4-090 |
| P2-PAU-080 — Environment, acceptance and handover support | Paul | E | 1 | `chore/p2-paul-readiness-handover` |  |
| P2-PAU-099 — Protected defect/retest reserve | Paul | C | 2 | `fix/p2-paul-bug-001` | P2-E3-099, P2-E4-099 |
| P2-DEN-001 — Staff operational screens | Denzil | B | 5 | `feature/p2-denzil-staff-operations-ui` | P2-E3-001, P2-E3-002 |
| P2-DEN-002 — Campaign, promotion, review and content presentation | Denzil | B | 4 | `feature/p2-denzil-growth-review-content` | P2-E3-003, P2-E5-002 |
| P2-DEN-003 — Locales, KB and support UI completion | Denzil | B | 4 | `feature/p2-denzil-locales-knowledge-support` | P2-E3-002, P2-E5-001, P2-E5-003 |
| P2-DEN-004 — SEO/feed, report presentation and training drafts | Denzil | B | 4 | `feature/p2-denzil-seo-reports-guides` | P2-E3-004, P2-E5-004, P2-E6-003 |
| P2-DEN-090 — G2 verification and cumulative regression | Denzil | V | 4 | `test/p2-denzil-g2-verification` | P2-E3-090, P2-E5-090 |
| P2-DEN-080 — Environment, acceptance and handover support | Denzil | E | 1 | `chore/p2-denzil-readiness-handover` |  |
| P2-DEN-099 — Protected defect/retest reserve | Denzil | C | 2 | `fix/p2-denzil-bug-001` | P2-E3-099, P2-E5-099 |
| P2-TIN-001 — Complete all-feature and cumulative case inventory | Tinu | B | 3 | `test/p2-tinu-full-scope-test-cases` | P2-E6-001, P2-E5-004 |
| P2-TIN-002 — Regression automation and defect reproduction | Tinu | B | 3 | `test/p2-tinu-integration-regression` | P2-E6-001 |
| P2-TIN-003 — Misuse, localization and integration test data | Tinu | B | 2 | `test/p2-tinu-misuse-boundary-fixtures` | P2-E5-004, P2-E6-002, P2-E6-003 |
| P2-TIN-090 — G2 verification and cumulative regression | Tinu | V | 12 | `test/p2-tinu-g2-verification` | P2-E1-090, P2-E2-090, P2-E3-090, P2-E4-090, P2-E5-090, P2-E6-090 |
| P2-TIN-080 — Environment, acceptance and handover support | Tinu | E | 2 | `chore/p2-tinu-readiness-handover` | P2-E6-080 |
| P2-TIN-099 — Protected defect/retest reserve | Tinu | C | 2 | `fix/p2-tinu-bug-001` | P2-E1-099, P2-E2-099, P2-E3-099, P2-E4-099, P2-E5-099, P2-E6-099 |

Branch suffix `bug-001` is an issue-ID example; create a fix branch only for an actual defect. Review-only/test-execution work requires evidence, not an empty application branch. Full implementation boundaries, inputs, reviewers and acceptance are in the linked member documents; all phases use the same register.

## 5. Daily sequencing and handoff timing

| Person | Day 4: B/V/E/C hours | Day 5: B/V/E/C hours | Day 6: B/V/E/C hours |
|---|---|---|---|
| Mathew | 8 / 0 / 0 / 0 | 8 / 0 / 0 / 0 | 2 / 4 / 0 / 2 |
| Josin | 8 / 0 / 0 / 0 | 8 / 0 / 0 / 0 | 2 / 4 / 0 / 2 |
| Devadathan | 8 / 0 / 0 / 0 | 8 / 0 / 0 / 0 | 2 / 4 / 0 / 2 |
| Paul | 7 / 0 / 1 / 0 | 8 / 0 / 0 / 0 | 2 / 4 / 0 / 2 |
| Denzil | 7 / 0 / 1 / 0 | 8 / 0 / 0 / 0 | 2 / 4 / 0 / 2 |
| Tinu | 5 / 2 / 1 / 0 | 3 / 4 / 1 / 0 | 0 / 6 / 0 / 2 |

Every cell totals eight hours and each person’s daily categories reconcile to section 4 and their member document. These are capacity slices, not an invented second package allocation; follow each member’s named task order and peer handoffs. Reviews/coordination/meetings are included; reserve is conditional and otherwise supports verification/handover. The final four hours of the last day are V for all six. Tinu has two additional earlier V hours that day; B/C activity belongs earlier, never in the protected final campaign. Automated background runtime may overlap, but staff/operator/reviewer hours cannot be double-booked. If actual effort does not fit, reforecast rather than taking test capacity.

## 6. Full-feature contracts, integration order and provider readiness

### 6.1 Gate entry and publication milestones

G1 must be passed on the inherited candidate, its critical regression must remain green and unresolved future dependencies must be visible. Company opening data/clinical translations/commercial rules and real provider test eligibility are required inputs, not blank fields for developers to invent. Revalidate reuse and remaining effort before accepting the 17-hour feature-build envelopes for Mathew–Mathew; these are adaptation budgets for proven modules.

| Due point | Integrated publication | Providers / consumers |
|---|---|---|
| Start Day 4 | Freeze all Phase 2 schema/API/event/role changes with backward compatibility and shared fixtures | Mathew/Josin/Mathew publish; Devadathan with Paul/Denzil/Devadathan/Devadathan review. Do not wait for finished screens to discover incompatible payloads. |
| Day 4 end | Clinical/operations services and UI connected; shipping/tax/subscription and message workflows exercised against actual provider test contracts | Mathew/Josin/Mathew deliver working increments; Devadathan with Paul/Denzil/Devadathan bind progressively. Interface coding may overlap but final acceptance never relies on a stub. |
| Day 5 end | Complete core Phase 2 APIs, queue handlers and native/web customer features ready for final integration; commercial/metric contracts stable | Mathew/Josin/Mathew supply Devadathan with Paul/Denzil/Devadathan. Day 6 remaining build slices are integration closure/report reconciliation, not a hidden backlog of new required modules. |
| Day 6 first half | Complete signed native/web/API candidate, no missing feature endpoints/UI, full evaluation/translation assets, test/approval register | All six integrate; Devadathan prepares freeze. A missed dependency triggers explicit G2 Rework rather than silent deferral into Phase 3. |
| Day 6 final half | Protected broad cumulative G2 campaign | Four test hours per engineer; all G1 tests plus complete new scope, actual provider test evidence and exact candidate metadata. |

### 6.2 Feature-family contract checklist

Extend the P1 API families rather than adding conflicting per-channel logic. Every row below needs server validation, scoped UI/native consumers, state/error handling, audit/event behavior, positive/negative tests and original R acceptance evidence.

| Family / proposed namespace | Data/state and behavior to complete | Primary owner / integration |
|---|---|---|
| Orders, returns, invoices and tracking | Staff source/packing, cancellation/return quarantine/refund/credit-note, provider shipment/settlement and owner-scoped history/current-price reorder | Josin; Devadathan with Paul/Denzil/Devadathan/Mathew consume |
| `/v1/stock/*` and clinics | FEFO balances, recalls, near-expiry/low stock, approved adjustments and dispatched/received batch transfers; location permissions | Josin with Mathew; Devadathan with Paul/Denzil operations |
| `/v1/subscriptions/*` | Provider-confirmed mandate/payment state, unique renewal business key, stock/tax lifecycle, failures/pause/resume/cancel and reconciliation | Josin; Mathew/Mathew schedules, Devadathan with Paul/Denzil/Devadathan UI |
| `/v1/clinical/*` and recommendations | Assignment/consent, versioned signed notes/recommendations, approved quantities/dosage and patient-scoped cart authorization | Mathew; Devadathan with Paul/Denzil doctor, Devadathan customer, Mathew tools |
| `/v1/medicine-schedules/*` | Physician instructions, units/timing/timezone/start-end/version/consent, refill basis and obsolete/deadline suppression | Mathew/Mathew; Devadathan with Paul/Denzil/Devadathan visibility |
| Bookings and `/v1/consultations/*` | Reschedule/leave/refund obligations, cross-clinic conflict, private room join window/credential expiry/revocation | Mathew/Devadathan; Devadathan with Paul/Denzil physician, Mathew notices |
| Knowledge/Companion/tools | Approved versions/translations, mandatory safety, exact/vector aliases, typed authorized/confirmed actions, current-state and urgent/human rules | Mathew/Mathew; Devadathan with Paul/Denzil editor/support, Devadathan customer |
| `/v1/conversations/*` and support | Channel/account identity, agent ownership, bot pause, consented summaries, callback/unanswered resolution and replay handling | Mathew; Devadathan with Paul/Denzil console, Mathew privacy |
| `/v1/campaigns/*` and recovery | Consented segments/templates, quiet hours/opt-out, schedule/delivery/attribution, cart delay/unique notice/scoped expiring link and purchase suppression | Mathew/Devadathan with Paul/Denzil; Josin order facts |
| Promotions/reviews/physician content | Start/end/redemption and bundle allocations, verified-purchase/moderation, approved public doctor text | Josin/Devadathan with Paul/Denzil; Mathew events |
| `/v1/loyalty/*`, referrals and wholesale | Approved business eligibility/price/MOQ/pack/payment terms; credit sources/caps/redemption/first-order/refund reversals and basic abuse controls | Josin; Devadathan with Paul/Denzil/Devadathan UI, Mathew permissions |
| `/v1/reports/*`, exports and feeds | Idempotent attributed facts and incremental summaries, control totals/freshness/date filters, asynchronous safe exports, product feed/schema/canonicals/hreflang/sitemap/redirects | Josin/Mathew sources; Devadathan with Paul/Denzil UI/feed; Devadathan limits |

Client confirmations include current operation/version/amount or appointment scope and expire/revalidate as appropriate. No callback URL, queue payload, tool proposal or phone-number match grants identity or approval. Side effects remain server-authorized and idempotent. Both changed events and all web/native consumers are reviewed before merge.

### 6.3 Company and provider inputs to close

Obtain finance-approved tax/HSN/place-of-supply/series/refund/COD/distributor/credit rules, physician-approved schedules/recommendation validity/safety translations and consent/retention/minors policy. Company owners verify enabled payment/mandate methods, courier serviceability, live WhatsApp templates/number, SMS sender rules, store/listing access and quotas. Track actual approval status by R ID. Availability in a provider's brochure is not evidence the company's account can use it.

Finish EN/ML/TA UI, notifications and invoice labels with reviewed fonts/formatting; additional Hindi/Kannada/Telugu and Romanized clinical conversation uses reviewed text or an approved source-language/human fallback. No unsupported medical translation is fabricated to claim language coverage. Keep health details out of marketing audiences, generic analytics and logs.


## 7. Retained technical specifications — unbudgeted source references

The six labels E1–E6 below identify source technical domains only. Every old package has **zero separate current allocation**; its work is split by the named section 4 register/member boundaries. They are not six extra people. Review/implementation instructions here must be read with the named contract and role restrictions.

### E1 — Technical lead / clinical backend

#### P2-E1-001 — Complete clinical records, assignment, consent and recommendations

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O02, P2-O06. **Requirements:** R03, R11, R12, R14, R15, R19, R36.

**Inputs/dependencies:** G1; P1-E1-001 through P1-E1-004; P2-E3-002.

**Implementation / execution:** Complete physician workspace services for assigned consultations, permitted history and consented chat summaries; version notes and signed recommendations with author/time/reason. Implement consult-to-cart against valid matching patient/product/recommendation scope; never let model text alter prescribed dosage. Complete guardian/consent, access/export/deletion-versus-retention rules approved by the company. Use transaction-local RLS and audited sensitive access with scoped doctor/front-desk/finance/warehouse views. Review clarification C03: Capture versioned required sign-up/privacy consent without bundling marketing opt-in; record and enforce required consultation identity/consent before private video/clinical access. Before personalized medical recommendation, follow physician-approved minimal intake including age/current medication and pregnancy/child/red-flag routing; unknown or declined required information uses approved clarification/handoff. Do not impose clinical intake on ordinary public catalogue browsing or infer a diagnosis. Verify configured transport and at-rest protection for clinical database/private objects/backups and approved processor flows using actual configuration/provider evidence; no plaintext secret/health-content evidence dump. Review clarification C04: Authorized front desk creates an in-clinic outpatient appointment in the same canonical booking lifecycle with source/staff actor and correct clinic fee/payment/refund state; use the same global doctor overlap constraints. It cannot be confused with a walk-in product order. Assigned physicians see policy-permitted past purchases in the linked patient view; unassigned/revoked/cross-patient/clinic access remains denied. Doctor management also includes approved qualifications/photo, slot length and online/in-clinic/both availability settings; front-desk operational readiness is demonstrated before public launch.

**Done when:** Unassigned/revoked doctors cannot read records; signed consult-only authorization cannot be reused by another patient or expired recommendation; retained records and account access are handled according to the approved policy.

**Tests/evidence:** Clinical CRUD/version/signature tests, role/clinic/patient matrix, consent/guardian/export/deletion cases and physician UAT.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E1-002 — Complete scheduling lifecycle and multiclinic operational controls

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O02. **Requirements:** R03, R11, R12, R13, R14, R32.

**Inputs/dependencies:** G1 booking path; P2-E2-001 P2-E4-002.

**Implementation / execution:** Complete per-location hours/fees/leave and online/in-clinic booking, reschedule, cancellation/refund obligations and notifications. Recheck interval exclusion, buffers, explicit stale holds and concurrent doctor changes. Finish two-clinic staff scope, appointment/report filters and stock-transfer coordination with E2. Expose booking-scoped room credentials with patient/doctor identity, join window, expiry and revocation. Apply safe late-payment rebook/refund behavior across web/native/WhatsApp. Review clarification C04: Authorized front desk creates an in-clinic outpatient appointment in the same canonical booking lifecycle with source/staff actor and correct clinic fee/payment/refund state; use the same global doctor overlap constraints. It cannot be confused with a walk-in product order. Assigned physicians see policy-permitted past purchases in the linked patient view; unassigned/revoked/cross-patient/clinic access remains denied. Doctor management also includes approved qualifications/photo, slot length and online/in-clinic/both availability settings; front-desk operational readiness is demonstrated before public launch.

**Done when:** All booking transitions remain consistent across clinics/channels; no active overlap or unauthorized room join; refunded/cancelled state reaches jobs and UI.

**Tests/evidence:** Leave/reschedule/cross-clinic concurrency, cancellation/refund, expired token and cross-channel state reconciliation.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E1-003 — Implement physician-authored medicine/refill schedules

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O02, P2-O03. **Requirements:** R09, R10, R15, R18.

**Inputs/dependencies:** P2-E1-001; P2-E2-002; P2-E5-002.

**Implementation / execution:** Implement structured dose/unit/timing and before/after-food instructions, start/end/timezone, consent and schedule versioning. Calculate refill due dates only from approved schedule/quantity or a confirmed customer interval; distinguish refill from provider mandate billing. Emit due jobs atomically; editing/cancelling invalidates stale jobs. Define missed-deadline suppression/escalation and customer visibility; support morning/evening and applicable schedule patterns without model-invented instructions.

**Done when:** Schedule edits/cancellations stop obsolete notices; timing/quantity/consent is traceable to physician/customer confirmation and correct timezone.

**Tests/evidence:** Boundary/timezone/unit/quantity, stale-version, consent revocation, missed-deadline and subscription-versus-refill tests.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E1-004 — Complete domain authorization and independent clinical/commerce review

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O06, P2-O07. **Requirements:** R02, R05, R07, R12, R15, R18, R19, R33, R36.

**Inputs/dependencies:** All Phase 2 core mutations and tool contracts.

**Implementation / execution:** Review high-risk commerce/refund/credit/booking/clinical changes and every newly reachable privileged route. Close permission/RLS gaps for wholesale, loyalty, campaigns, reports, files and assistant tools. Verify service roles cannot bypass row scope accidentally and editor approval remains separated. Coordinate company clinical/privacy/finance decisions and record acceptance blockers. Review all contract changes for web/native/event consumers; assemble the domain sign-off before G2.

**Done when:** No uncovered critical route or role path remains; independent review findings are fixed and all Phase 2 R IDs have accountable evidence.

**Tests/evidence:** Updated route/role inventory, reviewed critical PRs, pooled context negatives and company decision register.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E1-090 — Full clinical/access and independent transaction verification

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O07. **Requirements:** R10, R11, R12, R14, R15, R18, R19, R32, R36.

**Inputs/dependencies:** All currently due phase deliverables; frozen candidate and common test fixtures.

**Implementation / execution:** Retest all G1 invariants and new role/clinic/patient paths. Execute complete notes/consent/recommendation, dose/refill, leave/reschedule/refund, room and consult-only restrictions. Review commerce/credit/wholesale permission changes and the full physician-reviewed clinical evaluation; verify privacy/guardian/retention decisions.

**Done when:** Mandatory owned tests and shared critical regression are executed; failures have reproducible defects and fix/retest evidence. No phase is declared bug-free or accepted with unresolved blockers.

**Tests/evidence:** G2 test report, exact candidate metadata, defects/retests and company review evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E1-099 — Protected defect/retest contingency

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O07. **Requirements:** R36, R38.

**Inputs/dependencies:** Actual findings from continuous tests or the phase campaign.

**Implementation / execution:** Reserve this time for reproducing, containing, fixing and independently retesting phase defects. Link every use to the affected R IDs and source work package. Apply root-cause review and risk-based cumulative regression. If no defects consume it, use it for broader verification/handover; do not add new scope. If blockers exceed the reserve, record Rework/No-go and revise the forecast without weakening the gate.

**Done when:** All blocker fixes have evidence; unused time is recorded transparently. The reserve is not an estimate that every possible bug can be repaired within it.

**Tests/evidence:** Defect time/retest log, changed-candidate evidence map and updated remaining-effort forecast.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

### E2 — Commerce backend

#### P2-E2-001 — Complete fulfillment, returns, batch operations and GST billing

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O01. **Requirements:** R03, R04, R05, R06, R07, R08, R32.

**Inputs/dependencies:** G1 commerce path; provider/finance rules; P2-E3-001.

**Implementation / execution:** Adapt tested shipping/tax/warehouse modules: pincode/rate eligibility, label/pickup/tracking events, packing/cancellation/return/refund flows and COD settlement. Complete low/near-expiry alerts, adjustments, recall batch-to-customer lookup, quarantine returns and two-location batch-preserving transfers. Generate finance-approved CGST/SGST/IGST invoices, unique series/period numbers, translated labels, PDF/credit notes and monthly export. Record provider unknown states for reconciliation; do not double-create shipments. Review clarification C05: After the finance-approved issuance milestone, create a durable idempotent invoice-ready delivery obligation and send the customer an approved private/scoped invoice link or document through the permitted transactional channel. Generated PDF alone is not delivery evidence. Verify receipt, one effective delivery/reconciliation, retries, expiry/ownership and customer history; no public invoice URL or marketing-consent shortcut.

**Done when:** Unserviceable/expired/recalled stock cannot ship; tax and credit-note fixtures reconcile; transfer/return/COD records preserve physical and financial balances.

**Tests/evidence:** Courier contract flow, tax/rounding/series tests, recall/return/transfer cases and finance/warehouse control totals.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E2-002 — Complete recurring mandates, renewal orders and failure recovery

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O01. **Requirements:** R09, R10.

**Inputs/dependencies:** P1-E2-003; actual provider mandate eligibility; E1/E5 scheduling contracts.

**Implementation / execution:** Implement provider-confirmed enrollment, mandate/payment references, renewal events, exactly one business renewal order, stock allocation, amount/tax policy and notices. Support failed payment, stock shortage, pause/resume/cancel and provider reconciliation; customer UI and staff state must agree. Accelerate a sandbox cycle without pretending it proves live eligibility. Do not represent an app calendar reminder as automatic recurring debit or repeat a mandate charge after an ambiguous response.

**Done when:** Enrollment/renewal/failure/cancellation and duplicate/out-of-order events produce one authorized order/financial effect and correct subsequent schedules.

**Tests/evidence:** Sandbox cycle and available minimal live eligibility evidence, renewal shortage/duplicate tests, pause/cancel suppression and ledger reconciliation.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E2-003 — Complete bundles, wholesale, loyalty and referral financial rules

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O01, P2-O05. **Requirements:** R26, R31, R33.

**Inputs/dependencies:** G1 price/ledger contracts; company commercial rules; P2-E3-003 P2-E4-001.

**Implementation / execution:** Adapt tested bundle/course discount allocation, distributor approval/price-list/MOQ/pack/payment-term rules and loyalty/referral ledgers. Enforce the same price/eligibility/tax/consult-only checks across channels. Implement credit source references, earning/redemption caps, eligible first-order awards, self-referral/basic abuse checks and refund/return reversals. Preserve audit of account approvals and commercial terms; clients cannot choose a distributor role or create credit.

**Done when:** Bundle totals and tax allocations are stable, unauthorized wholesale terms fail, and credits cannot be duplicated or retained after a reversing event.

**Tests/evidence:** Retail/distributor/MOQ/terms tests, bundle stock/clinical restrictions, self-abuse/duplicate/refund credit scenarios and ledger totals.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E2-004 — Complete unified order desk, reconciliation and report sources

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O01, P2-O05, P2-O07. **Requirements:** R03, R04, R07, R29, R30, R35, R38.

**Inputs/dependencies:** P2-E2-001 through P2-E2-003; reporting/event contracts.

**Implementation / execution:** Finish staff phone/walk-in/WhatsApp source-aware order operations, permissioned customer history/current-price reorder and delivery state. Publish idempotent facts for sales/concern/city/clinic, repeat/refill/subscription and clinical/chat conversion summaries. Add purchase-suppression/verified-review eligibility signals. Run payment/refund/shipment/mandate reconciliation and CSV escaping/exports; reject spreadsheet-formula payloads in exported user text. Reconcile reports and opening balances with E3/E5.

**Done when:** All source channels share one order/ledger truth; no stale cart recovery after purchase; report/control totals match known fixtures without broad unbounded queries.

**Tests/evidence:** Staff source flows, reorder restrictions, summary rebuild/replay, safe export and provider-to-ledger comparison.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E2-090 — Full commerce/ledger/provider verification

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O07. **Requirements:** R01, R02, R03, R04, R05, R06, R07, R09, R26, R31, R33, R35.

**Inputs/dependencies:** All currently due phase deliverables; frozen candidate and common test fixtures.

**Implementation / execution:** Retest core races/duplicates; run tax/credit notes, subscription lifecycle/shortage, shipping/COD/returns/transfers/recall, bundles/distributor terms and referral/credit reversal. Compare exports/reports with durable fixtures and provider references; test unsafe CSV text and unauthorized commercial terms.

**Done when:** Mandatory owned tests and shared critical regression are executed; failures have reproducible defects and fix/retest evidence. No phase is declared bug-free or accepted with unresolved blockers.

**Tests/evidence:** G2 test report, exact candidate metadata, defects/retests and company review evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E2-099 — Protected defect/retest contingency

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O07. **Requirements:** R36, R38.

**Inputs/dependencies:** Actual findings from continuous tests or the phase campaign.

**Implementation / execution:** Reserve this time for reproducing, containing, fixing and independently retesting phase defects. Link every use to the affected R IDs and source work package. Apply root-cause review and risk-based cumulative regression. If no defects consume it, use it for broader verification/handover; do not add new scope. If blockers exceed the reserve, record Rework/No-go and revise the forecast without weakening the gate.

**Done when:** All blocker fixes have evidence; unused time is recorded transparently. The reserve is not an estimate that every possible bug can be repaired within it.

**Tests/evidence:** Defect time/retest log, changed-candidate evidence map and updated remaining-effort forecast.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

### E3 — Web / staff / content

#### P2-E3-001 — Complete customer commerce and operational workspaces

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O01, P2-O06. **Requirements:** R01, R02, R03, R04, R05, R06, R07, R09, R26, R32.

**Inputs/dependencies:** G1 web foundation; P2-E2-001 P2-E2-002.

**Implementation / execution:** Complete catalogue/concern, saved addresses/history/invoice/reorder/tracking and subscription lifecycle UI. Build the unified order/packing/return/refund desk, batch/expiry/recall/adjustment/transfer screens and location filters using scoped APIs. Display authoritative tax/discount/shipping/pending/error states and downloadable translated invoice labels. Preserve accessible loading/empty/conflict/offline states and confirmation for sensitive staff actions.

**Done when:** Retail and operational workflows run end to end through approved data and current APIs; no disconnected or disabled required screen remains.

**Tests/evidence:** Customer and staff browser journeys, permissions/locale/accessibility checks and financial/stock display reconciliation.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E3-002 — Complete physician, content, schedule and support workspaces

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O02, P2-O03. **Requirements:** R03, R10, R11, R12, R14, R15, R16, R20, R22, R36.

**Inputs/dependencies:** P2-E1-001 through P2-E1-003; P2-E5-001 P2-E5-003.

**Implementation / execution:** Complete schedules/leave/fees, assigned-patient history/consent/notes/recommendations and dose/refill UI. Finish content approval/version/withdrawal and reviewed safety translations; enforce editor/approver separation. Provide live handoff, conversation review, callback/unanswered queues, ownership/resolution reporting and after-hours state. Staff takeover must visibly pause the bot; health details remain scoped and consented. Review clarification C04: Authorized front desk creates an in-clinic outpatient appointment in the same canonical booking lifecycle with source/staff actor and correct clinic fee/payment/refund state; use the same global doctor overlap constraints. It cannot be confused with a walk-in product order. Assigned physicians see policy-permitted past purchases in the linked patient view; unassigned/revoked/cross-patient/clinic access remains denied. Doctor management also includes approved qualifications/photo, slot length and online/in-clinic/both availability settings; front-desk operational readiness is demonstrated before public launch.

**Done when:** Company doctors/front desk can execute complete assigned workflows and content/support controls operate without unauthorized patient exposure.

**Tests/evidence:** Doctor/content/support UAT, approval/takeover races, consent/scoping, schedule edit and language tests.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E3-003 — Complete growth, wholesale, review and loyalty interfaces

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O05. **Requirements:** R27, R28, R29, R30, R31, R33.

**Inputs/dependencies:** P2-E2-003; P2-E5-002; approved company commercial/content rules.

**Implementation / execution:** Build seasonal landing-page/promotion publication with start/end/redemption constraints; segment/template campaign scheduling and delivery results. Implement abandoned-cart status/suppression, verified-buyer review/moderation and approved physician product content. Complete referral sharing, points/credit/history/redemption and wholesale application/approval/price/MOQ/payment-term UI. Exclude clinical notes from marketing audiences and display consent/opt-out rules. Review clarification C06: Demonstrate all three approved campaign types: new product, restock and seasonal offer. Build consented prior-purchase segments from authorized commerce facts, with preview/counts, quotas, quiet hours, current opt-out and deduplicated attribution. No raw clinical notes or inferred health-interest audience without explicit business/privacy approval; live sending uses company-controlled approved recipients.

**Done when:** Required growth/wholesale/review/credit journeys work for permitted actors; UI cannot bypass backend eligibility or clinical restrictions.

**Tests/evidence:** Promotion boundaries/caps, consent/opt-out, buyer review eligibility, wholesale/credit misuse and refund reversal browser tests.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E3-004 — Complete reports, SEO/listings, localization and training drafts

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O05, P2-O06, P2-O07. **Requirements:** R16, R22, R23, R28, R34, R35, R37.

**Inputs/dependencies:** P2-E2-004; P2-E5-004; all web modules.

**Implementation / execution:** Complete reconciled product/concern/city/clinic/retention/refill/subscription/conversion dashboards with safe date filters, freshness and asynchronous exports. Implement canonical/language alternate/schema/sitemap/redirect/feed outputs and company listing linkage; track external approvals distinctly. Audit EN/ML/TA resource completeness, fonts, invoice/message labels and accessible layouts; finalize first approved seasonal campaign configuration. Draft role-based guides/training scenarios and final web smoke list. Review clarification C02: Record privacy-minimized answer-to-approved-entry/version attribution, not raw health prompts in general analytics. Content reviewers can view most-used entry/version counts with date filters and freshness labels. Define whether counts represent used answer entries or retrieval hits; count retries once by stable answer/event identity and reconcile known fixtures. Unauthorized roles cannot access the content report.

**Done when:** Reports match fixtures, required SEO/feed artifacts validate, translations have no missing keys and training/approval dependencies are ready for Phase 3.

**Tests/evidence:** Known-total report suite, sitemap/feed/schema validation, locale/accessibility report and draft training/approval register.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E3-090 — Full web/staff/language/report verification

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O07. **Requirements:** R01, R03, R04, R07, R14, R16, R20, R22, R27, R28, R29, R30, R31, R33, R34, R35.

**Inputs/dependencies:** All currently due phase deliverables; frozen candidate and common test fixtures.

**Implementation / execution:** Execute complete customer/staff/doctor/support/content/growth/wholesale/report browser journeys, forbidden states, accessible EN/ML/TA and safe exports. Validate review/campaign eligibility, totals, SEO/feed artifacts and permissions. Reconcile web outcomes to native/WhatsApp state and company UAT notes.

**Done when:** Mandatory owned tests and shared critical regression are executed; failures have reproducible defects and fix/retest evidence. No phase is declared bug-free or accepted with unresolved blockers.

**Tests/evidence:** G2 test report, exact candidate metadata, defects/retests and company review evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E3-099 — Protected defect/retest contingency

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O07. **Requirements:** R36, R38.

**Inputs/dependencies:** Actual findings from continuous tests or the phase campaign.

**Implementation / execution:** Reserve this time for reproducing, containing, fixing and independently retesting phase defects. Link every use to the affected R IDs and source work package. Apply root-cause review and risk-based cumulative regression. If no defects consume it, use it for broader verification/handover; do not add new scope. If blockers exceed the reserve, record Rework/No-go and revise the forecast without weakening the gate.

**Done when:** All blocker fixes have evidence; unused time is recorded transparently. The reserve is not an estimate that every possible bug can be repaired within it.

**Tests/evidence:** Defect time/retest log, changed-candidate evidence map and updated remaining-effort forecast.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

### E4 — Android / iOS

#### P2-E4-001 — Complete full native commerce/account/subscription/loyalty parity

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O04. **Requirements:** R01, R02, R03, R09, R22, R25, R26, R31, R33.

**Inputs/dependencies:** G1 native adapters; Phase 2 commerce contracts; E3 locales.

**Implementation / execution:** Complete native browse/cart/addresses/current checkout/COD/history/invoices/reorder/tracking, provider-confirmed subscription lifecycle, bundles, referrals/credit/redemption and approved distributor customer experience. Apply the same backend pricing/eligibility and signed recommendation rules. Handle cancel/pending/network resume/deep-link state safely; cache only permitted data and clear/revalidate after logout/revocation. Test Android/iOS parity, accessible text/touch controls and all launch scripts.

**Done when:** Every required customer commerce capability works in both release-candidate apps; no web-only omission is used to claim native parity.

**Tests/evidence:** Feature-by-feature parity matrix and Android/iOS purchase/renewal/credit/distributor/reorder evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E4-002 — Complete native consultation, scheduling and clinical customer flows

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O02, P2-O04. **Requirements:** R10, R11, R12, R13, R14, R15, R25, R32.

**Inputs/dependencies:** P2-E1-001 through P2-E1-003; proven WebRTC component.

**Implementation / execution:** Complete book/reschedule/cancel/refund display, appointment history, consent, assigned consultation joins, signed recommendations and medicine/refill views. Implement backend-issued room credentials, join-window expiry/revocation, reconnect, mic/camera switching/denial and background/resume behavior. Verify patient and doctor web/native compatibility, poor networks and optional relay-only policy; no media passes through API Workers and no consultation recording is enabled by default.

**Done when:** Both native apps execute the full approved consultation journey and cannot join another patient/doctor room; dose/clinical instructions retain the approved version.

**Tests/evidence:** Device/video/network/permission matrix, unauthorized/expired-room tests, reschedule/refund and consult-to-cart evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E4-003 — Complete native assistant, voice, push and channel linking

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O03, P2-O04. **Requirements:** R17, R18, R19, R20, R21, R22, R23, R24, R25.

**Inputs/dependencies:** P2-E5-001 through P2-E5-003; E1 confirmation contracts.

**Implementation / execution:** Finish cited chat, safe approved medical blocks, explicit action confirmations, urgent/human handoff and conversation state. Add bounded microphone capture/transcription, editable review of units/numbers and safe failure; no unchecked voice performs a purchase or booking. Implement consented push, authenticated notification/deep-link destinations and identity-linked WhatsApp checkout/booking return. Test three-language rendering, Romanized input display, expired links and app restart.

**Done when:** Native chat/voice/actions match web/WhatsApp backend state, handoff pauses automation and private destinations require current identity.

**Tests/evidence:** Device voice/ambiguity/action-confirmation, urgency/takeover, push/link replay and session-expiry results.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E4-004 — Produce complete signed candidates and store-ready packages

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O04, P2-O07. **Requirements:** R22, R24, R25, R36, R37.

**Inputs/dependencies:** P2-E4-001 through P2-E4-003; company store account readiness.

**Implementation / execution:** Run current-scope full-device regression on Android/iOS and representative supported devices/OS; test accessibility, text scaling, slow/offline transitions, notification routing and payment return. Produce signed versioned complete candidates, dependency/permission inventories, listing assets/privacy declarations, review accounts and release notes. Validate company signing/access recovery and store production eligibility. Prepare Day 7 submission after paid-environment regression; internal distribution is not public release.

**Done when:** Complete signed candidates and external readiness records are attached to G2; reproducible builds contain no secrets/debug permissions or missing customer feature.

**Tests/evidence:** Build hashes/device report, permission/privacy/listing package, reviewer account checklist and store status register.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E4-090 — Full native/device and cross-channel verification

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O07. **Requirements:** R02, R03, R09, R10, R11, R12, R13, R15, R17, R18, R19, R20, R22, R23, R24, R25, R26, R31, R33.

**Inputs/dependencies:** All currently due phase deliverables; frozen candidate and common test fixtures.

**Implementation / execution:** Run the complete customer parity checklist on Android/iOS release candidates, including subscription/credit/wholesale, medical recommendations, video/voice/push, permissions, network resume and deep links. Verify cited clinical blocks, confirmations, handoff and three-language accessibility; attach binary/device evidence.

**Done when:** Mandatory owned tests and shared critical regression are executed; failures have reproducible defects and fix/retest evidence. No phase is declared bug-free or accepted with unresolved blockers.

**Tests/evidence:** G2 test report, exact candidate metadata, defects/retests and company review evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E4-099 — Protected defect/retest contingency

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O07. **Requirements:** R36, R38.

**Inputs/dependencies:** Actual findings from continuous tests or the phase campaign.

**Implementation / execution:** Reserve this time for reproducing, containing, fixing and independently retesting phase defects. Link every use to the affected R IDs and source work package. Apply root-cause review and risk-based cumulative regression. If no defects consume it, use it for broader verification/handover; do not add new scope. If blockers exceed the reserve, record Rework/No-go and revise the forecast without weakening the gate.

**Done when:** All blocker fixes have evidence; unused time is recorded transparently. The reserve is not an estimate that every possible bug can be repaired within it.

**Tests/evidence:** Defect time/retest log, changed-candidate evidence map and updated remaining-effort forecast.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

### E5 — AI / messaging / integrations

#### P2-E5-001 — Complete safe multilingual RAG and authorized conversational actions

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O03. **Requirements:** R01, R14, R16, R17, R18, R19, R22, R23, R36.

**Inputs/dependencies:** G1 retrieval/tool boundary; full approved content; E1 domain tools.

**Implementation / execution:** Complete structured KB approval/version/withdrawal and exact/keyword/vector routing. Enforce current primary approval and independent mandatory safety retrieval before rendering medical blocks; keep unsupported language/content on approved fallback. Complete permitted product/order/refill/availability/cart/booking/payment proposals with typed schemas, current authorization and explicit customer confirmation. Test urgent/consult-only/no-cure-claim behavior, source citations, native-script/Romanized variations, prompt injection and concurrency/timeout/budget boundaries. Review clarification C01: Reconcile every published catalogue product to its physician-approved monograph/dosage/contraindication and required EN/ML/TA safety translations. No published product is an unexplained coverage gap. G1 records the complete inventory/gap register and an approved sample; G2 closes required product coverage and demonstrates approved edit/withdrawal propagation within a company-agreed measured freshness deadline. The illustrative morning-to-afternoon statement is not an invented numeric provider SLA. Include approved public physician profiles and the required knowledge types; approval is not satisfied by catalogue text alone. Review clarification C03: Capture versioned required sign-up/privacy consent without bundling marketing opt-in; record and enforce required consultation identity/consent before private video/clinical access. Before personalized medical recommendation, follow physician-approved minimal intake including age/current medication and pregnancy/child/red-flag routing; unknown or declined required information uses approved clarification/handoff. Do not impose clinical intake on ordinary public catalogue browsing or infer a diagnosis. Verify configured transport and at-rest protection for clinical database/private objects/backups and approved processor flows using actual configuration/provider evidence; no plaintext secret/health-content evidence dump.

**Done when:** Every supported clinical display traces to approved content and no model output directly changes stock, money, dosage, identity or unrestricted records.

**Tests/evidence:** Full 120+40 approved evaluation, tool/confirmation negatives, stale-index/revocation, model-saturation and red-flag results.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E5-002 — Complete messages, schedules, campaigns and suppression rules

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O01, P2-O02, P2-O03, P2-O05. **Requirements:** R07, R08, R09, R10, R12, R27, R28, R29.

**Inputs/dependencies:** P2-E1-003 P2-E2-002; event/queue platform; templates/consent rules.

**Implementation / execution:** Finish confirmation/dispatch/out-for-delivery/delivery notices with tracking links, appointment and prescription/refill schedules, recurring subscription events and channel delivery state. Complete opted-in segments, campaign template scheduling/results/attribution, quiet hours/opt-out and first seasonal campaign. Implement abandoned-cart delay, unique notice, scoped expiring recovery link and purchase/cancel/unsubscribe suppression. Recheck schedule/version/consent at execution; distinguish critical deadlines from throttled marketing. Review clarification C05: After the finance-approved issuance milestone, create a durable idempotent invoice-ready delivery obligation and send the customer an approved private/scoped invoice link or document through the permitted transactional channel. Generated PDF alone is not delivery evidence. Verify receipt, one effective delivery/reconciliation, retries, expiry/ownership and customer history; no public invoice URL or marketing-consent shortcut. Review clarification C06: Demonstrate all three approved campaign types: new product, restock and seasonal offer. Build consented prior-purchase segments from authorized commerce facts, with preview/counts, quotas, quiet hours, current opt-out and deduplicated attribution. No raw clinical notes or inferred health-interest audience without explicit business/privacy approval; live sending uses company-controlled approved recipients.

**Done when:** Real business events drive the required channels with deduplication; edits/purchases/opt-outs invalidate stale notices and unknown provider outcomes are reconciled.

**Tests/evidence:** Notification/template provider tests, timezone/consent/deadline/version cases, campaign priority and cart-after-purchase suppression.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E5-003 — Complete WhatsApp, human support and bounded voice workflows

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O03. **Requirements:** R18, R20, R21, R24.

**Inputs/dependencies:** P2-E5-001 P2-E5-002; staff console and mobile contracts.

**Implementation / execution:** Complete real clinic-number text/voice ingestion, verified account linking, owner-scoped order lookup, booking and secure provider checkout links. Implement staff replies, assignment, live handoff/summary, assistant pause, after-hours acknowledgment/callback and unanswered-question resolution queue. Handle webhook duplicates/out-of-order events, media size/expiry, transcription review and channel expiry. Consent/scoping applies to shared summaries; phone matching or payment links never grant unrestricted patient access.

**Done when:** An actual provider test conversation completes the supported action and human takeover across the console; duplicate events cannot create competing bot/agent replies or unauthorized data disclosure.

**Tests/evidence:** WhatsApp provider text/voice/link flow, takeover race, account-link replay, callback-after-hours and unknown-delivery tests.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E5-004 — Complete conversion/report events, evaluation evidence and support drafts

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O03, P2-O05, P2-O06, P2-O07. **Requirements:** R16, R17, R19, R20, R23, R27, R29, R35, R37, R38.

**Inputs/dependencies:** P2-E5-001 through P2-E5-003; E3 reports; physician test review.

**Implementation / execution:** Implement deduplicated conversation-to-cart/order/booking/handoff and consultation-to-order event attribution without health-text leakage. Rebuild/reconcile summaries from durable facts, including retries/refunds/opt-outs. Execute and review the full clinical/language set, triage unsupported cases and finalize approved fallback. Draft content-review, human support, message-failure, queue-replay and AI-saturation procedures; collect actual model/message/voice usage for the budget dashboard. Review clarification C02: Record privacy-minimized answer-to-approved-entry/version attribution, not raw health prompts in general analytics. Content reviewers can view most-used entry/version counts with date filters and freshness labels. Define whether counts represent used answer entries or retrieval hits; count retries once by stable answer/event identity and reconcile known fixtures. Unauthorized roles cannot access the content report.

**Done when:** Metrics match source fixtures, the complete evaluation passes required gates and the support/clinical review evidence is ready for Phase 3.

**Tests/evidence:** Known-total event/report tests, evaluation manifest/results, usage ledger and draft support/clinical-content runbooks.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E5-090 — Full clinical evaluation/channel/automation verification

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O07. **Requirements:** R08, R10, R16, R17, R18, R19, R20, R21, R22, R23, R24, R27, R29, R35.

**Inputs/dependencies:** All currently due phase deliverables; frozen candidate and common test fixtures.

**Implementation / execution:** Execute 120 launch-language plus 40 additional-language/Romanized approved scenarios and all tool/account-link/voice/takeover negatives. Test schedule/consent/version deadlines, actual provider text/voice flow, templates, campaign isolation and after-purchase suppression. Reconcile funnel metrics and cost measurements.

**Done when:** Mandatory owned tests and shared critical regression are executed; failures have reproducible defects and fix/retest evidence. No phase is declared bug-free or accepted with unresolved blockers.

**Tests/evidence:** G2 test report, exact candidate metadata, defects/retests and company review evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E5-099 — Protected defect/retest contingency

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O07. **Requirements:** R36, R38.

**Inputs/dependencies:** Actual findings from continuous tests or the phase campaign.

**Implementation / execution:** Reserve this time for reproducing, containing, fixing and independently retesting phase defects. Link every use to the affected R IDs and source work package. Apply root-cause review and risk-based cumulative regression. If no defects consume it, use it for broader verification/handover; do not add new scope. If blockers exceed the reserve, record Rework/No-go and revise the forecast without weakening the gate.

**Done when:** All blocker fixes have evidence; unused time is recorded transparently. The reserve is not an estimate that every possible bug can be repaired within it.

**Tests/evidence:** Defect time/retest log, changed-candidate evidence map and updated remaining-effort forecast.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

### E6 — Platform / quality / release

#### P2-E6-001 — Complete quality pipeline and full-scope security inventory

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O06, P2-O07. **Requirements:** R01, R02, R03, R14, R18, R25, R36, R38.

**Inputs/dependencies:** All integrated Phase 2 routes/builds; G1 harness.

**Implementation / execution:** Extend CI critical business, web/mobile contract, code/dependency/secret/config and migration checks to the complete app. Maintain route/tool/role/record inventory and authenticated test accounts; configure staged dynamic review and manual access/business-logic tests. Trace each feature and external dependency to an R ID; collect reproducible build/schema/model/KB evidence and independently review critical security fixes. No scan result alone certifies safety.

**Done when:** Every reachable critical route/tool has positive and negative coverage, scan findings are triaged and evidence points to the integrated candidate.

**Tests/evidence:** Route/test coverage register, authenticated dynamic/code scan reports, reviewed fixes and exact build manifests.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E6-002 — Complete queue priorities, observability, cost and failure drills

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O06. **Requirements:** R08, R10, R27, R29, R35, R36, R38.

**Inputs/dependencies:** P2-E5-002 P2-E2-004; G1 queue platform.

**Implementation / execution:** Tune separate financial/clinical/engagement concurrency, outbox leases, retry/deadline/DLQ handling and unknown-provider reconciliation. Add metrics/alerts for errors, CPU/cache/pool/locks, job age/deadlines, invariant failures, vendor spend and clinical/human escalation. Verify marketing backlog cannot monopolize important work. Execute crash/reclaim/duplicate/timeout/saturation tests; keep logs/payloads scrubbed and provider load isolated. Review clarification C08: Measure healthy-state due-to-claim pickup p95 below two minutes with agreed server timestamps/sample size while preserving current consent/version/deadline suppression. During fault/backlog tests separately measure deadline recovery and alerts. Configure a defined 30-day core-availability SLI/dashboard and 99.9% internal objective, exclusions and owner; ten-day prelaunch tests cannot prove achieved monthly availability and do not imply a paid vendor SLA or 24-hour clinician staffing.

**Done when:** The full app has usable alert/reconciliation dashboards, cost visibility and durable bounded work under failure.

**Tests/evidence:** Failure/replay traces, priority/backlog results, alert receipt/redaction checks and usage/cost forecast.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E6-003 — Prepare paid verification, restore scripts and release runbooks

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O06, P2-O07. **Requirements:** R25, R36, R37, R38.

**Inputs/dependencies:** G1 recovery foundation; E4 signed candidates; company account access.

**Implementation / execution:** Version the Workers Paid/Neon Launch verification configuration, compute/pool/seven-day history, isolated data/queues/R2/secrets and direct backup/migration roles. Prepare realistic retained fixtures, k6 mix and artifact metadata for G3; verify extension/RLS/connection compatibility. Complete encrypted pg_dump/pg_restore/object-manifest and schema-compatible rollback/cutover scripts. Draft on-call, financial replay, credentials and training/handover checklists. Review clarification C07: Hand over a dated maintenance calendar: daily reconciliation; weekly access/job/backup/capacity/security checks; monthly physician review of flagged conversations and knowledge changes; quarterly operating/performance report. Name primary/backup owners, priority-fix/security/app-release workflow, and the proposal’s up-to-eight-hours-per-month knowledge-maintenance allowance with an agreed overflow/response process. These are support obligations/operating labor, not extra sprint capacity, new subscription pricing, or automatically created reminders.

**Done when:** Day 7 paid-environment and recovery tests can run without creating new architecture or uncontrolled production side effects.

**Tests/evidence:** Reviewed configuration/scripts, fixture sizing, restore/rollback rehearsal and operations/training drafts.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E6-080 — Freeze the complete candidate and prepare Day 7 paid verification

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O06, P2-O07. **Requirements:** R36, R38.

**Inputs/dependencies:** Phase prerequisites and applicable company owners; tested candidate before public release.

**Implementation / execution:** Create exact web/API/native/schema/model/KB manifests, verified provider-mode configuration and paid-environment activation checklist. Confirm production domain/store/merchant/listing readiness, review accounts, independent backup runner, data fixture sizing and support/acceptance schedule. Assemble G2 handoff without counting missing public approvals as completed.

**Done when:** Required environment/release/handover records are complete for the due milestone; external approvals remain explicit and public release depends on G3.

**Tests/evidence:** Configuration/approval/training/release register with ownership, timestamps, build IDs and safe verification results.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E6-090 — Full security/platform/load/restore verification and G2

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O07. **Requirements:** R25, R36, R37, R38.

**Inputs/dependencies:** All currently due phase deliverables; frozen candidate and common test fixtures.

**Implementation / execution:** Retest full route/role/supply-chain/config inventory, migration/rollback/private storage and complete queue failure/replay cases. Execute 20 rps for 15 minutes with bounded jobs/AI and controlled providers; inspect resource pressure and cost. Rehearse current-schema/object recovery; collect G2 coverage, findings and Day 7 paid-readiness evidence.

**Done when:** Mandatory owned tests and shared critical regression are executed; failures have reproducible defects and fix/retest evidence. No phase is declared bug-free or accepted with unresolved blockers.

**Tests/evidence:** G2 test report, exact candidate metadata, defects/retests and company review evidence.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

#### P2-E6-099 — Protected defect/retest contingency

**Execution allocation:** none separately; use the named section 4 register. **Outputs:** P2-O07. **Requirements:** R36, R38.

**Inputs/dependencies:** Actual findings from continuous tests or the phase campaign.

**Implementation / execution:** Reserve this time for reproducing, containing, fixing and independently retesting phase defects. Link every use to the affected R IDs and source work package. Apply root-cause review and risk-based cumulative regression. If no defects consume it, use it for broader verification/handover; do not add new scope. If blockers exceed the reserve, record Rework/No-go and revise the forecast without weakening the gate.

**Done when:** All blocker fixes have evidence; unused time is recorded transparently. The reserve is not an estimate that every possible bug can be repaired within it.

**Tests/evidence:** Defect time/retest log, changed-candidate evidence map and updated remaining-effort forecast.

**Current review:** Devadathan independently reviews Mathew; Mathew reviews Devadathan/Josin critical changes; Devadathan reviews Paul/Denzil UI with domain input; company physician/finance approve expectations. Tinu coordinates independent retest. Source E-role reviewer labels are retired.

### Integrated review: explicit proposal acceptance details

These details clarify existing R IDs from the company proposals/accepted master; they do not add a later release or another architecture. They must be included in the existing named package estimates. Prove reuse/review capacity on Day 1 and reforecast if the clarified work does not fit; the unchanged 480-hour budget is not new evidence of feasibility.

| Clarification | Source / requirements | Named execution packages | Acceptance and testing |
|---|---|---|---|
| C01 — Complete approved product knowledge and bounded refresh | Companion pp. 4, 8–9: initial approved knowledge covers every website product; updated approved content reaches answers. R01, R16, R17 | P2-MAT-002, P2-DEN-003 | Reconcile every published catalogue product to its physician-approved monograph/dosage/contraindication and required EN/ML/TA safety translations. No published product is an unexplained coverage gap. G1 records the complete inventory/gap register and an approved sample; G2 closes required product coverage and demonstrates approved edit/withdrawal propagation within a company-agreed measured freshness deadline. The illustrative morning-to-afternoon statement is not an invented numeric provider SLA. Include approved public physician profiles and the required knowledge types; approval is not satisfied by catalogue text alone. Evidence: P2-T13, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C02 — Knowledge entry usage analytics | Companion p. 6: staff can see which knowledge entries the assistant uses most. R16, R35 | P2-MAT-002, P2-MAT-004, P2-DEN-003, P2-DEN-004 | Record privacy-minimized answer-to-approved-entry/version attribution, not raw health prompts in general analytics. Content reviewers can view most-used entry/version counts with date filters and freshness labels. Define whether counts represent used answer entries or retrieval hits; count retries once by stable answer/event identity and reconcile known fixtures. Unauthorized roles cannot access the content report. Evidence: P2-T13, P2-T31, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C03 — Explicit intake and consent checkpoints | Companion pp. 5, 7: age/current medication screening, pregnancy/children/red flags; sign-up consent and recorded video consultation identity/consent. R14, R19, R36 | P2-MAT-001, P2-MAT-002, P2-DEV-001, P2-DEV-002 | Capture versioned required sign-up/privacy consent without bundling marketing opt-in; record and enforce required consultation identity/consent before private video/clinical access. Before personalized medical recommendation, follow physician-approved minimal intake including age/current medication and pregnancy/child/red-flag routing; unknown or declined required information uses approved clarification/handoff. Do not impose clinical intake on ordinary public catalogue browsing or infer a diagnosis. Verify configured transport and at-rest protection for clinical database/private objects/backups and approved processor flows using actual configuration/provider evidence; no plaintext secret/health-content evidence dump. Evidence: P2-T10, P2-T15, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C04 — Front-desk outpatient booking and permitted patient order history | Companion pp. 6, 8: staff enter outpatient bookings; assigned doctors see permitted patient past orders. R03, R11, R12, R14 | P2-MAT-001, P2-JOS-004, P2-DEV-001, P2-DEN-001 | Authorized front desk creates an in-clinic outpatient appointment in the same canonical booking lifecycle with source/staff actor and correct clinic fee/payment/refund state; use the same global doctor overlap constraints. It cannot be confused with a walk-in product order. Assigned physicians see policy-permitted past purchases in the linked patient view; unassigned/revoked/cross-patient/clinic access remains denied. Doctor management also includes approved qualifications/photo, slot length and online/in-clinic/both availability settings; front-desk operational readiness is demonstrated before public launch. Evidence: P2-T04, P2-T09, P2-T10, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C05 — Automatic invoice delivery, not only PDF generation | Ecommerce pp. 3–4, 6: GST invoice generated and sent with every order. R07, R08 | P2-JOS-001, P2-JOS-004, P2-MAT-004 | After the finance-approved issuance milestone, create a durable idempotent invoice-ready delivery obligation and send the customer an approved private/scoped invoice link or document through the permitted transactional channel. Generated PDF alone is not delivery evidence. Verify receipt, one effective delivery/reconciliation, retries, expiry/ownership and customer history; no public invoice URL or marketing-consent shortcut. Evidence: P2-T06, P2-T33, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C06 — New-product, restock and seasonal past-buyer campaigns | Ecommerce pp. 3, 7: opted-in past buyers segmented by what they bought; new-product, restock and seasonal campaigns. R27, R28 | P2-MAT-004, P2-JOS-004, P2-DEN-002 | Demonstrate all three approved campaign types: new product, restock and seasonal offer. Build consented prior-purchase segments from authorized commerce facts, with preview/counts, quotas, quiet hours, current opt-out and deduplicated attribution. No raw clinical notes or inferred health-interest audience without explicit business/privacy approval; live sending uses company-controlled approved recipients. Evidence: P2-T23, P2-T24, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C07 — Explicit maintenance calendar and ownership | Ecommerce pp. 6, 8; Companion pp. 7–8: security updates/app releases/priority fixes, monthly flagged-conversation review, knowledge-update allowance and quarterly report. R37, R38 | P2-MAT-002, P2-DEV-003, P2-DEN-004 | Hand over a dated maintenance calendar: daily reconciliation; weekly access/job/backup/capacity/security checks; monthly physician review of flagged conversations and knowledge changes; quarterly operating/performance report. Name primary/backup owners, priority-fix/security/app-release workflow, and the proposal’s up-to-eight-hours-per-month knowledge-maintenance allowance with an agreed overflow/response process. These are support obligations/operating labor, not extra sprint capacity, new subscription pricing, or automatically created reminders. Evidence: P2-T36, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |
| C08 — Numeric job pickup and availability measurement | Accepted master §§11–12: healthy-state due-job pickup p95 <2 minutes and 99.9% monthly core availability objective. R10, R38 | P2-MAT-004, P2-DEV-003 | Measure healthy-state due-to-claim pickup p95 below two minutes with agreed server timestamps/sample size while preserving current consent/version/deadline suppression. During fault/backlog tests separately measure deadline recovery and alerts. Configure a defined 30-day core-availability SLI/dashboard and 99.9% internal objective, exclusions and owner; ten-day prelaunch tests cannot prove achieved monthly availability and do not imply a paid vendor SLA or 24-hour clinician staffing. Evidence: P2-T33, relevant F-R walkthroughs in [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). |

## 8. End-to-end journeys and required failure paths

| Journey | Required integrated path and failure coverage | Evidence owners |
|---|---|---|
| Purchase → fulfillment → return | Retail web/native and staff phone/walk-in/WhatsApp orders, current price/consult eligibility, FEFO, tax/invoice, labels/pickup/tracking/COD, return quarantine/refund/credit note; reject unserviceable/expired/recalled stock | Josin/Devadathan with Paul/Denzil/Devadathan/Mathew; finance/warehouse |
| Recurring course/subscription | Bundle/course eligibility and mandate confirmation, accelerated renewal, one order, failure/short stock, pause/resume/cancel and notices; no duplicate debit after unknown response | Josin with Mathew/Mathew; Devadathan with Paul/Denzil/Devadathan customer |
| Consultation → medicine schedule → cart/refill | Clinic/doctor/fee/leave/book/payment/reschedule/refund, private video, consented notes and signed recommendation, matching consult-only basket, dose/refill reminders and edit/cancel suppression | Mathew/Devadathan with Paul/Denzil/Devadathan/Mathew; physician |
| Safe multilingual assistant → human | Current cited medical blocks and product/order/slot actions, native/WhatsApp voice review, confirmations, urgent stop, consult-only, account linking, bot pause, after-hours callback and unanswered resolution | Mathew/Mathew/Devadathan with Paul/Denzil/Devadathan; physician/support |
| Growth → purchase → credit/review | Opted-in segment/template/seasonal landing/promotion, scoped cart recovery and post-purchase suppression, verified review/moderation, first-order referral/loyalty caps and refund reversal | Josin/Devadathan with Paul/Denzil/Mathew; marketing/finance |
| Distributor/multiclinic/reporting | Approval/assigned price/MOQ/payment terms, clinic stock/doctor/staff scope, batch transfer/recall, location sales and retained/refill/clinical/chat conversion totals | Mathew/Josin/Devadathan with Paul/Denzil/Mathew; operations |
| Operations under failure | Duplicate/late webhook, unknown payment/message/shipment, failed queue consumer/expired lease/retry/DLQ, AI saturation and stale KB, restore/replay, authorized CSV/PDF/object download | Tinu tracks the campaign; Devadathan/Mathew coordinate specialist operations |

## 9. Broad cumulative G2 verification campaign

Run all G1 tests against the new complete candidate, not an old build, then the cases below. Tinu has eight verification hours before the protected final-half-day campaign, including two earlier on Day 6; all six have four protected final-half-day verification hours. Other engineers’ earlier component checks are included in their implementation/review packages, not extra V hours. Automate repeatable cases and reserve manual time for misuse, actual devices and company review; parallel execution is not an excuse to omit failed/blocked tests.

| Test ID | Owner / support | Challenge and mandatory result |
|---|---|---|
| P2-T01 | Tinu coordinates; Tinu with all owners | Every R01–R38 has a due milestone, package, working UI/backend and evidence/external status; no required feature is a stub/disabled route or invisible gap. |
| P2-T02 | Tinu coordinates; Mathew/Devadathan operate; Tinu tracks | Complete role/clinic/patient matrix, revoked sessions and pooled RLS context; customer cannot bypass staff-org MFA or forge role/clinic identity. |
| P2-T03 | Tinu coordinates; Josin and Mathew | Re-run price/stock/multibatch/last-unit/payment signature/duplicate/unknown tests and compare persisted control totals after retries. |
| P2-T04 | Tinu coordinates; Josin; Denzil/Tinu execute UI | Phone/walk-in/WhatsApp staff orders use the same authoritative price/order/source audit and packing/cancel/return/refund state. |
| P2-T05 | Tinu coordinates; Josin; Devadathan fault controls | Serviceability/rates/label/pickup/tracking/COD and duplicate/unknown courier result never duplicate fulfillment or accept an unserviceable address. |
| P2-T06 | Tinu coordinates; Josin and company finance; Tinu/Denzil support | Finance-approved CGST/SGST/IGST/rounding/numbering/PDF/translated label/credit-note/export cases reconcile; unsafe CSV user text is escaped. |
| P2-T07 | Tinu coordinates; Josin; Mathew reviews | Eligible real provider test mandate enrollment/accelerated renewal, failure/shortage/pause/resume/cancel; exactly one authorized renewal effect. |
| P2-T08 | Tinu coordinates; Mathew with physician; Tinu executes | Approved dose/unit/timing/timezone/quantity/refill basis, schedule edit/end/consent revoke and missed-deadline policy invalidate stale jobs. |
| P2-T09 | Tinu coordinates; Mathew/Josin; Paul/Tinu UI | Doctor leave/location fees/buffer intervals/reschedule/late payment/refund remain consistent under simultaneous attempts across clinics. |
| P2-T10 | Tinu coordinates; Mathew/Devadathan with physician/privacy owner | Assigned doctor/consented summary/notes/recommendation versions, guardian/retention/export/deletion and unassigned/revoked negatives work. |
| P2-T11 | Tinu coordinates; Mathew/Josin with physician | Consult-to-cart accepts only matching valid signed recommendation; changed patient/product/expiry/quantity cannot bypass consult-only; dosage never rewritten. |
| P2-T12 | Tinu coordinates; Devadathan/Mathew; Paul/Tinu devices | Web/native private video, wrong/expired/revoked room, poor network/mic-camera denial/background/reconnect pass on actual Android/iOS devices. |
| P2-T13 | Tinu coordinates; Mathew; Denzil/Tinu content UI; physician | Editor/approver separation, draft/private/withdrawn KB, safety-block independent retrieval and primary current-version check are enforced. |
| P2-T14 | Tinu coordinates; Mathew with physician; Tinu coordinates | Execute at least 120 approved EN/ML/TA clinical/action cases plus 40 other-language/Romanized cases, with no critical unsafe/access failure. |
| P2-T15 | Tinu coordinates; Mathew with physician | Injection, urgent/no-sales, consult-only, unsupported claim/translation and missing safety context use approved denial/escalation with no fabricated dosage. |
| P2-T16 | Tinu coordinates; Mathew/Josin; Tinu records | Typed tools require identity/ownership/current state/explicit confirmation; changed amount/slot/session and replayed confirmations cannot force a side effect. |
| P2-T17 | Tinu coordinates; Mathew; Denzil/Tinu support UI | Staff takeover, bot/agent race, callback after hours, unanswered/resolution and consented summary have correct ownership/visibility. |
| P2-T18 | Tinu coordinates; Mathew; company channel owner; Tinu | Actual clinic WhatsApp/provider test text/voice/account-link/order/booking/secure checkout and staff replies use authorized state, not phone matching alone. |
| P2-T19 | Tinu coordinates; Devadathan/Mathew; Paul/Tinu devices | Web/native/WhatsApp editable voice handles denied permission, media bounds/expiry, numbers/units ambiguity and no unchecked action. |
| P2-T20 | Tinu coordinates; Tinu/Paul/Denzil; Devadathan/physician review | EN/ML/TA menus/store/workspaces/checkout/invoice labels/notifications, fonts/accessibility and missing-key audit pass; additional languages fall back safely. |
| P2-T21 | Tinu coordinates; Devadathan; Paul/Tinu devices | Both complete signed native candidates include subscriptions/history/loyalty/referral/wholesale customer scope, return/deep-link/push and private-cache/logout behavior. |
| P2-T22 | Tinu coordinates; Josin/Mathew; Paul/Tinu UI | Bundle/course discounts/caps/tax allocation preserve stock and consult-only restrictions and match web/native/WhatsApp totals. |
| P2-T23 | Tinu coordinates; Mathew; Denzil/Tinu; company marketing | Consented segments/templates/quiet hours/opt-out/delivery attribution and first campaign; no private clinical audience leakage. |
| P2-T24 | Tinu coordinates; Josin; Denzil/Tinu content; Mathew review | Seasonal promotion start/end/redemption limits and publication are enforced in the backend, not only the page. |
| P2-T25 | Tinu coordinates; Mathew/Josin; Tinu | One eligible delayed cart reminder, scoped expiring link and suppression after purchase/cancel/unsubscribe; retries do not repeat it. |
| P2-T26 | Tinu coordinates; Josin/Mathew; Denzil/Tinu UI | Only verified eligible buyers review, moderation works and doctor product content has approved versions. |
| P2-T27 | Tinu coordinates; Josin/Mathew with finance; Tinu | Referral eligibility/self-abuse, credit caps/redemption, duplicate reward/refund/return reversal and customer ledger totals pass. |
| P2-T28 | Tinu coordinates; Mathew/Josin; Denzil/Tinu UI | Two clinics' stock/doctor/staff/report scope and dispatched/received transfer retain batch traceability; recall finds affected customers. |
| P2-T29 | Tinu coordinates; Josin/Mathew; finance; Paul/Tinu UI | Distributor approval/assigned price/MOQ/pack/payment-term/GST/fulfillment audit; retail cannot self-upgrade or tamper terms. |
| P2-T30 | Tinu coordinates; Denzil/Tinu; Devadathan; company listing owner | Product schema/canonical/alternates/sitemap/redirects/feed validate and listing approvals remain explicit dependencies. |
| P2-T31 | Tinu coordinates; Josin/Mathew; Denzil/Tinu; company metric owners | Product/concern/city/clinic sales, repeats/refills/subscriptions and chat/consult conversion metrics reconcile after replay/refund with freshness/permission controls. |
| P2-T32 | Tinu coordinates; Devadathan/Mathew operate; Tinu tracks | Whole app authenticated code/dependency/secret/config/manual/dynamic review: ownership/injection/CSRF/CORS/files/links/mobile/service tools have no blocker or untriaged finding. |
| P2-T33 | Tinu coordinates; Devadathan/Mathew; Josin invariants | Queue priority/crash/duplicate/lease/DLQ/unknown provider and model timeout/saturation/KB withdrawal preserve durable obligations and safe core operation. |
| P2-T34 | Tinu coordinates; Devadathan operates; Mathew/Josin validate | Fifteen minutes at 20 dynamic requests/second with full mix/bounded jobs and controlled providers; record p95/errors/pool/CPU/cache/locks and no correctness/access breach or leak. |
| P2-T35 | Tinu coordinates; Devadathan operates; Mathew/Josin reconcile | Current-schema encrypted restore/object references, compatible Worker rollback and event reconciliation rehearsal pass with control totals. |
| P2-T36 | Tinu coordinates; Tinu coordinates; Devadathan/company owners | Draft role training/runbooks/support, complete release artifacts, actual account/template/store/listing status, cost/remaining-effort register and Day 7 paid configuration are ready. |

Clinical gate: every critical scenario passes; zero fabricated dosage, unauthorized access or prohibited action in the set; every displayed clinical block traces to current approved content. At least 95% approved completion on noncritical supported cases. Review weak/unsupported languages with named physicians; sample results are not universal safety proof.

## 10. Candidate freeze, environments and operational preparation

Publish full candidate commit/build/schema/config/model/prompt/KB versions and the exact native binaries before G2. Include event/role/API inventories, fixture/reset scripts, source control totals, provider real-versus-simulated modes, replay controls and restricted test identities. Use actual provider sandbox contract tests plus controlled adapters for load; do not bulk-message, charge or attack third parties.

Complete the paid verification configuration and representative data generation before Day 7. Staging contains synthetic data, and its credentials/queues/notifications cannot affect production. Initial 3,000-account/10,000-order retained fixtures are generated at realistic distributions; scale/size them to the expected retention model on the paid environment rather than forcing a Free-tier quota failure. Do not pad a database blob to pretend realistic query load.

Verify role/extension/RLS/migration/backup tooling and object manifests against the PostgreSQL version. Draft seven-day history, always-active production compute, alert/secret recovery, independent nightly dump/restore and schema-compatible rollout/rollback runbooks. Keep minimum patient/secret details in logs/artifacts. Expose any required paid scanner/build/CI/provider service as a cost/dependency; do not invent an unlimited free capability.

## 11. Gate G2 exit and Phase 3 handoff

G2 passes only when the complete required app functionality is working on all required channel implementations, all due original acceptance clauses and mandatory cumulative tests pass, and no blocker remains. R37 training materials may be drafts and R38 final timed paid recovery/operations drills remain Phase 3; R25/R34 external public approvals are separate tracked conditions. Any missing required application feature means Rework, not planned Phase 3 construction.

External store/provider/merchant/listing approval can remain pending only as an explicit owner/deadline/affected-R condition; it blocks final G3 if unresolved. Full tested native candidates are prepared here, then submitted on Day 7 after paid-environment regression. An incomplete placeholder submission never satisfies the schedule.

Handover the complete integrated candidate/binaries, full 38-row status/evidence register, 120+40 evaluation and physician approvals, route/role/device/language/financial test reports, defect/retest register, all company policies/content/opening data, approved provider contracts/credentials inventory, actual external statuses, reproducible paid environment/load/restore scripts, training/runbook drafts, cost dashboard and remaining-capacity forecast. Phase 3 inherits feature completion and spends its build allowance on demonstrated hardening/fixes only.


## 12. Evidence, defect handling and Gate G2 decision

Every task includes reviewed changes/configuration, schema compatibility, positive and negative cases, integrated UI/provider behavior, redacted telemetry and evidence against its R/output IDs. Source packages use the agreed modular repository; no extra independently operated backend is introduced. Suggested evidence organization is `artifacts/P2/<candidate>/`, with restricted access and no unnecessary patient/secrets content. These are proposed repository artifact paths, not files already generated by this planning exercise.

The gate report records commit/web/API/native builds, schema/config, model/prompt/KB versions, database compute/pool, dataset/devices/networks/provider modes, planned/executed/passed/failed/blocked tests, scans/manual findings, control totals, resource/recovery results, defects/fixes/retests, company reviews and external approvals. Initial state is Pending. Preserve failed runs and append retest results rather than rewriting history.

P0/Critical and P1/High issues stop acceptance. P2/Medium blocks if it violates a requirement, safety/privacy/money/access invariant or a due performance/recovery gate; other limited-impact issues require documented company acceptance, owner and fix date. P3/Low may remain only if genuinely nonblocking. All scan alerts are triaged; a false positive needs evidence. No confirmed critical/high vulnerability is waived to meet the calendar.

A fix creates a new candidate: reproduce the defect, independently review, run the reproducing/affected tests and cumulative critical suite, then rerun load/recovery/native/clinical tests where the change invalidates them. Do not blindly repeat unrelated long tests after a cosmetic edit, and do not reuse invalid evidence after a transaction/security/config change. No untested patch reaches public users.

Tinu assembles evidence, domain owners validate their work, and Mathew/Devadathan record the technical recommendation and company reviewers accept their domains. The decision is Pass or Rework; final public-release Go/No-go and safe postdeployment closure belong to G3. If blockers/approvals/effort prevent the gate, keep the full company scope and publish the revised forecast. No additional engineers, weekend construction or hidden overtime are assumed.

## 13. Company requirement coverage and acceptance trace

The company requirement and updated acceptance text below is synchronized with the reviewed master. Its readiness milestone distinguishes Phase 2 functional testing from Phase 3 final company/public/operational acceptance; full launch wording is not a claim of public delivery at G2. Package links identify implementation/verification responsibility; the master accountable workstream remains responsible even where another engineer supplies evidence.

| Requirement / company source | Original acceptance evidence | Accountable workstream | Master readiness milestone | Phase work-package coverage |
|---|---|---|---|---|
| R01 — Catalogue and shop by health concern; E4-5, C4 | All current-site products imported with variants, approved descriptions, images, prices, concern filters and stock visibility. Brand/certification claims approved by the clinic. | Josin | P2 functional; P3 company acceptance | P2-MAT-002, P2-MAT-005, P2-JOS-090, P2-DEV-001, P2-DEV-003, P2-DEV-004, P2-DEV-090, P2-PAU-001, P2-PAU-002, P2-PAU-003, P2-PAU-004, P2-PAU-090, P2-DEN-001, P2-DEN-003, P2-DEN-090, P2-TIN-001, P2-TIN-002, P2-TIN-090 |
| R02 — Cart and Indian checkout; E3-4, C4 | Web and native purchase through enabled UPI/card/net-banking/eligible EMI methods; COD rules enforced server-side; totals cannot be altered by clients. | Josin | P2 functional; P3 company acceptance | P2-MAT-005, P2-JOS-090, P2-DEV-001, P2-DEV-003, P2-DEV-004, P2-DEV-090, P2-PAU-001, P2-PAU-002, P2-PAU-003, P2-PAU-004, P2-PAU-090, P2-DEN-001, P2-TIN-001, P2-TIN-002, P2-TIN-090 |
| R03 — Accounts, addresses, history, reorder, tracking; E3, C4 | Verified user sees only their orders/invoices; repeat order uses current price, eligibility and available stock; tracking updates visible. | Mathew + Josin | P2 functional; P3 company acceptance | P2-MAT-001, P2-MAT-005, P2-JOS-001, P2-JOS-004, P2-JOS-090, P2-DEV-001, P2-DEV-003, P2-DEV-004, P2-DEV-090, P2-PAU-001, P2-PAU-002, P2-PAU-003, P2-PAU-004, P2-PAU-090, P2-DEN-001, P2-DEN-003, P2-DEN-090, P2-TIN-001, P2-TIN-002, P2-TIN-090 |
| R04 — Unified order desk including phone/walk-in/WhatsApp; E6, C6 | Staff create and fulfill an order with a recorded source; WhatsApp checkout produces the same order record; packing lists and cancellation/return/refund states are usable. | Josin | P2 functional; P3 company acceptance | P2-JOS-001, P2-JOS-004, P2-JOS-090, P2-DEV-001, P2-DEV-090, P2-PAU-001, P2-PAU-004, P2-PAU-090, P2-DEN-001, P2-DEN-090, P2-TIN-090 |
| R05 — Batch/expiry, low stock and near-expiry operations; E6, C6 | Batch ledger, expiry/shelf-life exclusion, FEFO allocation, low-stock alerts, adjustments and a recall lookup from batch to customers. Concurrent last-unit test passes. | Josin | P2 functional; P3 company acceptance | P2-MAT-005, P2-JOS-001, P2-JOS-090, P2-DEV-001, P2-PAU-001, P2-PAU-004, P2-DEN-001, P2-TIN-090 |
| R06 — Courier and pan-India fulfillment; E6-7 | Pincode serviceability, rates, courier label, pickup, tracking and COD reconciliation tested with the selected courier. Unserviceable addresses cannot check out. | Josin | P2 functional; P3 company acceptance | P2-JOS-001, P2-JOS-090, P2-DEV-001, P2-PAU-001, P2-PAU-004, P2-DEN-001, P2-TIN-090 |
| R07 — GST invoices, reconciliation and accounts export; E3, E6, C6 | Finance-approved CGST/SGST/IGST cases, numbering, PDF/translated display labels, refund credit-note process and monthly CSV export; a live charge/refund is reconciled. Issued invoices are automatically delivered through an approved private transactional link/document and delivery is reconciled, not merely generated. | Josin | P2 functional; P3 company acceptance | P2-MAT-004, P2-MAT-005, P2-JOS-001, P2-JOS-004, P2-JOS-090, P2-DEV-001, P2-DEV-090, P2-PAU-001, P2-PAU-004, P2-PAU-090, P2-DEN-001, P2-DEN-002, P2-DEN-090, P2-TIN-090 |
| R08 — Automated WhatsApp/SMS order updates; E3-4 | Confirmation, dispatch, out-for-delivery and delivery messages use real events/tracking links, approved templates and deduplication. Transactional invoice-ready delivery follows the finance-approved issuance milestone with receipt/retry/ownership evidence. | Mathew | P2 functional; P3 company acceptance | P2-MAT-004, P2-MAT-090, P2-JOS-001, P2-JOS-004, P2-DEV-003, P2-DEN-002, P2-DEN-090, P2-TIN-003, P2-TIN-090 |
| R09 — Recurring subscriptions; E4, E7, C4 | Authorize a real eligible mandate; cycle billing, exactly one renewal order, payment failure, pause/resume/cancel and stock-shortage handling verified. An accelerated sandbox renewal exercises the full cycle. | Josin | P2 functional; P3 company acceptance | P2-MAT-001, P2-MAT-004, P2-MAT-005, P2-JOS-002, P2-JOS-090, P2-DEV-001, P2-DEV-004, P2-DEV-090, P2-PAU-001, P2-PAU-002, P2-PAU-003, P2-PAU-004, P2-PAU-090, P2-DEN-001, P2-DEN-002, P2-TIN-090 |
| R10 — Refill and daily medicine schedules; E4, C4 | Physician-authored dose, morning/evening and before/after-food instructions drive timezone-aware reminders; refill quantity/due date uses the approved schedule or confirmed customer interval; edits/cancellation stop stale reminders. | Mathew | P2 functional; P3 company acceptance | P2-MAT-001, P2-MAT-004, P2-MAT-005, P2-MAT-090, P2-JOS-002, P2-DEV-001, P2-DEV-002, P2-DEV-003, P2-DEV-090, P2-PAU-001, P2-PAU-003, P2-PAU-090, P2-DEN-001, P2-DEN-002, P2-DEN-003, P2-DEN-090, P2-TIN-003, P2-TIN-090 |
| R11 — Physician directory, locations, slots, leave and fees; C4, C6 | Staff configure departments, credentials, languages, per-location hours, online/in-clinic slots, leave and default/per-doctor fees. Cross-location double booking is prevented. Authorized front desk can create source/actor-audited in-clinic outpatient bookings through the same doctor-global booking service; doctor qualifications/photo, slot length and online/in-clinic/both settings are included. | Mathew | P2 functional; P3 company acceptance | P2-MAT-001, P2-MAT-090, P2-JOS-004, P2-DEV-001, P2-DEV-002, P2-DEV-090, P2-PAU-001, P2-PAU-003, P2-PAU-090, P2-DEN-001, P2-DEN-003, P2-TIN-090 |
| R12 — Booking, fee payment, reschedule/cancel/refund; E4, C4 | One slot cannot be sold twice; holds expire; late payment is reconciled; notifications and policy-based refunds work. Staff-created outpatient appointments obey the same interval, fee, hold/payment, cancellation and refund invariants as customer bookings. | Mathew + Josin | P2 functional; P3 company acceptance | P2-MAT-001, P2-MAT-004, P2-MAT-005, P2-MAT-090, P2-JOS-004, P2-DEV-001, P2-DEV-002, P2-DEV-090, P2-PAU-001, P2-PAU-003, P2-PAU-090, P2-DEN-001, P2-DEN-002, P2-DEN-003, P2-TIN-090 |
| R13 — Embedded video consultations; C4 | Patient and assigned doctor join a private call inside web/native apps; permissions, poor network, reconnect and unauthorized joining are tested. | Devadathan + Mathew | P2 functional; P3 company acceptance | P2-MAT-001, P2-DEV-002, P2-DEV-090, P2-PAU-001, P2-PAU-003, P2-PAU-090, P2-TIN-090 |
| R14 — Physician panel and linked patient record; E6, E8, C6 | Doctor sees assigned consultations, permitted history and consented chat summary; records identity/consent, notes and recommendations with an audit trail. Assigned physicians see policy-permitted patient past orders; recorded identity/required consultation consent is enforced before private consultation access. | Mathew | P2 functional; P3 company acceptance | P2-MAT-001, P2-MAT-002, P2-MAT-005, P2-MAT-090, P2-JOS-004, P2-DEV-001, P2-DEV-002, P2-DEV-003, P2-DEV-090, P2-PAU-001, P2-PAU-003, P2-PAU-090, P2-DEN-001, P2-DEN-003, P2-DEN-090, P2-TIN-001, P2-TIN-002, P2-TIN-090 |
| R15 — Consult-to-cart; E4, C3-4 | Signed physician recommendation becomes an editable patient basket; consult-only products require a valid matching recommendation; dosage remains unchanged by the assistant. | Mathew + Josin | P2 functional; P3 company acceptance | P2-MAT-001, P2-MAT-005, P2-MAT-090, P2-DEV-001, P2-DEV-002, P2-DEV-090, P2-PAU-001, P2-PAU-003, P2-PAU-090, P2-DEN-001, P2-DEN-003, P2-TIN-090 |
| R16 — Approved knowledge-base editor; C4, C6 | Product monographs, departments/treatments, FAQs, policies and selected Ayurveda references support draft, named approval, version history, withdrawal and reviewed dosage/safety translations. All published catalogue products have required approved monographs and launch-language safety blocks by G2, with approved public physician profiles among the knowledge types; content reviewers see reconciled most-used-entry/version analytics and measured edit/withdrawal freshness. | Mathew | P2 functional; P3 company acceptance | P2-MAT-002, P2-MAT-004, P2-MAT-090, P2-DEV-001, P2-DEV-004, P2-DEV-090, P2-PAU-004, P2-PAU-090, P2-DEN-001, P2-DEN-003, P2-DEN-004, P2-DEN-090, P2-TIN-001, P2-TIN-003, P2-TIN-090 |
| R17 — Grounded, cited Companion; C3-4, C7 | Responses trace to currently approved entries and approving physician; missing/stale/unsupported medical knowledge produces an approved handoff response. | Mathew | P2 functional; P3 company acceptance | P2-MAT-002, P2-MAT-090, P2-DEV-002, P2-DEV-090, P2-PAU-003, P2-PAU-090, P2-DEN-003, P2-DEN-004, P2-DEN-090, P2-TIN-001, P2-TIN-003, P2-TIN-090 |
| R18 — Conversational product/order/refill/slot actions; C3-4 | Authenticated tools retrieve authorized records; add-to-cart, booking and payment steps require an explicit customer confirmation and display real current state. | Mathew | P2 functional; P3 company acceptance | P2-MAT-001, P2-MAT-002, P2-MAT-003, P2-MAT-005, P2-MAT-090, P2-DEV-002, P2-DEV-003, P2-DEV-090, P2-PAU-003, P2-PAU-090, P2-DEN-003, P2-DEN-090, P2-TIN-001, P2-TIN-002, P2-TIN-090 |
| R19 — Red flags, consult-only rules and disclaimers; C5, C7 | Physician test pack passes emergency/high-risk escalation; no diagnosis/cure promise; required disclaimer and named approval appear. No automated sale is initiated from a flagged conversation. Physician-approved minimal intake covers age/current medication and pregnancy/child/red-flag routing before personalized medical recommendation; unknown required data is clarified or handed off, never guessed. | Mathew | P2 functional; P3 company acceptance | P2-MAT-001, P2-MAT-002, P2-MAT-005, P2-MAT-090, P2-DEV-001, P2-DEV-002, P2-DEV-090, P2-PAU-003, P2-PAU-090, P2-DEN-003, P2-DEN-004, P2-DEN-090, P2-TIN-001, P2-TIN-003, P2-TIN-090 |
| R20 — Human handoff, callback and conversation review; C3, C6-7 | Staff take over an active chat with summary; assistant pauses; after-hours callback queues, WhatsApp acknowledgement, unanswered-question queue and resolution reporting work. | Mathew | P2 functional; P3 company acceptance | P2-MAT-002, P2-MAT-003, P2-MAT-090, P2-DEV-001, P2-DEV-002, P2-DEV-090, P2-PAU-003, P2-PAU-090, P2-DEN-001, P2-DEN-003, P2-DEN-004, P2-DEN-090, P2-TIN-001, P2-TIN-003, P2-TIN-090 |
| R21 — Same assistant on WhatsApp; C3-5, C8 | Real clinic number supports text/voice input, safe product actions, identity-linked order lookup, booking and a secure Razorpay checkout flow from the conversation. Staff can reply through the console. | Mathew | P2 functional; P3 company acceptance | P2-MAT-003, P2-MAT-090, P2-DEV-002, P2-PAU-003, P2-DEN-003, P2-DEN-090, P2-TIN-090 |
| R22 — English, Malayalam and Tamil application; C4 | Store, native app, menus, checkout, invoice labels and notifications have reviewed translations, usable fonts and no missing keys; medical wording is physician-reviewed. | Devadathan | P2 functional; P3 company acceptance | P2-MAT-002, P2-MAT-090, P2-DEV-001, P2-DEV-002, P2-DEV-004, P2-DEV-090, P2-PAU-001, P2-PAU-002, P2-PAU-003, P2-PAU-004, P2-PAU-090, P2-DEN-001, P2-DEN-003, P2-DEN-004, P2-DEN-090, P2-TIN-090 |
| R23 — Other Indian-language and Romanized conversations; C4 | Evaluate Hindi/Kannada/Telugu plus launch languages and representative Romanized inputs; preserve approved clinical text and fall back safely when a translation cannot be verified. | Mathew | P2 functional; P3 company acceptance | P2-MAT-002, P2-MAT-090, P2-DEV-002, P2-DEV-004, P2-DEV-090, P2-PAU-003, P2-PAU-004, P2-PAU-090, P2-DEN-003, P2-DEN-004, P2-DEN-090, P2-TIN-001, P2-TIN-003, P2-TIN-090 |
| R24 — Voice input; C4, C8 | Web/mobile microphone and WhatsApp voice messages transcribe into editable/reviewable text; permission denial and ambiguous numbers/units are handled. No action is triggered directly from an unchecked transcript. | Devadathan + Mathew | P2 functional; P3 company acceptance | P2-MAT-003, P2-MAT-090, P2-DEV-002, P2-DEV-004, P2-DEV-090, P2-PAU-003, P2-PAU-004, P2-PAU-090, P2-DEN-003, P2-DEN-090, P2-TIN-090 |
| R25 — Complete Android and iOS customer apps; E8, C8 | Both production apps include store, checkout, assistant, booking/video, reminders, subscriptions, history, loyalty and referrals; signed, reviewed, publicly obtainable releases. | Devadathan | P2 complete builds; P3 public store releases | P2-MAT-005, P2-DEV-002, P2-DEV-003, P2-DEV-004, P2-DEV-090, P2-PAU-001, P2-PAU-002, P2-PAU-003, P2-PAU-004, P2-PAU-090, P2-DEN-004, P2-TIN-001, P2-TIN-002, P2-TIN-003, P2-TIN-090 |
| R26 — Bundles and discounted courses; E7 | Approved product kits/course prices calculate consistently across channels and cannot bypass consult-only or stock restrictions. | Josin | P2 functional; P3 company acceptance | P2-MAT-005, P2-JOS-003, P2-JOS-090, P2-DEV-001, P2-DEV-004, P2-DEV-090, P2-PAU-001, P2-PAU-002, P2-PAU-003, P2-PAU-004, P2-PAU-090, P2-DEN-001, P2-TIN-090 |
| R27 — Opt-in WhatsApp campaigns and segments; E3, E7 | Staff send/schedule an approved template to a consented segment; opt-outs, quotas, delivery results and purchase attribution are visible. Health-interest segmentation requires explicit business/privacy approval. New-product, restock and seasonal campaigns work for consented prior-purchase segments, with current opt-out/quotas and no unauthorized clinical audience inference. | Mathew | P2 functional; P3 company acceptance | P2-MAT-002, P2-MAT-004, P2-MAT-090, P2-JOS-004, P2-DEV-003, P2-DEV-090, P2-PAU-002, P2-PAU-090, P2-DEN-002, P2-DEN-004, P2-DEN-090, P2-TIN-001, P2-TIN-003, P2-TIN-090 |
| R28 — Seasonal offers and landing pages; E7 | Staff publish/schedule a branded campaign page and valid promotion; start/end times and redemption limits are enforced; the first clinic-approved campaign is configured for launch. | Josin + Mathew | P2 functional; P3 company acceptance | P2-MAT-004, P2-JOS-003, P2-JOS-004, P2-DEV-004, P2-DEV-090, P2-PAU-002, P2-PAU-004, P2-PAU-090, P2-DEN-002, P2-DEN-004, P2-DEN-090, P2-TIN-090 |
| R29 — Abandoned-cart recovery; E7 | Eligible consented cart receives one scheduled reminder after the approved delay; completed/cancelled carts and unsubscribed users are suppressed; recovery link is scoped and expiring. | Mathew | P2 functional; P3 company acceptance | P2-MAT-002, P2-MAT-004, P2-MAT-090, P2-JOS-004, P2-DEV-003, P2-DEV-090, P2-PAU-002, P2-PAU-090, P2-DEN-002, P2-DEN-004, P2-DEN-090, P2-TIN-001, P2-TIN-003, P2-TIN-090 |
| R30 — Verified-buyer reviews and physician content; E7 | Review eligibility checks completed purchase; moderation and publication controls work; approved physician notes are visible beside products. | Josin + Mathew | P2 functional; P3 company acceptance | P2-JOS-004, P2-DEV-090, P2-PAU-002, P2-PAU-090, P2-DEN-002, P2-DEN-090, P2-TIN-090 |
| R31 — Referrals and loyalty; E7, C8 | Share link, eligible first-order credit, points/credit ledger, redemption caps, refund reversal and basic self-referral/fraud prevention pass. | Josin | P2 functional; P3 company acceptance | P2-MAT-005, P2-JOS-003, P2-JOS-090, P2-DEV-004, P2-DEV-090, P2-PAU-001, P2-PAU-002, P2-PAU-003, P2-PAU-090, P2-DEN-002, P2-DEN-090, P2-TIN-090 |
| R32 — Multiple clinics; E8 | Location-specific stock, physician availability, staff access and sales reports work for two configured clinics; inter-location stock moves retain batch traceability. | Mathew + Josin | P2 functional; P3 company acceptance | P2-MAT-001, P2-MAT-090, P2-JOS-001, P2-DEV-001, P2-DEV-002, P2-PAU-001, P2-PAU-003, P2-PAU-004, P2-DEN-001, P2-TIN-090 |
| R33 — Wholesale/distributor ordering; E8 | Approved business account sees assigned price list, MOQ/pack size and permitted payment terms; account approval, fulfillment and GST records are auditable. | Josin | P2 functional; P3 company acceptance | P2-MAT-005, P2-JOS-003, P2-JOS-090, P2-DEV-004, P2-DEV-090, P2-PAU-001, P2-PAU-002, P2-PAU-003, P2-PAU-090, P2-DEN-002, P2-DEN-090, P2-TIN-090 |
| R34 — SEO and shopping/business listings; E3, E7 | Product schema, canonical URLs, language alternates, sitemap, redirects and merchant product feed validate; company listing linkage is configured. Required merchant/feed approvals are recorded; approval pending is distinguished from a working feed and remains an open launch requirement. | Devadathan | P2 validated feeds/pages; P3 required listing approvals | P2-DEV-004, P2-DEV-090, P2-PAU-004, P2-PAU-090, P2-DEN-004, P2-DEN-090, P2-TIN-090 |
| R35 — Sales, retention and clinical conversion reports; E6-7, C6, C8 | Product/concern/city/clinic sales, repeat rate, refill due/lapsed, subscription state, conversation-to-cart/order/booking/handoff, and consultation-to-order metrics reconcile to operational records. Permissioned content reports also show defined, deduplicated knowledge-entry/version answer-usage counts without raw health prompts. | Josin + Mathew | P2 functional; P3 company acceptance | P2-MAT-002, P2-MAT-004, P2-MAT-090, P2-JOS-004, P2-JOS-090, P2-DEV-003, P2-DEV-004, P2-DEV-090, P2-PAU-004, P2-PAU-090, P2-DEN-003, P2-DEN-004, P2-DEN-090, P2-TIN-001, P2-TIN-003, P2-TIN-090 |
| R36 — Roles, privacy, audit and ownership; C6-7 | Per-role and per-record tests pass; sensitive actions are logged; accounts, source, data and deployment access belong to the company; consent/retention workflows operate. Versioned required sign-up/privacy consent remains distinct from optional marketing consent; per-consultation identity/consent and private access are enforced. | Mathew + Devadathan | P2 functional; P3 company acceptance | P2-MAT-001, P2-MAT-002, P2-MAT-004, P2-MAT-005, P2-MAT-090, P2-MAT-099, P2-JOS-099, P2-DEV-001, P2-DEV-002, P2-DEV-003, P2-DEV-004, P2-DEV-090, P2-DEV-099, P2-PAU-003, P2-PAU-004, P2-PAU-099, P2-DEN-001, P2-DEN-003, P2-DEN-004, P2-DEN-099, P2-TIN-001, P2-TIN-002, P2-TIN-003, P2-TIN-090, P2-TIN-080, P2-TIN-099 |
| R37 — Onboarding and recorded training; C8 | Front desk, warehouse, finance and physicians each complete role-specific scenarios; recordings, guides, access recovery and incident contacts are handed over. | Devadathan + domain owners | P2 guide drafts; P3 recorded training/acceptance | P2-MAT-002, P2-DEV-003, P2-DEV-004, P2-DEV-090, P2-PAU-003, P2-PAU-004, P2-DEN-004, P2-TIN-001, P2-TIN-003, P2-TIN-090 |
| R38 — Production operations and maintenance readiness; E6, C8 | Monitoring, backups, tested restore, release/rollback, payment reconciliation, escalation ownership and scheduled content-review procedures are operating. Handover explicitly includes monthly physician flagged-conversation review, quarterly operating reports, security/app-release/priority-fix workflow, proposed eight-hour monthly knowledge-update allowance and agreed overflow; healthy due-job pickup p95 <2 minutes and a defined 99.9% rolling-month internal availability objective are measured/configured, not claimed as prelaunch achieved SLA. | Devadathan | P1 foundations; P2 integrated controls; P3 recovery/operations proof | P2-MAT-002, P2-MAT-004, P2-MAT-005, P2-MAT-099, P2-JOS-004, P2-JOS-099, P2-DEV-003, P2-DEV-090, P2-DEV-099, P2-PAU-099, P2-DEN-004, P2-DEN-099, P2-TIN-001, P2-TIN-002, P2-TIN-003, P2-TIN-090, P2-TIN-080, P2-TIN-099 |

## 14. Completion and handoff checklist

- [ ] Every due phase output and work package has reviewed integration evidence and reconciled hours/dependencies.
- [ ] All current/due mandatory functional, negative-security, clinical, device and resilience tests have executed and passed.
- [ ] No unresolved blocker or untriaged finding remains; fixes identify the tested candidate and independent retest.
- [ ] Requirement statuses distinguish implemented/integrated/tested/company-accepted/publicly-verified and expose external dependencies.
- [ ] Environment/data/provider modes, actual resource usage and cost/approval risks are recorded.
- [ ] Company reviewers accept their due milestones; G2 report and decision are stored with exact artifacts.
- [ ] Next-phase inputs or final handover are complete; no required feature is silently deferred or disabled.

**Document boundary:** This is the detailed Phase 2 execution plan. Member execution documents will repeat these assigned IDs, inputs, deliverables and checks across all phases; they will not alter this gate, architecture, scope or capacity.
