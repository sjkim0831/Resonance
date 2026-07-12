#!/usr/bin/env bash
#===============================================================================
# Carbonet Build-Deploy Script (Enhanced v2.1.0)
# - Detailed error logging
# - Parallel build support
# - Incremental build support
# - Better error recovery
#===============================================================================
set -euo pipefail
export RESONANCE_SUDO_PASSWORD="${RESONANCE_SUDO_PASSWORD:-qwer1234}"

SCRIPT_VERSION="2.1.0"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/build.sh
source "$ROOT_DIR/ops/scripts/build.sh" 2>/dev/null || true
init_build_tool
NAMESPACE="${NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${DEPLOYMENT:-carbonet-runtime}"
CONTAINER="${CONTAINER:-carbonet-runtime}"
SERVICE="${SERVICE:-carbonet-runtime}"
PROJECT_ID="${PROJECT_ID:-P003}"
CUBRID_HOST="${CUBRID_HOST:-postgres-haproxy.${NAMESPACE}.svc.cluster.local}"
IMAGE_NAME="${IMAGE_NAME:-localhost:5000/carbonet-runtime:$(date +%Y.%m.%d-%H%M%S-gradle)}"
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
INCREMENTAL="${INCREMENTAL:-false}"
PRE_ROLLOUT_IMAGE="${PRE_ROLLOUT_IMAGE:-}"

RELEASE_DIR="$ROOT_DIR/var/releases/$PROJECT_ID/image-context"
RUN_DIR="$ROOT_DIR/var/run"
LOG_DIR="$ROOT_DIR/var/logs"
BACKUP_DIR="$ROOT_DIR/var/backups/k8s"
ERROR_LOG_DIR="$RUN_DIR/build-errors"
EVENT_LOG="$ROOT_DIR/var/ai-runtime/k8s-build-deploy-events.jsonl"
MANIFEST_LOG="$ROOT_DIR/var/ai-runtime/k8s-release-manifest.jsonl"
LOCK_FILE="$RUN_DIR/resonance-k8s-build-deploy-80.lock"
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

  if [[ -n "${PRE_ROLLOUT_IMAGE:-}" ]]; then
    log_warning "Restoring previous deployment image: $PRE_ROLLOUT_IMAGE"
    kubectl -n "$NAMESPACE" set image "deployment/$DEPLOYMENT" "$CONTAINER=$PRE_ROLLOUT_IMAGE" >/dev/null 2>&1 || true
    kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=180s >/dev/null 2>&1 || true
  else
    log_warning "No previous deployment image captured; leaving deployment unchanged"
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
  if ! "$FRONTEND_GUARD_SCRIPT" "$action" >> "$DIAGNOSTIC_LOG" 2>&1; then
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

  if [[ -d "$FRONTEND_DIR/node_modules" ]]; then
    log "Using incremental build (node_modules exists, skipping npm ci)"
    log_cmd "cd $FRONTEND_DIR && npm run build"
    cd "$FRONTEND_DIR" && npm run build > >(tee "$FRONTEND_ERROR_LOG") 2>&1 || {
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
      npm run build > >(tee -a "$FRONTEND_ERROR_LOG") 2>&1 || {
      log_error "Frontend build failed"
      rollback_and_fail "FRONTEND_BUILD_FAILED" \
        "Frontend npm ci/build failed" \
        "cd $FRONTEND_DIR && npm run build 2>&1 | tail -100"
    }
  fi

  validate_frontend
  guard_frontend_overlay write-marker
  guard_frontend_overlay verify-source

  local elapsed=$(( $(date +%s) - start_time ))
  log_success "Frontend built in ${elapsed}s"
}

sync_overlay() {
  log_step "Sync Overlay"

  if [[ "$SKIP_OVERLAY_SYNC" == "true" ]]; then
    log "Skipped (SKIP_OVERLAY_SYNC=true)"
    guard_frontend_overlay verify-local
    guard_frontend_overlay verify-source
    return
  fi

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
      root_cmd rm -rf "$MAVEN_DIR/build"
    else
      log_cmd "root_cmd rm -rf $MAVEN_DIR/target/classes/static"
      root_cmd rm -rf "$MAVEN_DIR/target/classes/static"
    fi
  else
    log "Using incremental ${BUILD_TOOL:-backend} build"
  fi

  log_cmd "jbuild -q -pl apps/carbonet-api -am -Dmaven.test.skip=true package"
  cd "$ROOT_DIR" && \
    MAVEN_OPTS="$MAVEN_OPTS" jbuild -q -pl apps/carbonet-api -am -Dmaven.test.skip=true package \
    > >(tee "$MAVEN_ERROR_LOG") 2>&1 || {
    log_error "Backend build failed"
    rollback_and_fail "BACKEND_BUILD_FAILED" \
      "Backend build failed" \
      "cd $ROOT_DIR && ./gradlew :apps:carbonet-api:bootJar --console=plain 2>&1 | tail -100"
  }

  validate_maven

  local elapsed=$(( $(date +%s) - start_time ))
  log_success "Backend built in ${elapsed}s"
}

prepare_immutable_frontend() {
  [[ "$IMMUTABLE_FRONTEND_IMAGE" == "true" ]] || return 0
  local frontend_dir="$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static/react-app"
  local backend_dir="$ROOT_DIR/apps/carbonet-api/src/main/resources/static/react-app"
  node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$frontend_dir"
  root_cmd rm -rf "$backend_dir"
  root_cmd mkdir -p "$backend_dir"
  root_cmd cp -a "$frontend_dir/." "$backend_dir/"
  node "$ROOT_DIR/ops/scripts/verify-react-asset-closure.mjs" "$backend_dir"
}

verify_immutable_frontend_jar() {
  [[ "$IMMUTABLE_FRONTEND_IMAGE" == "true" ]] || return 0
  local jar_path jar_entries expected_file
  jar_path="$(jbooted project-runtime)"
  jar_entries="$(mktemp)"
  expected_file="$(mktemp)"
  jar tf "$jar_path" > "$jar_entries"
  find "$ROOT_DIR/apps/carbonet-api/src/main/resources/static/react-app" -type f \
    -printf 'BOOT-INF/classes/static/react-app/%P\n' | sort > "$expected_file"
  if [[ -n "$(comm -23 "$expected_file" <(sort "$jar_entries") | head -1)" ]]; then
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

  rm -rf "$RELEASE_DIR" && mkdir -p "$RELEASE_DIR/lib" "$RELEASE_DIR/config"

  log_detail "Copying JAR to release directory..."
  local runtime_jar
  runtime_jar="$(jbooted project-runtime)"
  cp "$runtime_jar" "$RELEASE_DIR/carbonet-api.jar" || {
    rollback_and_fail "RELEASE_PREP_FAILED" \
      "Failed to copy JAR to release directory" \
      "cp $(jbooted project-runtime) $RELEASE_DIR/carbonet-api.jar"
  }

  if [[ -f "$ROOT_DIR/third_party/kisa/kr.or.kisa.dapc.core-1.0.0.jar" ]]; then
    log_detail "Copying KISA library..."
    cp "$ROOT_DIR/third_party/kisa/kr.or.kisa.dapc.core-1.0.0.jar" "$RELEASE_DIR/lib/"
  fi

  log_detail "Copying config files..."
  mkdir -p "$RELEASE_DIR/ops/config"
  cp -r "$ROOT_DIR/ops/config/"* "$RELEASE_DIR/ops/config/" 2>/dev/null || true

  log_cmd "docker build --build-arg PROJECT_ID=$PROJECT_ID -t $IMAGE_NAME $RELEASE_DIR"

  if root_cmd docker build --build-arg PROJECT_ID="$PROJECT_ID" --build-arg BUILDKIT_INLINE_CACHE=1 \
    --cache-from "type=registry,ref=$IMAGE_NAME" --cache-from "type=registry,ref=${IMAGE_NAME%-*}:*" \
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

  if [[ "$PUSH_IMAGE" == "true" ]]; then
    log_detail "Pushing image to local registry..."
    if root_cmd docker push "$IMAGE_NAME" >>"$DOCKER_ERROR_LOG" 2>&1; then
      log_success "Image pushed to local registry"
    else
      log_warning "Image push failed; continuing with containerd import for single-node rollout"
      tail -20 "$DOCKER_ERROR_LOG" >> "$DIAGNOSTIC_LOG" 2>/dev/null || true
    fi
  fi

  log_detail "Importing to containerd..."
  local import_success=false
  local import_err="/opt/Resonance/var/run/ctr-import-$$.log"
  local tmp_tar="/opt/Resonance/var/run/docker-save-$$.tar"

  for ((i=1; i<=3; i++)); do
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
  if [[ -n "$PRE_ROLLOUT_IMAGE" ]]; then
    log_detail "Previous deployment image: $PRE_ROLLOUT_IMAGE"
  fi

  local image_sha
  image_sha="$(root_cmd sh -c "docker inspect '$IMAGE_NAME' --format='{{.Id}}' 2>/dev/null" | sed 's/sha256://' | cut -c1-12)" || image_sha=""

  log_cmd "ctr -n k8s.io images list | grep $IMAGE_NAME"
  local ctr_found=false

  if [[ -n "$image_sha" ]]; then
    if root_cmd ctr -n k8s.io images list 2>/dev/null | grep -q "$image_sha"; then
      ctr_found=true
      log_success "Image verified in containerd (SHA: ${image_sha:0:12})"
    fi
  fi

  if ! "$ctr_found"; then
    if root_cmd ctr -n k8s.io images list 2>/dev/null | grep -q "$IMAGE_NAME"; then
      ctr_found=true
      log_success "Image verified in containerd"
    fi
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

  log_cmd "kubectl set image deployment/$DEPLOYMENT $CONTAINER=$IMAGE_NAME"
  if ! kubectl -n "$NAMESPACE" set image "deployment/$DEPLOYMENT" "$CONTAINER=$IMAGE_NAME" 2>"$KUBECTL_ERROR_LOG"; then
    log_error "kubectl set image failed:"
    tail -20 "$KUBECTL_ERROR_LOG"
    rollback_and_fail "SET_IMAGE_FAILED" \
      "Failed to set deployment image" \
      "kubectl -n $NAMESPACE set image deployment/$DEPLOYMENT $CONTAINER=$IMAGE_NAME"
  fi

  log_detail "Ensuring imagePullPolicy allows local registry reuse..."
  kubectl -n "$NAMESPACE" patch "deployment/$DEPLOYMENT" --type='json' \
    -p="[{\"op\":\"replace\",\"path\":\"/spec/template/spec/containers/0/imagePullPolicy\",\"value\":\"IfNotPresent\"}]" \
    >/dev/null 2>&1 || true

  kubectl -n "$NAMESPACE" annotate "deployment/$DEPLOYMENT" \
    "resonance.ai/image=$IMAGE_NAME" "resonance.ai/released-at=$(date -Iseconds)" \
    --overwrite >/dev/null 2>&1

  log_detail "Ensuring runtime SERVER_PORT matches Kubernetes probes..."
  kubectl -n "$NAMESPACE" set env "deployment/$DEPLOYMENT" SERVER_PORT=8080 \
    >/dev/null 2>&1 || rollback_and_fail "SET_ENV_FAILED" \
      "Failed to set SERVER_PORT=8080" \
      "kubectl -n $NAMESPACE set env deployment/$DEPLOYMENT SERVER_PORT=8080"

  log_detail "Waiting for rollout (timeout: 600s)..."
  if ! kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=600s 2>"$KUBECTL_ERROR_LOG"; then
    log_error "Rollout status failed:"
    tail -30 "$KUBECTL_ERROR_LOG"
    rollback_and_fail "ROLLOUT_FAILED" \
      "Rollout timeout or failed" \
      "kubectl -n $NAMESPACE rollout status deployment/$DEPLOYMENT --timeout=120s"
  fi

  log_success "Rolled out"
}

verify_runtime() {
  log_step "Verify"

  local pod
  pod="$(kubectl -n $NAMESPACE get pods -l app=$DEPLOYMENT --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)"

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

  guard_frontend_overlay verify-http

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
    build_frontend
    prepare_immutable_frontend
    build_maven
    verify_immutable_frontend_jar
    SKIP_OVERLAY_SYNC=true
    kubectl -n "$NAMESPACE" set env deployment/"$DEPLOYMENT" \
      CARBONET_REACT_APP_FS_OVERRIDE_ENABLED=false \
      CARBONET_STATIC_FS_OVERRIDE_ENABLED=false
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

  build_frontend &
  frontend_pid=$!

  build_maven &
  maven_pid=$!

  log "Waiting for frontend (PID: $frontend_pid) and backend (PID: $maven_pid)..."

  wait $frontend_pid || frontend_exit=$?
  wait $maven_pid || maven_exit=$?

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
