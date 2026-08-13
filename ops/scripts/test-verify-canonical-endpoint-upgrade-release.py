#!/usr/bin/env python3
"""Scale and mutation tests for verify-canonical-endpoint-upgrade-release.py."""

from __future__ import annotations

import copy
import importlib.util
import json
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
VERIFIER_PATH = HERE / "verify-canonical-endpoint-upgrade-release.py"
SPEC = importlib.util.spec_from_file_location("canonical_upgrade_verifier", VERIFIER_PATH)
assert SPEC and SPEC.loader
V = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(V)


def pg(value: Any) -> str:
    """A stable exact-text stand-in for PostgreSQL jsonb::text fixtures."""
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(", ", ": "))


PERSISTENCE = {
    "persistenceId": "PROCESS_EXECUTION_AGGREGATE",
    "entity": "framework_process_execution",
    "operation": "UPDATE",
    "primaryKey": ["execution_id"],
    "tenantColumn": "tenant_id",
    "projectColumn": "project_id",
    "versionColumn": "execution_version",
    "transactional": True,
}


def operation(index: int) -> dict[str, Any]:
    step = f"S{index:04d}"
    command = f"C{index:04d}"
    request_properties = {
        "tenantId": {"type": "string"},
        "projectId": {"type": "string"},
        "actorCode": {"type": "string"},
        "idempotencyKey": {"type": "string"},
        "value": {"type": "string"},
    }
    return {
        "operationId": f"completeStep{index:04d}",
        "implementationKind": "PROCESS_COMMAND_ADAPTER",
        "method": "POST",
        "path": f"/api/process/p0001/{step.lower()}/{{executionId}}",
        "processCode": "P0001",
        "stepCode": step,
        "commandCode": command,
        "authority": {
            "audience": "USER", "actorCodes": ["ACTOR01"], "authenticated": True,
            "tenantScoped": True, "projectScoped": True,
        },
        "request": {
            "contentType": "application/json",
            "schema": {
                "type": "object", "properties": request_properties,
                "required": ["tenantId", "projectId", "actorCode", "idempotencyKey", "value"],
            },
        },
        "response": {
            "successStatus": 200,
            "schema": {
                "type": "object",
                "properties": {
                    "success": {"type": "boolean"}, "idempotent": {"type": "boolean"},
                    "eventId": {"type": "integer"}, "toState": {"type": "string"},
                },
                "required": ["success", "idempotent", "eventId", "toState"],
            },
            "errors": [
                {"status": 400, "code": "INVALID_REQUEST"},
                {"status": 401, "code": "AUTHENTICATION_REQUIRED"},
                {"status": 403, "code": "ACCESS_DENIED"},
                {"status": 500, "code": "INTERNAL_ERROR"},
            ],
        },
        "persistence": copy.deepcopy(PERSISTENCE),
        "transactionPolicy": "REQUIRED",
        "idempotencyRequired": True,
        "rollback": {"strategy": "TRANSACTION", "commandCode": command},
    }


def design_row(
    index: int, op: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, Any], str, str, str, str]:
    step = op["stepCode"]
    route = f"/work/{step.lower()}"
    key = f"P0001|{step}|USER|{route}"
    api = copy.deepcopy(op)
    api.pop("persistence")
    api["persistenceRef"] = "PROCESS_EXECUTION_AGGREGATE"
    projected = {
        "identity": {
            "screenKey": key, "blueprintCode": f"BP{index:04d}",
            "processCode": "P0001", "stepCode": step, "audience": "USER",
            "routePath": route, "pageId": f"PAGE{index:04d}", "actorCode": "ACTOR01",
        },
        "process": {"processCode": "P0001"},
        "step": {"stepCode": step, "commandCode": op["commandCode"]},
        "lanes": {
            "API": [api], "DATABASE": [copy.deepcopy(PERSISTENCE)],
            "DESIGN_CARD": {"assetBindings": [{}], "specification": {}, "traceability": {}},
            "FRONTEND": {}, "HELP": {"items": [{}]}, "QA": {"checks": [{}], "requiredScenarioTypes": ["A", "B", "C", "D", "E"]},
            "WORK_GUIDE": {"steps": [{}], "nextAction": {}},
        },
    }
    legacy_api = [{"legacyOperation": f"LEGACY_API_{index:04d}"}]
    legacy_database = [{"legacyEntity": f"LEGACY_TABLE_{index:04d}"}]
    source = copy.deepcopy(projected)
    source["lanes"]["API"] = legacy_api
    source["lanes"]["DATABASE"] = legacy_database

    source_text = pg(source)
    source_row = {
        "screenKey": key, "processCode": "P0001", "stepCode": step,
        "audience": "USER", "routePath": route, "designHash": V.sha(source_text),
        "canonicalText": source_text, "canonicalDesign": source,
    }
    projected_text = pg(projected)
    projected_row = {
        "screenKey": key, "processCode": "P0001", "stepCode": step,
        "audience": "USER", "routePath": route, "designHash": V.sha(projected_text),
        "canonicalText": projected_text, "canonicalDesign": projected,
    }
    return (
        source_row, projected_row,
        pg(legacy_api), pg(legacy_api), pg(legacy_database), pg(legacy_database),
    )


def design_catalog(rows: list[dict[str, Any]]) -> dict[str, Any]:
    catalog_hash = V.sha("\n".join(f"{row['screenKey']}{V.US}{row['designHash']}" for row in rows))
    return {"schema": V.DESIGN_SCHEMA, "catalogHash": catalog_hash, "screenCount": len(rows), "screens": rows}


def endpoint_row(design: dict[str, Any], op: dict[str, Any]) -> dict[str, Any]:
    contract = {
        "screenKey": design["screenKey"], "routePath": design["routePath"],
        "audience": design["audience"],
        "source": {"schema": V.DESIGN_SCHEMA, "designHash": design["designHash"]},
        "operations": [op],
    }
    endpoint_text = pg(contract)
    return {
        "screenKey": design["screenKey"], "routePath": design["routePath"],
        "audience": design["audience"], "designHash": design["designHash"],
        "canonicalText": design["canonicalText"], "endpointHash": V.sha(endpoint_text),
        "endpointText": endpoint_text, "endpointContract": contract,
    }


def endpoint_catalog(rows: list[dict[str, Any]]) -> dict[str, Any]:
    catalog_hash = V.sha("\n".join(f"{row['screenKey']}{V.US}{row['endpointHash']}" for row in rows))
    return {"schema": V.ENDPOINT_SCHEMA, "catalogHash": catalog_hash, "endpoints": rows}


def make_fixture(count: int = 2, *, active: bool = True, blockers: tuple[int, int, int, int] = (0, 0, 0, 0)) -> dict[str, Any]:
    source_designs: list[dict[str, Any]] = []
    projected_designs: list[dict[str, Any]] = []
    endpoints: list[dict[str, Any]] = []
    raw_rows: list[tuple[str, str, str, str]] = []
    ops: list[dict[str, Any]] = []
    for index in range(1, count + 1):
        op = operation(index)
        source_row, projected_row, api_raw, api_parsed, db_raw, db_parsed = design_row(index, op)
        source_designs.append(source_row)
        projected_designs.append(projected_row)
        endpoints.append(endpoint_row(projected_row, op))
        raw_rows.append((api_raw, api_parsed, db_raw, db_parsed))
        ops.append(op)
    blocker_count = sum(blockers)
    source_catalog = design_catalog(copy.deepcopy(source_designs))
    projected_catalog = design_catalog(copy.deepcopy(projected_designs))
    endpoints_catalog = endpoint_catalog(endpoints)
    source_text = pg(source_catalog)
    policy_text = pg({"schema": "carbonet.endpoint-upgrade-policy/v1", "adapter": "PROCESS_COMMAND_ADAPTER", "operationCount": 1})
    source_text_hash = V.sha(source_text)
    source_hash = source_catalog["catalogHash"]
    policy_hash = V.sha(policy_text)
    source_count = count + blocker_count
    coverage = {
        "status": "COMPLETE" if blocker_count == 0 else "PARTIAL",
        "sourceDesignCount": source_count,
        "memberCount": count,
        "missingContractCount": blockers[0], "duplicateBlueprintCount": blockers[1],
        "duplicateContractCount": blockers[2], "incompleteLaneCount": blockers[3],
        "blockerCount": blocker_count, "coverageHash": "",
    }
    coverage["coverageHash"] = V.sha(V.US.join([
        coverage["status"], str(source_count), str(count),
        str(blockers[0]), str(blockers[1]), str(blockers[2]), str(blockers[3]),
        str(blocker_count),
    ]))
    members: list[dict[str, Any]] = []
    for index, (source_design, projected_design, endpoint, op, raw) in enumerate(
        zip(source_designs, projected_designs, endpoints, ops, raw_rows), 1
    ):
        api_raw, api_parsed, db_raw, db_parsed = raw
        member = {
            "ordinal": index, "sourceContractId": 10000 + index,
            "processCode": source_design["processCode"], "stepCode": source_design["stepCode"], "screenKey": source_design["screenKey"],
            "sourceDesignHash": source_design["designHash"],
            "sourceApiRawText": api_raw, "sourceApiRawHash": V.sha(api_raw),
            "sourceApiParsedCanonicalText": api_parsed, "sourceApiParsedHash": V.sha(api_parsed),
            "sourceDatabaseRawText": db_raw, "sourceDatabaseRawHash": V.sha(db_raw),
            "sourceDatabaseParsedCanonicalText": db_parsed, "sourceDatabaseParsedHash": V.sha(db_parsed),
            "projectedDesignCanonicalText": projected_design["canonicalText"], "projectedDesignHash": projected_design["designHash"],
            "endpointCanonicalText": endpoint["endpointText"], "endpointHash": endpoint["endpointHash"],
            "operation": copy.deepcopy(op), "memberHash": "",
        }
        member_fields = [
            str(index), str(member["sourceContractId"]), member["processCode"], member["stepCode"], member["screenKey"],
            member["sourceDesignHash"], member["sourceApiRawHash"], member["sourceApiParsedHash"],
            member["sourceDatabaseRawHash"], member["sourceDatabaseParsedHash"], member["projectedDesignHash"],
            member["endpointHash"],
        ]
        member["memberHash"] = V.sha(V.US.join(member_fields))
        members.append(member)
    member_hashes = [member["memberHash"] for member in members]
    overlay_catalog_hash = V.sha("\n".join(member_hashes))
    proposal_id = 7001
    proposal_status = "PUBLISHED"
    proposal_fields = [str(proposal_id), policy_hash, source_text_hash, source_hash, projected_catalog["catalogHash"], str(count), overlay_catalog_hash]
    proposal_hash = V.sha(V.US.join(proposal_fields))
    proposal_catalog_hash = overlay_catalog_hash
    proposal = {
        "proposalId": proposal_id, "status": proposal_status, "proposalHash": proposal_hash,
        "policyHash": policy_hash, "sourceDesignCatalogTextHash": source_text_hash,
        "sourceDesignCatalogHash": source_hash,
        "projectedDesignCatalogHash": projected_catalog["catalogHash"],
        "proposalCatalogHash": proposal_catalog_hash, "memberCount": count,
    }
    validation_id = 8001
    validation_status = "VALIDATED"
    validation_hash = V.sha(V.US.join([str(validation_id), str(proposal_id), validation_status, str(count), "0", proposal_hash]))
    validation = {
        "validationId": validation_id, "proposalId": proposal_id, "status": validation_status,
        "readyCount": count, "blockerCount": 0, "validationHash": validation_hash,
    }
    evidence_status = "VERIFIED" if blocker_count == 0 else "ABSENT"
    evidence = {
        name: {
            "status": evidence_status,
            "evidenceHash": V.sha(f"{name}-evidence") if evidence_status == "VERIFIED" else None,
        }
        for name in ("accountRelay", "businessE2E", "visualQA")
    }
    eligibility = "PUBLISHABLE" if blocker_count == 0 else "VALIDATED_ONLY"
    release_status = "ACTIVE" if active else "PUBLISHED"
    release_id = 9001
    evidence_fields = [
        value
        for name in ("accountRelay", "businessE2E", "visualQA")
        for value in (evidence[name]["status"], evidence[name]["evidenceHash"] or "")
    ]
    release_fields = [
        str(release_id), release_status, coverage["status"], str(count), proposal_hash, validation_hash,
        source_text_hash, source_hash, projected_catalog["catalogHash"], endpoints_catalog["catalogHash"], proposal_catalog_hash,
        coverage["coverageHash"], *evidence_fields, eligibility,
    ]
    release = {
        "releaseId": release_id, "status": release_status, "coverageStatus": coverage["status"],
        "memberCount": count, "proposalHash": proposal_hash, "validationHash": validation_hash,
        "sourceDesignCatalogTextHash": source_text_hash, "sourceDesignCatalogHash": source_hash,
        "projectedDesignCatalogHash": projected_catalog["catalogHash"],
        "endpointCatalogHash": endpoints_catalog["catalogHash"], "proposalCatalogHash": proposal_catalog_hash,
        "coverageHash": coverage["coverageHash"], "releaseHash": V.sha(V.US.join(release_fields)),
        "evidence": evidence, "eligibility": eligibility,
    }
    return {
        "schemaVersion": V.SCHEMA,
        "source": {
            "scopeProcess": "P0001", "sourceDesignCatalogText": source_text,
            "sourceDesignCatalogTextHash": source_text_hash,
            "sourceDesignCatalogHash": source_hash, "sourceDesignCount": source_count,
            "policyText": policy_text, "policyHash": policy_hash,
        },
        "coverage": coverage, "members": members,
        "catalog": {
            "memberCount": count, "memberHashes": member_hashes,
            "catalogHash": overlay_catalog_hash, "design": projected_catalog, "endpoint": endpoints_catalog,
        },
        "proposals": [proposal], "validations": [validation], "release": release,
    }


class VerifierTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        started = time.perf_counter()
        cls.scale = make_fixture(1427)
        built = time.perf_counter() - started
        if built >= 10:
            raise AssertionError(f"1427 fixture construction exceeded 10s: {built:.3f}s")

    def assert_rejected(self, value: Any, pattern: str | None = None) -> None:
        with self.assertRaisesRegex(V.VerificationError, pattern or "."):
            V.verify(value)

    def test_valid_1427_scale_under_ten_seconds(self) -> None:
        started = time.perf_counter()
        result = V.verify(self.scale, require_publishable=True)
        elapsed = time.perf_counter() - started
        self.assertEqual(1427, result["memberCount"])
        self.assertTrue(result["codePublicationEligible"])
        self.assertLess(elapsed, 10.0)

    def test_published_publishable_is_activation_ready_but_not_code_publishable(self) -> None:
        published = make_fixture(2, active=False)
        active = make_fixture(2, active=True)
        result = V.verify(published)
        self.assertEqual("PUBLISHED", result["status"])
        self.assertEqual("PUBLISHABLE", result["eligibility"])
        self.assertFalse(result["codePublicationEligible"])
        with self.assertRaisesRegex(V.VerificationError, "not ACTIVE"):
            V.verify(published, require_publishable=True)
        active_result = V.verify(active, require_publishable=True)
        self.assertTrue(active_result["codePublicationEligible"])
        self.assertNotEqual(
            published["release"]["releaseHash"], active["release"]["releaseHash"]
        )
        self.assertEqual(
            {key: value for key, value in published["release"].items() if key not in {"status", "releaseHash"}},
            {key: value for key, value in active["release"].items() if key not in {"status", "releaseHash"}},
        )

    def test_partial_reason_counts_and_eligibility(self) -> None:
        fixture = make_fixture(2, active=False, blockers=(1, 2, 3, 4))
        result = V.verify(fixture)
        self.assertEqual("PARTIAL", result["coverageStatus"])
        self.assertEqual(10, result["blockerCount"])
        self.assert_rejected(dict(fixture, coverage=dict(fixture["coverage"], blockerCount=9)), "coverage")

    def test_malformed_null_extra_and_wrong_types_fail(self) -> None:
        fixture = make_fixture()
        self.assert_rejected(None, "envelope")
        extra = copy.deepcopy(fixture)
        extra["unexpected"] = 1
        self.assert_rejected(extra, "envelope keys")
        null_members = copy.deepcopy(fixture)
        null_members["members"] = None
        self.assert_rejected(null_members, "members must be an array")
        bool_count = copy.deepcopy(fixture)
        bool_count["coverage"]["memberCount"] = True
        self.assert_rejected(bool_count, "integer")
        null_scope = copy.deepcopy(fixture)
        null_scope["source"]["scopeProcess"] = None
        self.assert_rejected(null_scope, "scopeProcess")
        malformed_raw = copy.deepcopy(fixture)
        member = malformed_raw["members"][0]
        member["sourceApiRawText"] = "not-json"
        member["sourceApiRawHash"] = V.sha(member["sourceApiRawText"])
        member["sourceApiParsedCanonicalText"] = "[]"
        member["sourceApiParsedHash"] = V.sha("[]")
        self.assert_rejected(malformed_raw, "RawText is invalid JSON")

    def test_global_scope_is_validated_only_and_never_active(self) -> None:
        global_release = make_fixture(2, active=False, blockers=(1, 0, 0, 0))
        global_release["source"]["scopeProcess"] = "*"
        result = V.verify(global_release)
        self.assertEqual("PARTIAL", result["coverageStatus"])
        self.assertFalse(result["codePublicationEligible"])
        active_global = make_fixture(2, active=True)
        active_global["source"]["scopeProcess"] = "*"
        self.assert_rejected(active_global, "cannot be ACTIVE")

    def test_order_count_removal_and_stale_cross_links_fail(self) -> None:
        fixture = make_fixture(3)
        reordered = copy.deepcopy(fixture)
        reordered["members"][0], reordered["members"][1] = reordered["members"][1], reordered["members"][0]
        self.assert_rejected(reordered, "ordinals")
        removed = copy.deepcopy(fixture)
        removed["members"].pop()
        self.assert_rejected(removed, "member counts")
        stale = copy.deepcopy(fixture)
        stale["release"]["endpointCatalogHash"] = "0" * 64
        self.assert_rejected(stale, "cross-link")
        count = copy.deepcopy(fixture)
        count["catalog"]["memberCount"] += 1
        self.assert_rejected(count, "member counts")
        propagated = copy.deepcopy(fixture)
        propagated["members"][0]["memberHash"] = "f" * 64
        propagated["catalog"]["memberHashes"][0] = "f" * 64
        propagated["catalog"]["catalogHash"] = V.sha(
            "\n".join(propagated["catalog"]["memberHashes"])
        )
        propagated["proposals"][0]["proposalCatalogHash"] = propagated["catalog"]["catalogHash"]
        self.assert_rejected(propagated, "memberHash")

    def test_proposal_catalog_hash_is_ordered_members_not_proposal_hash(self) -> None:
        fixture = make_fixture()
        self.assertEqual(
            fixture["catalog"]["catalogHash"],
            fixture["proposals"][0]["proposalCatalogHash"],
        )
        mutant = copy.deepcopy(fixture)
        mutant["proposals"][0]["proposalCatalogHash"] = V.sha(
            mutant["proposals"][0]["proposalHash"]
        )
        self.assert_rejected(mutant, "member catalogHash")

    def test_exact_text_hashes_and_one_byte_propagate(self) -> None:
        fixture = make_fixture()
        original_release = fixture["release"]["releaseHash"]
        byte_mutant = copy.deepcopy(fixture)
        byte_mutant["members"][0]["sourceApiRawText"] += " "
        self.assert_rejected(byte_mutant, "RawHash")
        changed = make_fixture()
        changed["source"]["policyText"] = changed["source"]["policyText"].replace("v1", "v2", 1)
        changed["source"]["policyHash"] = V.sha(changed["source"]["policyText"])
        policy_hash = changed["source"]["policyHash"]
        proposal = changed["proposals"][0]
        proposal["policyHash"] = policy_hash
        proposal_fields = [str(proposal["proposalId"]), policy_hash, proposal["sourceDesignCatalogTextHash"], proposal["sourceDesignCatalogHash"], proposal["projectedDesignCatalogHash"], str(proposal["memberCount"]), changed["catalog"]["catalogHash"]]
        proposal["proposalHash"] = V.sha(V.US.join(proposal_fields))
        proposal["proposalCatalogHash"] = changed["catalog"]["catalogHash"]
        validation = changed["validations"][0]
        validation["validationHash"] = V.sha(V.US.join([str(validation["validationId"]), str(proposal["proposalId"]), validation["status"], str(validation["readyCount"]), "0", proposal["proposalHash"]]))
        release = changed["release"]
        release.update({"proposalHash": proposal["proposalHash"], "validationHash": validation["validationHash"], "proposalCatalogHash": proposal["proposalCatalogHash"]})
        evidence_fields = [value for name in ("accountRelay", "businessE2E", "visualQA") for value in (release["evidence"][name]["status"], release["evidence"][name]["evidenceHash"] or "")]
        fields = [str(release["releaseId"]), release["status"], release["coverageStatus"], str(release["memberCount"]), release["proposalHash"], release["validationHash"], release["sourceDesignCatalogTextHash"], release["sourceDesignCatalogHash"], release["projectedDesignCatalogHash"], release["endpointCatalogHash"], release["proposalCatalogHash"], release["coverageHash"], *evidence_fields, release["eligibility"]]
        release["releaseHash"] = V.sha(V.US.join(fields))
        V.verify(changed)
        self.assertNotEqual(original_release, release["releaseHash"])

    def test_source_text_and_membership_hashes_are_distinct_and_bound(self) -> None:
        fixture = make_fixture()
        self.assertNotEqual(
            fixture["source"]["sourceDesignCatalogTextHash"],
            fixture["source"]["sourceDesignCatalogHash"],
        )
        self.assertNotEqual(
            fixture["source"]["sourceDesignCatalogHash"],
            fixture["catalog"]["design"]["catalogHash"],
        )
        for source_screen, projected_screen in zip(
            json.loads(fixture["source"]["sourceDesignCatalogText"])["screens"],
            fixture["catalog"]["design"]["screens"],
        ):
            self.assertNotEqual(source_screen["designHash"], projected_screen["designHash"])
            self.assertNotEqual(
                source_screen["canonicalDesign"]["lanes"]["API"],
                projected_screen["canonicalDesign"]["lanes"]["API"],
            )
        stale_text = copy.deepcopy(fixture)
        stale_text["source"]["sourceDesignCatalogTextHash"] = "0" * 64
        self.assert_rejected(stale_text, "TextHash")
        stale_membership = copy.deepcopy(fixture)
        stale_membership["source"]["sourceDesignCatalogHash"] = "0" * 64
        self.assert_rejected(stale_membership, "parsed catalogHash")

    def test_evidence_objects_are_exact_and_hash_bound(self) -> None:
        fixture = make_fixture()
        extra = copy.deepcopy(fixture)
        extra["release"]["evidence"]["visualQA"]["extra"] = True
        self.assert_rejected(extra, "release.evidence.visualQA")
        absent_with_hash = make_fixture(active=False, blockers=(1, 0, 0, 0))
        absent_with_hash["release"]["evidence"]["accountRelay"]["evidenceHash"] = "a" * 64
        self.assert_rejected(absent_with_hash, "ABSENT must have null")
        verified_null = copy.deepcopy(fixture)
        verified_null["release"]["evidence"]["businessE2E"]["evidenceHash"] = None
        self.assert_rejected(verified_null, "lowercase SHA-256")

    def test_duplicate_operation_and_route_collisions_fail(self) -> None:
        fixture = make_fixture(2)
        duplicate = copy.deepcopy(fixture)
        duplicate["catalog"]["endpoint"]["endpoints"][1]["endpointContract"]["operations"][0]["operationId"] = duplicate["catalog"]["endpoint"]["endpoints"][0]["endpointContract"]["operations"][0]["operationId"]
        self.assert_rejected(duplicate, "text/object mismatch|duplicate")
        collision = copy.deepcopy(fixture)
        endpoint = collision["catalog"]["endpoint"]["endpoints"][1]
        endpoint["endpointContract"]["operations"][0]["path"] = collision["catalog"]["endpoint"]["endpoints"][0]["endpointContract"]["operations"][0]["path"]
        endpoint["endpointText"] = pg(endpoint["endpointContract"])
        endpoint["endpointHash"] = V.sha(endpoint["endpointText"])
        self.assert_rejected(collision, "catalogHash|duplicate/colliding")

    def test_idempotent_normalized_manifest_and_cli_writes_zero(self) -> None:
        fixture = make_fixture()
        first = V.verify(copy.deepcopy(fixture))
        second = V.verify(json.loads(json.dumps(fixture)))
        self.assertEqual(V.compact(first), V.compact(second))
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "release.json"
            source.write_text(json.dumps(fixture), encoding="utf-8")
            before = {path.name: path.read_bytes() for path in root.iterdir()}
            checked = subprocess.run([sys.executable, str(VERIFIER_PATH), "--check", str(source)], capture_output=True, text=True, check=False)
            self.assertEqual(0, checked.returncode, checked.stderr)
            self.assertEqual("", checked.stdout)
            self.assertEqual(before, {path.name: path.read_bytes() for path in root.iterdir()})
            emitted = subprocess.run([sys.executable, str(VERIFIER_PATH), "--emit-normalized", str(source)], capture_output=True, text=True, check=False)
            self.assertEqual(0, emitted.returncode, emitted.stderr)
            self.assertEqual(first, json.loads(emitted.stdout))


if __name__ == "__main__":
    unittest.main(verbosity=2)
