#!/bin/bash
# resonance-quickstart.sh - Resonance 시스템 빠른 시작 스크립트
# 사용: sudo bash ops/scripts/resonance-quickstart.sh

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
CUBRID_POD="cubrid-carbonet-0"

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

# 2단계: CUBRID 컨테이너 확인 및 정리
log_step "2단계: CUBRID 상태 확인 및 정리"

# 실행 중인 CUBRID 프로세스 정리
log "호스트의 CUBRID 프로세스 정리..."
pkill -9 -f "cubrid" 2>/dev/null || true
pkill -9 -f "cub_broker" 2>/dev/null || true
pkill -9 -f "cub_server" 2>/dev/null || true
pkill -9 -f "cub_master" 2>/dev/null || true
fuser -k 33000/tcp 2>/dev/null || true
fuser -k 1523/tcp 2>/dev/null || true
sleep 2
log_ok "프로세스 정리 완료"

# CUBRID StatefulSet 재시작
log "CUBRID StatefulSet 재시작..."
kubectl delete pod ${CUBRID_POD} -n ${NAMESPACE} --grace-period=30 2>/dev/null || true
sleep 5

# CUBRID Pod가 Ready될 때까지 대기
log "CUBRID Pod 대기중..."
kubectl wait --for=condition=Ready pod/${CUBRID_POD} -n ${NAMESPACE} --timeout=120s
log_ok "CUBRID Pod 준비 완료"

# 3단계: CUBRID 브로커 설정 수정
log_step "3단계: CUBRID 브로커 설정 수정"

# 올바른 broker.conf 설정
BROKER_CONF='[broker]
MASTER_SHM_ID           =30001
ADMIN_LOG_FILE          =log/broker/cubrid_broker.log

[%query_editor]
SERVICE                 =ON
SSL                     =OFF
BROKER_PORT             =33000
MIN_NUM_APPL_SERVER     =4
MAX_NUM_APPL_SERVER     =10
APPL_SERVER_SHM_ID      =30000
LOG_DIR                 =log/broker/sql_log
ERROR_LOG_DIR           =log/broker/error_log
SQL_LOG                 =OFF
TIME_TO_KILL            =60
SESSION_TIMEOUT         =600
KEEP_CONNECTION         =ON
CCI_DEFAULT_AUTOCOMMIT  =ON
'

kubectl exec ${CUBRID_POD} -n ${NAMESPACE} -- sh -c "cat > /home/cubrid/CUBRID/conf/cubrid_broker.conf << 'EOFCONF'
${BROKER_CONF}
EOFCONF
chmod 644 /home/cubrid/CUBRID/conf/cubrid_broker.conf" 2>/dev/null

# databases.txt 수정
kubectl exec ${CUBRID_POD} -n ${NAMESPACE} -- sh -c "echo '/var/lib/cubrid/databases/carbonet carbonet' > /var/lib/cubrid/databases.txt && echo '/var/lib/cubrid/databases/carbonet carbonet' > /home/cubrid/CUBRID/databases/databases.txt && chmod 644 /home/cubrid/CUBRID/databases/databases.txt" 2>/dev/null

log_ok "브로커 설정 수정 완료"

# 4단계: CUBRID 서비스 시작
log_step "4단계: CUBRID 서비스 시작"

kubectl exec ${CUBRID_POD} -n ${NAMESPACE} -- sh -c "
    su - cubrid -c 'cubrid service stop' 2>/dev/null || true
    sleep 2
    su - cubrid -c 'cubrid master start'
    sleep 3
    su - cubrid -c 'cubrid server start carbonet'
    sleep 5
    su - cubrid -c 'cubrid broker start'
    sleep 5
    su - cubrid -c 'cubrid service status'
"

# 브로커 상태 확인
sleep 3
BROKER_STATUS=$(kubectl exec ${CUBRID_POD} -n ${NAMESPACE} -- sh -c "su - cubrid -c 'cubrid broker status'" 2>&1 || echo "FAILED")

if echo "$BROKER_STATUS" | grep -q "broker1"; then
    log_ok "CUBRID 브로커 실행 완료"
else
    log_warn "브로커 상태 확인 필요:"
    echo "$BROKER_STATUS"
fi

# 5단계: carbonet-runtime 설정 수정
log_step "5단계: carbonet-runtime 설정"

# CUBRID ConfigMap 수정 (원래 서비스 DNS로 복원)
kubectl patch configmap carbonet-runtime-config -n ${NAMESPACE} --type merge -p '{
  "data": {
    "CUBRID_HOST": "cubrid-carbonet",
    "SPRING_DATASOURCE_URL": "jdbc:cubrid:postgresql:5432:carbonet:::?charset=UTF-8&connectTimeout=5&queryTimeout=30"
  }
}' 2>/dev/null || log_warn "ConfigMap 패치 실패 (계속 진행)"

# 6단계: carbonet-runtime 포드 재시작
log_step "6단계: carbonet-runtime 포드 재시작"

#旧的 포드 삭제
kubectl delete pod -n ${NAMESPACE} -l app=carbonet-runtime --grace-period=30 2>/dev/null || true
sleep 5

# 새 포드 대기
log "carbonet-runtime 포드 시작 대기..."
kubectl wait --for=condition=Ready pod -l app=carbonet-runtime -n ${NAMESPACE} --timeout=180s 2>/dev/null && log_ok "carbonet-runtime 시작 완료" || log_warn "carbonet-runtime 시작 대기 중..."

# 7단계: 최종 상태 확인
log_step "7단계: 최종 상태 확인"

echo ""
echo "=== CUBRID 상태 ==="
kubectl exec ${CUBRID_POD} -n ${NAMESPACE} -- su - cubrid -c 'cubrid service status' 2>/dev/null || echo "CUBRID 상태 확인 실패"

echo ""
echo "=== 포트 상태 ==="
kubectl exec ${CUBRID_POD} -n ${NAMESPACE} -- ss -tlnp | grep -E '33000|1523' 2>/dev/null || echo "포트 확인 실패"

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
echo "  - CUBRID 브로커: localhost:33000"
echo ""
echo "문제 발생 시 확인:"
echo "  kubectl -n carbonet-prod get pods"
echo "  kubectl -n carbonet-prod logs <pod-name>"
echo "  kubectl -n carbonet-prod exec cubrid-carbonet-0 -- cubrid service status"
echo ""