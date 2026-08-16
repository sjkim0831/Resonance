#!/usr/bin/env python3
"""Validate and render the 18-axis composite authority into deterministic artifacts."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import struct
from pathlib import Path
from typing import Any


AUTHORITY_SCHEMA = "carbonet.composite-executable-design-authority/v1"
OUTPUT_MODE = "SDUI_API_DB_TEST_SUPPORT_SURFACES_V1"
OUTPUT_SCHEMA = "carbonet.generated-composite-executable-design/v1"
SHA = re.compile(r"^[0-9a-f]{64}$")
CODE = re.compile(r"^[A-Z][A-Z0-9_:-]{1,119}$")
DB_ID = re.compile(r"^[a-z][a-z0-9_]{0,62}$")
DB_TYPE = re.compile(
    r"^(uuid|bigint|bigserial|integer|boolean|text|jsonb|date|timestamp|timestamptz|"
    r"varchar\([1-9][0-9]{0,4}\)|numeric\([1-9][0-9]?,[0-9]{1,2}\))$"
)
AXES = [
    "REQUIREMENT", "ACTOR_RACI", "AUTHORITY", "PROCESS", "STATE", "NAVIGATION",
    "ACTIVE_UI", "DESIGN_ASSET", "FIELD_DICTIONARY", "DATA_HANDOFF", "DATABASE", "API",
    "BUSINESS_RULE", "VALIDATION", "NOTIFICATION", "TEST", "TASK_EVIDENCE", "RELEASE_AUDIT",
]
LANES = {
    "frontend-sdui": ["NAVIGATION", "ACTIVE_UI", "DESIGN_ASSET", "FIELD_DICTIONARY", "DATA_HANDOFF"],
    "backend-api": ["AUTHORITY", "PROCESS", "DATA_HANDOFF", "API", "BUSINESS_RULE", "VALIDATION", "NOTIFICATION"],
    "database": ["FIELD_DICTIONARY", "DATA_HANDOFF", "DATABASE"],
    "runtime-policy": ["ACTOR_RACI", "AUTHORITY", "PROCESS", "STATE", "BUSINESS_RULE", "VALIDATION", "NOTIFICATION"],
    "test-manifest": ["ACTOR_RACI", "STATE", "NAVIGATION", "BUSINESS_RULE", "VALIDATION", "NOTIFICATION", "TEST", "TASK_EVIDENCE"],
    "release-audit": ["RELEASE_AUDIT"],
}
PAYLOAD_KEYS = {
    "REQUIREMENT": {"workTypeCode", "businessPurpose", "entryCondition", "exitCondition", "kpis"},
    "ACTOR_RACI": {"actorCode", "ownerActorCode", "responsibleActorCodes", "accountBindingMode", "relayTestRequired"},
    "AUTHORITY": {"permissionCodes", "securityContract", "serverEnforced"},
    "PROCESS": {"stepOrder", "commandCode", "fromState", "toState", "completionRule", "commands"},
    "STATE": {"states"}, "NAVIGATION": {"routePath", "audience", "nextRoutes"},
    "ACTIVE_UI": {"sectionOrder", "responsiveContract", "accessibilityContract", "responsiveVerified", "accessibilityVerified"},
    "DESIGN_ASSET": {"layout", "theme", "sections", "assetBindings", "adoptMutationPolicy"},
    "FIELD_DICTIONARY": {"fields"}, "DATA_HANDOFF": {"inputs", "outputs"},
    "DATABASE": {"entities", "verified", "migrationMode", "schemaFingerprint", "schemaChanges"},
    "API": {"operations", "verified"},
    "BUSINESS_RULE": {"rules"}, "VALIDATION": {"rules", "exceptionStatesVerified"},
    "NOTIFICATION": {"events"}, "TEST": {"scenarios"},
    "TASK_EVIDENCE": {"evidence"}, "RELEASE_AUDIT": {"auditEvidenceRef", "rollbackPolicy"},
}
ROW_KEYS = {
    "FIELD_DICTIONARY": {"fieldCode", "label", "direction", "dataSource", "dataType", "required", "componentCode"},
    "BUSINESS_RULE": {"ruleCode", "commandCode", "fieldCode", "operator", "expectedValue", "errorCode"},
    "VALIDATION": {"ruleCode", "commandCode", "fieldCode", "operator", "expectedValue", "errorCode"},
    "NOTIFICATION": {"eventCode", "commandCode", "channel", "recipientActorCode", "templateCode"},
    "TEST": {"scenarioCode", "commandCode", "inputValues", "expectedOutputFields", "expectedStatus", "assertionCodes"},
}
COMPOSITE_TEST_CASE_SCHEMA = "carbonet.composite-test-case/v1"
COMPOSITE_TEST_EXECUTION_SCHEMA = "carbonet.composite-test-execution/v2"
COMPOSITE_TEST_RUNNER = "DETERMINISTIC_COMPOSITE_CONTRACT_RUNNER_V1"
COMPOSITE_EXPECTED_STATUSES = {
    "SUCCESS", "VALIDATION_ERROR", "FORBIDDEN", "CONFLICT", "RECOVERY",
}
COMPOSITE_STATUS_SCENARIO_TYPES = {
    "SUCCESS": "HAPPY_PATH",
    "VALIDATION_ERROR": "EXCEPTION",
    "FORBIDDEN": "AUTHORITY",
    "CONFLICT": "ISOLATION",
    "RECOVERY": "RECOVERY",
}
COMPOSITE_ASSERTION_CODES = {
    "STATUS_MATCH", "OUTPUT_FIELDS_MATCH", "RULES_PASS", "VALIDATION_PASS",
    "NOTIFICATION_QUEUED", "RELAY_READY",
}
PHYSICAL_TEST_LANES = ["API", "DATABASE", "BROWSER"]
BINDING_KEYS = {
    "stepCode", "routePath", "audience", "authorityHash", "documentSetHash",
    "executableDesignHash", "sharedStepHash", "executableDesign", "artifactManifest",
    "resolvedClosure", "generatedSurfaceBindings", "generatedSurfaceSetHash",
    "sourceHash", "designSetHash", "designCatalogHash", "endpointCatalogHash",
    "packageBindingHash", "jobId",
}


class ContractError(ValueError):
    pass


def canonical(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(value: str | bytes) -> str:
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()


def java_stable(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, dict):
        return "{" + ",".join(
            java_quote(str(key)) + ":" + java_stable(value[key])
            for key in sorted(value, key=lambda item: str(item).encode("utf-16-be", "surrogatepass"))
        ) + "}"
    if isinstance(value, list):
        return "[" + ",".join(java_stable(item) for item in value) + "]"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        number = float(value)
        if number != number or number in (float("inf"), float("-inf")):
            raise ContractError("non-finite number")
        if number == 0:
            number = 0.0
        return "@" + struct.pack(">d", number).hex()
    if isinstance(value, str):
        return java_quote(value)
    raise ContractError("non-JSON value")


def java_quote(value: str) -> str:
    if any(0xD800 <= ord(item) <= 0xDFFF for item in value):
        raise ContractError("unpaired surrogate is forbidden")
    return '"' + value.encode("utf-8").hex() + '"'


def java_hash(value: Any) -> str:
    return digest(java_stable(value))


def exact_object(value: Any, keys: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != keys:
        raise ContractError(f"{label} keys must be exactly {sorted(keys)}")
    return value


def text(value: Any, label: str, pattern: re.Pattern[str] | None = None) -> str:
    if not isinstance(value, str) or not value or value != value.strip():
        raise ContractError(f"{label} must be canonical text")
    if pattern and not pattern.fullmatch(value):
        raise ContractError(f"{label} is invalid")
    return value


def hash_text(value: Any, label: str) -> str:
    value = text(value, label)
    if not SHA.fullmatch(value):
        raise ContractError(f"{label} must be sha256")
    return value


def load_spec(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ContractError(f"invalid composite specification: {exc}") from exc
    if not isinstance(value, dict):
        raise ContractError("composite specification must be an object")
    return value


def validate_surfaces(binding: dict[str, Any]) -> None:
    rows = binding["generatedSurfaceBindings"]
    if not isinstance(rows, list) or len(rows) != 6:
        raise ContractError("six generated support surfaces are required")
    expected = {"HELP", "WORK_GUIDE", "ALL_WORK_OVERVIEW", "QA", "SCREEN_DESIGN", "NEXT_TASK"}
    names: set[str] = set()
    for raw in rows:
        row = exact_object(raw, {"surface", "authorityHash", "sourceHash", "outputHash", "markerHash"}, "surface binding")
        name = text(row["surface"], "surface")
        names.add(name)
        if row["authorityHash"] != binding["authorityHash"] or row["sourceHash"] != binding["sourceHash"]:
            raise ContractError("surface authority/source binding mismatch")
        hash_text(row["outputHash"], "surface.outputHash")
        marker = dict(row)
        marker_hash = hash_text(marker.pop("markerHash"), "surface.markerHash")
        if java_hash(marker) != marker_hash:
            raise ContractError("surface marker hash mismatch")
    if names != expected or java_hash(rows) != binding["generatedSurfaceSetHash"]:
        raise ContractError("support surface set is not exact")


def database_identifier(value: Any, label: str) -> str:
    value = text(value, label)
    if not DB_ID.fullmatch(value):
        raise ContractError(f"{label} is invalid")
    return value


def validate_database_plan(database: dict[str, Any]) -> None:
    mode = text(database["migrationMode"], "DATABASE.migrationMode")
    if mode not in {"REGISTERED_EXISTING", "SAFE_CREATE_TABLE", "NO_DATABASE"}:
        raise ContractError("DATABASE migrationMode requires review")
    if database["verified"] is not True:
        raise ContractError("DATABASE plan is not verified")
    changes = database["schemaChanges"]
    entities = database["entities"]
    fingerprint = hash_text(database["schemaFingerprint"], "DATABASE.schemaFingerprint")
    if not isinstance(changes, list) or not isinstance(entities, list):
        raise ContractError("DATABASE schemaChanges/entities must be arrays")
    if mode == "NO_DATABASE":
        if changes or entities or fingerprint != java_hash([]):
            raise ContractError("NO_DATABASE contract is not exact")
        return
    if not changes:
        raise ContractError("DATABASE schemaChanges are required")
    expected_operation = "CREATE_TABLE" if mode == "SAFE_CREATE_TABLE" else "REGISTERED_TABLE"
    table_fields: dict[str, set[str]] = {}
    for raw in changes:
        change = exact_object(raw, {"operation", "tableName", "columns", "uniqueConstraints", "indexes"},
                              "DATABASE.schemaChanges[]")
        if change["operation"] != expected_operation:
            raise ContractError("DATABASE schema operation is unsafe")
        table = database_identifier(change["tableName"], "DATABASE.tableName")
        if table in table_fields or not isinstance(change["columns"], list) or not change["columns"]:
            raise ContractError("DATABASE table/columns are not exact")
        names: set[str] = set()
        primary_keys = 0
        for raw_column in change["columns"]:
            if not isinstance(raw_column, dict):
                raise ContractError("DATABASE column is invalid")
            required = {"name", "type", "primaryKey", "nullable"}
            allowed = required | {"default", "references"}
            if not required.issubset(raw_column) or not set(raw_column).issubset(allowed):
                raise ContractError("DATABASE column keys are invalid")
            name = database_identifier(raw_column["name"], "DATABASE.column.name")
            if name in names or not isinstance(raw_column["type"], str) \
                    or not DB_TYPE.fullmatch(raw_column["type"].lower()):
                raise ContractError("DATABASE column name/type is invalid")
            if type(raw_column["primaryKey"]) is not bool or type(raw_column["nullable"]) is not bool:
                raise ContractError("DATABASE column flags are required")
            if raw_column["primaryKey"]:
                primary_keys += 1
            if "default" in raw_column and not isinstance(raw_column["default"], str):
                raise ContractError("DATABASE column default is invalid")
            if "references" in raw_column:
                reference = exact_object(raw_column["references"], {"table", "column", "onDelete"},
                                         "DATABASE.column.references")
                database_identifier(reference["table"], "DATABASE.reference.table")
                database_identifier(reference["column"], "DATABASE.reference.column")
                if reference["onDelete"] not in {"CASCADE", "RESTRICT", "SET NULL", "NO ACTION"}:
                    raise ContractError("DATABASE reference onDelete is invalid")
            names.add(name)
        if primary_keys < 1:
            raise ContractError("DATABASE primary key is required")
        constraints = change["uniqueConstraints"]
        if (not isinstance(constraints, list)
                or any(not isinstance(fields, list) or not fields
                       or any(not isinstance(field, str) for field in fields)
                       or any(field not in names for field in fields) for fields in constraints)):
            raise ContractError("DATABASE unique constraints are invalid")
        indexes = change["indexes"]
        index_names: set[str] = set()
        if not isinstance(indexes, list):
            raise ContractError("DATABASE indexes must be an array")
        for raw_index in indexes:
            index = exact_object(raw_index, {"name", "columns", "unique"}, "DATABASE.indexes[]")
            name = database_identifier(index["name"], "DATABASE.index.name")
            fields = index["columns"]
            if (name in index_names or type(index["unique"]) is not bool
                    or not isinstance(fields, list) or not fields
                    or any(not isinstance(field, str) for field in fields)
                    or any(field not in names for field in fields)):
                raise ContractError("DATABASE index is invalid")
            index_names.add(name)
        table_fields[table] = names
    if fingerprint != java_hash(changes):
        raise ContractError("DATABASE schema fingerprint is not exact")
    entity_fields: dict[str, set[str]] = {}
    for raw_entity in entities:
        if not isinstance(raw_entity, dict) or set(raw_entity) != {"entity", "fields"}:
            raise ContractError("DATABASE entity is invalid")
        entity = database_identifier(str(raw_entity["entity"]).lower(), "DATABASE.entity")
        fields = raw_entity["fields"]
        if (entity in entity_fields or not isinstance(fields, list)
                or any(not isinstance(field, str) or not DB_ID.fullmatch(field)
                       for field in fields)
                or len(set(fields)) != len(fields)):
            raise ContractError("DATABASE entity fields are invalid")
        entity_fields[entity] = set(fields)
    if entity_fields != table_fields:
        raise ContractError("DATABASE entity/schema closure is not exact")


def merge_database_plans(plans: list[dict[str, Any]]) -> dict[str, Any]:
    """Merge screen-local database declarations into one exact step package plan."""
    if not plans:
        raise ContractError("runtime package database plan is missing")
    for plan in plans:
        validate_database_plan(plan)
    modes = {plan["migrationMode"] for plan in plans}
    if len(modes) != 1:
        raise ContractError("runtime package database migration mode is not exact")
    mode = next(iter(modes))
    changes_by_table: dict[str, dict[str, Any]] = {}
    entities_by_name: dict[str, dict[str, Any]] = {}
    for plan in plans:
        for change in plan["schemaChanges"]:
            key = str(change["tableName"]).lower()
            previous = changes_by_table.get(key)
            if previous is not None and canonical(previous) != canonical(change):
                raise ContractError(f"runtime package database table is contradictory: {key}")
            changes_by_table[key] = change
        for entity in plan["entities"]:
            key = str(entity["entity"]).lower()
            previous = entities_by_name.get(key)
            if previous is not None and canonical(previous) != canonical(entity):
                raise ContractError(f"runtime package database entity is contradictory: {key}")
            entities_by_name[key] = entity
    changes = [changes_by_table[key] for key in sorted(changes_by_table)]
    entities = [entities_by_name[key] for key in sorted(entities_by_name)]
    merged = {"entities": entities, "verified": True, "migrationMode": mode,
              "schemaFingerprint": java_hash(changes), "schemaChanges": changes}
    validate_database_plan(merged)
    return merged


def validate_executable_payload(design: dict[str, Any]) -> None:
    for axis in AXES:
        exact_object(design[axis], PAYLOAD_KEYS[axis], f"executableDesign.{axis}")
    commands = design["PROCESS"]["commands"]
    if not isinstance(commands, list) or not commands:
        raise ContractError("PROCESS.commands are required")
    command_codes = {text(row.get("commandCode"), "commandCode", CODE) for row in commands if isinstance(row, dict)}
    inputs = design["DATA_HANDOFF"]["inputs"]
    input_fields = {text(row.get("fieldCode"), "input.fieldCode") for row in inputs if isinstance(row, dict)} if isinstance(inputs, list) else set()
    assets = design["DESIGN_ASSET"]
    component_codes = {
        row.get("assetCode") for row in assets.get("assetBindings", [])
        if isinstance(row, dict) and row.get("assetType") == "COMPONENT"
    }
    fields = design["FIELD_DICTIONARY"]["fields"]
    if not isinstance(fields, list):
        raise ContractError("FIELD_DICTIONARY.fields is invalid")
    for raw in fields:
        row = exact_object(raw, ROW_KEYS["FIELD_DICTIONARY"], "FIELD_DICTIONARY.fields[]")
        for key in ("fieldCode", "label", "dataSource", "componentCode"):
            text(row[key], f"FIELD_DICTIONARY.{key}")
        if row["direction"] not in {"INPUT", "OUTPUT", "BOTH"}:
            raise ContractError("FIELD_DICTIONARY.direction is invalid")
        if row["dataType"] not in {"STRING", "NUMBER", "INTEGER", "BOOLEAN", "DATE", "DATETIME", "OBJECT", "ARRAY"}:
            raise ContractError("FIELD_DICTIONARY.dataType is invalid")
        if not isinstance(row["required"], bool) or row["componentCode"] not in component_codes:
            raise ContractError("FIELD_DICTIONARY JSON Form component binding is invalid")
    validate_database_plan(design["DATABASE"])
    operations = design["API"]["operations"]
    if design["API"]["verified"] is not True:
        raise ContractError("API operations are not verified")
    if not isinstance(operations, list) or not operations:
        raise ContractError("API.operations are required")
    command_inputs: dict[str, set[str]] = {}
    command_outputs: dict[str, set[str]] = {}
    for row in operations:
        if not isinstance(row, dict):
            raise ContractError("API.operations[] is invalid")
        command = text(row.get("commandCode"), "API.commandCode", CODE)
        request_fields = row.get("requestFields")
        response_fields = row.get("responseFields")
        if (not isinstance(request_fields, list) or not isinstance(response_fields, list)
                or any(not isinstance(value, str) or not value for value in request_fields + response_fields)
                or len(set(request_fields)) != len(request_fields)
                or len(set(response_fields)) != len(response_fields)):
            raise ContractError("API command input/output fields are invalid")
        if command in command_inputs:
            raise ContractError(f"API command is duplicated: {command}")
        command_inputs[command] = set(request_fields)
        command_outputs[command] = set(response_fields)
    if set(command_inputs) != command_codes:
        raise ContractError("API command coverage is not exact")
    tested_commands: set[str] = set()
    successful_commands: set[str] = set()
    scenario_codes: set[str] = set()
    for axis, field in (("BUSINESS_RULE", "rules"), ("VALIDATION", "rules"),
                        ("NOTIFICATION", "events"), ("TEST", "scenarios")):
        rows = design[axis][field]
        if not isinstance(rows, list) or (axis == "TEST" and not rows):
            raise ContractError(f"{axis}.{field} is invalid")
        for raw in rows:
            row = exact_object(raw, ROW_KEYS[axis], f"{axis}.{field}[]")
            if text(row["commandCode"], f"{axis}.commandCode", CODE) not in command_codes:
                raise ContractError(f"{axis} references an unknown command")
            if axis in {"BUSINESS_RULE", "VALIDATION"}:
                allowed_fields = input_fields | ({"CURRENT_STATE"} if axis == "BUSINESS_RULE" else set())
                if row["fieldCode"] not in allowed_fields or row["operator"] not in {"REQUIRED", "EQ", "NE", "GT", "GTE", "LT", "LTE"}:
                    raise ContractError(f"{axis} predicate is not executable")
                for key in ("ruleCode", "fieldCode", "expectedValue", "errorCode"):
                    text(row[key], f"{axis}.{key}")
                if row["operator"] == "REQUIRED" and row["expectedValue"] != "PRESENT":
                    raise ContractError(f"{axis} REQUIRED predicate must use PRESENT")
            elif axis == "NOTIFICATION":
                if row["channel"] not in {"IN_APP", "EMAIL", "WEBHOOK"}:
                    raise ContractError("notification channel is unsupported")
                for key in ("eventCode", "recipientActorCode", "templateCode"):
                    text(row[key], f"NOTIFICATION.{key}", CODE)
            else:
                scenario_code = text(row["scenarioCode"], "TEST.scenarioCode", CODE)
                if scenario_code in scenario_codes:
                    raise ContractError("TEST scenarioCode is duplicated")
                scenario_codes.add(scenario_code)
                if (not isinstance(row["inputValues"], dict)
                        or set(row["inputValues"]) != command_inputs.get(row["commandCode"], set())
                        or any(value is None or isinstance(value, (dict, list)) for value in row["inputValues"].values())):
                    raise ContractError("TEST inputValues are not executable")
                outputs = row["expectedOutputFields"]
                if (not isinstance(outputs, list) or len(set(outputs)) != len(outputs)
                        or set(outputs) != command_outputs.get(row["commandCode"], set())):
                    raise ContractError("TEST expectedOutputFields are not exact")
                if row["expectedStatus"] not in COMPOSITE_EXPECTED_STATUSES:
                    raise ContractError("TEST expectedStatus is invalid")
                assertions = row["assertionCodes"]
                if (not isinstance(assertions, list) or len(set(assertions)) != len(assertions)
                        or not {"STATUS_MATCH", "OUTPUT_FIELDS_MATCH"}.issubset(assertions)
                        or not set(assertions).issubset(COMPOSITE_ASSERTION_CODES)):
                    raise ContractError("TEST assertions are incomplete")
                tested_commands.add(row["commandCode"])
                if row["expectedStatus"] == "SUCCESS":
                    successful_commands.add(row["commandCode"])
    if tested_commands != command_codes:
        raise ContractError("TEST command coverage is not exact")
    if successful_commands != command_codes:
        raise ContractError("TEST SUCCESS scenario coverage is not exact")


def validate_binding(raw: Any, specification: dict[str, Any]) -> dict[str, Any]:
    binding = exact_object(raw, BINDING_KEYS, "composite authority binding")
    for key in ("authorityHash", "documentSetHash", "executableDesignHash", "sharedStepHash",
                "generatedSurfaceSetHash", "sourceHash", "designSetHash", "designCatalogHash",
                "endpointCatalogHash", "packageBindingHash"):
        hash_text(binding[key], f"binding.{key}")
    text(binding["stepCode"], "binding.stepCode", CODE)
    route = text(binding["routePath"], "binding.routePath")
    if not route.startswith("/") or route != route.split("?", 1)[0].lower():
        raise ContractError("binding.routePath is not normalized")
    if binding["audience"] not in {"USER", "ADMIN"}:
        raise ContractError("binding.audience is invalid")
    if isinstance(binding["jobId"], bool) or not isinstance(binding["jobId"], int) or binding["jobId"] < 1:
        raise ContractError("binding.jobId is invalid")
    design = exact_object(binding["executableDesign"], set(AXES), "executableDesign")
    if any(not isinstance(design[axis], dict) for axis in AXES):
        raise ContractError("every executable axis payload must be an object")
    validate_executable_payload(design)
    if java_hash(design) != binding["executableDesignHash"]:
        raise ContractError("executableDesignHash mismatch")
    artifact = exact_object(binding["artifactManifest"], {
        "runtimePolicy", "frontendSdui", "backendData", "testManifest", "releasePolicy", "payloadHash"
    }, "artifactManifest")
    expected_manifest = {
        "runtimePolicy": ["ACTOR_RACI", "AUTHORITY", "PROCESS", "STATE", "BUSINESS_RULE", "VALIDATION", "NOTIFICATION"],
        "frontendSdui": ["NAVIGATION", "ACTIVE_UI", "DESIGN_ASSET", "FIELD_DICTIONARY", "DATA_HANDOFF"],
        "backendData": ["DATABASE", "API"],
        "testManifest": ["TEST", "TASK_EVIDENCE"],
        "releasePolicy": ["RELEASE_AUDIT"],
    }
    for key, expected in expected_manifest.items():
        if artifact[key] != expected:
            raise ContractError(f"artifactManifest.{key} mismatch")
    if java_hash(design) != artifact["payloadHash"]:
        raise ContractError("artifactManifest.payloadHash mismatch")
    closure = binding["resolvedClosure"]
    if not isinstance(closure, dict) or any(closure.get(key) != binding[key] for key in ("stepCode", "routePath", "audience")):
        raise ContractError("resolved closure identity mismatch")
    for key in ("sourceHash", "designSetHash", "designCatalogHash", "endpointCatalogHash"):
        if binding[key] != specification.get(key):
            raise ContractError(f"binding.{key} differs from final process job head")
    validate_surfaces(binding)
    expected_package = java_hash({
        "authorityHash": binding["authorityHash"], "sourceHash": binding["sourceHash"],
        "designSetHash": binding["designSetHash"], "designCatalogHash": binding["designCatalogHash"],
        "endpointCatalogHash": binding["endpointCatalogHash"],
        "surfaceSetHash": binding["generatedSurfaceSetHash"], "activationPolicy": "SOURCE_IMMEDIATE_V1",
    })
    if expected_package != binding["packageBindingHash"]:
        raise ContractError("packageBindingHash mismatch")
    return binding


def validate_spec(specification: dict[str, Any], process: str | None) -> list[dict[str, Any]]:
    if specification.get("compositeAuthoritySchema") != AUTHORITY_SCHEMA:
        raise ContractError("compositeAuthoritySchema mismatch")
    if specification.get("compositeArtifactOutputMode") != OUTPUT_MODE:
        raise ContractError("compositeArtifactOutputMode mismatch")
    bindings = specification.get("compositeAuthorities")
    if not isinstance(bindings, list) or not bindings:
        raise ContractError("compositeAuthorities are required")
    normalized = [validate_binding(item, specification) for item in bindings]
    order = [(row["stepCode"], row["routePath"], row["audience"]) for row in normalized]
    if any(not re.fullmatch(r"/[a-z0-9/_-]*", row["routePath"]) for row in normalized):
        raise ContractError("composite routes must be normalized ASCII")
    if order != sorted(order) or len(set(order)) != len(order):
        raise ContractError("composite authority identities must be unique and C-order sorted")
    if java_hash(normalized) != specification.get("compositeAuthoritySetHash"):
        raise ContractError("compositeAuthoritySetHash mismatch")
    if process and specification.get("processCode") != process:
        raise ContractError("composite process identity mismatch")
    return normalized


def support_payload(binding: dict[str, Any]) -> dict[str, Any]:
    design, closure = binding["executableDesign"], binding["resolvedClosure"]
    return {
        "schema": "carbonet.composite-support-surfaces/v1",
        "identity": {key: binding[key] for key in ("stepCode", "routePath", "audience")},
        "surfaces": {
            "HELP": {"requirement": design["REQUIREMENT"], "evidence": design["TASK_EVIDENCE"]},
            "WORK_GUIDE": {key: closure.get(key) for key in (
                "workTypeCode", "processCode", "stepOrder", "stepCode", "actorCode", "activeAccountCount",
                "routePath", "functions", "inputs", "outputs", "permissionCodes", "endpoints")},
            "ALL_WORK_OVERVIEW": {"requirement": design["REQUIREMENT"], "process": design["PROCESS"]},
            "QA": {"tests": design["TEST"], "evidence": design["TASK_EVIDENCE"]},
            "SCREEN_DESIGN": {axis: design[axis] for axis in LANES["frontend-sdui"]},
            "NEXT_TASK": {"navigation": design["NAVIGATION"], "process": design["PROCESS"]},
        },
        "surfaceBindings": binding["generatedSurfaceBindings"],
        "surfaceSetHash": binding["generatedSurfaceSetHash"],
    }


def predicate_passes(rule: dict[str, Any], values: dict[str, Any]) -> bool:
    actual = values.get(rule["fieldCode"])
    expected = rule["expectedValue"]
    operator = rule["operator"]
    if operator == "REQUIRED":
        return actual is not None and str(actual).strip() != ""
    if operator in {"EQ", "NE"}:
        equal = actual is not None and str(actual) == expected
        return equal if operator == "EQ" else actual is not None and not equal
    try:
        actual_number, expected_number = float(actual), float(expected)
    except (TypeError, ValueError):
        return False
    return {"GT": actual_number > expected_number, "GTE": actual_number >= expected_number,
            "LT": actual_number < expected_number, "LTE": actual_number <= expected_number}[operator]


def execute_test_contract(design: dict[str, Any], binding: dict[str, Any]) -> dict[str, Any]:
    states = design["STATE"]["states"]
    rules = design["BUSINESS_RULE"]["rules"]
    validations = design["VALIDATION"]["rules"]
    evidence = design["TASK_EVIDENCE"]["evidence"]
    process = text(binding["resolvedClosure"].get("processCode"),
                   "resolvedClosure.processCode", CODE)
    identity = {
        "processCode": process,
        "stepCode": binding["stepCode"],
        "routePath": binding["routePath"],
        "audience": binding["audience"],
    }
    cases: list[dict[str, Any]] = []
    for scenario in design["TEST"]["scenarios"]:
        transitions = [row for row in states if row["commandCode"] == scenario["commandCode"]]
        if len(transitions) != 1:
            raise ContractError("test scenario transition is not exact")
        values = dict(scenario["inputValues"])
        values["CURRENT_STATE"] = transitions[0]["fromState"]
        failed_rules = [row["errorCode"] for row in rules + validations
                        if row["commandCode"] == scenario["commandCode"]
                        and not predicate_passes(row, values)]
        case_identity = {**identity, "scenarioCode": scenario["scenarioCode"]}
        case_code = f"COMPOSITE_{digest(canonical(case_identity))[:24].upper()}"
        case = {
            "schema": COMPOSITE_TEST_CASE_SCHEMA,
            "caseCode": case_code,
            "name": scenario["scenarioCode"],
            "type": COMPOSITE_STATUS_SCENARIO_TYPES[scenario["expectedStatus"]],
            "status": "APPROVED",
            "sourceRequirement": scenario["expectedStatus"],
            "identity": identity,
            "scenarioCode": scenario["scenarioCode"],
            "commandCode": scenario["commandCode"],
            "inputValues": scenario["inputValues"],
            "expectedStatus": scenario["expectedStatus"],
            "fromState": transitions[0]["fromState"],
            "toState": transitions[0]["toState"],
            "expectedOutputFields": scenario["expectedOutputFields"],
            "assertionCodes": scenario["assertionCodes"],
            "evidence": evidence,
            "evidenceHash": digest(canonical(evidence)),
            "staticPredicateFailures": failed_rules,
            "steps": [{
                "executor": COMPOSITE_TEST_RUNNER,
                "executionMode": "STATIC_CONTRACT_VALIDATION",
                "commandCode": scenario["commandCode"],
                "inputValues": scenario["inputValues"],
                "expectedStatus": scenario["expectedStatus"],
                "fromState": transitions[0]["fromState"],
                "toState": transitions[0]["toState"],
            }],
            "assertions": scenario["assertionCodes"],
        }
        cases.append(case)
    cases.sort(key=lambda row: row["caseCode"])
    execution = {
        "schema": COMPOSITE_TEST_EXECUTION_SCHEMA,
        "runner": COMPOSITE_TEST_RUNNER,
        "executionScope": "STATIC_PACKAGE_CONTRACT",
        "contractCaseCount": len(cases),
        "expectedStatuses": sorted({row["expectedStatus"] for row in cases}),
        "casesHash": digest(canonical(cases)),
        "liveSmokeRequired": True,
        "liveSmokeStatus": "QUEUED",
        "physicalExecutionLanes": PHYSICAL_TEST_LANES,
        "cases": cases,
    }
    execution["evidenceHash"] = digest(canonical(execution))
    return execution


def lane_payload(lane: str, binding: dict[str, Any]) -> dict[str, Any]:
    design = binding["executableDesign"]
    if lane == "frontend-sdui":
        return {"renderer": "KRDS_SDUI_JSON_FORM_V1", "routePath": binding["routePath"],
                "audience": binding["audience"], "layout": design["DESIGN_ASSET"]["layout"],
                "theme": design["DESIGN_ASSET"]["theme"], "sections": design["DESIGN_ASSET"]["sections"],
                "fields": design["FIELD_DICTIONARY"]["fields"],
                "navigation": design["NAVIGATION"], "commands": design["PROCESS"]["commands"]}
    if lane == "backend-api":
        return {"runtime": "COMMON_PROCESS_COMMAND_RUNTIME", "operations": design["API"]["operations"],
                "permissionCodes": design["AUTHORITY"]["permissionCodes"],
                "businessRules": design["BUSINESS_RULE"]["rules"],
                "validations": design["VALIDATION"]["rules"],
                "notifications": design["NOTIFICATION"]["events"]}
    if lane == "database":
        return {"entities": design["DATABASE"]["entities"], "fields": design["FIELD_DICTIONARY"]["fields"],
                "handoff": design["DATA_HANDOFF"],
                "migrationMode": design["DATABASE"]["migrationMode"],
                "schemaFingerprint": design["DATABASE"]["schemaFingerprint"],
                "schemaChanges": design["DATABASE"]["schemaChanges"],
                "autoGenerateMigration": design["DATABASE"]["migrationMode"] == "SAFE_CREATE_TABLE"}
    if lane == "runtime-policy":
        return {"actorRaci": design["ACTOR_RACI"], "authority": design["AUTHORITY"],
                "process": design["PROCESS"], "state": design["STATE"],
                "businessRules": design["BUSINESS_RULE"], "validation": design["VALIDATION"],
                "notification": design["NOTIFICATION"]}
    if lane == "test-manifest":
        return {"contract": design["TEST"], "taskEvidence": design["TASK_EVIDENCE"],
                "execution": execute_test_contract(design, binding)}
    return {"releaseAudit": design["RELEASE_AUDIT"]}


def render(specification: dict[str, Any], process: str | None) -> tuple[dict[str, bytes], dict[str, Any]]:
    bindings = validate_spec(specification, process)
    artifacts: dict[str, bytes] = {}
    authority_rows: list[dict[str, Any]] = []
    for binding in bindings:
        identity = {key: binding[key] for key in ("stepCode", "routePath", "audience")}
        identity_key = canonical(identity)
        directory = f"{binding['stepCode']}--{binding['audience']}--{digest(identity_key)[:16]}"
        lane_rows: list[dict[str, str]] = []
        for lane, axes in LANES.items():
            body = {"schema": f"carbonet.composite-{lane}/v1", "identity": identity,
                    "axisHashes": {axis: java_hash(binding["executableDesign"][axis]) for axis in axes},
                    "contract": lane_payload(lane, binding)}
            path = f"composite/{directory}/{lane}.json"
            content = (canonical(body) + "\n").encode("utf-8")
            artifacts[path] = content
            lane_rows.append({"lane": lane, "path": path, "sha256": digest(content)})
        support = support_payload(binding)
        path = f"composite/{directory}/support-surfaces.json"
        content = (canonical(support) + "\n").encode("utf-8")
        artifacts[path] = content
        lane_rows.append({"lane": "support-surfaces", "path": path, "sha256": digest(content)})
        authority_rows.append({
            "identity": identity, "authorityHash": binding["authorityHash"],
            "documentSetHash": binding["documentSetHash"],
            "executableDesignHash": binding["executableDesignHash"],
            "packageBindingHash": binding["packageBindingHash"],
            "artifacts": sorted(lane_rows, key=lambda row: row["lane"]),
        })
    manifest: dict[str, Any] = {
        "schema": OUTPUT_SCHEMA, "authoritySchema": AUTHORITY_SCHEMA,
        "outputMode": OUTPUT_MODE,
        "compositeAuthoritySetHash": specification["compositeAuthoritySetHash"],
        "authorityCount": len(authority_rows), "authorities": authority_rows,
        "artifactCount": len(artifacts),
        "artifactSetHash": digest(canonical(sorted(
            ({"path": path, "sha256": digest(content)} for path, content in artifacts.items()),
            key=lambda row: row["path"]
        ))),
    }
    manifest["manifestHash"] = digest(canonical(manifest))
    artifacts["composite/manifest.json"] = (canonical(manifest) + "\n").encode("utf-8")
    return artifacts, manifest


def augment_runtime_packages(out: Path, bindings: list[dict[str, Any]], set_hash: str,
                             check: bool) -> int:
    index_path = out / "index.json"
    try:
        index = json.loads(index_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ContractError(f"runtime package index is required before composite generation: {exc}") from exc
    package_rows = index.get("packages")
    if not isinstance(package_rows, list):
        raise ContractError("runtime package index packages are missing")
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for binding in bindings:
        grouped.setdefault((str(binding["resolvedClosure"].get("processCode")), binding["stepCode"]), []).append(binding)
    changed = 0
    for (process, step), step_bindings in grouped.items():
        matches = [row for row in package_rows if isinstance(row, dict)
                   and row.get("processCode") == process and row.get("stepCode") == step]
        if len(matches) != 1 or not isinstance(matches[0].get("package"), str):
            raise ContractError(f"runtime package identity is not exact: {process}/{step}")
        package_path = out / matches[0]["package"]
        try:
            package = json.loads(package_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ContractError(f"runtime package is invalid: {package_path.name}: {exc}") from exc
        pages = package.get("frontend", {}).get("pages")
        if not isinstance(pages, list):
            raise ContractError("runtime frontend pages are missing")
        identity_rows = []
        for binding in step_bindings:
            design = binding["executableDesign"]
            page_matches = [page for page in pages if isinstance(page, dict)
                            and page.get("route") == binding["routePath"]
                            and page.get("audience") == binding["audience"]]
            if len(page_matches) != 1:
                raise ContractError(f"SDUI page identity is not exact: {binding['routePath']}/{binding['audience']}")
            page = page_matches[0]
            operations_by_command = {row["commandCode"]: row for row in design["API"]["operations"]}
            commands = [{**row, "requestFields": operations_by_command[row["commandCode"]]["requestFields"]}
                        for row in design["PROCESS"]["commands"]]
            page.update({"renderer": "KRDS_SDUI_JSON_FORM_V1", "layout": design["DESIGN_ASSET"]["layout"],
                         "theme": design["DESIGN_ASSET"]["theme"], "sections": design["DESIGN_ASSET"]["sections"],
                         "fields": design["FIELD_DICTIONARY"]["fields"],
                         "commands": commands, "states": design["STATE"]["states"],
                         "navigation": design["NAVIGATION"], "compositeAuthorityHash": binding["authorityHash"]})
            test_execution = execute_test_contract(design, binding)
            identity_rows.append({"identity": {key: binding[key] for key in ("stepCode", "routePath", "audience")},
                                  "authorityHash": binding["authorityHash"], "api": design["API"],
                                  "authority": design["AUTHORITY"], "rules": design["BUSINESS_RULE"],
                                  "validation": design["VALIDATION"], "notification": design["NOTIFICATION"],
                                  "database": design["DATABASE"], "dataHandoff": design["DATA_HANDOFF"],
                                  "testExecution": test_execution})
        first = step_bindings[0]["executableDesign"]
        package["step"]["actor"] = first["ACTOR_RACI"]
        package["step"]["transition"] = {key: first["PROCESS"][key]
                                           for key in ("commandCode", "fromState", "toState", "completionRule")}
        field_types = {row["fieldCode"]: row["dataType"].lower()
                       for row in first["FIELD_DICTIONARY"]["fields"]}
        package["step"]["input"] = {row["fieldCode"]: field_types[row["fieldCode"]]
                                      for row in first["DATA_HANDOFF"]["inputs"]}
        package["step"]["output"] = {row["fieldCode"]: field_types[row["fieldCode"]]
                                       for row in first["DATA_HANDOFF"]["outputs"]}
        package["backend"]["compositeAuthorities"] = identity_rows
        database_plans = [row["database"] for row in identity_rows]
        database_plan = merge_database_plans(database_plans)
        package["database"].update({
            "compositeMappings": database_plans,
            "migrationMode": database_plan["migrationMode"],
            "schemaFingerprint": database_plan["schemaFingerprint"],
            "schemaChanges": database_plan["schemaChanges"],
            "autoGenerateMigration": database_plan["migrationMode"] == "SAFE_CREATE_TABLE",
        })
        base_tests = package.get("tests")
        execution = package.get("testExecution")
        if not isinstance(base_tests, list) or not isinstance(execution, dict):
            raise ContractError("runtime package base tests/testExecution are invalid")
        base_tests = [case for case in base_tests if not (
            isinstance(case, dict) and case.get("schema") == COMPOSITE_TEST_CASE_SCHEMA)]
        composite_executions = [row["testExecution"] for row in identity_rows]
        composite_cases = sorted(
            (case for item in composite_executions for case in item["cases"]),
            key=lambda row: row["caseCode"],
        )
        if len({case["caseCode"] for case in composite_cases}) != len(composite_cases):
            raise ContractError("composite test caseCode is not unique")
        package["tests"] = base_tests + composite_cases
        package.pop("compositeTests", None)
        composite_metadata = {
            "schema": COMPOSITE_TEST_EXECUTION_SCHEMA,
            "runner": COMPOSITE_TEST_RUNNER,
            "authoritySetHash": set_hash,
            "acceptedExpectedStatuses": sorted(COMPOSITE_EXPECTED_STATUSES),
            "projectedExpectedStatuses": sorted({
                case["expectedStatus"] for case in composite_cases}),
            "projectedCaseCount": len(composite_cases),
            "projectionHash": digest(canonical(composite_cases)),
            "evidenceHash": digest(canonical(composite_executions)),
            "physicalExecutionLanes": PHYSICAL_TEST_LANES,
            "liveSmokeRequired": True,
            "liveSmokeStatus": "QUEUED",
        }
        execution["compositeRunner"] = COMPOSITE_TEST_RUNNER
        execution["composite"] = composite_metadata
        execution["liveSmokeRequired"] = True
        execution["liveSmokeStatus"] = "QUEUED"
        package["compositeAuthoritySetHash"] = set_hash
        package.pop("packageHash", None)
        package["packageHash"] = digest(canonical(package))
        expected_bytes = (json.dumps(package, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        if check:
            if package_path.read_bytes() != expected_bytes or matches[0].get("packageHash") != package["packageHash"]:
                raise ContractError(f"runtime package composite projection drift: {package_path.name}")
        else:
            package_path.write_bytes(expected_bytes)
            matches[0]["packageHash"] = package["packageHash"]
            changed += 1
    index.pop("manifestHash", None)
    index["manifestHash"] = digest(canonical(index))
    expected_index = (json.dumps(index, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    if check:
        if index_path.read_bytes() != expected_index:
            raise ContractError("runtime package index composite projection drift")
    else:
        index_path.write_bytes(expected_index)
    return changed


def bind_index(out: Path, manifest: dict[str, Any]) -> bytes:
    path = out / "index.json"
    try:
        index = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ContractError(f"runtime package index is required before composite generation: {exc}") from exc
    if not isinstance(index, dict) or index.get("schemaVersion") != "2.0.0":
        raise ContractError("runtime package index schema mismatch")
    index.update({
        "compositeAuthoritySchema": AUTHORITY_SCHEMA,
        "compositeAuthoritySetHash": manifest["compositeAuthoritySetHash"],
        "compositeArtifactManifest": {
            "path": "composite/manifest.json", "sha256": digest((canonical(manifest) + "\n").encode()),
            "artifactCount": manifest["artifactCount"] + 1,
        },
    })
    index.pop("manifestHash", None)
    index["manifestHash"] = digest(canonical(index))
    return (json.dumps(index, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def publish(out: Path, artifacts: dict[str, bytes], manifest: dict[str, Any], check: bool) -> int:
    index_bytes = bind_index(out, manifest)
    expected = set(artifacts)
    if check:
        actual = {str(path.relative_to(out)).replace(os.sep, "/") for path in (out / "composite").rglob("*") if path.is_file()}
        if actual != expected or any((out / path).read_bytes() != content for path, content in artifacts.items()) or (out / "index.json").read_bytes() != index_bytes:
            raise ContractError("published composite artifacts differ from the exact specification")
        return 0
    destination = out / "composite"
    if destination.exists():
        raise ContractError("staged composite output must be initially absent")
    for relative, content in artifacts.items():
        target = out / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
    temporary = out / f".index.json.{os.getpid()}"
    temporary.write_bytes(index_bytes)
    os.replace(temporary, out / "index.json")
    return len(artifacts) + 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("specification", type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--process")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--staged-output", action="store_true")
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    try:
        specification = load_spec(args.specification)
        artifacts, manifest = render(specification, args.process)
        if args.validate_only:
            if args.out is not None or args.check or args.staged_output:
                raise ContractError("--validate-only forbids output options")
            print(canonical({"success": True, "validated": True, **manifest}))
            return 0
        if args.out is None or not args.staged_output:
            raise ContractError("--out and --staged-output are required; live output publication is forbidden")
        bindings = validate_spec(specification, args.process)
        augmented = augment_runtime_packages(
            args.out, bindings, specification["compositeAuthoritySetHash"], args.check)
        changed = publish(args.out, artifacts, manifest, args.check)
        print(canonical({"success": True, "check": args.check,
                         "filesChanged": changed + augmented, **manifest}))
        return 0
    except (ContractError, KeyError, TypeError) as exc:
        print(f"[composite-executable-design-generator] {exc}", file=os.sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
