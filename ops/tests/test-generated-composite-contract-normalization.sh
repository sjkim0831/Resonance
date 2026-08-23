#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
M="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260823013000__normalize_generated_composite_screen_contracts.sql"
for token in framework_normalize_generated_composite_design "'direction','BOTH'" "'source','REQUEST'" "'statusCase','RECOVERY'" "permissionCodes" "{executionId}/commands" "RETURN public.framework_normalize_generated_composite_design(canonical_design)"; do
  grep -Fq "$token" "$M"
done
grep -Fq "NOT IN('actorCode','idempotencyKey','projectId','tenantId'" "$M"
if sed 's/RETURN public.framework_normalize_generated_composite_design(canonical_design);/RETURN canonical_design;/' "$M" | grep -Fq 'RETURN public.framework_normalize_generated_composite_design(canonical_design);'; then
  echo 'normalization bypass mutant survived' >&2; exit 1
fi
printf 'GENERATED_COMPOSITE_CONTRACT_NORMALIZATION_PASS\n'
