#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
LIMIT="${2:-1000}"; NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
exec 8>"${DESIGN_METADATA_LOCK:-/tmp/resonance-design-metadata.lock}"
flock -n 8 || { echo '{"success":true,"status":"DESIGN_UPDATE_RUNNING"}'; exit 0; }
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U postgres -d carbonet -X -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
[[ -n "$leader" ]] || exit 1
kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres \
  -d carbonet -X -qAt -v ON_ERROR_STOP=1 -c "select framework_refresh_contract_design_tasks($LIMIT)" >/dev/null
kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres \
  -d carbonet -X -qAt -v ON_ERROR_STOP=1 -c "select framework_contract_design_task_export($LIMIT)" >"$work/tasks.json"
count="$(jq length "$work/tasks.json")"; (( count > 0 )) || { echo '{"success":true,"status":"NO_TASKS"}';exit 0; }
python3 "$ROOT/ops/scripts/generate-16lane-design-candidates.py" "$work/tasks.json" \
  --out "$work/nvidia.json" --lanes 16
python3 "$ROOT/ops/scripts/validate-contract-design-candidates.py" \
  "$work/nvidia.json" "$work/validated.json"
encoded="$(base64 -w0 "$work/validated.json")"
kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres \
  -d carbonet -X -qAt -v ON_ERROR_STOP=1 <<SQL >/dev/null
select framework_import_contract_design_candidates(
  convert_from(decode('$encoded','base64'),'UTF8')::jsonb,'minimaxai/minimax-m3');
SQL
(cd "$ROOT" && python3 ops/scripts/select-e4b-contract-candidates.py \
  "$work/validated.json" --out "$work/e4b.json")
encoded="$(base64 -w0 "$work/e4b.json")"
kubectl -n "$NAMESPACE" exec -i "$leader" -c patroni -- psql -h 127.0.0.1 -U postgres \
  -d carbonet -X -qAt -v ON_ERROR_STOP=1 <<SQL >/dev/null
select framework_import_contract_design_selections(
  convert_from(decode('$encoded','base64'),'UTF8')::jsonb);
SQL
jq -n --argjson tasks "$count" --slurpfile n "$work/validated.json" --slurpfile e "$work/e4b.json" \
  '{success:true,tasks:$tasks,nvidiaValid:$n[0].validCount,nvidiaInvalid:$n[0].invalidCount,e4bSelections:($e[0].selections|length)}'
