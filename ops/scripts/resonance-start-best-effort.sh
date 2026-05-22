#!/usr/bin/env bash
set -u -o pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/var/logs}"
EVENT_LOG="${EVENT_LOG:-$ROOT_DIR/var/ai-runtime/start-best-effort-events.jsonl}"
MODE="${MODE:-auto}"
PREFLIGHT_LOG="${PREFLIGHT_LOG:-$LOG_DIR/resonance-start-best-effort-preflight.log}"
REQUIRE_K8S="${REQUIRE_K8S:-true}"
REQUIRE_BROKER="${REQUIRE_BROKER:-true}"
REQUIRE_PERMISSIONS="${REQUIRE_PERMISSIONS:-true}"

mkdir -p "$LOG_DIR" "$(dirname "$EVENT_LOG")"

json_escape() {
  printf '"%s"' "$(printf '%s' "${1-}" | sed 's/\\/\\\\/g; s/"/\\"/g; s/	/\\t/g')"
}

event() {
  local status="$1"
  local action="$2"
  local detail="$3"
  printf '{"schemaVersion":"1.0","eventType":"start-best-effort","timestamp":%s,"status":%s,"action":%s,"detail":%s}\n' \
    "$(json_escape "$(date -Iseconds)")" \
    "$(json_escape "$status")" \
    "$(json_escape "$action")" \
    "$(json_escape "$detail")" >>"$EVENT_LOG"
}

check_systemd_unit() {
  local unit="$1"
  if ! command -v systemctl >/dev/null 2>&1; then
    echo "SYSTEMCTL_MISSING $unit"
    return 1
  fi
  if systemctl is-active --quiet "$unit"; then
    echo "SYSTEMD_OK $unit"
    return 0
  fi
  echo "SYSTEMD_BAD $unit $(systemctl is-active "$unit" 2>&1 || true)"
  return 1
}

check_permissions() {
  local targets=(
    "$ROOT_DIR"
    "$ROOT_DIR/var"
    "$ROOT_DIR/var/logs"
    "$ROOT_DIR/var/ai-runtime"
    "$ROOT_DIR/ops"
    "$ROOT_DIR/deploy"
  )
  local ok=0
  local path
  for path in "${targets[@]}"; do
    if [[ -e "$path" && -w "$path" ]]; then
      echo "PERM_OK $path"
    else
      echo "PERM_BAD $path"
      ok=1
    fi
  done
  return "$ok"
}

preflight() {
  : >"$PREFLIGHT_LOG"
  local status=0
  {
    echo "[preflight] $(date -Iseconds)"
    if [[ "$REQUIRE_K8S" == "true" ]]; then
      check_systemd_unit kubelet || status=1
      check_systemd_unit containerd || status=1
      if command -v kubectl >/dev/null 2>&1; then
        echo "KUBECTL_OK $(command -v kubectl)"
      else
        echo "KUBECTL_BAD missing"
        status=1
      fi
    fi
    if [[ "$REQUIRE_BROKER" == "true" ]]; then
      if bash "$ROOT_DIR/ops/scripts/resonance-cubrid-broker-doctor.sh" 2>&1; then
        echo "BROKER_OK"
      else
        echo "BROKER_BAD"
        status=1
      fi
    fi
    if [[ "$REQUIRE_PERMISSIONS" == "true" ]]; then
      if check_permissions; then
        echo "PERMISSIONS_OK"
      else
        echo "PERMISSIONS_BAD"
        status=1
      fi
    fi
  } >>"$PREFLIGHT_LOG"
  return "$status"
}

verify_https() {
  curl -k -fsS --max-time 15 https://127.0.0.1:18000/actuator/health >/dev/null 2>&1
}

broker_ready() {
  local output
  output="$(bash "$ROOT_DIR/ops/scripts/resonance-cubrid-broker-doctor.sh" 2>&1 || true)"
  printf '%s\n' "$output" >"$LOG_DIR/resonance-start-best-effort-broker.log"
  grep -q "JDBC_OK" "$LOG_DIR/resonance-start-best-effort-broker.log"
}

echo "[start-best-effort] mode=$MODE"

if ! preflight; then
  event "FAIL" "preflight" "kubelet/containerd/kubectl, broker, or permissions check failed"
  echo "[start-best-effort] preflight failed; see $PREFLIGHT_LOG" >&2
  if [[ "$MODE" != "auto" ]]; then
    exit 1
  fi
fi

if [[ "$MODE" == "auto" || "$MODE" == "k8s" ]]; then
  if START_DOCKER_DESKTOP=true WAIT_SECONDS=10 bash "$ROOT_DIR/ops/scripts/resonance-docker-k8s-doctor.sh"; then
    if [[ -x "$ROOT_DIR/ops/scripts/restart-local-carbonet-k8s.sh" ]]; then
      echo "[start-best-effort] docker/k8s looks available; starting k8s path"
      if bash "$ROOT_DIR/ops/scripts/restart-local-carbonet-k8s.sh"; then
        event "PASS" "k8s" "restart-local-carbonet-k8s succeeded"
        exit 0
      fi
      event "FAIL" "k8s" "restart-local-carbonet-k8s failed"
    fi
  else
    event "WARN" "k8s-skip" "docker/k8s doctor failed; falling back to HTTPS JVM"
  fi
fi

if [[ "$MODE" == "auto" || "$MODE" == "https-jvm" ]]; then
  if verify_https; then
    echo "[start-best-effort] HTTPS JVM already UP"
    event "PASS" "https-jvm-existing" "https://127.0.0.1:18000 health OK"
    exit 0
  fi
  if ! broker_ready; then
    echo "[start-best-effort] DB broker is not ready; starting HTTPS maintenance fallback"
    bash "$ROOT_DIR/ops/scripts/stop-18000.sh" >/dev/null 2>&1 || true
    bash "$ROOT_DIR/ops/scripts/stop-maintenance-18000.sh" >/dev/null 2>&1 || true
    REASON="DB broker unavailable; JVM runtime skipped to avoid startup hang." \
      bash "$ROOT_DIR/ops/scripts/start-maintenance-18000.sh"
    event "WARN" "maintenance-https" "DB broker unavailable; maintenance HTTPS started"
    exit 0
  fi
  bash "$ROOT_DIR/ops/scripts/stop-maintenance-18000.sh" >/dev/null 2>&1 || true
  echo "[start-best-effort] starting HTTPS JVM fallback"
  if CARBONET_RUNTIME_ENV=local bash "$ROOT_DIR/ops/scripts/start-18000.sh" && verify_https; then
    event "PASS" "https-jvm-start" "https://127.0.0.1:18000 health OK"
    exit 0
  fi
  event "FAIL" "https-jvm-start" "start-18000 or health failed"
fi

echo "[start-best-effort] no startup path succeeded" >&2
exit 1
