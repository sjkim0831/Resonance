#!/usr/bin/env python3
"""Regression checks for deterministic full-stack field grouping."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import os
import subprocess
import sys
import tempfile
import unittest
from unittest import mock


MODULE_PATH = Path(__file__).with_name("generate-full-stack-design-packages.py")
SPEC = spec_from_file_location("full_stack_generator", MODULE_PATH)
assert SPEC and SPEC.loader
GENERATOR = module_from_spec(SPEC)
SPEC.loader.exec_module(GENERATOR)


class GroupFieldsByAudienceTest(unittest.TestCase):
    def test_canonical_catalog_hashes_are_bound_to_each_runtime_step(self) -> None:
        catalog = {
            "schema": "carbonet.canonical-design/v1",
            "screens": [
                {"processCode": "P1", "stepCode": "S1", "screenKey": "P1|S1|USER|/a", "designHash": "a" * 64},
                {"processCode": "P1", "stepCode": "S1", "screenKey": "P1|S1|ADMIN|/b", "designHash": "b" * 64},
                {"processCode": "P1", "stepCode": "S2", "screenKey": "P1|S2|USER|/c", "designHash": "c" * 64},
            ],
        }
        self.assertEqual(
            [
                {"screenKey": "P1|S1|ADMIN|/b", "designHash": "b" * 64},
                {"screenKey": "P1|S1|USER|/a", "designHash": "a" * 64},
            ],
            GENERATOR.canonical_screens_for_step(catalog, "P1", "S1"),
        )
        with self.assertRaisesRegex(SystemExit, "no screen"):
            GENERATOR.canonical_screens_for_step(catalog, "P1", "MISSING")
        subset = GENERATOR.subset_canonical_catalog(catalog, "P1")
        self.assertEqual(3, subset["screenCount"])
        self.assertRegex(subset["catalogHash"], r"^[0-9a-f]{64}$")
        with self.assertRaisesRegex(SystemExit, "no screens"):
            GENERATOR.subset_canonical_catalog(catalog, "MISSING")

    def test_parallel_rendering_is_bounded_and_deterministic(self) -> None:
        data = {"processes": [{
            "processCode": "PROCESS_A",
            "steps": [
                {"step_code": f"STEP_{index:02d}", "approval_status": "APPROVED", "screen_contract": []}
                for index in range(24)
            ],
        }]}
        def projected(process, step, shared):
            return {"identity": f"{process['processCode']}/{step['step_code']}", "shared": shared}
        with mock.patch.object(GENERATOR, "render_step", side_effect=projected):
            serial, serial_skipped = GENERATOR.render_packages(data, False, 1)
            parallel, parallel_skipped = GENERATOR.render_packages(data, False, 999)
        self.assertEqual(0, serial_skipped)
        self.assertEqual(serial_skipped, parallel_skipped)
        self.assertEqual(serial, parallel)
        self.assertEqual(24, len(parallel))

    def test_atomic_publish_is_zero_rewrite_and_rolls_back_all_directories(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            stages = [root / f"stage-{index}" for index in range(3)]
            outputs = [root / f"out-{index}" for index in range(3)]
            for index, (stage, output) in enumerate(zip(stages, outputs)):
                stage.mkdir(); output.mkdir()
                (stage / "artifact.txt").write_text(f"new-{index}", encoding="utf-8")
                (output / "artifact.txt").write_text(f"old-{index}", encoding="utf-8")
            pairs = list(zip(stages, outputs))
            self.assertEqual(3, GENERATOR.publish_directories(pairs))
            mtimes = [(output / "artifact.txt").stat().st_mtime_ns for output in outputs]
            self.assertEqual(0, GENERATOR.publish_directories(pairs))
            self.assertEqual(mtimes, [(output / "artifact.txt").stat().st_mtime_ns for output in outputs])

            for index, stage in enumerate(stages):
                (stage / "artifact.txt").write_text(f"next-{index}", encoding="utf-8")
            original_replace = GENERATOR.os.replace
            def fail_second_activation(source, destination):
                if ".out-1.incoming-" in str(source):
                    raise OSError("schema mutation publication failure")
                return original_replace(source, destination)
            with mock.patch.object(GENERATOR.os, "replace", side_effect=fail_second_activation):
                with self.assertRaisesRegex(OSError, "schema mutation"):
                    GENERATOR.publish_directories(pairs)
            self.assertEqual(
                [f"new-{index}" for index in range(3)],
                [(output / "artifact.txt").read_text(encoding="utf-8") for output in outputs],
            )
            self.assertFalse(any("incoming" in path.name or "backup" in path.name for path in root.iterdir()))

    def test_atomic_publish_restores_all_directories_when_backup_phase_crashes(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            stages = [root / f"stage-{index}" for index in range(3)]
            outputs = [root / f"out-{index}" for index in range(3)]
            for index, (stage, output) in enumerate(zip(stages, outputs)):
                stage.mkdir(); output.mkdir()
                (stage / "artifact.txt").write_text(f"new-{index}", encoding="utf-8")
                (output / "artifact.txt").write_text(f"old-{index}", encoding="utf-8")
            original_replace = GENERATOR.os.replace
            backup_count = 0

            def fail_second_backup(source, destination):
                nonlocal backup_count
                if ".backup-" in str(destination):
                    backup_count += 1
                    if backup_count == 2:
                        raise OSError("backup phase crash")
                return original_replace(source, destination)

            with mock.patch.object(GENERATOR.os, "replace", side_effect=fail_second_backup):
                with self.assertRaisesRegex(OSError, "backup phase"):
                    GENERATOR.publish_directories(list(zip(stages, outputs)))
            self.assertEqual(
                [f"old-{index}" for index in range(3)],
                [(output / "artifact.txt").read_text(encoding="utf-8") for output in outputs],
            )
            self.assertFalse(any("incoming" in path.name or "backup" in path.name for path in root.iterdir()))

    def test_atomic_publish_rejects_symlink_and_nested_paths_before_writes(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            stage = root / "stage"; stage.mkdir()
            (stage / "artifact.txt").write_text("new", encoding="utf-8")
            output = root / "output"; output.mkdir()
            (output / "artifact.txt").write_text("old", encoding="utf-8")
            linked = root / "linked"
            try:
                linked.symlink_to(output, target_is_directory=True)
            except OSError:
                self.skipTest("directory symlinks are unavailable")
            with self.assertRaisesRegex(SystemExit, "symlink"):
                GENERATOR.publish_directories([(stage, linked)])
            linked.unlink()
            nested = output / "nested"
            with self.assertRaisesRegex(SystemExit, "nested"):
                GENERATOR.publish_directories([(stage, output), (stage, nested)])
            inside_link = stage / "escape"
            inside_link.symlink_to(output, target_is_directory=True)
            with self.assertRaisesRegex(SystemExit, "symlink"):
                GENERATOR.publish_directories([(stage, root / "other")])
            self.assertEqual("old", (output / "artifact.txt").read_text(encoding="utf-8"))
            self.assertFalse((root / "other").exists())

    def test_process_scoped_publish_preserves_sibling_endpoint_tree(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            endpoint_root = root / "generated-endpoints"
            process_a = endpoint_root / "PROCESS_A"
            process_b = endpoint_root / "PROCESS_B"
            process_a.mkdir(parents=True); process_b.mkdir()
            (process_a / "manifest.json").write_text("old-a", encoding="utf-8")
            (process_b / "manifest.json").write_text("stable-b", encoding="utf-8")
            stage = root / "stage-a"; stage.mkdir()
            (stage / "manifest.json").write_text("new-a", encoding="utf-8")

            self.assertEqual(1, GENERATOR.publish_directories([(stage, process_a)]))
            self.assertEqual("new-a", (process_a / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual("stable-b", (process_b / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(0, GENERATOR.publish_directories([(stage, process_a)]))

    def test_sigkill_publish_is_recovered_on_next_run(self) -> None:
        for cut in ("backup:1", "backup:3", "activation:1", "activation:3", "commit:0", "commit:1", "cleanup:1", "cleanup:3"):
            with self.subTest(cut=cut), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                stages = [root / f"stage-{index}" for index in range(3)]
                outputs = [root / f"out-{index}" for index in range(3)]
                for index, (stage, output) in enumerate(zip(stages, outputs)):
                    stage.mkdir(); output.mkdir()
                    (stage / "artifact.txt").write_text(f"new-{index}", encoding="utf-8")
                    (output / "artifact.txt").write_text(f"old-{index}", encoding="utf-8")
                command = [sys.executable, str(MODULE_PATH), "--publish-set"]
                for stage, output in zip(stages, outputs):
                    command.extend((str(stage), str(output)))
                environment = os.environ.copy(); environment["CANONICAL_PUBLISH_KILL_AFTER"] = cut
                crashed = subprocess.run(command, env=environment, capture_output=True, text=True)
                self.assertNotEqual(0, crashed.returncode)
                recovered = subprocess.run(
                    [sys.executable, str(MODULE_PATH), "--recover-publish-set", *map(str, outputs)],
                    capture_output=True, text=True,
                )
                self.assertEqual(0, recovered.returncode, recovered.stderr)
                self.assertTrue(__import__("json").loads(recovered.stdout)["recovered"])
                expected = "new" if cut in {"commit:1", "cleanup:1", "cleanup:3"} else "old"
                self.assertEqual(
                    [f"{expected}-{index}" for index in range(3)],
                    [(output / "artifact.txt").read_text(encoding="utf-8") for output in outputs],
                )
                self.assertFalse(any("incoming" in path.name or "backup" in path.name or "journal" in path.name
                                     for path in root.iterdir()))

    def test_recovery_rejects_tampered_journal_without_touching_outside_path(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            outputs = [root / f"out-{index}" for index in range(3)]
            for output in outputs:
                output.mkdir(); (output / "artifact.txt").write_text("old", encoding="utf-8")
            journal, _ = GENERATOR.publication_control_paths(outputs)
            outside = root.parent / "outside-do-not-touch"
            outside.mkdir(exist_ok=True)
            marker = outside / "marker"; marker.write_text("safe", encoding="utf-8")
            transaction = "tampered"
            entries = []
            for output in outputs:
                entries.append({
                    "destination": str(output),
                    "incoming": str(outside),
                    "backup": str(output.parent / f".{output.name}.backup-{transaction}"),
                    "hadDestination": True,
                    "stagedHash": "0" * 64,
                    "originalHash": GENERATOR.directory_hash(output),
                })
            journal.write_text(__import__("json").dumps({
                "schema": "carbonet.atomic-publish-journal/v1", "transactionId": transaction,
                "phase": "PREPARED", "entries": entries,
            }), encoding="utf-8")
            with self.assertRaisesRegex(SystemExit, "escaped|name"):
                GENERATOR.recover_publish_destinations(outputs)
            self.assertEqual("safe", marker.read_text(encoding="utf-8"))
            journal.unlink()

    def test_process_scoped_journals_do_not_block_sibling_publish(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            stage_a = root / "stage-a"; stage_b = root / "stage-b"
            out_a = root / "generated" / "PROCESS_A"
            out_b = root / "generated" / "PROCESS_B"
            for stage, output, label in ((stage_a, out_a, "a"), (stage_b, out_b, "b")):
                stage.mkdir(parents=True); output.mkdir(parents=True)
                (stage / "artifact").write_text(f"new-{label}", encoding="utf-8")
                (output / "artifact").write_text(f"old-{label}", encoding="utf-8")
            crashed = subprocess.run(
                [sys.executable, str(MODULE_PATH), "--publish-set", str(stage_a), str(out_a)],
                env={**os.environ, "CANONICAL_PUBLISH_KILL_AFTER": "backup:1"},
                capture_output=True, text=True,
            )
            self.assertNotEqual(0, crashed.returncode)
            self.assertEqual(1, GENERATOR.publish_directories([(stage_b, out_b)]))
            self.assertEqual("new-b", (out_b / "artifact").read_text(encoding="utf-8"))
            self.assertTrue(GENERATOR.recover_publish_destinations([out_a]))
            self.assertEqual("old-a", (out_a / "artifact").read_text(encoding="utf-8"))

    def test_committed_tamper_rolls_back_once_and_next_recovery_is_clean(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            stages = [root / f"stage-{index}" for index in range(3)]
            outputs = [root / f"out-{index}" for index in range(3)]
            for index, (stage, output) in enumerate(zip(stages, outputs)):
                stage.mkdir(); output.mkdir()
                (stage / "artifact").write_text(f"new-{index}", encoding="utf-8")
                (output / "artifact").write_text(f"old-{index}", encoding="utf-8")
            command = [sys.executable, str(MODULE_PATH), "--publish-set"]
            for stage, output in zip(stages, outputs): command.extend((str(stage), str(output)))
            crashed = subprocess.run(command, env={**os.environ, "CANONICAL_PUBLISH_KILL_AFTER": "commit:1"})
            self.assertNotEqual(0, crashed.returncode)
            (outputs[1] / "artifact").write_text("tampered", encoding="utf-8")
            with self.assertRaisesRegex(SystemExit, "rolled back"):
                GENERATOR.recover_publish_destinations(outputs)
            self.assertEqual([f"old-{index}" for index in range(3)],
                             [(output / "artifact").read_text(encoding="utf-8") for output in outputs])
            self.assertFalse(GENERATOR.recover_publish_destinations(outputs))

    def test_committed_tamper_after_backup_cleanup_preserves_journal(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            stages = [root / f"stage-{index}" for index in range(3)]
            outputs = [root / f"out-{index}" for index in range(3)]
            for index, (stage, output) in enumerate(zip(stages, outputs)):
                stage.mkdir(); output.mkdir()
                (stage / "artifact").write_text(f"new-{index}", encoding="utf-8")
                (output / "artifact").write_text(f"old-{index}", encoding="utf-8")
            command = [sys.executable, str(MODULE_PATH), "--publish-set"]
            for stage, output in zip(stages, outputs): command.extend((str(stage), str(output)))
            crashed = subprocess.run(command, env={**os.environ, "CANONICAL_PUBLISH_KILL_AFTER": "cleanup:1"})
            self.assertNotEqual(0, crashed.returncode)
            (outputs[1] / "artifact").write_text("tampered", encoding="utf-8")
            journal, _ = GENERATOR.publication_control_paths(outputs)
            for _ in range(2):
                with self.assertRaisesRegex(SystemExit, "journal preserved"):
                    GENERATOR.recover_publish_destinations(outputs)
                self.assertTrue(journal.exists())

    def test_rollback_failure_preserves_backup_and_journal_for_retry(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            stage = root / "stage"; output = root / "out"
            stage.mkdir(); output.mkdir()
            (stage / "artifact").write_text("new", encoding="utf-8")
            (output / "artifact").write_text("old", encoding="utf-8")
            real_replace = GENERATOR.os.replace
            calls = 0

            def fail_activation_and_rollback(source, destination):
                nonlocal calls
                calls += 1
                if ".incoming-" in str(source) or (".backup-" in str(source) and str(destination)==str(output)):
                    raise OSError("rollback blocked")
                return real_replace(source, destination)

            with mock.patch.object(GENERATOR.os, "replace", side_effect=fail_activation_and_rollback):
                with self.assertRaises(OSError):
                    GENERATOR.publish_directories([(stage, output)])
            journal, _ = GENERATOR.publication_control_paths([output])
            self.assertTrue(journal.exists())
            value = __import__("json").loads(journal.read_text())
            backup = Path(value["entries"][0]["backup"])
            self.assertTrue(backup.is_dir())
            self.assertEqual("old", (backup / "artifact").read_text(encoding="utf-8"))
            self.assertTrue(GENERATOR.recover_publish_destinations([output]))
            self.assertEqual("old", (output / "artifact").read_text(encoding="utf-8"))

    def test_tampered_second_backup_causes_zero_recovery_mutations(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            stages = [root / f"stage-{index}" for index in range(3)]
            outputs = [root / f"out-{index}" for index in range(3)]
            for index, (stage, output) in enumerate(zip(stages, outputs)):
                stage.mkdir(); output.mkdir()
                (stage / "artifact").write_text(f"new-{index}", encoding="utf-8")
                (output / "artifact").write_text(f"old-{index}", encoding="utf-8")
            command=[sys.executable,str(MODULE_PATH),"--publish-set"]
            for stage,output in zip(stages,outputs): command.extend((str(stage),str(output)))
            crashed=subprocess.run(command,env={**os.environ,"CANONICAL_PUBLISH_KILL_AFTER":"backup:3"})
            self.assertNotEqual(0,crashed.returncode)
            journal,_=GENERATOR.publication_control_paths(outputs)
            value=__import__("json").loads(journal.read_text())
            backups=[Path(entry["backup"]) for entry in value["entries"]]
            (backups[1]/"artifact").write_text("tampered",encoding="utf-8")
            before=[GENERATOR.directory_bytes(path) for path in [*outputs,*backups]]
            with self.assertRaisesRegex(SystemExit,"backup hash mismatch"):
                GENERATOR.recover_publish_destinations(outputs)
            after=[GENERATOR.directory_bytes(path) for path in [*outputs,*backups]]
            self.assertEqual(before,after)
            self.assertTrue(journal.exists())

    def test_normalizes_singleton_runtime_contracts(self) -> None:
        normalized = GENERATOR.normalize_step_contract({
            "command_contract": {"commandCode": "SAVE"},
            "api_contract": {},
            "handoff_contract": None,
            "test_contract": [],
            "blocker_codes": [],
        })
        self.assertEqual(normalized["command_contract"], [{"commandCode": "SAVE"}])
        self.assertEqual(normalized["api_contract"], [])
        self.assertEqual(normalized["handoff_contract"], {
            "schemaVersion": 1, "contractType": "STEP_HANDOFF", "policy": {}, "transitions": []
        })

    def test_separates_legacy_handoff_policy_from_transitions(self) -> None:
        policy = {"completionType": "EXPLICIT", "snapshotRequired": True}
        normalized_policy = GENERATOR.normalize_step_contract({"handoff_contract": policy})
        self.assertEqual(normalized_policy["handoff_contract"]["policy"], policy)
        self.assertEqual(normalized_policy["handoff_contract"]["transitions"], [])
        transition = {"handoffType": "STEP", "toStepCode": "S2"}
        normalized_transition = GENERATOR.normalize_step_contract({"handoff_contract": [transition]})
        self.assertEqual(normalized_transition["handoff_contract"]["policy"], {})
        self.assertEqual(normalized_transition["handoff_contract"]["transitions"], [transition])

    def test_wraps_io_and_separates_persistence_policy(self) -> None:
        normalized = GENERATOR.normalize_step_contract({
            "input_contract": {"tenantId": "required"},
            "output_contract": {"state": "COMPLETED"},
            "persistence_contract": {"transactional": True, "mappings": [{"primaryEntity": "work"}]},
        })
        self.assertEqual(normalized["input_contract"]["schema"], {"tenantId": "required"})
        self.assertEqual(normalized["output_contract"]["schema"], {"state": "COMPLETED"})
        self.assertEqual(normalized["persistence_contract"]["policy"], {"transactional": True})
        self.assertEqual(normalized["persistence_contract"]["mappings"], [{"primaryEntity": "work"}])

    def test_normalizes_transition_without_changing_states(self) -> None:
        normalized = GENERATOR.normalize_step_contract({
            "transition_contract": {
                "from": "READY", "to": "COMPLETED", "invalidStatesRejected": True,
                "domainHint": "preserve-me",
            },
        })
        transition = normalized["transition_contract"]
        self.assertEqual(transition["contractType"], "STEP_TRANSITION")
        self.assertEqual(transition["fromState"], "READY")
        self.assertEqual(transition["toState"], "COMPLETED")
        self.assertEqual(transition["policy"], {"invalidStatesRejected": True})
        self.assertEqual(transition["guards"], [])
        self.assertEqual(transition["sideEffects"], [])
        self.assertEqual(transition["extensions"], {"domainHint": "preserve-me"})

    def test_normalizes_actor_authority_without_changing_scope(self) -> None:
        normalized = GENERATOR.normalize_step_contract({
            "actor_contract": {
                "actorCode": "VERIFIER", "tenantScoped": True, "projectIsolation": True,
                "segregationRequired": True, "authorityHint": "preserve-me",
            },
        })
        actor = normalized["actor_contract"]
        self.assertEqual(actor["contractType"], "STEP_ACTOR_AUTHORITY")
        self.assertEqual(actor["actorCode"], "VERIFIER")
        self.assertEqual(actor["scope"], "TENANT_PROJECT")
        self.assertEqual(actor["policy"]["tenantIsolation"], True)
        self.assertEqual(actor["policy"]["segregationOfDuties"], True)
        self.assertEqual(actor["permissions"], [])
        self.assertEqual(actor["delegation"], {})
        self.assertEqual(actor["extensions"], {"authorityHint": "preserve-me"})

    def test_normalizes_business_contract_without_losing_policy(self) -> None:
        normalized = GENERATOR.normalize_step_contract({
            "business_contract": {
                "stepName": "자료 검증", "purpose": "원천자료를 검증한다.",
                "completionRule": "오류가 0건이다.", "deliveryAdapterRequired": True,
                "domainHint": "preserve-me",
            },
        })
        business = normalized["business_contract"]
        self.assertEqual(business["contractType"], "STEP_BUSINESS")
        self.assertEqual(business["stepName"], "자료 검증")
        self.assertEqual(business["requirement"], "원천자료를 검증한다.")
        self.assertEqual(business["completionRule"], "오류가 0건이다.")
        self.assertEqual(business["policy"], {"deliveryAdapterRequired": True})
        self.assertEqual(business["preconditions"], [])
        self.assertEqual(business["deliverables"], [])
        self.assertEqual(business["exceptions"], [])
        self.assertEqual(business["extensions"], {"domainHint": "preserve-me"})

    def test_normalizes_guide_contract_without_losing_routes(self) -> None:
        normalized = GENERATOR.normalize_step_contract({
            "guide_contract": {
                "processCode": "P1", "stepCode": "S1", "actorCode": "VERIFIER",
                "title": "검증", "purpose": "자료를 검증한다.", "entryCondition": "SUBMITTED",
                "completion": "오류가 없다.", "userPath": "/work/verify", "nextStep": "runtime-resolved",
                "guideHint": "preserve-me",
            },
        })
        guide = normalized["guide_contract"]
        self.assertEqual(guide["contractType"], "STEP_GUIDE")
        self.assertEqual(guide["completionCondition"], "오류가 없다.")
        self.assertEqual(guide["userPath"], "/work/verify")
        self.assertIsNone(guide["nextStepCode"])
        self.assertEqual(guide["actions"], [])
        self.assertEqual(guide["help"], {})
        self.assertEqual(guide["extensions"], {"guideHint": "preserve-me"})

    def test_normalizes_nonfunctional_contract_without_losing_targets(self) -> None:
        normalized = GENERATOR.normalize_step_contract({
            "actor_contract": {"actorCode": "VERIFIER", "tenantIsolation": True},
            "business_contract": {"slaHours": 8},
            "nonfunctional_contract": {
                "accessibility": "WCAG_2_1_AA", "auditRequired": True,
                "performance": {"targetP95Ms": 320}, "qualityHint": "preserve-me",
            },
        })
        contract = normalized["nonfunctional_contract"]
        self.assertEqual(contract["contractType"], "STEP_NONFUNCTIONAL")
        self.assertEqual(contract["performance"]["targetP95Ms"], 320)
        self.assertTrue(contract["security"]["tenantIsolation"])
        self.assertTrue(contract["audit"]["required"])
        self.assertEqual(contract["sla"]["targetHours"], 8)
        self.assertEqual(contract["extensions"], {"qualityHint": "preserve-me"})

    def test_splits_catalog_group_using_nested_audiences(self) -> None:
        contract = [
            {
                "fields": [
                    {"fieldCode": "adminOnly", "audience": "ADMIN"},
                    {"fieldCode": "userOnly", "audience": "USER"},
                    {"fieldCode": "adminAgain", "audience": "ADMIN"},
                ],
                "schemaSetVersion": 1,
            }
        ]

        grouped = GENERATOR.group_fields_by_audience(contract)

        self.assertEqual(
            [field["fieldCode"] for field in grouped["ADMIN"]],
            ["adminOnly", "adminAgain"],
        )
        self.assertEqual(
            [field["fieldCode"] for field in grouped["USER"]],
            ["userOnly"],
        )
        self.assertEqual([field["code"] for field in grouped["ADMIN"]], ["adminOnly", "adminAgain"])

    def test_normalizes_audience_wrapped_fields_to_runtime_code(self) -> None:
        grouped = GENERATOR.group_fields_by_audience(
            [{"audience": "ADMIN", "fields": [{"fieldCode": "projectId"}]}]
        )
        self.assertEqual(grouped["ADMIN"][0]["code"], "projectId")

    def test_rejects_nested_field_without_audience(self) -> None:
        with self.assertRaisesRegex(SystemExit, "require audience"):
            GENERATOR.group_fields_by_audience(
                [{"fields": [{"fieldCode": "unscoped"}]}]
            )

    def test_normalizes_grouped_persistence_for_common_runtime(self) -> None:
        step = {
            "screen_contract": [{"audience": "USER"}],
            "field_contract": {"schemaVersion": 1, "contractType": "STEP_FIELDS", "fields": [{"fieldCode": "projectId"}]},
            "command_contract": [{"commandCode": "SAVE"}],
            "api_contract": [{"declaredContract": "COMMON"}],
            "persistence_contract": {"schemaVersion": 1, "contractType": "STEP_PERSISTENCE", "policy": {
                "transactional": True, "migrationRequired": True
            }, "mappings": [
                {"audience": "USER", "primaryEntity": "emission_record"},
                {"audience": "ADMIN", "primaryEntity": "emission_record"},
                {"audience": "ADMIN", "primaryEntity": "emission_event"},
            ], "extensions": {
            }},
        }

        persistence = GENERATOR.persistence_for_step(step)

        self.assertEqual(
            persistence["primaryEntities"],
            ["emission_event", "emission_record"],
        )
        self.assertTrue(persistence["historyRequired"])
        self.assertTrue(persistence["indexesRequired"])
        self.assertTrue(persistence["foreignKeysRequired"])


if __name__ == "__main__":
    unittest.main()
