#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash ops/scripts/build-restart-18000.sh

Purpose:
  Run the canonical local build/package/runtime refresh line for :18000.

Follow with:
  bash ops/scripts/run-large-move-app-closure.sh
  bash ops/scripts/hermes-verify-18000-freshness.sh

Quick guide:
  bash ops/scripts/show-app-closure-sequence.sh
EOF
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/build.sh
source "$ROOT_DIR/ops/scripts/build.sh" 2>/dev/null || true
init_build_tool

echo "[build-restart-18000] frontend build started"
(cd "$ROOT_DIR/projects/carbonet-frontend/source" && npm run build)

FRONTEND_DIR="$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static/react-app"
BACKEND_DIR="$ROOT_DIR/apps/carbonet-api/src/main/resources/static/react-app"
VERIFY_SCRIPT="$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs"

echo "[build-restart-18000] frontend asset closure verification started"
node "$VERIFY_SCRIPT" "$FRONTEND_DIR"

echo "[build-restart-18000] immutable frontend copy started"
rm -rf "$BACKEND_DIR"
mkdir -p "$BACKEND_DIR"
cp -a "$FRONTEND_DIR/." "$BACKEND_DIR/"
node "$VERIFY_SCRIPT" "$BACKEND_DIR"

echo "[build-restart-18000] backend package started"
(cd "$ROOT_DIR" && jbuild -q -pl apps/carbonet-api -am -Dmaven.test.skip=true package)

echo "[build-restart-18000] packaged JAR asset verification started"
RUNTIME_JAR="$(jbooted project-runtime)"
JAR_ENTRIES="$(mktemp)"
EXPECTED_ENTRIES="$(mktemp)"
trap 'rm -f "$JAR_ENTRIES" "$EXPECTED_ENTRIES"' EXIT
jar tf "$RUNTIME_JAR" | sort > "$JAR_ENTRIES"
find "$BACKEND_DIR" -type f -printf 'BOOT-INF/classes/static/react-app/%P\n' | sort > "$EXPECTED_ENTRIES"
MISSING_ENTRY="$(comm -23 "$EXPECTED_ENTRIES" "$JAR_ENTRIES" | head -1)"
if [[ -n "$MISSING_ENTRY" ]]; then
  echo "[build-restart-18000] packaged JAR is missing frontend asset: $MISSING_ENTRY" >&2
  exit 1
fi
echo "[build-restart-18000] packaged JAR contains the complete frontend asset closure"

CANONICAL_JAR="$ROOT_DIR/apps/carbonet-api/target/carbonet-api.jar"
if [[ "$RUNTIME_JAR" != "$CANONICAL_JAR" ]]; then
  mkdir -p "$(dirname "$CANONICAL_JAR")"
  cp "$RUNTIME_JAR" "$CANONICAL_JAR"
fi

echo "[build-restart-18000] service restart started"
FORCE_SERVER_SSL_ENABLED=false bash "$ROOT_DIR/ops/scripts/restart-18000-runtime.sh"

echo "[build-restart-18000] completed"
