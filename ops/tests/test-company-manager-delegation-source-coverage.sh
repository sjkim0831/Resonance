#!/usr/bin/env bash
set -Eeuo pipefail

root="${RESONANCE_ROOT:-/opt/Resonance/runtime/platform-data/dev-worktrees/certificate-verification}"
env_file="${CARBONET_RUNTIME_ENV_FILE:-/opt/Resonance/runtime/platform-data/dev-runtime/certificate-verification/backend/runtime.env}"
service="$root/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/service/EmissionProjectRegistryService.java"
tmp="$(mktemp -d)"
trap 'rm -rf -- "$tmp"' EXIT

if [[ -n "${RESONANCE_POSTGRES_LEADER_POD:-}" ]]; then
  db_psql() {
    kubectl -n "${CARBONET_K8S_NAMESPACE:-carbonet-prod}" exec -i "$RESONANCE_POSTGRES_LEADER_POD" -c patroni -- \
      psql -h 127.0.0.1 -U "${POSTGRES_ADMIN_USER:-postgres}" -d "${POSTGRES_DB:-carbonet}" -X "$@"
  }
else
  db_user="$(sudo -n sed -n 's/^DB_USERNAME=//p' "$env_file" | sed -n '1p')"
  export PGPASSWORD="$(sudo -n sed -n 's/^DB_PASSWORD=//p' "$env_file" | sed -n '1p')"
  db_psql() { psql -h 127.0.0.1 -p 35432 -U "$db_user" -d carbonet_dev -X "$@"; }
fi

db_psql -Atq <<'SQL' | sort >"$tmp/actual"
WITH columns AS (
  SELECT table_schema,table_name,array_agg(column_name) AS names
  FROM information_schema.columns
  WHERE table_schema='public'
  GROUP BY table_schema,table_name
)
SELECT table_name
FROM columns
WHERE names @> ARRAY['project_id']::information_schema.sql_identifier[]
  AND names && ARRAY['assignee_id','account_id','user_id']::information_schema.sql_identifier[]
  AND (
    names && ARRAY['task_status','request_status','draft_status','assignment_status','contract_status','active_yn']::information_schema.sql_identifier[]
    OR table_name LIKE 'framework_project_%assignment'
  )
ORDER BY table_name;
SQL

cat >"$tmp/expected" <<'EOF'
emission_activity_request
emission_project_activity_request
emission_project_task
framework_account_actor_assignment
framework_identity_actor_assignment_link
framework_process_work_draft
framework_project_actor_assignment
framework_project_process_step_assignment
framework_project_screen_execution_contract
EOF

if ! diff -u "$tmp/expected" "$tmp/actual"; then
  echo 'DELEGATION_ASSIGNMENT_SOURCE_CLASSIFICATION_REQUIRED' >&2
  exit 1
fi

for token in PROJECT_TASK ACTIVITY_REQUEST WORK_DRAFT; do
  grep -q "'$token' AS" "$service" || {
    echo "DELEGATION_INCLUDED_SOURCE_MISSING:$token" >&2
    exit 1
  }
done
for table in emission_project_activity_request framework_account_actor_assignment framework_identity_actor_assignment_link framework_project_actor_assignment framework_project_process_step_assignment framework_project_screen_execution_contract; do
  grep -q "$table" "$service" || {
    echo "DELEGATION_EXCLUDED_SOURCE_REASON_MISSING:$table" >&2
    exit 1
  }
done

counts="$(db_psql -Atq -F '|' -c "SELECT (SELECT count(*) FROM emission_project_task WHERE task_status<>'DONE'),(SELECT count(*) FROM emission_activity_request WHERE request_status NOT IN ('CLOSED','CANCELLED','COMPLETED')),(SELECT count(*) FROM framework_process_work_draft WHERE draft_status='DRAFT');")"
IFS='|' read -r project_tasks activity_requests work_drafts <<<"$counts"
printf '{"status":"PASS","candidateSourceCount":9,"includedSourceCount":3,"excludedDerivedOrMappingSourceCount":6,"activeRows":{"projectTasks":%s,"activityRequests":%s,"workDrafts":%s}}\n' "$project_tasks" "$activity_requests" "$work_drafts"
