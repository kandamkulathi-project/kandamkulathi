# Phase 1 additive QA tooling

**Owner:** Tinu; KAN-99–102 / P1-TIN-002, P1-TIN-003, P1-TIN-090,
P1-TIN-080. **G1 / KAN-57 remains Blocked.** This extends the merged PR #8
[run inventory](P1_TEST_RUN_REGISTER.md), not its completed case-preparation task.
The [canonical cases](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md)
remain authoritative. No feature-owner test or application configuration is replaced.

## Candidate-bound evidence ledger

Runtime: pinned repository Node, standard library only. These commands read local
JSON/register files and write JSON to stdout; no database, network, reset, provider
send, deployment, approval or tracker update occurs. Store generated ledgers in the
restricted company evidence store or ignored `.local-data/qa/`, not application Git.

Create a private candidate JSON with exactly these string fields:

| Field | Exact reference required |
|---|---|
| `sha` | Full 40-character lowercase tested Git commit SHA |
| `artifacts` | Immutable API/web/native artifact manifest with hashes/build IDs |
| `schema` | Migration/schema version and checksum manifest |
| `config` | Non-secret environment/resource configuration hash manifest |
| `providers` | Actual provider/account/mode manifest; no credentials |
| `fixtures` | Fixture version, generated ID map and approved oracle references |
| `model`, `prompt`, `kb` | Exact versions, or explicit reason not exercised |

The tool does **not** verify that references resolve, artifacts are genuine, the
commit exists or a candidate is frozen. Devadathan and independent reviewers must
bind and verify these references before campaign execution. A local baseline SHA
is not a frozen G1 candidate. Never use missing placeholders to imply readiness.

```sh
node scripts/qa/evidence.mjs init .local-data/qa/candidate.json > .local-data/qa/ledger.json
node scripts/qa/evidence.mjs validate .local-data/qa/candidate.json .local-data/qa/ledger.json
node --test tests/phase1/evidence.test.mjs
pnpm test:phase1
```

Initialization derives all detailed IDs, requirement/output links and blockers
from the register and sets every row **Blocked**. It does not execute cases or
copy any historical Pass. Fill one exact role/channel/locale/boundary/fault run
at a time using the canonical mandatory matrix. The current inventory is only the
baseline: required additional combinations must first be added to the reviewed
register, then reconciled into a newly initialized ledger.

Each executed row needs independent executor/reviewer identities, expected/actual
summaries, approved oracle reference, UTC start/end timestamps, evidence references
and SHA-256 digests. Failed rows require defect references. Restricted HTTPS artifact
URLs must not include credentials, query strings or fragments; use an authenticated
evidence-store page rather than a bearer/signed download URL. Keep clinical text,
credentials and patient identifiers out of summaries and filenames.

Validation rejects duplicate/missing rows, register changes, stale candidate or
row fingerprints, unresolved blockers, self-review, aggregate parent outcomes and
unsupported statuses. It also requires appropriate evidence categories for database,
provider, physical-device and company-review groups; local synthetic evidence alone
cannot pass canonical acceptance. These group-level checks are a **minimum guard**,
not a complete subcase oracle. An artifact category is a declaration requiring
independent content review, not automatic attestation. A validator success always
returns `gate: "Not evaluated"`; it cannot grant G1 or company acceptance.
Requirement/output links are retained and checked per row. The summary includes
status counts for all R01–R38; zero linked runs means no G1 coverage in this ledger,
not that a requirement is complete or removed.

Changing any candidate version invalidates old fingerprints. Do not edit fingerprints
to transfer a Pass: initialize a new ledger and retest targeted and critical cumulative
cases. Register changes likewise require explicit reconciliation, not silent row loss.

## Execution and integration boundaries

`tests/phase1/` is deliberately additive and is not included in the baseline
Vitest/Playwright patterns. The approved `pnpm test:phase1` command discovers sorted
Node `*.test.mjs` files without shell expansion and runs them with the pinned Node.
It is registered additively in `pnpm verify`, so CI and the existing commit gate
execute these guards. It never treats Playwright `*.spec.ts` files as Node tests.
Node evidence tests include a real CLI subprocess roundtrip and negative controls;
their success means only that the evidence guard behaves as asserted.

The separate `pnpm test:e2e:phase1:baseline` command builds and runs eight unmocked
local workerd/browser checks in `playwright.phase1.config.ts`: liveness/readiness,
non-success for forged headers, payload limits and approved/opaque-origin error
readability. **This suite binds the e5161d7 scaffold contract**, including truthful
503 unavailability. It is not registered in the default application E2E campaign
and must not be run unchanged as acceptance after owner endpoints are integrated.
Review the actual new route/error contracts and add real persisted-state cases
before treating the integrated business candidate as covered. No 503 or browser
CORS result proves authenticated owner/patient/clinic authorization.

Use the shared lock for browser/full precommit execution across worktrees:

```sh
flock /tmp/opencode/kandamkulathi-p1-e2e.lock pnpm test:e2e
flock /tmp/opencode/kandamkulathi-p1-e2e.lock pnpm test:e2e:phase1:baseline
flock /tmp/opencode/kandamkulathi-p1-e2e.lock git commit -m "test: add Phase 1 QA tooling"
```

Frozen dependency install installs hooks. The normal full commit gate must pass;
do not bypass it when PostgreSQL, advisory feeds, scanners or browsers are unavailable.
See the [command registry](../development/COMMANDS.md) and
[platform setup](../development/PLATFORM_FOUNDATION.md) for the isolated real
PostgreSQL 17 setup. Logical fixtures or local HTTP checks never establish domain
transaction atomicity, pooled patient RLS, real provider eligibility or device proof.

## Evidence still required before G1

| Scope | Missing evidence / accountable handoff |
|---|---|
| P1-T01 / T20 | Frozen integrated candidate/tag and immutable artifact/schema/config manifest; approved isolated hosted resources; independent review and protected team campaign allocation (Devadathan/Tinu) |
| P1-T02 / T03 | WorkOS tenant/session/MFA/revocation results, signed role matrix, real PostgreSQL patient/clinic/doctor policies and pooled rollback/reuse tests (Mathew/Devadathan) |
| P1-T04–T08 | Finance-approved PRICE/TAX/refund/hold-boundary oracles, domain control totals, real PostgreSQL stock/booking race/rollback/uncertain-commit proof, authentic sandbox callback/reconciliation evidence (Josin/Mathew) |
| P1-T09–T11 | Integrated real API journeys, signed Android/iOS builds and supported physical-device payment/auth/private-video/network tests, TURN/access evidence (Devadathan/Paul/domain owners) |
| P1-T12–T15 | Physician-signed source/intake/safety/translation oracles, KB inventory/refresh, confirmed-tool/takeover tests, actual WhatsApp identity/voice/provider evidence (Mathew/Denzil/company physician) |
| P1-T16–T18 | Exact-candidate whole-app independent security review, real domain outbox effects, company-resource recipient receipt, encrypted object/domain recovery and timed deployed compatible rollback (Devadathan/Mathew/Josin) |
| P1-T19 | Realistic current business mix at 10 dynamic rps for 10 minutes, resource/latency/lock/invariant evidence; local health smoke is insufficient (Devadathan/domain owners) |

All entries above remain **Blocked / not executed as acceptance** until their
exact-candidate artifacts and independent/domain/company reviews exist. Concurrent
owner branches, unit mocks, source inspection and locally green tests do not close them.
