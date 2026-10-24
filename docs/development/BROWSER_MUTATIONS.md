# Browser origin boundary

The shared HTTP boundary supports approved browser mutations without treating CORS as authentication or CSRF protection. This is implementation behavior, not company deployment or G1 acceptance.

## Configuration

Local development retains only the four exact `localhost`/`127.0.0.1` public/workspace origins on ports 4321 and 5173. Outside local development, `BROWSER_ALLOWED_ORIGINS` is a server-only, comma-separated list of at most eight canonical HTTPS origins. Missing or empty configuration grants no browser origin. Wildcards, credentials, paths, queries, fragments, duplicates, noncanonical strings and loopback origins are rejected without disclosing configuration values. Local origin overrides are refused.

Set this field explicitly on the reviewed service environment when real approved domains exist. Do not publish fictional domains, infer company approval or copy the entire local environment into Worker bindings.

## Request behavior

- Approved exact origins receive credentialed CORS and preflight support for GET/HEAD/OPTIONS/POST with Content-Type, Authorization, X-CSRF-Token and Idempotency-Key headers. Unimplemented browser mutation methods are not advertised.
- A supplied disallowed origin on a mutation or mutation preflight receives 403 before the feature route runs. Hiding a response alone would not prevent a business effect.
- A safe read from a disallowed origin receives no CORS grant. This does not grant access to private records.
- No-Origin requests remain subject to each endpoint's real identity, signature and authorization requirements. Native clients and verified provider callbacks cannot rely on an Origin header.
- Every mutation still requires its domain's verified identity, current scope, applicable CSRF/session policy, validated input, explicit confirmation and durable idempotency. A configured origin is not a trusted actor or payment receipt.
- Invalid configuration fails closed; liveness remains observable. Responses retain no-store and safe error identifiers.

## Verification

`tests/unit/browser-origins.test.ts` exercises invalid configuration, exact origin comparison, no route execution after denial and authentication denial even for approved origins. `tests/e2e/cors-boundary.spec.ts` exercises the real local Worker, both existing read/preflight grants and the mutation denial/preflight paths. Neither proves real company identity, production domains or provider/device integration.
