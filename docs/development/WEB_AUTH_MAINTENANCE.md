# Web auth admission and durable maintenance — P1-MAT-001

Additive software candidate; no company/phase/live-provider acceptance is claimed.
Apply `0007_mathew_web_auth_maintenance.sql` after identity 0002 and the parent's other
ordered migrations. Parent owns the journal, actual root registration and Cron wiring.
No outbox kind, shared index, dependency or queue framework is changed.

## Exact integration

```ts
const maintenance = createWebAuthMaintenance({
  approved, apiKey, apiOrigin, rateKey,
}, {
  withAdmissionClient,   // existing event-scoped k_core_runtime connection callback
  withMaintenanceClient,// existing event-scoped k_jobs_runtime connection callback
  trustedRemoteAddress: request => platformProvenRemoteAddress(request),
}, fetch);

// Before auth route registration. List private COOKIE paths, not public catalogue.
registerWebAuthAdmission(app, maintenance, [
  "/v1/consents", "/v1/bookings", "/v1/knowledge",
]);

// Bind to the SAME raw HTTP Request as the admission middleware.
const admission = maintenance.forRequest(request);
const web = createWebAuthRuntime(webOptions, withClient, {
  approvedBrowserOrigin: sharedBrowserOriginPredicate,
  admitActor: actorId => admission.admitActor(actorId),
}, admission.transport);

// Existing scheduled handler keeps all platform work and additionally awaits:
await maintenance.runCron();
```

Actual files are `apps/core-api/src/web-auth-maintenance.ts` and
`packages/database/src/web-auth-maintenance.ts`. Factory options are
`{approved:boolean, apiKey:string, apiOrigin:string, rateKey:string}`. The rate key is an
**independent base64url 32-byte random HMAC secret**, identical across this environment's
Worker instances, never public configuration. Missing approval/key/proven address fails
unavailable; admission failure occurs before normal auth DB/provider work. Trusted address
must come from a platform-verified boundary. Arbitrary X-Forwarded-For, CF-Connecting-IP or
actor headers are NOT proof by themselves; this module intentionally does not read them.
Local HTTP tests use an explicitly injected synthetic trusted-address adapter, not a fake
claim that real Cloudflare metadata exists. IPv4/IPv6 forms are normalized before HMAC.

`forRequest(request)` returns `{admit,admitActor,transport}`. `admit(operation)` returns
`Promise<"allowed"|"denied"|"unavailable">`; operations are `start`, `authorize`,
`callback`, `session`, `context`, `logout`. Middleware returns no-store **429** with
`Retry-After: 60` for a cap, **503** for unavailable storage/configuration. Known web auth
paths are covered automatically; bearer-only GET session and public catalogue remain
unchanged. Parent must enumerate all additional private cookie paths it enables.

The injected transport refuses all provider calls before admission, pins WorkOS HTTPS
endpoint families, disables redirects, enforces a five-second timeout, a hard 24-call
per-request ceiling and PostgreSQL global/IP/known-actor counters before each call. Never
inject unbounded raw fetch into a configured web runtime or reconstruct a different Request
between middleware and per-request composition. The WeakMap only shares one request's
budget/context; it is **not** the distributed limiter. All cross-request limits are SQL.

### Only essential frozen-web hook change

Parent applies this precise seam to its already-integrated `web-auth.ts`, not a wholesale
copy of this lane's older web runtime:

```ts
// WebAuthHooks:
admitActor?(actorId: string): Promise<"allowed" | "denied" | "unavailable">;

// verifyCookie: AFTER authoritative local row revocation/expiry rejection,
// BEFORE decrypting the provider credential or any provider call:
if (hooks.admitActor && await hooks.admitActor(row.actor_id) !== "allowed")
  return { status: "unavailable" } as const;
```

The optional type seam preserves old isolated fixtures, but **configured production
composition must supply it** and the admission middleware/transport. There is no permissive
maintenance default. The actor comes only from the authenticated opaque-cookie/SQL row;
never consume a victim's quota from a client actor ID. Before identity proof, callback
exchange traffic is bounded by IP/global budgets, not a caller-asserted account. Known-actor
verification consumes one work unit plus one for each provider network call. A different
actor cannot be rebound to the same request. Actor admission exhaustion fails unavailable
before provider work; it grants no identity, consent, MFA or business permission.

## Engineering caps and privacy

Fixed UTC-minute PostgreSQL windows, not clinical, financial or company eligibility rules:

| Scope | Limit per minute |
|---|---:|
| All web auth requests, environment-wide | 600 |
| All web auth requests per proven IP | 60 |
| Start / authorize per IP | 10 / 10 |
| Callback / logout per IP | 20 / 20 |
| Session / context per IP | 60 / 60 |
| Provider calls, environment-wide | 2,400 |
| Provider calls per proven IP | 120 |
| Known actor verification/provider work units | 120 |

Limits are explicit operational defaults for this bounded foundation, not a load/SLA claim.
Review/tune against legitimate NAT/shared-clinic traffic before rollout; do not bypass them
with an in-memory positive or a client-selected identity. Global counters are acquired
first and retained on a later denial, so rotating source addresses cannot create unbounded
counter keys after the global cap. Login start/authorize/callback also stop at 2,000 pending
logout duties; existing sessions may still securely log out, never dropping obligations.

The database stores only origin/purpose-bound HMAC pseudonyms, lane, minute, hit count and
two-minute expiry. It never receives raw IP addresses, cookie values, JWTs or HMAC secrets.
No provider response body/credential or pseudonymous key is returned in operational
summaries/errors. Reverse-proxy denial-of-service controls remain a platform responsibility;
the SQL gate is bounded application admission, not proof of volumetric attack immunity.

## Durable pending logout and Cron invariants

The existing `core.identity_web_sessions.revocation_pending` ledger is the source. There
is no second queue. Migration 0007 adds leases, due time, attempt count, bounded failure
codes and provider-confirmed timestamp. Transition to pending schedules a 30-second quiet
window for the immediate HTTP revoke. HTTP already revokes web + canonical local sessions
in one transaction; maintenance never re-enables either or invents `{revoked:true}`.

Each `runCron()`:

1. Claims at most **5** due rows with `FOR UPDATE SKIP LOCKED`, fresh lease UUID and
   five-minute expiry. The short claim transaction commits before any provider call.
2. Checks lease ownership before each provider request. Reads the official authenticated
   [active user sessions API](https://workos.com/docs/reference/user-management/session),
   exact provider user/session linkage, bounded 100-row pages (at most 10).
3. A fully exhausted active-session listing without the target, or authoritative target
   end/expiry, confirms inactivity without another revoke. Malformed/truncated/repeating
   pagination or provider failures remain pending, never a synthetic ACK.
4. Only a fresh positive active state permits POST to the official session revoke API.
   Whether the POST succeeds or its reply is lost, a subsequent authenticated state check
   determines completion. No uncertain POST is blindly repeated. Every later retry begins
   with another state read. Provider API offers no assumed idempotency-key guarantee.
5. Completes via live lease-token CAS. Stale/expired workers cannot clear pending or write
   success. Failures release the lease and persist bounded exponential backoff (10 seconds
   initially, capped at one hour); they remain durable until positively reconciled.
6. Uses at most **48 provider requests** (four-second timeout each) per invocation. Budget
   exhaustion preserves pending work. Network calls never run under DB locks.
7. Performs bounded TTL cleanup, at most **32 short batches of 100 rows per table**. A
   full final batch sets `cleanupMore` so the parent can alert/re-run, not claim a drain.

Register the maintenance sweep **every minute**, preserve the existing environment guards
and platform scheduled work, and await/report failures via the existing safe operational
boundary. The 3,200-row/table sweep capacity exceeds configured per-minute auth/counter
arrivals; a less frequent schedule needs measured capacity changes. Alert on sustained
pending/stale work, backlog gating or `cleanupMore`. Summaries contain counts only.

Cleanup deletes expired attempts and counters; purges sealed access tokens once a local
session is expired or revoked; deletes non-pending web rows only 24 hours after expiry with
no live lease. **Pending logout rows survive all token/session expiry and retention sweeps.**
Reconciliation uses authoritative provider references, not an expired/decrypted access
token. Canonical actor/session tables, grants, consent/audit records are not deleted. These
ephemeral operational TTLs do not invent a medical/financial retention policy.

Runtime/core and jobs get narrowly scoped RLS/column privileges. Jobs can inspect/lock only
actors/provider references represented by web rows, cannot mint users/grants/MFA, and
cannot update a live web session's token. Controlled-owner policy supports real non-superuser
provisioning under FORCE RLS; roleProof still forbids runtime inheritance of object owners.

## Tests and delivery boundary

`tests/unit/web-auth-maintenance.test.ts` checks unavailable defaults, no forwarding-header
trust or pre-admission network calls, and unchanged public/native boundaries.
`tests/integration/web-auth-maintenance.test.ts` applies 0002+0007 under a real non-superuser
owner and tests PostgreSQL concurrent admission, shared/global caps, pseudonym/TTL privacy,
provider budgets, the essential actor hook, exclusive leases/stale CAS, quiet window,
lost-applied/unapplied revoke replies, malformed/outage/still-active states, network without
DB locks, expired-token obligations and bounded cleanup. WorkOS traffic is cryptographic/
protocol synthetic fixture data, not a live company account test.

No refresh, signup, implicit MFA, root deployment, new dependency, shared journal/exports,
full combined gates or commit are claimed. Parent integrates the small web hook, native-safe
per-request root composition, minute Cron and tests against its final combined candidate.
Rollback removes registration first and retains unresolved logout duties; do not delete
pending rows or relax RLS/rate assertions to obtain green checks.

Final lane evidence: **50 focused tests passed across seven files under the global lock**,
including **18 new maintenance tests** (16 real PostgreSQL/HTTP cases plus two unit cases)
and the existing WorkOS/identity/web regressions. Root TypeScript, Core/Database typechecks,
owned-file Biome and repository documentation checks passed. Parent combined root/Cron
registration, full build/browser/security/precommit and live provider/platform proof remain
unrun by this lane. Source is preserved uncommitted for the coordinator's combined gate.
