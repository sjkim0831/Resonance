#!/usr/bin/env python3
"""Fail-closed design-to-runtime quality gate for generated screens.

The gate is deterministic and intentionally does not call an AI model.  It
turns the exported screen catalog into a canonical manifest, validates that
the design is implementable, calculates the affected layers, and inspects
generated sources for defects that would make promotion unsafe.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

SELECTION_TYPES = {"SELECT", "CODE", "ENUM", "RADIO", "AUTOCOMPLETE"}
VALID_HTTP_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
VALID_FIELD_TYPES = {
    "TEXT", "NUMBER", "DATE", "DATETIME", "SELECT", "CHECKBOX", "SWITCH",
    "RADIO", "AUTOCOMPLETE", "SLIDER", "FILE", "IMAGE", "EMAIL", "PASSWORD",
    "PHONE", "TEXTAREA", "CODE", "ENUM", "HIDDEN", "CALCULATED", "ADDRESS",
}
ALL_LAYERS = ["DATABASE", "BACKEND", "FRONTEND_USER", "FRONTEND_ADMIN", "TEST"]


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


@dataclass
class Finding:
    severity: str
    code: str
    message: str
    contract_id: Any = None
    path: str = ""
    details: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "severity": self.severity,
            "code": self.code,
            "message": self.message,
            "contractId": self.contract_id,
            "path": self.path,
            "details": self.details,
        }


class QualityGate:
    def __init__(self, catalog_path: Path, source_root: Path, previous_manifest: Path | None):
        self.catalog_path = catalog_path
        self.source_root = source_root
        self.previous_manifest = previous_manifest
        self.findings: list[Finding] = []

    def add(self, severity: str, code: str, message: str, screen: dict | None = None,
            path: str = "", **details: Any) -> None:
        self.findings.append(Finding(
            severity=severity,
            code=code,
            message=message,
            contract_id=(screen or {}).get("contract_id"),
            path=path or (screen or {}).get("route", ""),
            details=details,
        ))

    def load_catalog(self) -> list[dict[str, Any]]:
        if not self.catalog_path.is_file():
            self.add("BLOCKER", "CATALOG_MISSING", "Generated screen catalog does not exist",
                     path=str(self.catalog_path))
            return []
        try:
            payload = json.loads(self.catalog_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            self.add("BLOCKER", "CATALOG_INVALID", f"Cannot parse generated catalog: {exc}",
                     path=str(self.catalog_path))
            return []
        screens = payload.get("screens") if isinstance(payload, dict) else payload
        if not isinstance(screens, list):
            self.add("BLOCKER", "CATALOG_SHAPE_INVALID", "Catalog must contain a screens array")
            return []
        return [item for item in screens if isinstance(item, dict)]

    def validate_screen(self, screen: dict[str, Any]) -> None:
        required = ("contract_id", "route", "screen_name", "process_code", "actor_code")
        for key in required:
            if screen.get(key) in (None, "", "UNKNOWN"):
                self.add("BLOCKER", "SCREEN_IDENTITY_MISSING",
                         f"Required screen identity is missing: {key}", screen, field=key)

        route = str(screen.get("route") or "")
        if route and not route.startswith("/"):
            self.add("BLOCKER", "ROUTE_INVALID", "Route must start with '/'", screen)

        fields = screen.get("fields")
        if not isinstance(fields, list) or not fields:
            self.add("BLOCKER", "FIELD_CONTRACT_MISSING",
                     "A professional screen requires an explicit field contract", screen)
            fields = []
        field_codes: set[str] = set()
        for index, item in enumerate(fields):
            field = item if isinstance(item, dict) else {}
            code = str(field.get("code") or "")
            field_type = str(field.get("type") or "").upper()
            if not code or not field.get("name"):
                self.add("BLOCKER", "FIELD_IDENTITY_MISSING",
                         "Field code and name are required", screen, fieldIndex=index)
            if code in field_codes:
                self.add("BLOCKER", "FIELD_CODE_DUPLICATE",
                         f"Duplicate field code: {code}", screen, fieldCode=code)
            field_codes.add(code)
            if field_type not in VALID_FIELD_TYPES:
                self.add("BLOCKER", "FIELD_TYPE_INVALID",
                         f"Unsupported field type: {field_type}", screen, fieldCode=code)
            if field_type in SELECTION_TYPES:
                options = field.get("options")
                source = field.get("optionSource") or field.get("option_source")
                if not options and not source:
                    self.add("BLOCKER", "SELECTION_SOURCE_MISSING",
                             f"Selection field has no options or option source: {code}",
                             screen, fieldCode=code)
            if field.get("required") and field.get("readOnly") and field.get("defaultValue") is None:
                self.add("BLOCKER", "REQUIRED_READONLY_UNPOPULATED",
                         f"Required read-only field has no value source: {code}",
                         screen, fieldCode=code)

        apis = screen.get("apis")
        if not isinstance(apis, list) or not apis:
            self.add("BLOCKER", "API_CONTRACT_MISSING",
                     "Screen has no query or command API contract", screen)
            apis = []
        operations: set[tuple[str, str]] = set()
        for index, item in enumerate(apis):
            api = item if isinstance(item, dict) else {}
            method = str(api.get("method") or "").upper()
            path = str(api.get("path") or "")
            operation = (method, path)
            if method not in VALID_HTTP_METHODS or not path.startswith("/"):
                self.add("BLOCKER", "API_CONTRACT_INVALID",
                         f"Invalid API operation: {method} {path}", screen, apiIndex=index)
            if operation in operations:
                self.add("BLOCKER", "API_OPERATION_DUPLICATE",
                         f"Duplicate API operation in screen: {method} {path}", screen)
            operations.add(operation)

        states = screen.get("states") or screen.get("state_contract")
        if not isinstance(states, list) or not states:
            self.add("BLOCKER", "STATE_CONTRACT_MISSING",
                     "State machine contract is required", screen)
        sections = screen.get("sections") or screen.get("section_contract")
        if not isinstance(sections, list) or not sections:
            self.add("BLOCKER", "SECTION_CONTRACT_MISSING",
                     "Section and responsive layout contract is required", screen)
        if not screen.get("input_schema") or not screen.get("output_schema"):
            self.add("BLOCKER", "STEP_SCHEMA_MISSING",
                     "Step input and output SchemaSet references are required", screen)
        if not screen.get("permissions"):
            self.add("BLOCKER", "PERMISSION_CONTRACT_MISSING",
                     "Actor and command permission contract is required", screen)
        if not screen.get("tests"):
            self.add("BLOCKER", "TEST_CONTRACT_MISSING",
                     "At least one executable test expectation is required", screen)

    def validate_cross_screen(self, screens: list[dict[str, Any]]) -> None:
        by_route: dict[str, list[dict[str, Any]]] = defaultdict(list)
        by_id: dict[Any, list[dict[str, Any]]] = defaultdict(list)
        for screen in screens:
            by_route[str(screen.get("route") or "")].append(screen)
            by_id[screen.get("contract_id")].append(screen)
        for route, owners in by_route.items():
            if route and len(owners) > 1:
                self.add("BLOCKER", "ROUTE_OWNERSHIP_CONFLICT",
                         f"Route has {len(owners)} owners and cannot be generated deterministically",
                         owners[0], owners=[o.get("contract_id") for o in owners])
        for contract_id, owners in by_id.items():
            if contract_id is not None and len(owners) > 1:
                self.add("BLOCKER", "CONTRACT_ID_DUPLICATE",
                         f"Contract ID is duplicated: {contract_id}", owners[0])

    def inspect_generated_sources(self) -> None:
        generated_roots = [
            self.source_root / "projects/carbonet-frontend/source/src/generated",
            self.source_root / "projects/carbonet-frontend/src/main/resources/static/react-app/generated",
            self.source_root / "apps/carbonet-api/src/main/java/com/carbonet/api/generated",
        ]
        hook_pattern = re.compile(r"^\s*const\s+.*=\s*use(?:State|Effect|Callback|Memo|ScreenState|FormState|Api)\b")
        component_pattern = re.compile(r"(?:React\.FC|function\s+[A-Z]|const\s+[A-Z]\w*\s*=)")
        java_method_pattern = re.compile(
            r"\b(?:public|protected|private)\s+[\w<>, ?]+\s+(\w+)\s*\(([^)]*)\)")
        for root in generated_roots:
            if not root.exists():
                continue
            for path in root.rglob("*"):
                if path.suffix not in {".tsx", ".ts", ".java"} or not path.is_file():
                    continue
                try:
                    text = path.read_text(encoding="utf-8")
                except (OSError, UnicodeDecodeError):
                    continue
                relative = str(path.relative_to(self.source_root))
                if path.suffix == ".tsx":
                    component_seen = False
                    for line_no, line in enumerate(text.splitlines(), 1):
                        component_seen = component_seen or bool(component_pattern.search(line))
                        if hook_pattern.search(line) and not component_seen:
                            self.add("BLOCKER", "REACT_HOOK_OUTSIDE_COMPONENT",
                                     "React hook is emitted before the component declaration",
                                     path=relative, line=line_no)
                            break
                elif path.suffix == ".java":
                    methods = [
                        (name, re.sub(r"\s+", " ", args.strip()))
                        for name, args in java_method_pattern.findall(text)
                    ]
                    duplicates = [signature for signature, count in Counter(methods).items() if count > 1]
                    for name, args in duplicates:
                        self.add("BLOCKER", "JAVA_METHOD_SIGNATURE_DUPLICATE",
                                 f"Generated Java method signature is duplicated: {name}({args})",
                                 path=relative)

    def build_manifest(self, screens: list[dict[str, Any]]) -> tuple[dict[str, Any], dict[str, Any]]:
        previous: dict[str, Any] = {}
        if self.previous_manifest and self.previous_manifest.is_file():
            try:
                previous = json.loads(self.previous_manifest.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                previous = {}
        old_hashes = previous.get("contractHashes", {}) if isinstance(previous, dict) else {}
        hashes: dict[str, str] = {}
        changed: list[dict[str, Any]] = []
        nodes: list[dict[str, Any]] = []
        edges: list[dict[str, str]] = []

        for screen in screens:
            contract_id = str(screen.get("contract_id"))
            contract_hash = digest(screen)
            hashes[contract_id] = contract_hash
            if old_hashes.get(contract_id) != contract_hash:
                changed.append({
                    "contractId": screen.get("contract_id"),
                    "route": screen.get("route"),
                    "processCode": screen.get("process_code"),
                    "affectedLayers": ALL_LAYERS,
                })
            process_node = f"process:{screen.get('process_code')}"
            screen_node = f"screen:{contract_id}"
            nodes.extend([
                {"id": process_node, "type": "PROCESS"},
                {"id": screen_node, "type": "SCREEN", "route": screen.get("route")},
            ])
            edges.append({"from": process_node, "to": screen_node, "type": "OWNS"})
            for api in screen.get("apis") or []:
                api_node = f"api:{api.get('method')}:{api.get('path')}"
                nodes.append({"id": api_node, "type": "API"})
                edges.append({"from": screen_node, "to": api_node, "type": "CALLS"})
            for field in screen.get("fields") or []:
                field_node = f"field:{contract_id}:{field.get('code')}"
                nodes.append({"id": field_node, "type": "FIELD"})
                edges.append({"from": screen_node, "to": field_node, "type": "CONTAINS"})

        unique_nodes = {node["id"]: node for node in nodes}
        manifest = {
            "schemaVersion": "2.0",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "catalogHash": digest(screens),
            "contractCount": len(screens),
            "contractHashes": hashes,
            "changedContracts": changed,
        }
        graph = {
            "schemaVersion": "1.0",
            "nodes": list(unique_nodes.values()),
            "edges": edges,
            "changedContracts": changed,
        }
        return manifest, graph

    def run(self, report_dir: Path) -> int:
        screens = self.load_catalog()
        for screen in screens:
            self.validate_screen(screen)
        self.validate_cross_screen(screens)
        self.inspect_generated_sources()
        manifest, graph = self.build_manifest(screens)

        report_dir.mkdir(parents=True, exist_ok=True)
        blockers = [item for item in self.findings if item.severity == "BLOCKER"]
        report = {
            "success": not blockers,
            "status": "PROMOTABLE" if not blockers else "BLOCKED",
            "catalog": str(self.catalog_path),
            "contractCount": len(screens),
            "blockerCount": len(blockers),
            "warningCount": sum(item.severity == "WARNING" for item in self.findings),
            "findingCounts": dict(Counter(item.code for item in self.findings)),
            "findings": [item.as_dict() for item in self.findings],
            "changedContracts": manifest["changedContracts"],
        }
        (report_dir / "design-manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        (report_dir / "impact-graph.json").write_text(
            json.dumps(graph, ensure_ascii=False, indent=2), encoding="utf-8")
        (report_dir / "promotion-report.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps({
            "success": report["success"],
            "status": report["status"],
            "contracts": len(screens),
            "blockers": len(blockers),
            "changedContracts": len(manifest["changedContracts"]),
            "report": str(report_dir / "promotion-report.json"),
        }, ensure_ascii=False))
        return 0 if report["success"] else 2


def parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--report-dir", type=Path, required=True)
    parser.add_argument("--previous-manifest", type=Path)
    return parser.parse_args(argv)


def main(argv: Iterable[str] | None = None) -> int:
    args = parse_args(argv)
    return QualityGate(args.catalog, args.source_root, args.previous_manifest).run(args.report_dir)


if __name__ == "__main__":
    sys.exit(main())
