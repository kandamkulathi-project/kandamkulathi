# Identity foundation — KAN-84 / P1-MAT-001 bounded candidate

**Status:** provider-neutral contracts and deny-by-default server boundary only. P1-MAT-001, R03/R11/R12/R14/R15/R18/R19/R36 and phase acceptance remain **Pending**. No real account, patient, authentication, consent capture or persistent business operation is enabled. Independent Devadathan security review and company privacy/clinical approval remain required.

## Contracts and entry points

- `packages/contracts/src/identity.ts`: normalized verified identity; current session/account authority; explicit expiring/revocable workspace/action memberships; self-patient links and scoped clinical assignments; validated access requests.
- `packages/contracts/src/consent.ts`: separate privacy, optional marketing and patient/clinic/consultation-scoped consultation decisions and required versions. These are validation contracts, not tables, retention rules or permission to collect data.
- `packages/contracts/src/identifiers.ts`: shared `canonicalUuidSchema` validates and lowercases every UUID in the identity/consent contracts, including verified/current principal and session IDs, organizations, relationships, record/recorder IDs and requested/consented scope. Runtime parsing occurs before identity, grant, consent-scope or latest-decision comparison; equivalent UUID spellings cannot hide a later decline/revocation or become a different principal. Different UUID values remain different identities/scopes. Session projections use the canonical actor ID.
- `packages/server/src/authorization.ts`: `validateCurrentIdentity`, `authorizeAccess`, `projectSession`. All external/dependency data is runtime-validated. Unknown fields/actions, invalid clocks, incomplete scope and unsupported policy fail closed.
- `packages/server/src/authorization-consent.ts`: `hasCurrentConsent`; current version, subject, decision, revocation and explicit expiry checks. Latest scoped decision wins across versions; simultaneous ambiguous decisions deny. Earlier grants cannot override later declines/revocations. A future latest decision also denies rather than reviving an older grant.
- `packages/server/src/identity.ts`: dependency-injected, read-only `GET /v1/session` registration.
- `apps/core-api/src/identity.ts`: `createCoreApi` composition. The default Worker injects only unavailable dependencies. No environment flag, bearer, cookie, header, local mode or fixture enables identity.

No database driver, migration, RLS implementation, alternate authentication stack or in-memory business store is introduced. P1-DEV-001 / platform PR3 owns that infrastructure. The shared `createService(service, undefined, { registerRoutes })` third argument registers routes before its unchanged unavailable fallback. The second argument is reserved for the platform's future log sink; reconcile that signature when integrating PR3 without duplicating its implementation.

## Conservative access rules, not an approved company role matrix

There is no approved executable action matrix in the current scaffold. This candidate therefore implements no role-to-permission mappings and no administrator wildcard or clinical bypass. A trusted current authority must issue each explicit `workspace:enter`, `clinical:read` or `consultation:join` grant. These names do not authorize clinical mutation, recommendations, prescribing, signing, guardian access or AI actions.

| Boundary | Required checks |
|---|---|
| All identity projections/private access | Verified internal actor/session match current authority; current account active; both credential and authoritative session unexpired; current session not revoked; actor's current required privacy consent. |
| Workspace entry | Explicit current membership with `workspace:enter`; half-open validity window (`validFrom <= now < expiresAt`); no revocation; membership organization matches the verified session organization. |
| Any non-customer workspace | Non-null current organization and clinic plus server-verified MFA with a non-future verification time and unexpired validity. No invented MFA freshness interval. |
| Customer private scope | Explicit action grant and exact clinic; current self-patient link; exact patient/clinic/consultation consent from that actor. Never infer patient identity from an email/phone/claim. |
| Non-customer private scope | Explicit action grant and exact clinic; current assignment bound to the same membership, patient, clinic, consultation and action; required consent from the assignment's authoritative patient actor. Staff self-links cannot replace assignment. |
| Consent | Exact configured version and subject/scope; explicit grant; no revocation; not future/expired. Privacy does not imply marketing or consultation consent. Marketing decline/missing opt-in never blocks required privacy consent. |

The conservative self-only consent model rejects delegated recording. It does not invent guardian eligibility or substitute for physician-approved intake, consent text, clinical policy, legal basis or emergency routing. Revocation is treated as immediate whenever present. Public catalogue browsing is unchanged and does not require clinical intake or these private-access checks.

## Trust and integration obligations

`IdentityDependencies.verifySession(Request)` must implement real pinned WorkOS/AuthKit server verification and normalize to **internal** identifiers; this schema is explicitly not a guess at WorkOS claims. Before implementing an adapter, verify official pinned SDK issuer/audience/signature/expiry/session, organization and MFA semantics, web/native credential transport and revocation behavior. Decode-only JWTs and trusting client role/actor/clinic/MFA headers are forbidden. No WorkOS SDK was added: real verification is **Blocked**, not represented by synthetic fixtures.

`loadCurrentAuthority(VerifiedIdentity)` must load the current authoritative session, account, memberships, patient links/assignments, configured approved consent versions and scoped decisions for every request. A token's old grants or an app cache are not current authority. It must return a coherent current snapshot, not historical competing membership/assignment rows. It must not infer a consent version from whichever old decision happens to exist. A missing adapter, malformed snapshot, actor/session mismatch or provider/storage exception produces `503 IDENTITY_UNAVAILABLE`; no fake anonymous/success fallback conceals an outage.

Pure authorization results are decisions for the supplied snapshot and instant, not durable capabilities. Mutations must reload/revalidate inside the same short authoritative transaction as their effect, with the platform's non-owner PostgreSQL/RLS context and concurrency/version guards. This helper does not prove RLS or eliminate a check-to-use race. No private clinical or video endpoint is exposed by this change.

## HTTP and privacy

- `200`: strictly minimal existing `ClientSession` (`userId`, minimum verified/current session `expiresAt`, distinct eligible `workspaces`). It excludes provider subject, session ID, organization/clinic/patient/assignment IDs, role labels, MFA details and consent history. Workspace grants are advisory UI projections, never server authorization. Membership/MFA/consent revocation must be checked on every subsequent private request even before projected session expiry.
- `401 UNAUTHENTICATED`: verifier positively reports absent/invalid authentication, or supplied verified/current session has expired/revoked. No storage call follows a negative verifier result.
- `403 FORBIDDEN`: active identity lacks required current privacy consent, eligible membership/MFA/scope/assignment or account eligibility.
- `503 IDENTITY_UNAVAILABLE`: real verification/storage not integrated, unavailable, malformed or inconsistent. The deployed/default composition always returns this for session GET until real dependencies are supplied.
- Responses retain server-generated request IDs, `Cache-Control: no-store`, security headers and existing local-only credentialed GET/HEAD/OPTIONS CORS. Credentials, provider exceptions and health content are not reflected or logged by the identity route. No cookies are issued, refreshed or cleared here.
- No login/callback/logout, consent-write or other session mutation success is implemented. Real web cookies/CSRF, native transport, recovery, configured production CORS and origin policy remain blocked integration work; CORS is not authorization.

## Evidence and remaining gates

`tests/unit/identity*.test.ts` exercise runtime validation, positive explicit grants and self-access; expiry/revocation; current org/MFA; clinic/patient/consultation/assignment crossing; privacy vs marketing; consent version and stale-decision controls. `tests/integration/identity.test.ts` runs actual Hono HTTP requests with labeled synthetic injected authority, safe 401/403/503/no-store, no cookie issuance, concurrent request isolation, retry and next-request revocation. These positive tests are **not** WorkOS, persisted-consent, PostgreSQL or RLS evidence.

Follow-up independent review identified UUID spelling as an additional security regression: a newer uppercase-UUID decline/revocation could previously be excluded from the same scope, reviving an earlier lowercase grant. Regression cases reproduced that defect before the shared-schema fix and cover actor and independent patient/clinic/consultation spellings, later declines/revocations in either record order, canonical same-principal sessions and projections, and genuinely different identities/scopes. Initial checks or static-review results are not final security or phase acceptance; independent review and full impacted retest remain required.

`tests/e2e/identity.spec.ts` defines real local workerd negative tests against the default Core Worker with fabricated credentials/scope/MFA and an unavailable session mutation. The existing Chromium workspace test continues to exercise real credentialed session `503` and truthful unavailable UI, now with the identity-specific error code. No browser route interception is used for these real-boundary tests. Full build/Playwright/resource gates are run serially by the integrating session, not in parallel by this bounded agent.

Remaining acceptance: approved company role/action matrix and consent versions/text; independently reviewed real WorkOS adapter and account eligibility; current PostgreSQL persistence and transaction/RLS/pool reuse proofs; consent capture/revocation audit and privacy approvals; physician-approved intake and guardian/clinical policy where required; transport/at-rest/private-object/backup/processor evidence; supported native/device sessions; real cross-scope provider/storage integration and independent security retest. Missing prerequisites remain **Blocked/Pending**, never a phase pass.

Rollback is a reviewed revert of this additive candidate; there are no schema/data/provider changes. Until the real adapters are integrated, revert restores the starter's generic session `503` rather than enabling identity.
