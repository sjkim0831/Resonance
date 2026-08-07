#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
checks='authenticatedAdmin,api,database,authority,exceptionStates,responsive,accessibility,desktop,mobile'
steps=(MEMBER_LIFECYCLE_01_PLAN MEMBER_LIFECYCLE_02_WORK)
contracts='[]'
for step in "${steps[@]}"; do
  contract="$(bash "$ROOT/ops/scripts/capture-business-e2e-contract.sh" MEMBER_LIFECYCLE "$step")"
  contracts="$(jq -cn --argjson contracts "$contracts" --argjson contract "$contract" '$contracts+[$contract]')"
done
raw_evidence="$(RESONANCE_ROOT="$ROOT" bash "$ROOT/ops/scripts/resonance-member-lifecycle-admin-e2e.sh")"
evidence="$(jq -cn --argjson result "$raw_evidence" --argjson contracts "$contracts" '$result+{contracts:$contracts}')"
# This suite does not prove audit, recovery, or performance. Keep its evidence
# useful without promoting a professional screen contract from partial proof.
for step in "${steps[@]}"; do
  printf '%s' "$evidence" | bash "$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh" \
    MEMBER_LIFECYCLE "$step" "$checks" ADMIN --validate-only >/dev/null
done

printf '%s\n' "$evidence"
