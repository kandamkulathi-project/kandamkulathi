-- Additive, unseeded. Only the controlled provisioning owner supplies approved text.
-- Apply after 0002 and coordinated prerequisites; journal activation belongs to parent.
CREATE TABLE core.identity_privacy_policy_text (
  privacy_version text NOT NULL CHECK (length(privacy_version) BETWEEN 1 AND 128),
  approval_reference text NOT NULL CHECK (length(approval_reference) BETWEEN 1 AND 1024),
  revision text NOT NULL CHECK (length(revision) BETWEEN 1 AND 128),
  policy_text text NOT NULL CHECK (length(policy_text) BETWEEN 1 AND 65536),
  policy_sha256 text NOT NULL CHECK (
    policy_sha256 = encode(sha256(convert_to(policy_text, 'UTF8')), 'hex')),
  approved_at timestamptz NOT NULL,
  revoked_at timestamptz,
  lock_guard boolean,
  PRIMARY KEY (privacy_version, approval_reference)
);
ALTER TABLE core.identity_privacy_policy_text ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.identity_privacy_policy_text FORCE ROW LEVEL SECURITY;
REVOKE ALL ON core.identity_privacy_policy_text FROM PUBLIC;
GRANT SELECT ON core.identity_privacy_policy_text TO k_core_runtime, k_backup_runtime;
CREATE POLICY privacy_text_read ON core.identity_privacy_policy_text FOR SELECT
  TO k_core_runtime USING (true);
CREATE POLICY privacy_text_backup ON core.identity_privacy_policy_text FOR SELECT
  TO k_backup_runtime USING (true);
CREATE POLICY privacy_text_controlled_owner ON core.identity_privacy_policy_text
  TO CURRENT_USER USING (true) WITH CHECK (true);
-- PostgreSQL requires one UPDATE column privilege for SELECT FOR SHARE. No data
-- update is allowed, including the inert column; actual UPDATE fails FORCE RLS.
GRANT UPDATE(lock_guard) ON core.identity_privacy_policy_text TO k_core_runtime;
CREATE POLICY privacy_text_lock ON core.identity_privacy_policy_text FOR UPDATE
  TO k_core_runtime USING (true) WITH CHECK (false);
