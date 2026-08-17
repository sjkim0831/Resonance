#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260816133000__create_global_common_design_source_state.sql"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
DB_NAME="common_design_source_${RANDOM}_$$"
WORK="$(mktemp -d)"
START_NS="$(date +%s%N)"
PG_MODE=""
PG_CONTAINER=""

fail() { printf 'COMMON_DESIGN_SOURCE_POSTGRES_FAIL %s\n' "$*" >&2; exit 1; }
assert_eq() {
  local expected="$1" actual="$2" label="$3"
  [[ "$actual" == "$expected" ]] || fail "$label expected=$expected actual=$actual"
}
[[ -f "$MIGRATION" ]] || fail "missing migration $MIGRATION"
cleanup() {
  set +e
  if [[ "$PG_MODE" == host ]]; then
    "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate -w stop >/dev/null 2>&1
  elif [[ -n "$PG_CONTAINER" ]]; then
    docker rm -f "$PG_CONTAINER" >/dev/null 2>&1
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT INT TERM

if [[ -x "$PG_BIN/initdb" && -x "$PG_BIN/pg_ctl" \
   && -x "$PG_BIN/createdb" && -x "$PG_BIN/psql" ]]; then
  PG_MODE=host
  PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()
PY
)"
  mkdir -p "$WORK/socket"
  "$PG_BIN/initdb" -D "$WORK/data" -A trust -U postgres --no-locale >/dev/null
  "$PG_BIN/pg_ctl" -D "$WORK/data" -l "$WORK/postgres.log" \
    -o "-F -p $PORT -k $WORK/socket" -w start >/dev/null
  "$PG_BIN/createdb" -h "$WORK/socket" -p "$PORT" -U postgres "$DB_NAME"
  PSQL=("$PG_BIN/psql" -h "$WORK/socket" -p "$PORT" -U postgres \
    -X -v ON_ERROR_STOP=1 -d "$DB_NAME")
else
  command -v docker >/dev/null 2>&1 || fail "PostgreSQL binaries and docker are unavailable"
  PG_MODE=docker
  PG_CONTAINER="common-design-source-pg-${RANDOM}-$$"
  docker run -d --rm --name "$PG_CONTAINER" \
    --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=768m \
    -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB="$DB_NAME" \
    "${POSTGRES_TEST_IMAGE:-postgres:16-alpine}" >/dev/null
  ready=false
  for _ in $(seq 1 60); do
    if docker exec "$PG_CONTAINER" pg_isready -U postgres -d "$DB_NAME" >/dev/null 2>&1; then
      ready=true
      break
    fi
    sleep 0.25
  done
  [[ "$ready" == true ]] || fail "docker PostgreSQL did not become ready"
fi

db() {
  if [[ "$PG_MODE" == host ]]; then
    "${PSQL[@]}" "$@"
  else
    docker exec -i "$PG_CONTAINER" psql -U postgres -X \
      -v ON_ERROR_STOP=1 -d "$DB_NAME" "$@"
  fi
}
scalar() { db -Atqc "$1"; }

db >/dev/null <<'SQL'
CREATE EXTENSION pgcrypto;
CREATE FUNCTION framework_try_jsonb(value text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN RETURN value::jsonb; EXCEPTION WHEN others THEN RETURN NULL; END $$;

CREATE TABLE comtnthemedefinition(
  theme_id text PRIMARY KEY,theme_nm text,theme_dc text,theme_type text,
  color_config jsonb,typography_config jsonb,spacing_config jsonb,
  border_config jsonb,shadow_config jsonb,class_prefix text,
  is_default char(1),use_at char(1),is_active char(1));
CREATE TABLE ui_section_registry(
  section_id text PRIMARY KEY,section_name text NOT NULL,section_type text NOT NULL,
  layout_contract text NOT NULL,responsive_contract text NOT NULL,
  accessibility_contract text NOT NULL,design_reference text,
  asset_fingerprint text,active_yn char(1) NOT NULL DEFAULT 'Y',
  updated_at timestamp DEFAULT current_timestamp);
CREATE UNIQUE INDEX uq_ui_section_common_structure
  ON ui_section_registry(section_type,layout_contract,responsive_contract,
     accessibility_contract,design_reference) WHERE active_yn='Y';
CREATE TABLE ui_component_registry(
  component_id text PRIMARY KEY,component_name text NOT NULL,
  component_type text NOT NULL,owner_domain text NOT NULL,
  props_schema_json jsonb NOT NULL DEFAULT '{}'::jsonb,design_reference text,
  default_props jsonb NOT NULL DEFAULT '{}'::jsonb,category text,
  asset_fingerprint text,active_yn char(1) NOT NULL DEFAULT 'Y',
  updated_at timestamp DEFAULT current_timestamp);
CREATE TABLE ui_page_manifest(
  page_id text PRIMARY KEY,page_name text NOT NULL,route_path text NOT NULL,
  layout_version text,design_token_version text,component_schema text,
  version_id text,active_yn char(1) NOT NULL DEFAULT 'Y',
  updated_at timestamp DEFAULT current_timestamp);
CREATE TABLE ui_page_component_map(
  map_id text PRIMARY KEY,page_id text NOT NULL,layout_zone text NOT NULL,
  component_id text NOT NULL,instance_key text,display_order integer NOT NULL,
  conditional_rule_summary text,instance_props text,
  created_at timestamp DEFAULT current_timestamp,
  updated_at timestamp DEFAULT current_timestamp);

INSERT INTO comtnthemedefinition VALUES
 ('KRDS_CURRENT','KRDS current','Current KRDS','SYSTEM','{}','{}','{}','{}','{}',
  'krds-','N','Y','Y'),
 ('KRDS_GOV_DEFAULT','KRDS default','Default KRDS','SYSTEM','{}','{}','{}','{}','{}',
  'krds-','Y','Y','Y');
INSERT INTO ui_component_registry(
  component_id,component_name,component_type,owner_domain,props_schema_json,
  design_reference,default_props,category,active_yn)
VALUES
 ('COMMON_FIELD','Common field','JSON_FORM','COMMON','{}','KRDS_CURRENT','{}','COMMON','Y'),
 ('COMMON_ACTION','Common action','ACTION','COMMON','{}','KRDS_CURRENT','{}','COMMON','Y');

-- This arbitrary pre-existing ID proves that structural conflict handling must
-- resolve the actual registry identity instead of merely ignoring the insert.
INSERT INTO ui_section_registry(
  section_id,section_name,section_type,layout_contract,responsive_contract,
  accessibility_contract,design_reference,active_yn)
VALUES('EXISTING_CONTENT_SECTION','Existing canonical content','MIGRATED_ZONE',
  'content','PRESERVE_RUNTIME_ORDER','MIGRATED_RUNTIME_ZONE',
  'KRDS_GOV_DEFAULT','Y');

-- 857 mirrors the live manifest cardinality: 275 kebab-case theme aliases,
-- 542 v1 layouts, 315 dotted layouts and 274 pages without component maps.
INSERT INTO ui_page_manifest(
  page_id,page_name,route_path,layout_version,design_token_version,
  component_schema,version_id,active_yn)
SELECT 'LEGACY_'||lpad(value::text,4,'0'),'Legacy '||value,
       CASE WHEN value<=266 THEN '' ELSE '/legacy/'||value END,
       CASE WHEN value<=542 THEN 'v1' ELSE '1.0.0' END,
       CASE WHEN value<=275 THEN 'krds-current' ELSE 'KRDS_GOV_DEFAULT' END,
       '{}',NULL,'Y'
  FROM generate_series(1,857) value;
INSERT INTO ui_page_manifest(
  page_id,page_name,route_path,layout_version,design_token_version,
  component_schema,version_id,active_yn)
VALUES('VALID_LAYOUT_LEGACY','Valid legacy layout','/valid-layout',
  'KRDS_LEGACY_LAYOUT','KRDS_GOV_DEFAULT','{}',NULL,'Y');

-- 583 mapped pages plus collision mutants: 123 duplicate display orders,
-- 22 duplicate effective instance keys and 40 zones sharing the same minimum.
INSERT INTO ui_page_component_map(
  map_id,page_id,layout_zone,component_id,instance_key,display_order,
  conditional_rule_summary,instance_props)
SELECT 'MAP_A_'||lpad(value::text,4,'0'),'LEGACY_'||lpad(value::text,4,'0'),
       'content','COMMON_FIELD',CASE WHEN value<=22 THEN 'shared-instance'
         ELSE 'field-'||value END,0,'always','{"source":"primary"}'
  FROM generate_series(1,583) value;
INSERT INTO ui_page_component_map(
  map_id,page_id,layout_zone,component_id,instance_key,display_order,
  conditional_rule_summary,instance_props)
SELECT 'MAP_B_'||lpad(value::text,4,'0'),'LEGACY_'||lpad(value::text,4,'0'),
       CASE WHEN value<=40 THEN 'actions' ELSE 'content' END,'COMMON_ACTION',
       CASE WHEN value<=22 THEN 'shared-instance' ELSE 'action-'||value END,
       0,' always ','{"source":"collision"}'
  FROM generate_series(1,123) value;
SQL

db < "$MIGRATION" >/dev/null

assert_eq 858 "$(scalar "select count(*) from framework_common_design_asset_source_state where asset_type='SCREEN'")" screen_heads
assert_eq 858 "$(scalar "select count(*) from ui_page_manifest where framework_common_design_screen_composition_exact(framework_try_jsonb(component_schema))")" exact_manifests
assert_eq 0 "$(scalar "select count(*) from ui_page_manifest where page_id like 'LEGACY_%' and layout_version<>'KRDS_WORKSPACE'")" canonical_live_layouts
assert_eq KRDS_LEGACY_LAYOUT "$(scalar "select layout_version from ui_page_manifest where page_id='VALID_LAYOUT_LEGACY'")" valid_layout_preserved
assert_eq 0 "$(scalar "select count(*) from ui_page_manifest where design_token_version not in('KRDS_CURRENT','KRDS_GOV_DEFAULT')")" canonical_themes
assert_eq 275 "$(scalar "select count(*) from ui_page_manifest where design_token_version='KRDS_CURRENT'")" aliased_theme_resolution
assert_eq 542 "$(scalar "select count(*) from ui_page_manifest where version_id='v1'")" v1_versions_preserved
assert_eq 315 "$(scalar "select count(*) from ui_page_manifest where version_id='1.0.0'")" dotted_versions_preserved
assert_eq KRDS_LEGACY_LAYOUT "$(scalar "select version_id from ui_page_manifest where page_id='VALID_LAYOUT_LEGACY'")" valid_layout_version_preserved
assert_eq 3 "$(scalar "select count(*) from ui_section_registry where section_type='MIGRATED_ZONE' and active_yn='Y'")" shared_structural_sections
assert_eq 0 "$(scalar "select count(*) from (select 1 from ui_section_registry where active_yn='Y' group by section_type,layout_contract,responsive_contract,accessibility_contract,design_reference having count(*)<>1) duplicate")" structural_duplicates
assert_eq 0 "$(scalar "select count(*) from (select page_id,display_order from ui_page_component_map group by page_id,display_order having count(*)>1) duplicate")" duplicate_component_orders
assert_eq 0 "$(scalar "select count(*) from (select page_id,instance_key from ui_page_component_map group by page_id,instance_key having count(*)>1) duplicate")" duplicate_instance_keys
assert_eq 0 "$(scalar "select count(*) from ui_page_manifest page join framework_common_design_asset_source_state source on source.asset_type='SCREEN' and source.asset_id=page.page_id where framework_try_jsonb(page.component_schema) is distinct from jsonb_build_object('schema','carbonet.screen-composition/v1','layout',source.canonical_asset#>>'{payload,layout}','theme',source.canonical_asset#>>'{payload,theme}','sections',source.canonical_asset#>'{payload,sections}','components',source.canonical_asset#>'{payload,components}')")" source_manifest_parity
assert_eq 0 "$(scalar "select count(*) from framework_common_design_asset_source_state source cross join lateral jsonb_array_elements(source.canonical_asset#>'{payload,sections}') item left join ui_section_registry section_asset on section_asset.section_id=item->>'sectionId' where source.asset_type='SCREEN' and section_asset.section_id is null")" missing_section_references
assert_eq 308 "$(scalar "select count(*) from framework_common_design_asset_source_state source where source.asset_type='SCREEN' and source.canonical_asset#>>'{payload,theme}'='KRDS_GOV_DEFAULT' and source.canonical_asset#>>'{payload,sections,0,sectionId}'='EXISTING_CONTENT_SECTION'")" preexisting_structural_identity_reused
assert_eq 274 "$(scalar "select count(*) from framework_common_design_asset_source_state source where source.asset_type='SCREEN' and source.asset_id like 'LEGACY_%' and jsonb_array_length(source.canonical_asset#>'{payload,components}')=0")" zero_map_pages_preserved

# A direct second apply proves the migration's conflict handling and temporary
# compiler lifecycle are deterministic even outside Flyway's version ledger.
db < "$MIGRATION" >/dev/null
assert_eq 858 "$(scalar "select count(*) from framework_common_design_asset_source_state where asset_type='SCREEN'")" idempotent_screen_heads
assert_eq 858 "$(scalar "select count(*) from ui_page_manifest where framework_common_design_screen_composition_exact(framework_try_jsonb(component_schema))")" idempotent_exact_manifests
assert_eq 0 "$(scalar "select count(*) from (select page_id,display_order from ui_page_component_map group by page_id,display_order having count(*)>1) duplicate")" idempotent_component_orders

ELAPSED_MS="$((($(date +%s%N)-START_NS)/1000000))"
printf 'COMMON_DESIGN_SOURCE_POSTGRES_PASS livePages=857 validLayoutPages=1 aliases=275 zeroMaps=274 sections=3 reruns=2 elapsedMs=%s\n' "$ELAPSED_MS"
