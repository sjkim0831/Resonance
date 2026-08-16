#!/usr/bin/env python3
"""Fail-closed tests for the DB-derived composite relay account-ID map."""

from __future__ import annotations

import copy
import importlib.util
import json
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "ops/scripts/generate-composite-relay-account-map.py"
MANIFEST = REPO / "ops/runtime-metadata/composite-relay-account-map.json"
LOADER = importlib.util.spec_from_file_location("composite_relay_account_map", SCRIPT)
assert LOADER and LOADER.loader
MODULE = importlib.util.module_from_spec(LOADER)
LOADER.loader.exec_module(MODULE)


def candidate(account: str, count: int, tenant: str = "TENANT_A",
              project: str = "PROJECT_A") -> dict:
    return {"accountId": account, "tenantId": tenant, "projectId": project,
            "assignmentCount": count}


def scope(actor: str = "CALCULATOR", positive: str = "relay_calc",
          forbidden: str = "relay_denied", authority: int = 11) -> dict:
    return {"jobId": 7, "authorityId": authority, "authorityRevision": 3,
            "projectId": "PROJECT_A", "actorCode": actor,
            "positive": [candidate(positive, 1)],
            "forbidden": [candidate(forbidden, 0)]}


def snapshot(*scopes: dict, revision: str = "a" * 64,
             assignments: str = "b" * 64) -> dict:
    return {"schema": MODULE.SNAPSHOT_SCHEMA, "dispatchCount": 1,
            "revisionSetHash": revision,
            "assignmentSetHash": assignments, "scopes": list(scopes or (scope(),))}


class CompositeRelayAccountMapTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.fixture = self.root / "snapshot.json"
        self.environment_file = self.root / "relay.env"
        self.state_file = self.root / "relay.state.json"
        self.secret_password = "external-password-never-persist"
        self.secret_token = "external-token-never-persist"

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def environment(self, *, fixture_mode: bool = True, secrets: bool = True) -> dict[str, str]:
        value = os.environ.copy()
        value["CARBONET_COMPOSITE_RELAY_MAP_TEST_FIXTURE"] = str(self.fixture)
        if fixture_mode:
            value["CARBONET_COMPOSITE_RELAY_MAP_TEST_MODE"] = "true"
        else:
            value.pop("CARBONET_COMPOSITE_RELAY_MAP_TEST_MODE", None)
        if secrets:
            value["CARBONET_ACTOR_TEST_PASSWORD"] = self.secret_password
            value["RESONANCE_OPS_TOKEN"] = self.secret_token
        else:
            value.pop("CARBONET_ACTOR_TEST_PASSWORD", None)
            value.pop("RESONANCE_OPS_TOKEN", None)
        return value

    def write_fixture(self, value: dict) -> None:
        self.fixture.write_text(json.dumps(value), encoding="utf-8")

    def run_cli(self, value: dict, *, check: bool = False,
                environment: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
        self.write_fixture(value)
        command = [sys.executable, str(SCRIPT), "--manifest", str(MANIFEST),
                   "--output-env", str(self.environment_file),
                   "--state", str(self.state_file)]
        if check:
            command.append("--check")
        return subprocess.run(command, text=True, capture_output=True,
                              env=environment or self.environment(), check=False)

    def parsed_account_map(self) -> dict[str, str]:
        line = self.environment_file.read_text(encoding="utf-8").strip()
        prefix = "CARBONET_COMPOSITE_RELAY_ACCOUNTS_JSON='"
        self.assertTrue(line.startswith(prefix) and line.endswith("'"))
        return json.loads(line[len(prefix):-1])

    def assert_no_secret_material(self, result: subprocess.CompletedProcess[str]) -> None:
        material = result.stdout + result.stderr
        self.assertNotIn(self.secret_password, material)
        self.assertNotIn(self.secret_token, material)
        if self.environment_file.exists():
            material += self.environment_file.read_text(encoding="utf-8")
        if self.state_file.exists():
            material += self.state_file.read_text(encoding="utf-8")
        self.assertNotIn(self.secret_password, material)
        self.assertNotIn(self.secret_token, material)

    def test_ids_only_deterministic_output_and_current_check(self) -> None:
        value = snapshot()
        first = self.run_cli(value)
        self.assertEqual(0, first.returncode, first.stderr)
        self.assertEqual("", first.stdout)
        self.assertEqual("", first.stderr)
        account_map = self.parsed_account_map()
        self.assertEqual({"CALCULATOR": "relay_calc",
                          "FORBIDDEN:CALCULATOR": "relay_denied"}, account_map)
        self.assertTrue(all(isinstance(item, str) for item in account_map.values()))
        state_text = self.state_file.read_text(encoding="utf-8")
        state = json.loads(state_text)
        self.assertEqual(MODULE.STATE_SCHEMA, state["schema"])
        self.assertEqual("a" * 64, state["authorityRevisionSetHash"])
        self.assertNotIn("relay_calc", state_text)
        self.assertNotIn("relay_denied", state_text)
        self.assertNotIn("password", state_text.lower())
        self.assertNotIn("token", state_text.lower())
        self.assert_no_secret_material(first)
        before = (self.environment_file.read_bytes(), self.state_file.read_bytes())
        current = self.run_cli(value, check=True)
        self.assertEqual(0, current.returncode, current.stderr)
        repeated = self.run_cli(value)
        self.assertEqual(0, repeated.returncode, repeated.stderr)
        self.assertEqual(before, (self.environment_file.read_bytes(), self.state_file.read_bytes()))
        if os.name == "posix":
            self.assertEqual(0o600, stat.S_IMODE(self.environment_file.stat().st_mode))
            self.assertEqual(0o600, stat.S_IMODE(self.state_file.stat().st_mode))

    def test_external_secrets_are_mandatory_and_never_logged(self) -> None:
        result = self.run_cli(snapshot(), environment=self.environment(secrets=False))
        self.assertNotEqual(0, result.returncode)
        self.assertIn("EXTERNAL_LIVE_SMOKE_SECRETS_REQUIRED", result.stderr)
        self.assertFalse(self.environment_file.exists())
        self.assertFalse(self.state_file.exists())
        self.assertNotIn("relay_calc", result.stderr)
        self.assert_no_secret_material(result)

    def test_no_current_dispatch_scope_is_a_quiet_launcher_skip(self) -> None:
        value = snapshot()
        value["scopes"] = []
        value["dispatchCount"] = 0
        result = self.run_cli(value)
        self.assertEqual(10, result.returncode)
        self.assertEqual("", result.stdout)
        self.assertEqual("", result.stderr)
        self.assertFalse(self.environment_file.exists())
        self.assertFalse(self.state_file.exists())

        malformed = snapshot()
        malformed["scopes"] = []
        rejected = self.run_cli(malformed)
        self.assertNotEqual(0, rejected.returncode)
        self.assertIn("CURRENT_RELAY_ASSIGNMENT_SCOPE_REQUIRED", rejected.stderr)

    def test_revision_and_assignment_changes_make_existing_map_stale(self) -> None:
        base = snapshot()
        self.assertEqual(0, self.run_cli(base).returncode)
        revised = snapshot(revision="c" * 64, assignments="d" * 64)
        stale_revision = self.run_cli(revised, check=True)
        self.assertNotEqual(0, stale_revision.returncode)
        self.assertIn("RELAY_ACCOUNT_MAP_STALE", stale_revision.stderr)
        self.assertNotIn("relay_calc", stale_revision.stderr)
        self.assertEqual(0, self.run_cli(revised).returncode)
        self.assertEqual("c" * 64,
                         json.loads(self.state_file.read_text())["authorityRevisionSetHash"])

        changed_assignment = snapshot(
            scope(positive="relay_calc_v2"), revision="c" * 64, assignments="e" * 64)
        stale_assignment = self.run_cli(changed_assignment, check=True)
        self.assertNotEqual(0, stale_assignment.returncode)
        self.assertIn("RELAY_ACCOUNT_MAP_STALE", stale_assignment.stderr)
        self.assertEqual(0, self.run_cli(changed_assignment).returncode)
        self.assertEqual("relay_calc_v2", self.parsed_account_map()["CALCULATOR"])

    def test_missing_and_ambiguous_assignments_fail_closed(self) -> None:
        cases: list[tuple[str, dict, str]] = []
        missing_positive = scope(); missing_positive["positive"] = []
        cases.append(("missing-positive", snapshot(missing_positive),
                      "ACTIVE_RELAY_ASSIGNMENT_MISSING"))
        ambiguous_positive = scope(); ambiguous_positive["positive"].append(
            candidate("relay_calc_2", 1))
        cases.append(("ambiguous-positive", snapshot(ambiguous_positive),
                      "ACTIVE_RELAY_ASSIGNMENT_AMBIGUOUS"))
        missing_forbidden = scope(); missing_forbidden["forbidden"] = []
        cases.append(("missing-forbidden", snapshot(missing_forbidden),
                      "FORBIDDEN_RELAY_ACCOUNT_MISSING"))
        ambiguous_forbidden = scope(); ambiguous_forbidden["forbidden"].append(
            candidate("relay_denied_2", 0))
        cases.append(("ambiguous-forbidden", snapshot(ambiguous_forbidden),
                      "FORBIDDEN_RELAY_ACCOUNT_AMBIGUOUS"))
        duplicate_assignment = scope(); duplicate_assignment["positive"][0]["assignmentCount"] = 2
        cases.append(("duplicate-assignment", snapshot(duplicate_assignment),
                      "ACTIVE_RELAY_ASSIGNMENT_NOT_EXACT"))
        assigned_forbidden = scope(); assigned_forbidden["forbidden"][0]["assignmentCount"] = 1
        cases.append(("assigned-forbidden", snapshot(assigned_forbidden),
                      "FORBIDDEN_RELAY_ASSIGNMENT_NOT_ZERO"))
        across_scope = scope(authority=12, positive="relay_calc_2")
        cases.append(("actor-across-scopes", snapshot(scope(), across_scope),
                      "ACTIVE_RELAY_ACCOUNT_AMBIGUOUS_ACROSS_SCOPES"))
        reused = scope(actor="VERIFIER", positive="relay_calc", authority=12)
        cases.append(("actor-isolation", snapshot(scope(), reused),
                      "RELAY_ACCOUNT_ACTOR_ISOLATION_REQUIRED"))
        same_forbidden = scope(); same_forbidden["forbidden"][0]["accountId"] = "relay_calc"
        cases.append(("forbidden-is-positive", snapshot(same_forbidden),
                      "FORBIDDEN_RELAY_ACCOUNT_MUST_BE_UNASSIGNED"))
        cases.append(("duplicate-scope", snapshot(scope(), scope()),
                      "RELAY_ASSIGNMENT_SCOPE_DUPLICATED"))
        cases.append(("noncanonical-order", snapshot(scope(authority=12), scope()),
                      "RELAY_ASSIGNMENT_SCOPE_ORDER_INVALID"))
        for name, value, expected in cases:
            with self.subTest(name=name):
                result = self.run_cli(value)
                self.assertNotEqual(0, result.returncode)
                self.assertIn(expected, result.stderr)
                self.assertNotIn("relay_calc", result.stderr)
                self.assert_no_secret_material(result)

    def test_fixture_requires_explicit_test_mode_and_schema_is_exact(self) -> None:
        denied = self.run_cli(snapshot(), environment=self.environment(fixture_mode=False))
        self.assertNotEqual(0, denied.returncode)
        self.assertIn("TEST_FIXTURE_MODE_FORBIDDEN", denied.stderr)
        extra = snapshot(); extra["password"] = "must-never-be-accepted"
        invalid = self.run_cli(extra)
        self.assertNotEqual(0, invalid.returncode)
        self.assertIn("RELAY_ACCOUNT_SNAPSHOT_INVALID", invalid.stderr)
        self.assertFalse(self.environment_file.exists())

    def test_policy_and_database_query_encode_exact_active_scope_contract(self) -> None:
        policy = MODULE.load_policy(MANIFEST)
        self.assertEqual("EVERY_LAUNCH_AND_AUTHORITY_REVISION", policy["refreshPolicy"])
        self.assertEqual("EXACT_ONE_ACTIVE_AUTHENTICATED_IDENTITY",
                         policy["selectionPolicy"]["identity"])
        self.assertEqual("EXCLUDED", policy["selectionPolicy"]["positiveDeniedRole"])
        sql = MODULE.DB_SNAPSHOT_SQL
        for token in (
            "framework_composite_authority_revision_set_hash(dispatch.job_id)",
            "dispatch.status in('QUEUED','RETRY_WAIT','RUNNING')",
            "framework_account_actor_assignment",
            "framework_project_actor_assignment",
            "assignment.assignment_status='ACTIVE'",
            "project_actor.active_yn='Y'",
            "assignment.valid_from<=current_date",
            "ROLE_COMPOSITE_LIVE_SMOKE_DENIED",
            "count(distinct identity_key)=1",
            "and not identity.denied_role",
            "count(distinct assignment.assignment_id)",
        ):
            self.assertIn(token, sql)
        self.assertNotIn("password", sql.lower())
        self.assertNotIn("token", sql.lower())


if __name__ == "__main__":
    unittest.main()
