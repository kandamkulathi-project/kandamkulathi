import { z } from "zod";
import { consentRequirementSchema } from "../../contracts/src/consent.ts";
import {
  currentAuthoritySchema,
  type VerifiedIdentity,
  verifiedIdentitySchema,
} from "../../contracts/src/identity.ts";
import type { WorkosSession } from "../../providers/src/workos/index.ts";
import { type DatabaseClient, inTransaction, transaction } from "./client.ts";

const setting = async (client: DatabaseClient, name: string, value: string) => {
  await client.query("SELECT set_config($1, $2, true)", [name, value]);
};
const iso = (value: Date | string) => new Date(value).toISOString();

/** Call only with provider-verified identifiers. No externally supplied internal actor/scope. */
export async function linkWorkosSession(
  client: DatabaseClient,
  session: WorkosSession,
): Promise<VerifiedIdentity | null> {
  return transaction(client, async () => {
    await setting(client, "identity.provider_user", session.userId);
    await setting(client, "identity.provider_session", session.sessionId);
    const result = await client.query(
      `SELECT * FROM core.identity_sessions
      WHERE provider_user_id=$1 AND provider_session_id=$2`,
      [session.userId, session.sessionId],
    );
    const row = result.rows[0];
    if (!row || row.revoked_at || (row.provider_organization_id ?? null) !== session.organizationId)
      return null;
    await setting(client, "identity.actor_id", row.actor_id);
    const actor = await client.query(
      "SELECT provider_user_id FROM core.identity_actors WHERE id=$1",
      [row.actor_id],
    );
    if (actor.rows[0]?.provider_user_id !== session.userId) return null;
    return verifiedIdentitySchema.parse({
      actorId: row.actor_id,
      sessionId: row.id,
      organizationId: row.organization_id,
      authenticatedAt: iso(row.authenticated_at),
      expiresAt: new Date(
        Math.min(Date.parse(session.expiresAt), new Date(row.expires_at).getTime()),
      ).toISOString(),
      mfa:
        row.mfa_verified_at && row.mfa_expires_at
          ? { verifiedAt: iso(row.mfa_verified_at), expiresAt: iso(row.mfa_expires_at) }
          : null,
    });
  });
}

/** Internal identity must originate in linkWorkosSession, never a request body/header. */
export async function withIdentityTransaction<T>(
  client: DatabaseClient,
  input: VerifiedIdentity,
  callback: (authority: z.infer<typeof currentAuthoritySchema>) => Promise<T>,
): Promise<T> {
  return transaction(client, async () =>
    callback(await loadCurrentAuthorityInTransaction(client, input)),
  );
}

/** Existing platform transaction required. Locks remain held through caller's domain COMMIT.
 * All authoritative provisioning/revocation writers MUST lock affected actor rows FOR UPDATE
 * in UUID order before changing grants, assignments, sessions or appending consent decisions.
 */
export async function loadCurrentAuthorityInTransaction(
  client: DatabaseClient,
  input: VerifiedIdentity,
  consentWrite = false,
): Promise<z.infer<typeof currentAuthoritySchema>> {
  if (!inTransaction(client)) throw new Error("Identity requires platform transaction");
  const identity = verifiedIdentitySchema.parse(input);
  await setting(client, "identity.actor_id", identity.actorId);
  // The provider tuple is recovered from the verified internal session in a separate
  // trusted composition: use session-id policy context, never request identifiers.
  await setting(client, "identity.internal_session", identity.sessionId);
  // Actor lock is also an insertion fence for append-only consent/new grants. The
  // write mode is restricted to self-consent capture, not a general account edit.
  if (consentWrite)
    await client.query("SELECT id FROM core.identity_actors WHERE id=$1 FOR UPDATE", [
      identity.actorId,
    ]);
  else await client.query("SELECT id FROM core.identity_actors ORDER BY id FOR SHARE");
  await client.query("SELECT id FROM core.identity_sessions WHERE id=$1 FOR SHARE", [
    identity.sessionId,
  ]);
  await client.query("SELECT singleton FROM core.identity_policy FOR SHARE");
  await client.query("SELECT id FROM core.identity_memberships ORDER BY id FOR SHARE");
  await client.query(
    "SELECT patient_id FROM core.identity_patient_links ORDER BY patient_id FOR SHARE",
  );
  await client.query("SELECT id FROM core.identity_assignments ORDER BY id FOR SHARE");
  await client.query("SELECT id FROM core.identity_consents ORDER BY id FOR SHARE");
  await client.query(
    "SELECT consultation_id FROM core.identity_self_consultations ORDER BY consultation_id FOR SHARE",
  );
  const result = await client.query(
    `SELECT a.status, s.*, p.privacy_version, p.consultation_version,
      (SELECT coalesce(jsonb_agg(record), '[]') FROM core.identity_memberships) memberships,
      (SELECT coalesce(jsonb_agg(record), '[]') FROM core.identity_patient_links) links,
      (SELECT coalesce(jsonb_agg(record), '[]') FROM core.identity_assignments) assignments,
      (SELECT coalesce(jsonb_agg(record), '[]') FROM (
        SELECT record, dense_rank() OVER (
          PARTITION BY actor_id, record->>'purpose', record->>'patientId', record->>'clinicId', record->>'consultationId'
          ORDER BY (record->>'decidedAt')::timestamptz DESC) decision_rank
        FROM core.identity_consents) latest WHERE decision_rank=1) consents
      FROM core.identity_actors a JOIN core.identity_sessions s ON s.actor_id=a.id
      CROSS JOIN core.identity_policy p WHERE a.id=$1 AND s.id=$2`,
    [identity.actorId, identity.sessionId],
  );
  const row = result.rows[0];
  if (
    !row ||
    row.organization_id !== identity.organizationId ||
    (row.mfa_verified_at ? iso(row.mfa_verified_at) : null) !==
      (identity.mfa?.verifiedAt ?? null) ||
    (row.mfa_expires_at ? iso(row.mfa_expires_at) : null) !== (identity.mfa?.expiresAt ?? null)
  )
    throw new Error("Identity changed");
  const authority = currentAuthoritySchema.parse({
    actorId: row.actor_id,
    sessionId: row.id,
    accountStatus: row.status,
    sessionExpiresAt: iso(row.expires_at),
    sessionRevokedAt: row.revoked_at ? iso(row.revoked_at) : null,
    privacyVersion: row.privacy_version,
    consultationConsentVersion: row.consultation_version,
    memberships: row.memberships,
    selfPatientLinks: row.links,
    assignments: row.assignments,
    consents: row.consents,
  });
  return authority;
}

export const consentMutationSchema = z.strictObject({
  requirement: consentRequirementSchema,
  decision: z.enum(["granted", "declined"]),
});
export class IdentityMutationError extends Error {
  readonly status: 401 | 403 | 409;
  constructor(status: 401 | 403 | 409, message: string) {
    super(message);
    this.status = status;
  }
}
export async function recordSelfConsent(
  client: DatabaseClient,
  identity: VerifiedIdentity,
  input: unknown,
  now = Date.now(),
  guard?: () => Promise<void>,
) {
  const mutation = consentMutationSchema.parse(input);
  if (mutation.requirement.actorId !== identity.actorId)
    throw new IdentityMutationError(403, "Forbidden consent subject");
  return transaction(client, async () => {
    const authority = await loadCurrentAuthorityInTransaction(client, identity, true);
    await guard?.();
    if (
      !Number.isFinite(now) ||
      authority.sessionRevokedAt !== null ||
      Date.parse(identity.authenticatedAt) > now ||
      Date.parse(identity.expiresAt) <= now ||
      Date.parse(authority.sessionExpiresAt) <= now
    )
      throw new IdentityMutationError(401, "Inactive identity");
    if (authority.accountStatus !== "active")
      throw new IdentityMutationError(403, "Inactive account");
    const policy = await client.query("SELECT * FROM core.identity_policy");
    const requirement = mutation.requirement;
    const expected =
      requirement.purpose === "privacy"
        ? policy.rows[0]?.privacy_version
        : requirement.purpose === "marketing"
          ? policy.rows[0]?.marketing_version
          : policy.rows[0]?.consultation_version;
    if (requirement.version !== expected)
      throw new IdentityMutationError(409, "Consent version changed");
    if (requirement.purpose === "consultation") {
      // Consent capture cannot manufacture a consultation relationship. The operator
      // must provision a matching current self-owned consultation grant first.
      const link = authority.selfPatientLinks.some(
        (entry) =>
          entry.patientId === requirement.patientId &&
          entry.revokedAt === null &&
          Date.parse(entry.validFrom) <= now &&
          Date.parse(entry.expiresAt) > now,
      );
      const scope = await client.query(
        `SELECT 1 FROM core.identity_self_consultations WHERE actor_id=$1
        AND patient_id=$2 AND clinic_id=$3 AND consultation_id=$4 AND revoked_at IS NULL
        AND valid_from <= $5 AND expires_at > $5`,
        [
          identity.actorId,
          requirement.patientId,
          requirement.clinicId,
          requirement.consultationId,
          new Date(now),
        ],
      );
      if (!link || !scope.rowCount)
        throw new IdentityMutationError(403, "Forbidden consultation scope");
    }
    const latest = await client.query(
      `SELECT max((record->>'decidedAt')::timestamptz) latest
      FROM core.identity_consents WHERE actor_id=$1`,
      [identity.actorId],
    );
    if (latest.rows[0]?.latest && new Date(latest.rows[0].latest).getTime() >= now)
      throw new IdentityMutationError(409, "Consent conflict; retry");
    const id = crypto.randomUUID();
    const record = {
      ...requirement,
      id,
      recordedByActorId: identity.actorId,
      decision: mutation.decision,
      decidedAt: new Date(now).toISOString(),
      expiresAt: null,
      revokedAt: null,
    };
    await client.query(
      "INSERT INTO core.identity_consents(id,actor_id,record) VALUES ($1,$2,$3::jsonb)",
      [id, identity.actorId, JSON.stringify(record)],
    );
    return { id };
  });
}
