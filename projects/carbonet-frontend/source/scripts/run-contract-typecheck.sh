#!/usr/bin/env bash
set -euo pipefail

mode="${FRONTEND_CONTRACT_TYPECHECK_MODE:-auto}"
case "$mode" in
  auto)
    if [[ -n "${FULL_SCREEN_SMOKE_ROUTE_PATTERN:-}" ||
          "${FULL_SCREEN_SMOKE_CHANGED_ONLY:-false}" == "true" ]]; then
      mode="incremental"
    else
      mode="full"
    fi
    ;;
  full|incremental) ;;
  *) echo "[contract-typecheck] unsupported mode=$mode" >&2; exit 2 ;;
esac

started="$SECONDS"
if [[ "$mode" == "full" ]]; then
  npm run typecheck:full
else
  # TypeScript's build-info graph invalidates changed transitive dependencies,
  # so targeted browser runs avoid rebuilding the unchanged project graph.
  # A damaged cache gets one clean, fail-closed recovery attempt.
  if ! npm run typecheck:incremental; then
    echo "[contract-typecheck] incremental cache failed; retrying one full validation" >&2
    rm -f tsconfig.app.tsbuildinfo
    npm run typecheck:full
    mode="full-recovery"
  fi
fi
echo "[contract-typecheck] PASS mode=$mode duration=$((SECONDS-started))s"
