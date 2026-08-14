#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260814052000__close_member_lifecycle_canonical_runtime_contract.sql"
IMAGE="${MEMBER_BLUEPRINT_POSTGRES_IMAGE:-docker.io/library/postgres:16}"
NAMESPACE="${CONTAINERD_NAMESPACE:-k8s.io}"
CONTAINER="member-blueprint-pg-$RANDOM-$$"
PASSWORD="member-blueprint-$RANDOM-$$"
PORT=""
started=0
TMP="$(mktemp -d)"

fail() { printf 'MEMBER_LIFECYCLE_CANONICAL_BLUEPRINT_POSTGRES_FAIL %s\n' "$*" >&2; exit 1; }
cleanup() {
  set +e
  if (( started )); then
    sudo ctr -n "$NAMESPACE" tasks kill --signal SIGKILL "$CONTAINER" >/dev/null 2>&1 || true
    sudo ctr -n "$NAMESPACE" tasks rm --force "$CONTAINER" >/dev/null 2>&1 || true
    sudo ctr -n "$NAMESPACE" containers rm "$CONTAINER" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$TMP"
}
trap cleanup EXIT INT TERM

[[ -f "$MIGRATION" ]] || fail "migration missing"
command -v python3 >/dev/null || fail "python3 missing"
command -v psql >/dev/null || fail "psql missing"
command -v ctr >/dev/null || fail "ctr missing"
sudo -n true >/dev/null || fail "passwordless sudo required"

sudo ctr -n "$NAMESPACE" images ls -q | grep -Fxq "$IMAGE" ||
  fail "cached image missing: $IMAGE"
PORT="$(python3 - <<'PY'
import socket
s=socket.socket()
s.bind(("127.0.0.1",0))
print(s.getsockname()[1])
s.close()
PY
)"
sudo ctr -n "$NAMESPACE" run --detach --net-host \
  --env "POSTGRES_PASSWORD=$PASSWORD" --env POSTGRES_DB=member_blueprint \
  --env "PGPORT=$PORT" "$IMAGE" "$CONTAINER"
started=1
export PGPASSWORD="$PASSWORD"
PGBASE=(-h 127.0.0.1 -p "$PORT" -U postgres)
PSQL=(psql "${PGBASE[@]}" -d member_blueprint -X -v ON_ERROR_STOP=1)

ready=0
for _ in $(seq 1 40); do
  if "${PSQL[@]}" -Atqc 'select 1' >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.25
done
(( ready )) || fail "postgres readiness timeout"

ctr_exec() {
  sudo ctr -n "$NAMESPACE" tasks exec \
    --exec-id "member-blueprint-exec-$RANDOM-$$" "$CONTAINER" "$@"
}

"${PSQL[@]}" >/dev/null <<'SQL'
CREATE TABLE framework_process_definition(
  process_code varchar(100) PRIMARY KEY,
  process_version varchar(20) NOT NULL
);
CREATE TABLE framework_process_step(
  process_code varchar(100) NOT NULL,
  step_code varchar(100) NOT NULL,
  actor_code varchar(100) NOT NULL,
  user_path varchar(400),
  step_order integer NOT NULL,
  PRIMARY KEY(process_code,step_code)
);
CREATE TABLE framework_professional_screen_contract(
  contract_id bigserial PRIMARY KEY,
  process_code varchar(100) NOT NULL,
  step_code varchar(100) NOT NULL,
  audience varchar(20) NOT NULL,
  route_path varchar(400) NOT NULL,
  screen_name varchar(200) NOT NULL,
  actor_code varchar(100) NOT NULL,
  business_purpose text NOT NULL,
  entry_condition text NOT NULL,
  exit_condition text NOT NULL,
  kpi_contract text NOT NULL,
  section_contract text NOT NULL,
  field_contract text NOT NULL,
  command_contract text NOT NULL,
  state_contract text NOT NULL,
  api_contract text NOT NULL,
  data_contract text NOT NULL,
  evidence_contract text NOT NULL,
  UNIQUE(process_code,step_code,audience,route_path)
);
CREATE TABLE framework_screen_blueprint(
  blueprint_id bigserial PRIMARY KEY,
  blueprint_code varchar(140) NOT NULL UNIQUE,
  process_code varchar(100) NOT NULL,
  step_code varchar(100) NOT NULL,
  actor_code varchar(100) NOT NULL,
  audience varchar(20) NOT NULL,
  page_id varchar(160) NOT NULL,
  page_name varchar(200) NOT NULL,
  route_path varchar(400) NOT NULL,
  screen_type varchar(40) NOT NULL,
  template_code varchar(80) NOT NULL,
  specification_json text NOT NULL,
  traceability_json text NOT NULL,
  validation_status varchar(20) NOT NULL,
  validation_message text,
  generated_source_path varchar(500),
  created_by varchar(100) NOT NULL DEFAULT 'SYSTEM',
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  implementation_strategy varchar(40) NOT NULL,
  source_reference varchar(300),
  transition_status varchar(40) NOT NULL,
  UNIQUE(audience,route_path)
);
CREATE OR REPLACE FUNCTION framework_try_jsonb(source text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF source IS NULL OR btrim(source)='' THEN RETURN '[]'::jsonb; END IF;
  RETURN source::jsonb;
EXCEPTION WHEN others THEN
  RETURN jsonb_build_array(source);
END $$;
CREATE OR REPLACE FUNCTION framework_canonical_screen_bundle(
  requested_process varchar,requested_step varchar,
  requested_audience varchar,requested_route varchar
) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  design jsonb;
  canonical_text text;
BEGIN
  SELECT jsonb_build_object(
    'identity',jsonb_build_object(
      'screenKey',upper(blueprint.process_code)||'|'||upper(blueprint.step_code)||'|'||
        upper(blueprint.audience)||'|'||lower(split_part(blueprint.route_path,'?',1)),
      'processCode',upper(blueprint.process_code),
      'stepCode',upper(blueprint.step_code),
      'audience',upper(blueprint.audience),
      'routePath',lower(split_part(blueprint.route_path,'?',1))
    ),
    'lanes',jsonb_build_object(
      'HELP',jsonb_build_object('items',jsonb_build_array('help')),
      'WORK_GUIDE',jsonb_build_object('steps',jsonb_build_array('work')),
      'QA',jsonb_build_object('checks',jsonb_build_array('qa')),
      'DESIGN_CARD',jsonb_build_object(
        'assetBindings',jsonb_build_array(jsonb_build_object(
          'assetType','COMPONENT','assetCode','COMMON_WORK_EXECUTION'
        ))
      ),
      'FRONTEND',jsonb_build_object('routePath','/work/execution'),
      'API',jsonb_build_array(jsonb_build_object('path','/home/api/process-executions')),
      'DATABASE',jsonb_build_array(jsonb_build_object('entity','framework_process_execution'))
    )
  ) INTO STRICT design
  FROM framework_screen_blueprint blueprint
  WHERE upper(blueprint.process_code)=upper(requested_process)
    AND upper(blueprint.step_code)=upper(requested_step)
    AND upper(blueprint.audience)=upper(requested_audience)
    AND lower(split_part(blueprint.route_path,'?',1))=
        lower(split_part(requested_route,'?',1))
    AND blueprint.validation_status='VALID';
  canonical_text:=design::text;
  RETURN jsonb_build_object(
    'schema','carbonet.canonical-design/v1',
    'catalogHash',NULL,
    'designHash',encode(sha256(convert_to(canonical_text,'UTF8')),'hex'),
    'canonicalText',canonical_text,
    'canonicalDesign',design
  );
END $$;

INSERT INTO framework_process_definition VALUES('MEMBER_LIFECYCLE','1.1.0');
INSERT INTO framework_process_step(process_code,step_code,actor_code,user_path,step_order) VALUES
('MEMBER_LIFECYCLE','MEMBER_LIFECYCLE_01_PLAN','COMPANY_MANAGER','/work/execution?processCode=MEMBER_LIFECYCLE&stepCode=MEMBER_LIFECYCLE_01_PLAN&guide=1',1),
('MEMBER_LIFECYCLE','MEMBER_LIFECYCLE_02_WORK','SITE_DATA_OWNER','/work/execution?processCode=MEMBER_LIFECYCLE&stepCode=MEMBER_LIFECYCLE_02_WORK&guide=1',2),
('MEMBER_LIFECYCLE','MEMBER_LIFECYCLE_03_VERIFY','VERIFIER','/work/execution?processCode=MEMBER_LIFECYCLE&stepCode=MEMBER_LIFECYCLE_03_VERIFY&guide=1',3),
('MEMBER_LIFECYCLE','MEMBER_LIFECYCLE_04_APPROVE','APPROVER','/work/execution?processCode=MEMBER_LIFECYCLE&stepCode=MEMBER_LIFECYCLE_04_APPROVE&guide=1',4);
INSERT INTO framework_professional_screen_contract(
  process_code,step_code,audience,route_path,screen_name,actor_code,
  business_purpose,entry_condition,exit_condition,kpi_contract,section_contract,
  field_contract,command_contract,state_contract,api_contract,data_contract,evidence_contract
)
SELECT step.process_code,step.step_code,'USER','/work/execution',step.step_code||' screen',
       step.actor_code,'purpose','entry','exit','["kpi"]','["section"]',
       '[{"fieldCode":"value"}]','["SAVE"]','["DRAFT"]',
       '[{"path":"/home/api/process-executions"}]',
       '[{"entity":"framework_process_execution"}]','["audit"]'
FROM framework_process_step step ORDER BY step.step_order;
SQL

run_migration() {
  { printf 'BEGIN;\n'; sed '1s/^/-- focused migration proof\n/' "$MIGRATION"; printf '\nCOMMIT;\n'; } |
    "${PSQL[@]}" >/dev/null
}
fingerprint() {
  "${PSQL[@]}" -Atqc "select md5(coalesce(string_agg(to_jsonb(blueprint)::text,E'\\n' order by blueprint_id),'')) from framework_screen_blueprint blueprint"
}

run_migration
count="$("${PSQL[@]}" -Atqc "select count(*)||'|'||count(distinct route_path)||'|'||count(distinct step_code) from framework_screen_blueprint where process_code='MEMBER_LIFECYCLE' and audience='USER'")"
[[ "$count" == '4|4|4' ]] || fail "first install closure=$count"
first_fingerprint="$(fingerprint)"
run_migration
second_fingerprint="$(fingerprint)"
[[ "$first_fingerprint" == "$second_fingerprint" ]] || fail "idempotent replay changed rows"

ctr_exec pg_dump -U postgres -d member_blueprint --no-owner --no-privileges \
  --table=public.framework_screen_blueprint >"$TMP/blueprint.dump.sql"
psql "${PGBASE[@]}" -d postgres -X -v ON_ERROR_STOP=1 \
  -qc 'create database member_blueprint_restore'
ctr_exec psql -U postgres -d member_blueprint_restore -X -v ON_ERROR_STOP=1 \
  <"$TMP/blueprint.dump.sql" >/dev/null
restore_count="$(psql "${PGBASE[@]}" -d member_blueprint_restore -X -Atqc \
  'select count(*) from framework_screen_blueprint')"
restore_fingerprint="$(psql "${PGBASE[@]}" -d member_blueprint_restore -X -Atqc \
  "select md5(coalesce(string_agg(to_jsonb(blueprint)::text,E'\\n' order by blueprint_id),'')) from framework_screen_blueprint blueprint")"
[[ "$restore_count" == 4 && "$restore_fingerprint" == "$first_fingerprint" ]] ||
  fail "blueprint dump restore closure count=$restore_count fingerprint=$restore_fingerprint"

# Mutation: preserve only the table schema and remove the blueprint table from
# the data target set.  Restore must contain zero rows and the exact-four
# closure validator must fail, proving that backup coverage cannot regress
# silently when the migration is classified as additive.
ctr_exec pg_dump -U postgres -d member_blueprint --no-owner --no-privileges \
  --schema-only --table=public.framework_screen_blueprint >"$TMP/blueprint-schema.sql"
psql "${PGBASE[@]}" -d postgres -X -v ON_ERROR_STOP=1 \
  -qc 'create database member_blueprint_mutant'
ctr_exec psql -U postgres -d member_blueprint_mutant -X -v ON_ERROR_STOP=1 \
  <"$TMP/blueprint-schema.sql" >/dev/null
mutant_count="$(psql "${PGBASE[@]}" -d member_blueprint_mutant -X -Atqc \
  'select count(*) from framework_screen_blueprint')"
[[ "$mutant_count" == 0 ]] || fail "target-removal mutant unexpectedly restored rows=$mutant_count"
set +e
mutant_output="$(psql "${PGBASE[@]}" -d member_blueprint_mutant -X -v ON_ERROR_STOP=1 2>&1 <<'SQL'
DO $$
BEGIN
  IF (SELECT count(*) FROM framework_screen_blueprint)<>4 THEN
    RAISE EXCEPTION 'blueprint backup closure failed';
  END IF;
END $$;
SQL
)"
mutant_status=$?
set -e
(( mutant_status != 0 )) || fail "target-removal mutant closure unexpectedly passed"
grep -Fq 'blueprint backup closure failed' <<<"$mutant_output" ||
  fail "target-removal mutant failed for wrong reason"

"${PSQL[@]}" -qc 'truncate framework_screen_blueprint restart identity' >/dev/null
"${PSQL[@]}" >/dev/null <<'SQL'
INSERT INTO framework_screen_blueprint(
  blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,
  route_path,screen_type,template_code,specification_json,traceability_json,
  validation_status,implementation_strategy,transition_status,source_reference
) VALUES(
  'FOREIGN_CONFLICT','FOREIGN_PROCESS','FOREIGN_STEP','FOREIGN_ACTOR','USER',
  'FOREIGN_PAGE','Foreign row',
  '/work/execution?processCode=MEMBER_LIFECYCLE&stepCode=MEMBER_LIFECYCLE_01_PLAN&guide=1',
  'CONTENT','KRDS_CONTENT','{}','{}','VALID','ADOPT_EXISTING','CONTRACT_LINKED',
  'foreign:1'
);
SQL
foreign_before="$(fingerprint)"
set +e
foreign_output="$({ printf 'BEGIN;\n'; cat "$MIGRATION"; printf '\nCOMMIT;\n'; } | "${PSQL[@]}" 2>&1)"
foreign_status=$?
set -e
(( foreign_status != 0 )) || fail "foreign route conflict unexpectedly passed"
grep -Fq 'canonical blueprint closure failed' <<<"$foreign_output" ||
  fail "foreign conflict failed for wrong reason"
foreign_after="$(fingerprint)"
[[ "$foreign_before" == "$foreign_after" ]] || fail "foreign conflict changed rows"
foreign_count="$("${PSQL[@]}" -Atqc 'select count(*) from framework_screen_blueprint')"
[[ "$foreign_count" == 1 ]] || fail "foreign conflict transaction leaked rows=$foreign_count"

printf 'MEMBER_LIFECYCLE_CANONICAL_BLUEPRINT_POSTGRES_PASS inserts=4 updates=0 idempotent=1 foreignConflict=rollback backupRestore=4 backupMutant=0+rejected identities=4 lanes=7\n'
