# ADR 0003 — Development integration and phase-gated promotion

**Status:** Accepted workflow. **Release manager:** Devadathan. **Technical backup:** Mathew. **QA:** Tinu.

`main` is the accepted phase baseline; `dev` is protected integration. Named feature/test/docs/chore branches start at latest `dev` and PR back through relevant checks/review. Freeze exact immutable candidate before each campaign and issue a new candidate/retest after fixes.

G1/G2 Pass permits reviewed regular `dev` -> `main` merge preserving ancestry/tree/artifact equivalence. Those development milestones do not auto-publish incomplete software. G3 prelaunch Go permits controlled promotion/deployment; actual public-channel postdeploy checks, training and ownership close G3 and final tag. Hotfix from `main` with review/impacted tests, then backmerge.

Consequences: source/config/model/KB/native changes may invalidate evidence; no unrelated merge during freeze. Protect both shared branches and require real checks. GitHub settings/handles remain a separate owner activation item; a policy file does not enforce protection. See [workflow](../../development/GIT_WORKFLOW.md) and [settings](../../governance/REPOSITORY_SETTINGS.md).
