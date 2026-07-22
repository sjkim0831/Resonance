#!/usr/bin/env python3
"""Generate only changed SDUI screen contracts and activate one manifest last.

The database owns business meaning. This program is intentionally deterministic:
it validates approved snapshot fields, content-addresses every artifact, preserves
manual source screens, and performs no language-model call or application build.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import tempfile
import time
from pathlib import Path
from typing import Any

def stable(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256(value: Any) -> str:
    return hashlib.sha256(stable(value).encode("utf-8")).hexdigest()


def fail(message: str) -> None:
    raise SystemExit(f"[incremental-screen-generator] {message}")


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"invalid snapshot {path}: {exc}")
    if not isinstance(value, dict):
        fail("snapshot must be an object")
    return value


def validate_screen(screen: dict[str, Any]) -> None:
    identity = f"{screen.get('processCode')}/{screen.get('stepCode')}/{screen.get('audience')}"
    required_text = (
        "blueprintCode", "processCode", "stepCode", "actorCode", "audience",
        "pageId", "pageName", "routePath", "screenType", "templateCode",
        "ownershipMode", "designHash",
    )
    if not isinstance(screen.get("blueprintId"), int):
        fail(f"{identity}: blueprintId must be an integer")
    for key in required_text:
        if not isinstance(screen.get(key), str) or not screen[key].strip():
            fail(f"{identity}: {key} is required")
    if screen["ownershipMode"] not in {"GENERATED", "HYBRID", "MANUAL"}:
        fail(f"{identity}: invalid ownershipMode")
    if len(screen["designHash"]) != 64:
        fail(f"{identity}: designHash must be 64 characters")
    if not screen["routePath"].startswith("/"):
        fail(f"{identity}: routePath must be absolute")
    if not isinstance(screen.get("specification"), dict) or not isinstance(screen.get("traceability"), dict):
        fail(f"{identity}: specification and traceability must be objects")


def render(screen: dict[str, Any]) -> dict[str, Any]:
    validate_screen(screen)
    artifact = {
        "schemaVersion": "3.0.0",
        "blueprintId": screen["blueprintId"],
        "blueprintCode": screen["blueprintCode"],
        "identity": {
            "processCode": screen["processCode"],
            "stepCode": screen["stepCode"],
            "actorCode": screen["actorCode"],
            "audience": screen["audience"],
            "pageId": screen["pageId"],
        },
        "route": screen["routePath"],
        "pageName": screen["pageName"],
        "screenType": screen["screenType"],
        "templateCode": screen["templateCode"],
        "ownershipMode": screen["ownershipMode"],
        "runtime": "COMMON_GENERATED_SCREEN",
        "manualSourceProtected": screen["ownershipMode"] in {"MANUAL", "HYBRID"},
        "specification": screen["specification"],
        "traceability": screen["traceability"],
        "designHash": screen["designHash"],
    }
    artifact["artifactHash"] = sha256(artifact)
    return artifact


def atomic_write(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def existing_hash(path: Path) -> str:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return str(value.get("designHash", ""))
    except (OSError, json.JSONDecodeError):
        return ""


def verified_inventory(out: Path) -> dict[str, Any]:
    """Return artifacts whose manifest entry and file content agree."""
    manifest_path = out / "manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"schemaVersion": "3.0.0", "screens": []}
    verified: list[dict[str, Any]] = []
    for entry in manifest.get("screens", []):
        try:
            blueprint_id = int(entry["blueprintId"])
            design_hash = str(entry["designHash"])
            artifact_hash = str(entry["artifactHash"])
            artifact_path = out / str(entry["artifact"])
            artifact = json.loads(artifact_path.read_text(encoding="utf-8"))
            embedded_hash = str(artifact.pop("artifactHash"))
        except (KeyError, TypeError, ValueError, OSError, json.JSONDecodeError):
            continue
        if (
            artifact.get("blueprintId") == blueprint_id
            and artifact.get("designHash") == design_hash
            and embedded_hash == artifact_hash
            and sha256(artifact) == artifact_hash
        ):
            verified.append({"blueprintId": blueprint_id, "designHash": design_hash})
    return {"schemaVersion": "3.0.0", "screens": verified}


def generate(snapshot: dict[str, Any], out: Path, workers: int, check: bool) -> dict[str, Any]:
    if snapshot.get("schemaVersion") != "3.0.0" or not isinstance(snapshot.get("screens"), list):
        fail("snapshot schemaVersion/screens is invalid")
    started = time.perf_counter_ns()
    screens = snapshot["screens"]
    if len(screens) > 1000:
        fail("a generation batch cannot exceed 1000 screens")
    rendered: list[tuple[dict[str, Any], dict[str, Any]]] = []
    manual = 0
    for raw in screens:
        if not isinstance(raw, dict):
            fail("screen entries must be objects")
        validate_screen(raw)
        if raw["ownershipMode"] == "MANUAL":
            manual += 1
            continue
        rendered.append((raw, render(raw)))

    previous: dict[str, dict[str, Any]] = {}
    manifest_path = out / "manifest.json"
    if manifest_path.exists():
        try:
            old = json.loads(manifest_path.read_text(encoding="utf-8"))
            previous = {str(item["blueprintId"]): item for item in old.get("screens", [])}
        except (OSError, json.JSONDecodeError, KeyError, TypeError):
            previous = {}

    artifacts: list[dict[str, Any]] = []

    def write_one(pair: tuple[dict[str, Any], dict[str, Any]]) -> dict[str, Any]:
        screen, artifact = pair
        target = out / "screens" / f"{screen['blueprintId']}.json"
        unchanged = existing_hash(target) == screen["designHash"]
        if not unchanged and not check:
            atomic_write(target, artifact)
        return {
            "blueprintId": screen["blueprintId"],
            "designHash": screen["designHash"],
            "artifactHash": artifact["artifactHash"],
            "routePath": screen["routePath"],
            "ownershipMode": screen["ownershipMode"],
            "artifact": f"screens/{screen['blueprintId']}.json",
            "status": "UNCHANGED" if unchanged else "GENERATED",
        }

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(workers, 32))) as pool:
        artifacts = list(pool.map(write_one, rendered))

    for item in artifacts:
        previous[str(item["blueprintId"])] = item
    active = sorted(previous.values(), key=lambda item: (item.get("routePath", ""), item["blueprintId"]))
    manifest = {
        "schemaVersion": "3.0.0",
        "runtime": "COMMON_GENERATED_SCREEN",
        "screenCount": len(active),
        "screens": active,
    }
    manifest["manifestHash"] = sha256(manifest)
    if not check:
        atomic_write(manifest_path, manifest)  # activation point; always written last

    elapsed = max(1, (time.perf_counter_ns() - started) // 1_000_000)
    generated = sum(item["status"] == "GENERATED" for item in artifacts)
    unchanged = sum(item["status"] == "UNCHANGED" for item in artifacts)
    return {
        "success": True,
        "schemaVersion": "3.0.0",
        "requested": len(screens),
        "generated": generated,
        "unchanged": unchanged,
        "manual": manual,
        "failed": 0,
        "elapsedMillis": elapsed,
        "screensPerSecond": round(len(screens) * 1000 / elapsed, 2),
        "manifestHash": manifest["manifestHash"],
        "checkOnly": check,
        "artifacts": artifacts,
    }


def synthetic_snapshot(count: int) -> dict[str, Any]:
    screens = []
    for index in range(1, count + 1):
        design_hash = hashlib.sha256(f"synthetic-design-{index}".encode()).hexdigest()
        screens.append({
            "blueprintId": index, "blueprintCode": f"BENCHMARK_{index:04d}",
            "processCode": f"PROCESS_{(index - 1) // 4:04d}", "stepCode": f"STEP_{index:04d}",
            "actorCode": "BENCHMARK_ACTOR", "audience": "ADMIN" if index % 2 == 0 else "USER",
            "pageId": f"PAGE_{index:04d}", "pageName": f"Benchmark screen {index}",
            "routePath": f"/generated/benchmark/{index}", "screenType": "FORM",
            "templateCode": "KRDS_FORM", "ownershipMode": "GENERATED", "designHash": design_hash,
            "specification": {"fields": [{"code": f"FIELD_{j}", "required": j < 4} for j in range(12)],
                              "states": ["LOADING", "EMPTY", "READY", "ERROR", "FORBIDDEN"]},
            "traceability": {"requiredScenarioTypes": ["HAPPY_PATH", "AUTHORITY", "ISOLATION", "EXCEPTION", "RECOVERY"]},
        })
    return {"schemaVersion": "3.0.0", "screenCount": count, "screens": screens}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot", nargs="?", type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--workers", type=int, default=min(16, os.cpu_count() or 4))
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--benchmark", type=int, choices=range(1, 1001), metavar="COUNT")
    parser.add_argument("--inventory", type=Path,
                        help="print verified runtime artifact inventory and exit")
    parser.add_argument("--max-millis", type=int, default=180_000)
    args = parser.parse_args()
    if args.inventory:
        print(stable(verified_inventory(args.inventory)))
        return
    if args.benchmark:
        with tempfile.TemporaryDirectory(prefix="screen-generation-benchmark-") as temporary:
            snapshot = synthetic_snapshot(args.benchmark)
            cold = generate(snapshot, Path(temporary), args.workers, False)
            warm = generate(snapshot, Path(temporary), args.workers, False)
            result = {
                "success": cold["success"] and warm["success"],
                "schemaVersion": "3.0.0", "benchmarkCount": args.benchmark,
                "generated": cold["generated"], "unchanged": warm["unchanged"],
                "manual": 0, "failed": cold["failed"] + warm["failed"],
                "elapsedMillis": max(cold["elapsedMillis"], warm["elapsedMillis"]),
                "coldElapsedMillis": cold["elapsedMillis"],
                "warmElapsedMillis": warm["elapsedMillis"],
                "screensPerSecond": cold["screensPerSecond"],
                "manifestHash": warm["manifestHash"],
                "incrementalReuseVerified": warm["unchanged"] == args.benchmark,
                "artifacts": [],
            }
    else:
        if args.snapshot is None or args.out is None:
            fail("snapshot and --out are required")
        result = generate(read_json(args.snapshot), args.out, args.workers, args.check)
    if result["elapsedMillis"] > args.max_millis:
        fail(f"generation SLA exceeded: {result['elapsedMillis']}ms > {args.max_millis}ms")
    print(stable(result))


if __name__ == "__main__":
    main()
