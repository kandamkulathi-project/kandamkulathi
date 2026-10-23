# PostgreSQL foundation

Owner: Mathew; Josin owns reviewed commerce tables. Devadathan reviews sensitive changes.

Drizzle exports `core`, `clinical`, `engagement` and a transport-only `platform` namespace. P1-DEV-001 adds versioned transport migrations, separate non-owner roles, Neon WebSocket transactions, atomic enqueue, leases and receipts. Business tables, real WorkOS identity and patient/clinic policies remain Mathew/Josin's work. Install/build and normal starter HTTP routes do not contact a database; `pnpm test:platform` deliberately connects to isolated real PostgreSQL 17.

`withDatabase` creates one event-scoped Neon connection, verifies group/ownership/version/environment/API compatibility, and closes it in `finally`. API, jobs and backup groups are distinct; no runtime role owns application schemas, tables or the database. `transaction` bounds SQL/lock/idle times and cleans its local state after commit/rollback. Use this helper for domain writes and `enqueue` on the same connection; do not open an unrelated Drizzle transaction or publish inside it. Local tests exercise real PostgreSQL over a loopback WebSocket proxy; actual hosted Worker-to-Neon TLS/pool/role evidence is still Pending.

`pnpm db:generate` is offline generation. Review generated SQL and snapshots together; use an additional custom migration for grants/RLS/constraints not represented by Drizzle metadata. Applied migration digests are immutable. `pnpm db:migrate` is a separate guarded administrative operation with target checks and an advisory transaction lock. Never run a schema push, destructive down migration or migration from a Worker.

The only registered handler is `platform.probe`, with a synthetic SQL effect and receipt committed atomically. Financial/clinical/engagement domain kinds remain unavailable until their owners register reviewed current-state decisions and bounded SQL effects. Provider network operations require separate durable operation/reconciliation state; this foundation does not promise exactly-once external calls. See [implementation evidence](../../docs/operations/P1_PLATFORM_FOUNDATION.md) and [setup/handoff](../../docs/development/PLATFORM_FOUNDATION.md).
