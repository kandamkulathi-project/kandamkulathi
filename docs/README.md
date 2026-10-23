# Project documentation index

Start with [AGENTS](../AGENTS.md), [repository README](../readme.md) and [setup](development/SETUP.md). The runnable application starter and reviewed plans are versioned here. Business features, actual provider configuration and all phase acceptance remain Pending. See [starter status](development/STARTER_STATUS.md).

For the bounded Mathew backend candidates, implemented scope and remaining integration/approval work, see the [backlog handoff](development/MATHEW_BACKLOG_HANDOFF.md).

## Authority

1. Current human decisions and applicable instruction hierarchy; approved company requirements/policies.
2. [Master](implementation/Kandamkulathi_01_Master_Implementation_Plan_3_Phases.md): scope/architecture/acceptance and capacity.
3. [Phase 1](implementation/Kandamkulathi_02_Phase_1_Foundations_and_Core_Journeys.md), [Phase 2](implementation/Kandamkulathi_03_Phase_2_Complete_Features_and_Integration.md), [Phase 3](implementation/Kandamkulathi_04_Phase_3_Production_Verification_and_Launch.md): integrated outputs and named registers.
4. [Member plans](implementation/INDEX.md): named tasks, hours, exact branches, handoffs/review; no second independent allocation.
5. [Tinu's canonical test cases](implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md): single detailed execution source. Her member plan owns workload, not a duplicate test annex.
6. [Integrated review](implementation/Kandamkulathi_12_Integrated_Review_and_Consistency_Report.md): review corrections and remaining conditions.

[Requirements](requirements/COMPANY_REQUIREMENTS.md) and [acceptance register](requirements/ACCEPTANCE_REGISTER.md) mirror the master for navigation/tracking; update them with the master in one reviewed change. [ADRs](architecture/adr/0001-workers-neon.md) record decisions; a proposed ADR cannot silently override an accepted baseline. Historical files in [archive](archive/README.md) never govern execution.

## Engineering

- [Setup](development/SETUP.md), [commands/status](development/COMMANDS.md), [coding standards](development/CODING_STANDARDS.md), [API/event contracts](development/API_CONVENTIONS.md), [Git workflow](development/GIT_WORKFLOW.md), [contributing](../CONTRIBUTING.md).
- [Architecture](architecture/ARCHITECTURE.md), [data model/invariants](architecture/DATA_MODEL.md), [threat model](architecture/THREAT_MODEL.md), [decision record](architecture/adr/0001-workers-neon.md).
- [Test strategy](quality/TEST_STRATEGY.md), [Definition of Done](quality/DEFINITION_OF_DONE.md), [gate report](quality/GATE_REPORT_TEMPLATE.md), [defect template](quality/DEFECT_TEMPLATE.md).

## Security, operations and governance

- [Security reporting](../SECURITY.md), [automation and enforcement](security/SECURITY_AUTOMATION.md), [data handling](security/DATA_HANDLING.md), [secrets/access](security/ACCESS_AND_SECRETS.md), [security review](security/SECURITY_REVIEW_CHECKLIST.md).
- [Environments](operations/ENVIRONMENTS.md), [release](operations/RELEASE_RUNBOOK.md), [recovery](operations/BACKUP_AND_RECOVERY.md), [incidents](operations/INCIDENT_RESPONSE.md), [SLIs/SLOs](operations/OBSERVABILITY_AND_SLOS.md), [maintenance/handover](operations/MAINTENANCE_AND_HANDOVER.md).
- [Owners/decisions](governance/DECISIONS_AND_OWNERS.md), [GitHub settings](governance/REPOSITORY_SETTINGS.md), [external readiness](governance/EXTERNAL_READINESS_REGISTER.md), [provider manifest](templates/PROVIDER_ENVIRONMENT_MANIFEST.md), [model/KB manifest](templates/MODEL_KB_MANIFEST.md), [task template](templates/TASK_TEMPLATE.md).

Run `python scripts/check_repository.py` from the repository root. It checks documentation/governance consistency only; application verification runs separately through the actual [application workflow](../.github/workflows/application.yml). Root `.github/workflows/documentation.yml` is not a deployment pipeline. Remote protections, active CODEOWNERS and provider secrets are not enabled by these files.
