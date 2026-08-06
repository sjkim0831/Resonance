#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
checks='authenticatedAdmin,api,database,authority,exceptionStates,responsive,accessibility,desktop,mobile'

evidence="$(RESONANCE_ROOT="$ROOT" bash "$ROOT/ops/scripts/resonance-member-lifecycle-admin-e2e.sh")"
for step in MEMBER_LIFECYCLE_01_PLAN MEMBER_LIFECYCLE_02_WORK; do
  printf '%s' "$evidence" | bash "$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh" \
    MEMBER_LIFECYCLE "$step" "$checks" ADMIN
done

printf '%s\n' "$evidence"
