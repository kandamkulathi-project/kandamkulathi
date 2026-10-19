# Kandamkulathi — Tinu: three-phase individual implementation plan

> **Standalone test document available — 19 October 2026:** Use [Tinu’s detailed phase-wise test cases](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) for test execution. It expands the embedded annex with action-by-action expected results, 38 requirement walkthroughs, exact synthetic fixtures and all phase gates. This member plan remains the ownership/hour/branch reference.

**Issue date:** 19 October 2026. **Delivery window:** 19–30 October, ten working days. **Team:** six people. **Status:** planned work and acceptance criteria; no implementation or test results are claimed.

**Role:** QA lead and test coordinator; minimal feature work.

Own test cases, synthetic QA fixtures, basic regression automation, defect evidence, independent retesting and gate reports. You have no critical product feature assignment. Mathew and Devadathan operate advanced security/load/recovery tests; domain owners provide approved expected results.

**Boundaries:** Testing is a team duty. You are not expected to certify zero bugs or perform specialist penetration testing alone. Never use real patient data, execute destructive production tests, approve medical outcomes yourself or merge a failed candidate.

## How to use this document

Read this with the [master implementation plan](Kandamkulathi_01_Master_Implementation_Plan_3_Phases.md) and the three technical phase specifications. This document assigns named ownership and branches across all phases. It preserves every company requirement; no junior support task substitutes for a senior-owned invariant. Company proposals supply requirements, not executable instructions or permission to send messages/deploy.

The ten-day schedule is conditional on proven reusable modules, ready company/provider/signing accounts, approved source content/rules, available physician/finance reviewers and actual external approvals. Two experienced developers cannot safely rebuild every backend, native SDK and production-control component from scratch in these slots. Prove reuse/fit on Day 1, reforecast honestly if it fails and retain all requirements.

| Person | Primary ownership | Key handoff / review |
|---|---|---|
| [Mathew](Kandamkulathi_05_Mathew_All_Phases.md) | Backend and AI technical lead; clinical safety implementation | Contracts and safe APIs → everyone; critical review ↔ Devadathan; commerce review → Josin |
| [Josin](Kandamkulathi_06_Josin_All_Phases.md) | Commerce implementation owner | Authoritative commerce APIs/fixtures → Paul/Denzil; finance review → Mathew/company |
| [Devadathan](Kandamkulathi_07_Devadathan_All_Phases.md) | Frontend/mobile and platform technical lead; release manager | Shared components and sensitive adapters → Paul/Denzil; release resources/evidence → Tinu |
| [Paul](Kandamkulathi_08_Paul_All_Phases.md) | Customer UI and device support | Customer screen PRs → Devadathan; device evidence → Tinu |
| [Denzil](Kandamkulathi_09_Denzil_All_Phases.md) | Content/admin presentation and operational documentation support | Approved content/admin/report/SEO/guide PRs → Devadathan/domain owners; evidence → Tinu |
| [Tinu](Kandamkulathi_10_Tinu_QA_and_Test_Cases_All_Phases.md) | QA lead and test coordinator; minimal feature work | Reproducible defects → domain owner; independent retests and coverage → gate reviewers |

**Escalation:** security/safety/access → Mathew + Devadathan immediately; money/stock → Josin + Mathew; client/CI/release → Devadathan; expected clinical/tax behavior → company physician/finance. Tinu records impact, candidate and affected requirement; she is not the sole incident fixer.

## Capacity and review discipline

| Phase | Implementation / QA prep | Verification | Environment / handover | Defect reserve | Total hours |
|---|---:|---:|---:|---:|---:|
| 1 | 8 | 12 | 2 | 2 | 24 |
| 2 | 8 | 12 | 2 | 2 | 24 |
| 3 | 2 | 20 | 3 | 7 | 32 |
| **Total** | 18 | 44 | 7 | 11 | **80** |

All six total **480 person-hours / 60 person-days**. Phase category totals remain: P1 92 implementation + 32 verification + 8 environment + 12 reserve = 144 h; P2 96 + 32 + 4 + 12 = 144 h; P3 36 + 80 + 36 + 40 = 192 h. Tinu’s implementation category is QA preparation/tooling, not product feature work. Her direct verification allocation is 12/12/20 h; all five others also test. Reserve is conditional, not prebooked feature capacity.

Mathew/Devadathan must review sensitive PRs as part of these allocations, with small early PRs and stable interfaces. Split a bounded helper/screen to Paul/Denzil if appropriate; never transfer financial/clinical/security decisions just to clear a review queue. Reforecast when actual review/fix work exceeds capacity.

## Branching, review and phase promotion

The proposed `main` / `dev` workflow is suitable. Each feature has its own branch **created from the latest `dev`**, then a reviewed pull request back into `dev`. Nobody develops directly on shared `dev` or `main`.

1. Protect both branches against direct pushes, force-pushes and unreviewed merges. Require relevant type/build, domain regression, secret/dependency/security and migration checks. A green build alone does not pass a phase.
2. Use the exact branch listed for each package below. One owner per branch. Tests/docs/chore branches also start from `dev` and target `dev`. Keep PRs bounded; do not mix unrelated fixes. Review-only work needs a review record, not an empty branch.
3. Mathew and Devadathan review each other’s critical changes. Mathew reviews Josin’s money/stock/subscription/credit/webhook changes. Devadathan reviews Paul/Denzil’s UI; Mathew or Josin also reviews relevant clinical/commerce boundaries. No author self-approves. Medical/tax expectations additionally require physician/finance approval.
4. Feature previews use isolated synthetic resources. Migrations are additive, ordered and independently reviewed. Devadathan is the controlled migration/deployment operator; Mathew is backup. A feature branch must never automatically migrate shared or production data.
5. Before each broad campaign, freeze `dev` at an exact SHA and create immutable candidate tags such as `rc-p1-g1-01`, `rc-p2-g2-01` and `rc-p3-g3-01`. Record API/web/native build IDs, schema/migration IDs, configuration, providers, model/prompt and KB versions. Tinu tests that exact deployed candidate. Freeze unrelated merges until the gate decision.
6. Fixes during the freeze use a short branch from the current frozen `dev`, PR back to `dev`, a **new** candidate tag and targeted plus critical cumulative retesting. Never overwrite a candidate tag. Other work may continue on isolated branches, but cannot change the tested candidate. Store execution evidence in CI artifacts/the test tracker; avoid changing the application merely to attach results.
7. After G1/G2 pass, Devadathan opens/merges the reviewed promotion PR `dev` → `main` using a regular merge that preserves ancestry. For Phase 3, the recorded **prelaunch Go** permits this promotion and controlled deployment; final G3 closure follows postdeployment checks. Do not squash/rebase the entire phase. Resolve conflicts before freezing/testing. Check that the promoted source tree matches the tested candidate, promote the tested artifacts and run post-merge critical smoke; a source/configuration difference requires retesting.
8. Tag accepted milestones on `main` as `phase-1-approved`, `phase-2-approved`, and, after final production checks, `v1.0.0`. Phase 1/2 merges represent accepted development milestones. They must **not** automatically publish an incomplete system to production. Gate production deployment separately until the Phase 3 prelaunch decision; close G3 only after postdeployment verification and required public channels pass.
9. Synchronize any promotion merge/hotfix history from `main` back into `dev` through a reviewed merge. Production hotfixes start from `main`, for example `hotfix/bug-001-payment-reconcile`, require review/impacted testing, then merge back into `dev`. Do not reset away integration history.

Example for a clean working tree and existing repository (substitute your assigned branch from the table):

```text
git fetch origin
git switch dev
git pull --ff-only origin dev
git switch -c YOUR_ASSIGNED_BRANCH
git push -u origin YOUR_ASSIGNED_BRANCH
```

Open a PR with **base `dev`**, the package/R IDs, behavior, test evidence, risk and reviewer. The example is an instruction for the future application repository; no repository changes are performed by this planning document.

## Fixed technical boundaries

- Workers Paid / Hono / TypeScript / Zod for APIs; Neon PostgreSQL 17 / Drizzle for core, clinical and engagement schemas; WorkOS AuthKit with staff organization/MFA requirements. Use PostgreSQL from the first development day, not a D1 implementation followed by a rewrite.
- Astro/React public web, React/Vite workspaces, Expo/React Native Android/iOS; R2 storage, Vectorize approved-public RAG, OpenAI through backend-only adapters; Razorpay, Shiprocket, WhatsApp, SMS, email and push integrations. Keep provider models/SDK versions pinned to the validated architecture manifest; changing them invalidates affected evidence.
- Authoritative money/stock/booking state and durable outbox commit together in short transactions. No external network call inside a database transaction. Jobs use idempotency, leases, bounded retries, deadline/version/consent checks and safe reconciliation of uncertain results.
- Clinical records never enter the public RAG corpus. Mandatory medical blocks come from currently approved primary records, independently of vector ranking. All actions require identity, scope, current state and explicit confirmation; urgent cases use approved no-sale escalation.
- Neon Free may support synthetic development while actual quotas permit; control scheduled jobs and measure usage. Switch to paid production-equivalent verification on Day 7. Initial production architecture uses Singapore, 0.25–1 CU tuning range and scale-to-zero disabled; verify data-location approval and measured capacity. No promise of India-only storage.
- Production recovery: configured seven-day PITR, separately encrypted nightly exports with seven daily/four weekly retention and immutable object manifests. Demonstrate ≤15-minute PITR recovery point, ≤2-hour restoration/validation/resume and ≤15-minute compatible Worker/web rollback. Independent nightly export recovery point can be up to 24 hours. Native rollback requires compatible APIs/store processes.

These assignments change ownership, not company scope, accepted architecture or the cost assumptions in the master plan. No service purchase, live campaign or production deployment is performed by writing this document.

## Phase gates and common completion rules

G1 ends Day 3; G2 ends Day 6. The **last four hours of each day are protected for all six people** to test the complete current candidate. Tinu has additional continuous-testing time earlier in each phase. By G2 all functional company requirements must be implemented across the required channels; final public approvals, measured production operation and recorded handover close in Phase 3.

Phase 3 reserves Days 7–9 for the broad paid-candidate campaign, fixes/retests and company acceptance; Day 10 for the conditional prelaunch decision, controlled rollout, safe postdeployment checks and handover. Submit complete native candidates after Day 7 paid regression and track actual approval. TestFlight/internal builds or a submission receipt do not equal public Android/iOS delivery. External approval timing can block the ten-day full-scope completion.

A package is complete only when implementation, review, relevant tests, requirement/output links and safe evidence are complete. A phase cannot pass with unresolved confirmed critical/high vulnerabilities, safety/privacy/financial defects or acceptance blockers. Triage all findings; document false positives with evidence. Only company-approved low-risk residuals may have named owners/dates. Passing tests provides evidence of readiness, not proof that no bug exists.

If readiness, reuse, reviewer availability or external approvals fail, record **Rework / No-go**, owner and revised forecast. Preserve all requirements and gate rigor; do not claim hidden scope removal, zero defects, guaranteed app-store approval or unbounded overtime.

## Phase 1: Foundations and real core journeys

**Window:** Days 1–3 · 19–21 October 2026. **Capacity:** 24 hours; implementation/QA preparation 8, verification 12, environment/handover 2, reserve 2.

This is a capacity ceiling for adapting proven components and completing the allocated scope, including review within the relevant package. It is not a measured greenfield estimate. Escalate missing reuse and review overload on Day 1; do not consume protected test time to hide it.

**Sequence and handoff checkpoints**

- D1: cases/fixture register, role accounts, defect workflow and early smoke.
- D2: continuous independent tests as slices merge, approved clinical/finance expected results and reproducible defects.
- D3 morning: freeze-readiness check, fixture reset and run allocation. Final four hours: coordinate G1 and execute assigned cases; collect specialist evidence.

The checkpoints order work; they do not add hours beyond the phase budget. G1/G2 verification must include the protected four-hour final-half-day allocation. Phase 3 specialist campaigns may run in parallel, with a named operator and safe provider controls.

**Daily capacity aligned to the phase plan**

| Working day | B: implementation / QA prep | V: verification | E: environment / handover | C: reserve | Total |
|---|---:|---:|---:|---:|---:|
| Day 1 | 5 | 2 | 1 | 0 | 8 |
| Day 2 | 3 | 4 | 1 | 0 | 8 |
| Day 3 | 0 | 6 | 0 | 2 | 8 |

B/V/E/C are daily capacity slices, not new tasks. Review/meetings count within these hours. Follow this member’s package sequence and handoff contracts; do not double-book tasks. Reserve is conditional and otherwise supports verification/handover. On the final day, schedule four V hours in the protected final half-day for everyone; Tinu also has two earlier V hours. Background test runtime is not extra staffed capacity; record actual operator/reviewer time.

**Named test execution/support groups:** P1-T01, P1-T02, P1-T03, P1-T04, P1-T05, P1-T06, P1-T07, P1-T08, P1-T09, P1-T10, P1-T11, P1-T12, P1-T13, P1-T14, P1-T15, P1-T16, P1-T17, P1-T18, P1-T19, P1-T20. The detailed procedures are in Tinu’s annex. These are minimum named duties; also help with impacted cumulative regression and the shared gate. Tinu coordinates execution rather than replacing the listed specialist/domain operator.

**Entry and dependencies:** Start from approved company content/rules, reusable SDK proof, company accounts and synthetic fixtures. Mathew/Josin publish contracts before parallel screens. Devadathan provides components and environment access.

| Package | Hours | Branch from `dev`; PR to `dev` |
|---|---:|---|
| P1-TIN-001 — Prepare Phase 1 cases and gate tracking | 3 | `test/p1-tinu-foundation-test-cases` |
| P1-TIN-002 — Prepare synthetic test accounts and boundary fixtures | 3 | `test/p1-tinu-synthetic-qa-fixtures` |
| P1-TIN-003 — Basic repeatable smoke automation | 2 | `test/p1-tinu-foundation-regression` |
| P1-TIN-090 — G1 verification and cumulative regression | 12 | `test/p1-tinu-g1-verification` |
| P1-TIN-080 — Environment, acceptance and handover support | 2 | `chore/p1-tinu-readiness-handover` |
| P1-TIN-099 — Protected defect/retest reserve | 2 | `fix/p1-tinu-bug-001` |

### P1-TIN-001 — Prepare Phase 1 cases and gate tracking

**Allocated time:** 3 hours (implementation / QA preparation). **Branch:** `test/p1-tinu-foundation-test-cases` → `dev`.

**Inputs and integration handoffs:** P1-DEV-001, P1-MAT-001. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Convert this document’s Phase 1 scenarios into test-run records.
2. Record candidate/role/channel/data preconditions and approved expected results.
3. Create defect severity/retest templates and independent-review assignments.
4. Reserve the final four hours of Day 3 for G1 broad testing with all six people.

**Deliver and verify:** Executable case register, evidence index and planned G1 run.

**Required review:** Domain implementer supplies evidence; independent peer retests; senior/company reviewers approve gates. No self-approval of critical changes.

**Handoff:** Send reproducible failures to the named domain implementer, specialist requests to Mathew/Devadathan, and independent retest/coverage reports to the gate reviewers. Record every missing prerequisite explicitly.

**Traceability:** P1-E6-002, P1-E5-004. Requirements: R10, R17, R19, R20, R22, R23, R35, R36, R38. Outputs: P1-O01, P1-O07, P1-O08, P1-O09.

### P1-TIN-002 — Prepare synthetic test accounts and boundary fixtures

**Allocated time:** 3 hours (implementation / QA preparation). **Branch:** `test/p1-tinu-synthetic-qa-fixtures` → `dev`.

**Inputs and integration handoffs:** P1-MAT-001, P1-JOS-001, P1-DEV-001. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Request scoped customer/staff/doctor accounts from Mathew, without handling production credentials.
2. Prepare patient/clinic boundaries, stock/payment/booking/KB/consent fixture IDs.
3. Verify reset scripts only target isolated test resources with Devadathan.
4. Keep approved clinical expected answers physician-signed and versioned.

**Deliver and verify:** Reusable fixture catalogue, reset instructions and readiness record.

**Required review:** Domain implementer supplies evidence; independent peer retests; senior/company reviewers approve gates. No self-approval of critical changes.

**Handoff:** Send reproducible failures to the named domain implementer, specialist requests to Mathew/Devadathan, and independent retest/coverage reports to the gate reviewers. Record every missing prerequisite explicitly.

**Traceability:** P1-E1-002, P1-E2-001, P1-E6-003. Requirements: R01, R02, R03, R05, R07, R08, R09, R10, R14, R18, R19, R26, R31, R33, R36, R38. Outputs: P1-O02, P1-O03, P1-O08.

### P1-TIN-003 — Basic repeatable smoke automation

**Allocated time:** 2 hours (implementation / QA preparation). **Branch:** `test/p1-tinu-foundation-regression` → `dev`.

**Inputs and integration handoffs:** P1-DEV-001, P1-MAT-001. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Use the existing harness to automate login/navigation/read-only API/status smoke where practical.
2. Keep money/concurrency/security harness implementation with Josin/Mathew/Devadathan.
3. Record assertions against persisted state through reviewed read-only helpers.
4. Run checks before freeze; store results as artifacts, not unnecessary application commits.

**Deliver and verify:** Repeatable smoke suite and initial failure/triage record.

**Required review:** Domain implementer supplies evidence; independent peer retests; senior/company reviewers approve gates. No self-approval of critical changes.

**Handoff:** Send reproducible failures to the named domain implementer, specialist requests to Mathew/Devadathan, and independent retest/coverage reports to the gate reviewers. Record every missing prerequisite explicitly.

**Traceability:** P1-E6-002. Requirements: R10, R36, R38. Outputs: P1-O01, P1-O08, P1-O09.

### P1-TIN-090 — G1 verification and cumulative regression

**Allocated time:** 12 hours (verification). **Branch:** `test/p1-tinu-g1-verification` → `dev`.

Merge necessary test-code changes before freeze; run results belong in the evidence store. Do not invalidate the frozen candidate with an evidence-only application change.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Coordinate the frozen-candidate campaign, execute the detailed cases in the annex, collect specialist results, independently retest fixes and report requirement coverage. Verify evidence versions, untriaged findings and external approval status. A test is Pending/Blocked until executed on the correct candidate.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Domain implementer supplies evidence; independent peer retests; senior/company reviewers approve gates. No self-approval of critical changes.

**Handoff:** Send reproducible failures to the named domain implementer, specialist requests to Mathew/Devadathan, and independent retest/coverage reports to the gate reviewers. Record every missing prerequisite explicitly.

**Traceability:** P1-E1-090, P1-E2-090, P1-E3-090, P1-E4-090, P1-E5-090, P1-E6-090. Requirements: R01, R02, R03, R04, R05, R07, R08, R09, R11, R12, R13, R14, R15, R16, R17, R18, R19, R20, R21, R22, R24, R25, R36, R38. Outputs: P1-O09.

### P1-TIN-080 — Environment, acceptance and handover support

**Allocated time:** 2 hours (environment / handover). **Branch:** `chore/p1-tinu-readiness-handover` → `dev`.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Maintain candidate/test/approval/evidence registers, schedule company UAT, document gate decisions and confirm training/support/ownership completeness. Execute safe public-channel postdeployment checks with domain owners; never mark an external pending item Passed.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Domain implementer supplies evidence; independent peer retests; senior/company reviewers approve gates. No self-approval of critical changes.

**Handoff:** Send reproducible failures to the named domain implementer, specialist requests to Mathew/Devadathan, and independent retest/coverage reports to the gate reviewers. Record every missing prerequisite explicitly.

**Traceability:** P1-E1-080, P1-E6-080. Requirements: R36, R38. Outputs: P1-O01, P1-O03, P1-O09.

### P1-TIN-099 — Protected defect/retest reserve

**Allocated time:** 2 hours (conditional reserve). **Branch:** `fix/p1-tinu-bug-001` → `dev`.

Create this branch only if a matching defect actually exists; the suffix shown is an example. Test execution alone does not require a code branch.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Use only against an actual tracked defect; replace bug-001 with the real issue ID. Reproduce, contain and route to the correct owner; independently retest a reviewed fix on a new candidate. Tinu uses this for triage/retesting, not critical feature coding. Paul/Denzil fix only bounded UI/content defects. If unused, broaden verification/handover; do not add scope or count the reserve as guaranteed repair capacity.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Domain implementer supplies evidence; independent peer retests; senior/company reviewers approve gates. No self-approval of critical changes.

**Handoff:** Send reproducible failures to the named domain implementer, specialist requests to Mathew/Devadathan, and independent retest/coverage reports to the gate reviewers. Record every missing prerequisite explicitly.

**Traceability:** P1-E1-099, P1-E2-099, P1-E3-099, P1-E4-099, P1-E5-099, P1-E6-099. Requirements: R36, R38. Outputs: P1-O09.

### Phase 1 personal handoff and gate checklist

- All assigned packages have reviewed PRs or explicit blocked/conditional status; no direct shared-branch changes.
- APIs/components/content/fixtures are handed to the named dependent owner with examples and known limits.
- Tests include positive, negative, authorization/current-state, retry/failure and relevant persisted-state checks.
- Tinu has exact candidate metadata, requirement/output links, screenshots/request IDs, defects and independent retest references.
- Domain/company reviewers have approved medical/finance/content expectations where needed.
- No unresolved blocker is hidden by a UI workaround, disabled feature, mock provider or skipped test.
- Promotion waits for G1/G2 Pass or the Phase 3 prelaunch Go; Devadathan handles the reviewed merge to `main`. Final G3 closure and `v1.0.0` follow successful postdeployment checks.

## Phase 2: Complete features and integration

**Window:** Days 4–6 · 22, 23 and 26 October 2026. **Capacity:** 24 hours; implementation/QA preparation 8, verification 12, environment/handover 2, reserve 2.

This is a capacity ceiling for adapting proven components and completing the allocated scope, including review within the relevant package. It is not a measured greenfield estimate. Escalate missing reuse and review overload on Day 1; do not consume protected test time to hide it.

**Sequence and handoff checkpoints**

- D4: all-feature case coverage and cumulative regression on incoming slices.
- D5: full-channel/device/locale scenarios and physician-approved AI evaluation; assign advanced tests to seniors.
- D6 morning: exact-candidate readiness and blocker retest. Final four hours: coordinate G2 broad campaign and signed evidence.

The checkpoints order work; they do not add hours beyond the phase budget. G1/G2 verification must include the protected four-hour final-half-day allocation. Phase 3 specialist campaigns may run in parallel, with a named operator and safe provider controls.

**Daily capacity aligned to the phase plan**

| Working day | B: implementation / QA prep | V: verification | E: environment / handover | C: reserve | Total |
|---|---:|---:|---:|---:|---:|
| Day 4 | 5 | 2 | 1 | 0 | 8 |
| Day 5 | 3 | 4 | 1 | 0 | 8 |
| Day 6 | 0 | 6 | 0 | 2 | 8 |

B/V/E/C are daily capacity slices, not new tasks. Review/meetings count within these hours. Follow this member’s package sequence and handoff contracts; do not double-book tasks. Reserve is conditional and otherwise supports verification/handover. On the final day, schedule four V hours in the protected final half-day for everyone; Tinu also has two earlier V hours. Background test runtime is not extra staffed capacity; record actual operator/reviewer time.

**Named test execution/support groups:** P2-T01, P2-T02, P2-T03, P2-T04, P2-T05, P2-T06, P2-T07, P2-T08, P2-T09, P2-T10, P2-T11, P2-T12, P2-T13, P2-T14, P2-T15, P2-T16, P2-T17, P2-T18, P2-T19, P2-T20, P2-T21, P2-T22, P2-T23, P2-T24, P2-T25, P2-T26, P2-T27, P2-T28, P2-T29, P2-T30, P2-T31, P2-T32, P2-T33, P2-T34, P2-T35, P2-T36. The detailed procedures are in Tinu’s annex. These are minimum named duties; also help with impacted cumulative regression and the shared gate. Tinu coordinates execution rather than replacing the listed specialist/domain operator.

**Entry and dependencies:** G1 must pass first. Build on accepted contracts and reviewed components; keep Phase 1 critical tests running. Complete actual features by G2; track pending public approvals explicitly for Phase 3.

| Package | Hours | Branch from `dev`; PR to `dev` |
|---|---:|---|
| P2-TIN-001 — Complete all-feature and cumulative case inventory | 3 | `test/p2-tinu-full-scope-test-cases` |
| P2-TIN-002 — Regression automation and defect reproduction | 3 | `test/p2-tinu-integration-regression` |
| P2-TIN-003 — Misuse, localization and integration test data | 2 | `test/p2-tinu-misuse-boundary-fixtures` |
| P2-TIN-090 — G2 verification and cumulative regression | 12 | `test/p2-tinu-g2-verification` |
| P2-TIN-080 — Environment, acceptance and handover support | 2 | `chore/p2-tinu-readiness-handover` |
| P2-TIN-099 — Protected defect/retest reserve | 2 | `fix/p2-tinu-bug-001` |

### P2-TIN-001 — Complete all-feature and cumulative case inventory

**Allocated time:** 3 hours (implementation / QA preparation). **Branch:** `test/p2-tinu-full-scope-test-cases` → `dev`.

**Inputs and integration handoffs:** P2-MAT-001, P2-JOS-004, P2-DEV-004. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Prepare all Phase 2 cases plus mandatory Phase 1 regression.
2. Verify every R01–R38 has a named owner, due milestone and test/evidence status.
3. Include actual provider/device/clinical fixtures and explicit external approval gaps.
4. Assign specialist test execution to Mathew/Devadathan/domain owners.

**Deliver and verify:** Full-scope G2 execution matrix with no unowned requirement.

**Required review:** Domain implementer supplies evidence; independent peer retests; senior/company reviewers approve gates. No self-approval of critical changes.

**Handoff:** Send reproducible failures to the named domain implementer, specialist requests to Mathew/Devadathan, and independent retest/coverage reports to the gate reviewers. Record every missing prerequisite explicitly.

**Traceability:** P2-E6-001, P2-E5-004. Requirements: R01, R02, R03, R14, R16, R17, R18, R19, R20, R23, R25, R27, R29, R35, R36, R37, R38. Outputs: P2-O03, P2-O05, P2-O06, P2-O07.

### P2-TIN-002 — Regression automation and defect reproduction

**Allocated time:** 3 hours (implementation / QA preparation). **Branch:** `test/p2-tinu-integration-regression` → `dev`.

**Inputs and integration handoffs:** P2-DEV-003. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Extend existing smoke automation for repeatable customer/staff/core API journeys.
2. Add regression reproduction for fixed defects with peer-reviewed expected state.
3. Run safe automation continuously; avoid automation that only mirrors implementation.
4. Link failed runs, issue IDs, fix PRs and new candidate IDs.

**Deliver and verify:** Cumulative regression results and independent retest evidence.

**Required review:** Domain implementer supplies evidence; independent peer retests; senior/company reviewers approve gates. No self-approval of critical changes.

**Handoff:** Send reproducible failures to the named domain implementer, specialist requests to Mathew/Devadathan, and independent retest/coverage reports to the gate reviewers. Record every missing prerequisite explicitly.

**Traceability:** P2-E6-001. Requirements: R01, R02, R03, R14, R18, R25, R36, R38. Outputs: P2-O06, P2-O07.

### P2-TIN-003 — Misuse, localization and integration test data

**Allocated time:** 2 hours (implementation / QA preparation). **Branch:** `test/p2-tinu-misuse-boundary-fixtures` → `dev`.

**Inputs and integration handoffs:** P2-MAT-002, P2-JOS-001, P2-DEV-003. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Prepare denied-role/cross-clinic/expired-link/consent-revoked/KB-withdrawn fixtures.
2. Coordinate physician-approved 120+40 AI cases and finance/courier/mandate scenarios.
3. Check fixture reset isolation and candidate provider mode before tests.
4. Book real Android/iOS devices and company UAT reviewers for G2/G3.

**Deliver and verify:** Approved boundary fixture packs and ready G2 test environment.

**Required review:** Domain implementer supplies evidence; independent peer retests; senior/company reviewers approve gates. No self-approval of critical changes.

**Handoff:** Send reproducible failures to the named domain implementer, specialist requests to Mathew/Devadathan, and independent retest/coverage reports to the gate reviewers. Record every missing prerequisite explicitly.

**Traceability:** P2-E5-004, P2-E6-002, P2-E6-003. Requirements: R08, R10, R16, R17, R19, R20, R23, R25, R27, R29, R35, R36, R37, R38. Outputs: P2-O03, P2-O05, P2-O06, P2-O07.

### P2-TIN-090 — G2 verification and cumulative regression

**Allocated time:** 12 hours (verification). **Branch:** `test/p2-tinu-g2-verification` → `dev`.

Merge necessary test-code changes before freeze; run results belong in the evidence store. Do not invalidate the frozen candidate with an evidence-only application change.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Coordinate the frozen-candidate campaign, execute the detailed cases in the annex, collect specialist results, independently retest fixes and report requirement coverage. Verify evidence versions, untriaged findings and external approval status. A test is Pending/Blocked until executed on the correct candidate.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Domain implementer supplies evidence; independent peer retests; senior/company reviewers approve gates. No self-approval of critical changes.

**Handoff:** Send reproducible failures to the named domain implementer, specialist requests to Mathew/Devadathan, and independent retest/coverage reports to the gate reviewers. Record every missing prerequisite explicitly.

**Traceability:** P2-E1-090, P2-E2-090, P2-E3-090, P2-E4-090, P2-E5-090, P2-E6-090. Requirements: R01, R02, R03, R04, R05, R06, R07, R08, R09, R10, R11, R12, R13, R14, R15, R16, R17, R18, R19, R20, R21, R22, R23, R24, R25, R26, R27, R28, R29, R30, R31, R32, R33, R34, R35, R36, R37, R38. Outputs: P2-O07.

### P2-TIN-080 — Environment, acceptance and handover support

**Allocated time:** 2 hours (environment / handover). **Branch:** `chore/p2-tinu-readiness-handover` → `dev`.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Maintain candidate/test/approval/evidence registers, schedule company UAT, document gate decisions and confirm training/support/ownership completeness. Execute safe public-channel postdeployment checks with domain owners; never mark an external pending item Passed.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Domain implementer supplies evidence; independent peer retests; senior/company reviewers approve gates. No self-approval of critical changes.

**Handoff:** Send reproducible failures to the named domain implementer, specialist requests to Mathew/Devadathan, and independent retest/coverage reports to the gate reviewers. Record every missing prerequisite explicitly.

**Traceability:** P2-E6-080. Requirements: R36, R38. Outputs: P2-O06, P2-O07.

### P2-TIN-099 — Protected defect/retest reserve

**Allocated time:** 2 hours (conditional reserve). **Branch:** `fix/p2-tinu-bug-001` → `dev`.

Create this branch only if a matching defect actually exists; the suffix shown is an example. Test execution alone does not require a code branch.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Use only against an actual tracked defect; replace bug-001 with the real issue ID. Reproduce, contain and route to the correct owner; independently retest a reviewed fix on a new candidate. Tinu uses this for triage/retesting, not critical feature coding. Paul/Denzil fix only bounded UI/content defects. If unused, broaden verification/handover; do not add scope or count the reserve as guaranteed repair capacity.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Domain implementer supplies evidence; independent peer retests; senior/company reviewers approve gates. No self-approval of critical changes.

**Handoff:** Send reproducible failures to the named domain implementer, specialist requests to Mathew/Devadathan, and independent retest/coverage reports to the gate reviewers. Record every missing prerequisite explicitly.

**Traceability:** P2-E1-099, P2-E2-099, P2-E3-099, P2-E4-099, P2-E5-099, P2-E6-099. Requirements: R36, R38. Outputs: P2-O07.

### Phase 2 personal handoff and gate checklist

- All assigned packages have reviewed PRs or explicit blocked/conditional status; no direct shared-branch changes.
- APIs/components/content/fixtures are handed to the named dependent owner with examples and known limits.
- Tests include positive, negative, authorization/current-state, retry/failure and relevant persisted-state checks.
- Tinu has exact candidate metadata, requirement/output links, screenshots/request IDs, defects and independent retest references.
- Domain/company reviewers have approved medical/finance/content expectations where needed.
- No unresolved blocker is hidden by a UI workaround, disabled feature, mock provider or skipped test.
- Promotion waits for G1/G2 Pass or the Phase 3 prelaunch Go; Devadathan handles the reviewed merge to `main`. Final G3 closure and `v1.0.0` follow successful postdeployment checks.

## Phase 3: Production verification, acceptance and launch

**Window:** Days 7–10 · 27–30 October 2026. **Capacity:** 32 hours; implementation/QA preparation 2, verification 20, environment/handover 3, reserve 7.

This is a capacity ceiling for adapting proven components and completing the allocated scope, including review within the relevant package. It is not a measured greenfield estimate. Escalate missing reuse and review overload on Day 1; do not consume protected test time to hide it.

**Sequence and handoff checkpoints**

- D7: paid regression and complete signed native-candidate checks; invalidate evidence on any relevant change.
- D8: execute assigned functional/device cases while seniors run load/security/recovery; monitor soak evidence and independent retests.
- D9: complete cumulative campaign and company UAT evidence; report blockers and untested scope explicitly.
- D10: report prelaunch status, execute safe postdeployment/public-install cases, and close G3 only after all requirements/handover pass.

The checkpoints order work; they do not add hours beyond the phase budget. G1/G2 verification must include the protected four-hour final-half-day allocation. Phase 3 specialist campaigns may run in parallel, with a named operator and safe provider controls.

**Daily capacity aligned to the phase plan**

| Working day | B: implementation / QA prep | V: verification | E: environment / handover | C: reserve | Total |
|---|---:|---:|---:|---:|---:|
| Day 7 | 1 | 6 | 0 | 1 | 8 |
| Day 8 | 0 | 6 | 0 | 2 | 8 |
| Day 9 | 1 | 5 | 1 | 1 | 8 |
| Day 10 | 0 | 3 | 2 | 3 | 8 |

B/V/E/C are daily capacity slices, not new tasks. Review/meetings count within these hours. Follow this member’s package sequence and handoff contracts; do not double-book tasks. Reserve is conditional and otherwise supports verification/handover. Background test runtime is not extra staffed capacity; record actual operator/reviewer time.

**Named test execution/support groups:** P3-T01, P3-T02, P3-T03, P3-T04, P3-T05, P3-T06, P3-T07, P3-T08, P3-T09, P3-T10, P3-T11, P3-T12, P3-T13, P3-T14, P3-T15, P3-T16, P3-T17, P3-T18, P3-T19, P3-T20, P3-T21, P3-T22, P3-T23, P3-T24, P3-T25, P3-T26, P3-T27, P3-T28, P3-T29, P3-T30. The detailed procedures are in Tinu’s annex. These are minimum named duties; also help with impacted cumulative regression and the shared gate. Tinu coordinates execution rather than replacing the listed specialist/domain operator.

**Entry and dependencies:** G2 complete-feature candidate and paid readiness must pass first. Use production-equivalent paid settings, pinned artifacts and realistic synthetic retained data. Every relevant code/config/model/KB change invalidates affected evidence.

| Package | Hours | Branch from `dev`; PR to `dev` |
|---|---:|---|
| P3-TIN-001 — Maintain final cases, fixtures and smoke checks | 2 | `test/p3-tinu-qa-maintenance` |
| P3-TIN-090 — G3 verification and cumulative regression | 20 | `test/p3-tinu-g3-verification` |
| P3-TIN-080 — Environment, acceptance and handover support | 3 | `chore/p3-tinu-readiness-handover` |
| P3-TIN-099 — Protected defect/retest reserve | 7 | `fix/p3-tinu-bug-001` |

### P3-TIN-001 — Maintain final cases, fixtures and smoke checks

**Allocated time:** 2 hours (implementation / QA preparation). **Branch:** `test/p3-tinu-qa-maintenance` → `dev`.

**Inputs and integration handoffs:** P3-MAT-001, P3-JOS-001, P3-DEV-002. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Update affected cases and regression fixtures for reviewed fixes only.
2. Keep candidate/build/model/KB references exact and invalidate stale evidence.
3. Prepare gate report tables and final defect/retest links.
4. Do not take on feature implementation during the release campaign.

**Deliver and verify:** Current final execution register with no false passes.

**Required review:** Domain implementer supplies evidence; independent peer retests; senior/company reviewers approve gates. No self-approval of critical changes.

**Handoff:** Send reproducible failures to the named domain implementer, specialist requests to Mathew/Devadathan, and independent retest/coverage reports to the gate reviewers. Record every missing prerequisite explicitly.

**Traceability:** P3-E6-002. Requirements: R02, R05, R12, R36, R38. Outputs: P3-O03, P3-O04, P3-O06.

### P3-TIN-090 — G3 verification and cumulative regression

**Allocated time:** 20 hours (verification). **Branch:** `test/p3-tinu-g3-verification` → `dev`.

Merge necessary test-code changes before freeze; run results belong in the evidence store. Do not invalidate the frozen candidate with an evidence-only application change.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Coordinate the frozen-candidate campaign, execute the detailed cases in the annex, collect specialist results, independently retest fixes and report requirement coverage. Verify evidence versions, untriaged findings and external approval status. A test is Pending/Blocked until executed on the correct candidate.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Domain implementer supplies evidence; independent peer retests; senior/company reviewers approve gates. No self-approval of critical changes.

**Handoff:** Send reproducible failures to the named domain implementer, specialist requests to Mathew/Devadathan, and independent retest/coverage reports to the gate reviewers. Record every missing prerequisite explicitly.

**Traceability:** P3-E1-090, P3-E2-090, P3-E3-090, P3-E4-090, P3-E5-090, P3-E6-090. Requirements: R01, R02, R03, R04, R05, R06, R07, R08, R09, R10, R11, R12, R13, R14, R15, R16, R17, R18, R19, R20, R21, R22, R23, R24, R25, R26, R27, R28, R29, R30, R31, R32, R33, R34, R35, R36, R37, R38. Outputs: P3-O07.

### P3-TIN-080 — Environment, acceptance and handover support

**Allocated time:** 3 hours (environment / handover). **Branch:** `chore/p3-tinu-readiness-handover` → `dev`.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Maintain candidate/test/approval/evidence registers, schedule company UAT, document gate decisions and confirm training/support/ownership completeness. Execute safe public-channel postdeployment checks with domain owners; never mark an external pending item Passed.

**Integrated review C07:** Hand over a dated maintenance calendar: daily reconciliation; weekly access/job/backup/capacity/security checks; monthly physician review of flagged conversations and knowledge changes; quarterly operating/performance report. Name primary/backup owners, priority-fix/security/app-release workflow, and the proposal’s up-to-eight-hours-per-month knowledge-maintenance allowance with an agreed overflow/response process. These are support obligations/operating labor, not extra sprint capacity, new subscription pricing, or automatically created reminders.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Domain implementer supplies evidence; independent peer retests; senior/company reviewers approve gates. No self-approval of critical changes.

**Handoff:** Send reproducible failures to the named domain implementer, specialist requests to Mathew/Devadathan, and independent retest/coverage reports to the gate reviewers. Record every missing prerequisite explicitly.

**Traceability:** P3-E1-080, P3-E2-080, P3-E3-080, P3-E4-080, P3-E5-080, P3-E6-080. Requirements: R25, R36, R37, R38. Outputs: P3-O01, P3-O05, P3-O06, P3-O07.

### P3-TIN-099 — Protected defect/retest reserve

**Allocated time:** 7 hours (conditional reserve). **Branch:** `fix/p3-tinu-bug-001` → `dev`.

Create this branch only if a matching defect actually exists; the suffix shown is an example. Test execution alone does not require a code branch.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Use only against an actual tracked defect; replace bug-001 with the real issue ID. Reproduce, contain and route to the correct owner; independently retest a reviewed fix on a new candidate. Tinu uses this for triage/retesting, not critical feature coding. Paul/Denzil fix only bounded UI/content defects. If unused, broaden verification/handover; do not add scope or count the reserve as guaranteed repair capacity.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Domain implementer supplies evidence; independent peer retests; senior/company reviewers approve gates. No self-approval of critical changes.

**Handoff:** Send reproducible failures to the named domain implementer, specialist requests to Mathew/Devadathan, and independent retest/coverage reports to the gate reviewers. Record every missing prerequisite explicitly.

**Traceability:** P3-E1-099, P3-E2-099, P3-E3-099, P3-E4-099, P3-E5-099, P3-E6-099. Requirements: R36, R38. Outputs: P3-O07.

### Phase 3 personal handoff and gate checklist

- All assigned packages have reviewed PRs or explicit blocked/conditional status; no direct shared-branch changes.
- APIs/components/content/fixtures are handed to the named dependent owner with examples and known limits.
- Tests include positive, negative, authorization/current-state, retry/failure and relevant persisted-state checks.
- Tinu has exact candidate metadata, requirement/output links, screenshots/request IDs, defects and independent retest references.
- Domain/company reviewers have approved medical/finance/content expectations where needed.
- No unresolved blocker is hidden by a UI workaround, disabled feature, mock provider or skipped test.
- Promotion waits for G1/G2 Pass or the Phase 3 prelaunch Go; Devadathan handles the reviewed merge to `main`. Final G3 closure and `v1.0.0` follow successful postdeployment checks.

## Legacy package crosswalk and scope preservation

The original E1–E6 package IDs below remain technical traceability references. They are **not** this person’s role name or old hours. The named tasks/budgets in this document supersede old ownership; the master R01–R38 acceptance criteria and phase outputs remain in force. Shared source references identify collaboration rather than duplicate ownership.

| Retained source package | New named package(s) |
|---|---|
| P1-E1-002 — Implement verified identity and scoped authorization | P1-TIN-002 |
| P1-E1-080 — Record readiness/contract decisions and the initial forecast | P1-TIN-080 |
| P1-E1-090 — Clinical/access/booking cumulative verification | P1-TIN-090 |
| P1-E1-099 — Protected defect/retest contingency | P1-TIN-099 |
| P1-E2-001 — Establish commerce schema, opening imports and ledger contracts | P1-TIN-002 |
| P1-E2-090 — Commerce/financial cumulative verification | P1-TIN-090 |
| P1-E2-099 — Protected defect/retest contingency | P1-TIN-099 |
| P1-E3-090 — Web/workspace cumulative verification | P1-TIN-090 |
| P1-E3-099 — Protected defect/retest contingency | P1-TIN-099 |
| P1-E4-090 — Real-device cumulative verification | P1-TIN-090 |
| P1-E4-099 — Protected defect/retest contingency | P1-TIN-099 |
| P1-E5-004 — Prepare evaluation pack, human-routing state and integration evidence | P1-TIN-001 |
| P1-E5-090 — Companion/channel cumulative verification | P1-TIN-090 |
| P1-E5-099 — Protected defect/retest contingency | P1-TIN-099 |
| P1-E6-002 — Build test harness, redacted observability and rollback foundation | P1-TIN-001, P1-TIN-003 |
| P1-E6-003 — Implement queue platform and encrypted backup/restore smoke | P1-TIN-002 |
| P1-E6-080 — Provision account/environment/CI and evidence infrastructure | P1-TIN-080 |
| P1-E6-090 — Platform/security/load/recovery cumulative verification | P1-TIN-090 |
| P1-E6-099 — Protected defect/retest contingency | P1-TIN-099 |
| P2-E1-090 — Full clinical/access and independent transaction verification | P2-TIN-090 |
| P2-E1-099 — Protected defect/retest contingency | P2-TIN-099 |
| P2-E2-090 — Full commerce/ledger/provider verification | P2-TIN-090 |
| P2-E2-099 — Protected defect/retest contingency | P2-TIN-099 |
| P2-E3-090 — Full web/staff/language/report verification | P2-TIN-090 |
| P2-E3-099 — Protected defect/retest contingency | P2-TIN-099 |
| P2-E4-090 — Full native/device and cross-channel verification | P2-TIN-090 |
| P2-E4-099 — Protected defect/retest contingency | P2-TIN-099 |
| P2-E5-004 — Complete conversion/report events, evaluation evidence and support drafts | P2-TIN-001, P2-TIN-003 |
| P2-E5-090 — Full clinical evaluation/channel/automation verification | P2-TIN-090 |
| P2-E5-099 — Protected defect/retest contingency | P2-TIN-099 |
| P2-E6-001 — Complete quality pipeline and full-scope security inventory | P2-TIN-001, P2-TIN-002 |
| P2-E6-002 — Complete queue priorities, observability, cost and failure drills | P2-TIN-003 |
| P2-E6-003 — Prepare paid verification, restore scripts and release runbooks | P2-TIN-003 |
| P2-E6-080 — Freeze the complete candidate and prepare Day 7 paid verification | P2-TIN-080 |
| P2-E6-090 — Full security/platform/load/restore verification and G2 | P2-TIN-090 |
| P2-E6-099 — Protected defect/retest contingency | P2-TIN-099 |
| P3-E1-080 — Lead clinical/privacy acceptance, doctor training and technical release decision | P3-TIN-080 |
| P3-E1-090 — Final clinical/security/booking UAT and independent retest | P3-TIN-090 |
| P3-E1-099 — Protected defect/retest contingency | P3-TIN-099 |
| P3-E2-080 — Lead finance/warehouse acceptance, training and live reconciliation | P3-TIN-080 |
| P3-E2-090 — Final finance/inventory/provider/capacity/recovery verification | P3-TIN-090 |
| P3-E2-099 — Protected defect/retest contingency | P3-TIN-099 |
| P3-E3-080 — Lead web/content/front-desk handover and public content verification | P3-TIN-080 |
| P3-E3-090 — Final browser/language/accessibility/growth/report UAT | P3-TIN-090 |
| P3-E3-099 — Protected defect/retest contingency | P3-TIN-099 |
| P3-E4-080 — Submit complete apps, respond to review and verify public native delivery | P3-TIN-080 |
| P3-E4-090 — Final release-binary/device/video/voice/store verification | P3-TIN-090 |
| P3-E4-099 — Protected defect/retest contingency | P3-TIN-099 |
| P3-E5-080 — Lead support/marketing/clinical-content training and channel activation | P3-TIN-080 |
| P3-E5-090 — Final physician-reviewed AI/channel/schedule/outage verification | P3-TIN-090 |
| P3-E5-099 — Protected defect/retest contingency | P3-TIN-099 |
| P3-E6-002 — Harden performance, recovery automation and incident controls | P3-TIN-001 |
| P3-E6-080 — Coordinate G3, controlled deployment, recovery ownership and support handover | P3-TIN-080 |
| P3-E6-090 — Final security, load/soak, resilience, recovery and evidence coordination | P3-TIN-090 |
| P3-E6-099 — Protected defect/retest contingency | P3-TIN-099 |

## Whole-company requirement coverage and named accountability

The following requirement IDs retain the master definitions. Tinu coordinates evidence; she is not the implementer of every requirement. Collaborators deliver only the bounded portions listed in their tasks.

| Requirement | Company scope | Accountable implementation owner | Support / expected-result approver |
|---|---|---|---|
| R01 | Catalogue and shop by health concern | Josin | Paul customer UI; Denzil content; Devadathan client integration |
| R02 | Cart and Indian checkout | Josin | Mathew transaction review; Devadathan adapters; finance |
| R03 | Accounts, addresses, history, reorder, tracking | Mathew + Josin | Devadathan session; Paul account UI |
| R04 | Unified order desk including phone/walk-in/WhatsApp | Josin | Denzil staff UI; Mathew review |
| R05 | Batch/expiry, low stock and near-expiry operations | Josin | Mathew invariants; warehouse |
| R06 | Courier and pan-India fulfillment | Josin | Devadathan platform; warehouse |
| R07 | GST invoices, reconciliation and accounts export | Josin | Denzil labels; finance |
| R08 | Automated WhatsApp/SMS order updates | Mathew | Josin events; Denzil approved templates |
| R09 | Recurring subscriptions | Josin | Mathew mandate review; Paul UI; finance |
| R10 | Refill and daily medicine schedules | Mathew | Physician; Denzil approved wording |
| R11 | Physician directory, locations, slots, leave and fees | Mathew | Paul UI; physician/front desk |
| R12 | Booking, fee payment, reschedule/cancel/refund | Mathew + Josin | Devadathan adapter; finance/front desk |
| R13 | Embedded video consultations | Devadathan + Mathew | Paul devices; physician |
| R14 | Physician panel and linked patient record | Mathew | Devadathan sensitive UI; physician/privacy |
| R15 | Consult-to-cart | Mathew + Josin | Devadathan adapter; Paul customer UI; physician |
| R16 | Approved knowledge-base editor | Mathew | Denzil editor/content support; physician approval |
| R17 | Grounded, cited Companion | Mathew | Devadathan rendering; physician |
| R18 | Conversational product/order/refill/slot actions | Mathew | Josin domain operations; Devadathan review |
| R19 | Red flags, consult-only rules and disclaimers | Mathew | Physician approved safety expectations |
| R20 | Human handoff, callback and conversation review | Mathew | Devadathan privileged UI; Denzil support presentation |
| R21 | Same assistant on WhatsApp | Mathew | Devadathan provider/platform; Denzil wording |
| R22 | English, Malayalam and Tamil application | Devadathan | Paul/Denzil resources/layouts; physician approved medical translation |
| R23 | Other Indian-language and Romanized conversations | Mathew | Physician-approved fallback/evaluation |
| R24 | Voice input | Devadathan + Mathew | Paul transcript UI; Tinu devices |
| R25 | Complete Android and iOS customer apps | Devadathan | Paul screen/device support; company store owner |
| R26 | Bundles and discounted courses | Josin | Paul UI; finance/physician eligibility |
| R27 | Opt-in WhatsApp campaigns and segments | Mathew | Denzil content; company marketing consent approval |
| R28 | Seasonal offers and landing pages | Josin + Mathew | Denzil approved promotion/campaign; company |
| R29 | Abandoned-cart recovery | Mathew | Josin cart/purchase facts; company consent policy |
| R30 | Verified-buyer reviews and physician content | Josin + Mathew | Denzil moderation/content UI; physician |
| R31 | Referrals and loyalty | Josin | Mathew ledger review; Paul UI; finance |
| R32 | Multiple clinics | Mathew + Josin | Denzil staff presentation; company clinic/warehouse |
| R33 | Wholesale/distributor ordering | Josin | Paul customer/Denzil staff UI; finance |
| R34 | SEO and shopping/business listings | Devadathan | Denzil SEO/feed artifacts; company listing owner |
| R35 | Sales, retention and clinical conversion reports | Josin + Mathew | Denzil presentation; finance/physician/company metric owners |
| R36 | Roles, privacy, audit and ownership | Mathew + Devadathan | Tinu access tests; company privacy/ownership |
| R37 | Onboarding and recorded training | Devadathan + domain owners | Denzil guides; Paul device examples; Tinu training evidence |
| R38 | Production operations and maintenance readiness | Devadathan | Mathew/Josin reconciliation; Tinu gate evidence; company support |

## Canonical detailed test cases

Use the separate [Tinu detailed phase-wise test cases](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) for all 86 phase groups, 38 requirement walkthroughs, exact action/expected-result pairs, fixtures, variation matrices, evidence and gate criteria. This member document governs Tinu’s tasks, hours, branches and coordination. The previous embedded annex is superseded to prevent two independently maintained test specifications. All results remain Pending until actually executed.

### Protected measurement windows and fault-test isolation

Devadathan and Tinu publish a run-window/resource manifest before G3: target database/compute/Worker/queue/object IDs, candidate/config, dataset/reset ownership, operator/observer, provider mode and expected cost. Keep sustained/burst baseline and four-hour soak protected from unrelated deployments, seed resets, time travel, destructive fault injection, restore/cutover, scanner storms and ad hoc queries. Bounded jobs/AI/video are included only as declared workload; scheduled backup/report work is explicitly included or separately measured.

Run recovery/rollback/provider-fault/security mutation campaigns on separately verified isolated targets with independent resource contention boundaries, or serialize them after baseline/soak. A separate logical schema alone is not independent compute. Verify endpoints/queue/provider modes before each drill; never restore or fault the active measured candidate. Record cooldown/warmup and before/after correctness controls. No full load test is aimed at live payment/messaging/video providers.

The Day 8 plan is a dependency/window plan, not permission for one senior to operate several simultaneous destructive tests. Allocate actual operator/reviewer time inside the named hours; automation may run in the background with assigned observation. If target isolation, elapsed windows, staffed time or metered temporary resources do not fit, serialize/reforecast and update measured usage/cost rather than accepting confounded metrics or hidden overtime.

## Final personal completion record

Record package/PR, candidate/build IDs, requirement/output IDs, reviewer and domain approval, test runs/defects/retests, actual public-channel status, training/handover links and remaining approved low-risk issues. Leave unexecuted work Pending/Blocked. Final completion requires G3, all R01–R38 acceptance, public required channels and company ownership/support handover.
