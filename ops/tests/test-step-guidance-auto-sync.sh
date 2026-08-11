#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260811154000__synchronize_step_guidance_contracts.sql"

for contract in \
  'framework_sync_step_guidance_contract()' \
  'trg_sync_step_guidance_contract' \
  "'CANONICAL_STEP:ACTOR_AUTHORIZED'" \
  "applicability_rule LIKE 'CANONICAL_STEP:%'" \
  "WHEN NEW.requires_user_page AND NEW.requires_admin_page THEN 'USER_ADMIN_RELAY'" \
  'jsonb_array_length(guidance.required_sections) > 0' \
  'guided_steps <> total_steps'; do
  grep -Fq "$contract" "$MIGRATION" || {
    echo "[step-guidance-auto-sync] FAIL missing=$contract" >&2
    exit 1
  }
done

grep -Fq "ON CONFLICT(process_code, step_code) DO UPDATE" "$MIGRATION"
grep -Fq "WHERE framework_step_guidance_contract.applicability_rule LIKE 'CANONICAL_STEP:%'" "$MIGRATION"
echo '[step-guidance-auto-sync] PASS curated=preserved generated=refreshable coverage=fail-closed'
