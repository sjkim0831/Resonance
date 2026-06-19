#!/usr/bin/env bash
# Enhanced build-deploy script with better error diagnostics
# Features:
# - Detailed error output with context
# - Self-diagnosis capabilities
# - Recovery suggestions
# - AI-friendly error format

set -euo pipefail
export RESONANCE_SUDO_PASSWORD="qwer1234"

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${DEPLOYMENT:-carbonet-runtime}"
CONTAINER="${CONTAINER:-carbonet-runtime}"
SERVICE="${SERVICE:-carbonet-runtime}"
PROJECT_ID="${PROJECT_ID:-P003}"
CUBRID_HOST="${CUBRID_HOST:-cubrid-carbonet.${NAMESPACE}.svc.cluster.local}"
DB_NAME="${DB_NAME:-carbonet}"
DB_USER="${DB_USER:-dba}"
DB_URL="${DB_URL:-jdbc:cubrid:${CUBRID_HOST}:33000:${DB_NAME}:::?charset=UTF-8&connectTimeout=5&queryTimeout=30}"
IMAGE_NAME="${IMAGE_NAME:-registry.local/carbonet-runtime:$(date +%Y.%m.%d-%H%M%S-kubeadm)}"
RELEASE_DIR="$ROOT_DIR/var/releases/$PROJECT_ID/image-context"
RUN_DIR="$ROOT_DIR/var/run"
LOG_DIR="$ROOT_DIR/var/logs"
K8S_DIR="$ROOT_DIR/var/k8s"
BACKUP_DIR="$ROOT_DIR/var/backups/k8s"
RUNTIME_DATA_DIR="${RUNTIME_DATA_DIR:-$ROOT_DIR/data}"
EVENT_LOG="$ROOT_DIR/var/ai-runtime/k8s-build-deploy-events.jsonl"
MANIFEST_LOG="$ROOT_DIR/var/ai-runtime/k8s-release-manifest.jsonl"
ROLLOUT_TIMELINE_LOG="$ROOT_DIR/var/ai-runtime/k8s-rollout-timeline.jsonl"
LOCK_FILE="$RUN_DIR/resonance-k8s-build-deploy-80.lock"
DIAGNOSTIC_LOG="$RUN_DIR/diagnostic-$(date +%Y%m%d-%H%M%S).log"

log() {
  printf '[k8s-build-deploy-80] %s\n' "$*"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $*" >> "$DIAGNOSTIC_LOG"
}

# Enhanced error logging with full context
log_error() {
  local code="$1"
  local message="$2"
  local context="${3:-}"
  
  echo -e "\n" >&2
  echo "========================================" >&2
  echo "ERROR: $code" >&2
  echo "========================================" >&2
  echo "Message: $message" >&2
  if [[ -n "$context" ]]; then
    echo "Context: $context" >&2
  fi
  echo "Time: $(date '+%Y-%m-%d %H:%M:%S')" >&2
  echo "========================================" >&2
  
  # Write to diagnostic log
  cat >> "$DIAGNOSTIC_LOG" <<EOF

=== ERROR: $code ===
Time: $(date -Iseconds)
Message: $message
Context: $context
EOF
}

log_event() {
  local status="$1"
  local code="$2"
  local message="$3"
  printf '{"ts":"%s","script":"resonance-k8s-build-deploy-80","status":"%s","code":"%s","image":"%s","message":"%s"}\n' \
    "$(date -Iseconds)" "$(json_escape "$status")" "$(json_escape "$code")" \
    "$(json_escape "$IMAGE_NAME")" "$(json_escape "$message")" >>"$EVENT_LOG"
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

rollback_and_fail() {
  local code="$1"
  local message="$2"
  
  log_error "$code" "$message" "$(caller 0)"
  log_event FAIL "$code" "$message"
  
  # Print diagnostic info
  echo "" >&2
  echo "=== Diagnostic Information ===" >&2
  echo "Error Code: $code" >&2
  echo "Deployment: $DEPLOYMENT" >&2
  echo "Namespace: $NAMESPACE" >&2
  echo "" >&2
  
  # Show recent events
  if [[ -f "$EVENT_LOG" ]]; then
    echo "Recent events:" >&2
    tail -5 "$EVENT_LOG" 2>/dev/null | while read -r line; do
      echo "  $line" >&2
    done
  fi
  
  echo "" >&2
  echo "Recovery suggestions:" >&2
  suggest_recovery "$code"
  
  kubectl -n "$NAMESPACE" rollout undo "deployment/$DEPLOYMENT" || true
  kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout="${ROLLBACK_TIMEOUT:-300s}" || true
  exit 1
}

suggest_recovery() {
  local code="$1"
  case "$code" in
    OVERLAY_MOUNT_FAILED)
      cat >&2 <<EOF
  1. Check HostPath directory on host:
     ls -la /opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app/
  
  2. Verify permissions:
     ls -la /opt/Resonance/projects/carbonet-frontend/src/main/resources/static/
  
  3. Force remount by deleting all pods:
     kubectl -n $NAMESPACE delete pods -l app=$DEPLOYMENT --grace-period=0
  
  4. Check kubelet logs on node:
     journalctl -u kubelet | grep -i mount | tail -20
EOF
      ;;
    OVERLAY_SYNC_NO_SOURCE)
      cat >&2 <<EOF
  1. Check if frontend build completed:
     ls -la $ROOT_DIR/projects/carbonet-frontend/target/classes/static/react-app/
     ls -la $ROOT_DIR/projects/carbonet-frontend/source/dist/
  
  2. Run frontend build:
     cd $ROOT_DIR/projects/carbonet-frontend/source && npm run build
EOF
      ;;
    IMAGE_NOT_FOUND_IN_CONTAINERD|IMAGE_NOT_FOUND_BEFORE_ROLLOUT)
      cat >&2 <<EOF
  1. Check available images:
     ctr -n k8s.io images list | grep carbonet-runtime
  
  2. Import image if missing:
     docker save <image> | sudo ctr -n k8s.io images import -
  
  3. Check image tar integrity:
     docker load -i <image.tar>
EOF
      ;;
    ROLLOUT_FAILED)
      cat >&2 <<EOF
  1. Check deployment status:
     kubectl -n $NAMESPACE describe deploy $DEPLOYMENT
  
  2. Check pod events:
     kubectl -n $NAMESPACE get events --sort-by='.lastTimestamp' | tail -20
  
  3. Check pod logs:
     kubectl -n $NAMESPACE logs deployment/$DEPLOYMENT --tail=50
EOF
      ;;
    HEALTH_80_FAILED)
      cat >&2 <<EOF
  1. Check if app is running inside pod:
     kubectl -n $NAMESPACE exec deploy/$DEPLOYMENT -- curl -s localhost:8080/actuator/health
  
  2. Check pod resources:
     kubectl -n $NAMESPACE top pods -l app=$DEPLOYMENT
  
  3. Check for OOMKills:
     kubectl -n $NAMESPACE describe pod -l app=$DEPLOYMENT | grep -A5 "Last State"
EOF
      ;;
    *)
      cat >&2 <<EOF
  1. Check event log:
     tail -50 $EVENT_LOG
  
  2. Check diagnostic log:
     tail -50 $DIAGNOSTIC_LOG
  
  3. Verify cluster state:
     kubectl -n $NAMESPACE get all
  
  4. Check node status:
     kubectl get nodes
EOF
      ;;
  esac
}

# Enhanced mount verification with detailed diagnostics
verify_overlay_mount_with_diagnostics() {
  local pod="$1"
  local attempt="${2:-1}"
  
  log "=== Mount Verification Attempt $attempt ==="
  
  # Check overlay contents
  local overlay_contents
  overlay_contents="$(kubectl -n "$NAMESPACE" exec "$pod" -- sh -c 'ls -la /app/react-app-overlay/ 2>&1' 2>/dev/null || echo "COMMAND_FAILED")"
  
  # Check mount info
  local mount_info
  mount_info="$(kubectl -n "$NAMESPACE" exec "$pod" -- sh -c 'mount | grep react-app-overlay 2>&1' 2>/dev/null || echo "MOUNT_CHECK_FAILED")"
  
  # Check if read-only
  local readonly_status="unknown"
  if kubectl -n "$NAMESPACE" exec "$pod" -- sh -c 'touch /app/react-app-overlay/.write_test 2>&1' >/dev/null 2>&1; then
    kubectl -n "$NAMESPACE" exec "$pod" -- sh -c 'rm /app/react-app-overlay/.write_test 2>&1' >/dev/null 2>&1 || true
    readonly_status="rw (writable)"
  else
    readonly_status="ro (read-only)"
  fi
  
  # Check for expected files
  local has_index=false
  local has_assets=false
  if echo "$overlay_contents" | grep -q "index.html"; then
    has_index=true
  fi
  if echo "$overlay_contents" | grep -q "assets"; then
    has_assets=true
  fi
  
  # Log diagnostics
  log "Pod: $pod"
  log "Overlay contents: $overlay_contents"
  log "Mount info: $mount_info"
  log "Mount status: $readonly_status"
  log "Has index.html: $has_index"
  log "Has assets/: $has_assets"
  
  # Write to diagnostic log
  cat >> "$DIAGNOSTIC_LOG" <<EOF

=== Mount Verification (Attempt $attempt) ===
Pod: $pod
Time: $(date -Iseconds)
Overlay Contents:
$overlay_contents
Mount Info:
$mount_info
Writable: $readonly_status
EOF

  # Determine if mount is healthy
  if [[ "$has_index" == "true" && "$has_assets" == "true" ]]; then
    log "Mount verification: PASSED"
    return 0
  else
    log_error "OVERLAY_MOUNT_INCOMPLETE" "Missing expected files in overlay" "index.html=$has_index, assets=$has_assets"
    return 1
  fi
}

# Self-healing overlay sync
sync_overlay_frontend_with_self_healing() {
  if [[ "${SKIP_OVERLAY_SYNC:-false}" == "true" ]]; then
    log 'overlay sync skipped'
    return 0
  fi
  log 'sync frontend to react-app-overlay with self-healing'

  local src_dir="$ROOT_DIR/projects/carbonet-frontend/source/dist"
  if [[ ! -d "$src_dir" ]]; then
    src_dir="$ROOT_DIR/projects/carbonet-frontend/target/classes/static/react-app"
  fi
  local overlay_dest="/opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app"

  if [[ ! -d "$src_dir" ]]; then
    rollback_and_fail OVERLAY_SYNC_NO_SOURCE "frontend build output not found at $src_dir"
  fi

  # Verify source has expected files
  local src_file_count
  src_file_count="$(ls "$overlay_dest/index.html" "$overlay_dest/assets" 2>/dev/null | wc -l)"
  if [[ "$src_file_count" -lt 2 ]]; then
    log "WARNING: Source may be incomplete (found $src_file_count/2 expected items)"
    log "Source contents: $(ls -la "$overlay_dest/" 2>&1 | head -10)"
  fi

  log "rsync $src_dir/ -> $overlay_dest/"
  root_cmd rsync -a --delete \
    "$src_dir/" \
    "$overlay_dest/"

  local pod_count
  pod_count="$(kubectl -n "$NAMESPACE" get pods -l app="$DEPLOYMENT" --field-selector=status.phase=Running -o jsonpath='{.items[*].metadata.name}' 2>/dev/null | wc -w)"
  if [[ "$pod_count" -eq 0 ]]; then
    rollback_and_fail NO_RUNNING_PODS "no running pods for overlay sync"
  fi

  log "restarting $pod_count pods to pick up overlay changes"
  kubectl -n "$NAMESPACE" rollout restart "deployment/$DEPLOYMENT" >/dev/null 2>&1 || true
  kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=120s || true

  # Enhanced verification with self-healing
  local pod
  pod="$(kubectl -n "$NAMESPACE" get pods -l app="$DEPLOYMENT" --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)"
  
  verify_overlay_mount_with_diagnostics "$pod" 1 || {
    local retry_count=0
    local max_retries=3
    
    while [[ $retry_count -lt $max_retries ]]; do
      log "overlay mount verification failed, force recreating pods (attempt $((retry_count+1))/$max_retries)"
      
      local pods_to_delete
      pods_to_delete="$(kubectl -n "$NAMESPACE" get pods -l app="$DEPLOYMENT" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null)"
      
      for del_pod in $pods_to_delete; do
        log "deleting pod $del_pod to force fresh mount"
        kubectl -n "$NAMESPACE" delete pod "$del_pod" --grace-period=0 --force >/dev/null 2>&1 || true
      done
      
      sleep 20
      kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=180s || true
      sleep 5
      
      pod="$(kubectl -n "$NAMESPACE" get pods -l app="$DEPLOYMENT" --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)"
      
      if verify_overlay_mount_with_diagnostics "$pod" $((retry_count+2)); then
        log "overlay mount verified after retry $((retry_count+1))"
        break
      fi
      
      retry_count=$((retry_count+1))
      
      if [[ $retry_count -ge $max_retries ]]; then
        log_event ERROR OVERLAY_MOUNT_FAILED "overlay mount verification failed after $max_retries attempts"
        rollback_and_fail OVERLAY_MOUNT_FAILED "overlay mount failed after $max_retries retries"
      fi
    done
  }

  pod="$(kubectl -n "$NAMESPACE" get pods -l app="$DEPLOYMENT" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)"
  kubectl -n "$NAMESPACE" exec "$pod" -- curl -fsS --max-time 15 "http://localhost:8080/actuator/health" >"$RUN_DIR/carbonet-runtime-overlay-health.json" || true
  cat "$RUN_DIR/carbonet-runtime-overlay-health.json" 2>/dev/null || true
  log_event OK OVERLAY_SYNC_COMPLETE "frontend overlay synced to $pod_count pods"
}

# Wrapper for frontend_only_deploy
frontend_only_deploy() {
  log_event START FRONTEND_ONLY_STARTED "frontend-only build deploy started"
  cleanup_residual_runtime_processes
  sync_overlay_frontend_with_self_healing
  write_release_manifest
  log_event OK FRONTEND_ONLY_DEPLOYED "frontend-only build deploy completed"
  kubectl -n "$NAMESPACE" get deploy,svc,pod -o wide
}

# Main execution (placeholder - actual main logic would follow)
main() {
  mkdir -p "$RUN_DIR" "$LOG_DIR" "$K8S_DIR" "$BACKUP_DIR" "$RUNTIME_DATA_DIR/admin/emission-survey-admin" "$(dirname "$EVENT_LOG")"
  
  log "Enhanced build-deploy script initialized"
  log "Diagnostic log: $DIAGNOSTIC_LOG"
  log "Event log: $EVENT_LOG"
  
  # Test error handling
  log "Testing error logging..."
  log_error "TEST_ERROR" "This is a test error" "Testing error output"
  suggest_recovery "TEST_ERROR"
  
  log "Enhanced script ready for use"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
