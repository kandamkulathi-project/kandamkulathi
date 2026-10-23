-- Platform transport only; domain migrations and patient/clinic authorization remain separately reviewed work.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA core, clinical, engagement, platform FROM PUBLIC;
GRANT USAGE ON SCHEMA platform TO k_core_runtime, k_jobs_runtime, k_backup_runtime;

CREATE TABLE platform.environment (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  environment text NOT NULL CHECK (environment IN ('local','preview','dev','staging','production')),
  namespace text NOT NULL,
  dataset_class text NOT NULL CHECK (dataset_class IN ('synthetic','production')),
  platform_version integer NOT NULL DEFAULT 1 CHECK (platform_version > 0),
  min_api_version integer NOT NULL DEFAULT 1,
  max_api_version integer NOT NULL DEFAULT 1 CHECK (max_api_version >= min_api_version)
);
GRANT SELECT ON platform.environment TO k_core_runtime, k_jobs_runtime, k_backup_runtime;

ALTER TABLE platform.outbox ADD CONSTRAINT outbox_channel CHECK (channel IN ('financial','clinical','engagement'));
ALTER TABLE platform.outbox ADD CONSTRAINT outbox_kind CHECK (kind IN ('platform.probe','commerce.reconcile','clinical.reminder','engagement.notify'));
ALTER TABLE platform.outbox ADD CONSTRAINT outbox_channel_kind CHECK (
  kind = 'platform.probe' OR (kind = 'commerce.reconcile' AND channel = 'financial') OR
  (kind = 'clinical.reminder' AND channel = 'clinical') OR (kind = 'engagement.notify' AND channel = 'engagement'));
ALTER TABLE platform.outbox ADD CONSTRAINT outbox_status CHECK (status IN ('pending','dispatching','queued','processing','succeeded','suppressed','dead'));
ALTER TABLE platform.outbox ADD CONSTRAINT outbox_revision CHECK (revision > 0);
ALTER TABLE platform.outbox ADD CONSTRAINT outbox_deadline CHECK (deadline_at > due_at);
ALTER TABLE platform.outbox ADD CONSTRAINT outbox_attempts CHECK (publish_attempts BETWEEN 0 AND 5 AND execution_attempts BETWEEN 0 AND 5);
ALTER TABLE platform.outbox ADD CONSTRAINT outbox_failure CHECK (failure_code IS NULL OR failure_code IN (
  'deadline_elapsed','retry_exhausted','publish_failed','execution_failed','consent_revoked','version_changed','not_authorized'));
ALTER TABLE platform.outbox ADD CONSTRAINT outbox_lease CHECK ((lease_token IS NULL) = (lease_until IS NULL));
CREATE INDEX outbox_due ON platform.outbox(next_attempt_at, due_at) WHERE status IN ('pending','dispatching','queued','processing');

GRANT SELECT, INSERT ON platform.outbox TO k_core_runtime;
GRANT SELECT ON platform.outbox TO k_jobs_runtime, k_backup_runtime;
GRANT UPDATE (status,next_attempt_at,lease_token,lease_until,publish_attempts,execution_attempts,failure_code,claimed_at,completed_at)
  ON platform.outbox TO k_jobs_runtime;
ALTER TABLE platform.outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.outbox FORCE ROW LEVEL SECURITY;
CREATE POLICY outbox_read ON platform.outbox FOR SELECT TO k_core_runtime,k_jobs_runtime,k_backup_runtime USING (true);
CREATE POLICY outbox_insert ON platform.outbox FOR INSERT TO k_core_runtime WITH CHECK (
  status = 'pending' AND publish_attempts = 0 AND execution_attempts = 0 AND lease_token IS NULL AND lease_until IS NULL
  AND failure_code IS NULL AND claimed_at IS NULL AND completed_at IS NULL);
CREATE POLICY outbox_update ON platform.outbox FOR UPDATE TO k_jobs_runtime USING (true) WITH CHECK (true);

GRANT SELECT,INSERT ON platform.receipts TO k_jobs_runtime;
GRANT SELECT ON platform.receipts TO k_backup_runtime;
ALTER TABLE platform.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY receipts_read ON platform.receipts FOR SELECT TO k_jobs_runtime,k_backup_runtime USING (true);
CREATE POLICY receipts_insert ON platform.receipts FOR INSERT TO k_jobs_runtime WITH CHECK (
  EXISTS (SELECT 1 FROM platform.outbox o WHERE o.id = job_id AND o.operation_id = receipts.operation_id
    AND o.kind = receipts.kind AND o.status = 'processing'));

GRANT SELECT,INSERT ON platform.probe_effects TO k_jobs_runtime;
GRANT SELECT ON platform.probe_effects TO k_backup_runtime;
ALTER TABLE platform.probe_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.probe_effects FORCE ROW LEVEL SECURITY;
CREATE POLICY probe_read ON platform.probe_effects FOR SELECT TO k_jobs_runtime,k_backup_runtime USING (true);
CREATE POLICY probe_insert ON platform.probe_effects FOR INSERT TO k_jobs_runtime WITH CHECK (true);
