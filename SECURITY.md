# Security policy and reporting

**Security/clinical leads:** Mathew and Devadathan. **Financial/stock support:** Josin. **QA evidence:** Tinu. The company must name its privacy/clinical/operations primary and backup in the readiness register. No public email address or promised response SLA is invented here.

## Report privately

Use the approved private team/company security channel and contact Mathew/Devadathan. If the repository's private vulnerability reporting feature is enabled, it can be used; activation has not been verified. Do not put exploit details, credentials, patient records, addresses/phones, raw voice or private links in a public issue. The bug form is for redacted ordinary bugs; serious security reports stay private.

Provide affected candidate/component, actor/clinic scope, minimal synthetic reproduction, expected/actual behavior, concrete business impact and restricted evidence reference. Never exploit a real patient/account or stress a live provider to demonstrate impact.

## Threats and release policy

Report broken session/org/MFA/RLS scope, foreign private files/records, secrets, unapproved clinical advice/unsafe tools, replayed money/stock/booking effects, stale consent/jobs, injection and unsafe recovery. See [threat model](docs/architecture/THREAT_MODEL.md) and [review checklist](docs/security/SECURITY_REVIEW_CHECKLIST.md).

All findings require triage; confirmed critical/high vulnerabilities and safety/privacy/financial/acceptance blockers prevent a passing gate. False positives need evidence/reviewer. Lower-risk residuals require company-approved owner/date and cannot waive a required company feature. A scan does not certify an absence of vulnerabilities.

Contain/stop harmful effects, preserve restricted evidence, assess exposure, rotate compromised secrets through the actual owner and reconcile providers/data. Follow [incident response](docs/operations/INCIDENT_RESPONSE.md). Legal/clinical reporting obligations are determined by the company reviewers using current applicable rules; do not invent deadlines.

Free SAST, secret, dependency and Node checks plus local commit hooks are described in [security automation](docs/security/SECURITY_AUTOMATION.md). Every unremediated dependency severity blocks. Mandatory remote merge protection is blocked by current private-repository plan eligibility despite admin access; do not treat workflow success as enforced protection. Scheduled scans activate after the workflow reaches the default branch.

Before launch configure actual private reporting contacts, access recovery, alert recipients, incident coverage and supported client/runtime inventory. Those owner-controlled settings remain Pending.
