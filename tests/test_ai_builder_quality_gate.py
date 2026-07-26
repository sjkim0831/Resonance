import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "ai-builder" / "governance" / "quality_gate.py"
SPEC = importlib.util.spec_from_file_location("quality_gate", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def complete_screen(contract_id=1, route="/work"):
    return {
        "contract_id": contract_id,
        "route": route,
        "screen_name": "업무 화면",
        "process_code": "PROCESS",
        "actor_code": "ACTOR",
        "fields": [{
            "code": "status", "name": "상태", "type": "SELECT",
            "required": True, "options": [{"value": "READY", "label": "준비"}],
        }],
        "apis": [{"method": "GET", "path": "/api/work", "code": "LOAD"}],
        "states": ["READY", "COMPLETED"],
        "sections": [{"code": "main", "layout": "grid"}],
        "input_schema": {"required": ["tenantId"]},
        "output_schema": {"required": ["status"]},
        "permissions": [{"actor": "ACTOR", "actions": ["READ"]}],
        "tests": [{"given": "READY", "when": "READ", "then": "200"}],
    }


class QualityGateTest(unittest.TestCase):
    def run_gate(self, screens):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            catalog = root / "catalog.json"
            catalog.write_text(json.dumps({"screens": screens}), encoding="utf-8")
            report = root / "report"
            rc = MODULE.QualityGate(catalog, root, None).run(report)
            payload = json.loads((report / "promotion-report.json").read_text(encoding="utf-8"))
            return rc, payload

    def test_complete_contract_is_promotable(self):
        rc, report = self.run_gate([complete_screen()])
        self.assertEqual(0, rc)
        self.assertTrue(report["success"])

    def test_complex_contract_missing_machine_contracts_is_blocked(self):
        screen = complete_screen()
        screen.pop("input_schema")
        screen.pop("permissions")
        screen["fields"][0].pop("options")
        rc, report = self.run_gate([screen])
        self.assertEqual(2, rc)
        self.assertFalse(report["success"])
        self.assertGreaterEqual(report["blockerCount"], 3)

    def test_duplicate_route_ownership_is_blocked(self):
        rc, report = self.run_gate([
            complete_screen(1, "/same"),
            complete_screen(2, "/same"),
        ])
        self.assertEqual(2, rc)
        self.assertIn("ROUTE_OWNERSHIP_CONFLICT", report["findingCounts"])


if __name__ == "__main__":
    unittest.main()
