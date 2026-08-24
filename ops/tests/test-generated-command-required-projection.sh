#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
M="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260824002000__require_generated_command_projection_fields.sql"
grep -Fq "'required', true" "$M"
grep -Fq "framework_normalize_generated_composite_design(jsonb)" "$M"
grep -Fq "patch target is not exact" "$M"
grep -Fq 'GRANT EXECUTE ON FUNCTION public.framework_normalize_generated_composite_design(jsonb) TO carbonet_app' "$M"
echo GENERATED_COMMAND_REQUIRED_PROJECTION_PASS
