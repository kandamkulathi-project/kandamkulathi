-- Narrow the permissive payment policy: PostgreSQL ORs it with booking/index
-- policies. A verified scope alone is not evidence of a durable obligation.
-- Preserve those independent policies and all existing privileges/RLS boundaries.
ALTER POLICY payment_outbox_insert ON platform.outbox TO k_jobs_runtime
WITH CHECK (
  channel = 'financial' AND kind = 'commerce.reconcile' AND revision = 1
  AND status = 'pending' AND publish_attempts = 0 AND execution_attempts = 0
  AND lease_token IS NULL AND lease_until IS NULL AND failure_code IS NULL
  AND claimed_at IS NULL AND completed_at IS NULL
  AND (
    (current_setting('app.payment_system', true) = 'verified'
      AND (
        (operation_id = subject_id AND (EXISTS (
          SELECT 1 FROM core.commerce_payment_obligations o
          WHERE o.id = outbox.subject_id
            AND o.state = 'pending_review_and_reconciliation'
        )
        OR EXISTS (
          SELECT 1 FROM core.commerce_order_payment_obligations o
          WHERE o.id = outbox.subject_id AND o.state = 'pending'
        )))
        OR EXISTS (
          SELECT 1 FROM core.commerce_payment_ledger l
          JOIN core.commerce_payment_intents i ON i.id = l.intent_id
          WHERE l.id = outbox.operation_id AND l.intent_id = outbox.subject_id
            AND i.state = 'captured'
        )
      ))
    OR (current_setting('app.commerce_expiry', true) = 'verified'
      AND EXISTS (
        SELECT 1 FROM core.commerce_reservation_expirations e
        JOIN core.commerce_orders o ON o.id = e.order_id
        WHERE e.id = outbox.operation_id AND e.order_id = outbox.subject_id
          AND o.status = 'expired'
      ))
  )
);
