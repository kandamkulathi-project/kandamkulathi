# Native AuthKit HTTP runtime — bounded candidate

This is additive software, **not company/provider/device or phase acceptance**.
Only the native contracts, Core/provider/database modules, migration 0008 and
native-auth tests belong to this slice. Copied prerequisites are not its changes.
Root registration, migration journal and native UI belong to their assigned owners.

## Exact client protocol

All responses are no-store. POST bodies are strict JSON, maximum 4096 bytes.
No cookies, Origin or browser Fetch Metadata are accepted. Start/exchange also
reject Authorization. No actor, role, scope, MFA or provider URL is client input.

| Endpoint | Input | Successful output |
| --- | --- | --- |
| `POST /v1/native-auth/start` | `{state,redirectUri,codeChallenge,codeChallengeMethod:"S256"}` | `{authorizationUrl}` |
| `POST /v1/native-auth/exchange` | `{state,redirectUri,code,codeVerifier}` | `{credential}` |
| `POST /v1/native-auth/logout` | `{}` plus native bearer and `Idempotency-Key` | `{revoked:true}` |
| `GET /v1/session` | native bearer, parent-composed verifier | existing minimal `ClientSession`, only after current privacy consent |

The SDK callback is exactly `kandamkulathi-ENV://auth/return` for
`local`, `dev`, `staging`, or `production`. Host is `auth`, path `/return`; no
query, fragment, userinfo, wildcard, alternate spelling or cross-environment URI.
This support is **not** company approval or proof WorkOS registered the callback.
The matching environment entry must be explicitly approved/configured in
`allowedRedirects`, in addition to WorkOS application configuration. Missing
approval/configuration fails unavailable, not a simulated login.

The authorization URL is constructed server-side with origin
`https://api.workos.com`, path `/user_management/authorize`, provider `authkit`,
response type `code`, screen hint `sign-in`, configured client ID, and the exact
state/redirect/S256 challenge provided by the native attempt. The SDK may validate
and re-set those **same** proof values, never substitute a second attempt.

Native credentials are **opaque** `n1_` plus 43 base64url characters: 46 total,
within the existing 2048-character vault limit even when the provider JWT is
larger. Provider tokens are never truncated. Only SHA-256 handle digests and
purpose/environment/origin-bound AES-GCM ciphertext are persisted. The dedicated
256-bit encryption key must come from approved secret storage, not the browser key.
WorkOS refresh and third-party tokens are discarded. The actual `NativeSignInBackend`
port has no refresh operation; **no refresh endpoint exists**. Credential lifetime
is the minimum of provider access/session expiry, authoritative internal-session
expiry and configured 30–900-second native TTL. Expiry requires fresh sign-in.
Enrollment never extends or revives an existing expired/revoked session.

### Preprivacy handshake (separate bootstrap owner)

Exchange authenticates a known approved actor, not privacy consent or workspace
access. `dependencies.verifySession` supplies real verified internal identity to
the parent's bootstrap/consent routes; it does not return a fabricated ClientSession.
The native owner must retain the credential **ephemerally**, load the separate
minimal bootstrap identity and approved current policy text, obtain explicit consent,
POST the exact requirement to `/v1/consents`, then load `/v1/session` successfully
before writing the vault. Cancel, decline, lifecycle invalidation or failure must
clear ephemeral credentials and never persist a pretend session. Bootstrap migration
0009, DTOs and policy content remain that owner's responsibility.

## Durable protocol and provider trust

Attempts bind state digest, exact redirect and challenge. State is single-use and
30–600-second TTL. Atomic compare-and-set consumption **commits before** any provider
exchange; cancellation/timeout/unknown exchange outcome requires a fresh attempt.
There is no automatic code replay. Provider HTTPS redirects are prohibited, bodies
bounded and requests timeout. The existing WorkOS verifier cryptographically verifies
RS256 against the fixed client JWKS and checks issuer/application/time/user/session/org
plus the live active-session list. Exchange response user must match the verified JWT.
Impersonation, unapproved organization mapping and malformed data deny. Enrollment
requires an existing active actor and approved policy; no signup/actor creation,
MFA inference, implicit consent, memberships or grants are introduced.

Migration 0008 adds fixed-cardinality durable global rate lanes: start 30/minute,
exchange 30/minute, session 120/minute, logout 30/minute, **every provider HTTPS
call** 240/minute. JWKS and each pagination page spend budget too. It collects no
raw IP/forwarding headers and does not claim per-device fairness or availability
under shared-budget exhaustion. Attempts cap at 600 total; native session/ledger
rows cap at 5000 total (including pending obligations). Capacity checks serialize
in short transactions, preventing concurrent admission from exceeding those caps.
This native module does not modify/reuse the separately owned web maintenance tables.

Logout verifies the actual current native credential, then atomically revokes both
the native handle and linked authoritative identity session **before** provider I/O.
It purges encrypted access material locally. `503 LOGOUT_PENDING` means local revoke
committed but WorkOS completion is unknown; it is not business authentication.
Same-handle/same-key retries only retrieve/reconcile that logout result; different keys
deny. Pending reconciliation survives credential expiry. Completed tombstones remain
until 24 hours after credential expiry. The client's current credential must be removed
on local revocation; retry material must not re-enter its auth vault.

The jobs-role factory claims one pending row at a time using SKIP LOCKED, commits a
five-minute random-token lease, verifies lease ownership before external effects,
and uses lease-token/unexpired CAS for completion. Each run handles at most five
claims. A lost revoke response is not blindly repeated: the next lease enumerates
the actual active-session list before deciding whether revoke is still required.
Revoke 2xx alone does not establish success: live inactive confirmation is required.
Unknown/provider failure keeps pending with capped exponential delay. Provider calls
hold no DB transaction or locks. Cleanup handles at most 100 rows per class and
never deletes pending obligations. Controlled owner and runtime/job RLS/column grants
remain separate; functions have fixed search paths and no PUBLIC execution privilege.

## Parent composition

```ts
const native = createNativeAuthRuntime(options, withCoreClient);
const nativeJobs = native.maintenance(withJobsClient);
registerNativeAuthRoutes(app, native, nativeJobs);
// Inside the existing scheduled handler, after platform environment validation:
await nativeJobs.run();
```

Options extend WorkosOptions with `apiOrigin` (exact HTTPS origin), `environment`,
`allowedRedirects`, `encryptionKey`, `attemptTtlSeconds`, `sessionTtlSeconds`, and
optional approved `organizationMappings` (WorkOS org -> internal UUID).
WithClient uses the existing event-scoped database helper, not another driver.
Jobs must use `k_jobs_runtime`, Core `k_core_runtime`; neither may inherit the
controlled migration owner. Apply 0008 as the **same** controlled owner as 0002
after the preceding migrations; parent owns the journal entry.

Parent session dispatch must deny Cookie+Authorization, route `Bearer n1_...`
exclusively to `native.dependencies.verifySession`, and preserve existing issued-JWT
bearer and web-cookie verification for their own transports. Never send opaque
handles to WorkOS as access tokens. Native mutations inject
`native.verifyMutationRequest(request,{actorId,sessionId})` and wrap each protected
effect with `native.withNativeSessionInTransaction(client,request,identity,callback)`
inside its **same platform transaction**. This locks current authority and native
handle through commit, fencing local revocation. It is not an authorization bypass:
domain scope/consent/grants still require their existing deterministic decisions.
Provider verification must occur before opening that transaction. Existing browser
logout deliberately rejects Authorization and must not be adapted for native use.

## Verification and remaining handoff

`tests/unit/native-auth.test.ts` exercises strict DTOs, URL/proof construction,
provider body/token limits, no refresh exposure, pagination/malformed linkage,
missing approval and transaction guards. `tests/integration/native-auth-postgres.test.ts`
uses real PostgreSQL, the Neon transaction path, non-superuser controlled migration
owner, non-owner runtime RLS, signed synthetic RS256 fixtures and actual Hono routes.
It covers consent bootstrap denial then explicit persisted consent/session, large JWT
to opaque handle, replay races, expiry/rollback, denied signatures/subjects/accounts,
rate caps, expired-session non-resurrection, durable uncertain logout, leases/CAS,
pending retention and in-transaction revocation fencing. Synthetic HTTPS fixtures
are not real WorkOS account/device evidence.

`tests/e2e/native-auth-runtime.spec.ts` targets the **actual** local Core workerd
routes with no interception and expects safe unavailable until approved configuration.
Root registration and that focused workerd run are parent-owned integration work;
full verification/build/platform/browser campaigns are not run by this bounded slice.
All PostgreSQL/browser/build/platform work must hold
`/tmp/opencode/kandamkulathi-p1-e2e.lock`. Actual command outcomes are delivery evidence,
not inferred from test source. No commit/push/merge/deploy is authorized here.

Official WorkOS documentation checked for this implementation:

- [Authorization URL and S256](https://workos.com/docs/reference/user-management/authentication/get-authorization-url)
- [Code authentication](https://workos.com/docs/reference/authkit/authentication/code)
- [Active sessions and revoke](https://workos.com/docs/reference/user-management/session/revoke)

The current redirect documentation states HTTPS/loopback production restrictions;
it does not establish approval of the requested private scheme for this company
application. Real sandbox registration/custom-scheme proof and company approval
remain explicit blockers, not grounds to substitute an unapproved callback.
Supported-device browser handoff/AppState/vault proof, provider account proof,
independent security/privacy review, approved policy text and root integration remain
required before activation. Roll back route activation first; preserve pending
revocation/audit obligations and additive schema until reviewed recovery work.
