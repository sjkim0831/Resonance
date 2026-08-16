#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

IMAGE="${PROJECT_LIFECYCLE_POSTGRES_IMAGE:-docker.io/library/postgres:16}"
NAMESPACE="${CONTAINERD_NAMESPACE:-k8s.io}"
CONTAINER_ID="codex-project-lifecycle-$RANDOM-$$"
PASSWORD="project-lifecycle-$RANDOM"
RACE_DIR="$(mktemp -d)"
PORT=""
started=0

fail() {
  printf 'PROJECT_LIFECYCLE_PUBLICATION_FENCE_FAIL %s\n' "$*" >&2
  exit 1
}
cleanup() {
  set +e
  if (( started )); then
    sudo ctr -n "$NAMESPACE" tasks kill --signal SIGKILL "$CONTAINER_ID" >/dev/null 2>&1 || true
    sudo ctr -n "$NAMESPACE" tasks rm --force "$CONTAINER_ID" >/dev/null 2>&1 || true
    sudo ctr -n "$NAMESPACE" containers rm "$CONTAINER_ID" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$RACE_DIR"
}
trap cleanup EXIT INT TERM

command -v psql >/dev/null || fail 'psql missing'
command -v python3 >/dev/null || fail 'python3 missing'
sudo -n true >/dev/null || fail 'passwordless sudo required'
sudo ctr -n "$NAMESPACE" images ls -q | grep -Fxq "$IMAGE" ||
  fail "cached image missing: $IMAGE"
PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()
PY
)"
sudo ctr -n "$NAMESPACE" run --detach --net-host \
  --env "POSTGRES_PASSWORD=$PASSWORD" --env POSTGRES_DB=lifecycle_fence \
  --env "PGPORT=$PORT" "$IMAGE" "$CONTAINER_ID"
started=1
export PGPASSWORD="$PASSWORD"
psql_base=(psql -h 127.0.0.1 -p "$PORT" -U postgres -d lifecycle_fence -X)
for _ in $(seq 1 40); do
  "${psql_base[@]}" -Atqc 'select 1' >/dev/null 2>&1 && break
  sleep 1
done
[[ "$("${psql_base[@]}" -Atqc 'select 1')" == 1 ]] ||
  fail 'postgres readiness timeout'
db() { "${psql_base[@]}" -v ON_ERROR_STOP=1 "$@"; }
db_app() {
  local app="$1"
  shift
  PGAPPNAME="$app" "${psql_base[@]}" -v ON_ERROR_STOP=1 "$@"
}
scalar() { "${psql_base[@]}" -v ON_ERROR_STOP=1 -Atqc "$1"; }
wait_for_event() {
  local app="$1" event="$2"
  for _ in $(seq 1 200); do
    if [[ "$(scalar "select count(*) from pg_stat_activity where application_name='$app' and wait_event='$event'")" == 1 ]]; then
      return 0
    fi
    sleep 0.05
  done
  fail "session $app did not reach wait_event=$event"
}

db <<'SQL'
CREATE TABLE test_project(
 project_id varchar(64) PRIMARY KEY
);
CREATE TABLE test_runtime_purge_saga(
 saga_id bigserial PRIMARY KEY,
 project_id varchar(64) NOT NULL,
 saga_status varchar(32) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE test_requirement_document(
 project_id varchar(64) NOT NULL,
 document_id varchar(64) NOT NULL,
 publication_reconcile_status varchar(32),
 PRIMARY KEY(project_id,document_id)
);
CREATE TABLE test_runtime_bridge_call(
 case_id varchar(100) NOT NULL,
 call_type varchar(40) NOT NULL
);
CREATE TABLE test_race_result(
 case_id varchar(100) NOT NULL,
 actor varchar(20) NOT NULL,
 outcome varchar(20) NOT NULL,
 PRIMARY KEY(case_id,actor)
);
INSERT INTO test_project VALUES('RFP-RACE');

CREATE OR REPLACE FUNCTION test_publication_mutation(
 p_project_id varchar,p_case_id varchar,p_path varchar
) RETURNS varchar LANGUAGE plpgsql AS $$
DECLARE
 v_saga_id bigint;
 v_count integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(
   'BACKSTAGE_PROJECT_LIFECYCLE_V1:'||p_project_id,0));
 PERFORM 1 FROM test_project WHERE project_id=p_project_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_MISSING'; END IF;
 SELECT saga_id INTO v_saga_id FROM test_runtime_purge_saga
  WHERE project_id=p_project_id
    AND saga_status IN('PREPARED','PURGED','RESTORE_REQUIRED')
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF v_saga_id IS NOT NULL THEN
   INSERT INTO test_race_result VALUES(p_case_id,'PUBLICATION','BLOCKED');
   RETURN 'BLOCKED';
 END IF;

 CASE p_path
 WHEN 'AUTOMATE_CREATE' THEN
   INSERT INTO test_requirement_document VALUES(p_project_id,'DOC','PENDING');
   INSERT INTO test_runtime_bridge_call VALUES(p_case_id,'DESIGN_RELEASE_POST');
 WHEN 'AUTOMATE_REPUBLISH' THEN
   UPDATE test_requirement_document SET publication_reconcile_status='PENDING'
    WHERE project_id=p_project_id AND document_id='DOC'
      AND publication_reconcile_status='TERMINAL';
   GET DIAGNOSTICS v_count=ROW_COUNT;
   IF v_count<>1 THEN RAISE EXCEPTION 'REPUBLISH_ARM_CAS_NOT_EXACT'; END IF;
   INSERT INTO test_runtime_bridge_call VALUES(p_case_id,'DESIGN_RELEASE_POST');
 WHEN 'PUBLICATION_RETRY' THEN
   UPDATE test_requirement_document SET publication_reconcile_status='PENDING'
    WHERE project_id=p_project_id AND document_id='DOC'
      AND publication_reconcile_status='DEAD_LETTERED';
   GET DIAGNOSTICS v_count=ROW_COUNT;
   IF v_count<>1 THEN RAISE EXCEPTION 'RETRY_CAS_NOT_EXACT'; END IF;
 WHEN 'MANUAL_RECONCILE' THEN
   UPDATE test_requirement_document SET publication_reconcile_status='PENDING'
    WHERE project_id=p_project_id AND document_id='DOC'
      AND publication_reconcile_status='TERMINAL';
   GET DIAGNOSTICS v_count=ROW_COUNT;
   IF v_count<>1 THEN RAISE EXCEPTION 'RECEIPT_CAS_NOT_EXACT'; END IF;
 ELSE
   RAISE EXCEPTION 'UNKNOWN_PUBLICATION_PATH';
 END CASE;
 INSERT INTO test_race_result VALUES(p_case_id,'PUBLICATION','APPLIED');
 RETURN 'APPLIED';
END $$;

CREATE OR REPLACE FUNCTION test_delete_prepare(
 p_project_id varchar,p_case_id varchar
) RETURNS varchar LANGUAGE plpgsql AS $$
DECLARE
 v_document_id varchar;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(
   'BACKSTAGE_PROJECT_LIFECYCLE_V1:'||p_project_id,0));
 PERFORM 1 FROM test_project WHERE project_id=p_project_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_MISSING'; END IF;
 SELECT document_id INTO v_document_id FROM test_requirement_document
  WHERE project_id=p_project_id
    AND publication_reconcile_status IN('PENDING','RUNNING')
  ORDER BY document_id LIMIT 1 FOR UPDATE;
 IF v_document_id IS NOT NULL THEN
   INSERT INTO test_race_result VALUES(p_case_id,'DELETE','BLOCKED');
   RETURN 'BLOCKED';
 END IF;
 INSERT INTO test_runtime_purge_saga(project_id,saga_status)
  VALUES(p_project_id,'PREPARED');
 INSERT INTO test_race_result VALUES(p_case_id,'DELETE','APPLIED');
 RETURN 'APPLIED';
END $$;
SQL

run_race() {
  local path="$1" direction="$2" initial_status="$3"
  local case_id="${path}:${direction}"
  local token
  token="$(tr '[:upper:]' '[:lower:]' <<<"${path}_${direction}")"
  local gate_app="gate_${token}" first_app="first_${token}" second_app="second_${token}"
  local gate_key="PROJECT_LIFECYCLE_TEST_GATE:${case_id}"

  db -qc 'truncate test_runtime_purge_saga,test_requirement_document,test_runtime_bridge_call,test_race_result'
  if [[ "$initial_status" != NONE ]]; then
    db -qc \
      "insert into test_requirement_document values('RFP-RACE','DOC','$initial_status')"
  fi

  db_app "$gate_app" -qc \
    "select pg_advisory_lock(hashtextextended('$gate_key',0)); select pg_sleep(30)" \
    >"$RACE_DIR/$gate_app.out" 2>&1 &
  local gate_pid=$!
  wait_for_event "$gate_app" PgSleep

  if [[ "$direction" == DELETE_FIRST ]]; then
    db_app "$first_app" -qc \
      "begin; select test_delete_prepare('RFP-RACE','$case_id'); select pg_advisory_xact_lock(hashtextextended('$gate_key',0)); commit" \
      >"$RACE_DIR/$first_app.out" 2>&1 &
    local first_pid=$!
    wait_for_event "$first_app" advisory
    db_app "$second_app" -qc \
      "begin; select test_publication_mutation('RFP-RACE','$case_id','$path'); commit" \
      >"$RACE_DIR/$second_app.out" 2>&1 &
    local second_pid=$!
  else
    db_app "$first_app" -qc \
      "begin; select test_publication_mutation('RFP-RACE','$case_id','$path'); select pg_advisory_xact_lock(hashtextextended('$gate_key',0)); commit" \
      >"$RACE_DIR/$first_app.out" 2>&1 &
    local first_pid=$!
    wait_for_event "$first_app" advisory
    db_app "$second_app" -qc \
      "begin; select test_delete_prepare('RFP-RACE','$case_id'); commit" \
      >"$RACE_DIR/$second_app.out" 2>&1 &
    local second_pid=$!
  fi
  wait_for_event "$second_app" advisory
  [[ "$(scalar "select count(*) from pg_stat_activity where application_name='$first_app'")" == 1 ]] ||
    fail "$case_id first session ended before barrier release"
  db -qc "select pg_terminate_backend(pid) from pg_stat_activity where application_name='$gate_app'"
  wait "$gate_pid" || true
  wait "$first_pid" || fail "$case_id first failed: $(<"$RACE_DIR/$first_app.out")"
  wait "$second_pid" || fail "$case_id second failed: $(<"$RACE_DIR/$second_app.out")"

  if [[ "$direction" == DELETE_FIRST ]]; then
    [[ "$(scalar "select outcome from test_race_result where case_id='$case_id' and actor='DELETE'")" == APPLIED ]] ||
      fail "$case_id delete did not prepare"
    [[ "$(scalar "select outcome from test_race_result where case_id='$case_id' and actor='PUBLICATION'")" == BLOCKED ]] ||
      fail "$case_id publication crossed PREPARED saga"
    [[ "$(scalar 'select count(*) from test_runtime_purge_saga')" == 1 ]] ||
      fail "$case_id PREPARED saga count drifted"
    [[ "$(scalar 'select count(*) from test_runtime_bridge_call')" == 0 ]] ||
      fail "$case_id invoked the runtime bridge after delete won"
    if [[ "$initial_status" == NONE ]]; then
      [[ "$(scalar 'select count(*) from test_requirement_document')" == 0 ]] ||
        fail "$case_id created a requirement row after delete won"
    else
      [[ "$(scalar "select publication_reconcile_status from test_requirement_document where document_id='DOC'")" == "$initial_status" ]] ||
        fail "$case_id changed the requirement row after delete won"
    fi
  else
    [[ "$(scalar "select outcome from test_race_result where case_id='$case_id' and actor='PUBLICATION'")" == APPLIED ]] ||
      fail "$case_id publication did not arm"
    [[ "$(scalar "select outcome from test_race_result where case_id='$case_id' and actor='DELETE'")" == BLOCKED ]] ||
      fail "$case_id delete crossed active publication"
    [[ "$(scalar 'select count(*) from test_runtime_purge_saga')" == 0 ]] ||
      fail "$case_id inserted a purge saga after publication won"
    [[ "$(scalar "select publication_reconcile_status from test_requirement_document where document_id='DOC'")" == PENDING ]] ||
      fail "$case_id publication did not durably arm PENDING"
  fi
}

for direction in DELETE_FIRST PUBLICATION_FIRST; do
  run_race AUTOMATE_CREATE "$direction" NONE
  run_race AUTOMATE_REPUBLISH "$direction" TERMINAL
  run_race PUBLICATION_RETRY "$direction" DEAD_LETTERED
  run_race MANUAL_RECONCILE "$direction" TERMINAL
done

printf 'PROJECT_LIFECYCLE_PUBLICATION_FENCE_PASS cases=8 directions=2 paths=4 advisoryWaits=16 blocked=8 applied=8 deleteFirstBridgeWrites=0\n'
