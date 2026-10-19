# Kandamkulathi — Devadathan: three-phase individual implementation plan

**Issue date:** 19 October 2026. **Delivery window:** 19–30 October, ten working days. **Team:** six people. **Status:** planned work and acceptance criteria; no implementation or test results are claimed.

**Role:** Frontend/mobile and platform technical lead; release manager.

Own the shared UI architecture, sensitive session/payment/clinical client flows, native SDKs, CI/secrets, environments, deployment and recovery. Give Paul and Denzil stable components and bounded tickets. Mathew reviews your sensitive platform/client security changes.

**Boundaries:** Delegate ordinary screens/content assembly. Do not delegate signing credentials, production migrations, permission design, payment SDK setup or recovery execution to less experienced members.

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
| 1 | 17 | 4 | 1 | 2 | 24 |
| 2 | 18 | 4 | 0 | 2 | 24 |
| 3 | 8 | 10 | 7 | 7 | 32 |
| **Total** | 43 | 18 | 8 | 11 | **80** |

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

**Window:** Days 1–3 · 19–21 October 2026. **Capacity:** 24 hours; implementation/QA preparation 17, verification 4, environment/handover 1, reserve 2.

This is a capacity ceiling for adapting proven components and completing the allocated scope, including review within the relevant package. It is not a measured greenfield estimate. Escalate missing reuse and review overload on Day 1; do not consume protected test time to hide it.

**Sequence and handoff checkpoints**

- D1: company environments/CI, shared clients and real Android/iOS auth/payment/video SDK proof; flag reuse gaps immediately.
- D2: integrate sensitive client adapters, jobs/observability/recovery foundation; unblock Paul/Denzil via stable components.
- D3 morning: review Mathew’s critical PRs and complete integration/security fixes. Final four hours: G1 specialist tests and candidate gate.

The checkpoints order work; they do not add hours beyond the phase budget. G1/G2 verification must include the protected four-hour final-half-day allocation. Phase 3 specialist campaigns may run in parallel, with a named operator and safe provider controls.

**Daily capacity aligned to the phase plan**

| Working day | B: implementation / QA prep | V: verification | E: environment / handover | C: reserve | Total |
|---|---:|---:|---:|---:|---:|
| Day 1 | 7 | 0 | 1 | 0 | 8 |
| Day 2 | 8 | 0 | 0 | 0 | 8 |
| Day 3 | 2 | 4 | 0 | 2 | 8 |

B/V/E/C are daily capacity slices, not new tasks. Review/meetings count within these hours. Follow this member’s package sequence and handoff contracts; do not double-book tasks. Reserve is conditional and otherwise supports verification/handover. On the final day, schedule four V hours in the protected final half-day for everyone; Tinu also has two earlier V hours. Background test runtime is not extra staffed capacity; record actual operator/reviewer time.

**Named test execution/support groups:** P1-T01, P1-T02, P1-T06, P1-T09, P1-T10, P1-T11, P1-T14, P1-T15, P1-T16, P1-T17, P1-T18, P1-T19, P1-T20. The detailed procedures are in Tinu’s annex. These are minimum named duties; also help with impacted cumulative regression and the shared gate. Tinu coordinates execution rather than replacing the listed specialist/domain operator.

**Entry and dependencies:** Start from approved company content/rules, reusable SDK proof, company accounts and synthetic fixtures. Mathew/Josin publish contracts before parallel screens. Devadathan provides components and environment access.

| Package | Hours | Branch from `dev`; PR to `dev` |
|---|---:|---|
| P1-DEV-001 — Environment, CI, security and operations foundation | 5 | `feature/p1-devadathan-platform-foundation` |
| P1-DEV-002 — Shared frontend/mobile foundation and risky SDK proof | 5 | `feature/p1-devadathan-web-native-sdk-proof` |
| P1-DEV-003 — Sensitive session, payment and clinical client integration | 4 | `feature/p1-devadathan-sensitive-client-flows` |
| P1-DEV-004 — Cross-client quality and backend peer review | 3 | `feature/p1-devadathan-frontend-security-review` |
| P1-DEV-090 — G1 verification and cumulative regression | 4 | `test/p1-devadathan-g1-verification` |
| P1-DEV-080 — Environment, acceptance and handover support | 1 | `chore/p1-devadathan-readiness-handover` |
| P1-DEV-099 — Protected defect/retest reserve | 2 | `fix/p1-devadathan-bug-001` |

### P1-DEV-001 — Environment, CI, security and operations foundation

**Allocated time:** 5 hours (implementation / QA preparation). **Branch:** `feature/p1-devadathan-platform-foundation` → `dev`.

**Inputs and integration handoffs:** P1-MAT-001. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Create company-owned separated environments, restricted secrets, CI and branch gates.
2. Configure Workers/Hono/TypeScript/Zod, Neon/Drizzle, non-owner roles, R2, Queues and Cron.
3. Implement redacted observability, atomic outbox transport, idempotent workers, leases and encrypted backup/isolated restore smoke.
4. Provide synthetic preview resources and prevent uncontrolled migrations or live provider calls.
5. C08 — Measure healthy-state due-to-claim pickup p95 below two minutes with agreed server timestamps/sample size while preserving current consent/version/deadline suppression. During fault/backlog tests separately measure deadline recovery and alerts. Configure a defined 30-day core-availability SLI/dashboard and 99.9% internal objective, exclusions and owner; ten-day prelaunch tests cannot prove achieved monthly availability and do not imply a paid vendor SLA or 24-hour clinician staffing. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Reproducible deployment, CI checks, resource manifest, alert proof and restore/rollback smoke.

**Required review:** Mathew for sensitive changes; domain owner for behavior. No self-approval of critical changes.

**Handoff:** Publish stable components, sensitive adapters and environment/build manifests to Paul/Denzil/Tinu; send privileged changes to Mathew for independent review and integrate reviewed client PRs.

**Traceability:** P1-E6-001, P1-E6-002, P1-E6-003. Requirements: R08, R10, R36, R38. Outputs: P1-O01, P1-O02, P1-O03, P1-O08, P1-O09.

<details>
<summary>Retained technical specification: P1-E6-001 — Implement reproducible runtime/database/security configuration</summary>

Provision versioned Worker/service/database bindings and isolated development resources with restricted credentials. Configure Neon pooled runtime and direct administration endpoints, tested PostgreSQL version/extension, non-owner roles and migration execution. Implement CI type/build/critical-test/secret/dependency checks, deployment locking and synthetic seed/reset workflows. Verify no production credentials are used by preview apps and no client bundle contains secrets.

**Acceptance inherited:** The foundation deploys reproducibly with approved role/binding boundaries and actual Worker-to-Neon transaction tests.

**Evidence inherited:** CI run, environment inventory, migration/rollback smoke, TLS/role tests and artifact hashes.

</details>

<details>
<summary>Retained technical specification: P1-E6-002 — Build test harness, redacted observability and rollback foundation</summary>

Wire real PostgreSQL integration fixtures, browser journeys and a real-device evidence template. Add request/event correlation, scrubbed error logs, health checks, basic latency/error/pool metrics and an independent alert test. Configure versioned deploy/rollback and a current-schema compatibility check. Prepare controlled provider adapters and initial k6 workload without sending bulk traffic to live providers. Review clarification C08: Measure healthy-state due-to-claim pickup p95 below two minutes with agreed server timestamps/sample size while preserving current consent/version/deadline suppression. During fault/backlog tests separately measure deadline recovery and alerts. Configure a defined 30-day core-availability SLI/dashboard and 99.9% internal objective, exclusions and owner; ten-day prelaunch tests cannot prove achieved monthly availability and do not imply a paid vendor SLA or 24-hour clinician staffing.

**Acceptance inherited:** Critical journey and scan reports are generated by CI; alert receipt and prior-version rollback are demonstrated.

**Evidence inherited:** Automated report links, redaction/alert checks, rollback timing and initial load-script manifest.

</details>

<details>
<summary>Retained technical specification: P1-E6-003 — Implement queue platform and encrypted backup/restore smoke</summary>

Configure financial/clinical/engagement queue consumers, explicit retry/DLQ settings and one-minute production dispatcher contract. Implement short SKIP LOCKED/lease claim primitives without holding a transaction during publish or provider calls. Trigger duplicate/crash/reclaim/redrive cases and persist idempotent receipt evidence. Export an initial synthetic database using a restricted runner, encrypt independently, restore with roles/extensions and verify R2 manifest linkage.

**Acceptance inherited:** A claimed job survives a crash and duplicate redelivery without repeating its effect; the initial encrypted backup is recoverable.

**Evidence inherited:** Queue/lease/DLQ traces, exported manifest, decryption/restore logs and control totals.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P1-DEV-002 — Shared frontend/mobile foundation and risky SDK proof

**Allocated time:** 5 hours (implementation / QA preparation). **Branch:** `feature/p1-devadathan-web-native-sdk-proof` → `dev`.

**Inputs and integration handoffs:** P1-DEV-001, P1-MAT-001, P1-JOS-003. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Set up Astro/React public, React/Vite workspaces and Expo/React Native with shared contracts/locales.
2. Prove real Android/iOS auth return, provider payment return and private web/native video on Day 1.
3. Own secure storage, signing/build configuration, permissions and environment separation.
4. Provide reusable view/form/error/query components and assign bounded screens to Paul/Denzil.

**Deliver and verify:** Real-device SDK proof, supported device/build matrix and reusable client foundation.

**Required review:** Mathew for sensitive changes; domain owner for behavior. No self-approval of critical changes.

**Handoff:** Publish stable components, sensitive adapters and environment/build manifests to Paul/Denzil/Tinu; send privileged changes to Mathew for independent review and integrate reviewed client PRs.

**Traceability:** P1-E3-001, P1-E4-001, P1-E4-004. Requirements: R01, R02, R03, R13, R14, R17, R21, R22, R24, R25, R36. Outputs: P1-O01, P1-O06, P1-O07.

<details>
<summary>Retained technical specification: P1-E3-001 — Build reusable web/workspace foundation and language system</summary>

Wire Astro public pages and React workspaces with shared components, routing, query/error handling and session boundaries. Define customer/staff/doctor navigation from the role matrix; UI hiding never substitutes for API checks. Set up EN/ML/TA resources, fonts, formatters, accessible labels and keyboard/focus behavior. Define public/private cache boundaries and versioned publication hooks. Reuse approved design assets and avoid hard-coded clinical wording.

**Acceptance inherited:** Builds/rendering and private-route session behavior work; all core strings use resources; no sensitive query is shared through public caching.

**Evidence inherited:** Build/type results, route/session tests, keyboard/font screenshots and cache-header checks.

</details>

<details>
<summary>Retained technical specification: P1-E4-001 — Prove native build, identity, payment and video compatibility</summary>

Create reproducible Android/iOS development builds with required native modules, environment separation and secure credential storage. Prove system-browser sign-in/return, provider checkout/return and a private web/native WebRTC call on real devices. Verify camera/microphone permission denial, app background/resume and callback links. Record supported SDK/OS/build versions and account production eligibility; a simulator-only or Expo Go demonstration is insufficient.

**Acceptance inherited:** Both native builds run on real devices and the risky adapters work; unsupported components trigger an immediate effort/architecture forecast, not a hidden later task.

**Evidence inherited:** Signed build identifiers, device/OS matrix, auth/payment-return logs without secrets and web/native video proof.

</details>

<details>
<summary>Retained technical specification: P1-E4-004 — Prepare chat/voice/push contracts and store-release inputs</summary>

Integrate a safe cited-chat shell and editable voice-input UI contract; prove microphone capture/upload boundaries without unchecked actions. Register push/deep-link routing contracts and define authenticated link behavior. Prepare company app identifiers, listing text/screenshots plan, privacy/permission disclosures, review accounts and signing/recovery records. Track external production eligibility from Day 1; no claim of store approval is made.

**Acceptance inherited:** Phase 2 channels have working native interfaces/contracts and store prerequisites are exposed with named owners and deadlines.

**Evidence inherited:** Voice permission/UI proof, push/deep-link samples, store-readiness register and secret-free release configuration.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P1-DEV-003 — Sensitive session, payment and clinical client integration

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p1-devadathan-sensitive-client-flows` → `dev`.

**Inputs and integration handoffs:** P1-DEV-002, P1-MAT-002, P1-JOS-003. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Wire safe sign-in/session revocation/CSRF behavior and authorized API access.
2. Integrate payment SDK/current-state reconciliation, private video membership and booking expiry.
3. Implement minimum-necessary doctor/consent views and prevent private caching/leaking links.
4. Review Paul’s forms and Denzil’s staff/content views against the same contracts.
5. C03 — Capture versioned required sign-up/privacy consent without bundling marketing opt-in; record and enforce required consultation identity/consent before private video/clinical access. Before personalized medical recommendation, follow physician-approved minimal intake including age/current medication and pregnancy/child/red-flag routing; unknown or declined required information uses approved clarification/handoff. Do not impose clinical intake on ordinary public catalogue browsing or infer a diagnosis. Verify configured transport and at-rest protection for clinical database/private objects/backups and approved processor flows using actual configuration/provider evidence; no plaintext secret/health-content evidence dump. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Client return/resume/forbidden tests, private cache evidence and integrated core journeys.

**Required review:** Mathew for sensitive changes; domain owner for behavior. No self-approval of critical changes.

**Handoff:** Publish stable components, sensitive adapters and environment/build manifests to Paul/Denzil/Tinu; send privileged changes to Mathew for independent review and integrate reviewed client PRs.

**Traceability:** P1-E3-002, P1-E3-003, P1-E4-002, P1-E4-003. Requirements: R01, R02, R03, R04, R05, R11, R12, R13, R14, R19, R22, R25, R32, R36. Outputs: P1-O04, P1-O05, P1-O06.

<details>
<summary>Retained technical specification: P1-E3-002 — Implement catalogue, cart, checkout and account/order slice</summary>

Connect catalogue/concern/product/variant views to current APIs, optimize R2 images, and handle stock/consult-only labels using approved content. Implement cart, address collection, authoritative totals, enabled payment/COD controls, confirmation and order detail. Show price/stock changes and pending/failed payment states clearly; prevent double submission without treating UI controls as idempotency. Add login/return navigation and owner-only order views.

**Acceptance inherited:** An authenticated customer completes sandbox purchase and sees the correct persisted order; tampered/stale checkout shows a safe actionable response.

**Evidence inherited:** Browser journeys covering success/cancel/failure/stale stock, session return and another-user order access.

</details>

<details>
<summary>Retained technical specification: P1-E3-003 — Implement directory, booking and staff/physician skeleton screens</summary>

Build doctor/location/service/fee/slot selection, hold expiry, paid booking confirmation and accessible error/pending states. Provide staff catalogue/order/batch and doctor schedule/assigned-consultation screens for the Phase 1 slice. Display consent/assignment boundaries and restrict actions through the same contracts. Include empty, loading, forbidden, conflict and retry states; keep minimum necessary patient information visible for each role.

**Acceptance inherited:** Staff and customer flows reflect live API state; a slot conflict or revoked assignment cannot remain falsely confirmed in the UI.

**Evidence inherited:** Customer/staff/doctor browser fixtures, slot-race UI outcome, consent/forbidden tests and three-language layout smoke.

</details>

<details>
<summary>Retained technical specification: P1-E4-002 — Implement shared native shopping/account/checkout slice</summary>

Connect catalogue/product/concern, cart, addresses, current totals, payment/COD and order confirmation/history detail to shared APIs. Handle reconnect, cancel, app resume, repeated taps and pending payment reconciliation without false success. Use locale resources, accessible touch targets/fonts and secure sessions. No database or provider secret is bundled in the app; local caches contain only permitted data and clear on logout where required.

**Acceptance inherited:** The same sandbox purchase produces matching native/web/API state on Android and iOS, including safe failure/pending outcomes.

**Evidence inherited:** Real-device purchase/account journeys, duplicate-tap/provider-return tests, private-cache/logout inspection and language smoke.

</details>

<details>
<summary>Retained technical specification: P1-E4-003 — Implement native directory/booking and consultation shell</summary>

Build doctor/location/fee/slot UI, booking holds/payment/confirmation and appointment history. Integrate the proven consultation component with backend-issued membership credentials; define join-window and revocation behavior for Phase 2 completion. Exercise cross-clinic conflict responses, expired holds, back navigation and app resume. Prepare native notes/recommendation visibility contracts limited to the customer scope.

**Acceptance inherited:** Native booking uses the authoritative reservation path; private call access proof is bound to the booked patient and assigned doctor.

**Evidence inherited:** Device booking/race/expiry results and unauthorized/expired-room credential tests.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P1-DEV-004 — Cross-client quality and backend peer review

**Allocated time:** 3 hours (implementation / QA preparation). **Branch:** `feature/p1-devadathan-frontend-security-review` → `dev`.

**Inputs and integration handoffs:** P1-MAT-003, P1-DEV-003. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Review Mathew’s identity/tool/AI boundaries and privileged handler changes.
2. Audit bundles, cookies/CORS/cache, dynamic content rendering, links and client errors.
3. Complete safe cited-chat/editor shell integration without embedding medical assumptions.
4. Fix Day 1 native compatibility issues before committing to the remaining schedule.

**Deliver and verify:** Independent senior review, frontend security results and cross-client build evidence.

**Required review:** Mathew for sensitive changes; domain owner for behavior. No self-approval of critical changes.

**Handoff:** Publish stable components, sensitive adapters and environment/build manifests to Paul/Denzil/Tinu; send privileged changes to Mathew for independent review and integrate reviewed client PRs.

**Traceability:** P1-E3-004, P1-E4-004, P1-E6-002. Requirements: R10, R16, R17, R20, R21, R22, R24, R25, R30, R36, R38. Outputs: P1-O01, P1-O06, P1-O07, P1-O08, P1-O09.

<details>
<summary>Retained technical specification: P1-E3-004 — Build approved-content editor foundation and integrate channel shells</summary>

Create structured KB draft, source/provenance, product/concern scope, required safety blocks, approval/version and withdrawal UI foundation. Separate editor and physician approval actions. Integrate a cited chat/human-fallback shell, safe session handling and approved response rendering; prepare review/handoff layout contracts. Define review moderation and seasonal/content publication hooks for Phase 2. Keep medical blocks distinct from model-generated nonclinical text.

**Acceptance inherited:** Drafts cannot self-publish or appear in approved retrieval; the core chat/editor path is testable and Phase 2 publication/handoff contracts are agreed.

**Evidence inherited:** Editor/approver negatives, draft/stale retrieval tests, citation rendering and safe fallback browser evidence.

</details>

<details>
<summary>Retained technical specification: P1-E4-004 — Prepare chat/voice/push contracts and store-release inputs</summary>

Integrate a safe cited-chat shell and editable voice-input UI contract; prove microphone capture/upload boundaries without unchecked actions. Register push/deep-link routing contracts and define authenticated link behavior. Prepare company app identifiers, listing text/screenshots plan, privacy/permission disclosures, review accounts and signing/recovery records. Track external production eligibility from Day 1; no claim of store approval is made.

**Acceptance inherited:** Phase 2 channels have working native interfaces/contracts and store prerequisites are exposed with named owners and deadlines.

**Evidence inherited:** Voice permission/UI proof, push/deep-link samples, store-readiness register and secret-free release configuration.

</details>

<details>
<summary>Retained technical specification: P1-E6-002 — Build test harness, redacted observability and rollback foundation</summary>

Wire real PostgreSQL integration fixtures, browser journeys and a real-device evidence template. Add request/event correlation, scrubbed error logs, health checks, basic latency/error/pool metrics and an independent alert test. Configure versioned deploy/rollback and a current-schema compatibility check. Prepare controlled provider adapters and initial k6 workload without sending bulk traffic to live providers. Review clarification C08: Measure healthy-state due-to-claim pickup p95 below two minutes with agreed server timestamps/sample size while preserving current consent/version/deadline suppression. During fault/backlog tests separately measure deadline recovery and alerts. Configure a defined 30-day core-availability SLI/dashboard and 99.9% internal objective, exclusions and owner; ten-day prelaunch tests cannot prove achieved monthly availability and do not imply a paid vendor SLA or 24-hour clinician staffing.

**Acceptance inherited:** Critical journey and scan reports are generated by CI; alert receipt and prior-version rollback are demonstrated.

**Evidence inherited:** Automated report links, redaction/alert checks, rollback timing and initial load-script manifest.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P1-DEV-090 — G1 verification and cumulative regression

**Allocated time:** 4 hours (verification). **Branch:** `test/p1-devadathan-g1-verification` → `dev`.

Merge necessary test-code changes before freeze; run results belong in the evidence store. Do not invalidate the frozen candidate with an evidence-only application change.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Operate specialist CI/artifact/mobile/security/config/load/queue/recovery/rollback checks with approved isolated resources. Verify exact build/source/config parity, private client behavior and actual supported-device evidence. Review Mathew’s critical changes.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Mathew for sensitive changes; domain owner for behavior. No self-approval of critical changes.

**Handoff:** Publish stable components, sensitive adapters and environment/build manifests to Paul/Denzil/Tinu; send privileged changes to Mathew for independent review and integrate reviewed client PRs.

**Traceability:** P1-E3-090, P1-E4-090, P1-E6-090. Requirements: R01, R02, R03, R11, R12, R13, R14, R16, R22, R24, R25, R36, R38. Outputs: P1-O09.

### P1-DEV-080 — Environment, acceptance and handover support

**Allocated time:** 1 hours (environment / handover). **Branch:** `chore/p1-devadathan-readiness-handover` → `dev`.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Operate controlled environments/builds/migrations, exact-candidate promotion and paid configuration. Coordinate app submission/approval, company-owned recovery/signing/source/service access and measured support handover. Final deployment follows prelaunch approval.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Mathew for sensitive changes; domain owner for behavior. No self-approval of critical changes.

**Handoff:** Publish stable components, sensitive adapters and environment/build manifests to Paul/Denzil/Tinu; send privileged changes to Mathew for independent review and integrate reviewed client PRs.

**Traceability:** P1-E6-080. Requirements: R36, R38. Outputs: P1-O01, P1-O09.

### P1-DEV-099 — Protected defect/retest reserve

**Allocated time:** 2 hours (conditional reserve). **Branch:** `fix/p1-devadathan-bug-001` → `dev`.

Create this branch only if a matching defect actually exists; the suffix shown is an example. Test execution alone does not require a code branch.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Use only against an actual tracked defect; replace bug-001 with the real issue ID. Reproduce, contain and route to the correct owner; independently retest a reviewed fix on a new candidate. Tinu uses this for triage/retesting, not critical feature coding. Paul/Denzil fix only bounded UI/content defects. If unused, broaden verification/handover; do not add scope or count the reserve as guaranteed repair capacity.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Mathew for sensitive changes; domain owner for behavior. No self-approval of critical changes.

**Handoff:** Publish stable components, sensitive adapters and environment/build manifests to Paul/Denzil/Tinu; send privileged changes to Mathew for independent review and integrate reviewed client PRs.

**Traceability:** P1-E3-099, P1-E4-099, P1-E6-099. Requirements: R36, R38. Outputs: P1-O09.

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

- D4: complete sensitive physician/customer UI and native realtime/voice/push adapters.
- D5: finish platform reliability/runbooks and integrate complete web/native screens; review senior backend changes.
- D6 morning: complete signed candidate/manifests and Day 7 paid readiness. Final four hours: G2 full-candidate security/device/ops checks.

The checkpoints order work; they do not add hours beyond the phase budget. G1/G2 verification must include the protected four-hour final-half-day allocation. Phase 3 specialist campaigns may run in parallel, with a named operator and safe provider controls.

**Daily capacity aligned to the phase plan**

| Working day | B: implementation / QA prep | V: verification | E: environment / handover | C: reserve | Total |
|---|---:|---:|---:|---:|---:|
| Day 4 | 8 | 0 | 0 | 0 | 8 |
| Day 5 | 8 | 0 | 0 | 0 | 8 |
| Day 6 | 2 | 4 | 0 | 2 | 8 |

B/V/E/C are daily capacity slices, not new tasks. Review/meetings count within these hours. Follow this member’s package sequence and handoff contracts; do not double-book tasks. Reserve is conditional and otherwise supports verification/handover. On the final day, schedule four V hours in the protected final half-day for everyone; Tinu also has two earlier V hours. Background test runtime is not extra staffed capacity; record actual operator/reviewer time.

**Named test execution/support groups:** P2-T02, P2-T05, P2-T10, P2-T12, P2-T19, P2-T20, P2-T21, P2-T30, P2-T32, P2-T33, P2-T34, P2-T35, P2-T36. The detailed procedures are in Tinu’s annex. These are minimum named duties; also help with impacted cumulative regression and the shared gate. Tinu coordinates execution rather than replacing the listed specialist/domain operator.

**Entry and dependencies:** G1 must pass first. Build on accepted contracts and reviewed components; keep Phase 1 critical tests running. Complete actual features by G2; track pending public approvals explicitly for Phase 3.

| Package | Hours | Branch from `dev`; PR to `dev` |
|---|---:|---|
| P2-DEV-001 — Sensitive customer/physician/support workspaces | 5 | `feature/p2-devadathan-clinical-sensitive-workspaces` |
| P2-DEV-002 — Native private video, voice, push and deep links | 5 | `feature/p2-devadathan-native-realtime-sdks` |
| P2-DEV-003 — Platform reliability and Day 7 paid readiness | 4 | `feature/p2-devadathan-platform-release-readiness` |
| P2-DEV-004 — Full web/native integration and security review | 4 | `feature/p2-devadathan-full-client-integration` |
| P2-DEV-090 — G2 verification and cumulative regression | 4 | `test/p2-devadathan-g2-verification` |
| P2-DEV-099 — Protected defect/retest reserve | 2 | `fix/p2-devadathan-bug-001` |

### P2-DEV-001 — Sensitive customer/physician/support workspaces

**Allocated time:** 5 hours (implementation / QA preparation). **Branch:** `feature/p2-devadathan-clinical-sensitive-workspaces` → `dev`.

**Inputs and integration handoffs:** P2-MAT-001, P2-MAT-003. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Complete physician assignment/consent/notes/signature UI and signed consult-to-cart integration.
2. Finish safe account/session/secure link/current-state flows across staff/customer workspaces.
3. Build privileged action components used by Denzil’s ordinary screens.
4. Review permission and private-cache behavior with Mathew; preserve loading/conflict/error states.
5. C03 — Capture versioned required sign-up/privacy consent without bundling marketing opt-in; record and enforce required consultation identity/consent before private video/clinical access. Before personalized medical recommendation, follow physician-approved minimal intake including age/current medication and pregnancy/child/red-flag routing; unknown or declined required information uses approved clarification/handoff. Do not impose clinical intake on ordinary public catalogue browsing or infer a diagnosis. Verify configured transport and at-rest protection for clinical database/private objects/backups and approved processor flows using actual configuration/provider evidence; no plaintext secret/health-content evidence dump. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.
6. C04 — Authorized front desk creates an in-clinic outpatient appointment in the same canonical booking lifecycle with source/staff actor and correct clinic fee/payment/refund state; use the same global doctor overlap constraints. It cannot be confused with a walk-in product order. Assigned physicians see policy-permitted past purchases in the linked patient view; unassigned/revoked/cross-patient/clinic access remains denied. Doctor management also includes approved qualifications/photo, slot length and online/in-clinic/both availability settings; front-desk operational readiness is demonstrated before public launch. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Complete clinical/support workflows and negative browser/device evidence.

**Required review:** Mathew for sensitive changes; domain owner for behavior. No self-approval of critical changes.

**Handoff:** Publish stable components, sensitive adapters and environment/build manifests to Paul/Denzil/Tinu; send privileged changes to Mathew for independent review and integrate reviewed client PRs.

**Traceability:** P2-E3-001, P2-E3-002. Requirements: R01, R02, R03, R04, R05, R06, R07, R09, R10, R11, R12, R14, R15, R16, R19, R20, R22, R26, R32, R36. Outputs: P2-O01, P2-O02, P2-O03, P2-O06.

<details>
<summary>Retained technical specification: P2-E3-001 — Complete customer commerce and operational workspaces</summary>

Complete catalogue/concern, saved addresses/history/invoice/reorder/tracking and subscription lifecycle UI. Build the unified order/packing/return/refund desk, batch/expiry/recall/adjustment/transfer screens and location filters using scoped APIs. Display authoritative tax/discount/shipping/pending/error states and downloadable translated invoice labels. Preserve accessible loading/empty/conflict/offline states and confirmation for sensitive staff actions.

**Acceptance inherited:** Retail and operational workflows run end to end through approved data and current APIs; no disconnected or disabled required screen remains.

**Evidence inherited:** Customer and staff browser journeys, permissions/locale/accessibility checks and financial/stock display reconciliation.

</details>

<details>
<summary>Retained technical specification: P2-E3-002 — Complete physician, content, schedule and support workspaces</summary>

Complete schedules/leave/fees, assigned-patient history/consent/notes/recommendations and dose/refill UI. Finish content approval/version/withdrawal and reviewed safety translations; enforce editor/approver separation. Provide live handoff, conversation review, callback/unanswered queues, ownership/resolution reporting and after-hours state. Staff takeover must visibly pause the bot; health details remain scoped and consented. Review clarification C04: Authorized front desk creates an in-clinic outpatient appointment in the same canonical booking lifecycle with source/staff actor and correct clinic fee/payment/refund state; use the same global doctor overlap constraints. It cannot be confused with a walk-in product order. Assigned physicians see policy-permitted past purchases in the linked patient view; unassigned/revoked/cross-patient/clinic access remains denied. Doctor management also includes approved qualifications/photo, slot length and online/in-clinic/both availability settings; front-desk operational readiness is demonstrated before public launch.

**Acceptance inherited:** Company doctors/front desk can execute complete assigned workflows and content/support controls operate without unauthorized patient exposure.

**Evidence inherited:** Doctor/content/support UAT, approval/takeover races, consent/scoping, schedule edit and language tests.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P2-DEV-002 — Native private video, voice, push and deep links

**Allocated time:** 5 hours (implementation / QA preparation). **Branch:** `feature/p2-devadathan-native-realtime-sdks` → `dev`.

**Inputs and integration handoffs:** P2-MAT-001, P2-MAT-003. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Finish authorized room lifecycle, TURN/network fallback and call permission/resume handling.
2. Complete bounded editable voice flow and native capture/media security.
3. Wire authenticated push/deep-link destinations and sign-in/payment return reauthorization.
4. Verify Android/iOS real-device private consultation and no unchecked action.
5. C03 — Capture versioned required sign-up/privacy consent without bundling marketing opt-in; record and enforce required consultation identity/consent before private video/clinical access. Before personalized medical recommendation, follow physician-approved minimal intake including age/current medication and pregnancy/child/red-flag routing; unknown or declined required information uses approved clarification/handoff. Do not impose clinical intake on ordinary public catalogue browsing or infer a diagnosis. Verify configured transport and at-rest protection for clinical database/private objects/backups and approved processor flows using actual configuration/provider evidence; no plaintext secret/health-content evidence dump. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Signed device builds, SDK/version matrix and full sensitive native integration.

**Required review:** Mathew for sensitive changes; domain owner for behavior. No self-approval of critical changes.

**Handoff:** Publish stable components, sensitive adapters and environment/build manifests to Paul/Denzil/Tinu; send privileged changes to Mathew for independent review and integrate reviewed client PRs.

**Traceability:** P2-E4-002, P2-E4-003. Requirements: R10, R11, R12, R13, R14, R15, R17, R18, R19, R20, R21, R22, R23, R24, R25, R32, R36. Outputs: P2-O02, P2-O03, P2-O04.

<details>
<summary>Retained technical specification: P2-E4-002 — Complete native consultation, scheduling and clinical customer flows</summary>

Complete book/reschedule/cancel/refund display, appointment history, consent, assigned consultation joins, signed recommendations and medicine/refill views. Implement backend-issued room credentials, join-window expiry/revocation, reconnect, mic/camera switching/denial and background/resume behavior. Verify patient and doctor web/native compatibility, poor networks and optional relay-only policy; no media passes through API Workers and no consultation recording is enabled by default.

**Acceptance inherited:** Both native apps execute the full approved consultation journey and cannot join another patient/doctor room; dose/clinical instructions retain the approved version.

**Evidence inherited:** Device/video/network/permission matrix, unauthorized/expired-room tests, reschedule/refund and consult-to-cart evidence.

</details>

<details>
<summary>Retained technical specification: P2-E4-003 — Complete native assistant, voice, push and channel linking</summary>

Finish cited chat, safe approved medical blocks, explicit action confirmations, urgent/human handoff and conversation state. Add bounded microphone capture/transcription, editable review of units/numbers and safe failure; no unchecked voice performs a purchase or booking. Implement consented push, authenticated notification/deep-link destinations and identity-linked WhatsApp checkout/booking return. Test three-language rendering, Romanized input display, expired links and app restart.

**Acceptance inherited:** Native chat/voice/actions match web/WhatsApp backend state, handoff pauses automation and private destinations require current identity.

**Evidence inherited:** Device voice/ambiguity/action-confirmation, urgency/takeover, push/link replay and session-expiry results.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P2-DEV-003 — Platform reliability and Day 7 paid readiness

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p2-devadathan-platform-release-readiness` → `dev`.

**Inputs and integration handoffs:** P2-MAT-004, P2-JOS-004. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Complete CI/security inventory, queue priorities/leases/DLQ, redacted telemetry and cost alerts.
2. Prepare paid Neon configuration and isolated realistic retained-data/load fixtures.
3. Complete restore/reconciliation scripts and additive rollback runbooks.
4. Prepare company-owned signing/store/provider/domain/account readiness with Denzil.
5. C07 — Hand over a dated maintenance calendar: daily reconciliation; weekly access/job/backup/capacity/security checks; monthly physician review of flagged conversations and knowledge changes; quarterly operating/performance report. Name primary/backup owners, priority-fix/security/app-release workflow, and the proposal’s up-to-eight-hours-per-month knowledge-maintenance allowance with an agreed overflow/response process. These are support obligations/operating labor, not extra sprint capacity, new subscription pricing, or automatically created reminders. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.
6. C08 — Measure healthy-state due-to-claim pickup p95 below two minutes with agreed server timestamps/sample size while preserving current consent/version/deadline suppression. During fault/backlog tests separately measure deadline recovery and alerts. Configure a defined 30-day core-availability SLI/dashboard and 99.9% internal objective, exclusions and owner; ten-day prelaunch tests cannot prove achieved monthly availability and do not imply a paid vendor SLA or 24-hour clinician staffing. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** G2 resource/runbook manifest and Day 7 activation checklist.

**Required review:** Mathew for sensitive changes; domain owner for behavior. No self-approval of critical changes.

**Handoff:** Publish stable components, sensitive adapters and environment/build manifests to Paul/Denzil/Tinu; send privileged changes to Mathew for independent review and integrate reviewed client PRs.

**Traceability:** P2-E6-001, P2-E6-002, P2-E6-003. Requirements: R01, R02, R03, R08, R10, R14, R18, R25, R27, R29, R35, R36, R37, R38. Outputs: P2-O06, P2-O07.

<details>
<summary>Retained technical specification: P2-E6-001 — Complete quality pipeline and full-scope security inventory</summary>

Extend CI critical business, web/mobile contract, code/dependency/secret/config and migration checks to the complete app. Maintain route/tool/role/record inventory and authenticated test accounts; configure staged dynamic review and manual access/business-logic tests. Trace each feature and external dependency to an R ID; collect reproducible build/schema/model/KB evidence and independently review critical security fixes. No scan result alone certifies safety.

**Acceptance inherited:** Every reachable critical route/tool has positive and negative coverage, scan findings are triaged and evidence points to the integrated candidate.

**Evidence inherited:** Route/test coverage register, authenticated dynamic/code scan reports, reviewed fixes and exact build manifests.

</details>

<details>
<summary>Retained technical specification: P2-E6-002 — Complete queue priorities, observability, cost and failure drills</summary>

Tune separate financial/clinical/engagement concurrency, outbox leases, retry/deadline/DLQ handling and unknown-provider reconciliation. Add metrics/alerts for errors, CPU/cache/pool/locks, job age/deadlines, invariant failures, vendor spend and clinical/human escalation. Verify marketing backlog cannot monopolize important work. Execute crash/reclaim/duplicate/timeout/saturation tests; keep logs/payloads scrubbed and provider load isolated. Review clarification C08: Measure healthy-state due-to-claim pickup p95 below two minutes with agreed server timestamps/sample size while preserving current consent/version/deadline suppression. During fault/backlog tests separately measure deadline recovery and alerts. Configure a defined 30-day core-availability SLI/dashboard and 99.9% internal objective, exclusions and owner; ten-day prelaunch tests cannot prove achieved monthly availability and do not imply a paid vendor SLA or 24-hour clinician staffing.

**Acceptance inherited:** The full app has usable alert/reconciliation dashboards, cost visibility and durable bounded work under failure.

**Evidence inherited:** Failure/replay traces, priority/backlog results, alert receipt/redaction checks and usage/cost forecast.

</details>

<details>
<summary>Retained technical specification: P2-E6-003 — Prepare paid verification, restore scripts and release runbooks</summary>

Version the Workers Paid/Neon Launch verification configuration, compute/pool/seven-day history, isolated data/queues/R2/secrets and direct backup/migration roles. Prepare realistic retained fixtures, k6 mix and artifact metadata for G3; verify extension/RLS/connection compatibility. Complete encrypted pg_dump/pg_restore/object-manifest and schema-compatible rollback/cutover scripts. Draft on-call, financial replay, credentials and training/handover checklists. Review clarification C07: Hand over a dated maintenance calendar: daily reconciliation; weekly access/job/backup/capacity/security checks; monthly physician review of flagged conversations and knowledge changes; quarterly operating/performance report. Name primary/backup owners, priority-fix/security/app-release workflow, and the proposal’s up-to-eight-hours-per-month knowledge-maintenance allowance with an agreed overflow/response process. These are support obligations/operating labor, not extra sprint capacity, new subscription pricing, or automatically created reminders.

**Acceptance inherited:** Day 7 paid-environment and recovery tests can run without creating new architecture or uncontrolled production side effects.

**Evidence inherited:** Reviewed configuration/scripts, fixture sizing, restore/rollback rehearsal and operations/training drafts.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P2-DEV-004 — Full web/native integration and security review

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p2-devadathan-full-client-integration` → `dev`.

**Inputs and integration handoffs:** P2-PAU-001, P2-PAU-002, P2-PAU-003, P2-DEN-001, P2-DEN-003, P2-DEN-004. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Integrate Paul/Denzil’s screens and shared locales with complete backend contracts.
2. Produce complete signed candidates; no required features may remain stubs.
3. Review Mathew’s sensitive backend/AI changes and inspect bundles/session/cache/file/link boundaries.
4. Prepare final artifact/version manifest and store review packages; submission follows Day 7 paid regression.

**Deliver and verify:** Feature parity checklist, complete signed candidates and independent review evidence.

**Required review:** Mathew for sensitive changes; domain owner for behavior. No self-approval of critical changes.

**Handoff:** Publish stable components, sensitive adapters and environment/build manifests to Paul/Denzil/Tinu; send privileged changes to Mathew for independent review and integrate reviewed client PRs.

**Traceability:** P2-E4-001, P2-E4-004, P2-E3-004. Requirements: R01, R02, R03, R09, R16, R22, R23, R24, R25, R26, R28, R31, R33, R34, R35, R36, R37. Outputs: P2-O04, P2-O05, P2-O06, P2-O07.

<details>
<summary>Retained technical specification: P2-E4-001 — Complete full native commerce/account/subscription/loyalty parity</summary>

Complete native browse/cart/addresses/current checkout/COD/history/invoices/reorder/tracking, provider-confirmed subscription lifecycle, bundles, referrals/credit/redemption and approved distributor customer experience. Apply the same backend pricing/eligibility and signed recommendation rules. Handle cancel/pending/network resume/deep-link state safely; cache only permitted data and clear/revalidate after logout/revocation. Test Android/iOS parity, accessible text/touch controls and all launch scripts.

**Acceptance inherited:** Every required customer commerce capability works in both release-candidate apps; no web-only omission is used to claim native parity.

**Evidence inherited:** Feature-by-feature parity matrix and Android/iOS purchase/renewal/credit/distributor/reorder evidence.

</details>

<details>
<summary>Retained technical specification: P2-E4-004 — Produce complete signed candidates and store-ready packages</summary>

Run current-scope full-device regression on Android/iOS and representative supported devices/OS; test accessibility, text scaling, slow/offline transitions, notification routing and payment return. Produce signed versioned complete candidates, dependency/permission inventories, listing assets/privacy declarations, review accounts and release notes. Validate company signing/access recovery and store production eligibility. Prepare Day 7 submission after paid-environment regression; internal distribution is not public release.

**Acceptance inherited:** Complete signed candidates and external readiness records are attached to G2; reproducible builds contain no secrets/debug permissions or missing customer feature.

**Evidence inherited:** Build hashes/device report, permission/privacy/listing package, reviewer account checklist and store status register.

</details>

<details>
<summary>Retained technical specification: P2-E3-004 — Complete reports, SEO/listings, localization and training drafts</summary>

Complete reconciled product/concern/city/clinic/retention/refill/subscription/conversion dashboards with safe date filters, freshness and asynchronous exports. Implement canonical/language alternate/schema/sitemap/redirect/feed outputs and company listing linkage; track external approvals distinctly. Audit EN/ML/TA resource completeness, fonts, invoice/message labels and accessible layouts; finalize first approved seasonal campaign configuration. Draft role-based guides/training scenarios and final web smoke list. Review clarification C02: Record privacy-minimized answer-to-approved-entry/version attribution, not raw health prompts in general analytics. Content reviewers can view most-used entry/version counts with date filters and freshness labels. Define whether counts represent used answer entries or retrieval hits; count retries once by stable answer/event identity and reconcile known fixtures. Unauthorized roles cannot access the content report.

**Acceptance inherited:** Reports match fixtures, required SEO/feed artifacts validate, translations have no missing keys and training/approval dependencies are ready for Phase 3.

**Evidence inherited:** Known-total report suite, sitemap/feed/schema validation, locale/accessibility report and draft training/approval register.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P2-DEV-090 — G2 verification and cumulative regression

**Allocated time:** 4 hours (verification). **Branch:** `test/p2-devadathan-g2-verification` → `dev`.

Merge necessary test-code changes before freeze; run results belong in the evidence store. Do not invalidate the frozen candidate with an evidence-only application change.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Operate specialist CI/artifact/mobile/security/config/load/queue/recovery/rollback checks with approved isolated resources. Verify exact build/source/config parity, private client behavior and actual supported-device evidence. Review Mathew’s critical changes.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Mathew for sensitive changes; domain owner for behavior. No self-approval of critical changes.

**Handoff:** Publish stable components, sensitive adapters and environment/build manifests to Paul/Denzil/Tinu; send privileged changes to Mathew for independent review and integrate reviewed client PRs.

**Traceability:** P2-E3-090, P2-E4-090, P2-E6-090. Requirements: R01, R02, R03, R04, R07, R09, R10, R11, R12, R13, R14, R15, R16, R17, R18, R19, R20, R22, R23, R24, R25, R26, R27, R28, R29, R30, R31, R33, R34, R35, R36, R37, R38. Outputs: P2-O07.

### P2-DEV-099 — Protected defect/retest reserve

**Allocated time:** 2 hours (conditional reserve). **Branch:** `fix/p2-devadathan-bug-001` → `dev`.

Create this branch only if a matching defect actually exists; the suffix shown is an example. Test execution alone does not require a code branch.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Use only against an actual tracked defect; replace bug-001 with the real issue ID. Reproduce, contain and route to the correct owner; independently retest a reviewed fix on a new candidate. Tinu uses this for triage/retesting, not critical feature coding. Paul/Denzil fix only bounded UI/content defects. If unused, broaden verification/handover; do not add scope or count the reserve as guaranteed repair capacity.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Mathew for sensitive changes; domain owner for behavior. No self-approval of critical changes.

**Handoff:** Publish stable components, sensitive adapters and environment/build manifests to Paul/Denzil/Tinu; send privileged changes to Mathew for independent review and integrate reviewed client PRs.

**Traceability:** P2-E3-099, P2-E4-099, P2-E6-099. Requirements: R36, R38. Outputs: P2-O07.

### Phase 2 personal handoff and gate checklist

- All assigned packages have reviewed PRs or explicit blocked/conditional status; no direct shared-branch changes.
- APIs/components/content/fixtures are handed to the named dependent owner with examples and known limits.
- Tests include positive, negative, authorization/current-state, retry/failure and relevant persisted-state checks.
- Tinu has exact candidate metadata, requirement/output links, screenshots/request IDs, defects and independent retest references.
- Domain/company reviewers have approved medical/finance/content expectations where needed.
- No unresolved blocker is hidden by a UI workaround, disabled feature, mock provider or skipped test.
- Promotion waits for G1/G2 Pass or the Phase 3 prelaunch Go; Devadathan handles the reviewed merge to `main`. Final G3 closure and `v1.0.0` follow successful postdeployment checks.

## Phase 3: Production verification, acceptance and launch

**Window:** Days 7–10 · 27–30 October 2026. **Capacity:** 32 hours; implementation/QA preparation 8, verification 10, environment/handover 7, reserve 7.

This is a capacity ceiling for adapting proven components and completing the allocated scope, including review within the relevant package. It is not a measured greenfield estimate. Escalate missing reuse and review overload on Day 1; do not consume protected test time to hide it.

**Sequence and handoff checkpoints**

- D7: activate paid equivalent resources, run regression, submit complete signed store candidates; do not claim approval.
- D8: operate 60/120 rps campaigns, start/observe four-hour soak; execute authorized isolated recovery/rollback drills.
- D9: finish specialist evidence, retests, store review response and platform/support training.
- D10: coordinate prelaunch decision, reviewed migrations/promotions/rollout, safe postdeploy observation, rollback if required and handover.

The checkpoints order work; they do not add hours beyond the phase budget. G1/G2 verification must include the protected four-hour final-half-day allocation. Phase 3 specialist campaigns may run in parallel, with a named operator and safe provider controls.

**Daily capacity aligned to the phase plan**

| Working day | B: implementation / QA prep | V: verification | E: environment / handover | C: reserve | Total |
|---|---:|---:|---:|---:|---:|
| Day 7 | 3 | 3 | 1 | 1 | 8 |
| Day 8 | 3 | 3 | 0 | 2 | 8 |
| Day 9 | 2 | 3 | 2 | 1 | 8 |
| Day 10 | 0 | 1 | 4 | 3 | 8 |

B/V/E/C are daily capacity slices, not new tasks. Review/meetings count within these hours. Follow this member’s package sequence and handoff contracts; do not double-book tasks. Reserve is conditional and otherwise supports verification/handover. Background test runtime is not extra staffed capacity; record actual operator/reviewer time.

**Named test execution/support groups:** P3-T01, P3-T02, P3-T03, P3-T05, P3-T08, P3-T12, P3-T13, P3-T14, P3-T15, P3-T16, P3-T17, P3-T18, P3-T19, P3-T20, P3-T21, P3-T22, P3-T23, P3-T24, P3-T25, P3-T26, P3-T27, P3-T28, P3-T29, P3-T30. The detailed procedures are in Tinu’s annex. These are minimum named duties; also help with impacted cumulative regression and the shared gate. Tinu coordinates execution rather than replacing the listed specialist/domain operator.

**Entry and dependencies:** G2 complete-feature candidate and paid readiness must pass first. Use production-equivalent paid settings, pinned artifacts and realistic synthetic retained data. Every relevant code/config/model/KB change invalidates affected evidence.

| Package | Hours | Branch from `dev`; PR to `dev` |
|---|---:|---|
| P3-DEV-001 — Paid platform, performance and recovery corrections | 4 | `feature/p3-devadathan-performance-recovery-hardening` |
| P3-DEV-002 — Sensitive frontend/native corrections and complete builds | 4 | `feature/p3-devadathan-native-client-hardening` |
| P3-DEV-090 — G3 verification and cumulative regression | 10 | `test/p3-devadathan-g3-verification` |
| P3-DEV-080 — Environment, acceptance and handover support | 7 | `chore/p3-devadathan-readiness-handover` |
| P3-DEV-099 — Protected defect/retest reserve | 7 | `fix/p3-devadathan-bug-001` |

### P3-DEV-001 — Paid platform, performance and recovery corrections

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p3-devadathan-performance-recovery-hardening` → `dev`.

**Inputs and integration handoffs:** P3-MAT-002, P3-JOS-002. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Activate production-equivalent paid settings and verify actual resource/role/extension/parity state.
2. Fix observed pool/query/lease/cache/backlog performance findings with Mathew/Josin.
3. Harden encrypted independent backup/PITR/restore and compatible rollback tooling.
4. Preserve original 60/120/20 rps gates; resize/reforecast if the intended minimum fails.
5. C08 — Measure healthy-state due-to-claim pickup p95 below two minutes with agreed server timestamps/sample size while preserving current consent/version/deadline suppression. During fault/backlog tests separately measure deadline recovery and alerts. Configure a defined 30-day core-availability SLI/dashboard and 99.9% internal objective, exclusions and owner; ten-day prelaunch tests cannot prove achieved monthly availability and do not imply a paid vendor SLA or 24-hour clinician staffing. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Measured resource/performance/recovery evidence on the exact candidate.

**Required review:** Mathew for sensitive changes; domain owner for behavior. No self-approval of critical changes.

**Handoff:** Publish stable components, sensitive adapters and environment/build manifests to Paul/Denzil/Tinu; send privileged changes to Mathew for independent review and integrate reviewed client PRs.

**Traceability:** P3-E6-001, P3-E6-002. Requirements: R02, R05, R10, R12, R25, R36, R38. Outputs: P3-O01, P3-O03, P3-O04, P3-O06.

<details>
<summary>Retained technical specification: P3-E6-001 — Activate and verify isolated paid production-equivalent resources</summary>

Activate Workers Paid and Neon Launch verification resources with PostgreSQL 17, required extension, pooled runtime/direct administration, isolated roles/secrets/queues/R2 and seven-day history. Disable production scale-to-zero, verify initial 0.25–1 CU bounds/effective connection limits and document sizing changes. Seed realistic synthetic retained data and pin schema/model/KB/build manifests. Validate TLS, logs/alerts, billing controls and no production side effects in test resources.

**Acceptance inherited:** Day 7 verification runs the chosen production architecture with measurable settings and safe provider test adapters; no Free-tier performance result substitutes for it.

**Evidence inherited:** Resource/role/config manifest, seed/control totals, billing/history/scale settings and endpoint smoke report.

</details>

<details>
<summary>Retained technical specification: P3-E6-002 — Harden performance, recovery automation and incident controls</summary>

Profile CPU/cache/pool/locks/query round trips and job backlog during the declared workloads. Review caching/index/concurrency/timeouts and queue priorities; implement only measured corrections. Validate encrypted independent pg_dump, PITR/object references, roles/RLS restoration, safe endpoint cutover and previous-version schema compatibility. Test alert receipt, secret rotation/recovery and incident/rollback authority; record achieved recovery times instead of assuming targets pass.

**Acceptance inherited:** Performance/recovery configuration is reproducible, observed bottlenecks have reviewed fixes and alert/reconciliation paths are exercised.

**Evidence inherited:** Versioned k6/resource profiles, restore/cutover/rollback logs, alert receipt and operations runbook.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P3-DEV-002 — Sensitive frontend/native corrections and complete builds

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p3-devadathan-native-client-hardening` → `dev`.

**Inputs and integration handoffs:** P3-MAT-001, P3-PAU-002. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Fix SDK/session/private-cache/payment/video/voice/push/link defects.
2. Review Paul/Denzil’s bounded changes and Mathew’s sensitive fixes.
3. Produce complete signed native candidates after paid regression; track store review/resubmit dependencies.
4. Preserve prior supported API/mobile compatibility during rollout.

**Deliver and verify:** Retested build manifests and sensitive client/device readiness.

**Required review:** Mathew for sensitive changes; domain owner for behavior. No self-approval of critical changes.

**Handoff:** Publish stable components, sensitive adapters and environment/build manifests to Paul/Denzil/Tinu; send privileged changes to Mathew for independent review and integrate reviewed client PRs.

**Traceability:** P3-E4-001, P3-E4-002, P3-E3-001. Requirements: R01, R02, R03, R04, R07, R10, R12, R13, R14, R16, R17, R20, R21, R22, R24, R25, R28, R30, R31, R33, R35, R36. Outputs: P3-O02, P3-O03, P3-O05.

<details>
<summary>Retained technical specification: P3-E4-001 — Harden final Android/iOS behavior and production API compatibility</summary>

Repair demonstrated payment-return, network resume, session/deep-link, video/voice permission/reconnect, private-cache and language/accessibility defects on actual supported devices. Verify the release API works with the approved candidate and prior supported app contract during staged rollout. Produce a new signed build for every binary change; bind tests and store submission to that build. No remote switch may hide required customer scope to claim completion.

**Acceptance inherited:** Both signed candidates pass device/API parity and review-account checks, with no debug secrets or unsupported native adapter.

**Evidence inherited:** Build hashes/device recordings, contract/permission/cache tests and reviewed native fixes.

</details>

<details>
<summary>Retained technical specification: P3-E4-002 — Verify consultation network quality and signing/store readiness</summary>

Exercise web/Android/iOS calls, mic/camera denial, reconnect/background, expired/revoked/guessed rooms and representative poor networks. Record negotiated bitrate/relay use and private participant authorization. Recheck signing/permissions/privacy disclosures, app links, provider returns and public store eligibility. Coordinate review fixes without losing candidate/evidence linkage; submission or TestFlight is not public availability.

**Acceptance inherited:** Private native/web consultations are accepted on representative networks and complete releasable packages are ready for actual store approval.

**Evidence inherited:** Network/video/security matrix, bitrate/relay report, privacy/signing checklist and store status evidence.

</details>

<details>
<summary>Retained technical specification: P3-E3-001 — Harden complete web/workspace UX, language and data presentation</summary>

Repair demonstrated EN/ML/TA, font/accessibility, focus/keyboard, responsive, loading/conflict/pending and role-navigation defects. Reconcile invoice, subscription, referral/distributor and reporting displays with the authoritative API. Verify no private cache, analytics event, source map or exported value leaks patient/credential data. Preserve complete required workflows and safe confirmation UI while improving public-page performance.

**Acceptance inherited:** UAT and visual/accessibility fixes are integrated without breaking role, financial or clinical rendering; all launch resources are reviewed.

**Evidence inherited:** Browser/locale/accessibility before/after evidence, cache/export checks and reviewed fixes.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P3-DEV-090 — G3 verification and cumulative regression

**Allocated time:** 10 hours (verification). **Branch:** `test/p3-devadathan-g3-verification` → `dev`.

Merge necessary test-code changes before freeze; run results belong in the evidence store. Do not invalidate the frozen candidate with an evidence-only application change.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Operate specialist CI/artifact/mobile/security/config/load/queue/recovery/rollback checks with approved isolated resources. Verify exact build/source/config parity, private client behavior and actual supported-device evidence. Review Mathew’s critical changes.

**Integrated review C08:** Measure healthy-state due-to-claim pickup p95 below two minutes with agreed server timestamps/sample size while preserving current consent/version/deadline suppression. During fault/backlog tests separately measure deadline recovery and alerts. Configure a defined 30-day core-availability SLI/dashboard and 99.9% internal objective, exclusions and owner; ten-day prelaunch tests cannot prove achieved monthly availability and do not imply a paid vendor SLA or 24-hour clinician staffing.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Mathew for sensitive changes; domain owner for behavior. No self-approval of critical changes.

**Handoff:** Publish stable components, sensitive adapters and environment/build manifests to Paul/Denzil/Tinu; send privileged changes to Mathew for independent review and integrate reviewed client PRs.

**Traceability:** P3-E3-090, P3-E4-090, P3-E6-090. Requirements: R01, R02, R03, R04, R07, R09, R10, R11, R12, R13, R14, R15, R16, R17, R18, R19, R20, R22, R23, R24, R25, R26, R27, R28, R29, R30, R31, R33, R34, R35, R36, R37, R38. Outputs: P3-O07.

### P3-DEV-080 — Environment, acceptance and handover support

**Allocated time:** 7 hours (environment / handover). **Branch:** `chore/p3-devadathan-readiness-handover` → `dev`.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Operate controlled environments/builds/migrations, exact-candidate promotion and paid configuration. Coordinate app submission/approval, company-owned recovery/signing/source/service access and measured support handover. Final deployment follows prelaunch approval.

**Integrated review C07:** Hand over a dated maintenance calendar: daily reconciliation; weekly access/job/backup/capacity/security checks; monthly physician review of flagged conversations and knowledge changes; quarterly operating/performance report. Name primary/backup owners, priority-fix/security/app-release workflow, and the proposal’s up-to-eight-hours-per-month knowledge-maintenance allowance with an agreed overflow/response process. These are support obligations/operating labor, not extra sprint capacity, new subscription pricing, or automatically created reminders.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Mathew for sensitive changes; domain owner for behavior. No self-approval of critical changes.

**Handoff:** Publish stable components, sensitive adapters and environment/build manifests to Paul/Denzil/Tinu; send privileged changes to Mathew for independent review and integrate reviewed client PRs.

**Traceability:** P3-E3-080, P3-E4-080, P3-E6-080. Requirements: R25, R36, R37, R38. Outputs: P3-O01, P3-O05, P3-O06, P3-O07.

### P3-DEV-099 — Protected defect/retest reserve

**Allocated time:** 7 hours (conditional reserve). **Branch:** `fix/p3-devadathan-bug-001` → `dev`.

Create this branch only if a matching defect actually exists; the suffix shown is an example. Test execution alone does not require a code branch.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Use only against an actual tracked defect; replace bug-001 with the real issue ID. Reproduce, contain and route to the correct owner; independently retest a reviewed fix on a new candidate. Tinu uses this for triage/retesting, not critical feature coding. Paul/Denzil fix only bounded UI/content defects. If unused, broaden verification/handover; do not add scope or count the reserve as guaranteed repair capacity.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Mathew for sensitive changes; domain owner for behavior. No self-approval of critical changes.

**Handoff:** Publish stable components, sensitive adapters and environment/build manifests to Paul/Denzil/Tinu; send privileged changes to Mathew for independent review and integrate reviewed client PRs.

**Traceability:** P3-E3-099, P3-E4-099, P3-E6-099. Requirements: R36, R38. Outputs: P3-O07.

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
| P1-E3-001 — Build reusable web/workspace foundation and language system | P1-DEV-002 |
| P1-E3-002 — Implement catalogue, cart, checkout and account/order slice | P1-DEV-003 |
| P1-E3-003 — Implement directory, booking and staff/physician skeleton screens | P1-DEV-003 |
| P1-E3-004 — Build approved-content editor foundation and integrate channel shells | P1-DEV-004 |
| P1-E3-090 — Web/workspace cumulative verification | P1-DEV-090 |
| P1-E3-099 — Protected defect/retest contingency | P1-DEV-099 |
| P1-E4-001 — Prove native build, identity, payment and video compatibility | P1-DEV-002 |
| P1-E4-002 — Implement shared native shopping/account/checkout slice | P1-DEV-003 |
| P1-E4-003 — Implement native directory/booking and consultation shell | P1-DEV-003 |
| P1-E4-004 — Prepare chat/voice/push contracts and store-release inputs | P1-DEV-002, P1-DEV-004 |
| P1-E4-090 — Real-device cumulative verification | P1-DEV-090 |
| P1-E4-099 — Protected defect/retest contingency | P1-DEV-099 |
| P1-E6-001 — Implement reproducible runtime/database/security configuration | P1-DEV-001 |
| P1-E6-002 — Build test harness, redacted observability and rollback foundation | P1-DEV-001, P1-DEV-004 |
| P1-E6-003 — Implement queue platform and encrypted backup/restore smoke | P1-DEV-001 |
| P1-E6-080 — Provision account/environment/CI and evidence infrastructure | P1-DEV-080 |
| P1-E6-090 — Platform/security/load/recovery cumulative verification | P1-DEV-090 |
| P1-E6-099 — Protected defect/retest contingency | P1-DEV-099 |
| P2-E3-001 — Complete customer commerce and operational workspaces | P2-DEV-001 |
| P2-E3-002 — Complete physician, content, schedule and support workspaces | P2-DEV-001 |
| P2-E3-004 — Complete reports, SEO/listings, localization and training drafts | P2-DEV-004 |
| P2-E3-090 — Full web/staff/language/report verification | P2-DEV-090 |
| P2-E3-099 — Protected defect/retest contingency | P2-DEV-099 |
| P2-E4-001 — Complete full native commerce/account/subscription/loyalty parity | P2-DEV-004 |
| P2-E4-002 — Complete native consultation, scheduling and clinical customer flows | P2-DEV-002 |
| P2-E4-003 — Complete native assistant, voice, push and channel linking | P2-DEV-002 |
| P2-E4-004 — Produce complete signed candidates and store-ready packages | P2-DEV-004 |
| P2-E4-090 — Full native/device and cross-channel verification | P2-DEV-090 |
| P2-E4-099 — Protected defect/retest contingency | P2-DEV-099 |
| P2-E6-001 — Complete quality pipeline and full-scope security inventory | P2-DEV-003 |
| P2-E6-002 — Complete queue priorities, observability, cost and failure drills | P2-DEV-003 |
| P2-E6-003 — Prepare paid verification, restore scripts and release runbooks | P2-DEV-003 |
| P2-E6-090 — Full security/platform/load/restore verification and G2 | P2-DEV-090 |
| P2-E6-099 — Protected defect/retest contingency | P2-DEV-099 |
| P3-E3-001 — Harden complete web/workspace UX, language and data presentation | P3-DEV-002 |
| P3-E3-080 — Lead web/content/front-desk handover and public content verification | P3-DEV-080 |
| P3-E3-090 — Final browser/language/accessibility/growth/report UAT | P3-DEV-090 |
| P3-E3-099 — Protected defect/retest contingency | P3-DEV-099 |
| P3-E4-001 — Harden final Android/iOS behavior and production API compatibility | P3-DEV-002 |
| P3-E4-002 — Verify consultation network quality and signing/store readiness | P3-DEV-002 |
| P3-E4-080 — Submit complete apps, respond to review and verify public native delivery | P3-DEV-080 |
| P3-E4-090 — Final release-binary/device/video/voice/store verification | P3-DEV-090 |
| P3-E4-099 — Protected defect/retest contingency | P3-DEV-099 |
| P3-E6-001 — Activate and verify isolated paid production-equivalent resources | P3-DEV-001 |
| P3-E6-002 — Harden performance, recovery automation and incident controls | P3-DEV-001 |
| P3-E6-080 — Coordinate G3, controlled deployment, recovery ownership and support handover | P3-DEV-080 |
| P3-E6-090 — Final security, load/soak, resilience, recovery and evidence coordination | P3-DEV-090 |
| P3-E6-099 — Protected defect/retest contingency | P3-DEV-099 |

## Test-case handoff

Use [Tinu’s standalone detailed test cases](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) for all 86 phase groups and 38 requirement walkthroughs, shared synthetic fixtures, action/expected-result pairs and evidence rules. Execute your domain cases with Tinu; do not wait until the phase-end campaign to begin testing. Source phase specifications retain their additional matrices and acceptance criteria.

### Protected measurement windows and fault-test isolation

Devadathan and Tinu publish a run-window/resource manifest before G3: target database/compute/Worker/queue/object IDs, candidate/config, dataset/reset ownership, operator/observer, provider mode and expected cost. Keep sustained/burst baseline and four-hour soak protected from unrelated deployments, seed resets, time travel, destructive fault injection, restore/cutover, scanner storms and ad hoc queries. Bounded jobs/AI/video are included only as declared workload; scheduled backup/report work is explicitly included or separately measured.

Run recovery/rollback/provider-fault/security mutation campaigns on separately verified isolated targets with independent resource contention boundaries, or serialize them after baseline/soak. A separate logical schema alone is not independent compute. Verify endpoints/queue/provider modes before each drill; never restore or fault the active measured candidate. Record cooldown/warmup and before/after correctness controls. No full load test is aimed at live payment/messaging/video providers.

The Day 8 plan is a dependency/window plan, not permission for one senior to operate several simultaneous destructive tests. Allocate actual operator/reviewer time inside the named hours; automation may run in the background with assigned observation. If target isolation, elapsed windows, staffed time or metered temporary resources do not fit, serialize/reforecast and update measured usage/cost rather than accepting confounded metrics or hidden overtime.

## Final personal completion record

Record package/PR, candidate/build IDs, requirement/output IDs, reviewer and domain approval, test runs/defects/retests, actual public-channel status, training/handover links and remaining approved low-risk issues. Leave unexecuted work Pending/Blocked. Final completion requires G3, all R01–R38 acceptance, public required channels and company ownership/support handover.
