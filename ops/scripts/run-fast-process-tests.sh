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
  # The root manifest is the single generated source of truth. Per-process
  # manifests are retained for incremental jobs and can be stale after a global
  # regeneration, so aggregating them can both omit and double-count steps.
  targets=("$PACKAGES/index.json")
else
  targets=("$PACKAGES/$PROCESS/index.json")
fi
[[ "${#targets[@]}" -gt 0 && -s "${targets[0]}" ]] || { echo '[fast-process-tests] no generated process package found' >&2; exit 2; }

start_ns="$(date +%s%N)"
result=0
for target in "${targets[@]}"; do
  process_code="$(basename "$(dirname "$target")")"
  evidence_name="$process_code"
  [[ "$PROCESS" == "all" ]] && evidence_name="all"
  python3 "$RUNNER" "$target" --cache-dir "$CACHE" --evidence "$EVIDENCE/$evidence_name.json" >/dev/null || result=1
done
duration_ms="$((($(date +%s%N)-start_ns)/1000000))"
if [[ "$PROCESS" == "all" ]]; then
  process_count="$(jq '[.packages[].processCode] | unique | length' "${targets[0]}")"
  package_count="$(jq -r '.packageCount' "$EVIDENCE/all.json")"
  cached_count="$(jq -r '.cachedCount' "$EVIDENCE/all.json")"
  review_required="$(jq -r '.skippedReviewRequired // 0' "${targets[0]}")"
else
  process_count=1
  package_count="$(jq -r '.packageCount' "$EVIDENCE/$evidence_name.json")"
  cached_count="$(jq -r '.cachedCount' "$EVIDENCE/$evidence_name.json")"
  review_required=0
fi
printf '{"status":"%s","processCount":%s,"packageCount":%s,"cachedCount":%s,"durationMs":%s,"evidence":"%s"}\n' \
  "$([[ "$result" -eq 0 ]] && echo PASSED || echo FAILED)" "$process_count" "$package_count" "$cached_count" "$duration_ms" "$EVIDENCE"
if [[ "$PROCESS" == "all" && "$review_required" -gt 0 ]]; then
  echo "[fast-process-tests] REVIEW_REQUIRED steps=$review_required (not promoted or counted as passed)" >&2
fi
exit "$result"
