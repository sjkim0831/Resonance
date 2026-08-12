#!/usr/bin/env python3
"""Strict, durable journal for one in-flight Carbonet deployment attempt."""

from __future__ import annotations

import argparse
import datetime as dt
import fcntl
import json
import os
import re
import secrets
import stat
import sys
from pathlib import Path
from typing import Any


SHA40 = re.compile(r"^[0-9a-f]{40}$")
SHA64 = re.compile(r"^[0-9a-f]{64}$")
IDENTITY = re.compile(r"^[A-Za-z0-9._:-]{12,160}$")
REASON = re.compile(r"^[A-Z0-9_:-]{3,160}$")
TOP_KEYS = {
    "schemaVersion",
    "lifecycleStatus",
    "rollbackStage",
    "dbAttemptStaged",
    "attemptId",
    "candidateId",
    "sourceCommit",
    "baseCommit",
    "runtimeIdentityHash",
    "terminalReason",
    "stagedAt",
    "terminalAt",
    "rollback",
}
ROLLBACK_KEYS = {
    "snapshotId",
    "snapshotDir",
    "snapshotManifestSha256",
    "runtimeImageRef",
    "runtimeImageId",
    "deploymentUid",
    "deploymentGeneration",
    "deploymentAnnotationsSha256",
    "podTemplateSha256",
    "appliedMarkerCommit",
    "appliedMarkerSha256",
    "runtimeMarkerCommit",
    "runtimeMarkerSha256",
}


class JournalError(RuntimeError):
    pass


def expected_owner_uid() -> int:
    raw = os.environ.get(
        "CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_OWNER_UID", str(os.geteuid())
    )
    if not raw.isdigit():
        raise JournalError("expected deployment uid is invalid")
    return int(raw)


def duplicate_rejecting_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise JournalError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def parse_json(raw: str) -> dict[str, Any]:
    try:
        value = json.loads(raw, object_pairs_hook=duplicate_rejecting_object)
    except (json.JSONDecodeError, JournalError) as exc:
        raise JournalError(f"invalid journal JSON: {exc}") from exc
    if not isinstance(value, dict):
        raise JournalError("journal root must be an object")
    return value


def is_rfc3339(value: Any) -> bool:
    if not isinstance(value, str) or not value.endswith("Z"):
        return False
    try:
        dt.datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError:
        return False
    return True


def marker_pair(rollback: dict[str, Any], prefix: str) -> bool:
    commit = rollback[f"{prefix}MarkerCommit"]
    digest = rollback[f"{prefix}MarkerSha256"]
    return (commit is None and digest is None) or (
        isinstance(commit, str)
        and SHA40.fullmatch(commit) is not None
        and isinstance(digest, str)
        and SHA64.fullmatch(digest) is not None
    )


def validate(document: dict[str, Any]) -> None:
    if set(document) != TOP_KEYS:
        raise JournalError(f"journal keys mismatch: {sorted(set(document) ^ TOP_KEYS)}")
    if document["schemaVersion"] != 2:
        raise JournalError("journal schemaVersion must be 2")
    status = document["lifecycleStatus"]
    if status not in {"STAGED", "PROMOTED", "ABORTED"}:
        raise JournalError("journal lifecycleStatus is invalid")
    attempt = document["attemptId"]
    candidate = document["candidateId"]
    if not isinstance(attempt, str) or IDENTITY.fullmatch(attempt) is None:
        raise JournalError("journal attemptId is invalid")
    if candidate != attempt:
        raise JournalError("journal candidateId must equal attemptId")
    for field in ("sourceCommit", "baseCommit"):
        value = document[field]
        if not isinstance(value, str) or SHA40.fullmatch(value) is None:
            raise JournalError(f"journal {field} is invalid")
    if not is_rfc3339(document["stagedAt"]):
        raise JournalError("journal stagedAt is invalid")

    rollback_stage = document["rollbackStage"]
    if rollback_stage not in {
        "ARMED",
        "SNAPSHOT_CAPTURED",
        "ABORT_AUTHORIZED",
        "PHYSICAL_RESTORED",
        "RESTORED_VERIFIED",
        "DISARMED",
    }:
        raise JournalError("journal rollbackStage is invalid")
    db_staged = document["dbAttemptStaged"]
    if not isinstance(db_staged, bool):
        raise JournalError("journal dbAttemptStaged must be boolean")
    if status == "STAGED" and (
        (db_staged and rollback_stage != "ARMED")
        or (not db_staged and rollback_stage != "SNAPSHOT_CAPTURED")
    ):
        raise JournalError("STAGED journal DB/rollback stage shape is invalid")
    if status == "PROMOTED" and rollback_stage != "DISARMED":
        raise JournalError("PROMOTED journal rollbackStage must be DISARMED")
    if status == "ABORTED" and rollback_stage not in {
        "ABORT_AUTHORIZED",
        "PHYSICAL_RESTORED",
        "RESTORED_VERIFIED",
        "DISARMED",
    }:
        raise JournalError("ABORTED journal rollbackStage is invalid")
    if status == "ABORTED" and rollback_stage == "DISARMED" and (
        document["terminalReason"] != "RECONCILED_TO_EXISTING_SOURCE_PROMOTION"
    ):
        raise JournalError("only a reconciled attempt may disarm without restore")
    if status == "PROMOTED" and not db_staged:
        raise JournalError("PROMOTED journal must be DB staged")
    if status == "ABORTED" and not db_staged and not (
        rollback_stage == "RESTORED_VERIFIED"
        and document["terminalReason"] == "PRE_RUNTIME_FAILURE"
    ):
        raise JournalError("ABORTED journal without DB authority is invalid")

    runtime_hash = document["runtimeIdentityHash"]
    reason = document["terminalReason"]
    terminal_at = document["terminalAt"]
    if status == "STAGED":
        if runtime_hash is not None or reason is not None or terminal_at is not None:
            raise JournalError("STAGED journal contains terminal fields")
    else:
        if runtime_hash is not None and (
            not isinstance(runtime_hash, str) or SHA64.fullmatch(runtime_hash) is None
        ):
            raise JournalError("terminal runtimeIdentityHash is invalid")
        if not isinstance(reason, str) or REASON.fullmatch(reason) is None:
            raise JournalError("terminalReason is invalid")
        if not is_rfc3339(terminal_at):
            raise JournalError("terminalAt is invalid")
        if status == "PROMOTED" and (
            runtime_hash is None or reason != "PROMOTION_COMMITTED"
        ):
            raise JournalError("PROMOTED journal is not identity-bound")

    rollback = document["rollback"]
    if not isinstance(rollback, dict) or set(rollback) != ROLLBACK_KEYS:
        actual = set(rollback) if isinstance(rollback, dict) else set()
        raise JournalError(f"rollback keys mismatch: {sorted(actual ^ ROLLBACK_KEYS)}")
    snapshot_id = rollback["snapshotId"]
    if (
        not isinstance(snapshot_id, str)
        or re.fullmatch(r"[A-Za-z0-9._-]{3,160}", snapshot_id) is None
    ):
        raise JournalError("rollback snapshotId is invalid")
    snapshot_dir = rollback["snapshotDir"]
    if not isinstance(snapshot_dir, str) or not os.path.isabs(snapshot_dir):
        raise JournalError("rollback snapshotDir must be absolute")
    for field in (
        "snapshotManifestSha256",
        "deploymentAnnotationsSha256",
        "podTemplateSha256",
    ):
        value = rollback[field]
        if not isinstance(value, str) or SHA64.fullmatch(value) is None:
            raise JournalError(f"rollback {field} is invalid")
    for field in ("runtimeImageRef", "runtimeImageId", "deploymentUid"):
        value = rollback[field]
        if not isinstance(value, str) or not value or len(value) > 512:
            raise JournalError(f"rollback {field} is invalid")
    if re.search(r"sha256:[0-9a-f]{64}$", rollback["runtimeImageId"]) is None:
        raise JournalError("rollback runtimeImageId is not immutable")
    generation = rollback["deploymentGeneration"]
    if isinstance(generation, bool) or not isinstance(generation, int) or generation < 1:
        raise JournalError("rollback deploymentGeneration is invalid")
    if not marker_pair(rollback, "applied") or not marker_pair(rollback, "runtime"):
        raise JournalError("rollback marker identity pair is invalid")


def canonical(document: dict[str, Any]) -> bytes:
    validate(document)
    return (json.dumps(document, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def ensure_regular_0600(path: Path) -> None:
    try:
        metadata = path.lstat()
    except FileNotFoundError:
        return
    if not stat.S_ISREG(metadata.st_mode) or stat.S_ISLNK(metadata.st_mode):
        raise JournalError("journal must be a regular non-symlink file")
    if stat.S_IMODE(metadata.st_mode) != 0o600:
        raise JournalError("journal mode must be 0600")
    if metadata.st_uid != expected_owner_uid():
        raise JournalError("journal owner does not match the expected deployment uid")
    if metadata.st_size > 65536:
        raise JournalError("journal exceeds 64 KiB")


def safe_parent(path: Path, create: bool) -> Path:
    absolute = Path(os.path.abspath(path))
    parent = absolute.parent
    if create:
        parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    if not parent.is_dir():
        raise JournalError("journal parent is unavailable")
    if str(parent.resolve(strict=True)) != str(parent):
        raise JournalError("journal parent path contains a symlink")
    metadata = parent.stat()
    if metadata.st_uid != expected_owner_uid() or stat.S_IMODE(metadata.st_mode) & 0o022:
        raise JournalError("journal parent must be deployment-owned and not group/other writable")
    return parent


def read_document(path: Path) -> dict[str, Any]:
    ensure_regular_0600(path)
    try:
        raw = path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise JournalError("journal is missing") from exc
    document = parse_json(raw)
    validate(document)
    return document


def atomic_write(path: Path, document: dict[str, Any]) -> None:
    parent = safe_parent(path, create=True)
    ensure_regular_0600(path)
    payload = canonical(document)
    temporary = parent / f".{path.name}.tmp.{os.getpid()}.{secrets.token_hex(8)}"
    descriptor = -1
    try:
        descriptor = os.open(
            temporary,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0),
            0o600,
        )
        os.write(descriptor, payload)
        os.fchmod(descriptor, 0o600)
        os.fsync(descriptor)
        os.close(descriptor)
        descriptor = -1
        os.replace(temporary, path)
        directory_descriptor = os.open(parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
        try:
            os.fsync(directory_descriptor)
        finally:
            os.close(directory_descriptor)
    finally:
        if descriptor >= 0:
            os.close(descriptor)
        try:
            temporary.unlink()
        except FileNotFoundError:
            pass


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def require_identity(document: dict[str, Any], args: argparse.Namespace) -> None:
    if document["candidateId"] != args.candidate or document["sourceCommit"] != args.source:
        raise JournalError("journal candidate/source identity mismatch")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--file",
        default=os.environ.get(
            "CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE",
            "/opt/resonance-data/deploy/carbonet-postdeploy-attempt.json",
        ),
    )
    subparsers = parser.add_subparsers(dest="action", required=True)
    subparsers.add_parser("stage")
    subparsers.add_parser("read")
    transition = subparsers.add_parser("transition")
    transition.add_argument("status", choices=("PROMOTED", "ABORTED"))
    transition.add_argument("candidate")
    transition.add_argument("source")
    transition.add_argument("runtime_hash")
    transition.add_argument("reason")
    advance = subparsers.add_parser("advance-rollback")
    advance.add_argument("candidate")
    advance.add_argument("source")
    advance.add_argument(
        "expected",
        choices=("ABORT_AUTHORIZED", "PHYSICAL_RESTORED", "RESTORED_VERIFIED"),
    )
    mark_db = subparsers.add_parser("mark-db-staged")
    mark_db.add_argument("candidate")
    mark_db.add_argument("source")
    cancel = subparsers.add_parser("cancel-pre-runtime")
    cancel.add_argument("candidate")
    cancel.add_argument("source")
    advance.add_argument(
        "next",
        choices=("PHYSICAL_RESTORED", "RESTORED_VERIFIED"),
    )
    clear = subparsers.add_parser("clear-terminal")
    clear.add_argument("status", choices=("PROMOTED", "ABORTED"))
    clear.add_argument("candidate")
    clear.add_argument("source")
    args = parser.parse_args()

    path = Path(args.file)
    parent = safe_parent(path, create=args.action == "stage")
    lock_path = parent / f".{path.name}.lock"
    lock_descriptor = os.open(
        lock_path,
        os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0),
        0o600,
    )
    try:
        lock_metadata = os.fstat(lock_descriptor)
        if (
            not stat.S_ISREG(lock_metadata.st_mode)
            or stat.S_IMODE(lock_metadata.st_mode) != 0o600
            or lock_metadata.st_uid != expected_owner_uid()
        ):
            raise JournalError("journal lock ownership or mode is unsafe")
        fcntl.flock(lock_descriptor, fcntl.LOCK_EX)
        if args.action == "stage":
            incoming = parse_json(sys.stdin.read())
            validate(incoming)
            if incoming["lifecycleStatus"] != "STAGED":
                raise JournalError("stage input must have STAGED lifecycleStatus")
            if incoming["rollbackStage"] != "SNAPSHOT_CAPTURED" or incoming["dbAttemptStaged"]:
                raise JournalError("stage input must be an unarmed captured snapshot")
            if path.exists():
                existing = read_document(path)
                if canonical(existing) != canonical(incoming):
                    raise JournalError("another non-identical attempt journal is active")
                output = existing
            else:
                atomic_write(path, incoming)
                output = incoming
        elif args.action == "read":
            output = read_document(path)
        elif args.action == "transition":
            output = read_document(path)
            require_identity(output, args)
            runtime_hash: str | None = None if args.runtime_hash == "-" else args.runtime_hash
            if output["lifecycleStatus"] == "STAGED":
                if not output["dbAttemptStaged"] or output["rollbackStage"] != "ARMED":
                    raise JournalError("terminal transition requires exact DB-staged ARMED journal")
                output["lifecycleStatus"] = args.status
                output["rollbackStage"] = (
                    "DISARMED"
                    if args.status == "PROMOTED"
                    or args.reason == "RECONCILED_TO_EXISTING_SOURCE_PROMOTION"
                    else "ABORT_AUTHORIZED"
                )
                output["runtimeIdentityHash"] = runtime_hash
                output["terminalReason"] = args.reason
                output["terminalAt"] = now()
                atomic_write(path, output)
            elif not (
                output["lifecycleStatus"] == args.status
                and output["runtimeIdentityHash"] == runtime_hash
                and output["terminalReason"] == args.reason
            ):
                raise JournalError("journal terminal transition exact CAS failed")
            validate(output)
        elif args.action == "mark-db-staged":
            output = read_document(path)
            require_identity(output, args)
            if output["lifecycleStatus"] != "STAGED":
                raise JournalError("DB stage mark requires STAGED lifecycleStatus")
            if not output["dbAttemptStaged"] and output["rollbackStage"] == "SNAPSHOT_CAPTURED":
                output["dbAttemptStaged"] = True
                output["rollbackStage"] = "ARMED"
                atomic_write(path, output)
            elif not (output["dbAttemptStaged"] and output["rollbackStage"] == "ARMED"):
                raise JournalError("DB stage mark exact CAS failed")
            validate(output)
        elif args.action == "cancel-pre-runtime":
            output = read_document(path)
            require_identity(output, args)
            if output["lifecycleStatus"] == "STAGED" and not output["dbAttemptStaged"] \
                    and output["rollbackStage"] == "SNAPSHOT_CAPTURED":
                output["lifecycleStatus"] = "ABORTED"
                output["rollbackStage"] = "RESTORED_VERIFIED"
                output["terminalReason"] = "PRE_RUNTIME_FAILURE"
                output["terminalAt"] = now()
                atomic_write(path, output)
            elif not (
                output["lifecycleStatus"] == "ABORTED"
                and not output["dbAttemptStaged"]
                and output["rollbackStage"] == "RESTORED_VERIFIED"
                and output["terminalReason"] == "PRE_RUNTIME_FAILURE"
            ):
                raise JournalError("pre-runtime cancellation exact CAS failed")
            validate(output)
        elif args.action == "advance-rollback":
            output = read_document(path)
            require_identity(output, args)
            if output["lifecycleStatus"] != "ABORTED":
                raise JournalError("rollback advance requires ABORTED lifecycleStatus")
            allowed = {
                ("ABORT_AUTHORIZED", "PHYSICAL_RESTORED"),
                ("PHYSICAL_RESTORED", "RESTORED_VERIFIED"),
            }
            if (args.expected, args.next) not in allowed:
                raise JournalError("rollback stage transition is not monotonic")
            if output["rollbackStage"] == args.expected:
                output["rollbackStage"] = args.next
                atomic_write(path, output)
            elif output["rollbackStage"] != args.next:
                raise JournalError("rollback stage exact CAS failed")
            validate(output)
        else:
            output = read_document(path)
            require_identity(output, args)
            if output["lifecycleStatus"] != args.status:
                raise JournalError("refusing to clear a non-matching terminal journal")
            if args.status == "ABORTED" and not (
                output["rollbackStage"] == "RESTORED_VERIFIED"
                or (
                    output["rollbackStage"] == "DISARMED"
                    and output["terminalReason"]
                    == "RECONCILED_TO_EXISTING_SOURCE_PROMOTION"
                )
            ):
                raise JournalError("refusing to clear an incompletely restored ABORTED journal")
            path.unlink()
            directory_descriptor = os.open(parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
            try:
                os.fsync(directory_descriptor)
            finally:
                os.close(directory_descriptor)
            output = {"status": "CLEARED", "candidateId": args.candidate, "sourceCommit": args.source}
        print(json.dumps(output, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
        return 0
    finally:
        os.close(lock_descriptor)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except JournalError as exc:
        print(f"[postdeploy-attempt-journal] FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
