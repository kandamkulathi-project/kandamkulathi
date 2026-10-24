import { approvedPrivacyPolicySchema } from "../../contracts/src/consent-bootstrap.ts";
import { type DatabaseClient, inTransaction } from "./client.ts";

/** Caller holds current identity_policy and actor/session fences on this same client. */
export async function loadApprovedPrivacyPolicyInTransaction(
  client: DatabaseClient,
  privacyVersion: string,
  now: number,
) {
  if (!inTransaction(client)) throw new Error("Policy requires platform transaction");
  if (!Number.isFinite(now)) throw new Error("Invalid policy instant");
  // Lock policy even if an injected parent loader changes its internal implementation.
  const policy = await client.query(
    "SELECT privacy_version, approval_reference FROM core.identity_policy FOR SHARE",
  );
  const current = policy.rows[0];
  if (policy.rows.length !== 1 || current?.privacy_version !== privacyVersion)
    throw new Error("Current policy changed");
  const result = await client.query(
    `SELECT policy_text, revision, policy_sha256, approval_reference, approved_at, revoked_at
     FROM core.identity_privacy_policy_text
     WHERE privacy_version=$1 AND approval_reference=$2 FOR SHARE`,
    [privacyVersion, current.approval_reference],
  );
  const row = result.rows[0];
  if (
    result.rows.length !== 1 ||
    !row ||
    row.revoked_at !== null ||
    !Number.isFinite(new Date(row.approved_at).getTime()) ||
    new Date(row.approved_at).getTime() > now
  )
    throw new Error("Approved privacy policy unavailable");
  const approved = approvedPrivacyPolicySchema.parse({
    text: row.policy_text,
    revision: row.revision,
    sha256: row.policy_sha256,
    approvalReference: row.approval_reference,
  });
  const bytes = new TextEncoder().encode(approved.text);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  if (hash !== approved.sha256) throw new Error("Approved policy integrity mismatch");
  return approved;
}
