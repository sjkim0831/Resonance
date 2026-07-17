#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"; NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"; DB="${PGDATABASE:-carbonet}"; DB_USER="${PGUSER:-postgres}"; MAX_PARALLEL_WORKERS="${MAX_PARALLEL_WORKERS:-3}"
LOCK_FILE="${PROJECT_AUTO_COMPLETION_LOCK:-/tmp/resonance-project-auto-completion.lock}"
exec 9>"$LOCK_FILE"; flock -n 9 || exit 0
leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U "$DB_USER" -d "$DB" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || { echo "[project-auto-completion] writable PostgreSQL leader not found" >&2; exit 1; }
psqlq(){ kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U "$DB_USER" -d "$DB" -X -q -v ON_ERROR_STOP=1 -At "$@"; }
run_id="$(cat /proc/sys/kernel/random/uuid)"
psqlq -c "insert into framework_project_completion_run(run_id) values('$run_id');" >/dev/null
trap 'psqlq -c "update framework_project_completion_run set run_status='"'"'FAILED'"'"',completed_at=current_timestamp where run_id='"'"'$run_id'"'"';" >/dev/null 2>&1 || true' ERR
selected="$(psqlq -c "select count(*) from framework_process_delivery_priority_queue where next_action<>'COMPLETE';")"
retried="$(psqlq -c "with recovered as (update framework_development_job set job_status='RETRY',worker_id=null,lease_token=null,lease_until=null,updated_at=current_timestamp where job_status='FAILED' and attempt_count<max_attempts returning 1) select count(*) from recovered;")"
executable="$(psqlq -c "select count(*) from framework_development_job where approval_status='APPROVED' and job_status in ('PLANNED','RETRY');")"
if [[ "$executable" -gt 0 ]]; then
  ROOT_DIR="$ROOT_DIR" MAX_PARALLEL_WORKERS="$MAX_PARALLEL_WORKERS" "$ROOT_DIR/ops/scripts/run-process-development-dispatcher.sh"
fi
completed="$(psqlq -c "with done as (update framework_process_definition p set process_status='DEVELOPMENT_READY',updated_at=current_timestamp from framework_process_delivery_priority_queue q where q.process_code=p.process_code and q.next_action='COMPLETE' and p.process_status<>'DEVELOPMENT_READY' returning 1) select count(*) from done;")"
blocked="$(psqlq -c "select count(*) from framework_process_delivery_priority_queue where delivery_priority='BLOCKER';")"
remaining="$(psqlq -c "select count(*) from framework_process_delivery_priority_queue where next_action<>'COMPLETE';")"
status="PROGRESSING"; [[ "$remaining" == "0" ]] && status="COMPLETED"; [[ "$blocked" -gt 0 || ( "$remaining" -gt 0 && "$executable" == "0" ) ]] && status="ATTENTION_REQUIRED"
psqlq -c "update framework_project_completion_run set run_status='$status',selected_process_count=$selected,executable_job_count=$executable,retried_job_count=$retried,completed_process_count=$completed,blocked_process_count=$blocked,result_json='{\"remainingProcesses\":$remaining}',completed_at=current_timestamp where run_id='$run_id';" >/dev/null
echo "[project-auto-completion] $status selected=$selected executable=$executable retried=$retried completed=$completed blocked=$blocked remaining=$remaining"
