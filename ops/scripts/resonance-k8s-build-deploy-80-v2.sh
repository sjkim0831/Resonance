#!/usr/bin/env bash
#===============================================================================
# Carbonet Build-Deploy Script (Enhanced v2.1.0)
# - Detailed error logging
# - Parallel build support
# - Incremental build support
# - Better error recovery
#===============================================================================
set -euo pipefail

CARBONET_DURABLE_ATTEMPT_REQUIRED="${CARBONET_DURABLE_ATTEMPT_REQUIRED:-false}"
if [[ "$CARBONET_DURABLE_ATTEMPT_REQUIRED" != true ]]; then
  echo '[build-deploy-v2] RETIRED: direct execution requires the official durable auto-deploy pipeline' >&2
  exit 78
fi

export RESONANCE_SUDO_PASSWORD="${RESONANCE_SUDO_PASSWORD:-qwer1234}"

SCRIPT_VERSION="2.1.0"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/build.sh
source "$ROOT_DIR/ops/scripts/build.sh" 2>/dev/null || true
init_build_tool
# shellcheck source=ops/scripts/docker-registry-cache.sh
source "$ROOT_DIR/ops/scripts/docker-registry-cache.sh"
NAMESPACE="${NAMESPACE:-${CARBONET_K8S_NAMESPACE:-carbonet-prod}}"
DEPLOYMENT="${DEPLOYMENT:-${CARBONET_K8S_DEPLOYMENT:-carbonet-runtime}}"
CONTAINER="${CONTAINER:-${CARBONET_K8S_CONTAINER:-carbonet-runtime}}"
SERVICE="${SERVICE:-carbonet-runtime}"
MIGRATION_SECRET_NAME="${CARBONET_MIGRATION_SECRET_NAME:-carbonet-migration-secret}"
MIGRATION_PASSWORD_KEY="${CARBONET_MIGRATION_PASSWORD_KEY:-SPRING_FLYWAY_PASSWORD}"
PROJECT_ID="${PROJECT_ID:-P003}"
CUBRID_HOST="${CUBRID_HOST:-postgres-haproxy.${NAMESPACE}.svc.cluster.local}"
E4B_RUNTIME_BASE_URL="${CARBONET_KRDS_AI_BASE_URL:-http://172.16.1.232:24451/v1}"
IMAGE_NAME="${IMAGE_NAME:-localhost:5000/carbonet-runtime:$(date +%Y.%m.%d-%H%M%S-gradle)}"
RUNTIME_BASE_IMAGE="${RUNTIME_BASE_IMAGE:-localhost:5000/carbonet-runtime-base:java21-chrome-noto-v1}"
PUSH_IMAGE="${PUSH_IMAGE:-true}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
DRY_RUN="${DRY_RUN:-false}"
SKIP_PREFLIGHT="${SKIP_PREFLIGHT:-false}"
SKIP_NOTIFY="${SKIP_NOTIFY:-false}"
SKIP_FRONTEND="${SKIP_FRONTEND:-false}"
SKIP_MAVEN="${SKIP_MAVEN:-false}"
SKIP_BACKEND="${SKIP_BACKEND:-$SKIP_MAVEN}"
SKIP_IMAGE_BUILD="${SKIP_IMAGE_BUILD:-false}"
SKIP_OVERLAY_SYNC="${SKIP_OVERLAY_SYNC:-false}"
IMMUTABLE_FRONTEND_IMAGE="${IMMUTABLE_FRONTEND_IMAGE:-false}"
INCREMENTAL="${INCREMENTAL:-true}"
PRE_ROLLOUT_IMAGE="${PRE_ROLLOUT_IMAGE:-}"
PRE_ROLLOUT_TARGET_COMMIT="${PRE_ROLLOUT_TARGET_COMMIT:-}"
PRE_ROLLOUT_IDENTITY_CAPTURED="${PRE_ROLLOUT_IDENTITY_CAPTURED:-false}"
DEFER_ROLLBACK_TO_ATTEMPT_RECONCILER="${DEFER_ROLLBACK_TO_ATTEMPT_RECONCILER:-false}"
CARBONET_DEFER_LIVE_MUTATIONS_UNTIL_POST_FLYWAY="${CARBONET_DEFER_LIVE_MUTATIONS_UNTIL_POST_FLYWAY:-false}"
POSTDEPLOY_DB_ATTEMPT_STAGED="${POSTDEPLOY_DB_ATTEMPT_STAGED:-false}"
RUNTIME_RELEASE_STATE_RECORDER="${CARBONET_RUNTIME_RELEASE_STATE_RECORDER:-$ROOT_DIR/ops/scripts/record-runtime-release-state.sh}"
PENDING_FRONTEND_STAGING_DIR=""
PENDING_FRONTEND_PREVIOUS_MANIFEST=""
FRONTEND_EXPECTED_OVERLAY_PROVENANCE_SHA256=""

RELEASE_DIR="$ROOT_DIR/var/releases/$PROJECT_ID/image-context"
RUN_DIR="$ROOT_DIR/var/run"
LOG_DIR="$ROOT_DIR/var/logs"
BACKUP_DIR="$ROOT_DIR/var/backups/k8s"
ERROR_LOG_DIR="$RUN_DIR/build-errors"
EVENT_LOG="$ROOT_DIR/var/ai-runtime/k8s-build-deploy-events.jsonl"
MANIFEST_LOG="$ROOT_DIR/var/ai-runtime/k8s-release-manifest.jsonl"
LOCK_FILE="$RUN_DIR/resonance-k8s-build-deploy-80.lock"
FRONTEND_OVERLAY_LOCK_FILE="${CARBONET_FRONTEND_OVERLAY_LOCK_FILE:-/opt/resonance-data/deploy/carbonet-frontend-overlay.lock}"
FRONTEND_OVERLAY_LOCK_TIMEOUT_SECONDS="${CARBONET_FRONTEND_OVERLAY_LOCK_TIMEOUT_SECONDS:-60}"
DIAGNOSTIC_LOG="$RUN_DIR/diagnostic-$(date +%Y%m%d-%H%M%S).log"

OVERLAY_HOST_PATH="/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app"
FRONTEND_DIR="$ROOT_DIR/projects/carbonet-frontend/source"
FRONTEND_GUARD_SCRIPT="$ROOT_DIR/ops/scripts/resonance-frontend-overlay-guard.sh"
MAVEN_DIR="$ROOT_DIR/apps/carbonet-api"

NODE_HEAP_MB="${CARBONET_NODE_HEAP_MB:-4096}"
MAVEN_OPTS="${MAVEN_OPTS:--Xmx2g -Xms512m}"
MAX_RETRIES=3
RETRY_DELAY=20
BUILD_PARALLELISM="${BUILD_PARALLELISM:-1}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; MAGENTA='\033[0;35m'; NC='\033[0m'

log() {
  local ts=$(date '+%H:%M:%S')
  echo -e "${BLUE}[$ts INFO]${NC} $*"
  echo "[$ts] $*" >> "$DIAGNOSTIC_LOG"
}
log_step() {
  echo ""
  echo -e "${CYAN}==== $* ====${NC}"
  echo "==== $* ====" >> "$DIAGNOSTIC_LOG"
}
log_success() {
  local ts=$(date '+%H:%M:%S')
  echo -e "${GREEN}[$ts OK]${NC} $*"
  echo "[$ts] OK: $*" >> "$DIAGNOSTIC_LOG"
}
log_warning() {
  local ts=$(date '+%H:%M:%S')
  echo -e "${YELLOW}[$ts WARN]${NC} $*"
  echo "[$ts] WARN: $*" >> "$DIAGNOSTIC_LOG"
}
log_error() {
  local ts=$(date '+%H:%M:%S')
  echo -e "${RED}[$ts ERROR]${NC} $*" >&2
  echo "[$ts] ERROR: $*" >> "$DIAGNOSTIC_LOG"
}
log_detail() {
  local ts=$(date '+%H:%M:%S')
  echo -e "  ${MAGENTA}[$ts]${NC} $*"
  echo "  [$ts] $*" >> "$DIAGNOSTIC_LOG"
}
log_cmd() {
  local ts=$(date '+%H:%M:%S')
  echo -e "  ${BLUE}[CMD]${NC} $*"
  echo "  [CMD] $*" >> "$DIAGNOSTIC_LOG"
}

log_event() {
  printf '{"ts":"%s","script":"resonance-k8s-build-deploy-80","version":"%s","status":"%s","code":"%s","image":"%s","message":"%s"}\n' \
    "$(date -Iseconds)" "$SCRIPT_VERSION" "$1" "$2" "$IMAGE_NAME" "$3" >> "$EVENT_LOG"
}

init_error_logging() {
  mkdir -p "$ERROR_LOG_DIR" "$(dirname "$EVENT_LOG")" "$(dirname "$MANIFEST_LOG")" "$LOG_DIR" "$BACKUP_DIR"
  local timestamp=$(date +%Y%m%d-%H%M%S)
  FRONTEND_ERROR_LOG="$ERROR_LOG_DIR/frontend-$timestamp.log"
  MAVEN_ERROR_LOG="$ERROR_LOG_DIR/backend-$timestamp.log"
  DOCKER_ERROR_LOG="$ERROR_LOG_DIR/docker-$timestamp.log"
  KUBECTL_ERROR_LOG="$ERROR_LOG_DIR/kubectl-$timestamp.log"
  log "Error logs: $ERROR_LOG_DIR/"
}

acquire_lock() {
  if [[ -e "$LOCK_FILE" ]]; then
    local pid="$(cat "$LOCK_FILE" 2>/dev/null)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      log_error "Another instance running (PID: $pid)"
      exit 1
    fi
  fi
  [[ "$FRONTEND_OVERLAY_LOCK_TIMEOUT_SECONDS" =~ ^[1-9][0-9]*$ \
     && "$FRONTEND_OVERLAY_LOCK_TIMEOUT_SECONDS" -le 300 ]] || {
    log_error "CARBONET_FRONTEND_OVERLAY_LOCK_TIMEOUT_SECONDS must be 1..300"
    exit 2
  }
  mkdir -p "$(dirname "$FRONTEND_OVERLAY_LOCK_FILE")"
  exec 8>"$FRONTEND_OVERLAY_LOCK_FILE"
  if ! flock -w "$FRONTEND_OVERLAY_LOCK_TIMEOUT_SECONDS" 8; then
    log_error "Frontend overlay mutation lock timed out: $FRONTEND_OVERLAY_LOCK_FILE"
    exit 75
  fi
  export CARBONET_FRONTEND_OVERLAY_LOCK_FD=8
  export CARBONET_FRONTEND_OVERLAY_LOCK_FILE="$FRONTEND_OVERLAY_LOCK_FILE"
  echo "$$" > "$LOCK_FILE"
}
release_lock() { rm -f "$LOCK_FILE"; }

notify() {
  local status="$1"; local msg="$2"; local code="${3:-}"
  log_event "$status" "$code" "$msg"
  if [[ -n "$SLACK_WEBHOOK_URL" && "$SLACK_WEBHOOK_URL" =~ ^http ]]; then
    local emoji color
    case "$status" in
      START) emoji="🚀"; color="#36a64f" ;;
      SUCCESS) emoji="✅"; color="#36a64f" ;;
      FAIL) emoji="❌"; color="#ff0000" ;;
    esac
    curl -s -X POST -H 'Content-Type: application/json' -d "{\"text\":\"$emoji $msg\"}" "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || true
  fi
}

rollback_and_fail() {
  local error_code="$1"
  local error_msg="$2"
  local suggestion="$3"

  log_error "FAIL $error_code: $error_msg"
  notify "FAIL" "$error_msg" "$error_code"

  echo ""
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}  BUILD-DEPLOY FAILED${NC}"
  echo -e "${RED}========================================${NC}"
  echo ""
  echo -e "${RED}Error Code:${NC} $error_code"
  echo -e "${RED}Message:${NC} $error_msg"
  echo ""

  if [[ -n "$suggestion" ]]; then
    echo -e "${YELLOW}Recovery Steps:${NC}"
    echo "$suggestion"
    echo ""
  fi

  if [[ -f "$FRONTEND_ERROR_LOG" ]]; then
    echo -e "${YELLOW}Frontend Build Log (last 50 lines):${NC}"
    tail -50 "$FRONTEND_ERROR_LOG"
    echo ""
  fi

  if [[ -f "$MAVEN_ERROR_LOG" ]]; then
    echo -e "${YELLOW}Backend Build Log (last 50 lines):${NC}"
    tail -50 "$MAVEN_ERROR_LOG"
    echo ""
  fi

  echo -e "${YELLOW}Diagnostic Log:${NC} $DIAGNOSTIC_LOG"
  echo -e "${YELLOW}Error Logs Dir:${NC} $ERROR_LOG_DIR/"

  if [[ "$DEFER_ROLLBACK_TO_ATTEMPT_RECONCILER" == true ]]; then
    log_warning "Durable attempt reconciler owns rollback; child performs no physical restore"
  elif [[ -n "${PRE_ROLLOUT_IMAGE:-}" ]]; then
    log_warning "Restoring previous deployment image: $PRE_ROLLOUT_IMAGE"
    kubectl -n "$NAMESPACE" set image "deployment/$DEPLOYMENT" "$CONTAINER=$PRE_ROLLOUT_IMAGE" >/dev/null 2>&1 || true
    kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=180s >/dev/null 2>&1 || true
  else
    log_warning "No previous deployment image captured; leaving deployment unchanged"
  fi
  if [[ "$DEFER_ROLLBACK_TO_ATTEMPT_RECONCILER" != true \
     && "${PRE_ROLLOUT_IDENTITY_CAPTURED:-false}" == "true" ]]; then
    if [[ "$PRE_ROLLOUT_TARGET_COMMIT" =~ ^[0-9a-f]{40}$ ]]; then
      if kubectl -n "$NAMESPACE" annotate "deployment/$DEPLOYMENT" \
        "resonance.ai/target-commit=$PRE_ROLLOUT_TARGET_COMMIT" --overwrite >/dev/null 2>&1; then
        if [[ -f "$ROOT_DIR/ops/scripts/record-runtime-release-state.sh" ]]; then
          CARBONET_DEPLOY_ROOT="$ROOT_DIR" \
          CARBONET_K8S_NAMESPACE="$NAMESPACE" \
          CARBONET_K8S_DEPLOYMENT="$DEPLOYMENT" \
          CARBONET_K8S_CONTAINER="$CONTAINER" \
            bash "$ROOT_DIR/ops/scripts/record-runtime-release-state.sh" "$PRE_ROLLOUT_TARGET_COMMIT" >/dev/null 2>&1 ||
            {
              log_error "Rollback restored the annotation but runtime release ledger synchronization failed; invalidating it"
              CARBONET_DEPLOY_ROOT="$ROOT_DIR" CARBONET_K8S_NAMESPACE="$NAMESPACE" \
                bash "$ROOT_DIR/ops/scripts/record-runtime-release-state.sh" --invalidate >/dev/null 2>&1 || true
            }
        fi
      else
        log_error "Rollback could not restore the previous target-commit annotation"
        [[ ! -f "$ROOT_DIR/ops/scripts/record-runtime-release-state.sh" ]] || \
          bash "$ROOT_DIR/ops/scripts/record-runtime-release-state.sh" --invalidate >/dev/null 2>&1 || true
      fi
    else
      kubectl -n "$NAMESPACE" annotate "deployment/$DEPLOYMENT" \
        'resonance.ai/target-commit-' >/dev/null 2>&1 ||
        log_error "Rollback could not remove the candidate target-commit annotation"
      [[ ! -f "$ROOT_DIR/ops/scripts/record-runtime-release-state.sh" ]] || \
        CARBONET_DEPLOY_ROOT="$ROOT_DIR" CARBONET_K8S_NAMESPACE="$NAMESPACE" \
        bash "$ROOT_DIR/ops/scripts/record-runtime-release-state.sh" --invalidate >/dev/null 2>&1 || true
    fi
  fi
  release_lock
  exit 1
}

root_cmd() {
  if [[ $EUID -eq 0 ]]; then
    "$@"
  else
    echo "$RESONANCE_SUDO_PASSWORD" | sudo -S "$@"
  fi
}

quarantine_build_output() {
  local build_dir="$1"
  local quarantine_dir="${build_dir}.failed.$(date +%s).$$"
  [[ -e "$build_dir" ]] || return 0

  # A failed Gradle daemon can finish copying resources after the client has
  # exited. Deleting the live directory in that window intermittently fails
  # with "Directory not empty" and causes the deploy timer to rebuild the same
  # commit forever. Rename is atomic on this filesystem and gives the fallback
  # build a clean path immediately; quarantine cleanup is best-effort.
  if root_cmd mv "$build_dir" "$quarantine_dir"; then
    for _ in 1 2 3 4 5; do
      root_cmd rm -rf "$quarantine_dir" && return 0
      sleep 1
    done
    log_warning "Deferred cleanup of quarantined build output: $quarantine_dir"
    return 0
  fi

  for _ in 1 2 3 4 5; do
    root_cmd rm -rf "$build_dir" && return 0
    sleep 1
  done
  return 1
}

preflight_check() {
  log_step "Pre-flight Checks"

  mkdir -p "$RUN_DIR" "$LOG_DIR" "$BACKUP_DIR" "$(dirname "$EVENT_LOG")"

  echo -n "  Disk (root): "
  local root_d
  root_d="$(df / | awk 'NR==2 {print $5}' | sed 's/%//')"
  if [[ "$root_d" -lt 85 ]]; then
    echo -e "${GREEN}OK${NC} (${root_d}%)"
  else
    echo -e "${RED}WARNING${NC} (${root_d}%)"
  fi

  echo -n "  Disk (/opt): "
  local opt_d
  opt_d="$(df /opt | awk 'NR==2 {print $5}' | sed 's/%//')"
  if [[ "$opt_d" -lt 85 ]]; then
    echo -e "${GREEN}OK${NC} (${opt_d}%)"
  else
    echo -e "${RED}WARNING${NC} (${opt_d}%)"
  fi

  echo -n "  Nodes: "
  local nr
  nr="$(kubectl get nodes --no-headers 2>/dev/null | grep -v Ready | wc -l)" || true
  if [[ "$nr" -eq 0 ]]; then
    echo -e "${GREEN}OK${NC}"
  else
    echo -e "${RED}NOT READY${NC} ($nr nodes)"
    kubectl get nodes --no-headers 2>/dev/null | grep -v Ready
  fi

  echo -n "  Memory: "
  local mem
  mem="$(free -m | awk 'NR==2 {print $7}')"
  echo "${mem}MB available"
  if [[ "$mem" -lt 1024 ]]; then
    log_warning "Low memory, adjusting build settings"
    NODE_HEAP_MB=2048
    MAVEN_OPTS="-Xmx1g"
  fi

  echo -n "  HostPath Overlay: "
  if [[ -d "$OVERLAY_HOST_PATH" ]]; then
    local file_count=$(find "$OVERLAY_HOST_PATH" -type f 2>/dev/null | wc -l)
    echo -e "${GREEN}OK${NC} ($file_count files)"
  else
    echo -e "${YELLOW}CREATING${NC}"
    mkdir -p "$OVERLAY_HOST_PATH"
  fi

  echo -n "  Registry: "
  if curl -fsS http://localhost:5000/v2/ >/dev/null 2>&1; then
    echo -e "${GREEN}Connected${NC} (localhost:5000)"
  else
    echo -e "${YELLOW}Check registry${NC} (localhost:5000)"
  fi

  echo -n "  Docker: "
  if root_cmd docker info >/dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
  else
    echo -e "${YELLOW}Limited${NC}"
  fi

  log_success "Pre-flight checks completed"
}


guard_frontend_overlay() {
  local action="$1"
  if [[ "$SKIP_FRONTEND" == "true" && "$SKIP_OVERLAY_SYNC" == "true" ]]; then
    log_detail "Frontend overlay guard skipped for project-core deploy: $action"
    return
  fi
  if [[ ! -x "$FRONTEND_GUARD_SCRIPT" ]]; then
    rollback_and_fail "FRONTEND_GUARD_MISSING" \
      "Frontend overlay guard is missing or not executable: $FRONTEND_GUARD_SCRIPT" \
      "chmod +x $FRONTEND_GUARD_SCRIPT"
  fi
  log_detail "Frontend overlay guard: $action"
  # The build is promoted to the shared live hostPath, while ROOT_DIR may be a
  # persistent isolated worktree containing a rollback snapshot. Always bind
  # the guard to the exact overlay and source used by this candidate build.
  if ! OVERLAY_DIR="$OVERLAY_HOST_PATH" SOURCE_DIR="$FRONTEND_DIR" \
      CARBONET_FRONTEND_EXPECTED_OVERLAY_PROVENANCE_SHA256="$FRONTEND_EXPECTED_OVERLAY_PROVENANCE_SHA256" \
      "$FRONTEND_GUARD_SCRIPT" "$action" >> "$DIAGNOSTIC_LOG" 2>&1; then
    rollback_and_fail "FRONTEND_OVERLAY_GUARD_FAILED" \
      "Frontend overlay guard failed: $action" \
      "$FRONTEND_GUARD_SCRIPT $action"
  fi
}

validate_frontend() {
  local d="$MAVEN_DIR/../projects/carbonet-frontend/target/classes/static/react-app"
  if [[ ! -d "$d" || ! -f "$d/index.html" ]]; then
    d="$OVERLAY_HOST_PATH"
  fi
  if [[ ! -d "$d" || ! -f "$d/index.html" ]]; then
    d="$FRONTEND_DIR/dist"
  fi

  if [[ ! -f "$d/index.html" ]]; then
    rollback_and_fail "FRONTEND_BUILD_INCOMPLETE" \
      "Missing index.html in build output" \
      "cd $FRONTEND_DIR && npm run build 2>&1 | tail -50"
  fi

  if [[ ! -d "$d/assets" ]]; then
    rollback_and_fail "FRONTEND_BUILD_INCOMPLETE" \
      "Missing assets directory in build output" \
      "cd $FRONTEND_DIR && npm run build 2>&1 | tail -50"
  fi

  log_success "Frontend validation passed"
}

validate_maven() {
  local jar
  jar="$(jbooted project-runtime)"

  if [[ ! -f "$jar" ]]; then
    rollback_and_fail "BACKEND_BUILD_FAILED" \
      "JAR file not found: $jar" \
      "cd $ROOT_DIR && ./gradlew :apps:carbonet-api:bootJar --console=plain 2>&1 | tail -50"
  fi

  local jar_size
  jar_size=$(stat -c%s "$jar" 2>/dev/null || echo 0)

  if [[ "$jar_size" -lt 1000000 ]]; then
    rollback_and_fail "BACKEND_BUILD_CORRUPT" \
      "JAR file too small: $jar_size bytes (expected >1MB)" \
      "cd $ROOT_DIR && ./gradlew :apps:carbonet-api:bootJar --console=plain 2>&1 | tail -50"
  fi

  log_success "Backend validation passed (tool: ${BUILD_TOOL:-unknown}, JAR: $jar, size: $((jar_size/1024/1024))MB)"
}

validate_overlay() {
  if [[ ! -f "$OVERLAY_HOST_PATH/index.html" ]]; then
    rollback_and_fail "OVERLAY_SYNC_FAILED" \
      "Overlay missing index.html" \
      "ls -la $OVERLAY_HOST_PATH/ && kubectl -n $NAMESPACE delete pods -l app=$DEPLOYMENT --grace-period=0"
  fi

  if [[ ! -d "$OVERLAY_HOST_PATH/assets" ]]; then
    rollback_and_fail "OVERLAY_SYNC_FAILED" \
      "Overlay missing assets directory" \
      "ls -la $OVERLAY_HOST_PATH/ && kubectl -n $NAMESPACE delete pods -l app=$DEPLOYMENT --grace-period=0"
  fi

  log_success "Overlay validation passed"
}

build_frontend() {
  log_step "Build Frontend"

  if [[ "$SKIP_FRONTEND" == "true" ]]; then
    log "Skipped (SKIP_FRONTEND=true)"
    return
  fi

  local start_time=$(date +%s)
  local staging_dir
  staging_dir="$(mktemp -d "$ROOT_DIR/var/run/react-build.XXXXXX")"
  local previous_manifest
  previous_manifest="$(mktemp "$ROOT_DIR/var/run/react-previous-manifest.XXXXXX.json")"
  if [[ -s "$OVERLAY_HOST_PATH/.vite/manifest.json" ]]; then
    cp "$OVERLAY_HOST_PATH/.vite/manifest.json" "$previous_manifest"
  else
    printf '{}\n' >"$previous_manifest"
  fi

  # Generated screen definitions are runtime materialization assets and are
  # intentionally not committed one-by-one. Materialize only the exact
  # manifest-pinned catalog closure; shared extras and stale shared type files
  # must never enter TypeScript.
  local generated_dir="$FRONTEND_DIR/src/generated/screen-generation"
  local shared_generated_dir="${SHARED_GENERATED_SCREEN_DIR:-/opt/Resonance/projects/carbonet-frontend/source/src/generated/screen-generation}"
  local generated_closure_result
  generated_closure_result="$(cd "$FRONTEND_DIR" && \
    GENERATED_SCREEN_DIR="$generated_dir" \
    SHARED_GENERATED_SCREEN_DIR="$shared_generated_dir" \
    node scripts/ensure-shared-generated-screen-assets.mjs)" || {
      rollback_and_fail "GENERATED_SCREEN_CLOSURE_INVALID" \
        "Generated screen catalog/definition/type provenance is invalid" \
        "regenerate the screen bundle and its definition closure manifest"
    }
  log "Generated screen closure: $generated_closure_result"

  # Never let Vite empty or partially rewrite the live hostPath overlay. Build
  # into an isolated directory, verify its complete hashed-asset closure, copy
  # assets first, and switch index.html last. Existing hashed files are kept so
  # browsers that loaded the previous index can finish lazy chunk requests.
  promote_frontend_staging() {
    node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$staging_dir"
    FRONTEND_EXPECTED_OVERLAY_PROVENANCE_SHA256="$(
      OVERLAY_DIR="$staging_dir" SOURCE_DIR="$FRONTEND_DIR" \
        "$FRONTEND_GUARD_SCRIPT" print-overlay-provenance
    )" || rollback_and_fail "FRONTEND_STAGING_PROVENANCE_FAILED" \
      "Frontend staging provenance could not be computed" \
      "$FRONTEND_GUARD_SCRIPT print-overlay-provenance"
    [[ "$FRONTEND_EXPECTED_OVERLAY_PROVENANCE_SHA256" =~ ^[0-9a-f]{64}$ ]] \
      || rollback_and_fail "FRONTEND_STAGING_PROVENANCE_FAILED" \
        "Frontend staging provenance is malformed" \
        "$FRONTEND_GUARD_SCRIPT print-overlay-provenance"
    if [[ "$CARBONET_DEFER_LIVE_MUTATIONS_UNTIL_POST_FLYWAY" == true ]]; then
      PENDING_FRONTEND_STAGING_DIR="$staging_dir"
      PENDING_FRONTEND_PREVIOUS_MANIFEST="$previous_manifest"
      log "Verified frontend staging retained until durable DB attempt is armed"
      return
    fi
    require_runtime_release_state_invalidation_before_live_mutation
    root_cmd mkdir -p "$OVERLAY_HOST_PATH"
    root_cmd rsync -a --exclude='/index.html' "$staging_dir/" "$OVERLAY_HOST_PATH/"
    root_cmd cp "$staging_dir/index.html" "$OVERLAY_HOST_PATH/.index.html.next"
    root_cmd mv -f "$OVERLAY_HOST_PATH/.index.html.next" "$OVERLAY_HOST_PATH/index.html"
    node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$OVERLAY_HOST_PATH"
    node "$ROOT_DIR/ops/scripts/prune-react-asset-generations.mjs" \
      "$OVERLAY_HOST_PATH" "$previous_manifest" "$staging_dir"
    node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$OVERLAY_HOST_PATH"
    rm -f "$previous_manifest"
    rm -rf "$staging_dir"
  }

  if [[ -d "$FRONTEND_DIR/node_modules" ]]; then
    log "Using incremental build (node_modules exists, skipping npm ci)"
    log_cmd "cd $FRONTEND_DIR && npm run build"
    cd "$FRONTEND_DIR" && VITE_OUT_DIR="$staging_dir" npm run build > >(tee "$FRONTEND_ERROR_LOG") 2>&1 || {
      rm -rf "$staging_dir"
      log_error "Frontend build failed"
      rollback_and_fail "FRONTEND_BUILD_FAILED" \
        "Frontend npm build failed" \
        "cd $FRONTEND_DIR && npm run build 2>&1 | tail -50"
    }
  else
    log "Using clean build"
    mkdir -p "$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static"
    log_cmd "cd $FRONTEND_DIR && npm ci && npm run build"
    cd "$FRONTEND_DIR" && npm ci > >(tee "$FRONTEND_ERROR_LOG") 2>&1 && \
      VITE_OUT_DIR="$staging_dir" npm run build > >(tee -a "$FRONTEND_ERROR_LOG") 2>&1 || {
        rm -rf "$staging_dir"
        log_error "Frontend build failed"
      rollback_and_fail "FRONTEND_BUILD_FAILED" \
        "Frontend npm ci/build failed" \
        "cd $FRONTEND_DIR && npm run build 2>&1 | tail -100"
    }
  fi

  promote_frontend_staging

  if [[ -n "$PENDING_FRONTEND_STAGING_DIR" ]]; then
    local elapsed=$(( $(date +%s) - start_time ))
    log_success "Frontend candidate built without live publish in ${elapsed}s"
    return
  fi
  validate_frontend
  guard_frontend_overlay write-marker
  guard_frontend_overlay verify-source

  local elapsed=$(( $(date +%s) - start_time ))
  log_success "Frontend built in ${elapsed}s"
}

publish_pending_frontend_staging() {
  [[ -n "$PENDING_FRONTEND_STAGING_DIR" ]] || return 0
  [[ "$POSTDEPLOY_DB_ATTEMPT_STAGED" == true ]] \
    || rollback_and_fail "ATTEMPT_NOT_ARMED" "Refusing live overlay publish before durable DB attempt stage" "Inspect the postdeploy attempt journal"
  node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$PENDING_FRONTEND_STAGING_DIR"
  root_cmd mkdir -p "$OVERLAY_HOST_PATH"
  root_cmd rsync -a --exclude='/index.html' "$PENDING_FRONTEND_STAGING_DIR/" "$OVERLAY_HOST_PATH/"
  root_cmd cp "$PENDING_FRONTEND_STAGING_DIR/index.html" "$OVERLAY_HOST_PATH/.index.html.next"
  root_cmd mv -f "$OVERLAY_HOST_PATH/.index.html.next" "$OVERLAY_HOST_PATH/index.html"
  node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$OVERLAY_HOST_PATH"
  node "$ROOT_DIR/ops/scripts/prune-react-asset-generations.mjs" \
    "$OVERLAY_HOST_PATH" "$PENDING_FRONTEND_PREVIOUS_MANIFEST" \
    "$PENDING_FRONTEND_STAGING_DIR"
  node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$OVERLAY_HOST_PATH"
  rm -f -- "$PENDING_FRONTEND_PREVIOUS_MANIFEST"
  rm -rf -- "$PENDING_FRONTEND_STAGING_DIR"
  PENDING_FRONTEND_STAGING_DIR=""
  PENDING_FRONTEND_PREVIOUS_MANIFEST=""
  validate_frontend
  guard_frontend_overlay write-marker
  guard_frontend_overlay verify-source
}

invalidate_runtime_release_state_before_live_mutation() {
  local status=0
  if [[ "$CARBONET_DURABLE_ATTEMPT_REQUIRED" == true \
     && "$POSTDEPLOY_DB_ATTEMPT_STAGED" != true ]]; then
    log_error "Runtime ledger invalidation refused: durable DB attempt is not staged"
    return 1
  fi
  if [[ ! -f "$RUNTIME_RELEASE_STATE_RECORDER" || -L "$RUNTIME_RELEASE_STATE_RECORDER" ]]; then
    log_error "Runtime ledger invalidation helper is unavailable"
    return 1
  fi
  CARBONET_DEPLOY_ROOT="$ROOT_DIR" \
  CARBONET_K8S_NAMESPACE="$NAMESPACE" \
  CARBONET_K8S_DEPLOYMENT="$DEPLOYMENT" \
  CARBONET_K8S_CONTAINER="$CONTAINER" \
  CARBONET_POSTGRES_CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}" \
  CARBONET_POSTDEPLOY_LEADER_RESOLVER="${CARBONET_POSTDEPLOY_LEADER_RESOLVER:-}" \
  POSTGRES_POD="${RESONANCE_POSTGRES_LEADER_POD:-${POSTGRES_POD:-}}" \
  POSTGRES_DB="${POSTGRES_DB:-carbonet}" \
  POSTGRES_ADMIN_USER="${POSTGRES_ADMIN_USER:-postgres}" \
    bash "$RUNTIME_RELEASE_STATE_RECORDER" --invalidate || status=$?
  if (( status != 0 )); then
    log_error "Runtime ledger invalidation/count=0 proof failed before live mutation (status=$status)"
    return 1
  fi
  log_success "Runtime release ledger invalidated with count=0 before live mutation"
}

require_runtime_release_state_invalidation_before_live_mutation() {
  invalidate_runtime_release_state_before_live_mutation ||
    rollback_and_fail "RUNTIME_LEDGER_INVALIDATION_FAILED" \
      "Runtime release authority could not be removed with count=0 proof before live mutation" \
      "Inspect framework_runtime_release_state and the runtime release recorder"
}

sync_overlay() {
  log_step "Sync Overlay"

  # A database-bearing release builds React into an isolated candidate tree.
  # Until Flyway has installed and the durable DB attempt is ARMED, the live
  # overlay still belongs to the baseline source and its marker is expected to
  # differ from the candidate source. Validate the candidate closure here and
  # defer every live-overlay guard/write to publish_pending_frontend_staging.
  if [[ "$CARBONET_DEFER_LIVE_MUTATIONS_UNTIL_POST_FLYWAY" == true \
     && -n "$PENDING_FRONTEND_STAGING_DIR" ]]; then
    node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$PENDING_FRONTEND_STAGING_DIR"
    log "Live overlay verification and publish deferred until durable DB attempt stage"
    return
  fi

  if [[ "$SKIP_OVERLAY_SYNC" == "true" ]]; then
    log "Skipped (SKIP_OVERLAY_SYNC=true)"
    if [[ "$CARBONET_DEFER_LIVE_MUTATIONS_UNTIL_POST_FLYWAY" == true \
       && -n "$PENDING_FRONTEND_STAGING_DIR" ]]; then
      log "Live overlay verification deferred until durable DB attempt stage"
      return
    fi
    guard_frontend_overlay verify-local
    guard_frontend_overlay verify-source
    return
  fi

  require_runtime_release_state_invalidation_before_live_mutation
  guard_frontend_overlay backup
  guard_frontend_overlay verify-local
  guard_frontend_overlay verify-source

  local src="$FRONTEND_DIR/dist"
  if [[ ! -d "$src" || ! -f "$src/index.html" ]]; then
    src="$OVERLAY_HOST_PATH"
  fi

  if [[ ! -d "$src" || ! -f "$src/index.html" ]]; then
    rollback_and_fail "OVERLAY_SYNC_FAILED" \
      "Build source not found: $src" \
      "Check build output directory"
  fi

  if [[ "$src" != "$OVERLAY_HOST_PATH" ]]; then
    log_cmd "rsync -av --delete '$src/' '$OVERLAY_HOST_PATH/'"
    rsync -av --delete "$src/" "$OVERLAY_HOST_PATH/" >> "$DIAGNOSTIC_LOG" 2>&1 || {
      log_error "rsync failed, trying with root"
      root_cmd rsync -av --delete "$src/" "$OVERLAY_HOST_PATH/" >> "$DIAGNOSTIC_LOG" 2>&1 || {
        rollback_and_fail "OVERLAY_SYNC_FAILED" \
          "rsync to overlay failed" \
          "rsync -av --delete '$src/' '$OVERLAY_HOST_PATH/'"
      }
    }
  else
    log "Build output already at overlay path, skipping rsync"
  fi

  local runtime_path="/opt/Resonance/data/carbonet-app/react-app"
  if [[ -d "$runtime_path" ]]; then
    log_cmd "rsync -av --delete '$OVERLAY_HOST_PATH/' '$runtime_path/'"
    rsync -av --delete "$OVERLAY_HOST_PATH/" "$runtime_path/" >> "$DIAGNOSTIC_LOG" 2>&1 || {
      log_error "rsync to runtime path failed, trying with root"
      root_cmd rsync -av --delete "$OVERLAY_HOST_PATH/" "$runtime_path/" >> "$DIAGNOSTIC_LOG" 2>&1 || {
        log_warning "rsync to runtime path failed but continuing"
      }
    }
  fi

  validate_overlay
  guard_frontend_overlay verify-local
  guard_frontend_overlay verify-source

  local cnt
  cnt="$(kubectl -n $NAMESPACE get pods -l app=$DEPLOYMENT --field-selector=status.phase=Running -o jsonpath='{.items[*].metadata.name}' 2>/dev/null | wc -w)"
  if [[ "$cnt" -eq 0 ]]; then
    rollback_and_fail "NO_RUNNING_PODS" \
      "No running pods found" \
      "kubectl -n $NAMESPACE get pods"
  fi

  log "Restarting pods to pick up overlay changes..."
  kubectl -n "$NAMESPACE" rollout restart "deployment/$DEPLOYMENT" >/dev/null 2>&1
  kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=120s || true

  log_success "Overlay synced"
}

build_maven() {
  log_step "Build Backend"

  if [[ "$SKIP_BACKEND" == "true" ]]; then
    log "Skipped (SKIP_BACKEND=true)"
    return
  fi

  local start_time=$(date +%s)

  if [[ "$INCREMENTAL" != "true" ]]; then
    log "Using clean ${BUILD_TOOL:-backend} build"
    if [[ "${BUILD_TOOL:-}" == "gradle" ]]; then
      log_cmd "root_cmd rm -rf $MAVEN_DIR/build"
      if ! quarantine_build_output "$MAVEN_DIR/build"; then
        rollback_and_fail "BACKEND_BUILD_CLEANUP_FAILED" "Unable to isolate failed Gradle output" "ls -la $MAVEN_DIR"
      fi
    else
      log_cmd "root_cmd rm -rf $MAVEN_DIR/target/classes/static"
      root_cmd rm -rf "$MAVEN_DIR/target/classes/static"
    fi
  else
    log "Using incremental ${BUILD_TOOL:-backend} build"
  fi

  log_cmd "jbuild -q -pl apps/carbonet-api -am -Dmaven.test.skip=true package"
  if ! (cd "$ROOT_DIR" && MAVEN_OPTS="$MAVEN_OPTS" jbuild -q -pl apps/carbonet-api -am -Dmaven.test.skip=true package > >(tee "$MAVEN_ERROR_LOG") 2>&1); then
    if [[ "$INCREMENTAL" == "true" && "${BUILD_TOOL:-}" == "gradle" ]]; then
      log_warning "Incremental Gradle build failed; quarantining external project metadata, clearing only the application output, and retrying once"
      if [[ -n "${GRADLE_PROJECT_CACHE_DIR:-}" && "$GRADLE_PROJECT_CACHE_DIR" != "$ROOT_DIR" && "$GRADLE_PROJECT_CACHE_DIR" != "$ROOT_DIR"/* ]]; then
        rm -rf "$GRADLE_PROJECT_CACHE_DIR"
        mkdir -p "$GRADLE_PROJECT_CACHE_DIR"
      else
        rollback_and_fail "GRADLE_CACHE_ISOLATION_INVALID" "Gradle project cache is not isolated from source" "printf '%s\n' \"${GRADLE_PROJECT_CACHE_DIR:-unset}\""
      fi
      if ! quarantine_build_output "$MAVEN_DIR/build"; then
        rollback_and_fail "BACKEND_BUILD_CLEANUP_FAILED" "Unable to isolate failed Gradle output" "ls -la $MAVEN_DIR"
      fi
      if ! (cd "$ROOT_DIR" && MAVEN_OPTS="$MAVEN_OPTS" jbuild -q -pl apps/carbonet-api -am -Dmaven.test.skip=true package > >(tee -a "$MAVEN_ERROR_LOG") 2>&1); then
        rollback_and_fail "BACKEND_BUILD_FAILED" "Incremental and clean fallback builds failed" "cd $ROOT_DIR && ./gradlew :apps:carbonet-api:bootJar --console=plain 2>&1 | tail -100"
      fi
      log_success "Clean fallback build recovered the incremental build"
    else
      rollback_and_fail "BACKEND_BUILD_FAILED" "Backend build failed" "cd $ROOT_DIR && ./gradlew :apps:carbonet-api:bootJar --console=plain 2>&1 | tail -100"
    fi
  fi

  validate_maven

  local elapsed=$(( $(date +%s) - start_time ))
  log_success "Backend built in ${elapsed}s"
}

prepare_immutable_frontend() {
  [[ "$IMMUTABLE_FRONTEND_IMAGE" == "true" ]] || return 0
  # build_frontend promotes the verified candidate atomically to the guarded
  # host overlay. The persistent build worktree contains the previous rollback
  # snapshot, so using it here can package stale or pruned chunks. Assemble the
  # immutable JAR from the exact candidate closure that passed the overlay
  # guard instead.
  local frontend_dir="${IMMUTABLE_FRONTEND_SOURCE_DIR:-$OVERLAY_HOST_PATH}"
  local backend_dir="$ROOT_DIR/apps/carbonet-api/src/main/resources/static/react-app"
  node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$frontend_dir"
  root_cmd rm -rf "$backend_dir"
  root_cmd mkdir -p "$backend_dir"
  root_cmd cp -a "$frontend_dir/." "$backend_dir/"
  node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$backend_dir"
  log "Immutable JAR candidate sourced from verified overlay: $frontend_dir"

  # The immutable asset directory is copied immediately before the backend
  # build. Gradle can otherwise reuse an up-to-date processResources/bootJar
  # result when copied files preserve their timestamps. Invalidate only the
  # resource output and final JAR; compiled Java/Kotlin and dependency caches
  # remain incremental.
  if [[ "${BUILD_TOOL:-}" == "gradle" ]]; then
    root_cmd rm -rf "$MAVEN_DIR/build/resources/main/static/react-app"
    # Flyway validates resources embedded in the executable JAR, not the
    # source tree. A reverted migration can otherwise leave a newer stale copy
    # in build/resources/main and produce a rollout that fails at startup.
    # Invalidate only migration resources; compiled classes stay incremental.
    root_cmd rm -rf "$MAVEN_DIR/build/resources/main/db/migration"
    root_cmd find "$MAVEN_DIR/build/libs" -maxdepth 1 -type f -name '*.jar' -delete 2>/dev/null || true
    # The persistent deployment worktree can otherwise retain a stale
    # first-party dependency JAR even when its Java source changed. The
    # application bootJar then receives the old common-core bytecode while the
    # deployed source marker points at the new commit. Recompile only this
    # small shared module; external dependencies and the remaining project
    # outputs stay incremental.
    local common_core_build="$ROOT_DIR/modules/resonance-common/carbonet-common-core/build"
    root_cmd rm -rf "$common_core_build/classes/java/main" "$common_core_build/libs"
    log "Invalidated React/Flyway resources, application JAR, and common-core bytecode"
  fi
}

verify_immutable_frontend_jar() {
  [[ "$IMMUTABLE_FRONTEND_IMAGE" == "true" ]] || return 0
  local jar_path jar_entries expected_file
  jar_path="$(jbooted project-runtime)"
  jar_entries="$(mktemp)"
  expected_file="$(mktemp)"
  jar tf "$jar_path" | LC_ALL=C sort -u > "$jar_entries"
  find "$ROOT_DIR/apps/carbonet-api/src/main/resources/static/react-app" -type f \
    -printf 'BOOT-INF/classes/static/react-app/%P\n' | LC_ALL=C sort -u > "$expected_file"
  if [[ -n "$(LC_ALL=C comm -23 "$expected_file" "$jar_entries" | head -1)" ]]; then
    rm -f "$jar_entries" "$expected_file"
    rollback_and_fail "IMMUTABLE_ASSET_JAR_INCOMPLETE" \
      "Built JAR does not contain the complete React asset closure" \
      "Inspect the JAR static/react-app entries before rollout"
  fi
  rm -f "$jar_entries" "$expected_file"
  log_success "Immutable React asset closure verified inside JAR"
}

build_image() {
  log_step "Build Image"

  if [[ "$SKIP_IMAGE_BUILD" == "true" ]]; then
    log "Skipped (SKIP_IMAGE_BUILD=true)"
    return
  fi

  local start_time=$(date +%s)

  # Pull the stable Java/Chrome/font layer first. It survives application image
  # pruning in the local registry and avoids downloading and installing about
  # 700 MB of packages for every JAR-only release.
  if ! root_cmd docker image inspect "$RUNTIME_BASE_IMAGE" >/dev/null 2>&1; then
    log_detail "Restoring reusable runtime base image..."
    if ! root_cmd docker pull "$RUNTIME_BASE_IMAGE" >/dev/null 2>&1; then
      log_detail "Building reusable Java/Chrome/Noto base image once..."
      root_cmd docker build -f "$ROOT_DIR/ops/docker/Dockerfile.runtime-base" -t "$RUNTIME_BASE_IMAGE" "$ROOT_DIR/ops/docker"
      root_cmd docker push "$RUNTIME_BASE_IMAGE" >/dev/null
    fi
  fi

  rm -rf "$RELEASE_DIR" && mkdir -p "$RELEASE_DIR/lib" "$RELEASE_DIR/config"

  log_detail "Copying JAR to release directory..."
  local runtime_jar
  runtime_jar="$(jbooted project-runtime)"
  cp "$runtime_jar" "$RELEASE_DIR/carbonet-api.jar" || {
    rollback_and_fail "RELEASE_PREP_FAILED" \
      "Failed to copy JAR to release directory" \
      "cp $(jbooted project-runtime) $RELEASE_DIR/carbonet-api.jar"
  }

  log_detail "Synchronizing KISA library..."
  RESONANCE_ROOT="$ROOT_DIR" \
    bash "$ROOT_DIR/ops/scripts/sync-kisa-runtime-library.sh"
  cp "${CARBONET_BACKEND_LIB_OVERLAY_DIR:-/opt/Resonance/projects/carbonet-backend-lib}/kr.or.kisa.dapc.core-1.0.0.jar" \
    "$RELEASE_DIR/lib/"

  log_detail "Copying config files..."
  mkdir -p "$RELEASE_DIR/ops/config"
  cp -r "$ROOT_DIR/ops/config/"* "$RELEASE_DIR/ops/config/" 2>/dev/null || true

  local cache_ref=""
  local -a registry_cache_args=()
  cache_ref="$(
    kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o json 2>/dev/null \
      | jq -er --arg container "$CONTAINER" '
          [.spec.template.spec.containers[] | select(.name == $container)]
          | if length == 1 then .[0].image else empty end
        ' 2>/dev/null || true
  )"
  if [[ -n "$cache_ref" ]]; then
    if append_docker_registry_cache_from registry_cache_args "$cache_ref"; then
      log_detail "Using current runtime image as registry cache: $cache_ref"
    else
      log_warning "Ignoring invalid runtime registry cache reference"
    fi
  else
    log_detail "No current runtime registry cache reference; building without registry cache"
  fi

  log_cmd "docker build --build-arg PROJECT_ID=$PROJECT_ID -t $IMAGE_NAME $RELEASE_DIR"

  if root_cmd docker build --build-arg PROJECT_ID="$PROJECT_ID" --build-arg RUNTIME_BASE_IMAGE="$RUNTIME_BASE_IMAGE" --build-arg BUILDKIT_INLINE_CACHE=1 \
    "${registry_cache_args[@]}" \
    -f "$ROOT_DIR/ops/docker/Dockerfile.runtime" \
    -t "$IMAGE_NAME" "$RELEASE_DIR" > >(tee "$DOCKER_ERROR_LOG") 2>&1; then
    log_success "Docker image built"
  else
    log_error "Docker build output:"
    tail -30 "$DOCKER_ERROR_LOG"
    rollback_and_fail "DOCKER_BUILD_FAILED" \
      "Docker image build failed" \
      "docker build --build-arg PROJECT_ID=$PROJECT_ID -t $IMAGE_NAME $RELEASE_DIR 2>&1 | tail -50"
  fi

  # Prefer the content-addressed registry path. docker save/ctr import reads
  # the complete 1.6 GiB image even when only one class changed, while push
  # and pull transfer only the changed Spring Boot layer.
  local import_success=false
  local import_err="/opt/Resonance/var/run/ctr-import-$$.log"
  local tmp_tar="/opt/Resonance/var/run/docker-save-$$.tar"

  if [[ "$PUSH_IMAGE" == "true" ]]; then
    log_detail "Publishing changed layers to the local registry..."
    if root_cmd docker push "$IMAGE_NAME" >>"$DOCKER_ERROR_LOG" 2>&1 &&
       sudo ctr -n k8s.io images pull --plain-http "$IMAGE_NAME" \
         >"$import_err" 2>&1; then
      import_success=true
      log_success "Changed layers published and loaded into containerd"
    else
      log_warning "Layer-aware registry transfer failed; using full local import"
      tail -20 "$DOCKER_ERROR_LOG" >>"$DIAGNOSTIC_LOG" 2>/dev/null || true
    fi
  fi

  if [[ "$import_success" != true ]] &&
     sudo docker save "$IMAGE_NAME" 2>>"$import_err" |
       sudo ctr -n k8s.io images import - >"$import_err" 2>&1; then
    import_success=true
    log_success "Image streamed directly into containerd fallback"
  fi

  for ((i=1; i<=3; i++)); do
    [[ "$import_success" == true ]] && break
    rm -f "$import_err" "$tmp_tar" 2>/dev/null || true
    if sudo docker save "$IMAGE_NAME" > "$tmp_tar" 2>/dev/null && \
       sudo ctr -n k8s.io images import "$tmp_tar" > "$import_err" 2>&1; then
      sudo rm -f "$tmp_tar" 2>/dev/null || true
      import_success=true
      break
    fi
    log_warning "Import attempt $i failed, retrying in ${i}0s..."
    cat "$import_err" >> "$DIAGNOSTIC_LOG" 2>/dev/null
    sleep ${i}0
  done

  if ! "$import_success"; then
    log_error "Image import failed after 3 attempts, trying pipe method..."
    if sudo docker save "$IMAGE_NAME" | sudo ctr -n k8s.io images import - > "$import_err" 2>&1; then
      import_success=true
    fi
  fi

  sudo rm -f "$tmp_tar" 2>/dev/null || true
  rm -f "$import_err"

  if ! "$import_success"; then
    rollback_and_fail "CTR_IMPORT_FAILED" \
      "Failed to import image to containerd after retries" \
      "sudo docker save '$IMAGE_NAME' | sudo ctr -n k8s.io images import -"
  fi
  log_success "Image imported to containerd"

  local elapsed=$(( $(date +%s) - start_time ))
  log_success "Image built and imported in ${elapsed}s"
}

rollout_image() {
  log_step "Rollout"

  PRE_ROLLOUT_IMAGE="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || true)"
  PRE_ROLLOUT_TARGET_COMMIT="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o jsonpath='{.metadata.annotations.resonance\.ai/target-commit}' 2>/dev/null || true)"
  PRE_ROLLOUT_IDENTITY_CAPTURED=true
  if [[ -n "$PRE_ROLLOUT_IMAGE" ]]; then
    log_detail "Previous deployment image: $PRE_ROLLOUT_IMAGE"
  fi
  if [[ -n "$PRE_ROLLOUT_TARGET_COMMIT" ]]; then
    log_detail "Previous runtime source commit: $PRE_ROLLOUT_TARGET_COMMIT"
  fi

  log_cmd "ctr -n k8s.io images list -q | grep -Fqx $IMAGE_NAME"
  local ctr_found=false

  # Capture the complete reference list before matching. With pipefail enabled,
  # `ctr images list | grep -q` can report failure after grep exits early and
  # ctr receives SIGPIPE, causing an unnecessary registry pull.
  local ctr_references
  ctr_references="$(root_cmd ctr -n k8s.io images list -q 2>/dev/null || true)"
  if grep -Fqx "$IMAGE_NAME" <<<"$ctr_references"; then
    ctr_found=true
    log_success "Image verified in containerd"
  fi

  if ! "$ctr_found"; then
    log_warning "Image not immediately visible in containerd, attempting pull..."
    if root_cmd ctr -n k8s.io images pull --plain-http "$IMAGE_NAME" 2>/dev/null; then
      ctr_found=true
      log_success "Image pulled to containerd"
    fi
  fi

  if ! "$ctr_found"; then
    rollback_and_fail "IMAGE_NOT_FOUND" \
      "Image not found in containerd: $IMAGE_NAME" \
      "ctr -n k8s.io images list | grep $IMAGE_NAME; docker images | grep $IMAGE_NAME"
  fi

  # Migrate exactly once from the candidate image. A failed migration leaves
  # the current deployment untouched; successful runtime pods no longer spend
  # startup time validating the same 277 migrations three times.
  if [[ "${RUN_FLYWAY_MIGRATION_JOB:-true}" == "true" ]]; then
    local flyway_status=0
    CARBONET_K8S_NAMESPACE="$NAMESPACE" \
      CARBONET_K8S_DEPLOYMENT="$DEPLOYMENT" \
      CARBONET_K8S_CONTAINER="$CONTAINER" \
      CARBONET_MIGRATION_SECRET_NAME="$MIGRATION_SECRET_NAME" \
      CARBONET_MIGRATION_PASSWORD_KEY="$MIGRATION_PASSWORD_KEY" \
      bash "$ROOT_DIR/ops/scripts/run-flyway-migration-job.sh" "$IMAGE_NAME" \
        || flyway_status=$?
    if (( flyway_status == 79 )); then
      log_error "Flyway cleanup proof is unavailable; preserving deployment and durable attempt state for recovery"
      return 79
    elif (( flyway_status != 0 )); then
      rollback_and_fail "FLYWAY_JOB_FAILED" \
        "Candidate image database migration failed before rollout" \
        "Inspect $ROOT_DIR/var/logs/flyway-jobs and the failed Kubernetes Job"
    fi
  fi

  if [[ "$CARBONET_DURABLE_ATTEMPT_REQUIRED" == true && "$POSTDEPLOY_DB_ATTEMPT_STAGED" != true ]]; then
    if CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE="${CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_FILE:-}" \
       CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER="${CARBONET_POSTDEPLOY_ATTEMPT_JOURNAL_HELPER:-}" \
       CARBONET_K8S_NAMESPACE="$NAMESPACE" CARBONET_POSTGRES_CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}" \
       CARBONET_POSTDEPLOY_LEADER_RESOLVER="${CARBONET_POSTDEPLOY_LEADER_RESOLVER:-}" \
       POSTGRES_DB="${POSTGRES_DB:-carbonet}" POSTGRES_ADMIN_USER="${POSTGRES_ADMIN_USER:-postgres}" \
       bash "$ROOT_DIR/ops/scripts/stage-postdeploy-release-attempt.sh" \
         "$ROOT_DIR" "${CARBONET_POSTDEPLOY_CANDIDATE_ID:-}" "${CARBONET_POSTDEPLOY_SOURCE_COMMIT:-}"; then
      POSTDEPLOY_DB_ATTEMPT_STAGED=true
    else
      rollback_and_fail "ATTEMPT_DB_STAGE_FAILED" \
        "Candidate Flyway completed but the durable DB attempt could not be armed" \
        "Inspect framework_postdeploy_release_attempt and the attempt journal"
    fi
  fi
  [[ "$CARBONET_DURABLE_ATTEMPT_REQUIRED" != true || "$POSTDEPLOY_DB_ATTEMPT_STAGED" == true ]] \
    || rollback_and_fail "ATTEMPT_NOT_ARMED" "Refusing live mutation before durable DB attempt stage" "Inspect the attempt lifecycle migration"

  require_runtime_release_state_invalidation_before_live_mutation
  publish_pending_frontend_staging

  local -a runtime_env=(CARBONET_FLYWAY_ENABLED=false CARBONET_LIQUIBASE_ENABLED=false
    CARBONET_REACT_APP_FS_OVERRIDE_ENABLED=true CARBONET_STATIC_FS_OVERRIDE_ENABLED=true
    RESONANCE_COMPOSITE_AUTOCOMPLETION_CAPABILITY_ENABLED=true
    RESONANCE_COMPOSITE_AUTOCOMPLETION_PARALLELISM=8
    RESONANCE_COMPOSITE_AUTOCOMPLETION_BATCH_LIMIT=25
    RESONANCE_COMPOSITE_AUTOCOMPLETION_PHYSICAL_SLOTS=8
    RESONANCE_COMPOSITE_AUTOCOMPLETION_REPLICAS=2
    "RESONANCE_COMPOSITE_AUTOCOMPLETION_RUNTIME_COMMIT=${CARBONET_TARGET_COMMIT:-}"
    RESONANCE_COMPOSITE_AUTOCOMPLETION_LEASE_SECONDS=600
    RESONANCE_COMPOSITE_AUTOCOMPLETION_HEARTBEAT_SECONDS=30
    RESONANCE_COMPOSITE_AUTOCOMPLETION_PREFLIGHT_THREADS=8
    RESONANCE_COMPOSITE_AUTOCOMPLETION_PREFLIGHT_BUDGET_MS=12000
    RESONANCE_COMPOSITE_AUTOCOMPLETION_PREFLIGHT_CACHE_MS=30000
    RESONANCE_COMPOSITE_AUTOCOMPLETION_PREFLIGHT_QUEUE_CAPACITY=256)
  [[ -z "${CARBONET_RUNTIME_JAVA_OPTS:-}" ]] || runtime_env+=("JAVA_OPTS=$CARBONET_RUNTIME_JAVA_OPTS")
  kubectl -n "$NAMESPACE" set env "deployment/$DEPLOYMENT" "${runtime_env[@]}" >/dev/null ||
    rollback_and_fail "RUNTIME_MIGRATION_DISABLE_FAILED" \
      "Failed to configure the candidate runtime after durable attempt stage" \
      "kubectl -n $NAMESPACE set env deployment/$DEPLOYMENT"

  log_detail "Applying canonical carbonet-web Service contract..."
  local carbonet_web_service_json
  if ! carbonet_web_service_json="$(
    kubectl apply --dry-run=client -f "$ROOT_DIR/manifests/carbonet-split-runtime.yaml" -o json \
      | jq -ce '
          [.items[]? | select(.kind == "Service" and .metadata.name == "carbonet-web")]
          | if length == 1 then .[0]
            else error("expected exactly one carbonet-web Service, found \(length)")
            end
        '
  )"; then
    rollback_and_fail "CARBONET_WEB_SERVICE_EXTRACT_FAILED" \
      "Canonical manifest must contain exactly one valid carbonet-web Service" \
      "kubectl apply --dry-run=client -f $ROOT_DIR/manifests/carbonet-split-runtime.yaml -o json"
  fi
  if ! printf '%s\n' "$carbonet_web_service_json" | kubectl apply -f - >/dev/null; then
    rollback_and_fail "CARBONET_WEB_MANIFEST_APPLY_FAILED" \
      "Failed to apply the extracted carbonet-web Service" \
      "Inspect the canonical manifest and kubectl apply output"
  fi
  if ! bash "$ROOT_DIR/ops/scripts/validate-carbonet-web-nodeport-client-ip-contract.sh" \
      --live --namespace "$NAMESPACE"; then
    rollback_and_fail "CARBONET_WEB_CLIENT_IP_CONTRACT_FAILED" \
      "Live carbonet-web Service does not preserve the original client address" \
      "kubectl -n $NAMESPACE get service carbonet-web -o yaml"
  fi

  log_detail "Ensuring the canonical reference library is mounted read-only..."
  kubectl -n "$NAMESPACE" patch "deployment/$DEPLOYMENT" --type='strategic' \
    -p="{\"spec\":{\"template\":{\"spec\":{\"volumes\":[{\"name\":\"reference-root\",\"hostPath\":{\"path\":\"/opt/reference\",\"type\":\"DirectoryOrCreate\"}}],\"containers\":[{\"name\":\"$CONTAINER\",\"volumeMounts\":[{\"name\":\"reference-root\",\"mountPath\":\"/opt/reference\",\"readOnly\":true}]}]}}}}" \
    >/dev/null || rollback_and_fail "REFERENCE_MOUNT_FAILED" "Failed to mount /opt/reference read-only" "kubectl -n $NAMESPACE describe deployment/$DEPLOYMENT"

  # Membership evidence must survive pod replacement and be readable from
  # either replica.  The application runs as uid/gid 1000, so prepare the
  # host directory explicitly instead of relying on a root-owned hostPath
  # directory created by kubelet.
  local member_file_host_dir="${CARBONET_MEMBER_FILE_HOST_DIR:-/opt/resonance-data/carbonet/files/instt}"
  root_cmd install -d -m 0750 -o 1000 -g 1000 "$member_file_host_dir" ||
    rollback_and_fail "MEMBER_FILE_DIRECTORY_FAILED" \
      "Failed to prepare persistent membership evidence storage" \
      "install -d -m 0750 -o 1000 -g 1000 $member_file_host_dir"
  kubectl -n "$NAMESPACE" patch "deployment/$DEPLOYMENT" --type='strategic' \
    -p="{\"spec\":{\"template\":{\"spec\":{\"volumes\":[{\"name\":\"member-evidence-files\",\"hostPath\":{\"path\":\"$member_file_host_dir\",\"type\":\"DirectoryOrCreate\"}}],\"containers\":[{\"name\":\"$CONTAINER\",\"env\":[{\"name\":\"CARBONET_FILE_INSTT_DIR\",\"value\":\"/var/file/instt\"}],\"volumeMounts\":[{\"name\":\"member-evidence-files\",\"mountPath\":\"/var/file/instt\"}]}]}}}}" \
    >/dev/null || rollback_and_fail "MEMBER_FILE_MOUNT_FAILED" \
      "Failed to mount persistent membership evidence storage" \
      "kubectl -n $NAMESPACE describe deployment/$DEPLOYMENT"

  # The host runner writes immutable DOM/PNG observations.  The application
  # receives only this exact allowlisted directory, mounted read-only, and
  # independently reopens and hashes every submitted artifact.
  local composite_smoke_evidence_dir="/opt/resonance-data/control-plane/var/test-evidence/composite-live-smoke"
  root_cmd install -d -m 0750 -o 1000 -g 1000 "$composite_smoke_evidence_dir" ||
    rollback_and_fail "COMPOSITE_SMOKE_EVIDENCE_DIRECTORY_FAILED" \
      "Failed to prepare composite live-smoke evidence storage" \
      "install -d -m 0750 -o 1000 -g 1000 $composite_smoke_evidence_dir"
  kubectl -n "$NAMESPACE" patch "deployment/$DEPLOYMENT" --type='strategic' \
    -p="{\"spec\":{\"template\":{\"spec\":{\"volumes\":[{\"name\":\"composite-live-smoke-evidence\",\"hostPath\":{\"path\":\"$composite_smoke_evidence_dir\",\"type\":\"Directory\"}}],\"containers\":[{\"name\":\"$CONTAINER\",\"env\":[{\"name\":\"RESONANCE_COMPOSITE_LIVE_SMOKE_EVIDENCE_ROOT\",\"value\":\"$composite_smoke_evidence_dir\"}],\"volumeMounts\":[{\"name\":\"composite-live-smoke-evidence\",\"mountPath\":\"$composite_smoke_evidence_dir\",\"readOnly\":true}]}]}}}}" \
    >/dev/null || rollback_and_fail "COMPOSITE_SMOKE_EVIDENCE_MOUNT_FAILED" \
      "Failed to mount composite live-smoke evidence read-only" \
      "kubectl -n $NAMESPACE describe deployment/$DEPLOYMENT"

  # Preserve zero downtime while removing fixed rollout delays. The startup
  # probe remains the safety gate; two-second polling detects readiness without
  # adding ten-second quantisation, and old pods still drain before SIGTERM.
  kubectl -n "$NAMESPACE" patch "deployment/$DEPLOYMENT" --type='strategic' \
    -p="{\"spec\":{\"minReadySeconds\":0,\"progressDeadlineSeconds\":180,\"strategy\":{\"type\":\"RollingUpdate\",\"rollingUpdate\":{\"maxSurge\":3,\"maxUnavailable\":0}},\"template\":{\"spec\":{\"terminationGracePeriodSeconds\":15,\"containers\":[{\"name\":\"$CONTAINER\",\"env\":[{\"name\":\"SPRING_MAIN_LAZY_INITIALIZATION\",\"value\":\"true\"},{\"name\":\"SPRING_DATA_JPA_REPOSITORIES_BOOTSTRAP_MODE\",\"value\":\"lazy\"}],\"lifecycle\":{\"preStop\":{\"exec\":{\"command\":[\"sh\",\"-c\",\"sleep 2\"]}}},\"startupProbe\":{\"httpGet\":{\"path\":\"/home\",\"port\":8080},\"failureThreshold\":90,\"periodSeconds\":1,\"timeoutSeconds\":5},\"readinessProbe\":{\"httpGet\":{\"path\":\"/actuator/health/readiness\",\"port\":8080},\"initialDelaySeconds\":0,\"periodSeconds\":1,\"timeoutSeconds\":1,\"failureThreshold\":5},\"livenessProbe\":{\"httpGet\":{\"path\":\"/actuator/health/liveness\",\"port\":8080},\"initialDelaySeconds\":0,\"periodSeconds\":10,\"timeoutSeconds\":2,\"failureThreshold\":3}}]}}}}" \
    >/dev/null || rollback_and_fail "ROLLOUT_STRATEGY_FAILED" "Failed to apply bounded parallel rollout strategy" "kubectl -n $NAMESPACE get deployment/$DEPLOYMENT -o yaml"

  # Stamp the image and a unique release label in one pod-template mutation.
  # This lets us wait for the candidate pods themselves instead of waiting for
  # the old ReplicaSet's protected preStop drain to finish.
  local candidate_release_id
  candidate_release_id="$(date -u +%Y%m%d%H%M%S)-$$"
  CANDIDATE_RELEASE_ID="$candidate_release_id"
  if [[ ! "$MIGRATION_SECRET_NAME" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ \
      || ! "$MIGRATION_PASSWORD_KEY" =~ ^[-._A-Za-z][-._A-Za-z0-9]*$ ]]; then
    rollback_and_fail "MIGRATION_SECRET_REF_INVALID" \
      "Migration Secret name or key is invalid" \
      "Use a DNS-compatible Secret name and a Kubernetes-compatible key"
  fi
  if ! kubectl -n "$NAMESPACE" get secret "$MIGRATION_SECRET_NAME" -o json |
      jq -e --arg key "$MIGRATION_PASSWORD_KEY" \
        '.data[$key] | type == "string" and length > 0' >/dev/null; then
    rollback_and_fail "MIGRATION_SECRET_UNAVAILABLE" \
      "Migration Secret or required key is unavailable" \
      "Provision $MIGRATION_SECRET_NAME/$MIGRATION_PASSWORD_KEY without placing its value in a Deployment"
  fi
  log_cmd "kubectl patch deployment/$DEPLOYMENT image=$IMAGE_NAME release-id=$candidate_release_id"
  if ! kubectl -n "$NAMESPACE" patch "deployment/$DEPLOYMENT" --type='strategic' \
    -p="{\"spec\":{\"template\":{\"metadata\":{\"labels\":{\"resonance.ai/release-id\":\"$candidate_release_id\"}},\"spec\":{\"containers\":[{\"name\":\"$CONTAINER\",\"image\":\"$IMAGE_NAME\",\"env\":[{\"name\":\"CARBONET_REPORT_OCR_URL\",\"value\":\"http://carbonet-report-ocr:8091/v1/report-ocr\"},{\"name\":\"CARBONET_TEST_ACCOUNT_SWITCH_ENABLED\",\"value\":\"true\"},{\"name\":\"CARBONET_TEST_ACCOUNT_SWITCH_PASSWORD\",\"valueFrom\":{\"secretKeyRef\":{\"name\":\"carbonet-test-account-switch\",\"key\":\"password\",\"optional\":true}}},{\"name\":\"SPRING_FLYWAY_PASSWORD\",\"value\":null,\"valueFrom\":{\"secretKeyRef\":{\"name\":\"$MIGRATION_SECRET_NAME\",\"key\":\"$MIGRATION_PASSWORD_KEY\"}}}]}]}}}}" \
    2>"$KUBECTL_ERROR_LOG" >/dev/null; then
    log_error "kubectl candidate patch failed:"
    tail -20 "$KUBECTL_ERROR_LOG"
    rollback_and_fail "SET_IMAGE_FAILED" \
      "Failed to set deployment image and candidate release label" \
      "kubectl -n $NAMESPACE get deployment/$DEPLOYMENT -o yaml"
  fi
  if ! kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o json |
      jq -e --arg container "$CONTAINER" --arg secret "$MIGRATION_SECRET_NAME" --arg key "$MIGRATION_PASSWORD_KEY" '
        [.spec.template.spec.containers[]
          | select(.name == $container)
          | .env[]?
          | select(.name == "SPRING_FLYWAY_PASSWORD")]
        == [{
          "name": "SPRING_FLYWAY_PASSWORD",
          "valueFrom": {"secretKeyRef": {"name": $secret, "key": $key}}
        }]
      ' >/dev/null; then
    rollback_and_fail "MIGRATION_SECRET_REF_FAILED" \
      "Candidate runtime did not retain the exact migration SecretKeyRef" \
      "Inspect deployment/$DEPLOYMENT without reading Secret data"
  fi

  log_detail "Ensuring imagePullPolicy allows local registry reuse..."
  kubectl -n "$NAMESPACE" patch "deployment/$DEPLOYMENT" --type='json' \
    -p="[{\"op\":\"replace\",\"path\":\"/spec/template/spec/containers/0/imagePullPolicy\",\"value\":\"IfNotPresent\"}]" \
    >/dev/null 2>&1 || true

  local target_commit_annotation="${CARBONET_TARGET_COMMIT:-}"
  if [[ -n "$target_commit_annotation" && ! "$target_commit_annotation" =~ ^[0-9a-f]{40}$ ]]; then
    rollback_and_fail "TARGET_COMMIT_INVALID" \
      "Candidate target commit annotation is invalid" \
      "Provide CARBONET_TARGET_COMMIT as an exact 40-character Git commit"
  fi
  local -a release_annotations=(
    "resonance.ai/image=$IMAGE_NAME"
    "resonance.ai/released-at=$(date -Iseconds)"
  )
  if [[ -n "$target_commit_annotation" ]]; then
    release_annotations+=("resonance.ai/target-commit=$target_commit_annotation")
  fi
  kubectl -n "$NAMESPACE" annotate "deployment/$DEPLOYMENT" \
    "${release_annotations[@]}" --overwrite >/dev/null 2>&1 ||
    rollback_and_fail "RELEASE_ANNOTATION_FAILED" \
      "Failed to persist candidate release identity" \
      "kubectl -n $NAMESPACE get deployment/$DEPLOYMENT -o yaml"

  log_detail "Ensuring runtime port and E4B generator selector endpoint..."
  kubectl -n "$NAMESPACE" set env "deployment/$DEPLOYMENT" \
    SERVER_PORT=8080 CARBONET_KRDS_AI_BASE_URL="$E4B_RUNTIME_BASE_URL" \
    >/dev/null 2>&1 || rollback_and_fail "SET_ENV_FAILED" \
      "Failed to set runtime port or E4B endpoint" \
      "kubectl -n $NAMESPACE set env deployment/$DEPLOYMENT SERVER_PORT=8080 CARBONET_KRDS_AI_BASE_URL=$E4B_RUNTIME_BASE_URL"

  log_detail "Waiting for candidate pods (timeout: 180s; protected old-pod drain continues asynchronously)..."
  local rollout_started rollout_elapsed
  rollout_started="$(date +%s)"
  local desired_replicas candidate_selector candidate_count
  desired_replicas="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o jsonpath='{.spec.replicas}')"
  candidate_selector="app=$DEPLOYMENT,resonance.ai/release-id=$candidate_release_id"
  candidate_count=0
  for _ in $(seq 1 180); do
    candidate_count="$(kubectl -n "$NAMESPACE" get pods -l "$candidate_selector" --no-headers 2>/dev/null | wc -l | tr -d ' ')"
    [[ "$candidate_count" == "$desired_replicas" ]] && break
    sleep 1
  done
  if [[ "$candidate_count" != "$desired_replicas" ]] || \
    ! kubectl -n "$NAMESPACE" wait --for=condition=Ready pod \
      -l "$candidate_selector" --timeout=180s 2>"$KUBECTL_ERROR_LOG"; then
    log_error "Candidate readiness gate failed:"
    tail -30 "$KUBECTL_ERROR_LOG"
    rollback_and_fail "ROLLOUT_FAILED" \
      "Candidate pods did not reach the desired Ready replica count" \
      "kubectl -n $NAMESPACE get pods -l '$candidate_selector' -o wide"
  fi
  rollout_elapsed=$(( $(date +%s) - rollout_started ))
  if (( rollout_elapsed > 60 )); then
    log_warning "Rollout exceeded the 60s performance target (${rollout_elapsed}s); availability and health gates still passed"
  else
    log_success "Rollout performance target passed (${rollout_elapsed}s <= 60s)"
  fi

  log_success "Rolled out"
}

verify_runtime() {
  log_step "Verify"

  local pod
  local pod_selector="app=$DEPLOYMENT"
  if [[ -n "${CANDIDATE_RELEASE_ID:-}" ]]; then
    pod_selector+=",resonance.ai/release-id=$CANDIDATE_RELEASE_ID"
  fi
  pod="$(
    kubectl -n "$NAMESPACE" get pods -l "$pod_selector" \
      --field-selector=status.phase=Running -o json 2>/dev/null |
      jq -r --arg image "$IMAGE_NAME" '
        [.items[]
          | select(any(.spec.containers[]; .image == $image))
          | select(any(.status.conditions[]?; .type == "Ready" and .status == "True"))
          | .metadata.name][0] // empty'
  )"

  if [[ -z "$pod" ]]; then
    rollback_and_fail "VERIFICATION_FAILED" \
      "No running pod found for verification" \
      "kubectl -n $NAMESPACE get pods -l app=$DEPLOYMENT"
  fi

  echo -n "  Health Check: "
  local h
  h="$(kubectl -n $NAMESPACE exec "$pod" -- curl -sf --max-time 15 "http://localhost:8080/actuator/health" 2>/dev/null || echo FAILED)"

  if [[ "$h" == "FAILED" ]]; then
    log_error "Health check failed"
    rollback_and_fail "HEALTH_FAILED" \
      "Application health check failed" \
      "kubectl -n $NAMESPACE exec $pod -- curl -sf http://localhost:8080/actuator/health"
  fi

  echo -e "${GREEN}UP${NC}"

  echo -n "  Pod: "
  echo -e "${GREEN}$pod${NC}"

  if ! kubectl -n "$NAMESPACE" exec "$pod" -- curl -sf --max-time 15 -o /dev/null "http://localhost:8080/home"; then
    rollback_and_fail "HOME_SMOKE_TEST_FAILED" "Public home page did not return a successful response" \
      "kubectl -n $NAMESPACE exec $pod -- curl -i http://localhost:8080/home"
  fi
  local manifest_ready=false
  for manifest_attempt in 1 2 3 4 5; do
    if kubectl -n "$NAMESPACE" exec "$pod" -- \
      curl -sf --max-time 15 -o /dev/null \
        "http://localhost:8080/assets/react/.vite/manifest.json"; then
      manifest_ready=true
      break
    fi
    sleep 1
  done
  if [[ "$manifest_ready" != true ]]; then
    rollback_and_fail "REACT_MANIFEST_SMOKE_TEST_FAILED" "Immutable React manifest is unavailable" \
      "kubectl -n $NAMESPACE exec $pod -- curl -i http://localhost:8080/assets/react/.vite/manifest.json"
  fi
  if [[ "$IMMUTABLE_FRONTEND_IMAGE" != "true" ]]; then
    guard_frontend_overlay verify-http
  fi

  log_success "Verified"
}

ensure_pdb() {
  if ! kubectl -n "$NAMESPACE" get pdb "$DEPLOYMENT-pdb" >/dev/null 2>&1; then
    log_detail "Creating PodDisruptionBudget..."
    kubectl apply -f - >/dev/null 2>&1 <<EOF
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: $DEPLOYMENT-pdb
  namespace: $NAMESPACE
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: $DEPLOYMENT
EOF
    log_success "PDB created"
  else
    log "PDB already exists"
  fi
}

print_summary() {
  local total_time=${1:-0}
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  BUILD-DEPLOY SUCCESS${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo -e "  ${CYAN}Total Time:${NC} ${total_time}s"
  echo -e "  ${CYAN}Image:${NC} $IMAGE_NAME"
  echo ""
  echo "  Pods:"
  kubectl -n $NAMESPACE get pods -l app=$DEPLOYMENT -o wide 2>/dev/null | grep -v NAME | awk '{print "    "$1" ("$3") "$4" "$5}'
  echo ""
  echo -e "${BLUE}Error Logs:${NC} $ERROR_LOG_DIR/"
  echo -e "${BLUE}Diagnostic Log:${NC} $DIAGNOSTIC_LOG"
}

main() {
  local start_time=$(date +%s)

  init_error_logging

  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  Carbonet Build-Deploy v$SCRIPT_VERSION${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""

  for arg in "$@"; do
    case "$arg" in
      --dry-run) DRY_RUN=true; shift
        echo "  Mode: DRY-RUN"
        ;;
      --skip-preflight) SKIP_PREFLIGHT=true; shift
        echo "  Pre-flight: SKIPPED"
        ;;
      --skip-notify) SKIP_NOTIFY=true; shift
        echo "  Notifications: DISABLED"
        ;;
      --skip-frontend) SKIP_FRONTEND=true; shift
        echo "  Frontend: SKIPPED"
        ;;
      --skip-maven) SKIP_MAVEN=true; SKIP_BACKEND=true; shift
        echo "  Backend: SKIPPED (--skip-maven compatibility)"
        ;;
      --skip-backend) SKIP_BACKEND=true; shift
        echo "  Backend: SKIPPED"
        ;;
      --skip-image) SKIP_IMAGE_BUILD=true; shift
        echo "  Image Build: SKIPPED"
        ;;
      --incremental) INCREMENTAL=true; shift
        echo "  Build Mode: INCREMENTAL"
        ;;
      --force) FORCE=true; shift
        echo "  Force: ENABLED"
        ;;
    esac
  done

  if [[ "$SKIP_IMAGE_BUILD" == "true" ]]; then
    current_image="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || true)"
    if [[ -n "$current_image" ]]; then
      IMAGE_NAME="$current_image"
    fi
  fi

  echo "  Namespace: $NAMESPACE"
  echo "  Deployment: $DEPLOYMENT"
  echo "  Image: $IMAGE_NAME"
  echo ""

  acquire_lock

  if ! bash "$ROOT_DIR/ops/scripts/validate-carbonet-web-nodeport-client-ip-contract.sh"; then
    rollback_and_fail "CARBONET_WEB_CLIENT_IP_MANIFEST_INVALID" \
      "Canonical carbonet-web Service manifest violates the client-IP preservation contract" \
      "bash $ROOT_DIR/ops/scripts/validate-carbonet-web-nodeport-client-ip-contract.sh"
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY-RUN - Would execute: preflight, build_frontend, sync_overlay, build_backend, build_image, rollout_image, verify"
    echo ""
    echo -e "${YELLOW}DRY-RUN complete (no changes made)${NC}"
    release_lock
    exit 0
  fi

  notify "START" "Build deploy started" ""

  if [[ "$SKIP_PREFLIGHT" != "true" ]]; then
    preflight_check
  fi

  if [[ "$IMMUTABLE_FRONTEND_IMAGE" == "true" ]]; then
    log_step "Immutable Frontend Build"
    if [[ "$SKIP_FRONTEND" != "true" && "$SKIP_BACKEND" != "true" \
       && "$CARBONET_DEFER_LIVE_MUTATIONS_UNTIL_POST_FLYWAY" != true ]]; then
      # Java compilation does not consume the candidate React closure. Warm
      # Gradle classes in parallel with Vite, then force only resources and the
      # executable JAR to be reassembled after the verified frontend promotion.
      # This preserves the immutable-JAR contract without serializing both
      # complete builds.
      local immutable_frontend_pid immutable_backend_pid
      local immutable_frontend_exit=0 immutable_backend_exit=0
      local immutable_parallel_started
      immutable_parallel_started="$(date +%s)"
      build_frontend & immutable_frontend_pid=$!
      build_maven & immutable_backend_pid=$!
      set +e
      wait "$immutable_frontend_pid"; immutable_frontend_exit=$?
      wait "$immutable_backend_pid"; immutable_backend_exit=$?
      set -e
      if (( immutable_frontend_exit != 0 || immutable_backend_exit != 0 )); then
        rollback_and_fail "IMMUTABLE_PARALLEL_BUILD_FAILED" \
          "Frontend/backend prebuild failed frontend=$immutable_frontend_exit backend=$immutable_backend_exit" \
          "Inspect $FRONTEND_ERROR_LOG and $MAVEN_ERROR_LOG"
      fi
      log_success "Immutable prebuilds completed concurrently in $(( $(date +%s) - immutable_parallel_started ))s"
      [[ -z "$PENDING_FRONTEND_STAGING_DIR" ]] || IMMUTABLE_FRONTEND_SOURCE_DIR="$PENDING_FRONTEND_STAGING_DIR"
      prepare_immutable_frontend
      build_maven
    else
      build_frontend
      [[ -z "$PENDING_FRONTEND_STAGING_DIR" ]] || IMMUTABLE_FRONTEND_SOURCE_DIR="$PENDING_FRONTEND_STAGING_DIR"
      prepare_immutable_frontend
      build_maven
    fi
    verify_immutable_frontend_jar
    SKIP_OVERLAY_SYNC=true
    sync_overlay
    build_image
    rollout_image
    ensure_pdb
    verify_runtime
    local immutable_total_time=$(( $(date +%s) - start_time ))
    notify "SUCCESS" "Immutable build deploy completed" ""
    print_summary "$immutable_total_time"
    release_lock
    return 0
  fi

  log_step "Parallel Build (Frontend + Backend)"
  local build_start=$(date +%s)

  local frontend_pid="" maven_pid="" frontend_exit=0 maven_exit=0

  if [[ "$CARBONET_DEFER_LIVE_MUTATIONS_UNTIL_POST_FLYWAY" == true ]]; then
    # Keep the pending frontend staging path in the parent shell while Maven runs in parallel.
    build_maven &
    maven_pid=$!
    log "Building frontend in parent while backend runs in parallel (PID: $maven_pid)..."
    build_frontend || frontend_exit=$?
    wait "$maven_pid" || maven_exit=$?
  else
    build_frontend &
    frontend_pid=$!
    build_maven &
    maven_pid=$!
    log "Waiting for frontend (PID: $frontend_pid) and backend (PID: $maven_pid)..."
    wait "$frontend_pid" || frontend_exit=$?
    wait "$maven_pid" || maven_exit=$?
  fi

  local build_elapsed=$(( $(date +%s) - build_start ))
  log_success "Parallel build completed in ${build_elapsed}s (frontend: exit=$frontend_exit, backend: exit=$maven_exit)"

  if [[ "$frontend_exit" -ne 0 ]]; then
    rollback_and_fail "FRONTEND_BUILD_FAILED" "Frontend build failed (exit: $frontend_exit)" "Check $FRONTEND_ERROR_LOG"
  fi

  if [[ "$maven_exit" -ne 0 ]]; then
    rollback_and_fail "BACKEND_BUILD_FAILED" "Backend build failed (exit: $maven_exit)" "Check $MAVEN_ERROR_LOG"
  fi

  sync_overlay
  build_image
  rollout_image
  ensure_pdb
  verify_runtime

  local total_time=$(( $(date +%s) - start_time ))

  printf '{"ts":"%s","projectId":"%s","gitSha":"%s","image":"%s","duration":%d}\n' \
    "$(date -Iseconds)" "$PROJECT_ID" \
    "$(git -C "$ROOT_DIR" rev-parse --short=12 HEAD 2>/dev/null || echo unknown)" \
    "$IMAGE_NAME" "$total_time" >> "$MANIFEST_LOG"

  notify "SUCCESS" "Build deploy completed in ${total_time}s" ""

  print_summary $total_time

  release_lock
}

main "$@"
