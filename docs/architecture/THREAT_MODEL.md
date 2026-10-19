# Threat model and security boundaries

**Owners:** Mathew/Devadathan; Josin for money/stock; company physician/privacy/operations approve risk expectations. **Status:** planned threat model; control implementation and security testing Pending. Use [security review](../security/SECURITY_REVIEW_CHECKLIST.md) and canonical QA rather than claiming compliance from this document.

| Attacker input / trust crossing | Threat | Required control / proof |
|---|---|---|
| Browser/native/chat -> Core API | Forged role/clinic/record, stale session/org/MFA, IDOR | Verified sessions, deny-by-default per-record API/RLS/file/export/tool scope, transaction-local cleanup, all-actor negative matrix. |
| Client money/quantity/recommendation -> transaction | Discount/tax tamper, consult-only bypass, stock/slot/credit race | Server totals, signed clinical binding, deterministic checked transactions/constraints, synchronized races and rollback control totals. |
| Provider callback/unknown reply -> ledger/job | Forged or reordered event, replay/double charge/shipment, lost obligation | Raw-body authenticity/account/amount/reference, semantic idempotency, durable receipt/outbox/reconciliation; fault injection. |
| User/KB/tool text -> AI response/action | Prompt injection, unapproved medical output, foreign record/tool | Treat content as untrusted; current approved primary safety blocks, minimal intake, no-sale escalation, typed scoped current-state explicit confirmation. |
| Voice upload -> transcription -> tool | Malicious/oversize/expired media, ambiguous unit or unchecked action | Scoped bounded private media, expiry, editable review/clarification, explicit confirmed proposal and replay controls. |
| Bot/staff/WhatsApp identity -> support | Phone-only impersonation, link replay, stale bot reply after takeover | Authenticated account proof, expiring links, current ownership at send/action, consented minimal summary. |
| Video join/signaling/media | Foreign/expired/revoked patient/doctor room | Appointment/assignment/consent identity, authorized join windows/credentials, actual web/native/TURN denial/reconnect tests. |
| File/public cache/analytics/export/log | Private data/credential leak, hostile markup/CSV | Protected private objects/cache separation, redaction/encoding/escaping, private-link expiry, least-privilege report access. |
| Repo/CI/preview -> service credentials | Secret theft, fork PR execution, production mutation | No real secrets in repo/examples/logs, read-only pinned bootstrap actions, no pull_request_target execution, isolated synthetic resources, reviewed protected deploy. |
| Backup/restore/migration -> live state | Lost objects/roles, leaked dump, duplicate provider replay, incompatible native | Encrypted independent recovery access, object manifests, timed isolated validation, current provider/domain controls and additive compatibility. |
| Load/campaign/model backlog -> availability | Resource exhaustion, starvation, unbounded pool/lease/retry | Separate AI budgets, bounded queues/concurrency/deadlines, rate/fault controls, measured real workloads, alerting and safe fallback. |

Review new endpoints/actors/providers/schema/publication/media/retention changes against this table. Add concrete abuse cases and required assertions before merge. Store exploit/private evidence in approved restricted storage. Scan results need triage; no unresolved critical/high or required safety/privacy/financial acceptance blocker may pass a gate.
