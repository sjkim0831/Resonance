#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CATALOG="${1:-/tmp/builder_output/07_export/catalog.json}"
REPORT_DIR="${2:-$ROOT/var/ai-builder/quality}"
PREVIOUS="$REPORT_DIR/last-promoted-design-manifest.json"

args=(
  --catalog "$CATALOG"
  --source-root "$ROOT"
  --report-dir "$REPORT_DIR/current"
)
[[ -f "$PREVIOUS" ]] && args+=(--previous-manifest "$PREVIOUS")

python3 "$ROOT/ai-builder/governance/quality_gate.py" "${args[@]}"

# Promotion is atomic: only a fully valid design becomes the next baseline.
install -D -m 0644 \
  "$REPORT_DIR/current/design-manifest.json" \
  "$PREVIOUS"
echo "[quality-gate] PROMOTED manifest=$PREVIOUS"
