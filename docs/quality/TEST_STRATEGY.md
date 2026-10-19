# Test strategy and traceability

**Canonical specification:** [Tinu's detailed cases](../implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md). It contains 20 P1 +36 P2 +30 P3 groups and 38 F-R walkthroughs. Do not fork it into member-specific independent expected results. IDs are stable; each listed variant/step requires a real run record, not one broad Pass for a compound case.

## Ownership and layers

Tinu coordinates/executes independent QA and has no critical product feature. All six test; Mathew/Devadathan operate security/load/recovery, Josin reconciles money/stock, Paul/Denzil cover bounded client/content/report cases, and company physicians/finance/privacy supply approved oracles. Actual app harness commands are Pending; see [command status](../development/COMMANDS.md).

- Unit/domain: price/eligibility/state/format/translation selection with approved fixtures.
- Contract/integration: real PostgreSQL transactions/constraints/RLS/pool cleanup, signed provider callbacks, outbox/lease/replay/uncertain results, current tool confirmations, private object/room access.
- End-to-end: required web/staff/physician/Android/iOS/WhatsApp journeys, real devices/SDK/provider proof, locales/accessibility/failure/resume.
- Clinical/adversarial: 120 EN/ML/TA +40 additional/Romanized approved cases, stale/missing blocks/intake/red flags/injection/tools/handoff, final critical repetitions three times.
- Nonfunctional: final stated sustained/burst/soak, video/model concurrency, healthy job pickup/deadline recovery, security/manual abuse, timed PITR/independent restore/rollback and company/public handover.

## Campaigns and gates

G1 current foundation only; G2 full functional features and complete signed native candidates; G3 paid intended configuration, full cumulative acceptance, real public channels and handover. G1/G2 protect final four V hours each for all six plus Tinu's eight earlier V hours per phase. Phase 3 has 80 total team V hours; actual execution/operators must fit. Begin continuous testing early, use valid shared evidence/automation and reforecast if timed execution does not fit.

Freeze exact SHA/artifacts/schema/config/provider/model/prompt/KB. A meaningful change invalidates impacted results; independent retest critical fixes and rerun relevant cumulative checks. No lowered expected result or skipped required path to meet a calendar. No unresolved critical/high security or safety/privacy/financial/acceptance blocker. Sampled tests do not prove no possible defect.

Use deterministic synthetic scoped fixtures, approved clinical/finance expected values and actual endpoint/UI/environment manifests. Never invent therapeutic doses/tax rates/policy/URLs or use real patients in load/security tests. Mark unavailable prerequisites Blocked. Protect measured load/soak windows from unrelated fault/restore/reset/deploy work; verified resource-isolated targets or serialization is required.

Track `R -> output/named package -> PR/candidate -> case/step/variant -> actual evidence -> defect/fix/retest -> company/public acceptance`. Keep restricted raw evidence outside Git; version templates/manifests/redacted summaries only. All status starts Pending. [Acceptance register](../requirements/ACCEPTANCE_REGISTER.md), [gate report](GATE_REPORT_TEMPLATE.md), [defect template](DEFECT_TEMPLATE.md).
