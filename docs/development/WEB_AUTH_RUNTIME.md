# Configurable web AuthKit runtime — P1-MAT-001 follow-up

Software candidate, **not phase/company/provider acceptance**. Default registration is
owned by the integrating parent. Missing approved configuration stays 503; no login,
CSRF or provider-revocation success is simulated. Native bearer modules are unchanged.

## Frozen integration surface

```ts
import { createWebAuthRuntime, registerWebAuthRoutes } from "./web-auth";
import { registerIdentityRoutes } from "@kandamkulathi/server/identity";

const web = createWebAuthRuntime({
  apiKey, clientId, issuer, approved,
  apiOrigin: "https://api.example.test",
  callbackUrl: "https://api.example.test/v1/auth/callback",
  returnUrl: "https://app.example.test/session/return",
  allowedReturnUrls: ["https://app.example.test/session/return"],
  cookieKey, // base64url encoding of 32 random secret bytes; approved secret store
  attemptTtlSeconds: 120, // configured range 30..600
  sessionTtlSeconds: 300, // range 30..86400; still capped by access-token expiry
  // organizationMappings: { [providerOrgId]: approvedInternalOrgUuid },
}, withClient, {
  approvedBrowserOrigin: (origin, requestURL) =>
    sharedApprovedBrowserOrigin(origin, requestURL),
});

registerWebAuthRoutes(app, web);
registerIdentityRoutes(app, web.dependencies);
```

`withClient` is the existing event-scoped database callback used by identity runtime.
The optional fourth/fifth arguments are `fetch` and a server clock for deterministic
testing. HTTPS is mandatory, including local testing: there is no insecure-cookie
exception. Callback path is exact; destinations are fixed configuration, exact-allowlisted,
HTTPS and never supplied in state or a request query. Secrets must be independent per
environment. The `approvedBrowserOrigin` hook MUST delegate the coordinator's shared
`browser-origins.ts` policy (`BROWSER_ALLOWED_ORIGINS`); this module creates no CORS policy.

When supporting web and native together, parent owns the verifier dispatcher: a cookie
request uses `web.dependencies`, bearer-only uses the unchanged native runtime, and
ambiguous Cookie+Authorization must deny. Do not register competing GET session handlers.
Preserve platform environment validation, scheduled/queue handlers and unavailable defaults.

## Exact HTTP and mutation contracts

| Route | Successful response/effect |
|---|---|
| `GET /v1/auth/start` | Exact `{redirectPath:"/v1/auth/authorize"}` |
| `GET /v1/auth/authorize` | 302 to fixed official WorkOS HTTPS authorize endpoint; sealed attempt cookie |
| `GET /v1/auth/callback?code=...&state=...` | 303 to configured exact return URL; sealed opaque session cookie |
| `GET /v1/session` via existing identity registration | Existing minimal `ClientSession`; current privacy/grants still required |
| `GET /v1/security/context` | Strict `{userId,sessionId,csrfToken,expiresAt}`; no provider/private scope fields |
| `POST /v1/session/logout` with JSON `{}` | Exact `{revoked:true}` only after confirmed provider revocation |

Logout requires approved Origin, bound `X-CSRF-Token`, and `Idempotency-Key` consisting of
16..128 ASCII letters/digits/underscore/hyphen. An exact prior logout with the same sealed
cookie, CSRF and key can replay its confirmed result or retry pending provider revocation;
it cannot access any business route. Different keys deny. Concurrent losers may conflict
and must not be blindly treated as confirmed success.

```ts
verifyMutationRequest: (request, bindings) =>
  web.verifyMutationRequest(request, bindings)
// bindings = {actorId, sessionId}
// Promise<"allowed" | "denied" | "unavailable">
```

This verifies the sealed cookie, live WorkOS session/signature, canonical actor/session
bindings, approved Origin and HMAC CSRF token bound to opaque handle+actor+session. It
does not authorize domain actions. Cross-origin browser mutation support depends on the
parent's shared CORS/Origin policy, never on a role header or CORS alone.

### Required same-transaction fencing

```ts
await transaction(client, async () => {
  await web.withWebSessionInTransaction(client, request, verifiedIdentity,
    async authority => {
      // validateCurrentIdentity / domain authorization and current explicit grants.
      // Domain SQL effects and grant locks remain on this SAME client through COMMIT.
    });
});
```

The helper requires an existing platform transaction; it does not nest or call WorkOS.
It uses the existing locked current-authority loader, then locks/rechecks the exact local
web session through domain commit. Logout marks BOTH web and canonical identity sessions
revoked in one transaction. Provider calls occur only after that transaction commits.

**Consent integration is parent-owned:** `recordSelfConsent` already owns its transaction.
Do NOT wrap it in another transaction. Parent explicitly approved adding an optional
inside-transaction guard to that existing function, after current authority loading and
before any consent effect. Inject this guard there:

```ts
async (client, identity) =>
  web.withWebSessionInTransaction(client, request, identity, async () => {})
```

Parent must test that guard and compose the browser consent route with CSRF, preserving
the existing sole consent business rules and native behavior. This lane intentionally
does not modify the already-delivered `identity.ts` or `identity-runtime.ts`.

## Security/storage design and official protocol references

- [Official authorization URL + PKCE](https://workos.com/docs/reference/authkit/authentication/get-authorization-url):
  fixed `/user_management/authorize`, `provider=authkit`, random 256-bit state and verifier,
  SHA-256 S256 challenge; no caller-selected endpoints or redirect destinations.
- [Official code exchange](https://workos.com/docs/reference/authkit/authentication/code):
  HTTPS JSON `/user_management/authenticate`, authorization-code grant, server client secret
  and exact stored verifier. Response user ID must match the existing RS256 verifier's
  provider subject. Refresh/third-party tokens are discarded, never exposed or persisted.
- [Official sessions/revocation](https://workos.com/docs/reference/user-management/session):
  existing signature + live active-session verification runs on every cookie verification;
  real POST `/user_management/sessions/revoke` is required before logout claims success.
- `core.identity_web_attempts`: one current row per random browser binding, state hash,
  AES-GCM-sealed verifier, bounded expiry and consumed timestamp. Callback consumption
  commits BEFORE exchange, so lost replies cannot replay a code. Restart sign-in on an
  uncertain exchange. Expired rows must be purged by reviewed maintenance; public entry
  rate limiting and fleet-wide attempt/storage capacity require parent/platform controls.
- `core.identity_web_sessions`: hashed random handle, actor/session FKs, AES-GCM-sealed
  provider access token, capped expiry, local revocation, pending-provider flag and logout
  idempotency key. Browser gets only an AES-GCM-authenticated opaque handle in
  `__Host-k_session; Path=/; HttpOnly; Secure; SameSite=Lax`; no Domain attribute.
- Cookie, verifier and provider-token envelopes bind version, API origin and purpose as
  authenticated data. CSRF HMAC binds API origin, handle and canonical actor/session.
  Duplicate auth cookies, ciphertext tampering and Cookie+Authorization ambiguity deny.
- Configured web login creates a new canonical provider session only for an existing
  approved active actor. It creates no actor, permission, consent or MFA evidence.
  Existing staff organization mappings must be approved; missing mapping denies. Staff
  MFA remains fail-closed unless independently verified session evidence already exists.
- Appended migration policies support known-actor session insertion and revoke-only
  updates without granting actor/MFA/grant mutation. All ten tables have explicit
  controlled-owner policies bound with `TO CURRENT_USER` at migration time, so FORCE RLS
  works for non-superuser provisioning. Runtime roleProof still forbids owner inheritance.

Provider revoke failure returns **503 `LOGOUT_PENDING`**, with a cleared cookie and both
local/canonical sessions already revoked. Pending state remains durable and the same scoped
logout retry can reconcile it. Automated pending-revocation dispatch/maintenance is not
registered by this lane and remains a parent operational integration task. A lost provider
reply never becomes `{revoked:true}` without subsequent confirmation.

No refresh flow is claimed: access-token expiry ends this conservative web session and
requires a fresh sign-in. No unsupported MFA claim is guessed. New-user signup eligibility,
MFA enrollment/step-up, public abuse controls, maintenance dispatch and independently
approved policy/provider/device acceptance must not be represented as completed by this
known-account auth slice. Key rotation invalidates old envelopes fail-closed; review pending
revocations and recovery before removing keys.

## Focused evidence and handoff files

`tests/unit/web-auth.test.ts` covers the RFC7636 challenge vector, fixed authorization
endpoint, AEAD nonce/tamper/origin/purpose and exact CSRF binding. The cryptographic WorkOS
fixture helper remains `tests/unit/workos-fixtures.ts` (real synthetic RSA signatures).
`tests/integration/web-auth.test.ts` contains real PG17 + Hono HTTP fixtures and tests for
DTOs, cookie/token non-exposure, replay/expiry/replacement, CSRF/origin/cookie ambiguity,
actual provider-revoke fixture calls, pending/idempotent retry, uncertain exchange,
unapproved/mismatched actor, rollback, held domain locks and context reuse. It applies
the full migration as a real non-superuser owner and provisions approved synthetic rows
under FORCE RLS. Provider HTTP is deterministic synthetic data, not live WorkOS evidence.

Final focused run: **32 tests passed across five files under the global lock**, including
the 12 new web tests (10 real PostgreSQL/HTTP tests) plus existing WorkOS/identity-runtime
regressions. Root TypeScript and Core typecheck passed. Parent's new consent guard still
requires its own integrated retest. Full combined verification/browser/security/precommit and live
company acceptance remain coordinator-owned and are not claimed here. No commit/push.

Follow-up files: `packages/providers/src/workos/oauth.ts`, `apps/core-api/src/web-auth.ts`,
full `packages/database/migrations/0002_mathew_identity.sql`, these two new test files and
this document. Parent owns journal/exports/dependencies/root composition. Do not re-copy
or overwrite its subsequent changes to the original delivered identity modules.
