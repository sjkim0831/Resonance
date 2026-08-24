#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
M="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260824001000__publish_restricted_process_generation_bundle.sql"
G="$ROOT/ops/scripts/generate-full-stack-design-packages.sh"
for token in 'SECURITY DEFINER' "requested_process!~'^[A-Z][A-Z0-9_]{1,79}$'" \
  'REVOKE ALL ON FUNCTION public.framework_process_generation_bundle(text) FROM PUBLIC' \
  'GRANT EXECUTE ON FUNCTION public.framework_process_generation_bundle(text) TO carbonet_app'; do
  grep -Fq "$token" "$M"
done
grep -Fq "select framework_process_generation_bundle('\$PROCESS_CODE');" "$G"
grep -Fq "to_regprocedure('public.framework_process_generation_bundle(text)')" "$G"
if grep -Eq 'GRANT EXECUTE ON FUNCTION public\.framework_source_canonical_' "$M"; then
  echo 'private SOURCE compiler was exposed' >&2; exit 1
fi
echo PROCESS_GENERATION_BUNDLE_BOUNDARY_PASS
