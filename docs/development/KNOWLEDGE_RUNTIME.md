# PostgreSQL knowledge runtime — P1-MAT-003

Implementation candidate, not physician/content/G1 approval. All fixture text and
identity in this lane are synthetic. No model, private corpus, classifier,
personalized advice, medical policy or invented handoff wording is supplied.

## Integration owned by parent

Apply `0004_mathew_knowledge.sql` after the identity migration; add it to the
existing migration journal (this lane does not modify the journal). Use the
existing direct migration runner/checksums, never runtime DDL. Database source
uses relative internal contracts/domain imports; parent owns package dependency
declarations/exports. Companion needs the existing pinned `zod` dependency.

Replace, do not duplicate, the existing knowledge registration in the Companion
composition root. Keep channel registration and the server log sink intact:

```ts
import { registerKnowledgeRuntimeRoutes } from "./knowledge/runtime";
import { createKnowledgeWorkerRuntime } from "./knowledge/postgres";
import { loadCurrentAuthorityInTransaction } from "../../../packages/database/src/identity";
import { verifyBearerMutation } from "@kandamkulathi/server/bearer-mutation";

// In the existing createService third-argument registerRoutes hook:
registerKnowledgeRuntimeRoutes(app, (untrustedBindings) => {
  // Use parent's existing validated binding/config resolver, NOT a request field.
  const config = resolveApprovedKnowledgeConfig(untrustedBindings);
  if (!config) return undefined; // truthful 503 NOT_CONFIGURED
  const identity = resolveVerifiedIdentityRuntime(config);
  if (!identity) return undefined;
  return {
    runtime: createKnowledgeWorkerRuntime({
      connectionString: config.databaseUrl,
      environment: config.environment,
      localProxy: config.localProxy,
      namespace: config.namespace,
      loadCurrentAuthorityInTransaction,
    }),
    verifySession: identity.dependencies.verifySession,
    verifyMutation: (request, bindings) =>
      verifyBearerMutation(request, bindings) ? "allowed" : "denied",
  };
});
```

`resolveApprovedKnowledgeConfig` and `resolveVerifiedIdentityRuntime` above are
integration placeholders for the parent's existing config functions, not supplied
exports or permission to create enablement flags. The concrete supplied factories
are `createKnowledgeWorkerRuntime`, `createKnowledgePostgresRuntime` and
`registerKnowledgeRuntimeRoutes`. Worker factory uses event-scoped `withDatabase`
with `k_core_runtime`; the shared transaction helper owns each BEGIN/COMMIT. Do not
wrap these operations in another transaction or cache verified authority across
requests. The transaction loader must be the actual identity implementation.
The route dependency resolver runs per request with actual Worker bindings.

The integrating default Companion now resolves real PostgreSQL and the shared
configured identity factory per request. Its real web mode accepts only verified
cookie session + CSRF, rejects ambiguous cookie/Authorization, and rechecks the web
session inside the existing knowledge transaction. Current privacy is mandatory.
Mutation admission preserves `allowed`, `denied` and `unavailable`; identity/admission
outages return 503 rather than claiming a 403 authorization decision.
The supplied standalone bearer route mode below remains strict when no real web
composition is supplied; neither mode infers authoring rights from a workspace.

## Explicit provisioning, no role inference

Only the restricted administrator can provision `core.knowledge_grants` and
`core.knowledge_sources`; Core has no INSERT/UPDATE grant rights. Each grant binds
actor, verified organization, permission (`edit`, `approve`, `withdraw`, `manage-product`), scope, exact
product (nullable only for institution), language and kind, public display name,
authority version, evidence UUID, physician qualification and validity/revocation.
Only explicitly qualified `approve` grants authorize named medical approval.
No broad staff/admin/physician role string implies these permissions. Grant
updates must increment authority version or replace evidence, never reuse prior
approval identity after revocation. Do not set a grant's display name from a form.

Mutation authority reloads/locks the shared current identity inside the domain
transaction, requires active unrevoked verified organization/MFA session, then
locks active actor + exact grant. Public reads lock active approver actor, current
grant/evidence/qualification and registered public source rows, without requiring
customer intake/login. Source registration binds source ID/revision/bytes SHA256,
exact public URL and public-rights evidence. No endpoint fetches source URLs.
Only classified, pre-reviewed public material may enter ingestion; arbitrary
private notes/conversations are not an ingestion source. Byte validation does not
by itself prove ownership, medical truth or content rights.

Public URL checks reject all IP literals (including normalized numeric IPv4),
single-label names, localhost/local/internal/home/lan/arpa/onion suffixes, alternate
ports, credentials/query/fragment and HTTP. This is lexical publication validation,
not DNS validation: reserved synthetic `.invalid` citations remain usable in tests.
Any future fetcher must separately validate every resolved address and redirect,
reject private/link-local/loopback destinations and defend against DNS rebinding.

## HTTP mutation and display contracts

- `POST /v1/knowledge/drafts`: strict `{content: KnowledgeContent, sources:
  [{sourceId, bytesBase64}]}`; canonical complete content, no legacy editor DTO
  conversion. New revision1/previousContentHash:null; updates increment exactly
  one revision with current previous hash and matching verified editor ID.
- `POST /v1/knowledge/:entryId/approve` and `/withdraw`: strict
  `{revision, contentHash}` bound to current entry; never client-supplied approval,
  actor/grants or timestamps. Approver must differ from editor. A withdrawn
  revision cannot be reapproved; draft a new chained revision.
- Successful writes return `{status:'persisted', record: KnowledgeRecord}` (201
  draft, 200 approve/withdraw). Permission denial403, stale CAS/transition409,
  invalid400, unauthenticated401, unavailable503. No internal SQL/provider text.
- Parent supplies shared `verifyBearerMutation` with shared approved origin
  policy. Cookies always rejected, Authorization Bearer mandatory, no fake CSRF
  token. Native originless bearer is supported by the shared helper. These are
  not cookie-session mutation routes.
- Existing `POST /v1/knowledge/public-product` envelope remains canonical
  `PublicKnowledgeResult`, no wrapper. Ready contains exact separate monograph,
  dosage, contraindication and safety blocks with per-block approval/reference/
  citations/language. Render exact approved text without paraphrase, merging
  safety categories, inventing expiration/permission fields or translating it.
  Blocked/not-ready responses never contain partial approved blocks.
- `/v1/knowledge/personalized` stays explicitly unavailable/blocked. No classifier,
  sales action, confirmation, handoff queue or approved escalation policy is
  implied by public knowledge retrieval.

## Persistence and fences

All mutations take the same transaction advisory writer lock; reads take its
shared counterpart. Product/entry reads additionally use `FOR SHARE`; authority,
source and actor rows stay locked through commit. Final equality checks cover
the complete manifest/record and current authority; inventory membership is
protected by the shared advisory boundary, not merely snapshot comparison.
All catalogue/publication writers, including administrative synchronization,
must use this same advisory writer boundary. Administrator writes outside it
invalidate inventory guarantees. Source and identity revocation use row locks.

Current entry + append-only history + reference-only indexing obligation commit
together. A history failure rolls back the entry and obligation. Core cannot
rewrite/delete audit or acknowledge an index obligation. Transaction-local RLS
write context resets on commit/rollback. This context is set only after actual
authority checking; it is not a caller-controlled identity mechanism or defense
against a compromised server with arbitrary SQL access.

`createPostgresKnowledge.saveProduct` is a CAS catalogue-sync primitive with a
mandatory separate `manage-product` fence. The HTTP runtime deliberately exposes
no publication mutation and grants no management by inference. Parent must feed
the complete real canonical catalogue through an approved synchronization path;
empty knowledge inventory is not evidence of complete catalogue coverage.

## Derived indexing obligations and remaining delivery

`core.knowledge_index_obligations` is an atomic domain ledger, not a second queue
implementation and not proof that Vectorize is updated. Parent must bridge pending
rows to the existing platform outbox in the SAME transaction as a durable bridge
receipt, extend the shared reviewed job-kind contract and register its consumer.
Use the obligation UUID as stable operation identity; never substitute an existing
notification/probe kind. Core cannot mark completion; jobs privileges/bridge
receipts require a separately reviewed additive migration.

Consumers must project via `projectPublicKnowledge` and current primary fences
immediately before public upsert; stale/withdrawn/unpublished projections require
deletion, including IDs from older revisions. Retry/crash redelivery must be
idempotent. Provider calls run AFTER DB commit and must reconcile uncertain effects.
A captured action/reference is not authorization. Keep explicit pending/failure
state and measure actual edit/withdrawal freshness against the company-approved
deadline. This lane does not claim completed dispatch, provider integration or
freshness SLA. Current-primary authorization immediately denies obsolete hits.

## Verification / handoff

Focused Vitest tests exercise URL/response validation and real PostgreSQL17 via
the existing Neon WebSocket harness: draft/approval separation, explicit scopes,
atomic audit/index writes, rollback, denied audit rewrite, qualification/source
revocation, independent missing safety and concurrent withdrawal. HTTP runs use
real shared Hono guards with a clearly synthetic verified-identity loader, not
real WorkOS/provider evidence. Parent must run the actual shared identity+WorkOS
pack on the combined candidate. The new workerd E2E requires parent registration;
it checks default unavailable mutations, not an approved content demonstration.

Use the provisioned private synthetic PG environment without printing secrets:

```sh
source /tmp/opencode/kandamkulathi-p1-tools-env.sh
flock /tmp/opencode/kandamkulathi-p1-e2e.lock pnpm exec vitest run tests/unit/knowledge-runtime-validation.test.ts tests/integration/knowledge-runtime-postgres.test.ts
```

Parent runs combined verify, platform, browser/E2E, security and commit gates
under the same global lock. No full-agent duplicate baseline, bypass, push, PR,
merge or deployment is authorized. Independent security/clinical review, actual
approved EN/ML/TA content, source rights, complete catalogue sync, Vectorize/outbox
bridge and measured freshness remain release blockers.
