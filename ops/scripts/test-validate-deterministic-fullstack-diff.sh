#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
VALIDATOR="$ROOT/ops/scripts/validate-deterministic-fullstack-diff.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

new_repo() {
  local destination="$1"
  git init -q "$destination"
  git -C "$destination" config user.name fixture
  git -C "$destination" config user.email fixture@example.invalid
  printf 'seed\n' >"$destination/README"
  git -C "$destination" add README
  git -C "$destination" commit -qm seed
}

write_fixture() {
  local repo="$1" process="$2" operation_count="$3" canonical="${4:-true}"
  python3 - "$repo" "$process" "$operation_count" "$canonical" <<'PY'
import hashlib
import json
import sys
from pathlib import Path

root, process, count, canonical = Path(sys.argv[1]), sys.argv[2], int(sys.argv[3]), sys.argv[4] == "true"
runtime = root / "projects/carbonet-backend-metadata/process-runtime/generated" / process
preview = root / "projects/carbonet-backend-metadata/process-runtime/design-preview" / process
endpoint = root / "projects/carbonet-backend-metadata/process-runtime/generated-endpoints" / process


def stable(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(value):
    if isinstance(value, str):
        value = value.encode()
    return hashlib.sha256(value).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")


design_catalog_hash = digest(f"design-catalog:{process}")
endpoint_catalog_hash = digest(f"endpoint-catalog:{process}")
packages = []
package_values = []
all_screens = []
for number in range(1, count + 1):
    step = f"STEP_{number}"
    filename = f"{process}__{step}.json"
    design_hash = digest(f"design:{process}:{step}")
    screens = [{"screenKey": f"{process}__{step}", "designHash": design_hash}]
    body = {
        "schemaVersion": "2.0.0",
        "process": {"code": process},
        "step": {"code": step},
        "frontend": {"pages": []},
    }
    if canonical:
        body["canonicalCatalogHash"] = design_catalog_hash
        body["canonicalScreens"] = screens
        all_screens.extend(screens)
    body["packageHash"] = digest(stable(body))
    package_values.append((filename, body))
    packages.append({
        "processCode": process,
        "stepCode": step,
        "package": filename,
        "packageHash": body["packageHash"],
        "pages": 0,
    })

packages.sort(key=lambda item: (item["processCode"], item["stepCode"]))

indexes = {}
for base in (runtime, preview):
    for filename, package in package_values:
        write_json(base / filename, package)
    index = {
        "schemaVersion": "2.0.0",
        "packageCount": len(packages),
        "skippedReviewRequired": 0,
        "packages": packages,
    }
    if canonical:
        index["canonicalCatalogHash"] = design_catalog_hash
        index["canonicalScreens"] = sorted(all_screens, key=lambda item: item["screenKey"])
    index["manifestHash"] = digest(stable(index))
    write_json(base / "index.json", index)
    indexes[base] = index

if not canonical:
    raise SystemExit(0)

artifacts = []
operations = []
for number in range(1, count + 1):
    step = f"STEP_{number}"
    operation_key = f"CompleteStep{number}"
    class_name = f"{operation_key}Controller"
    handler_class = f"egovframework.com.generated.canonical.{class_name}"
    design_hash = digest(f"design:{process}:{step}")
    endpoint_hash = digest(f"endpoint:{process}:{step}")
    for suffix in ("Controller", "Request", "Response"):
        relative = f"src/main/java/egovframework/com/generated/canonical/{operation_key}{suffix}.java"
        content = (f"package egovframework.com.generated.canonical; "
                   f"public class {operation_key}{suffix} {{ public static final String STEP = \"{step}\"; }}\n").encode()
        target = endpoint / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        artifacts.append({
            "path": relative,
            "sha256": digest(content),
            "designHash": design_hash,
            "endpointHash": endpoint_hash,
        })
    operations.append({
        "operationKey": operation_key,
        "method": "POST",
        "path": f"/api/process/{process.lower()}/{number}/{{executionId}}/complete",
        "handlerClass": handler_class,
        "handlerMethod": "execute",
        "designHash": design_hash,
        "endpointHash": endpoint_hash,
    })

artifacts.sort(key=lambda item: item["path"])
operations.sort(key=lambda item: (item["operationKey"].casefold(), item["method"], item["path"], item["handlerClass"]))
manifest = {
    "schema": "carbonet.generated-endpoints/v1",
    "adapter": "EXISTING_PROCESS_COMMAND_RUNTIME",
    "catalogHash": endpoint_catalog_hash,
    "generatorHash": digest(b"fixture-generator"),
    "artifactCount": len(artifacts),
    "artifacts": artifacts,
    "operations": operations,
}
manifest["artifactHash"] = digest(stable(manifest["artifacts"]))
manifest["bundleHash"] = digest(stable(manifest))
write_json(endpoint / "manifest.json", manifest)

release = {
    "schema": "carbonet.canonical-full-stack-release/v1",
    "lanes": ["FRONTEND", "API", "DATABASE", "HELP", "CARDS"],
    "designCatalogHash": design_catalog_hash,
    "endpointCatalogHash": endpoint_catalog_hash,
    "designHashes": sorted({item["designHash"] for item in artifacts}),
    "packageManifestHash": indexes[runtime]["manifestHash"],
    "endpointBundleHash": manifest["bundleHash"],
}
release["releaseHash"] = digest(stable(release))
write_json(endpoint / "full-stack-release.json", release)
PY
}

status_of() {
  git -C "$1" status --porcelain=v1 --untracked-files=all
}

expect_reject() {
  local label="$1" repo="$2" process="$3" lines="${4:-10000}"
  if status_of "$repo" | bash "$VALIDATOR" "$process" "$lines" "$repo" >/dev/null 2>&1; then
    echo "$label unexpectedly accepted" >&2
    exit 1
  fi
}

rehash_endpoint_manifest() {
  python3 - "$1" <<'PY'
import hashlib,json,sys
path=sys.argv[1]
stable=lambda value:json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(",",":"))
value=json.load(open(path,encoding="utf-8"))
value["artifactHash"]=hashlib.sha256(stable(value["artifacts"]).encode()).hexdigest()
value.pop("bundleHash",None)
value["bundleHash"]=hashlib.sha256(stable(value).encode()).hexdigest()
open(path,"w",encoding="utf-8").write(json.dumps(value,ensure_ascii=False,sort_keys=True,indent=2)+"\n")
PY
}

rehash_release() {
  python3 - "$1" <<'PY'
import hashlib,json,sys
path=sys.argv[1]
value=json.load(open(path,encoding="utf-8"))
value.pop("releaseHash",None)
stable=json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(",",":"))
value["releaseHash"]=hashlib.sha256(stable.encode()).hexdigest()
open(path,"w",encoding="utf-8").write(json.dumps(value,ensure_ascii=False,sort_keys=True,indent=2)+"\n")
PY
}

REPO="$TMP/repo"
new_repo "$REPO"
write_fixture "$REPO" CONTENT_OPERATION 2 true
STATUS="$(status_of "$REPO")"
[[ "$(wc -l <<<"$STATUS")" -eq 14 ]]
accepted="$(printf '%s\n' "$STATUS" | bash "$VALIDATOR" CONTENT_OPERATION 9000 "$REPO")"
grep -Fq 'files=14' <<<"$accepted"
grep -Fq 'packages:4,endpointArtifacts:6' <<<"$accepted"

expect_reject other-process "$REPO" OTHER 10
expect_reject line-excess "$REPO" CONTENT_OPERATION 30000000

# Scope and path-shape mutations remain fail-closed.
bad="$REPO/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/CONTENT_OPERATION/src/main/java/egovframework/com/generated/canonical/Extra.java"
printf 'public class Extra {}\n' >"$bad"
expect_reject undeclared "$REPO" CONTENT_OPERATION
rm -f "$bad"

controller="$REPO/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/CONTENT_OPERATION/src/main/java/egovframework/com/generated/canonical/CompleteStep1Controller.java"
cp "$controller" "$TMP/controller.java"
rm "$controller"
expect_reject removed-artifact "$REPO" CONTENT_OPERATION
cp "$TMP/controller.java" "$controller"
printf '// byte mutation\n' >>"$controller"
expect_reject artifact-byte-hash "$REPO" CONTENT_OPERATION
cp "$TMP/controller.java" "$controller"
rm "$controller"
ln -s "$TMP/controller.java" "$controller"
expect_reject artifact-symlink "$REPO" CONTENT_OPERATION
rm "$controller"
cp "$TMP/controller.java" "$controller"

manifest="$REPO/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/CONTENT_OPERATION/manifest.json"
release="$REPO/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/CONTENT_OPERATION/full-stack-release.json"
runtime_index="$REPO/projects/carbonet-backend-metadata/process-runtime/generated/CONTENT_OPERATION/index.json"
runtime_package="$REPO/projects/carbonet-backend-metadata/process-runtime/generated/CONTENT_OPERATION/CONTENT_OPERATION__STEP_1.json"
cp "$manifest" "$TMP/manifest.json"
cp "$release" "$TMP/release.json"
cp "$runtime_index" "$TMP/runtime-index.json"
cp "$runtime_package" "$TMP/runtime-package.json"

jq '.artifactHash=("0"*64)' "$manifest" >"$manifest.tmp" && mv "$manifest.tmp" "$manifest"
expect_reject artifact-hash "$REPO" CONTENT_OPERATION
cp "$TMP/manifest.json" "$manifest"
jq '.bundleHash=("0"*64)' "$manifest" >"$manifest.tmp" && mv "$manifest.tmp" "$manifest"
expect_reject bundle-hash "$REPO" CONTENT_OPERATION
cp "$TMP/manifest.json" "$manifest"

# Rehashing the manifest cannot hide a broken operation-to-artifact binding.
jq '.operations[0].designHash=("0"*64)' "$manifest" >"$manifest.tmp" && mv "$manifest.tmp" "$manifest"
rehash_endpoint_manifest "$manifest"
expect_reject operation-provenance "$REPO" CONTENT_OPERATION
cp "$TMP/manifest.json" "$manifest"

jq '.frontend.pages=[{"mutated":true}]' "$runtime_package" >"$runtime_package.tmp" && mv "$runtime_package.tmp" "$runtime_package"
expect_reject package-hash "$REPO" CONTENT_OPERATION
cp "$TMP/runtime-package.json" "$runtime_package"
jq '.manifestHash=("0"*64)' "$runtime_index" >"$runtime_index.tmp" && mv "$runtime_index.tmp" "$runtime_index"
expect_reject manifest-hash "$REPO" CONTENT_OPERATION
cp "$TMP/runtime-index.json" "$runtime_index"

# Even a self-consistent releaseHash cannot conceal a stale cross-link.
jq '.endpointCatalogHash=("0"*64)' "$release" >"$release.tmp" && mv "$release.tmp" "$release"
rehash_release "$release"
expect_reject endpoint-cross-link "$REPO" CONTENT_OPERATION
cp "$TMP/release.json" "$release"
jq '.packageManifestHash=("0"*64)' "$release" >"$release.tmp" && mv "$release.tmp" "$release"
rehash_release "$release"
expect_reject package-cross-link "$REPO" CONTENT_OPERATION
cp "$TMP/release.json" "$release"
jq '.releaseHash=("0"*64)' "$release" >"$release.tmp" && mv "$release.tmp" "$release"
expect_reject release-hash "$REPO" CONTENT_OPERATION
cp "$TMP/release.json" "$release"

# A valid current tree is still rejected when the exact HEAD artifact bytes do
# not match HEAD's own manifest.
PREVIOUS="$TMP/previous"
new_repo "$PREVIOUS"
write_fixture "$PREVIOUS" PREVIOUS_PROCESS 1 true
previous_controller="$PREVIOUS/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/PREVIOUS_PROCESS/src/main/java/egovframework/com/generated/canonical/CompleteStep1Controller.java"
cp "$previous_controller" "$TMP/previous-controller.java"
git -C "$PREVIOUS" add . && git -C "$PREVIOUS" commit -qm valid-generated
printf '// corrupt committed bytes\n' >>"$previous_controller"
git -C "$PREVIOUS" add . && git -C "$PREVIOUS" commit -qm corrupt-generated
cp "$TMP/previous-controller.java" "$previous_controller"
expect_reject previous-artifact-byte-hash "$PREVIOUS" PREVIOUS_PROCESS

# Rolling-upgrade packages without endpoint output retain the legacy path, but
# package and index hashes remain mandatory.
LEGACY="$TMP/legacy"
new_repo "$LEGACY"
write_fixture "$LEGACY" LEGACY_PROCESS 1 false
legacy_status="$(status_of "$LEGACY")"
printf '%s\n' "$legacy_status" | bash "$VALIDATOR" LEGACY_PROCESS 100 "$LEGACY" >/dev/null

# A legitimate manifest-bound package removal remains supported.
REMOVAL="$TMP/removal"
new_repo "$REMOVAL"
write_fixture "$REMOVAL" REMOVAL_PROCESS 2 false
git -C "$REMOVAL" add . && git -C "$REMOVAL" commit -qm generated
python3 - "$REMOVAL" <<'PY'
import hashlib,json,sys
from pathlib import Path
root=Path(sys.argv[1]); process="REMOVAL_PROCESS"; filename=f"{process}__STEP_2.json"
stable=lambda value:json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(",",":"))
for lane in ("generated","design-preview"):
    base=root/"projects/carbonet-backend-metadata/process-runtime"/lane/process
    (base/filename).unlink()
    index=json.loads((base/"index.json").read_text())
    index["packages"]=[item for item in index["packages"] if item["package"] != filename]
    index["packageCount"]=len(index["packages"])
    index.pop("manifestHash")
    index["manifestHash"]=hashlib.sha256(stable(index).encode()).hexdigest()
    (base/"index.json").write_text(json.dumps(index,sort_keys=True,indent=2)+"\n")
PY
removal_status="$(status_of "$REMOVAL")"
printf '%s\n' "$removal_status" | bash "$VALIDATOR" REMOVAL_PROCESS 100 "$REMOVAL" >/dev/null

# The production maximum is validated in under two seconds after fixture and
# status creation; this covers 1,427 screens and 7,139 declared files.
SCALE="$TMP/scale"
new_repo "$SCALE"
write_fixture "$SCALE" SCALE_PROCESS 1427 true
scale_status="$(status_of "$SCALE")"
[[ "$(wc -l <<<"$scale_status")" -eq 7139 ]]
started_ns="$(date +%s%N)"
printf '%s\n' "$scale_status" | bash "$VALIDATOR" SCALE_PROCESS 1000000 "$SCALE" >/dev/null
finished_ns="$(date +%s%N)"
scale_millis=$(( (finished_ns - started_ns) / 1000000 ))
(( scale_millis < 2000 ))

echo "PASS deterministic full-stack cryptographic closure validEndpoints=2 files=14 mutations=15 legacy=1 removal=1 scaleScreens=1427 scaleFiles=7139 scaleMillis=$scale_millis"
