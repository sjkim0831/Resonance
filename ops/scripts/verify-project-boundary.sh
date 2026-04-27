#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTRACT_FILE="${CONTRACT_FILE:-$ROOT_DIR/data/project-boundary/resonance-carbonet-boundary-contract.json}"

fail() {
  echo "FAIL $*" >&2
  exit 1
}

command -v jq >/dev/null 2>&1 || fail "missing required command: jq"
[[ -f "$CONTRACT_FILE" ]] || fail "boundary contract not found: $CONTRACT_FILE"
jq empty "$CONTRACT_FILE"

project_parent="$(jq -r '.mavenBoundary.projectParent' "$CONTRACT_FILE")"
module_parent="$(jq -r '.mavenBoundary.moduleParent' "$CONTRACT_FILE")"
[[ -f "$ROOT_DIR/$project_parent" ]] || fail "project parent not found: $project_parent"
[[ -f "$ROOT_DIR/$module_parent" ]] || fail "module parent not found: $module_parent"

zone_count="$(jq '.zones | length' "$CONTRACT_FILE")"
[[ "$zone_count" -ge 4 ]] || fail "expected at least four boundary zones"

for index in $(seq 0 $((zone_count - 1))); do
  zone_id="$(jq -r ".zones[$index].zoneId" "$CONTRACT_FILE")"
  root_count="$(jq ".zones[$index].roots | length" "$CONTRACT_FILE")"
  [[ "$root_count" -gt 0 ]] || fail "$zone_id has no roots"

  for root_index in $(seq 0 $((root_count - 1))); do
    root_path="$(jq -r ".zones[$index].roots[$root_index]" "$CONTRACT_FILE")"
    [[ -e "$ROOT_DIR/$root_path" ]] || fail "$zone_id root not found: $root_path"
  done
done

for module in $(jq -r '.mavenBoundary.projectModules[]' "$CONTRACT_FILE"); do
  grep -q "<module>$module</module>" "$ROOT_DIR/$project_parent" || fail "project parent missing module: $module"
done

for forbidden in $(jq -r '.mavenBoundary.forbiddenProjectModules[]' "$CONTRACT_FILE"); do
  if grep -q "<module>$forbidden" "$ROOT_DIR/$project_parent"; then
    fail "project parent must not include framework module: $forbidden"
  fi
done

common_jar_set="$(jq -r '.packageSets.commonJarSet' "$CONTRACT_FILE")"
carbonet_package_set="$(jq -r '.packageSets.carbonetPackageSet' "$CONTRACT_FILE")"
[[ -f "$ROOT_DIR/$common_jar_set" ]] || fail "common jar set not found: $common_jar_set"
[[ -f "$ROOT_DIR/$carbonet_package_set" ]] || fail "carbonet package set not found: $carbonet_package_set"

jq -e '.aiEditPolicy.mutationAllowedByDefault == false' "$CONTRACT_FILE" >/dev/null \
  || fail "AI mutation must be disabled by default for boundary moves"

jq -e '.aiEditPolicy.defaultWhenUncertain == "Resonance first, expose through adapter"' "$CONTRACT_FILE" >/dev/null \
  || fail "uncertain boundary default must stay Resonance-first"

echo "PASS project boundary contract is valid"
