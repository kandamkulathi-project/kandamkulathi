"""Semantic regressions for the P1 execution inventory, not acceptance execution."""
import re
import unittest
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[2]
REGISTER = ROOT / 'docs/quality/P1_TEST_RUN_REGISTER.md'
CANON = ROOT / 'docs/implementation/Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md'
CURRENT_SHA = 'cfa4c4821a7db9c39fa27dd2ee0541d71111a741'


def run_rows(text):
    rows = {}
    for line in text.splitlines():
        if not re.match(r'^\| `+P1-T\d{2}\.S\d{2}-V\d{2}`+ \|', line):
            continue
        cells = [cell.strip() for cell in line.strip('|').split('|')]
        run_id = cells[0].strip('`')
        if run_id in rows:
            raise ValueError(f'Duplicate run ID: {run_id}')
        if len(cells) != 10:
            raise ValueError(f'Invalid run record: {run_id}')
        if cells[6] != '**Blocked**' or not cells[7]:
            raise ValueError(f'Unsubstantiated execution status: {run_id}')
        if 'Not executed' not in cells[5] and 'UNVERIFIED' not in cells[5]:
            raise ValueError(f'Missing execution limitation: {run_id}')
        if re.search(r'\bpassed\b', cells[5], re.I):
            raise ValueError(f'Unverified historical pass: {run_id}')
        rows[run_id] = cells
    return rows


class QaRunRegisterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = REGISTER.read_text(encoding='utf-8')
        cls.canon = CANON.read_text(encoding='utf-8')

    def test_canonical_group_titles_and_individual_source_links(self):
        expected = re.findall(r'^### (P1-T\d{2} — .+)$', self.canon, re.M)
        actual = re.findall(r'^### (P1-T\d{2} — .+)$', self.text, re.M)
        self.assertEqual(actual, expected)
        self.assertEqual(len(actual), 20)
        for title in expected:
            slug = re.sub(r'[^a-z0-9 -]', '', title.lower()).replace(' ', '-')
            self.assertIn(f'Kandamkulathi_11_Tinu_Detailed_Phase_Wise_Test_Cases.md#{slug}', self.text)

    def test_original_ids_remain_unique_and_blocked_with_explicit_prerequisites(self):
        # Original per-step ranges are stable references, not a whole-file snapshot.
        original = [(1, 1, 3), (2, 4, 1), (3, 2, 1), (3, 1, 1), (1, 4, 1),
                    (4, 4, 1), (1, 3, 1), (3, 3, 1), (3, 2, 1), (2, 3, 1),
                    (2, 3, 2), (2, 3, 1), (2, 2, 2), (2, 2, 2), (2, 1, 3),
                    (3, 2, 1), (2, 2, 2), (1, 2, 1), (1, 2, 1), (1, 1, 1)]
        rows = run_rows(self.text)
        for group, counts in enumerate(original, 1):
            for step, count in enumerate(counts, 2):
                for variant in range(1, count + 1):
                    self.assertIn(f'P1-T{group:02}.S{step:02}-V{variant:02}', rows)

    def test_reviewed_safety_money_and_channel_variations_have_separate_rows(self):
        rows = run_rows(self.text)
        required = {
            'P1-T06.S03-V05': ('reordered',),
            'P1-T06.S03-V06': ('account',),
            'P1-T06.S03-V07': ('reference',),
            'P1-T06.S03-V08': ('currency',),
            'P1-T06.S02-V05': ('pending',),
            'P1-T06.S04-V02': ('missing',),
            'P1-T06.S04-V03': ('commit', 'unknown'),
            'P1-T08.S03-V04': ('leave',),
            'P1-T08.S03-V05': ('stale', 'confirmation'),
            'P1-T09.S04-V02': ('race',),
            'P1-T09.S04-V03': ('conflict',),
            'P1-T09.S04-V04': ('pending',),
            'P1-T12.S03-V04': ('stale', 'vector'),
            'P1-T13.S04-V03': ('cancelled',),
            'P1-T13.S04-V04': ('dosage',),
            'P1-T14.S03-V03': ('duplicate',),
            'P1-T14.S04-V03': ('edit',),
            'P1-T14.S04-V04': ('cancel',),
            'P1-T14.S04-V05': ('confirm', 'fresh'),
        }
        for run_id, words in required.items():
            with self.subTest(run_id=run_id):
                description = rows[run_id][1].lower()
                for word in words:
                    self.assertIn(word, description)
        for variant, language in enumerate(('English', 'Malayalam', 'Tamil'), 3):
            self.assertIn(language, rows[f'P1-T13.S02-V{variant:02}'][1])
            self.assertIn('consult-only', rows[f'P1-T13.S02-V{variant:02}'][1])
        for variant, language in enumerate(('Malayalam', 'Tamil'), 6):
            self.assertIn(language, rows[f'P1-T13.S02-V{variant:02}'][1])
            self.assertIn('red-flag', rows[f'P1-T13.S02-V{variant:02}'][1])

    def test_historical_current_and_open_pr_states_are_not_conflated(self):
        self.assertIn('Historical inspection baseline', self.text)
        self.assertIn('a6fb539930e56c1a58eca424834322800deee977', self.text)
        self.assertIn(CURRENT_SHA, self.text)
        self.assertIn('PR #3 and PR #4 are merged', self.text)
        self.assertIn('PR #5–#7 and PR #9 are open', self.text)
        self.assertIn('3825c0003cb7f56911ff530dc770e73453167a13', self.text)
        self.assertNotIn('CI pipeline missing', self.text)
        self.assertIn('CI exists', self.text)
        self.assertIn('no aggregate pass', self.text.lower())
        self.assertIn('executor, reviewer', self.text)
        rows = run_rows(self.text)
        for run_id in ('P1-T15.S04-V01', 'P1-T15.S04-V02', 'P1-T15.S04-V03',
                       'P1-T16.S02-V01', 'P1-T16.S02-V02', 'P1-T16.S02-V03', 'P1-T20.S03-V01'):
            self.assertIn('UNVERIFIED', rows[run_id][5])

    def test_links_resolve_locally_or_bind_external_inventory_to_source_revision(self):
        for target in re.findall(r'\[[^\]\n]*\]\(([^)\n]+)\)', self.text):
            parsed = urlsplit(target)
            if not parsed.scheme and parsed.path:
                self.assertTrue((REGISTER.parent / unquote(parsed.path)).exists(), target)
        for path in ('packages/database/src/outbox.ts', 'scripts/platform/backup.mjs',
                     'tests/e2e/client-foundation.spec.ts', 'tests/platform/worker.test.mjs'):
            self.assertIn(f'/blob/{CURRENT_SHA}/{path}', self.text)

    def test_all_groups_cover_canonical_steps_and_audited_nonexample_variations(self):
        rows = run_rows(self.text)
        for group in range(1, 21):
            for step in (2, 3, 4):
                prefix = f'P1-T{group:02}.S{step:02}-'
                self.assertTrue(any(run_id.startswith(prefix) for run_id in rows), prefix)
        # Beyond the originally reported examples: environment faults, authorization,
        # stock/rollback, native lifecycle, takeover, recovery, load and gate honesty.
        required = {
            'P1-T01.S03-V03': 'disabled bindings',
            'P1-T02.S03-V09': 'mfa',
            'P1-T03.S04-V03': 'revoked consent',
            'P1-T04.S02-V09': 'fractional',
            'P1-T04.S04-V02': 'zero stock/ledger delta',
            'P1-T05.S04-V02': 'stale checkout',
            'P1-T07.S02-V02': 'same clinic',
            'P1-T10.S03-V05': 'restart',
            'P1-T11.S04-V05': 'microphone reallow',
            'P1-T15.S03-V02': 'pending bot',
            'P1-T16.S03-V07': 'private file',
            'P1-T17.S03-V04': 'revoked consent',
            'P1-T18.S03-V04': 'bytes match source hashes',
            'P1-T19.S04-V03': 'resource recovery',
            'P1-T20.S04-V02': 'rework/no-go',
        }
        for run_id, assertion in required.items():
            self.assertIn(assertion, rows[run_id][1].lower(), run_id)
        for first, language in ((4, 'English'), (8, 'Malayalam'), (12, 'Tamil')):
            for offset in range(4):
                self.assertIn(language, rows[f'P1-T15.S04-V{first + offset:02}'][1])

    def test_encoding_is_readable_utf8(self):
        for corruption in ('â€', '\ufffd'):
            self.assertNotIn(corruption, self.text)
        self.assertIn('—', self.text)

    def test_negative_controls_reject_duplicate_ids_and_unsupported_pass_claims(self):
        row = '| `P1-T01.S02-V01` | Build | Missing | Missing | Unexecuted | Not executed | **Blocked** | Manifest missing (Devadathan) | N/A | Pending |'
        self.assertEqual(len(run_rows(row)), 1)
        for invalid in (row + '\n' + row, row.replace('**Blocked**', '**Passed**'),
                        row.replace('Not executed', 'Historical scan passed'),
                        row.replace('Manifest missing (Devadathan)', '')):
            with self.assertRaises(ValueError):
                run_rows(invalid)


if __name__ == '__main__':
    unittest.main()
