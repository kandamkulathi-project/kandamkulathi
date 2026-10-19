# Data classification, consent and handling

| Class | Examples | Controls |
|---|---|---|
| Approved public | Published product/doctor/content and approved public knowledge versions | Company/physician approval, source/version/withdrawal, safe public cache/feed; no private content mixed in. |
| Internal operational | Scope/architecture, nonpublic reports/runbooks, staff workflow/usage metadata | Company-controlled repository/access, least privilege, redacted sharable summaries; confirm repository visibility before publishing. |
| Private personal/health | Identity/contact/address, patient notes/history/chat/voice, consultation/purchase relationship | Verified per-record/clinic/patient/assigned scope, required consent/version, transport/at-rest controls, private objects/expiry, minimal retention and restricted evidence. |
| Restricted secrets/financial security | Service keys/session/signing/recovery tokens, database admin, incident exploit evidence | Approved secret manager, separate roles/context, no source/public artifacts/logs, rotation/audit and company recovery ownership. |

Collect required signup/privacy and consultation identity/consent under approved company policy; optional marketing opt-in is separate. Unknown/declined required medical intake routes safely; public browsing does not require medical disclosure. Guardian/retention/deletion/export and lawful financial record retention are company physician/privacy/finance decisions, not hardcoded guessed laws. Record source/version/time and revocation/current scope.

No real patient records in dev/preview/scanners/load/device-demo fixtures. Use deterministic approved synthetic data, including fake addresses/phones controlled by the team for actual sends. No raw health prompts in general analytics/KB usage reports, and no patient notes/conversations in public Vectorize. Minimum consented support/physician summaries only. Logs include redacted operation/state metadata, not raw private messages/bearer links.

Private files require authenticated current authorization and scoped expiry; public file paths are never enough. Maintain object version/hash manifests with retained recovery bytes. Approved retention must cover DB, objects, model/provider processing, messages, voice, logs, backups and evidence; recovery history is not record retention.

Production Neon Singapore does not provide India-only storage. Before patient use, company privacy owner approves actual database/R2/identity/AI/voice/video/messaging processor/region/data flows and configured encryption/transport. If residency requirements conflict, obtain a reviewed architecture/effort/cost change before use. This policy does not certify legal compliance or provider settings.
