#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:?repository root is required}"
PROCESS="${2:?process code is required}"
STEP="${3:?step code is required}"
JOB_TYPE="${4:?job type is required}"
[[ "$PROCESS" == "EMISSION_PROJECT" ]] || exit 3

case "$STEP" in
  EMISSION_PROJECT_SETUP)
    relations=(emission_project_registry emission_project_member emission_project_task emission_project_history)
    evidence=(V20260713130000__create_emission_project_registry.sql V20260713134000__expand_emission_project_creation.sql V20260717197000__harden_emission_project_creation_workflow.sql)
    ;;
  EMISSION_PROJECT_CALCULATE)
    relations=(emission_factor_reference emission_activity_data emission_calculation_run emission_calculation_item)
    evidence=(V20260713136000__create_emission_activity_workflow.sql V20260713137000__create_emission_calculation_workflow.sql)
    ;;
  EMISSION_PROJECT_VALIDATE)
    relations=(emission_activity_quality_run emission_activity_quality_issue emission_activity_submission emission_activity_submission_evidence)
    evidence=(V20260714012000__create_emission_activity_quality_check.sql V20260714010000__create_emission_activity_submission.sql)
    ;;
  EMISSION_PROJECT_CORRECT)
    relations=(emission_activity_quality_issue emission_activity_data emission_activity_submission_event emission_activity_submission_item)
    evidence=(V20260714012000__create_emission_activity_quality_check.sql V20260717197100__seal_activity_data_submission_evidence.sql)
    ;;
  EMISSION_PROJECT_REPORT)
    relations=(emission_project_report emission_report_certificate_audit emission_report_access_ledger emission_calculation_run)
    evidence=(V20260714017000__create_emission_project_report_workflow.sql V20260714019000__govern_report_certificate_lifecycle.sql V20260714020000__create_report_access_ledger.sql)
    ;;
  EMISSION_PROJECT_APPROVE)
    [[ "$JOB_TYPE" == "DATABASE_QUALITY" ]] || exit 3
    relations=(emission_submission_review emission_activity_submission emission_calculation_run emission_project_report)
    evidence=(V20260714015000__implement_emission_review_approval_workflow.sql V20260717224400__reconcile_emission_project_design_contracts.sql)
    ;;
  *) exit 3 ;;
esac

migration_root="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql"
for file in "${evidence[@]}"; do [[ -s "$migration_root/$file" ]] || { echo "missing migration evidence: $file" >&2; exit 1; }; done

namespace="${K8S_NAMESPACE:-carbonet-prod}"
db="${PGDATABASE:-carbonet}"
user="${PGUSER:-postgres}"
leader=""
while IFS= read -r pod; do
  [[ "$(kubectl -n "$namespace" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U "$user" -d "$db" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]] && { leader="$pod"; break; }
done < <(kubectl -n "$namespace" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || { echo "writable PostgreSQL leader not found" >&2; exit 1; }

relation_csv="$(printf "'%s'," "${relations[@]}")"; relation_csv="${relation_csv%,}"
result="$(kubectl -n "$namespace" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U "$user" -d "$db" -F '|' -Atqc "
with required(name) as (values $(printf "('%s')," "${relations[@]}" | sed 's/,$//'))
select count(*) filter(where to_regclass(name) is not null),count(*) from required;
select count(*) from pg_constraint where contype='f' and not convalidated and conrelid::regclass::text like 'emission_%';
select count(*) from carbonet_flyway_schema_history where success=false;
select count(*) from pg_indexes where schemaname=current_schema() and tablename in (${relation_csv});
" 2>/dev/null)"
mapfile -t checks <<<"$result"
[[ "${checks[0]}" == "${#relations[@]}|${#relations[@]}" ]] || { echo "required relation coverage failed: ${checks[0]}" >&2; exit 1; }
[[ "${checks[1]}" == "0" ]] || { echo "unvalidated emission foreign keys: ${checks[1]}" >&2; exit 1; }
[[ "${checks[2]}" == "0" ]] || { echo "failed Flyway migrations: ${checks[2]}" >&2; exit 1; }
[[ "${checks[3]}" -ge "${#relations[@]}" ]] || { echo "index coverage insufficient: ${checks[3]}/${#relations[@]}" >&2; exit 1; }

printf '{"handled":true,"strategy":"EXACT_DATABASE_ADOPTION","process":"%s","step":"%s","jobType":"%s","relations":%s,"migrationCount":%s,"indexCount":%s,"failedFlyway":0,"unvalidatedForeignKeys":0}\n' \
  "$PROCESS" "$STEP" "$JOB_TYPE" "$(printf '%s\n' "${relations[@]}" | jq -R . | jq -s -c .)" "${#evidence[@]}" "${checks[3]}"
