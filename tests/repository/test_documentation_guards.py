"""Negative controls for repository guardrails, not application tests."""
import contextlib
import importlib.util
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

PATH = Path(__file__).resolve().parents[2] / 'scripts' / 'check_repository.py'
SPEC = importlib.util.spec_from_file_location('repository_checker', PATH)
CHECK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECK)


class RepositoryGuardTests(unittest.TestCase):
    def test_readiness_packages_retain_reconciled_requirement_and_output_links(self):
        # KAN-189: explicit expectations prevent replacing the five blanks with
        # arbitrary valid IDs. Sources: master §2 and Phase 1/2 §3, not legacy IDs.
        expected = {
            'P1-JOS-080': ({'R01', 'R02', 'R05', 'R06', 'R07', 'R09', 'R37', 'R38'},
                           {'P1-O03', 'P1-O04', 'P1-O09'}),
            'P1-PAU-080': ({'R25', 'R37', 'R38'}, {'P1-O01', 'P1-O06', 'P1-O09'}),
            'P2-PAU-080': ({'R25', 'R37', 'R38'}, {'P2-O04', 'P2-O06', 'P2-O07'}),
            'P1-DEN-080': ({'R08', 'R16', 'R22', 'R25', 'R34', 'R37', 'R38'},
                           {'P1-O06', 'P1-O07', 'P1-O09'}),
            'P2-DEN-080': ({'R08', 'R16', 'R22', 'R25', 'R34', 'R37', 'R38'},
                           {'P2-O01', 'P2-O03', 'P2-O04', 'P2-O05', 'P2-O06', 'P2-O07'}),
        }
        for tid, links in expected.items():
            with self.subTest(package=tid):
                member = CHECK.member_plan_paths()[tid.split('-')[1]].read_text(encoding='utf-8')
                section = member.split(f'### {tid} — ', 1)[1].split('\n### ', 1)[0]
                self.assertEqual(CHECK.check_package_traceability(tid, section, links[1]), links)
                self.assertIn('**Mapping rationale:**', section)
                self.assertIn('Phase 3', section)
                # Reproduce the original empty named-support record for each package.
                original = section.split('**Traceability:**', 1)[0] + (
                    '**Traceability:** Named support package; retain parent phase outputs. '
                    'Requirements: . Outputs: .\n')
                with self.assertRaisesRegex(ValueError, 'missing/malformed'):
                    CHECK.check_package_traceability(tid, original, links[1])

    def test_package_traceability_rejects_missing_malformed_and_unknown_links(self):
        good = '**Traceability:** Named support package. Requirements: R25, R37. Outputs: P2-O04.\n'
        self.assertEqual(CHECK.check_package_traceability('P2-PAU-080', good, {'P2-O04'}),
                         ({'R25', 'R37'}, {'P2-O04'}))
        cases = [
            ('', 'expected one'),
            (good + good, 'expected one'),
            (good.replace('R25, R37', ''), 'missing/malformed'),
            (good.replace('P2-O04', ''), 'missing/malformed'),
            (good.replace('R25', 'R99'), 'unknown requirement'),
            (good.replace('P2-O04', 'P2-O99'), 'unknown or wrong-phase'),
            (good.replace('P2-O04', 'P3-O04'), 'unknown or wrong-phase'),
            (good.replace('Named support package.', 'Requirements: . Outputs: .'),
             'duplicate traceability fields'),
            (good.replace('Named support package.', 'Requirements: R99. Outputs: P3-O04.'),
             'duplicate traceability fields'),
        ]
        for text, error in cases:
            with self.subTest(text=text):
                with self.assertRaisesRegex(ValueError, error):
                    CHECK.check_package_traceability('P2-PAU-080', text, {'P2-O04'})

    def test_plan_check_rejects_original_readiness_gap_without_changing_capacity(self):
        self.assertEqual(CHECK.check_plans(), (109, 109))
        real_read = Path.read_text
        josin = CHECK.member_plan_paths()['JOS']

        def missing_links(path, *args, **kwargs):
            text = real_read(path, *args, **kwargs)
            if path == josin:
                start, section = text.split('### P1-JOS-080 — ', 1)
                body, rest = section.split('\n### ', 1)
                trace = next(line for line in body.splitlines() if line.startswith('**Traceability:**'))
                body = body.replace(trace, '**Traceability:** Named support package; '
                                    'retain parent phase outputs. Requirements: . Outputs: .')
                return start + '### P1-JOS-080 — ' + body + '\n### ' + rest
            return text

        with patch.object(Path, 'read_text', missing_links):
            with self.assertRaisesRegex(ValueError, 'P1-JOS-080: missing/malformed'):
                CHECK.check_plans()

    def test_tinu_member_selection_is_independent_of_filesystem_glob_order(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            qa = root/'Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md'
            member = root/'Kandamkulathi_10_Tinu_QA_and_Test_Cases_All_Phases.md'
            qa.write_text('# Detailed test manual, not a member plan\n', encoding='utf-8')
            member.write_text('# Tinu member plan\n', encoding='utf-8')
            # Reproduce Linux returning the standalone manual before the member plan.
            with patch.object(CHECK, 'PLAN', root), patch.object(Path, 'glob', return_value=iter([qa, member])):
                selected = CHECK.member_plan_paths()
            self.assertEqual(selected['TIN'], member)
            self.assertNotEqual(selected['TIN'], qa)

    def test_portable_links_reject_linux_case_mismatch_and_missing_target(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root/'guide.md').write_text('# Guide\n', encoding='utf-8')
            test = root/'readme.md'
            with patch.object(CHECK, 'ROOT', root):
                test.write_text('[guide](guide.md)\n', encoding='utf-8')
                CHECK.check_markdown(test)
                for target in ('GUIDE.md', 'missing.md'):
                    test.write_text(f'[guide]({target})\n', encoding='utf-8')
                    with self.assertRaisesRegex(ValueError, 'missing/case-mismatched'):
                        CHECK.check_markdown(test)

    def test_application_additions_require_real_ci_contract(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            application = root/'apps'/'core-api'/'handler.ts'
            application.parent.mkdir(parents=True)
            application.write_text('export const value = 1;\n', encoding='utf-8')
            errors = io.StringIO()
            with patch.object(CHECK, 'ROOT', root), patch.object(CHECK, 'REQUIRED', []):
                (root/'AGENTS.md').write_text('# Instructions\n', encoding='utf-8')
                with contextlib.redirect_stderr(errors):
                    result = CHECK.main()
            self.assertEqual(result, 1)
            self.assertIn('Application scaffold requires package.json', errors.getvalue())

    def test_sql_python_and_manifests_are_not_hidden_by_bootstrap(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            names = ['migration.sql', 'server.py', 'package.json', 'apps/api/config.json',
                     'scripts/check_repository.py', 'tests/repository/test_checks.py', 'docs/example.ts']
            for name in names:
                path = root/name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('', encoding='utf-8')
            with patch.object(CHECK, 'ROOT', root):
                actual = set(CHECK.bootstrap_source_findings([root/name for name in names]))
            self.assertEqual(actual, {'migration.sql', 'server.py', 'package.json', 'apps/api/config.json'})

    def test_obvious_secret_detection_does_not_return_the_value(self):
        token = 'sk-' + 'A'*32
        findings = CHECK.secret_findings('OPENAI_API_KEY=' + token)
        self.assertIn('possible provider secret', findings)
        self.assertNotIn(token, repr(findings))
        self.assertEqual(CHECK.secret_findings('OPENAI_API_KEY='), [])

    def test_fenced_nonexistent_examples_are_not_links_but_unclosed_fence_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            path = root/'guide.md'
            with patch.object(CHECK, 'ROOT', root):
                path.write_text('```text\n[example](does-not-exist.md)\n```\n', encoding='utf-8')
                CHECK.check_markdown(path)
                path.write_text('```text\nnot closed\n', encoding='utf-8')
                with self.assertRaisesRegex(ValueError, 'Unclosed'):
                    CHECK.check_markdown(path)

    def test_missing_sast_and_missing_required_check_fail_the_repository_contract(self):
        real_read = Path.read_text
        def without_sast(path, *args, **kwargs):
            text = real_read(path, *args, **kwargs)
            if path == CHECK.ROOT/'.github/workflows/security.yml':
                return text.replace('pnpm security:sast', 'disabled-command')
            return text
        with patch.object(Path, 'read_text', without_sast):
            with self.assertRaisesRegex(ValueError, 'Security CI must execute pnpm security:sast'):
                CHECK.check_application_contract()

    def test_scanner_only_job_cannot_save_an_uncreated_dependency_cache(self):
        real_read = Path.read_text
        def unused_cache(path, *args, **kwargs):
            text = real_read(path, *args, **kwargs)
            if path == CHECK.ROOT/'.github/workflows/security.yml':
                return text.replace('package-manager-cache: false', 'cache: pnpm', 1)
            return text
        with patch.object(Path, 'read_text', unused_cache):
            with self.assertRaisesRegex(ValueError, 'disable unused package-manager caching'):
                CHECK.check_application_contract()

        def without_check(path, *args, **kwargs):
            text = real_read(path, *args, **kwargs)
            if path == CHECK.ROOT/'.github/branch-protection.json':
                return text.replace('runtime-security', 'unrelated-check')
            return text
        with patch.object(Path, 'read_text', without_check):
            with self.assertRaisesRegex(ValueError, 'all six actual checks'):
                CHECK.check_application_contract()


if __name__ == '__main__':
    unittest.main()
