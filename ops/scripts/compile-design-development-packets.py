#!/usr/bin/env python3
"""Compile live design contracts into deterministic, agent-ready development packets."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from collections import Counter, defaultdict
from pathlib import Path

from screen_layout_contracts import build_layout_catalog


def stable(value) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def parse(value):
    if value in (None, ""):
        return []
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return value


def slug(route: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", route.strip("/")).strip("-").lower()
    return value or "root"


def lane(contract: dict) -> str:
    if contract.get("contract_status") not in {"DESIGN_COMPLETE", "READY", "APPROVED"}:
        return "CONTRACT_REVIEW"
    # Verification flags are acceptance gates, not permission to invent a new
    # endpoint or schema. A complete screen contract can still be implemented
    # through SDUI/metadata while its declared API/data dependencies remain in
    # the packet's missing-check queue.
    return "NO_BUILD_METADATA"


def packet(contract: dict, duplicate_count: int, layout: dict) -> dict:
    checks = {
        "api": bool(contract.get("api_verified")),
        "database": bool(contract.get("database_verified")),
        "authority": bool(contract.get("authority_verified")),
        "responsive": bool(contract.get("responsive_verified")),
        "accessibility": bool(contract.get("accessibility_verified")),
        "exceptionStates": bool(contract.get("exception_states_verified")),
        "menu": bool(contract.get("menu_verified")),
    }
    body = {
        "schemaVersion": "1.0.0",
        "identity": {
            "contractId": contract.get("contract_id"), "route": contract.get("route_path"),
            "screenName": contract.get("screen_name"), "processCode": contract.get("process_code"),
            "stepCode": contract.get("step_code"), "actorCode": contract.get("actor_code"),
            "audience": contract.get("audience"), "duplicateRouteContracts": duplicate_count,
        },
        "intent": {
            "businessPurpose": contract.get("business_purpose"),
            "entryCondition": contract.get("entry_condition"), "exitCondition": contract.get("exit_condition"),
        },
        "design": {
            "sections": parse(contract.get("section_contract")), "fields": parse(contract.get("field_contract")),
            "commands": parse(contract.get("command_contract")), "states": parse(contract.get("state_contract")),
            "responsive": contract.get("responsive_contract"), "accessibility": contract.get("accessibility_contract"),
            "security": contract.get("security_contract"),
            "layout": layout,
        },
        "integration": {
            "apis": parse(contract.get("api_contract")), "data": parse(contract.get("data_contract")),
            "evidence": parse(contract.get("evidence_contract")),
        },
        "execution": {
            "lane": lane(contract),
            "preferredPaths": [
                "projects/carbonet-backend-metadata/**", "projects/carbonet-assets/static/**",
                "projects/carbonet-frontend/src/main/resources/static/react-app/**",
            ],
            "applyCommand": "bash ops/scripts/resonance-no-build-apply.sh",
            "forbiddenByDefault": ["npm run build", "mvn package", "docker build", "kubectl rollout restart"],
            "verification": checks,
            "acceptance": [
                "actor/process/task/route trace is preserved",
                "loading/empty/error/forbidden/ready states are implemented",
                "authority, accessibility and responsive contracts pass",
                "changed-route smoke passes before the full-screen gate",
                "rollback evidence and last-known-good state are recorded",
            ],
        },
        "source": {"contractStatus": contract.get("contract_status"), "updatedAt": contract.get("updated_at")},
    }
    body["packetHash"] = hashlib.sha256(stable(body).encode()).hexdigest()
    return body


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    snap = json.loads(args.snapshot.read_text(encoding="utf-8"))
    contracts = [json.loads(x["row_json"]) for x in snap.get("screen_contracts", [])]
    route_counts = Counter(x.get("route_path") for x in contracts)
    catalog = build_layout_catalog(contracts)
    layouts = {x["identity"]["contractId"]: x for x in catalog["contracts"]}
    packets = [packet(c, route_counts[c.get("route_path")], layouts[c.get("contract_id")]) for c in contracts]
    packets.sort(key=lambda x: (x["identity"]["route"] or "", x["identity"]["contractId"] or 0))
    lanes = Counter(x["execution"]["lane"] for x in packets)
    manifest = {
        "schemaVersion": "1.0.0", "snapshotCapturedAt": snap.get("captured_at"),
        "contractCount": len(packets), "routeCount": len(route_counts), "lanes": dict(sorted(lanes.items())),
        "sourceOfTruth": "framework_professional_screen_contract",
        "documentsAndCodeShareSnapshot": True,
        "packetIndex": [{"contractId": x["identity"]["contractId"], "route": x["identity"]["route"],
                         "processCode": x["identity"]["processCode"], "stepCode": x["identity"]["stepCode"],
                         "lane": x["execution"]["lane"], "packetHash": x["packetHash"]} for x in packets],
    }
    manifest["manifestHash"] = hashlib.sha256(stable(manifest).encode()).hexdigest()
    if args.check:
        if not packets or not route_counts:
            raise SystemExit("[design-development] empty contracts/routes")
        if any(not x["identity"]["route"] for x in packets):
            raise SystemExit("[design-development] packet without route")
        print(stable({"valid": True, "contracts": len(packets), "routes": len(route_counts), "lanes": lanes}))
        return
    stage = args.out.with_name(args.out.name + ".stage")
    if stage.exists():
        shutil.rmtree(stage)
    (stage / "packets").mkdir(parents=True)
    used = Counter()
    for item in packets:
        base = slug(item["identity"]["route"])
        used[base] += 1
        suffix = f"-{used[base]}" if route_counts[item["identity"]["route"]] > 1 else ""
        (stage / "packets" / f"{base}{suffix}.json").write_text(
            json.dumps(item, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (stage / "development-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (stage / "work-queue.json").write_text(json.dumps([
        {"priority": 1 if x["execution"]["lane"] != "NO_BUILD_METADATA" else 2,
         "contractId": x["identity"]["contractId"], "route": x["identity"]["route"],
         "lane": x["execution"]["lane"], "missingChecks": [k for k, v in x["execution"]["verification"].items() if not v]}
        for x in packets
    ], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (stage / "KILO_REQUEST.md").write_text(
        "# Kilo design-driven development request\n\n"
        "Use development-manifest.json and one selected packet as the sole implementation contract. "
        "Read design.layout first: CSS Grid/Flex constraints and DOM order are authoritative, while referenceRect x/y values are visual-regression references only. "
        "Re-run the live preflight, preserve actor/process/task/route traceability, use Build Studio and no-build metadata paths first, "
        "run changed-route smoke, then the full-screen quality gate. If a packet requires core runtime, schema or security changes, "
        "stop implementation and write a design revision instead of inventing behavior.\n",
        encoding="utf-8",
    )
    if args.out.exists():
        backup = args.out.with_name(args.out.name + ".last-known-good")
        if backup.exists():
            shutil.rmtree(backup)
        args.out.replace(backup)
    stage.replace(args.out)
    print(stable({"generated": len(packets), "routes": len(route_counts), "lanes": lanes, "manifestHash": manifest["manifestHash"]}))


if __name__ == "__main__":
    main()
