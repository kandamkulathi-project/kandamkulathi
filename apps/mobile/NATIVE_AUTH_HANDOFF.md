# Native authentication audit and integration handoff

Owner: Devadathan; backend contract owner and independent sensitive reviewer: Mathew.
**Native sign-in, real-device/provider verification and phase acceptance remain Pending.**
No new dependency, root composition, live provider request or credential issuance is enabled here.
Composable source adapters exist, but no backend HTTP binding or working sign-in is claimed.

## Inspected source and current blocker

Read-only inspection on 24 October 2026 of the identity-runtime lane at
`/tmp/opencode/kandamkulathi-p1-mathew-identity-runtime`, branch
`feature/p1-mathew-identity-runtime`, based on
`3825c0003cb7f56911ff530dc770e73453167a13`, including its uncommitted runtime additions.
This is a working-copy audit, not a reviewed or deployed backend contract.
Backend contract-owner confirmation remains required before binding or enabling sign-in.

- `packages/server/src/identity.ts` registers only `GET /v1/session` and explicitly
  defers login/callback/mutations. It returns a minimal `ClientSession` only after
  provider verification and current database authority checks.
- `packages/providers/src/workos/index.ts` verifies an already-issued WorkOS bearer:
  signature, issuer/application/audience/time, current active provider session and
  revocation. It does not start authentication, exchange codes or issue/refresh tokens.
  Its API key remains backend-only; it cannot be moved into the phone application.
- `apps/core-api/src/identity-runtime.ts` composes verification/database authority and
  bearer-only consent capture; it adds no native authentication transaction.
- `docs/development/IDENTITY_RUNTIME.md`, "Exact HTTP contracts", explicitly says
  `/v1/auth/start`, `/v1/auth/authorize`, `/v1/security/context` and
  `/v1/session/logout` are not implemented. No native exchange route/DTO is defined.

Therefore there is **no exact start/exchange HTTP contract to bind safely**.
The existing client proposal `{redirectPath: "/v1/auth/authorize"}` is not a native
PKCE transaction or a bearer-token response and must not be treated as either.

## Existing native SDK boundaries

- `src/native.ts`: `browserAttempt` uses Expo Crypto random state and Expo WebBrowser;
  `returnGuard` checks exact callback URI, expiry, parameters and single use. A return
  is explicitly `server-verification-required`, never an authenticated session.
  This is a browser launcher, not PKCE generation, backend exchange or lifecycle fencing.
- `nativeVault` uses Expo SecureStore with unlocked/device-only accessibility and
  environment-specific keys. Shared serialized writes/clear reject stale queued writes;
  storage errors propagate without plaintext fallback. It neither obtains nor verifies tokens.
- `src/SensitiveFlows.tsx` only reads that vault, attaches the credential to the approved
  API origin, and revalidates the session. It has no auth start/exchange/write journey.
  Its generation, abort, expiry and logout fences must remain above any later sign-in adapter.

## Decisions required from Mathew before implementation

These are required decisions, **not proposed endpoint names or accepted DTOs**:

1. Exact methods/routes, strict request/response schemas and size limits for native
   start and single-use exchange; transaction expiry and provider-failure/error mapping.
2. State and S256 PKCE ownership: who generates/binds the verifier/challenge, exact
   redirect URI and transaction, replay consumption, cancellation and restart behavior.
3. Explicit company/environment redirect and authorization-origin allowlists; exact
   callback shape, including provider denial. Do not assume the browser's cookie session
   is accessible to React Native or accept a URL token as a verified bearer.
4. Which access/refresh credential is returned, audience/scope/expiry, rotation and
   revocation/logout behavior. Agree bounds: native vault/transport currently cap a
   credential at 2,048 bytes/characters respectively, while the inspected verifier permits
   an Authorization header up to 16,384 characters. Never truncate a credential to fit.
5. Whether a post-exchange `GET /v1/session` verifies the transient credential before
   persistence; define cleanup if exchange, verification or SecureStore persistence fails.

## Leader composition requirements once the contract exists

`src/nativeSignIn.ts` now composes only the existing Expo Crypto/WebBrowser/SecureStore
SDKs with `src/signIn.ts`, a transport-independent controller. Its `NativeSignInBackend`
interface describes local function ports, not agreed HTTP DTOs/routes. Mathew must supply
the reviewed mapping; none is invented or activated here. The adapter generates a random
64-character verifier and S256 base64url challenge, validates exact state/redirect/challenge/
method query parameters before launch, and retains the SDK browser lock until the actual
browser settles even after disposal. It exchanges only a guarded auth code, validates and
verifies the transient credential before storage, and removes a late/failed/expired write.
Failed OS removal remains blocked and can be retried by explicit `dispose()`.

Leader-only composition outline (not root wiring or a working HTTP implementation):

```ts
const signIn = nativeSignIn({
  environment,
  redirectUri: approvedNativeRedirect,
  authorizationOrigin: approvedAuthorizationOrigin,
  backend: reviewedNativeBackendPorts,
  active: isCurrentLifecycle,
});
// Only an explicit user action calls start(); never automatically retry exchange.
const result = await signIn.start();
// On logout/background/unmount: invalidate the root epoch synchronously, then await
// signIn.dispose() before a replacement adapter can persist credentials. Surface cleanup errors.
```

`backend.session` must verify the supplied transient bearer against only the approved Core
origin, rather than reading an old vault token. Every HTTP port must respect the supplied
AbortSignal and bounded network timeouts. Use the same environment-scoped vault/root logout
ownership. A disposed adapter is terminal; do not reuse it on a warm resume.

System-browser authentication can itself change native AppState. The root owner must agree
and device-test expected browser-handoff versus ordinary background behavior before wiring:
clear private app views on either transition, never relax logout/unmount fencing, and do not
assume this unwired controller proves an Android/iPhone return survives the root lifecycle.

Keep sign-in behind an explicit user action. Never bundle a WorkOS secret.
Check the owning lifecycle before and after every awaited operation, including credential
storage; background, logout, unmount or account change must fence late callbacks/writes.
Do not automatically exchange again or relaunch after an uncertain result.

Preserve `401 -> anonymous`, `403 -> denied`, `503 -> unavailable` and no-store behavior.
A cancelled browser, code callback or successful storage write cannot become "signed in".
Cover success, invalid/replayed/expired callbacks, denied/unavailable exchange, disconnect,
storage failure, concurrent taps and logout/background during every asynchronous stage.
Focused unit sources are `tests/unit/native-sign-in.test.ts` and
`tests/unit/native-sign-in-sdk.test.ts`; the native-controller journey is
`tests/e2e/native-sign-in.spec.ts`. SDK/browser/backend ports in these tests are synthetic,
not installed-native or provider evidence. No additional full gate is scheduled by this lane;
the coordinator must run the combined candidate's required gates before committing.
Real Android/iPhone warm/cold returns, signing, company allowlists, provider accounts,
credential persistence/revocation and store approval require separate executed evidence.

The parent owns root wiring and the PR6 DTO namespace move to
`@kandamkulathi/contracts/client-knowledge`; preserve that import during native integration.
Canonical PR9 knowledge contracts are untouched by this audit.
