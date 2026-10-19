# Backup, restore and replay safety

**Operator:** Devadathan; Mathew controlled backup. Josin validates money/stock/provider totals; Mathew clinical/roles/booking; Tinu records independent evidence. Actual credentials/commands/resources remain required implementation work, not created by this runbook.

## Required baseline

Configured verified seven-day Neon history; always-active production compute and reviewed pool/roles. Nightly encrypted independent PostgreSQL export through a suitable controlled runner, not a normal API Worker; initial seven daily/four weekly copies subject to approved records policy/cost. Independent company recovery/key access and actual backup success/age/restore alerts. Same-account branch snapshots alone do not cover account loss.

Private/source R2 bytes use immutable object keys/hash/version manifests and retained/copyable bytes needed by restored records. Historical clinical/financial retention is separate from recovery-history duration; exports/keys/health bytes never go in Git or public evidence.

## Timed PITR drill

1. Verify isolated target/endpoint/roles/provider modes and protected run window; capture candidate/schema/config, realistic dataset and source control totals.
2. Create timed synthetic markers/transactions and record incident/recovery target. Restore within configured history into isolation via the actual supported operator procedure.
3. Verify schema/extensions/non-owner/RLS/assignment/consent, object references/hashes and stock/order/payment/refund/booking/credit/job/report controls before simulated cutover/resume.
4. Reconcile provider events since target by stable IDs; no duplicate charges/refunds/messages/shipments or stale clinical job replay. Verify core/device/API compatibility and alerts.
5. Record latest recovered point and full restore/validation/resume time. Target RPO <=15 minutes and RTO <=2 hours applies to tested data/configuration, not a vendor guarantee. Failed drills require repair/retest or No-go.

## Independent export/account-loss drill

Retrieve/decrypt through company recovery access, restore schema/data/roles/extensions/RLS and objects into isolation, validate the same controls and safe provider replay, and record backup age/full elapsed recovery. Nightly export RPO may be up to 24 hours; weekly copies are older/coarser. Measure independent cross-provider restoration separately; never claim automatic two-hour failover from PITR proof alone.

## Application rollback

Rehearse prior compatible Worker/web artifacts against additive schema/current supported native/API contracts, with current provider/outbox reconciliation. Record recovery-to-service <=15 minutes including validation, not just deployment duration. Do not execute destructive down migrations or assume instant store rollback. All drills use authorized synthetic/isolated targets, not active production/measured soak state. Cost/operator/window impacts are recorded.
