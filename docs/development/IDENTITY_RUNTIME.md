# Identity runtime candidate — P1-MAT-001

This additive, configured candidate is **not phase acceptance**. The integrating Core
runtime registers the bearer session/consent routes and migration 0002; missing approved
provider configuration, account enrollment or current policy stays unavailable. No accounts
or successful login/logout are simulated. Independent Devadathan security/privacy review,
real WorkOS sandbox evidence and approved policies remain required.

## Provider trust

Official references checked for this implementation:

- [Access token and JWKS](https://workos.com/docs/reference/authkit/session-tokens/jwks)
- [Sessions](https://workos.com/docs/authkit/sessions)
- [Live active-session listing](https://workos.com/docs/reference/user-management/session)

`packages/providers/src/workos/index.ts` implements WebCrypto RS256 verification against
the HTTPS WorkOS client JWKS, then HTTPS authenticated active-session listing on **every
request**, with bounded pagination and no revocation cache. Requests cannot supply JWKS
URLs or redirect destinations. Exact issuer, `client_id` application audience, `exp`,
`iat`, optional `nbf`, signature, user/session linkage and current provider organization
must match. If the integration issues `aud`, configure the additional exact `audience`
requirement. Official tokens document `client_id`, not a mandatory `aud`: this adapter
does not silently substitute an absent audience claim. Pin the actual issuer exactly;
official examples differ on trailing slash. Impersonation is denied.

Absent credentials/explicit approval, malformed provider data and provider/storage failure
fail closed. Missing/invalid/revoked bearer credentials produce 401; outages produce 503.
No cookies, client actor/clinic/role/MFA headers or token permissions establish grants.
Custom WorkOS issuers are explicit configuration; HTTPS API/JWKS endpoints remain WorkOS.

## Authoritative storage and transaction integration

Controlled operator applies `packages/database/migrations/0002_mathew_identity.sql` after
platform migrations; the integrating owner must add its journal entry. Do not apply it
to shared resources without migration review. It adds actors, linked sessions, approved
policy versions, explicit memberships, self-patient links, assignments, consent audit
decisions and self-owned consultation scopes. It seeds **nothing**. Runtime cannot enroll
accounts or edit grants, sessions, policy or MFA. JSON records use existing shared schemas;
the adapter parses the entire snapshot and rejects malformed/oversized authority.

Enrollment must bind WorkOS user/session/org to internal UUIDs; session/user FK prevents
cross-actor links. Staff MFA is **not inferred** from undocumented JWT claims or an SSO
method. Only independently verified server step-up evidence may populate session MFA
times plus `mfa_evidence_reference`, using an approved validity policy. That enrollment
and proof are still integration blockers; absent evidence gives no staff access.

```ts
import { transaction } from "@kandamkulathi/database/client";
import { loadCurrentAuthorityInTransaction } from "../../../packages/database/src/identity.ts";
import { authorizeAccess } from "@kandamkulathi/server/authorization";

// identity comes from runtime.dependencies.verifySession(request), not client IDs.
await transaction(client, async () => {
  const authority = await loadCurrentAuthorityInTransaction(client, identity);
  const access = authorizeAccess(identity, authority, requestedScope, Date.now());
  if (!access.allowed) throw new Error("Access denied");
  // Bounded authoritative domain SQL here, on this SAME client/transaction.
  // No provider calls or use of the authority snapshot after commit.
});
```

`loadCurrentAuthorityInTransaction` requires an existing platform transaction (no nesting).
`withIdentityTransaction(client, identity, callback)` wraps the same loader for independent
reads. Neither is an authorization bypass: the caller must run the existing authorization
decision before a protected effect. The loader sets transaction-local actor/session context
and holds `FOR SHARE` locks on current actor/assigned-patient actors, session, policy,
membership/link/assignment/consent/scope rows through domain commit. DB triggers make all
grant/session/relationship/consent writers take affected actor `FOR UPDATE` locks, including
new consent inserts; this fences phantom declines and grants. Deadlock/timeout aborts are
not retried blindly. Runtime context clears on commit/rollback/reuse. RLS denies ambient
reads and cross-actor mutation. Dedicated inert-column lock privileges do not permit real
UPDATE: `WITH CHECK(false)` rejects it. Backup has explicit read-only policies.

## Core composition handoff (parent owns registration/exports)

```ts
import { createIdentityRuntime, registerIdentityRuntimeRoutes } from "./identity-runtime";
import { registerIdentityRoutes } from "@kandamkulathi/server/identity";
import { withDatabase } from "@kandamkulathi/database/client";

const runtime = createIdentityRuntime(
  { apiKey, clientId, issuer, approved: approvedIdentityPolicy },
  callback => withDatabase(databaseUrl, environment, "k_core_runtime",
    ({ client }) => callback(client), localProxy),
);
// Within the existing createService third-argument registerRoutes callback:
registerIdentityRoutes(app, runtime.dependencies);
registerIdentityRuntimeRoutes(app, runtime);
```

Keep platform environment validation before these callbacks and preserve scheduled/queue
handlers. `createCoreApi(runtime.dependencies)` also composes the existing GET-only route.
The integrating owner supplies internal workspace exports and runtime registration;
this identity slice itself uses explicit relative imports and adds no third-party dependencies.

Commerce/domain registration can inject the exact transport hook below:

```ts
verifyMutationRequest: (request, { actorId, sessionId }) =>
  runtime.verifyMutationRequest(request, { actorId, sessionId })
// Promise<"allowed" | "denied" | "unavailable">
```

It re-verifies the WorkOS signature/live session and internal actor/session linkage;
canonical binding mismatch or expired credentials deny, absent approval/provider/storage
failure is unavailable. Cookies and **all** Origin headers are denied by this native/server
bearer-only adapter, irrespective of CORS settings. This transport approval is not a grant:
domain handlers must still reload/lock authority, validate current identity and check their
separate explicit grants in the effect transaction. Browser cookie-CSRF remains unsupported.

SQL context: `identity.actor_id` (internal actor UUID) and `identity.internal_session`
(internal session UUID); provider-link lookup alone uses `identity.provider_user` and
`identity.provider_session` (WorkOS strings). There are no clinic/org/membership GUCs.
Commerce FKs may reference `core.identity_actors(id)` and `core.identity_memberships(id)`;
membership ownership is `identity_memberships.actor_id`. There is no composite unique key
on `(actor_id,id)`, so independently enforce `m.id=g.membership_id AND m.actor_id=g.actor_id`.
Membership workspace/org/clinic/actions/windows are in `record` JSON under existing shared
contract keys. Do not expand identity actions for commerce. Commerce grant writers must
lock affected actors `FOR UPDATE` as their insertion fence, and protected transactions must
lock current granting commerce rows through commit as well as shared identity authority.

### Exact HTTP contracts

- `GET /v1/session`: existing minimal `ClientSession`; no provider IDs or consent history.
- `POST /v1/consents`: JSON `{requirement: ConsentRequirement, decision: "granted" | "declined"}`
  using `packages/contracts/src/consent.ts`; `201 {id: UUID}` only after committed insertion.
  Self subject only; current approved purpose version and exact current self-consultation
  relationship are required. Privacy and optional marketing remain separate decisions.
  Decline is a later immutable audit decision, never an UPDATE hiding an earlier grant.
  400 invalid input, 401 invalid session, 403 subject/scope/account denial, 409 stale version
  or equal-time decision conflict, 503 unavailable/inconsistent authority. Responses no-store.
- Consent capture does not require prior privacy grant (avoids bootstrap deadlock).
- Cookie/Origin-bearing consent requests are rejected. This bearer-only native/server flow
  does not claim browser cookie-CSRF support. Equal-time/replayed capture returns conflict;
  no automatic retry or duplicated-success acknowledgement is fabricated.
- `/v1/auth/start`, `/v1/auth/authorize`, `/v1/security/context`, `/v1/session/logout` are
  **not implemented**. Client `{redirectPath:"/v1/auth/authorize"}`, session/CSRF context,
  idempotent `{revoked:true}` logout need separately reviewed AuthKit state/PKCE, cookie,
  refresh and provider revocation integration. Native vault bearer transport is compatible.

## Tests and remaining gates

`tests/unit/workos*` signs real synthetic RSA JWTs and covers signature/issuer/application/
audience/time/impersonation binding, provider outage, absent approval and live revocation.
`tests/integration/identity-runtime*` covers Hono HTTP denial and a real isolated PostgreSQL
17 runtime via the existing `testDatabase` harness: persisted privacy vs marketing, minimal
HTTP session success, invalid/cross-subject/scope input, rollback/pool context, runtime edit
denial, concurrent session revocation/consent insertion fences and org/MFA changes.
`tests/e2e/identity-runtime.spec.ts` tests the actual unconfigured local workerd boundary,
not intercepted responses. Synthetic provider HTTPS responses do not prove a live account.

Focused execution requires the platform's explicit synthetic PostgreSQL environment.
Use pinned Node/pnpm, frozen install/hooks, and serialize full verify/build/browser/platform/
precommit campaigns with `/tmp/opencode/kandamkulathi-p1-e2e.lock` (no nested lock). Actual
run outcomes belong in delivery evidence, not assumed from this test catalogue. Known
coordinated dependency/security blockers must not be bypassed to commit.

Rollback: revert route activation first; retain additive tables/audit data. Remove schemas
only through reviewed recovery/migration work after all consumers are removed. Do not
delete consent audit or reseed fake approvals. Company matrix/text/retention, real provider
and native device proof, browser flows, independent security review and phase gates remain
Pending/Blocked.
