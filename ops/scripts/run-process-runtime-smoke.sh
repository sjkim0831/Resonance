#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
USER_ID=""
PASSWORD=""
EVIDENCE_DIR="${CARBONET_RUNTIME_SMOKE_EVIDENCE_DIR:-/opt/Resonance/var/test-evidence/process-runtime-smoke}"
PROCESS_CODE="${CARBONET_RUNTIME_SMOKE_PROCESS:-}"
PROMOTE="${CARBONET_RUNTIME_SMOKE_PROMOTE:-false}"
EVIDENCE_MODE="${CARBONET_POSTDEPLOY_EVIDENCE_MODE:-legacy}"
if [[ "$EVIDENCE_MODE" == "candidate" && "$PROMOTE" == "true" ]]; then
  echo '[process-runtime-smoke] FAIL candidate mode forbids current simulation/job promotion' >&2
  exit 2
fi
source "$ROOT/ops/scripts/runtime-qa-auth-common.sh"
carbonet_qa_load_credentials USER_ID PASSWORD \
  "${CARBONET_RUNTIME_SMOKE_USER:-}" "${CARBONET_RUNTIME_SMOKE_PASSWORD:-${CARBONET_ACTOR_TEST_PASSWORD:-}}" \
  "${CARBONET_RUNTIME_AUTH_SECRET:-carbonet-screen-smoke}" "${K8S_NAMESPACE:-carbonet-prod}"

tmp="$(mktemp -d)"
SESSION_ACTIVE=0
finalize() {
  local status=$? logout_status=""
  trap - EXIT
  set +e
  if [[ "$SESSION_ACTIVE" == 1 ]]; then
    logout_status="$(curl -sS -b "$cookie" -o "$tmp/logout.json" -w '%{http_code}' -X POST "$BASE/signin/actionLogout")"
    if { [[ "$logout_status" != 200 ]] || ! jq -e '(.status // "") == "success"' "$tmp/logout.json" >/dev/null 2>&1; } && [[ "$status" == 0 ]]; then
      echo "[process-runtime-smoke] FAIL logout status=$logout_status" >&2
      status=1
    fi
  fi
  rm -rf "$tmp"
  exit "$status"
}
trap finalize EXIT
mkdir -p "$EVIDENCE_DIR"
cookie="$tmp/cookie"; login="$tmp/login.json"; login_payload="$tmp/login-payload.json"; runtime="$tmp/runtime.json"

printf '%s' "$PASSWORD" | jq -Rsc --arg id "$USER_ID" '{userId:$id,userPw:.,userSe:"USR"}' >"$login_payload"
PASSWORD=""
unset PASSWORD CARBONET_RUNTIME_SMOKE_PASSWORD CARBONET_ACTOR_TEST_PASSWORD
code="$(curl -sS -c "$cookie" -o "$login" -w '%{http_code}' -H 'Content-Type: application/json' -X POST "$BASE/signin/actionLogin" --data-binary "@$login_payload")"
rm -f "$login_payload"
[[ "$code" == 200 ]] && jq -e --arg user "$USER_ID" '.status == "loginSuccess" and (.userId | ascii_downcase) == ($user | ascii_downcase)' "$login" >/dev/null \
  || { echo "[process-runtime-smoke] FAIL login status=$code" >&2; exit 1; }
SESSION_ACTIVE=1

health_code="$(curl -sS -o "$tmp/health.json" -w '%{http_code}' "$BASE/actuator/health")"
[[ "$health_code" == 200 ]] || { echo "[process-runtime-smoke] FAIL health status=$health_code" >&2; exit 1; }

code="$(curl -sS -b "$cookie" -o "$runtime" -w '%{http_code}' -X POST --get --data-urlencode "processCode=$PROCESS_CODE" "$BASE/admin/api/system/actor-process/backend/runtime-smoke")"
[[ "$code" == 200 ]] || { echo "[process-runtime-smoke] FAIL runtime status=$code body=$(tr -d '\n' < "$runtime" | head -c 300)" >&2; exit 1; }

RUNTIME="$runtime" python3 - <<'PY'
import json, os
p=json.load(open(os.environ['RUNTIME'],encoding='utf-8'))
required=('success','rolledBack','requiredValidationVerified','draftRoundTripVerified','staleVersionRejected','draftSubmittedVerified','idempotencyVerified','recoveryVerified','tenantIsolationVerified','authorityVerified','exceptionVerified','workflowCompleted','nextTaskLinkVerified','workflowDraftsVerified')
if not all(p.get(k) is True for k in required):
    raise SystemExit(f'runtime assertions failed: {p}')
for key in ('processCode','stepCode','actorCode','stateTransition'):
    if not p.get(key): raise SystemExit(f'missing evidence field: {key}')
if p.get('editableFieldCount',0) < p.get('requiredFieldCount',0) or p.get('reloadedFieldCount') != p.get('editableFieldCount'):
    raise SystemExit(f'professional field round-trip mismatch: {p}')
if not p.get('nextUserPath') and not p.get('nextAdminPath'):
    raise SystemExit(f'next task route missing: {p}')
if p.get('workflowDraftStepCount',0) < 1 or p.get('workflowDraftFieldCount',0) < p.get('editableFieldCount',0):
    raise SystemExit(f'workflow draft coverage mismatch: {p}')
if p.get('stepCount',0) < 1 or len(p.get('transitions',[])) != p.get('stepCount'):
    raise SystemExit(f'invalid transition evidence: {p}')
PY

execution_id="$(RUNTIME="$runtime" python3 - <<'PY'
import json,os
print(json.load(open(os.environ['RUNTIME'],encoding='utf-8'))['executionId'])
PY
)"
rollback="$tmp/rollback.json"
code="$(curl -sS -b "$cookie" -o "$rollback" -w '%{http_code}' "$BASE/admin/api/system/actor-process/backend/runtime-smoke/$execution_id/rollback-check")"
[[ "$code" == 200 ]] || { echo "[process-runtime-smoke] FAIL rollback check status=$code" >&2; exit 1; }
ROLLBACK="$rollback" python3 - <<'PY'
import json,os
p=json.load(open(os.environ['ROLLBACK'],encoding='utf-8'))
if p.get('success') is not True or p.get('executionRows') != 0 or p.get('eventRows') != 0:
    raise SystemExit(f'rollback persistence check failed: {p}')
PY

routes=(/home /admin /emission/project_list /admin/system/actor-process /admin/emission/organizational-boundary)
if [[ "$PROCESS_CODE" == "EMISSION_PROJECT" ]]; then
  routes+=(/admin/emission/approval-queue /admin/emission/calculation-result /admin/emission/activity-data /admin/emission/correction-management /admin/emission/report-management /admin/emission/organizational-boundary /admin/emission/validation-queue)
fi
for route in "${routes[@]}"; do
  page_code="$(curl -sS -b "$cookie" -o /dev/null -w '%{http_code}' "$BASE$route")"
  [[ "$page_code" == 200 ]] || { echo "[process-runtime-smoke] FAIL route=$route status=$page_code" >&2; exit 1; }
done

process_name="$(RUNTIME="$runtime" python3 - <<'PY'
import json,os
print(json.load(open(os.environ['RUNTIME'],encoding='utf-8'))['processCode'])
PY
)"
[[ "$process_name" =~ ^[A-Z0-9_]{3,80}$ ]] || { echo '[process-runtime-smoke] FAIL invalid resolved process code' >&2; exit 1; }
run_identity="${CARBONET_POSTDEPLOY_CANDIDATE_ID:-}"
if [[ -n "$run_identity" ]]; then
  [[ "$run_identity" =~ ^[A-Za-z0-9._:-]{12,160}$ ]] || { echo '[process-runtime-smoke] FAIL invalid candidate run identity' >&2; exit 1; }
else
  run_identity="standalone-$(tr -d '-' </proc/sys/kernel/random/uuid)"
fi
stamp="$(date -u +%Y%m%dT%H%M%S%N)"
evidence_path="$EVIDENCE_DIR/${process_name}-${run_identity}-${stamp}.json"
[[ ! -e "$evidence_path" && ! -L "$evidence_path" ]] || { echo '[process-runtime-smoke] FAIL evidence path collision' >&2; exit 1; }
ROUTES_JSON="$(printf '%s\n' "${routes[@]}" | jq -R . | jq -s -c .)" python3 - "$runtime" "$rollback" "$tmp/evidence.json" <<'PY'
import json,sys,datetime,os
p=json.load(open(sys.argv[1],encoding='utf-8'))
p['rollbackPersistenceCheck']=json.load(open(sys.argv[2],encoding='utf-8'))
p['verifiedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
p['routes']=json.loads(os.environ['ROUTES_JSON'])
p['protectedUserRoutes']=['/emission/organizational-boundary']
json.dump(p,open(sys.argv[3],'w',encoding='utf-8'),ensure_ascii=False,indent=2)
PY
chmod 0444 "$tmp/evidence.json"
mv -- "$tmp/evidence.json" "$evidence_path"
[[ -f "$evidence_path" && ! -L "$evidence_path" && "$(stat -c %a "$evidence_path")" == 444 ]] \
  || { echo '[process-runtime-smoke] FAIL immutable evidence publication' >&2; exit 1; }
if [[ "$PROMOTE" == "true" ]]; then
  case_response="$tmp/case-response.json"; cases="$tmp/cases.tsv"
  code="$(curl -sS -b "$cookie" -o "$case_response" -w '%{http_code}' --get --data-urlencode "processCode=$process_name" "$BASE/admin/api/system/actor-process/cases")"
  [[ "$code" == 200 ]] || { echo "[process-runtime-smoke] FAIL cases status=$code" >&2; exit 1; }
  CASE_RESPONSE="$case_response" PROCESS="$process_name" python3 - <<'PY' > "$cases"
import json,os
p=json.load(open(os.environ['CASE_RESPONSE'],encoding='utf-8'))
required={'HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY'}
rows=[x for x in p.get('cases',[]) if x.get('processCode')==os.environ['PROCESS'] and x.get('caseType') in required]
found={x.get('caseType') for x in rows}
if found != required: raise SystemExit(f'missing safety cases: {sorted(required-found)}')
for row in rows: print(f"{row['caseCode']}\t{row['caseType']}")
PY
  while IFS=$'\t' read -r case_code case_type; do
    payload="$(CASE_CODE="$case_code" CASE_TYPE="$case_type" EVIDENCE="$evidence_path" python3 - <<'PY'
import json,os
print(json.dumps({'caseCode':os.environ['CASE_CODE'],'result':'PASSED','evidenceJson':json.dumps({'runtimeEvidence':os.environ['EVIDENCE'],'caseType':os.environ['CASE_TYPE'],'rollbackVerified':True})}))
PY
)"
    code="$(curl -sS -b "$cookie" -o "$tmp/run.json" -w '%{http_code}' -H 'Content-Type: application/json' -X POST "$BASE/admin/api/system/actor-process/runs" --data "$payload")"
    [[ "$code" == 200 ]] || { echo "[process-runtime-smoke] FAIL promote case=$case_code status=$code body=$(tr -d '\n' < "$tmp/run.json" | head -c 2000)" >&2; exit 1; }
  done < "$cases"
  RUNTIME="$runtime" python3 - <<'PY' > "$tmp/steps.txt"
import json,os
p=json.load(open(os.environ['RUNTIME'],encoding='utf-8'))
for step in dict.fromkeys(x['stepCode'] for x in p.get('transitions',[])): print(step)
PY
  while IFS= read -r step_code; do
    payload="$(PROCESS="$process_name" STEP="$step_code" python3 - <<'PY'
import json,os
print(json.dumps({'processCode':os.environ['PROCESS'],'stepCode':os.environ['STEP']}))
PY
)"
    code="$(curl -sS -b "$cookie" -o "$tmp/approve.json" -w '%{http_code}' -H 'Content-Type: application/json' -X POST "$BASE/admin/api/system/actor-process/development/approve" --data "$payload")"
    if [[ "$code" == 400 ]] && grep -Eq '사전검사|차단 항목' "$tmp/approve.json"; then
      echo "[process-runtime-smoke] PASS fail-closed approval step=$step_code blockers-preserved"
      continue
    fi
    [[ "$code" == 200 ]] || { echo "[process-runtime-smoke] FAIL approve step=$step_code status=$code body=$(tr -d '\n' < "$tmp/approve.json" | head -c 2000)" >&2; exit 1; }
  done < "$tmp/steps.txt"
fi
if [[ "$EVIDENCE_MODE" != candidate ]]; then
  exec 8>"$EVIDENCE_DIR/.latest.lock"
  flock 8
  ln -sfn "$(basename "$evidence_path")" "$EVIDENCE_DIR/latest.json"
  flock -u 8
  exec 8>&-
fi
evidence_hash="$(sha256sum "$evidence_path" | awk '{print $1}')"
echo "[process-runtime-smoke] EVIDENCE evidencePath=$evidence_path evidenceHash=$evidence_hash process=$process_name runIdentity=$run_identity"
echo "[process-runtime-smoke] PASS process=$process_name evidencePath=$evidence_path"
