import { z } from "zod";
import { type DatabaseClient, transaction } from "./client.ts";

export type AuthOperation = "start" | "authorize" | "callback" | "session" | "context" | "logout";
export const authRateCaps = Object.freeze({
  global: 600,
  ip: 60,
  start: 10,
  authorize: 10,
  callback: 20,
  session: 60,
  context: 60,
  logout: 20,
  providerGlobal: 2400,
  providerIp: 120,
  providerActor: 120,
  pendingBacklog: 2000,
});
const hashSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const operationSchema = z.enum(["start", "authorize", "callback", "session", "context", "logout"]);
type Counter = { hash: string; lane: string; limit: number };
const admissionContext = (client: DatabaseClient) =>
  client.query("SELECT set_config('identity.web_admission','true',true)");
async function count(client: DatabaseClient, counter: Counter): Promise<boolean> {
  const result = await client.query(
    `WITH t AS MATERIALIZED(SELECT date_trunc('minute',clock_timestamp()) AS stamp)
    INSERT INTO core.identity_web_rate_windows(bucket_hash,lane,window_start,hits,expires_at)
    SELECT $1,$2,t.stamp,1,t.stamp+interval '2 minutes' FROM t
    ON CONFLICT(bucket_hash,lane,window_start) DO UPDATE SET hits=identity_web_rate_windows.hits+1
    WHERE identity_web_rate_windows.hits<$3 RETURNING hits`,
    [hashSchema.parse(counter.hash), counter.lane, counter.limit],
  );
  return result.rowCount === 1;
}
/** Sequential fixed-order atomic counters: global first, then pseudonymous subject.
 * A denied attempt retains preceding increments, preventing unbounded key creation.
 */
export async function admitAuthOperation(
  client: DatabaseClient,
  globalHash: string,
  ipHash: string,
  operation: AuthOperation,
): Promise<boolean> {
  const lane = operationSchema.parse(operation);
  return transaction(client, async () => {
    await admissionContext(client);
    if (
      !(await count(client, { hash: globalHash, lane: "auth-global", limit: authRateCaps.global }))
    )
      return false;
    if (lane === "start" || lane === "authorize" || lane === "callback") {
      const backlog = await client.query(
        `SELECT count(*)::integer AS total FROM (
        SELECT 1 FROM core.identity_web_sessions WHERE revocation_pending LIMIT $1) capped`,
        [authRateCaps.pendingBacklog],
      );
      if (backlog.rows[0]?.total >= authRateCaps.pendingBacklog) return false;
    }
    if (!(await count(client, { hash: ipHash, lane: "auth-ip", limit: authRateCaps.ip })))
      return false;
    return count(client, { hash: ipHash, lane, limit: authRateCaps[lane] });
  });
}
export async function admitProviderCall(
  client: DatabaseClient,
  globalHash: string,
  ipHash: string,
  actorHash?: string,
): Promise<boolean> {
  return transaction(client, async () => {
    await admissionContext(client);
    if (
      !(await count(client, {
        hash: globalHash,
        lane: "provider-global",
        limit: authRateCaps.providerGlobal,
      }))
    )
      return false;
    if (
      !(await count(client, { hash: ipHash, lane: "provider-ip", limit: authRateCaps.providerIp }))
    )
      return false;
    return actorHash
      ? count(client, {
          hash: actorHash,
          lane: "provider-actor",
          limit: authRateCaps.providerActor,
        })
      : true;
  });
}
export async function admitProviderActor(
  client: DatabaseClient,
  actorHash: string,
): Promise<boolean> {
  return transaction(client, async () => {
    await admissionContext(client);
    return count(client, {
      hash: actorHash,
      lane: "provider-actor",
      limit: authRateCaps.providerActor,
    });
  });
}

const claimSchema = z.object({
  handle_hash: hashSchema,
  actor_id: z.uuid(),
  provider_user_id: z.string().regex(/^user_[A-Za-z0-9]+$/),
  provider_session_id: z.string().regex(/^session_[A-Za-z0-9]+$/),
  logout_lease_token: z.uuid(),
  logout_attempts: z.number().int().positive(),
});
export type LogoutClaim = z.infer<typeof claimSchema>;
export type LogoutFailure =
  | "provider_unavailable"
  | "provider_state_invalid"
  | "provider_still_active"
  | "budget_exhausted";
const limitSchema = z.number().int().min(1).max(100);
export async function claimPendingLogouts(
  client: DatabaseClient,
  limit = 5,
): Promise<LogoutClaim[]> {
  limitSchema.max(5).parse(limit);
  return transaction(client, async () => {
    const result = await client.query(
      `WITH due AS (
      SELECT handle_hash FROM core.identity_web_sessions WHERE revocation_pending AND revoked_at IS NOT NULL
      AND logout_next_attempt_at<=clock_timestamp() AND (logout_lease_until IS NULL OR logout_lease_until<=clock_timestamp())
      ORDER BY logout_next_attempt_at,handle_hash FOR UPDATE SKIP LOCKED LIMIT $1), claimed AS (
      UPDATE core.identity_web_sessions w SET logout_lease_token=gen_random_uuid(),logout_lease_until=clock_timestamp()+interval '5 minutes',
      logout_attempts=least(w.logout_attempts+1,1000000) FROM due WHERE w.handle_hash=due.handle_hash RETURNING w.*)
      SELECT c.handle_hash,c.actor_id,c.logout_lease_token,c.logout_attempts,s.provider_user_id,s.provider_session_id
      FROM claimed c JOIN core.identity_sessions s ON s.id=c.session_id AND s.actor_id=c.actor_id
      JOIN core.identity_actors a ON a.id=c.actor_id AND a.provider_user_id=s.provider_user_id`,
      [limit],
    );
    return result.rows.map((row) => claimSchema.parse(row));
  });
}
export async function ownsLogoutLease(
  client: DatabaseClient,
  claim: LogoutClaim,
): Promise<boolean> {
  const parsed = claimSchema.parse(claim);
  const result = await client.query(
    `SELECT 1 FROM core.identity_web_sessions WHERE handle_hash=$1 AND logout_lease_token=$2
    AND logout_lease_until>clock_timestamp() AND revocation_pending`,
    [parsed.handle_hash, parsed.logout_lease_token],
  );
  return result.rowCount === 1;
}
export async function finishLogoutClaim(
  client: DatabaseClient,
  claim: LogoutClaim,
  outcome: { complete: true } | { complete: false; failure: LogoutFailure },
): Promise<boolean> {
  const parsed = claimSchema.parse(claim);
  const failure = outcome.complete
    ? null
    : z
        .enum([
          "provider_unavailable",
          "provider_state_invalid",
          "provider_still_active",
          "budget_exhausted",
        ])
        .parse(outcome.failure);
  return transaction(client, async () => {
    const result = await client.query(
      `UPDATE core.identity_web_sessions SET
      revocation_pending=CASE WHEN $3 THEN false ELSE true END,
      provider_revoked_at=CASE WHEN $3 THEN clock_timestamp() ELSE provider_revoked_at END,
      logout_last_failure=$4,logout_lease_token=NULL,logout_lease_until=NULL,
      logout_next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,5*power(2,least(logout_attempts,10)))::integer)
      WHERE handle_hash=$1 AND logout_lease_token=$2 AND logout_lease_until>clock_timestamp() AND revocation_pending
      RETURNING handle_hash`,
      [parsed.handle_hash, parsed.logout_lease_token, outcome.complete, failure],
    );
    return result.rowCount === 1;
  });
}

/** Bounded SKIP LOCKED TTL work; pending obligations survive all credential expiry. */
export async function cleanupWebAuth(client: DatabaseClient, limit = 100) {
  limitSchema.parse(limit);
  return transaction(client, async () => {
    const attempts = await client.query(
      `WITH expired AS(SELECT browser_hash FROM core.identity_web_attempts
      WHERE expires_at<=clock_timestamp() ORDER BY expires_at,browser_hash FOR UPDATE SKIP LOCKED LIMIT $1)
      DELETE FROM core.identity_web_attempts a USING expired e WHERE a.browser_hash=e.browser_hash RETURNING a.browser_hash`,
      [limit],
    );
    const windows = await client.query(
      `WITH expired AS(SELECT bucket_hash,lane,window_start FROM core.identity_web_rate_windows
      WHERE expires_at<=clock_timestamp() ORDER BY expires_at,bucket_hash,lane FOR UPDATE SKIP LOCKED LIMIT $1)
      DELETE FROM core.identity_web_rate_windows w USING expired e WHERE w.bucket_hash=e.bucket_hash AND w.lane=e.lane AND w.window_start=e.window_start RETURNING w.bucket_hash`,
      [limit],
    );
    const tokens = await client.query(
      `WITH expired AS(SELECT handle_hash FROM core.identity_web_sessions
      WHERE (expires_at<=clock_timestamp() OR revoked_at IS NOT NULL) AND access_token_ciphertext<>'purged'
      ORDER BY actor_id,handle_hash FOR UPDATE SKIP LOCKED LIMIT $1)
      UPDATE core.identity_web_sessions w SET access_token_ciphertext='purged' FROM expired e
      WHERE w.handle_hash=e.handle_hash RETURNING w.handle_hash`,
      [limit],
    );
    const sessions = await client.query(
      `WITH expired AS(SELECT handle_hash FROM core.identity_web_sessions
      WHERE expires_at+interval '24 hours'<=clock_timestamp() AND NOT revocation_pending
      AND (logout_lease_until IS NULL OR logout_lease_until<=clock_timestamp())
      ORDER BY actor_id,handle_hash FOR UPDATE SKIP LOCKED LIMIT $1)
      DELETE FROM core.identity_web_sessions w USING expired e WHERE w.handle_hash=e.handle_hash RETURNING w.handle_hash`,
      [limit],
    );
    return {
      attempts: attempts.rowCount ?? 0,
      windows: windows.rowCount ?? 0,
      tokens: tokens.rowCount ?? 0,
      sessions: sessions.rowCount ?? 0,
    };
  });
}
