#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${1:-${CARBONET_DEPLOY_ROOT:-/opt/Resonance}}"
LOCK_FILE="${CARBONET_DEPLOY_LOCK_FILE:-/tmp/carbonet-auto-deploy.lock}"
STATE_DIR="${CARBONET_DEPLOY_STATE_DIR:-/opt/resonance-data/deploy}"
QUARANTINE_FILE="${CARBONET_RUNTIME_LEDGER_QUARANTINE_FILE:-$STATE_DIR/runtime-ledger-invalidation.quarantine}"
APPLIED_MARKER="${CARBONET_DEPLOY_STATE_FILE:-$STATE_DIR/carbonet-main-success.commit}"
RUNTIME_MARKER="${CARBONET_RUNTIME_DEPLOY_STATE_FILE:-$STATE_DIR/carbonet-runtime-identity-success.commit}"
ATTEMPT_JOURNAL="${CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE:-$STATE_DIR/carbonet-postdeploy-attempt.json}"
MARKER_PENDING="${CARBONET_POSTDEPLOY_MARKER_PENDING_FILE:-$STATE_DIR/postdeploy-marker-pending.state}"
RUNTIME_CANDIDATE_CHECKPOINT="${CARBONET_RUNTIME_CANDIDATE_CHECKPOINT_FILE:-$STATE_DIR/carbonet-runtime-candidate.json}"
RETIRED_DIR="${CARBONET_POSTDEPLOY_LEGACY_RETIRE_DIR:-$STATE_DIR/retired-attempts}"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${CARBONET_K8S_DEPLOYMENT:-carbonet-runtime}"
CONTAINER="${CARBONET_K8S_CONTAINER:-carbonet-runtime}"
POSTGRES_POD="${CARBONET_POSTGRES_POD:-}"
POSTGRES_CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
POSTGRES_DB="${POSTGRES_DB:-carbonet}"
POSTGRES_USER="${POSTGRES_ADMIN_USER:-postgres}"
LEADER_RESOLVER="${CARBONET_POSTDEPLOY_LEADER_RESOLVER:-$ROOT_DIR/ops/scripts/resolve-patroni-primary-pod.sh}"
REMOTE="${CARBONET_DEPLOY_REMOTE:-origin}"
BRANCH="${CARBONET_DEPLOY_BRANCH:-main}"

MARKER_PENDING_REASON=MARKER_PENDING_RUNTIME_PROOF_FAILED
RECOVERED_CHECKPOINT_DISARM_REASON=RECOVERED_CHECKPOINT_DISARM_FAILED
quarantine_hash=""
orphan_target=""
candidate_id=""
baseline=""
applied_hash=""
runtime_hash=""
archive_tmp=""

log() { printf '[legacy-orphan-runtime-recovery] %s\n' "$*"; }
fail() { log "BLOCKED $*" >&2; exit 79; }

read_exact_contract() {
  local keys expected_keys reason observed_applied observed_runtime
  [[ -f "$QUARANTINE_FILE" && ! -L "$QUARANTINE_FILE" \
     && "$(stat -c '%a:%u:%g' "$QUARANTINE_FILE" 2>/dev/null)" == "600:$(id -u):$(id -g)" ]] \
    || return 1
  expected_keys=$'candidateId\nobservedAppliedMarker\nobservedRuntimeMarker\nreason\nschemaVersion\ntargetCommit'
  keys="$(sed -n 's/^\([A-Za-z][A-Za-z0-9]*\)=.*/\1/p' "$QUARANTINE_FILE" | LC_ALL=C sort)"
  [[ "$keys" == "$expected_keys" && "$(awk 'END{print NR}' "$QUARANTINE_FILE")" == 6 \
     && "$(sed -n 's/^schemaVersion=//p' "$QUARANTINE_FILE")" == 1 ]] || return 1
  orphan_target="$(sed -n 's/^targetCommit=//p' "$QUARANTINE_FILE")"
  candidate_id="$(sed -n 's/^candidateId=//p' "$QUARANTINE_FILE")"
  reason="$(sed -n 's/^reason=//p' "$QUARANTINE_FILE")"
  observed_applied="$(sed -n 's/^observedAppliedMarker=//p' "$QUARANTINE_FILE")"
  observed_runtime="$(sed -n 's/^observedRuntimeMarker=//p' "$QUARANTINE_FILE")"
  [[ "$orphan_target" =~ ^[0-9a-f]{40}$ \
     && "$candidate_id" =~ ^postdeploy:${orphan_target:0:12}:[A-Za-z0-9._:-]{12,140}$ \
     && ( "$reason" == "$MARKER_PENDING_REASON" \
          || "$reason" == "$RECOVERED_CHECKPOINT_DISARM_REASON" ) \
     && "$observed_applied" =~ ^[0-9a-f]{40}$ \
     && "$observed_runtime" == "$observed_applied" ]] || return 1
  baseline="$observed_applied"
  quarantine_hash="$(sha256sum "$QUARANTINE_FILE" 2>/dev/null | awk '{print $1}')"
  [[ "$quarantine_hash" =~ ^[0-9a-f]{64}$ ]]
}

pin_markers_and_obligations() {
  [[ ! -e "$ATTEMPT_JOURNAL" && ! -L "$ATTEMPT_JOURNAL" \
     && ! -e "$MARKER_PENDING" && ! -L "$MARKER_PENDING" \
     && ! -e "$RUNTIME_CANDIDATE_CHECKPOINT" && ! -L "$RUNTIME_CANDIDATE_CHECKPOINT" ]] || return 1
  [[ -f "$APPLIED_MARKER" && ! -L "$APPLIED_MARKER" \
     && "$(stat -c '%a:%u:%g' "$APPLIED_MARKER" 2>/dev/null)" == "644:$(id -u):$(id -g)" \
     && "$(awk 'END{print NR}' "$APPLIED_MARKER")" == 1 \
     && "$(cat "$APPLIED_MARKER")" == "$baseline" ]] || return 1
  [[ -f "$RUNTIME_MARKER" && ! -L "$RUNTIME_MARKER" \
     && "$(stat -c '%a:%u:%g' "$RUNTIME_MARKER" 2>/dev/null)" == "644:$(id -u):$(id -g)" \
     && "$(awk 'END{print NR}' "$RUNTIME_MARKER")" == 1 \
     && "$(cat "$RUNTIME_MARKER")" == "$baseline" ]] || return 1
  applied_hash="$(sha256sum "$APPLIED_MARKER" 2>/dev/null | awk '{print $1}')"
  runtime_hash="$(sha256sum "$RUNTIME_MARKER" 2>/dev/null | awk '{print $1}')"
  [[ "$applied_hash" =~ ^[0-9a-f]{64}$ && "$runtime_hash" =~ ^[0-9a-f]{64}$ ]]
}

pinned_files_unchanged() {
  local saved_target="$orphan_target" saved_candidate="$candidate_id" saved_baseline="$baseline"
  local saved_quarantine_hash="$quarantine_hash"
  read_exact_contract || return 1
  [[ "$orphan_target" == "$saved_target" && "$candidate_id" == "$saved_candidate" \
     && "$baseline" == "$saved_baseline" && "$quarantine_hash" == "$saved_quarantine_hash" ]] || return 1
  [[ ! -e "$ATTEMPT_JOURNAL" && ! -L "$ATTEMPT_JOURNAL" \
     && ! -e "$MARKER_PENDING" && ! -L "$MARKER_PENDING" \
     && ! -e "$RUNTIME_CANDIDATE_CHECKPOINT" && ! -L "$RUNTIME_CANDIDATE_CHECKPOINT" ]] || return 1
  [[ -f "$APPLIED_MARKER" && ! -L "$APPLIED_MARKER" \
     && "$(stat -c '%a:%u:%g' "$APPLIED_MARKER" 2>/dev/null)" == "644:$(id -u):$(id -g)" \
     && "$(sha256sum "$APPLIED_MARKER" 2>/dev/null | awk '{print $1}')" == "$applied_hash" \
     && "$(cat "$APPLIED_MARKER")" == "$baseline" ]] || return 1
  [[ -f "$RUNTIME_MARKER" && ! -L "$RUNTIME_MARKER" \
     && "$(stat -c '%a:%u:%g' "$RUNTIME_MARKER" 2>/dev/null)" == "644:$(id -u):$(id -g)" \
     && "$(sha256sum "$RUNTIME_MARKER" 2>/dev/null | awk '{print $1}')" == "$runtime_hash" \
     && "$(cat "$RUNTIME_MARKER")" == "$baseline" ]] || return 1
}

db_psql() {
  kubectl -n "$NAMESPACE" exec -i "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
    psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -qAt -v ON_ERROR_STOP=1 "$@"
}

prove_exact_target_db_absence() {
  local tables counts
  tables="$(printf '%s\n' "SELECT concat_ws('|', CASE WHEN to_regclass('public.framework_postdeploy_release_attempt') IS NULL THEN 'ABSENT' ELSE 'AVAILABLE' END, CASE WHEN to_regclass('public.framework_postdeploy_evidence_promotion') IS NULL THEN 'ABSENT' ELSE 'AVAILABLE' END, CASE WHEN to_regclass('public.framework_runtime_release_state') IS NULL THEN 'ABSENT' ELSE 'AVAILABLE' END);" | db_psql 2>/dev/null)" \
    || return 1
  [[ "$(printf '%s' "$tables" | tr -d '[:space:]')" == 'AVAILABLE|AVAILABLE|AVAILABLE' ]] || return 1
  counts="$(printf '%s\n' "/* LEGACY_ORPHAN_EXACT_ABSENCE */ SELECT (SELECT count(*) FROM framework_postdeploy_release_attempt WHERE source_commit=:'source_commit')::text || '|' || (SELECT count(*) FROM framework_postdeploy_evidence_promotion WHERE source_commit=:'source_commit')::text || '|' || (SELECT count(*) FROM framework_runtime_release_state WHERE source_commit=:'source_commit')::text || '|' || (SELECT count(*) FROM framework_runtime_release_state WHERE release_key='CARBONET_RUNTIME' AND source_commit=:'baseline_commit' AND health_status='UP')::text || '|' || (SELECT count(*) FROM framework_runtime_release_state WHERE release_key='CARBONET_RUNTIME')::text;" | \
    db_psql -v source_commit="$orphan_target" -v baseline_commit="$baseline" 2>/dev/null)" || return 1
  [[ "$(printf '%s' "$counts" | tr -d '[:space:]')" == '0|0|0|1|1' ]]
}

deployment_identity_token() {
  jq -cS --arg container "$CONTAINER" '
    {resourceVersion:.metadata.resourceVersion,uid:.metadata.uid,generation:.metadata.generation,
     observedGeneration:.status.observedGeneration,replicas:.spec.replicas,
     updatedReplicas:.status.updatedReplicas,readyReplicas:.status.readyReplicas,
     availableReplicas:.status.availableReplicas,unavailableReplicas:(.status.unavailableReplicas//0),
     targetCommit:(.metadata.annotations["resonance.ai/target-commit"]//""),
     image:(.spec.template.spec.containers[]|select(.name==$container)|.image)}
  ' <<<"$1"
}

prove_live_baseline_identity() {
  local deployment_json deployment_recheck token selector pods_json image_ref desired
  local ready_pods image_ids image_id ledger_json pod health_json
  deployment_json="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o json 2>/dev/null)" || return 1
  jq -e --arg commit "$baseline" --arg container "$CONTAINER" '
    (.metadata.annotations["resonance.ai/target-commit"]//"")==$commit
    and (.metadata.uid|type=="string" and length>0)
    and (.metadata.generation|type=="number")
    and (.spec.replicas|type=="number" and .>0)
    and .status.observedGeneration==.metadata.generation
    and .status.updatedReplicas==.spec.replicas
    and .status.readyReplicas==.spec.replicas
    and .status.availableReplicas==.spec.replicas
    and (.status.unavailableReplicas//0)==0
    and any(.spec.template.spec.containers[]?;.name==$container and (.image|type=="string" and length>0))
  ' <<<"$deployment_json" >/dev/null || return 1
  token="$(deployment_identity_token "$deployment_json")" || return 1
  selector="$(jq -r '.spec.selector.matchLabels // {} | to_entries | map("\(.key)=\(.value)") | join(",")' <<<"$deployment_json")"
  image_ref="$(jq -r --arg container "$CONTAINER" '.spec.template.spec.containers[]|select(.name==$container)|.image' <<<"$deployment_json")"
  desired="$(jq -r '.spec.replicas' <<<"$deployment_json")"
  [[ -n "$selector" && "$desired" =~ ^[1-9][0-9]*$ ]] || return 1
  pods_json="$(kubectl -n "$NAMESPACE" get pods -l "$selector" -o json 2>/dev/null)" || return 1
  ready_pods="$(jq -c --arg container "$CONTAINER" --arg image "$image_ref" '
    [.items[]
     | select(.metadata.deletionTimestamp==null and .status.phase=="Running")
     | select(any(.status.conditions[]?;.type=="Ready" and .status=="True"))
     | select(any(.spec.containers[]?;.name==$container and .image==$image))
     | select(any(.status.containerStatuses[]?;.name==$container and .ready==true))
     | {name:.metadata.name,imageId:([.status.containerStatuses[]|select(.name==$container and .ready==true)|(.imageID//"")][0]//"")}
     | select(.imageId|test("sha256:[0-9a-f]{64}$"))]
  ' <<<"$pods_json")" || return 1
  [[ "$(jq -r 'length' <<<"$ready_pods")" == "$desired" ]] || return 1
  image_ids="$(jq -c '[.[].imageId]|unique' <<<"$ready_pods")"
  [[ "$(jq -r 'length' <<<"$image_ids")" == 1 ]] || return 1
  image_id="$(jq -r '.[0]' <<<"$image_ids")"
  while IFS= read -r pod; do
    health_json="$(kubectl -n "$NAMESPACE" exec "$pod" -c "$CONTAINER" -- \
      curl -fsS --max-time 15 http://127.0.0.1:8080/actuator/health 2>/dev/null)" || return 1
    jq -e '.status=="UP"' <<<"$health_json" >/dev/null || return 1
  done < <(jq -r '.[].name' <<<"$ready_pods")
  ledger_json="$(printf '%s\n' "/* LEGACY_ORPHAN_BASELINE_LEDGER */ select jsonb_build_object('releaseKey',release_key,'sourceCommit',source_commit,'deploymentNamespace',deployment_namespace,'deploymentName',deployment_name,'deploymentUid',deployment_uid,'deploymentGeneration',deployment_generation,'observedGeneration',observed_generation,'desiredReplicas',desired_replicas,'imageRef',image_ref,'imageId',image_id,'healthStatus',health_status)::text from framework_runtime_release_state where release_key='CARBONET_RUNTIME';" | db_psql 2>/dev/null)" \
    || return 1
  jq -e --arg commit "$baseline" --arg namespace "$NAMESPACE" --arg deployment "$DEPLOYMENT" \
    --arg uid "$(jq -r '.metadata.uid' <<<"$deployment_json")" --arg image "$image_ref" --arg imageId "$image_id" \
    --argjson generation "$(jq -r '.metadata.generation' <<<"$deployment_json")" \
    --argjson observed "$(jq -r '.status.observedGeneration' <<<"$deployment_json")" \
    --argjson desired "$desired" '
      .releaseKey=="CARBONET_RUNTIME" and .sourceCommit==$commit
      and .deploymentNamespace==$namespace and .deploymentName==$deployment
      and .deploymentUid==$uid and .deploymentGeneration==$generation
      and .observedGeneration==$observed and .desiredReplicas==$desired
      and .imageRef==$image and .imageId==$imageId and .healthStatus=="UP"
    ' <<<"$ledger_json" >/dev/null || return 1
  deployment_recheck="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o json 2>/dev/null)" || return 1
  [[ "$(deployment_identity_token "$deployment_recheck")" == "$token" ]]
}

stable_proof() {
  pinned_files_unchanged && prove_exact_target_db_absence && prove_live_baseline_identity
}

# Nonmatching quarantine evidence belongs to the ordinary fail-closed gate.
[[ -e "$QUARANTINE_FILE" || -L "$QUARANTINE_FILE" ]] || exit 0
read_exact_contract || exit 0

mkdir -p "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
flock -n 9 || { log 'RETRY deployment lock is held; evidence unchanged' >&2; exit 75; }

read_exact_contract || fail 'exact quarantine contract drifted while acquiring lock'
pin_markers_and_obligations || fail 'markers, ownership, runtime candidate checkpoint, or pending obligations are not the pinned baseline'
deployment_target="${CARBONET_ORPHAN_RECOVERY_TARGET_COMMIT:-$(git -C "$ROOT_DIR" rev-parse "$REMOTE/$BRANCH" 2>/dev/null || true)}"
[[ "$deployment_target" =~ ^[0-9a-f]{40}$ \
   && "$(git -C "$ROOT_DIR" cat-file -t "$baseline" 2>/dev/null || true)" == commit \
   && "$(git -C "$ROOT_DIR" cat-file -t "$orphan_target" 2>/dev/null || true)" == commit \
   && "$(git -C "$ROOT_DIR" cat-file -t "$deployment_target" 2>/dev/null || true)" == commit ]] \
  || fail 'baseline, orphan target, or deployment target commit is unavailable'
git -C "$ROOT_DIR" merge-base --is-ancestor "$baseline" "$orphan_target" \
  || fail 'orphan target is not a descendant of the live baseline'
git -C "$ROOT_DIR" merge-base --is-ancestor "$orphan_target" "$deployment_target" \
  || fail 'deployment target is not a descendant of the orphan target'
if [[ -z "$POSTGRES_POD" ]]; then
  POSTGRES_POD="$(K8S_NAMESPACE="$NAMESPACE" bash "$LEADER_RESOLVER" 2>/dev/null)" \
    || fail 'writable PostgreSQL leader is unavailable'
fi
[[ "$POSTGRES_POD" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ ]] || fail 'PostgreSQL leader identity is invalid'

stable_proof || fail 'pre-archive DB, Kubernetes, health, or filesystem proof is incomplete'
if [[ ! -e "$RETIRED_DIR" && ! -L "$RETIRED_DIR" ]]; then
  mkdir -m 0700 -- "$RETIRED_DIR" || fail 'retired evidence directory could not be created'
fi
[[ -d "$RETIRED_DIR" && ! -L "$RETIRED_DIR" \
   && "$(stat -c '%a:%u:%g' "$RETIRED_DIR" 2>/dev/null)" == "700:$(id -u):$(id -g)" \
   && "$(stat -c '%d' "$RETIRED_DIR")" == "$(stat -c '%d' "$QUARANTINE_FILE")" ]] \
  || fail 'retired evidence directory is not same-filesystem, private, and owned'
archive_path="$RETIRED_DIR/${candidate_id}.legacy-orphan-runtime-quarantine.state"
trap '[[ -z "$archive_tmp" ]] || rm -f -- "$archive_tmp"' EXIT
if [[ -e "$archive_path" || -L "$archive_path" ]]; then
  [[ -f "$archive_path" && ! -L "$archive_path" \
     && "$(stat -c '%a:%u:%g' "$archive_path" 2>/dev/null)" == "400:$(id -u):$(id -g)" \
     && "$(sha256sum "$archive_path" 2>/dev/null | awk '{print $1}')" == "$quarantine_hash" ]] \
    || fail 'existing retired evidence does not match the pinned source'
else
  archive_tmp="$(mktemp "$RETIRED_DIR/.legacy-orphan-runtime-quarantine.XXXXXX")" \
    || fail 'retired evidence staging file could not be created'
  cp --no-preserve=mode,ownership -- "$QUARANTINE_FILE" "$archive_tmp" \
    || fail 'retired evidence staging copy failed'
  chmod 0400 "$archive_tmp" || fail 'retired evidence could not be made read-only'
  [[ "$(stat -c '%a:%u:%g' "$archive_tmp" 2>/dev/null)" == "400:$(id -u):$(id -g)" \
     && "$(sha256sum "$archive_tmp" 2>/dev/null | awk '{print $1}')" == "$quarantine_hash" ]] \
    || fail 'retired evidence staging hash or ownership drifted'
  sync -f "$archive_tmp" || fail 'retired evidence staging fsync failed'
  mv -T -- "$archive_tmp" "$archive_path" || fail 'retired evidence atomic rename failed'
  archive_tmp=""
  sync -f "$RETIRED_DIR" || fail 'retired evidence directory fsync failed'
fi

# The archive exists, but the original blocker remains until a second complete
# read-only snapshot proves that no DB row, marker, deployment, pod, or health
# surface changed during archival.
stable_proof || fail 'post-archive proof drifted; original quarantine retained'
pinned_files_unchanged || fail 'quarantine changed immediately before retirement'
prove_exact_target_db_absence || fail 'target authority rows changed immediately before retirement'
rm -f -- "$QUARANTINE_FILE" || fail 'original quarantine could not be retired'
sync -f "$(dirname "$QUARANTINE_FILE")" || fail 'quarantine directory fsync failed'
[[ ! -e "$QUARANTINE_FILE" && ! -L "$QUARANTINE_FILE" \
   && -f "$archive_path" && ! -L "$archive_path" \
   && "$(stat -c '%a:%u:%g' "$archive_path" 2>/dev/null)" == "400:$(id -u):$(id -g)" \
   && "$(sha256sum "$archive_path" 2>/dev/null | awk '{print $1}')" == "$quarantine_hash" ]] \
  || fail 'final immutable archive or source absence proof failed'
log "PASS target=$orphan_target baseline=$baseline targetRows=0/0/0 liveLedger=1 health=UP evidence=$archive_path"
