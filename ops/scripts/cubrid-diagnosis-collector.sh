#!/usr/bin/env bash
# cubrid-diagnosis-collector.sh - CUBRID 진단 로그 수집기
# Usage: kubectl exec cubrid-carbonet-0 -- /scripts/cubrid-diagnosis-collector.sh
set -o pipefail

LOG_DIR="/var/lib/cubrid/logs/diagnosis"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
LOG_FILE="${LOG_DIR}/diagnosis_${TIMESTAMP}.log"

# 색상 정의
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
log_section() { echo -e "\n${BLUE}=== $* ===${NC}"; }
log_ok() { echo -e "${GREEN}✓ $*${NC}"; }
log_warn() { echo -e "${YELLOW}⚠ $*${NC}"; }
log_err() { echo -e "${RED}✗ $*${NC}"; }

# 진단 로그 시작
log_section "CUBRID 진단 로그 수집 시작" | tee -a "${LOG_FILE}"
log "호스트: $(hostname)"
log "타임스탬프: ${TIMESTAMP}"

mkdir -p "${LOG_DIR}"

# 환경변수 수집
log_section "환경변수" | tee -a "${LOG_FILE}"
env | grep -E "^CUBRID|^DB" | tee -a "${LOG_FILE}" || true

# 디렉토리 구조
log_section "디렉토리 구조" | tee -a "${LOG_FILE}"
log "=== /var/lib/cubrid ===" | tee -a "${LOG_FILE}"
ls -laR /var/lib/cubrid 2>&1 | tee -a "${LOG_FILE}" || true

log "=== /home/cubrid/CUBRID ===" | tee -a "${LOG_FILE}"
ls -laR /home/cubrid/CUBRID 2>&1 | head -100 | tee -a "${LOG_FILE}" || true

# databases.txt 검증
log_section "databases.txt 검증" | tee -a "${LOG_FILE}"
for txt in /var/lib/cubrid/databases.txt /home/cubrid/CUBRID/databases/databases.txt; do
  if [[ -f "$txt" ]]; then
    log "파일: $txt" | tee -a "${LOG_FILE}"
    cat "$txt" | tee -a "${LOG_FILE}"
    DB_PATH=$(head -1 "$txt" 2>/dev/null | awk '{print $1}')
    if [[ -n "$DB_PATH" ]]; then
      log "데이터베이스 경로: $DB_PATH" | tee -a "${LOG_FILE}"
      if [[ -d "$DB_PATH" ]]; then
        log_ok "디렉토리 존재: $DB_PATH" | tee -a "${LOG_FILE}"
        ls -la "$DB_PATH" | tee -a "${LOG_FILE}"
      elif [[ -f "$DB_PATH" ]]; then
        log_err "⚠ 경로가 파일입니다!: $DB_PATH" | tee -a "${LOG_FILE}"
      else
        log_err "⚠ 디렉토리가 존재하지 않음: $DB_PATH" | tee -a "${LOG_FILE}"
      fi
    fi
  else
    log_warn "파일 없음: $txt" | tee -a "${LOG_FILE}"
  fi
done

# CUBRID 프로세스 상태
log_section "CUBRID 프로세스 상태" | tee -a "${LOG_FILE}"
ps aux | grep -E "cubrid|cub_server|cub_broker|cub_master" | grep -v grep | tee -a "${LOG_FILE}" || true

# 포트 상태
log_section "포트 상태" | tee -a "${LOG_FILE}"
ss -tlnp 2>/dev/null | grep -E "33000|1523" | tee -a "${LOG_FILE}" || true
netstat -tlnp 2>/dev/null | grep -E "33000|1523" | tee -a "${LOG_FILE}" || true

# CUBRID 서비스 상태
log_section "CUBRID 서비스 상태" | tee -a "${LOG_FILE}"
cubrid service status 2>&1 | tee -a "${LOG_FILE}" || true

# CUBRID 마스터 상태
log_section "CUBRID 마스터 로그" | tee -a "${LOG_FILE}"
cat /home/cubrid/CUBRID/log/*master* 2>&1 | tail -50 | tee -a "${LOG_FILE}" || true
cat /var/lib/cubrid/log/*master* 2>&1 | tail -50 | tee -a "${LOG_FILE}" || true

# 브로커 에러 로그
log_section "브로커 에러 로그" | tee -a "${LOG_FILE}"
cat /home/cubrid/CUBRID/log/broker/error_log/* 2>&1 | tail -100 | tee -a "${LOG_FILE}" || true
cat /var/lib/cubrid/log/broker/error_log/* 2>&1 | tail -100 | tee -a "${LOG_FILE}" || true

# 서버 에러 로그
log_section "서버 에러 로그" | tee -a "${LOG_FILE}"
cat /home/cubrid/CUBRID/log/server/* 2>&1 | tail -100 | tee -a "${LOG_FILE}" || true
cat /var/lib/cubrid/log/server/* 2>&1 | tail -100 | tee -a "${LOG_FILE}" || true

# 디스크 공간
log_section "디스크 공간" | tee -a "${LOG_FILE}"
df -h | tee -a "${LOG_FILE}"
du -sh /var/lib/cubrid 2>&1 | tee -a "${LOG_FILE}"
du -sh /home/cubrid/CUBRID 2>&1 | tee -a "${LOG_FILE}"

# 권한 확인
log_section "파일 권한" | tee -a "${LOG_FILE}"
ls -la /var/lib/cubrid/databases/ 2>&1 | tee -a "${LOG_FILE}"
stat /var/lib/cubrid/databases/carbonet 2>&1 | tee -a "${LOG_FILE}" || true

# 시크릿/컨피그맵 확인
log_section "Kubernetes 시크릿/컨피그맵" | tee -a "${LOG_FILE}"
echo "=== 환경변수 ===" | tee -a "${LOG_FILE}"
env | grep -E "CUBRID|DB_|PASS" | tee -a "${LOG_FILE}" || echo "민감정보 숨김처리됨" | tee -a "${LOG_FILE}"

# 최종 결과
log_section "진단 완료" | tee -a "${LOG_FILE}"
log "로그 파일: ${LOG_FILE}"
log "로그 목록:" | tee -a "${LOG_FILE}"
ls -la "${LOG_DIR}" | tee -a "${LOG_FILE}"

echo ""
log_ok "진단 로그 수집 완료: ${LOG_FILE}"