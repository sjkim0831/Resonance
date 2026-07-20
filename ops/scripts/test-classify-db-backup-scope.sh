#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLASSIFIER="$ROOT_DIR/ops/scripts/classify-db-backup-scope.sh"

assert_scope() {
  local expected="$1" path="$2" actual
  actual="$(printf '%s\n' "$path" | bash "$CLASSIFIER")"
  [[ "$actual" == "$expected" ]] || { echo "expected=$expected actual=$actual path=$path" >&2; exit 1; }
}

assert_scope menu apps/carbonet-api/src/main/resources/db/migration/postgresql/V1__menu_navigation.sql
assert_scope governance apps/carbonet-api/src/main/resources/db/migration/postgresql/V2__register_common_user_gnb.sql
assert_scope governance apps/carbonet-api/src/main/resources/db/migration/postgresql/V3__component_design_asset.sql
assert_scope activity apps/carbonet-api/src/main/resources/db/migration/postgresql/V4__activity_evidence.sql
assert_scope full apps/carbonet-api/src/main/resources/db/migration/postgresql/V5__unknown_schema.sql
echo "[db-backup-scope] PASS"
