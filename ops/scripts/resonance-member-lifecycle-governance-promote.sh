#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
checks="authenticatedAdmin,api,database,authority,exceptionStates,responsive,accessibility,desktop,mobile"
steps=(MEMBER_LIFECYCLE_03_VERIFY MEMBER_LIFECYCLE_04_APPROVE)
contracts='[]'
for step in "${steps[@]}"; do
  contract="$(bash "$ROOT/ops/scripts/capture-business-e2e-contract.sh" MEMBER_LIFECYCLE "$step")"
  contracts="$(jq -cn --argjson contracts "$contracts" --argjson contract "$contract" '$contracts+[$contract]')"
done
raw_evidence="$(RESONANCE_ROOT="$ROOT" node "$ROOT/ops/scripts/resonance-member-lifecycle-governance-e2e.mjs")"
evidence="$(jq -cn --argjson result "$raw_evidence" --argjson contracts "$contracts" '$result+{contracts:$contracts}')"
for step in "${steps[@]}"; do
  printf '%s' "$evidence" | "$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh" \
    MEMBER_LIFECYCLE "$step" "$checks" ADMIN
done
