#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
migration="$root/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260817210500__align_emission_workflow_entry_predecessor_health.sql"
image="${EMISSION_WORKFLOW_POSTGRES_IMAGE:-docker.io/library/postgres:16}"
namespace="${CONTAINERD_NAMESPACE:-k8s.io}"
container_id="emission-workflow-health-$RANDOM-$$"
password="emission-health-$RANDOM-$$"
port=""
test_hold_after_run="${EMISSION_WORKFLOW_TEST_HOLD_AFTER_RUN_SECONDS:-0}"

fail() { printf 'EMISSION_WORKFLOW_HEALTH_POSTGRES_FAIL %s\n' "$*" >&2; exit 1; }
cleanup() {
  set +e
  sudo ctr -n "$namespace" tasks kill --signal SIGKILL "$container_id" >/dev/null 2>&1 || true
  sudo ctr -n "$namespace" tasks rm --force "$container_id" >/dev/null 2>&1 || true
  sudo ctr -n "$namespace" containers rm "$container_id" >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

[[ -f "$migration" ]] || fail "migration missing"
command -v psql >/dev/null || fail "psql missing"
command -v python3 >/dev/null || fail "python3 missing"
sudo -n true >/dev/null || fail "passwordless sudo required"
sudo ctr -n "$namespace" images ls -q | grep -Fxq "$image" || fail "cached image missing: $image"
[[ "$test_hold_after_run" =~ ^[0-9]+$ && "$test_hold_after_run" -le 30 ]] || fail "invalid test hold"
port="$(python3 - <<'PY'
import socket
s=socket.socket()
s.bind(('127.0.0.1',0))
print(s.getsockname()[1])
s.close()
PY
)"
sudo ctr -n "$namespace" run --detach --net-host \
  --env "POSTGRES_PASSWORD=$password" \
  --env POSTGRES_DB=emission_workflow_health_test \
  --env "PGPORT=$port" \
  "$image" "$container_id"
if (( test_hold_after_run > 0 )); then
  hold_deadline=$((SECONDS + test_hold_after_run))
  while (( SECONDS < hold_deadline )); do
    sleep 0.1
  done
fi
export PGPASSWORD="$password"
psql_cmd=(psql -h 127.0.0.1 -p "$port" -U postgres -d emission_workflow_health_test -X -v ON_ERROR_STOP=1)
ready=0
for _ in $(seq 1 40); do
  if "${psql_cmd[@]}" -Atqc 'select 1' >/dev/null 2>&1; then
    sleep 1
    if "${psql_cmd[@]}" -Atqc 'select 1' >/dev/null 2>&1; then
      ready=1
      break
    fi
  fi
  sleep 1
done
(( ready )) || fail "PostgreSQL readiness timeout"

"${psql_cmd[@]}" >/dev/null <<'SQL'
CREATE TABLE emission_project_registry(
  project_id varchar(40) PRIMARY KEY,
  tenant_id varchar(40) NOT NULL,
  project_name text NOT NULL,
  due_date date NOT NULL
);
CREATE TABLE emission_project_task(
  task_id bigserial PRIMARY KEY,
  project_id varchar(40) NOT NULL REFERENCES emission_project_registry(project_id),
  task_code varchar(80) NOT NULL,
  actor_code varchar(80),
  target_url text,
  completion_rule text,
  predecessor_codes text,
  due_date date,
  process_code varchar(80),
  process_step_code varchar(80),
  UNIQUE(project_id,task_code)
);
CREATE TABLE framework_project_actor_assignment(
  project_id varchar(40) NOT NULL,
  actor_code varchar(80) NOT NULL,
  active_yn char(1) NOT NULL
);
CREATE TABLE framework_process_step(
  process_code varchar(80) NOT NULL,
  step_code varchar(80) NOT NULL,
  step_order integer NOT NULL,
  PRIMARY KEY(process_code,step_code)
);
CREATE TABLE framework_business_process_sequence(
  process_code varchar(80) PRIMARY KEY,
  process_role varchar(40) NOT NULL,
  prerequisite_process_codes text,
  sequence_status varchar(24) NOT NULL
);

INSERT INTO framework_process_step VALUES
 ('EMISSION_PROJECT_PORTFOLIO','EMISSION_PROJECT_PORTFOLIO_LIST',1),
 ('ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S1',1),
 ('ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S2',2),
 ('ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S3',3),
 ('ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S4',4);
INSERT INTO framework_business_process_sequence VALUES
 ('EMISSION_PROJECT_PORTFOLIO','ENTRY','','ACTIVE'),
 ('ORGANIZATIONAL_BOUNDARY','CORE','EMISSION_PROJECT_PORTFOLIO','ACTIVE');

INSERT INTO emission_project_registry
SELECT 'PRJ-'||lpad(project_no::text,3,'0'),'TENANT-A','Project '||project_no,current_date+30
FROM generate_series(1,35) project_no;

INSERT INTO framework_project_actor_assignment
SELECT project.project_id,actor.actor_code,'Y'
FROM emission_project_registry project
CROSS JOIN (VALUES('COMPANY_MANAGER'),('SITE_DATA_OWNER'),('CALCULATOR'),('VERIFIER'),('APPROVER')) actor(actor_code);

WITH core(task_code,predecessor_codes,process_code,process_step_code) AS (VALUES
 ('BASIC_INFO','','EMISSION_PROJECT','EMISSION_PROJECT_SETUP'),
 ('ACTIVITY_DATA','BASIC_INFO','EMISSION_PROJECT','EMISSION_PROJECT_COLLECT'),
 ('CALCULATION','ACTIVITY_DATA','EMISSION_PROJECT','EMISSION_PROJECT_CALCULATE'),
 ('VERIFICATION','CALCULATION','EMISSION_PROJECT','EMISSION_PROJECT_VALIDATE'),
 ('APPROVAL','VERIFICATION','EMISSION_PROJECT','EMISSION_PROJECT_APPROVE'),
 ('REPORT','APPROVAL','EMISSION_PROJECT','EMISSION_PROJECT_REPORT'),
 ('REGULATORY_SUBMISSION','REPORT','REGULATORY_SUBMISSION','REGULATORY_SUBMISSION_S1'),
 ('AUTO_b2b3d18c9dec387a56098e24','','EMISSION_PROJECT_PORTFOLIO','EMISSION_PROJECT_PORTFOLIO_LIST'),
 ('AUTO_ORG_1','BASIC_INFO','ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S1'),
 ('AUTO_ORG_2','AUTO_ORG_1','ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S2'),
 ('AUTO_ORG_3','AUTO_ORG_2','ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S3'),
 ('AUTO_ORG_4','AUTO_ORG_3','ORGANIZATIONAL_BOUNDARY','ORGANIZATIONAL_BOUNDARY_S4')
)
INSERT INTO emission_project_task(
 project_id,task_code,actor_code,target_url,completion_rule,predecessor_codes,due_date,
 process_code,process_step_code)
SELECT project.project_id,core.task_code,'COMPANY_MANAGER','/work/'||lower(core.task_code),
       'fixture completion rule',core.predecessor_codes,project.due_date,
       core.process_code,core.process_step_code
FROM emission_project_registry project CROSS JOIN core;

-- A registry row with no task must remain unhealthy without fabricating a
-- missing-predecessor row from the outer join.
INSERT INTO emission_project_registry
VALUES('PRJ-ZERO','TENANT-A','Zero Task Project',current_date+30);
SQL

"${psql_cmd[@]}" -f "$migration" >/dev/null

summary="$("${psql_cmd[@]}" -AtF '|' -c "select count(*),count(*) filter(where workflow_health='READY'),count(*) filter(where workflow_health<>'READY'),min(task_count),max(task_count),max(missing_predecessor_count) from emission_project_workflow_health where project_id<>'PRJ-ZERO'")"
[[ "$summary" == '35|35|0|12|12|0' ]] || fail "live-shape mismatch: $summary"
zero_summary="$("${psql_cmd[@]}" -AtF '|' -c "select task_count,missing_predecessor_count,workflow_health from emission_project_workflow_health where project_id='PRJ-ZERO'")"
[[ "$zero_summary" == '0|0|REPAIR_REQUIRED' ]] || fail "zero-task outer join mismatch: $zero_summary"

assert_repair() {
  local expected="$1" observed
  observed="$("${psql_cmd[@]}" -AtF '|' -c "select workflow_health,missing_predecessor_count from emission_project_workflow_health where project_id='PRJ-001'")"
  [[ "$observed" == "REPAIR_REQUIRED|$expected" ]] || fail "mutant escaped: $observed"
}

"${psql_cmd[@]}" -c "update framework_business_process_sequence set process_role='CORE' where process_code='EMISSION_PROJECT_PORTFOLIO'" >/dev/null
assert_repair 1
"${psql_cmd[@]}" -c "update framework_business_process_sequence set process_role='ENTRY' where process_code='EMISSION_PROJECT_PORTFOLIO'" >/dev/null

"${psql_cmd[@]}" -c "update framework_business_process_sequence set prerequisite_process_codes='EMISSION_PROJECT' where process_code='EMISSION_PROJECT_PORTFOLIO'" >/dev/null
assert_repair 1
"${psql_cmd[@]}" -c "update framework_business_process_sequence set prerequisite_process_codes='' where process_code='EMISSION_PROJECT_PORTFOLIO'" >/dev/null

"${psql_cmd[@]}" >/dev/null <<'SQL'
INSERT INTO framework_process_step VALUES('EMISSION_PROJECT_PORTFOLIO','EMISSION_PROJECT_PORTFOLIO_SECOND',2);
INSERT INTO emission_project_task(project_id,task_code,actor_code,target_url,completion_rule,predecessor_codes,due_date,process_code,process_step_code)
SELECT 'PRJ-001','AUTO_PORTFOLIO_SECOND','COMPANY_MANAGER','/work/second','fixture completion rule','',due_date,
       'EMISSION_PROJECT_PORTFOLIO','EMISSION_PROJECT_PORTFOLIO_SECOND'
FROM emission_project_registry WHERE project_id='PRJ-001';
SQL
assert_repair 1
"${psql_cmd[@]}" -c "delete from emission_project_task where project_id='PRJ-001' and task_code='AUTO_PORTFOLIO_SECOND'; delete from framework_process_step where process_code='EMISSION_PROJECT_PORTFOLIO' and step_code='EMISSION_PROJECT_PORTFOLIO_SECOND'" >/dev/null

"${psql_cmd[@]}" -c "update emission_project_task set predecessor_codes='' where project_id='PRJ-001' and task_code='AUTO_ORG_1'" >/dev/null
assert_repair 1
"${psql_cmd[@]}" -c "update emission_project_task set predecessor_codes='BASIC_INFO' where project_id='PRJ-001' and task_code='AUTO_ORG_1'" >/dev/null

"${psql_cmd[@]}" -c "update emission_project_task set predecessor_codes='DOES_NOT_EXIST' where project_id='PRJ-001' and task_code='CALCULATION'" >/dev/null
assert_repair 1
"${psql_cmd[@]}" -c "update emission_project_task set predecessor_codes='ACTIVITY_DATA' where project_id='PRJ-001' and task_code='CALCULATION'" >/dev/null

final_summary="$("${psql_cmd[@]}" -AtF '|' -c "select count(*) filter(where workflow_health='READY'),count(*) filter(where workflow_health<>'READY'),max(missing_predecessor_count) from emission_project_workflow_health where project_id<>'PRJ-ZERO'")"
[[ "$final_summary" == '35|0|0' ]] || fail "fixture did not restore: $final_summary"

printf 'EMISSION_WORKFLOW_HEALTH_POSTGRES_PASS projects=35 tasksPerProject=12 entryRoot=READY zeroTask=REPAIR_REQUIRED+missingPredecessor0 illegalRole=REPAIR_REQUIRED prerequisiteRoot=REPAIR_REQUIRED nonFirstRoot=REPAIR_REQUIRED blank=REPAIR_REQUIRED dangling=REPAIR_REQUIRED\n'
