#!/usr/bin/env python3
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import tempfile
import unittest

MODULE_PATH = Path(__file__).with_name("create-safe-additive-migration.py")
SPEC = spec_from_file_location("safe_migration", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class VersionTest(unittest.TestCase):
    def test_version_is_always_after_repository_maximum(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder)
            (target / "V20991231235959__future.sql").write_text("SELECT 1;", encoding="utf-8")
            self.assertEqual(MODULE.next_version(target), "20991231235960")


if __name__ == "__main__":
    unittest.main()
