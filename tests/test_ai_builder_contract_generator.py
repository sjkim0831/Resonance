import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ai-builder"))

from builder.L05_compose.composer import ScreenComposer
from builder.L07_export.exporter import ScreenExporter
from builder.common.types import (
    ApiContract,
    FieldContract,
    GenerationContext,
    ScreenContract,
    SectionContract,
)


def complete_contract():
    return ScreenContract(
        contract_id=101,
        route_path="/emission/work",
        screen_name="배출량 업무",
        process_code="EMISSION",
        actor_code="OPERATOR",
        step_code="COLLECT",
        business_purpose="활동자료 수집",
        api_contract=[
            ApiContract("GET", "/api/emission/work", "LOAD"),
            ApiContract("POST", "/api/emission/work", "SAVE"),
        ],
        state_contract=["READY", "SAVING", "COMPLETED"],
        field_contract=[
            FieldContract(
                "status",
                "상태",
                "SELECT",
                required=True,
                options=[{"value": "READY", "label": "준비"}],
            )
        ],
        section_contract=[SectionContract("main", "기본정보")],
        input_schema={"required": ["projectId"]},
        output_schema={"required": ["status"]},
        permissions=[{"actorCode": "OPERATOR", "actions": ["READ", "WRITE"]}],
        tests=[{"caseCode": "CASE-1", "assertions": [{"status": 200}]}],
    )


class ContractGeneratorTest(unittest.TestCase):
    def test_react_hooks_and_save_handler_are_inside_component(self):
        contract = complete_contract()
        source = ScreenComposer()._compose_screen(contract)
        component = source.index("const Screen101: React.FC = () => {")
        self.assertGreater(source.index("useScreenState("), component)
        self.assertIn("await request(() => api.request(", source)
        self.assertIn(
            "disabled={!dirty || state === 'SAVING' || !handleSave}",
            source,
        )

    def test_catalog_preserves_machine_readable_contracts(self):
        contract = complete_contract()
        with tempfile.TemporaryDirectory() as directory:
            exporter = ScreenExporter(Path(directory))
            context = GenerationContext(contracts=[contract])
            success, artifacts, _ = exporter.execute(context, None)
            self.assertTrue(success)
            catalog = json.loads(
                Path(artifacts["catalog"]).read_text(encoding="utf-8")
            )
            screen = catalog["screens"][0]
            self.assertEqual("COLLECT", screen["step_code"])
            self.assertEqual({"required": ["projectId"]}, screen["input_schema"])
            self.assertEqual({"required": ["status"]}, screen["output_schema"])
            self.assertTrue(screen["permissions"])
            self.assertTrue(screen["tests"])
            self.assertEqual(
                [{"value": "READY", "label": "준비"}],
                screen["fields"][0]["options"],
            )


if __name__ == "__main__":
    unittest.main()
