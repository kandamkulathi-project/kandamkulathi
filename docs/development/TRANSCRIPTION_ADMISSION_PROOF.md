# Bounded transcription admission

This documents aggregate provider admission introduced after baseline `dbda202` and integrated alongside the native cleanup fix and actual Core/native root mounting. Independent scoped server and native privacy reviews found no remaining blockers in their inspected source. Final combined verification, company approval, actual provider/device proof, deployment and G1 acceptance remain separate and Pending.

## Integrated composition

- Core mounts `registerTranscriptionRoutes(app, configuredIdentity, createTranscriptionProvider(bindings));`. No second identity runtime, detached authority loader or extra mount parameter.
- The completion working tree registers `0030_transcription_admission.sql` in the migration journal. The PostgreSQL fixture preserves the journal-installed schema and creates a fresh owner-controlled Core schema using exact migration SQL, avoiding duplicate CREATE statements while retaining non-BYPASSRLS ownership checks. This is not deployed migration proof.
- Keep the canonical `withSessionInTransaction` and `validateCurrentIdentity` guards. Admission reserves inside that same transaction; the COMMIT precedes external dispatch. A second current identity/capability fence runs immediately before dispatch, and another before returning text. External HTTP never holds database locks.
- Existing native/server request contracts, controller, capture adapter and explicit review/Send separation are unchanged. There is no client-supplied operation ID: each HTTP attempt generates a fresh server operation/fence. Duplicate/uncertain operations are never retried automatically.

## Owner-controlled capability, no seeded policy

An authorized database owner must approve and provision **one** `core.transcription_capabilities` row per permitted actor. Exact values must come from approved isolated-test configuration, not from this document or source-code ceilings:

| Required field | Meaning |
| --- | --- |
| `actor_id` | Existing approved actor; primary key prevents multiple concurrent capability rows for one actor. |
| `approved_by`, `approval_reference` | Existing accountable approver and restricted approval/evidence identifier; never raw private text. |
| `processing_policy_version` | Exact approved native notice/server configuration version. |
| `active`, `valid_from`, `expires_at` | Explicit enablement and approved validity window. |
| `lifetime_limit` | Total admitted attempts over that actor's complete retained ledger, including unknown, denied-after-reservation and reconciled attempts. |
| `max_concurrent` | Maximum unresolved admissions; not a UI-only throttle. |
| `lease_seconds` | Approved lease window. It must fit entirely inside capability validity at admission. |

SQL CHECK bounds (lifetime at most 10,000, concurrency at most 4, lease 25–300 seconds) are **technical resource bounds, not company policy or default entitlements**. The lease minimum exceeds the existing 20-second provider abort deadline. No capability or numeric policy is seeded, auto-created, renewed or reset. Missing/inactive/stale/expired capability returns `not-configured` (503); exhausted quota/concurrency returns `rate-limited` (429). Database uncertainty fails closed.

The runtime has **no table read/write/reset/provisioning privilege**. One fixed-search-path SECURITY DEFINER function exposes reserve/check/token-fenced settlement only, with transaction-local actor binding. Tables FORCE RLS; policies name the controlled migration owner and backup reader, not runtime. Runtime cannot inherit the controlled owner. Backup metadata remains private. Owner policy/capability changes must use the controlled administration path, not a new application endpoint.

## Quota, uncertainty and recovery

- The append-only runtime ledger stores operation/fence UUIDs, actor, policy version and timing/settlement metadata only. No audio, transcript, native credential or provider secret is stored, returned in admission replies or logged.
- Capability row locking serializes concurrent admissions per actor. Every committed admission permanently counts against lifetime usage; there is no automatic refund, reset, rolling window or replay-success response.
- Known terminal provider responses release the exact unexpired operation/fence in `finally`, including after privacy/session/policy revocation. Token-only cleanup grants no authority to dispatch or read private content. Failure to commit cleanup remains blocking.
- Unknown provider outcomes (including timeout/abort/network/invalid response) retain their slot, even if the transport has settled. Client abort does not prove that remote processing stopped. Expired unresolved leases are **not** reclaimed: they fail closed and block further admissions for that actor. Late completion cannot settle an expired lease.
- Recovery is owner-only: disable the capability while investigating; establish the old operation is no longer in flight using approved provider/operational evidence. Then record `completed_at`, a non-sensitive `reconciliation_reference`, and rotate the row's fence. Keep the admission row and lifetime usage. Never free a slot merely because a timestamp elapsed, delete the journal to reset quota, or automatically retry the old upload. Re-enable only within the approved capability terms. If quiescence cannot be established, leave blocked.
- This deliberately small proof has no recovery UI or provisioner. Owner-selected permitted actors and lifetime limits also bound aggregate isolated proof usage. It is not an unlimited public-service quota design.

## Verification and rollback

Focused tests include real PostgreSQL 17 with non-owner Core logins; SQL migration/function ownership under a separate NOSUPERUSER/NOBYPASSRLS role; FORCE RLS; no runtime policy/ledger edits; HTTP concurrency and quota exhaustion; durable pre-dispatch commit; unknown/expired blocking; token/replay/rollback fences; approved owner reconciliation without refund; approval/privacy revocation; and synthetic capture → actual loopback Core HTTP → PostgreSQL admission → editable draft, never Companion send. Provider verification and OpenAI responses are synthetic seams, not real-provider acceptance. The synthetic container is not device/AAC decoding evidence.

Focused commands (private local PostgreSQL environment, home-backed TMPDIR, shared PostgreSQL flock):

```sh
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
node node_modules/typescript/bin/tsc --noEmit -p apps/core-api/tsconfig.json
node node_modules/vitest/vitest.mjs run tests/unit/transcription.test.ts tests/unit/transcription-admission.test.ts tests/integration/transcription-http.test.ts tests/integration/transcription-admission-postgres.test.ts
node node_modules/@playwright/test/cli.js test --config tests/e2e/transcription.config.ts
```

Focused results on this isolated uncommitted implementation: root and Core TypeScript checks passed; changed-file Biome check passed; four Vitest files / 15 tests passed (including the new real-PostgreSQL loopback journey); existing Playwright transcription loopback test passed (1 test); repository/documentation check passed. The original Playwright fixture uses a synthetic admission seam, not durable database evidence. The new PostgreSQL suite supplies that evidence separately. PostgreSQL runs sourced the existing private local verification environment without printing credentials, used home-backed TMPDIR and held the shared `P1_E2E_LOCK` flock. No provider request was made.

The first combined completion gate stopped before commit: the registered 0030 exposed duplicate fixture setup, and cancellation privileges broke an existing financial-authorization assertion. The transcription fixture is corrected and passed all nine cases against the registered journal, none skipped. The second gate passed its unit/integration and browser campaigns but hung in a booking platform case and was cancelled; no completion commit was created. The final combined gate must be rerun after the remaining fixes; focused passes do not override its failure. Independent review was performed by another reviewer, not the admission author. Actual provider/configuration, deployment and Android/iOS gates remain Pending.

Rollback: default-off/hide native transcription and disable capabilities; preserve manual typing. Keep migration/ledger/leases and approved evidence. Do not drop tables, erase used quota or auto-release unknown work during rollback. The route remains fail closed if this migration is missing. Review schema and capability rollback independently before deployment.
