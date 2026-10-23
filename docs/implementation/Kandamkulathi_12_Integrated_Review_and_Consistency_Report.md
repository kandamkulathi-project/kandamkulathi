# Kandamkulathi — integrated plan, ownership and QA consistency review

**Reviewed:** 19 October 2026. **Scope:** 11 active planning documents, four earlier architecture plans and both company proposal texts. **Review type:** source-to-plan coverage and cross-document consistency. **Application status:** no application source/deployment/provider accounts or executed test results were supplied; all implementation/test/approval states remain Pending.

**Verdict:** The reviewed document set now covers all R01–R38 at the planning/ownership/testing level and reconciles the three phases, six people, branches and gates. The initial set had real documentary conflicts and insufficiently explicit proposal details; these were corrected in place. This is **not** an application production-readiness Pass or evidence that the ten-day workload is achievable. Reuse, actual estimates, external approvals and executed acceptance gates still control that decision.

## 1. Findings and corrections

| Finding | Initial severity | Evidence / consequence | Correction | Status |
|---|---|---|---|---|
| F01 — Two competing role/hour/day schedules | High | Master/phase plans retained E1–E6 allocations while members used Mathew/Josin/Devadathan/Paul/Denzil/Tinu. A top notice did not remove actionable contradictory tables. | Replaced current master ownership and phase registers/day grids with named allocations identical to member documents. Retained all 103 old package IDs as unbudgeted technical references, with obsolete reviewer/hour instructions retired. | Corrected in documents. |
| F02 — Small company subrequirements were absent or too implicit | High | Counting 38 R rows hid missing detail: complete approved KB coverage, most-used KB entry report, explicit intake/consent, front-desk OP bookings/patient past orders, invoice delivery, all campaign types and maintenance cadence. | Expanded existing R acceptance/task/test assertions via C01–C08 below; no company feature cut or invented extra release. Preserved privacy, clinical/finance approval and senior-owned sensitive work. | Corrected as planned work; implementation/evidence Pending. |
| F03 — Phase 2 verification prose contradicted named hours | Medium | The old campaign said one early V hour for E1–E5 plus three for E6. New allocation has four V hours for each non-Tinu member and 12 for Tinu. | Explicitly reserve final four V hours for all six; Tinu has eight additional earlier V hours. The named daily grids reconcile exactly; earlier developer component checks remain in B/review work. | Corrected. |
| F04 — Two independently maintained detailed test copies | Medium | Tinu’s member plan contained a long embedded test annex while document 11 was the expanded canonical specification. | Removed the current duplicate annex; member plan retains tasks/hours/branches and points directly to the standalone tests. All members now link directly to document 11. | Corrected. |
| F05 — Several “final” architecture alternatives still appeared current | High | Unnumbered files described Medusa/AWS, RDS/Cognito, D1 and an older Neon schedule/cost baseline. Selecting by “Final” could lead to the wrong stack. | Marked all four as superseded historical alternatives and published current document precedence. Active architecture remains Workers Paid + Neon PostgreSQL from development; no D1 migration/rewrite. | Corrected. |
| F06 — Shared test windows could invalidate measured results | Medium | Load/soak/fault/restore campaigns appeared on the same day without an explicit resource/window contention rule. Parallel work could corrupt fixtures or confound benchmarks. | Added protected measurement windows, separately verified fault/recovery targets or serialized runs, exact resource/provider manifest and explicit operator/cost accounting in master, Phase 3, Devadathan/Tinu plans and canonical tests. | Control documented; actual staffing/targets/windows Pending. |
| F07 — Date/capacity estimate was not validated by real assets | High | Two experienced developers own clinical/backend/AI plus frontend/native/platform/review. No proven reusable modules, provider eligibility or timed test rehearsal was supplied. | Retained Day 1 reuse/effort proof and No-go/reforecast rules; no scope/test reduction or new engineer/overtime was inserted. Approved core designs/brand assets remain an explicit company readiness input. | Open delivery condition; cannot be closed by document editing. |
| KAN-189 — Five named readiness packages lacked requirement/output links | Medium | P1-JOS-080, P1-PAU-080, P2-PAU-080, P1-DEN-080 and P2-DEN-080 contained empty Requirements/Outputs fields despite the package completion rule. Their phase registers have no corresponding legacy technical reference. | Added direct links to existing master §2 requirements and Phase 1/2 §3 outputs, with package-local source rationale. Clarified early-phase preparation versus Phase 3 live acceptance, public installs, recorded training and final handover. No technical IDs invented; hours, budget, gate criteria and duties unchanged. The repository checker now rejects empty, unknown and wrong-phase package traceability. | Documentary links corrected; independent review, execution and company/provider approvals remain Pending. |

## 2. Explicit proposal sub-acceptance restored

| ID | Company source and requirement IDs | Explicit coverage / owner / tests |
|---|---|---|
| C01 — Complete approved product knowledge and bounded refresh | Companion pp. 4, 8–9: initial approved knowledge covers every website product; updated approved content reaches answers. R01, R16, R17 | Reconcile every published catalogue product to its physician-approved monograph/dosage/contraindication and required EN/ML/TA safety translations. No published product is an unexplained coverage gap. G1 records the complete inventory/gap register and an approved sample; G2 closes required product coverage and demonstrates approved edit/withdrawal propagation within a company-agreed measured freshness deadline. The illustrative morning-to-afternoon statement is not an invented numeric provider SLA. Include approved public physician profiles and the required knowledge types; approval is not satisfied by catalogue text alone. Named packages: P1-MAT-003, P1-DEN-002, P2-MAT-002, P2-DEN-003, P3-MAT-001. Tests: P1-T12, P2-T13, P3-T09 and corresponding F-R walkthroughs. |
| C02 — Knowledge entry usage analytics | Companion p. 6: staff can see which knowledge entries the assistant uses most. R16, R35 | Record privacy-minimized answer-to-approved-entry/version attribution, not raw health prompts in general analytics. Content reviewers can view most-used entry/version counts with date filters and freshness labels. Define whether counts represent used answer entries or retrieval hits; count retries once by stable answer/event identity and reconcile known fixtures. Unauthorized roles cannot access the content report. Named packages: P2-MAT-002, P2-MAT-004, P2-DEN-003, P2-DEN-004, P3-DEN-002. Tests: P2-T13, P2-T31, P3-T15 and corresponding F-R walkthroughs. |
| C03 — Explicit intake and consent checkpoints | Companion pp. 5, 7: age/current medication screening, pregnancy/children/red flags; sign-up consent and recorded video consultation identity/consent. R14, R19, R36 | Capture versioned required sign-up/privacy consent without bundling marketing opt-in; record and enforce required consultation identity/consent before private video/clinical access. Before personalized medical recommendation, follow physician-approved minimal intake including age/current medication and pregnancy/child/red-flag routing; unknown or declined required information uses approved clarification/handoff. Do not impose clinical intake on ordinary public catalogue browsing or infer a diagnosis. Verify configured transport and at-rest protection for clinical database/private objects/backups and approved processor flows using actual configuration/provider evidence; no plaintext secret/health-content evidence dump. Named packages: P1-MAT-001, P1-MAT-003, P1-DEV-003, P2-MAT-001, P2-MAT-002, P2-DEV-001, P2-DEV-002, P3-MAT-001. Tests: P1-T02, P1-T13, P2-T10, P2-T15, P3-T08, P3-T10 and corresponding F-R walkthroughs. |
| C04 — Front-desk outpatient booking and permitted patient order history | Companion pp. 6, 8: staff enter outpatient bookings; assigned doctors see permitted patient past orders. R03, R11, R12, R14 | Authorized front desk creates an in-clinic outpatient appointment in the same canonical booking lifecycle with source/staff actor and correct clinic fee/payment/refund state; use the same global doctor overlap constraints. It cannot be confused with a walk-in product order. Assigned physicians see policy-permitted past purchases in the linked patient view; unassigned/revoked/cross-patient/clinic access remains denied. Doctor management also includes approved qualifications/photo, slot length and online/in-clinic/both availability settings; front-desk operational readiness is demonstrated before public launch. Named packages: P1-MAT-002, P2-MAT-001, P2-JOS-004, P2-DEV-001, P2-DEN-001, P3-MAT-001. Tests: P2-T04, P2-T09, P2-T10, P3-T07, P3-T08 and corresponding F-R walkthroughs. |
| C05 — Automatic invoice delivery, not only PDF generation | Ecommerce pp. 3–4, 6: GST invoice generated and sent with every order. R07, R08 | After the finance-approved issuance milestone, create a durable idempotent invoice-ready delivery obligation and send the customer an approved private/scoped invoice link or document through the permitted transactional channel. Generated PDF alone is not delivery evidence. Verify receipt, one effective delivery/reconciliation, retries, expiry/ownership and customer history; no public invoice URL or marketing-consent shortcut. Named packages: P2-JOS-001, P2-JOS-004, P2-MAT-004, P3-JOS-002. Tests: P2-T06, P2-T33, P3-T06, P3-T17 and corresponding F-R walkthroughs. |
| C06 — New-product, restock and seasonal past-buyer campaigns | Ecommerce pp. 3, 7: opted-in past buyers segmented by what they bought; new-product, restock and seasonal campaigns. R27, R28 | Demonstrate all three approved campaign types: new product, restock and seasonal offer. Build consented prior-purchase segments from authorized commerce facts, with preview/counts, quotas, quiet hours, current opt-out and deduplicated attribution. No raw clinical notes or inferred health-interest audience without explicit business/privacy approval; live sending uses company-controlled approved recipients. Named packages: P2-MAT-004, P2-JOS-004, P2-DEN-002, P3-MAT-002, P3-DEN-001. Tests: P2-T23, P2-T24, P3-T16, P3-T17 and corresponding F-R walkthroughs. |
| C07 — Explicit maintenance calendar and ownership | Ecommerce pp. 6, 8; Companion pp. 7–8: security updates/app releases/priority fixes, monthly flagged-conversation review, knowledge-update allowance and quarterly report. R37, R38 | Hand over a dated maintenance calendar: daily reconciliation; weekly access/job/backup/capacity/security checks; monthly physician review of flagged conversations and knowledge changes; quarterly operating/performance report. Name primary/backup owners, priority-fix/security/app-release workflow, and the proposal’s up-to-eight-hours-per-month knowledge-maintenance allowance with an agreed overflow/response process. These are support obligations/operating labor, not extra sprint capacity, new subscription pricing, or automatically created reminders. Named packages: P2-MAT-002, P2-DEV-003, P2-DEN-004, P3-MAT-080, P3-DEV-080, P3-DEN-080, P3-TIN-080. Tests: P2-T36, P3-T28, P3-T29 and corresponding F-R walkthroughs. |
| C08 — Numeric job pickup and availability measurement | Accepted master §§11–12: healthy-state due-job pickup p95 <2 minutes and 99.9% monthly core availability objective. R10, R38 | Measure healthy-state due-to-claim pickup p95 below two minutes with agreed server timestamps/sample size while preserving current consent/version/deadline suppression. During fault/backlog tests separately measure deadline recovery and alerts. Configure a defined 30-day core-availability SLI/dashboard and 99.9% internal objective, exclusions and owner; ten-day prelaunch tests cannot prove achieved monthly availability and do not imply a paid vendor SLA or 24-hour clinician staffing. Named packages: P1-DEV-001, P2-MAT-004, P2-DEV-003, P3-DEV-001, P3-DEV-090. Tests: P1-T20, P2-T33, P3-T21, P3-T23, P3-T28 and corresponding F-R walkthroughs. |

The 38 top-level requirements remain unchanged in identity. These are clarifications from the actual source details, not claims that new code/tests already exist. The proposal’s original six commercial phases are represented by the user's later three-phase/ten-working-day schedule. Preserve staff/back-office operational readiness before public release; historical patient/order migration remains expressly excluded. Full UI launch languages remain EN/ML/TA, with safety-gated additional-language/Romanized conversation rather than silently promising full UI translation into every language. Proposal prices/payment terms and provider bills are not instructions to purchase, send or accept contracts.

## 3. Verified capacity and responsibility

| Phase | Dates | B implementation / QA preparation | V verification | E environment / handover | C reserve | Total |
|---|---|---:|---:|---:|---:|---:|
| 1 | D1–D3: 19–21 October | 92 h | 32 h | 8 h | 12 h | 144 h |
| 2 | D4–D6: 22, 23, 26 October | 96 h | 32 h | 4 h | 12 h | 144 h |
| 3 | D7–D10: 27–30 October | 36 h | 80 h | 36 h | 40 h | 192 h |
| **Total** | **10 working days; six people** | **224 h** | **144 h** | **48 h** | **64 h** | **480 h / 60 person-days** |

Each member has 24/24/32 hours, totaling 80. B includes 18 hours of Tinu’s QA preparation/tool maintenance; she owns no critical product feature. Her direct V allocation is 44 hours across the sprint, supported by all five others. The same named daily category tables appear in phase and member documents, with every day totaling eight hours and protected G1/G2 final-half-day testing intact.

Mathew and Devadathan together have 160 gross hours and only **86 B hours** for their combined implementation/integration/review duties, with other time protected for verification/release/reserve. Their extensive critical ownership cannot be treated as proof that greenfield backend/AI/native/platform work fits. Josin owns commerce with Mathew’s mandatory sensitive-code review. Paul/Denzil retain bounded UI/content/support work. Tinu coordinates QA; Mathew/Devadathan operate advanced checks and company reviewers approve clinical/finance/privacy expectations.

## 4. Branch, handoff and gate consistency

The actual current phase/member files contain **109 named package allocations** and **109 unique planned branch names**, retaining all **103** technical source references. Branch names were checked with **git check-ref-format passed** and compared between phase registers/member tables/task bodies; all recorded QA branches in the standalone test document exist in that plan. No branch was created and no repository protection was configured by this review.


- Every feature/test/chore branch starts from latest `dev` and PRs back to `dev`; direct shared-branch development is disallowed. Review-only work needs review evidence, not an empty branch. Issue-ID suffixes are examples used only for actual defects.
- Small reviewed contracts/fixtures unblock parallel bounded screens. Mutual contract handoffs are not a promise that all tasks can run independently; Day 1 readiness and actual contract delivery remain critical-path conditions. Named dependency IDs all resolve.
- Mathew and Devadathan review each other’s critical changes; Mathew reviews Josin’s money/stock/mandate/webhook/credit work; Devadathan reviews junior UI with domain input. No author self-approves critical code.
- Freeze exact `dev` candidate SHA/artifacts/schema/config/model/KB. A fix creates a new immutable candidate and invalidates impacted evidence. Resolve conflicts before freezing and verify tested tree/artifact equivalence during promotion.
- G1/G2 Pass permits reviewed `dev` → `main`; those accepted development milestones do not auto-deploy an incomplete public system. Phase 3 prelaunch Go permits promotion/controlled rollout; actual public-channel smoke/observation/handover closes G3 and the final tag.
- Production hotfixes start at `main`, receive review/impacted testing and merge back to `dev`. Migration execution is controlled by Devadathan with Mathew backup; feature previews use isolated synthetic resources.

## 5. All-company requirement coverage

Every row below was checked against the current master, named phase/member packages and canonical F-R acceptance. “Covered” means documented scope/ownership/procedure; every real result and company/public approval is still Pending.

| Requirement | Company scope | Named accountable owner | Acceptance walkthrough | Planning coverage |
|---|---|---|---|---|
| R01 | Catalogue and shop by health concern | Josin | F-R01 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R02 | Cart and Indian checkout | Josin | F-R02 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R03 | Accounts, addresses, history, reorder, tracking | Mathew + Josin | F-R03 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R04 | Unified order desk including phone/walk-in/WhatsApp | Josin | F-R04 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R05 | Batch/expiry, low stock and near-expiry operations | Josin | F-R05 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R06 | Courier and pan-India fulfillment | Josin | F-R06 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R07 | GST invoices, reconciliation and accounts export | Josin | F-R07 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R08 | Automated WhatsApp/SMS order updates | Mathew | F-R08 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R09 | Recurring subscriptions | Josin | F-R09 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R10 | Refill and daily medicine schedules | Mathew | F-R10 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R11 | Physician directory, locations, slots, leave and fees | Mathew | F-R11 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R12 | Booking, fee payment, reschedule/cancel/refund | Mathew + Josin | F-R12 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R13 | Embedded video consultations | Devadathan + Mathew | F-R13 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R14 | Physician panel and linked patient record | Mathew | F-R14 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R15 | Consult-to-cart | Mathew + Josin | F-R15 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R16 | Approved knowledge-base editor | Mathew | F-R16 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R17 | Grounded, cited Companion | Mathew | F-R17 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R18 | Conversational product/order/refill/slot actions | Mathew | F-R18 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R19 | Red flags, consult-only rules and disclaimers | Mathew | F-R19 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R20 | Human handoff, callback and conversation review | Mathew | F-R20 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R21 | Same assistant on WhatsApp | Mathew | F-R21 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R22 | English, Malayalam and Tamil application | Devadathan | F-R22 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R23 | Other Indian-language and Romanized conversations | Mathew | F-R23 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R24 | Voice input | Devadathan + Mathew | F-R24 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R25 | Complete Android and iOS customer apps | Devadathan | F-R25 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R26 | Bundles and discounted courses | Josin | F-R26 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R27 | Opt-in WhatsApp campaigns and segments | Mathew | F-R27 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R28 | Seasonal offers and landing pages | Josin + Mathew | F-R28 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R29 | Abandoned-cart recovery | Mathew | F-R29 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R30 | Verified-buyer reviews and physician content | Josin + Mathew | F-R30 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R31 | Referrals and loyalty | Josin | F-R31 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R32 | Multiple clinics | Mathew + Josin | F-R32 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R33 | Wholesale/distributor ordering | Josin | F-R33 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R34 | SEO and shopping/business listings | Devadathan | F-R34 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R35 | Sales, retention and clinical conversion reports | Josin + Mathew | F-R35 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R36 | Roles, privacy, audit and ownership | Mathew + Devadathan | F-R36 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R37 | Onboarding and recorded training | Devadathan + domain owners | F-R37 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |
| R38 | Production operations and maintenance readiness | Devadathan | F-R38 in [canonical tests](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) | Covered; application evidence Pending. |

## 6. Phase testing and final delivery consistency

The canonical document retains 20 P1 + 36 P2 + 30 P3 scenario groups and 38 dedicated requirement walkthroughs. Each relevant negative/boundary/role/channel/fault variation is a separate run record; a procedure/group is not one click or one universal Pass. Reuse valid exact-candidate evidence where assertions overlap, without skipping assertions. The latest walkthroughs include explicit C01–C08 checks and paired expected results.

G1 verifies the actual foundation subset. G2 requires all functional company features, complete signed native candidates, approved core/additional-language clinical evaluation and integrated operations. G3 proves paid configuration, cumulative acceptance, sustained/burst/soak and failure isolation, real-device/video/model/queue behavior, timed recovery/rollback, company training/ownership and actual public channel approvals. Confirmed critical/high vulnerabilities and safety/privacy/financial/acceptance blockers fail the gate; tests cannot certify absence of every possible defect.

Numeric gates remain aligned: G1 10 rps/10 minutes and G2 20 rps/15 minutes are baseline campaigns; G3 60 rps/30 minutes, 120 rps/five minutes and 20 rps/four-hour soak on stated data/mix, India read p95 <500 ms/write <1 s, unexpected errors <1% and zero tested invariant/access breaches. Five simultaneous two-person calls, ten active model generations plus overload and 120+40 approved AI cases remain required. Repeat every critical AI case three times in G3. Healthy due-job pickup p95 <2 minutes is now explicit in the tests. Configure a 99.9% rolling-month internal availability objective; a ten-day prelaunch campaign cannot prove monthly achieved availability.

PITR RPO ≤15 minutes/full validated resume ≤2 hours and compatible Worker/web rollback ≤15 minutes remain measured operating targets. Independent nightly export RPO can be up to 24 hours, with its own measured restoration time; it is not automatic two-hour cross-provider failover. Prior supported native contracts must remain compatible; app-store rollback is not instant Worker rollback.

R25 public Android/iOS, R34 required listing approval, live required provider eligibility and recorded R37 company training are final milestones, not satisfied by a complete internal build/mock/submission. R38 includes measured operating controls and the explicit maintenance handover. Prelaunch and postdeployment closure remain distinct.

## 7. Remaining real-world conditions before committing to launch

1. **Prove reusable assets and actual estimates.** No repository/code, licensed finished domain modules or successful native/payment/video proof was supplied. Measure implementation/review remaining work and specialist capability against the named hours before treating the date as committed.
2. **Time the QA campaign.** The large specification is not evidence that every required variation and physician evaluation fits 32/32/80 team V hours. Use proven automation, early continuous execution and shared valid evidence; rehearse execution/operator timings. Reforecast if essential tests cannot finish, rather than skipping them or making Tinu solely responsible.
3. **Bind exact test oracles/resources.** Actual URLs/API collection/device versions/fixtures/golden finance rules/clinical approvals/consent, retention, freshness and support policy remain required inputs. Approved core designs/brand assets and company reviewers must be available. Missing data is Blocked, not a guessed expected answer.
4. **Validate actual service accounts and public approvals.** Store production eligibility/reviews, mandate/payment methods, clinic number/templates/SMS sender/courier/listings and clinician availability are external dependencies. The ten-day plan cannot guarantee their approval dates.
5. **Execute capacity/security/recovery on real intended configuration.** The document review does not show the app can handle 1,000+ daily users smoothly. Passing measured workload/security/clinical/provider/device/recovery gates is required. Configure isolated measurement windows and reconcile resource/cost effects.
6. **Recheck procurement/privacy/support assumptions.** Region/processor/data flows, actual feature entitlements/quotas, current vendor prices/exchange rate/tax/usage and maintenance/on-call agreement were not independently revalidated here. The active cost model was checked for a single baseline, not a fresh price quote. Support labor and operational usage remain distinct from cheap hosting.

These are explicit conditions, not a reason to cut company requirements or silently change the agreed stack. If any blocks the complete release, record Rework/No-go, actual incomplete acceptance and a revised forecast.

## 8. Current files and precedence

- [Kandamkulathi_01_Master_Implementation_Plan_3_Phases.md](Kandamkulathi_01_Master_Implementation_Plan_3_Phases.md) — current, updated where needed.
- [Kandamkulathi_02_Phase_1_Foundations_and_Core_Journeys.md](Kandamkulathi_02_Phase_1_Foundations_and_Core_Journeys.md) — current, updated where needed.
- [Kandamkulathi_03_Phase_2_Complete_Features_and_Integration.md](Kandamkulathi_03_Phase_2_Complete_Features_and_Integration.md) — current, updated where needed.
- [Kandamkulathi_04_Phase_3_Production_Verification_and_Launch.md](Kandamkulathi_04_Phase_3_Production_Verification_and_Launch.md) — current, updated where needed.
- [Kandamkulathi_05_Mathew_All_Phases.md](Kandamkulathi_05_Mathew_All_Phases.md) — current, updated where needed.
- [Kandamkulathi_06_Josin_All_Phases.md](Kandamkulathi_06_Josin_All_Phases.md) — current, updated where needed.
- [Kandamkulathi_07_Devadathan_All_Phases.md](Kandamkulathi_07_Devadathan_All_Phases.md) — current, updated where needed.
- [Kandamkulathi_08_Paul_All_Phases.md](Kandamkulathi_08_Paul_All_Phases.md) — current, updated where needed.
- [Kandamkulathi_09_Denzil_All_Phases.md](Kandamkulathi_09_Denzil_All_Phases.md) — current, updated where needed.
- [Kandamkulathi_10_Tinu_QA_and_Test_Cases_All_Phases.md](Kandamkulathi_10_Tinu_QA_and_Test_Cases_All_Phases.md) — current, updated where needed.
- [Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) — current, updated where needed.

The four unnumbered architecture plans are retained with explicit superseded notices. Source proposals remain company requirement evidence; they do not override the later human decisions on team, stack, ten days and three phases.

## 9. Validation evidence

| Check | Result |
|---|---|
| Master / all three phase acceptance and accountable-owner rows | 38/38 match |
| Named phase registers against member task tables and bodies | 109/109 match |
| Named member package requirement/output traceability (KAN-189) | 109 packages checked for nonempty valid master requirements and same-phase outputs; five readiness mappings have source rationale. This is not acceptance evidence. |
| Retained technical references | 103/103 assigned; zero separate obsolete allocation |
| Planned branch uniqueness and syntax | 109 unique; git check-ref-format passed |
| Named dependency IDs and clarification task references | All resolve |
| Daily/phase/person/category capacity | Every day 8 h; every person 24/24/32; team 144/144/192 =480 |
| Protected G1/G2 testing | Four final-half-day V hours each; Tinu has eight additional early V hours |
| Canonical phase/functional test IDs | 86 unique phase groups and 38 unique F-R walkthroughs |
| Latest action / expected-result pairs | 684; includes 254 functional pairs |
| Legacy detailed test duplication | Removed from current Tinu member plan; canonical document 11 |
| Historical architecture ambiguity | Four files explicitly superseded |
| Markdown tables / local links / encoding / code fences | Checked in current outputs |
| Actual application tests / provider approvals | Not executed or supplied; all remain Pending |

**Final review conclusion:** document-level coverage and internal consistency now pass the listed checks. Full production delivery and ten-day feasibility remain conditional on the real-world evidence above; this report is not a launch authorization.
