#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GENERATOR="$ROOT_DIR/ops/scripts/create-safe-additive-migration.py"
CLASSIFIER="$ROOT_DIR/ops/scripts/classify-safe-additive-ddl.py"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

cat >"$tmp_dir/safe.sql" <<'SQL'
CREATE TABLE framework_generator_contract_fixture (
  id bigserial PRIMARY KEY,
  label varchar(100) NOT NULL
);
SQL

output="$(python3 "$GENERATOR" --name 'generator contract fixture' --input "$tmp_dir/safe.sql" --version 20991231235959)"
path="$(sed -n 's/^path=//p' <<<"$output")"
generated="$ROOT_DIR/$path"
trap 'rm -rf "$tmp_dir"; rm -f "$generated"' EXIT
grep -q '^-- resonance-deploy-profile: safe-additive-schema$' "$generated"
grep -q '^-- generated-by: create-safe-additive-migration.py$' "$generated"
python3 "$CLASSIFIER" "$generated" | grep -q '^safe-additive '
[[ "$path" == apps/carbonet-api/src/main/resources/db/migration/postgresql/V20991231235959__generator_contract_fixture.sql ]]

cat >"$tmp_dir/unsafe.sql" <<'SQL'
ALTER TABLE framework_development_job ADD COLUMN unsafe_fixture text;
SQL
if python3 "$GENERATOR" --name unsafe --input "$tmp_dir/unsafe.sql" --version 20991231235958 >/dev/null 2>&1; then
  echo "unsafe migration was generated" >&2
  exit 1
fi
[[ ! -e "$ROOT_DIR/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20991231235958__unsafe.sql" ]]

echo '[safe-additive-generator] PASS canonicalPath=1 profileGate=1 safe=1 unsafeRejected=1'
