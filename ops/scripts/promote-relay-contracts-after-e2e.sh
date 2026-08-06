#!/usr/bin/env bash
set -euo pipefail

[[ $# -eq 1 ]] || { echo "usage: $0 EVIDENCE_JSON" >&2; exit 2; }
EVIDENCE_FILE="$1"
[[ -s "$EVIDENCE_FILE" ]] || { echo "relay evidence is missing" >&2; exit 2; }

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PROMOTER="$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh"
SOURCE_COMMIT="$(git -C "$ROOT" rev-parse HEAD)"
EVIDENCE="$(jq -c \
  --arg executedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg sourceCommit "$SOURCE_COMMIT" \
  '. + {executedAt:$executedAt,sourceCommit:$sourceCommit}' "$EVIDENCE_FILE")"

jq -e '
  .status=="PASSED" and .processCount==(.processes|unique|length) and
  .stepCount==([.transitions[]|(.processCode+"/"+.stepCode)]|unique|length) and
  .transitionCount==(.transitions|length) and
  .accountCount==([.transitions[].account]|unique|length) and
  .correctionReplayCount==(.transitionCount-.stepCount)
' <<<"$EVIDENCE" >/dev/null

mapfile -t TARGETS < <(jq -r '.transitions|unique_by(.processCode,.stepCode)|.[]|[.processCode,.stepCode]|@tsv' <<<"$EVIDENCE")
expected_steps="$(jq -r '.stepCount' <<<"$EVIDENCE")"
[[ ${#TARGETS[@]} -eq $expected_steps ]] || { echo "relay target count does not match evidence" >&2; exit 3; }
ASSERTIONS="$(jq -r '"processCount=\(.processCount),stepCount=\(.stepCount),transitionCount=\(.transitionCount),accountCount=\(.accountCount),correctionReplayCount=\(.correctionReplayCount)"' <<<"$EVIDENCE")"

promoted=0
for target in "${TARGETS[@]}"; do
  IFS=$'\t' read -r process_code step_code <<<"$target"
  printf '%s' "$EVIDENCE" | bash "$PROMOTER" "$process_code" "$step_code" \
    "$ASSERTIONS" >/dev/null
  promoted=$((promoted+1))
done

printf '{"status":"PROMOTED","processCount":%s,"stepCount":%d,"sourceCommit":"%s"}\n' \
  "$(jq -r '.processCount' <<<"$EVIDENCE")" "$promoted" "$SOURCE_COMMIT"
