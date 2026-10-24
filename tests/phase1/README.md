# Phase 1 logical synthetic fixtures

QA preparation for P1-TIN-002, not an application seed or acceptance run.
Aliases trace canonical11 §2.2/§3 and P1 case groups; current run IDs remain in
`docs/quality/P1_TEST_RUN_REGISTER.md`. No owner feature tests or PR #8 inventory
are replaced. See [QA tooling and evidence instructions](../../docs/quality/P1_QA_AUTOMATION.md).

With the repository-pinned Node/pnpm:

```sh
pnpm test:phase1
node scripts/qa/fixtures.mjs catalogue
```

The dedicated Node runner includes CLI subprocess journeys and is part of
`pnpm verify`. IDs are deterministic **logical references**, not actual
database/WorkOS IDs. Bind them to the reviewed isolated seed/reset output in the
restricted run manifest; this command cannot seed, reset, connect or send.
Regenerate the catalogue to reset local in-memory data. Actual resource reset
remains with the domain/platform owner and their reviewed isolation checks.

T0, TTL, precision and exact-boundary inclusivity are explicit inputs to the
coordinate helper; test values are arbitrary synthetic examples, not approved
policy. Tax/final totals, expiry/shelf-life/buffer rules, role/consent matrix,
provider schemas/signatures and physician wording/dosage remain unbound. Obtain
signed finance/physician oracles and current contract versions before execution.
No therapeutic text, credentials or real patient data are provided.

Stock quantities and the 3+1 FEFO expectation reproduce canonical facts only.
Replay data models duplicate identities only, without implementing a payment
state machine. Passing these tests proves fixture integrity and CLI behavior,
not PostgreSQL transaction/RLS, concurrency, provider, device or phase acceptance.
Those require real owner-operated tests and independent review on the exact
candidate. All acceptance remains Blocked until prerequisites/evidence exist.

Serialize builds, verify, browser, platform and full precommit execution across
worktrees with `flock /tmp/opencode/kandamkulathi-p1-e2e.lock`; never nest locks.
The existing hook requires isolated PostgreSQL 17 and matching client tools.
Missing prerequisites are blockers, never reasons to skip tests or bypass hooks.
