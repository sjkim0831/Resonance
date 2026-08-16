#!/usr/bin/env python3
"""Fast, deterministic actor/process package tests with hash-based caching."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import struct
import time
from pathlib import Path
from typing import Any

REQUIRED_SCENARIOS = {"HAPPY_PATH", "EXCEPTION", "AUTHORITY", "ISOLATION", "RECOVERY"}
VALIDATOR_CONTRACT = "FAST_PROCESS_PACKAGE_V3_COMPOSITE_TEST_AUTHORITY"
COMPOSITE_TEST_CASE_SCHEMA = "carbonet.composite-test-case/v2"
COMPOSITE_TEST_EXECUTION_SCHEMA = "carbonet.composite-test-execution/v3"
COMPOSITE_TEST_RUNNER = "DETERMINISTIC_COMPOSITE_CONTRACT_RUNNER_V2"
COMPOSITE_EXPECTED_STATUSES = {
    "SUCCESS", "VALIDATION_ERROR", "FORBIDDEN", "CONFLICT", "RECOVERY",
}
COMPOSITE_STATUS_HTTP = {
    "SUCCESS": 200, "VALIDATION_ERROR": 400, "FORBIDDEN": 403,
    "CONFLICT": 409, "RECOVERY": 200,
}
COMPOSITE_STATUS_ORDER = [
    "SUCCESS", "VALIDATION_ERROR", "FORBIDDEN", "CONFLICT", "RECOVERY",
]
RUNTIME_SUCCESS_FIELDS = ["success", "idempotent", "eventId", "toState"]
ERROR_RESPONSE_FIELDS = ["success", "code", "message"]
RUNTIME_RESULT_TYPES = {
    "success": "BOOLEAN", "idempotent": "BOOLEAN", "eventId": "INTEGER", "toState": "STRING",
}
ERROR_RESPONSE_VALUES = {
    "VALIDATION_ERROR": {"success": False, "code": "INVALID_REQUEST", "message": "Request failed"},
    "FORBIDDEN": {"success": False, "code": "ACCESS_DENIED", "message": "Access denied"},
    "CONFLICT": {"success": False, "code": "CONFLICT", "message": "Request conflicts with the current state"},
}
COMPOSITE_STATUS_SCENARIO_TYPES = {
    "SUCCESS": "HAPPY_PATH", "VALIDATION_ERROR": "EXCEPTION",
    "FORBIDDEN": "AUTHORITY", "CONFLICT": "ISOLATION", "RECOVERY": "RECOVERY",
}
COMPOSITE_ASSERTION_CODES = {
    "STATUS_MATCH", "OUTPUT_FIELDS_MATCH", "RULES_PASS", "VALIDATION_PASS",
    "NOTIFICATION_QUEUED", "RELAY_READY",
}
COMPOSITE_CASE_CODE = re.compile(r"^COMPOSITE_[0-9A-F]{24}$")
DB_ID = re.compile(r"^[a-z][a-z0-9_]{0,62}$")
DB_TYPE = re.compile(
    r"^(uuid|bigint|bigserial|integer|boolean|text|jsonb|date|timestamp|timestamptz|"
    r"varchar\([1-9][0-9]{0,4}\)|numeric\([1-9][0-9]?,[0-9]{1,2}\))$"
)
PHYSICAL_TEST_LANES = ["API", "DATABASE", "BROWSER"]
RESULT_KEYS = {
    "validatorContract", "identity", "package", "packageHash", "status", "failures",
    "scenarioCount", "compositeScenarioCount", "compositeExpectedStatuses",
    "executionScope", "liveSmokeStatus", "pageCount", "durationMs", "evidenceHash",
}
DESIGN_AUTHORITY_SOURCES = {
    "STEP_EXECUTION_SPEC_SCREEN_CONTRACT",
    "LEGACY_REGISTERED_DEFAULT",
}
GOVERNED_DESIGN_CODE_SHAPE = re.compile(r"^[A-Z][A-Z0-9_]{1,79}$")
REGISTERED_LEGACY_DEFAULTS = {
    "layout": "RESPONSIVE_WORKSPACE",
    "theme": "KRDS_GOV_DEFAULT",
}
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


def literal_output(value: Any) -> dict[str, Any]:
    return {"source": "LITERAL", "value": value}


def path_output(source: str, path: str) -> dict[str, Any]:
    return {"source": source, "path": path}


def expected_status_output(operation: dict[str, Any], status: str) -> dict[str, Any]:
    if status in ERROR_RESPONSE_VALUES:
        return {field: literal_output(value)
                for field, value in ERROR_RESPONSE_VALUES[status].items()}
    projection = operation.get("responseProjection", [])
    if not isinstance(projection, list) or any(not isinstance(row, dict) for row in projection):
        return {}
    if status == "SUCCESS":
        expected: dict[str, Any] = {
            "success": literal_output(True), "idempotent": literal_output(False),
            "eventId": path_output("DATABASE_EVENT", "eventId"),
            "toState": path_output("DECLARED_STATE", "toState"),
        }
        for row in projection:
            field = row.get("fieldCode")
            source_path = row.get("sourcePath")
            if row.get("source") == "REQUEST":
                expected[field] = path_output("REQUEST", source_path)
            elif source_path == "eventId":
                expected[field] = path_output("DATABASE_EVENT", "eventId")
            elif source_path == "toState":
                expected[field] = path_output("DECLARED_STATE", "toState")
            elif source_path == "success":
                expected[field] = literal_output(True)
            elif source_path == "idempotent":
                expected[field] = literal_output(False)
        return expected
    expected = {
        "success": literal_output(True), "idempotent": literal_output(True),
        "eventId": path_output("REFERENCE_SCENARIO", "eventId"),
        "toState": path_output("REFERENCE_SCENARIO", "toState"),
        "recovered": literal_output(True),
    }
    for row in projection:
        field = row.get("fieldCode")
        expected[field] = (path_output("REQUEST", row.get("sourcePath"))
                           if row.get("source") == "REQUEST"
                           else path_output("REFERENCE_SCENARIO", field))
    return expected


def predicate_passes(rule: dict[str, Any], values: dict[str, Any]) -> bool:
    """Execute the same allow-listed predicate semantics as the generator.

    The fast gate must recompute validation evidence from inputs.  Trusting a
    projected ``staticPredicateFailures`` array would let a forged package claim
    that a perfectly valid value triggers VALIDATION_ERROR.
    """
    actual = values.get(rule.get("fieldCode"))
    expected = rule.get("expectedValue")
    operator = rule.get("operator")
    if operator == "REQUIRED":
        return actual is not None and str(actual).strip() != ""
    if operator in {"EQ", "NE"}:
        equal = actual is not None and str(actual) == expected
        return equal if operator == "EQ" else actual is not None and not equal
    if operator not in {"GT", "GTE", "LT", "LTE"}:
        return False
    try:
        actual_number, expected_number = float(actual), float(expected)
    except (TypeError, ValueError):
        return False
    return {"GT": actual_number > expected_number, "GTE": actual_number >= expected_number,
            "LT": actual_number < expected_number, "LTE": actual_number <= expected_number}[operator]


def composite_case_group(case: dict[str, Any]) -> tuple[Any, Any, Any, Any, Any]:
    identity = case.get("identity") if isinstance(case.get("identity"), dict) else {}
    return (identity.get("processCode"), identity.get("stepCode"),
            identity.get("routePath"), identity.get("audience"), case.get("commandCode"))


def java_stable(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, dict):
        return "{" + ",".join(
            java_stable(str(key)) + ":" + java_stable(value[key])
            for key in sorted(value, key=lambda item: str(item).encode(
                "utf-16-be", "surrogatepass"))
        ) + "}"
    if isinstance(value, list):
        return "[" + ",".join(java_stable(item) for item in value) + "]"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        number = float(value)
        if number != number or number in (float("inf"), float("-inf")):
            raise ValueError("non-finite composite database number")
        if number == 0:
            number = 0.0
        return "@" + struct.pack(">d", number).hex()
    if isinstance(value, str):
        if any(0xD800 <= ord(item) <= 0xDFFF for item in value):
            raise ValueError("unpaired surrogate in composite database contract")
        return '"' + value.encode("utf-8").hex() + '"'
    raise ValueError("non-JSON composite database value")


def java_hash(value: Any) -> str:
    return hashlib.sha256(java_stable(value).encode()).hexdigest()


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


def validate_page_design_authority(page: dict[str, Any], failures: list[str]) -> None:
    authority = page.get("designAuthority")
    require(isinstance(authority, dict), "design authority", failures)
    if not isinstance(authority, dict):
        return
    source = authority.get("source")
    defaulted = authority.get("defaulted")
    require(source in DESIGN_AUTHORITY_SOURCES, "design authority source", failures)
    valid_defaulted = (
        isinstance(defaulted, list)
        and all(isinstance(key, str) for key in defaulted)
    )
    require(
        valid_defaulted
        and len(defaulted) == len(set(defaulted))
        and set(defaulted) <= set(REGISTERED_LEGACY_DEFAULTS),
        "design authority defaulted keys",
        failures,
    )
    if not valid_defaulted:
        defaulted = []
    require(
        (source == "LEGACY_REGISTERED_DEFAULT") == bool(defaulted),
        "design authority fallback provenance",
        failures,
    )
    for key, legacy_default in REGISTERED_LEGACY_DEFAULTS.items():
        value = page.get(key)
        require(authority.get(key) == value, f"{key} snapshot projection", failures)
        require(
            isinstance(value, str) and bool(GOVERNED_DESIGN_CODE_SHAPE.fullmatch(value)),
            f"{key} governed code syntax",
            failures,
        )
        if key in defaulted:
            require(value == legacy_default, f"{key} registered legacy default", failures)


def has_composite_marker(package: dict[str, Any]) -> bool:
    backend = package.get("backend") if isinstance(package.get("backend"), dict) else {}
    database = package.get("database") if isinstance(package.get("database"), dict) else {}
    execution = package.get("testExecution") if isinstance(package.get("testExecution"), dict) else {}
    frontend = package.get("frontend") if isinstance(package.get("frontend"), dict) else {}
    tests = package.get("tests") if isinstance(package.get("tests"), list) else []
    pages = frontend.get("pages") if isinstance(frontend.get("pages"), list) else []
    return any((
        any(isinstance(case, dict) and case.get("schema") == COMPOSITE_TEST_CASE_SCHEMA
            for case in tests),
        "compositeAuthoritySetHash" in package,
        "composite" in execution,
        "compositeRunner" in execution,
        "compositeAuthorities" in backend,
        "compositeMappings" in database,
        any(isinstance(page, dict) and "compositeAuthorityHash" in page for page in pages),
    ))


def validate_composite_tests(package: dict[str, Any], tests: list[Any],
                             execution: dict[str, Any], failures: list[str]) -> dict[str, Any]:
    cases = [case for case in tests if isinstance(case, dict)
             and case.get("schema") == COMPOSITE_TEST_CASE_SCHEMA]
    authority_set_hash = package.get("compositeAuthoritySetHash")
    metadata = execution.get("composite")
    backend = package.get("backend") if isinstance(package.get("backend"), dict) else {}
    database = package.get("database") if isinstance(package.get("database"), dict) else {}
    if not has_composite_marker(package):
        return {"caseCount": 0, "expectedStatuses": [], "liveSmokeStatus": "NOT_APPLICABLE"}
    require(isinstance(authority_set_hash, str)
            and bool(re.fullmatch(r"[0-9a-f]{64}", authority_set_hash)),
            "composite authority set hash", failures)
    expected_metadata_keys = {
        "schema", "runner", "authoritySetHash", "acceptedExpectedStatuses",
        "projectedExpectedStatuses", "projectedCaseCount", "projectionHash",
        "evidenceHash", "physicalExecutionLanes", "liveSmokeRequired", "liveSmokeStatus",
    }
    require(isinstance(metadata, dict) and set(metadata) == expected_metadata_keys,
            "composite testExecution metadata", failures)
    if not isinstance(metadata, dict):
        return {"caseCount": len(cases), "expectedStatuses": [], "liveSmokeStatus": "MISSING"}
    require(metadata.get("schema") == COMPOSITE_TEST_EXECUTION_SCHEMA,
            "composite execution schema", failures)
    require(metadata.get("runner") == COMPOSITE_TEST_RUNNER
            and execution.get("compositeRunner") == COMPOSITE_TEST_RUNNER,
            "composite runner", failures)
    require(metadata.get("authoritySetHash") == authority_set_hash,
            "composite authority hash projection", failures)
    require(metadata.get("acceptedExpectedStatuses") == sorted(COMPOSITE_EXPECTED_STATUSES),
            "composite accepted status semantics", failures)
    require(metadata.get("physicalExecutionLanes") == PHYSICAL_TEST_LANES,
            "composite physical execution lanes", failures)
    require(metadata.get("liveSmokeRequired") is True
            and execution.get("liveSmokeRequired") is True,
            "composite live smoke required", failures)
    require(metadata.get("liveSmokeStatus") == "QUEUED"
            and execution.get("liveSmokeStatus") == "QUEUED",
            "composite live smoke truthfully queued", failures)

    authorities = backend.get("compositeAuthorities", [])
    require(isinstance(authorities, list) and bool(authorities),
            "composite authority tests", failures)
    authority_executions: list[dict[str, Any]] = []
    projected_cases: list[dict[str, Any]] = []
    if isinstance(authorities, list):
        for authority in authorities:
            if not isinstance(authority, dict) or not isinstance(authority.get("testExecution"), dict):
                require(False, "composite authority test execution", failures)
                continue
            item = authority["testExecution"]
            authority_executions.append(item)
            expected_execution_keys = {
                "schema", "runner", "executionScope", "contractCaseCount",
                "expectedStatuses", "casesHash", "liveSmokeRequired", "liveSmokeStatus",
                "physicalExecutionLanes", "cases", "evidenceHash",
            }
            require(set(item) == expected_execution_keys
                    and item.get("schema") == COMPOSITE_TEST_EXECUTION_SCHEMA
                    and item.get("runner") == COMPOSITE_TEST_RUNNER
                    and item.get("executionScope") == "STATIC_PACKAGE_CONTRACT",
                    "composite authority execution contract", failures)
            authority_cases = item.get("cases")
            if not isinstance(authority_cases, list):
                require(False, "composite authority cases", failures)
                continue
            projected_cases.extend(case for case in authority_cases if isinstance(case, dict))
            require(item.get("contractCaseCount") == len(authority_cases),
                    "composite authority case count", failures)
            require(item.get("expectedStatuses") == sorted({
                case.get("expectedStatus") for case in authority_cases if isinstance(case, dict)}),
                    "composite authority status coverage", failures)
            require(item.get("casesHash") == hashlib.sha256(stable(authority_cases).encode()).hexdigest(),
                    "composite authority cases hash", failures)
            unhashed = dict(item); evidence_hash = unhashed.pop("evidenceHash", None)
            require(evidence_hash == hashlib.sha256(stable(unhashed).encode()).hexdigest(),
                    "composite authority evidence hash", failures)
            require(item.get("liveSmokeRequired") is True and item.get("liveSmokeStatus") == "QUEUED"
                    and item.get("physicalExecutionLanes") == PHYSICAL_TEST_LANES,
                    "composite authority live execution queued", failures)
    projected_cases.sort(key=lambda row: str(row.get("caseCode", "")))
    cases.sort(key=lambda row: str(row.get("caseCode", "")))
    require(stable(projected_cases) == stable(cases),
            "composite tests exact base projection", failures)
    statuses = sorted({case.get("expectedStatus") for case in cases})
    require(metadata.get("projectedCaseCount") == len(cases),
            "composite projected case count", failures)
    require(metadata.get("projectedExpectedStatuses") == statuses,
            "composite projected status coverage", failures)
    require(metadata.get("projectionHash") == hashlib.sha256(stable(cases).encode()).hexdigest(),
            "composite tests projection hash", failures)
    require(metadata.get("evidenceHash") == hashlib.sha256(stable(authority_executions).encode()).hexdigest(),
            "composite tests evidence projection hash", failures)

    case_keys = {
        "schema", "caseCode", "name", "type", "status", "sourceRequirement",
        "identity", "scenarioCode", "commandCode", "inputValues", "expectedStatus",
        "expectedHttpStatus", "fromState", "toState", "trigger", "expectedOutputFields",
        "expectedOutputValues", "assertionCodes", "evidence",
        "evidenceHash", "staticPredicateFailures", "steps", "assertions",
    }
    process = package.get("process", {})
    step = package.get("step", {})
    pages = package.get("frontend", {}).get("pages", [])
    grouped_cases: dict[tuple[Any, Any, Any, Any, Any], list[dict[str, Any]]] = {}
    for case in cases:
        grouped_cases.setdefault(composite_case_group(case), []).append(case)
    expected_groups: set[tuple[Any, Any, Any, Any, Any]] = set()
    for authority in authorities if isinstance(authorities, list) else []:
        if not isinstance(authority, dict):
            continue
        identity = authority.get("identity") if isinstance(authority.get("identity"), dict) else {}
        operations = authority.get("api", {}).get("operations", [])
        for operation in operations if isinstance(operations, list) else []:
            if isinstance(operation, dict):
                expected_groups.add((process.get("code"), identity.get("stepCode"),
                    identity.get("routePath"), identity.get("audience"),
                    operation.get("commandCode")))
    require(bool(expected_groups) and set(grouped_cases) == expected_groups,
            "composite command scenario coverage", failures)
    for group, command_cases in grouped_cases.items():
        statuses_for_group = [case.get("expectedStatus") for case in command_cases]
        require(len(statuses_for_group) == len(COMPOSITE_STATUS_ORDER)
                and set(statuses_for_group) == COMPOSITE_EXPECTED_STATUSES
                and len(statuses_for_group) == len(set(statuses_for_group)),
                f"composite command five-status coverage: {group}", failures)
    success_by_group: dict[tuple[Any, Any, Any, Any, Any], dict[str, Any]] = {}
    for case in cases:
        if case.get("expectedStatus") == "SUCCESS":
            success_by_group.setdefault(composite_case_group(case), case)
    for case in cases:
        prefix = f"composite {case.get('caseCode', '?')}"
        require(set(case) == case_keys, f"{prefix} exact keys", failures)
        require(isinstance(case.get("caseCode"), str)
                and bool(COMPOSITE_CASE_CODE.fullmatch(case["caseCode"])),
                f"{prefix} caseCode", failures)
        expected_status = case.get("expectedStatus")
        require(expected_status in COMPOSITE_EXPECTED_STATUSES,
                f"{prefix} expected status", failures)
        require(case.get("type") == COMPOSITE_STATUS_SCENARIO_TYPES.get(expected_status)
                and case.get("sourceRequirement") == expected_status
                and case.get("status") == "APPROVED",
                f"{prefix} status mapping", failures)
        require(case.get("name") == case.get("scenarioCode"),
                f"{prefix} scenario identity", failures)
        identity = case.get("identity")
        expected_identity_keys = {"processCode", "stepCode", "routePath", "audience"}
        require(isinstance(identity, dict) and set(identity) == expected_identity_keys,
                f"{prefix} screen identity", failures)
        if not isinstance(identity, dict):
            continue
        require(identity.get("processCode") == process.get("code")
                and identity.get("stepCode") == step.get("code"),
                f"{prefix} process/step identity", failures)
        matching_pages = [page for page in pages if isinstance(page, dict)
                          and page.get("route") == identity.get("routePath")
                          and page.get("audience") == identity.get("audience")]
        require(len(matching_pages) == 1, f"{prefix} page identity", failures)
        matching_authorities = [authority for authority in authorities if isinstance(authority, dict)
                                and authority.get("identity") == {
                                    "stepCode": identity.get("stepCode"),
                                    "routePath": identity.get("routePath"),
                                    "audience": identity.get("audience"),
                                }]
        require(len(matching_authorities) == 1, f"{prefix} authority identity", failures)
        if len(matching_pages) != 1 or len(matching_authorities) != 1:
            continue
        page = matching_pages[0]
        authority = matching_authorities[0]
        command = case.get("commandCode")
        page_commands = [row for row in page.get("commands", []) if isinstance(row, dict)
                         and row.get("commandCode") == command]
        require(len(page_commands) == 1, f"{prefix} command", failures)
        operations = authority.get("api", {}).get("operations", [])
        command_operations = [row for row in operations if isinstance(row, dict)
                              and row.get("commandCode") == command]
        require(len(command_operations) == 1, f"{prefix} API command", failures)
        if len(command_operations) != 1:
            continue
        operation = command_operations[0]
        operation_keys = {"method", "path", "commandCode", "requestFields", "responseFields",
                          "permissionCodes", "responseProjection", "statusResponses"}
        page_fields = page.get("fields") if isinstance(page.get("fields"), list) else []
        fields_by_code = {row.get("fieldCode"): row for row in page_fields
                          if isinstance(row, dict) and isinstance(row.get("fieldCode"), str)}
        require(set(operation) == operation_keys and operation.get("method") == "POST"
                and isinstance(operation.get("path"), str)
                and operation.get("path", "").startswith("/")
                and operation.get("commandCode") == command
                and isinstance(operation.get("requestFields"), list)
                and isinstance(operation.get("responseFields"), list)
                and isinstance(operation.get("permissionCodes"), list),
                f"{prefix} API physical contract", failures)
        raw_request_fields = operation.get("requestFields", [])
        raw_response_fields = operation.get("responseFields", [])
        request_fields = raw_request_fields if isinstance(raw_request_fields, list) else []
        response_fields = raw_response_fields if isinstance(raw_response_fields, list) else []
        permissions = operation.get("permissionCodes") \
            if isinstance(operation.get("permissionCodes"), list) else []
        require(all(isinstance(value, str) and value for value in request_fields
                    + response_fields + permissions)
                and len(request_fields) == len(set(request_fields))
                and len(response_fields) == len(set(response_fields))
                and len(permissions) == len(set(permissions))
                and set(request_fields + response_fields).issubset(fields_by_code)
                and all(fields_by_code[field].get("direction") in {"INPUT", "BOTH"}
                        for field in request_fields if field in fields_by_code)
                and all(fields_by_code[field].get("direction") in {"OUTPUT", "BOTH"}
                        for field in response_fields if field in fields_by_code)
                and not set(response_fields) &
                    (set(RUNTIME_SUCCESS_FIELDS) | set(ERROR_RESPONSE_FIELDS) | {"recovered"}),
                f"{prefix} API field closure", failures)
        projection = operation.get("responseProjection")
        require(isinstance(projection, list)
                and [row.get("fieldCode") for row in projection if isinstance(row, dict)]
                    == sorted(response_fields)
                and all(isinstance(row, dict)
                        and set(row) == {"fieldCode", "source", "sourcePath"}
                        and ((row.get("source") == "RUNTIME_RESULT"
                              and row.get("sourcePath") in RUNTIME_RESULT_TYPES
                              and fields_by_code.get(row.get("fieldCode"), {}).get("dataType")
                                  == RUNTIME_RESULT_TYPES.get(row.get("sourcePath")))
                             or (row.get("source") == "REQUEST"
                                 and row.get("sourcePath") == row.get("fieldCode")
                                 and row.get("sourcePath") in request_fields
                                 and fields_by_code.get(row.get("fieldCode"), {}).get("direction") == "BOTH"))
                        for row in projection or []),
                f"{prefix} response projection", failures)
        expected_bodies = {
            "SUCCESS": RUNTIME_SUCCESS_FIELDS + sorted(response_fields),
            "VALIDATION_ERROR": ERROR_RESPONSE_FIELDS,
            "FORBIDDEN": ERROR_RESPONSE_FIELDS,
            "CONFLICT": ERROR_RESPONSE_FIELDS,
            "RECOVERY": RUNTIME_SUCCESS_FIELDS + ["recovered"] + sorted(response_fields),
        }
        status_responses = operation.get("statusResponses")
        require(isinstance(status_responses, list)
                and [row.get("statusCase") for row in status_responses if isinstance(row, dict)]
                    == COMPOSITE_STATUS_ORDER
                and all(isinstance(row, dict)
                        and set(row) == {"statusCase", "httpStatus", "bodyFields"}
                        and row.get("httpStatus") == COMPOSITE_STATUS_HTTP.get(row.get("statusCase"))
                        and row.get("bodyFields") == expected_bodies.get(row.get("statusCase"))
                        for row in status_responses or []),
                f"{prefix} status response contract", failures)
        inputs = case.get("inputValues")
        require(isinstance(inputs, dict)
                and set(inputs) == set(operation.get("requestFields", []))
                and all(value is not None and not isinstance(value, (dict, list))
                        for value in inputs.values()),
                f"{prefix} input values", failures)
        outputs = case.get("expectedOutputFields")
        expected_body = expected_bodies.get(expected_status)
        require(outputs == expected_body, f"{prefix} status output fields", failures)
        require(case.get("expectedHttpStatus") == COMPOSITE_STATUS_HTTP.get(expected_status),
                f"{prefix} HTTP status", failures)
        require(case.get("expectedOutputValues") == expected_status_output(operation, expected_status),
                f"{prefix} physical output values", failures)
        transitions = [row for row in page.get("states", []) if isinstance(row, dict)
                       and row.get("commandCode") == command]
        require(len(transitions) == 1
                and transitions[0].get("fromState") == case.get("fromState")
                and transitions[0].get("toState") == case.get("toState"),
                f"{prefix} state transition", failures)
        trigger = case.get("trigger")
        success_case = success_by_group.get(composite_case_group(case))
        if expected_status == "SUCCESS":
            require(trigger == {"kind": "NEW_COMMAND"}, f"{prefix} new command trigger", failures)
        elif expected_status == "VALIDATION_ERROR":
            validation_rules = authority.get("validation", {}).get("rules", [])
            values = {**inputs, "CURRENT_STATE": case.get("fromState")} \
                if isinstance(inputs, dict) else {"CURRENT_STATE": case.get("fromState")}
            failed_validation_rules = [row for row in validation_rules
                if isinstance(row, dict) and row.get("commandCode") == command
                and not predicate_passes(row, values)] \
                if isinstance(validation_rules, list) else []
            matching_validation_rules = [row for row in validation_rules
                if isinstance(row, dict) and row.get("commandCode") == command
                and isinstance(trigger, dict)
                and row.get("fieldCode") == trigger.get("fieldCode")
                and row.get("errorCode") == trigger.get("errorCode")] \
                if isinstance(validation_rules, list) else []
            require(isinstance(trigger, dict)
                    and set(trigger) == {"kind", "fieldCode", "errorCode"}
                    and trigger.get("kind") == "DECLARED_VALIDATION_FAILURE"
                    and len(matching_validation_rules) == 1
                    and failed_validation_rules == matching_validation_rules
                    and case.get("staticPredicateFailures") == [trigger.get("errorCode")],
                    f"{prefix} validation trigger", failures)
        elif expected_status == "FORBIDDEN":
            require(trigger == {"kind": "UNASSIGNED_ACTOR"},
                    f"{prefix} unassigned actor trigger", failures)
        elif expected_status == "CONFLICT":
            require(isinstance(trigger, dict)
                    and set(trigger) == {"kind", "state", "referenceScenarioCode"}
                    and trigger.get("kind") == "STALE_STATE"
                    and trigger.get("state") == case.get("toState")
                    and isinstance(success_case, dict)
                    and trigger.get("referenceScenarioCode") == success_case.get("scenarioCode"),
                    f"{prefix} stale state trigger", failures)
        else:
            require(isinstance(trigger, dict)
                    and set(trigger) == {"kind", "referenceScenarioCode"}
                    and trigger.get("kind") == "IDEMPOTENT_REPLAY"
                    and isinstance(success_case, dict)
                    and trigger.get("referenceScenarioCode") == success_case.get("scenarioCode"),
                    f"{prefix} replay trigger", failures)
        if expected_status in {"FORBIDDEN", "CONFLICT", "RECOVERY"}:
            require(isinstance(success_case, dict)
                    and stable(inputs) == stable(success_case.get("inputValues")),
                    f"{prefix} isolated trigger input", failures)
        if expected_status in {"SUCCESS", "FORBIDDEN", "CONFLICT", "RECOVERY"}:
            validation_rules = authority.get("validation", {}).get("rules", [])
            values = {**inputs, "CURRENT_STATE": case.get("fromState")} \
                if isinstance(inputs, dict) else {"CURRENT_STATE": case.get("fromState")}
            require(isinstance(validation_rules, list)
                    and all(predicate_passes(row, values) for row in validation_rules
                            if isinstance(row, dict) and row.get("commandCode") == command),
                    f"{prefix} input passes declared validation", failures)
        assertions = case.get("assertionCodes")
        require(isinstance(assertions, list) and len(assertions) == len(set(assertions))
                and {"STATUS_MATCH", "OUTPUT_FIELDS_MATCH"}.issubset(assertions)
                and set(assertions).issubset(COMPOSITE_ASSERTION_CODES)
                and case.get("assertions") == assertions,
                f"{prefix} assertions", failures)
        evidence = case.get("evidence")
        require(isinstance(evidence, list) and bool(evidence)
                and all(isinstance(row, dict) and bool(row) for row in evidence)
                and case.get("evidenceHash") == hashlib.sha256(stable(evidence).encode()).hexdigest(),
                f"{prefix} evidence", failures)
        require(isinstance(case.get("staticPredicateFailures"), list)
                and all(isinstance(code, str) and code for code in case["staticPredicateFailures"]),
                f"{prefix} predicate evidence", failures)
        expected_step = [{
            "executor": COMPOSITE_TEST_RUNNER,
            "executionMode": "STATIC_CONTRACT_VALIDATION",
            "commandCode": command,
            "inputValues": inputs,
            "expectedStatus": expected_status,
            "expectedHttpStatus": case.get("expectedHttpStatus"),
            "expectedOutputValues": case.get("expectedOutputValues"),
            "trigger": trigger,
            "fromState": case.get("fromState"),
            "toState": case.get("toState"),
        }]
        require(case.get("steps") == expected_step, f"{prefix} runner step", failures)
    return {"caseCount": len(cases), "expectedStatuses": statuses,
            "liveSmokeStatus": metadata.get("liveSmokeStatus")}


def database_plan_valid(plan: Any) -> bool:
    if not isinstance(plan, dict) or set(plan) != {
            "entities", "verified", "migrationMode", "schemaFingerprint", "schemaChanges"}:
        return False
    mode = plan.get("migrationMode")
    changes = plan.get("schemaChanges")
    entities = plan.get("entities")
    if (plan.get("verified") is not True
            or mode not in {"REGISTERED_EXISTING", "SAFE_CREATE_TABLE", "NO_DATABASE"}
            or not isinstance(changes, list) or not isinstance(entities, list)
            or plan.get("schemaFingerprint") != java_hash(changes)):
        return False
    if mode == "NO_DATABASE":
        return changes == [] and entities == []
    operation = "CREATE_TABLE" if mode == "SAFE_CREATE_TABLE" else "REGISTERED_TABLE"
    table_fields: dict[str, set[str]] = {}
    for change in changes:
        if (not isinstance(change, dict)
                or set(change) != {"operation", "tableName", "columns",
                                   "uniqueConstraints", "indexes"}
                or change.get("operation") != operation
                or not isinstance(change.get("tableName"), str)
                or not DB_ID.fullmatch(change["tableName"])
                or change["tableName"] in table_fields
                or not isinstance(change.get("columns"), list)
                or not change["columns"]):
            return False
        names: set[str] = set()
        primary_keys = 0
        for column in change["columns"]:
            required = {"name", "type", "primaryKey", "nullable"}
            if (not isinstance(column, dict) or not required.issubset(column)
                    or not set(column).issubset(required | {"default", "references"})
                    or not isinstance(column.get("name"), str)
                    or not DB_ID.fullmatch(column["name"]) or column["name"] in names
                    or not isinstance(column.get("type"), str)
                    or not DB_TYPE.fullmatch(column["type"].lower())
                    or type(column.get("primaryKey")) is not bool
                    or type(column.get("nullable")) is not bool
                    or "default" in column and not isinstance(column["default"], str)):
                return False
            reference = column.get("references")
            if reference is not None and (
                    not isinstance(reference, dict)
                    or set(reference) != {"table", "column", "onDelete"}
                    or not isinstance(reference.get("table"), str)
                    or not DB_ID.fullmatch(reference["table"])
                    or not isinstance(reference.get("column"), str)
                    or not DB_ID.fullmatch(reference["column"])
                    or reference.get("onDelete") not in {"CASCADE", "RESTRICT", "SET NULL", "NO ACTION"}):
                return False
            names.add(column["name"])
            primary_keys += int(column["primaryKey"])
        constraints = change.get("uniqueConstraints")
        indexes = change.get("indexes")
        if (primary_keys < 1 or not isinstance(constraints, list)
                or any(not isinstance(fields, list) or not fields
                       or any(not isinstance(field, str) for field in fields)
                       or any(field not in names for field in fields) for fields in constraints)
                or not isinstance(indexes, list)):
            return False
        index_names: set[str] = set()
        for index in indexes:
            if (not isinstance(index, dict) or set(index) != {"name", "columns", "unique"}
                    or not isinstance(index.get("name"), str)
                    or not DB_ID.fullmatch(index["name"]) or index["name"] in index_names
                    or type(index.get("unique")) is not bool
                    or not isinstance(index.get("columns"), list) or not index["columns"]
                    or any(not isinstance(field, str) for field in index["columns"])
                    or any(field not in names for field in index["columns"])):
                return False
            index_names.add(index["name"])
        table_fields[change["tableName"]] = names
    entity_fields: dict[str, set[str]] = {}
    for entity in entities:
        if (not isinstance(entity, dict) or set(entity) != {"entity", "fields"}
                or not isinstance(entity.get("entity"), str)
                or not DB_ID.fullmatch(entity["entity"].lower())
                or entity["entity"].lower() in entity_fields
                or not isinstance(entity.get("fields"), list)
                or any(not isinstance(field, str) or not DB_ID.fullmatch(field)
                       for field in entity["fields"])
                or len(entity["fields"]) != len(set(entity["fields"]))):
            return False
        entity_fields[entity["entity"].lower()] = set(entity["fields"])
    return bool(changes) and entity_fields == table_fields


def validate_composite_database(package: dict[str, Any], database: dict[str, Any],
                                failures: list[str]) -> None:
    backend = package.get("backend") if isinstance(package.get("backend"), dict) else {}
    authorities = backend.get("compositeAuthorities")
    if not has_composite_marker(package):
        return
    mode = database.get("migrationMode")
    changes = database.get("schemaChanges")
    fingerprint = database.get("schemaFingerprint")
    expected_operation = {
        "REGISTERED_EXISTING": "REGISTERED_TABLE",
        "SAFE_CREATE_TABLE": "CREATE_TABLE",
        "NO_DATABASE": None,
    }.get(mode, "INVALID")
    require(expected_operation != "INVALID", "composite database migration mode", failures)
    require(isinstance(changes, list), "composite database schema changes", failures)
    if not isinstance(changes, list):
        return
    require(isinstance(fingerprint, str) and bool(re.fullmatch(r"[0-9a-f]{64}", fingerprint))
            and fingerprint == java_hash(changes),
            "composite database schema fingerprint", failures)
    require(database.get("autoGenerateMigration") is (mode == "SAFE_CREATE_TABLE"),
            "composite database generation mode", failures)
    if mode == "NO_DATABASE":
        require(changes == [], "NO_DATABASE schema changes", failures)
    elif expected_operation != "INVALID":
        require(bool(changes) and all(isinstance(change, dict)
                and change.get("operation") == expected_operation for change in changes),
                "composite database safe operations", failures)
    mappings = database.get("compositeMappings")
    require(isinstance(mappings, list) and bool(mappings),
            "composite database mappings", failures)
    if isinstance(mappings, list):
        for mapping in mappings:
            require(database_plan_valid(mapping)
                    and mapping.get("migrationMode") == mode
                    and mapping.get("schemaFingerprint") == fingerprint
                    and mapping.get("schemaChanges") == changes,
                    "composite database exact mapping", failures)
    authority_plans = ([authority.get("database") for authority in authorities
                        if isinstance(authority, dict)]
                       if isinstance(authorities, list) else [])
    require(isinstance(authorities, list) and bool(authority_plans)
            and all(isinstance(plan, dict) for plan in authority_plans),
            "composite database authority plans", failures)
    if isinstance(mappings, list):
        require(stable(authority_plans) == stable(mappings),
                "composite database authority projection", failures)


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
        validate_page_design_authority(page, failures)
        # Professional completeness is semantic, not an arbitrary field count:
        # a four-field approval form can be complete while a 40-field form can
        # still omit a required command input. Required-field checks below are
        # the authoritative quality gate.
        require(bool(page.get("fields")), "professional field contract", failures)
        field_codes = {field.get("code") or field.get("fieldCode")
                       for field in page.get("fields", []) if isinstance(field, dict)}
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

    composite_result = validate_composite_tests(package, tests, execution, failures)
    scenario_types = {case.get("type") for case in tests
                      if isinstance(case, dict) and case.get("status") == "APPROVED"}
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
    validate_composite_database(package, database, failures)
    security = nonfunctional.get("security", {})
    actor_scope = step.get("actor", {}).get("scope")
    if actor_scope in {"TENANT", "TENANT_PROJECT"}:
        require(security.get("tenantIsolation") is True, "tenant isolation", failures)
    if actor_scope in {"PROJECT", "TENANT_PROJECT"}:
        require(security.get("projectIsolation") is True, "project isolation", failures)
    require(security.get("serverAuthorization") is True, "security authorization", failures)
    require(nonfunctional.get("recovery", {}).get("resumeFromLastVerifiedState") is True, "recovery", failures)

    expected_hash = package.get("packageHash")
    unhashed = dict(package)
    unhashed.pop("packageHash", None)
    actual_hash = hashlib.sha256(stable(unhashed).encode()).hexdigest()
    require(expected_hash == actual_hash, "package hash", failures)
    result = {
        "validatorContract": VALIDATOR_CONTRACT,
        "identity": identity,
        "package": str(path.resolve()),
        "packageHash": expected_hash,
        "status": "PASSED" if not failures else "FAILED",
        "failures": failures,
        "scenarioCount": len(tests),
        "compositeScenarioCount": composite_result["caseCount"],
        "compositeExpectedStatuses": composite_result["expectedStatuses"],
        "executionScope": "STATIC_PACKAGE_CONTRACT",
        "liveSmokeStatus": composite_result["liveSmokeStatus"],
        "pageCount": len(pages),
        "durationMs": round((time.perf_counter() - started) * 1000, 3),
    }
    result["evidenceHash"] = hashlib.sha256(stable(result).encode()).hexdigest()
    return result


def valid_cached_result(result: Any, path: Path, package: dict[str, Any]) -> bool:
    if not isinstance(result, dict) or set(result) != RESULT_KEYS | {"cached"}:
        return False
    unhashed = dict(result)
    evidence_hash = unhashed.pop("evidenceHash", None)
    unhashed.pop("cached", None)
    expected_identity = (
        f"{package.get('process', {}).get('code', '?')}/"
        f"{package.get('step', {}).get('code', '?')}"
    )
    claimed_hash = package.get("packageHash")
    unhashed_package = dict(package)
    unhashed_package.pop("packageHash", None)
    actual_hash = hashlib.sha256(stable(unhashed_package).encode()).hexdigest()
    return (
        result.get("validatorContract") == VALIDATOR_CONTRACT
        and result.get("identity") == expected_identity
        and result.get("package") == str(path.resolve())
        and claimed_hash == actual_hash
        and result.get("packageHash") == actual_hash
        and result.get("status") == "PASSED"
        and result.get("failures") == []
        and result.get("cached") is False
        and evidence_hash == hashlib.sha256(stable(unhashed).encode()).hexdigest()
    )


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
        claimed_package_hash = package.get("packageHash")
        unhashed_package = dict(package)
        unhashed_package.pop("packageHash", None)
        actual_package_hash = hashlib.sha256(stable(unhashed_package).encode()).hexdigest()
        package_hash_valid = claimed_package_hash == actual_package_hash
        cache = (
            args.cache_dir / f"{VALIDATOR_CONTRACT}-{actual_package_hash}.pass.json"
            if args.cache_dir and package_hash_valid else None
        )
        if cache and cache.is_file() and not args.force:
            result = load(cache)
            if valid_cached_result(result, path, package):
                result["cached"] = True
            else:
                result = test_package(path)
                result["cached"] = False
                if result["status"] == "PASSED":
                    cache.write_text(
                        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8",
                    )
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
