-- Only pre-reviewed public knowledge; never patient notes or conversations.
CREATE TABLE core.knowledge_sources (
 source_id uuid NOT NULL, revision integer NOT NULL CHECK(revision>0),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'), public_url text NOT NULL,
 public_rights_evidence_id uuid NOT NULL, revoked_at timestamptz,
 PRIMARY KEY(source_id,revision)
);
ALTER TABLE core.knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.knowledge_sources FORCE ROW LEVEL SECURITY;
GRANT SELECT ON core.knowledge_sources TO k_core_runtime,k_backup_runtime;
GRANT UPDATE(revoked_at) ON core.knowledge_sources TO k_core_runtime;
CREATE POLICY knowledge_sources_read ON core.knowledge_sources FOR SELECT TO k_core_runtime,k_backup_runtime USING(true);
CREATE POLICY knowledge_sources_lock ON core.knowledge_sources FOR UPDATE TO k_core_runtime USING(true) WITH CHECK(false);
CREATE TABLE core.knowledge_grants (
 id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES core.identity_actors(id),
 organization_id uuid NOT NULL,
 permission text NOT NULL CHECK(permission IN ('edit','approve','withdraw','manage-product')),
 scope text NOT NULL CHECK(scope IN ('catalogue','institution')),
 product_id uuid, language text NOT NULL CHECK(language IN ('en','ml','ta')),
 kind text NOT NULL, display_name text NOT NULL,
 authority_version integer NOT NULL CHECK(authority_version>0), evidence_id uuid NOT NULL,
 physician_qualified boolean NOT NULL DEFAULT false,
 valid_from timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 revoked_at timestamptz, lock_guard boolean,
 CHECK(expires_at>valid_from)
);
ALTER TABLE core.knowledge_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.knowledge_grants FORCE ROW LEVEL SECURITY;
GRANT SELECT ON core.knowledge_grants TO k_core_runtime,k_backup_runtime;
GRANT UPDATE(lock_guard) ON core.knowledge_grants TO k_core_runtime;
CREATE POLICY knowledge_grant_read ON core.knowledge_grants FOR SELECT TO k_core_runtime,k_backup_runtime USING(true);
CREATE POLICY knowledge_grant_lock ON core.knowledge_grants FOR UPDATE TO k_core_runtime USING(true) WITH CHECK(false);
-- Public approval checks may inspect only actors with explicit knowledge grants.
-- No HTTP response exposes provider identity columns. Provisioning remains admin-only.
CREATE POLICY identity_knowledge_reviewer ON core.identity_actors FOR SELECT TO k_core_runtime
 USING(EXISTS(SELECT 1 FROM core.knowledge_grants g WHERE g.actor_id=identity_actors.id));
CREATE TABLE core.knowledge_entries (
 entry_id uuid PRIMARY KEY, record jsonb NOT NULL,
 CHECK (record->'content'->>'visibility' = 'public'),
 CHECK (record->'content'->>'entryId' = entry_id::text),
 CHECK (record->>'state' IN ('draft','approved','withdrawn'))
);
CREATE TABLE core.knowledge_history (
 event_id uuid PRIMARY KEY, entry_id uuid NOT NULL REFERENCES core.knowledge_entries,
 record jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX knowledge_history_identity ON core.knowledge_history
 (entry_id, (record->'content'->>'revision'), (record->>'state'));
CREATE TABLE core.knowledge_products (
 product_id uuid PRIMARY KEY, manifest jsonb NOT NULL,
 CHECK (manifest->>'productId' = product_id::text)
);
CREATE TABLE core.knowledge_terms (
 product_id uuid NOT NULL REFERENCES core.knowledge_products,
 term text NOT NULL CHECK (length(term) BETWEEN 1 AND 200),
 origin text NOT NULL CHECK (origin IN ('exact','alias','keyword')),
 PRIMARY KEY(product_id,term,origin)
);
-- Atomic domain ledger, NOT a competing queue. Platform bridge registration is
-- required before indexing is enabled. References only; no unreviewed text.
CREATE TABLE core.knowledge_index_obligations (
 id uuid PRIMARY KEY, entry_id uuid NOT NULL REFERENCES core.knowledge_entries,
 reference jsonb NOT NULL, action text NOT NULL CHECK(action IN ('refresh','remove')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), completed_at timestamptz
);
GRANT USAGE ON SCHEMA core TO k_core_runtime;
GRANT SELECT,INSERT,UPDATE ON core.knowledge_entries,core.knowledge_products TO k_core_runtime;
GRANT SELECT,INSERT ON core.knowledge_history,core.knowledge_index_obligations TO k_core_runtime;
GRANT SELECT,INSERT,DELETE ON core.knowledge_terms TO k_core_runtime;
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['knowledge_entries','knowledge_products','knowledge_history','knowledge_terms','knowledge_index_obligations'] LOOP
  EXECUTE format('ALTER TABLE core.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE core.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('GRANT SELECT ON core.%I TO k_backup_runtime',t);
  EXECUTE format('CREATE POLICY knowledge_read ON core.%I FOR SELECT TO k_core_runtime,k_backup_runtime USING(true)',t);
  EXECUTE format('CREATE POLICY knowledge_insert ON core.%I FOR INSERT TO k_core_runtime WITH CHECK(current_setting(''app.knowledge_write'',true) = ''authorized'')',t);
 END LOOP;
END $$;
CREATE POLICY knowledge_update ON core.knowledge_entries FOR UPDATE TO k_core_runtime
 USING(true)
 WITH CHECK(current_setting('app.knowledge_write',true) = 'authorized');
CREATE POLICY knowledge_update ON core.knowledge_products FOR UPDATE TO k_core_runtime
 USING(true)
 WITH CHECK(current_setting('app.knowledge_write',true) = 'authorized');
CREATE POLICY knowledge_delete ON core.knowledge_terms FOR DELETE TO k_core_runtime
 USING(current_setting('app.knowledge_write',true) = 'authorized');

-- Unreleased migration additive authoring follow-up. View is independently
-- provisioned; workspace membership and mutation permissions never imply it.
ALTER TABLE core.knowledge_grants DROP CONSTRAINT knowledge_grants_permission_check;
ALTER TABLE core.knowledge_grants ADD CONSTRAINT knowledge_grants_permission_check
 CHECK(permission IN ('view','edit','approve','withdraw','manage-product'));
