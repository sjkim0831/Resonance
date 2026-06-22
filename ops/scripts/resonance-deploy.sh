#!/usr/bin/env bash
#===============================================================================
# Carbonet Deploy Script (Step-by-Step with Error Handling)
# Version: 1.2.0
#===============================================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${DEPLOYMENT:-carbonet-runtime}"
IMAGE="${IMAGE:-registry.local/carbonet-runtime:2026.06.22-093500-kubeadm}"
REPLICAS="${REPLICAS:-2}"

log_step() { echo ""; echo -e "${CYAN}==== STEP $1: $2 ====${NC}"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_err() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

step_preflight() {
  log_step 1 "Check Prerequisites"
  
  echo "  Namespace: $NAMESPACE"
  echo "  Deployment: $DEPLOYMENT"  
  echo "  Image: $IMAGE"
  echo "  Replicas: $REPLICAS"
  echo ""
  
  if ! command -v kubectl &>/dev/null; then
    log_err "kubectl not found"
    return 1
  fi
  log_ok "kubectl available"
  
  if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
    log_err "Namespace $NAMESPACE not found"
    return 1
  fi
  log_ok "Namespace $NAMESPACE exists"
  
  local img_count
  img_count=$(sudo ctr -n k8s.io images list 2>/dev/null | grep -c "093500" || echo "0")
  if [[ "$img_count" -gt 0 ]]; then
    log_ok "Image $IMAGE found in containerd"
  else
    log_err "Image $IMAGE not found in containerd"
    return 1
  fi
  
  return 0
}

step_deployment() {
  log_step 2 "Ensure Deployment Exists"
  
  if kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" &>/dev/null; then
    log_ok "Deployment $DEPLOYMENT exists"
    
    local current_image
    current_image=$(kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}')
    echo "  Current image: $current_image"
    
    if [[ "$current_image" == "$IMAGE" ]]; then
      log_ok "Image already set to $IMAGE"
    else
      echo "  Updating image to $IMAGE..."
      kubectl set image deployment/"$DEPLOYMENT" -n "$NAMESPACE" "$DEPLOYMENT=$IMAGE"
      log_ok "Image updated"
    fi
  else
    log_warn "Deployment $DEPLOYMENT not found, creating..."
    
    cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: carbonet-runtime
  namespace: carbonet-prod
  labels:
    app: carbonet-runtime
    framework: resonance
    project: carbonet
spec:
  replicas: 2
  revisionHistoryLimit: 5
  selector:
    matchLabels:
      app: carbonet-runtime
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  minReadySeconds: 20
  template:
    metadata:
      labels:
        app: carbonet-runtime
        framework: resonance
        project: carbonet
    spec:
      securityContext:
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
        runAsNonRoot: true
        supplementalGroups: [1000]
      containers:
      - name: carbonet-runtime
        image: registry.local/carbonet-runtime:2026.06.22-093500-kubeadm
        imagePullPolicy: Never
        ports:
        - containerPort: 8080
          name: http
        env:
        - name: PROJECT_ID
          value: "P003"
        - name: JAVA_OPTS
          value: "-XX:+UseContainerSupport -XX:InitialRAMPercentage=30 -XX:MaxRAMPercentage=50 -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError -Dfile.encoding=UTF-8"
        - name: SPRING_PROFILES_ACTIVE
          value: "prod"
        livenessProbe:
          httpGet:
            path: /actuator/health/liveness
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /actuator/health/readiness
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: /actuator/health/liveness
            port: http
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 30
        resources:
          requests:
            cpu: 100m
            memory: 1Gi
          limits:
            cpu: "4"
            memory: 4Gi
      volumes:
      - name: tmp
        emptyDir: {}
EOF
    
    if [[ $? -eq 0 ]]; then
      log_ok "Deployment created"
    else
      log_err "Failed to create deployment"
      return 1
    fi
  fi
  
  return 0
}

step_rollout() {
  log_step 3 "Wait for Rollout"
  
  echo "Waiting for deployment rollout (timeout: 300s)..."
  
  if kubectl rollout status deployment/"$DEPLOYMENT" -n "$NAMESPACE" --timeout=300s 2>&1; then
    log_ok "Rollout complete"
  else
    log_err "Rollout timed out or failed"
    kubectl get pods -n "$NAMESPACE" -l app="$DEPLOYMENT" -o wide
    return 1
  fi
  
  return 0
}

step_service() {
  log_step 4 "Ensure Service"
  
  if kubectl get service "$DEPLOYMENT" -n "$NAMESPACE" &>/dev/null; then
    log_ok "Service exists"
  else
    log_warn "Service not found, creating..."
    
    kubectl create service nodeport "$DEPLOYMENT" \
      --tcp=80:8080 \
      --tcp=32947:8080 \
      --namespace="$NAMESPACE" \
      --dry-run=client -o yaml | kubectl apply -f -
    
    log_ok "Service created"
  fi
  
  return 0
}

step_endpoints() {
  log_step 5 "Check Endpoints"
  
  local max_wait=60
  local waited=0
  
  while true; do
    local endpoints
    endpoints=$(kubectl get endpoints "$DEPLOYMENT" -n "$NAMESPACE" -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null || echo "")
    
    if [[ -n "$endpoints" ]]; then
      log_ok "Endpoints available: $endpoints"
      return 0
    fi
    
    if (( waited >= max_wait )); then
      log_err "Endpoints not available after ${max_wait}s"
      return 1
    fi
    
    echo "  Waiting for endpoints... (${waited}s/${max_wait}s)"
    sleep 5
    waited=$((waited + 5))
  done
}

step_health() {
  log_step 6 "Health Check"
  
  local max_wait=120
  local waited=0
  local health_url="http://127.0.0.1:8080/actuator/health"
  
  echo "Checking health at $health_url"
  
  while true; do
    if curl -sf --max-time 10 "$health_url" 2>/dev/null | grep -q '"status":"UP"'; then
      log_ok "Health check passed"
      return 0
    fi
    
    if (( waited >= max_wait )); then
      log_err "Health check failed after ${max_wait}s"
      kubectl get pods -n "$NAMESPACE" -l app="$DEPLOYMENT" -o wide
      local pod
      pod=$(kubectl get pods -n "$NAMESPACE" -l app="$DEPLOYMENT" --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
      if [[ -n "$pod" ]]; then
        echo "=== LOGS ==="
        kubectl logs -n "$NAMESPACE" "$pod" --tail=30
      fi
      return 1
    fi
    
    echo "  Waiting for health... (${waited}s/${max_wait}s)"
    sleep 5
    waited=$((waited + 5))
  done
}

step_verify() {
  log_step 7 "Final Verification"
  
  echo ""
  echo "=== DEPLOYMENT STATUS ==="
  kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" -o wide
  echo ""
  echo "=== POD STATUS ==="
  kubectl get pods -n "$NAMESPACE" -l app="$DEPLOYMENT" -o wide
  echo ""
  echo "=== SERVICE STATUS ==="
  kubectl get service "$DEPLOYMENT" -n "$NAMESPACE" -o wide
  echo ""
  echo "=== ENDPOINTS ==="
  kubectl get endpoints "$DEPLOYMENT" -n "$NAMESPACE"
  echo ""
  echo "=== TEST API ==="
  local pod
  pod=$(kubectl get pods -n "$NAMESPACE" -l app="$DEPLOYMENT" --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
  if [[ -n "$pod" ]]; then
    echo "Testing /api/monitoring/metrics on pod $pod:"
    kubectl exec -n "$NAMESPACE" "$pod" -- curl -s http://localhost:8080/api/monitoring/metrics 2>/dev/null | head -c 500
    echo ""
  fi
  
  log_ok "Deployment verification complete"
}

main() {
  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  Carbonet Deploy v1.2.0${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""
  
  local failed=0
  
  step_preflight || { failed=1; }
  if [[ $failed -eq 0 ]]; then
    step_deployment || { failed=1; }
  fi
  if [[ $failed -eq 0 ]]; then
    step_rollout || { failed=1; }
  fi
  if [[ $failed -eq 0 ]]; then
    step_service || { failed=1; }
  fi
  if [[ $failed -eq 0 ]]; then
    step_endpoints || { failed=1; }
  fi
  if [[ $failed -eq 0 ]]; then
    step_health || { failed=1; }
  fi
  if [[ $failed -eq 0 ]]; then
    step_verify || { failed=1; }
  fi
  
  echo ""
  if [[ $failed -eq 0 ]]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  DEPLOY SUCCESS${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Access: http://172.16.1.232/"
    return 0
  else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  DEPLOY FAILED${NC}"
    echo -e "${RED}========================================${NC}"
    return 1
  fi
}

main "$@"
