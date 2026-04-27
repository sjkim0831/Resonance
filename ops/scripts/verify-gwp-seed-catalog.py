#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path


EXPECTED_DOCUMENT_SHA256 = "5f0bbd46600e0b27ea4eda97932d683aaef9b6e70a88830e8b219c885aeea387"
EXPECTED_ROW_COUNT = 266
EXPECTED_SECTION_COUNTS = {
    "MAJOR_GHG": 6,
    "HFC_HFO": 50,
    "FULLY_FLUORINATED": 27,
    "CFC": 14,
    "HCFC": 23,
    "CHLOROCARBON": 11,
    "BROMO_HALON": 16,
    "HALOGENATED_OXYGENATES": 119,
}
EXPECTED_ANCHORS = {
    "Carbon dioxide": {"formula": "CO2", "ar4": "1", "ar5": "1", "ar6": "1"},
    "Methane - non-fossil": {"formula": "CH4", "ar4": "25", "ar5": "28", "ar6": "27.0"},
    "Methane - fossil": {"formula": "CH4", "ar4": "", "ar5": "30", "ar6": "29.8"},
    "Nitrous oxide": {"formula": "N2O", "ar4": "298", "ar5": "265", "ar6": "273"},
    "Sulfur hexafluoride": {"formula": "SF6", "ar4": "22,800", "ar5": "23,500", "ar6": "24,300"},
    "HFC-23": {"formula": "CHF3", "ar4": "14,800", "ar5": "12,400", "ar6": "14,600"},
    "CFC-11": {"formula": "CCl3F", "ar4": "4,750", "ar5": "4,660", "ar6": "6,230"},
    "HCFC-22": {"formula": "CHClF2", "ar4": "1,810", "ar5": "1,760", "ar6": "1,960"},
    "(E)-1-chloro-3,3,3-trifluoroprop-1-ene": {"formula": "trans-CF3CH=CHCl", "ar4": "", "ar5": "1", "ar6": ""},
}


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def count_pdf_pages(path: Path) -> int:
    content = path.read_bytes()
    return len(re.findall(rb"/Type/Page\b", content))


def load_seed_rows(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("|")
        if len(parts) < 7:
            raise ValueError(f"Malformed seed row: {raw}")
        rows.append(
            {
                "rowId": parts[0].strip(),
                "sectionCode": parts[1].strip(),
                "commonName": parts[2].strip(),
                "formula": parts[3].strip(),
                "ar4": parts[4].strip(),
                "ar5": parts[5].strip(),
                "ar6": parts[6].strip(),
                "note": parts[7].strip() if len(parts) > 7 else "",
            }
        )
    return rows


def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]
    pdf_path = repo_root.parent.parent / "reference" / "수식 설계" / "Global-Warming-Potential-Values (August 2024).pdf"
    seed_path = repo_root / "src" / "main" / "resources" / "data" / "admin" / "emission-gwp-values" / "seed.psv"

    rows = load_seed_rows(seed_path)
    section_counts = Counter(row["sectionCode"] for row in rows)
    row_ids = [row["rowId"] for row in rows]
    by_name = {row["commonName"]: row for row in rows}

    pdf_exists = pdf_path.exists()
    pdf_sha256 = sha256_of(pdf_path) if pdf_exists else ""
    pdf_page_count = count_pdf_pages(pdf_path) if pdf_exists else 0

    anchor_results = []
    anchors_ok = True
    for common_name, expected in EXPECTED_ANCHORS.items():
        actual = by_name.get(common_name, {})
        ok = (
            actual.get("formula", "") == expected["formula"]
            and actual.get("ar4", "") == expected["ar4"]
            and actual.get("ar5", "") == expected["ar5"]
            and actual.get("ar6", "") == expected["ar6"]
        )
        anchors_ok = anchors_ok and ok
        anchor_results.append(
            {
                "commonName": common_name,
                "ok": ok,
                "expected": expected,
                "actual": {
                    "formula": actual.get("formula", ""),
                    "ar4": actual.get("ar4", ""),
                    "ar5": actual.get("ar5", ""),
                    "ar6": actual.get("ar6", ""),
                },
            }
        )

    report = {
        "ok": True,
        "pdf": {
            "path": str(pdf_path),
            "exists": pdf_exists,
            "sha256": pdf_sha256,
            "expectedSha256": EXPECTED_DOCUMENT_SHA256,
            "sha256Ok": pdf_sha256 == EXPECTED_DOCUMENT_SHA256,
            "pageCount": pdf_page_count,
            "pageCountOk": pdf_page_count == 10,
        },
        "seed": {
            "path": str(seed_path),
            "rowCount": len(rows),
            "rowCountOk": len(rows) == EXPECTED_ROW_COUNT,
            "uniqueRowIdCount": len(set(row_ids)),
            "rowIdsUnique": len(set(row_ids)) == len(row_ids),
            "sectionCounts": dict(section_counts),
            "sectionCountsOk": dict(section_counts) == EXPECTED_SECTION_COUNTS,
            "anchorsOk": anchors_ok,
            "anchors": anchor_results,
        },
    }
    report["ok"] = (
        report["pdf"]["exists"]
        and report["pdf"]["sha256Ok"]
        and report["pdf"]["pageCountOk"]
        and report["seed"]["rowCountOk"]
        and report["seed"]["rowIdsUnique"]
        and report["seed"]["sectionCountsOk"]
        and report["seed"]["anchorsOk"]
    )

    json.dump(report, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
