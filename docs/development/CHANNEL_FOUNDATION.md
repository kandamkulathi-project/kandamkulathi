# Channel foundation candidate — KAN-87 / P1-MAT-004

This is a bounded, unapproved implementation candidate, not WhatsApp, voice or phase acceptance.
The [Mathew plan](../implementation/Kandamkulathi_05_Mathew_All_Phases.md#p1-mat-004--privileged-messaging-voice-and-durable-job-contracts)
and [architecture](../architecture/ARCHITECTURE.md) remain authoritative. Required independent
Devadathan/security review and company/provider/privacy/clinical approvals remain Pending.

## Implemented boundary

- Companion registers `GET/POST /v1/channels/whatsapp/webhook` before the shared `/v1/*` fallback.
  Shared security headers, request IDs, private-cache prevention, body limit and readiness remain.
  `createService` adds an optional third route-registration options argument; the second argument
  is reserved for the separately owned platform logging interface. No unreviewed platform code
  or queue/outbox dispatcher is copied.
- The default entry point uses `apps/companion/src/service.ts` to register both channel and public-knowledge routes behind one shared HTTP boundary. Trusted dependency ports are separate: absent channel storage does not authorize a receipt or block otherwise authorized public knowledge. Isolated service factories remain available for synthetic contract tests. Neither factory nor the combined default supplies an in-memory production store or authority fixture. `tests/integration/companion-composition.test.ts` verifies routing, shared headers and exact signed bytes with explicitly synthetic ports; real workerd coverage checks the combined unavailable boundary only.
- GET requires configured `hub.mode=subscribe`, verification token and a bounded numeric challenge.
  Duplicate/unknown query fields, wrong tokens and reflective nonnumeric challenges are denied.
  Challenge success proves configuration only, not durable receipt or application readiness.
- POST verifies **exact raw bytes** using Web Crypto HMAC-SHA256 and the strict
  `X-Hub-Signature-256: sha256=<64 hex digits>` format before UTF-8/JSON decoding. No provider call.
  A 64-KiB streaming cap applies even without a truthful Content-Length. JSON media type only;
  encoded/compressed bodies are rejected. Errors do not echo/log raw text, signatures or secrets.
- Every entry must match the configured business account and **receiving phone number ID**.
  These are provider-routing checks, **not authenticated customer account linking**. Display phone
  text, contacts/profile names and incoming message content never establish application identity.
- Parsing accepts a deliberately strict subset: bounded text, supported audio **metadata only**,
  and minimal sent/delivered/read/failed statuses. At most 100 aggregate events and 4096 text
  characters. Unknown fields/types, media URLs, interactive/reaction/context structures, pricing,
  conversation objects and provider error extensions are not silently discarded or acknowledged:
  they return 400 and require reviewed contract expansion plus actual provider fixture proof.
  No audio download/upload, transcription, bot response, notice or business action is implemented.

## Durable receipt adapter — required before acknowledgement

`DurableChannelInbox.commitBatch` is a **trusted server-injected port**, never a request binding.
There is intentionally **no production implementation or in-memory fallback**. Default Worker
POSTs return 503, including correctly signed requests if configuration alone is supplied.
Configuration uses backend-only `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`,
`WHATSAPP_BUSINESS_ACCOUNT_ID` and `WHATSAPP_PHONE_NUMBER_ID` bindings; no sample credential is
installed. Missing/invalid configuration returns 503. GET configuration does not require a store.

The future reviewed PostgreSQL adapter must:

1. Commit the whole validated batch in a short transaction with a unique semantic key and the
   durable processing obligation, using the existing platform outbox contract. Never perform
   provider I/O while holding the transaction. Queue payloads contain private references, not text.
2. Uniquely scope messages by business account, receiving phone ID and provider message ID;
   status receipts additionally distinguish delivery status. Raw envelope hashing alone is not
   deduplication. A normalized content SHA-256 detects conflicting content under the same key.
   Identical repeats within one request collapse; conflicting repeats are rejected before storage.
3. Report duplicates only when the matching content was **already committed**. An in-flight or
   uncertain transaction is not a duplicate-success result. Conflicting persisted content must
   fail without overwriting it. Never expose raw storage errors.
4. Resolve `{ outcome: "committed", inserted, duplicates }` only after durable commit. Counts must
   be nonnegative safe integers covering the complete deduplicated batch. Only this confirmation
   allows HTTP 200. Rejection/exception/invalid confirmation returns retryable 503. Crash after
   commit but before acknowledgement is reconciled as an already committed duplicate on retry.
5. Enforce scoped database access/RLS, approved private-payload retention/deletion and replay
   policy. A genuine old signed event can be replayed; HMAC does not prove freshness. This
   candidate relies on retained semantic uniqueness, not an invented timestamp freshness policy.

The port cannot prove an arbitrary injected implementation is durable. Real transaction,
RLS/unique-constraint/concurrency/crash tests on the selected PostgreSQL driver remain mandatory.

## Account, transcript and takeover contracts

`@kandamkulathi/contracts/channels` and `@kandamkulathi/domain/channels` expose bounded server
contracts and pure plans; there are **no public link/review/takeover/send endpoints** yet.

- Account-link consumption requires a current authenticated account authorization, explicit
  confirmation of that grant, matching full account/receiving-phone/sender identity, unexpired
  unused grant, revision and SHA-256 proof of a 32-byte random token. The issuer/session flow is
  still absent; a future issuer must use cryptographically random tokens, store only their hash,
  and use approved expiring private transport. `consumeAndLink` must atomically recheck unused
  state, exact revision/account/identity, current authorization and **database-time expiry**, then
  consume the grant and create a unique link. Application-clock prechecks cannot replace this.
  A CAS failure is conflict, not linked. Auth/session integration and persistent one-use proof
  remain Blocked; matching a WhatsApp number is never sufficient account authentication.
- Transcript confirmation requires the owning account's trusted review permission, explicit
  confirmation, exact account/conversation/transcript/revision, nonempty bounded editable text
  and pending-review state. `TranscriptRepository.confirmReview` carries the trusted actor,
  `confirm-reviewed-text` intent, expected state and explicit review—not an unchecked next state.
  It must commit the reviewed text before returning confirmed. Generated
  text remains untrusted, even after review. Confirmation confers **no domain-action permission**;
  a future action still requires current domain authorization and a fresh, scoped proposal
  confirmation. No generated/unchecked transcript can call a tool in this candidate.
- Takeover/resume plans require trusted scoped staff authorization and increment the ownership
  epoch. Human ownership pauses bot eligibility. Resuming creates another epoch, so a bot result
  from before takeover stays stale. `OwnershipRepository.commitChange` preserves the trusted
  staff actor and take-over/resume intent, owning customer account and conversation identity.
  The repository must compare canonical immutable identities and complete expected state,
  recheck current authorization, commit ownership and fence/cancel stale **unsent** platform work
  atomically. Pure `mayBotProceed` checks are not a database lock or send guarantee: check again
  in the platform transaction when committing/claiming unsent work and before provider dispatch.
  Model output/message content never constructs trusted authorization or decides takeover.
- Both mutation ports are bound to verified server authentication: command actor IDs are assertions
  to compare, not credentials or permission to impersonate a selected account. Planning-time
  booleans do not authorize COMMIT. Within one short transaction the adapter must reload the
  canonical row and current actor authorization, compare immutable account/conversation and
  resource identity plus the complete expected state, derive the effect from canonical data,
  and serialize permission revocation through the same COMMIT as the effect/audit/fence. Use
  authorization-row locks or equivalent version/serialization guarantees; an earlier permission
  read followed by an unrelated epoch/revision CAS is insufficient. Revoked permission returns
  denied without effects; mismatched expected state returns conflict without effects.
  `evaluateOwnershipChange` / `evaluateTranscriptConfirmation` centralize these comparisons and
  canonical effect derivation; they are **pure policy helpers, not transactions or repositories**.
  The real adapter must enforce their authoritative-input and atomic-commit obligations.
  Internal UUID schemas use the shared `canonicalUuidSchema` in `contracts/src/identifiers.ts`.
  Direct trusted actors, canonical/expected state, link authorizations and transcript reviews all
  pass through those schemas before identity comparisons or repository commands. Upper/lowercase
  UUID spellings map to the same canonical principal/resource; distinct UUIDs still cannot reuse
  another account's grant, scope or transcript. Provider account/phone/sender IDs are **not UUIDs**:
  their numeric strings stay exact and are never lowercased, numerically coerced or alias-matched.
- **In-flight send limitation:** a provider request already submitted, or submitted in the race
  after a last state read, cannot be retracted by an epoch CAS. No claim of exactly-once external
  messaging or zero late replies is made. The transport owner must serialize/fence unsent work,
  track stable operation IDs and uncertain/in-flight outcomes, reconcile provider results and
  expose residual takeover timing to staff. This branch implements no competing send dispatcher.

## Evidence and remaining blockers

Targeted unit tests use real Web Crypto against independently produced Node HMAC signatures,
including raw whitespace/Unicode, tampering and malformed signatures. Provider parsing tests
cover wrong identities, mixed batches, invalid UTF-8/JSON, limits and semantic deduplication.
HTTP integration tests assert deferred commit-before-ack, duplicates, failure redaction, missing
store/config, challenge handling and shared middleware. State tests cover account proof/expiry/
one-use CAS, takeover/resume epochs and explicit edited transcript review. Review follow-up
fixtures reject post-planning permission revocation and forged expected account/conversation/state,
and normalize alternate UUID spellings without confusing distinct principal/resource identities.
These fixtures do not demonstrate PostgreSQL locking or
revocation serialization. Additional defense-in-depth tests cover valid raw MACs with each final
line terminator and URL-encoded challenge suffixes. The proposed regex defect was independently
disproved on the pinned Node runtime: existing non-multiline JavaScript end anchors already
reject those suffixes. Validators were not changed for that false finding, and raw verifier tests
make no claim that HTTP header parsing permits newline-bearing headers.

Repository doubles in tests are **contract fixtures**, not durable receipt, actual provider or
PostgreSQL evidence. `tests/e2e/channels.spec.ts` defines actual local workerd negative checks for
unconfigured callbacks/challenges, oversized bodies and unavailable action routes. Its default
Worker has no secrets/store; it does not prove configured HMAC execution or successful receipt in
workerd. The parent session owns serialized full gates and E2E execution; no full gate is claimed
from these definitions.

Remaining acceptance blockers: company-owned provider number/access/templates/quotas; privacy,
retention and processor approvals; durable PostgreSQL adapter/migration and real DB/RLS race/
failure evidence; authenticated grant issuance/session endpoints; real voice/media/transcription;
reviewed platform transport integration and actual notice/provider interaction; physician-approved
evaluation oracles/fixtures and independent security review. No clinical policy, approved wording,
provider delivery, financial operation, phase completion or public release is fabricated.
