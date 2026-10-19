# Git workflow and phase promotion

`main` is the accepted milestone baseline; `dev` is integration. Feature/test/docs/chore branches start from latest `dev` and PR back to `dev`. Exact branch names are in the current phase/member package tables; one owner per bounded branch. This bootstrap uses `docs/project-governance-and-plans`. Avoid isolated branches that only integrate on Day 6.

## PRs and critical review

Protect shared branches from direct/force pushes and unreviewed merges; require actual relevant checks and stale-approval dismissal. Mathew/Devadathan peer-review critical changes; Mathew reviews Josin's sensitive commerce; Devadathan reviews junior UI with clinical/commerce input. Record company approvals separately from code review. No author self-approval. PR body includes R/package/output, before/after, checks with real evidence, migrations/provider/privacy/clinical impact, rollback and dependent owners.

Do not use automatic production deploy on all `main` changes. Required check names must match the actual configured CI; documentation-only success is not an app release check. [Repository settings](../governance/REPOSITORY_SETTINGS.md) lists remote activation work and actual GitHub handle mapping still Pending.

## Phase candidate

1. Integrate reviewed due work; resolve conflicts before freeze. Devadathan publishes exact SHA/API/web/native/schema/config/provider/model/prompt/KB manifest and isolated fixture controls.
2. Tag immutable `rc-p1-g1-01`, `rc-p2-g2-01` or `rc-p3-g3-01`; Tinu coordinates the complete applicable campaign. Freeze unrelated merges.
3. Fix from current frozen `dev`, review/merge, create a new numbered candidate, invalidate impacted evidence and retest targeted + critical cumulative cases. Evidence belongs in controlled artifacts/tracker; an empty application branch/commit is not required to store a result.
4. G1/G2 Pass permits reviewed regular `dev` -> `main` merge preserving ancestry; verify tested source/tree/artifact equivalence and postmerge critical smoke. If merge/config differs, retest. Tags `phase-1-approved`/`phase-2-approved` are development milestones, not public release readiness.
5. G3 prelaunch Go permits promotion/deployment; close G3/tag `v1.0.0` only after actual public required channels, safe postdeploy controls/observation and company handover pass.
6. Synchronize promotion/hotfix history back to `dev` through review; never reset shared history to simplify it.

## Production hotfix

Branch from accepted `main`, for example `hotfix/bug-001-payment-reconcile` using the real issue ID. Contain actual harm, prepare minimal reviewed fix, run reproducing/impacted/critical tests and release through the controlled incident process. Reconcile provider/domain state and merge the fix/history back to `dev`. Clinical/privacy/financial safety and evidence do not disappear in an emergency.

The one-time human-authorized starter publication to equal `main`/`dev` heads is documented in [ADR 0004](../architecture/adr/0004-initial-team-baseline.md). It is not a phase gate or deployment. Routine feature and milestone rules above apply after that baseline. Remote policy changes are not performed by repository files. Operators act within the human-authorized task and reviewed gate. See [release](../operations/RELEASE_RUNBOOK.md) and [incident response](../operations/INCIDENT_RESPONSE.md).
