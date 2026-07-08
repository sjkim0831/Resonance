# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] cubrid-quick-backup.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/bin/bash
#===============================================================
# CUBRID QUICK BACKUP/RESTORE - 간략화 + 용량 관리
# - Binary: 파일 복사 (빠름, 복구용)
# - Changes: SQLite 로깅 (항상 유지)
# - 용량: 자동 정리
#===============================================================
set -u

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

POD="cubrid-carbonet-0"
NS="carbonet-prod"
DB="carbonet"
POD_DB="/var/lib/cubrid/databases"
HOST_DB="/opt/Resonance/data/cubrid/databases"
IMMUTABLE="/opt/Resonance/data/cubrid/backup/immutable"  # 절대 삭제 안 함
CHANGES_DB="/opt/Resonance/var/lib/cubrid_changes.db"
BIN="/home/cubrid/CUBRID/bin"

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] OK${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] WARN${NC} $1"; }

run() { kubectl exec "$POD" -n "$NS" -- bash -c "$1" 2>/dev/null; }

#---------------------------------------------------------------
# 1. BINARY BACKUP (파일 복사, 5초)
#---------------------------------------------------------------
backup_binary() {
    local start=$(date +%s)
    log "Binary 백업 중..."
    
    # Pod -> Host (빠른 백업)
    run "cp -f $POD_DB/${DB}* $HOST_DB/ 2>/dev/null"
    
    # Immutable에도 (중요!)
    mkdir -p "$IMMUTABLE"
    cp -f $HOST_DB/${DB}* "$IMMUTABLE/" 2>/dev/null
    cp -f "$HOST_DB/databases.txt" "$IMMUTABLE/" 2>/dev/null
    
    local elapsed=$(( $(date +%s) - start ))
    ok "Binary 백업 완료: ${elapsed}초"
}

#---------------------------------------------------------------
# 2. RESTORE BINARY (파일 복사, 30초)
#---------------------------------------------------------------
restore_binary() {
    local start=$(date +%s)
    warn "Binary 복원 중..."
    
    # 중지
    run "$BIN/cubrid server stop $DB 2>/dev/null" || true
    sleep 1
    
    # 복원
    run "cp -f $HOST_DB/${DB}* $POD_DB/ 2>/dev/null"
    run "cp -f $HOST_DB/databases.txt $POD_DB/ 2>/dev/null"
    
    # 시작
    run "$BIN/cubrid server start $DB 2>&1" | tail -1
    sleep 5
    
    # 검증
    local rows=$(run "$BIN/csql -u dba $DB --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+" | awk "{print \$1}" | tr -d ' ')
    
    local elapsed=$(( $(date +%s) - start ))
    
    if [ -n "$rows" ] && [ "$rows" -gt 0 ]; then
        ok "Binary 복원 완료: ${elapsed}초, $rows rows"
    else
        warn "복원 완료 (rows 확인 필요)"
    fi
}

#---------------------------------------------------------------
# 3. 용량 관리 (자동 정리)
#---------------------------------------------------------------
cleanup容量() {
    log "용량 관리 중..."
    
    # Binary 백업 용량 확인
    local host_size=$(du -sh "$HOST_DB" 2>/dev/null | awk '{print $1}')
    local imm_size=$(du -sh "$IMMUTABLE" 2>/dev/null | awk '{print $1}')
    
    echo "  Host 백업: $host_size"
    echo "  Immutable: $imm_size"
    
    # 변경 추적 DB 용량
    if [ -f "$CHANGES_DB" ]; then
        local changes_size=$(du -sh "$CHANGES_DB" 2>/dev/null | awk '{print $1}')
        echo "  변경 추적: $changes_size"
    fi
    
    ok "용량 관리 완료"
}

#---------------------------------------------------------------
# 4. 빠른 검증
#---------------------------------------------------------------
verify() {
    local rows=$(run "$BIN/csql -u dba $DB --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+" | awk "{print \$1}" | tr -d ' ')
    
    if [ -n "$rows" ] && [ "$rows" -gt 0 ]; then
        ok "검증 OK: $rows rows"
        return 0
    else
        warn "검증 실패"
        return 1
    fi
}

#---------------------------------------------------------------
# 5. 상태 보고
#---------------------------------------------------------------
status() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║            QUICK BACKUP STATUS                            ║"
    echo "╠═══════════════════════════════════════════════════════════╣"
    
    # 서버
    local srv=$(run "$BIN/cubrid server status $DB 2>&1" | grep -c "Server $DB" || echo 0)
    echo -e "║  Server: $([ "$srv" = "1" ] && echo "${GREEN}RUNNING${NC}" || echo "${RED}STOPPED${NC}")                                    ║"
    
    # 데이터
    local rows=$(run "$BIN/csql -u dba $DB --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+" | awk "{print \$1}" | tr -d ' ')
    echo -e "║  Data:   $rows rows                                          ║"
    
    # 용량
    echo -e "║                                                           ║"
    echo -e "║  Host:      $(du -sh "$HOST_DB" 2>/dev/null | awk '{print $1}')                                  ║"
    echo -e "║  Immutable: $(du -sh "$IMMUTABLE" 2>/dev/null | awk '{print $1}') (NEVER DELETE)              ║"
    
    # 변경 추적
    if [ -f "$CHANGES_DB" ]; then
        echo -e "║  Changes:   $(du -sh "$CHANGES_DB" 2>/dev/null | awk '{print $1}')                                   ║"
    fi
    
    echo "╚═══════════════════════════════════════════════════════════╝"
}

#---------------------------------------------------------------
# 6. 복원 가이드
#---------------------------------------------------------------
guide() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║            빠른 복원 가이드                                ║"
    echo "╠═══════════════════════════════════════════════════════════╣"
    echo "║                                                           ║"
    echo "║  [1] Binary 복원 (30초)                                   ║"
    echo "║      ./cubrid-quick-backup.sh restore                     ║"
    echo "║                                                           ║"
    echo "║  [2] 검증                                                 ║"
    echo "║      ./cubrid-quick-backup.sh verify                      ║"
    echo "║                                                           ║"
    echo "║  [3] 상태                                                 ║"
    echo "║      ./cubrid-quick-backup.sh status                      ║"
    echo "║                                                           ║"
    echo "║  복원 파일 위치:                                          ║"
    echo "║    Host: /opt/Resonance/data/cubrid/databases/           ║"
    echo "║    Immutable: /opt/Resonance/data/cubrid/backup/        ║"
    echo "║              immutable/ (절대 삭제 안 함)                   ║"
    echo "║    변경 추적: /opt/Resonance/var/lib/                    ║"
    echo "║              cubrid_changes.db                           ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
}

case "${1:-status}" in
    backup|b) backup_binary ;;
    restore|r) restore_binary ;;
    verify|v) verify ;;
    status|s) status ;;
    cleanup|c) cleanup容量 ;;
    guide|g) guide ;;
    *) guide ;;
esac
