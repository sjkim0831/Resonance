#!/usr/bin/env bash
#===============================================================================
# Carbonet Build-Deploy Script (Enhanced)
# Version: 2.0.0-complete
#===============================================================================
set -euo pipefail
export RESONANCE_SUDO_PASSWORD="${RESONANCE_SUDO_PASSWORD:-qwer1234}"
DRY_RUN=false
SKIP_PREFLIGHT=false
SKIP_NOTIFY=false
FORCE=false
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

SCRIPT_VERSION="2.0.0-complete"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${DEPLOYMENT:-carbonet-runtime}"
CONTAINER="${CONTAINER:-carbonet-runtime}"
SERVICE="${SERVICE:-carbonet-runtime}"
PROJECT_ID="${PROJECT_ID:-P003}"
CUBRID_HOST="${CUBRID_HOST:-postgres-haproxy.${NAMESPACE}.svc.cluster.local}"
IMAGE_NAME="${IMAGE_NAME:-registry.local/carbonet-runtime:$(date +%Y.%m.%d-%H%M%S-kubeadm)}"

RELEASE_DIR="$ROOT_DIR/var/releases/$PROJECT_ID/image-context"
RUN_DIR="$ROOT_DIR/var/run"
LOG_DIR="$ROOT_DIR/var/logs"
BACKUP_DIR="$ROOT_DIR/var/backups/k8s"
EVENT_LOG="$ROOT_DIR/var/ai-runtime/k8s-build-deploy-events.jsonl"
MANIFEST_LOG="$ROOT_DIR/var/ai-runtime/k8s-release-manifest.jsonl"
LOCK_FILE="$RUN_DIR/resonance-k8s-build-deploy-80.lock"
DIAGNOSTIC_LOG="$RUN_DIR/diagnostic-$(date +%Y%m%d-%H%M%S).log"

OVERLAY_HOST_PATH="/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app"
FRONTEND_DIR="$ROOT_DIR/projects/carbonet-frontend/source"
MAVEN_DIR="$ROOT_DIR/apps/carbonet-api"

PRIMARY_APP="carbonet-api"

NODE_HEAP_MB="${CARBONET_NODE_HEAP_MB:-4096}"
MAVEN_OPTS="${MAVEN_OPTS:--Xmx2g -Xms512m}"
MAX_RETRIES=3
RETRY_DELAY=20

# Build tool detection (Gradle wins if both present)
if [[ -x "$ROOT_DIR/gradlew" ]] && [[ -f "$ROOT_DIR/settings.gradle.kts" ]]; then
    BUILD_TOOL="gradle"
    GRADLE_BIN=("$ROOT_DIR/gradlew" "-p" "$ROOT_DIR")
    PROJECT_BUILD_CMD() {
        "${GRADLE_BIN[@]}" ":apps:$PRIMARY_APP:bootJar" -x test -q
    }
    JAR_OUTPUT_PATH() { echo "$ROOT_DIR/apps/$PRIMARY_APP/build/libs/$PRIMARY_APP.jar"; }
else
    BUILD_TOOL="maven"
    PROJECT_BUILD_CMD() {
        MAVEN_OPTS="$MAVEN_OPTS" mvn -q -pl "apps/$PRIMARY_APP" -am -Dmaven.test.skip=true -T 1C package
    }
    JAR_OUTPUT_PATH() { echo "$ROOT_DIR/apps/$PRIMARY_APP/target/$PRIMARY_APP.jar"; }
fi

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $*"; echo "[$(date '+%H:%M:%S')] $*" >> "$DIAGNOSTIC_LOG"; }
log_step() { echo ""; echo -e "${CYAN}==== $* ====${NC}"; }
log_success() { echo -e "${GREEN}[OK]${NC} $*"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

notify() {
  local status="$1"; local msg="$2"; local code="${3:-}"
  log_event "$status" "$code" "$msg"
  [[ "$SLACK_WEBHOOK_URL" =~ ^http ]] && {
    local emoji color
    case "$status" in START) emoji="🚀"; color="#36a64f" ;; SUCCESS) emoji="✅"; color="#36a64f" ;; FAIL) emoji="❌"; color="#ff0000" ;; esac
    curl -s -X POST -H 'Content-Type: application/json' -d "{\"text\":\"$emoji $msg\"}" "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || true
  }
  return 0
}

log_event() {
  printf '{"ts":"%s","script":"resonance-k8s-build-deploy-80","version":"%s","status":"%s","code":"%s","image":"%s","message":"%s"}\n' \
    "$(date -Iseconds)" "$SCRIPT_VERSION" "$1" "$2" "$IMAGE_NAME" "$3" >> "$EVENT_LOG"
}

acquire_lock() {
  if [[ -e "$LOCK_FILE" ]]; then
    local pid="$(cat "$LOCK_FILE" 2>/dev/null)"
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null && { log_error "Another instance running (PID: $pid)"; exit 1; }
  fi
  echo "$$" > "$LOCK_FILE"
}
release_lock() { rm -f "$LOCK_FILE"; }

preflight_check() {
  log_step "Pre-flight Checks"
  mkdir -p "$RUN_DIR" "$LOG_DIR" "$BACKUP_DIR" "$(dirname "$EVENT_LOG")"
  
  echo -n "  Disk: "
  local root_d opt_d
  root_d="$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')"
  opt_d="$(df -h /opt | awk 'NR==2 {print $5}' | sed 's/%//')"
  if (( root_d < 85 && opt_d < 85 )); then
    echo -e "${GREEN}(root=${root_d}%, /opt=${opt_d}%)${NC}"
  else
    echo -e "${YELLOW}(root=${root_d}%, /opt=${opt_d}%)${NC}"
  fi
  
  echo -n "  Nodes: "
  local nr
  nr="$(kubectl get nodes --no-headers 2>/dev/null | awk '$2 != "Ready" {count++} END {print count+0}')"
  if (( nr == 0 )); then
    echo -e "${GREEN}($nr not ready)${NC}"
  else
    echo -e "${RED}($nr not ready)${NC}"
  fi
  
  echo -n "  Memory: "
  local mem
  mem="$(free -m | awk 'NR==2 {print $7}')"
  echo "${mem}MB"
  [[ "$mem" -lt 1024 ]] && { log_warning "Low memory, reducing build settings"; NODE_HEAP_MB=2048; MAVEN_OPTS="-Xmx1g"; }
  
  echo -n "  HostPath: "
  if [[ -d "$OVERLAY_HOST_PATH" ]]; then
    echo -e "${GREEN}OK${NC}"
  else
    echo -e "${YELLOW}CREATING${NC}"
    mkdir -p "$OVERLAY_HOST_PATH"
  fi
}

rollback_and_fail() {
  log_error "FAIL $1: $2"
  notify "FAIL" "$2" "$1"
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}  DEPLOYMENT FAILED${NC}"
  echo -e "${RED}========================================${NC}"
  echo "Error: $1"
  echo "Message: $2"
  echo ""
  echo "Recovery:"
  case "$1" in
    FRONTEND_*) echo "  cd $FRONTEND_DIR && npm run build 2>&1 | tail -30";;
    MAVEN_*) echo "  cd $MAVEN_DIR && mvn clean package -DskipTests";;
    OVERLAY_*) echo "  ls -la $OVERLAY_HOST_PATH/"; echo "  kubectl -n $NAMESPACE delete pods -l app=$DEPLOYMENT --grace-period=0";;
    *) echo "  ./resonance-k8s-doctor.sh check";;
  esac
  kubectl -n "$NAMESPACE" rollout undo "deployment/$DEPLOYMENT" 2>/dev/null || true
  release_lock
  exit 1
}

root_cmd() { [[ $EUID -eq 0 ]] && "$@" || echo "$RESONANCE_SUDO_PASSWORD" | sudo -S "$@"; }

validate_frontend() {
  local d="$OVERLAY_HOST_PATH"
  [[ -f "$d/index.html" && -d "$d/assets" ]] || rollback_and_fail "FRONTEND_BUILD_INCOMPLETE" "Missing build output"
}

validate_maven() {
  local jar="$(JAR_OUTPUT_PATH)"
  [[ -f "$jar" && $(stat -c%s "$jar" 2>/dev/null || echo 0) -gt 1000000 ]] || rollback_and_fail "BUILD_FAILED" "JAR missing or corrupt"
}

validate_overlay() {
  [[ -f "$OVERLAY_HOST_PATH/index.html" && -d "$OVERLAY_HOST_PATH/assets" ]] || rollback_and_fail "OVERLAY_SYNC_FAILED" "Overlay incomplete"
}

build_frontend() {
  log_step "Build Frontend"
  [[ "${SKIP_FRONTEND:-false}" == "true" ]] && { log "Skipped"; return; }
  FORCE_FRONTEND_BUILD=true bash "$ROOT_DIR/ops/scripts/resonance-frontend-auto-build.sh"
  validate_frontend
  log_success "Frontend built"
}

sync_overlay() {
  log_step "Sync Overlay"
  [[ "${SKIP_OVERLAY_SYNC:-false}" == "true" ]] && { log "Skipped"; return; }
  validate_overlay
  curl -fsS --max-time 10 "http://127.0.0.1/signin/loginView" >/dev/null \
    || rollback_and_fail "OVERLAY_HTTP_FAILED" "carbonet-web did not serve the published frontend"
  log_success "Frontend published without API rollout"
}

build_maven() {
  log_step "Build App ($BUILD_TOOL)"
  [[ "${SKIP_MAVEN:-false}" == "true" ]] && { log "Skipped"; return; }
  root_cmd rm -rf "$MAVEN_DIR/target/classes/static"
  if ! PROJECT_BUILD_CMD; then
    log_error "Build failed ($BUILD_TOOL)"
    exit 1
  fi
  validate_maven
  log_success "$BUILD_TOOL built"
}

build_image() {
  log_step "Build Image"
  [[ "${SKIP_IMAGE_BUILD:-false}" == "true" ]] && { log "Skipped"; return; }
  rm -rf "$RELEASE_DIR" && mkdir -p "$RELEASE_DIR/lib" "$RELEASE_DIR/config"
  cp "$(JAR_OUTPUT_PATH)" "$RELEASE_DIR/"
  [[ -f "$ROOT_DIR/third_party/kisa/kr.or.kisa.dapc.core-1.0.0.jar" ]] && cp "$ROOT_DIR/third_party/kisa/kr.or.kisa.dapc.core-1.0.0.jar" "$RELEASE_DIR/lib/"
  root_cmd docker build --build-arg PROJECT_ID="$PROJECT_ID" --build-arg BUILDKIT_INLINE_CACHE=1 \
    --cache-from "type=registry,ref=$IMAGE_NAME" --cache-from "type=registry,ref=${IMAGE_NAME%-*}:*" \
    \
    -f "$ROOT_DIR/ops/docker/Dockerfile.runtime" -t "$IMAGE_NAME" "$RELEASE_DIR"
  root_cmd sh -c 'docker save "$1" | ctr -n k8s.io images import - >/dev/null' _ "$IMAGE_NAME"
  log_success "Image built"
}

rollout_image() {
  log_step "Rollout"
  root_cmd ctr -n k8s.io images list | grep -F "$IMAGE_NAME" >/dev/null \
    || rollback_and_fail "IMAGE_NOT_FOUND" "Image not in containerd"
  kubectl -n "$NAMESPACE" set image "deployment/$DEPLOYMENT" "$CONTAINER=$IMAGE_NAME" || rollback_and_fail "SET_IMAGE_FAILED" "kubectl failed"
  kubectl -n "$NAMESPACE" annotate "deployment/$DEPLOYMENT" "resonance.ai/image=$IMAGE_NAME" "resonance.ai/released-at=$(date -Iseconds)" --overwrite >/dev/null
  kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=600s || rollback_and_fail "ROLLOUT_FAILED" "Rollout timeout"
  log_success "Rolled out"
}

verify_runtime() {
  log_step "Verify"
  local pod
  pod="$(kubectl -n $NAMESPACE get pods -l app=$DEPLOYMENT --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}')"
  echo -n "  Health: "
  local h
  h="$(kubectl -n $NAMESPACE exec $pod -- curl -sf --max-time 15 "http://localhost:8080/actuator/health" 2>/dev/null || echo FAILED)"
  [[ "$h" == "FAILED" ]] && rollback_and_fail "HEALTH_FAILED" "Health check failed"
  echo -e "${GREEN}UP${NC}"
  log_success "Verified"
}

ensure_pdb() {
  kubectl -n "$NAMESPACE" get pdb "$DEPLOYMENT-pdb" >/dev/null 2>&1 || \
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
  log "PDB configured"
}

main() {
  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  Carbonet Build-Deploy v$SCRIPT_VERSION${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""
  
  for arg in "$@"; do
    case "$arg" in --dry-run) DRY_RUN=true; shift ;; --skip-preflight) SKIP_PREFLIGHT=true; shift ;;
    --skip-notify) SKIP_NOTIFY=true; shift ;; --force) FORCE=true; shift ;;
    esac
  done
  
  echo "Namespace: $NAMESPACE, Deployment: $DEPLOYMENT"
  echo "Image: $IMAGE_NAME"
  echo ""
  
  acquire_lock
  
  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY-RUN - Would execute: preflight, build_frontend, sync_overlay, build_maven, build_image, rollout_image, verify"
    release_lock; exit 0
  fi
  
  notify "START" "Build deploy started" ""
  
  preflight_check
  bash "$ROOT_DIR/ops/scripts/resonance-zero-downtime-gate.sh" pre
  
  build_frontend
  sync_overlay
  build_maven
  build_image
  rollout_image
  kubectl apply -f "$ROOT_DIR/manifests/carbonet-split-runtime.yaml"
  kubectl -n "$NAMESPACE" rollout status deployment/carbonet-web --timeout=300s
  ensure_pdb
  verify_runtime
  bash "$ROOT_DIR/ops/scripts/resonance-zero-downtime-gate.sh" post
  
  printf '{"ts":"%s","projectId":"%s","gitSha":"%s","image":"%s"}\n' \
    "$(date -Iseconds)" "$PROJECT_ID" \
    "$(git -C "$ROOT_DIR" rev-parse --short=12 HEAD 2>/dev/null || echo unknown)" \
    "$IMAGE_NAME" >> "$MANIFEST_LOG"
  
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  BUILD-DEPLOY SUCCESS${NC}"
  echo -e "${GREEN}========================================${NC}"
  
  notify "SUCCESS" "Build deploy completed" ""
  kubectl -n "$NAMESPACE" get deploy,svc,pod -o wide
  release_lock
}

main "$@"
