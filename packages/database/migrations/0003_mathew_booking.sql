-- Additive booking slice. Configuration/authority/verified financial facts are
-- provisioned by reviewed trusted integrations, never by public request JSON.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SCHEMA IF NOT EXISTS clinical;
REVOKE ALL ON SCHEMA clinical FROM PUBLIC;
GRANT USAGE ON SCHEMA clinical TO k_core_runtime, k_jobs_runtime, k_backup_runtime;

-- Explicit booking actions, not a session/identity cache or workspace-role alias.
-- The identity-owned current-authority loader is still mandatory in the same tx.
CREATE TABLE clinical.mathew_booking_grant_fence (actor_id uuid PRIMARY KEY);
CREATE TABLE clinical.mathew_booking_grant (
  id uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES clinical.mathew_booking_grant_fence,
  action text NOT NULL CHECK (action IN ('booking:create','booking:read')),
  scope text NOT NULL CHECK (scope IN ('self','clinic')),
  clinic_id uuid,
  valid_from timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > valid_from),
  CHECK ((scope = 'self' AND clinic_id IS NULL) OR (scope = 'clinic' AND clinic_id IS NOT NULL))
);
CREATE FUNCTION clinical.mathew_booking_grant_write_fence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.actor_id <> OLD.actor_id THEN
    RAISE EXCEPTION 'Grant actor identity is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN actor := OLD.actor_id; ELSE actor := NEW.actor_id; END IF;
  INSERT INTO clinical.mathew_booking_grant_fence(actor_id) VALUES(actor) ON CONFLICT DO NOTHING;
  PERFORM 1 FROM clinical.mathew_booking_grant_fence WHERE actor_id = actor FOR UPDATE;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
REVOKE ALL ON FUNCTION clinical.mathew_booking_grant_write_fence() FROM PUBLIC;
CREATE TRIGGER booking_grant_write_fence BEFORE INSERT OR UPDATE OR DELETE ON clinical.mathew_booking_grant
  FOR EACH ROW EXECUTE FUNCTION clinical.mathew_booking_grant_write_fence();
GRANT SELECT ON clinical.mathew_booking_grant_fence, clinical.mathew_booking_grant TO k_core_runtime;
GRANT UPDATE(actor_id) ON clinical.mathew_booking_grant_fence TO k_core_runtime;
GRANT SELECT ON clinical.mathew_booking_grant_fence, clinical.mathew_booking_grant TO k_backup_runtime;

CREATE TABLE clinical.mathew_booking_directory (
  doctor_id uuid PRIMARY KEY,
  document jsonb NOT NULL,
  published boolean NOT NULL DEFAULT false,
  CHECK ((document->>'doctorId')::uuid = doctor_id)
);
CREATE TABLE clinical.mathew_booking_configuration (
  availability_id uuid PRIMARY KEY,
  doctor_id uuid NOT NULL REFERENCES clinical.mathew_booking_directory,
  availability jsonb NOT NULL,
  policy jsonb NOT NULL,
  fees jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  CHECK ((availability->>'id')::uuid = availability_id),
  CHECK ((availability->>'doctorId')::uuid = doctor_id)
);
CREATE TABLE clinical.mathew_booking_leave (
  id uuid PRIMARY KEY,
  doctor_id uuid NOT NULL REFERENCES clinical.mathew_booking_directory,
  document jsonb NOT NULL,
  CHECK ((document->>'id')::uuid = id),
  CHECK ((document->>'doctorId')::uuid = doctor_id)
);
-- Concurrent schedule/leave mutations must fence the same doctor row read by holds.
CREATE FUNCTION clinical.mathew_booking_lock_doctor_configuration() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.doctor_id <> OLD.doctor_id THEN
    RAISE EXCEPTION 'Doctor identity is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    PERFORM 1 FROM clinical.mathew_booking_directory WHERE doctor_id = OLD.doctor_id FOR UPDATE;
    RETURN OLD;
  END IF;
  PERFORM 1 FROM clinical.mathew_booking_directory WHERE doctor_id = NEW.doctor_id FOR UPDATE;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION clinical.mathew_booking_lock_doctor_configuration() FROM PUBLIC;
CREATE TRIGGER configuration_doctor_fence BEFORE INSERT OR UPDATE OR DELETE ON clinical.mathew_booking_configuration
  FOR EACH ROW EXECUTE FUNCTION clinical.mathew_booking_lock_doctor_configuration();
CREATE TRIGGER leave_doctor_fence BEFORE INSERT OR UPDATE OR DELETE ON clinical.mathew_booking_leave
  FOR EACH ROW EXECUTE FUNCTION clinical.mathew_booking_lock_doctor_configuration();
CREATE TABLE clinical.mathew_booking_booking (
  id uuid PRIMARY KEY,
  operation_id uuid NOT NULL UNIQUE,
  request jsonb NOT NULL,
  owner_id uuid NOT NULL,
  doctor_id uuid NOT NULL REFERENCES clinical.mathew_booking_directory,
  clinic_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  state text NOT NULL CHECK (state IN ('held','confirmed','expired','cancelled')),
  occupied tstzrange NOT NULL CHECK (NOT isempty(occupied) AND lower_inc(occupied) AND NOT upper_inc(occupied)),
  expires_at timestamptz NOT NULL,
  document jsonb NOT NULL,
  availability_id uuid GENERATED ALWAYS AS ((document->'slot'->>'availabilityId')::uuid) STORED
    REFERENCES clinical.mathew_booking_configuration,
  CHECK ((document->>'id')::uuid = id),
  CHECK ((document->>'ownerId')::uuid = owner_id),
  CHECK ((document->'slot'->>'doctorId')::uuid = doctor_id),
  CHECK ((document->'slot'->>'clinicId')::uuid = clinic_id),
  CHECK ((document->>'revision')::integer = revision),
  CHECK (document->>'state' = state),
  CHECK ((document->>'holdExpiresAt')::timestamptz = expires_at),
  CHECK (lower(occupied) = (document->'slot'->'interval'->>'start')::timestamptz
    - (document->'slot'->'buffers'->>'beforeMs')::bigint * interval '1 millisecond'),
  CHECK (upper(occupied) = (document->'slot'->'interval'->>'end')::timestamptz
    + (document->'slot'->'buffers'->>'afterMs')::bigint * interval '1 millisecond'),
  EXCLUDE USING gist (doctor_id WITH =, occupied WITH &&) WHERE (state IN ('held','confirmed'))
);
CREATE INDEX mathew_booking_expiry_due ON clinical.mathew_booking_booking(expires_at) WHERE state = 'held';
CREATE UNIQUE INDEX mathew_booking_order_identity ON clinical.mathew_booking_booking ((document->>'paymentOrderId'));
CREATE FUNCTION clinical.mathew_booking_snapshot_fence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.revision <> OLD.revision + 1 OR
    (NEW.document - ARRAY['revision','state','payments','paymentOrderId']) <>
    (OLD.document - ARRAY['revision','state','payments','paymentOrderId']) THEN
    RAISE EXCEPTION 'Booking snapshots are immutable';
  END IF;
  IF pg_has_role(current_user, 'k_core_runtime', 'MEMBER') AND
    (NEW.state <> OLD.state OR NEW.document->'payments' IS DISTINCT FROM OLD.document->'payments') THEN
    RAISE EXCEPTION 'Financial state requires the jobs role';
  END IF;
  IF NEW.document->>'paymentOrderId' <> OLD.document->>'paymentOrderId' AND
    (OLD.state <> 'held' OR OLD.document->>'paymentOrderId' <> 'unbound_' || OLD.id::text OR
     jsonb_array_length(OLD.document->'payments') <> 0) THEN
    RAISE EXCEPTION 'Provider order binding is immutable';
  END IF;
  IF jsonb_array_length(NEW.document->'payments') < jsonb_array_length(OLD.document->'payments') OR
    EXISTS (SELECT 1 FROM jsonb_array_elements(OLD.document->'payments') WITH ORDINALITY p(value, ordinal)
      WHERE NEW.document->'payments'->((p.ordinal - 1)::integer) IS DISTINCT FROM p.value) THEN
    RAISE EXCEPTION 'Captured payment audit is append-only';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION clinical.mathew_booking_snapshot_fence() FROM PUBLIC;
CREATE TRIGGER booking_snapshot_fence BEFORE UPDATE ON clinical.mathew_booking_booking
  FOR EACH ROW EXECUTE FUNCTION clinical.mathew_booking_snapshot_fence();
CREATE TABLE clinical.mathew_booking_audit (
  booking_id uuid NOT NULL REFERENCES clinical.mathew_booking_booking,
  revision integer NOT NULL,
  document jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (booking_id, revision)
);
-- Only a trusted financial verifier may provision receipts after signature AND
-- provider reconciliation. Runtime roles cannot manufacture verified evidence.
CREATE TABLE clinical.mathew_booking_verified_capture (
  id uuid PRIMARY KEY,
  document jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE clinical.mathew_booking_payment (
  provider text NOT NULL,
  payment_id text NOT NULL,
  booking_id uuid NOT NULL REFERENCES clinical.mathew_booking_booking,
  document jsonb NOT NULL,
  PRIMARY KEY (provider, payment_id)
);
CREATE TABLE clinical.mathew_booking_delivery (
  provider text NOT NULL,
  event_id text NOT NULL,
  payment_id text NOT NULL,
  -- References the financial owner's durable receipt, committed in this transaction.
  receipt_id uuid NOT NULL,
  PRIMARY KEY (provider, event_id),
  FOREIGN KEY (provider, payment_id) REFERENCES clinical.mathew_booking_payment
);
CREATE TABLE clinical.mathew_booking_obligation (
  id uuid PRIMARY KEY,
  operation_key text NOT NULL UNIQUE,
  booking_id uuid NOT NULL REFERENCES clinical.mathew_booking_booking,
  document jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending_review_and_reconciliation'
    CHECK (status = 'pending_review_and_reconciliation'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

GRANT SELECT ON clinical.mathew_booking_directory, clinical.mathew_booking_configuration, clinical.mathew_booking_leave TO k_core_runtime, k_jobs_runtime;
-- Row locks require UPDATE privilege; only harmless same-value lock columns are
-- granted, never approval, scope, fee or verification columns.
GRANT UPDATE(doctor_id) ON clinical.mathew_booking_directory TO k_core_runtime, k_jobs_runtime;
GRANT UPDATE(availability_id) ON clinical.mathew_booking_configuration TO k_core_runtime, k_jobs_runtime;
GRANT SELECT ON clinical.mathew_booking_verified_capture TO k_jobs_runtime;
GRANT SELECT, INSERT ON clinical.mathew_booking_booking, clinical.mathew_booking_audit TO k_core_runtime, k_jobs_runtime;
GRANT UPDATE(revision, state, document) ON clinical.mathew_booking_booking TO k_jobs_runtime;
GRANT UPDATE(revision, document) ON clinical.mathew_booking_booking TO k_core_runtime;
GRANT SELECT, INSERT ON clinical.mathew_booking_payment, clinical.mathew_booking_delivery, clinical.mathew_booking_obligation TO k_jobs_runtime;
GRANT SELECT ON clinical.mathew_booking_directory, clinical.mathew_booking_configuration, clinical.mathew_booking_leave,
  clinical.mathew_booking_verified_capture, clinical.mathew_booking_booking, clinical.mathew_booking_audit,
  clinical.mathew_booking_payment, clinical.mathew_booking_delivery, clinical.mathew_booking_obligation TO k_backup_runtime;

ALTER TABLE clinical.mathew_booking_booking ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.mathew_booking_booking FORCE ROW LEVEL SECURITY;
CREATE POLICY booking_core_scope ON clinical.mathew_booking_booking TO k_core_runtime
  USING (owner_id::text = current_setting('booking.owner', true)
    OR clinic_id::text IN (SELECT jsonb_array_elements_text(COALESCE(NULLIF(current_setting('booking.clinics', true), ''), '[]')::jsonb)))
  WITH CHECK (owner_id::text = current_setting('booking.owner', true)
    OR clinic_id::text IN (SELECT jsonb_array_elements_text(COALESCE(NULLIF(current_setting('booking.clinics', true), ''), '[]')::jsonb)));
CREATE POLICY booking_jobs ON clinical.mathew_booking_booking TO k_jobs_runtime USING (true) WITH CHECK (true);
CREATE POLICY booking_backup ON clinical.mathew_booking_booking FOR SELECT TO k_backup_runtime USING (true);
ALTER TABLE clinical.mathew_booking_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.mathew_booking_audit FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_core_scope ON clinical.mathew_booking_audit TO k_core_runtime
  USING (EXISTS (SELECT 1 FROM clinical.mathew_booking_booking b WHERE b.id = booking_id))
  WITH CHECK (EXISTS (SELECT 1 FROM clinical.mathew_booking_booking b WHERE b.id = booking_id));
CREATE POLICY audit_jobs ON clinical.mathew_booking_audit TO k_jobs_runtime USING (true) WITH CHECK (true);
CREATE POLICY audit_backup ON clinical.mathew_booking_audit FOR SELECT TO k_backup_runtime USING (true);

-- A verified financial callback may create a new booking reconciliation transport row
-- in its existing jobs transaction. It cannot enqueue unrelated or pre-completed work.
GRANT INSERT ON platform.outbox TO k_jobs_runtime;
CREATE POLICY booking_reconciliation_enqueue ON platform.outbox FOR INSERT TO k_jobs_runtime
  WITH CHECK (kind = 'commerce.reconcile' AND channel = 'financial'
    AND operation_id = subject_id AND revision = 1
    AND status = 'pending' AND publish_attempts = 0 AND execution_attempts = 0
    AND lease_token IS NULL AND lease_until IS NULL AND failure_code IS NULL
    AND claimed_at IS NULL AND completed_at IS NULL
    AND EXISTS (SELECT 1 FROM clinical.mathew_booking_obligation o WHERE o.id = subject_id));

-- APPENDED OFFER SLICE: integrate only this suffix into the parent-owned migration;
-- preserve the parent's separate restricted jobs/outbox policy additions.
CREATE TABLE clinical.mathew_booking_clinic_metadata (
  clinic_id uuid PRIMARY KEY, document jsonb NOT NULL, published boolean NOT NULL DEFAULT false,
  CHECK ((document->>'clinicId')::uuid = clinic_id)
);
CREATE TABLE clinical.mathew_booking_service_metadata (
  service_id uuid PRIMARY KEY, document jsonb NOT NULL, published boolean NOT NULL DEFAULT false,
  CHECK ((document->>'serviceId')::uuid = service_id)
);
CREATE TABLE clinical.mathew_booking_offer_service (
  availability_id uuid NOT NULL REFERENCES clinical.mathew_booking_configuration,
  modality text NOT NULL CHECK (modality IN ('online','in_clinic')),
  service_id uuid NOT NULL REFERENCES clinical.mathew_booking_service_metadata,
  PRIMARY KEY (availability_id, modality)
);
GRANT SELECT ON clinical.mathew_booking_clinic_metadata, clinical.mathew_booking_service_metadata,
  clinical.mathew_booking_offer_service TO k_core_runtime, k_backup_runtime;

-- Non-login, non-bypass, SELECT-only function identity; runtime logins never inherit it.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'k_booking_offer_reader') THEN
    CREATE ROLE k_booking_offer_reader NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'k_booking_offer_reader' AND
    (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolinherit)) OR
    EXISTS (SELECT 1 FROM pg_auth_members WHERE member = 'k_booking_offer_reader'::regrole) THEN
    RAISE EXCEPTION 'Invalid offer reader role';
  END IF;
END $$;
GRANT USAGE ON SCHEMA clinical TO k_booking_offer_reader;
GRANT SELECT ON clinical.mathew_booking_booking, clinical.mathew_booking_configuration,
  clinical.mathew_booking_directory, clinical.mathew_booking_leave,
  clinical.mathew_booking_clinic_metadata, clinical.mathew_booking_service_metadata,
  clinical.mathew_booking_offer_service TO k_booking_offer_reader;
CREATE POLICY booking_offer_inventory_read ON clinical.mathew_booking_booking
  FOR SELECT TO k_booking_offer_reader USING (true);

-- No arbitrary doctor/interval occupancy oracle: only current published, named,
-- configured grid slots. Returns interval starts and technical truncation only.
CREATE FUNCTION clinical.mathew_booking_available_offer_starts(
  p_availability uuid, p_revision integer, p_modality text,
  p_from timestamptz, p_until timestamptz, p_limit integer
) RETURNS TABLE(slot_starts timestamptz[], scan_truncated boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  WITH config AS (
    SELECT c.doctor_id, c.availability,
      (c.availability->'window'->>'start')::timestamptz AS ws,
      (c.availability->'window'->>'end')::timestamptz AS we,
      (c.availability->>'slotLengthMs')::bigint AS ms,
      (c.policy->>'holdDurationMs')::bigint AS hold_ms,
      (c.availability->'buffers'->>'beforeMs')::bigint AS before_ms,
      (c.availability->'buffers'->>'afterMs')::bigint AS after_ms
    FROM clinical.mathew_booking_configuration c
    JOIN clinical.mathew_booking_directory d ON d.doctor_id=c.doctor_id AND d.published
    JOIN clinical.mathew_booking_clinic_metadata cl ON cl.clinic_id=(c.availability->>'clinicId')::uuid AND cl.published
    JOIN clinical.mathew_booking_offer_service m ON m.availability_id=c.availability_id AND m.modality=p_modality
    JOIN clinical.mathew_booking_service_metadata s ON s.service_id=m.service_id AND s.published
    WHERE c.availability_id=p_availability AND c.enabled AND (c.availability->>'revision')::integer=p_revision
      AND d.document->'clinicIds' ? (c.availability->>'clinicId')
      AND c.availability->'modalities' ? p_modality
      AND cl.document->>'clinicTimezone'=c.availability->>'clinicTimezone'
      AND p_limit BETWEEN 1 AND 101 AND p_until>p_from AND p_until-p_from <= interval '7 days'
      AND (c.availability->>'slotLengthMs')::bigint > 0 AND (c.policy->>'holdDurationMs')::bigint > 0
  ), bounds AS (
    SELECT *, ws + ceil(extract(epoch FROM (greatest(ws,p_from,transaction_timestamp()+hold_ms*interval '1 millisecond')-ws))*1000/ms)::bigint
      * ms * interval '1 millisecond' AS first_start,
      least(we,p_until)-ms*interval '1 millisecond' AS last_start FROM config
  ), candidates AS (
    SELECT b.*, first_start + i*ms*interval '1 millisecond' AS candidate FROM bounds b
    CROSS JOIN LATERAL generate_series(0::bigint,least(1999::bigint,
      floor(extract(epoch FROM (last_start-first_start))*1000/ms)::bigint)) i
  ), available AS (
    SELECT candidate FROM candidates c WHERE candidate >= ws AND candidate <= last_start AND candidate > transaction_timestamp()
      AND NOT EXISTS (SELECT 1 FROM clinical.mathew_booking_leave l WHERE l.doctor_id=c.doctor_id
        AND tstzrange((l.document->'interval'->>'start')::timestamptz,(l.document->'interval'->>'end')::timestamptz,'[)')
          && tstzrange(candidate-before_ms*interval '1 millisecond', candidate+(ms+after_ms)*interval '1 millisecond','[)'))
      AND NOT EXISTS (SELECT 1 FROM clinical.mathew_booking_booking b WHERE b.doctor_id=c.doctor_id
        AND b.state IN ('held','confirmed') AND b.occupied &&
          tstzrange(candidate-before_ms*interval '1 millisecond',candidate+(ms+after_ms)*interval '1 millisecond','[)'))
    ORDER BY candidate LIMIT p_limit
  ) SELECT coalesce((SELECT array_agg(candidate ORDER BY candidate) FROM available),ARRAY[]::timestamptz[]),
    coalesce((SELECT first_start+2000*ms*interval '1 millisecond' <= last_start FROM bounds),false);
$$;
REVOKE ALL ON FUNCTION clinical.mathew_booking_available_offer_starts(uuid,integer,text,timestamptz,timestamptz,integer) FROM PUBLIC;
GRANT CREATE ON SCHEMA clinical TO k_booking_offer_reader;
ALTER FUNCTION clinical.mathew_booking_available_offer_starts(uuid,integer,text,timestamptz,timestamptz,integer) OWNER TO k_booking_offer_reader;
REVOKE CREATE ON SCHEMA clinical FROM k_booking_offer_reader;
GRANT EXECUTE ON FUNCTION clinical.mathew_booking_available_offer_starts(uuid,integer,text,timestamptz,timestamptz,integer) TO k_core_runtime;
