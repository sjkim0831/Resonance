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
        "output_contract", "handoff_contract", "guide_contract", "nonfunctional_contract",
    )
    required_arrays = (
        "command_contract", "api_contract",
        "test_contract", "blocker_codes",
    )
    for key in required_objects:
        if not isinstance(step.get(key), dict):
            fail(f"{identity}: {key} must be an object")
    actor_contract = step["actor_contract"]
    if (actor_contract.get("contractType") != "STEP_ACTOR_AUTHORITY"
            or not isinstance(actor_contract.get("actorCode"), str)
            or not actor_contract["actorCode"]
            or actor_contract.get("scope") not in {"GLOBAL", "TENANT", "PROJECT", "TENANT_PROJECT"}
            or not isinstance(actor_contract.get("policy"), dict)
            or not isinstance(actor_contract.get("permissions"), list)
            or not isinstance(actor_contract.get("delegation"), dict)
            or not isinstance(actor_contract.get("extensions"), dict)):
        fail(f"{identity}: actor_contract must be a STEP_ACTOR_AUTHORITY object")
    transition_contract = step["transition_contract"]
    if (transition_contract.get("contractType") != "STEP_TRANSITION"
            or not isinstance(transition_contract.get("fromState"), str)
            or not transition_contract["fromState"]
            or not isinstance(transition_contract.get("toState"), str)
            or not transition_contract["toState"]
            or not isinstance(transition_contract.get("policy"), dict)
            or not isinstance(transition_contract.get("guards"), list)
            or not isinstance(transition_contract.get("sideEffects"), list)
            or not isinstance(transition_contract.get("extensions"), dict)):
        fail(f"{identity}: transition_contract must be a STEP_TRANSITION object")
    if step["input_contract"].get("contractType") != "STEP_INPUT" or not isinstance(step["input_contract"].get("schema"), dict):
        fail(f"{identity}: input_contract must be a STEP_INPUT object")
    if step["output_contract"].get("contractType") != "STEP_OUTPUT" or not isinstance(step["output_contract"].get("schema"), dict):
        fail(f"{identity}: output_contract must be a STEP_OUTPUT object")
    persistence_contract = step["persistence_contract"]
    if persistence_contract.get("contractType") != "STEP_PERSISTENCE" or not isinstance(persistence_contract.get("policy"), dict) or not isinstance(persistence_contract.get("mappings"), list) or not isinstance(persistence_contract.get("extensions"), dict):
        fail(f"{identity}: persistence_contract must be a STEP_PERSISTENCE object")
    for key in required_arrays:
        if not isinstance(step.get(key), list):
            fail(f"{identity}: {key} must be an array")
    if not isinstance(step.get("screen_contract"), (list, dict)):
        fail(f"{identity}: screen_contract must be an array or path contract object")
    field_contract = step.get("field_contract")
    if not isinstance(field_contract, dict) or field_contract.get("contractType") != "STEP_FIELDS" or not isinstance(field_contract.get("fields"), list):
        fail(f"{identity}: field_contract must be a STEP_FIELDS object")
    handoff_contract = step.get("handoff_contract")
    if handoff_contract.get("contractType") != "STEP_HANDOFF" or not isinstance(handoff_contract.get("policy"), dict) or not isinstance(handoff_contract.get("transitions"), list):
        fail(f"{identity}: handoff_contract must be a STEP_HANDOFF object")
    if step.get("design_status") != "DESIGN_COMPLETE" or step["blocker_codes"]:
        fail(f"{identity}: design is blocked: {step.get('blocker_codes')}")


def normalize_step_contract(step: dict[str, Any]) -> dict[str, Any]:
    """Normalize singleton JSON contracts before deterministic validation.

    PostgreSQL stores command/API/test contracts as JSONB and older approved
    rows may contain one object instead of a one-item array. This is a shape
    normalization only; it never invents fields, actions, or business rules.
    """
    normalized = copy.deepcopy(step)
    actor = normalized.get("actor_contract")
    if not isinstance(actor, dict):
        actor = {}
    actor_policy_keys = {
        "assignmentRequired", "serverAuthorization", "tenantIsolation", "tenantScoped",
        "projectIsolation", "delegationChecked", "segregationOfDuties", "segregationRequired",
    }
    actor_core_keys = {
        "schemaVersion", "contractType", "actorCode", "ownerActorCode", "scope", "policy",
        "permissions", "delegation", "extensions",
    }
    tenant_isolated = actor.get("tenantIsolation", actor.get("tenantScoped", False)) is True
    project_isolated = actor.get("projectIsolation", False) is True
    derived_scope = "TENANT_PROJECT" if tenant_isolated and project_isolated else "TENANT" if tenant_isolated else "PROJECT" if project_isolated else "GLOBAL"
    if actor.get("contractType") == "STEP_ACTOR_AUTHORITY" and isinstance(actor.get("policy"), dict):
        actor_policy = actor["policy"]
    else:
        actor_policy = {key: actor[key] for key in actor_policy_keys if key in actor}
        if "tenantScoped" in actor_policy:
            actor_policy.setdefault("tenantIsolation", actor_policy["tenantScoped"])
            actor_policy.pop("tenantScoped")
        if "segregationRequired" in actor_policy:
            actor_policy.setdefault("segregationOfDuties", actor_policy["segregationRequired"])
            actor_policy.pop("segregationRequired")
    normalized["actor_contract"] = {
        "schemaVersion": 1,
        "contractType": "STEP_ACTOR_AUTHORITY",
        "actorCode": actor.get("actorCode"),
        "ownerActorCode": actor.get("ownerActorCode"),
        "scope": actor.get("scope") or derived_scope,
        "policy": actor_policy,
        "permissions": actor.get("permissions") if isinstance(actor.get("permissions"), list) else [],
        "delegation": actor.get("delegation") if isinstance(actor.get("delegation"), dict) else {},
        "extensions": (actor.get("extensions") if actor.get("contractType") == "STEP_ACTOR_AUTHORITY" and isinstance(actor.get("extensions"), dict)
                       else {key: value for key, value in actor.items() if key not in actor_core_keys | actor_policy_keys}),
    }
    transition = normalized.get("transition_contract")
    if not isinstance(transition, dict):
        transition = {}
    transition_policy_keys = {"optimisticLock", "idempotencyRequired", "auditRequired", "invalidStatesRejected"}
    transition_core_keys = {
        "schemaVersion", "contractType", "commandCode", "fromState", "from", "toState", "to",
        "stepOrder", "stepType", "parentStepCode", "completionRule", "policy", "guards",
        "sideEffects", "extensions",
    }
    normalized["transition_contract"] = {
        "schemaVersion": 1,
        "contractType": "STEP_TRANSITION",
        "commandCode": transition.get("commandCode"),
        "fromState": transition.get("fromState", transition.get("from")),
        "toState": transition.get("toState", transition.get("to")),
        "stepOrder": transition.get("stepOrder"),
        "stepType": transition.get("stepType"),
        "parentStepCode": transition.get("parentStepCode"),
        "completionRule": transition.get("completionRule"),
        "policy": (transition.get("policy") if transition.get("contractType") == "STEP_TRANSITION" and isinstance(transition.get("policy"), dict)
                   else {key: transition[key] for key in transition_policy_keys if key in transition}),
        "guards": transition.get("guards") if isinstance(transition.get("guards"), list) else [],
        "sideEffects": transition.get("sideEffects") if isinstance(transition.get("sideEffects"), list) else [],
        "extensions": (transition.get("extensions") if transition.get("contractType") == "STEP_TRANSITION" and isinstance(transition.get("extensions"), dict)
                       else {key: value for key, value in transition.items() if key not in transition_core_keys | transition_policy_keys}),
    }
    for key, contract_type in (("input_contract", "STEP_INPUT"), ("output_contract", "STEP_OUTPUT")):
        value = normalized.get(key)
        if not isinstance(value, dict):
            value = {}
        if value.get("contractType") == contract_type and isinstance(value.get("schema"), dict):
            normalized[key] = {"schemaVersion": 1, "contractType": contract_type, "schema": value["schema"]}
        else:
            normalized[key] = {"schemaVersion": 1, "contractType": contract_type, "schema": value}
    persistence = normalized.get("persistence_contract")
    if not isinstance(persistence, dict):
        persistence = {}
    if persistence.get("contractType") == "STEP_PERSISTENCE":
        normalized["persistence_contract"] = {
            "schemaVersion": 1, "contractType": "STEP_PERSISTENCE",
            "schemaSetVersion": persistence.get("schemaSetVersion"),
            "policy": persistence.get("policy") if isinstance(persistence.get("policy"), dict) else {},
            "mappings": persistence.get("mappings") if isinstance(persistence.get("mappings"), list) else [],
            "extensions": persistence.get("extensions") if isinstance(persistence.get("extensions"), dict) else {},
        }
    else:
        policy_keys = {"transactional", "migrationRequired", "optimisticLock", "tenantIsolated", "projectIsolated"}
        normalized["persistence_contract"] = {
            "schemaVersion": 1, "contractType": "STEP_PERSISTENCE",
            "schemaSetVersion": persistence.get("schemaSetVersion"),
            "policy": {key: persistence[key] for key in policy_keys if key in persistence},
            "mappings": persistence.get("mappings") if isinstance(persistence.get("mappings"), list) else [],
            "extensions": {key: value for key, value in persistence.items() if key not in policy_keys | {"schemaSetVersion", "mappings"}},
        }
    for key in ("command_contract", "api_contract", "test_contract", "blocker_codes"):
        value = normalized.get(key)
        if isinstance(value, dict):
            normalized[key] = [value] if value else []
        elif value is None:
            normalized[key] = []
    handoff = normalized.get("handoff_contract")
    if isinstance(handoff, list):
        normalized["handoff_contract"] = {"schemaVersion": 1, "contractType": "STEP_HANDOFF", "policy": {}, "transitions": handoff}
    elif isinstance(handoff, dict) and handoff.get("contractType") == "STEP_HANDOFF":
        normalized["handoff_contract"] = {
            "schemaVersion": 1, "contractType": "STEP_HANDOFF",
            "policy": handoff.get("policy") if isinstance(handoff.get("policy"), dict) else {},
            "transitions": handoff.get("transitions") if isinstance(handoff.get("transitions"), list) else [],
        }
    elif isinstance(handoff, dict):
        normalized["handoff_contract"] = {"schemaVersion": 1, "contractType": "STEP_HANDOFF", "policy": handoff, "transitions": []}
    else:
        normalized["handoff_contract"] = {"schemaVersion": 1, "contractType": "STEP_HANDOFF", "policy": {}, "transitions": []}
    return normalized


def group_fields_by_audience(field_contract: dict[str, Any] | list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Accept both legacy audience groups and the current flat field contract.

    Structured professional contracts store one field per array item and apply
    that list to every screen unless a field declares an audience. Older
    contracts wrap fields in ``{"audience": ..., "fields": [...]}``. Some
    catalog contracts group fields before audience partitioning, so the wrapper
    has no audience while every nested field does. Split that shape by the
    nested audience instead of rejecting otherwise complete governed designs.
    Keeping all three forms deterministic lets immutable, already-applied
    contracts and new contracts share the same generator.
    """
    grouped: dict[str, list[dict[str, Any]]] = {}
    shared: list[dict[str, Any]] = []
    items = field_contract.get("fields", []) if isinstance(field_contract, dict) else field_contract
    for item in items:
        if not isinstance(item, dict):
            fail("field_contract entries must be objects")
        nested_fields = item.get("fields")
        if isinstance(nested_fields, list):
            audience = item.get("audience")
            if isinstance(audience, str) and audience:
                normalized_fields = []
                for nested_field in nested_fields:
                    if not isinstance(nested_field, dict) or "fieldCode" not in nested_field:
                        fail("grouped field_contract entries require fieldCode")
                    normalized_field = dict(nested_field)
                    normalized_field.setdefault("code", normalized_field["fieldCode"])
                    normalized_fields.append(normalized_field)
                grouped.setdefault(audience, []).extend(normalized_fields)
                continue
            for nested_field in nested_fields:
                if not isinstance(nested_field, dict):
                    fail("grouped field_contract fields must be objects")
                nested_audience = nested_field.get("audience")
                if not isinstance(nested_audience, str) or not nested_audience:
                    fail("grouped field_contract entries require audience")
                if "fieldCode" not in nested_field:
                    fail("grouped field_contract entries require fieldCode")
                normalized_field = dict(nested_field)
                normalized_field.setdefault("code", normalized_field["fieldCode"])
                grouped.setdefault(nested_audience, []).append(normalized_field)
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
    if isinstance(screens, list) and screens:
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
    contract = step["persistence_contract"]
    persistence = copy.deepcopy(contract.get("extensions", {}))
    persistence.update(copy.deepcopy(contract.get("policy", {})))
    persistence["mappings"] = copy.deepcopy(contract.get("mappings", []))
    if contract.get("schemaSetVersion") is not None:
        persistence["schemaSetVersion"] = contract["schemaSetVersion"]
    mappings = persistence.get("mappings")
    if isinstance(mappings, list) and not persistence.get("primaryEntities"):
        primary_entities = sorted({
            mapping.get("primaryEntity")
            for mapping in mappings
            if isinstance(mapping, dict)
            and isinstance(mapping.get("primaryEntity"), str)
            and mapping["primaryEntity"]
        })
        if primary_entities:
            persistence["primaryEntities"] = primary_entities
    if persistence.get("transactional") is True and step["command_contract"]:
        persistence.setdefault("historyRequired", True)
        # The common command runtime persists mutable workflow state and its
        # immutable event history. Every generated database contract therefore
        # requires lookup indexes and validated relationships, even when older
        # design rows predate these explicit flags.
        persistence.setdefault("indexesRequired", True)
        persistence.setdefault("foreignKeysRequired", True)
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


def apis_for_step(step: dict[str, Any]) -> list[dict[str, Any]]:
    """Normalize legacy references to the selected common command API."""
    apis = copy.deepcopy(step["api_contract"])
    if step["command_contract"]:
        for api in apis:
            if not api.get("path") and not api.get("declaredContract"):
                api["declaredContract"] = "COMMON_PROCESS_EXECUTION_RUNTIME_V1"
                api.setdefault("method", "CONTRACT")
    return apis


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
            "transition": step["transition_contract"], "input": step["input_contract"]["schema"],
            "output": step["output_contract"]["schema"], "guide": step["guide_contract"],
        },
        "frontend": {
            "renderer": "COMMON_SDUI_RUNTIME",
            "required": bool(step["screen_contract"] or step["field_contract"]),
            "pages": pages,
        },
        "backend": {
            "runtime": "COMMON_PROCESS_COMMAND_RUNTIME", "apis": apis_for_step(step),
            "commands": step["command_contract"], "authorization": step["actor_contract"],
            "handoffPolicy": step["handoff_contract"]["policy"],
            "handoffs": step["handoff_contract"]["transitions"],
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
    for process in data["processes"]:
        process["steps"] = [normalize_step_contract(step) for step in process.get("steps", [])]
    packages: list[tuple[str, dict[str, Any]]] = []
    skipped_review = 0
    for process in data["processes"]:
        shared_screens = [
            screen
            for process_step in process.get("steps", [])
            for screen in (process_step.get("screen_contract", []) if isinstance(process_step.get("screen_contract"), list) else [])
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
