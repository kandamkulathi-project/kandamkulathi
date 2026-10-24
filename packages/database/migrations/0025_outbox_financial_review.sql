-- Additive deadline disposition only; does not resolve financial obligations.
ALTER TABLE platform.outbox DROP CONSTRAINT outbox_failure;
ALTER TABLE platform.outbox ADD CONSTRAINT outbox_failure CHECK (
  failure_code IS NULL OR failure_code IN (
    'deadline_elapsed','retry_exhausted','publish_failed','execution_failed',
    'consent_revoked','version_changed','not_authorized','financial_review_required'
  )
);
