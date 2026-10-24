-- Additive. Requires commerce_catalogue; register after catalogue/payments in journal.
ALTER TABLE core.commerce_reservations ADD COLUMN state text NOT NULL DEFAULT 'held' CHECK(state IN ('held','released'));
ALTER TABLE core.commerce_reservations ADD COLUMN released_at timestamptz;
ALTER TABLE core.commerce_reservations ADD CHECK((state='held' AND released_at IS NULL) OR (state='released' AND released_at IS NOT NULL));
CREATE INDEX commerce_expiring_orders ON core.commerce_orders(expires_at,id) WHERE status='reserved';
-- PostgreSQL row locks require an UPDATE privilege; Core may lock, never mutate orders.
GRANT UPDATE(id) ON core.commerce_orders TO k_core_runtime;
CREATE POLICY orders_core_lock_only ON core.commerce_orders AS RESTRICTIVE FOR UPDATE TO k_core_runtime
  USING(true) WITH CHECK(false);
CREATE TABLE core.commerce_staff_grants (
  id uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES core.identity_actors(id),
  membership_id uuid NOT NULL REFERENCES core.identity_memberships(id),
  clinic_id uuid NOT NULL REFERENCES core.commerce_locations(id),
  action text NOT NULL CHECK(action IN ('orders:read','stock:read','catalogue:import','refunds:request')),
  valid_from timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK(expires_at>valid_from)
);
CREATE INDEX commerce_staff_grant_lookup ON core.commerce_staff_grants(actor_id,clinic_id,action);
ALTER TABLE core.commerce_staff_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.commerce_staff_grants FORCE ROW LEVEL SECURITY;
GRANT SELECT ON core.commerce_staff_grants TO k_core_runtime,k_backup_runtime;
GRANT UPDATE(id) ON core.commerce_staff_grants TO k_core_runtime;
CREATE POLICY grants_self ON core.commerce_staff_grants FOR SELECT TO k_core_runtime
  USING(actor_id=nullif(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY grants_backup ON core.commerce_staff_grants FOR SELECT TO k_backup_runtime USING(true);
CREATE POLICY grants_controlled_owner ON core.commerce_staff_grants TO CURRENT_USER USING(true) WITH CHECK(true);
CREATE POLICY grants_lock ON core.commerce_staff_grants FOR UPDATE TO k_core_runtime
  USING(actor_id=nullif(current_setting('app.actor_id',true),'')::uuid) WITH CHECK(false);
-- All authoritative grant writers serialize against shared identity's actor FOR SHARE fence.
CREATE FUNCTION core.commerce_grant_actor_fence() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,core AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM id FROM core.identity_actors WHERE id=NEW.actor_id FOR UPDATE;
    IF NOT EXISTS(SELECT 1 FROM core.identity_memberships WHERE id=NEW.membership_id AND actor_id=NEW.actor_id) THEN RAISE EXCEPTION 'commerce membership mismatch'; END IF;
    RETURN NEW;
  ELSIF TG_OP='UPDATE' THEN
    PERFORM id FROM core.identity_actors WHERE id IN (OLD.actor_id,NEW.actor_id) ORDER BY id FOR UPDATE;
    IF NOT EXISTS(SELECT 1 FROM core.identity_memberships WHERE id=NEW.membership_id AND actor_id=NEW.actor_id) THEN RAISE EXCEPTION 'commerce membership mismatch'; END IF;
    RETURN NEW;
  ELSE
    PERFORM id FROM core.identity_actors WHERE id=OLD.actor_id FOR UPDATE;
    RETURN OLD;
  END IF;
END $$;
REVOKE ALL ON FUNCTION core.commerce_grant_actor_fence() FROM PUBLIC;
CREATE TRIGGER commerce_grants_actor_fence BEFORE INSERT OR UPDATE OR DELETE ON core.commerce_staff_grants
  FOR EACH ROW EXECUTE FUNCTION core.commerce_grant_actor_fence();

-- Staff visibility does not confer update/payment/cancellation authority.
CREATE POLICY orders_staff_read ON core.commerce_orders FOR SELECT TO k_core_runtime USING(
  EXISTS(SELECT 1 FROM core.commerce_staff_grants g WHERE g.clinic_id=location_id
    AND g.action='orders:read' AND g.revoked_at IS NULL
    AND g.valid_from<=statement_timestamp() AND g.expires_at>statement_timestamp())
);
CREATE POLICY batches_staff_read ON core.commerce_batches FOR SELECT TO k_core_runtime USING(
  EXISTS(SELECT 1 FROM core.commerce_staff_grants g WHERE g.clinic_id=location_id
    AND g.action='stock:read' AND g.revoked_at IS NULL
    AND g.valid_from<=statement_timestamp() AND g.expires_at>statement_timestamp())
);

CREATE TABLE core.commerce_order_payment_obligations (
  id uuid PRIMARY KEY,
  intent_id uuid NOT NULL REFERENCES core.commerce_payment_intents(id),
  subject_id uuid NOT NULL,
  receipt_id uuid NOT NULL REFERENCES core.commerce_payment_receipts(id),
  reason text NOT NULL CHECK(reason IN ('late_hold','unsafe_stock','state_changed')),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','resolved')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(intent_id)
);
ALTER TABLE core.commerce_order_payment_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.commerce_order_payment_obligations FORCE ROW LEVEL SECURITY;
GRANT SELECT ON core.commerce_order_payment_obligations TO k_backup_runtime;
CREATE POLICY obligation_backup ON core.commerce_order_payment_obligations FOR SELECT TO k_backup_runtime USING(true);
CREATE POLICY obligation_controlled_owner ON core.commerce_order_payment_obligations TO CURRENT_USER USING(true) WITH CHECK(true);
GRANT USAGE ON SCHEMA core TO k_jobs_runtime;
GRANT SELECT ON core.commerce_orders,core.commerce_order_lines,core.commerce_reservations,core.commerce_batches,core.commerce_skus TO k_jobs_runtime;
GRANT SELECT(order_id) ON core.commerce_order_addresses TO k_jobs_runtime;
CREATE POLICY payment_address_reference ON core.commerce_order_addresses FOR SELECT TO k_jobs_runtime
  USING(current_setting('app.payment_system',true)='verified');
GRANT UPDATE(status,version) ON core.commerce_orders TO k_jobs_runtime;
GRANT UPDATE(id) ON core.commerce_batches,core.commerce_skus TO k_jobs_runtime;
GRANT SELECT,INSERT ON core.commerce_order_payment_obligations TO k_jobs_runtime;
CREATE POLICY payment_orders ON core.commerce_orders TO k_jobs_runtime
  USING(current_setting('app.payment_system',true)='verified')
  WITH CHECK(current_setting('app.payment_system',true)='verified');
CREATE POLICY payment_lines ON core.commerce_order_lines FOR SELECT TO k_jobs_runtime
  USING(current_setting('app.payment_system',true)='verified');
CREATE POLICY payment_reservations ON core.commerce_reservations FOR SELECT TO k_jobs_runtime
  USING(current_setting('app.payment_system',true)='verified');
CREATE POLICY payment_batches ON core.commerce_batches TO k_jobs_runtime
  USING(current_setting('app.payment_system',true)='verified')
  WITH CHECK(current_setting('app.payment_system',true)='verified');
CREATE POLICY payment_skus ON core.commerce_skus TO k_jobs_runtime
  USING(current_setting('app.payment_system',true)='verified')
  WITH CHECK(current_setting('app.payment_system',true)='verified');
CREATE POLICY payment_obligation ON core.commerce_order_payment_obligations TO k_jobs_runtime
  USING(current_setting('app.payment_system',true)='verified')
  WITH CHECK(current_setting('app.payment_system',true)='verified');

CREATE TABLE core.commerce_reservation_expirations (
  order_id uuid PRIMARY KEY REFERENCES core.commerce_orders(id),
  id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE core.commerce_reservation_expirations ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.commerce_reservation_expirations FORCE ROW LEVEL SECURITY;
GRANT SELECT ON core.commerce_reservation_expirations TO k_backup_runtime;
CREATE POLICY expiry_backup ON core.commerce_reservation_expirations FOR SELECT TO k_backup_runtime USING(true);
CREATE POLICY expiry_controlled_owner ON core.commerce_reservation_expirations TO CURRENT_USER USING(true) WITH CHECK(true);
GRANT SELECT,INSERT ON core.commerce_reservation_expirations TO k_jobs_runtime;
GRANT UPDATE(reserved) ON core.commerce_batches TO k_jobs_runtime;
GRANT UPDATE(state,released_at) ON core.commerce_reservations TO k_jobs_runtime;
CREATE POLICY expiry_orders ON core.commerce_orders TO k_jobs_runtime
  USING(current_setting('app.commerce_expiry',true)='verified' AND status='reserved')
  WITH CHECK(current_setting('app.commerce_expiry',true)='verified' AND status='expired');
CREATE POLICY expiry_orders_read ON core.commerce_orders FOR SELECT TO k_jobs_runtime
  USING(current_setting('app.commerce_expiry',true)='verified' AND status IN ('reserved','expired'));
CREATE POLICY expiry_batches ON core.commerce_batches TO k_jobs_runtime
  USING(current_setting('app.commerce_expiry',true)='verified') WITH CHECK(current_setting('app.commerce_expiry',true)='verified');
CREATE POLICY expiry_reservations ON core.commerce_reservations TO k_jobs_runtime
  USING(current_setting('app.commerce_expiry',true)='verified') WITH CHECK(current_setting('app.commerce_expiry',true)='verified' AND state='released');
CREATE POLICY expiry_record ON core.commerce_reservation_expirations TO k_jobs_runtime
  USING(current_setting('app.commerce_expiry',true)='verified') WITH CHECK(current_setting('app.commerce_expiry',true)='verified');
