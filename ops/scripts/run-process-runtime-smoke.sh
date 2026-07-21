#!/usr/bin/env bash
set -euo pipefail

BASE="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
USER_ID="${CARBONET_RUNTIME_SMOKE_USER:-webmaster}"
PASSWORD="${CARBONET_RUNTIME_SMOKE_PASSWORD:-${CARBONET_ACTOR_TEST_PASSWORD:-}}"
EVIDENCE_DIR="${CARBONET_RUNTIME_SMOKE_EVIDENCE_DIR:-/opt/Resonance/var/test-evidence/process-runtime-smoke}"
PROCESS_CODE="${CARBONET_RUNTIME_SMOKE_PROCESS:-}"
PROMOTE="${CARBONET_RUNTIME_SMOKE_PROMOTE:-false}"
[[ -n "$PASSWORD" ]] || { echo '[process-runtime-smoke] FAIL password not configured' >&2; exit 1; }

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
mkdir -p "$EVIDENCE_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
cookie="$tmp/cookie"; login="$tmp/login.json"; runtime="$tmp/runtime.json"

code="$(curl -sS -c "$cookie" -o "$login" -w '%{http_code}' -H 'Content-Type: application/json' -X POST "$BASE/signin/actionLogin" --data "{\"userId\":\"$USER_ID\",\"userPw\":\"$PASSWORD\",\"userSe\":\"USR\"}")"
[[ "$code" == 200 ]] || { echo "[process-runtime-smoke] FAIL login status=$code" >&2; exit 1; }

health_code="$(curl -sS -o "$tmp/health.json" -w '%{http_code}' "$BASE/actuator/health")"
[[ "$health_code" == 200 ]] || { echo "[process-runtime-smoke] FAIL health status=$health_code" >&2; exit 1; }

code="$(curl -sS -b "$cookie" -o "$runtime" -w '%{http_code}' -X POST --get --data-urlencode "processCode=$PROCESS_CODE" "$BASE/admin/api/system/actor-process/backend/runtime-smoke")"
[[ "$code" == 200 ]] || { echo "[process-runtime-smoke] FAIL runtime status=$code body=$(tr -d '\n' < "$runtime" | head -c 300)" >&2; exit 1; }

RUNTIME="$runtime" python3 - <<'PY'
import json, os
p=json.load(open(os.environ['RUNTIME'],encoding='utf-8'))
required=('success','rolledBack','idempotencyVerified','recoveryVerified','tenantIsolationVerified','authorityVerified','exceptionVerified','workflowCompleted')
if not all(p.get(k) is True for k in required):
    raise SystemExit(f'runtime assertions failed: {p}')
for key in ('processCode','stepCode','actorCode','stateTransition'):
    if not p.get(key): raise SystemExit(f'missing evidence field: {key}')
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

for route in /home /admin /emission/project_list /admin/system/actor-process /admin/emission/organizational-boundary; do
  page_code="$(curl -sS -b "$cookie" -o /dev/null -w '%{http_code}' "$BASE$route")"
  [[ "$page_code" == 200 ]] || { echo "[process-runtime-smoke] FAIL route=$route status=$page_code" >&2; exit 1; }
done

python3 - "$runtime" "$rollback" "$EVIDENCE_DIR/$stamp.json" <<'PY'
import json,sys,datetime
p=json.load(open(sys.argv[1],encoding='utf-8'))
p['rollbackPersistenceCheck']=json.load(open(sys.argv[2],encoding='utf-8'))
p['verifiedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
p['routes']=['/home','/admin','/emission/project_list','/admin/system/actor-process','/admin/emission/organizational-boundary']
p['protectedUserRoutes']=['/emission/organizational-boundary']
json.dump(p,open(sys.argv[3],'w',encoding='utf-8'),ensure_ascii=False,indent=2)
PY
exec 8>"$EVIDENCE_DIR/.latest.lock"
flock 8
ln -sfn "$stamp.json" "$EVIDENCE_DIR/latest.json"
flock -u 8
exec 8>&-
process_name="$(RUNTIME="$runtime" python3 - <<'PY'
import json,os
print(json.load(open(os.environ['RUNTIME'],encoding='utf-8'))['processCode'])
PY
)"
if [[ "$PROMOTE" == "true" ]]; then
  dashboard="$tmp/dashboard.json"; cases="$tmp/cases.tsv"
  code="$(curl -sS -b "$cookie" -o "$dashboard" -w '%{http_code}' "$BASE/admin/api/system/actor-process")"
  [[ "$code" == 200 ]] || { echo "[process-runtime-smoke] FAIL dashboard status=$code" >&2; exit 1; }
  DASHBOARD="$dashboard" PROCESS="$process_name" python3 - <<'PY' > "$cases"
import json,os
p=json.load(open(os.environ['DASHBOARD'],encoding='utf-8'))
required={'HAPPY_PATH','AUTHORITY','ISOLATION','EXCEPTION','RECOVERY'}
rows=[x for x in p.get('cases',[]) if x.get('processCode')==os.environ['PROCESS'] and x.get('caseType') in required]
found={x.get('caseType') for x in rows}
if found != required: raise SystemExit(f'missing safety cases: {sorted(required-found)}')
for row in rows: print(f"{row['caseCode']}\t{row['caseType']}")
PY
  while IFS=$'\t' read -r case_code case_type; do
    payload="$(CASE_CODE="$case_code" CASE_TYPE="$case_type" EVIDENCE="$EVIDENCE_DIR/$stamp.json" python3 - <<'PY'
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
    [[ "$code" == 200 ]] || { echo "[process-runtime-smoke] FAIL approve step=$step_code status=$code body=$(tr -d '\n' < "$tmp/approve.json" | head -c 2000)" >&2; exit 1; }
  done < "$tmp/steps.txt"
fi
echo "[process-runtime-smoke] PASS process=$process_name evidence=$EVIDENCE_DIR/$stamp.json"
