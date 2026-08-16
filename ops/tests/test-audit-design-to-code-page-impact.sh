#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
RUNNER="$ROOT/ops/scripts/audit-design-to-code-page-impact.py"
SQL="$ROOT/ops/scripts/audit-design-to-code-page-impact.sql"
SCHEMA="$ROOT/ops/schemas/design-to-code-page-impact-ledger.schema.json"
GENERATOR="$ROOT/ops/scripts/generate-full-stack-design-packages.sh"
AUTHORITY_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260815121000__resolve_canonical_blueprint_authority.sql"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
WORK="$(mktemp -d)"
DB_NAME="page_impact_${RANDOM}_$$"
PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()
PY
)"
started_ns="$(date +%s%N)"

# A linked worktree created by Windows Git stores a Windows absolute gitdir.
# Translate it when this fixture runs inside WSL; no repository file is changed.
if [[ -f "$ROOT/.git" ]]; then
  git_dir="$(sed -n 's/^gitdir: //p' "$ROOT/.git")"
  if [[ "$git_dir" =~ ^[A-Za-z]:/ ]]; then
    git_dir="$(wslpath -u "$git_dir")"
  fi
  export GIT_DIR="$git_dir" GIT_WORK_TREE="$ROOT"
fi
export PAGE_IMPACT_SKIP_DIRTY_SCAN=1

fail() { printf 'PAGE_IMPACT_TEST_FAIL %s\n' "$*" >&2; exit 1; }
for file in "$RUNNER" "$SQL" "$SCHEMA" "$GENERATOR" "$AUTHORITY_MIGRATION"; do
  [[ -f "$file" ]] || fail "missing=$file"
done
grep -Fq 'framework_source_canonical_design_catalog' "$GENERATOR" ||
  fail 'production generator does not call SOURCE canonical design catalog'
grep -Fq 'public.framework_canonical_blueprint_authority(' "$AUTHORITY_MIGRATION" ||
  fail 'canonical screen compiler does not resolve blueprint authority'
for executable in initdb pg_ctl; do
  [[ -x "$PG_BIN/$executable" ]] || fail "missing=$PG_BIN/$executable"
done
if grep -Eiq '(^|[^[:alpha:]_])(insert|update|delete|truncate|create|alter|drop|copy)[[:space:]]' "$SQL"; then
  fail "core SQL is not read-only"
fi

mkdir -p "$WORK/socket"
"$PG_BIN/initdb" -D "$WORK/data" -A trust -U postgres --no-locale >/dev/null
"$PG_BIN/pg_ctl" -D "$WORK/data" -l "$WORK/postgres.log" \
  -o "-F -p $PORT -k $WORK/socket" -w start >/dev/null
cleanup() {
  set +e
  "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate -w stop >/dev/null 2>&1
  rm -rf "$WORK"
}
trap cleanup EXIT INT TERM
createdb -h "$WORK/socket" -p "$PORT" -U postgres "$DB_NAME"
PSQL=(psql -X -v ON_ERROR_STOP=1 -h "$WORK/socket" -p "$PORT" -U postgres -d "$DB_NAME")
DSN="postgresql://postgres@/$(printf '%s' "$DB_NAME")?host=$(printf '%s' "$WORK/socket")&port=$PORT"

"${PSQL[@]}" >/dev/null <<'SQL'
CREATE TABLE framework_process_step(
  process_code varchar(80) NOT NULL,
  step_code varchar(100) NOT NULL,
  user_path varchar(400),
  admin_path varchar(400),
  requires_user_page boolean NOT NULL,
  requires_admin_page boolean NOT NULL,
  PRIMARY KEY(process_code,step_code)
);
CREATE TABLE framework_screen_resource(
  screen_resource_id bigserial PRIMARY KEY,
  route_key varchar(500) NOT NULL UNIQUE,
  implementation_status varchar(32) NOT NULL
);
CREATE TABLE framework_process_step_screen_binding(
  binding_id bigserial PRIMARY KEY,
  process_code varchar(80) NOT NULL,
  step_code varchar(100) NOT NULL,
  screen_resource_id bigint NOT NULL,
  audience varchar(16) NOT NULL,
  binding_status varchar(24) NOT NULL
);
CREATE TABLE framework_professional_screen_contract(
  contract_id bigserial PRIMARY KEY,
  process_code varchar(80) NOT NULL,
  step_code varchar(100) NOT NULL,
  audience varchar(20) NOT NULL,
  route_path varchar(400) NOT NULL,
  api_contract text NOT NULL,
  data_contract text NOT NULL,
  section_contract text NOT NULL,
  field_contract text NOT NULL
);
CREATE TABLE framework_screen_blueprint(
  blueprint_id bigserial PRIMARY KEY,
  page_id varchar(200),
  process_code varchar(80) NOT NULL,
  step_code varchar(100) NOT NULL,
  audience varchar(20) NOT NULL,
  route_path varchar(400) NOT NULL,
  implementation_strategy varchar(30) NOT NULL,
  generated_source_path varchar(500),
  template_code varchar(80) NOT NULL,
  specification_json text NOT NULL,
  transition_status varchar(30) NOT NULL,
  source_reference varchar(500),
  validation_status varchar(20) NOT NULL
);
CREATE TABLE framework_common_design_asset_source_state(
  asset_type varchar(24) NOT NULL,
  asset_id varchar(200) NOT NULL,
  canonical_asset jsonb NOT NULL,
  PRIMARY KEY(asset_type,asset_id)
);
CREATE TABLE ui_page_manifest(
  page_id varchar(200) PRIMARY KEY,
  route_path varchar(400) NOT NULL,
  design_token_version varchar(200)
);
CREATE TABLE ui_page_component_map(
  page_id varchar(200) NOT NULL,
  component_id varchar(200) NOT NULL,
  PRIMARY KEY(page_id,component_id)
);

CREATE INDEX idx_binding_exact
  ON framework_process_step_screen_binding(process_code,step_code,audience,binding_status);
CREATE INDEX idx_contract_exact
  ON framework_professional_screen_contract(process_code,step_code,audience,route_path);
CREATE INDEX idx_blueprint_exact
  ON framework_screen_blueprint(process_code,step_code,audience,route_path,validation_status);

INSERT INTO framework_process_step VALUES
  ('P1','S1','/alpha','/admin/alpha',true,true),
  ('P1','S2','/beta',NULL,true,false),
  ('P2','S3','/gamma',NULL,true,false);
INSERT INTO framework_screen_resource(route_key,implementation_status) VALUES
  ('/alpha','VERIFIED'),('/admin/alpha','IMPLEMENTED'),
  ('/beta','DESIGN_ONLY'),('/gamma?tab=one','VERIFIED'),
  ('/alpha-aux','VERIFIED');
INSERT INTO framework_process_step_screen_binding(
  process_code,step_code,screen_resource_id,audience,binding_status
)
SELECT 'P1','S1',screen_resource_id,'USER','ACTIVE'
  FROM framework_screen_resource WHERE route_key='/alpha';
INSERT INTO framework_process_step_screen_binding(
  process_code,step_code,screen_resource_id,audience,binding_status
)
SELECT 'P1','S1',screen_resource_id,'USER','ACTIVE'
  FROM framework_screen_resource WHERE route_key='/alpha-aux';

INSERT INTO framework_professional_screen_contract(
  process_code,step_code,audience,route_path,
  api_contract,data_contract,section_contract,field_contract
) VALUES
  ('P1','S1','USER','/alpha','[{"method":"POST"}]','[{"entity":"A"}]','[{"id":"main"}]','[{"name":"a"}]'),
  ('P1','S2','USER','/beta','[{"method":"POST"}]','[{"entity":"B"}]','[{"id":"main"}]','[{"name":"b"}]'),
  ('P1','S2','USER','/beta?variant=2','[]','[]','[{"id":"other"}]','[{"name":"b2"}]'),
  ('P2','S3','USER','/gamma','[{"method":"PUT"}]','[{"entity":"C"}]','[{"id":"main"}]','[{"name":"c"}]'),
  ('P1','S1','USER','/alpha-aux','[{"method":"GET"}]','[{"entity":"AUX"}]','[{"id":"aux"}]','[{"name":"aux"}]');

INSERT INTO framework_screen_blueprint(
  page_id,process_code,step_code,audience,route_path,implementation_strategy,
  generated_source_path,template_code,specification_json,transition_status,
  source_reference,validation_status
) VALUES
  ('PAGE_ALPHA','P1','S1','USER','/alpha','GENERATED_RUNTIME','generated/p1/s1.ts',
   'KRDS_FORM','{"renderer":"JSON_FORM","assetBindings":[{"assetType":"COMPONENT","assetCode":"C1"}]}','CONTRACT_LINKED',
   'framework_professional_screen_contract:1','VALID'),
  ('PAGE_BETA','P1','S2','USER','/beta','DESIGN_REQUIRED',NULL,
   'LEGACY','{}','PLANNED',NULL,'DRAFT'),
  ('PAGE_GAMMA','P2','S3','USER','/gamma','ADOPT_EXISTING',NULL,
   'KRDS_SDUI','{"renderer":"SDUI","assetBindings":[{"type":"COMPONENT","registryKey":"C1"}]}','CONTRACT_LINKED',
   'professional_screen_contract:4','VALID'),
  ('PAGE_GAMMA','P2','S3','USER','/gamma?variant=two','ADOPT_EXISTING',NULL,
   'KRDS_SDUI','{"renderer":"SDUI"}','PLANNED',NULL,'VALID'),
  ('PAGE_ALPHA_AUX','P1','S1','USER','/alpha-aux','GENERATED_RUNTIME','generated/p1/s1-aux.ts',
   'KRDS_FORM','{"renderer":"JSON_FORM","assetBindings":[{"assetType":"COMPONENT","assetCode":"C1"}]}','CONTRACT_LINKED',
   'framework_professional_screen_contract:5','VALID');

INSERT INTO framework_common_design_asset_source_state VALUES
  ('THEME','T1','{"assetType":"THEME","assetId":"T1","payload":{"dependencies":[]}}'),
  ('COMPONENT','C1','{"assetType":"COMPONENT","assetId":"C1","payload":{"dependencies":[]}}'),
  ('SCREEN','PAGE_ALPHA','{"assetType":"SCREEN","assetId":"PAGE_ALPHA","routePath":"/alpha","payload":{"dependencies":[{"assetType":"THEME","assetId":"T1"},{"assetType":"COMPONENT","assetId":"C1"}]}}'),
  ('SCREEN','PAGE_GAMMA','{"assetType":"SCREEN","assetId":"PAGE_GAMMA","routePath":"/gamma","payload":{"dependencies":[{"assetType":"COMPONENT","assetId":"C1"}]}}'),
  ('SCREEN','PAGE_ALPHA_AUX','{"assetType":"SCREEN","assetId":"PAGE_ALPHA_AUX","routePath":"/alpha-aux","payload":{"dependencies":[{"assetType":"COMPONENT","assetId":"C1"}]}}');
INSERT INTO ui_page_manifest VALUES
  ('PAGE_ALPHA','/alpha','T1'),('PAGE_GAMMA','/gamma','T1'),
  ('PAGE_ALPHA_AUX','/alpha-aux','T1');
INSERT INTO ui_page_component_map VALUES
  ('PAGE_ALPHA','C1'),('PAGE_GAMMA','C1'),('PAGE_ALPHA_AUX','C1');

CREATE FUNCTION framework_canonical_blueprint_authority(
  requested_process_code varchar,requested_step_code varchar,
  requested_audience varchar,requested_route_path varchar,
  requested_contract_id bigint
) RETURNS bigint LANGUAGE plpgsql STABLE AS $$
DECLARE source_count integer; linked_count integer; selected bigint; sole bigint;
BEGIN
  WITH candidate AS (
    SELECT blueprint_id,
           transition_status='CONTRACT_LINKED'
           AND lower(coalesce(source_reference,''))=ANY(ARRAY[
             'professional_screen_contract:'||requested_contract_id::text,
             'framework_professional_screen_contract:'||requested_contract_id::text
           ]) linked
      FROM framework_screen_blueprint
     WHERE validation_status='VALID'
       AND upper(process_code)=upper(requested_process_code)
       AND upper(step_code)=upper(requested_step_code)
       AND upper(audience)=upper(requested_audience)
       AND lower(split_part(route_path,'?',1))=lower(split_part(requested_route_path,'?',1))
  )
  SELECT count(*),count(*) FILTER(WHERE linked),min(blueprint_id) FILTER(WHERE linked),
         CASE WHEN count(*)=1 THEN min(blueprint_id) END
    INTO source_count,linked_count,selected,sole FROM candidate;
  IF source_count=1 THEN RETURN sole; END IF;
  IF source_count>1 AND linked_count=1 THEN RETURN selected; END IF;
  RAISE EXCEPTION 'fixture canonical authority unresolved';
END
$$;

CREATE FUNCTION framework_source_canonical_design_catalog(integer,varchar)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'schema','carbonet.canonical-design/v1',
    'catalogHash',repeat('a',64),'screenCount',1,'screens','[]'::jsonb
  )
$$;
CREATE FUNCTION framework_source_canonical_endpoint_readiness(integer,varchar)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'schema','carbonet.canonical-endpoint-readiness/v1','status','PARTIAL',
    'totalCount',2,'sourceReadyCount',2,'blockerCount',2,
    'reasonCounts',jsonb_build_object('DESIGN_CONTRACT_MISSING',1,
                                      'DESIGN_CONTRACT_DUPLICATE',1)
  )
$$;
CREATE FUNCTION framework_source_canonical_endpoint_catalog(integer,varchar)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'schema','carbonet.canonical-endpoint-catalog/v1',
    'catalogHash',repeat('b',64),
    'endpoints',jsonb_build_array(jsonb_build_object('screenKey','P1|S1|USER|/alpha'),
                                  jsonb_build_object('screenKey','P2|S3|USER|/gamma'))
  )
$$;
CREATE FUNCTION framework_canonical_endpoint_readiness(integer,varchar)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'schema','carbonet.canonical-endpoint-readiness/v1','status','PARTIAL',
    'totalCount',4,'sourceReadyCount',2,'blockerCount',2
  )
$$;
CREATE FUNCTION framework_design_causality_status()
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'schema','carbonet.design-causality-status/v2','dirtySignalCount',1,
    'codegenReadiness',jsonb_build_object('status','BLOCKED',
      'inventoryScreenCount',4,'emittedScreenCount',2,
      'ownership',jsonb_build_object('generated',1,'manual',1,'hybrid',1))
  )
$$;
CREATE VIEW framework_common_design_asset_coverage AS
SELECT * FROM (VALUES
  ('alpha',true),('admin-alpha',true),('beta',false),('gamma',true),
  ('alpha-aux',true)
) source(page_id,common_assets_ready);
SQL

python3 "$RUNNER" --repo-root "$ROOT" --dsn "$DSN" \
  --db-label fixture-postgresql --output "$WORK/ledger.json"

python3 - "$WORK/ledger.json" "$SCHEMA" <<'PY'
import json, pathlib, sys
from jsonschema import Draft202012Validator
ledger=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
schema=json.loads(pathlib.Path(sys.argv[2]).read_text(encoding='utf-8'))
Draft202012Validator(schema).validate(ledger)
assert ledger['schema']==schema['properties']['schema']['const']
assert ledger['readOnly']['databaseTransaction'] is True
assert ledger['readOnly']['repository'] is True
assert ledger['readOnly']['databaseWrites']==0
assert ledger['readOnly']['liveFileWrites']==0
assert ledger['readOnly']['databaseStatementTimeoutMs']==300000
assert ledger['readOnly']['databaseLockTimeoutMs']==5000
assert ledger['routeTotals']['screenResourcePhysicalRows']==5
assert ledger['routeTotals']['normalizedRouteCount']==5
exact=ledger['exactIdentities']
assert exact['stepScreens']['requiredExactIdentities']==5
assert exact['stepScreens']['directRequiredExactIdentities']==4
assert exact['stepScreens']['activeBindingExactIdentities']==2
assert exact['stepScreens']['authoritativeUnionExactIdentities']==5
assert exact['stepScreens']['directAndActiveOverlapExactIdentities']==1
assert exact['stepScreens']['directOnlyExactIdentities']==3
assert exact['stepScreens']['activeBindingOnlyExactIdentities']==1
assert exact['stepScreens']['multiRouteStepAudienceGroups']==1
assert exact['stepScreens']['multiRouteStepAudienceExactIdentities']==2
assert exact['stepScreens']['multiRouteAdditionalExactIdentities']==1
assert exact['quality']['exactResourceContractBlueprintIdentities']==2
assert exact['quality']['physicalSingleClosureExactIdentities']==2
assert exact['professionalContract']['targetExactIdentities']==5
assert exact['professionalContract']['targetContractMatchedExactIdentities']==4
assert exact['professionalContract']['targetContractMissingExactIdentities']==1
assert exact['professionalContract']['exactRequiredIdentities']==3
assert exact['professionalContract']['missingRequiredIdentities']==1
assert exact['professionalContract']['duplicateRequiredIdentityGroups']==1
assert exact['blueprint']['exactRequiredIdentities']==2
assert exact['blueprint']['missingRequiredIdentities']==2
assert exact['blueprint']['duplicateRequiredIdentityGroups']==1
assert exact['blueprint']['duplicateAuthorityResolved']==1
assert exact['blueprint']['duplicateAmbiguous']==0
assert exact['strategy']['generatedRuntimePhysicalRows']==2
assert exact['strategy']['adoptExistingPhysicalRows']==2
assert exact['strategy']['ownershipGeneratedExactIdentities']==2
assert exact['strategy']['ownershipHybridExactIdentities']==1
assert exact['strategy']['ownershipAmbiguousExactIdentities']==0
assert exact['quality']['ambiguousExactIdentities']==1
assert exact['source']['compilerReadyExactIdentities']==3
assert exact['source']['emittedReadyExactIdentities']==3
assert exact['source']['sourceCatalogEligibleExactIdentities']==3
assert ledger['endpoint']['expectedScreenIdentities']==3
assert ledger['endpoint']['expectedOperationCount']==3
assert ledger['endpoint']['catalog']['endpointCount']==2
assert ledger['designSystem']['commonAssetCoverage']['missingPageCount']==1
assert ledger['designMutationImpact']['authoritativeAffectedExactIdentityCount']==3
assert ledger['designMutationImpact']['pendingDirtySignalCount']==1
assert ledger['frontend']['canonicalKoRouteCount']>0
assert ledger['reviewBudget']['withinTenMinutes'] is True
assert ledger['reviewBudget']['actualMs']<600000
assert all(item['status']=='OK' for item in ledger['probes'].values())
assert 'SECRET_VALUE' not in json.dumps(ledger)
print('PAGE_IMPACT_FIXTURE_COUNTS_OK direct=4 active=2 union=5 compilerReady=3 endpoints=3 multiRouteGroups=1')
PY

python3 "$RUNNER" --repo-root "$ROOT" --dsn "$DSN" \
  --db-label fixture-process-selector --process-code p1 \
  --output "$WORK/process-selector.json"
python3 "$RUNNER" --repo-root "$ROOT" --dsn "$DSN" \
  --db-label fixture-exact-selector --process-code p1 --step-code s1 \
  --audience user --route-path '/ALPHA?ignored=1' \
  --output "$WORK/exact-selector.json"
python3 "$RUNNER" --repo-root "$ROOT" --dsn "$DSN" \
  --db-label fixture-active-only-selector --process-code p1 --step-code s1 \
  --audience user --route-path '/ALPHA-AUX?ignored=1' \
  --output "$WORK/active-only-selector.json"
python3 "$RUNNER" --repo-root "$ROOT" --dsn "$DSN" \
  --db-label fixture-asset-selector --asset-type component --asset-id C1 \
  --output "$WORK/asset-selector.json"
python3 - "$WORK/process-selector.json" "$WORK/exact-selector.json" \
  "$WORK/active-only-selector.json" "$WORK/asset-selector.json" <<'PY'
import json, pathlib, sys
process=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
exact=json.loads(pathlib.Path(sys.argv[2]).read_text(encoding='utf-8'))
active_only=json.loads(pathlib.Path(sys.argv[3]).read_text(encoding='utf-8'))
asset=json.loads(pathlib.Path(sys.argv[4]).read_text(encoding='utf-8'))
assert process['designMutationImpact']['scope']=='PROCESS_AXIS'
assert process['designMutationImpact']['selectorMatchedExactIdentityCount']==4
assert process['designMutationImpact']['authoritativeAffectedExactIdentityCount']==4
assert process['exactIdentities']['stepScreens']['directRequiredExactIdentities']==3
assert process['exactIdentities']['stepScreens']['activeBindingExactIdentities']==2
assert process['exactIdentities']['stepScreens']['authoritativeUnionExactIdentities']==4
assert exact['designMutationImpact']['scope']=='SCREEN_IDENTITY_EXACT'
assert exact['designMutationImpact']['selectorMatchedExactIdentityCount']==1
assert exact['designMutationImpact']['authoritativeAffectedExactIdentityCount']==1
assert exact['exactIdentities']['stepScreens']['directRequiredExactIdentities']==1
assert exact['exactIdentities']['stepScreens']['activeBindingExactIdentities']==1
assert active_only['designMutationImpact']['scope']=='SCREEN_IDENTITY_EXACT'
assert active_only['designMutationImpact']['selectorMatchedExactIdentityCount']==1
assert active_only['designMutationImpact']['authoritativeAffectedExactIdentityCount']==1
assert active_only['exactIdentities']['stepScreens']['directRequiredExactIdentities']==0
assert active_only['exactIdentities']['stepScreens']['activeBindingExactIdentities']==1
assert active_only['exactIdentities']['stepScreens']['activeBindingOnlyExactIdentities']==1
impact=asset['designMutationImpact']
assert impact['scope']=='ASSET_DEPENDENCY_DAG'
assert impact['authoritativeAffectedExactIdentityCount']==3
assert impact['assetFanout']['directAssetFound'] is True
assert impact['assetFanout']['reachableScreenAssetCount']==3
assert impact['assetFanout']['uiPageFanoutCount']==3
assert impact['assetFanout']['affectedNormalizedRouteCount']==3
print('PAGE_IMPACT_SELECTOR_COUNTS_OK process=4 directExact=1 activeOnlyExact=1 componentC1=3')
PY

if [[ -n "${PAGE_IMPACT_EVIDENCE_DIR:-}" ]]; then
  mkdir -p "$PAGE_IMPACT_EVIDENCE_DIR"
  install -m 600 "$WORK/ledger.json" \
    "$PAGE_IMPACT_EVIDENCE_DIR/2026-08-16-fixture.json"
  install -m 600 "$WORK/asset-selector.json" \
    "$PAGE_IMPACT_EVIDENCE_DIR/2026-08-16-fixture-asset-selector.json"
fi

"${PSQL[@]}" >/dev/null <<'SQL'
CREATE OR REPLACE FUNCTION framework_source_canonical_endpoint_readiness(
  integer,varchar
) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF $2='P2' THEN
    RAISE EXCEPTION 'fixture isolated process failure';
  END IF;
  RETURN jsonb_build_object(
    'schema','carbonet.canonical-endpoint-readiness/v1','status','PARTIAL',
    'totalCount',2,'sourceReadyCount',2,'blockerCount',2,
    'reasonCounts',jsonb_build_object('DESIGN_CONTRACT_MISSING',1,
                                      'DESIGN_CONTRACT_DUPLICATE',1)
  );
END
$$;
SQL
python3 "$RUNNER" --repo-root "$ROOT" --dsn "$DSN" \
  --db-label isolated-process-failure --output "$WORK/process-failure.json"
python3 - "$WORK/process-failure.json" <<'PY'
import json, pathlib, sys
ledger=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
assert ledger['probes']['sourceEndpointReadiness']['status']=='ERROR'
isolation=ledger['probes']['sourceEndpointReadinessIsolation']
assert isolation['status']=='OK'
value=isolation['value']
assert value['processCount']==2
assert value['successfulProbeCount']==1
assert value['failedProbeCount']==1
assert value['omittedProcessCount']==0
assert {row['processCode'] for row in value['processes']}=={'P1','P2'}
assert ledger['endpoint']['sourceReadiness']['mode']=='INDEPENDENT_PROCESS_PROBES'
print('PAGE_IMPACT_PROCESS_ISOLATION_OK success=1 failed=1 hidden=0')
PY

"${PSQL[@]}" >/dev/null <<'SQL'
DROP FUNCTION framework_source_canonical_design_catalog(integer,varchar);
DROP FUNCTION framework_source_canonical_endpoint_readiness(integer,varchar);
DROP FUNCTION framework_source_canonical_endpoint_catalog(integer,varchar);
SQL
python3 "$RUNNER" --repo-root "$ROOT" --dsn "$DSN" \
  --db-label old-schema-fixture --output "$WORK/old-schema.json"
python3 - "$WORK/old-schema.json" <<'PY'
import json, pathlib, sys
ledger=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
for name in ('sourceDesignCatalog','sourceEndpointReadiness','sourceEndpointCatalog'):
    assert ledger['probes'][name]['status']=='ERROR', (name,ledger['probes'][name])
codes={item['code'] for item in ledger['blockers']['items']}
assert 'SOURCEDESIGNCATALOG_ERROR' in codes
assert 'SOURCEENDPOINTREADINESS_ERROR' in codes
assert 'SOURCEENDPOINTCATALOG_ERROR' in codes
print('PAGE_IMPACT_OLD_SCHEMA_FAILURE_OK sourceProbeErrors=3')
PY

elapsed_ms=$(( ($(date +%s%N)-started_ns)/1000000 ))
(( elapsed_ms < 600000 )) || fail "elapsedMs=$elapsed_ms exceeds ten-minute budget"
printf 'PAGE_IMPACT_AUDIT_OK cases=7 writes=0 elapsedMs=%s\n' "$elapsed_ms"
