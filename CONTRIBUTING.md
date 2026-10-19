# Contributing

Read [AGENTS.md](AGENTS.md) and the [documentation index](docs/README.md). Work in the six-person allocation; all 38 requirements and protected test gates remain mandatory. This bootstrap contains documentation and checks, not a deployed app.

## Before implementation

Choose the named phase package/R/output IDs, read its reviewer/input/acceptance and check current Git state. Resolve company medical/finance/data-policy expectations through approved reviewers. Use a bounded branch from current `dev`; exact feature names are in the phase/member plans. Preserve unrelated work. The current documentation branch is `docs/project-governance-and-plans`.

## Every change

Use the [security automation](docs/security/SECURITY_AUTOMATION.md) setup and local commit gate. It repeats application and security verification before commits; stage intended files and resolve findings rather than bypassing the hook. Six CI contexts must pass before a reviewed merge; owner activation of actual server enforcement remains blocked by GitHub plan/admin access.

1. Agree shared API/event/schema/locale contracts before consumers diverge. Implement the smallest complete bounded slice, including negative/current-state/authorization/error behavior.
2. Cover actual changed invariants and failure modes with appropriate tests. Use synthetic data and real transaction/RLS/native proofs when those are the guarantee. Never fabricate a test run.
3. Run the commands that exist in [COMMANDS](docs/development/COMMANDS.md); document failures/not-run checks. Extend real application CI alongside features, especially database/provider/security/native boundaries not covered by the starter.
4. Update affected scope traceability, contracts, ADR, test cases, operations/security docs and [changelog](CHANGELOG.md). No silent scope/architecture/retention or public-channel change.
5. Open a PR to `dev` using the template. Include R/package/output IDs, behavior, evidence, migration/rollback, private-data/clinical/financial impact, exact reviewers and dependencies.
6. Obtain independent required review: Mathew/Devadathan peer review sensitive code, Mathew reviews Josin's financial/stock changes, Devadathan reviews Paul/Denzil UI, domain owners approve expectations. Critical author self-review is insufficient.

Phase promotion is a separate reviewed PR `dev` -> `main` after the gate; preserve ancestry and exact tested artifacts. G1/G2 do not automatically publish production. Follow the [Git workflow](docs/development/GIT_WORKFLOW.md) and [release runbook](docs/operations/RELEASE_RUNBOOK.md).

Do not commit credentials, patient data, private recordings, raw incident evidence or store signing material. Follow [SECURITY](SECURITY.md). Commit/push/deploy only within the human-authorized task; adding files locally does not imply publishing externally.
