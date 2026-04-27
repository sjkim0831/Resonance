#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

PORT=18001 bash "$ROOT_DIR/ops/scripts/start-18000.sh"
