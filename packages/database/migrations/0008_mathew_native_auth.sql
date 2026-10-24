-- Additive native protocol only. No accounts, policies, grants, MFA or redirects seeded.
GRANT USAGE ON SCHEMA core TO k_jobs_runtime;
CREATE TABLE core.identity_native_attempts (
  state_hash text PRIMARY KEY CHECK (state_hash ~ '^[A-Za-z0-9_-]{43}$'),
  redirect_uri text NOT NULL CHECK (length(redirect_uri)<=256),
  challenge text NOT NULL CHECK (challenge ~ '^[A-Za-z0-9_-]{43}$'),
  expires_at timestamptz NOT NULL, consumed_at timestamptz
);
CREATE TABLE core.identity_native_sessions (
  handle_hash text PRIMARY KEY CHECK (handle_hash ~ '^[A-Za-z0-9_-]{43}$'),
  actor_id uuid NOT NULL REFERENCES core.identity_actors(id),
  session_id uuid NOT NULL,
  provider_user_id text NOT NULL CHECK (provider_user_id ~ '^user_[A-Za-z0-9]+$'),
  provider_session_id text NOT NULL CHECK (provider_session_id ~ '^session_[A-Za-z0-9]+$'),
  access_ciphertext text NOT NULL CHECK (length(access_ciphertext)<=32768),
  lock_guard boolean NOT NULL DEFAULT false CHECK (NOT lock_guard),
  expires_at timestamptz NOT NULL, revoked_at timestamptz, logout_key_hash text,
  pending boolean NOT NULL DEFAULT false,
  lease_token uuid, lease_until timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 1000000),
  CHECK (NOT pending OR revoked_at IS NOT NULL),
  CHECK ((lease_token IS NULL)=(lease_until IS NULL)),
  CHECK (logout_key_hash IS NULL OR logout_key_hash ~ '^[A-Za-z0-9_-]{43}$'),
  FOREIGN KEY(session_id,actor_id) REFERENCES core.identity_sessions(id,actor_id)
);
CREATE INDEX identity_native_pending ON core.identity_native_sessions(next_attempt_at,handle_hash) WHERE pending;
CREATE TABLE core.identity_native_rates (
  lane text PRIMARY KEY CHECK (lane IN ('start','exchange','session','logout','provider')),
  window_start timestamptz NOT NULL, hits integer NOT NULL CHECK (hits BETWEEN 1 AND 600)
);
ALTER TABLE core.identity_native_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.identity_native_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE core.identity_native_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.identity_native_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE core.identity_native_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.identity_native_rates FORCE ROW LEVEL SECURITY;
-- Match 0002's controlled migration owner policies; runtime cannot inherit this owner.
CREATE POLICY native_controlled_owner ON core.identity_native_attempts TO CURRENT_USER USING(true) WITH CHECK(true);
CREATE POLICY native_controlled_owner ON core.identity_native_sessions TO CURRENT_USER USING(true) WITH CHECK(true);
CREATE POLICY native_controlled_owner ON core.identity_native_rates TO CURRENT_USER USING(true) WITH CHECK(true);
CREATE POLICY native_attempt_self ON core.identity_native_attempts TO k_core_runtime
  USING (state_hash=current_setting('identity.native_state',true))
  WITH CHECK (state_hash=current_setting('identity.native_state',true));
CREATE POLICY native_session_self ON core.identity_native_sessions TO k_core_runtime
  USING (handle_hash=current_setting('identity.native_handle',true))
  WITH CHECK (handle_hash=current_setting('identity.native_handle',true));
GRANT SELECT ON core.identity_native_attempts,core.identity_native_sessions TO k_core_runtime;
-- An inert column permits FOR SHARE; runtime cannot reset consumed/revoked state or expiry.
GRANT UPDATE(lock_guard) ON core.identity_native_sessions TO k_core_runtime;

-- Fixed cardinality admission, global hard caps; no attacker-controlled keys or raw IPs.
CREATE FUNCTION core.native_auth_admit(p_lane text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE cap integer; count_hit integer;
BEGIN
  cap := CASE p_lane WHEN 'start' THEN 30 WHEN 'exchange' THEN 30 WHEN 'session' THEN 120
    WHEN 'logout' THEN 30 WHEN 'provider' THEN 240 ELSE NULL END;
  IF cap IS NULL THEN RETURN false; END IF;
  INSERT INTO core.identity_native_rates(lane,window_start,hits)
    VALUES(p_lane,date_trunc('minute',clock_timestamp()),1)
    ON CONFLICT(lane) DO UPDATE SET
      window_start=EXCLUDED.window_start,
      hits=CASE WHEN identity_native_rates.window_start=EXCLUDED.window_start THEN identity_native_rates.hits+1 ELSE 1 END
    WHERE identity_native_rates.window_start<>EXCLUDED.window_start OR identity_native_rates.hits<cap
    RETURNING hits INTO count_hit;
  RETURN count_hit IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION core.native_auth_admit(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.native_auth_admit(text) TO k_core_runtime,k_jobs_runtime;

-- Fixed lock order serializes capacity checks. Consumed state remains until TTL cleanup.
CREATE FUNCTION core.native_auth_start(p_state text,p_redirect text,p_challenge text,p_expiry timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(3825,8);
  IF p_expiry<=clock_timestamp() OR p_expiry>clock_timestamp()+interval '601 seconds' THEN RETURN false; END IF;
  IF (SELECT count(*) FROM core.identity_native_attempts)>=600 OR
     (SELECT count(*) FROM core.identity_native_sessions)>=5000 THEN RETURN false; END IF;
  INSERT INTO core.identity_native_attempts(state_hash,redirect_uri,challenge,expires_at,consumed_at)
    VALUES(p_state,p_redirect,p_challenge,p_expiry,NULL)
    ON CONFLICT DO NOTHING;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION core.native_auth_start(text,text,text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.native_auth_start(text,text,text,timestamptz) TO k_core_runtime;

CREATE FUNCTION core.native_auth_consume(p_state text,p_redirect text,p_challenge text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN
  UPDATE core.identity_native_attempts SET consumed_at=clock_timestamp()
    WHERE state_hash=p_state AND redirect_uri=p_redirect AND challenge=p_challenge
    AND consumed_at IS NULL AND expires_at>clock_timestamp();
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION core.native_auth_consume(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.native_auth_consume(text,text,text) TO k_core_runtime;

-- Server passes only cryptographically verified provider attributes. Known active actors only.
-- No actor creation, grants, consent, MFA, existing-session refresh or resurrection.
CREATE FUNCTION core.native_auth_enroll(p_handle text,p_user text,p_session text,p_provider_org text,
  p_org uuid,p_issued timestamptz,p_provider_expiry timestamptz,p_expiry timestamptz,p_ciphertext text)
RETURNS TABLE(actor_id uuid,session_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE a core.identity_actors%ROWTYPE; s core.identity_sessions%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(3825,8);
  IF (SELECT count(*) FROM core.identity_native_sessions)>=5000 THEN RETURN; END IF;
  IF p_user !~ '^user_[A-Za-z0-9]+$' OR p_session !~ '^session_[A-Za-z0-9]+$'
    OR (p_provider_org IS NULL)<>(p_org IS NULL) OR p_issued>clock_timestamp()
    OR p_expiry<=clock_timestamp() OR p_expiry>p_provider_expiry
    OR p_expiry>clock_timestamp()+interval '901 seconds' THEN RETURN; END IF;
  PERFORM singleton FROM core.identity_policy FOR SHARE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO a FROM core.identity_actors WHERE provider_user_id=p_user FOR UPDATE;
  IF NOT FOUND OR a.status<>'active' THEN RETURN; END IF;
  INSERT INTO core.identity_sessions(id,actor_id,provider_user_id,provider_session_id,provider_organization_id,
    organization_id,authenticated_at,expires_at)
    VALUES(gen_random_uuid(),a.id,p_user,p_session,p_provider_org,p_org,p_issued,p_provider_expiry)
    ON CONFLICT(provider_session_id) DO NOTHING;
  SELECT * INTO s FROM core.identity_sessions WHERE provider_session_id=p_session FOR SHARE;
  IF s.actor_id<>a.id OR s.provider_user_id<>p_user OR s.provider_organization_id IS DISTINCT FROM p_provider_org
    OR s.organization_id IS DISTINCT FROM p_org OR s.revoked_at IS NOT NULL OR s.expires_at<=clock_timestamp() THEN RETURN; END IF;
  INSERT INTO core.identity_native_sessions(handle_hash,actor_id,session_id,provider_user_id,provider_session_id,access_ciphertext,expires_at)
    VALUES(p_handle,a.id,s.id,p_user,p_session,p_ciphertext,least(p_expiry,s.expires_at));
  RETURN QUERY SELECT a.id,s.id;
END $$;
REVOKE ALL ON FUNCTION core.native_auth_enroll(text,text,text,text,uuid,timestamptz,timestamptz,timestamptz,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.native_auth_enroll(text,text,text,text,uuid,timestamptz,timestamptz,timestamptz,text) TO k_core_runtime;

-- Atomic local revocation also fences direct provider JWT bearer use of this internal session.
CREATE FUNCTION core.native_auth_revoke(p_handle text,p_actor uuid,p_session uuid,p_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN
  PERFORM id FROM core.identity_actors WHERE id=p_actor AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM id FROM core.identity_sessions WHERE id=p_session AND actor_id=p_actor
    AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE core.identity_native_sessions SET revoked_at=clock_timestamp(),pending=true,logout_key_hash=p_key,access_ciphertext='purged'
    WHERE handle_hash=p_handle AND actor_id=p_actor AND session_id=p_session AND revoked_at IS NULL AND expires_at>clock_timestamp();
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE core.identity_sessions SET revoked_at=clock_timestamp() WHERE id=p_session AND actor_id=p_actor;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION core.native_auth_revoke(text,uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.native_auth_revoke(text,uuid,uuid,text) TO k_core_runtime;

-- Jobs role has only native ledger lifecycle access; no actor/grant enrollment privileges.
GRANT SELECT,DELETE ON core.identity_native_attempts,core.identity_native_sessions TO k_jobs_runtime;
GRANT UPDATE(lease_token,lease_until,next_attempt_at,attempts,pending,access_ciphertext)
  ON core.identity_native_sessions TO k_jobs_runtime;
-- Required for SELECT FOR UPDATE during bounded attempt cleanup, never state reset.
ALTER TABLE core.identity_native_attempts ADD COLUMN lock_guard boolean NOT NULL DEFAULT false CHECK(NOT lock_guard);
GRANT UPDATE(lock_guard) ON core.identity_native_attempts TO k_jobs_runtime;
CREATE POLICY native_attempt_jobs ON core.identity_native_attempts TO k_jobs_runtime USING(true) WITH CHECK(true);
CREATE POLICY native_session_jobs ON core.identity_native_sessions TO k_jobs_runtime USING(true) WITH CHECK(true);
GRANT SELECT ON core.identity_native_attempts,core.identity_native_sessions,core.identity_native_rates TO k_backup_runtime;
CREATE POLICY native_attempt_backup ON core.identity_native_attempts FOR SELECT TO k_backup_runtime USING(true);
CREATE POLICY native_session_backup ON core.identity_native_sessions FOR SELECT TO k_backup_runtime USING(true);
CREATE POLICY native_rate_backup ON core.identity_native_rates FOR SELECT TO k_backup_runtime USING(true);
