#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
M="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260823014500__scope_generated_command_routes.sql"
for token in "processCode" "stepCode" "audience" "generated command route postcondition failed"; do grep -Fq "$token" "$M"; done
[[ "$(grep -o "lower(identity->>'" "$M"|wc -l)" -eq 3 ]]
printf 'GENERATED_COMMAND_ROUTE_SCOPE_PASS\n'
