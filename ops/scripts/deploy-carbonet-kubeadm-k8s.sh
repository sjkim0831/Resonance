#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
PROJECT_ID="${PROJECT_ID:-P003}"
SERVICE_NODE_PORT="${SERVICE_NODE_PORT:-80}"
CUBRID_HOST="${CUBRID_HOST:-cubrid-carbonet.${NAMESPACE}.svc.cluster.local}"
DB_NAME="${DB_NAME:-carbonet}"
DB_USER="${DB_USER:-dba}"
DB_PASSWORD="${DB_PASSWORD:-}"
IMAGE_NAME="${IMAGE_NAME:-registry.local/carbonet-runtime:$(date +%Y.%m.%d-%H%M%S-kubeadm)}"
RELEASE_DIR="$ROOT_DIR/var/releases/$PROJECT_ID/image-context"
LOG_DIR="$ROOT_DIR/var/logs"
RUN_DIR="$ROOT_DIR/var/run"
K8S_DIR="$ROOT_DIR/var/k8s"

mkdir -p "$LOG_DIR" "$RUN_DIR" "$K8S_DIR"
cd "$ROOT_DIR"

log() {
  printf '[carbonet-kubeadm] %s\n' "$*"
}

ensure_secret() {
  local name="$1"
  if kubectl -n "$NAMESPACE" get secret "$name" >/dev/null 2>&1 && [[ "${ROTATE_RUNTIME_SECRETS:-false}" != "true" ]]; then
    return 0
  fi
  local access_secret refresh_secret
  access_secret="$(openssl rand -hex 32)"
  refresh_secret="$(openssl rand -hex 32)"
  kubectl -n "$NAMESPACE" create secret generic carbonet-runtime-secret \
    --from-literal=DB_USERNAME="$DB_USER" \
    --from-literal=DB_PASSWORD="$DB_PASSWORD" \
    --from-literal=DB_URL="jdbc:postgresql://${CUBRID_HOST}:5432/${DB_NAME}?charset=UTF-8" \
    --from-literal=SPRING_DATASOURCE_USERNAME="$DB_USER" \
    --from-literal=SPRING_DATASOURCE_PASSWORD="$DB_PASSWORD" \
    --from-literal=TOKEN_ACCESS_SECRET="$access_secret" \
    --from-literal=TOKEN_REFRESH_SECRET="$refresh_secret" \
    --dry-run=client -o yaml | kubectl apply -f -
}

apply_runtime_config() {
  kubectl get namespace "$NAMESPACE" >/dev/null 2>&1 || kubectl create namespace "$NAMESPACE"
  kubectl -n "$NAMESPACE" create configmap carbonet-runtime-config \
    --from-literal=PROJECT_ID="$PROJECT_ID" \
    --from-literal=SERVER_PORT=8080 \
    --from-literal=POSTGRES_HOST="$CUBRID_HOST" \
    --from-literal=LOG_DIR=/tmp \
    --from-literal=SPRING_DATASOURCE_DRIVER_CLASS_NAME=org.postgresql.Driver \
    --from-literal=SPRING_DATASOURCE_URL="jdbc:postgresql://${CUBRID_HOST}:5432/${DB_NAME}?charset=UTF-8" \
    --from-literal=SPRING_PROFILES_ACTIVE=prod \
    --from-literal=APP_PROJECT_ID="$PROJECT_ID" \
    --from-literal=RESONANCE_RUNTIME_MODE=isolated \
    --from-literal=RESONANCE_FRAMEWORK=resonance \
    --from-literal=RESONANCE_PROJECT=carbonet \
    --from-literal=CARBONET_REACT_APP_FS_OVERRIDE_ENABLED=true \
    --from-literal=CARBONET_REACT_APP_FS_OVERRIDE_PATH=/app/react-app-overlay \
    --from-literal=CARBONET_AI_RECOMMENDATION_ENABLED=false \
    --dry-run=client -o yaml | kubectl apply -f -

  cat > "$K8S_DIR/carbonet-runtime-manifest.json" <<JSON
{
  "projectId": "${PROJECT_ID}",
  "projectName": "Carbonet Runtime",
  "ownership": {
    "commonRuntime": "versioned-common-jars",
    "projectAdapter": "carbonet-adapter",
    "projectRuntime": "project-runtime"
  },
  "versions": {
    "commonCore": "1.1.0",
    "stableGate": "v1",
    "adapterArtifact": "1.0.0",
    "adapterContract": "v1"
  },
  "bindings": {
    "database": {
      "bindingMode": "RESTORED_POSTGRES_DB",
      "commonDb": {
        "url": "jdbc:postgresql://${CUBRID_HOST}:5432/${DB_NAME}?charset=UTF-8",
        "schema": "public"
      },
      "projectDb": {
        "url": "jdbc:postgresql://${CUBRID_HOST}:5432/${DB_NAME}?charset=UTF-8",
        "schema": "public"
      }
    },
    "menu": {
      "profile": "carbonet-admin-v1",
      "rootCode": "ROOT",
      "apiPrefix": "/api"
    },
    "theme": {
      "id": "carbonet-default-light",
      "version": "1.0.0"
    }
  },
  "runtime": {
    "runtimeMode": "DEDICATED_PROJECT_RUNTIME",
    "lane": "PROJECT_RUNTIME",
    "sharedRuntimeId": "project-runtime-common",
    "routing": {
      "selectorPath": "/projects/${PROJECT_ID}",
      "routePrefix": "/r/${PROJECT_ID}",
      "externalBaseUrl": "http://172.16.1.232:${SERVICE_NODE_PORT}",
      "domainHost": "172.16.1.232",
      "managementPath": "/api/operations/governance/runtime/projects/${PROJECT_ID}",
      "infoPath": "/api/runtime/project-info"
    }
  }
}
JSON

  kubectl -n "$NAMESPACE" create configmap carbonet-runtime-manifest \
    --from-file=manifest.json="$K8S_DIR/carbonet-runtime-manifest.json" \
    --dry-run=client -o yaml | kubectl apply -f -

  ensure_secret carbonet-runtime-secret
  kubectl -n "$NAMESPACE" create secret generic carbonet-runtime-ecoinvent-secret \
    --from-literal=CARBONET_ECOINVENT_CLIENT_ID="${CARBONET_ECOINVENT_CLIENT_ID:-}" \
    --from-literal=CARBONET_ECOINVENT_CLIENT_SECRET="${CARBONET_ECOINVENT_CLIENT_SECRET:-}" \
    --dry-run=client -o yaml | kubectl apply -f -
}

build_frontend() {
  if [[ "${SKIP_FRONTEND:-false}" == "true" ]]; then
    log 'frontend build skipped'
    return 0
  fi
  log 'frontend dependencies/build'
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
  if [[ "${SKIP_MAVEN_CLEAN:-false}" == "true" ]]; then
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
  log "image context $IMAGE_NAME"
  export DOCKER_BUILDKIT=1
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

  sudo docker build \
    --build-arg PROJECT_ID="$PROJECT_ID" \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    --cache-from "type=registry,ref=registry.local/carbonet-runtime:2026.06.18-*" \
    -f "$ROOT_DIR/ops/docker/Dockerfile.project-runtime" \
    -t "$IMAGE_NAME" \
    "$RELEASE_DIR"
  sudo docker save "$IMAGE_NAME" | sudo ctr -n k8s.io images import - >/dev/null
  printf '%s\n' "$IMAGE_NAME" > "$RUN_DIR/carbonet-runtime-image.txt"
}

apply_runtime_workload() {
  cat > "$K8S_DIR/carbonet-runtime-kubeadm.yaml" <<YAML
apiVersion: apps/v1
kind: Deployment
metadata:
  name: carbonet-runtime
  namespace: ${NAMESPACE}
  labels:
    app: carbonet-runtime
    framework: resonance
    project: carbonet
spec:
  replicas: 4
  revisionHistoryLimit: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  selector:
    matchLabels:
      app: carbonet-runtime
  template:
    metadata:
      labels:
        app: carbonet-runtime
        framework: resonance
        project: carbonet
      annotations:
        resonance.ai/image: ${IMAGE_NAME}
    spec:
      securityContext:
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
        runAsNonRoot: true
      terminationGracePeriodSeconds: 30
      containers:
        - name: carbonet-runtime
          image: ${IMAGE_NAME}
          imagePullPolicy: Never
          ports:
            - name: http
              containerPort: 8080
          envFrom:
            - configMapRef:
                name: carbonet-runtime-config
            - secretRef:
                name: carbonet-runtime-secret
          env:
            - name: PROJECT_ID
              value: ${PROJECT_ID}
            - name: JAVA_OPTS
              value: "-XX:+UseContainerSupport -XX:InitialRAMPercentage=30 -XX:MaxRAMPercentage=70 -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError -Dfile.encoding=UTF-8"
            - name: CARBONET_ECOINVENT_CLIENT_ID
              valueFrom:
                secretKeyRef:
                  name: carbonet-runtime-ecoinvent-secret
                  key: CARBONET_ECOINVENT_CLIENT_ID
            - name: CARBONET_ECOINVENT_CLIENT_SECRET
              valueFrom:
                secretKeyRef:
                  name: carbonet-runtime-ecoinvent-secret
                  key: CARBONET_ECOINVENT_CLIENT_SECRET
          volumeMounts:
            - name: runtime-manifest
              mountPath: /app/config/manifest.json
              subPath: manifest.json
              readOnly: true
            - name: react-app-overlay
              mountPath: /app/react-app-overlay
              readOnly: true
            - name: tmp
              mountPath: /tmp
          startupProbe:
            httpGet:
              path: /actuator/health/liveness
              port: http
            failureThreshold: 30
            periodSeconds: 5
            timeoutSeconds: 5
          readinessProbe:
            httpGet:
              path: /actuator/health/readiness
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /actuator/health/liveness
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          resources:
            requests:
              cpu: "500m"
              memory: "1Gi"
            limits:
              cpu: "4"
              memory: "4Gi"
      volumes:
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
---
apiVersion: v1
kind: Service
metadata:
  name: carbonet-runtime
  namespace: ${NAMESPACE}
  labels:
    app: carbonet-runtime
    framework: resonance
    project: carbonet
spec:
  selector:
    app: carbonet-runtime
  ports:
    - name: http
      port: 80
      targetPort: http
      nodePort: ${SERVICE_NODE_PORT}
  type: NodePort
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: carbonet-runtime-pdb
  namespace: ${NAMESPACE}
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: carbonet-runtime
YAML
  kubectl apply -f "$K8S_DIR/carbonet-runtime-kubeadm.yaml"
  kubectl -n "$NAMESPACE" rollout status deployment/carbonet-runtime --timeout="${ROLLOUT_TIMEOUT:-600s}"
}

verify_runtime() {
  log 'verify health and route'
  curl -fsS --max-time 15 "http://127.0.0.1:${SERVICE_NODE_PORT}/actuator/health" | tee "$RUN_DIR/carbonet-runtime-health.json"
  printf '\n'
  curl -sI --max-time 15 "http://127.0.0.1:${SERVICE_NODE_PORT}/" | sed -n '1,12p'
}

auto_git_sync() {
  if [[ "${RESONANCE_AUTO_GIT_COMMIT:-false}" != "true" ]]; then
    return 0
  fi
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 0
  fi
  mapfile -t changed < <(git status --short | awk '{print $2}' | grep -Ev '(^var/|/node_modules/|/target/|\.secret\.yaml$)' || true)
  if [[ "${#changed[@]}" -eq 0 ]]; then
    log 'git autosync: no safe changes to commit'
    return 0
  fi
  git add -- "${changed[@]}"
  if git diff --cached --quiet; then
    log 'git autosync: no staged changes'
    return 0
  fi
  git commit -m "chore: auto-recover Carbonet runtime $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [[ "${RESONANCE_AUTO_GIT_PUSH:-false}" == "true" ]]; then
    git push origin HEAD
  fi
}

apply_runtime_config
build_frontend
build_maven
build_image
apply_runtime_workload
verify_runtime
auto_git_sync
