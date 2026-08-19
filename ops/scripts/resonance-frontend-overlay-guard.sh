#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
GUARD_PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OVERLAY_DIR="${OVERLAY_DIR:-$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static/react-app}"
SOURCE_DIR="${SOURCE_DIR:-$ROOT_DIR/projects/carbonet-frontend/source}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/var/backups/frontend-overlay}"
BACKUP_RETAIN_COUNT="${BACKUP_RETAIN_COUNT:-48}"
BASE_URL="${BASE_URL:-http://127.0.0.1}"
MIN_ASSET_COUNT="${MIN_ASSET_COUNT:-50}"
MARKER_FILE="${MARKER_FILE:-$OVERLAY_DIR/.resonance-build.json}"
SOURCE_RELATIVE_PATH="${CARBONET_FRONTEND_SOURCE_RELATIVE_PATH:-projects/carbonet-frontend/source}"

usage() {
  cat <<'USAGE'
Usage:
  bash ops/scripts/resonance-frontend-overlay-guard.sh backup
  bash ops/scripts/resonance-frontend-overlay-guard.sh prune-backups
  bash ops/scripts/resonance-frontend-overlay-guard.sh verify-local
  bash ops/scripts/resonance-frontend-overlay-guard.sh verify-http
  bash ops/scripts/resonance-frontend-overlay-guard.sh write-marker
  bash ops/scripts/resonance-frontend-overlay-guard.sh print-overlay-provenance
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
# These exact files are legacy merge backups or unused generator reports. They
# are never Vite inputs. Runtime definitions, their type contract, and tracked
# generated inventories deliberately remain in the materialized source hash.
legacy_non_inputs = {
    "package.json.orig",
    "scripts/run-frontend-pipeline.mjs.orig",
    "src/App.tsx.orig",
    "src/components/help/HelpOverlay.tsx.orig",
    "src/features/home-entry/GlobalUserGnbShell.tsx.orig",
    "src/features/join-company-reapply/JoinCompanyReapplyMigrationPage.tsx.orig",
    "src/features/process-step-workspace/ProcessStepWorkspacePage.tsx.orig",
    "src/features/screen-development-note/ScreenDevelopmentNotePanel.tsx.orig",
    "src/features/task-quest/TaskQuestPanel.tsx.orig",
    "src/generated/screen-generation/generatedScreenSpaceIndex.ts",
    "src/generated/screen-generation/generation-report.json",
    "tsconfig.app.tsbuildinfo",
}

if not root.is_dir() or root.is_symlink():
    raise SystemExit("frontend source root must be a regular directory")
non_input_directories = {
    "node_modules", "dist", "build", ".cache", "test-results",
    "playwright-report", "coverage",
}
for p in root.rglob("*"):
    rel_path = p.relative_to(root)
    rel = rel_path.as_posix()
    if rel_path.parts and rel_path.parts[0] in non_input_directories:
        continue
    if p.is_symlink():
        raise SystemExit(f"frontend source symlink is forbidden: {rel}")
    if p.is_file() and rel not in legacy_non_inputs:
        include_files.append(p)

h = hashlib.sha256()
for p in sorted(set(include_files), key=lambda x: str(x.relative_to(root))):
    rel = str(p.relative_to(root)).replace(os.sep, "/")
    h.update(rel.encode())
    h.update(b"\0")
    h.update(f"{p.stat().st_mode & 0o777:03o}".encode("ascii"))
    h.update(b"\0")
    h.update(p.read_bytes())
    h.update(b"\0")
print(h.hexdigest())
PY
}

frontend_git_identity() {
  local source_real expected_real source_commit frontend_tree
  source_real="$(realpath -e "$SOURCE_DIR")"
  expected_real="$(realpath -e "$ROOT_DIR/$SOURCE_RELATIVE_PATH")"
  [[ "$source_real" == "$expected_real" ]] || {
    echo "[guard] frontend source path is outside the canonical Git tree" >&2
    return 1
  }
  source_commit="$(git -C "$ROOT_DIR" rev-parse --verify HEAD)"
  frontend_tree="$(git -C "$ROOT_DIR" rev-parse "$source_commit:$SOURCE_RELATIVE_PATH")"
  [[ "$source_commit" =~ ^[0-9a-f]{40}$ && "$frontend_tree" =~ ^[0-9a-f]{40,64}$ ]] || {
    echo "[guard] frontend Git identity is invalid" >&2
    return 1
  }
  printf '%s\n%s\n' "$source_commit" "$frontend_tree"
}

frontend_residue_paths() {
  python3 - "$ROOT_DIR" "$SOURCE_RELATIVE_PATH" <<'PY'
import os
import subprocess
import sys
from pathlib import Path

repo = Path(sys.argv[1]).resolve()
source_rel = Path(sys.argv[2])
source = (repo / source_rel).resolve()
tracked_raw = subprocess.check_output(
    ["git", "-C", str(repo), "ls-files", "-z", "--", source_rel.as_posix()]
)
tracked = {item.decode("utf-8") for item in tracked_raw.split(b"\0") if item}
residue = set()
for current, dirnames, filenames in os.walk(source, followlinks=False):
    current_path = Path(current)
    kept_dirs = []
    for name in dirnames:
        path = current_path / name
        rel = path.relative_to(repo).as_posix()
        if current_path == source and name in {
            "node_modules", "dist", "build", ".cache", "test-results",
            "playwright-report", "coverage",
        }:
            continue
        if path.is_symlink():
            residue.add(rel)
        else:
            kept_dirs.append(name)
    dirnames[:] = kept_dirs
    for name in filenames:
        path = current_path / name
        rel = path.relative_to(repo).as_posix()
        if rel not in tracked:
            residue.add(rel)
for rel in sorted(residue):
    if "\n" in rel:
        raise SystemExit("newline is forbidden in frontend residue paths")
    print(rel)
PY
}

validate_deterministic_materialized_outputs() {
  local verify_root checkout_root archive_root rel
  if ! mkdir -p "$ROOT_DIR/var/run" \
     || ! verify_root="$(mktemp -d "$ROOT_DIR/var/run/frontend-marker-determinism.XXXXXX")"; then
    echo "[guard] deterministic frontend verification workspace could not be created" >&2
    return 1
  fi
  checkout_root="$verify_root/tree"
  archive_root="$checkout_root/$SOURCE_RELATIVE_PATH"
  if [[ "$verify_root" != "$ROOT_DIR/var/run/frontend-marker-determinism."* ]] \
     || ! mkdir -p "$checkout_root"; then
    [[ "$verify_root" == "$ROOT_DIR/var/run/frontend-marker-determinism."* ]] \
      && rm -rf -- "$verify_root"
    echo "[guard] deterministic frontend verification path is unsafe" >&2
    return 1
  fi
  # checkout-index applies the repository's EOL/filter attributes. git archive
  # emits raw blob bytes and would make deterministic generators see CRLF even
  # though every real Linux worktree contains normalized LF source.
  if ! git -C "$ROOT_DIR" ls-files -z -- "$SOURCE_RELATIVE_PATH" \
       | git -C "$ROOT_DIR" checkout-index -f -z --stdin --prefix="$checkout_root/"; then
    rm -rf -- "$verify_root"
    echo "[guard] clean frontend source could not be materialized for deterministic verification" >&2
    return 1
  fi
  if find "$archive_root" -type l -print -quit | grep -q .; then
    rm -rf -- "$verify_root"
    echo "[guard] deterministic frontend verification archive contains a symlink" >&2
    return 1
  fi
  if ! (cd "$archive_root" \
        && node scripts/generate-page-completeness-inventory.mjs >/dev/null \
        && node scripts/dedupe-generated-route-family.mjs >/dev/null); then
    rm -rf -- "$verify_root"
    echo "[guard] deterministic frontend generators failed" >&2
    return 1
  fi
  for rel in \
    src/generated/screen-generation/generatedScreenFamily.ts \
    src/features/builder-studio/pageCompletenessInventory.ts \
    src/features/builder-studio/routeSourceInventory.ts; do
    if ! cmp -s -- "$SOURCE_DIR/$rel" "$archive_root/$rel"; then
      rm -rf -- "$verify_root"
      echo "[guard] frontend materialized output is not the deterministic HEAD result: $rel" >&2
      return 1
    fi
  done
  if ! rm -rf -- "$verify_root"; then
    echo "[guard] deterministic frontend verification workspace cleanup failed" >&2
    return 1
  fi
}

materialization_closure_values() {
  local generated_root manifest page_inventory route_inventory manifest_sha
  local catalog type_contract definitions definition_count catalog_sha type_sha
  generated_root="$SOURCE_DIR/src/generated/screen-generation"
  manifest="$generated_root/generatedScreenDefinitionClosure.json"
  catalog="$generated_root/generatedScreenCatalog.ts"
  type_contract="$generated_root/generatedScreenTypes.ts"
  definitions="$generated_root/definitions"
  page_inventory="$SOURCE_DIR/src/features/builder-studio/pageCompletenessInventory.ts"
  route_inventory="$SOURCE_DIR/src/features/builder-studio/routeSourceInventory.ts"
  [[ -f "$manifest" && ! -L "$manifest" && -f "$catalog" && ! -L "$catalog" \
     && -f "$type_contract" && ! -L "$type_contract" \
     && -d "$definitions" && ! -L "$definitions" \
     && -f "$page_inventory" && ! -L "$page_inventory" \
     && -f "$route_inventory" && ! -L "$route_inventory" ]] || {
    echo "[guard] generated-screen materialization provenance is incomplete" >&2
    return 1
  }
  if find "$definitions" -mindepth 1 -maxdepth 1 \( -type l -o ! -type f -o ! -name '*.ts' \) -print -quit | grep -q .; then
    echo "[guard] generated-screen definition set contains an unsafe entry" >&2
    return 1
  fi
  definition_count="$(find "$definitions" -mindepth 1 -maxdepth 1 -type f -name '*.ts' | wc -l | tr -d ' ')"
  manifest_sha="$(sha256sum "$manifest" | awk '{print $1}')"
  catalog_sha="$(sha256sum "$catalog" | awk '{print $1}')"
  type_sha="$(sha256sum "$type_contract" | awk '{print $1}')"
  node --input-type=module - \
    "$GUARD_PROJECT_ROOT/projects/carbonet-frontend/source/scripts/generated-screen-definition-closure.mjs" \
    "$manifest" "$catalog" "$type_contract" "$definitions" <<'JS'
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const [modulePath, manifestPath, catalogPath, typePath, definitionsRoot] = process.argv.slice(2);
const closure = await import(pathToFileURL(modulePath).href);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const catalogSource = await readFile(catalogPath, "utf8");
const typeContractSource = await readFile(typePath, "utf8");
const imports = closure.parseGeneratedScreenDefinitionImports(catalogSource);
const definitionSet = await closure.inspectGeneratedScreenDefinitionSet(definitionsRoot, imports);
closure.validateGeneratedScreenDefinitionClosure({
  manifest,
  catalogSource,
  typeContractSource,
  definitionSet,
});
if (definitionSet.actualFileCount !== definitionSet.count || definitionSet.extraFiles.length !== 0) {
  throw new Error("generated screen definition closure contains extra files");
}
JS
  jq -er --arg manifestSha "$manifest_sha" \
    --arg catalogSha "$catalog_sha" \
    --arg typeSha "$type_sha" \
    --argjson definitionCount "$definition_count" \
    --arg pageSha "$(sha256sum "$page_inventory" | awk '{print $1}')" \
    --arg routeSha "$(sha256sum "$route_inventory" | awk '{print $1}')" '
      if .schema != "carbonet.generated-screen-definition-closure/v1"
         or .algorithm != "sha256"
         or .catalog.file != "generatedScreenCatalog.ts"
         or .catalog.sha256 != $catalogSha
         or .typeContract.file != "generatedScreenTypes.ts"
         or .typeContract.sha256 != $typeSha
         or .definitions.directory != "definitions"
         or .definitions.count != $definitionCount
      then error("materialized definition closure does not match its files")
      else [
        $manifestSha,
        .closureHash,
        .catalog.sha256,
        .definitions.setHash,
        .typeContract.sha256,
        $pageSha,
        $routeSha
      ] end
      | if all(.[]; type=="string" and test("^[0-9a-f]{64}$")) then .[]
        else error("invalid materialization closure") end
    ' "$manifest"
}

public_closure_values() {
  python3 - "$SOURCE_DIR/public" "$OVERLAY_DIR" <<'PY'
import hashlib
import sys
from pathlib import Path

source = Path(sys.argv[1])
overlay = Path(sys.argv[2]).resolve()
files = []
if source.exists():
    if not source.is_dir() or source.is_symlink():
        raise SystemExit("frontend public root must be a regular directory")
    for path in source.rglob("*"):
        rel = path.relative_to(source)
        if path.is_symlink():
            raise SystemExit(f"symlink is forbidden in public source: {rel.as_posix()}")
        if path.is_file():
            files.append((rel, path))

h = hashlib.sha256()
for rel, source_path in sorted(files, key=lambda item: item[0].as_posix()):
    candidate = overlay / rel
    cursor = candidate
    while cursor != overlay:
        if cursor.is_symlink():
            raise SystemExit(f"symlink is forbidden in public overlay: {rel.as_posix()}")
        cursor = cursor.parent
    target = candidate.resolve()
    if overlay not in target.parents or not target.is_file():
        raise SystemExit(f"missing public overlay asset: {rel.as_posix()}")
    source_bytes = source_path.read_bytes()
    target_bytes = target.read_bytes()
    if source_bytes != target_bytes:
        raise SystemExit(f"public overlay asset differs from source: {rel.as_posix()}")
    h.update(rel.as_posix().encode("utf-8"))
    h.update(b"\0")
    h.update(target_bytes)
    h.update(b"\0")
print(len(files))
print(h.hexdigest())
PY
}

entry_closure_values() {
  python3 - "$OVERLAY_DIR" "$MARKER_FILE" <<'PY'
import hashlib
import json
import os
import re
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
marker = Path(sys.argv[2]).resolve()
manifest_path = root / ".vite" / "manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
refs = {"index.html", ".vite/manifest.json"}
index_html = (root / "index.html").read_text(encoding="utf-8", errors="strict")
for value in re.findall(r'''(?:src|href)=["']([^"']+)["']''', index_html):
    value = value.strip()
    if (not value or value.startswith(("//", "#"))
            or re.match(r"^[A-Za-z][A-Za-z0-9+.-]*:", value)):
        continue
    refs.add(value)
for value in manifest.values():
    if not isinstance(value, dict):
        continue
    for key in ("file",):
        if isinstance(value.get(key), str):
            refs.add(value[key])
    for key in ("css", "assets"):
        for item in value.get(key) or []:
            if isinstance(item, str):
                refs.add(item)

h = hashlib.sha256()
count = 0
seen = set()
for raw in sorted(refs):
    rel = raw.split("?", 1)[0].lstrip("/")
    if rel.startswith("assets/react/"):
        rel = rel[len("assets/react/"):]
    rel = Path(rel).as_posix()
    if rel in seen:
        continue
    seen.add(rel)
    candidate = root / rel
    cursor = candidate
    while cursor != root:
        if cursor.is_symlink():
            raise SystemExit(f"symlink is forbidden in entry closure: {raw}")
        cursor = cursor.parent
    path = candidate.resolve()
    if path == marker or root not in path.parents or not path.is_file():
        raise SystemExit(f"invalid entry closure path: {raw}")
    normalized = path.relative_to(root).as_posix()
    h.update(normalized.encode("utf-8"))
    h.update(b"\0")
    h.update(path.read_bytes())
    h.update(b"\0")
    count += 1
print(count)
print(h.hexdigest())
PY
}

overlay_provenance_hash_from_values() {
  python3 - "$@" <<'PY'
import hashlib
import sys

values = sys.argv[1:]
if len(values) != 7:
    raise SystemExit("overlay provenance requires source plus six overlay values")
h = hashlib.sha256(b"carbonet.frontend-overlay-provenance/v1\0")
for value in values:
    h.update(value.encode("ascii"))
    h.update(b"\0")
print(h.hexdigest())
PY
}

print_overlay_provenance() {
  local materialized_source_hash index_hash manifest_hash entry_output public_output
  local -a entry_values public_values
  [[ -f "$OVERLAY_DIR/index.html" && ! -L "$OVERLAY_DIR/index.html" \
     && -f "$OVERLAY_DIR/.vite/manifest.json" && ! -L "$OVERLAY_DIR/.vite/manifest.json" ]] || {
    echo "[guard] overlay provenance metadata is missing or unsafe" >&2
    return 1
  }
  index_hash="$(sha256sum "$OVERLAY_DIR/index.html" | awk '{print $1}')"
  manifest_hash="$(sha256sum "$OVERLAY_DIR/.vite/manifest.json" | awk '{print $1}')"
  if ! materialized_source_hash="$(source_hash)" \
     || ! entry_output="$(entry_closure_values)" \
     || ! public_output="$(public_closure_values)"; then
    echo "[guard] overlay provenance closure could not be computed" >&2
    return 1
  fi
  mapfile -t entry_values <<<"$entry_output"
  mapfile -t public_values <<<"$public_output"
  [[ "${#entry_values[@]}" == 2 && "${#public_values[@]}" == 2 \
     && "${entry_values[0]}" =~ ^[0-9]+$ && "${entry_values[1]}" =~ ^[0-9a-f]{64}$ \
     && "${public_values[0]}" =~ ^[0-9]+$ && "${public_values[1]}" =~ ^[0-9a-f]{64}$ ]] || {
    echo "[guard] overlay provenance closure is malformed" >&2
    return 1
  }
  overlay_provenance_hash_from_values \
    "$materialized_source_hash" "$index_hash" "$manifest_hash" \
    "${entry_values[0]}" "${entry_values[1]}" \
    "${public_values[0]}" "${public_values[1]}"
}

require_marker_write_lock() {
  local fd="${CARBONET_FRONTEND_OVERLAY_LOCK_FD:-}"
  local expected_lock="${CARBONET_FRONTEND_OVERLAY_LOCK_FILE:-}"
  local expected_real fd_real
  [[ "$fd" =~ ^[0-9]+$ && -n "$expected_lock" \
     && -f "$expected_lock" && ! -L "$expected_lock" \
     && -e "/proc/$$/fd/$fd" ]] || {
      echo "[guard] write-marker requires an exact regular overlay lock file" >&2
      exit 33
    }
  expected_real="$(realpath -e "$expected_lock")"
  fd_real="$(realpath -e "/proc/$$/fd/$fd")"
  [[ "$fd_real" == "$expected_real" ]] && flock -n "$fd" || {
      echo "[guard] write-marker requires the inherited frontend overlay lock" >&2
      exit 33
    }
}

validate_marker_write_source_state() {
  local path residue_output changed_output
  local -a changed residue
  git -C "$ROOT_DIR" diff --cached --quiet HEAD -- "$SOURCE_RELATIVE_PATH" || {
    echo "[guard] staged frontend changes are forbidden while writing a marker" >&2
    exit 33
  }
  if ! changed_output="$(git -C "$ROOT_DIR" diff --name-only HEAD -- "$SOURCE_RELATIVE_PATH")"; then
    echo "[guard] tracked frontend change inventory could not be computed" >&2
    exit 33
  fi
  changed=()
  [[ -z "$changed_output" ]] || mapfile -t changed <<<"$changed_output"
  for path in "${changed[@]}"; do
    case "$path" in
      "$SOURCE_RELATIVE_PATH/src/generated/screen-generation/generatedScreenFamily.ts"|\
      "$SOURCE_RELATIVE_PATH/src/features/builder-studio/pageCompletenessInventory.ts"|\
      "$SOURCE_RELATIVE_PATH/src/features/builder-studio/routeSourceInventory.ts") ;;
      *)
        echo "[guard] unexpected dirty frontend source while writing marker: $path" >&2
        exit 33
        ;;
    esac
  done
  if ! residue_output="$(frontend_residue_paths)"; then
    echo "[guard] frontend materialization inventory could not be computed" >&2
    exit 33
  fi
  residue=()
  [[ -z "$residue_output" ]] || mapfile -t residue <<<"$residue_output"
  for path in "${residue[@]}"; do
    case "$path" in
      "$SOURCE_RELATIVE_PATH/package.json.orig"|\
      "$SOURCE_RELATIVE_PATH/scripts/run-frontend-pipeline.mjs.orig"|\
      "$SOURCE_RELATIVE_PATH/src/App.tsx.orig"|\
      "$SOURCE_RELATIVE_PATH/src/components/help/HelpOverlay.tsx.orig"|\
      "$SOURCE_RELATIVE_PATH/src/features/home-entry/GlobalUserGnbShell.tsx.orig"|\
      "$SOURCE_RELATIVE_PATH/src/features/join-company-reapply/JoinCompanyReapplyMigrationPage.tsx.orig"|\
      "$SOURCE_RELATIVE_PATH/src/features/process-step-workspace/ProcessStepWorkspacePage.tsx.orig"|\
      "$SOURCE_RELATIVE_PATH/src/features/screen-development-note/ScreenDevelopmentNotePanel.tsx.orig"|\
      "$SOURCE_RELATIVE_PATH/src/features/task-quest/TaskQuestPanel.tsx.orig"|\
      "$SOURCE_RELATIVE_PATH/src/generated/screen-generation/generatedScreenSpaceIndex.ts"|\
      "$SOURCE_RELATIVE_PATH/src/generated/screen-generation/generation-report.json"|\
      "$SOURCE_RELATIVE_PATH/tsconfig.app.tsbuildinfo"|\
      "$SOURCE_RELATIVE_PATH/src/generated/screen-generation/generatedScreenTypes.ts"|\
      "$SOURCE_RELATIVE_PATH/src/generated/screen-generation/definitions/"*.ts) ;;
      *)
        echo "[guard] unexpected frontend residue while writing marker: $path" >&2
        exit 33
        ;;
    esac
  done
  validate_deterministic_materialized_outputs || exit 33
}

write_marker() {
  local hash ts index_hash manifest_hash source_commit frontend_tree
  local git_output closure_output entry_output public_output live_provenance expected_provenance
  local -a git_identity closure_values entry_values public_values
  require_marker_write_lock
  validate_marker_write_source_state
  if ! hash="$(source_hash)"; then
    echo "[guard] frontend source identity could not be computed" >&2
    exit 33
  fi
  if ! git_output="$(frontend_git_identity)" \
     || ! closure_output="$(materialization_closure_values)" \
     || ! entry_output="$(entry_closure_values)" \
     || ! public_output="$(public_closure_values)"; then
    echo "[guard] frontend build provenance could not be computed" >&2
    exit 33
  fi
  mapfile -t git_identity <<<"$git_output"
  source_commit="${git_identity[0]:-}"
  frontend_tree="${git_identity[1]:-}"
  mapfile -t closure_values <<<"$closure_output"
  mapfile -t entry_values <<<"$entry_output"
  mapfile -t public_values <<<"$public_output"
  [[ "${#git_identity[@]}" == 2 && "${#closure_values[@]}" == 7 \
     && "${#entry_values[@]}" == 2 && "${#public_values[@]}" == 2 ]] || {
    echo "[guard] frontend build provenance could not be computed" >&2
    exit 33
  }
  [[ "${entry_values[0]}" =~ ^[0-9]+$ && "${entry_values[1]}" =~ ^[0-9a-f]{64}$ \
     && "${public_values[0]}" =~ ^[0-9]+$ && "${public_values[1]}" =~ ^[0-9a-f]{64}$ ]] || {
    echo "[guard] frontend closure count or hash is malformed" >&2
    exit 33
  }
  ts="$(date -Iseconds)"
  index_hash="$(sha256sum "$OVERLAY_DIR/index.html" | awk '{print $1}')"
  manifest_hash="$(sha256sum "$OVERLAY_DIR/.vite/manifest.json" | awk '{print $1}')"
  expected_provenance="${CARBONET_FRONTEND_EXPECTED_OVERLAY_PROVENANCE_SHA256:-}"
  live_provenance="$(overlay_provenance_hash_from_values \
    "$hash" "$index_hash" "$manifest_hash" \
    "${entry_values[0]}" "${entry_values[1]}" \
    "${public_values[0]}" "${public_values[1]}")"
  [[ "$expected_provenance" =~ ^[0-9a-f]{64}$ \
     && "$live_provenance" == "$expected_provenance" ]] || {
    echo "[guard] live overlay does not match the completed staging build" >&2
    exit 33
  }
  python3 - "$MARKER_FILE" "$hash" "$ts" "$index_hash" "$manifest_hash" \
    "$source_commit" "$frontend_tree" "${entry_values[0]}" "${entry_values[1]}" \
    "${public_values[0]}" "${public_values[1]}" "${closure_values[@]}" <<'PY'
import json
import os
import sys
from pathlib import Path

path = Path(sys.argv[1])
tmp = path.with_name(f".{path.name}.{os.getpid()}.next")
tmp.write_text(json.dumps({
    "schemaVersion": 2,
    "hashAlgorithm": "sha256",
    "sourceHash": sys.argv[2],
    "materializedSourceHash": sys.argv[2],
    "builtAt": sys.argv[3],
    "indexHash": sys.argv[4],
    "manifestHash": sys.argv[5],
    "sourceCommit": sys.argv[6],
    "frontendTreeOid": sys.argv[7],
    "entryClosureCount": int(sys.argv[8]),
    "entryClosureHash": sys.argv[9],
    "publicClosureCount": int(sys.argv[10]),
    "publicClosureHash": sys.argv[11],
    "materializationClosure": {
        "manifestSha256": sys.argv[12],
        "closureHash": sys.argv[13],
        "catalogSha256": sys.argv[14],
        "definitionSetHash": sys.argv[15],
        "typeContractSha256": sys.argv[16],
        "pageCompletenessSha256": sys.argv[17],
        "routeSourceSha256": sys.argv[18],
    },
    "sourceDir": "projects/carbonet-frontend/source",
    "overlayDir": "projects/carbonet-frontend/src/main/resources/static/react-app"
}, ensure_ascii=False, indent=2) + "\n")
os.replace(tmp, path)
PY
  echo "[guard] marker written hash=$hash"
}

verify_source() {
  test -f "$MARKER_FILE" || {
    echo "[guard] missing frontend build marker: $MARKER_FILE" >&2
    echo "[guard] run npm build or guard write-marker after a verified build" >&2
    exit 30
  }
  local expected materialized_expected actual expected_index actual_index expected_manifest actual_manifest
  local schema hash_algorithm source_commit frontend_tree source_tree current_tree
  local entry_count entry_hash actual_entry_count actual_entry_hash entry_output
  local public_count public_hash actual_public_count actual_public_hash public_output
  local marker_shape_valid marker_output source_real expected_source_real
  local -a marker_values actual_entry_values actual_public_values
  if ! actual="$(source_hash)"; then
    echo "[guard] frontend source contains an unsafe path" >&2
    exit 31
  fi
  if ! marker_output="$(python3 - "$MARKER_FILE" <<'PY'
import json
import sys
from pathlib import Path
data = json.loads(Path(sys.argv[1]).read_text())
required_keys = {
    "schemaVersion", "hashAlgorithm", "sourceHash", "materializedSourceHash",
    "builtAt", "indexHash", "manifestHash", "sourceCommit",
    "frontendTreeOid", "entryClosureCount", "entryClosureHash",
    "publicClosureCount", "publicClosureHash", "materializationClosure",
    "sourceDir", "overlayDir",
}
hex64 = lambda value: (isinstance(value, str) and len(value) == 64
                       and all(ch in "0123456789abcdef" for ch in value))
print(data.get("sourceHash", ""))
print(data.get("materializedSourceHash", ""))
print(data.get("indexHash", ""))
print(data.get("manifestHash", ""))
print(data.get("schemaVersion", ""))
print(data.get("hashAlgorithm", ""))
print(data.get("sourceCommit", ""))
print(data.get("frontendTreeOid", ""))
print(data.get("entryClosureCount", ""))
print(data.get("entryClosureHash", ""))
print(data.get("publicClosureCount", ""))
print(data.get("publicClosureHash", ""))
closure = data.get("materializationClosure")
closure_keys = {
    "manifestSha256",
    "closureHash",
    "catalogSha256",
    "definitionSetHash",
    "typeContractSha256",
    "pageCompletenessSha256",
    "routeSourceSha256",
}
shape_valid = (
      set(data) == required_keys
      and data.get("schemaVersion") == 2
      and data.get("hashAlgorithm") == "sha256"
      and hex64(data.get("sourceHash"))
      and data.get("materializedSourceHash") == data.get("sourceHash")
      and hex64(data.get("indexHash"))
      and hex64(data.get("manifestHash"))
      and isinstance(data.get("builtAt"), str) and bool(data.get("builtAt"))
      and type(data.get("entryClosureCount")) is int
      and data.get("entryClosureCount") >= 0
      and hex64(data.get("entryClosureHash"))
      and type(data.get("publicClosureCount")) is int
      and data.get("publicClosureCount") >= 0
      and hex64(data.get("publicClosureHash"))
      and data.get("sourceDir") == "projects/carbonet-frontend/source"
      and data.get("overlayDir") == "projects/carbonet-frontend/src/main/resources/static/react-app"
      and isinstance(closure, dict)
      and set(closure) == closure_keys
      and all(hex64(value) for value in closure.values())
)
print("true" if shape_valid else "false")
PY
  )"; then
    echo "[guard] frontend marker JSON is malformed" >&2
    exit 31
  fi
  mapfile -t marker_values <<<"$marker_output"
  [[ "${#marker_values[@]}" == 13 ]] || {
    echo "[guard] frontend marker shape could not be read" >&2
    exit 31
  }
  expected="${marker_values[0]:-}"
  materialized_expected="${marker_values[1]:-}"
  expected_index="${marker_values[2]:-}"
  expected_manifest="${marker_values[3]:-}"
  schema="${marker_values[4]:-}"
  hash_algorithm="${marker_values[5]:-}"
  source_commit="${marker_values[6]:-}"
  frontend_tree="${marker_values[7]:-}"
  entry_count="${marker_values[8]:-}"
  entry_hash="${marker_values[9]:-}"
  public_count="${marker_values[10]:-}"
  public_hash="${marker_values[11]:-}"
  marker_shape_valid="${marker_values[12]:-false}"
  [[ "$schema" == 2 && "$hash_algorithm" == sha256 \
     && "$expected" == "$materialized_expected" && "$marker_shape_valid" == true \
     && "$source_commit" =~ ^[0-9a-f]{40}$ \
     && "$frontend_tree" =~ ^[0-9a-f]{40,64}$ ]] || {
    echo "[guard] legacy or malformed marker cannot authorize source reuse" >&2
    exit 31
  }
  [[ -f "$OVERLAY_DIR/index.html" && ! -L "$OVERLAY_DIR/index.html" \
     && -f "$OVERLAY_DIR/.vite/manifest.json" && ! -L "$OVERLAY_DIR/.vite/manifest.json" ]] || {
    echo "[guard] React entry metadata is missing or unsafe" >&2
    exit 32
  }
  actual_index="$(sha256sum "$OVERLAY_DIR/index.html" | awk '{print $1}')"
  actual_manifest="$(sha256sum "$OVERLAY_DIR/.vite/manifest.json" | awk '{print $1}')"
  if ! entry_output="$(entry_closure_values)"; then
    echo "[guard] React entry closure could not be computed" >&2
    exit 32
  fi
  mapfile -t actual_entry_values <<<"$entry_output"
  [[ "${#actual_entry_values[@]}" == 2 \
     && "${actual_entry_values[0]}" =~ ^[0-9]+$ \
     && "${actual_entry_values[1]}" =~ ^[0-9a-f]{64}$ ]] || {
    echo "[guard] React entry closure is malformed" >&2
    exit 32
  }
  actual_entry_count="${actual_entry_values[0]:-}"
  actual_entry_hash="${actual_entry_values[1]:-}"
  if ! public_output="$(public_closure_values)"; then
    echo "[guard] frontend public closure could not be computed" >&2
    exit 32
  fi
  mapfile -t actual_public_values <<<"$public_output"
  [[ "${#actual_public_values[@]}" == 2 \
     && "${actual_public_values[0]}" =~ ^[0-9]+$ \
     && "${actual_public_values[1]}" =~ ^[0-9a-f]{64}$ ]] || {
    echo "[guard] frontend public closure is malformed" >&2
    exit 32
  }
  actual_public_count="${actual_public_values[0]}"
  actual_public_hash="${actual_public_values[1]}"
  if [[ -z "$expected_index" || -z "$expected_manifest" \
     || "$actual_index" != "$expected_index" \
     || "$actual_manifest" != "$expected_manifest" \
     || "$actual_entry_count" != "$entry_count" \
     || "$actual_entry_hash" != "$entry_hash" \
     || "$actual_public_count" != "$public_count" \
     || "$actual_public_hash" != "$public_hash" ]]; then
    echo "[guard] React entry graph does not match the verified build marker" >&2
    echo "[guard] rebuild the frontend closure before deploying" >&2
    exit 32
  fi
  if ! source_real="$(realpath -e "$SOURCE_DIR")" \
     || ! expected_source_real="$(realpath -e "$ROOT_DIR/$SOURCE_RELATIVE_PATH")" \
     || [[ "$source_real" != "$expected_source_real" ]]; then
    echo "[guard] frontend source path is outside the canonical Git tree" >&2
    exit 31
  fi
  git -C "$ROOT_DIR" merge-base --is-ancestor "$source_commit" HEAD || {
    echo "[guard] marker source commit is not an ancestor of the candidate" >&2
    exit 31
  }
  if ! source_tree="$(git -C "$ROOT_DIR" rev-parse "$source_commit:$SOURCE_RELATIVE_PATH")" \
     || [[ "$source_tree" != "$frontend_tree" ]]; then
    echo "[guard] marker frontend tree does not belong to its source commit" >&2
    exit 31
  fi
  if ! current_tree="$(git -C "$ROOT_DIR" rev-parse "HEAD:$SOURCE_RELATIVE_PATH")"; then
    echo "[guard] candidate frontend tree is unavailable" >&2
    exit 31
  fi
  [[ "$current_tree" == "$frontend_tree" ]] || {
    echo "[guard] candidate frontend tree differs from the built marker" >&2
    exit 31
  }
  if [[ -n "$expected" && "$actual" == "$expected" ]]; then
    echo "[guard] source marker OK mode=materialized hash=$actual"
    return 0
  fi

  local baseline="${CARBONET_BASELINE_COMMIT:-}" baseline_tree
  [[ "$baseline" =~ ^[0-9a-f]{40}$ ]] || {
    echo "[guard] deployed baseline commit is missing or malformed" >&2
    exit 31
  }
  git -C "$ROOT_DIR" merge-base --is-ancestor "$source_commit" "$baseline" \
    && git -C "$ROOT_DIR" merge-base --is-ancestor "$baseline" HEAD || {
      echo "[guard] deployed baseline is outside the marker-to-candidate ancestry" >&2
      exit 31
    }
  if ! baseline_tree="$(git -C "$ROOT_DIR" rev-parse "$baseline:$SOURCE_RELATIVE_PATH")"; then
    echo "[guard] deployed baseline frontend tree is unavailable" >&2
    exit 31
  fi
  [[ "$baseline_tree" == "$frontend_tree" ]] || {
    echo "[guard] deployed baseline frontend tree differs from the built marker" >&2
    exit 31
  }
  git -C "$ROOT_DIR" diff --quiet HEAD -- "$SOURCE_RELATIVE_PATH" \
    && git -C "$ROOT_DIR" diff --cached --quiet HEAD -- "$SOURCE_RELATIVE_PATH" || {
      echo "[guard] tracked frontend source is dirty" >&2
      exit 31
    }

  local allowed path candidate residue_output unexpected=0
  local -a allowed_residue=(
    "$SOURCE_RELATIVE_PATH/package.json.orig"
    "$SOURCE_RELATIVE_PATH/scripts/run-frontend-pipeline.mjs.orig"
    "$SOURCE_RELATIVE_PATH/src/App.tsx.orig"
    "$SOURCE_RELATIVE_PATH/src/components/help/HelpOverlay.tsx.orig"
    "$SOURCE_RELATIVE_PATH/src/features/home-entry/GlobalUserGnbShell.tsx.orig"
    "$SOURCE_RELATIVE_PATH/src/features/join-company-reapply/JoinCompanyReapplyMigrationPage.tsx.orig"
    "$SOURCE_RELATIVE_PATH/src/features/process-step-workspace/ProcessStepWorkspacePage.tsx.orig"
    "$SOURCE_RELATIVE_PATH/src/features/screen-development-note/ScreenDevelopmentNotePanel.tsx.orig"
    "$SOURCE_RELATIVE_PATH/src/features/task-quest/TaskQuestPanel.tsx.orig"
    "$SOURCE_RELATIVE_PATH/src/generated/screen-generation/generatedScreenSpaceIndex.ts"
    "$SOURCE_RELATIVE_PATH/src/generated/screen-generation/generation-report.json"
    "$SOURCE_RELATIVE_PATH/tsconfig.app.tsbuildinfo"
  )
  local -a residue_paths
  residue_paths=()
  if ! residue_output="$(frontend_residue_paths)"; then
    echo "[guard] frontend residue inventory could not be computed" >&2
    exit 31
  fi
  [[ -z "$residue_output" ]] || mapfile -t residue_paths <<<"$residue_output"
  for path in "${residue_paths[@]}"; do
    allowed=false
    for candidate in "${allowed_residue[@]}"; do
      [[ "$path" == "$candidate" ]] && { allowed=true; break; }
    done
    if [[ "$allowed" != true || -L "$ROOT_DIR/$path" ]]; then
      echo "[guard] unexpected frontend residue: $path" >&2
      unexpected=1
    fi
  done
  (( unexpected == 0 )) || exit 31
  echo "[guard] source marker OK mode=git-tree-reuse tree=$frontend_tree baseline=$baseline"
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
  prune_backups
}

prune_backups() {
  [[ "$BACKUP_RETAIN_COUNT" =~ ^[1-9][0-9]*$ ]] || {
    echo "[guard] BACKUP_RETAIN_COUNT must be a positive integer" >&2
    exit 18
  }
  mkdir -p "$BACKUP_DIR"
  local removed=0 archive
  mapfile -t archives < <(
    find "$BACKUP_DIR" -maxdepth 1 -type f -name 'react-app-overlay-*.tar.gz' \
      -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-
  )
  if (( ${#archives[@]} > BACKUP_RETAIN_COUNT )); then
    for archive in "${archives[@]:BACKUP_RETAIN_COUNT}"; do
      [[ "$archive" == "$BACKUP_DIR"/react-app-overlay-*.tar.gz ]] || continue
      rm -f -- "$archive"
      removed=$((removed + 1))
    done
  fi
  echo "[guard] backup retention kept=$BACKUP_RETAIN_COUNT removed=$removed"
}

restore_latest_backup() {
  local archive staging
  archive="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'react-app-overlay-*.tar.gz' -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)"
  [[ -n "$archive" && -f "$archive" ]] || { echo "[guard] no overlay backup available" >&2; exit 16; }
  staging="$(mktemp -d "$ROOT_DIR/var/run/react-overlay-restore.XXXXXX")"
  tar -C "$staging" -xzf "$archive"
  test -f "$staging/index.html" || { rm -rf "$staging"; echo "[guard] invalid backup: $archive" >&2; exit 17; }
  rsync -a --delete --exclude='/index.html' "$staging/" "$OVERLAY_DIR/"
  cp "$staging/index.html" "$OVERLAY_DIR/.index.html.restore"
  mv -f "$OVERLAY_DIR/.index.html.restore" "$OVERLAY_DIR/index.html"
  rm -rf "$staging"
  echo "[guard] restored=$archive"
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
  local ref url status failed=0 public_marker local_marker public_marker_hash local_marker_hash
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
  # A 200 response for every hashed asset is insufficient when an ingress or
  # stale volume serves a different, internally consistent overlay. Bind the
  # public route to the exact local build provenance (Git commit/tree, source,
  # manifest and entry/public closure hashes) before deployment can succeed.
  public_marker="$(curl -skfL --max-time 15 --max-filesize 65536 \
    "$BASE_URL/assets/react/.resonance-build.json" 2>/dev/null)" || {
    echo "[guard] HTTP build provenance is unavailable: $BASE_URL/assets/react/.resonance-build.json" >&2
    exit 20
  }
  local_marker="$(jq -cS . "$MARKER_FILE" 2>/dev/null)" || exit 20
  public_marker="$(jq -cS . <<<"$public_marker" 2>/dev/null)" || {
    echo "[guard] HTTP build provenance is malformed" >&2
    exit 20
  }
  local_marker_hash="$(printf '%s' "$local_marker" | sha256sum | awk '{print $1}')"
  public_marker_hash="$(printf '%s' "$public_marker" | sha256sum | awk '{print $1}')"
  [[ "$public_marker_hash" == "$local_marker_hash" ]] || {
    echo "[guard] HTTP overlay provenance differs from the deployed source marker" >&2
    exit 20
  }
  echo "[guard] HTTP hashed assets and build provenance OK ($BASE_URL)"
}

cmd="${1:-}"
case "$cmd" in
  backup) backup_overlay ;;
  prune-backups) prune_backups ;;
  restore-latest) restore_latest_backup ;;
  verify-local) verify_local ;;
  verify-http) verify_http ;;
  write-marker) write_marker ;;
  print-overlay-provenance) print_overlay_provenance ;;
  verify-source) verify_source ;;
  verify-all) verify_local; verify_source; verify_http ;;
  -h|--help|"") usage ;;
  *) echo "Unknown command: $cmd" >&2; usage >&2; exit 2 ;;
esac
