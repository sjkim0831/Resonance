#!/usr/bin/env bash
# AI Self-Healing Diagnostic Script
# Usage: ./resonance-k8s-doctor.sh [check|fix|status]
# 
# This script helps AI diagnose and fix build/deploy issues

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${DEPLOYMENT:-carbonet-runtime}"
OVERLAY_HOST_PATH="/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }

usage() {
  cat <<EOF
Usage: $0 <command>

Commands:
  check   - Run diagnostic checks
  fix     - Attempt to fix detected issues
  status  - Show current system status
  help    - Show this help message

Examples:
  $0 check          # Check for issues
  $0 fix            # Fix detected issues
  $0 status         # Show system status
EOF
}

check_overlay_host_path() {
  log "=== Checking HostPath Overlay ==="
  
  if [[ ! -d "$OVERLAY_HOST_PATH" ]]; then
    warn "HostPath directory does not exist: $OVERLAY_HOST_PATH"
    echo "  Create it with: mkdir -p $OVERLAY_HOST_PATH"
    return 1
  fi
  
  local file_count
  file_count="$(ls "$OVERLAY_HOST_PATH/index.html" "$OVERLAY_HOST_PATH/assets" 2>/dev/null | wc -l)"
  
  if [[ "$file_count" -ge 2 ]]; then
    success "HostPath overlay looks healthy (found $file_count/2 expected items)"
    echo "  Contents:"
    ls -la "$OVERLAY_HOST_PATH/" | head -10 | sed 's/^/    /'
    return 0
  else
    error "HostPath overlay is incomplete (found $file_count/2 expected items)"
    echo "  Current contents:"
    ls -la "$OVERLAY_HOST_PATH/" 2>&1 | sed 's/^/    /'
    return 1
  fi
}

check_pods_mount() {
  log "=== Checking Pods Mount ==="
  
  local pods
  pods="$(kubectl -n "$NAMESPACE" get pods -l app="$DEPLOYMENT" --field-selector=status.phase=Running -o jsonpath='{.items[*].metadata.name}' 2>/dev/null)"
  
  if [[ -z "$pods" ]]; then
    error "No running pods found"
    return 1
  fi
  
  local all_healthy=true
  for pod in $pods; do
    echo -n "  Pod $pod: "
    
    local overlay_contents
    overlay_contents="$(kubectl -n "$NAMESPACE" exec "$pod" -- sh -c 'ls /app/react-app-overlay/ 2>/dev/null | head -5' 2>/dev/null || echo "FAILED")"
    
    if [[ "$overlay_contents" == "FAILED" ]] || [[ -z "$overlay_contents" ]]; then
      echo -e "${RED}EMPTY/NO_MOUNT${NC}"
      all_healthy=false
    elif echo "$overlay_contents" | grep -q "index.html"; then
      echo -e "${GREEN}OK${NC}"
    else
      echo -e "${YELLOW}INCOMPLETE${NC}"
      echo "    Contents: $overlay_contents"
      all_healthy=false
    fi
  done
  
  if [[ "$all_healthy" == "true" ]]; then
    return 0
  else
    return 1
  fi
}

check_health_endpoints() {
  log "=== Checking Health Endpoints ==="
  
  local pod
  pod="$(kubectl -n "$NAMESPACE" get pods -l app="$DEPLOYMENT" --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)"
  
  if [[ -z "$pod" ]]; then
    error "No running pod found for health check"
    return 1
  fi
  
  echo -n "  Health endpoint: "
  local health
  health="$(kubectl -n "$NAMESPACE" exec "$pod" -- curl -s --max-time 5 "http://localhost:8080/actuator/health" 2>/dev/null || echo "FAILED")"
  
  if [[ "$health" == "FAILED" ]]; then
    echo -e "${RED}FAILED${NC}"
    return 1
  elif echo "$health" | grep -q '"status":"UP"'; then
    echo -e "${GREEN}UP${NC}"
    return 0
  else
    echo -e "${YELLOW}UNKNOWN${NC} - $health"
    return 1
  fi
}

fix_overlay_issue() {
  log "=== Attempting to Fix Overlay Issue ==="
  
  # Step 1: Check if build output exists
  local build_output="$ROOT_DIR/projects/carbonet-frontend/target/classes/static/react-app"
  if [[ ! -d "$build_output" ]]; then
    build_output="$ROOT_DIR/projects/carbonet-frontend/source/dist"
  fi
  
  if [[ ! -d "$build_output" ]]; then
    error "No build output found!"
    echo "  Please run frontend build first:"
    echo "    cd $ROOT_DIR/projects/carbonet-frontend/source && npm run build"
    return 1
  fi
  
  # Step 2: Sync to HostPath
  log "Syncing build output to HostPath..."
  sudo rsync -a --delete "$build_output/" "$OVERLAY_HOST_PATH/"
  
  # Step 3: Delete pods to force remount
  log "Deleting pods to force fresh mount..."
  kubectl -n "$NAMESPACE" delete pods -l app="$DEPLOYMENT" --grace-period=0 --force 2>/dev/null || true
  
  # Step 4: Wait for new pods
  log "Waiting for new pods..."
  sleep 20
  kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=180s || true
  
  # Step 5: Verify
  log "Verifying fix..."
  if check_pods_mount; then
    success "Overlay issue fixed!"
    return 0
  else
    error "Failed to fix overlay issue"
    return 1
  fi
}

show_status() {
  echo "=========================================="
  echo "  Carbonet Runtime Status"
  echo "=========================================="
  echo ""
  echo "Deployment: $DEPLOYMENT"
  echo "Namespace: $NAMESPACE"
  echo "Overlay HostPath: $OVERLAY_HOST_PATH"
  echo ""
  
  echo "=== Pods ==="
  kubectl -n "$NAMESPACE" get pods -l app="$DEPLOYMENT" --no-headers 2>/dev/null || echo "  No pods found"
  echo ""
  
  echo "=== Recent Events ==="
  kubectl -n "$NAMESPACE" get events --sort-by='.lastTimestamp' 2>/dev/null | tail -10 || echo "  No events"
  echo ""
  
  echo "=== Overlay HostPath ==="
  if [[ -d "$OVERLAY_HOST_PATH" ]]; then
    echo "  Files: $(ls "$OVERLAY_HOST_PATH" 2>/dev/null | wc -l)"
    ls -la "$OVERLAY_HOST_PATH/" 2>/dev/null | head -5 | sed 's/^/  /'
  else
    echo "  Directory not found"
  fi
}

# Main
COMMAND="${1:-help}"

case "$COMMAND" in
  check)
    log "Running diagnostic checks..."
    echo ""
    
    local failed=0
    
    check_overlay_host_path || failed=$((failed+1))
    echo ""
    
    check_pods_mount || failed=$((failed+1))
    echo ""
    
    check_health_endpoints || failed=$((failed+1))
    echo ""
    
    echo "=========================================="
    if [[ $failed -eq 0 ]]; then
      success "All checks passed!"
      exit 0
    else
      error "$failed check(s) failed"
      echo ""
      echo "To attempt automatic fix, run: $0 fix"
      exit 1
    fi
    ;;
  
  fix)
    log "Attempting to fix issues..."
    echo ""
    
    if fix_overlay_issue; then
      success "Fix applied successfully!"
      echo ""
      echo "Verify with: $0 check"
    else
      error "Failed to fix issues"
      echo ""
      echo "Manual intervention may be required"
      exit 1
    fi
    ;;
  
  status)
    show_status
    ;;
  
  help|*)
    usage
    ;;
esac
