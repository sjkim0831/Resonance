#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SOURCE="${KISA_RUNTIME_LIBRARY_SOURCE:-$ROOT/third_party/kisa/kr.or.kisa.dapc.core-1.0.0.jar}"
TARGET_DIR="${CARBONET_BACKEND_LIB_OVERLAY_DIR:-/opt/Resonance/projects/carbonet-backend-lib}"
TARGET="$TARGET_DIR/$(basename "$SOURCE")"

[[ -s "$SOURCE" ]] || {
  echo "[kisa-runtime-library] source library is missing" >&2
  exit 2
}
mkdir -p "$TARGET_DIR"
tmp="$(mktemp "$TARGET_DIR/.kisa-runtime.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
install -m 0644 "$SOURCE" "$tmp"
source_sha="$(sha256sum "$SOURCE" | awk '{print $1}')"
target_sha="$(sha256sum "$tmp" | awk '{print $1}')"
[[ "$source_sha" == "$target_sha" ]] || {
  echo "[kisa-runtime-library] staged checksum mismatch" >&2
  exit 3
}
mv -f "$tmp" "$TARGET"
trap - EXIT
[[ "$(sha256sum "$TARGET" | awk '{print $1}')" == "$source_sha" ]] || {
  echo "[kisa-runtime-library] installed checksum mismatch" >&2
  exit 4
}
echo "[kisa-runtime-library] PASS file=$(basename "$TARGET") checksum=${source_sha:0:12}"
