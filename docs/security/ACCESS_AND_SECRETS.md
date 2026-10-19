# Access, credentials and recovery ownership

All source/domain/cloud/database/identity/AI/payment/messaging/courier/store/signing/billing/recovery accounts belong to the company with named primary/backup recovery owners. Mathew/Devadathan manage technical access; finance/clinical/privacy owners approve their domain. GitHub handles and company contact/recovery assignments remain Pending in the readiness register.

## Separate contexts

- Runtime: non-owner database role, limited APIs/bindings and environment-scoped secrets only; transaction-local role/clinic/patient scope. No migration/backup owner credential in Worker/native/public config.
- Migration/admin: controlled reviewed operator job, direct endpoint if required, separate restricted credentials/audit. No automatic shared/prod schema mutation from a feature preview.
- Backup/restore: separate least-privilege read/recovery roles, encrypted independent exports and company-owned key access; isolated validation targets.
- CI/preview: synthetic data, sandbox/stub providers, no production deploy/signing/private patient access from untrusted PR code. Pinned reviewed actions/read-only bootstrap token; no privileged pull_request_target execution.
- Clients: only explicitly public configuration; secure native sessions/return links, staff org/MFA, current authorization on push/deep links/files/rooms.

`.env.example` stores empty secret values; ignored local files are not a secret manager. Do not print/show/copy keys to chat/issues/README. Never upload the whole development environment as Worker secrets. Define actual secret names/config schema/provider bindings during scaffolding; missing/wrong mode fails closed. Review rotation/revocation/issuer/audience/expiry and session/pool cleanup in tests.

Maintain a secret inventory with purpose, environment, principal/least privilege, owner/backup, storage reference (no value), rotation/revocation trigger, recovery proof and last access review. Rotate actual exposure through approved owners, preserve incident evidence and invalidate affected sessions/keys. No fabricated credential/username or automatic production rotation is supplied by this document.
