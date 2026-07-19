#!/usr/bin/env bash
set -euo pipefail

NS="${NAMESPACE:-carbonet-prod}"; DB="${DATABASE:-carbonet}"; DB_USER="${DB_USER:-postgres}"; BASE_URL="${BASE_URL:-http://127.0.0.1}"
leader=""
while read -r pod; do
  [[ "$(kubectl -n "$NS" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U "$DB_USER" -d "$DB" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NS" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || { echo "PostgreSQL leader not found" >&2; exit 1; }
q(){ kubectl -n "$NS" exec "$leader" -c patroni -- psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$DB_USER" -d "$DB" -Atqc "$1"; }

tables="$(q "select count(*) from information_schema.tables where table_schema='public' and table_name in ('emission_regulatory_submission','emission_regulatory_submission_event')")"
steps="$(q "select count(*) from framework_process_step where process_code='REGULATORY_SUBMISSION' and user_path='/emission/report-submission' and admin_path='/admin/emission/regulatory-submissions' and automation_status='GENERATED'")"
contracts="$(q "select count(*) from framework_professional_screen_contract where process_code='REGULATORY_SUBMISSION' and menu_verified and api_verified and database_verified")"
menus="$(q "select count(*) from comtnmenuinfo where menu_code in ('H1020404','A1030403') and use_at='Y' and expsr_at='Y' and menu_url in ('/emission/report-submission','/admin/emission/regulatory-submissions')")"
tasks="$(q "select count(*) from emission_project_task where task_code='REGULATORY_SUBMISSION' and process_code='REGULATORY_SUBMISSION' and target_url like '/emission/report-submission%'")"
bad_state="$(q "select count(*) from emission_regulatory_submission where status not in ('DRAFT','PACKAGED','SUBMITTED','RECEIVED','CORRECTION_REQUIRED','RESUBMITTED','ACCEPTED','CANCELLED')")"

user_http="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/emission/report-submission")"
admin_http="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/admin/emission/regulatory-submissions")"
health="$(curl -fsS "$BASE_URL/actuator/health")"
printf 'regulatory submission: tables=%s steps=%s contracts=%s menus=%s projectTasks=%s badState=%s userHttp=%s adminHttp=%s health=%s\n' "$tables" "$steps" "$contracts" "$menus" "$tasks" "$bad_state" "$user_http" "$admin_http" "$health"

[[ "$tables" == "2" ]]
[[ "$steps" == "4" ]]
[[ "$contracts" == "8" ]]
[[ "$menus" == "2" ]]
[[ "$tasks" -ge "1" ]]
[[ "$bad_state" == "0" ]]
[[ "$user_http" != "404" && "$user_http" != "500" ]]
[[ "$admin_http" != "404" && "$admin_http" != "500" ]]
grep -q '"status":"UP"' <<<"$health"
