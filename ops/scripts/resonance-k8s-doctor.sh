#!/usr/bin/env bash
#===============================================================================
# AI Self-Healing Diagnostic Script for Carbonet Runtime
#
# Features:
# - Comprehensive system checks
# - Automatic fix attempts
# - Detailed diagnostics
# - Kubernetes-aware
# - Zero-downtime deployment verification
#
# Usage:
#   ./resonance-k8s-doctor.sh <command>
#
# Commands:
#   check       - Run all diagnostic checks
#   fix         - Attempt automatic fixes
#   status      - Show detailed system status
#   deep        - Run deep diagnostics (verbose)
#   health      - Quick health check
#   mount       - Check overlay mount status
#   pods        - List pods with details
#   events      - Show recent events
#   help        - Show this help
#===============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${DEPLOYMENT:-carbonet-runtime}"
OVERLAY_HOST_PATH="/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

#===============================================================================
# Utility Functions
#===============================================================================
log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }

print_header() {
  echo ""
  echo -e "${CYAN}${BOLD}========================================${NC}"
  echo -e "${CYAN}${BOLD}  $1${NC}"
  echo -e "${CYAN}${BOLD}========================================${NC}"
}

#===============================================================================
# Diagnostic Functions
#===============================================================================
check_overlay_host_path() {
  log "=== HostPath Overlay ==="
  
  if [[ ! -d "$OVERLAY_HOST_PATH" ]]; then
    warn "Directory does not exist: $OVERLAY_HOST_PATH"
    echo "  → Create with: mkdir -p $OVERLAY_HOST_PATH"
    return 1
  fi
  
  local file_count
  file_count="$(ls "$OVERLAY_HOST_PATH/index.html" "$OVERLAY_HOST_PATH/assets" 2>/dev/null | wc -l)"
  
  if [[ "$file_count" -ge 2 ]]; then
    success "HostPath healthy (found $file_count/2 expected)"
    echo "  Files: $(ls "$OVERLAY_HOST_PATH" 2>/dev/null | wc -l) items"
    echo "  Contents:"
    ls -la "$OVERLAY_HOST_PATH/" 2>/dev/null | head -8 | sed 's/^/    /'
    return 0
  else
    error "HostPath incomplete (found $file_count/2 expected)"
    echo "  Contents:"
    ls -la "$OVERLAY_HOST_PATH/" 2>&1 | sed 's/^/    /'
    return 1
  fi
}

check_pods_mount() {
  log "=== Pods Mount Status ==="
  
  local pods
  pods="$(kubectl -n "$NAMESPACE" get pods -l "app=$DEPLOYMENT" --field-selector=status.phase=Running -o jsonpath='{.items[*].metadata.name}' 2>/dev/null)"
  
  if [[ -z "$pods" ]]; then
    error "No running pods found"
    return 1
  fi
  
  local all_healthy=true
  local pod_details=()
  
  for pod in $pods; do
    echo -n "  $pod: "
    
    # Check overlay contents
    local overlay_contents
    overlay_contents="$(kubectl -n "$NAMESPACE" exec "$pod" -- sh -c 'ls /app/react-app-overlay/ 2>/dev/null | head -3' 2>/dev/null || echo "FAILED")"
    
    # Check mount info
    local mount_info
    mount_info="$(kubectl -n "$NAMESPACE" exec "$pod" -- sh -c 'mount | grep react-app-overlay | head -1' 2>/dev/null || echo "")"
    
    # Check writable
    local writable="?"
    kubectl -n "$NAMESPACE" exec "$pod" -- sh -c 'touch /app/react-app-overlay/.test 2>/dev/null && rm /app/react-app-overlay/.test && echo rw || echo ro' 2>/dev/null | read -r writable
    
    if [[ "$overlay_contents" == "FAILED" ]] || [[ -z "$overlay_contents" ]]; then
      echo -e "${RED}EMPTY${NC}"
      all_healthy=false
      pod_details+=("  $pod: EMPTY (mount failed)")
    elif echo "$overlay_contents" | grep -q "index.html"; then
      echo -e "${GREEN}OK${NC} (writable=$writable)"
      pod_details+=("  $pod: OK")
    else
      echo -e "${YELLOW}INCOMPLETE${NC}"
      all_healthy=false
      pod_details+=("  $pod: INCOMPLETE")
    fi
  done
  
  echo ""
  for detail in "${pod_details[@]}"; do
    echo "$detail"
  done
  
  [[ "$all_healthy" == "true" ]] && return 0 || return 1
}

check_health_endpoints() {
  log "=== Health Endpoints ==="
  
  local pod
  pod="$(kubectl -n "$NAMESPACE" get pods -l "app=$DEPLOYMENT" --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)"
  
  [[ -z "$pod" ]] && { error "No running pod found"; return 1; }
  
  echo -n "  Pod health: "
  local health
  health="$(kubectl -n "$NAMESPACE" exec "$pod" -- curl -sf --max-time 5 "http://localhost:8080/actuator/health" 2>/dev/null || echo "FAILED")"
  
  if [[ "$health" == "FAILED" ]]; then
    echo -e "${RED}FAILED${NC}"
    return 1
  elif echo "$health" | grep -q '"status":"UP"'; then
    echo -e "${GREEN}UP${NC}"
    echo "  Response: $health"
    return 0
  else
    echo -e "${YELLOW}UNKNOWN${NC} - $health"
    return 1
  fi
}

check_pods_resources() {
  log "=== Pods Resources ==="
  
  kubectl -n "$NAMESPACE" top pods -l "app=$DEPLOYMENT" 2>/dev/null || warn "Metrics not available (metrics-server may not be installed)"
}

check_nodes_status() {
  log "=== Kubernetes Nodes ==="
  
  local not_ready
  not_ready="$(kubectl get nodes --no-headers 2>/dev/null | grep -v "Ready" | wc -l)"
  
  if [[ "$not_ready" -eq 0 ]]; then
    success "All nodes ready ($(kubectl get nodes --no-headers | wc -l) total)"
  else
    error "$not_ready node(s) not ready"
    kubectl get nodes --no-headers | grep -v "Ready" | sed 's/^/  /'
  fi
}

check_pdb() {
  log "=== Pod Disruption Budget ==="
  
  local pdb_count
  pdb_count="$(kubectl -n "$NAMESPACE" get pdb -l "app=$DEPLOYMENT" --no-headers 2>/dev/null | wc -l)"
  
  if [[ "$pdb_count" -gt 0 ]]; then
    success "PDB configured ($pdb_count found)"
    kubectl -n "$NAMESPACE" get pdb -l "app=$DEPLOYMENT" 2>/dev/null | sed 's/^/  /'
  else
    warn "No PDB configured - zero-downtime deployment may be at risk"
  fi
}

check_deployment_status() {
  log "=== Deployment Status ==="
  
  local ready desired available
  ready="$(kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo 0)"
  desired="$(kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo 0)"
  available="$(kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o jsonpath='{.status.availableReplicas}' 2>/dev/null || echo 0)"
  
  echo "  Replicas: ready=$ready, desired=$desired, available=$available"
  
  if [[ "$ready" == "$desired" ]]; then
    success "All replicas ready"
    return 0
  else
    error "Replica mismatch (ready=$ready, desired=$desired)"
    return 1
  fi
}

check_hpa() {
  log "=== Horizontal Pod Autoscaler ==="
  
  local hpa_count
  hpa_count="$(kubectl -n "$NAMESPACE" get hpa -l "app=$DEPLOYMENT" --no-headers 2>/dev/null | wc -l)"
  
  if [[ "$hpa_count" -gt 0 ]]; then
    success "HPA configured ($hpa_count)"
    kubectl -n "$NAMESPACE" get hpa -l "app=$DEPLOYMENT" 2>/dev/null | sed 's/^/  /'
  else
    warn "No HPA configured"
  fi
}

check_recent_events() {
  log "=== Recent Events ==="
  
  kubectl -n "$NAMESPACE" get events --sort-by='.lastTimestamp' 2>/dev/null | tail -15 | sed 's/^/  /'
}

check_cubrid() {
  log "=== CUBRID Database ==="
  
  if kubectl -n "$NAMESPACE" exec cubrid-carbonet-0 -- sh -c "cubrid service status" >/dev/null 2>&1; then
    success "CUBRID running"
    
    # Check broker
    if kubectl -n "$NAMESPACE" exec cubrid-carbonet-0 -- sh -c "cubrid broker status" >/dev/null 2>&1; then
      echo "  Broker: OK"
    else
      echo "  Broker: Not responding"
    fi
  else
    error "CUBRID not responding"
  fi
}

#===============================================================================
# Fix Functions
#===============================================================================
fix_overlay_issue() {
  print_header "Attempting to Fix Overlay Issue"
  
  # Step 1: Check build output
  local build_output="$ROOT_DIR/projects/carbonet-frontend/target/classes/static/react-app"
  [[ ! -d "$build_output" ]] && build_output="$ROOT_DIR/projects/carbonet-frontend/source/dist"
  
  if [[ ! -d "$build_output" ]]; then
    error "No build output found!"
    echo "  Please run frontend build first:"
    echo "    cd $ROOT_DIR/projects/carbonet-frontend/source && npm run build"
    return 1
  fi
  
  # Step 2: Sync
  log "Syncing build output to HostPath..."
  sudo rsync -a --delete "$build_output/" "$OVERLAY_HOST_PATH/" || {
    error "rsync failed"
    return 1
  }
  
  # Step 3: Delete pods
  log "Deleting pods to force remount..."
  kubectl -n "$NAMESPACE" delete pods -l "app=$DEPLOYMENT" --grace-period=0 --force 2>/dev/null || true
  
  # Step 4: Wait
  log "Waiting for new pods (30s)..."
  sleep 20
  kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=180s || {
    warn "Rollout status check timed out, but pods may still be starting"
  }
  sleep 10
  
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

fix_all_issues() {
  print_header "Attempting Automatic Fixes"
  
  local fix_count=0
  
  # Fix 1: Overlay
  if ! check_overlay_host_path; then
    log "Attempting to fix HostPath..."
    mkdir -p "$OVERLAY_HOST_PATH"
    ((fix_count++))
  fi
  
  # Fix 2: Sync overlay
  if check_overlay_host_path; then
    if ! check_pods_mount; then
      log "Attempting to fix Pod mount..."
      fix_overlay_issue
      ((fix_count++))
    fi
  fi
  
  return 0
}

#===============================================================================
# Status Display
#===============================================================================
show_status() {
  print_header "Carbonet Runtime Status"
  
  echo ""
  echo "Deployment: $DEPLOYMENT"
  echo "Namespace: $NAMESPACE"
  echo "Overlay: $OVERLAY_HOST_PATH"
  echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
  
  echo ""
  echo "=== Pods ==="
  kubectl -n "$NAMESPACE" get pods -l "app=$DEPLOYMENT" --no-headers 2>/dev/null || echo "  No pods found"
  
  echo ""
  echo "=== Services ==="
  kubectl -n "$NAMESPACE" get svc -l "app=$DEPLOYMENT" --no-headers 2>/dev/null || echo "  No services found"
  
  echo ""
  echo "=== ReplicaSets ==="
  kubectl -n "$NAMESPACE" get rs -l "app=$DEPLOYMENT" --no-headers 2>/dev/null || echo "  No replicasets found"
  
  echo ""
  echo "=== Events (Last 10) ==="
  kubectl -n "$NAMESPACE" get events --sort-by='.lastTimestamp' 2>/dev/null | tail -10 | sed 's/^/  /'
}

#===============================================================================
# Health Check (Quick)
#===============================================================================
quick_health() {
  local pod
  pod="$(kubectl -n "$NAMESPACE" get pods -l "app=$DEPLOYMENT" --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)"
  
  if [[ -z "$pod" ]]; then
    echo -e "${RED}DEGRADED${NC} - No running pods"
    return 1
  fi
  
  local health
  health="$(kubectl -n "$NAMESPACE" exec "$pod" -- curl -sf --max-time 3 "http://localhost:8080/actuator/health" 2>/dev/null || echo "FAILED")"
  
  if [[ "$health" == "FAILED" ]]; then
    echo -e "${RED}DEGRADED${NC} - Health endpoint not responding"
    return 1
  elif echo "$health" | grep -q '"status":"UP"'; then
    echo -e "${GREEN}HEALTHY${NC} - All systems operational"
    return 0
  else
    echo -e "${YELLOW}DEGRADED${NC} - Unexpected health response"
    return 1
  fi
}

#===============================================================================
# Main
#===============================================================================
usage() {
  cat <<EOF
Usage: $0 <command>

Commands:
  check       Run all diagnostic checks
  fix         Attempt automatic fixes
  status      Show detailed system status
  deep        Run deep diagnostics (verbose)
  health      Quick health check
  mount       Check overlay mount status
  pods        List pods with details
  events      Show recent events
  help        Show this help message

Examples:
  $0 check        # Full diagnostics
  $0 fix          # Auto-fix issues
  $0 health       # Quick health check
EOF
}

main() {
  local COMMAND="${1:-help}"
  
  case "$COMMAND" in
    check)
      print_header "Running Full Diagnostics"
      
      local failed=0
      
      check_overlay_host_path || ((failed++))
      echo ""
      
      check_nodes_status
      echo ""
      
      check_pods_mount || ((failed++))
      echo ""
      
      check_health_endpoints || ((failed++))
      echo ""
      
      check_deployment_status || ((failed++))
      echo ""
      
      check_hpa
      check_pdb
      echo ""
      
      print_header "Diagnostic Summary"
      
      if [[ $failed -eq 0 ]]; then
        success "All checks passed!"
        exit 0
      else
        error "$failed check(s) failed"
        echo ""
        echo "To attempt automatic fixes: $0 fix"
        exit 1
      fi
      ;;
    
    fix)
      fix_all_issues
      ;;
    
    status)
      show_status
      ;;
    
    health)
      quick_health
      ;;
    
    mount)
      check_overlay_host_path
      echo ""
      check_pods_mount
      ;;
    
    pods)
      print_header "Pods Details"
      kubectl -n "$NAMESPACE" get pods -l "app=$DEPLOYMENT" -o wide
      echo ""
      kubectl -n "$NAMESPACE" describe pods -l "app=$DEPLOYMENT" 2>/dev/null | grep -A20 "Conditions:"
      ;;
    
    events)
      print_header "Recent Events"
      kubectl -n "$NAMESPACE" get events --sort-by='.lastTimestamp'
      ;;
    
    deep)
      print_header "Deep Diagnostics"
      check_overlay_host_path
      check_pods_mount
      check_health_endpoints
      check_pods_resources
      check_recent_events
      check_cubrid
      ;;
    
    help|--help|-h)
      usage
      ;;
    
    *)
      echo "Unknown command: $COMMAND"
      usage
      exit 1
      ;;
  esac
}

main "$@"
