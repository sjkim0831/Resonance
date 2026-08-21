#!/usr/bin/env bash
set -euo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
APP="$ROOT/platform/control-plane/backstage"
BUILD_TMP_ROOT="${BACKSTAGE_BUILD_TMP_ROOT:-/opt/resonance-data/control-plane/build-tmp/backstage}"
DEPENDENCY_CACHE_ROOT="${BACKSTAGE_DEPENDENCY_CACHE_ROOT:-/opt/resonance-data/control-plane/dependency-cache/backstage}"
BUILDKIT_CACHE_ROOT="${BACKSTAGE_BUILDKIT_CACHE_ROOT:-/opt/resonance-data/control-plane/build-cache/backstage-buildkit}"
BACKSTAGE_BUILD_RUN_TMP=""
WORKTREE_LOCKED=false
cleanup_build_tmp() {
  local resolved
  if [[ -n "$BACKSTAGE_BUILD_RUN_TMP" ]]; then
    resolved="$(readlink -f "$BACKSTAGE_BUILD_RUN_TMP" 2>/dev/null || true)"
    case "$resolved" in
      "$(readlink -f "$BUILD_TMP_ROOT")"/*) rm -rf -- "$resolved" ;;
    esac
  fi
  if [[ "$WORKTREE_LOCKED" == "true" ]]; then
    git -C "$ROOT" worktree unlock "$ROOT" >/dev/null 2>&1 || true
  fi
}
initialize_backstage_build_workspace() {
  mkdir -p "$BUILD_TMP_ROOT"
  BACKSTAGE_BUILD_RUN_TMP="$(mktemp -d "$BUILD_TMP_ROOT/run.XXXXXXXX")"
  case "$(readlink -f "$BACKSTAGE_BUILD_RUN_TMP")" in
    "$(readlink -f "$BUILD_TMP_ROOT")"/*) ;;
    *) echo "[backstage] unsafe build temp path: $BACKSTAGE_BUILD_RUN_TMP" >&2; return 2 ;;
  esac
  export TMPDIR="$BACKSTAGE_BUILD_RUN_TMP"
  if [[ -f "$ROOT/.git" ]]; then
    git -C "$ROOT" worktree lock --reason "resonance-backstage-deploy" "$ROOT"
    WORKTREE_LOCKED=true
  fi
}
trap cleanup_build_tmp EXIT
MANIFEST="$ROOT/deploy/k8s/control-plane/backstage.yaml"
NAMESPACE="${BACKSTAGE_NAMESPACE:-resonance-ops}"
REGISTRY="${BACKSTAGE_REGISTRY:-localhost:5000}"
IMAGE_REPOSITORY="$REGISTRY/resonance-backstage"
KUBECONFIG="${KUBECONFIG:-/home/sjkim/.kube/config}"
export KUBECONFIG

BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR="${BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR:-/opt/resonance-data/control-plane/deploy-state/backstage}"
BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE="${BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE:-$BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR/deployment-rollback.pending.json}"
BACKSTAGE_DEPLOYMENT_ROLLBACK_TIMEOUT_SECONDS="${BACKSTAGE_DEPLOYMENT_ROLLBACK_TIMEOUT_SECONDS:-600}"
BACKSTAGE_DEPLOYMENT_ROLLBACK_POLL_SECONDS="${BACKSTAGE_DEPLOYMENT_ROLLBACK_POLL_SECONDS:-0.5}"
BACKSTAGE_DEPLOYMENT_FINALIZE_MODE="${BACKSTAGE_DEPLOYMENT_FINALIZE_MODE:-immediate}"
BACKSTAGE_DEPLOYMENT_TARGET_COMMIT="${BACKSTAGE_DEPLOYMENT_TARGET_COMMIT:-}"
BACKSTAGE_DEPLOYMENT_AUTHORITY_KIND="${BACKSTAGE_DEPLOYMENT_AUTHORITY_KIND:-}"
BACKSTAGE_DEPLOYMENT_ATTEMPT_ID="${BACKSTAGE_DEPLOYMENT_ATTEMPT_ID:-}"
BACKSTAGE_DEPLOYMENT_CANDIDATE_IMAGE="${BACKSTAGE_DEPLOYMENT_CANDIDATE_IMAGE:-}"
BACKSTAGE_DEPLOYMENT_RUNTIME_FINGERPRINT="${BACKSTAGE_DEPLOYMENT_RUNTIME_FINGERPRINT:-}"
BACKSTAGE_DEPLOYMENT_CLOSURE_SHA256="${BACKSTAGE_DEPLOYMENT_CLOSURE_SHA256:-}"
BACKSTAGE_DEPLOY_STATE_FILE="${BACKSTAGE_DEPLOY_STATE_FILE:-}"
BACKSTAGE_EXPECTED_PENDING_SHA256="${BACKSTAGE_EXPECTED_PENDING_SHA256:-}"
BACKSTAGE_EXPECTED_ATTEMPT_ID="${BACKSTAGE_EXPECTED_ATTEMPT_ID:-}"
BACKSTAGE_REQUIRE_BASELINE_TAG_DIGEST_PROOF="${BACKSTAGE_REQUIRE_BASELINE_TAG_DIGEST_PROOF:-false}"
BACKSTAGE_DEPLOYMENT_INHERITED_LOCK_FD="${BACKSTAGE_DEPLOYMENT_INHERITED_LOCK_FD:-}"
BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS="${BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS:-4}"
BACKSTAGE_RUNTIME_IDENTITY_FILE="${BACKSTAGE_RUNTIME_IDENTITY_FILE:-$BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR/runtime-success.identity.json}"
BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE="${BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE:-$BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR/repair-authority.json}"
BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE="${BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE:-$BACKSTAGE_DEPLOYMENT_ROLLBACK_STATE_DIR/parent-authority-binding.json}"
BACKSTAGE_DEPLOYMENT_NAME="resonance-backstage"
BACKSTAGE_DEPLOYMENT_LOCK_FD=""
BACKSTAGE_DEPLOYMENT_LOCK_HELD=false
BACKSTAGE_DEPLOY_ROLLBACK_ARMED=false
BACKSTAGE_DEPLOY_COMPLETED=false
BACKSTAGE_DEPLOY_HANDOFF=false
BACKSTAGE_DEPLOY_MARKER_PUBLISHED=false
BACKSTAGE_DEPLOY_FINALIZATION_STARTED=false
BACKSTAGE_RUNTIME_IDENTITY_PUBLISHED=false
BACKSTAGE_PENDING_STATE_JSON=""
BACKSTAGE_PENDING_SCHEMA_VERSION=""
BACKSTAGE_PENDING_PHASE=""
BACKSTAGE_PENDING_TARGET_COMMIT=""
BACKSTAGE_PENDING_AUTHORITY_KIND=""
BACKSTAGE_PENDING_FINALIZE_MODE=""
BACKSTAGE_PENDING_COORDINATOR=""
BACKSTAGE_PENDING_ATTEMPT_ID=""
BACKSTAGE_PENDING_ATTEMPT_ID_PRESENT=false
BACKSTAGE_PENDING_FILE_SHA256=""
BACKSTAGE_PENDING_RUNTIME_FINGERPRINT=""
BACKSTAGE_PENDING_DEPLOYMENT_CLOSURE_SHA256=""
BACKSTAGE_PENDING_RESOURCE_INTENTS=""
BACKSTAGE_PENDING_RUNTIME_DEPENDENCIES=""
BACKSTAGE_PENDING_RUNTIME_DEPENDENCY_CLOSURE_SHA256=""
BACKSTAGE_PENDING_BASELINE_TAG_PROOF="null"
BACKSTAGE_BASELINE_UID=""
BACKSTAGE_BASELINE_RESOURCE_VERSION=""
BACKSTAGE_BASELINE_SPEC=""
BACKSTAGE_BASELINE_SPEC_SHA256=""
BACKSTAGE_BASELINE_ROLLBACK_SPEC=""
BACKSTAGE_BASELINE_ROLLBACK_SPEC_SHA256=""
BACKSTAGE_BASELINE_MANAGED_RESOURCES=""
BACKSTAGE_CANDIDATE_IMAGE=""
BACKSTAGE_RESOLVED_CANDIDATE_IMAGE=""
BACKSTAGE_DEPLOYMENT_CANDIDATE_TAGGED_IMAGE=""
BACKSTAGE_BASELINE_TAG_RESOLUTION_PROVED=false
BACKSTAGE_BASELINE_TAG_RESOLVED_IMAGE=""
BACKSTAGE_BASELINE_ROLLBACK_HOLD_TAG=""
BACKSTAGE_PREBUILD_BASELINE_UID=""
BACKSTAGE_PREBUILD_BASELINE_SPEC_SHA256=""
BACKSTAGE_PREBUILD_BASELINE_IMAGE=""
BACKSTAGE_CANDIDATE_SPEC=""
BACKSTAGE_CANDIDATE_SPEC_SHA256=""
BACKSTAGE_CANDIDATE_MANAGED_RESOURCES=""
BACKSTAGE_CANDIDATE_LIVE_RESOURCE_CLOSURE_SHA256=""
BACKSTAGE_PLANNED_DEPLOYMENT_SPEC=""
BACKSTAGE_PLANNED_DEPLOYMENT_SPEC_SHA256=""
BACKSTAGE_DESIRED_CANDIDATE_SPEC=""
BACKSTAGE_DESIRED_CANDIDATE_SPEC_SHA256=""
BACKSTAGE_PROVED_TARGET_COMMIT=""
BACKSTAGE_PROVED_ATTEMPT_ID=""
BACKSTAGE_PROVED_RUNTIME_FINGERPRINT=""
BACKSTAGE_PROVED_DEPLOYMENT_CLOSURE_SHA256=""
BACKSTAGE_PROVED_DEPLOYMENT_UID=""
BACKSTAGE_PROVED_CANDIDATE_IMAGE=""
BACKSTAGE_PROVED_CANDIDATE_SPEC_SHA256=""
BACKSTAGE_PROVED_LIVE_RESOURCE_CLOSURE_SHA256=""
BACKSTAGE_PROVED_RUNTIME_DEPENDENCY_CLOSURE_SHA256=""
BACKSTAGE_RUNTIME_IDENTITY_JSON=""
BACKSTAGE_RUNTIME_IDENTITY_SCHEMA_VERSION=""
BACKSTAGE_RUNTIME_IDENTITY_TARGET_COMMIT=""
BACKSTAGE_RUNTIME_IDENTITY_ATTEMPT_ID=""
BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_FINGERPRINT=""
BACKSTAGE_RUNTIME_IDENTITY_DEPLOYMENT_CLOSURE_SHA256=""
BACKSTAGE_RUNTIME_IDENTITY_DEPLOYMENT_UID=""
BACKSTAGE_RUNTIME_IDENTITY_CANDIDATE_IMAGE=""
BACKSTAGE_RUNTIME_IDENTITY_CANDIDATE_SPEC_SHA256=""
BACKSTAGE_RUNTIME_IDENTITY_LIVE_RESOURCE_CLOSURE_SHA256=""
BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_DEPENDENCIES=""
BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_DEPENDENCY_CLOSURE_SHA256=""
BACKSTAGE_RUNTIME_IDENTITY_FILE_SHA256=""
BACKSTAGE_STALE_RUNTIME_IDENTITY=false
BACKSTAGE_DEPLOY_MARKER_VALUE=""
BACKSTAGE_REPAIR_AUTHORITY_JSON=""
BACKSTAGE_REPAIR_AUTHORITY_TARGET_COMMIT=""
BACKSTAGE_REPAIR_AUTHORITY_ATTEMPT_ID=""
BACKSTAGE_REPAIR_AUTHORITY_PENDING_SHA256=""
BACKSTAGE_REPAIR_AUTHORITY_STATUS=""
BACKSTAGE_REPAIR_AUTHORITY_FILE_SHA256=""
BACKSTAGE_REPAIR_AUTHORITY_FILE_STAT=""
BACKSTAGE_REPAIR_AUTHORITY_CLEAR_AFTER_ROLLBACK=false
BACKSTAGE_PARENT_AUTHORITY_BINDING_JSON=""
BACKSTAGE_PARENT_AUTHORITY_BINDING_TARGET_COMMIT=""
BACKSTAGE_PARENT_AUTHORITY_BINDING_ATTEMPT_ID=""
BACKSTAGE_PARENT_AUTHORITY_BINDING_PENDING_SHA256=""
BACKSTAGE_PARENT_AUTHORITY_BINDING_STATUS=""
BACKSTAGE_PARENT_AUTHORITY_BINDING_KIND=""
BACKSTAGE_PARENT_AUTHORITY_BINDING_RELEASE_ATTEMPT_ID=""
BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE_SHA256=""
BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE_STAT=""

backstage_rollback_fail() {
  echo "[backstage] deployment rollback state failure: $1" >&2
  return 1
}

prepare_backstage_rollback_state_directory() {
  local state_dir lexical_dir logical_dir physical_dir expected_owner
  state_dir="$(dirname -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE")"
  expected_owner="$(id -u)"
  if [[ -L "$state_dir" ]]; then
    backstage_rollback_fail "state directory is a symlink"
    return 1
  fi
  lexical_dir="$(realpath -m -s -- "$state_dir" 2>/dev/null || true)"
  logical_dir="$(readlink -m -- "$state_dir" 2>/dev/null || true)"
  [[ -n "$lexical_dir" && "$lexical_dir" == "$logical_dir" ]] || {
    backstage_rollback_fail "state directory ancestor contains a symlink"
    return 1
  }
  if [[ ! -e "$state_dir" ]]; then
    (umask 077 && mkdir -p -- "$state_dir") || {
      backstage_rollback_fail "cannot create state directory"
      return 1
    }
  fi
  [[ -d "$state_dir" && ! -L "$state_dir" ]] || {
    backstage_rollback_fail "state directory is not a directory"
    return 1
  }
  physical_dir="$(readlink -f -- "$state_dir" 2>/dev/null || true)"
  [[ -n "$logical_dir" && "$logical_dir" == "$physical_dir" ]] || {
    backstage_rollback_fail "state directory contains a symlink"
    return 1
  }
  [[ "$(stat -c '%a:%u' -- "$state_dir" 2>/dev/null || true)" == "700:$expected_owner" ]] || {
    backstage_rollback_fail "state directory owner or mode is invalid"
    return 1
  }
}

acquire_backstage_deployment_lock() {
  local state_dir expected_identity identity_before identity_after fd_identity
  local fd_resolved state_resolved lock_fd shell_pid
  prepare_backstage_rollback_state_directory || return 79
  if [[ "$BACKSTAGE_DEPLOYMENT_LOCK_HELD" == "true" ]]; then
    return 0
  fi
  # The verified 0700 state directory inode is the lock object. No separately
  # named lock file can be replaced with a symlink between validation and use.
  state_dir="$(dirname -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE")"
  expected_identity="700:$(id -u)"
  identity_before="$(stat -c '%d:%i:%a:%u' -- "$state_dir" 2>/dev/null || true)"
  [[ "$identity_before" == *":$expected_identity" ]] || {
    backstage_rollback_fail "deployment lock directory identity is invalid" || true
    return 79
  }
  if ! exec {lock_fd}<"$state_dir"; then
    backstage_rollback_fail "deployment lock directory cannot be opened" || true
    return 79
  fi
  shell_pid="$BASHPID"
  fd_identity="$(stat -Lc '%d:%i:%a:%u' -- "/proc/$shell_pid/fd/$lock_fd" 2>/dev/null || true)"
  identity_after="$(stat -c '%d:%i:%a:%u' -- "$state_dir" 2>/dev/null || true)"
  fd_resolved="$(readlink -f -- "/proc/$shell_pid/fd/$lock_fd" 2>/dev/null || true)"
  state_resolved="$(readlink -f -- "$state_dir" 2>/dev/null || true)"
  if [[ "$fd_identity" != "$identity_before" || "$identity_after" != "$identity_before" ||
        "$fd_resolved" != "$state_resolved" ]]; then
    exec {lock_fd}<&-
    backstage_rollback_fail "deployment lock directory changed while being opened" || true
    return 79
  fi
  if ! flock -n "$lock_fd"; then
    exec {lock_fd}<&-
    backstage_rollback_fail "another Backstage deploy holds the state-directory lock" || true
    return 79
  fi
  BACKSTAGE_DEPLOYMENT_LOCK_FD="$lock_fd"
  BACKSTAGE_DEPLOYMENT_LOCK_HELD=true
  echo "[backstage] exclusive state-directory deploy lock acquired"
}

adopt_inherited_backstage_deployment_lock() {
  local state_dir inherited_fd="$BACKSTAGE_DEPLOYMENT_INHERITED_LOCK_FD"
  local identity_before identity_after fd_identity fd_resolved state_resolved probe_fd shell_pid lock_record
  [[ "$inherited_fd" =~ ^[0-9]+$ && "$inherited_fd" -ge 3 ]] || {
    backstage_rollback_fail "inherited deployment lock FD is invalid; mutation=0"
    return 79
  }
  prepare_backstage_rollback_state_directory || return 79
  state_dir="$(dirname -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE")"
  identity_before="$(stat -c '%d:%i:%a:%u' -- "$state_dir" 2>/dev/null || true)"
  [[ "$identity_before" == *":700:$(id -u)" ]] || {
    backstage_rollback_fail "inherited deployment lock directory identity is invalid; mutation=0"
    return 79
  }
  shell_pid="$BASHPID"
  fd_identity="$(stat -Lc '%d:%i:%a:%u' -- "/proc/$shell_pid/fd/$inherited_fd" 2>/dev/null || true)"
  fd_resolved="$(readlink -f -- "/proc/$shell_pid/fd/$inherited_fd" 2>/dev/null || true)"
  state_resolved="$(readlink -f -- "$state_dir" 2>/dev/null || true)"
  [[ "$fd_identity" == "$identity_before" && "$fd_resolved" == "$state_resolved" ]] || {
    backstage_rollback_fail "inherited deployment lock FD does not bind the exact state directory; mutation=0"
    return 79
  }
  lock_record="$(sed -n '/^lock:.*FLOCK.*ADVISORY.*WRITE/p' \
    "/proc/$shell_pid/fdinfo/$inherited_fd" 2>/dev/null || true)"
  [[ -n "$lock_record" ]] || {
    backstage_rollback_fail "inherited deployment lock FD is not already exclusively locked; mutation=0"
    return 79
  }
  flock -n "$inherited_fd" || {
    backstage_rollback_fail "inherited deployment lock FD does not own the shared lock; mutation=0"
    return 79
  }
  if ! exec {probe_fd}<"$state_dir"; then
    backstage_rollback_fail "inherited deployment lock probe cannot open state directory; mutation=0"
    return 79
  fi
  if flock -n "$probe_fd"; then
    flock -u "$probe_fd" || true
    exec {probe_fd}<&-
    backstage_rollback_fail "inherited deployment lock is not held by its open file description; mutation=0"
    return 79
  fi
  exec {probe_fd}<&-
  identity_after="$(stat -c '%d:%i:%a:%u' -- "$state_dir" 2>/dev/null || true)"
  fd_identity="$(stat -Lc '%d:%i:%a:%u' -- "/proc/$shell_pid/fd/$inherited_fd" 2>/dev/null || true)"
  [[ "$identity_after" == "$identity_before" && "$fd_identity" == "$identity_before" ]] || {
    backstage_rollback_fail "inherited deployment lock binding changed during validation; mutation=0"
    return 79
  }
  BACKSTAGE_DEPLOYMENT_LOCK_FD="$inherited_fd"
  BACKSTAGE_DEPLOYMENT_LOCK_HELD=true
  echo "[backstage] inherited exclusive state-directory deploy lock verified"
}

backstage_pending_state_exists() {
  [[ -e "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" ||
     -L "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" ]]
}

verify_backstage_pending_state_file_security() {
  local expected_owner
  expected_owner="$(id -u)"
  [[ -f "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" &&
     ! -L "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" ]] || {
    backstage_rollback_fail "pending state is not a regular non-symlink file"
    return 1
  }
  [[ "$(stat -c '%a:%u:%h' -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" 2>/dev/null || true)" == "600:$expected_owner:1" ]] || {
    backstage_rollback_fail "pending state owner, mode, or link count is invalid"
    return 1
  }
}

validate_expected_backstage_pending_sha256() {
  [[ -z "$BACKSTAGE_EXPECTED_PENDING_SHA256" ||
     "$BACKSTAGE_EXPECTED_PENDING_SHA256" =~ ^[0-9a-f]{64}$ ]] || {
    backstage_rollback_fail "expected pending SHA-256 is invalid; mutation=0"
    return 1
  }
  if [[ -n "$BACKSTAGE_EXPECTED_PENDING_SHA256" &&
        "$BACKSTAGE_DEPLOYMENT_LOCK_HELD" != true ]]; then
    backstage_rollback_fail "expected pending SHA-256 requires the shared deploy lock; mutation=0"
    return 1
  fi
  if [[ -n "$BACKSTAGE_EXPECTED_PENDING_SHA256" ]] && ! backstage_pending_state_exists; then
    if [[ ( "${mode:-}" != finalize-pending &&
            "${mode:-}" != reconcile-parent-authority-binding ) ||
          -z "$BACKSTAGE_DEPLOYMENT_INHERITED_LOCK_FD" ||
          -z "$BACKSTAGE_EXPECTED_ATTEMPT_ID" ]]; then
      backstage_rollback_fail "expected pending state is absent; mutation=0"
      return 1
    fi
  fi
  [[ -z "$BACKSTAGE_EXPECTED_ATTEMPT_ID" ||
     "$BACKSTAGE_EXPECTED_ATTEMPT_ID" =~ ^[0-9a-f]{32}$ ]] || {
    backstage_rollback_fail "expected deployment attempt ID is invalid; mutation=0"
    return 1
  }
  if [[ -n "$BACKSTAGE_EXPECTED_ATTEMPT_ID" &&
        -z "$BACKSTAGE_EXPECTED_PENDING_SHA256" ]] && backstage_pending_state_exists; then
    backstage_rollback_fail "expected deployment attempt ID requires expected pending SHA-256; mutation=0"
    return 1
  fi
}

verify_expected_backstage_pending_binding() {
  local state_before state_after actual_sha256 actual_attempt_id=""
  validate_expected_backstage_pending_sha256 || return 1
  [[ -n "$BACKSTAGE_EXPECTED_PENDING_SHA256" ]] || return 0
  verify_backstage_pending_state_file_security || return 1
  state_before="$(stat -c '%d:%i:%s:%y:%z:%a:%u:%h' -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" 2>/dev/null || true)"
  actual_sha256="$(sha256sum -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" 2>/dev/null | awk '{print $1}')" || {
    backstage_rollback_fail "expected pending SHA-256 cannot be computed; mutation=0"
    return 1
  }
  state_after="$(stat -c '%d:%i:%s:%y:%z:%a:%u:%h' -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" 2>/dev/null || true)"
  [[ -n "$state_before" && "$state_before" == "$state_after" ]] || {
    backstage_rollback_fail "pending state inode changed during expected-hash verification; mutation=0"
    return 1
  }
  [[ "$actual_sha256" == "$BACKSTAGE_EXPECTED_PENDING_SHA256" ]] || {
    backstage_rollback_fail "pending state does not match expected SHA-256; mutation=0"
    return 1
  }
  if [[ -n "$BACKSTAGE_EXPECTED_ATTEMPT_ID" ]]; then
    actual_attempt_id="$(jq -er '.attemptId | select(type == "string")' \
      "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" 2>/dev/null || true)"
    [[ "$actual_attempt_id" == "$BACKSTAGE_EXPECTED_ATTEMPT_ID" ]] || {
      backstage_rollback_fail "pending state does not match expected deployment attempt ID; mutation=0"
      return 1
    }
  fi
}

is_exact_backstage_commit() {
  [[ "$1" =~ ^[0-9a-f]{40}$ ]]
}

is_valid_backstage_authority_kind() {
  [[ "$1" == "DB_PROMOTION" || "$1" == "APPLIED_MARKER" || "$1" == "REPAIR_TOKEN" ]]
}

is_valid_backstage_attempt_id() {
  [[ "$1" =~ ^[0-9a-f]{32}$ ]]
}

is_full_resource_backstage_pending_schema() {
  [[ "$1" == 3 || "$1" == 4 ]]
}

is_matching_backstage_pending_identity_schema_pair() {
  [[ ( "$1" == 3 && "$2" == 2 ) || ( "$1" == 4 && "$2" == 3 ) ]]
}

validate_backstage_candidate_image() {
  [[ -n "$1" && ${#1} -le 1024 && "$1" != *[[:space:]]* ]]
}

is_digest_pinned_backstage_candidate_image() {
  local image="$1" digest
  validate_backstage_candidate_image "$image" || return 1
  [[ "$image" == "$IMAGE_REPOSITORY@sha256:"* ]] || return 1
  digest="${image#"$IMAGE_REPOSITORY@"}"
  [[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]]
}

inspect_backstage_image_runtime_binding() {
  local tagged_image="$1" expected_runtime_fingerprint="$2" image_json resolved_image
  BACKSTAGE_RESOLVED_CANDIDATE_IMAGE=""
  validate_backstage_candidate_image "$tagged_image" &&
    is_valid_backstage_runtime_fingerprint "$expected_runtime_fingerprint" || return 1
  image_json="$(docker image inspect "$tagged_image" 2>/dev/null)" || return 1
  jq -e --arg fingerprint "$expected_runtime_fingerprint" '
      type == "array" and length == 1 and
      .[0].Config.Labels["io.resonance.backstage.runtime-fingerprint"] == $fingerprint
    ' <<<"$image_json" >/dev/null || return 1
  resolved_image="$(jq -er --arg prefix "$IMAGE_REPOSITORY@sha256:" '
      [.[0].RepoDigests[]? | select(startswith($prefix))] | unique |
      if length == 1 then .[0] else error("one repository digest required") end
    ' <<<"$image_json")" || return 1
  is_digest_pinned_backstage_candidate_image "$resolved_image" || return 1
  BACKSTAGE_RESOLVED_CANDIDATE_IMAGE="$resolved_image"
}

inspect_backstage_image_repository_digest() {
  local image_reference="$1" image_json resolved_image
  BACKSTAGE_RESOLVED_CANDIDATE_IMAGE=""
  validate_backstage_candidate_image "$image_reference" || return 1
  image_json="$(docker image inspect "$image_reference" 2>/dev/null)" || return 1
  resolved_image="$(jq -er --arg prefix "$IMAGE_REPOSITORY@sha256:" '
      select(type == "array" and length == 1) |
      [.[0].RepoDigests[]? | select(startswith($prefix))] | unique |
      if length == 1 then .[0] else error("one repository digest required") end
    ' <<<"$image_json")" || return 1
  is_digest_pinned_backstage_candidate_image "$resolved_image" || return 1
  BACKSTAGE_RESOLVED_CANDIDATE_IMAGE="$resolved_image"
}

wait_for_backstage_ready_pod_image_ids() {
  local expected_uid="$1" expected_image="$2" timeout_seconds="$3"
  local expected_spec_image="${4:-$expected_image}"
  local deadline deployment_json pod_json desired digest
  local lookup_succeeded=false pod_lookup_succeeded=false
  [[ -n "$expected_uid" && ${#expected_uid} -le 253 ]] &&
    is_digest_pinned_backstage_candidate_image "$expected_image" &&
    validate_backstage_candidate_image "$expected_spec_image" &&
    [[ "$timeout_seconds" =~ ^[1-9][0-9]{0,2}$ ]] || return 1
  digest="${expected_image##*@}"
  deadline="$(( $(date +%s) + timeout_seconds ))"
  while (( $(date +%s) <= deadline )); do
    if ! deployment_json="$(kubectl -n "$NAMESPACE" get deployment \
        "$BACKSTAGE_DEPLOYMENT_NAME" -o json 2>/dev/null)"; then
      sleep "$BACKSTAGE_DEPLOYMENT_ROLLBACK_POLL_SECONDS"
      continue
    fi
    lookup_succeeded=true
    desired="$(jq -er --arg uid "$expected_uid" '
        select(.metadata.uid == $uid) |
        select((.status.observedGeneration // -1) >= (.metadata.generation // 0)) |
        (.spec.replicas // 1) as $desired |
        select($desired >= 1 and (.status.updatedReplicas // 0) == $desired and
          (.status.readyReplicas // 0) == $desired and
          (.status.availableReplicas // 0) == $desired and
          (.status.unavailableReplicas // 0) == 0) |
        $desired
      ' <<<"$deployment_json" 2>/dev/null || true)"
    if [[ "$desired" =~ ^[1-9][0-9]*$ ]]; then
      if ! pod_json="$(kubectl -n "$NAMESPACE" get pods \
          -l app.kubernetes.io/name=resonance-backstage -o json 2>/dev/null)"; then
        sleep "$BACKSTAGE_DEPLOYMENT_ROLLBACK_POLL_SECONDS"
        continue
      fi
      pod_lookup_succeeded=true
      if jq -e --arg image "$expected_spec_image" --arg digest "$digest" \
          --argjson desired "$desired" '
          def ready: any(.status.conditions[]?; .type == "Ready" and .status == "True");
          type == "object" and (.items | type == "array") and
          ([.items[] | select(ready)] as $ready |
            ($ready | length) == $desired and
            all($ready[];
              .metadata.deletionTimestamp == null and
              [.spec.containers[]? | select(.name == "backstage") | .image] == [$image] and
              ([.status.containerStatuses[]? |
                 select(.name == "backstage" and .ready == true) | .imageID] as $ids |
                ($ids | length) == 1 and ($ids[0] | endswith("@" + $digest)))))
        ' <<<"$pod_json" >/dev/null 2>&1; then
        echo "[backstage] Ready Pod imageID proof PASS desired=$desired image=$expected_image"
        return 0
      fi
    fi
    sleep "$BACKSTAGE_DEPLOYMENT_ROLLBACK_POLL_SECONDS"
  done
  backstage_rollback_fail "Ready Pod imageID proof failed for immutable candidate image"
  [[ "$lookup_succeeded" == true && "$pod_lookup_succeeded" == true ]] || return 79
  return 1
}

resolve_verified_backstage_registry_image() {
  local tagged_image="$1" expected_runtime_fingerprint="$2" resolved_baseline_candidate
  BACKSTAGE_RESOLVED_CANDIDATE_IMAGE=""
  docker pull "$tagged_image" || return 1
  if [[ "$BACKSTAGE_PREBUILD_BASELINE_IMAGE" == "$tagged_image" ]]; then
    inspect_backstage_image_repository_digest "$tagged_image" || return 79
    resolved_baseline_candidate="$BACKSTAGE_RESOLVED_CANDIDATE_IMAGE"
    [[ "$BACKSTAGE_BASELINE_TAG_RESOLVED_IMAGE" == "$resolved_baseline_candidate" ]] || {
      backstage_rollback_fail "live baseline tag digest changed during registry reuse proof; mutation=0"
      return 79
    }
  fi
  inspect_backstage_image_runtime_binding "$tagged_image" \
    "$expected_runtime_fingerprint" || return 1
  if [[ "$BACKSTAGE_PREBUILD_BASELINE_IMAGE" == "$tagged_image" &&
        "$BACKSTAGE_BASELINE_TAG_RESOLVED_IMAGE" != "$BACKSTAGE_RESOLVED_CANDIDATE_IMAGE" ]]; then
    backstage_rollback_fail "live baseline tag digest differs from registry reuse candidate"
    return 1
  fi
}

resolve_verified_backstage_live_digest_image() {
  local expected_runtime_fingerprint="$1" resolved_image
  BACKSTAGE_RESOLVED_CANDIDATE_IMAGE=""
  is_digest_pinned_backstage_candidate_image "$BACKSTAGE_PREBUILD_BASELINE_IMAGE" || return 1
  [[ "$BACKSTAGE_BASELINE_TAG_RESOLVED_IMAGE" == "$BACKSTAGE_PREBUILD_BASELINE_IMAGE" ]] || return 1
  docker pull "$BACKSTAGE_PREBUILD_BASELINE_IMAGE" || return 1
  inspect_backstage_image_runtime_binding "$BACKSTAGE_PREBUILD_BASELINE_IMAGE" \
    "$expected_runtime_fingerprint" || return 1
  resolved_image="$BACKSTAGE_RESOLVED_CANDIDATE_IMAGE"
  [[ "$resolved_image" == "$BACKSTAGE_PREBUILD_BASELINE_IMAGE" ]] || {
    backstage_rollback_fail "live digest image registry proof changed immutable reference"
    return 79
  }
  # prepare_backstage_live_baseline_image_resolution already proved that every
  # Ready Pod runs this exact digest. Reusing it avoids both a mutable cache tag
  # and a redundant application build on the next same-fingerprint invocation.
  echo "[backstage] reusing live digest-pinned image with exact OCI fingerprint: $resolved_image"
}

prepare_backstage_live_baseline_image_resolution() {
  local live_json live_spec live_image resolved_image hold_tag saved_candidate_image
  BACKSTAGE_BASELINE_TAG_RESOLUTION_PROVED=false
  BACKSTAGE_BASELINE_TAG_RESOLVED_IMAGE=""
  BACKSTAGE_BASELINE_ROLLBACK_HOLD_TAG=""
  BACKSTAGE_PREBUILD_BASELINE_UID=""
  BACKSTAGE_PREBUILD_BASELINE_SPEC_SHA256=""
  BACKSTAGE_PREBUILD_BASELINE_IMAGE=""
  live_json="$(kubectl -n "$NAMESPACE" get deployment "$BACKSTAGE_DEPLOYMENT_NAME" -o json)" || {
    backstage_rollback_fail "prebuild baseline Deployment lookup failed; mutation=0"
    return 79
  }
  BACKSTAGE_PREBUILD_BASELINE_UID="$(jq -er '.metadata.uid' <<<"$live_json")" || return 79
  live_spec="$(jq -cS '.spec' <<<"$live_json")" || return 79
  BACKSTAGE_PREBUILD_BASELINE_SPEC_SHA256="$(printf '%s' "$live_spec" | sha256sum | awk '{print $1}')" || return 79
  live_image="$(jq -er '[.spec.template.spec.containers[]? | select(.name == "backstage") | .image] |
      if length == 1 then .[0] else error("one backstage image required") end' \
    <<<"$live_json")" || return 79
  validate_backstage_candidate_image "$live_image" || return 79
  BACKSTAGE_PREBUILD_BASELINE_IMAGE="$live_image"
  if is_digest_pinned_backstage_candidate_image "$live_image"; then
    BACKSTAGE_BASELINE_TAG_RESOLVED_IMAGE="$live_image"
    wait_for_backstage_ready_pod_image_ids "$BACKSTAGE_PREBUILD_BASELINE_UID" \
      "$live_image" "$BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS" || return 79
    return 0
  fi
  docker pull "$live_image" || {
    backstage_rollback_fail "live mutable baseline image tag cannot be pulled; mutation=0"
    return 79
  }
  inspect_backstage_image_repository_digest "$live_image" || {
    backstage_rollback_fail "live mutable baseline image tag digest cannot be resolved; mutation=0"
    return 79
  }
  resolved_image="$BACKSTAGE_RESOLVED_CANDIDATE_IMAGE"
  wait_for_backstage_ready_pod_image_ids "$BACKSTAGE_PREBUILD_BASELINE_UID" \
    "$resolved_image" "$BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS" \
    "$live_image" || return 79
  BACKSTAGE_BASELINE_TAG_RESOLVED_IMAGE="$resolved_image"
  BACKSTAGE_BASELINE_TAG_RESOLUTION_PROVED=true
  hold_tag="$IMAGE_REPOSITORY:rollback-hold-${BACKSTAGE_DEPLOYMENT_ATTEMPT_ID}"
  validate_backstage_candidate_image "$hold_tag" || return 79
  docker tag "$resolved_image" "$hold_tag" || {
    backstage_rollback_fail "baseline rollback hold tag creation failed; mutation=0"
    return 79
  }
  docker push "$hold_tag" || {
    backstage_rollback_fail "baseline rollback hold tag publication failed; mutation=0"
    return 79
  }
  saved_candidate_image="$BACKSTAGE_RESOLVED_CANDIDATE_IMAGE"
  inspect_backstage_image_repository_digest "$hold_tag" || return 79
  [[ "$BACKSTAGE_RESOLVED_CANDIDATE_IMAGE" == "$resolved_image" ]] || {
    backstage_rollback_fail "baseline rollback hold tag digest verification failed; mutation=0"
    return 79
  }
  BACKSTAGE_RESOLVED_CANDIDATE_IMAGE="$saved_candidate_image"
  BACKSTAGE_BASELINE_ROLLBACK_HOLD_TAG="$hold_tag"
  echo "[backstage] baseline rollback digest hold published tag=$hold_tag digest=$resolved_image"
}

reprove_backstage_live_baseline_image_resolution_before_capture() {
  local current_json current_spec current_spec_sha256 current_image saved_candidate_image
  local reproved_digest hold_digest
  current_json="$(kubectl -n "$NAMESPACE" get deployment "$BACKSTAGE_DEPLOYMENT_NAME" -o json)" || return 79
  current_spec="$(jq -cS '.spec' <<<"$current_json")" || return 79
  current_spec_sha256="$(printf '%s' "$current_spec" | sha256sum | awk '{print $1}')" || return 79
  current_image="$(jq -er '[.spec.template.spec.containers[]? | select(.name == "backstage") | .image] |
    if length == 1 then .[0] else error("one backstage image required") end' <<<"$current_json")" || return 79
  [[ "$(jq -r '.metadata.uid' <<<"$current_json")" == "$BACKSTAGE_PREBUILD_BASELINE_UID" &&
     "$current_spec_sha256" == "$BACKSTAGE_PREBUILD_BASELINE_SPEC_SHA256" &&
     "$current_image" == "$BACKSTAGE_PREBUILD_BASELINE_IMAGE" ]] || {
    backstage_rollback_fail "live baseline changed before durable capture; mutation=0"
    return 79
  }
  saved_candidate_image="$BACKSTAGE_RESOLVED_CANDIDATE_IMAGE"
  if [[ "$BACKSTAGE_BASELINE_TAG_RESOLUTION_PROVED" == true ]]; then
    [[ -n "$BACKSTAGE_BASELINE_ROLLBACK_HOLD_TAG" ]] || return 79
    docker pull "$BACKSTAGE_PREBUILD_BASELINE_IMAGE" || return 79
    inspect_backstage_image_repository_digest "$BACKSTAGE_PREBUILD_BASELINE_IMAGE" || return 79
    reproved_digest="$BACKSTAGE_RESOLVED_CANDIDATE_IMAGE"
    [[ "$reproved_digest" == "$BACKSTAGE_BASELINE_TAG_RESOLVED_IMAGE" ]] || {
      backstage_rollback_fail "live mutable baseline tag digest changed before durable capture; mutation=0"
      return 79
    }
    docker pull "$BACKSTAGE_BASELINE_ROLLBACK_HOLD_TAG" || return 79
    inspect_backstage_image_repository_digest "$BACKSTAGE_BASELINE_ROLLBACK_HOLD_TAG" || return 79
    hold_digest="$BACKSTAGE_RESOLVED_CANDIDATE_IMAGE"
    [[ "$hold_digest" == "$BACKSTAGE_BASELINE_TAG_RESOLVED_IMAGE" ]] || {
      backstage_rollback_fail "baseline rollback hold digest changed before durable capture; mutation=0"
      return 79
    }
    wait_for_backstage_ready_pod_image_ids "$BACKSTAGE_PREBUILD_BASELINE_UID" \
      "$BACKSTAGE_BASELINE_TAG_RESOLVED_IMAGE" "$BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS" \
      "$BACKSTAGE_PREBUILD_BASELINE_IMAGE" || return 79
  else
    wait_for_backstage_ready_pod_image_ids "$BACKSTAGE_PREBUILD_BASELINE_UID" \
      "$BACKSTAGE_PREBUILD_BASELINE_IMAGE" "$BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS" || return 79
  fi
  BACKSTAGE_RESOLVED_CANDIDATE_IMAGE="$saved_candidate_image"
}

verify_backstage_baseline_rollback_hold_tag() {
  local hold_tag expected_digest saved_candidate_image
  [[ "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 ]] || return 0
  [[ "$BACKSTAGE_PENDING_BASELINE_TAG_PROOF" != null ]] || return 0
  command -v docker >/dev/null 2>&1 || {
    backstage_rollback_fail "Docker is unavailable for baseline rollback hold proof; mutation=0"
    return 79
  }
  hold_tag="$(jq -r '.holdTag' <<<"$BACKSTAGE_PENDING_BASELINE_TAG_PROOF")" || return 79
  expected_digest="$(jq -r '.digestImage' <<<"$BACKSTAGE_PENDING_BASELINE_TAG_PROOF")" || return 79
  saved_candidate_image="$BACKSTAGE_RESOLVED_CANDIDATE_IMAGE"
  docker pull "$hold_tag" || {
    backstage_rollback_fail "baseline rollback hold tag is unavailable; mutation=0"
    return 79
  }
  inspect_backstage_image_repository_digest "$hold_tag" || return 79
  [[ "$BACKSTAGE_RESOLVED_CANDIDATE_IMAGE" == "$expected_digest" ]] || {
    backstage_rollback_fail "baseline rollback hold tag digest changed; mutation=0"
    return 79
  }
  BACKSTAGE_RESOLVED_CANDIDATE_IMAGE="$saved_candidate_image"
}

cleanup_backstage_baseline_rollback_hold_tag() {
  local hold_tag
  [[ "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 &&
     "$BACKSTAGE_PENDING_BASELINE_TAG_PROOF" != null ]] || return 0
  hold_tag="$(jq -r '.holdTag' <<<"$BACKSTAGE_PENDING_BASELINE_TAG_PROOF")" || return 0
  if command -v docker >/dev/null 2>&1; then
    docker image rm "$hold_tag" >/dev/null 2>&1 || true
  fi
  # Distribution registries cannot safely delete a tag without deleting its
  # shared manifest digest. The unique hold tag is therefore left to the
  # registry retention policy after terminal success; local residue is removed.
  echo "[backstage] baseline rollback hold released locally; registry retention GC tag=$hold_tag"
}

is_valid_backstage_runtime_fingerprint() {
  [[ "$1" =~ ^[0-9a-f]{64}$ ]]
}

calculate_target_backstage_runtime_fingerprint() {
  local exact_target="$1" fingerprint
  is_exact_backstage_commit "$exact_target" || return 1
  fingerprint="$(git -C "$ROOT" show \
      "$exact_target:ops/scripts/resonance-backstage-runtime-fingerprint.sh" |
      bash -s -- "$ROOT" "$exact_target")" || return 1
  is_valid_backstage_runtime_fingerprint "$fingerprint" || return 1
  printf '%s' "$fingerprint"
}

calculate_target_backstage_deployment_closure() {
  local exact_target="$1" runtime_fingerprint="$2" tree_entries path entry_count
  local -a closure_paths=(
    deploy/k8s/control-plane/backstage.yaml
    ops/scripts/resonance-backstage-deploy.sh
    ops/scripts/resonance-backstage-runtime-fingerprint.sh
    platform/control-plane/catalog/organization.yaml
    platform/control-plane/catalog/systems.yaml
    platform/control-plane/catalog/components.yaml
    platform/control-plane/catalog/apis.yaml
    platform/control-plane/catalog/resources.yaml
    platform/control-plane/catalog/environments.yaml
  )
  is_exact_backstage_commit "$exact_target" &&
    is_valid_backstage_runtime_fingerprint "$runtime_fingerprint" || return 1
  for path in "${closure_paths[@]}"; do
    git -C "$ROOT" cat-file -e "$exact_target:$path" 2>/dev/null || return 1
  done
  tree_entries="$(git -C "$ROOT" ls-tree -r "$exact_target" -- "${closure_paths[@]}")" || return 1
  entry_count="$(awk 'NF { count++ } END { print count + 0 }' <<<"$tree_entries")"
  [[ "$entry_count" == "${#closure_paths[@]}" ]] || return 1
  {
    printf 'runtimeFingerprint=%s\n' "$runtime_fingerprint"
    printf '%s\n' "$tree_entries"
  } | sha256sum | awk '{print $1}'
}

calculate_target_backstage_catalog_digest() {
  local exact_target="$1" path
  local -a catalog_paths=(
    platform/control-plane/catalog/organization.yaml
    platform/control-plane/catalog/systems.yaml
    platform/control-plane/catalog/components.yaml
    platform/control-plane/catalog/apis.yaml
    platform/control-plane/catalog/resources.yaml
    platform/control-plane/catalog/environments.yaml
  )
  is_exact_backstage_commit "$exact_target" || return 1
  for path in "${catalog_paths[@]}"; do
    git -C "$ROOT" show "$exact_target:$path" | sha256sum || return 1
  done | sha256sum | awk '{print $1}'
}

backstage_managed_resource_descriptors() {
  printf '%s\n' \
    'ConfigMap|resonance-backstage-config' \
    'ConfigMap|resonance-backstage-catalog' \
    'Service|resonance-backstage' \
    'Service|resonance-backstage-catalog' \
    'NetworkPolicy|resonance-backstage-ingress'
}

normalize_backstage_managed_resource_payload() {
  local kind="$1" resource_json="$2"
  case "$kind" in
    ConfigMap)
      jq -cS '{data:(.data // {}),binaryData:(.binaryData // {}),immutable:(.immutable // false),
        labels:(.metadata.labels // {}),
        annotations:((.metadata.annotations // {}) |
          with_entries(select(.key != "kubectl.kubernetes.io/last-applied-configuration")))}' <<<"$resource_json"
      ;;
    Service)
      jq -cS '{type:(.spec.type // "ClusterIP"),selector:(.spec.selector // {}),
        ports:[(.spec.ports // [])[] | . + {protocol:(.protocol // "TCP")}],
        sessionAffinity:(.spec.sessionAffinity // "None"),sessionAffinityConfig:(.spec.sessionAffinityConfig // null),
        externalTrafficPolicy:(.spec.externalTrafficPolicy // "Cluster"),
        internalTrafficPolicy:(.spec.internalTrafficPolicy // "Cluster"),
        publishNotReadyAddresses:(.spec.publishNotReadyAddresses // false),
        trafficDistribution:(.spec.trafficDistribution // null),
        labels:(.metadata.labels // {}),
        annotations:((.metadata.annotations // {}) |
          with_entries(select(.key != "kubectl.kubernetes.io/last-applied-configuration")))}' <<<"$resource_json"
      ;;
    NetworkPolicy)
      jq -cS '{spec:.spec,labels:(.metadata.labels // {}),annotations:((.metadata.annotations // {}) |
        with_entries(select(.key != "kubectl.kubernetes.io/last-applied-configuration")))}' <<<"$resource_json"
      ;;
    *) return 1 ;;
  esac
}

capture_backstage_managed_resource_snapshot() {
  local kind="$1" name="$2" resource_json payload payload_sha256
  resource_json="$(kubectl -n "$NAMESPACE" get "$kind" "$name" --ignore-not-found -o json)" || {
    backstage_rollback_fail "managed resource lookup failed kind=$kind name=$name"
    return 1
  }
  if [[ -z "$resource_json" ]]; then
    jq -cnS --arg kind "$kind" --arg name "$name" \
      '{kind:$kind,name:$name,exists:false,uid:null,resourceVersion:null,payload:null,payloadSha256:null}'
    return
  fi
  jq -e --arg kind "$kind" --arg name "$name" --arg namespace "$NAMESPACE" '
      .kind == $kind and .metadata.name == $name and .metadata.namespace == $namespace and
      (.metadata.uid | type == "string" and length > 0 and length <= 253) and
      (.metadata.resourceVersion | type == "string" and length > 0 and length <= 253)
    ' <<<"$resource_json" >/dev/null || {
    backstage_rollback_fail "managed resource identity is invalid kind=$kind name=$name"
    return 1
  }
  payload="$(normalize_backstage_managed_resource_payload "$kind" "$resource_json")" || return 1
  payload_sha256="$(printf '%s' "$payload" | sha256sum | awk '{print $1}')" || return 1
  jq -cnS --arg kind "$kind" --arg name "$name" \
    --arg uid "$(jq -r '.metadata.uid' <<<"$resource_json")" \
    --arg resourceVersion "$(jq -r '.metadata.resourceVersion' <<<"$resource_json")" \
    --argjson payload "$payload" --arg payloadSha256 "$payload_sha256" '
      {kind:$kind,name:$name,exists:true,uid:$uid,resourceVersion:$resourceVersion,
       payload:$payload,payloadSha256:$payloadSha256}
    '
}

capture_all_backstage_managed_resource_snapshots() {
  local resources='{}' descriptor kind name key snapshot
  while IFS='|' read -r kind name; do
    key="$kind/$name"
    snapshot="$(capture_backstage_managed_resource_snapshot "$kind" "$name")" || return 1
    resources="$(jq -cS --arg key "$key" --argjson snapshot "$snapshot" \
      '. + {($key):$snapshot}' <<<"$resources")" || return 1
  done < <(backstage_managed_resource_descriptors)
  printf '%s' "$resources"
}

calculate_backstage_live_resource_closure_sha256() {
  local resources="$1" closure_payload
  closure_payload="$(jq -cS '
      to_entries |
      map({resourceKey:.key,kind:.value.kind,name:.value.name,uid:.value.uid,
           payloadSha256:.value.payloadSha256}) |
      sort_by(.resourceKey)
    ' <<<"$resources")" || return 1
  printf '%s' "$closure_payload" | sha256sum | awk '{print $1}'
}

backstage_runtime_dependency_descriptors() {
  printf '%s\n' \
    'Secret|resonance-backstage-database' \
    'Secret|resonance-backstage-auth' \
    'Secret|resonance-ops-bridge' \
    'Secret|resonance-runtime-purge-recovery' \
    'ConfigMap|resonance-internal-ca' \
    'Secret|resonance-backstage-tls'
}

capture_backstage_runtime_dependency_snapshot() {
  local kind="$1" name="$2" dependency_namespace="${3:-$NAMESPACE}"
  local resource_json content content_sha256
  resource_json="$(kubectl -n "$dependency_namespace" get "$kind" "$name" -o json)" || {
    backstage_rollback_fail "runtime dependency lookup failed kind=$kind name=$name; values=redacted"
    return 79
  }
  jq -e --arg kind "$kind" --arg name "$name" --arg namespace "$dependency_namespace" '
      .kind == $kind and .metadata.name == $name and .metadata.namespace == $namespace and
      (.metadata.uid | type == "string" and length > 0 and length <= 253)
    ' <<<"$resource_json" >/dev/null || {
    backstage_rollback_fail "runtime dependency identity is unsafe kind=$kind name=$name; values=redacted"
    return 79
  }
  case "$kind" in
    Secret)
      content="$(jq -cS '{data:(.data // {}),immutable:(.immutable // false),type:(.type // "Opaque")}' \
        <<<"$resource_json")" || return 79
      if [[ "$name" == resonance-backstage-tls || "$name" == resonance-preview-tls ]]; then
        jq -e '(.data | keys | sort) == ["tls.crt","tls.key"]' <<<"$resource_json" >/dev/null || return 79
        printf '%s' "$(jq -r '.data["tls.crt"]' <<<"$resource_json")" | base64 -d 2>/dev/null |
          openssl x509 -checkend 300 -checkhost \
            "$([[ "$name" == resonance-backstage-tls ]] &&
                printf '%s' "${BACKSTAGE_HOST:-backstage.172.16.1.232.nip.io}" ||
                printf '%s' "${RESONANCE_PREVIEW_HOST:-resonance.172.16.1.232.nip.io}")" -noout \
            >/dev/null 2>&1 || {
              backstage_rollback_fail "Backstage TLS certificate is invalid or expires inside 300 seconds; values=redacted"
              return 79
            }
      fi
      ;;
    ConfigMap)
      content="$(jq -cS '{data:(.data // {}),binaryData:(.binaryData // {}),immutable:(.immutable // false)}' \
        <<<"$resource_json")" || return 79
      ;;
    *) return 79 ;;
  esac
  content_sha256="$(printf '%s' "$content" | sha256sum | awk '{print $1}')" || return 79
  jq -cnS --arg kind "$kind" --arg name "$name" \
    --arg uid "$(jq -r '.metadata.uid' <<<"$resource_json")" \
    --arg contentSha256 "$content_sha256" \
    '{kind:$kind,name:$name,uid:$uid,contentSha256:$contentSha256}'
}

capture_backstage_ingress_controller_dependency() {
  local resource_json content content_sha256
  resource_json="$(kubectl -n ingress-nginx get Service ingress-nginx-controller -o json)" || return 79
  jq -e '
      .kind == "Service" and .metadata.namespace == "ingress-nginx" and
      .metadata.name == "ingress-nginx-controller" and
      (.metadata.uid | type == "string" and length > 0) and
      ([.spec.ports[] | select(.name == "https-32947" and .port == 32947 and
        .protocol == "TCP" and .targetPort == "https" and .nodePort == 32947)] | length) == 1
    ' <<<"$resource_json" >/dev/null || return 79
  content="$(jq -cS '{httpsPorts:[.spec.ports[] | select(.name == "https-32947") |
    {name,port,protocol,targetPort,nodePort}]}' <<<"$resource_json")" || return 79
  content_sha256="$(printf '%s' "$content" | sha256sum | awk '{print $1}')" || return 79
  jq -cnS --arg uid "$(jq -r '.metadata.uid' <<<"$resource_json")" --arg hash "$content_sha256" \
    '{kind:"Service",name:"ingress-nginx/ingress-nginx-controller",uid:$uid,contentSha256:$hash}'
}

capture_backstage_ingress_dependency() {
  local role="$1" expected_host expected_namespace expected_service expected_tls expected_port
  local ingress_list resource_json content content_sha256
  case "$role" in
    backstage)
      expected_host="${BACKSTAGE_HOST:-backstage.172.16.1.232.nip.io}"
      expected_namespace=resonance-ops
      expected_service=resonance-backstage
      expected_tls=resonance-backstage-tls
      expected_port=7007
      ;;
    preview)
      expected_host="${RESONANCE_PREVIEW_HOST:-resonance.172.16.1.232.nip.io}"
      expected_namespace=carbonet-prod
      expected_service=carbonet-web
      expected_tls=resonance-preview-tls
      expected_port=80
      ;;
    *) return 79 ;;
  esac
  ingress_list="$(kubectl get ingress -A -o json)" || return 79
  resource_json="$(jq -c --arg host "$expected_host" \
    '[.items[] | select(any(.spec.rules[]?; .host == $host))] |
     if length == 1 then .[0] else error("ingress cardinality") end' <<<"$ingress_list")" || return 79
  jq -e --arg namespace "$expected_namespace" --arg host "$expected_host" \
    --arg service "$expected_service" --arg tls "$expected_tls" --argjson port "$expected_port" '
      .kind == "Ingress" and .metadata.namespace == $namespace and
      (.metadata.uid | type == "string" and length > 0) and
      ([.spec.tls[]? | select(.secretName == $tls and (.hosts | index($host) != null))] | length) == 1 and
      ([.spec.rules[] | select(.host == $host) | .http.paths[] |
        select(.backend.service.name == $service and
          (.backend.service.port.number == $port or .backend.service.port.name == "http"))] | length) >= 1
    ' <<<"$resource_json" >/dev/null || return 79
  content="$(jq -cS --arg host "$expected_host" '
      {namespace:.metadata.namespace,name:.metadata.name,
       annotations:((.metadata.annotations // {}) |
         with_entries(select(.key != "kubectl.kubernetes.io/last-applied-configuration"))),
       ingressClassName:(.spec.ingressClassName // null),
       rules:[.spec.rules[] | select(.host == $host)],
       tls:[.spec.tls[]? | select(.hosts | index($host) != null)]}
    ' <<<"$resource_json")" || return 79
  content_sha256="$(printf '%s' "$content" | sha256sum | awk '{print $1}')" || return 79
  jq -cnS --arg role "$role" --arg uid "$(jq -r '.metadata.uid' <<<"$resource_json")" \
    --arg hash "$content_sha256" \
    '{kind:"Ingress",name:$role,uid:$uid,contentSha256:$hash}'
}

capture_all_backstage_runtime_dependencies() {
  local dependencies='{}' kind name key snapshot
  while IFS='|' read -r kind name; do
    key="$kind/$name"
    snapshot="$(capture_backstage_runtime_dependency_snapshot "$kind" "$name")" || return 79
    dependencies="$(jq -cS --arg key "$key" --argjson snapshot "$snapshot" \
      '. + {($key):$snapshot}' <<<"$dependencies")" || return 79
  done < <(backstage_runtime_dependency_descriptors)
  snapshot="$(capture_backstage_runtime_dependency_snapshot Secret resonance-ops-bridge carbonet-prod)" || return 79
  dependencies="$(jq -cS --arg key 'Secret/carbonet-prod/resonance-ops-bridge' --argjson snapshot "$snapshot" \
    '. + {($key):$snapshot}' <<<"$dependencies")" || return 79
  snapshot="$(capture_backstage_runtime_dependency_snapshot Secret resonance-preview-tls carbonet-prod)" || return 79
  dependencies="$(jq -cS --arg key 'Secret/carbonet-prod/resonance-preview-tls' --argjson snapshot "$snapshot" \
    '. + {($key):$snapshot}' <<<"$dependencies")" || return 79
  snapshot="$(capture_backstage_ingress_controller_dependency)" || return 79
  dependencies="$(jq -cS --arg key 'Service/ingress-nginx-controller' --argjson snapshot "$snapshot" \
    '. + {($key):$snapshot}' <<<"$dependencies")" || return 79
  for key in backstage preview; do
    snapshot="$(capture_backstage_ingress_dependency "$key")" || return 79
    dependencies="$(jq -cS --arg key "Ingress/$key" --argjson snapshot "$snapshot" \
      '. + {($key):$snapshot}' <<<"$dependencies")" || return 79
  done
  printf '%s' "$dependencies"
}

calculate_backstage_runtime_dependency_closure_sha256() {
  local dependencies="$1"
  printf '%s' "$(jq -cS . <<<"$dependencies")" | sha256sum | awk '{print $1}'
}

verify_backstage_runtime_dependencies_against_snapshot() {
  local expected="$1" actual projected_actual expected_closure actual_closure
  actual="$(capture_all_backstage_runtime_dependencies)" || return 79
  # Schema-v3 pending/runtime-identity files contain the original five-key
  # dependency closure. Project the live superset onto that authenticated
  # keyset so an in-flight old candidate can be rolled back or finalized; the
  # public verifier still reports its old identity schema as drift and forces
  # a subsequent schema-v4/v3 repair.
  projected_actual="$(jq -cS --argjson expected "$expected" '
      with_entries(select(.key as $key | $expected | has($key)))
    ' <<<"$actual")" || return 79
  [[ "$(jq -r 'length' <<<"$projected_actual")" == "$(jq -r 'length' <<<"$expected")" ]] || return 79
  expected_closure="$(calculate_backstage_runtime_dependency_closure_sha256 "$expected")" || return 79
  actual_closure="$(calculate_backstage_runtime_dependency_closure_sha256 "$projected_actual")" || return 79
  if [[ "$projected_actual" != "$(jq -cS . <<<"$expected")" ||
        "$actual_closure" != "$expected_closure" ]]; then
    echo '[backstage] runtime dependency drift: UID or redacted content digest mismatch' >&2
    return 1
  fi
  BACKSTAGE_PENDING_RUNTIME_DEPENDENCY_CLOSURE_SHA256="$actual_closure"
}

build_target_backstage_managed_resource_payloads() {
  local exact_target="$1" manifest_json manifest_payloads catalog_payload
  local organization systems components apis resources environments
  is_exact_backstage_commit "$exact_target" || return 1
  manifest_json="$(git -C "$ROOT" show "$exact_target:deploy/k8s/control-plane/backstage.yaml" |
    kubectl create --dry-run=client -f - -o json)" || return 1
  manifest_payloads="$(jq -cs --arg namespace "$NAMESPACE" '
      [ .[] | if .kind == "List" then .items[] else . end |
        select(.metadata.namespace == $namespace) ] |
      reduce .[] as $item (
        {"ConfigMap/resonance-backstage-catalog":{kind:"ConfigMap",name:"resonance-backstage-catalog",exists:false,payload:null},
         "ConfigMap/resonance-backstage-config":{kind:"ConfigMap",name:"resonance-backstage-config",exists:false,payload:null},
         "Service/resonance-backstage":{kind:"Service",name:"resonance-backstage",exists:false,payload:null},
         "Service/resonance-backstage-catalog":{kind:"Service",name:"resonance-backstage-catalog",exists:false,payload:null},
         "NetworkPolicy/resonance-backstage-ingress":{kind:"NetworkPolicy",name:"resonance-backstage-ingress",exists:false,payload:null}};
        if $item.kind == "ConfigMap" and $item.metadata.name == "resonance-backstage-config" then
          . + {"ConfigMap/resonance-backstage-config":
            {kind:"ConfigMap",name:"resonance-backstage-config",exists:true,
              payload:{data:($item.data // {}),binaryData:($item.binaryData // {}),immutable:($item.immutable // false),
                labels:($item.metadata.labels // {}),
               annotations:(($item.metadata.annotations // {}) |
                 with_entries(select(.key != "kubectl.kubernetes.io/last-applied-configuration")))}}}
        elif $item.kind == "Service" and
             ($item.metadata.name == "resonance-backstage" or $item.metadata.name == "resonance-backstage-catalog") then
          . + {("Service/" + $item.metadata.name):
            {kind:"Service",name:$item.metadata.name,exists:true,
             payload:{type:($item.spec.type // "ClusterIP"),selector:($item.spec.selector // {}),
               ports:[($item.spec.ports // [])[] | . + {protocol:(.protocol // "TCP")}],
               sessionAffinity:($item.spec.sessionAffinity // "None"),
               sessionAffinityConfig:($item.spec.sessionAffinityConfig // null),
               externalTrafficPolicy:($item.spec.externalTrafficPolicy // "Cluster"),
               internalTrafficPolicy:($item.spec.internalTrafficPolicy // "Cluster"),
                publishNotReadyAddresses:($item.spec.publishNotReadyAddresses // false),
                trafficDistribution:($item.spec.trafficDistribution // null),
                labels:($item.metadata.labels // {}),
               annotations:(($item.metadata.annotations // {}) |
                 with_entries(select(.key != "kubectl.kubernetes.io/last-applied-configuration")))}}}
        elif $item.kind == "NetworkPolicy" and $item.metadata.name == "resonance-backstage-ingress" then
          . + {"NetworkPolicy/resonance-backstage-ingress":
            {kind:"NetworkPolicy",name:"resonance-backstage-ingress",exists:true,
              payload:{spec:$item.spec,labels:($item.metadata.labels // {}),annotations:(($item.metadata.annotations // {}) |
               with_entries(select(.key != "kubectl.kubernetes.io/last-applied-configuration")))}}}
        else . end)
    ' <<<"$manifest_json")" || return 1
  organization="$(git -C "$ROOT" show "$exact_target:platform/control-plane/catalog/organization.yaml" | base64 -w0)" || return 1
  systems="$(git -C "$ROOT" show "$exact_target:platform/control-plane/catalog/systems.yaml" | base64 -w0)" || return 1
  components="$(git -C "$ROOT" show "$exact_target:platform/control-plane/catalog/components.yaml" | base64 -w0)" || return 1
  apis="$(git -C "$ROOT" show "$exact_target:platform/control-plane/catalog/apis.yaml" | base64 -w0)" || return 1
  resources="$(git -C "$ROOT" show "$exact_target:platform/control-plane/catalog/resources.yaml" | base64 -w0)" || return 1
  environments="$(git -C "$ROOT" show "$exact_target:platform/control-plane/catalog/environments.yaml" | base64 -w0)" || return 1
  catalog_payload="$(jq -cnS --arg organization "$organization" --arg systems "$systems" \
    --arg components "$components" --arg apis "$apis" --arg resources "$resources" \
    --arg environments "$environments" '
      {"organization.yaml":($organization|@base64d),"systems.yaml":($systems|@base64d),
       "components.yaml":($components|@base64d),"apis.yaml":($apis|@base64d),
       "resources.yaml":($resources|@base64d),"environments.yaml":($environments|@base64d)}
    ')" || return 1
  jq -cS --argjson catalog "$catalog_payload" '
      . + {"ConfigMap/resonance-backstage-catalog":
        {kind:"ConfigMap",name:"resonance-backstage-catalog",exists:true,
         payload:{data:$catalog,binaryData:{},immutable:false,labels:{},annotations:{}}}}
    ' <<<"$manifest_payloads"
}

bind_backstage_managed_resource_intent_hashes() {
  local raw_intents="$1" intents='{}' key intent payload payload_sha256
  while IFS= read -r key; do
    intent="$(jq -cS --arg key "$key" '.[$key]' <<<"$raw_intents")" || return 1
    if [[ "$(jq -r '.exists' <<<"$intent")" == true ]]; then
      payload="$(jq -cS '.payload' <<<"$intent")" || return 1
      payload_sha256="$(printf '%s' "$payload" | sha256sum | awk '{print $1}')" || return 1
      intent="$(jq -cS --arg hash "$payload_sha256" '. + {payloadSha256:$hash}' <<<"$intent")" || return 1
    else
      intent="$(jq -cS '. + {payloadSha256:null}' <<<"$intent")" || return 1
    fi
    intents="$(jq -cS --arg key "$key" --argjson intent "$intent" '. + {($key):$intent}' <<<"$intents")" || return 1
  done < <(jq -r 'keys[]' <<<"$raw_intents")
  printf '%s' "$intents"
}

verify_backstage_managed_resources_against_target() {
  local exact_target="$1" expected actual key expected_payload live_payload_sha expected_payload_sha expected_exists actual_exists
  expected="$(build_target_backstage_managed_resource_payloads "$exact_target")" || return 79
  actual="$(capture_all_backstage_managed_resource_snapshots)" || return 79
  [[ "$(jq -cS 'keys' <<<"$expected")" == "$(jq -cS 'keys' <<<"$actual")" ]] || return 79
  while IFS= read -r key; do
    expected_exists="$(jq -r --arg key "$key" '.[$key].exists' <<<"$expected")"
    actual_exists="$(jq -r --arg key "$key" '.[$key].exists' <<<"$actual")"
    [[ "$expected_exists" == "$actual_exists" ]] || {
      echo "[backstage] managed resource drift: existence mismatch $key" >&2
      return 1
    }
    [[ "$expected_exists" == true ]] || continue
    expected_payload="$(jq -cS --arg key "$key" '.[$key].payload' <<<"$expected")" || return 79
    expected_payload_sha="$(printf '%s' "$expected_payload" | sha256sum | awk '{print $1}')" || return 79
    live_payload_sha="$(jq -r --arg key "$key" '.[$key].payloadSha256' <<<"$actual")" || return 79
    [[ "$expected_payload_sha" == "$live_payload_sha" ]] || {
      echo "[backstage] managed resource drift: payload mismatch $key" >&2
      return 1
    }
  done < <(jq -r 'keys[]' <<<"$expected")
  BACKSTAGE_CANDIDATE_MANAGED_RESOURCES="$actual"
  BACKSTAGE_CANDIDATE_LIVE_RESOURCE_CLOSURE_SHA256="$(calculate_backstage_live_resource_closure_sha256 "$actual")" || return 79
}

publish_backstage_pending_state_payload() {
  local state_payload="$1" state_json integrity state_dir state_tmp=""
  prepare_backstage_rollback_state_directory || return 1
  integrity="$(printf '%s' "$state_payload" | sha256sum | awk '{print $1}')" || return 1
  state_json="$(jq -cS --arg integrity "$integrity" \
    '. + {integritySha256: $integrity}' <<<"$state_payload")" || return 1
  state_dir="$(dirname -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE")"
  state_tmp="$(umask 077 && mktemp "$state_dir/.deployment-rollback.pending.XXXXXXXX")" || {
    backstage_rollback_fail "pending state temporary file creation failed"
    return 1
  }
  if ! printf '%s\n' "$state_json" >"$state_tmp" ||
     ! chmod 0600 -- "$state_tmp" ||
     [[ "$(stat -c '%a:%u:%h' -- "$state_tmp" 2>/dev/null || true)" != "600:$(id -u):1" ]] ||
     ! sync -f "$state_tmp" ||
     ! mv -T -- "$state_tmp" "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" ||
     ! sync -f "$state_dir"; then
    rm -f -- "$state_tmp"
    backstage_rollback_fail "pending state atomic publication failed"
    return 1
  fi
  BACKSTAGE_PENDING_STATE_JSON="$state_json"
}

load_backstage_pending_state() {
  local state_before state_after state_payload expected_integrity actual_integrity
  local schema_version actual_baseline_spec actual_baseline_spec_sha256 legacy_attempt_material
  local actual_baseline_rollback_spec actual_baseline_rollback_spec_sha256
  local actual_candidate_spec actual_candidate_spec_sha256 snapshot payload payload_sha256 expected_payload_sha256
  local runtime_dependencies runtime_dependency_closure_sha256
  prepare_backstage_rollback_state_directory || return 1
  verify_backstage_pending_state_file_security || return 1
  verify_expected_backstage_pending_binding || return 1
  state_before="$(stat -c '%d:%i:%s:%Y' -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" 2>/dev/null || true)"
  BACKSTAGE_PENDING_STATE_JSON="$(<"$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE")" || {
    backstage_rollback_fail "pending state cannot be read"
    return 1
  }
  BACKSTAGE_PENDING_FILE_SHA256="$(sha256sum -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" | awk '{print $1}')" || {
    backstage_rollback_fail "pending state SHA-256 cannot be computed"
    return 1
  }
  state_after="$(stat -c '%d:%i:%s:%Y' -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" 2>/dev/null || true)"
  [[ -n "$state_before" && "$state_before" == "$state_after" ]] || {
    backstage_rollback_fail "pending state changed while being read"
    return 1
  }
  if ! jq -e \
      --arg namespace "$NAMESPACE" \
      --arg deployment "$BACKSTAGE_DEPLOYMENT_NAME" '
        def managed_keys:
          ["ConfigMap/resonance-backstage-catalog","ConfigMap/resonance-backstage-config",
           "NetworkPolicy/resonance-backstage-ingress","Service/resonance-backstage",
           "Service/resonance-backstage-catalog"];
        def managed_snapshot:
          type == "object" and
          (keys | sort) == ["exists","kind","name","payload","payloadSha256","resourceVersion","uid"] and
          (.kind == "ConfigMap" or .kind == "Service" or .kind == "NetworkPolicy") and
          (.name | type == "string" and length > 0 and length <= 253) and
          if .exists == true then
            (.uid | type == "string" and length > 0 and length <= 253) and
            (.resourceVersion | type == "string" and length > 0 and length <= 253) and
            (.payload | type == "object") and
            (.payloadSha256 | type == "string" and test("^[0-9a-f]{64}$"))
          elif .exists == false then
            .uid == null and .resourceVersion == null and .payload == null and .payloadSha256 == null
          else false end;
        def managed_resources:
          type == "object" and (keys | sort) == managed_keys and all(.[]; managed_snapshot);
        def managed_intent:
          type == "object" and
          (keys | sort) == ["exists","kind","name","payload","payloadSha256"] and
          (.kind == "ConfigMap" or .kind == "Service" or .kind == "NetworkPolicy") and
          (.name | type == "string" and length > 0 and length <= 253) and
          if .exists == true then
            (.payload | type == "object") and
            (.payloadSha256 | type == "string" and test("^[0-9a-f]{64}$"))
          elif .exists == false then .payload == null and .payloadSha256 == null
           else false end;
        def legacy_runtime_dependency_keys:
          ["ConfigMap/resonance-internal-ca","Secret/resonance-backstage-auth",
           "Secret/resonance-backstage-database","Secret/resonance-ops-bridge",
           "Secret/resonance-runtime-purge-recovery"];
        def current_runtime_dependency_keys:
          ["ConfigMap/resonance-internal-ca","Ingress/backstage","Ingress/preview",
           "Secret/carbonet-prod/resonance-ops-bridge","Secret/carbonet-prod/resonance-preview-tls",
           "Secret/resonance-backstage-auth",
           "Secret/resonance-backstage-database","Secret/resonance-backstage-tls",
           "Secret/resonance-ops-bridge","Secret/resonance-runtime-purge-recovery",
           "Service/ingress-nginx-controller"];
        def runtime_dependency:
          type == "object" and
          (keys | sort) == ["contentSha256","kind","name","uid"] and
          (.kind == "Secret" or .kind == "ConfigMap" or .kind == "Service" or .kind == "Ingress") and
          (.name | type == "string" and length > 0 and length <= 253) and
          (.uid | type == "string" and length > 0 and length <= 253) and
          (.contentSha256 | type == "string" and test("^[0-9a-f]{64}$"));
        def runtime_dependencies($expected_keys):
          type == "object" and (keys | sort) == $expected_keys and
          all(.[]; runtime_dependency);
        type == "object" and
        .kind == "BackstageDeploymentRollbackPending" and
        .namespace == $namespace and
        .deploymentName == $deployment and
        (.integritySha256 | type == "string" and test("^[0-9a-f]{64}$")) and
        if .schemaVersion == 1 then
          (keys | sort) == ["baseline","deploymentName","integritySha256","kind","namespace","schemaVersion"] and
          (.baseline | type == "object") and
          (.baseline | keys | sort) == ["resourceVersion","spec","uid"] and
          (.baseline.uid | type == "string" and length > 0 and length <= 253) and
          (.baseline.resourceVersion | type == "string" and length > 0 and length <= 253) and
          (.baseline.spec | type == "object")
        elif .schemaVersion == 2 then
          ((keys | sort) == ["authorityKind","baseline","candidate","deploymentName","integritySha256","kind","namespace","phase","schemaVersion","targetCommit"] or
           (keys | sort) == ["attemptId","authorityKind","baseline","candidate","deploymentClosureSha256","deploymentName","integritySha256","kind","namespace","phase","runtimeFingerprint","schemaVersion","targetCommit"] or
           (keys | sort) == ["attemptId","authorityKind","baseline","candidate","deploymentClosureSha256","deploymentName","integritySha256","kind","namespace","phase","resourceIntents","runtimeFingerprint","schemaVersion","targetCommit"]) and
          (.targetCommit | type == "string" and test("^[0-9a-f]{40}$")) and
          (.authorityKind == "DB_PROMOTION" or .authorityKind == "APPLIED_MARKER" or .authorityKind == "REPAIR_TOKEN") and
          (if has("attemptId") and has("runtimeFingerprint") then
             (.attemptId | type == "string" and test("^[0-9a-f]{32}$")) and
             (.runtimeFingerprint | type == "string" and test("^[0-9a-f]{64}$")) and
             (.deploymentClosureSha256 | type == "string" and test("^[0-9a-f]{64}$"))
           else
             (has("attemptId") | not) and (has("runtimeFingerprint") | not) and
             (has("deploymentClosureSha256") | not) and
             .authorityKind != "REPAIR_TOKEN"
           end) and
          (.phase == "BASELINE_CAPTURED" or .phase == "MUTATION_ARMED" or .phase == "CANDIDATE_READY") and
           (if has("resourceIntents") then
             (.resourceIntents | type == "object") and
             ((.resourceIntents | keys | sort) == managed_keys) and
             all(.resourceIntents[]; managed_intent)
           else true end) and
          (.baseline | type == "object") and
          (.baseline | keys | sort) ==
            (if has("resourceIntents") then ["resourceVersion","resources","spec","specSha256","uid"]
             else ["resourceVersion","spec","specSha256","uid"] end) and
          (.baseline.uid | type == "string" and length > 0 and length <= 253) and
          (.baseline.resourceVersion | type == "string" and length > 0 and length <= 253) and
          (.baseline.spec | type == "object") and
          (.baseline.specSha256 | type == "string" and test("^[0-9a-f]{64}$")) and
          (if has("resourceIntents") then (.baseline.resources | managed_resources) else true end) and
          (.candidate | type == "object") and
          (.candidate | keys | sort) ==
            (if has("resourceIntents") then ["image","liveResourceClosureSha256","resources","spec","specSha256"]
             else ["image","spec","specSha256"] end) and
          (.candidate.image | type == "string" and length > 0 and length <= 1024 and (test("[[:space:]]") | not)) and
          (if .phase == "CANDIDATE_READY" then
             (.candidate.spec | type == "object") and
             (.candidate.specSha256 | type == "string" and test("^[0-9a-f]{64}$")) and
             (if has("resourceIntents") then
                (.candidate.resources | managed_resources) and
                (.candidate.liveResourceClosureSha256 | type == "string" and test("^[0-9a-f]{64}$"))
              else true end)
           else
             .candidate.spec == null and .candidate.specSha256 == null and
             (if has("resourceIntents") then
                (.candidate.resources | type == "object") and
                ((.candidate.resources | keys | sort) == managed_keys) and
                all(.candidate.resources[]; . == null or managed_snapshot) and
                .candidate.liveResourceClosureSha256 == null
              else true end)
           end)
        elif (.schemaVersion == 3 or .schemaVersion == 4) then
          (keys | sort) == ["attemptId","authorityKind","baseline","candidate","coordinator","deploymentClosureSha256","deploymentName","finalizeMode","integritySha256","kind","namespace","phase","plannedDeployment","resourceIntents","runtimeDependencies","runtimeFingerprint","schemaVersion","targetCommit"] and
          (.targetCommit | type == "string" and test("^[0-9a-f]{40}$")) and
          (.authorityKind == "DB_PROMOTION" or .authorityKind == "APPLIED_MARKER" or .authorityKind == "REPAIR_TOKEN") and
          ((.finalizeMode == "deferred" and .coordinator == "auto") or
           (.finalizeMode == "immediate" and .coordinator == "standalone")) and
          (.attemptId | type == "string" and test("^[0-9a-f]{32}$")) and
          (.runtimeFingerprint | type == "string" and test("^[0-9a-f]{64}$")) and
          (.deploymentClosureSha256 | type == "string" and test("^[0-9a-f]{64}$")) and
          (.phase == "BASELINE_CAPTURED" or .phase == "MUTATION_ARMED" or .phase == "CANDIDATE_READY") and
          (.resourceIntents | type == "object") and
          ((.resourceIntents | keys | sort) == managed_keys) and
          all(.resourceIntents[]; managed_intent) and
          (.schemaVersion as $pendingSchema |
            .runtimeDependencies |
            runtime_dependencies(if $pendingSchema == 3 then legacy_runtime_dependency_keys
                                 else current_runtime_dependency_keys end)) and
          (.baseline | type == "object") and
          (.baseline | keys | sort) ==
            (if .schemaVersion == 3 then
               ["resourceVersion","resources","spec","specSha256","uid"]
             else
               ["resourceVersion","resources","rollbackSpec","rollbackSpecSha256","spec","specSha256","uid"]
             end) and
          (.baseline.uid | type == "string" and length > 0 and length <= 253) and
          (.baseline.resourceVersion | type == "string" and length > 0 and length <= 253) and
          (.baseline.spec | type == "object") and
          (.baseline.specSha256 | type == "string" and test("^[0-9a-f]{64}$")) and
          (if .schemaVersion == 4 then
             (.baseline.rollbackSpec | type == "object") and
             (.baseline.rollbackSpecSha256 | type == "string" and test("^[0-9a-f]{64}$"))
           else true end) and
          (.baseline.resources | managed_resources) and
          (.plannedDeployment | type == "object") and
          (.plannedDeployment | keys | sort) == ["spec","specSha256"] and
          (if .plannedDeployment.spec == null then .plannedDeployment.specSha256 == null
           else (.plannedDeployment.spec | type == "object") and
                (.plannedDeployment.specSha256 | type == "string" and test("^[0-9a-f]{64}$")) end) and
          (if .phase == "BASELINE_CAPTURED" then .plannedDeployment.spec == null
           elif .phase == "CANDIDATE_READY" then .plannedDeployment.spec != null
           else true end) and
          (.candidate | type == "object") and
          (.candidate | keys | sort) ==
            (if .schemaVersion == 3 then
               ["image","liveResourceClosureSha256","resources","runtimeDependencyClosureSha256","spec","specSha256"]
             else
               ["baselineTagProof","image","liveResourceClosureSha256","resources","runtimeDependencyClosureSha256","spec","specSha256"]
             end) and
          (.candidate.image | type == "string" and length > 0 and length <= 1024 and (test("[[:space:]]") | not)) and
          (if .schemaVersion == 4 then
             (if .candidate.baselineTagProof == null then
                .baseline.rollbackSpec == .baseline.spec
              else
                 ((.candidate.baselineTagProof | type == "object" and
                  (keys | sort) == ["deploymentUid","digestImage","holdTag","tag"] and
                  (.tag | type == "string" and length > 0 and length <= 1024 and (test("[[:space:]]") | not)) and
                  (.holdTag | type == "string" and length > 0 and length <= 1024 and (test("[[:space:]]") | not)) and
                  (.digestImage | type == "string" and length > 0 and length <= 1024 and (test("[[:space:]]") | not)) and
                 (.deploymentUid | type == "string" and length > 0 and length <= 253)) and
                .candidate.baselineTagProof.deploymentUid == .baseline.uid and
                ([.baseline.spec.template.spec.containers[]? | select(.name == "backstage") | .image] ==
                  [.candidate.baselineTagProof.tag]) and
                 (.candidate.baselineTagProof.digestImage as $baselineDigest |
                   ((.baseline.spec |
                     ((.template.spec.containers[] | select(.name == "backstage")).image = $baselineDigest)) ==
                    .baseline.rollbackSpec)))
              end)
           else true end) and
          (if .phase == "CANDIDATE_READY" then
             (.candidate.spec | type == "object") and
             (.candidate.specSha256 | type == "string" and test("^[0-9a-f]{64}$")) and
              .candidate.spec == .plannedDeployment.spec and
              .candidate.specSha256 == .plannedDeployment.specSha256 and
              (.candidate.resources | managed_resources) and
              (.candidate.liveResourceClosureSha256 | type == "string" and test("^[0-9a-f]{64}$")) and
              (.candidate.runtimeDependencyClosureSha256 | type == "string" and test("^[0-9a-f]{64}$"))
           else
             .candidate.spec == null and .candidate.specSha256 == null and
             (.candidate.resources | type == "object") and
              ((.candidate.resources | keys | sort) == managed_keys) and
              all(.candidate.resources[]; . == null or managed_snapshot) and
              .candidate.liveResourceClosureSha256 == null and
              .candidate.runtimeDependencyClosureSha256 == null
           end)
        else
          false
        end
      ' <<<"$BACKSTAGE_PENDING_STATE_JSON" >/dev/null; then
    backstage_rollback_fail "pending state schema is invalid"
    return 1
  fi
  state_payload="$(jq -cS 'del(.integritySha256)' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
  expected_integrity="$(jq -r '.integritySha256' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
  actual_integrity="$(printf '%s' "$state_payload" | sha256sum | awk '{print $1}')" || return 1
  [[ "$actual_integrity" == "$expected_integrity" ]] || {
    backstage_rollback_fail "pending state integrity check failed"
    return 1
  }
  schema_version="$(jq -r '.schemaVersion' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
  actual_baseline_spec="$(jq -cS '.baseline.spec' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
  actual_baseline_spec_sha256="$(printf '%s' "$actual_baseline_spec" | sha256sum | awk '{print $1}')" || return 1
  if [[ "$schema_version" == 2 || "$schema_version" == 3 || "$schema_version" == 4 ]]; then
    [[ "$actual_baseline_spec_sha256" == "$(jq -r '.baseline.specSha256' <<<"$BACKSTAGE_PENDING_STATE_JSON")" ]] || {
      backstage_rollback_fail "baseline Deployment spec hash is invalid"
      return 1
    }
  fi
  if [[ "$schema_version" == 4 ]]; then
    actual_baseline_rollback_spec="$(jq -cS '.baseline.rollbackSpec' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
    actual_baseline_rollback_spec_sha256="$(printf '%s' "$actual_baseline_rollback_spec" | sha256sum | awk '{print $1}')" || return 1
    [[ "$actual_baseline_rollback_spec_sha256" == \
       "$(jq -r '.baseline.rollbackSpecSha256' <<<"$BACKSTAGE_PENDING_STATE_JSON")" ]] || {
      backstage_rollback_fail "baseline rollback Deployment spec hash is invalid"
      return 1
    }
  else
    actual_baseline_rollback_spec="$actual_baseline_spec"
    actual_baseline_rollback_spec_sha256="$actual_baseline_spec_sha256"
  fi
  if [[ "$schema_version" == 3 || "$schema_version" == 4 ]]; then
    while IFS= read -r snapshot; do
      [[ "$(jq -r '.exists' <<<"$snapshot")" == true ]] || continue
      payload="$(jq -cS '.payload' <<<"$snapshot")" || return 1
      payload_sha256="$(printf '%s' "$payload" | sha256sum | awk '{print $1}')" || return 1
      expected_payload_sha256="$(jq -r '.payloadSha256' <<<"$snapshot")" || return 1
      [[ "$payload_sha256" == "$expected_payload_sha256" ]] || {
        backstage_rollback_fail "managed resource snapshot payload hash is invalid"
        return 1
      }
    done < <(jq -c '.baseline.resources[]' <<<"$BACKSTAGE_PENDING_STATE_JSON")
    while IFS= read -r snapshot; do
      [[ "$(jq -r '.exists' <<<"$snapshot")" == true ]] || continue
      payload="$(jq -cS '.payload' <<<"$snapshot")" || return 1
      payload_sha256="$(printf '%s' "$payload" | sha256sum | awk '{print $1}')" || return 1
      expected_payload_sha256="$(jq -r '.payloadSha256' <<<"$snapshot")" || return 1
      [[ "$payload_sha256" == "$expected_payload_sha256" ]] || {
        backstage_rollback_fail "managed resource intent payload hash is invalid"
        return 1
      }
    done < <(jq -c '.resourceIntents[]' <<<"$BACKSTAGE_PENDING_STATE_JSON")
    if [[ "$(jq -r '.phase' <<<"$BACKSTAGE_PENDING_STATE_JSON")" == CANDIDATE_READY ]]; then
      while IFS= read -r snapshot; do
        payload="$(jq -cS '.payload' <<<"$snapshot")" || return 1
        payload_sha256="$(printf '%s' "$payload" | sha256sum | awk '{print $1}')" || return 1
        expected_payload_sha256="$(jq -r '.payloadSha256' <<<"$snapshot")" || return 1
        [[ "$payload_sha256" == "$expected_payload_sha256" ]] || {
          backstage_rollback_fail "candidate managed resource snapshot payload hash is invalid"
          return 1
        }
      done < <(jq -c '.candidate.resources[]' <<<"$BACKSTAGE_PENDING_STATE_JSON")
    fi
    runtime_dependencies="$(jq -cS '.runtimeDependencies' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
    runtime_dependency_closure_sha256="$(calculate_backstage_runtime_dependency_closure_sha256 \
      "$runtime_dependencies")" || return 1
    if [[ "$(jq -r '.phase' <<<"$BACKSTAGE_PENDING_STATE_JSON")" == CANDIDATE_READY &&
          "$runtime_dependency_closure_sha256" != \
            "$(jq -r '.candidate.runtimeDependencyClosureSha256' <<<"$BACKSTAGE_PENDING_STATE_JSON")" ]]; then
      backstage_rollback_fail "candidate runtime dependency closure hash is invalid"
      return 1
    fi
  fi
  if [[ ( "$schema_version" == 2 || "$schema_version" == 3 || "$schema_version" == 4 ) &&
        "$(jq -r '.phase' <<<"$BACKSTAGE_PENDING_STATE_JSON")" == "CANDIDATE_READY" ]]; then
    actual_candidate_spec="$(jq -cS '.candidate.spec' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
    actual_candidate_spec_sha256="$(printf '%s' "$actual_candidate_spec" | sha256sum | awk '{print $1}')" || return 1
    [[ "$actual_candidate_spec_sha256" == "$(jq -r '.candidate.specSha256' <<<"$BACKSTAGE_PENDING_STATE_JSON")" ]] || {
      backstage_rollback_fail "candidate Deployment spec hash is invalid"
      return 1
    }
  fi
  if [[ ( "$schema_version" == 3 || "$schema_version" == 4 ) &&
        "$(jq -r '.plannedDeployment.spec != null' <<<"$BACKSTAGE_PENDING_STATE_JSON")" == true ]]; then
    BACKSTAGE_PLANNED_DEPLOYMENT_SPEC="$(jq -cS '.plannedDeployment.spec' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
    BACKSTAGE_PLANNED_DEPLOYMENT_SPEC_SHA256="$(printf '%s' "$BACKSTAGE_PLANNED_DEPLOYMENT_SPEC" | sha256sum | awk '{print $1}')" || return 1
    [[ "$BACKSTAGE_PLANNED_DEPLOYMENT_SPEC_SHA256" == "$(jq -r '.plannedDeployment.specSha256' <<<"$BACKSTAGE_PENDING_STATE_JSON")" ]] || {
      backstage_rollback_fail "planned Deployment spec hash is invalid"
      return 1
    }
  else
    BACKSTAGE_PLANNED_DEPLOYMENT_SPEC=""
    BACKSTAGE_PLANNED_DEPLOYMENT_SPEC_SHA256=""
  fi
  BACKSTAGE_PENDING_SCHEMA_VERSION="$schema_version"
  BACKSTAGE_BASELINE_UID="$(jq -r '.baseline.uid' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
  BACKSTAGE_BASELINE_RESOURCE_VERSION="$(jq -r '.baseline.resourceVersion' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
  BACKSTAGE_BASELINE_SPEC="$(jq -cS '.baseline.spec' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
  BACKSTAGE_BASELINE_SPEC_SHA256="$actual_baseline_spec_sha256"
  BACKSTAGE_BASELINE_ROLLBACK_SPEC="$actual_baseline_rollback_spec"
  BACKSTAGE_BASELINE_ROLLBACK_SPEC_SHA256="$actual_baseline_rollback_spec_sha256"
  if [[ "$schema_version" == 1 ]]; then
    BACKSTAGE_PENDING_PHASE="LEGACY_BASELINE_ONLY"
    BACKSTAGE_PENDING_TARGET_COMMIT=""
    BACKSTAGE_PENDING_AUTHORITY_KIND="LEGACY_V1"
    BACKSTAGE_PENDING_FINALIZE_MODE="legacy"
    BACKSTAGE_PENDING_COORDINATOR="legacy"
    BACKSTAGE_PENDING_ATTEMPT_ID=""
    BACKSTAGE_PENDING_ATTEMPT_ID_PRESENT=false
    BACKSTAGE_PENDING_RUNTIME_FINGERPRINT=""
    BACKSTAGE_PENDING_DEPLOYMENT_CLOSURE_SHA256=""
    BACKSTAGE_PENDING_RESOURCE_INTENTS=""
    BACKSTAGE_PENDING_RUNTIME_DEPENDENCIES=""
    BACKSTAGE_PENDING_RUNTIME_DEPENDENCY_CLOSURE_SHA256=""
    BACKSTAGE_PENDING_BASELINE_TAG_PROOF="null"
    BACKSTAGE_CANDIDATE_IMAGE=""
    BACKSTAGE_CANDIDATE_SPEC=""
    BACKSTAGE_CANDIDATE_SPEC_SHA256=""
    BACKSTAGE_BASELINE_MANAGED_RESOURCES=""
    BACKSTAGE_CANDIDATE_MANAGED_RESOURCES=""
    BACKSTAGE_CANDIDATE_LIVE_RESOURCE_CLOSURE_SHA256=""
    BACKSTAGE_PLANNED_DEPLOYMENT_SPEC=""
    BACKSTAGE_PLANNED_DEPLOYMENT_SPEC_SHA256=""
  else
    BACKSTAGE_PENDING_PHASE="$(jq -r '.phase' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
    BACKSTAGE_PENDING_TARGET_COMMIT="$(jq -r '.targetCommit' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
    BACKSTAGE_PENDING_AUTHORITY_KIND="$(jq -r '.authorityKind' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
    if [[ "$schema_version" == 3 || "$schema_version" == 4 ]]; then
      BACKSTAGE_PENDING_FINALIZE_MODE="$(jq -r '.finalizeMode' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
      BACKSTAGE_PENDING_COORDINATOR="$(jq -r '.coordinator' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
    else
      BACKSTAGE_PENDING_FINALIZE_MODE="legacy"
      BACKSTAGE_PENDING_COORDINATOR="legacy"
    fi
    if jq -e 'has("attemptId")' <<<"$BACKSTAGE_PENDING_STATE_JSON" >/dev/null; then
      BACKSTAGE_PENDING_ATTEMPT_ID="$(jq -r '.attemptId' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
      BACKSTAGE_PENDING_ATTEMPT_ID_PRESENT=true
      BACKSTAGE_PENDING_RUNTIME_FINGERPRINT="$(jq -r '.runtimeFingerprint' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
      BACKSTAGE_PENDING_DEPLOYMENT_CLOSURE_SHA256="$(jq -r '.deploymentClosureSha256' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
      if [[ "$schema_version" == 3 || "$schema_version" == 4 ]]; then
        BACKSTAGE_PENDING_RESOURCE_INTENTS="$(jq -cS '.resourceIntents' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
        BACKSTAGE_PENDING_RUNTIME_DEPENDENCIES="$(jq -cS '.runtimeDependencies' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
        BACKSTAGE_PENDING_RUNTIME_DEPENDENCY_CLOSURE_SHA256="$(jq -r '.candidate.runtimeDependencyClosureSha256 // ""' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
      else
        BACKSTAGE_PENDING_RESOURCE_INTENTS=""
        BACKSTAGE_PENDING_RUNTIME_DEPENDENCIES=""
        BACKSTAGE_PENDING_RUNTIME_DEPENDENCY_CLOSURE_SHA256=""
      fi
    else
      # Old v2 DB/APPLIED pending states predate explicit attempt IDs. Derive a
      # stable compatibility ID only from integrity-bound fields that do not
      # change across baseline -> armed -> candidate phase transitions.
      legacy_attempt_material="$(jq -cS '{schemaVersion,targetCommit,authorityKind,namespace,deploymentName,baseline,candidateImage:.candidate.image}' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
      BACKSTAGE_PENDING_ATTEMPT_ID="$(printf '%s' "$legacy_attempt_material" | sha256sum | awk '{print substr($1,1,32)}')" || return 1
      is_valid_backstage_attempt_id "$BACKSTAGE_PENDING_ATTEMPT_ID" || return 1
      BACKSTAGE_PENDING_ATTEMPT_ID_PRESENT=false
      BACKSTAGE_PENDING_RUNTIME_FINGERPRINT=""
      BACKSTAGE_PENDING_DEPLOYMENT_CLOSURE_SHA256=""
      BACKSTAGE_PENDING_RESOURCE_INTENTS=""
      BACKSTAGE_PENDING_RUNTIME_DEPENDENCIES=""
      BACKSTAGE_PENDING_RUNTIME_DEPENDENCY_CLOSURE_SHA256=""
    fi
    BACKSTAGE_CANDIDATE_IMAGE="$(jq -r '.candidate.image' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
    if [[ "$schema_version" == 4 ]] &&
       ! is_digest_pinned_backstage_candidate_image "$BACKSTAGE_CANDIDATE_IMAGE"; then
      backstage_rollback_fail "v4 candidate image is not digest-pinned"
      return 1
    fi
    if [[ "$schema_version" == 4 ]]; then
      BACKSTAGE_PENDING_BASELINE_TAG_PROOF="$(jq -cS '.candidate.baselineTagProof' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
      if [[ "$BACKSTAGE_PENDING_BASELINE_TAG_PROOF" != null ]]; then
        is_digest_pinned_backstage_candidate_image \
          "$(jq -r '.digestImage' <<<"$BACKSTAGE_PENDING_BASELINE_TAG_PROOF")" || {
          backstage_rollback_fail "v4 baseline tag proof digest is invalid"
          return 1
        }
        [[ "$(jq -r '.holdTag' <<<"$BACKSTAGE_PENDING_BASELINE_TAG_PROOF")" == \
           "$IMAGE_REPOSITORY:rollback-hold-${BACKSTAGE_PENDING_ATTEMPT_ID}" ]] || {
          backstage_rollback_fail "v4 baseline rollback hold tag does not bind the exact attempt"
          return 1
        }
      fi
    else
      BACKSTAGE_PENDING_BASELINE_TAG_PROOF="null"
    fi
    BACKSTAGE_CANDIDATE_SPEC="$(jq -cS '.candidate.spec // empty' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
    BACKSTAGE_CANDIDATE_SPEC_SHA256="$(jq -r '.candidate.specSha256 // ""' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
    if [[ "$schema_version" == 3 || "$schema_version" == 4 ]]; then
      BACKSTAGE_BASELINE_MANAGED_RESOURCES="$(jq -cS '.baseline.resources' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
      BACKSTAGE_CANDIDATE_MANAGED_RESOURCES="$(jq -cS '.candidate.resources' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
      BACKSTAGE_CANDIDATE_LIVE_RESOURCE_CLOSURE_SHA256="$(jq -r '.candidate.liveResourceClosureSha256 // ""' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
    else
      BACKSTAGE_BASELINE_MANAGED_RESOURCES=""
      BACKSTAGE_CANDIDATE_MANAGED_RESOURCES=""
      BACKSTAGE_CANDIDATE_LIVE_RESOURCE_CLOSURE_SHA256=""
    fi
  fi
}

backstage_parent_authority_binding_exists() {
  [[ -e "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE" ||
     -L "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE" ]]
}

load_backstage_parent_authority_binding() {
  local binding_dir state_dir lexical_dir logical_dir physical_dir physical_state_dir
  local before after payload expected_integrity actual_integrity
  binding_dir="$(dirname -- "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE")"
  state_dir="$(dirname -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE")"
  [[ -d "$binding_dir" && ! -L "$binding_dir" ]] || {
    backstage_rollback_fail "parent authority binding directory is invalid; mutation=0"
    return 79
  }
  lexical_dir="$(realpath -m -s -- "$binding_dir" 2>/dev/null || true)"
  logical_dir="$(readlink -m -- "$binding_dir" 2>/dev/null || true)"
  physical_dir="$(readlink -f -- "$binding_dir" 2>/dev/null || true)"
  physical_state_dir="$(readlink -f -- "$state_dir" 2>/dev/null || true)"
  [[ -n "$lexical_dir" && "$lexical_dir" == "$logical_dir" &&
     "$logical_dir" == "$physical_dir" &&
     "$physical_dir" == "$physical_state_dir" &&
     "$(stat -c '%a:%u' -- "$binding_dir" 2>/dev/null || true)" == "700:$(id -u)" ]] || {
    backstage_rollback_fail "parent authority binding directory security is invalid; mutation=0"
    return 79
  }
  [[ -f "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE" &&
     ! -L "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE" &&
     "$(stat -c '%a:%u:%h' -- "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE" 2>/dev/null || true)" == "600:$(id -u):1" ]] || {
    backstage_rollback_fail "parent authority binding file security is invalid; mutation=0"
    return 79
  }
  before="$(stat -c '%d:%i:%s:%y:%z' -- "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE" 2>/dev/null || true)"
  BACKSTAGE_PARENT_AUTHORITY_BINDING_JSON="$(<"$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE")" || return 79
  after="$(stat -c '%d:%i:%s:%y:%z' -- "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE" 2>/dev/null || true)"
  [[ -n "$before" && "$before" == "$after" ]] || {
    backstage_rollback_fail "parent authority binding changed while being read; mutation=0"
    return 79
  }
  jq -e '
      type == "object" and
      (keys | sort) == ["appliedMarkerBeforeSha256","appliedMarkerBeforeStat","attemptId","authorityKind","integritySha256","kind","pendingSha256","releaseAttemptId","schemaVersion","status","targetCommit"] and
      .schemaVersion == 1 and .kind == "BackstageParentAuthorityBinding" and
      (.targetCommit | type == "string" and test("^[0-9a-f]{40}$")) and
      (.attemptId | type == "string" and test("^[0-9a-f]{32}$")) and
      (.pendingSha256 | type == "string" and test("^[0-9a-f]{64}$")) and
      (.integritySha256 | type == "string" and test("^[0-9a-f]{64}$")) and
      (.status == "ARMED" or .status == "AUTHORIZED") and
      if .authorityKind == "DB_PROMOTION" then
        (.releaseAttemptId | type == "string" and test("^[A-Za-z0-9._:-]{12,160}$")) and
        .appliedMarkerBeforeSha256 == null and .appliedMarkerBeforeStat == null
      elif .authorityKind == "APPLIED_MARKER" then
        .releaseAttemptId == null and
        ((.appliedMarkerBeforeSha256 == "ABSENT") or
         (.appliedMarkerBeforeSha256 | type == "string" and test("^[0-9a-f]{64}$"))) and
        ((.appliedMarkerBeforeStat == "ABSENT") or
         (.appliedMarkerBeforeStat | type == "string" and
           length >= 15 and length <= 512 and test("^[ -~]+$")))
      else false end
    ' <<<"$BACKSTAGE_PARENT_AUTHORITY_BINDING_JSON" >/dev/null || {
    backstage_rollback_fail "parent authority binding schema is invalid; mutation=0"
    return 79
  }
  payload="$(jq -cS 'del(.integritySha256)' <<<"$BACKSTAGE_PARENT_AUTHORITY_BINDING_JSON")" || return 79
  expected_integrity="$(jq -r '.integritySha256' <<<"$BACKSTAGE_PARENT_AUTHORITY_BINDING_JSON")" || return 79
  actual_integrity="$(printf '%s' "$payload" | sha256sum | awk '{print $1}')" || return 79
  [[ "$actual_integrity" == "$expected_integrity" ]] || {
    backstage_rollback_fail "parent authority binding integrity is invalid; mutation=0"
    return 79
  }
  BACKSTAGE_PARENT_AUTHORITY_BINDING_TARGET_COMMIT="$(jq -r '.targetCommit' <<<"$BACKSTAGE_PARENT_AUTHORITY_BINDING_JSON")"
  BACKSTAGE_PARENT_AUTHORITY_BINDING_ATTEMPT_ID="$(jq -r '.attemptId' <<<"$BACKSTAGE_PARENT_AUTHORITY_BINDING_JSON")"
  BACKSTAGE_PARENT_AUTHORITY_BINDING_PENDING_SHA256="$(jq -r '.pendingSha256' <<<"$BACKSTAGE_PARENT_AUTHORITY_BINDING_JSON")"
  BACKSTAGE_PARENT_AUTHORITY_BINDING_STATUS="$(jq -r '.status' <<<"$BACKSTAGE_PARENT_AUTHORITY_BINDING_JSON")"
  BACKSTAGE_PARENT_AUTHORITY_BINDING_KIND="$(jq -r '.authorityKind' <<<"$BACKSTAGE_PARENT_AUTHORITY_BINDING_JSON")"
  BACKSTAGE_PARENT_AUTHORITY_BINDING_RELEASE_ATTEMPT_ID="$(jq -r '.releaseAttemptId // ""' <<<"$BACKSTAGE_PARENT_AUTHORITY_BINDING_JSON")"
  BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE_SHA256="$(sha256sum -- "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE" | awk '{print $1}')" || return 79
  BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE_STAT="$after"
}

reject_active_backstage_parent_authority_binding() {
  backstage_parent_authority_binding_exists || return 0
  load_backstage_parent_authority_binding || return 79
  backstage_rollback_fail "active parent authority binding forbids a new or standalone mutation; mutation=0"
  return 79
}

authorize_backstage_parent_binding_cli_mode() {
  local cli_mode="$1" cli_commit="${2:-}"
  backstage_parent_authority_binding_exists || return 0
  load_backstage_parent_authority_binding || return 79
  case "$cli_mode" in
    verify-runtime-identity) return 0 ;;
    verify-pending-candidate)
      [[ -n "$BACKSTAGE_DEPLOYMENT_INHERITED_LOCK_FD" &&
         -n "$BACKSTAGE_EXPECTED_PENDING_SHA256" &&
         -n "$BACKSTAGE_EXPECTED_ATTEMPT_ID" &&
         "$cli_commit" == "$BACKSTAGE_PARENT_AUTHORITY_BINDING_TARGET_COMMIT" &&
         "$BACKSTAGE_EXPECTED_PENDING_SHA256" == "$BACKSTAGE_PARENT_AUTHORITY_BINDING_PENDING_SHA256" &&
         "$BACKSTAGE_EXPECTED_ATTEMPT_ID" == "$BACKSTAGE_PARENT_AUTHORITY_BINDING_ATTEMPT_ID" ]] || {
        backstage_rollback_fail "pending candidate proof requires inherited lock and exact parent binding; mutation=0"
        return 79
      }
      return 0
      ;;
    recover-pending|finalize-pending|reconcile-pending|reconcile-parent-authority-binding)
      [[ -n "$BACKSTAGE_DEPLOYMENT_INHERITED_LOCK_FD" &&
         -n "$BACKSTAGE_EXPECTED_PENDING_SHA256" &&
         -n "$BACKSTAGE_EXPECTED_ATTEMPT_ID" &&
         "$BACKSTAGE_EXPECTED_PENDING_SHA256" == "$BACKSTAGE_PARENT_AUTHORITY_BINDING_PENDING_SHA256" &&
         "$BACKSTAGE_EXPECTED_ATTEMPT_ID" == "$BACKSTAGE_PARENT_AUTHORITY_BINDING_ATTEMPT_ID" ]] || {
        backstage_rollback_fail "active parent authority binding requires inherited lock and exact pending identity; mutation=0"
        return 79
      }
      if [[ "$cli_mode" == reconcile-parent-authority-binding ]]; then
        [[ "$BACKSTAGE_PARENT_AUTHORITY_BINDING_STATUS" == AUTHORIZED &&
           "$cli_commit" == "$BACKSTAGE_PARENT_AUTHORITY_BINDING_TARGET_COMMIT" ]] || {
          backstage_rollback_fail "orphan parent authority binding is not exact AUTHORIZED target; mutation=0"
          return 79
        }
      elif [[ "$cli_mode" == recover-pending ]]; then
        [[ "$BACKSTAGE_PARENT_AUTHORITY_BINDING_STATUS" == ARMED ]] || {
          backstage_rollback_fail "AUTHORIZED parent authority binding cannot authorize rollback recovery; mutation=0"
          return 79
        }
      elif [[ "$cli_mode" == finalize-pending ||
              "$cli_commit" == "$BACKSTAGE_PARENT_AUTHORITY_BINDING_TARGET_COMMIT" ]]; then
        [[ "$BACKSTAGE_PARENT_AUTHORITY_BINDING_STATUS" == AUTHORIZED ]] || {
          backstage_rollback_fail "parent authority binding is not AUTHORIZED for finalization; mutation=0"
          return 79
        }
      else
        [[ "$BACKSTAGE_PARENT_AUTHORITY_BINDING_STATUS" == ARMED ]] || {
          backstage_rollback_fail "AUTHORIZED parent authority binding contradicts rollback reconciliation; mutation=0"
          return 79
        }
      fi
      return 0
      ;;
    *)
      backstage_rollback_fail "active parent authority binding blocks this child mode; mutation=0"
      return 79
      ;;
  esac
}

reconcile_orphan_backstage_parent_authority_binding() {
  local exact_target="$1" before_stat before_sha after_stat after_sha binding_dir
  is_exact_backstage_commit "$exact_target" || {
    backstage_rollback_fail "orphan parent authority target is invalid; mutation=0"
    return 79
  }
  backstage_parent_authority_binding_exists || return 0
  load_backstage_parent_authority_binding || return 79
  [[ "$BACKSTAGE_PARENT_AUTHORITY_BINDING_STATUS" == AUTHORIZED &&
     "$BACKSTAGE_PARENT_AUTHORITY_BINDING_TARGET_COMMIT" == "$exact_target" &&
     "$BACKSTAGE_PARENT_AUTHORITY_BINDING_PENDING_SHA256" == "$BACKSTAGE_EXPECTED_PENDING_SHA256" &&
     "$BACKSTAGE_PARENT_AUTHORITY_BINDING_ATTEMPT_ID" == "$BACKSTAGE_EXPECTED_ATTEMPT_ID" ]] || {
    backstage_rollback_fail "orphan parent authority binding does not match expected exact identity; mutation=0"
    return 79
  }
  if backstage_pending_state_exists; then
    backstage_rollback_fail "orphan parent authority reconciliation requires pending state absent; mutation=0"
    return 79
  fi
  verify_backstage_runtime_identity_against_live "$exact_target" true true || {
    backstage_rollback_fail "orphan parent authority runtime identity proof failed; mutation=0"
    return 79
  }
  [[ "$BACKSTAGE_RUNTIME_IDENTITY_ATTEMPT_ID" == "$BACKSTAGE_PARENT_AUTHORITY_BINDING_ATTEMPT_ID" ]] || {
    backstage_rollback_fail "orphan parent authority attempt does not match runtime identity; mutation=0"
    return 79
  }
  before_stat="$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE_STAT"
  before_sha="$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE_SHA256"
  load_backstage_parent_authority_binding || return 79
  after_stat="$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE_STAT"
  after_sha="$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE_SHA256"
  [[ "$before_stat" == "$after_stat" && "$before_sha" == "$after_sha" &&
     "$BACKSTAGE_PARENT_AUTHORITY_BINDING_STATUS" == AUTHORIZED &&
     "$BACKSTAGE_PARENT_AUTHORITY_BINDING_TARGET_COMMIT" == "$exact_target" &&
     "$BACKSTAGE_PARENT_AUTHORITY_BINDING_PENDING_SHA256" == "$BACKSTAGE_EXPECTED_PENDING_SHA256" &&
     "$BACKSTAGE_PARENT_AUTHORITY_BINDING_ATTEMPT_ID" == "$BACKSTAGE_EXPECTED_ATTEMPT_ID" ]] || {
    backstage_rollback_fail "orphan parent authority binding changed before clear; mutation=0"
    return 79
  }
  rm -- "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE" || {
    backstage_rollback_fail "orphan parent authority binding clear failed; mutation=0"
    return 79
  }
  binding_dir="$(dirname -- "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE")"
  sync -f "$binding_dir" 2>/dev/null || sync "$binding_dir" 2>/dev/null || {
    backstage_rollback_fail "orphan parent authority directory sync failed; mutation=0"
    return 79
  }
  [[ ! -e "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE" &&
     ! -L "$BACKSTAGE_PARENT_AUTHORITY_BINDING_FILE" ]] || {
    backstage_rollback_fail "orphan parent authority binding remains after clear; mutation=0"
    return 79
  }
  echo "[backstage] parent authority binding reconciled target=$exact_target pending=0 binding=0"
}

backstage_repair_authority_exists() {
  [[ -e "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE" || -L "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE" ]]
}

prepare_backstage_repair_authority_directory() {
  local authority_dir state_dir lexical_dir logical_dir physical_dir physical_state_dir
  authority_dir="$(dirname -- "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE")"
  state_dir="$(dirname -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE")"
  [[ -d "$authority_dir" && ! -L "$authority_dir" ]] || {
    backstage_rollback_fail "repair authority directory is invalid"
    return 1
  }
  lexical_dir="$(realpath -m -s -- "$authority_dir" 2>/dev/null || true)"
  logical_dir="$(readlink -m -- "$authority_dir" 2>/dev/null || true)"
  physical_dir="$(readlink -f -- "$authority_dir" 2>/dev/null || true)"
  physical_state_dir="$(readlink -f -- "$state_dir" 2>/dev/null || true)"
  [[ -n "$lexical_dir" && "$lexical_dir" == "$logical_dir" &&
     "$logical_dir" == "$physical_dir" && "$physical_dir" == "$physical_state_dir" ]] || {
    backstage_rollback_fail "repair authority directory contains a symlink"
    return 1
  }
  [[ "$(stat -c '%a:%u' -- "$authority_dir" 2>/dev/null || true)" == "700:$(id -u)" ]] || {
    backstage_rollback_fail "repair authority directory owner or mode is invalid"
    return 1
  }
}

load_backstage_repair_authority() {
  local authority_before authority_after authority_payload expected_integrity actual_integrity
  prepare_backstage_repair_authority_directory || return 79
  [[ -f "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE" &&
     ! -L "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE" ]] || {
    backstage_rollback_fail "repair authority is not a regular non-symlink file"
    return 79
  }
  [[ "$(stat -c '%a:%u:%h' -- "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE" 2>/dev/null || true)" == "600:$(id -u):1" ]] || {
    backstage_rollback_fail "repair authority owner, mode, or link count is invalid"
    return 79
  }
  authority_before="$(stat -c '%d:%i:%a:%u:%h:%s:%y:%z' -- "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE" 2>/dev/null || true)"
  BACKSTAGE_REPAIR_AUTHORITY_JSON="$(<"$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE")" || {
    backstage_rollback_fail "repair authority cannot be read"
    return 79
  }
  BACKSTAGE_REPAIR_AUTHORITY_FILE_SHA256="$(sha256sum -- "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE" | awk '{print $1}')" || return 79
  authority_after="$(stat -c '%d:%i:%a:%u:%h:%s:%y:%z' -- "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE" 2>/dev/null || true)"
  [[ -n "$authority_before" && "$authority_before" == "$authority_after" ]] || {
    backstage_rollback_fail "repair authority changed while being read; mutation=0"
    return 79
  }
  if ! jq -e '
      type == "object" and
      (keys | sort) == ["attemptId","integritySha256","pendingSha256","schemaVersion","status","targetCommit"] and
      .schemaVersion == 1 and
      (.targetCommit | type == "string" and test("^[0-9a-f]{40}$")) and
      (.attemptId | type == "string" and test("^[0-9a-f]{32}$")) and
      (.pendingSha256 | type == "string" and test("^[0-9a-f]{64}$")) and
      (.status == "ARMED" or .status == "AUTHORIZED") and
      (.integritySha256 | type == "string" and test("^[0-9a-f]{64}$"))
    ' <<<"$BACKSTAGE_REPAIR_AUTHORITY_JSON" >/dev/null; then
    backstage_rollback_fail "repair authority schema is invalid; mutation=0"
    return 79
  fi
  authority_payload="$(jq -cS 'del(.integritySha256)' <<<"$BACKSTAGE_REPAIR_AUTHORITY_JSON")" || return 79
  expected_integrity="$(jq -r '.integritySha256' <<<"$BACKSTAGE_REPAIR_AUTHORITY_JSON")" || return 79
  actual_integrity="$(printf '%s' "$authority_payload" | sha256sum | awk '{print $1}')" || return 79
  [[ "$actual_integrity" == "$expected_integrity" ]] || {
    backstage_rollback_fail "repair authority integrity check failed; mutation=0"
    return 79
  }
  BACKSTAGE_REPAIR_AUTHORITY_FILE_STAT="$authority_before"
  BACKSTAGE_REPAIR_AUTHORITY_TARGET_COMMIT="$(jq -r '.targetCommit' <<<"$BACKSTAGE_REPAIR_AUTHORITY_JSON")" || return 79
  BACKSTAGE_REPAIR_AUTHORITY_ATTEMPT_ID="$(jq -r '.attemptId' <<<"$BACKSTAGE_REPAIR_AUTHORITY_JSON")" || return 79
  BACKSTAGE_REPAIR_AUTHORITY_PENDING_SHA256="$(jq -r '.pendingSha256' <<<"$BACKSTAGE_REPAIR_AUTHORITY_JSON")" || return 79
  BACKSTAGE_REPAIR_AUTHORITY_STATUS="$(jq -r '.status' <<<"$BACKSTAGE_REPAIR_AUTHORITY_JSON")" || return 79
}

repair_authority_matches_loaded_pending() {
  [[ ( "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 3 || "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 ) &&
     "$BACKSTAGE_PENDING_AUTHORITY_KIND" == "REPAIR_TOKEN" &&
     "$BACKSTAGE_PENDING_ATTEMPT_ID_PRESENT" == true &&
     "$BACKSTAGE_REPAIR_AUTHORITY_TARGET_COMMIT" == "$BACKSTAGE_PENDING_TARGET_COMMIT" &&
     "$BACKSTAGE_REPAIR_AUTHORITY_ATTEMPT_ID" == "$BACKSTAGE_PENDING_ATTEMPT_ID" &&
     "$BACKSTAGE_REPAIR_AUTHORITY_PENDING_SHA256" == "$BACKSTAGE_PENDING_FILE_SHA256" ]]
}

validate_authorized_repair_token_for_pending() {
  [[ "$BACKSTAGE_PENDING_AUTHORITY_KIND" == "REPAIR_TOKEN" ]] || return 0
  [[ -n "$BACKSTAGE_EXPECTED_PENDING_SHA256" &&
     "$BACKSTAGE_EXPECTED_PENDING_SHA256" == "$BACKSTAGE_PENDING_FILE_SHA256" &&
     -n "$BACKSTAGE_EXPECTED_ATTEMPT_ID" &&
     "$BACKSTAGE_EXPECTED_ATTEMPT_ID" == "$BACKSTAGE_PENDING_ATTEMPT_ID" ]] || {
    backstage_rollback_fail "repair finalization requires exact expected pending SHA-256 and attempt ID; mutation=0"
    return 79
  }
  backstage_repair_authority_exists || {
    backstage_rollback_fail "authorized repair token is absent; mutation=0"
    return 79
  }
  load_backstage_repair_authority || return 79
  repair_authority_matches_loaded_pending || {
    backstage_rollback_fail "repair authority does not bind exact pending target, attempt, and SHA-256; mutation=0"
    return 79
  }
  [[ "$BACKSTAGE_REPAIR_AUTHORITY_STATUS" == "AUTHORIZED" ]] || {
    backstage_rollback_fail "repair authority is not AUTHORIZED; mutation=0"
    return 79
  }
}

remove_loaded_backstage_repair_authority() {
  local authority_dir current_stat current_sha256
  authority_dir="$(dirname -- "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE")"
  [[ -f "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE" &&
     ! -L "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE" ]] || {
    backstage_rollback_fail "repair authority changed before removal; mutation=0"
    return 79
  }
  current_stat="$(stat -c '%d:%i:%a:%u:%h:%s:%y:%z' -- "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE" 2>/dev/null || true)"
  current_sha256="$(sha256sum -- "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE" | awk '{print $1}')" || return 79
  [[ "$current_stat" == "$BACKSTAGE_REPAIR_AUTHORITY_FILE_STAT" &&
     "$current_sha256" == "$BACKSTAGE_REPAIR_AUTHORITY_FILE_SHA256" ]] || {
    backstage_rollback_fail "repair authority changed before removal; mutation=0"
    return 79
  }
  rm -f -- "$BACKSTAGE_DEPLOYMENT_REPAIR_AUTHORITY_FILE" || {
    backstage_rollback_fail "repair authority removal failed"
    return 79
  }
  sync -f "$authority_dir" || {
    backstage_rollback_fail "repair authority directory sync failed"
    return 79
  }
  backstage_repair_authority_exists && {
    backstage_rollback_fail "repair authority remains after removal"
    return 79
  }
  BACKSTAGE_REPAIR_AUTHORITY_JSON=""
  BACKSTAGE_REPAIR_AUTHORITY_TARGET_COMMIT=""
  BACKSTAGE_REPAIR_AUTHORITY_ATTEMPT_ID=""
  BACKSTAGE_REPAIR_AUTHORITY_PENDING_SHA256=""
  BACKSTAGE_REPAIR_AUTHORITY_STATUS=""
  BACKSTAGE_REPAIR_AUTHORITY_FILE_SHA256=""
  BACKSTAGE_REPAIR_AUTHORITY_FILE_STAT=""
}

inspect_backstage_repair_authority_for_rollback() {
  BACKSTAGE_REPAIR_AUTHORITY_CLEAR_AFTER_ROLLBACK=false
  if ! backstage_repair_authority_exists; then
    return 0
  fi
  [[ "$BACKSTAGE_PENDING_AUTHORITY_KIND" == "REPAIR_TOKEN" ]] || {
    backstage_rollback_fail "repair authority exists for a non-repair pending state; mutation=0"
    return 79
  }
  load_backstage_repair_authority || return 79
  repair_authority_matches_loaded_pending || {
    backstage_rollback_fail "repair authority does not bind rollback pending state; mutation=0"
    return 79
  }
  if [[ "$BACKSTAGE_REPAIR_AUTHORITY_STATUS" == "AUTHORIZED" ]]; then
    backstage_rollback_fail "authorized repair token forbids candidate rollback"
    return 79
  fi
  BACKSTAGE_REPAIR_AUTHORITY_CLEAR_AFTER_ROLLBACK=true
}

clear_backstage_repair_authority_after_rollback() {
  local expected_stat expected_sha256 expected_target expected_attempt expected_pending
  [[ "$BACKSTAGE_REPAIR_AUTHORITY_CLEAR_AFTER_ROLLBACK" == true ]] || return 0
  expected_stat="$BACKSTAGE_REPAIR_AUTHORITY_FILE_STAT"
  expected_sha256="$BACKSTAGE_REPAIR_AUTHORITY_FILE_SHA256"
  expected_target="$BACKSTAGE_REPAIR_AUTHORITY_TARGET_COMMIT"
  expected_attempt="$BACKSTAGE_REPAIR_AUTHORITY_ATTEMPT_ID"
  expected_pending="$BACKSTAGE_REPAIR_AUTHORITY_PENDING_SHA256"
  load_backstage_repair_authority || return 79
  [[ "$BACKSTAGE_REPAIR_AUTHORITY_FILE_STAT" == "$expected_stat" &&
     "$BACKSTAGE_REPAIR_AUTHORITY_FILE_SHA256" == "$expected_sha256" &&
     "$BACKSTAGE_REPAIR_AUTHORITY_TARGET_COMMIT" == "$expected_target" &&
     "$BACKSTAGE_REPAIR_AUTHORITY_ATTEMPT_ID" == "$expected_attempt" &&
     "$BACKSTAGE_REPAIR_AUTHORITY_PENDING_SHA256" == "$expected_pending" &&
     "$BACKSTAGE_REPAIR_AUTHORITY_STATUS" == "ARMED" ]] || {
    backstage_rollback_fail "repair authority changed before rollback cleanup; mutation=0"
    return 79
  }
  remove_loaded_backstage_repair_authority || return 79
  BACKSTAGE_REPAIR_AUTHORITY_CLEAR_AFTER_ROLLBACK=false
  echo "[backstage] ARMED repair authority cleared after exact baseline proof"
}

clear_backstage_repair_authority_after_finalization() {
  local exact_target="$1" exact_attempt="$2"
  if ! backstage_repair_authority_exists; then
    return 0
  fi
  load_backstage_repair_authority || return 79
  [[ "$BACKSTAGE_REPAIR_AUTHORITY_STATUS" == "AUTHORIZED" &&
     "$BACKSTAGE_REPAIR_AUTHORITY_TARGET_COMMIT" == "$exact_target" &&
     "$BACKSTAGE_REPAIR_AUTHORITY_ATTEMPT_ID" == "$exact_attempt" ]] || {
    backstage_rollback_fail "repair authority does not match finalized runtime identity; mutation=0"
    return 79
  }
  if [[ -n "$BACKSTAGE_EXPECTED_PENDING_SHA256" &&
        "$BACKSTAGE_REPAIR_AUTHORITY_PENDING_SHA256" != "$BACKSTAGE_EXPECTED_PENDING_SHA256" ]]; then
    backstage_rollback_fail "repair authority pending SHA-256 differs from expected binding; mutation=0"
    return 79
  fi
  remove_loaded_backstage_repair_authority || return 79
  echo "[backstage] AUTHORIZED repair authority cleared after durable runtime identity proof"
}

reconcile_orphan_backstage_repair_authority() {
  if ! backstage_repair_authority_exists; then
    echo '[backstage] REPAIR_AUTHORITY_RECONCILE_PASS token=0 cleared=0 mutation=0'
    return 0
  fi
  backstage_pending_state_exists && {
    backstage_rollback_fail "repair authority reconciliation requires pending=0; mutation=0"
    return 79
  }
  load_backstage_repair_authority || return 79
  [[ "$BACKSTAGE_REPAIR_AUTHORITY_STATUS" == "AUTHORIZED" ]] || {
    backstage_rollback_fail "orphan repair authority is not AUTHORIZED; mutation=0"
    return 79
  }
  if [[ -n "$BACKSTAGE_EXPECTED_PENDING_SHA256" ]]; then
    [[ "$BACKSTAGE_EXPECTED_PENDING_SHA256" =~ ^[0-9a-f]{64}$ &&
       "$BACKSTAGE_REPAIR_AUTHORITY_PENDING_SHA256" == "$BACKSTAGE_EXPECTED_PENDING_SHA256" ]] || {
      backstage_rollback_fail "orphan repair authority expected pending SHA-256 mismatch; mutation=0"
      return 79
    }
  fi
  backstage_runtime_identity_exists || {
    backstage_rollback_fail "orphan AUTHORIZED repair authority has no runtime identity; mutation=0"
    return 79
  }
  load_backstage_runtime_identity || return 79
  [[ "$BACKSTAGE_RUNTIME_IDENTITY_TARGET_COMMIT" == "$BACKSTAGE_REPAIR_AUTHORITY_TARGET_COMMIT" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_ATTEMPT_ID" == "$BACKSTAGE_REPAIR_AUTHORITY_ATTEMPT_ID" ]] || {
    backstage_rollback_fail "orphan repair authority does not match runtime identity target and attempt; mutation=0"
    return 79
  }
  verify_backstage_runtime_identity_against_live \
    "$BACKSTAGE_REPAIR_AUTHORITY_TARGET_COMMIT" true || return 79
  verify_backstage_deploy_marker "$BACKSTAGE_REPAIR_AUTHORITY_TARGET_COMMIT" || return 79
  clear_backstage_repair_authority_after_finalization \
    "$BACKSTAGE_REPAIR_AUTHORITY_TARGET_COMMIT" "$BACKSTAGE_REPAIR_AUTHORITY_ATTEMPT_ID" || return 79
  echo '[backstage] REPAIR_AUTHORITY_RECONCILE_PASS token=1 cleared=1 pending=0 mutation=token-only'
}

backstage_runtime_identity_exists() {
  [[ -e "$BACKSTAGE_RUNTIME_IDENTITY_FILE" || -L "$BACKSTAGE_RUNTIME_IDENTITY_FILE" ]]
}

prepare_backstage_runtime_identity_directory() {
  local identity_dir state_dir lexical_dir logical_dir physical_dir physical_state_dir
  identity_dir="$(dirname -- "$BACKSTAGE_RUNTIME_IDENTITY_FILE")"
  state_dir="$(dirname -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE")"
  [[ -d "$identity_dir" && ! -L "$identity_dir" ]] || {
    backstage_rollback_fail "runtime identity directory is invalid"
    return 1
  }
  lexical_dir="$(realpath -m -s -- "$identity_dir" 2>/dev/null || true)"
  logical_dir="$(readlink -m -- "$identity_dir" 2>/dev/null || true)"
  physical_dir="$(readlink -f -- "$identity_dir" 2>/dev/null || true)"
  physical_state_dir="$(readlink -f -- "$state_dir" 2>/dev/null || true)"
  [[ -n "$lexical_dir" && "$lexical_dir" == "$logical_dir" &&
     "$logical_dir" == "$physical_dir" && "$physical_dir" == "$physical_state_dir" ]] || {
    backstage_rollback_fail "runtime identity directory contains a symlink"
    return 1
  }
}

verify_backstage_runtime_identity_file_security() {
  [[ -f "$BACKSTAGE_RUNTIME_IDENTITY_FILE" && ! -L "$BACKSTAGE_RUNTIME_IDENTITY_FILE" ]] || {
    backstage_rollback_fail "runtime identity is not a regular non-symlink file"
    return 1
  }
  [[ "$(stat -c '%a:%u:%h' -- "$BACKSTAGE_RUNTIME_IDENTITY_FILE" 2>/dev/null || true)" == "600:$(id -u):1" ]] || {
    backstage_rollback_fail "runtime identity owner, mode, or link count is invalid"
    return 1
  }
}

load_backstage_runtime_identity() {
  local identity_before identity_after identity_payload expected_integrity actual_integrity
  local runtime_dependency_closure_sha256
  prepare_backstage_runtime_identity_directory || return 79
  verify_backstage_runtime_identity_file_security || return 79
  identity_before="$(stat -c '%d:%i:%s:%y:%z' -- "$BACKSTAGE_RUNTIME_IDENTITY_FILE" 2>/dev/null || true)"
  BACKSTAGE_RUNTIME_IDENTITY_JSON="$(<"$BACKSTAGE_RUNTIME_IDENTITY_FILE")" || {
    backstage_rollback_fail "runtime identity cannot be read"
    return 79
  }
  identity_after="$(stat -c '%d:%i:%s:%y:%z' -- "$BACKSTAGE_RUNTIME_IDENTITY_FILE" 2>/dev/null || true)"
  [[ -n "$identity_before" && "$identity_before" == "$identity_after" ]] || {
    backstage_rollback_fail "runtime identity changed while being read"
    return 79
  }
  if ! jq -e '
      def legacy_runtime_dependency_keys:
        ["ConfigMap/resonance-internal-ca","Secret/resonance-backstage-auth",
         "Secret/resonance-backstage-database","Secret/resonance-ops-bridge",
         "Secret/resonance-runtime-purge-recovery"];
      def current_runtime_dependency_keys:
        ["ConfigMap/resonance-internal-ca","Ingress/backstage","Ingress/preview",
         "Secret/carbonet-prod/resonance-ops-bridge","Secret/carbonet-prod/resonance-preview-tls",
         "Secret/resonance-backstage-auth",
         "Secret/resonance-backstage-database","Secret/resonance-backstage-tls",
         "Secret/resonance-ops-bridge","Secret/resonance-runtime-purge-recovery",
         "Service/ingress-nginx-controller"];
      def runtime_dependency:
        type == "object" and
        (keys | sort) == ["contentSha256","kind","name","uid"] and
        (.kind == "Secret" or .kind == "ConfigMap" or .kind == "Service" or .kind == "Ingress") and
        (.name | type == "string" and length > 0 and length <= 253) and
        (.uid | type == "string" and length > 0 and length <= 253) and
        (.contentSha256 | type == "string" and test("^[0-9a-f]{64}$"));
      type == "object" and
      (if .schemaVersion == 1 then
         (keys | sort) == ["attemptId","candidateImage","candidateSpecSha256","deploymentClosureSha256","deploymentUid","integritySha256","liveResourceClosureSha256","runtimeFingerprint","schemaVersion","targetCommit"]
       elif .schemaVersion == 2 then
         (keys | sort) == ["attemptId","candidateImage","candidateSpecSha256","deploymentClosureSha256","deploymentUid","integritySha256","liveResourceClosureSha256","runtimeDependencies","runtimeDependencyClosureSha256","runtimeFingerprint","schemaVersion","targetCommit"] and
         (.runtimeDependencies | type == "object" and (keys | sort) == legacy_runtime_dependency_keys and all(.[]; runtime_dependency)) and
         (.runtimeDependencyClosureSha256 | type == "string" and test("^[0-9a-f]{64}$"))
       elif .schemaVersion == 3 then
         (keys | sort) == ["attemptId","candidateImage","candidateSpecSha256","deploymentClosureSha256","deploymentUid","integritySha256","liveResourceClosureSha256","runtimeDependencies","runtimeDependencyClosureSha256","runtimeFingerprint","schemaVersion","targetCommit"] and
         (.runtimeDependencies | type == "object" and (keys | sort) == current_runtime_dependency_keys and all(.[]; runtime_dependency)) and
         (.runtimeDependencyClosureSha256 | type == "string" and test("^[0-9a-f]{64}$"))
       else false end) and
      (.targetCommit | type == "string" and test("^[0-9a-f]{40}$")) and
      (.attemptId | type == "string" and test("^[0-9a-f]{32}$")) and
      (.runtimeFingerprint | type == "string" and test("^[0-9a-f]{64}$")) and
      (.deploymentClosureSha256 | type == "string" and test("^[0-9a-f]{64}$")) and
      (.liveResourceClosureSha256 | type == "string" and test("^[0-9a-f]{64}$")) and
      (.deploymentUid | type == "string" and length > 0 and length <= 253) and
      (.candidateImage | type == "string" and length > 0 and length <= 1024 and (test("[[:space:]]") | not)) and
      (.candidateSpecSha256 | type == "string" and test("^[0-9a-f]{64}$")) and
      (.integritySha256 | type == "string" and test("^[0-9a-f]{64}$"))
    ' <<<"$BACKSTAGE_RUNTIME_IDENTITY_JSON" >/dev/null; then
    backstage_rollback_fail "runtime identity schema is invalid"
    return 79
  fi
  identity_payload="$(jq -cS 'del(.integritySha256)' <<<"$BACKSTAGE_RUNTIME_IDENTITY_JSON")" || return 79
  expected_integrity="$(jq -r '.integritySha256' <<<"$BACKSTAGE_RUNTIME_IDENTITY_JSON")" || return 79
  actual_integrity="$(printf '%s' "$identity_payload" | sha256sum | awk '{print $1}')" || return 79
  [[ "$actual_integrity" == "$expected_integrity" ]] || {
    backstage_rollback_fail "runtime identity integrity check failed"
    return 79
  }
  BACKSTAGE_RUNTIME_IDENTITY_FILE_SHA256="$(sha256sum -- "$BACKSTAGE_RUNTIME_IDENTITY_FILE" | awk '{print $1}')" || return 79
  BACKSTAGE_RUNTIME_IDENTITY_SCHEMA_VERSION="$(jq -r '.schemaVersion' <<<"$BACKSTAGE_RUNTIME_IDENTITY_JSON")" || return 79
  BACKSTAGE_RUNTIME_IDENTITY_TARGET_COMMIT="$(jq -r '.targetCommit' <<<"$BACKSTAGE_RUNTIME_IDENTITY_JSON")" || return 79
  BACKSTAGE_RUNTIME_IDENTITY_ATTEMPT_ID="$(jq -r '.attemptId' <<<"$BACKSTAGE_RUNTIME_IDENTITY_JSON")" || return 79
  BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_FINGERPRINT="$(jq -r '.runtimeFingerprint' <<<"$BACKSTAGE_RUNTIME_IDENTITY_JSON")" || return 79
  BACKSTAGE_RUNTIME_IDENTITY_DEPLOYMENT_CLOSURE_SHA256="$(jq -r '.deploymentClosureSha256' <<<"$BACKSTAGE_RUNTIME_IDENTITY_JSON")" || return 79
  BACKSTAGE_RUNTIME_IDENTITY_LIVE_RESOURCE_CLOSURE_SHA256="$(jq -r '.liveResourceClosureSha256' <<<"$BACKSTAGE_RUNTIME_IDENTITY_JSON")" || return 79
  BACKSTAGE_RUNTIME_IDENTITY_DEPLOYMENT_UID="$(jq -r '.deploymentUid' <<<"$BACKSTAGE_RUNTIME_IDENTITY_JSON")" || return 79
  BACKSTAGE_RUNTIME_IDENTITY_CANDIDATE_IMAGE="$(jq -r '.candidateImage' <<<"$BACKSTAGE_RUNTIME_IDENTITY_JSON")" || return 79
  if [[ "$BACKSTAGE_RUNTIME_IDENTITY_SCHEMA_VERSION" == 3 ]] &&
     ! is_digest_pinned_backstage_candidate_image "$BACKSTAGE_RUNTIME_IDENTITY_CANDIDATE_IMAGE"; then
    backstage_rollback_fail "v3 runtime identity candidate image is not digest-pinned"
    return 79
  fi
  BACKSTAGE_RUNTIME_IDENTITY_CANDIDATE_SPEC_SHA256="$(jq -r '.candidateSpecSha256' <<<"$BACKSTAGE_RUNTIME_IDENTITY_JSON")" || return 79
  if [[ "$BACKSTAGE_RUNTIME_IDENTITY_SCHEMA_VERSION" == 2 ||
        "$BACKSTAGE_RUNTIME_IDENTITY_SCHEMA_VERSION" == 3 ]]; then
    BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_DEPENDENCIES="$(jq -cS '.runtimeDependencies' <<<"$BACKSTAGE_RUNTIME_IDENTITY_JSON")" || return 79
    BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_DEPENDENCY_CLOSURE_SHA256="$(jq -r '.runtimeDependencyClosureSha256' <<<"$BACKSTAGE_RUNTIME_IDENTITY_JSON")" || return 79
    runtime_dependency_closure_sha256="$(calculate_backstage_runtime_dependency_closure_sha256 \
      "$BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_DEPENDENCIES")" || return 79
    [[ "$runtime_dependency_closure_sha256" == \
       "$BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_DEPENDENCY_CLOSURE_SHA256" ]] || {
      backstage_rollback_fail "runtime identity dependency closure hash is invalid"
      return 79
    }
  else
    BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_DEPENDENCIES=""
    BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_DEPENDENCY_CLOSURE_SHA256=""
  fi
}

atomically_publish_backstage_runtime_identity_json() {
  local identity_json="$1" identity_dir identity_tmp=""
  prepare_backstage_runtime_identity_directory || return 79
  jq -e 'type == "object" and (.integritySha256 | type == "string" and test("^[0-9a-f]{64}$"))' \
    <<<"$identity_json" >/dev/null || {
      backstage_rollback_fail "runtime identity publication payload is invalid"
      return 79
    }
  identity_dir="$(dirname -- "$BACKSTAGE_RUNTIME_IDENTITY_FILE")"
  identity_tmp="$(umask 077 && mktemp "$identity_dir/.runtime-success.identity.XXXXXXXX")" || {
    backstage_rollback_fail "runtime identity temporary file creation failed"
    return 79
  }
  if ! printf '%s\n' "$identity_json" >"$identity_tmp" ||
     ! chmod 0600 -- "$identity_tmp" ||
     [[ "$(stat -c '%a:%u:%h' -- "$identity_tmp" 2>/dev/null || true)" != "600:$(id -u):1" ]] ||
     ! sync -f "$identity_tmp"; then
    rm -f -- "$identity_tmp"
    backstage_rollback_fail "runtime identity atomic publication failed"
    return 79
  fi
  if ! mv -T -- "$identity_tmp" "$BACKSTAGE_RUNTIME_IDENTITY_FILE"; then
    rm -f -- "$identity_tmp"
    backstage_rollback_fail "runtime identity atomic publication failed"
    return 79
  fi
  # Rename is the authority cut. A later fsync/reread failure must retain the
  # live Deployment and pending state instead of rolling back under this file.
  BACKSTAGE_RUNTIME_IDENTITY_PUBLISHED=true
  sync -f "$identity_dir" || {
    backstage_rollback_fail "runtime identity directory sync failed; rollback forbidden"
    return 79
  }
}

publish_backstage_runtime_identity() {
  local exact_target="$1" identity_payload identity_json integrity
  [[ "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 &&
     "$BACKSTAGE_PENDING_PHASE" == "CANDIDATE_READY" &&
     "$BACKSTAGE_PENDING_TARGET_COMMIT" == "$exact_target" &&
     "$BACKSTAGE_PROVED_TARGET_COMMIT" == "$exact_target" &&
     "$BACKSTAGE_PROVED_ATTEMPT_ID" == "$BACKSTAGE_PENDING_ATTEMPT_ID" &&
     "$BACKSTAGE_PROVED_RUNTIME_FINGERPRINT" == "$BACKSTAGE_PENDING_RUNTIME_FINGERPRINT" &&
     "$BACKSTAGE_PROVED_DEPLOYMENT_CLOSURE_SHA256" == "$BACKSTAGE_PENDING_DEPLOYMENT_CLOSURE_SHA256" &&
     "$BACKSTAGE_PROVED_LIVE_RESOURCE_CLOSURE_SHA256" == "$BACKSTAGE_CANDIDATE_LIVE_RESOURCE_CLOSURE_SHA256" &&
     "$BACKSTAGE_PROVED_RUNTIME_DEPENDENCY_CLOSURE_SHA256" == "$BACKSTAGE_PENDING_RUNTIME_DEPENDENCY_CLOSURE_SHA256" &&
     "$BACKSTAGE_PROVED_DEPLOYMENT_UID" == "$BACKSTAGE_BASELINE_UID" &&
     "$BACKSTAGE_PROVED_CANDIDATE_IMAGE" == "$BACKSTAGE_CANDIDATE_IMAGE" &&
     "$BACKSTAGE_PROVED_CANDIDATE_SPEC_SHA256" == "$BACKSTAGE_CANDIDATE_SPEC_SHA256" ]] || {
    backstage_rollback_fail "runtime identity requires an exact proved v4 pending candidate"
    return 79
  }
  prepare_backstage_runtime_identity_directory || return 79
  if backstage_runtime_identity_exists; then
    load_backstage_runtime_identity || return 79
  fi
  identity_payload="$(jq -cnS \
    --arg targetCommit "$BACKSTAGE_PROVED_TARGET_COMMIT" \
    --arg attemptId "$BACKSTAGE_PROVED_ATTEMPT_ID" \
    --arg runtimeFingerprint "$BACKSTAGE_PROVED_RUNTIME_FINGERPRINT" \
    --arg deploymentClosureSha256 "$BACKSTAGE_PROVED_DEPLOYMENT_CLOSURE_SHA256" \
    --arg liveResourceClosureSha256 "$BACKSTAGE_PROVED_LIVE_RESOURCE_CLOSURE_SHA256" \
    --arg deploymentUid "$BACKSTAGE_PROVED_DEPLOYMENT_UID" \
    --arg candidateImage "$BACKSTAGE_PROVED_CANDIDATE_IMAGE" \
    --arg candidateSpecSha256 "$BACKSTAGE_PROVED_CANDIDATE_SPEC_SHA256" \
    --argjson runtimeDependencies "$BACKSTAGE_PENDING_RUNTIME_DEPENDENCIES" \
    --arg runtimeDependencyClosureSha256 "$BACKSTAGE_PROVED_RUNTIME_DEPENDENCY_CLOSURE_SHA256" '
      {
        schemaVersion: 3,
        targetCommit: $targetCommit,
        attemptId: $attemptId,
        runtimeFingerprint: $runtimeFingerprint,
        deploymentClosureSha256: $deploymentClosureSha256,
        liveResourceClosureSha256: $liveResourceClosureSha256,
        runtimeDependencies: $runtimeDependencies,
        runtimeDependencyClosureSha256: $runtimeDependencyClosureSha256,
        deploymentUid: $deploymentUid,
        candidateImage: $candidateImage,
        candidateSpecSha256: $candidateSpecSha256
      }
    ')" || return 79
  integrity="$(printf '%s' "$identity_payload" | sha256sum | awk '{print $1}')" || return 79
  identity_json="$(jq -cS --arg integrity "$integrity" '. + {integritySha256:$integrity}' <<<"$identity_payload")" || return 79
  atomically_publish_backstage_runtime_identity_json "$identity_json" || return 79
  load_backstage_runtime_identity || return 79
  [[ "$BACKSTAGE_RUNTIME_IDENTITY_TARGET_COMMIT" == "$BACKSTAGE_PROVED_TARGET_COMMIT" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_ATTEMPT_ID" == "$BACKSTAGE_PROVED_ATTEMPT_ID" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_FINGERPRINT" == "$BACKSTAGE_PROVED_RUNTIME_FINGERPRINT" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_DEPLOYMENT_CLOSURE_SHA256" == "$BACKSTAGE_PROVED_DEPLOYMENT_CLOSURE_SHA256" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_LIVE_RESOURCE_CLOSURE_SHA256" == "$BACKSTAGE_PROVED_LIVE_RESOURCE_CLOSURE_SHA256" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_DEPENDENCY_CLOSURE_SHA256" == "$BACKSTAGE_PROVED_RUNTIME_DEPENDENCY_CLOSURE_SHA256" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_DEPENDENCIES" == "$BACKSTAGE_PENDING_RUNTIME_DEPENDENCIES" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_DEPLOYMENT_UID" == "$BACKSTAGE_PROVED_DEPLOYMENT_UID" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_CANDIDATE_IMAGE" == "$BACKSTAGE_PROVED_CANDIDATE_IMAGE" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_CANDIDATE_SPEC_SHA256" == "$BACKSTAGE_PROVED_CANDIDATE_SPEC_SHA256" ]] || {
    backstage_rollback_fail "runtime identity exact reread verification failed; rollback forbidden"
    return 79
  }
  echo "[backstage] exact runtime identity published target=$exact_target specSha256=$BACKSTAGE_RUNTIME_IDENTITY_CANDIDATE_SPEC_SHA256"
}

capture_backstage_deployment_baseline() {
  local deployment_json state_payload baseline_spec baseline_spec_sha256 attempt_id baseline_image
  local baseline_rollback_spec baseline_rollback_spec_sha256
  local baseline_tag_proof=null
  local baseline_resources candidate_resources raw_resource_intents resource_intents runtime_dependencies
  prepare_backstage_rollback_state_directory || return 1
  reject_active_backstage_parent_authority_binding || return 79
  if backstage_pending_state_exists; then
    backstage_rollback_fail "pending state already exists"
    return 1
  fi
  if backstage_repair_authority_exists; then
    backstage_rollback_fail "orphan repair authority requires reconciliation before new mutation"
    return 1
  fi
  is_exact_backstage_commit "$BACKSTAGE_DEPLOYMENT_TARGET_COMMIT" || {
    backstage_rollback_fail "deployment target commit is invalid"
    return 1
  }
  is_valid_backstage_authority_kind "$BACKSTAGE_DEPLOYMENT_AUTHORITY_KIND" || {
    backstage_rollback_fail "deployment authority kind is invalid"
    return 1
  }
  is_digest_pinned_backstage_candidate_image "$BACKSTAGE_DEPLOYMENT_CANDIDATE_IMAGE" || {
    backstage_rollback_fail "deployment candidate image is not digest-pinned"
    return 1
  }
  is_valid_backstage_runtime_fingerprint "$BACKSTAGE_DEPLOYMENT_RUNTIME_FINGERPRINT" || {
    backstage_rollback_fail "deployment runtime fingerprint is invalid"
    return 1
  }
  [[ "$BACKSTAGE_DEPLOYMENT_CLOSURE_SHA256" =~ ^[0-9a-f]{64}$ ]] || {
    backstage_rollback_fail "deployment closure SHA-256 is invalid"
    return 1
  }
  reprove_backstage_live_baseline_image_resolution_before_capture || return 79
  raw_resource_intents="$(build_target_backstage_managed_resource_payloads "$BACKSTAGE_DEPLOYMENT_TARGET_COMMIT")" || {
    backstage_rollback_fail "target managed resource intents cannot be rendered"
    return 1
  }
  resource_intents="$(bind_backstage_managed_resource_intent_hashes "$raw_resource_intents")" || return 1
  baseline_resources="$(capture_all_backstage_managed_resource_snapshots)" || return 1
  candidate_resources="$(jq -cS 'with_entries(.value = null)' <<<"$baseline_resources")" || return 1
  runtime_dependencies="$(capture_all_backstage_runtime_dependencies)" || return 79
  deployment_json="$(kubectl -n "$NAMESPACE" get deployment "$BACKSTAGE_DEPLOYMENT_NAME" -o json)" || {
    backstage_rollback_fail "baseline Deployment lookup failed"
    return 1
  }
  if ! jq -e \
      --arg namespace "$NAMESPACE" \
      --arg deployment "$BACKSTAGE_DEPLOYMENT_NAME" '
        .apiVersion == "apps/v1" and
        .kind == "Deployment" and
        .metadata.namespace == $namespace and
        .metadata.name == $deployment and
        (.metadata.uid | type == "string" and length > 0) and
        (.metadata.resourceVersion | type == "string" and length > 0) and
        (.spec | type == "object")
      ' <<<"$deployment_json" >/dev/null; then
    backstage_rollback_fail "baseline Deployment identity or spec is invalid"
    return 1
  fi
  baseline_spec="$(jq -cS '.spec' <<<"$deployment_json")" || return 1
  baseline_spec_sha256="$(printf '%s' "$baseline_spec" | sha256sum | awk '{print $1}')" || return 1
  baseline_rollback_spec="$baseline_spec"
  [[ "$BACKSTAGE_BASELINE_TAG_RESOLUTION_PROVED" == true ||
     "$BACKSTAGE_BASELINE_TAG_RESOLUTION_PROVED" == false ]] || return 1
  if [[ -n "$BACKSTAGE_PREBUILD_BASELINE_UID" ]]; then
    [[ "$(jq -r '.metadata.uid' <<<"$deployment_json")" == "$BACKSTAGE_PREBUILD_BASELINE_UID" &&
       "$baseline_spec_sha256" == "$BACKSTAGE_PREBUILD_BASELINE_SPEC_SHA256" ]] || {
      backstage_rollback_fail "live Deployment changed after prebuild image proof; mutation=0"
      return 1
    }
  fi
  if [[ "$BACKSTAGE_BASELINE_TAG_RESOLUTION_PROVED" == true ]]; then
    validate_backstage_candidate_image "$BACKSTAGE_PREBUILD_BASELINE_IMAGE" || return 1
    is_digest_pinned_backstage_candidate_image "$BACKSTAGE_BASELINE_TAG_RESOLVED_IMAGE" || return 1
    baseline_image="$(jq -er '[.template.spec.containers[]? | select(.name=="backstage") | .image] |
      if length == 1 then .[0] else error("one backstage image required") end' \
      <<<"$baseline_spec")" || return 1
    [[ "$baseline_image" == "$BACKSTAGE_PREBUILD_BASELINE_IMAGE" ]] || {
      backstage_rollback_fail "baseline tag resolution proof does not match exact baseline spec"
      return 1
    }
    baseline_rollback_spec="$(jq -cS --arg image "$BACKSTAGE_BASELINE_TAG_RESOLVED_IMAGE" '
      (.template.spec.containers[] | select(.name=="backstage")).image=$image
    ' <<<"$baseline_spec")" || return 1
    baseline_tag_proof="$(jq -cnS \
      --arg tag "$BACKSTAGE_PREBUILD_BASELINE_IMAGE" \
      --arg digestImage "$BACKSTAGE_BASELINE_TAG_RESOLVED_IMAGE" \
      --arg holdTag "$BACKSTAGE_BASELINE_ROLLBACK_HOLD_TAG" \
      --arg deploymentUid "$(jq -r '.metadata.uid' <<<"$deployment_json")" \
      '{tag:$tag,digestImage:$digestImage,holdTag:$holdTag,deploymentUid:$deploymentUid}')" || return 1
  elif [[ -n "$BACKSTAGE_PREBUILD_BASELINE_IMAGE" ]] &&
       ! is_digest_pinned_backstage_candidate_image "$BACKSTAGE_PREBUILD_BASELINE_IMAGE"; then
    backstage_rollback_fail "mutable baseline image lacks exact digest rollback proof; mutation=0"
    return 1
  fi
  baseline_rollback_spec_sha256="$(printf '%s' "$baseline_rollback_spec" | sha256sum | awk '{print $1}')" || return 1
  attempt_id="$BACKSTAGE_DEPLOYMENT_ATTEMPT_ID"
  if [[ -z "$attempt_id" ]]; then
    [[ "$BACKSTAGE_DEPLOYMENT_FINALIZE_MODE" == immediate ]] || {
      backstage_rollback_fail "deferred deployment requires a parent-supplied attempt ID; mutation=0"
      return 1
    }
    attempt_id="$(openssl rand -hex 16)" || {
      backstage_rollback_fail "deployment attempt ID generation failed"
      return 1
    }
    BACKSTAGE_DEPLOYMENT_ATTEMPT_ID="$attempt_id"
  fi
  is_valid_backstage_attempt_id "$attempt_id" || {
    backstage_rollback_fail "deployment attempt ID is invalid"
    return 1
  }
  state_payload="$(jq -cS \
    --arg namespace "$NAMESPACE" \
    --arg deployment "$BACKSTAGE_DEPLOYMENT_NAME" \
    --arg targetCommit "$BACKSTAGE_DEPLOYMENT_TARGET_COMMIT" \
    --arg authorityKind "$BACKSTAGE_DEPLOYMENT_AUTHORITY_KIND" \
    --arg finalizeMode "$BACKSTAGE_DEPLOYMENT_FINALIZE_MODE" \
    --arg coordinator "$([[ "$BACKSTAGE_DEPLOYMENT_FINALIZE_MODE" == deferred ]] && printf auto || printf standalone)" \
    --arg attemptId "$attempt_id" \
    --arg runtimeFingerprint "$BACKSTAGE_DEPLOYMENT_RUNTIME_FINGERPRINT" \
    --arg deploymentClosureSha256 "$BACKSTAGE_DEPLOYMENT_CLOSURE_SHA256" \
    --arg candidateImage "$BACKSTAGE_DEPLOYMENT_CANDIDATE_IMAGE" \
    --argjson baselineTagProof "$baseline_tag_proof" \
    --arg baselineSpecSha256 "$baseline_spec_sha256" \
    --argjson baselineRollbackSpec "$baseline_rollback_spec" \
    --arg baselineRollbackSpecSha256 "$baseline_rollback_spec_sha256" \
    --argjson baselineResources "$baseline_resources" \
    --argjson candidateResources "$candidate_resources" \
    --argjson resourceIntents "$resource_intents" \
    --argjson runtimeDependencies "$runtime_dependencies" '
      {
        schemaVersion: 4,
        kind: "BackstageDeploymentRollbackPending",
        namespace: $namespace,
        deploymentName: $deployment,
        targetCommit: $targetCommit,
        authorityKind: $authorityKind,
        finalizeMode: $finalizeMode,
        coordinator: $coordinator,
        attemptId: $attemptId,
        runtimeFingerprint: $runtimeFingerprint,
        deploymentClosureSha256: $deploymentClosureSha256,
        resourceIntents: $resourceIntents,
        runtimeDependencies: $runtimeDependencies,
        phase: "BASELINE_CAPTURED",
        baseline: {
          uid: .metadata.uid,
          resourceVersion: .metadata.resourceVersion,
          spec: .spec,
          specSha256: $baselineSpecSha256,
          rollbackSpec: $baselineRollbackSpec,
          rollbackSpecSha256: $baselineRollbackSpecSha256,
          resources: $baselineResources
        },
        plannedDeployment: {
          spec: null,
          specSha256: null
        },
        candidate: {
          image: $candidateImage,
          baselineTagProof: $baselineTagProof,
          spec: null,
          specSha256: null,
          resources: $candidateResources,
          liveResourceClosureSha256: null,
          runtimeDependencyClosureSha256: null
        }
      }
    ' <<<"$deployment_json")" || return 1
  publish_backstage_pending_state_payload "$state_payload" || return 1
  load_backstage_pending_state || return 1
  BACKSTAGE_DEPLOY_ROLLBACK_ARMED=true
  echo "[backstage] deployment rollback baseline captured uid=$BACKSTAGE_BASELINE_UID target=$BACKSTAGE_PENDING_TARGET_COMMIT attempt=$BACKSTAGE_PENDING_ATTEMPT_ID authority=$BACKSTAGE_PENDING_AUTHORITY_KIND"
}

arm_backstage_deployment_mutations() {
  local state_payload expected_attempt expected_runtime_fingerprint expected_deployment_closure
  load_backstage_pending_state || return 1
  [[ "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 &&
     "$BACKSTAGE_PENDING_PHASE" == "BASELINE_CAPTURED" ]] || {
    backstage_rollback_fail "Deployment mutation arm requires v4 BASELINE_CAPTURED state"
    return 1
  }
  expected_attempt="$BACKSTAGE_PENDING_ATTEMPT_ID"
  expected_runtime_fingerprint="$BACKSTAGE_PENDING_RUNTIME_FINGERPRINT"
  expected_deployment_closure="$BACKSTAGE_PENDING_DEPLOYMENT_CLOSURE_SHA256"
  state_payload="$(jq -cS '
      del(.integritySha256) |
      .phase = "MUTATION_ARMED"
    ' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
  publish_backstage_pending_state_payload "$state_payload" || return 1
  load_backstage_pending_state || return 1
  [[ "$BACKSTAGE_PENDING_ATTEMPT_ID" == "$expected_attempt" &&
     "$BACKSTAGE_PENDING_RUNTIME_FINGERPRINT" == "$expected_runtime_fingerprint" &&
     "$BACKSTAGE_PENDING_DEPLOYMENT_CLOSURE_SHA256" == "$expected_deployment_closure" ]] || {
    backstage_rollback_fail "deployment attempt identity changed during mutation arm"
    return 1
  }
  BACKSTAGE_DEPLOY_ROLLBACK_ARMED=true
  echo "[backstage] Deployment mutations armed target=$BACKSTAGE_PENDING_TARGET_COMMIT"
}

checkpoint_backstage_managed_resource_candidate() {
  local kind="$1" name="$2"
  local key="$kind/$name" snapshot expected expected_payload snapshot_payload state_payload
  local expected_attempt expected_pending_target
  load_backstage_pending_state || return 1
  [[ "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 &&
     "$BACKSTAGE_PENDING_PHASE" == MUTATION_ARMED &&
     "$BACKSTAGE_PENDING_ATTEMPT_ID_PRESENT" == true ]] || return 1
  expected_attempt="$BACKSTAGE_PENDING_ATTEMPT_ID"
  expected_pending_target="$BACKSTAGE_PENDING_TARGET_COMMIT"
  expected="$(build_target_backstage_managed_resource_payloads "$expected_pending_target")" || return 1
  expected_payload="$(jq -cS --arg key "$key" '.[$key].payload' <<<"$expected")" || return 1
  snapshot="$(capture_backstage_managed_resource_snapshot "$kind" "$name")" || return 1
  [[ "$(jq -r '.exists' <<<"$snapshot")" == true ]] || return 1
  snapshot_payload="$(jq -cS '.payload' <<<"$snapshot")" || return 1
  [[ "$snapshot_payload" == "$expected_payload" ]] || {
    backstage_rollback_fail "managed resource does not match exact target before checkpoint key=$key"
    return 1
  }
  state_payload="$(jq -cS --arg key "$key" --argjson snapshot "$snapshot" '
      del(.integritySha256) | .candidate.resources[$key] = $snapshot
    ' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
  publish_backstage_pending_state_payload "$state_payload" || return 1
  load_backstage_pending_state || return 1
  [[ "$BACKSTAGE_PENDING_ATTEMPT_ID" == "$expected_attempt" &&
     "$BACKSTAGE_PENDING_TARGET_COMMIT" == "$expected_pending_target" ]] || return 1
  echo "[backstage] managed resource candidate checkpointed key=$key"
}

apply_exact_target_backstage_resources() {
  local exact_target="$BACKSTAGE_PENDING_TARGET_COMMIT" manifest_json object catalog_payloads catalog_payload
  local descriptor kind name
  manifest_json="$(git -C "$ROOT" show "$exact_target:deploy/k8s/control-plane/backstage.yaml" |
    kubectl create --dry-run=client -f - -o json)" || return 1
  jq -e 'all(.[]; .exists == true)' <<<"$BACKSTAGE_PENDING_RESOURCE_INTENTS" >/dev/null || {
    backstage_rollback_fail "target resource deletion is not transactionally reversible; mutation=0"
    return 79
  }
  catalog_payloads="$(build_target_backstage_managed_resource_payloads "$exact_target")" || return 1
  catalog_payload="$(jq -cS '."ConfigMap/resonance-backstage-catalog".payload.data' <<<"$catalog_payloads")" || return 1
  object="$(jq -cnS --arg namespace "$NAMESPACE" --argjson data "$catalog_payload" '
    {apiVersion:"v1",kind:"ConfigMap",metadata:{name:"resonance-backstage-catalog",namespace:$namespace},data:$data}
  ')" || return 1
  verify_expected_backstage_pending_binding || return 1
  printf '%s' "$object" | kubectl apply -f - >/dev/null || return 1
  checkpoint_backstage_managed_resource_candidate ConfigMap resonance-backstage-catalog || return 1
  for descriptor in \
    'ConfigMap|resonance-backstage-config' \
    'Service|resonance-backstage' \
    'Service|resonance-backstage-catalog' \
    'NetworkPolicy|resonance-backstage-ingress'; do
    IFS='|' read -r kind name <<<"$descriptor"
    object="$(jq -cs --arg kind "$kind" --arg name "$name" --arg namespace "$NAMESPACE" '
      [ .[] | if .kind == "List" then .items[] else . end |
        select(.kind == $kind and .metadata.name == $name and .metadata.namespace == $namespace) ] |
      if length == 1 then .[0] else error("target object cardinality") end
    ' <<<"$manifest_json")" || return 1
    verify_expected_backstage_pending_binding || return 1
    printf '%s' "$object" | kubectl apply -f - >/dev/null || return 1
    checkpoint_backstage_managed_resource_candidate "$kind" "$name" || return 1
  done
}

converge_exact_backstage_deployment_spec() {
  local catalog_digest="$1" rendered_objects manifest_spec auth_args guest_rbac
  local current_json current_uid current_resource_version current_spec current_spec_sha256 patch_json
  local dry_run_json desired_spec desired_spec_sha256 applied_json applied_spec applied_spec_sha256
  local state_payload expected_attempt
  [[ "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 &&
     "$BACKSTAGE_PENDING_PHASE" == "MUTATION_ARMED" &&
     -n "$BACKSTAGE_PLANNED_DEPLOYMENT_SPEC" &&
     -n "$BACKSTAGE_PLANNED_DEPLOYMENT_SPEC_SHA256" ]] || {
    load_backstage_pending_state || return 1
    [[ "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 &&
       "$BACKSTAGE_PENDING_PHASE" == "MUTATION_ARMED" ]] || {
      backstage_rollback_fail "exact desired spec convergence requires MUTATION_ARMED state"
      return 1
    }
  }
  [[ "$catalog_digest" =~ ^[0-9a-f]{64}$ ]] || {
    backstage_rollback_fail "catalog digest is invalid for desired spec convergence"
    return 1
  }
  if [[ "$OIDC_READY" == true ]]; then
    auth_args='["node","packages/backend","--config","app-config.yaml","--config","app-config.production.yaml","--config","app-config.oidc.yaml"]'
    guest_rbac=false
  else
    auth_args='["node","packages/backend","--config","app-config.yaml","--config","app-config.production.yaml"]'
    guest_rbac=true
  fi
  rendered_objects="$(git -C "$ROOT" show \
      "$BACKSTAGE_PENDING_TARGET_COMMIT:deploy/k8s/control-plane/backstage.yaml" |
    kubectl create --dry-run=client -f - -o json)" || {
    backstage_rollback_fail "target Deployment manifest cannot be rendered"
    return 1
  }
  manifest_spec="$(jq -cs \
      --arg namespace "$NAMESPACE" \
      --arg deployment "$BACKSTAGE_DEPLOYMENT_NAME" \
      --arg image "$BACKSTAGE_CANDIDATE_IMAGE" \
      --argjson args "$auth_args" \
      --arg guestRbac "$guest_rbac" \
      --arg catalogDigest "$catalog_digest" '
        [ .[] |
          if .kind == "List" then .items[] else . end |
          select(.apiVersion == "apps/v1" and .kind == "Deployment" and
                 .metadata.namespace == $namespace and .metadata.name == $deployment)
        ] |
        if length != 1 then error("exactly one target Deployment is required") else .[0].spec end |
        if ([.template.spec.containers[] | select(.name == "backstage")] | length) != 1
          then error("exactly one backstage container is required") else . end |
        (.template.spec.containers[] | select(.name == "backstage")).image = $image |
        (.template.spec.containers[] | select(.name == "backstage")).args = $args |
        (.template.spec.containers[] | select(.name == "backstage")).env =
          (((.template.spec.containers[] | select(.name == "backstage")).env // []) |
           map(select(.name != "RESONANCE_ALLOW_GUEST_DESIGN_RBAC")) +
           [{name:"RESONANCE_ALLOW_GUEST_DESIGN_RBAC",value:$guestRbac}]) |
        .template.metadata.annotations = ((.template.metadata.annotations // {}) +
          {"resonance.io/catalog-digest":$catalogDigest})
      ' <<<"$rendered_objects")" || {
    backstage_rollback_fail "target Deployment desired spec is invalid"
    return 1
  }
  current_json="$(kubectl -n "$NAMESPACE" get deployment "$BACKSTAGE_DEPLOYMENT_NAME" -o json)" || {
    backstage_rollback_fail "pre-convergence Deployment lookup failed"
    return 1
  }
  current_uid="$(jq -er '.metadata.uid' <<<"$current_json")" || return 1
  current_resource_version="$(jq -er '.metadata.resourceVersion' <<<"$current_json")" || return 1
  current_spec="$(jq -cS '.spec' <<<"$current_json")" || return 1
  current_spec_sha256="$(printf '%s' "$current_spec" | sha256sum | awk '{print $1}')" || return 1
  [[ "$current_uid" == "$BACKSTAGE_BASELINE_UID" &&
     "$current_spec" == "$BACKSTAGE_BASELINE_SPEC" &&
     "$current_spec_sha256" == "$BACKSTAGE_BASELINE_SPEC_SHA256" ]] || {
    backstage_rollback_fail "Deployment differs from exact baseline before desired spec planning; mutation=0"
    return 1
  }
  patch_json="$(jq -cn \
    --arg uid "$current_uid" \
    --arg resourceVersion "$current_resource_version" \
    --argjson currentSpec "$current_spec" \
    --argjson desiredSpec "$manifest_spec" '
      [
        {op:"test",path:"/metadata/uid",value:$uid},
        {op:"test",path:"/metadata/resourceVersion",value:$resourceVersion},
        {op:"test",path:"/spec",value:$currentSpec},
        {op:"replace",path:"/spec",value:$desiredSpec}
      ]
    ')" || return 1
  verify_expected_backstage_pending_binding || return 1
  dry_run_json="$(printf '%s' "$patch_json" | kubectl -n "$NAMESPACE" patch \
      deployment "$BACKSTAGE_DEPLOYMENT_NAME" --type=json --patch-file=/dev/stdin \
      --dry-run=server -o json)" || {
    backstage_rollback_fail "server-side desired Deployment spec rendering failed; mutation=0"
    return 1
  }
  [[ "$(jq -r '.metadata.uid' <<<"$dry_run_json")" == "$current_uid" ]] || {
    backstage_rollback_fail "server-side desired Deployment UID changed; mutation=0"
    return 1
  }
  desired_spec="$(jq -cS '.spec' <<<"$dry_run_json")" || return 1
  desired_spec_sha256="$(printf '%s' "$desired_spec" | sha256sum | awk '{print $1}')" || return 1
  expected_attempt="$BACKSTAGE_PENDING_ATTEMPT_ID"
  state_payload="$(jq -cS \
      --argjson desiredSpec "$desired_spec" \
      --arg desiredSpecSha256 "$desired_spec_sha256" '
        del(.integritySha256) |
        .plannedDeployment.spec = $desiredSpec |
        .plannedDeployment.specSha256 = $desiredSpecSha256
      ' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
  publish_backstage_pending_state_payload "$state_payload" || return 1
  load_backstage_pending_state || return 1
  [[ "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 &&
     "$BACKSTAGE_PENDING_PHASE" == MUTATION_ARMED &&
     "$BACKSTAGE_PENDING_ATTEMPT_ID" == "$expected_attempt" &&
     "$BACKSTAGE_PLANNED_DEPLOYMENT_SPEC" == "$desired_spec" &&
     "$BACKSTAGE_PLANNED_DEPLOYMENT_SPEC_SHA256" == "$desired_spec_sha256" ]] || {
    backstage_rollback_fail "planned Deployment spec durable checkpoint is invalid; mutation=0"
    return 1
  }
  # Re-read after the durable plan publication. Only an unchanged exact
  # baseline may be replaced, and the following JSON-Patch is this attempt's
  # sole Deployment mutation.
  current_json="$(kubectl -n "$NAMESPACE" get deployment "$BACKSTAGE_DEPLOYMENT_NAME" -o json)" || return 1
  current_uid="$(jq -er '.metadata.uid' <<<"$current_json")" || return 1
  current_resource_version="$(jq -er '.metadata.resourceVersion' <<<"$current_json")" || return 1
  current_spec="$(jq -cS '.spec' <<<"$current_json")" || return 1
  current_spec_sha256="$(printf '%s' "$current_spec" | sha256sum | awk '{print $1}')" || return 1
  [[ "$current_uid" == "$BACKSTAGE_BASELINE_UID" &&
     "$current_spec" == "$BACKSTAGE_BASELINE_SPEC" &&
     "$current_spec_sha256" == "$BACKSTAGE_BASELINE_SPEC_SHA256" ]] || {
    backstage_rollback_fail "Deployment changed after durable plan publication; mutation=0"
    return 1
  }
  patch_json="$(jq -cn \
    --arg uid "$current_uid" \
    --arg resourceVersion "$current_resource_version" \
    --argjson currentSpec "$current_spec" \
    --argjson desiredSpec "$desired_spec" '
      [
        {op:"test",path:"/metadata/uid",value:$uid},
        {op:"test",path:"/metadata/resourceVersion",value:$resourceVersion},
        {op:"test",path:"/spec",value:$currentSpec},
        {op:"replace",path:"/spec",value:$desiredSpec}
      ]
    ')" || return 1
  verify_expected_backstage_pending_binding || return 1
  printf '%s' "$patch_json" | kubectl -n "$NAMESPACE" patch deployment \
    "$BACKSTAGE_DEPLOYMENT_NAME" --type=json --patch-file=/dev/stdin >/dev/null || {
      backstage_rollback_fail "exact desired Deployment spec CAS failed"
      return 1
    }
  applied_json="$(kubectl -n "$NAMESPACE" get deployment "$BACKSTAGE_DEPLOYMENT_NAME" -o json)" || return 1
  [[ "$(jq -r '.metadata.uid' <<<"$applied_json")" == "$current_uid" ]] || {
    backstage_rollback_fail "Deployment UID changed after desired spec convergence"
    return 1
  }
  applied_spec="$(jq -cS '.spec' <<<"$applied_json")" || return 1
  applied_spec_sha256="$(printf '%s' "$applied_spec" | sha256sum | awk '{print $1}')" || return 1
  [[ "$applied_spec" == "$desired_spec" && "$applied_spec_sha256" == "$desired_spec_sha256" ]] || {
    backstage_rollback_fail "live Deployment spec differs from exact target-rendered desired spec"
    return 1
  }
  BACKSTAGE_DESIRED_CANDIDATE_SPEC="$BACKSTAGE_PLANNED_DEPLOYMENT_SPEC"
  BACKSTAGE_DESIRED_CANDIDATE_SPEC_SHA256="$BACKSTAGE_PLANNED_DEPLOYMENT_SPEC_SHA256"
  echo "[backstage] exact target-rendered Deployment spec converged specSha256=$desired_spec_sha256"
}

capture_backstage_deployment_candidate() {
  local deployment_json candidate_spec candidate_spec_sha256 state_payload
  local expected_attempt expected_runtime_fingerprint expected_deployment_closure
  local runtime_dependency_closure_sha256
  load_backstage_pending_state || return 1
  [[ "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 &&
     "$BACKSTAGE_PENDING_PHASE" == "MUTATION_ARMED" ]] || {
    backstage_rollback_fail "candidate capture requires v4 MUTATION_ARMED state"
    return 1
  }
  expected_attempt="$BACKSTAGE_PENDING_ATTEMPT_ID"
  expected_runtime_fingerprint="$BACKSTAGE_PENDING_RUNTIME_FINGERPRINT"
  expected_deployment_closure="$BACKSTAGE_PENDING_DEPLOYMENT_CLOSURE_SHA256"
  verify_backstage_managed_resources_against_target "$BACKSTAGE_PENDING_TARGET_COMMIT" || return 1
  verify_backstage_runtime_dependencies_against_snapshot \
    "$BACKSTAGE_PENDING_RUNTIME_DEPENDENCIES" || return 1
  runtime_dependency_closure_sha256="$BACKSTAGE_PENDING_RUNTIME_DEPENDENCY_CLOSURE_SHA256"
  deployment_json="$(kubectl -n "$NAMESPACE" get deployment "$BACKSTAGE_DEPLOYMENT_NAME" -o json)" || {
    backstage_rollback_fail "candidate Deployment lookup failed"
    return 1
  }
  if ! jq -e \
      --arg namespace "$NAMESPACE" \
      --arg deployment "$BACKSTAGE_DEPLOYMENT_NAME" \
      --arg uid "$BACKSTAGE_BASELINE_UID" \
      --arg image "$BACKSTAGE_CANDIDATE_IMAGE" '
        .apiVersion == "apps/v1" and
        .kind == "Deployment" and
        .metadata.namespace == $namespace and
        .metadata.name == $deployment and
        .metadata.uid == $uid and
        (.metadata.resourceVersion | type == "string" and length > 0) and
        (.spec | type == "object") and
        ([.spec.template.spec.containers[] | select(.name == "backstage") | .image] == [$image])
      ' <<<"$deployment_json" >/dev/null; then
    backstage_rollback_fail "candidate Deployment identity, image, or spec is invalid"
    return 1
  fi
  candidate_spec="$(jq -cS '.spec' <<<"$deployment_json")" || return 1
  candidate_spec_sha256="$(printf '%s' "$candidate_spec" | sha256sum | awk '{print $1}')" || return 1
  if [[ "$candidate_spec" != "$BACKSTAGE_PLANNED_DEPLOYMENT_SPEC" ||
        "$candidate_spec_sha256" != "$BACKSTAGE_PLANNED_DEPLOYMENT_SPEC_SHA256" ]]; then
    backstage_rollback_fail "candidate Deployment is not the exact target-rendered desired spec"
    return 1
  fi
  state_payload="$(jq -cS \
    --argjson candidateSpec "$candidate_spec" \
    --arg candidateSpecSha256 "$candidate_spec_sha256" \
    --argjson candidateResources "$BACKSTAGE_CANDIDATE_MANAGED_RESOURCES" \
    --arg liveResourceClosureSha256 "$BACKSTAGE_CANDIDATE_LIVE_RESOURCE_CLOSURE_SHA256" \
    --arg runtimeDependencyClosureSha256 "$runtime_dependency_closure_sha256" '
      del(.integritySha256) |
      .phase = "CANDIDATE_READY" |
      .candidate.spec = $candidateSpec |
      .candidate.specSha256 = $candidateSpecSha256 |
      .candidate.resources = $candidateResources |
      .candidate.liveResourceClosureSha256 = $liveResourceClosureSha256 |
      .candidate.runtimeDependencyClosureSha256 = $runtimeDependencyClosureSha256
    ' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
  publish_backstage_pending_state_payload "$state_payload" || return 1
  load_backstage_pending_state || return 1
  [[ "$BACKSTAGE_PENDING_ATTEMPT_ID" == "$expected_attempt" &&
     "$BACKSTAGE_PENDING_RUNTIME_FINGERPRINT" == "$expected_runtime_fingerprint" &&
     "$BACKSTAGE_PENDING_DEPLOYMENT_CLOSURE_SHA256" == "$expected_deployment_closure" ]] || {
    backstage_rollback_fail "deployment attempt identity changed during candidate capture"
    return 1
  }
  BACKSTAGE_DEPLOY_ROLLBACK_ARMED=true
  echo "[backstage] candidate Deployment bound target=$BACKSTAGE_PENDING_TARGET_COMMIT image=$BACKSTAGE_CANDIDATE_IMAGE specSha256=$BACKSTAGE_CANDIDATE_SPEC_SHA256"
}

wait_for_backstage_deployment_readiness() {
  local expected_uid="$1" expected_spec="${2:-}" timeout_seconds="${3:-$BACKSTAGE_DEPLOYMENT_ROLLBACK_TIMEOUT_SECONDS}"
  local deadline live_json desired
  [[ "$timeout_seconds" =~ ^[1-9][0-9]{0,3}$ ]] || {
    backstage_rollback_fail "Deployment readiness timeout is invalid"
    return 1
  }
  deadline="$(( $(date +%s) + timeout_seconds ))"
  while (( $(date +%s) <= deadline )); do
    live_json="$(kubectl -n "$NAMESPACE" get deployment "$BACKSTAGE_DEPLOYMENT_NAME" -o json 2>/dev/null || true)"
    if jq -e --arg uid "$expected_uid" '
        .apiVersion == "apps/v1" and
        .kind == "Deployment" and
        .metadata.uid == $uid and
        ((.spec.replicas // 1) as $desired |
          (.status.observedGeneration // -1) >= (.metadata.generation // 0) and
          (.status.updatedReplicas // 0) == $desired and
          (.status.readyReplicas // 0) == $desired and
          (.status.availableReplicas // 0) == $desired and
          (.status.unavailableReplicas // 0) == 0)
      ' <<<"$live_json" >/dev/null 2>&1; then
      if [[ -z "$expected_spec" ]] ||
         jq -e --argjson expectedSpec "$expected_spec" '.spec == $expectedSpec' \
           <<<"$live_json" >/dev/null 2>&1; then
        desired="$(jq -r '.spec.replicas // 1' <<<"$live_json")"
        echo "[backstage] Deployment readiness proved desired=$desired updated=$desired ready=$desired available=$desired unavailable=0"
        return 0
      fi
    fi
    sleep "$BACKSTAGE_DEPLOYMENT_ROLLBACK_POLL_SECONDS"
  done
  backstage_rollback_fail "Deployment readiness proof timed out"
  return 1
}

verify_backstage_public_serving_plane() {
  local timeout_seconds="${1:-$BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS}"
  local expected_backstage="https://${BACKSTAGE_HOST:-backstage.172.16.1.232.nip.io}:32947"
  local expected_preview="https://${RESONANCE_PREVIEW_HOST:-resonance.172.16.1.232.nip.io}:32947"
  local ca_file="${BACKSTAGE_TLS_DIR:-/opt/resonance-data/pki/resonance-internal-ca}/ca.crt"
  [[ "$timeout_seconds" =~ ^[1-4]$ &&
     "${BACKSTAGE_PUBLIC_URL:-$expected_backstage}" == "$expected_backstage" &&
     "${BACKSTAGE_URL:-$expected_backstage}" == "$expected_backstage" &&
     "${RESONANCE_PREVIEW_PUBLIC_URL:-$expected_preview}" == "$expected_preview" ]] || {
    backstage_rollback_fail "public serving URL binding is invalid; expected external NodePort 32947"
    return 79
  }
  curl --cacert "$ca_file" -fsS --max-time "$timeout_seconds" \
    "$expected_backstage/.backstage/health/v1/readiness" >/dev/null || return 79
  curl --cacert "$ca_file" -fsS --max-time "$timeout_seconds" \
    "$expected_backstage/api/resonance-projects/health/project-runtime-purge-recovery" >/dev/null || return 79
  curl --cacert "$ca_file" -fsS --max-time "$timeout_seconds" \
    "$expected_preview/signin/loginView" >/dev/null || return 79
}

verify_backstage_runtime_identity_against_live() {
  local exact_target="$1" require_marker="${2:-false}"
  local allow_legacy_identity="${3:-false}"
  local expected_fingerprint expected_closure marker_status resource_status dependency_status pod_status
  local current_json current_spec current_spec_sha256 current_uid
  is_exact_backstage_commit "$exact_target" || {
    backstage_rollback_fail "runtime identity verification target is invalid"
    return 79
  }
  if ! backstage_runtime_identity_exists; then
    echo "[backstage] runtime identity drift: durable identity is absent target=$exact_target" >&2
    return 1
  fi
  load_backstage_runtime_identity || return 79
  [[ "$allow_legacy_identity" == true || "$allow_legacy_identity" == false ]] || return 79
  if [[ "$BACKSTAGE_RUNTIME_IDENTITY_SCHEMA_VERSION" != 3 ]]; then
    if [[ "$allow_legacy_identity" != true ||
          "$BACKSTAGE_RUNTIME_IDENTITY_SCHEMA_VERSION" != 2 ]]; then
      echo '[backstage] runtime identity drift: runtime dependency proof is absent' >&2
      return 1
    fi
  fi
  expected_fingerprint="$(calculate_target_backstage_runtime_fingerprint "$exact_target")" || {
    backstage_rollback_fail "target runtime fingerprint is unavailable"
    return 79
  }
  is_valid_backstage_runtime_fingerprint "$expected_fingerprint" || {
    backstage_rollback_fail "target runtime fingerprint is invalid"
    return 79
  }
  if [[ "$BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_FINGERPRINT" != "$expected_fingerprint" ]]; then
    echo "[backstage] runtime identity drift: runtime fingerprint mismatch target=$exact_target" >&2
    return 1
  fi
  expected_closure="$(calculate_target_backstage_deployment_closure \
    "$exact_target" "$expected_fingerprint")" || {
    backstage_rollback_fail "target Backstage deployment closure is unavailable"
    return 79
  }
  if [[ "$BACKSTAGE_RUNTIME_IDENTITY_DEPLOYMENT_CLOSURE_SHA256" != "$expected_closure" ]]; then
    echo "[backstage] runtime identity drift: deployment closure mismatch target=$exact_target" >&2
    return 1
  fi
  [[ "$require_marker" == true || "$require_marker" == false ]] || return 79
  if [[ "$require_marker" == true ]]; then
    verify_backstage_deploy_marker_closure "$expected_closure" || {
      marker_status="$?"
      [[ "$marker_status" == 1 ]] && return 1
      return 79
    }
  fi
  verify_backstage_managed_resources_against_target "$exact_target" || {
    resource_status="$?"
    [[ "$resource_status" == 1 ]] && return 1
    return 79
  }
  if [[ "$BACKSTAGE_CANDIDATE_LIVE_RESOURCE_CLOSURE_SHA256" != \
        "$BACKSTAGE_RUNTIME_IDENTITY_LIVE_RESOURCE_CLOSURE_SHA256" ]]; then
    echo "[backstage] managed resource drift: live resource closure mismatch" >&2
    return 1
  fi
  verify_backstage_runtime_dependencies_against_snapshot \
    "$BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_DEPENDENCIES" || {
      dependency_status="$?"
      [[ "$dependency_status" == 1 ]] && return 1
      return 79
    }
  if [[ "$BACKSTAGE_PENDING_RUNTIME_DEPENDENCY_CLOSURE_SHA256" != \
        "$BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_DEPENDENCY_CLOSURE_SHA256" ]]; then
    echo '[backstage] runtime dependency drift: closure mismatch' >&2
    return 1
  fi
  current_json="$(kubectl -n "$NAMESPACE" get deployment "$BACKSTAGE_DEPLOYMENT_NAME" -o json)" || {
    backstage_rollback_fail "runtime identity live Deployment is unavailable"
    return 79
  }
  if ! jq -e \
      --arg namespace "$NAMESPACE" \
      --arg deployment "$BACKSTAGE_DEPLOYMENT_NAME" '
        .apiVersion == "apps/v1" and
        .kind == "Deployment" and
        .metadata.namespace == $namespace and
        .metadata.name == $deployment and
        (.metadata.uid | type == "string" and length > 0) and
        (.spec | type == "object")
      ' <<<"$current_json" >/dev/null; then
    backstage_rollback_fail "runtime identity live Deployment schema is unsafe"
    return 79
  fi
  current_uid="$(jq -r '.metadata.uid' <<<"$current_json")" || return 79
  current_spec="$(jq -cS '.spec' <<<"$current_json")" || return 79
  current_spec_sha256="$(printf '%s' "$current_spec" | sha256sum | awk '{print $1}')" || return 79
  if [[ "$current_uid" != "$BACKSTAGE_RUNTIME_IDENTITY_DEPLOYMENT_UID" ]] ||
     ! jq -e --arg image "$BACKSTAGE_RUNTIME_IDENTITY_CANDIDATE_IMAGE" '
       [.spec.template.spec.containers[] | select(.name == "backstage") | .image] == [$image]
     ' <<<"$current_json" >/dev/null ||
     [[ "$current_spec_sha256" != "$BACKSTAGE_RUNTIME_IDENTITY_CANDIDATE_SPEC_SHA256" ]]; then
    echo "[backstage] runtime identity drift: live UID, image, or full Deployment spec differs" >&2
    return 1
  fi
  [[ "$BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS" =~ ^[1-4]$ ]] || {
    backstage_rollback_fail "runtime identity verify timeout is invalid"
    return 79
  }
  wait_for_backstage_deployment_readiness "$current_uid" "$current_spec" \
    "$BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS" || {
    backstage_rollback_fail "runtime identity live Deployment readiness is unavailable"
    return 79
  }
  if [[ "$BACKSTAGE_RUNTIME_IDENTITY_SCHEMA_VERSION" == 3 ]]; then
    pod_status=0
    wait_for_backstage_ready_pod_image_ids "$current_uid" \
      "$BACKSTAGE_RUNTIME_IDENTITY_CANDIDATE_IMAGE" \
      "$BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS" || pod_status="$?"
    if (( pod_status != 0 )); then
      if (( pod_status == 79 )); then
        backstage_rollback_fail 'runtime identity Ready Pod imageID lookup is unavailable'
        return 79
      fi
      echo '[backstage] runtime identity drift: Ready Pod imageID differs from immutable candidate digest' >&2
      return 1
    fi
  fi
  verify_backstage_public_serving_plane "$BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS" || {
    backstage_rollback_fail "runtime identity public HTTPS serving proof is unavailable"
    return 79
  }
  echo "[backstage] RUNTIME_IDENTITY_EXACT target=$exact_target specSha256=$current_spec_sha256"
}

runtime_identity_matches_loaded_pending_attempt() {
  is_matching_backstage_pending_identity_schema_pair \
    "$BACKSTAGE_PENDING_SCHEMA_VERSION" "$BACKSTAGE_RUNTIME_IDENTITY_SCHEMA_VERSION" || return 1
  [[ "$BACKSTAGE_PENDING_ATTEMPT_ID_PRESENT" == true &&
     "$BACKSTAGE_RUNTIME_IDENTITY_TARGET_COMMIT" == "$BACKSTAGE_PENDING_TARGET_COMMIT" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_ATTEMPT_ID" == "$BACKSTAGE_PENDING_ATTEMPT_ID" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_FINGERPRINT" == "$BACKSTAGE_PENDING_RUNTIME_FINGERPRINT" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_DEPLOYMENT_CLOSURE_SHA256" == "$BACKSTAGE_PENDING_DEPLOYMENT_CLOSURE_SHA256" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_DEPLOYMENT_UID" == "$BACKSTAGE_BASELINE_UID" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_CANDIDATE_IMAGE" == "$BACKSTAGE_CANDIDATE_IMAGE" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_CANDIDATE_SPEC_SHA256" == "$BACKSTAGE_CANDIDATE_SPEC_SHA256" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_LIVE_RESOURCE_CLOSURE_SHA256" == "$BACKSTAGE_CANDIDATE_LIVE_RESOURCE_CLOSURE_SHA256" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_DEPENDENCIES" == "$BACKSTAGE_PENDING_RUNTIME_DEPENDENCIES" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_DEPENDENCY_CLOSURE_SHA256" == "$BACKSTAGE_PENDING_RUNTIME_DEPENDENCY_CLOSURE_SHA256" ]]
}

clear_backstage_pending_state() {
  local state_dir
  load_backstage_pending_state || return 1
  state_dir="$(dirname -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE")"
  rm -f -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" || {
    backstage_rollback_fail "pending state removal failed"
    return 1
  }
  sync -f "$state_dir" || {
    backstage_rollback_fail "pending state directory sync failed"
    return 1
  }
  backstage_pending_state_exists && {
    backstage_rollback_fail "pending state remains after removal"
    return 1
  }
  BACKSTAGE_PENDING_STATE_JSON=""
  BACKSTAGE_PENDING_SCHEMA_VERSION=""
  BACKSTAGE_PENDING_PHASE=""
  BACKSTAGE_PENDING_TARGET_COMMIT=""
  BACKSTAGE_PENDING_AUTHORITY_KIND=""
  BACKSTAGE_PENDING_FINALIZE_MODE=""
  BACKSTAGE_PENDING_COORDINATOR=""
  BACKSTAGE_PENDING_ATTEMPT_ID=""
  BACKSTAGE_PENDING_ATTEMPT_ID_PRESENT=false
  BACKSTAGE_PENDING_FILE_SHA256=""
  BACKSTAGE_PENDING_RUNTIME_FINGERPRINT=""
  BACKSTAGE_PENDING_DEPLOYMENT_CLOSURE_SHA256=""
  BACKSTAGE_PENDING_RESOURCE_INTENTS=""
  BACKSTAGE_PENDING_RUNTIME_DEPENDENCIES=""
  BACKSTAGE_PENDING_RUNTIME_DEPENDENCY_CLOSURE_SHA256=""
  BACKSTAGE_PENDING_BASELINE_TAG_PROOF="null"
  BACKSTAGE_BASELINE_ROLLBACK_HOLD_TAG=""
  BACKSTAGE_BASELINE_UID=""
  BACKSTAGE_BASELINE_RESOURCE_VERSION=""
  BACKSTAGE_BASELINE_SPEC=""
  BACKSTAGE_BASELINE_SPEC_SHA256=""
  BACKSTAGE_BASELINE_ROLLBACK_SPEC=""
  BACKSTAGE_BASELINE_ROLLBACK_SPEC_SHA256=""
  BACKSTAGE_BASELINE_MANAGED_RESOURCES=""
  BACKSTAGE_CANDIDATE_IMAGE=""
  BACKSTAGE_RESOLVED_CANDIDATE_IMAGE=""
  BACKSTAGE_CANDIDATE_SPEC=""
  BACKSTAGE_CANDIDATE_SPEC_SHA256=""
  BACKSTAGE_CANDIDATE_MANAGED_RESOURCES=""
  BACKSTAGE_CANDIDATE_LIVE_RESOURCE_CLOSURE_SHA256=""
  BACKSTAGE_PLANNED_DEPLOYMENT_SPEC=""
  BACKSTAGE_PLANNED_DEPLOYMENT_SPEC_SHA256=""
  BACKSTAGE_DESIRED_CANDIDATE_SPEC=""
  BACKSTAGE_DESIRED_CANDIDATE_SPEC_SHA256=""
  BACKSTAGE_DEPLOY_ROLLBACK_ARMED=false
}

load_backstage_deploy_marker() {
  local marker_dir lexical_dir logical_dir physical_dir marker_before marker_after
  [[ -n "$BACKSTAGE_DEPLOY_STATE_FILE" ]] || {
    backstage_rollback_fail "Backstage deploy marker path is not configured"
    return 1
  }
  marker_dir="$(dirname -- "$BACKSTAGE_DEPLOY_STATE_FILE")"
  [[ -d "$marker_dir" && ! -L "$marker_dir" ]] || {
    backstage_rollback_fail "Backstage deploy marker directory is invalid"
    return 1
  }
  lexical_dir="$(realpath -m -s -- "$marker_dir" 2>/dev/null || true)"
  logical_dir="$(readlink -m -- "$marker_dir" 2>/dev/null || true)"
  physical_dir="$(readlink -f -- "$marker_dir" 2>/dev/null || true)"
  [[ -n "$lexical_dir" && "$lexical_dir" == "$logical_dir" &&
     "$logical_dir" == "$physical_dir" ]] || {
    backstage_rollback_fail "Backstage deploy marker directory contains a symlink"
    return 1
  }
  [[ -f "$BACKSTAGE_DEPLOY_STATE_FILE" && ! -L "$BACKSTAGE_DEPLOY_STATE_FILE" ]] || {
    backstage_rollback_fail "Backstage deploy marker is not a regular non-symlink file"
    return 1
  }
  marker_before="$(stat -c '%d:%i:%a:%u:%h:%s:%y:%z' -- "$BACKSTAGE_DEPLOY_STATE_FILE" 2>/dev/null || true)"
  BACKSTAGE_DEPLOY_MARKER_VALUE="$(<"$BACKSTAGE_DEPLOY_STATE_FILE")" || return 1
  marker_after="$(stat -c '%d:%i:%a:%u:%h:%s:%y:%z' -- "$BACKSTAGE_DEPLOY_STATE_FILE" 2>/dev/null || true)"
  [[ -n "$marker_before" && "$marker_before" == "$marker_after" ]] || {
    backstage_rollback_fail "Backstage deploy marker changed while being read"
    return 1
  }
  [[ "$(stat -c '%a:%u:%h:%s' -- "$BACKSTAGE_DEPLOY_STATE_FILE" 2>/dev/null || true)" == "644:$(id -u):1:41" &&
     "$BACKSTAGE_DEPLOY_MARKER_VALUE" =~ ^[0-9a-f]{40}$ ]] || {
    backstage_rollback_fail "Backstage deploy marker verification failed"
    return 1
  }
}

verify_backstage_deploy_marker() {
  local exact_target="$1"
  [[ -n "$BACKSTAGE_DEPLOY_STATE_FILE" ]] || return 0
  is_exact_backstage_commit "$exact_target" || {
    backstage_rollback_fail "Backstage deploy marker target is invalid"
    return 1
  }
  load_backstage_deploy_marker || return 1
  [[ "$BACKSTAGE_DEPLOY_MARKER_VALUE" == "$exact_target" ]] || {
    backstage_rollback_fail "Backstage deploy marker verification failed"
    return 1
  }
}

verify_backstage_deploy_marker_closure() {
  local expected_closure="$1" marker_fingerprint marker_closure
  [[ "$expected_closure" =~ ^[0-9a-f]{64}$ ]] || return 79
  [[ -n "$BACKSTAGE_DEPLOY_STATE_FILE" ]] || {
    backstage_rollback_fail "Backstage deploy marker path is required for runtime identity proof"
    return 79
  }
  load_backstage_deploy_marker || return 79
  marker_fingerprint="$(calculate_target_backstage_runtime_fingerprint "$BACKSTAGE_DEPLOY_MARKER_VALUE")" || {
    backstage_rollback_fail "Backstage deploy marker runtime fingerprint is unavailable"
    return 79
  }
  marker_closure="$(calculate_target_backstage_deployment_closure \
    "$BACKSTAGE_DEPLOY_MARKER_VALUE" "$marker_fingerprint")" || {
    backstage_rollback_fail "Backstage deploy marker deployment closure is unavailable"
    return 79
  }
  [[ "$marker_closure" == "$expected_closure" ]] || {
    echo "[backstage] runtime identity drift: deploy marker closure mismatch" >&2
    return 1
  }
}

publish_backstage_deploy_marker() {
  local exact_target="$1" marker_dir marker_tmp="" lexical_dir logical_dir physical_dir
  [[ -n "$BACKSTAGE_DEPLOY_STATE_FILE" ]] || return 0
  is_exact_backstage_commit "$exact_target" || {
    backstage_rollback_fail "Backstage deploy marker target is invalid"
    return 1
  }
  marker_dir="$(dirname -- "$BACKSTAGE_DEPLOY_STATE_FILE")"
  [[ -d "$marker_dir" && ! -L "$marker_dir" ]] || {
    backstage_rollback_fail "Backstage deploy marker directory is invalid"
    return 1
  }
  lexical_dir="$(realpath -m -s -- "$marker_dir" 2>/dev/null || true)"
  logical_dir="$(readlink -m -- "$marker_dir" 2>/dev/null || true)"
  physical_dir="$(readlink -f -- "$marker_dir" 2>/dev/null || true)"
  [[ -n "$lexical_dir" && "$lexical_dir" == "$logical_dir" &&
     "$logical_dir" == "$physical_dir" ]] || {
    backstage_rollback_fail "Backstage deploy marker directory contains a symlink"
    return 1
  }
  if [[ -e "$BACKSTAGE_DEPLOY_STATE_FILE" || -L "$BACKSTAGE_DEPLOY_STATE_FILE" ]]; then
    [[ -f "$BACKSTAGE_DEPLOY_STATE_FILE" && ! -L "$BACKSTAGE_DEPLOY_STATE_FILE" ]] || {
      backstage_rollback_fail "Backstage deploy marker is not a regular non-symlink file"
      return 1
    }
  fi
  marker_tmp="$(umask 022 && mktemp "$marker_dir/.backstage-runtime-success.commit.XXXXXXXX")" || {
    backstage_rollback_fail "Backstage deploy marker temporary file creation failed"
    return 1
  }
  if ! printf '%s\n' "$exact_target" >"$marker_tmp" ||
     ! chmod 0644 -- "$marker_tmp" ||
     [[ "$(stat -c '%a:%u:%h' -- "$marker_tmp" 2>/dev/null || true)" != "644:$(id -u):1" ]] ||
     ! sync -f "$marker_tmp"; then
    rm -f -- "$marker_tmp"
    backstage_rollback_fail "Backstage deploy marker atomic publication failed"
    return 1
  fi
  if ! mv -T -- "$marker_tmp" "$BACKSTAGE_DEPLOY_STATE_FILE"; then
    rm -f -- "$marker_tmp"
    backstage_rollback_fail "Backstage deploy marker atomic publication failed"
    return 1
  fi
  # From the instant rename succeeds, the target marker may be externally
  # authoritative. Even a later fsync or verification error must never permit
  # this process to roll the candidate back underneath that marker.
  BACKSTAGE_DEPLOY_MARKER_PUBLISHED=true
  sync -f "$marker_dir" || {
    backstage_rollback_fail "Backstage deploy marker directory sync failed; rollback forbidden"
    return 1
  }
  verify_backstage_deploy_marker "$exact_target" || return 1
  echo "[backstage] exact deploy marker published target=$exact_target"
}

prove_pending_backstage_candidate() {
  local current_json current_spec current_spec_sha256 stored_resource_closure stored_dependency_closure
  BACKSTAGE_PROVED_TARGET_COMMIT=""
  BACKSTAGE_PROVED_ATTEMPT_ID=""
  BACKSTAGE_PROVED_RUNTIME_FINGERPRINT=""
  BACKSTAGE_PROVED_DEPLOYMENT_CLOSURE_SHA256=""
  BACKSTAGE_PROVED_DEPLOYMENT_UID=""
  BACKSTAGE_PROVED_CANDIDATE_IMAGE=""
  BACKSTAGE_PROVED_CANDIDATE_SPEC_SHA256=""
  BACKSTAGE_PROVED_LIVE_RESOURCE_CLOSURE_SHA256=""
  BACKSTAGE_PROVED_RUNTIME_DEPENDENCY_CLOSURE_SHA256=""
  load_backstage_pending_state || return 1
  is_full_resource_backstage_pending_schema "$BACKSTAGE_PENDING_SCHEMA_VERSION" &&
    [[ "$BACKSTAGE_PENDING_PHASE" == "CANDIDATE_READY" ]] || {
    backstage_rollback_fail "pending candidate is not a ready full-resource state"
    return 1
  }
  current_json="$(kubectl -n "$NAMESPACE" get deployment "$BACKSTAGE_DEPLOYMENT_NAME" -o json)" || {
    backstage_rollback_fail "candidate proof Deployment lookup failed"
    return 1
  }
  if ! jq -e \
      --arg namespace "$NAMESPACE" \
      --arg deployment "$BACKSTAGE_DEPLOYMENT_NAME" \
      --arg uid "$BACKSTAGE_BASELINE_UID" \
      --arg image "$BACKSTAGE_CANDIDATE_IMAGE" '
        .apiVersion == "apps/v1" and
        .kind == "Deployment" and
        .metadata.namespace == $namespace and
        .metadata.name == $deployment and
        .metadata.uid == $uid and
        (.metadata.resourceVersion | type == "string" and length > 0) and
        (.spec | type == "object") and
        ([.spec.template.spec.containers[] | select(.name == "backstage") | .image] == [$image])
      ' <<<"$current_json" >/dev/null; then
    backstage_rollback_fail "candidate Deployment UID, image, or identity changed; mutation=0"
    return 1
  fi
  current_spec="$(jq -cS '.spec' <<<"$current_json")" || return 1
  current_spec_sha256="$(printf '%s' "$current_spec" | sha256sum | awk '{print $1}')" || return 1
  [[ "$current_spec_sha256" == "$BACKSTAGE_CANDIDATE_SPEC_SHA256" &&
     "$current_spec" == "$BACKSTAGE_CANDIDATE_SPEC" ]] || {
    backstage_rollback_fail "candidate Deployment spec changed; mutation=0"
    return 1
  }
  stored_resource_closure="$BACKSTAGE_CANDIDATE_LIVE_RESOURCE_CLOSURE_SHA256"
  verify_backstage_managed_resources_against_target "$BACKSTAGE_PENDING_TARGET_COMMIT" || return 1
  [[ "$BACKSTAGE_CANDIDATE_LIVE_RESOURCE_CLOSURE_SHA256" == "$stored_resource_closure" ]] || {
    backstage_rollback_fail "candidate managed resource closure changed; mutation=0"
    return 1
  }
  stored_dependency_closure="$BACKSTAGE_PENDING_RUNTIME_DEPENDENCY_CLOSURE_SHA256"
  verify_backstage_runtime_dependencies_against_snapshot \
    "$BACKSTAGE_PENDING_RUNTIME_DEPENDENCIES" || return 1
  [[ "$BACKSTAGE_PENDING_RUNTIME_DEPENDENCY_CLOSURE_SHA256" == "$stored_dependency_closure" ]] || {
    backstage_rollback_fail "candidate runtime dependency closure changed; mutation=0"
    return 1
  }
  wait_for_backstage_deployment_readiness "$BACKSTAGE_BASELINE_UID" "$BACKSTAGE_CANDIDATE_SPEC" || return 1
  if [[ "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 ]]; then
    wait_for_backstage_ready_pod_image_ids "$BACKSTAGE_BASELINE_UID" \
      "$BACKSTAGE_CANDIDATE_IMAGE" "$BACKSTAGE_DEPLOYMENT_ROLLBACK_TIMEOUT_SECONDS" || return 1
  fi
  verify_backstage_public_serving_plane "$BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS" || {
    backstage_rollback_fail "candidate public HTTPS serving proof failed; mutation=0"
    return 79
  }
  BACKSTAGE_PROVED_TARGET_COMMIT="$BACKSTAGE_PENDING_TARGET_COMMIT"
  BACKSTAGE_PROVED_ATTEMPT_ID="$BACKSTAGE_PENDING_ATTEMPT_ID"
  BACKSTAGE_PROVED_RUNTIME_FINGERPRINT="$BACKSTAGE_PENDING_RUNTIME_FINGERPRINT"
  BACKSTAGE_PROVED_DEPLOYMENT_CLOSURE_SHA256="$BACKSTAGE_PENDING_DEPLOYMENT_CLOSURE_SHA256"
  BACKSTAGE_PROVED_DEPLOYMENT_UID="$BACKSTAGE_BASELINE_UID"
  BACKSTAGE_PROVED_CANDIDATE_IMAGE="$BACKSTAGE_CANDIDATE_IMAGE"
  BACKSTAGE_PROVED_CANDIDATE_SPEC_SHA256="$BACKSTAGE_CANDIDATE_SPEC_SHA256"
  BACKSTAGE_PROVED_LIVE_RESOURCE_CLOSURE_SHA256="$BACKSTAGE_CANDIDATE_LIVE_RESOURCE_CLOSURE_SHA256"
  BACKSTAGE_PROVED_RUNTIME_DEPENDENCY_CLOSURE_SHA256="$stored_dependency_closure"
  echo "[backstage] exact candidate proof PASS target=$BACKSTAGE_PENDING_TARGET_COMMIT specSha256=$BACKSTAGE_CANDIDATE_SPEC_SHA256"
}

inspect_backstage_runtime_identity_for_rollback() {
  local baseline_image
  BACKSTAGE_STALE_RUNTIME_IDENTITY=false
  BACKSTAGE_DEPLOY_MARKER_VALUE=""
  inspect_backstage_repair_authority_for_rollback || return 79
  if [[ -n "$BACKSTAGE_DEPLOY_STATE_FILE" &&
        ( -e "$BACKSTAGE_DEPLOY_STATE_FILE" || -L "$BACKSTAGE_DEPLOY_STATE_FILE" ) ]]; then
    load_backstage_deploy_marker || return 79
    # A commit-only marker cannot identify an attempt. New attemptful states
    # are authorized only by the exact runtime identity tuple below. Legacy
    # v2 APPLIED_MARKER states are deliberately rollback-only.
  fi
  if ! backstage_runtime_identity_exists; then
    return 0
  fi
  load_backstage_runtime_identity || return 79
  if runtime_identity_matches_loaded_pending_attempt; then
    backstage_rollback_fail "runtime identity already authorizes exact pending attempt; rollback forbidden"
    return 79
  fi
  baseline_image="$(jq -er '
      [.template.spec.containers[] | select(.name == "backstage") | .image] |
      if length == 1 then .[0] else error("backstage container image is not unique") end
    ' <<<"$BACKSTAGE_BASELINE_ROLLBACK_SPEC")" || {
    backstage_rollback_fail "baseline Backstage image cannot be derived for identity reconciliation"
    return 79
  }
  if [[ "$BACKSTAGE_RUNTIME_IDENTITY_DEPLOYMENT_UID" == "$BACKSTAGE_BASELINE_UID" &&
        "$BACKSTAGE_RUNTIME_IDENTITY_CANDIDATE_IMAGE" == "$baseline_image" &&
        "$BACKSTAGE_RUNTIME_IDENTITY_CANDIDATE_SPEC_SHA256" == "$BACKSTAGE_BASELINE_ROLLBACK_SPEC_SHA256" ]]; then
    if [[ -n "$BACKSTAGE_DEPLOY_STATE_FILE" ]]; then
      if [[ ! -e "$BACKSTAGE_DEPLOY_STATE_FILE" && ! -L "$BACKSTAGE_DEPLOY_STATE_FILE" ]]; then
        BACKSTAGE_STALE_RUNTIME_IDENTITY=true
        echo "[backstage] marker-absent baseline will retire stale pre-authority runtime identity after exact proof"
        return 0
      fi
      verify_backstage_deploy_marker "$BACKSTAGE_RUNTIME_IDENTITY_TARGET_COMMIT" || return 79
      verify_backstage_deploy_marker_closure \
        "$BACKSTAGE_RUNTIME_IDENTITY_DEPLOYMENT_CLOSURE_SHA256" || return 79
    fi
    echo "[backstage] existing runtime identity matches rollback baseline and will be preserved"
  else
    BACKSTAGE_STALE_RUNTIME_IDENTITY=true
    echo "[backstage] stale pre-authority runtime identity will be removed only after exact baseline proof"
  fi
}

publish_normalized_backstage_runtime_identity_after_rollback() {
  local expected_file_sha256 identity_target identity_attempt identity_fingerprint identity_closure
  local identity_schema identity_runtime_dependencies identity_runtime_dependency_closure projected_dependencies
  local expected_pending_sha256 pending_attempt
  local target_fingerprint target_closure live_resources baseline_resource_closure live_resource_closure
  local runtime_dependencies runtime_dependency_closure current_json current_spec current_spec_sha256
  local rollback_image identity_payload identity_json integrity saved_candidate_image
  expected_file_sha256="$BACKSTAGE_RUNTIME_IDENTITY_FILE_SHA256"
  identity_target="$BACKSTAGE_RUNTIME_IDENTITY_TARGET_COMMIT"
  identity_attempt="$BACKSTAGE_RUNTIME_IDENTITY_ATTEMPT_ID"
  identity_fingerprint="$BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_FINGERPRINT"
  identity_closure="$BACKSTAGE_RUNTIME_IDENTITY_DEPLOYMENT_CLOSURE_SHA256"
  identity_schema="$BACKSTAGE_RUNTIME_IDENTITY_SCHEMA_VERSION"
  identity_runtime_dependencies="$BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_DEPENDENCIES"
  identity_runtime_dependency_closure="$BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_DEPENDENCY_CLOSURE_SHA256"
  expected_pending_sha256="$BACKSTAGE_PENDING_FILE_SHA256"
  pending_attempt="$BACKSTAGE_PENDING_ATTEMPT_ID"
  is_exact_backstage_commit "$identity_target" &&
    is_valid_backstage_attempt_id "$identity_attempt" &&
    is_valid_backstage_runtime_fingerprint "$identity_fingerprint" &&
    [[ "$identity_closure" =~ ^[0-9a-f]{64}$ ]] || return 79

  load_backstage_runtime_identity || return 79
  [[ "$BACKSTAGE_RUNTIME_IDENTITY_FILE_SHA256" == "$expected_file_sha256" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_TARGET_COMMIT" == "$identity_target" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_ATTEMPT_ID" == "$identity_attempt" ]] || {
    backstage_rollback_fail "runtime identity changed before rollback normalization; mutation=0"
    return 79
  }
  target_fingerprint="$(calculate_target_backstage_runtime_fingerprint "$identity_target")" || return 79
  target_closure="$(calculate_target_backstage_deployment_closure \
    "$identity_target" "$target_fingerprint")" || return 79
  [[ "$target_fingerprint" == "$identity_fingerprint" &&
     "$target_closure" == "$identity_closure" ]] || {
    backstage_rollback_fail "baseline runtime identity target binding is stale; mutation=0"
    return 79
  }
  if [[ -n "$BACKSTAGE_DEPLOY_STATE_FILE" ]]; then
    verify_backstage_deploy_marker "$identity_target" || return 79
    verify_backstage_deploy_marker_closure "$identity_closure" || return 79
  fi

  live_resources="$(capture_all_backstage_managed_resource_snapshots)" || return 79
  baseline_resource_closure="$(calculate_backstage_live_resource_closure_sha256 \
    "$BACKSTAGE_BASELINE_MANAGED_RESOURCES")" || return 79
  live_resource_closure="$(calculate_backstage_live_resource_closure_sha256 "$live_resources")" || return 79
  [[ "$live_resource_closure" == "$baseline_resource_closure" ]] || {
    backstage_rollback_fail "rollback live resource closure differs from durable baseline; mutation=0"
    return 79
  }
  verify_backstage_managed_resources_against_target "$identity_target" || return 79
  [[ "$BACKSTAGE_CANDIDATE_LIVE_RESOURCE_CLOSURE_SHA256" == "$live_resource_closure" ]] || {
    backstage_rollback_fail "rollback managed resources do not match authoritative baseline target; mutation=0"
    return 79
  }
  runtime_dependencies="$(capture_all_backstage_runtime_dependencies)" || return 79
  runtime_dependency_closure="$(calculate_backstage_runtime_dependency_closure_sha256 \
    "$runtime_dependencies")" || return 79
  [[ "$runtime_dependencies" == "$BACKSTAGE_PENDING_RUNTIME_DEPENDENCIES" &&
     "$runtime_dependency_closure" == "$BACKSTAGE_PENDING_RUNTIME_DEPENDENCY_CLOSURE_SHA256" ]] || {
    backstage_rollback_fail "rollback runtime dependencies differ from pre-attempt snapshot; mutation=0"
    return 79
  }
  if [[ "$identity_schema" == 2 || "$identity_schema" == 3 ]]; then
    projected_dependencies="$(jq -cS --argjson expected "$identity_runtime_dependencies" '
      with_entries(select(.key as $key | $expected | has($key)))
    ' <<<"$runtime_dependencies")" || return 79
    [[ "$projected_dependencies" == "$identity_runtime_dependencies" &&
       "$(calculate_backstage_runtime_dependency_closure_sha256 "$projected_dependencies")" == \
         "$identity_runtime_dependency_closure" ]] || {
      backstage_rollback_fail "rollback runtime dependencies differ from prior authoritative identity; mutation=0"
      return 79
    }
  fi
  current_json="$(kubectl -n "$NAMESPACE" get deployment "$BACKSTAGE_DEPLOYMENT_NAME" -o json)" || return 79
  current_spec="$(jq -cS '.spec' <<<"$current_json")" || return 79
  current_spec_sha256="$(printf '%s' "$current_spec" | sha256sum | awk '{print $1}')" || return 79
  [[ "$(jq -r '.metadata.uid' <<<"$current_json")" == "$BACKSTAGE_BASELINE_UID" &&
     "$current_spec" == "$BACKSTAGE_BASELINE_ROLLBACK_SPEC" &&
     "$current_spec_sha256" == "$BACKSTAGE_BASELINE_ROLLBACK_SPEC_SHA256" ]] || {
    backstage_rollback_fail "rollback Deployment differs before runtime identity normalization; mutation=0"
    return 79
  }
  rollback_image="$(jq -er '[.template.spec.containers[]? | select(.name=="backstage") | .image] |
    if length == 1 then .[0] else error("one backstage image required") end' \
    <<<"$BACKSTAGE_BASELINE_ROLLBACK_SPEC")" || return 79
  is_digest_pinned_backstage_candidate_image "$rollback_image" || return 79
  wait_for_backstage_deployment_readiness "$BACKSTAGE_BASELINE_UID" \
    "$BACKSTAGE_BASELINE_ROLLBACK_SPEC" "$BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS" || return 79
  wait_for_backstage_ready_pod_image_ids "$BACKSTAGE_BASELINE_UID" "$rollback_image" \
    "$BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS" || return 79
  verify_backstage_public_serving_plane "$BACKSTAGE_RUNTIME_IDENTITY_VERIFY_TIMEOUT_SECONDS" || return 79

  # A legacy tag identity does not by itself authenticate digest bytes. Upgrade
  # it to schema v3 only when the restored immutable image carries the exact
  # source-input label. A label-less first-migration baseline is safely retired
  # (status 2) after all baseline/marker proofs above; it is never blessed as a
  # digest identity and the next startup schedules a normal repair.
  saved_candidate_image="$BACKSTAGE_RESOLVED_CANDIDATE_IMAGE"
  if ! command -v docker >/dev/null 2>&1 ||
     ! docker pull "$rollback_image" >/dev/null 2>&1 ||
     ! inspect_backstage_image_runtime_binding "$rollback_image" "$identity_fingerprint" ||
     [[ "$BACKSTAGE_RESOLVED_CANDIDATE_IMAGE" != "$rollback_image" ]]; then
    BACKSTAGE_RESOLVED_CANDIDATE_IMAGE="$saved_candidate_image"
    echo "[backstage] label-less legacy rollback identity will be securely retired after exact baseline proof"
    return 2
  fi
  BACKSTAGE_RESOLVED_CANDIDATE_IMAGE="$saved_candidate_image"

  identity_payload="$(jq -cnS \
    --arg targetCommit "$identity_target" \
    --arg attemptId "$identity_attempt" \
    --arg runtimeFingerprint "$identity_fingerprint" \
    --arg deploymentClosureSha256 "$identity_closure" \
    --arg liveResourceClosureSha256 "$live_resource_closure" \
    --argjson runtimeDependencies "$runtime_dependencies" \
    --arg runtimeDependencyClosureSha256 "$runtime_dependency_closure" \
    --arg deploymentUid "$BACKSTAGE_BASELINE_UID" \
    --arg candidateImage "$rollback_image" \
    --arg candidateSpecSha256 "$BACKSTAGE_BASELINE_ROLLBACK_SPEC_SHA256" '
      {schemaVersion:3,targetCommit:$targetCommit,attemptId:$attemptId,
       runtimeFingerprint:$runtimeFingerprint,deploymentClosureSha256:$deploymentClosureSha256,
       liveResourceClosureSha256:$liveResourceClosureSha256,runtimeDependencies:$runtimeDependencies,
       runtimeDependencyClosureSha256:$runtimeDependencyClosureSha256,deploymentUid:$deploymentUid,
       candidateImage:$candidateImage,candidateSpecSha256:$candidateSpecSha256}
    ')" || return 79
  integrity="$(printf '%s' "$identity_payload" | sha256sum | awk '{print $1}')" || return 79
  identity_json="$(jq -cS --arg integrity "$integrity" \
    '. + {integritySha256:$integrity}' <<<"$identity_payload")" || return 79
  verify_expected_backstage_pending_binding || return 79
  load_backstage_pending_state || return 79
  [[ "$BACKSTAGE_PENDING_FILE_SHA256" == "$expected_pending_sha256" &&
     "$BACKSTAGE_PENDING_ATTEMPT_ID" == "$pending_attempt" ]] || {
    backstage_rollback_fail "pending state changed before rollback identity publication; mutation=0"
    return 79
  }
  atomically_publish_backstage_runtime_identity_json "$identity_json" || return 79
  if [[ -n "$BACKSTAGE_DEPLOY_STATE_FILE" ]]; then
    verify_backstage_deploy_marker "$identity_target" || return 79
    verify_backstage_deploy_marker_closure "$identity_closure" || return 79
  fi
  load_backstage_runtime_identity || return 79
  [[ "$BACKSTAGE_RUNTIME_IDENTITY_SCHEMA_VERSION" == 3 &&
     "$BACKSTAGE_RUNTIME_IDENTITY_TARGET_COMMIT" == "$identity_target" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_ATTEMPT_ID" == "$identity_attempt" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_FINGERPRINT" == "$identity_fingerprint" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_DEPLOYMENT_CLOSURE_SHA256" == "$identity_closure" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_DEPLOYMENT_UID" == "$BACKSTAGE_BASELINE_UID" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_CANDIDATE_IMAGE" == "$rollback_image" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_CANDIDATE_SPEC_SHA256" == "$BACKSTAGE_BASELINE_ROLLBACK_SPEC_SHA256" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_LIVE_RESOURCE_CLOSURE_SHA256" == "$live_resource_closure" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_DEPENDENCIES" == "$runtime_dependencies" &&
     "$BACKSTAGE_RUNTIME_IDENTITY_RUNTIME_DEPENDENCY_CLOSURE_SHA256" == "$runtime_dependency_closure" ]] || {
    backstage_rollback_fail "normalized rollback runtime identity reread failed; pending retained"
    return 79
  }
  BACKSTAGE_STALE_RUNTIME_IDENTITY=false
  echo "[backstage] rollback runtime identity normalized to immutable baseline target=$identity_target image=$rollback_image"
}

reconcile_backstage_runtime_identity_after_rollback() {
  local expected_file_sha256 expected_file_stat identity_dir rollback_image normalization_status=0
  [[ "$BACKSTAGE_STALE_RUNTIME_IDENTITY" == true ]] || return 0
  [[ "$BACKSTAGE_DEPLOY_FINALIZATION_STARTED" != true &&
     "$BACKSTAGE_RUNTIME_IDENTITY_PUBLISHED" != true &&
     "$BACKSTAGE_DEPLOY_MARKER_PUBLISHED" != true ]] || {
    backstage_rollback_fail "authority publication forbids stale identity removal"
    return 79
  }
  expected_file_sha256="$BACKSTAGE_RUNTIME_IDENTITY_FILE_SHA256"
  expected_file_stat="$(stat -c '%d:%i:%a:%u:%h:%s:%y:%z' -- \
    "$BACKSTAGE_RUNTIME_IDENTITY_FILE" 2>/dev/null || true)"
  load_backstage_runtime_identity || return 79
  [[ "$BACKSTAGE_RUNTIME_IDENTITY_FILE_SHA256" == "$expected_file_sha256" &&
     "$(stat -c '%d:%i:%a:%u:%h:%s:%y:%z' -- "$BACKSTAGE_RUNTIME_IDENTITY_FILE" 2>/dev/null || true)" == \
       "$expected_file_stat" ]] || {
    backstage_rollback_fail "runtime identity changed before stale removal; mutation=0"
    return 79
  }
  if [[ "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 ]]; then
    rollback_image="$(jq -er '[.template.spec.containers[]? | select(.name=="backstage") | .image] |
      if length == 1 then .[0] else error("one backstage image required") end' \
      <<<"$BACKSTAGE_BASELINE_ROLLBACK_SPEC")" || return 79
    if is_digest_pinned_backstage_candidate_image "$rollback_image" &&
       [[ -n "$BACKSTAGE_DEPLOY_STATE_FILE" ]] &&
       [[ -e "$BACKSTAGE_DEPLOY_STATE_FILE" || -L "$BACKSTAGE_DEPLOY_STATE_FILE" ]]; then
      publish_normalized_backstage_runtime_identity_after_rollback || normalization_status="$?"
      if (( normalization_status == 0 )); then
        return 0
      fi
      (( normalization_status == 2 )) || return 79
    fi
  fi
  verify_expected_backstage_pending_binding || return 79
  load_backstage_runtime_identity || return 79
  [[ "$BACKSTAGE_RUNTIME_IDENTITY_FILE_SHA256" == "$expected_file_sha256" &&
     "$(stat -c '%d:%i:%a:%u:%h:%s:%y:%z' -- "$BACKSTAGE_RUNTIME_IDENTITY_FILE" 2>/dev/null || true)" == \
       "$expected_file_stat" ]] || {
    backstage_rollback_fail "runtime identity changed before secure retirement; mutation=0"
    return 79
  }
  identity_dir="$(dirname -- "$BACKSTAGE_RUNTIME_IDENTITY_FILE")"
  rm -f -- "$BACKSTAGE_RUNTIME_IDENTITY_FILE" || {
    backstage_rollback_fail "stale runtime identity removal failed"
    return 79
  }
  sync -f "$identity_dir" || {
    backstage_rollback_fail "runtime identity directory sync failed after stale removal"
    return 79
  }
  backstage_runtime_identity_exists && {
    backstage_rollback_fail "stale runtime identity remains after removal"
    return 79
  }
  BACKSTAGE_STALE_RUNTIME_IDENTITY=false
  echo "[backstage] stale pre-authority runtime identity removed after exact baseline proof"
}

preflight_backstage_deployment_rollback() {
  local current_json current_uid current_spec current_spec_sha256
  current_json="$(kubectl -n "$NAMESPACE" get deployment "$BACKSTAGE_DEPLOYMENT_NAME" -o json)" || {
    backstage_rollback_fail "rollback preflight Deployment lookup failed; mutation=0"
    return 79
  }
  current_uid="$(jq -er '.metadata.uid' <<<"$current_json")" || return 79
  current_spec="$(jq -cS '.spec' <<<"$current_json")" || return 79
  current_spec_sha256="$(printf '%s' "$current_spec" | sha256sum | awk '{print $1}')" || return 79
  [[ "$current_uid" == "$BACKSTAGE_BASELINE_UID" ]] || {
    backstage_rollback_fail "rollback preflight Deployment UID changed; mutation=0"
    return 79
  }
  if [[ "$current_spec" == "$BACKSTAGE_BASELINE_SPEC" &&
        "$current_spec_sha256" == "$BACKSTAGE_BASELINE_SPEC_SHA256" ]]; then
    return 0
  fi
  if [[ "$current_spec" == "$BACKSTAGE_BASELINE_ROLLBACK_SPEC" &&
        "$current_spec_sha256" == "$BACKSTAGE_BASELINE_ROLLBACK_SPEC_SHA256" ]]; then
    return 0
  fi
  if [[ "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 2 &&
        "$BACKSTAGE_PENDING_PHASE" == CANDIDATE_READY &&
        "$current_spec" == "$BACKSTAGE_CANDIDATE_SPEC" &&
        "$current_spec_sha256" == "$BACKSTAGE_CANDIDATE_SPEC_SHA256" ]]; then
    return 0
  fi
  if [[ ( "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 3 || "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 ) &&
        "$BACKSTAGE_PENDING_PHASE" == MUTATION_ARMED &&
        -n "$BACKSTAGE_PLANNED_DEPLOYMENT_SPEC" &&
        "$current_spec" == "$BACKSTAGE_PLANNED_DEPLOYMENT_SPEC" &&
        "$current_spec_sha256" == "$BACKSTAGE_PLANNED_DEPLOYMENT_SPEC_SHA256" ]]; then
    return 0
  fi
  if [[ ( "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 3 || "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 ) &&
        "$BACKSTAGE_PENDING_PHASE" == CANDIDATE_READY &&
        "$current_spec" == "$BACKSTAGE_CANDIDATE_SPEC" &&
        "$current_spec_sha256" == "$BACKSTAGE_CANDIDATE_SPEC_SHA256" ]]; then
    return 0
  fi
  backstage_rollback_fail "rollback preflight Deployment spec is foreign; mutation=0"
  return 79
}

preflight_backstage_managed_resource_rollback() {
  local kind name key baseline candidate intent current baseline_exists current_exists
  local current_payload current_payload_sha intent_exists intent_payload intent_payload_sha
  is_full_resource_backstage_pending_schema "$BACKSTAGE_PENDING_SCHEMA_VERSION" || return 0
  while IFS='|' read -r kind name; do
    key="$kind/$name"
    baseline="$(jq -cS --arg key "$key" '.[$key]' <<<"$BACKSTAGE_BASELINE_MANAGED_RESOURCES")" || return 79
    candidate="$(jq -cS --arg key "$key" '.[$key]' <<<"$BACKSTAGE_CANDIDATE_MANAGED_RESOURCES")" || return 79
    intent="$(jq -cS --arg key "$key" '.[$key]' <<<"$BACKSTAGE_PENDING_RESOURCE_INTENTS")" || return 79
    current="$(capture_backstage_managed_resource_snapshot "$kind" "$name")" || return 79
    baseline_exists="$(jq -r '.exists' <<<"$baseline")"
    current_exists="$(jq -r '.exists' <<<"$current")"
    intent_exists="$(jq -r '.exists' <<<"$intent")"
    if [[ "$baseline_exists" == false ]]; then
      [[ "$current_exists" == false ]] && continue
      current_payload="$(jq -cS '.payload' <<<"$current")"
      current_payload_sha="$(jq -r '.payloadSha256' <<<"$current")"
      intent_payload="$(jq -cS '.payload' <<<"$intent")"
      intent_payload_sha="$(jq -r '.payloadSha256' <<<"$intent")"
      [[ "$intent_exists" == true && "$current_payload" == "$intent_payload" &&
         "$current_payload_sha" == "$intent_payload_sha" ]] || {
        backstage_rollback_fail "rollback preflight created resource is foreign key=$key; mutation=0"
        return 79
      }
      continue
    fi
    [[ "$current_exists" == true &&
       "$(jq -r '.uid' <<<"$current")" == "$(jq -r '.uid' <<<"$baseline")" ]] || {
      backstage_rollback_fail "rollback preflight managed resource identity changed key=$key; mutation=0"
      return 79
    }
    if [[ "$(jq -cS '.payload' <<<"$current")" == "$(jq -cS '.payload' <<<"$baseline")" &&
          "$(jq -r '.payloadSha256' <<<"$current")" == "$(jq -r '.payloadSha256' <<<"$baseline")" ]]; then
      continue
    fi
    current_payload="$(jq -cS '.payload' <<<"$current")"
    current_payload_sha="$(jq -r '.payloadSha256' <<<"$current")"
    if [[ "$BACKSTAGE_PENDING_PHASE" == MUTATION_ARMED ]]; then
      intent_payload="$(jq -cS '.payload' <<<"$intent")"
      intent_payload_sha="$(jq -r '.payloadSha256' <<<"$intent")"
      [[ "$intent_exists" == true && "$current_payload" == "$intent_payload" &&
         "$current_payload_sha" == "$intent_payload_sha" ]] && continue
    elif [[ "$BACKSTAGE_PENDING_PHASE" == CANDIDATE_READY && "$candidate" != null &&
            "$(jq -r '.exists' <<<"$candidate")" == true &&
            "$(jq -r '.uid' <<<"$current")" == "$(jq -r '.uid' <<<"$candidate")" &&
            "$(jq -r '.resourceVersion' <<<"$current")" == "$(jq -r '.resourceVersion' <<<"$candidate")" &&
            "$current_payload_sha" == "$(jq -r '.payloadSha256' <<<"$candidate")" ]]; then
      continue
    fi
    backstage_rollback_fail "rollback preflight managed resource payload is foreign key=$key; mutation=0"
    return 79
  done < <(backstage_managed_resource_descriptors)
  verify_expected_backstage_pending_binding || return 79
}

rollback_backstage_managed_resources() {
  local kind name key baseline_snapshot candidate_snapshot current_snapshot intent
  local baseline_exists current_exists baseline_uid current_uid current_rv baseline_payload current_payload
  local baseline_payload_sha current_payload_sha candidate_exists candidate_uid candidate_rv candidate_payload_sha
  local intent_exists intent_payload intent_payload_sha patch_json restored_snapshot
  is_full_resource_backstage_pending_schema "$BACKSTAGE_PENDING_SCHEMA_VERSION" || return 0
  while IFS='|' read -r kind name; do
    key="$kind/$name"
    baseline_snapshot="$(jq -cS --arg key "$key" '.[$key]' <<<"$BACKSTAGE_BASELINE_MANAGED_RESOURCES")" || return 79
    candidate_snapshot="$(jq -cS --arg key "$key" '.[$key]' <<<"$BACKSTAGE_CANDIDATE_MANAGED_RESOURCES")" || return 79
    intent="$(jq -cS --arg key "$key" '.[$key]' <<<"$BACKSTAGE_PENDING_RESOURCE_INTENTS")" || return 79
    current_snapshot="$(capture_backstage_managed_resource_snapshot "$kind" "$name")" || return 79
    baseline_exists="$(jq -r '.exists' <<<"$baseline_snapshot")"
    current_exists="$(jq -r '.exists' <<<"$current_snapshot")"
    intent_exists="$(jq -r '.exists' <<<"$intent")"
    if [[ "$baseline_exists" == false ]]; then
      [[ "$current_exists" == true ]] || continue
      current_uid="$(jq -r '.uid' <<<"$current_snapshot")"
      current_rv="$(jq -r '.resourceVersion' <<<"$current_snapshot")"
      current_payload="$(jq -cS '.payload' <<<"$current_snapshot")"
      current_payload_sha="$(jq -r '.payloadSha256' <<<"$current_snapshot")"
      [[ "$intent_exists" == true ]] || {
        backstage_rollback_fail "unexpected managed resource exists without a target creation intent key=$key; mutation=0"
        return 79
      }
      intent_payload="$(jq -cS '.payload' <<<"$intent")"
      intent_payload_sha="$(jq -r '.payloadSha256' <<<"$intent")"
      [[ "$current_payload" == "$intent_payload" &&
         "$current_payload_sha" == "$intent_payload_sha" ]] || {
        backstage_rollback_fail "created managed resource is foreign to durable target intent key=$key; mutation=0"
        return 79
      }
      if [[ "$candidate_snapshot" != null ]]; then
        candidate_exists="$(jq -r '.exists' <<<"$candidate_snapshot")"
        candidate_uid="$(jq -r '.uid' <<<"$candidate_snapshot")"
        candidate_rv="$(jq -r '.resourceVersion' <<<"$candidate_snapshot")"
        candidate_payload_sha="$(jq -r '.payloadSha256' <<<"$candidate_snapshot")"
        [[ "$candidate_exists" == true && "$current_uid" == "$candidate_uid" &&
           "$current_rv" == "$candidate_rv" && "$current_payload_sha" == "$candidate_payload_sha" ]] || {
          backstage_rollback_fail "created managed resource differs from candidate checkpoint key=$key; mutation=0"
          return 79
        }
      fi
      verify_expected_backstage_pending_binding || return 79
      kubectl -n "$NAMESPACE" delete "$kind" "$name" \
        --preconditions="uid=$current_uid,resourceVersion=$current_rv" --wait=true >/dev/null || {
        backstage_rollback_fail "created managed resource CAS delete failed key=$key"
        return 79
      }
      restored_snapshot="$(capture_backstage_managed_resource_snapshot "$kind" "$name")" || return 79
      [[ "$(jq -r '.exists' <<<"$restored_snapshot")" == false ]] || return 79
      continue
    fi
    [[ "$current_exists" == true ]] || {
      backstage_rollback_fail "baseline managed resource is missing key=$key; mutation=0"
      return 79
    }
    baseline_uid="$(jq -r '.uid' <<<"$baseline_snapshot")"
    current_uid="$(jq -r '.uid' <<<"$current_snapshot")"
    current_rv="$(jq -r '.resourceVersion' <<<"$current_snapshot")"
    baseline_payload="$(jq -cS '.payload' <<<"$baseline_snapshot")"
    current_payload="$(jq -cS '.payload' <<<"$current_snapshot")"
    baseline_payload_sha="$(jq -r '.payloadSha256' <<<"$baseline_snapshot")"
    current_payload_sha="$(jq -r '.payloadSha256' <<<"$current_snapshot")"
    [[ "$current_uid" == "$baseline_uid" ]] || {
      backstage_rollback_fail "managed resource UID changed key=$key; mutation=0"
      return 79
    }
    if [[ "$current_payload_sha" == "$baseline_payload_sha" &&
          "$current_payload" == "$baseline_payload" ]]; then
      continue
    fi
    if [[ "$BACKSTAGE_PENDING_PHASE" == MUTATION_ARMED ]]; then
      intent_payload="$(jq -cS '.payload' <<<"$intent")"
      intent_payload_sha="$(jq -r '.payloadSha256' <<<"$intent")"
      [[ "$intent_exists" == true &&
         "$current_payload" == "$intent_payload" &&
         "$current_payload_sha" == "$intent_payload_sha" ]] || {
        backstage_rollback_fail "managed resource is neither baseline nor durable target intent key=$key; mutation=0"
        return 79
      }
    elif [[ "$BACKSTAGE_PENDING_PHASE" == CANDIDATE_READY && "$candidate_snapshot" != null &&
            "$(jq -r '.exists' <<<"$candidate_snapshot")" == true &&
            "$current_uid" == "$(jq -r '.uid' <<<"$candidate_snapshot")" &&
            "$current_rv" == "$(jq -r '.resourceVersion' <<<"$candidate_snapshot")" &&
            "$current_payload_sha" == "$(jq -r '.payloadSha256' <<<"$candidate_snapshot")" ]]; then
      :
    else
      backstage_rollback_fail "managed resource payload is foreign to pending phase key=$key; mutation=0"
      return 79
    fi
    case "$kind" in
      ConfigMap)
        if [[ "$(jq -r '.immutable' <<<"$current_payload")" == true ||
              "$(jq -r '.immutable' <<<"$baseline_payload")" == true ]]; then
          backstage_rollback_fail "immutable ConfigMap transition is not UID-exactly reversible key=$key; mutation=0"
          return 79
        fi
        patch_json="$(jq -cn --arg uid "$current_uid" --arg rv "$current_rv" \
          --argjson baseline "$baseline_payload" '
            [{op:"test",path:"/metadata/uid",value:$uid},
             {op:"test",path:"/metadata/resourceVersion",value:$rv},
             {op:"add",path:"/metadata/labels",value:$baseline.labels},
             {op:"add",path:"/metadata/annotations",value:$baseline.annotations},
             {op:"add",path:"/data",value:$baseline.data},
             {op:"add",path:"/binaryData",value:$baseline.binaryData},
             {op:"add",path:"/immutable",value:$baseline.immutable}]
          ')" || return 79
        ;;
      NetworkPolicy)
        patch_json="$(jq -cn --arg uid "$current_uid" --arg rv "$current_rv" \
          --argjson baseline "$baseline_payload" '
            [{op:"test",path:"/metadata/uid",value:$uid},
             {op:"test",path:"/metadata/resourceVersion",value:$rv},
             {op:"add",path:"/metadata/labels",value:$baseline.labels},
             {op:"add",path:"/metadata/annotations",value:$baseline.annotations},
             {op:"add",path:"/spec",value:$baseline.spec}]
          ')" || return 79
        ;;
      Service)
        patch_json="$(jq -cn --arg uid "$current_uid" --arg rv "$current_rv" \
          --argjson current "$current_payload" --argjson baseline "$baseline_payload" '
            ([{op:"test",path:"/metadata/uid",value:$uid},
             {op:"test",path:"/metadata/resourceVersion",value:$rv},
             {op:"add",path:"/metadata/labels",value:$baseline.labels},
             {op:"add",path:"/metadata/annotations",value:$baseline.annotations},
             {op:"add",path:"/spec/type",value:$baseline.type},
             {op:"add",path:"/spec/selector",value:$baseline.selector},
             {op:"add",path:"/spec/ports",value:$baseline.ports},
             {op:"add",path:"/spec/sessionAffinity",value:$baseline.sessionAffinity},
             {op:"add",path:"/spec/externalTrafficPolicy",value:$baseline.externalTrafficPolicy},
             {op:"add",path:"/spec/internalTrafficPolicy",value:$baseline.internalTrafficPolicy},
             {op:"add",path:"/spec/publishNotReadyAddresses",value:$baseline.publishNotReadyAddresses}] +
             (if $baseline.sessionAffinityConfig == null then
                (if $current.sessionAffinityConfig == null then [] else [{op:"remove",path:"/spec/sessionAffinityConfig"}] end)
              else [{op:"add",path:"/spec/sessionAffinityConfig",value:$baseline.sessionAffinityConfig}] end) +
             (if $baseline.trafficDistribution == null then
                (if $current.trafficDistribution == null then [] else [{op:"remove",path:"/spec/trafficDistribution"}] end)
              else [{op:"add",path:"/spec/trafficDistribution",value:$baseline.trafficDistribution}] end))
          ')" || return 79
        ;;
    esac
    verify_expected_backstage_pending_binding || return 79
    printf '%s' "$patch_json" | kubectl -n "$NAMESPACE" patch "$kind" "$name" \
      --type=json --patch-file=/dev/stdin >/dev/null || {
      backstage_rollback_fail "managed resource JSON-Patch CAS failed key=$key"
      return 79
    }
    restored_snapshot="$(capture_backstage_managed_resource_snapshot "$kind" "$name")" || return 79
    [[ "$(jq -r '.uid' <<<"$restored_snapshot")" == "$baseline_uid" &&
       "$(jq -r '.payloadSha256' <<<"$restored_snapshot")" == "$baseline_payload_sha" ]] || {
      backstage_rollback_fail "managed resource baseline proof failed key=$key"
      return 79
    }
  done < <(backstage_managed_resource_descriptors)
  while IFS='|' read -r kind name; do
    key="$kind/$name"
    baseline_snapshot="$(jq -cS --arg key "$key" '.[$key]' <<<"$BACKSTAGE_BASELINE_MANAGED_RESOURCES")" || return 79
    restored_snapshot="$(capture_backstage_managed_resource_snapshot "$kind" "$name")" || return 79
    [[ "$(jq -r '.exists' <<<"$restored_snapshot")" == "$(jq -r '.exists' <<<"$baseline_snapshot")" ]] || return 79
    if [[ "$(jq -r '.exists' <<<"$baseline_snapshot")" == true ]]; then
      [[ "$(jq -r '.uid' <<<"$restored_snapshot")" == "$(jq -r '.uid' <<<"$baseline_snapshot")" &&
         "$(jq -cS '.payload' <<<"$restored_snapshot")" == "$(jq -cS '.payload' <<<"$baseline_snapshot")" &&
         "$(jq -r '.payloadSha256' <<<"$restored_snapshot")" == "$(jq -r '.payloadSha256' <<<"$baseline_snapshot")" ]] || {
        backstage_rollback_fail "managed resource terminal baseline proof failed key=$key"
        return 79
      }
    fi
  done < <(backstage_managed_resource_descriptors)
  echo "[backstage] all managed non-Deployment resources restored to exact baseline"
}

rollback_pending_backstage_deployment() {
  local current_json current_uid current_resource_version current_spec current_spec_sha256 patch_json rollback_image
  load_backstage_pending_state || return 1
  inspect_backstage_runtime_identity_for_rollback || return 1
  verify_backstage_baseline_rollback_hold_tag || return 1
  preflight_backstage_deployment_rollback || return 1
  preflight_backstage_managed_resource_rollback || return 1
  rollback_backstage_managed_resources || return 1
  current_json="$(kubectl -n "$NAMESPACE" get deployment "$BACKSTAGE_DEPLOYMENT_NAME" -o json)" || {
    backstage_rollback_fail "current Deployment lookup failed"
    return 1
  }
  if ! jq -e \
      --arg namespace "$NAMESPACE" \
      --arg deployment "$BACKSTAGE_DEPLOYMENT_NAME" '
        .apiVersion == "apps/v1" and
        .kind == "Deployment" and
        .metadata.namespace == $namespace and
        .metadata.name == $deployment and
        (.metadata.uid | type == "string" and length > 0) and
        (.metadata.resourceVersion | type == "string" and length > 0) and
        (.spec | type == "object")
      ' <<<"$current_json" >/dev/null; then
    backstage_rollback_fail "current Deployment identity or spec is invalid"
    return 1
  fi
  current_uid="$(jq -r '.metadata.uid' <<<"$current_json")" || return 1
  current_resource_version="$(jq -r '.metadata.resourceVersion' <<<"$current_json")" || return 1
  current_spec="$(jq -cS '.spec' <<<"$current_json")" || return 1
  current_spec_sha256="$(printf '%s' "$current_spec" | sha256sum | awk '{print $1}')" || return 1
  [[ "$current_uid" == "$BACKSTAGE_BASELINE_UID" ]] || {
    backstage_rollback_fail "Deployment UID changed; rollback mutation=0"
    return 1
  }
  if [[ "$current_spec_sha256" == "$BACKSTAGE_BASELINE_ROLLBACK_SPEC_SHA256" &&
        "$current_spec" == "$BACKSTAGE_BASELINE_ROLLBACK_SPEC" ]]; then
    wait_for_backstage_deployment_readiness "$BACKSTAGE_BASELINE_UID" "$BACKSTAGE_BASELINE_ROLLBACK_SPEC" || return 1
    if [[ "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 ]]; then
      rollback_image="$(jq -er '[.template.spec.containers[]? | select(.name=="backstage") | .image] |
        if length == 1 then .[0] else error("one backstage image required") end' \
        <<<"$BACKSTAGE_BASELINE_ROLLBACK_SPEC")" || return 1
      wait_for_backstage_ready_pod_image_ids "$BACKSTAGE_BASELINE_UID" "$rollback_image" \
        "$BACKSTAGE_DEPLOYMENT_ROLLBACK_TIMEOUT_SECONDS" || return 1
    fi
    reconcile_backstage_runtime_identity_after_rollback || return 1
    clear_backstage_repair_authority_after_rollback || return 1
    cleanup_backstage_baseline_rollback_hold_tag
    clear_backstage_pending_state || return 1
    echo "[backstage] deployment rollback already at exact baseline; pending state cleared"
    return 0
  fi
  if [[ "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 &&
        "$current_spec_sha256" == "$BACKSTAGE_BASELINE_SPEC_SHA256" &&
        "$current_spec" == "$BACKSTAGE_BASELINE_SPEC" ]]; then
    echo "[backstage] exact observed baseline authorizes immutable digest pinning during recovery"
  elif [[ "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 2 &&
        "$BACKSTAGE_PENDING_PHASE" == CANDIDATE_READY &&
        "$current_spec_sha256" == "$BACKSTAGE_CANDIDATE_SPEC_SHA256" &&
        "$current_spec" == "$BACKSTAGE_CANDIDATE_SPEC" ]]; then
    # An old v2 exact candidate is authenticated enough for rollback, but not
    # for finalization because it lacks the v3 full-resource closure.
    echo "[backstage] legacy v2 exact candidate authorizes Deployment-only baseline recovery"
  elif [[ "$BACKSTAGE_PENDING_PHASE" == "MUTATION_ARMED" &&
          -n "$BACKSTAGE_PLANNED_DEPLOYMENT_SPEC" &&
          "$current_spec_sha256" == "$BACKSTAGE_PLANNED_DEPLOYMENT_SPEC_SHA256" &&
          "$current_spec" == "$BACKSTAGE_PLANNED_DEPLOYMENT_SPEC" ]]; then
    echo "[backstage] exact durably planned Deployment authorizes baseline recovery"
  elif [[ "$BACKSTAGE_PENDING_PHASE" == "CANDIDATE_READY" &&
          "$current_spec_sha256" == "$BACKSTAGE_CANDIDATE_SPEC_SHA256" &&
          "$current_spec" == "$BACKSTAGE_CANDIDATE_SPEC" ]]; then
    :
  else
    backstage_rollback_fail "Deployment spec is foreign to pending phase; rollback mutation=0"
    return 1
  fi
  patch_json="$(jq -cn \
    --arg uid "$current_uid" \
    --arg resourceVersion "$current_resource_version" \
    --argjson currentSpec "$current_spec" \
    --argjson baselineSpec "$BACKSTAGE_BASELINE_ROLLBACK_SPEC" '
      [
        {op:"test", path:"/metadata/uid", value:$uid},
        {op:"test", path:"/metadata/resourceVersion", value:$resourceVersion},
        {op:"test", path:"/spec", value:$currentSpec},
        {op:"replace", path:"/spec", value:$baselineSpec}
      ]
    ')" || return 1
  verify_expected_backstage_pending_binding || return 1
  if ! printf '%s' "$patch_json" | kubectl -n "$NAMESPACE" patch deployment "$BACKSTAGE_DEPLOYMENT_NAME" \
      --type=json --patch-file=/dev/stdin >/dev/null; then
    backstage_rollback_fail "Deployment JSON-Patch CAS failed; rollback mutation not authorized"
    return 1
  fi
  kubectl -n "$NAMESPACE" rollout status "deployment/$BACKSTAGE_DEPLOYMENT_NAME" \
    --timeout="${BACKSTAGE_DEPLOYMENT_ROLLBACK_TIMEOUT_SECONDS}s" || {
    backstage_rollback_fail "baseline rollout wait failed"
    return 1
  }
  wait_for_backstage_deployment_readiness "$BACKSTAGE_BASELINE_UID" "$BACKSTAGE_BASELINE_ROLLBACK_SPEC" || return 1
  if [[ "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 ]]; then
    rollback_image="$(jq -er '[.template.spec.containers[]? | select(.name=="backstage") | .image] |
      if length == 1 then .[0] else error("one backstage image required") end' \
      <<<"$BACKSTAGE_BASELINE_ROLLBACK_SPEC")" || return 1
    wait_for_backstage_ready_pod_image_ids "$BACKSTAGE_BASELINE_UID" "$rollback_image" \
      "$BACKSTAGE_DEPLOYMENT_ROLLBACK_TIMEOUT_SECONDS" || return 1
  fi
  reconcile_backstage_runtime_identity_after_rollback || return 1
  clear_backstage_repair_authority_after_rollback || return 1
  cleanup_backstage_baseline_rollback_hold_tag
  clear_backstage_pending_state || return 1
  echo "[backstage] deployment rollback verified and pending state cleared"
}

resume_pending_backstage_deployment_rollback() {
  prepare_backstage_rollback_state_directory || return 79
  if backstage_pending_state_exists; then
    echo "[backstage] pending Deployment rollback detected; recovery precedes build and mutation"
    rollback_pending_backstage_deployment || {
      echo "[backstage] pending Deployment rollback recovery failed" >&2
      return 79
    }
    echo "[backstage] pending Deployment rollback recovery PASS"
  fi
}

resume_or_finalize_pending_backstage_deployment() {
  local target_authority_artifact=false
  prepare_backstage_rollback_state_directory || return 79
  if ! backstage_pending_state_exists; then
    if backstage_repair_authority_exists; then
      backstage_rollback_fail "orphan repair authority requires reconcile-repair-authority before new deploy; mutation=0"
      return 79
    fi
    return 0
  fi
  load_backstage_pending_state || return 79
  if backstage_runtime_identity_exists; then
    load_backstage_runtime_identity || return 79
    if runtime_identity_matches_loaded_pending_attempt; then
      target_authority_artifact=true
    fi
  fi
  if [[ "$BACKSTAGE_DEPLOYMENT_FINALIZE_MODE" == "immediate" &&
        ( "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 3 || "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 ) &&
        "$BACKSTAGE_PENDING_TARGET_COMMIT" == "$BACKSTAGE_DEPLOYMENT_TARGET_COMMIT" &&
        "$target_authority_artifact" == true ]]; then
    echo "[backstage] durable target authority artifact detected; finalizing retained candidate before new mutation"
    finalize_pending_backstage_deployment "$BACKSTAGE_PENDING_TARGET_COMMIT" || return 79
    # This completion belongs to the recovered prior attempt. The new deploy
    # must arm and roll back independently if it later fails.
    BACKSTAGE_DEPLOY_COMPLETED=false
    BACKSTAGE_DEPLOY_FINALIZATION_STARTED=false
    BACKSTAGE_RUNTIME_IDENTITY_PUBLISHED=false
    BACKSTAGE_DEPLOY_MARKER_PUBLISHED=false
    BACKSTAGE_PROVED_TARGET_COMMIT=""
    BACKSTAGE_PROVED_ATTEMPT_ID=""
    BACKSTAGE_PROVED_RUNTIME_FINGERPRINT=""
    BACKSTAGE_PROVED_DEPLOYMENT_CLOSURE_SHA256=""
    BACKSTAGE_PROVED_DEPLOYMENT_UID=""
    BACKSTAGE_PROVED_CANDIDATE_IMAGE=""
    BACKSTAGE_PROVED_CANDIDATE_SPEC_SHA256=""
    BACKSTAGE_PROVED_LIVE_RESOURCE_CLOSURE_SHA256=""
    BACKSTAGE_PROVED_RUNTIME_DEPENDENCY_CLOSURE_SHA256=""
    return 0
  fi
  if [[ ( ( "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 3 || "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 ) &&
          "$BACKSTAGE_PENDING_COORDINATOR" == auto ) ||
        ( "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 2 &&
          "$BACKSTAGE_PENDING_AUTHORITY_KIND" == DB_PROMOTION ) ]]; then
    backstage_rollback_fail "coordinator-owned pending deployment requires authoritative parent reconciliation; mutation=0"
    return 79
  fi
  resume_pending_backstage_deployment_rollback
}

hydrate_legacy_v2_backstage_runtime_proof() {
  local fingerprint closure
  [[ "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 2 &&
     "$BACKSTAGE_PENDING_ATTEMPT_ID_PRESENT" != true &&
     "$BACKSTAGE_PENDING_AUTHORITY_KIND" == "DB_PROMOTION" ]] || return 0
  fingerprint="$(calculate_target_backstage_runtime_fingerprint "$BACKSTAGE_PENDING_TARGET_COMMIT")" || {
    backstage_rollback_fail "legacy v2 target runtime fingerprint is unavailable"
    return 79
  }
  closure="$(calculate_target_backstage_deployment_closure \
    "$BACKSTAGE_PENDING_TARGET_COMMIT" "$fingerprint")" || {
    backstage_rollback_fail "legacy v2 target deployment closure is unavailable"
    return 79
  }
  BACKSTAGE_PENDING_RUNTIME_FINGERPRINT="$fingerprint"
  BACKSTAGE_PENDING_DEPLOYMENT_CLOSURE_SHA256="$closure"
  BACKSTAGE_PROVED_RUNTIME_FINGERPRINT="$fingerprint"
  BACKSTAGE_PROVED_DEPLOYMENT_CLOSURE_SHA256="$closure"
  verify_backstage_managed_resources_against_target "$BACKSTAGE_PENDING_TARGET_COMMIT" || return 79
  BACKSTAGE_PROVED_LIVE_RESOURCE_CLOSURE_SHA256="$BACKSTAGE_CANDIDATE_LIVE_RESOURCE_CLOSURE_SHA256"
}

finalize_pending_backstage_deployment() {
  local exact_target="$1" attempt_authority_published=false finalized_authority_kind finalized_attempt_id
  is_exact_backstage_commit "$exact_target" || {
    backstage_rollback_fail "finalize target commit is invalid"
    return 79
  }
  load_backstage_pending_state || return 79
  is_full_resource_backstage_pending_schema "$BACKSTAGE_PENDING_SCHEMA_VERSION" || {
    backstage_rollback_fail "legacy pending state cannot be finalized; mutation=0"
    return 79
  }
  [[ "$BACKSTAGE_PENDING_TARGET_COMMIT" == "$exact_target" ]] || {
    backstage_rollback_fail "finalize target does not match pending target; mutation=0"
    return 79
  }
  prove_pending_backstage_candidate || return 79
  verify_expected_backstage_pending_binding || return 79
  if backstage_runtime_identity_exists; then
    load_backstage_runtime_identity || return 79
    if runtime_identity_matches_loaded_pending_attempt; then
      attempt_authority_published=true
    fi
  fi
  if [[ "$BACKSTAGE_PENDING_AUTHORITY_KIND" == "REPAIR_TOKEN" &&
        "$attempt_authority_published" != true ]]; then
    validate_authorized_repair_token_for_pending || return 79
  fi
  if [[ "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 3 &&
        "$attempt_authority_published" != true ]]; then
    backstage_rollback_fail "legacy v3 pending requires its exact already-published v2 runtime identity; mutation=0"
    return 79
  fi
  finalized_authority_kind="$BACKSTAGE_PENDING_AUTHORITY_KIND"
  finalized_attempt_id="$BACKSTAGE_PENDING_ATTEMPT_ID"
  BACKSTAGE_DEPLOY_FINALIZATION_STARTED=true
  if [[ "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 ]]; then
    publish_backstage_runtime_identity "$exact_target" || return 79
  fi
  publish_backstage_deploy_marker "$exact_target" || return 79
  cleanup_backstage_baseline_rollback_hold_tag
  clear_backstage_pending_state || return 79
  if [[ "$finalized_authority_kind" == "REPAIR_TOKEN" ]]; then
    clear_backstage_repair_authority_after_finalization \
      "$exact_target" "$finalized_attempt_id" || return 79
  fi
  BACKSTAGE_DEPLOY_COMPLETED=true
  echo "[backstage] deployment rollback state finalized target=$exact_target pending=0"
}

reconcile_pending_backstage_deployment() {
  local authoritative_commit="$1"
  is_exact_backstage_commit "$authoritative_commit" || {
    backstage_rollback_fail "authoritative commit is invalid"
    return 79
  }
  load_backstage_pending_state || return 79
  if ! is_full_resource_backstage_pending_schema "$BACKSTAGE_PENDING_SCHEMA_VERSION"; then
    rollback_pending_backstage_deployment || return 79
    echo "[backstage] pending Deployment reconcile PASS action=rollback authority=LEGACY_V${BACKSTAGE_PENDING_SCHEMA_VERSION} authoritative=$authoritative_commit"
  elif [[ "$authoritative_commit" == "$BACKSTAGE_PENDING_TARGET_COMMIT" ]]; then
    finalize_pending_backstage_deployment "$authoritative_commit" || return 79
    echo "[backstage] pending Deployment reconcile PASS action=finalize authority=$BACKSTAGE_PENDING_AUTHORITY_KIND target=$authoritative_commit"
  else
    rollback_pending_backstage_deployment || return 79
    echo "[backstage] pending Deployment reconcile PASS action=rollback authority=$BACKSTAGE_PENDING_AUTHORITY_KIND authoritative=$authoritative_commit"
  fi
}

bind_backstage_deployment_identity() {
  local selected_commit computed_runtime_fingerprint computed_deployment_closure
  [[ "$BACKSTAGE_DEPLOYMENT_FINALIZE_MODE" == "immediate" ||
     "$BACKSTAGE_DEPLOYMENT_FINALIZE_MODE" == "deferred" ]] || {
    backstage_rollback_fail "invalid BACKSTAGE_DEPLOYMENT_FINALIZE_MODE; mutation=0"
    return 79
  }
  selected_commit="$(git -C "$ROOT" rev-parse HEAD)" || {
    backstage_rollback_fail "selected source HEAD lookup failed; mutation=0"
    return 79
  }
  if [[ -z "$BACKSTAGE_DEPLOYMENT_TARGET_COMMIT" ]]; then
    if [[ "$BACKSTAGE_DEPLOYMENT_FINALIZE_MODE" == "deferred" ]]; then
      backstage_rollback_fail "deferred deploy requires BACKSTAGE_DEPLOYMENT_TARGET_COMMIT; mutation=0"
      return 79
    fi
    BACKSTAGE_DEPLOYMENT_TARGET_COMMIT="$selected_commit"
  fi
  if [[ -z "$BACKSTAGE_DEPLOYMENT_AUTHORITY_KIND" ]]; then
    if [[ "$BACKSTAGE_DEPLOYMENT_FINALIZE_MODE" == "deferred" ]]; then
      backstage_rollback_fail "deferred deploy requires BACKSTAGE_DEPLOYMENT_AUTHORITY_KIND; mutation=0"
      return 79
    fi
    BACKSTAGE_DEPLOYMENT_AUTHORITY_KIND=APPLIED_MARKER
  fi
  is_exact_backstage_commit "$BACKSTAGE_DEPLOYMENT_TARGET_COMMIT" &&
    is_valid_backstage_authority_kind "$BACKSTAGE_DEPLOYMENT_AUTHORITY_KIND" || {
    backstage_rollback_fail "deployment target or authority identity is invalid; mutation=0"
    return 79
  }
  [[ "$selected_commit" == "$BACKSTAGE_DEPLOYMENT_TARGET_COMMIT" ]] || {
    backstage_rollback_fail "deployment target does not bind the selected source HEAD; mutation=0"
    return 79
  }
  if [[ -n "$BACKSTAGE_DEPLOYMENT_ATTEMPT_ID" ]]; then
    is_valid_backstage_attempt_id "$BACKSTAGE_DEPLOYMENT_ATTEMPT_ID" || {
      backstage_rollback_fail "supplied deployment attempt ID is invalid; mutation=0"
      return 79
    }
  elif [[ "$BACKSTAGE_DEPLOYMENT_FINALIZE_MODE" == deferred ]]; then
    backstage_rollback_fail "deferred deploy requires BACKSTAGE_DEPLOYMENT_ATTEMPT_ID; mutation=0"
    return 79
  else
    BACKSTAGE_DEPLOYMENT_ATTEMPT_ID="$(openssl rand -hex 16)" || {
      backstage_rollback_fail "standalone deployment attempt ID generation failed; mutation=0"
      return 79
    }
    is_valid_backstage_attempt_id "$BACKSTAGE_DEPLOYMENT_ATTEMPT_ID" || return 79
  fi
  computed_runtime_fingerprint="$(calculate_target_backstage_runtime_fingerprint \
    "$BACKSTAGE_DEPLOYMENT_TARGET_COMMIT")" || {
    backstage_rollback_fail "selected target runtime fingerprint is unavailable; mutation=0"
    return 79
  }
  if [[ -n "$BACKSTAGE_DEPLOYMENT_RUNTIME_FINGERPRINT" &&
        "$BACKSTAGE_DEPLOYMENT_RUNTIME_FINGERPRINT" != "$computed_runtime_fingerprint" ]]; then
    backstage_rollback_fail "supplied runtime fingerprint does not match selected target; mutation=0"
    return 79
  fi
  BACKSTAGE_DEPLOYMENT_RUNTIME_FINGERPRINT="$computed_runtime_fingerprint"
  computed_deployment_closure="$(calculate_target_backstage_deployment_closure \
    "$BACKSTAGE_DEPLOYMENT_TARGET_COMMIT" "$computed_runtime_fingerprint")" || {
    backstage_rollback_fail "selected target deployment closure is unavailable; mutation=0"
    return 79
  }
  if [[ -n "$BACKSTAGE_DEPLOYMENT_CLOSURE_SHA256" &&
        "$BACKSTAGE_DEPLOYMENT_CLOSURE_SHA256" != "$computed_deployment_closure" ]]; then
    backstage_rollback_fail "supplied deployment closure does not match selected target; mutation=0"
    return 79
  fi
  BACKSTAGE_DEPLOYMENT_CLOSURE_SHA256="$computed_deployment_closure"
  echo "[backstage] deployment identity bound mode=$BACKSTAGE_DEPLOYMENT_FINALIZE_MODE target=$BACKSTAGE_DEPLOYMENT_TARGET_COMMIT authority=$BACKSTAGE_DEPLOYMENT_AUTHORITY_KIND attempt=$BACKSTAGE_DEPLOYMENT_ATTEMPT_ID"
}

finalize_successful_backstage_deployment() {
  if [[ "$BACKSTAGE_DEPLOYMENT_FINALIZE_MODE" == "deferred" ]]; then
    prove_pending_backstage_candidate || return 79
    BACKSTAGE_DEPLOY_HANDOFF=true
    echo "[backstage] deployment finalization deferred target=$BACKSTAGE_PENDING_TARGET_COMMIT authority=$BACKSTAGE_PENDING_AUTHORITY_KIND pending=1"
    return 0
  fi
  finalize_pending_backstage_deployment "$BACKSTAGE_DEPLOYMENT_TARGET_COMMIT"
}

deployment_exit_handler() {
  local original_status="$?" final_status rollback_status=0
  trap - EXIT
  set +e
  final_status="$original_status"
  if [[ "$BACKSTAGE_DEPLOY_ROLLBACK_ARMED" == "true" &&
        "$BACKSTAGE_DEPLOY_COMPLETED" != "true" ]]; then
    if [[ "$original_status" == 0 && "$BACKSTAGE_DEPLOY_HANDOFF" == "true" ]]; then
      echo "[backstage] deferred candidate handed off with authenticated pending state"
    elif [[ "$BACKSTAGE_DEPLOY_FINALIZATION_STARTED" == "true" ||
            "$BACKSTAGE_RUNTIME_IDENTITY_PUBLISHED" == "true" ||
            "$BACKSTAGE_DEPLOY_MARKER_PUBLISHED" == "true" ]]; then
      final_status=79
      echo "[backstage] candidate finalization or authority publication started; candidate and pending state retained, rollback forbidden status=79" >&2
    else
      echo "[backstage] deploy exited status=$original_status; restoring exact baseline Deployment" >&2
      rollback_pending_backstage_deployment
      rollback_status="$?"
      if (( rollback_status != 0 )); then
        final_status=79
        echo "[backstage] automatic Deployment rollback failed; pending state retained status=79" >&2
      elif (( original_status == 0 )); then
        final_status=79
        echo "[backstage] deploy ended before readiness finalization; baseline restored status=79" >&2
      fi
    fi
  fi
  cleanup_build_tmp
  exit "$final_status"
}

trap deployment_exit_handler EXIT

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[backstage] missing command: $1" >&2
    exit 1
  }
}

mode="${1:-deploy}"
[[ "$BACKSTAGE_REQUIRE_BASELINE_TAG_DIGEST_PROOF" == true ||
   "$BACKSTAGE_REQUIRE_BASELINE_TAG_DIGEST_PROOF" == false ]] || {
  echo '[backstage] baseline tag digest proof selector is invalid; mutation=0' >&2
  exit 79
}
if [[ "$mode" != verify-pending-candidate &&
      "$BACKSTAGE_REQUIRE_BASELINE_TAG_DIGEST_PROOF" != false ]]; then
  echo '[backstage] baseline tag digest proof selector is valid only for verify-pending-candidate; mutation=0' >&2
  exit 79
fi
if [[ -n "$BACKSTAGE_DEPLOYMENT_INHERITED_LOCK_FD" ]]; then
  case "$mode" in
    verify-runtime-identity|verify-pending-candidate|recover-pending|finalize-pending|reconcile-pending|reconcile-parent-authority-binding) ;;
    *) echo '[backstage] inherited deployment lock FD is invalid for this mode; mutation=0' >&2; exit 79 ;;
  esac
fi
case "$mode" in
  recover-pending|finalize-pending|reconcile-pending|verify-runtime-identity|verify-pending-candidate|reconcile-repair-authority|reconcile-parent-authority-binding)
    # These operator/parent-safe paths intentionally precede Node, Docker,
    # buildx and all Secret/configuration prerequisites. They serialize on the
    # exact same state-directory inode as deploy.
    if [[ "$mode" == "recover-pending" || "$mode" == "reconcile-repair-authority" ]]; then
      [[ "$#" == 1 ]] || {
        echo "[backstage] $mode accepts no arguments; mutation=0" >&2
        exit 79
      }
    else
      [[ "$#" == 2 ]] && is_exact_backstage_commit "$2" || {
        echo "[backstage] $mode requires one exact 40-hex commit; mutation=0" >&2
        exit 79
      }
    fi
    for command in dirname id mkdir readlink realpath stat flock sed jq sha256sum awk; do
      require "$command"
    done
    if [[ -n "$BACKSTAGE_DEPLOYMENT_INHERITED_LOCK_FD" ]]; then
      adopt_inherited_backstage_deployment_lock || exit 79
    else
      acquire_backstage_deployment_lock || exit 79
    fi
    authorize_backstage_parent_binding_cli_mode "$mode" "${2:-}" || exit 79
    if [[ "$mode" == verify-pending-candidate ]]; then
      [[ -n "$BACKSTAGE_DEPLOYMENT_INHERITED_LOCK_FD" &&
         -n "$BACKSTAGE_EXPECTED_PENDING_SHA256" &&
         -n "$BACKSTAGE_EXPECTED_ATTEMPT_ID" ]] || {
        echo '[backstage] pending candidate proof requires inherited lock, expected SHA-256, and attempt ID; mutation=0' >&2
        exit 79
      }
    fi
    if [[ -n "$BACKSTAGE_DEPLOYMENT_INHERITED_LOCK_FD" &&
          "$mode" != verify-runtime-identity ]]; then
      [[ -n "$BACKSTAGE_EXPECTED_ATTEMPT_ID" ]] || {
        echo '[backstage] inherited-lock mutation requires expected attempt ID; mutation=0' >&2
        exit 79
      }
      if backstage_pending_state_exists && [[ -z "$BACKSTAGE_EXPECTED_PENDING_SHA256" ]]; then
        echo '[backstage] inherited-lock pending mutation requires expected pending SHA-256; mutation=0' >&2
        exit 79
      fi
    fi
    if [[ "$mode" == "reconcile-repair-authority" ]]; then
      for command in git kubectl jq sha256sum awk bash date sleep rm sync curl openssl base64; do
        require "$command"
      done
      reconcile_orphan_backstage_repair_authority || exit 79
      exit 0
    fi
    if [[ "$mode" == "reconcile-parent-authority-binding" ]]; then
      for command in git kubectl jq sha256sum awk bash date sleep rm sync curl openssl base64; do
        require "$command"
      done
      validate_expected_backstage_pending_sha256 || exit 79
      reconcile_orphan_backstage_parent_authority_binding "$2" || exit 79
      exit 0
    fi
    if [[ "$mode" == "verify-runtime-identity" ]]; then
      for command in git kubectl jq sha256sum awk bash date sleep curl openssl base64; do
        require "$command"
      done
      if verify_backstage_runtime_identity_against_live "$2" true; then
        echo "[backstage] VERIFY_RUNTIME_IDENTITY_PASS target=$2 drift=0 mutation=0"
        exit 0
      else
        identity_status="$?"
        if [[ "$identity_status" == 1 ]]; then
          echo "[backstage] VERIFY_RUNTIME_IDENTITY_DRIFT target=$2 drift=1 mutation=0" >&2
          exit 1
        fi
        echo "[backstage] VERIFY_RUNTIME_IDENTITY_UNSAFE target=$2 status=79 mutation=0" >&2
        exit 79
      fi
    fi
    if [[ "$mode" == verify-pending-candidate ]]; then
      for command in git kubectl jq sha256sum awk bash date sleep curl openssl base64; do
        require "$command"
      done
      validate_expected_backstage_pending_sha256 || exit 79
      backstage_pending_state_exists || {
        echo '[backstage] pending candidate proof requires an existing pending state; mutation=0' >&2
        exit 79
      }
      verify_expected_backstage_pending_binding || exit 79
      prove_pending_backstage_candidate || exit 79
      [[ "$BACKSTAGE_PROVED_TARGET_COMMIT" == "$2" &&
         "$BACKSTAGE_PROVED_ATTEMPT_ID" == "$BACKSTAGE_EXPECTED_ATTEMPT_ID" ]] || {
        echo '[backstage] pending candidate proof target or attempt mismatch; mutation=0' >&2
        exit 79
      }
      baseline_tag_digest_proof=0
      if [[ "$BACKSTAGE_PENDING_BASELINE_TAG_PROOF" != null &&
            "$(jq -r '.digestImage' <<<"$BACKSTAGE_PENDING_BASELINE_TAG_PROOF")" == \
              "$BACKSTAGE_PROVED_CANDIDATE_IMAGE" ]]; then
        baseline_tag_digest_proof=1
      fi
      if [[ "$BACKSTAGE_REQUIRE_BASELINE_TAG_DIGEST_PROOF" == true &&
            "$baseline_tag_digest_proof" != 1 ]]; then
        echo '[backstage] pending candidate lacks required baseline tag-to-digest proof; mutation=0' >&2
        exit 79
      fi
      echo "[backstage] VERIFY_PENDING_CANDIDATE_PASS target=$2 attempt=$BACKSTAGE_PROVED_ATTEMPT_ID image=$BACKSTAGE_PROVED_CANDIDATE_IMAGE baselineTagDigestProof=$baseline_tag_digest_proof mutation=0"
      exit 0
    fi
    validate_expected_backstage_pending_sha256 || exit 79
    if [[ -n "$BACKSTAGE_EXPECTED_PENDING_SHA256" ]] && backstage_pending_state_exists; then
      for command in sha256sum awk; do
        require "$command"
      done
      verify_expected_backstage_pending_binding || exit 79
    fi
    if backstage_pending_state_exists; then
      for command in kubectl jq sha256sum awk date sleep rm sync mv chmod mktemp tr curl openssl base64; do
        require "$command"
      done
      case "$mode" in
        recover-pending)
          load_backstage_pending_state || exit 79
          if [[ ( "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 3 || "$BACKSTAGE_PENDING_SCHEMA_VERSION" == 4 ) &&
                "$BACKSTAGE_PENDING_COORDINATOR" == standalone ]]; then
            standalone_identity_authority=false
            if backstage_runtime_identity_exists; then
              load_backstage_runtime_identity || exit 79
              runtime_identity_matches_loaded_pending_attempt && standalone_identity_authority=true
            fi
            if [[ "$standalone_identity_authority" == true ]]; then
              finalize_pending_backstage_deployment "$BACKSTAGE_PENDING_TARGET_COMMIT" || exit 79
              echo '[backstage] BACKSTAGE_PENDING_RECOVERY_PASS pending=1 recovered=1 mutation=standalone-finalize'
            else
              resume_pending_backstage_deployment_rollback || exit 79
              echo '[backstage] BACKSTAGE_PENDING_RECOVERY_PASS pending=1 recovered=1 mutation=rollback-only'
            fi
          else
            if is_full_resource_backstage_pending_schema "$BACKSTAGE_PENDING_SCHEMA_VERSION"; then
              [[ -n "$BACKSTAGE_EXPECTED_PENDING_SHA256" &&
                 -n "$BACKSTAGE_EXPECTED_ATTEMPT_ID" ]] || {
                echo '[backstage] coordinator-owned recovery requires expected pending SHA-256 and attempt ID; mutation=0' >&2
                exit 79
              }
            fi
            resume_pending_backstage_deployment_rollback || exit 79
            echo '[backstage] BACKSTAGE_PENDING_RECOVERY_PASS pending=1 recovered=1 mutation=rollback-only'
          fi
          ;;
        finalize-pending)
          finalize_pending_backstage_deployment "$2" || exit 79
          echo "[backstage] BACKSTAGE_PENDING_FINALIZE_PASS pending=1 target=$2 markerThenClear=1"
          ;;
        reconcile-pending)
          load_backstage_pending_state || exit 79
          if [[ "$2" == "$BACKSTAGE_PENDING_TARGET_COMMIT" ]]; then
            reconcile_pending_backstage_deployment "$2" || exit 79
            echo "[backstage] BACKSTAGE_PENDING_RECONCILE_PASS pending=1 action=finalize target=$2"
          else
            reconcile_pending_backstage_deployment "$2" || exit 79
            echo "[backstage] BACKSTAGE_PENDING_RECONCILE_PASS pending=1 action=rollback authoritative=$2"
          fi
          ;;
      esac
    else
      case "$mode" in
        recover-pending) echo '[backstage] BACKSTAGE_PENDING_RECOVERY_PASS pending=0 recovered=0 mutation=0' ;;
        finalize-pending)
          verify_backstage_runtime_identity_against_live "$2" false true || exit 79
          [[ -z "$BACKSTAGE_EXPECTED_ATTEMPT_ID" ||
             "$BACKSTAGE_RUNTIME_IDENTITY_ATTEMPT_ID" == "$BACKSTAGE_EXPECTED_ATTEMPT_ID" ]] || {
            echo '[backstage] no-pending runtime identity does not match expected attempt ID; mutation=0' >&2
            exit 79
          }
          verify_backstage_deploy_marker "$2" || exit 79
          if backstage_repair_authority_exists; then
            load_backstage_repair_authority || exit 79
            [[ "$BACKSTAGE_RUNTIME_IDENTITY_TARGET_COMMIT" == "$BACKSTAGE_REPAIR_AUTHORITY_TARGET_COMMIT" &&
               "$BACKSTAGE_RUNTIME_IDENTITY_ATTEMPT_ID" == "$BACKSTAGE_REPAIR_AUTHORITY_ATTEMPT_ID" ]] || exit 79
            clear_backstage_repair_authority_after_finalization \
              "$BACKSTAGE_REPAIR_AUTHORITY_TARGET_COMMIT" "$BACKSTAGE_REPAIR_AUTHORITY_ATTEMPT_ID" || exit 79
          fi
          echo "[backstage] BACKSTAGE_PENDING_FINALIZE_PASS pending=0 target=$2 mutation=0 identityProof=1 markerProof=1"
          ;;
        reconcile-pending)
          if backstage_runtime_identity_exists; then
            verify_backstage_runtime_identity_against_live "$2" false true || exit 79
          fi
          echo "[backstage] BACKSTAGE_PENDING_RECONCILE_PASS pending=0 authoritative=$2 mutation=0"
          ;;
      esac
    fi
    exit 0
    ;;
esac

phase_started_at=0
deploy_started_at="$(date +%s)"
start_phase() {
  phase_started_at="$(date +%s)"
  echo "[backstage][timing] start $1"
}
finish_phase() {
  local phase_name="$1" elapsed
  elapsed="$(( $(date +%s) - phase_started_at ))"
  echo "[backstage][timing] finish $phase_name seconds=$elapsed"
}

run_yarn_script_if_defined() {
  local script_name="$1"
  if node -e \
    'const p=require("./package.json"); process.exit(p.scripts?.[process.argv[1]] ? 0 : 1)' \
    "$script_name"; then
    corepack yarn "$script_name"
  else
    echo "[backstage] optional validator is not registered in this source revision: $script_name"
  fi
}

build_backstage_application() {
  local typecheck_log bundle_log typecheck_pid bundle_pid typecheck_rc bundle_rc
  typecheck_log="$TMPDIR/typecheck.log"
  bundle_log="$TMPDIR/backend-bundle.log"
  # TypeScript validation only reads the source graph while the Backstage
  # package build writes packages/backend/dist. Running both concurrently
  # removes the typecheck duration from the critical path without weakening
  # either fail-closed gate.
  corepack yarn tsc >"$typecheck_log" 2>&1 &
  typecheck_pid="$!"
  corepack yarn build:backend >"$bundle_log" 2>&1 &
  bundle_pid="$!"
  typecheck_rc=0
  bundle_rc=0
  wait "$typecheck_pid" || typecheck_rc="$?"
  wait "$bundle_pid" || bundle_rc="$?"
  cat "$typecheck_log"
  cat "$bundle_log"
  if (( typecheck_rc != 0 || bundle_rc != 0 )); then
    echo "[backstage] concurrent application build failed: typecheck=$typecheck_rc bundle=$bundle_rc" >&2
    return 1
  fi
  echo "[backstage] TypeScript and backend bundle gates completed concurrently"
}

verify_oidc_frontend_schema_json() {
  local expected_package="$1"
  node -e '
    const fs = require("fs");
    let document;
    try {
      document = JSON.parse(fs.readFileSync(0, "utf8"));
    } catch {
      process.exit(2);
    }
    if (!Array.isArray(document.schemas)) process.exit(3);
    const matches = document.schemas.filter(schema => {
      const properties = schema?.value?.properties?.app?.properties;
      return Boolean(
        properties?.resonanceOidcEnabled ||
          properties?.resonanceOidcDisplayName,
      );
    });
    if (matches.length !== 1) process.exit(4);
    if (matches[0].packageName !== process.argv[1]) process.exit(5);
    const properties = matches[0].value.properties.app.properties;
    if (
      properties.resonanceOidcEnabled?.type !== "boolean" ||
      properties.resonanceOidcEnabled?.visibility !== "frontend" ||
      properties.resonanceOidcDisplayName?.type !== "string" ||
      properties.resonanceOidcDisplayName?.visibility !== "frontend"
    ) process.exit(6);
  ' "$expected_package"
}

verify_backstage_frontend_schema_artifacts() {
  local schema_path bundle_path expected_package
  schema_path="$APP/packages/app/dist/.config-schema.json"
  bundle_path="$APP/packages/backend/dist/bundle.tar.gz"
  expected_package="$(node -p 'require(process.argv[1]).name' "$APP/package.json")"
  [[ -n "$expected_package" ]] || return 1
  if [[ ! -f "$schema_path" || ! -f "$bundle_path" ]]; then
    echo '[backstage] OIDC frontend schema artifact is missing or invalid' >&2
    return 1
  fi
  if ! verify_oidc_frontend_schema_json "$expected_package" <"$schema_path"; then
    echo '[backstage] OIDC frontend schema artifact is missing or invalid' >&2
    return 1
  fi
  if ! tar -xOzf "$bundle_path" packages/app/dist/.config-schema.json |
      verify_oidc_frontend_schema_json "$expected_package"; then
    echo '[backstage] bundled OIDC frontend schema artifact is missing or invalid' >&2
    return 1
  fi
  echo '[backstage] OIDC frontend schema artifact PASS source=1 bundle=1 duplicates=0'
}

install_backstage_dependencies() {
  local cache_key cache_dir cache_modules cache_state cache_lock state_marker
  cache_key="$(
    {
      sha256sum "$APP/yarn.lock" "$APP/package.json" | awk '{print $1}'
      node --version
      corepack yarn --version
    } | sha256sum | awk '{print $1}'
  )"
  cache_dir="$DEPENDENCY_CACHE_ROOT/$cache_key"
  cache_modules="$cache_dir/node_modules"
  cache_state="$cache_dir/install-state.gz"
  cache_lock="$DEPENDENCY_CACHE_ROOT/.cache.lock"
  state_marker="$APP/node_modules/.resonance-immutable-cache-key"
  mkdir -p "$DEPENDENCY_CACHE_ROOT"
  exec 8>"$cache_lock"
  flock -w 300 8 || {
    echo "[backstage] dependency cache lock timed out" >&2
    return 1
  }
  if [[ -d "$APP/node_modules" &&
        -x "$APP/node_modules/.bin/backstage-cli" &&
        -x "$APP/node_modules/.bin/tsc" &&
        -f "$state_marker" &&
        "$(cat "$state_marker")" == "$cache_key" ]]; then
    echo "[backstage] dependency state matches immutable cache $cache_key; install skipped"
    flock -u 8
    return 0
  fi
  if [[ ! -d "$APP/node_modules" && -d "$cache_modules" && -f "$cache_state" ]]; then
    echo "[backstage] restoring immutable dependency tree from cache $cache_key"
    cp -al -- "$cache_modules" "$APP/node_modules"
    mkdir -p "$APP/.yarn"
    cp -a -- "$cache_state" "$APP/.yarn/install-state.gz"
    printf '%s\n' "$cache_key" >"$state_marker"
    # The key is derived from the immutable lockfile, root manifest and tool
    # versions. Re-running Yarn mutates/rebuilds an otherwise exact hard-linked
    # tree and costs 15-20 seconds on every isolated deployment.
    flock -u 8
    return 0
  fi
  if corepack yarn install --immutable; then
    printf '%s\n' "$cache_key" >"$state_marker"
    if [[ ! -d "$cache_modules" ]]; then
      local cache_tmp
      cache_tmp="$(mktemp -d "$DEPENDENCY_CACHE_ROOT/.${cache_key}.XXXXXX")"
      cp -al -- "$APP/node_modules" "$cache_tmp/node_modules"
      if [[ -f "$APP/.yarn/install-state.gz" ]]; then
        cp -a -- "$APP/.yarn/install-state.gz" "$cache_tmp/install-state.gz"
      fi
      mv -- "$cache_tmp" "$cache_dir"
      echo "[backstage] dependency cache populated $cache_key"
    fi
    flock -u 8
    return 0
  fi
  local modules_path resolved_app resolved_modules
  modules_path="$APP/node_modules"
  resolved_app="$(readlink -f "$APP")"
  resolved_modules="$(readlink -m "$modules_path")"
  case "$resolved_modules" in
    "$resolved_app"/node_modules)
      echo "[backstage] dependency link failed; rebuilding the isolated node_modules tree once" >&2
      rm -rf -- "$resolved_modules"
      corepack yarn install --immutable
      printf '%s\n' "$cache_key" >"$state_marker"
      ;;
    *)
      echo "[backstage] refusing unsafe node_modules cleanup: $resolved_modules" >&2
      return 2
      ;;
  esac
  flock -u 8
}

for command in git node corepack docker kubectl openssl curl flock sha256sum jq sync realpath; do
  require "$command"
done
docker buildx version >/dev/null 2>&1 || {
  echo "[backstage] Docker buildx is required (Ubuntu package: docker-buildx)" >&2
  exit 1
}
[[ -f "$APP/yarn.lock" && -f "$MANIFEST" ]] || {
  echo "[backstage] application or manifest is missing" >&2
  exit 2
}

BACKSTAGE_HOST="${BACKSTAGE_HOST:-backstage.172.16.1.232.nip.io}"
BACKSTAGE_PUBLIC_URL="${BACKSTAGE_PUBLIC_URL:-https://$BACKSTAGE_HOST:32947}"
BACKSTAGE_URL="${BACKSTAGE_URL:-$BACKSTAGE_PUBLIC_URL}"
RESONANCE_PREVIEW_HOST="${RESONANCE_PREVIEW_HOST:-resonance.172.16.1.232.nip.io}"
RESONANCE_PREVIEW_PUBLIC_URL="${RESONANCE_PREVIEW_PUBLIC_URL:-https://$RESONANCE_PREVIEW_HOST:32947}"
RUNTIME_PURGE_READINESS_URL="$BACKSTAGE_URL/api/resonance-projects/health/project-runtime-purge-recovery"
BACKSTAGE_MIN_CATALOG_ENTITIES="${BACKSTAGE_MIN_CATALOG_ENTITIES:-22}"
BACKSTAGE_TLS_DIR="${BACKSTAGE_TLS_DIR:-/opt/resonance-data/pki/resonance-internal-ca}"
CURL_TLS_ARGS=()
OIDC_READY=false
leader=""

apply_backstage_secret_from_values() {
  local namespace="$1" secret_name="$2" key
  shift 2
  (( $# >= 2 && $# % 2 == 0 )) || {
    echo '[backstage] secret input schema is invalid' >&2
    return 79
  }
  {
    printf '%s\0%s\0' "$namespace" "$secret_name"
    while (( $# > 0 )); do
      key="$1"
      [[ "$key" =~ ^[A-Za-z0-9._-]{1,253}$ ]] || return 79
      printf '%s\0%s\0' "$key" "$2"
      shift 2
    done
  } | node -e '
    const chunks = [];
    process.stdin.on("data", chunk => chunks.push(chunk));
    process.stdin.on("end", () => {
      const input = Buffer.concat(chunks);
      const fields = [];
      let start = 0;
      for (let index = 0; index < input.length; index += 1) {
        if (input[index] !== 0) continue;
        fields.push(input.subarray(start, index));
        start = index + 1;
      }
      if (start !== input.length || fields.length < 4 || fields.length % 2 !== 0) process.exit(79);
      const namespace = fields[0].toString("utf8");
      const name = fields[1].toString("utf8");
      if (!/^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/.test(namespace) ||
          !/^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/.test(name)) process.exit(79);
      const data = {};
      for (let index = 2; index < fields.length; index += 2) {
        const key = fields[index].toString("utf8");
        if (!/^[A-Za-z0-9._-]{1,253}$/.test(key) || Object.hasOwn(data, key)) process.exit(79);
        data[key] = fields[index + 1].toString("base64");
      }
      process.stdout.write(JSON.stringify({
        apiVersion: "v1", kind: "Secret", metadata: {namespace, name},
        type: "Opaque", data,
      }));
    });
  ' | kubectl apply -f - >/dev/null
}

find_patroni_leader() {
  local pod
  leader=""
  while IFS= read -r pod; do
    if [[ "$(kubectl -n carbonet-prod exec "$pod" -c patroni -- \
      psql -h 127.0.0.1 -U postgres -d postgres -Atqc \
      'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]]; then
      leader="$pod"
      break
    fi
  done < <(kubectl -n carbonet-prod get pods -l app=postgres-patroni -o name | sed 's#pod/##')
  [[ -n "$leader" ]] || {
    echo "[backstage] writable PostgreSQL leader not found" >&2
    return 1
  }
}

validate_oidc_configuration_values() {
  local metadata_url="$1" client_id="$2" client_secret="$3" metadata
  local -a metadata_tls_args=()
  [[ "$metadata_url" == https://* && -n "$client_id" && -n "$client_secret" ]] || {
    echo '[backstage] OIDC configuration is missing or incomplete; mutation=0' >&2
    return 79
  }
  [[ ! -s "$BACKSTAGE_TLS_DIR/ca.crt" ]] || metadata_tls_args=(--cacert "$BACKSTAGE_TLS_DIR/ca.crt")
  metadata="$(curl "${metadata_tls_args[@]}" -fsS --max-time 10 "$metadata_url" 2>/dev/null)" || {
    echo '[backstage] OIDC metadata is unavailable; mutation=0' >&2
    return 79
  }
  if ! OIDC_METADATA="$metadata" node -e '
      const value = JSON.parse(process.env.OIDC_METADATA || "{}");
      for (const key of ["issuer", "authorization_endpoint", "token_endpoint", "jwks_uri"]) {
        if (typeof value[key] !== "string" || value[key].length === 0) process.exit(1);
      }
    '; then
    echo '[backstage] OIDC metadata is invalid; mutation=0' >&2
    return 79
  fi
  OIDC_READY=true
}

validate_existing_backstage_auth_secret() {
  local secret_json session_secret metadata_url client_id client_secret display_name
  secret_json="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-auth -o json)" || {
    echo '[backstage] existing auth Secret is required; mutation=0' >&2
    return 79
  }
  jq -e --arg namespace "$NAMESPACE" '
      .kind == "Secret" and .metadata.namespace == $namespace and
      .metadata.name == "resonance-backstage-auth" and
      (.data | type == "object" and (keys | sort) ==
        ["AUTH_OIDC_CLIENT_ID","AUTH_OIDC_CLIENT_SECRET","AUTH_OIDC_DISPLAY_NAME",
         "AUTH_OIDC_METADATA_URL","AUTH_SESSION_SECRET"]) and
      all(.data[]; type == "string" and length > 0)
    ' <<<"$secret_json" >/dev/null || {
    echo '[backstage] existing auth Secret schema is invalid; mutation=0' >&2
    return 79
  }
  session_secret="$(jq -r '.data.AUTH_SESSION_SECRET' <<<"$secret_json" | base64 -d 2>/dev/null)" || return 79
  metadata_url="$(jq -r '.data.AUTH_OIDC_METADATA_URL' <<<"$secret_json" | base64 -d 2>/dev/null)" || return 79
  client_id="$(jq -r '.data.AUTH_OIDC_CLIENT_ID' <<<"$secret_json" | base64 -d 2>/dev/null)" || return 79
  client_secret="$(jq -r '.data.AUTH_OIDC_CLIENT_SECRET' <<<"$secret_json" | base64 -d 2>/dev/null)" || return 79
  display_name="$(jq -r '.data.AUTH_OIDC_DISPLAY_NAME' <<<"$secret_json" | base64 -d 2>/dev/null)" || return 79
  [[ -n "$session_secret" && -n "$display_name" ]] || {
    echo '[backstage] existing auth Secret decoded values are invalid; mutation=0' >&2
    return 79
  }
  validate_oidc_configuration_values "$metadata_url" "$client_id" "$client_secret"
}

validate_existing_runtime_purge_recovery_secret() {
  local secret_json account_id actor_ref
  secret_json="$(kubectl -n "$NAMESPACE" get secret resonance-runtime-purge-recovery -o json)" || {
    echo '[backstage] existing runtime purge recovery Secret is required; mutation=0' >&2
    return 79
  }
  jq -e --arg namespace "$NAMESPACE" '
      .kind == "Secret" and .metadata.namespace == $namespace and
      .metadata.name == "resonance-runtime-purge-recovery" and
      (.data | type == "object" and (keys | sort) ==
        ["RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID","RESONANCE_RUNTIME_PURGE_RECOVERY_ACTOR_REF"]) and
      all(.data[]; type == "string" and length > 0)
    ' <<<"$secret_json" >/dev/null || {
    echo '[backstage] runtime purge recovery Secret schema is invalid; mutation=0' >&2
    return 79
  }
  account_id="$(jq -r '.data.RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID' <<<"$secret_json" | base64 -d 2>/dev/null)" || return 79
  actor_ref="$(jq -r '.data.RESONANCE_RUNTIME_PURGE_RECOVERY_ACTOR_REF' <<<"$secret_json" | base64 -d 2>/dev/null)" || return 79
  [[ "$account_id" =~ ^[A-Za-z0-9._@-]{2,120}$ &&
     "$actor_ref" =~ ^[a-z][a-z0-9._-]*:[a-z0-9._-]+/[a-z0-9._-]+$ ]] || {
    echo '[backstage] runtime purge recovery Secret values are invalid; mutation=0' >&2
    return 79
  }
}

validate_existing_backstage_database_secret() {
  local secret_json password user
  secret_json="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-database -o json)" || {
    echo '[backstage] existing Backstage database Secret is required; credential bootstrap mutation=0' >&2
    return 79
  }
  jq -e --arg namespace "$NAMESPACE" '
      .kind == "Secret" and .metadata.namespace == $namespace and
      .metadata.name == "resonance-backstage-database" and
      (.data | type == "object" and (keys | sort) == ["POSTGRES_PASSWORD","POSTGRES_USER"]) and
      all(.data[]; type == "string" and length > 0)
    ' <<<"$secret_json" >/dev/null || {
    echo '[backstage] existing Backstage database Secret schema is invalid; mutation=0' >&2
    return 79
  }
  password="$(jq -r '.data.POSTGRES_PASSWORD' <<<"$secret_json" | base64 -d 2>/dev/null)" || return 79
  user="$(jq -r '.data.POSTGRES_USER' <<<"$secret_json" | base64 -d 2>/dev/null)" || return 79
  [[ -n "$password" && "$user" == backstage ]] || {
    echo '[backstage] existing Backstage database Secret values are invalid; mutation=0' >&2
    return 79
  }
}

validate_existing_ops_bridge_secret() {
  local source_json destination_json
  source_json="$(kubectl -n carbonet-prod get secret resonance-ops-bridge -o json)" || return 79
  destination_json="$(kubectl -n "$NAMESPACE" get secret resonance-ops-bridge -o json)" || return 79
  jq -e '
      .kind == "Secret" and .metadata.name == "resonance-ops-bridge" and
      (.data | type == "object" and (keys | sort) ==
        ["RESONANCE_OPS_TOKEN","RESONANCE_RECOVERY_WORKER_TOKEN"]) and
      all(.data[]; type == "string" and length > 0)
    ' <<<"$source_json" >/dev/null &&
  jq -e --arg namespace "$NAMESPACE" '
      .kind == "Secret" and .metadata.namespace == $namespace and
      .metadata.name == "resonance-ops-bridge" and
      (.data | type == "object" and (keys | sort) ==
        ["RESONANCE_OPS_TOKEN","RESONANCE_RECOVERY_WORKER_TOKEN"]) and
      all(.data[]; type == "string" and length > 0)
    ' <<<"$destination_json" >/dev/null &&
  [[ "$(jq -cS '.data' <<<"$source_json")" == "$(jq -cS '.data' <<<"$destination_json")" ]] || {
    echo '[backstage] ops bridge source/destination Secret mismatch; mutation=0' >&2
    return 79
  }
}

validate_existing_backstage_tls_secret() {
  local secret_json expected_cert expected_key
  [[ -s "$BACKSTAGE_TLS_DIR/ca.crt" && -s "$BACKSTAGE_TLS_DIR/tls.crt" && -s "$BACKSTAGE_TLS_DIR/tls.key" ]] || {
    echo '[backstage] protected Backstage TLS files are unavailable; mutation=0' >&2
    return 79
  }
  secret_json="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-tls -o json)" || return 79
  expected_cert="$(base64 -w0 "$BACKSTAGE_TLS_DIR/tls.crt")" || return 79
  expected_key="$(base64 -w0 "$BACKSTAGE_TLS_DIR/tls.key")" || return 79
  jq -e --arg namespace "$NAMESPACE" --arg cert "$expected_cert" --arg key "$expected_key" '
      .kind == "Secret" and .metadata.namespace == $namespace and
      .metadata.name == "resonance-backstage-tls" and
      (.data | type == "object" and (keys | sort) == ["tls.crt","tls.key"]) and
      .data["tls.crt"] == $cert and .data["tls.key"] == $key
    ' <<<"$secret_json" >/dev/null || {
    echo '[backstage] Backstage TLS Secret differs from protected files; mutation=0' >&2
    return 79
  }
  CURL_TLS_ARGS=(--cacert "$BACKSTAGE_TLS_DIR/ca.crt")
}

validate_existing_backstage_network_foundation() {
  local ingress_json preview_host
  preview_host="${RESONANCE_PREVIEW_HOST:-resonance.172.16.1.232.nip.io}"
  [[ "$BACKSTAGE_PUBLIC_URL" == "https://$BACKSTAGE_HOST:32947" &&
     "$BACKSTAGE_URL" == "$BACKSTAGE_PUBLIC_URL" &&
     "$RESONANCE_PREVIEW_PUBLIC_URL" == "https://$preview_host:32947" ]] || {
      echo '[backstage] public serving URLs must bind exact HTTPS NodePort 32947; mutation=0' >&2
      return 79
    }
  kubectl -n ingress-nginx get service ingress-nginx-controller -o json |
    jq -e '[.spec.ports[] | select(.name == "https-32947" and .port == 32947 and
      .protocol == "TCP" and .targetPort == "https" and .nodePort == 32947)] | length == 1' >/dev/null || {
      echo '[backstage] public ingress HTTPS NodePort 32947 is unavailable; mutation=0' >&2
      return 79
    }
  ingress_json="$(kubectl get ingress -A -o json)" || return 79
  jq -e --arg backstageHost "$BACKSTAGE_HOST" --arg previewHost "$preview_host" '
      [.items[] | select(any(.spec.rules[]?; .host == $backstageHost or .host == $previewHost))] as $relevant |
      ($relevant | length) == 2 and
      ([$relevant[].spec.rules[]?.host] | map(select(. == $backstageHost)) | length) == 1 and
      ([$relevant[].spec.rules[]?.host] | map(select(. == $previewHost)) | length) == 1
    ' <<<"$ingress_json" >/dev/null || {
    echo '[backstage] expected Backstage and preview Ingress resources are unavailable; mutation=0' >&2
    return 79
  }
}

ensure_auth_secret() {
  local session_secret metadata_url client_id client_secret display_name metadata
  if kubectl -n "$NAMESPACE" get secret resonance-backstage-auth >/dev/null 2>&1; then
    session_secret="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-auth \
      -o jsonpath='{.data.AUTH_SESSION_SECRET}' | base64 -d)"
    metadata_url="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-auth \
      -o jsonpath='{.data.AUTH_OIDC_METADATA_URL}' | base64 -d)"
    client_id="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-auth \
      -o jsonpath='{.data.AUTH_OIDC_CLIENT_ID}' | base64 -d)"
    client_secret="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-auth \
      -o jsonpath='{.data.AUTH_OIDC_CLIENT_SECRET}' | base64 -d)"
    display_name="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-auth \
      -o jsonpath='{.data.AUTH_OIDC_DISPLAY_NAME}' | base64 -d)"
  else
    session_secret="$(openssl rand -hex 32)"
    metadata_url=""
    client_id=""
    client_secret=""
    display_name="Resonance 계정"
  fi
  if kubectl -n "$NAMESPACE" get secret resonance-backstage-oidc-client >/dev/null 2>&1; then
    metadata_url="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-oidc-client \
      -o jsonpath='{.data.AUTH_OIDC_METADATA_URL}' | base64 -d)"
    client_id="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-oidc-client \
      -o jsonpath='{.data.AUTH_OIDC_CLIENT_ID}' | base64 -d)"
    client_secret="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-oidc-client \
      -o jsonpath='{.data.AUTH_OIDC_CLIENT_SECRET}' | base64 -d)"
    display_name="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-oidc-client \
      -o jsonpath='{.data.AUTH_OIDC_DISPLAY_NAME}' | base64 -d)"
  fi
  [[ -n "$session_secret" ]] || session_secret="$(openssl rand -hex 32)"
  apply_backstage_secret_from_values "$NAMESPACE" resonance-backstage-auth \
    AUTH_SESSION_SECRET "$session_secret" \
    AUTH_OIDC_METADATA_URL "$metadata_url" \
    AUTH_OIDC_CLIENT_ID "$client_id" \
    AUTH_OIDC_CLIENT_SECRET "$client_secret" \
    AUTH_OIDC_DISPLAY_NAME "$display_name"
  if [[ -n "$metadata_url" && -n "$client_id" && -n "$client_secret" ]]; then
    [[ "$metadata_url" == https://* ]] || {
      echo "[backstage] OIDC metadata URL must use HTTPS; guarded guest bootstrap remains enabled" >&2
      return 0
    }
    metadata="$(curl "${CURL_TLS_ARGS[@]}" -fsS --max-time 10 \
      "$metadata_url" 2>/dev/null || true)"
    if OIDC_METADATA="$metadata" node -e '
      const value = JSON.parse(process.env.OIDC_METADATA || "{}");
      for (const key of ["issuer", "authorization_endpoint", "token_endpoint", "jwks_uri"]) {
        if (typeof value[key] !== "string" || value[key].length === 0) process.exit(1);
      }
    '; then
      OIDC_READY=true
      echo "[backstage] OIDC configuration and metadata are valid; guest access will be disabled"
    else
      echo "[backstage] OIDC metadata is unreachable or incomplete; guarded guest bootstrap remains enabled" >&2
    fi
  else
    echo "[backstage] OIDC configuration is pending; guarded guest bootstrap remains enabled"
  fi
}

ensure_runtime_purge_recovery_secret() {
  local secret_name="resonance-runtime-purge-recovery"
  local bootstrap_secret_name="resonance-keycloak-integrated-admin"
  local default_actor_ref="service:default/project-runtime-purge-recovery"
  local account_id="" actor_ref="" secret_snapshot="" object_name=""
  local account_base64="" actor_base64="" bootstrap_snapshot=""
  if ! secret_snapshot="$(kubectl -n "$NAMESPACE" get secret "$secret_name" \
      --ignore-not-found -o jsonpath='{.metadata.name}{"|"}{.data.RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID}{"|"}{.data.RESONANCE_RUNTIME_PURGE_RECOVERY_ACTOR_REF}')"; then
    echo "[backstage] runtime purge recovery secret lookup failed" >&2
    return 1
  fi
  if [[ -n "$secret_snapshot" ]]; then
    IFS='|' read -r object_name account_base64 actor_base64 <<<"$secret_snapshot"
    [[ "$object_name" == "$secret_name" ]] || {
      echo "[backstage] runtime purge recovery secret lookup failed" >&2
      return 1
    }
    account_id="$(printf '%s' "$account_base64" | base64 -d 2>/dev/null || true)"
    actor_ref="$(printf '%s' "$actor_base64" | base64 -d 2>/dev/null || true)"
  elif [[ -v RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID ]]; then
    # An explicit operator binding outranks bootstrap discovery, including an
    # explicitly empty value, which must fail closed instead of escalating to
    # another account implicitly.
    account_id="$RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID"
    actor_ref="${RESONANCE_RUNTIME_PURGE_RECOVERY_ACTOR_REF:-$default_actor_ref}"
  else
    if ! bootstrap_snapshot="$(kubectl -n "$NAMESPACE" get secret "$bootstrap_secret_name" \
        --ignore-not-found -o jsonpath='{.metadata.name}{"|"}{.data.USERNAME}')"; then
      echo "[backstage] runtime purge recovery bootstrap lookup failed" >&2
      return 1
    fi
    IFS='|' read -r object_name account_base64 <<<"$bootstrap_snapshot"
    if [[ -n "$object_name" && "$object_name" != "$bootstrap_secret_name" ]]; then
      echo "[backstage] runtime purge recovery bootstrap lookup failed" >&2
      return 1
    fi
    # The account identifier is not a credential. Bootstrap it only from the
    # already integrated administrator's USERNAME key; password material is
    # neither read nor copied into the recovery identity Secret.
    account_id="$(printf '%s' "$account_base64" | base64 -d 2>/dev/null || true)"
    actor_ref="$default_actor_ref"
  fi
  [[ "$account_id" =~ ^[A-Za-z0-9._@-]{2,120}$ ]] || {
    echo "[backstage] runtime purge recovery account secret is required" >&2
    return 1
  }
  [[ "$actor_ref" =~ ^[a-z][a-z0-9._-]*:[a-z0-9._-]+/[a-z0-9._-]+$ ]] || {
    echo "[backstage] runtime purge recovery actor ref is invalid" >&2
    return 1
  }
  apply_backstage_secret_from_values "$NAMESPACE" "$secret_name" \
    RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID "$account_id" \
    RESONANCE_RUNTIME_PURGE_RECOVERY_ACTOR_REF "$actor_ref"
}

configure_auth_mode() {
  local args guest_rbac
  if [[ "$OIDC_READY" == "true" ]]; then
    args='["node","packages/backend","--config","app-config.yaml","--config","app-config.production.yaml","--config","app-config.oidc.yaml"]'
    guest_rbac=false
  else
    args='["node","packages/backend","--config","app-config.yaml","--config","app-config.production.yaml"]'
    guest_rbac=true
  fi
  kubectl -n "$NAMESPACE" patch deployment resonance-backstage --type=strategic \
    -p="{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"backstage\",\"args\":$args,\"env\":[{\"name\":\"RESONANCE_ALLOW_GUEST_DESIGN_RBAC\",\"value\":\"$guest_rbac\"}]}]}}}}"
}

ensure_tls() {
  mkdir -p "$BACKSTAGE_TLS_DIR"
  chmod 700 "$BACKSTAGE_TLS_DIR"
  if [[ ! -s "$BACKSTAGE_TLS_DIR/ca.crt" ||
        ! -s "$BACKSTAGE_TLS_DIR/tls.crt" ||
        ! -s "$BACKSTAGE_TLS_DIR/tls.key" ]]; then
    openssl req -x509 -newkey rsa:3072 -sha256 -nodes \
      -keyout "$BACKSTAGE_TLS_DIR/ca.key" \
      -out "$BACKSTAGE_TLS_DIR/ca.crt" \
      -days 3650 -subj '/CN=Resonance Internal Root CA'
    openssl req -newkey rsa:3072 -sha256 -nodes \
      -keyout "$BACKSTAGE_TLS_DIR/tls.key" \
      -out "$BACKSTAGE_TLS_DIR/tls.csr" \
      -subj "/CN=$BACKSTAGE_HOST" \
      -addext "subjectAltName=DNS:$BACKSTAGE_HOST"
    openssl x509 -req -sha256 \
      -in "$BACKSTAGE_TLS_DIR/tls.csr" \
      -CA "$BACKSTAGE_TLS_DIR/ca.crt" \
      -CAkey "$BACKSTAGE_TLS_DIR/ca.key" \
      -CAcreateserial \
      -out "$BACKSTAGE_TLS_DIR/tls.crt" \
      -days 825 -copy_extensions copy
    chmod 600 "$BACKSTAGE_TLS_DIR/ca.key" "$BACKSTAGE_TLS_DIR/tls.key"
  fi
  kubectl -n "$NAMESPACE" create secret tls resonance-backstage-tls \
    --cert="$BACKSTAGE_TLS_DIR/tls.crt" \
    --key="$BACKSTAGE_TLS_DIR/tls.key" \
    --dry-run=client -o yaml | kubectl apply -f -
  CURL_TLS_ARGS=(--cacert "$BACKSTAGE_TLS_DIR/ca.crt")
}

ensure_ingress_https_port() {
  local index current
  index="$(kubectl -n ingress-nginx get service ingress-nginx-controller -o json |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);process.stdout.write(String(v.spec.ports.findIndex(p=>p.name==="https")))})')"
  [[ "$index" =~ ^[0-9]+$ ]] || {
    echo "[backstage] ingress HTTPS service port was not found" >&2
    return 1
  }
  current="$(kubectl -n ingress-nginx get service ingress-nginx-controller \
    -o "jsonpath={.spec.ports[$index].nodePort}")"
  if [[ "$current" != "443" ]]; then
    kubectl -n ingress-nginx patch service ingress-nginx-controller \
      --type=json \
      -p="[{\"op\":\"replace\",\"path\":\"/spec/ports/$index/nodePort\",\"value\":443}]"
  fi
}

ensure_runtime_preview_https() {
  local preview_host preview_tls_dir
  preview_host="${RESONANCE_PREVIEW_HOST:-resonance.172.16.1.232.nip.io}"
  preview_tls_dir="${RESONANCE_PREVIEW_TLS_DIR:-$HOME/.config/resonance/runtime-preview-tls}"
  mkdir -p "$preview_tls_dir"
  chmod 700 "$preview_tls_dir"
  if [[ ! -s "$preview_tls_dir/tls.crt" ||
        ! -s "$preview_tls_dir/tls.key" ]] ||
    ! openssl x509 -in "$preview_tls_dir/tls.crt" -noout -checkend 604800 >/dev/null 2>&1 ||
    ! openssl x509 -in "$preview_tls_dir/tls.crt" -noout -ext subjectAltName 2>/dev/null | grep -q "DNS:$preview_host"; then
    openssl req -newkey rsa:3072 -sha256 -nodes \
      -keyout "$preview_tls_dir/tls.key" \
      -out "$preview_tls_dir/tls.csr" \
      -subj "/CN=$preview_host" \
      -addext "subjectAltName=DNS:$preview_host"
    openssl x509 -req -sha256 \
      -in "$preview_tls_dir/tls.csr" \
      -CA "$BACKSTAGE_TLS_DIR/ca.crt" \
      -CAkey "$BACKSTAGE_TLS_DIR/ca.key" \
      -CAcreateserial \
      -out "$preview_tls_dir/tls.crt" \
      -days 825 -copy_extensions copy
    chmod 600 "$preview_tls_dir/tls.key"
  fi
  kubectl -n carbonet-prod create secret tls resonance-preview-tls \
    --cert="$preview_tls_dir/tls.crt" --key="$preview_tls_dir/tls.key" \
    --dry-run=client -o yaml | kubectl apply -f -
  cat <<YAML | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: resonance-preview
  namespace: carbonet-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts: [$preview_host]
      secretName: resonance-preview-tls
  rules:
    - host: $preview_host
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: carbonet-web
                port:
                  number: 80
YAML
}

wait_for_runtime() {
  local attempt
  for attempt in $(seq 1 30); do
    if curl "${CURL_TLS_ARGS[@]}" -fsS --max-time 10 \
      "$RUNTIME_PURGE_READINESS_URL" >/dev/null; then
      return 0
    fi
    sleep 0.5
  done
  echo "[backstage] readiness did not converge at $BACKSTAGE_URL" >&2
  return 1
}

verify_frontend_auth_runtime_config() {
  local expected_oidc="$OIDC_READY" attempt html
  local retrieval_succeeded=false
  for attempt in 1 2 3; do
    if html="$(curl "${CURL_TLS_ARGS[@]}" -fsS --max-time 10 "$BACKSTAGE_URL/")"; then
      retrieval_succeeded=true
      if printf '%s' "$html" |
          EXPECTED_OIDC="$expected_oidc" node -e '
            let html = "";
            process.stdin.setEncoding("utf8");
            process.stdin.on("data", chunk => { html += chunk; });
            process.stdin.on("end", () => {
              const scripts = Array.from(
                html.matchAll(
                  /<script\b[^>]*\btype=["\x27]backstage\.io\/config["\x27][^>]*>([\s\S]*?)<\/script>/gi,
                ),
              );
              if (scripts.length === 0) process.exit(2);
              const configs = [];
              for (const script of scripts) {
                let document;
                try {
                  document = JSON.parse(script[1]);
                } catch {
                  process.exit(3);
                }
                if (!Array.isArray(document)) process.exit(4);
                configs.push(...document);
              }
              let enabled;
              let displayName;
              for (const entry of configs) {
                if (
                  !entry ||
                  typeof entry !== "object" ||
                  !entry.data ||
                  typeof entry.data !== "object" ||
                  Array.isArray(entry.data)
                ) process.exit(5);
                const app = entry.data.app;
                if (app === undefined) continue;
                if (!app || typeof app !== "object" || Array.isArray(app)) {
                  process.exit(6);
                }
                if (Object.prototype.hasOwnProperty.call(app, "resonanceOidcEnabled")) {
                  enabled = app.resonanceOidcEnabled;
                }
                if (Object.prototype.hasOwnProperty.call(app, "resonanceOidcDisplayName")) {
                  displayName = app.resonanceOidcDisplayName;
                }
              }
              const expected = process.env.EXPECTED_OIDC === "true";
              if (expected) {
                if (
                  enabled !== true ||
                  typeof displayName !== "string" ||
                  displayName.trim().length === 0
                ) process.exit(7);
              } else if (enabled === true) {
                process.exit(8);
              }
            });
          '; then
        echo "[backstage] frontend auth runtime config PASS oidc=$expected_oidc attempt=$attempt"
        return 0
      fi
    fi
    (( attempt < 3 )) && sleep "$attempt"
  done
  if [[ "$retrieval_succeeded" != "true" ]]; then
    echo '[backstage] frontend runtime config lookup failed' >&2
  else
    echo '[backstage] frontend OIDC runtime config is missing or inconsistent' >&2
  fi
  return 1
}

wait_for_catalog() {
  local attempt identity token count
  for attempt in $(seq 1 30); do
    identity="$(curl "${CURL_TLS_ARGS[@]}" -fsS --max-time 10 -X POST \
      -H 'content-type: application/json' -d '{}' \
      "$BACKSTAGE_URL/api/auth/guest/refresh" 2>/dev/null || true)"
    token="$(IDENTITY_JSON="$identity" node -e \
      'try { process.stdout.write(JSON.parse(process.env.IDENTITY_JSON).backstageIdentity.token || "") } catch {}')"
    if [[ -n "$token" ]]; then
      count="$(curl "${CURL_TLS_ARGS[@]}" -fsS --max-time 10 \
        -H "authorization: Bearer $token" \
        "$BACKSTAGE_URL/api/catalog/entities" 2>/dev/null |
        node -e \
          'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const v=JSON.parse(s);process.stdout.write(String(Array.isArray(v)?v.length:0))}catch{process.stdout.write("0")}})' ||
        true)"
      if [[ "$count" =~ ^[0-9]+$ ]] &&
        (( count >= BACKSTAGE_MIN_CATALOG_ENTITIES )); then
        echo "[backstage] catalog ready: $count entities"
        return 0
      fi
    fi
    sleep 0.5
  done
  echo "[backstage] catalog did not reach $BACKSTAGE_MIN_CATALOG_ENTITIES entities" >&2
  return 1
}

wait_for_catalog_database() {
  local attempt count
  for attempt in $(seq 1 30); do
    count="$(kubectl -n carbonet-prod exec "$leader" -c patroni -- \
      psql -h 127.0.0.1 -U postgres -d backstage_plugin_catalog -Atqc \
      'select count(*) from final_entities' 2>/dev/null || true)"
    if [[ "$count" =~ ^[0-9]+$ ]] &&
      (( count >= BACKSTAGE_MIN_CATALOG_ENTITIES )); then
      echo "[backstage] catalog ready in database: $count entities"
      return 0
    fi
    sleep 0.5
  done
  echo "[backstage] catalog database did not reach $BACKSTAGE_MIN_CATALOG_ENTITIES entities" >&2
  return 1
}

update_backstage_database_role_password() {
  local patroni_leader="$1" role_exists="$2" password="$3"
  local state_dir output_tmp="" output_fd output_read_fd sql_password auth_output
  [[ -n "$password" ]] || {
    echo '[backstage] DATABASE_ROLE_PASSWORD_UPDATE_FAILED' >&2
    return 79
  }
  [[ "$role_exists" == 1 || -z "$role_exists" ]] || {
    echo '[backstage] DATABASE_ROLE_PASSWORD_UPDATE_FAILED' >&2
    return 79
  }
  # Credential rotation is a separate durable workflow. A normal release must
  # never alter the password beneath already-ready Pods before rollback state
  # exists. The existing role and Secret remain byte-for-byte authoritative,
  # but a fresh login using those exact Secret bytes must succeed.
  prepare_backstage_rollback_state_directory || return 79
  state_dir="$(dirname -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE")"
  output_tmp="$(umask 077 && mktemp "$state_dir/.database-role-update.XXXXXXXX")" || {
    echo '[backstage] DATABASE_ROLE_PASSWORD_UPDATE_FAILED' >&2
    return 79
  }
  chmod 0600 -- "$output_tmp" || {
    rm -f -- "$output_tmp"
    echo '[backstage] DATABASE_ROLE_PASSWORD_UPDATE_FAILED' >&2
    return 79
  }
  exec {output_fd}<>"$output_tmp" || {
    rm -f -- "$output_tmp"
    echo '[backstage] DATABASE_ROLE_PASSWORD_UPDATE_FAILED' >&2
    return 79
  }
  exec {output_read_fd}<"$output_tmp" || {
    exec {output_fd}>&-
    rm -f -- "$output_tmp"
    echo '[backstage] DATABASE_ROLE_PASSWORD_UPDATE_FAILED' >&2
    return 79
  }
  # Unlink before psql runs: even SIGKILL leaves no pathname containing raw
  # server diagnostics. The open mode-0600 FD is never copied to stdout/stderr.
  rm -f -- "$output_tmp" || {
    exec {output_fd}>&-
    exec {output_read_fd}>&-
    echo '[backstage] DATABASE_ROLE_PASSWORD_UPDATE_FAILED' >&2
    return 79
  }
  sync -f "$state_dir" 2>/dev/null || sync "$state_dir" 2>/dev/null || {
    exec {output_fd}>&-
    exec {output_read_fd}>&-
    echo '[backstage] DATABASE_ROLE_PASSWORD_UPDATE_FAILED' >&2
    return 79
  }
  if [[ "$role_exists" == 1 ]]; then
    if ! printf '%s' "$password" |
        kubectl -n carbonet-prod exec -i "$patroni_leader" -c patroni -- \
          python3 -c '
import os, sys
password = sys.stdin.buffer.read().decode("utf-8")
env = os.environ.copy()
env["PGPASSWORD"] = password
os.execvpe("psql", ["psql", "-h", "127.0.0.1", "-U", "backstage", "-d", "postgres", "-Atqc", "select 1"], env)
' >&"$output_fd" 2>&1; then
      exec {output_fd}>&-
      exec {output_read_fd}>&-
      echo '[backstage] DATABASE_ROLE_PASSWORD_UPDATE_FAILED' >&2
      return 79
    fi
    exec {output_fd}>&-
    auth_output="$(cat <&"$output_read_fd")"
    exec {output_read_fd}>&-
    [[ "$auth_output" == 1 ]] || {
      echo '[backstage] DATABASE_ROLE_PASSWORD_UPDATE_FAILED' >&2
      return 79
    }
    return 0
  fi
  sql_password="${password//\'/\'\'}"
  if ! printf 'create role backstage login createdb password '\''%s'\'';\n' \
      "$sql_password" |
      kubectl -n carbonet-prod exec -i "$patroni_leader" -c patroni -- \
        psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 \
        --set=VERBOSITY=terse >&"$output_fd" 2>&1; then
    exec {output_fd}>&-
    exec {output_read_fd}>&-
    echo '[backstage] DATABASE_ROLE_PASSWORD_UPDATE_FAILED' >&2
    return 79
  fi
  exec {output_fd}>&-
  exec {output_read_fd}>&-
}

verify_existing_backstage_database_secret_precondition() {
  kubectl -n "$NAMESPACE" get deployment "$BACKSTAGE_DEPLOYMENT_NAME" -o json >/dev/null 2>&1 || {
    echo '[backstage] existing Backstage Deployment is required; explicit bootstrap is not supported' >&2
    return 79
  }
  validate_existing_backstage_database_secret || return 79
  validate_existing_backstage_auth_secret || return 79
  validate_existing_runtime_purge_recovery_secret || return 79
  validate_existing_ops_bridge_secret || return 79
  validate_existing_backstage_tls_secret || return 79
  validate_existing_backstage_network_foundation || return 79
}

case "$mode" in
  configure-oidc)
    acquire_backstage_deployment_lock || exit 79
    reject_active_backstage_parent_authority_binding || exit 79
    if backstage_pending_state_exists || backstage_repair_authority_exists; then
      echo '[backstage] configure-oidc requires pending=0 repairAuthority=0; mutation=0' >&2
      exit 79
    fi
    : "${AUTH_OIDC_METADATA_URL:?set AUTH_OIDC_METADATA_URL}"
    : "${AUTH_OIDC_CLIENT_ID:?set AUTH_OIDC_CLIENT_ID}"
    : "${AUTH_OIDC_CLIENT_SECRET:?set AUTH_OIDC_CLIENT_SECRET}"
    [[ "$AUTH_OIDC_METADATA_URL" == https://* ]] || {
      echo "[backstage] AUTH_OIDC_METADATA_URL must use HTTPS" >&2
      exit 2
    }
    validate_oidc_configuration_values \
      "$AUTH_OIDC_METADATA_URL" "$AUTH_OIDC_CLIENT_ID" "$AUTH_OIDC_CLIENT_SECRET" || exit 79
    if kubectl -n "$NAMESPACE" get secret resonance-backstage-auth >/dev/null 2>&1; then
      session_secret="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-auth \
        -o jsonpath='{.data.AUTH_SESSION_SECRET}' | base64 -d)"
    else
      session_secret="$(openssl rand -hex 32)"
    fi
    apply_backstage_secret_from_values "$NAMESPACE" resonance-backstage-auth \
      AUTH_SESSION_SECRET "$session_secret" \
      AUTH_OIDC_METADATA_URL "$AUTH_OIDC_METADATA_URL" \
      AUTH_OIDC_CLIENT_ID "$AUTH_OIDC_CLIENT_ID" \
      AUTH_OIDC_CLIENT_SECRET "$AUTH_OIDC_CLIENT_SECRET" \
      AUTH_OIDC_DISPLAY_NAME "${AUTH_OIDC_DISPLAY_NAME:-Resonance 계정}"
    echo "[backstage] OIDC secret updated without exposing credentials; run deploy to validate and activate"
    ;;
  validate)
    bash "$ROOT/ops/scripts/resonance-control-plane.sh" validate
    (
      cd "$APP"
      install_backstage_dependencies
      corepack yarn tsc
    )
    echo "[backstage] PASS configuration and TypeScript contracts are valid"
    ;;
  deploy)
    # A SIGKILL can bypass EXIT traps. Reconcile its authenticated pending
    # baseline before preflight secret/config mutation or any application build.
    acquire_backstage_deployment_lock || exit 79
    reject_active_backstage_parent_authority_binding || exit 79
    bind_backstage_deployment_identity || exit 79
    if [[ "$BACKSTAGE_DEPLOYMENT_FINALIZE_MODE" == "deferred" ]] && backstage_pending_state_exists; then
      echo '[backstage] deferred deploy requires reconcile-pending before a new mutation; mutation=0' >&2
      exit 79
    fi
    resume_or_finalize_pending_backstage_deployment || exit 79
    verify_existing_backstage_database_secret_precondition || exit 79
    initialize_backstage_build_workspace
    start_phase preflight
    bash "$ROOT/ops/scripts/resonance-control-plane.sh" validate
    # Exercise the complete API admission chain before dependency installation,
    # image construction, secret mutation, or rollout. The independent nightly
    # job retains the full 16-route visual regression.
    bash "$ROOT/ops/scripts/resonance-kubernetes-admission-preflight.sh" "$NAMESPACE"
    # Existing-release deploy is read-only until the authenticated rollback
    # baseline is durable. Foundation rotation/bootstrap uses explicit modes.
    finish_phase preflight
    # Tag only production runtime inputs. E2E specifications and documentation
    # still run their own gates but cannot invalidate an identical image.
    runtime_fingerprint="$(calculate_target_backstage_runtime_fingerprint \
      "$BACKSTAGE_DEPLOYMENT_TARGET_COMMIT")"
    is_valid_backstage_runtime_fingerprint "$runtime_fingerprint" || {
      echo '[backstage] runtime fingerprint generation failed' >&2
      exit 79
    }
    tag="${runtime_fingerprint:0:12}"
    tagged_image="$IMAGE_REPOSITORY:$tag"
    [[ "$BACKSTAGE_DEPLOYMENT_RUNTIME_FINGERPRINT" == "$runtime_fingerprint" ]] || exit 79
    deployment_closure_sha256="$(calculate_target_backstage_deployment_closure \
      "$BACKSTAGE_DEPLOYMENT_TARGET_COMMIT" "$runtime_fingerprint")" || {
      echo '[backstage] deployment closure generation failed' >&2
      exit 79
    }
    [[ "$deployment_closure_sha256" =~ ^[0-9a-f]{64}$ ]] || exit 79
    [[ "$BACKSTAGE_DEPLOYMENT_CLOSURE_SHA256" == "$deployment_closure_sha256" ]] || exit 79
    # Resolve and prove the exact bytes behind any mutable live baseline tag
    # before a candidate build can push anything. Rollback later pins this
    # digest, so imagePullPolicy=Always cannot change the restored bytes.
    prepare_backstage_live_baseline_image_resolution || exit 79

    # Registry-first reuse is authenticated by an image-input fingerprint OCI
    # label and resolved to the immutable digest pulled from that registry.
    # When the live Deployment already names this tag/digest, its Ready Pod
    # imageIDs must also prove the same digest before a no-build reuse.
    image_reuse_status=1
    if resolve_verified_backstage_live_digest_image "$runtime_fingerprint"; then
      BACKSTAGE_DEPLOYMENT_CANDIDATE_TAGGED_IMAGE="$BACKSTAGE_PREBUILD_BASELINE_IMAGE"
      image_reuse_status=0
    else
      image_reuse_status="$?"
    fi
    (( image_reuse_status == 0 || image_reuse_status == 1 )) || exit 79
    if (( image_reuse_status == 1 )); then
      if resolve_verified_backstage_registry_image "$tagged_image" "$runtime_fingerprint"; then
        BACKSTAGE_DEPLOYMENT_CANDIDATE_TAGGED_IMAGE="$tagged_image"
        image_reuse_status=0
        echo "[backstage] reusing registry-proved immutable application image: $BACKSTAGE_RESOLVED_CANDIDATE_IMAGE"
      else
        registry_reuse_status="$?"
        (( registry_reuse_status == 1 )) || exit 79
      fi
    fi
    if (( image_reuse_status == 1 )); then
      staging_image="$IMAGE_REPOSITORY:${tag}-${BACKSTAGE_DEPLOYMENT_ATTEMPT_ID}"
      BACKSTAGE_DEPLOYMENT_CANDIDATE_TAGGED_IMAGE="$staging_image"
      start_phase application-build
      (
        cd "$APP"
        install_backstage_dependencies
        run_yarn_script_if_defined validate:page-extensions
        run_yarn_script_if_defined generate:ccus-screen-designs
        run_yarn_script_if_defined validate:control-assets
        run_yarn_script_if_defined validate:actor-process-control
        run_yarn_script_if_defined validate:design-release-bridge
        run_yarn_script_if_defined generate:project-registry
        build_backstage_application
        verify_backstage_frontend_schema_artifacts
      )
      finish_phase application-build
      start_phase image-build
      # Do not exit awk early: with pipefail, closing the pipe can make buildx
      # report SIGPIPE (255) and abort a healthy deployment.
      buildx_driver="$(docker buildx inspect 2>/dev/null | awk '/^Driver:/ {print $2}')"
      if [[ "$buildx_driver" == "docker" || -z "$buildx_driver" ]]; then
        # The Docker driver keeps a daemon-local incremental layer cache but
        # cannot export type=local caches. Selecting by capability prevents a
        # cache optimization from breaking an otherwise healthy rollout.
        DOCKER_BUILDKIT=1 docker build \
          --label "io.resonance.backstage.runtime-fingerprint=$runtime_fingerprint" \
          -t "$staging_image" \
          -f "$APP/packages/backend/Dockerfile" \
          "$APP"
      else
        build_cache_args=()
        mkdir -p "$(dirname "$BUILDKIT_CACHE_ROOT")"
        if [[ -s "$BUILDKIT_CACHE_ROOT/index.json" ]]; then
          build_cache_args+=(--cache-from "type=local,src=$BUILDKIT_CACHE_ROOT")
        fi
        rm -rf -- "$BUILDKIT_CACHE_ROOT.next"
        docker buildx build \
          --load \
          "${build_cache_args[@]}" \
          --cache-to "type=local,dest=$BUILDKIT_CACHE_ROOT.next,mode=max" \
          --label "io.resonance.backstage.runtime-fingerprint=$runtime_fingerprint" \
          -t "$staging_image" \
          -f "$APP/packages/backend/Dockerfile" \
          "$APP"
        rm -rf -- "$BUILDKIT_CACHE_ROOT.previous"
        if [[ -d "$BUILDKIT_CACHE_ROOT" ]]; then
          mv -- "$BUILDKIT_CACHE_ROOT" "$BUILDKIT_CACHE_ROOT.previous"
        fi
        mv -- "$BUILDKIT_CACHE_ROOT.next" "$BUILDKIT_CACHE_ROOT"
        rm -rf -- "$BUILDKIT_CACHE_ROOT.previous"
      fi
      finish_phase image-build
      start_phase image-push
      docker push "$staging_image"
      finish_phase image-push
      inspect_backstage_image_runtime_binding "$staging_image" "$runtime_fingerprint" || {
        echo '[backstage] pushed application image lacks exact OCI fingerprint or registry digest proof' >&2
        exit 79
      }
      echo "[backstage] attempt-scoped staging image retained for digest availability and registry retention GC: $staging_image"
    elif (( image_reuse_status != 0 )); then
      exit 79
    fi
    image="$BACKSTAGE_RESOLVED_CANDIDATE_IMAGE"
    is_digest_pinned_backstage_candidate_image "$image" || exit 79
    BACKSTAGE_DEPLOYMENT_CANDIDATE_IMAGE="$image"

    start_phase runtime-config
    find_patroni_leader

    password="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-database \
      -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)" || exit 79
    [[ -n "$password" ]] || {
      echo '[backstage] existing Backstage database Secret password is empty; mutation=0' >&2
      exit 79
    }
    role_exists="$(kubectl -n carbonet-prod exec "$leader" -c patroni -- \
      psql -h 127.0.0.1 -U postgres -d postgres -Atqc \
      "select 1 from pg_roles where rolname='backstage'")"
    update_backstage_database_role_password "$leader" "$role_exists" "$password" || exit 79
    database_exists="$(kubectl -n carbonet-prod exec "$leader" -c patroni -- \
      psql -h 127.0.0.1 -U postgres -d postgres -Atqc \
      "select 1 from pg_database where datname='backstage'")"
    if [[ "$database_exists" != "1" ]]; then
      kubectl -n carbonet-prod exec "$leader" -c patroni -- \
        psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 \
        -c "create database backstage owner backstage"
    fi

    # Database and bridge Secret bytes were proved before build. A release does
    # not rotate or re-apply foundation credentials before rollback state.
    # Publish the exact pre-mutation Deployment spec/UID durably and atomically.
    # The following manifest apply is the first resonance-backstage Deployment
    # mutation in this deploy path.
    capture_backstage_deployment_baseline || exit 79
    arm_backstage_deployment_mutations || exit 79
    live_mutation_started_epoch="$(date +%s)"
    apply_exact_target_backstage_resources || exit 79
    # The image, auth mode and target catalog digest are rendered into one
    # exact desired spec. A durable planned-spec checkpoint precedes the one
    # UID/resourceVersion/spec-bound Deployment JSON-Patch CAS.
    catalog_digest="$(calculate_target_backstage_catalog_digest \
      "$BACKSTAGE_DEPLOYMENT_TARGET_COMMIT")" || exit 79
    [[ "$catalog_digest" =~ ^[0-9a-f]{64}$ ]] || exit 79
    converge_exact_backstage_deployment_spec "$catalog_digest" || exit 79
    capture_backstage_deployment_candidate || exit 79
    live_mutation_candidate_seconds="$(( $(date +%s) - live_mutation_started_epoch ))"
    if (( live_mutation_candidate_seconds >= 60 )); then
      echo "[backstage] WARN liveMutationSeconds=$live_mutation_candidate_seconds targetUnder60=false phase=candidate-ready" >&2
    fi
    finish_phase runtime-config
    start_phase rollout-readiness
    kubectl -n "$NAMESPACE" rollout status deployment/resonance-backstage --timeout=600s
    wait_for_runtime
    verify_frontend_auth_runtime_config
    if [[ "$OIDC_READY" == "true" ]]; then
      wait_for_catalog_database
    else
      wait_for_catalog
    fi
    finalize_successful_backstage_deployment || exit 79
    live_mutation_seconds="$(( $(date +%s) - live_mutation_started_epoch ))"
    echo "[backstage] liveMutationSeconds=$live_mutation_seconds targetUnder60=$(( live_mutation_seconds < 60 ? 1 : 0 ))"
    finish_phase rollout-readiness
    echo "[backstage][timing] total seconds=$(( $(date +%s) - deploy_started_at )) target=60"
    echo "[backstage] PASS deployed $image at $BACKSTAGE_URL"
    ;;
  status)
    verify_existing_backstage_database_secret_precondition || exit 79
    kubectl -n "$NAMESPACE" get deployment,pod,service -l app.kubernetes.io/name=resonance-backstage -o wide
    curl "${CURL_TLS_ARGS[@]}" -fsS --max-time 10 "$RUNTIME_PURGE_READINESS_URL"
    echo
    if [[ "$OIDC_READY" == "true" ]]; then
      find_patroni_leader
      wait_for_catalog_database
    else
      wait_for_catalog
    fi
    ;;
  *)
    echo "usage: $0 {configure-oidc|validate|deploy|status|recover-pending|finalize-pending <exactTarget>|reconcile-pending <authoritativeCommit>|verify-runtime-identity <targetCommit>|reconcile-repair-authority|reconcile-parent-authority-binding <targetCommit>}" >&2
    exit 64
    ;;
esac
