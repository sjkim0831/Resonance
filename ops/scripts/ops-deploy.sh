#!/bin/bash
#========================================
# Resonance Ops - 빌드/재배포 연동 스크립트
# K9s Web → Ops 스크립트 연동
#========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
NAMESPACE="carbonet-prod"
DEPLOYMENT="carbonet-runtime"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [OPS] $1"; }

# 헬스체크 대기
wait_for_healthy() {
    local max_wait=60
    local waited=0
    
    while [ $waited -lt $max_wait ]; do
        if curl -sf http://localhost/actuator/health > /dev/null 2>&1; then
            log "Health check OK"
            return 0
        fi
        sleep 2
        waited=$((waited + 2))
    done
    
    log "Health check timeout"
    return 1
}

# 빌드
build() {
    log "=== 빌드 시작 ==="
    
    cd "$PROJECT_ROOT/projects/carbonet-frontend/source"
    
    # 환경 변수 설정
    export RESONANCE_API_URL="${RESONANCE_API_URL:-http://localhost/api}"
    
    # npm 빌드
    if command -v npm &> /dev/null; then
        log "Running npm build..."
        npm run build 2>&1 | tail -20
    else
        log "npm not found, skipping build"
    fi
    
    log "=== 빌드 완료 ==="
}

# 무중단 배포 (Rolling Update)
deploy() {
    log "=== 배포 시작 ==="
    
    # 현재 상태 확인
    local current_replicas=$(kubectl -n $NAMESPACE get deployment $DEPLOYMENT -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
    log "Current replicas: $current_replicas"
    
    # Rolling UpdateStrategy 설정 확인
    kubectl -n $NAMESPACE get deployment $DEPLOYMENT -o yaml | grep -A5 "rollingUpdate" || true
    
    # 배포 실행 (무중단)
    kubectl -n $NAMESPACE rollout restart deployment/$DEPLOYMENT
    
    # 롤아웃 상태 모니터링
    kubectl -n $NAMESPACE rollout status deployment/$DEPLOYMENT --timeout=300s
    
    log "=== 배포 완료 ==="
}

# 헬스체크
health_check() {
    log "=== 헬스체크 ==="
    curl -sf http://localhost/actuator/health 2>&1 && echo " OK" || echo " FAIL"
}

# 상태 확인
status() {
    log "=== 현재 상태 ==="
    kubectl -n $NAMESPACE get pods -l app=carbonet-runtime -o wide 2>&1 | head -10
    echo ""
    kubectl -n $NAMESPACE get svc carbonet-runtime 2>&1 | head -5
}

# 전체 빌드+배포
full_deploy() {
    log "=== Full Deploy 시작 ==="
    
    # 1. 빌드 (선택사항 - 이미 빌드된 경우 생략 가능)
    if [ "$1" = "--with-build" ]; then
        build
    fi
    
    # 2. 무중단 배포
    deploy
    
    # 3. 헬스체크
    health_check
    
    log "=== Full Deploy 완료 ==="
}

# 메인
case "${1:-}" in
    build)
        build
        ;;
    deploy)
        deploy
        ;;
    status)
        status
        ;;
    health)
        health_check
        ;;
    full|full-deploy)
        full_deploy "${2:-}"
        ;;
    *)
        echo "Usage: $0 {build|deploy|status|health|full [--with-build]}"
        ;;
esac
