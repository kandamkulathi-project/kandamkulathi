-- Technical unpaid-owner transition only. No policy row is seeded: approval is external.
CREATE TABLE core.commerce_cancellation_policy (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  approved_by uuid NOT NULL REFERENCES core.identity_actors(id),
  approval_reference text NOT NULL CHECK(length(approval_reference) BETWEEN 1 AND 200),
  active boolean NOT NULL DEFAULT false
);
CREATE TABLE core.commerce_order_cancellations (
  operation_id uuid PRIMARY KEY,
  order_id uuid NOT NULL UNIQUE REFERENCES core.commerce_orders(id),
  actor_id uuid NOT NULL REFERENCES core.identity_actors(id),
  expected_version integer NOT NULL CHECK(expected_version>0),
  resulting_version integer NOT NULL CHECK(resulting_version=expected_version+1),
  policy_reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE core.commerce_cancellation_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.commerce_cancellation_policy FORCE ROW LEVEL SECURITY;
ALTER TABLE core.commerce_order_cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.commerce_order_cancellations FORCE ROW LEVEL SECURITY;
CREATE POLICY cancellation_policy_owner ON core.commerce_cancellation_policy TO CURRENT_USER USING(true) WITH CHECK(true);
CREATE POLICY cancellation_record_owner ON core.commerce_order_cancellations TO CURRENT_USER USING(true) WITH CHECK(true);
GRANT SELECT ON core.commerce_cancellation_policy,core.commerce_order_cancellations TO k_core_runtime,k_backup_runtime;
GRANT UPDATE(singleton) ON core.commerce_cancellation_policy TO k_core_runtime;
GRANT INSERT ON core.commerce_order_cancellations TO k_core_runtime;
CREATE POLICY cancellation_policy_read ON core.commerce_cancellation_policy FOR SELECT TO k_core_runtime USING(active);
CREATE POLICY cancellation_policy_lock ON core.commerce_cancellation_policy FOR UPDATE TO k_core_runtime USING(active) WITH CHECK(false);
CREATE POLICY cancellation_policy_backup ON core.commerce_cancellation_policy FOR SELECT TO k_backup_runtime USING(true);
CREATE POLICY cancellation_record_backup ON core.commerce_order_cancellations FOR SELECT TO k_backup_runtime USING(true);
CREATE POLICY cancellation_record_read ON core.commerce_order_cancellations FOR SELECT TO k_core_runtime
  USING(actor_id=nullif(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY cancellation_record_insert ON core.commerce_order_cancellations FOR INSERT TO k_core_runtime WITH CHECK(
  actor_id=nullif(current_setting('app.actor_id',true),'')::uuid
  AND current_setting('app.commerce_mode',true)='cancellation'
  AND EXISTS(SELECT 1 FROM core.commerce_cancellation_policy p WHERE p.active AND p.approval_reference=policy_reference)
  AND EXISTS(SELECT 1 FROM core.commerce_orders o WHERE o.id=order_id AND o.actor_id=commerce_order_cancellations.actor_id
    AND o.status='reserved' AND o.version=expected_version)
  AND NOT EXISTS(SELECT 1 FROM core.commerce_payment_intents i WHERE i.subject_kind='order' AND i.subject_id=order_id)
);
-- Preserve the existing Core lock-only policy AND lack of status/version privileges.
-- Only this fixed transition may write status; no arbitrary paid mutation interface.
-- platform.outbox also uses FORCE RLS: the controlled function owner needs only
-- this SELECT proof, not membership in a runtime role or a general owner bypass.
CREATE POLICY cancellation_outbox_owner_proof ON platform.outbox FOR SELECT TO CURRENT_USER USING(
  current_setting('app.commerce_mode',true)='cancellation' AND channel='financial'
  AND kind='commerce.reconcile' AND EXISTS(SELECT 1 FROM core.commerce_order_cancellations c
    WHERE c.operation_id=outbox.operation_id AND c.order_id=outbox.subject_id
      AND c.actor_id=nullif(current_setting('app.actor_id',true),'')::uuid
      AND c.xmin::text::numeric=mod(pg_current_xact_id()::text::numeric,4294967296))
);
CREATE FUNCTION core.commerce_cancel_prepared_order(target uuid, operation uuid, expected integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core,platform AS $$
DECLARE actor uuid; session uuid; order_row core.commerce_orders; approval text; xid numeric;
  held record; source record; source_full_xid numeric;
BEGIN
  actor := nullif(current_setting('app.actor_id',true),'')::uuid;
  session := nullif(current_setting('identity.internal_session',true),'')::uuid;
  IF actor IS NULL OR session IS NULL OR expected IS NULL OR expected<1
    OR current_setting('app.commerce_mode',true) IS DISTINCT FROM 'cancellation'
    OR nullif(current_setting('identity.actor_id',true),'')::uuid IS DISTINCT FROM actor
  THEN RAISE EXCEPTION 'cancellation transition denied' USING ERRCODE='42501'; END IF;
  PERFORM a.id FROM core.identity_actors a JOIN core.identity_sessions s ON s.actor_id=a.id
    WHERE a.id=actor AND a.status='active' AND s.id=session AND s.revoked_at IS NULL
      AND s.expires_at>clock_timestamp() FOR SHARE OF a,s;
  IF NOT FOUND THEN RAISE EXCEPTION 'cancellation transition denied' USING ERRCODE='42501'; END IF;
  -- Exactly the canonical payment-creation subject fence, before authoritative order lock.
  PERFORM pg_advisory_xact_lock(hashtextextended('payment:order:' || target::text,0));
  SELECT * INTO order_row FROM core.commerce_orders WHERE id=target FOR UPDATE;
  IF NOT FOUND OR order_row.actor_id<>actor OR order_row.status<>'reserved' OR order_row.version<>expected
    OR EXISTS(SELECT 1 FROM core.commerce_payment_intents i WHERE i.subject_kind='order' AND i.subject_id=target)
  THEN RAISE EXCEPTION 'cancellation transition denied' USING ERRCODE='42501'; END IF;
  SELECT approval_reference INTO approval FROM core.commerce_cancellation_policy WHERE active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'cancellation transition denied' USING ERRCODE='42501'; END IF;
  -- xmin cannot be supplied by Core. Proof rows must have been prepared by THIS transaction,
  -- not copied from a prior committed cancellation or outbox operation.
  xid := mod(pg_current_xact_id()::text::numeric,4294967296);
  IF NOT EXISTS(SELECT 1 FROM core.commerce_order_cancellations c
      WHERE c.operation_id=operation AND c.order_id=target AND c.actor_id=actor
        AND c.expected_version=expected AND c.resulting_version=expected+1
        AND c.policy_reference=approval AND c.xmin::text::numeric=xid)
  THEN RAISE EXCEPTION 'cancellation transition denied' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM platform.outbox o WHERE o.operation_id=operation AND o.subject_id=target
      AND o.channel='financial' AND o.kind='commerce.reconcile' AND o.revision=1 AND o.status='pending'
      AND o.publish_attempts=0 AND o.execution_attempts=0 AND o.lease_token IS NULL
      AND o.claimed_at IS NULL AND o.completed_at IS NULL AND o.xmin::text::numeric=xid)
  THEN RAISE EXCEPTION 'cancellation transition denied' USING ERRCODE='42501'; END IF;
  -- The function owns stock release, not just evidence that callers touched rows.
  -- Lock every source in the same FEFO order as checkout/payment before validating
  -- ALL held quantities and stock. Tuple locks do not change xmin.
  PERFORM r.batch_id FROM core.commerce_reservations r JOIN core.commerce_batches b ON b.id=r.batch_id
    WHERE r.order_id=target ORDER BY r.sku_id,b.expires_on,b.id FOR UPDATE OF r,b;
  IF NOT EXISTS(SELECT 1 FROM core.commerce_order_lines l WHERE l.order_id=target)
    OR EXISTS(SELECT 1 FROM core.commerce_order_lines l WHERE l.order_id=target AND l.quantity<>(
      SELECT coalesce(sum(r.quantity),0) FROM core.commerce_reservations r
      WHERE r.order_id=target AND r.sku_id=l.sku_id AND r.state='held'))
    OR EXISTS(SELECT 1 FROM core.commerce_reservations r JOIN core.commerce_batches b ON b.id=r.batch_id
      WHERE r.order_id=target AND (r.state<>'held' OR r.released_at IS NOT NULL
        OR r.xmin::text::numeric=xid OR b.xmin::text::numeric=xid
        OR b.reserved<r.quantity OR b.reserved<(
          SELECT coalesce(sum(other.quantity),0) FROM core.commerce_reservations other
          WHERE other.batch_id=b.id AND other.state='held')))
  THEN RAISE EXCEPTION 'cancellation transition denied' USING ERRCODE='42501'; END IF;
  -- Include writes performed inside released SAVEPOINTs: their xmin is a child
  -- XID, not pg_current_xact_id(). Visible, locked source versions still marked
  -- in progress are our own pre-writes. age(xid) gives the signed distance from
  -- this transaction, including newer child XIDs and 32-bit wraparound. Frozen
  -- special XIDs are committed; old/truncated commit status may be NULL, but
  -- an active transaction's status is retained.
  FOR source IN
    SELECT r.xmin AS row_xid FROM core.commerce_reservations r WHERE r.order_id=target
    UNION ALL SELECT b.xmin FROM core.commerce_reservations r
      JOIN core.commerce_batches b ON b.id=r.batch_id WHERE r.order_id=target LOOP
    IF source.row_xid::text::numeric<3 THEN CONTINUE; END IF;
    source_full_xid := pg_current_xact_id()::text::numeric-age(source.row_xid);
    IF pg_xact_status(source_full_xid::text::xid8)='in progress'
    THEN RAISE EXCEPTION 'cancellation transition denied' USING ERRCODE='42501'; END IF;
  END LOOP;
  -- Reject same-transaction pre-mutations (including no-op writes); xmin alone
  -- cannot prove arithmetic. Perform the exact bounded decrement here under locks.
  FOR held IN SELECT r.batch_id,r.quantity FROM core.commerce_reservations r
      JOIN core.commerce_batches b ON b.id=r.batch_id WHERE r.order_id=target
      ORDER BY r.sku_id,b.expires_on,b.id LOOP
    UPDATE core.commerce_batches SET reserved=reserved-held.quantity
      WHERE id=held.batch_id AND reserved>=held.quantity;
    IF NOT FOUND THEN RAISE EXCEPTION 'cancellation transition denied' USING ERRCODE='42501'; END IF;
    UPDATE core.commerce_reservations SET state='released',released_at=clock_timestamp()
      WHERE order_id=target AND batch_id=held.batch_id AND state='held';
    IF NOT FOUND THEN RAISE EXCEPTION 'cancellation transition denied' USING ERRCODE='42501'; END IF;
  END LOOP;
  UPDATE core.commerce_orders SET status='cancelled',version=version+1
    WHERE id=target AND actor_id=actor AND status='reserved' AND version=expected;
  IF NOT FOUND THEN RAISE EXCEPTION 'cancellation transition denied' USING ERRCODE='42501'; END IF;
  RETURN expected+1;
END $$;
REVOKE ALL ON FUNCTION core.commerce_cancel_prepared_order(uuid,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.commerce_cancel_prepared_order(uuid,uuid,integer) TO k_core_runtime;
