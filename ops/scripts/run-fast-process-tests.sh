#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PROCESS="${1:-all}"
PACKAGES="${FULL_STACK_PACKAGE_OUT:-$ROOT/projects/carbonet-backend-metadata/process-runtime/generated}"
CACHE="${FAST_PROCESS_TEST_CACHE:-$ROOT/var/verification/process-package-tests}"
EVIDENCE="${FAST_PROCESS_TEST_EVIDENCE:-$ROOT/var/test-evidence/process-package-tests}"
RUNNER="$ROOT/ops/scripts/fast-process-package-test.py"

mkdir -p "$CACHE" "$EVIDENCE"
if [[ "$PROCESS" == "all" ]]; then
  mapfile -t targets < <(find "$PACKAGES" -mindepth 2 -maxdepth 2 -name index.json -print | sort)
else
  targets=("$PACKAGES/$PROCESS/index.json")
fi
[[ "${#targets[@]}" -gt 0 ]] || { echo '[fast-process-tests] no generated process package found' >&2; exit 2; }

start_ns="$(date +%s%N)"
result=0
for target in "${targets[@]}"; do
  process_code="$(basename "$(dirname "$target")")"
  python3 "$RUNNER" "$target" --cache-dir "$CACHE" --evidence "$EVIDENCE/$process_code.json" >/dev/null || result=1
done
duration_ms="$((($(date +%s%N)-start_ns)/1000000))"
package_count="$(jq -s '[.[].packageCount] | add // 0' "$EVIDENCE"/*.json)"
cached_count="$(jq -s '[.[].cachedCount] | add // 0' "$EVIDENCE"/*.json)"
printf '{"status":"%s","processCount":%s,"packageCount":%s,"cachedCount":%s,"durationMs":%s,"evidence":"%s"}\n' \
  "$([[ "$result" -eq 0 ]] && echo PASSED || echo FAILED)" "${#targets[@]}" "$package_count" "$cached_count" "$duration_ms" "$EVIDENCE"
exit "$result"
