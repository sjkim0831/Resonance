#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/verify-large-move-app-closure.sh

Purpose:
  Verify app-assembly closure for the current large-move wave.

Checks:
  - canonical app jar path is used by owner scripts
  - legacy root jar and legacy package lines are absent from ops/scripts
  - app assembly excludes moved resource families from root resources
  - moved version-control mapper exists only in the module path
  - optional runtime closure can be checked with VERIFY_RUNTIME=true

Canonical app jar:
  apps/carbonet-app/target/carbonet.jar

Quick guide:
  bash ops/scripts/app-closure-help.sh
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_POM="$ROOT_DIR/apps/carbonet-app/pom.xml"
APP_JAR="$ROOT_DIR/apps/carbonet-app/target/carbonet.jar"
MODULE_VERSIONCONTROL_MAPPER="$ROOT_DIR/modules/platform-version-control/src/main/resources/egovframework/mapper/com/platform/versioncontrol/ProjectVersionManagementMapper.xml"
ROOT_VERSIONCONTROL_MAPPER="$ROOT_DIR/src/main/resources/egovframework/mapper/com/platform/versioncontrol/ProjectVersionManagementMapper.xml"
PORT="${PORT:-18000}"
RUN_DIR="${RUN_DIR:-$ROOT_DIR/var/run}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/var/logs}"
RUNTIME_JAR="$RUN_DIR/carbonet-${PORT}.jar"
PID_FILE="$RUN_DIR/carbonet-${PORT}.pid"
LOG_FILE="$LOG_DIR/carbonet-${PORT}.log"
STARTUP_MARKER="${STARTUP_MARKER:-Tomcat started on port(s): ${PORT}}"
VERIFY_RUNTIME="${VERIFY_RUNTIME:-false}"
VERIFY_WAIT_SECONDS="${VERIFY_WAIT_SECONDS:-20}"

info() {
  printf '[verify-large-move-app-closure] %s\n' "$*"
}

fail() {
  printf '[verify-large-move-app-closure] FAIL: %s\n' "$*" >&2
  exit 1
}

require_file() {
  local path="$1"
  [[ -f "$path" ]] || fail "missing file: $path"
}

require_absent() {
  local path="$1"
  [[ ! -e "$path" ]] || fail "unexpected live old-path artifact remains: $path"
}

require_pattern() {
  local pattern="$1"
  local path="$2"
  rg -q "$pattern" "$path" || fail "missing expected pattern in $path: $pattern"
}

require_no_matches() {
  local pattern="$1"
  local target="$2"
  if rg -n \
    --glob '!verify-large-move-app-closure.sh' \
    --glob '!audit-app-closure-ops.sh' \
    "$pattern" "$target" >/tmp/verify-large-move-app-closure.rg 2>/dev/null; then
    cat /tmp/verify-large-move-app-closure.rg >&2
    rm -f /tmp/verify-large-move-app-closure.rg
    fail "unexpected legacy match for pattern: $pattern"
  fi
  rm -f /tmp/verify-large-move-app-closure.rg
}

compute_hash() {
  local file_path="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file_path" | awk '{print $1}'
    return 0
  fi
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file_path" | awk '{print $1}'
    return 0
  fi
  cksum "$file_path" | awk '{print $1 ":" $2}'
}

verify_runtime_closure() {
  local app_pid=""
  local socket_line=""
  local target_hash=""
  local runtime_hash=""
  local attempt=""

  for attempt in $(seq 1 "$VERIFY_WAIT_SECONDS"); do
    if [[ -f "$RUNTIME_JAR" && -f "$PID_FILE" && -f "$LOG_FILE" ]]; then
      app_pid="$(tr -d '[:space:]' < "$PID_FILE")"
      socket_line="$(ss -ltnp 2>/dev/null | grep ":$PORT" | head -n 1 || true)"
      if [[ -n "$app_pid" && -n "$socket_line" && "$socket_line" == *"pid=${app_pid}"* ]]; then
        break
      fi
    fi
    sleep 1
  done

  require_file "$RUNTIME_JAR"
  require_file "$PID_FILE"
  require_file "$LOG_FILE"

  app_pid="$(tr -d '[:space:]' < "$PID_FILE")"
  [[ -n "$app_pid" ]] || fail "pid file is empty"
  socket_line="$(ss -ltnp 2>/dev/null | grep ":$PORT" | head -n 1 || true)"
  [[ -n "$socket_line" ]] || fail "port is not listening: $PORT"
  [[ "$socket_line" == *"pid=${app_pid}"* ]] || fail "listener pid does not match pid file"

  target_hash="$(compute_hash "$APP_JAR")"
  runtime_hash="$(compute_hash "$RUNTIME_JAR")"
  [[ "$target_hash" == "$runtime_hash" ]] || fail "runtime jar hash differs from target jar"

  grep -q "$STARTUP_MARKER" "$LOG_FILE" || fail "startup marker not found in runtime log"

  info "pid OK: $app_pid"
  info "port OK: $PORT"
  info "target jar: $APP_JAR"
  info "runtime jar: $RUNTIME_JAR"
  info "jar hash OK: $target_hash"
  info "startup marker OK: $STARTUP_MARKER"
}

info "checking canonical source-of-truth paths"
require_file "$APP_POM"
require_file "$MODULE_VERSIONCONTROL_MAPPER"
require_absent "$ROOT_VERSIONCONTROL_MAPPER"

info "checking app assembly resource closure"
require_pattern 'egovframework/mapper/com/platform/versioncontrol/\*\*' "$APP_POM"
require_pattern 'egovframework/mapper/com/platform/runtimecontrol/\*\*' "$APP_POM"

info "checking owner-script canonical jar and package lines"
require_no_matches '\$REPO_ROOT/target/carbonet\.jar|\$ROOT_DIR/target/carbonet\.jar|\$BUILD_DIR/target/carbonet\.jar' "$ROOT_DIR/ops/scripts"
require_no_matches 'mvn -q -DskipTests package|mvn -q package' "$ROOT_DIR/ops/scripts"
require_pattern 'apps/carbonet-app/target/carbonet\.jar' "$ROOT_DIR/ops/scripts"

info "checking packaged app jar exists"
require_file "$APP_JAR"

if [[ "$VERIFY_RUNTIME" == "true" ]]; then
  info "checking runtime closure"
  verify_runtime_closure
else
  info "runtime closure check skipped; use VERIFY_RUNTIME=true or bash ops/scripts/codex-verify-18000-freshness.sh"
fi

info "large-move app closure verification completed"
