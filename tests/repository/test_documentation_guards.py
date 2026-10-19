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


if __name__ == '__main__':
    unittest.main()
