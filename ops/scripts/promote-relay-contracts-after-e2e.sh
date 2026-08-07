#!/usr/bin/env bash
set -euo pipefail

[[ $# -eq 1 ]] || { echo "usage: $0 EVIDENCE_JSON" >&2; exit 2; }
EVIDENCE_FILE="$1"
[[ -s "$EVIDENCE_FILE" ]] || { echo "relay evidence is missing" >&2; exit 2; }
[[ -n "${PRE_RUN_CONTRACTS:-}" ]] || { echo "pre-run relay contract envelopes are missing" >&2; exit 3; }

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PROMOTER="$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh"
SOURCE_COMMIT="$(jq -r 'map(.sourceCommit)|unique|if length==1 then .[0] else error("mixed source commits") end' <<<"$PRE_RUN_CONTRACTS")"
EVIDENCE="$(jq -c \
  --arg executedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg sourceCommit "$SOURCE_COMMIT" \
  '. + {executedAt:$executedAt,sourceCommit:$sourceCommit}' "$EVIDENCE_FILE")"
EVIDENCE="$(jq -cn --argjson result "$EVIDENCE" --argjson contracts "$PRE_RUN_CONTRACTS" '$result+{contracts:$contracts}')"
VISUAL_EVIDENCE_FILE="$ROOT/var/test-evidence/twenty-step-relay-latest.json"
[[ -s "$VISUAL_EVIDENCE_FILE" ]] || { echo "visual relay evidence is missing" >&2; exit 2; }
EVIDENCE="$(jq -c --slurpfile visual "$VISUAL_EVIDENCE_FILE" '
  . + {
    performanceP95Ms: (.performanceP95Ms // 0),
    responsive: ($visual[0].summary.responsive // 0),
    accessibility: ($visual[0].summary.accessibility // 0),
    authority: (if .authorityDenialCount > 0 then 1 else 0 end),
    audit: (if ([.transitions[].eventId | select(. != null)] | length) == .transitionCount then 1 else 0 end),
    recovery: (if .recoveryVerified == true then 1 else 0 end)
  }' <<<"$EVIDENCE")"

jq -e '
  .status=="PASSED" and .processCount==(.processes|unique|length) and
  .stepCount==([.transitions[]|(.processCode+"/"+.stepCode)]|unique|length) and
  .transitionCount==(.transitions|length) and
  .accountCount==([.transitions[].account]|unique|length) and
  .correctionReplayCount==(.transitionCount-.stepCount)
  and .performanceP95Ms>0 and .responsive==1 and .accessibility==1
  and .authority==1 and .audit==1 and .recovery==1 and .cleanup==true
' <<<"$EVIDENCE" >/dev/null

mapfile -t TARGETS < <(jq -r '.transitions|unique_by(.processCode,.stepCode)|.[]|[.processCode,.stepCode]|@tsv' <<<"$EVIDENCE")
expected_steps="$(jq -r '.stepCount' <<<"$EVIDENCE")"
[[ ${#TARGETS[@]} -eq $expected_steps ]] || { echo "relay target count does not match evidence" >&2; exit 3; }
ASSERTIONS="$(jq -r '"processCount=\(.processCount),stepCount=\(.stepCount),transitionCount=\(.transitionCount),accountCount=\(.accountCount),correctionReplayCount=\(.correctionReplayCount),responsive=1,accessibility=1,authority=1,audit=1,recovery=1"' <<<"$EVIDENCE")"

# The relay suite proves workflow/browser dimensions but not the complete
# API/database/exception-state envelope required for contract promotion.
# Validate its own assertions without claiming or writing a full promotion.
validated=0
for target in "${TARGETS[@]}"; do
  IFS=$'\t' read -r process_code step_code <<<"$target"
  printf '%s' "$EVIDENCE" | bash "$PROMOTER" "$process_code" "$step_code" \
    "$ASSERTIONS" --validate-only >/dev/null
  validated=$((validated+1))
done

printf '{"status":"EVIDENCE_VALIDATED","promotionEligible":false,"blocker":"API_DATABASE_EXCEPTION_EVIDENCE_REQUIRED","processCount":%s,"stepCount":%d,"sourceCommit":"%s"}\n' \
  "$(jq -r '.processCount' <<<"$EVIDENCE")" "$validated" "$SOURCE_COMMIT"
