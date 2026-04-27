#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

APP_STATUS="$(probe_app)"
log_job "external_token_refresh" "external integration token refresh probe, app_status=${APP_STATUS}"
