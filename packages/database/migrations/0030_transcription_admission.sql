-- Default-deny isolated transcription capability. No policy, actor or quota is seeded.
-- The numerical CHECKs are technical resource ceilings, NOT approved company policy.
CREATE TABLE core.transcription_capabilities (
  actor_id uuid PRIMARY KEY REFERENCES core.identity_actors(id),
  approved_by uuid NOT NULL REFERENCES core.identity_actors(id),
  approval_reference text NOT NULL CHECK(length(approval_reference) BETWEEN 1 AND 200),
  processing_policy_version text NOT NULL CHECK(length(processing_policy_version) BETWEEN 1 AND 128),
  active boolean NOT NULL DEFAULT false,
  valid_from timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK(expires_at > valid_from),
  lifetime_limit integer NOT NULL CHECK(lifetime_limit BETWEEN 1 AND 10000),
  max_concurrent integer NOT NULL CHECK(max_concurrent BETWEEN 1 AND 4),
  lease_seconds integer NOT NULL CHECK(lease_seconds BETWEEN 25 AND 300)
);
CREATE TABLE core.transcription_admissions (
  operation_id uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES core.transcription_capabilities(actor_id),
  fence uuid NOT NULL,
  processing_policy_version text NOT NULL CHECK(length(processing_policy_version) BETWEEN 1 AND 128),
  admitted_at timestamptz NOT NULL,
  lease_until timestamptz NOT NULL CHECK(lease_until > admitted_at),
  completed_at timestamptz,
  reconciliation_reference text CHECK(length(reconciliation_reference) BETWEEN 1 AND 200),
  CHECK(reconciliation_reference IS NULL OR completed_at IS NOT NULL)
);
CREATE INDEX transcription_actor_admissions ON core.transcription_admissions(actor_id);
ALTER TABLE core.transcription_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.transcription_capabilities FORCE ROW LEVEL SECURITY;
ALTER TABLE core.transcription_admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.transcription_admissions FORCE ROW LEVEL SECURITY;
-- Match the controlled migration-owner policy pattern. Runtime cannot inherit this role.
CREATE POLICY transcription_controlled_owner ON core.transcription_capabilities TO CURRENT_USER USING(true) WITH CHECK(true);
CREATE POLICY transcription_controlled_owner ON core.transcription_admissions TO CURRENT_USER USING(true) WITH CHECK(true);
GRANT SELECT ON core.transcription_capabilities,core.transcription_admissions TO k_backup_runtime;
CREATE POLICY transcription_capability_backup ON core.transcription_capabilities FOR SELECT TO k_backup_runtime USING(true);
CREATE POLICY transcription_admission_backup ON core.transcription_admissions FOR SELECT TO k_backup_runtime USING(true);
-- No runtime SELECT/INSERT/UPDATE/DELETE, including policy, fence, timestamps or lifetime usage.
-- All admissions remain in the lifetime count, regardless of result/version/reconciliation.
CREATE FUNCTION core.transcription_admission(p_action text,p_actor uuid,p_operation uuid,p_fence uuid,p_version text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE
  capability core.transcription_capabilities%ROWTYPE;
  admission core.transcription_admissions%ROWTYPE;
  used bigint;
  inflight bigint;
  expired boolean;
  stamp timestamptz;
BEGIN
  IF p_action IS NULL OR p_actor IS NULL OR p_operation IS NULL OR p_fence IS NULL OR p_version IS NULL
    OR p_actor::text IS DISTINCT FROM current_setting('identity.actor_id',true)
    OR p_action NOT IN ('reserve','check','complete','uncertain') THEN RETURN 'denied'; END IF;
  -- One actor lock serializes reserve/check/completion and controlled capability updates.
  SELECT * INTO capability FROM core.transcription_capabilities WHERE actor_id=p_actor FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not-configured'; END IF;
  stamp := clock_timestamp();
  IF p_action IN ('complete','uncertain') THEN
    -- Cleanup is token-fenced, including after identity/policy revocation. No new authority.
    -- Uncertain provider completion never frees a slot. No expiration-based reclamation.
    IF p_action='uncertain' THEN RETURN 'unknown'; END IF;
    UPDATE core.transcription_admissions SET completed_at=stamp
      WHERE operation_id=p_operation AND actor_id=p_actor AND fence=p_fence
      AND processing_policy_version=p_version AND completed_at IS NULL AND lease_until>stamp;
    IF FOUND THEN RETURN 'released'; END IF;
    RETURN 'unknown';
  END IF;
  IF NOT capability.active OR capability.valid_from>stamp OR capability.expires_at<=stamp
    OR capability.processing_policy_version<>p_version THEN RETURN 'not-configured'; END IF;
  IF p_action='check' THEN
    SELECT * INTO admission FROM core.transcription_admissions
      WHERE operation_id=p_operation AND actor_id=p_actor AND fence=p_fence
      AND processing_policy_version=p_version AND completed_at IS NULL;
    IF NOT FOUND OR admission.lease_until<=stamp OR capability.expires_at<admission.lease_until
      THEN RETURN 'unknown'; END IF;
    RETURN 'allowed';
  END IF;
  -- Reserving the same operation can NEVER authorize another provider dispatch.
  IF EXISTS(SELECT 1 FROM core.transcription_admissions WHERE operation_id=p_operation)
    THEN RETURN 'denied'; END IF;
  SELECT count(*),count(*) FILTER(WHERE completed_at IS NULL),
    coalesce(bool_or(completed_at IS NULL AND lease_until<=stamp),false)
    INTO used,inflight,expired FROM core.transcription_admissions WHERE actor_id=p_actor;
  IF expired THEN RETURN 'unknown'; END IF;
  IF used>=capability.lifetime_limit OR inflight>=capability.max_concurrent THEN RETURN 'rate-limited'; END IF;
  IF capability.expires_at<stamp+make_interval(secs=>capability.lease_seconds)
    THEN RETURN 'not-configured'; END IF;
  INSERT INTO core.transcription_admissions(operation_id,actor_id,fence,processing_policy_version,admitted_at,lease_until)
    VALUES(p_operation,p_actor,p_fence,p_version,stamp,stamp+make_interval(secs=>capability.lease_seconds));
  RETURN 'admitted';
END $$;
REVOKE ALL ON FUNCTION core.transcription_admission(text,uuid,uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.transcription_admission(text,uuid,uuid,uuid,text) TO k_core_runtime;
