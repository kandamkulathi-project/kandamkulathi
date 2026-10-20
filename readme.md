# Kandamkulathi Ayurveda Vaidyasala

A trusted Ayurvedic healthcare institution serving generations since 1847, dedicated to traditional Ayurvedic care, wellness, and holistic healing.

## Shared development baseline

This private repository contains the runnable starter and the complete reviewed implementation, member and QA documents. **Business features and all phase acceptance are Pending. This is not a production release.** No live accounts, deployment, charges, messages, AI responses or patient data are enabled.

P1-DEV-002 adds the [local client foundation](docs/development/CLIENT_FOUNDATION.md): shared client contracts/states, workspace session boundaries, native configuration/secure-storage/media adapters, editable Companion draft shell and bundled EN/ML/TA interface resources. [Native/provider readiness](docs/operations/NATIVE_READINESS.md) records the remaining physical-device, provider, cloud and company acceptance. This independent branch starts at fetched `dev`; P1-DEV-001 remains in its separate open PR.

**Security status:** the two high Expo-toolchain findings have committed local source patches, installed-file verification and regression tests; independent senior review is Pending. Targeted esbuild/uuid upgrades remove the two moderate findings. The raw registry audit still reports the original locally patched versions. Free SAST/secrets/Node checks and local commit hooks are configured; mandatory remote protection is blocked by GitHub plan eligibility despite admin access. See [security automation](docs/security/SECURITY_AUTOMATION.md) and [dependency remediation](docs/security/DEPENDENCY_RISKS.md); no phase or production approval is implied.

Use Node **24.22.0** and pnpm **10.34.7**. Python 3.13 runs documentation checks. Enable pnpm through Corepack if your Node installation includes it, or install the exact pnpm version using your approved package-manager setup.

```sh
git clone https://github.com/kandamkulathi-project/kandamkulathi.git
cd kandamkulathi
git switch dev
git pull --ff-only origin dev
git switch -c YOUR_ASSIGNED_BRANCH
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm dev
```

Use the exact branch in your [member plan](docs/implementation/INDEX.md) instead of the placeholder. Public preview: `http://127.0.0.1:4321`; workspace preview: `http://127.0.0.1:5173`; Core/Companion local APIs: ports `8787`/`8788`. Keep the command running; stop with Ctrl+C. Run `pnpm dev:mobile` in a separate terminal for Expo. See [Windows/mobile setup](docs/development/SETUP.md) before connecting devices.

```sh
pnpm verify
pnpm security:check
pnpm mobile:check
pnpm exec playwright install chromium
pnpm test:e2e
python scripts/check_repository.py
python -m unittest discover -s tests/repository -v
```

`pnpm verify` runs lint, all workspace typechecks, unit/HTTP tests, web builds, Android/iOS JavaScript exports and Worker dry builds. E2E additionally tests Chromium and actual local workerd. JavaScript export is not an installable signed native build or device proof. [Actual commands and limitations](docs/development/COMMANDS.md).

## Code ownership and team workflow

| Area | Code | Primary owner |
|---|---|---|
| Public web, workspaces, native and platform | `apps/web-public`, `apps/workspaces`, `apps/mobile`, `packages/ui` | Devadathan; bounded screens to Paul/Denzil through member plans |
| Core backend, database, Companion and provider boundaries | `apps/core-api`, `apps/companion`, `packages/database`, `packages/server`, `packages/providers` | Mathew; independent Devadathan review |
| Commerce domain | `packages/domain` and scoped Core/client modules | Josin; Mathew reviews money/stock/permissions |
| Locales, content/admin presentation and guides | `packages/i18n`, scoped workspace/public screens | Denzil with approved adapters/content |
| Customer presentation/device support | Scoped public/workspace/native screens | Paul under Devadathan's interfaces |
| QA and independent retests | `tests`, canonical case/evidence documents | Tinu coordinates; all owners test their work |

Feature branch from latest `dev` → reviewed PR into `dev` → broad phase testing → reviewed phase promotion to `main`. Never develop directly on shared branches. The one-time initial starter publication is [recorded separately](docs/architecture/adr/0004-initial-team-baseline.md); it does not count as G1. CI never deploys the app.

## Required reading

Start with [AGENTS.md](AGENTS.md), [setup](docs/development/SETUP.md), [starter status and next work](docs/development/STARTER_STATUS.md), [Git workflow](docs/development/GIT_WORKFLOW.md), and [the twelve reviewed plans](docs/implementation/INDEX.md). All [38 company requirements](docs/requirements/COMPANY_REQUIREMENTS.md), six members and [Tinu's full tests](docs/implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md) remain unchanged.

Architecture: Workers Paid/Hono/TypeScript/Zod, Neon PostgreSQL 17/Drizzle, WorkOS, Astro/React, React/Vite and Expo/React Native. No D1 migration is introduced. The database package currently declares namespaces only. Provider, RLS, clinical, financial, native SDK and deployment work remains assigned in the plans.

Never commit secrets, patient data or signing material. See [security](SECURITY.md), [documentation index](docs/README.md) and [remote settings checklist](docs/governance/REPOSITORY_SETTINGS.md). Active CODEOWNERS, protected-branch settings and company/provider approvals still require their named owners; example files do not enforce them.
