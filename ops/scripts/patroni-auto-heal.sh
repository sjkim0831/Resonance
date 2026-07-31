#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${CARBONET_NAMESPACE:-carbonet-prod}"
CLUSTER_NAME="${PATRONI_CLUSTER_NAME:-postgres-patroni}"
STATEFULSET="${PATRONI_STATEFULSET:-postgres-patroni}"
STATE_DIR="${PATRONI_HEAL_STATE_DIR:-/opt/resonance-data/control-plane/state/patroni-auto-heal}"
LOG_FILE="${PATRONI_HEAL_LOG_FILE:-/opt/Resonance/var/log/patroni-auto-heal.log}"
COOLDOWN_SECONDS="${PATRONI_REINIT_COOLDOWN_SECONDS:-21600}"
WAIT_SECONDS="${PATRONI_REINIT_WAIT_SECONDS:-900}"
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
    log "PASS: all Patroni members are healthy"
    exit 0
  fi

  assert_cooldown "$target"
  assert_rollout_idle
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
