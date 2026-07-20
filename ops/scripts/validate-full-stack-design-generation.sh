#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
OUT="${FULL_STACK_PACKAGE_OUT:-$ROOT/projects/carbonet-backend-metadata/process-runtime/generated}"
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
    ([.frontend.pages[].fields|length] | all(.>=10))
  ' "$path" >/dev/null || { echo "[full-stack-generation] incomplete $file" >&2; exit 1; }
done < <(jq -r '.packages[]|[.package,.packageHash]|@tsv' "$INDEX")

echo "[full-stack-generation] PASS packages=$(jq -r '.packageCount' "$INDEX")"
