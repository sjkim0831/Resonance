#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
DEPLOY_STATE_FILE="${CARBONET_DEPLOY_STATE_FILE:-/opt/resonance-data/deploy/carbonet-main-success.commit}"
K8S_NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
POSTGRES_POD="${POSTGRES_POD:-postgres-patroni-0}"
PGHOST="${PGHOST:-postgres-haproxy}"
APPLY=false
[[ "${1:-}" == "--apply" ]] && APPLY=true

: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"

psqlq() {
  kubectl -n "$K8S_NAMESPACE" exec "$POSTGRES_POD" -- env PGPASSWORD="$PGPASSWORD" \
    psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -X -q -v ON_ERROR_STOP=1 -At "$@"
}

deployed="$(tr -d '[:space:]' <"$DEPLOY_STATE_FILE")"
[[ "$deployed" =~ ^[0-9a-f]{40}$ ]] || { echo "invalid deploy marker" >&2; exit 1; }
git -C "$ROOT_DIR" cat-file -e "${deployed}^{commit}"

read -r desired ready available < <(
  kubectl -n "$K8S_NAMESPACE" get deployment carbonet-runtime \
    -o jsonpath='{.spec.replicas}{" "}{.status.readyReplicas}{" "}{.status.availableReplicas}{"\n"}'
)
[[ "$desired" =~ ^[0-9]+$ && "$desired" -gt 0 && "$ready" == "$desired" && "$available" == "$desired" ]] \
  || { echo "runtime deployment is not ready: desired=$desired ready=$ready available=$available" >&2; exit 1; }

node_port="$(kubectl -n "$K8S_NAMESPACE" get svc carbonet-runtime -o jsonpath='{.spec.ports[?(@.name=="http")].nodePort}')"
curl -fsS --max-time 10 "http://127.0.0.1:${node_port}/actuator/health" | jq -e '.status == "UP"' >/dev/null

mapfile -t job_ids < <(psqlq -c "select job_id from framework_development_job where job_status='RETRY' and last_error='result commit was not deployed' order by job_id")
verified=0
skipped=0

for job_id in "${job_ids[@]}"; do
  result_commit="$(git -C "$ROOT_DIR" log --all --format='%H' --grep="job ${job_id}$" -i -n 1)"
  if [[ ! "$result_commit" =~ ^[0-9a-f]{40}$ ]] \
    || ! git -C "$ROOT_DIR" merge-base --is-ancestor "$result_commit" "$deployed"; then
    printf 'SKIP job=%s commit=%s\n' "$job_id" "${result_commit:-missing}"
    skipped=$((skipped + 1))
    continue
  fi

  printf '%s job=%s commit=%s\n' "$([[ "$APPLY" == true ]] && echo VERIFY || echo DRY_RUN)" "$job_id" "$result_commit"
  if [[ "$APPLY" == true ]]; then
    psqlq -c "
      update framework_development_job
         set job_status='VERIFIED', quality_status='VERIFIED',
             result_json=jsonb_build_object('commit','${result_commit}','strategy','RECONCILE_DEPLOYED_ANCESTOR'),
             evidence_ref='git:${result_commit};deploy:${deployed};health:UP',
             last_error=null, completed_at=current_timestamp, lease_token=null, lease_until=null,
             updated_at=current_timestamp
       where job_id=${job_id} and job_status='RETRY'
         and last_error='result commit was not deployed';
      update framework_process_artifact a
         set delivery_status='VERIFIED', evidence_ref='git:${result_commit};deploy:${deployed};health:UP',
             updated_at=current_timestamp
        from framework_development_job j
       where j.job_id=${job_id} and a.process_code=j.process_code and a.step_code=j.step_code
         and a.contract_ref='AUTO:' || j.job_type;
      insert into framework_development_job_gate_result(job_id,gate_code,result,summary,evidence_ref)
      values (${job_id},'DEPLOY_HEALTH','PASSED',
              'Result commit is contained in the canonical deployed commit and runtime is healthy.',
              'git:${result_commit};deploy:${deployed};health:UP');
    " >/dev/null
  fi
  verified=$((verified + 1))
done

printf 'SUMMARY mode=%s candidates=%d verified=%d skipped=%d deployed=%s replicas=%s/%s\n' \
  "$([[ "$APPLY" == true ]] && echo apply || echo dry-run)" "${#job_ids[@]}" "$verified" "$skipped" "$deployed" "$ready" "$desired"
