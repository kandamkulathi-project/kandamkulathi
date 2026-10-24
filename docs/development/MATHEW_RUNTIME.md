# Mathew persisted runtime composition candidate

Packages P1-MAT-001–004 remain implementation candidates pending independent
review, company policy/content and real provider/device acceptance. G1 is Pending.
The runtime never seeds a patient, grants itself approval or simulates a successful
charge, consultation or channel send.

## Runtime configuration boundaries

Core uses event-scoped `withDatabase` connections and the existing platform guard.
`DATABASE_URL` must be a dedicated non-owner core runtime login. The jobs Worker
uses the distinct `DATABASE_WORKER_URL` jobs login for the same database. Hosted
targets retain the validated pooled Neon/verified TLS contract. Never supply owner,
administrative, backup or test credentials to deployed Workers.

Identity reads `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_ISSUER`, optional
`WORKOS_AUDIENCE` and `WORKOS_CONFIGURATION_APPROVED`. Approval must be explicitly
`"true"` and backed by the named owner's real evidence; it is not granted by an
environment name or test fixture. Put secrets in approved Worker secret storage,
not public bundles or tracked files. Real verified provider identities additionally
need controlled database actor/session mappings, current explicit grants and
approved versioned policies. Missing resources fail closed.

The configured Core root exposes native bearer and secure web AuthKit session
verification. Browser start/authorize/callback, state/PKCE, encrypted opaque cookies,
security context/CSRF and provider logout are implemented in the
[web runtime](WEB_AUTH_RUNTIME.md). Cookie plus Authorization is always rejected.
Native transport remains nonambient; it never silently interprets cookies as bearers.

Web bindings are `WEB_AUTH_API_ORIGIN`, `WEB_AUTH_CALLBACK_URL`, `WEB_AUTH_RETURN_URL`,
`WEB_AUTH_ALLOWED_RETURN_URLS` (comma-separated exact destinations), secret
`WEB_AUTH_COOKIE_KEY` (base64url 32 bytes), and optional
`WORKOS_ORGANIZATION_MAPPINGS` (JSON provider organization to approved internal UUID).
Attempt/session engineering TTLs are 300/3600 seconds, with earlier token expiry
enforced. Shared `BROWSER_ALLOWED_ORIGINS` governs allowed origins; it is not CSRF
proof. Secure host-only cookies require HTTPS and the approved API origin; cross-origin
cookie deployment must not assume credentialed CORS that the shared server does not
grant. Use reviewed same-origin routing rather than weakening origin checks.

`POST /v1/consents` retains its single existing transaction. A configured web request
must pass verified session/CSRF and lock its web session inside that transaction,
before consent effects. Booking and knowledge writes retain the same web-session
fence through their own domain commits. Actual current privacy/session/organization/
MFA and explicit per-domain grants are rechecked separately; a valid cookie is not
permission to book, approve medical content or perform commerce.

Other server domains may call `createConfiguredIdentityRuntime(bindings)` from
`apps/core-api/src/runtime.ts`: use `dependencies.verifySession`, validate its unknown
identity with the canonical schema, and `mutation(request,{actorId,sessionId})`.
`withSessionInTransaction(client,request,verifiedIdentity,callback)` requires the
caller's already-active platform transaction and keeps identity/web locks through
the caller's commit. Never call provider/network operations from that callback.
Do not pass a request-body identity or treat this fence as domain authorization.

Approved [booking metadata/offers](BOOKING_OFFERS.md) expose actual named persisted
clinic/service scopes, free configured slots and PostgreSQL `serverNow`; missing
metadata is unavailable, not inferred availability. Holds still recheck atomically.
Companion's default entry registers persisted [knowledge routes](KNOWLEDGE_RUNTIME.md)
with the same configured native/web identity, current primary/source/approval fences
and explicit authoring grants. Derived indexing, authoring read capabilities and web
maintenance remain separately tracked followups until their concrete implementations
and registrations pass combined checks. Native storage/device evidence remains Pending.

Companion's WhatsApp webhook reads the established `WHATSAPP_APP_SECRET`,
`WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID` and
`WHATSAPP_PHONE_NUMBER_ID` bindings. Its PostgreSQL inbox is constructed from
trusted Worker bindings and opened only after authentication/body validation.
See [channel runtime](CHANNEL_RUNTIME.md) for the durable ingress boundary; no
customer send/provider action is enabled by storing an event.

## Integration and evidence discipline

Register all owned additive SQL in the existing migration journal before enabling
an adapter. Preserve installed migration bytes/checksums. Runtime credentials
cannot run migrations or provision grants. Use controlled reviewed opening inputs;
synthetic fixtures are not company-approved fees, dosage or consent policies.

All browser, full verification/build, platform and pre-commit runs share
`flock /tmp/opencode/kandamkulathi-p1-e2e.lock` in the coordinated local campaign.
Never nest the same lock. Pinned Node/pnpm/PostgreSQL versions and mandatory
commands remain in [platform setup](PLATFORM_FOUNDATION.md) and
[command registry](COMMANDS.md). Unit success does not establish database RLS,
provider authenticity, native compatibility or phase acceptance.
