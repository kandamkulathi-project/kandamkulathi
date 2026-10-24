# Denzil Phase 1 — content, template and store readiness

**Candidate support only. G1, company approvals, provider receipts and public store delivery remain Pending.** This register supports KAN-63–68 / P1-DEN-001–004, 080 and 090. It does not change the company requirements, phase gates or clinical/financial rules.

## Versioned support inputs

- [Template/store fixture register](../../tests/fixtures/denzil-readiness/register.json): explicitly synthetic, no approved message wording, real account identifiers, submission receipts or private links.
- [Evaluation inputs](../../tests/fixtures/denzil-readiness/evaluation-inputs.json): harmless interface/lookup inputs only; not physician-approved medical scenarios or translated fallback responses.
- [Content inventory dependency register](../../tests/fixtures/denzil-readiness/content-inventory.json): required product/institution knowledge kinds and EN/ML/TA scope track the shared contracts. Actual complete published inventory, coverage/gap counts, an approved sample and company-agreed freshness deadline are unknown (`null`), never fabricated zero gaps or a numeric SLA. Mathew must run the authoritative complete-inventory reconciliation after the company supplies the exact source revision.
- [Fixture integrity tests](../../tests/unit/denzil-readiness.test.ts): enforce pending status, three launch languages, required message obligations and absence of fabricated receipts. Updating this fixture to actual approved inputs requires independent review and replacing these pending-only assertions deliberately, not relabeling placeholders.

## Required input register

| Input / requirement | Current state | Accountable handoff | Required evidence |
|---|---|---|---|
| Catalogue, variants, batches and opening control totals / R01, R05 | Synthetic dry-run only; actual approved opening inputs Pending | Josin + company operations | Approved source/template revision, rejected-row resolution, approved totals and Josin's actual import acceptance |
| Monographs, dosage, contraindications, safety and public physician profiles / R16, R19 | Approved clinical content and complete published inventory Pending | Mathew + company physician | Immutable source/version/provenance, independent named approver and complete EN/ML/TA coverage reconciliation |
| Interface and medical translations / R22 | Draft interface resources only; company review Pending | Denzil + company; physician for medical text | Reviewed exact strings and source versions; no fallback medical translation |
| Confirmation, dispatch, out-for-delivery, delivery templates / R08 | Approved copy and provider approval Pending | Mathew + company operations | Approved per-language version, event binding, deduplication and actual receipt/retry evidence |
| Invoice-ready template / R07, R08 | Finance milestone, private delivery and wording Pending | Josin + Mathew + company finance | Approved issuance trigger, scoped private link/document and reconciled delivery; no public invoice URLs |
| Callback acknowledgement and knowledge-unavailable handoff / R17, R20 | Approved copy and after-hours policy Pending | Mathew + company operations/physician | Exact approved wording, scope/consent and callback operating policy |
| Android and iOS listings / R25 | Company identifiers, copy, screenshots and disclosures Pending | Devadathan + company | Company account ownership, approved app IDs, listing assets, privacy/permission disclosures, signed build IDs, actual submission and public approval evidence |
| Provider configuration | Pending, no live send performed | Mathew + Devadathan | Company-owned configuration in approved secret storage; identifiers/status only in documentation |
| Role permissions / R36 | Reviewed company matrix and real scoped endpoints Pending | Mathew + domain owners | Server-derived current grants, clinic/record ownership and independent cross-role tests |
| Recorded training and final handover / R37, R38 | Draft guide support only; acceptance Pending | Devadathan + domain owners + Tinu | Actual role scenarios, approved recovery/escalation contacts and restricted recording/evidence links |

No synthetic source/name, JS export, local screenshot, dry-run result or template placeholder counts as a clinical/company approval, provider receipt, signed device build or phase pass. See [native readiness](NATIVE_READINESS.md), [knowledge boundaries](../development/KNOWLEDGE_FOUNDATION.md), [client boundaries](../development/CLIENT_FOUNDATION.md) and the [Denzil assignment](../implementation/Kandamkulathi_09_Denzil_All_Phases.md).

## Collection procedure

1. Request exact approved sources, versions, reviewer identities and language coverage through the named owners. Do not copy credentials or patient content into fixtures, screenshots or logs.
2. Keep missing evidence Pending; route disputes over tax, medicine, permission or operating policy to the domain/company owner. Never substitute generated wording or guessed rules.
3. Hand synthetic invalid-row/control-total reports to Josin. Denzil does not write balances, execute imports or approve medical text.
4. Record source SHA, environment, build/configuration and exact test evidence for the integrated candidate. Tinu coordinates independent retests. No gate decision is recorded by this support register.
