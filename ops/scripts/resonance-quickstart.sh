#!/bin/bash
# resonance-quickstart.sh - Resonance 시스템 빠른 시작 스크립트
# 사용: sudo bash ops/scripts/resonance-quickstart.sh
#
# DEPRECATED: CUBRID 제거됨. 실제 DB는 PostgreSQL (postgres-haproxy:5432)입니다.
# 이 스크립트의 CUBRID 관련 단계는 더 이상 동작하지 않으며, 유지된目的是
# kubernetes / runtime startup 관련 로직만 동작합니다.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "[$(date '+%H:%M:%S')] ${*}${NC}"; }
log_step() { echo -e "\n${BLUE}=== ${*} ===${NC}"; }
log_ok() { echo -e "${GREEN}✓ ${*}${NC}"; }
log_warn() { echo -e "${YELLOW}⚠ ${*}${NC}"; }
log_err() { echo -e "${RED}✗ ${*}${NC}"; }

NAMESPACE="carbonet-prod"
POSTGRES_HOST="${POSTGRES_HOST:-postgres-haproxy.${NAMESPACE}.svc.cluster.local}"
DB_NAME="${DB_NAME:-carbonet}"

echo "=========================================="
echo "   Resonance 빠른 시작 스크립트"
echo "=========================================="

# 1단계: kubelet 재시작
log_step "1단계: kubelet 재시작"

if systemctl is-active --quiet kubelet; then
    log_ok "kubelet 이미 실행 중"
else
    log "kubelet 시작 중..."
    systemctl start kubelet
    sleep 5
    if systemctl is-active --quiet kubelet; then
        log_ok "kubelet 시작 완료"
    else
        log_err "kubelet 시작 실패"
        exit 1
    fi
fi

# Kubernetes 연결 확인
log "Kubernetes 연결 확인..."
if kubectl cluster-info &>/dev/null; then
    log_ok "Kubernetes 연결 정상"
else
    log_err "Kubernetes 연결 실패"
    exit 1
fi

# 2단계: PostgreSQL 연결 확인 (CUBRID 제거됨)
log_step "2단계: PostgreSQL 연결 확인 (CUBRID 제거됨)"

# postgres-haproxy Service를 통한 DB 연결 확인
log "PostgreSQL ($POSTGRES_HOST:5432) 연결 확인..."
if kubectl exec -n "$NAMESPACE" deploy/carbonet-runtime -- \
    sh -c "pg_isready -h '$POSTGRES_HOST' -p 5432 -U postgres" &>/dev/null; then
    log_ok "PostgreSQL 연결 정상"
else
    log_warn "PostgreSQL 연결 확인 실패 — Patroni 클러스터 상태를 확인하세요"
    log "  확인: kubectl -n $NAMESPACE exec postgres-patroni-0 -- patronictl list"
fi

# 3단계: carbonet-runtime 포드 재시작
log_step "3단계: carbonet-runtime 포드 재시작"

#旧的 포드 삭제
kubectl delete pod -n ${NAMESPACE} -l app=carbonet-runtime --grace-period=30 2>/dev/null || true
sleep 5

# 새 포드 대기
log "carbonet-runtime 포드 시작 대기..."
kubectl wait --for=condition=Ready pod -l app=carbonet-runtime -n ${NAMESPACE} --timeout=180s 2>/dev/null && log_ok "carbonet-runtime 시작 완료" || log_warn "carbonet-runtime 시작 대기 중..."

# 4단계: 최종 상태 확인
log_step "4단계: 최종 상태 확인"

echo ""
echo "=== carbonet-runtime 포드 ==="
kubectl get pods -n ${NAMESPACE} -l app=carbonet-runtime 2>/dev/null || echo "포드 확인 실패"

echo ""
echo "=== 웹 접속 테스트 ==="
sleep 10
if curl -s --connect-timeout=5 http://localhost/actuator/health 2>/dev/null | grep -q "UP"; then
    log_ok "웹 서비스 정상!"
else
    log_warn "웹 서비스 상태 확인 필요 (아직 시작 중일 수 있음)"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}   빠른 시작 완료!${NC}"
echo "=========================================="
echo ""
echo "접속 주소:"
echo "  - 웹: http://localhost (또는 http://100.125.44.95)"
echo "  - PostgreSQL: ${POSTGRES_HOST}:5432 (DB: ${DB_NAME})"
echo ""
echo "참고: CUBRID는 제거됨. 실제 DB 연결은 PostgreSQL을 사용합니다."
echo ""
echo "문제 발생 시 확인:"
echo "  kubectl -n carbonet-prod get pods"
echo "  kubectl -n carbonet-prod logs <pod-name>"
echo "  kubectl -n carbonet-prod exec postgres-patroni-0 -- patronictl list"
echo ""