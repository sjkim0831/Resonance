# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] hermes-sync-project-knowledge.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
CUBRID_POD="${CUBRID_POD:-cubrid-carbonet-0}"
DB_NAME="${DB_NAME:-carbonet}"
DB_USER="${DB_USER:-dba}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/var/ai-runtime/hermes-project-knowledge}"
SCHEMA_SQL="${SCHEMA_SQL:-$ROOT_DIR/ops/db/carbonet/20260518_008_hermes_project_knowledge_and_work_guard.sql}"
APPLY_DB="Y"
PROJECT_ID="carbonet"
mkdir -p "$OUT_DIR"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      APPLY_DB="N"
      shift
      ;;
    --apply)
      APPLY_DB="Y"
      shift
      ;;
    --project-id)
      PROJECT_ID="${2:-carbonet}"
      shift 2
      ;;
    --out-dir)
      OUT_DIR="${2:-$OUT_DIR}"
      mkdir -p "$OUT_DIR"
      shift 2
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BATCH_ID="knowledge-$STAMP-$$"
ASSET_JSON="$OUT_DIR/$BATCH_ID.assets.json"
DATA_SQL="$OUT_DIR/$BATCH_ID.assets.sql"
SUMMARY_JSON="$OUT_DIR/$BATCH_ID.summary.json"

python3 - "$ROOT_DIR" "$PROJECT_ID" "$BATCH_ID" "$ASSET_JSON" "$DATA_SQL" "$SUMMARY_JSON" <<'PY'
import hashlib
import json
import os
import pathlib
import subprocess
import sys

root, project_id, batch_id, asset_json, data_sql, summary_json = sys.argv[1:7]
root_path = pathlib.Path(root)

scan_roots = [
    ".codex/skills",
    "docs/ai",
    "docs/architecture",
    "docs/operations",
    "docs/sql",
    "ops/scripts",
    "ops/db",
    "ops/codex-launcher",
    "frontend/src/features",
    "frontend/src/app",
    "frontend/src/lib",
    "frontend/scripts",
    "projects/carbonet-frontend/source/src/features",
    "projects/carbonet-frontend/source/src/app",
    "projects/carbonet-frontend/source/src/platform",
    "projects/carbonet-frontend/source/src/framework",
    "projects/carbonet-frontend/source/src/lib",
    "projects/carbonet-frontend/source/scripts",
    "projects/carbonet-runtime/src/main/java",
    "projects/carbonet-runtime/src/main/resources",
    "apps/carbonet-app/src/main/java",
    "apps/carbonet-app/src/main/resources",
    "modules/carbonet-common-core/src/main/java",
    "modules/carbonet-common-core/src/main/resources",
    "modules/resonance-builder",
    "modules/resonance-ops",
    "modules/resonance-common",
    "modules/resonance-common/carbonet-common-core/src/main/java",
    "modules/resonance-common/carbonet-common-core/src/main/resources",
    "src/main/java",
    "src/main/resources",
]
skip_dirs = {
    ".git", "node_modules", "target", "dist", "build", ".vite", "__pycache__",
    "static", "assets", ".gradle", ".mvn", "coverage",
}

def run(cmd):
    result = subprocess.run(cmd, cwd=root, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)
    return result.stdout

def lit(value, limit=3900):
    text = "" if value is None else str(value)
    text = text.replace("\r", " ").replace("\n", " ").strip()
    return "'" + text[:limit].replace("'", "''") + "'"

def hash_text(text):
    return hashlib.sha1(text.encode("utf-8", errors="ignore")).hexdigest()

def file_hash(path):
    try:
        data = path.read_bytes()
        return hashlib.sha1(data).hexdigest()
    except Exception:
        return ""

def rel(path):
    try:
        return str(path.relative_to(root_path)).replace("\\", "/")
    except ValueError:
        return str(path).replace("\\", "/")

def classify(path, is_dir):
    p = path.lower()
    name = pathlib.PurePosixPath(p).name
    if is_dir:
        if p.startswith(".codex/skills"):
            return "SKILL_DIRECTORY"
        if p.startswith("frontend/src/features") or p.startswith("projects/carbonet-frontend/source/src/features"):
            return "FRONTEND_FEATURE_DIRECTORY"
        if p.startswith("frontend/") or p.startswith("projects/carbonet-frontend/source/"):
            return "FRONTEND_DIRECTORY"
        if p.startswith("modules/") or p.startswith("src/main/java"):
            return "BACKEND_DIRECTORY"
        if p.startswith("ops/scripts"):
            return "HARNESS_DIRECTORY"
        if p.startswith("ops/db") or p.startswith("docs/sql"):
            return "SQL_DIRECTORY"
        if p.startswith("docs/"):
            return "DOC_DIRECTORY"
        return "DIRECTORY"
    if p.endswith("/skill.md") or p == "skill.md":
        return "SKILL"
    if p.endswith(".md"):
        return "DOC"
    if p.endswith(".sh") or p.endswith(".mjs") or p.endswith(".js") and ("frontend/scripts" in p or "projects/carbonet-frontend/source/scripts" in p):
        return "HARNESS_SCRIPT"
    if p.endswith(".sql"):
        return "SQL"
    if p.endswith(".tsx") or p.endswith(".ts") or p.endswith(".css"):
        return "FRONTEND_SOURCE"
    if p.endswith(".java") or p.endswith(".xml") or p.endswith(".yml") or p.endswith(".properties"):
        return "BACKEND_SOURCE"
    if p.endswith(".json"):
        return "CONFIG_JSON"
    return "SOURCE_FILE"

def infer_pattern(path, asset_type):
    p = path.lower()
    if "hermes" in p or "ai-agent" in p or "codex" in p:
        return "HERMES_PATTERN_REGISTRY_CHANGE", "codex55-execution-intelligence"
    if p.startswith("frontend/src/features") or p.startswith("projects/carbonet-frontend/source/src/features") or asset_type.startswith("FRONTEND"):
        return "ADMIN_REACT_PAGE_CHANGE", "frontend-dev"
    if p.startswith("modules/") or p.startswith("src/main/java") or asset_type.startswith("BACKEND"):
        return "BACKEND_CONTROLLER_SERVICE_API_CHANGE", "backend-dev"
    if p.startswith("ops/db") or p.startswith("docs/sql") or asset_type.startswith("SQL"):
        return "DB_SCHEMA_PATCH_CHANGE", "db-cubrid"
    if p.startswith("ops/scripts") or p.startswith("frontend/scripts") or p.startswith("projects/carbonet-frontend/source/scripts") or asset_type.startswith("HARNESS"):
        return "BUILD_RESTART_18000", "build-release"
    if p.startswith(".codex/skills") or p.startswith("docs/"):
        return "HERMES_PATTERN_REGISTRY_CHANGE", "planning"
    return "", ""

def owner_surface(path, asset_type):
    p = path.lower()
    if p.startswith("frontend/") or p.startswith("projects/carbonet-frontend/source/"):
        return "FRONTEND"
    if p.startswith("modules/") or p.startswith("src/main/"):
        return "BACKEND"
    if p.startswith("ops/db") or p.startswith("docs/sql"):
        return "DATABASE"
    if p.startswith("ops/scripts") or p.startswith("ops/codex-launcher") or p.startswith("frontend/scripts"):
        return "HARNESS"
    if p.startswith(".codex/skills"):
        return "SKILL"
    if p.startswith("docs/"):
        return "DOC"
    return asset_type

def summarize_file(path, asset_type):
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if asset_type == "SKILL":
        for line in lines[:30]:
            if line.startswith("description:"):
                return line[:700]
    if asset_type == "DOC":
        for line in lines[:80]:
            if line.startswith("#"):
                return line[:700]
    if asset_type == "HARNESS_SCRIPT":
        return "script: " + " | ".join(lines[:4])[:650]
    if asset_type == "SQL":
        return "sql: " + " | ".join([line for line in lines[:20] if not line.startswith("--")][:3])[:650]
    return " | ".join(lines[:3])[:700]

assets = []
seen = set()

def add_asset(path, is_dir):
    rel_path = rel(path)
    if rel_path in seen:
        return
    seen.add(rel_path)
    asset_type = classify(rel_path, is_dir)
    pattern_id, team_id = infer_pattern(rel_path, asset_type)
    parent = str(pathlib.PurePosixPath(rel_path).parent)
    if parent == ".":
        parent = ""
    depth = 0 if not rel_path else rel_path.count("/")
    file_count = 0
    dir_count = 0
    summary = ""
    content_hash = ""
    if is_dir:
        try:
            children = list(path.iterdir())
            file_count = sum(1 for child in children if child.is_file())
            dir_count = sum(1 for child in children if child.is_dir())
            summary = f"directory with {file_count} files and {dir_count} child directories"
            content_hash = hash_text(rel_path + ":" + ",".join(sorted(child.name for child in children)[:200]))
        except Exception:
            summary = "directory"
            content_hash = hash_text(rel_path)
    else:
        content_hash = file_hash(path)
        summary = summarize_file(path, asset_type)
    asset_id = "asset-" + hash_text(project_id + ":" + rel_path)[:32]
    assets.append({
        "knowledgeAssetId": asset_id,
        "projectId": project_id,
        "scanBatchId": batch_id,
        "assetType": asset_type,
        "assetPath": rel_path,
        "parentPath": parent,
        "depth": depth,
        "ownerSurface": owner_surface(rel_path, asset_type),
        "primaryPatternId": pattern_id,
        "primaryTeamId": team_id,
        "fileCount": file_count,
        "directoryCount": dir_count,
        "contentHash": content_hash,
        "summary": summary,
        "patternHints": json.dumps({
            "patternId": pattern_id,
            "teamId": team_id,
            "assetType": asset_type,
            "restoreHint": "Use git diff/status for files; use migration id for SQL; use deploy artifact id for runtime changes.",
        }, ensure_ascii=False),
        "evidenceRef": str(path),
    })

for root_rel in scan_roots:
    start = root_path / root_rel
    if not start.exists():
        continue
    add_asset(start, start.is_dir())
    if start.is_dir():
        for current, dirs, files in os.walk(start):
            dirs[:] = [item for item in dirs if item not in skip_dirs and not item.startswith(".cache")]
            current_path = pathlib.Path(current)
            add_asset(current_path, True)
            for filename in files:
                if filename.endswith((".map", ".png", ".jpg", ".jpeg", ".gif", ".woff", ".woff2", ".class", ".jar")):
                    continue
                file_path = current_path / filename
                if file_path.stat().st_size > 512 * 1024:
                    continue
                add_asset(file_path, False)
    else:
        add_asset(start, False)

assets.sort(key=lambda item: (item["assetType"], item["assetPath"]))
type_counts = {}
for asset in assets:
    type_counts[asset["assetType"]] = type_counts.get(asset["assetType"], 0) + 1

summary = {
    "scanBatchId": batch_id,
    "projectId": project_id,
    "root": root,
    "assetCount": len(assets),
    "typeCounts": type_counts,
    "git": run(["bash", "-lc", "git rev-parse --abbrev-ref HEAD 2>/dev/null; git status --short | head -80"]),
}
pathlib.Path(asset_json).write_text(json.dumps(assets, ensure_ascii=False, indent=2), encoding="utf-8")
pathlib.Path(summary_json).write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

statements = []
statements.append(
    "INSERT INTO hermes_project_scan_batch (scan_batch_id, project_id, scan_type, root_path, status, asset_count, evidence_ref, summary) SELECT "
    + ", ".join([
        lit(batch_id, 100),
        lit(project_id, 60),
        "'PROJECT_KNOWLEDGE'",
        lit(root, 1000),
        "'COMPLETED'",
        str(len(assets)),
        lit(asset_json, 1000),
        lit(json.dumps(summary, ensure_ascii=False), 3900),
    ])
    + f" FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_project_scan_batch WHERE scan_batch_id = {lit(batch_id, 100)});"
)

for asset in assets:
    statements.append(
        "INSERT INTO hermes_project_knowledge_asset (knowledge_asset_id, project_id, scan_batch_id, asset_type, asset_path, parent_path, asset_depth, owner_surface, primary_pattern_id, primary_team_id, file_count, directory_count, content_hash, summary, pattern_hints, evidence_ref) SELECT "
        + ", ".join([
            lit(asset["knowledgeAssetId"], 120),
            lit(asset["projectId"], 60),
            lit(asset["scanBatchId"], 100),
            lit(asset["assetType"], 80),
            lit(asset["assetPath"], 1000),
            lit(asset["parentPath"], 1000),
            str(asset["depth"]),
            lit(asset["ownerSurface"], 120),
            lit(asset["primaryPatternId"], 80),
            lit(asset["primaryTeamId"], 100),
            str(asset["fileCount"]),
            str(asset["directoryCount"]),
            lit(asset["contentHash"], 80),
            lit(asset["summary"], 3900),
            lit(asset["patternHints"], 3900),
            lit(asset["evidenceRef"], 1000),
        ])
        + f" FROM db_root WHERE NOT EXISTS (SELECT 1 FROM hermes_project_knowledge_asset WHERE knowledge_asset_id = {lit(asset['knowledgeAssetId'], 120)});"
    )
statements.append("COMMIT;")
pathlib.Path(data_sql).write_text("\n".join(statements) + "\n", encoding="utf-8")
print(json.dumps(summary, ensure_ascii=False))
PY

echo "[hermes-sync-project-knowledge] summary: $SUMMARY_JSON"
echo "[hermes-sync-project-knowledge] assets: $ASSET_JSON"
echo "[hermes-sync-project-knowledge] sql: $DATA_SQL"

if [ "$APPLY_DB" = "Y" ]; then
  kubectl -n "$NAMESPACE" cp "$SCHEMA_SQL" "$CUBRID_POD:/tmp/$(basename "$SCHEMA_SQL")"
  SCHEMA_LOG="$OUT_DIR/$BATCH_ID.schema-apply.log"
  DATA_LOG="$OUT_DIR/$BATCH_ID.data-apply.log"
  kubectl -n "$NAMESPACE" exec "$CUBRID_POD" -- bash -lc "csql -u '$DB_USER' '$DB_NAME' -i '/tmp/$(basename "$SCHEMA_SQL")'" | tee "$SCHEMA_LOG"
  if grep "ERROR:" "$SCHEMA_LOG" | grep -v "already defined" >/dev/null; then
    echo "[hermes-sync-project-knowledge] schema apply reported errors: $SCHEMA_LOG" >&2
    exit 1
  fi
  kubectl -n "$NAMESPACE" cp "$DATA_SQL" "$CUBRID_POD:/tmp/$(basename "$DATA_SQL")"
  kubectl -n "$NAMESPACE" exec "$CUBRID_POD" -- bash -lc "csql -u '$DB_USER' '$DB_NAME' -i '/tmp/$(basename "$DATA_SQL")'" | tee "$DATA_LOG"
  if grep -q "ERROR:" "$DATA_LOG"; then
    echo "[hermes-sync-project-knowledge] data apply reported errors: $DATA_LOG" >&2
    exit 1
  fi
else
  echo "[hermes-sync-project-knowledge] dry run only; DB not changed"
fi
