#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPILER="$ROOT/ops/scripts/generate-safe-migrations-from-design.py"
CLASSIFIER="$ROOT/ops/scripts/classify-safe-additive-ddl.py"
MIGRATIONS="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql"
tmp="$(mktemp -d)"
generated=""
cleanup() { [[ -z "$generated" ]] || rm -f "$generated"; rm -rf "$tmp"; }
trap cleanup EXIT

cat >"$tmp/DESIGN_PIPELINE__CREATE.json" <<'JSON'
{
  "process":{"code":"DESIGN_PIPELINE"},
  "step":{"code":"CREATE"},
  "database":{
    "autoGenerateMigration":true,
    "schemaChanges":[{
      "operation":"CREATE_TABLE",
      "tableName":"framework_design_pipeline_fixture",
      "columns":[
        {"name":"id","type":"uuid","primaryKey":true,"nullable":false,"default":"gen_random_uuid()"},
        {"name":"tenant_id","type":"varchar(64)","nullable":false},
        {"name":"payload_json","type":"jsonb","nullable":false}
      ],
      "indexes":[{"name":"idx_design_pipeline_fixture_tenant","columns":["tenant_id"]}]
    }]
  }
}
JSON

check="$(python3 "$COMPILER" "$tmp" --root "$ROOT" --check)"
jq -e '.success and .generated==0 and .plans[0].status=="VALIDATED"' <<<"$check" >/dev/null
before="$(find "$MIGRATIONS" -maxdepth 1 -name '*__design_design_pipeline_create.sql' -print)"
[[ -z "$before" ]]
result="$(python3 "$COMPILER" "$tmp" --root "$ROOT")"
jq -e '.success and .generated==1 and .reviewRequired==0' <<<"$result" >/dev/null
generated="$(find "$MIGRATIONS" -maxdepth 1 -name '*__design_design_pipeline_create.sql' -print -quit)"
[[ -n "$generated" ]]
grep -q '^-- resonance-deploy-profile: safe-additive-schema$' "$generated"
grep -q '^-- design-schema-hash: ' "$generated"
schema_hash="$(sed -n 's/^-- design-schema-hash: //p' "$generated")"
grep -q "^COMMENT ON TABLE framework_design_pipeline_fixture IS 'design-schema-hash:${schema_hash}';$" "$generated"
python3 "$CLASSIFIER" "$generated" | grep -q '^safe-additive '

unchanged="$(python3 "$COMPILER" "$tmp" --root "$ROOT")"
jq -e '.success and .generated==0 and .unchanged==1' <<<"$unchanged" >/dev/null

cat >"$tmp/DESIGN_PIPELINE__CREATE.json" <<'JSON'
{"process":{"code":"DESIGN_PIPELINE"},"step":{"code":"CREATE"},"database":{"autoGenerateMigration":true,"schemaChanges":[{"operation":"ALTER_TABLE","tableName":"existing"}]}}
JSON
set +e
review="$(python3 "$COMPILER" "$tmp" --root "$ROOT")"; status=$?
set -e
[[ "$status" -eq 2 ]]
jq -e '.success==false and .reviewRequired==1 and .plans[0].status=="REVIEW_REQUIRED"' <<<"$review" >/dev/null

echo '[design-migration-pipeline] PASS check=1 generated=1 marker=1 classifier=1 idempotent=1 unsafeReview=1'
