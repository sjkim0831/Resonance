#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${CARBONET_NAMESPACE:-carbonet-prod}"
CLUSTER_NAME="${PATRONI_CLUSTER_NAME:-postgres-patroni}"
STATEFULSET="${PATRONI_STATEFULSET:-postgres-patroni}"
STATE_DIR="${PATRONI_HEAL_STATE_DIR:-/opt/resonance-data/control-plane/state/patroni-auto-heal}"
LOG_FILE="${PATRONI_HEAL_LOG_FILE:-/opt/Resonance/var/log/patroni-auto-heal.log}"
COOLDOWN_SECONDS="${PATRONI_REINIT_COOLDOWN_SECONDS:-21600}"
WAIT_SECONDS="${PATRONI_REINIT_WAIT_SECONDS:-900}"
FAILURE_THRESHOLD="${PATRONI_FAILURE_THRESHOLD:-3}"
BACKUP_MAX_AGE_SECONDS="${PATRONI_BACKUP_MAX_AGE_SECONDS:-93600}"
BACKUP_ROOT="${PATRONI_BACKUP_ROOT:-/opt/resonance-data/backups/postgres}"
DRY_RUN="${PATRONI_AUTO_HEAL_DRY_RUN:-false}"

mkdir -p "$STATE_DIR" "$(dirname "$LOG_FILE")"
exec 9>"$STATE_DIR/lock"
flock -n 9 || {
  echo "[patroni-auto-heal] another recovery is running"
  exit 0
}

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG_FILE"
}

jsonpath() {
  kubectl -n "$NAMESPACE" get statefulset "$STATEFULSET" -o "jsonpath={$1}"
}

assert_rollout_idle() {
  local desired ready updated current_revision update_revision
  desired="$(jsonpath '.spec.replicas')"
  ready="$(jsonpath '.status.readyReplicas')"
  updated="$(jsonpath '.status.updatedReplicas')"
  current_revision="$(jsonpath '.status.currentRevision')"
  update_revision="$(jsonpath '.status.updateRevision')"

  if [[ "${ready:-0}" != "$desired" || "${updated:-0}" != "$desired" ||
        -z "$current_revision" || "$current_revision" != "$update_revision" ]]; then
    log "REFUSED: StatefulSet rollout is active ready=${ready:-0}/$desired updated=${updated:-0}/$desired revision=$current_revision/$update_revision"
    exit 20
  fi
}

coordinator_pod() {
  kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni \
    -o jsonpath='{range .items[?(@.status.containerStatuses[0].ready==true)]}{.metadata.name}{"\n"}{end}' |
    head -1
}

cluster_json() {
  local pod="$1"
  kubectl -n "$NAMESPACE" exec "$pod" -- \
    curl -fsS http://127.0.0.1:8008/cluster
}

analyze_cluster() {
  python3 -c '
import json, sys
d=json.load(sys.stdin)
members=d.get("members") or []
leaders=[m for m in members if m.get("role") in ("leader","master") and m.get("state")=="running"]
healthy_replicas=[m for m in members if m.get("role")=="replica" and m.get("state")=="streaming" and int(m.get("lag") or 0)==0]
targets=[m for m in members if m.get("role")=="replica" and m.get("state") in ("start failed","stopped")]
if len(leaders)!=1 or len(healthy_replicas)<1:
    raise SystemExit(21)
if len(targets)>1:
    raise SystemExit(22)
print(targets[0]["name"] if targets else "")
'
}

assert_cooldown() {
  local target="$1" stamp="$STATE_DIR/$target.last-reinit" now last
  now="$(date +%s)"
  last="$(cat "$stamp" 2>/dev/null || echo 0)"
  if (( now - last < COOLDOWN_SECONDS )); then
    log "REFUSED: cooldown active target=$target remaining=$((COOLDOWN_SECONDS - now + last))s"
    exit 23
  fi
}

observe_stable_failure() {
  local target="$1" observation_file="$STATE_DIR/failure-observation" previous_target count
  previous_target=""
  count=0
  if [[ -f "$observation_file" ]]; then
    read -r previous_target count <"$observation_file" || true
  fi
  [[ "$previous_target" == "$target" ]] || count=0
  count=$((count + 1))
  printf '%s %s\n' "$target" "$count" >"$observation_file"
  if (( count < FAILURE_THRESHOLD )); then
    log "OBSERVE: target=$target consecutive=$count/$FAILURE_THRESHOLD; no mutation"
    exit 0
  fi
  rm -f "$observation_file"
}

assert_recent_verified_backup() {
  local primary_dir="$BACKUP_ROOT/primary/hourly"
  local mirror_dir="$BACKUP_ROOT/mirror/hourly"
  local primary_dump primary_name mirror_dump now modified
  primary_dump="$(find "$primary_dir" -maxdepth 1 -type f -name '*.dump' -printf '%T@ %p\n' |
    sort -nr | head -1 | cut -d' ' -f2-)"
  [[ -n "$primary_dump" ]] || {
    log "REFUSED: no primary backup"
    exit 27
  }
  primary_name="$(basename "$primary_dump")"
  mirror_dump="$mirror_dir/$primary_name"
  [[ -f "$primary_dump.sha256" && -f "$mirror_dump" && -f "$mirror_dump.sha256" ]] || {
    log "REFUSED: backup mirror or checksum missing name=$primary_name"
    exit 28
  }
  now="$(date +%s)"
  modified="$(stat -c %Y "$primary_dump")"
  if (( now - modified > BACKUP_MAX_AGE_SECONDS )); then
    log "REFUSED: latest backup is stale name=$primary_name age=$((now - modified))s"
    exit 29
  fi
  [[ "$(stat -c %s "$primary_dump")" == "$(stat -c %s "$mirror_dump")" ]] || {
    log "REFUSED: primary/mirror backup sizes differ name=$primary_name"
    exit 30
  }
  (
    cd "$primary_dir"
    sha256sum -c "$primary_name.sha256"
  ) >/dev/null
  (
    cd "$mirror_dir"
    sha256sum -c "$primary_name.sha256"
  ) >/dev/null
  log "BACKUP_OK name=$primary_name size=$(stat -c %s "$primary_dump")"
}

wait_for_streaming() {
  local pod="$1" target="$2" deadline=$((SECONDS + WAIT_SECONDS)) payload state lag
  while (( SECONDS < deadline )); do
    payload="$(cluster_json "$pod" 2>/dev/null || true)"
    if [[ -n "$payload" ]]; then
      read -r state lag < <(python3 -c '
import json,sys
d=json.load(sys.stdin)
t=sys.argv[1]
m=next((x for x in d.get("members",[]) if x.get("name")==t),{})
print(m.get("state","missing"),m.get("lag","unknown"))
' "$target" <<<"$payload")
      log "target=$target state=$state lag=$lag"
      [[ "$state" == "streaming" && "$lag" == "0" ]] && return 0
    fi
    sleep 10
  done
  return 1
}

main() {
  assert_rollout_idle

  local pod payload target
  pod="$(coordinator_pod)"
  [[ -n "$pod" ]] || {
    log "REFUSED: no ready Patroni coordinator"
    exit 24
  }
  payload="$(cluster_json "$pod")"
  target="$(analyze_cluster <<<"$payload")" || {
    log "REFUSED: cluster lacks one leader plus one zero-lag streaming replica, or has multiple failed replicas"
    exit 25
  }

  if [[ -z "$target" ]]; then
    rm -f "$STATE_DIR/failure-observation"
    log "PASS: all Patroni members are healthy"
    exit 0
  fi

  observe_stable_failure "$target"
  assert_cooldown "$target"
  assert_rollout_idle
  assert_recent_verified_backup
  log "SAFE_REINIT target=$target coordinator=$pod"
  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY_RUN: reinit skipped"
    exit 0
  fi

  kubectl -n "$NAMESPACE" exec "$pod" -- \
    patronictl -c /tmp/patroni.yml reinit "$CLUSTER_NAME" "$target" --force
  date +%s >"$STATE_DIR/$target.last-reinit"

  wait_for_streaming "$pod" "$target" || {
    log "FAILED: target did not reach streaming lag=0 within ${WAIT_SECONDS}s"
    exit 26
  }
  assert_rollout_idle
  log "PASS: target=$target streaming lag=0"
}

main "$@"
