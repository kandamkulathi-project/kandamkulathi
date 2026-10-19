# Security checks and merge enforcement

The application stack, company requirements, phase gates and member assignments are unchanged. These controls check the current candidate; they do not grant production acceptance or establish an absence of vulnerabilities. See also the prepared [GitHub protection payload](../../.github/branch-protection.json).

## Free scanners and their scope

- **SAST:** [Opengrep](https://github.com/opengrep/opengrep), v1.31.0, scans `apps`, `packages`, `scripts` and `.github` for JavaScript/TypeScript, React, Astro raw-HTML bindings, Python and workflow weaknesses. The vendored rules and five project rules cover code execution, HTML/XSS sinks, raw SQL interpolation, disabled TLS and Hono request-to-sink flows. All reported severities block. Parsing/configuration errors and timeouts fail; inline `nosemgrep` comments cannot suppress findings. Generated artifacts and test-only synthetic attack fixtures are outside the normal source targets; executable attack-fixture tests verify detection separately.
- **Secrets:** [Gitleaks CLI](https://github.com/gitleaks/gitleaks), v8.30.1, scans complete fetched Git history and an exported Git index. Local commits scan the complete index, including forced tracked ignored files. Output redacts credentials completely. No project baseline, ignore fingerprints or inline allow comments are accepted. A historical real secret requires rotation and an owner-led incident/history remediation; deleting its latest file is insufficient.
- **Dependencies:** `pnpm security:check` obtains the complete current registry report. Every unremediated advisory, including low/moderate, blocks. Two exact existing local source patches require installed-source/patch/advisory fingerprints and real regressions; they are visible in the raw report, not ignored. [Dependency risks and evidence](DEPENDENCY_RISKS.md).
- **Node:** `pnpm security:runtime` checks the actual and pinned Node version against the live official [security database](https://github.com/nodejs/security-wg/tree/main/vuln/core), [release feed](https://nodejs.org/dist/index.json) and [support schedule](https://github.com/nodejs/Release). Unpatched advisories, a newer security release in the same major, EOL, malformed/unavailable feeds and mismatched/unpublished pins fail. Advisory feeds can lag disclosure; manual security review and updates remain necessary. The deployed APIs run on Workers; Node remains part of local/build tooling.

Scanner artifacts and executable SHA-256 values are committed in `.security/tools.json`. Downloads come from exact official GitHub releases; downloaded bytes and every cached executable are verified before use. Windows x64, Linux x64/arm64 and macOS x64/arm64 are configured. Windows includes `tar`; other platforms need `tar` on PATH. Cached tools are private ignored `.local-data` files. Read-only HTTPS downloads/official feeds retry disconnected or truncated connections and HTTP 429/5xx up to three attempts with bounded delays. Permanent HTTP rejection, exhausted retries, checksum mismatch, invalid scan/feed content and security findings still fail; there is no cached-success fallback.

Rules are vendored from the exact commit in `.security/sast/vendor-manifest.json` and checked against committed hashes, so scans do not download changing remote rule packs or upload code to a scanner service. Upstream rule attribution and LGPL 2.1 with Commons Clause conditions are retained in the vendor license; these rules are free for this project's internal scanning. Do not sell the rule engine/rules as a scanning service without reviewing their licenses. Rule/tool updates need a reviewed PR, changed pins/hashes and detection tests; never automatically regenerate approvals from a failed scan.

## Local commit gate

Use the pinned Node/pnpm versions, install dependencies and the pinned Chromium browser, then install hooks:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm hooks:install
```

`pnpm install` also installs the hook through `prepare` on a local checkout; CI skips local hook installation. Each clone/worktree needs its own setup. Existing custom/active hooks are not overwritten: integrate them deliberately. The local pnpm entry is recorded in ignored `.local-data/pnpm-entry.json`; reinstall hooks after moving/changing the pnpm installation. Git IDE clients must use the pinned Node on PATH.

The `.githooks/pre-commit` gate refuses commits on `dev`/`main`, detached commits, unstaged tracked changes and unrelated untracked files. Stage intended files and move unrelated work first; it never stashes or deletes developers' changes. It runs lint/type/unit/security/build verification, actual scanner detection tests, SAST, indexed-file secrets, current Node/dependency checks, Expo compatibility, browser/Worker E2E and documentation tests. It checks again that tools did not modify tracked inputs. Stop development servers occupying E2E ports. Network access is required for live advisories and first scanner/browser installation. Run `pnpm precommit` to diagnose failures.

Local Git hooks are bypassable and cannot supply server enforcement. Never use a bypass to integrate failing changes. CI repeats security checks independently.

## PR and scheduled checks

PRs targeting `dev`/`main`, pushes to those branches and manual runs execute the application/documentation/security workflows. The security workflow has no path filters or privileged `pull_request_target`, uses read-only permissions and pinned actions, and has no deployment/scanner-service secrets. Required check names are `application-checks`, `dependency-audit`, `repository-docs`, `sast`, `secret-scanning`, `runtime-security`.

At **02:23 UTC / 07:53 IST daily**, the security workflow independently checks both `dev` and `main` for SAST, secrets, Node and dependencies, retaining full dependency audit JSON for seven days. It checks each branch's own committed policy/scripts and reports a failure if a branch lacks the controls; it does not silently test another branch. Scheduled security runs do not execute the complete application build/E2E campaign. GitHub schedules can be delayed and only start from the default branch. **The schedule is not active until this workflow is merged into `main`.** Dependabot weekly npm/action update PR configuration likewise needs to reach the default branch; PR targets are `dev`. Updates remain reviewed and never auto-merge. Source-patched dependencies need deliberate patch removal when upstream fixes supersede them.

Repository maintainers must enable GitHub Actions failure notifications for workflow runs they monitor and check scheduled-run history. No external email/Slack message, paid monitoring or guaranteed notification routing has been configured. Free tools add no scanner subscription; GitHub-hosted runner use consumes the private repository's included Actions minutes. Keep an owner-controlled spending cap; exceeding included minutes can stop checks rather than permit a merge.

## Remote enforcement — currently blocked

On 2026-10-19 the API reported WRITE access without ADMIN, unprotected `dev`/`main`, and HTTP 403: `Upgrade to GitHub Pro or make this repository public to enable this feature.` During publication GitHub reported an owner transfer to the now organization-owned private repository `kandamkulathi-project/kandamkulathi`; this change did not alter visibility or our permissions. Rechecking both canonical protection endpoints returned HTTP 404, and the rulesets endpoint still returned the entitlement error. GitHub's [protected-branch availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) requires an eligible organization plan such as Team/Enterprise for private organization repositories. The API's generic Pro wording does not establish organization eligibility. No visibility change, paid upgrade, credential replacement or merge bypass was performed. Hooks and a workflow cannot simulate server protection.

The reviewed candidate configuration is [branch-protection.json](../../.github/branch-protection.json). It requires all six contexts from the observed GitHub Actions app (15368), an up-to-date candidate, one independent approving review, stale-approval dismissal, last-push approval, conversation resolution and admin enforcement; force pushes/deletion are disabled. It permits merge commits for phase ancestry and does not invent CODEOWNERS handles. No production deployment is enabled.

After the repository owner obtains an eligible private-repository GitHub plan and uses an admin account, inspect existing policies, then apply the candidate to each shared branch:

```sh
gh api --method PUT repos/kandamkulathi-project/kandamkulathi/branches/dev/protection --input .github/branch-protection.json
gh api --method PUT repos/kandamkulathi-project/kandamkulathi/branches/main/protection --input .github/branch-protection.json
gh api repos/kandamkulathi-project/kandamkulathi/branches/dev/protection
gh api repos/kandamkulathi-project/kandamkulathi/branches/main/protection
```

The PUT replaces a classic rule: preserve or strengthen any policies an owner added after this candidate was prepared. Verify the actual check contexts from a successful PR, reviews and restrictions returned by GitHub. Test that a deliberately failing test PR is blocked, restore it, then verify a reviewed passing PR can merge. Never describe the payload/checklist alone as active protection. Until activation, an owner/team policy must refuse manual merges or direct pushes when a check is missing/failing, but this remains procedural and bypassable.

These security changes require independent senior review under `AGENTS.md` before merge. Merging infrastructure does not approve business features, phases or production release. Promote controls to `main` through a reviewed infrastructure PR so scheduling begins; business milestone promotion still follows the phase gates.
