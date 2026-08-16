#!/usr/bin/env python3
"""Deterministic consumer/mutation proof for the composite package generator."""

from __future__ import annotations

import copy
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "ops/scripts/generate-composite-executable-design.py"
FAST_RUNNER = REPO / "ops/scripts/fast-process-package-test.py"
LOADER = importlib.util.spec_from_file_location("composite_generator", SCRIPT)
assert LOADER and LOADER.loader
GEN = importlib.util.module_from_spec(LOADER)
LOADER.loader.exec_module(GEN)


def design() -> dict:
    schema_changes = [{
        "operation": "REGISTERED_TABLE",
        "tableName": "item",
        "columns": [
            {"name": "id", "type": "bigint", "primaryKey": True, "nullable": False},
            {"name": "name", "type": "text", "primaryKey": False, "nullable": False},
        ],
        "uniqueConstraints": [],
        "indexes": [],
    }]
    test_scenarios = [{
        "scenarioCode": f"SAVE_{status}", "commandCode": "SAVE",
        "inputValues": {"name": "Alice"}, "expectedOutputFields": ["id"],
        "expectedStatus": status,
        "assertionCodes": ["STATUS_MATCH", "OUTPUT_FIELDS_MATCH", "NOTIFICATION_QUEUED"],
    } for status in ("SUCCESS", "VALIDATION_ERROR", "FORBIDDEN", "CONFLICT", "RECOVERY")]
    return {
        "REQUIREMENT": {"workTypeCode": "WORK", "businessPurpose": "Save work",
            "entryCondition": "Draft exists", "exitCondition": "Record saved",
            "kpis": [{"kpiCode": "DONE", "description": "Completed"}]},
        "ACTOR_RACI": {"actorCode": "ACTOR", "ownerActorCode": "OWNER",
            "responsibleActorCodes": ["ACTOR"], "accountBindingMode": "ACTIVE_RELAY",
            "relayTestRequired": True},
        "AUTHORITY": {"permissionCodes": ["PERM_SAVE"],
            "securityContract": "tenant/project/actor", "serverEnforced": True},
        "PROCESS": {"stepOrder": 1, "commandCode": "SAVE", "fromState": "DRAFT",
            "toState": "DONE", "completionRule": "record saved",
            "commands": [{"commandCode": "SAVE", "actorCode": "ACTOR", "primary": True}]},
        "STATE": {"states": [{"fromState": "DRAFT", "commandCode": "SAVE", "toState": "DONE"}]},
        "NAVIGATION": {"routePath": "/work", "audience": "USER", "nextRoutes": ["/done"]},
        "ACTIVE_UI": {"sectionOrder": ["MAIN"], "responsiveContract": "360 768 1280",
            "accessibilityContract": "KRDS WCAG AA", "responsiveVerified": True,
            "accessibilityVerified": True},
        "DESIGN_ASSET": {"layout": "KRDS_WORKSPACE", "theme": "KRDS_GOV_DEFAULT",
            "sections": [{"sectionId": "MAIN", "componentCodes": ["JSON_FORM"]}],
            "assetBindings": [{"assetType": "THEME", "assetCode": "KRDS_GOV_DEFAULT"},
                {"assetType": "SECTION", "assetCode": "MAIN"},
                {"assetType": "COMPONENT", "assetCode": "JSON_FORM"}],
            "adoptMutationPolicy": "REPLACE_GENERATED"},
        "FIELD_DICTIONARY": {"fields": [
            {"fieldCode": "name", "label": "Name", "direction": "INPUT", "dataSource": "ITEM",
                "dataType": "STRING", "required": True, "componentCode": "JSON_FORM"},
            {"fieldCode": "id", "label": "ID", "direction": "OUTPUT", "dataSource": "ITEM",
                "dataType": "INTEGER", "required": False, "componentCode": "JSON_FORM"}]},
        "DATA_HANDOFF": {"inputs": [{"fieldCode": "name", "contractPath": "name"}],
            "outputs": [{"fieldCode": "id", "contractPath": "id"}]},
        "DATABASE": {"entities": [{"entity": "ITEM", "fields": ["name", "id"]}],
            "verified": True, "migrationMode": "REGISTERED_EXISTING",
            "schemaFingerprint": GEN.java_hash(schema_changes), "schemaChanges": schema_changes},
        "API": {"operations": [{"method": "POST", "path": "/api/items", "commandCode": "SAVE",
            "requestFields": ["name"], "responseFields": ["id"],
            "permissionCodes": ["PERM_SAVE"]}], "verified": True},
        "BUSINESS_RULE": {"rules": [{"ruleCode": "STATE_GUARD", "commandCode": "SAVE",
            "fieldCode": "CURRENT_STATE", "operator": "EQ", "expectedValue": "DRAFT",
            "errorCode": "INVALID_STATE"}]},
        "VALIDATION": {"rules": [{"ruleCode": "NAME_REQUIRED", "commandCode": "SAVE",
            "fieldCode": "name", "operator": "REQUIRED", "expectedValue": "PRESENT",
            "errorCode": "NAME_REQUIRED"}], "exceptionStatesVerified": True},
        "NOTIFICATION": {"events": [{"eventCode": "SAVED", "commandCode": "SAVE",
            "channel": "IN_APP", "recipientActorCode": "ACTOR", "templateCode": "WORK_SAVED"}]},
        "TEST": {"scenarios": test_scenarios},
        "TASK_EVIDENCE": {"evidence": [{"evidenceType": "E2E", "reference": "evidence://save"}]},
        "RELEASE_AUDIT": {"auditEvidenceRef": "audit://save",
            "rollbackPolicy": {"mode": "TRANSACTION_ROLLBACK", "preserveManual": True,
                "preserveAdopt": True}},
    }


def surfaces(authority: str, source: str) -> tuple[list[dict], str]:
    rows = []
    for name in ("HELP", "WORK_GUIDE", "ALL_WORK_OVERVIEW", "QA", "SCREEN_DESIGN", "NEXT_TASK"):
        row = {"surface": name, "authorityHash": authority, "sourceHash": source,
            "outputHash": GEN.java_hash({"surface": name})}
        row["markerHash"] = GEN.java_hash(row)
        rows.append(row)
    return rows, GEN.java_hash(rows)


def specification(value: dict | None = None) -> dict:
    value = copy.deepcopy(value or design())
    source, design_set, catalog, endpoint = ("1" * 64, "2" * 64, "3" * 64, "4" * 64)
    authority = GEN.java_hash({"identity": "STEP|/work|USER", "design": value})
    surface_rows, surface_hash = surfaces(authority, source)
    package_hash = GEN.java_hash({"authorityHash": authority, "sourceHash": source,
        "designSetHash": design_set, "designCatalogHash": catalog,
        "endpointCatalogHash": endpoint, "surfaceSetHash": surface_hash,
        "activationPolicy": "SOURCE_IMMEDIATE_V1"})
    manifest = {"runtimePolicy": ["ACTOR_RACI", "AUTHORITY", "PROCESS", "STATE",
            "BUSINESS_RULE", "VALIDATION", "NOTIFICATION"],
        "frontendSdui": ["NAVIGATION", "ACTIVE_UI", "DESIGN_ASSET", "FIELD_DICTIONARY",
            "DATA_HANDOFF"], "backendData": ["DATABASE", "API"],
        "testManifest": ["TEST", "TASK_EVIDENCE"], "releasePolicy": ["RELEASE_AUDIT"],
        "payloadHash": GEN.java_hash(value)}
    binding = {"stepCode": "STEP", "routePath": "/work", "audience": "USER",
        "authorityHash": authority, "documentSetHash": GEN.java_hash({"documents": value}),
        "executableDesignHash": GEN.java_hash(value), "sharedStepHash": GEN.java_hash(value),
        "executableDesign": value, "artifactManifest": manifest,
        "resolvedClosure": {"workTypeCode": "WORK", "processCode": "PROC", "stepOrder": 1,
            "stepCode": "STEP", "actorCode": "ACTOR", "activeAccountCount": 1,
            "routePath": "/work", "audience": "USER", "functions": ["SAVE"],
            "inputs": ["name"], "outputs": ["id"], "permissionCodes": ["PERM_SAVE"],
            "endpoints": ["POST /api/items"]},
        "generatedSurfaceBindings": surface_rows, "generatedSurfaceSetHash": surface_hash,
        "sourceHash": source, "designSetHash": design_set, "designCatalogHash": catalog,
        "endpointCatalogHash": endpoint, "packageBindingHash": package_hash, "jobId": 1}
    return {"processCode": "PROC", "sourceHash": source, "designSetHash": design_set,
        "designCatalogHash": catalog, "endpointCatalogHash": endpoint,
        "compositeAuthoritySchema": GEN.AUTHORITY_SCHEMA,
        "compositeArtifactOutputMode": GEN.OUTPUT_MODE, "compositeAuthorities": [binding],
        "compositeAuthoritySetHash": GEN.java_hash([binding])}


def runtime_package() -> dict:
    scenario_types = ["HAPPY_PATH", "EXCEPTION", "AUTHORITY", "ISOLATION", "RECOVERY"]
    package = {
        "schemaVersion": "2.0.0",
        "process": {"code": "PROC", "name": "Process"},
        "step": {"code": "STEP", "actor": {"actorCode": "ACTOR"},
            "transition": {"commandCode": "SAVE", "fromState": "DRAFT", "toState": "DONE"},
            "input": {"name": "string"}, "output": {"id": "integer"}},
        "frontend": {"renderer": "COMMON_SDUI_RUNTIME", "required": True, "pages": [{
            "pageCode": "WORK", "route": "/work", "audience": "USER",
            "layout": "KRDS_WORKSPACE", "theme": "KRDS_GOV_DEFAULT",
            "designAuthority": {"source": "STEP_EXECUTION_SPEC_SCREEN_CONTRACT", "defaulted": [],
                "layout": "KRDS_WORKSPACE", "theme": "KRDS_GOV_DEFAULT"},
            "fields": [{"code": "name"}], "commands": [], "states": [],
            "responsive": {"mobile": True, "desktop": True},
            "accessibility": {"keyboard": True},
        }]},
        "backend": {"runtime": "COMMON_PROCESS_COMMAND_RUNTIME", "commands": [{
            "commandCode": "SAVE", "actorCode": "ACTOR", "serverAuthorization": True,
            "entryState": "DRAFT", "resultState": "DONE",
        }]},
        "database": {"transactional": True, "historyRequired": True,
            "indexesRequired": True, "foreignKeysRequired": True, "migrationRequired": False},
        "tests": [{"caseCode": f"BASE_{kind}", "type": kind, "status": "APPROVED",
            "steps": [{"executor": "FAST_PROCESS_CONTRACT_RUNNER"}],
            "assertions": [f"{kind} contract"]} for kind in scenario_types],
        "testExecution": {"runner": "FAST_PROCESS_CONTRACT_RUNNER", "parallelSafe": True,
            "liveSmokeRequiredForVerified": True},
        "nonfunctional": {"security": {"serverAuthorization": True},
            "recovery": {"resumeFromLastVerifiedState": True}},
        "approvalStatus": "APPROVED",
    }
    package["packageHash"] = GEN.digest(GEN.canonical(package))
    return package


def all_status_design() -> dict:
    value = design()
    base = value["TEST"]["scenarios"][0]
    value["TEST"]["scenarios"] = [
        {**copy.deepcopy(base), "scenarioCode": f"CASE_{status}",
         "expectedStatus": status,
         "assertionCodes": ["STATUS_MATCH", "OUTPUT_FIELDS_MATCH"]}
        for status in ("SUCCESS", "VALIDATION_ERROR", "FORBIDDEN", "CONFLICT", "RECOVERY")
    ]
    return value


def safe_create_all_status_design() -> dict:
    value = all_status_design()
    value["DATABASE"]["migrationMode"] = "SAFE_CREATE_TABLE"
    value["DATABASE"]["schemaChanges"][0]["operation"] = "CREATE_TABLE"
    value["DATABASE"]["schemaFingerprint"] = GEN.java_hash(
        value["DATABASE"]["schemaChanges"])
    return value


def mutate(axis: str, value: dict) -> None:
    row = value[axis]
    if axis == "REQUIREMENT": row["businessPurpose"] += " safely"
    elif axis == "ACTOR_RACI": row["ownerActorCode"] = "OWNER_2"
    elif axis == "AUTHORITY": row["securityContract"] += "/mfa"
    elif axis == "PROCESS": row["completionRule"] += " durably"
    elif axis == "STATE": row["states"][0]["toState"] = "ARCHIVED"
    elif axis == "NAVIGATION": row["nextRoutes"] = ["/done", "/audit"]
    elif axis == "ACTIVE_UI": row["responsiveContract"] += " 1920"
    elif axis == "DESIGN_ASSET": row["layout"] = "KRDS_TASK_WORKSPACE"
    elif axis == "FIELD_DICTIONARY": row["fields"][0]["label"] = "Work name"
    elif axis == "DATA_HANDOFF": row["inputs"][0]["contractPath"] = "payload.name"
    elif axis == "DATABASE":
        row["schemaChanges"][0]["indexes"] = [
            {"name": "idx_item_name", "columns": ["name"], "unique": False}]
        row["schemaFingerprint"] = GEN.java_hash(row["schemaChanges"])
    elif axis == "API": row["operations"][0]["path"] = "/api/items/v2"
    elif axis == "BUSINESS_RULE": row["rules"][0]["errorCode"] = "STATE_CHANGED"
    elif axis == "VALIDATION": row["rules"][0]["errorCode"] = "NAME_EMPTY"
    elif axis == "NOTIFICATION": row["events"][0]["eventCode"] = "WORK_SAVED"
    elif axis == "TEST": row["scenarios"][0]["scenarioCode"] = "HAPPY_V2"
    elif axis == "TASK_EVIDENCE": row["evidence"][0]["reference"] = "evidence://save/v2"
    elif axis == "RELEASE_AUDIT": row["auditEvidenceRef"] = "audit://save/v2"


class CompositeGeneratorTest(unittest.TestCase):
    def test_each_command_requires_every_expected_status_exactly_once(self) -> None:
        positive = design()
        self.assertEqual(GEN.COMPOSITE_EXPECTED_STATUSES,
                         {row["expectedStatus"] for row in positive["TEST"]["scenarios"]})
        GEN.validate_executable_payload(positive)

        success_only = design()
        success_only["TEST"]["scenarios"] = [row for row in success_only["TEST"]["scenarios"]
                                               if row["expectedStatus"] == "SUCCESS"]
        with self.assertRaisesRegex(GEN.ContractError, "expectedStatus coverage is not exact"):
            GEN.validate_executable_payload(success_only)

        missing = design()
        missing["TEST"]["scenarios"] = [row for row in missing["TEST"]["scenarios"]
                                        if row["expectedStatus"] != "RECOVERY"]
        with self.assertRaisesRegex(GEN.ContractError, "expectedStatus coverage is not exact"):
            GEN.validate_executable_payload(missing)

        duplicate = design()
        repeated = copy.deepcopy(duplicate["TEST"]["scenarios"][0])
        repeated["scenarioCode"] = "SAVE_SUCCESS_DUPLICATE"
        duplicate["TEST"]["scenarios"].append(repeated)
        with self.assertRaisesRegex(GEN.ContractError, "expectedStatus is duplicated for command"):
            GEN.validate_executable_payload(duplicate)

    def test_screen_database_plans_merge_by_table_and_reject_conflicts(self) -> None:
        item = safe_create_all_status_design()["DATABASE"]
        approval = copy.deepcopy(item)
        approval["schemaChanges"][0]["tableName"] = "approval"
        approval["entities"][0]["entity"] = "APPROVAL"
        approval["schemaFingerprint"] = GEN.java_hash(approval["schemaChanges"])

        merged = GEN.merge_database_plans([item, approval, copy.deepcopy(item)])
        self.assertEqual("SAFE_CREATE_TABLE", merged["migrationMode"])
        self.assertEqual(["approval", "item"],
                         [row["tableName"] for row in merged["schemaChanges"]])
        self.assertEqual(GEN.java_hash(merged["schemaChanges"]), merged["schemaFingerprint"])

        contradictory = copy.deepcopy(item)
        contradictory["schemaChanges"][0]["columns"][1]["type"] = "varchar(100)"
        contradictory["schemaFingerprint"] = GEN.java_hash(contradictory["schemaChanges"])
        with self.assertRaisesRegex(GEN.ContractError, "database table is contradictory"):
            GEN.merge_database_plans([item, contradictory])
        with self.assertRaisesRegex(GEN.ContractError, "migration mode is not exact"):
            GEN.merge_database_plans([item, design()["DATABASE"]])

    def test_actual_package_publish_check_and_eighteen_axis_semantic_mutations(self) -> None:
        base = specification()
        baseline, _ = GEN.render(base, "PROC")
        for axis in GEN.AXES:
            changed_design = design()
            mutate(axis, changed_design)
            changed, _ = GEN.render(specification(changed_design), "PROC")
            paths = {path for path in baseline if baseline[path] != changed[path]}
            expected_lanes = {lane for lane, axes in GEN.LANES.items() if axis in axes}
            actual_lanes = {path.rsplit("/", 1)[-1][:-5] for path in paths
                if path.endswith(".json") and path != "composite/manifest.json"
                and not path.endswith("support-surfaces.json")}
            self.assertEqual(expected_lanes, actual_lanes, axis)
            self.assertIn("composite/manifest.json", paths, axis)
            self.assertTrue(any(path.endswith("support-surfaces.json") for path in paths), axis)

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            spec_path = root / "job.json"
            out = root / "runtime"
            out.mkdir()
            package = {"step": {"actor": {}, "transition": {}, "input": {}, "output": {}},
                "frontend": {"pages": [{"route": "/work", "audience": "USER"}]},
                "backend": {}, "database": {}, "tests": [], "testExecution": {}}
            package_path = out / "PROC--STEP.json"
            package_path.write_text(json.dumps(package), encoding="utf-8")
            index = {"schemaVersion": "2.0.0", "packages": [{"processCode": "PROC",
                "stepCode": "STEP", "package": package_path.name,
                "packageHash": GEN.digest(GEN.canonical(package))}]}
            index["manifestHash"] = GEN.digest(GEN.canonical(index))
            (out / "index.json").write_text(json.dumps(index), encoding="utf-8")
            spec_path.write_text(json.dumps(base, ensure_ascii=False), encoding="utf-8")
            command = [sys.executable, str(SCRIPT), str(spec_path), "--out", str(out),
                "--process", "PROC", "--staged-output"]
            self.assertEqual(0, subprocess.run(command, check=False).returncode)
            self.assertEqual(0, subprocess.run(command + ["--check"], check=False).returncode)
            projected = json.loads(package_path.read_text(encoding="utf-8"))
            self.assertEqual("KRDS_SDUI_JSON_FORM_V1", projected["frontend"]["pages"][0]["renderer"])
            self.assertEqual(["name"], projected["frontend"]["pages"][0]
                ["commands"][0]["requestFields"])
            self.assertEqual("/api/items", projected["backend"]["compositeAuthorities"][0]
                ["api"]["operations"][0]["path"])
            composite = [case for case in projected["tests"]
                         if case.get("schema") == GEN.COMPOSITE_TEST_CASE_SCHEMA]
            self.assertEqual(5, len(composite))
            self.assertEqual(GEN.COMPOSITE_EXPECTED_STATUSES,
                             {case["expectedStatus"] for case in composite})
            self.assertNotIn("compositeTests", projected)
            self.assertTrue(projected["testExecution"]["liveSmokeRequired"])
            self.assertEqual("QUEUED", projected["testExecution"]["liveSmokeStatus"])
            self.assertFalse(projected["database"]["autoGenerateMigration"])

    def test_all_expected_statuses_project_into_base_runner_without_fake_live_success(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            out = root / "runtime"
            out.mkdir()
            package = runtime_package()
            package_path = out / "PROC--STEP.json"
            package_path.write_text(json.dumps(package), encoding="utf-8")
            index = {"schemaVersion": "2.0.0", "packages": [{"processCode": "PROC",
                "stepCode": "STEP", "package": package_path.name,
                "packageHash": package["packageHash"]}]}
            index["manifestHash"] = GEN.digest(GEN.canonical(index))
            (out / "index.json").write_text(json.dumps(index), encoding="utf-8")
            spec_path = root / "job.json"
            spec_path.write_text(json.dumps(specification(safe_create_all_status_design()), ensure_ascii=False),
                                 encoding="utf-8")
            generate = subprocess.run([sys.executable, str(SCRIPT), str(spec_path), "--out", str(out),
                "--process", "PROC", "--staged-output"], text=True, capture_output=True)
            self.assertEqual(0, generate.returncode, generate.stderr)
            projected = json.loads(package_path.read_text(encoding="utf-8"))
            composite = [case for case in projected["tests"]
                         if case.get("schema") == GEN.COMPOSITE_TEST_CASE_SCHEMA]
            self.assertEqual(5, len(composite))
            self.assertEqual(set(GEN.COMPOSITE_EXPECTED_STATUSES),
                             {case["expectedStatus"] for case in composite})
            self.assertEqual(set(GEN.COMPOSITE_STATUS_SCENARIO_TYPES.values()),
                             {case["type"] for case in composite})
            metadata = projected["testExecution"]["composite"]
            self.assertEqual(5, metadata["projectedCaseCount"])
            self.assertEqual("QUEUED", metadata["liveSmokeStatus"])
            self.assertTrue(metadata["liveSmokeRequired"])
            self.assertNotIn("passed", metadata)
            run_result = subprocess.run([sys.executable, str(FAST_RUNNER), str(package_path)],
                                        text=True, capture_output=True)
            self.assertEqual(0, run_result.returncode, run_result.stdout + run_result.stderr)
            evidence = json.loads(run_result.stdout)
            self.assertEqual("PASSED", evidence["status"])
            self.assertEqual(5, evidence["results"][0]["compositeScenarioCount"])
            self.assertEqual("STATIC_PACKAGE_CONTRACT", evidence["results"][0]["executionScope"])
            self.assertEqual("QUEUED", evidence["results"][0]["liveSmokeStatus"])
            self.assertTrue(projected["database"]["autoGenerateMigration"])
            self.assertEqual("SAFE_CREATE_TABLE", projected["database"]["migrationMode"])

            baseline = copy.deepcopy(projected)

            def run_mutant(mutant: dict) -> tuple[subprocess.CompletedProcess[str], dict]:
                mutant.pop("packageHash", None)
                mutant["packageHash"] = GEN.digest(GEN.canonical(mutant))
                package_path.write_text(json.dumps(mutant), encoding="utf-8")
                result = subprocess.run([sys.executable, str(FAST_RUNNER), str(package_path)],
                                        text=True, capture_output=True)
                return result, json.loads(result.stdout)

            mutant = copy.deepcopy(baseline)
            mutant["testExecution"]["composite"]["projectionHash"] = "f" * 64
            tampered, tampered_evidence = run_mutant(mutant)
            self.assertNotEqual(0, tampered.returncode)
            self.assertIn("composite tests projection hash",
                          tampered_evidence["results"][0]["failures"])

            mutant = copy.deepcopy(baseline)
            mutant["tests"] = [case for case in mutant["tests"]
                               if case.get("schema") != GEN.COMPOSITE_TEST_CASE_SCHEMA]
            mutant.pop("compositeAuthoritySetHash")
            for key in ("composite", "compositeRunner", "liveSmokeRequired", "liveSmokeStatus"):
                mutant["testExecution"].pop(key, None)
            stripped, stripped_evidence = run_mutant(mutant)
            self.assertNotEqual(0, stripped.returncode)
            self.assertIn("composite authority set hash",
                          stripped_evidence["results"][0]["failures"])

            mutant = copy.deepcopy(baseline)
            mutant["database"].pop("migrationMode")
            stripped_db, stripped_db_evidence = run_mutant(mutant)
            self.assertNotEqual(0, stripped_db.returncode)
            self.assertIn("composite database migration mode",
                          stripped_db_evidence["results"][0]["failures"])

            mutant = copy.deepcopy(baseline)
            for key in ("compositeMappings", "migrationMode", "schemaFingerprint",
                        "schemaChanges", "autoGenerateMigration"):
                mutant["database"].pop(key, None)
            for authority in mutant["backend"]["compositeAuthorities"]:
                authority.pop("database", None)
            stripped_all_db, stripped_all_db_evidence = run_mutant(mutant)
            self.assertNotEqual(0, stripped_all_db.returncode)
            self.assertIn("composite database migration mode",
                          stripped_all_db_evidence["results"][0]["failures"])

            package_path.write_text(json.dumps(baseline), encoding="utf-8")
            cache_dir = root / "cache"
            cached = subprocess.run([sys.executable, str(FAST_RUNNER), str(package_path),
                "--cache-dir", str(cache_dir)], text=True, capture_output=True)
            self.assertEqual(0, cached.returncode, cached.stdout + cached.stderr)
            cache_path = next(cache_dir.glob("*.pass.json"))
            forged = json.loads(cache_path.read_text(encoding="utf-8"))
            forged["identity"] = "FORGED/IDENTITY"
            cache_path.write_text(json.dumps(forged), encoding="utf-8")
            rerun = subprocess.run([sys.executable, str(FAST_RUNNER), str(package_path),
                "--cache-dir", str(cache_dir)], text=True, capture_output=True)
            self.assertEqual(0, rerun.returncode, rerun.stdout + rerun.stderr)
            self.assertFalse(json.loads(rerun.stdout)["results"][0]["cached"])

            stale_hash = copy.deepcopy(baseline)
            stale_hash["process"]["name"] = "Tampered after cache publication"
            package_path.write_text(json.dumps(stale_hash), encoding="utf-8")
            stale_run = subprocess.run([sys.executable, str(FAST_RUNNER), str(package_path),
                "--cache-dir", str(cache_dir)], text=True, capture_output=True)
            self.assertNotEqual(0, stale_run.returncode)
            stale_evidence = json.loads(stale_run.stdout)
            self.assertFalse(stale_evidence["results"][0]["cached"])
            self.assertIn("package hash", stale_evidence["results"][0]["failures"])

    def test_java_utf16_hash_golden_and_surrogate_rejection(self) -> None:
        adversarial = {"\ue000": -0.0, "😀": 9007199254740991, "ctrl\u0001": "한글"}
        self.assertEqual("f12d8564fa9d0eb632424e132f0cdb5b0c63d142dc7f98c3dc7a36a67b15415c",
            GEN.java_hash(adversarial))
        with self.assertRaises(GEN.ContractError):
            GEN.java_hash({"bad": "\ud800"})


if __name__ == "__main__":
    unittest.main()
