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
            "persistence_contract": {
                "transactional": True,
                "migrationRequired": True,
                "mappings": [
                    {"audience": "USER", "primaryEntity": "emission_record"},
                    {"audience": "ADMIN", "primaryEntity": "emission_record"},
                    {"audience": "ADMIN", "primaryEntity": "emission_event"},
                ],
            },
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
