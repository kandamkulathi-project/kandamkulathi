# Persisted channel ingress candidate

P1-MAT-004 extends the authenticated webhook foundation with PostgreSQL receipts,
private processing obligations and atomic reference-only platform jobs. No message
send, account linking, transcription or provider acceptance is claimed.

`postgresChannelInbox(context)` is bound by trusted server composition to an
event-scoped `withDatabase` connection, only after raw-byte signature validation.
Each batch commits receipt, processing obligation and outbox together. Semantic
replays must retain their original content hash; conflicting replays roll back the
whole batch. Parallel identical submissions produce one obligation. Private text
and media references stay in PostgreSQL, never in queue envelopes or telemetry.

Register `channelIngressHandler` for `engagement.notify` only in a routing handler
that first identifies this domain's processing obligation. Other domains also use
that platform job kind; do not replace their handlers. This handler durably routes
unlinked events to `awaiting_human`; transport success does **not** mean a customer
was messaged. No client-supplied account or phone-number match grants identity.
The 24-hour transport deadline is a bounded engineering pickup window, not a
clinical response SLA or an approved marketing retention rule. The processing
obligation remains durable even when transport expires and needs reconciliation.

The transport tables deliberately permit only server ingress and jobs roles, with
RLS and no public/client access. They are not a staff inbox API: exposing their
contents requires separate current account/clinic/assignment authorization. Only
controlled administrative tooling can delete receipts. Clinical/private retention,
human ownership routing, company provider access/templates and live sandbox proof
remain blocked pending approved inputs and independent review. G1 remains Pending.

Regression evidence lives in `tests/unit/channels-runtime.test.ts` and actual
PostgreSQL/HTTP `tests/platform/channels-runtime.test.mjs`; execute through the
normal unit/platform campaigns. The PostgreSQL pack must not be skipped when its
explicit isolated test database is unavailable.
