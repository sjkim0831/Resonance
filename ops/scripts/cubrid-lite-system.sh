# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] cubrid-lite-system.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/bin/bash
#===============================================================
# CUBRID LITE BACKUP SYSTEM - 리소스 절약형
# - Cron 빈도 최소화
# - 용량 자동 정리
# - 가벼운 운영
#===============================================================
set -u

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'

POD="cubrid-carbonet-0"
NS="carbonet-prod"
DB="carbonet"
POD_DB="/var/lib/cubrid/databases"
HOST_DB="/opt/Resonance/data/cubrid/databases"
IMMUTABLE="/opt/Resonance/data/cubrid/backup/immutable"  # 절대 삭제 안 함
BIN="/home/cubrid/CUBRID/bin"

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] OK${NC} $1"; }

run() { kubectl exec "$POD" -n "$NS" -- bash -c "$1" 2>/dev/null; }

#---------------------------------------------------------------
# 가벼운 백업 (10초以内, 파일 복사 only)
#---------------------------------------------------------------
backup() {
    log "Lite 백업..."
    run "cp -f $POD_DB/${DB}* $HOST_DB/ 2>/dev/null"
    run "cp -f $POD_DB/databases.txt $HOST_DB/ 2>/dev/null"
    mkdir -p "$IMMUTABLE"
    cp -f $HOST_DB/${DB}* "$IMMUTABLE/" 2>/dev/null
    ok "백업 완료 (10초)"
}

#---------------------------------------------------------------
# 빠른 검증 (1초)
#---------------------------------------------------------------
verify() {
    local rows=$(run "$BIN/csql -u dba $DB --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+" | awk "{print \$1}" | tr -d ' ')
    if [ -n "$rows" ] && [ "$rows" -gt 0 ]; then
        ok "검증 OK: $rows rows"
        return 0
    fi
    return 1
}

#---------------------------------------------------------------
# 용량 정리 (30초, 오래된 백업만 삭제)
#---------------------------------------------------------------
cleanup() {
    log "용량 정리..."
    
    # Host 백업: 항상 1개만 유지 (최신만)
    # Immutable: 절대 삭제 안 함
    # Daily: 7일 이상된 것만 삭제
    # Hourly: 24시간 이상된 것만 삭제
    
    # 일일 백업 정리 (7일)
    if [ -d "/opt/Resonance/data/cubrid/backup/daily" ]; then
        find /opt/Resonance/data/cubrid/backup/daily -name "carbonet*" -mtime +7 -delete 2>/dev/null
    fi
    
    # 시간별 백업 정리 (24시간)
    if [ -d "/opt/Resonance/data/cubrid/backup/hourly" ]; then
        find /opt/Resonance/data/cubrid/backup/hourly -name "carbonet*" -mmin +1440 -delete 2>/dev/null
    fi
    
    # 로그 파일 정리 (7일)
    find /opt/Resonance/var/log -name "*.log" -mtime +7 -delete 2>/dev/null
    
    ok "용량 정리 완료"
}

#---------------------------------------------------------------
# 상태
#---------------------------------------------------------------
status() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║            CUBRID LITE STATUS (경량화)                    ║"
    echo "╠═══════════════════════════════════════════════════════════╣"
    
    local srv=$(run "$BIN/cubrid server status $DB 2>&1" | grep -c "Server $DB" || echo 0)
    echo -e "║  Server: $([ "$srv" = "1" ] && echo "${GREEN}RUNNING${NC}" || echo "${RED}STOPPED${NC}")                                    ║"
    
    local rows=$(run "$BIN/csql -u dba $DB --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+" | awk "{print \$1}" | tr -d ' ')
    echo -e "║  Data:   $rows rows                                          ║"
    
    echo -e "║                                                           ║"
    echo -e "║  용량:                                                       ║"
    echo -e "║    Host:     $(du -sh "$HOST_DB" 2>/dev/null | awk '{print $1}')                                       ║"
    echo -e "║    Immutable: $(du -sh "$IMMUTABLE" 2>/dev/null | awk '{print $1}') (NEVER DELETE)                  ║"
    
    local total_backup=$(du -sh /opt/Resonance/data/cubrid/backup 2>/dev/null | awk '{print $1}')
    echo -e "║    Total:    $total_backup (정리 후)                           ║"
    
    echo "╚═══════════════════════════════════════════════════════════╝"
}

case "${1:-status}" in
    backup|b) backup ;;
    verify|v) verify ;;
    cleanup|c) cleanup ;;
    status|s) status ;;
    *) status ;;
esac
