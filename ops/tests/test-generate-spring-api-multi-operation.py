#!/usr/bin/env python3
"""Same-screen multi-command physical Spring adapter proof."""

from __future__ import annotations

import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "ops/scripts/generate-spring-api-from-design.py"
LOADER = importlib.util.spec_from_file_location("spring_endpoint_generator", SCRIPT)
assert LOADER and LOADER.loader
GEN = importlib.util.module_from_spec(LOADER)
LOADER.loader.exec_module(GEN)


def operation(operation_id: str, command: str, path: str) -> dict:
    runtime = {
        "tenantId": {"type": "string"}, "projectId": {"type": "string"},
        "actorCode": {"type": "string"}, "idempotencyKey": {"type": "string"},
    }
    success = {**GEN.RUNTIME_RESPONSE_SCHEMA, "amount": {"type": "number"}}
    error = GEN.ERROR_RESPONSE_SCHEMA
    def schema(properties):
        return {"type": "object", "properties": properties, "required": list(properties)}
    return {
        "operationId": operation_id,
        "implementationKind": "PROCESS_COMMAND_ADAPTER",
        "method": "POST", "path": path,
        "processCode": "ACTIVITY_DATA", "stepCode": "ACTIVITY_DATA_01_PLAN",
        "commandCode": command,
        "authority": {"audience": "USER", "actorCodes": ["ACTIVITY_MANAGER"],
            "authenticated": True, "tenantScoped": True, "projectScoped": True},
        "request": {"contentType": "application/json", "schema": {
            "type": "object", "properties": {**runtime, "amount": {"type": "number"}},
            "required": [*runtime, "amount"],
        }},
        "response": {"statusResponses": [
            {"statusCase": "SUCCESS", "httpStatus": 200, "schema": schema(success)},
            {"statusCase": "VALIDATION_ERROR", "httpStatus": 400, "schema": schema(error)},
            {"statusCase": "FORBIDDEN", "httpStatus": 403, "schema": schema(error)},
            {"statusCase": "CONFLICT", "httpStatus": 409, "schema": schema(error)},
            {"statusCase": "RECOVERY", "httpStatus": 200,
             "schema": schema({**success, "recovered": {"type": "boolean"}})},
        ], "errors": [
            {"status": 400, "code": "INVALID_REQUEST"},
            {"status": 403, "code": "ACCESS_DENIED"},
            {"status": 409, "code": "CONFLICT"},
            {"status": 500, "code": "INTERNAL_ERROR"},
        ]},
        "responseProjection": [{"fieldCode": "amount", "source": "REQUEST",
                                "sourcePath": "amount"}],
        "persistence": copy.deepcopy(GEN.RUNTIME_PERSISTENCE),
        "transactionPolicy": "REQUIRED", "idempotencyRequired": True,
        "rollback": {"strategy": "TRANSACTION", "commandCode": command},
    }


def catalog() -> dict:
    screen_key = "ACTIVITY_DATA|ACTIVITY_DATA_01_PLAN|USER|/activity/plan"
    canonical = {
        "identity": {"screenKey": screen_key, "blueprintCode": "ACTIVITY_PLAN_USER",
            "processCode": "ACTIVITY_DATA", "stepCode": "ACTIVITY_DATA_01_PLAN",
            "audience": "USER", "routePath": "/activity/plan", "pageId": "activity-plan",
            "actorCode": "ACTIVITY_MANAGER"},
        "process": {}, "step": {"commandCode": "COMPLETE"},
        "lanes": {"FRONTEND": {"actions": [
            {"commandCode": "COMPLETE"}, {"commandCode": "CANCEL"}]}},
    }
    canonical_text = GEN.stable(canonical)
    design_hash = GEN.digest(canonical_text)
    contract = {"screenKey": screen_key, "routePath": "/activity/plan", "audience": "USER",
        "source": {"schema": "carbonet.canonical-design/v1", "designHash": design_hash},
        "operations": [
            operation("CompleteActivityPlan", "COMPLETE",
                      "/api/generated/activity/{executionId}/complete"),
            operation("CancelActivityPlan", "CANCEL",
                      "/api/generated/activity/{executionId}/cancel"),
        ]}
    endpoint_text = GEN.stable(contract)
    endpoint = {"screenKey": screen_key, "routePath": "/activity/plan", "audience": "USER",
        "designHash": design_hash, "canonicalText": canonical_text,
        "endpointHash": GEN.digest(endpoint_text), "endpointText": endpoint_text,
        "endpointContract": contract}
    return {"schema": GEN.SCHEMA,
        "catalogHash": GEN.digest(screen_key + "\x1f" + endpoint["endpointHash"]),
        "endpoints": [endpoint]}


def refresh(value: dict) -> None:
    endpoint = value["endpoints"][0]
    endpoint["endpointText"] = GEN.stable(endpoint["endpointContract"])
    endpoint["endpointHash"] = GEN.digest(endpoint["endpointText"])
    value["catalogHash"] = GEN.digest(endpoint["screenKey"] + "\x1f" + endpoint["endpointHash"])


def mutate_canonical(value: dict, mutation) -> None:
    endpoint = value["endpoints"][0]
    canonical = json.loads(endpoint["canonicalText"])
    mutation(canonical)
    endpoint["canonicalText"] = GEN.stable(canonical)
    endpoint["designHash"] = GEN.digest(endpoint["canonicalText"])
    endpoint["endpointContract"]["source"]["designHash"] = endpoint["designHash"]
    refresh(value)


class MultiOperationSpringGeneratorTest(unittest.TestCase):
    def test_one_screen_two_commands_generate_two_controllers_and_exact_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "catalog.json"
            source.write_text(json.dumps(catalog()), encoding="utf-8")
            artifacts, manifest = GEN.render(source, 4)
            self.assertEqual(10, manifest["artifactCount"])
            self.assertEqual(2, len(manifest["operations"]))
            self.assertEqual({"CompleteActivityPlan", "CancelActivityPlan"},
                             {row["operationKey"] for row in manifest["operations"]})
            self.assertEqual(2, len({(row["method"], row["path"])
                                    for row in manifest["operations"]}))
            controllers = [path for path in artifacts if path.endswith("Controller.java")]
            self.assertEqual(2, len(controllers))
            self.assertEqual({
                "src/main/java/egovframework/com/generated/canonical/CompleteActivityPlanController.java",
                "src/main/java/egovframework/com/generated/canonical/CancelActivityPlanController.java",
            }, set(controllers))
            self.assertEqual(2, len({row["handlerClass"] for row in manifest["operations"]}))
            self.assertEqual(1, len(catalog()["endpoints"]))
            out = root / "generated"
            changed, total = GEN.publish(out, artifacts)
            self.assertEqual(11, total)
            self.assertEqual(11, changed)
            for row in manifest["operations"]:
                controller = out / ("src/main/java/" + row["handlerClass"].replace(".", "/") + ".java")
                self.assertTrue(controller.is_file())
                source_text = controller.read_text(encoding="utf-8")
                self.assertIn(f'@org.springframework.web.bind.annotation.PostMapping(path="{row["path"]}"',
                              source_text)

    def test_same_screen_duplicate_method_path_or_operation_id_fails_closed(self) -> None:
        for mutant in ("route", "operation"):
            with self.subTest(mutant=mutant), tempfile.TemporaryDirectory() as directory:
                value = catalog()
                operations = value["endpoints"][0]["endpointContract"]["operations"]
                if mutant == "route":
                    operations[1]["path"] = operations[0]["path"].upper()
                else:
                    operations[1]["operationId"] = operations[0]["operationId"].lower()
                refresh(value)
                source = Path(directory) / "catalog.json"
                source.write_text(json.dumps(value), encoding="utf-8")
                with self.assertRaises(GEN.ContractError):
                    GEN.render(source, 2)

    def test_undeclared_command_fails_before_write(self) -> None:
        value = catalog()
        value["endpoints"][0]["endpointContract"]["operations"][1]["commandCode"] = "DELETE"
        refresh(value)
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "catalog.json"
            source.write_text(json.dumps(value), encoding="utf-8")
            with self.assertRaises(GEN.ContractError):
                GEN.render(source, 2)

    def test_missing_or_duplicate_declared_command_fails_closed(self) -> None:
        for mutant in ("missing", "duplicate"):
            with self.subTest(mutant=mutant), tempfile.TemporaryDirectory() as directory:
                value = catalog()
                operations = value["endpoints"][0]["endpointContract"]["operations"]
                if mutant == "missing":
                    operations.pop()
                else:
                    operations[1]["commandCode"] = operations[0]["commandCode"]
                refresh(value)
                source = Path(directory) / "catalog.json"
                source.write_text(json.dumps(value), encoding="utf-8")
                with self.assertRaises(GEN.ContractError):
                    GEN.render(source, 2)

    def test_frontend_action_duplicate_or_missing_fails_closed(self) -> None:
        for mutant in ("duplicate", "missing"):
            with self.subTest(mutant=mutant), tempfile.TemporaryDirectory() as directory:
                value = catalog()
                def mutation(canonical: dict) -> None:
                    actions = canonical["lanes"]["FRONTEND"]["actions"]
                    if mutant == "duplicate":
                        actions[1]["commandCode"] = actions[0]["commandCode"]
                    else:
                        actions.pop()
                mutate_canonical(value, mutation)
                source = Path(directory) / "catalog.json"
                source.write_text(json.dumps(value), encoding="utf-8")
                with self.assertRaises(GEN.ContractError):
                    GEN.render(source, 2)


if __name__ == "__main__":
    unittest.main()
