#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
OVERLAY_DIR="${OVERLAY_DIR:-$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static/react-app}"
SOURCE_DIR="${SOURCE_DIR:-$ROOT_DIR/projects/carbonet-frontend/source}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/var/backups/frontend-overlay}"
BASE_URL="${BASE_URL:-http://127.0.0.1}"
MIN_ASSET_COUNT="${MIN_ASSET_COUNT:-50}"
MARKER_FILE="${MARKER_FILE:-$OVERLAY_DIR/.resonance-build.json}"

usage() {
  cat <<'USAGE'
Usage:
  bash ops/scripts/resonance-frontend-overlay-guard.sh backup
  bash ops/scripts/resonance-frontend-overlay-guard.sh verify-local
  bash ops/scripts/resonance-frontend-overlay-guard.sh verify-http
  bash ops/scripts/resonance-frontend-overlay-guard.sh write-marker
  bash ops/scripts/resonance-frontend-overlay-guard.sh verify-source
  bash ops/scripts/resonance-frontend-overlay-guard.sh verify-all

Purpose:
  Prevent frontend overlay loss or stale hashed asset references during build/deploy.
USAGE
}

source_hash() {
  python3 - "$SOURCE_DIR" <<'PY'
import hashlib
import os
import sys
from pathlib import Path

root = Path(sys.argv[1])
include_files = []
for rel in ["index.html", "package.json", "package-lock.json", "tsconfig.json", "vite.config.ts"]:
    p = root / rel
    if p.is_file():
        include_files.append(p)
for sub in ["src", "scripts"]:
    base = root / sub
    if base.is_dir():
        for p in base.rglob("*"):
            if p.is_file() and not any(part in {"node_modules", "dist", "build"} for part in p.parts):
                include_files.append(p)

h = hashlib.sha256()
for p in sorted(set(include_files), key=lambda x: str(x.relative_to(root))):
    rel = str(p.relative_to(root)).replace(os.sep, "/")
    h.update(rel.encode())
    h.update(b"\0")
    h.update(p.read_bytes())
    h.update(b"\0")
print(h.hexdigest())
PY
}

write_marker() {
  local hash ts index_hash manifest_hash
  hash="$(source_hash)"
  ts="$(date -Iseconds)"
  index_hash="$(sha256sum "$OVERLAY_DIR/index.html" | awk '{print $1}')"
  manifest_hash="$(sha256sum "$OVERLAY_DIR/.vite/manifest.json" | awk '{print $1}')"
  python3 - "$MARKER_FILE" "$hash" "$ts" "$index_hash" "$manifest_hash" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
path.write_text(json.dumps({
    "sourceHash": sys.argv[2],
    "builtAt": sys.argv[3],
    "indexHash": sys.argv[4],
    "manifestHash": sys.argv[5],
    "sourceDir": "projects/carbonet-frontend/source",
    "overlayDir": "projects/carbonet-frontend/src/main/resources/static/react-app"
}, ensure_ascii=False, indent=2) + "\n")
PY
  echo "[guard] marker written hash=$hash"
}

verify_source() {
  test -f "$MARKER_FILE" || {
    echo "[guard] missing frontend build marker: $MARKER_FILE" >&2
    echo "[guard] run npm build or guard write-marker after a verified build" >&2
    exit 30
  }
  local expected actual expected_index actual_index expected_manifest actual_manifest
  actual="$(source_hash)"
  readarray -t marker_values < <(python3 - "$MARKER_FILE" <<'PY'
import json
import sys
from pathlib import Path
data = json.loads(Path(sys.argv[1]).read_text())
print(data.get("sourceHash", ""))
print(data.get("indexHash", ""))
print(data.get("manifestHash", ""))
PY
)
  expected="${marker_values[0]:-}"
  expected_index="${marker_values[1]:-}"
  expected_manifest="${marker_values[2]:-}"
  if [[ -z "$expected" || "$actual" != "$expected" ]]; then
    echo "[guard] React source hash does not match overlay build marker" >&2
    echo "[guard] expected=$expected" >&2
    echo "[guard] actual=$actual" >&2
    echo "[guard] run frontend build before deploying" >&2
    exit 31
  fi
  actual_index="$(sha256sum "$OVERLAY_DIR/index.html" | awk '{print $1}')"
  actual_manifest="$(sha256sum "$OVERLAY_DIR/.vite/manifest.json" | awk '{print $1}')"
  if [[ -z "$expected_index" || -z "$expected_manifest" \
     || "$actual_index" != "$expected_index" \
     || "$actual_manifest" != "$expected_manifest" ]]; then
    echo "[guard] React entry graph does not match the verified build marker" >&2
    echo "[guard] rebuild the frontend closure before deploying" >&2
    exit 32
  fi
  echo "[guard] source marker OK ($actual)"
}

asset_refs() {
  python3 - "$OVERLAY_DIR/index.html" <<'PY'
import re
import sys
from pathlib import Path

html = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
refs = []
for value in re.findall(r'''(?:src|href)=["']([^"']+)["']''', html):
    if "/assets/react/assets/" in value or value.startswith("assets/"):
        refs.append(value)
for ref in sorted(set(refs)):
    print(ref)
PY
}

ref_to_file() {
  local ref="$1"
  ref="${ref%%\?*}"
  ref="${ref#/}"
  case "$ref" in
    assets/react/*) ref="${ref#assets/react/}" ;;
  esac
  printf '%s/%s\n' "$OVERLAY_DIR" "$ref"
}

backup_overlay() {
  mkdir -p "$BACKUP_DIR"
  local ts out
  ts="$(date +%Y%m%d-%H%M%S)"
  out="$BACKUP_DIR/react-app-overlay-$ts.tar.gz"
  tar -C "$OVERLAY_DIR" -czf "$out" .
  echo "[guard] backup=$out"
}

verify_local() {
  test -d "$OVERLAY_DIR" || { echo "[guard] missing overlay dir: $OVERLAY_DIR" >&2; exit 10; }
  test -f "$OVERLAY_DIR/index.html" || { echo "[guard] missing index.html" >&2; exit 11; }
  test -d "$OVERLAY_DIR/assets" || { echo "[guard] missing assets dir" >&2; exit 12; }

  local asset_count
  asset_count="$(find "$OVERLAY_DIR/assets" -maxdepth 1 -type f | wc -l)"
  if [[ "$asset_count" -lt "$MIN_ASSET_COUNT" ]]; then
    echo "[guard] asset count too small: $asset_count < $MIN_ASSET_COUNT" >&2
    exit 13
  fi

  local missing=0 ref file
  while IFS= read -r ref; do
    file="$(ref_to_file "$ref")"
    if [[ ! -f "$file" ]]; then
      echo "[guard] index references missing asset: $ref -> $file" >&2
      missing=1
    fi
  done < <(asset_refs)
  [[ "$missing" -eq 0 ]] || exit 14

  local required_patterns=(
    "MonitoringDashboard"
    "MonitoringRealtime"
    "MonitoringExport"
    "MonitoringStatistics"
    "MonitoringReductionTrend"
    "MonitoringShare"
    "MonitoringTrack"
    "MonitoringAlerts"
    "ExternalMonitoring"
    "SecurityMonitoring"
    "Observability"
  )
  local pattern
  for pattern in "${required_patterns[@]}"; do
    if ! find "$OVERLAY_DIR/assets" -maxdepth 1 -type f -name "*${pattern}*.js" -print -quit | grep -q .; then
      echo "[guard] missing required monitoring/observability bundle pattern: $pattern" >&2
      exit 15
    fi
  done

  echo "[guard] local overlay OK (assets=$asset_count)"
}

verify_http() {
  verify_local >/dev/null
  local ref url status failed=0
  while IFS= read -r ref; do
    [[ -n "$ref" ]] || continue
    if [[ "$ref" == /* ]]; then
      url="$BASE_URL$ref"
    else
      url="$BASE_URL/assets/react/$ref"
    fi
    status="$(curl -skL --max-time 15 -o /dev/null -w '%{http_code}' "$url" || true)"
    if [[ "$status" != "200" ]]; then
      echo "[guard] HTTP asset not available: $status $url" >&2
      failed=1
    fi
  done < <(asset_refs)
  [[ "$failed" -eq 0 ]] || exit 20
  echo "[guard] HTTP hashed assets OK ($BASE_URL)"
}

cmd="${1:-}"
case "$cmd" in
  backup) backup_overlay ;;
  verify-local) verify_local ;;
  verify-http) verify_http ;;
  write-marker) write_marker ;;
  verify-source) verify_source ;;
  verify-all) verify_local; verify_source; verify_http ;;
  -h|--help|"") usage ;;
  *) echo "Unknown command: $cmd" >&2; usage >&2; exit 2 ;;
esac
