#!/usr/bin/env python3
"""Generate deterministic no-build runtime packages from the approved design.

The input is the JSON returned by framework_process_generation_snapshot().
No business meaning is inferred here: this renderer only projects approved
contracts into shared SDUI, backend-command, persistence and test manifests.
"""

from __future__ import annotations

import argparse
import copy
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


def group_fields_by_audience(field_contract: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Accept both legacy audience groups and the current flat field contract.

    Structured professional contracts store one field per array item and apply
    that list to every screen unless a field declares an audience. Older
    contracts wrap fields in ``{"audience": ..., "fields": [...]}``. Keeping
    both forms deterministic lets immutable, already-applied contracts and new
    contracts share the same generator.
    """
    grouped: dict[str, list[dict[str, Any]]] = {}
    shared: list[dict[str, Any]] = []
    for item in field_contract:
        if not isinstance(item, dict):
            fail("field_contract entries must be objects")
        nested_fields = item.get("fields")
        if isinstance(nested_fields, list):
            audience = item.get("audience")
            if not isinstance(audience, str) or not audience:
                fail("grouped field_contract entries require audience")
            grouped.setdefault(audience, []).extend(nested_fields)
            continue
        if "fieldCode" not in item:
            fail("flat field_contract entries require fieldCode")
        item = dict(item)
        item.setdefault("code", item["fieldCode"])
        audience = item.get("audience")
        if audience is None:
            shared.append(item)
        elif isinstance(audience, str) and audience:
            grouped.setdefault(audience, []).append(item)
        else:
            fail("field_contract audience must be a non-empty string")
    if shared:
        grouped["*"] = shared
    return grouped


def screens_for_step(step: dict[str, Any], shared_screens: list[dict[str, Any]]) -> list[dict[str, Any]]:
    screens = step["screen_contract"]
    if screens:
        return screens
    # An approved API/database-only step has no page or field contract. Do not
    # invent a UI by borrowing a sibling screen merely because a guide route is
    # present for navigation context.
    if not step["field_contract"]:
        return []
    guide = step["guide_contract"]
    projected: list[dict[str, Any]] = []
    seen_audiences: set[str] = set()
    for prototype in shared_screens:
        audience = prototype.get("audience")
        if audience in seen_audiences:
            continue
        route_key = "adminPath" if audience == "ADMIN" else "userPath"
        route = guide.get(route_key)
        if not isinstance(route, str) or not route.startswith("/"):
            continue
        page = copy.deepcopy(prototype)
        page["pageCode"] = f"{step['step_code']}_{audience}_WORKSPACE"
        page["title"] = step["business_contract"]["stepName"]
        page["purpose"] = step["business_contract"]["requirement"]
        page["plannedRoute"] = route
        page["actualRoute"] = route
        page["routeStatus"] = "IMPLEMENTED"
        projected.append(page)
        seen_audiences.add(audience)
    return projected


def persistence_for_step(step: dict[str, Any]) -> dict[str, Any]:
    """Apply the shared command-runtime persistence contract when appropriate.

    Backend-only approved steps intentionally have no screen field contract,
    but they still persist state, draft payloads, and immutable events through
    the common process runtime.  Treating an empty ``primaryEntities`` array as
    a complete database design made the DATABASE lane impossible to verify.
    This default adds no domain meaning; it only declares the already selected
    COMMON_PROCESS_COMMAND_RUNTIME storage boundary.
    """
    persistence = copy.deepcopy(step["persistence_contract"])
    if (
        not step["screen_contract"]
        and not step["field_contract"]
        and step["command_contract"]
        and step["api_contract"]
        and persistence.get("migrationRequired") is True
        and not persistence.get("primaryEntities")
    ):
        persistence["primaryEntities"] = [
            "framework_process_execution",
            "framework_process_execution_event",
            "framework_process_work_draft",
        ]
        persistence["fieldMappings"] = [
            {"contextKey": "tenantId", "entity": "framework_process_execution", "column": "tenant_id"},
            {"contextKey": "projectId", "entity": "framework_process_execution", "column": "project_id"},
            {"contextKey": "recordId", "entity": "framework_process_execution", "column": "execution_id"},
            {"contextKey": "statusCode", "entity": "framework_process_execution", "column": "current_state"},
            {"contextKey": "rowVersion", "entity": "framework_process_work_draft", "column": "draft_version"},
            {"contextKey": "payload", "entity": "framework_process_work_draft", "column": "payload_json"},
        ]
        persistence["contractSource"] = "COMMON_PROCESS_COMMAND_RUNTIME"
    return persistence


def render_step(
    process: dict[str, Any], step: dict[str, Any], shared_screens: list[dict[str, Any]]
) -> dict[str, Any]:
    validate_step(process, step)
    executable_tests = [
        case for case in step["test_contract"]
        if case.get("status") in {"APPROVED", "VERIFIED"}
        and case.get("steps") and case.get("assertions")
    ]
    pages = []
    field_by_audience = group_fields_by_audience(step["field_contract"])
    for page in screens_for_step(step, shared_screens):
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
            "fields": field_by_audience.get(audience, field_by_audience.get("*", [])),
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
        "frontend": {
            "renderer": "COMMON_SDUI_RUNTIME",
            "required": bool(step["screen_contract"] or step["field_contract"]),
            "pages": pages,
        },
        "backend": {
            "runtime": "COMMON_PROCESS_COMMAND_RUNTIME", "apis": step["api_contract"],
            "commands": step["command_contract"], "authorization": step["actor_contract"],
            "handoffs": step["handoff_contract"],
        },
        "database": persistence_for_step(step),
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
        shared_screens = [
            screen
            for process_step in process.get("steps", [])
            for screen in process_step.get("screen_contract", [])
        ]
        for step in process.get("steps", []):
            if step.get("approval_status") != "APPROVED" and not args.allow_review_required:
                skipped_review += 1
                continue
            package = render_step(process, step, shared_screens)
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
