#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARD="$PROJECT_ROOT/ops/scripts/resonance-frontend-overlay-guard.sh"
AUTO_DEPLOY="$PROJECT_ROOT/ops/scripts/auto-deploy-main.sh"
SCREEN_APPLY="$PROJECT_ROOT/ops/scripts/resonance-screen-overlay-apply.sh"
BUILD_DEPLOY="$PROJECT_ROOT/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

FIXTURE_ROOT="$TMP_DIR/repo"
SOURCE_DIR="$FIXTURE_ROOT/projects/carbonet-frontend/source"
OVERLAY_DIR="$FIXTURE_ROOT/projects/carbonet-frontend/src/main/resources/static/react-app"
MARKER_FILE="$OVERLAY_DIR/.resonance-build.json"
GENERATED_DIR="$SOURCE_DIR/src/generated/screen-generation"
INVENTORY_DIR="$SOURCE_DIR/src/features/builder-studio"
mkdir -p "$GENERATED_DIR" "$INVENTORY_DIR" "$OVERLAY_DIR/.vite" \
  "$OVERLAY_DIR/assets" "$OVERLAY_DIR/runtime" "$OVERLAY_DIR/img" \
  "$SOURCE_DIR/public/runtime" "$SOURCE_DIR/public/img" "$SOURCE_DIR/scripts"

git -C "$FIXTURE_ROOT" init -q
git -C "$FIXTURE_ROOT" config user.name overlay-contract
git -C "$FIXTURE_ROOT" config user.email overlay-contract@example.invalid

printf '*.orig\n' > "$FIXTURE_ROOT/.gitignore"
printf '{"scripts":{}}\n' > "$SOURCE_DIR/package.json"
printf '{}\n' > "$SOURCE_DIR/package-lock.json"
printf '{}\n' > "$SOURCE_DIR/tsconfig.json"
printf 'export default {};\n' > "$SOURCE_DIR/vite.config.ts"
printf '<div id="root"></div>\n' > "$SOURCE_DIR/index.html"
printf 'export const value = 1;\n' > "$SOURCE_DIR/src/main.ts"
printf 'import { screen_alpha } from "./definitions/alpha";\nexport const GENERATED_SCREEN_CATALOG = [screen_alpha];\n' > "$GENERATED_DIR/generatedScreenCatalog.ts"
printf 'export const GENERATED_SCREEN_SUPPORT_CATALOG = [];\n' > "$GENERATED_DIR/generatedScreenSupportCatalog.ts"
printf 'export const PAGE_COMPLETENESS = "committed";\n' > "$INVENTORY_DIR/pageCompletenessInventory.ts"
printf 'export const ROUTE_SOURCE = "committed";\n' > "$INVENTORY_DIR/routeSourceInventory.ts"
printf 'export const GENERATED_SCREEN_FAMILY = "committed";\n' > "$GENERATED_DIR/generatedScreenFamily.ts"
cat > "$SOURCE_DIR/scripts/generate-page-completeness-inventory.mjs" <<'JS'
import { writeFile } from "node:fs/promises";
await writeFile("src/features/builder-studio/pageCompletenessInventory.ts", 'export const PAGE_COMPLETENESS = "materialized";\n');
await writeFile("src/features/builder-studio/routeSourceInventory.ts", 'export const ROUTE_SOURCE = "materialized";\n');
JS
cat > "$SOURCE_DIR/scripts/dedupe-generated-route-family.mjs" <<'JS'
import { writeFile } from "node:fs/promises";
await writeFile("src/generated/screen-generation/generatedScreenFamily.ts", 'export const GENERATED_SCREEN_FAMILY = "materialized";\n');
JS
python3 - "$GENERATED_DIR/generatedScreenDefinitionClosure.json" \
  "$GENERATED_DIR/generatedScreenCatalog.ts" <<'PY'
import hashlib
import json
import sys
from pathlib import Path

catalog_sha = hashlib.sha256(Path(sys.argv[2]).read_bytes()).hexdigest()
type_source = b"export type GeneratedScreenDefinition = unknown;\n"
definition_source = b"export const screen_alpha = {};\n"
set_row = ("alpha.ts\0screen_alpha\0" + hashlib.sha256(definition_source).hexdigest()).encode()
core = {
    "schema": "carbonet.generated-screen-definition-closure/v1",
    "algorithm": "sha256",
    "catalog": {"file": "generatedScreenCatalog.ts", "sha256": catalog_sha},
    "definitions": {
        "directory": "definitions",
        "count": 1,
        "setHash": hashlib.sha256(set_row).hexdigest(),
    },
    "typeContract": {
        "file": "generatedScreenTypes.ts",
        "sha256": hashlib.sha256(type_source).hexdigest(),
    },
}
manifest = dict(core)
manifest["closureHash"] = hashlib.sha256(
    json.dumps(core, sort_keys=True, separators=(",", ":")).encode()
).hexdigest()
Path(sys.argv[1]).write_text(json.dumps(manifest) + "\n", encoding="utf-8")
PY

printf 'window.__SCREEN_SYSTEM_ASSETS__ = true;\n' > "$SOURCE_DIR/public/runtime/screen-system-assets.js"
printf 'dynamic public image\n' > "$SOURCE_DIR/public/img/dynamic-logo.png"
printf '<script src="/assets/react/runtime/screen-system-assets.js"></script>\n<script type="module" src="/assets/react/assets/index-new.js"></script>\n' > "$OVERLAY_DIR/index.html"
printf '{"index.html":{"file":"assets/index-new.js","css":["assets/index-new.css"]}}\n' > "$OVERLAY_DIR/.vite/manifest.json"
printf 'console.log("overlay");\n' > "$OVERLAY_DIR/assets/index-new.js"
printf ':root{color-scheme:light}\n' > "$OVERLAY_DIR/assets/index-new.css"
cp "$SOURCE_DIR/public/runtime/screen-system-assets.js" "$OVERLAY_DIR/runtime/screen-system-assets.js"
cp "$SOURCE_DIR/public/img/dynamic-logo.png" "$OVERLAY_DIR/img/dynamic-logo.png"

git -C "$FIXTURE_ROOT" add .
git -C "$FIXTURE_ROOT" commit -qm baseline
BASELINE_COMMIT="$(git -C "$FIXTURE_ROOT" rev-parse HEAD)"
OVERLAY_LOCK_FILE="$TMP_DIR/carbonet-frontend-overlay.lock"
exec 8>"$OVERLAY_LOCK_FILE"
flock -n 8

run_guard() {
  ROOT_DIR="$FIXTURE_ROOT" SOURCE_DIR="$SOURCE_DIR" OVERLAY_DIR="$OVERLAY_DIR" \
    MARKER_FILE="$MARKER_FILE" CARBONET_BASELINE_COMMIT="${1:-}" \
    CARBONET_FRONTEND_OVERLAY_LOCK_FD=8 \
    CARBONET_FRONTEND_OVERLAY_LOCK_FILE="$OVERLAY_LOCK_FILE" \
    CARBONET_FRONTEND_EXPECTED_OVERLAY_PROVENANCE_SHA256="${EXPECTED_OVERLAY_PROVENANCE_SHA256:-}" \
    bash "$GUARD" "${2:?command required}"
}

verify_reuse_passes() {
  run_guard "$BASELINE_COMMIT" verify-source >/dev/null
}

expect_status() {
  local expected="$1" label="$2" baseline="${3:-$BASELINE_COMMIT}" status
  set +e
  run_guard "$baseline" verify-source >/dev/null 2>&1
  status=$?
  set -e
  if [[ "$status" -ne "$expected" ]]; then
    echo "FAIL $label expected=$expected actual=$status" >&2
    exit 1
  fi
}

# Simulate official prebuild materialization. Definitions, their type contract,
# and the two tracked inventories are real Vite inputs and stay in the hash.
mkdir -p "$GENERATED_DIR/definitions"
printf 'export const screen_alpha = {};\n' > "$GENERATED_DIR/definitions/alpha.ts"
printf 'export type GeneratedScreenDefinition = unknown;\n' > "$GENERATED_DIR/generatedScreenTypes.ts"
printf 'export const PAGE_COMPLETENESS = "materialized";\n' > "$INVENTORY_DIR/pageCompletenessInventory.ts"
printf 'export const ROUTE_SOURCE = "materialized";\n' > "$INVENTORY_DIR/routeSourceInventory.ts"
printf 'export const GENERATED_SCREEN_FAMILY = "materialized";\n' > "$GENERATED_DIR/generatedScreenFamily.ts"
printf 'export const GENERATED_SCREEN_SPACE_INDEX = [];\n' > "$GENERATED_DIR/generatedScreenSpaceIndex.ts"
printf '{"status":"generated"}\n' > "$GENERATED_DIR/generation-report.json"
printf 'incremental compiler cache\n' > "$SOURCE_DIR/tsconfig.app.tsbuildinfo"
mkdir -p "$SOURCE_DIR/.cache" "$SOURCE_DIR/test-results"
printf 'status compiler cache\n' > "$SOURCE_DIR/.cache/status-ui.tsbuildinfo"
printf '{"status":"passed"}\n' > "$SOURCE_DIR/test-results/.last-run.json"

EXPECTED_OVERLAY_PROVENANCE_SHA256="$(
  ROOT_DIR="$FIXTURE_ROOT" SOURCE_DIR="$SOURCE_DIR" OVERLAY_DIR="$OVERLAY_DIR" \
    MARKER_FILE="$MARKER_FILE" bash "$GUARD" print-overlay-provenance
)"
[[ "$EXPECTED_OVERLAY_PROVENANCE_SHA256" =~ ^[0-9a-f]{64}$ ]]

# A standalone marker writer without the shared inherited lock must fail.
set +e
ROOT_DIR="$FIXTURE_ROOT" SOURCE_DIR="$SOURCE_DIR" OVERLAY_DIR="$OVERLAY_DIR" \
  MARKER_FILE="$MARKER_FILE" bash "$GUARD" write-marker >/dev/null 2>&1
unlocked_status=$?
set -e
[[ "$unlocked_status" == 33 && ! -e "$MARKER_FILE" ]]

# A valid lock FD for another file cannot authorize the shared overlay marker.
OTHER_LOCK_FILE="$TMP_DIR/not-the-overlay.lock"
exec 7>"$OTHER_LOCK_FILE"
flock -n 7
set +e
ROOT_DIR="$FIXTURE_ROOT" SOURCE_DIR="$SOURCE_DIR" OVERLAY_DIR="$OVERLAY_DIR" \
  MARKER_FILE="$MARKER_FILE" CARBONET_FRONTEND_OVERLAY_LOCK_FD=7 \
  CARBONET_FRONTEND_OVERLAY_LOCK_FILE="$OVERLAY_LOCK_FILE" \
  CARBONET_FRONTEND_EXPECTED_OVERLAY_PROVENANCE_SHA256="$EXPECTED_OVERLAY_PROVENANCE_SHA256" \
  bash "$GUARD" write-marker >/dev/null 2>&1
wrong_lock_status=$?
set -e
[[ "$wrong_lock_status" == 33 && ! -e "$MARKER_FILE" ]]

# Recomputing the staging hash after manually changing an allowed generated
# file must still fail: only the deterministic generator result is reusable.
cp "$GENERATED_DIR/generatedScreenFamily.ts" "$TMP_DIR/deterministic-family.ts"
printf 'globalThis.__MANUAL_SIDE_EFFECT__ = true;\n' >> "$GENERATED_DIR/generatedScreenFamily.ts"
MALICIOUS_EXPECTED_OVERLAY_PROVENANCE_SHA256="$(
  ROOT_DIR="$FIXTURE_ROOT" SOURCE_DIR="$SOURCE_DIR" OVERLAY_DIR="$OVERLAY_DIR" \
    MARKER_FILE="$MARKER_FILE" bash "$GUARD" print-overlay-provenance
)"
SAFE_EXPECTED_OVERLAY_PROVENANCE_SHA256="$EXPECTED_OVERLAY_PROVENANCE_SHA256"
EXPECTED_OVERLAY_PROVENANCE_SHA256="$MALICIOUS_EXPECTED_OVERLAY_PROVENANCE_SHA256"
set +e
run_guard "" write-marker >/dev/null 2>&1
nondeterministic_generated_status=$?
set -e
[[ "$nondeterministic_generated_status" == 33 && ! -e "$MARKER_FILE" ]]
cp "$TMP_DIR/deterministic-family.ts" "$GENERATED_DIR/generatedScreenFamily.ts"
EXPECTED_OVERLAY_PROVENANCE_SHA256="$SAFE_EXPECTED_OVERLAY_PROVENANCE_SHA256"

# Source materialization is part of the staging provenance. A producer changing
# any real Vite input after staging was hashed cannot bind that source to the
# older overlay closure.
cp "$INVENTORY_DIR/pageCompletenessInventory.ts" "$TMP_DIR/staging-page-inventory.ts"
printf '// source changed after staging\n' >> "$INVENTORY_DIR/pageCompletenessInventory.ts"
set +e
run_guard "" write-marker >/dev/null 2>&1
stale_source_status=$?
set -e
[[ "$stale_source_status" == 33 && ! -e "$MARKER_FILE" ]]
cp "$TMP_DIR/staging-page-inventory.ts" "$INVENTORY_DIR/pageCompletenessInventory.ts"

# A clean source cannot re-seal overlay bytes that differ from the completed
# staging closure, even while holding the correct shared lock.
cp "$OVERLAY_DIR/runtime/screen-system-assets.js" "$TMP_DIR/staging-runtime.js"
printf '// crossed writer\n' >> "$OVERLAY_DIR/runtime/screen-system-assets.js"
set +e
run_guard "" write-marker >/dev/null 2>&1
stale_reseal_status=$?
set -e
[[ "$stale_reseal_status" == 33 && ! -e "$MARKER_FILE" ]]
cp "$TMP_DIR/staging-runtime.js" "$OVERLAY_DIR/runtime/screen-system-assets.js"

run_guard "" write-marker >/dev/null
run_guard "" verify-source >/dev/null
MARKER_BACKUP="$TMP_DIR/marker.v2.json"
cp "$MARKER_FILE" "$MARKER_BACKUP"

[[ "$(jq -r '.schemaVersion' "$MARKER_FILE")" == 2 ]]
[[ "$(jq -r '.sourceCommit' "$MARKER_FILE")" == "$BASELINE_COMMIT" ]]
[[ "$(jq -r '.frontendTreeOid' "$MARKER_FILE")" == \
   "$(git -C "$FIXTURE_ROOT" rev-parse HEAD:projects/carbonet-frontend/source)" ]]
[[ "$(jq -r '.entryClosureCount' "$MARKER_FILE")" == 5 ]]
[[ "$(jq -r '.publicClosureCount' "$MARKER_FILE")" == 2 ]]
jq -e '
  .hashAlgorithm == "sha256"
  and (.materializedSourceHash == .sourceHash)
  and ((.materializationClosure | keys) == [
    "catalogSha256", "closureHash", "definitionSetHash", "manifestSha256",
    "pageCompletenessSha256", "routeSourceSha256", "typeContractSha256"
  ])
' "$MARKER_FILE" >/dev/null

# The parent deploy process must forward the deployed runtime commit to the
# child. Without this exact binding, Git-tree reuse would be unavailable or
# could be authorized against the wrong release.
grep -F 'CARBONET_BASELINE_COMMIT="$runtime_deployed_commit" \' "$AUTO_DEPLOY" >/dev/null
CANONICAL_OVERLAY_LOCK='/opt/resonance-data/deploy/carbonet-frontend-overlay.lock'
grep -F 'CARBONET_FRONTEND_OVERLAY_LOCK_FILE="/opt/resonance-data/deploy/carbonet-frontend-overlay.lock" \' "$AUTO_DEPLOY" >/dev/null
grep -F "\${CARBONET_FRONTEND_OVERLAY_LOCK_FILE:-$CANONICAL_OVERLAY_LOCK}" "$SCREEN_APPLY" >/dev/null
grep -F "\${CARBONET_FRONTEND_OVERLAY_LOCK_FILE:-$CANONICAL_OVERLAY_LOCK}" "$BUILD_DEPLOY" >/dev/null
[[ "$(grep -F "$CANONICAL_OVERLAY_LOCK" "$SCREEN_APPLY" | wc -l)" -eq 1 ]]
[[ "$(grep -F "$CANONICAL_OVERLAY_LOCK" "$BUILD_DEPLOY" | wc -l)" -eq 1 ]]
grep -F 'export CARBONET_FRONTEND_OVERLAY_LOCK_FD=9' "$SCREEN_APPLY" >/dev/null
grep -F 'export CARBONET_FRONTEND_OVERLAY_LOCK_FD=8' "$BUILD_DEPLOY" >/dev/null
grep -F 'export CARBONET_FRONTEND_OVERLAY_LOCK_FILE="$LOCK_FILE"' "$SCREEN_APPLY" >/dev/null
grep -F 'export CARBONET_FRONTEND_OVERLAY_LOCK_FILE="$FRONTEND_OVERLAY_LOCK_FILE"' "$BUILD_DEPLOY" >/dev/null
grep -F '"$BASE_URL/assets/react/.resonance-build.json"' "$GUARD" >/dev/null
grep -F 'HTTP overlay provenance differs from the deployed source marker' "$GUARD" >/dev/null
grep -F 'public_marker_hash' "$GUARD" >/dev/null
python3 - "$SCREEN_APPLY" <<'PY'
import sys
from pathlib import Path
text = Path(sys.argv[1]).read_text()
contract = '''if [[ "$SKIP_FRONTEND_BUILD" != "true" ]]; then
  echo "[screen-overlay-apply] write marker from the completed frontend build"
  CARBONET_FRONTEND_EXPECTED_OVERLAY_PROVENANCE_SHA256="$FRONTEND_EXPECTED_OVERLAY_PROVENANCE_SHA256" \\
    bash "$GUARD_SCRIPT" write-marker
else
  echo "[screen-overlay-apply] preserve existing marker for verify-only reuse"
fi'''
assert contract in text
assert text.count('bash "$GUARD_SCRIPT" write-marker') == 1
PY
if flock -n "$OVERLAY_LOCK_FILE" true; then
  echo "FAIL shared frontend overlay lock admitted a concurrent writer" >&2
  exit 1
fi

# The next deployment restores tracked materialized inventories and removes the
# closure payload. An unchanged frontend Git tree plus exact entry graph allows
# reuse, while no arbitrary generated residue is accepted.
git -C "$FIXTURE_ROOT" restore -- \
  projects/carbonet-frontend/source/src/generated/screen-generation/generatedScreenFamily.ts \
  projects/carbonet-frontend/source/src/features/builder-studio/pageCompletenessInventory.ts \
  projects/carbonet-frontend/source/src/features/builder-studio/routeSourceInventory.ts
rm -rf "$GENERATED_DIR/definitions"
rm -f "$GENERATED_DIR/generatedScreenTypes.ts"

orig_paths=(
  "$SOURCE_DIR/package.json.orig"
  "$SOURCE_DIR/scripts/run-frontend-pipeline.mjs.orig"
  "$SOURCE_DIR/src/App.tsx.orig"
  "$SOURCE_DIR/src/components/help/HelpOverlay.tsx.orig"
  "$SOURCE_DIR/src/features/home-entry/GlobalUserGnbShell.tsx.orig"
  "$SOURCE_DIR/src/features/join-company-reapply/JoinCompanyReapplyMigrationPage.tsx.orig"
  "$SOURCE_DIR/src/features/process-step-workspace/ProcessStepWorkspacePage.tsx.orig"
  "$SOURCE_DIR/src/features/screen-development-note/ScreenDevelopmentNotePanel.tsx.orig"
  "$SOURCE_DIR/src/features/task-quest/TaskQuestPanel.tsx.orig"
)
for path in "${orig_paths[@]}"; do
  mkdir -p "$(dirname "$path")"
  printf 'legacy merge backup\n' > "$path"
done
verify_reuse_passes

# A backend-only release may advance the runtime baseline without rewriting the
# frontend marker. The next backend-only release must still reuse the same
# frontend tree through the exact marker -> baseline -> candidate ancestry.
mkdir -p "$FIXTURE_ROOT/apps/backend"
printf 'backend-b\n' > "$FIXTURE_ROOT/apps/backend/version.txt"
git -C "$FIXTURE_ROOT" add apps/backend/version.txt
git -C "$FIXTURE_ROOT" commit -qm backend-b
RUNTIME_BASELINE_B="$(git -C "$FIXTURE_ROOT" rev-parse HEAD)"
verify_reuse_passes
printf 'backend-c\n' > "$FIXTURE_ROOT/apps/backend/version.txt"
git -C "$FIXTURE_ROOT" add apps/backend/version.txt
git -C "$FIXTURE_ROOT" commit -qm backend-c
run_guard "$RUNTIME_BASELINE_B" verify-source >/dev/null

printf '// dirty\n' >> "$SOURCE_DIR/src/main.ts"
expect_status 31 tracked-drift
git -C "$FIXTURE_ROOT" restore -- projects/carbonet-frontend/source/src/main.ts
verify_reuse_passes

printf 'export const unexpected = true;\n' > "$SOURCE_DIR/src/unexpected.ts"
expect_status 31 unexpected-untracked
rm -f "$SOURCE_DIR/src/unexpected.ts"

mkdir -p "$SOURCE_DIR/src/build"
printf 'export const hiddenPoison = true;\n' > "$SOURCE_DIR/src/build/poison.ts"
expect_status 31 nested-build-poison
rm -rf "$SOURCE_DIR/src/build"

mkdir -p "$GENERATED_DIR/definitions"
printf 'export const partial = true;\n' > "$GENERATED_DIR/definitions/partial.ts"
expect_status 31 partial-materialization
rm -rf "$GENERATED_DIR/definitions"

printf 'foreign\n' > "$SOURCE_DIR/src/foreign.ts.orig"
expect_status 31 arbitrary-orig
rm -f "$SOURCE_DIR/src/foreign.ts.orig"

rm -f "$GENERATED_DIR/generatedScreenSpaceIndex.ts"
ln -s generation-report.json "$GENERATED_DIR/generatedScreenSpaceIndex.ts"
expect_status 31 allowed-symlink
rm -f "$GENERATED_DIR/generatedScreenSpaceIndex.ts"
printf 'export const GENERATED_SCREEN_SPACE_INDEX = [];\n' > "$GENERATED_DIR/generatedScreenSpaceIndex.ts"

expect_status 31 baseline-mismatch "$(printf 'f%.0s' {1..40})"

printf '// committed frontend change\n' >> "$SOURCE_DIR/src/main.ts"
git -C "$FIXTURE_ROOT" add projects/carbonet-frontend/source/src/main.ts
git -C "$FIXTURE_ROOT" commit -qm frontend-change
FRONTEND_CHANGE_COMMIT="$(git -C "$FIXTURE_ROOT" rev-parse HEAD)"
expect_status 31 frontend-tree-mismatch
git -C "$FIXTURE_ROOT" revert --no-edit HEAD >/dev/null
verify_reuse_passes
expect_status 31 baseline-frontend-tree-mismatch "$FRONTEND_CHANGE_COMMIT"

cp "$MARKER_BACKUP" "$MARKER_FILE"

# A failed Git dirty-inventory producer must not be converted into an empty,
# apparently clean change list by process substitution.
mkdir -p "$TMP_DIR/fake-bin"
REAL_GIT="$(command -v git)"
cat > "$TMP_DIR/fake-bin/git" <<EOF
#!/usr/bin/env bash
if [[ "\${1:-}" == -C && "\${3:-}" == diff && "\${4:-}" == --name-only ]]; then
  exit 42
fi
exec "$REAL_GIT" "\$@"
EOF
chmod 755 "$TMP_DIR/fake-bin/git"
marker_before_git_failure="$(sha256sum "$MARKER_FILE" | awk '{print $1}')"
set +e
PATH="$TMP_DIR/fake-bin:$PATH" run_guard "" write-marker >/dev/null 2>&1
git_inventory_status=$?
set -e
[[ "$git_inventory_status" == 33 ]]
[[ "$(sha256sum "$MARKER_FILE" | awk '{print $1}')" == "$marker_before_git_failure" ]]
python3 - "$MARKER_FILE" <<'PY'
import json
import sys
from pathlib import Path
path = Path(sys.argv[1])
data = json.loads(path.read_text())
data["sourceCommit"] = "f" * 40
path.write_text(json.dumps(data) + "\n")
PY
expect_status 31 non-ancestor "$(printf 'f%.0s' {1..40})"
cp "$MARKER_BACKUP" "$MARKER_FILE"

python3 - "$MARKER_FILE" <<'PY'
import json
import sys
from pathlib import Path
path = Path(sys.argv[1])
data = json.loads(path.read_text())
data["schemaVersion"] = 1
path.write_text(json.dumps(data) + "\n")
PY
expect_status 31 legacy-marker
cp "$MARKER_BACKUP" "$MARKER_FILE"
python3 - "$MARKER_FILE" <<'PY'
import json
import sys
from pathlib import Path
path = Path(sys.argv[1])
data = json.loads(path.read_text())
data["materializationClosure"]["closureHash"] = "bad"
path.write_text(json.dumps(data) + "\n")
PY
expect_status 31 malformed-closure
cp "$MARKER_BACKUP" "$MARKER_FILE"
python3 - "$MARKER_FILE" <<'PY'
import json
import sys
from pathlib import Path
path = Path(sys.argv[1])
data = json.loads(path.read_text())
data["hashAlgorithm"] = "sha512"
path.write_text(json.dumps(data) + "\n")
PY
expect_status 31 wrong-hash-algorithm
cp "$MARKER_BACKUP" "$MARKER_FILE"
python3 - "$MARKER_FILE" <<'PY'
import json
import sys
from pathlib import Path
path = Path(sys.argv[1])
data = json.loads(path.read_text())
data["materializedSourceHash"] = "f" * 64
path.write_text(json.dumps(data) + "\n")
PY
expect_status 31 split-materialized-hash
cp "$MARKER_BACKUP" "$MARKER_FILE"

cp "$OVERLAY_DIR/index.html" "$TMP_DIR/index.html"
printf '<script type="module" src="/assets/react/assets/index-stale.js"></script>\n' > "$OVERLAY_DIR/index.html"
expect_status 32 index-drift
cp "$TMP_DIR/index.html" "$OVERLAY_DIR/index.html"
cp "$OVERLAY_DIR/.vite/manifest.json" "$TMP_DIR/manifest.json"
printf ' \n' >> "$OVERLAY_DIR/.vite/manifest.json"
expect_status 32 manifest-drift
cp "$TMP_DIR/manifest.json" "$OVERLAY_DIR/.vite/manifest.json"
printf '{invalid-json\n' > "$OVERLAY_DIR/.vite/manifest.json"
expect_status 32 invalid-manifest
cp "$TMP_DIR/manifest.json" "$OVERLAY_DIR/.vite/manifest.json"

cp "$OVERLAY_DIR/runtime/screen-system-assets.js" "$TMP_DIR/runtime.js"
printf '// runtime drift\n' >> "$OVERLAY_DIR/runtime/screen-system-assets.js"
expect_status 32 direct-runtime-drift
rm -f "$OVERLAY_DIR/runtime/screen-system-assets.js"
expect_status 32 direct-runtime-missing
ln -s ../assets/index-new.js "$OVERLAY_DIR/runtime/screen-system-assets.js"
expect_status 32 direct-runtime-symlink
rm -f "$OVERLAY_DIR/runtime/screen-system-assets.js"
cp "$TMP_DIR/runtime.js" "$OVERLAY_DIR/runtime/screen-system-assets.js"

cp "$OVERLAY_DIR/img/dynamic-logo.png" "$TMP_DIR/dynamic-logo.png"
printf 'public drift\n' >> "$OVERLAY_DIR/img/dynamic-logo.png"
expect_status 32 dynamic-public-drift
rm -f "$OVERLAY_DIR/img/dynamic-logo.png"
expect_status 32 dynamic-public-missing
ln -s ../assets/index-new.css "$OVERLAY_DIR/img/dynamic-logo.png"
expect_status 32 dynamic-public-symlink
rm -f "$OVERLAY_DIR/img/dynamic-logo.png"
cp "$TMP_DIR/dynamic-logo.png" "$OVERLAY_DIR/img/dynamic-logo.png"
verify_reuse_passes

# A pristine cleanup state has zero untracked/ignored source residues and must
# not synthesize an empty array element.
rm -f "${orig_paths[@]}" "$GENERATED_DIR/generatedScreenSpaceIndex.ts" \
  "$GENERATED_DIR/generation-report.json" "$SOURCE_DIR/tsconfig.app.tsbuildinfo"
verify_reuse_passes

echo "PASS frontend overlay marker materialized=1 reuse=5 allowedResidue=12 runtimeCacheResidue=2 mutants=28 entryClosure=5 publicClosure=2 baselineForwarding=1 sharedLock=1 stagingBinding=source+overlay deterministicOutputs=3"
