-- Derived, public-only index. Existing platform leases, retries and deadlines remain authoritative.
ALTER TABLE platform.outbox DROP CONSTRAINT outbox_kind;
ALTER TABLE platform.outbox ADD CONSTRAINT outbox_kind CHECK(kind IN
 ('platform.probe','commerce.reconcile','clinical.reminder','engagement.notify','knowledge.index'));
ALTER TABLE platform.outbox DROP CONSTRAINT outbox_channel_kind;
ALTER TABLE platform.outbox ADD CONSTRAINT outbox_channel_kind CHECK(
 kind='platform.probe' OR (kind='commerce.reconcile' AND channel='financial') OR
 (kind='clinical.reminder' AND channel='clinical') OR
 (kind IN ('engagement.notify','knowledge.index') AND channel='engagement'));

CREATE TABLE core.knowledge_index_bridges (
 obligation_id uuid PRIMARY KEY REFERENCES core.knowledge_index_obligations(id),
 job_id uuid NOT NULL UNIQUE REFERENCES platform.outbox(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- Reserve immutable IDs before effects, including uncertain/crashed provider calls.
CREATE TABLE core.knowledge_index_vectors (
 vector_id text PRIMARY KEY CHECK(vector_id ~ '^[a-f0-9]{64}$'),
 entry_id uuid NOT NULL REFERENCES core.knowledge_entries(entry_id),
 reference jsonb NOT NULL,
 CHECK(reference->>'entryId'=entry_id::text)
);
GRANT USAGE ON SCHEMA core TO k_jobs_runtime;
GRANT SELECT ON core.knowledge_entries,core.knowledge_products,core.knowledge_grants,
 core.knowledge_sources,core.knowledge_index_obligations TO k_jobs_runtime;
-- FOR SHARE requires a column UPDATE privilege, but no UPDATE RLS policy is granted.
GRANT UPDATE(record) ON core.knowledge_entries TO k_jobs_runtime;
GRANT UPDATE(manifest) ON core.knowledge_products TO k_jobs_runtime;
GRANT UPDATE(lock_guard) ON core.knowledge_grants TO k_jobs_runtime;
GRANT UPDATE(revoked_at) ON core.knowledge_sources TO k_jobs_runtime;
GRANT SELECT ON core.identity_actors TO k_jobs_runtime;
GRANT UPDATE(lock_guard) ON core.identity_actors TO k_jobs_runtime;
CREATE POLICY identity_index_reviewer ON core.identity_actors FOR SELECT TO k_jobs_runtime
 USING(EXISTS(SELECT 1 FROM core.knowledge_grants g WHERE g.actor_id=identity_actors.id));
CREATE POLICY identity_index_lock ON core.identity_actors FOR UPDATE TO k_jobs_runtime
 USING(EXISTS(SELECT 1 FROM core.knowledge_grants g WHERE g.actor_id=identity_actors.id)) WITH CHECK(false);
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['knowledge_entries','knowledge_products','knowledge_grants','knowledge_sources','knowledge_index_obligations'] LOOP
  EXECUTE format('CREATE POLICY knowledge_jobs_read ON core.%I FOR SELECT TO k_jobs_runtime USING(true)',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['knowledge_entries','knowledge_products','knowledge_grants','knowledge_sources'] LOOP
  EXECUTE format('CREATE POLICY knowledge_jobs_lock ON core.%I FOR UPDATE TO k_jobs_runtime USING(true) WITH CHECK(false)',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['knowledge_index_bridges','knowledge_index_vectors'] LOOP
  EXECUTE format('ALTER TABLE core.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE core.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('GRANT SELECT ON core.%I TO k_jobs_runtime,k_backup_runtime',t);
  EXECUTE format('GRANT INSERT ON core.%I TO k_jobs_runtime',t);
  EXECUTE format('CREATE POLICY index_read ON core.%I FOR SELECT TO k_jobs_runtime,k_backup_runtime USING(true)',t);
 END LOOP;
END $$;
CREATE POLICY bridge_insert ON core.knowledge_index_bridges FOR INSERT TO k_jobs_runtime WITH CHECK(
 EXISTS(SELECT 1 FROM platform.outbox o WHERE o.id=job_id AND o.operation_id=obligation_id
 AND o.subject_id=obligation_id AND o.kind='knowledge.index' AND o.channel='engagement' AND o.revision=1));
CREATE POLICY vector_insert ON core.knowledge_index_vectors FOR INSERT TO k_jobs_runtime WITH CHECK(
 EXISTS(SELECT 1 FROM core.knowledge_entries e WHERE e.entry_id=knowledge_index_vectors.entry_id
 AND e.record->>'state'='approved' AND e.record->>'contentHash'=reference->>'contentHash'
 AND e.record->'content'->'revision'=reference->'revision'));
GRANT INSERT ON platform.outbox TO k_jobs_runtime;
CREATE POLICY outbox_index_insert ON platform.outbox FOR INSERT TO k_jobs_runtime WITH CHECK(
 kind='knowledge.index' AND channel='engagement' AND revision=1 AND operation_id=subject_id
 AND status='pending' AND publish_attempts=0 AND execution_attempts=0 AND lease_token IS NULL
 AND lease_until IS NULL AND failure_code IS NULL AND claimed_at IS NULL AND completed_at IS NULL
 AND EXISTS(SELECT 1 FROM core.knowledge_index_obligations k WHERE k.id=operation_id));
