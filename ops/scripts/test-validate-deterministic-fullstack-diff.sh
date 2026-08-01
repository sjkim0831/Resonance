#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
VALIDATOR="$ROOT/ops/scripts/validate-deterministic-fullstack-diff.sh"

printf '%s\n' \
  ' M projects/carbonet-backend-metadata/process-runtime/generated/CONTENT_OPERATION/index.json' \
  ' M projects/carbonet-backend-metadata/process-runtime/design-preview/CONTENT_OPERATION/index.json' \
  | bash "$VALIDATOR" CONTENT_OPERATION 7814 >/dev/null

if printf '%s\n' ' M projects/carbonet-frontend/source/src/App.tsx' \
    | bash "$VALIDATOR" CONTENT_OPERATION 10 >/dev/null 2>&1; then
  echo 'source path unexpectedly accepted' >&2
  exit 1
fi

if printf '%s\n' ' M projects/carbonet-backend-metadata/process-runtime/generated/CONTENT_OPERATION/index.json' \
    | bash "$VALIDATOR" CONTENT_OPERATION 12001 >/dev/null 2>&1; then
  echo 'oversized deterministic diff unexpectedly accepted' >&2
  exit 1
fi

echo 'PASS deterministic full-stack diff scope'
