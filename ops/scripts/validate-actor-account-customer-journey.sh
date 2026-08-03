#!/usr/bin/env bash
set -euo pipefail

NS="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DB="${POSTGRES_DB:-carbonet}"
DB_USER="${POSTGRES_ADMIN_USER:-postgres}"
BASE="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
PROJECT="${CARBONET_ACTOR_TEST_PROJECT:-PRJ-2026-001}"
PASSWORD="${CARBONET_ACTOR_TEST_PASSWORD:-}"
ROOT="${CARBONET_DEPLOY_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
POSTGRES_ADAPTER="$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"

[[ -f "$POSTGRES_ADAPTER" ]] || {
  echo '[actor-account-journey] FAIL PostgreSQL query adapter missing' >&2
  exit 1
}
# shellcheck source=ops/scripts/lib/carbonet-postgres-query.sh
source "$POSTGRES_ADAPTER"
CARBONET_PG_NAMESPACE="$NS"
POSTGRES_DB="$DB"
POSTGRES_ADMIN_USER="$DB_USER"
carbonet_postgres_query_init
q(){ carbonet_postgres_query "$1"; }

# Exercise the account in its authoritative company tenant. A legacy DEFAULT
# project can still be validated by administrator journeys, but must not stand
# in for a tenant-scoped customer account.
account_tenant="$(q "select btrim(instt_id) from comtnemplyrinfo where lower(emplyr_id)='qaowner26' limit 1")"
project_tenant="$(q "select tenant_id from emission_project_registry where project_id='$PROJECT'")"
if [[ -n "$account_tenant" && "$project_tenant" != "$account_tenant" ]]; then
  PROJECT="$(q "select p.project_id from emission_project_registry p where p.tenant_id='$account_tenant' and exists(select 1 from emission_project_task t where t.project_id=p.project_id group by t.project_id having count(*)=7) order by (p.project_id='PRJ-ACTOR-TEST') desc,p.project_id limit 1")"
fi
[[ -n "$PROJECT" ]] || { echo '[actor-account-journey] FAIL tenant-aligned actor project missing' >&2; exit 1; }

segregation="$(q "select count(*)=5 and count(distinct user_id)=5 and count(*) filter(where actor_code in ('CALCULATOR','VERIFIER','APPROVER'))=3 and count(distinct user_id) filter(where actor_code in ('CALCULATOR','VERIFIER','APPROVER'))=3 from framework_project_actor_assignment where project_id='$PROJECT' and active_yn='Y' and actor_code in ('COMPANY_MANAGER','SITE_DATA_OWNER','CALCULATOR','VERIFIER','APPROVER')")"
[[ "$segregation" == t ]] || { echo '[actor-account-journey] FAIL project actor segregation' >&2; exit 1; }

task_binding="$(q "select count(*)=7 and count(distinct assignee_id)=5 and bool_and(assignee_id=case task_code when 'BASIC_INFO' then 'qaowner26' when 'ACTIVITY_DATA' then 'qadata26' when 'CALCULATION' then 'qacalc26' when 'VERIFICATION' then 'qaverify26' when 'APPROVAL' then 'qaapprove26' when 'REPORT' then 'qaowner26' when 'REGULATORY_SUBMISSION' then 'qaowner26' end) from emission_project_task where project_id='$PROJECT'")"
[[ "$task_binding" == t ]] || { echo '[actor-account-journey] FAIL task-account binding' >&2; exit 1; }

account_contract="$(q "select count(*)=5 from (
  select distinct assignment.account_id,assignment.actor_code
  from framework_account_actor_assignment assignment
  join (values
    ('qaowner26','COMPANY_MANAGER'),
    ('qadata26','SITE_DATA_OWNER'),
    ('qacalc26','CALCULATOR'),
    ('qaverify26','VERIFIER'),
    ('qaapprove26','APPROVER')
  ) expected(account_id,actor_code)
    on expected.account_id=assignment.account_id and expected.actor_code=assignment.actor_code
  where assignment.project_id='$PROJECT' and assignment.assignment_status='ACTIVE'
) required_pairs")"
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
  if [[ "$account" == "qaowner26" ]]; then
    draft_get="$tmp/draft-get.json"; draft_save="$tmp/draft-save.json"; draft_reload="$tmp/draft-reload.json"
    draft_query="tenantId=$account_tenant&projectId=$PROJECT&processCode=EMISSION_PROJECT&stepCode=EMISSION_PROJECT_SETUP"
    code="$(curl -sS -b "$cookie" -o "$draft_get" -w '%{http_code}' "$BASE/home/api/process-executions/draft?$draft_query")"
    [[ "$code" == 200 ]] || { echo "[actor-account-journey] FAIL draft load account=$account status=$code body=$(tr -d '\n' < "$draft_get" | head -c 300)" >&2; exit 1; }
    expected_version="$(jq -er '.draft.draftVersion // 0' "$draft_get")"
    draft_marker="actor-journey-$(date +%s%N)"
    draft_payload="$(jq -cn \
      --arg project "$PROJECT" \
      --arg tenant "$account_tenant" \
      --arg marker "$draft_marker" \
      --argjson version "$expected_version" \
      '{tenantId:$tenant,projectId:$project,processCode:"EMISSION_PROJECT",stepCode:"EMISSION_PROJECT_SETUP",actorCode:"COMPANY_MANAGER",payloadJson:({tenantId:$tenant,companyId:$marker}|tojson),evidenceJson:"{}",expectedVersion:$version}')"
    code="$(curl -sS -b "$cookie" -o "$draft_save" -w '%{http_code}' -H 'Content-Type: application/json' -X PUT --data "$draft_payload" "$BASE/home/api/process-executions/draft")"
    [[ "$code" == 200 ]] || { echo "[actor-account-journey] FAIL draft save account=$account status=$code" >&2; exit 1; }
    code="$(curl -sS -b "$cookie" -o "$draft_reload" -w '%{http_code}' "$BASE/home/api/process-executions/draft?$draft_query")"
    [[ "$code" == 200 ]] || { echo "[actor-account-journey] FAIL draft reload account=$account status=$code" >&2; exit 1; }
    jq -e --arg marker "$draft_marker" '
      .success == true
      and .found == true
      and .draft.draftStatus == "DRAFT"
      and ((.draft.payloadJson | fromjson).companyId == $marker)
      and (.draft.draftVersion > 0)
    ' "$draft_reload" >/dev/null || { echo "[actor-account-journey] FAIL draft round-trip account=$account" >&2; exit 1; }
  fi
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
if any(not row.get("targetUrl") for row in assigned):
    sys.exit(f"actual task target missing account={os.environ['ACCOUNT']}")
if any(not row.get("targetUrl") for row in flow):
    sys.exit(f"workflow target missing account={os.environ['ACCOUNT']}")
if any(row.get("actionable") is True and row.get("actorActionable") is not True for row in flow):
    sys.exit(f"actor access mismatch account={os.environ['ACCOUNT']}")
if any(row.get("actionable") is True and row.get("pendingPredecessors") for row in flow):
    sys.exit(f"predecessor bypass account={os.environ['ACCOUNT']}")
if any(flow[index].get("nextTaskName")!=flow[index+1].get("name") for index in range(6)):
    sys.exit(f"workflow next-task mismatch account={os.environ['ACCOUNT']}")
regulatory=next((row for row in flow if row.get("taskCode")=="REGULATORY_SUBMISSION"),None)
if not regulatory or regulatory.get("actorCode")!="COMPANY_MANAGER":
    sys.exit(f"regulatory actor contract missing account={os.environ['ACCOUNT']}")
PY
  while IFS= read -r target; do
    [[ -n "$target" ]] || continue
    page_code="$(curl -sS -b "$cookie" -o /dev/null -w '%{http_code}' "$BASE$target")"
    [[ "$page_code" == 200 ]] || { echo "[actor-account-journey] FAIL task page account=$account target=$target status=$page_code" >&2; exit 1; }
  done < <(PROJECT="$PROJECT" BODY="$body" python3 - <<'PY'
import json,os
payload=json.load(open(os.environ["BODY"],encoding="utf-8"))
targets={row.get("targetUrl","") for row in payload.get("items",[]) if row.get("projectId")==os.environ["PROJECT"]}
print("\n".join(sorted(target for target in targets if target)))
PY
  )
done

# Project and data scope are server-authoritative. A scoped account can open its
# assigned project, cannot discover unrelated projects in the list, and direct
# URL access must fail closed with an auditable 403.
allowed_code="$(curl -sS -b "$tmp/qadata26.cookie" -o "$tmp/scope-allowed.json" -w '%{http_code}' "$BASE/home/api/emission-projects/$PROJECT")"
[[ "$allowed_code" == 200 ]] || { echo "[actor-account-journey] FAIL assigned project scope status=$allowed_code" >&2; exit 1; }
denied_project="$(q "select project_id from emission_project_registry where tenant_id='DEFAULT' and project_id<>'$PROJECT' and not exists(select 1 from framework_account_actor_assignment a where lower(a.account_id)='qadata26' and a.tenant_id='DEFAULT' and a.assignment_status='ACTIVE' and a.project_id in ('*',emission_project_registry.project_id) and (a.data_scope='*' or emission_project_registry.project_id=any(string_to_array(replace(a.data_scope,' ',''),',')))) order by project_id limit 1")"
[[ -n "$denied_project" ]] || { echo '[actor-account-journey] FAIL cross-project denial fixture missing' >&2; exit 1; }
denied_scope_code="$(curl -sS -b "$tmp/qadata26.cookie" -o "$tmp/scope-denied.json" -w '%{http_code}' "$BASE/home/api/emission-projects/$denied_project")"
[[ "$denied_scope_code" == 403 ]] || { echo "[actor-account-journey] FAIL cross-project scope status=$denied_scope_code project=$denied_project" >&2; exit 1; }
visible_scope="$(curl -sS -b "$tmp/qadata26.cookie" "$BASE/home/api/emission-projects?size=100")"
VISIBLE_SCOPE="$visible_scope" DENIED_PROJECT="$denied_project" python3 - <<'PY'
import json,os,sys
payload=json.loads(os.environ["VISIBLE_SCOPE"])
if any(row.get("id")==os.environ["DENIED_PROJECT"] for row in payload.get("items",[])):
    sys.exit("cross-project item leaked through list API")
PY
audit_count="$(q "select count(*) from framework_scope_access_audit where lower(account_id)='qadata26' and tenant_id='DEFAULT' and project_id='$denied_project' and decision_code='DENIED' and created_at>current_timestamp-interval '5 minutes'")"
[[ "${audit_count:-0}" -gt 0 ]] || { echo '[actor-account-journey] FAIL scope denial audit missing' >&2; exit 1; }

submission_id="$(q "select coalesce((select regulatory_submission_id from emission_regulatory_submission where project_id='$PROJECT' order by regulatory_submission_id desc limit 1),0)")"

# A calculator must never be able to perform the verifier-only acceptance action.
wrong_actor_code="$(curl -sS -b "$tmp/qacalc26.cookie" -o "$tmp/deny.json" -w '%{http_code}' -H 'Content-Type: application/json' -X POST "$BASE/home/api/emission-projects/$PROJECT/regulatory-submissions/$submission_id/transition" --data '{"action":"ACCEPT"}')"
[[ "$wrong_actor_code" == 403 ]] || { echo "[actor-account-journey] FAIL segregation status=$wrong_actor_code" >&2; exit 1; }

anonymous_code="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/home/api/emission-projects/$PROJECT/regulatory-submissions")"
[[ "$anonymous_code" == 401 || "$anonymous_code" == 403 ]] || { echo "[actor-account-journey] FAIL anonymous protection status=$anonymous_code" >&2; exit 1; }

q "update framework_customer_journey_validation_run set evidence_json=(coalesce(nullif(evidence_json,''),'{}')::jsonb || jsonb_build_object('actorAccounts',5,'actorRoles',5,'segregation','VERIFIED','projectScope','VERIFIED','listIsolation','VERIFIED','scopeDenialAudit','VERIFIED','fullWorkflow','7/7','workflowOrder','VERIFIED','nextTaskLinks','VERIFIED','unauthorizedStatus',403,'anonymousStatus',$anonymous_code))::text where validation_id=(select max(validation_id) from framework_customer_journey_validation_run where project_id='$PROJECT')" >/dev/null
echo "[actor-account-journey] PASS project=$PROJECT accounts=5 roles=5 tasks=7 workflow=7/7 order=verified links=verified scopes=verified segregation=verified unauthorized=403 anonymous=$anonymous_code"
