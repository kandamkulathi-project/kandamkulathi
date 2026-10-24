# Current knowledge authoring read and exact UI codec

Bounded P1-MAT-003 follow-up. No existing `runtime.ts`/`postgres.ts`, root factory,
web cookie/CSRF implementation, index bridge, shared exports or dependency files
are replaced. Parent owns composition and combined gates. This is a read capability,
not a signed token, cached authorization, medical approval or permission to write.

## Frozen API and canonical exports

`GET /v1/knowledge/:entryId/authoring` requests explicit **view**. Optional singular
query `permission=edit|approve|withdraw` requests that action's current capability
AND requires an independent current view grant. No other query keys or duplicate
permission parameters are accepted. `edit` corresponds to Save a new chained draft;
it never means in-place editing. No workspace/role, actor, grant or expiry comes
from the request. There is no list/enumeration endpoint: parent binds an explicit
domain-selected canonical entry ID, not a synthetic default record.

New canonical module: `packages/contracts/src/knowledge-authoring.ts`. Parent adds
the `@kandamkulathi/contracts/knowledge-authoring` subpath; direct source import is
also possible during integration. Exports:

- `knowledgeAuthoringPermissionSchema`, `knowledgeAuthoringQuerySchema`;
- `knowledgeAuthoringCapabilitySchema`, `knowledgeAuthoringResultSchema`;
- `KnowledgeAuthoringResult`, `KnowledgeAuthoringReady`, `KnowledgeAuthoringAction`;
- `decodeKnowledgeAuthoringSource`, `decodeKnowledgeAuthoringRecord`;
- `createDecodedContentAuthoringPort`, `KnowledgeAuthoringTransport`;
- `knowledgeAuthoringResponseMaxBytes`, `knowledgeAuthoringRequestMaxBytes` (65536),
  `knowledgeSourceBase64MaxChars` (64000), `knowledgeSourceDecodedMaxBytes` (48000),
  `knowledgeSourceMaxCount` (20).

Success200 is exactly:

```ts
{
  status: "ready", schemaVersion: 1,
  record: KnowledgeRecord,
  capability: {
    actor: KnowledgeAuthorityActor,
    organizationId: string,
    permission: "view" | "edit" | "approve" | "withdraw",
    scope: "catalogue" | "institution",
    productId: string | null,
    language: "en" | "ml" | "ta", kind: KnowledgeContent["kind"],
    entryId: string, revision: number, contentHash: string,
    expiresAt: string
  }
}
```

Every scope/reference field equals the current canonical record. Actor UUIDs are
canonicalized; approval capability is impossible for the current editor, including
UUID case aliases. Approve requires a draft, qualified physician grant and current
registered public sources; withdraw requires approved state. Edit also rechecks
registered source rights. View alone intentionally permits an authorized reviewer
to inspect the current draft/withdrawn record. An approved lifecycle label in this
staff response is NOT public publication authorization.

Expiry is the actual minimum of selected current view/action grants, verified and
current identity session, MFA, and applicable privacy-consent expiry. It is not an
invented UI lease or review deadline. Revocation before that timestamp still wins
on the next read or server mutation. Every write independently rechecks identity,
scope, qualification, source provenance, current state and CAS; capability JSON
never substitutes for those checks or the existing real web CSRF mechanism.

Missing entry and missing/wrong-scope grant both403:
`{status:"blocked",reason:"FORBIDDEN"}`. Invalid route/query400 INVALID_REQUEST;
unauthenticated401 UNAUTHENTICATED; absent configuration503 NOT_CONFIGURED; database,
guard, invalid primary or unavailable identity503 PRIMARY_UNAVAILABLE. Errors have
no partial record, raw SQL, prompts or exception messages. All replies are
`Cache-Control: private, no-store`, varying on Cookie/Authorization/Origin.

## Exact Denzil ContentAuthoringPort, not an unfinished seam

`createDecodedContentAuthoringPort` structurally implements the existing Denzil
port with mandatory concrete `readSource`, `decodeSource`, and `submit`. It does
not import UI code or map staff/physician workspaces to permissions. For example:

```ts
const authoring = createDecodedContentAuthoringPort(parentRealWebTransport, {
  sourceUploads: explicitlyReviewedPublicUploads,
});
```

The REQUIRED transport accepts `{method:"GET"|"POST",path,body?,signal}` and returns
`{httpStatus,body}`. Parent supplies its actual authenticated web cookie/origin/CSRF
transport (or verified native bearer). The codec neither obtains/stores tokens nor
invents CSRF, grants, source bytes, a physician identity or an approval timestamp.

`readSource({session,record,permission}, signal)` calls the named GET, strict-decodes
the response, requires exact canonical actor/session/full record/permission and
current expiry, then returns the exact wire object. `decodeSource` projects exactly
`{actor,record,permission,expiresAt}` for Denzil's existing independent binder. A
view-only response cannot become an action projection. No optional decoder or
local role fallback is left for the UI owner to invent. A denied404/401/403 returns
no projection; unavailable/uncertain transport throws a sanitized error.

For the initial explicit record reader, call GET with no permission and use
`decodeKnowledgeAuthoringRecord(body,{actorId:session.userId,entryId})`; it accepts
only a bound, unexpired view envelope. Parent maps HTTP outcomes into the existing
ContentReader Resource model without turning503 into empty/success. Do not fall
back to a stored/cached fixture or use the action decoder as a view grant.

Submit emits the already frozen canonical draft/approve/withdraw POST bodies,
never capability/grant fields. No mutation is retried. Parent/Denzil retain the
existing once-only lane, uncertainty handling, persisted-receipt validation and
fresh authorized post-write read. Draft source uploads remain pre-reviewed inputs;
there is no fabricated upload endpoint and no public URL is fetched.

### Actual byte caps

The existing Hono `bodyLimit.maxSize` is **65536 UTF-8 bytes for the entire request
JSON**. Draft source array1..20; each valid base64 string4..64000 characters, at
most48000 decoded bytes per source. There is no independent aggregate decoded
quota. Clinical text, citations, source metadata, all base64 and JSON overhead
share the same65536 byte limit. Multiplying48000 by20 does not describe a valid
request allowance. The codec preflights `TextEncoder(JSON.stringify(actualBody))`
before dispatch, and the server remains authoritative. Existing413 must stay an
explicit invalid/too-large transport outcome, not a successful save.

New GET responses are capped at65536 UTF-8 JSON bytes; an oversized authoritative
record produces503 without partial content. Transport must cap raw streamed bytes
before JSON parsing as well. Pure decoders also reject oversized decoded values.
GET returns source metadata only, no source bytes or signed/private object URLs.

## Parent registration (preserve real web guards)

New implementation: `apps/companion/src/knowledge/authoring.ts` exports
`createKnowledgeAuthoringRuntime` and `registerKnowledgeAuthoringRoutes`.
The dependency resolver runs per request. In parent's existing Companion root,
register this IN ADDITION TO existing knowledge mutation/public routes:

```ts
registerKnowledgeAuthoringRoutes(app, (bindings, request) => {
  if (!bindings || typeof bindings !== "object") return undefined;
  const values = bindings as Record<string, unknown>;
  if (!platformConfig(values).DATABASE_URL) return undefined;
  const configured = createConfiguredIdentityRuntime(values);
  return {
    verifySession: async (readRequest) => {
      const result = await configured.dependencies.verifySession(readRequest);
      if (result.status !== "verified") return result;
      const identity = verifiedIdentitySchema.safeParse(result.identity);
      return identity.success
        ? { status: "verified", identity: identity.data }
        : { status: "unavailable" };
    },
    runtime: createKnowledgeAuthoringRuntime({
      withClient: configured.identity.withClient,
      loadCurrentAuthorityInTransaction,
      guardSessionInTransaction: (client, identity) =>
        configured.withSessionInTransaction(client, request, identity, async () => {}),
    }),
  };
});
```

Names above are existing parent exports/helpers, not alternate authentication
adapters. Retain the parent's real `validateCurrentIdentity` privacy/session rules
and web-session transaction guard. The guard is REQUIRED by the new factory. Do
not pass a no-op for real web cookies. GET does not submit a mutation or require a
fake CSRF token; POST writes keep the existing actual web-CSRF verifier unchanged.

## Transaction and grant migration

The read uses the shared platform transaction, shared knowledge advisory fence,
actual identity authority loader, mandatory current-session guard, and
`validateCurrentIdentity` including current privacy consent. It requires verified
organization and current MFA, matching the integrated authoring mutation policy.
It then loads ONLY scope metadata under a record row lock, checks explicit view
and requested action grants under `FOR SHARE`, and only then reads/validates the
full record and recomputes its canonical hash. Identity, entry, source and grant
locks stay held until COMMIT. A final database-clock expiry check catches time
advancing while waiting for locks. No provider/fetch call occurs inside locks.

The approved additive change to the UNRELEASED0004 migration is ONLY this suffix;
preserve all other parent/index-agent SQL and journal:

```sql
ALTER TABLE core.knowledge_grants DROP CONSTRAINT knowledge_grants_permission_check;
ALTER TABLE core.knowledge_grants ADD CONSTRAINT knowledge_grants_permission_check
 CHECK(permission IN ('view','edit','approve','withdraw','manage-product'));
```

Provision separate view grants through the restricted administrator, with explicit
actor, organization, scope/product/language/kind, version/evidence and validity.
No grants are seeded by this migration and Core cannot provision them. Edit,
approve, withdraw, staff workspace and UI visibility never imply view. Existing
read RLS/lock policies are reused; no private-corpus or grant-reporting endpoint
is introduced. Do not reapply/modify an already released migration; a deployed
target needs a separately versioned additive migration and reviewed recovery plan.

## Verification and remaining integration

Focused run: **25 tests passed** across new unit/HTTP/actual PostgreSQL files.
Root TypeScript and contracts/Companion typechecks passed. PG uses the actual
identity migration/loader, real privacy decisions, non-owner Core role and Neon
WebSocket harness; no minimal actor stub or unconditional authority fixture.
Cases include explicit view/action separation, scope mismatch, self-approval,
session/privacy/qualification/view-grant revocation, physical identity/record/
grant lock conflicts, current capability after revision change and stale write CAS.
Tests use synthetic people/content, not provider or physician approval evidence.

Integrated checkout command (private synthetic PG env supplied by coordinator):

```sh
source /tmp/opencode/kandamkulathi-p1-tools-env.sh
flock /tmp/opencode/kandamkulathi-p1-e2e.lock pnpm exec vitest run tests/unit/knowledge-authoring-codec.test.ts tests/integration/knowledge-authoring-http.test.ts tests/integration/knowledge-authoring-postgres.test.ts
```

In this isolated lane before prerequisite synchronization, optional test-only
`KNOWLEDGE_AUTHORING_IDENTITY_MIGRATION` and `KNOWLEDGE_AUTHORING_IDENTITY_MODULE`
point to the parent's actual reviewed files. A Vitest module-location alias unifies
the identical shared platform client/transaction registry across worktrees; the
identity loader, SQL driver, real transaction checks and all assertions still run.
Normal integrated tests need neither override nor alias.

Parent must run the registered GET against its actual root web-session factory
and browser ContentReader/CSRF submit transport, plus combined gates and independent
review. Full SAST/precommit/build/browser gates were not run in this bounded lane;
no parser exemptions, scanner rules, commits, push, merge or deployment changed.
No inline TS import-type expressions or Node-incompatible parameter properties
are introduced. Direct Denzil API handoff returned401; parent relay source is
`/tmp/opencode/p1-mathew-knowledge-authoring-api.md`.
