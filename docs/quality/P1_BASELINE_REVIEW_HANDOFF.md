# Phase 1 baseline review handoff

**Date:** 2026-10-24. **Scope:** independent QA preparation/source inspection by
the nested Tinu baseline analyst, not approval of a current PR or a frozen G1
candidate. Owners are implementing fixes concurrently; findings must be reconciled
against the newly published candidate. Final independent review remains with a
different reviewer after publication. No company acceptance or Jira transition
is implied.

## Exact inspected revisions

| Source | Fixed revision |
|---|---|
| Merged baseline including PR #8 | `e5161d76218136021c1f70e77f1a62f73e6a34b7` |
| PR #5 inspected head | `a8f5a58c72edf9b6af96595649bcddb6f84df4b3` |
| PR #6 inspected head | `d02b07e7a995c7255c2b7596da5475de8bfff6ad` |
| PR #7 inspected head | `f1b15de38184c960a5acbc8ec5775a86145ab811` |
| PR #9 inspected head | `3825c0003cb7f56911ff530dc770e73453167a13` |

Other candidates were inspected read-only via Git objects, not checked out over
owner work. Prior-head findings below are not assertions about uncommitted owner
fixes or the eventual integrated candidate.

## Findings for owners

### Shared knowledge contracts need explicit integration

At PR #6, `packages/client/src/sensitive.ts:2–15` consumes the knowledge contracts
defined in `packages/contracts/src/knowledge.ts:35–106`. PR #9 defines different
exports/record shapes in that same file at `:38–74`. Replacing either file with the
other unchanged loses a consumer contract. Mathew and Devadathan must reconcile
names, endpoint DTOs and adapters, typecheck all consumers and execute integrated
authorization/freshness tests. This is an integration blocker, not a reason to
discard one owner's changes or reduce the medical source requirements.

### PR #9 public-source URL schema accepts nonpublic hosts

At PR #9, `packages/contracts/src/knowledge.ts:33–36` requires HTTPS and rejects
credentials/query/fragment but does not check public host eligibility. The
analyst's read-only schema probe accepted all these synthetic references:

```text
https://127.0.0.1/private
https://10.0.0.1/private
https://clinic.internal/private
https://localhost/private
```

This demonstrates a **validation gap, not an SSRF exploit**; no URL was fetched.
Mathew/Devadathan should agree the approved public-source policy, reuse it across
server/client contracts and add negative controls for nonpublic hosts. Review
DNS/fetch behavior separately if any implementation retrieves source URLs.

## Acceptance evidence gaps, not new runtime defect claims

- PR #9 `packages/server/src/identity.ts:24–31` defaults to unavailable identity
  dependencies: source alone supplies no real WorkOS/MFA/revocation evidence.
- PR #9 `packages/domain/src/booking/index.ts:81–107` documents future transactional
  requirements and nonpersisted intents. A pure overlap test cannot establish
  PostgreSQL exclusion/CAS/outbox behavior.
- Baseline `packages/server/src/index.ts:112–148` exposes safe not-ready/unavailable
  responses. Passing scaffold 503 tests is not business authorization evidence.

The [QA automation handoff](P1_QA_AUTOMATION.md#evidence-still-required-before-g1)
lists exact remaining domain, company-oracle, hosted-resource, provider, device,
load and recovery evidence. The [canonical register](P1_TEST_RUN_REGISTER.md)
remains Blocked and is not updated from source observations or synthetic checks.

## Reproducible retest handoff

The additive [baseline smoke suite](../../tests/phase1/baseline-smoke.spec.ts)
and [dedicated config](../../playwright.phase1.config.ts) use actual local
workerd/browser requests without mocked routes. They bind only the merged
baseline's scaffold contract; review/rewrite the route expectations before using
them with implemented owner endpoints. Run under the shared lock using
`pnpm test:e2e:phase1:baseline`. Preserve raw runner output as a restricted
artifact with candidate/tree and environment references. A reviewer must inspect
the artifact and the new candidate; this handoff is not a substitute for either.
