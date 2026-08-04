import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ai-builder"))

from builder.L05_compose.composer import ScreenComposer
from builder.L07_export.exporter import ScreenExporter
from builder.common.option_sources import resolve_option_contract
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
    def test_selection_sources_resolve_from_reference_or_canonical_enum(self):
        references = {
            "PROCESS": [{"value": "EMISSION", "label": "배출량 관리"}],
            "PROCESS_STEP:EMISSION": [{"value": "COLLECT", "label": "자료 수집"}],
        }
        options, source = resolve_option_contract("processCode", "EMISSION", references)
        self.assertEqual("EMISSION", options[0]["value"])
        self.assertTrue(source["verified"])
        options, source = resolve_option_contract("decisionCode", "EMISSION", references)
        self.assertGreaterEqual(len(options), 3)
        self.assertEqual("CANONICAL_ENUM", source["sourceType"])

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
            layers = screen["contract_layers"]
            self.assertEqual("1.0", layers["version"])
            self.assertEqual(
                {
                    "dataSchema",
                    "uiSchema",
                    "actionSchema",
                    "processSchema",
                    "permissionSchema",
                },
                set(layers).difference({"version", "screen"}),
            )
            self.assertEqual("COLLECT", layers["processSchema"]["stepCode"])
            self.assertEqual(
                "OPERATOR", layers["permissionSchema"]["actorCode"]
            )
            self.assertEqual(
                "status", layers["dataSchema"]["fields"][0]["code"]
            )
            self.assertEqual(
                [{"value": "READY", "label": "준비"}],
                screen["fields"][0]["options"],
            )

    def test_shared_route_emits_one_router_entry_and_complete_bindings(self):
        first = complete_contract()
        second = complete_contract()
        second.contract_id = 102
        second.process_code = "LCA"
        second.step_code = "REVIEW"
        with tempfile.TemporaryDirectory() as directory:
            exporter = ScreenExporter(Path(directory))
            context = GenerationContext(contracts=[first, second])
            success, artifacts, _ = exporter.execute(context, None)
            self.assertTrue(success)
            routes = Path(artifacts["routes"]).read_text(encoding="utf-8")
            self.assertEqual(1, routes.count('path="/emission/work"'))
            catalog = json.loads(Path(artifacts["catalog"]).read_text(encoding="utf-8"))
            screens = catalog["screens"]
            self.assertEqual(
                {first.contract_id, second.contract_id},
                {binding["contractId"] for binding in screens[0]["route_bindings"]},
            )
            self.assertEqual(
                {screen["route_owner_contract_id"] for screen in screens},
                {first.contract_id},
            )


if __name__ == "__main__":
    unittest.main()
