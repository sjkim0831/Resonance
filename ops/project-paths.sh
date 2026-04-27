#!/usr/bin/env bash
set -euo pipefail

# Change this value first if the repository root path changes.
DEFAULT_PROJECT_ROOT="/opt/Resonance-react-migration"

# Allow shell callers to override PROJECT_ROOT explicitly, but keep one default here.
PROJECT_ROOT="${PROJECT_ROOT:-${DEFAULT_PROJECT_ROOT}}"
LOG_ROOT="${LOG_ROOT:-${PROJECT_ROOT}/var/logs}"
FILE_ROOT="${FILE_ROOT:-${PROJECT_ROOT}/var/file}"
CRON_ROOT="${CRON_ROOT:-${PROJECT_ROOT}/ops/cron}"
SCRIPT_ROOT="${SCRIPT_ROOT:-${PROJECT_ROOT}/ops/scripts}"

export PROJECT_ROOT
export LOG_ROOT
export FILE_ROOT
export CRON_ROOT
export SCRIPT_ROOT
