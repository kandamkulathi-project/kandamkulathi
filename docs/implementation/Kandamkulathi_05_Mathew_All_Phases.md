# Kandamkulathi — Mathew: three-phase individual implementation plan

**Issue date:** 19 October 2026. **Delivery window:** 19–30 October, ten working days. **Team:** six people. **Status:** planned work and acceptance criteria; no implementation or test results are claimed.

**Role:** Backend and AI technical lead; clinical safety implementation.

Own identity/authorization, clinical and booking APIs, safe AI/RAG and tools, privileged channel handlers and transaction reviews. Review every sensitive commerce change. Devadathan independently reviews your sensitive changes; the company physician approves medical behavior and content.

**Boundaries:** Do not invent medical rules, change physician dosage, approve your own critical changes, or silently take over every UI task. Use agreed contracts and small reviewed integrations.

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
| 1 | 18 | 4 | 0 | 2 | 24 |
| 2 | 18 | 4 | 0 | 2 | 24 |
| 3 | 7 | 12 | 6 | 7 | 32 |
| **Total** | 43 | 20 | 6 | 11 | **80** |

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

**Window:** Days 1–3 · 19–21 October 2026. **Capacity:** 24 hours; implementation/QA preparation 18, verification 4, environment/handover 0, reserve 2.

This is a capacity ceiling for adapting proven components and completing the allocated scope, including review within the relevant package. It is not a measured greenfield estimate. Escalate missing reuse and review overload on Day 1; do not consume protected test time to hide it.

**Sequence and handoff checkpoints**

- D1: agree access/schema/API contracts; prove reusable identity, RLS and safe AI components; give fixture contracts to Tinu.
- D2: complete booking/clinical and RAG/tool paths; integrate payments/channels; review Josin’s critical PRs.
- D3 morning: complete privileged handlers, negative tests and critical reviews. Final four hours: G1 security/clinical/AI tests and retests.

The checkpoints order work; they do not add hours beyond the phase budget. G1/G2 verification must include the protected four-hour final-half-day allocation. Phase 3 specialist campaigns may run in parallel, with a named operator and safe provider controls.

**Daily capacity aligned to the phase plan**

| Working day | B: implementation / QA prep | V: verification | E: environment / handover | C: reserve | Total |
|---|---:|---:|---:|---:|---:|
| Day 1 | 8 | 0 | 0 | 0 | 8 |
| Day 2 | 8 | 0 | 0 | 0 | 8 |
| Day 3 | 2 | 4 | 0 | 2 | 8 |

B/V/E/C are daily capacity slices, not new tasks. Review/meetings count within these hours. Follow this member’s package sequence and handoff contracts; do not double-book tasks. Reserve is conditional and otherwise supports verification/handover. On the final day, schedule four V hours in the protected final half-day for everyone; Tinu also has two earlier V hours. Background test runtime is not extra staffed capacity; record actual operator/reviewer time.

**Named test execution/support groups:** P1-T02, P1-T03, P1-T04, P1-T05, P1-T06, P1-T07, P1-T08, P1-T11, P1-T12, P1-T13, P1-T14, P1-T15, P1-T16, P1-T17, P1-T18, P1-T19. The detailed procedures are in Tinu’s annex. These are minimum named duties; also help with impacted cumulative regression and the shared gate. Tinu coordinates execution rather than replacing the listed specialist/domain operator.

**Entry and dependencies:** Start from approved company content/rules, reusable SDK proof, company accounts and synthetic fixtures. Mathew/Josin publish contracts before parallel screens. Devadathan provides components and environment access.

| Package | Hours | Branch from `dev`; PR to `dev` |
|---|---:|---|
| P1-MAT-001 — Identity, scoped access and clinical contracts | 4 | `feature/p1-mathew-identity-clinical-contracts` |
| P1-MAT-002 — Booking, doctor availability and clinical foundation | 4 | `feature/p1-mathew-booking-clinical-core` |
| P1-MAT-003 — Approved knowledge and safe chatbot foundation | 5 | `feature/p1-mathew-safe-rag-foundation` |
| P1-MAT-004 — Privileged messaging, voice and durable job contracts | 3 | `feature/p1-mathew-channel-job-contracts` |
| P1-MAT-005 — Critical transaction and authorization review | 2 | `feature/p1-mathew-critical-domain-review` |
| P1-MAT-090 — G1 verification and cumulative regression | 4 | `test/p1-mathew-g1-verification` |
| P1-MAT-099 — Protected defect/retest reserve | 2 | `fix/p1-mathew-bug-001` |

### P1-MAT-001 — Identity, scoped access and clinical contracts

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p1-mathew-identity-clinical-contracts` → `dev`.

**Inputs and integration handoffs:** P1-DEV-001. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Agree actor/clinic/patient matrix and API/error/idempotency contracts with Josin and Devadathan before screens integrate.
2. Adapt verified customer/staff sessions, organization MFA, CSRF and deny-by-default helpers.
3. Use non-owner runtime roles and transaction-local PostgreSQL RLS context; prove cleanup after rollback/pool reuse.
4. Publish schema and examples for clinical assignment, consent, recommendations and tools.
5. C03 — Capture versioned required sign-up/privacy consent without bundling marketing opt-in; record and enforce required consultation identity/consent before private video/clinical access. Before personalized medical recommendation, follow physician-approved minimal intake including age/current medication and pregnancy/child/red-flag routing; unknown or declined required information uses approved clarification/handoff. Do not impose clinical intake on ordinary public catalogue browsing or infer a diagnosis. Verify configured transport and at-rest protection for clinical database/private objects/backups and approved processor flows using actual configuration/provider evidence; no plaintext secret/health-content evidence dump. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Reviewed access matrix, migrations, contract examples and cross-scope denial tests.

**Required review:** Devadathan; physician approval where clinical. No self-approval of critical changes.

**Handoff:** Publish reviewed contracts/role and safety rules to Devadathan, Josin, Paul and Denzil; give approved fixtures/negative cases and read-only evidence helpers to Tinu. Request physician approval where clinical.

**Traceability:** P1-E1-001, P1-E1-002. Requirements: R03, R11, R12, R14, R15, R18, R19, R36. Outputs: P1-O02, P1-O03.

<details>
<summary>Retained technical specification: P1-E1-001 — Freeze domain contracts, clinical schema and access model</summary>

Publish the actor/clinic/patient role matrix and ownership rules for customer, physician, front desk, warehouse, finance, content editor/approver and administrator. Define directory, availability, booking/hold, consent, clinical note and signed recommendation schemas; include UTC timestamps, explicit clinic timezone, money in paise, version fields and immutable audit references. Agree the shared API/error/event/idempotency contracts with Josin/Devadathan with Paul/Denzil/Devadathan with Paul/Mathew with Denzil’s content support before dependent screens diverge. Classify private fields and record opening-data validation rules.

**Acceptance inherited:** Reviewed contracts and migrations support two clinics and a doctor working across locations; all consumers use the same identifiers/state names. No patient history is migrated beyond the approved opening data.

**Evidence inherited:** Contract/schema review, field-classification map, seed validation and role-permission fixtures.

</details>

<details>
<summary>Retained technical specification: P1-E1-002 — Implement verified identity and scoped authorization</summary>

Implement verified customer and organization-scoped staff session middleware; validate issuer/audience/expiry/session and required staff organization/MFA policy. Add cookie/CSRF rules for web and shared native session contracts. Apply role/clinic/patient filters and transaction-local RLS context using non-owner runtime roles. Build deny-by-default helpers for assistant tools and privileged routes; record safe 401/403/not-found responses and revocation behavior. Never accept a client-supplied actor or clinic as authorization. Review clarification C03: Capture versioned required sign-up/privacy consent without bundling marketing opt-in; record and enforce required consultation identity/consent before private video/clinical access. Before personalized medical recommendation, follow physician-approved minimal intake including age/current medication and pregnancy/child/red-flag routing; unknown or declined required information uses approved clarification/handoff. Do not impose clinical intake on ordinary public catalogue browsing or infer a diagnosis. Verify configured transport and at-rest protection for clinical database/private objects/backups and approved processor flows using actual configuration/provider evidence; no plaintext secret/health-content evidence dump.

**Acceptance inherited:** Customer login cannot enter staff routes; patient/clinic crossover and pooled connection reuse fail closed. Secrets and owner credentials are absent from client bundles.

**Evidence inherited:** Positive/negative role tests, expired/revoked session cases, cross-patient/clinic and reused pooled-client results.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P1-MAT-002 — Booking, doctor availability and clinical foundation

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p1-mathew-booking-clinical-core` → `dev`.

**Inputs and integration handoffs:** P1-MAT-001, P1-JOS-003. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Implement doctor/location/leave/fee/slot APIs and explicit hold states.
2. Enforce doctor intervals including buffers across clinics using reviewed database constraints.
3. Handle expiry and late payment through rebook/refund obligations with Josin.
4. Expose minimal assigned-record/consent APIs; freeze signed recommendation and dose schedule contracts.
5. C04 — Authorized front desk creates an in-clinic outpatient appointment in the same canonical booking lifecycle with source/staff actor and correct clinic fee/payment/refund state; use the same global doctor overlap constraints. It cannot be confused with a walk-in product order. Assigned physicians see policy-permitted past purchases in the linked patient view; unassigned/revoked/cross-patient/clinic access remains denied. Doctor management also includes approved qualifications/photo, slot length and online/in-clinic/both availability settings; front-desk operational readiness is demonstrated before public launch. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Concurrent booking evidence, cross-clinic conflict tests and physician-reviewed API contracts.

**Required review:** Devadathan; physician approval where clinical. No self-approval of critical changes.

**Handoff:** Publish reviewed contracts/role and safety rules to Devadathan, Josin, Paul and Denzil; give approved fixtures/negative cases and read-only evidence helpers to Tinu. Request physician approval where clinical.

**Traceability:** P1-E1-003, P1-E1-004. Requirements: R03, R10, R11, R12, R14, R15, R32, R36. Outputs: P1-O02, P1-O03, P1-O05, P1-O06.

<details>
<summary>Retained technical specification: P1-E1-003 — Implement directory, availability and paid booking invariants</summary>

Implement clinic/department/doctor records, per-location hours/languages/fees, leave and online/in-clinic availability. Add btree_gist/GiST doctor-interval exclusion including buffers and half-open boundaries across clinics. Implement held/confirmed/expired/cancelled states, hold ownership/version, explicit expiry and fee snapshot. Connect payment confirmation and late-payment rebook-or-refund obligations without network calls inside transactions.

**Acceptance inherited:** One booked doctor cannot overlap across clinics; adjacent valid slots work; held/late/duplicate payments cannot create duplicate confirmations.

**Evidence inherited:** Concurrent-slot, buffer, leave, expired-hold and late-webhook integration tests; booking/payment/outbox control totals.

</details>

<details>
<summary>Retained technical specification: P1-E1-004 — Expose clinical/admin foundations and review core transactions</summary>

Expose assigned-consultation/consent and clinical-record API foundations required by staff/doctor screens. Define physician-authored schedule and signed consult-to-cart contracts for Phase 2, with immutable versions and actor audit. Review Josin reservation/payment state transitions and rollback guards; pair on pool/RLS cleanup. Provide the shared authorization adapter for Mathew with Denzil’s content support internal tools and Devadathan with Paul video membership checks.

**Acceptance inherited:** Available clinical/admin routes enforce the role matrix; Phase 2 schedule/recommendation contracts are frozen and critical transaction review findings are closed.

**Evidence inherited:** API contract examples, assignment/consent negative tests and reviewed transaction PRs.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P1-MAT-003 — Approved knowledge and safe chatbot foundation

**Allocated time:** 5 hours (implementation / QA preparation). **Branch:** `feature/p1-mathew-safe-rag-foundation` → `dev`.

**Inputs and integration handoffs:** P1-MAT-001, P1-DEN-002, P1-DEV-001. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Build draft/approved/withdrawn knowledge versions and public-only Vectorize ingestion.
2. Load mandatory medical/safety blocks independently and validate approval in primary PostgreSQL before answering.
3. Implement cited answers, urgent/consult-only routing, typed proposals and explicit current-state confirmation.
4. Bound model leases, timeouts and rate limits; support safe fallback and human handoff.
5. C01 — Reconcile every published catalogue product to its physician-approved monograph/dosage/contraindication and required EN/ML/TA safety translations. No published product is an unexplained coverage gap. G1 records the complete inventory/gap register and an approved sample; G2 closes required product coverage and demonstrates approved edit/withdrawal propagation within a company-agreed measured freshness deadline. The illustrative morning-to-afternoon statement is not an invented numeric provider SLA. Include approved public physician profiles and the required knowledge types; approval is not satisfied by catalogue text alone. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.
6. C03 — Capture versioned required sign-up/privacy consent without bundling marketing opt-in; record and enforce required consultation identity/consent before private video/clinical access. Before personalized medical recommendation, follow physician-approved minimal intake including age/current medication and pregnancy/child/red-flag routing; unknown or declined required information uses approved clarification/handoff. Do not impose clinical intake on ordinary public catalogue browsing or infer a diagnosis. Verify configured transport and at-rest protection for clinical database/private objects/backups and approved processor flows using actual configuration/provider evidence; no plaintext secret/health-content evidence dump. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Approved seed knowledge, safe citations, negative retrieval/tool cases and versioned model configuration.

**Required review:** Devadathan; physician approval where clinical. No self-approval of critical changes.

**Handoff:** Publish reviewed contracts/role and safety rules to Devadathan, Josin, Paul and Denzil; give approved fixtures/negative cases and read-only evidence helpers to Tinu. Request physician approval where clinical.

**Traceability:** P1-E5-001, P1-E5-002. Requirements: R01, R14, R16, R17, R18, R19, R20, R22, R23, R36. Outputs: P1-O03, P1-O07.

<details>
<summary>Retained technical specification: P1-E5-001 — Implement approved knowledge model and bounded ingestion</summary>

Implement KB provenance, language, scope, draft/approved/withdrawn versions, physician approval and mandatory safety-block records. Import reviewed text into a structured editor pipeline, hash/version sources and index only approved public chunks in Vectorize. Define exact SKU/alias/keyword resolution, translation availability and withdrawal events. Keep patient notes/conversations outside the public corpus; do not assume arbitrary PDF OCR/scanning inside a normal Worker. Review clarification C01: Reconcile every published catalogue product to its physician-approved monograph/dosage/contraindication and required EN/ML/TA safety translations. No published product is an unexplained coverage gap. G1 records the complete inventory/gap register and an approved sample; G2 closes required product coverage and demonstrates approved edit/withdrawal propagation within a company-agreed measured freshness deadline. The illustrative morning-to-afternoon statement is not an invented numeric provider SLA. Include approved public physician profiles and the required knowledge types; approval is not satisfied by catalogue text alone.

**Acceptance inherited:** Approved seed data is traceable to physician/version; draft, private or withdrawn content never authorizes an answer.

**Evidence inherited:** Approval/import/withdrawal fixtures, public/private separation and indexed-versus-primary version checks.

</details>

<details>
<summary>Retained technical specification: P1-E5-002 — Implement controlled retrieval, responses and tool boundaries</summary>

Build exact/keyword/vector retrieval with primary approval/version filtering and independent loading of mandatory safety/dosage/contraindication blocks. Render approved medical text separately from bounded model-generated nonclinical wording. Implement typed tool proposals with identity/ownership/current-state checks, explicit confirmation and safe human fallback. Add red-flag/consult-only routing, per-account limits, expiring model-concurrency leases, timeouts and prompt-injection defenses. Log versioned decisions with minimum health content. Review clarification C03: Capture versioned required sign-up/privacy consent without bundling marketing opt-in; record and enforce required consultation identity/consent before private video/clinical access. Before personalized medical recommendation, follow physician-approved minimal intake including age/current medication and pregnancy/child/red-flag routing; unknown or declined required information uses approved clarification/handoff. Do not impose clinical intake on ordinary public catalogue browsing or infer a diagnosis. Verify configured transport and at-rest protection for clinical database/private objects/backups and approved processor flows using actual configuration/provider evidence; no plaintext secret/health-content evidence dump.

**Acceptance inherited:** The initial assistant answers only within approved scope; untrusted text cannot grant tools or alter dosage; urgent test input does not start a sale.

**Evidence inherited:** Cited-answer, missing-safety, injection, unauthorized-tool, stale-index and red-flag seed tests.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P1-MAT-004 — Privileged messaging, voice and durable job contracts

**Allocated time:** 3 hours (implementation / QA preparation). **Branch:** `feature/p1-mathew-channel-job-contracts` → `dev`.

**Inputs and integration handoffs:** P1-MAT-001, P1-DEV-001, P1-MAT-003. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Implement webhook verification, account-link proof and bounded media upload/transcription contracts.
2. Create durable event/lease/deduplication contracts with Devadathan and Josin.
3. Make handoff state pause the bot and define callback ownership.
4. Prepare physician-approved evaluation fixtures; Denzil supplies approved text and Tinu records cases.

**Deliver and verify:** Real provider sandbox proofs, event examples, safe transcript confirmation and evaluation fixture definitions.

**Required review:** Devadathan; physician approval where clinical. No self-approval of critical changes.

**Handoff:** Publish reviewed contracts/role and safety rules to Devadathan, Josin, Paul and Denzil; give approved fixtures/negative cases and read-only evidence helpers to Tinu. Request physician approval where clinical.

**Traceability:** P1-E5-003, P1-E5-004, P1-E6-003. Requirements: R08, R10, R17, R19, R20, R21, R22, R23, R24, R27, R29, R35, R36, R38. Outputs: P1-O06, P1-O07, P1-O08, P1-O09.

<details>
<summary>Retained technical specification: P1-E5-003 — Prove messaging/voice providers and event-consumer contracts</summary>

Prove WhatsApp inbound verification/signature handling, durable event receipt and deduplication using actual company/provider test access. Define account-linking, secure checkout links, delivery callbacks and staff-reply contracts; phone-number matching alone is not identity. Exercise bounded voice transcription into reviewable text and expose ambiguity/permission handling. Implement an initial order-event notification consumer and consent/template routing contracts for Phase 2; redact private payloads from queues/logs.

**Acceptance inherited:** At least one real provider test interaction and one durable event-driven notice are demonstrated; channel approvals/quotas are tracked separately from code.

**Evidence inherited:** Webhook/provider contract results, voice transcript confirmation flow, event deduplication and account-link misuse tests.

</details>

<details>
<summary>Retained technical specification: P1-E5-004 — Prepare evaluation pack, human-routing state and integration evidence</summary>

Create the versioned evaluation set structure: at least 120 launch-language and 40 additional-language/Romanized scenarios by G2, with physician-approved expected outcomes and critical-case labels. Implement handoff/callback state foundations so the bot can pause, record agent ownership and avoid double replies. Define conversation-to-cart/order/booking/handoff event contracts without health analytics leakage. Run initial critical cases and prepare reproducible G1 evidence.

**Acceptance inherited:** Initial critical cases pass and remaining G2 case approvals have owners/deadlines; handoff state and metric contracts are integrated, not just diagrams.

**Evidence inherited:** Evaluation manifest, initial results, human-takeover race proof and privacy-reviewed event schema.

</details>

<details>
<summary>Retained technical specification: P1-E6-003 — Implement queue platform and encrypted backup/restore smoke</summary>

Configure financial/clinical/engagement queue consumers, explicit retry/DLQ settings and one-minute production dispatcher contract. Implement short SKIP LOCKED/lease claim primitives without holding a transaction during publish or provider calls. Trigger duplicate/crash/reclaim/redrive cases and persist idempotent receipt evidence. Export an initial synthetic database using a restricted runner, encrypt independently, restore with roles/extensions and verify R2 manifest linkage.

**Acceptance inherited:** A claimed job survives a crash and duplicate redelivery without repeating its effect; the initial encrypted backup is recoverable.

**Evidence inherited:** Queue/lease/DLQ traces, exported manifest, decryption/restore logs and control totals.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P1-MAT-005 — Critical transaction and authorization review

**Allocated time:** 2 hours (implementation / QA preparation). **Branch:** `feature/p1-mathew-critical-domain-review` → `dev`.

**Inputs and integration handoffs:** P1-JOS-002, P1-JOS-003, P1-DEV-003. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Review Josin’s FEFO row locking, checked guards, payment authenticity and transaction/outbox atomicity.
2. Review Devadathan’s secret/session/native foundations independently.
3. Resolve review findings and add a small regression test for every confirmed critical issue.
4. Record architectural/reuse feasibility gaps immediately.

**Deliver and verify:** Critical PR review records and passing domain invariant tests.

**Required review:** Devadathan; physician approval where clinical. No self-approval of critical changes.

**Handoff:** Publish reviewed contracts/role and safety rules to Devadathan, Josin, Paul and Denzil; give approved fixtures/negative cases and read-only evidence helpers to Tinu. Request physician approval where clinical.

**Traceability:** P1-E1-004, P1-E2-002, P1-E2-003, P1-E6-002. Requirements: R01, R02, R05, R07, R09, R10, R12, R14, R15, R26, R36, R38. Outputs: P1-O01, P1-O02, P1-O04, P1-O05, P1-O06, P1-O08, P1-O09.

<details>
<summary>Retained technical specification: P1-E1-004 — Expose clinical/admin foundations and review core transactions</summary>

Expose assigned-consultation/consent and clinical-record API foundations required by staff/doctor screens. Define physician-authored schedule and signed consult-to-cart contracts for Phase 2, with immutable versions and actor audit. Review Josin reservation/payment state transitions and rollback guards; pair on pool/RLS cleanup. Provide the shared authorization adapter for Mathew with Denzil’s content support internal tools and Devadathan with Paul video membership checks.

**Acceptance inherited:** Available clinical/admin routes enforce the role matrix; Phase 2 schedule/recommendation contracts are frozen and critical transaction review findings are closed.

**Evidence inherited:** API contract examples, assignment/consent negative tests and reviewed transaction PRs.

</details>

<details>
<summary>Retained technical specification: P1-E2-002 — Implement authoritative cart pricing and atomic FEFO reservations</summary>

Build cart/pricing APIs that recompute current prices, quantities, taxes and consult-only eligibility from authoritative state. Lock relevant availability/batch rows in deterministic order and reserve eligible FEFO stock with order/hold/outbox atomically. Enforce nonnegative available balance, expiry/shelf-life/recall exclusion and all-or-nothing multi-item reservation. Use guarded updates with checked row counts, bounded conflict retries and current-version confirmation. Public cached stock never authorizes a purchase.

**Acceptance inherited:** Last-unit and stale-cart races preserve stock; shortage rolls back the whole order/reservation/outbox; client totals are ignored.

**Evidence inherited:** Race/property fixtures, rollback after a failed guard, expired/recalled batch cases and persisted control totals.

</details>

<details>
<summary>Retained technical specification: P1-E2-003 — Integrate payment creation, signed webhooks and idempotent state transitions</summary>

Create provider checkout outside the reservation transaction using stable business references. Verify webhook signatures against raw payload, provider account, amount/currency and expected reference; durably record receipt before acknowledgement. Deduplicate events and handle out-of-order/ambiguous outcomes. Confirm paid order or booking with ledgers/outbox in a short transaction. Build cancellation/refund state-machine foundations and provider reconciliation interfaces; define recurring mandate hooks needed in Phase 2. COD uses a separate policy/state path.

**Acceptance inherited:** Real sandbox success/failure/cancel and duplicate events produce one authorized financial effect; browser callbacks cannot mark paid; lost provider responses enter reconciliation.

**Evidence inherited:** Signed/invalid/replayed/mismatched webhook tests, uncertain-result simulation, booking link and ledger/outbox records.

</details>

<details>
<summary>Retained technical specification: P1-E6-002 — Build test harness, redacted observability and rollback foundation</summary>

Wire real PostgreSQL integration fixtures, browser journeys and a real-device evidence template. Add request/event correlation, scrubbed error logs, health checks, basic latency/error/pool metrics and an independent alert test. Configure versioned deploy/rollback and a current-schema compatibility check. Prepare controlled provider adapters and initial k6 workload without sending bulk traffic to live providers. Review clarification C08: Measure healthy-state due-to-claim pickup p95 below two minutes with agreed server timestamps/sample size while preserving current consent/version/deadline suppression. During fault/backlog tests separately measure deadline recovery and alerts. Configure a defined 30-day core-availability SLI/dashboard and 99.9% internal objective, exclusions and owner; ten-day prelaunch tests cannot prove achieved monthly availability and do not imply a paid vendor SLA or 24-hour clinician staffing.

**Acceptance inherited:** Critical journey and scan reports are generated by CI; alert receipt and prior-version rollback are demonstrated.

**Evidence inherited:** Automated report links, redaction/alert checks, rollback timing and initial load-script manifest.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P1-MAT-090 — G1 verification and cumulative regression

**Allocated time:** 4 hours (verification). **Branch:** `test/p1-mathew-g1-verification` → `dev`.

Merge necessary test-code changes before freeze; run results belong in the evidence store. Do not invalidate the frozen candidate with an evidence-only application change.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Run scoped identity/RLS/clinical/booking/tool/AI negatives, review authenticated security findings, execute physician-approved cases and interpret domain behavior under failure/load. Support advanced recovery and repeat critical fixes independently of their author.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; physician approval where clinical. No self-approval of critical changes.

**Handoff:** Publish reviewed contracts/role and safety rules to Devadathan, Josin, Paul and Denzil; give approved fixtures/negative cases and read-only evidence helpers to Tinu. Request physician approval where clinical.

**Traceability:** P1-E1-090, P1-E5-090. Requirements: R08, R11, R12, R14, R15, R16, R17, R18, R19, R20, R21, R24, R36. Outputs: P1-O09.

### P1-MAT-099 — Protected defect/retest reserve

**Allocated time:** 2 hours (conditional reserve). **Branch:** `fix/p1-mathew-bug-001` → `dev`.

Create this branch only if a matching defect actually exists; the suffix shown is an example. Test execution alone does not require a code branch.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Use only against an actual tracked defect; replace bug-001 with the real issue ID. Reproduce, contain and route to the correct owner; independently retest a reviewed fix on a new candidate. Tinu uses this for triage/retesting, not critical feature coding. Paul/Denzil fix only bounded UI/content defects. If unused, broaden verification/handover; do not add scope or count the reserve as guaranteed repair capacity.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; physician approval where clinical. No self-approval of critical changes.

**Handoff:** Publish reviewed contracts/role and safety rules to Devadathan, Josin, Paul and Denzil; give approved fixtures/negative cases and read-only evidence helpers to Tinu. Request physician approval where clinical.

**Traceability:** P1-E1-099, P1-E5-099. Requirements: R36, R38. Outputs: P1-O09.

### Phase 1 personal handoff and gate checklist

- All assigned packages have reviewed PRs or explicit blocked/conditional status; no direct shared-branch changes.
- APIs/components/content/fixtures are handed to the named dependent owner with examples and known limits.
- Tests include positive, negative, authorization/current-state, retry/failure and relevant persisted-state checks.
- Tinu has exact candidate metadata, requirement/output links, screenshots/request IDs, defects and independent retest references.
- Domain/company reviewers have approved medical/finance/content expectations where needed.
- No unresolved blocker is hidden by a UI workaround, disabled feature, mock provider or skipped test.
- Promotion waits for G1/G2 Pass or the Phase 3 prelaunch Go; Devadathan handles the reviewed merge to `main`. Final G3 closure and `v1.0.0` follow successful postdeployment checks.

## Phase 2: Complete features and integration

**Window:** Days 4–6 · 22, 23 and 26 October 2026. **Capacity:** 24 hours; implementation/QA preparation 18, verification 4, environment/handover 0, reserve 2.

This is a capacity ceiling for adapting proven components and completing the allocated scope, including review within the relevant package. It is not a measured greenfield estimate. Escalate missing reuse and review overload on Day 1; do not consume protected test time to hide it.

**Sequence and handoff checkpoints**

- D4: complete clinical lifecycle and physician schedules; review commerce state changes before integration.
- D5: finish multilingual RAG/actions, WhatsApp/handoff and reminder/suppression handlers; run approved evaluation.
- D6 morning: full access/domain review, integrate complete channels. Final four hours: G2 cumulative clinical/AI/access tests.

The checkpoints order work; they do not add hours beyond the phase budget. G1/G2 verification must include the protected four-hour final-half-day allocation. Phase 3 specialist campaigns may run in parallel, with a named operator and safe provider controls.

**Daily capacity aligned to the phase plan**

| Working day | B: implementation / QA prep | V: verification | E: environment / handover | C: reserve | Total |
|---|---:|---:|---:|---:|---:|
| Day 4 | 8 | 0 | 0 | 0 | 8 |
| Day 5 | 8 | 0 | 0 | 0 | 8 |
| Day 6 | 2 | 4 | 0 | 2 | 8 |

B/V/E/C are daily capacity slices, not new tasks. Review/meetings count within these hours. Follow this member’s package sequence and handoff contracts; do not double-book tasks. Reserve is conditional and otherwise supports verification/handover. On the final day, schedule four V hours in the protected final half-day for everyone; Tinu also has two earlier V hours. Background test runtime is not extra staffed capacity; record actual operator/reviewer time.

**Named test execution/support groups:** P2-T02, P2-T03, P2-T07, P2-T08, P2-T09, P2-T10, P2-T11, P2-T12, P2-T13, P2-T14, P2-T15, P2-T16, P2-T17, P2-T18, P2-T19, P2-T22, P2-T23, P2-T24, P2-T25, P2-T26, P2-T27, P2-T28, P2-T29, P2-T31, P2-T32, P2-T33, P2-T34, P2-T35. The detailed procedures are in Tinu’s annex. These are minimum named duties; also help with impacted cumulative regression and the shared gate. Tinu coordinates execution rather than replacing the listed specialist/domain operator.

**Entry and dependencies:** G1 must pass first. Build on accepted contracts and reviewed components; keep Phase 1 critical tests running. Complete actual features by G2; track pending public approvals explicitly for Phase 3.

| Package | Hours | Branch from `dev`; PR to `dev` |
|---|---:|---|
| P2-MAT-001 — Clinical records, scheduling and physician reminders | 5 | `feature/p2-mathew-clinical-lifecycle` |
| P2-MAT-002 — Complete multilingual safe assistant and typed actions | 5 | `feature/p2-mathew-safe-rag-tools` |
| P2-MAT-003 — WhatsApp, voice and staff handoff backend | 3 | `feature/p2-mathew-whatsapp-handoff` |
| P2-MAT-004 — Reliable financial/clinical/engagement handlers | 2 | `feature/p2-mathew-engagement-job-handlers` |
| P2-MAT-005 — Complete authorization and financial/clinical peer review | 3 | `feature/p2-mathew-critical-review-rls` |
| P2-MAT-090 — G2 verification and cumulative regression | 4 | `test/p2-mathew-g2-verification` |
| P2-MAT-099 — Protected defect/retest reserve | 2 | `fix/p2-mathew-bug-001` |

### P2-MAT-001 — Clinical records, scheduling and physician reminders

**Allocated time:** 5 hours (implementation / QA preparation). **Branch:** `feature/p2-mathew-clinical-lifecycle` → `dev`.

**Inputs and integration handoffs:** P2-JOS-001, P2-DEV-001. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Complete assigned notes/consent/guardian/retention/export/deletion and immutable signed recommendations.
2. Complete cross-clinic leave/reschedule/late-payment lifecycle with Josin.
3. Implement physician-authored dose/unit/timing/timezone/refill schedules; no AI-authored dose changes.
4. Version jobs and suppress after edit/end/revocation/missed deadline according to approved policy.
5. C03 — Capture versioned required sign-up/privacy consent without bundling marketing opt-in; record and enforce required consultation identity/consent before private video/clinical access. Before personalized medical recommendation, follow physician-approved minimal intake including age/current medication and pregnancy/child/red-flag routing; unknown or declined required information uses approved clarification/handoff. Do not impose clinical intake on ordinary public catalogue browsing or infer a diagnosis. Verify configured transport and at-rest protection for clinical database/private objects/backups and approved processor flows using actual configuration/provider evidence; no plaintext secret/health-content evidence dump. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.
6. C04 — Authorized front desk creates an in-clinic outpatient appointment in the same canonical booking lifecycle with source/staff actor and correct clinic fee/payment/refund state; use the same global doctor overlap constraints. It cannot be confused with a walk-in product order. Assigned physicians see policy-permitted past purchases in the linked patient view; unassigned/revoked/cross-patient/clinic access remains denied. Doctor management also includes approved qualifications/photo, slot length and online/in-clinic/both availability settings; front-desk operational readiness is demonstrated before public launch. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Physician-approved clinical APIs and scheduling/reminder negative tests.

**Required review:** Devadathan; physician approval where clinical. No self-approval of critical changes.

**Handoff:** Publish reviewed contracts/role and safety rules to Devadathan, Josin, Paul and Denzil; give approved fixtures/negative cases and read-only evidence helpers to Tinu. Request physician approval where clinical.

**Traceability:** P2-E1-001, P2-E1-002, P2-E1-003. Requirements: R03, R09, R10, R11, R12, R13, R14, R15, R18, R19, R32, R36. Outputs: P2-O02, P2-O03, P2-O06.

<details>
<summary>Retained technical specification: P2-E1-001 — Complete clinical records, assignment, consent and recommendations</summary>

Complete physician workspace services for assigned consultations, permitted history and consented chat summaries; version notes and signed recommendations with author/time/reason. Implement consult-to-cart against valid matching patient/product/recommendation scope; never let model text alter prescribed dosage. Complete guardian/consent, access/export/deletion-versus-retention rules approved by the company. Use transaction-local RLS and audited sensitive access with scoped doctor/front-desk/finance/warehouse views. Review clarification C03: Capture versioned required sign-up/privacy consent without bundling marketing opt-in; record and enforce required consultation identity/consent before private video/clinical access. Before personalized medical recommendation, follow physician-approved minimal intake including age/current medication and pregnancy/child/red-flag routing; unknown or declined required information uses approved clarification/handoff. Do not impose clinical intake on ordinary public catalogue browsing or infer a diagnosis. Verify configured transport and at-rest protection for clinical database/private objects/backups and approved processor flows using actual configuration/provider evidence; no plaintext secret/health-content evidence dump. Review clarification C04: Authorized front desk creates an in-clinic outpatient appointment in the same canonical booking lifecycle with source/staff actor and correct clinic fee/payment/refund state; use the same global doctor overlap constraints. It cannot be confused with a walk-in product order. Assigned physicians see policy-permitted past purchases in the linked patient view; unassigned/revoked/cross-patient/clinic access remains denied. Doctor management also includes approved qualifications/photo, slot length and online/in-clinic/both availability settings; front-desk operational readiness is demonstrated before public launch.

**Acceptance inherited:** Unassigned/revoked doctors cannot read records; signed consult-only authorization cannot be reused by another patient or expired recommendation; retained records and account access are handled according to the approved policy.

**Evidence inherited:** Clinical CRUD/version/signature tests, role/clinic/patient matrix, consent/guardian/export/deletion cases and physician UAT.

</details>

<details>
<summary>Retained technical specification: P2-E1-002 — Complete scheduling lifecycle and multiclinic operational controls</summary>

Complete per-location hours/fees/leave and online/in-clinic booking, reschedule, cancellation/refund obligations and notifications. Recheck interval exclusion, buffers, explicit stale holds and concurrent doctor changes. Finish two-clinic staff scope, appointment/report filters and stock-transfer coordination with Josin. Expose booking-scoped room credentials with patient/doctor identity, join window, expiry and revocation. Apply safe late-payment rebook/refund behavior across web/native/WhatsApp. Review clarification C04: Authorized front desk creates an in-clinic outpatient appointment in the same canonical booking lifecycle with source/staff actor and correct clinic fee/payment/refund state; use the same global doctor overlap constraints. It cannot be confused with a walk-in product order. Assigned physicians see policy-permitted past purchases in the linked patient view; unassigned/revoked/cross-patient/clinic access remains denied. Doctor management also includes approved qualifications/photo, slot length and online/in-clinic/both availability settings; front-desk operational readiness is demonstrated before public launch.

**Acceptance inherited:** All booking transitions remain consistent across clinics/channels; no active overlap or unauthorized room join; refunded/cancelled state reaches jobs and UI.

**Evidence inherited:** Leave/reschedule/cross-clinic concurrency, cancellation/refund, expired token and cross-channel state reconciliation.

</details>

<details>
<summary>Retained technical specification: P2-E1-003 — Implement physician-authored medicine/refill schedules</summary>

Implement structured dose/unit/timing and before/after-food instructions, start/end/timezone, consent and schedule versioning. Calculate refill due dates only from approved schedule/quantity or a confirmed customer interval; distinguish refill from provider mandate billing. Emit due jobs atomically; editing/cancelling invalidates stale jobs. Define missed-deadline suppression/escalation and customer visibility; support morning/evening and applicable schedule patterns without model-invented instructions.

**Acceptance inherited:** Schedule edits/cancellations stop obsolete notices; timing/quantity/consent is traceable to physician/customer confirmation and correct timezone.

**Evidence inherited:** Boundary/timezone/unit/quantity, stale-version, consent revocation, missed-deadline and subscription-versus-refill tests.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P2-MAT-002 — Complete multilingual safe assistant and typed actions

**Allocated time:** 5 hours (implementation / QA preparation). **Branch:** `feature/p2-mathew-safe-rag-tools` → `dev`.

**Inputs and integration handoffs:** P2-MAT-001, P2-DEN-003. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Complete approved retrieval, current primary checks, safety blocks, citations and safe additional-language/Romanized fallback.
2. Implement explicit typed confirmations bound to actor/current state/amount/slot and one-use expiry.
3. Complete urgent/consult-only/injection handling, human routing and no-sales escalation.
4. Run approved 120 EN/ML/TA plus 40 additional-language/Romanized evaluation cases with Tinu.
5. C01 — Reconcile every published catalogue product to its physician-approved monograph/dosage/contraindication and required EN/ML/TA safety translations. No published product is an unexplained coverage gap. G1 records the complete inventory/gap register and an approved sample; G2 closes required product coverage and demonstrates approved edit/withdrawal propagation within a company-agreed measured freshness deadline. The illustrative morning-to-afternoon statement is not an invented numeric provider SLA. Include approved public physician profiles and the required knowledge types; approval is not satisfied by catalogue text alone. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.
6. C02 — Record privacy-minimized answer-to-approved-entry/version attribution, not raw health prompts in general analytics. Content reviewers can view most-used entry/version counts with date filters and freshness labels. Define whether counts represent used answer entries or retrieval hits; count retries once by stable answer/event identity and reconcile known fixtures. Unauthorized roles cannot access the content report. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.
7. C03 — Capture versioned required sign-up/privacy consent without bundling marketing opt-in; record and enforce required consultation identity/consent before private video/clinical access. Before personalized medical recommendation, follow physician-approved minimal intake including age/current medication and pregnancy/child/red-flag routing; unknown or declined required information uses approved clarification/handoff. Do not impose clinical intake on ordinary public catalogue browsing or infer a diagnosis. Verify configured transport and at-rest protection for clinical database/private objects/backups and approved processor flows using actual configuration/provider evidence; no plaintext secret/health-content evidence dump. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.
8. C07 — Hand over a dated maintenance calendar: daily reconciliation; weekly access/job/backup/capacity/security checks; monthly physician review of flagged conversations and knowledge changes; quarterly operating/performance report. Name primary/backup owners, priority-fix/security/app-release workflow, and the proposal’s up-to-eight-hours-per-month knowledge-maintenance allowance with an agreed overflow/response process. These are support obligations/operating labor, not extra sprint capacity, new subscription pricing, or automatically created reminders. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Versioned evaluation results and no critical safety/access failures.

**Required review:** Devadathan; physician approval where clinical. No self-approval of critical changes.

**Handoff:** Publish reviewed contracts/role and safety rules to Devadathan, Josin, Paul and Denzil; give approved fixtures/negative cases and read-only evidence helpers to Tinu. Request physician approval where clinical.

**Traceability:** P2-E5-001, P2-E5-004. Requirements: R01, R14, R16, R17, R18, R19, R20, R22, R23, R27, R29, R35, R36, R37, R38. Outputs: P2-O03, P2-O05, P2-O06, P2-O07.

<details>
<summary>Retained technical specification: P2-E5-001 — Complete safe multilingual RAG and authorized conversational actions</summary>

Complete structured KB approval/version/withdrawal and exact/keyword/vector routing. Enforce current primary approval and independent mandatory safety retrieval before rendering medical blocks; keep unsupported language/content on approved fallback. Complete permitted product/order/refill/availability/cart/booking/payment proposals with typed schemas, current authorization and explicit customer confirmation. Test urgent/consult-only/no-cure-claim behavior, source citations, native-script/Romanized variations, prompt injection and concurrency/timeout/budget boundaries. Review clarification C01: Reconcile every published catalogue product to its physician-approved monograph/dosage/contraindication and required EN/ML/TA safety translations. No published product is an unexplained coverage gap. G1 records the complete inventory/gap register and an approved sample; G2 closes required product coverage and demonstrates approved edit/withdrawal propagation within a company-agreed measured freshness deadline. The illustrative morning-to-afternoon statement is not an invented numeric provider SLA. Include approved public physician profiles and the required knowledge types; approval is not satisfied by catalogue text alone. Review clarification C03: Capture versioned required sign-up/privacy consent without bundling marketing opt-in; record and enforce required consultation identity/consent before private video/clinical access. Before personalized medical recommendation, follow physician-approved minimal intake including age/current medication and pregnancy/child/red-flag routing; unknown or declined required information uses approved clarification/handoff. Do not impose clinical intake on ordinary public catalogue browsing or infer a diagnosis. Verify configured transport and at-rest protection for clinical database/private objects/backups and approved processor flows using actual configuration/provider evidence; no plaintext secret/health-content evidence dump.

**Acceptance inherited:** Every supported clinical display traces to approved content and no model output directly changes stock, money, dosage, identity or unrestricted records.

**Evidence inherited:** Full 120+40 approved evaluation, tool/confirmation negatives, stale-index/revocation, model-saturation and red-flag results.

</details>

<details>
<summary>Retained technical specification: P2-E5-004 — Complete conversion/report events, evaluation evidence and support drafts</summary>

Implement deduplicated conversation-to-cart/order/booking/handoff and consultation-to-order event attribution without health-text leakage. Rebuild/reconcile summaries from durable facts, including retries/refunds/opt-outs. Execute and review the full clinical/language set, triage unsupported cases and finalize approved fallback. Draft content-review, human support, message-failure, queue-replay and AI-saturation procedures; collect actual model/message/voice usage for the budget dashboard. Review clarification C02: Record privacy-minimized answer-to-approved-entry/version attribution, not raw health prompts in general analytics. Content reviewers can view most-used entry/version counts with date filters and freshness labels. Define whether counts represent used answer entries or retrieval hits; count retries once by stable answer/event identity and reconcile known fixtures. Unauthorized roles cannot access the content report.

**Acceptance inherited:** Metrics match source fixtures, the complete evaluation passes required gates and the support/clinical review evidence is ready for Phase 3.

**Evidence inherited:** Known-total event/report tests, evaluation manifest/results, usage ledger and draft support/clinical-content runbooks.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P2-MAT-003 — WhatsApp, voice and staff handoff backend

**Allocated time:** 3 hours (implementation / QA preparation). **Branch:** `feature/p2-mathew-whatsapp-handoff` → `dev`.

**Inputs and integration handoffs:** P2-MAT-002, P2-DEV-002. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Finish actual clinic-number text/voice/account-link/secure checkout integration.
2. Require authenticated proof rather than phone-number matching alone.
3. Handle bot/agent race, callbacks, after-hours ownership and minimum-necessary summaries.
4. Validate media expiry/bounds and require editable transcript confirmation.

**Deliver and verify:** Provider test references and end-to-end authenticated channel/handoff evidence.

**Required review:** Devadathan; physician approval where clinical. No self-approval of critical changes.

**Handoff:** Publish reviewed contracts/role and safety rules to Devadathan, Josin, Paul and Denzil; give approved fixtures/negative cases and read-only evidence helpers to Tinu. Request physician approval where clinical.

**Traceability:** P2-E5-003. Requirements: R18, R20, R21, R24. Outputs: P2-O03.

<details>
<summary>Retained technical specification: P2-E5-003 — Complete WhatsApp, human support and bounded voice workflows</summary>

Complete real clinic-number text/voice ingestion, verified account linking, owner-scoped order lookup, booking and secure provider checkout links. Implement staff replies, assignment, live handoff/summary, assistant pause, after-hours acknowledgment/callback and unanswered-question resolution queue. Handle webhook duplicates/out-of-order events, media size/expiry, transcription review and channel expiry. Consent/scoping applies to shared summaries; phone matching or payment links never grant unrestricted patient access.

**Acceptance inherited:** An actual provider test conversation completes the supported action and human takeover across the console; duplicate events cannot create competing bot/agent replies or unauthorized data disclosure.

**Evidence inherited:** WhatsApp provider text/voice/link flow, takeover race, account-link replay, callback-after-hours and unknown-delivery tests.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P2-MAT-004 — Reliable financial/clinical/engagement handlers

**Allocated time:** 2 hours (implementation / QA preparation). **Branch:** `feature/p2-mathew-engagement-job-handlers` → `dev`.

**Inputs and integration handoffs:** P2-JOS-004, P2-DEV-003, P2-DEN-002. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Finish durable handlers for reminders, campaign/abandoned-cart suppression and notification state.
2. Enforce consent, quiet hours, current version/deadline and deduplication.
3. Protect financial/clinical progress from marketing backlog; reconcile unknown provider results.
4. Coordinate transport/lease/DLQ configuration with Devadathan and domain facts with Josin.
5. C02 — Record privacy-minimized answer-to-approved-entry/version attribution, not raw health prompts in general analytics. Content reviewers can view most-used entry/version counts with date filters and freshness labels. Define whether counts represent used answer entries or retrieval hits; count retries once by stable answer/event identity and reconcile known fixtures. Unauthorized roles cannot access the content report. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.
6. C05 — After the finance-approved issuance milestone, create a durable idempotent invoice-ready delivery obligation and send the customer an approved private/scoped invoice link or document through the permitted transactional channel. Generated PDF alone is not delivery evidence. Verify receipt, one effective delivery/reconciliation, retries, expiry/ownership and customer history; no public invoice URL or marketing-consent shortcut. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.
7. C06 — Demonstrate all three approved campaign types: new product, restock and seasonal offer. Build consented prior-purchase segments from authorized commerce facts, with preview/counts, quotas, quiet hours, current opt-out and deduplicated attribution. No raw clinical notes or inferred health-interest audience without explicit business/privacy approval; live sending uses company-controlled approved recipients. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.
8. C08 — Measure healthy-state due-to-claim pickup p95 below two minutes with agreed server timestamps/sample size while preserving current consent/version/deadline suppression. During fault/backlog tests separately measure deadline recovery and alerts. Configure a defined 30-day core-availability SLI/dashboard and 99.9% internal objective, exclusions and owner; ten-day prelaunch tests cannot prove achieved monthly availability and do not imply a paid vendor SLA or 24-hour clinician staffing. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Queue-priority/retry/suppression fixtures and reconciled delivery attribution.

**Required review:** Devadathan; physician approval where clinical. No self-approval of critical changes.

**Handoff:** Publish reviewed contracts/role and safety rules to Devadathan, Josin, Paul and Denzil; give approved fixtures/negative cases and read-only evidence helpers to Tinu. Request physician approval where clinical.

**Traceability:** P2-E5-002, P2-E6-002. Requirements: R07, R08, R09, R10, R12, R16, R27, R28, R29, R35, R36, R38. Outputs: P2-O01, P2-O02, P2-O03, P2-O05, P2-O06.

<details>
<summary>Retained technical specification: P2-E5-002 — Complete messages, schedules, campaigns and suppression rules</summary>

Finish confirmation/dispatch/out-for-delivery/delivery notices with tracking links, appointment and prescription/refill schedules, recurring subscription events and channel delivery state. Complete opted-in segments, campaign template scheduling/results/attribution, quiet hours/opt-out and first seasonal campaign. Implement abandoned-cart delay, unique notice, scoped expiring recovery link and purchase/cancel/unsubscribe suppression. Recheck schedule/version/consent at execution; distinguish critical deadlines from throttled marketing. Review clarification C05: After the finance-approved issuance milestone, create a durable idempotent invoice-ready delivery obligation and send the customer an approved private/scoped invoice link or document through the permitted transactional channel. Generated PDF alone is not delivery evidence. Verify receipt, one effective delivery/reconciliation, retries, expiry/ownership and customer history; no public invoice URL or marketing-consent shortcut. Review clarification C06: Demonstrate all three approved campaign types: new product, restock and seasonal offer. Build consented prior-purchase segments from authorized commerce facts, with preview/counts, quotas, quiet hours, current opt-out and deduplicated attribution. No raw clinical notes or inferred health-interest audience without explicit business/privacy approval; live sending uses company-controlled approved recipients.

**Acceptance inherited:** Real business events drive the required channels with deduplication; edits/purchases/opt-outs invalidate stale notices and unknown provider outcomes are reconciled.

**Evidence inherited:** Notification/template provider tests, timezone/consent/deadline/version cases, campaign priority and cart-after-purchase suppression.

</details>

<details>
<summary>Retained technical specification: P2-E6-002 — Complete queue priorities, observability, cost and failure drills</summary>

Tune separate financial/clinical/engagement concurrency, outbox leases, retry/deadline/DLQ handling and unknown-provider reconciliation. Add metrics/alerts for errors, CPU/cache/pool/locks, job age/deadlines, invariant failures, vendor spend and clinical/human escalation. Verify marketing backlog cannot monopolize important work. Execute crash/reclaim/duplicate/timeout/saturation tests; keep logs/payloads scrubbed and provider load isolated. Review clarification C08: Measure healthy-state due-to-claim pickup p95 below two minutes with agreed server timestamps/sample size while preserving current consent/version/deadline suppression. During fault/backlog tests separately measure deadline recovery and alerts. Configure a defined 30-day core-availability SLI/dashboard and 99.9% internal objective, exclusions and owner; ten-day prelaunch tests cannot prove achieved monthly availability and do not imply a paid vendor SLA or 24-hour clinician staffing.

**Acceptance inherited:** The full app has usable alert/reconciliation dashboards, cost visibility and durable bounded work under failure.

**Evidence inherited:** Failure/replay traces, priority/backlog results, alert receipt/redaction checks and usage/cost forecast.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P2-MAT-005 — Complete authorization and financial/clinical peer review

**Allocated time:** 3 hours (implementation / QA preparation). **Branch:** `feature/p2-mathew-critical-review-rls` → `dev`.

**Inputs and integration handoffs:** P2-JOS-002, P2-JOS-003, P2-DEV-003. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Review every role/tool/clinic/patient route and pooled RLS context.
2. Review subscription mandates, credits, stock transfers/recall, refunds and recommendation checks with Josin.
3. Review native/platform security changes by Devadathan.
4. Close critical findings with independently reproduced regression evidence.

**Deliver and verify:** Signed critical review index and full authorization matrix.

**Required review:** Devadathan; physician approval where clinical. No self-approval of critical changes.

**Handoff:** Publish reviewed contracts/role and safety rules to Devadathan, Josin, Paul and Denzil; give approved fixtures/negative cases and read-only evidence helpers to Tinu. Request physician approval where clinical.

**Traceability:** P2-E1-004, P2-E6-001, P2-E2-002, P2-E2-003. Requirements: R01, R02, R03, R05, R07, R09, R10, R12, R14, R15, R18, R19, R25, R26, R31, R33, R36, R38. Outputs: P2-O01, P2-O05, P2-O06, P2-O07.

<details>
<summary>Retained technical specification: P2-E1-004 — Complete domain authorization and independent clinical/commerce review</summary>

Review high-risk commerce/refund/credit/booking/clinical changes and every newly reachable privileged route. Close permission/RLS gaps for wholesale, loyalty, campaigns, reports, files and assistant tools. Verify service roles cannot bypass row scope accidentally and editor approval remains separated. Coordinate company clinical/privacy/finance decisions and record acceptance blockers. Review all contract changes for web/native/event consumers; assemble the domain sign-off before G2.

**Acceptance inherited:** No uncovered critical route or role path remains; independent review findings are fixed and all Phase 2 R IDs have accountable evidence.

**Evidence inherited:** Updated route/role inventory, reviewed critical PRs, pooled context negatives and company decision register.

</details>

<details>
<summary>Retained technical specification: P2-E6-001 — Complete quality pipeline and full-scope security inventory</summary>

Extend CI critical business, web/mobile contract, code/dependency/secret/config and migration checks to the complete app. Maintain route/tool/role/record inventory and authenticated test accounts; configure staged dynamic review and manual access/business-logic tests. Trace each feature and external dependency to an R ID; collect reproducible build/schema/model/KB evidence and independently review critical security fixes. No scan result alone certifies safety.

**Acceptance inherited:** Every reachable critical route/tool has positive and negative coverage, scan findings are triaged and evidence points to the integrated candidate.

**Evidence inherited:** Route/test coverage register, authenticated dynamic/code scan reports, reviewed fixes and exact build manifests.

</details>

<details>
<summary>Retained technical specification: P2-E2-002 — Complete recurring mandates, renewal orders and failure recovery</summary>

Implement provider-confirmed enrollment, mandate/payment references, renewal events, exactly one business renewal order, stock allocation, amount/tax policy and notices. Support failed payment, stock shortage, pause/resume/cancel and provider reconciliation; customer UI and staff state must agree. Accelerate a sandbox cycle without pretending it proves live eligibility. Do not represent an app calendar reminder as automatic recurring debit or repeat a mandate charge after an ambiguous response.

**Acceptance inherited:** Enrollment/renewal/failure/cancellation and duplicate/out-of-order events produce one authorized order/financial effect and correct subsequent schedules.

**Evidence inherited:** Sandbox cycle and available minimal live eligibility evidence, renewal shortage/duplicate tests, pause/cancel suppression and ledger reconciliation.

</details>

<details>
<summary>Retained technical specification: P2-E2-003 — Complete bundles, wholesale, loyalty and referral financial rules</summary>

Adapt tested bundle/course discount allocation, distributor approval/price-list/MOQ/pack/payment-term rules and loyalty/referral ledgers. Enforce the same price/eligibility/tax/consult-only checks across channels. Implement credit source references, earning/redemption caps, eligible first-order awards, self-referral/basic abuse checks and refund/return reversals. Preserve audit of account approvals and commercial terms; clients cannot choose a distributor role or create credit.

**Acceptance inherited:** Bundle totals and tax allocations are stable, unauthorized wholesale terms fail, and credits cannot be duplicated or retained after a reversing event.

**Evidence inherited:** Retail/distributor/MOQ/terms tests, bundle stock/clinical restrictions, self-abuse/duplicate/refund credit scenarios and ledger totals.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P2-MAT-090 — G2 verification and cumulative regression

**Allocated time:** 4 hours (verification). **Branch:** `test/p2-mathew-g2-verification` → `dev`.

Merge necessary test-code changes before freeze; run results belong in the evidence store. Do not invalidate the frozen candidate with an evidence-only application change.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Run scoped identity/RLS/clinical/booking/tool/AI negatives, review authenticated security findings, execute physician-approved cases and interpret domain behavior under failure/load. Support advanced recovery and repeat critical fixes independently of their author.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; physician approval where clinical. No self-approval of critical changes.

**Handoff:** Publish reviewed contracts/role and safety rules to Devadathan, Josin, Paul and Denzil; give approved fixtures/negative cases and read-only evidence helpers to Tinu. Request physician approval where clinical.

**Traceability:** P2-E1-090, P2-E5-090. Requirements: R08, R10, R11, R12, R14, R15, R16, R17, R18, R19, R20, R21, R22, R23, R24, R27, R29, R32, R35, R36. Outputs: P2-O07.

### P2-MAT-099 — Protected defect/retest reserve

**Allocated time:** 2 hours (conditional reserve). **Branch:** `fix/p2-mathew-bug-001` → `dev`.

Create this branch only if a matching defect actually exists; the suffix shown is an example. Test execution alone does not require a code branch.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Use only against an actual tracked defect; replace bug-001 with the real issue ID. Reproduce, contain and route to the correct owner; independently retest a reviewed fix on a new candidate. Tinu uses this for triage/retesting, not critical feature coding. Paul/Denzil fix only bounded UI/content defects. If unused, broaden verification/handover; do not add scope or count the reserve as guaranteed repair capacity.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; physician approval where clinical. No self-approval of critical changes.

**Handoff:** Publish reviewed contracts/role and safety rules to Devadathan, Josin, Paul and Denzil; give approved fixtures/negative cases and read-only evidence helpers to Tinu. Request physician approval where clinical.

**Traceability:** P2-E1-099, P2-E5-099. Requirements: R36, R38. Outputs: P2-O07.

### Phase 2 personal handoff and gate checklist

- All assigned packages have reviewed PRs or explicit blocked/conditional status; no direct shared-branch changes.
- APIs/components/content/fixtures are handed to the named dependent owner with examples and known limits.
- Tests include positive, negative, authorization/current-state, retry/failure and relevant persisted-state checks.
- Tinu has exact candidate metadata, requirement/output links, screenshots/request IDs, defects and independent retest references.
- Domain/company reviewers have approved medical/finance/content expectations where needed.
- No unresolved blocker is hidden by a UI workaround, disabled feature, mock provider or skipped test.
- Promotion waits for G1/G2 Pass or the Phase 3 prelaunch Go; Devadathan handles the reviewed merge to `main`. Final G3 closure and `v1.0.0` follow successful postdeployment checks.

## Phase 3: Production verification, acceptance and launch

**Window:** Days 7–10 · 27–30 October 2026. **Capacity:** 32 hours; implementation/QA preparation 7, verification 12, environment/handover 6, reserve 7.

This is a capacity ceiling for adapting proven components and completing the allocated scope, including review within the relevant package. It is not a measured greenfield estimate. Escalate missing reuse and review overload on Day 1; do not consume protected test time to hide it.

**Sequence and handoff checkpoints**

- D7: verify paid-candidate RLS/clinical/AI behavior and urgent/tool negatives; review complete app-build compatibility.
- D8: lead specialist access/AI tests, concurrent domain interpretation and timed recovery reconciliation with Devadathan/Josin.
- D9: repeat critical AI cases, close reviewed fixes, lead physician UAT/training and review final evidence.
- D10: technical Go/No-go with Devadathan/company; controlled clinical/channel smoke and handover if approved.

The checkpoints order work; they do not add hours beyond the phase budget. G1/G2 verification must include the protected four-hour final-half-day allocation. Phase 3 specialist campaigns may run in parallel, with a named operator and safe provider controls.

**Daily capacity aligned to the phase plan**

| Working day | B: implementation / QA prep | V: verification | E: environment / handover | C: reserve | Total |
|---|---:|---:|---:|---:|---:|
| Day 7 | 3 | 4 | 0 | 1 | 8 |
| Day 8 | 2 | 4 | 0 | 2 | 8 |
| Day 9 | 2 | 3 | 2 | 1 | 8 |
| Day 10 | 0 | 1 | 4 | 3 | 8 |

B/V/E/C are daily capacity slices, not new tasks. Review/meetings count within these hours. Follow this member’s package sequence and handoff contracts; do not double-book tasks. Reserve is conditional and otherwise supports verification/handover. Background test runtime is not extra staffed capacity; record actual operator/reviewer time.

**Named test execution/support groups:** P3-T01, P3-T02, P3-T03, P3-T04, P3-T05, P3-T07, P3-T08, P3-T09, P3-T10, P3-T11, P3-T12, P3-T13, P3-T15, P3-T17, P3-T18, P3-T19, P3-T20, P3-T22, P3-T23, P3-T24, P3-T25, P3-T26, P3-T27, P3-T29, P3-T30. The detailed procedures are in Tinu’s annex. These are minimum named duties; also help with impacted cumulative regression and the shared gate. Tinu coordinates execution rather than replacing the listed specialist/domain operator.

**Entry and dependencies:** G2 complete-feature candidate and paid readiness must pass first. Use production-equivalent paid settings, pinned artifacts and realistic synthetic retained data. Every relevant code/config/model/KB change invalidates affected evidence.

| Package | Hours | Branch from `dev`; PR to `dev` |
|---|---:|---|
| P3-MAT-001 — Fix verified clinical/access/AI findings | 4 | `feature/p3-mathew-clinical-ai-hardening` |
| P3-MAT-002 — Cross-domain transaction and channel hardening | 3 | `feature/p3-mathew-transaction-channel-hardening` |
| P3-MAT-090 — G3 verification and cumulative regression | 12 | `test/p3-mathew-g3-verification` |
| P3-MAT-080 — Environment, acceptance and handover support | 6 | `chore/p3-mathew-readiness-handover` |
| P3-MAT-099 — Protected defect/retest reserve | 7 | `fix/p3-mathew-bug-001` |

### P3-MAT-001 — Fix verified clinical/access/AI findings

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p3-mathew-clinical-ai-hardening` → `dev`.

**Inputs and integration handoffs:** P3-DEV-001. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Resolve only observed candidate defects in RLS/clinical/booking/AI/tool safety.
2. Preserve physician-approved content/version contracts and current-state confirmation.
3. Repeat all critical AI cases three times on frozen versions with Tinu.
4. Obtain independent senior review and physician confirmation for medical behavior changes.
5. C01 — Reconcile every published catalogue product to its physician-approved monograph/dosage/contraindication and required EN/ML/TA safety translations. No published product is an unexplained coverage gap. G1 records the complete inventory/gap register and an approved sample; G2 closes required product coverage and demonstrates approved edit/withdrawal propagation within a company-agreed measured freshness deadline. The illustrative morning-to-afternoon statement is not an invented numeric provider SLA. Include approved public physician profiles and the required knowledge types; approval is not satisfied by catalogue text alone. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.
6. C03 — Capture versioned required sign-up/privacy consent without bundling marketing opt-in; record and enforce required consultation identity/consent before private video/clinical access. Before personalized medical recommendation, follow physician-approved minimal intake including age/current medication and pregnancy/child/red-flag routing; unknown or declined required information uses approved clarification/handoff. Do not impose clinical intake on ordinary public catalogue browsing or infer a diagnosis. Verify configured transport and at-rest protection for clinical database/private objects/backups and approved processor flows using actual configuration/provider evidence; no plaintext secret/health-content evidence dump. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.
7. C04 — Authorized front desk creates an in-clinic outpatient appointment in the same canonical booking lifecycle with source/staff actor and correct clinic fee/payment/refund state; use the same global doctor overlap constraints. It cannot be confused with a walk-in product order. Assigned physicians see policy-permitted past purchases in the linked patient view; unassigned/revoked/cross-patient/clinic access remains denied. Doctor management also includes approved qualifications/photo, slot length and online/in-clinic/both availability settings; front-desk operational readiness is demonstrated before public launch. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Reviewed fixes with targeted and cumulative safety/access evidence.

**Required review:** Devadathan; physician approval where clinical. No self-approval of critical changes.

**Handoff:** Publish reviewed contracts/role and safety rules to Devadathan, Josin, Paul and Denzil; give approved fixtures/negative cases and read-only evidence helpers to Tinu. Request physician approval where clinical.

**Traceability:** P3-E1-001, P3-E5-001. Requirements: R01, R03, R10, R11, R12, R14, R15, R16, R17, R18, R19, R20, R22, R23, R24, R32, R36. Outputs: P3-O01, P3-O02, P3-O03.

<details>
<summary>Retained technical specification: P3-E1-001 — Harden access, clinical and booking behavior on the paid candidate</summary>

Review the production runtime roles, transaction-local RLS context, staff-organization MFA, revoked sessions, assignment and consent boundaries. Check interval exclusion/hold expiry and clinical/recommendation versions on the actual paid endpoint. Close proven configuration/logic defects with independent review; update error/timeout behavior and cross-channel contracts only where necessary. No new required feature is deferred into this task.

**Acceptance inherited:** The paid candidate retains the same validated authorization/clinical invariants; all changes identify affected regression/evaluation.

**Evidence inherited:** Reviewed diffs, production-equivalent policy/role tests and exact candidate manifest.

</details>

<details>
<summary>Retained technical specification: P3-E5-001 — Harden clinical safety, tool authorization and human routing</summary>

Recheck primary approval/withdrawal, mandatory safety blocks, exact/vector aliases, additional-language fallback, Romanized/voice ambiguity and urgent/consult-only behavior. Challenge prompt injection, cross-account tools, confirmation replay, human takeover and saturation. Fix demonstrated defects with physician review and rerun affected critical cases; no generated clinical wording or cheaper fallback bypasses the approved policy.

**Acceptance inherited:** The final versioned candidate passes every critical clinical/access case and medical blocks trace to current approved versions.

**Evidence inherited:** Repeatable 120+40 evaluation, changed-case retest, tool/takeover/urgent negatives and physician approval.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P3-MAT-002 — Cross-domain transaction and channel hardening

**Allocated time:** 3 hours (implementation / QA preparation). **Branch:** `feature/p3-mathew-transaction-channel-hardening` → `dev`.

**Inputs and integration handoffs:** P3-JOS-002, P3-DEV-001. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Review last-unit/booking/uncertain COMMIT/provider reconciliation with Josin.
2. Fix privileged handoff/voice/WhatsApp/reminder handler defects and suppression gaps.
3. Verify bounded AI failure leaves checkout/booking usable.
4. Help Devadathan with specialist security/load/recovery interpretation.
5. C06 — Demonstrate all three approved campaign types: new product, restock and seasonal offer. Build consented prior-purchase segments from authorized commerce facts, with preview/counts, quotas, quiet hours, current opt-out and deduplicated attribution. No raw clinical notes or inferred health-interest audience without explicit business/privacy approval; live sending uses company-controlled approved recipients. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** No duplicate financial/clinical effects and reconciled privileged channel behavior.

**Required review:** Devadathan; physician approval where clinical. No self-approval of critical changes.

**Handoff:** Publish reviewed contracts/role and safety rules to Devadathan, Josin, Paul and Denzil; give approved fixtures/negative cases and read-only evidence helpers to Tinu. Request physician approval where clinical.

**Traceability:** P3-E1-002, P3-E5-002. Requirements: R02, R05, R07, R08, R09, R10, R12, R15, R18, R20, R21, R27, R28, R29, R35, R36, R38. Outputs: P3-O02, P3-O03, P3-O04, P3-O05.

<details>
<summary>Retained technical specification: P3-E1-002 — Review concurrency, resilience and release correctness across domains</summary>

Inspect stock/payment/booking/credit locks, transaction boundaries, uncertain commit handling and pool/lock timeouts under load. Verify retry/idempotency and restored access controls; challenge negative security/clinical tests and review blocker fixes from other owners. Approve measured sizing changes and schema-compatible rollback; record technical risks and readiness rather than inferring readiness from test counts.

**Acceptance inherited:** Independent review finds no unresolved critical invariant or access gap and any changed component has valid retest evidence.

**Evidence inherited:** Cross-domain review notes, failure/control totals, retest map and technical gate recommendation.

</details>

<details>
<summary>Retained technical specification: P3-E5-002 — Verify messaging reliability, attribution and channel readiness</summary>

Inspect signed inbound events, account linking, secure payment/video links, delivery callbacks, agent ownership and stale reply suppression. Exercise duplicates, timeout/unknown delivery, expired media, consent revocation, missed clinical deadlines and campaign backlog. Reconcile conversion metrics and message/model/audio usage. Confirm required templates/senders and clinic number are live with company owners; do not send bulk campaigns as a load test.

**Acceptance inherited:** The required channel work remains durable/consented, important jobs are not starved and actual live readiness is documented.

**Evidence inherited:** Channel/provider references, replay/suppression/deadline traces, attribution totals and actual usage forecast.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P3-MAT-090 — G3 verification and cumulative regression

**Allocated time:** 12 hours (verification). **Branch:** `test/p3-mathew-g3-verification` → `dev`.

Merge necessary test-code changes before freeze; run results belong in the evidence store. Do not invalidate the frozen candidate with an evidence-only application change.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Run scoped identity/RLS/clinical/booking/tool/AI negatives, review authenticated security findings, execute physician-approved cases and interpret domain behavior under failure/load. Support advanced recovery and repeat critical fixes independently of their author.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; physician approval where clinical. No self-approval of critical changes.

**Handoff:** Publish reviewed contracts/role and safety rules to Devadathan, Josin, Paul and Denzil; give approved fixtures/negative cases and read-only evidence helpers to Tinu. Request physician approval where clinical.

**Traceability:** P3-E1-090, P3-E5-090. Requirements: R08, R10, R11, R12, R14, R15, R16, R17, R18, R19, R20, R21, R22, R23, R24, R27, R29, R32, R35, R36, R38. Outputs: P3-O07.

### P3-MAT-080 — Environment, acceptance and handover support

**Allocated time:** 6 hours (environment / handover). **Branch:** `chore/p3-mathew-readiness-handover` → `dev`.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Lead physician/privacy/doctor and support/AI training, content/safety approval, clinical/channel acceptance and the technical Go/No-go review. Provide incident/reconciliation ownership; assist only authorized minimal live checks.

**Integrated review C07:** Hand over a dated maintenance calendar: daily reconciliation; weekly access/job/backup/capacity/security checks; monthly physician review of flagged conversations and knowledge changes; quarterly operating/performance report. Name primary/backup owners, priority-fix/security/app-release workflow, and the proposal’s up-to-eight-hours-per-month knowledge-maintenance allowance with an agreed overflow/response process. These are support obligations/operating labor, not extra sprint capacity, new subscription pricing, or automatically created reminders.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; physician approval where clinical. No self-approval of critical changes.

**Handoff:** Publish reviewed contracts/role and safety rules to Devadathan, Josin, Paul and Denzil; give approved fixtures/negative cases and read-only evidence helpers to Tinu. Request physician approval where clinical.

**Traceability:** P3-E1-080, P3-E5-080. Requirements: R25, R36, R37, R38. Outputs: P3-O05, P3-O06, P3-O07.

### P3-MAT-099 — Protected defect/retest reserve

**Allocated time:** 7 hours (conditional reserve). **Branch:** `fix/p3-mathew-bug-001` → `dev`.

Create this branch only if a matching defect actually exists; the suffix shown is an example. Test execution alone does not require a code branch.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Use only against an actual tracked defect; replace bug-001 with the real issue ID. Reproduce, contain and route to the correct owner; independently retest a reviewed fix on a new candidate. Tinu uses this for triage/retesting, not critical feature coding. Paul/Denzil fix only bounded UI/content defects. If unused, broaden verification/handover; do not add scope or count the reserve as guaranteed repair capacity.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Devadathan; physician approval where clinical. No self-approval of critical changes.

**Handoff:** Publish reviewed contracts/role and safety rules to Devadathan, Josin, Paul and Denzil; give approved fixtures/negative cases and read-only evidence helpers to Tinu. Request physician approval where clinical.

**Traceability:** P3-E1-099, P3-E5-099. Requirements: R36, R38. Outputs: P3-O07.

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
| P1-E1-001 — Freeze domain contracts, clinical schema and access model | P1-MAT-001 |
| P1-E1-002 — Implement verified identity and scoped authorization | P1-MAT-001 |
| P1-E1-003 — Implement directory, availability and paid booking invariants | P1-MAT-002 |
| P1-E1-004 — Expose clinical/admin foundations and review core transactions | P1-MAT-002, P1-MAT-005 |
| P1-E1-090 — Clinical/access/booking cumulative verification | P1-MAT-090 |
| P1-E1-099 — Protected defect/retest contingency | P1-MAT-099 |
| P1-E2-002 — Implement authoritative cart pricing and atomic FEFO reservations | P1-MAT-005 |
| P1-E2-003 — Integrate payment creation, signed webhooks and idempotent state transitions | P1-MAT-005 |
| P1-E5-001 — Implement approved knowledge model and bounded ingestion | P1-MAT-003 |
| P1-E5-002 — Implement controlled retrieval, responses and tool boundaries | P1-MAT-003 |
| P1-E5-003 — Prove messaging/voice providers and event-consumer contracts | P1-MAT-004 |
| P1-E5-004 — Prepare evaluation pack, human-routing state and integration evidence | P1-MAT-004 |
| P1-E5-090 — Companion/channel cumulative verification | P1-MAT-090 |
| P1-E5-099 — Protected defect/retest contingency | P1-MAT-099 |
| P1-E6-002 — Build test harness, redacted observability and rollback foundation | P1-MAT-005 |
| P1-E6-003 — Implement queue platform and encrypted backup/restore smoke | P1-MAT-004 |
| P2-E1-001 — Complete clinical records, assignment, consent and recommendations | P2-MAT-001 |
| P2-E1-002 — Complete scheduling lifecycle and multiclinic operational controls | P2-MAT-001 |
| P2-E1-003 — Implement physician-authored medicine/refill schedules | P2-MAT-001 |
| P2-E1-004 — Complete domain authorization and independent clinical/commerce review | P2-MAT-005 |
| P2-E1-090 — Full clinical/access and independent transaction verification | P2-MAT-090 |
| P2-E1-099 — Protected defect/retest contingency | P2-MAT-099 |
| P2-E2-002 — Complete recurring mandates, renewal orders and failure recovery | P2-MAT-005 |
| P2-E2-003 — Complete bundles, wholesale, loyalty and referral financial rules | P2-MAT-005 |
| P2-E5-001 — Complete safe multilingual RAG and authorized conversational actions | P2-MAT-002 |
| P2-E5-002 — Complete messages, schedules, campaigns and suppression rules | P2-MAT-004 |
| P2-E5-003 — Complete WhatsApp, human support and bounded voice workflows | P2-MAT-003 |
| P2-E5-004 — Complete conversion/report events, evaluation evidence and support drafts | P2-MAT-002 |
| P2-E5-090 — Full clinical evaluation/channel/automation verification | P2-MAT-090 |
| P2-E5-099 — Protected defect/retest contingency | P2-MAT-099 |
| P2-E6-001 — Complete quality pipeline and full-scope security inventory | P2-MAT-005 |
| P2-E6-002 — Complete queue priorities, observability, cost and failure drills | P2-MAT-004 |
| P3-E1-001 — Harden access, clinical and booking behavior on the paid candidate | P3-MAT-001 |
| P3-E1-002 — Review concurrency, resilience and release correctness across domains | P3-MAT-002 |
| P3-E1-080 — Lead clinical/privacy acceptance, doctor training and technical release decision | P3-MAT-080 |
| P3-E1-090 — Final clinical/security/booking UAT and independent retest | P3-MAT-090 |
| P3-E1-099 — Protected defect/retest contingency | P3-MAT-099 |
| P3-E5-001 — Harden clinical safety, tool authorization and human routing | P3-MAT-001 |
| P3-E5-002 — Verify messaging reliability, attribution and channel readiness | P3-MAT-002 |
| P3-E5-080 — Lead support/marketing/clinical-content training and channel activation | P3-MAT-080 |
| P3-E5-090 — Final physician-reviewed AI/channel/schedule/outage verification | P3-MAT-090 |
| P3-E5-099 — Protected defect/retest contingency | P3-MAT-099 |

## Test-case handoff

Use [Tinu’s standalone detailed test cases](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) for all 86 phase groups and 38 requirement walkthroughs, shared synthetic fixtures, action/expected-result pairs and evidence rules. Execute your domain cases with Tinu; do not wait until the phase-end campaign to begin testing. Source phase specifications retain their additional matrices and acceptance criteria.

## Final personal completion record

Record package/PR, candidate/build IDs, requirement/output IDs, reviewer and domain approval, test runs/defects/retests, actual public-channel status, training/handover links and remaining approved low-risk issues. Leave unexecuted work Pending/Blocked. Final completion requires G3, all R01–R38 acceptance, public required channels and company ownership/support handover.
