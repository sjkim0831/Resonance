#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TARGET="$ROOT/ops/scripts/complete-regulatory-submission-assurance.sh"
bash -n "$TARGET"

for token in \
  'CARBONET_DEPLOY_LOCK_FILE:-/tmp/carbonet-auto-deploy.lock' \
  'flock -s -w "$DEPLOY_LOCK_WAIT_SECONDS" 8' \
  'RUNTIME_CONTRACT="$(bash' 'BASELINE_CONTRACT="$RUNTIME_CONTRACT"' 'FINAL_CONTRACT="$(bash' \
  validate-regulatory-submission-workflow.sh run-regulatory-submission-business-e2e.sh \
  'RELAY_JSON="$(tail -n 1' resonance-regulatory-admin-e2e.sh validate-customer-work-journey.sh \
  BASELINE_SOURCE_COMMIT FINAL_SOURCE_COMMIT \
  BASELINE_RUNTIME_IDENTITY_HASH FINAL_RUNTIME_IDENTITY_HASH \
  BASELINE_POD_TEMPLATE_SHA256 FINAL_POD_TEMPLATE_SHA256 \
  BASELINE_CONTRACT_FINGERPRINT FINAL_CONTRACT_FINGERPRINT RELAY_SOURCE_COMMIT \
  'framework_runtime_release_identity_hash(runtime)' \
  'framework_current_process_step_contract_fingerprint' \
  'FOR SHARE' \
  "current_contract_fingerprint IS DISTINCT FROM '\$CONTRACT_FINGERPRINT'" \
  "r.evidence_json::jsonb->>'runtimeIdentityHash'=runtime_identity_hash_value" \
  "r.evidence_json::jsonb->>'podTemplateSha256'=runtime_pod_template_sha256" \
  "r.evidence_json::jsonb->>'contractFingerprint'=current_contract_fingerprint" \
  framework_simulation_run "job_status='VERIFIED'" 'jobs<>58' 'tests<3'; do
  grep -Fq "$token" "$TARGET" || { echo "[regulatory-submission-contract] FAIL missing=$token" >&2; exit 1; }
done

python3 - "$TARGET" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text(encoding="utf-8")
lock_open = source.index('exec 8>"$DEPLOY_LOCK_FILE"')
lock_acquire = source.index('flock -s -w "$DEPLOY_LOCK_WAIT_SECONDS" 8', lock_open)
baseline = source.index('RUNTIME_CONTRACT="$(bash', lock_acquire)
workflow = source.index('WORKFLOW="$(bash', baseline)
relay = source.index('RELAY="$(bash', workflow)
admin = source.index('ADMIN="$(bash', relay)
customer = source.index('CUSTOMER="$(bash', admin)
final = source.index('FINAL_CONTRACT="$(bash', customer)
relay_source = source.index('RELAY_SOURCE_COMMIT="$(jq', final)
final_compare = source.index('"$FINAL_SOURCE_COMMIT" == "$BASELINE_SOURCE_COMMIT"', relay_source)
db_init = source.index('carbonet_postgres_query_init', final_compare)
runtime_lock = source.index('FROM framework_runtime_release_state runtime', db_init)
contract_lock = source.index('FROM framework_process_definition p WHERE', runtime_lock)
contract_compare = source.index('current_contract_fingerprint IS DISTINCT FROM', contract_lock)
first_mutation = source.index('INSERT INTO framework_simulation_run', contract_compare)
jobs = source.index('UPDATE framework_development_job', first_mutation)

if not (
    lock_open < lock_acquire < baseline < workflow < relay < admin < customer
    < final < relay_source < final_compare < db_init < runtime_lock
    < contract_lock < contract_compare < first_mutation < jobs
):
    raise SystemExit(
        "regulatory completion ordering must be shared-lock -> baseline -> four validators "
        "-> final exact comparison -> DB FOR SHARE -> mutations"
    )

for token in (
    '"$FINAL_SOURCE_COMMIT" == "$BASELINE_SOURCE_COMMIT"',
    '"$FINAL_RUNTIME_IDENTITY_HASH" == "$BASELINE_RUNTIME_IDENTITY_HASH"',
    '"$FINAL_POD_TEMPLATE_SHA256" == "$BASELINE_POD_TEMPLATE_SHA256"',
    '"$FINAL_CONTRACT_FINGERPRINT" == "$BASELINE_CONTRACT_FINGERPRINT"',
    '"$RELAY_SOURCE_COMMIT" == "$BASELINE_SOURCE_COMMIT"',
    "runtime_identity_hash_value IS DISTINCT FROM '$RUNTIME_IDENTITY_HASH'",
    "runtime_pod_template_sha256 IS DISTINCT FROM '$POD_TEMPLATE_SHA256'",
    "current_contract_fingerprint IS DISTINCT FROM '$CONTRACT_FINGERPRINT'",
):
    if token not in source:
        raise SystemExit(f"missing exact drift guard: {token}")
    mutant = source.replace(token, "true", 1)
    if mutant == source:
        raise SystemExit(f"drift mutant ineffective: {token}")
PY

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
FIXTURE_ROOT="$TMP/root"
FIXTURE_BIN="$TMP/bin"
TRACE="$TMP/trace"
MUTATIONS="$TMP/mutations"
SQL_CAPTURE="$TMP/sql"
CAPTURE_COUNT="$TMP/capture-count"
DRIFT_STATE="$TMP/drift-state"
DEPLOY_LOCK="$TMP/carbonet-auto-deploy.lock"
DEPLOY_STATE="$TMP/carbonet-main-success.commit"
FIXTURE_SOURCE_COMMIT="$(printf 'a%.0s' {1..40})"
FIXTURE_SOURCE_COMMIT_B="$(printf '9%.0s' {1..40})"
FIXTURE_RUNTIME_IDENTITY_HASH="$(printf 'b%.0s' {1..64})"
FIXTURE_RUNTIME_IDENTITY_HASH_B="$(printf '8%.0s' {1..64})"
FIXTURE_TEMPLATE_A="$(printf 'c%.0s' {1..64})"
FIXTURE_TEMPLATE_B="$(printf 'd%.0s' {1..64})"
FIXTURE_FINGERPRINT_A="$(printf 'e%.0s' {1..32})"
FIXTURE_FINGERPRINT_B="$(printf 'f%.0s' {1..32})"
mkdir -p "$FIXTURE_ROOT/ops/scripts/lib" "$FIXTURE_ROOT/ops/tests" "$FIXTURE_BIN"
cp "$TARGET" "$FIXTURE_ROOT/ops/scripts/complete-regulatory-submission-assurance.sh"
printf '%s\n' "$FIXTURE_SOURCE_COMMIT" >"$DEPLOY_STATE"

cat >"$FIXTURE_BIN/git" <<'EOF_GIT'
#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$*" == *"rev-parse HEAD"* ]] || exit 97
printf '%s\n' "$FIXTURE_SOURCE_COMMIT"
EOF_GIT

cat >"$FIXTURE_ROOT/ops/scripts/fixture-lock-probe.sh" <<'EOF_PROBE'
#!/usr/bin/env bash
set -Eeuo pipefail
exec 9>"$CARBONET_DEPLOY_LOCK_FILE"
if flock -n 9; then
  echo '[regulatory-fixture] exclusive deploy lock unexpectedly available' >&2
  exit 98
fi
EOF_PROBE

cat >"$FIXTURE_ROOT/ops/scripts/capture-business-e2e-contract.sh" <<'EOF_CAPTURE'
#!/usr/bin/env bash
set -Eeuo pipefail
bash "$RESONANCE_ROOT/ops/scripts/fixture-lock-probe.sh"
count="$(<"$FIXTURE_CAPTURE_COUNT")"
count=$((count+1))
printf '%s\n' "$count" >"$FIXTURE_CAPTURE_COUNT"
printf 'capture:%s\n' "$count" >>"$FIXTURE_TRACE"
template="$FIXTURE_TEMPLATE_A"
fingerprint="$FIXTURE_FINGERPRINT_A"
source_commit="$FIXTURE_SOURCE_COMMIT"
runtime_identity_hash="$FIXTURE_RUNTIME_IDENTITY_HASH"
case "$(cat "$FIXTURE_DRIFT_STATE" 2>/dev/null || true)" in
  source) source_commit="$FIXTURE_SOURCE_COMMIT_B" ;;
  runtime) runtime_identity_hash="$FIXTURE_RUNTIME_IDENTITY_HASH_B" ;;
  template) template="$FIXTURE_TEMPLATE_B" ;;
  fingerprint) fingerprint="$FIXTURE_FINGERPRINT_B" ;;
esac
jq -cn \
  --arg processCode "$1" --arg stepCode "$2" --arg processVersion '1.0.0' \
  --arg contractFingerprint "$fingerprint" --arg sourceCommit "$source_commit" \
  --arg runtimeIdentityHash "$runtime_identity_hash" --arg podTemplateSha256 "$template" \
  '{processCode:$processCode,stepCode:$stepCode,processVersion:$processVersion,contractFingerprint:$contractFingerprint,sourceCommit:$sourceCommit,runtimeIdentityHash:$runtimeIdentityHash,podTemplateSha256:$podTemplateSha256}'
EOF_CAPTURE

cat >"$FIXTURE_ROOT/ops/scripts/validate-regulatory-submission-workflow.sh" <<'EOF_WORKFLOW'
#!/usr/bin/env bash
set -Eeuo pipefail
bash "$RESONANCE_ROOT/ops/scripts/fixture-lock-probe.sh"
printf 'validator:workflow\n' >>"$FIXTURE_TRACE"
printf '[regulatory-workflow] PASS tables=2 steps=4 contracts=8 menus=2\n'
EOF_WORKFLOW

cat >"$FIXTURE_ROOT/ops/tests/run-regulatory-submission-business-e2e.sh" <<'EOF_RELAY'
#!/usr/bin/env bash
set -Eeuo pipefail
bash "$RESONANCE_ROOT/ops/scripts/fixture-lock-probe.sh"
printf 'validator:relay\n' >>"$FIXTURE_TRACE"
relay_source="$FIXTURE_SOURCE_COMMIT"
[[ "${FIXTURE_DRIFT_MODE:-stable}" == relay ]] && relay_source="$FIXTURE_SOURCE_COMMIT_B"
jq -cn --arg sourceCommit "$relay_source" '{status:"PROMOTED",processCode:"REGULATORY_SUBMISSION",steps:4,cleanup:true,sourceCommit:$sourceCommit}'
EOF_RELAY

cat >"$FIXTURE_ROOT/ops/scripts/resonance-regulatory-admin-e2e.sh" <<'EOF_ADMIN'
#!/usr/bin/env bash
set -Eeuo pipefail
bash "$RESONANCE_ROOT/ops/scripts/fixture-lock-probe.sh"
printf 'validator:admin\n' >>"$FIXTURE_TRACE"
case "${FIXTURE_DRIFT_MODE:-stable}" in
  source|runtime|template|fingerprint) printf '%s\n' "$FIXTURE_DRIFT_MODE" >"$FIXTURE_DRIFT_STATE" ;;
esac
jq -cn '{status:"PASS",desktop:1,mobile:1,accessibility:1,authority:1}'
EOF_ADMIN

cat >"$FIXTURE_ROOT/ops/scripts/validate-customer-work-journey.sh" <<'EOF_CUSTOMER'
#!/usr/bin/env bash
set -Eeuo pipefail
bash "$RESONANCE_ROOT/ops/scripts/fixture-lock-probe.sh"
printf 'validator:customer\n' >>"$FIXTURE_TRACE"
printf '[customer-journey] PASS current regulatory=accepted exact\n'
EOF_CUSTOMER

cat >"$FIXTURE_ROOT/ops/scripts/lib/carbonet-postgres-query.sh" <<'EOF_DB'
carbonet_postgres_query_init() {
  bash "$RESONANCE_ROOT/ops/scripts/fixture-lock-probe.sh"
  printf 'db:init\n' >>"$FIXTURE_TRACE"
}
carbonet_postgres_query() {
  bash "$RESONANCE_ROOT/ops/scripts/fixture-lock-probe.sh"
  printf 'db:query\n' >>"$FIXTURE_TRACE"
  printf '%s\n' "$1" >"$FIXTURE_SQL_CAPTURE"
  printf 'mutation-query\n' >>"$FIXTURE_MUTATIONS"
}
EOF_DB
chmod +x "$FIXTURE_BIN/git" "$FIXTURE_ROOT/ops/scripts/"*.sh "$FIXTURE_ROOT/ops/tests/"*.sh

export FIXTURE_SOURCE_COMMIT FIXTURE_SOURCE_COMMIT_B
export FIXTURE_RUNTIME_IDENTITY_HASH FIXTURE_RUNTIME_IDENTITY_HASH_B FIXTURE_TEMPLATE_A FIXTURE_TEMPLATE_B
export FIXTURE_FINGERPRINT_A FIXTURE_FINGERPRINT_B FIXTURE_TRACE="$TRACE"
export FIXTURE_MUTATIONS="$MUTATIONS" FIXTURE_SQL_CAPTURE="$SQL_CAPTURE"
export FIXTURE_CAPTURE_COUNT="$CAPTURE_COUNT" FIXTURE_DRIFT_STATE="$DRIFT_STATE"

run_fixture() {
  local mode="$1" expected_status="$2" status
  : >"$TRACE"
  : >"$MUTATIONS"
  printf '0\n' >"$CAPTURE_COUNT"
  rm -f "$DRIFT_STATE" "$SQL_CAPTURE"
  set +e
  PATH="$FIXTURE_BIN:$PATH" RESONANCE_ROOT="$FIXTURE_ROOT" \
    CARBONET_DEPLOY_LOCK_FILE="$DEPLOY_LOCK" CARBONET_DEPLOY_STATE_FILE="$DEPLOY_STATE" \
    REGULATORY_SUBMISSION_DEPLOY_LOCK_WAIT_SECONDS=1 FIXTURE_DRIFT_MODE="$mode" \
    bash "$FIXTURE_ROOT/ops/scripts/complete-regulatory-submission-assurance.sh" \
      >"$TMP/$mode.out" 2>"$TMP/$mode.err"
  status=$?
  set -e
  [[ $status -eq $expected_status ]] || {
    cat "$TMP/$mode.err" >&2
    echo "[regulatory-submission-contract] FAIL mode=$mode expected=$expected_status actual=$status" >&2
    exit 1
  }
}

run_fixture stable 0
cat >"$TMP/expected-trace" <<'EOF_TRACE'
capture:1
validator:workflow
validator:relay
validator:admin
validator:customer
capture:2
db:init
db:query
EOF_TRACE
diff -u "$TMP/expected-trace" "$TRACE"
[[ "$(wc -l <"$MUTATIONS" | tr -d '[:space:]')" == 1 ]]
python3 - "$SQL_CAPTURE" <<'PY'
from pathlib import Path
import sys

sql = Path(sys.argv[1]).read_text(encoding="utf-8")
runtime_lock = sql.index("FROM framework_runtime_release_state runtime")
contract_lock = sql.index("FROM framework_process_definition p WHERE", runtime_lock)
contract_compare = sql.index("current_contract_fingerprint IS DISTINCT FROM", contract_lock)
first_mutation = sql.index("INSERT INTO framework_simulation_run", contract_compare)
assert runtime_lock < contract_lock < contract_compare < first_mutation
assert "FOR SHARE" in sql[runtime_lock:first_mutation]
PY

for drift_mode in source runtime template fingerprint relay; do
  run_fixture "$drift_mode" 3
  [[ ! -s "$MUTATIONS" ]] || {
    echo "[regulatory-submission-contract] FAIL drift=$drift_mode reached a database mutation" >&2
    exit 1
  }
  [[ "$(<"$CAPTURE_COUNT")" == 2 ]]
  grep -Fx 'validator:admin' "$TRACE" >/dev/null
  grep -Fx 'validator:customer' "$TRACE" >/dev/null
  ! grep -Fq 'db:' "$TRACE"
  grep -Fq 'exact runtime/contract identity changed during validation' "$TMP/$drift_mode.err"
done

printf '[regulatory-submission-contract] PASS relay=4 admin=desktop+mobile jobs=58 simulation=approved-only deployLock=whole-script baselineFinal=source+runtimeIdentity+podTemplate+contractFingerprint relaySource=exact dbLock=before-mutation driftMutants=source+runtime+template+fingerprint+relay/mutation0\n'
