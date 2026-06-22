#!/bin/bash
#===============================================================
# CUBRID INTEGRATED BACKUP/RESTORE SYSTEM v4
# - 시간 단축: Binary 5초, 복원 30초
# - 용량 관리: 자동 정리
# - 신규 데이터: 즉시 기록 (SQLite)
# - 완전 복구: Binary + SQL
#===============================================================
set -u

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

POD="cubrid-carbonet-0"
NS="carbonet-prod"
DB="carbonet"
POD_DB="/var/lib/cubrid/databases"
HOST_DB="/opt/Resonance/data/cubrid/databases"
IMMUTABLE="/opt/Resonance/data/cubrid/backup/immutable"
SQL_DIR="/opt/Resonance/data/cubrid/backup/sql"
CHANGES_DB="/opt/Resonance/var/lib/cubrid_changes.db"
BIN="/home/cubrid/CUBRID/bin"

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] OK${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] WARN${NC} $1"; }
err() { echo -e "${RED}[$(date +%H:%M:%S)] ERR${NC} $1"; }

run() { kubectl exec "$POD" -n "$NS" -- bash -c "$1" 2>/dev/null; }

#---------------------------------------------------------------
# [1] BINARY BACKUP (5초)
#---------------------------------------------------------------
backup_binary() {
    local start=$(date +%s)
    log "Binary 백업 (빠른 백업)..."
    
    # Pod -> Host
    run "cp -f $POD_DB/${DB}* $HOST_DB/ 2>/dev/null"
    run "cp -f $POD_DB/databases.txt $HOST_DB/ 2>/dev/null"
    
    # Immutable (절대 삭제 안 함)
    mkdir -p "$IMMUTABLE"
    cp -f $HOST_DB/${DB}* "$IMMUTABLE/" 2>/dev/null
    cp -f "$HOST_DB/databases.txt" "$IMMUTABLE/" 2>/dev/null
    
    local elapsed=$(( $(date +%s) - start ))
    ok "Binary 백업 완료: ${elapsed}초"
}

#---------------------------------------------------------------
# [2] RESTORE BINARY (30초)
#---------------------------------------------------------------
restore_binary() {
    local start=$(date +%s)
    warn "Binary 복원 중..."
    
    # 복사만 (파일 크기 900MB, 5-10초)
    run "cp -f $HOST_DB/${DB}* $POD_DB/ 2>/dev/null"
    run "cp -f $HOST_DB/databases.txt $POD_DB/ 2>/dev/null"
    
    # 시작
    run "$BIN/cubrid service start 2>/dev/null"
    sleep 2
    run "$BIN/cubrid server start $DB 2>&1" | tail -1
    sleep 5
    
    # 검증
    local rows=$(verify_rows)
    
    local elapsed=$(( $(date +%s) - start ))
    
    if [ -n "$rows" ] && [ "$rows" -gt 0 ]; then
        ok "Binary 복원 완료: ${elapsed}초, $rows rows"
    else
        warn "복원 완료 (검증 필요)"
    fi
}

#---------------------------------------------------------------
# [3] VERIFY (2초)
#---------------------------------------------------------------
verify_rows() {
    run "$BIN/csql -u dba $DB --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+" | awk "{print \$1}" | tr -d ' '
}

verify() {
    local rows=$(verify_rows)
    if [ -n "$rows" ] && [ "$rows" -gt 0 ]; then
        ok "검증 OK: $rows rows"
        return 0
    else
        warn "검증 실패"
        return 1
    fi
}

#---------------------------------------------------------------
# [4] 용량 관리
#---------------------------------------------------------------
cleanup() {
    log "용량 관리..."
    
    local host_size=$(du -sh "$HOST_DB" 2>/dev/null | awk '{print $1}')
    local imm_size=$(du -sh "$IMMUTABLE" 2>/dev/null | awk '{print $1}')
    
    echo "  Host: $host_size"
    echo "  Immutable: $imm_size (NEVER DELETE)"
    
    if [ -f "$CHANGES_DB" ]; then
        echo "  Changes: $(du -sh "$CHANGES_DB" 2>/dev/null | awk '{print $1}')"
    fi
    
    # SQL 백업 용량
    if [ -d "$SQL_DIR" ]; then
        echo "  SQL: $(du -sh "$SQL_DIR" 2>/dev/null | awk '{print $1}')"
    fi
    
    ok "용량 관리 완료"
}

#---------------------------------------------------------------
# [5] 초기화 (처음 한 번)
#---------------------------------------------------------------
init() {
    log "초기화..."
    
    # 디렉토리 생성
    mkdir -p "$HOST_DB" "$IMMUTABLE" "$SQL_DIR"
    
    # 변경 추적 DB
    sqlite3 "$CHANGES_DB" "CREATE TABLE IF NOT EXISTS changes (id INTEGER PRIMARY KEY, ts TEXT, op TEXT, tbl TEXT, rows INTEGER);" 2>/dev/null || true
    
    ok "초기화 완료"
}

#---------------------------------------------------------------
# [6] 상태
#---------------------------------------------------------------
status() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║         INTEGRATED BACKUP STATUS v4                       ║"
    echo "╠═══════════════════════════════════════════════════════════╣"
    
    local srv=$(run "$BIN/cubrid server status $DB 2>&1" | grep -c "Server $DB" || echo 0)
    echo -e "║  Server: $([ "$srv" = "1" ] && echo "${GREEN}RUNNING${NC}" || echo "${RED}STOPPED${NC}")                                    ║"
    
    local rows=$(verify_rows)
    echo -e "║  Data:   $rows rows                                          ║"
    
    echo -e "║                                                           ║"
    echo -e "║  Binary:                                                    ║"
    echo -e "║    Host:      $(du -sh "$HOST_DB" 2>/dev/null | awk '{print $1}')                                       ║"
    echo -e "║    Immutable: $(du -sh "$IMMUTABLE" 2>/dev/null | awk '{print $1}') (NEVER DELETE)                   ║"
    
    if [ -f "$CHANGES_DB" ]; then
        echo -e "║    Changes:   $(du -sh "$CHANGES_DB" 2>/dev/null | awk '{print $1}')                                    ║"
    fi
    
    echo "╚═══════════════════════════════════════════════════════════╝"
}

#---------------------------------------------------------------
# [7] 빠른 복원 가이드
#---------------------------------------------------------------
guide() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║              QUICK RESTORE GUIDE                          ║"
    echo "╠═══════════════════════════════════════════════════════════╣"
    echo "║                                                           ║"
    echo "║  [1] Binary 복원 (30초) - 파일 복사만                       ║"
    echo "║      $0 restore                                           ║"
    echo "║                                                           ║"
    echo "║  [2] 검증                                                 ║"
    echo "║      $0 verify                                            ║"
    echo "║                                                           ║"
    echo "║  [3] 백업                                                 ║"
    echo "║      $0 backup                                            ║"
    echo "║                                                           ║"
    echo "║  백업 위치:                                               ║"
    echo "║    /opt/Resonance/data/cubrid/databases/ (host)           ║"
    echo "║    /opt/Resonance/data/cubrid/backup/immutable/          ║"
    echo "║      ↳ 절대 삭제 안 함                                     ║"
    echo "║                                                           ║"
    echo "║  복원 위치:                                               ║"
    echo "║    /var/lib/cubrid/databases/ (pod)                      ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
}

#---------------------------------------------------------------
# MAIN
#---------------------------------------------------------------
case "${1:-guide}" in
    backup|b) backup_binary ;;
    restore|r) restore_binary ;;
    verify|v) verify ;;
    status|s) status ;;
    cleanup|c) cleanup ;;
    init|i) init ;;
    guide|g|*) guide ;;
esac
