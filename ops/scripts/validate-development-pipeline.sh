#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DATABASE="${POSTGRES_DB:-carbonet}"
USER_NAME="${POSTGRES_ADMIN_USER:-postgres}"
CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"

leader=""
while IFS= read -r pod; do
  recovery="$(kubectl -n "$NAMESPACE" exec "$pod" -c "$CONTAINER" -- \
    psql -h 127.0.0.1 -U "$USER_NAME" -d "$DATABASE" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)"
  [[ "$recovery" == "f" ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || { echo "[development-pipeline] FAIL PostgreSQL leader missing" >&2; exit 1; }

read -r phases jobs dependencies unclassified invalid_order cycles <<<"$(
  kubectl -n "$NAMESPACE" exec "$leader" -c "$CONTAINER" -- \
    psql -h 127.0.0.1 -U "$USER_NAME" -d "$DATABASE" -AtF' ' -qc "
      with recursive walk(root_job,current_job,path,cycle) as (
        select d.job_id,d.depends_on_job_id,array[d.job_id,d.depends_on_job_id],false
        from framework_development_job_dependency d where d.dependency_source='PIPELINE'
        union all
        select w.root_job,d.depends_on_job_id,w.path||d.depends_on_job_id,d.depends_on_job_id=any(w.path)
        from walk w join framework_development_job_dependency d on d.job_id=w.current_job
        where not w.cycle and d.dependency_source='PIPELINE'
      )
      select
        (select count(*) from framework_development_phase where active_yn='Y'),
        (select count(*) from framework_development_job where process_code='EMISSION_PROJECT' and required),
        (select count(*) from framework_development_job_dependency d join framework_development_job j on j.job_id=d.job_id where j.process_code='EMISSION_PROJECT' and d.dependency_source='PIPELINE'),
        (select count(*) from framework_development_job j left join framework_development_phase p on p.job_type=j.job_type and p.active_yn='Y' where j.process_code='EMISSION_PROJECT' and j.required and p.job_type is null),
        (select count(*) from framework_development_job_dependency d join framework_development_job j on j.job_id=d.job_id join framework_development_job prior on prior.job_id=d.depends_on_job_id join framework_development_phase cp on cp.job_type=j.job_type join framework_development_phase pp on pp.job_type=prior.job_type where j.process_code='EMISSION_PROJECT' and d.dependency_source='PIPELINE' and pp.phase_order>=cp.phase_order),
        (select count(*) from walk where cycle)
    "
)"

if [[ "$phases" -lt 20 || "$jobs" -lt 100 || "$dependencies" -lt 1 || "$unclassified" != 0 || "$invalid_order" != 0 || "$cycles" != 0 ]]; then
  echo "[development-pipeline] FAIL phases=$phases jobs=$jobs dependencies=$dependencies unclassified=$unclassified invalid-order=$invalid_order cycles=$cycles" >&2
  exit 1
fi
echo "[development-pipeline] PASS phases=$phases jobs=$jobs dependencies=$dependencies unclassified=0 cycles=0"
