#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
OUT="${FULL_STACK_PACKAGE_OUT:-$ROOT/projects/carbonet-backend-metadata/process-runtime/generated}"
PREVIEW_OUT="${FULL_STACK_PREVIEW_OUT:-$ROOT/projects/carbonet-backend-metadata/process-runtime/design-preview}"
INDEX="$OUT/index.json"

[[ -s "$INDEX" ]] || { echo '[full-stack-generation] index missing' >&2; exit 1; }
jq -e '.schemaVersion=="2.0.0" and .packageCount==(.packages|length)' "$INDEX" >/dev/null
duplicates="$(jq '[.packages[]|(.processCode+"/"+.stepCode)] | length - (unique | length)' "$INDEX")"
[[ "$duplicates" = 0 ]] || { echo "[full-stack-generation] duplicate packages=$duplicates" >&2; exit 1; }

while IFS=$'\t' read -r file expected; do
  path="$OUT/$file"
  [[ -s "$path" ]] || { echo "[full-stack-generation] missing $file" >&2; exit 1; }
  actual="$(jq -r '.packageHash' "$path")"
  [[ "$actual" = "$expected" ]] || { echo "[full-stack-generation] hash mismatch $file" >&2; exit 1; }
  jq -e '
    .frontend.renderer=="COMMON_SDUI_RUNTIME" and
    .backend.runtime=="COMMON_PROCESS_COMMAND_RUNTIME" and
    (.step.actor.actorCode|length>0) and
    (.step.business.completionRule|length>0) and
    (.tests|length>=5) and
    .testExecution.runner=="FAST_PROCESS_CONTRACT_RUNNER" and
    .testExecution.parallelSafe==true and
    .testExecution.liveSmokeRequiredForVerified==true and
    ([.frontend.pages[].fields|length] | all(.>=8))
  ' "$path" >/dev/null || { echo "[full-stack-generation] incomplete $file" >&2; exit 1; }
done < <(jq -r '.packages[]|[.package,.packageHash]|@tsv' "$INDEX")

[[ -s "$PREVIEW_OUT/index.json" ]] || { echo '[full-stack-generation] preview index missing' >&2; exit 1; }
jq -e --slurpfile runtime "$INDEX" '
  .schemaVersion=="2.0.0" and .packageCount==(.packages|length) and
  .packageCount>=($runtime[0].packageCount) and
  ([.packages[]|(.processCode+"/"+.stepCode)] | length == (unique|length))
' "$PREVIEW_OUT/index.json" >/dev/null

echo "[full-stack-generation] PASS runtime=$(jq -r '.packageCount' "$INDEX") preview=$(jq -r '.packageCount' "$PREVIEW_OUT/index.json")"
