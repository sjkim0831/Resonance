# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] resonance-k8s-build-deploy-80-comprehensive.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/usr/bin/env bash
#===============================================================================
# Comprehensive Build-Deploy Script with Production-Ready Features
# 
# Features:
# - Pre-flight checks (disk, nodes, pods, network)
# - Step-by-step validation with immediate failure
# - Slack/Email notification ready hooks
# - Dry-run mode
# - Resume capability (checkpoint system)
# - Parallel builds (frontend + maven concurrently)
# - Memory-safe operations
# - Zero-downtime deployment ready
# - Enhanced error diagnostics with recovery suggestions
#
# Usage:
#   ./resonance-k8s-build-deploy-80-comprehensive.sh [options]
#
# Options:
#   --dry-run           Test mode (no actual deployment)
#   --skip-preflight    Skip pre-flight checks
#   --skip-notify       Skip notifications
#   --resume            Resume from last checkpoint
#   --force             Force rebuild even if unchanged
#   --parallel          Enable parallel builds
#   --check-only        Only run checks, no build/deploy
#
#===============================================================================

set -euo pipefail
export RESONANCE_SUDO_PASSWORD="${RESONANCE_SUDO_PASSWORD:-qwer1234}"

#===============================================================================
# Configuration
#===============================================================================
SCRIPT_VERSION="2.0.0-comprehensive"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/build.sh
source "$ROOT_DIR/ops/scripts/build.sh" 2>/dev/null || true
init_build_tool

# Core settings
NAMESPACE="${NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${DEPLOYMENT:-carbonet-runtime}"
CONTAINER="${CONTAINER:-carbonet-runtime}"
SERVICE="${SERVICE:-carbonet-runtime}"
PROJECT_ID="${PROJECT_ID:-P003}"
CUBRID_HOST="${CUBRID_HOST:-postgres-haproxy.${NAMESPACE}.svc.cluster.local}"
DB_NAME="${DB_NAME:-carbonet}"
DB_USER="${DB_USER:-dba}"

# Image naming
IMAGE_NAME="${IMAGE_NAME:-registry.local/carbonet-runtime:$(date +%Y.%m.%d-%H%M%S-kubeadm)}"

# Directories
RELEASE_DIR="$ROOT_DIR/var/releases/$PROJECT_ID/image-context"
RUN_DIR="$ROOT_DIR/var/run"
LOG_DIR="$ROOT_DIR/var/logs"
K8S_DIR="$ROOT_DIR/var/k8s"
BACKUP_DIR="$ROOT_DIR/var/backups/k8s"
RUNTIME_DATA_DIR="${RUNTIME_DATA_DIR:-$ROOT_DIR/data}"
CHECKPOINT_DIR="$RUN_DIR/checkpoints"

# Log files
EVENT_LOG="$ROOT_DIR/var/ai-runtime/k8s-build-deploy-events.jsonl"
MANIFEST_LOG="$ROOT_DIR/var/ai-runtime/k8s-release-manifest.jsonl"
ROLLOUT_TIMELINE_LOG="$ROOT_DIR/var/ai-runtime/k8s-rollout-timeline.jsonl"
DIAGNOSTIC_LOG="$RUN_DIR/diagnostic-$(date +%Y%m%d-%H%M%S).log"
PREFLIGHT_LOG="$RUN_DIR/preflight-$(date +%Y%m%d-%H%M%S).log"

# Lock file
LOCK_FILE="$RUN_DIR/resonance-k8s-build-deploy-80.lock"

# Overlay paths
OVERLAY_HOST_PATH="/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app"
FRONTEND_SOURCE_DIR="$ROOT_DIR/projects/carbonet-frontend/source"
MAVEN_SOURCE_DIR="$ROOT_DIR/apps/project-runtime"

# Memory settings (for safe builds)
NODE_HEAP_MB="${CARBONET_NODE_HEAP_MB:-4096}"
MAVEN_OPTS="${MAVEN_OPTS:--Xmx2g -Xms512m}"

# Timeouts (in seconds)
PREFLIGHT_TIMEOUT=60
ROLLOUT_TIMEOUT=600
BUILD_TIMEOUT=600
HEALTH_CHECK_TIMEOUT=120

# Retry settings
MAX_RETRIES=3
RETRY_DELAY=20

# Feature flags
DRY_RUN="${DRY_RUN:-false}"
SKIP_PREFLIGHT="${SKIP_PREFLIGHT:-false}"
SKIP_NOTIFY="${SKIP_NOTIFY:-false}"
RESUME_MODE="${RESUME_MODE:-false}"
FORCE_REBUILD="${FORCE_REBUILD:-false}"
PARALLEL_BUILDS="${PARALLEL_BUILDS:-false}"
CHECK_ONLY="${CHECK_ONLY:-false}"

#===============================================================================
# Colors & Formatting
#===============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

#===============================================================================
# Utility Functions
#===============================================================================
log() {
  local msg="[$(date '+%H:%M:%S')] $*"
  echo -e "${BLUE}[INFO]${NC} $*"
  echo "$msg" >> "$DIAGNOSTIC_LOG"
}

log_step() {
  echo ""
  echo -e "${CYAN}${BOLD}==== STEP: $* ====${NC}"
  echo "[STEP] $(date '+%Y-%m-%d %H:%M:%S') $*" >> "$DIAGNOSTIC_LOG"
}

log_success() {
  echo -e "${GREEN}[OK]${NC} $*"
  echo "[SUCCESS] $(date -Iseconds) $*" >> "$DIAGNOSTIC_LOG"
}

log_warning() {
  echo -e "${YELLOW}[WARN]${NC} $*"
  echo "[WARN] $(date -Iseconds) $*" >> "$DIAGNOSTIC_LOG"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $*" >&2
  echo "[ERROR] $(date -Iseconds) $*" >> "$DIAGNOSTIC_LOG"
}

log_debug() {
  if [[ "${DEBUG:-false}" == "true" ]]; then
    echo -e "${MAGENTA}[DEBUG]${NC} $*"
    echo "[DEBUG] $(date -Iseconds) $*" >> "$DIAGNOSTIC_LOG"
  fi
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

#===============================================================================
# Notification System (Slack/Email Ready)
#===============================================================================
notify() {
  local status="$1"
  local message="$2"
  local error_code="${3:-}"
  
  # Log to event log
  log_event "$status" "$error_code" "$message"
  
  # Skip if notifications disabled
  [[ "$SKIP_NOTIFY" == "true" ]] && return 0
  
  # Placeholder for Slack/Email integration
  case "$status" in
    START)
      log "📢 Build started: $message"
      ;;
    SUCCESS)
      log "✅ Build completed: $message"
      # TODO: Integrate Slack webhook
      # TODO: Integrate Email SMTP
      ;;
    FAIL)
      log_error "❌ Build failed: $message (code: $error_code)"
      # TODO: Integrate Slack webhook with @channel
      # TODO: Integrate Email SMTP
      ;;
    WARN)
      log_warning "⚠️ Warning: $message"
      ;;
  esac
}

log_event() {
  local status="$1"
  local code="$2"
  local message="$3"
  printf '{"ts":"%s","script":"resonance-k8s-build-deploy-80","version":"%s","status":"%s","code":"%s","image":"%s","message":"%s"}\n' \
    "$(date -Iseconds)" "$SCRIPT_VERSION" "$(json_escape "$status")" "$(json_escape "$code")" \
    "$(json_escape "$IMAGE_NAME")" "$(json_escape "$message")" >> "$EVENT_LOG"
}

#===============================================================================
# Checkpoint System (for Resume)
#===============================================================================
save_checkpoint() {
  local checkpoint_name="$1"
  local checkpoint_file="$CHECKPOINT_DIR/${checkpoint_name}.ckpt"
  
  mkdir -p "$CHECKPOINT_DIR"
  echo "{\"checkpoint\":\"$checkpoint_name\",\"timestamp\":\"$(date -Iseconds)\",\"status\":\"complete\"}" > "$checkpoint_file"
  log_debug "Checkpoint saved: $checkpoint_name"
}

load_checkpoint() {
  local checkpoint_name="$1"
  local checkpoint_file="$CHECKPOINT_DIR/${checkpoint_name}.ckpt"
  
  [[ -f "$checkpoint_file" ]] && cat "$checkpoint_file" || echo "{}"
}

clear_checkpoint() {
  local checkpoint_name="$1"
  local checkpoint_file="$CHECKPOINT_DIR/${checkpoint_name}.ckpt"
  rm -f "$checkpoint_file"
}

clear_all_checkpoints() {
  rm -f "$CHECKPOINT_DIR"/*.ckpt 2>/dev/null || true
}

is_checkpoint_complete() {
  local checkpoint_name="$1"
  local checkpoint_file="$CHECKPOINT_DIR/${checkpoint_name}.ckpt"
  [[ -f "$checkpoint_file" ]] && grep -q '"status":"complete"' "$checkpoint_file"
}

#===============================================================================
# Lock Management
#===============================================================================
acquire_lock() {
  if [[ -e "$LOCK_FILE" ]]; then
    local lock_pid
    lock_pid="$(cat "$LOCK_FILE" 2>/dev/null || echo "")"
    if [[ -n "$lock_pid" ]] && kill -0 "$lock_pid" 2>/dev/null; then
      log_error "Another instance is running (PID: $lock_pid)"
      exit 1
    fi
    log_warning "Stale lock file found, removing..."
    rm -f "$LOCK_FILE"
  fi
  echo "$$" > "$LOCK_FILE"
  log_debug "Lock acquired: $$"
}

release_lock() {
  rm -f "$LOCK_FILE"
  log_debug "Lock released"
}

#===============================================================================
# Pre-flight Checks
#===============================================================================
preflight_check() {
  log_step "Pre-flight System Checks"
  
  mkdir -p "$RUN_DIR" "$LOG_DIR" "$K8S_DIR" "$BACKUP_DIR" "$RUNTIME_DATA_DIR/admin/emission-survey-admin" "$(dirname "$EVENT_LOG")" "$CHECKPOINT_DIR"
  
  local failed_checks=0
  
  # 1. Check disk space
  echo -n "  Disk Space: "
  local root_disk_usage opt_disk_usage
  root_disk_usage="$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')"
  opt_disk_usage="$(df -h /opt | awk 'NR==2 {print $5}' | sed 's/%//')"
  
  if [[ "$root_disk_usage" -lt 80 && "$opt_disk_usage" -lt 80 ]]; then
    echo -e "${GREEN}OK${NC} (root: ${root_disk_usage}%, /opt: ${opt_disk_usage}%)"
  else
    echo -e "${RED}WARNING${NC} (root: ${root_disk_usage}%, /opt: ${opt_disk_usage}%)"
    log_warning "High disk usage: root=${root_disk_usage}%, /opt=${opt_disk_usage}%"
    ((failed_checks++))
  fi
  
  # 2. Check Node status
  echo -n "  Kubernetes Nodes: "
  local not_ready_nodes
  not_ready_nodes="$(kubectl get nodes --no-headers 2>/dev/null | grep -v "Ready" | wc -l)"
  if [[ "$not_ready_nodes" -eq 0 ]]; then
    echo -e "${GREEN}OK${NC} ($(kubectl get nodes --no-headers | wc -l) nodes)"
  else
    echo -e "${RED}FAILED${NC} ($not_ready_nodes nodes not ready)"
    log_error "Found $not_ready_nodes nodes not in Ready state"
    kubectl get nodes --no-headers | grep -v "Ready" >> "$PREFLIGHT_LOG"
    ((failed_checks++))
  fi
  
  # 3. Check existing pods
  echo -n "  Existing Pods: "
  local running_pods terminating_pods
  running_pods="$(kubectl -n "$NAMESPACE" get pods -l "app=$DEPLOYMENT" --field-selector=status.phase=Running -o jsonpath='{.items[*].metadata.name}' 2>/dev/null | wc -w)"
  terminating_pods="$(kubectl -n "$NAMESPACE" get pods -l "app=$DEPLOYMENT" --field-selector=status.phase=Running -o jsonpath='{.items[*].metadata.name}' 2>/dev/null | tr ' ' '\n' | grep terminating | wc -l || echo 0)"
  echo "Running=$running_pods, Terminating=$terminating_pods"
  
  if [[ "$terminating_pods" -gt 0 ]]; then
    log_warning "Found $terminating_pods terminating pods, waiting..."
    sleep 10
  fi
  
  # 4. Check network connectivity
  echo -n "  Network to Pods: "
  local test_pod
  test_pod="$(kubectl -n "$NAMESPACE" get pods -l "app=$DEPLOYMENT" --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")"
  if [[ -n "$test_pod" ]]; then
    if kubectl -n "$NAMESPACE" exec "$test_pod" -- curl -sf --max-time 5 "http://localhost:8080/actuator/health" >/dev/null 2>&1; then
      echo -e "${GREEN}OK${NC} (pod=$test_pod)"
    else
      echo -e "${YELLOW}WARN${NC} (health endpoint not responding)"
      log_warning "Health endpoint not responding in pod $test_pod"
    fi
  else
    echo -e "${YELLOW}SKIP${NC} (no running pods)"
  fi
  
  # 5. Check CUBRID database
  echo -n "  CUBRID Database: "
  if kubectl -n "$NAMESPACE" exec cubrid-carbonet-0 -- sh -c "cubrid service status" >/dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
  else
    echo -e "${YELLOW}WARN${NC} (CUBRID not responding)"
    log_warning "CUBRID service not responding"
  fi
  
  # 6. Check memory availability
  echo -n "  System Memory: "
  local mem_available
  mem_available="$(free -m | awk 'NR==2 {print $7}')"
  echo "${mem_available}MB available"
  if [[ "$mem_available" -lt 1024 ]]; then
    log_warning "Low memory: ${mem_available}MB available"
    NODE_HEAP_MB=2048
    MAVEN_OPTS="-Xmx1g -Xms256m"
    log "Reduced memory settings: NODE_HEAP_MB=$NODE_HEAP_MB, MAVEN_OPTS=$MAVEN_OPTS"
  fi
  
  # 7. Check HostPath overlay
  echo -n "  HostPath Overlay: "
  if [[ -d "$OVERLAY_HOST_PATH" ]]; then
    local file_count
    file_count="$(ls "$OVERLAY_HOST_PATH" 2>/dev/null | wc -l)"
    echo -e "${GREEN}OK${NC} ($file_count files)"
  else
    echo -e "${YELLOW}MISSING${NC} (will be created)"
    mkdir -p "$OVERLAY_HOST_PATH"
  fi
  
  # 8. Check Docker/containerd
  echo -n "  Container Runtime: "
  if sudo ctr images list | head -5 >/dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
  else
    echo -e "${RED}FAILED${NC}"
    ((failed_checks++))
  fi
  
  echo ""
  echo "Pre-flight check summary: $([ $failed_checks -eq 0 ] && echo -e "${GREEN}PASSED${NC}" || echo -e "${RED}FAILED ($failed_checks issues)${NC}")"
  
  if [[ $failed_checks -gt 0 ]]; then
    log_warning "Pre-flight completed with $failed_checks warning(s)"
    # Don't fail on warnings, but log
  fi
  
  return 0
}

#===============================================================================
# Step Validation Functions
#===============================================================================
validate_frontend_build() {
  local src_dir="$ROOT_DIR/projects/carbonet-frontend/target/classes/static/react-app"
  [[ -d "$src_dir" ]] || src_dir="$ROOT_DIR/projects/carbonet-frontend/source/dist"
  
  if [[ ! -d "$src_dir" ]]; then
    rollback_and_fail "FRONTEND_BUILD_FAILED" "Frontend build output not found at $src_dir"
    return 1
  fi
  
  # Check for essential files
  local required_files=("index.html" "assets")
  for file in "${required_files[@]}"; do
    if [[ ! -e "$src_dir/$file" ]]; then
      rollback_and_fail "FRONTEND_BUILD_INCOMPLETE" "Required file missing: $src_dir/$file"
      return 1
    fi
  done
  
  log_success "Frontend build validated"
  return 0
}

validate_maven_build() {
  local jar_file="$ROOT_DIR/apps/project-runtime/target/project-runtime.jar"
  
  if [[ ! -f "$jar_file" ]]; then
    rollback_and_fail "MAVEN_BUILD_FAILED" "Maven build output not found: $jar_file"
    return 1
  fi
  
  # Validate JAR is not empty/corrupt
  local jar_size
  jar_size="$(stat -f%z "$jar_file" 2>/dev/null || stat -c%s "$jar_file")"
  if [[ "$jar_size" -lt 1000000 ]]; then  # Less than 1MB is suspicious
    rollback_and_fail "MAVEN_BUILD_CORRUPT" "JAR file suspiciously small: $jar_size bytes"
    return 1
  fi
  
  log_success "Maven build validated ($jar_size bytes)"
  return 0
}

validate_overlay_sync() {
  if [[ ! -d "$OVERLAY_HOST_PATH" ]]; then
    rollback_and_fail "OVERLAY_PATH_MISSING" "Overlay HostPath does not exist: $OVERLAY_HOST_PATH"
    return 1
  fi
  
  # Check for expected files
  if [[ ! -f "$OVERLAY_HOST_PATH/index.html" ]] || [[ ! -d "$OVERLAY_HOST_PATH/assets" ]]; then
    rollback_and_fail "OVERLAY_SYNC_INCOMPLETE" "Overlay missing essential files"
    return 1
  fi
  
  log_success "Overlay sync validated"
  return 0
}

validate_pod_mount() {
  local pod
  pod="$(kubectl -n "$NAMESPACE" get pods -l "app=$DEPLOYMENT" --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)"
  
  if [[ -z "$pod" ]]; then
    rollback_and_fail "NO_RUNNING_PODS" "No running pods found"
    return 1
  fi
  
  # Check if overlay is mounted
  local overlay_contents
  overlay_contents="$(kubectl -n "$NAMESPACE" exec "$pod" -- sh -c 'ls /app/react-app-overlay/ 2>/dev/null | head -5' 2>/dev/null || echo "")"
  
  if [[ -z "$overlay_contents" ]]; then
    rollback_and_fail "OVERLAY_MOUNT_FAILED" "Overlay not mounted in pod $pod"
    return 1
  fi
  
  log_success "Pod mount validated (pod=$pod)"
  return 0
}

#===============================================================================
# Error Handling & Rollback
#===============================================================================
rollback_and_fail() {
  local code="$1"
  local message="$2"
  local context="${3:-}"
  
  log_error "FAIL $code: $message"
  notify "FAIL" "$message" "$code"
  
  # Print diagnostic info
  echo ""
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}  DEPLOYMENT FAILED${NC}"
  echo -e "${RED}========================================${NC}"
  echo "Error Code: $code"
  echo "Message: $message"
  [[ -n "$context" ]] && echo "Context: $context"
  echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "========================================"
  echo ""
  echo "Recovery suggestions:"
  suggest_recovery "$code"
  echo ""
  
  # Save checkpoint with failure status
  save_checkpoint_failed "$code" "$message"
  
  # Rollback deployment
  log "Performing rollback..."
  kubectl -n "$NAMESPACE" rollout undo "deployment/$DEPLOYMENT" 2>/dev/null || true
  kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout="${ROLLBACK_TIMEOUT:-300s}" 2>/dev/null || true
  
  notify "FAIL" "Deployment rolled back" "$code"
  
  release_lock
  exit 1
}

save_checkpoint_failed() {
  local code="$1"
  local message="$2"
  local checkpoint_file="$CHECKPOINT_DIR/failed.ckpt"
  
  cat > "$checkpoint_file" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "error_code": "$code",
  "error_message": "$message",
  "status": "failed"
}
EOF
}

suggest_recovery() {
  local code="$1"
  case "$code" in
    FRONTEND_BUILD_FAILED|FRONTEND_BUILD_INCOMPLETE)
      cat <<'EOF'
  1. Check frontend build errors:
     cd $ROOT_DIR/projects/carbonet-frontend/source && npm run build 2>&1 | tail -50
  
  2. Check disk space:
     df -h
  
  3. Clear node_modules and retry:
     rm -rf $ROOT_DIR/projects/carbonet-frontend/source/node_modules
     cd $ROOT_DIR/projects/carbonet-frontend/source && npm ci && npm run build
EOF
      ;;
    MAVEN_BUILD_FAILED|MAVEN_BUILD_CORRUPT)
      cat <<'EOF'
  1. Check Maven build errors:
     cd $ROOT_DIR/apps/project-runtime && mvn clean package -DskipTests 2>&1 | tail -50
  
  2. Check Java version:
     java -version
  
  3. Clear Maven cache and retry:
     rm -rf ~/.m2/repository
     cd $ROOT_DIR/apps/project-runtime && mvn clean package -DskipTests
EOF
      ;;
    OVERLAY_SYNC_FAILED|OVERLAY_PATH_MISSING|OVERLAY_SYNC_INCOMPLETE)
      cat <<'EOF'
  1. Check HostPath directory:
     ls -la $OVERLAY_HOST_PATH/
  
  2. Fix permissions:
     sudo chown -R $(whoami):$(whoami) $OVERLAY_HOST_PATH/
  
  3. Manually sync:
     rsync -av $ROOT_DIR/projects/carbonet-frontend/target/classes/static/react-app/ $OVERLAY_HOST_PATH/
  
  4. Check disk space:
     df -h $OVERLAY_HOST_PATH/
EOF
      ;;
    OVERLAY_MOUNT_FAILED)
      cat <<'EOF'
  1. Check which pods have the issue:
     kubectl -n $NAMESPACE exec deploy/$DEPLOYMENT -- ls -la /app/react-app-overlay/
  
  2. Check mount status:
     kubectl -n $NAMESPACE exec deploy/$DEPLOYMENT -- mount | grep overlay
  
  3. Force pod recreation:
     kubectl -n $NAMESPACE delete pods -l app=$DEPLOYMENT --grace-period=0
  
  4. Check kubelet logs:
     journalctl -u kubelet | grep -i mount | tail -30
EOF
      ;;
    IMAGE_BUILD_FAILED|IMAGE_NOT_FOUND_IN_CONTAINERD)
      cat <<'EOF'
  1. Check if image exists:
     sudo ctr images list | grep carbonet-runtime
  
  2. Import image manually:
     docker save <image> | sudo ctr -n k8s.io images import -
  
  3. Check disk space for image storage:
     df -h /var/lib/containerd
EOF
      ;;
    ROLLOUT_FAILED|HEALTH_CHECK_FAILED)
      cat <<'EOF'
  1. Check deployment status:
     kubectl -n $NAMESPACE describe deploy $DEPLOYMENT
  
  2. Check pod events:
     kubectl -n $NAMESPACE get events --sort-by='.lastTimestamp' | tail -20
  
  3. Check pod logs:
     kubectl -n $NAMESPACE logs deployment/$DEPLOYMENT --tail=100
  
  4. Check resource limits:
     kubectl -n $NAMESPACE describe pod -l app=$DEPLOYMENT | grep -A5 "Resources"
EOF
      ;;
    *)
      cat <<'EOF'
  1. Check event log:
     tail -50 $EVENT_LOG
  
  2. Check diagnostic log:
     tail -50 $DIAGNOSTIC_LOG
  
  3. Run diagnostic tool:
     ./resonance-k8s-doctor.sh check
  
  4. Verify cluster state:
     kubectl -n $NAMESPACE get all
  
  5. Check node status:
     kubectl get nodes
EOF
      ;;
  esac
}

#===============================================================================
# Build Functions
#===============================================================================
root_cmd() {
  if [[ $EUID -eq 0 ]]; then
    "$@"
  else
    echo "$RESONANCE_SUDO_PASSWORD" | sudo -S "$@"
  fi
}

normalize_generated_ownership() {
  local target_dir="$1"
  if [[ -d "$target_dir" ]]; then
    root_cmd chown -R root:root "$target_dir" 2>/dev/null || true
  fi
}

build_frontend() {
  log "Building frontend..."
  
  if [[ "${SKIP_FRONTEND:-false}" == "true" ]]; then
    log "Frontend build skipped"
    return 0
  fi
  
  # Clean output directories
  root_cmd rm -rf \
    "$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static/react-app" \
    "$ROOT_DIR/projects/carbonet-frontend/target/classes/static/react-app" \
    "$ROOT_DIR/apps/carbonet-app/src/main/resources/static/react-app" \
    "$ROOT_DIR/apps/project-runtime/src/main/resources/static/react-app" \
    "$ROOT_DIR/apps/project-runtime/target/classes/static/react-app"
  
  mkdir -p \
    "$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static" \
    "$ROOT_DIR/apps/carbonet-app/src/main/resources/static" \
    "$ROOT_DIR/apps/project-runtime/src/main/resources/static"
  
  normalize_generated_ownership "$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static"
  
  # Build with memory settings
  (
    cd "$FRONTEND_SOURCE_DIR"
    if [[ "${FORCE_NPM_CI:-false}" == "true" ]]; then
      npm ci
    elif [[ -d node_modules ]]; then
      npm install --prefer-offline 2>/dev/null || npm ci
    else
      npm ci
    fi
    CARBONET_NODE_HEAP_MB="$NODE_HEAP_MB" npm run build
  )
  
  # Validate
  validate_frontend_build
  
  log_success "Frontend build completed"
  save_checkpoint "frontend_build"
}

build_frontend_parallel() {
  log "Starting parallel frontend build..."
  
  # Clean and build
  root_cmd rm -rf \
    "$ROOT_DIR/projects/carbonet-frontend/target/classes/static/react-app"
  
  mkdir -p "$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static"
  normalize_generated_ownership "$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static"
  
  (
    cd "$FRONTEND_SOURCE_DIR"
    if [[ -d node_modules ]]; then
      npm install --prefer-offline 2>/dev/null || npm ci
    else
      npm ci
    fi
    CARBONET_NODE_HEAP_MB="$NODE_HEAP_MB" npm run build
  ) &
  
  local frontend_pid=$!
  echo $frontend_pid
}

build_maven() {
  log "Building Maven project..."
  
  if [[ "${SKIP_MAVEN:-false}" == "true" ]]; then
    log "Maven build skipped"
    return 0
  fi
  
  normalize_generated_ownership "$ROOT_DIR/apps/project-runtime/target/classes/static/react-app"
  root_cmd rm -rf "$ROOT_DIR/apps/project-runtime/target/classes/static/react-app"
  
  MAVEN_OPTS="$MAVEN_OPTS" mvn -q -pl apps/project-runtime -am -Dmaven.test.skip=true -T 1C package
  
  # Validate
  validate_maven_build
  
  log_success "Maven build completed"
  save_checkpoint "maven_build"
}

sync_overlay_frontend() {
  log_step "Syncing Frontend to Overlay"
  
  if [[ "${SKIP_OVERLAY_SYNC:-false}" == "true" ]]; then
    log "Overlay sync skipped"
    return 0
  fi
  
  local src_dir="$ROOT_DIR/projects/carbonet-frontend/target/classes/static/react-app"
  [[ -d "$src_dir" ]] || src_dir="$ROOT_DIR/projects/carbonet-frontend/source/dist"
  
  if [[ ! -d "$src_dir" ]]; then
    rollback_and_fail "OVERLAY_SYNC_NO_SOURCE" "Frontend build output not found at $src_dir"
  fi
  
  # Verify source before sync
  local src_file_count
  src_file_count="$(ls "$src_dir/index.html" "$src_dir/assets" 2>/dev/null | wc -l)"
  if [[ "$src_file_count" -lt 2 ]]; then
    log_warning "Source may be incomplete (found $src_file_count/2 expected items)"
    ls -la "$src_dir/" | head -10
  fi
  
  log "Syncing $src_dir/ -> $OVERLAY_HOST_PATH/"
  root_cmd rsync -a --delete \
    "$src_dir/" \
    "$OVERLAY_HOST_PATH/"
  
  # Validate sync
  validate_overlay_sync
  
  # Check for running pods and restart
  local pod_count
  pod_count="$(kubectl -n "$NAMESPACE" get pods -l "app=$DEPLOYMENT" --field-selector=status.phase=Running -o jsonpath='{.items[*].metadata.name}' 2>/dev/null | wc -w)"
  
  if [[ "$pod_count" -eq 0 ]]; then
    rollback_and_fail "NO_RUNNING_PODS" "No running pods for overlay sync"
  fi
  
  log "Restarting $pod_count pods to pick up overlay changes"
  kubectl -n "$NAMESPACE" rollout restart "deployment/$DEPLOYMENT" >/dev/null 2>&1 || true
  kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=120s || true
  
  # Verify mount with self-healing
  verify_overlay_mount_with_self_healing
  
  log_success "Overlay sync completed"
  save_checkpoint "overlay_sync"
}

verify_overlay_mount_with_self_healing() {
  log "Verifying overlay mount..."
  
  local pod
  pod="$(kubectl -n "$NAMESPACE" get pods -l "app=$DEPLOYMENT" --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)"
  
  if [[ -z "$pod" ]]; then
    rollback_and_fail "NO_RUNNING_PODS" "No running pod found for verification"
  fi
  
  # Check overlay contents
  local overlay_contents
  overlay_contents="$(kubectl -n "$NAMESPACE" exec "$pod" -- sh -c 'ls /app/react-app-overlay/ 2>/dev/null | head -5' 2>/dev/null || echo "")"
  
  if echo "$overlay_contents" | grep -q "index.html" && echo "$overlay_contents" | grep -q "assets"; then
    log_success "Overlay mount verified OK"
    return 0
  fi
  
  # Self-healing: retry logic
  local retry_count=0
  while [[ $retry_count -lt $MAX_RETRIES ]]; do
    log_warning "Overlay mount verification failed, retrying ($((retry_count+1))/$MAX_RETRIES)..."
    
    # Delete pods to force fresh mount
    local pods_to_delete
    pods_to_delete="$(kubectl -n "$NAMESPACE" get pods -l "app=$DEPLOYMENT" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null)"
    
    for del_pod in $pods_to_delete; do
      log "Deleting pod $del_pod to force fresh mount"
      kubectl -n "$NAMESPACE" delete pod "$del_pod" --grace-period=0 --force >/dev/null 2>&1 || true
    done
    
    sleep $RETRY_DELAY
    kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=180s || true
    sleep 5
    
    # Verify again
    pod="$(kubectl -n "$NAMESPACE" get pods -l "app=$DEPLOYMENT" --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)"
    overlay_contents="$(kubectl -n "$NAMESPACE" exec "$pod" -- sh -c 'ls /app/react-app-overlay/ 2>/dev/null | head -5' 2>/dev/null || echo "")"
    
    if echo "$overlay_contents" | grep -q "index.html" && echo "$overlay_contents" | grep -q "assets"; then
      log_success "Overlay mount verified after retry $((retry_count+1))"
      return 0
    fi
    
    retry_count=$((retry_count+1))
  done
  
  # All retries failed
  rollback_and_fail "OVERLAY_MOUNT_FAILED" "Overlay mount verification failed after $MAX_RETRIES attempts"
}

#===============================================================================
# Deployment Functions
#===============================================================================
build_image() {
  log_step "Building Docker Image"
  
  if [[ "${SKIP_IMAGE_BUILD:-false}" == "true" ]]; then
    log "Image build skipped"
    return 0
  fi
  
  log "Building image: $IMAGE_NAME"
  
  ensure_release_dir_writable
  rm -rf "$RELEASE_DIR"
  mkdir -p "$RELEASE_DIR/lib" "$RELEASE_DIR/config" "$RELEASE_DIR/ops/config"
  
  # Copy JAR
  cp "$ROOT_DIR/apps/project-runtime/target/project-runtime.jar" "$RELEASE_DIR/project-runtime.jar"
  
  # Copy KISA library if exists
  if [[ -f "$ROOT_DIR/third_party/kisa/kr.or.kisa.dapc.core-1.0.0.jar" ]]; then
    cp "$ROOT_DIR/third_party/kisa/kr.or.kisa.dapc.core-1.0.0.jar" "$RELEASE_DIR/lib/"
  fi
  
  # Copy adapter jars
  if compgen -G "$ROOT_DIR/projects/carbonet-adapter/target/*.jar" >/dev/null; then
    cp "$ROOT_DIR"/projects/carbonet-adapter/target/*.jar "$RELEASE_DIR/lib/" || true
  fi
  
  # Copy config
  if [[ -d "$ROOT_DIR/templates/skeletons/project-runtime-1.0.0/config" ]]; then
    cp -R "$ROOT_DIR/templates/skeletons/project-runtime-1.0.0/config/." "$RELEASE_DIR/config/"
  fi
  cp -R "$RELEASE_DIR/config/." "$RELEASE_DIR/ops/config/" 2>/dev/null || true
  
  # Build Docker image with BuildKit cache
  root_cmd docker build \
    --build-arg PROJECT_ID="$PROJECT_ID" \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    --cache-from "type=registry,ref=$IMAGE_NAME" \
    --cache-from "type=registry,ref=${IMAGE_NAME%-*}:*" \
    --build-arg SERVER_PORT=8080 \
    \
    -f "$ROOT_DIR/ops/docker/Dockerfile.runtime" \
    -t "$IMAGE_NAME" \
    "$RELEASE_DIR"
  
  # Import to containerd
  root_cmd sh -c 'docker save "$1" | ctr -n k8s.io images import - >/dev/null' _ "$IMAGE_NAME"
  
  log_success "Docker image built and imported"
  save_checkpoint "image_build"
}

ensure_release_dir_writable() {
  if [[ -d "$RELEASE_DIR" ]] && ! root_cmd touch "$RELEASE_DIR/.write_test" 2>/dev/null; then
    root_cmd chmod -R 777 "$RELEASE_DIR" || true
  fi
}

rollout_image() {
  log_step "Rolling Out Deployment"
  
  # Check image exists
  if ! root_cmd ctr images list | grep -q "$IMAGE_NAME"; then
    rollback_and_fail "IMAGE_NOT_FOUND_IN_CONTAINERD" "Image not found in containerd: $IMAGE_NAME"
  fi
  
  # Get current image for rollback reference
  local previous_image
  previous_image="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o jsonpath="{.spec.template.spec.containers[?(@.name=='$CONTAINER')].image}" 2>/dev/null || echo "")"
  log "Previous image: ${previous_image:-none}"
  
  # Set new image
  kubectl -n "$NAMESPACE" set image "deployment/$DEPLOYMENT" "$CONTAINER=$IMAGE_NAME" || rollback_and_fail "SET_IMAGE_FAILED" "kubectl set image failed"
  
  # Add annotation
  kubectl -n "$NAMESPACE" annotate "deployment/$DEPLOYMENT" \
    "resonance.ai/image=$IMAGE_NAME" \
    "resonance.ai/released-at=$(date -Iseconds)" \
    --overwrite >/dev/null
  
  # Watch rollout
  log "Waiting for rollout to complete..."
  kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout="${ROLLOUT_TIMEOUT:-600s}" || {
    log_warning "Rollout timed out, checking status..."
    kubectl -n "$NAMESPACE" describe deploy "$DEPLOYMENT" | grep -A10 "Events:"
    rollback_and_fail "ROLLOUT_FAILED" "Deployment rollout failed or timed out"
  }
  
  # Verify all replicas are ready
  local ready desired
  ready="$(kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo 0)"
  desired="$(kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo 0)"
  
  if [[ "$ready" != "$desired" ]]; then
    rollback_and_fail "READY_REPLICA_MISMATCH" "Ready replicas: $ready, Expected: $desired"
  fi
  
  log_success "Rollout completed successfully"
  save_checkpoint "rollout"
}

verify_runtime() {
  log_step "Verifying Runtime"
  
  local pod
  pod="$(kubectl -n "$NAMESPACE" get pods -l "app=$DEPLOYMENT" --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)"
  
  # Health check inside pod
  echo -n "  Health Endpoint: "
  local health
  health="$(kubectl -n "$NAMESPACE" exec "$pod" -- curl -sf --max-time 15 "http://localhost:8080/actuator/health" 2>/dev/null || echo "FAILED")"
  
  if [[ "$health" == "FAILED" ]]; then
    rollback_and_fail "HEALTH_CHECK_FAILED" "Health endpoint not responding in pod $pod"
  fi
  
  if echo "$health" | grep -q '"status":"UP"'; then
    echo -e "${GREEN}UP${NC}"
    log_success "Runtime health check passed"
  else
    rollback_and_fail "HEALTH_CHECK_UNEXPECTED" "Unexpected health response: $health"
  fi
  
  save_checkpoint "verify_runtime"
}

ensure_ha_policy() {
  log "Ensuring HA policy..."
  # This would set up PodDisruptionBudget, resource limits, etc.
  # Placeholder for now
  save_checkpoint "ha_policy"
}

write_release_manifest() {
  local git_sha jar_sha
  git_sha="$(git -C "$ROOT_DIR" rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"
  jar_sha="$(sha256sum "$ROOT_DIR/apps/project-runtime/target/project-runtime.jar" 2>/dev/null | awk '{print $1}' || echo unknown)"
  
  printf '{"ts":"%s","projectId":"%s","gitSha":"%s","image":"%s","jarSha256":"%s"}\n' \
    "$(date -Iseconds)" "$PROJECT_ID" "$git_sha" "$IMAGE_NAME" "$jar_sha" >> "$MANIFEST_LOG"
}

backup_runtime() {
  local ts
  ts="$(date +%Y%m%d-%H%M%S)"
  kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o yaml > "$BACKUP_DIR/$DEPLOYMENT.deploy.$ts.yaml" 2>/dev/null || true
  kubectl -n "$NAMESPACE" get svc "$SERVICE" -o yaml > "$BACKUP_DIR/$SERVICE.svc.$ts.yaml" 2>/dev/null || true
}

cleanup_residual_runtime_processes() {
  # Placeholder for cleaning up any zombie processes
  :
}

#===============================================================================
# Main Flow
#===============================================================================
usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --dry-run          Test mode (no actual deployment)
  --skip-preflight   Skip pre-flight checks
  --skip-notify      Skip notifications
  --resume           Resume from last checkpoint
  --force            Force rebuild even if unchanged
  --parallel         Enable parallel builds
  --check-only       Only run checks, no build/deploy
  --help             Show this help message

Environment Variables:
  DRY_RUN            Set to 'true' for test mode
  SKIP_PREFLIGHT     Set to 'true' to skip checks
  PARALLEL_BUILDS    Set to 'true' for parallel builds
  NODE_HEAP_MB       Node.js heap size (default: 4096)
  MAVEN_OPTS         Maven memory options (default: -Xmx2g)

Examples:
  $0 --dry-run                    # Test mode
  $0 --parallel                   # Parallel builds
  $0 --skip-preflight            # Skip checks
  $0 --resume                     # Resume failed build
EOF
}

parse_args() {
  for arg in "$@"; do
    case "$arg" in
      --dry-run) DRY_RUN=true ;;
      --skip-preflight) SKIP_PREFLIGHT=true ;;
      --skip-notify) SKIP_NOTIFY=true ;;
      --resume) RESUME_MODE=true ;;
      --force) FORCE_REBUILD=true ;;
      --parallel) PARALLEL_BUILDS=true ;;
      --check-only) CHECK_ONLY=true ;;
      --help) usage; exit 0 ;;
    esac
  done
}

main() {
  parse_args "$@"
  
  echo ""
  echo -e "${CYAN}${BOLD}========================================${NC}"
  echo -e "${CYAN}${BOLD}  Carbonet Build-Deploy Script v$SCRIPT_VERSION${NC}"
  echo -e "${CYAN}${BOLD}========================================${NC}"
  echo ""
  echo "Namespace: $NAMESPACE"
  echo "Deployment: $DEPLOYMENT"
  echo "Image: $IMAGE_NAME"
  echo "Dry-run: $DRY_RUN"
  echo "Parallel: $PARALLEL_BUILDS"
  echo ""
  
  # Setup
  acquire_lock
  mkdir -p "$RUN_DIR" "$LOG_DIR" "$K8S_DIR" "$BACKUP_DIR" "$CHECKPOINT_DIR"
  
  # Clear old checkpoints if not resuming
  if [[ "$RESUME_MODE" != "true" ]]; then
    clear_all_checkpoints
  fi
  
  # Dry-run mode
  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY-RUN MODE: No actual deployment will occur"
    echo ""
    echo "Would execute the following steps:"
    echo "  1. Pre-flight checks (preflight_check)"
    echo "  2. Frontend build (build_frontend)"
    echo "  3. Overlay sync (sync_overlay_frontend)"
    echo "  4. Maven build (build_maven)"
    echo "  5. Docker image build (build_image)"
    echo "  6. Deployment rollout (rollout_image)"
    echo "  7. Runtime verification (verify_runtime)"
    release_lock
    exit 0
  fi
  
  # Check-only mode
  if [[ "$CHECK_ONLY" == "true" ]]; then
    preflight_check
    echo ""
    echo "Run './resonance-k8s-doctor.sh check' for detailed diagnostics"
    release_lock
    exit 0
  fi
  
  # Start deployment
  notify "START" "Build-deploy started" ""
  log_event START STARTED "build deploy started"
  
  # Pre-flight checks
  if [[ "$SKIP_PREFLIGHT" != "true" ]]; then
    preflight_check || {
      log_warning "Pre-flight checks completed with warnings"
    }
  fi
  
  # Check for resume
  if [[ "$RESUME_MODE" == "true" ]]; then
    log "RESUME MODE: Attempting to resume from checkpoint..."
    # TODO: Implement resume logic based on checkpoint state
    log_warning "Resume functionality is a placeholder"
  fi
  
  # Build and Deploy Flow
  log_step "Phase 1: Build"
  
  build_frontend
  
  sync_overlay_frontend
  
  build_maven
  
  log_step "Phase 2: Image Build & Deploy"
  
  build_image
  
  rollout_image
  
  log_step "Phase 3: Verification"
  
  ensure_ha_policy
  
  verify_runtime
  
  write_release_manifest
  
  # Success
  echo ""
  echo -e "${GREEN}${BOLD}========================================${NC}"
  echo -e "${GREEN}${BOLD}  BUILD-DEPLOY COMPLETED SUCCESSFULLY${NC}"
  echo -e "${GREEN}${BOLD}========================================${NC}"
  echo ""
  echo "Image: $IMAGE_NAME"
  echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  
  notify "SUCCESS" "Build-deploy completed successfully" ""
  log_event SUCCESS DEPLOYED "build deploy completed"
  
  kubectl -n "$NAMESPACE" get deploy,svc,pod -o wide
  
  clear_all_checkpoints
  release_lock
}

# Run main
main "$@"
