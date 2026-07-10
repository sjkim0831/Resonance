#!/usr/bin/env bash
# Stage Resonance runtime build context for multi-target Dockerfile.
#
# Usage:
#   bash ops/scripts/resonance-stage-build-context.sh <RUNTIME> [PROJECT_ID]
#     RUNTIME     = project | operations
#     PROJECT_ID  = P003 (default)
#
# Output: var/releases/<PROJECT_ID>/build-context-<RUNTIME>/
#   - project/operations .jar
#   - lib/ (project only)
#   - config/ (project only)
set -euo pipefail

RUNTIME="${1:?RUNTIME (project|operations) is required}"
PROJECT_ID="${2:-P003}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=ops/scripts/build.sh
source "$ROOT_DIR/ops/scripts/build.sh" 2>/dev/null || true
init_build_tool

CONTEXT_DIR="$ROOT_DIR/var/releases/$PROJECT_ID/build-context-$RUNTIME"
rm -rf "$CONTEXT_DIR"
mkdir -p "$CONTEXT_DIR"

case "$RUNTIME" in
    project)
        JAR="$(jbooted project-runtime)"
        [[ -f "$JAR" ]] || { echo "JAR not found: $JAR" >&2; exit 2; }
        cp "$JAR" "$CONTEXT_DIR/carbonet-api.jar"
        # lib dir is shared common library dir if present
        if [[ -d "$ROOT_DIR/var/lib/common" ]]; then
            mkdir -p "$CONTEXT_DIR/lib"
            cp -rn "$ROOT_DIR/var/lib/common/"* "$CONTEXT_DIR/lib/" 2>/dev/null || true
        fi
        # KISA third-party
        KISA_DIR="$ROOT_DIR/third_party/kisa"
        if [[ -d "$KISA_DIR" ]]; then
            mkdir -p "$CONTEXT_DIR/lib"
            find "$KISA_DIR" -name "*.jar" -exec cp {} "$CONTEXT_DIR/lib/" \; 2>/dev/null || true
        fi
        # config dir
        if [[ -d "$ROOT_DIR/ops/config" ]]; then
            mkdir -p "$CONTEXT_DIR/ops/config"
            cp -rn "$ROOT_DIR/ops/config/"* "$CONTEXT_DIR/ops/config/" 2>/dev/null || true
        fi
        ;;
    operations)
        JAR="$(jbooted operations-console)"
        [[ -f "$JAR" ]] || { echo "JAR not found: $JAR" >&2; exit 2; }
        cp "$JAR" "$CONTEXT_DIR/operations-console.jar"
        ;;
    *)
        echo "RUNTIME must be 'project' or 'operations', got: $RUNTIME" >&2
        exit 1
        ;;
esac

echo "Build context staged at: $CONTEXT_DIR"
ls -la "$CONTEXT_DIR"
