# Environments and provider modes

| Environment | Data / providers | Required boundary |
|---|---|---|
| Local development | Synthetic; stub/sandbox only | Actual config/seed/reset after scaffold; no claim services are running now. |
| Feature preview | Isolated synthetic resources | Restricted preview keys/bindings, no production schema/data/signing/sends; reviewed migration target. |
| Shared dev / integration | Synthetic approved role/domain fixtures | Controlled reset/migration operator and contract versions; not a public production channel. |
| Staging / paid verification | Realistic retained synthetic data, actual provider tests plus controlled load adapters | By D7 intended paid region/compute/history/roles/pool/resource parity; protected measurement windows and isolated fault/recovery targets. |
| Production | Approved opening data; minimal authorized live checks then real operation | Company-owned accounts, required approvals, secrets/domain/stores/clinical policies, prelaunch Go, observation/reconciliation/support. |

Use PostgreSQL from development; conditional Free use does not guarantee capacity or a future D1 port. Record exact region/DB/Worker/queue/R2/Vectorize/identity/provider IDs, runtime/admin boundaries, modes, quotas/spend, SDK/model/KB/config/artifact versions and owner in the [manifest](../templates/PROVIDER_ENVIRONMENT_MANIFEST.md). Names/URLs are supplied by actual operators, never guessed in tests.

Reject wrong/missing mode/credentials. `ALLOW_LIVE_SENDS=false`/`ALLOW_LIVE_PAYMENTS=false` are proposed defaults in the example inventory; actual schema/adapters must enforce environment isolation. Renaming a local file is not protection. No secrets/client credentials are exposed in build output.

Separately verify physical/compute/resource isolation before parallel destructive tests: a schema alone is not a separate target. No reset/time travel/deploy/scanner storm/restore on the active measured baseline/soak. Serialize and reforecast if isolation/operator time/cost cannot fit. Approved processors/residency, always-active production compute and actual seven-day history/recovery are verified, not inferred from product names.
