# Bounded Phase 1 event notice

This additive candidate implements **one approved, zero-parameter WhatsApp test
template** triggered by a persisted signature-verified text event. It is not Phase
2 order messaging, campaigns, account linking, delivery confirmation or clinical
advice. Real company template/consent policy, provider receipts and independent
security review remain **Pending**; no G1/provider acceptance is claimed.

## Server configuration and approval

The jobs runtime accepts `CHANNEL_NOTICE_CAPABILITY_ID`,
`WHATSAPP_NOTICE_ACCESS_TOKEN` (secret) and `WHATSAPP_GRAPH_VERSION` (explicit
supported version, e.g. the company's reviewed current Graph version). Existing
`PROVIDER_MODE=live`, production environment and `ALLOW_LIVE_SENDS=true` are all
required for the real Graph adapter. Stub and sandbox modes cannot use it or report
provider success. Synthetic loopback tests inject their own transport instead.
Missing send configuration durably suppresses
the notice as `configuration_unavailable`; it never substitutes text or a fake receipt.
Independent human routing still commits. Existing unconfigured webhook inputs retain
their existing HTTP 503 behavior. There is **no public send/configuration API**.

A controlled administrator provisions `engagement.channel_notice_capabilities`:
UUID, revision, used=0 and capability JSON matching
`packages/contracts/src/channel-notices.ts` (JSON omits id/revision/used, which are
authoritative columns). No application role may create or change approvals.
FORCE RLS explicitly allows the controlled migration owner to provision/read/update
approvals without requiring superuser/BYPASSRLS. Usage starts at zero and cannot be
reset, even by the administrative owner: a private security-definer insertion trigger
alone consumes one unit per unique leased sending reservation. Jobs has only a
lock-only column UPDATE privilege on the capability, not mutable counter access.
The explicit capability must name the approved test purpose, business/receiving
phone identity, consenting signed sender, exact approved template/language,
company approval reference, explicit recipient-consent reference, policy version,
enabled state, not-before, expiry, permitted event age and approved quota. None
has a business default; chat text never establishes consent. References are opaque
approved-record identifiers, not names, addresses, evidence contents or PHI.

This is a separate restricted **test-send capability**, not the application's
sign-up/marketing consent or a grant to message linked customer accounts. Do not
provision it without an approved company test-recipient/template/consent policy.
Revoke by setting `enabled=false` in controlled administration. A revision bump
alone is not revocation: new eligible events use the current approved revision.
Disable-based revocation is checked and serialized before the committed send
reservation; it cannot retract an already-authorized external submission.

## Integrated mount contract

The completion working tree registers 0029 and applies this domain-scoped Jobs
composition. Final combined checks and actual provider proof remain separate.

1. Append `0029_channel_notices` to the canonical migration journal using the next
   index/timestamp. No 0026 financial policy changes and no platform jobs INSERT
   grants are needed. The existing ingress transaction already creates the job.
2. In `apps/core-api/src/jobs.ts`, import `configuredChannelNoticeHandler` from
   `./channel-notice-runtime`. Immediately before the existing `knowledge.index`
   external route, route this domain's `engagement.notify` obligations to
   `executeExternalClaim(context, claim, configuredChannelNoticeHandler(env))`.
   First query `engagement.mathew_channel_processing` for both `inbox_id =
   claim.subjectId` and `operation_id = claim.operationId`; this route must not
   capture other domains' engagement jobs. Keep all other handler routes unchanged.
   Do not fall back to the old success-only ingress handler if notice configuration
   is absent: that would consume the job without recording its notice disposition.
3. No package exports/root bindings changes are required: owned modules use typed
   relative imports, and existing PlatformBindings permits server-only properties.

## Durability and uncertainty

The existing signed webhook commits inbox+processing+reference-only job atomically.
The external consumer first independently commits the original human-routing state
under the platform fence. Audio/status events and unavailable, wrong-recipient,
revoked, expired or quota-exhausted notice capabilities cannot starve that route.
It then locks the platform fence, processing and approval rows;
rechecks current signed sender/event freshness, consent/template capability,
revision, expiry and quota; consumes quota; and inserts a unique per-inbox sending
reservation. Ineligible notices instead persist `suppressed` with an explicit
reason and no provider message ID. Platform completion then means the human route
and notice disposition committed, not that a suppressed message was sent.
**COMMIT precedes provider HTTP**.
No inbound body, recipient, template contents or provider body appears in logs or
queue envelopes. The provider receives only the exact zero-parameter template.

Provider acceptance is persisted separately from platform completion under both
the domain token and current platform lease, held through commit. An accepted
receipt means API acceptance only, never delivery/read. Durable accepted replay
does not call HTTP again. Explicit structured client rejection remains rejected,
completes processing without retry exhaustion, and never creates a provider-accepted
receipt. Replaying that durable rejection also never calls HTTP again. Jobs may
transition only prior `sending` rows; accepted, rejected, unknown and suppressed
dispositions are immutable to jobs, including their provider message IDs.
Network loss, invalid/oversized receipts, server errors and a process/lease loss
after reservation remain unknown (or sending until the next delivery marks them
unknown); **none automatically resends**. Quota is not refunded on uncertainty.
WhatsApp has no guaranteed send idempotency or lookup-by-operation primitive in
this adapter; the opaque callback operation ID aids operator investigation but
is not treated as an idempotency guarantee. Signed delivery callbacks continue
through the existing private inbox, not fabricated delivery acknowledgements.

For unknown outcomes, company-authorized operators must reconcile provider/company
records and persisted signed callbacks. Never reset sending/unknown to manufacture
a retry. Approval/transport expiry or exhausted platform attempts requires manual
review; durable notice rows survive. This candidate deliberately offers no unsafe
manual resend or invented reconciliation-success API.

## Focused proof and manual handoff

Run the focused unit test and serialized real PostgreSQL/loopback HTTP proof:

```sh
pnpm exec vitest run tests/unit/channel-notices.test.ts
mkdir -p /tmp/opencode
flock /tmp/opencode/kandamkulathi-p1-e2e.lock node --test tests/platform/channel-notices.test.mjs
```

The PG fixture reapplies only owned 0029 in its isolated database as a genuine
NOSUPERUSER/NOBYPASSRLS owner. It exercises owner provisioning/revocation, denied
counter mutations, signed ingress, independent human routing, concurrent lease/replay,
real HTTP after commit, receipts, revocation and no resend after lost response or
expired fence. Unit cases cover quota/expiry/freshness/identity and provider errors.

After review/mount/migration, an authorized tester must provision an actual
approved test capability and explicitly permitted production live credential
(never commit them; the real Graph adapter is not enabled by sandbox mode), send a
current signed ingress event from its bound test sender, run the existing
dispatcher/consumer, and inspect the private notice/provider receipt. Redeliver
the same event/job and verify no second HTTP send. Disable approval or exhaust
its approved quota and verify no send. Simulate a dropped response in a synthetic
environment and verify unknown plus operator review, never an automatic resend.
Actual company provider interaction, current template approval and receipt proof
are still Pending, separate from this software proof.
