#!/usr/bin/env bash
set -euo pipefail

root_dir="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
namespace="${CARBONET_NAMESPACE:-carbonet-prod}"
database="${CARBONET_DATABASE:-carbonet}"
cache_dir="${FULL_SCREEN_SMOKE_CACHE_DIR:-$root_dir/.cache/full-screen-smoke}"
input_path="$cache_dir/contracts.jsonl"
manifest_path="${FULL_SCREEN_SMOKE_MANIFEST:-$cache_dir/manifest.json}"
baseline_path="${FULL_SCREEN_SMOKE_BASELINE:-$cache_dir/last-success.json}"
shards="${FULL_SCREEN_SMOKE_SHARDS:-8}"
changed_only="${FULL_SCREEN_SMOKE_CHANGED_ONLY:-false}"
route_pattern="${FULL_SCREEN_SMOKE_ROUTE_PATTERN:-}"

mkdir -p "$cache_dir"
tmp_path="$cache_dir/contracts.jsonl.tmp.$$"
trap 'rm -f "$tmp_path"' EXIT

pod="$(kubectl -n "$namespace" get pod -l application=spilo,cluster-name=postgres-patroni --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
if [[ -z "$pod" ]]; then
  pod="postgres-patroni-0"
fi

sql="select json_build_object(
  'contractId',contract_id,
  'processCode',process_code,
  'stepCode',step_code,
  'audience',audience,
  'routePath',route_path,
  'screenName',screen_name,
  'actorCode',actor_code,
  'contractStatus',contract_status,
  'updatedAt',updated_at
) from framework_professional_screen_contract where coalesce(route_path,'')<>'' order by contract_id"

kubectl -n "$namespace" exec "$pod" -- \
  psql -h 127.0.0.1 -U postgres -d "$database" -X -At -v ON_ERROR_STOP=1 -c "$sql" >"$tmp_path"

if [[ ! -s "$tmp_path" ]]; then
  echo "screen contract export is empty" >&2
  exit 1
fi

mv "$tmp_path" "$input_path"
trap - EXIT
node "$root_dir/scripts/generate-full-screen-smoke-manifest.mjs" \
  --input "$input_path" \
  --output "$manifest_path" \
  --baseline "$baseline_path" \
  --shards "$shards" \
  --changedOnly "$changed_only" \
  --routePattern "$route_pattern"
