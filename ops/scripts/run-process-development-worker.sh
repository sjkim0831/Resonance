#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
WORKTREE_ROOT="${WORKTREE_ROOT:-/opt/resonance-ai-worktrees}"
LOG_ROOT="${LOG_ROOT:-/opt/resonance-ai-worker-logs}"
MODEL="${KILO_MODEL:-kilo/~openai/gpt-latest}"
AGENT="${KILO_AGENT:-codex-m27}"
MAX_FILES="${MAX_CHANGED_FILES:-20}"
MAX_LINES="${MAX_DIFF_LINES:-3000}"
LOCK_FILE="${LOCK_FILE:-/tmp/resonance-process-development-worker-${WORKER_SLOT:-0}.lock}"
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
 select j.job_id from framework_development_job j
 left join framework_development_phase phase on phase.job_type=j.job_type and phase.active_yn='Y'
 where approval_status='APPROVED'
   and (job_status in ('PLANNED','RETRY') or (job_status='RUNNING' and lease_until<current_timestamp))
   and attempt_count < max_attempts
   and not exists (
     select 1 from framework_development_job_dependency d
     join framework_development_job required_job on required_job.job_id=d.depends_on_job_id
     where d.job_id=j.job_id and d.dependency_type='REQUIRED' and required_job.job_status not in ('VERIFIED','COMPLETED')
   )
   and not exists (
     select 1 from framework_development_job running_job
     where running_job.job_status='RUNNING' and running_job.job_id<>j.job_id
       and coalesce(running_job.target_path,'')<>'' and running_job.target_path=coalesce(j.target_path,'')
   )
 order by coalesce(phase.phase_order,1000),j.process_code,j.step_code,j.job_id
 for update of j skip locked limit 1
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
gate_result() {
  local gate="$1" result="$2" summary="${3:-}"
  summary="${summary//$'\n'/ }"
  summary="${summary:0:1000}"
  psqlq -c "insert into framework_development_job_gate_result(job_id,gate_code,result,summary,evidence_ref) values(${JOB_ID},'${gate}','${result}',\$summary\$${summary}\$summary\$,'${LOG_FILE}');" >/dev/null || true
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
trap 'fail_job "worker interrupted by signal"' INT TERM

event "CLAIMED" "PLANNED" "RUNNING" "{\"attempt\":${ATTEMPT}}"
git -C "$ROOT_DIR" fetch origin main >>"$LOG_FILE" 2>&1
BASE_COMMIT="$(git -C "$ROOT_DIR" rev-parse origin/main)"
git -C "$ROOT_DIR" worktree remove --force "$WT" >/dev/null 2>&1 || true
git -C "$ROOT_DIR" worktree add -B "$BRANCH" "$WT" "$BASE_COMMIT" >>"$LOG_FILE" 2>&1

SPEC="$(printf '%s' "$SPEC_B64" | base64 -d)"
SEARCH_PREPARER="${AI_SEARCH_CONTEXT_PREPARER:-$ROOT_DIR/ops/scripts/prepare-ai-search-context.sh}"
SEARCH_CONTEXT="$(ROOT_DIR="$ROOT_DIR" "$SEARCH_PREPARER" "$PROCESS_CODE" "$STEP_CODE" "$JOB_TYPE" "$TARGET_PATH")"
psqlq -c "update framework_development_job set search_context_ref='${SEARCH_CONTEXT}',updated_at=current_timestamp where job_id=${JOB_ID} and lease_token='${LEASE_TOKEN}';" >/dev/null
cat >"$WT/.automation-prompt.txt" <<PROMPT
You are implementing one approved Resonance development job.
Job: ${JOB_ID}; process=${PROCESS_CODE}; step=${STEP_CODE}; type=${JOB_TYPE}; target=${TARGET_PATH}
Specification: ${SPEC}

Read AGENTS.md and obey it. Inspect /opt/reference only as read-only evidence. Inspect existing DB/API/page implementations before editing.
Implement exactly one bounded, production-useful increment for this job. Reuse registered KRDS theme, sections and components. For page-only work prefer SDUI and project-owned metadata/overlay paths with no build/deploy. Do not edit generated bundles manually.
Add or update automated tests and evidence. Never modify credentials, backups, database data, Kubernetes state, deployment scripts, CI permissions, or unrelated files. Do not commit or push; the worker will validate and publish.
If the specification is too broad, choose the highest-priority missing behavior supported by a reference and document the remaining gap in a project-owned markdown or metadata artifact.
Do not recursively enumerate large reference or repository directories. Use targeted rg/find queries derived from the process and step codes.
Start with the precomputed candidate list below. Search outside it only when a concrete missing symbol or contract requires it.
Repository candidates are paths relative to the current isolated worktree. Never rewrite them to /opt/Resonance and never modify /opt/Resonance directly. All repository reads and writes must remain under the current --dir worktree.
$(cat "$SEARCH_CONTEXT")
Start creating the bounded deliverable within 15 search/read tool calls. Finish the increment instead of continuing broad research.
For REFERENCE_ANALYSIS, create or update a structured project-owned analysis artifact under the target path (or the nearest existing metadata/docs path) covering actors, flow, states, permissions, data/API contracts, screens, acceptance tests, reference evidence, and implementation gaps.
When the job type is REFERENCE_ANALYSIS, your first repository mutation must happen before inspecting references: immediately create the artifact skeleton under docs/ai/70-reference/<process-code-lowercase>/<step-code-lowercase>.md, then perform only targeted research and fill that artifact. Do not postpone the first edit.
PROMPT

INITIAL_MESSAGE="Implement the attached approved Resonance development job."
if [ "$JOB_TYPE" = "REFERENCE_ANALYSIS" ]; then
  ARTIFACT_PATH="docs/ai/70-reference/${PROCESS_CODE,,}/${STEP_CODE,,}.md"
  INITIAL_MESSAGE="Immediately create ${ARTIFACT_PATH} with the required section skeleton before any research. Then implement the attached approved Resonance development job and fill the artifact with targeted evidence."
fi
if timeout 45m kilo run "$INITIAL_MESSAGE" \
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
  (cd "$WT" && bash ./gradlew :apps:carbonet-api:compileJava --no-daemon) >>"$LOG_FILE" 2>&1 || fail_job "backend compile failed"
fi
while IFS= read -r json; do jq empty "$WT/$json" >>"$LOG_FILE" 2>&1 || fail_job "invalid JSON: $json"; done < <(printf '%s\n' "$CHANGED" | sed -E 's/^.. //' | grep -E '\.json$' || true)

while IFS= read -r -d '' source_file; do
  case "$source_file" in
    *.md|*.txt|*.ts|*.tsx|*.js|*.jsx|*.java|*.kt|*.kts|*.sql|*.xml|*.json|*.yml|*.yaml|*.css|*.scss|*.html|*.sh)
      sed -i 's/[[:space:]]\+$//' "$WT/$source_file"
      ;;
  esac
done < <(git -C "$WT" ls-files --modified --others --exclude-standard -z)

PLACEHOLDER_FAILURE=""
while IFS= read -r -d '' source_file; do
  case "$source_file" in
    *.md|*.txt|*.ts|*.tsx|*.js|*.jsx|*.java|*.kt|*.kts|*.sql|*.xml|*.json|*.yml|*.yaml|*.css|*.scss|*.html|*.sh)
      if rg -n -i -m 1 '(^|[^A-Za-z])(TBD|FIXME|placeholder|임시 구현)([^A-Za-z]|$)' "$WT/$source_file" >>"$LOG_FILE" 2>&1; then
        PLACEHOLDER_FAILURE="$source_file"
        break
      fi
      ;;
  esac
  [ -s "$WT/$source_file" ] || { gate_result "NON_EMPTY_ARTIFACT" "FAILED" "$source_file is empty"; fail_job "empty artifact: $source_file"; }
done < <(git -C "$WT" ls-files --modified --others --exclude-standard -z)
[ -z "$PLACEHOLDER_FAILURE" ] || { gate_result "NO_PLACEHOLDER" "FAILED" "$PLACEHOLDER_FAILURE"; fail_job "unfinished placeholder detected: $PLACEHOLDER_FAILURE"; }
gate_result "NO_PLACEHOLDER" "PASSED" "changed text contains no unfinished placeholders"
gate_result "NON_EMPTY_ARTIFACT" "PASSED" "all changed artifacts are non-empty"

git -C "$WT" add -A
git -C "$WT" diff --cached --check >>"$LOG_FILE" 2>&1 || { gate_result "DIFF_CHECK" "FAILED" "git diff --check"; fail_job "git diff check failed"; }
gate_result "DIFF_CHECK" "PASSED" "git diff --check"
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
