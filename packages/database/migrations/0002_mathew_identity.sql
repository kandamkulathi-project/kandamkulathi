-- Additive identity candidate. Controlled operator applies AFTER platform migrations.
-- No policy versions, roles, grants, accounts or MFA evidence are seeded.
GRANT USAGE ON SCHEMA core TO k_core_runtime, k_backup_runtime;
CREATE TABLE core.identity_actors (
  id uuid PRIMARY KEY,
  provider_user_id text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('active','disabled')),
  UNIQUE (id, provider_user_id)
);
CREATE TABLE core.identity_sessions (
  id uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES core.identity_actors(id),
  provider_user_id text NOT NULL,
  provider_session_id text NOT NULL UNIQUE,
  provider_organization_id text,
  organization_id uuid,
  authenticated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  -- Only independently verified server enrollment/step-up may populate these fields.
  mfa_verified_at timestamptz,
  mfa_expires_at timestamptz,
  mfa_evidence_reference text,
  CHECK ((provider_organization_id IS NULL) = (organization_id IS NULL)),
  CHECK ((mfa_verified_at IS NULL) = (mfa_expires_at IS NULL)),
  CHECK (mfa_verified_at IS NULL OR length(mfa_evidence_reference) > 0 AND mfa_evidence_reference IS NOT NULL),
  CHECK (expires_at > authenticated_at),
  CHECK (mfa_expires_at > mfa_verified_at),
  FOREIGN KEY (actor_id, provider_user_id) REFERENCES core.identity_actors(id, provider_user_id)
);
CREATE TABLE core.identity_policy (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  privacy_version text NOT NULL CHECK (length(privacy_version) BETWEEN 1 AND 128),
  consultation_version text NOT NULL CHECK (length(consultation_version) BETWEEN 1 AND 128),
  marketing_version text NOT NULL CHECK (length(marketing_version) BETWEEN 1 AND 128),
  approval_reference text NOT NULL CHECK (length(approval_reference) > 0)
);
CREATE TABLE core.identity_memberships (
  id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES core.identity_actors(id),
  record jsonb NOT NULL CHECK (record->>'id' = id::text)
);
CREATE TABLE core.identity_patient_links (
  actor_id uuid NOT NULL REFERENCES core.identity_actors(id), patient_id uuid NOT NULL,
  record jsonb NOT NULL CHECK (record->>'patientId' = patient_id::text),
  PRIMARY KEY (actor_id, patient_id)
);
CREATE TABLE core.identity_assignments (
  id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES core.identity_actors(id),
  patient_actor_id uuid NOT NULL REFERENCES core.identity_actors(id),
  record jsonb NOT NULL CHECK (record->>'id' = id::text AND record->>'patientActorId' = patient_actor_id::text)
);
CREATE TABLE core.identity_consents (
  id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES core.identity_actors(id),
  record jsonb NOT NULL CHECK (record->>'id' = id::text AND record->>'actorId' = actor_id::text
    AND record->>'recordedByActorId' = actor_id::text)
);
ALTER TABLE core.identity_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.identity_actors FORCE ROW LEVEL SECURITY;
CREATE POLICY identity_actor_read ON core.identity_actors FOR SELECT TO k_core_runtime
  USING (id::text = current_setting('identity.actor_id', true));
ALTER TABLE core.identity_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.identity_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY identity_session_read ON core.identity_sessions FOR SELECT TO k_core_runtime
  USING (provider_user_id = current_setting('identity.provider_user', true)
    AND provider_session_id = current_setting('identity.provider_session', true)
    OR (id::text = current_setting('identity.internal_session', true)
      AND actor_id::text = current_setting('identity.actor_id', true)));
ALTER TABLE core.identity_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.identity_policy FORCE ROW LEVEL SECURITY;
CREATE POLICY identity_policy_read ON core.identity_policy FOR SELECT TO k_core_runtime USING (true);
ALTER TABLE core.identity_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.identity_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY identity_membership_read ON core.identity_memberships FOR SELECT TO k_core_runtime
  USING (actor_id::text = current_setting('identity.actor_id', true));
ALTER TABLE core.identity_patient_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.identity_patient_links FORCE ROW LEVEL SECURITY;
CREATE POLICY identity_link_read ON core.identity_patient_links FOR SELECT TO k_core_runtime
  USING (actor_id::text = current_setting('identity.actor_id', true));
ALTER TABLE core.identity_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.identity_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY identity_assignment_read ON core.identity_assignments FOR SELECT TO k_core_runtime
  USING (actor_id::text = current_setting('identity.actor_id', true));
ALTER TABLE core.identity_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.identity_consents FORCE ROW LEVEL SECURITY;
CREATE POLICY identity_consent_read ON core.identity_consents FOR SELECT TO k_core_runtime
  USING (actor_id::text = current_setting('identity.actor_id', true) OR EXISTS (
    SELECT 1 FROM core.identity_assignments a WHERE a.patient_actor_id = identity_consents.actor_id
      AND a.record->>'revokedAt' IS NULL AND (a.record->>'validFrom')::timestamptz <= now()
      AND (a.record->>'expiresAt')::timestamptz > now()));
CREATE POLICY identity_consent_insert ON core.identity_consents FOR INSERT TO k_core_runtime
  WITH CHECK (actor_id::text = current_setting('identity.actor_id', true));
GRANT SELECT ON core.identity_actors, core.identity_sessions, core.identity_policy,
  core.identity_memberships, core.identity_patient_links, core.identity_assignments,
  core.identity_consents TO k_core_runtime;
GRANT INSERT ON core.identity_consents TO k_core_runtime;
-- Append-only decisions are the consent audit. No runtime update/delete/enrollment privilege.
CREATE TABLE core.identity_self_consultations (
  actor_id uuid NOT NULL REFERENCES core.identity_actors(id), patient_id uuid NOT NULL,
  clinic_id uuid NOT NULL, consultation_id uuid NOT NULL,
  valid_from timestamptz NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz,
  PRIMARY KEY (actor_id, consultation_id), CHECK (expires_at > valid_from)
);
ALTER TABLE core.identity_self_consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.identity_self_consultations FORCE ROW LEVEL SECURITY;
CREATE POLICY identity_self_consultation_read ON core.identity_self_consultations FOR SELECT TO k_core_runtime
  USING (actor_id::text = current_setting('identity.actor_id', true));
GRANT SELECT ON core.identity_self_consultations TO k_core_runtime, k_backup_runtime;
-- PostgreSQL requires UPDATE privilege on at least one column for SELECT FOR SHARE.
-- A dedicated inert column supplies it; UPDATE WITH CHECK(false) rejects actual
-- updates. Business columns remain read-only.
ALTER TABLE core.identity_actors ADD COLUMN lock_guard boolean;
ALTER TABLE core.identity_sessions ADD COLUMN lock_guard boolean;
ALTER TABLE core.identity_policy ADD COLUMN lock_guard boolean;
ALTER TABLE core.identity_memberships ADD COLUMN lock_guard boolean;
ALTER TABLE core.identity_patient_links ADD COLUMN lock_guard boolean;
ALTER TABLE core.identity_assignments ADD COLUMN lock_guard boolean;
ALTER TABLE core.identity_consents ADD COLUMN lock_guard boolean;
ALTER TABLE core.identity_self_consultations ADD COLUMN lock_guard boolean;
GRANT UPDATE(lock_guard) ON core.identity_actors, core.identity_sessions, core.identity_policy,
  core.identity_memberships, core.identity_patient_links, core.identity_assignments,
  core.identity_consents, core.identity_self_consultations TO k_core_runtime;
CREATE POLICY identity_actor_lock ON core.identity_actors FOR UPDATE TO k_core_runtime USING (true) WITH CHECK (false);
CREATE POLICY identity_session_lock ON core.identity_sessions FOR UPDATE TO k_core_runtime USING (true) WITH CHECK (false);
CREATE POLICY identity_policy_lock ON core.identity_policy FOR UPDATE TO k_core_runtime USING (true) WITH CHECK (false);
CREATE POLICY identity_membership_lock ON core.identity_memberships FOR UPDATE TO k_core_runtime USING (true) WITH CHECK (false);
CREATE POLICY identity_link_lock ON core.identity_patient_links FOR UPDATE TO k_core_runtime USING (true) WITH CHECK (false);
CREATE POLICY identity_assignment_lock ON core.identity_assignments FOR UPDATE TO k_core_runtime USING (true) WITH CHECK (false);
CREATE POLICY identity_consent_lock ON core.identity_consents FOR UPDATE TO k_core_runtime USING (true) WITH CHECK (false);
CREATE POLICY identity_self_consultation_lock ON core.identity_self_consultations FOR UPDATE TO k_core_runtime USING (true) WITH CHECK (false);
-- Assigned-patient actor rows are insertion fences, never role/ownership grants.
DROP POLICY identity_actor_read ON core.identity_actors;
CREATE POLICY identity_actor_read ON core.identity_actors FOR SELECT TO k_core_runtime USING (
  id::text = current_setting('identity.actor_id', true) OR EXISTS (
    SELECT 1 FROM core.identity_assignments a WHERE a.patient_actor_id = identity_actors.id
      AND a.record->>'revokedAt' IS NULL AND (a.record->>'validFrom')::timestamptz <= now()
      AND (a.record->>'expiresAt')::timestamptz > now()));
-- Enforce the insertion/revocation fence for every writer, including controlled
-- provisioning. Consent append cannot race a clinical transaction holding a
-- patient actor FOR SHARE. No advisory convention or stale bearer grant is enough.
CREATE FUNCTION core.identity_authority_fence() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, core AS $$
DECLARE subject uuid; patient_subject uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN subject := OLD.actor_id;
  ELSE subject := NEW.actor_id;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.actor_id <> OLD.actor_id THEN
    RAISE EXCEPTION 'Identity ownership is immutable';
  END IF;
  IF TG_TABLE_NAME = 'identity_assignments' THEN
    IF TG_OP = 'DELETE' THEN patient_subject := OLD.patient_actor_id;
    ELSE patient_subject := NEW.patient_actor_id;
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.patient_actor_id <> OLD.patient_actor_id THEN
      RAISE EXCEPTION 'Identity patient ownership is immutable';
    END IF;
  END IF;
  PERFORM id FROM core.identity_actors WHERE id IN (subject, patient_subject) ORDER BY id FOR UPDATE;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION core.identity_authority_fence() FROM PUBLIC;
CREATE TRIGGER identity_session_fence BEFORE INSERT OR UPDATE OR DELETE ON core.identity_sessions
  FOR EACH ROW EXECUTE FUNCTION core.identity_authority_fence();
CREATE TRIGGER identity_membership_fence BEFORE INSERT OR UPDATE OR DELETE ON core.identity_memberships
  FOR EACH ROW EXECUTE FUNCTION core.identity_authority_fence();
CREATE TRIGGER identity_link_fence BEFORE INSERT OR UPDATE OR DELETE ON core.identity_patient_links
  FOR EACH ROW EXECUTE FUNCTION core.identity_authority_fence();
CREATE TRIGGER identity_assignment_fence BEFORE INSERT OR UPDATE OR DELETE ON core.identity_assignments
  FOR EACH ROW EXECUTE FUNCTION core.identity_authority_fence();
CREATE TRIGGER identity_consent_fence BEFORE INSERT OR UPDATE OR DELETE ON core.identity_consents
  FOR EACH ROW EXECUTE FUNCTION core.identity_authority_fence();
CREATE TRIGGER identity_consultation_fence BEFORE INSERT OR UPDATE OR DELETE ON core.identity_self_consultations
  FOR EACH ROW EXECUTE FUNCTION core.identity_authority_fence();
CREATE POLICY identity_actor_backup ON core.identity_actors FOR SELECT TO k_backup_runtime USING (true);
CREATE POLICY identity_session_backup ON core.identity_sessions FOR SELECT TO k_backup_runtime USING (true);
CREATE POLICY identity_policy_backup ON core.identity_policy FOR SELECT TO k_backup_runtime USING (true);
CREATE POLICY identity_membership_backup ON core.identity_memberships FOR SELECT TO k_backup_runtime USING (true);
CREATE POLICY identity_link_backup ON core.identity_patient_links FOR SELECT TO k_backup_runtime USING (true);
CREATE POLICY identity_assignment_backup ON core.identity_assignments FOR SELECT TO k_backup_runtime USING (true);
CREATE POLICY identity_consent_backup ON core.identity_consents FOR SELECT TO k_backup_runtime USING (true);
CREATE POLICY identity_self_consultation_backup ON core.identity_self_consultations FOR SELECT TO k_backup_runtime USING (true);

-- Configurable web AuthKit: opaque browser binding, one live attempt per browser,
-- and server-sealed provider credentials. No new actors, grants or MFA are inferred.
CREATE TABLE core.identity_web_attempts (
  browser_hash text PRIMARY KEY CHECK (length(browser_hash)=43),
  state_hash text NOT NULL UNIQUE CHECK (length(state_hash)=43),
  verifier_ciphertext text NOT NULL CHECK (length(verifier_ciphertext) < 1024),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  lock_guard boolean
);
ALTER TABLE core.identity_sessions ADD CONSTRAINT identity_session_actor_unique UNIQUE(id,actor_id);
CREATE TABLE core.identity_web_sessions (
  handle_hash text PRIMARY KEY CHECK (length(handle_hash)=43),
  actor_id uuid NOT NULL REFERENCES core.identity_actors(id),
  session_id uuid NOT NULL,
  access_token_ciphertext text NOT NULL CHECK (length(access_token_ciphertext) BETWEEN 1 AND 32768),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revocation_pending boolean NOT NULL DEFAULT false,
  logout_key text,
  lock_guard boolean,
  FOREIGN KEY(session_id,actor_id) REFERENCES core.identity_sessions(id,actor_id)
);
ALTER TABLE core.identity_web_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.identity_web_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE core.identity_web_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.identity_web_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY web_attempt_read ON core.identity_web_attempts FOR SELECT TO k_core_runtime
  USING (browser_hash=current_setting('identity.web_browser',true));
CREATE POLICY web_attempt_insert ON core.identity_web_attempts FOR INSERT TO k_core_runtime
  WITH CHECK (browser_hash=current_setting('identity.web_browser',true));
CREATE POLICY web_attempt_update ON core.identity_web_attempts FOR UPDATE TO k_core_runtime
  USING (browser_hash=current_setting('identity.web_browser',true))
  WITH CHECK (browser_hash=current_setting('identity.web_browser',true));
CREATE POLICY web_session_read ON core.identity_web_sessions FOR SELECT TO k_core_runtime
  USING (handle_hash=current_setting('identity.web_handle',true));
CREATE POLICY web_session_insert ON core.identity_web_sessions FOR INSERT TO k_core_runtime
  WITH CHECK (handle_hash=current_setting('identity.web_handle',true)
    AND actor_id::text=current_setting('identity.actor_id',true)
    AND session_id::text=current_setting('identity.internal_session',true)
    AND revoked_at IS NULL AND NOT revocation_pending AND logout_key IS NULL);
CREATE POLICY web_session_update ON core.identity_web_sessions FOR UPDATE TO k_core_runtime
  USING (handle_hash=current_setting('identity.web_handle',true))
  WITH CHECK (revoked_at IS NOT NULL);
CREATE POLICY web_session_lock ON core.identity_web_sessions FOR UPDATE TO k_core_runtime
  USING (handle_hash=current_setting('identity.web_handle',true)) WITH CHECK(false);
GRANT SELECT,INSERT ON core.identity_web_attempts,core.identity_web_sessions TO k_core_runtime;
GRANT UPDATE(state_hash,verifier_ciphertext,expires_at,consumed_at,lock_guard)
  ON core.identity_web_attempts TO k_core_runtime;
GRANT UPDATE(revoked_at,revocation_pending,logout_key,lock_guard)
  ON core.identity_web_sessions TO k_core_runtime;
CREATE POLICY web_actor_lookup ON core.identity_actors FOR SELECT TO k_core_runtime
  USING (provider_user_id=current_setting('identity.web_verified_user',true));
CREATE POLICY web_session_enroll ON core.identity_sessions FOR INSERT TO k_core_runtime
  WITH CHECK (actor_id::text=current_setting('identity.actor_id',true)
    AND provider_user_id=current_setting('identity.web_verified_user',true)
    AND provider_user_id=current_setting('identity.provider_user',true)
    AND provider_session_id=current_setting('identity.provider_session',true)
    AND coalesce(organization_id::text,'')=current_setting('identity.web_organization',true)
    AND revoked_at IS NULL AND mfa_verified_at IS NULL AND mfa_expires_at IS NULL
    AND mfa_evidence_reference IS NULL);
GRANT INSERT ON core.identity_sessions TO k_core_runtime;
-- Logout may only revoke the current internal session, never un-revoke it or edit MFA.
CREATE POLICY web_session_revoke ON core.identity_sessions FOR UPDATE TO k_core_runtime
  USING (id::text=current_setting('identity.internal_session',true)
    AND actor_id::text=current_setting('identity.actor_id',true))
  WITH CHECK (revoked_at IS NOT NULL);
GRANT UPDATE(revoked_at) ON core.identity_sessions TO k_core_runtime;
CREATE TRIGGER identity_web_session_fence BEFORE INSERT OR UPDATE OR DELETE ON core.identity_web_sessions
  FOR EACH ROW EXECUTE FUNCTION core.identity_authority_fence();
GRANT SELECT ON core.identity_web_attempts,core.identity_web_sessions TO k_backup_runtime;
CREATE POLICY web_attempt_backup ON core.identity_web_attempts FOR SELECT TO k_backup_runtime USING(true);
CREATE POLICY web_session_backup ON core.identity_web_sessions FOR SELECT TO k_backup_runtime USING(true);

-- FORCE RLS must not prevent the controlled non-superuser migration owner from
-- provisioning approved accounts/grants or operating the insertion fences.
-- CURRENT_USER is resolved to the migration role when the migration runs.
-- Runtime roleProof rejects object-owner inheritance; these are not runtime policies.
CREATE POLICY identity_controlled_owner ON core.identity_actors TO CURRENT_USER USING(true) WITH CHECK(true);
CREATE POLICY identity_controlled_owner ON core.identity_sessions TO CURRENT_USER USING(true) WITH CHECK(true);
CREATE POLICY identity_controlled_owner ON core.identity_policy TO CURRENT_USER USING(true) WITH CHECK(true);
CREATE POLICY identity_controlled_owner ON core.identity_memberships TO CURRENT_USER USING(true) WITH CHECK(true);
CREATE POLICY identity_controlled_owner ON core.identity_patient_links TO CURRENT_USER USING(true) WITH CHECK(true);
CREATE POLICY identity_controlled_owner ON core.identity_assignments TO CURRENT_USER USING(true) WITH CHECK(true);
CREATE POLICY identity_controlled_owner ON core.identity_consents TO CURRENT_USER USING(true) WITH CHECK(true);
CREATE POLICY identity_controlled_owner ON core.identity_self_consultations TO CURRENT_USER USING(true) WITH CHECK(true);
CREATE POLICY identity_controlled_owner ON core.identity_web_attempts TO CURRENT_USER USING(true) WITH CHECK(true);
CREATE POLICY identity_controlled_owner ON core.identity_web_sessions TO CURRENT_USER USING(true) WITH CHECK(true);
GRANT SELECT ON core.identity_actors, core.identity_sessions, core.identity_policy,
  core.identity_memberships, core.identity_patient_links, core.identity_assignments,
  core.identity_consents TO k_backup_runtime;
