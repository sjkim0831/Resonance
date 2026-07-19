#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:?repository root is required}"
PROCESS="${2:?process code is required}"
STEP="${3:?step code is required}"
[[ "$PROCESS" == "EMISSION_PROJECT" ]] || exit 3

SEARCH_PAGE="$ROOT/projects/carbonet-frontend/source/src/features/integrated-search/IntegratedSearchPage.tsx"
SEARCH_SOURCE="$ROOT/projects/carbonet-frontend/source/src/features/home-entry/HomeEntrySections.tsx"
ROUTES="$ROOT/projects/carbonet-frontend/source/src/app/routes/families/contentSupportFamily.ts"
INVENTORY="$ROOT/projects/carbonet-frontend/source/src/features/builder-studio/routeSourceInventory.ts"
[[ -s "$SEARCH_PAGE" && -s "$SEARCH_SOURCE" && -s "$ROUTES" && -s "$INVENTORY" ]] || exit 1

# Integrated search is deliberately assembled from the DB-backed home menu plus
# work leaves and published content. All three scopes and their detail flows are
# required; a route-only page is not accepted as search implementation.
grep -Fq 'const GROUPS = ["menu", "work", "post"]' "$SEARCH_PAGE"
grep -Fq 'buildSearchCandidates(content, state.value?.homeMenu' "$SEARCH_PAGE"
grep -Fq 'fetchHomePayload()' "$SEARCH_PAGE"
grep -Fq 'items.slice(0, 5)' "$SEARCH_PAGE"
grep -Fq 'setActiveTone(tone)' "$SEARCH_PAGE"
grep -Fq 'setSelectedPost(item)' "$SEARCH_PAGE"
grep -Fq 'const menuCandidates = homeMenu.flatMap' "$SEARCH_SOURCE"
grep -Fq 'const workCandidates = homeMenu.flatMap' "$SEARCH_SOURCE"
grep -Fq 'const postCandidates: SearchCandidate[]' "$SEARCH_SOURCE"
grep -Fq 'tone: "post" as const' "$SEARCH_SOURCE"
grep -Fq 'koPath: "/home/search"' "$ROUTES"
grep -Fq '"koPath": "/home/search"' "$INVENTORY"

case "$STEP" in
  EMISSION_PROJECT_SETUP) route='/emission/project/create' ;;
  EMISSION_PROJECT_COLLECT|EMISSION_PROJECT_CORRECT) route='/emission/data_input' ;;
  EMISSION_PROJECT_CALCULATE) route='/emission/simulate' ;;
  EMISSION_PROJECT_VALIDATE|EMISSION_PROJECT_APPROVE) route='/emission/validate' ;;
  EMISSION_PROJECT_REPORT) route='/emission/report_submit' ;;
  *) exit 3 ;;
esac
grep -Fq "\"koPath\": \"$route\"" "$INVENTORY" || {
  echo "missing indexed process route: $route" >&2
  exit 1
}

BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
code="$(curl -sS -L -o /tmp/emission-project-search-page.html -w '%{http_code}' "$BASE_URL/home/search?q=carbon")"
[[ "$code" == "200" ]] || { echo "integrated search page status=$code" >&2; exit 1; }
grep -qi '<!doctype html' /tmp/emission-project-search-page.html

workflow="$(bash "$ROOT/ops/scripts/validate-emission-project-workflow.sh")"
jq -cn --arg process "$PROCESS" --arg step "$STEP" --arg route "$route" --arg workflow "$workflow" \
  '{handled:true,strategy:"EXACT_INTEGRATED_SEARCH_ADOPTION",process:$process,step:$step,indexedRoute:$route,scopes:["menu","work","post"],liveStatus:200,workflow:$workflow}'
