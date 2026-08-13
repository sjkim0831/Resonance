#!/usr/bin/env python3
"""Fail-closed verifier for a canonical endpoint-upgrade release envelope.

The verifier deliberately has no database or filesystem write path.  Hashes of
PostgreSQL ``jsonb::text`` values are calculated from the supplied UTF-8 text,
never from a Python re-serialization.  Hash preimages created by this contract
use an ASCII unit separator between fields and LF between ordered rows.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any, Iterable, Mapping, NoReturn, Sequence


SCHEMA = "canonical-endpoint-upgrade-release/v1"
DESIGN_SCHEMA = "carbonet.canonical-design/v1"
ENDPOINT_SCHEMA = "carbonet.canonical-endpoint-catalog/v1"
US = "\x1f"
SHA_RE = re.compile(r"[0-9a-f]{64}\Z")
CODE_RE = re.compile(r"[A-Z][A-Z0-9_]{1,79}\Z")
OP_RE = re.compile(r"[A-Za-z][A-Za-z0-9_]{1,79}\Z")
PATH_RE = re.compile(r"/[A-Za-z0-9_{}./-]+\Z")
DB_RE = re.compile(r"[a-z_][a-z0-9_]{0,62}\Z")

TOP_KEYS = frozenset(
    {"schemaVersion", "source", "coverage", "members", "catalog", "proposals", "validations", "release"}
)
SOURCE_KEYS = frozenset(
    {"scopeProcess", "sourceDesignCatalogText", "sourceDesignCatalogTextHash", "sourceDesignCatalogHash", "sourceDesignCount", "policyText", "policyHash"}
)
COVERAGE_KEYS = frozenset(
    {
        "status", "sourceDesignCount", "memberCount", "missingContractCount",
        "duplicateBlueprintCount", "duplicateContractCount", "incompleteLaneCount",
        "blockerCount", "coverageHash",
    }
)
MEMBER_KEYS = frozenset(
    {
        "ordinal", "sourceContractId", "processCode", "stepCode", "screenKey",
        "sourceDesignHash", "sourceApiRawText", "sourceApiRawHash",
        "sourceApiParsedCanonicalText", "sourceApiParsedHash",
        "sourceDatabaseRawText", "sourceDatabaseRawHash",
        "sourceDatabaseParsedCanonicalText", "sourceDatabaseParsedHash",
        "projectedDesignCanonicalText", "projectedDesignHash",
        "endpointCanonicalText", "endpointHash", "operation", "memberHash",
    }
)
PROPOSAL_KEYS = frozenset(
    {
        "proposalId", "status", "proposalHash", "policyHash",
        "sourceDesignCatalogTextHash", "sourceDesignCatalogHash", "projectedDesignCatalogHash",
        "proposalCatalogHash", "memberCount",
    }
)
VALIDATION_KEYS = frozenset(
    {"validationId", "proposalId", "status", "readyCount", "blockerCount", "validationHash"}
)
CATALOG_KEYS = frozenset({"memberCount", "memberHashes", "catalogHash", "design", "endpoint"})
RELEASE_KEYS = frozenset(
    {
        "releaseId", "status", "coverageStatus", "memberCount", "proposalHash",
        "validationHash", "sourceDesignCatalogTextHash", "sourceDesignCatalogHash", "projectedDesignCatalogHash",
        "endpointCatalogHash", "proposalCatalogHash", "coverageHash", "releaseHash",
        "evidence", "eligibility",
    }
)
EVIDENCE_KEYS = frozenset({"accountRelay", "businessE2E", "visualQA"})
DESIGN_CATALOG_KEYS = frozenset({"schema", "catalogHash", "screenCount", "screens"})
DESIGN_SCREEN_KEYS = frozenset(
    {"screenKey", "processCode", "stepCode", "audience", "routePath", "designHash", "canonicalText", "canonicalDesign"}
)
ENDPOINT_CATALOG_KEYS = frozenset({"schema", "catalogHash", "endpoints"})
ENDPOINT_KEYS = frozenset(
    {"screenKey", "routePath", "audience", "designHash", "canonicalText", "endpointHash", "endpointText", "endpointContract"}
)
OPERATION_KEYS = frozenset(
    {
        "authority", "commandCode", "idempotencyRequired", "implementationKind",
        "method", "operationId", "path", "persistence", "processCode", "request",
        "response", "rollback", "stepCode", "transactionPolicy",
    }
)


class VerificationError(ValueError):
    pass


def fail(message: str) -> NoReturn:
    raise VerificationError(message)


def sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def compact(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def exact_object(value: Any, keys: frozenset[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != keys:
        actual = sorted(value) if isinstance(value, dict) else type(value).__name__
        fail(f"{label} keys must be exactly {sorted(keys)}; got {actual}")
    return value


def array(value: Any, label: str) -> list[Any]:
    if not isinstance(value, list):
        fail(f"{label} must be an array")
    return value


def integer(value: Any, label: str, minimum: int = 0) -> int:
    if type(value) is not int or value < minimum:
        fail(f"{label} must be an integer >= {minimum}")
    return value


def text(value: Any, label: str, pattern: re.Pattern[str] | None = None) -> str:
    if not isinstance(value, str) or not value or value != value.strip():
        fail(f"{label} must be non-empty unpadded text")
    if pattern is not None and pattern.fullmatch(value) is None:
        fail(f"{label} has invalid syntax")
    return value


def hash_text(value: Any, label: str) -> str:
    if not isinstance(value, str) or SHA_RE.fullmatch(value) is None:
        fail(f"{label} must be a lowercase SHA-256")
    return value


def parse_exact_json(value: Any, label: str) -> Any:
    if not isinstance(value, str) or not value:
        fail(f"{label} must be non-empty JSON text")
    try:
        parsed = json.loads(value)
    except (json.JSONDecodeError, RecursionError) as exc:
        fail(f"{label} is invalid JSON: {exc}")
    return parsed


def require_hash(value: str, claimed: Any, label: str) -> str:
    claimed_hash = hash_text(claimed, label)
    if sha(value) != claimed_hash:
        fail(f"{label} does not hash its exact UTF-8 text")
    return claimed_hash


def strict_source_array(raw: str, parsed_text: str, label: str) -> list[Any]:
    parsed = parse_exact_json(parsed_text, f"{label}ParsedCanonicalText")
    if not isinstance(parsed, list):
        fail(f"{label} parsed value must be an array")
    try:
        raw_value = json.loads(raw)
    except (json.JSONDecodeError, RecursionError) as exc:
        fail(f"{label}RawText is invalid JSON: {exc}")
    if not isinstance(raw_value, list):
        fail(f"{label}RawText must encode an array")
    if raw_value != parsed:
        fail(f"{label} raw/strict-parsed semantic mismatch")
    return parsed


def validate_schema(value: Any, label: str, request: bool) -> None:
    schema = exact_object(value, frozenset({"properties", "required", "type"}), label)
    if schema["type"] != "object" or not isinstance(schema["properties"], dict):
        fail(f"{label} must be an object schema")
    required = array(schema["required"], f"{label}.required")
    if any(not isinstance(name, str) for name in required) or len(required) != len(set(required)):
        fail(f"{label}.required must contain unique strings")
    if not set(required) <= set(schema["properties"]):
        fail(f"{label}.required references an unknown property")
    allowed = {"string", "integer", "number", "boolean", "object", "array"}
    for name, child in schema["properties"].items():
        if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name) is None:
            fail(f"{label} property name is invalid")
        if not isinstance(child, dict) or child.get("type") not in allowed:
            fail(f"{label}.{name} has invalid type")
    if request:
        runtime = {"tenantId", "projectId", "actorCode", "idempotencyKey"}
        if not runtime <= set(required):
            fail(f"{label} is missing runtime context")
        if any(schema["properties"][name] != {"type": "string"} for name in runtime):
            fail(f"{label} runtime context must be string typed")


def validate_operation(value: Any, expected: Mapping[str, Any], label: str) -> dict[str, Any]:
    operation = exact_object(value, OPERATION_KEYS, label)
    text(operation["operationId"], f"{label}.operationId", OP_RE)
    for key in ("processCode", "stepCode", "commandCode"):
        text(operation[key], f"{label}.{key}", CODE_RE)
    if operation["processCode"] != expected["processCode"] or operation["stepCode"] != expected["stepCode"]:
        fail(f"{label} process/step binding mismatch")
    if operation["implementationKind"] != "PROCESS_COMMAND_ADAPTER" or operation["method"] != "POST":
        fail(f"{label} is not the frozen v1 adapter")
    if operation["transactionPolicy"] != "REQUIRED" or operation["idempotencyRequired"] is not True:
        fail(f"{label} transactional/idempotency policy mismatch")
    path = text(operation["path"], f"{label}.path", PATH_RE)
    if path == "/" or path.endswith("/") or "//" in path or path.count("{executionId}") != 1 or "?" in path or "#" in path:
        fail(f"{label}.path is unsafe")
    authority = exact_object(
        operation["authority"],
        frozenset({"actorCodes", "audience", "authenticated", "projectScoped", "tenantScoped"}),
        f"{label}.authority",
    )
    actors = array(authority["actorCodes"], f"{label}.authority.actorCodes")
    if len(actors) != 1 or not isinstance(actors[0], str) or CODE_RE.fullmatch(actors[0]) is None:
        fail(f"{label}.authority.actorCodes must contain one actor")
    if authority["audience"] != expected["audience"] or authority["authenticated"] is not True or authority["projectScoped"] is not True or authority["tenantScoped"] is not True:
        fail(f"{label}.authority is invalid")
    request = exact_object(operation["request"], frozenset({"contentType", "schema"}), f"{label}.request")
    if request["contentType"] != "application/json":
        fail(f"{label}.request content type is invalid")
    validate_schema(request["schema"], f"{label}.request.schema", True)
    response = exact_object(operation["response"], frozenset({"errors", "schema", "successStatus"}), f"{label}.response")
    if type(response["successStatus"]) is not int or response["successStatus"] != 200:
        fail(f"{label}.response success status is invalid")
    validate_schema(response["schema"], f"{label}.response.schema", False)
    runtime_response = {
        "success": {"type": "boolean"}, "idempotent": {"type": "boolean"},
        "eventId": {"type": "integer"}, "toState": {"type": "string"},
    }
    if response["schema"]["properties"] != runtime_response or set(response["schema"]["required"]) != set(runtime_response):
        fail(f"{label}.response schema is not the frozen runtime response")
    errors = array(response["errors"], f"{label}.response.errors")
    expected_errors = {(400, "INVALID_REQUEST"), (401, "AUTHENTICATION_REQUIRED"), (403, "ACCESS_DENIED"), (500, "INTERNAL_ERROR")}
    actual_errors: set[tuple[int, str]] = set()
    for index, item in enumerate(errors):
        error = exact_object(item, frozenset({"code", "status"}), f"{label}.response.errors[{index}]")
        if type(error["status"]) is not int:
            fail(f"{label}.response.errors[{index}].status is invalid")
        text(error["code"], f"{label}.response.errors[{index}].code", CODE_RE)
        actual_errors.add((error["status"], error["code"]))
    if len(errors) != 4 or actual_errors != expected_errors:
        fail(f"{label}.response errors are not frozen v1")
    persistence = exact_object(
        operation["persistence"],
        frozenset({"entity", "operation", "persistenceId", "primaryKey", "projectColumn", "tenantColumn", "transactional", "versionColumn"}),
        f"{label}.persistence",
    )
    expected_persistence = {
        "persistenceId": "PROCESS_EXECUTION_AGGREGATE", "entity": "framework_process_execution",
        "operation": "UPDATE", "primaryKey": ["execution_id"], "tenantColumn": "tenant_id",
        "projectColumn": "project_id", "versionColumn": "execution_version", "transactional": True,
    }
    if persistence != expected_persistence:
        fail(f"{label}.persistence is not the existing aggregate")
    rollback = exact_object(operation["rollback"], frozenset({"commandCode", "strategy"}), f"{label}.rollback")
    if rollback != {"commandCode": operation["commandCode"], "strategy": "TRANSACTION"}:
        fail(f"{label}.rollback is invalid")
    return operation


def validate_design_catalog(value: Any, label: str) -> tuple[str, list[dict[str, Any]]]:
    catalog = exact_object(value, DESIGN_CATALOG_KEYS, label)
    if catalog["schema"] != DESIGN_SCHEMA:
        fail(f"{label}.schema is invalid")
    screens = array(catalog["screens"], f"{label}.screens")
    if integer(catalog["screenCount"], f"{label}.screenCount") != len(screens):
        fail(f"{label}.screenCount mismatch")
    seen: set[str] = set()
    lines: list[str] = []
    result: list[dict[str, Any]] = []
    for index, raw in enumerate(screens):
        screen = exact_object(raw, DESIGN_SCREEN_KEYS, f"{label}.screens[{index}]")
        key = text(screen["screenKey"], f"{label}.screens[{index}].screenKey")
        if key.casefold() in seen:
            fail(f"{label} contains duplicate screenKey")
        seen.add(key.casefold())
        for field in ("processCode", "stepCode"):
            text(screen[field], f"{label}.screens[{index}].{field}", CODE_RE)
        canonical = parse_exact_json(screen["canonicalText"], f"{label}.screens[{index}].canonicalText")
        design_hash = require_hash(screen["canonicalText"], screen["designHash"], f"{label}.screens[{index}].designHash")
        if canonical != screen["canonicalDesign"]:
            fail(f"{label}.screens[{index}] canonical text/object mismatch")
        identity = canonical.get("identity") if isinstance(canonical, dict) else None
        if not isinstance(identity, dict) or identity.get("screenKey") != key or identity.get("processCode") != screen["processCode"] or identity.get("stepCode") != screen["stepCode"] or identity.get("audience") != screen["audience"] or identity.get("routePath") != screen["routePath"]:
            fail(f"{label}.screens[{index}] identity mismatch")
        lines.append(f"{key}{US}{design_hash}")
        result.append(screen)
    claimed = hash_text(catalog["catalogHash"], f"{label}.catalogHash")
    if sha("\n".join(lines)) != claimed:
        fail(f"{label}.catalogHash mismatch")
    return claimed, result


def validate_endpoint_catalog(value: Any, label: str) -> tuple[str, list[dict[str, Any]]]:
    catalog = exact_object(value, ENDPOINT_CATALOG_KEYS, label)
    if catalog["schema"] != ENDPOINT_SCHEMA:
        fail(f"{label}.schema is invalid")
    endpoints = array(catalog["endpoints"], f"{label}.endpoints")
    seen_screens: set[str] = set()
    seen_ops: set[str] = set()
    seen_routes: set[str] = set()
    lines: list[str] = []
    result: list[dict[str, Any]] = []
    for index, raw in enumerate(endpoints):
        endpoint = exact_object(raw, ENDPOINT_KEYS, f"{label}.endpoints[{index}]")
        key = text(endpoint["screenKey"], f"{label}.endpoints[{index}].screenKey")
        if key.casefold() in seen_screens:
            fail(f"{label} contains duplicate screenKey")
        seen_screens.add(key.casefold())
        design = parse_exact_json(endpoint["canonicalText"], f"{label}.endpoints[{index}].canonicalText")
        require_hash(endpoint["canonicalText"], endpoint["designHash"], f"{label}.endpoints[{index}].designHash")
        contract = parse_exact_json(endpoint["endpointText"], f"{label}.endpoints[{index}].endpointText")
        endpoint_hash = require_hash(endpoint["endpointText"], endpoint["endpointHash"], f"{label}.endpoints[{index}].endpointHash")
        if contract != endpoint["endpointContract"]:
            fail(f"{label}.endpoints[{index}] endpoint text/object mismatch")
        contract = exact_object(contract, frozenset({"audience", "operations", "routePath", "screenKey", "source"}), f"{label}.endpoints[{index}].contract")
        source = exact_object(contract["source"], frozenset({"designHash", "schema"}), f"{label}.endpoints[{index}].source")
        if source != {"designHash": endpoint["designHash"], "schema": DESIGN_SCHEMA}:
            fail(f"{label}.endpoints[{index}] source mismatch")
        identity = design.get("identity") if isinstance(design, dict) else None
        if not isinstance(identity, dict):
            fail(f"{label}.endpoints[{index}] design identity missing")
        if any(contract[field] != endpoint[field] for field in ("screenKey", "routePath", "audience")) or key != identity.get("screenKey"):
            fail(f"{label}.endpoints[{index}] identity mismatch")
        operations = array(contract["operations"], f"{label}.endpoints[{index}].operations")
        if len(operations) != 1:
            fail(f"{label}.endpoints[{index}] must contain one operation")
        op = validate_operation(operations[0], identity, f"{label}.endpoints[{index}].operation")
        op_id = op["operationId"].casefold()
        route = f"{op['method']} {op['path']}".casefold()
        if op_id in seen_ops or route in seen_routes:
            fail(f"{label} contains a duplicate/colliding operation")
        seen_ops.add(op_id)
        seen_routes.add(route)
        lines.append(f"{key}{US}{endpoint_hash}")
        result.append(endpoint)
    claimed = hash_text(catalog["catalogHash"], f"{label}.catalogHash")
    if sha("\n".join(lines)) != claimed:
        fail(f"{label}.catalogHash mismatch")
    return claimed, result


def verify(envelope: Any, require_publishable: bool = False) -> dict[str, Any]:
    root = exact_object(envelope, TOP_KEYS, "envelope")
    if root["schemaVersion"] != SCHEMA:
        fail("schemaVersion is invalid")

    source = exact_object(root["source"], SOURCE_KEYS, "source")
    scope = source["scopeProcess"]
    if scope != "*":
        text(scope, "source.scopeProcess", CODE_RE)
    source_text = source["sourceDesignCatalogText"]
    source_text_hash = require_hash(
        source_text, source["sourceDesignCatalogTextHash"],
        "source.sourceDesignCatalogTextHash",
    )
    source_catalog = parse_exact_json(source_text, "source.sourceDesignCatalogText")
    source_hash, source_screens = validate_design_catalog(
        source_catalog, "source.sourceDesignCatalog"
    )
    if source["sourceDesignCatalogHash"] != source_hash:
        fail("source.sourceDesignCatalogHash/parsed catalogHash mismatch")
    source_design_count = integer(source["sourceDesignCount"], "source.sourceDesignCount")
    policy = parse_exact_json(source["policyText"], "source.policyText")
    if not isinstance(policy, dict):
        fail("source.policyText must encode an object")
    policy_hash = require_hash(source["policyText"], source["policyHash"], "source.policyHash")

    coverage = exact_object(root["coverage"], COVERAGE_KEYS, "coverage")
    source_count = integer(coverage["sourceDesignCount"], "coverage.sourceDesignCount")
    member_count = integer(coverage["memberCount"], "coverage.memberCount")
    reason_keys = ("missingContractCount", "duplicateBlueprintCount", "duplicateContractCount", "incompleteLaneCount")
    reasons = [integer(coverage[key], f"coverage.{key}") for key in reason_keys]
    blockers = integer(coverage["blockerCount"], "coverage.blockerCount")
    if source_count != source_design_count or blockers != sum(reasons) or source_count != member_count + blockers:
        fail("coverage counts are inconsistent")
    if len(source_screens) != member_count:
        fail("source catalog compilable screen count/memberCount mismatch")
    expected_status = "COMPLETE" if blockers == 0 else "PARTIAL"
    if coverage["status"] != expected_status:
        fail("coverage.status/count mismatch")
    coverage_hash = hash_text(coverage["coverageHash"], "coverage.coverageHash")
    coverage_fields = [
        coverage["status"], str(source_count), str(member_count),
        str(coverage["missingContractCount"]), str(coverage["duplicateBlueprintCount"]),
        str(coverage["duplicateContractCount"]), str(coverage["incompleteLaneCount"]),
        str(blockers),
    ]
    if sha(US.join(coverage_fields)) != coverage_hash:
        fail("coverage.coverageHash mismatch")

    catalog = exact_object(root["catalog"], CATALOG_KEYS, "catalog")
    design_hash, design_screens = validate_design_catalog(catalog["design"], "catalog.design")
    endpoint_catalog_hash, endpoints = validate_endpoint_catalog(catalog["endpoint"], "catalog.endpoint")
    if len(design_screens) != len(endpoints):
        fail("projected design/endpoint catalog counts differ")
    designs = {item["screenKey"]: item for item in design_screens}
    endpoint_by_key = {item["screenKey"]: item for item in endpoints}
    if set(designs) != set(endpoint_by_key):
        fail("projected design/endpoint screen sets differ")

    members = array(root["members"], "members")
    if len(members) != member_count or integer(catalog["memberCount"], "catalog.memberCount") != member_count:
        fail("member counts differ")
    source_by_key = {item["screenKey"]: item for item in source_screens}
    member_hashes: list[str] = []
    seen_contracts: set[int] = set()
    seen_screens: set[str] = set()
    for index, raw in enumerate(members):
        member = exact_object(raw, MEMBER_KEYS, f"members[{index}]")
        if integer(member["ordinal"], f"members[{index}].ordinal", 1) != index + 1:
            fail("member ordinals must be contiguous and ordered")
        contract_id = integer(member["sourceContractId"], f"members[{index}].sourceContractId", 1)
        if contract_id in seen_contracts:
            fail("duplicate sourceContractId")
        seen_contracts.add(contract_id)
        process = text(member["processCode"], f"members[{index}].processCode", CODE_RE)
        step = text(member["stepCode"], f"members[{index}].stepCode", CODE_RE)
        key = text(member["screenKey"], f"members[{index}].screenKey")
        if key in seen_screens or key not in designs or key not in source_by_key:
            fail("member screenKey is duplicate or absent from catalogs")
        seen_screens.add(key)
        if scope != "*" and process != scope:
            fail("member escapes source.scopeProcess")
        source_screen = source_by_key[key]
        if member["sourceDesignHash"] != source_screen["designHash"] or process != source_screen["processCode"] or step != source_screen["stepCode"]:
            fail("member source design lineage mismatch")
        parsed_lineage: dict[str, list[Any]] = {}
        for prefix in ("sourceApi", "sourceDatabase"):
            raw_text = member[f"{prefix}RawText"]
            if not isinstance(raw_text, str):
                fail(f"members[{index}].{prefix}RawText must be text")
            require_hash(raw_text, member[f"{prefix}RawHash"], f"members[{index}].{prefix}RawHash")
            parsed_text = member[f"{prefix}ParsedCanonicalText"]
            require_hash(parsed_text, member[f"{prefix}ParsedHash"], f"members[{index}].{prefix}ParsedHash")
            parsed_lineage[prefix] = strict_source_array(
                raw_text, parsed_text, f"members[{index}].{prefix}"
            )
        source_lanes = source_screen["canonicalDesign"].get("lanes")
        if (
            not isinstance(source_lanes, dict)
            or parsed_lineage["sourceApi"] != source_lanes.get("API")
            or parsed_lineage["sourceDatabase"] != source_lanes.get("DATABASE")
        ):
            fail("member raw/parsed source lineage does not match source design lanes")
        projected = designs[key]
        projected_text = member["projectedDesignCanonicalText"]
        projected_hash = require_hash(projected_text, member["projectedDesignHash"], f"members[{index}].projectedDesignHash")
        if projected_text != projected["canonicalText"] or projected_hash != projected["designHash"]:
            fail("member projected design binding mismatch")
        endpoint = endpoint_by_key[key]
        endpoint_text = member["endpointCanonicalText"]
        endpoint_hash = require_hash(endpoint_text, member["endpointHash"], f"members[{index}].endpointHash")
        if endpoint_text != endpoint["endpointText"] or endpoint_hash != endpoint["endpointHash"]:
            fail("member endpoint binding mismatch")
        identity = projected["canonicalDesign"]["identity"]
        operation = validate_operation(member["operation"], identity, f"members[{index}].operation")
        endpoint_operation = endpoint["endpointContract"]["operations"][0]
        if operation != endpoint_operation:
            fail("member operation/endpoint operation mismatch")
        lanes = projected["canonicalDesign"].get("lanes")
        expected_api = dict(operation)
        expected_api.pop("persistence", None)
        expected_api["persistenceRef"] = "PROCESS_EXECUTION_AGGREGATE"
        if not isinstance(lanes, dict) or lanes.get("API") != [expected_api] or lanes.get("DATABASE") != [operation["persistence"]]:
            fail("member operation is not derived from projected API/DATABASE lanes")
        fields = [
            str(index + 1), str(contract_id), process, step, key,
            member["sourceDesignHash"], member["sourceApiRawHash"], member["sourceApiParsedHash"],
            member["sourceDatabaseRawHash"], member["sourceDatabaseParsedHash"], projected_hash,
            endpoint_hash,
        ]
        claimed_member_hash = hash_text(member["memberHash"], f"members[{index}].memberHash")
        if sha(US.join(fields)) != claimed_member_hash:
            fail("memberHash mismatch")
        member_hashes.append(claimed_member_hash)
    if set(designs) != seen_screens:
        fail("member exact screen set mismatch")
    if catalog["memberHashes"] != member_hashes:
        fail("catalog.memberHashes/order mismatch")
    catalog_hash = hash_text(catalog["catalogHash"], "catalog.catalogHash")
    if sha("\n".join(member_hashes)) != catalog_hash:
        fail("catalog.catalogHash mismatch")

    proposals = array(root["proposals"], "proposals")
    if len(proposals) != 1:
        fail("v1 requires exactly one proposal header")
    proposal = exact_object(proposals[0], PROPOSAL_KEYS, "proposals[0]")
    proposal_id = integer(proposal["proposalId"], "proposals[0].proposalId", 1)
    if proposal["status"] != "PUBLISHED":
        fail("proposals[0].status must be PUBLISHED in a release envelope")
    if proposal["policyHash"] != policy_hash or proposal["sourceDesignCatalogTextHash"] != source_text_hash or proposal["sourceDesignCatalogHash"] != source_hash or proposal["projectedDesignCatalogHash"] != design_hash or proposal["memberCount"] != member_count:
        fail("proposal lineage/count mismatch")
    proposal_fields = [
        str(proposal_id), policy_hash, source_text_hash, source_hash, design_hash,
        str(member_count), catalog_hash,
    ]
    proposal_hash = hash_text(proposal["proposalHash"], "proposals[0].proposalHash")
    if sha(US.join(proposal_fields)) != proposal_hash:
        fail("proposalHash mismatch")
    proposal_catalog_hash = hash_text(
        proposal["proposalCatalogHash"], "proposals[0].proposalCatalogHash"
    )
    if proposal_catalog_hash != catalog_hash:
        fail("proposalCatalogHash/member catalogHash mismatch")

    validations = array(root["validations"], "validations")
    if len(validations) != 1:
        fail("v1 requires exactly one validation header")
    validation = exact_object(validations[0], VALIDATION_KEYS, "validations[0]")
    validation_id = integer(validation["validationId"], "validations[0].validationId", 1)
    if validation["proposalId"] != proposal_id or validation["readyCount"] != member_count or validation["blockerCount"] != 0:
        fail("validation proposal/count mismatch")
    if validation["status"] != "VALIDATED":
        fail("a released envelope must carry a VALIDATED proposal")
    validation_hash = hash_text(validation["validationHash"], "validations[0].validationHash")
    if sha(US.join([str(validation_id), str(proposal_id), validation["status"], str(member_count), "0", proposal_hash])) != validation_hash:
        fail("validationHash mismatch")

    release = exact_object(root["release"], RELEASE_KEYS, "release")
    release_id = integer(release["releaseId"], "release.releaseId", 1)
    if release["status"] not in {"PUBLISHED", "ACTIVE"}:
        fail("release.status must be PUBLISHED or ACTIVE")
    if scope == "*" and release["status"] == "ACTIVE":
        fail("global source.scopeProcess cannot be ACTIVE")
    evidence = exact_object(release["evidence"], EVIDENCE_KEYS, "release.evidence")
    evidence_verified = True
    for name, raw_evidence in evidence.items():
        item = exact_object(
            raw_evidence, frozenset({"status", "evidenceHash"}),
            f"release.evidence.{name}",
        )
        if item["status"] == "ABSENT":
            if item["evidenceHash"] is not None:
                fail(f"release.evidence.{name} ABSENT must have null evidenceHash")
            evidence_verified = False
        elif item["status"] == "VERIFIED":
            hash_text(item["evidenceHash"], f"release.evidence.{name}.evidenceHash")
        else:
            fail(f"release.evidence.{name}.status is invalid")
    expected_eligibility = (
        "PUBLISHABLE" if blockers == 0 and evidence_verified else "VALIDATED_ONLY"
    )
    if release["eligibility"] != expected_eligibility:
        fail("release.eligibility is inconsistent with coverage/evidence")
    release_links = {
        "coverageStatus": expected_status, "memberCount": member_count,
        "proposalHash": proposal_hash, "validationHash": validation_hash,
        "sourceDesignCatalogTextHash": source_text_hash,
        "sourceDesignCatalogHash": source_hash, "projectedDesignCatalogHash": design_hash,
        "endpointCatalogHash": endpoint_catalog_hash, "proposalCatalogHash": proposal_catalog_hash,
        "coverageHash": coverage_hash,
    }
    for key_name, expected in release_links.items():
        if release[key_name] != expected:
            fail(f"release.{key_name} cross-link mismatch")
    evidence_fields: list[str] = []
    for evidence_name in ("accountRelay", "businessE2E", "visualQA"):
        evidence_fields.extend([
            evidence[evidence_name]["status"],
            evidence[evidence_name]["evidenceHash"] or "",
        ])
    release_fields = [
        str(release_id), release["status"], release["coverageStatus"], str(member_count),
        proposal_hash, validation_hash, source_text_hash, source_hash, design_hash, endpoint_catalog_hash,
        proposal_catalog_hash, coverage_hash, *evidence_fields, release["eligibility"],
    ]
    release_hash = hash_text(release["releaseHash"], "release.releaseHash")
    if sha(US.join(release_fields)) != release_hash:
        fail("releaseHash mismatch")
    code_publication_eligible = (
        release["status"] == "ACTIVE" and release["eligibility"] == "PUBLISHABLE"
    )
    if require_publishable and not code_publication_eligible:
        fail("release is not ACTIVE and PUBLISHABLE for code publication")

    return {
        "schemaVersion": SCHEMA, "releaseId": release_id, "releaseHash": release_hash,
        "status": release["status"], "coverageStatus": expected_status,
        "memberCount": member_count, "blockerCount": blockers,
        "eligibility": release["eligibility"],
        "codePublicationEligible": code_publication_eligible,
        "sourceDesignCatalogTextHash": source_text_hash,
        "sourceDesignCatalogHash": source_hash, "projectedDesignCatalogHash": design_hash,
        "endpointCatalogHash": endpoint_catalog_hash, "proposalCatalogHash": proposal_catalog_hash,
    }


def read_input(path: str) -> Any:
    try:
        raw = sys.stdin.read() if path == "-" else Path(path).read_text(encoding="utf-8")
    except OSError as exc:
        fail(f"cannot read input: {exc}")
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, RecursionError) as exc:
        fail(f"input is invalid JSON: {exc}")


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", nargs="?", default="-", help="JSON envelope file, or - for stdin")
    parser.add_argument("--check", action="store_true", help="validate without writing output files")
    parser.add_argument("--require-publishable", action="store_true", help="also require all publication evidence")
    parser.add_argument("--emit-normalized", action="store_true", help="emit a verified normalized manifest to stdout")
    args = parser.parse_args(argv)
    if not args.check and not args.emit_normalized:
        parser.error("one of --check or --emit-normalized is required")
    try:
        normalized = verify(read_input(args.input), args.require_publishable)
    except VerificationError as exc:
        print(f"canonical endpoint upgrade release verification failed: {exc}", file=sys.stderr)
        return 2
    if args.emit_normalized:
        print(compact(normalized))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
