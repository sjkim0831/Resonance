#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}}"
AUTO="$ROOT/ops/scripts/auto-deploy-main.sh"
PROMOTER="$ROOT/ops/scripts/promote-postdeploy-candidate-evidence.sh"
[[ -f "$AUTO" && -f "$PROMOTER" ]] || { echo '[postdeploy-promotion-recovery-test] missing source' >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT
mkdir -p "$TMP/bin" "$TMP/evidence" "$TMP/markers"
printf 'fixture\n' >"$TMP/kubeconfig"
export CARBONET_KUBECONFIG="$TMP/kubeconfig"

SOURCE="1111111111111111111111111111111111111111"
OLD="0000000000000000000000000000000000000000"
HELPER="2222222222222222222222222222222222222222"
CANDIDATE="postdeploy:test:candidate:123456"
IMAGE_REF="registry.invalid/carbonet@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
IMAGE_ID="sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
RUNTIME_HASH="cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"

printf '{"unit":"governance"}\n' >"$TMP/evidence/governance.json"
printf '{"unit":"organization"}\n' >"$TMP/evidence/organization.json"
chmod 0444 "$TMP/evidence/governance.json" "$TMP/evidence/organization.json"
GOV_HASH="$(sha256sum "$TMP/evidence/governance.json" | awk '{print $1}')"
ORG_HASH="$(sha256sum "$TMP/evidence/organization.json" | awk '{print $1}')"
cat >"$TMP/candidate.json" <<JSON
[{"unitCode":"GOVERNANCE_CHANGE_RUNTIME","path":"$TMP/evidence/governance.json","sha256":"$GOV_HASH"},{"unitCode":"ORGANIZATIONAL_BOUNDARY_RUNTIME","path":"$TMP/evidence/organization.json","sha256":"$ORG_HASH"}]
JSON

write_live_fixtures() {
  local commit="$1"
  cat >"$TMP/deployment.json" <<JSON
{"metadata":{"namespace":"test-ns","name":"carbonet-runtime","uid":"runtime-uid","generation":7,"annotations":{"resonance.ai/target-commit":"$commit"}},"spec":{"replicas":1,"selector":{"matchLabels":{"app":"carbonet-runtime"}},"template":{"spec":{"containers":[{"name":"carbonet-runtime","image":"$IMAGE_REF"}]}}},"status":{"observedGeneration":7,"updatedReplicas":1,"readyReplicas":1,"availableReplicas":1,"unavailableReplicas":0}}
JSON
  cat >"$TMP/pods.json" <<JSON
{"items":[{"metadata":{"name":"runtime-0"},"spec":{"containers":[{"name":"carbonet-runtime","image":"$IMAGE_REF"}]},"status":{"phase":"Running","conditions":[{"type":"Ready","status":"True"}],"containerStatuses":[{"name":"carbonet-runtime","ready":true,"imageID":"$IMAGE_ID"}]}}]}
JSON
  cat >"$TMP/ledger.json" <<JSON
{"releaseKey":"CARBONET_RUNTIME","sourceCommit":"$commit","deploymentNamespace":"test-ns","deploymentName":"carbonet-runtime","deploymentUid":"runtime-uid","deploymentGeneration":7,"observedGeneration":7,"desiredReplicas":1,"imageRef":"$IMAGE_REF","imageId":"$IMAGE_ID","healthStatus":"UP","runtimeIdentityHash":"$RUNTIME_HASH"}
JSON
}
write_live_fixtures "$SOURCE"

cat >"$TMP/bin/kubectl" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
args="$*"
if [[ "$args" == *" get deployment/"* ]]; then cat "$FAKE_DEPLOYMENT_JSON"; exit 0; fi
if [[ "$args" == *" get pods "* ]]; then cat "$FAKE_PODS_JSON"; exit 0; fi
if [[ "$args" == *" exec runtime-0 "* && "$args" == *" curl "* ]]; then printf '{"status":"UP"}\n'; exit 0; fi
if [[ "$args" == *" psql "* ]]; then
  sql="$(cat)"
  if [[ "$sql" == *"to_regclass('public.framework_postdeploy_release_attempt')"* ]]; then
    printf '%s\n' "${FAKE_LIFECYCLE_STATE:-AVAILABLE}"
  elif [[ "$sql" == *"POSTDEPLOY_RECOVERY_SOURCE"* ]]; then
    jq -r '.sourceCommit' "$FAKE_LEDGER_JSON"
  elif [[ "$sql" == *"framework_postdeploy_evidence_candidate"* && "$sql" == *"runtimeEvidence"* ]]; then
    cat "$FAKE_CANDIDATE_JSON"
  elif [[ "$sql" == *"framework_promote_postdeploy_evidence_candidate"* ]]; then
    [[ "${FAKE_DB_MODE:-commit}" != precommit-fault ]] || exit 93
    if [[ -s "$FAKE_PROMOTION_STATE" ]]; then
      printf '{"status":"ALREADY_PROMOTED","candidateId":"%s","requestedCandidateId":"%s","requestedAttemptCandidateId":"%s","requestedAttemptStatus":"PROMOTED","sourceCommit":"%s","runtimeIdentityHash":"%s","processCount":6,"unitCount":12}\n' "$FAKE_CANDIDATE" "$FAKE_CANDIDATE" "$FAKE_CANDIDATE" "$FAKE_SOURCE" "$FAKE_RUNTIME_HASH"
    else
      printf 'PROMOTED\n' >"$FAKE_PROMOTION_STATE"
      printf '{"status":"PROMOTED","candidateId":"%s","requestedAttemptCandidateId":"%s","requestedAttemptStatus":"PROMOTED","sourceCommit":"%s","runtimeIdentityHash":"%s","processCount":6,"unitCount":12}\n' "$FAKE_CANDIDATE" "$FAKE_CANDIDATE" "$FAKE_SOURCE" "$FAKE_RUNTIME_HASH"
    fi
  elif [[ "$sql" == *"framework_postdeploy_evidence_promotion"* ]]; then
    [[ "${FAKE_AUTHORITY_MODE:-ok}" != fault ]] || exit 92
    if [[ "${FAKE_AUTHORITY_MODE:-ok}" == divergence ]]; then
      printf 'UNKNOWN\n'
    elif [[ -s "$FAKE_PROMOTION_STATE" ]]; then printf 'PROMOTED\n'; else printf 'NOT_PROMOTED\n'; fi
  elif [[ "$sql" == *"framework_runtime_release_state"* ]]; then
    cat "$FAKE_LEDGER_JSON"
  else
    exit 94
  fi
  exit 0
fi
echo "unexpected fake kubectl call: $args" >&2
exit 95
SH
chmod +x "$TMP/bin/kubectl"

cat >"$TMP/bin/mv" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
last="${!#}"
if [[ "${FAULT_MARKER_RENAME:-0}" == 1 && "$last" == "$FAULT_MARKER_PATH" && "$*" == *".candidate."* ]]; then
  exit 96
fi
exec /usr/bin/mv "$@"
SH
chmod +x "$TMP/bin/mv"

cat >"$TMP/bin/git" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "$*" == *" cat-file -e "* ]]; then exit 0; fi
if [[ "$*" == *" merge-base --is-ancestor "* ]]; then
  left="${@: -2:1}"; right="${@: -1}"
  [[ "$left" != "$FAKE_HELPER" || "$right" != "$FAKE_SOURCE" ]]
  exit
fi
exec /usr/bin/git "$@"
SH
chmod +x "$TMP/bin/git"

export FAKE_DEPLOYMENT_JSON="$TMP/deployment.json" FAKE_PODS_JSON="$TMP/pods.json"
export FAKE_CANDIDATE_JSON="$TMP/candidate.json" FAKE_LEDGER_JSON="$TMP/ledger.json"
export FAKE_PROMOTION_STATE="$TMP/promotion.state" FAKE_CANDIDATE="$CANDIDATE"
export FAKE_SOURCE="$SOURCE" FAKE_RUNTIME_HASH="$RUNTIME_HASH"
export FAKE_HELPER="$HELPER"

run_promoter() {
  local marker="$1" mode="$2" fault="$3"
  PATH="$TMP/bin:$PATH" FAKE_DB_MODE="$mode" FAULT_MARKER_RENAME="$fault" FAULT_MARKER_PATH="$marker" \
  RESONANCE_POSTGRES_LEADER_POD=postgres-0 CARBONET_K8S_NAMESPACE=test-ns \
  CARBONET_RUNTIME_LEDGER_KUBECTL_BIN="$TMP/bin/kubectl" \
  CARBONET_RUNTIME_SMOKE_EVIDENCE_DIR="$TMP/evidence" \
    bash "$PROMOTER" "$ROOT" "$CANDIDATE" "$SOURCE" "$marker"
}

# COMMIT succeeds, exact-target rename fails: DB truth/current evidence remain,
# the runtime marker stays old, and an idempotent retry reports ALREADY_PROMOTED.
RUNTIME_MARKER="$TMP/markers/runtime.commit"
printf '%s\n' "$OLD" >"$RUNTIME_MARKER"
if run_promoter "$RUNTIME_MARKER" commit 1 >"$TMP/mv-fault.log" 2>&1; then
  echo '[postdeploy-promotion-recovery-test] committed mv fault unexpectedly succeeded' >&2; exit 1
fi
[[ "$(cat "$FAKE_PROMOTION_STATE")" == PROMOTED && "$(tr -d '[:space:]' <"$RUNTIME_MARKER")" == "$OLD" ]]
PATH="$TMP/bin:$PATH" RESONANCE_POSTGRES_LEADER_POD=postgres-0 CARBONET_K8S_NAMESPACE=test-ns \
CARBONET_RUNTIME_LEDGER_KUBECTL_BIN="$TMP/bin/kubectl" \
  bash "$ROOT/ops/scripts/check-postdeploy-authoritative-promotion.sh" "$ROOT" "$SOURCE" >/dev/null
run_promoter "$RUNTIME_MARKER" commit 0 >"$TMP/retry.log"
grep -Fq ALREADY_PROMOTED "$TMP/retry.log"
[[ "$(tr -d '[:space:]' <"$RUNTIME_MARKER")" == "$SOURCE" ]]

# A promotion row whose current runtime ledger diverged is UNKNOWN, never a
# definitive rollback authorization. The migration-absent bridge preserves
# the same three-way classification for a rolling upgrade.
status=0
PATH="$TMP/bin:$PATH" FAKE_AUTHORITY_MODE=divergence RESONANCE_POSTGRES_LEADER_POD=postgres-0 \
CARBONET_K8S_NAMESPACE=test-ns CARBONET_RUNTIME_LEDGER_KUBECTL_BIN="$TMP/bin/kubectl" \
  bash "$ROOT/ops/scripts/check-postdeploy-authoritative-promotion.sh" "$ROOT" "$SOURCE" >/dev/null || status=$?
[[ "$status" == 2 ]]
PATH="$TMP/bin:$PATH" FAKE_LIFECYCLE_STATE=ABSENT RESONANCE_POSTGRES_LEADER_POD=postgres-0 \
CARBONET_K8S_NAMESPACE=test-ns CARBONET_RUNTIME_LEDGER_KUBECTL_BIN="$TMP/bin/kubectl" \
  bash "$ROOT/ops/scripts/check-postdeploy-authoritative-promotion.sh" "$ROOT" "$SOURCE" >/dev/null

# A transaction fault before COMMIT creates no promotion/current truth and
# cannot advance the marker.
rm -f "$FAKE_PROMOTION_STATE"
PRECOMMIT_MARKER="$TMP/markers/precommit.commit"
printf '%s\n' "$OLD" >"$PRECOMMIT_MARKER"
if run_promoter "$PRECOMMIT_MARKER" precommit-fault 0 >"$TMP/precommit.log" 2>&1; then
  echo '[postdeploy-promotion-recovery-test] precommit fault unexpectedly succeeded' >&2; exit 1
fi
[[ ! -e "$FAKE_PROMOTION_STATE" && "$(tr -d '[:space:]' <"$PRECOMMIT_MARKER")" == "$OLD" ]]

# Exact-target hardening rejects directory, symlink and unsafe-basename paths
# before any DB promotion can occur.
rm -f "$FAKE_PROMOTION_STATE"
mkdir "$TMP/markers/directory-target"
if run_promoter "$TMP/markers/directory-target" commit 0 >/dev/null 2>&1; then exit 1; fi
ln -s "$PRECOMMIT_MARKER" "$TMP/markers/symlink-target"
if run_promoter "$TMP/markers/symlink-target" commit 0 >/dev/null 2>&1; then exit 1; fi
mkdir -p "$TMP/markers/unsafe"
if run_promoter "$TMP/markers/unsafe/.." commit 0 >/dev/null 2>&1; then exit 1; fi
[[ ! -e "$FAKE_PROMOTION_STATE" ]]

# Execute the cleanup decision function itself with deterministic DB outcomes.
eval "$(sed -n '/^write_postdeploy_recovery_state() {$/,/^record_deploy_performance() {$/p' "$AUTO" | sed '$d')"
postdeploy_authoritative_promotion_status() { return "$AUTHORITY_STATUS"; }
invalidate_runtime_release_state() { printf 'invalidated\n' >"$TMP/invalidated"; }
target_commit="$SOURCE"
postdeploy_candidate_id="$CANDIDATE"
DEPLOY_STATE_FILE="$TMP/markers/applied.commit"
RUNTIME_DEPLOY_STATE_FILE="$TMP/markers/recovery-runtime.commit"
POSTDEPLOY_MARKER_PENDING_FILE="$TMP/marker-pending.state"
RUNTIME_LEDGER_QUARANTINE_FILE="$TMP/quarantine.state"

# Authoritative committed truth preserves ledger and records retry state even
# when both derived markers are stale.
printf '%s\n' "$OLD" >"$DEPLOY_STATE_FILE"; printf '%s\n' "$OLD" >"$RUNTIME_DEPLOY_STATE_FILE"
postdeploy_candidate_promoted=false; postdeploy_candidate_authority_unknown=false; AUTHORITY_STATUS=0
rm -f "$TMP/invalidated" "$POSTDEPLOY_MARKER_PENDING_FILE" "$RUNTIME_LEDGER_QUARANTINE_FILE"
reconcile_postdeploy_candidate_after_failure
[[ "$postdeploy_candidate_promoted" == true && ! -e "$TMP/invalidated" ]]
[[ "$(stat -c %a "$POSTDEPLOY_MARKER_PENDING_FILE")" == 600 ]]
grep -Fxq 'reason=DB_PROMOTED_MARKER_PENDING' "$POSTDEPLOY_MARKER_PENDING_FILE"

# Execute the real next-preflight recovery functions against the pending state:
# reconcile both derived markers from DB+K8s truth and disarm active.env before
# the ordinary runtime identity preflight can deadlock the retry.
eval "$(sed -n '/^write_commit_marker_exact() {$/,/^# Publish the serving release identity/p' "$AUTO" | sed '$d')"
eval "$(sed -n '/^resolve_postdeploy_postgres_pod() {$/,/^}$/p' "$AUTO")"
eval "$(sed -n '/^verify_operational_usage_ledger_current_runtime_identity() {$/,/^run_operational_usage_ledger_current_runtime_e2e_if_required() {$/p' "$AUTO" | sed '$d')"
FULL_SCREEN_GATE_STATE_DIR="$TMP/full-screen"
mkdir -p "$FULL_SCREEN_GATE_STATE_DIR/snapshots/fixture"
chmod 0700 "$FULL_SCREEN_GATE_STATE_DIR"
cat >"$FULL_SCREEN_GATE_STATE_DIR/active.env" <<EOF
SNAPSHOT_ID='fixture'
SNAPSHOT_DIR='$FULL_SCREEN_GATE_STATE_DIR/snapshots/fixture'
SNAPSHOT_FORMAT='hardlink-tree'
RUNTIME_IMAGE='$IMAGE_REF'
WEB_IMAGE='web:fixture'
GIT_SHA='$OLD'
BASELINE_SOURCE_COMMIT='$OLD'
EOF
chmod 0600 "$FULL_SCREEN_GATE_STATE_DIR/active.env"
export FULL_SCREEN_GATE_STATE_DIR
ROOT_DIR="$ROOT"; export ROOT_DIR
NAMESPACE=test-ns; DEPLOYMENT=carbonet-runtime; POSTGRES_POD=postgres-0; POSTGRES_CONTAINER=patroni
POSTGRES_USER=postgres; POSTGRES_DB=carbonet
runtime_marker_bootstrap_allowed=false; runtime_deployed_commit="$OLD"; deployed_commit="$OLD"
eval "$(sed -n '/^recover_authoritative_postdeploy_marker_pending() {$/,/^run_operational_usage_ledger_current_runtime_e2e_if_required() {$/p' "$AUTO" | sed '$d')"
target_commit="$HELPER"
PATH="$TMP/bin:$PATH" recover_authoritative_postdeploy_marker_pending >/dev/null
[[ "$(tr -d '[:space:]' <"$DEPLOY_STATE_FILE")" == "$SOURCE" ]]
[[ "$(tr -d '[:space:]' <"$RUNTIME_DEPLOY_STATE_FILE")" == "$SOURCE" ]]
[[ "$postdeploy_recovered_commit" == "$SOURCE" && "$target_commit" == "$HELPER" ]]
[[ ! -e "$POSTDEPLOY_MARKER_PENDING_FILE" && ! -e "$FULL_SCREEN_GATE_STATE_DIR/active.env" ]]

# Promoted A followed immediately by remote helper-only B: live A is recovered
# from DB+K8s, the overall applied B descendant is preserved, and active/pending
# are not required.  The caller can therefore plan B..next without conflating B
# with the serving runtime identity.
printf '%s\n' "$HELPER" >"$DEPLOY_STATE_FILE"; printf '%s\n' "$OLD" >"$RUNTIME_DEPLOY_STATE_FILE"
deployed_commit="$HELPER"; runtime_deployed_commit="$OLD"
rm -f "$POSTDEPLOY_MARKER_PENDING_FILE" "$FULL_SCREEN_GATE_STATE_DIR/active.env"
PATH="$TMP/bin:$PATH" recover_authoritative_postdeploy_marker_pending >/dev/null
[[ "$(tr -d '[:space:]' <"$DEPLOY_STATE_FILE")" == "$HELPER" ]]
[[ "$(tr -d '[:space:]' <"$RUNTIME_DEPLOY_STATE_FILE")" == "$SOURCE" ]]
[[ "$postdeploy_recovered_commit" == "$HELPER" && "$runtime_deployed_commit" == "$SOURCE" ]]

# Crash-window proof: even with no pending file (SIGKILL immediately after DB
# COMMIT and after snapshot disarm), the same early preflight recovers without
# requiring active/pending, but only after DB authority and live identity bind A.
printf '%s\n' "$OLD" >"$DEPLOY_STATE_FILE"; printf '%s\n' "$OLD" >"$RUNTIME_DEPLOY_STATE_FILE"
deployed_commit="$OLD"; runtime_deployed_commit="$OLD"
rm -f "$POSTDEPLOY_MARKER_PENDING_FILE" "$FULL_SCREEN_GATE_STATE_DIR/active.env"
PATH="$TMP/bin:$PATH" recover_authoritative_postdeploy_marker_pending >/dev/null
[[ "$(tr -d '[:space:]' <"$DEPLOY_STATE_FILE")" == "$SOURCE" ]]
[[ "$(tr -d '[:space:]' <"$RUNTIME_DEPLOY_STATE_FILE")" == "$SOURCE" ]]
[[ "$postdeploy_recovered_commit" == "$SOURCE" && "$target_commit" == "$HELPER" ]]
[[ ! -e "$FULL_SCREEN_GATE_STATE_DIR/active.env" ]]

# With no committed promotion, the probe returns 1 so the ordinary deployment
# path continues; it must not touch markers or consume the rollback snapshot.
printf '%s\n' "$OLD" >"$DEPLOY_STATE_FILE"; printf '%s\n' "$OLD" >"$RUNTIME_DEPLOY_STATE_FILE"
printf 'SNAPSHOT_ID=normal-path\n' >"$FULL_SCREEN_GATE_STATE_DIR/active.env"
AUTHORITY_STATUS=1
status=0; PATH="$TMP/bin:$PATH" recover_authoritative_postdeploy_marker_pending >/dev/null || status=$?
[[ "$status" == 1 && "$(tr -d '[:space:]' <"$DEPLOY_STATE_FILE")" == "$OLD" ]]
[[ "$(tr -d '[:space:]' <"$RUNTIME_DEPLOY_STATE_FILE")" == "$OLD" && -s "$FULL_SCREEN_GATE_STATE_DIR/active.env" ]]
rm -f "$FULL_SCREEN_GATE_STATE_DIR/active.env"
AUTHORITY_STATUS=2

# Definitive non-promotion is the only branch allowed to invalidate.
postdeploy_candidate_promoted=false; postdeploy_candidate_authority_unknown=false; AUTHORITY_STATUS=1
rm -f "$TMP/invalidated" "$POSTDEPLOY_MARKER_PENDING_FILE" "$RUNTIME_LEDGER_QUARANTINE_FILE"
reconcile_postdeploy_candidate_after_failure
[[ -s "$TMP/invalidated" && ! -e "$RUNTIME_LEDGER_QUARANTINE_FILE" ]]

# DB-check failure quarantines mode 0600 and ignores even matching markers.
printf '%s\n' "$SOURCE" >"$DEPLOY_STATE_FILE"; printf '%s\n' "$SOURCE" >"$RUNTIME_DEPLOY_STATE_FILE"
postdeploy_candidate_promoted=false; postdeploy_candidate_authority_unknown=false; AUTHORITY_STATUS=2
rm -f "$TMP/invalidated" "$POSTDEPLOY_MARKER_PENDING_FILE" "$RUNTIME_LEDGER_QUARANTINE_FILE"
status=0; reconcile_postdeploy_candidate_after_failure || status=$?
[[ "$status" == 79 && "$postdeploy_candidate_promoted" == false && ! -e "$TMP/invalidated" ]]
[[ "$(stat -c %a "$RUNTIME_LEDGER_QUARANTINE_FILE")" == 600 ]]
grep -Fxq 'reason=PROMOTION_DB_CHECK_UNAVAILABLE' "$RUNTIME_LEDGER_QUARANTINE_FILE"

# Execute the actual identity verifier: an overall helper commit cannot affect
# the serving identity, while runtime-marker or DB-ledger drift is fail-closed.
DEPLOY_STATE_FILE="$TMP/markers/helper-applied.commit"
RUNTIME_DEPLOY_STATE_FILE="$TMP/markers/identity-runtime.commit"
NAMESPACE=test-ns; DEPLOYMENT=carbonet-runtime; POSTGRES_POD=postgres-0; POSTGRES_CONTAINER=patroni
POSTGRES_USER=postgres; POSTGRES_DB=carbonet
runtime_marker_bootstrap_allowed=false; runtime_deployed_commit="$SOURCE"
printf '%s\n' "$HELPER" >"$DEPLOY_STATE_FILE"; printf '%s\n' "$SOURCE" >"$RUNTIME_DEPLOY_STATE_FILE"
PATH="$TMP/bin:$PATH" verify_operational_usage_ledger_current_runtime_identity "$runtime_deployed_commit" >/dev/null
printf '%s\n' "$OLD" >"$RUNTIME_DEPLOY_STATE_FILE"
if PATH="$TMP/bin:$PATH" verify_operational_usage_ledger_current_runtime_identity "$SOURCE" >/dev/null 2>&1; then
  echo '[postdeploy-promotion-recovery-test] runtime marker drift survived' >&2; exit 1
fi
printf '%s\n' "$SOURCE" >"$RUNTIME_DEPLOY_STATE_FILE"
write_live_fixtures "$SOURCE"
jq --arg commit "$OLD" '.sourceCommit=$commit' "$TMP/ledger.json" >"$TMP/ledger-drift.json"
/usr/bin/mv -fT -- "$TMP/ledger-drift.json" "$TMP/ledger.json"
if PATH="$TMP/bin:$PATH" verify_operational_usage_ledger_current_runtime_identity "$SOURCE" >/dev/null 2>&1; then
  echo '[postdeploy-promotion-recovery-test] runtime ledger drift survived' >&2; exit 1
fi
write_live_fixtures "$SOURCE"
rm -f "$RUNTIME_DEPLOY_STATE_FILE"
runtime_marker_bootstrap_allowed=true; runtime_deployed_commit=""
PATH="$TMP/bin:$PATH" verify_operational_usage_ledger_current_runtime_identity "" >/dev/null
[[ "$runtime_deployed_commit" == "$SOURCE" && "$(tr -d '[:space:]' <"$RUNTIME_DEPLOY_STATE_FILE")" == "$SOURCE" ]]

printf '[postdeploy-promotion-recovery-test] PASS committedMvFault=preserve+old-marker retry=ALREADY_PROMOTED+reconcile precommit=current0+invalidate dbCheckFault=quarantine0600+no-marker-inference exactTarget=directory+symlink+unsafe-path nextPreflight=pending-or-nohint-orphan+DB+K8s+markers-reconciled+active-disarmed remoteRace=A-promoted-B-helper-preserved runtimeSeparation=helper-build0-next-runtime-pass+drift-fail bootstrap=DB+K8s\n'
