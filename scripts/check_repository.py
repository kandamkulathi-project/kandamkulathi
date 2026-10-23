#!/usr/bin/env python3
"""Read-only documentation/bootstrap checks. This is not application verification."""
from __future__ import annotations

import os
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
PLAN = ROOT / 'docs' / 'implementation'
SKIP_DIRS = {'.git', 'node_modules', '.venv', '__pycache__', 'dist', 'build',
             '.wrangler', '.expo', '.next', '.pnpm-store', 'coverage', '.astro', '.vite',
             '.local-data', 'test-results', 'playwright-report', 'private-evidence', 'backups', 'exports'}
REQ_IDS = {f'R{i:02}' for i in range(1, 39)}
CASE_COUNTS = {1: 20, 2: 36, 3: 30}
MEMBERS = {'MAT': 'Mathew', 'JOS': 'Josin', 'DEV': 'Devadathan',
           'PAU': 'Paul', 'DEN': 'Denzil', 'TIN': 'Tinu'}
MEMBER_DOCUMENTS = {
    'MAT': 'Kandamkulathi_05_Mathew_All_Phases.md',
    'JOS': 'Kandamkulathi_06_Josin_All_Phases.md',
    'DEV': 'Kandamkulathi_07_Devadathan_All_Phases.md',
    'PAU': 'Kandamkulathi_08_Paul_All_Phases.md',
    'DEN': 'Kandamkulathi_09_Denzil_All_Phases.md',
    'TIN': 'Kandamkulathi_10_Tinu_QA_and_Test_Cases_All_Phases.md',
}
ALLOCATION = {
    1: {'MAT': (18, 4, 0, 2), 'JOS': (17, 4, 1, 2), 'DEV': (17, 4, 1, 2),
        'PAU': (16, 4, 2, 2), 'DEN': (16, 4, 2, 2), 'TIN': (8, 12, 2, 2)},
    2: {'MAT': (18, 4, 0, 2), 'JOS': (18, 4, 0, 2), 'DEV': (18, 4, 0, 2),
        'PAU': (17, 4, 1, 2), 'DEN': (17, 4, 1, 2), 'TIN': (8, 12, 2, 2)},
    3: {'MAT': (7, 12, 6, 7), 'JOS': (7, 12, 6, 7), 'DEV': (8, 10, 7, 7),
        'PAU': (6, 13, 7, 6), 'DEN': (6, 13, 7, 6), 'TIN': (2, 20, 3, 7)},
}
REQUIRED = [
    'AGENTS.md', 'readme.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md',
    '.gitignore', '.gitattributes', '.editorconfig', '.env.example', '.python-version',
    'docs/README.md', 'docs/implementation/INDEX.md', 'docs/archive/README.md',
    'docs/requirements/COMPANY_REQUIREMENTS.md', 'docs/requirements/ACCEPTANCE_REGISTER.md',
    'docs/requirements/SOURCE_MANIFEST.md', 'docs/architecture/ARCHITECTURE.md',
    'docs/architecture/DATA_MODEL.md', 'docs/architecture/THREAT_MODEL.md',
    'docs/development/SETUP.md', 'docs/development/COMMANDS.md',
    'docs/development/GIT_WORKFLOW.md', 'docs/development/CODING_STANDARDS.md',
    'docs/quality/TEST_STRATEGY.md', 'docs/quality/DEFINITION_OF_DONE.md',
    'docs/security/DATA_HANDLING.md', 'docs/security/ACCESS_AND_SECRETS.md',
    'docs/operations/RELEASE_RUNBOOK.md', 'docs/operations/BACKUP_AND_RECOVERY.md',
    'docs/operations/INCIDENT_RESPONSE.md', 'docs/operations/OBSERVABILITY_AND_SLOS.md',
    'docs/operations/MAINTENANCE_AND_HANDOVER.md',
    'docs/governance/REPOSITORY_SETTINGS.md', 'docs/governance/EXTERNAL_READINESS_REGISTER.md',
    '.github/workflows/documentation.yml', '.github/PULL_REQUEST_TEMPLATE.md',
]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def check_env_example(example: str) -> None:
    public_defaults = {'APP_ENV': 'local', 'RESOURCE_NAMESPACE': 'kandamkulathi-local',
                       'PROVIDER_MODE': 'stub', 'ALLOW_LIVE_SENDS': 'false',
                       'ALLOW_LIVE_PAYMENTS': 'false'}
    for line in example.splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = (part.strip() for part in line.split('=', 1))
            require(value == public_defaults.get(key, ''),
                    '.env.example must use exact safe public defaults and empty secrets')


def files_under(root: Path) -> list[Path]:
    paths = []
    for current, folders, names in os.walk(root):
        folders[:] = [name for name in folders if name not in SKIP_DIRS]
        paths.extend(Path(current)/name for name in names)
    return paths


def exact_path_exists(path: Path) -> bool:
    """Detect Windows-hidden filename-case mistakes before Linux CI."""
    try:
        parts = path.relative_to(ROOT).parts
        path.resolve().relative_to(ROOT.resolve())
    except ValueError:
        return False
    cursor = ROOT
    for name in parts:
        if not cursor.is_dir() or name not in {p.name for p in cursor.iterdir()}:
            return False
        cursor = cursor / name
    return cursor.exists()


def prose_only(text: str) -> str:
    result = []
    fence = None
    for line in text.splitlines():
        match = re.match(r'^\s*(`{3,}|~{3,})', line)
        if match:
            token = match[1][0]
            if fence is None:
                fence = token
            elif fence == token:
                fence = None
            continue
        if fence is None:
            result.append(line)
    require(fence is None, 'Unclosed Markdown code fence')
    return '\n'.join(result)


def check_markdown(path: Path) -> None:
    text = path.read_text(encoding='utf-8')
    require('\ufffd' not in text, f'{path.relative_to(ROOT)}: replacement encoding character')
    prose = prose_only(text)
    width = None
    for line in prose.splitlines():
        if line.startswith('|') and line.endswith('|'):
            count = len(re.split(r'(?<!\\)\|', line))
            if width is None:
                width = count
            require(width == count, f'{path.relative_to(ROOT)}: inconsistent Markdown table')
        else:
            width = None
    for raw in re.findall(r'\[[^\]\n]*\]\(([^)\n]+)\)', prose):
        target = raw.strip().strip('<>')
        if not target or target.startswith('#'):
            continue
        parsed = urlsplit(target)
        if parsed.scheme or parsed.netloc:
            require(not re.match(r'^[A-Za-z]:[\\/]', target),
                    f'{path.relative_to(ROOT)}: developer-specific absolute link')
            continue
        # abspath normalizes '..' while preserving the spelling needed for case checks.
        local = Path(os.path.abspath(path.parent / unquote(parsed.path)))
        require(exact_path_exists(local),
                f'{path.relative_to(ROOT)}: missing/case-mismatched local link: {target}')


def requirement_rows(text: str) -> dict[str, list[str]]:
    result = {}
    for line in text.splitlines():
        fields = [f.strip() for f in line.split('|')]
        if len(fields) > 2 and fields[1] in REQ_IDS:
            require(fields[1] not in result, f'Duplicate requirement row {fields[1]}')
            result[fields[1]] = fields
    return result


def secret_findings(text: str) -> list[str]:
    """Deliberately limited obvious-pattern check; never print a matched value."""
    patterns = {
        'private key material': r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
        'possible provider secret': r'\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}',
        'possible GitHub token': r'\bgh[pousr]_[A-Za-z0-9]{25,}',
        'possible AWS access key': r'\bAKIA[0-9A-Z]{16}\b',
    }
    return [name for name, pattern in patterns.items() if re.search(pattern, text)]


def bootstrap_source_findings(paths: list[Path]) -> list[str]:
    source_extensions = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.sql', '.prisma',
                         '.go', '.rs', '.java', '.kt', '.swift', '.dart', '.vue',
                         '.svelte', '.html', '.css', '.scss'}
    app_roots = {'apps', 'packages', 'workers', 'services', 'src', 'api'}
    app_manifests = {'package.json', 'pyproject.toml', 'requirements.txt', 'Cargo.toml',
                     'go.mod', 'Dockerfile', 'wrangler.toml', 'wrangler.json', 'wrangler.jsonc'}
    found = []
    for path in paths:
        rel = path.relative_to(ROOT)
        if rel.parts[0] in {'docs', '.github'}:
            continue
        repository_python = rel.parts[0] == 'scripts' or rel.parts[:2] == ('tests', 'repository')
        app_python = path.suffix.lower() == '.py' and not repository_python
        app_content = rel.parts[0] in app_roots and path.suffix.lower() != '.md' and path.name != '.gitkeep'
        if path.name in app_manifests or path.suffix.lower() in source_extensions or app_python or app_content:
            found.append(rel.as_posix())
    return found


def member_plan_paths() -> dict[str, Path]:
    # Tinu also owns document 11; broad name globs depend on filesystem ordering.
    return {code: PLAN/name for code, name in MEMBER_DOCUMENTS.items()}


def check_package_traceability(tid: str, section: str, outputs: set[str]) -> tuple[set[str], set[str]]:
    """Check explicit links, not whether the package or its approvals are complete."""
    lines = re.findall(r'^\*\*Traceability:\*\* (.+)$', section, re.M)
    require(len(lines) == 1, f'{tid}: expected one traceability record')
    require(lines[0].count('Requirements:') == lines[0].count('Outputs:') == 1,
            f'{tid}: missing/malformed duplicate traceability fields')
    match = re.fullmatch(
        r'.+ Requirements: (R\d{2}(?:, R\d{2})*)\. '
        r'Outputs: (P[123]-O\d{2}(?:, P[123]-O\d{2})*)\.', lines[0])
    require(match is not None, f'{tid}: missing/malformed requirement/output links')
    requirements = set(match[1].split(', '))
    linked_outputs = set(match[2].split(', '))
    require(requirements <= REQ_IDS, f'{tid}: unknown requirement link')
    require(linked_outputs <= outputs, f'{tid}: unknown or wrong-phase output link')
    return requirements, linked_outputs


def check_plans() -> tuple[int, int]:
    current = sorted(PLAN.glob('Kandamkulathi_[0-9][0-9]_*.md'))
    require(len(current) == 12, 'Expected the 12 reviewed current documents')
    master = next(PLAN.glob('Kandamkulathi_01_*.md')).read_text(encoding='utf-8')
    mr = requirement_rows(master)
    require(set(mr) == REQ_IDS, 'Master must retain all R01–R38')
    derived = requirement_rows((ROOT/'docs/requirements/COMPANY_REQUIREMENTS.md').read_text(encoding='utf-8'))
    register = requirement_rows((ROOT/'docs/requirements/ACCEPTANCE_REGISTER.md').read_text(encoding='utf-8'))
    require(set(derived) == set(register) == REQ_IDS, 'Requirement/status register coverage mismatch')
    for rid in REQ_IDS:
        require(derived[rid][1:6] == mr[rid][1:6], f'{rid}: derived scope drift')
        require(register[rid][2] == mr[rid][4], f'{rid}: acceptance owner drift')
        require(register[rid][3] == mr[rid][5], f'{rid}: due milestone drift')
        if register[rid][5] == 'Passed':
            require('No executed' not in register[rid][6] and register[rid][6],
                    f'{rid}: Passed without an evidence reference')

    branches = set()
    named = set()
    legacy = set()
    member_paths = member_plan_paths()
    for phase in (1, 2, 3):
        phase_path = next(PLAN.glob(f'Kandamkulathi_0{phase+1}_Phase*'))
        text = phase_path.read_text(encoding='utf-8')
        outputs = set(re.findall(r'^\| (P[123]-O\d{2}) \|', text, re.M))
        master_outputs = set(re.findall(rf'^\| (P{phase}-O\d{{2}}) \|', master, re.M))
        require(outputs == master_outputs and bool(outputs), f'Phase {phase}: output ID drift')
        scope = text.split('## 4. Capacity and exact work-package register', 1)[1].split('## 5.', 1)[0]
        actual = {}
        totals = {c: [0, 0, 0, 0] for c in MEMBERS}
        for row in scope.splitlines():
            f = [v.strip() for v in row.split('|')]
            if len(f) < 7 or not re.match(r'P[123]-[A-Z]{3}-\d{3} —', f[1]):
                continue
            tid = f[1].split(' —')[0]
            code = tid.split('-')[1]
            branch = f[5].strip('`')
            require(code in MEMBERS and f[2] == MEMBERS[code], f'{tid}: named owner mismatch')
            require(tid not in named and branch not in branches, f'{tid}: duplicate package/branch')
            require(re.fullmatch(r'(feature|test|chore|fix)/p[123]-[a-z0-9-]+', branch) is not None,
                    f'{tid}: invalid planned branch syntax')
            require(f[3] in 'BVEC' and len(f[3]) == 1, f'{tid}: invalid category')
            hours = int(f[4])
            require(hours > 0, f'{tid}: nonpositive allocation')
            totals[code]['BVEC'.index(f[3])] += hours
            actual[tid] = (code, hours, branch)
            named.add(tid)
            branches.add(branch)
            legacy.update(re.findall(r'P[123]-E[1-6]-\d{3}', f[6]))
        for code, expected in ALLOCATION[phase].items():
            require(tuple(totals[code]) == expected, f'Phase {phase}/{code}: capacity drift')
        for row in text.splitlines():
            if re.match(r'^\| R\d{2} — ', row):
                f = [v.strip() for v in row.split('|')]
                rid = f[1][:3]
                require(f[2] == mr[rid][3] and f[3] == mr[rid][4],
                        f'Phase {phase}/{rid}: acceptance/owner drift')
                require(all(tid in actual for tid in re.findall(r'P[123]-[A-Z]{3}-\d{3}', f[5])),
                        f'Phase {phase}/{rid}: unowned package reference')
        for tid, (code, hours, branch) in actual.items():
            member = member_paths[code].read_text(encoding='utf-8')
            require(f'### {tid} — ' in member, f'{tid}: missing member task')
            section = member.split(f'### {tid} — ', 1)[1].split('\n### ', 1)[0]
            require(f'**Allocated time:** {hours} hours' in section and f'`{branch}`' in section,
                    f'{tid}: member hour/branch drift')
            check_package_traceability(tid, section, outputs)
        # Compare daily category slices as written in phase and member documents.
        day_text = text.split('## 5. Daily sequencing and handoff timing', 1)[1].split('## 6.', 1)[0]
        phase_days = {}
        for row in day_text.splitlines():
            f = [v.strip() for v in row.split('|')]
            if len(f) > 3 and f[1] in MEMBERS.values():
                phase_days[f[1]] = [tuple(map(int, cell.split(' / '))) for cell in f[2:-1]]
        for code, name in MEMBERS.items():
            member = member_paths[code].read_text(encoding='utf-8')
            section = member.split(f'## Phase {phase}:', 1)[1].split('\n## Phase ', 1)[0]
            days = []
            for row in section.splitlines():
                if re.match(r'^\| Day \d+ \|', row):
                    f = [v.strip() for v in row.split('|')]
                    days.append(tuple(map(int, f[2:6])))
            require(days == phase_days.get(name), f'{name}/P{phase}: daily schedule mismatch')
            require(all(sum(day) == 8 for day in days), f'{name}/P{phase}: day exceeds capacity')
            require(tuple(sum(day[i] for day in days) for i in range(4)) == ALLOCATION[phase][code],
                    f'{name}/P{phase}: daily categories do not reconcile')
            if phase < 3:
                require(days[-1][1] >= 4, f'{name}/P{phase}: protected testing lost')
    require(len(named) == len(branches) == 109 and len(legacy) == 103,
            'Reviewed package/branch/source-reference inventory drift; update reviewed baseline intentionally')
    git = shutil.which('git')
    if git:
        for branch in branches:
            result = subprocess.run([git, 'check-ref-format', '--branch', branch],
                                    capture_output=True, text=True, check=False)
            require(result.returncode == 0, 'Invalid planned Git branch name')
    qa = next(PLAN.glob('Kandamkulathi_11_*.md')).read_text(encoding='utf-8')
    for phase, count in CASE_COUNTS.items():
        actual = re.findall(rf'^### (P{phase}-T\d{{2}}) — ', qa, re.M)
        require(actual == [f'P{phase}-T{i:02}' for i in range(1, count+1)],
                f'Phase {phase}: canonical case ID drift')
    require(set(re.findall(r'^### F-(R\d{2}) — ', qa, re.M)) == REQ_IDS,
            'Every requirement needs its dedicated acceptance walkthrough')
    tinu = member_paths['TIN'].read_text(encoding='utf-8')
    require(not re.search(r'^#### P[123]-T\d{2}', tinu, re.M), 'Duplicate embedded test annex')
    history = list((ROOT/'docs/archive').glob('Kandamkulathi_Production_Implementation_Plan*.md'))
    require(len(history) == 4 and all('**SUPERSEDED — historical architecture only**' in
            f.read_text(encoding='utf-8') for f in history), 'Historical alternatives need clear status')
    return len(named), len(branches)


def check_application_contract() -> None:
    """Validate CI wiring only; the separate application job actually executes it."""
    for rel in ('package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', '.node-version',
                '.github/workflows/application.yml', 'vitest.config.ts', 'playwright.config.ts',
                'security-remediations.json', 'scripts/security/check.mjs',
                'scripts/security/policy.mjs', 'tests/security/policy.test.mjs',
                'tests/security/toolchain.test.mjs', 'patches/node-forge@1.4.0.patch',
                'patches/braces@3.0.3.patch',
                'tests/unit/money.test.ts', 'tests/integration/http.test.ts',
                'tests/e2e/starter.spec.ts'):
        require(exact_path_exists(ROOT/rel), f'Application scaffold requires {rel}')
    package = json.loads((ROOT/'package.json').read_text(encoding='utf-8'))
    require(package.get('private') is True and package.get('packageManager', '').startswith('pnpm@'),
            'Application must be private with a pinned package manager')
    scripts = package.get('scripts', {})
    for command in ('lint', 'typecheck', 'test', 'test:security', 'security:check', 'build', 'verify', 'test:e2e', 'mobile:check', 'test:platform'):
        require(scripts.get(command) and not re.search(r'\becho\b|\|\|\s*true', scripts[command]),
                f'Missing/placeholder application command: {command}')
    for name in ('web-public', 'workspaces', 'mobile', 'core-api', 'companion'):
        require(exact_path_exists(ROOT/f'apps/{name}/package.json'), f'Missing application: {name}')
    workflow = (ROOT/'.github/workflows/application.yml').read_text(encoding='utf-8')
    for command in ('pnpm install --frozen-lockfile', 'pnpm verify', 'pnpm mobile:check',
                    'pnpm security:check', 'pnpm exec playwright test', 'pnpm test:platform'):
        require(command in workflow, f'Application CI must execute {command}')
    repository = 'https://apt.postgresql.org/pub/repos/apt'
    signed_key = 'signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc'
    require(repository in workflow and signed_key in workflow and
            'https://www.postgresql.org/media/keys/ACCC4CF8.asc' in workflow and
            'apt-get install --yes postgresql-client-17' in workflow and
            workflow.index(repository) < workflow.index('apt-get install --yes postgresql-client-17') and
            not re.search(r'trusted\s*=\s*yes|--allow-unauthenticated', workflow),
            'PostgreSQL 17 client fallback requires its official signed repository before installation')
    security_path = ROOT/'.github/workflows/security.yml'
    require(exact_path_exists(security_path), 'Security workflow is required')
    security = security_path.read_text(encoding='utf-8')
    for command in ('pnpm test:security:scanners', 'pnpm security:sast',
                    'node scripts/security/scan.mjs secrets', 'pnpm security:runtime',
                    'pnpm security:check'):
        require(command in security, f'Security CI must execute {command}')
    require('schedule:' in security and 'fetch-depth: 0' in security,
            'Scheduled security and complete secret-history fetch are required')
    sast_job = security.partition('  sast:\n')[2].partition('\n  secret-scanning:')[0]
    require('package-manager-cache: false' in sast_job and 'cache: pnpm' not in sast_job,
            'Scanner-only SAST job must disable unused package-manager caching')
    for command in ('security:sast', 'security:secrets', 'security:runtime',
                    'test:security:scanners', 'hooks:install', 'precommit'):
        require(scripts.get(command), f'Missing security command: {command}')
    require(scripts.get('prepare') == 'node scripts/security/install-hooks.mjs',
            'Local installation must configure commit checks')
    require(exact_path_exists(ROOT/'.githooks/pre-commit'), 'Commit hook is required')
    require('"test:platform"' in (ROOT/'scripts/security/pre-commit.mjs').read_text(encoding='utf-8'),
            'Local commit gate must execute platform tests')
    policy = json.loads((ROOT/'.github/branch-protection.json').read_text(encoding='utf-8'))
    required = {item['context'] for item in policy['required_status_checks']['checks']}
    require(required == {'application-checks', 'dependency-audit', 'repository-docs',
                         'sast', 'secret-scanning', 'runtime-security'},
            'Protection candidate must require all six actual checks')


def main() -> int:
    try:
        for rel in REQUIRED:
            require(exact_path_exists(ROOT/rel), f'Missing required file: {rel}')
        require((ROOT/'AGENTS.md').stat().st_size < 24*1024,
                'Root AGENTS.md too large; move detailed procedure into linked docs')
        require(len((ROOT/'AGENTS.md').read_text(encoding='utf-8').splitlines()) < 50,
                'AGENTS.md must remain under 50 lines')
        paths = files_under(ROOT)
        application = bootstrap_source_findings(paths)
        if application:
            check_application_contract()
        markdown = [f for f in paths if f.suffix.lower() == '.md']
        for path in markdown:
            check_markdown(path)
        for path in paths:
            if path.suffix.lower() not in {'.md', '.py', '.yml', '.yaml', '.json', '.jsonc', '.toml', '.ts', '.tsx', '.mjs'} and path.name != '.env.example':
                continue
            findings = secret_findings(path.read_text(encoding='utf-8'))
            require(not findings, f'{path.relative_to(ROOT)}: possible restricted secret pattern; inspect privately')
        example = (ROOT/'.env.example').read_text(encoding='utf-8')
        check_env_example(example)
        for workflow_path in (ROOT/'.github/workflows').glob('*.yml'):
            workflow = workflow_path.read_text(encoding='utf-8')
            require('contents: read' in workflow and 'persist-credentials: false' in workflow,
                    'Workflows must use read-only/non-persisted credentials')
            require('pull_request_target:' not in workflow, 'Do not execute contributor code with privileged PR trigger')
            for action in re.findall(r'uses:\s*(\S+)', workflow):
                require(re.fullmatch(r'[\w./-]+@[0-9a-f]{40}', action) is not None,
                        'External action must be pinned to a reviewed full commit')
        packages, branches = check_plans()
        print(f'PASS: repository/document checks; {len(markdown)} Markdown files, '
              f'38 requirements, {packages} named packages/{branches} planned branches, '
              '480 hours and 86 phase groups/38 walkthroughs aligned.')
        print('DOCUMENTATION ONLY: no application build, security, clinical, provider, '
              'capacity or production acceptance has been executed by this check.')
        return 0
    except (ValueError, KeyError, IndexError, StopIteration, OSError, UnicodeError) as exc:
        print(f'FAIL: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
