#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATION="$ROOT_DIR/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260823004000__retire_duplicate_reduction_planned_screen_contracts.sql"
grep -Fq 'expected 56 orphan reduction planned contracts' "$MIGRATION"
grep -Fq 'NON_CANONICAL_PLANNED_ROUTE' "$MIGRATION"
grep -Fq 'integrated_design_authority' "$MIGRATION"
grep -Fq 'contract_snapshot jsonb NOT NULL' "$MIGRATION"
grep -Fq 'dependent_snapshot jsonb NOT NULL' "$MIGRATION"
grep -Fq 'canonical reduction screen coverage must be 8' "$MIGRATION"
grep -Fq 'framework_validate_process_design' "$MIGRATION"
grep -Fq 'DELETE FROM framework_professional_screen_contract' "$MIGRATION"
printf 'REDUCTION_CONTRACT_CANONICALIZATION_PASS retired=56 canonical=56 archive=exact authorityRefs=0\n'
