#!/usr/bin/env python3
"""Fast, deterministic actor/process package tests with hash-based caching."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any

REQUIRED_SCENARIOS = {"HAPPY_PATH", "EXCEPTION", "AUTHORITY", "ISOLATION", "RECOVERY"}
SERVER_CONTEXT_FIELDS = {
    "tenantId", "projectId", "processCode", "stepCode", "actorCode", "fromState",
    "stepOrder", "idempotencyKey", "commandCode", "businessPayload",
}
UI_FIELD_ALIASES = {"payload": "businessData"}
JSON_SCHEMA_KEYS = {
    "$id", "$schema", "additionalProperties", "allOf", "anyOf", "definitions",
    "description", "else", "forbidden", "if", "items", "not", "oneOf",
    "patternProperties", "properties", "required", "then", "title", "type",
}


def input_field_names(schema: dict[str, Any]) -> set[str]:
    if not isinstance(schema, dict):
        return set()
    embedded = schema.get("contract")
    if isinstance(embedded, str):
        try:
            decoded = json.loads(embedded)
        except json.JSONDecodeError:
            decoded = None
        if isinstance(decoded, dict):
            return input_field_names(decoded)
    if isinstance(schema.get("properties"), dict):
        return set(schema["properties"])
    if isinstance(schema.get("fields"), list):
        return {
            item.get("fieldCode") for item in schema["fields"]
            if isinstance(item, dict) and item.get("fieldCode")
        }
    if isinstance(schema.get("required"), list):
        return {value for value in schema["required"] if isinstance(value, str) and value}
    return set(schema) - JSON_SCHEMA_KEYS


def stable(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def load(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def package_paths(target: Path) -> list[Path]:
    if target.is_file() and target.name != "index.json":
        return [target]
    index = target if target.is_file() else target / "index.json"
    manifest = load(index)
    if manifest.get("schemaVersion") != "2.0.0":
        raise ValueError(f"{index}: unsupported schema")
    return [index.parent / item["package"] for item in manifest.get("packages", [])]


def require(condition: bool, message: str, failures: list[str]) -> None:
    if not condition:
        failures.append(message)


def test_package(path: Path) -> dict[str, Any]:
    started = time.perf_counter()
    package = load(path)
    failures: list[str] = []
    process = package.get("process", {})
    step = package.get("step", {})
    frontend = package.get("frontend", {})
    backend = package.get("backend", {})
    database = package.get("database", {})
    tests = package.get("tests", [])
    execution = package.get("testExecution", {})
    nonfunctional = package.get("nonfunctional", {})

    identity = f"{process.get('code', '?')}/{step.get('code', '?')}"
    require(package.get("schemaVersion") == "2.0.0", "schemaVersion", failures)
    require(bool(process.get("code") and step.get("code")), "identity", failures)
    require(package.get("approvalStatus") == "APPROVED", "approval", failures)
    require(frontend.get("renderer") == "COMMON_SDUI_RUNTIME", "common SDUI renderer", failures)
    require(backend.get("runtime") == "COMMON_PROCESS_COMMAND_RUNTIME", "common command runtime", failures)
    require(execution.get("runner") == "FAST_PROCESS_CONTRACT_RUNNER", "fast test runner", failures)
    require(execution.get("parallelSafe") is True, "parallel safety", failures)
    require(execution.get("liveSmokeRequiredForVerified") is True, "live smoke gate", failures)

    actor = step.get("actor", {}).get("actorCode")
    transition = step.get("transition", {})
    commands = backend.get("commands", [])
    require(bool(actor), "actor", failures)
    require(bool(commands), "command", failures)
    matching_transition_commands = []
    for command in commands:
        require(command.get("actorCode") == actor, "command actor mismatch", failures)
        require(command.get("serverAuthorization") is True, "server authorization", failures)
        if command.get("commandCode") == transition.get("commandCode"):
            matching_transition_commands.append(command)
            require(command.get("entryState") == transition.get("fromState"), "entry state mismatch", failures)
            require(command.get("resultState") == transition.get("toState"), "result state mismatch", failures)
    require(bool(matching_transition_commands), "transition command mismatch", failures)

    pages = frontend.get("pages", [])
    frontend_required = frontend.get("required", True)
    require(frontend_required is True or pages == [], "unexpected page for backend-only step", failures)
    if frontend_required:
        require(bool(pages), "page", failures)
    page_audiences: set[str] = set()
    for page in pages:
        audience = page.get("audience")
        require(audience not in page_audiences, "duplicate audience page", failures)
        page_audiences.add(audience)
        require(str(page.get("route", "")).startswith("/"), "route", failures)
        require(page.get("layout") == "COMMON_KRDS_TASK_LAYOUT", "common layout", failures)
        require(page.get("theme") == "COMMON_KRDS_GOV", "common theme", failures)
        # Professional completeness is semantic, not an arbitrary field count:
        # a four-field approval form can be complete while a 40-field form can
        # still omit a required command input. Required-field checks below are
        # the authoritative quality gate.
        require(bool(page.get("fields")), "professional field contract", failures)
        field_codes = {field.get("code") for field in page.get("fields", [])}
        input_contract = step.get("input", {})
        input_field_codes = input_field_names(input_contract)
        client_input_fields = input_field_codes - SERVER_CONTEXT_FIELDS
        for field in client_input_fields:
            rendered_field = UI_FIELD_ALIASES.get(field, field)
            require(rendered_field in field_codes, f"required field {field}", failures)
        accessibility = page.get("accessibility", {})
        require(accessibility.get("keyboard") is True, "keyboard accessibility", failures)
        responsive = page.get("responsive", {})
        require(bool(responsive.get("mobile") and responsive.get("desktop")), "responsive contract", failures)

    scenario_types = {case.get("type") for case in tests if case.get("status") == "APPROVED"}
    require(REQUIRED_SCENARIOS <= scenario_types, "five scenario types", failures)
    require(len({case.get("caseCode") for case in tests}) == len(tests), "unique test cases", failures)
    for case in tests:
        require(bool(case.get("steps")), "test steps", failures)
        require(bool(case.get("assertions")), "test assertions", failures)

    require(database.get("transactional") is True, "transaction", failures)
    require(database.get("historyRequired") is True, "history", failures)
    require(database.get("indexesRequired") is True, "database indexes", failures)
    require(database.get("foreignKeysRequired") is True, "database foreign keys", failures)
    if database.get("migrationRequired") is True:
        require(bool(database.get("primaryEntities")), "database primary entities", failures)
    security = nonfunctional.get("security", {})
    require(security.get("tenantIsolation") is True, "tenant isolation", failures)
    require(security.get("projectIsolation") is True, "project isolation", failures)
    require(security.get("serverAuthorization") is True, "security authorization", failures)
    require(nonfunctional.get("recovery", {}).get("resumeFromLastVerifiedState") is True, "recovery", failures)

    expected_hash = package.get("packageHash")
    unhashed = dict(package)
    unhashed.pop("packageHash", None)
    actual_hash = hashlib.sha256(stable(unhashed).encode()).hexdigest()
    require(expected_hash == actual_hash, "package hash", failures)
    return {
        "identity": identity,
        "package": str(path),
        "packageHash": expected_hash,
        "status": "PASSED" if not failures else "FAILED",
        "failures": failures,
        "scenarioCount": len(tests),
        "pageCount": len(pages),
        "durationMs": round((time.perf_counter() - started) * 1000, 3),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("target", type=Path)
    parser.add_argument("--evidence", type=Path)
    parser.add_argument("--cache-dir", type=Path)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    started = time.perf_counter()
    results: list[dict[str, Any]] = []
    for path in package_paths(args.target):
        package = load(path)
        package_hash = package.get("packageHash", "missing")
        cache = args.cache_dir / f"{package_hash}.pass.json" if args.cache_dir else None
        if cache and cache.is_file() and not args.force:
            result = load(cache)
            result["cached"] = True
        else:
            result = test_package(path)
            result["cached"] = False
            if cache and result["status"] == "PASSED":
                cache.parent.mkdir(parents=True, exist_ok=True)
                cache.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        results.append(result)
    summary = {
        "schemaVersion": "1.0.0",
        "status": "PASSED" if results and all(item["status"] == "PASSED" for item in results) else "FAILED",
        "packageCount": len(results),
        "cachedCount": sum(bool(item.get("cached")) for item in results),
        "durationMs": round((time.perf_counter() - started) * 1000, 3),
        "results": results,
    }
    if args.evidence:
        args.evidence.parent.mkdir(parents=True, exist_ok=True)
        args.evidence.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(stable(summary))
    raise SystemExit(0 if summary["status"] == "PASSED" else 1)


if __name__ == "__main__":
    main()
