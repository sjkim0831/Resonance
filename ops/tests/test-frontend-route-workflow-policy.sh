#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
SQL="$ROOT/ops/scripts/sql/sync-frontend-route-workflow-policy.sql"

fail() {
  echo "[frontend-route-policy-test] FAIL: $*" >&2
  exit 1
}

[[ -f "$SQL" ]] || fail "missing policy SQL"

mapfile -t informational_routes < <(
  sed -n '/input.route_key=ANY(ARRAY\[/,/]) AS intentional_informational/p' "$SQL" \
    | grep -oE "'/[^']+'" \
    | tr -d "'"
)

[[ "${#informational_routes[@]}" -eq 29 ]] \
  || fail "expected 29 informational routes, got ${#informational_routes[@]}"

duplicates="$(printf '%s\n' "${informational_routes[@]}" | sort | uniq -d)"
[[ -z "$duplicates" ]] || fail "duplicate informational routes: $duplicates"

expected_source_audited_routes=(
  /join/companyjoinstatusguide
  /home
  /home/alerts
  /emission/index
  /emission/deadline-status
  /emission/project-completion
  /emission/project/progress
  /emission/lci
  /emission/lca
  /monitoring/index
  /monitoring/dashboard
  /monitoring/realtime
  /monitoring/alerts
  /monitoring/reduction_trend
  /monitoring/track
)

for route in "${expected_source_audited_routes[@]}"; do
  count="$(printf '%s\n' "${informational_routes[@]}" | grep -Fxc -- "$route" || true)"
  [[ "$count" -eq 1 ]] || fail "$route is not represented exactly once"
done

grep -Fq 'informational_count<>29' "$SQL" \
  || fail "classification drift guard is not synchronized"
grep -Fq 'fallbackReviewPromoted' "$SQL" \
  || fail "fail-closed audit evidence is missing"
grep -Fq "WHEN classification='REVIEW_REQUIRED' THEN 'PENDING'" "$SQL" \
  || fail "review-required routes are no longer fail-closed"

echo "[frontend-route-policy-test] PASS informational=29 source-audited=15 duplicates=0"
