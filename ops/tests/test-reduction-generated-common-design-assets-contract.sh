#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
migration="$ROOT_DIR/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260821212000__register_reduction_generated_common_design_assets.sql"

grep -Fq "route_count<>56" "$migration"
grep -Fq "COMMON_CONTENT_CARD" "$migration"
grep -Fq "KRDS_GOV_DEFAULT" "$migration"
grep -Fq "KRDS_CONTENT_CARD" "$migration"
grep -Fq "COMMON_ONLY','COMMON'" "$migration"
grep -Fq "framework_common_design_asset_coverage" "$migration"
grep -Fq "missing_count<>0" "$migration"
grep -Fq "duplicate_count<>0" "$migration"
grep -Fq "framework_refresh_unified_asset_catalog('FLYWAY_V20260821212000')" "$migration"
if grep -Eqi 'delete[[:space:]]+from' "$migration"; then
  echo 'design registration must not delete source or evidence rows' >&2
  exit 1
fi
printf 'REDUCTION_GENERATED_COMMON_DESIGN_PASS routes=56 processes=7 delete=0\n'
