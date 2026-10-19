# Security review checklist — per candidate/change

Initial status: Pending. Bind exact change/candidate/artifacts/config/model/KB and actors/provider mode. Mathew/Devadathan review independently; company approves clinical/privacy/finance expectations. Checklist ticks require evidence, not intention.

- [ ] Customer/staff identity, issuer/audience/expiry/revocation, organization/MFA, CSRF/cookies/CORS/session return hold.
- [ ] Every record/action/file/export/room/tool has role/clinic/patient/owner and current assignment/consent negatives, including direct IDs and pooled context error/reuse.
- [ ] No client/public/native/preview/log/analytics secret or private cache/object/health-text leak; hostile HTML/CSV/file/media/link handling is safe.
- [ ] Approved clinical intake/current source/version/safety/translation/disclaimer/no-sale/consult-only controls and private RAG separation hold.
- [ ] Typed tools require fresh scoped explicit one-use confirmation; replay/changed state/voice ambiguity and bot takeover races have no unauthorized effect.
- [ ] Signed webhook account/amount/currency/reference/current-state validation, semantic idempotency and uncertain-result reconciliation hold.
- [ ] Atomic money/stock/booking/credit/outbox, FEFO safety, doctor global buffers, stock transfer/refund/reversal and concurrency guards have persisted evidence.
- [ ] Jobs/leases/DLQ/retry/priority/deadline/version/consent and provider/model outage controls preserve durable obligations and core availability.
- [ ] Dependency/code/config/artifact/secret and authenticated manual/dynamic findings are fully triaged; independent blocker retests match current candidate.
- [ ] Migrations/roles/encryption/processor/backup/private objects/rollback/prior-native compatibility and company recovery controls are verified.
- [ ] No unresolved confirmed critical/high vulnerability or clinical/privacy/financial/required-acceptance blocker; permitted low-risk residual has company owner/date.

Current bootstrap secret-pattern scan is limited. Actual application dependency/SAST/DAST/secret configuration and specialist coverage must be implemented/rehearsed before corresponding gates. Never claim compliance or absence of vulnerabilities based on this checklist alone.
