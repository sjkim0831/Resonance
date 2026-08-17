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

SOURCE="76a08e672ab7054914ec3b5aecb57bc8e7a298fa"
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
  local commit="$1" template_hash
  cat >"$TMP/deployment.json" <<JSON
{"metadata":{"namespace":"test-ns","name":"carbonet-runtime","uid":"runtime-uid","generation":7,"annotations":{"resonance.ai/target-commit":"$commit"}},"spec":{"replicas":1,"selector":{"matchLabels":{"app":"carbonet-runtime"}},"template":{"spec":{"containers":[{"name":"carbonet-runtime","image":"$IMAGE_REF"}]}}},"status":{"observedGeneration":7,"updatedReplicas":1,"readyReplicas":1,"availableReplicas":1,"unavailableReplicas":0}}
JSON
  template_hash="$(jq -cS '.spec.template' "$TMP/deployment.json" | sha256sum | awk '{print $1}')"
  jq --arg hash "$template_hash" \
    '.metadata.annotations["resonance.ai/runtime-template-sha256"]=$hash' \
    "$TMP/deployment.json" >"$TMP/deployment-annotated.json"
  /usr/bin/mv -fT -- "$TMP/deployment-annotated.json" "$TMP/deployment.json"
  cat >"$TMP/pods.json" <<JSON
{"items":[{"metadata":{"name":"runtime-0"},"spec":{"containers":[{"name":"carbonet-runtime","image":"$IMAGE_REF"}]},"status":{"phase":"Running","conditions":[{"type":"Ready","status":"True"}],"containerStatuses":[{"name":"carbonet-runtime","ready":true,"imageID":"$IMAGE_ID"}]}}]}
JSON
  cat >"$TMP/ledger.json" <<JSON
  {"releaseKey":"CARBONET_RUNTIME","sourceCommit":"$commit","deploymentNamespace":"test-ns","deploymentName":"carbonet-runtime","deploymentUid":"runtime-uid","deploymentGeneration":7,"observedGeneration":7,"desiredReplicas":1,"imageRef":"$IMAGE_REF","imageId":"$IMAGE_ID","podTemplateSha256":"$template_hash","healthStatus":"UP","runtimeIdentityHash":"$RUNTIME_HASH"}
JSON
}
write_live_fixtures "$SOURCE"
FIXTURE_TEMPLATE_HASH="$(jq -r '.metadata.annotations["resonance.ai/runtime-template-sha256"]' "$TMP/deployment.json")"

cat >"$TMP/bin/kubectl" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
args="$*"
if [[ "$args" == *" get deployment/"* ]]; then
  if [[ "${FAKE_TEMPLATE_BOOTSTRAP_LAG:-false}" == true ]]; then
    count="$(( $(cat "$FAKE_TEMPLATE_BOOTSTRAP_GET_COUNT" 2>/dev/null || printf 0) + 1 ))"
    printf '%s\n' "$count" >"$FAKE_TEMPLATE_BOOTSTRAP_GET_COUNT"
    if (( count >= ${FAKE_TEMPLATE_BOOTSTRAP_READY_AFTER:-3} )) \
       && jq -e '.metadata.annotations["resonance.ai/runtime-template-sha256"]' "$FAKE_DEPLOYMENT_JSON" >/dev/null; then
      jq '.status.observedGeneration=.metadata.generation' "$FAKE_DEPLOYMENT_JSON" >"${FAKE_DEPLOYMENT_JSON}.ready"
      /usr/bin/mv -fT -- "${FAKE_DEPLOYMENT_JSON}.ready" "$FAKE_DEPLOYMENT_JSON"
    fi
  fi
  cat "$FAKE_DEPLOYMENT_JSON"; exit 0
fi
if [[ "$args" == *" annotate deployment/"* && "$args" == *"resonance.ai/runtime-template-sha256="* ]]; then
  hash=""
  for arg in "$@"; do
    case "$arg" in resonance.ai/runtime-template-sha256=*) hash="${arg#*=}" ;; esac
  done
  [[ "$hash" =~ ^[0-9a-f]{64}$ ]] || exit 96
  jq --arg hash "$hash" '.metadata.annotations["resonance.ai/runtime-template-sha256"]=$hash' \
    "$FAKE_DEPLOYMENT_JSON" >"${FAKE_DEPLOYMENT_JSON}.annotated"
  /usr/bin/mv -fT -- "${FAKE_DEPLOYMENT_JSON}.annotated" "$FAKE_DEPLOYMENT_JSON"
  if [[ "${FAKE_TEMPLATE_BOOTSTRAP_LAG:-false}" == true ]]; then
    jq '.metadata.resourceVersion="rv-template-bootstrap" | .metadata.generation+=1' \
      "$FAKE_DEPLOYMENT_JSON" >"${FAKE_DEPLOYMENT_JSON}.lag"
    /usr/bin/mv -fT -- "${FAKE_DEPLOYMENT_JSON}.lag" "$FAKE_DEPLOYMENT_JSON"
  fi
  cat "$FAKE_DEPLOYMENT_JSON"
  exit 0
fi
if [[ "$args" == *" get pods "* ]]; then cat "$FAKE_PODS_JSON"; exit 0; fi
if [[ "$args" == *" exec runtime-"* && "$args" == *" curl "* ]]; then
  [[ "${FAKE_RUNTIME_HEALTH:-up}" == up ]] || exit 28
  printf '{"status":"UP"}\n'; exit 0
fi
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

# The governed finalizer asks the real promoter to commit DB truth while
# deliberately retaining the old runtime marker for the post-COMMIT verifier.
DEFERRED_MARKER="$TMP/markers/deferred.commit"
printf '%s\n' "$OLD" >"$DEFERRED_MARKER"
CARBONET_POSTDEPLOY_DEFER_MARKER_UNTIL_FINAL_VERIFY=true \
  run_promoter "$DEFERRED_MARKER" commit 0 >"$TMP/deferred.log"
[[ "$(cat "$FAKE_PROMOTION_STATE")" == PROMOTED \
   && "$(tr -d '[:space:]' <"$DEFERRED_MARKER")" == "$OLD" ]]
grep -Fq 'marker=DEFERRED_UNTIL_FINAL_LIVE_VERIFY' "$TMP/deferred.log"
rm -f "$FAKE_PROMOTION_STATE"

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
eval "$(sed -n '/^verify_operational_usage_ledger_current_runtime_identity() {$/,/^run_operational_usage_ledger_current_runtime_e2e_if_required() {$/p' "$AUTO" | sed '$d' | sed "s/3714b172fe60eed5d07658103aa5f51d6f9ef765f2cee2bd0ba304e71bfd9c1a/$FIXTURE_TEMPLATE_HASH/g")"
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
# The old installation has no template annotation. Exact legacy proof permits
# one strict bootstrap, then every subsequent verification is hash-bound.
jq 'del(.metadata.annotations["resonance.ai/runtime-template-sha256"]) |
    .spec.template.spec.containers[0].env=[{"name":"UNPINNED","value":"1"}]' \
  "$TMP/deployment.json" >"$TMP/deployment-unpinned.json"
/usr/bin/mv -fT -- "$TMP/deployment-unpinned.json" "$TMP/deployment.json"
if PATH="$TMP/bin:$PATH" verify_operational_usage_ledger_current_runtime_identity \
    "$runtime_deployed_commit" >"$TMP/unpinned-template.log" 2>&1; then
  echo '[postdeploy-promotion-recovery-test] unpinned legacy template self-signed' >&2; exit 1
fi
grep -Fq 'reason=TEMPLATE_MISMATCH' "$TMP/unpinned-template.log"
jq -e '.metadata.annotations["resonance.ai/runtime-template-sha256"] == null' \
  "$TMP/deployment.json" >/dev/null
write_live_fixtures "$SOURCE"
jq 'del(.metadata.annotations["resonance.ai/runtime-template-sha256"])' \
  "$TMP/deployment.json" >"$TMP/deployment-no-template-hash.json"
/usr/bin/mv -fT -- "$TMP/deployment-no-template-hash.json" "$TMP/deployment.json"
jq '.podTemplateSha256=null' "$TMP/ledger.json" >"$TMP/ledger-pre-migration.json"
/usr/bin/mv -fT -- "$TMP/ledger-pre-migration.json" "$TMP/ledger.json"
rm -f "$TMP/template-bootstrap-get-count"
FAKE_TEMPLATE_BOOTSTRAP_LAG=true \
FAKE_TEMPLATE_BOOTSTRAP_GET_COUNT="$TMP/template-bootstrap-get-count" \
PATH="$TMP/bin:$PATH" verify_operational_usage_ledger_current_runtime_identity \
  "$runtime_deployed_commit" >"$TMP/template-bootstrap.log"
grep -Fq 'WAIT runtime template bootstrap convergence attempt=1' "$TMP/template-bootstrap.log"
jq -e '.metadata.annotations["resonance.ai/runtime-template-sha256"]|test("^[0-9a-f]{64}$")' \
  "$TMP/deployment.json" >/dev/null
grep -Fq "legacy_template_bootstrap_commit='76a08e672ab7054914ec3b5aecb57bc8e7a298fa'" "$AUTO"
grep -Fq "legacy_template_bootstrap_hash='3714b172fe60eed5d07658103aa5f51d6f9ef765f2cee2bd0ba304e71bfd9c1a'" "$AUTO"
python3 - "$AUTO" <<'PY'
from pathlib import Path
import sys
text=Path(sys.argv[1]).read_text()
preflight=text.index('# Capture the last known-good runtime')
verify=text.index('verify_operational_usage_ledger_current_runtime_identity "$runtime_deployed_commit"', preflight)
arm=text.index('initialize_postdeploy_attempt_journal', verify)
assert verify < arm, 'legacy template bootstrap moved after durable attempt arm'
PY
# HPA changes mutable replica/generation coordinates without changing the
# serving release. The immutable UID/image tuple remains authoritative.
ledger_attestation_hash="$(sha256sum "$TMP/ledger.json" | awk '{print $1}')"
jq '.metadata.generation=9 | .spec.replicas=2 | .status.observedGeneration=9 |
    .status.updatedReplicas=2 | .status.readyReplicas=2 | .status.availableReplicas=2' \
  "$TMP/deployment.json" >"$TMP/deployment-scaled.json"
/usr/bin/mv -fT -- "$TMP/deployment-scaled.json" "$TMP/deployment.json"
jq '.items += [(.items[0] | .metadata.name="runtime-1")]' \
  "$TMP/pods.json" >"$TMP/pods-scaled.json"
/usr/bin/mv -fT -- "$TMP/pods-scaled.json" "$TMP/pods.json"
PATH="$TMP/bin:$PATH" verify_operational_usage_ledger_current_runtime_identity "$runtime_deployed_commit" >/dev/null
[[ "$(sha256sum "$TMP/ledger.json" | awk '{print $1}')" == "$ledger_attestation_hash" ]]
# Scale-down is equally read-only and keeps the DB release-attestation hash.
jq '.metadata.generation=10 | .spec.replicas=1 | .status.observedGeneration=10 |
    .status.updatedReplicas=1 | .status.readyReplicas=1 | .status.availableReplicas=1' \
  "$TMP/deployment.json" >"$TMP/deployment-scaled-down.json"
/usr/bin/mv -fT -- "$TMP/deployment-scaled-down.json" "$TMP/deployment.json"
jq '.items=[.items[0]]' "$TMP/pods.json" >"$TMP/pods-scaled-down.json"
/usr/bin/mv -fT -- "$TMP/pods-scaled-down.json" "$TMP/pods.json"
PATH="$TMP/bin:$PATH" verify_operational_usage_ledger_current_runtime_identity "$runtime_deployed_commit" >/dev/null
[[ "$(sha256sum "$TMP/ledger.json" | awk '{print $1}')" == "$ledger_attestation_hash" ]]
# A same-image template change is not autoscaling and remains fail-closed.
jq '.metadata.generation=11 | .status.observedGeneration=11 |
    .spec.template.spec.containers[0].env=[{"name":"UNAUTHORIZED_DRIFT","value":"1"}]' \
  "$TMP/deployment.json" >"$TMP/deployment-template-drift.json"
/usr/bin/mv -fT -- "$TMP/deployment-template-drift.json" "$TMP/deployment.json"
if PATH="$TMP/bin:$PATH" verify_operational_usage_ledger_current_runtime_identity "$SOURCE" \
    >"$TMP/template-drift.log" 2>&1; then
  echo '[postdeploy-promotion-recovery-test] same-image template drift survived' >&2; exit 1
fi
grep -Fq 'reason=TEMPLATE_MISMATCH' "$TMP/template-drift.log"
write_live_fixtures "$SOURCE"
# Mutating the template and its mutable Deployment annotation together still
# cannot override the external DB release attestation.
jq '.spec.template.spec.containers[0].env=[{"name":"COUPLED_DRIFT","value":"1"}]' \
  "$TMP/deployment.json" >"$TMP/deployment-coupled-drift.json"
coupled_hash="$(jq -cS '.spec.template' "$TMP/deployment-coupled-drift.json" | sha256sum | awk '{print $1}')"
jq --arg hash "$coupled_hash" '.metadata.annotations["resonance.ai/runtime-template-sha256"]=$hash' \
  "$TMP/deployment-coupled-drift.json" >"$TMP/deployment.json"
if PATH="$TMP/bin:$PATH" verify_operational_usage_ledger_current_runtime_identity "$SOURCE" \
    >"$TMP/coupled-template-drift.log" 2>&1; then
  echo '[postdeploy-promotion-recovery-test] coupled template+annotation drift survived' >&2; exit 1
fi
grep -Fq 'reason=TEMPLATE_MISMATCH' "$TMP/coupled-template-drift.log"
write_live_fixtures "$SOURCE"
# A ledger that claims a future generation is contradictory, not autoscaling.
jq '.deploymentGeneration=99 | .observedGeneration=99' \
  "$TMP/ledger.json" >"$TMP/ledger-future.json"
/usr/bin/mv -fT -- "$TMP/ledger-future.json" "$TMP/ledger.json"
if PATH="$TMP/bin:$PATH" verify_operational_usage_ledger_current_runtime_identity "$SOURCE" \
    >"$TMP/future-coordinate.log" 2>&1; then
  echo '[postdeploy-promotion-recovery-test] future ledger coordinate survived' >&2; exit 1
fi
grep -Fq 'reason=COORDINATE_CONTRADICTION' "$TMP/future-coordinate.log"
write_live_fixtures "$SOURCE"
# Health/readiness loss is explicitly transient and never mislabeled as an
# immutable digest contradiction.
if FAKE_RUNTIME_HEALTH=down PATH="$TMP/bin:$PATH" \
    verify_operational_usage_ledger_current_runtime_identity "$SOURCE" \
    >"$TMP/readiness-transient.log" 2>&1; then
  echo '[postdeploy-promotion-recovery-test] unhealthy runtime survived' >&2; exit 1
fi
grep -Fq 'reason=READINESS_TRANSIENT' "$TMP/readiness-transient.log"
# Immutable digest drift remains fail-closed even when rollout coordinates are
# otherwise healthy.
jq '.imageId="sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"' \
  "$TMP/ledger.json" >"$TMP/ledger-image-drift.json"
/usr/bin/mv -fT -- "$TMP/ledger-image-drift.json" "$TMP/ledger.json"
if PATH="$TMP/bin:$PATH" verify_operational_usage_ledger_current_runtime_identity "$SOURCE" >/dev/null 2>&1; then
  echo '[postdeploy-promotion-recovery-test] immutable image digest drift survived' >&2; exit 1
fi
write_live_fixtures "$SOURCE"
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

# Execute the real normal-promotion finalizer with a post-COMMIT live drift.
# The deferred promoter must not publish a marker; synchronous compensation
# removes the singleton, persists recovery/quarantine, and returns the existing
# marker-recovery status 75 without disarming the rollback snapshot.
eval "$(sed -n '/^finalize_postdeploy_candidate_release() {$/,/^launch_composite_autocompletion_postdeploy_campaign() {$/p' "$AUTO" | sed '$d')"
FINALIZER_TRACE="$TMP/finalizer-drift.trace"
: >"$FINALIZER_TRACE"
record_runtime_release_state() { printf 'record\n' >>"$FINALIZER_TRACE"; }
run_operational_usage_ledger_live_e2e_if_required() { printf 'usage\n' >>"$FINALIZER_TRACE"; }
verify_postdeploy_candidate_staged() { printf 'staged\n' >>"$FINALIZER_TRACE"; }
bash() {
  [[ "$*" == *promote-postdeploy-candidate-evidence.sh* ]] || return 98
  [[ "${CARBONET_POSTDEPLOY_DEFER_MARKER_UNTIL_FINAL_VERIFY:-}" == true ]] || return 97
  printf 'promoter-deferred\n' >>"$FINALIZER_TRACE"
}
postdeploy_authoritative_promotion_status() {
  POSTDEPLOY_AUTHORITY_OUTCOME=PROMOTED_EXACT
  printf 'authority\n' >>"$FINALIZER_TRACE"
  return 0
}
current_runtime_identity_hash() { printf '%s\n' "$RUNTIME_HASH"; printf 'hash\n' >>"$FINALIZER_TRACE"; }
transition_postdeploy_attempt_journal() { printf 'journal-promoted\n' >>"$FINALIZER_TRACE"; }
verify_operational_usage_ledger_current_runtime_identity() { printf 'final-live-drift\n' >>"$FINALIZER_TRACE"; return 1; }
invalidate_runtime_release_state() {
  printf 'ledger-count0\n' >>"$FINALIZER_TRACE"
  printf 'count=0\n' >"$TMP/finalizer-ledger-invalidated"
  [[ "${FINALIZER_KILL_POINT:-}" != after-ledger-delete ]] || kill -KILL "$BASHPID"
}
write_postdeploy_marker_pending() {
  printf 'pending\n' >>"$FINALIZER_TRACE"
  printf 'schemaVersion=1\ntargetCommit=%s\ncandidateId=%s\nreason=%s\nobservedAppliedMarker=%s\nobservedRuntimeMarker=%s\n' \
    "$target_commit" "$postdeploy_candidate_id" "$1" "$OLD" "$OLD" >"$POSTDEPLOY_MARKER_PENDING_FILE"
  chmod 0600 "$POSTDEPLOY_MARKER_PENDING_FILE"
  [[ "${FINALIZER_KILL_POINT:-}" != after-pending-rename ]] || kill -KILL "$BASHPID"
}
write_postdeploy_promotion_quarantine() {
  printf 'quarantine\n' >>"$FINALIZER_TRACE"
  printf 'schemaVersion=1\ntargetCommit=%s\ncandidateId=%s\nreason=%s\nobservedAppliedMarker=%s\nobservedRuntimeMarker=%s\n' \
    "$target_commit" "$postdeploy_candidate_id" "$1" "$OLD" "$OLD" >"$RUNTIME_LEDGER_QUARANTINE_FILE"
  chmod 0600 "$RUNTIME_LEDGER_QUARANTINE_FILE"
  [[ "${FINALIZER_KILL_POINT:-}" != after-quarantine-rename ]] || kill -KILL "$BASHPID"
}
mkdir -p "$FULL_SCREEN_GATE_STATE_DIR"
printf 'SNAPSHOT_ID=finalizer-drift\n' >"$FULL_SCREEN_GATE_STATE_DIR/active.env"
printf '%s\n' "$OLD" >"$RUNTIME_DEPLOY_STATE_FILE"
printf '%s\n' "$OLD" >"$DEPLOY_STATE_FILE"
rm -f "$POSTDEPLOY_MARKER_PENDING_FILE" "$RUNTIME_LEDGER_QUARANTINE_FILE" \
  "$TMP/finalizer-ledger-invalidated"
postdeploy_candidate_promoted=false; postdeploy_candidate_authority_unknown=false
runtime_candidate_checkpoint_eligible=false; live_frontend_overlay="$TMP/evidence"
target_commit="$SOURCE"; postdeploy_candidate_id="$CANDIDATE"
status=0
finalize_postdeploy_candidate_release >"$TMP/finalizer-drift.log" 2>&1 || status=$?
[[ "$status" == 75 && "$postdeploy_candidate_promoted" == true ]]
[[ -s "$TMP/finalizer-ledger-invalidated" \
   && "$(stat -c %a "$POSTDEPLOY_MARKER_PENDING_FILE")" == 600 \
   && "$(stat -c %a "$RUNTIME_LEDGER_QUARANTINE_FILE")" == 600 ]]
[[ -s "$FULL_SCREEN_GATE_STATE_DIR/active.env" \
   && "$(tr -d '[:space:]' <"$RUNTIME_DEPLOY_STATE_FILE")" == "$OLD" \
   && "$(tr -d '[:space:]' <"$DEPLOY_STATE_FILE")" == "$OLD" ]]
python3 - "$FINALIZER_TRACE" <<'PY'
from pathlib import Path
import sys
events=Path(sys.argv[1]).read_text().splitlines()
expected=['record','usage','staged','promoter-deferred','authority','hash',
          'journal-promoted','final-live-drift','ledger-count0','pending','quarantine']
assert events == expected, events
PY
grep -Fq 'RECOVERY_PENDING DB promotion committed' "$TMP/finalizer-drift.log"

# Execute the dedicated ledger-absent PROMOTED self-heal. Only an exact DB
# promotion/attempt/12-unit hash and stable live reproof may republish the
# singleton; persistent mismatch performs zero writes and remains status 75.
eval "$(sed -n '/^recover_promoted_final_live_verify_pending() {$/,/^# A DB COMMIT can outlive/p' "$AUTO" | sed '$d')"
eval "$(sed -n '/^recover_persistent_postdeploy_attempt() {$/,/^archive_recovered_promoted_attempt_journal() {$/p' "$AUTO" | sed '$d')"
RECOVERY_JOURNAL="$(jq -cn --arg candidate "$CANDIDATE" --arg source "$SOURCE" \
  --arg hash "$RUNTIME_HASH" '{lifecycleStatus:"PROMOTED",terminalReason:"PROMOTION_COMMITTED",
    candidateId:$candidate,sourceCommit:$source,baseCommit:"0000000000000000000000000000000000000000",
    runtimeIdentityHash:$hash,dbAttemptStaged:true,
    rollback:{snapshotId:"normal-commit-crash",snapshotManifestSha256:
      "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"}}')"
promoted_candidate_identity_with_ledger_absent() {
  if [[ "${RECOVERY_DB_MODE:-ledger-absent}" == ledger-present ]]; then
    printf 'normal-ledger-present\n' >>"$FINALIZER_TRACE"
    return 1
  fi
  printf 'db-promotion-ledger0\n' >>"$FINALIZER_TRACE"; printf '%s\n' "$RUNTIME_HASH"
}
verify_promoted_live_identity_without_runtime_ledger() {
  printf 'live-ledgerless-proof\n' >>"$FINALIZER_TRACE"
  [[ "${RECOVERY_LIVE_MODE:-exact}" == exact ]] || return 1
  POSTDEPLOY_RECOVERY_VERIFIED_TEMPLATE_SHA256="$FIXTURE_TEMPLATE_HASH"
}
record_runtime_release_state() { printf 'ledger-republished\n' >>"$FINALIZER_TRACE"; }
postdeploy_authoritative_promotion_status() {
  if [[ "${NORMAL_COMMIT_RECOVERY:-false}" == true ]]; then
    printf 'normal-authority\n' >>"$FINALIZER_TRACE"
  else
    printf 'authority-restored\n' >>"$FINALIZER_TRACE"
  fi
}
verify_operational_usage_ledger_current_runtime_identity() {
  if [[ -n "${FINALIZER_KILL_POINT:-}" ]]; then
    printf 'final-live-drift\n' >>"$FINALIZER_TRACE"
    return 1
  fi
  if [[ "${NORMAL_COMMIT_RECOVERY:-false}" == true ]]; then
    printf 'normal-full-proof\n' >>"$FINALIZER_TRACE"
    return 0
  fi
  printf 'full-proof-restored\n' >>"$FINALIZER_TRACE"
}

# A normal DB COMMIT/marker crash has a PROMOTED journal and exact current
# ledger. With no secondary file, or with either ordinary runtime/applied
# marker-pending reason, it must fall through the optional ledgerless branch
# into the pre-existing authority/disarm recovery path.
(
  POSTDEPLOY_ATTEMPT_JOURNAL_FILE="$TMP/normal-promoted-attempt.json"
  POSTDEPLOY_JOURNAL_HELPER=fixture-journal-helper
  POSTDEPLOY_GATE_SCRIPT=fixture-full-screen-gate
  live_frontend_overlay="$TMP/evidence"
  postdeploy_candidate_id=outer-candidate
  target_commit="$HELPER"
  deployed_commit="$OLD"
  printf '%s\n' "$RECOVERY_JOURNAL" >"$POSTDEPLOY_ATTEMPT_JOURNAL_FILE"
  python3() { printf '%s\n' "$RECOVERY_JOURNAL"; }
  bash() { printf 'normal-snapshot-disarm\n' >>"$FINALIZER_TRACE"; }
  for pending_case in none DB_PROMOTED_RUNTIME_MARKER_PENDING DB_PROMOTED_APPLIED_MARKER_PENDING; do
    rm -f "$POSTDEPLOY_MARKER_PENDING_FILE" "$RUNTIME_LEDGER_QUARANTINE_FILE"
    if [[ "$pending_case" != none ]]; then
      printf 'schemaVersion=1\ntargetCommit=%s\ncandidateId=%s\nreason=%s\nobservedAppliedMarker=%s\nobservedRuntimeMarker=%s\n' \
        "$SOURCE" "$CANDIDATE" "$pending_case" "$OLD" "$OLD" \
        >"$POSTDEPLOY_MARKER_PENDING_FILE"
      chmod 0600 "$POSTDEPLOY_MARKER_PENDING_FILE"
      expected_normal_trace=$'normal-authority\nnormal-full-proof\nnormal-snapshot-disarm'
    else
      expected_normal_trace=$'normal-ledger-present\nnormal-authority\nnormal-full-proof\nnormal-snapshot-disarm'
    fi
    : >"$FINALIZER_TRACE"
    status=0
    RECOVERY_DB_MODE=ledger-present NORMAL_COMMIT_RECOVERY=true \
      recover_persistent_postdeploy_attempt || status=$?
    [[ "$status" == 2 \
       && ! -e "$RUNTIME_LEDGER_QUARANTINE_FILE" \
       && "$(cat "$FINALIZER_TRACE")" == "$expected_normal_trace" ]]
    if [[ "$pending_case" == none ]]; then
      [[ ! -e "$POSTDEPLOY_MARKER_PENDING_FILE" ]]
    else
      [[ "$(sed -n 's/^reason=//p' "$POSTDEPLOY_MARKER_PENDING_FILE")" == "$pending_case" ]]
    fi
  done
)

# Inject an actual SIGKILL at every non-atomic boundary after the immutable DB
# promotion journal is durable. Recovery must use that journal plus the exact
# promotion/attempt/12-unit DB join, reconstruct missing secondary files, and
# keep the ledger absent/snapshot armed/markers untouched while live is stale.
for kill_point in after-ledger-delete after-pending-rename after-quarantine-rename; do
  : >"$FINALIZER_TRACE"
  printf 'SNAPSHOT_ID=%s\n' "$kill_point" >"$FULL_SCREEN_GATE_STATE_DIR/active.env"
  printf '%s\n' "$OLD" >"$RUNTIME_DEPLOY_STATE_FILE"
  printf '%s\n' "$OLD" >"$DEPLOY_STATE_FILE"
  rm -f "$POSTDEPLOY_MARKER_PENDING_FILE" "$RUNTIME_LEDGER_QUARANTINE_FILE" \
    "$TMP/finalizer-ledger-invalidated"
  status=0
  ( FINALIZER_KILL_POINT="$kill_point" finalize_postdeploy_candidate_release ) \
    >"$TMP/${kill_point}.log" 2>&1 || status=$?
  [[ "$status" == 137 && -s "$TMP/finalizer-ledger-invalidated" ]]
  case "$kill_point" in
    after-ledger-delete)
      [[ ! -e "$POSTDEPLOY_MARKER_PENDING_FILE" \
         && ! -e "$RUNTIME_LEDGER_QUARANTINE_FILE" ]]
      expected_recovery_trace=$'db-promotion-ledger0\npending\nquarantine\nlive-ledgerless-proof'
      ;;
    after-pending-rename)
      [[ -s "$POSTDEPLOY_MARKER_PENDING_FILE" \
         && ! -e "$RUNTIME_LEDGER_QUARANTINE_FILE" ]]
      expected_recovery_trace=$'db-promotion-ledger0\nquarantine\nlive-ledgerless-proof'
      ;;
    after-quarantine-rename)
      [[ -s "$POSTDEPLOY_MARKER_PENDING_FILE" \
         && -s "$RUNTIME_LEDGER_QUARANTINE_FILE" ]]
      expected_recovery_trace=$'db-promotion-ledger0\nlive-ledgerless-proof'
      ;;
  esac
  : >"$FINALIZER_TRACE"
  status=0
  RECOVERY_LIVE_MODE=drift recover_promoted_final_live_verify_pending \
    "$RECOVERY_JOURNAL" "$SOURCE" "$CANDIDATE" \
    >"$TMP/${kill_point}-recovery.log" 2>&1 || status=$?
  [[ "$status" == 75 \
     && "$(cat "$FINALIZER_TRACE")" == "$expected_recovery_trace" \
     && "$(stat -c %a "$POSTDEPLOY_MARKER_PENDING_FILE")" == 600 \
     && "$(stat -c %a "$RUNTIME_LEDGER_QUARANTINE_FILE")" == 600 \
     && "$(sed -n 's/^reason=//p' "$POSTDEPLOY_MARKER_PENDING_FILE")" \
        == DB_PROMOTED_FINAL_LIVE_VERIFY_PENDING \
     && "$(sed -n 's/^reason=//p' "$RUNTIME_LEDGER_QUARANTINE_FILE")" \
        == PROMOTED_FINAL_LIVE_IDENTITY_DRIFT \
     && -s "$FULL_SCREEN_GATE_STATE_DIR/active.env" \
     && "$(tr -d '[:space:]' <"$RUNTIME_DEPLOY_STATE_FILE")" == "$OLD" \
     && "$(tr -d '[:space:]' <"$DEPLOY_STATE_FILE")" == "$OLD" ]]
  grep -Fq 'mutation=0' "$TMP/${kill_point}-recovery.log"
done

: >"$FINALIZER_TRACE"
RECOVERY_LIVE_MODE=exact recover_promoted_final_live_verify_pending \
  "$RECOVERY_JOURNAL" "$SOURCE" "$CANDIDATE"
python3 - "$FINALIZER_TRACE" <<'PY'
from pathlib import Path
import sys
assert Path(sys.argv[1]).read_text().splitlines() == [
  'db-promotion-ledger0','live-ledgerless-proof','ledger-republished',
  'authority-restored','full-proof-restored']
PY
: >"$FINALIZER_TRACE"
rm -f "$TMP/finalizer-ledger-invalidated"
status=0
RECOVERY_LIVE_MODE=drift recover_promoted_final_live_verify_pending \
  "$RECOVERY_JOURNAL" "$SOURCE" "$CANDIDATE" >"$TMP/recovery-drift.log" 2>&1 || status=$?
[[ "$status" == 75 && ! -e "$TMP/finalizer-ledger-invalidated" \
   && -s "$FULL_SCREEN_GATE_STATE_DIR/active.env" \
   && "$(tr -d '[:space:]' <"$RUNTIME_DEPLOY_STATE_FILE")" == "$OLD" \
   && "$(tr -d '[:space:]' <"$DEPLOY_STATE_FILE")" == "$OLD" ]]
[[ "$(cat "$FINALIZER_TRACE")" == $'db-promotion-ledger0\nlive-ledgerless-proof' ]]
grep -Fq 'mutation=0' "$TMP/recovery-drift.log"
unset -f bash

printf '[postdeploy-promotion-recovery-test] PASS committedMvFault=preserve+old-marker retry=ALREADY_PROMOTED+reconcile precommit=current0+invalidate dbCheckFault=quarantine0600+no-marker-inference exactTarget=directory+symlink+unsafe-path nextPreflight=pending-or-nohint-orphan+DB+K8s+markers-reconciled+active-disarmed remoteRace=A-promoted-B-helper-preserved finalizerDrift=postCommit+verifyFail+ledgerCount0+quarantine0600+pending75+snapshotArmed+markers0 normalCommitCrash=files0+ordinary-runtime-or-applied-pending+ledger1+authority+proof+disarm crashWindows=SIGKILL-after-ledger-delete+pending-rename+quarantine-rename+secondary-reconstruct selfHeal=promotion+attempt+12units+ledger0+liveStable+republish+authority mismatch=ledgerNull+snapshotArmed+markers0+mutation0 runtimeSeparation=helper-build0+template-bootstrap-exact76a+preMigrationNull+DBExactHash+unpinned-selfSign0+coupledMutation0+before-arm+autoscale-up-down-pass+ledger-attestation-stable+template-drift-fail+future-coordinate-fail+readiness-transient+immutable-digest-drift-fail+next-runtime-pass+drift-fail bootstrap=DB+K8s\n'
