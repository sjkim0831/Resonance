#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/codex-verify-18000-freshness.sh

Purpose:
  Verify that the running :18000 service is using the newest packaged runtime jar.

Canonical app jar:
  apps/carbonet-app/target/carbonet.jar

Quick guide:
  bash ops/scripts/app-closure-help.sh

Environment overrides:
  PORT
  TARGET_JAR_PATH
  RUNTIME_JAR_PATH
  PID_FILE
  LOG_FILE
  HEALTH_URL
  STARTUP_MARKER
  FRONTEND_RESOURCE_DIR
  FRONTEND_APP_RESOURCE_DIR
  VERIFY_WAIT_SECONDS
  VERIFY_EXTENDED_WAIT_SECONDS
  CARBONET_REACT_APP_FS_OVERRIDE_ENABLED
  CARBONET_REACT_APP_FS_OVERRIDE_PATH
  VERIFY_REACT_FS_OVERRIDE_HTTP=true
  VERIFY_EXTERNAL_MONITORING_BOOTSTRAP=true
  VERIFY_CLOB_FALLBACK_LOGS=true
  VERIFY_BLOCKLIST_FALLBACK_LOGS=true
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/ops/scripts/runtime-url-common.sh"
PORT="${PORT:-18000}"
CONFIG_DIR="${CONFIG_DIR:-$ROOT_DIR/ops/config}"
ENV_FILE="${ENV_FILE:-$CONFIG_DIR/carbonet-${PORT}.env}"
DEFAULT_ENV_FILE="${DEFAULT_ENV_FILE:-$CONFIG_DIR/carbonet-${PORT}.defaults.env}"
RUN_DIR="${RUN_DIR:-$ROOT_DIR/var/run}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/var/logs}"
APP_TARGET_JAR_PATH="$ROOT_DIR/apps/carbonet-app/target/carbonet.jar"
TARGET_JAR_PATH="${TARGET_JAR_PATH:-$APP_TARGET_JAR_PATH}"
RUNTIME_JAR_PATH="${RUNTIME_JAR_PATH:-$RUN_DIR/carbonet-${PORT}.jar}"
PID_FILE="${PID_FILE:-$RUN_DIR/carbonet-${PORT}.pid}"
LOG_FILE="${LOG_FILE:-$LOG_DIR/carbonet-${PORT}.log}"
STARTUP_MARKER="${STARTUP_MARKER:-Tomcat started on port ${PORT}}"
FRONTEND_RESOURCE_DIR="${FRONTEND_RESOURCE_DIR:-$ROOT_DIR/src/main/resources/static/react-app}"
FRONTEND_APP_RESOURCE_DIR="${FRONTEND_APP_RESOURCE_DIR:-$ROOT_DIR/apps/carbonet-app/src/main/resources/static/react-app}"
FRONTEND_MANIFEST_PATH="$FRONTEND_RESOURCE_DIR/.vite/manifest.json"
FRONTEND_APP_MANIFEST_PATH="$FRONTEND_APP_RESOURCE_DIR/.vite/manifest.json"
VERIFY_WAIT_SECONDS="${VERIFY_WAIT_SECONDS:-60}"
VERIFY_EXTENDED_WAIT_SECONDS="${VERIFY_EXTENDED_WAIT_SECONDS:-180}"
VERIFY_LOG_TAIL_LINES="${VERIFY_LOG_TAIL_LINES:-20000}"
VERIFY_LOG_TAIL_BYTES="${VERIFY_LOG_TAIL_BYTES:-67108864}"
VERIFY_EXTERNAL_MONITORING_BOOTSTRAP="${VERIFY_EXTERNAL_MONITORING_BOOTSTRAP:-false}"
VERIFY_CLOB_FALLBACK_LOGS="${VERIFY_CLOB_FALLBACK_LOGS:-true}"
CLOB_FALLBACK_LOG_PATTERN="${CLOB_FALLBACK_LOG_PATTERN:-Access event persistence failed due to CLOB binding|Audit event persistence failed due to CLOB binding|Error event persistence failed due to CLOB binding|Trace payload persistence failed due to CLOB binding|Failed to persist access event after compact retry|Failed to persist audit event after compact retry|Failed to persist error event after compact retry|Failed to persist trace event after retry without payload}"
VERIFY_BLOCKLIST_FALLBACK_LOGS="${VERIFY_BLOCKLIST_FALLBACK_LOGS:-true}"
BLOCKLIST_FALLBACK_LOG_PATTERN="${BLOCKLIST_FALLBACK_LOG_PATTERN:-Failed to load persisted blocklist rows|Failed to load persisted blocklist action history|Unknown class \"dba[.]comtnblocklistentry\"|Unknown class \"dba[.]comtnblocklistactionhist\"}"
VERIFY_REACT_FS_OVERRIDE_HTTP="${VERIFY_REACT_FS_OVERRIDE_HTTP:-true}"

if [[ -f "$DEFAULT_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$DEFAULT_ENV_FILE"
  set +a
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

HEALTH_URL="${HEALTH_URL:-$(carbonet_runtime_health_url)}"
carbonet_set_curl_args

fail() {
  echo "[codex-verify-18000-freshness] FAIL: $*" >&2
  exit 1
}

info() {
  echo "[codex-verify-18000-freshness] $*"
}

port_is_listening() {
  ss -ltn "( sport = :$PORT )" 2>/dev/null | grep -q ":$PORT"
}

log_has_startup_marker() {
  [[ -f "$LOG_FILE" ]] || return 1
  if grep -a -F -q "$STARTUP_MARKER" < <(tail -n "$VERIFY_LOG_TAIL_LINES" "$LOG_FILE"); then
    return 0
  fi
  grep -a -F -q "$STARTUP_MARKER" < <(tail -c "$VERIFY_LOG_TAIL_BYTES" "$LOG_FILE")
}

latest_startup_line_number() {
  [[ -f "$LOG_FILE" ]] || return 1
  local latest_startup_line=""
  latest_startup_line="$(grep -a -nF "$STARTUP_MARKER" < <(tail -n "$VERIFY_LOG_TAIL_LINES" "$LOG_FILE") | tail -n 1 | cut -d: -f1 || true)"
  if [[ -n "$latest_startup_line" ]]; then
    printf '%s\n' "$latest_startup_line"
    return 0
  fi
  latest_startup_line="$(tail -c "$VERIFY_LOG_TAIL_BYTES" "$LOG_FILE" | grep -a -nF "$STARTUP_MARKER" | tail -n 1 | cut -d: -f1 || true)"
  [[ -n "$latest_startup_line" ]] || return 1
  printf '%s\n' "$latest_startup_line"
}

log_since_latest_startup_has() {
  local pattern="$1"
  [[ -f "$LOG_FILE" ]] || return 1
  local latest_startup_line=""
  latest_startup_line="$(latest_startup_line_number || true)"
  local recent_log=""
  recent_log="$(mktemp)"
  tail -c "$VERIFY_LOG_TAIL_BYTES" "$LOG_FILE" > "$recent_log"
  if [[ -n "$latest_startup_line" ]]; then
    local tail_startup_line=""
    tail_startup_line="$(grep -a -nF "$STARTUP_MARKER" "$recent_log" | tail -n 1 | cut -d: -f1 || true)"
    if [[ -n "$tail_startup_line" ]]; then
      grep -a -Eq "$pattern" < <(tail -n "+$tail_startup_line" "$recent_log")
      local status=$?
      rm -f "$recent_log"
      return $status
    fi
  fi
  grep -a -Eq "$pattern" "$recent_log"
  local status=$?
  rm -f "$recent_log"
  return $status
}

health_is_up() {
  local body=""
  if ! command -v curl >/dev/null 2>&1; then
    return 1
  fi
  body="$(curl "${CARBONET_CURL_ARGS[@]}" -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null || true)"
  [[ -n "$body" ]] || return 1
  case "$body" in
    *"UP"*) HEALTH_BODY="$body"; return 0 ;;
  esac
  return 1
}

is_true() {
  carbonet_bool_true "${1:-false}"
}

react_fs_override_enabled() {
  is_true "${CARBONET_REACT_APP_FS_OVERRIDE_ENABLED:-false}" \
    && [[ -n "${CARBONET_REACT_APP_FS_OVERRIDE_PATH:-}" ]]
}

resolve_running_pid() {
  ps -eo pid=,args= | awk -v jar_path="$RUNTIME_JAR_PATH" -v port="--server.port=${PORT}" '
    index($0, jar_path) && index($0, port) {
      print $1;
      exit 0;
    }
  '
}

pid_is_live() {
  local pid="$1"
  [[ -n "${pid:-}" ]] || return 1
  ps -p "$pid" -o args= 2>/dev/null | awk -v jar_path="$RUNTIME_JAR_PATH" -v port="--server.port=${PORT}" '
    index($0, jar_path) && index($0, port) {
      found = 1
    }
    END {
      exit(found ? 0 : 1)
    }
  '
}

refresh_pid_file_from_runtime() {
  local resolved_pid=""
  resolved_pid="$(resolve_running_pid || true)"
  if pid_is_live "$resolved_pid"; then
    printf '%s\n' "$resolved_pid" > "$PID_FILE"
    printf '%s\n' "$resolved_pid"
    return 0
  fi
  return 1
}

read_live_pid() {
  local pid=""
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if pid_is_live "$pid"; then
    printf '%s\n' "$pid"
    return 0
  fi
  refresh_pid_file_from_runtime
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

compute_stream_hash() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{print $1}'
    return 0
  fi
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{print $1}'
    return 0
  fi
  cksum | awk '{print $1 ":" $2}'
}

http_body_hash() {
  local url="$1"
  if ! command -v curl >/dev/null 2>&1; then
    return 1
  fi
  curl "${CARBONET_CURL_ARGS[@]}" -fsS --max-time 10 "$url" 2>/dev/null | compute_stream_hash
}

jar_entry_hash() {
  local jar_path="$1"
  local entry_path=""
  local tmp_dir=""
  command -v jar >/dev/null 2>&1 || fail "jar command is required to verify frontend assets inside jar"
  tmp_dir="$(mktemp -d)"
  for entry_path in \
    "BOOT-INF/classes/static/react-app/.vite/manifest.json" \
    "static/react-app/.vite/manifest.json"; do
    if (cd "$tmp_dir" && jar xf "$jar_path" "$entry_path") >/dev/null 2>&1 && [[ -f "$tmp_dir/$entry_path" ]]; then
      compute_hash "$tmp_dir/$entry_path"
      rm -rf "$tmp_dir"
      return 0
    fi
  done
  rm -rf "$tmp_dir"
  return 1
}

verify_frontend_file_list() {
  local tmp_dir=""
  local app_files=""
  local jar_files=""
  command -v jar >/dev/null 2>&1 || fail "jar command is required to verify frontend assets inside jar"
  tmp_dir="$(mktemp -d)"
  app_files="$tmp_dir/app-files.txt"
  jar_files="$tmp_dir/jar-files.txt"

  (cd "$FRONTEND_APP_RESOURCE_DIR" && find . -type f | sed 's#^\./#static/react-app/#' | sort) > "$app_files"
  jar tf "$RUNTIME_JAR_PATH" \
    | awk '
      index($0, "BOOT-INF/classes/static/react-app/") == 1 {
        sub("^BOOT-INF/classes/", "", $0);
        print;
        next;
      }
      index($0, "static/react-app/") == 1 {
        print;
      }
    ' \
    | grep -v '/$' \
    | sort > "$jar_files"

  if ! cmp -s "$app_files" "$jar_files"; then
    diff -u "$app_files" "$jar_files" | sed -n '1,80p' >&2 || true
    rm -rf "$tmp_dir"
    fail "runtime jar frontend file list differs from carbonet-app resources"
  fi

  rm -rf "$tmp_dir"
}

verify_override_manifest_http() {
  local expected_manifest_hash="$1"
  local manifest_url="$2"
  local actual_manifest_hash=""
  actual_manifest_hash="$(http_body_hash "$manifest_url" || true)"
  [[ -n "$actual_manifest_hash" ]] || fail "unable to fetch runtime manifest: $manifest_url"
  [[ "$actual_manifest_hash" == "$expected_manifest_hash" ]] || fail "runtime manifest differs from filesystem override manifest: $manifest_url"
}

verify_override_file_list() {
  local override_root="$1"
  [[ -d "$override_root" ]] || fail "missing filesystem override directory: $override_root"
  local tmp_dir=""
  local override_files=""
  local served_files=""
  command -v find >/dev/null 2>&1 || fail "find command is required to verify filesystem override assets"
  tmp_dir="$(mktemp -d)"
  override_files="$tmp_dir/override-files.txt"
  served_files="$tmp_dir/served-files.txt"

  (cd "$override_root" && find . -type f | sed 's#^\./##' | sort) > "$override_files"
  (
    cd "$FRONTEND_RESOURCE_DIR" && find . -type f | sed 's#^\./##' | sort
  ) > "$served_files"

  if ! cmp -s "$override_files" "$served_files"; then
    diff -u "$override_files" "$served_files" | sed -n '1,80p' >&2 || true
    rm -rf "$tmp_dir"
    fail "filesystem override file list differs from root frontend resources"
  fi

  rm -rf "$tmp_dir"
}

require_file() {
  local file_path="$1"
  [[ -f "$file_path" ]] || fail "missing file: $file_path"
}

require_file "$TARGET_JAR_PATH"

for _ in $(seq 1 "$VERIFY_WAIT_SECONDS"); do
  [[ -f "$RUNTIME_JAR_PATH" && -f "$LOG_FILE" && -f "$PID_FILE" ]] || {
    if [[ ! -f "$PID_FILE" ]]; then
      refresh_pid_file_from_runtime >/dev/null || true
    fi
    sleep 1
    continue
  }

  APP_PID="$(read_live_pid || true)"
  if [[ -z "${APP_PID:-}" ]]; then
    sleep 1
    continue
  fi

  if ! port_is_listening; then
    sleep 1
    continue
  fi

  break
done

require_file "$RUNTIME_JAR_PATH"
require_file "$LOG_FILE"
if [[ ! -s "$PID_FILE" ]]; then
  refresh_pid_file_from_runtime >/dev/null || true
fi
[[ -f "$PID_FILE" ]] || fail "missing pid file: $PID_FILE after waiting ${VERIFY_WAIT_SECONDS}s"
APP_PID="$(read_live_pid || true)"
if [[ -z "${APP_PID:-}" ]]; then
  for _ in $(seq 1 5); do
    sleep 1
    APP_PID="$(read_live_pid || true)"
    if [[ -n "${APP_PID:-}" ]]; then
      break
    fi
  done
fi
[[ -n "${APP_PID:-}" ]] || fail "unable to resolve running pid from $PID_FILE or process table"
pid_is_live "$APP_PID" || fail "process not running for pid=$APP_PID"

for _ in $(seq 1 "$VERIFY_EXTENDED_WAIT_SECONDS"); do
  if port_is_listening; then
    break
  fi
  sleep 1
done
port_is_listening || fail "port is not listening: $PORT"

TARGET_HASH="$(compute_hash "$TARGET_JAR_PATH")"
RUNTIME_HASH="$(compute_hash "$RUNTIME_JAR_PATH")"
[[ "$TARGET_HASH" == "$RUNTIME_HASH" ]] || fail "runtime jar hash differs from target jar"

require_file "$FRONTEND_MANIFEST_PATH"
require_file "$FRONTEND_APP_MANIFEST_PATH"
FRONTEND_MANIFEST_HASH="$(compute_hash "$FRONTEND_MANIFEST_PATH")"
FRONTEND_APP_MANIFEST_HASH="$(compute_hash "$FRONTEND_APP_MANIFEST_PATH")"
[[ "$FRONTEND_APP_MANIFEST_HASH" == "$FRONTEND_MANIFEST_HASH" ]] || fail "frontend manifest differs between root resources and carbonet-app resources"
REACT_FS_OVERRIDE_ACTIVE="false"
if react_fs_override_enabled; then
  REACT_FS_OVERRIDE_ACTIVE="true"
  FRONTEND_OVERRIDE_RESOURCE_DIR="${CARBONET_REACT_APP_FS_OVERRIDE_PATH%/}"
  FRONTEND_OVERRIDE_MANIFEST_PATH="$FRONTEND_OVERRIDE_RESOURCE_DIR/.vite/manifest.json"
  require_file "$FRONTEND_OVERRIDE_MANIFEST_PATH"
  FRONTEND_OVERRIDE_MANIFEST_HASH="$(compute_hash "$FRONTEND_OVERRIDE_MANIFEST_PATH")"
  [[ "$FRONTEND_OVERRIDE_MANIFEST_HASH" == "$FRONTEND_MANIFEST_HASH" ]] || fail "filesystem override manifest differs from root frontend resources"
  verify_override_file_list "$FRONTEND_OVERRIDE_RESOURCE_DIR"
  if is_true "$VERIFY_REACT_FS_OVERRIDE_HTTP"; then
    BASE_URL="$(carbonet_runtime_base_url)"
    verify_override_manifest_http "$FRONTEND_OVERRIDE_MANIFEST_HASH" "$BASE_URL/assets/react/.vite/manifest.json"
  fi
else
  RUNTIME_FRONTEND_MANIFEST_HASH="$(jar_entry_hash "$RUNTIME_JAR_PATH" || true)"
  [[ -n "$RUNTIME_FRONTEND_MANIFEST_HASH" ]] || fail "frontend manifest not found inside runtime jar"
  [[ "$RUNTIME_FRONTEND_MANIFEST_HASH" == "$FRONTEND_APP_MANIFEST_HASH" ]] || fail "runtime jar contains stale frontend manifest"
  verify_frontend_file_list
fi

TARGET_MTIME="$(stat -c %Y "$TARGET_JAR_PATH" 2>/dev/null || true)"
RUNTIME_MTIME="$(stat -c %Y "$RUNTIME_JAR_PATH" 2>/dev/null || true)"
[[ -n "$TARGET_MTIME" && -n "$RUNTIME_MTIME" ]] || fail "failed to read jar mtimes"
[[ "$RUNTIME_MTIME" -ge "$TARGET_MTIME" ]] || fail "runtime jar is older than target jar"

for _ in $(seq 1 "$VERIFY_EXTENDED_WAIT_SECONDS"); do
  if log_has_startup_marker; then
    break
  fi
  sleep 1
done
log_has_startup_marker || fail "startup marker not found in log: $STARTUP_MARKER"

if [[ "$VERIFY_CLOB_FALLBACK_LOGS" == "true" ]]; then
  if log_since_latest_startup_has "$CLOB_FALLBACK_LOG_PATTERN"; then
    fail "CLOB persistence fallback log found after latest startup marker; run ops/scripts/codex-fix-cubrid-lob-permissions.sh and re-probe the affected route"
  fi
fi

if [[ "$VERIFY_BLOCKLIST_FALLBACK_LOGS" == "true" ]]; then
  if log_since_latest_startup_has "$BLOCKLIST_FALLBACK_LOG_PATTERN"; then
    fail "blocklist persistence fallback log found after latest startup marker; run ops/scripts/codex-fix-cubrid-blocklist-schema.sh, restart :18000, and re-probe the affected route"
  fi
fi

HEALTH_BODY=""
for _ in $(seq 1 "$VERIFY_EXTENDED_WAIT_SECONDS"); do
  if health_is_up; then
    break
  fi
  sleep 1
done

if [[ -n "$HEALTH_BODY" ]]; then
  case "$HEALTH_BODY" in
    *"UP"*) info "health check OK: $HEALTH_URL" ;;
    *) fail "health check did not report UP: $HEALTH_URL" ;;
  esac
else
  if [[ "$(carbonet_runtime_scheme)" == "https" ]] && command -v curl >/dev/null 2>&1; then
    HTTP_TLS_PROBE="$(curl -sS --max-time 5 "http://127.0.0.1:${PORT}/actuator/health" 2>/dev/null || true)"
    case "$HTTP_TLS_PROBE" in
      *"requires TLS"*)
        info "HTTPS runtime detected: plain HTTP probe reported TLS required"
        ;;
      *)
        info "health check client returned empty response; port and process checks already passed"
        ;;
    esac
  else
    info "health check client returned empty response; port and process checks already passed"
  fi
fi

info "pid OK: $APP_PID"
info "port OK: $PORT"
info "target jar: $TARGET_JAR_PATH"
info "runtime jar: $RUNTIME_JAR_PATH"
info "jar hash OK: $TARGET_HASH"
if [[ "$REACT_FS_OVERRIDE_ACTIVE" == "true" ]]; then
  info "frontend filesystem override active: $FRONTEND_OVERRIDE_RESOURCE_DIR"
  info "override manifest hash OK: $FRONTEND_OVERRIDE_MANIFEST_HASH"
  info "override file list OK"
  if is_true "$VERIFY_REACT_FS_OVERRIDE_HTTP"; then
    info "override manifest HTTP response OK: /assets/react/.vite/manifest.json"
  fi
else
  info "frontend manifest hash OK: $FRONTEND_APP_MANIFEST_HASH"
  info "frontend file list OK"
fi
info "startup marker OK: $STARTUP_MARKER"
if [[ "$VERIFY_CLOB_FALLBACK_LOGS" == "true" ]]; then
  info "CLOB fallback logs OK since latest startup"
fi
if [[ "$VERIFY_BLOCKLIST_FALLBACK_LOGS" == "true" ]]; then
  info "blocklist fallback logs OK since latest startup"
fi

if [[ "$VERIFY_EXTERNAL_MONITORING_BOOTSTRAP" == "true" ]]; then
  info "running external monitoring bootstrap verification"
  bash "$ROOT_DIR/ops/scripts/verify-external-monitoring-bootstrap.sh" "$(carbonet_runtime_base_url)"
fi

info "freshness verification completed"
