-- Apply after identity 0002 (and independently reviewed 0003..0006).
-- Engineering operational controls, not a clinical/financial consent policy.
GRANT USAGE ON SCHEMA core TO k_jobs_runtime;
CREATE TABLE core.identity_web_rate_windows (
  bucket_hash text NOT NULL CHECK (bucket_hash ~ '^[A-Za-z0-9_-]{43}$'),
  lane text NOT NULL CHECK (lane IN ('auth-global','auth-ip','start','authorize','callback','session','context','logout','provider-global','provider-ip','provider-actor')),
  window_start timestamptz NOT NULL,
  hits integer NOT NULL CHECK (hits BETWEEN 1 AND 100000),
  expires_at timestamptz NOT NULL,
  lock_guard boolean,
  PRIMARY KEY(bucket_hash,lane,window_start),
  CHECK (expires_at=window_start+interval '2 minutes')
);
CREATE INDEX identity_web_rate_expiry ON core.identity_web_rate_windows(expires_at);
ALTER TABLE core.identity_web_rate_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.identity_web_rate_windows FORCE ROW LEVEL SECURITY;
CREATE POLICY web_rate_owner ON core.identity_web_rate_windows TO CURRENT_USER USING(true) WITH CHECK(true);
CREATE POLICY web_rate_core_read ON core.identity_web_rate_windows FOR SELECT TO k_core_runtime
  USING(current_setting('identity.web_admission',true)='true');
CREATE POLICY web_rate_core_insert ON core.identity_web_rate_windows FOR INSERT TO k_core_runtime
  WITH CHECK(current_setting('identity.web_admission',true)='true');
CREATE POLICY web_rate_core_update ON core.identity_web_rate_windows FOR UPDATE TO k_core_runtime
  USING(current_setting('identity.web_admission',true)='true') WITH CHECK(current_setting('identity.web_admission',true)='true');
CREATE POLICY web_rate_jobs_read ON core.identity_web_rate_windows FOR SELECT TO k_jobs_runtime USING(true);
CREATE POLICY web_rate_jobs_delete ON core.identity_web_rate_windows FOR DELETE TO k_jobs_runtime USING(expires_at<=clock_timestamp());
CREATE POLICY web_rate_jobs_lock ON core.identity_web_rate_windows FOR UPDATE TO k_jobs_runtime USING(expires_at<=clock_timestamp()) WITH CHECK(false);
GRANT SELECT,INSERT ON core.identity_web_rate_windows TO k_core_runtime;
GRANT UPDATE(hits) ON core.identity_web_rate_windows TO k_core_runtime;
GRANT SELECT,DELETE ON core.identity_web_rate_windows TO k_jobs_runtime;
GRANT UPDATE(lock_guard) ON core.identity_web_rate_windows TO k_jobs_runtime;

ALTER TABLE core.identity_web_sessions
  ADD COLUMN logout_lease_token uuid,
  ADD COLUMN logout_lease_until timestamptz,
  ADD COLUMN logout_attempts integer NOT NULL DEFAULT 0 CHECK(logout_attempts BETWEEN 0 AND 1000000),
  ADD COLUMN logout_next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  ADD COLUMN logout_last_failure text CHECK(logout_last_failure IN ('provider_unavailable','provider_state_invalid','provider_still_active','budget_exhausted')),
  ADD COLUMN provider_revoked_at timestamptz,
  ADD CONSTRAINT web_logout_lease_pair CHECK ((logout_lease_token IS NULL)=(logout_lease_until IS NULL)),
  ADD CONSTRAINT web_pending_is_locally_revoked CHECK (NOT revocation_pending OR revoked_at IS NOT NULL);
CREATE INDEX identity_web_logout_due ON core.identity_web_sessions(logout_next_attempt_at,handle_hash) WHERE revocation_pending;
CREATE INDEX identity_web_session_expiry ON core.identity_web_sessions(expires_at,handle_hash);
CREATE INDEX identity_web_attempt_expiry ON core.identity_web_attempts(expires_at);

-- Give the immediate HTTP revoke a bounded quiet window before Cron reconciliation.
-- Failed/pending logout remains durable regardless of credential/session expiry.
CREATE FUNCTION core.identity_web_logout_schedule() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,core AS $$
BEGIN
  IF NEW.revocation_pending AND NOT OLD.revocation_pending THEN
    NEW.logout_next_attempt_at := clock_timestamp()+interval '30 seconds';
    NEW.logout_lease_token := NULL; NEW.logout_lease_until := NULL;
    NEW.logout_attempts := 0; NEW.logout_last_failure := NULL;
    NEW.provider_revoked_at := NULL;
  ELSIF OLD.revocation_pending AND NOT NEW.revocation_pending THEN
    NEW.provider_revoked_at := coalesce(NEW.provider_revoked_at,clock_timestamp());
    NEW.logout_lease_token := NULL; NEW.logout_lease_until := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION core.identity_web_logout_schedule() FROM PUBLIC;
CREATE TRIGGER web_logout_schedule BEFORE UPDATE OF revocation_pending ON core.identity_web_sessions
  FOR EACH ROW EXECUTE FUNCTION core.identity_web_logout_schedule();

-- Jobs may inspect/lock only actors and provider session references represented by
-- the web ledger. The existing authority fence still serializes domain transactions.
GRANT SELECT ON core.identity_actors,core.identity_sessions,core.identity_web_sessions,core.identity_web_attempts TO k_jobs_runtime;
GRANT UPDATE(lock_guard) ON core.identity_actors TO k_jobs_runtime;
CREATE POLICY web_jobs_actor_read ON core.identity_actors FOR SELECT TO k_jobs_runtime
  USING(EXISTS(SELECT 1 FROM core.identity_web_sessions w WHERE w.actor_id=identity_actors.id));
CREATE POLICY web_jobs_actor_lock ON core.identity_actors FOR UPDATE TO k_jobs_runtime
  USING(EXISTS(SELECT 1 FROM core.identity_web_sessions w WHERE w.actor_id=identity_actors.id)) WITH CHECK(false);
CREATE POLICY web_jobs_provider_read ON core.identity_sessions FOR SELECT TO k_jobs_runtime
  USING(EXISTS(SELECT 1 FROM core.identity_web_sessions w WHERE w.session_id=identity_sessions.id AND w.actor_id=identity_sessions.actor_id));
CREATE POLICY web_jobs_session_read ON core.identity_web_sessions FOR SELECT TO k_jobs_runtime USING(true);
CREATE POLICY web_jobs_session_update ON core.identity_web_sessions FOR UPDATE TO k_jobs_runtime
  USING(revoked_at IS NOT NULL OR expires_at<=clock_timestamp())
  WITH CHECK(revoked_at IS NOT NULL OR expires_at<=clock_timestamp());
CREATE POLICY web_jobs_session_delete ON core.identity_web_sessions FOR DELETE TO k_jobs_runtime
  USING(NOT revocation_pending AND expires_at+interval '24 hours'<=clock_timestamp()
    AND (logout_lease_until IS NULL OR logout_lease_until<=clock_timestamp()));
GRANT UPDATE(access_token_ciphertext,revocation_pending,logout_lease_token,logout_lease_until,
  logout_attempts,logout_next_attempt_at,logout_last_failure,provider_revoked_at)
  ON core.identity_web_sessions TO k_jobs_runtime;
GRANT DELETE ON core.identity_web_sessions TO k_jobs_runtime;
CREATE POLICY web_jobs_attempt_read ON core.identity_web_attempts FOR SELECT TO k_jobs_runtime USING(expires_at<=clock_timestamp());
CREATE POLICY web_jobs_attempt_delete ON core.identity_web_attempts FOR DELETE TO k_jobs_runtime USING(expires_at<=clock_timestamp());
GRANT DELETE ON core.identity_web_attempts TO k_jobs_runtime;
GRANT UPDATE(lock_guard) ON core.identity_web_attempts TO k_jobs_runtime;
CREATE POLICY web_jobs_attempt_lock ON core.identity_web_attempts FOR UPDATE TO k_jobs_runtime USING(expires_at<=clock_timestamp()) WITH CHECK(false);
-- Admission only reads the capped pending backlog; no raw data is returned by HTTP.
CREATE POLICY web_admission_backlog ON core.identity_web_sessions FOR SELECT TO k_core_runtime
  USING(current_setting('identity.web_admission',true)='true');
GRANT SELECT ON core.identity_web_rate_windows TO k_backup_runtime;
CREATE POLICY web_rate_backup ON core.identity_web_rate_windows FOR SELECT TO k_backup_runtime USING(true);
