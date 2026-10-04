import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('guard', Path(__file__).with_name('parallel_guard.py'))
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)


class GuardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        self.root = self.home / 'source'; self.root.mkdir()
        for name in ['a', 'b', 'shared']:
            (self.root / name).write_text('original')
        self.plan = {'workers': 4, 'tasks': [
            {'id': n, 'writes': [n], 'reads': ['shared'], 'checks': [['python3', '-c', 'pass']]}
            for n in ['a', 'b']], 'integration_checks': [['python3', '-c', 'pass']]}
        self.plan_file = self.home / 'plan.json'
        self.run = self.home / 'run'

    def prepare(self):
        self.plan_file.write_text(json.dumps(self.plan))
        return g.prepare(self.root, self.plan_file, self.run)

    def fail(self, text):
        result = g.verify(self.run, 1)
        self.assertEqual(result['status'], 'FAIL', result)
        self.assertIn(text, ' '.join(result['errors']))

    def test_parallel_merge_preserves_source(self):
        self.prepare()
        for n in ['a', 'b']:
            (self.run / 'tasks' / n / n).write_text('new ' + n)
        result = g.verify(self.run)
        self.assertEqual(result['status'], 'PASS', result)
        for n in ['a', 'b']:
            self.assertEqual((Path(result['candidate']) / n).read_text(), 'new ' + n)
            self.assertEqual((self.root / n).read_text(), 'original')

    def test_write_write_conflict(self):
        self.plan['tasks'][1]['writes'] = ['a/child']
        with self.assertRaisesRegex(ValueError, 'scope conflict'): self.prepare()

    def test_read_write_conflict(self):
        self.plan['tasks'][1]['reads'].append('a')
        with self.assertRaisesRegex(ValueError, 'scope conflict'): self.prepare()

    def test_source_drift(self):
        self.prepare(); (self.root / 'shared').write_text('changed'); self.fail('source drift')

    def test_out_of_scope(self):
        self.prepare(); (self.run / 'tasks/a/b').write_text('bad'); self.fail('out-of-scope')

    def test_deletion(self):
        self.prepare(); (self.run / 'tasks/a/a').unlink()
        result = g.verify(self.run)
        self.assertEqual(result['status'], 'PASS')
        self.assertFalse((Path(result['candidate']) / 'a').exists())
        self.assertTrue((self.root / 'a').exists())

    def test_new_file(self):
        self.plan['tasks'][0]['writes'].append('new/file')
        self.prepare(); p = self.run / 'tasks/a/new/file'; p.parent.mkdir(); p.write_text('new')
        self.assertEqual(g.verify(self.run)['status'], 'PASS')

    def test_symlink(self):
        (self.root / 'a').unlink(); (self.root / 'a').symlink_to(self.root / 'b')
        with self.assertRaisesRegex(ValueError, 'symlink'): self.prepare()

    def test_traversal(self):
        self.plan['tasks'][0]['writes'] = ['../escape']
        with self.assertRaisesRegex(ValueError, 'unsafe'): self.prepare()

    def test_failed_check(self):
        self.plan['tasks'][0]['checks'] = [['python3', '-c', 'raise SystemExit(9)']]
        self.prepare(); self.fail('task validation failed')

    def test_timeout(self):
        self.plan['tasks'][0]['checks'] = [['python3', '-c', 'import time; time.sleep(9)']]
        self.prepare(); self.fail('task validation failed')

    def test_integration_failed(self):
        self.plan['integration_checks'] = [['python3', '-c', 'raise SystemExit(3)']]
        self.prepare(); self.fail('integration validation failed')

    def test_check_mutation(self):
        self.plan['integration_checks'] = [['python3', '-c', "from pathlib import Path; Path('a').write_text('bad')"]]
        self.prepare(); self.fail('validator changed')

    def test_missing_checks(self):
        self.plan['integration_checks'] = []
        self.prepare(); self.fail('checks required')

    def test_reuse_denied(self):
        self.prepare()
        with self.assertRaises(FileExistsError): self.prepare()

    def test_stale_pass_invalidated(self):
        self.prepare(); self.assertEqual(g.verify(self.run)['status'], 'PASS')
        (self.root / 'a').write_text('drift'); self.fail('source drift')
        self.assertEqual(json.loads((self.run / 'report.json').read_text())['status'], 'FAIL')

    def test_baseline_tamper(self):
        self.prepare(); (self.run / 'base/a').write_text('bad'); self.fail('baseline snapshot')

    def test_concurrent_verify_denied(self):
        import fcntl
        self.prepare()
        with (self.run / 'verify.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with self.assertRaises(BlockingIOError): g.verify(self.run)


if __name__ == '__main__': unittest.main(verbosity=2)
