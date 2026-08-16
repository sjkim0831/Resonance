#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPILER="$ROOT/ops/scripts/generate-safe-migrations-from-design.py"
CLASSIFIER="$ROOT/ops/scripts/classify-safe-additive-ddl.py"
MIGRATIONS="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql"
tmp="$(mktemp -d)"
generated=""
incremental=""
cleanup() { [[ -z "$generated" ]] || rm -f "$generated"; [[ -z "$incremental" ]] || rm -f "$incremental"; rm -rf "$tmp"; }
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
python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["success"] and d["generated"]==0 and d["plans"][0]["status"]=="VALIDATED"' <<<"$check"
before="$(find "$MIGRATIONS" -maxdepth 1 -name '*__design_design_pipeline_create.sql' -print)"
[[ -z "$before" ]]
result="$(python3 "$COMPILER" "$tmp" --root "$ROOT")"
python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["success"] and d["generated"]==1 and d["reviewRequired"]==0' <<<"$result"
generated="$(find "$MIGRATIONS" -maxdepth 1 -name '*__design_design_pipeline_create.sql' -print -quit)"
[[ -n "$generated" ]]
grep -q '^-- resonance-deploy-profile: safe-additive-schema$' "$generated"
grep -q '^-- design-package-schema-set-hash: ' "$generated"
schema_hash="$(sed -n 's/^-- design-package-schema-set-hash: //p' "$generated")"
grep -q "^COMMENT ON TABLE framework_design_pipeline_fixture IS 'design-schema-hash:${schema_hash}';$" "$generated"
python3 "$CLASSIFIER" "$generated" | grep -q '^safe-additive '

unchanged="$(python3 "$COMPILER" "$tmp" --root "$ROOT")"
python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["success"] and d["generated"]==0 and d["unchanged"]==1' <<<"$unchanged"

python3 - "$tmp/DESIGN_PIPELINE__CREATE.json" <<'PY'
import json,sys
path=sys.argv[1]
package=json.load(open(path,encoding="utf-8"))
package["database"]["schemaChanges"].append({
  "operation":"CREATE_TABLE","tableName":"framework_design_pipeline_detail",
  "columns":[{"name":"id","type":"bigint","primaryKey":True,"nullable":False}],
  "uniqueConstraints":[],"indexes":[]})
open(path,"w",encoding="utf-8").write(json.dumps(package,separators=(",",":")))
PY
incremental_result="$(python3 "$COMPILER" "$tmp" --root "$ROOT")"
python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["success"] and d["generated"]==1 and d["reviewRequired"]==0' <<<"$incremental_result"
incremental="$(find "$MIGRATIONS" -maxdepth 1 -name '*__design_design_pipeline_create.sql' -print | grep -Fvx "$generated" | head -1)"
[[ -n "$incremental" ]]
! grep -q '^CREATE TABLE framework_design_pipeline_fixture ' "$incremental"
grep -q '^CREATE TABLE framework_design_pipeline_detail ' "$incremental"
grep -Eq "^COMMENT ON TABLE framework_design_pipeline_detail IS 'design-schema-hash:[0-9a-f]{64}';$" "$incremental"
incremental_unchanged="$(python3 "$COMPILER" "$tmp" --root "$ROOT")"
python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["success"] and d["generated"]==0 and d["unchanged"]==1' <<<"$incremental_unchanged"

cat >"$tmp/DESIGN_PIPELINE__CREATE.json" <<'JSON'
{"process":{"code":"DESIGN_PIPELINE"},"step":{"code":"CREATE"},"database":{"autoGenerateMigration":true,"schemaChanges":[{"operation":"ALTER_TABLE","tableName":"existing"}]}}
JSON
set +e
review="$(python3 "$COMPILER" "$tmp" --root "$ROOT")"; status=$?
set -e
[[ "$status" -eq 2 ]]
python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["success"] is False and d["reviewRequired"]==1 and d["plans"][0]["status"]=="REVIEW_REQUIRED"' <<<"$review"

echo '[design-migration-pipeline] PASS check=1 generated=2 localMarker=2 classifier=1 idempotent=2 incrementalAB=1 unsafeReview=1'
