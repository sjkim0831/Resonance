#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

# Screens and framework runtime resources have independent locks and hashes.
# A failure in either path is visible to systemd and retried by the timer.
/usr/bin/bash "$ROOT/ops/scripts/generate-incremental-screen-runtime.sh" "$ROOT"
/usr/bin/bash "$ROOT/ops/scripts/generate-db-framework-runtime.sh" "$ROOT"
