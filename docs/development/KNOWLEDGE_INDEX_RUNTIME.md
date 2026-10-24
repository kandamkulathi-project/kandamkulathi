# Knowledge index runtime candidate

This lane implements initial exact and public-reference-seeded vector retrieval,
not just an index ledger. It is not production, clinical approval, freshness SLA
or live provider evidence. Only synthetic protocol fixtures are used in tests.

## Parent integration required

- Journal additive `0006_mathew_knowledge_index.sql`; preserve migrations0000–0005.
- Actual canonical kind is `packages/database/src/outbox.ts`: `knowledge.index`,
  engagement channel, revision1, obligation UUID as operationId and subjectId.
- Before Cron claimDue, call `bridgeKnowledgeIndexObligations(context,
  operationalDeadlineMs, limit=100)`. It owns a short transaction and atomically
  inserts canonical outbox and immutable bridge receipt. Do not wrap it in another
  transaction. Deadline budget is a required approved operational input, not an
  invented clinical/freshness policy. Existing ledger/save files are unchanged.
- Register the EXACT factory `createKnowledgeIndexHandler(options)` from
  `apps/core-api/src/knowledge-index.ts`. Returned callback is
  `(context: DatabaseContext, job: ClaimedJob, signal: AbortSignal) => Promise<void>`.
  The platform must validate committed lease/deadline, invoke OUTSIDE all database
  transactions, then fence the receipt/success checkpoint with its lease token.
  Throws must use the existing release/retry/deadletter engine; never ACK success.
  Do not register this callback as TransactionalHandler.apply. The current platform
  SQL-only executeClaim cannot run external effects. Parent/coordinator owns that
  extension and default Core registration; this lane does not claim it complete.
- Provider options: `{vectorize,apiKey,namespace}` from actual server-owned bindings.
  Add approved binding names/config and package exports/dependencies in parent scope
  (Core requires zod at the existing approved pinned workspace version). No version
  upgrade, new SDK, queue or enablement flag is supplied.
- Register `registerKnowledgeIndexRoutes(app, resolveDependencies)` in Core default
  service. Dependencies are `withDatabase`, `provider`, existing runtime `search`
  as `exact`, and existing `publicProduct` as `publicProduct`. Use a public-reader
  Core or jobs connection; jobs projection privileges are narrowly added in0006.
  Missing resources resolve undefined and produce503, not fake empty success.

## Provider/data boundary

Native fetch calls fixed `https://api.openai.com/v1/embeddings` using backend-only
key, `text-embedding-3-small`,1536 dimensions, eight-second request timeout, real
finite/nonzero response validation. No fallback fake embedding exists. Vectorize
uses actual v2 binding `upsert`, `deleteByIds`, `query`; returned mutationId is
required. Mutation receipt means accepted, NOT confirmed immediately searchable.
Provision a matching1536-dimension index, namespace and metadata indexes for
`language`/`kind`; actual account configuration and processor approval are pending.

`POST /v1/knowledge/search` accepts strict `{term,language,semanticReference?}`.
Exact/alias/keyword uses current primary terms. Semantic mode embeds ONLY a current
approved immutable public reference, never the free-text term, patient prompt,
private URL or raw health data. This deliberate initial retrieval mode is not a
free-text medical assistant. No source URL is fetched and no R2 is needed.
Only primary-fenced ready public products and independent mandatory safety blocks
are returned, never bare vector hits. Missing safety/current approval hides the
product; primary/provider outages remain503. No clinical text is synthesized.

## Consistency and remaining review

Stable vector IDs hash full immutable entry/revision/contentHash references.
The jobs role reserves IDs before effects, so uncertain writes are discoverable
for later deletion. Old reservations are retained for retry/crash reconciliation.
Jobs cannot rewrite primary content, grants or obligations. Domain projection
rechecks current publication, source hashes/rights, approval/evidence/qualification,
withdrawal and manifest reference under primary locks. After embeddings and after
upsert it rechecks primary; obsolete effects are deleted. Providers never run under
DB locks. Revision races can still leave transient derived hints because Vectorize
is asynchronous and offers no atomic PostgreSQL fence. The mandatory independent
primary public retrieval fence prevents those hints authorizing any response.
Company-agreed freshness measurements and independent security/clinical review are
release blockers; accepted mutations are not a measured freshness guarantee.

## Focused evidence

Unit fixtures cover real protocol shape, no text metadata, stable IDs, missing
binding/key,429, zero vectors, uncertain mutation and post-embedding revocation.
HTTP tests consume the actual registered handler and primary domain safety fence.
Real PG17 tests apply owned0006 explicitly (parent owns journal), prove bridge
rollback/concurrency, RLS denial, stable retries, provider-outside-transaction guard
and withdrawal deletion. E2E source checks actual Core registration/fail-closed
behavior and rejects patientPrompt; parent must run after integration.

No full gate, commit, push, PR, merge or deployment is authorized for this lane.
Coordinator API returned401; exact handoff is
`/tmp/opencode/p1-mathew-knowledge-index-api.md`.

Frozen verification: all10 focused tests passed across the unit, HTTP and real
PG17 files. Focused Biome check passed; `git diff --check` passed. Root tsc was
attempted and remains blocked by prerequisite package-export/Worker binding errors
outside the owned files; no owned-file diagnostics remain in its captured output.
A focused pinned SAST invocation timed out at120 seconds without output (possibly
waiting on the shared lock); SAST parsing/results are therefore NOT verified.
E2E source was added but not run pending leader registration. Full gates remain
leader-owned and were not run. No commit was created.

## Abort-signal followup

The external platform engine supplies its10-second budget as the required third
callback argument. The handler checks abort before/after each logical DB operation
(prepare/projection) and hash step; provider work combines that signal with the
embedding request's own eight-second timeout using `AbortSignal.any`. It also
checks after response-body consumption, authorization and every Vectorize await.
Abort prevents subsequent work and rejects the callback, never successful checkpoint.
Already-running bounded SQL is not cancelled or rolled back by this signal alone.
Vectorize has no abort API: mutations may complete after abort. Reserved IDs remain
durable for retry/deletion reconciliation; abort does NOT cancel remote effects.
The existing mandatory primary/public-safety fence remains independent.

Signal-only regression tests cover pre-aborted handler/no DB, aborted embedding/no
upsert, late non-abortable upsert rejection, and no further delete batch after abort.
Real PG handler test confirms late mutation rejects with reserved ID retained and
no domain-written platform receipt. Actual engine lease/checkpoint and registration
remain leader-owned; this delta does not modify root, outbox or external engine.
Followup verification: all14 focused tests passed (unit8, HTTP3, real PG3), with
the PG run under the shared flock; focused Biome passed. No full gates, SAST rerun,
commit, push or registration edits were performed.
