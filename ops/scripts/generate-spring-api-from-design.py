#!/usr/bin/env python3
"""Generate deterministic Spring process-command adapters from canonical endpoint contracts."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any


SHA256 = re.compile(r"^[0-9a-f]{64}$")
JAVA_ID = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
OP_ID = re.compile(r"^[A-Za-z][A-Za-z0-9_]{1,79}$")
CODE = re.compile(r"^[A-Z][A-Z0-9_]{1,79}$")
DB_ID = re.compile(r"^[a-z][a-z0-9_]{0,62}$")
PATH = re.compile(r"^/[A-Za-z0-9_{}./-]+$")
SCHEMA = "carbonet.canonical-endpoint-catalog/v1"
PACKAGE = "egovframework.com.generated.canonical"
RUNTIME_FIELDS = {"tenantId", "projectId", "actorCode", "idempotencyKey"}
RUNTIME_RESPONSE_SCHEMA = {
    "success": {"type": "boolean"},
    "idempotent": {"type": "boolean"},
    "eventId": {"type": "integer"},
    "toState": {"type": "string"},
}
RUNTIME_ERRORS = {
    (400, "INVALID_REQUEST"),
    (401, "AUTHENTICATION_REQUIRED"),
    (403, "ACCESS_DENIED"),
    (500, "INTERNAL_ERROR"),
}
RUNTIME_PERSISTENCE = {
    "persistenceId": "PROCESS_EXECUTION_AGGREGATE",
    "entity": "framework_process_execution",
    "operation": "UPDATE",
    "primaryKey": ["execution_id"],
    "tenantColumn": "tenant_id",
    "projectColumn": "project_id",
    "versionColumn": "execution_version",
    "transactional": True,
}
RESERVED_FIELDS = RUNTIME_FIELDS | {
    "executionId", "processCode", "stepCode", "commandCode", "requestJson", "resultJson",
    "requireDraft", "routePath", "audience",
}
JAVA_KEYWORDS = {
    "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char",
    "class", "const", "continue", "default", "do", "double", "else", "enum",
    "extends", "final", "finally", "float", "for", "goto", "if", "implements",
    "import", "instanceof", "int", "interface", "long", "native", "new",
    "package", "private", "protected", "public", "record", "return", "sealed",
    "short", "static", "strictfp", "super", "switch", "synchronized", "this",
    "throw", "throws", "transient", "try", "var", "void", "volatile", "while", "yield",
}


class ContractError(ValueError):
    pass


def stable(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(value: str | bytes) -> str:
    if isinstance(value, str):
        value = value.encode("utf-8")
    if not isinstance(value, bytes):
        raise ContractError("hash input must be text or bytes")
    return hashlib.sha256(value).hexdigest()


def required_text(row: dict[str, Any], key: str, pattern: re.Pattern[str] | None = None) -> str:
    value = row.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ContractError(f"{key} is required")
    value = value.strip()
    if pattern and not pattern.fullmatch(value):
        raise ContractError(f"{key} is invalid: {value!r}")
    return value


def exact_keys(row: Any, expected: set[str], label: str) -> dict[str, Any]:
    if not isinstance(row, dict) or set(row) != expected:
        raise ContractError(f"{label} keys must be exactly {sorted(expected)}")
    return row


def safe_path(row: dict[str, Any]) -> str:
    value = required_text(row, "path", PATH)
    if (value.startswith("//") or "//" in value or "?" in value or "#" in value
            or "\\" in value
            or any(part in {"", ".", ".."} for part in value.split("/")[1:])):
        raise ContractError("path contains an unsafe segment")
    variables = re.findall(r"\{[^{}]*\}", value)
    if variables != ["{executionId}"] or value.count("{") != 1 or value.count("}") != 1:
        raise ContractError("path must contain exactly one {executionId} and no other variables")
    return value


def reject_implementation(value: Any, label: str) -> None:
    forbidden = {
        "sql", "query", "statement", "ddl", "dml", "handlerclass",
        "serviceclass", "repositoryclass", "implementationclass",
    }
    if isinstance(value, dict):
        for key, child in value.items():
            if str(key).lower() in forbidden:
                raise ContractError(f"{label} contains forbidden implementation key: {key}")
            reject_implementation(child, f"{label}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            reject_implementation(child, f"{label}[{index}]")


def java_name(value: str) -> str:
    result = "".join(part[:1].upper() + part[1:] for part in re.split(r"[^A-Za-z0-9]+", value) if part)
    if not result or not JAVA_ID.fullmatch(result):
        raise ContractError(f"operationId cannot form a Java identifier: {value!r}")
    return result


def java_type(schema: dict[str, Any], label: str) -> str:
    kind = schema.get("type")
    return {
        "string": "String", "integer": "Long", "number": "java.math.BigDecimal",
        "boolean": "Boolean", "object": "java.util.Map<String,Object>",
        "array": "java.util.List<Object>",
    }.get(kind) or (_ for _ in ()).throw(ContractError(f"{label}.type is unsupported: {kind!r}"))


def schema_fields(schema: Any, label: str, request: bool = False) -> list[tuple[str, str]]:
    schema = exact_keys(schema, {"type", "properties", "required"}, label)
    if schema["type"] != "object" or not isinstance(schema["properties"], dict) or not isinstance(schema["required"], list):
        raise ContractError(f"{label} must be an object JSON Schema")
    if (any(not isinstance(name, str) for name in schema["required"])
            or len(set(schema["required"])) != len(schema["required"])
            or not set(schema["required"]).issubset(schema["properties"])):
        raise ContractError(f"{label}.required is invalid")
    fields: list[tuple[str, str]] = []
    for name, child in sorted(schema["properties"].items()):
        if not JAVA_ID.fullmatch(name) or name in JAVA_KEYWORDS or not isinstance(child, dict):
            raise ContractError(f"{label} property is invalid: {name!r}")
        fields.append((java_type(child, f"{label}.{name}"), name))
    if request:
        required = set(schema["required"])
        properties = schema["properties"]
        if not RUNTIME_FIELDS.issubset(required):
            raise ContractError(f"{label} must require runtime context fields: {sorted(RUNTIME_FIELDS)}")
        for name in RUNTIME_FIELDS:
            if properties[name].get("type") != "string":
                raise ContractError(f"{label}.{name} must be a string")
        collisions = (set(properties) & RESERVED_FIELDS) - RUNTIME_FIELDS
        if collisions:
            raise ContractError(f"{label} attempts to override generated fields: {sorted(collisions)}")
    return fields


def validate_operation(operation: Any, screen: dict[str, Any]) -> dict[str, Any]:
    keys = {"operationId", "implementationKind", "method", "path", "processCode", "stepCode", "commandCode",
            "authority", "request", "response", "persistence", "transactionPolicy",
            "idempotencyRequired", "rollback"}
    operation = exact_keys(operation, keys, "operation")
    required_text(operation, "operationId", OP_ID)
    if operation["implementationKind"] != "PROCESS_COMMAND_ADAPTER" or operation["method"] != "POST":
        raise ContractError("only POST PROCESS_COMMAND_ADAPTER is supported")
    safe_path(operation)
    for key in ("processCode", "stepCode"):
        required_text(operation, key, CODE)
        if operation[key] != screen[key]:
            raise ContractError(f"operation {key} does not match canonical design")
    command_code = required_text(operation, "commandCode", CODE)
    if command_code not in screen["commandCodes"]:
        raise ContractError("operation commandCode is not declared by the canonical step")
    authority = exact_keys(operation["authority"], {"audience", "actorCodes", "authenticated", "tenantScoped", "projectScoped"}, "authority")
    if authority["audience"] != screen["audience"] or authority["authenticated"] is not True:
        raise ContractError("authority must be authenticated and match the screen audience")
    if authority["actorCodes"] != [screen["actorCode"]]:
        raise ContractError("authority.actorCodes must exactly match the canonical actor")
    if authority["tenantScoped"] is not True or authority["projectScoped"] is not True:
        raise ContractError("process command authority must be tenant and project scoped")
    request = exact_keys(operation["request"], {"contentType", "schema"}, "request")
    if request["contentType"] != "application/json":
        raise ContractError("request.contentType must be application/json")
    schema_fields(request["schema"], "request.schema", request=True)
    response = exact_keys(operation["response"], {"successStatus", "schema", "errors"}, "response")
    if type(response["successStatus"]) is not int or response["successStatus"] != 200 or not isinstance(response["errors"], list):
        raise ContractError("response contract is invalid")
    schema_fields(response["schema"], "response.schema")
    if (response["schema"]["properties"] != RUNTIME_RESPONSE_SCHEMA
            or set(response["schema"]["required"]) != set(RUNTIME_RESPONSE_SCHEMA)):
        raise ContractError("response.schema must exactly match the process-command runtime response")
    errors: set[tuple[int, str]] = set()
    for index, raw_error in enumerate(response["errors"]):
        error = exact_keys(raw_error, {"status", "code"}, f"response.errors[{index}]")
        if type(error["status"]) is not int or not 400 <= error["status"] <= 599:
            raise ContractError(f"response.errors[{index}].status is invalid")
        code = required_text(error, "code", CODE)
        signature = (error["status"], code)
        if signature in errors:
            raise ContractError("response.errors contains a duplicate")
        errors.add(signature)
    if errors != RUNTIME_ERRORS:
        raise ContractError("response.errors must exactly declare runtime 400/401/403/500 errors")
    persistence = operation["persistence"]
    persistence = exact_keys(persistence, {"persistenceId", "entity", "operation", "primaryKey", "tenantColumn", "projectColumn", "versionColumn", "transactional"}, "persistence")
    required_text(persistence, "persistenceId", CODE)
    required_text(persistence, "entity", DB_ID)
    if persistence != RUNTIME_PERSISTENCE:
        raise ContractError("persistence must exactly target the existing process execution aggregate")
    primary_key = persistence["primaryKey"]
    if (not isinstance(primary_key, list) or not primary_key
            or len(primary_key) != len(set(primary_key))
            or any(not isinstance(value, str) or not DB_ID.fullmatch(value) for value in primary_key)):
        raise ContractError("persistence.primaryKey is required")
    for key in ("tenantColumn", "projectColumn", "versionColumn"):
        value = persistence[key]
        if value is not None and (not isinstance(value, str) or not DB_ID.fullmatch(value)):
            raise ContractError(f"persistence.{key} is invalid")
    if operation["transactionPolicy"] != "REQUIRED" or operation["idempotencyRequired"] is not True:
        raise ContractError("transactionPolicy REQUIRED and idempotencyRequired true are mandatory")
    rollback = exact_keys(operation["rollback"], {"strategy", "commandCode"}, "rollback")
    if rollback["strategy"] != "TRANSACTION":
        raise ContractError("only the existing transactional runtime rollback is supported")
    required_text(rollback, "commandCode", CODE)
    if rollback["commandCode"] != operation["commandCode"]:
        raise ContractError("rollback commandCode must match operation commandCode")
    reject_implementation(operation, "operation")
    return operation


def record_source(name: str, fields: list[tuple[str, str]], suffix: str, design_hash: str, endpoint_hash: str) -> tuple[str, bytes]:
    components = ", ".join(f"{kind} {field}" for kind, field in fields)
    body = f"""package {PACKAGE};

@javax.annotation.processing.Generated(value="canonical-design", comments="designHash={design_hash};endpointHash={endpoint_hash}")
public record {name}{suffix}({components}) {{}}
"""
    return f"src/main/java/{PACKAGE.replace('.', '/')}/{name}{suffix}.java", body.encode()


def operation_sources(screen: dict[str, Any], operation: dict[str, Any], endpoint_hash: str) -> list[tuple[str, bytes]]:
    name = java_name(operation["operationId"])
    request_fields = schema_fields(operation["request"]["schema"], "request.schema", request=True)
    response_fields = schema_fields(operation["response"]["schema"], "response.schema")
    request_path, request_source = record_source(name, request_fields, "Request", screen["designHash"], endpoint_hash)
    response_path, response_source = record_source(name, response_fields, "Response", screen["designHash"], endpoint_hash)
    context_lines = "\n".join(
        f'        payload.put("{field}", request.{field}());'
        for _, field in request_fields if field in RUNTIME_FIELDS
    )
    business_lines = "\n".join(
        f'        business.put("{field}", request.{field}());'
        for _, field in request_fields if field not in RUNTIME_FIELDS
    )
    required_guard = " || ".join(
        f"request.{field}()==null"
        + (f" || request.{field}().isBlank()" if operation["request"]["schema"]["properties"][field]["type"] == "string" else "")
        for field in sorted(operation["request"]["schema"]["required"])
    )
    source = f"""package {PACKAGE};

@org.springframework.web.bind.annotation.RestController
@javax.annotation.processing.Generated(value="canonical-design", comments="designHash={screen['designHash']};endpointHash={endpoint_hash}")
public final class {name}Controller {{
    private final egovframework.com.platform.governance.service.ActorProcessGovernanceService service;
    private final egovframework.com.feature.auth.service.CurrentUserContextService currentUserContextService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    public {name}Controller(
            egovframework.com.platform.governance.service.ActorProcessGovernanceService service,
            egovframework.com.feature.auth.service.CurrentUserContextService currentUserContextService,
            com.fasterxml.jackson.databind.ObjectMapper objectMapper) {{
        this.service=service;
        this.currentUserContextService=currentUserContextService;
        this.objectMapper=objectMapper;
    }}

    @org.springframework.web.bind.annotation.PostMapping(path={json.dumps(operation['path'])}, consumes="application/json")
    public org.springframework.http.ResponseEntity<?> execute(
            @org.springframework.web.bind.annotation.PathVariable("executionId") java.util.UUID executionId,
            @org.springframework.web.bind.annotation.RequestBody {name}Request request,
            jakarta.servlet.http.HttpServletRequest servletRequest) {{
        var context=currentUserContextService.resolve(servletRequest);
        if(context==null || !context.isAuthenticated() || context.getUserId()==null || context.getUserId().isBlank())
            return org.springframework.http.ResponseEntity.status(401).body(java.util.Map.of("success",false,"code","AUTHENTICATION_REQUIRED","message","Authentication is required."));
        if(request==null || {required_guard})
            return org.springframework.http.ResponseEntity.badRequest().body(java.util.Map.of("success",false,"code","INVALID_REQUEST","message","Required request field is missing."));
        if(!{json.dumps(screen['actorCode'])}.equals(request.actorCode()))
            return org.springframework.http.ResponseEntity.status(403).body(java.util.Map.of("success",false,"code","ACCESS_DENIED","message","Access denied"));
        var payload=new java.util.LinkedHashMap<String,Object>();
{context_lines}
        payload.put("processCode",{json.dumps(operation['processCode'])});
        payload.put("stepCode",{json.dumps(operation['stepCode'])});
        payload.put("commandCode",{json.dumps(operation['commandCode'])});
        payload.put("routePath",{json.dumps(screen['routePath'])});
        payload.put("audience",{json.dumps(screen['audience'])});
        payload.put("requireDraft",true);
        var business=new java.util.LinkedHashMap<String,Object>();
{business_lines}
        try {{
            try {{ payload.put("requestJson",objectMapper.writeValueAsString(business)); }}
            catch(Exception invalidJson) {{
                return org.springframework.http.ResponseEntity.badRequest().body(java.util.Map.of("success",false,"code","INVALID_REQUEST","message","Request serialization failed"));
            }}
            var result=service.executeProcessCommand(executionId,payload,context.getUserId());
            if(!(result.get("success") instanceof Boolean)
                    || !(result.get("idempotent") instanceof Boolean)
                    || !(result.get("eventId") instanceof Number)
                    || !(result.get("toState") instanceof String))
                return org.springframework.http.ResponseEntity.status(500).body(java.util.Map.of("success",false,"code","INTERNAL_ERROR","message","Response contract mismatch"));
            var responsePayload=new java.util.LinkedHashMap<String,Object>();
            responsePayload.put("success",result.get("success"));
            responsePayload.put("idempotent",result.get("idempotent"));
            responsePayload.put("eventId",((Number)result.get("eventId")).longValue());
            responsePayload.put("toState",result.get("toState"));
            {name}Response response;
            try {{ response=objectMapper.convertValue(responsePayload,{name}Response.class); }}
            catch(IllegalArgumentException mismatch) {{
                return org.springframework.http.ResponseEntity.status(500).body(java.util.Map.of("success",false,"code","INTERNAL_ERROR","message","Response contract mismatch"));
            }}
            return org.springframework.http.ResponseEntity.status({operation['response']['successStatus']}).body(response);
        }}
        catch(SecurityException denied) {{ return org.springframework.http.ResponseEntity.status(403).body(java.util.Map.of("success",false,"code","ACCESS_DENIED","message","Access denied")); }}
        catch(IllegalArgumentException | IllegalStateException invalid) {{ return org.springframework.http.ResponseEntity.badRequest().body(java.util.Map.of("success",false,"code","INVALID_REQUEST","message","Request failed")); }}
        catch(Exception unexpected) {{ return org.springframework.http.ResponseEntity.status(500).body(java.util.Map.of("success",false,"code","INTERNAL_ERROR","message","Internal processing failed")); }}
    }}
}}
"""
    controller_path = f"src/main/java/{PACKAGE.replace('.', '/')}/{name}Controller.java"
    return [(request_path, request_source), (response_path, response_source), (controller_path, source.encode())]


def load_contract(path: Path) -> tuple[str, list[dict[str, Any]]]:
    try:
        catalog = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ContractError(f"invalid catalog: {exc}") from exc
    catalog = exact_keys(catalog, {"schema", "catalogHash", "endpoints"}, "catalog")
    if catalog["schema"] != SCHEMA or not isinstance(catalog["catalogHash"], str) or not SHA256.fullmatch(catalog["catalogHash"]):
        raise ContractError("catalog schema/hash is invalid")
    if not isinstance(catalog["endpoints"], list) or not catalog["endpoints"]:
        raise ContractError("catalog endpoints are required")
    operations: list[dict[str, Any]] = []
    route_signatures: set[str] = set()
    operation_ids: set[str] = set()
    screen_keys: set[str] = set()
    lines: list[str] = []
    for endpoint in catalog["endpoints"]:
        endpoint = exact_keys(endpoint, {"screenKey", "routePath", "audience", "designHash", "canonicalText", "endpointHash", "endpointText", "endpointContract"}, "endpoint")
        for key in ("canonicalText", "endpointText"):
            if not isinstance(endpoint[key], str) or not endpoint[key]:
                raise ContractError(f"endpoint {key} must be non-empty text")
        for key in ("designHash", "endpointHash"):
            if not isinstance(endpoint[key], str) or not SHA256.fullmatch(endpoint[key]):
                raise ContractError(f"endpoint {key} is invalid")
        if digest(endpoint["endpointText"]) != endpoint["endpointHash"]:
            raise ContractError("endpointText hash mismatch")
        if digest(endpoint["canonicalText"]) != endpoint["designHash"]:
            raise ContractError("canonicalText/designHash mismatch")
        try:
            canonical = json.loads(endpoint["canonicalText"])
        except json.JSONDecodeError as exc:
            raise ContractError("canonicalText is invalid JSON") from exc
        identity = exact_keys(canonical.get("identity"), {"screenKey", "blueprintCode", "processCode", "stepCode", "audience", "routePath", "pageId", "actorCode"}, "canonical identity")
        step = canonical.get("step")
        if not isinstance(step, dict):
            raise ContractError("canonical step is invalid")
        expected_key = f"{identity['processCode']}|{identity['stepCode']}|{identity['audience']}|{identity['routePath']}"
        if (identity["screenKey"] != expected_key or endpoint["screenKey"] != expected_key
                or endpoint["routePath"] != identity["routePath"]
                or endpoint["audience"] != identity["audience"]):
            raise ContractError("endpoint/canonical identity mismatch")
        endpoint["processCode"] = required_text(identity, "processCode", CODE)
        endpoint["stepCode"] = required_text(identity, "stepCode", CODE)
        endpoint["actorCode"] = required_text(identity, "actorCode", CODE)
        endpoint["commandCode"] = required_text(step, "commandCode", CODE)
        declared_commands = step.get("commands")
        declared_command_codes = step.get("commandCodes")
        if declared_commands is not None and declared_command_codes is not None:
            raise ContractError("canonical step command set is ambiguous")
        if declared_commands is not None:
            if not isinstance(declared_commands, list) or not declared_commands:
                raise ContractError("canonical step.commands must be a non-empty array")
            command_codes = [
                required_text(row, "commandCode", CODE)
                if isinstance(row, dict) else None
                for row in declared_commands
            ]
            if any(code is None for code in command_codes):
                raise ContractError("canonical step.commands entry is invalid")
        elif declared_command_codes is not None:
            if (not isinstance(declared_command_codes, list) or not declared_command_codes
                    or any(not isinstance(code, str) or not CODE.fullmatch(code)
                           for code in declared_command_codes)):
                raise ContractError("canonical step.commandCodes is invalid")
            command_codes = declared_command_codes
        else:
            lanes = canonical.get("lanes")
            frontend = lanes.get("FRONTEND") if isinstance(lanes, dict) else None
            if isinstance(frontend, dict) and "actions" in frontend:
                actions = frontend["actions"]
                if not isinstance(actions, list) or not actions:
                    raise ContractError("canonical FRONTEND.actions must be a non-empty array")
                command_codes = [
                    required_text(action, "commandCode", CODE)
                    if isinstance(action, dict) else None
                    for action in actions
                ]
                if any(code is None for code in command_codes):
                    raise ContractError("canonical FRONTEND.actions entry is invalid")
            else:
                command_codes = [endpoint["commandCode"]]
        if (endpoint["commandCode"] not in command_codes
                or len(command_codes) != len(set(command_codes))):
            raise ContractError("canonical step command set is not exact")
        endpoint["commandCodes"] = frozenset(command_codes)
        try:
            parsed = json.loads(endpoint["endpointText"])
        except json.JSONDecodeError as exc:
            raise ContractError("endpointText is invalid JSON") from exc
        if stable(parsed) != stable(endpoint["endpointContract"]):
            raise ContractError("endpointText does not match endpointContract")
        contract = exact_keys(parsed, {"screenKey", "routePath", "audience", "source", "operations"}, "endpointContract")
        source = exact_keys(contract["source"], {"schema", "designHash"}, "endpointContract.source")
        if source != {"schema": "carbonet.canonical-design/v1", "designHash": endpoint["designHash"]}:
            raise ContractError("endpoint source/designHash mismatch")
        if contract["screenKey"] != endpoint["screenKey"] or contract["routePath"] != endpoint["routePath"] or contract["audience"] != endpoint["audience"]:
            raise ContractError("endpoint identity mismatch")
        if endpoint["screenKey"].casefold() in screen_keys:
            raise ContractError("duplicate screenKey")
        screen_keys.add(endpoint["screenKey"].casefold())
        if not isinstance(contract["operations"], list) or not contract["operations"]:
            raise ContractError("endpoint operations are required")
        screen_operation_commands: set[str] = set()
        for raw in contract["operations"]:
            operation = validate_operation(raw, endpoint)
            if operation["commandCode"] in screen_operation_commands:
                raise ContractError("duplicate endpoint commandCode for canonical screen")
            screen_operation_commands.add(operation["commandCode"])
            signature = f"{operation['method']} {operation['path']}".casefold()
            if signature in route_signatures or operation["operationId"].casefold() in operation_ids:
                raise ContractError(f"duplicate endpoint identity: {signature}")
            route_signatures.add(signature)
            operation_ids.add(operation["operationId"].casefold())
            operations.append({"screen": endpoint, "operation": operation})
        if screen_operation_commands != endpoint["commandCodes"]:
            raise ContractError("endpoint operations do not exactly cover canonical step commands")
        lines.append(f"{endpoint['screenKey']}\u001f{endpoint['endpointHash']}")
    if digest("\n".join(lines)) != catalog["catalogHash"]:
        raise ContractError("catalogHash mismatch")
    return catalog["catalogHash"], operations


def manifest_operation(row: dict[str, Any]) -> dict[str, str]:
    operation = row["operation"]
    screen = row["screen"]
    return {
        "operationKey": operation["operationId"],
        "method": operation["method"],
        "path": operation["path"],
        "handlerClass": f"{PACKAGE}.{java_name(operation['operationId'])}Controller",
        "handlerMethod": "execute",
        "designHash": screen["designHash"],
        "endpointHash": screen["endpointHash"],
    }


def validate_manifest_operations(value: Any, expected: list[dict[str, str]],
                                 provenance: list[dict[str, str]]) -> list[dict[str, str]]:
    if not isinstance(value, list) or not value:
        raise ContractError("manifest operations are required")
    keys = {"operationKey", "method", "path", "handlerClass", "handlerMethod",
            "designHash", "endpointHash"}
    operation_keys: set[str] = set()
    routes: set[str] = set()
    handlers: set[str] = set()
    normalized: list[dict[str, str]] = []
    for raw in value:
        row = exact_keys(raw, keys, "manifest operation")
        operation_key = required_text(row, "operationKey", OP_ID)
        method = required_text(row, "method")
        path = safe_path(row)
        handler_class = required_text(row, "handlerClass")
        handler_method = required_text(row, "handlerMethod", JAVA_ID)
        if method != "POST" or handler_method != "execute":
            raise ContractError("manifest operation method/handlerMethod is invalid")
        expected_class = f"{PACKAGE}.{java_name(operation_key)}Controller"
        if handler_class != expected_class:
            raise ContractError("manifest operation handlerClass is invalid")
        for key in ("designHash", "endpointHash"):
            if not isinstance(row.get(key), str) or not SHA256.fullmatch(row[key]):
                raise ContractError(f"manifest operation {key} is invalid")
        operation_signature = operation_key.casefold()
        route_signature = f"{method} {path}".casefold()
        handler_signature = f"{handler_class}#{handler_method}".casefold()
        if (operation_signature in operation_keys or route_signature in routes
                or handler_signature in handlers):
            raise ContractError("duplicate manifest operation binding")
        operation_keys.add(operation_signature)
        routes.add(route_signature)
        handlers.add(handler_signature)
        controller_path = f"src/main/java/{handler_class.replace('.', '/')}.java"
        matching_artifacts = [artifact for artifact in provenance
                              if artifact["path"] == controller_path
                              and artifact["designHash"] == row["designHash"]
                              and artifact["endpointHash"] == row["endpointHash"]]
        if len(matching_artifacts) != 1:
            raise ContractError("manifest operation is not bound to one controller artifact")
        normalized.append(row)
    normalized.sort(key=lambda item: (item["operationKey"].casefold(), item["method"],
                                      item["path"], item["handlerClass"]))
    if stable(normalized) != stable(expected):
        raise ContractError("manifest operations do not match generated operations")
    return normalized


def render(input_path: Path, workers: int) -> tuple[dict[str, bytes], dict[str, Any]]:
    catalog_hash, operations = load_contract(input_path)
    with ThreadPoolExecutor(max_workers=max(1, min(workers, 16))) as pool:
        batches = list(pool.map(lambda row: operation_sources(row["screen"], row["operation"], row["screen"]["endpointHash"]), operations))
    artifacts: dict[str, bytes] = {}
    provenance: list[dict[str, str]] = []
    for row, batch in zip(operations, batches):
        for path, content in batch:
            if path in artifacts:
                raise ContractError(f"artifact collision: {path}")
            artifacts[path] = content
            provenance.append({"path": path, "sha256": digest(content), "designHash": row["screen"]["designHash"], "endpointHash": row["screen"]["endpointHash"]})
    expected_operations = sorted(
        (manifest_operation(row) for row in operations),
        key=lambda item: (item["operationKey"].casefold(), item["method"],
                          item["path"], item["handlerClass"]),
    )
    manifest_operations = validate_manifest_operations(
        expected_operations, expected_operations, provenance)
    generator_hash = digest(Path(__file__).read_bytes())
    manifest: dict[str, Any] = {"schema": "carbonet.generated-endpoints/v1",
                                "adapter": "EXISTING_PROCESS_COMMAND_RUNTIME", "catalogHash": catalog_hash,
                                "generatorHash": generator_hash, "artifactCount": len(provenance),
                                "artifacts": sorted(provenance, key=lambda item: item["path"]),
                                "operations": manifest_operations}
    manifest["artifactHash"] = digest(stable(manifest["artifacts"]))
    manifest["bundleHash"] = digest(stable(manifest))
    artifacts["manifest.json"] = (json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode()
    return artifacts, manifest


def publish(out: Path, artifacts: dict[str, bytes]) -> tuple[int, int]:
    if any(path.is_symlink() for path in (out, *out.parents)):
        raise ContractError("output path must not traverse a symbolic link")
    if out.exists() and not out.is_dir():
        raise ContractError("output must be a directory")
    if out.exists() and any(path.is_symlink() for path in out.rglob("*")):
        raise ContractError("output tree must not contain symbolic links")
    changed = sum(1 for path, content in artifacts.items() if not (out / path).is_file() or (out / path).read_bytes() != content)
    expected = set(artifacts)
    existing = {str(path.relative_to(out)).replace(os.sep, "/") for path in out.rglob("*") if path.is_file()} if out.exists() else set()
    stale = existing - expected
    if changed == 0 and not stale:
        return 0, len(artifacts)
    out.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=f".{out.name}.", dir=out.parent))
    try:
        for path, content in artifacts.items():
            target = stage / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
        previous = out.with_name(f".{out.name}.previous.{os.getpid()}")
        if previous.exists():
            raise ContractError("atomic backup path already exists")
        moved = False
        if out.exists():
            os.replace(out, previous)
            moved = True
        try:
            os.replace(stage, out)
        except BaseException:
            if moved and not out.exists():
                os.replace(previous, out)
            raise
        shutil.rmtree(previous, ignore_errors=True)
    finally:
        shutil.rmtree(stage, ignore_errors=True)
    return changed + len(stale), len(artifacts)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("catalog", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--workers", type=int, default=min(16, max(1, os.cpu_count() or 1)))
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        if not 1 <= args.workers <= 16:
            raise ContractError("--workers must be between 1 and 16")
        artifacts, manifest = render(args.catalog, args.workers)
        changed, total = (0, len(artifacts)) if args.check else publish(args.out, artifacts)
        print(stable({"success": True, "check": args.check, "files": total, "filesChanged": changed, **manifest}))
        return 0
    except (ContractError, TypeError, KeyError) as exc:
        print(f"[canonical-endpoint-generator] {exc}", file=os.sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
