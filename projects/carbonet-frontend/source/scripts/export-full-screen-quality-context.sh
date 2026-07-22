#!/usr/bin/env bash
set -euo pipefail

root_dir="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
namespace="${CARBONET_NAMESPACE:-carbonet-prod}"
database="${CARBONET_DATABASE:-carbonet}"
output="${FULL_SCREEN_QUALITY_CONTEXT:-$root_dir/.cache/full-screen-smoke/quality-context.jsonl}"
mkdir -p "$(dirname "$output")"
tmp="$output.tmp.$$"
trap 'rm -f "$tmp"' EXIT

pod="$(kubectl -n "$namespace" get pods -o name | sed 's#pod/##' | grep '^postgres-patroni-' | sort | head -1)"
[[ -n "$pod" ]] || { echo "PostgreSQL Patroni pod not found" >&2; exit 1; }

sql="select json_build_object(
  'screenResourceId',q.screen_resource_id,
  'routeKey',q.route_key,
  'screenName',q.screen_name,
  'implementationStatus',q.implementation_status,
  'sourceRef',r.source_ref,
  'bindingCount',q.binding_count,
  'processCount',q.process_count,
  'actorCount',q.actor_count,
  'testCount',q.test_count,
  'actualTaskCount',q.actual_task_count,
  'professionalScore',q.professional_score,
  'customerReadiness',q.customer_readiness,
  'gapCodes',q.gap_codes
) from framework_screen_professional_quality q
join framework_screen_resource r using(screen_resource_id)
order by q.route_key"

kubectl -n "$namespace" exec "$pod" -c patroni -- \
  psql -h 127.0.0.1 -U postgres -d "$database" -X -At -v ON_ERROR_STOP=1 -c "$sql" > "$tmp"
[[ -s "$tmp" ]] || { echo "quality context export is empty" >&2; exit 1; }
mv "$tmp" "$output"
trap - EXIT
echo "[full-screen-quality] context=$output rows=$(wc -l < "$output" | tr -d ' ')"
