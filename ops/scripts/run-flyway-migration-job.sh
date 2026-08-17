#!/usr/bin/env bash
set -euo pipefail

operation=run
cleanup_hold_argument=""
case "${1:-}" in
  --recover-cleanup-hold)
    [[ "$#" == 2 ]] || { echo '[flyway-job] cleanup-hold recovery requires exactly one evidence path' >&2; exit 2; }
    operation=recover-cleanup-hold
    cleanup_hold_argument="$2"
    image=cleanup-recovery
    ;;
  '') echo '[flyway-job] candidate image is required' >&2; exit 2 ;;
  *)
    [[ "$#" == 1 ]] || { echo '[flyway-job] unexpected arguments' >&2; exit 2; }
    image="$1"
    ;;
esac
namespace="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
deployment="${CARBONET_K8S_DEPLOYMENT:-carbonet-runtime}"
container="${CARBONET_K8S_CONTAINER:-carbonet-runtime}"
legacy_timeout="${CARBONET_FLYWAY_JOB_TIMEOUT:-}"
timeout_seconds="${CARBONET_FLYWAY_JOB_TIMEOUT_SECONDS:-}"
settle_seconds="${CARBONET_FLYWAY_SETTLE_TIMEOUT_SECONDS:-120}"
statement_timeout_seconds="${CARBONET_FLYWAY_STATEMENT_TIMEOUT_SECONDS:-}"
lock_timeout_seconds="${CARBONET_FLYWAY_LOCK_TIMEOUT_SECONDS:-10}"
cleanup_hold_seconds="${CARBONET_FLYWAY_CLEANUP_HOLD_TIMEOUT_SECONDS:-120}"
termination_grace_seconds=30
migration_secret_name="${CARBONET_MIGRATION_SECRET_NAME:-carbonet-migration-secret}"
migration_password_key="${CARBONET_MIGRATION_PASSWORD_KEY:-SPRING_FLYWAY_PASSWORD}"
dry_run_mode="${CARBONET_FLYWAY_JOB_DRY_RUN:-none}"
job="carbonet-flyway-$(date +%Y%m%d%H%M%S)-$(printf '%s' "$image" | sha256sum | cut -c1-6)"
application_name="$job"
started_epoch="$(date +%s)"
manifest="$(mktemp)"
log_dir="${CARBONET_FLYWAY_LOG_DIR:-/opt/Resonance/var/logs/flyway-jobs}"
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
postgres_container="${CARBONET_POSTGRES_CONTAINER:-patroni}"
postgres_database="${POSTGRES_DB:-carbonet}"
postgres_user="${POSTGRES_ADMIN_USER:-postgres}"
leader_resolver="${CARBONET_POSTDEPLOY_LEADER_RESOLVER:-$root_dir/ops/scripts/resolve-patroni-primary-pod.sh}"
cleanup_hold_file="${CARBONET_FLYWAY_CLEANUP_HOLD_FILE:-$log_dir/$job.cleanup-hold.json}"
[[ "$operation" != recover-cleanup-hold ]] || cleanup_hold_file="$cleanup_hold_argument"
source_commit="${CARBONET_TARGET_COMMIT:-UNBOUND}"
mkdir -p "$log_dir"
job_applied=false
job_terminal=false
cleanup_hold_hash=""

if [[ -n "$timeout_seconds" && -n "$legacy_timeout" ]]; then
  echo "[flyway-job] set only CARBONET_FLYWAY_JOB_TIMEOUT_SECONDS; the legacy timeout cannot be combined" >&2
  exit 2
fi
if [[ -z "$timeout_seconds" ]]; then
  if [[ -n "$legacy_timeout" ]]; then
    if [[ "$legacy_timeout" =~ ^([0-9]{1,4})s$ ]]; then
      timeout_seconds="${BASH_REMATCH[1]}"
    else
      echo "[flyway-job] legacy CARBONET_FLYWAY_JOB_TIMEOUT must be whole seconds such as 900s" >&2
      exit 2
    fi
  else
    timeout_seconds=900
  fi
fi
if [[ ! "$timeout_seconds" =~ ^[0-9]{1,4}$ ]] \
    || (( 10#$timeout_seconds < 300 || 10#$timeout_seconds > 3600 )); then
  echo "[flyway-job] CARBONET_FLYWAY_JOB_TIMEOUT_SECONDS must be between 300 and 3600" >&2
  exit 2
fi
if [[ ! "$settle_seconds" =~ ^[0-9]{1,3}$ ]] \
    || (( 10#$settle_seconds < 60 || 10#$settle_seconds > 300 )); then
  echo "[flyway-job] CARBONET_FLYWAY_SETTLE_TIMEOUT_SECONDS must be between 60 and 300" >&2
  exit 2
fi
timeout_seconds=$((10#$timeout_seconds))
settle_seconds=$((10#$settle_seconds))
if (( timeout_seconds <= settle_seconds + 60 )); then
  echo "[flyway-job] Flyway Job timeout must leave at least 60s before its settle deadline" >&2
  exit 2
fi
if [[ -z "$statement_timeout_seconds" ]]; then
  statement_timeout_seconds=$((timeout_seconds - settle_seconds))
fi
if [[ ! "$statement_timeout_seconds" =~ ^[0-9]{1,4}$ ]]; then
  echo "[flyway-job] CARBONET_FLYWAY_STATEMENT_TIMEOUT_SECONDS must be whole seconds" >&2
  exit 2
fi
statement_timeout_seconds=$((10#$statement_timeout_seconds))
if (( statement_timeout_seconds < 60 \
      || statement_timeout_seconds > timeout_seconds - settle_seconds )); then
  echo "[flyway-job] statement timeout must be between 60s and Job timeout minus settle timeout" >&2
  exit 2
fi
if [[ ! "$lock_timeout_seconds" =~ ^[0-9]{1,3}$ ]]; then
  echo "[flyway-job] CARBONET_FLYWAY_LOCK_TIMEOUT_SECONDS must be whole seconds" >&2
  exit 2
fi
lock_timeout_seconds=$((10#$lock_timeout_seconds))
if (( lock_timeout_seconds < 5 || lock_timeout_seconds > 120 \
      || lock_timeout_seconds >= statement_timeout_seconds )); then
  echo "[flyway-job] lock timeout must be 5..120s and shorter than statement timeout" >&2
  exit 2
fi
if [[ ! "$cleanup_hold_seconds" =~ ^[0-9]{1,3}$ ]] \
    || (( 10#$cleanup_hold_seconds < 30 || 10#$cleanup_hold_seconds > 600 )); then
  echo "[flyway-job] CARBONET_FLYWAY_CLEANUP_HOLD_TIMEOUT_SECONDS must be between 30 and 600" >&2
  exit 2
fi
cleanup_hold_seconds=$((10#$cleanup_hold_seconds))
observer_timeout_seconds=$((timeout_seconds + termination_grace_seconds))

epoch_now() {
  local now
  now="$(date +%s)" || return 1
  [[ "$now" =~ ^[0-9]+$ ]] || return 1
  printf '%s\n' "$now"
}

remaining_seconds() {
  local deadline="$1" maximum="$2" now remaining
  now="$(epoch_now)" || return 1
  remaining=$((deadline - now))
  (( remaining > 0 )) || return 1
  (( remaining < maximum )) || remaining="$maximum"
  printf '%s\n' "$remaining"
}

bounded_kubectl() {
  local deadline="$1" maximum="$2" call_timeout
  shift 2
  call_timeout="$(remaining_seconds "$deadline" "$maximum")" || return 1
  timeout --signal=TERM --kill-after=2s "${call_timeout}s" \
    kubectl --request-timeout="${call_timeout}s" "$@"
}

bounded_kubectl_for() {
  local maximum="$1" now
  shift
  now="$(epoch_now)" || return 1
  bounded_kubectl "$((now + maximum))" "$maximum" "$@"
}

resolve_postgres_leader() {
  local deadline="$1" resolved call_timeout
  call_timeout="$(remaining_seconds "$deadline" 5)" || return 1
  # Never accept a caller-injected/cached Pod. Re-run the resolver for every
  # pg_stat_activity operation so a Patroni failover cannot turn session zero
  # on an old replica into false cleanup evidence.
  resolved="$(timeout --signal=TERM --kill-after=2s "${call_timeout}s" \
    env -u RESONANCE_POSTGRES_LEADER_POD K8S_NAMESPACE="$namespace" \
      bash "$leader_resolver")" || return 1
  [[ "$resolved" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ ]] || return 1
  printf '%s\n' "$resolved"
}

postgres_query() {
  local sql="$1" deadline="$2" postgres_leader call_timeout
  postgres_leader="$(resolve_postgres_leader "$deadline")" || return 1
  call_timeout="$(remaining_seconds "$deadline" 5)" || return 1
  if ! {
      cat <<'SQL'
DO $flyway_primary_guard$
BEGIN
  IF pg_is_in_recovery() THEN
    RAISE EXCEPTION 'Flyway cleanup requires the writable PostgreSQL primary';
  END IF;
END
$flyway_primary_guard$;
SQL
      printf '%s\n' "$sql"
    } | timeout --signal=TERM --kill-after=2s "${call_timeout}s" \
      kubectl --request-timeout="${call_timeout}s" \
        -n "$namespace" exec -i "$postgres_leader" -c "$postgres_container" -- \
        psql -h 127.0.0.1 -U "$postgres_user" -d "$postgres_database" \
          -X -qAt -v ON_ERROR_STOP=1 -v "flyway_application_name=$application_name"; then
    return 1
  fi
}

flyway_session_count() {
  local deadline="$1" count
  count="$(postgres_query \
    "SELECT count(*) FROM pg_stat_activity WHERE application_name=:'flyway_application_name';" \
    "$deadline")" \
    || return 1
  count="$(tr -d '[:space:]' <<<"$count")"
  [[ "$count" =~ ^[0-9]+$ ]] || return 1
  printf '%s\n' "$count"
}

cancel_flyway_sessions() {
  local deadline="$1"
  postgres_query \
    "SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE application_name=:'flyway_application_name';" \
    "$deadline" \
    >/dev/null
}

terminate_flyway_sessions() {
  local deadline="$1"
  postgres_query \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name=:'flyway_application_name';" \
    "$deadline" \
    >/dev/null
}

drain_flyway_sessions() {
  local deadline="$1" count
  count="$(flyway_session_count "$deadline")" || return 1
  [[ "$count" == 0 ]] && return 0
  cancel_flyway_sessions "$deadline" || return 1
  sleep 2
  count="$(flyway_session_count "$deadline")" || return 1
  if [[ "$count" != 0 ]]; then
    terminate_flyway_sessions "$deadline" || return 1
    sleep 2
  fi
  [[ "$(flyway_session_count "$deadline")" == 0 ]]
}

delete_owned_job() {
  local deadline="$1" pod_count delete_timeout
  # Stop every possible reconnect source before inspecting server backends.
  # Foreground deletion plus the label-zero proof closes the old delete/query
  # TOCTOU: once Pod count is zero, only a detached PostgreSQL backend can remain.
  delete_timeout="$(remaining_seconds "$deadline" "$termination_grace_seconds")" || return 1
  timeout --signal=TERM --kill-after=2s "${delete_timeout}s" \
    kubectl --request-timeout="${delete_timeout}s" -n "$namespace" \
      delete job "$job" --ignore-not-found=true --cascade=foreground \
      --wait=true --timeout="${delete_timeout}s" >/dev/null || return 1
  pod_count="$(bounded_kubectl "$deadline" 10 -n "$namespace" \
    get pods -l "job-name=$job" -o json | python3 -c '
import json, sys
print(len(json.load(sys.stdin).get("items", [])))
')" || return 1
  [[ "$pod_count" == 0 ]] || return 1
  # drain_flyway_sessions ends with the final exact applicationName=0 proof.
  drain_flyway_sessions "$deadline"
}

write_cleanup_hold_evidence() {
  local reason="$1" hold_dir hold_tmp
  hold_dir="$(dirname "$cleanup_hold_file")"
  [[ ! -L "$cleanup_hold_file" ]] || return 1
  mkdir -p "$hold_dir" || return 1
  hold_tmp="$(mktemp "$hold_dir/.flyway-cleanup-hold.XXXXXX")" || return 1
  if ! HOLD_JOB="$job" HOLD_APPLICATION="$application_name" HOLD_NAMESPACE="$namespace" \
      HOLD_IMAGE="$image" HOLD_SOURCE="$source_commit" HOLD_REASON="$reason" \
      HOLD_CLEANUP_SECONDS="$cleanup_hold_seconds" HOLD_TERMINATION_SECONDS="$termination_grace_seconds" \
      python3 -c '
import datetime, json, os, sys
json.dump({
    "schemaVersion": 1,
    "status": "CLEANUP_UNPROVEN",
    "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "namespace": os.environ["HOLD_NAMESPACE"],
    "jobName": os.environ["HOLD_JOB"],
    "applicationName": os.environ["HOLD_APPLICATION"],
    "candidateImage": os.environ["HOLD_IMAGE"],
    "sourceCommit": os.environ["HOLD_SOURCE"],
    "reason": os.environ["HOLD_REASON"],
    "cleanupHoldSeconds": int(os.environ["HOLD_CLEANUP_SECONDS"]),
    "terminationGraceSeconds": int(os.environ["HOLD_TERMINATION_SECONDS"]),
}, sys.stdout, sort_keys=True, separators=(",", ":"))
sys.stdout.write("\n")
' >"$hold_tmp"; then
    rm -f "$hold_tmp"
    return 1
  fi
  chmod 0600 "$hold_tmp" || { rm -f "$hold_tmp"; return 1; }
  mv -fT -- "$hold_tmp" "$cleanup_hold_file"
}

clear_current_cleanup_hold_evidence() {
  local current_hash
  [[ "$cleanup_hold_hash" =~ ^[0-9a-f]{64}$ \
     && -f "$cleanup_hold_file" && ! -L "$cleanup_hold_file" \
     && "$(stat -c '%a' "$cleanup_hold_file" 2>/dev/null || true)" == 600 \
     && "$(stat -c '%u' "$cleanup_hold_file" 2>/dev/null || true)" == "$(id -u)" ]] \
    || return 1
  current_hash="$(sha256sum "$cleanup_hold_file" | awk '{print $1}')" || return 1
  [[ "$current_hash" == "$cleanup_hold_hash" ]] || return 1
  rm -f -- "$cleanup_hold_file"
  [[ ! -e "$cleanup_hold_file" && ! -L "$cleanup_hold_file" ]]
}

cleanup() {
  local original_status="$?" cleanup_deadline cleanup_started cleanup_attempts=0 cleanup_proven=false
  trap - EXIT
  rm -f "$manifest"
  if [[ "$job_applied" == true ]]; then
    if [[ "$job_terminal" != true ]]; then
      echo "[flyway-job] controlled abort: quiescing the owned DB session before Job cleanup: $job" >&2
    fi
    if ! cleanup_started="$(epoch_now)"; then
      write_cleanup_hold_evidence CLEANUP_CLOCK_UNAVAILABLE || true
      echo "[flyway-job] RECOVERY_HOLD cleanup clock is unavailable evidence=$cleanup_hold_file" >&2
      exit 79
    fi
    cleanup_deadline=$((cleanup_started + cleanup_hold_seconds))
    while :; do
      if delete_owned_job "$cleanup_deadline"; then
        cleanup_proven=true
        break
      fi
      cleanup_attempts=$((cleanup_attempts + 1))
      if (( cleanup_attempts >= 3 )) \
         || ! remaining_seconds "$cleanup_deadline" 1 >/dev/null; then
        write_cleanup_hold_evidence CLEANUP_BUDGET_EXHAUSTED || true
        echo "[flyway-job] RECOVERY_HOLD cleanup remains unproven after ${cleanup_hold_seconds}s evidence=$cleanup_hold_file" >&2
        original_status=79
        break
      fi
      echo "[flyway-job] bounded cleanup retry: exact primary session or Pod residue is not yet excluded: $job" >&2
      sleep 5
    done
    if [[ "$cleanup_proven" == true ]] && ! clear_current_cleanup_hold_evidence; then
      echo "[flyway-job] RECOVERY_HOLD cleanup was proven but its armed evidence could not be retired: $cleanup_hold_file" >&2
      original_status=79
    fi
  fi
  exit "$original_status"
}

recover_cleanup_hold() {
  local marker_hash cleanup_started cleanup_deadline marker_hash_after marker_output cleanup_attempts=0
  local -a marker=()
  if [[ ! -f "$cleanup_hold_file" || -L "$cleanup_hold_file" \
     || "$(stat -c '%a' "$cleanup_hold_file" 2>/dev/null || true)" != 600 \
     || "$(stat -c '%u' "$cleanup_hold_file" 2>/dev/null || true)" != "$(id -u)" ]]; then
    echo "[flyway-job] RECOVERY_HOLD evidence path/type/owner/mode is invalid: $cleanup_hold_file" >&2
    return 79
  fi
  marker_hash="$(sha256sum "$cleanup_hold_file" | awk '{print $1}')" || return 79
  marker_output="$(python3 - "$cleanup_hold_file" "$namespace" <<'PY'
import json
import re
import sys

path, expected_namespace = sys.argv[1:]
with open(path, encoding="utf-8") as stream:
    value = json.load(stream)
keys = {
    "applicationName", "candidateImage", "cleanupHoldSeconds", "createdAt",
    "jobName", "namespace", "reason", "schemaVersion", "sourceCommit",
    "status", "terminationGraceSeconds",
}
if not isinstance(value, dict) or set(value) != keys:
    raise SystemExit(2)
job = value.get("jobName")
application = value.get("applicationName")
source = value.get("sourceCommit")
image = value.get("candidateImage")
if value.get("schemaVersion") != 1 or value.get("status") != "CLEANUP_UNPROVEN":
    raise SystemExit(2)
if value.get("namespace") != expected_namespace:
    raise SystemExit(2)
if not isinstance(job, str) or not re.fullmatch(r"carbonet-flyway-[a-z0-9-]{1,42}", job):
    raise SystemExit(2)
if application != job:
    raise SystemExit(2)
if not isinstance(source, str) or not re.fullmatch(r"(?:[0-9a-f]{40}|UNBOUND)", source):
    raise SystemExit(2)
if not isinstance(image, str) or not re.fullmatch(r"[A-Za-z0-9._:/@+\-]{1,255}", image):
    raise SystemExit(2)
if value.get("reason") not in ("JOB_APPLY_ARMED", "CLEANUP_BUDGET_EXHAUSTED", "CLEANUP_CLOCK_UNAVAILABLE"):
    raise SystemExit(2)
if not isinstance(value.get("createdAt"), str) or len(value["createdAt"]) > 64:
    raise SystemExit(2)
if not isinstance(value.get("cleanupHoldSeconds"), int) or not 30 <= value["cleanupHoldSeconds"] <= 600:
    raise SystemExit(2)
if value.get("terminationGraceSeconds") != 30:
    raise SystemExit(2)
print(job)
print(application)
print(image)
print(source)
PY
  )" || {
    echo "[flyway-job] RECOVERY_HOLD evidence schema is invalid: $cleanup_hold_file" >&2
    return 79
  }
  mapfile -t marker <<<"$marker_output"
  [[ "${#marker[@]}" == 4 ]] || {
    echo "[flyway-job] RECOVERY_HOLD evidence fields are incomplete: $cleanup_hold_file" >&2
    return 79
  }
  job="${marker[0]}"
  application_name="${marker[1]}"
  image="${marker[2]}"
  source_commit="${marker[3]}"
  cleanup_started="$(epoch_now)" || return 79
  cleanup_deadline=$((cleanup_started + cleanup_hold_seconds))
  while ! delete_owned_job "$cleanup_deadline"; do
    cleanup_attempts=$((cleanup_attempts + 1))
    if (( cleanup_attempts >= 3 )) \
       || ! remaining_seconds "$cleanup_deadline" 1 >/dev/null; then
      echo "[flyway-job] RECOVERY_HOLD still unproven; evidence preserved: $cleanup_hold_file" >&2
      return 79
    fi
    sleep 5
  done
  marker_hash_after="$(sha256sum "$cleanup_hold_file" | awk '{print $1}')" || return 79
  if [[ "$marker_hash_after" != "$marker_hash" || ! -f "$cleanup_hold_file" \
     || -L "$cleanup_hold_file" \
     || "$(stat -c '%a' "$cleanup_hold_file" 2>/dev/null || true)" != 600 \
     || "$(stat -c '%u' "$cleanup_hold_file" 2>/dev/null || true)" != "$(id -u)" ]]; then
    echo '[flyway-job] RECOVERY_HOLD evidence changed during reconciliation; refusing removal' >&2
    return 79
  fi
  rm -f -- "$cleanup_hold_file"
  [[ ! -e "$cleanup_hold_file" && ! -L "$cleanup_hold_file" ]] || return 79
  echo "[flyway-job] RECOVERY_HOLD_CLEARED job=$job applicationName=$application_name podResidue=0 sessionResidue=0"
}

if [[ "$operation" == recover-cleanup-hold ]]; then
  trap - EXIT
  rm -f "$manifest"
  recover_cleanup_hold
  exit $?
fi
if [[ -e "$cleanup_hold_file" || -L "$cleanup_hold_file" ]]; then
  echo "[flyway-job] RECOVERY_HOLD blocks a new migration until reconciled: $cleanup_hold_file" >&2
  rm -f "$manifest"
  exit 79
fi
trap cleanup EXIT

if [[ ! "$migration_secret_name" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ ]]; then
  echo "[flyway-job] invalid migration Secret name" >&2
  exit 2
fi
if [[ ! "$migration_password_key" =~ ^[-._A-Za-z][-._A-Za-z0-9]*$ ]]; then
  echo "[flyway-job] invalid migration Secret key" >&2
  exit 2
fi
if [[ "$dry_run_mode" != "none" && "$dry_run_mode" != "client" && "$dry_run_mode" != "server" ]]; then
  echo "[flyway-job] CARBONET_FLYWAY_JOB_DRY_RUN must be none, client, or server" >&2
  exit 2
fi
if [[ "$dry_run_mode" != "client" ]]; then
  if ! bounded_kubectl_for 15 -n "$namespace" get secret "$migration_secret_name" -o json |
      MIGRATION_PASSWORD_KEY="$migration_password_key" python3 -c '
import json, os, sys
secret = json.load(sys.stdin)
value = secret.get("data", {}).get(os.environ["MIGRATION_PASSWORD_KEY"])
raise SystemExit(0 if isinstance(value, str) and value else 1)
' >/dev/null; then
    echo "[flyway-job] migration Secret or required key is unavailable" >&2
    exit 1
  fi
fi

bounded_kubectl_for 15 -n "$namespace" get deployment "$deployment" -o json |
  JOB_NAME="$job" CONTAINER_NAME="$container" CANDIDATE_IMAGE="$image" \
  APPLICATION_NAME="$application_name" \
  JOB_TIMEOUT_SECONDS="$timeout_seconds" TERMINATION_GRACE_SECONDS="$termination_grace_seconds" \
  STATEMENT_TIMEOUT_SECONDS="$statement_timeout_seconds" LOCK_TIMEOUT_SECONDS="$lock_timeout_seconds" \
  MIGRATION_SECRET_NAME="$migration_secret_name" MIGRATION_PASSWORD_KEY="$migration_password_key" \
  python3 -c '
import json, os, sys
source = json.load(sys.stdin)
pod = source["spec"]["template"]["spec"]
name = os.environ["CONTAINER_NAME"]
image = os.environ["CANDIDATE_IMAGE"]
containers = []
for current in pod["containers"]:
    if current["name"] != name:
        continue
    env = [
        value for value in current.get("env", [])
        if value.get("name") not in (
            "CARBONET_FLYWAY_ENABLED",
            "CARBONET_LIQUIBASE_ENABLED",
            "CARBONET_FLYWAY_APPLICATION_NAME",
            "CARBONET_FLYWAY_STATEMENT_TIMEOUT_SECONDS",
            "CARBONET_FLYWAY_LOCK_TIMEOUT_SECONDS",
            "SPRING_FLYWAY_PASSWORD",
        )
    ]
    env.extend([
        {"name": "CARBONET_FLYWAY_ENABLED", "value": "true"},
        {"name": "CARBONET_LIQUIBASE_ENABLED", "value": "false"},
        {"name": "CARBONET_FLYWAY_APPLICATION_NAME", "value": os.environ["APPLICATION_NAME"]},
        {"name": "CARBONET_FLYWAY_STATEMENT_TIMEOUT_SECONDS", "value": os.environ["STATEMENT_TIMEOUT_SECONDS"]},
        {"name": "CARBONET_FLYWAY_LOCK_TIMEOUT_SECONDS", "value": os.environ["LOCK_TIMEOUT_SECONDS"]},
        {
            "name": "SPRING_FLYWAY_PASSWORD",
            "valueFrom": {
                "secretKeyRef": {
                    "name": os.environ["MIGRATION_SECRET_NAME"],
                    "key": os.environ["MIGRATION_PASSWORD_KEY"],
                }
            },
        },
    ])
    migrated = {
        "name": "flyway",
        "image": image,
        "imagePullPolicy": "Never",
        "env": env,
        "envFrom": current.get("envFrom", []),
        "command": ["java"],
        "args": [
            "-XX:+UseContainerSupport",
            "-XX:+UseSerialGC",
            "-XX:TieredStopAtLevel=1",
            "-XX:MaxRAMPercentage=70",
            "-Dfile.encoding=UTF-8",
            "-cp", "/app/runtime/BOOT-INF/classes:/app/runtime/BOOT-INF/lib/*",
            "egovframework.com.migration.FlywayMigrationApplication",
        ],
        "resources": {
            "requests": {"cpu": "100m", "memory": "256Mi"},
            "limits": {"cpu": "2", "memory": "1Gi"},
        },
    }
    for key in ("volumeMounts", "securityContext"):
        if key in current:
            migrated[key] = current[key]
    containers.append(migrated)
if not containers:
    raise SystemExit(f"container not found: {name}")
job = {
    "apiVersion": "batch/v1",
    "kind": "Job",
    "metadata": {
        "name": os.environ["JOB_NAME"],
        "labels": {"app": "carbonet-flyway", "managed-by": "carbonet-auto-deploy"},
    },
    "spec": {
        "backoffLimit": 0,
        "activeDeadlineSeconds": int(os.environ["JOB_TIMEOUT_SECONDS"]),
        "ttlSecondsAfterFinished": 300,
        "template": {
            "metadata": {"labels": {"app": "carbonet-flyway"}},
            "spec": {
                "restartPolicy": "Never",
                "terminationGracePeriodSeconds": int(os.environ["TERMINATION_GRACE_SECONDS"]),
                "serviceAccountName": pod.get("serviceAccountName", "default"),
                "securityContext": {
                    "runAsUser": 1000,
                    "runAsGroup": 1000,
                    "runAsNonRoot": True,
                    "fsGroup": 1000,
                    "seccompProfile": {"type": "RuntimeDefault"},
                },
                "containers": containers,
                "volumes": pod.get("volumes", []),
            },
        },
    },
}
print(json.dumps(job))
' >"$manifest"

MIGRATION_SECRET_NAME="$migration_secret_name" MIGRATION_PASSWORD_KEY="$migration_password_key" \
  python3 - "$manifest" <<'PY'
import json
import os
import sys

job = json.load(open(sys.argv[1], encoding="utf-8"))
containers = job["spec"]["template"]["spec"]["containers"]
if len(containers) != 1:
    raise SystemExit("flyway manifest must contain exactly one container")
entries = [entry for entry in containers[0].get("env", []) if entry.get("name") == "SPRING_FLYWAY_PASSWORD"]
expected = {
    "name": "SPRING_FLYWAY_PASSWORD",
    "valueFrom": {
        "secretKeyRef": {
            "name": os.environ["MIGRATION_SECRET_NAME"],
            "key": os.environ["MIGRATION_PASSWORD_KEY"],
        }
    },
}
if entries != [expected]:
    raise SystemExit("flyway password must be one exact SecretKeyRef")
PY

if [[ "$dry_run_mode" != "none" ]]; then
  bounded_kubectl_for 30 -n "$namespace" apply --dry-run="$dry_run_mode" -f "$manifest" >/dev/null
  echo "[flyway-job] DRY_RUN_PASS mode=$dry_run_mode secretRef=$migration_secret_name/$migration_password_key"
  exit 0
fi

echo "[flyway-job] applying $job image=$image"
# Persist ownership before apply: an API timeout or process death can occur
# after the server accepted the Job, so the next invocation must see the exact
# cleanup obligation even if this shell never reaches its EXIT trap.
write_cleanup_hold_evidence JOB_APPLY_ARMED || {
  echo "[flyway-job] refusing Job apply because cleanup ownership could not be armed: $cleanup_hold_file" >&2
  exit 79
}
cleanup_hold_hash="$(sha256sum "$cleanup_hold_file" | awk '{print $1}')"
[[ "$cleanup_hold_hash" =~ ^[0-9a-f]{64}$ ]] || exit 79
job_applied=true
bounded_kubectl_for 30 -n "$namespace" apply -f "$manifest" >/dev/null
echo "[flyway-job] budget job=${timeout_seconds}s statement=${statement_timeout_seconds}s settle=${settle_seconds}s lock=${lock_timeout_seconds}s observer=${observer_timeout_seconds}s"

observer_started="$(epoch_now)" || {
  echo '[flyway-job] observer clock is unavailable after Job apply' >&2
  exit 1
}
observer_deadline=$((observer_started + observer_timeout_seconds))
terminal_state=""
while [[ -z "$terminal_state" ]]; do
  job_state="$(bounded_kubectl "$observer_deadline" 10 -n "$namespace" \
    get "job/$job" -o json 2>/dev/null | python3 -c '
import json, sys
try:
    job = json.load(sys.stdin)
except Exception:
    raise SystemExit(1)
conditions = {
    item.get("type"): item.get("status")
    for item in job.get("status", {}).get("conditions", [])
}
if conditions.get("Complete") == "True" or job.get("status", {}).get("succeeded", 0) >= 1:
    print("COMPLETE")
elif conditions.get("Failed") == "True" or job.get("status", {}).get("failed", 0) >= 1:
    print("FAILED")
else:
    print("ACTIVE")
' || printf UNKNOWN)"
  case "$job_state" in
    COMPLETE|FAILED)
      terminal_state="$job_state"
      job_terminal=true
      ;;
    *)
      if ! observer_sleep="$(remaining_seconds "$observer_deadline" 2)"; then
        terminal_state="OBSERVER_TIMEOUT"
      else
        sleep "$observer_sleep"
      fi
      ;;
  esac
done

if [[ "$terminal_state" != COMPLETE ]]; then
  diagnostic_started="$(epoch_now)" || diagnostic_started=0
  diagnostic_deadline=$((diagnostic_started + 20))
  bounded_kubectl "$diagnostic_deadline" 10 -n "$namespace" \
    logs "job/$job" --all-containers=true >"$log_dir/$job.log" 2>&1 || true
  bounded_kubectl "$diagnostic_deadline" 10 -n "$namespace" \
    describe "job/$job" >>"$log_dir/$job.log" 2>&1 || true
  echo "[flyway-job] failed state=$terminal_state; candidate image was not promoted (log=$log_dir/$job.log)" >&2
  exit 1
fi

bounded_kubectl_for 15 -n "$namespace" logs "job/$job" --all-containers=true >"$log_dir/$job.log"
if ! grep -q 'FLYWAY_MIGRATION_PASS' "$log_dir/$job.log"; then
  echo "[flyway-job] completion evidence was not found (log=$log_dir/$job.log)" >&2
  exit 1
fi
elapsed="$(( $(date +%s)-started_epoch ))"
echo "[flyway-job] PASS job=$job elapsed=${elapsed}s imagePullPolicy=Never log=$log_dir/$job.log"
