#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
checks="authenticatedAdmin,api,database,authority,exceptionStates,responsive,accessibility,desktop,mobile,relay,handoff,actorSwitch,idempotency"
evidence="$(RESONANCE_ROOT="$ROOT" node "$ROOT/ops/scripts/resonance-member-lifecycle-relay-e2e.mjs")"
for step in MEMBER_LIFECYCLE_01_PLAN MEMBER_LIFECYCLE_02_WORK MEMBER_LIFECYCLE_03_VERIFY MEMBER_LIFECYCLE_04_APPROVE; do
  printf '%s' "$evidence" | "$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh" \
    MEMBER_LIFECYCLE "$step" "$checks" USER
done
