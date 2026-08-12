#!/usr/bin/env bash
set -euo pipefail
umask 077

NS="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DB="${POSTGRES_DB:-carbonet}"
DB_USER="${POSTGRES_ADMIN_USER:-postgres}"
BASE="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
PROJECT="${CARBONET_ACTOR_TEST_PROJECT:-PRJ-2026-001}"
PASSWORD="${CARBONET_ACTOR_TEST_PASSWORD:-}"
ROOT="${CARBONET_DEPLOY_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SOURCE_COMMIT="${CARBONET_POSTDEPLOY_SOURCE_COMMIT:-$(git -C "$ROOT" rev-parse HEAD)}"
EVIDENCE_MODE="${CARBONET_POSTDEPLOY_EVIDENCE_MODE:-legacy}"
TOKEN_STALE_AFTER_SECONDS="${CARBONET_ACTOR_TOKEN_STALE_AFTER_SECONDS:-900}"
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

tmp="$(mktemp -d)"
chmod 700 "$tmp"
accounts=(qaowner26 qadata26 qacalc26 qaverify26 qaapprove26)
draft_snapshot_hex=""
draft_marker=""
owned_draft_version=""
auth_token_after=""

logout_actor_sessions() {
  local account logout_status token_after result=0
  for account in "${accounts[@]}"; do
    if [[ -f "$tmp/$account.active" ]]; then
      logout_status="$(curl -sS -b "$tmp/$account.cookie" -o "$tmp/$account.logout.json" -w '%{http_code}' -X POST "$BASE/signin/actionLogout")"
      if [[ "$logout_status" == 200 ]] && jq -e '(.status // "") == "success"' "$tmp/$account.logout.json" >/dev/null 2>&1; then
        rm -f "$tmp/$account.active"
      else
        result=1
      fi
    fi
  done
  token_after="$(q "select count(*) from COMTNAUTHTOKENSTORE where lower(user_id) in ('qaowner26','qadata26','qacalc26','qaverify26','qaapprove26')")" || result=1
  [[ "$token_after" == 0 ]] || result=1
  auth_token_after="$token_after"
  return "$result"
}

snapshot_draft() {
  q "select encode(convert_to(coalesce((select to_jsonb(d)::text from framework_process_work_draft d where tenant_id='$account_tenant' and project_id='$PROJECT' and process_code='EMISSION_PROJECT' and step_code='EMISSION_PROJECT_SETUP' and lower(account_id)='qaowner26'),'null'),'UTF8'),'hex')"
}

restore_owned_draft() {
  local restored current_snapshot
  [[ -n "$draft_marker" && -n "$draft_snapshot_hex" ]] || return 0
  if [[ -z "$owned_draft_version" ]]; then
    owned_draft_version="$(q "select coalesce((select draft_version::text from framework_process_work_draft where tenant_id='$account_tenant' and project_id='$PROJECT' and process_code='EMISSION_PROJECT' and step_code='EMISSION_PROJECT_SETUP' and lower(account_id)='qaowner26' and payload_json->>'companyId'='$draft_marker'),'')")" || return 1
    if [[ -z "$owned_draft_version" ]]; then
      current_snapshot="$(snapshot_draft)" || return 1
      [[ "$current_snapshot" == "$draft_snapshot_hex" ]]
      return
    fi
  fi
  [[ "$owned_draft_version" =~ ^[1-9][0-9]*$ ]] || return 1
  if [[ "$draft_snapshot_hex" == "6e756c6c" ]]; then
    restored="$(q "with locked as (select draft_id from framework_process_work_draft where tenant_id='$account_tenant' and project_id='$PROJECT' and process_code='EMISSION_PROJECT' and step_code='EMISSION_PROJECT_SETUP' and lower(account_id)='qaowner26' for update), deleted as (delete from framework_process_work_draft d using locked l where d.draft_id=l.draft_id and d.draft_version=$owned_draft_version and d.payload_json->>'companyId'='$draft_marker' returning 1) select count(*) from deleted")" || return 1
  else
    restored="$(q "with snapshot as (select convert_from(decode('$draft_snapshot_hex','hex'),'UTF8')::jsonb j), locked as (select draft_id from framework_process_work_draft where tenant_id='$account_tenant' and project_id='$PROJECT' and process_code='EMISSION_PROJECT' and step_code='EMISSION_PROJECT_SETUP' and lower(account_id)='qaowner26' for update), restored as (update framework_process_work_draft d set actor_code=s.j->>'actor_code',payload_json=s.j->'payload_json',evidence_json=s.j->'evidence_json',draft_version=(s.j->>'draft_version')::integer,draft_status=s.j->>'draft_status',saved_at=(s.j->>'saved_at')::timestamp,submitted_at=nullif(s.j->>'submitted_at','')::timestamp,created_at=(s.j->>'created_at')::timestamp,updated_at=(s.j->>'updated_at')::timestamp from snapshot s,locked l where d.draft_id=l.draft_id and d.draft_id=(s.j->>'draft_id')::uuid and d.draft_version=$owned_draft_version and d.payload_json->>'companyId'='$draft_marker' returning 1) select count(*) from restored")" || return 1
  fi
  [[ "$restored" == 1 ]] || return 1
  current_snapshot="$(snapshot_draft)" || return 1
  [[ "$current_snapshot" == "$draft_snapshot_hex" ]]
}

cleanup() {
  local original_status=$? cleanup_status=0
  trap - EXIT INT TERM
  set +e
  logout_actor_sessions || cleanup_status=1
  restore_owned_draft || cleanup_status=1
  rm -rf "$tmp"
  if (( original_status == 0 && cleanup_status != 0 )); then original_status=1; fi
  exit "$original_status"
}
trap cleanup EXIT INT TERM

# Exercise the account in its authoritative company tenant. A legacy DEFAULT
# project can still be validated by administrator journeys, but must not stand
# in for a tenant-scoped customer account.
account_tenant="$(q "select btrim(instt_id) from comtnemplyrinfo where lower(emplyr_id)='qaowner26' limit 1")"
project_tenant="$(q "select tenant_id from emission_project_registry where project_id='$PROJECT'")"
if [[ -n "$account_tenant" && "$project_tenant" != "$account_tenant" ]]; then
  PROJECT="$(q "select p.project_id from emission_project_registry p where p.tenant_id='$account_tenant' and exists(select 1 from emission_project_task t where t.project_id=p.project_id and t.task_code in ('BASIC_INFO','ACTIVITY_DATA','CALCULATION','VERIFICATION','APPROVAL','REPORT','REGULATORY_SUBMISSION') group by t.project_id having count(distinct t.task_code)=7) order by (p.project_id='PRJ-ACTOR-TEST') desc,p.project_id limit 1")"
fi
[[ -n "$PROJECT" ]] || { echo '[actor-account-journey] FAIL tenant-aligned actor project missing' >&2; exit 1; }
[[ "$SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo '[actor-account-journey] FAIL source commit is invalid' >&2; exit 1; }
[[ "$TOKEN_STALE_AFTER_SECONDS" =~ ^[1-9][0-9]*$ ]] || { echo '[actor-account-journey] FAIL token stale threshold is invalid' >&2; exit 1; }

mutable_business_digest() {
  q "select encode(sha256(convert_to(concat_ws('|',
    coalesce((select jsonb_agg(to_jsonb(p) order by p.project_id)::text from emission_project_registry p where p.project_id='$PROJECT'),'[]'),
    coalesce((select jsonb_agg(to_jsonb(t) order by t.task_id)::text from emission_project_task t where t.project_id='$PROJECT'),'[]'),
    coalesce((select jsonb_agg(to_jsonb(r) order by r.regulatory_submission_id)::text from emission_regulatory_submission r where r.project_id='$PROJECT'),'[]'),
    coalesce((select jsonb_agg(to_jsonb(d) order by d.draft_id)::text from framework_process_work_draft d where d.project_id='$PROJECT'),'[]')
  ),'UTF8')),'hex')"
}
mutable_business_before="$(mutable_business_digest)"
[[ "$mutable_business_before" =~ ^[0-9a-f]{64}$ ]] || { echo '[actor-account-journey] FAIL mutable business pre-digest invalid' >&2; exit 1; }

segregation="$(q "select count(*)=5 and count(distinct user_id)=5 and count(*) filter(where actor_code in ('CALCULATOR','VERIFIER','APPROVER'))=3 and count(distinct user_id) filter(where actor_code in ('CALCULATOR','VERIFIER','APPROVER'))=3 from framework_project_actor_assignment where project_id='$PROJECT' and active_yn='Y' and actor_code in ('COMPANY_MANAGER','SITE_DATA_OWNER','CALCULATOR','VERIFIER','APPROVER')")"
[[ "$segregation" == t ]] || { echo '[actor-account-journey] FAIL project actor segregation' >&2; exit 1; }

task_binding="$(q "select count(*)=7 and count(distinct assignee_id)=5 and bool_and(assignee_id=case task_code when 'BASIC_INFO' then 'qaowner26' when 'ACTIVITY_DATA' then 'qadata26' when 'CALCULATION' then 'qacalc26' when 'VERIFICATION' then 'qaverify26' when 'APPROVAL' then 'qaapprove26' when 'REPORT' then 'qaowner26' when 'REGULATORY_SUBMISSION' then 'qaowner26' end) from emission_project_task where project_id='$PROJECT' and task_code in ('BASIC_INFO','ACTIVITY_DATA','CALCULATION','VERIFICATION','APPROVAL','REPORT','REGULATORY_SUBMISSION')")"
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

token_baseline="$(q "select count(*) from COMTNAUTHTOKENSTORE where lower(user_id) in ('qaowner26','qadata26','qacalc26','qaverify26','qaapprove26')")"
if [[ "$token_baseline" != 0 ]]; then
  recent_token_baseline="$(q "select count(*) from COMTNAUTHTOKENSTORE where lower(user_id) in ('qaowner26','qadata26','qacalc26','qaverify26','qaapprove26') and created_at >= clock_timestamp() - make_interval(secs => $TOKEN_STALE_AFTER_SECONDS)")"
  [[ "$recent_token_baseline" == 0 ]] || {
    echo "[actor-account-journey] BLOCKED active QA actor sessions baseline=$token_baseline recent=$recent_token_baseline" >&2
    exit 75
  }
  echo "[actor-account-journey] recovering stale dedicated QA sessions baseline=$token_baseline thresholdSeconds=$TOKEN_STALE_AFTER_SECONDS"
fi
if [[ -n "$PASSWORD" ]]; then
  printf '%s' "$PASSWORD" >"$tmp/actor-password"
else
  kubectl -n "$NS" get secret "${CARBONET_ACTOR_ACCOUNT_AUTH_SECRET:-carbonet-test-account-switch}" -o jsonpath='{.data.password}' 2>/dev/null | base64 -d >"$tmp/actor-password"
fi
PASSWORD=""
unset PASSWORD CARBONET_ACTOR_TEST_PASSWORD
[[ -s "$tmp/actor-password" ]] || { echo '[actor-account-journey] FAIL actor account password is unavailable' >&2; exit 1; }
draft_snapshot_hex="$(snapshot_draft)"
[[ "$draft_snapshot_hex" =~ ^[0-9a-f]+$ ]] || { echo '[actor-account-journey] FAIL draft snapshot is invalid' >&2; exit 1; }
for account in "${accounts[@]}"; do
  cookie="$tmp/$account.cookie"; body="$tmp/$account.json"; login_payload="$tmp/$account.login-payload.json"
  jq -n --arg user "$account" --rawfile password "$tmp/actor-password" '{userId:$user,userPw:$password,userSe:"USR"}' >"$login_payload"
  code="$(curl -sS -c "$cookie" -o "$body" -w '%{http_code}' -H 'Content-Type: application/json' -X POST "$BASE/signin/actionLogin" --data-binary "@$login_payload")"
  rm -f "$login_payload"
  [[ "$code" == 200 ]] && jq -e --arg user "$account" '.status=="loginSuccess" and (.userId|ascii_downcase)==($user|ascii_downcase)' "$body" >/dev/null \
    || { echo "[actor-account-journey] FAIL login account=$account status=$code" >&2; exit 1; }
  touch "$tmp/$account.active"
  code="$(curl -sS -b "$cookie" -o "$body" -w '%{http_code}' "$BASE/home/api/emission-tasks")"
  [[ "$code" == 200 ]] || { echo "[actor-account-journey] FAIL task queue account=$account status=$code" >&2; exit 1; }
  grep -Eq '^\s*[\{\[]' "$body" || { echo "[actor-account-journey] FAIL invalid task payload account=$account" >&2; exit 1; }
  if [[ "$account" == "qaowner26" ]]; then
    draft_get="$tmp/draft-get.json"; draft_save="$tmp/draft-save.json"; draft_reload="$tmp/draft-reload.json"
    draft_query="tenantId=$account_tenant&projectId=$PROJECT&processCode=EMISSION_PROJECT&stepCode=EMISSION_PROJECT_SETUP"
    code="$(curl -sS -b "$cookie" -o "$draft_get" -w '%{http_code}' "$BASE/home/api/process-executions/draft?$draft_query")"
    [[ "$code" == 200 ]] || { echo "[actor-account-journey] FAIL draft load account=$account status=$code body=$(tr -d '\n' < "$draft_get" | head -c 300)" >&2; exit 1; }
    if [[ "$EVIDENCE_MODE" != candidate ]]; then
      expected_version="$(jq -er '.draft.draftVersion // 0' "$draft_get")"
      draft_marker="actor-journey-${SOURCE_COMMIT:0:12}-$(date +%s%N)"
      draft_payload="$(jq -cn \
        --arg project "$PROJECT" \
        --arg tenant "$account_tenant" \
        --arg marker "$draft_marker" \
        --argjson version "$expected_version" \
        '{tenantId:$tenant,projectId:$project,processCode:"EMISSION_PROJECT",stepCode:"EMISSION_PROJECT_SETUP",actorCode:"COMPANY_MANAGER",payloadJson:({tenantId:$tenant,companyId:$marker}|tojson),evidenceJson:"{}",expectedVersion:$version}')"
      code="$(curl -sS -b "$cookie" -o "$draft_save" -w '%{http_code}' -H 'Content-Type: application/json' -X PUT --data "$draft_payload" "$BASE/home/api/process-executions/draft")"
      [[ "$code" == 200 ]] || { echo "[actor-account-journey] FAIL draft save account=$account status=$code" >&2; exit 1; }
      owned_draft_version="$(jq -er '.draft.draftVersion' "$draft_save")"
      [[ "$owned_draft_version" =~ ^[1-9][0-9]*$ ]] || { echo '[actor-account-journey] FAIL owned draft version missing' >&2; exit 1; }
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
core_codes={"BASIC_INFO","ACTIVITY_DATA","CALCULATION","VERIFICATION","APPROVAL","REPORT","REGULATORY_SUBMISSION"}
core_flow=[row for row in flow if row.get("taskCode") in core_codes]
if len(core_flow)!=7 or [int(row.get("stepOrder",0)) for row in core_flow]!=list(range(1,8)):
    sys.exit(f"full workflow invalid account={os.environ['ACCOUNT']} steps={len(core_flow)}")
core_assigned=[row for row in assigned if row.get("taskCode") in core_codes]
if {row.get("taskCode") for row in core_assigned} != expected:
    sys.exit(f"actual task assignment mismatch account={os.environ['ACCOUNT']}")
if any(str(row.get("assignee","")).lower()!=os.environ["ACCOUNT"].lower() for row in core_assigned):
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
denied_project="$(q "select project_id from emission_project_registry where tenant_id<> '$account_tenant' and project_id<>'$PROJECT' order by project_id limit 1")"
[[ -n "$denied_project" ]] || { echo '[actor-account-journey] FAIL cross-project denial fixture missing' >&2; exit 1; }
scope_audit_baseline="$(q "select coalesce(max(audit_id),0) from framework_scope_access_audit where lower(account_id)='qadata26' and tenant_id='$account_tenant' and project_id='$denied_project'")"
scope_audit_count_baseline="$(q "select count(*) from framework_scope_access_audit where lower(account_id)='qadata26' and tenant_id='$account_tenant' and project_id='$denied_project'")"
denied_scope_code="$(curl -sS -b "$tmp/qadata26.cookie" -o "$tmp/scope-denied.json" -w '%{http_code}' "$BASE/home/api/emission-projects/$denied_project")"
[[ "$denied_scope_code" == 403 ]] || { echo "[actor-account-journey] FAIL cross-project scope status=$denied_scope_code project=$denied_project" >&2; exit 1; }
visible_scope="$(curl -sS -b "$tmp/qadata26.cookie" "$BASE/home/api/emission-projects?size=100")"
VISIBLE_SCOPE="$visible_scope" DENIED_PROJECT="$denied_project" python3 - <<'PY'
import json,os,sys
payload=json.loads(os.environ["VISIBLE_SCOPE"])
if any(row.get("id")==os.environ["DENIED_PROJECT"] for row in payload.get("items",[])):
    sys.exit("cross-project item leaked through list API")
PY
scope_audit_count_after="$(q "select count(*) from framework_scope_access_audit where lower(account_id)='qadata26' and tenant_id='$account_tenant' and project_id='$denied_project'")"
[[ "$scope_audit_count_baseline" =~ ^[0-9]+$ && "$scope_audit_count_after" =~ ^[0-9]+$ ]] \
  && (( scope_audit_count_after - scope_audit_count_baseline == 1 )) \
  || { echo '[actor-account-journey] FAIL scope audit id delta is not exactly 1' >&2; exit 1; }
scope_audit_exact="$(q "select count(*)=1 and bool_and(schema_version=2 and decision_code='DENIED' and reason_code='PROJECT_TENANT_SCOPE_DENIED' and action_code='PROJECT_PARTICIPANT_READ' and resource_type='EMISSION_PROJECT' and outcome_code='ACCESS_DENIED' and row_hash ~ '^[0-9a-f]{64}$') from framework_scope_access_audit where lower(account_id)='qadata26' and tenant_id='$account_tenant' and project_id='$denied_project' and audit_id>$scope_audit_baseline")"
[[ "$scope_audit_exact" == t ]] || { echo '[actor-account-journey] FAIL exact scope denial audit missing' >&2; exit 1; }
scope_audit_record="$(q "select jsonb_build_object('schemaVersion',schema_version,'auditId',audit_id,'rowHash',row_hash,'accountId',account_id,'tenantId',tenant_id,'projectId',project_id,'decisionCode',decision_code,'reasonCode',reason_code,'actionCode',action_code,'resourceType',resource_type,'outcomeCode',outcome_code)::text from framework_scope_access_audit where lower(account_id)='qadata26' and tenant_id='$account_tenant' and project_id='$denied_project' and audit_id>$scope_audit_baseline")"
jq -e '.schemaVersion==2 and (.auditId|type)=="number" and .auditId>0 and (.rowHash|test("^[0-9a-f]{64}$")) and .accountId=="qadata26" and .decisionCode=="DENIED" and .reasonCode=="PROJECT_TENANT_SCOPE_DENIED" and .actionCode=="PROJECT_PARTICIPANT_READ" and .resourceType=="EMISSION_PROJECT" and .outcomeCode=="ACCESS_DENIED"' <<<"$scope_audit_record" >/dev/null \
  || { echo '[actor-account-journey] FAIL scope audit authoritative row invalid' >&2; exit 1; }

submission_id="$(q "select coalesce((select regulatory_submission_id from emission_regulatory_submission where project_id='$PROJECT' order by regulatory_submission_id desc limit 1),0)")"

# A calculator must never be able to perform the verifier-only acceptance action.
actor_audit_baseline="$(q "select coalesce(max(audit_id),0) from framework_scope_access_audit where lower(account_id)='qacalc26' and tenant_id='$account_tenant' and project_id='$PROJECT'")"
actor_audit_count_baseline="$(q "select count(*) from framework_scope_access_audit where lower(account_id)='qacalc26' and tenant_id='$account_tenant' and project_id='$PROJECT'")"
wrong_actor_code="$(curl -sS -b "$tmp/qacalc26.cookie" -o "$tmp/deny.json" -w '%{http_code}' -H 'Content-Type: application/json' -X POST "$BASE/home/api/emission-projects/$PROJECT/regulatory-submissions/$submission_id/transition" --data '{"action":"ACCEPT"}')"
[[ "$wrong_actor_code" == 403 ]] || { echo "[actor-account-journey] FAIL segregation status=$wrong_actor_code" >&2; exit 1; }
actor_audit_count_after="$(q "select count(*) from framework_scope_access_audit where lower(account_id)='qacalc26' and tenant_id='$account_tenant' and project_id='$PROJECT'")"
[[ "$actor_audit_count_baseline" =~ ^[0-9]+$ && "$actor_audit_count_after" =~ ^[0-9]+$ ]] \
  && (( actor_audit_count_after - actor_audit_count_baseline == 1 )) \
  || { echo '[actor-account-journey] FAIL actor-role audit id delta is not exactly 1' >&2; exit 1; }
actor_audit_exact="$(q "select count(*)=1 and bool_and(schema_version=2 and decision_code='DENIED' and reason_code='ACTOR_NOT_AUTHORIZED:APPROVER|VERIFIER' and action_code='REGULATORY_SUBMISSION_TRANSITION' and resource_type='REGULATORY_SUBMISSION' and outcome_code='ACCESS_DENIED' and row_hash ~ '^[0-9a-f]{64}$') from framework_scope_access_audit where lower(account_id)='qacalc26' and tenant_id='$account_tenant' and project_id='$PROJECT' and audit_id>$actor_audit_baseline")"
[[ "$actor_audit_exact" == t ]] || { echo '[actor-account-journey] FAIL exact actor-role denial audit missing' >&2; exit 1; }
actor_audit_record="$(q "select jsonb_build_object('schemaVersion',schema_version,'auditId',audit_id,'rowHash',row_hash,'accountId',account_id,'tenantId',tenant_id,'projectId',project_id,'decisionCode',decision_code,'reasonCode',reason_code,'actionCode',action_code,'resourceType',resource_type,'outcomeCode',outcome_code)::text from framework_scope_access_audit where lower(account_id)='qacalc26' and tenant_id='$account_tenant' and project_id='$PROJECT' and audit_id>$actor_audit_baseline")"
jq -e '.schemaVersion==2 and (.auditId|type)=="number" and .auditId>0 and (.rowHash|test("^[0-9a-f]{64}$")) and .accountId=="qacalc26" and .decisionCode=="DENIED" and .reasonCode=="ACTOR_NOT_AUTHORIZED:APPROVER|VERIFIER" and .actionCode=="REGULATORY_SUBMISSION_TRANSITION" and .resourceType=="REGULATORY_SUBMISSION" and .outcomeCode=="ACCESS_DENIED"' <<<"$actor_audit_record" >/dev/null \
  || { echo '[actor-account-journey] FAIL actor-role audit authoritative row invalid' >&2; exit 1; }

anonymous_code="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/home/api/emission-projects/$PROJECT/regulatory-submissions")"
[[ "$anonymous_code" == 401 || "$anonymous_code" == 403 ]] || { echo "[actor-account-journey] FAIL anonymous protection status=$anonymous_code" >&2; exit 1; }

if [[ "$EVIDENCE_MODE" == candidate ]]; then
  draft_after_hex="$(snapshot_draft)"
  [[ "$draft_after_hex" == "$draft_snapshot_hex" ]] || { echo '[actor-account-journey] FAIL candidate changed the owner draft' >&2; exit 1; }
  mutable_business_after="$(mutable_business_digest)"
  [[ "$mutable_business_after" == "$mutable_business_before" ]] || { echo '[actor-account-journey] FAIL candidate changed mutable business state' >&2; exit 1; }
  logout_actor_sessions || { echo '[actor-account-journey] FAIL actor session cleanup' >&2; exit 1; }
  [[ "$auth_token_after" == 0 ]] || { echo '[actor-account-journey] FAIL auth token cleanup evidence' >&2; exit 1; }
  jq -cn --arg projectId "$PROJECT" --arg sourceCommit "$SOURCE_COMMIT" --arg beforeHash "$mutable_business_before" --arg afterHash "$mutable_business_after" --argjson scopeAudit "$scope_audit_record" --argjson actorAudit "$actor_audit_record" --argjson anonymousStatus "$anonymous_code" '{projectId:$projectId,actorAccounts:5,actorRoles:5,tasks:7,fullWorkflow:"7/7",workflowOrderVerified:true,nextTaskLinksVerified:true,projectScopeVerified:true,listIsolationVerified:true,scopeDenialAuditPreserved:true,segregationVerified:true,unauthorizedStatus:403,anonymousStatus:$anonymousStatus,draftReadVerified:true,draftMutation:"SKIPPED_CANDIDATE_READ_ONLY",mutableBusinessWrites:0,mutableBusinessHashBefore:$beforeHash,mutableBusinessHashAfter:$afterHash,securityAuditAppendDelta:2,scopeAuditIdDelta:1,actorAuditIdDelta:1,securityAuditTypes:["PROJECT_SCOPE_DENIED","ACTOR_ROLE_DENIED"],securityAuditEvidence:[$scopeAudit,$actorAudit],authTokenBaseline:0,authTokenAfter:0,authTokenCleanupVerified:true,sourceCommit:$sourceCommit}' |
    bash "$ROOT/ops/scripts/stage-postdeploy-evidence-candidate.sh" \
      ACTOR_ACCOUNT_CUSTOMER_JOURNEY CUSTOMER_WORK_COORDINATION RUNTIME "$SOURCE_COMMIT"
else
  q "update framework_customer_journey_validation_run set evidence_json=(coalesce(nullif(evidence_json,''),'{}')::jsonb || jsonb_build_object('actorAccounts',5,'actorRoles',5,'segregation','VERIFIED','projectScope','VERIFIED','listIsolation','VERIFIED','scopeDenialAudit','VERIFIED','fullWorkflow','7/7','workflowOrder','VERIFIED','nextTaskLinks','VERIFIED','unauthorizedStatus',403,'anonymousStatus',$anonymous_code))::text where validation_id=(select max(validation_id) from framework_customer_journey_validation_run where project_id='$PROJECT')" >/dev/null
fi
echo "[actor-account-journey] PASS project=$PROJECT accounts=5 roles=5 tasks=7 workflow=7/7 order=verified links=verified scopes=verified segregation=verified unauthorized=403 anonymous=$anonymous_code"
