# Kandamkulathi — Denzil: three-phase individual implementation plan

**Issue date:** 19 October 2026. **Delivery window:** 19–30 October, ten working days. **Team:** six people. **Status:** planned work and acceptance criteria; no implementation or test results are claimed.

**Role:** Content/admin presentation and operational documentation support.

Prepare synthetic import files, approved translations/content, bounded staff/admin presentation, reports consuming authorized APIs, SEO/feed artifacts and operating guides. Devadathan reviews UI; Mathew reviews safety/permission boundaries; domain owners approve wording and figures.

**Boundaries:** Do not medically approve content, design permissions, write financial reporting SQL, change payment/stock state, access production secrets or execute migrations. Import work is validation/dry-run support; Josin executes approved writes.

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

- D1: synthetic import/content/translation fixture collection and validation.
- D2: staff read views and controlled KB/editor presentation; gather approved store/provider inputs.
- D3 morning: complete templates/guides and role-state checks. Final four hours: G1 content/admin/locale evidence.

The checkpoints order work; they do not add hours beyond the phase budget. G1/G2 verification must include the protected four-hour final-half-day allocation. Phase 3 specialist campaigns may run in parallel, with a named operator and safe provider controls.

**Daily capacity aligned to the phase plan**

| Working day | B: implementation / QA prep | V: verification | E: environment / handover | C: reserve | Total |
|---|---:|---:|---:|---:|---:|
| Day 1 | 6 | 0 | 2 | 0 | 8 |
| Day 2 | 8 | 0 | 0 | 0 | 8 |
| Day 3 | 2 | 4 | 0 | 2 | 8 |

B/V/E/C are daily capacity slices, not new tasks. Review/meetings count within these hours. Follow this member’s package sequence and handoff contracts; do not double-book tasks. Reserve is conditional and otherwise supports verification/handover. On the final day, schedule four V hours in the protected final half-day for everyone; Tinu also has two earlier V hours. Background test runtime is not extra staffed capacity; record actual operator/reviewer time.

**Named test execution/support groups:** P1-T09, P1-T15. The detailed procedures are in Tinu’s annex. These are minimum named duties; also help with impacted cumulative regression and the shared gate. Tinu coordinates execution rather than replacing the listed specialist/domain operator.

**Entry and dependencies:** Start from approved company content/rules, reusable SDK proof, company accounts and synthetic fixtures. Mathew/Josin publish contracts before parallel screens. Devadathan provides components and environment access.

| Package | Hours | Branch from `dev`; PR to `dev` |
|---|---:|---|
| P1-DEN-001 — Catalogue/import validation support | 4 | `feature/p1-denzil-import-fixtures` |
| P1-DEN-002 — Approved content, locales and KB editor presentation | 4 | `feature/p1-denzil-approved-content-locales` |
| P1-DEN-003 — Read-only staff operational views | 4 | `feature/p1-denzil-staff-read-views` |
| P1-DEN-004 — Template fixtures, store inputs and quick guides | 4 | `feature/p1-denzil-templates-store-guides` |
| P1-DEN-090 — G1 verification and cumulative regression | 4 | `test/p1-denzil-g1-verification` |
| P1-DEN-080 — Environment, acceptance and handover support | 2 | `chore/p1-denzil-readiness-handover` |
| P1-DEN-099 — Protected defect/retest reserve | 2 | `fix/p1-denzil-bug-001` |

### P1-DEN-001 — Catalogue/import validation support

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p1-denzil-import-fixtures` → `dev`.

**Inputs and integration handoffs:** P1-JOS-001. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Prepare synthetic catalogue, variants, batches, clinic references and invalid-row examples from Josin’s template.
2. Run local validation/dry-runs only and record duplicate/expiry/price/reference errors.
3. Compare draft totals against approved opening fixture totals.
4. Hand validated files and error report to Josin; do not write production balances.

**Deliver and verify:** Versioned fixture files, validation report and Josin’s import acceptance.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded UI/content/locale/SEO/report/guide PRs to Devadathan and relevant domain owner; hand approved source/version and validation evidence to Tinu. Medical approval remains with the physician.

**Traceability:** P1-E2-001. Requirements: R01, R02, R05, R07, R09, R26, R31, R33. Outputs: P1-O03.

### P1-DEN-002 — Approved content, locales and KB editor presentation

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p1-denzil-approved-content-locales` → `dev`.

**Inputs and integration handoffs:** P1-MAT-003, P1-DEV-002. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Collect physician/company-approved source/version/provenance and translation text.
2. Enter synthetic draft/approved/withdrawn examples through controlled tools.
3. Build bounded editor fields and language resources from Devadathan’s templates.
4. Keep editor/approver actions separate and flag missing translations/safety wording for Mathew.
5. C01 — Reconcile every published catalogue product to its physician-approved monograph/dosage/contraindication and required EN/ML/TA safety translations. No published product is an unexplained coverage gap. G1 records the complete inventory/gap register and an approved sample; G2 closes required product coverage and demonstrates approved edit/withdrawal propagation within a company-agreed measured freshness deadline. The illustrative morning-to-afternoon statement is not an invented numeric provider SLA. Include approved public physician profiles and the required knowledge types; approval is not satisfied by catalogue text alone. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Approved content register, three-language resources and editor UI without self-approval.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded UI/content/locale/SEO/report/guide PRs to Devadathan and relevant domain owner; hand approved source/version and validation evidence to Tinu. Medical approval remains with the physician.

**Traceability:** P1-E3-001, P1-E3-004, P1-E5-001. Requirements: R01, R03, R14, R16, R17, R19, R20, R22, R23, R30, R36. Outputs: P1-O01, P1-O03, P1-O06, P1-O07.

### P1-DEN-003 — Read-only staff operational views

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p1-denzil-staff-read-views` → `dev`.

**Inputs and integration handoffs:** P1-MAT-001, P1-MAT-002, P1-JOS-004. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Assemble order/batch/doctor schedule tables from authorized APIs.
2. Provide pagination, status labels, permitted filters and clear forbidden/error states.
3. Display only fields allowed by the reviewed role matrix.
4. Do not add raw SQL, permission logic or stock/payment mutation shortcuts.

**Deliver and verify:** Reviewed staff read views and cross-role screenshots.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded UI/content/locale/SEO/report/guide PRs to Devadathan and relevant domain owner; hand approved source/version and validation evidence to Tinu. Medical approval remains with the physician.

**Traceability:** P1-E3-003. Requirements: R04, R05, R11, R12, R14, R32. Outputs: P1-O05, P1-O06.

### P1-DEN-004 — Template fixtures, store inputs and quick guides

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p1-denzil-templates-store-guides` → `dev`.

**Inputs and integration handoffs:** P1-MAT-004, P1-DEV-002. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Prepare approved message/callback wording and synthetic evaluation input files.
2. Collect company-owned store/listing identifiers, screenshots/copy/privacy disclosures and missing-approval status.
3. Draft short role guides matching actual Phase 1 screens.
4. Hand provider configuration needs to Mathew/Devadathan; keep secrets outside documents.

**Deliver and verify:** Template/content register, store readiness checklist and draft guides.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded UI/content/locale/SEO/report/guide PRs to Devadathan and relevant domain owner; hand approved source/version and validation evidence to Tinu. Medical approval remains with the physician.

**Traceability:** P1-E4-004, P1-E5-003, P1-E5-004. Requirements: R08, R10, R17, R19, R20, R21, R22, R23, R24, R25, R27, R29, R35. Outputs: P1-O06, P1-O07, P1-O08, P1-O09.

### P1-DEN-090 — G1 verification and cumulative regression

**Allocated time:** 4 hours (verification). **Branch:** `test/p1-denzil-g1-verification` → `dev`.

Merge necessary test-code changes before freeze; run results belong in the evidence store. Do not invalidate the frozen candidate with an evidence-only application change.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Execute staff/content/KB role separation/locales/SEO/feed/campaign/report/guide checks using approved content and reconciled API fixtures. Record missing approvals and private-data/indexing/analytics leaks. Seek domain review rather than guessing expected results.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded UI/content/locale/SEO/report/guide PRs to Devadathan and relevant domain owner; hand approved source/version and validation evidence to Tinu. Medical approval remains with the physician.

**Traceability:** P1-E3-090, P1-E5-090. Requirements: R01, R02, R03, R08, R11, R12, R14, R16, R17, R18, R19, R20, R21, R22, R24, R36. Outputs: P1-O09.

### P1-DEN-080 — Environment, acceptance and handover support

**Allocated time:** 2 hours (environment / handover). **Branch:** `chore/p1-denzil-readiness-handover` → `dev`.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Maintain approved content/template/listing/store readiness records; finalize role guides and training assets. Record actual company/provider approvals and handover evidence. No credential ownership or live bulk-send execution.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded UI/content/locale/SEO/report/guide PRs to Devadathan and relevant domain owner; hand approved source/version and validation evidence to Tinu. Medical approval remains with the physician.

**Traceability:** Named support package; retain parent phase outputs. Requirements: . Outputs: .

### P1-DEN-099 — Protected defect/retest reserve

**Allocated time:** 2 hours (conditional reserve). **Branch:** `fix/p1-denzil-bug-001` → `dev`.

Create this branch only if a matching defect actually exists; the suffix shown is an example. Test execution alone does not require a code branch.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Use only against an actual tracked defect; replace bug-001 with the real issue ID. Reproduce, contain and route to the correct owner; independently retest a reviewed fix on a new candidate. Tinu uses this for triage/retesting, not critical feature coding. Paul/Denzil fix only bounded UI/content defects. If unused, broaden verification/handover; do not add scope or count the reserve as guaranteed repair capacity.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded UI/content/locale/SEO/report/guide PRs to Devadathan and relevant domain owner; hand approved source/version and validation evidence to Tinu. Medical approval remains with the physician.

**Traceability:** P1-E3-099, P1-E5-099. Requirements: R36, R38. Outputs: P1-O09.

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

- D4: staff operations views and approved campaign/review content.
- D5: complete support/KB/locales, SEO/feed and report presentation.
- D6 morning: finish guide drafts and listing/provider dependency register. Final four hours: G2 admin/content/report/localization checks.

The checkpoints order work; they do not add hours beyond the phase budget. G1/G2 verification must include the protected four-hour final-half-day allocation. Phase 3 specialist campaigns may run in parallel, with a named operator and safe provider controls.

**Daily capacity aligned to the phase plan**

| Working day | B: implementation / QA prep | V: verification | E: environment / handover | C: reserve | Total |
|---|---:|---:|---:|---:|---:|
| Day 4 | 7 | 0 | 1 | 0 | 8 |
| Day 5 | 8 | 0 | 0 | 0 | 8 |
| Day 6 | 2 | 4 | 0 | 2 | 8 |

B/V/E/C are daily capacity slices, not new tasks. Review/meetings count within these hours. Follow this member’s package sequence and handoff contracts; do not double-book tasks. Reserve is conditional and otherwise supports verification/handover. On the final day, schedule four V hours in the protected final half-day for everyone; Tinu also has two earlier V hours. Background test runtime is not extra staffed capacity; record actual operator/reviewer time.

**Named test execution/support groups:** P2-T04, P2-T06, P2-T13, P2-T17, P2-T20, P2-T23, P2-T24, P2-T26, P2-T28, P2-T30, P2-T31. The detailed procedures are in Tinu’s annex. These are minimum named duties; also help with impacted cumulative regression and the shared gate. Tinu coordinates execution rather than replacing the listed specialist/domain operator.

**Entry and dependencies:** G1 must pass first. Build on accepted contracts and reviewed components; keep Phase 1 critical tests running. Complete actual features by G2; track pending public approvals explicitly for Phase 3.

| Package | Hours | Branch from `dev`; PR to `dev` |
|---|---:|---|
| P2-DEN-001 — Staff operational screens | 5 | `feature/p2-denzil-staff-operations-ui` |
| P2-DEN-002 — Campaign, promotion, review and content presentation | 4 | `feature/p2-denzil-growth-review-content` |
| P2-DEN-003 — Locales, KB and support UI completion | 4 | `feature/p2-denzil-locales-knowledge-support` |
| P2-DEN-004 — SEO/feed, report presentation and training drafts | 4 | `feature/p2-denzil-seo-reports-guides` |
| P2-DEN-090 — G2 verification and cumulative regression | 4 | `test/p2-denzil-g2-verification` |
| P2-DEN-080 — Environment, acceptance and handover support | 1 | `chore/p2-denzil-readiness-handover` |
| P2-DEN-099 — Protected defect/retest reserve | 2 | `fix/p2-denzil-bug-001` |

### P2-DEN-001 — Staff operational screens

**Allocated time:** 5 hours (implementation / QA preparation). **Branch:** `feature/p2-denzil-staff-operations-ui` → `dev`.

**Inputs and integration handoffs:** P2-JOS-001, P2-JOS-004, P2-DEV-001. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Assemble provided order/packing/return/batch/recall/transfer views and forms.
2. Use reviewed action adapters and read-only report APIs; backend owns all authorization/math.
3. Build ordinary doctor/content/support table/filter/status presentation around senior-owned sensitive controls.
4. Test role-specific field visibility and refuse to bypass 403 responses.
5. C04 — Authorized front desk creates an in-clinic outpatient appointment in the same canonical booking lifecycle with source/staff actor and correct clinic fee/payment/refund state; use the same global doctor overlap constraints. It cannot be confused with a walk-in product order. Assigned physicians see policy-permitted past purchases in the linked patient view; unassigned/revoked/cross-patient/clinic access remains denied. Doctor management also includes approved qualifications/photo, slot length and online/in-clinic/both availability settings; front-desk operational readiness is demonstrated before public launch. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Reviewed staff UI journeys with warehouse/front-desk feedback.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded UI/content/locale/SEO/report/guide PRs to Devadathan and relevant domain owner; hand approved source/version and validation evidence to Tinu. Medical approval remains with the physician.

**Traceability:** P2-E3-001, P2-E3-002. Requirements: R01, R02, R03, R04, R05, R06, R07, R09, R10, R11, R12, R14, R15, R16, R20, R22, R26, R32, R36. Outputs: P2-O01, P2-O02, P2-O03, P2-O06.

### P2-DEN-002 — Campaign, promotion, review and content presentation

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p2-denzil-growth-review-content` → `dev`.

**Inputs and integration handoffs:** P2-MAT-004, P2-JOS-003. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Prepare company-approved seasonal promotion and first-campaign content/assets.
2. Build segment/template/consent status and preview UI through reviewed APIs.
3. Build verified review/moderation and doctor product-content presentation.
4. Do not send bulk campaigns or approve clinical claims; company owners approve activation.
5. Build the branded seasonal campaign landing page from Devadathan’s approved template and link it to Josin’s authoritative promotion API; support scheduled publication and end/withdrawal states.
6. C06 — Demonstrate all three approved campaign types: new product, restock and seasonal offer. Build consented prior-purchase segments from authorized commerce facts, with preview/counts, quotas, quiet hours, current opt-out and deduplicated attribution. No raw clinical notes or inferred health-interest audience without explicit business/privacy approval; live sending uses company-controlled approved recipients. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Approved content register and complete moderation/campaign screens.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded UI/content/locale/SEO/report/guide PRs to Devadathan and relevant domain owner; hand approved source/version and validation evidence to Tinu. Medical approval remains with the physician.

**Traceability:** P2-E3-003, P2-E5-002. Requirements: R07, R08, R09, R10, R12, R27, R28, R29, R30, R31, R33. Outputs: P2-O01, P2-O02, P2-O03, P2-O05.

### P2-DEN-003 — Locales, KB and support UI completion

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p2-denzil-locales-knowledge-support` → `dev`.

**Inputs and integration handoffs:** P2-MAT-002, P2-MAT-003, P2-DEV-001. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Complete approved EN/ML/TA strings, invoice/notification labels and missing-key audit.
2. Assemble approval/withdrawal/version and handoff/callback views using Mathew’s contracts.
3. Keep medical blocks and translations attributed to approved source versions.
4. Prepare safe additional-language fallback copy; no invented translation approval.
5. C01 — Reconcile every published catalogue product to its physician-approved monograph/dosage/contraindication and required EN/ML/TA safety translations. No published product is an unexplained coverage gap. G1 records the complete inventory/gap register and an approved sample; G2 closes required product coverage and demonstrates approved edit/withdrawal propagation within a company-agreed measured freshness deadline. The illustrative morning-to-afternoon statement is not an invented numeric provider SLA. Include approved public physician profiles and the required knowledge types; approval is not satisfied by catalogue text alone. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.
6. C02 — Record privacy-minimized answer-to-approved-entry/version attribution, not raw health prompts in general analytics. Content reviewers can view most-used entry/version counts with date filters and freshness labels. Define whether counts represent used answer entries or retrieval hits; count retries once by stable answer/event identity and reconcile known fixtures. Unauthorized roles cannot access the content report. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Locale audit, editor/approver separation screenshots and support guide draft.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded UI/content/locale/SEO/report/guide PRs to Devadathan and relevant domain owner; hand approved source/version and validation evidence to Tinu. Medical approval remains with the physician.

**Traceability:** P2-E3-002, P2-E5-001, P2-E5-003. Requirements: R01, R03, R10, R11, R12, R14, R15, R16, R17, R18, R19, R20, R21, R22, R23, R24, R35, R36. Outputs: P2-O02, P2-O03.

### P2-DEN-004 — SEO/feed, report presentation and training drafts

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p2-denzil-seo-reports-guides` → `dev`.

**Inputs and integration handoffs:** P2-JOS-004, P2-MAT-004, P2-DEV-004. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Complete canonical/alternates/schema/sitemap/redirect/feed artifacts under Devadathan’s review.
2. Present authorized reconciled report APIs with formulas/freshness/scope labels from Josin/Mathew.
3. Collect actual listing/store/provider readiness evidence and draft role guides.
4. Exclude private routes/content from feeds, indexing and analytics.
5. C02 — Record privacy-minimized answer-to-approved-entry/version attribution, not raw health prompts in general analytics. Content reviewers can view most-used entry/version counts with date filters and freshness labels. Define whether counts represent used answer entries or retrieval hits; count retries once by stable answer/event identity and reconcile known fixtures. Unauthorized roles cannot access the content report. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.
6. C07 — Hand over a dated maintenance calendar: daily reconciliation; weekly access/job/backup/capacity/security checks; monthly physician review of flagged conversations and knowledge changes; quarterly operating/performance report. Name primary/backup owners, priority-fix/security/app-release workflow, and the proposal’s up-to-eight-hours-per-month knowledge-maintenance allowance with an agreed overflow/response process. These are support obligations/operating labor, not extra sprint capacity, new subscription pricing, or automatically created reminders. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Validated SEO/feed artifacts, reconciled report screenshots and complete guide drafts.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded UI/content/locale/SEO/report/guide PRs to Devadathan and relevant domain owner; hand approved source/version and validation evidence to Tinu. Medical approval remains with the physician.

**Traceability:** P2-E3-004, P2-E5-004, P2-E6-003. Requirements: R16, R17, R19, R20, R22, R23, R25, R27, R28, R29, R34, R35, R36, R37, R38. Outputs: P2-O03, P2-O05, P2-O06, P2-O07.

### P2-DEN-090 — G2 verification and cumulative regression

**Allocated time:** 4 hours (verification). **Branch:** `test/p2-denzil-g2-verification` → `dev`.

Merge necessary test-code changes before freeze; run results belong in the evidence store. Do not invalidate the frozen candidate with an evidence-only application change.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Execute staff/content/KB role separation/locales/SEO/feed/campaign/report/guide checks using approved content and reconciled API fixtures. Record missing approvals and private-data/indexing/analytics leaks. Seek domain review rather than guessing expected results.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded UI/content/locale/SEO/report/guide PRs to Devadathan and relevant domain owner; hand approved source/version and validation evidence to Tinu. Medical approval remains with the physician.

**Traceability:** P2-E3-090, P2-E5-090. Requirements: R01, R03, R04, R07, R08, R10, R14, R16, R17, R18, R19, R20, R21, R22, R23, R24, R27, R28, R29, R30, R31, R33, R34, R35. Outputs: P2-O07.

### P2-DEN-080 — Environment, acceptance and handover support

**Allocated time:** 1 hours (environment / handover). **Branch:** `chore/p2-denzil-readiness-handover` → `dev`.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Maintain approved content/template/listing/store readiness records; finalize role guides and training assets. Record actual company/provider approvals and handover evidence. No credential ownership or live bulk-send execution.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded UI/content/locale/SEO/report/guide PRs to Devadathan and relevant domain owner; hand approved source/version and validation evidence to Tinu. Medical approval remains with the physician.

**Traceability:** Named support package; retain parent phase outputs. Requirements: . Outputs: .

### P2-DEN-099 — Protected defect/retest reserve

**Allocated time:** 2 hours (conditional reserve). **Branch:** `fix/p2-denzil-bug-001` → `dev`.

Create this branch only if a matching defect actually exists; the suffix shown is an example. Test execution alone does not require a code branch.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Use only against an actual tracked defect; replace bug-001 with the real issue ID. Reproduce, contain and route to the correct owner; independently retest a reviewed fix on a new candidate. Tinu uses this for triage/retesting, not critical feature coding. Paul/Denzil fix only bounded UI/content defects. If unused, broaden verification/handover; do not add scope or count the reserve as guaranteed repair capacity.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded UI/content/locale/SEO/report/guide PRs to Devadathan and relevant domain owner; hand approved source/version and validation evidence to Tinu. Medical approval remains with the physician.

**Traceability:** P2-E3-099, P2-E5-099. Requirements: R36, R38. Outputs: P2-O07.

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

- D7: verify paid-candidate report/content/SEO artifacts and actual approval status.
- D8: execute content/admin/locale/accessibility checks and bounded fixes.
- D9: record approved content/front-desk/marketing guides and training with owners.
- D10: verify required public listings/first campaign status, final live content checks and handover evidence.

The checkpoints order work; they do not add hours beyond the phase budget. G1/G2 verification must include the protected four-hour final-half-day allocation. Phase 3 specialist campaigns may run in parallel, with a named operator and safe provider controls.

**Daily capacity aligned to the phase plan**

| Working day | B: implementation / QA prep | V: verification | E: environment / handover | C: reserve | Total |
|---|---:|---:|---:|---:|---:|
| Day 7 | 3 | 4 | 0 | 1 | 8 |
| Day 8 | 2 | 4 | 0 | 2 | 8 |
| Day 9 | 1 | 3 | 3 | 1 | 8 |
| Day 10 | 0 | 2 | 4 | 2 | 8 |

B/V/E/C are daily capacity slices, not new tasks. Review/meetings count within these hours. Follow this member’s package sequence and handoff contracts; do not double-book tasks. Reserve is conditional and otherwise supports verification/handover. Background test runtime is not extra staffed capacity; record actual operator/reviewer time.

**Named test execution/support groups:** P3-T11, P3-T15, P3-T16, P3-T28, P3-T30. The detailed procedures are in Tinu’s annex. These are minimum named duties; also help with impacted cumulative regression and the shared gate. Tinu coordinates execution rather than replacing the listed specialist/domain operator.

**Entry and dependencies:** G2 complete-feature candidate and paid readiness must pass first. Use production-equivalent paid settings, pinned artifacts and realistic synthetic retained data. Every relevant code/config/model/KB change invalidates affected evidence.

| Package | Hours | Branch from `dev`; PR to `dev` |
|---|---:|---|
| P3-DEN-001 — Bounded staff/content corrections | 3 | `feature/p3-denzil-admin-content-fixes` |
| P3-DEN-002 — SEO, reports and operating material corrections | 3 | `feature/p3-denzil-seo-report-fixes` |
| P3-DEN-090 — G3 verification and cumulative regression | 13 | `test/p3-denzil-g3-verification` |
| P3-DEN-080 — Environment, acceptance and handover support | 7 | `chore/p3-denzil-readiness-handover` |
| P3-DEN-099 — Protected defect/retest reserve | 6 | `fix/p3-denzil-bug-001` |

### P3-DEN-001 — Bounded staff/content corrections

**Allocated time:** 3 hours (implementation / QA preparation). **Branch:** `feature/p3-denzil-admin-content-fixes` → `dev`.

**Inputs and integration handoffs:** P3-MAT-001, P3-DEV-002. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Fix reproduced staff table/filter/label/template/locale defects.
2. Obtain physician/company review before any approved wording/version change.
3. Keep consent/scope/current-state decisions in reviewed APIs.
4. Update guide steps to match the final screens.
5. C06 — Demonstrate all three approved campaign types: new product, restock and seasonal offer. Build consented prior-purchase segments from authorized commerce facts, with preview/counts, quotas, quiet hours, current opt-out and deduplicated attribution. No raw clinical notes or inferred health-interest audience without explicit business/privacy approval; live sending uses company-controlled approved recipients. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Reviewed admin/content fixes and current approved guide copy.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded UI/content/locale/SEO/report/guide PRs to Devadathan and relevant domain owner; hand approved source/version and validation evidence to Tinu. Medical approval remains with the physician.

**Traceability:** P3-E3-001, P3-E5-002. Requirements: R01, R03, R04, R07, R08, R09, R10, R14, R16, R20, R21, R22, R27, R28, R29, R30, R33, R35, R38. Outputs: P3-O02, P3-O03, P3-O05.

### P3-DEN-002 — SEO, reports and operating material corrections

**Allocated time:** 3 hours (implementation / QA preparation). **Branch:** `feature/p3-denzil-seo-report-fixes` → `dev`.

**Inputs and integration handoffs:** P3-JOS-002, P3-DEV-001. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Correct feed/schema/redirect/canonical and display/freshness/formula-label defects.
2. Check report figures against Josin’s reconciled fixtures without changing financial SQL.
3. Record actual public listing/campaign/provider approvals; pending is not passed.
4. Prepare source-linked role guides and handover ownership lists.
5. C02 — Record privacy-minimized answer-to-approved-entry/version attribution, not raw health prompts in general analytics. Content reviewers can view most-used entry/version counts with date filters and freshness labels. Define whether counts represent used answer entries or retrieval hits; count retries once by stable answer/event identity and reconcile known fixtures. Unauthorized roles cannot access the content report. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Validated public artifacts, accurate report presentation and final guide drafts.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded UI/content/locale/SEO/report/guide PRs to Devadathan and relevant domain owner; hand approved source/version and validation evidence to Tinu. Medical approval remains with the physician.

**Traceability:** P3-E3-002. Requirements: R16, R27, R28, R29, R30, R34, R35, R37. Outputs: P3-O02, P3-O05, P3-O06.

### P3-DEN-090 — G3 verification and cumulative regression

**Allocated time:** 13 hours (verification). **Branch:** `test/p3-denzil-g3-verification` → `dev`.

Merge necessary test-code changes before freeze; run results belong in the evidence store. Do not invalidate the frozen candidate with an evidence-only application change.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Execute staff/content/KB role separation/locales/SEO/feed/campaign/report/guide checks using approved content and reconciled API fixtures. Record missing approvals and private-data/indexing/analytics leaks. Seek domain review rather than guessing expected results.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded UI/content/locale/SEO/report/guide PRs to Devadathan and relevant domain owner; hand approved source/version and validation evidence to Tinu. Medical approval remains with the physician.

**Traceability:** P3-E3-090, P3-E5-090. Requirements: R01, R03, R04, R07, R08, R10, R14, R16, R17, R18, R19, R20, R21, R22, R23, R24, R27, R28, R29, R30, R31, R33, R34, R35, R37, R38. Outputs: P3-O07.

### P3-DEN-080 — Environment, acceptance and handover support

**Allocated time:** 7 hours (environment / handover). **Branch:** `chore/p3-denzil-readiness-handover` → `dev`.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Maintain approved content/template/listing/store readiness records; finalize role guides and training assets. Record actual company/provider approvals and handover evidence. No credential ownership or live bulk-send execution.

**Integrated review C07:** Hand over a dated maintenance calendar: daily reconciliation; weekly access/job/backup/capacity/security checks; monthly physician review of flagged conversations and knowledge changes; quarterly operating/performance report. Name primary/backup owners, priority-fix/security/app-release workflow, and the proposal’s up-to-eight-hours-per-month knowledge-maintenance allowance with an agreed overflow/response process. These are support obligations/operating labor, not extra sprint capacity, new subscription pricing, or automatically created reminders.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded UI/content/locale/SEO/report/guide PRs to Devadathan and relevant domain owner; hand approved source/version and validation evidence to Tinu. Medical approval remains with the physician.

**Traceability:** P3-E3-080, P3-E5-080. Requirements: R25, R36, R37, R38. Outputs: P3-O05, P3-O06, P3-O07.

### P3-DEN-099 — Protected defect/retest reserve

**Allocated time:** 6 hours (conditional reserve). **Branch:** `fix/p3-denzil-bug-001` → `dev`.

Create this branch only if a matching defect actually exists; the suffix shown is an example. Test execution alone does not require a code branch.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Use only against an actual tracked defect; replace bug-001 with the real issue ID. Reproduce, contain and route to the correct owner; independently retest a reviewed fix on a new candidate. Tinu uses this for triage/retesting, not critical feature coding. Paul/Denzil fix only bounded UI/content defects. If unused, broaden verification/handover; do not add scope or count the reserve as guaranteed repair capacity.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; Mathew/Josin where the contract crosses their domain. No self-approval of critical changes.

**Handoff:** Send bounded UI/content/locale/SEO/report/guide PRs to Devadathan and relevant domain owner; hand approved source/version and validation evidence to Tinu. Medical approval remains with the physician.

**Traceability:** P3-E3-099, P3-E5-099. Requirements: R36, R38. Outputs: P3-O07.

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
| P1-E2-001 — Establish commerce schema, opening imports and ledger contracts | P1-DEN-001 |
| P1-E3-001 — Build reusable web/workspace foundation and language system | P1-DEN-002 |
| P1-E3-003 — Implement directory, booking and staff/physician skeleton screens | P1-DEN-003 |
| P1-E3-004 — Build approved-content editor foundation and integrate channel shells | P1-DEN-002 |
| P1-E3-090 — Web/workspace cumulative verification | P1-DEN-090 |
| P1-E3-099 — Protected defect/retest contingency | P1-DEN-099 |
| P1-E4-004 — Prepare chat/voice/push contracts and store-release inputs | P1-DEN-004 |
| P1-E5-001 — Implement approved knowledge model and bounded ingestion | P1-DEN-002 |
| P1-E5-003 — Prove messaging/voice providers and event-consumer contracts | P1-DEN-004 |
| P1-E5-004 — Prepare evaluation pack, human-routing state and integration evidence | P1-DEN-004 |
| P1-E5-090 — Companion/channel cumulative verification | P1-DEN-090 |
| P1-E5-099 — Protected defect/retest contingency | P1-DEN-099 |
| P2-E3-001 — Complete customer commerce and operational workspaces | P2-DEN-001 |
| P2-E3-002 — Complete physician, content, schedule and support workspaces | P2-DEN-001, P2-DEN-003 |
| P2-E3-003 — Complete growth, wholesale, review and loyalty interfaces | P2-DEN-002 |
| P2-E3-004 — Complete reports, SEO/listings, localization and training drafts | P2-DEN-004 |
| P2-E3-090 — Full web/staff/language/report verification | P2-DEN-090 |
| P2-E3-099 — Protected defect/retest contingency | P2-DEN-099 |
| P2-E5-001 — Complete safe multilingual RAG and authorized conversational actions | P2-DEN-003 |
| P2-E5-002 — Complete messages, schedules, campaigns and suppression rules | P2-DEN-002 |
| P2-E5-003 — Complete WhatsApp, human support and bounded voice workflows | P2-DEN-003 |
| P2-E5-004 — Complete conversion/report events, evaluation evidence and support drafts | P2-DEN-004 |
| P2-E5-090 — Full clinical evaluation/channel/automation verification | P2-DEN-090 |
| P2-E5-099 — Protected defect/retest contingency | P2-DEN-099 |
| P2-E6-003 — Prepare paid verification, restore scripts and release runbooks | P2-DEN-004 |
| P3-E3-001 — Harden complete web/workspace UX, language and data presentation | P3-DEN-001 |
| P3-E3-002 — Validate public SEO, feeds, campaigns and operating guides | P3-DEN-002 |
| P3-E3-080 — Lead web/content/front-desk handover and public content verification | P3-DEN-080 |
| P3-E3-090 — Final browser/language/accessibility/growth/report UAT | P3-DEN-090 |
| P3-E3-099 — Protected defect/retest contingency | P3-DEN-099 |
| P3-E5-002 — Verify messaging reliability, attribution and channel readiness | P3-DEN-001 |
| P3-E5-080 — Lead support/marketing/clinical-content training and channel activation | P3-DEN-080 |
| P3-E5-090 — Final physician-reviewed AI/channel/schedule/outage verification | P3-DEN-090 |
| P3-E5-099 — Protected defect/retest contingency | P3-DEN-099 |

## Test-case handoff

Use [Tinu’s standalone detailed test cases](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) for all 86 phase groups and 38 requirement walkthroughs, shared synthetic fixtures, action/expected-result pairs and evidence rules. Execute your domain cases with Tinu; do not wait until the phase-end campaign to begin testing. Source phase specifications retain their additional matrices and acceptance criteria.

## Final personal completion record

Record package/PR, candidate/build IDs, requirement/output IDs, reviewer and domain approval, test runs/defects/retests, actual public-channel status, training/handover links and remaining approved low-risk issues. Leave unexecuted work Pending/Blocked. Final completion requires G3, all R01–R38 acceptance, public required channels and company ownership/support handover.
