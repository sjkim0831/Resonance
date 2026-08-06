import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / (
    "apps/carbonet-api/src/main/resources/db/migration/postgresql/"
    "V20260807073000__create_admin_notification_history.sql"
)
MAPPER = ROOT / (
    "modules/resonance-common/carbonet-common-core/src/main/resources/"
    "egovframework/mapper/com/feature/admin/AdminNotificationHistoryMapper.xml"
)

DELIVERY_COLUMNS = {
    "DELIVERY_ID": r"VARCHAR\(64\)\s+PRIMARY\s+KEY",
    "SENT_AT": r"TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+CURRENT_TIMESTAMP",
    "ACTOR_USER_ID": r"VARCHAR\(200\)\s+NOT\s+NULL",
    "DELIVERY_MODE": r"VARCHAR\(40\)\s+NOT\s+NULL",
    "FINDING_COUNT": r"INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0",
    "SLACK_ENABLED": r"CHAR\(1\)\s+NOT\s+NULL\s+DEFAULT\s+'N'",
    "MAIL_ENABLED": r"CHAR\(1\)\s+NOT\s+NULL\s+DEFAULT\s+'N'",
    "WEBHOOK_ENABLED": r"CHAR\(1\)\s+NOT\s+NULL\s+DEFAULT\s+'N'",
    "SLACK_CHANNEL": r"VARCHAR\(255\)",
    "MAIL_RECIPIENTS": r"TEXT",
    "WEBHOOK_URL": r"TEXT",
    "DELIVERY_STATUS": r"VARCHAR\(80\)\s+NOT\s+NULL",
    "TOP_FINDING": r"TEXT",
    "DELIVERY_DETAIL": r"TEXT",
    "SLACK_STATUS": r"VARCHAR\(80\)",
    "MAIL_STATUS": r"VARCHAR\(80\)",
    "WEBHOOK_STATUS": r"VARCHAR\(80\)",
    "USE_AT": r"CHAR\(1\)\s+NOT\s+NULL\s+DEFAULT\s+'Y'",
}

ACTIVITY_COLUMNS = {
    "ACTIVITY_ID": r"VARCHAR\(64\)\s+PRIMARY\s+KEY",
    "HAPPENED_AT": r"TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+CURRENT_TIMESTAMP",
    "ACTION_CODE": r"VARCHAR\(80\)\s+NOT\s+NULL",
    "ACTOR_USER_ID": r"VARCHAR\(200\)\s+NOT\s+NULL",
    "TARGET_TEXT": r"TEXT",
    "DETAIL_TEXT": r"TEXT",
    "SOURCE_TYPE": r"VARCHAR\(40\)\s+NOT\s+NULL\s+DEFAULT\s+'SERVER'",
    "USE_AT": r"CHAR\(1\)\s+NOT\s+NULL\s+DEFAULT\s+'Y'",
}


def mapper_insert_columns(mapper: str, statement_id: str) -> set[str]:
    statement = re.search(
        rf'<insert\s+id="{statement_id}".*?>\s*INSERT\s+INTO\s+\w+\s*'
        r"\((.*?)\)\s*VALUES",
        mapper,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if statement is None:
        raise AssertionError(f"mapper insert not found: {statement_id}")
    return {column.strip().upper() for column in statement.group(1).split(",")}


class AdminNotificationHistoryMigrationContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.migration = MIGRATION.read_text(encoding="utf-8").upper()
        cls.mapper = MAPPER.read_text(encoding="utf-8")

    def assert_table_contract(self, table: str, columns: dict[str, str]):
        self.assertRegex(
            self.migration,
            rf"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+{table}\s*\(",
        )
        for column, type_contract in columns.items():
            with self.subTest(table=table, column=column):
                self.assertRegex(
                    self.migration,
                    rf"\b{column}\s+{type_contract}",
                )

    def test_delivery_mapper_and_schema_columns_match(self):
        self.assertEqual(
            set(DELIVERY_COLUMNS),
            mapper_insert_columns(self.mapper, "insertDeliveryHistory"),
        )
        self.assert_table_contract(
            "COMTNADMINNOTIFICATIONDELIVERYHIST", DELIVERY_COLUMNS
        )

    def test_activity_mapper_and_schema_columns_match(self):
        self.assertEqual(
            set(ACTIVITY_COLUMNS),
            mapper_insert_columns(self.mapper, "insertActivityHistory"),
        )
        self.assert_table_contract(
            "COMTNADMINNOTIFICATIONACTIVITYHIST", ACTIVITY_COLUMNS
        )

    def test_repeatable_indexes_and_data_quality_constraints_exist(self):
        self.assertEqual(4, len(re.findall(r"CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS", self.migration)))
        self.assertIn("CHECK (FINDING_COUNT >= 0)", self.migration)
        self.assertEqual(5, len(re.findall(r"CHECK \(\w+ IN \('Y', 'N'\)\)", self.migration)))


if __name__ == "__main__":
    unittest.main()
