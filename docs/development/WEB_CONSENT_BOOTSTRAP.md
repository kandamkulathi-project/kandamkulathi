# Browser privacy bootstrap handoff

This scoped pre-privacy UI extends the incumbent Operate interface. It is not an
authentication bypass, a workspace grant, company policy approval or G1 acceptance.
Root composition, backend authorization and native clients remain separately owned.

## Root integration

Import `ConsentBootstrap` from `apps/workspaces/src/ConsentBootstrap.tsx`. Mount it
**only** when the real current-session resource has `status === "denied"`:

```tsx
<ConsentBootstrap
  locale={locale}
  origin={coreOrigin}
  local={local}
  onVerified={reloadCurrent}
/>
```

Rendering the component sends no request. The explicit review/reload button reads
the real session, then requests `/v1/consent-bootstrap` only if that read returns
403. A generic 403 is never interpreted as a privacy requirement. Only a strict
200 bootstrap response with an unexpired session and matching raw UTF-8 policy
SHA-256 enables policy display. The policy text is rendered unchanged as React
plain text, with whitespace preserved; locale selection never translates it.

The exact backend-owned `packages/contracts/src/consent-bootstrap.ts` is a required
prerequisite, excluded from this patch. The decoder and UUID, session and security
context contracts are reused rather than replaced. Current backend code does not
export a browser hash helper; this client matches its raw UTF-8 SHA-256 algorithm.

Only an explicitly checked checkbox and submit action initiate a grant. Declining
or cancelling the review records nothing. Immediately before POST, the client reads
real `/v1/security/context`, checks actor, exact bootstrap session ID and both
expiry bounds, and sends the actual CSRF token. All requests use the approved
`apiOrigin` helper, cookies, no-store, redirect rejection, bounded streamed raw
JSON and a five-second operation deadline. No `ClientSession` is fabricated.

The inspected canonical `recordSelfConsent` mutation schema currently lives in
`packages/database/src/identity.ts`: `{ requirement, decision }`, returning 201
`{ id }`. It has **no operationId or idempotent replay guarantee**. The browser
constructs only that existing shape using the canonical decoded requirement; it
does not import database runtime code into the browser or invent an operation ID,
idempotency header, approval or second mutation validator. Any future shared
mutation contract must be coordinated with its backend owner.

An uncertain POST never automatically repeats. The UI hides the grant form and
requires explicit session/policy reload. A strict 201 persisted ID is insufficient
for completion: the client must successfully decode a fresh real `/v1/session`
response, verify the same actor and current expiry, and only then call
`onVerified`. An outage after persistence says access remains unverified.

Each effect setup owns fresh resources (including React DEV StrictMode replay).
Single-flight slots, abort signals, generation checks, expiry timers and cleanup
fence late completions. Root must unmount this surface on session/transport epoch
change and must continue enforcing normal verified-session workspace composition.

## Verification and limits

- `tests/unit/web-consent-bootstrap.test.ts`: 29 focused tests passed.
- Strict scoped TypeScript check and owned-file Biome passed.
- Pinned strict SAST: three production TypeScript/TSX files, zero findings/errors.
- Impeccable detector: no findings. Desktop 1100px and mobile 390px EN/ML/TA
  screenshots inspected; policy remains exact plain text and controls reflow.
- Dedicated DEV React/StrictMode Playwright fixture: nine tests passed. One initial
  test-selector ambiguity was fixed without weakening its assertion. The fixture
  was subsequently moved unchanged out of the default E2E discovery directory to
  avoid requiring an unregistered test server in the coordinator's default suite.
  Its dedicated configuration is deliberately separate:

```sh
pnpm exec vitest run tests/unit/web-consent-bootstrap.test.ts
flock -n /tmp/opencode/kandamkulathi-p1-e2e.lock pnpm exec playwright test \
  --config tests/consent-bootstrap-browser/web-consent-bootstrap.config.ts
```

The fixture route exists only in the test-owned Vite configuration; it is not a
production hook. Synthetic intercepted HTTP responses exercise the real component
and browser fetch flow, not real provider authentication or PostgreSQL persistence.
The backend owner's independent HTTP/PostgreSQL tests remain separate evidence.
The coordinator must include the dedicated suite in its verification workflow if
desired; this patch does not change root manifests or the root Playwright config.

Full `pnpm verify`, default `pnpm test:e2e`, deployment/provider/device checks,
independent security review and company EN/ML/TA wording acceptance were not run
or claimed by this lane. No commit, push, merge or production approval is included.
