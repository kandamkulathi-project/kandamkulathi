# Platform development and handoff

Package: P1-DEV-001. Owner Devadathan; independent reviewer Mathew. Source branch `feature/p1-devadathan-platform-foundation`. No company requirement, member allocation or phase gate changes.

## Start local verification

Use the repository's exact Node/pnpm pins. Install the locked packages and Chromium as in [setup](SETUP.md). Platform tests additionally need an explicitly isolated PostgreSQL 17 instance and matching `pg_dump`/`pg_restore` tools. Tests refuse a remote host or an administrative database other than loopback `/postgres`; each run creates fresh random `k_platform_test_*` databases and non-owner logins, then removes only those resources. No test skips database guarantees when the database is unavailable.

For Docker, set `PLATFORM_LOCAL_POSTGRES_PASSWORD` to a synthetic local-only password, then run:

```sh
docker compose -f compose.platform.yml up -d --wait
```

The Compose service binds only `127.0.0.1:55439` and uses temporary in-memory storage. Use it only for synthetic tests. Never attach company data or point this setup at an existing production database. If the port is occupied, stop the test instance you own or explicitly choose another loopback mapping; do not terminate unrelated processes.

Supply `PLATFORM_TEST_ADMIN_URL` privately as `postgresql://postgres:URL_ENCODED_SYNTHETIC_PASSWORD@127.0.0.1:55439/postgres`, matching that instance. Set `PG_BIN_DIR` to your installed PostgreSQL 17 client directory, for example `C:\Program Files\PostgreSQL\17\bin` or `/usr/lib/postgresql/17/bin`. Keep secret-bearing local configuration in approved secret storage or ignored `.local-data`; neither Git nor shell transcript evidence should contain its value. Windows may use a verified portable PostgreSQL 17 installation instead of Docker. These tools are test/controlled-runner tools, not additions to the production stack.

```sh
pnpm test:platform
pnpm verify
pnpm test:e2e
pnpm security:sast
pnpm security:check
python scripts/check_repository.py
```

The pre-commit hook now also requires `pnpm test:platform`; provide its database/tool variables to the Git process, including IDE Git clients. CI runs the same pack against a pinned temporary PostgreSQL 17 container inside `application-checks`, without cloud secrets. Database tests include actual driver sessions, transaction rollback, concurrent claims, fast/duplicate consumers, crash/reclaim, current guard decisions, retry exhaustion, role/column/RLS denials, commit/rollback scope cleanup, migration checksum rejection, seed/reset isolation, deployment locks, schema compatibility and authenticated encrypted restore. A separate test executes actual local workerd Cron and Queue handlers through the driver to PostgreSQL. Synthetic RLS fixtures demonstrate driver/context behavior; actual patient/clinic policies remain Mathew's deliverable.

## Transaction and handler contract

Mathew/Josin receive `packages/database` exports `./client` and `./outbox`. API credentials inherit only `k_core_runtime`; dispatcher/consumer credentials inherit only `k_jobs_runtime`. Controlled backup credentials inherit only `k_backup_runtime`. The migration/restore context has separate administrative access; never place it, test-admin URLs or recovery keys in a Worker. Both runtime URLs must use distinct logins for the same database. Hosted URLs require the reviewed pooled Neon endpoint and verified TLS; administrative operations require its paired direct endpoint. Runtime membership/ownership/environment checks run on the actual connection.

Runtime and backup proofs reject additional reachable roles, including inherited predefined/server-file privileges, as well as privileged role attributes and application schema/table/database ownership. Profile groups themselves must not inherit another role. Provision dedicated SQL logins with only their expected profile; a broad account-owner role or a console-created administrator is not a runtime credential.

Within `withDatabase`, call the shared `transaction(client, callback)` for the authoritative domain write, ledger/reservation change and `enqueue(context, job)`. All use that client's Drizzle connection. `enqueue` rejects autocommit and conflicting reuse of operation/kind; identical retry returns the original job ID. No publish/provider call belongs inside this transaction. The helper never retries an ambiguous commit automatically; reconcile by stable operation identity.

`NewJob` contains only UUID references, channel, fixed kind, revision and UTC due/deadline dates. Envelopes contain only schema version, job UUID and channel. IDs still require restricted access; they are not anonymous health data. Queues are untrusted delivery hints: the consumer reloads authoritative state and validates channel. Register domain handlers in trusted code only, with a `decide(context, job)` that locks/rechecks actual consent, version, assignment and other applicable rules, plus an `apply(context, job)` containing short SQL work only. Tests can inject handlers; request/model/queue payloads cannot supply handlers or authorization.

External charge/refund/send/shipment work needs the owning domain's durable operation state, provider idempotency and unknown-outcome reconciliation. A transactional handler may create such an obligation; it must not perform the network call under row locks. A dead or suppressed transport row does not settle a financial/clinical obligation. Domain owners add alerts/reconciliation and explicit reviewed redrive rules. Unsupported handlers never report success.

Dispatcher claims use bounded `SKIP LOCKED` batches, server timestamps, 30-second leases and fencing tokens. The Worker cycles channels, publishes at most 100 references per batch and stops at 1,000 claims or 20 seconds per run; profile/tune these caps against real demand. Publishing follows commit. Fast consumers cannot have success overwritten by the publisher. Queued work is revisited after five minutes if its notification disappears; a crashed execution lease can be reclaimed after expiry. Durable attempts are capped at five; broker retries and DLQs are explicit. Replays must recheck deadline/current authorization, including immediately before applying an effect after its guard. Never edit a row to bypass a safety decision or blindly replay a provider call.

## Local administrative tools

`pnpm db:migrate` requires `APP_ENV`, `DATABASE_MIGRATION_URL` and, remotely, a provisioned manifest plus independent review reference. P1 tooling refuses production changes. For local operations the database must be `k_platform_local` or a random test database on loopback; the manifest marker must agree. Runtime roles cannot migrate. Test-only roles never receive owner, create-role/database, replication or RLS-bypass powers.

`pnpm platform:fixtures seed` creates a synthetic `platform.probe`; `reset-probes` removes only probes/associated receipts/effects and preserves domain obligations. Both require `APP_ENV=local`, the isolated migration URL and `PLATFORM_CONFIRM_SYNTHETIC_NAMESPACE=kandamkulathi-local`. Reset refuses active probe leases. This is not a catalogue, clinical or finance seed; their owners provide approved synthetic fixtures separately.

`pnpm platform:backup export .local-data/backups/NAME.kav` uses `DATABASE_BACKUP_URL`, a separate 32-byte base64 `BACKUP_KEY_B64`, a nonsecret `BACKUP_KEY_ID` and matching client tools. Optional `R2_OBJECT_MANIFEST` names an approved private JSON inventory of content-addressed keys/hash/size. The export uses a consistent PostgreSQL snapshot, restricted backup role and streamed AES-256-GCM. The key is never in the artifact. Store artifacts and keys independently through company recovery access before cloud acceptance.

`pnpm platform:backup restore .local-data/backups/NAME.kav` uses `DATABASE_RESTORE_URL`. It authenticates the entire ciphertext and bound metadata before executing restore SQL, requires a different empty nonproduction target, restores with roles/grants/RLS and compares transport control totals. Temporary plaintext has restricted file creation mode and is removed on success/failure; use an OS-restricted encrypted runner volume and verify Windows ACLs separately. Domain totals, actual R2 bytes, provider replay, PITR/history, account-loss recovery and timed service resume remain separate acceptance work. Do not delete artifacts to conceal a failed export or overwrite a source database.

Recovery metadata is deliberately bounded to 64 KiB. For a large R2 inventory, supply a small set of immutable content-addressed root/shard manifest references rather than embedding every retained object's record in the export header. Their manifests must enumerate/link all required retained byte versions, and manifests plus bytes need independent recovery storage before acceptance. Oversized metadata fails explicitly; it is never truncated. Local R2 tests prove namespace separation and byte/hash lookup, not a company account-loss recovery.

## Release and telemetry

After a verified clean commit, `pnpm platform:release prepare config/environments/dev.json .local-data/releases/CANDIDATE/artifact.json` freshly dry-builds both Workers and freezes bytes, source SHA, inventory digest and migration digests. `dry-run` with the same arguments validates and dry-builds those frozen bytes; it never deploys. `check` additionally requires the actual provisioned inventory and direct administrative connection to check current schema/API compatibility under a target advisory lock. Tests prove lock exclusion and compatible/incompatible decisions. This is a foundation for the later reviewed deployment runner, not a claim that a deployed rollback occurred or that the unavailable business app is ready. Never run direct deploy/rollback outside the reviewed release process.

Use `pnpm platform:metrics summary .local-data/observability/records.ndjson` for one environment's exported structured records. Invalid records and mixed environments fail; zero samples never mean success. Minimum 100 healthy pickup samples is an engineering default requiring review before gate measurement. Reports always retain Pending monthly-coverage/phase acceptance: exported/sample logs alone do not prove a full month's collection. Configure a rolling 30-day dashboard and retained daily aggregates/coverage with the actual log service; verify retention and cost first. Count outages/misconfiguration as failures, and record fault/deadline recovery separately. Do not disable consent checks to improve pickup figures.

`pnpm platform:metrics alert-test` accepts an explicit `PLATFORM_ALERT_TEST_URL`, environment and namespace. Nonlocal targets additionally require `APPROVED_ALERT_TEST=true` and TLS; production tests are refused in P1. The implemented test sends only to a local receiver. HTTP acceptance is distinct from a named recipient confirming receipt. Do not send an external alert until the operator has explicit authorization and approved routing.

`tests/load/platform.js` is a k6 loopback-only, five-user, 30-second liveness smoke. Supply `PLATFORM_LOAD_BASE_URL=http://127.0.0.1:PORT`; it sends no business/provider traffic. Its results do not establish India latency, the final 60/120 rps mixed workload, soak, video/AI concurrency or 1,000+ daily-user capacity.

## Review and next handoff

Mathew reviews the role/SQL/driver/transaction/queue/recovery changes independently before integration. Tinu receives command results and the [acceptance matrix](../operations/P1_PLATFORM_FOUNDATION.md); all canonical phase test cases remain required. Paul/Denzil receive no privileged credentials. Company-owned resources, secret scopes, live Neon TLS/region/pool/roles, R2 access/bytes, operational dashboard/alert receipt, independent backup storage, deployed rollback and GitHub server-side merge enforcement remain Pending. The user explicitly selected local completion with cloud setup deferred.
