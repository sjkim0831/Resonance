#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TARGET="$ROOT/ops/scripts/sync-kisa-runtime-library.sh"
bash -n "$TARGET"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
printf 'kisa-sdk-fixture\n' >"$tmp/source.jar"
KISA_RUNTIME_LIBRARY_SOURCE="$tmp/source.jar" \
CARBONET_BACKEND_LIB_OVERLAY_DIR="$tmp/overlay" \
  bash "$TARGET" | grep -q '^\[kisa-runtime-library\] PASS '
cmp -s "$tmp/source.jar" "$tmp/overlay/source.jar"
[[ "$(stat -c '%a' "$tmp/overlay/source.jar")" == 644 ]]
if KISA_RUNTIME_LIBRARY_SOURCE="$tmp/missing.jar" \
  CARBONET_BACKEND_LIB_OVERLAY_DIR="$tmp/overlay" bash "$TARGET" >/dev/null 2>&1; then
  echo '[kisa-runtime-library-contract] missing source was accepted' >&2
  exit 1
fi
grep -Fq 'sync-kisa-runtime-library.sh' "$ROOT/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"
grep -Fq '/opt/Resonance/third_party/kisa/kr.or.kisa.dapc.core-1.0.0.jar' "$TARGET"
if grep -Fq 'if [[ -f "$ROOT_DIR/third_party/kisa/' "$ROOT/ops/scripts/resonance-k8s-build-deploy-80-v2.sh"; then
  echo '[kisa-runtime-library-contract] deploy still skips an untracked SDK' >&2
  exit 1
fi
echo '[kisa-runtime-library-contract] PASS atomic=1 checksum=1 missing=blocked deploy=connected'
