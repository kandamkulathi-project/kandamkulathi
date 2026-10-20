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

    def test_environment_example_rejects_live_flags_and_secret_values(self):
        CHECK.check_env_example('RESOURCE_NAMESPACE=kandamkulathi-local\nPROVIDER_MODE=stub\nDATABASE_URL=')
        for example in ('RESOURCE_NAMESPACE=kandamkulathi-production', 'ALLOW_LIVE_SENDS=true',
                        'PROVIDER_MODE=live', 'DATABASE_URL=synthetic-credential'):
            with self.assertRaisesRegex(ValueError, 'exact safe public defaults'):
                CHECK.check_env_example(example)

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
