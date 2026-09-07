#!/usr/bin/env bash
set -euo pipefail
ROOT="${ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MODE="${1:---all}"
case "$MODE" in
  --p006-only) bash "$ROOT/projects/P006/build-frontend.sh" ;;
  --core-only) FRONTEND_TYPECHECK_MODE=noemit bash "$ROOT/ops/scripts/resonance-screen-overlay-apply.sh" ;;
  --all) FRONTEND_TYPECHECK_MODE=noemit bash "$ROOT/ops/scripts/resonance-screen-overlay-apply.sh"; bash "$ROOT/projects/P006/build-frontend.sh" ;;
  *) echo "usage: $0 [--p006-only|--core-only|--all]" >&2; exit 2 ;;
esac
