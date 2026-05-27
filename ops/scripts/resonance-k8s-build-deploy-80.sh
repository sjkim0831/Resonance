#!/usr/bin/env bash
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

log() {
  printf '[k8s-build-deploy-80] %s\n' "$*"
}

# Always remove stale lock file at startup
if [[ -e "$LOCK_FILE" ]]; then
  rm -f "$LOCK_FILE" 2>/dev/null || true
  log "removed stale lock file: $LOCK_FILE"
fi

mkdir -p "$RUN_DIR" "$LOG_DIR" "$K8S_DIR" "$BACKUP_DIR" "$RUNTIME_DATA_DIR/admin/emission-survey-admin" "$(dirname "$EVENT_LOG")"
cd "$ROOT_DIR"

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

current_process_guard_regex() {
  local self="$$"
  local parent="${PPID:-}"
  printf "^(%s%s)$" "$self" "${parent:+|$parent}"
}

active_deploy_pids() {
  local guard
  guard="$(current_process_guard_regex)"
  pgrep -f "[r]esonance-k8s-build-deploy-80.sh" 2>/dev/null | grep -v -E "$guard" || true
}

lock_owner_pids() {
  if [[ ! -e "$LOCK_FILE" ]]; then
    return 0
  fi
  if command -v fuser >/dev/null 2>&1; then
    fuser "$LOCK_FILE" 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+$' || true
  elif command -v lsof >/dev/null 2>&1; then
    lsof -t "$LOCK_FILE" 2>/dev/null || true
  fi
}

terminate_pid_list() {
  local reason="$1"
  shift || true
  local pids=("$@")
  if [[ "${#pids[@]}" -eq 0 ]]; then
    return 1
  fi
  printf '[k8s-build-deploy-80] terminating %s: %s\n' "$reason" "${pids[*]}" >&2
  log_event WARN TERMINATING_EXISTING_DEPLOY "terminating $reason: ${pids[*]}"
  kill -TERM "${pids[@]}" 2>/dev/null || true
  local waited=0
  while [[ "$waited" -lt "${DEPLOY_TERMINATE_GRACE_SECONDS:-15}" ]]; do
    sleep 1
    waited=$((waited+1))
    local alive=()
    local pid
    for pid in "${pids[@]}"; do
      if ps -p "$pid" >/dev/null 2>&1; then
        alive+=("$pid")
      fi
    done
    if [[ "${#alive[@]}" -eq 0 ]]; then
      return 0
    fi
  done
  kill -KILL "${pids[@]}" 2>/dev/null || true
  sleep 1
  return 0
}

recover_stale_deploy_lock() {
  if [[ "${TERMINATE_EXISTING_DEPLOY_ON_START:-true}" != "true" ]]; then
    return 1
  fi

  local guard deploy_pids owners
  guard="$(current_process_guard_regex)"
  mapfile -t deploy_pids < <(active_deploy_pids)
  if [[ "${#deploy_pids[@]}" -gt 0 ]]; then
    terminate_pid_list "old deploy processes" "${deploy_pids[@]}" || true
  fi

  mapfile -t owners < <(lock_owner_pids | grep -v -E "$guard" || true)
  if [[ "${#owners[@]}" -gt 0 ]]; then
    terminate_pid_list "deploy lock owners" "${owners[@]}" || true
  fi

  mapfile -t owners < <(lock_owner_pids | grep -v -E "$guard" || true)
  if [[ "${#owners[@]}" -eq 0 && -e "$LOCK_FILE" ]]; then
    rm -f "$LOCK_FILE" 2>/dev/null || true
    log_event WARN STALE_DEPLOY_LOCK_REMOVED "removed deploy lock with no live owner"
  fi
  return 0
}

pid_has_containerd_parent() {
  local pid="$1"
  local current="$pid"
  local cmd parent depth=0
  while [[ -n "$current" && "$current" != "0" && "$depth" -lt 12 ]]; do
    cmd="$(ps -o comm= -p "$current" 2>/dev/null | awk '{$1=$1; print}' || true)"
    if [[ "$cmd" == "containerd-shim"* || "$cmd" == "runc" ]]; then
      return 0
    fi
    parent="$(ps -o ppid= -p "$current" 2>/dev/null | awk '{$1=$1; print}' || true)"
    [[ -n "$parent" && "$parent" != "$current" ]] || break
    current="$parent"
    depth=$((depth+1))
  done
  return 1
}

cleanup_residual_runtime_processes() {
  if [[ "${CLEANUP_RESIDUAL_RUNTIME_PROCESSES:-true}" != "true" ]]; then
    log "residual runtime process cleanup skipped"
    return 0
  fi

  log "check residual host runtime processes before build/deploy"
  local candidates=() residual=() pid
  mapfile -t candidates < <(pgrep -f "[p]roject-runtime.jar.*--server.port=8080" 2>/dev/null || true)
  for pid in "${candidates[@]}"; do
    [[ "$pid" != "$$" && "$pid" != "${PPID:-}" ]] || continue
    if pid_has_containerd_parent "$pid"; then
      log "keep k8s-managed runtime process: pid=$pid"
    else
      residual+=("$pid")
    fi
  done

  if [[ "${#residual[@]}" -eq 0 ]]; then
    log_event OK NO_RESIDUAL_RUNTIME_PROCESS "no host residual project-runtime process found"
    return 0
  fi

  terminate_pid_list "residual host runtime processes" "${residual[@]}" || true
  log_event WARN RESIDUAL_RUNTIME_PROCESS_TERMINATED "terminated residual host runtime processes: ${residual[*]}"
}

exec 9>"$LOCK_FILE"
flock -n 9 || {
  if recover_stale_deploy_lock; then
    flock -w "${DEPLOY_LOCK_RETRY_SECONDS:-30}" 9 || {
      printf '[k8s-build-deploy-80] previous deploy did not release lock after termination\n' >&2
      log_event FAIL DEPLOY_LOCK_STILL_HELD "previous deploy did not release lock after termination"
      exit 1
    }
  else
    printf '[k8s-build-deploy-80] another deploy is already running\n' >&2
    log_event WARN DEPLOY_ALREADY_RUNNING "another deploy is already running"
    exit "${DEPLOY_ALREADY_RUNNING_EXIT_CODE:-75}"
  fi
}

timeline_event() {
  local phase="$1"
  local detail="$2"
  local pods
  pods="$(kubectl -n "$NAMESPACE" get pod -l "app=$DEPLOYMENT" -o custom-columns=NAME:.metadata.name,READY:.status.containerStatuses[0].ready,PHASE:.status.phase,RESTARTS:.status.containerStatuses[0].restartCount,AGE:.metadata.creationTimestamp,NODE:.spec.nodeName --no-headers 2>/dev/null | sed ':a;N;$!ba;s/\n/ | /g' || true)"
  printf '{"ts":"%s","script":"resonance-k8s-build-deploy-80","phase":"%s","image":"%s","detail":"%s","pods":"%s"}\n' \
    "$(date -Iseconds)" "$(json_escape "$phase")" "$(json_escape "$IMAGE_NAME")" \
    "$(json_escape "$detail")" "$(json_escape "$pods")" >>"$ROLLOUT_TIMELINE_LOG"
  log "timeline $phase: $detail"
}

log() {
  printf '[k8s-build-deploy-80] %s\n' "$*"
}

root_cmd() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
  elif [[ -n "${RESONANCE_SUDO_PASSWORD:-}" ]]; then
    printf '%s\n' "$RESONANCE_SUDO_PASSWORD" | sudo -S "$@"
  elif command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
    sudo "$@"
  else
    sudo "$@"
  fi
}

image_available_in_containerd() {
  root_cmd ctr -n k8s.io images ls 2>&1 | grep -F "$IMAGE_NAME" >/dev/null
}

normalize_generated_ownership() {
  if [[ "${NORMALIZE_GENERATED_OWNERSHIP:-true}" != "true" ]]; then
    return 0
  fi
  if ! id sjkim >/dev/null 2>&1; then
    return 0
  fi
  local targets=(
    "$ROOT_DIR/var/releases"
    "$ROOT_DIR/var/run"
    "$ROOT_DIR/var/logs"
    "$ROOT_DIR/var/ai-runtime"
    "$ROOT_DIR/var/backups"
    "$ROOT_DIR/var/k8s"
    "$ROOT_DIR/data"
    "$ROOT_DIR/modules"
    "$ROOT_DIR/apps/carbonet-app/src/main/resources/static/react-app"
    "$ROOT_DIR/apps/project-runtime/src/main/resources/static/react-app"
    "$ROOT_DIR/apps/project-runtime/target"
    "$ROOT_DIR/apps/project-runtime/target/classes/static/react-app"
    "$ROOT_DIR/apps/carbonet-app/target"
    "$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static/react-app"
    "$ROOT_DIR/projects/carbonet-frontend/target/classes/static/react-app"
    "$ROOT_DIR/projects/carbonet-adapter/target"
  )
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    chown -R sjkim:sjkim "${targets[@]}" 2>/dev/null || true
  elif command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
    sudo chown -R sjkim:sjkim "${targets[@]}" 2>/dev/null || true
  fi
}

trap normalize_generated_ownership EXIT

ensure_release_dir_writable() {
  if [[ ! -e "$RELEASE_DIR" || -w "$RELEASE_DIR" ]]; then
    return 0
  fi
  log "release dir is not writable; attempting ownership repair: $RELEASE_DIR"
  if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
    sudo chown -R "$(id -u):$(id -g)" "$ROOT_DIR/var/releases/$PROJECT_ID"
    return 0
  fi
  log_event FAIL RELEASE_DIR_PERMISSION_DENIED "release dir is not writable and sudo is unavailable: $RELEASE_DIR"
  return 1
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
  normalize_generated_ownership
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
  normalize_generated_ownership
  (
    cd "$ROOT_DIR/projects/carbonet-frontend/source"
    if [[ ! -d node_modules || "${FORCE_NPM_CI:-false}" == "true" ]]; then
      npm ci
    fi
    CARBONET_NODE_HEAP_MB="${CARBONET_NODE_HEAP_MB:-8192}" npm run build
  )
}

verify_survey_admin_combobox_bundle() {
  if [[ "${VERIFY_SURVEY_ADMIN_PRODUCT_COMBOBOX:-true}" != "true" ]]; then
    log 'survey-admin product combobox verification skipped'
    return 0
  fi
  local verifier="$ROOT_DIR/ops/scripts/verify-survey-admin-product-combobox.sh"
  if [[ ! -x "$verifier" ]]; then
    rollback_and_fail SURVEY_ADMIN_COMBOBOX_VERIFIER_MISSING "missing verifier: $verifier"
  fi
  log 'survey-admin product combobox verification'
  "$verifier" || rollback_and_fail SURVEY_ADMIN_COMBOBOX_STALE "survey-admin product combobox source/bundle markers are stale"
}

build_maven() {
  if [[ "${SKIP_MAVEN:-false}" == "true" ]]; then
    log 'maven package skipped'
    return 0
  fi
  log 'maven package'
  normalize_generated_ownership
  normalize_generated_ownership
  root_cmd rm -rf "$ROOT_DIR/apps/project-runtime/target/classes/static/react-app"
  normalize_generated_ownership
  if [[ "${SKIP_MAVEN_CLEAN:-true}" == "true" ]]; then
    mvn -q -pl apps/project-runtime -am -Dmaven.test.skip=true package
  else
    mvn -q -pl apps/project-runtime -am -Dmaven.test.skip=true clean package
  fi
  verify_survey_admin_combobox_bundle
}

build_image() {
  if [[ "${SKIP_IMAGE_BUILD:-false}" == "true" ]]; then
    log 'image build skipped'
    return 0
  fi
  log "image build $IMAGE_NAME"
  ensure_release_dir_writable
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
  root_cmd sh -c 'docker save "$1" | ctr -n k8s.io images import - >/dev/null' _ "$IMAGE_NAME"

  # verify image is actually available in containerd
  if ! image_available_in_containerd; then
    rollback_and_fail IMAGE_NOT_FOUND_IN_CONTAINERD "image not found in containerd after import: $IMAGE_NAME"
  fi
  log "image verified in containerd: $IMAGE_NAME"
  log_event OK IMAGE_PUSHED "image successfully pushed and verified in containerd: $IMAGE_NAME"
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
  log 'ha policy and service ports'
  mkdir -p "$RUNTIME_DATA_DIR/admin/emission-survey-admin"
  kubectl -n "$NAMESPACE" scale "deployment/$DEPLOYMENT" --replicas=2 || true
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
          volumeMounts:
            - name: runtime-manifest
              mountPath: /app/config/manifest.json
              readOnly: true
              subPath: manifest.json
            - name: react-app-overlay
              mountPath: /app/react-app-overlay
              readOnly: true
            - name: carbonet-runtime-data
              mountPath: /app/data
            - name: tmp
              mountPath: /tmp
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 10"]
      volumes:
        - name: carbonet-runtime-data
          hostPath:
            path: /opt/Resonance/data
            type: DirectoryOrCreate
        - name: runtime-manifest
          configMap:
            name: carbonet-runtime-manifest
        - name: react-app-overlay
          hostPath:
            path: /opt/Resonance/projects/carbonet-frontend/src/main/resources/static/react-app
            type: DirectoryOrCreate
        - name: tmp
          emptyDir:
            sizeLimit: 2Gi
PATCH
  kubectl -n "$NAMESPACE" set env "deployment/$DEPLOYMENT" \
    SPRING_DATASOURCE_URL="$DB_URL" \
    CARBONET_REACT_APP_FS_OVERRIDE_ENABLED=true \
    CARBONET_REACT_APP_FS_OVERRIDE_PATH=/app/react-app-overlay \
    SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE="${SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE:-2}" \
    SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE="${SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE:-0}" \
    SPRING_DATASOURCE_HIKARI_CONNECTION_TIMEOUT="${SPRING_DATASOURCE_HIKARI_CONNECTION_TIMEOUT:-8000}" \
    SPRING_DATASOURCE_HIKARI_VALIDATION_TIMEOUT="${SPRING_DATASOURCE_HIKARI_VALIDATION_TIMEOUT:-3000}" \
    SPRING_DATASOURCE_HIKARI_IDLE_TIMEOUT="${SPRING_DATASOURCE_HIKARI_IDLE_TIMEOUT:-30000}" \
    SPRING_DATASOURCE_HIKARI_MAX_LIFETIME="${SPRING_DATASOURCE_HIKARI_MAX_LIFETIME:-300000}" \
    SPRING_DATASOURCE_HIKARI_LEAK_DETECTION_THRESHOLD="${SPRING_DATASOURCE_HIKARI_LEAK_DETECTION_THRESHOLD:-60000}"
  kubectl -n "$NAMESPACE" patch "service/$SERVICE" --type merge -p '{"spec":{"type":"NodePort"}}'
  kubectl -n "$NAMESPACE" patch "service/$SERVICE" --type json -p='[
    {"op":"replace","path":"/spec/ports","value":[
      {"name":"http","port":80,"targetPort":"http","nodePort":80,"protocol":"TCP"},
      {"name":"http-alt-32947","port":32947,"targetPort":"http","nodePort":32947,"protocol":"TCP"}
    ]}
  ]'
}

rollout_image() {
  local previous_image
  previous_image="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o jsonpath="{.spec.template.spec.containers[?(@.name=='$CONTAINER')].image}" 2>/dev/null || true)"
  log "previous image: ${previous_image:-unknown}"
  timeline_event "before-rollout" "previous image: ${previous_image:-unknown}"
  
  # verify image exists in containerd before rollout
  if ! image_available_in_containerd; then
    rollback_and_fail IMAGE_NOT_FOUND_BEFORE_ROLLOUT "image not found in containerd: $IMAGE_NAME"
  fi
  log "image verified before rollout: $IMAGE_NAME"
  
  kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout="${PRE_ROLLOUT_TIMEOUT:-300s}" || true
  kubectl -n "$NAMESPACE" set image "deployment/$DEPLOYMENT" "$CONTAINER=$IMAGE_NAME" || rollback_and_fail SET_IMAGE_FAILED "kubectl set image failed"
  kubectl -n "$NAMESPACE" annotate "deployment/$DEPLOYMENT" "resonance.ai/image=$IMAGE_NAME" "resonance.ai/released-at=$(date -Iseconds)" --overwrite >/dev/null
  timeline_event "image-set" "new image requested"
  watch_rollout_timeline
  kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout="${ROLLOUT_TIMEOUT:-600s}" || rollback_and_fail ROLLOUT_FAILED "rollout failed"
  timeline_event "rollout-complete" "deployment rollout status complete"
  cleanup_stale_replicasets
}

cleanup_stale_replicasets() {
  if [[ "${CLEANUP_STALE_REPLICASETS:-true}" != "true" ]]; then
    return 0
  fi
  log "cleanup stale replicasets"
  local rows rs image desired
  rows="$(kubectl -n "$NAMESPACE" get rs -l "app=$DEPLOYMENT" -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.template.spec.containers[0].image}{"\t"}{.spec.replicas}{"\n"}{end}' 2>/dev/null || true)"
  while IFS=$'\t' read -r rs image desired; do
    [[ -n "$rs" ]] || continue
    if [[ "$image" != "$IMAGE_NAME" && "${desired:-0}" != "0" ]]; then
      log "scale stale replicaset to 0: $rs ($image)"
      kubectl -n "$NAMESPACE" scale "rs/$rs" --replicas=0 || true
      log_event WARN STALE_REPLICASET_SCALED_DOWN "scaled stale replicaset to 0: $rs ($image)"
    fi
  done <<<"$rows"
  cleanup_stale_pods
}

cleanup_stale_pods() {
  if [[ "${CLEANUP_STALE_PODS:-true}" != "true" ]]; then
    return 0
  fi
  local rows pod image phase deletion_ts
  rows="$(kubectl -n "$NAMESPACE" get pod -l "app=$DEPLOYMENT" -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].image}{"\t"}{.status.phase}{"\t"}{.metadata.deletionTimestamp}{"\n"}{end}' 2>/dev/null || true)"
  while IFS=$'\t' read -r pod image phase deletion_ts; do
    [[ -n "$pod" ]] || continue
    if [[ "$image" != "$IMAGE_NAME" ]]; then
      if [[ -n "${deletion_ts:-}" || "${phase:-}" != "Running" ]]; then
        log "force delete stale pod: $pod ($image phase=$phase deleting=${deletion_ts:-no})"
        kubectl -n "$NAMESPACE" delete pod "$pod" --grace-period=0 --force --wait=false || true
        log_event WARN STALE_POD_FORCE_DELETED "force deleted stale pod: $pod ($image phase=$phase)"
      fi
    fi
  done <<<"$rows"
}

watch_rollout_timeline() {
  local deadline=$((SECONDS + ${ROLLOUT_WATCH_SECONDS:-420}))
  local last=""
  while (( SECONDS < deadline )); do
    local status
    status="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o jsonpath='{.status.updatedReplicas}/{.status.readyReplicas}/{.status.replicas}/{.status.availableReplicas}' 2>/dev/null || true)"
    if [[ "$status" != "$last" ]]; then
      timeline_event "rollout-progress" "updated/ready/desired/available=$status"
      last="$status"
    fi
    if [[ "$status" == "2/2/2/2" ]]; then
      return 0
    fi
    sleep 3
  done
  timeline_event "rollout-watch-timeout" "rollout did not reach 2/2/2/2 inside watch window"
  return 0
}

verify_runtime() {
  log 'verify runtime'
  kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=120s
  local ready
  ready="$(kubectl -n "$NAMESPACE" get "deployment/$DEPLOYMENT" -o jsonpath='{.status.readyReplicas}/{.status.replicas}')"
  [[ "$ready" == "2/2" ]] || rollback_and_fail READY_REPLICA_MISMATCH "ready replicas are $ready"
  curl -fsS --max-time 15 "http://127.0.0.1/actuator/health" >"$RUN_DIR/carbonet-runtime-health-80.json" || rollback_and_fail HEALTH_80_FAILED "http://127.0.0.1 health failed"
  curl -fsS --max-time 15 "http://127.0.0.1:32947/actuator/health" >"$RUN_DIR/carbonet-runtime-health-32947.json" || rollback_and_fail HEALTH_32947_FAILED "http://127.0.0.1:32947 health failed"
  printf '\n'
  cat "$RUN_DIR/carbonet-runtime-health-80.json"
  printf '\n'
  timeline_event "health-ok" "80 health check passed"
  timeline_event "health-ok" "32947 health check passed"
}

verify_react_bootstrap_assets() {
  if [[ "${VERIFY_REACT_BOOTSTRAP_ASSETS:-true}" != "true" ]]; then
    log "react bootstrap asset verification skipped"
    return 0
  fi
  local path="${VERIFY_REACT_BOOTSTRAP_PATH:-/admin/login/loginView}"
  local bootstrap_url="http://127.0.0.1/admin/login/api/app/bootstrap?path=${path}"
  local bootstrap_file asset_url asset_path asset_file asset_base chunk_list chunk chunk_url chunk_status chunk_type
  bootstrap_file="$RUN_DIR/react-bootstrap-$(date +%Y%m%d-%H%M%S).json"
  log "verify react bootstrap assets: $path"
  curl -fsS --max-time 20 "$bootstrap_url" >"$bootstrap_file" || rollback_and_fail REACT_BOOTSTRAP_FAILED "bootstrap endpoint failed: $bootstrap_url"
  asset_url="$(python3 - "$bootstrap_file" <<'PY'
import json,sys
data=json.load(open(sys.argv[1], encoding="utf-8"))
value=data.get("reactAppProdJs") or data.get("reactAppJs") or ""
print(value)
PY
)"
  [[ -n "$asset_url" ]] || rollback_and_fail REACT_BOOTSTRAP_ASSET_MISSING "bootstrap did not return reactAppProdJs"
  asset_path="${asset_url%%\?*}"
  asset_base="${asset_path%/*}"
  asset_file="$RUN_DIR/react-bootstrap-main.js"
  curl -fsS --max-time 20 "http://127.0.0.1${asset_path}" >"$asset_file" || rollback_and_fail REACT_MAIN_ASSET_FAILED "main asset failed: $asset_path"
  if command -v node >/dev/null 2>&1; then
    node --check "$asset_file" >/dev/null || rollback_and_fail REACT_MAIN_ASSET_SYNTAX_FAILED "main asset failed node --check: $asset_path"
  fi
  chunk_list="$(grep -oE 'assets/[A-Za-z0-9._-]+\.js' "$asset_file" | sort -u | head -40 || true)"
  while IFS= read -r chunk; do
    [[ -n "$chunk" ]] || continue
    if [[ "$chunk" == /* ]]; then
      chunk_url="$chunk"
    elif [[ "$chunk" == assets/* ]]; then
      chunk_url="${asset_base%/}/${chunk#assets/}"
    else
      chunk_url="${asset_base%/}/${chunk#./}"
    fi
    chunk_status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "http://127.0.0.1${chunk_url}")"
    chunk_type="$(curl -sSI --max-time 15 "http://127.0.0.1${chunk_url}" 2>/dev/null | awk -F': ' 'tolower($1)=="content-type"{print tolower($2); exit}' | tr -d '\r')"
    if [[ "$chunk_status" != "200" || "$chunk_type" != *"javascript"* ]]; then
      rollback_and_fail REACT_CHUNK_ASSET_FAILED "chunk failed: $chunk_url status=$chunk_status content-type=$chunk_type"
    fi
  done <<<"$chunk_list"
  timeline_event "react-bootstrap-ok" "$path -> $asset_path"
  log_event OK REACT_BOOTSTRAP_ASSETS_OK "$path bootstrap and imported chunks are fresh"
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

is_frontend_path() {
  local path="$1"
  case "$path" in
    projects/carbonet-frontend/source/*|\
    projects/carbonet-frontend/src/main/resources/static/react-app/*|\
    projects/carbonet-frontend/target/classes/static/react-app/*|\
    apps/carbonet-app/src/main/resources/static/react-app/*|\
    apps/project-runtime/src/main/resources/static/react-app/*|\
    apps/project-runtime/target/classes/static/react-app/*)
      return 0
      ;;
  esac
  return 1
}

changed_paths_for_deploy() {
  git -C "$ROOT_DIR" status --porcelain --untracked-files=all 2>/dev/null \
    | sed -E 's/^...//; s/^.* -> //' \
    | grep -v -E '^(var/|logs/|target/|\.gradle/|\.idea/|\.vscode/)' \
    || true
}

should_frontend_only_deploy() {
  if [[ "${FORCE_FULL_DEPLOY:-false}" == "true" ]]; then
    return 1
  fi
  if [[ "${FRONTEND_ONLY:-false}" == "true" ]]; then
    return 0
  fi
  if [[ "${AUTO_FRONTEND_ONLY:-true}" != "true" ]]; then
    return 1
  fi

  local paths=() path
  mapfile -t paths < <(changed_paths_for_deploy)
  [[ "${#paths[@]}" -gt 0 ]] || return 1
  for path in "${paths[@]}"; do
    [[ -n "$path" ]] || continue
    if ! is_frontend_path "$path"; then
      return 1
    fi
  done
  return 0
}

frontend_only_deploy() {
  log_event START FRONTEND_ONLY_STARTED "frontend-only build deploy started"
  cleanup_residual_runtime_processes
  build_frontend
  verify_survey_admin_combobox_bundle
  ensure_runtime_config
  ensure_ha_policy
  verify_runtime
  verify_react_bootstrap_assets
  write_release_manifest
  log_event OK FRONTEND_ONLY_DEPLOYED "frontend-only build deploy completed"
  kubectl -n "$NAMESPACE" get deploy,svc,pod -o wide
}

main() {
  if should_frontend_only_deploy; then
    log "frontend-only deploy mode selected"
    frontend_only_deploy
    return 0
  fi
  log_event START STARTED "build deploy started"
  cleanup_residual_runtime_processes
  backup_runtime
  build_frontend
  verify_survey_admin_combobox_bundle
  build_maven
  build_image
  ensure_runtime_config
  ensure_ha_policy
  rollout_image
  ensure_ha_policy
  verify_runtime
  verify_react_bootstrap_assets
  write_release_manifest
  log_event OK DEPLOYED "build deploy completed"
  kubectl -n "$NAMESPACE" get deploy,svc,pod -o wide
}

main "$@"
