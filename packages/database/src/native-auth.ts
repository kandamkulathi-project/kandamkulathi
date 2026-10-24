import { z } from "zod";
import type { VerifiedIdentity } from "../../contracts/src/identity.ts";
import { type DatabaseClient, inTransaction, transaction } from "./client.ts";

const hash = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const date = z.union([z.date(), z.iso.datetime()]).transform((value) => new Date(value));
const rowSchema = z.object({
  handle_hash: hash,
  actor_id: z.uuid(),
  session_id: z.uuid(),
  provider_user_id: z.string().regex(/^user_[A-Za-z0-9]+$/),
  provider_session_id: z.string().regex(/^session_[A-Za-z0-9]+$/),
  access_ciphertext: z.string().max(32768),
  expires_at: date,
  revoked_at: date.nullable(),
  logout_key_hash: hash.nullable(),
  pending: z.boolean(),
});
export const nativeContext = async (
  client: DatabaseClient,
  name: "state" | "handle",
  value: string,
) => {
  if (!inTransaction(client)) throw new Error("Native context requires transaction");
  await client.query("SELECT set_config($1,$2,true)", [
    `identity.native_${name}`,
    hash.parse(value),
  ]);
};
export async function nativeAdmission(
  client: DatabaseClient,
  lane: "start" | "exchange" | "session" | "logout" | "provider",
) {
  return transaction(client, async () => {
    const result = await client.query("SELECT core.native_auth_admit($1) allowed", [lane]);
    return result.rows[0]?.allowed === true;
  });
}
export async function readNativeSession(client: DatabaseClient, handleHash: string, lock = false) {
  if (!inTransaction(client)) throw new Error("Native session requires transaction");
  await nativeContext(client, "handle", handleHash);
  const result = await client.query(
    `SELECT * FROM core.identity_native_sessions WHERE handle_hash=$1${lock ? " FOR SHARE" : ""}`,
    [handleHash],
  );
  return result.rows[0] ? rowSchema.parse(result.rows[0]) : null;
}
export async function consumeNativeAttempt(
  client: DatabaseClient,
  stateHash: string,
  redirectUri: string,
  challenge: string,
) {
  return transaction(client, async () => {
    const result = await client.query("SELECT core.native_auth_consume($1,$2,$3) consumed", [
      hash.parse(stateHash),
      redirectUri,
      hash.parse(challenge),
    ]);
    return result.rows[0]?.consumed === true;
  });
}
/** This guard is called after current authority locks, inside the SAME domain transaction. */
export async function guardNativeSession(
  client: DatabaseClient,
  handleHash: string,
  identity: VerifiedIdentity,
  now: number,
) {
  const row = await readNativeSession(client, handleHash, true);
  if (
    !row ||
    row.actor_id !== identity.actorId ||
    row.session_id !== identity.sessionId ||
    row.revoked_at ||
    row.expires_at.getTime() <= now
  )
    throw new Error("Native credential inactive");
}
const claimSchema = z.object({
  handle_hash: hash,
  provider_user_id: z.string().regex(/^user_[A-Za-z0-9]+$/),
  provider_session_id: z.string().regex(/^session_[A-Za-z0-9]+$/),
  lease_token: z.uuid(),
});
export type NativeLogoutClaim = z.infer<typeof claimSchema>;
export async function claimNativeLogout(client: DatabaseClient, handleHash?: string) {
  if (handleHash !== undefined) hash.parse(handleHash);
  return transaction(client, async () => {
    const result = await client.query(
      `WITH due AS (
      SELECT handle_hash FROM core.identity_native_sessions WHERE pending AND next_attempt_at<=clock_timestamp()
      AND (lease_until IS NULL OR lease_until<=clock_timestamp()) AND ($1::text IS NULL OR handle_hash=$1)
      ORDER BY next_attempt_at,handle_hash FOR UPDATE SKIP LOCKED LIMIT 1)
      UPDATE core.identity_native_sessions n SET lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '5 minutes',
      attempts=least(n.attempts+1,1000000) FROM due WHERE n.handle_hash=due.handle_hash RETURNING n.*`,
      [handleHash ?? null],
    );
    return result.rows[0] ? claimSchema.parse(result.rows[0]) : null;
  });
}
export async function ownsNativeLogout(client: DatabaseClient, claim: NativeLogoutClaim) {
  const parsed = claimSchema.parse(claim);
  const result = await client.query(
    `SELECT 1 FROM core.identity_native_sessions WHERE handle_hash=$1 AND lease_token=$2
    AND lease_until>clock_timestamp() AND pending`,
    [parsed.handle_hash, parsed.lease_token],
  );
  return result.rowCount === 1;
}
export async function finishNativeLogout(
  client: DatabaseClient,
  claim: NativeLogoutClaim,
  complete: boolean,
) {
  const parsed = claimSchema.parse(claim);
  return transaction(client, async () => {
    const result = await client.query(
      `UPDATE core.identity_native_sessions SET pending=NOT $3,lease_token=NULL,lease_until=NULL,
      next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,5*power(2,least(attempts,10)))::integer)
      WHERE handle_hash=$1 AND lease_token=$2 AND lease_until>clock_timestamp() AND pending RETURNING handle_hash`,
      [parsed.handle_hash, parsed.lease_token, complete],
    );
    return result.rowCount === 1;
  });
}
export async function cleanupNativeAuth(client: DatabaseClient) {
  return transaction(client, async () => {
    await client.query(`WITH expired AS (SELECT state_hash FROM core.identity_native_attempts WHERE expires_at<=clock_timestamp()
      ORDER BY expires_at,state_hash FOR UPDATE SKIP LOCKED LIMIT 100)
      DELETE FROM core.identity_native_attempts n USING expired e WHERE n.state_hash=e.state_hash`);
    await client.query(`WITH expired AS (SELECT handle_hash FROM core.identity_native_sessions WHERE expires_at<=clock_timestamp()
      AND access_ciphertext<>'purged' ORDER BY handle_hash FOR UPDATE SKIP LOCKED LIMIT 100)
      UPDATE core.identity_native_sessions n SET access_ciphertext='purged' FROM expired e WHERE n.handle_hash=e.handle_hash`);
    // Pending reconciliation survives expiry; retain completed idempotency tombstones for 24h.
    await client.query(`WITH expired AS (SELECT handle_hash FROM core.identity_native_sessions
      WHERE expires_at+interval '24 hours'<=clock_timestamp() AND NOT pending AND lease_token IS NULL
      ORDER BY handle_hash FOR UPDATE SKIP LOCKED LIMIT 100)
      DELETE FROM core.identity_native_sessions n USING expired e WHERE n.handle_hash=e.handle_hash`);
  });
}
