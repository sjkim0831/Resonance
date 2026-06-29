#!/bin/bash
# v3 Ultra-Fast Selective Deployment Script (Optimized)
set -euo pipefail
export RESONANCE_SUDO_PASSWORD="${RESONANCE_SUDO_PASSWORD:-qwer1234}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${DEPLOYMENT:-carbonet-runtime}"

OVERLAY_HOST_PATH="$ROOT_DIR/projects/carbonet-frontend/src/main/resources/static/react-app"
FRONTEND_DIR="$ROOT_DIR/projects/carbonet-frontend/source"
MAVEN_DIR="$ROOT_DIR/apps/project-runtime"
RUNTIME_PATH="/opt/Resonance/data/carbonet-app/react-app"
RELEASE_DIR="$ROOT_DIR/var/releases/P003/image-context"
IMAGE_TAG="registry.local/carbonet-runtime:$(date +%Y.%m.%d-%H%M%S-v3)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_step() { echo ""; echo -e "${CYAN}==== $* ====${NC}"; }

START_TIME=$(date +%s)

check_jar_fresh() {
    local jar="$MAVEN_DIR/target/project-runtime.jar"
    local src_time latest_src
    if [ ! -f "$jar" ]; then return 1; fi
    src_time=$(stat -c %Y "$jar" 2>/dev/null || echo 0)
    # Check if any Java source is newer than JAR
    find "$ROOT_DIR/apps" "$ROOT_DIR/modules" -name "*.java" -type f 2>/dev/null | while read f; do
        if [ "$(stat -c %Y "$f" 2>/dev/null || echo 0)" -gt "$src_time" ]; then
            echo "old"; return 2
        fi
    done | grep -q "old" 2>/dev/null && return 1
    return 0
}

build_frontend() {
    local start=$(date +%s)
    log_step "Building Frontend"
    cd "$FRONTEND_DIR"
    if [ -d "node_modules" ]; then
        log "Incremental build (node_modules exists)"
    else
        log "Clean build (npm ci)"
        npm ci >/dev/null 2>&1
    fi
    npm run build 2>&1 | tail -5
    local elapsed=$(($(date +%s) - start))
    log_ok "Frontend built in ${elapsed}s"
}

sync_frontend() {
    local start=$(date +%s)
    log_step "Syncing Frontend"
    mkdir -p "$RUNTIME_PATH"
    if [ -d "$FRONTEND_DIR/dist" ]; then
        sudo rsync -av --delete "$FRONTEND_DIR/dist/" "$OVERLAY_HOST_PATH/" 2>&1 | tail -2
        sudo rsync -av --delete "$FRONTEND_DIR/dist/" "$RUNTIME_PATH/" 2>&1 | tail -2
    elif [ -d "$OVERLAY_HOST_PATH/assets" ]; then
        sudo rsync -av --delete "$OVERLAY_HOST_PATH/" "$RUNTIME_PATH/" 2>&1 | tail -2
    fi
    local elapsed=$(($(date +%s) - start))
    log_ok "Frontend synced in ${elapsed}s"
}

build_maven() {
    local start=$(date +%s)
    log_step "Building Maven"
    cd "$ROOT_DIR"
    MAVEN_OPTS="-Xmx4g" mvn -pl apps/project-runtime -am -Dmaven.test.skip=true -T 8 package -q 2>&1 | tail -5
    local elapsed=$(($(date +%s) - start))
    log_ok "Maven built in ${elapsed}s"
}

prepare_release() {
    mkdir -p "$RELEASE_DIR/lib"
    cp "$MAVEN_DIR/target/project-runtime.jar" "$RELEASE_DIR/" 2>/dev/null || true
}

build_docker_image() {
    local start=$(date +%s)
    log_step "Building Docker Image"

    export DOCKER_BUILDKIT=1
    cd "$RELEASE_DIR"

    if docker build \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --cache-from=registry.local/carbonet-runtime:base \
        -t "$IMAGE_TAG" \
        -f "$ROOT_DIR/ops/docker/Dockerfile.project-runtime" \
        . 2>&1 | tail -5; then
        log_ok "Docker image built"
    else
        log_warn "Docker build failed, using existing image"
        return 1
    fi

    local elapsed=$(($(date +%s) - start))
    log_ok "Docker image built in ${elapsed}s"
}

import_image() {
    local start=$(date +%s)
    log_step "Importing to containerd"

    local tmp_tar="/tmp/docker-v3-save-$$.tar"
    if docker save "$IMAGE_TAG" > "$tmp_tar" 2>/dev/null && \
       sudo ctr -n k8s.io images import "$tmp_tar" >/dev/null 2>&1; then
        sudo rm -f "$tmp_tar" 2>/dev/null || true
        log_ok "Image imported via tar"
    else
        sudo rm -f "$tmp_tar" 2>/dev/null || true
        log_warn "Trying pipe method..."
        if docker save "$IMAGE_TAG" | sudo ctr -n k8s.io images import - 2>&1 | tail -3; then
            log_ok "Image imported via pipe"
        else
            log_warn "Image import failed, trying pull..."
            sudo ctr images pull "$IMAGE_TAG" 2>&1 | tail -3
        fi
    fi

    local elapsed=$(($(date +%s) - start))
    log_ok "Image imported in ${elapsed}s"
}

rollout() {
    local start=$(date +%s)
    log_step "Rolling out"

    kubectl set image deployment/"$DEPLOYMENT" \
        carbonet-runtime="$IMAGE_TAG" \
        -n "$NAMESPACE" 2>&1 | tail -2

    kubectl rollout status deployment/"$DEPLOYMENT" -n "$NAMESPACE" --timeout=120s 2>&1 | tail -3

    local elapsed=$(($(date +%s) - start))
    log_ok "Rolled out in ${elapsed}s"
}

restart_pod() {
    local start=$(date +%s)
    kubectl rollout restart deployment/"$DEPLOYMENT" -n "$NAMESPACE" 2>&1 | tail -2
    kubectl rollout status deployment/"$DEPLOYMENT" -n "$NAMESPACE" --timeout=60s 2>&1 | tail -2
    local elapsed=$(($(date +%s) - start))
    log_ok "Pod restarted in ${elapsed}s"
}

deploy_frontend_only() {
    local start=$(date +%s)
    log_step "Frontend Only Deploy (~20-40 seconds)"

    build_frontend
    sync_frontend
    restart_pod

    local elapsed=$(($(date +%s) - start))
    log_ok "Frontend deploy completed in ${elapsed}s"
}

deploy_backend() {
    local start=$(date +%s)
    log_step "Backend Deploy (~2-3 minutes)"

    log "Running Maven + Docker prep in parallel..."
    build_maven &
    local maven_pid=$!

    prepare_release &
    local prep_pid=$!

    wait $maven_pid || true
    wait $prep_pid || true

    if build_docker_image; then
        import_image
    fi

    rollout

    local elapsed=$(($(date +%s) - start))
    log_ok "Backend deploy completed in ${elapsed}s"
}

deploy_config_only() {
    local start=$(date +%s)
    log_step "Config Only Deploy (~30 seconds)"
    restart_pod
    local elapsed=$(($(date +%s) - start))
    log_ok "Config deploy completed in ${elapsed}s"
}

# 1. Detect changes
log_step "Detecting Changes"
CHANGE_TYPE=$(bash "$ROOT_DIR/ops/scripts/resonance-detect-change.sh")

case "$CHANGE_TYPE" in
    NO_CHANGES)
        log "No changes detected. Nothing to deploy."
        exit 0
        ;;
    FRONTEND)
        log "Frontend changes detected"
        ;;
    BACKEND)
        log "Backend changes detected"
        ;;
    CONFIG)
        log "Config changes detected"
        ;;
    OTHER)
        log "Other changes detected, treating as backend"
        CHANGE_TYPE=BACKEND
        ;;
esac

# 2. Execute deployment based on change type
case "$CHANGE_TYPE" in
    FRONTEND)
        deploy_frontend_only
        ;;
    BACKEND)
        deploy_backend
        ;;
    CONFIG)
        deploy_config_only
        ;;
esac

ELAPSED=$(($(date +%s) - START_TIME))
echo ""
log_ok "=== v3 Deploy completed in ${ELAPSED} seconds ==="