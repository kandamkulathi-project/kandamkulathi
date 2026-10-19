# Local setup and team onboarding

## Prerequisites

Install Git, Node **24.22.0**, pnpm **10.34.7** and Python **3.13**. Exact Node/package-manager pins are in `.node-version`, `.nvmrc` and root `package.json`. Engine checks reject unsupported versions. Use an approved Node version manager; the scaffold does not change your global runtime. If pnpm is absent, an approved installation is `npm install --global pnpm@10.34.7`. No Cloudflare/Neon/WorkOS/OpenAI account or credential is needed for the local starter.

## First checkout

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

Replace the placeholder with your exact [phase/member branch](../implementation/INDEX.md). If already cloned, inspect `git status` first, preserve your work, fetch, switch to `dev` and pull with `--ff-only`. Do not reset/discard changes to make these commands work. Package installation requires Internet access; first local Worker start may ask for Windows firewall permission. Keep local servers bound to loopback.

| Service | Local URL | Individual command |
|---|---|---|
| Astro public preview | `http://127.0.0.1:4321` | `pnpm dev:public` |
| React workspace preview | `http://127.0.0.1:5173` | `pnpm dev:workspaces` |
| Core Worker | `http://127.0.0.1:8787/health/live` | `pnpm dev:core` |
| Companion Worker | `http://127.0.0.1:8788/health/live` | `pnpm dev:companion` |

`pnpm dev` starts those four services and stops all when one exits. Ctrl+C stops the session. The public/workspace previews are development screens, not completed customer/staff flows. `/health/ready` intentionally returns 503 until application readiness is implemented. No `.env` copy is required or loaded by the starter. Empty `.env.example` documents the future inventory only; supplying keys cannot enable missing adapters.

## Mobile

Run `pnpm dev:mobile`. Use a compatible Expo Go for baseline preview where supported; production development builds and actual Android/iOS SDK proofs remain Devadathan's P1 work. Android emulator requires Android Studio; iOS simulator/native builds require macOS/Xcode. This Windows checkout cannot prove iOS native operation. A physical device needs permitted LAN access to Metro; do not expose local APIs publicly or use production records. No API URL is embedded in the starter mobile bundle.

`pnpm mobile:check` checks Expo dependency compatibility and public configuration. `pnpm --filter @kandamkulathi/mobile build` exports Android/iOS JavaScript; it does not compile, sign, submit or install a native app. Bundle/application IDs, signing, development-build profiles and real-device procedures require company accounts and must be added deliberately.

## Validation before PR

Local install also enables the pre-commit hook. It runs full app/security/browser/docs checks and requires a clean staged working tree on a feature branch. Existing custom hooks are preserved and require deliberate integration. See [security automation](../security/SECURITY_AUTOMATION.md) for tool/browser setup, supported platforms, live-feed Internet requirements and blocked remote enforcement. Run `pnpm hooks:install` after moving or changing the local pnpm installation; run `pnpm precommit` to diagnose a failure. Local hooks are bypassable and do not replace server policies.

```sh
pnpm verify
pnpm mobile:check
pnpm security:check
pnpm exec playwright install chromium
pnpm test:e2e
python scripts/check_repository.py
python -m unittest discover -s tests/repository -v
git diff --check
```

Linux may require `pnpm exec playwright install --with-deps chromium`; CI uses that form. E2E owns ports 4321/5173/8787/8788 and refuses reuse; stop `pnpm dev` first. Tests use synthetic local requests and make no real provider/database calls. Installation applies the committed exact-version security patches; `pnpm security:check` verifies actual source and retains the raw registry report. Plain `pnpm audit --audit-level high` remains available and currently flags the original versions despite local source fixes; see [dependency remediation](../security/DEPENDENCY_RISKS.md). Never add ignore IDs or refresh hashes simply to get a green result. [Command registry](COMMANDS.md) describes precisely what is covered and still Pending.

## Next foundation work

Mathew establishes real Neon PostgreSQL 17 driver/transaction/RLS/migration proofs and WorkOS identity; Devadathan establishes device/provider SDKs, preview/staging/deployment configuration and approved UI components. Confirm source/licensing, approved designs and company reviewers. Follow [starter status](STARTER_STATUS.md) and assigned plans. Do not derive a greenfield ten-day feasibility claim from this starter.

Keep migration/admin credentials separate from runtime, with no server secrets in frontend/native bundles. Never upload a whole local environment into a Worker. [Access/secrets](../security/ACCESS_AND_SECRETS.md).
