# Pre-privacy consent bootstrap candidate

This additive candidate resolves the first-consent deadlock without granting a
workspace or weakening ordinary privacy authorization. It is not company policy
approval, independent security acceptance or a release gate.

## HTTP contract

`GET /v1/consent-bootstrap` verifies the real provider/native/browser identity through
the supplied root verifier. Its strict shared `consentBootstrapSchema` response is:

```ts
{
  actorId: UUID,
  sessionId: UUID,
  expiresAt: ISODateTime,
  requirement: { purpose: "privacy", version: string, actorId: UUID },
  policy: { text: string, revision: string, sha256: string, approvalReference: string }
}
```

Expiry is the earlier of the verified provider/transport expiry and current database
session expiry. There are no workspaces, organization/provider identifiers, membership
grants, patient data or consent history. All responses are `Cache-Control: no-store`.
401 denotes inactive/unverified identity; 403 denotes canonical account/workspace/
organization/MFA denial or already-current privacy; 503 denotes missing configuration,
inconsistent authority, unavailable storage or missing/invalid approved policy text.
Internal errors are neither reflected nor logged.

This read never inserts consent. Existing `POST /v1/consents` accepts exactly
`{requirement, decision: "granted" | "declined"}`; `recordSelfConsent` and its parent
mutation/current-session guards remain the only consent write path. No automatic
grant occurs on bootstrap, redirect, exchange or text rendering. A decline never
becomes a workspace session.

## Root composition (parent-owned)

```ts
import { createConsentBootstrapRuntime, registerConsentBootstrapRoutes } from "./consent-bootstrap";
import { evaluateConsentBootstrapEligibility } from "../../../packages/server/src/authorization";

const bootstrap = createConsentBootstrapRuntime({
  verifySession: rootIdentityDependencies.verifySession,
  withClient: runtime.withClient,
  now: runtime.now,
  loadCurrentAuthorityInTransaction: parentLockedCurrentAuthorityLoader,
  evaluateEligibility: evaluateConsentBootstrapEligibility,
});
registerConsentBootstrapRoutes(app, bootstrap);
```

`parentLockedCurrentAuthorityLoader(client, identity, request): Promise<unknown>` is
mandatory: call the actual identity loader AND current browser/native-session fence,
using this exact client inside the already-open platform transaction. Do not nest
transactions or return detached snapshots. Provider calls occur before the transaction;
the loader/fences do bounded database work only. Guard rejection must fail closed.
The canonical eligibility helper reuses the actual current identity/account and
membership logic (active windows, workspace entry action, exact organization, independent
staff MFA); it excludes only privacy. Bootstrap separately requires missing current
privacy using `hasCurrentConsent`. No synthetic consent or ClientSession is passed
to ordinary authorization. Parent's shared helper is a separate prerequisite delta.

Native parent dispatches only `Bearer n1_...` to its opaque-handle verifier; mixed
Cookie/Authorization must deny. Native `dependencies.verifySession` verifies a real
live provider session without projecting a ClientSession. Use
`native.verifyMutationRequest(request, {actorId, sessionId})` for the existing POST
transport check, and `native.withNativeSessionInTransaction(client, request, identity,
callback)` for the existing same-transaction consent guard. With the existing
`registerIdentityRuntimeRoutes` third-argument hook, the native guard shape is:

```ts
guard: (client, request, identity) =>
  native.withNativeSessionInTransaction(client, request, identity, async () => undefined)
```

This checks/locks the native session inside `recordSelfConsent`'s existing transaction;
its locks last through the consent commit. Do not call `recordSelfConsent` inside this
guard or start a nested transaction. Parent dispatches web/native guards by the real
transport. No second write implementation is added here.

Web root sign-in return: GET session 403 is not proof of missing privacy. Request
bootstrap; render consent only for its 200. Preserve disabled/staff/MFA denials and
unavailable/retry states. Render `policy.text` as plain text, not trusted HTML.
After explicit consent POST success, request GET session again; only its real
ClientSession establishes workspace state. Native retains exchange credentials only
ephemerally until this succeeds, before vault persistence. Cancellation/decline must
not persist a fake session. Configured browser/native screens and registration belong
to their owners, not this patch.

## Approved policy provisioning and rollback

Controlled operator applies `0009_mathew_consent_bootstrap.sql` after coordinated
prerequisites (native owns 0008). Parent owns migration journal registration. It seeds
no policy, legal copy, actor, consent or grant. An approved operator must provision
the exact UTF-8 text, revision, SHA-256, approval timestamp and approval reference in
`core.identity_privacy_policy_text`. The version AND approval reference must exactly
match the current `core.identity_policy` row. Missing, future-approved or revoked
text returns 503; never fall back to bundled or old legal copy. Use parameterized
provisioning SQL and an independently approved policy change process. Coordinate any
text revision with the canonical policy version/approval reference so clients never
acknowledge an obsolete policy. Keep reviewed historical approvals/audit evidence;
do not silently replace approved wording under an unchanged approval.

The database verifies the UTF-8 SHA-256 on every write; the reader independently
checks WebCrypto SHA-256 before returning text. FORCE RLS gives the controlled owner
explicit provisioning policies and backup role explicit SELECT; runtime can only
read data. Its inert-column UPDATE privilege exists solely for PostgreSQL row locks;
UPDATE itself is rejected by RLS, including that column. The current canonical policy
row and selected text row remain locked through transaction commit, preventing
concurrent replacement/revocation from racing the response snapshot. Subsequent POST
still rechecks canonical consent version; bootstrap is not a freshness token.

Rollback deactivates root route registration first. Retain policy/consent audit data;
never drop it as an application rollback. Follow reviewed migration/recovery procedures
before removing additive tables after every consumer has been retired.

## Focused verification and remaining integration gates

- Unit tests: strict minimal DTO, exact Unicode/whitespace text, trusted port execution
  in the same transaction, canonical denial propagation, missing provider, already
  current privacy, hash/version/revocation/approval failure and rollback.
- Real PostgreSQL/HTTP tests: signed synthetic WorkOS verification, missing privacy
  versus account/org/MFA/session denial, identity and policy fences, runtime RLS,
  policy provisioning/hash/version/revocation, and existing consent POST followed by
  ordinary GET session success. A configured cookie flow also uses the actual web
  fence, CSRF transport guard and consent writer, with concurrent revocation probes.
  Synthetic provider fixtures are not real account proof.
- E2E source tests the actual default-unavailable Worker, without intercepted responses.
  Parent must register the endpoint before this test can pass. Configured sign-in/
  consent browser flow is a client/root-owner integration gate, not proven here.

Source the private pinned tool environment without printing it. Use frozen installation
with the consent-bootstrap-specific virtual store. Serialize PostgreSQL/browser/build/
platform campaigns with `/tmp/opencode/kandamkulathi-p1-e2e.lock`. Only focused checks
are authorized in this slice; parent owns combined gates and independent security review.

Focused results (2026-10-24): 12 unit tests and 7 real PostgreSQL/HTTP tests passed;
owned-file Biome and focused strict TypeScript checks passed. The pinned strict SAST
scan passed on all three new production TypeScript files, with zero findings and
zero parsing errors. The initial configured-web fixture used invalid local browser
origin configuration; corrected to the existing explicit preview fixture contract,
then all seven PostgreSQL/HTTP tests passed. The actual Worker E2E source is unrun
pending parent registration. No combined verify/build/browser campaign, commit,
push, merge or deployment was performed.
