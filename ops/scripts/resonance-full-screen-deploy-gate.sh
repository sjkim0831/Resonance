#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
BASE_URL="${BASE_URL:-http://127.0.0.1}"
RUNTIME_DEPLOYMENT="${RUNTIME_DEPLOYMENT:-carbonet-runtime}"
WEB_DEPLOYMENT="${WEB_DEPLOYMENT:-carbonet-web}"
WEB_SERVICE="${WEB_SERVICE:-carbonet-web}"
RUNTIME_CONTAINER="${RUNTIME_CONTAINER:-carbonet-runtime}"
WEB_CONTAINER="${WEB_CONTAINER:-web}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/projects/carbonet-frontend/source}"
# The rollback authority is the hostPath mounted by carbonet-runtime/web, not a
# deployment worktree copy. Tests may override OVERLAY_DIR explicitly.
OVERLAY_DIR="${OVERLAY_DIR:-/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app}"
STATE_DIR="${FULL_SCREEN_GATE_STATE_DIR:-/opt/resonance-data/deploy/full-screen-deploy-gate}"
REPORT_DIR="${FULL_SCREEN_GATE_REPORT_DIR:-$ROOT_DIR/var/reports/full-screen-deploy-gate}"
CREDENTIAL_SECRET="${FULL_SCREEN_GATE_CREDENTIAL_SECRET:-carbonet-screen-smoke}"
STATUS_PAGE_TEMPLATE="${FULL_SCREEN_GATE_STATUS_PAGE_TEMPLATE:-$ROOT_DIR/ops/assets/full-screen-deploy-gate-status.html}"
ASSET_CLOSURE_VERIFIER="${FULL_SCREEN_GATE_ASSET_CLOSURE_VERIFIER:-$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs}"
ACTIVE_FILE="$STATE_DIR/active.env"
APPLIED_MARKER_FILE="${CARBONET_DEPLOY_STATE_FILE:-/opt/resonance-data/deploy/carbonet-main-success.commit}"
RUNTIME_MARKER_FILE="${CARBONET_RUNTIME_DEPLOY_STATE_FILE:-/opt/resonance-data/deploy/carbonet-runtime-identity-success.commit}"
ACTION="${1:-verify}"

log() { printf '[full-screen-gate] %s %s\n' "$(date -Is)" "$*"; }
fail() { log "FAIL: $*" >&2; exit 1; }

require_safe_path() {
  local path="$1" parent="$2"
  local resolved_path resolved_parent
  resolved_path="$(realpath -m "$path")"
  resolved_parent="$(realpath -m "$parent")"
  [[ "$path" == "$resolved_path" && "$parent" == "$resolved_parent" \
     && "$resolved_path" == "$resolved_parent"/* ]] || fail "unsafe path: $path"
}

ensure_state_dir() {
  local create="${1:-false}"
  if [[ "$create" == true ]]; then
    mkdir -p "$STATE_DIR"
    chmod 0700 "$STATE_DIR"
  fi
  [[ -d "$STATE_DIR" && ! -L "$STATE_DIR" ]] || fail "rollback state directory is unsafe"
  [[ "$(realpath -m "$STATE_DIR")" == "$STATE_DIR" \
     && "$(stat -c '%a' "$STATE_DIR" 2>/dev/null)" == 700 \
     && "$(stat -c '%u' "$STATE_DIR" 2>/dev/null)" == "$(id -u)" ]] \
    || fail "rollback state directory ownership or mode is unsafe"
}

load_active() {
  local retired_active=""
  ensure_state_dir false
  if [[ ! -e "$ACTIVE_FILE" && ! -L "$ACTIVE_FILE" \
     && -n "${FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID:-}" ]]; then
    retired_active="$STATE_DIR/retired/${FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID}.failed.env"
    if [[ -f "$retired_active" && ! -L "$retired_active" ]]; then
      # Crash-resume window: finalize-failed may have atomically retired the
      # active pointer after physical verification but before journal clear.
      # The exact expected snapshot/manifest checks below make this immutable
      # retired pointer safe for read-only re-verification.
      ACTIVE_FILE="$retired_active"
    fi
  fi
  [[ -f "$ACTIVE_FILE" && ! -L "$ACTIVE_FILE" && -s "$ACTIVE_FILE" ]] \
    || fail "deployment snapshot is missing or unsafe: $ACTIVE_FILE"
  [[ "$(stat -c '%a' "$ACTIVE_FILE" 2>/dev/null)" == 600 \
     && "$(stat -c '%u' "$ACTIVE_FILE" 2>/dev/null)" == "$(id -u)" ]] \
    || fail "deployment snapshot pointer ownership or mode is unsafe"
  local line key value literal
  local -A fields=()
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" == *=* ]] || fail "deployment snapshot pointer contains a non-literal field"
    key="${line%%=*}"; literal="${line#*=}"
    [[ "$key" =~ ^[A-Z][A-Z0-9_]*$ && ${#literal} -ge 2 \
       && "${literal:0:1}" == "'" && "${literal: -1}" == "'" ]] \
      || fail "deployment snapshot pointer contains a non-literal field"
    value="${literal:1:${#literal}-2}"
    [[ "$value" =~ ^[A-Za-z0-9._:/@+-]*$ ]] \
      || fail "deployment snapshot pointer contains a non-literal value"
    [[ ! -v "fields[$key]" ]] || fail "deployment snapshot pointer contains duplicate key: $key"
    fields[$key]="$value"
  done <"$ACTIVE_FILE"
  if [[ "${fields[ACTIVE_SCHEMA_VERSION]:-}" == 2 ]]; then
    local -a expected=(ACTIVE_SCHEMA_VERSION SNAPSHOT_ID SNAPSHOT_DIR SNAPSHOT_FORMAT RUNTIME_IMAGE RUNTIME_IMAGE_ID WEB_IMAGE GIT_SHA BASELINE_SOURCE_COMMIT SNAPSHOT_MANIFEST_SHA256 DEPLOYMENT_ANNOTATIONS_SHA256 POD_TEMPLATE_SHA256)
  else
    local -a expected=(SNAPSHOT_ID SNAPSHOT_DIR SNAPSHOT_FORMAT RUNTIME_IMAGE WEB_IMAGE GIT_SHA BASELINE_SOURCE_COMMIT)
  fi
  [[ "${#fields[@]}" == "${#expected[@]}" ]] || fail "deployment snapshot pointer key count is invalid"
  for key in "${expected[@]}"; do [[ -v "fields[$key]" ]] || fail "deployment snapshot pointer key is missing: $key"; done
  ACTIVE_SCHEMA_VERSION="${fields[ACTIVE_SCHEMA_VERSION]:-1}"
  SNAPSHOT_ID="${fields[SNAPSHOT_ID]}"
  SNAPSHOT_DIR="${fields[SNAPSHOT_DIR]}"
  SNAPSHOT_FORMAT="${fields[SNAPSHOT_FORMAT]}"
  RUNTIME_IMAGE="${fields[RUNTIME_IMAGE]}"
  RUNTIME_IMAGE_ID="${fields[RUNTIME_IMAGE_ID]:-}"
  WEB_IMAGE="${fields[WEB_IMAGE]}"
  GIT_SHA="${fields[GIT_SHA]}"
  BASELINE_SOURCE_COMMIT="${fields[BASELINE_SOURCE_COMMIT]}"
  SNAPSHOT_MANIFEST_SHA256="${fields[SNAPSHOT_MANIFEST_SHA256]:-}"
  DEPLOYMENT_ANNOTATIONS_SHA256="${fields[DEPLOYMENT_ANNOTATIONS_SHA256]:-}"
  POD_TEMPLATE_SHA256="${fields[POD_TEMPLATE_SHA256]:-}"
  SNAPSHOT_FORMAT="${SNAPSHOT_FORMAT:-legacy-gzip}"
  BASELINE_SOURCE_COMMIT="${BASELINE_SOURCE_COMMIT:-${GIT_SHA:-}}"
  [[ "${SNAPSHOT_ID:-}" =~ ^[A-Za-z0-9._-]+$ ]] || fail "snapshot id is invalid"
  [[ "$BASELINE_SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || fail "snapshot baseline commit is invalid"
  if [[ -n "${FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID:-}" ]]; then
    [[ "$FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID" == "$SNAPSHOT_ID" ]] \
      || fail "active snapshot id differs from durable attempt journal"
  fi
  if [[ -n "${FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256:-}" ]]; then
    [[ "$FULL_SCREEN_GATE_EXPECTED_MANIFEST_SHA256" == "$SNAPSHOT_MANIFEST_SHA256" ]] \
      || fail "active snapshot manifest differs from durable attempt journal"
  fi
  if [[ -n "${FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT:-}" ]]; then
    [[ "$FULL_SCREEN_GATE_EXPECTED_BASELINE_SOURCE_COMMIT" == "$BASELINE_SOURCE_COMMIT" ]] \
      || fail "active snapshot baseline differs from durable attempt journal"
  fi
  require_safe_path "$SNAPSHOT_DIR" "$STATE_DIR"
  [[ -d "$SNAPSHOT_DIR" && ! -L "$SNAPSHOT_DIR" ]] || fail "snapshot directory is unsafe"
  if [[ -n "${SNAPSHOT_MANIFEST_SHA256:-}" ]]; then
    [[ "$SNAPSHOT_MANIFEST_SHA256" =~ ^[0-9a-f]{64}$ \
       && -f "$SNAPSHOT_DIR/manifest.json" && ! -L "$SNAPSHOT_DIR/manifest.json" \
       && "$(sha256sum "$SNAPSHOT_DIR/manifest.json" | awk '{print $1}')" == "$SNAPSHOT_MANIFEST_SHA256" ]] \
      || fail "snapshot manifest identity mismatch"
  fi
}

prune_snapshots() {
  local keep="${FULL_SCREEN_GATE_SNAPSHOT_RETENTION:-3}" snapshot
  local -a stale_snapshots=()
  mapfile -t stale_snapshots < <(
    find "$STATE_DIR/snapshots" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' 2>/dev/null |
      sort -rn | tail -n "+$((keep + 1))" | cut -d' ' -f2-
  )
  # An empty indexed array must produce zero loop iterations.  The `:-`
  # fallback form expands to one empty element and makes the path guard reject
  # an otherwise successful deployment as `unsafe path:`.
  for snapshot in "${stale_snapshots[@]}"; do
    require_safe_path "$snapshot" "$STATE_DIR"
    chmod -R u+w -- "$snapshot" 2>/dev/null || true
    if ! rm -rf -- "$snapshot" 2>/dev/null; then
      # Historical deploy services occasionally created snapshots as root.
      # The path guard above confines elevated deletion to this gate's own
      # snapshot subtree. Cleanup must never invalidate an otherwise healthy
      # deployment, so retain and warn if non-interactive sudo is unavailable.
      sudo -n rm -rf -- "$snapshot" 2>/dev/null ||
        log "WARN: stale snapshot cleanup deferred path=$snapshot"
    fi
  done
}

capture() {
  local snapshot_id snapshot_dir snapshot_verify_dir="" runtime_image runtime_image_id web_image git_sha snapshot_format
  local active_tmp="" previous_umask runtime_json web_json web_service_json pods_json selector
  local annotations_hash template_hash rollout_policy_hash web_state_hash service_hash overlay_hash nginx_hash manifest_hash
  local applied_marker="" applied_marker_hash="" runtime_marker="" runtime_marker_hash=""
  local desired_replicas ready_runtime_count
  previous_umask="$(umask)"
  umask 077
  ensure_state_dir true
  mkdir -p "$REPORT_DIR"
  snapshot_id="$(date +%Y%m%d-%H%M%S)-$$"
  snapshot_dir="$STATE_DIR/snapshots/$snapshot_id"
  require_safe_path "$snapshot_dir" "$STATE_DIR"

  runtime_json="$(kubectl -n "$NAMESPACE" get deployment "$RUNTIME_DEPLOYMENT" -o json)" \
    || fail "runtime deployment baseline is unavailable"
  web_json="$(kubectl -n "$NAMESPACE" get deployment "$WEB_DEPLOYMENT" -o json)" \
    || fail "web deployment baseline is unavailable"
  web_service_json="$(kubectl -n "$NAMESPACE" get service "$WEB_SERVICE" -o json)" \
    || fail "web service baseline is unavailable"
  runtime_image="$(jq -r --arg container "$RUNTIME_CONTAINER" \
    '.spec.template.spec.containers[]|select(.name==$container)|.image' <<<"$runtime_json")"
  web_image="$(jq -r --arg container "$WEB_CONTAINER" \
    '.spec.template.spec.containers[]|select(.name==$container)|.image' <<<"$web_json")"
  [[ -n "$runtime_image" && -n "$web_image" ]] || fail "baseline deployment images are incomplete"
  desired_replicas="$(jq -r '.spec.replicas // 0' <<<"$runtime_json")"
  [[ "$desired_replicas" =~ ^[1-9][0-9]*$ ]] || fail "baseline desired replicas are invalid"
  jq -e --argjson desired "$desired_replicas" '
    (.status.observedGeneration // -1) >= (.metadata.generation // 0)
    and (.status.updatedReplicas // 0)==$desired
    and (.status.readyReplicas // 0)==$desired
    and (.status.availableReplicas // 0)==$desired
    and (.status.unavailableReplicas // 0)==0
  ' <<<"$runtime_json" >/dev/null || fail "baseline deployment is not fully observed and ready"
  selector="$(jq -r '.spec.selector.matchLabels//{}|to_entries|map("\(.key)=\(.value)")|join(",")' <<<"$runtime_json")"
  [[ -n "$selector" ]] || fail "runtime deployment selector is unavailable"
  pods_json="$(kubectl -n "$NAMESPACE" get pods -l "$selector" -o json)" \
    || fail "runtime pod baseline is unavailable"
  runtime_image_id="$(jq -r --arg container "$RUNTIME_CONTAINER" --arg image "$runtime_image" '
    [.items[]
      | select(.status.phase=="Running")
      | select(any(.status.conditions[]?;.type=="Ready" and .status=="True"))
      | select(any(.spec.containers[]?;.name==$container and .image==$image))
      | .status.containerStatuses[]?
      | select(.name==$container and .ready==true)
      | .imageID]
    | unique | if length==1 then .[0] else empty end
  ' <<<"$pods_json")"
  ready_runtime_count="$(jq -r --arg container "$RUNTIME_CONTAINER" --arg image "$runtime_image" '
    [.items[]
      | select(.metadata.deletionTimestamp==null)
      | select(.status.phase=="Running")
      | select(any(.status.conditions[]?;.type=="Ready" and .status=="True"))
      | select(any(.spec.containers[]?;.name==$container and .image==$image))
      | select(any(.status.containerStatuses[]?;.name==$container and .ready==true))]
    | length
  ' <<<"$pods_json")"
  [[ "$ready_runtime_count" == "$desired_replicas" ]] || fail "baseline Ready pods do not equal desired replicas"
  [[ "$runtime_image_id" =~ sha256:[0-9a-f]{64}$ ]] || fail "baseline pods do not share one immutable runtime imageID"
  git_sha="${FULL_SCREEN_GATE_BASE_COMMIT:-$(git -C "$ROOT_DIR" rev-parse HEAD)}"
  [[ "$git_sha" =~ ^[0-9a-f]{40}$ ]] || fail "rollback baseline commit is invalid"
  # Never move the active rollback pointer to an incomplete or stale bundle
  # graph. Validate the live mounted closure before allocating its snapshot,
  # then validate the copied closure again before publishing active.env.
  node "$ASSET_CLOSURE_VERIFIER" "$OVERLAY_DIR" \
    || fail "live overlay asset closure is incomplete: $OVERLAY_DIR"
  if [[ -e "$ACTIVE_FILE" || -L "$ACTIVE_FILE" ]]; then
    [[ -f "$ACTIVE_FILE" && ! -L "$ACTIVE_FILE" ]] \
      || fail "active rollback pointer target is unsafe: $ACTIVE_FILE"
  fi
  mkdir -p "$snapshot_dir"
  # One read-only tar inode is independent of the live overlay.  Hard-link
  # trees are fast but are not immutable when any writer updates in place.
  snapshot_format="plain-tar"
  tar -C "$OVERLAY_DIR" -cf "$snapshot_dir/.frontend-overlay.tar.tmp" . \
    || { rm -rf -- "$snapshot_dir"; fail "overlay snapshot archive failed"; }
  mv -fT -- "$snapshot_dir/.frontend-overlay.tar.tmp" "$snapshot_dir/frontend-overlay.tar"
  snapshot_verify_dir="$(mktemp -d "$STATE_DIR/capture-verify.XXXXXX")"
  require_safe_path "$snapshot_verify_dir" "$STATE_DIR"
  if ! tar -C "$snapshot_verify_dir" -xf "$snapshot_dir/frontend-overlay.tar" \
     || ! node "$ASSET_CLOSURE_VERIFIER" "$snapshot_verify_dir"; then
    rm -rf -- "$snapshot_verify_dir" "$snapshot_dir"
    fail "captured tar overlay closure is incomplete"
  fi
  overlay_hash="$(cd "$snapshot_verify_dir" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum | sha256sum | awk '{print $1}')"
  rm -rf -- "$snapshot_verify_dir"

  # Controller-owned annotations (notably deployment.kubernetes.io/revision)
  # are intentionally excluded: a template restore creates a new ReplicaSet
  # and the controller must be free to advance them.  Only deploy-owned
  # release annotations are captured and compared exactly.
  jq -cS '(.metadata.annotations//{})|with_entries(select(.key|startswith("resonance.ai/")))' \
    <<<"$runtime_json" >"$snapshot_dir/deployment-annotations.json"
  jq -cS '.spec.template' <<<"$runtime_json" >"$snapshot_dir/pod-template.json"
  jq -cS '.spec|{minReadySeconds,progressDeadlineSeconds,strategy}' \
    <<<"$runtime_json" >"$snapshot_dir/deployment-rollout-policy.json"
  jq -e '(.minReadySeconds|type)=="number" and (.progressDeadlineSeconds|type)=="number"
    and (.strategy|type)=="object"' "$snapshot_dir/deployment-rollout-policy.json" >/dev/null \
    || fail "runtime deployment rollout policy baseline is incomplete"
  jq -cS '{metadata:{annotations:((.metadata.annotations//{})|with_entries(select(.key|startswith("resonance.ai/"))))},
    spec:{replicas:.spec.replicas,minReadySeconds:.spec.minReadySeconds,
      progressDeadlineSeconds:.spec.progressDeadlineSeconds,strategy:.spec.strategy,template:.spec.template}}' \
    <<<"$web_json" >"$snapshot_dir/web-deployment-state.json"
  jq -e '(.spec.replicas|type)=="number" and .spec.replicas>0
    and (.spec.minReadySeconds|type)=="number" and (.spec.progressDeadlineSeconds|type)=="number"
    and (.spec.strategy|type)=="object" and (.spec.template|type)=="object"' \
    "$snapshot_dir/web-deployment-state.json" >/dev/null \
    || fail "web deployment baseline is incomplete"
  # A release may change the web Service (ports, selector, traffic policy or
  # NodePort) before a later validation failure. Bind the complete baseline
  # Service spec plus deploy-owned metadata so rollback cannot leave candidate
  # routing in front of a restored runtime. Server/controller metadata stays
  # outside the snapshot and is preserved during restore.
  jq -cS '{metadata:{labels:(.metadata.labels//{}),annotations:((.metadata.annotations//{})|with_entries(select(.key|startswith("resonance.ai/"))))},spec:.spec}' \
    <<<"$web_service_json" >"$snapshot_dir/web-service.json"
  annotations_hash="$(sha256sum "$snapshot_dir/deployment-annotations.json" | awk '{print $1}')"
  template_hash="$(sha256sum "$snapshot_dir/pod-template.json" | awk '{print $1}')"
  rollout_policy_hash="$(sha256sum "$snapshot_dir/deployment-rollout-policy.json" | awk '{print $1}')"
  web_state_hash="$(sha256sum "$snapshot_dir/web-deployment-state.json" | awk '{print $1}')"
  service_hash="$(sha256sum "$snapshot_dir/web-service.json" | awk '{print $1}')"
  kubectl -n "$NAMESPACE" get configmap carbonet-web-nginx -o jsonpath='{.data.nginx\.conf}' \
    >"$snapshot_dir/nginx.conf"
  test -s "$snapshot_dir/nginx.conf"
  nginx_hash="$(sha256sum "$snapshot_dir/nginx.conf" | awk '{print $1}')"

  for marker_spec in "applied:$APPLIED_MARKER_FILE" "runtime:$RUNTIME_MARKER_FILE"; do
    marker_label="${marker_spec%%:*}"
    marker_path="${marker_spec#*:}"
    marker_value=""
    marker_hash=""
    if [[ -e "$marker_path" || -L "$marker_path" ]]; then
      [[ -f "$marker_path" && ! -L "$marker_path" ]] || { rm -rf -- "$snapshot_dir"; fail "$marker_label marker is unsafe"; }
      marker_value="$(tr -d '[:space:]' <"$marker_path")"
      [[ "$marker_value" =~ ^[0-9a-f]{40}$ ]] || { rm -rf -- "$snapshot_dir"; fail "$marker_label marker commit is invalid"; }
      marker_hash="$(sha256sum "$marker_path" | awk '{print $1}')"
    fi
    if [[ "$marker_label" == applied ]]; then
      applied_marker="$marker_value"; applied_marker_hash="$marker_hash"
    else
      runtime_marker="$marker_value"; runtime_marker_hash="$marker_hash"
    fi
  done

  jq -nS \
    --arg snapshotId "$snapshot_id" --arg snapshotFormat "$snapshot_format" \
    --arg sourceCommit "$git_sha" --arg runtimeImageRef "$runtime_image" \
    --arg runtimeImageId "$runtime_image_id" --arg webImageRef "$web_image" \
    --arg deploymentUid "$(jq -r '.metadata.uid' <<<"$runtime_json")" \
    --argjson deploymentGeneration "$(jq -r '.metadata.generation' <<<"$runtime_json")" \
    --argjson runtimeDesiredReplicas "$desired_replicas" \
    --arg annotationsHash "$annotations_hash" --arg templateHash "$template_hash" \
    --arg rolloutPolicyHash "$rollout_policy_hash" \
    --arg webStateHash "$web_state_hash" \
    --arg webServiceHash "$service_hash" \
    --arg overlayHash "$overlay_hash" --arg nginxHash "$nginx_hash" \
    --arg appliedCommit "$applied_marker" --arg appliedHash "$applied_marker_hash" \
    --arg runtimeCommit "$runtime_marker" --arg runtimeHash "$runtime_marker_hash" '
    {
      schemaVersion:2,snapshotId:$snapshotId,snapshotFormat:$snapshotFormat,
      sourceCommit:$sourceCommit,runtimeImageRef:$runtimeImageRef,runtimeImageId:$runtimeImageId,
      webImageRef:$webImageRef,deploymentUid:$deploymentUid,deploymentGeneration:$deploymentGeneration,
      runtimeDesiredReplicas:$runtimeDesiredReplicas,
      deploymentAnnotationsSha256:$annotationsHash,podTemplateSha256:$templateHash,
      deploymentRolloutPolicySha256:$rolloutPolicyHash,
      webDeploymentStateSha256:$webStateHash,
      webServiceSha256:$webServiceHash,
      overlaySha256:$overlayHash,nginxSha256:$nginxHash,
      appliedMarkerCommit:(if $appliedCommit=="" then null else $appliedCommit end),
      appliedMarkerSha256:(if $appliedHash=="" then null else $appliedHash end),
      runtimeMarkerCommit:(if $runtimeCommit=="" then null else $runtimeCommit end),
      runtimeMarkerSha256:(if $runtimeHash=="" then null else $runtimeHash end)
    }
  ' >"$snapshot_dir/manifest.json"
  manifest_hash="$(sha256sum "$snapshot_dir/manifest.json" | awk '{print $1}')"
  chmod 0400 "$snapshot_dir/frontend-overlay.tar" "$snapshot_dir/nginx.conf" \
    "$snapshot_dir/deployment-annotations.json" "$snapshot_dir/pod-template.json" \
    "$snapshot_dir/deployment-rollout-policy.json" "$snapshot_dir/web-deployment-state.json" \
    "$snapshot_dir/web-service.json" "$snapshot_dir/manifest.json"

  active_tmp="$(mktemp "$STATE_DIR/.active.env.XXXXXX")" || {
    rm -rf -- "$snapshot_dir"
    fail "active rollback pointer temp allocation failed"
  }
  require_safe_path "$active_tmp" "$STATE_DIR"
  if ! cat > "$active_tmp" <<EOF
ACTIVE_SCHEMA_VERSION='2'
SNAPSHOT_ID='$snapshot_id'
SNAPSHOT_DIR='$snapshot_dir'
SNAPSHOT_FORMAT='$snapshot_format'
RUNTIME_IMAGE='$runtime_image'
RUNTIME_IMAGE_ID='$runtime_image_id'
WEB_IMAGE='$web_image'
GIT_SHA='$git_sha'
BASELINE_SOURCE_COMMIT='$git_sha'
SNAPSHOT_MANIFEST_SHA256='$manifest_hash'
DEPLOYMENT_ANNOTATIONS_SHA256='$annotations_hash'
POD_TEMPLATE_SHA256='$template_hash'
EOF
  then
    rm -f -- "$active_tmp"
    rm -rf -- "$snapshot_dir"
    fail "active rollback pointer temp write failed"
  fi
  if ! chmod 0600 "$active_tmp"; then
    rm -f -- "$active_tmp"
    rm -rf -- "$snapshot_dir"
    fail "active rollback pointer temp permission failed"
  fi
  if [[ ! -f "$active_tmp" || -L "$active_tmp" \
     || "$(stat -c '%a' "$active_tmp" 2>/dev/null)" != 600 \
     || "$(sed -n '1p' "$active_tmp")" != "ACTIVE_SCHEMA_VERSION='2'" \
     || "$(sed -n '2p' "$active_tmp")" != "SNAPSHOT_ID='$snapshot_id'" \
     || "$(sed -n '3p' "$active_tmp")" != "SNAPSHOT_DIR='$snapshot_dir'" ]]; then
    rm -f -- "$active_tmp"
    rm -rf -- "$snapshot_dir"
    fail "active rollback pointer temp verification failed"
  fi
  if [[ -e "$ACTIVE_FILE" || -L "$ACTIVE_FILE" ]]; then
    if [[ ! -f "$ACTIVE_FILE" || -L "$ACTIVE_FILE" ]]; then
      rm -f -- "$active_tmp"
      rm -rf -- "$snapshot_dir"
      fail "active rollback pointer target changed before publish"
    fi
  fi
  if ! mv -fT -- "$active_tmp" "$ACTIVE_FILE"; then
    rm -f -- "$active_tmp"
    rm -rf -- "$snapshot_dir"
    fail "active rollback pointer publish failed"
  fi
  if [[ ! -f "$ACTIVE_FILE" || -L "$ACTIVE_FILE" \
     || "$(stat -c '%a' "$ACTIVE_FILE" 2>/dev/null)" != 600 \
     || "$(sed -n '1p' "$ACTIVE_FILE")" != "ACTIVE_SCHEMA_VERSION='2'" \
     || "$(sed -n '2p' "$ACTIVE_FILE")" != "SNAPSHOT_ID='$snapshot_id'" \
     || "$(sed -n '3p' "$ACTIVE_FILE")" != "SNAPSHOT_DIR='$snapshot_dir'" ]]; then
    fail "active rollback pointer reread verification failed"
  fi
  umask "$previous_umask"
  log "captured snapshot=$snapshot_id format=$snapshot_format runtime=$runtime_image imageID=$runtime_image_id web=$web_image git=$git_sha manifest=$manifest_hash"
}

restore_marker_from_manifest() {
  local commit_field="$1" hash_field="$2" destination="$3" label="$4"
  local expected_commit expected_hash directory name temporary=""
  expected_commit="$(jq -r --arg field "$commit_field" '.[$field] // empty' "$SNAPSHOT_DIR/manifest.json")"
  expected_hash="$(jq -r --arg field "$hash_field" '.[$field] // empty' "$SNAPSHOT_DIR/manifest.json")"
  directory="$(dirname "$destination")"; name="$(basename "$destination")"
  [[ "$name" != . && "$name" != .. ]] || fail "$label marker destination is unsafe"
  mkdir -p "$directory"
  directory="$(realpath "$directory")"; destination="$directory/$name"
  if [[ -e "$destination" || -L "$destination" ]]; then
    [[ -f "$destination" && ! -L "$destination" ]] || fail "$label marker target is unsafe"
  fi
  if [[ -z "$expected_commit" ]]; then
    [[ -z "$expected_hash" ]] || fail "$label absent marker hash is not empty"
    rm -f -- "$destination"
    return
  fi
  [[ "$expected_commit" =~ ^[0-9a-f]{40}$ && "$expected_hash" =~ ^[0-9a-f]{64}$ ]] \
    || fail "$label marker manifest identity is invalid"
  temporary="$(mktemp "$directory/.${name}.rollback.XXXXXX")"
  printf '%s\n' "$expected_commit" >"$temporary"
  chmod 0644 "$temporary"
  [[ "$(sha256sum "$temporary" | awk '{print $1}')" == "$expected_hash" ]] \
    || { rm -f -- "$temporary"; fail "$label marker prepared hash mismatch"; }
  mv -fT -- "$temporary" "$destination"
}

verify_marker_from_manifest() {
  local commit_field="$1" hash_field="$2" destination="$3" label="$4"
  local expected_commit expected_hash actual_commit actual_hash
  expected_commit="$(jq -r --arg field "$commit_field" '.[$field] // empty' "$SNAPSHOT_DIR/manifest.json")"
  expected_hash="$(jq -r --arg field "$hash_field" '.[$field] // empty' "$SNAPSHOT_DIR/manifest.json")"
  if [[ -z "$expected_commit" ]]; then
    [[ ! -e "$destination" && ! -L "$destination" ]] || fail "$label marker should be absent"
    return
  fi
  [[ -f "$destination" && ! -L "$destination" ]] || fail "$label marker is missing or unsafe"
  actual_commit="$(tr -d '[:space:]' <"$destination")"
  actual_hash="$(sha256sum "$destination" | awk '{print $1}')"
  [[ "$actual_commit" == "$expected_commit" && "$actual_hash" == "$expected_hash" ]] \
    || fail "$label marker differs from immutable baseline"
}

verify_snapshot_manifest_files() {
  [[ -n "${SNAPSHOT_MANIFEST_SHA256:-}" ]] || return 0
  local annotations_hash template_hash rollout_policy_hash web_state_hash service_hash nginx_hash
  annotations_hash="$(sha256sum "$SNAPSHOT_DIR/deployment-annotations.json" | awk '{print $1}')"
  template_hash="$(sha256sum "$SNAPSHOT_DIR/pod-template.json" | awk '{print $1}')"
  rollout_policy_hash="$(sha256sum "$SNAPSHOT_DIR/deployment-rollout-policy.json" | awk '{print $1}')"
  web_state_hash="$(sha256sum "$SNAPSHOT_DIR/web-deployment-state.json" | awk '{print $1}')"
  service_hash="$(sha256sum "$SNAPSHOT_DIR/web-service.json" | awk '{print $1}')"
  nginx_hash="$(sha256sum "$SNAPSHOT_DIR/nginx.conf" | awk '{print $1}')"
  jq -e --arg snapshot "$SNAPSHOT_ID" --arg source "$BASELINE_SOURCE_COMMIT" \
    --arg image "$RUNTIME_IMAGE" --arg imageId "$RUNTIME_IMAGE_ID" \
    --arg annotations "$annotations_hash" --arg template "$template_hash" \
    --arg rolloutPolicy "$rollout_policy_hash" \
    --arg webState "$web_state_hash" \
    --arg service "$service_hash" --arg nginx "$nginx_hash" '
    .schemaVersion==2 and .snapshotId==$snapshot and .sourceCommit==$source
    and .runtimeImageRef==$image and .runtimeImageId==$imageId
    and (.runtimeDesiredReplicas|type)=="number" and .runtimeDesiredReplicas>0
    and .deploymentAnnotationsSha256==$annotations and .podTemplateSha256==$template
    and .deploymentRolloutPolicySha256==$rolloutPolicy
    and .webDeploymentStateSha256==$webState
    and .webServiceSha256==$service
    and .nginxSha256==$nginx
  ' "$SNAPSHOT_DIR/manifest.json" >/dev/null || fail "snapshot manifest file binding mismatch"
}

verify_restored_physical_loaded() {
  verify_snapshot_manifest_files
  local overlay_hash runtime_json web_json service_json selector pods_json image_id desired ready_count current_nginx nginx_hash owned_annotations owned_service_annotations web_owned_annotations web_desired pod health_json
  local -a ready_pods=()
  overlay_hash="$(cd "$OVERLAY_DIR" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum | sha256sum | awk '{print $1}')"
  [[ "$overlay_hash" == "$(jq -r '.overlaySha256' "$SNAPSHOT_DIR/manifest.json")" ]] \
    || fail "restored overlay differs from immutable baseline"
  runtime_json="$(kubectl -n "$NAMESPACE" get deployment "$RUNTIME_DEPLOYMENT" -o json)"
  desired="$(jq -r '.runtimeDesiredReplicas' "$SNAPSHOT_DIR/manifest.json")"
  owned_annotations="$(jq -cS '(.metadata.annotations//{})|with_entries(select(.key|startswith("resonance.ai/")))' <<<"$runtime_json")"
  jq -e --argjson desired "$desired" --argjson owned "$owned_annotations" --arg container "$RUNTIME_CONTAINER" \
    --slurpfile baselineOwned "$SNAPSHOT_DIR/deployment-annotations.json" \
    --slurpfile template "$SNAPSHOT_DIR/pod-template.json" \
    --slurpfile policy "$SNAPSHOT_DIR/deployment-rollout-policy.json" --arg image "$RUNTIME_IMAGE" '
    $owned==$baselineOwned[0] and .spec.template==$template[0]
    and ({minReadySeconds:.spec.minReadySeconds,progressDeadlineSeconds:.spec.progressDeadlineSeconds,strategy:.spec.strategy}==$policy[0])
    and any(.spec.template.spec.containers[]?;.name==$container and .image==$image)
    and (.status.observedGeneration // -1) >= (.metadata.generation // 0)
    and (.status.updatedReplicas // 0)==$desired
    and (.status.readyReplicas // 0)==$desired
    and (.status.availableReplicas // 0)==$desired
    and (.status.unavailableReplicas // 0)==0
  ' <<<"$runtime_json" >/dev/null || fail "restored deployment owned annotations/template/readiness differ from baseline"
  service_json="$(kubectl -n "$NAMESPACE" get service "$WEB_SERVICE" -o json)"
  owned_service_annotations="$(jq -cS '(.metadata.annotations//{})|with_entries(select(.key|startswith("resonance.ai/")))' <<<"$service_json")"
  jq -e --argjson owned "$owned_service_annotations" --slurpfile baseline "$SNAPSHOT_DIR/web-service.json" '
    .spec==$baseline[0].spec and (.metadata.labels//{})==$baseline[0].metadata.labels
    and $owned==$baseline[0].metadata.annotations
  ' <<<"$service_json" >/dev/null || fail "restored web Service differs from immutable baseline"
  web_json="$(kubectl -n "$NAMESPACE" get deployment "$WEB_DEPLOYMENT" -o json)"
  web_owned_annotations="$(jq -cS '(.metadata.annotations//{})|with_entries(select(.key|startswith("resonance.ai/")))' <<<"$web_json")"
  web_desired="$(jq -r '.spec.replicas' "$SNAPSHOT_DIR/web-deployment-state.json")"
  jq -e --argjson owned "$web_owned_annotations" --argjson desired "$web_desired" \
    --slurpfile baseline "$SNAPSHOT_DIR/web-deployment-state.json" '
    $owned==$baseline[0].metadata.annotations
    and ({replicas:.spec.replicas,minReadySeconds:.spec.minReadySeconds,
      progressDeadlineSeconds:.spec.progressDeadlineSeconds,strategy:.spec.strategy,template:.spec.template}==$baseline[0].spec)
    and (.status.observedGeneration // -1) >= (.metadata.generation // 0)
    and (.status.updatedReplicas // 0)==$desired and (.status.readyReplicas // 0)==$desired
    and (.status.availableReplicas // 0)==$desired and (.status.unavailableReplicas // 0)==0
  ' <<<"$web_json" >/dev/null || fail "restored web Deployment differs from immutable baseline"
  selector="$(jq -r '.spec.selector.matchLabels//{}|to_entries|map("\(.key)=\(.value)")|join(",")' <<<"$runtime_json")"
  pods_json="$(kubectl -n "$NAMESPACE" get pods -l "$selector" -o json)"
  ready_count="$(jq -r --arg container "$RUNTIME_CONTAINER" --arg image "$RUNTIME_IMAGE" '
    [.items[]
      | select(.metadata.deletionTimestamp==null)
      | select(.status.phase=="Running")
      | select(any(.status.conditions[]?;.type=="Ready" and .status=="True"))
      | select(any(.spec.containers[]?;.name==$container and .image==$image))
      | select(any(.status.containerStatuses[]?;.name==$container and .ready==true))]
    | length
  ' <<<"$pods_json")"
  image_id="$(jq -r --arg container "$RUNTIME_CONTAINER" --arg image "$RUNTIME_IMAGE" '
    [.items[]
      | select(.metadata.deletionTimestamp==null)
      | select(.status.phase=="Running")
      | select(any(.status.conditions[]?;.type=="Ready" and .status=="True"))
      | select(any(.spec.containers[]?;.name==$container and .image==$image))
      | .status.containerStatuses[]?
      | select(.name==$container and .ready==true)
      | .imageID]
    | unique | if length==1 then .[0] else empty end
  ' <<<"$pods_json")"
  [[ "$ready_count" == "$desired" && "$image_id" == "$RUNTIME_IMAGE_ID" ]] \
    || fail "restored Ready pod count/imageID differs from immutable baseline"
  mapfile -t ready_pods < <(jq -r --arg container "$RUNTIME_CONTAINER" --arg image "$RUNTIME_IMAGE" '
    .items[]
    | select(.metadata.deletionTimestamp==null)
    | select(.status.phase=="Running")
    | select(any(.status.conditions[]?;.type=="Ready" and .status=="True"))
    | select(any(.spec.containers[]?;.name==$container and .image==$image))
    | select(any(.status.containerStatuses[]?;.name==$container and .ready==true))
    | .metadata.name
  ' <<<"$pods_json")
  [[ "${#ready_pods[@]}" == "$desired" ]] || fail "restored runtime pod list differs from desired replicas"
  for pod in "${ready_pods[@]}"; do
    health_json="$(kubectl -n "$NAMESPACE" exec "$pod" -c "$RUNTIME_CONTAINER" -- \
      curl -fsS --max-time 15 http://127.0.0.1:8080/actuator/health)" \
      || fail "restored pod-local health request failed pod=$pod"
    jq -e '.status=="UP"' <<<"$health_json" >/dev/null \
      || fail "restored pod-local health is not UP pod=$pod"
  done
  current_nginx="$(mktemp "$STATE_DIR/verify-nginx.XXXXXX")"
  kubectl -n "$NAMESPACE" get configmap carbonet-web-nginx -o jsonpath='{.data.nginx\.conf}' >"$current_nginx"
  nginx_hash="$(sha256sum "$current_nginx" | awk '{print $1}')"
  rm -f -- "$current_nginx"
  [[ "$nginx_hash" == "$(jq -r '.nginxSha256' "$SNAPSHOT_DIR/manifest.json")" ]] \
    || fail "restored nginx differs from immutable baseline"
}

verify_restored_physical() {
  load_active
  verify_restored_physical_loaded
  log "verified physical restore snapshot=$SNAPSHOT_ID"
}

restore_physical() {
  load_active
  local restore_dir current_web restore_is_temp=false current_nginx="" index_tmp=""
  local runtime_patch runtime_after current_annotations desired_annotations
  local current_service current_service_annotations desired_service_annotations service_patch
  local web_after current_web_annotations desired_web_annotations web_patch
  verify_snapshot_manifest_files
  case "$SNAPSHOT_FORMAT" in
    hardlink-tree)
      restore_dir="$SNAPSHOT_DIR/frontend-overlay"
      test -s "$restore_dir/index.html"
      ;;
    plain-tar)
      restore_dir="$(mktemp -d "$STATE_DIR/restore.XXXXXX")"
      restore_is_temp=true
      require_safe_path "$restore_dir" "$STATE_DIR"
      tar -C "$restore_dir" -xf "$SNAPSHOT_DIR/frontend-overlay.tar"
      ;;
    legacy-gzip)
      restore_dir="$(mktemp -d "$STATE_DIR/restore.XXXXXX")"
      restore_is_temp=true
      require_safe_path "$restore_dir" "$STATE_DIR"
      tar -C "$restore_dir" -xzf "$SNAPSHOT_DIR/frontend-overlay.tar.gz"
      ;;
    *) fail "unsupported snapshot format: $SNAPSHOT_FORMAT" ;;
  esac
  node "$ASSET_CLOSURE_VERIFIER" "$restore_dir"
  [[ -d "$OVERLAY_DIR" && ! -L "$OVERLAY_DIR" ]] || fail "live overlay destination is unsafe"
  # Keep the currently served candidate closure complete while all baseline
  # assets are copied. Publish the baseline index only after its referenced
  # chunks exist, then delete candidate-only files which the new index cannot
  # reference. Every externally visible cut point therefore has a full graph.
  rsync -a --exclude='/index.html' -- "$restore_dir/" "$OVERLAY_DIR/"
  index_tmp="$(mktemp "$OVERLAY_DIR/.index.html.rollback.XXXXXX")"
  cp -- "$restore_dir/index.html" "$index_tmp"
  mv -fT -- "$index_tmp" "$OVERLAY_DIR/index.html"
  rsync -a --delete-after --exclude='/index.html' -- "$restore_dir/" "$OVERLAY_DIR/"
  node "$ASSET_CLOSURE_VERIFIER" "$OVERLAY_DIR"

  # Never write comparison state into the immutable snapshot tree.
  current_nginx="$(mktemp "$STATE_DIR/current-nginx.XXXXXX")"
  kubectl -n "$NAMESPACE" get configmap carbonet-web-nginx -o jsonpath='{.data.nginx\.conf}' >"$current_nginx"
  if ! cmp -s "$current_nginx" "$SNAPSHOT_DIR/nginx.conf"; then
    kubectl -n "$NAMESPACE" create configmap carbonet-web-nginx \
      --from-file="nginx.conf=$SNAPSHOT_DIR/nginx.conf" --dry-run=client -o yaml | kubectl apply -f -
    kubectl -n "$NAMESPACE" rollout restart "deployment/$WEB_DEPLOYMENT"
  fi
  rm -f -- "$current_nginx"

  current_web="$(kubectl -n "$NAMESPACE" get deployment "$WEB_DEPLOYMENT" -o jsonpath='{.spec.template.spec.containers[0].image}')"
  if [[ -n "${SNAPSHOT_MANIFEST_SHA256:-}" ]]; then
    runtime_after="$(kubectl -n "$NAMESPACE" get deployment "$RUNTIME_DEPLOYMENT" -o json)"
    current_annotations="$(jq -cS '.metadata.annotations//{}' <<<"$runtime_after")"
    desired_annotations="$(jq -cnS --argjson current "$current_annotations" \
      --slurpfile baseline "$SNAPSHOT_DIR/deployment-annotations.json" '
      ($current|with_entries(select((.key|startswith("resonance.ai/"))|not))) + $baseline[0]
    ')"
    runtime_patch="$(jq -n --argjson annotations "$desired_annotations" \
      --slurpfile template "$SNAPSHOT_DIR/pod-template.json" \
      --slurpfile policy "$SNAPSHOT_DIR/deployment-rollout-policy.json" '
      [{op:"add",path:"/metadata/annotations",value:$annotations},
       {op:"add",path:"/spec/template",value:$template[0]},
       {op:"add",path:"/spec/minReadySeconds",value:$policy[0].minReadySeconds},
       {op:"add",path:"/spec/progressDeadlineSeconds",value:$policy[0].progressDeadlineSeconds},
       {op:"add",path:"/spec/strategy",value:$policy[0].strategy}]
    ')"
    kubectl -n "$NAMESPACE" patch "deployment/$RUNTIME_DEPLOYMENT" --type=json -p "$runtime_patch" >/dev/null
    current_service="$(kubectl -n "$NAMESPACE" get service "$WEB_SERVICE" -o json)"
    current_service_annotations="$(jq -cS '.metadata.annotations//{}' <<<"$current_service")"
    desired_service_annotations="$(jq -cnS --argjson current "$current_service_annotations" \
      --slurpfile baseline "$SNAPSHOT_DIR/web-service.json" '
      ($current|with_entries(select((.key|startswith("resonance.ai/"))|not))) + $baseline[0].metadata.annotations
    ')"
    service_patch="$(jq -n --argjson annotations "$desired_service_annotations" \
      --slurpfile baseline "$SNAPSHOT_DIR/web-service.json" '
      [{op:"add",path:"/metadata/labels",value:$baseline[0].metadata.labels},
       {op:"add",path:"/metadata/annotations",value:$annotations},
       {op:"replace",path:"/spec",value:$baseline[0].spec}]
    ')"
    kubectl -n "$NAMESPACE" patch "service/$WEB_SERVICE" --type=json -p "$service_patch" >/dev/null
    web_after="$(kubectl -n "$NAMESPACE" get deployment "$WEB_DEPLOYMENT" -o json)"
    current_web_annotations="$(jq -cS '.metadata.annotations//{}' <<<"$web_after")"
    desired_web_annotations="$(jq -cnS --argjson current "$current_web_annotations" \
      --slurpfile baseline "$SNAPSHOT_DIR/web-deployment-state.json" '
      ($current|with_entries(select((.key|startswith("resonance.ai/"))|not))) + $baseline[0].metadata.annotations
    ')"
    web_patch="$(jq -n --argjson annotations "$desired_web_annotations" \
      --slurpfile baseline "$SNAPSHOT_DIR/web-deployment-state.json" '
      [{op:"add",path:"/metadata/annotations",value:$annotations},
       {op:"add",path:"/spec/replicas",value:$baseline[0].spec.replicas},
       {op:"add",path:"/spec/minReadySeconds",value:$baseline[0].spec.minReadySeconds},
       {op:"add",path:"/spec/progressDeadlineSeconds",value:$baseline[0].spec.progressDeadlineSeconds},
       {op:"add",path:"/spec/strategy",value:$baseline[0].spec.strategy},
       {op:"add",path:"/spec/template",value:$baseline[0].spec.template}]
    ')"
    kubectl -n "$NAMESPACE" patch "deployment/$WEB_DEPLOYMENT" --type=json -p "$web_patch" >/dev/null
  else
    # Read-only compatibility for a pre-manifest legacy snapshot.
    kubectl -n "$NAMESPACE" set image "deployment/$RUNTIME_DEPLOYMENT" "$RUNTIME_CONTAINER=$RUNTIME_IMAGE" >/dev/null
  fi
  if [[ -z "${SNAPSHOT_MANIFEST_SHA256:-}" ]]; then
    [[ "$current_web" == "$WEB_IMAGE" ]] || kubectl -n "$NAMESPACE" set image "deployment/$WEB_DEPLOYMENT" "$WEB_CONTAINER=$WEB_IMAGE" >/dev/null
  fi
  kubectl -n "$NAMESPACE" rollout status "deployment/$RUNTIME_DEPLOYMENT" --timeout=600s
  kubectl -n "$NAMESPACE" rollout status "deployment/$WEB_DEPLOYMENT" --timeout=180s
  curl -fsS --max-time 15 "$BASE_URL/actuator/health" | grep -q '"status":"UP"'
  if [[ -n "${SNAPSHOT_MANIFEST_SHA256:-}" ]]; then
    verify_restored_physical_loaded
  fi
  [[ "$restore_is_temp" == "true" ]] && rm -rf "$restore_dir"
  # Frontend prebuild generators update tracked inventories before smoke tests.
  # A rejected deployment must restore those build-only changes as well as the
  # live overlay, otherwise the next guarded deployment refuses a dirty
  # persistent worktree. The helper is allowlist-only and preserves all other
  # source modifications.
  if [[ "${CARBONET_RECOVERY_ONLY:-false}" != true ]]; then
    bash "$ROOT_DIR/ops/scripts/cleanup-failed-frontend-generated-changes.sh" "$ROOT_DIR"
  fi
  log "restored physical snapshot=$SNAPSHOT_ID"
}

restore_markers() {
  load_active
  [[ -n "${SNAPSHOT_MANIFEST_SHA256:-}" ]] || fail "marker restore requires a versioned snapshot manifest"
  verify_snapshot_manifest_files
  restore_marker_from_manifest appliedMarkerCommit appliedMarkerSha256 "$APPLIED_MARKER_FILE" applied
  restore_marker_from_manifest runtimeMarkerCommit runtimeMarkerSha256 "$RUNTIME_MARKER_FILE" runtime
  log "restored markers snapshot=$SNAPSHOT_ID"
}

verify_markers() {
  load_active
  [[ -n "${SNAPSHOT_MANIFEST_SHA256:-}" ]] || fail "marker verification requires a versioned snapshot manifest"
  verify_snapshot_manifest_files
  verify_marker_from_manifest appliedMarkerCommit appliedMarkerSha256 "$APPLIED_MARKER_FILE" applied
  verify_marker_from_manifest runtimeMarkerCommit runtimeMarkerSha256 "$RUNTIME_MARKER_FILE" runtime
  log "verified markers snapshot=$SNAPSHOT_ID"
}

restore() {
  restore_physical
  restore_markers
}

read_credentials() {
  if [[ -z "${FULL_SCREEN_SMOKE_ADMIN_USER:-}" ]]; then
    FULL_SCREEN_SMOKE_ADMIN_USER="$(kubectl -n "$NAMESPACE" get secret "$CREDENTIAL_SECRET" -o jsonpath='{.data.username}' | base64 -d)"
  fi
  if [[ -z "${FULL_SCREEN_SMOKE_ADMIN_PASSWORD:-}" ]]; then
    FULL_SCREEN_SMOKE_ADMIN_PASSWORD="$(kubectl -n "$NAMESPACE" get secret "$CREDENTIAL_SECRET" -o jsonpath='{.data.password}' | base64 -d)"
  fi
  export FULL_SCREEN_SMOKE_ADMIN_USER FULL_SCREEN_SMOKE_ADMIN_PASSWORD
  [[ -n "$FULL_SCREEN_SMOKE_ADMIN_USER" && -n "$FULL_SCREEN_SMOKE_ADMIN_PASSWORD" ]] || fail "smoke credentials are empty"
}

verify() {
  load_active
  read_credentials
  local run_id run_report smoke_status=0 summary_status=0
  run_id="$(date +%Y%m%d-%H%M%S)-$SNAPSHOT_ID"
  run_report="$REPORT_DIR/$run_id"
  mkdir -p "$run_report"

  log "verifying snapshot=$SNAPSHOT_ID changedOnly=${FULL_SCREEN_SMOKE_CHANGED_ONLY:-false}"
  set +e
  (
    cd "$FRONTEND_DIR"
    FULL_SCREEN_SMOKE_CHANGED_ONLY="${FULL_SCREEN_SMOKE_CHANGED_ONLY:-false}" \
    FULL_SCREEN_SMOKE_ROUTE_PATTERN="${FULL_SCREEN_SMOKE_ROUTE_PATTERN:-}" \
    FULL_SCREEN_SMOKE_SHARDS="${FULL_SCREEN_SMOKE_SHARDS:-1}" \
    FULL_SCREEN_SMOKE_REQUIRE_PREAUTH="${FULL_SCREEN_SMOKE_REQUIRE_PREAUTH:-${FULL_SCREEN_GATE_DEFER_ACCEPT:-false}}" \
    FULL_SCREEN_SMOKE_SKIP_QUALITY_REFRESH="${FULL_SCREEN_SMOKE_SKIP_QUALITY_REFRESH:-true}" \
    FULL_SCREEN_SMOKE_SUMMARY="$run_report/summary.json" \
      bash scripts/run-full-screen-smoke.sh
  ) 2>&1 | tee "$run_report/run.log"
  smoke_status=${PIPESTATUS[0]}
  set -e
  if [[ "$smoke_status" -ne 0 \
     && "${FULL_SCREEN_GATE_BROWSER_TRANSPORT_RETRY:-true}" == "true" ]] \
     && node "$ROOT_DIR/ops/scripts/classify-browser-transport-failure.mjs" \
          "$run_report/run.log" "$run_report/summary.json"; then
    mv "$run_report/run.log" "$run_report/run-attempt-1.log"
    [[ ! -f "$run_report/summary.json" ]] || \
      cp "$run_report/summary.json" "$run_report/summary-attempt-1.json"
    log "transient browser transport failure; retrying once with a fresh single-worker browser"
    set +e
    (
      cd "$FRONTEND_DIR"
      FULL_SCREEN_SMOKE_CHANGED_ONLY="${FULL_SCREEN_SMOKE_CHANGED_ONLY:-false}" \
      FULL_SCREEN_SMOKE_ROUTE_PATTERN="${FULL_SCREEN_SMOKE_ROUTE_PATTERN:-}" \
      FULL_SCREEN_SMOKE_SHARDS="${FULL_SCREEN_SMOKE_SHARDS:-1}" \
      FULL_SCREEN_SMOKE_REQUIRE_PREAUTH="${FULL_SCREEN_SMOKE_REQUIRE_PREAUTH:-${FULL_SCREEN_GATE_DEFER_ACCEPT:-false}}" \
      FULL_SCREEN_SMOKE_SKIP_QUALITY_REFRESH="${FULL_SCREEN_SMOKE_SKIP_QUALITY_REFRESH:-true}" \
      FULL_SCREEN_SMOKE_SUMMARY="$run_report/summary.json" \
      FULL_SCREEN_SMOKE_WORKERS=1 \
      FULL_SCREEN_SMOKE_RETRIES=0 \
        bash scripts/run-full-screen-smoke.sh
    ) 2>&1 | tee "$run_report/run.log"
    smoke_status=${PIPESTATUS[0]}
    set -e
  fi
  local smoke_cache_dir="${FULL_SCREEN_SMOKE_CACHE_DIR:-$FRONTEND_DIR/.cache/full-screen-smoke}"
  [[ -f "$smoke_cache_dir/manifest.json" ]] && cp "$smoke_cache_dir/manifest.json" "$run_report/manifest.json"
  [[ -f "$run_report/summary.json" ]] || summary_status=1
  [[ "${FULL_SCREEN_GATE_TEST_FORCE_FAILURE:-false}" == "true" ]] && smoke_status=97

  node - "$run_report/gate-status.json" "$smoke_status" "$SNAPSHOT_ID" <<'NODE'
const fs = require('node:fs');
const [path, status, snapshotId] = process.argv.slice(2);
fs.writeFileSync(path, JSON.stringify({
  schemaVersion: 1,
  completedAt: new Date().toISOString(),
  snapshotId,
  ok: Number(status) === 0,
  smokeExitCode: Number(status)
}, null, 2) + '\n');
NODE
  test -s "$STATUS_PAGE_TEMPLATE"
  cp "$STATUS_PAGE_TEMPLATE" "$OVERLAY_DIR/full-screen-deploy-gate-status.html"
  node - "$run_report/gate-status.json" "$run_report/summary.json" "$OVERLAY_DIR/full-screen-deploy-gate-status.json" <<'NODE'
const fs = require('node:fs');
const [gatePath, summaryPath, outputPath] = process.argv.slice(2);
const gate = JSON.parse(fs.readFileSync(gatePath, 'utf8'));
const summary = fs.existsSync(summaryPath) ? JSON.parse(fs.readFileSync(summaryPath, 'utf8')) : null;
fs.writeFileSync(outputPath, JSON.stringify({
  schemaVersion: 1,
  completedAt: gate.completedAt,
  ok: gate.ok,
  smokeExitCode: gate.smokeExitCode,
  contractCount: summary?.manifestCounts?.contractCount ?? 0,
  routeCount: summary?.manifestCounts?.routeCount ?? 0,
  testedRouteCount: summary?.testedRouteCount ?? 0,
  passedRouteCount: summary?.passedRouteCount ?? 0,
  failedRouteCount: summary?.failedRouteCount ?? 0,
  recoveredRouteCount: summary?.recoveredRouteCount ?? 0
}, null, 2) + '\n');
NODE

  if [[ "$smoke_status" -ne 0 || "$summary_status" -ne 0 ]]; then
    log "deployment rejected report=$run_report"
    if [[ "${FULL_SCREEN_GATE_AUTO_ROLLBACK:-true}" == "true" ]]; then
      restore
      log "automatic rollback completed"
    fi
    return 1
  fi
  if [[ "${FULL_SCREEN_GATE_DEFER_ACCEPT:-false}" != true ]]; then
    rm -f "$ACTIVE_FILE"
    prune_snapshots
  else
    log "candidate snapshot retained until atomic promotion snapshot=$SNAPSHOT_ID"
  fi
  find "$REPORT_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf -- {} +
  log "PASS report=$run_report"
}

accept_fast() {
  load_active
  local health_status
  health_status="$(curl -fsS --max-time 15 "$BASE_URL/actuator/health" || true)"
  [[ "$health_status" == *'"status":"UP"'* ]] || fail "fast gate health check is not UP"
  node "$ASSET_CLOSURE_VERIFIER" "$OVERLAY_DIR"
  if [[ "${FULL_SCREEN_GATE_DEFER_ACCEPT:-false}" != true ]]; then
    rm -f "$ACTIVE_FILE"
    prune_snapshots
  else
    log "candidate snapshot retained until atomic promotion snapshot=$SNAPSHOT_ID"
  fi
  log "PASS fast runtime gate snapshot=$SNAPSHOT_ID"
}

finalize_success() {
  local expected_snapshot="${FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID:-}" retired=""
  if [[ ! -e "$ACTIVE_FILE" && ! -L "$ACTIVE_FILE" && -n "$expected_snapshot" ]]; then
    retired="$STATE_DIR/retired/${expected_snapshot}.success.env"
    [[ -f "$retired" && ! -L "$retired" && "$(stat -c '%a' "$retired" 2>/dev/null)" == 600 ]] \
      || fail "successful retirement evidence is missing"
    ACTIVE_FILE="$retired"
    load_active
    log "successful candidate snapshot already retired snapshot=$SNAPSHOT_ID baseline=$BASELINE_SOURCE_COMMIT"
    return
  fi
  load_active
  mkdir -p "$STATE_DIR/retired"
  retired="$STATE_DIR/retired/${SNAPSHOT_ID}.success.env"
  [[ ! -e "$retired" && ! -L "$retired" ]] || fail "successful retirement evidence already exists"
  mv -T -- "$ACTIVE_FILE" "$retired"
  chmod 0600 "$retired"
  prune_snapshots
  log "finalized successful candidate snapshot=$SNAPSHOT_ID baseline=$BASELINE_SOURCE_COMMIT retired=$retired"
}

finalize_failed() {
  local expected_snapshot="${FULL_SCREEN_GATE_EXPECTED_SNAPSHOT_ID:-}" already_retired=false retired
  if [[ ! -e "$ACTIVE_FILE" && ! -L "$ACTIVE_FILE" && -n "$expected_snapshot" ]]; then
    [[ "$expected_snapshot" =~ ^[A-Za-z0-9._-]+$ ]] || fail "expected failed snapshot id is invalid"
    retired="$STATE_DIR/retired/${expected_snapshot}.failed.env"
    [[ -f "$retired" && ! -L "$retired" ]] || fail "failed retirement evidence is missing"
    ACTIVE_FILE="$retired"
    already_retired=true
  fi
  load_active
  [[ -n "${SNAPSHOT_MANIFEST_SHA256:-}" ]] || fail "failed finalization requires a versioned snapshot manifest"
  verify_restored_physical_loaded
  verify_marker_from_manifest appliedMarkerCommit appliedMarkerSha256 "$APPLIED_MARKER_FILE" applied
  verify_marker_from_manifest runtimeMarkerCommit runtimeMarkerSha256 "$RUNTIME_MARKER_FILE" runtime
  if [[ "$already_retired" == true ]]; then
    log "failed candidate snapshot already retired snapshot=$SNAPSHOT_ID baseline=$BASELINE_SOURCE_COMMIT retired=$retired"
    return
  fi
  mkdir -p "$STATE_DIR/retired"
  retired="$STATE_DIR/retired/${SNAPSHOT_ID}.failed.env"
  [[ ! -e "$retired" && ! -L "$retired" ]] || fail "failed retirement evidence already exists"
  mv -T -- "$ACTIVE_FILE" "$retired"
  chmod 0600 "$retired"
  log "finalized failed candidate snapshot=$SNAPSHOT_ID baseline=$BASELINE_SOURCE_COMMIT retired=$retired"
}

describe() {
  load_active
  [[ -n "${SNAPSHOT_MANIFEST_SHA256:-}" ]] || fail "snapshot describe requires a versioned manifest"
  verify_snapshot_manifest_files
  jq -c --arg snapshotDir "$SNAPSHOT_DIR" --arg manifestSha256 "$SNAPSHOT_MANIFEST_SHA256" \
    '. + {snapshotDir:$snapshotDir,snapshotManifestSha256:$manifestSha256}' \
    "$SNAPSHOT_DIR/manifest.json"
}

case "$ACTION" in
  capture) capture ;;
  verify) verify ;;
  accept-fast) accept_fast ;;
  finalize-success) finalize_success ;;
  finalize-failed) finalize_failed ;;
  describe) describe ;;
  restore) restore ;;
  restore-physical) restore_physical ;;
  verify-restored-physical) verify_restored_physical ;;
  restore-markers) restore_markers ;;
  verify-markers) verify_markers ;;
  *) fail "usage: $0 {capture|verify|accept-fast|finalize-success|finalize-failed|describe|restore|restore-physical|verify-restored-physical|restore-markers|verify-markers}" ;;
esac
