#!/usr/bin/env bash
set -Eeuo pipefail
umask 027
{ set +x; } 2>/dev/null

NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
CLUSTER="${CARBONET_PATRONI_CLUSTER:-postgres-patroni}"
CONFIGMAP="${CARBONET_PATRONI_CONFIGMAP:-patroni-template}"
SHARED_BUFFERS="${CARBONET_PATRONI_SHARED_BUFFERS:-1GB}"
WORK_MEM="${CARBONET_PATRONI_WORK_MEM:-16MB}"
MAINTENANCE_WORK_MEM="${CARBONET_PATRONI_MAINTENANCE_WORK_MEM:-128MB}"
TEMP_FILE_LIMIT="${CARBONET_PATRONI_TEMP_FILE_LIMIT:-8GB}"
HEAVY_DB_LOCK_FILE="${RESONANCE_HEAVY_DB_LOCK_FILE:-/opt/resonance-data/control-plane/run/heavy-db-automation.lock}"
BACKUP_SELECTOR="${CARBONET_POSTGRES_BACKUP_SELECTOR:-app=postgres-backup}"
KUBECTL_TIMEOUT_SECONDS="${CARBONET_PATRONI_KUBECTL_TIMEOUT_SECONDS:-30}"
ROLLING_STEP_TIMEOUT_SECONDS="${CARBONET_PATRONI_ROLLING_STEP_TIMEOUT_SECONDS:-240}"
READY_TIMEOUT_SECONDS="${CARBONET_PATRONI_READY_TIMEOUT_SECONDS:-180}"
POLL_SECONDS="${CARBONET_PATRONI_POLL_SECONDS:-3}"
RELOAD_WAIT_SECONDS="${CARBONET_PATRONI_RELOAD_WAIT_SECONDS:-12}"

log() {
  printf '[patroni-memory-safety] %s\n' "$*" >&2
}

fail() {
  log "ERROR: $*"
  exit 2
}

for command_name in kubectl jq flock timeout awk sed sort; do
  command -v "$command_name" >/dev/null 2>&1 || fail "$command_name is required"
done

for value in "$SHARED_BUFFERS" "$WORK_MEM" "$MAINTENANCE_WORK_MEM" "$TEMP_FILE_LIMIT"; do
  [[ "$value" =~ ^[0-9]+(kB|MB|GB|TB)$ ]] || fail "invalid memory value: $value"
done
for value in "$KUBECTL_TIMEOUT_SECONDS" "$ROLLING_STEP_TIMEOUT_SECONDS" \
  "$READY_TIMEOUT_SECONDS" "$POLL_SECONDS" "$RELOAD_WAIT_SECONDS"; do
  [[ "$value" =~ ^[1-9][0-9]*$ ]] || fail "timeout values must be positive integers"
done

kube() {
  timeout --signal=TERM --kill-after=5s "${KUBECTL_TIMEOUT_SECONDS}s" \
    kubectl --request-timeout="${KUBECTL_TIMEOUT_SECONDS}s" "$@"
}

patronictl_cmd() {
  local pod="$1"
  shift
  timeout --signal=TERM --kill-after=5s "${ROLLING_STEP_TIMEOUT_SECONDS}s" \
    kubectl --request-timeout="${ROLLING_STEP_TIMEOUT_SECONDS}s" \
      -n "$NAMESPACE" exec "$pod" -- patronictl -c /tmp/patroni.yml "$@"
}

mapfile -t pods < <(kube -n "$NAMESPACE" get pods -l app=postgres-patroni \
  -o jsonpath='{range .items[?(@.status.phase=="Running")]}{.metadata.name}{"|"}{.status.containerStatuses[0].ready}{"\n"}{end}' \
  | awk -F'|' '$2 == "true" { print $1 }' | sort)
[[ "${#pods[@]}" -eq 3 ]] || fail "expected 3 Ready Patroni members, found ${#pods[@]}"
control_pod="${pods[0]}"

cluster_json() {
  patronictl_cmd "$control_pod" list "$CLUSTER" -f json
}

validate_cluster_health() {
  local topology
  topology="$(cluster_json)" || return 1
  jq -e '
    length == 3 and
    ([.[] | select((.Role | ascii_downcase) == "leader" and (.State | ascii_downcase) == "running")] | length == 1) and
    ([.[] | select(
      (.Role | ascii_downcase) == "replica" and
      (.State | ascii_downcase) == "streaming" and
      (((."Lag in MB" // 0) | tonumber) == 0)
    )] | length == 2)
  ' >/dev/null <<<"$topology" || return 1
  local pod ready
  for pod in "${pods[@]}"; do
    ready="$(kube -n "$NAMESPACE" get pod "$pod" \
      -o jsonpath='{.status.containerStatuses[0].ready}')" || return 1
    [[ "$ready" == "true" ]] || return 1
  done
}

validate_cluster_health || fail 'Patroni topology must be 1 running leader plus 2 streaming zero-lag replicas before reconciliation'

ensure_yaml_parameter() {
  local source="$1" key="$2" value="$3"
  if grep -Eq "^[[:space:]]*${key}:[[:space:]]*" <<<"$source"; then
    sed -E "s/^([[:space:]]*)${key}:[[:space:]]*.*/\\1${key}: ${value}/" <<<"$source"
    return
  fi
  awk -v key="$key" -v value="$value" '
    {
      print
      if (!inserted && $0 ~ /^[[:space:]]*parameters:[[:space:]]*$/) {
        match($0, /^[[:space:]]*/)
        indent = substr($0, 1, RLENGTH)
        print indent "  " key ": " value
        inserted = 1
      }
    }
    END { if (!inserted) exit 4 }
  ' <<<"$source"
}

yaml_has_contract() {
  local source="$1"
  yaml_parameter_matches "$source" shared_buffers "$SHARED_BUFFERS" &&
    yaml_parameter_matches "$source" work_mem "$WORK_MEM" &&
    yaml_parameter_matches "$source" maintenance_work_mem "$MAINTENANCE_WORK_MEM" &&
    yaml_parameter_matches "$source" temp_file_limit "$TEMP_FILE_LIMIT"
}

yaml_parameter_matches() {
  local source="$1" key="$2" expected="$3" total matched
  total="$(grep -Ec "^[[:space:]]*${key}:[[:space:]]*" <<<"$source" || true)"
  matched="$(grep -Ec "^[[:space:]]*${key}:[[:space:]]*${expected}$" <<<"$source" || true)"
  [[ "$total" -gt 0 && "$matched" -eq "$total" ]]
}

sql_contract() {
  local pod="$1"
  kube -n "$NAMESPACE" exec "$pod" -- \
    psql -h /tmp -U postgres -d carbonet -X -Atqc \
      "select current_setting('shared_buffers')||'|'||current_setting('work_mem')||'|'||current_setting('maintenance_work_mem')||'|'||current_setting('temp_file_limit')"
}

expected_sql_contract="${SHARED_BUFFERS}|${WORK_MEM}|${MAINTENANCE_WORK_MEM}|${TEMP_FILE_LIMIT}"
dcs_config="$(patronictl_cmd "$control_pod" show-config)"
config_source="$(kube -n "$NAMESPACE" get configmap "$CONFIGMAP" -o jsonpath='{.data.patroni\.yml}')"
contract_mismatch=0
yaml_has_contract "$dcs_config" || contract_mismatch=1
yaml_has_contract "$config_source" || contract_mismatch=1
for pod in "${pods[@]}"; do
  local_config="$(kube -n "$NAMESPACE" exec "$pod" -- cat /tmp/patroni.yml)"
  yaml_has_contract "$local_config" || contract_mismatch=1
  [[ "$(sql_contract "$pod")" == "$expected_sql_contract" ]] || contract_mismatch=1
done

# The normal deployment path is read-only and lock-free. Only actual drift may
# serialize the shared heavy-DB lane and consider a rolling restart.
if [[ "$contract_mismatch" -eq 0 ]]; then
  log "PASS no-op members=3 shared_buffers=$SHARED_BUFFERS work_mem=$WORK_MEM maintenance_work_mem=$MAINTENANCE_WORK_MEM temp_file_limit=$TEMP_FILE_LIMIT"
  exit 0
fi

mkdir -p "$(dirname "$HEAVY_DB_LOCK_FILE")"
exec 7>"$HEAVY_DB_LOCK_FILE"
if ! flock -n 7; then
  log 'DEFERRED heavy DB automation lock is busy; reconciliation will retry'
  exit 0
fi

if ! running_backup_pods="$(kube -n "$NAMESPACE" get pods -l "$BACKUP_SELECTOR" \
  --field-selector=status.phase=Running -o name 2>/dev/null)"; then
  fail 'could not verify whether a PostgreSQL backup pod is active'
fi
if [[ -n "$running_backup_pods" ]]; then
  log 'DEFERRED an active PostgreSQL backup pod blocks memory reconciliation'
  exit 0
fi

topology="$(cluster_json)"
leader="$(jq -r '.[] | select((.Role | ascii_downcase) == "leader") | .Member' <<<"$topology")"
mapfile -t replicas < <(jq -r '.[] | select((.Role | ascii_downcase) == "replica") | .Member' <<<"$topology" | sort)
[[ -n "$leader" && "${#replicas[@]}" -eq 2 ]] || fail 'could not identify one leader and two replicas dynamically'

backup_sessions="$(kube -n "$NAMESPACE" exec "$leader" -- \
  psql -h /tmp -U postgres -d carbonet -X -Atqc \
    "select count(*) from pg_stat_activity where pid<>pg_backend_pid() and (lower(application_name) like '%pg_dump%' or lower(application_name) like '%pg_basebackup%' or application_name like 'carbonet-auto-deploy-%')")"
[[ "$backup_sessions" == "0" ]] || {
  log 'DEFERRED an active PostgreSQL backup session blocks memory reconciliation'
  exit 0
}

# Persist the same contract in all three precedence layers before restarting
# any member. Reruns repair an interrupted attempt without repeating healthy
# member restarts.
if ! yaml_has_contract "$config_source"; then
  config_updated="$config_source"
  for entry in \
    "shared_buffers=$SHARED_BUFFERS" \
    "work_mem=$WORK_MEM" \
    "maintenance_work_mem=$MAINTENANCE_WORK_MEM" \
    "temp_file_limit=$TEMP_FILE_LIMIT"; do
    config_updated="$(ensure_yaml_parameter "$config_updated" "${entry%%=*}" "${entry#*=}")"
  done
  patch="$(jq -cn --arg value "$config_updated" \
    '[{"op":"replace","path":"/data/patroni.yml","value":$value}]')"
  kube -n "$NAMESPACE" patch configmap "$CONFIGMAP" --type=json -p "$patch" >/dev/null
fi

if ! yaml_has_contract "$dcs_config"; then
  patronictl_cmd "$control_pod" edit-config "$CLUSTER" \
    --pg "shared_buffers=$SHARED_BUFFERS" \
    --pg "work_mem=$WORK_MEM" \
    --pg "maintenance_work_mem=$MAINTENANCE_WORK_MEM" \
    --pg "temp_file_limit=$TEMP_FILE_LIMIT" --force >/dev/null
fi

local_config_changed=0
for pod in "${pods[@]}"; do
  local_config="$(kube -n "$NAMESPACE" exec "$pod" -- cat /tmp/patroni.yml)"
  if yaml_has_contract "$local_config"; then
    continue
  fi
  local_updated="$local_config"
  for entry in \
    "shared_buffers=$SHARED_BUFFERS" \
    "work_mem=$WORK_MEM" \
    "maintenance_work_mem=$MAINTENANCE_WORK_MEM" \
    "temp_file_limit=$TEMP_FILE_LIMIT"; do
    local_updated="$(ensure_yaml_parameter "$local_updated" "${entry%%=*}" "${entry#*=}")"
  done
  printf '%s\n' "$local_updated" | kube -n "$NAMESPACE" exec -i "$pod" -- sh -c \
    'next=/tmp/patroni.yml.memory-safety.next; cat >"$next"; cat "$next" > /tmp/patroni.yml; rm -f "$next"; kill -HUP 1'
  local_config_changed=1
done
if [[ "$local_config_changed" -eq 1 ]]; then
  sleep "$RELOAD_WAIT_SECONDS"
fi

wait_for_member_contract() {
  local member="$1" expected_role="$2" expected_state="$3"
  local deadline=$((SECONDS + READY_TIMEOUT_SECONDS))
  while (( SECONDS < deadline )); do
    local ready='false' actual='' member_row=''
    ready="$(kube -n "$NAMESPACE" get pod "$member" \
      -o jsonpath='{.status.containerStatuses[0].ready}' 2>/dev/null || true)"
    actual="$(sql_contract "$member" 2>/dev/null || true)"
    member_row="$(cluster_json 2>/dev/null | jq -c --arg member "$member" \
      '.[] | select(.Member == $member)' 2>/dev/null || true)"
    if [[ "$ready" == "true" && "$actual" == "$expected_sql_contract" ]] &&
      jq -e --arg role "$expected_role" --arg state "$expected_state" '
        (.Role | ascii_downcase) == ($role | ascii_downcase) and
        (.State | ascii_downcase) == ($state | ascii_downcase) and
        (($role | ascii_downcase) != "replica" or (((."Lag in MB" // 0) | tonumber) == 0))
      ' >/dev/null 2>&1 <<<"$member_row"; then
      return 0
    fi
    sleep "$POLL_SECONDS"
  done
  log "member did not converge within ${READY_TIMEOUT_SECONDS}s: $member role=$expected_role state=$expected_state"
  return 1
}

restart_member() {
  local member="$1" role="$2" state="$3"
  log "restarting $member after persistent contract drift"
  # Recreate the pod instead of issuing a PostgreSQL-only restart. This also
  # proves that the persisted ConfigMap survives a full member lifecycle and
  # works when the old leader is briefly stopped after switchover.
  kube -n "$NAMESPACE" delete pod "$member" --wait=false >/dev/null
  timeout --signal=TERM --kill-after=5s "${ROLLING_STEP_TIMEOUT_SECONDS}s" \
    kubectl --request-timeout="${ROLLING_STEP_TIMEOUT_SECONDS}s" \
      -n "$NAMESPACE" wait --for=condition=Ready "pod/$member" \
      --timeout="${READY_TIMEOUT_SECONDS}s" >/dev/null
  wait_for_member_contract "$member" "$role" "$state"
  validate_cluster_health || fail "cluster health failed after restarting $member"
}

wait_for_demoted_member() {
  local member="$1" deadline=$((SECONDS + READY_TIMEOUT_SECONDS)) member_row=''
  while (( SECONDS < deadline )); do
    member_row="$(cluster_json 2>/dev/null | jq -c --arg member "$member" \
      '.[] | select(.Member == $member)' 2>/dev/null || true)"
    if jq -e '
      (.Role | ascii_downcase) == "replica" and
      ((.State | ascii_downcase) == "streaming" or
       (.State | ascii_downcase) == "running" or
       (.State | ascii_downcase) == "stopped")
    ' >/dev/null 2>&1 <<<"$member_row"; then
      return 0
    fi
    sleep "$POLL_SECONDS"
  done
  return 1
}

# Restart only replicas whose effective SQL contract is still stale. A run
# interrupted after either member can safely resume without touching it again.
for replica in "${replicas[@]}"; do
  if [[ "$(sql_contract "$replica")" != "$expected_sql_contract" ]]; then
    current_role="$(cluster_json | jq -r --arg member "$replica" \
      '.[] | select(.Member == $member) | .Role | ascii_downcase')"
    [[ "$current_role" == "replica" ]] || fail "$replica changed role before restart; retry with fresh topology"
    restart_member "$replica" replica streaming
  fi
done

# shared_buffers is postmaster-scoped. Move leadership to an already verified
# replica before restarting a stale leader; never restart the active leader.
topology="$(cluster_json)"
leader="$(jq -r '.[] | select((.Role | ascii_downcase) == "leader") | .Member' <<<"$topology")"
if [[ "$(sql_contract "$leader")" != "$expected_sql_contract" ]]; then
  candidate="$(jq -r --arg leader "$leader" --arg expected "$expected_sql_contract" '
    [.[] | select(
      .Member != $leader and
      (.Role | ascii_downcase) == "replica" and
      (.State | ascii_downcase) == "streaming" and
      (((."Lag in MB" // 0) | tonumber) == 0)
    ) | .Member] | first // empty
  ' <<<"$topology")"
  [[ -n "$candidate" ]] || fail 'no streaming zero-lag switchover candidate is available'
  [[ "$(sql_contract "$candidate")" == "$expected_sql_contract" ]] || fail 'switchover candidate does not satisfy the SQL memory contract'
  log "planned switchover $leader -> $candidate"
  patronictl_cmd "$control_pod" switchover "$CLUSTER" \
    --leader "$leader" --candidate "$candidate" --force >/dev/null
  wait_for_member_contract "$candidate" leader running || fail 'planned switchover candidate did not become leader'
  wait_for_demoted_member "$leader" || fail 'old leader did not demote after planned switchover'
  restart_member "$leader" replica streaming
fi

validate_cluster_health || fail 'final Patroni topology validation failed'
dcs_config="$(patronictl_cmd "$control_pod" show-config)"
config_source="$(kube -n "$NAMESPACE" get configmap "$CONFIGMAP" -o jsonpath='{.data.patroni\.yml}')"
yaml_has_contract "$dcs_config" || fail 'final DCS memory contract mismatch'
yaml_has_contract "$config_source" || fail 'final ConfigMap memory contract mismatch'
for pod in "${pods[@]}"; do
  local_config="$(kube -n "$NAMESPACE" exec "$pod" -- cat /tmp/patroni.yml)"
  yaml_has_contract "$local_config" || fail "final local memory contract mismatch: $pod"
  [[ "$(sql_contract "$pod")" == "$expected_sql_contract" ]] || fail "final SQL memory contract mismatch: $pod"
done

log "PASS reconciled members=3 shared_buffers=$SHARED_BUFFERS work_mem=$WORK_MEM maintenance_work_mem=$MAINTENANCE_WORK_MEM temp_file_limit=$TEMP_FILE_LIMIT"
