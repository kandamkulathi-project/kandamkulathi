-- Bounded P1 test notice only. No account linking, marketing or financial outbox permissions.
-- Controlled administration alone provisions/revokes explicit approved capabilities.
CREATE TABLE engagement.channel_notice_capabilities (
  id uuid PRIMARY KEY,
  revision integer NOT NULL CHECK (revision > 0),
  capability jsonb NOT NULL CHECK (jsonb_typeof(capability) = 'object'),
  used integer NOT NULL DEFAULT 0 CHECK (used >= 0)
);
CREATE TABLE engagement.channel_notices (
  inbox_id uuid PRIMARY KEY REFERENCES engagement.mathew_channel_inbox(id),
  operation_id uuid NOT NULL UNIQUE REFERENCES engagement.mathew_channel_processing(operation_id),
  capability_id uuid REFERENCES engagement.channel_notice_capabilities(id),
  capability_revision integer,
  state text NOT NULL CHECK (state IN ('sending','accepted','rejected','unknown','suppressed')),
  suppression_reason text CHECK (suppression_reason IN ('configuration_unavailable','approval_unavailable','ineligible')),
  lease_token uuid NOT NULL,
  provider_message_id text UNIQUE CHECK (length(provider_message_id) BETWEEN 1 AND 256),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((state = 'accepted') = (provider_message_id IS NOT NULL)),
  CHECK ((state = 'suppressed') = (suppression_reason IS NOT NULL)),
  CHECK (state='suppressed' OR (capability_id IS NOT NULL AND capability_revision IS NOT NULL))
);
GRANT SELECT ON engagement.channel_notice_capabilities,engagement.channel_notices TO k_jobs_runtime,k_backup_runtime;
-- Lock-only privilege; runtime cannot change approvals or the materialized usage counter.
GRANT UPDATE(revision) ON engagement.channel_notice_capabilities TO k_jobs_runtime;
GRANT INSERT ON engagement.channel_notices TO k_jobs_runtime;
GRANT UPDATE(state,provider_message_id) ON engagement.channel_notices TO k_jobs_runtime;
ALTER TABLE engagement.channel_notice_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement.channel_notice_capabilities FORCE ROW LEVEL SECURITY;
ALTER TABLE engagement.channel_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement.channel_notices FORCE ROW LEVEL SECURITY;
CREATE POLICY notice_cap_read ON engagement.channel_notice_capabilities FOR SELECT TO k_jobs_runtime,k_backup_runtime USING (true);
CREATE POLICY notice_cap_lock ON engagement.channel_notice_capabilities FOR UPDATE TO k_jobs_runtime
  USING (true) WITH CHECK (false);
-- CURRENT_USER is the controlled migration owner, not any runtime login. FORCE RLS stays enabled.
CREATE POLICY notice_cap_owner_read ON engagement.channel_notice_capabilities FOR SELECT TO CURRENT_USER USING (true);
CREATE POLICY notice_cap_owner_insert ON engagement.channel_notice_capabilities FOR INSERT TO CURRENT_USER WITH CHECK (used=0);
CREATE POLICY notice_cap_owner_update ON engagement.channel_notice_capabilities FOR UPDATE TO CURRENT_USER USING (true) WITH CHECK (true);
CREATE POLICY notice_owner_read ON engagement.channel_notices FOR SELECT TO CURRENT_USER USING (true);
CREATE POLICY notice_read ON engagement.channel_notices FOR SELECT TO k_jobs_runtime,k_backup_runtime USING (true);
CREATE POLICY notice_insert ON engagement.channel_notices FOR INSERT TO k_jobs_runtime WITH CHECK (
  state IN ('sending','suppressed') AND EXISTS (
    SELECT 1 FROM engagement.mathew_channel_processing p JOIN platform.outbox o ON o.operation_id=p.operation_id
    WHERE p.inbox_id=channel_notices.inbox_id AND p.operation_id=channel_notices.operation_id
      AND o.subject_id=p.inbox_id AND o.kind='engagement.notify' AND o.channel='engagement'
      AND o.status='processing' AND o.lease_token=channel_notices.lease_token
      AND o.lease_until>clock_timestamp() AND o.deadline_at>clock_timestamp()
  )
);
CREATE POLICY notice_update ON engagement.channel_notices FOR UPDATE TO k_jobs_runtime
  USING (true) WITH CHECK (
    state='unknown' OR (state IN ('accepted','rejected') AND EXISTS (
      SELECT 1 FROM platform.outbox o WHERE o.operation_id=channel_notices.operation_id
        AND o.subject_id=channel_notices.inbox_id AND o.lease_token=channel_notices.lease_token
        AND o.kind='engagement.notify' AND o.channel='engagement' AND o.status='processing'
        AND o.lease_until>clock_timestamp() AND o.deadline_at>clock_timestamp()
    ))
  );

-- Consumption is coupled to inserting a unique, leased send reservation. No caller-supplied
-- counter, reset or arbitrary increment is exposed to jobs. Owner administration cannot reset it.
CREATE FUNCTION engagement.channel_notice_preserve_usage() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF NEW.used <> OLD.used AND (pg_trigger_depth() <> 2 OR NEW.used <> OLD.used+1) THEN
    RAISE EXCEPTION 'Notice usage may only be consumed by a send reservation';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION engagement.channel_notice_preserve_usage() FROM PUBLIC;
CREATE TRIGGER channel_notice_preserve_usage BEFORE UPDATE OF used
ON engagement.channel_notice_capabilities FOR EACH ROW EXECUTE FUNCTION engagement.channel_notice_preserve_usage();

CREATE FUNCTION engagement.channel_notice_consume_usage() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF NEW.state='sending' THEN
    UPDATE engagement.channel_notice_capabilities SET used=used+1
    WHERE id=NEW.capability_id AND revision=NEW.capability_revision
      AND (capability->>'enabled')::boolean
      AND (capability->>'expiresAt')::timestamptz>clock_timestamp()
      AND used<(capability->>'maxNotices')::integer;
    IF NOT FOUND THEN RAISE EXCEPTION 'Notice capability cannot consume quota'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION engagement.channel_notice_consume_usage() FROM PUBLIC;
CREATE TRIGGER channel_notice_consume_usage AFTER INSERT
ON engagement.channel_notices FOR EACH ROW EXECUTE FUNCTION engagement.channel_notice_consume_usage();
