#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
BASE_URL="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
LOCK="${API_REGISTRY_SYNC_LOCK:-/tmp/resonance-api-registry-sync.lock}"
exec 9>"$LOCK"; flock -n 9 || { echo '{"status":"ALREADY_RUNNING"}'; exit 0; }

mappings="$(mktemp)"; rows="$(mktemp)"
trap 'rm -f "$mappings" "$rows"' EXIT
curl -fsS "$BASE_URL/actuator/mappings" >"$mappings"
jq -c '[.contexts[].mappings.dispatcherServlets.dispatcherServlet[]
  | select(.details.requestMappingConditions != null)
  | . as $mapping
  | $mapping.details.requestMappingConditions.methods[]? as $method
  | $mapping.details.requestMappingConditions.patterns[]? as $path
  | select(($path|startswith("/actuator"))|not)
  | {method:$method,path:$path,handler:(($mapping.details.handlerMethod.className//"")+"#"+($mapping.details.handlerMethod.name//"unknown"))}]
  | unique_by(.method,.path)' "$mappings" >"$rows"
count="$(jq 'length' "$rows")"
(( count > 0 )) || { echo 'no runtime mappings discovered' >&2; exit 1; }

leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
[[ -n "$leader" ]] || { echo 'writable PostgreSQL leader not found' >&2; exit 1; }
encoded="$(base64 -w0 "$rows")"
kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -qAt -v ON_ERROR_STOP=1 <<SQL >/dev/null
BEGIN;
WITH runtime AS (
  SELECT upper(item->>'method') method, item->>'path' path, item->>'handler' handler
  FROM jsonb_array_elements(convert_from(decode('$encoded','base64'),'UTF8')::jsonb) item
)
INSERT INTO framework_api_endpoint_registry(endpoint_key,http_method,route_path,implementation_ref,active_yn,verified_at)
SELECT 'RUNTIME:'||md5(method||' '||path),method,path,handler,'Y',clock_timestamp() FROM runtime
ON CONFLICT (http_method,route_path) DO UPDATE SET
  http_method=excluded.http_method,route_path=excluded.route_path,
  implementation_ref=excluded.implementation_ref,active_yn='Y',verified_at=excluded.verified_at;
COMMIT;
SQL
printf '{"status":"SYNCED","runtimeMappings":%s}\n' "$count"
