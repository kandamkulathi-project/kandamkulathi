-- Private authenticated channel ingress. Transport identity never establishes account identity.
CREATE TABLE engagement.mathew_channel_inbox (
  id uuid PRIMARY KEY,
  semantic_key text NOT NULL UNIQUE CHECK (length(semantic_key) BETWEEN 1 AND 2048),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  event jsonb NOT NULL CHECK (jsonb_typeof(event) = 'object'),
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','awaiting_human')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0)
);
CREATE TABLE engagement.mathew_channel_processing (
  inbox_id uuid PRIMARY KEY REFERENCES engagement.mathew_channel_inbox(id),
  operation_id uuid NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','awaiting_human')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- These are private ingress stores, accessible only to trusted server transport and jobs roles.
GRANT USAGE ON SCHEMA engagement TO k_core_runtime,k_jobs_runtime,k_backup_runtime;
GRANT SELECT,INSERT ON engagement.mathew_channel_inbox,engagement.mathew_channel_processing TO k_core_runtime;
GRANT SELECT ON engagement.mathew_channel_inbox,engagement.mathew_channel_processing TO k_jobs_runtime;
GRANT UPDATE(state) ON engagement.mathew_channel_inbox,engagement.mathew_channel_processing TO k_jobs_runtime;
GRANT SELECT ON engagement.mathew_channel_inbox,engagement.mathew_channel_processing TO k_backup_runtime;
ALTER TABLE engagement.mathew_channel_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement.mathew_channel_inbox FORCE ROW LEVEL SECURITY;
ALTER TABLE engagement.mathew_channel_processing ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement.mathew_channel_processing FORCE ROW LEVEL SECURITY;
CREATE POLICY channel_inbox_read ON engagement.mathew_channel_inbox FOR SELECT TO k_core_runtime,k_jobs_runtime,k_backup_runtime USING (true);
CREATE POLICY channel_inbox_insert ON engagement.mathew_channel_inbox FOR INSERT TO k_core_runtime WITH CHECK (state = 'pending' AND revision = 1);
CREATE POLICY channel_inbox_update ON engagement.mathew_channel_inbox FOR UPDATE TO k_jobs_runtime USING (true) WITH CHECK (state = 'awaiting_human' AND revision = 1);
CREATE POLICY channel_processing_read ON engagement.mathew_channel_processing FOR SELECT TO k_core_runtime,k_jobs_runtime,k_backup_runtime USING (true);
CREATE POLICY channel_processing_insert ON engagement.mathew_channel_processing FOR INSERT TO k_core_runtime WITH CHECK (state = 'pending');
CREATE POLICY channel_processing_update ON engagement.mathew_channel_processing FOR UPDATE TO k_jobs_runtime USING (true) WITH CHECK (state = 'awaiting_human');
