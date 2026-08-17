#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}}"
HELPER="$ROOT/ops/scripts/reconcile-exact-legacy-orphan-runtime-quarantine.sh"
AUTO="$ROOT/ops/scripts/auto-deploy-main.sh"
[[ -f "$HELPER" && -f "$AUTO" ]] || { echo '[legacy-orphan-quarantine-test] missing source' >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT
mkdir -p "$TMP/bin" "$TMP/repo" "$TMP/state"
git -C "$TMP/repo" init -q
git -C "$TMP/repo" config user.name fixture
git -C "$TMP/repo" config user.email fixture@example.invalid
printf 'baseline\n' >"$TMP/repo/lineage"
git -C "$TMP/repo" add lineage
git -C "$TMP/repo" commit -qm baseline
BASELINE="$(git -C "$TMP/repo" rev-parse HEAD)"
printf 'orphan\n' >>"$TMP/repo/lineage"
git -C "$TMP/repo" commit -qam orphan
ORPHAN_TARGET="$(git -C "$TMP/repo" rev-parse HEAD)"
printf 'next\n' >>"$TMP/repo/lineage"
git -C "$TMP/repo" commit -qam next
NEXT_TARGET="$(git -C "$TMP/repo" rev-parse HEAD)"
CANDIDATE="postdeploy:${ORPHAN_TARGET:0:12}:legacy-orphan-fixture-123456"
IMAGE_REF='registry.invalid/carbonet@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
IMAGE_ID='sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

cat >"$TMP/deployment.json" <<JSON
{"metadata":{"namespace":"test-ns","name":"carbonet-runtime","uid":"runtime-uid","resourceVersion":"10","generation":7,"annotations":{"resonance.ai/target-commit":"$BASELINE"}},"spec":{"replicas":2,"selector":{"matchLabels":{"app":"carbonet-runtime"}},"template":{"spec":{"containers":[{"name":"carbonet-runtime","image":"$IMAGE_REF"}]}}},"status":{"observedGeneration":7,"updatedReplicas":2,"readyReplicas":2,"availableReplicas":2,"unavailableReplicas":0}}
JSON
TEMPLATE_SHA256="$(jq -cS '.spec.template' "$TMP/deployment.json" | sha256sum | awk '{print $1}')"
jq --arg hash "$TEMPLATE_SHA256" '.metadata.annotations["resonance.ai/runtime-template-sha256"]=$hash' \
  "$TMP/deployment.json" >"$TMP/deployment.bound.json"
mv -f "$TMP/deployment.bound.json" "$TMP/deployment.json"
cat >"$TMP/pods.json" <<JSON
{"items":[{"metadata":{"name":"runtime-0"},"spec":{"containers":[{"name":"carbonet-runtime","image":"$IMAGE_REF"}]},"status":{"phase":"Running","conditions":[{"type":"Ready","status":"True"}],"containerStatuses":[{"name":"carbonet-runtime","ready":true,"imageID":"$IMAGE_ID"}]}},{"metadata":{"name":"runtime-1"},"spec":{"containers":[{"name":"carbonet-runtime","image":"$IMAGE_REF"}]},"status":{"phase":"Running","conditions":[{"type":"Ready","status":"True"}],"containerStatuses":[{"name":"carbonet-runtime","ready":true,"imageID":"$IMAGE_ID"}]}}]}
JSON
cat >"$TMP/ledger.json" <<JSON
{"releaseKey":"CARBONET_RUNTIME","sourceCommit":"$BASELINE","deploymentNamespace":"test-ns","deploymentName":"carbonet-runtime","deploymentUid":"runtime-uid","deploymentGeneration":7,"observedGeneration":7,"desiredReplicas":2,"imageRef":"$IMAGE_REF","imageId":"$IMAGE_ID","podTemplateSha256":"$TEMPLATE_SHA256","healthStatus":"UP"}
JSON
cp "$TMP/deployment.json" "$TMP/deployment.good.json"
cp "$TMP/pods.json" "$TMP/pods.good.json"
cp "$TMP/ledger.json" "$TMP/ledger.good.json"

cat >"$TMP/bin/kubectl" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
args="$*"
if [[ "${FAKE_KUBECTL_MODE:-runtime}" == schema ]]; then
  if [[ "$args" == *'create database'* ]]; then
    printf 'create\n' >>"$FAKE_CALL_LOG"; exit 0
  elif [[ "$args" == *' pg_restore '* && "$args" == *' --schema-only '* ]]; then
    [[ "$args" != *' -t '* ]] || { echo 'full schema restore was table-filtered' >&2; exit 81; }
    payload="$(cat)"
    [[ "$payload" == 'FULL_SCHEMA_FIXTURE:users,orders,carbonet_flyway_schema_history' ]] || exit 82
    printf 'restore-schema:%s\n' "$args" >>"$FAKE_CALL_LOG"
    [[ "${FAKE_SCHEMA_RESULT:-ok}" != fail ]] || exit 83
    exit 0
  elif [[ "$args" == *' pg_restore '* && "$args" == *' --data-only '* ]]; then
    [[ "$args" == *' -t carbonet_flyway_schema_history'* ]] || exit 84
    [[ "$(cat)" == 'FLYWAY_HISTORY_FIXTURE:42' ]] || exit 85
    printf 'restore-history:%s\n' "$args" >>"$FAKE_CALL_LOG"; exit 0
  elif [[ "$args" == *'select count(*) from carbonet_flyway_schema_history'* ]]; then
    printf '%s\n' "${FAKE_HISTORY_COUNT:-42}"; exit 0
  elif [[ "$args" == *'select count(*) from pg_class'* ]]; then
    printf '%s\n' "${FAKE_SCHEMA_OBJECT_COUNT:-3}"; exit 0
  elif [[ "$args" == *'drop database'* ]]; then
    printf 'drop\n' >>"$FAKE_CALL_LOG"; exit 0
  fi
  echo "unexpected schema kubectl: $args" >&2; exit 86
fi

if [[ "$args" == *' get deployment/'* ]]; then cat "$FAKE_DEPLOYMENT_JSON"; exit 0; fi
if [[ "$args" == *' get pods '* ]]; then cat "$FAKE_PODS_JSON"; exit 0; fi
if [[ "$args" == *' exec runtime-'* && "$args" == *' curl '* ]]; then
  [[ "${FAKE_LIVE_STATE:-up}" == up ]] && printf '{"status":"UP"}\n' || printf '{"status":"DOWN"}\n'
  exit 0
fi
if [[ "$args" == *' psql '* ]]; then
  sql="$(cat)"
  [[ -z "${FAKE_DB_DELAY:-}" ]] || sleep "$FAKE_DB_DELAY"
  if [[ "$sql" == *"concat_ws('|', CASE WHEN to_regclass"* ]]; then
    [[ "${FAKE_DB_STATE:-empty}" != fault ]] || exit 91
    [[ "${FAKE_DB_STATE:-empty}" != missingtables ]] \
      && printf 'AVAILABLE|AVAILABLE|AVAILABLE\n' \
      || printf 'AVAILABLE|ABSENT|AVAILABLE\n'
  elif [[ "$sql" == *'LEGACY_ORPHAN_EXACT_ABSENCE'* ]]; then
    state="${FAKE_DB_STATE:-empty}"
    if [[ -n "${FAKE_DB_COUNTER:-}" ]]; then
      count="$(cat "$FAKE_DB_COUNTER" 2>/dev/null || printf 0)"
      count=$((count + 1)); printf '%s\n' "$count" >"$FAKE_DB_COUNTER"
      if [[ "${FAKE_DB_FLIP_AFTER:-0}" == 1 && "$count" -gt 1 ]]; then state=attemptrow; fi
    fi
    case "$state" in
      empty) printf '0|0|0|1|1\n' ;;
      attemptrow) printf '1|0|0|1|1\n' ;;
      promotionrow) printf '0|1|0|1|1\n' ;;
      runtimerow) printf '0|0|1|1|2\n' ;;
      baselineunhealthy) printf '0|0|0|0|1\n' ;;
      *) exit 92 ;;
    esac
  elif [[ "$sql" == *'LEGACY_ORPHAN_BASELINE_LEDGER'* ]]; then
    cat "$FAKE_LEDGER_JSON"
  else
    echo "unexpected runtime SQL: $sql" >&2; exit 93
  fi
  exit 0
fi
echo "unexpected runtime kubectl: $args" >&2
exit 94
SH
chmod +x "$TMP/bin/kubectl"

export PATH="$TMP/bin:$PATH"
export FAKE_DEPLOYMENT_JSON="$TMP/deployment.json" FAKE_PODS_JSON="$TMP/pods.json" FAKE_LEDGER_JSON="$TMP/ledger.json"
STATE="$TMP/state"
QUARANTINE="$STATE/runtime-ledger-invalidation.quarantine"
APPLIED="$STATE/applied.commit"
RUNTIME="$STATE/runtime.commit"
JOURNAL="$STATE/attempt.json"
PENDING="$STATE/pending.state"
CHECKPOINT="$STATE/runtime-candidate.json"
RETIRED="$STATE/retired"
LOCK="$TMP/deploy.lock"

write_case() {
  local reason="${1:-MARKER_PENDING_RUNTIME_PROOF_FAILED}"
  cp "$TMP/deployment.good.json" "$TMP/deployment.json"
  cp "$TMP/pods.good.json" "$TMP/pods.json"
  cp "$TMP/ledger.good.json" "$TMP/ledger.json"
  rm -rf -- "$RETIRED"
  rm -f -- "$QUARANTINE" "$JOURNAL" "$PENDING" "$CHECKPOINT" "$LOCK" "$TMP/db-counter"
  printf '%s\n' "$BASELINE" >"$APPLIED"
  printf '%s\n' "$BASELINE" >"$RUNTIME"
  chmod 0644 "$APPLIED" "$RUNTIME"
  printf 'schemaVersion=1\ntargetCommit=%s\ncandidateId=%s\nreason=%s\nobservedAppliedMarker=%s\nobservedRuntimeMarker=%s\n' \
    "$ORPHAN_TARGET" "$CANDIDATE" "$reason" "$BASELINE" "$BASELINE" >"$QUARANTINE"
  chmod 0600 "$QUARANTINE"
  export FAKE_DB_STATE=empty FAKE_LIVE_STATE=up FAKE_DB_FLIP_AFTER=0 FAKE_DB_DELAY=""
  export FAKE_DB_COUNTER="$TMP/db-counter"
}

run_helper() {
  CARBONET_DEPLOY_LOCK_FILE="$LOCK" \
  CARBONET_RUNTIME_LEDGER_QUARANTINE_FILE="$QUARANTINE" \
  CARBONET_DEPLOY_STATE_FILE="$APPLIED" \
  CARBONET_RUNTIME_DEPLOY_STATE_FILE="$RUNTIME" \
  CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE="$JOURNAL" \
  CARBONET_POSTDEPLOY_MARKER_PENDING_FILE="$PENDING" \
  CARBONET_RUNTIME_CANDIDATE_CHECKPOINT_FILE="$CHECKPOINT" \
  CARBONET_POSTDEPLOY_LEGACY_RETIRE_DIR="$RETIRED" \
  CARBONET_ORPHAN_RECOVERY_TARGET_COMMIT="$NEXT_TARGET" \
  CARBONET_POSTGRES_POD=postgres-0 CARBONET_K8S_NAMESPACE=test-ns \
    bash "$HELPER" "$TMP/repo"
}

# Exact happy path performs two complete read-only snapshots, leaves one
# same-filesystem mode-0400 archive, and removes only the original blocker.
write_case
SOURCE_HASH="$(sha256sum "$QUARANTINE" | awk '{print $1}')"
run_helper >"$TMP/happy.log"
ARCHIVE="$RETIRED/${CANDIDATE}.legacy-orphan-runtime-quarantine.state"
[[ ! -e "$QUARANTINE" && ! -L "$QUARANTINE" ]]
[[ -f "$ARCHIVE" && ! -L "$ARCHIVE" && "$(stat -c '%a:%u:%g' "$ARCHIVE")" == "400:$(id -u):$(id -g)" ]]
[[ "$(sha256sum "$ARCHIVE" | awk '{print $1}')" == "$SOURCE_HASH" ]]
[[ "$(cat "$TMP/db-counter")" == 3 ]]
grep -Fq 'targetRows=0/0/0 liveLedger=1 health=UP' "$TMP/happy.log"
run_helper >"$TMP/no-quarantine.log"
[[ ! -s "$TMP/no-quarantine.log" && "$(sha256sum "$ARCHIVE" | awk '{print $1}')" == "$SOURCE_HASH" ]]

# Same-image PodTemplate changes cannot be hidden by retaining or rewriting the
# mutable Deployment annotation; the independent DB digest remains authority.
write_case
jq '.spec.template.spec.containers[0].env=[{"name":"UNAUTHORIZED_DRIFT","value":"1"}]' \
  "$TMP/deployment.json" >"$TMP/deployment.drift.json"
mv -f "$TMP/deployment.drift.json" "$TMP/deployment.json"
status=0; run_helper >/dev/null 2>&1 || status=$?
[[ "$status" == 79 && -f "$QUARANTINE" && ! -e "$RETIRED" ]]

write_case
jq '.spec.template.spec.containers[0].env=[{"name":"COUPLED_DRIFT","value":"1"}]' \
  "$TMP/deployment.json" >"$TMP/deployment.drift.json"
drift_hash="$(jq -cS '.spec.template' "$TMP/deployment.drift.json" | sha256sum | awk '{print $1}')"
jq --arg hash "$drift_hash" '.metadata.annotations["resonance.ai/runtime-template-sha256"]=$hash' \
  "$TMP/deployment.drift.json" >"$TMP/deployment.json"
status=0; run_helper >/dev/null 2>&1 || status=$?
[[ "$status" == 79 && -f "$QUARANTINE" && ! -e "$RETIRED" ]]

write_case
jq '.podTemplateSha256=null' "$TMP/ledger.json" >"$TMP/ledger.unbound.json"
mv -f "$TMP/ledger.unbound.json" "$TMP/ledger.json"
status=0; run_helper >/dev/null 2>&1 || status=$?
[[ "$status" == 79 && -f "$QUARANTINE" && ! -e "$RETIRED" ]]

# A quarantine left by a failed recovered-checkpoint disarm is eligible only
# after the runtime candidate checkpoint itself is proven absent.
write_case RECOVERED_CHECKPOINT_DISARM_FAILED
run_helper >"$TMP/recovered-checkpoint.log"
[[ ! -e "$QUARANTINE" && ! -L "$QUARANTINE" ]]
grep -Fq 'targetRows=0/0/0 liveLedger=1 health=UP' "$TMP/recovered-checkpoint.log"
for checkpoint_kind in file symlink; do
  write_case RECOVERED_CHECKPOINT_DISARM_FAILED
  if [[ "$checkpoint_kind" == file ]]; then
    printf '{"stage":"PREPARED"}\n' >"$CHECKPOINT"
  else
    ln -s "$TMP/missing-checkpoint-target" "$CHECKPOINT"
  fi
  status=0; run_helper >"$TMP/checkpoint-${checkpoint_kind}.log" 2>&1 || status=$?
  [[ "$status" == 79 && -f "$QUARANTINE" && ! -e "$RETIRED" ]]
  grep -Fq 'runtime candidate checkpoint' "$TMP/checkpoint-${checkpoint_kind}.log"
done

# Non-exact legacy evidence is a no-op here and remains for auto-deploy's
# ordinary quarantine gate to block.
for nonmatching_reason in PROMOTION_DB_CHECK_UNAVAILABLE RECOVERED_CHECKPOINT_DISARM_FAILED_EXTRA; do
  write_case "$nonmatching_reason"
  run_helper >/dev/null
  [[ -f "$QUARANTINE" && ! -e "$RETIRED" ]]
done
write_case
chmod 0644 "$QUARANTINE"
run_helper >/dev/null
[[ -f "$QUARANTINE" && ! -e "$RETIRED" ]]

# Exact evidence fails closed before archive for every DB authority row,
# missing table/query, unhealthy live state, pending obligation and ancestry.
for state in attemptrow promotionrow runtimerow baselineunhealthy missingtables fault; do
  write_case
  export FAKE_DB_STATE="$state"
  status=0; run_helper >/dev/null 2>&1 || status=$?
  [[ "$status" == 79 && -f "$QUARANTINE" && ! -e "$RETIRED" ]]
done
write_case
export FAKE_LIVE_STATE=down
status=0; run_helper >/dev/null 2>&1 || status=$?
[[ "$status" == 79 && -f "$QUARANTINE" ]]
for obligation in journal pending; do
  write_case
  [[ "$obligation" == journal ]] && printf '{}\n' >"$JOURNAL" || printf 'pending\n' >"$PENDING"
  status=0; run_helper >/dev/null 2>&1 || status=$?
  [[ "$status" == 79 && -f "$QUARANTINE" ]]
done
write_case
status=0
CARBONET_ORPHAN_RECOVERY_TARGET_COMMIT="$BASELINE" \
CARBONET_DEPLOY_LOCK_FILE="$LOCK" CARBONET_RUNTIME_LEDGER_QUARANTINE_FILE="$QUARANTINE" \
CARBONET_DEPLOY_STATE_FILE="$APPLIED" CARBONET_RUNTIME_DEPLOY_STATE_FILE="$RUNTIME" \
CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE="$JOURNAL" CARBONET_POSTDEPLOY_MARKER_PENDING_FILE="$PENDING" \
CARBONET_POSTDEPLOY_LEGACY_RETIRE_DIR="$RETIRED" CARBONET_POSTGRES_POD=postgres-0 \
CARBONET_K8S_NAMESPACE=test-ns bash "$HELPER" "$TMP/repo" >/dev/null 2>&1 || status=$?
[[ "$status" == 79 && -f "$QUARANTINE" ]]

# A row appearing between the pre/post snapshots leaves the original blocker
# even though the already-durable archive copy is retained as evidence.
write_case
export FAKE_DB_FLIP_AFTER=1
status=0; run_helper >/dev/null 2>&1 || status=$?
[[ "$status" == 79 && -f "$QUARANTINE" && -f "$ARCHIVE" ]]

# Two simultaneous starters share the deployment flock: exactly one archive
# is produced; the peer either observes completion or exits retry-safe (75).
write_case
export FAKE_DB_DELAY=0.15
(set +e; run_helper >"$TMP/concurrent-1.log" 2>&1; printf '%s\n' "$?" >"$TMP/concurrent-1.status") & p1=$!
(set +e; run_helper >"$TMP/concurrent-2.log" 2>&1; printf '%s\n' "$?" >"$TMP/concurrent-2.status") & p2=$!
wait "$p1"; wait "$p2"
s1="$(cat "$TMP/concurrent-1.status")"; s2="$(cat "$TMP/concurrent-2.status")"
[[ "$s1" == 0 || "$s1" == 75 ]]; [[ "$s2" == 0 || "$s2" == 75 ]]
[[ "$s1" == 0 || "$s2" == 0 ]]
[[ ! -e "$QUARANTINE" && "$(find "$RETIRED" -maxdepth 1 -type f | wc -l)" == 1 ]]

# Exercise the auto-deploy scratch verifier with streamed fixtures. The first
# restore must contain the full schema archive and must not carry a -t filter;
# Flyway data/count verification remains mandatory. This fake run is <60s.
extract_function() { sed -n "/^$1() {$/,/^}$/p" "$AUTO"; }
eval "$(extract_function verify_schema_backup_restore_in_scratch)"
printf 'FULL_SCHEMA_FIXTURE:users,orders,carbonet_flyway_schema_history\n' >"$TMP/schema.dump"
printf 'FLYWAY_HISTORY_FIXTURE:42\n' >"$TMP/flyway.dump"
export FAKE_KUBECTL_MODE=schema FAKE_CALL_LOG="$TMP/schema-calls" FAKE_HISTORY_COUNT=42 FAKE_SCHEMA_OBJECT_COUNT=3 FAKE_SCHEMA_RESULT=ok
NAMESPACE=test-ns; POSTGRES_POD=postgres-0; POSTGRES_CONTAINER=patroni; POSTGRES_USER=postgres
schema_restore_database=""; restored_history_count=""; restored_schema_object_count=""
started_ms="$(awk '{printf "%.0f",$1*1000}' /proc/uptime)"
verify_schema_backup_restore_in_scratch \
  "$TMP/schema.dump" "$TMP/flyway.dump" carbonet_schema_verify_fixture 42 3
elapsed_ms=$(( $(awk '{printf "%.0f",$1*1000}' /proc/uptime) - started_ms ))
[[ "$restored_history_count" == 42 && "$restored_schema_object_count" == 3 \
   && -z "$schema_restore_database" && "$elapsed_ms" -lt 60000 ]]
grep -Fq 'restore-schema:' "$FAKE_CALL_LOG"; grep -Fq 'restore-history:' "$FAKE_CALL_LOG"
[[ "$(grep -c '^create$' "$FAKE_CALL_LOG")" == 1 && "$(grep -c '^drop$' "$FAKE_CALL_LOG")" == 1 ]]
export FAKE_SCHEMA_OBJECT_COUNT=2
schema_restore_database=""; restored_schema_object_count=""; status=0
verify_schema_backup_restore_in_scratch \
  "$TMP/schema.dump" "$TMP/flyway.dump" carbonet_schema_verify_object_mismatch 42 3 \
  >/dev/null 2>&1 || status=$?
[[ "$status" != 0 && "$schema_restore_database" == carbonet_schema_verify_object_mismatch \
   && "$restored_schema_object_count" == 2 ]]
export FAKE_SCHEMA_OBJECT_COUNT=3
export FAKE_HISTORY_COUNT=0
schema_restore_database=""; restored_history_count=""; restored_schema_object_count=""; status=0
verify_schema_backup_restore_in_scratch \
  "$TMP/schema.dump" "$TMP/flyway.dump" carbonet_schema_verify_empty 42 3 \
  >/dev/null 2>&1 || status=$?
[[ "$status" != 0 && "$schema_restore_database" == carbonet_schema_verify_empty ]]

# The outer EXIT trap owns scratch cleanup on every verifier failure. Execute
# that real cleanup function with the failed scratch identity and assert the
# forced drop is issued before exit.
eval "$(extract_function cleanup_deploy)"
drop_before="$(grep -c '^drop$' "$FAKE_CALL_LOG")"
(
  terminate_runtime_screen_gate_group() { :; }
  cleanup_remote_backup() { :; }
  cleanup_local_schema_restore_container() { :; }
  bounded_cleanup_kubectl() { kubectl "$@"; }
  runtime_asset_sync_pid=""; catalog_identity_sync_pid=""; backstage_visual_e2e_pid=""
  schema_restore_database=carbonet_schema_verify_empty; schema_backup_dir=""
  flyway_cleanup_recovery_hold=false; FLYWAY_CLEANUP_HOLD_FILE="$TMP/no-flyway-hold"
  ROOT_DIR="$TMP/nonexistent-root"; persistent_build_worktree="$TMP/nonexistent-worktree"
  CARBONET_DEPLOY_SNAPSHOT_PATH=""; POSTDEPLOY_ATTEMPT_JOURNAL_FILE="$TMP/no-journal"
  postdeploy_candidate_promoted=false; postdeploy_candidate_initialized=false
  DEPLOY_PHASE_FILE="$TMP/no-phase"
  cleanup_deploy
)
[[ "$(grep -c '^drop$' "$FAKE_CALL_LOG")" == "$((drop_before + 1))" ]]

grep -Fq 'reconcile-exact-legacy-orphan-runtime-quarantine.sh' "$AUTO"
printf '[legacy-orphan-quarantine-test] PASS exact6+mode600+owner reasons=markerPending+recoveredCheckpointDisarm checkpoint=absent+fileBlocked+symlinkBlocked hashPinned markers=stable+equal ancestry=baseline-orphan-next DB=attempt0+promotion0+runtime0 baseline=ledger1+healthUP+podTemplateDB archive=0400+samefs+fsync+sourceAbsent failClosed=rows+unknown+health+obligation+ancestry+templateDrift+coupledAnnotationDrift+unboundTemplate+postArchiveDrift concurrent=2 schemaRestore=full+flywayRows+objectParity+objectMismatch+failureCleanup elapsedMs=%s\n' "$elapsed_ms"
