#!/usr/bin/env bash
set -euo pipefail

# Create a metadata-first project package that reuses the shared Gradle runtime.
# Usage: create-new-project.sh <project-id> [project-name] [database-name] [theme-id] [port]

PROJECT_ID="${1:-}"
PROJECT_NAME="${2:-$PROJECT_ID}"
DATABASE_NAME="${3:-${PROJECT_ID,,}}"
THEME_ID="${4:-theme-default}"
PORT="${5:-18080}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT_DIR="$ROOT_DIR/projects/$PROJECT_ID"
GLOBAL_MANIFEST="$ROOT_DIR/data/version-control/project-runtime-manifest.json"

if [[ ! "$PROJECT_ID" =~ ^[A-Za-z][A-Za-z0-9_-]{1,31}$ ]]; then
  echo "project-id must match ^[A-Za-z][A-Za-z0-9_-]{1,31}$" >&2
  exit 2
fi
if [[ ! "$DATABASE_NAME" =~ ^[a-z][a-z0-9_]{1,62}$ ]]; then
  echo "database-name must match ^[a-z][a-z0-9_]{1,62}$" >&2
  exit 2
fi
if [[ ! "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1024 || PORT > 65535 )); then
  echo "port must be between 1024 and 65535" >&2
  exit 2
fi
if [[ -e "$PROJECT_DIR" ]]; then
  echo "project already exists: $PROJECT_DIR" >&2
  exit 1
fi

mkdir -p "$PROJECT_DIR/screens" "$PROJECT_DIR/themes" "$PROJECT_DIR/db/flyway" "$PROJECT_DIR/assets"

python3 - "$PROJECT_ID" "$PROJECT_NAME" "$DATABASE_NAME" "$THEME_ID" "$PORT" "$PROJECT_DIR" "$GLOBAL_MANIFEST" <<'PY'
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

project_id, project_name, database_name, theme_id, port, project_dir, global_path = sys.argv[1:]
project_dir = Path(project_dir)
global_path = Path(global_path)
now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
db_url = f"jdbc:postgresql://postgres-haproxy.carbonet-prod.svc.cluster.local:5432/{database_name}?sslmode=disable"

manifest = {
    "schemaVersion": 1,
    "metadata": {
        "projectId": project_id,
        "projectName": project_name,
        "owner": "project-team",
        "description": f"Metadata-first Resonance project {project_id}"
    },
    "installations": {
        "commonCore": "workspace",
        "stableGate": "v1",
        "adapter": "none",
        "adapterContract": "v1"
    },
    "bindings": {
        "database": {
            "bindingMode": "PROJECT_DB",
            "projectDb": {"url": db_url, "schema": "public"}
        },
        "theme": {"id": theme_id, "version": "1"},
        "menu": {"profile": f"{project_id}-admin-v1", "apiPrefix": "/api"}
    },
    "runtime": {
        "packagePath": "apps/carbonet-api/build/libs/carbonet-api.jar",
        "manifestPath": f"projects/{project_id}/manifest.json",
        "bootTarget": f"var/run/project-runtime/{project_id}/carbonet-api.jar",
        "bootCommand": f"bash ops/scripts/start-project-runtime.sh {project_id} {port}",
        "runtimeMode": "DEDICATED_PROJECT_RUNTIME",
        "lane": "PROJECT_RUNTIME",
        "sharedRuntimeId": "carbonet-api",
        "status": "READY_FOR_DATABASE",
        "routing": {
            "selectorPath": f"/projects/{project_id}",
            "routePrefix": f"/r/{project_id}",
            "managementPath": f"/api/operations/governance/runtime/projects/{project_id}",
            "infoPath": "/api/runtime/project-info"
        }
    },
    "governance": {"compatibilityClass": "METADATA_FIRST", "updatedAt": now}
}

(project_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(project_dir / "screens" / "overrides.json").write_text(json.dumps({
    "schemaVersion": 1, "projectId": project_id, "inherit": "shared", "screens": []
}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(project_dir / "themes" / "tokens.json").write_text(json.dumps({
    "schemaVersion": 1, "projectId": project_id, "themeId": theme_id,
    "extends": "krds-current", "tokens": {}
}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(project_dir / "db" / "flyway" / ".gitkeep").touch()
(project_dir / "assets" / ".gitkeep").touch()

registry = {"projects": {}}
if global_path.exists():
    registry = json.loads(global_path.read_text(encoding="utf-8-sig"))
registry.setdefault("projects", {})[project_id] = manifest
temporary = global_path.with_suffix(global_path.suffix + ".tmp")
temporary.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
os.replace(temporary, global_path)
PY

python3 -m json.tool "$PROJECT_DIR/manifest.json" >/dev/null
python3 -m json.tool "$PROJECT_DIR/screens/overrides.json" >/dev/null
python3 -m json.tool "$PROJECT_DIR/themes/tokens.json" >/dev/null

echo "Created metadata-first project: $PROJECT_ID"
echo "  manifest: projects/$PROJECT_ID/manifest.json"
echo "  database: $DATABASE_NAME (provision separately through Patroni)"
echo "  next: ops/scripts/provision-project-postgres.sh $PROJECT_ID"
