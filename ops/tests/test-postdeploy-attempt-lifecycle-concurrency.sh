#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260812080000__bind_postdeploy_attempt_lifecycle.sql"
IMAGE="${POSTDEPLOY_CONCURRENCY_POSTGRES_IMAGE:-postgres:16}"
name="postdeploy-attempt-cas-$$"
tmp="$(mktemp -d)"
container_id=""
cleanup() {
  [[ -z "$container_id" ]] || docker rm -f "$name" >/dev/null 2>&1 || true
  rm -rf -- "$tmp"
}
trap cleanup EXIT INT TERM

command -v docker >/dev/null
[[ -s "$MIGRATION" ]]
container_id="$(docker run --rm -d --name "$name" \
  -e POSTGRES_PASSWORD=postdeploy-test -e POSTGRES_DB=postdeploy_test \
  -p 127.0.0.1::5432 "$IMAGE")"
for _ in {1..40}; do
  docker exec "$name" pg_isready -U postgres -d postdeploy_test >/dev/null 2>&1 && break
  sleep 0.25
done
docker exec "$name" pg_isready -U postgres -d postdeploy_test >/dev/null
port="$(docker port "$name" 5432/tcp | awk -F: 'NR==1{print $NF}')"
[[ "$port" =~ ^[0-9]+$ ]]
export PGPASSWORD=postdeploy-test
psql_base=(psql -h 127.0.0.1 -p "$port" -U postgres -d postdeploy_test -X -q -v ON_ERROR_STOP=1)
host_ready=false
for _ in {1..40}; do
  if "${psql_base[@]}" -Atc 'select 1' >/dev/null 2>&1; then
    host_ready=true
    break
  fi
  sleep 0.25
done
[[ "$host_ready" == true ]]

"${psql_base[@]}" <<'SQL'
CREATE EXTENSION pgcrypto;
CREATE TABLE framework_postdeploy_evidence_candidate(
  candidate_id varchar(160) NOT NULL,
  source_commit varchar(40) NOT NULL,
  staged_at timestamptz NOT NULL DEFAULT current_timestamp,
  UNIQUE(candidate_id,source_commit)
);
CREATE TABLE framework_postdeploy_evidence_promotion(
  promotion_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  candidate_id varchar(160) NOT NULL,
  source_commit varchar(40) NOT NULL UNIQUE,
  runtime_identity_hash varchar(64) NOT NULL,
  process_count integer NOT NULL DEFAULT 6,
  unit_count integer NOT NULL DEFAULT 12,
  promoted_definition_count integer NOT NULL DEFAULT 2,
  appended_validation_count integer NOT NULL DEFAULT 3,
  appended_simulation_count integer NOT NULL DEFAULT 0,
  marker_contract varchar(80) NOT NULL DEFAULT 'DB_AUTHORITATIVE_FILESYSTEM_DERIVED',
  promoted_at timestamptz NOT NULL DEFAULT current_timestamp
);
CREATE FUNCTION framework_promote_postdeploy_evidence_candidate(
  p_candidate_id varchar,p_source_commit varchar,p_runtime_identity_hash varchar
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE row framework_postdeploy_evidence_promotion%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('postdeploy-evidence-promotion:'||p_source_commit));
  PERFORM pg_sleep(0.15);
  INSERT INTO framework_postdeploy_evidence_promotion(candidate_id,source_commit,runtime_identity_hash)
  VALUES(p_candidate_id,p_source_commit,p_runtime_identity_hash)
  ON CONFLICT(source_commit) DO NOTHING;
  SELECT * INTO row FROM framework_postdeploy_evidence_promotion WHERE source_commit=p_source_commit;
  RETURN jsonb_build_object('status',CASE WHEN row.candidate_id=p_candidate_id THEN 'PROMOTED' ELSE 'ALREADY_PROMOTED' END,
    'candidateId',row.candidate_id,'requestedCandidateId',p_candidate_id);
END
$$;
SQL
"${psql_base[@]}" -f "$MIGRATION" >/dev/null

rounds="${POSTDEPLOY_CONCURRENCY_ROUNDS:-8}"
[[ "$rounds" =~ ^[1-9][0-9]*$ && "$rounds" -le 50 ]]
for ((round=1; round<=rounds; round++)); do
  source_commit="$(printf '%040x' "$round")"
  candidate="postdeploy:concurrency:${round}:candidate"
  runtime_hash="$(printf '%064x' "$round")"
  "${psql_base[@]}" -c "select framework_stage_postdeploy_release_attempt('$candidate','$source_commit')" >/dev/null
  promote_sql="SET statement_timeout='5s'; SET lock_timeout='4s'; SELECT framework_promote_postdeploy_evidence_candidate('$candidate','$source_commit','$runtime_hash');"
  abort_sql="SET statement_timeout='5s'; SET lock_timeout='4s'; SELECT framework_abort_postdeploy_release_attempt('$candidate','$source_commit',NULL,'CONCURRENCY_ABORT');"
  promote_status=0; abort_status=0
  if (( round % 2 == 1 )); then
    "${psql_base[@]}" -c "$promote_sql" >"$tmp/promote-$round.out" 2>"$tmp/promote-$round.err" & promote_pid=$!
    "${psql_base[@]}" -c "$abort_sql" >"$tmp/abort-$round.out" 2>"$tmp/abort-$round.err" & abort_pid=$!
  else
    "${psql_base[@]}" -c "$abort_sql" >"$tmp/abort-$round.out" 2>"$tmp/abort-$round.err" & abort_pid=$!
    "${psql_base[@]}" -c "$promote_sql" >"$tmp/promote-$round.out" 2>"$tmp/promote-$round.err" & promote_pid=$!
  fi
  wait "$promote_pid" || promote_status=$?
  wait "$abort_pid" || abort_status=$?
  [[ "$promote_status" == 0 || "$abort_status" == 0 ]]
  [[ "$promote_status" != 0 || "$abort_status" != 0 ]]
  ! grep -Eqi 'deadlock detected|lock timeout|statement timeout' \
    "$tmp/promote-$round.err" "$tmp/abort-$round.err"
  state="$("${psql_base[@]}" -At -c \
    "select a.attempt_status||'|'||count(p.promotion_id) from framework_postdeploy_release_attempt a left join framework_postdeploy_evidence_promotion p using(source_commit) where a.source_commit='$source_commit' group by a.attempt_status")"
  [[ "$state" == 'PROMOTED|1' || "$state" == 'ABORTED|0' ]] || {
    echo "terminal state divergence round=$round state=$state" >&2
    exit 1
  }
done

echo "[postdeploy-attempt-concurrency-test] PASS isolatedPostgres=$IMAGE rounds=$rounds deadlock=0 timeout=0 terminalExactlyOne=1 productionMutation=0"
