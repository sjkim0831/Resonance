#!/usr/bin/env bash
set -euo pipefail

NS="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DB="${POSTGRES_DB:-carbonet}"
DB_USER="${POSTGRES_ADMIN_USER:-postgres}"
BASE="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
PROJECT="${CARBONET_ACTOR_TEST_PROJECT:-PRJ-2026-001}"
PASSWORD="${CARBONET_ACTOR_TEST_PASSWORD:-}"

leader=""
while read -r pod; do
  [[ "$(kubectl -n "$NS" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U "$DB_USER" -d "$DB" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]] && { leader="$pod"; break; }
done < <(kubectl -n "$NS" get pods -l app=postgres-patroni -o name | sed 's#pod/##')
[[ -n "$leader" ]] || { echo '[actor-account-journey] FAIL PostgreSQL leader missing' >&2; exit 1; }
q(){ kubectl -n "$NS" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U "$DB_USER" -d "$DB" -Atqc "$1"; }

segregation="$(q "select count(*)=5 and count(distinct user_id)=5 and count(*) filter(where actor_code in ('CALCULATOR','VERIFIER','APPROVER'))=3 and count(distinct user_id) filter(where actor_code in ('CALCULATOR','VERIFIER','APPROVER'))=3 from framework_project_actor_assignment where project_id='$PROJECT' and active_yn='Y' and actor_code in ('COMPANY_MANAGER','SITE_DATA_OWNER','CALCULATOR','VERIFIER','APPROVER')")"
[[ "$segregation" == t ]] || { echo '[actor-account-journey] FAIL project actor segregation' >&2; exit 1; }

task_binding="$(q "select count(*)=7 and count(distinct assignee_id)=5 and bool_and(assignee_id=case task_code when 'BASIC_INFO' then 'qaowner26' when 'ACTIVITY_DATA' then 'qadata26' when 'CALCULATION' then 'qacalc26' when 'VERIFICATION' then 'qaverify26' when 'APPROVAL' then 'qaapprove26' when 'REPORT' then 'qaowner26' when 'REGULATORY_SUBMISSION' then 'qaowner26' end) from emission_project_task where project_id='$PROJECT'")"
[[ "$task_binding" == t ]] || { echo '[actor-account-journey] FAIL task-account binding' >&2; exit 1; }

account_contract="$(q "select count(*)=5 and count(distinct actor_code)=5 from framework_account_actor_assignment where project_id='$PROJECT' and assignment_status='ACTIVE' and account_id in ('qaowner26','qadata26','qacalc26','qaverify26','qaapprove26')")"
[[ "$account_contract" == t ]] || { echo '[actor-account-journey] FAIL account actor contract' >&2; exit 1; }

if [[ -z "$PASSWORD" ]]; then
  echo '[actor-account-journey] FAIL CARBONET_ACTOR_TEST_PASSWORD is not configured' >&2
  exit 1
fi

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
accounts=(qaowner26 qadata26 qacalc26 qaverify26 qaapprove26)
for account in "${accounts[@]}"; do
  cookie="$tmp/$account.cookie"; body="$tmp/$account.json"
  code="$(curl -sS -c "$cookie" -o "$body" -w '%{http_code}' -H 'Content-Type: application/json' -X POST "$BASE/signin/actionLogin" --data "{\"userId\":\"$account\",\"userPw\":\"$PASSWORD\",\"userSe\":\"USR\"}")"
  [[ "$code" == 200 ]] || { echo "[actor-account-journey] FAIL login account=$account status=$code" >&2; exit 1; }
  code="$(curl -sS -b "$cookie" -o "$body" -w '%{http_code}' "$BASE/home/api/emission-tasks")"
  [[ "$code" == 200 ]] || { echo "[actor-account-journey] FAIL task queue account=$account status=$code" >&2; exit 1; }
  grep -Eq '^\s*[\{\[]' "$body" || { echo "[actor-account-journey] FAIL invalid task payload account=$account" >&2; exit 1; }
done

submission_id="$(q "select regulatory_submission_id from emission_regulatory_submission where project_id='$PROJECT' and status='ACCEPTED' order by regulatory_submission_id desc limit 1")"
[[ -n "$submission_id" ]] || { echo '[actor-account-journey] FAIL accepted regulatory fixture missing' >&2; exit 1; }

# A calculator must never be able to perform the verifier-only acceptance action.
wrong_actor_code="$(curl -sS -b "$tmp/qacalc26.cookie" -o "$tmp/deny.json" -w '%{http_code}' -H 'Content-Type: application/json' -X POST "$BASE/home/api/emission-projects/$PROJECT/regulatory-submissions/$submission_id/transition" --data '{"action":"ACCEPT"}')"
[[ "$wrong_actor_code" == 403 ]] || { echo "[actor-account-journey] FAIL segregation status=$wrong_actor_code" >&2; exit 1; }

anonymous_code="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/home/api/emission-projects/$PROJECT/regulatory-submissions")"
[[ "$anonymous_code" == 401 || "$anonymous_code" == 403 ]] || { echo "[actor-account-journey] FAIL anonymous protection status=$anonymous_code" >&2; exit 1; }

q "update framework_customer_journey_validation_run set evidence_json=(coalesce(nullif(evidence_json,''),'{}')::jsonb || jsonb_build_object('actorAccounts',5,'actorRoles',5,'segregation','VERIFIED','unauthorizedStatus',403,'anonymousStatus',$anonymous_code))::text where validation_id=(select max(validation_id) from framework_customer_journey_validation_run where project_id='$PROJECT')" >/dev/null
echo "[actor-account-journey] PASS project=$PROJECT accounts=5 roles=5 tasks=7 segregation=verified unauthorized=403 anonymous=$anonymous_code"
