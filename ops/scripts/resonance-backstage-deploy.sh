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
BACKSTAGE_DEPLOYMENT_NAME="resonance-backstage"
BACKSTAGE_DEPLOYMENT_LOCK_FD=""
BACKSTAGE_DEPLOYMENT_LOCK_HELD=false
BACKSTAGE_DEPLOY_ROLLBACK_ARMED=false
BACKSTAGE_DEPLOY_COMPLETED=false
BACKSTAGE_PENDING_STATE_JSON=""
BACKSTAGE_BASELINE_UID=""
BACKSTAGE_BASELINE_RESOURCE_VERSION=""
BACKSTAGE_BASELINE_SPEC=""

backstage_rollback_fail() {
  echo "[backstage] deployment rollback state failure: $1" >&2
  return 1
}

prepare_backstage_rollback_state_directory() {
  local state_dir logical_dir physical_dir expected_owner
  state_dir="$(dirname -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE")"
  expected_owner="$(id -u)"
  if [[ -L "$state_dir" ]]; then
    backstage_rollback_fail "state directory is a symlink"
    return 1
  fi
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
  logical_dir="$(readlink -m -- "$state_dir" 2>/dev/null || true)"
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

load_backstage_pending_state() {
  local state_before state_after state_payload expected_integrity actual_integrity
  prepare_backstage_rollback_state_directory || return 1
  verify_backstage_pending_state_file_security || return 1
  state_before="$(stat -c '%d:%i:%s:%Y' -- "$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE" 2>/dev/null || true)"
  BACKSTAGE_PENDING_STATE_JSON="$(<"$BACKSTAGE_DEPLOYMENT_ROLLBACK_PENDING_FILE")" || {
    backstage_rollback_fail "pending state cannot be read"
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
        type == "object" and
        (keys | sort) == ["baseline","deploymentName","integritySha256","kind","namespace","schemaVersion"] and
        .schemaVersion == 1 and
        .kind == "BackstageDeploymentRollbackPending" and
        .namespace == $namespace and
        .deploymentName == $deployment and
        (.integritySha256 | type == "string" and test("^[0-9a-f]{64}$")) and
        (.baseline | type == "object") and
        (.baseline | keys | sort) == ["resourceVersion","spec","uid"] and
        (.baseline.uid | type == "string" and length > 0 and length <= 253) and
        (.baseline.resourceVersion | type == "string" and length > 0 and length <= 253) and
        (.baseline.spec | type == "object")
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
  BACKSTAGE_BASELINE_UID="$(jq -r '.baseline.uid' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
  BACKSTAGE_BASELINE_RESOURCE_VERSION="$(jq -r '.baseline.resourceVersion' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
  BACKSTAGE_BASELINE_SPEC="$(jq -cS '.baseline.spec' <<<"$BACKSTAGE_PENDING_STATE_JSON")" || return 1
}

capture_backstage_deployment_baseline() {
  local deployment_json state_payload state_json integrity state_dir state_tmp=""
  prepare_backstage_rollback_state_directory || return 1
  if backstage_pending_state_exists; then
    backstage_rollback_fail "pending state already exists"
    return 1
  fi
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
  state_payload="$(jq -cS \
    --arg namespace "$NAMESPACE" \
    --arg deployment "$BACKSTAGE_DEPLOYMENT_NAME" '
      {
        schemaVersion: 1,
        kind: "BackstageDeploymentRollbackPending",
        namespace: $namespace,
        deploymentName: $deployment,
        baseline: {
          uid: .metadata.uid,
          resourceVersion: .metadata.resourceVersion,
          spec: .spec
        }
      }
    ' <<<"$deployment_json")" || return 1
  integrity="$(printf '%s' "$state_payload" | sha256sum | awk '{print $1}')" || return 1
  state_json="$(jq -cS --arg integrity "$integrity" '. + {integritySha256: $integrity}' <<<"$state_payload")" || return 1
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
  load_backstage_pending_state || return 1
  BACKSTAGE_DEPLOY_ROLLBACK_ARMED=true
  echo "[backstage] deployment rollback baseline captured uid=$BACKSTAGE_BASELINE_UID integrity=$integrity"
}

wait_for_backstage_deployment_readiness() {
  local expected_uid="$1" expected_spec="${2:-}" deadline live_json desired
  deadline="$(( $(date +%s) + BACKSTAGE_DEPLOYMENT_ROLLBACK_TIMEOUT_SECONDS ))"
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
  BACKSTAGE_DEPLOY_ROLLBACK_ARMED=false
}

rollback_pending_backstage_deployment() {
  local current_json current_uid current_resource_version current_spec patch_json
  load_backstage_pending_state || return 1
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
  [[ "$current_uid" == "$BACKSTAGE_BASELINE_UID" ]] || {
    backstage_rollback_fail "Deployment UID changed; rollback mutation=0"
    return 1
  }
  patch_json="$(jq -cn \
    --arg uid "$current_uid" \
    --arg resourceVersion "$current_resource_version" \
    --argjson currentSpec "$current_spec" \
    --argjson baselineSpec "$BACKSTAGE_BASELINE_SPEC" '
      [
        {op:"test", path:"/metadata/uid", value:$uid},
        {op:"test", path:"/metadata/resourceVersion", value:$resourceVersion},
        {op:"test", path:"/spec", value:$currentSpec},
        {op:"replace", path:"/spec", value:$baselineSpec}
      ]
    ')" || return 1
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
  wait_for_backstage_deployment_readiness "$BACKSTAGE_BASELINE_UID" "$BACKSTAGE_BASELINE_SPEC" || return 1
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

finalize_successful_backstage_deployment() {
  load_backstage_pending_state || return 1
  wait_for_backstage_deployment_readiness "$BACKSTAGE_BASELINE_UID" || return 1
  clear_backstage_pending_state || return 1
  BACKSTAGE_DEPLOY_COMPLETED=true
  echo "[backstage] deployment rollback state finalized pending=0"
}

deployment_exit_handler() {
  local original_status="$?" final_status rollback_status=0
  trap - EXIT
  set +e
  final_status="$original_status"
  if [[ "$BACKSTAGE_DEPLOY_ROLLBACK_ARMED" == "true" &&
        "$BACKSTAGE_DEPLOY_COMPLETED" != "true" ]]; then
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
if [[ "$mode" == "recover-pending" ]]; then
  # This operator-safe path intentionally precedes Node, Docker, buildx and all
  # Secret/configuration prerequisites. It serializes on the exact same state
  # directory inode as deploy and performs no work when no pending state exists.
  for command in dirname id mkdir readlink stat flock; do
    require "$command"
  done
  acquire_backstage_deployment_lock || exit 79
  if backstage_pending_state_exists; then
    for command in kubectl jq sha256sum awk date sleep rm sync; do
      require "$command"
    done
    resume_pending_backstage_deployment_rollback || exit 79
    echo '[backstage] BACKSTAGE_PENDING_RECOVERY_PASS pending=1 recovered=1 mutation=rollback-only'
  else
    echo '[backstage] BACKSTAGE_PENDING_RECOVERY_PASS pending=0 recovered=0 mutation=0'
  fi
  exit 0
fi

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

for command in git node corepack docker kubectl openssl curl flock sha256sum jq sync; do
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
BACKSTAGE_URL="${BACKSTAGE_URL:-https://$BACKSTAGE_HOST}"
RUNTIME_PURGE_READINESS_URL="$BACKSTAGE_URL/api/resonance-projects/health/project-runtime-purge-recovery"
BACKSTAGE_MIN_CATALOG_ENTITIES="${BACKSTAGE_MIN_CATALOG_ENTITIES:-22}"
BACKSTAGE_TLS_DIR="${BACKSTAGE_TLS_DIR:-/opt/resonance-data/pki/resonance-internal-ca}"
CURL_TLS_ARGS=()
OIDC_READY=false
leader=""

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
  kubectl -n "$NAMESPACE" create secret generic resonance-backstage-auth \
    --from-literal=AUTH_SESSION_SECRET="$session_secret" \
    --from-literal=AUTH_OIDC_METADATA_URL="$metadata_url" \
    --from-literal=AUTH_OIDC_CLIENT_ID="$client_id" \
    --from-literal=AUTH_OIDC_CLIENT_SECRET="$client_secret" \
    --from-literal=AUTH_OIDC_DISPLAY_NAME="$display_name" \
    --dry-run=client -o yaml | kubectl apply -f -
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
  kubectl -n "$NAMESPACE" create secret generic "$secret_name" \
    --from-literal=RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID="$account_id" \
    --from-literal=RESONANCE_RUNTIME_PURGE_RECOVERY_ACTOR_REF="$actor_ref" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null
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

case "$mode" in
  configure-oidc)
    : "${AUTH_OIDC_METADATA_URL:?set AUTH_OIDC_METADATA_URL}"
    : "${AUTH_OIDC_CLIENT_ID:?set AUTH_OIDC_CLIENT_ID}"
    : "${AUTH_OIDC_CLIENT_SECRET:?set AUTH_OIDC_CLIENT_SECRET}"
    [[ "$AUTH_OIDC_METADATA_URL" == https://* ]] || {
      echo "[backstage] AUTH_OIDC_METADATA_URL must use HTTPS" >&2
      exit 2
    }
    if kubectl -n "$NAMESPACE" get secret resonance-backstage-auth >/dev/null 2>&1; then
      session_secret="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-auth \
        -o jsonpath='{.data.AUTH_SESSION_SECRET}' | base64 -d)"
    else
      session_secret="$(openssl rand -hex 32)"
    fi
    kubectl -n "$NAMESPACE" create secret generic resonance-backstage-auth \
      --from-literal=AUTH_SESSION_SECRET="$session_secret" \
      --from-literal=AUTH_OIDC_METADATA_URL="$AUTH_OIDC_METADATA_URL" \
      --from-literal=AUTH_OIDC_CLIENT_ID="$AUTH_OIDC_CLIENT_ID" \
      --from-literal=AUTH_OIDC_CLIENT_SECRET="$AUTH_OIDC_CLIENT_SECRET" \
      --from-literal=AUTH_OIDC_DISPLAY_NAME="${AUTH_OIDC_DISPLAY_NAME:-Resonance 계정}" \
      --dry-run=client -o yaml | kubectl apply -f - >/dev/null
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
    resume_pending_backstage_deployment_rollback || exit 79
    initialize_backstage_build_workspace
    start_phase preflight
    bash "$ROOT/ops/scripts/resonance-control-plane.sh" validate
    # Exercise the complete API admission chain before dependency installation,
    # image construction, secret mutation, or rollout. The independent nightly
    # job retains the full 16-route visual regression.
    bash "$ROOT/ops/scripts/resonance-kubernetes-admission-preflight.sh" "$NAMESPACE"
    ensure_tls
    ensure_auth_secret
    ensure_runtime_purge_recovery_secret
    ensure_ingress_https_port
    ensure_runtime_preview_https
    finish_phase preflight
    # Tag only production runtime inputs. E2E specifications and documentation
    # still run their own gates but cannot invalidate an identical image.
    tag="$(bash "$ROOT/ops/scripts/resonance-backstage-runtime-fingerprint.sh" "$ROOT" HEAD | cut -c1-12)"
    image="$IMAGE_REPOSITORY:$tag"
    legacy_tag="$(git -C "$ROOT" rev-parse HEAD:platform/control-plane/backstage | cut -c1-12)"
    legacy_image="$IMAGE_REPOSITORY:$legacy_tag"
    if ! docker image inspect "$image" >/dev/null 2>&1 &&
      docker image inspect "$legacy_image" >/dev/null 2>&1; then
      docker tag "$legacy_image" "$image"
      docker push "$image"
      echo "[backstage] promoted verified legacy image to runtime fingerprint: $image"
    fi

    # An immutable image with the same source-tree hash has already passed all
    # dependency-backed generators, TypeScript checks and the backend build.
    # Do not materialize node_modules in a disposable worktree merely to deploy
    # that exact image again after a transient readiness or browser-test error.
    if ! docker image inspect "$image" >/dev/null 2>&1; then
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
          -t "$image" \
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
          -t "$image" \
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
      docker push "$image"
      finish_phase image-push
    else
      echo "[backstage] reusing verified application image without dependency install: $image"
    fi

    start_phase runtime-config
    find_patroni_leader

    if kubectl -n "$NAMESPACE" get secret resonance-backstage-database >/dev/null 2>&1; then
      password="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-database \
        -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)"
    else
      password="$(openssl rand -hex 24)"
    fi
    role_exists="$(kubectl -n carbonet-prod exec "$leader" -c patroni -- \
      psql -h 127.0.0.1 -U postgres -d postgres -Atqc \
      "select 1 from pg_roles where rolname='backstage'")"
    if [[ "$role_exists" != "1" ]]; then
      kubectl -n carbonet-prod exec "$leader" -c patroni -- \
        psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 \
        -c "create role backstage login createdb password '$password'"
    else
      kubectl -n carbonet-prod exec "$leader" -c patroni -- \
        psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 \
        -c "alter role backstage createdb password '$password'"
    fi
    database_exists="$(kubectl -n carbonet-prod exec "$leader" -c patroni -- \
      psql -h 127.0.0.1 -U postgres -d postgres -Atqc \
      "select 1 from pg_database where datname='backstage'")"
    if [[ "$database_exists" != "1" ]]; then
      kubectl -n carbonet-prod exec "$leader" -c patroni -- \
        psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 \
        -c "create database backstage owner backstage"
    fi

    kubectl -n "$NAMESPACE" create secret generic resonance-backstage-database \
      --from-literal=POSTGRES_USER=backstage \
      --from-literal=POSTGRES_PASSWORD="$password" \
      --dry-run=client -o yaml | kubectl apply -f -
    kubectl -n carbonet-prod get secret resonance-ops-bridge -o json \
      | jq 'del(.metadata.namespace,.metadata.resourceVersion,.metadata.uid,.metadata.creationTimestamp,.metadata.managedFields)
            | .metadata.namespace="resonance-ops"' \
      | kubectl apply -f -
    kubectl -n "$NAMESPACE" create configmap resonance-backstage-catalog \
      --from-file="$ROOT/platform/control-plane/catalog/organization.yaml" \
      --from-file="$ROOT/platform/control-plane/catalog/systems.yaml" \
      --from-file="$ROOT/platform/control-plane/catalog/components.yaml" \
      --from-file="$ROOT/platform/control-plane/catalog/apis.yaml" \
      --from-file="$ROOT/platform/control-plane/catalog/resources.yaml" \
      --from-file="$ROOT/platform/control-plane/catalog/environments.yaml" \
      --dry-run=client -o yaml | kubectl apply -f -
    # Publish the exact pre-mutation Deployment spec/UID durably and atomically.
    # The following manifest apply is the first resonance-backstage Deployment
    # mutation in this deploy path.
    capture_backstage_deployment_baseline || exit 79
    kubectl apply -f "$MANIFEST"
    kubectl -n "$NAMESPACE" set image deployment/resonance-backstage backstage="$image"
    configure_auth_mode
    # Roll out exactly once. The image, auth mode and catalog digest together
    # define the pod template; an unchanged digest must not restart a healthy
    # runtime, while a catalog-only change still converges immediately.
    catalog_digest="$(
      sha256sum \
        "$ROOT/platform/control-plane/catalog/organization.yaml" \
        "$ROOT/platform/control-plane/catalog/systems.yaml" \
        "$ROOT/platform/control-plane/catalog/components.yaml" \
        "$ROOT/platform/control-plane/catalog/apis.yaml" \
        "$ROOT/platform/control-plane/catalog/resources.yaml" \
        "$ROOT/platform/control-plane/catalog/environments.yaml" |
        sha256sum | awk '{print $1}'
    )"
    kubectl -n "$NAMESPACE" patch deployment resonance-backstage --type=merge \
      -p="{\"spec\":{\"template\":{\"metadata\":{\"annotations\":{\"resonance.io/catalog-digest\":\"$catalog_digest\"}}}}}"
    finish_phase runtime-config
    start_phase rollout-readiness
    kubectl -n "$NAMESPACE" rollout status deployment/resonance-backstage --timeout=600s
    wait_for_runtime
    if [[ "$OIDC_READY" == "true" ]]; then
      wait_for_catalog_database
    else
      wait_for_catalog
    fi
    finalize_successful_backstage_deployment || exit 79
    finish_phase rollout-readiness
    echo "[backstage][timing] total seconds=$(( $(date +%s) - deploy_started_at )) target=60"
    echo "[backstage] PASS deployed $image at $BACKSTAGE_URL"
    ;;
  status)
    ensure_tls
    ensure_auth_secret
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
    echo "usage: $0 {configure-oidc|validate|deploy|status|recover-pending}" >&2
    exit 64
    ;;
esac
