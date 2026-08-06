#!/usr/bin/env python3
"""Regression checks for deterministic full-stack field grouping."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import unittest


MODULE_PATH = Path(__file__).with_name("generate-full-stack-design-packages.py")
SPEC = spec_from_file_location("full_stack_generator", MODULE_PATH)
assert SPEC and SPEC.loader
GENERATOR = module_from_spec(SPEC)
SPEC.loader.exec_module(GENERATOR)


class GroupFieldsByAudienceTest(unittest.TestCase):
    def test_normalizes_singleton_runtime_contracts(self) -> None:
        normalized = GENERATOR.normalize_step_contract({
            "command_contract": {"commandCode": "SAVE"},
            "api_contract": {},
            "handoff_contract": None,
            "test_contract": [],
            "blocker_codes": [],
        })
        self.assertEqual(normalized["command_contract"], [{"commandCode": "SAVE"}])
        self.assertEqual(normalized["api_contract"], [])
        self.assertEqual(normalized["handoff_contract"], {
            "schemaVersion": 1, "contractType": "STEP_HANDOFF", "policy": {}, "transitions": []
        })

    def test_separates_legacy_handoff_policy_from_transitions(self) -> None:
        policy = {"completionType": "EXPLICIT", "snapshotRequired": True}
        normalized_policy = GENERATOR.normalize_step_contract({"handoff_contract": policy})
        self.assertEqual(normalized_policy["handoff_contract"]["policy"], policy)
        self.assertEqual(normalized_policy["handoff_contract"]["transitions"], [])
        transition = {"handoffType": "STEP", "toStepCode": "S2"}
        normalized_transition = GENERATOR.normalize_step_contract({"handoff_contract": [transition]})
        self.assertEqual(normalized_transition["handoff_contract"]["policy"], {})
        self.assertEqual(normalized_transition["handoff_contract"]["transitions"], [transition])

    def test_wraps_io_and_separates_persistence_policy(self) -> None:
        normalized = GENERATOR.normalize_step_contract({
            "input_contract": {"tenantId": "required"},
            "output_contract": {"state": "COMPLETED"},
            "persistence_contract": {"transactional": True, "mappings": [{"primaryEntity": "work"}]},
        })
        self.assertEqual(normalized["input_contract"]["schema"], {"tenantId": "required"})
        self.assertEqual(normalized["output_contract"]["schema"], {"state": "COMPLETED"})
        self.assertEqual(normalized["persistence_contract"]["policy"], {"transactional": True})
        self.assertEqual(normalized["persistence_contract"]["mappings"], [{"primaryEntity": "work"}])

    def test_normalizes_transition_without_changing_states(self) -> None:
        normalized = GENERATOR.normalize_step_contract({
            "transition_contract": {
                "from": "READY", "to": "COMPLETED", "invalidStatesRejected": True,
                "domainHint": "preserve-me",
            },
        })
        transition = normalized["transition_contract"]
        self.assertEqual(transition["contractType"], "STEP_TRANSITION")
        self.assertEqual(transition["fromState"], "READY")
        self.assertEqual(transition["toState"], "COMPLETED")
        self.assertEqual(transition["policy"], {"invalidStatesRejected": True})
        self.assertEqual(transition["guards"], [])
        self.assertEqual(transition["sideEffects"], [])
        self.assertEqual(transition["extensions"], {"domainHint": "preserve-me"})

    def test_splits_catalog_group_using_nested_audiences(self) -> None:
        contract = [
            {
                "fields": [
                    {"fieldCode": "adminOnly", "audience": "ADMIN"},
                    {"fieldCode": "userOnly", "audience": "USER"},
                    {"fieldCode": "adminAgain", "audience": "ADMIN"},
                ],
                "schemaSetVersion": 1,
            }
        ]

        grouped = GENERATOR.group_fields_by_audience(contract)

        self.assertEqual(
            [field["fieldCode"] for field in grouped["ADMIN"]],
            ["adminOnly", "adminAgain"],
        )
        self.assertEqual(
            [field["fieldCode"] for field in grouped["USER"]],
            ["userOnly"],
        )
        self.assertEqual([field["code"] for field in grouped["ADMIN"]], ["adminOnly", "adminAgain"])

    def test_normalizes_audience_wrapped_fields_to_runtime_code(self) -> None:
        grouped = GENERATOR.group_fields_by_audience(
            [{"audience": "ADMIN", "fields": [{"fieldCode": "projectId"}]}]
        )
        self.assertEqual(grouped["ADMIN"][0]["code"], "projectId")

    def test_rejects_nested_field_without_audience(self) -> None:
        with self.assertRaisesRegex(SystemExit, "require audience"):
            GENERATOR.group_fields_by_audience(
                [{"fields": [{"fieldCode": "unscoped"}]}]
            )

    def test_normalizes_grouped_persistence_for_common_runtime(self) -> None:
        step = {
            "screen_contract": [{"audience": "USER"}],
            "field_contract": {"schemaVersion": 1, "contractType": "STEP_FIELDS", "fields": [{"fieldCode": "projectId"}]},
            "command_contract": [{"commandCode": "SAVE"}],
            "api_contract": [{"declaredContract": "COMMON"}],
            "persistence_contract": {"schemaVersion": 1, "contractType": "STEP_PERSISTENCE", "policy": {
                "transactional": True, "migrationRequired": True
            }, "mappings": [
                {"audience": "USER", "primaryEntity": "emission_record"},
                {"audience": "ADMIN", "primaryEntity": "emission_record"},
                {"audience": "ADMIN", "primaryEntity": "emission_event"},
            ], "extensions": {
            }},
        }

        persistence = GENERATOR.persistence_for_step(step)

        self.assertEqual(
            persistence["primaryEntities"],
            ["emission_event", "emission_record"],
        )
        self.assertTrue(persistence["historyRequired"])
        self.assertTrue(persistence["indexesRequired"])
        self.assertTrue(persistence["foreignKeysRequired"])


if __name__ == "__main__":
    unittest.main()
