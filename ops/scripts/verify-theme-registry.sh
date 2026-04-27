#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REGISTRY_FILE="${REGISTRY_FILE:-$ROOT_DIR/data/theme-registry/theme-registry.json}"

fail() {
  echo "FAIL $*" >&2
  exit 1
}

command -v jq >/dev/null 2>&1 || fail "missing required command: jq"
[[ -f "$REGISTRY_FILE" ]] || fail "registry file not found: $REGISTRY_FILE"

jq empty "$REGISTRY_FILE"

[[ "$(jq -r '.ownership.businessLogicAllowed' "$REGISTRY_FILE")" == "false" ]] || fail "theme registry must not allow business logic"

theme_count="$(jq '.themes | length' "$REGISTRY_FILE")"
[[ "$theme_count" -gt 0 ]] || fail "at least one theme must be registered"

duplicate_ids="$(jq -r '.themes[].themeId' "$REGISTRY_FILE" | sort | uniq -d)"
[[ -z "$duplicate_ids" ]] || fail "duplicate theme ids: $duplicate_ids"

jq -e '.tokenCategories | index("color") and index("typography") and index("spacing") and index("radius") and index("motion")' "$REGISTRY_FILE" >/dev/null \
  || fail "required token categories are missing"

for index in $(seq 0 $((theme_count - 1))); do
  theme_id="$(jq -r ".themes[$index].themeId" "$REGISTRY_FILE")"
  version="$(jq -r ".themes[$index].version" "$REGISTRY_FILE")"
  manifest="$(jq -r ".themes[$index].installManifest" "$REGISTRY_FILE")"
  preview_required="$(jq -r ".themes[$index].previewRequired" "$REGISTRY_FILE")"

  [[ "$theme_id" =~ ^[a-z0-9][a-z0-9-]*$ ]] || fail "$theme_id must be lowercase kebab-case"
  [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "$theme_id version must be semantic x.y.z"
  [[ "$manifest" != "null" && -f "$ROOT_DIR/$manifest" ]] || fail "$theme_id install manifest not found: $manifest"
  [[ "$preview_required" == "true" ]] || fail "$theme_id must require preview verification"
done

binding_count="$(jq '.routeFamilyBindings | length' "$REGISTRY_FILE")"
[[ "$binding_count" -gt 0 ]] || fail "route-family bindings are required"

for index in $(seq 0 $((binding_count - 1))); do
  source_path="$(jq -r ".routeFamilyBindings[$index].source" "$REGISTRY_FILE")"
  [[ "$source_path" != "null" && -e "$ROOT_DIR/$source_path" ]] || fail "binding source not found: $source_path"
done

forbidden_terms="$(jq -r '.aiEditPolicy.forbiddenTokenContent[]' "$REGISTRY_FILE" | tr '\n' '|' | sed 's/|$//')"
[[ -n "$forbidden_terms" ]] || fail "forbidden token content policy is empty"

echo "PASS theme registry is valid and AI edit policy is bounded"
