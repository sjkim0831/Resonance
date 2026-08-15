#!/usr/bin/env python3
"""Generate deterministic no-build runtime packages from the approved design.

The input is the JSON returned by framework_process_generation_snapshot().
No business meaning is inferred here: this renderer only projects approved
contracts into shared SDUI, backend-command, persistence and test manifests.
"""

from __future__ import annotations

import argparse
import copy
from concurrent.futures import ThreadPoolExecutor
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import sys
import tempfile
from typing import Any


def fail(message: str) -> None:
    raise SystemExit(f"[full-stack-generator] {message}")


def stable(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def publication_control_paths(destinations: list[Path]) -> tuple[Path, Path]:
    common = Path(os.path.commonpath([str(path.parent) for path in destinations]))
    destination_key = "\n".join(sorted(str(path.resolve(strict=False)) for path in destinations))
    lock_key = hashlib.sha256(destination_key.encode()).hexdigest()[:24]
    journal = common / f".canonical-publish-{lock_key}.journal.json"
    lock = Path(tempfile.gettempdir()) / f"canonical-publish-{lock_key}.lock"
    return journal, lock


@contextlib.contextmanager
def publication_lock(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a+b") as handle:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def write_journal(path: Path, value: dict[str, Any]) -> None:
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            os.fchmod(handle.fileno(), 0o600)
            handle.write(stable(value) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        fsync_directory(path.parent)
    finally:
        temporary.unlink(missing_ok=True)


def recover_journal(path: Path, expected_destinations: set[Path] | None = None) -> bool:
    if not path.exists():
        return False
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        entries = value["entries"]
    except (OSError, json.JSONDecodeError, KeyError, TypeError) as exc:
        fail(f"publish recovery journal is invalid: {exc}")
    if value.get("schema") != "carbonet.atomic-publish-journal/v1" or not isinstance(entries, list):
        fail("publish recovery journal schema is invalid")
    transaction_id = value.get("transactionId")
    if not isinstance(transaction_id, str) or not transaction_id:
        fail("publish recovery transaction id is invalid")
    destinations: set[Path] = set()
    validated: list[tuple[Path, Path, Path, bool, str, str | None]] = []
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) != {"destination", "incoming", "backup", "hadDestination", "stagedHash", "originalHash"}:
            fail("publish recovery entry is invalid")
        destination = Path(entry["destination"])
        incoming = Path(entry["incoming"])
        backup = Path(entry["backup"])
        if not all(path.is_absolute() for path in (destination, incoming, backup)):
            fail("publish recovery paths must be absolute")
        destination = destination.resolve(strict=False)
        if destination in destinations:
            fail("publish recovery destinations must be unique")
        if incoming.parent != destination.parent or backup.parent != destination.parent:
            fail("publish recovery artifact escaped destination parent")
        if (incoming.name != f".{destination.name}.incoming-{transaction_id}"
                or backup.name != f".{destination.name}.backup-{transaction_id}"):
            fail("publish recovery artifact name is invalid")
        for component in (destination, *destination.parents, incoming, backup):
            if component.is_symlink():
                fail("publish recovery path cannot traverse a symlink")
        staged_hash = entry["stagedHash"]
        if not isinstance(staged_hash, str) or len(staged_hash) != 64:
            fail("publish recovery staged hash is invalid")
        original_hash = entry["originalHash"]
        if original_hash is not None and (not isinstance(original_hash, str) or len(original_hash) != 64):
            fail("publish recovery original hash is invalid")
        destinations.add(destination)
        validated.append((destination, incoming, backup, entry["hadDestination"] is True, staged_hash, original_hash))
    for destination in destinations:
        if any(destination in other.parents or other in destination.parents
               for other in destinations if other != destination):
            fail("publish recovery destinations cannot be nested")
    if expected_destinations is not None and destinations != expected_destinations:
        fail("publish recovery destinations do not match the journal")
    committed = value.get("phase") == "COMMITTED"
    committed_mismatch = any(
        not destination.is_dir() or destination.is_symlink() or directory_hash(destination) != staged_hash
        for destination, _, _, _, staged_hash, _ in validated
    ) if committed else False
    if committed_mismatch and any(
        had_destination and (not backup.is_dir() or backup.is_symlink())
        for _, _, backup, had_destination, _, _ in validated
    ):
        fail("committed publish mismatch cannot be rolled back; recovery journal preserved")
    if (committed_mismatch or not committed):
        for destination, _, backup, had_destination, staged_hash, original_hash in validated:
            if backup.exists():
                if original_hash is None or backup.is_symlink() or not backup.is_dir() or directory_hash(backup) != original_hash:
                    fail(f"publish recovery backup hash mismatch: {backup}")
            elif had_destination:
                if not destination.is_dir() or destination.is_symlink() or directory_hash(destination) != original_hash:
                    fail(f"publish recovery cannot prove old destination: {destination}")
            elif destination.exists() and directory_hash(destination) != staged_hash:
                fail(f"publish recovery unexpected new destination: {destination}")
    for destination, incoming, backup, had_destination, staged_hash, original_hash in reversed(validated):
        if committed:
            if committed_mismatch:
                if backup.is_dir() and not backup.is_symlink():
                    shutil.rmtree(destination, ignore_errors=True)
                    os.replace(backup, destination)
                    fsync_directory(destination.parent)
                elif not had_destination:
                    shutil.rmtree(destination, ignore_errors=True)
                    fsync_directory(destination.parent)
                continue
            shutil.rmtree(incoming, ignore_errors=True)
            shutil.rmtree(backup, ignore_errors=True)
            continue
        if backup.exists():
            if destination.exists():
                shutil.rmtree(destination)
            os.replace(backup, destination)
            fsync_directory(destination.parent)
        elif had_destination:
            if not destination.exists() or directory_hash(destination) != original_hash:
                fail(f"publish recovery cannot prove old destination: {destination}")
        elif not had_destination and destination.exists() and not incoming.exists():
            shutil.rmtree(destination)
            fsync_directory(destination.parent)
        shutil.rmtree(incoming, ignore_errors=True)
        shutil.rmtree(backup, ignore_errors=True)
    path.unlink()
    fsync_directory(path.parent)
    if committed_mismatch:
        fail("committed publish hash mismatch was rolled back")
    return True


def recover_publish_destinations(destinations: list[Path]) -> bool:
    resolved = [path.resolve(strict=False) for path in destinations]
    if not resolved:
        fail("recover publish set requires destinations")
    journal, lock = publication_control_paths(resolved)
    with publication_lock(lock):
        return recover_journal(journal, set(resolved))


def maybe_kill(phase: str, index: int) -> None:
    if os.environ.get("CANONICAL_PUBLISH_KILL_AFTER") == f"{phase}:{index}":
        os.kill(os.getpid(), signal.SIGKILL)


def directory_bytes(root: Path) -> dict[str, bytes]:
    if root.is_symlink():
        fail(f"publish tree cannot be a symlink: {root}")
    if not root.is_dir():
        return {}
    result: dict[str, bytes] = {}
    for path in root.rglob("*"):
        if path.is_symlink():
            fail(f"publish tree cannot contain symlinks: {path}")
        if path.is_file():
            result[str(path.relative_to(root)).replace(os.sep, "/")] = path.read_bytes()
    return result


def directory_hash(root: Path) -> str:
    value = hashlib.sha256()
    for relative, content in sorted(directory_bytes(root).items()):
        value.update(relative.encode("utf-8")); value.update(b"\0")
        value.update(hashlib.sha256(content).digest())
    return value.hexdigest()


def validate_publish_pairs(pairs: list[tuple[Path, Path]]) -> list[tuple[Path, Path]]:
    if not pairs:
        fail("publish set requires existing staged directories")
    normalized: list[tuple[Path, Path]] = []
    for staged, destination in pairs:
        for component in (staged.absolute(), *staged.absolute().parents,
                          destination.absolute(), *destination.absolute().parents):
            if component.is_symlink():
                fail(f"publish path cannot traverse a symlink: {component}")
        if staged.is_symlink() or not staged.is_dir():
            fail(f"publish stage must be a real directory: {staged}")
        if destination.is_symlink():
            fail(f"publish destination cannot be a symlink: {destination}")
        staged_resolved = staged.resolve(strict=True)
        destination_resolved = destination.resolve(strict=False)
        if (staged_resolved == destination_resolved
                or staged_resolved in destination_resolved.parents
                or destination_resolved in staged_resolved.parents):
            fail("publish stage and destination cannot be nested")
        normalized.append((staged_resolved, destination_resolved))
    destinations = [destination for _, destination in normalized]
    for index, destination in enumerate(destinations):
        if any(destination == other or destination in other.parents or other in destination.parents
               for other in destinations[index + 1:]):
            fail("publish destinations must be unique and non-nested")
    for staged, _ in normalized:
        directory_bytes(staged)
    return normalized


def publish_directories(pairs: list[tuple[Path, Path]]) -> int:
    """Publish a validated set of directories together, with rollback."""
    pairs = validate_publish_pairs(pairs)
    destinations = [destination for _, destination in pairs]
    journal_path, lock_path = publication_control_paths(destinations)
    with publication_lock(lock_path):
        recover_journal(journal_path, set(destinations))
        return _publish_directories_locked(pairs, journal_path)


def _publish_directories_locked(pairs: list[tuple[Path, Path]], journal_path: Path) -> int:
    changed = [(staged, destination) for staged, destination in pairs
               if directory_bytes(staged) != directory_bytes(destination)]
    if not changed:
        return 0
    transaction_id = f"{os.getpid()}-{os.urandom(8).hex()}"
    prepared: list[tuple[Path, Path, Path]] = []
    activated: list[tuple[Path, Path]] = []
    created_parents: list[Path] = []
    success = False
    try:
        for staged, destination in changed:
            missing: list[Path] = []
            cursor = destination.parent
            while not cursor.exists():
                missing.append(cursor)
                cursor = cursor.parent
            destination.parent.mkdir(parents=True, exist_ok=True)
            created_parents.extend(missing)
            incoming = destination.parent / f".{destination.name}.incoming-{transaction_id}"
            backup = destination.parent / f".{destination.name}.backup-{transaction_id}"
            if incoming.exists() or incoming.is_symlink() or backup.exists() or backup.is_symlink():
                fail("publish recovery artifact already exists")
            incoming.mkdir(mode=0o700)
            prepared.append((destination, incoming, backup))
            shutil.copytree(staged, incoming, dirs_exist_ok=True)
            for copied in incoming.rglob("*"):
                if copied.is_file():
                    with copied.open("rb") as handle:
                        os.fsync(handle.fileno())
            fsync_directory(incoming)
        journal = {
            "schema": "carbonet.atomic-publish-journal/v1",
            "transactionId": transaction_id,
            "phase": "PREPARED",
            "entries": [
                {"destination": str(destination), "incoming": str(incoming),
                 "backup": str(backup), "hadDestination": destination.exists(),
                 "stagedHash": directory_hash(staged),
                 "originalHash": directory_hash(destination) if destination.exists() else None}
                for (staged, _), (destination, incoming, backup) in zip(changed, prepared)
            ],
        }
        write_journal(journal_path, journal)
        for index, (destination, _, backup) in enumerate(prepared, 1):
            journal["phase"] = "BACKING_UP"
            journal["backupIndex"] = index
            write_journal(journal_path, journal)
            if destination.exists():
                os.replace(destination, backup)
                fsync_directory(destination.parent)
            maybe_kill("backup", index)
        for index, (destination, incoming, backup) in enumerate(prepared, 1):
            journal["phase"] = "ACTIVATING"
            journal["activationIndex"] = index
            write_journal(journal_path, journal)
            staged_hash = journal["entries"][index - 1]["stagedHash"]
            if directory_hash(incoming) != staged_hash:
                fail(f"prepared publish tree hash mismatch: {incoming}")
            os.replace(incoming, destination)
            fsync_directory(destination.parent)
            activated.append((destination, backup))
            maybe_kill("activation", index)
        maybe_kill("commit", 0)
        journal["phase"] = "COMMITTED"
        write_journal(journal_path, journal)
        maybe_kill("commit", 1)
        success = True
    except BaseException:
        rollback_ok = True
        try:
            for entry, (destination, _, backup) in zip(journal.get("entries", []), prepared):
                original_hash = entry["originalHash"]
                if backup.exists() and (original_hash is None or directory_hash(backup) != original_hash):
                    raise RuntimeError(f"rollback backup hash mismatch: {backup}")
                if not backup.exists() and original_hash is not None and (
                        not destination.is_dir() or directory_hash(destination) != original_hash):
                    raise RuntimeError(f"rollback original cannot be proven: {destination}")
            for entry, (destination, _, backup) in reversed(list(zip(journal.get("entries", []), prepared))):
                original_hash = entry["originalHash"]
                if backup.exists():
                    if destination.exists():
                        shutil.rmtree(destination, ignore_errors=False)
                    os.replace(backup, destination)
                    fsync_directory(destination.parent)
                elif original_hash is None:
                    if destination.exists():
                        shutil.rmtree(destination, ignore_errors=False)
                elif not destination.exists() or directory_hash(destination) != original_hash:
                    raise RuntimeError(f"rollback original cannot be proven: {destination}")
            if any(entry["originalHash"] is not None and directory_hash(Path(entry["destination"])) != entry["originalHash"]
                   for entry in journal.get("entries", [])):
                raise RuntimeError("rollback verification failed")
        except BaseException:
            rollback_ok = False
        if rollback_ok:
            journal_path.unlink(missing_ok=True)
            fsync_directory(journal_path.parent)
        raise
    finally:
        for destination, incoming, backup in prepared:
            shutil.rmtree(incoming, ignore_errors=True)
        if not success:
            for parent in sorted(set(created_parents), key=lambda path: len(path.parts), reverse=True):
                try:
                    parent.rmdir()
                except OSError:
                    pass
    if success:
        for index, (_, backup) in enumerate(activated, 1):
            shutil.rmtree(backup, ignore_errors=True)
            maybe_kill("cleanup", index)
        journal_path.unlink(missing_ok=True)
        fsync_directory(journal_path.parent)
    return len(changed)


JSON_SCHEMA_KEYS = {
    "$id", "$schema", "additionalProperties", "allOf", "anyOf", "definitions",
    "description", "else", "forbidden", "if", "items", "not", "oneOf",
    "patternProperties", "properties", "required", "then", "title", "type",
}


def input_field_names(schema: dict[str, Any]) -> list[str]:
    """Return client field names from supported legacy and JSON Schema shapes."""
    if not isinstance(schema, dict):
        return []
    embedded = schema.get("contract")
    if isinstance(embedded, str):
        try:
            decoded = json.loads(embedded)
        except json.JSONDecodeError:
            decoded = None
        if isinstance(decoded, dict):
            return input_field_names(decoded)
    properties = schema.get("properties")
    if isinstance(properties, dict):
        return [str(key) for key in properties]
    fields = schema.get("fields")
    if isinstance(fields, list):
        return [
            str(item.get("fieldCode")) for item in fields
            if isinstance(item, dict) and item.get("fieldCode")
        ]
    required = schema.get("required")
    if isinstance(required, list):
        return [str(value) for value in required if isinstance(value, str) and value]
    return [str(key) for key in schema if key not in JSON_SCHEMA_KEYS]


def projected_input_field(field_code: str, audience: str, order: int) -> dict[str, Any]:
    """Project an approved input name into the common SDUI field vocabulary."""
    return {
        "fieldCode": field_code, "code": field_code, "fieldName": field_code,
        "fieldGroup": "업무 입력", "fieldOrder": order, "dataType": "STRING",
        "controlType": "TEXT", "editable": True, "required": True,
        "validation": {"required": True}, "mappingStatus": "CONTRACT_PROJECTED",
        "privacyClass": "INTERNAL", "audience": audience,
    }


def load(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"invalid snapshot: {exc}")
    if data.get("schemaVersion") != "2.0.0" or not isinstance(data.get("processes"), list):
        fail("snapshot schemaVersion/processes is invalid")
    return data


def validate_step(process: dict[str, Any], step: dict[str, Any]) -> None:
    identity = f"{process.get('processCode')}/{step.get('step_code')}"
    required_objects = (
        "actor_contract", "business_contract", "transition_contract", "input_contract",
        "output_contract", "handoff_contract", "guide_contract", "nonfunctional_contract",
    )
    required_arrays = (
        "command_contract", "api_contract",
        "test_contract", "blocker_codes",
    )
    for key in required_objects:
        if not isinstance(step.get(key), dict):
            fail(f"{identity}: {key} must be an object")
    actor_contract = step["actor_contract"]
    if (actor_contract.get("contractType") != "STEP_ACTOR_AUTHORITY"
            or not isinstance(actor_contract.get("actorCode"), str)
            or not actor_contract["actorCode"]
            or actor_contract.get("scope") not in {"GLOBAL", "TENANT", "PROJECT", "TENANT_PROJECT"}
            or not isinstance(actor_contract.get("policy"), dict)
            or not isinstance(actor_contract.get("permissions"), list)
            or not isinstance(actor_contract.get("delegation"), dict)
            or not isinstance(actor_contract.get("extensions"), dict)):
        fail(f"{identity}: actor_contract must be a STEP_ACTOR_AUTHORITY object")
    business_contract = step["business_contract"]
    if (business_contract.get("contractType") != "STEP_BUSINESS"
            or not isinstance(business_contract.get("stepName"), str)
            or not business_contract["stepName"]
            or not isinstance(business_contract.get("requirement"), str)
            or not business_contract["requirement"]
            or not isinstance(business_contract.get("completionRule"), str)
            or not business_contract["completionRule"]
            or not isinstance(business_contract.get("preconditions"), list)
            or not isinstance(business_contract.get("deliverables"), list)
            or not isinstance(business_contract.get("exceptions"), list)
            or not isinstance(business_contract.get("policy"), dict)
            or not isinstance(business_contract.get("extensions"), dict)):
        fail(f"{identity}: business_contract must be a STEP_BUSINESS object")
    guide_contract = step["guide_contract"]
    if (guide_contract.get("contractType") != "STEP_GUIDE"
            or not isinstance(guide_contract.get("processCode"), str)
            or not guide_contract["processCode"]
            or not isinstance(guide_contract.get("stepCode"), str)
            or not guide_contract["stepCode"]
            or not isinstance(guide_contract.get("actorCode"), str)
            or not guide_contract["actorCode"]
            or not isinstance(guide_contract.get("title"), str)
            or not guide_contract["title"]
            or not isinstance(guide_contract.get("purpose"), str)
            or not guide_contract["purpose"]
            or not isinstance(guide_contract.get("entryCondition"), str)
            or not guide_contract["entryCondition"]
            or not isinstance(guide_contract.get("completionCondition"), str)
            or not guide_contract["completionCondition"]
            or not isinstance(guide_contract.get("actions"), list)
            or not isinstance(guide_contract.get("help"), dict)
            or not isinstance(guide_contract.get("policy"), dict)
            or not isinstance(guide_contract.get("extensions"), dict)):
        fail(f"{identity}: guide_contract must be a STEP_GUIDE object")
    transition_contract = step["transition_contract"]
    if (transition_contract.get("contractType") != "STEP_TRANSITION"
            or not isinstance(transition_contract.get("fromState"), str)
            or not transition_contract["fromState"]
            or not isinstance(transition_contract.get("toState"), str)
            or not transition_contract["toState"]
            or not isinstance(transition_contract.get("policy"), dict)
            or not isinstance(transition_contract.get("guards"), list)
            or not isinstance(transition_contract.get("sideEffects"), list)
            or not isinstance(transition_contract.get("extensions"), dict)):
        fail(f"{identity}: transition_contract must be a STEP_TRANSITION object")
    if step["input_contract"].get("contractType") != "STEP_INPUT" or not isinstance(step["input_contract"].get("schema"), dict):
        fail(f"{identity}: input_contract must be a STEP_INPUT object")
    if step["output_contract"].get("contractType") != "STEP_OUTPUT" or not isinstance(step["output_contract"].get("schema"), dict):
        fail(f"{identity}: output_contract must be a STEP_OUTPUT object")
    persistence_contract = step["persistence_contract"]
    if persistence_contract.get("contractType") != "STEP_PERSISTENCE" or not isinstance(persistence_contract.get("policy"), dict) or not isinstance(persistence_contract.get("mappings"), list) or not isinstance(persistence_contract.get("extensions"), dict):
        fail(f"{identity}: persistence_contract must be a STEP_PERSISTENCE object")
    for key in required_arrays:
        if not isinstance(step.get(key), list):
            fail(f"{identity}: {key} must be an array")
    if not isinstance(step.get("screen_contract"), (list, dict)):
        fail(f"{identity}: screen_contract must be an array or path contract object")
    field_contract = step.get("field_contract")
    if not isinstance(field_contract, dict) or field_contract.get("contractType") != "STEP_FIELDS" or not isinstance(field_contract.get("fields"), list):
        fail(f"{identity}: field_contract must be a STEP_FIELDS object")
    handoff_contract = step.get("handoff_contract")
    if handoff_contract.get("contractType") != "STEP_HANDOFF" or not isinstance(handoff_contract.get("policy"), dict) or not isinstance(handoff_contract.get("transitions"), list):
        fail(f"{identity}: handoff_contract must be a STEP_HANDOFF object")
    if step.get("design_status") != "DESIGN_COMPLETE" or step["blocker_codes"]:
        fail(f"{identity}: design is blocked: {step.get('blocker_codes')}")
    nonfunctional = step["nonfunctional_contract"]
    if (nonfunctional.get("contractType") != "STEP_NONFUNCTIONAL"
            or not all(isinstance(nonfunctional.get(key), dict) for key in (
                "security", "performance", "accessibility", "responsive", "recovery", "audit", "sla", "policy", "extensions"))
            or not isinstance(nonfunctional["performance"].get("targetP95Ms"), int)
            or nonfunctional["performance"]["targetP95Ms"] <= 0
            or not isinstance(nonfunctional["accessibility"].get("standard"), str)
            or not nonfunctional["accessibility"]["standard"]):
        fail(f"{identity}: nonfunctional_contract must be a STEP_NONFUNCTIONAL object")


def normalize_step_contract(step: dict[str, Any]) -> dict[str, Any]:
    """Normalize singleton JSON contracts before deterministic validation.

    PostgreSQL stores command/API/test contracts as JSONB and older approved
    rows may contain one object instead of a one-item array. This is a shape
    normalization only; it never invents fields, actions, or business rules.
    """
    normalized = copy.deepcopy(step)
    guide = normalized.get("guide_contract")
    if not isinstance(guide, dict):
        guide = {}
    guide_core_keys = {
        "schemaVersion", "contractType", "processCode", "stepCode", "stepOrder", "workTypeCode",
        "actorCode", "title", "purpose", "entryCondition", "completionCondition", "completion",
        "userPath", "adminPath", "relatedBusinessRoute", "nextStepCode", "nextStep", "nextAction",
        "actions", "help", "policy", "extensions",
    }
    normalized["guide_contract"] = {
        "schemaVersion": 1,
        "contractType": "STEP_GUIDE",
        "processCode": guide.get("processCode"),
        "stepCode": guide.get("stepCode"),
        "stepOrder": guide.get("stepOrder"),
        "workTypeCode": guide.get("workTypeCode"),
        "actorCode": guide.get("actorCode"),
        "title": guide.get("title"),
        "purpose": guide.get("purpose"),
        "entryCondition": guide.get("entryCondition"),
        "completionCondition": guide.get("completionCondition") or guide.get("completion"),
        "userPath": guide.get("userPath"),
        "adminPath": guide.get("adminPath"),
        "relatedBusinessRoute": guide.get("relatedBusinessRoute"),
        "nextStepCode": guide.get("nextStepCode") or (guide.get("nextStep") if guide.get("nextStep") != "runtime-resolved" else None),
        "nextAction": guide.get("nextAction"),
        "actions": guide.get("actions") if isinstance(guide.get("actions"), list) else [],
        "help": guide.get("help") if isinstance(guide.get("help"), dict) else {},
        "policy": guide.get("policy") if isinstance(guide.get("policy"), dict) else {},
        "extensions": (guide.get("extensions") if guide.get("contractType") == "STEP_GUIDE" and isinstance(guide.get("extensions"), dict)
                       else {key: value for key, value in guide.items() if key not in guide_core_keys}),
    }
    business = normalized.get("business_contract")
    if not isinstance(business, dict):
        business = {}
    business_policy_keys = {"deliveryAdapterRequired", "browserOnlyVerificationForbidden"}
    business_core_keys = {
        "schemaVersion", "contractType", "domainCode", "processName", "stepName", "goal", "requirement",
        "purpose", "completionRule", "riskLevel", "slaHours", "regulationRefs", "preconditions",
        "deliverables", "exceptions", "policy", "extensions",
    }
    normalized["business_contract"] = {
        "schemaVersion": 1,
        "contractType": "STEP_BUSINESS",
        "domainCode": business.get("domainCode"),
        "processName": business.get("processName"),
        "stepName": business.get("stepName"),
        "goal": business.get("goal"),
        "requirement": business.get("requirement") or business.get("purpose"),
        "completionRule": business.get("completionRule"),
        "riskLevel": business.get("riskLevel"),
        "slaHours": business.get("slaHours"),
        "regulationRefs": business.get("regulationRefs"),
        "preconditions": business.get("preconditions") if isinstance(business.get("preconditions"), list) else [],
        "deliverables": business.get("deliverables") if isinstance(business.get("deliverables"), list) else [],
        "exceptions": business.get("exceptions") if isinstance(business.get("exceptions"), list) else [],
        "policy": (business.get("policy") if business.get("contractType") == "STEP_BUSINESS" and isinstance(business.get("policy"), dict)
                   else {key: business[key] for key in business_policy_keys if key in business}),
        "extensions": (business.get("extensions") if business.get("contractType") == "STEP_BUSINESS" and isinstance(business.get("extensions"), dict)
                       else {key: value for key, value in business.items() if key not in business_core_keys | business_policy_keys}),
    }
    actor = normalized.get("actor_contract")
    if not isinstance(actor, dict):
        actor = {}
    actor_policy_keys = {
        "assignmentRequired", "serverAuthorization", "tenantIsolation", "tenantScoped",
        "projectIsolation", "delegationChecked", "segregationOfDuties", "segregationRequired",
    }
    actor_core_keys = {
        "schemaVersion", "contractType", "actorCode", "ownerActorCode", "scope", "policy",
        "permissions", "delegation", "extensions",
    }
    tenant_isolated = actor.get("tenantIsolation", actor.get("tenantScoped", False)) is True
    project_isolated = actor.get("projectIsolation", False) is True
    derived_scope = "TENANT_PROJECT" if tenant_isolated and project_isolated else "TENANT" if tenant_isolated else "PROJECT" if project_isolated else "GLOBAL"
    if actor.get("contractType") == "STEP_ACTOR_AUTHORITY" and isinstance(actor.get("policy"), dict):
        actor_policy = actor["policy"]
    else:
        actor_policy = {key: actor[key] for key in actor_policy_keys if key in actor}
        if "tenantScoped" in actor_policy:
            actor_policy.setdefault("tenantIsolation", actor_policy["tenantScoped"])
            actor_policy.pop("tenantScoped")
        if "segregationRequired" in actor_policy:
            actor_policy.setdefault("segregationOfDuties", actor_policy["segregationRequired"])
            actor_policy.pop("segregationRequired")
    normalized["actor_contract"] = {
        "schemaVersion": 1,
        "contractType": "STEP_ACTOR_AUTHORITY",
        "actorCode": actor.get("actorCode"),
        "ownerActorCode": actor.get("ownerActorCode"),
        "scope": actor.get("scope") or derived_scope,
        "policy": actor_policy,
        "permissions": actor.get("permissions") if isinstance(actor.get("permissions"), list) else [],
        "delegation": actor.get("delegation") if isinstance(actor.get("delegation"), dict) else {},
        "extensions": (actor.get("extensions") if actor.get("contractType") == "STEP_ACTOR_AUTHORITY" and isinstance(actor.get("extensions"), dict)
                       else {key: value for key, value in actor.items() if key not in actor_core_keys | actor_policy_keys}),
    }
    transition = normalized.get("transition_contract")
    if not isinstance(transition, dict):
        transition = {}
    transition_policy_keys = {"optimisticLock", "idempotencyRequired", "auditRequired", "invalidStatesRejected"}
    transition_core_keys = {
        "schemaVersion", "contractType", "commandCode", "fromState", "from", "toState", "to",
        "stepOrder", "stepType", "parentStepCode", "completionRule", "policy", "guards",
        "sideEffects", "extensions",
    }
    normalized["transition_contract"] = {
        "schemaVersion": 1,
        "contractType": "STEP_TRANSITION",
        "commandCode": transition.get("commandCode"),
        "fromState": transition.get("fromState", transition.get("from")),
        "toState": transition.get("toState", transition.get("to")),
        "stepOrder": transition.get("stepOrder"),
        "stepType": transition.get("stepType"),
        "parentStepCode": transition.get("parentStepCode"),
        "completionRule": transition.get("completionRule"),
        "policy": (transition.get("policy") if transition.get("contractType") == "STEP_TRANSITION" and isinstance(transition.get("policy"), dict)
                   else {key: transition[key] for key in transition_policy_keys if key in transition}),
        "guards": transition.get("guards") if isinstance(transition.get("guards"), list) else [],
        "sideEffects": transition.get("sideEffects") if isinstance(transition.get("sideEffects"), list) else [],
        "extensions": (transition.get("extensions") if transition.get("contractType") == "STEP_TRANSITION" and isinstance(transition.get("extensions"), dict)
                       else {key: value for key, value in transition.items() if key not in transition_core_keys | transition_policy_keys}),
    }
    for key, contract_type in (("input_contract", "STEP_INPUT"), ("output_contract", "STEP_OUTPUT")):
        value = normalized.get(key)
        if not isinstance(value, dict):
            value = {}
        if value.get("contractType") == contract_type and isinstance(value.get("schema"), dict):
            normalized[key] = {"schemaVersion": 1, "contractType": contract_type, "schema": value["schema"]}
        else:
            normalized[key] = {"schemaVersion": 1, "contractType": contract_type, "schema": value}
    persistence = normalized.get("persistence_contract")
    if not isinstance(persistence, dict):
        persistence = {}
    if persistence.get("contractType") == "STEP_PERSISTENCE":
        normalized["persistence_contract"] = {
            "schemaVersion": 1, "contractType": "STEP_PERSISTENCE",
            "schemaSetVersion": persistence.get("schemaSetVersion"),
            "policy": persistence.get("policy") if isinstance(persistence.get("policy"), dict) else {},
            "mappings": persistence.get("mappings") if isinstance(persistence.get("mappings"), list) else [],
            "extensions": persistence.get("extensions") if isinstance(persistence.get("extensions"), dict) else {},
        }
    else:
        policy_keys = {"transactional", "migrationRequired", "optimisticLock", "tenantIsolated", "projectIsolated"}
        normalized["persistence_contract"] = {
            "schemaVersion": 1, "contractType": "STEP_PERSISTENCE",
            "schemaSetVersion": persistence.get("schemaSetVersion"),
            "policy": {key: persistence[key] for key in policy_keys if key in persistence},
            "mappings": persistence.get("mappings") if isinstance(persistence.get("mappings"), list) else [],
            "extensions": {key: value for key, value in persistence.items() if key not in policy_keys | {"schemaSetVersion", "mappings"}},
        }
    for key in ("command_contract", "api_contract", "test_contract", "blocker_codes"):
        value = normalized.get(key)
        if isinstance(value, dict):
            normalized[key] = [value] if value else []
        elif value is None:
            normalized[key] = []
    handoff = normalized.get("handoff_contract")
    if isinstance(handoff, list):
        normalized["handoff_contract"] = {"schemaVersion": 1, "contractType": "STEP_HANDOFF", "policy": {}, "transitions": handoff}
    elif isinstance(handoff, dict) and handoff.get("contractType") == "STEP_HANDOFF":
        normalized["handoff_contract"] = {
            "schemaVersion": 1, "contractType": "STEP_HANDOFF",
            "policy": handoff.get("policy") if isinstance(handoff.get("policy"), dict) else {},
            "transitions": handoff.get("transitions") if isinstance(handoff.get("transitions"), list) else [],
        }
    elif isinstance(handoff, dict):
        normalized["handoff_contract"] = {"schemaVersion": 1, "contractType": "STEP_HANDOFF", "policy": handoff, "transitions": []}
    else:
        normalized["handoff_contract"] = {"schemaVersion": 1, "contractType": "STEP_HANDOFF", "policy": {}, "transitions": []}
    nonfunctional = normalized.get("nonfunctional_contract")
    if not isinstance(nonfunctional, dict):
        nonfunctional = {}
    security = nonfunctional.get("security") if isinstance(nonfunctional.get("security"), dict) else {}
    performance = nonfunctional.get("performance") if isinstance(nonfunctional.get("performance"), dict) else {}
    accessibility = nonfunctional.get("accessibility") if isinstance(nonfunctional.get("accessibility"), dict) else {}
    responsive = nonfunctional.get("responsive") if isinstance(nonfunctional.get("responsive"), dict) else {}
    recovery = nonfunctional.get("recovery") if isinstance(nonfunctional.get("recovery"), dict) else {}
    audit = nonfunctional.get("audit") if isinstance(nonfunctional.get("audit"), dict) else {}
    sla = nonfunctional.get("sla") if isinstance(nonfunctional.get("sla"), dict) else {}
    actor_policy = normalized["actor_contract"]["policy"]
    actor_scope = normalized["actor_contract"].get("scope")
    business_sla = normalized["business_contract"].get("slaHours")
    nonfunctional_core_keys = {
        "schemaVersion", "contractType", "security", "performance", "accessibility", "responsive",
        "recovery", "audit", "sla", "policy", "extensions", "auditRequired", "wcag",
        "genericResponseTiming", "rateLimitRequired", "secretLoggingForbidden", "sensitiveValueMasking",
    }
    normalized["nonfunctional_contract"] = {
        "schemaVersion": 1,
        "contractType": "STEP_NONFUNCTIONAL",
        "security": {
            "tenantIsolation": bool(security.get("tenantIsolation") or actor_policy.get("tenantIsolation") or actor_scope in {"TENANT", "TENANT_PROJECT"}),
            "projectIsolation": bool(security.get("projectIsolation") or actor_policy.get("projectIsolation") or actor_scope in {"PROJECT", "TENANT_PROJECT"}),
            "serverAuthorization": security.get("serverAuthorization", actor_policy.get("serverAuthorization", True)),
            "segregationOfDuties": security.get("segregationOfDuties", actor_policy.get("segregationOfDuties", False)),
            "rateLimitRequired": security.get("rateLimitRequired", nonfunctional.get("rateLimitRequired", False)),
            "secretLoggingForbidden": security.get("secretLoggingForbidden", nonfunctional.get("secretLoggingForbidden", True)),
            "sensitiveValueMasking": security.get("sensitiveValueMasking", nonfunctional.get("sensitiveValueMasking", True)),
        },
        "performance": {
            "targetP95Ms": performance.get("targetP95Ms", 500),
            "paginationRequired": performance.get("paginationRequired", True),
            "searchIndexRequired": performance.get("searchIndexRequired", True),
        },
        "accessibility": {
            "standard": accessibility.get("standard") or nonfunctional.get("accessibility") or nonfunctional.get("wcag") or "WCAG 2.1 AA",
            "keyboard": accessibility.get("keyboard", True),
            "focus": accessibility.get("focus", True),
            "errorSummary": accessibility.get("errorSummary", True),
        },
        "responsive": {
            "mobile": responsive.get("mobile", "single-column"),
            "tablet": responsive.get("tablet", "adaptive-two-column"),
            "desktop": responsive.get("desktop", "task-optimized"),
            "noTextOverflow": responsive.get("noTextOverflow", True),
        },
        "recovery": {
            "retry": recovery.get("retry", "idempotent-only"),
            "resumeFromLastVerifiedState": recovery.get("resumeFromLastVerifiedState", True),
            "idempotencyRequired": recovery.get("idempotencyRequired", True),
        },
        "audit": {
            "required": audit.get("required", security.get("auditRequired", security.get("audit", nonfunctional.get("auditRequired", True)))),
            "actorRecorded": audit.get("actorRecorded", True),
            "beforeAfterRecorded": audit.get("beforeAfterRecorded", True),
            "correlationIdRequired": audit.get("correlationIdRequired", True),
        },
        "sla": {
            "configured": business_sla is not None,
            "targetHours": business_sla,
            "timerStartsAt": sla.get("timerStartsAt", "STEP_ASSIGNED"),
            "timerStopsAt": sla.get("timerStopsAt", "STEP_COMPLETED"),
            "breachAlertRequired": sla.get("breachAlertRequired", True),
        },
        "policy": nonfunctional.get("policy") if isinstance(nonfunctional.get("policy"), dict) else {},
        "extensions": (nonfunctional.get("extensions") if nonfunctional.get("contractType") == "STEP_NONFUNCTIONAL" and isinstance(nonfunctional.get("extensions"), dict)
                       else {key: value for key, value in nonfunctional.items() if key not in nonfunctional_core_keys}),
    }
    return normalized


def group_fields_by_audience(field_contract: dict[str, Any] | list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Accept both legacy audience groups and the current flat field contract.

    Structured professional contracts store one field per array item and apply
    that list to every screen unless a field declares an audience. Older
    contracts wrap fields in ``{"audience": ..., "fields": [...]}``. Some
    catalog contracts group fields before audience partitioning, so the wrapper
    has no audience while every nested field does. Split that shape by the
    nested audience instead of rejecting otherwise complete governed designs.
    Keeping all three forms deterministic lets immutable, already-applied
    contracts and new contracts share the same generator.
    """
    grouped: dict[str, list[dict[str, Any]]] = {}
    shared: list[dict[str, Any]] = []
    items = field_contract.get("fields", []) if isinstance(field_contract, dict) else field_contract
    for item in items:
        if not isinstance(item, dict):
            fail("field_contract entries must be objects")
        nested_fields = item.get("fields")
        if isinstance(nested_fields, list):
            audience = item.get("audience")
            if isinstance(audience, str) and audience:
                normalized_fields = []
                for nested_field in nested_fields:
                    if not isinstance(nested_field, dict) or "fieldCode" not in nested_field:
                        fail("grouped field_contract entries require fieldCode")
                    normalized_field = dict(nested_field)
                    normalized_field.setdefault("code", normalized_field["fieldCode"])
                    normalized_fields.append(normalized_field)
                grouped.setdefault(audience, []).extend(normalized_fields)
                continue
            for nested_field in nested_fields:
                if not isinstance(nested_field, dict):
                    fail("grouped field_contract fields must be objects")
                nested_audience = nested_field.get("audience")
                if not isinstance(nested_audience, str) or not nested_audience:
                    fail("grouped field_contract entries require audience")
                if "fieldCode" not in nested_field:
                    fail("grouped field_contract entries require fieldCode")
                normalized_field = dict(nested_field)
                normalized_field.setdefault("code", normalized_field["fieldCode"])
                grouped.setdefault(nested_audience, []).append(normalized_field)
            continue
        if "fieldCode" not in item:
            fail("flat field_contract entries require fieldCode")
        item = dict(item)
        item.setdefault("code", item["fieldCode"])
        audience = item.get("audience")
        if audience is None:
            shared.append(item)
        elif isinstance(audience, str) and audience:
            grouped.setdefault(audience, []).append(item)
        else:
            fail("field_contract audience must be a non-empty string")
    if shared:
        grouped["*"] = shared
    return grouped


def screens_for_step(step: dict[str, Any], shared_screens: list[dict[str, Any]]) -> list[dict[str, Any]]:
    # Keep this projector safe when called directly by policy/preflight tests.
    # The full generator normalizes contracts before this function, while the
    # lightweight deployment validator intentionally passes a minimal fixture.
    nonfunctional = step.get("nonfunctional_contract")
    if not isinstance(nonfunctional, dict):
        nonfunctional = {}
    responsive_default = nonfunctional.get("responsive")
    if not isinstance(responsive_default, dict):
        responsive_default = {
            "mobile": "single-column", "tablet": "adaptive-two-column",
            "desktop": "task-optimized", "noTextOverflow": True,
        }
    accessibility_default = nonfunctional.get("accessibility")
    if not isinstance(accessibility_default, dict):
        accessibility_default = {
            "standard": "WCAG 2.1 AA", "keyboard": True,
            "focus": True, "errorSummary": True,
        }
    screens = step["screen_contract"]
    if isinstance(screens, list) and screens:
        expanded: list[dict[str, Any]] = []
        for screen in screens:
            if not isinstance(screen, dict):
                fail("screen_contract entries must be objects")
            if screen.get("audience") in {"USER", "ADMIN"}:
                audience = screen["audience"]
                normalized_screen = copy.deepcopy(screen)
                route = (normalized_screen.get("actualRoute") or normalized_screen.get("plannedRoute")
                         or normalized_screen.get("adminPath" if audience == "ADMIN" else "userPath")
                         or step["guide_contract"].get("adminPath" if audience == "ADMIN" else "userPath"))
                normalized_screen.setdefault("pageCode", f"{step['step_code']}_{audience}_WORKSPACE")
                normalized_screen.setdefault("plannedRoute", route)
                normalized_screen.setdefault("actualRoute", route)
                normalized_screen.setdefault("routeStatus", "IMPLEMENTED" if isinstance(route, str) and route.startswith("/") else "PLANNED")
                normalized_screen.setdefault("screenType", "WORKSPACE")
                normalized_screen.setdefault("title", step["business_contract"]["stepName"])
                normalized_screen.setdefault("purpose", step["business_contract"]["requirement"])
                normalized_screen.setdefault("exceptions", [])
                normalized_screen.setdefault("responsive", responsive_default)
                normalized_screen.setdefault("accessibility", accessibility_default)
                expanded.append(normalized_screen)
                continue
            # The compact SDUI contract stores the two governed entry points in
            # one object. Expand it deterministically instead of borrowing a
            # sibling page or requiring generated page metadata in the DB.
            if set(screen).issubset({"userPath", "adminPath"}):
                for audience, route_key in (("USER", "userPath"), ("ADMIN", "adminPath")):
                    route = screen.get(route_key)
                    if not isinstance(route, str) or not route.startswith("/"):
                        continue
                    responsive = responsive_default
                    accessibility = accessibility_default
                    expanded.append({
                        "pageCode": f"{step['step_code']}_{audience}_WORKSPACE",
                        "plannedRoute": route,
                        "actualRoute": route,
                        "routeStatus": "IMPLEMENTED",
                        "audience": audience,
                        "screenType": "WORKSPACE",
                        "title": step["business_contract"]["stepName"],
                        "purpose": step["business_contract"]["requirement"],
                        "exceptions": [],
                        "responsive": responsive,
                        "accessibility": accessibility,
                    })
                continue
            # Section/component descriptors belong to the page body; page
            # identity still comes from the governed guide routes below.
        if expanded:
            return expanded
    # An approved API/database-only step has no page or field contract. Do not
    # invent a UI by borrowing a sibling screen merely because a guide route is
    # present for navigation context.
    if not step["field_contract"]:
        return []
    guide = step["guide_contract"]
    projected: list[dict[str, Any]] = []
    for audience in ("USER", "ADMIN"):
        route_key = "adminPath" if audience == "ADMIN" else "userPath"
        route = guide.get(route_key)
        if not isinstance(route, str) or not route.startswith("/"):
            continue
        projected.append({
            "pageCode": f"{step['step_code']}_{audience}_WORKSPACE",
            "title": step["business_contract"]["stepName"],
            "purpose": step["business_contract"]["requirement"],
            "plannedRoute": route,
            "actualRoute": route,
            "routeStatus": "IMPLEMENTED",
            "audience": audience,
            "screenType": "WORKSPACE",
            "exceptions": [],
            "responsive": responsive_default,
            "accessibility": accessibility_default,
        })
    if projected:
        return projected
    # Some process archetypes intentionally use one orchestration workspace
    # for every step. Reuse that explicitly registered route for sibling steps
    # instead of inventing a new URL or emitting a page-less package.
    for screen in shared_screens:
        if not isinstance(screen, dict) or screen.get("audience") not in {"USER", "ADMIN"}:
            continue
        route = screen.get("actualRoute") or screen.get("plannedRoute")
        if not isinstance(route, str) or not route.startswith("/"):
            continue
        audience = screen["audience"]
        projected.append({
            "pageCode": f"{step['step_code']}_{audience}_WORKSPACE",
            "title": step["business_contract"]["stepName"],
            "purpose": step["business_contract"]["requirement"],
            "plannedRoute": route,
            "actualRoute": route,
            "routeStatus": screen.get("routeStatus", "IMPLEMENTED"),
            "audience": audience,
            "screenType": screen.get("screenType", "PROCESS_ORCHESTRATION"),
            "exceptions": screen.get("exceptions", []),
            "responsive": screen.get("responsive", responsive_default),
            "accessibility": screen.get("accessibility", accessibility_default),
        })
    return projected


def persistence_for_step(step: dict[str, Any]) -> dict[str, Any]:
    """Apply the shared command-runtime persistence contract when appropriate.

    Backend-only approved steps intentionally have no screen field contract,
    but they still persist state, draft payloads, and immutable events through
    the common process runtime.  Treating an empty ``primaryEntities`` array as
    a complete database design made the DATABASE lane impossible to verify.
    This default adds no domain meaning; it only declares the already selected
    COMMON_PROCESS_COMMAND_RUNTIME storage boundary.
    """
    contract = step["persistence_contract"]
    persistence = copy.deepcopy(contract.get("extensions", {}))
    persistence.update(copy.deepcopy(contract.get("policy", {})))
    persistence["mappings"] = copy.deepcopy(contract.get("mappings", []))
    if contract.get("schemaSetVersion") is not None:
        persistence["schemaSetVersion"] = contract["schemaSetVersion"]
    mappings = persistence.get("mappings")
    if isinstance(mappings, list) and not persistence.get("primaryEntities"):
        primary_entities = sorted({
            mapping.get("primaryEntity")
            for mapping in mappings
            if isinstance(mapping, dict)
            and isinstance(mapping.get("primaryEntity"), str)
            and mapping["primaryEntity"]
        })
        if primary_entities:
            persistence["primaryEntities"] = primary_entities
    if step["command_contract"]:
        # The selected common command runtime always wraps state changes in a
        # transaction. Preserve an explicit false so an invalid approved
        # design still fails instead of being silently promoted.
        persistence.setdefault("transactional", True)
        persistence.setdefault("historyRequired", True)
        # The common command runtime persists mutable workflow state and its
        # immutable event history. Every generated database contract therefore
        # requires lookup indexes and validated relationships, even when older
        # design rows predate these explicit flags.
        persistence.setdefault("indexesRequired", True)
        persistence.setdefault("foreignKeysRequired", True)
    if (
        not step["screen_contract"]
        and not step["field_contract"]
        and step["command_contract"]
        and step["api_contract"]
        and persistence.get("migrationRequired") is True
        and not persistence.get("primaryEntities")
    ):
        persistence["primaryEntities"] = [
            "framework_process_execution",
            "framework_process_execution_event",
            "framework_process_work_draft",
        ]
        persistence["fieldMappings"] = [
            {"contextKey": "tenantId", "entity": "framework_process_execution", "column": "tenant_id"},
            {"contextKey": "projectId", "entity": "framework_process_execution", "column": "project_id"},
            {"contextKey": "recordId", "entity": "framework_process_execution", "column": "execution_id"},
            {"contextKey": "statusCode", "entity": "framework_process_execution", "column": "current_state"},
            {"contextKey": "rowVersion", "entity": "framework_process_work_draft", "column": "draft_version"},
            {"contextKey": "payload", "entity": "framework_process_work_draft", "column": "payload_json"},
        ]
        persistence["contractSource"] = "COMMON_PROCESS_COMMAND_RUNTIME"
    return persistence


def apis_for_step(step: dict[str, Any]) -> list[dict[str, Any]]:
    """Normalize legacy references to the selected common command API."""
    apis = copy.deepcopy(step["api_contract"])
    if step["command_contract"]:
        for api in apis:
            if not api.get("path") and not api.get("declaredContract"):
                api["declaredContract"] = "COMMON_PROCESS_EXECUTION_RUNTIME_V1"
                api.setdefault("method", "CONTRACT")
    return apis


def commands_for_step(step: dict[str, Any]) -> list[dict[str, Any]]:
    """Bind compact commands to the approved actor and transition contract."""
    commands = copy.deepcopy(step["command_contract"])
    actor = step["actor_contract"]["actorCode"]
    transition = step["transition_contract"]
    for command in commands:
        command.setdefault("commandCode", transition["commandCode"])
        command.setdefault("actorCode", actor)
        command.setdefault("serverAuthorization", True)
        command.setdefault("entryState", transition["fromState"])
        command.setdefault("resultState", transition["toState"])
        command.setdefault("idempotencyRequired", True)
    return commands


def tests_for_step(process: dict[str, Any], step: dict[str, Any]) -> list[dict[str, Any]]:
    """Materialize executable cases from the approved compact test policy.

    These are test definitions, not pass evidence. LIVE_SMOKE remains mandatory
    before a generated package can promote a screen or process to VERIFIED.
    """
    executable = [
        case for case in step["test_contract"]
        if case.get("status") in {"APPROVED", "VERIFIED"}
        and case.get("steps") and case.get("assertions")
    ]
    existing_types = {case.get("type") for case in executable}
    declared = set()
    for policy in step["test_contract"]:
        if not isinstance(policy, dict):
            continue
        declared.update(value for value in policy.get("requiredTypes", []) if isinstance(value, str))
        if isinstance(policy.get("type"), str):
            declared.add(policy["type"])
    if not declared and not executable:
        return []
    scenario_sources = {
        "HAPPY_PATH": "HAPPY_PATH",
        "EXCEPTION": "VALIDATION_ERROR",
        "AUTHORITY": "FORBIDDEN",
        "ISOLATION": "CONFLICT",
        "RECOVERY": "RECOVERY",
    }
    cases = list(executable)
    for scenario, source in scenario_sources.items():
        if scenario in existing_types:
            continue
        cases.append({
            "caseCode": f"{process['processCode']}_{step['step_code']}_{scenario}",
            "name": f"{step['business_contract']['stepName']} {scenario}",
            "type": scenario,
            "status": "APPROVED",
            "sourceRequirement": source if source in declared else scenario,
            "steps": [{
                "executor": "FAST_PROCESS_CONTRACT_RUNNER",
                "processCode": process["processCode"],
                "stepCode": step["step_code"],
                "scenario": scenario,
            }],
            "assertions": [f"{scenario} contract is enforced before live promotion"],
        })
    return cases


def render_step(
    process: dict[str, Any], step: dict[str, Any], shared_screens: list[dict[str, Any]]
) -> dict[str, Any]:
    validate_step(process, step)
    executable_tests = tests_for_step(process, step)
    executable_commands = commands_for_step(step)
    pages = []
    field_by_audience = group_fields_by_audience(step["field_contract"])
    for page in screens_for_step(step, shared_screens):
        audience = page.get("audience")
        if audience not in {"USER", "ADMIN"}:
            fail(
                f"{process['processCode']}/{step['step_code']}: "
                "screen_contract audience must be USER or ADMIN; "
                f"keys={sorted(page.keys())}"
            )
        # Audience-specific contracts must not create an empty sibling page.
        # For example, an ADMIN-only governance form may still carry a user
        # navigation hint in a legacy compact screen object.
        if field_by_audience and "*" not in field_by_audience and audience not in field_by_audience:
            continue
        page_fields = copy.deepcopy(field_by_audience.get(audience, field_by_audience.get("*", [])))
        existing_field_codes = {field.get("code") or field.get("fieldCode") for field in page_fields}
        server_context = {
            "tenantId", "projectId", "processCode", "stepCode", "actorCode", "fromState",
            "stepOrder", "idempotencyKey", "commandCode", "businessPayload",
        }
        for field_code in input_field_names(step["input_contract"]["schema"]):
            if field_code not in server_context and field_code not in existing_field_codes:
                page_fields.append(projected_input_field(field_code, audience, len(page_fields) + 1))
                existing_field_codes.add(field_code)
        pages.append({
            "pageCode": page["pageCode"],
            "route": page.get("actualRoute") or page["plannedRoute"],
            "routeStatus": page["routeStatus"],
            "audience": audience,
            "screenType": page["screenType"],
            "title": page["title"],
            "purpose": page["purpose"],
            "layout": "COMMON_KRDS_TASK_LAYOUT",
            "theme": "COMMON_KRDS_GOV",
            "sections": ["TASK_CONTEXT", "TASK_ACTIONS", "TASK_CONTENT", "TASK_EVIDENCE", "TASK_HANDOFF"],
            "fields": page_fields,
            "commands": executable_commands,
            "states": page["exceptions"],
            "responsive": page["responsive"],
            "accessibility": page["accessibility"],
        })
    body = {
        "schemaVersion": "2.0.0",
        "process": {
            "code": process["processCode"], "name": process["processName"],
            "domain": process["domainCode"], "workType": process.get("workTypeCode"),
            "goal": process["goal"],
        },
        "step": {
            "code": step["step_code"], "version": step["spec_version"],
            "actor": step["actor_contract"], "business": step["business_contract"],
            "transition": step["transition_contract"], "input": step["input_contract"]["schema"],
            "output": step["output_contract"]["schema"], "guide": step["guide_contract"],
        },
        "frontend": {
            "renderer": "COMMON_SDUI_RUNTIME",
            "required": bool(step["screen_contract"] or step["field_contract"]),
            "pages": pages,
        },
        "backend": {
            "runtime": "COMMON_PROCESS_COMMAND_RUNTIME", "apis": apis_for_step(step),
            "commands": executable_commands, "authorization": step["actor_contract"],
            "handoffPolicy": step["handoff_contract"]["policy"],
            "handoffs": step["handoff_contract"]["transitions"],
        },
        "database": persistence_for_step(step),
        "tests": executable_tests,
        "testExecution": {
            "runner": "FAST_PROCESS_CONTRACT_RUNNER",
            "requiredLanes": ["CONTRACT", "AUTHORITY", "ISOLATION", "RECOVERY", "LIVE_SMOKE"],
            "requiredScenarioTypes": ["HAPPY_PATH", "EXCEPTION", "AUTHORITY", "ISOLATION", "RECOVERY"],
            "cacheKeySource": "packageHash",
            "parallelSafe": True,
            "targetSeconds": 5,
            "liveSmokeRequiredForVerified": True,
            "evidenceRequired": True,
        },
        "nonfunctional": step["nonfunctional_contract"],
        "sourceHash": step["source_hash"],
        "approvalStatus": step["approval_status"],
    }
    body["packageHash"] = hashlib.sha256(stable(body).encode()).hexdigest()
    return body


def render_packages(data: dict[str, Any], allow_review_required: bool, workers: int) -> tuple[list[tuple[str, dict[str, Any]]], int]:
    jobs: list[tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]]]] = []
    skipped_review = 0
    for process in data["processes"]:
        shared_screens = [
            screen
            for process_step in process.get("steps", [])
            for screen in (process_step.get("screen_contract", [])
                           if isinstance(process_step.get("screen_contract"), list) else [])
        ]
        for step in process.get("steps", []):
            if step.get("approval_status") != "APPROVED" and not allow_review_required:
                skipped_review += 1
                continue
            jobs.append((process, step, shared_screens))
    bounded_workers = max(1, min(workers, 16))
    with ThreadPoolExecutor(max_workers=bounded_workers) as pool:
        rendered = list(pool.map(lambda job: render_step(*job), jobs))
    packages = [(f"{process['processCode']}__{step['step_code']}.json", package)
                for (process, step, _), package in zip(jobs, rendered)]
    return packages, skipped_review


def canonical_screen_identity(screen: dict[str, Any]) -> tuple[str, str, str, str]:
    return (
        str(screen.get("processCode") or "").strip().upper(),
        str(screen.get("stepCode") or "").strip().upper(),
        str(screen.get("audience") or "").strip().upper(),
        str(screen.get("routePath") or "").split("?", 1)[0].strip().lower(),
    )


def canonical_screens_for_step(catalog: dict[str, Any], process_code: str, step_code: str) -> list[dict[str, str]]:
    screens = catalog.get("screens")
    if catalog.get("schema") != "carbonet.canonical-design/v1" or not isinstance(screens, list):
        fail("canonical design catalog is invalid")
    matches = [
        {"screenKey": screen["screenKey"], "designHash": screen["designHash"]}
        for screen in screens
        if isinstance(screen, dict)
        and canonical_screen_identity(screen)[:2]
            == (str(process_code).strip().upper(), str(step_code).strip().upper())
        and isinstance(screen.get("screenKey"), str)
        and isinstance(screen.get("designHash"), str)
    ]
    matches.sort(key=lambda item: item["screenKey"])
    if not matches:
        fail(f"canonical design catalog has no screen for {process_code}/{step_code}")
    return matches


def subset_canonical_catalog(catalog: dict[str, Any], process_code: str | None) -> dict[str, Any]:
    if catalog.get("schema") != "carbonet.canonical-design/v1" or not isinstance(catalog.get("screens"), list):
        fail("canonical design catalog is invalid")
    normalized_process = str(process_code).strip().upper() if process_code else None
    screens = [screen for screen in catalog["screens"]
               if not normalized_process
               or canonical_screen_identity(screen)[0] == normalized_process]
    if not screens:
        fail(f"canonical design catalog has no screens for {process_code or 'all processes'}")
    lines = [screen["screenKey"] + "\x1f" + screen["designHash"] for screen in screens]
    return {
        "schema": "carbonet.canonical-design/v1",
        "catalogHash": hashlib.sha256("\n".join(lines).encode()).hexdigest(),
        "screenCount": len(screens),
        "screens": screens,
    }


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "--subset-canonical-catalog":
        if len(sys.argv) not in (3, 4):
            fail("--subset-canonical-catalog requires CATALOG [PROCESS_CODE]")
        try:
            catalog = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            fail(f"invalid canonical catalog: {exc}")
        print(stable(subset_canonical_catalog(catalog, sys.argv[3] if len(sys.argv) == 4 else None)))
        return
    if len(sys.argv) > 1 and sys.argv[1] == "--recover-publish-set":
        destinations = [Path(value) for value in sys.argv[2:]]
        recovered = recover_publish_destinations(destinations)
        print(stable({"recovered": recovered, "destinationCount": len(destinations)}))
        return
    if len(sys.argv) > 1 and sys.argv[1] == "--publish-set":
        values = [Path(value) for value in sys.argv[2:]]
        if not values or len(values) % 2:
            fail("--publish-set requires STAGED DESTINATION pairs")
        changed = publish_directories(list(zip(values[0::2], values[1::2])))
        print(stable({"published": True, "directoriesChanged": changed,
                      "directoryCount": len(values) // 2}))
        return
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--allow-review-required", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--canonical-catalog", type=Path)
    args = parser.parse_args()
    data = load(args.snapshot)
    for process in data["processes"]:
        process["steps"] = [normalize_step_contract(step) for step in process.get("steps", [])]
    packages, skipped_review = render_packages(data, args.allow_review_required, args.workers)
    canonical_catalog = None
    canonical_catalog_hash = None
    if args.canonical_catalog:
        try:
            canonical_catalog = json.loads(args.canonical_catalog.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            fail(f"invalid canonical catalog: {exc}")
        canonical_catalog_hash = canonical_catalog.get("catalogHash")
        if not isinstance(canonical_catalog_hash, str) or len(canonical_catalog_hash) != 64:
            fail("canonical design catalogHash is invalid")
        enriched = []
        for filename, package in packages:
            package["canonicalCatalogHash"] = canonical_catalog_hash
            package["canonicalScreens"] = canonical_screens_for_step(
                canonical_catalog, package["process"]["code"], package["step"]["code"]
            )
            package["packageHash"] = hashlib.sha256(stable({
                key: value for key, value in package.items() if key != "packageHash"
            }).encode()).hexdigest()
            enriched.append((filename, package))
        packages = enriched
    if args.check:
        print(stable({"valid": True, "packages": len(packages), "skippedReview": skipped_review}))
        return
    args.out.mkdir(parents=True, exist_ok=True)
    expected = set()
    index = []
    for filename, package in packages:
        expected.add(filename)
        (args.out / filename).write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        index.append({
            "processCode": package["process"]["code"], "stepCode": package["step"]["code"],
            "package": filename, "packageHash": package["packageHash"],
            "pages": len(package["frontend"]["pages"]),
        })
    for stale in args.out.glob("*.json"):
        if stale.name != "index.json" and stale.name not in expected:
            stale.unlink()
    manifest = {
        "schemaVersion": "2.0.0", "packageCount": len(index),
        "skippedReviewRequired": skipped_review, "packages": sorted(index, key=lambda x: (x["processCode"], x["stepCode"])),
    }
    if canonical_catalog_hash:
        manifest["canonicalCatalogHash"] = canonical_catalog_hash
        manifest["canonicalScreens"] = sorted(
            [screen for _, package in packages for screen in package["canonicalScreens"]],
            key=lambda item: item["screenKey"],
        )
    manifest["manifestHash"] = hashlib.sha256(stable(manifest).encode()).hexdigest()
    (args.out / "index.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(stable({"generated": len(index), "skippedReview": skipped_review, "manifestHash": manifest["manifestHash"]}))


if __name__ == "__main__":
    main()
