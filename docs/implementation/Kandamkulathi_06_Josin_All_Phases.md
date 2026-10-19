# Kandamkulathi — Josin: three-phase individual implementation plan

**Issue date:** 19 October 2026. **Delivery window:** 19–30 October, ten working days. **Team:** six people. **Status:** planned work and acceptance criteria; no implementation or test results are claimed.

**Role:** Commerce implementation owner.

Own catalogue/stock/order/payment/fulfillment/subscription/billing/wholesale/loyalty implementation and finance reconciliation. Mathew must review transaction, money, stock, permission and webhook changes; finance/warehouse approve business fixtures.

**Boundaries:** Do not independently decide tax policy, credit terms or clinical eligibility. Never use the browser callback as payment proof. Mathew owns shared identity and authorization policy.

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
| 3 | 7 | 12 | 6 | 7 | 32 |
| **Total** | 42 | 20 | 7 | 11 | **80** |

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

- D1: publish schema/price/payment/event contracts and validate synthetic imports with Denzil.
- D2: integrate authoritative FEFO checkout and signed payment/ledger state; request Mathew’s review early.
- D3 morning: finish order APIs, web/native reconciliation and race fixes. Final four hours: G1 finance/stock/payment tests.

The checkpoints order work; they do not add hours beyond the phase budget. G1/G2 verification must include the protected four-hour final-half-day allocation. Phase 3 specialist campaigns may run in parallel, with a named operator and safe provider controls.

**Daily capacity aligned to the phase plan**

| Working day | B: implementation / QA prep | V: verification | E: environment / handover | C: reserve | Total |
|---|---:|---:|---:|---:|---:|
| Day 1 | 7 | 0 | 1 | 0 | 8 |
| Day 2 | 8 | 0 | 0 | 0 | 8 |
| Day 3 | 2 | 4 | 0 | 2 | 8 |

B/V/E/C are daily capacity slices, not new tasks. Review/meetings count within these hours. Follow this member’s package sequence and handoff contracts; do not double-book tasks. Reserve is conditional and otherwise supports verification/handover. On the final day, schedule four V hours in the protected final half-day for everyone; Tinu also has two earlier V hours. Background test runtime is not extra staffed capacity; record actual operator/reviewer time.

**Named test execution/support groups:** P1-T04, P1-T05, P1-T06, P1-T07, P1-T08, P1-T17, P1-T18, P1-T19. The detailed procedures are in Tinu’s annex. These are minimum named duties; also help with impacted cumulative regression and the shared gate. Tinu coordinates execution rather than replacing the listed specialist/domain operator.

**Entry and dependencies:** Start from approved company content/rules, reusable SDK proof, company accounts and synthetic fixtures. Mathew/Josin publish contracts before parallel screens. Devadathan provides components and environment access.

| Package | Hours | Branch from `dev`; PR to `dev` |
|---|---:|---|
| P1-JOS-001 — Commerce schema and validated opening data | 4 | `feature/p1-josin-commerce-data-imports` |
| P1-JOS-002 — Authoritative pricing and atomic FEFO checkout | 5 | `feature/p1-josin-fefo-checkout` |
| P1-JOS-003 — Payments, signed events and refund foundation | 5 | `feature/p1-josin-payment-ledger` |
| P1-JOS-004 — Order/account/staff APIs and client integration | 3 | `feature/p1-josin-orders-core-api` |
| P1-JOS-090 — G1 verification and cumulative regression | 4 | `test/p1-josin-g1-verification` |
| P1-JOS-080 — Environment, acceptance and handover support | 1 | `chore/p1-josin-readiness-handover` |
| P1-JOS-099 — Protected defect/retest reserve | 2 | `fix/p1-josin-bug-001` |

### P1-JOS-001 — Commerce schema and validated opening data

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p1-josin-commerce-data-imports` → `dev`.

**Inputs and integration handoffs:** P1-MAT-001, P1-DEN-001, P1-DEV-001. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Define SKU/batch/cart/order/payment/invoice/subscription/credit contracts in paise with stable operation IDs.
2. Accept Denzil’s synthetic import dry-run, validate opening balances and reject invalid rows.
3. Create reviewed migrations and constraints without running feature-branch migrations on shared production.
4. Publish response fixtures for Paul and admin views for Denzil.

**Deliver and verify:** Reviewed commerce schema, import error report, reconciled opening totals and API fixtures.

**Required review:** Mathew for critical logic; Devadathan for client/platform. No self-approval of critical changes.

**Handoff:** Publish authoritative commerce responses/state examples to Devadathan/Paul/Denzil; give reconciled totals and provider event references to Mathew/Tinu. Request finance/warehouse approval.

**Traceability:** P1-E2-001. Requirements: R01, R02, R05, R07, R09, R26, R31, R33. Outputs: P1-O03.

<details>
<summary>Retained technical specification: P1-E2-001 — Establish commerce schema, opening imports and ledger contracts</summary>

Define SKU/variant/concern, prices/tax basis, stock locations/batches, cart, order, reservation, payment/refund ledger and invoice-series foundations. Include quantity/version checks, currency, provider/business references and unique idempotency keys. Prepare schema contracts for subscriptions, bundles, distributor pricing and loyalty/referral reversals so Phase 2 does not replace core IDs. Import/validate opening catalogue and batch balances with row-level error reports; reject invalid expiry, price, duplicate SKU and location references.

**Acceptance inherited:** Validated seed/import artifacts reconcile to company opening totals; unsafe data is reported rather than silently corrected.

**Evidence inherited:** Schema/migration review, invalid import fixtures, balance reconciliation and foreign-key/unique/check-constraint tests.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P1-JOS-002 — Authoritative pricing and atomic FEFO checkout

**Allocated time:** 5 hours (implementation / QA preparation). **Branch:** `feature/p1-josin-fefo-checkout` → `dev`.

**Inputs and integration handoffs:** P1-JOS-001, P1-MAT-001. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Recompute price, tax, quantity and consult-only eligibility server-side.
2. Reserve eligible FEFO batches using deterministic locks and checked guards.
3. Commit order/reservation/outbox together; roll back every partial failure.
4. Cover last-unit races, stale carts, recalled/expired batches and retry bounds.

**Deliver and verify:** Mathew-reviewed checkout and persisted stock/order/outbox invariant evidence.

**Required review:** Mathew for critical logic; Devadathan for client/platform. No self-approval of critical changes.

**Handoff:** Publish authoritative commerce responses/state examples to Devadathan/Paul/Denzil; give reconciled totals and provider event references to Mathew/Tinu. Request finance/warehouse approval.

**Traceability:** P1-E2-002. Requirements: R01, R02, R05, R26. Outputs: P1-O04.

<details>
<summary>Retained technical specification: P1-E2-002 — Implement authoritative cart pricing and atomic FEFO reservations</summary>

Build cart/pricing APIs that recompute current prices, quantities, taxes and consult-only eligibility from authoritative state. Lock relevant availability/batch rows in deterministic order and reserve eligible FEFO stock with order/hold/outbox atomically. Enforce nonnegative available balance, expiry/shelf-life/recall exclusion and all-or-nothing multi-item reservation. Use guarded updates with checked row counts, bounded conflict retries and current-version confirmation. Public cached stock never authorizes a purchase.

**Acceptance inherited:** Last-unit and stale-cart races preserve stock; shortage rolls back the whole order/reservation/outbox; client totals are ignored.

**Evidence inherited:** Race/property fixtures, rollback after a failed guard, expired/recalled batch cases and persisted control totals.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P1-JOS-003 — Payments, signed events and refund foundation

**Allocated time:** 5 hours (implementation / QA preparation). **Branch:** `feature/p1-josin-payment-ledger` → `dev`.

**Inputs and integration handoffs:** P1-JOS-002, P1-MAT-002. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Use Razorpay sandbox with stable business references and no network call inside a database transaction.
2. Verify raw-body signatures, provider account, amount/currency and expected reference.
3. Durably deduplicate webhooks, reconcile ambiguous results and reject browser-paid claims.
4. Link order/booking ledgers and define cancellation/refund and real mandate hooks.

**Deliver and verify:** Signed webhook test matrix, one-effect ledger proof and Mathew’s approval.

**Required review:** Mathew for critical logic; Devadathan for client/platform. No self-approval of critical changes.

**Handoff:** Publish authoritative commerce responses/state examples to Devadathan/Paul/Denzil; give reconciled totals and provider event references to Mathew/Tinu. Request finance/warehouse approval.

**Traceability:** P1-E2-003. Requirements: R02, R07, R09, R12. Outputs: P1-O04, P1-O05.

<details>
<summary>Retained technical specification: P1-E2-003 — Integrate payment creation, signed webhooks and idempotent state transitions</summary>

Create provider checkout outside the reservation transaction using stable business references. Verify webhook signatures against raw payload, provider account, amount/currency and expected reference; durably record receipt before acknowledgement. Deduplicate events and handle out-of-order/ambiguous outcomes. Confirm paid order or booking with ledgers/outbox in a short transaction. Build cancellation/refund state-machine foundations and provider reconciliation interfaces; define recurring mandate hooks needed in Phase 2. COD uses a separate policy/state path.

**Acceptance inherited:** Real sandbox success/failure/cancel and duplicate events produce one authorized financial effect; browser callbacks cannot mark paid; lost provider responses enter reconciliation.

**Evidence inherited:** Signed/invalid/replayed/mismatched webhook tests, uncertain-result simulation, booking link and ledger/outbox records.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P1-JOS-004 — Order/account/staff APIs and client integration

**Allocated time:** 3 hours (implementation / QA preparation). **Branch:** `feature/p1-josin-orders-core-api` → `dev`.

**Inputs and integration handoffs:** P1-JOS-001, P1-JOS-003. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Expose owner-only history/detail and staff order/batch APIs with safe pagination.
2. Define shipping, invoice, return and source-audit contracts.
3. Pair with Paul on web/native success/pending/failed states and with Mathew on booking payments.
4. Compare persisted amounts/statuses to visible confirmations.

**Deliver and verify:** Usable purchase slice across clients and access-negative/reconciliation evidence.

**Required review:** Mathew for critical logic; Devadathan for client/platform. No self-approval of critical changes.

**Handoff:** Publish authoritative commerce responses/state examples to Devadathan/Paul/Denzil; give reconciled totals and provider event references to Mathew/Tinu. Request finance/warehouse approval.

**Traceability:** P1-E2-004. Requirements: R03, R04, R05, R06, R07. Outputs: P1-O04, P1-O06.

<details>
<summary>Retained technical specification: P1-E2-004 — Deliver authorized order visibility, operations APIs and core integration</summary>

Expose owner-scoped order summary/detail and minimal staff order/stock views with safe pagination and source fields. Define shipping/tracking/invoice/export/return contracts and staff order-source audit required by Phase 2. Integrate web/native checkout and order/booking confirmation against shared fixtures. Add traceable state errors and safe restart/reconciliation behavior. Review availability/booking coupling with Mathew and publish event schemas for Mathew with Denzil’s content support messages.

**Acceptance inherited:** The purchase slice is usable from real clients and persisted state matches visible order/payment status; missing ownership or stale state is rejected.

**Evidence inherited:** Web/native contract results, order-ID access negatives, persisted order/stock/ledger reconciliation and event samples.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P1-JOS-090 — G1 verification and cumulative regression

**Allocated time:** 4 hours (verification). **Branch:** `test/p1-josin-g1-verification` → `dev`.

Merge necessary test-code changes before freeze; run results belong in the evidence store. Do not invalidate the frozen candidate with an evidence-only application change.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Execute stock/price/payment/mandate/courier/tax/credit/referral/reconciliation cases with finance fixtures. Supply read-only persisted control totals and provider references; independently retest senior-reviewed financial fixes.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Mathew for critical logic; Devadathan for client/platform. No self-approval of critical changes.

**Handoff:** Publish authoritative commerce responses/state examples to Devadathan/Paul/Denzil; give reconciled totals and provider event references to Mathew/Tinu. Request finance/warehouse approval.

**Traceability:** P1-E2-090. Requirements: R01, R02, R03, R04, R05, R07, R09, R12. Outputs: P1-O09.

### P1-JOS-080 — Environment, acceptance and handover support

**Allocated time:** 1 hours (environment / handover). **Branch:** `chore/p1-josin-readiness-handover` → `dev`.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Prepare commerce readiness and final finance/warehouse training; obtain signed rules/opening balances and minimal authorized live payment/refund/mandate/courier acceptance. Hand over reconciliation and financial incident ownership.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Mathew for critical logic; Devadathan for client/platform. No self-approval of critical changes.

**Handoff:** Publish authoritative commerce responses/state examples to Devadathan/Paul/Denzil; give reconciled totals and provider event references to Mathew/Tinu. Request finance/warehouse approval.

**Traceability:** Named support package; retain parent phase outputs. Requirements: . Outputs: .

### P1-JOS-099 — Protected defect/retest reserve

**Allocated time:** 2 hours (conditional reserve). **Branch:** `fix/p1-josin-bug-001` → `dev`.

Create this branch only if a matching defect actually exists; the suffix shown is an example. Test execution alone does not require a code branch.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Use only against an actual tracked defect; replace bug-001 with the real issue ID. Reproduce, contain and route to the correct owner; independently retest a reviewed fix on a new candidate. Tinu uses this for triage/retesting, not critical feature coding. Paul/Denzil fix only bounded UI/content defects. If unused, broaden verification/handover; do not add scope or count the reserve as guaranteed repair capacity.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Mathew for critical logic; Devadathan for client/platform. No self-approval of critical changes.

**Handoff:** Publish authoritative commerce responses/state examples to Devadathan/Paul/Denzil; give reconciled totals and provider event references to Mathew/Tinu. Request finance/warehouse approval.

**Traceability:** P1-E2-099. Requirements: R36, R38. Outputs: P1-O09.

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

- D4: fulfillment/tax/returns/recall/transfers and actual mandate enrollment/renewal.
- D5: complete bundle/wholesale/loyalty/referral ledger and report/source contracts.
- D6 morning: unified order desk and reconciliation, reviewed cumulative fixes. Final four hours: G2 commerce regression.

The checkpoints order work; they do not add hours beyond the phase budget. G1/G2 verification must include the protected four-hour final-half-day allocation. Phase 3 specialist campaigns may run in parallel, with a named operator and safe provider controls.

**Daily capacity aligned to the phase plan**

| Working day | B: implementation / QA prep | V: verification | E: environment / handover | C: reserve | Total |
|---|---:|---:|---:|---:|---:|
| Day 4 | 8 | 0 | 0 | 0 | 8 |
| Day 5 | 8 | 0 | 0 | 0 | 8 |
| Day 6 | 2 | 4 | 0 | 2 | 8 |

B/V/E/C are daily capacity slices, not new tasks. Review/meetings count within these hours. Follow this member’s package sequence and handoff contracts; do not double-book tasks. Reserve is conditional and otherwise supports verification/handover. On the final day, schedule four V hours in the protected final half-day for everyone; Tinu also has two earlier V hours. Background test runtime is not extra staffed capacity; record actual operator/reviewer time.

**Named test execution/support groups:** P2-T03, P2-T04, P2-T05, P2-T06, P2-T07, P2-T09, P2-T11, P2-T16, P2-T22, P2-T24, P2-T25, P2-T26, P2-T27, P2-T28, P2-T29, P2-T31, P2-T33, P2-T34, P2-T35. The detailed procedures are in Tinu’s annex. These are minimum named duties; also help with impacted cumulative regression and the shared gate. Tinu coordinates execution rather than replacing the listed specialist/domain operator.

**Entry and dependencies:** G1 must pass first. Build on accepted contracts and reviewed components; keep Phase 1 critical tests running. Complete actual features by G2; track pending public approvals explicitly for Phase 3.

| Package | Hours | Branch from `dev`; PR to `dev` |
|---|---:|---|
| P2-JOS-001 — Fulfillment, returns, batches and GST | 4 | `feature/p2-josin-fulfillment-gst` |
| P2-JOS-002 — Real recurring subscriptions and renewals | 4 | `feature/p2-josin-mandate-subscriptions` |
| P2-JOS-003 — Bundles, distributor terms, loyalty and referrals | 6 | `feature/p2-josin-bundles-wholesale-credits` |
| P2-JOS-004 — Unified orders, reconciliation and report facts | 4 | `feature/p2-josin-orderdesk-report-facts` |
| P2-JOS-090 — G2 verification and cumulative regression | 4 | `test/p2-josin-g2-verification` |
| P2-JOS-099 — Protected defect/retest reserve | 2 | `fix/p2-josin-bug-001` |

### P2-JOS-001 — Fulfillment, returns, batches and GST

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p2-josin-fulfillment-gst` → `dev`.

**Inputs and integration handoffs:** P2-MAT-001, P2-DEV-003. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Finish serviceability/rates/labels/pickup/tracking/COD through idempotent courier adapters.
2. Complete pack/ship/cancel/return/refund, expiry/recall and dispatched/received batch transfers.
3. Generate finance-approved GST series/invoices/credit notes and escaped exports.
4. Reconcile finance/warehouse fixtures and verify uncertain courier responses before retry.
5. C05 — After the finance-approved issuance milestone, create a durable idempotent invoice-ready delivery obligation and send the customer an approved private/scoped invoice link or document through the permitted transactional channel. Generated PDF alone is not delivery evidence. Verify receipt, one effective delivery/reconciliation, retries, expiry/ownership and customer history; no public invoice URL or marketing-consent shortcut. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Reviewed fulfillment/tax/recall/transfer flows and reconciled documents.

**Required review:** Mathew for critical logic; Devadathan for client/platform. No self-approval of critical changes.

**Handoff:** Publish authoritative commerce responses/state examples to Devadathan/Paul/Denzil; give reconciled totals and provider event references to Mathew/Tinu. Request finance/warehouse approval.

**Traceability:** P2-E2-001. Requirements: R03, R04, R05, R06, R07, R08, R32. Outputs: P2-O01.

<details>
<summary>Retained technical specification: P2-E2-001 — Complete fulfillment, returns, batch operations and GST billing</summary>

Adapt tested shipping/tax/warehouse modules: pincode/rate eligibility, label/pickup/tracking events, packing/cancellation/return/refund flows and COD settlement. Complete low/near-expiry alerts, adjustments, recall batch-to-customer lookup, quarantine returns and two-location batch-preserving transfers. Generate finance-approved CGST/SGST/IGST invoices, unique series/period numbers, translated labels, PDF/credit notes and monthly export. Record provider unknown states for reconciliation; do not double-create shipments. Review clarification C05: After the finance-approved issuance milestone, create a durable idempotent invoice-ready delivery obligation and send the customer an approved private/scoped invoice link or document through the permitted transactional channel. Generated PDF alone is not delivery evidence. Verify receipt, one effective delivery/reconciliation, retries, expiry/ownership and customer history; no public invoice URL or marketing-consent shortcut.

**Acceptance inherited:** Unserviceable/expired/recalled stock cannot ship; tax and credit-note fixtures reconcile; transfer/return/COD records preserve physical and financial balances.

**Evidence inherited:** Courier contract flow, tax/rounding/series tests, recall/return/transfer cases and finance/warehouse control totals.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P2-JOS-002 — Real recurring subscriptions and renewals

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p2-josin-mandate-subscriptions` → `dev`.

**Inputs and integration handoffs:** P2-MAT-005, P2-DEV-003. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Use actual eligible provider sandbox mandates, enrollment and accelerated renewal proof.
2. Create one renewal effect per operation; retain mandate/payment/stock histories.
3. Implement pause/resume/cancel, failure/shortage and recovery without unauthorized retry.
4. Never present a periodic reminder as a completed subscription implementation.

**Deliver and verify:** Mandate and renewal evidence, no duplicate charge/order, Mathew approval.

**Required review:** Mathew for critical logic; Devadathan for client/platform. No self-approval of critical changes.

**Handoff:** Publish authoritative commerce responses/state examples to Devadathan/Paul/Denzil; give reconciled totals and provider event references to Mathew/Tinu. Request finance/warehouse approval.

**Traceability:** P2-E2-002. Requirements: R09, R10. Outputs: P2-O01.

<details>
<summary>Retained technical specification: P2-E2-002 — Complete recurring mandates, renewal orders and failure recovery</summary>

Implement provider-confirmed enrollment, mandate/payment references, renewal events, exactly one business renewal order, stock allocation, amount/tax policy and notices. Support failed payment, stock shortage, pause/resume/cancel and provider reconciliation; customer UI and staff state must agree. Accelerate a sandbox cycle without pretending it proves live eligibility. Do not represent an app calendar reminder as automatic recurring debit or repeat a mandate charge after an ambiguous response.

**Acceptance inherited:** Enrollment/renewal/failure/cancellation and duplicate/out-of-order events produce one authorized order/financial effect and correct subsequent schedules.

**Evidence inherited:** Sandbox cycle and available minimal live eligibility evidence, renewal shortage/duplicate tests, pause/cancel suppression and ledger reconciliation.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P2-JOS-003 — Bundles, distributor terms, loyalty and referrals

**Allocated time:** 6 hours (implementation / QA preparation). **Branch:** `feature/p2-josin-bundles-wholesale-credits` → `dev`.

**Inputs and integration handoffs:** P2-MAT-005. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Implement bundle/course pricing/tax allocation and consult-only/stock restrictions.
2. Enforce distributor approval, assigned price, MOQ/pack/payment terms and audit.
3. Implement append-only credit/referral ledger, eligibility/caps, self-abuse controls and refund/return reversal.
4. Expose safe retail/customer APIs for Paul’s UI; Mathew reviews every financial transition.
5. Enforce seasonal promotion start/end times and global/per-customer redemption caps server-side, including concurrent redemption and current cross-channel pricing; publish the contract to Denzil for the landing page.

**Deliver and verify:** Finance-approved boundary fixtures, ledger totals and cross-channel price parity.

**Required review:** Mathew for critical logic; Devadathan for client/platform. No self-approval of critical changes.

**Handoff:** Publish authoritative commerce responses/state examples to Devadathan/Paul/Denzil; give reconciled totals and provider event references to Mathew/Tinu. Request finance/warehouse approval.

**Traceability:** P2-E2-003. Requirements: R26, R28, R31, R33. Outputs: P2-O01, P2-O05.

<details>
<summary>Retained technical specification: P2-E2-003 — Complete bundles, wholesale, loyalty and referral financial rules</summary>

Adapt tested bundle/course discount allocation, distributor approval/price-list/MOQ/pack/payment-term rules and loyalty/referral ledgers. Enforce the same price/eligibility/tax/consult-only checks across channels. Implement credit source references, earning/redemption caps, eligible first-order awards, self-referral/basic abuse checks and refund/return reversals. Preserve audit of account approvals and commercial terms; clients cannot choose a distributor role or create credit.

**Acceptance inherited:** Bundle totals and tax allocations are stable, unauthorized wholesale terms fail, and credits cannot be duplicated or retained after a reversing event.

**Evidence inherited:** Retail/distributor/MOQ/terms tests, bundle stock/clinical restrictions, self-abuse/duplicate/refund credit scenarios and ledger totals.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P2-JOS-004 — Unified orders, reconciliation and report facts

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p2-josin-orderdesk-report-facts` → `dev`.

**Inputs and integration handoffs:** P2-JOS-001, P2-JOS-002, P2-JOS-003. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Complete staff phone/walk-in/WhatsApp orders on the same authoritative state machine.
2. Record source attribution and reconcile provider/order/payment/refund/stock/job balances.
3. Provide authorized report APIs for product/concern/city/clinic, retention/refills/subscriptions and conversion.
4. Validate replay/refund effects and freshness before Denzil builds presentation.
5. Implement verified-completed-buyer review eligibility and authorized moderation/publication endpoints; coordinate approved physician product notes with Mathew and Denzil. A frontend badge is not eligibility proof.
6. C04 — Authorized front desk creates an in-clinic outpatient appointment in the same canonical booking lifecycle with source/staff actor and correct clinic fee/payment/refund state; use the same global doctor overlap constraints. It cannot be confused with a walk-in product order. Assigned physicians see policy-permitted past purchases in the linked patient view; unassigned/revoked/cross-patient/clinic access remains denied. Doctor management also includes approved qualifications/photo, slot length and online/in-clinic/both availability settings; front-desk operational readiness is demonstrated before public launch. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.
7. C05 — After the finance-approved issuance milestone, create a durable idempotent invoice-ready delivery obligation and send the customer an approved private/scoped invoice link or document through the permitted transactional channel. Generated PDF alone is not delivery evidence. Verify receipt, one effective delivery/reconciliation, retries, expiry/ownership and customer history; no public invoice URL or marketing-consent shortcut. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.
8. C06 — Demonstrate all three approved campaign types: new product, restock and seasonal offer. Build consented prior-purchase segments from authorized commerce facts, with preview/counts, quotas, quiet hours, current opt-out and deduplicated attribution. No raw clinical notes or inferred health-interest audience without explicit business/privacy approval; live sending uses company-controlled approved recipients. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Unified order desk APIs, control-total report and defined report formulas.

**Required review:** Mathew for critical logic; Devadathan for client/platform. No self-approval of critical changes.

**Handoff:** Publish authoritative commerce responses/state examples to Devadathan/Paul/Denzil; give reconciled totals and provider event references to Mathew/Tinu. Request finance/warehouse approval.

**Traceability:** P2-E2-004. Requirements: R03, R04, R07, R08, R11, R12, R14, R27, R28, R29, R30, R35, R38. Outputs: P2-O01, P2-O05, P2-O07.

<details>
<summary>Retained technical specification: P2-E2-004 — Complete unified order desk, reconciliation and report sources</summary>

Finish staff phone/walk-in/WhatsApp source-aware order operations, permissioned customer history/current-price reorder and delivery state. Publish idempotent facts for sales/concern/city/clinic, repeat/refill/subscription and clinical/chat conversion summaries. Add purchase-suppression/verified-review eligibility signals. Run payment/refund/shipment/mandate reconciliation and CSV escaping/exports; reject spreadsheet-formula payloads in exported user text. Reconcile reports and opening balances with Devadathan with Paul/Denzil/Mathew with Denzil’s content support.

**Acceptance inherited:** All source channels share one order/ledger truth; no stale cart recovery after purchase; report/control totals match known fixtures without broad unbounded queries.

**Evidence inherited:** Staff source flows, reorder restrictions, summary rebuild/replay, safe export and provider-to-ledger comparison.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P2-JOS-090 — G2 verification and cumulative regression

**Allocated time:** 4 hours (verification). **Branch:** `test/p2-josin-g2-verification` → `dev`.

Merge necessary test-code changes before freeze; run results belong in the evidence store. Do not invalidate the frozen candidate with an evidence-only application change.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Execute stock/price/payment/mandate/courier/tax/credit/referral/reconciliation cases with finance fixtures. Supply read-only persisted control totals and provider references; independently retest senior-reviewed financial fixes.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Mathew for critical logic; Devadathan for client/platform. No self-approval of critical changes.

**Handoff:** Publish authoritative commerce responses/state examples to Devadathan/Paul/Denzil; give reconciled totals and provider event references to Mathew/Tinu. Request finance/warehouse approval.

**Traceability:** P2-E2-090. Requirements: R01, R02, R03, R04, R05, R06, R07, R09, R26, R31, R33, R35. Outputs: P2-O07.

### P2-JOS-099 — Protected defect/retest reserve

**Allocated time:** 2 hours (conditional reserve). **Branch:** `fix/p2-josin-bug-001` → `dev`.

Create this branch only if a matching defect actually exists; the suffix shown is an example. Test execution alone does not require a code branch.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Use only against an actual tracked defect; replace bug-001 with the real issue ID. Reproduce, contain and route to the correct owner; independently retest a reviewed fix on a new candidate. Tinu uses this for triage/retesting, not critical feature coding. Paul/Denzil fix only bounded UI/content defects. If unused, broaden verification/handover; do not add scope or count the reserve as guaranteed repair capacity.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Mathew for critical logic; Devadathan for client/platform. No self-approval of critical changes.

**Handoff:** Publish authoritative commerce responses/state examples to Devadathan/Paul/Denzil; give reconciled totals and provider event references to Mathew/Tinu. Request finance/warehouse approval.

**Traceability:** P2-E2-099. Requirements: R36, R38. Outputs: P2-O07.

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

- D7: paid-candidate finance/stock/provider/mandate verification and finance UAT preparation.
- D8: operate domain race/reconciliation checks with senior support; compare restore/provider control totals.
- D9: independently retest financial corrections, finish warehouse/finance training and signed opening balances.
- D10: authorized minimal live money/fulfillment checks, reconciliation and finance handover after Go.

The checkpoints order work; they do not add hours beyond the phase budget. G1/G2 verification must include the protected four-hour final-half-day allocation. Phase 3 specialist campaigns may run in parallel, with a named operator and safe provider controls.

**Daily capacity aligned to the phase plan**

| Working day | B: implementation / QA prep | V: verification | E: environment / handover | C: reserve | Total |
|---|---:|---:|---:|---:|---:|
| Day 7 | 3 | 4 | 0 | 1 | 8 |
| Day 8 | 2 | 4 | 0 | 2 | 8 |
| Day 9 | 2 | 3 | 2 | 1 | 8 |
| Day 10 | 0 | 1 | 4 | 3 | 8 |

B/V/E/C are daily capacity slices, not new tasks. Review/meetings count within these hours. Follow this member’s package sequence and handoff contracts; do not double-book tasks. Reserve is conditional and otherwise supports verification/handover. Background test runtime is not extra staffed capacity; record actual operator/reviewer time.

**Named test execution/support groups:** P3-T04, P3-T05, P3-T06, P3-T07, P3-T15, P3-T17, P3-T19, P3-T20, P3-T22, P3-T23, P3-T24, P3-T25, P3-T26, P3-T27, P3-T30. The detailed procedures are in Tinu’s annex. These are minimum named duties; also help with impacted cumulative regression and the shared gate. Tinu coordinates execution rather than replacing the listed specialist/domain operator.

**Entry and dependencies:** G2 complete-feature candidate and paid readiness must pass first. Use production-equivalent paid settings, pinned artifacts and realistic synthetic retained data. Every relevant code/config/model/KB change invalidates affected evidence.

| Package | Hours | Branch from `dev`; PR to `dev` |
|---|---:|---|
| P3-JOS-001 — Resolve verified commerce edge cases | 4 | `feature/p3-josin-commerce-hardening` |
| P3-JOS-002 — Finance/provider recovery and reconciliation | 3 | `feature/p3-josin-recovery-control-totals` |
| P3-JOS-090 — G3 verification and cumulative regression | 12 | `test/p3-josin-g3-verification` |
| P3-JOS-080 — Environment, acceptance and handover support | 6 | `chore/p3-josin-readiness-handover` |
| P3-JOS-099 — Protected defect/retest reserve | 7 | `fix/p3-josin-bug-001` |

### P3-JOS-001 — Resolve verified commerce edge cases

**Allocated time:** 4 hours (implementation / QA preparation). **Branch:** `feature/p3-josin-commerce-hardening` → `dev`.

**Inputs and integration handoffs:** P3-MAT-002, P3-DEV-001. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Fix confirmed money/stock/fulfillment/subscription/credit/wholesale defects.
2. Check tax, numbering, reversal, shortage and eligibility boundaries against approved fixtures.
3. Keep transaction operations short and fully reviewed by Mathew.
4. Independently reproduce fixed races and reconcile final balances.

**Deliver and verify:** Reviewed financial fixes and zero unexplained control-total differences.

**Required review:** Mathew for critical logic; Devadathan for client/platform. No self-approval of critical changes.

**Handoff:** Publish authoritative commerce responses/state examples to Devadathan/Paul/Denzil; give reconciled totals and provider event references to Mathew/Tinu. Request finance/warehouse approval.

**Traceability:** P3-E2-001. Requirements: R02, R04, R05, R06, R07, R09, R26, R31, R33. Outputs: P3-O02, P3-O03.

<details>
<summary>Retained technical specification: P3-E2-001 — Harden financial, inventory and operational edge cases</summary>

Recheck server-side pricing/tax rounding, FEFO/expiry/recall, provider references, invoice series, refunds/returns/COD, renewal shortages, distributor terms and credit reversals on paid configuration. Fix only demonstrated defects and profile slow/contended queries; retain consistent lock order and current price/clinical eligibility. Update migrations/tests with independent review; reconcile visible UI and durable ledger state.

**Acceptance inherited:** Known financial/warehouse/credit edge cases preserve balances and no performance fix weakens eligibility, stock or audit.

**Evidence inherited:** Reviewed hardening changes, tax/ledger/stock comparison and targeted concurrent tests.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P3-JOS-002 — Finance/provider recovery and reconciliation

**Allocated time:** 3 hours (implementation / QA preparation). **Branch:** `feature/p3-josin-recovery-control-totals` → `dev`.

**Inputs and integration handoffs:** P3-DEV-001, P3-MAT-002. Coordinate contracts/fixtures early with these owners; mutual references describe a shared interface, not a requirement to wait for each other’s whole package. UI may begin against reviewed fixtures, but cannot be accepted until its real API/adapter integration passes. Any unresolved interface/readiness issue goes to Mathew/Devadathan that day.

**Actions and boundaries**

1. Build/finish read-only reconciliation checks and approved replay guards.
2. Compare provider states and restored orders/payments/refunds/stock/credits/jobs.
3. Resolve ambiguous payment/renewal/ship results by stable operation ID, never blind retry.
4. Prepare final finance/warehouse acceptance evidence with company owners.
5. C05 — After the finance-approved issuance milestone, create a durable idempotent invoice-ready delivery obligation and send the customer an approved private/scoped invoice link or document through the permitted transactional channel. Generated PDF alone is not delivery evidence. Verify receipt, one effective delivery/reconciliation, retries, expiry/ownership and customer history; no public invoice URL or marketing-consent shortcut. Apply only your role’s portion; coordinate the other named owners and keep junior support bounded.

**Deliver and verify:** Rehearsed reconciliation, restore control totals and finance acceptance pack.

**Required review:** Mathew for critical logic; Devadathan for client/platform. No self-approval of critical changes.

**Handoff:** Publish authoritative commerce responses/state examples to Devadathan/Paul/Denzil; give reconciled totals and provider event references to Mathew/Tinu. Request finance/warehouse approval.

**Traceability:** P3-E2-002. Requirements: R02, R06, R07, R08, R09, R12, R31, R35, R38. Outputs: P3-O03, P3-O04, P3-O05.

<details>
<summary>Retained technical specification: P3-E2-002 — Verify provider reconciliation and restore/replay safety</summary>

Exercise delayed/out-of-order/missing events, lost provider responses, duplicate refunds/renewals/labels and database cutover. Compare provider charge/refund/mandate/shipment status to restored order/ledger/batch/booking totals. Complete minimal company-authorized live charge/refund proof and COD accounting readiness without bulk production traffic. Verify report rebuilding and credit reversals after replay; publish finance recovery guidance.

**Acceptance inherited:** No replay duplicates a financial/stock effect; ambiguous outcomes resolve to recorded obligations and reports reconcile after restore.

**Evidence inherited:** Provider-to-ledger comparison, controlled live references, restore checkpoint/control totals and finance runbook.

</details>

Where a retained specification spans client/backend/content work, own only this named package’s actions; use the named team handoff table for the other portions. Repeated references describe shared integration, not duplicate hours or competing ownership.

### P3-JOS-090 — G3 verification and cumulative regression

**Allocated time:** 12 hours (verification). **Branch:** `test/p3-josin-g3-verification` → `dev`.

Merge necessary test-code changes before freeze; run results belong in the evidence store. Do not invalidate the frozen candidate with an evidence-only application change.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Execute stock/price/payment/mandate/courier/tax/credit/referral/reconciliation cases with finance fixtures. Supply read-only persisted control totals and provider references; independently retest senior-reviewed financial fixes.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Mathew for critical logic; Devadathan for client/platform. No self-approval of critical changes.

**Handoff:** Publish authoritative commerce responses/state examples to Devadathan/Paul/Denzil; give reconciled totals and provider event references to Mathew/Tinu. Request finance/warehouse approval.

**Traceability:** P3-E2-090. Requirements: R01, R02, R03, R04, R05, R06, R07, R09, R12, R26, R31, R33, R35, R38. Outputs: P3-O07.

### P3-JOS-080 — Environment, acceptance and handover support

**Allocated time:** 6 hours (environment / handover). **Branch:** `chore/p3-josin-readiness-handover` → `dev`.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Prepare commerce readiness and final finance/warehouse training; obtain signed rules/opening balances and minimal authorized live payment/refund/mandate/courier acceptance. Hand over reconciliation and financial incident ownership.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Mathew for critical logic; Devadathan for client/platform. No self-approval of critical changes.

**Handoff:** Publish authoritative commerce responses/state examples to Devadathan/Paul/Denzil; give reconciled totals and provider event references to Mathew/Tinu. Request finance/warehouse approval.

**Traceability:** P3-E2-080. Requirements: R25, R36, R37, R38. Outputs: P3-O05, P3-O06, P3-O07.

### P3-JOS-099 — Protected defect/retest reserve

**Allocated time:** 7 hours (conditional reserve). **Branch:** `fix/p3-josin-bug-001` → `dev`.

Create this branch only if a matching defect actually exists; the suffix shown is an example. Test execution alone does not require a code branch.

**Inputs:** reviewed current phase packages, ready isolated fixtures and the exact-candidate manifest. Environment/handover work also depends on the named company/provider owners; reserve is activated only for an actual finding.

**Actions and boundaries**

1. Use only against an actual tracked defect; replace bug-001 with the real issue ID. Reproduce, contain and route to the correct owner; independently retest a reviewed fix on a new candidate. Tinu uses this for triage/retesting, not critical feature coding. Paul/Denzil fix only bounded UI/content defects. If unused, broaden verification/handover; do not add scope or count the reserve as guaranteed repair capacity.

**Deliver and verify:** Execution/evidence register, issue/PR/candidate links and independent review; actual results, not planned passes.

**Required review:** Mathew for critical logic; Devadathan for client/platform. No self-approval of critical changes.

**Handoff:** Publish authoritative commerce responses/state examples to Devadathan/Paul/Denzil; give reconciled totals and provider event references to Mathew/Tinu. Request finance/warehouse approval.

**Traceability:** P3-E2-099. Requirements: R36, R38. Outputs: P3-O07.

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
| P1-E2-001 — Establish commerce schema, opening imports and ledger contracts | P1-JOS-001 |
| P1-E2-002 — Implement authoritative cart pricing and atomic FEFO reservations | P1-JOS-002 |
| P1-E2-003 — Integrate payment creation, signed webhooks and idempotent state transitions | P1-JOS-003 |
| P1-E2-004 — Deliver authorized order visibility, operations APIs and core integration | P1-JOS-004 |
| P1-E2-090 — Commerce/financial cumulative verification | P1-JOS-090 |
| P1-E2-099 — Protected defect/retest contingency | P1-JOS-099 |
| P2-E2-001 — Complete fulfillment, returns, batch operations and GST billing | P2-JOS-001 |
| P2-E2-002 — Complete recurring mandates, renewal orders and failure recovery | P2-JOS-002 |
| P2-E2-003 — Complete bundles, wholesale, loyalty and referral financial rules | P2-JOS-003 |
| P2-E2-004 — Complete unified order desk, reconciliation and report sources | P2-JOS-004 |
| P2-E2-090 — Full commerce/ledger/provider verification | P2-JOS-090 |
| P2-E2-099 — Protected defect/retest contingency | P2-JOS-099 |
| P3-E2-001 — Harden financial, inventory and operational edge cases | P3-JOS-001 |
| P3-E2-002 — Verify provider reconciliation and restore/replay safety | P3-JOS-002 |
| P3-E2-080 — Lead finance/warehouse acceptance, training and live reconciliation | P3-JOS-080 |
| P3-E2-090 — Final finance/inventory/provider/capacity/recovery verification | P3-JOS-090 |
| P3-E2-099 — Protected defect/retest contingency | P3-JOS-099 |

## Test-case handoff

Use [Tinu’s standalone detailed test cases](Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) for all 86 phase groups and 38 requirement walkthroughs, shared synthetic fixtures, action/expected-result pairs and evidence rules. Execute your domain cases with Tinu; do not wait until the phase-end campaign to begin testing. Source phase specifications retain their additional matrices and acceptance criteria.

## Final personal completion record

Record package/PR, candidate/build IDs, requirement/output IDs, reviewer and domain approval, test runs/defects/retests, actual public-channel status, training/handover links and remaining approved low-risk issues. Leave unexecuted work Pending/Blocked. Final completion requires G3, all R01–R38 acceptance, public required channels and company ownership/support handover.
