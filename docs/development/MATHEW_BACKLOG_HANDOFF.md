# Mathew backlog implementation handoff

## Delivery boundary

These are reviewed-in-session **local implementation candidates**, not completed
business journeys, company approvals or phase acceptance. Default Workers expose
truthful unavailable/blocked states; no real account, booking, clinical advice,
message, payment or durable database operation is simulated. AI-assisted static
review does not replace the named independent human reviews.

| Jira / package | Implemented slice | Enablement still required |
|---|---|---|
| KAN-84 / P1-MAT-001 | Current explicit grants, scoped access, versioned consent, minimal session boundary and canonical UUIDs | Verified WorkOS adapter, approved matrix/consent, authoritative PostgreSQL/RLS and web/native session integration |
| KAN-85 / P1-MAT-002 | Global buffered doctor intervals, leave, hold/payment decisions, canonical customer/front-desk contracts | Real exclusion/CAS/outbox transactions, authenticated APIs, verified payment/refund reconciliation and clinical/operational review |
| KAN-86 / P1-MAT-003 | Independent approval, current-primary safety authorization, immutable citations, public indexing and EN/ML/TA gap reconciliation | Approved content, transactional authority/fences, source rights/object verification, index/provider integration and approved personalized-intake policy |
| KAN-87 / P1-MAT-004 | Raw-byte WhatsApp authentication, receipt-before-ack contract, one-use linking, transcript review and ownership fencing | Durable inbox/outbox adapters, authenticated grants, provider sandbox proof, approved privacy/templates and actual voice processing |
| KAN-189 | Five canonical readiness mappings and regression-enforced traceability | Named member/phase-owner review and reviewed canonical publication; not operational acceptance |
| Local verification repair | Foreground Astro dev/preview, real four-service lifecycle campaign and scanner Git-hook isolation | Independent human review and normal PR/CI integration |

## Next actions, in order

1. **Publish and obtain review.** Local branches/commits are not remotely available
   until publication is authorized. Devadathan reviews identity/platform/security;
   Josin reviews payment/booking contracts; physicians/privacy owners approve
   relevant clinical/content/consent policy. Do not self-approve or bypass checks.
2. **Verify the integrated platform predecessor.** Reviewed P1-DEV-001 / PR #3 is
   merged into `dev` at `cfa4c4821a7db9c39fa27dd2ee0541d71111a741` and included
   in this candidate. Preserve its database driver/migration/transaction framework,
   safe logging and Core Cron/Queue handlers. The HTTP factory retains the actual
   second log-sink and third route-registration options. Explicit environment guards
   run before feature adapters. Do not create a competing database or queue framework.
   Re-run the combined candidate and real PostgreSQL platform suite after integration.
3. **Supply approved inputs securely.** Company role/action matrix, consent versions,
   clinical/intake/escalation and booking/payment rules, physician-approved public
   source/language inventory and provider test access remain required. Use the
   approved secret manager, never Git, Jira comments or frontend bundles.
4. **Implement real adapters and transactions.** Session/current-authority loading,
   consent storage, booking exclusion/CAS/payment obligations, knowledge authority
   fences and inbox/link/ownership/transcript mutations must enforce their contracts
   using real PostgreSQL and current authorization. Dependency-injected synthetic
   positives establish protocols, not authentication, durability, RLS or concurrency.
5. **Run independent integrated acceptance.** Tinu records exact candidate/resource
   variants under the existing canonical P1-T02/T03/T07/T08/T12–T17 groups as
   applicable, with provider and supported native/device evidence. Do not substitute
   aggregate unit-test counts for these campaigns. KAN-180/KAN-188 still require
   their stacked-candidate/Tinu follow-through even after local CORS checks pass.
6. **Close only satisfied work.** Update Jira with exact published source/checks,
   independent review and remaining blockers. Keep unfinished package/requirement
   acceptance open. No production deployment or phase promotion is authorized by
   local foundation verification.

## Verification and detailed contracts

The integrating session runs the unchanged mandatory local security gate plus the
added lifecycle campaign against each frozen candidate. Required commands include
`pnpm verify`, `pnpm test:e2e`, scanner detection/SAST/secrets/runtime/dependency
checks, `pnpm mobile:check`, the repository checker and repository unit tests.
Consult actual command output/commit evidence for results; this handoff is not a
test-run record. Local test servers must be stopped after the campaign.

See [identity](IDENTITY_FOUNDATION.md), [booking](BOOKING_FOUNDATION.md),
[knowledge](KNOWLEDGE_FOUNDATION.md), [channels](CHANNEL_FOUNDATION.md),
[development lifecycle](DEV_SERVER_LIFECYCLE.md),
[canonical tests](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md)
and [native/provider readiness](../operations/NATIVE_READINESS.md).
