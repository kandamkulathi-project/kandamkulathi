# ADR 0004: Initial shared starter publication

**Date:** 2026-10-19. **Status:** Accepted for the one-time user-authorized bootstrap only; no phase/domain/security approval is asserted. **Owners:** Devadathan/Mathew for subsequent review and implementation.

## Context and decision

The human explicitly requested a basic codebase published to GitHub `main`, with `dev` based on that same starting point so all six members can create their assigned feature branches. Before the bootstrap, remote `main` and `dev` contained only the initial README commit. The repository is private. Existing reviewed documentation is included as previously requested; original confidential PDFs and secrets are excluded.

Prepare the starter on `chore/initial-team-baseline`, validate it locally, then fast-forward/push `main` and `dev` to the same baseline only when remote ancestry permits. Never force-push or discard team commits. If protection prevents direct initial publication, use a PR and preserve required review. This narrowly scoped initial publication is separate from phase promotion: **it is not G1 Pass, public deployment or production readiness**. All subsequent work follows assigned feature branches → reviewed `dev` PRs → broad phase testing → reviewed `main` promotion.

## Result and limitations

Establish five client/API applications, shared contracts/domain/database/provider/UI/locale/HTTP packages, supported pinned tools, a lockfile and real application CI in the same change as the transition from documentation-only checks. Keep all company requirements and six-member ownership unchanged. Production/business features, real database/security/provider/native/recovery proofs remain Pending. No deployment workflow, real secrets, billing/resource provisioning or live side effects are authorized by this bootstrap.

Exact local verification and published branch heads are reported at completion; CI is observed separately and must not be assumed passed from file creation. [Starter status](../../development/STARTER_STATUS.md), [commands](../../development/COMMANDS.md), [Git workflow](../../development/GIT_WORKFLOW.md).
