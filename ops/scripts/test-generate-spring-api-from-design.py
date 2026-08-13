#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
from pathlib import Path


GENERATOR = Path(__file__).with_name("generate-spring-api-from-design.py")
SPEC = importlib.util.spec_from_file_location("canonical_endpoint_generator", GENERATOR)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def stable(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def sha(value):
    return hashlib.sha256((value if isinstance(value, bytes) else value.encode())).hexdigest()


def catalog():
    runtime = {
        "tenantId": {"type": "string"}, "projectId": {"type": "string"},
        "actorCode": {"type": "string"}, "idempotencyKey": {"type": "string"},
    }
    operation = {
        "operationId": "CompleteActivityPlan", "implementationKind": "PROCESS_COMMAND_ADAPTER",
        "method": "POST", "path": "/api/generated/activity/{executionId}/complete",
        "processCode": "ACTIVITY_DATA", "stepCode": "ACTIVITY_DATA_01_PLAN", "commandCode": "COMPLETE",
        "authority": {"audience": "USER", "actorCodes": ["ACTIVITY_MANAGER"], "authenticated": True, "tenantScoped": True, "projectScoped": True},
        "request": {"contentType": "application/json", "schema": {"type": "object", "properties": {**runtime, "amount": {"type": "number"}, "note": {"type": "string"}}, "required": [*runtime, "amount"]}},
        "response": {"successStatus": 200, "schema": {"type": "object", "properties": {
            "success": {"type": "boolean"}, "idempotent": {"type": "boolean"},
            "eventId": {"type": "integer"}, "toState": {"type": "string"},
        }, "required": ["success", "idempotent", "eventId", "toState"]}, "errors": [
            {"status": 400, "code": "INVALID_REQUEST"},
            {"status": 401, "code": "AUTHENTICATION_REQUIRED"},
            {"status": 403, "code": "ACCESS_DENIED"},
            {"status": 500, "code": "INTERNAL_ERROR"},
        ]},
        "persistence": {"persistenceId": "PROCESS_EXECUTION_AGGREGATE",
            "entity": "framework_process_execution", "operation": "UPDATE",
            "primaryKey": ["execution_id"], "tenantColumn": "tenant_id",
            "projectColumn": "project_id", "versionColumn": "execution_version",
            "transactional": True},
        "transactionPolicy": "REQUIRED", "idempotencyRequired": True,
        "rollback": {"strategy": "TRANSACTION", "commandCode": "COMPLETE"},
    }
    screen_key = "ACTIVITY_DATA|ACTIVITY_DATA_01_PLAN|USER|/activity/plan"
    canonical = {"identity": {"screenKey": screen_key, "blueprintCode": "ACTIVITY_PLAN_USER",
        "processCode": "ACTIVITY_DATA", "stepCode": "ACTIVITY_DATA_01_PLAN", "audience": "USER",
        "routePath": "/activity/plan", "pageId": "activity-plan", "actorCode": "ACTIVITY_MANAGER"},
        "process": {}, "step": {"commandCode": "COMPLETE"}, "lanes": {}}
    canonical_text = stable(canonical)
    design_hash = sha(canonical_text)
    contract = {"screenKey": screen_key, "routePath": "/activity/plan", "audience": "USER",
                "source": {"schema": "carbonet.canonical-design/v1", "designHash": design_hash},
                "operations": [operation]}
    text = stable(contract)
    endpoint = {"screenKey": contract["screenKey"], "routePath": contract["routePath"], "audience": "USER",
                "designHash": design_hash, "canonicalText": canonical_text,
                "endpointHash": sha(text), "endpointText": text, "endpointContract": contract}
    return {"schema": "carbonet.canonical-endpoint-catalog/v1", "catalogHash": sha(endpoint["screenKey"] + "\x1f" + endpoint["endpointHash"]), "endpoints": [endpoint]}


def refresh(value):
    for endpoint in value["endpoints"]:
        endpoint["endpointText"] = stable(endpoint["endpointContract"])
        endpoint["endpointHash"] = sha(endpoint["endpointText"])
    value["catalogHash"] = sha("\n".join(
        endpoint["screenKey"] + "\x1f" + endpoint["endpointHash"]
        for endpoint in value["endpoints"]
    ))
    return value


class GeneratorTest(unittest.TestCase):
    def run_generator(self, value, out, check=False):
        source = out.parent / (out.name + ".json")
        source.write_text(json.dumps(value), encoding="utf-8")
        command = [sys.executable, str(GENERATOR), str(source), "--out", str(out), "--workers", "4"]
        if check:
            command.append("--check")
        return subprocess.run(command, text=True, capture_output=True)

    def test_deterministic_atomic_generation_and_provenance(self):
        with tempfile.TemporaryDirectory() as temporary:
            out = Path(temporary) / "generated"
            first = self.run_generator(catalog(), out)
            self.assertEqual(0, first.returncode, first.stderr)
            before = {str(path.relative_to(out)): path.read_bytes() for path in out.rglob("*") if path.is_file()}
            second = self.run_generator(catalog(), out)
            self.assertEqual(0, second.returncode, second.stderr)
            self.assertEqual(0, json.loads(second.stdout)["filesChanged"])
            self.assertEqual(before, {str(path.relative_to(out)): path.read_bytes() for path in out.rglob("*") if path.is_file()})
            controller = (out / "src/main/java/egovframework/com/generated/canonical/CompleteActivityPlanController.java").read_text()
            for token in ("executeProcessCommand", "CurrentUserContextService", "Authentication is required", "processCode", "ACTIVITY_DATA_01_PLAN"):
                self.assertIn(token, controller)
            manifest = json.loads((out / "manifest.json").read_text())
            self.assertEqual(3, manifest["artifactCount"])
            self.assertEqual("EXISTING_PROCESS_COMMAND_RUNTIME", manifest["adapter"])
            self.assertRegex(manifest["artifactHash"], r"^[0-9a-f]{64}$")
            self.assertEqual(catalog()["endpoints"][0]["designHash"], manifest["artifacts"][0]["designHash"])
            endpoint = catalog()["endpoints"][0]
            operation = endpoint["endpointContract"]["operations"][0]
            self.assertEqual([{
                "operationKey": operation["operationId"],
                "method": "POST",
                "path": operation["path"],
                "handlerClass": "egovframework.com.generated.canonical.CompleteActivityPlanController",
                "handlerMethod": "execute",
                "designHash": endpoint["designHash"],
                "endpointHash": endpoint["endpointHash"],
            }], manifest["operations"])
            controller_artifact = next(
                artifact for artifact in manifest["artifacts"]
                if artifact["path"].endswith("CompleteActivityPlanController.java"))
            self.assertEqual(manifest["operations"][0]["designHash"],
                             controller_artifact["designHash"])
            self.assertEqual(manifest["operations"][0]["endpointHash"],
                             controller_artifact["endpointHash"])
            bundle_preimage = dict(manifest)
            bundle_hash = bundle_preimage.pop("bundleHash")
            self.assertEqual(bundle_hash, sha(stable(bundle_preimage)))
            for token in ("tenantId", "projectId", "actorCode", "idempotencyKey", "requestJson", "writeValueAsString"):
                self.assertIn(token, controller)
            for token in ('@org.springframework.web.bind.annotation.PathVariable("executionId")',
                          "request.amount()==null", "request.tenantId().isBlank()",
                          "Required request field is missing.", "convertValue",
                          "CompleteActivityPlanResponse.class", "responsePayload",
                          '"AUTHENTICATION_REQUIRED"', '"INVALID_REQUEST"',
                          '"ACCESS_DENIED"', '"INTERNAL_ERROR"',
                          "Response contract mismatch",
                          'payload.put("requireDraft",true)',
                          "catch(IllegalArgumentException | IllegalStateException invalid)",
                          "catch(Exception unexpected)",
                          "Request serialization failed"):
                self.assertIn(token, controller)

    def test_one_byte_design_change_propagates_without_stale_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            out = Path(temporary) / "generated"
            value = catalog()
            self.assertEqual(0, self.run_generator(value, out).returncode)
            old = json.loads((out / "manifest.json").read_text())
            canonical = json.loads(value["endpoints"][0]["canonicalText"])
            canonical["process"]["oneByte"] = "x"
            endpoint = value["endpoints"][0]
            endpoint["canonicalText"] = stable(canonical)
            endpoint["designHash"] = sha(endpoint["canonicalText"])
            endpoint["endpointContract"]["source"]["designHash"] = endpoint["designHash"]
            endpoint["endpointText"] = stable(endpoint["endpointContract"])
            endpoint["endpointHash"] = sha(endpoint["endpointText"])
            value["catalogHash"] = sha(endpoint["screenKey"] + "\x1f" + endpoint["endpointHash"])
            self.assertEqual(0, self.run_generator(value, out).returncode)
            updated = json.loads((out / "manifest.json").read_text())
            self.assertNotEqual(old["operations"][0]["designHash"],
                                updated["operations"][0]["designHash"])
            self.assertNotEqual(old["operations"][0]["endpointHash"],
                                updated["operations"][0]["endpointHash"])
            self.assertNotEqual(old["bundleHash"], updated["bundleHash"])
            self.assertFalse(any("previous" in str(path) for path in out.parent.rglob("*")))

    def test_manifest_operation_removal_mismatch_and_duplicate_fail_closed(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "catalog.json"
            source.write_text(json.dumps(catalog()), encoding="utf-8")
            _, manifest = MODULE.render(source, 2)
            expected = manifest["operations"]
            mismatch = copy.deepcopy(expected)
            mismatch[0]["endpointHash"] = "f" * 64
            duplicate = copy.deepcopy(expected)
            duplicate.append(copy.deepcopy(duplicate[0]))
            for mutant in ([], mismatch, duplicate):
                with self.assertRaises(MODULE.ContractError):
                    MODULE.validate_manifest_operations(
                        mutant, expected, manifest["artifacts"])

    def test_mutants_fail_before_writes(self):
        mutations = []
        for mutate in (
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0].update(method="GET"),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0].update(implementationKind="DIRECT_SQL"),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0].update(path="/api/no-execution"),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0].update(path="/api/{executionId}/{other}"),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0].update(path="/api/../{executionId}"),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0]["authority"].update(authenticated=False),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0]["authority"].update(actorCodes=["OTHER_ACTOR"]),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0].update(persistence=[]),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0].update(transactionPolicy="NONE"),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0].update(idempotencyRequired=False),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0].update(processCode="OTHER_PROCESS"),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0]["request"]["schema"]["properties"].pop("tenantId"),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0]["request"]["schema"]["properties"].update({"class": {"type": "string"}}),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0]["request"]["schema"]["properties"].update({"requireDraft": {"type": "boolean"}}),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0]["persistence"].update(sql="delete from anything"),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0]["rollback"].update(strategy="NONE"),
            lambda v: v["endpoints"][0].update(designHash="f" * 64),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0]["response"].update(errors=[{"status": "403", "code": "ACCESS_DENIED"}]),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0]["response"].update(errors=[{"status": 403, "code": "ACCESS_DENIED", "detail": "leak"}]),
            lambda v: v["endpoints"][0].update(canonicalText={}),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0]["response"]["schema"]["properties"].update({"extra": {"type": "string"}}),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0]["response"]["schema"].update(required=["success", "eventId", "toState"]),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0]["response"].update(errors=[{"status": 403, "code": "ACCESS_DENIED"}]),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0]["persistence"].update(entity="activity_plan"),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0]["rollback"].update(strategy="COMPENSATING"),
            lambda v: v["endpoints"][0]["endpointContract"]["operations"][0]["rollback"].update(commandCode="ROLLBACK"),
        ):
            value = catalog(); mutate(value)
            mutations.append(refresh(value))
        with tempfile.TemporaryDirectory() as temporary:
            for index, value in enumerate(mutations):
                out = Path(temporary) / f"mutant-{index}"
                result = self.run_generator(value, out)
                self.assertNotEqual(0, result.returncode, f"mutant {index} escaped")
                self.assertFalse(out.exists(), f"mutant {index} wrote output")

    def test_case_insensitive_route_and_operation_collisions_fail_before_writes(self):
        value = catalog()
        second = copy.deepcopy(value["endpoints"][0])
        canonical = json.loads(second["canonicalText"])
        canonical["identity"]["routePath"] = "/activity/plan-two"
        canonical["identity"]["screenKey"] = (
            "ACTIVITY_DATA|ACTIVITY_DATA_01_PLAN|USER|/activity/plan-two"
        )
        second["screenKey"] = canonical["identity"]["screenKey"]
        second["routePath"] = canonical["identity"]["routePath"]
        second["canonicalText"] = stable(canonical)
        second["designHash"] = sha(second["canonicalText"])
        contract = second["endpointContract"]
        contract["screenKey"] = second["screenKey"]
        contract["routePath"] = second["routePath"]
        contract["source"]["designHash"] = second["designHash"]
        operation = contract["operations"][0]
        operation["operationId"] = "completeactivityplan"
        operation["path"] = "/API/generated/activity/{executionId}/complete"
        value["endpoints"].append(second)
        refresh(value)
        with tempfile.TemporaryDirectory() as temporary:
            out = Path(temporary) / "generated"
            result = self.run_generator(value, out)
            self.assertNotEqual(0, result.returncode)
            self.assertFalse(out.exists())

    def test_atomic_publish_restores_previous_tree_after_swap_failure(self):
        with tempfile.TemporaryDirectory() as temporary:
            out = Path(temporary) / "generated"
            out.mkdir()
            (out / "previous.txt").write_text("preserved", encoding="utf-8")
            real_replace = MODULE.os.replace
            calls = 0

            def fail_second_replace(source, target):
                nonlocal calls
                calls += 1
                if calls == 2:
                    raise OSError("simulated atomic swap failure")
                return real_replace(source, target)

            with mock.patch.object(MODULE.os, "replace", side_effect=fail_second_replace):
                with self.assertRaises(OSError):
                    MODULE.publish(out, {"next.txt": b"next"})
            self.assertEqual("preserved", (out / "previous.txt").read_text(encoding="utf-8"))
            self.assertFalse((out / "next.txt").exists())
            self.assertFalse(any("previous" in path.name for path in out.parent.iterdir()))

            link = Path(temporary) / "linked-output"
            link.symlink_to(out, target_is_directory=True)
            with self.assertRaises(MODULE.ContractError):
                MODULE.publish(link, {"next.txt": b"next"})

    def test_generated_java_compiles_against_runtime_contract_stubs(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            out = root / "generated"
            result = self.run_generator(catalog(), out)
            self.assertEqual(0, result.returncode, result.stderr)
            stubs = root / "stubs"
            sources = {
                "org/springframework/web/bind/annotation/RestController.java":
                    "package org.springframework.web.bind.annotation; public @interface RestController {}",
                "org/springframework/web/bind/annotation/PostMapping.java":
                    "package org.springframework.web.bind.annotation; public @interface PostMapping { String path(); String consumes(); }",
                "org/springframework/web/bind/annotation/PathVariable.java":
                    "package org.springframework.web.bind.annotation; public @interface PathVariable { String value() default \"\"; }",
                "org/springframework/web/bind/annotation/RequestBody.java":
                    "package org.springframework.web.bind.annotation; public @interface RequestBody {}",
                "jakarta/servlet/http/HttpServletRequest.java":
                    "package jakarta.servlet.http; public interface HttpServletRequest {}",
                "org/springframework/http/ResponseEntity.java": """
                    package org.springframework.http;
                    public class ResponseEntity<T> {
                        public static BodyBuilder status(int status) { return new BodyBuilder(); }
                        public static BodyBuilder badRequest() { return new BodyBuilder(); }
                        public static final class BodyBuilder {
                            public <T> ResponseEntity<T> body(T body) { return new ResponseEntity<>(); }
                        }
                    }
                """,
                "com/fasterxml/jackson/databind/ObjectMapper.java": """
                    package com.fasterxml.jackson.databind;
                    public class ObjectMapper {
                        public String writeValueAsString(Object value) throws Exception { return \"{}\"; }
                        public <T> T convertValue(Object value, Class<T> type) { return null; }
                    }
                """,
                "egovframework/com/feature/auth/service/CurrentUserContextService.java": """
                    package egovframework.com.feature.auth.service;
                    public class CurrentUserContextService {
                        public CurrentUserContext resolve(jakarta.servlet.http.HttpServletRequest request) {
                            return new CurrentUserContext();
                        }
                        public static class CurrentUserContext {
                            public boolean isAuthenticated() { return true; }
                            public String getUserId() { return \"user\"; }
                        }
                    }
                """,
                "egovframework/com/platform/governance/service/ActorProcessGovernanceService.java": """
                    package egovframework.com.platform.governance.service;
                    public class ActorProcessGovernanceService {
                        public java.util.Map<String,Object> executeProcessCommand(
                                java.util.UUID id, java.util.Map<String,Object> body, String user) {
                            return java.util.Map.of();
                        }
                    }
                """,
            }
            for relative, source in sources.items():
                target = stubs / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(source, encoding="utf-8")
            java_files = sorted(str(path) for path in stubs.rglob("*.java"))
            java_files += sorted(str(path) for path in out.rglob("*.java"))
            compiled = subprocess.run(
                ["javac", "--release", "17", "-d", str(root / "classes"), *java_files],
                text=True, capture_output=True,
            )
            self.assertEqual(0, compiled.returncode, compiled.stderr)

    def test_generated_java_compiles_in_actual_gradle_project(self):
        root = GENERATOR.parents[2]
        gradlew = root / "gradlew"
        self.assertTrue(gradlew.is_file(), "project Gradle wrapper is required")
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary)
            out = folder / "generated"
            result = self.run_generator(catalog(), out)
            self.assertEqual(0, result.returncode, result.stderr)
            init_script = folder / "canonical-generated-source.gradle"
            init_script.write_text("""
gradle.beforeProject { project ->
    project.afterEvaluate {
        if (project.path == ':apps:carbonet-api') {
            project.sourceSets.main.java.srcDir(
                System.getenv('CANONICAL_GENERATED_SOURCE'))
        }
    }
}
""", encoding="utf-8")
            environment = os.environ.copy()
            environment["CANONICAL_GENERATED_SOURCE"] = str(out / "src/main/java")
            compiled = subprocess.run(
                ["bash", str(gradlew), "-I", str(init_script), ":apps:carbonet-api:compileJava",
                 "--offline", "--no-daemon", "--console=plain"],
                cwd=root, env=environment, text=True, capture_output=True, timeout=180,
            )
            self.assertEqual(0, compiled.returncode, compiled.stdout + compiled.stderr)

    def test_check_mode_writes_nothing(self):
        with tempfile.TemporaryDirectory() as temporary:
            out = Path(temporary) / "generated"
            result = self.run_generator(catalog(), out, check=True)
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertFalse(out.exists())
            source = out.parent / (out.name + ".json")
            invalid = subprocess.run(
                [sys.executable, str(GENERATOR), str(source), "--out", str(out),
                 "--workers", "0", "--check"],
                text=True, capture_output=True,
            )
            self.assertEqual(2, invalid.returncode)
            self.assertFalse(out.exists())


if __name__ == "__main__":
    unittest.main()
