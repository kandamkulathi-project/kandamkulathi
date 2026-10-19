# PostgreSQL foundation

Owner: Mathew; Josin owns reviewed commerce tables. Devadathan reviews sensitive changes.

Drizzle exports the approved `core`, `clinical` and `engagement` namespaces. There are deliberately no application tables, migrations, seeds or runtime connections yet. No database is contacted by install/build/tests or HTTP routes. This is an implementation boundary, not a replacement database or a completed data layer.

Next P1 work must add the Neon PostgreSQL 17 adapter supporting the required interactive transactions, reviewed non-owner roles and transaction-local RLS context, additive migrations and deterministic synthetic fixtures. Prove scope cleanup, locking and atomic outbox guarantees against real PostgreSQL. The HTTP-only Neon query path is insufficient evidence of interactive transaction correctness. Runtime credentials must never own tables or use administrative URLs.

`pnpm db:generate` generates SQL locally from reviewed future table definitions. With namespaces only it may produce no changes; never treat that as schema acceptance. No automatic migrate/push/deploy command is provided. A controlled migration command and database CI must accompany the first table/repository implementation.
