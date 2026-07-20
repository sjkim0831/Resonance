#!/usr/bin/env bash
set -euo pipefail

BASE="${CARBONET_RUNTIME_BASE_URL:-http://127.0.0.1}"
USER_ID="${CARBONET_RUNTIME_SMOKE_USER:-webmaster}"
PASSWORD="${CARBONET_RUNTIME_SMOKE_PASSWORD:-${CARBONET_ACTOR_TEST_PASSWORD:-}}"
EVIDENCE_DIR="${CARBONET_RUNTIME_SMOKE_EVIDENCE_DIR:-/opt/Resonance/var/test-evidence/process-runtime-smoke}"
PROCESS_CODE="${CARBONET_RUNTIME_SMOKE_PROCESS:-}"
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
required=('success','rolledBack','idempotencyVerified','tenantIsolationVerified')
if not all(p.get(k) is True for k in required):
    raise SystemExit(f'runtime assertions failed: {p}')
for key in ('processCode','stepCode','actorCode','stateTransition'):
    if not p.get(key): raise SystemExit(f'missing evidence field: {key}')
PY

for route in /home /admin /emission/project_list /admin/system/actor-process; do
  page_code="$(curl -sS -b "$cookie" -o /dev/null -w '%{http_code}' "$BASE$route")"
  [[ "$page_code" == 200 ]] || { echo "[process-runtime-smoke] FAIL route=$route status=$page_code" >&2; exit 1; }
done

python3 - "$runtime" "$EVIDENCE_DIR/$stamp.json" <<'PY'
import json,sys,datetime
p=json.load(open(sys.argv[1],encoding='utf-8'))
p['verifiedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
p['routes']=['/home','/admin','/emission/project_list','/admin/system/actor-process']
json.dump(p,open(sys.argv[2],'w',encoding='utf-8'),ensure_ascii=False,indent=2)
PY
ln -sfn "$stamp.json" "$EVIDENCE_DIR/latest.json"
echo "[process-runtime-smoke] PASS process=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))[\"processCode\"])' "$runtime") evidence=$EVIDENCE_DIR/$stamp.json"
