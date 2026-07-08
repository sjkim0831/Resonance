#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'USAGE'
Usage:
  bash ops/scripts/resonance-core-build.sh [core|adaptor|ops|all]

Purpose:
  Build shared framework units without building/deploying the project runtime image.
USAGE
}

target="${1:-core}"
case "$target" in
  -h|--help)
    usage
    exit 0
    ;;
  core)
    exec ./gradlew resonanceCoreBuild --no-daemon
    ;;
  adaptor)
    exec ./gradlew resonanceAdaptorBuild --no-daemon
    ;;
  ops)
    exec ./gradlew resonanceOpsBuild --no-daemon
    ;;
  all)
    exec ./gradlew resonanceCoreBuild resonanceAdaptorBuild resonanceOpsBuild --no-daemon
    ;;
  *)
    echo "Unknown target: $target" >&2
    usage >&2
    exit 2
    ;;
esac
