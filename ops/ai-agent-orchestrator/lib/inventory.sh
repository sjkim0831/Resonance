#!/bin/bash
# inventory.sh - inventory lib for agent orchestrator
# Produces deterministic JSON counts/references

INV_VERSION="1.0"
SEARCH_LIB="${SEARCH_LIB:-$(dirname "${BASH_SOURCE[0]}")/search.sh}"

[[ -f "$SEARCH_LIB" ]] && source "$SEARCH_LIB"

_inv_rg() {
  local query="$1"; shift
  local dir="${1:-.}"; shift
  local max="${INV_MAX:-200}"
  rg -SM --vimgrep -m "$max" \
    -g '!.git/*' -g '!node_modules/*' -g '!vendor/*' \
    -g '!target/*' -g '!build/*' -g '!dist/*' \
    "$query" "$dir" 2>/dev/null || true
}

inv_react_routes() {
  local dir="${1:-projects/carbonet-frontend/source/src}"
  local max="${INV_MAX:-200}"
  local count; count=$(rg -c "route\s*[:(]|path\s*[:(]|Route\s*[{]" -g '*.tsx' -g '*.ts' "$dir" 2>/dev/null | wc -l)
  local items; items=$(_inv_rg "route\s*[:(]|path\s*[:(]|Route\s*[{]" "$dir" -g '*.tsx' -g '*.ts' | head -50)
  jq -n \
    --argjson count "$count" \
    --argjson items "$(echo "$items" | jq -R . | jq -s .)" \
    '{type:"react-routes",count:$count,items:$items}'
}

inv_java_controllers() {
  local dir="${1:-apps}"
  local max="${INV_MAX:-200}"
  local count; count=$(rg -c "@(Get|Post|Put|Delete|Patch)Mapping|@RequestMapping" \
    -g '*.java' --type java "$dir" 2>/dev/null | wc -l)
  local items; items=$(_inv_rg "@(Get|Post|Put|Delete|Patch)Mapping|@RequestMapping" "$dir" -g '*.java' --type java | head -50)
  jq -n \
    --argjson count "$count" \
    --argjson items "$(echo "$items" | jq -R . | jq -s .)" \
    '{type:"java-controllers",count:$count,items:$items}'
}

inv_admin_menu() {
  local file="${1:-apps/carbonet-api/src/main/resources/db/baseline/admin-menu-169.tsv}"
  local max="${INV_MAX:-200}"
  local count=0 items="[]"
  if [[ -f "$file" ]]; then
    count=$(wc -l < "$file")
    items=$(tail -50 "$file" | jq -R . | jq -s .)
  fi
  jq -n \
    --argjson count "$count" \
    --argjson items "$items" \
    --arg file "$file" \
    '{type:"admin-menu-169",count:$count,items:$items,file:$file}'
}

inv_page_manifests() {
  local file="${1:-projects/carbonet-frontend/source/src/platform/screen-registry/pageManifests.ts}"
  local max="${INV_MAX:-200}"
  local count=0 items="[]"
  if [[ -f "$file" ]]; then
    count=$(rg -c "^export const|\bpageId\s*[:(]" -g '*.ts' "$file" 2>/dev/null | wc -l)
    items=$(rg "^export const|\bpageId\s*[:(]" "$file" -g '*.ts' 2>/dev/null | head -50 | jq -R . | jq -s .)
  fi
  jq -n \
    --argjson count "$count" \
    --argjson items "$items" \
    --arg file "$file" \
    '{type:"page-manifests",count:$count,items:$items,file:$file}'
}

inv_sdui_bindings() {
  local file="${1:-projects/carbonet-backend-metadata/customer-trace/customer-sdui-bindings.json}"
  local count=0 items="[]"
  if [[ -f "$file" ]]; then
    count=$(jq '.bindings | length' "$file" 2>/dev/null || echo 0)
    items=$(jq '[.bindings[0:20][] | {bindingId, useCaseId, title, domain}]' "$file" 2>/dev/null || echo '[]')
  fi
  jq -n \
    --argjson count "$count" \
    --argjson items "$items" \
    --arg file "$file" \
    '{type:"customer-sdui-bindings",count:$count,items:$items,file:$file}'
}

inv_all() {
  local base="${1:-.}"
  echo "{"
  echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
  echo "  \"inventory\": ["
  echo "    $(inv_react_routes "$base/projects/carbonet-frontend/source/src" | jq -c .),"
  echo "    $(inv_java_controllers "$base/apps" | jq -c .),"
  echo "    $(inv_admin_menu "$base/apps/carbonet-api/src/main/resources/db/baseline/admin-menu-169.tsv" | jq -c .),"
  echo "    $(inv_page_manifests "$base/projects/carbonet-frontend/source/src/platform/screen-registry/pageManifests.ts" | jq -c .),"
  echo "    $(inv_sdui_bindings "$base/projects/carbonet-backend-metadata/customer-trace/customer-sdui-bindings.json" | jq -c .)"
  echo "  ]"
  echo "}"
}