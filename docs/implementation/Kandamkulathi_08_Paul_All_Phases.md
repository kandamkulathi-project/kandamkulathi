# Kandamkulathi — Paul: three-phase individual implementation plan

**Issue date:** 19 October 2026. **Delivery window:** 19–30 October, ten working days. **Team:** six people. **Status:** planned work and acceptance criteria; no implementation or test results are claimed.

**Role:** Customer UI and device support.

Assemble customer web/native screens from Devadathan’s shared components and reviewed APIs. Own loading/error/accessibility states, ordinary forms, device journey execution and store screenshot support.

**Boundaries:** No authentication architecture, payment/video/voice SDK wiring, direct database changes, financial calculations, clinical rules, provider secrets or production deployment. Request a contract/component fix instead of creating a shortcut.

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
| 1 | 16 | 4 | 2 | 2 | 24 |
| 2 | 17 | 4 | 1 | 2 | 24 |
| 3 | 6 | 13 | 7 | 6 | 32 |
| **Total** | 39 | 21 | 10 | 10 | **80** |

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

**Window:** Days 1–3 · 19–21 October 2026. **Capacity:** 24 hours; implementation/QA preparation 16, verification 4, environment/handover 2, reserve 2.

This is a capacity ceiling for adapting proven components and completing the allocated scope, including review within the relevant package. It is not a measured greenfield estimate. Escalate missing reuse and review overload on Day 1; do not consume protected test time to hide it.

**Sequence and handoff checkpoints**

- D1: obtain component/API fixtures; build catalogue and account/cart presentation.
- D2: complete ordinary checkout/order/booking views and native layout assembly.
- D3 morning: integrate real reviewed APIs and fix bounded errors. Final four hours: execute G1 customer/device cases with Tinu.

The checkpoints order work; they do not add hours beyond the phase budget. G1/G2 verification must include the protected four-hour final-half-day allocation. Phase 3 specialist campaigns may run in parallel, with a named operator and safe provider controls.

**Daily capacity aligned to the phase plan**

| Working day | B: implementation / QA prep | V: verification | E: environment / handover | C: reserve | Total |
|---|---:|---:|---:|---:|---:|
| Day 1 | 6 | 0 | 2 | 0 | 8 |
| Day 2 | 8 | 0 | 0 | 0 | 8 |
| Day 3 | 2 | 4 | 0 | 2 | 8 |

B/V/E/C are daily capacity slices, not new tasks. Review/meetings count within these hours. Follow this member’s package sequence and handoff contracts; do not double-book tasks. Reserve is conditional and otherwise supports verification/handover. On the final day, schedule four V hours in the protected final half-day for everyone; Tinu also has two earlier V hours. Background test runtime is not extra staffed capacity; record actual operator/reviewer time.

**Named test execution/support groups:** P1-T09, P1-T10, P1-T15. The detailed procedures are in Tinu’s annex. These are minimum named duties; also help with impacted cumulative regression and the shared gate. Tinu coordinates execution rather than replacing the listed specialist/domain operator.

**Entry and dependencies:** Start from approved company content/rules, reusable SDK proof, company accounts and synthetic fixtures. Mathew/Josin publish contracts before parallel screens. Devadathan provides components and environment access.

| Package | Hours | Branch from `dev`; PR to `dev` |
|---|---:|---|
| P1-PAU-001 — Customer catalogue/product screens | 5 | `feature/p1-paul-catalogue-ui` |
| P1-PAU-002 — Cart, address, order and account presentation | 5 | `feature/p1-paul-cart-account-ui` |
| P1-PAU-003 — Directory, booking and appointment presentation | 4 | `feature/p1-paul-booking-ui` |
| P1-PAU-004 — Native view assembly and device evidence | 2 | `feature/p1-paul-native-screen-assembly` |
| P1-PAU-090 — G1 verification and cumulative regression | 4 | `test/p1-paul-g1-verification` |
| P1-PAU-080 — Environment, acceptance and handover support | 2 | `chore/p1-paul-readiness-handover` |
| P1-PAU-099 — Protected defect/retest reserve | 2 | `fix/p1-paul-bug-001` |

### P1-PAU-001 — Customer catalogue/product screens

**Allocated time:** 5 hours (implementation / QA preparation). **Branch:** `feature/p1-paul-catalogue-ui` → `dev`.

**Inputs and integration handoffs:** P1-DEV-002, P1-JOS-002. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Use Devadathan’s components to build concern/category/product/variant lists and detail screens.
2. Consume current authorized catalogue responses; show stock/consult-only labels without deciding purchase eligibility.
3. Optimize approved images using existing utilities; handle empty, loading, offline and error states.
4. Apply approved EN/ML/TA strings and accessible labels.

**Deliver and verify:** Reviewed browser/native catalogue screens and screenshots for each state.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded screen PRs and screenshots to Devadathan; send reproducible UI/device cases to Tinu and contract mismatches to Mathew/Josin rather than patching business logic locally.

**Traceability:** P1-E3-002, P1-E4-002. Requirements: R01, R02, R03, R22, R25. Outputs: P1-O04, P1-O06.

### P1-PAU-002 — Cart, address, order and account presentation

**Allocated time:** 5 hours (implementation / QA preparation). **Branch:** `feature/p1-paul-cart-account-ui` → `dev`.

**Inputs and integration handoffs:** P1-DEV-003, P1-JOS-004. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Build quantity/address forms with shared validation components.
2. Show server totals, stale-price warnings and pending/failed payment messages.
3. Call Devadathan’s checkout/auth adapters; never calculate authoritative tax or mark orders paid.
4. Build owner-scoped history/detail/reorder UI, login return and logout states.

**Deliver and verify:** Synthetic web/native purchase journeys with accurate backend status and no duplicate-submit UX.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded screen PRs and screenshots to Devadathan; send reproducible UI/device cases to Tinu and contract mismatches to Mathew/Josin rather than patching business logic locally.

**Traceability:** P1-E3-002, P1-E4-002. Requirements: R01, R02, R03, R22, R25. Outputs: P1-O04, P1-O06.

### P1-PAU-003 — Directory, booking and appointment presentation

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p1-paul-booking-ui` → `dev`.

**Inputs and integration handoffs:** P1-MAT-002, P1-DEV-003. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Build clinic/doctor/service/fee/slot selection using provided components.
2. Render hold countdown, expiry/conflict, paid/pending/refund states from APIs.
3. Display customer appointment history and safe consultation join controls through the senior-owned adapter.
4. Test back navigation, refresh and revoked/forbidden UI.

**Deliver and verify:** Booking screens matched to authoritative states, reviewed by Devadathan and Mathew.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded screen PRs and screenshots to Devadathan; send reproducible UI/device cases to Tinu and contract mismatches to Mathew/Josin rather than patching business logic locally.

**Traceability:** P1-E3-003, P1-E4-003. Requirements: R04, R05, R11, R12, R13, R14, R25, R32. Outputs: P1-O05, P1-O06.

### P1-PAU-004 — Native view assembly and device evidence

**Allocated time:** 2 hours (implementation / QA preparation). **Branch:** `feature/p1-paul-native-screen-assembly` → `dev`.

**Inputs and integration handoffs:** P1-DEV-002. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Assemble provided native layouts; do not change SDK/signing/security configuration.
2. Run supported-device basic navigation/permission/error checks under Devadathan’s instructions.
3. Capture secret-free screenshots and reproducible device/build details.
4. Report risky adapter problems immediately instead of patching them locally.

**Deliver and verify:** Android/iOS screen inventory and device evidence linked to build IDs.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded screen PRs and screenshots to Devadathan; send reproducible UI/device cases to Tinu and contract mismatches to Mathew/Josin rather than patching business logic locally.

**Traceability:** P1-E4-001, P1-E4-004. Requirements: R02, R13, R17, R21, R22, R24, R25, R36. Outputs: P1-O01, P1-O06, P1-O07.

### P1-PAU-090 — G1 verification and cumulative regression

**Allocated time:** 4 hours (verification). **Branch:** `test/p1-paul-g1-verification` → `dev`.

Merge necessary test-code changes before freeze; run results belong in the evidence store. Do not invalidate the frozen candidate with an evidence-only application change.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Execute customer web/Android/iOS navigation/cart/account/booking/subscription/credit/wholesale/error/locale/accessibility cases. Record device/build/request IDs and report persisted-status mismatches. Help Tinu independently reproduce UI fixes.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded screen PRs and screenshots to Devadathan; send reproducible UI/device cases to Tinu and contract mismatches to Mathew/Josin rather than patching business logic locally.

**Traceability:** P1-E3-090, P1-E4-090. Requirements: R01, R02, R03, R11, R12, R13, R14, R16, R22, R24, R25, R36. Outputs: P1-O09.

### P1-PAU-080 — Environment, acceptance and handover support

**Allocated time:** 2 hours (environment / handover). **Branch:** `chore/p1-paul-readiness-handover` → `dev`.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Collect secret-free device/screenshots/store inputs and customer/front-desk guide evidence. Support actual public app installation checks, approved walkthrough recording and safe customer smoke under the release manager.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded screen PRs and screenshots to Devadathan; send reproducible UI/device cases to Tinu and contract mismatches to Mathew/Josin rather than patching business logic locally.

**Traceability:** Named support package; retain parent phase outputs. Requirements: . Outputs: .

### P1-PAU-099 — Protected defect/retest reserve

**Allocated time:** 2 hours (conditional reserve). **Branch:** `fix/p1-paul-bug-001` → `dev`.

Create this branch only if a matching defect actually exists; the suffix shown is an example. Test execution alone does not require a code branch.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Use only against an actual tracked defect; replace bug-001 with the real issue ID. Reproduce, contain and route to the correct owner; independently retest a reviewed fix on a new candidate. Tinu uses this for triage/retesting, not critical feature coding. Paul/Denzil fix only bounded UI/content defects. If unused, broaden verification/handover; do not add scope or count the reserve as guaranteed repair capacity.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded screen PRs and screenshots to Devadathan; send reproducible UI/device cases to Tinu and contract mismatches to Mathew/Josin rather than patching business logic locally.

**Traceability:** P1-E3-099, P1-E4-099. Requirements: R36, R38. Outputs: P1-O09.

### Phase 1 personal handoff and gate checklist

- All assigned packages have reviewed PRs or explicit blocked/conditional status; no direct shared-branch changes.
- APIs/components/content/fixtures are handed to the named dependent owner with examples and known limits.
- Tests include positive, negative, authorization/current-state, retry/failure and relevant persisted-state checks.
- Tinu has exact candidate metadata, requirement/output links, screenshots/request IDs, defects and independent retest references.
- Domain/company reviewers have approved medical/finance/content expectations where needed.
- No unresolved blocker is hidden by a UI workaround, disabled feature, mock provider or skipped test.
- Promotion waits for G1/G2 Pass or the Phase 3 prelaunch Go; Devadathan handles the reviewed merge to `main`. Final G3 closure and `v1.0.0` follow successful postdeployment checks.

## Phase 2: Complete features and integration

**Window:** Days 4–6 · 22, 23 and 26 October 2026. **Capacity:** 24 hours; implementation/QA preparation 17, verification 4, environment/handover 1, reserve 2.

This is a capacity ceiling for adapting proven components and completing the allocated scope, including review within the relevant package. It is not a measured greenfield estimate. Escalate missing reuse and review overload on Day 1; do not consume protected test time to hide it.

**Sequence and handoff checkpoints**

- D4: customer account/booking/subscription and credit/distributor screens.
- D5: complete native customer parity, chat/voice presentation and accessible locale/error states.
- D6 morning: finish no-placeholder inventory and reviewed fixes. Final four hours: G2 customer/device regression.

The checkpoints order work; they do not add hours beyond the phase budget. G1/G2 verification must include the protected four-hour final-half-day allocation. Phase 3 specialist campaigns may run in parallel, with a named operator and safe provider controls.

**Daily capacity aligned to the phase plan**

| Working day | B: implementation / QA prep | V: verification | E: environment / handover | C: reserve | Total |
|---|---:|---:|---:|---:|---:|
| Day 4 | 7 | 0 | 1 | 0 | 8 |
| Day 5 | 8 | 0 | 0 | 0 | 8 |
| Day 6 | 2 | 4 | 0 | 2 | 8 |

B/V/E/C are daily capacity slices, not new tasks. Review/meetings count within these hours. Follow this member’s package sequence and handoff contracts; do not double-book tasks. Reserve is conditional and otherwise supports verification/handover. On the final day, schedule four V hours in the protected final half-day for everyone; Tinu also has two earlier V hours. Background test runtime is not extra staffed capacity; record actual operator/reviewer time.

**Named test execution/support groups:** P2-T09, P2-T12, P2-T19, P2-T20, P2-T21, P2-T22, P2-T29. The detailed procedures are in Tinu’s annex. These are minimum named duties; also help with impacted cumulative regression and the shared gate. Tinu coordinates execution rather than replacing the listed specialist/domain operator.

**Entry and dependencies:** G1 must pass first. Build on accepted contracts and reviewed components; keep Phase 1 critical tests running. Complete actual features by G2; track pending public approvals explicitly for Phase 3.

| Package | Hours | Branch from `dev`; PR to `dev` |
|---|---:|---|
| P2-PAU-001 — Complete customer shopping/account/booking UI | 5 | `feature/p2-paul-complete-customer-journeys` |
| P2-PAU-002 — Subscription, referral, loyalty and distributor UI | 5 | `feature/p2-paul-subscription-credit-wholesale-ui` |
| P2-PAU-003 — Native feature parity and device journey support | 4 | `feature/p2-paul-device-parity` |
| P2-PAU-004 — Accessibility, locales and failure usability | 3 | `feature/p2-paul-accessible-error-ux` |
| P2-PAU-090 — G2 verification and cumulative regression | 4 | `test/p2-paul-g2-verification` |
| P2-PAU-080 — Environment, acceptance and handover support | 1 | `chore/p2-paul-readiness-handover` |
| P2-PAU-099 — Protected defect/retest reserve | 2 | `fix/p2-paul-bug-001` |

### P2-PAU-001 — Complete customer shopping/account/booking UI

**Allocated time:** 5 hours (implementation / QA preparation). **Branch:** `feature/p2-paul-complete-customer-journeys` → `dev`.

**Inputs and integration handoffs:** P2-DEV-001, P2-MAT-001, P2-JOS-001. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Finish history/reorder/tracking/address/return request presentation through reviewed APIs.
2. Finish booking reschedule/cancel/refund status and customer clinical summary visibility.
3. Render signed recommendation-to-cart and reminder controls without modifying medical instructions.
4. Cover empty/pending/conflict/offline/resume states on web and both native platforms.

**Deliver and verify:** Complete customer journey checklist with API-backed screenshots.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded screen PRs and screenshots to Devadathan; send reproducible UI/device cases to Tinu and contract mismatches to Mathew/Josin rather than patching business logic locally.

**Traceability:** P2-E3-001, P2-E4-001, P2-E4-002. Requirements: R01, R02, R03, R04, R05, R06, R07, R09, R10, R11, R12, R13, R14, R15, R22, R25, R26, R31, R32, R33. Outputs: P2-O01, P2-O02, P2-O04, P2-O06.

### P2-PAU-002 — Subscription, referral, loyalty and distributor UI

**Allocated time:** 5 hours (implementation / QA preparation). **Branch:** `feature/p2-paul-subscription-credit-wholesale-ui` → `dev`.

**Inputs and integration handoffs:** P2-JOS-002, P2-JOS-003, P2-DEV-004. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Build mandate enrollment/pause/resume/cancel/status screens using Josin/Devadathan adapters.
2. Show customer credit/referral history and reversal states from authoritative ledgers.
3. Build bundle/course selection and authorized distributor catalogue/MOQ/terms presentation.
4. Never calculate final discounts/credit eligibility or allow a retail user to self-upgrade.

**Deliver and verify:** Finance-reviewed sample screens and cross-channel totals comparison.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded screen PRs and screenshots to Devadathan; send reproducible UI/device cases to Tinu and contract mismatches to Mathew/Josin rather than patching business logic locally.

**Traceability:** P2-E3-003, P2-E4-001. Requirements: R01, R02, R03, R09, R22, R25, R26, R27, R28, R29, R30, R31, R33. Outputs: P2-O04, P2-O05.

### P2-PAU-003 — Native feature parity and device journey support

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p2-paul-device-parity` → `dev`.

**Inputs and integration handoffs:** P2-DEV-002, P2-DEV-004. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Finish screen parity and customer chat/citation/transcript confirmation presentation.
2. Execute provided payment-return, booking, consultation, voice/push/link journeys on actual devices.
3. Capture review screenshots and reproduce background/reconnect/permission errors.
4. Escalate SDK/auth/private data issues to Devadathan with exact build/steps.

**Deliver and verify:** Native parity inventory and reproducible device evidence.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded screen PRs and screenshots to Devadathan; send reproducible UI/device cases to Tinu and contract mismatches to Mathew/Josin rather than patching business logic locally.

**Traceability:** P2-E4-001, P2-E4-002, P2-E4-003, P2-E4-004. Requirements: R01, R02, R03, R09, R10, R11, R12, R13, R14, R15, R17, R18, R19, R20, R21, R22, R23, R24, R25, R26, R31, R32, R33, R36, R37. Outputs: P2-O02, P2-O03, P2-O04, P2-O07.

### P2-PAU-004 — Accessibility, locales and failure usability

**Allocated time:** 3 hours (implementation / QA preparation). **Branch:** `feature/p2-paul-accessible-error-ux` → `dev`.

**Inputs and integration handoffs:** P2-DEV-004, P2-DEN-003. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Audit labels/focus/touch targets, text scaling and EN/ML/TA layouts on assigned customer screens.
2. Replace missing strings using approved resources; never translate medical text yourself.
3. Show actionable safe errors for unavailable stock/provider, expired links and revoked sessions.
4. Clear permitted private view caches through the senior-owned logout adapter.

**Deliver and verify:** Reviewed accessibility/locale screenshots and closed bounded UI defects.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded screen PRs and screenshots to Devadathan; send reproducible UI/device cases to Tinu and contract mismatches to Mathew/Josin rather than patching business logic locally.

**Traceability:** P2-E3-001, P2-E3-004, P2-E4-004. Requirements: R01, R02, R03, R04, R05, R06, R07, R09, R16, R22, R23, R24, R25, R26, R28, R32, R34, R35, R36, R37. Outputs: P2-O01, P2-O04, P2-O05, P2-O06, P2-O07.

### P2-PAU-090 — G2 verification and cumulative regression

**Allocated time:** 4 hours (verification). **Branch:** `test/p2-paul-g2-verification` → `dev`.

Merge necessary test-code changes before freeze; run results belong in the evidence store. Do not invalidate the frozen candidate with an evidence-only application change.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Execute customer web/Android/iOS navigation/cart/account/booking/subscription/credit/wholesale/error/locale/accessibility cases. Record device/build/request IDs and report persisted-status mismatches. Help Tinu independently reproduce UI fixes.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded screen PRs and screenshots to Devadathan; send reproducible UI/device cases to Tinu and contract mismatches to Mathew/Josin rather than patching business logic locally.

**Traceability:** P2-E3-090, P2-E4-090. Requirements: R01, R02, R03, R04, R07, R09, R10, R11, R12, R13, R14, R15, R16, R17, R18, R19, R20, R22, R23, R24, R25, R26, R27, R28, R29, R30, R31, R33, R34, R35. Outputs: P2-O07.

### P2-PAU-080 — Environment, acceptance and handover support

**Allocated time:** 1 hours (environment / handover). **Branch:** `chore/p2-paul-readiness-handover` → `dev`.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Collect secret-free device/screenshots/store inputs and customer/front-desk guide evidence. Support actual public app installation checks, approved walkthrough recording and safe customer smoke under the release manager.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded screen PRs and screenshots to Devadathan; send reproducible UI/device cases to Tinu and contract mismatches to Mathew/Josin rather than patching business logic locally.

**Traceability:** Named support package; retain parent phase outputs. Requirements: . Outputs: .

### P2-PAU-099 — Protected defect/retest reserve

**Allocated time:** 2 hours (conditional reserve). **Branch:** `fix/p2-paul-bug-001` → `dev`.

Create this branch only if a matching defect actually exists; the suffix shown is an example. Test execution alone does not require a code branch.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Use only against an actual tracked defect; replace bug-001 with the real issue ID. Reproduce, contain and route to the correct owner; independently retest a reviewed fix on a new candidate. Tinu uses this for triage/retesting, not critical feature coding. Paul/Denzil fix only bounded UI/content defects. If unused, broaden verification/handover; do not add scope or count the reserve as guaranteed repair capacity.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded screen PRs and screenshots to Devadathan; send reproducible UI/device cases to Tinu and contract mismatches to Mathew/Josin rather than patching business logic locally.

**Traceability:** P2-E3-099, P2-E4-099. Requirements: R36, R38. Outputs: P2-O07.

### Phase 2 personal handoff and gate checklist

- All assigned packages have reviewed PRs or explicit blocked/conditional status; no direct shared-branch changes.
- APIs/components/content/fixtures are handed to the named dependent owner with examples and known limits.
- Tests include positive, negative, authorization/current-state, retry/failure and relevant persisted-state checks.
- Tinu has exact candidate metadata, requirement/output links, screenshots/request IDs, defects and independent retest references.
- Domain/company reviewers have approved medical/finance/content expectations where needed.
- No unresolved blocker is hidden by a UI workaround, disabled feature, mock provider or skipped test.
- Promotion waits for G1/G2 Pass or the Phase 3 prelaunch Go; Devadathan handles the reviewed merge to `main`. Final G3 closure and `v1.0.0` follow successful postdeployment checks.

## Phase 3: Production verification, acceptance and launch

**Window:** Days 7–10 · 27–30 October 2026. **Capacity:** 32 hours; implementation/QA preparation 6, verification 13, environment/handover 7, reserve 6.

This is a capacity ceiling for adapting proven components and completing the allocated scope, including review within the relevant package. It is not a measured greenfield estimate. Escalate missing reuse and review overload on Day 1; do not consume protected test time to hide it.

**Sequence and handoff checkpoints**

- D7: real-device full-candidate journeys and bounded presentation corrections.
- D8: support cumulative customer/accessibility/device testing; send SDK issues to Devadathan.
- D9: retest, refresh approved screenshots and help record customer/front-desk guides.
- D10: verify actual public installs and safe customer smoke; assist handover after Go.

The checkpoints order work; they do not add hours beyond the phase budget. G1/G2 verification must include the protected four-hour final-half-day allocation. Phase 3 specialist campaigns may run in parallel, with a named operator and safe provider controls.

**Daily capacity aligned to the phase plan**

| Working day | B: implementation / QA prep | V: verification | E: environment / handover | C: reserve | Total |
|---|---:|---:|---:|---:|---:|
| Day 7 | 3 | 4 | 0 | 1 | 8 |
| Day 8 | 2 | 4 | 0 | 2 | 8 |
| Day 9 | 1 | 3 | 3 | 1 | 8 |
| Day 10 | 0 | 2 | 4 | 2 | 8 |

B/V/E/C are daily capacity slices, not new tasks. Review/meetings count within these hours. Follow this member’s package sequence and handoff contracts; do not double-book tasks. Reserve is conditional and otherwise supports verification/handover. Background test runtime is not extra staffed capacity; record actual operator/reviewer time.

**Named test execution/support groups:** P3-T12, P3-T13, P3-T14, P3-T15, P3-T30. The detailed procedures are in Tinu’s annex. These are minimum named duties; also help with impacted cumulative regression and the shared gate. Tinu coordinates execution rather than replacing the listed specialist/domain operator.

**Entry and dependencies:** G2 complete-feature candidate and paid readiness must pass first. Use production-equivalent paid settings, pinned artifacts and realistic synthetic retained data. Every relevant code/config/model/KB change invalidates affected evidence.

| Package | Hours | Branch from `dev`; PR to `dev` |
|---|---:|---|
| P3-PAU-001 — Bounded customer UI corrections | 3 | `feature/p3-paul-customer-ui-fixes` |
| P3-PAU-002 — Native presentation/device corrections | 3 | `feature/p3-paul-device-ux-fixes` |
| P3-PAU-090 — G3 verification and cumulative regression | 13 | `test/p3-paul-g3-verification` |
| P3-PAU-080 — Environment, acceptance and handover support | 7 | `chore/p3-paul-readiness-handover` |
| P3-PAU-099 — Protected defect/retest reserve | 6 | `fix/p3-paul-bug-001` |

### P3-PAU-001 — Bounded customer UI corrections

**Allocated time:** 3 hours (implementation / QA preparation). **Branch:** `feature/p3-paul-customer-ui-fixes` → `dev`.

**Inputs and integration handoffs:** P3-DEV-002, P3-JOS-001. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Fix reproduced navigation/form/loading/error/locale/accessibility defects in assigned screens.
2. Use existing adapters; request senior changes for auth/payment/medical logic.
3. Show persisted pending/conflict/failure states accurately.
4. Attach before/after evidence and ask Tinu/peer for retest.

**Deliver and verify:** Reviewed UI fixes without new business logic.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded screen PRs and screenshots to Devadathan; send reproducible UI/device cases to Tinu and contract mismatches to Mathew/Josin rather than patching business logic locally.

**Traceability:** P3-E3-001. Requirements: R01, R03, R04, R07, R14, R16, R20, R22, R28, R30, R33, R35. Outputs: P3-O02, P3-O05.

### P3-PAU-002 — Native presentation/device corrections

**Allocated time:** 3 hours (implementation / QA preparation). **Branch:** `feature/p3-paul-device-ux-fixes` → `dev`.

**Inputs and integration handoffs:** P3-DEV-002. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Fix screen layout/text scaling/back-navigation/resume presentation issues within provided components.
2. Reproduce sensitive SDK issues for Devadathan rather than altering them.
3. Update approved screenshots and supported-device evidence after build changes.
4. Verify customer feature parity and no placeholders.

**Deliver and verify:** Retested Android/iOS presentation and store asset updates.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded screen PRs and screenshots to Devadathan; send reproducible UI/device cases to Tinu and contract mismatches to Mathew/Josin rather than patching business logic locally.

**Traceability:** P3-E4-001, P3-E4-002. Requirements: R02, R03, R10, R12, R13, R17, R21, R22, R24, R25, R31, R36. Outputs: P3-O02, P3-O03, P3-O05.

### P3-PAU-090 — G3 verification and cumulative regression

**Allocated time:** 13 hours (verification). **Branch:** `test/p3-paul-g3-verification` → `dev`.

Merge necessary test-code changes before freeze; run results belong in the evidence store. Do not invalidate the frozen candidate with an evidence-only application change.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Execute customer web/Android/iOS navigation/cart/account/booking/subscription/credit/wholesale/error/locale/accessibility cases. Record device/build/request IDs and report persisted-status mismatches. Help Tinu independently reproduce UI fixes.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded screen PRs and screenshots to Devadathan; send reproducible UI/device cases to Tinu and contract mismatches to Mathew/Josin rather than patching business logic locally.

**Traceability:** P3-E3-090, P3-E4-090. Requirements: R01, R02, R03, R04, R07, R09, R10, R11, R12, R13, R14, R15, R16, R17, R18, R19, R20, R22, R23, R24, R25, R26, R27, R28, R29, R30, R31, R33, R34, R35, R36, R37. Outputs: P3-O07.

### P3-PAU-080 — Environment, acceptance and handover support

**Allocated time:** 7 hours (environment / handover). **Branch:** `chore/p3-paul-readiness-handover` → `dev`.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Collect secret-free device/screenshots/store inputs and customer/front-desk guide evidence. Support actual public app installation checks, approved walkthrough recording and safe customer smoke under the release manager.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded screen PRs and screenshots to Devadathan; send reproducible UI/device cases to Tinu and contract mismatches to Mathew/Josin rather than patching business logic locally.

**Traceability:** P3-E3-080, P3-E4-080. Requirements: R25, R36, R37, R38. Outputs: P3-O05, P3-O06, P3-O07.

### P3-PAU-099 — Protected defect/retest reserve

**Allocated time:** 6 hours (conditional reserve). **Branch:** `fix/p3-paul-bug-001` → `dev`.

Create this branch only if a matching defect actually exists; the suffix shown is an example. Test execution alone does not require a code branch.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Use only against an actual tracked defect; replace bug-001 with the real issue ID. Reproduce, contain and route to the correct owner; independently retest a reviewed fix on a new candidate. Tinu uses this for triage/retesting, not critical feature coding. Paul/Denzil fix only bounded UI/content defects. If unused, broaden verification/handover; do not add scope or count the reserve as guaranteed repair capacity.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded screen PRs and screenshots to Devadathan; send reproducible UI/device cases to Tinu and contract mismatches to Mathew/Josin rather than patching business logic locally.

**Traceability:** P3-E3-099, P3-E4-099. Requirements: R36, R38. Outputs: P3-O07.

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
| P1-E3-002 — Implement catalogue, cart, checkout and account/order slice | P1-PAU-001, P1-PAU-002 |
| P1-E3-003 — Implement directory, booking and staff/physician skeleton screens | P1-PAU-003 |
| P1-E3-090 — Web/workspace cumulative verification | P1-PAU-090 |
| P1-E3-099 — Protected defect/retest contingency | P1-PAU-099 |
| P1-E4-001 — Prove native build, identity, payment and video compatibility | P1-PAU-004 |
| P1-E4-002 — Implement shared native shopping/account/checkout slice | P1-PAU-001, P1-PAU-002 |
| P1-E4-003 — Implement native directory/booking and consultation shell | P1-PAU-003 |
| P1-E4-004 — Prepare chat/voice/push contracts and store-release inputs | P1-PAU-004 |
| P1-E4-090 — Real-device cumulative verification | P1-PAU-090 |
| P1-E4-099 — Protected defect/retest contingency | P1-PAU-099 |
| P2-E3-001 — Complete customer commerce and operational workspaces | P2-PAU-001, P2-PAU-004 |
| P2-E3-003 — Complete growth, wholesale, review and loyalty interfaces | P2-PAU-002 |
| P2-E3-004 — Complete reports, SEO/listings, localization and training drafts | P2-PAU-004 |
| P2-E3-090 — Full web/staff/language/report verification | P2-PAU-090 |
| P2-E3-099 — Protected defect/retest contingency | P2-PAU-099 |
| P2-E4-001 — Complete full native commerce/account/subscription/loyalty parity | P2-PAU-001, P2-PAU-002, P2-PAU-003 |
| P2-E4-002 — Complete native consultation, scheduling and clinical customer flows | P2-PAU-001, P2-PAU-003 |
| P2-E4-003 — Complete native assistant, voice, push and channel linking | P2-PAU-003 |
| P2-E4-004 — Produce complete signed candidates and store-ready packages | P2-PAU-003, P2-PAU-004 |
| P2-E4-090 — Full native/device and cross-channel verification | P2-PAU-090 |
| P2-E4-099 — Protected defect/retest contingency | P2-PAU-099 |
| P3-E3-001 — Harden complete web/workspace UX, language and data presentation | P3-PAU-001 |
| P3-E3-080 — Lead web/content/front-desk handover and public content verification | P3-PAU-080 |
| P3-E3-090 — Final browser/language/accessibility/growth/report UAT | P3-PAU-090 |
| P3-E3-099 — Protected defect/retest contingency | P3-PAU-099 |
| P3-E4-001 — Harden final Android/iOS behavior and production API compatibility | P3-PAU-002 |
| P3-E4-002 — Verify consultation network quality and signing/store readiness | P3-PAU-002 |
| P3-E4-080 — Submit complete apps, respond to review and verify public native delivery | P3-PAU-080 |
| P3-E4-090 — Final release-binary/device/video/voice/store verification | P3-PAU-090 |
| P3-E4-099 — Protected defect/retest contingency | P3-PAU-099 |

## Test-case handoff

Use [Tinu’s standalone detailed test cases](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) for all 86 phase groups and 38 requirement walkthroughs, shared synthetic fixtures, action/expected-result pairs and evidence rules. Execute your domain cases with Tinu; do not wait until the phase-end campaign to begin testing. Source phase specifications retain their additional matrices and acceptance criteria.

## Final personal completion record

Record package/PR, candidate/build IDs, requirement/output IDs, reviewer and domain approval, test runs/defects/retests, actual public-channel status, training/handover links and remaining approved low-risk issues. Leave unexecuted work Pending/Blocked. Final completion requires G3, all R01–R38 acceptance, public required channels and company ownership/support handover.
