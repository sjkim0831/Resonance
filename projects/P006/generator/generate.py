#!/usr/bin/env python3
"""Compile the P006 design contract into project runtime artifacts."""
from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path


def atomic_json(path: Path, payload: object) -> bool:
    body = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == body:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(body, encoding="utf-8")
    os.replace(temporary, path)
    return True


root = Path(__file__).resolve().parents[1]
contract_path = root / "design" / "project.contract.json"
contract = json.loads(contract_path.read_text(encoding="utf-8"))
project = contract["project"]
pages = contract["pages"]
actors = contract["actors"]
if project["id"] != "P006" or project["database"] != "woosu_digital_twin":
    raise SystemExit("P006 project/database isolation contract mismatch")
required_page_fields = {"id", "name", "path", "type", "actor"}
if len(pages) < 5:
    raise SystemExit("P006 requires at least five page contracts")
if any(required_page_fields - set(page) for page in pages):
    raise SystemExit("P006 page contract fields are incomplete")
if len({page["id"] for page in pages}) != len(pages) or len({page["path"] for page in pages}) != len(pages):
    raise SystemExit("P006 page ids and paths must be unique")
sdui_pages = [page for page in pages if page.get("runtimeMode") == "SDUI_JSON_FORM_HOTLOAD"]
for page in sdui_pages:
    for field in ("screenId", "runtimeId", "screenRef", "testContractRef", "navigation"):
        if field not in page:
            raise SystemExit(f"P006 SDUI page {page['id']} is missing {field}")
    for reference in (page["screenRef"], page["testContractRef"]):
        if not (root / "frontend" / reference).is_file():
            raise SystemExit(f"P006 SDUI contract file is missing: frontend/{reference}")
required_cards = {"HELP", "SCREEN_DESIGN", "QA", "NEXT_TASK", "WORK_GUIDE", "ALL_WORK"}
if set(contract["screenGovernance"]["requiredCards"]) != required_cards:
    raise SystemExit("P006 governance cards are incomplete")

fingerprint = hashlib.sha256(contract_path.read_bytes()).hexdigest()
changed = 0
changed += atomic_json(root / "screens" / "overrides.json", {
    "schemaVersion": 1,
    "projectId": "P006",
    "inherit": "shared-krds-frame",
    "designFingerprint": fingerprint,
    "screens": pages,
})
changed += atomic_json(root / "themes" / "tokens.json", {
    "schemaVersion": 1,
    "projectId": "P006",
    "themeId": "theme-krds-digital-twin",
    "extends": "krds-current",
    "tokens": {
        "--krds-primary": "#005ea8",
        "--krds-primary-dark": "#052b57",
        "--krds-focus": "#ffbf47",
        "--krds-surface-subtle": "#f3f7fc",
        "--krds-text-primary": "#17202b",
    },
})
changed += atomic_json(root / "tests" / "process-cases.json", {
    "schemaVersion": 1,
    "projectId": "P006",
    "designFingerprint": fingerprint,
    "validationOrder": contract["testHarness"]["order"],
    "actors": actors,
    "cases": [
        {
            "pageId": page["id"],
            "actor": page["actor"],
            "function": page["type"],
            "inputs": ["authenticatedSession", "projectId=P006"],
            "outputs": ["HTTP_200", "KRDS_FRAME", "P006_DATA_SCOPE"],
            "scenarios": contract["testHarness"]["requiredScenarios"],
        }
        for page in pages
    ],
})
changed += atomic_json(root / "generated" / "project-runtime.json", {
    "schemaVersion": 1,
    "generatedFrom": str(contract_path.relative_to(root)),
    "designFingerprint": fingerprint,
    "project": project,
    "routes": [page["path"] for page in pages],
    "runtimeBase": contract["api"]["runtimeBase"],
    "databaseIsolation": project["databaseIsolation"],
})
changed += atomic_json(root / "frontend" / "screens" / "screen-registry.json", {
    "schemaVersion": "1.0",
    "runtimeId": sdui_pages[0]["runtimeId"] if sdui_pages else None,
    "designFingerprint": fingerprint,
    "screens": [
        {
            "screenId": page["screenId"],
            "route": page["path"],
            "screenRef": page["screenRef"],
            "status": "PUBLISHED",
            "navigation": page["navigation"],
        }
        for page in sdui_pages
    ],
})
print(json.dumps({"status": "PASS", "changedFiles": changed, "pageCount": len(pages), "actorCount": len(actors), "fingerprint": fingerprint}))
