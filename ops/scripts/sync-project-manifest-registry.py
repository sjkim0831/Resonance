#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = ROOT / "data" / "version-control" / "project-runtime-manifest.json"


def main() -> int:
    project_ids = sys.argv[1:]
    if not project_ids:
        raise SystemExit("usage: sync-project-manifest-registry.py <project-id> [...]")
    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8-sig"))
    projects = registry.setdefault("projects", {})
    for project_id in project_ids:
        manifest_path = ROOT / "projects" / project_id / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
        actual_id = manifest.get("metadata", {}).get("projectId")
        if actual_id != project_id:
            raise SystemExit(f"project id mismatch: {project_id} != {actual_id}")
        projects[project_id] = manifest
    temporary = REGISTRY_PATH.with_suffix(REGISTRY_PATH.suffix + ".tmp")
    temporary.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, REGISTRY_PATH)
    print(f"Synchronized {len(project_ids)} project manifest(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
