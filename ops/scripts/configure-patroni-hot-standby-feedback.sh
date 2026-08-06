#!/usr/bin/env bash
set -Eeuo pipefail
umask 027
{ set +x; } 2>/dev/null

NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
CLUSTER="${CARBONET_PATRONI_CLUSTER:-postgres-patroni}"
DESIRED_VALUE="on"
MAX_LAG_BYTES="${CARBONET_PATRONI_FEEDBACK_MAX_LAG_BYTES:-67108864}"
MAX_FEEDBACK_XMIN_AGE="${CARBONET_PATRONI_FEEDBACK_MAX_XMIN_AGE:-1000000}"
KUBECTL_TIMEOUT_SECONDS="${CARBONET_PATRONI_KUBECTL_TIMEOUT_SECONDS:-30}"
CONVERGE_TIMEOUT_SECONDS="${CARBONET_PATRONI_FEEDBACK_CONVERGE_TIMEOUT_SECONDS:-90}"
POLL_SECONDS="${CARBONET_PATRONI_FEEDBACK_POLL_SECONDS:-3}"
MODE="${1:-}"

log() {
  printf '[patroni-hot-standby-feedback] %s\n' "$*" >&2
}

fail() {
  log "ERROR: $*"
  exit 2
}

[[ -z "$MODE" || "$MODE" == "--check" ]] || {
  echo 'Usage: configure-patroni-hot-standby-feedback.sh [--check]' >&2
  exit 2
}
for command_name in kubectl jq timeout awk grep sort; do
  command -v "$command_name" >/dev/null 2>&1 || fail "$command_name is required"
done
for value in "$MAX_LAG_BYTES" "$MAX_FEEDBACK_XMIN_AGE" \
  "$KUBECTL_TIMEOUT_SECONDS" "$CONVERGE_TIMEOUT_SECONDS" "$POLL_SECONDS"; do
  [[ "$value" =~ ^[1-9][0-9]*$ ]] || fail "safety limits and timeouts must be positive integers"
done

kube() {
  timeout --signal=TERM --kill-after=5s "${KUBECTL_TIMEOUT_SECONDS}s" \
    kubectl --request-timeout="${KUBECTL_TIMEOUT_SECONDS}s" "$@"
}

patronictl_cmd() {
  local pod="$1"
  shift
  timeout --signal=TERM --kill-after=5s "${KUBECTL_TIMEOUT_SECONDS}s" \
    kubectl --request-timeout="${KUBECTL_TIMEOUT_SECONDS}s" \
      -n "$NAMESPACE" exec "$pod" -c patroni -- \
      patronictl -c /tmp/patroni.yml "$@"
}

mapfile -t pods < <(kube -n "$NAMESPACE" get pods -l app=postgres-patroni \
  -o jsonpath='{range .items[?(@.status.phase=="Running")]}{.metadata.name}{"|"}{.status.containerStatuses[0].ready}{"\n"}{end}' \
  | awk -F'|' '$2 == "true" { print $1 }' | sort)
[[ "${#pods[@]}" -eq 3 ]] || fail "expected 3 Ready Patroni members, found ${#pods[@]}"
control_pod="${pods[0]}"

cluster_json() {
  patronictl_cmd "$control_pod" list "$CLUSTER" -f json
}

sql() {
  local pod="$1" statement="$2"
  kube -n "$NAMESPACE" exec "$pod" -c patroni -- \
    psql -h /tmp -U postgres -d carbonet -X -Atqc "$statement"
}

show_feedback() {
  sql "$1" 'show hot_standby_feedback'
}

dcs_has_feedback() {
  local config="$1"
  grep -Eq '^[[:space:]]*hot_standby_feedback:[[:space:]]*(on|true|"on"|'"'"'on'"'"')[[:space:]]*$' <<<"$config"
}

read_topology() {
  topology="$(cluster_json)" || fail 'unable to read Patroni topology'
  jq -e --argjson maxLagBytes "$MAX_LAG_BYTES" '
    def lag_bytes: (((."Lag in MB" // 0) | tonumber) * 1048576);
    length == 3 and
    ([.[] | select(
      (.Role | ascii_downcase) == "leader" and
      (.State | ascii_downcase) == "running"
    )] | length == 1) and
    ([.[] | select(
      (.Role | ascii_downcase) == "replica" and
      (.State | ascii_downcase) == "streaming" and
      lag_bytes <= $maxLagBytes
    )] | length == 2)
  ' >/dev/null <<<"$topology" || fail "Patroni must have 1 running leader and 2 streaming replicas within ${MAX_LAG_BYTES} bytes lag"
  leader="$(jq -r '.[] | select((.Role | ascii_downcase) == "leader") | .Member' <<<"$topology")"
  [[ -n "$leader" ]] || fail 'Patroni leader is missing'
}

validate_runtime_safety() {
  local pod ready sql_health replication total streaming lag xmin_age
  read_topology
  for pod in "${pods[@]}"; do
    ready="$(kube -n "$NAMESPACE" get pod "$pod" -o jsonpath='{.status.containerStatuses[0].ready}')" || return 1
    [[ "$ready" == "true" ]] || return 1
    sql_health="$(sql "$pod" 'select 1')" || return 1
    [[ "$sql_health" == "1" ]] || return 1
  done
  replication="$(sql "$leader" "select count(*)||'|'||count(*) filter(where state='streaming')||'|'||coalesce(max(pg_wal_lsn_diff(pg_current_wal_lsn(),replay_lsn)),0)::bigint||'|'||coalesce(max(age(backend_xmin)) filter(where backend_xmin is not null),0)::bigint from pg_stat_replication")" || return 1
  IFS='|' read -r total streaming lag xmin_age <<<"$replication"
  [[ "$total" == "2" && "$streaming" == "2" ]] || return 1
  [[ "$lag" =~ ^[0-9]+$ && "$xmin_age" =~ ^[0-9]+$ ]] || return 1
  (( lag <= MAX_LAG_BYTES )) || return 1
  (( xmin_age <= MAX_FEEDBACK_XMIN_AGE )) || return 1
}

all_members_have_feedback() {
  local pod value
  for pod in "${pods[@]}"; do
    value="$(show_feedback "$pod")" || return 1
    [[ "$value" == "$DESIRED_VALUE" ]] || return 1
  done
}

validate_runtime_safety || fail "replication health, lag, or feedback xmin age exceeds the safety contract (lag<=${MAX_LAG_BYTES}, xminAge<=${MAX_FEEDBACK_XMIN_AGE})"
dcs_config="$(patronictl_cmd "$control_pod" show-config)" || fail 'unable to read Patroni DCS configuration'

if dcs_has_feedback "$dcs_config" && all_members_have_feedback; then
  log "PASS no-op members=3 hot_standby_feedback=on maxLagBytes=$MAX_LAG_BYTES maxFeedbackXminAge=$MAX_FEEDBACK_XMIN_AGE"
  exit 0
fi
[[ "$MODE" != "--check" ]] || fail 'hot_standby_feedback contract drift detected in check mode'

# hot_standby_feedback prevents a long read-only pg_dump on a replica from
# being canceled by recovery cleanup. It can retain dead tuples on the leader,
# so this script fails closed on replica lag and feedback xmin age. The backup
# CronJobs additionally cap dump lifetime with activeDeadlineSeconds.
patronictl_cmd "$control_pod" edit-config "$CLUSTER" \
  --pg "hot_standby_feedback=$DESIRED_VALUE" --force >/dev/null
# A DCS value may already be correct while one member missed a previous
# callback. Patroni reload is SIGHUP-only and deliberately avoids pod or
# PostgreSQL restart while forcing all members to consume the dynamic value.
patronictl_cmd "$control_pod" reload "$CLUSTER" --force >/dev/null

deadline=$((SECONDS + CONVERGE_TIMEOUT_SECONDS))
while (( SECONDS < deadline )); do
  dcs_config="$(patronictl_cmd "$control_pod" show-config 2>/dev/null || true)"
  if dcs_has_feedback "$dcs_config" && all_members_have_feedback && validate_runtime_safety; then
    log "PASS reconciled members=3 hot_standby_feedback=on maxLagBytes=$MAX_LAG_BYTES maxFeedbackXminAge=$MAX_FEEDBACK_XMIN_AGE restartRequired=false"
    exit 0
  fi
  sleep "$POLL_SECONDS"
done

fail "hot_standby_feedback did not converge on all 3 members within ${CONVERGE_TIMEOUT_SECONDS}s"
