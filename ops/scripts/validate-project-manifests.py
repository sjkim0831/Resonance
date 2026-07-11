#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = ROOT / "projects" / "project-manifest.schema.json"
REGISTRY_PATH = ROOT / "data" / "version-control" / "project-runtime-manifest.json"


def validate(label: str, payload: dict, validator: Draft202012Validator) -> list[str]:
    errors = []
    for error in sorted(validator.iter_errors(payload), key=lambda item: list(item.path)):
        location = ".".join(str(part) for part in error.path) or "$"
        errors.append(f"{label}:{location}: {error.message}")
    return errors


def main() -> int:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8-sig"))
    validator = Draft202012Validator(schema)
    failures: list[str] = []
    legacy: list[str] = []
    canonical_registry: dict[str, dict] = {}
    checked = 0

    for project_id, payload in sorted(registry.get("projects", {}).items()):
        if payload.get("schemaVersion") != 1:
            legacy.append(project_id)
            continue
        checked += 1
        canonical_registry[project_id] = payload
        failures.extend(validate(f"registry:{project_id}", payload, validator))

    for manifest_path in sorted((ROOT / "projects").glob("*/manifest.json")):
        payload = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
        checked += 1
        failures.extend(validate(str(manifest_path.relative_to(ROOT)), payload, validator))
        project_id = payload.get("metadata", {}).get("projectId", "")
        if project_id in canonical_registry and canonical_registry[project_id] != payload:
            failures.append(f"{manifest_path.relative_to(ROOT)}: differs from global registry")

    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 1
    if legacy:
        print(f"Legacy manifests skipped: {', '.join(legacy)}", file=sys.stderr)
        if os.environ.get("STRICT_PROJECT_MANIFESTS", "").lower() == "true":
            return 1
    print(f"Validated {checked} canonical project manifest(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
