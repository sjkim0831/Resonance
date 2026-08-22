#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260823010500__prefer_professional_screen_route_authority.sql"
grep -Fq 'professional.process_code IS NULL' "$MIGRATION"
grep -Fq 'page.route_exact' "$MIGRATION"
grep -Fq 'page.actor_exact' "$MIGRATION"
grep -Fq 'professional screen authority postcondition failed' "$MIGRATION"
if sed 's/professional.process_code IS NULL/page.process_code IS NOT NULL/' "$MIGRATION" | grep -Fq 'professional.process_code IS NULL'; then
  echo 'authority mutation unexpectedly survived' >&2
  exit 1
fi
printf 'PROFESSIONAL_SCREEN_ROUTE_AUTHORITY_PASS\n'
