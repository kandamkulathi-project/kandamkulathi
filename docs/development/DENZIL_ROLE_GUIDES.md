# Phase 1 staff/content quick guides — Denzil

**Draft operating guides, not company permission or training approval.** Follow the real server's current access decision. No local role selector, URL parameter, fixture or guide grants access. Company role matrix, production adapters, approved clinical text and recorded training remain Pending.

## Available shared workspace shell

Open the workspace preview on `http://127.0.0.1:5173` after starting the documented local servers. The header language control changes draft EN/ML/TA interface labels. Navigation links are Home, Customer, Staff, Physician and Support; a verified response narrows them to server-issued workspace grants. The root screen contains local device checks and an editable Companion draft, not a functioning message sender. Device permission prompts occur only after an explicit diagnostic button press.

For every private route:

1. Inspect the session notice first. Loading is not an empty record list. Anonymous, denied, unavailable and request-error states are distinct; no business operation succeeds in those states.
2. Use **Check access again** only to request a fresh session/read. Do not change local storage or fabricate request headers to get past denial. Session refresh, expiry and backgrounding may clear private information and drafts.
3. The baseline route is a pending skeleton until its bounded component is integrated by Devadathan. The Denzil modules do not independently modify the shared router. Do not describe a module screenshot as an enabled staff journey.

## Staff / front desk / warehouse

- Only a current server-authorized scope may supply order, batch or doctor-schedule rows. These are read-only views: no payment, stock, dispatch, booking or clinical mutations are offered.
- Use the provided filters and pagination; a new query must not leave stale rows displayed after a denied/error response. Empty means an authorized successful response contained no rows, not that an unavailable API contains no business records.
- Order and batch figures are supplied by the commerce owner. Doctor scheduling and clinic scope are supplied by the booking owner. Unexpected figures, missing clinics or access failures go to Josin/Mathew, not a local spreadsheet override.
- Synthetic import reports are dry-run support only. Resolve invalid rows with the source owner; compare control totals to the approved source revision; hand the report and file to Josin. A clean synthetic report does not write stock or accept the actual opening import.

## Content editor

- Preserve exact approved source/version/provenance and language. Draft fields do not establish medical accuracy, approval, publication or persisted state.
- An editor is not their own approver. Hand the exact revision/hash and missing EN/ML/TA safety coverage to the independently authorized physician reviewer through Mathew's reviewed workflow.
- Missing authoring endpoints mean pending integration; do not claim that typing into a local draft saved or published it. Do not translate medical content or use an English safety fallback for missing Malayalam/Tamil text.

## Physician approver

- Review only content and actions allowed by current server-issued authority. A display name or client capability is not proof of physician qualification or current permission.
- Verify the exact version/source and editor identity before independent review. Same-account aliases are still the same editor; a different name/UUID spelling cannot create an independent approver.
- Without a persisted, audited server transition, approval and withdrawal remain Pending. Do not treat a local preview or synthetic fixture as a clinical approval.

## Finance / support / training coordinator

- Finance: no invoice issuance, reconciliation, payment or refund shortcut is present in this bounded lane. Request authoritative reports and finance-approved figures from Josin.
- Support: the shell does not send messages, take over a conversation or book a callback. Missing approved acknowledgement wording and provider integration remain Pending with Mathew.
- Training coordinator: demonstrate the actual integrated screen at an exact source/build/configuration; capture only synthetic rows. Record expected/actual results, role, date and restricted evidence location. Company recovery/escalation contacts, actual recordings and acceptance are still required.

## Denied, unavailable and uncertain results

On 401, sign in through the approved identity flow once available. On 403, stop and request a scope review; retrying with a different clinic is not authorization. On unavailable/network/invalid-response states, retain no claimed success, retry only the read when appropriate, and report the affected screen and safe request reference to its owner. Never include tokens, full private responses, patient messages or signing/provider material in evidence.

See [client integration](CLIENT_FOUNDATION.md), [knowledge boundaries](KNOWLEDGE_FOUNDATION.md), [readiness register](../operations/DENZIL_P1_READINESS.md) and [canonical training/role cases](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). These guides do not close P1-T09/P1-T15 or G1.
