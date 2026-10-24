-- Additive foundation. Coordinator registers migration 0021 after independent review.
-- No dependency on unagreed order/booking schema. Trusted authority repository locks the subject.
GRANT USAGE ON SCHEMA core TO k_core_runtime,k_jobs_runtime,k_backup_runtime;
CREATE TABLE core.commerce_payment_intents (
 id uuid PRIMARY KEY, operation_id uuid NOT NULL UNIQUE,
 subject_kind text NOT NULL CHECK(subject_kind IN ('order','booking')), subject_id uuid NOT NULL,
 owner_id uuid NOT NULL, amount_paise bigint NOT NULL CHECK(amount_paise BETWEEN 1 AND 9007199254740991),
 currency text NOT NULL CHECK(currency='INR'), account_id text NOT NULL CHECK(account_id ~ '^acc_[A-Za-z0-9]{1,80}$'),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','creating','ready','unknown','captured','failed')),
 authority_revision integer CHECK(authority_revision>0),
 provider_order_id text CHECK(provider_order_id ~ '^order_[A-Za-z0-9]{1,80}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(subject_kind,subject_id), UNIQUE(account_id,provider_order_id),
 CHECK(state NOT IN ('ready','captured','failed') OR provider_order_id IS NOT NULL)
);
CREATE TABLE core.commerce_payment_receipts (
 id uuid NOT NULL UNIQUE,
 account_id text NOT NULL, event_id text NOT NULL CHECK(length(event_id) BETWEEN 1 AND 128),
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 provider_order_id text NOT NULL, payment_id text NOT NULL, business_reference uuid NOT NULL,
 amount_paise bigint NOT NULL CHECK(amount_paise BETWEEN 1 AND 9007199254740991),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 intent_id uuid REFERENCES core.commerce_payment_intents,
 outcome text NOT NULL CHECK(outcome IN ('captured','failed')),
 result text NOT NULL CHECK(result IN ('applied','rejected')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(account_id,event_id,digest)
);
CREATE TABLE core.commerce_payment_obligations (
 id uuid PRIMARY KEY, account_id text NOT NULL, payment_id text NOT NULL, provider_order_id text NOT NULL,
 business_reference uuid NOT NULL, intent_id uuid REFERENCES core.commerce_payment_intents,
 receipt_id uuid NOT NULL REFERENCES core.commerce_payment_receipts(id),
 amount_paise bigint NOT NULL CHECK(amount_paise BETWEEN 1 AND 9007199254740991),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 reason text NOT NULL CHECK(reason IN ('capture_mismatch','additional_capture','replay_mismatch')),
 state text NOT NULL DEFAULT 'pending_review_and_reconciliation' CHECK(state='pending_review_and_reconciliation'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(account_id,payment_id)
);
CREATE TABLE core.commerce_payment_ledger (
 id uuid PRIMARY KEY, intent_id uuid NOT NULL UNIQUE REFERENCES core.commerce_payment_intents,
 account_id text NOT NULL, payment_id text NOT NULL CHECK(payment_id ~ '^pay_[A-Za-z0-9]{1,80}$'),
 amount_paise bigint NOT NULL CHECK(amount_paise BETWEEN 1 AND 9007199254740991),
 currency text NOT NULL CHECK(currency='INR'), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(account_id,payment_id)
);
CREATE TABLE core.commerce_payment_refunds (
 id uuid PRIMARY KEY, operation_id uuid NOT NULL UNIQUE,
 intent_id uuid NOT NULL REFERENCES core.commerce_payment_intents,
 actor_id uuid NOT NULL, amount_paise bigint NOT NULL CHECK(amount_paise BETWEEN 1 AND 9007199254740991),
 policy_version text NOT NULL CHECK(length(policy_version) BETWEEN 1 AND 128), approved_by uuid NOT NULL,
 state text NOT NULL DEFAULT 'requested' CHECK(state IN ('requested','unknown','processed','failed')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
GRANT SELECT,INSERT ON core.commerce_payment_intents,core.commerce_payment_refunds TO k_core_runtime;
GRANT SELECT ON core.commerce_payment_ledger TO k_core_runtime;
GRANT SELECT ON core.commerce_payment_intents TO k_jobs_runtime;
GRANT SELECT,INSERT ON core.commerce_payment_receipts,core.commerce_payment_ledger,core.commerce_payment_obligations TO k_jobs_runtime;
GRANT UPDATE(state,provider_order_id) ON core.commerce_payment_intents TO k_core_runtime,k_jobs_runtime;
-- Financial application uses jobs credentials; never combine core/jobs memberships.
GRANT INSERT ON platform.outbox TO k_jobs_runtime;
CREATE POLICY payment_outbox_insert ON platform.outbox FOR INSERT TO k_jobs_runtime WITH CHECK(
 channel='financial' AND kind='commerce.reconcile' AND status='pending' AND publish_attempts=0 AND execution_attempts=0
 AND lease_token IS NULL AND lease_until IS NULL AND failure_code IS NULL AND claimed_at IS NULL AND completed_at IS NULL);
-- Ledger, receipt and refund approval facts are append-only for runtime; no DELETE anywhere.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['commerce_payment_intents','commerce_payment_receipts','commerce_payment_ledger','commerce_payment_refunds','commerce_payment_obligations'] LOOP
 EXECUTE format('ALTER TABLE core.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE core.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('GRANT SELECT ON core.%I TO k_backup_runtime',t);
  EXECUTE format('CREATE POLICY payment_backup ON core.%I FOR SELECT TO k_backup_runtime USING(true)',t);
  EXECUTE format('CREATE POLICY payment_controlled_owner ON core.%I TO CURRENT_USER USING(true) WITH CHECK(true)',t);
 END LOOP;
END $$;
CREATE POLICY payment_intents_read ON core.commerce_payment_intents FOR SELECT TO k_core_runtime USING(
 owner_id=nullif(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY payment_intents_insert ON core.commerce_payment_intents FOR INSERT TO k_core_runtime WITH CHECK(
 owner_id=nullif(current_setting('app.actor_id',true),'')::uuid AND state='pending' AND provider_order_id IS NULL);
CREATE POLICY payment_intents_update ON core.commerce_payment_intents FOR UPDATE TO k_core_runtime
 USING(owner_id=nullif(current_setting('app.actor_id',true),'')::uuid)
 WITH CHECK(owner_id=nullif(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY payment_intents_jobs ON core.commerce_payment_intents TO k_jobs_runtime
 USING(current_setting('app.payment_system',true)='verified') WITH CHECK(current_setting('app.payment_system',true)='verified');
CREATE POLICY payment_receipts_read ON core.commerce_payment_receipts FOR SELECT TO k_jobs_runtime
 USING(current_setting('app.payment_system',true)='verified');
CREATE POLICY payment_receipts_insert ON core.commerce_payment_receipts FOR INSERT TO k_jobs_runtime
 WITH CHECK(current_setting('app.payment_system',true)='verified');
CREATE POLICY payment_obligations_read ON core.commerce_payment_obligations FOR SELECT TO k_jobs_runtime
 USING(current_setting('app.payment_system',true)='verified');
CREATE POLICY payment_obligations_insert ON core.commerce_payment_obligations FOR INSERT TO k_jobs_runtime
 WITH CHECK(current_setting('app.payment_system',true)='verified');
CREATE POLICY payment_ledger_read ON core.commerce_payment_ledger FOR SELECT TO k_core_runtime,k_jobs_runtime
 USING(EXISTS(SELECT 1 FROM core.commerce_payment_intents i WHERE i.id=intent_id));
CREATE POLICY payment_ledger_insert ON core.commerce_payment_ledger FOR INSERT TO k_jobs_runtime WITH CHECK(
 current_setting('app.payment_system',true)='verified' AND EXISTS(
 SELECT 1 FROM core.commerce_payment_intents i WHERE i.id=intent_id AND i.account_id=commerce_payment_ledger.account_id
 AND i.amount_paise=commerce_payment_ledger.amount_paise AND i.currency=commerce_payment_ledger.currency AND i.state='captured'));
CREATE POLICY payment_refunds_read ON core.commerce_payment_refunds FOR SELECT TO k_core_runtime
 USING(EXISTS(SELECT 1 FROM core.commerce_payment_intents i WHERE i.id=intent_id));
CREATE POLICY payment_refunds_insert ON core.commerce_payment_refunds FOR INSERT TO k_core_runtime WITH CHECK(
 actor_id=nullif(current_setting('app.actor_id',true),'')::uuid AND state='requested' AND EXISTS(
 SELECT 1 FROM core.commerce_payment_intents i WHERE i.id=intent_id AND i.owner_id=actor_id AND i.state='captured'));
