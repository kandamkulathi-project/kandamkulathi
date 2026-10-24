-- Trusted financial jobs can classify approved refund requests for explicit review/retry.
-- This grants no approval, refund dispatch, mutation, browser or owner-session bypass.
GRANT SELECT ON core.commerce_payment_refunds TO k_jobs_runtime;
CREATE POLICY refund_jobs_review ON core.commerce_payment_refunds FOR SELECT TO k_jobs_runtime
  USING(current_setting('app.payment_system',true)='verified');
CREATE POLICY expiry_financial_reference ON core.commerce_reservation_expirations FOR SELECT TO k_jobs_runtime
  USING(current_setting('app.payment_system',true)='verified');
