#!/usr/bin/env bash
set -euo pipefail

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
EVENT_LOG="$ROOT_DIR/var/ai-runtime/k8s-build-deploy-events.jsonl"
MANIFEST_LOG="$ROOT_DIR/var/ai-runtime/k8s-release-manifest.jsonl"
LOCK_FILE="$RUN_DIR/resonance-k8s-build-deploy-80.lock"

mkdir -p "$RUN_DIR" "$LOG_DIR" "$K8S_DIR" "$BACKUP_DIR" "$(dirname "$EVENT_LOG")"
cd "$ROOT_DIR"

exec 9>"$LOCK_FILE"
flock -n 9 || {
  printf '[k8s-build-deploy-80] another deploy is already running\n' >&2
  exit 0
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

log_event() {
  local status="$1"
  local code="$2"
  local message="$3"
  printf '{"ts":"%s","script":"resonance-k8s-build-deploy-80","status":"%s","code":"%s","image":"%s","message":"%s"}\n' \
    "$(date -Iseconds)" "$(json_escape "$status")" "$(json_escape "$code")" \
    "$(json_escape "$IMAGE_NAME")" "$(json_escape "$message")" >>"$EVENT_LOG"
}

log() {
  printf '[k8s-build-deploy-80] %s\n' "$*"
}

root_cmd() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

rollback_and_fail() {
  local code="$1"
  local message="$2"
  log "FAIL $code: $message"
  log_event FAIL "$code" "$message"
  kubectl -n "$NAMESPACE" rollout undo "deployment/$DEPLOYMENT" || true
  kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout="${ROLLBACK_TIMEOUT:-300s}" || true
  exit 1
}

backup_runtime() {
  local ts
  ts="$(date +%Y%m%d-%H%M%S)"
  kubectl -n "$NAMESPACE" get deploy "$DEPLOYMENT" -o yaml >"$BACKUP_DIR/$DEPLOYMENT.deploy.$ts.yaml" 2>/dev/null || true
  kubectl -n "$NAMESPACE" get svc "$SERVICE" -o yaml >"$BACKUP_DIR/$SERVICE.svc.$ts.yaml" 2>/dev/null || true
}

build_frontend() {
  if [[ "${SKIP_FRONTEND:-false}" == "true" ]]; then
    log 'frontend build skipped'
    return 0
  fi
  log 'frontend build'
  (
    cd "$ROOT_DIR/projects/carbonet-frontend/source"
    if [[ ! -d node_modules || "${FORCE_NPM_CI:-false}" == "true" ]]; then
      npm ci
    fi
    CARBONET_NODE_HEAP_MB="${CARBONET_NODE_HEAP_MB:-8192}" npm run build
  )
}

build_maven() {
  if [[ "${SKIP_MAVEN:-false}" == "true" ]]; then
    log 'maven package skipped'
    return 0
  fi
  log 'maven package'
  if [[ "${SKIP_MAVEN_CLEAN:-true}" == "true" ]]; then
    mvn -q -pl apps/project-runtime -am -Dmaven.test.skip=true package
  else
    mvn -q -pl apps/project-runtime -am -Dmaven.test.skip=true clean package
  fi
}

build_image() {
  if [[ "${SKIP_IMAGE_BUILD:-false}" == "true" ]]; then
    log 'image build skipped'
    return 0
  fi
  log "image build $IMAGE_NAME"
  rm -rf "$RELEASE_DIR"
  mkdir -p "$RELEASE_DIR/lib" "$RELEASE_DIR/config" "$RELEASE_DIR/ops/config"
  cp "$ROOT_DIR/apps/project-runtime/target/project-runtime.jar" "$RELEASE_DIR/project-runtime.jar"
  if [[ -f "$ROOT_DIR/third_party/kisa/kr.or.kisa.dapc.core-1.0.0.jar" ]]; then
    cp "$ROOT_DIR/third_party/kisa/kr.or.kisa.dapc.core-1.0.0.jar" "$RELEASE_DIR/lib/"
  fi
  if compgen -G "$ROOT_DIR/projects/carbonet-adapter/target/*.jar" >/dev/null; then
    cp "$ROOT_DIR"/projects/carbonet-adapter/target/*.jar "$RELEASE_DIR/lib/" || true
  fi
  if [[ -d "$ROOT_DIR/templates/skeletons/project-runtime-1.0.0/config" ]]; then
    cp -R "$ROOT_DIR/templates/skeletons/project-runtime-1.0.0/config/." "$RELEASE_DIR/config/"
  fi
  cp -R "$RELEASE_DIR/config/." "$RELEASE_DIR/ops/config/" 2>/dev/null || true

  root_cmd docker build \
    --build-arg PROJECT_ID="$PROJECT_ID" \
    -f "$ROOT_DIR/ops/docker/Dockerfile.project-runtime" \
    -t "$IMAGE_NAME" \
    "$RELEASE_DIR"
  root_cmd docker save "$IMAGE_NAME" | root_cmd ctr -n k8s.io images import - >/dev/null
  printf '%s\n' "$IMAGE_NAME" >"$RUN_DIR/carbonet-runtime-image.txt"
}

ensure_runtime_config() {
  log 'runtime config'
  kubectl get namespace "$NAMESPACE" >/dev/null 2>&1 || kubectl create namespace "$NAMESPACE"
  kubectl -n "$NAMESPACE" create configmap carbonet-runtime-config \
    --from-literal=PROJECT_ID="$PROJECT_ID" \
    --from-literal=SERVER_PORT=8080 \
    --from-literal=CUBRID_HOST="$CUBRID_HOST" \
    --from-literal=LOG_DIR=/tmp \
    --from-literal=SPRING_DATASOURCE_DRIVER_CLASS_NAME=cubrid.jdbc.driver.CUBRIDDriver \
    --from-literal=SPRING_DATASOURCE_URL="$DB_URL" \
    --from-literal=SPRING_PROFILES_ACTIVE=prod \
    --from-literal=APP_PROJECT_ID="$PROJECT_ID" \
    --from-literal=RESONANCE_RUNTIME_MODE=isolated \
    --from-literal=RESONANCE_FRAMEWORK=resonance \
    --from-literal=RESONANCE_PROJECT=carbonet \
    --from-literal=CARBONET_REACT_APP_FS_OVERRIDE_ENABLED=true \
    --from-literal=CARBONET_REACT_APP_FS_OVERRIDE_PATH=/app/react-app-overlay \
    --from-literal=CARBONET_AI_RECOMMENDATION_ENABLED=false \
    --dry-run=client -o yaml | kubectl apply -f -
}

ensure_ha_policy() {
  log 'ha policy and service ports (no resource limits)'
  kubectl -n "$NAMESPACE" scale "deployment/$DEPLOYMENT" --replicas=2 || true
  kubectl -n "$NAMESPACE" patch "deployment/$DEPLOYMENT" --type json -p='[
    {"op":"remove","path":"/spec/template/spec/containers/0/resources"}
  ]' || true
  kubectl -n "$NAMESPACE" patch "deployment/$DEPLOYMENT" --type strategic --patch-file /dev/stdin <<'PATCH'
spec:
  replicas: 2
  minReadySeconds: 20
  revisionHistoryLimit: 5
  progressDeadlineSeconds: 600
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  template:
    spec:
      terminationGracePeriodSeconds: 60
      containers:
        - name: carbonet-runtime
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 10"]
PATCH
  kubectl -n "$NAMESPACE" patch "deployment/$DEPLOYMENT" --type json -p='[
    {"op":"replace","path":"/spec/template/spec/containers/0/lifecycle","value":{"preStop":{"exec":{"command":["sh","-c","sleep 10"]}}}}
  ]'
  kubectl -n "$NAMESPACE" set env deployment/$DEPLOYMENT \
    SPRING_DATASOURCE_URL="$DB_URL" \
    SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE="${SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE:-2}" \
    SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE="${SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE:-0}" \
    SPRING_DATASOURCE_HIKARI_CONNECTION_TIMEOUT="${SPRING_DATASOURCE_HIKARI_CONNECTION_TIMEOUT:-8000}" \
    SPRING_DATASOURCE_HIKARI_VALIDATION_TIMEOUT="${SPRING_DATASOURCE_HIKARI_VALIDATION_TIMEOUT:-3000}" \
    SPRING_DATASOURCE_HIKARI_IDLE_TIMEOUT="${SPRING_DATASOURCE_HIKARI_IDLE_TIMEOUT:-30000}" \
    SPRING_DATASOURCE_HIKARI_MAX_LIFETIME="${SPRING_DATASOURCE_HIKARI_MAX_LIFETIME:-300000}" \
    SPRING_DATASOURCE_HIKARI_LEAK_DETECTION_THRESHOLD="${SPRING_DATASOURCE_HIKARI_LEAK_DETECTION_THRESHOLD:-60000}" \
    JAVA_TOOL_OPTIONS="-XX:+UseContainerSupport -XX:InitialRAMPercentage=30 -XX:MaxRAMPercentage=50 -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError -Dfile.encoding=UTF-8" \
    JAVA_OPTS="-XX:+UseContainerSupport -XX:InitialRAMPercentage=30 -XX:MaxRAMPercentage=50 -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError -Dfile.encoding=UTF-8" \
    TOKEN_ACCESS_SECRET="$(kubectl -n "$NAMESPACE" get secret carbonet-runtime-secret -o jsonpath='{.data.TOKEN_ACCESS_SECRET}')" \
    TOKEN_REFRESH_SECRET="$(kubectl -n "$NAMESPACE" get secret carbonet-runtime-secret -o jsonpath='{.data.TOKEN_REFRESH_SECRET}')"
  kubectl -n "$NAMESPACE" patch "service/$SERVICE" --type merge -p '{"spec":{"type":"NodePort"}}'
  kubectl -n "$NAMESPACE" patch "service/$SERVICE" --type json -p='[
    {"op":"replace","path":"/spec/ports","value":[
      {"name":"http","port":80,"targetPort":"http","nodePort":80,"protocol":"TCP"}
    ]}
  ]'
}

rollout_image() {
  local previous_image
  previous_image="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o jsonpath="{.spec.template.spec.containers[?(@.name=='$CONTAINER')].image}" 2>/dev/null || true)"
  log "previous image: ${previous_image:-unknown}"
  kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout="${PRE_ROLLOUT_TIMEOUT:-300s}" || true
  kubectl -n "$NAMESPACE" set image "deployment/$DEPLOYMENT" "$CONTAINER=$IMAGE_NAME" || rollback_and_fail SET_IMAGE_FAILED "kubectl set image failed"
  kubectl -n "$NAMESPACE" annotate "deployment/$DEPLOYMENT" "resonance.ai/image=$IMAGE_NAME" "resonance.ai/released-at=$(date -Iseconds)" --overwrite >/dev/null
  kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout="${ROLLOUT_TIMEOUT:-600s}" || rollback_and_fail ROLLOUT_FAILED "rollout failed"
}

verify_runtime() {
  log 'verify runtime'
  kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=120s
  local ready
  ready="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o jsonpath='{.status.readyReplicas}/{.status.replicas}')"
  [[ "$ready" == "2/2" ]] || rollback_and_fail READY_REPLICA_MISMATCH "ready replicas are $ready"
  curl -fsS --max-time 15 "http://127.0.0.1/actuator/health" >"$RUN_DIR/carbonet-runtime-health-80.json" || rollback_and_fail HEALTH_80_FAILED "http://127.0.0.1 health failed"
  printf '\n'
  cat "$RUN_DIR/carbonet-runtime-health-80.json"
  printf '\n'
}

write_release_manifest() {
  local git_sha jar_sha disk_root disk_opt
  git_sha="$(git rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"
  jar_sha="$(sha256sum "$ROOT_DIR/apps/project-runtime/target/project-runtime.jar" 2>/dev/null | awk '{print $1}' || echo unknown)"
  disk_root="$(df -h / | awk 'NR==2 {print $5 " used, " $4 " free"}')"
  disk_opt="$(df -h /opt | awk 'NR==2 {print $5 " used, " $4 " free"}')"
  printf '{"ts":"%s","projectId":"%s","gitSha":"%s","image":"%s","jarSha256":"%s","rootDisk":"%s","optDisk":"%s"}\n' \
    "$(date -Iseconds)" "$(json_escape "$PROJECT_ID")" "$(json_escape "$git_sha")" "$(json_escape "$IMAGE_NAME")" \
    "$(json_escape "$jar_sha")" "$(json_escape "$disk_root")" "$(json_escape "$disk_opt")" >>"$MANIFEST_LOG"
}

preflight_self_heal() {
  log 'preflight self-heal'
  # Previous root-run deploys can leave Vite output owned by root. Fix before npm/vite tries to unlink it.
  for d in \
    "$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static/react-app" \
    "$ROOT_DIR/projects/carbonet-frontend/target/classes/static/react-app" \
    "$ROOT_DIR/apps/carbonet-app/src/main/resources/static/react-app" \
    "$ROOT_DIR/projects/carbonet-frontend/source/dist"; do
    if [[ -e "$d" ]]; then
      root_cmd chown -R "$(id -un):$(id -gn)" "$d" || true
      chmod -R u+rwX "$d" || true
    fi
  done
  if ! sudo -n true >/dev/null 2>&1; then
    log_event WARN SUDO_NONINTERACTIVE_UNAVAILABLE 'sudo -n is unavailable; docker/ctr import may fail from web button'
  fi
  kubectl cluster-info >/dev/null 2>&1 || rollback_and_fail KUBECTL_UNAVAILABLE 'kubectl cannot reach cluster before deploy'
}

main() {
  log_event START STARTED "build deploy started"
  preflight_self_heal
  backup_runtime
  build_frontend
  build_maven
  build_image
  ensure_runtime_config
  ensure_ha_policy
  rollout_image
  ensure_ha_policy
  verify_runtime
  write_release_manifest
  log_event OK DEPLOYED "build deploy completed"
  kubectl -n "$NAMESPACE" get deploy,svc,pod -o wide
}

main "$@"
