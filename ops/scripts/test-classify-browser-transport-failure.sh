#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

printf '%s\n' 'Error: Target page, context or browser has been closed' > "$TMP_ROOT/transient.log"
printf '%s\n' '{"failures":[],"failedRouteCount":0}' > "$TMP_ROOT/clean-summary.json"
node "$SCRIPT_DIR/classify-browser-transport-failure.mjs" \
  "$TMP_ROOT/transient.log" "$TMP_ROOT/clean-summary.json"

printf '%s\n' '{"failures":[{"route":"/broken"}],"failedRouteCount":1}' > "$TMP_ROOT/failed-summary.json"
if node "$SCRIPT_DIR/classify-browser-transport-failure.mjs" \
  "$TMP_ROOT/transient.log" "$TMP_ROOT/failed-summary.json"; then
  echo '[browser-transport-classifier-test] deterministic failure was misclassified' >&2
  exit 1
fi

printf '%s\n' 'Error: expected heading was not visible' > "$TMP_ROOT/functional.log"
if node "$SCRIPT_DIR/classify-browser-transport-failure.mjs" \
  "$TMP_ROOT/functional.log" "$TMP_ROOT/clean-summary.json"; then
  echo '[browser-transport-classifier-test] functional failure was misclassified' >&2
  exit 1
fi

echo '[browser-transport-classifier-test] PASS'
