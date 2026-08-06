import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / (
    "projects/carbonet-frontend/source/src/features/join-company-status/"
    "JoinCompanyStatusMigrationPage.tsx"
)


class JoinCompanyStatusMobileLayoutTest(unittest.TestCase):
    def test_detail_layout_has_bounded_mobile_containers(self):
        source = PAGE.read_text(encoding="utf-8")
        for contract in (
            "overflow-x-hidden",
            "sm:flex-row sm:items-center sm:justify-between",
            "hidden h-0.5 flex-grow sm:block",
            "min-w-0 break-all",
            "w-full items-center justify-center",
        ):
            with self.subTest(contract=contract):
                self.assertIn(contract, source)


if __name__ == "__main__":
    unittest.main()
