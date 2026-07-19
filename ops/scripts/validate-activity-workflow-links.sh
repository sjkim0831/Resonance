#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if grep -RIn --exclude-dir='builder-studio' --include='*.ts' --include='*.tsx' \
  '/emission/data_input' \
  "$ROOT/projects/carbonet-frontend/source/src/features" \
  "$ROOT/projects/carbonet-frontend/source/src/lib/api/menuNormalization.ts"; then
  echo '[activity-links] FAIL legacy data_input link remains in executable UI source' >&2
  exit 1
fi

if grep -n "'ACTIVITY_DATA' THEN '/emission/data_input\|'CALCULATION' THEN '/emission/simulate" \
  "$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/service/EmissionProjectRegistryService.java"; then
  echo '[activity-links] FAIL newly-created project tasks still use legacy routes' >&2
  exit 1
fi

grep -q 'koPath: "/emission/activity-data"' \
  "$ROOT/projects/carbonet-frontend/source/src/app/routes/families/emissionMonitoringFamily.ts"
grep -q 'koPath: "/emission/data_input"' \
  "$ROOT/projects/carbonet-frontend/source/src/app/routes/families/emissionMonitoringFamily.ts"

echo '[activity-links] PASS canonical workflow links use /emission/activity-data and the legacy route remains available as an alias'
