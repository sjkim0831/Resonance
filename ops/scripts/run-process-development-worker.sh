#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
WORKTREE_ROOT="${WORKTREE_ROOT:-/opt/resonance-ai-worktrees}"
LOG_ROOT="${LOG_ROOT:-/opt/resonance-ai-worker-logs}"
MODEL="${KILO_MODEL:-kilo/~openai/gpt-latest}"
AGENT="${KILO_AGENT:-codex-m27}"
MAX_FILES="${MAX_CHANGED_FILES:-20}"
MAX_LINES="${MAX_DIFF_LINES:-3000}"
LOCK_FILE="${LOCK_FILE:-/tmp/resonance-process-development-worker.lock}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
K8S_NAMESPACE="${K8S_NAMESPACE:-carbonet-prod}"
POSTGRES_POD="${POSTGRES_POD:-postgres-patroni-0}"
PGHOST="${PGHOST:-postgres-haproxy}"

mkdir -p "$WORKTREE_ROOT" "$LOG_ROOT" "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

psqlq() {
  kubectl -n "$K8S_NAMESPACE" exec "$POSTGRES_POD" -- env PGPASSWORD="$PGPASSWORD" \
    psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -X -q -v ON_ERROR_STOP=1 -At "$@"
}
WORKER_ID="$(hostname)-kilo-$$"
LEASE_TOKEN="$(cat /proc/sys/kernel/random/uuid)"

claim_sql=$(cat <<SQL
with candidate as (
 select job_id from framework_development_job j
 where approval_status='APPROVED'
   and (job_status in ('PLANNED','RETRY') or (job_status='RUNNING' and lease_until<current_timestamp))
   and not exists (
     select 1 from framework_development_job p
     where p.process_code=j.process_code and p.step_code=j.step_code
       and (case p.job_type when 'DATABASE' then 10 when 'API' then 20 when 'BACKEND' then 30 when 'FRONTEND_USER' then 40 when 'FRONTEND_ADMIN' then 50 when 'NOTIFICATION' then 60 when 'TEST' then 70 when 'INTEGRATION' then 80 when 'REFERENCE_ANALYSIS' then 90 else 100 end)
         < (case j.job_type when 'DATABASE' then 10 when 'API' then 20 when 'BACKEND' then 30 when 'FRONTEND_USER' then 40 when 'FRONTEND_ADMIN' then 50 when 'NOTIFICATION' then 60 when 'TEST' then 70 when 'INTEGRATION' then 80 when 'REFERENCE_ANALYSIS' then 90 else 100 end)
       and p.job_status<>'VERIFIED'
   )
 order by process_code,step_code,
   case job_type when 'DATABASE' then 10 when 'API' then 20 when 'BACKEND' then 30 when 'FRONTEND_USER' then 40 when 'FRONTEND_ADMIN' then 50 when 'NOTIFICATION' then 60 when 'TEST' then 70 when 'INTEGRATION' then 80 when 'REFERENCE_ANALYSIS' then 90 else 100 end,job_id
 for update skip locked limit 1
), claimed as (
 update framework_development_job j set job_status='RUNNING',worker_id='${WORKER_ID}',lease_token='${LEASE_TOKEN}',lease_until=current_timestamp+interval '60 minutes',attempt_count=attempt_count+1,started_at=coalesce(started_at,current_timestamp),last_error=null,updated_at=current_timestamp
 from candidate c where j.job_id=c.job_id
 returning j.*
)
select row_to_json(payload)::text
from (
  select job_id,process_code,step_code,job_type,coalesce(target_path,'') as target_path,
    replace(encode(convert_to(coalesce(specification_json,'{}'),'UTF8'),'base64'),E'\n','') as specification_base64,
    attempt_count
  from claimed
) payload;
SQL
)

JOB_JSON="$(psqlq -c "begin; ${claim_sql} commit;")"
[ -n "$JOB_JSON" ] || exit 0
jq -e 'type == "object" and (.job_id | type == "number")' <<<"$JOB_JSON" >/dev/null
JOB_ID="$(jq -r '.job_id' <<<"$JOB_JSON")"
PROCESS_CODE="$(jq -r '.process_code' <<<"$JOB_JSON")"
STEP_CODE="$(jq -r '.step_code' <<<"$JOB_JSON")"
JOB_TYPE="$(jq -r '.job_type' <<<"$JOB_JSON")"
TARGET_PATH="$(jq -r '.target_path' <<<"$JOB_JSON")"
SPEC_B64="$(jq -r '.specification_base64' <<<"$JOB_JSON")"
ATTEMPT="$(jq -r '.attempt_count' <<<"$JOB_JSON")"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$LOG_ROOT/job-${JOB_ID}-${STAMP}.log"
WT="$WORKTREE_ROOT/job-${JOB_ID}"
BRANCH="automation/job-${JOB_ID}-attempt-${ATTEMPT}"
BASE_COMMIT=""

event() {
  local type="$1" from="$2" to="$3" detail="${4:-{}}"
  psqlq -c "insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json) values(${JOB_ID},'${type}','${from}','${to}','${WORKER_ID}',\$json\$${detail}\$json\$);" >/dev/null
}
fail_job() {
  trap - ERR
  local message="${1:-worker failed}"
  message="${message//$'\n'/ }"
  message="${message:0:1800}"
  psqlq -c "update framework_development_job set job_status='FAILED',last_error=\$err\$${message}\$err\$,rollback_ref=nullif('${BASE_COMMIT}',''),lease_token=null,lease_until=null,updated_at=current_timestamp where job_id=${JOB_ID} and lease_token='${LEASE_TOKEN}';" >/dev/null || true
  event "FAILED" "RUNNING" "FAILED" "{\"log\":\"${LOG_FILE}\"}" || true
  git -C "$ROOT_DIR" worktree remove --force "$WT" >/dev/null 2>&1 || true
  exit 1
}
trap 'fail_job "unexpected worker error at line ${LINENO}"' ERR

event "CLAIMED" "PLANNED" "RUNNING" "{\"attempt\":${ATTEMPT}}"
git -C "$ROOT_DIR" fetch origin main >>"$LOG_FILE" 2>&1
BASE_COMMIT="$(git -C "$ROOT_DIR" rev-parse origin/main)"
git -C "$ROOT_DIR" worktree remove --force "$WT" >/dev/null 2>&1 || true
git -C "$ROOT_DIR" worktree add -B "$BRANCH" "$WT" "$BASE_COMMIT" >>"$LOG_FILE" 2>&1

SPEC="$(printf '%s' "$SPEC_B64" | base64 -d)"
cat >"$WT/.automation-prompt.txt" <<PROMPT
You are implementing one approved Resonance development job.
Job: ${JOB_ID}; process=${PROCESS_CODE}; step=${STEP_CODE}; type=${JOB_TYPE}; target=${TARGET_PATH}
Specification: ${SPEC}

Read AGENTS.md and obey it. Inspect /opt/reference only as read-only evidence. Inspect existing DB/API/page implementations before editing.
Implement exactly one bounded, production-useful increment for this job. Reuse registered KRDS theme, sections and components. For page-only work prefer SDUI and project-owned metadata/overlay paths with no build/deploy. Do not edit generated bundles manually.
Add or update automated tests and evidence. Never modify credentials, backups, database data, Kubernetes state, deployment scripts, CI permissions, or unrelated files. Do not commit or push; the worker will validate and publish.
If the specification is too broad, choose the highest-priority missing behavior supported by a reference and document the remaining gap in a project-owned markdown or metadata artifact.
PROMPT

if timeout 45m kilo run "Implement the attached approved Resonance development job." \
  --auto --format json --model "$MODEL" --agent "$AGENT" --dir "$WT" \
  --file "$WT/.automation-prompt.txt" >"$LOG_FILE.kilo" 2>&1; then
  KILO_CODE=0
else
  KILO_CODE=$?
fi
rm -f "$WT/.automation-prompt.txt"
[ "$KILO_CODE" -eq 0 ] || fail_job "Kilo exited with code ${KILO_CODE}"

CHANGED="$(git -C "$WT" status --porcelain)"
[ -n "$CHANGED" ] || fail_job "AI completed without a source or metadata change"
FILE_COUNT="$(printf '%s\n' "$CHANGED" | wc -l)"
[ "$FILE_COUNT" -le "$MAX_FILES" ] || fail_job "changed file limit exceeded: ${FILE_COUNT}/${MAX_FILES}"
DIFF_LINES="$(git -C "$WT" diff --numstat | awk '{a+=$1+$2} END{print a+0}')"
[ "$DIFF_LINES" -le "$MAX_LINES" ] || fail_job "diff line limit exceeded: ${DIFF_LINES}/${MAX_LINES}"
if printf '%s\n' "$CHANGED" | grep -Eq '(^| )((\.github|release|deploy|data|var)/|.*\.(db|sqlite|pem|key)$|.*secret)'; then
  fail_job "prohibited path changed"
fi

if printf '%s\n' "$CHANGED" | grep -q 'projects/carbonet-frontend/source/'; then
  "$ROOT_DIR/projects/carbonet-frontend/source/node_modules/.bin/tsc" -b "$WT/projects/carbonet-frontend/source/tsconfig.json" --pretty false >>"$LOG_FILE" 2>&1 || fail_job "frontend type check failed"
fi
if printf '%s\n' "$CHANGED" | grep -Eq '(^| )(apps|modules)/.*\.(java|kt|sql|xml)$'; then
  (cd "$WT" && ./gradlew :apps:carbonet-api:compileJava --no-daemon) >>"$LOG_FILE" 2>&1 || fail_job "backend compile failed"
fi
while IFS= read -r json; do jq empty "$WT/$json" >>"$LOG_FILE" 2>&1 || fail_job "invalid JSON: $json"; done < <(printf '%s\n' "$CHANGED" | sed -E 's/^.. //' | grep -E '\.json$' || true)

git -C "$WT" add -A
git -C "$WT" diff --cached --check >>"$LOG_FILE" 2>&1 || fail_job "git diff check failed"
git -C "$WT" -c user.name='Resonance AI Worker' -c user.email='ai-worker@resonance.local' commit -m "auto: ${PROCESS_CODE} ${JOB_TYPE} job ${JOB_ID}" >>"$LOG_FILE" 2>&1

git -C "$WT" fetch origin main >>"$LOG_FILE" 2>&1
[ "$(git -C "$WT" rev-parse origin/main)" = "$BASE_COMMIT" ] || fail_job "origin/main advanced during execution; retry required"
RESULT_COMMIT="$(git -C "$WT" rev-parse HEAD)"
git -C "$WT" push origin "HEAD:main" >>"$LOG_FILE" 2>&1 || fail_job "main push rejected"

for _ in $(seq 1 90); do
  DEPLOYED="$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || true)"
  READY="$(kubectl -n carbonet-prod get deploy carbonet-runtime -o jsonpath='{.status.readyReplicas}/{.spec.replicas}' 2>/dev/null || true)"
  if [ "$DEPLOYED" = "$RESULT_COMMIT" ] && [ "$READY" = "2/2" ] && curl -fsS --max-time 10 http://127.0.0.1/actuator/health >/dev/null; then break; fi
  sleep 10
done
curl -fsS --max-time 10 http://127.0.0.1/actuator/health >/dev/null || fail_job "deployment health check failed"

EVIDENCE="git:${RESULT_COMMIT};log:${LOG_FILE}"
psqlq -c "update framework_development_job set job_status='VERIFIED',result_json=\$json\${\"commit\":\"${RESULT_COMMIT}\"}\$json\$,evidence_ref='${EVIDENCE}',rollback_ref='${BASE_COMMIT}',completed_at=current_timestamp,lease_token=null,lease_until=null,updated_at=current_timestamp where job_id=${JOB_ID} and lease_token='${LEASE_TOKEN}'; update framework_process_artifact set delivery_status='VERIFIED',evidence_ref='${EVIDENCE}',updated_at=current_timestamp where process_code='${PROCESS_CODE}' and step_code='${STEP_CODE}' and contract_ref='AUTO:${JOB_TYPE}';" >/dev/null
event "VERIFIED" "RUNNING" "VERIFIED" "{\"commit\":\"${RESULT_COMMIT}\"}"
git -C "$ROOT_DIR" worktree remove --force "$WT" >/dev/null 2>&1 || true
printf 'VERIFIED job=%s commit=%s\n' "$JOB_ID" "$RESULT_COMMIT"
