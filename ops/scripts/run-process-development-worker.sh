#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
DEPLOY_STATE_FILE="${CARBONET_DEPLOY_STATE_FILE:-/opt/resonance-data/deploy/carbonet-main-success.commit}"
DEPLOY_WORKTREE="${CARBONET_DEPLOY_WORKTREE:-$ROOT_DIR/var/deploy-worktrees/runtime-build}"
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
CANONICAL_TEMP_PATHS=()
CANONICAL_PUBLICATION_DB_ACTIVE=0
CANONICAL_PUBLICATION_DB_LOCKS_HELD=0
CANONICAL_PUBLICATION_DB_MAIN_LOCK_HELD=0
CANONICAL_PUBLICATION_DB_PROCESS_LOCK_HELD=0
CANONICAL_PUBLICATION_DB_PID=""
CANONICAL_PUBLICATION_DB_READ_FD=""
CANONICAL_PUBLICATION_DB_WRITE_FD=""
CANONICAL_PUBLICATION_PROCESS_CODE=""
CANONICAL_PUBLICATION_HOST_LOCK_HELD=0
AI_STAGED_PUBLICATION_BRANCH="${AI_STAGED_PUBLICATION_BRANCH:-}"
if [[ -n "$AI_STAGED_PUBLICATION_BRANCH" \
    && ! "$AI_STAGED_PUBLICATION_BRANCH" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]{0,120}$ ]]; then
  echo "AI_STAGED_PUBLICATION_BRANCH is invalid" >&2
  exit 2
fi
# The two-int advisory namespace keeps the fixed MAIN publication lock separate
# from the bigint process locks. 0x43414e4f / 0x4d41494e spells CANO / MAIN.
readonly CANONICAL_MAIN_PUBLICATION_LOCK_CLASS_ID=1128353359
readonly CANONICAL_MAIN_PUBLICATION_LOCK_OBJECT_ID=1296124238

register_canonical_temp_path() {
  local path="$1"
  [[ -n "$path" && -d "$path" && ! -L "$path" ]] || return 1
  CANONICAL_TEMP_PATHS+=("$path")
}

cleanup_canonical_temp_paths() {
  local path
  for path in "${CANONICAL_TEMP_PATHS[@]:-}"; do
    [[ -n "$path" ]] && rm -rf -- "$path"
  done
  CANONICAL_TEMP_PATHS=()
}

mkdir -p "$WORKTREE_ROOT" "$LOG_ROOT" "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

psqlq() {
  if [[ -n "${PROCESS_WORKER_PSQLQ_COMMAND:-}" ]]; then
    [[ -x "$PROCESS_WORKER_PSQLQ_COMMAND" ]] || {
      echo "PROCESS_WORKER_PSQLQ_COMMAND is not executable" >&2
      return 126
    }
    "$PROCESS_WORKER_PSQLQ_COMMAND" "$@"
    return
  fi
  kubectl -n "$K8S_NAMESPACE" exec "$POSTGRES_POD" -- env PGPASSWORD="$PGPASSWORD" \
    psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -X -q -v ON_ERROR_STOP=1 -At "$@"
}

canonical_publication_psql_session() {
  local application_name="${CANONICAL_PUBLICATION_DB_APPLICATION_NAME:-carbonet-canonical-publish-${CANONICAL_PUBLICATION_PROCESS_CODE}-$$}"
  local session_timeout_seconds="${CANONICAL_PUBLICATION_SESSION_TIMEOUT_SECONDS:-180}"
  local connect_timeout_seconds="${CANONICAL_PUBLICATION_CONNECT_TIMEOUT_SECONDS:-10}"
  application_name="${application_name:0:63}"
  [[ "$session_timeout_seconds" =~ ^[0-9]+$ && "$session_timeout_seconds" -ge 30 \
      && "$session_timeout_seconds" -le 300 \
      && "$connect_timeout_seconds" =~ ^[0-9]+$ && "$connect_timeout_seconds" -ge 1 \
      && "$connect_timeout_seconds" -le 30 ]] || return 1
  command -v timeout >/dev/null 2>&1 || return 1
  if [[ -n "${PROCESS_WORKER_PSQL_SESSION_COMMAND:-}" ]]; then
    [[ -x "$PROCESS_WORKER_PSQL_SESSION_COMMAND" ]] || {
      echo "PROCESS_WORKER_PSQL_SESSION_COMMAND is not executable" >&2
      return 126
    }
    exec timeout --foreground --signal=TERM --kill-after=5s "${session_timeout_seconds}s" \
      env PGAPPNAME="$application_name" PGCONNECT_TIMEOUT="$connect_timeout_seconds" \
      "$PROCESS_WORKER_PSQL_SESSION_COMMAND"
  fi
  if [[ -n "${PROCESS_WORKER_PSQLQ_COMMAND:-}" ]]; then
    [[ -x "$PROCESS_WORKER_PSQLQ_COMMAND" ]] || return 126
    exec timeout --foreground --signal=TERM --kill-after=5s "${session_timeout_seconds}s" \
      env PGAPPNAME="$application_name" PGCONNECT_TIMEOUT="$connect_timeout_seconds" \
      "$PROCESS_WORKER_PSQLQ_COMMAND"
  fi
  exec timeout --foreground --signal=TERM --kill-after=5s "${session_timeout_seconds}s" \
    kubectl -n "$K8S_NAMESPACE" exec -i "$POSTGRES_POD" -- env \
    PGPASSWORD="$PGPASSWORD" PGAPPNAME="$application_name" PGCONNECT_TIMEOUT="$connect_timeout_seconds" \
    psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -X -q -v ON_ERROR_STOP=1 -At
}

canonical_publication_close_db_session() {
  local pid="${CANONICAL_PUBLICATION_DB_PID:-}"
  if [[ -n "${CANONICAL_PUBLICATION_DB_WRITE_FD:-}" ]]; then
    exec {CANONICAL_PUBLICATION_DB_WRITE_FD}>&- || true
  fi
  if [[ -n "${CANONICAL_PUBLICATION_DB_READ_FD:-}" ]]; then
    exec {CANONICAL_PUBLICATION_DB_READ_FD}<&- || true
  fi
  if [[ "$pid" =~ ^[0-9]+$ ]]; then
    for _ in $(seq 1 10); do
      kill -0 "$pid" 2>/dev/null || break
      sleep .05
    done
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
    fi
    for _ in $(seq 1 20); do
      kill -0 "$pid" 2>/dev/null || break
      sleep .05
    done
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL "$pid" 2>/dev/null || true
    fi
    wait "$pid" 2>/dev/null || true
  fi
  CANONICAL_PUBLICATION_DB_ACTIVE=0
  CANONICAL_PUBLICATION_DB_LOCKS_HELD=0
  CANONICAL_PUBLICATION_DB_MAIN_LOCK_HELD=0
  CANONICAL_PUBLICATION_DB_PROCESS_LOCK_HELD=0
  CANONICAL_PUBLICATION_DB_PID=""
  CANONICAL_PUBLICATION_DB_READ_FD=""
  CANONICAL_PUBLICATION_DB_WRITE_FD=""
  CANONICAL_PUBLICATION_PROCESS_CODE=""
}

canonical_publication_db_roundtrip() {
  local sql="$1" marker="$2" timeout_seconds="${3:-${CANONICAL_PUBLICATION_ROUNDTRIP_TIMEOUT_SECONDS:-5}}" line
  [[ "$CANONICAL_PUBLICATION_DB_ACTIVE" = 1 \
      && -n "${CANONICAL_PUBLICATION_DB_READ_FD:-}" \
      && -n "${CANONICAL_PUBLICATION_DB_WRITE_FD:-}" \
      && "$timeout_seconds" =~ ^[0-9]+$ && "$timeout_seconds" -ge 1 \
      && "$timeout_seconds" -le 90 ]] || return 1
  printf '%s\n' "$sql" "select '${marker}';" \
    >&"$CANONICAL_PUBLICATION_DB_WRITE_FD" || return 1
  while IFS= read -r -t "$timeout_seconds" -u "$CANONICAL_PUBLICATION_DB_READ_FD" line; do
    [[ "$line" == "$marker" ]] && return 0
  done
  return 1
}

canonical_publication_open_db_session() {
  [[ "$CANONICAL_PUBLICATION_DB_ACTIVE" = 0 ]] || return 1
  coproc CANONICAL_PUBLICATION_PSQL_SESSION {
    canonical_publication_psql_session 2>>"${LOG_FILE:-/dev/null}"
  }
  local original_read_fd="${CANONICAL_PUBLICATION_PSQL_SESSION[0]}"
  local original_write_fd="${CANONICAL_PUBLICATION_PSQL_SESSION[1]}"
  CANONICAL_PUBLICATION_DB_PID="$CANONICAL_PUBLICATION_PSQL_SESSION_PID"
  exec {CANONICAL_PUBLICATION_DB_READ_FD}<&"$original_read_fd"
  exec {CANONICAL_PUBLICATION_DB_WRITE_FD}>&"$original_write_fd"
  CANONICAL_PUBLICATION_DB_ACTIVE=1
}

canonical_publication_acquire_db_locks() {
  local process_code="$1" lock_wait_seconds="${CANONICAL_PUBLICATION_LOCK_WAIT_SECONDS:-70}"
  [[ "$process_code" =~ ^[A-Z][A-Z0-9_:-]{1,79}$ ]] || return 1
  [[ "$lock_wait_seconds" =~ ^[0-9]+$ && "$lock_wait_seconds" -ge 1 \
      && "$lock_wait_seconds" -le 85 ]] || return 1
  CANONICAL_PUBLICATION_PROCESS_CODE="$process_code"
  canonical_publication_open_db_session || return 1
  local acquire_sql
  acquire_sql="
set statement_timeout='${lock_wait_seconds}s';
select pg_advisory_lock(${CANONICAL_MAIN_PUBLICATION_LOCK_CLASS_ID},${CANONICAL_MAIN_PUBLICATION_LOCK_OBJECT_ID});
select pg_advisory_lock(hashtextextended(
  'CANONICAL_PROCESS_PUBLICATION_V1:'||upper(btrim(\$process\$${process_code}\$process\$)),0));"
  if ! canonical_publication_db_roundtrip "$acquire_sql" \
      "CANONICAL_PUBLICATION_LOCKED_${$}" "$((lock_wait_seconds + 5))"; then
    canonical_publication_close_db_session
    return 1
  fi
  CANONICAL_PUBLICATION_DB_LOCKS_HELD=1
  CANONICAL_PUBLICATION_DB_MAIN_LOCK_HELD=1
  CANONICAL_PUBLICATION_DB_PROCESS_LOCK_HELD=1
}

canonical_publication_db_session_alive() {
  canonical_publication_db_roundtrip "select 1;" \
    "CANONICAL_PUBLICATION_ALIVE_${$}_${RANDOM}"
}

canonical_publication_release_db_locks() {
  local status=0 process_code="${CANONICAL_PUBLICATION_PROCESS_CODE:-}"
  if [[ "$CANONICAL_PUBLICATION_DB_ACTIVE" = 1 \
      && "$CANONICAL_PUBLICATION_DB_LOCKS_HELD" = 1 ]]; then
    local release_sql=""
    if [[ "$CANONICAL_PUBLICATION_DB_PROCESS_LOCK_HELD" = 1 ]]; then
      release_sql+="
select pg_advisory_unlock(hashtextextended(
  'CANONICAL_PROCESS_PUBLICATION_V1:'||upper(btrim(\$process\$${process_code}\$process\$)),0));"
    fi
    if [[ "$CANONICAL_PUBLICATION_DB_MAIN_LOCK_HELD" = 1 ]]; then
      release_sql+="
select pg_advisory_unlock(${CANONICAL_MAIN_PUBLICATION_LOCK_CLASS_ID},${CANONICAL_MAIN_PUBLICATION_LOCK_OBJECT_ID});"
    fi
    if [[ -n "$release_sql" ]] && ! canonical_publication_db_roundtrip "$release_sql" \
        "CANONICAL_PUBLICATION_UNLOCKED_${$}"; then
      status=1
    fi
    if [[ -n "${CANONICAL_PUBLICATION_DB_WRITE_FD:-}" ]]; then
      printf '\\q\n' >&"$CANONICAL_PUBLICATION_DB_WRITE_FD" 2>/dev/null || true
    fi
  fi
  canonical_publication_close_db_session
  return "$status"
}

canonical_publication_release_main_lock() {
  [[ "$CANONICAL_PUBLICATION_DB_ACTIVE" = 1 \
      && "$CANONICAL_PUBLICATION_DB_MAIN_LOCK_HELD" = 1 \
      && "$CANONICAL_PUBLICATION_DB_PROCESS_LOCK_HELD" = 1 ]] || return 1
  canonical_publication_db_roundtrip \
    "select pg_advisory_unlock(${CANONICAL_MAIN_PUBLICATION_LOCK_CLASS_ID},${CANONICAL_MAIN_PUBLICATION_LOCK_OBJECT_ID});" \
    "CANONICAL_MAIN_PUBLICATION_UNLOCKED_${$}" || return 1
  CANONICAL_PUBLICATION_DB_MAIN_LOCK_HELD=0
}

canonical_publication_begin() {
  local process_code="$1"
  [[ "$CANONICAL_PUBLICATION_HOST_LOCK_HELD" = 0 ]] || return 1
  exec 8>"${AI_PUBLISH_LOCK_FILE:-/tmp/resonance-ai-main-publish.lock}"
  flock -w "${CANONICAL_PUBLICATION_LOCK_WAIT_SECONDS:-70}" 8 \
    || { exec 8>&-; return 1; }
  CANONICAL_PUBLICATION_HOST_LOCK_HELD=1
  if ! canonical_publication_acquire_db_locks "$process_code"; then
    flock -u 8 || true
    exec 8>&-
    CANONICAL_PUBLICATION_HOST_LOCK_HELD=0
    return 1
  fi
}

canonical_publication_complete_push() {
  local status=0
  canonical_publication_release_main_lock || status=1
  if [[ "$CANONICAL_PUBLICATION_HOST_LOCK_HELD" = 1 ]]; then
    flock -u 8 || status=1
    exec 8>&-
    CANONICAL_PUBLICATION_HOST_LOCK_HELD=0
  fi
  return "$status"
}

canonical_publication_end() {
  local status=0
  canonical_publication_release_db_locks || status=1
  if [[ "$CANONICAL_PUBLICATION_HOST_LOCK_HELD" = 1 ]]; then
    flock -u 8 || status=1
    exec 8>&-
    CANONICAL_PUBLICATION_HOST_LOCK_HELD=0
  fi
  return "$status"
}

canonical_process_job_head_is_current() {
  [[ "${JOB_ID:-}" =~ ^[0-9]+$ \
      && "${LEASE_TOKEN:-}" =~ ^[0-9a-fA-F-]{36}$ \
      && "${PROCESS_CODE:-}" =~ ^[A-Z][A-Z0-9_:-]{1,79}$ \
      && "${SPEC_B64:-}" =~ ^[A-Za-z0-9+/]+={0,2}$ ]] || return 1
  jq -e --arg process "$PROCESS_CODE" '
    .algorithm=="CANONICAL_PROCESS_PUBLICATION_V1" and
    .activationPolicy=="SOURCE_IMMEDIATE_V1" and
    .generatorRequired==true and .processCode==$process and
    (.sourceHash|type=="string" and test("^[0-9a-f]{64}$")) and
    .processInputHash==.sourceHash and
    (.designSetHash|type=="string" and test("^[0-9a-f]{64}$")) and
    (.designCatalogHash|type=="string" and test("^[0-9a-f]{64}$")) and
    (.designCatalogTextHash|type=="string" and test("^[0-9a-f]{64}$")) and
    (.endpointCatalogHash|type=="string" and test("^[0-9a-f]{64}$")) and
    (.endpointCatalogTextHash|type=="string" and test("^[0-9a-f]{64}$")) and
    (.coordinatorStep|type=="string" and length>0) and
    .stepCode==.coordinatorStep and
    (.processStepCount|type=="number" and floor==. and .>0) and
    (.generationReadyStepCount|type=="number" and floor==. and .>0) and
    (.endpointExpected|type=="number" and floor==. and .>=0)
  ' <<<"$SPEC" >/dev/null 2>&1 || return 1
  [[ "$(psqlq -c "
    with job as materialized (
      select j.*,framework_try_jsonb(j.specification_json,'{}'::jsonb) spec
        from framework_development_job j
       where j.job_id=${JOB_ID}
    ), generation_head as materialized (
      select framework_process_generation_input(j.process_code) head from job j
    ), coverage as materialized (
      select count(*)::integer eligible_count,
             count(*) filter(where spec.source_hash=head.head->>'processInputHash')::integer exact_source_count
        from job j cross join generation_head head
        join framework_step_execution_spec spec on spec.process_code=j.process_code
       where spec.design_status='DESIGN_COMPLETE'
         and spec.approval_status='APPROVED'
         and spec.generation_status in('READY','GENERATED')
    )
    select count(*)
      from job j cross join generation_head generation cross join coverage
     where j.job_status='RUNNING'
       and j.lease_token=\$lease\$${LEASE_TOKEN}\$lease\$
       and j.process_code=\$process\$${PROCESS_CODE}\$process\$
       and j.job_type='FULL_STACK_GENERATION'
       and j.job_group_code=j.process_code||'_CANONICAL_PUBLICATION'
       and j.spec=convert_from(decode('${SPEC_B64}','base64'),'UTF8')::jsonb
       and generation.head->>'schema'='carbonet.process-generation-head/v1'
       and generation.head->>'activationPolicy'='SOURCE_IMMEDIATE_V1'
       and generation.head->>'processCode'=j.process_code
       and j.step_code=generation.head->>'coordinatorStep'
       and j.spec->>'algorithm'='CANONICAL_PROCESS_PUBLICATION_V1'
       and j.spec->>'activationPolicy'=generation.head->>'activationPolicy'
       and j.spec->>'processCode'=generation.head->>'processCode'
       and j.spec->>'stepCode'=generation.head->>'coordinatorStep'
       and j.spec->>'coordinatorStep'=generation.head->>'coordinatorStep'
       and j.spec->>'sourceHash'=generation.head->>'processInputHash'
       and j.spec->>'processInputHash'=generation.head->>'processInputHash'
       and j.spec->>'designSetHash'=generation.head->>'designSetHash'
       and j.spec->>'designCatalogHash'=generation.head->>'designCatalogHash'
       and j.spec->>'designCatalogTextHash'=generation.head->>'designCatalogTextHash'
       and j.spec->>'endpointCatalogHash'=generation.head->>'endpointCatalogHash'
       and j.spec->>'endpointCatalogTextHash'=generation.head->>'endpointCatalogTextHash'
       and j.spec->'processStepCount'=generation.head->'processStepCount'
       and j.spec->'generationReadyStepCount'=generation.head->'generationReadyStepCount'
       and j.spec->'endpointExpected'=generation.head->'processEndpointExpected'
       and coverage.eligible_count=(generation.head->>'generationReadyStepCount')::integer
       and coverage.exact_source_count=coverage.eligible_count;")" == "1" ]]
}

transition_job_to_failed_if_owned() {
  local job_id="$1" lease_token="$2" worker_id="$3" message="$4" rollback_ref="$5" log_file="$6"
  [[ "$job_id" =~ ^[0-9]+$ && "$lease_token" =~ ^[0-9a-fA-F-]{36}$ ]] || return 1
  psqlq -c "with failed as (
    update framework_development_job
    set job_status='FAILED',last_error=\$err\$${message}\$err\$,
        rollback_ref=nullif(\$rollback\$${rollback_ref}\$rollback\$,''),
        lease_token=null,lease_until=null,updated_at=current_timestamp
    where job_id=${job_id} and job_status='RUNNING'
      and lease_token=\$lease\$${lease_token}\$lease\$
    returning job_id
  )
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select job_id,'FAILED','RUNNING','FAILED',\$worker\$${worker_id}\$worker\$,
    jsonb_build_object('log',\$log\$${log_file}\$log\$)::text
  from failed;" >/dev/null
}

canonical_diff_line_count() {
  local worktree="$1" ref="${2:-}" temp index output
  if [[ -n "$ref" ]]; then
    git -C "$worktree" diff --numstat "${ref}^" "$ref" |
      awk '$1=="-" || $2=="-" {exit 2} {total+=$1+$2} END {if (!failed) print total+0}'
    return
  fi
  temp="$(mktemp -d "${TMPDIR:-/tmp}/canonical-diff-index.XXXXXX")" || return 1
  index="$temp/index"
  if ! GIT_INDEX_FILE="$index" git -C "$worktree" read-tree HEAD \
      || ! GIT_INDEX_FILE="$index" git -C "$worktree" add -A \
      || ! output="$(GIT_INDEX_FILE="$index" git -C "$worktree" diff --cached --numstat HEAD)"; then
    rm -rf -- "$temp"
    return 1
  fi
  rm -rf -- "$temp"
  awk '$1=="-" || $2=="-" {exit 2} {total+=$1+$2} END {print total+0}' <<<"$output"
}

canonical_commit_status() {
  local worktree="$1" ref="$2"
  git -C "$worktree" diff --name-status --no-renames "${ref}^" "$ref" |
    awk -F '\t' '
      NF==2 && $1 ~ /^[AMD]$/ { printf "%s  %s\n",$1,$2; next }
      { exit 2 }
    '
}

validate_canonical_generated_diff() {
  local worktree="$1" process_code="$2" changed="$3" diff_lines="$4" base_ref="${5:-HEAD}"
  [[ -n "$changed" ]] || return 1
  printf '%s\n' "$changed" |
    bash "$worktree/ops/scripts/validate-deterministic-fullstack-diff.sh" \
      "$process_code" "$diff_lines" "$worktree" "$base_ref"
}

compile_canonical_generated_endpoint() {
  local worktree="$1" process_code="$2"
  local source_dir="$worktree/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/$process_code/src/main/java"
  # Compile the exact current-process source plus every already-committed
  # canonical process. This catches duplicate classes, Spring bean names and
  # route-level Java conflicts introduced by a concurrent process publication.
  # The Gradle source-set validator rechecks every manifest, release hash and
  # Java byte before javac sees it.
  local endpoint_root="$worktree/projects/carbonet-backend-metadata/process-runtime/generated-endpoints"
  [[ -d "$endpoint_root" && ! -L "$endpoint_root" ]] || return 1
  local -a source_dirs=()
  local process_dir candidate candidate_process current_seen=0
  while IFS= read -r -d '' process_dir; do
    [[ -d "$process_dir" && ! -L "$process_dir" ]] || return 1
    candidate_process="$(basename "$process_dir")"
    [[ "$candidate_process" =~ ^[A-Z][A-Z0-9_]{1,79}$ ]] || return 1
    candidate="$process_dir/src/main/java"
    [[ -d "$candidate" && ! -L "$candidate" ]] || return 1
    source_dirs+=("$candidate")
    [[ "$candidate" != "$source_dir" ]] || current_seen=1
  done < <(find "$endpoint_root" -mindepth 1 -maxdepth 1 -print0 | sort -z)
  (( current_seen == 1 && ${#source_dirs[@]} > 0 )) || return 1
  local joined_sources
  joined_sources="$(IFS=:; printf '%s' "${source_dirs[*]}")"
  if [[ -n "${CANONICAL_ENDPOINT_COMPILE_COMMAND:-}" ]]; then
    [[ -x "$CANONICAL_ENDPOINT_COMPILE_COMMAND" ]] || return 1
    CANONICAL_ENDPOINT_SOURCE_DIRS="$joined_sources" \
      "$CANONICAL_ENDPOINT_COMPILE_COMMAND" "$worktree" "$process_code"
    return
  fi
  (
    cd "$worktree"
    CANONICAL_ENDPOINT_SOURCE_DIRS="$joined_sources" \
      bash ./gradlew --project-dir "$worktree" \
        :modules:resonance-common:carbonet-common-core:compileJava \
        --no-daemon --console=plain --no-build-cache --rerun-tasks
  )
}

canonical_generated_worktree_fingerprint() {
  local worktree="$1"
  python3 - "$worktree" <<'PY'
import hashlib
import os
import sys
from pathlib import Path

root = Path(sys.argv[1]).absolute()
generated = root / "projects/carbonet-backend-metadata/process-runtime"
digest = hashlib.sha256()
for lane in ("generated", "design-preview", "generated-endpoints"):
    base = generated / lane
    if not base.exists():
        continue
    if base.is_symlink() or not base.is_dir():
        raise SystemExit(f"canonical generated root is unsafe: {base}")
    for directory, names, files in os.walk(base, followlinks=False):
        directory_path = Path(directory)
        for name in names:
            if (directory_path / name).is_symlink():
                raise SystemExit("canonical generated tree contains a directory symlink")
        for name in files:
            path = directory_path / name
            if path.is_symlink() or not path.is_file():
                raise SystemExit("canonical generated tree contains a non-regular file")
            relative = path.relative_to(root).as_posix().encode()
            digest.update(relative); digest.update(b"\0")
            digest.update(hashlib.sha256(path.read_bytes()).digest())
print(digest.hexdigest())
PY
}

compile_canonical_generated_endpoint_immutable() {
  local worktree="$1" process_code="$2" before after
  before="$(canonical_generated_worktree_fingerprint "$worktree")" || return 1
  compile_canonical_generated_endpoint "$worktree" "$process_code" || return 1
  after="$(canonical_generated_worktree_fingerprint "$worktree")" || return 1
  [[ "$before" == "$after" ]]
}

canonical_runtime_mappings_json() {
  if [[ -n "${CANONICAL_RUNTIME_MAPPINGS_COMMAND:-}" ]]; then
    [[ -x "$CANONICAL_RUNTIME_MAPPINGS_COMMAND" ]] || return 1
    "$CANONICAL_RUNTIME_MAPPINGS_COMMAND"
    return
  fi
  if [[ -n "${CANONICAL_RUNTIME_MAPPINGS_FILE:-}" ]]; then
    [[ -f "$CANONICAL_RUNTIME_MAPPINGS_FILE" && ! -L "$CANONICAL_RUNTIME_MAPPINGS_FILE" ]] || return 1
    cat -- "$CANONICAL_RUNTIME_MAPPINGS_FILE"
    return
  fi
  local pod
  pod="$(kubectl --request-timeout=5s -n "$K8S_NAMESPACE" get pods \
    -l 'app=carbonet-runtime' --field-selector=status.phase=Running -o json \
    | jq -er '[.items[] | select(.metadata.deletionTimestamp == null)
        | select(any(.status.conditions[]?; .type == "Ready" and .status == "True"))]
        | sort_by(.metadata.creationTimestamp) | last | .metadata.name')" || return 1
  [[ "$pod" =~ ^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$ ]] || return 1
  kubectl --request-timeout=15s -n "$K8S_NAMESPACE" exec "$pod" -c carbonet-runtime -- \
    curl -fsS --max-time 10 http://127.0.0.1:8080/actuator/mappings
}

canonical_deployed_commit_value() {
  local deployed=""
  if [[ -n "${CANONICAL_DEPLOYED_COMMIT_COMMAND:-}" ]]; then
    [[ -x "$CANONICAL_DEPLOYED_COMMIT_COMMAND" ]] || return 1
    deployed="$($CANONICAL_DEPLOYED_COMMIT_COMMAND)" || return 1
  elif [[ -n "${CANONICAL_DEPLOYED_COMMIT_SEQUENCE_FILE:-}" ]]; then
    [[ -f "$CANONICAL_DEPLOYED_COMMIT_SEQUENCE_FILE" \
        && ! -L "$CANONICAL_DEPLOYED_COMMIT_SEQUENCE_FILE" ]] || return 1
    local sequence current rest
    sequence="$(cat -- "$CANONICAL_DEPLOYED_COMMIT_SEQUENCE_FILE")" || return 1
    current="${sequence%%$'\n'*}"
    if [[ "$sequence" == *$'\n'* ]]; then
      rest="${sequence#*$'\n'}"
      [[ -n "$rest" ]] || rest="$current"
    else
      rest="$current"
    fi
    printf '%s\n' "$rest" >"$CANONICAL_DEPLOYED_COMMIT_SEQUENCE_FILE" || return 1
    deployed="$current"
  elif [[ -n "${CANONICAL_DEPLOYED_COMMIT:-}" ]]; then
    deployed="$CANONICAL_DEPLOYED_COMMIT"
  elif [[ -r "$DEPLOY_STATE_FILE" ]]; then
    deployed="$(tr -d '[:space:]' <"$DEPLOY_STATE_FILE")"
  fi
  if [[ ! "$deployed" =~ ^[0-9a-f]{40}$ ]] \
      && [[ -d "$DEPLOY_WORKTREE/.git" || -f "$DEPLOY_WORKTREE/.git" ]]; then
    deployed="$(git -C "$DEPLOY_WORKTREE" rev-parse HEAD 2>/dev/null || true)"
  fi
  [[ "$deployed" =~ ^[0-9a-f]{40}$ ]] || return 1
  printf '%s\n' "$deployed"
}

verify_canonical_runtime_bindings() {
  local manifest="$1" mappings_file="$2"
  python3 - "$manifest" "$mappings_file" <<'PY'
import json
import re
import sys
from pathlib import Path

manifest_path, mappings_path = map(Path, sys.argv[1:])
sha = re.compile(r"^[0-9a-f]{64}$")
operation_key = re.compile(r"^[A-Za-z][A-Za-z0-9_]{1,79}$")
java_class = re.compile(r"^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)+$")
route_path = re.compile(r"^/[A-Za-z0-9_{}./-]+$")
exact_keys = {"operationKey", "method", "path", "handlerClass", "handlerMethod", "designHash", "endpointHash"}

try:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    mappings = json.loads(mappings_path.read_text(encoding="utf-8"))
except (OSError, UnicodeError, json.JSONDecodeError) as exc:
    raise SystemExit(f"invalid canonical runtime binding input: {exc}")
operations = manifest.get("operations")
if manifest.get("schema") != "carbonet.generated-endpoints/v1" or not isinstance(operations, list) or not operations:
    raise SystemExit("canonical manifest operations are required")
if operations != sorted(operations, key=lambda item: item.get("operationKey", "").casefold()):
    raise SystemExit("canonical manifest operations are not casefold-sorted")

expected = {}
for operation in operations:
    if not isinstance(operation, dict) or set(operation) != exact_keys:
        raise SystemExit("canonical manifest operation keys are not exact")
    values = tuple(operation[key] for key in exact_keys)
    if not all(isinstance(value, str) for value in values):
        raise SystemExit("canonical manifest operation values must be strings")
    key = operation["operationKey"].casefold()
    java_name = "".join(part[:1].upper() + part[1:]
                        for part in re.split(r"[^A-Za-z0-9]+", operation["operationKey"]) if part)
    expected_class = f"egovframework.com.generated.canonical.{java_name}Controller"
    variables = re.findall(r"\{[^{}]*\}", operation["path"])
    if (not operation_key.fullmatch(operation["operationKey"]) or key in expected
            or operation["method"] != "POST"
            or not route_path.fullmatch(operation["path"])
            or operation["path"].startswith("//") or "//" in operation["path"]
            or any(part in {"", ".", ".."} for part in operation["path"].split("/")[1:])
            or variables != ["{executionId}"] or operation["path"].count("{") != 1
            or operation["path"].count("}") != 1
            or not java_class.fullmatch(operation["handlerClass"])
            or operation["handlerClass"] != expected_class
            or operation["handlerMethod"] != "execute"
            or not sha.fullmatch(operation["designHash"])
            or not sha.fullmatch(operation["endpointHash"])):
        raise SystemExit("canonical manifest operation is invalid")
    expected[key] = operation

try:
    servlet_mappings = mappings["contexts"]
except (KeyError, TypeError):
    raise SystemExit("Spring actuator mappings shape is invalid")
actual = []
for context in servlet_mappings.values():
    dispatchers = context.get("mappings", {}).get("dispatcherServlets", {}) if isinstance(context, dict) else {}
    for rows in dispatchers.values():
        if not isinstance(rows, list):
            continue
        for row in rows:
            details = row.get("details", {}) if isinstance(row, dict) else {}
            handler = details.get("handlerMethod", {}) if isinstance(details, dict) else {}
            conditions = details.get("requestMappingConditions", {}) if isinstance(details, dict) else {}
            methods = conditions.get("methods", []) if isinstance(conditions, dict) else []
            patterns = conditions.get("patterns", []) if isinstance(conditions, dict) else []
            if not isinstance(handler, dict) or not isinstance(methods, list) or not isinstance(patterns, list):
                continue
            for method in methods:
                for path in patterns:
                    actual.append((method, path, handler.get("className"), handler.get("name")))

expected_signatures = {
    (operation["method"], operation["path"], operation["handlerClass"], operation["handlerMethod"])
    for operation in expected.values()
}
managed_classes = {operation["handlerClass"] for operation in expected.values()}
for operation in expected.values():
    signature = (operation["method"], operation["path"], operation["handlerClass"], operation["handlerMethod"])
    count = actual.count(signature)
    if count != 1:
        raise SystemExit(f"canonical runtime binding mismatch: {operation['operationKey']} count={count}")
    # No second Spring handler may bind the same method/path. That would make
    # the generated mapping ambiguous even if the expected handler exists.
    route_bindings = [item for item in actual if item[:2] == signature[:2]]
    if len(route_bindings) != 1:
        raise SystemExit(f"canonical runtime binding is not exclusive: {operation['operationKey']}")

# A stale mapping on a manifest-owned controller can survive with a different
# route and would otherwise be invisible when checking only expected routes.
# Other processes intentionally share the canonical Java package, so ownership
# is the exact manifest handler class rather than the whole package.
for binding in actual:
    handler_class = binding[2]
    if handler_class in managed_classes and binding not in expected_signatures:
        raise SystemExit(f"unexpected canonical runtime binding: {binding[0]} {binding[1]}")

print(json.dumps({"status": "PASS", "operationCount": len(expected)}, sort_keys=True, separators=(",", ":")))
PY
}

verify_canonical_runtime_release() {
  local manifest="$1" output mappings result
  mappings="$(mktemp "${TMPDIR:-/tmp}/canonical-runtime-mappings.XXXXXX.json")" || return 1
  if canonical_runtime_mappings_json >"$mappings"; then
    result="$(verify_canonical_runtime_bindings "$manifest" "$mappings")" || {
      rm -f -- "$mappings"
      return 1
    }
  else
    rm -f -- "$mappings"
    return 1
  fi
  rm -f -- "$mappings"
  printf '%s\n' "$result"
}

verify_stable_canonical_runtime_deployment() {
  local worktree="$1" result_commit="$2" process_code="$3" step_code="$4"
  local attempt before after tree mappings result mapping_ok
  for attempt in 1 2 3; do
    before="$(canonical_deployed_commit_value)" || return 1
    canonical_process_tree_unchanged "$worktree" "$result_commit" "$before" "$process_code" || return 1
    tree="$(mktemp -d "${TMPDIR:-/tmp}/canonical-stable-deployed.XXXXXX")" || return 1
    mappings="$(mktemp "${TMPDIR:-/tmp}/canonical-stable-mappings.XXXXXX.json")" || {
      rm -rf -- "$tree"; return 1;
    }
    mapping_ok=0
    result=""
    if canonical_commit_evidence_files "$worktree" "$before" "$process_code" "$step_code" "$tree" \
        && canonical_runtime_mappings_json >"$mappings" \
        && result="$(verify_canonical_runtime_bindings "$tree/manifest.json" "$mappings")"; then
      mapping_ok=1
    fi
    after="$(canonical_deployed_commit_value || true)"
    rm -rf -- "$tree" "$mappings"
    [[ "$after" =~ ^[0-9a-f]{40}$ ]] || return 1
    if [[ "$before" != "$after" ]]; then
      continue
    fi
    (( mapping_ok == 1 )) || return 1
    jq -c --arg deployedCommit "$before" '. + {deployedCommit:$deployedCommit}' <<<"$result"
    return
  done
  return 1
}

canonical_deployed_marker_is() {
  local expected="$1" current
  [[ "$expected" =~ ^[0-9a-f]{40}$ ]] || return 1
  current="$(canonical_deployed_commit_value)" || return 1
  [[ "$current" == "$expected" ]]
}

canonical_deploy_elapsed_seconds() {
  local started="${CANONICAL_DEPLOY_STARTED_EPOCH_SECONDS:-}" finished
  finished="$(date +%s)" || return 1
  [[ "$started" =~ ^[0-9]+$ && "$finished" =~ ^[0-9]+$ && "$finished" -ge "$started" ]] \
    || return 1
  printf '%s\n' "$((finished-started))"
}

revalidate_canonical_commit_after_rebase() {
  local ref="${1:-HEAD}" changed lines
  changed="$(canonical_commit_status "$WT" "$ref")" \
    || fail_job "canonical post-rebase change inventory failed"
  lines="$(canonical_diff_line_count "$WT" "$ref")" \
    || fail_job "canonical post-rebase diff line calculation failed"
  validate_canonical_generated_diff "$WT" "$PROCESS_CODE" "$changed" "$lines" "${ref}^" \
    >>"$LOG_FILE" 2>&1 || fail_job "canonical post-rebase manifest diff validation failed"
  compile_canonical_generated_endpoint_immutable "$WT" "$PROCESS_CODE" >>"$LOG_FILE" 2>&1 \
    || fail_job "canonical generated endpoint compile failed after rebase"
  canonical_worktree_paths_clean "$WT" "$PROCESS_CODE" \
    || fail_job "canonical compile mutated generated publication paths"
  gate_result "CANONICAL_ENDPOINT_COMPILE" "PASSED" \
    "{\"processCode\":\"$PROCESS_CODE\",\"phase\":\"POST_REBASE\"}"
}

canonical_generation_evidence() {
  local package_file="$1" release_file="$2" process_code="$3" step_code="$4"
  python3 - "$package_file" "$release_file" "$process_code" "$step_code" <<'PY'
import hashlib
import json
import re
import sys
from pathlib import Path

package_path, release_path = map(Path, sys.argv[1:3])
process_code, step_code = sys.argv[3:5]
sha256 = re.compile(r"^[0-9a-f]{64}$")
source_fingerprint = re.compile(r"^(?:[0-9a-f]{32}|[0-9a-f]{64})$")
code = re.compile(r"^[A-Z0-9_]+$")

def stable(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

def verified_document(path, hash_key):
    value = json.loads(path.read_text(encoding="utf-8"))
    expected = value.get(hash_key)
    if not isinstance(expected, str) or not sha256.fullmatch(expected):
        raise SystemExit(f"{path}: invalid {hash_key}")
    unhashed = dict(value)
    del unhashed[hash_key]
    actual = hashlib.sha256(stable(unhashed).encode()).hexdigest()
    if actual != expected:
        raise SystemExit(f"{path}: {hash_key} mismatch")
    return value

if not code.fullmatch(process_code) or not code.fullmatch(step_code):
    raise SystemExit("canonical process/step code is invalid")
package = verified_document(package_path, "packageHash")
release = verified_document(release_path, "releaseHash")
package_index = verified_document(package_path.parent / "index.json", "manifestHash")
endpoint_manifest = verified_document(release_path.parent / "manifest.json", "bundleHash")
if package.get("process", {}).get("code") != process_code or package.get("step", {}).get("code") != step_code:
    raise SystemExit("canonical package process/step mismatch")
if release.get("schema") != "carbonet.canonical-full-stack-release/v1":
    raise SystemExit("canonical release schema mismatch")
if release.get("activationPolicy") != "SOURCE_IMMEDIATE_V1":
    raise SystemExit("canonical release activationPolicy mismatch")
if not isinstance(package.get("sourceHash"), str) or not source_fingerprint.fullmatch(package["sourceHash"]):
    raise SystemExit("canonical package sourceHash is invalid")
if not isinstance(package.get("packageHash"), str) or not sha256.fullmatch(package["packageHash"]):
    raise SystemExit("canonical package packageHash is invalid")
for key in ("designCatalogHash", "endpointCatalogHash", "releaseHash"):
    if not isinstance(release.get(key), str) or not sha256.fullmatch(release[key]):
        raise SystemExit(f"canonical release {key} is invalid")
if (package.get("canonicalCatalogHash") != release["designCatalogHash"]
        or package_index.get("canonicalCatalogHash") != release["designCatalogHash"]
        or package_index.get("manifestHash") != release.get("packageManifestHash")):
    raise SystemExit("canonical package manifest is not bound to the release")
matching_packages = [item for item in package_index.get("packages", [])
                     if item.get("processCode") == process_code and item.get("stepCode") == step_code]
if len(matching_packages) != 1 or matching_packages[0].get("packageHash") != package["packageHash"]:
    raise SystemExit("exact package hash is absent from the canonical manifest")
if (endpoint_manifest.get("catalogHash") != release["endpointCatalogHash"]
        or endpoint_manifest.get("bundleHash") != release.get("endpointBundleHash")):
    raise SystemExit("canonical endpoint manifest is not bound to the release")
evidence = {
    "schema": "carbonet.canonical-generation-evidence/v1",
    "activationPolicy": release["activationPolicy"],
    "processCode": process_code,
    "stepCode": step_code,
    "sourceHash": package["sourceHash"],
    "packageHash": package["packageHash"],
    "designCatalogHash": release["designCatalogHash"],
    "endpointCatalogHash": release["endpointCatalogHash"],
    "releaseHash": release["releaseHash"],
}
composite_keys = {"compositeAuthoritySetHash", "compositeArtifactManifestHash"}
if composite_keys & set(release):
    if not composite_keys.issubset(release):
        raise SystemExit("canonical composite release binding is partial")
    composite_path = package_path.parent / "composite" / "manifest.json"
    composite_bytes = composite_path.read_bytes()
    composite = json.loads(composite_bytes.decode("utf-8"))
    if (package_index.get("compositeAuthoritySetHash") != release["compositeAuthoritySetHash"]
            or package_index.get("compositeArtifactManifest", {}).get("sha256") != release["compositeArtifactManifestHash"]
            or hashlib.sha256(composite_bytes).hexdigest() != release["compositeArtifactManifestHash"]
            or composite.get("compositeAuthoritySetHash") != release["compositeAuthoritySetHash"]):
        raise SystemExit("canonical composite artifact is not bound to the release")
    expected_manifest = composite.get("manifestHash")
    unsigned = dict(composite); unsigned.pop("manifestHash", None)
    if hashlib.sha256(stable(unsigned).encode()).hexdigest() != expected_manifest:
        raise SystemExit("canonical composite manifestHash mismatch")
    evidence.update({
        "compositeAuthoritySetHash": release["compositeAuthoritySetHash"],
        "compositeArtifactManifestHash": release["compositeArtifactManifestHash"],
    })
print(stable(evidence))
PY
}

canonical_commit_evidence_files() {
  local worktree="$1" result_commit="$2" process_code="$3" step_code="$4" output_dir="$5"
  local runtime_base="projects/carbonet-backend-metadata/process-runtime/generated/$process_code"
  local endpoint_base="projects/carbonet-backend-metadata/process-runtime/generated-endpoints/$process_code"
  local relative destination
  [[ "$result_commit" =~ ^[0-9a-f]{40}$ && "$process_code" =~ ^[A-Z0-9_]+$ \
      && "$step_code" =~ ^[A-Z0-9_]+$ && -d "$output_dir" && ! -L "$output_dir" ]] || return 1
  local -a relatives=(
    "$runtime_base/${process_code}__${step_code}.json"
    "$runtime_base/index.json"
    "$endpoint_base/manifest.json"
    "$endpoint_base/full-stack-release.json"
  )
  for relative in "${relatives[@]}"; do
    destination="$output_dir/$(basename "$relative")"
    git -C "$worktree" cat-file -e "${result_commit}:${relative}" 2>/dev/null || return 1
    [[ "$(git -C "$worktree" cat-file -t "${result_commit}:${relative}" 2>/dev/null)" == blob ]] || return 1
    git -C "$worktree" show "${result_commit}:${relative}" >"$destination" || return 1
    [[ -f "$destination" && ! -L "$destination" ]] || return 1
  done
  if git -C "$worktree" show "${result_commit}:${runtime_base}/index.json" |
      jq -e 'has("compositeArtifactManifest")' >/dev/null 2>&1; then
    relative="$runtime_base/composite/manifest.json"
    destination="$output_dir/composite/manifest.json"
    mkdir -p "$output_dir/composite" || return 1
    git -C "$worktree" cat-file -e "${result_commit}:${relative}" 2>/dev/null || return 1
    git -C "$worktree" show "${result_commit}:${relative}" >"$destination" || return 1
    [[ -f "$destination" && ! -L "$destination" ]] || return 1
  fi
}

canonical_worktree_paths_clean() {
  local worktree="$1" process_code="$2"
  local runtime_path="projects/carbonet-backend-metadata/process-runtime/generated"
  local preview_path="projects/carbonet-backend-metadata/process-runtime/design-preview"
  local endpoint_path="projects/carbonet-backend-metadata/process-runtime/generated-endpoints"
  [[ "$process_code" =~ ^[A-Z0-9_]+$ ]] || return 1
  [[ -z "$(git -C "$worktree" status --porcelain=v1 --untracked-files=all -- \
    "$runtime_path" "$preview_path" "$endpoint_path")" ]]
}

canonical_process_tree_unchanged() {
  local worktree="$1" result_commit="$2" deployed="$3" process_code="$4"
  [[ "$result_commit" =~ ^[0-9a-f]{40}$ && "$deployed" =~ ^[0-9a-f]{40}$ \
      && "$process_code" =~ ^[A-Z0-9_]+$ ]] || return 1
  git -C "$worktree" cat-file -e "${result_commit}^{commit}" 2>/dev/null || return 1
  git -C "$worktree" cat-file -e "${deployed}^{commit}" 2>/dev/null || return 1
  git -C "$worktree" merge-base --is-ancestor "$result_commit" "$deployed" || return 1
  git -C "$worktree" diff --quiet "$result_commit" "$deployed" -- \
    "projects/carbonet-backend-metadata/process-runtime/generated/$process_code" \
    "projects/carbonet-backend-metadata/process-runtime/design-preview/$process_code" \
    "projects/carbonet-backend-metadata/process-runtime/generated-endpoints/$process_code"
}

canonical_result_parent() {
  local worktree="$1" result_commit="$2" parent parents
  [[ "$result_commit" =~ ^[0-9a-f]{40}$ ]] || return 1
  parents="$(git -C "$worktree" rev-list --parents -n 1 "$result_commit" 2>/dev/null)" || return 1
  read -r _ parent extra <<<"$parents"
  [[ -z "${extra:-}" && "$parent" =~ ^[0-9a-f]{40}$ ]] || return 1
  git -C "$worktree" merge-base --is-ancestor "$parent" "$result_commit" || return 1
  printf '%s\n' "$parent"
}

verify_canonical_commit_published() {
  local worktree="$1" result_commit="$2"
  [[ "$result_commit" =~ ^[0-9a-f]{40}$ ]] || return 1
  git -C "$worktree" fetch --quiet origin main
  local remote_main
  remote_main="$(git -C "$worktree" rev-parse origin/main)"
  [[ "$remote_main" =~ ^[0-9a-f]{40}$ ]] || return 1
  git -C "$worktree" merge-base --is-ancestor "$result_commit" "$remote_main"
}

finalize_canonical_generation() {
  local job_id="$1" lease_token="$2" worker_id="$3" result_commit="$4"
  local rollback_commit="$5" process_code="$6" step_code="$7" log_file="$8" evidence_json="$9"
  local activation_policy source_hash package_hash design_hash endpoint_hash release_hash evidence_ref readback
  local composite_set_hash composite_manifest_hash composite_sql_guard
  activation_policy="$(jq -er '.activationPolicy' <<<"$evidence_json")"
  source_hash="$(jq -er '.sourceHash' <<<"$evidence_json")"
  package_hash="$(jq -er '.packageHash' <<<"$evidence_json")"
  design_hash="$(jq -er '.designCatalogHash' <<<"$evidence_json")"
  endpoint_hash="$(jq -er '.endpointCatalogHash' <<<"$evidence_json")"
  release_hash="$(jq -er '.releaseHash' <<<"$evidence_json")"
  composite_set_hash="$(jq -r '.compositeAuthoritySetHash // ""' <<<"$evidence_json")"
  composite_manifest_hash="$(jq -r '.compositeArtifactManifestHash // ""' <<<"$evidence_json")"
  [[ -z "$composite_set_hash$composite_manifest_hash" \
      || "$composite_set_hash$composite_manifest_hash" =~ ^[0-9a-f]{128}$ ]] || return 1
  composite_sql_guard=""
  if [[ -n "$composite_set_hash" ]]; then
    composite_sql_guard="or job_spec->>'compositeAuthoritySetHash' is distinct from \$composite\$${composite_set_hash}\$composite\$"
  fi
  [[ "$activation_policy" == "SOURCE_IMMEDIATE_V1" \
      && "$job_id" =~ ^[0-9]+$ && "$lease_token" =~ ^[0-9a-fA-F-]{36}$ \
      && "$result_commit" =~ ^[0-9a-f]{40}$ && "$rollback_commit" =~ ^[0-9a-f]{40}$ \
      && "$source_hash" =~ ^([0-9a-f]{32}|[0-9a-f]{64})$ \
      && "$package_hash$design_hash$endpoint_hash$release_hash" =~ ^[0-9a-f]{256}$ ]] || return 1
  local canonical_git_worktree="${CANONICAL_WORKTREE:-${WT:-$ROOT_DIR}}"
  [[ "$rollback_commit" == "$(canonical_result_parent "$canonical_git_worktree" "$result_commit")" ]] || return 1
  evidence_ref="git:${result_commit};release:${release_hash};log:${log_file}"

  local finalize_sql readback_sql
  finalize_sql="
-- CANONICAL_FINALIZE_AFTER_PUSH_DEPLOY_HEALTH
begin;
do \$finalize\$
declare changed integer; current_source text; current_design text; current_design_set text; job_spec jsonb;
begin
  select source_hash into current_source
  from framework_step_execution_spec
  where process_code=\$process\$${process_code}\$process\$
    and step_code=\$step\$${step_code}\$step\$
    and design_status='DESIGN_COMPLETE' and approval_status='APPROVED'
  for update;
  if current_source is distinct from \$source\$${source_hash}\$source\$ then
    raise exception 'STALE_CANONICAL_SOURCE_HASH';
  end if;
  select framework_try_jsonb(specification_json) into job_spec
  from framework_development_job where job_id=${job_id} for update;
  if job_spec->>'algorithm' is distinct from 'CANONICAL_PROCESS_PUBLICATION_V1'
     or job_spec->>'activationPolicy' is distinct from 'SOURCE_IMMEDIATE_V1'
     or job_spec->>'sourceHash' is distinct from \$source\$${source_hash}\$source\$
     or job_spec->>'processInputHash' is distinct from \$source\$${source_hash}\$source\$
     or job_spec->>'designCatalogHash' is distinct from \$hash\$${design_hash}\$hash\$
     or job_spec->>'endpointCatalogHash' is distinct from \$hash\$${endpoint_hash}\$hash\$
     ${composite_sql_guard} then
    raise exception 'CANONICAL_SOURCE_IMMEDIATE_RECEIPT_MISMATCH';
  end if;
  if job_spec ? 'designHash' then
    if job_spec->>'sourceHash' is distinct from \$source\$${source_hash}\$source\$ then
      raise exception 'STALE_CANONICAL_JOB_SOURCE_HASH';
    end if;
    select framework_canonical_screen_bundle(
      \$process\$${process_code}\$process\$,\$step\$${step_code}\$step\$,
      job_spec->>'audience',job_spec->>'routePath')->>'designHash'
      into current_design;
    if current_design is distinct from job_spec->>'designHash' then
      raise exception 'STALE_CANONICAL_DESIGN_HASH';
    end if;
    with blueprint_candidates as materialized (
      select b.process_code,b.step_code,upper(b.audience) audience,
             lower(split_part(b.route_path,'?',1)) route_path,b.blueprint_id,c.contract_id,
             (b.transition_status='CONTRACT_LINKED' and lower(b.source_reference) in(
               'framework_professional_screen_contract:'||c.contract_id,
               'professional_screen_contract:'||c.contract_id)) explicit_link,
             count(*) over(partition by c.contract_id) candidate_count,
             count(*) filter(where b.transition_status='CONTRACT_LINKED'
               and lower(b.source_reference) in(
                 'framework_professional_screen_contract:'||c.contract_id,
                 'professional_screen_contract:'||c.contract_id))
               over(partition by c.contract_id) explicit_count
      from framework_screen_blueprint b
      join framework_professional_screen_contract c
        on c.process_code=b.process_code and c.step_code=b.step_code
       and upper(c.audience)=upper(b.audience)
       and lower(split_part(c.route_path,'?',1))=lower(split_part(b.route_path,'?',1))
      where b.process_code=\$process\$${process_code}\$process\$
        and b.step_code=\$step\$${step_code}\$step\$ and b.validation_status='VALID'
    ), exact_identity as (
      select process_code,step_code,audience,route_path,
             upper(process_code)||'|'||upper(step_code)||'|'||audience||'|'||route_path screen_key
        from blueprint_candidates
       where (explicit_count=1 and explicit_link)
          or (explicit_count=0 and candidate_count=1)
       group by process_code,step_code,audience,route_path
      having count(distinct blueprint_id)=1 and count(distinct contract_id)=1
    )
    select encode(sha256(convert_to(string_agg(screen_key||E'\\x1f'||
      (framework_canonical_screen_bundle(process_code,step_code,audience,route_path)->>'designHash'),
      E'\\n' order by screen_key),'UTF8')),'hex') into current_design_set
    from exact_identity;
    if current_design_set is distinct from job_spec->>'designSetHash' then
      raise exception 'STALE_CANONICAL_DESIGN_SET_HASH';
    end if;
  end if;

  if exists (select 1 from framework_development_job where job_id=${job_id} and job_status in ('VERIFIED','COMPLETED')) then
    if not exists (
      select 1 from framework_development_job
      where job_id=${job_id} and job_status='VERIFIED' and quality_status='VERIFIED'
        and framework_try_jsonb(result_json)->>'commit'=\$commit\$${result_commit}\$commit\$
        and rollback_ref=\$rollback\$${rollback_commit}\$rollback\$
        and framework_try_jsonb(result_json)->'canonicalGeneration'=\$payload\$${evidence_json}\$payload\$::jsonb
    ) then
      raise exception 'CANONICAL_TERMINAL_EVIDENCE_IMMUTABLE';
    end if;
  else
    update framework_development_job
    set job_status='VERIFIED',quality_status='VERIFIED',
        result_json=(coalesce(framework_try_jsonb(result_json),'{}'::jsonb)||
          jsonb_build_object('commit',\$commit\$${result_commit}\$commit\$,
            'canonicalGeneration',\$payload\$${evidence_json}\$payload\$::jsonb))::text,
        evidence_ref=\$ref\$${evidence_ref}\$ref\$,rollback_ref=\$rollback\$${rollback_commit}\$rollback\$,
        completed_at=current_timestamp,lease_token=null,lease_until=null,updated_at=current_timestamp
    where job_id=${job_id} and job_status='RUNNING' and lease_token=\$lease\$${lease_token}\$lease\$;
    get diagnostics changed=row_count;
    if changed<>1 then raise exception 'CANONICAL_JOB_LEASE_LOST'; end if;
  end if;

  update framework_step_execution_spec
  set generation_status='GENERATED',updated_at=current_timestamp
  where process_code=\$process\$${process_code}\$process\$
    and step_code=\$step\$${step_code}\$step\$
    and source_hash=\$source\$${source_hash}\$source\$;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'CANONICAL_SPEC_FINALIZE_LOST'; end if;
  update framework_process_artifact
  set delivery_status='VERIFIED',evidence_ref=\$ref\$${evidence_ref}\$ref\$,updated_at=current_timestamp
  where process_code=\$process\$${process_code}\$process\$
    and step_code=\$step\$${step_code}\$step\$
    and contract_ref=\$contract\$AUTO:${JOB_TYPE:-FULL_STACK_GENERATION}\$contract\$;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'CANONICAL_ARTIFACT_FINALIZE_LOST'; end if;
  insert into framework_development_job_event(job_id,event_type,from_status,to_status,worker_id,detail_json)
  select ${job_id},'CANONICAL_RELEASE_FINALIZED','RUNNING','VERIFIED',
    \$worker\$${worker_id}\$worker\$,\$payload\$${evidence_json}\$payload\$
  where not exists (
    select 1 from framework_development_job_event
    where job_id=${job_id} and event_type='CANONICAL_RELEASE_FINALIZED'
      and framework_try_jsonb(detail_json)=\$payload\$${evidence_json}\$payload\$::jsonb
  );
end \$finalize\$;
commit;"
  readback_sql="
-- CANONICAL_FINALIZE_READBACK
select count(*) from framework_development_job j
join framework_step_execution_spec s on s.process_code=\$process\$${process_code}\$process\$
  and s.step_code=\$step\$${step_code}\$step\$
where j.job_id=${job_id} and j.job_status='VERIFIED' and j.quality_status='VERIFIED'
  and s.generation_status='GENERATED' and s.source_hash=\$source\$${source_hash}\$source\$
  and framework_try_jsonb(j.result_json)->>'commit'=\$commit\$${result_commit}\$commit\$
  and j.rollback_ref=\$rollback\$${rollback_commit}\$rollback\$
  and framework_try_jsonb(j.result_json)->'canonicalGeneration'=\$payload\$${evidence_json}\$payload\$::jsonb
  and (select count(*) from framework_development_job_event e
       where e.job_id=j.job_id and e.event_type='CANONICAL_RELEASE_FINALIZED'
         and framework_try_jsonb(e.detail_json)=\$payload\$${evidence_json}\$payload\$::jsonb)=1
  and (select count(*) from framework_process_artifact a
       where a.process_code=\$process\$${process_code}\$process\$
         and a.step_code=\$step\$${step_code}\$step\$
         and a.contract_ref=\$contract\$AUTO:${JOB_TYPE:-FULL_STACK_GENERATION}\$contract\$
         and a.delivery_status='VERIFIED'
         and a.evidence_ref=\$ref\$${evidence_ref}\$ref\$)=1;"

  for finalize_attempt in 1 2 3; do
    psqlq -c "$finalize_sql" >/dev/null 2>&1 || true
    readback="$(psqlq -c "$readback_sql" 2>/dev/null || true)"
    [[ "$readback" == "1" ]] && return 0
    if (( finalize_attempt < 3 )); then
      sleep "$(( ${CANONICAL_FINALIZE_RETRY_SLEEP_SECONDS:-1} * finalize_attempt ))"
    fi
  done
  return 1
}

if [[ "${1:-}" == "--canonical-failure-transition-contract" ]]; then
  : "${CANONICAL_JOB_ID:?CANONICAL_JOB_ID is required}"
  : "${CANONICAL_LEASE_TOKEN:?CANONICAL_LEASE_TOKEN is required}"
  transition_job_to_failed_if_owned "$CANONICAL_JOB_ID" "$CANONICAL_LEASE_TOKEN" \
    "${CANONICAL_WORKER_ID:-contract-test}" "${CANONICAL_FAILURE_MESSAGE:-contract failure}" \
    "${CANONICAL_ROLLBACK_COMMIT:-}" "${CANONICAL_LOG_FILE:-contract-test.log}"
  exit $?
elif [[ "${1:-}" == "--canonical-publication-lock-contract" ]]; then
  : "${CANONICAL_JOB_ID:?CANONICAL_JOB_ID is required}"
  : "${CANONICAL_LEASE_TOKEN:?CANONICAL_LEASE_TOKEN is required}"
  : "${CANONICAL_PROCESS_CODE:?CANONICAL_PROCESS_CODE is required}"
  : "${CANONICAL_SPECIFICATION_B64:?CANONICAL_SPECIFICATION_B64 is required}"
  JOB_ID="$CANONICAL_JOB_ID"
  LEASE_TOKEN="$CANONICAL_LEASE_TOKEN"
  PROCESS_CODE="$CANONICAL_PROCESS_CODE"
  SPEC_B64="$CANONICAL_SPECIFICATION_B64"
  SPEC="$(printf '%s' "$SPEC_B64" | base64 -d)"
  LOG_FILE="${CANONICAL_LOG_FILE:-/dev/null}"
  canonical_publication_contract_interrupt() {
    trap - INT TERM
    canonical_publication_end || true
    exit 143
  }
  trap canonical_publication_contract_interrupt INT TERM
  canonical_publication_begin "$PROCESS_CODE" || exit 1
  if ! canonical_publication_db_session_alive \
      || ! canonical_process_job_head_is_current; then
    canonical_publication_end || true
    exit 1
  fi
  if [[ -n "${CANONICAL_PUBLICATION_READY_FILE:-}" ]]; then
    : >"$CANONICAL_PUBLICATION_READY_FILE"
  fi
  if [[ -n "${CANONICAL_PUBLICATION_WAIT_FIFO:-}" ]]; then
    [[ -p "$CANONICAL_PUBLICATION_WAIT_FIFO" ]] || {
      canonical_publication_end || true
      exit 1
    }
    exec 7<>"$CANONICAL_PUBLICATION_WAIT_FIFO"
    IFS= read -r -u 7 _
    exec 7>&-
  fi
  contract_publish_succeeded=0
  for contract_publish_attempt in 1 2 3; do
    if ! canonical_publication_db_session_alive \
        || ! canonical_process_job_head_is_current; then
      break
    fi
    if [[ -z "${CANONICAL_PUBLICATION_PUSH_COMMAND:-}" ]] \
        || { [[ -x "$CANONICAL_PUBLICATION_PUSH_COMMAND" ]] \
             && "$CANONICAL_PUBLICATION_PUSH_COMMAND" "$PROCESS_CODE" "$contract_publish_attempt"; }; then
      contract_publish_succeeded=1
      break
    fi
    sleep "${CANONICAL_PUBLICATION_RETRY_SLEEP_SECONDS:-0}"
  done
  canonical_publication_db_session_alive || contract_publish_succeeded=0
  if [[ "$contract_publish_succeeded" = 1 ]]; then
    canonical_publication_complete_push || contract_publish_succeeded=0
  fi
  if [[ "$contract_publish_succeeded" = 1 \
      && -n "${CANONICAL_PUBLICATION_AFTER_PUSH_READY_FILE:-}" ]]; then
    : >"$CANONICAL_PUBLICATION_AFTER_PUSH_READY_FILE"
  fi
  if [[ "$contract_publish_succeeded" = 1 \
      && -n "${CANONICAL_PUBLICATION_AFTER_PUSH_WAIT_FIFO:-}" ]]; then
    [[ -p "$CANONICAL_PUBLICATION_AFTER_PUSH_WAIT_FIFO" ]] \
      || contract_publish_succeeded=0
    if [[ "$contract_publish_succeeded" = 1 ]]; then
      exec 7<>"$CANONICAL_PUBLICATION_AFTER_PUSH_WAIT_FIFO"
      IFS= read -r -u 7 _
      exec 7>&-
    fi
  fi
  canonical_publication_end || contract_publish_succeeded=0
  trap - INT TERM
  [[ "$contract_publish_succeeded" = 1 ]]
  exit $?
elif [[ "${1:-}" == "--canonical-prepublish-contract" ]]; then
  : "${CANONICAL_WORKTREE:?CANONICAL_WORKTREE is required}"
  : "${CANONICAL_PROCESS_CODE:?CANONICAL_PROCESS_CODE is required}"
  contract_changed="$(git -C "$CANONICAL_WORKTREE" status --porcelain=v1 --untracked-files=all)"
  contract_lines="$(canonical_diff_line_count "$CANONICAL_WORKTREE")"
  validate_canonical_generated_diff "$CANONICAL_WORKTREE" "$CANONICAL_PROCESS_CODE" \
    "$contract_changed" "$contract_lines"
  compile_canonical_generated_endpoint_immutable "$CANONICAL_WORKTREE" "$CANONICAL_PROCESS_CODE"
  if [[ -n "${CANONICAL_CONTRACT_REBASE_COMMAND:-}" ]]; then
    [[ -x "$CANONICAL_CONTRACT_REBASE_COMMAND" ]]
    "$CANONICAL_CONTRACT_REBASE_COMMAND" "$CANONICAL_WORKTREE" "$CANONICAL_PROCESS_CODE"
    contract_changed="$(git -C "$CANONICAL_WORKTREE" status --porcelain=v1 --untracked-files=all)"
    contract_lines="$(canonical_diff_line_count "$CANONICAL_WORKTREE")"
    validate_canonical_generated_diff "$CANONICAL_WORKTREE" "$CANONICAL_PROCESS_CODE" \
      "$contract_changed" "$contract_lines"
    compile_canonical_generated_endpoint_immutable "$CANONICAL_WORKTREE" "$CANONICAL_PROCESS_CODE"
  fi
  if [[ -n "${CANONICAL_CONTRACT_PUSH_COMMAND:-}" ]]; then
    [[ -x "$CANONICAL_CONTRACT_PUSH_COMMAND" ]]
    "$CANONICAL_CONTRACT_PUSH_COMMAND" "$CANONICAL_WORKTREE" "$CANONICAL_PROCESS_CODE"
  fi
  exit 0
elif [[ "${1:-}" == "--canonical-runtime-binding-contract" ]]; then
  : "${CANONICAL_ENDPOINT_MANIFEST:?CANONICAL_ENDPOINT_MANIFEST is required}"
  : "${CANONICAL_RUNTIME_MAPPINGS_FILE:?CANONICAL_RUNTIME_MAPPINGS_FILE is required}"
  verify_canonical_runtime_bindings "$CANONICAL_ENDPOINT_MANIFEST" "$CANONICAL_RUNTIME_MAPPINGS_FILE"
  exit $?
elif [[ "${1:-}" == "--canonical-finalize-contract" ]]; then
  : "${CANONICAL_PACKAGE_FILE:?CANONICAL_PACKAGE_FILE is required}"
  : "${CANONICAL_RELEASE_FILE:?CANONICAL_RELEASE_FILE is required}"
  : "${CANONICAL_RESULT_COMMIT:?CANONICAL_RESULT_COMMIT is required}"
  : "${CANONICAL_JOB_ID:?CANONICAL_JOB_ID is required}"
  : "${CANONICAL_LEASE_TOKEN:?CANONICAL_LEASE_TOKEN is required}"
  : "${CANONICAL_PROCESS_CODE:?CANONICAL_PROCESS_CODE is required}"
  : "${CANONICAL_STEP_CODE:?CANONICAL_STEP_CODE is required}"
  contract_tree="$(mktemp -d "${TMPDIR:-/tmp}/canonical-finalize-tree.XXXXXX")" || exit 1
  register_canonical_temp_path "$contract_tree" || exit 1
  trap cleanup_canonical_temp_paths EXIT
  canonical_worktree_paths_clean "${CANONICAL_WORKTREE:?CANONICAL_WORKTREE is required}" "$CANONICAL_PROCESS_CODE" || {
    echo 'canonical worktree paths are dirty after publication' >&2
    exit 1
  }
  canonical_commit_evidence_files "$CANONICAL_WORKTREE" "$CANONICAL_RESULT_COMMIT" \
    "$CANONICAL_PROCESS_CODE" "$CANONICAL_STEP_CODE" "$contract_tree" || exit 1
  contract_evidence="$(canonical_generation_evidence \
    "$contract_tree/${CANONICAL_PROCESS_CODE}__${CANONICAL_STEP_CODE}.json" \
    "$contract_tree/full-stack-release.json" "$CANONICAL_PROCESS_CODE" "$CANONICAL_STEP_CODE")"
  contract_binding="$(verify_stable_canonical_runtime_deployment \
    "$CANONICAL_WORKTREE" "$CANONICAL_RESULT_COMMIT" \
    "$CANONICAL_PROCESS_CODE" "$CANONICAL_STEP_CODE")" || {
    echo 'canonical deployed marker/mappings proof did not stabilize' >&2
    exit 1
  }
  contract_stable_deployed="$(jq -er '.deployedCommit' <<<"$contract_binding")" || exit 1
  [[ "${CANONICAL_DEPLOY_ELAPSED_SECONDS:?CANONICAL_DEPLOY_ELAPSED_SECONDS is required}" =~ ^[0-9]+$ \
      && "$CANONICAL_DEPLOY_ELAPSED_SECONDS" -le 60 ]] || {
    echo 'canonical deployment exceeded the 60-second terminal SLO' >&2
    exit 1
  }
  verify_canonical_commit_published "${CANONICAL_WORKTREE:?CANONICAL_WORKTREE is required}" "$CANONICAL_RESULT_COMMIT" || {
    echo 'canonical result commit is not published on origin/main' >&2
    exit 1
  }
  canonical_deployed_marker_is "$contract_stable_deployed" || {
    echo 'canonical deployed marker changed before terminal finalization' >&2
    exit 1
  }
  contract_rollback="$(canonical_result_parent "$CANONICAL_WORKTREE" "$CANONICAL_RESULT_COMMIT")" || exit 1
  finalize_canonical_generation "$CANONICAL_JOB_ID" "$CANONICAL_LEASE_TOKEN" "${CANONICAL_WORKER_ID:-contract-test}" \
    "$CANONICAL_RESULT_COMMIT" "$contract_rollback" "$CANONICAL_PROCESS_CODE" "$CANONICAL_STEP_CODE" \
    "${CANONICAL_LOG_FILE:-contract-test.log}" "$contract_evidence"
  exit $?
fi
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
deployed_commit() {
  canonical_deployed_commit_value
}
deployment_is_ready() {
  local counts desired updated ready available
  counts="$(kubectl -n "$K8S_NAMESPACE" get deploy carbonet-runtime \
    -o jsonpath='{.spec.replicas}|{.status.updatedReplicas}|{.status.readyReplicas}|{.status.availableReplicas}' \
    2>/dev/null || true)"
  IFS='|' read -r desired updated ready available <<<"$counts"
  [[ "$desired" =~ ^[0-9]+$ && "$desired" -gt 0 ]] || return 1
  [[ "$updated" = "$desired" && "$ready" = "$desired" && "$available" = "$desired" ]]
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
       and coalesce(running_job.target_path,'')<>''
       and (
         running_job.target_path=coalesce(j.target_path,'')
         or (
           running_job.target_path like 'canonical://%'
           and coalesce(j.target_path,'') like 'canonical://%'
           and split_part(running_job.target_path,'/',3)=split_part(j.target_path,'/',3)
         )
       )
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

wake_composite_live_smoke_postdeploy() {
  [[ "${JOB_TYPE:-}" =~ ^FULL_STACK(_GENERATION)?$ ]] || return 0
  # This hook is called only after the canonical deploy marker was rechecked
  # and the generation finalization committed. The durable timer remains the
  # authoritative fallback when this unprivileged best-effort wake is denied.
  systemctl --no-block start resonance-composite-live-smoke.service >/dev/null 2>&1 \
    || printf 'composite live smoke wake deferred to durable timer\n' >>"$LOG_FILE"
}
gate_result() {
  local gate="$1" result="$2" summary="${3:-}"
  summary="${summary//$'\n'/ }"
  summary="${summary:0:1000}"
  psqlq -c "insert into framework_development_job_gate_result(job_id,gate_code,result,summary,evidence_ref) values(${JOB_ID},'${gate}','${result}',\$summary\$${summary}\$summary\$,'${LOG_FILE}');" >/dev/null || true
}
fail_job() {
  trap - ERR
  trap - INT TERM
  canonical_publication_end || true
  cleanup_canonical_temp_paths
  local message="${1:-worker failed}"
  message="${message//$'\n'/ }"
  message="${message:0:1800}"
  transition_job_to_failed_if_owned "$JOB_ID" "$LEASE_TOKEN" "$WORKER_ID" \
    "$message" "${BASE_COMMIT:-}" "$LOG_FILE" || true
  git -C "$ROOT_DIR" worktree remove --force "$WT" >/dev/null 2>&1 || true
  exit 1
}
defer_rate_limited_job() {
  trap - ERR
  trap - INT TERM
  canonical_publication_end || true
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
exec 5>"${AI_GIT_FETCH_LOCK_FILE:-/tmp/resonance-ai-git-fetch.lock}"
flock 5
SOURCE_BRANCH="${AI_STAGED_PUBLICATION_BRANCH:-main}"
git -C "$ROOT_DIR" fetch origin "$SOURCE_BRANCH" >>"$LOG_FILE" 2>&1
flock -u 5
exec 5>&-
BASE_COMMIT="$(git -C "$ROOT_DIR" rev-parse "origin/$SOURCE_BRANCH")"
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

# Jobs created before requirement_text became part of every generated
# specification can still be valid approved work. Resolve the missing value
# from the governed process-step contract so every deterministic generator and
# AI fallback receives the same authoritative requirement. Do not overwrite a
# requirement already captured on the job.
if ! jq -e '.requirement | type == "string" and length > 0' <<<"$SPEC" >/dev/null 2>&1; then
  LEGACY_REQUIREMENT="$(psqlq -c "
    select coalesce(nullif(requirement_text,''),nullif(step_name,''),'')
    from framework_process_step
    where process_code='${PROCESS_CODE}' and step_code='${STEP_CODE}'
    limit 1;")"
  if [ -z "$LEGACY_REQUIREMENT" ]; then
    fail_job "governed process-step requirement is missing for legacy specification"
  fi
  SPEC="$(jq -c --arg requirement "$LEGACY_REQUIREMENT" '. + {requirement:$requirement}' <<<"$SPEC")"
  event "LEGACY_REQUIREMENT_ENRICHED" "RUNNING" "RUNNING" \
    "{\"source\":\"framework_process_step\",\"reason\":\"requirement missing\"}"
fi

# DESIGN jobs created before the professional screen contract upgrade do not
# contain designContracts. Enrich those immutable legacy specifications from
# the governed DB contract at execution time instead of failing or producing an
# empty design artifact. New specifications pass through unchanged.
if [[ "$JOB_TYPE" == "DESIGN" ]] && ! jq -e '.designContracts | type == "array" and length > 0' <<<"$SPEC" >/dev/null 2>&1; then
  ENRICHED_DESIGN_SPEC="$(psqlq -c "
    select json_build_object(
      'requirement',coalesce(nullif(s.requirement_text,''),s.step_name||' 업무를 전문적으로 완료하고 검증 가능한 산출물을 생성한다.'),
      'designContracts',coalesce(json_agg(json_build_object(
        'audience',c.audience,'routePath',c.route_path,'screenName',c.screen_name,
        'actorCode',c.actor_code,'businessPurpose',c.business_purpose,
        'entryCondition',c.entry_condition,'exitCondition',c.exit_condition,
        'kpis',c.kpi_contract::json,'sections',c.section_contract::json,
        'fields',c.field_contract::json,'commands',c.command_contract::json,
        'states',c.state_contract::json,'apis',c.api_contract::json,
        'data',c.data_contract::json,'evidence',c.evidence_contract::json,
        'responsive',c.responsive_contract,'accessibility',c.accessibility_contract,
        'security',c.security_contract
      ) order by c.audience,c.route_path) filter(where c.contract_id is not null),'[]'::json)
    )::text
    from framework_process_step s
    left join framework_professional_screen_contract c
      on c.process_code=s.process_code and c.step_code=s.step_code
    where s.process_code='${PROCESS_CODE}' and s.step_code='${STEP_CODE}'
    group by s.requirement_text,s.step_name;")"
  if ! jq -e '.designContracts | type == "array" and length > 0' <<<"$ENRICHED_DESIGN_SPEC" >/dev/null 2>&1; then
    psqlq -c "select framework_ensure_step_screen_contract('${PROCESS_CODE}','${STEP_CODE}','PROCESS_DEVELOPMENT_WORKER');" >/dev/null
    ENRICHED_DESIGN_SPEC="$(psqlq -c "
      select json_build_object('requirement',coalesce(nullif(s.requirement_text,''),s.step_name||' 업무를 전문적으로 완료하고 검증 가능한 산출물을 생성한다.'),
        'designContracts',json_agg(json_build_object(
          'audience',c.audience,'routePath',c.route_path,'screenName',c.screen_name,'actorCode',c.actor_code,
          'businessPurpose',c.business_purpose,'entryCondition',c.entry_condition,'exitCondition',c.exit_condition,
          'kpis',c.kpi_contract::json,'sections',c.section_contract::json,'fields',c.field_contract::json,
          'commands',c.command_contract::json,'states',c.state_contract::json,'apis',c.api_contract::json,
          'data',c.data_contract::json,'evidence',c.evidence_contract::json,'responsive',c.responsive_contract,
          'accessibility',c.accessibility_contract,'security',c.security_contract) order by c.audience,c.route_path))::text
      from framework_process_step s join framework_professional_screen_contract c
        on c.process_code=s.process_code and c.step_code=s.step_code
      where s.process_code='${PROCESS_CODE}' and s.step_code='${STEP_CODE}'
      group by s.requirement_text,s.step_name;")"
    jq -e '.designContracts | type == "array" and length > 0' <<<"$ENRICHED_DESIGN_SPEC" >/dev/null 2>&1 ||
      fail_job "professional screen contract self-heal failed for DESIGN specification"
  fi
  SPEC="$(jq -c --argjson governed "$ENRICHED_DESIGN_SPEC" '. + $governed' <<<"$SPEC")"
  event "LEGACY_SPEC_ENRICHED" "RUNNING" "RUNNING" \
    "{\"source\":\"framework_professional_screen_contract\",\"reason\":\"designContracts missing\"}"
fi
SPEC_FILE="$WT/.automation-spec.json"
printf '%s' "$SPEC" >"$SPEC_FILE"
if jq -e 'has("compositeAuthoritySchema") or has("compositeAuthorities") or
    has("compositeAuthoritySetHash") or has("compositeArtifactOutputMode")' "$SPEC_FILE" >/dev/null; then
  if ! COMPOSITE_PREFLIGHT="$(python3 "$WT/ops/scripts/generate-composite-executable-design.py" \
      "$SPEC_FILE" --process "$PROCESS_CODE" --validate-only 2>>"$LOG_FILE")"; then
    fail_job "composite executable design authority preflight failed"
  fi
  gate_result "COMPOSITE_EXECUTABLE_DESIGN" "PASSED" "$COMPOSITE_PREFLIGHT"
  event "COMPOSITE_AUTHORITY_VALIDATED" "RUNNING" "RUNNING" "$COMPOSITE_PREFLIGHT"
fi
GOVERNANCE_FILE="$WT/.automation-governance.json"
psqlq -c "
  select json_build_object(
    'processCode',s.process_code,
    'stepCode',s.step_code,
    'actorCode',coalesce(nullif(s.actor_code,''),'UNASSIGNED'),
    'requirement',coalesce(nullif(btrim(s.requirement_text),''),
      s.step_name||' 업무를 전문적으로 완료하고 검증 가능한 산출물을 생성한다.'),
    'screenContractCount',count(c.contract_id),
    'routeCount',count(distinct c.route_path) filter(where nullif(c.route_path,'') is not null),
    'apiVerified',coalesce(bool_and(c.api_verified) filter(where c.contract_id is not null),false) or exists(
      select 1 from framework_development_job j where j.process_code=s.process_code and j.step_code=s.step_code
        and j.job_type in ('API','API_QUALITY','BACKEND','BACKEND_QUALITY') and j.job_status in ('VERIFIED','COMPLETED')),
    'databaseVerified',coalesce(bool_and(c.database_verified) filter(where c.contract_id is not null),false) or exists(
      select 1 from framework_development_job j where j.process_code=s.process_code and j.step_code=s.step_code
        and j.job_type in ('DATABASE','DATABASE_QUALITY') and j.job_status in ('VERIFIED','COMPLETED')),
    'authorityVerified',coalesce(bool_and(c.authority_verified) filter(where c.contract_id is not null),false) or exists(
      select 1 from framework_development_job j where j.process_code=s.process_code and j.step_code=s.step_code
        and j.job_type='ACTOR_TEST' and j.job_status in ('VERIFIED','COMPLETED')),
    'responsiveVerified',coalesce(bool_and(c.responsive_verified) filter(where c.contract_id is not null),false),
    'accessibilityVerified',coalesce(bool_and(c.accessibility_verified) filter(where c.contract_id is not null),false),
    'exceptionStatesVerified',coalesce(bool_and(c.exception_states_verified) filter(where c.contract_id is not null),false) or exists(
      select 1 from framework_development_job j where j.process_code=s.process_code and j.step_code=s.step_code
        and j.job_type in ('TEST','INTEGRATION') and j.job_status in ('VERIFIED','COMPLETED'))
  )::text
  from framework_process_step s
  left join framework_professional_screen_contract c
    on c.process_code=s.process_code and c.step_code=s.step_code
  where s.process_code='${PROCESS_CODE}' and s.step_code='${STEP_CODE}'
  group by s.process_code,s.step_code,s.actor_code,s.requirement_text,s.step_name;" >"$GOVERNANCE_FILE"
PROFESSIONAL_VALIDATOR="$WT/ops/scripts/validate-professional-development-contract.sh"
if PROFESSIONAL_RESULT="$(bash "$PROFESSIONAL_VALIDATOR" "$WT" "$JOB_TYPE" "$SPEC_FILE" "$GOVERNANCE_FILE" 2>>"$LOG_FILE")"; then
  gate_result "PROFESSIONAL_CONTRACT" "PASSED" "$PROFESSIONAL_RESULT"
  event "CONTRACT_PREFLIGHT" "RUNNING" "RUNNING" "$PROFESSIONAL_RESULT"
else
  GENERATED_DIMENSION_VALIDATOR="$WT/ops/scripts/validate-generated-process-dimension.sh"
  if [[ -x "$GENERATED_DIMENSION_VALIDATOR" ]] \
      && GENERATED_PREFLIGHT_RESULT="$(bash "$GENERATED_DIMENSION_VALIDATOR" "$WT" "$PROCESS_CODE" "$STEP_CODE" "$JOB_TYPE" 2>>"$LOG_FILE")"; then
    gate_result "PROFESSIONAL_CONTRACT" "PASSED" "$GENERATED_PREFLIGHT_RESULT"
    event "CONTRACT_PREFLIGHT" "RUNNING" "RUNNING" "$(jq -c '. + {preflightStrategy:"EXACT_GENERATED_DIMENSION_FALLBACK"}' <<<"$GENERATED_PREFLIGHT_RESULT")"
  elif [[ "$JOB_TYPE" =~ ^(API|API_QUALITY|BACKEND|BACKEND_QUALITY|DATABASE|DATABASE_QUALITY)$ ]] \
      && jq -e --arg process "$PROCESS_CODE" --arg step "$STEP_CODE" '
        .approvalStatus == "APPROVED"
        and .process.code == $process and .step.code == $step
        and .backend.runtime == "COMMON_PROCESS_COMMAND_RUNTIME"
        and .database.migrationRequired == true
      ' "$WT/projects/carbonet-backend-metadata/process-runtime/generated/$PROCESS_CODE/${PROCESS_CODE}__${STEP_CODE}.json" >/dev/null 2>&1; then
    gate_result "PROFESSIONAL_CONTRACT" "PASSED" \
      "{\"strategy\":\"APPROVED_GENERATED_PACKAGE_REPAIR_PENDING\",\"processCode\":\"${PROCESS_CODE}\",\"stepCode\":\"${STEP_CODE}\",\"jobType\":\"${JOB_TYPE}\"}"
    event "CONTRACT_PREFLIGHT" "RUNNING" "RUNNING" \
      "{\"preflightStrategy\":\"APPROVED_GENERATED_PACKAGE_REPAIR_PENDING\"}"
  else
    gate_result "PROFESSIONAL_CONTRACT" "FAILED" "approved actor, process, screen, authority, API, DB, responsive, accessibility, or exception contract is incomplete"
    fail_job "professional development contract preflight failed"
  fi
fi
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
Professional delivery policy: $(jq -c '{policyId,version,completionOrder,mandatoryDimensions,screenTypeTemplates,minimumProfessionalScore,failClosed}' "$WT/ops/runtime-metadata/professional-development-policy.json")

Read AGENTS.md and obey it. Inspect /opt/reference only as read-only evidence. Inspect existing DB/API/page implementations before editing.
Implement exactly one bounded, production-useful increment for this job. Reuse registered KRDS theme, sections and components. For page-only work prefer SDUI and project-owned metadata/overlay paths with no build/deploy. Do not edit generated bundles manually.
Add or update automated tests and evidence. Never modify credentials, backups, database data, Kubernetes state, deployment scripts, CI permissions, or unrelated files. Do not commit or push; the worker will validate and publish.
Satisfy every applicable professional policy dimension. Do not represent a thin page, placeholder, document-only claim, or unexecuted test as implementation completion.
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
  ADOPTION_TARGET="$TARGET_PATH"
  if [[ "$ADOPTION_TARGET" == design://* ]]; then
    if [[ "$JOB_TYPE" == "FRONTEND_ADMIN" ]]; then
      ADOPTION_TARGET="$(psqlq -c "select coalesce(nullif(admin_path,''),'') from framework_process_step where process_code='${PROCESS_CODE}' and step_code='${STEP_CODE}'")"
    else
      ADOPTION_TARGET="$(psqlq -c "select coalesce(nullif(user_path,''),'') from framework_process_step where process_code='${PROCESS_CODE}' and step_code='${STEP_CODE}'")"
    fi
    [[ "$ADOPTION_TARGET" == /* ]] && event "LEGACY_TARGET_RESOLVED" "RUNNING" "RUNNING" \
      "{\"legacyTarget\":\"${TARGET_PATH}\",\"routeTarget\":\"${ADOPTION_TARGET}\"}"
  fi
  if ADOPTION_JSON="$(python3 "$WT/ops/scripts/adopt-existing-frontend-job.py" "$WT" "$PROCESS_CODE" "$STEP_CODE" "$JOB_ID" "$ADOPTION_TARGET" 2>>"$LOG_FILE")"; then
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
  if git -C "$WT" ls-files --error-unmatch "$ARTIFACT_PATH" >/dev/null 2>&1 \
      && git -C "$WT" diff --quiet -- "$ARTIFACT_PATH"; then
    gate_result "ADOPT_EXISTING_SOURCE" "PASSED" \
      "{\"strategy\":\"IDENTICAL_GOVERNED_DESIGN\",\"artifact\":\"${ARTIFACT_PATH}\"}"
    EXISTING_ADOPTED=1
  fi
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
rm -f "$WT/.automation-prompt.txt" "$SPEC_FILE" "$GOVERNANCE_FILE"
if [ "$KILO_CODE" -ne 0 ] && grep -Eq 'HTTP 429|Too Many Requests|status.?=.?429' "$LOG_FILE.hermes" 2>/dev/null; then
  defer_rate_limited_job
fi
[ "$KILO_CODE" -eq 0 ] || fail_job "Hermes project worker exited with code ${KILO_CODE}"

CHANGED="$(git -C "$WT" status --porcelain=v1 --untracked-files=all)"
if [ -z "$CHANGED" ] && [ "$DETERMINISTIC_HANDLED" = 1 ] && [[ "$JOB_TYPE" =~ ^FULL_STACK(_GENERATION)?$ ]]; then
  # A sibling step can publish the same process package first because one
  # deterministic process render contains every approved step. The current
  # runner has already re-rendered, hash-checked, and contract-tested that
  # package. Reuse the identical main artifact instead of creating a duplicate
  # commit or reporting a false failure.
  canonical_package="$WT/projects/carbonet-backend-metadata/process-runtime/generated/$PROCESS_CODE/${PROCESS_CODE}__${STEP_CODE}.json"
  canonical_release="$WT/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/$PROCESS_CODE/full-stack-release.json"
  if [[ -f "$canonical_package" && -f "$canonical_release" ]]; then
    adopted_tree="$(mktemp -d "${TMPDIR:-/tmp}/canonical-adopt-tree.XXXXXX")" \
      || fail_job "adopted canonical commit extraction failed"
    register_canonical_temp_path "$adopted_tree" \
      || fail_job "adopted canonical temp registration failed"
    canonical_worktree_paths_clean "$WT" "$PROCESS_CODE" \
      || fail_job "adopted canonical worktree paths are dirty"
    canonical_commit_evidence_files "$WT" "$BASE_COMMIT" "$PROCESS_CODE" "$STEP_CODE" "$adopted_tree" \
      || fail_job "adopted canonical commit extraction failed"
    canonical_evidence="$(canonical_generation_evidence \
      "$adopted_tree/${PROCESS_CODE}__${STEP_CODE}.json" "$adopted_tree/full-stack-release.json" \
      "$PROCESS_CODE" "$STEP_CODE")" \
      || fail_job "adopted canonical package/release hash verification failed"
    CANONICAL_DEPLOY_STARTED_EPOCH_SECONDS="$(date +%s)"
    adopted_deploy_ok=0
    for _ in $(seq 1 60); do
      DEPLOYED="$(deployed_commit || true)"
      if [[ -n "$DEPLOYED" ]] \
        && git -C "$WT" merge-base --is-ancestor "$BASE_COMMIT" "$DEPLOYED" 2>/dev/null \
        && deployment_is_ready && runtime_is_healthy; then
        adopted_deploy_ok=1
        break
      fi
      sleep 1
    done
    canonical_deploy_seconds="$(canonical_deploy_elapsed_seconds)" \
      || fail_job "adopted canonical deployment duration evidence is invalid"
    if [[ "$adopted_deploy_ok" != 1 ]] || (( canonical_deploy_seconds > 60 )); then
      gate_result "CANONICAL_DEPLOY_SLO" "FAILED" \
        "{\"elapsedSeconds\":$canonical_deploy_seconds,\"targetSeconds\":60,\"deploymentReady\":false,\"terminalWrite\":0}"
      fail_job "adopted canonical deployment missed the 60-second terminal SLO"
    fi
    if ! canonical_binding_evidence="$(verify_stable_canonical_runtime_deployment \
        "$WT" "$BASE_COMMIT" "$PROCESS_CODE" "$STEP_CODE")"; then
      canonical_deploy_seconds="$(canonical_deploy_elapsed_seconds)" \
        || fail_job "adopted canonical deployment duration evidence is invalid"
      if (( canonical_deploy_seconds > 60 )); then
        gate_result "CANONICAL_DEPLOY_SLO" "FAILED" \
          "{\"elapsedSeconds\":$canonical_deploy_seconds,\"targetSeconds\":60,\"terminalWrite\":0}"
      fi
      gate_result "CANONICAL_RUNTIME_BINDING" "FAILED" '{"terminalWrite":0}'
      fail_job "adopted canonical deployed Spring mapping verification failed"
    fi
    adopted_stable_deployed="$(jq -er '.deployedCommit' <<<"$canonical_binding_evidence")" \
      || fail_job "adopted canonical stable deploy marker is invalid"
    gate_result "CANONICAL_RUNTIME_BINDING" "PASSED" "$canonical_binding_evidence"
    adopted_published=0
    verify_canonical_commit_published "$WT" "$BASE_COMMIT" && adopted_published=1
    canonical_deploy_seconds="$(canonical_deploy_elapsed_seconds)" \
      || fail_job "adopted canonical deployment duration evidence is invalid"
    if (( canonical_deploy_seconds > 60 )); then
      gate_result "CANONICAL_DEPLOY_SLO" "FAILED" \
        "{\"elapsedSeconds\":$canonical_deploy_seconds,\"targetSeconds\":60,\"terminalWrite\":0}"
      fail_job "adopted canonical deployment exceeded the 60-second terminal SLO"
    fi
    [[ "$adopted_published" = 1 ]] \
      || fail_job "adopted canonical release is no longer published on origin/main"
    canonical_deployed_marker_is "$adopted_stable_deployed" \
      || fail_job "adopted canonical deploy marker changed before terminal finalization"
    gate_result "CANONICAL_DEPLOY_SLO" "PASSED" \
      "{\"elapsedSeconds\":$canonical_deploy_seconds,\"targetSeconds\":60}"
    adopted_rollback="$(canonical_result_parent "$WT" "$BASE_COMMIT")" \
      || fail_job "adopted canonical rollback commit is invalid"
    finalize_canonical_generation "$JOB_ID" "$LEASE_TOKEN" "$WORKER_ID" \
      "$BASE_COMMIT" "$adopted_rollback" "$PROCESS_CODE" "$STEP_CODE" "$LOG_FILE" "$canonical_evidence" \
      || fail_job "adopted canonical generation evidence finalization failed"
    wake_composite_live_smoke_postdeploy
    cleanup_canonical_temp_paths
    git -C "$ROOT_DIR" worktree remove --force "$WT" >/dev/null 2>&1 || true
    printf 'VERIFIED adopted canonical package job=%s commit=%s\n' "$JOB_ID" "$BASE_COMMIT"
    exit 0
  fi
  EVIDENCE="git:${BASE_COMMIT};generated-package:${PROCESS_CODE};log:${LOG_FILE}"
  psqlq -c "update framework_development_job set job_status='VERIFIED',quality_status='VERIFIED',result_json=\$json\${\"commit\":\"${BASE_COMMIT}\",\"strategy\":\"ADOPT_GENERATED_PROCESS_PACKAGE\"}\$json\$,evidence_ref='${EVIDENCE}',rollback_ref='${BASE_COMMIT}',completed_at=current_timestamp,lease_token=null,lease_until=null,updated_at=current_timestamp where job_id=${JOB_ID} and lease_token='${LEASE_TOKEN}'; update framework_process_artifact set delivery_status='VERIFIED',evidence_ref='${EVIDENCE}',updated_at=current_timestamp where process_code='${PROCESS_CODE}' and step_code='${STEP_CODE}' and contract_ref='AUTO:${JOB_TYPE}';" >/dev/null
  event "VERIFIED" "RUNNING" "VERIFIED" "{\"commit\":\"${BASE_COMMIT}\",\"strategy\":\"ADOPT_GENERATED_PROCESS_PACKAGE\"}"
  git -C "$ROOT_DIR" worktree remove --force "$WT" >/dev/null 2>&1 || true
  printf 'VERIFIED generated package job=%s commit=%s\n' "$JOB_ID" "$BASE_COMMIT"
  exit 0
fi
if [ -z "$CHANGED" ] && [ "$EXISTING_ADOPTED" = 1 ]; then
  EVIDENCE="git:${BASE_COMMIT};adoption:${ADOPTION_ARTIFACT};log:${LOG_FILE}"
  psqlq -c "update framework_development_job set job_status='VERIFIED',quality_status='VERIFIED',result_json=\$json\${\"commit\":\"${BASE_COMMIT}\",\"strategy\":\"ADOPT_EXISTING\"}\$json\$,evidence_ref='${EVIDENCE}',rollback_ref='${BASE_COMMIT}',completed_at=current_timestamp,lease_token=null,lease_until=null,updated_at=current_timestamp where job_id=${JOB_ID} and lease_token='${LEASE_TOKEN}'; update framework_process_artifact set delivery_status='VERIFIED',evidence_ref='${EVIDENCE}',updated_at=current_timestamp where process_code='${PROCESS_CODE}' and step_code='${STEP_CODE}' and contract_ref='AUTO:${JOB_TYPE}';" >/dev/null
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
  CHANGED="$(git -C "$WT" status --porcelain=v1 --untracked-files=all)"
fi
if [ -z "$CHANGED" ] && [[ "$JOB_TYPE" == FRONTEND_* ]]; then
  ADOPTION_JSON="$(python3 "$WT/ops/scripts/adopt-existing-frontend-job.py" "$WT" "$PROCESS_CODE" "$STEP_CODE" "$JOB_ID" "$TARGET_PATH")" \
    || fail_job "existing frontend adoption contract failed"
  verify_adopted_frontend_tree || fail_job "existing frontend adoption type check failed"
  gate_result "ADOPT_EXISTING_SOURCE" "PASSED" "$ADOPTION_JSON"
  CHANGED="$(git -C "$WT" status --porcelain=v1 --untracked-files=all)"
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
CANONICAL_ENDPOINT_MANIFEST="$WT/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/$PROCESS_CODE/manifest.json"
CANONICAL_PUBLICATION_ACTIVE=0
if [[ "$DETERMINISTIC_HANDLED" = 1 && "$JOB_TYPE" =~ ^FULL_STACK(_GENERATION)?$ ]]; then
  [[ -f "$CANONICAL_ENDPOINT_MANIFEST" ]] \
    || fail_job "canonical endpoint manifest is required before publication"
  CANONICAL_PUBLICATION_ACTIVE=1
  DIFF_LINES="$(canonical_diff_line_count "$WT")" \
    || fail_job "canonical diff line calculation failed"
  if validate_canonical_generated_diff "$WT" "$PROCESS_CODE" "$CHANGED" "$DIFF_LINES" \
      >>"$LOG_FILE" 2>&1; then
    gate_result "DETERMINISTIC_DIFF_SCOPE" "PASSED" \
      "{\"files\":$FILE_COUNT,\"lines\":$DIFF_LINES,\"limitSource\":\"CANONICAL_MANIFESTS\"}"
  else
    fail_job "canonical manifest-derived diff scope failed"
  fi
  compile_canonical_generated_endpoint_immutable "$WT" "$PROCESS_CODE" >>"$LOG_FILE" 2>&1 \
    || fail_job "canonical generated endpoint compile failed"
  gate_result "CANONICAL_ENDPOINT_COMPILE" "PASSED" \
    "{\"processCode\":\"$PROCESS_CODE\",\"phase\":\"PRE_COMMIT\"}"
else
  [ "$FILE_COUNT" -le "$MAX_FILES" ] || fail_job "changed file limit exceeded: ${FILE_COUNT}/${MAX_FILES}"
  DIFF_LINES="$(git -C "$WT" diff --numstat | awk '{a+=$1+$2} END{print a+0}')"
  if [ "$DIFF_LINES" -gt "$MAX_LINES" ]; then
  if [ "$DETERMINISTIC_HANDLED" = 1 ] && [[ "$JOB_TYPE" =~ ^FULL_STACK(_GENERATION)?$ ]] \
      && printf '%s\n' "$CHANGED" | bash "$WT/ops/scripts/validate-deterministic-fullstack-diff.sh" \
        "$PROCESS_CODE" "$DIFF_LINES" "$WT" >>"$LOG_FILE" 2>&1; then
    gate_result "DETERMINISTIC_DIFF_SCOPE" "PASSED" \
      "{\"files\":$FILE_COUNT,\"lines\":$DIFF_LINES,\"defaultLimit\":$MAX_LINES}"
  else
    fail_job "diff line limit exceeded: ${DIFF_LINES}/${MAX_LINES}"
  fi
  fi
fi
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
if [[ "$CANONICAL_PUBLICATION_ACTIVE" = 1 ]]; then
  revalidate_canonical_commit_after_rebase HEAD
fi

# Staged publication accumulates independently verified process packages on a
# non-main branch.  It deliberately stops before the MAIN advisory lock,
# runtime deployment, and terminal VERIFIED write.  Promotion later retries
# these BLOCKED jobs against the one deployed aggregate commit.
if [[ -n "$AI_STAGED_PUBLICATION_BRANCH" ]]; then
  exec 8>"${AI_STAGED_PUBLISH_LOCK_FILE:-/tmp/resonance-ai-staged-publish.lock}"
  flock 8
  git -C "$WT" fetch origin "$AI_STAGED_PUBLICATION_BRANCH" >>"$LOG_FILE" 2>&1
  if [[ "$(git -C "$WT" rev-parse "origin/$AI_STAGED_PUBLICATION_BRANCH")" != "$BASE_COMMIT" ]]; then
    git -C "$WT" rebase "origin/$AI_STAGED_PUBLICATION_BRANCH" >>"$LOG_FILE" 2>&1 \
      || fail_job "staged publication rebase conflict"
    if [[ "$DETERMINISTIC_HANDLED" = 1 && "$JOB_TYPE" =~ ^FULL_STACK(_GENERATION)?$ \
        && -f "$CANONICAL_ENDPOINT_MANIFEST" ]]; then
      revalidate_canonical_commit_after_rebase HEAD
    fi
  fi
  RESULT_COMMIT="$(git -C "$WT" rev-parse HEAD)"
  git -C "$WT" push origin "HEAD:$AI_STAGED_PUBLICATION_BRANCH" >>"$LOG_FILE" 2>&1 \
    || fail_job "staged branch push rejected"
  EVIDENCE="git:${RESULT_COMMIT};branch:${AI_STAGED_PUBLICATION_BRANCH};log:${LOG_FILE}"
  psqlq -c "update framework_development_job set job_status='BLOCKED',quality_status='PENDING',result_json=\$json\${\"commit\":\"${RESULT_COMMIT}\",\"branch\":\"${AI_STAGED_PUBLICATION_BRANCH}\",\"status\":\"STAGED_AWAITING_PROMOTION\"}\$json\$,evidence_ref='${EVIDENCE}',rollback_ref='${BASE_COMMIT}',last_error='STAGED_AWAITING_PROMOTION',worker_id=null,lease_token=null,lease_until=null,updated_at=current_timestamp where job_id=${JOB_ID} and lease_token='${LEASE_TOKEN}'; update framework_process_artifact set delivery_status='GENERATED',evidence_ref='${EVIDENCE}',updated_at=current_timestamp where process_code='${PROCESS_CODE}' and step_code='${STEP_CODE}' and contract_ref='AUTO:${JOB_TYPE}';" >/dev/null
  event "STAGED_AWAITING_PROMOTION" "RUNNING" "BLOCKED" \
    "{\"commit\":\"${RESULT_COMMIT}\",\"branch\":\"${AI_STAGED_PUBLICATION_BRANCH}\"}"
  flock -u 8
  exec 8>&-
  git -C "$ROOT_DIR" worktree remove --force "$WT" >/dev/null 2>&1 || true
  printf 'STAGED job=%s commit=%s branch=%s deployment=0\n' \
    "$JOB_ID" "$RESULT_COMMIT" "$AI_STAGED_PUBLICATION_BRANCH"
  exit 0
fi

# Parallel workers develop in isolated worktrees, then serialize only the short
# publication window. Canonical publishers also hold cross-host PostgreSQL MAIN
# and process locks in one persistent session. The process lock is the same key
# used by design-save transactions, so a save cannot pass the final head check
# and race a later push.
if [[ "$CANONICAL_PUBLICATION_ACTIVE" = 1 ]]; then
  canonical_publication_begin "$PROCESS_CODE" \
    || fail_job "canonical publication locks unavailable"
  canonical_publication_db_session_alive \
    || fail_job "canonical publication database session disconnected"
  canonical_process_job_head_is_current \
    || fail_job "STALE_CANONICAL_PROCESS_JOB_HEAD_BEFORE_PUBLISH"
  gate_result "CANONICAL_PROCESS_JOB_HEAD" "PASSED" \
    "{\"processCode\":\"$PROCESS_CODE\",\"processInputHash\":\"$(jq -r '.processInputHash' <<<"$SPEC")\"}"
else
  exec 8>"${AI_PUBLISH_LOCK_FILE:-/tmp/resonance-ai-main-publish.lock}"
  flock 8
fi
git -C "$WT" fetch origin main >>"$LOG_FILE" 2>&1
if [ "$(git -C "$WT" rev-parse origin/main)" != "$BASE_COMMIT" ]; then
  git -C "$WT" rebase origin/main >>"$LOG_FILE" 2>&1 || fail_job "parallel publish rebase conflict"
  if [[ "$DETERMINISTIC_HANDLED" = 1 && "$JOB_TYPE" =~ ^FULL_STACK(_GENERATION)?$ \
      && -f "$CANONICAL_ENDPOINT_MANIFEST" ]]; then
    revalidate_canonical_commit_after_rebase HEAD
  fi
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
publish_succeeded=0
CANONICAL_DEPLOY_STARTED_EPOCH_SECONDS=""
if [[ "$CANONICAL_PUBLICATION_ACTIVE" = 1 ]]; then
  CANONICAL_DEPLOY_STARTED_EPOCH_SECONDS="$(date +%s)"
fi
for publish_attempt in 1 2 3; do
  if [[ "$CANONICAL_PUBLICATION_ACTIVE" = 1 ]]; then
    canonical_publication_db_session_alive \
      || fail_job "canonical publication database session disconnected before push"
    canonical_process_job_head_is_current \
      || fail_job "STALE_CANONICAL_PROCESS_JOB_HEAD_BEFORE_PUSH"
  fi
  if git -C "$WT" push origin "HEAD:main" >>"$LOG_FILE" 2>&1; then
    publish_succeeded=1
    break
  fi
  printf 'main push attempt %s failed; refreshing remote before retry\n' "$publish_attempt" >>"$LOG_FILE"
  sleep "$((publish_attempt * 2))"
  git -C "$WT" fetch origin main >>"$LOG_FILE" 2>&1 || continue
  if ! git -C "$WT" merge-base --is-ancestor origin/main HEAD; then
    git -C "$WT" rebase origin/main >>"$LOG_FILE" 2>&1 || fail_job "parallel publish rebase conflict"
    if [[ "$DETERMINISTIC_HANDLED" = 1 && "$JOB_TYPE" =~ ^FULL_STACK(_GENERATION)?$ \
        && -f "$CANONICAL_ENDPOINT_MANIFEST" ]]; then
      revalidate_canonical_commit_after_rebase HEAD
    fi
    RESULT_COMMIT="$(git -C "$WT" rev-parse HEAD)"
  fi
done
[ "$publish_succeeded" = 1 ] || fail_job "main push rejected after 3 guarded attempts"
if [[ "$CANONICAL_PUBLICATION_ACTIVE" = 1 ]]; then
  canonical_publication_db_session_alive \
    || fail_job "canonical publication database session disconnected during push"
  canonical_publication_complete_push \
    || fail_job "canonical MAIN publication lock did not release cleanly"
else
  flock -u 8
  exec 8>&-
fi

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

deploy_wait_attempts=90
deploy_wait_seconds=10
if [[ "$CANONICAL_PUBLICATION_ACTIVE" = 1 ]]; then
  deploy_wait_attempts=60
  deploy_wait_seconds=1
fi
deployment_observed=0
for _ in $(seq 1 "$deploy_wait_attempts"); do
  DEPLOYED="$(deployed_commit || true)"
  if [[ -n "$DEPLOYED" ]] \
    && git -C "$WT" merge-base --is-ancestor "$RESULT_COMMIT" "$DEPLOYED" 2>/dev/null \
    && deployment_is_ready && runtime_is_healthy; then
    deployment_observed=1
    break
  fi
  sleep "$deploy_wait_seconds"
done
if [[ "$CANONICAL_PUBLICATION_ACTIVE" = 1 ]]; then
  canonical_publication_db_session_alive \
    || fail_job "canonical process publication lock was lost during deploy wait"
  CANONICAL_DEPLOY_SECONDS="$(canonical_deploy_elapsed_seconds)" \
    || fail_job "canonical deployment duration evidence is invalid"
  if [[ "$deployment_observed" != 1 ]] || (( CANONICAL_DEPLOY_SECONDS > 60 )); then
    gate_result "CANONICAL_DEPLOY_SLO" "FAILED" \
      "{\"elapsedSeconds\":$CANONICAL_DEPLOY_SECONDS,\"targetSeconds\":60,\"deploymentReady\":false,\"terminalWrite\":0}"
    fail_job "canonical deployment missed the 60-second terminal SLO"
  fi
else
  DEPLOYED="$(deployed_commit || true)"
  [[ -n "$DEPLOYED" ]] \
    && git -C "$WT" merge-base --is-ancestor "$RESULT_COMMIT" "$DEPLOYED" 2>/dev/null \
    || fail_job "result commit was not deployed according to the canonical deploy marker"
  deployment_is_ready || fail_job "deployment replica readiness check failed"
  runtime_is_healthy || fail_job "deployment health check failed"
fi

CANONICAL_PACKAGE_FILE="$WT/projects/carbonet-backend-metadata/process-runtime/generated/$PROCESS_CODE/${PROCESS_CODE}__${STEP_CODE}.json"
CANONICAL_RELEASE_FILE="$WT/projects/carbonet-backend-metadata/process-runtime/generated-endpoints/$PROCESS_CODE/full-stack-release.json"
if [[ "$CANONICAL_PUBLICATION_ACTIVE" = 1 \
    && ( -e "$CANONICAL_PACKAGE_FILE" || -e "$CANONICAL_RELEASE_FILE" ) ]]; then
  [[ -f "$CANONICAL_PACKAGE_FILE" && -f "$CANONICAL_RELEASE_FILE" ]] \
    || fail_job "canonical package/release evidence is incomplete"
  CANONICAL_COMMIT_TREE="$(mktemp -d "${TMPDIR:-/tmp}/canonical-result-tree.XXXXXX")" \
    || fail_job "canonical result commit extraction failed"
  register_canonical_temp_path "$CANONICAL_COMMIT_TREE" \
    || fail_job "canonical result temp registration failed"
  canonical_worktree_paths_clean "$WT" "$PROCESS_CODE" \
    || fail_job "canonical worktree paths are dirty after publication"
  canonical_commit_evidence_files "$WT" "$RESULT_COMMIT" "$PROCESS_CODE" "$STEP_CODE" "$CANONICAL_COMMIT_TREE" \
    || fail_job "canonical result commit extraction failed"
  CANONICAL_EVIDENCE_JSON="$(canonical_generation_evidence \
    "$CANONICAL_COMMIT_TREE/${PROCESS_CODE}__${STEP_CODE}.json" \
    "$CANONICAL_COMMIT_TREE/full-stack-release.json" "$PROCESS_CODE" "$STEP_CODE")" \
    || fail_job "canonical package/release hash verification failed"
  if ! CANONICAL_BINDING_EVIDENCE="$(verify_stable_canonical_runtime_deployment \
      "$WT" "$RESULT_COMMIT" "$PROCESS_CODE" "$STEP_CODE")"; then
    CANONICAL_DEPLOY_SECONDS="$(canonical_deploy_elapsed_seconds)" \
      || fail_job "canonical deployment duration evidence is invalid"
    if (( CANONICAL_DEPLOY_SECONDS > 60 )); then
      gate_result "CANONICAL_DEPLOY_SLO" "FAILED" \
        "{\"elapsedSeconds\":$CANONICAL_DEPLOY_SECONDS,\"targetSeconds\":60,\"terminalWrite\":0}"
    fi
    gate_result "CANONICAL_RUNTIME_BINDING" "FAILED" '{"terminalWrite":0}'
    fail_job "canonical deployed Spring mapping verification failed"
  fi
  CANONICAL_STABLE_DEPLOYED="$(jq -er '.deployedCommit' <<<"$CANONICAL_BINDING_EVIDENCE")" \
    || fail_job "canonical stable deploy marker is invalid"
  gate_result "CANONICAL_RUNTIME_BINDING" "PASSED" "$CANONICAL_BINDING_EVIDENCE"
  # Publication is re-proved immediately before the terminal transaction.
  # A push rejection or signal can therefore never mark a READY design as
  # GENERATED. A later sibling commit is allowed only when RESULT_COMMIT is an
  # ancestor of the current origin/main.
  canonical_published=0
  verify_canonical_commit_published "$WT" "$RESULT_COMMIT" && canonical_published=1
  CANONICAL_DEPLOY_SECONDS="$(canonical_deploy_elapsed_seconds)" \
    || fail_job "canonical deployment duration evidence is invalid"
  if (( CANONICAL_DEPLOY_SECONDS > 60 )); then
    gate_result "CANONICAL_DEPLOY_SLO" "FAILED" \
      "{\"elapsedSeconds\":$CANONICAL_DEPLOY_SECONDS,\"targetSeconds\":60,\"terminalWrite\":0}"
    fail_job "canonical deployment exceeded the 60-second terminal SLO"
  fi
  [[ "$canonical_published" = 1 ]] \
    || fail_job "canonical result commit is not published on origin/main"
  canonical_deployed_marker_is "$CANONICAL_STABLE_DEPLOYED" \
    || fail_job "canonical deploy marker changed before terminal finalization"
  gate_result "CANONICAL_DEPLOY_SLO" "PASSED" \
    "{\"elapsedSeconds\":$CANONICAL_DEPLOY_SECONDS,\"targetSeconds\":60}"
  CANONICAL_ROLLBACK_COMMIT="$(canonical_result_parent "$WT" "$RESULT_COMMIT")" \
    || fail_job "canonical rollback commit is invalid"
  canonical_publication_db_session_alive \
    || fail_job "canonical process publication lock was lost before finalization"
  finalize_canonical_generation "$JOB_ID" "$LEASE_TOKEN" "$WORKER_ID" \
    "$RESULT_COMMIT" "$CANONICAL_ROLLBACK_COMMIT" "$PROCESS_CODE" "$STEP_CODE" "$LOG_FILE" "$CANONICAL_EVIDENCE_JSON" \
    || fail_job "canonical generation evidence finalization failed"
  wake_composite_live_smoke_postdeploy
  canonical_publication_end \
    || printf 'canonical process publication lock cleanup required forced session close\n' >>"$LOG_FILE"
  cleanup_canonical_temp_paths
  EVIDENCE="git:${RESULT_COMMIT};release:$(jq -r '.releaseHash' <<<"$CANONICAL_EVIDENCE_JSON");log:${LOG_FILE}"
else
  # Rolling-upgrade legacy packages keep their established terminal update.
  # Canonical packages always use the exact evidence transaction above.
  EVIDENCE="git:${RESULT_COMMIT};log:${LOG_FILE}"
  psqlq -c "update framework_development_job set job_status='VERIFIED',quality_status='VERIFIED',result_json=\$json\${\"commit\":\"${RESULT_COMMIT}\"}\$json\$,evidence_ref='${EVIDENCE}',rollback_ref='${BASE_COMMIT}',completed_at=current_timestamp,lease_token=null,lease_until=null,updated_at=current_timestamp where job_id=${JOB_ID} and lease_token='${LEASE_TOKEN}'; update framework_process_artifact set delivery_status='VERIFIED',evidence_ref='${EVIDENCE}',updated_at=current_timestamp where process_code='${PROCESS_CODE}' and step_code='${STEP_CODE}' and contract_ref='AUTO:${JOB_TYPE}';" >/dev/null
  event "VERIFIED" "RUNNING" "VERIFIED" "{\"commit\":\"${RESULT_COMMIT}\"}"
fi
git -C "$ROOT_DIR" worktree remove --force "$WT" >/dev/null 2>&1 || true
printf 'VERIFIED job=%s commit=%s\n' "$JOB_ID" "$RESULT_COMMIT"
