#!/usr/bin/env python3
"""Generate deterministic no-build runtime packages from the approved design.

The input is the JSON returned by framework_process_generation_snapshot().
No business meaning is inferred here: this renderer only projects approved
contracts into shared SDUI, backend-command, persistence and test manifests.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


def fail(message: str) -> None:
    raise SystemExit(f"[full-stack-generator] {message}")


def stable(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def load(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"invalid snapshot: {exc}")
    if data.get("schemaVersion") != "2.0.0" or not isinstance(data.get("processes"), list):
        fail("snapshot schemaVersion/processes is invalid")
    return data


def validate_step(process: dict[str, Any], step: dict[str, Any]) -> None:
    identity = f"{process.get('processCode')}/{step.get('step_code')}"
    required_objects = (
        "actor_contract", "business_contract", "transition_contract", "input_contract",
        "output_contract", "guide_contract", "nonfunctional_contract",
    )
    required_arrays = (
        "screen_contract", "field_contract", "command_contract", "api_contract",
        "handoff_contract", "test_contract", "blocker_codes",
    )
    for key in required_objects:
        if not isinstance(step.get(key), dict):
            fail(f"{identity}: {key} must be an object")
    for key in required_arrays:
        if not isinstance(step.get(key), list):
            fail(f"{identity}: {key} must be an array")
    if step.get("design_status") != "DESIGN_COMPLETE" or step["blocker_codes"]:
        fail(f"{identity}: design is blocked: {step.get('blocker_codes')}")


def render_step(process: dict[str, Any], step: dict[str, Any]) -> dict[str, Any]:
    validate_step(process, step)
    executable_tests = [
        case for case in step["test_contract"]
        if case.get("status") in {"APPROVED", "VERIFIED"}
        and case.get("steps") and case.get("assertions")
    ]
    pages = []
    field_by_audience = {item["audience"]: item.get("fields", []) for item in step["field_contract"]}
    for page in step["screen_contract"]:
        audience = page["audience"]
        pages.append({
            "pageCode": page["pageCode"],
            "route": page.get("actualRoute") or page["plannedRoute"],
            "routeStatus": page["routeStatus"],
            "audience": audience,
            "screenType": page["screenType"],
            "title": page["title"],
            "purpose": page["purpose"],
            "layout": "COMMON_KRDS_TASK_LAYOUT",
            "theme": "COMMON_KRDS_GOV",
            "sections": ["TASK_CONTEXT", "TASK_ACTIONS", "TASK_CONTENT", "TASK_EVIDENCE", "TASK_HANDOFF"],
            "fields": field_by_audience.get(audience, []),
            "commands": step["command_contract"],
            "states": page["exceptions"],
            "responsive": page["responsive"],
            "accessibility": page["accessibility"],
        })
    body = {
        "schemaVersion": "2.0.0",
        "process": {
            "code": process["processCode"], "name": process["processName"],
            "domain": process["domainCode"], "workType": process.get("workTypeCode"),
            "goal": process["goal"],
        },
        "step": {
            "code": step["step_code"], "version": step["spec_version"],
            "actor": step["actor_contract"], "business": step["business_contract"],
            "transition": step["transition_contract"], "input": step["input_contract"],
            "output": step["output_contract"], "guide": step["guide_contract"],
        },
        "frontend": {"renderer": "COMMON_SDUI_RUNTIME", "pages": pages},
        "backend": {
            "runtime": "COMMON_PROCESS_COMMAND_RUNTIME", "apis": step["api_contract"],
            "commands": step["command_contract"], "authorization": step["actor_contract"],
            "handoffs": step["handoff_contract"],
        },
        "database": step["persistence_contract"],
        "tests": executable_tests,
        "testExecution": {
            "runner": "FAST_PROCESS_CONTRACT_RUNNER",
            "requiredLanes": ["CONTRACT", "AUTHORITY", "ISOLATION", "RECOVERY", "LIVE_SMOKE"],
            "requiredScenarioTypes": ["HAPPY_PATH", "EXCEPTION", "AUTHORITY", "ISOLATION", "RECOVERY"],
            "cacheKeySource": "packageHash",
            "parallelSafe": True,
            "targetSeconds": 5,
            "liveSmokeRequiredForVerified": True,
            "evidenceRequired": True,
        },
        "nonfunctional": step["nonfunctional_contract"],
        "sourceHash": step["source_hash"],
        "approvalStatus": step["approval_status"],
        "generationStatus": step["generation_status"],
    }
    body["packageHash"] = hashlib.sha256(stable(body).encode()).hexdigest()
    return body


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--allow-review-required", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    data = load(args.snapshot)
    packages: list[tuple[str, dict[str, Any]]] = []
    skipped_review = 0
    for process in data["processes"]:
        for step in process.get("steps", []):
            if step.get("approval_status") != "APPROVED" and not args.allow_review_required:
                skipped_review += 1
                continue
            package = render_step(process, step)
            packages.append((f"{process['processCode']}__{step['step_code']}.json", package))
    if args.check:
        print(stable({"valid": True, "packages": len(packages), "skippedReview": skipped_review}))
        return
    args.out.mkdir(parents=True, exist_ok=True)
    expected = set()
    index = []
    for filename, package in packages:
        expected.add(filename)
        (args.out / filename).write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        index.append({
            "processCode": package["process"]["code"], "stepCode": package["step"]["code"],
            "package": filename, "packageHash": package["packageHash"],
            "pages": len(package["frontend"]["pages"]),
        })
    for stale in args.out.glob("*.json"):
        if stale.name != "index.json" and stale.name not in expected:
            stale.unlink()
    manifest = {
        "schemaVersion": "2.0.0", "packageCount": len(index),
        "skippedReviewRequired": skipped_review, "packages": sorted(index, key=lambda x: (x["processCode"], x["stepCode"])),
    }
    manifest["manifestHash"] = hashlib.sha256(stable(manifest).encode()).hexdigest()
    (args.out / "index.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(stable({"generated": len(index), "skippedReview": skipped_review, "manifestHash": manifest["manifestHash"]}))


if __name__ == "__main__":
    main()
