#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
WORKTREE_ROOT="${WORKTREE_ROOT:-$ROOT_DIR/var/ai-worktrees}"
LOG_ROOT="${LOG_ROOT:-$ROOT_DIR/var/ai-worker-logs}"
PROJECT_WORK_RUNNER="${PROJECT_WORK_RUNNER:-$ROOT_DIR/ops/scripts/run-hermes-project-work.sh}"
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
runtime_health_url() {
  if [[ -n "${CARBONET_HEALTH_CHECK_URL:-}" ]]; then
    printf '%s\n' "$CARBONET_HEALTH_CHECK_URL"
    return 0
  fi
  local node_port
  node_port="$(kubectl -n "$K8S_NAMESPACE" get svc carbonet-runtime \
    -o jsonpath='{.spec.ports[?(@.name=="http")].nodePort}' 2>/dev/null || true)"
  if [[ -z "$node_port" ]]; then
    node_port="$(kubectl -n "$K8S_NAMESPACE" get svc carbonet-runtime \
      -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || true)"
  fi
  [[ "$node_port" =~ ^[0-9]+$ ]] || return 1
  printf 'http://127.0.0.1:%s/actuator/health\n' "$node_port"
}
runtime_is_healthy() {
  local health_url
  health_url="$(runtime_health_url)" || return 1
  curl -fsS --max-time 10 "$health_url" | jq -e '.status == "UP"' >/dev/null
}
WORKER_ID="$(hostname)-hermes-$$"
LEASE_TOKEN="$(cat /proc/sys/kernel/random/uuid)"

claim_sql=$(cat <<SQL
with candidate as (
 select j.job_id from framework_development_job j
 left join framework_development_phase phase on phase.job_type=j.job_type and phase.active_yn='Y'
 where approval_status='APPROVED'
   and (job_status='PLANNED' or (job_status='RETRY' and (lease_until is null or lease_until<current_timestamp)) or (job_status='RUNNING' and lease_until<current_timestamp))
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
defer_rate_limited_job() {
  trap - ERR
  psqlq -c "update framework_development_job set job_status='RETRY',last_error='NVIDIA rate limited; retry deferred',attempt_count=greatest(0,attempt_count-1),worker_id=null,lease_token=null,lease_until=current_timestamp+interval '15 minutes',updated_at=current_timestamp where job_id=${JOB_ID} and lease_token='${LEASE_TOKEN}';" >/dev/null || true
  event "RATE_LIMIT_DEFERRED" "RUNNING" "RETRY" "{\"retryAfterMinutes\":15}" || true
  git -C "$ROOT_DIR" worktree remove --force "$WT" >/dev/null 2>&1 || true
  exit 0
}
verify_adopted_frontend_tree() {
  local tree cache lock
  tree="$(git -C "$WT" rev-parse HEAD:projects/carbonet-frontend/source)"
  cache="${FRONTEND_TSC_CACHE_ROOT:-$ROOT_DIR/var/verification/frontend-tsc}/${tree}.pass"
  lock="${cache}.lock"
  mkdir -p "$(dirname "$cache")"
  exec 6>"$lock"; flock 6
  if [ ! -s "$cache" ]; then
    "$ROOT_DIR/projects/carbonet-frontend/source/node_modules/.bin/tsc" -b "$WT/projects/carbonet-frontend/source/tsconfig.json" --pretty false >>"$LOG_FILE" 2>&1 \
      || { flock -u 6; return 1; }
    printf 'tree=%s verifiedAt=%s\n' "$tree" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$cache"
  fi
  flock -u 6; exec 6>&-
}
trap 'fail_job "unexpected worker error at line ${LINENO}"' ERR
trap 'fail_job "worker interrupted by signal"' INT TERM

event "CLAIMED" "PLANNED" "RUNNING" "{\"attempt\":${ATTEMPT}}"
git -C "$ROOT_DIR" fetch origin main >>"$LOG_FILE" 2>&1
BASE_COMMIT="$(git -C "$ROOT_DIR" rev-parse origin/main)"
git -C "$ROOT_DIR" worktree remove --force "$WT" >/dev/null 2>&1 || true
git -C "$ROOT_DIR" worktree add -B "$BRANCH" "$WT" "$BASE_COMMIT" >>"$LOG_FILE" 2>&1

# Worktrees intentionally exclude dependency directories. Reuse the verified
# root installation so TypeScript resolves React and workspace packages without
# a per-job npm install or false "JSX.IntrinsicElements" failures.
frontend_root="$ROOT_DIR/projects/carbonet-frontend/source"
frontend_worktree="$WT/projects/carbonet-frontend/source"
if [[ -L "$frontend_worktree/node_modules" && ! -e "$frontend_worktree/node_modules" ]]; then
  rm -f -- "$frontend_worktree/node_modules"
fi
if [[ -d "$frontend_root/node_modules" && -d "$frontend_worktree" && ! -e "$frontend_worktree/node_modules" && ! -L "$frontend_worktree/node_modules" ]]; then
  ln -s "$frontend_root/node_modules" "$frontend_worktree/node_modules" 2>/dev/null \
    || { [ -e "$frontend_worktree/node_modules" ] || [ -L "$frontend_worktree/node_modules" ]; }
  exclude_file="$(git -C "$WT" rev-parse --git-path info/exclude)"
  exec 7>"${AI_GIT_EXCLUDE_LOCK_FILE:-/tmp/resonance-ai-git-exclude.lock}"
  flock 7
  grep -qxF 'projects/carbonet-frontend/source/node_modules' "$exclude_file" 2>/dev/null \
    || printf '%s\n' 'projects/carbonet-frontend/source/node_modules' >>"$exclude_file"
  flock -u 7
fi

SPEC="$(printf '%s' "$SPEC_B64" | base64 -d)"
SPEC_FILE="$WT/.automation-spec.json"
printf '%s' "$SPEC" >"$SPEC_FILE"
SEARCH_PREPARER="${AI_SEARCH_CONTEXT_PREPARER:-$ROOT_DIR/ops/scripts/prepare-ai-search-context.sh}"
if ! SEARCH_CONTEXT="$(ROOT_DIR="$ROOT_DIR" "$SEARCH_PREPARER" "$PROCESS_CODE" "$STEP_CODE" "$JOB_TYPE" "$TARGET_PATH")"; then
  SEARCH_CONTEXT="$WT/.automation-search-context-fallback.txt"
  printf 'process=%s\nstep=%s\ntype=%s\ntarget=%s\n\nSearch index preparation failed. Use the approved specification and exact target only; do not broaden scope.\n' \
    "$PROCESS_CODE" "$STEP_CODE" "$JOB_TYPE" "$TARGET_PATH" >"$SEARCH_CONTEXT"
fi
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
if [ "$JOB_TYPE" = "REFERENCE_ANALYSIS" ] || [ "$JOB_TYPE" = "DESIGN" ]; then
  if [ "$JOB_TYPE" = "REFERENCE_ANALYSIS" ]; then
    ARTIFACT_PATH="docs/ai/70-reference/${PROCESS_CODE,,}/${STEP_CODE,,}.md"
    ARTIFACT_KIND="reference and implemented-system analysis"
  else
    ARTIFACT_PATH="docs/ai/30-domain/process-design/${PROCESS_CODE,,}/${STEP_CODE,,}.md"
    ARTIFACT_KIND="executable actor-process design"
  fi
  mkdir -p "$WT/$(dirname "$ARTIFACT_PATH")"
  if [ ! -f "$WT/$ARTIFACT_PATH" ]; then
    cat >"$WT/$ARTIFACT_PATH" <<EOF
# ${PROCESS_CODE} / ${STEP_CODE}

## Purpose and completion condition

## Actors, authority, and tenant scope

## Entry conditions and state transitions

## User and administrator screen contract

## Commands, navigation, and responsive states

## API and transaction contract

## Database entities, indexes, and audit evidence

## Happy, exception, authority, isolation, and recovery tests

## Existing implementation evidence and reuse decision

## Frontend, backend, and integration delivery checklist
EOF
  fi
  INITIAL_MESSAGE="Open ${ARTIFACT_PATH} first. Fill this ${ARTIFACT_KIND} from the attached contract and precomputed candidate list. Do not enumerate unrelated docs or references. Finish this bounded artifact now."
fi
EXISTING_ADOPTED=0
ADOPTION_ARTIFACT="docs/ai/80-adopted-existing/${PROCESS_CODE,,}/job-${JOB_ID}.md"
if [[ "$JOB_TYPE" == FRONTEND_* ]]; then
  if ADOPTION_JSON="$(python3 "$WT/ops/scripts/adopt-existing-frontend-job.py" "$WT" "$PROCESS_CODE" "$STEP_CODE" "$JOB_ID" "$TARGET_PATH" 2>>"$LOG_FILE")"; then
    verify_adopted_frontend_tree || fail_job "existing frontend adoption type check failed"
    git -C "$WT" restore --worktree -- '*.tsbuildinfo' 2>/dev/null || true
    gate_result "ADOPT_EXISTING_SOURCE" "PASSED" "$ADOPTION_JSON"
    EXISTING_ADOPTED=1
  fi
fi
if [[ "$JOB_TYPE" =~ ^(COMPONENT_COMMON|CLASS_PROPERTY_COMMON|UI_QUALITY)$ ]]; then
  QUALITY_COVERAGE="$(psqlq -c "
    with routes as (
      select distinct lower(split_part(route,'?',1)) route_path
      from framework_process_step s
      cross join lateral unnest(array_remove(array[s.user_path,s.admin_path],null)) route
      where s.process_code='${PROCESS_CODE}' and s.step_code='${STEP_CODE}'
    ), coverage as (
      select r.route_path,bool_or(coalesce(c.common_assets_ready,false)) ready
      from routes r left join framework_common_design_asset_coverage c using(route_path)
      group by r.route_path
    )
    select count(*)||'|'||count(*) filter(where not ready)||'|'||coalesce(string_agg(route_path,',' order by route_path),'') from coverage;")"
  IFS='|' read -r QUALITY_ROUTE_COUNT QUALITY_UNCOVERED QUALITY_ROUTES <<<"$QUALITY_COVERAGE"
  if [[ "$QUALITY_ROUTE_COUNT" -gt 0 && "$QUALITY_UNCOVERED" -eq 0 ]]; then
    ADOPTION_ARTIFACT="docs/ai/85-adopted-quality/${PROCESS_CODE,,}/job-${JOB_ID}.md"
    mkdir -p "$WT/$(dirname "$ADOPTION_ARTIFACT")"
    cat >"$WT/$ADOPTION_ARTIFACT" <<EOF
# Existing common-design adoption: job ${JOB_ID}

- Process: ${PROCESS_CODE}
- Step: ${STEP_CODE}
- Quality type: ${JOB_TYPE}
- Covered routes: ${QUALITY_ROUTES}
- Approved requirement: $(jq -r '.requirement // ""' <<<"$SPEC")

Every user and administrator route bound to this process step is registered in
framework_common_design_asset_coverage with common_assets_ready=true.
The worker reused those shared theme, section, component, class, and responsive
assets instead of creating a page-specific duplicate.
EOF
    gate_result "ADOPT_EXISTING_SOURCE" "PASSED" "{\"strategy\":\"COMMON_ASSET_COVERAGE\",\"routes\":\"${QUALITY_ROUTES}\"}"
    EXISTING_ADOPTED=1
  fi
fi
DETERMINISTIC_HANDLED=0
DETERMINISTIC_RUNNER="$WT/ops/scripts/run-deterministic-development-job.sh"
if [ "$EXISTING_ADOPTED" = 1 ]; then
  gate_result "DETERMINISTIC_FIRST" "PASSED" "an exact existing implementation or registered common asset was adopted"
elif [ "$JOB_TYPE" = "DESIGN" ]; then
  gate_result "DETERMINISTIC_FIRST" "PASSED" "DESIGN is owned by the normalized contract renderer in this worker"
elif DETERMINISTIC_JSON="$(bash "$DETERMINISTIC_RUNNER" "$WT" "$PROCESS_CODE" "$STEP_CODE" "$JOB_ID" "$JOB_TYPE" "$TARGET_PATH" "$SPEC_FILE" "$SEARCH_CONTEXT" 2>>"$LOG_FILE")"; then
  DETERMINISTIC_HANDLED=1
  gate_result "DETERMINISTIC_FIRST" "PASSED" "$DETERMINISTIC_JSON"
  event "DETERMINISTIC_GENERATED" "RUNNING" "RUNNING" "$DETERMINISTIC_JSON"
else
  deterministic_code=$?
  if [ "$deterministic_code" -ne 3 ]; then
    fail_job "deterministic generator failed with code ${deterministic_code}"
  fi
  if [ "$ATTEMPT" -gt 1 ]; then
    fail_job "deterministic generation unavailable and the single automatic AI escalation was already consumed"
  fi
  # Gate results are constrained to PASSED, FAILED, or SKIPPED. A missing
  # deterministic owner is an intentional escalation path, not a gate failure.
  gate_result "DETERMINISTIC_FIRST" "SKIPPED" "AI escalation is permitted because no deterministic generator owns ${JOB_TYPE}"
  event "AI_ESCALATED" "RUNNING" "RUNNING" "{\"reason\":\"NO_DETERMINISTIC_GENERATOR\",\"jobType\":\"${JOB_TYPE}\"}"
fi
if [ "$JOB_TYPE" = "REFERENCE_ANALYSIS" ]; then
  INITIAL_MESSAGE="Open ${ARTIFACT_PATH} first and fill the reference analysis from targeted implementation evidence. Do not enumerate unrelated docs or references. Finish this bounded artifact now."
fi
if [ "$EXISTING_ADOPTED" = 1 ]; then
  KILO_CODE=0
elif [ "$DETERMINISTIC_HANDLED" = 1 ]; then
  KILO_CODE=0
elif [ "$JOB_TYPE" = "DESIGN" ]; then
  {
    printf '# %s / %s\n\n' "$PROCESS_CODE" "$STEP_CODE"
    printf '## Purpose and completion condition\n\n%s\n\n' "$(jq -r '.requirement' <<<"$SPEC")"
    jq -c '.designContracts[]' <<<"$SPEC" | while IFS= read -r contract; do
      audience="$(jq -r '.audience' <<<"$contract")"
      printf '## %s screen contract: %s\n\n' "$audience" "$(jq -r '.screenName' <<<"$contract")"
      printf -- '- Route: `%s`\n- Responsible actor: `%s`\n- Business purpose: %s\n- Entry condition: %s\n- Completion condition: %s\n\n' \
        "$(jq -r '.routePath' <<<"$contract")" "$(jq -r '.actorCode' <<<"$contract")" \
        "$(jq -r '.businessPurpose' <<<"$contract")" "$(jq -r '.entryCondition' <<<"$contract")" "$(jq -r '.exitCondition' <<<"$contract")"
      printf '### Layout, fields, and commands\n\n- KPI: %s\n- Sections: %s\n- Fields: %s\n- Commands and navigation: %s\n- Required UI states: %s\n\n' \
        "$(jq -r '.kpis' <<<"$contract")" "$(jq -r '.sections' <<<"$contract")" "$(jq -r '.fields' <<<"$contract")" \
        "$(jq -r '.commands' <<<"$contract")" "$(jq -r '.states' <<<"$contract")"
      printf '### API, transaction, and data contract\n\n- API: %s\n- Database entities: %s\n- Audit and evidence: %s\n- Security and tenant isolation: %s\n\n' \
        "$(jq -r '.apis' <<<"$contract")" "$(jq -r '.data' <<<"$contract")" "$(jq -r '.evidence' <<<"$contract")" "$(jq -r '.security' <<<"$contract")"
      printf '### Responsive and accessibility contract\n\n- Responsive behavior: %s\n- Accessibility: %s\n\n' \
        "$(jq -r '.responsive' <<<"$contract")" "$(jq -r '.accessibility' <<<"$contract")"
    done
    cat <<'EOF'
## State transition and concurrency rules

- The server validates tenantId, projectId, actorCode, commandCode, current state, and version before every transition.
- Repeated commands use an idempotency key and return the existing result without duplicating data or workflow events.
- Conflicting edits return a version conflict, preserve both audit contexts, and require the actor to reload before retrying.
- Completion opens only the next process task; rejection or correction follows the explicitly designed branch and never skips a required actor.

## Executable scenario matrix

- HAPPY_PATH: an authorized actor completes the entry conditions, executes the command, stores evidence, reaches the expected state, and opens the next task once.
- EXCEPTION: missing fields, invalid units, stale versions, and downstream failures remain on the current task with actionable errors and no partial commit.
- AUTHORITY: an actor without the required role receives 403; a forbidden attempt is recorded without changing business data.
- ISOLATION: another tenant or project cannot discover, search, update, export, or infer the protected object.
- RECOVERY: retry after a transaction, integration, or report failure produces no duplicate version, event, notification, or file.

## Frontend, backend, and integration delivery checklist

- Frontend implements the selected KRDS layout, all required states, responsive behavior, keyboard access, direct links, and next-task navigation.
- Backend implements the listed API and database contracts with transaction boundaries, object-level authorization, idempotency, optimistic locking, and immutable audit evidence.
- Contract tests bind every command to its actor and state transition. Browser tests cover both user and administrator routes at mobile, tablet, and desktop widths.
- Integration is complete only when the UI payload, API schema, persisted version, process event, notification, and displayed next task agree.
EOF
  } >"$WT/$ARTIFACT_PATH"
  KILO_CODE=0
elif [ "$JOB_TYPE" = "REFERENCE_ANALYSIS" ]; then
  cat >>"$WT/$ARTIFACT_PATH" <<EOF

## Automated reference refresh for job ${JOB_ID}

- Source commit: ${BASE_COMMIT}
- Process and step: ${PROCESS_CODE} / ${STEP_CODE}
- Approved specification: ${SPEC}
- Targeted repository search context: ${SEARCH_CONTEXT}
- Reuse decision: preserve the implemented source, use this evidence as the design baseline, and create a separate development job for every verified gap.
EOF
  KILO_CODE=0
else
  case "$JOB_TYPE" in
    FRONTEND_*|UI_QUALITY|COMPONENT_COMMON|CLASS_PROPERTY_COMMON) WORK_KIND="frontend" ;;
    BACKEND|API|API_QUALITY) WORK_KIND="backend-api" ;;
    DATABASE|DATABASE_QUALITY) WORK_KIND="database-migration" ;;
    TEST|ACTOR_TEST) WORK_KIND="scenario-test" ;;
    DEPLOYMENT) WORK_KIND="build-deploy" ;;
    PERFORMANCE|SEARCH) WORK_KIND="performance" ;;
    INTEGRATION|NOTIFICATION) WORK_KIND="integration" ;;
    *) WORK_KIND="actor-process" ;;
  esac
  FULL_TASK="$(cat "$WT/.automation-prompt.txt")

Immediate instruction: $INITIAL_MESSAGE"
  if HERMES_WORKDIR="$WT" HERMES_TASK_TIMEOUT="${HERMES_TASK_TIMEOUT:-2700}" HERMES_MAX_TURNS="${HERMES_MAX_TURNS:-30}" \
    bash "$PROJECT_WORK_RUNNER" --kind "$WORK_KIND" --mode implement --process "$PROCESS_CODE" \
      --acceptance "Complete approved job $JOB_ID for step $STEP_CODE and leave a bounded source or metadata change plus tests in the isolated worktree." \
      -- "$FULL_TASK" >"$LOG_FILE.hermes" 2>&1; then
    KILO_CODE=0
  else
    KILO_CODE=$?
  fi
fi
rm -f "$WT/.automation-prompt.txt" "$SPEC_FILE"
if [ "$KILO_CODE" -ne 0 ] && grep -Eq 'HTTP 429|Too Many Requests|status.?=.?429' "$LOG_FILE.hermes" 2>/dev/null; then
  defer_rate_limited_job
fi
[ "$KILO_CODE" -eq 0 ] || fail_job "Hermes project worker exited with code ${KILO_CODE}"

CHANGED="$(git -C "$WT" status --porcelain)"
if [ -z "$CHANGED" ] && [ "$EXISTING_ADOPTED" = 1 ]; then
  EVIDENCE="git:${BASE_COMMIT};adoption:${ADOPTION_ARTIFACT};log:${LOG_FILE}"
  psqlq -c "update framework_development_job set job_status='VERIFIED',result_json=\$json\${\"commit\":\"${BASE_COMMIT}\",\"strategy\":\"ADOPT_EXISTING\"}\$json\$,evidence_ref='${EVIDENCE}',rollback_ref='${BASE_COMMIT}',completed_at=current_timestamp,lease_token=null,lease_until=null,updated_at=current_timestamp where job_id=${JOB_ID} and lease_token='${LEASE_TOKEN}'; update framework_process_artifact set delivery_status='VERIFIED',evidence_ref='${EVIDENCE}',updated_at=current_timestamp where process_code='${PROCESS_CODE}' and step_code='${STEP_CODE}' and contract_ref='AUTO:${JOB_TYPE}';" >/dev/null
  event "VERIFIED" "RUNNING" "VERIFIED" "{\"commit\":\"${BASE_COMMIT}\",\"strategy\":\"ADOPT_EXISTING\"}"
  git -C "$ROOT_DIR" worktree remove --force "$WT" >/dev/null 2>&1 || true
  printf 'VERIFIED existing job=%s commit=%s\n' "$JOB_ID" "$BASE_COMMIT"
  exit 0
fi
if [ -z "$CHANGED" ] && [ "$JOB_TYPE" = "REFERENCE_ANALYSIS" ] && [ -n "${ARTIFACT_PATH:-}" ]; then
  cat >>"$WT/$ARTIFACT_PATH" <<EOF

## Automated contract refresh

- Source commit: ${BASE_COMMIT}
- Development job: ${JOB_ID}
- Process and step: ${PROCESS_CODE} / ${STEP_CODE}
- Search context: ${SEARCH_CONTEXT}
- Approved specification: ${SPEC}
EOF
  CHANGED="$(git -C "$WT" status --porcelain)"
fi
if [ -z "$CHANGED" ] && [[ "$JOB_TYPE" == FRONTEND_* ]]; then
  ADOPTION_JSON="$(python3 "$WT/ops/scripts/adopt-existing-frontend-job.py" "$WT" "$PROCESS_CODE" "$STEP_CODE" "$JOB_ID" "$TARGET_PATH")" \
    || fail_job "existing frontend adoption contract failed"
  verify_adopted_frontend_tree || fail_job "existing frontend adoption type check failed"
  gate_result "ADOPT_EXISTING_SOURCE" "PASSED" "$ADOPTION_JSON"
  CHANGED="$(git -C "$WT" status --porcelain)"
fi
[ -n "$CHANGED" ] || fail_job "AI completed without a source or metadata change"
if [ "$JOB_TYPE" = "DESIGN" ]; then
  DESIGN_WORDS="$(wc -w <"$WT/$ARTIFACT_PATH")"
  DESIGN_CONTENT_LINES="$(awk 'NF && $0 !~ /^#/ {count++} END {print count+0}' "$WT/$ARTIFACT_PATH")"
  if [ "$DESIGN_WORDS" -lt 220 ] || [ "$DESIGN_CONTENT_LINES" -lt 18 ] || \
     ! grep -Eq '/(admin/)?(emission|home/api)|API' "$WT/$ARTIFACT_PATH" || \
     ! grep -Eq 'HAPPY_PATH|정상.*예외|권한.*격리.*복구' "$WT/$ARTIFACT_PATH"; then
    fail_job "design artifact is structurally present but professionally incomplete: words=${DESIGN_WORDS}, content-lines=${DESIGN_CONTENT_LINES}"
  fi
fi
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
  printf '%s\n' "$CHANGED" | sed -E 's/^.. //' \
    | ROOT_DIR="$WT" bash "$WT/ops/scripts/java-fast-compile.sh" --stdin >>"$LOG_FILE" 2>&1 \
    || fail_job "backend compile failed"
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

# Parallel workers develop in isolated worktrees, then serialize only the short
# publication window. Rebase onto the latest verified main instead of discarding
# otherwise valid work merely because a sibling job published first.
exec 8>"${AI_PUBLISH_LOCK_FILE:-/tmp/resonance-ai-main-publish.lock}"
flock 8
git -C "$WT" fetch origin main >>"$LOG_FILE" 2>&1
if [ "$(git -C "$WT" rev-parse origin/main)" != "$BASE_COMMIT" ]; then
  git -C "$WT" rebase origin/main >>"$LOG_FILE" 2>&1 || fail_job "parallel publish rebase conflict"
  if printf '%s\n' "$CHANGED" | grep -q 'projects/carbonet-frontend/source/'; then
    "$ROOT_DIR/projects/carbonet-frontend/source/node_modules/.bin/tsc" -b "$WT/projects/carbonet-frontend/source/tsconfig.json" --pretty false >>"$LOG_FILE" 2>&1 || fail_job "frontend type check failed after rebase"
  fi
  if printf '%s\n' "$CHANGED" | grep -Eq '(^| )(apps|modules)/.*\.(java|kt|sql|xml)$'; then
    printf '%s\n' "$CHANGED" | sed -E 's/^.. //' \
      | ROOT_DIR="$WT" bash "$WT/ops/scripts/java-fast-compile.sh" --stdin >>"$LOG_FILE" 2>&1 \
      || fail_job "backend compile failed after rebase"
  fi
fi
RESULT_COMMIT="$(git -C "$WT" rev-parse HEAD)"
git -C "$WT" push origin "HEAD:main" >>"$LOG_FILE" 2>&1 || fail_job "main push rejected"
flock -u 8
exec 8>&-

METADATA_ONLY=0
if printf '%s\n' "$CHANGED" | sed -E 's/^.. //' | grep -Ev '^docs/ai/(80-adopted-existing|85-adopted-quality)/' | grep -q .; then
  METADATA_ONLY=0
else
  METADATA_ONLY=1
  exec 8>"${AI_PUBLISH_LOCK_FILE:-/tmp/resonance-ai-main-publish.lock}"
  flock 8
  git -C "$ROOT_DIR" fetch origin main >>"$LOG_FILE" 2>&1
  # The deployment service may temporarily update tracked runtime metadata in
  # the root checkout while a worker publishes from its isolated worktree.
  # Publication is already complete at this point, so a dirty root checkout is
  # not a job failure: defer synchronization to the canonical auto-deployer.
  if git -C "$ROOT_DIR" diff --quiet && git -C "$ROOT_DIR" diff --cached --quiet; then
    git -C "$ROOT_DIR" merge --ff-only origin/main >>"$LOG_FILE" 2>&1 \
      || printf 'metadata fast-forward deferred to auto-deploy\n' >>"$LOG_FILE"
  else
    printf 'root checkout busy; metadata synchronization deferred to auto-deploy\n' >>"$LOG_FILE"
  fi
  flock -u 8
  exec 8>&-
fi

for _ in $(seq 1 90); do
  DEPLOYED="$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || true)"
  READY="$(kubectl -n carbonet-prod get deploy carbonet-runtime -o jsonpath='{.status.readyReplicas}/{.spec.replicas}' 2>/dev/null || true)"
  if git -C "$ROOT_DIR" merge-base --is-ancestor "$RESULT_COMMIT" "$DEPLOYED" 2>/dev/null && [ "$READY" = "2/2" ] && runtime_is_healthy; then break; fi
  sleep 10
done
DEPLOYED="$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || true)"
git -C "$ROOT_DIR" merge-base --is-ancestor "$RESULT_COMMIT" "$DEPLOYED" 2>/dev/null || fail_job "result commit was not deployed"
runtime_is_healthy || fail_job "deployment health check failed"

EVIDENCE="git:${RESULT_COMMIT};log:${LOG_FILE}"
psqlq -c "update framework_development_job set job_status='VERIFIED',result_json=\$json\${\"commit\":\"${RESULT_COMMIT}\"}\$json\$,evidence_ref='${EVIDENCE}',rollback_ref='${BASE_COMMIT}',completed_at=current_timestamp,lease_token=null,lease_until=null,updated_at=current_timestamp where job_id=${JOB_ID} and lease_token='${LEASE_TOKEN}'; update framework_process_artifact set delivery_status='VERIFIED',evidence_ref='${EVIDENCE}',updated_at=current_timestamp where process_code='${PROCESS_CODE}' and step_code='${STEP_CODE}' and contract_ref='AUTO:${JOB_TYPE}';" >/dev/null
event "VERIFIED" "RUNNING" "VERIFIED" "{\"commit\":\"${RESULT_COMMIT}\"}"
git -C "$ROOT_DIR" worktree remove --force "$WT" >/dev/null 2>&1 || true
printf 'VERIFIED job=%s commit=%s\n' "$JOB_ID" "$RESULT_COMMIT"
