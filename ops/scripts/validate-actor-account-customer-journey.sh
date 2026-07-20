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
  ACCOUNT="$account" PROJECT="$PROJECT" BODY="$body" python3 - <<'PY'
import json,os,sys
payload=json.load(open(os.environ["BODY"],encoding="utf-8"))
flow=[row for row in payload.get("workflows",[]) if row.get("projectId")==os.environ["PROJECT"]]
assigned=[row for row in payload.get("items",[]) if row.get("projectId")==os.environ["PROJECT"]]
expected={
    "qaowner26":{"BASIC_INFO","REPORT","REGULATORY_SUBMISSION"},
    "qadata26":{"ACTIVITY_DATA"},
    "qacalc26":{"CALCULATION"},
    "qaverify26":{"VERIFICATION"},
    "qaapprove26":{"APPROVAL"},
}[os.environ["ACCOUNT"]]
actors=set(payload.get("accountActors",[]))
expected_actor={
    "qaowner26":"COMPANY_MANAGER","qadata26":"SITE_DATA_OWNER","qacalc26":"CALCULATOR",
    "qaverify26":"VERIFIER","qaapprove26":"APPROVER",
}[os.environ["ACCOUNT"]]
if "MEMBER_USER" not in actors or expected_actor not in actors:
    sys.exit(f"effective actor mismatch account={os.environ['ACCOUNT']} actors={sorted(actors)}")
steps=payload.get("processCatalogSteps",[])
step_actors={}
for step in steps:
    step_actors.setdefault(step.get("processCode"),set()).add(step.get("actorCode"))
if any(not (step_actors.get(process.get("processCode"),set()) & actors) for process in payload.get("processCatalog",[])):
    sys.exit(f"unauthorized process exposed account={os.environ['ACCOUNT']}")
domain_counts={}
for process in payload.get("processCatalog",[]):
    code=str(process.get("domainCode","")).upper()
    domain_counts[code]=domain_counts.get(code,0)+1
for work_type in payload.get("workTypes",[]):
    code=str(work_type.get("workTypeCode","")).upper()
    if int(work_type.get("definedProcessCount",0))!=domain_counts.get(code,0):
        sys.exit(f"work type count mismatch account={os.environ['ACCOUNT']} type={code}")
if len(flow)!=7 or [int(row.get("stepOrder",0)) for row in flow]!=list(range(1,8)):
    sys.exit(f"full workflow invalid account={os.environ['ACCOUNT']} steps={len(flow)}")
if {row.get("taskCode") for row in assigned} != expected:
    sys.exit(f"actual task assignment mismatch account={os.environ['ACCOUNT']}")
if any(str(row.get("assignee","")).lower()!=os.environ["ACCOUNT"].lower() for row in assigned):
    sys.exit(f"actual task assignee mismatch account={os.environ['ACCOUNT']}")
if any(not row.get("targetUrl") for row in flow):
    sys.exit(f"workflow target missing account={os.environ['ACCOUNT']}")
if any(row.get("actionable") is True and row.get("actorActionable") is not True for row in flow):
    sys.exit(f"actor access mismatch account={os.environ['ACCOUNT']}")
if any(row.get("actionable") is True and row.get("pendingPredecessors") for row in flow):
    sys.exit(f"predecessor bypass account={os.environ['ACCOUNT']}")
if any(flow[index].get("nextTaskName")!=flow[index+1].get("name") for index in range(6)):
    sys.exit(f"workflow next-task mismatch account={os.environ['ACCOUNT']}")
regulatory=next((row for row in flow if row.get("taskCode")=="REGULATORY_SUBMISSION"),None)
if not regulatory or regulatory.get("completionSatisfied") is not True:
    sys.exit(f"regulatory completion evidence missing account={os.environ['ACCOUNT']}")
PY
  while IFS= read -r target; do
    [[ -n "$target" ]] || continue
    page_code="$(curl -sS -b "$cookie" -o /dev/null -w '%{http_code}' "$BASE$target")"
    [[ "$page_code" == 200 ]] || { echo "[actor-account-journey] FAIL task page account=$account target=$target status=$page_code" >&2; exit 1; }
  done < <(PROJECT="$PROJECT" BODY="$body" python3 - <<'PY'
import json,os
payload=json.load(open(os.environ["BODY"],encoding="utf-8"))
targets={row.get("targetUrl","") for row in payload.get("workflows",[]) if row.get("projectId")==os.environ["PROJECT"]}
print("\n".join(sorted(target for target in targets if target)))
PY
  )
done

submission_id="$(q "select regulatory_submission_id from emission_regulatory_submission where project_id='$PROJECT' and status='ACCEPTED' order by regulatory_submission_id desc limit 1")"
[[ -n "$submission_id" ]] || { echo '[actor-account-journey] FAIL accepted regulatory fixture missing' >&2; exit 1; }

# A calculator must never be able to perform the verifier-only acceptance action.
wrong_actor_code="$(curl -sS -b "$tmp/qacalc26.cookie" -o "$tmp/deny.json" -w '%{http_code}' -H 'Content-Type: application/json' -X POST "$BASE/home/api/emission-projects/$PROJECT/regulatory-submissions/$submission_id/transition" --data '{"action":"ACCEPT"}')"
[[ "$wrong_actor_code" == 403 ]] || { echo "[actor-account-journey] FAIL segregation status=$wrong_actor_code" >&2; exit 1; }

anonymous_code="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/home/api/emission-projects/$PROJECT/regulatory-submissions")"
[[ "$anonymous_code" == 401 || "$anonymous_code" == 403 ]] || { echo "[actor-account-journey] FAIL anonymous protection status=$anonymous_code" >&2; exit 1; }

q "update framework_customer_journey_validation_run set evidence_json=(coalesce(nullif(evidence_json,''),'{}')::jsonb || jsonb_build_object('actorAccounts',5,'actorRoles',5,'segregation','VERIFIED','fullWorkflow','7/7','workflowOrder','VERIFIED','nextTaskLinks','VERIFIED','unauthorizedStatus',403,'anonymousStatus',$anonymous_code))::text where validation_id=(select max(validation_id) from framework_customer_journey_validation_run where project_id='$PROJECT')" >/dev/null
echo "[actor-account-journey] PASS project=$PROJECT accounts=5 roles=5 tasks=7 workflow=7/7 order=verified links=verified segregation=verified unauthorized=403 anonymous=$anonymous_code"
