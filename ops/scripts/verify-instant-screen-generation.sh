#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
result="$(python3 "$ROOT/ops/scripts/generate-incremental-screen-runtime.py" --benchmark 1000 --workers 16 --max-millis 180000)"
jq -e '.success and .benchmarkCount==1000 and .generated==1000 and .unchanged==1000 and .incrementalReuseVerified and .failed==0' <<<"$result" >/dev/null
python3 "$ROOT/ops/scripts/generate-16lane-design-candidates.py" --self-test --lanes 16 |
  jq -e '.success and .tasks==1000 and .lanes==16' >/dev/null
python3 "$ROOT/ops/scripts/screen_layout_contracts.py" --help >/dev/null 2>&1 || true
grep -F '"mobile": {"width": 360' "$ROOT/ops/scripts/screen_layout_contracts.py" >/dev/null
grep -F 'absolutePositioning": "FORBIDDEN' "$ROOT/ops/scripts/screen_layout_contracts.py" >/dev/null
echo "PASS 1000-screen deterministic generation, 16-lane candidate scheduling, incremental reuse, and mobile contracts"
