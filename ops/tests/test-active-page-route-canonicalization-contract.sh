#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
migration="$ROOT_DIR/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260821210500__canonicalize_active_page_routes.sql"
generator="$ROOT_DIR/ops/scripts/generate-screen-system-assets.mjs"

grep -Fq "DUPLICATE_ACTIVE_ROUTE" "$migration"
grep -Fq "page.page_id=audit.retired_page_id" "$migration"
grep -Fq "SET active_yn='N'" "$migration"
grep -Fq "uq_ui_page_manifest_active_route" "$migration"
grep -Fq "framework_refresh_unified_asset_catalog('FLYWAY_V20260821210500')" "$migration"
grep -Fq "CASE WHEN left(p.page_id,6)='ADOPT_'" "$migration"
grep -Fq "active_yn=EXCLUDED.active_yn" "$generator"
grep -Fq "routeActiveExpression" "$generator"

if grep -Eqi 'delete[[:space:]]+from[[:space:]]+ui_page_manifest' "$migration"; then
  echo 'canonicalization must preserve retired page rows' >&2
  exit 1
fi

node --check "$generator"
printf 'ACTIVE_PAGE_ROUTE_CANONICALIZATION_PASS guards=8 delete=0\n'
