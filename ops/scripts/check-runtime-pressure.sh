#!/usr/bin/env bash
set -euo pipefail

WARN_MEM_MB="${WARN_MEM_MB:-384}"
CRIT_MEM_MB="${CRIT_MEM_MB:-256}"
WARN_DISK_PCT="${WARN_DISK_PCT:-85}"
CRIT_DISK_PCT="${CRIT_DISK_PCT:-92}"
WARN_LOAD_PER_CORE="${WARN_LOAD_PER_CORE:-1.50}"
CRIT_LOAD_PER_CORE="${CRIT_LOAD_PER_CORE:-2.50}"
WARN_APP_RSS_MB="${WARN_APP_RSS_MB:-650}"
CRIT_APP_RSS_MB="${CRIT_APP_RSS_MB:-800}"
APP_PORT="${APP_PORT:-18000}"
SSH_PASSWORD="${SSH_PASSWORD:-}"

usage() {
  cat <<'EOF'
Usage:
  check-runtime-pressure.sh [ssh-target ...]

Examples:
  check-runtime-pressure.sh
  check-runtime-pressure.sh carbonet2026@136.117.100.221 sjkim08314@34.82.132.175

Exit codes:
  0 healthy
  10 warning
  20 critical
EOF
}

float_ge() {
  awk -v left="$1" -v right="$2" 'BEGIN { exit !(left >= right) }'
}

collect_payload() {
  local host
  host="$(hostname)"

  local mem_avail_mb
  mem_avail_mb="$(free -m | awk '/^Mem:/ { print $7 }')"

  local root_use_pct
  root_use_pct="$(df -Pm / | awk 'NR==2 { gsub(/%/, "", $5); print $5 }')"

  local load1
  load1="$(awk '{ print $1 }' /proc/loadavg)"

  local cores
  cores="$(nproc)"

  local load_per_core
  load_per_core="$(awk -v load_avg="$load1" -v cores="$cores" 'BEGIN { printf "%.2f", load_avg / cores }')"

  local app_pid=""
  app_pid="$(ss -ltnp 2>/dev/null | awk -v port=":${APP_PORT}" '$4 ~ port { if (match($0, /pid=[0-9]+/)) { print substr($0, RSTART + 4, RLENGTH - 4); exit } }')"
  if [[ -z "$app_pid" ]]; then
    app_pid="$(pgrep -f "server.port=${APP_PORT}" | head -n1 || true)"
  fi

  local app_rss_mb="0"
  if [[ -n "$app_pid" ]]; then
    app_rss_mb="$(ps -o rss= -p "$app_pid" 2>/dev/null | awk '{ printf "%d", $1 / 1024 }')"
    if [[ -z "$app_rss_mb" ]]; then
      app_rss_mb="0"
    fi
  fi

  printf 'host=%s\n' "$host"
  printf 'mem_avail_mb=%s\n' "$mem_avail_mb"
  printf 'root_use_pct=%s\n' "$root_use_pct"
  printf 'load1=%s\n' "$load1"
  printf 'cores=%s\n' "$cores"
  printf 'load_per_core=%s\n' "$load_per_core"
  printf 'app_port=%s\n' "$APP_PORT"
  printf 'app_pid=%s\n' "$app_pid"
  printf 'app_rss_mb=%s\n' "$app_rss_mb"
}

load_collected() {
  local payload="$1"
  while IFS='=' read -r key value; do
    case "$key" in
      host) host="$value" ;;
      mem_avail_mb) mem_avail_mb="$value" ;;
      root_use_pct) root_use_pct="$value" ;;
      load1) load1="$value" ;;
      cores) cores="$value" ;;
      load_per_core) load_per_core="$value" ;;
      app_port) app_port="$value" ;;
      app_pid) app_pid="$value" ;;
      app_rss_mb) app_rss_mb="$value" ;;
    esac
  done <<<"$payload"
}

print_report() {
  local target_label="$1"
  local severity="healthy"
  local reasons=()

  if (( mem_avail_mb <= CRIT_MEM_MB )); then
    severity="critical"
    reasons+=("mem_avail_mb=${mem_avail_mb}<=${CRIT_MEM_MB}")
  elif (( mem_avail_mb <= WARN_MEM_MB )); then
    if [[ "$severity" != "critical" ]]; then
      severity="warning"
    fi
    reasons+=("mem_avail_mb=${mem_avail_mb}<=${WARN_MEM_MB}")
  fi

  if (( root_use_pct >= CRIT_DISK_PCT )); then
    severity="critical"
    reasons+=("root_use_pct=${root_use_pct}>=${CRIT_DISK_PCT}")
  elif (( root_use_pct >= WARN_DISK_PCT )); then
    if [[ "$severity" != "critical" ]]; then
      severity="warning"
    fi
    reasons+=("root_use_pct=${root_use_pct}>=${WARN_DISK_PCT}")
  fi

  if float_ge "$load_per_core" "$CRIT_LOAD_PER_CORE"; then
    severity="critical"
    reasons+=("load_per_core=${load_per_core}>=${CRIT_LOAD_PER_CORE}")
  elif float_ge "$load_per_core" "$WARN_LOAD_PER_CORE"; then
    if [[ "$severity" != "critical" ]]; then
      severity="warning"
    fi
    reasons+=("load_per_core=${load_per_core}>=${WARN_LOAD_PER_CORE}")
  fi

  if (( app_rss_mb >= CRIT_APP_RSS_MB )); then
    severity="critical"
    reasons+=("app_rss_mb=${app_rss_mb}>=${CRIT_APP_RSS_MB}")
  elif (( app_rss_mb >= WARN_APP_RSS_MB )); then
    if [[ "$severity" != "critical" ]]; then
      severity="warning"
    fi
    reasons+=("app_rss_mb=${app_rss_mb}>=${WARN_APP_RSS_MB}")
  fi

  local reason_text="ok"
  if ((${#reasons[@]} > 0)); then
    reason_text="$(IFS=,; echo "${reasons[*]}")"
  fi

  printf '[runtime-pressure] target=%s host=%s severity=%s mem_avail_mb=%s root_use_pct=%s load1=%s load_per_core=%s app_pid=%s app_rss_mb=%s reasons=%s\n' \
    "$target_label" "$host" "$severity" "$mem_avail_mb" "$root_use_pct" "$load1" "$load_per_core" "${app_pid:-}" "$app_rss_mb" "$reason_text"

  case "$severity" in
    healthy) return 0 ;;
    warning) return 10 ;;
    critical) return 20 ;;
  esac
}

run_check() {
  local target="$1"
  local payload=""

  if [[ "$target" == "local" ]]; then
    payload="$(collect_payload)"
  else
    local ssh_cmd=(ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$target")
    if [[ -n "$SSH_PASSWORD" ]]; then
      if ! command -v sshpass >/dev/null 2>&1; then
        echo "Missing required command: sshpass" >&2
        exit 1
      fi
      ssh_cmd=(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$target")
    fi
    payload="$("${ssh_cmd[@]}" \
      "APP_PORT='$APP_PORT' bash -s" <<'EOF'
set -euo pipefail
host="$(hostname)"
mem_avail_mb="$(free -m | awk '/^Mem:/ { print $7 }')"
root_use_pct="$(df -Pm / | awk 'NR==2 { gsub(/%/, "", $5); print $5 }')"
load1="$(awk '{ print $1 }' /proc/loadavg)"
cores="$(nproc)"
load_per_core="$(awk -v load_avg="$load1" -v cores="$cores" 'BEGIN { printf "%.2f", load_avg / cores }')"
app_pid="$(ss -ltnp 2>/dev/null | awk -v port=":"ENVIRON["APP_PORT"] '$4 ~ port { if (match($0, /pid=[0-9]+/)) { print substr($0, RSTART + 4, RLENGTH - 4); exit } }')"
if [[ -z "$app_pid" ]]; then
  app_pid="$(pgrep -f "server.port=${APP_PORT}" | head -n1 || true)"
fi
app_rss_mb="0"
if [[ -n "$app_pid" ]]; then
  app_rss_mb="$(ps -o rss= -p "$app_pid" 2>/dev/null | awk '{ printf "%d", $1 / 1024 }')"
  if [[ -z "$app_rss_mb" ]]; then
    app_rss_mb="0"
  fi
fi
printf 'host=%s\n' "$host"
printf 'mem_avail_mb=%s\n' "$mem_avail_mb"
printf 'root_use_pct=%s\n' "$root_use_pct"
printf 'load1=%s\n' "$load1"
printf 'cores=%s\n' "$cores"
printf 'load_per_core=%s\n' "$load_per_core"
printf 'app_port=%s\n' "${APP_PORT}"
printf 'app_pid=%s\n' "$app_pid"
printf 'app_rss_mb=%s\n' "$app_rss_mb"
EOF
)"
  fi

  local host="" mem_avail_mb="" root_use_pct="" load1="" cores="" load_per_core="" app_port="" app_pid="" app_rss_mb=""
  load_collected "$payload"
  print_report "$target"
}

main() {
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
  fi

  local overall_code=0
  local targets=("$@")
  if ((${#targets[@]} == 0)); then
    targets=("local")
  fi

  local target=""
  for target in "${targets[@]}"; do
    set +e
    run_check "$target"
    local check_code=$?
    set -e
    if (( check_code > overall_code )); then
      overall_code=$check_code
    fi
  done

  exit "$overall_code"
}

main "$@"
