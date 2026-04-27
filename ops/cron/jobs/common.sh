#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../project-paths.sh"
source "${SCRIPT_DIR}/../../scripts/runtime-url-common.sh"

LOG_DIR="${LOG_ROOT}/cron"
CONFIG_ENV="${PROJECT_ROOT}/ops/config/carbonet-18000.env"
if [[ -f "${CONFIG_ENV}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "${CONFIG_ENV}"
    set +a
fi
APP_URL="${APP_URL:-$(carbonet_runtime_base_url)/home}"
carbonet_set_curl_args

mkdir -p "${LOG_DIR}"

timestamp() {
    date '+%Y-%m-%d %H:%M:%S %Z'
}

probe_app() {
    local http_code
    http_code="$(curl "${CARBONET_CURL_ARGS[@]}" -sS -o /dev/null -w '%{http_code}' --max-time 10 "${APP_URL}" || true)"
    if [[ "${http_code}" == "200" || "${http_code}" == "302" || "${http_code}" == "401" || "${http_code}" == "403" ]]; then
        echo "UP(${http_code})"
    else
        echo "DOWN(${http_code:-000})"
    fi
}

log_job() {
    local job_name="$1"
    local message="$2"
    printf '[%s] [%s] %s\n' "$(timestamp)" "${job_name}" "${message}"
}

log_info() {
    log_job "info" "$1"
}

log_error() {
    log_job "error" "$1"
}
