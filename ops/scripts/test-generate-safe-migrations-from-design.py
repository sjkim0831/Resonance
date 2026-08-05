#!/usr/bin/env python3
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import unittest

MODULE_PATH = Path(__file__).with_name("generate-safe-migrations-from-design.py")
SPEC = spec_from_file_location("design_migration", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class DesignMigrationCompilerTest(unittest.TestCase):
    def test_renders_professional_create_table_contract(self) -> None:
        sql = MODULE.render_change({
            "operation": "CREATE_TABLE",
            "tableName": "emission_fixture",
            "columns": [
                {"name": "id", "type": "uuid", "primaryKey": True, "nullable": False,
                 "default": "gen_random_uuid()"},
                {"name": "tenant_id", "type": "varchar(64)", "nullable": False},
                {"name": "payload", "type": "jsonb", "nullable": False},
            ],
            "uniqueConstraints": [["tenant_id", "id"]],
            "indexes": [{"name": "idx_emission_fixture_tenant", "columns": ["tenant_id"]}],
        })
        self.assertIn("CREATE TABLE emission_fixture", sql)
        self.assertIn("UNIQUE (tenant_id, id)", sql)
        self.assertIn("CREATE INDEX idx_emission_fixture_tenant", sql)

    def test_rejects_existing_table_mutation(self) -> None:
        with self.assertRaisesRegex(MODULE.ContractError, "only CREATE_TABLE"):
            MODULE.render_change({"operation": "ALTER_TABLE", "tableName": "existing"})

    def test_rejects_unsafe_type_and_identifier(self) -> None:
        for change in [
            {"operation": "CREATE_TABLE", "tableName": "Bad-Name", "columns": [{"name": "id", "type": "uuid"}]},
            {"operation": "CREATE_TABLE", "tableName": "safe_name", "columns": [{"name": "id", "type": "serial); drop table x;--"}]},
        ]:
            with self.assertRaises(MODULE.ContractError):
                MODULE.render_change(change)

    def test_detects_tables_already_declared_by_migrations(self) -> None:
        import tempfile
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            target = root / "apps/carbonet-api/src/main/resources/db/migration/postgresql"
            target.mkdir(parents=True)
            (target / "V1__fixture.sql").write_text(
                "-- CREATE TABLE ignored_comment(x int);\nCREATE TABLE IF NOT EXISTS existing_table(id bigint);\n",
                encoding="utf-8",
            )
            self.assertEqual(MODULE.existing_tables(root), {"existing_table"})


if __name__ == "__main__":
    unittest.main()
