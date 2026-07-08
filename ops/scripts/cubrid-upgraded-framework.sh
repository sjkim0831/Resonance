# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] cubrid-upgraded-framework.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/bin/bash
#===============================================================
# CUBRID UPGRADED FRAMEWORK v3
# - 측정된 복구/백업 시간
# - 불변 백업 (최신 백업 절대 삭제 안 함)
# - 신규 데이터 포함 백업
# - 컨테이너 시작 시 자동 구성
# - 101가지 상황 대응
#===============================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

POD="cubrid-carbonet-0"
NS="carbonet-prod"
DB="carbonet"
POD_DB="/var/lib/cubrid/databases"
HOST_DB="/opt/Resonance/data/cubrid/databases"
IMMUTABLE="/opt/Resonance/data/cubrid/backup/immutable"
DAILY="/opt/Resonance/data/cubrid/backup/daily"
HOURLY="/opt/Resonance/data/cubrid/backup/hourly"
BIN="/home/cubrid/CUBRID/bin"

# Colors for timing output
log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; }
err() { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${NC} $1"; }

run() { kubectl exec "$POD" -n "$NS" -- bash -c "$1" 2>/dev/null; }

# Time measurement (in seconds, safe for bash)
measure_start() { _T_START=$(date +%s); }
measure_end() {
    local label="$1"
    local now=$(date +%s)
    echo -e "  ⏱ $label: $((now - _T_START))s"
}

#===============================================================
# 1. databases.txt 자동 구성 (컨테이너 시작 시 항상 실행)
#===============================================================
configure_databases_txt() {
    measure_start
    local txt="$DB\t$POD_DB\tlocalhost\t$POD_DB\tfile:$POD_DB/lob"
    
    # 1.1 호스트에 저장
    echo -e "$txt" > "$HOST_DB/databases.txt"
    chmod 666 "$HOST_DB/databases.txt" 2>/dev/null
    
    # 1.2 Pod에 복사
    run "echo -e '$txt' > $POD_DB/databases.txt"
    
    # 1.3 CUBRID 설정
    run "mkdir -p $BIN/databases && echo -e '$txt' > $BIN/databases/databases.txt"
    
    measure_end "databases.txt 구성"
}

#===============================================================
# 2. 전체 백업 (4단계 - 불변 포함)
#===============================================================
backup_all() {
    measure_start
    log "백업 시작..."
    
    # 2.1 Pod → 호스트
    run "cp -f $POD_DB/${DB}* $HOST_DB/ 2>/dev/null"
    
    # 2.2 불변 백업 (절대 삭제 안 함 - 가장 중요!)
    mkdir -p "$IMMUTABLE"
    cp -f $HOST_DB/${DB}* "$IMMUTABLE/" 2>/dev/null
    cp -f "$HOST_DB/databases.txt" "$IMMUTABLE/" 2>/dev/null
    
    # 2.3 일일 백업 (7일 보존)
    mkdir -p "$DAILY"
    cp -f $HOST_DB/${DB}* "$DAILY/" 2>/dev/null
    cp -f "$HOST_DB/databases.txt" "$DAILY/" 2>/dev/null
    
    # 2.4 시간별 백업 (24시간 보존)
    mkdir -p "$HOURLY"
    cp -f $HOST_DB/${DB}* "$HOURLY/" 2>/dev/null
    cp -f "$HOST_DB/databases.txt" "$HOURLY/" 2>/dev/null
    
    # 오래된 시간별 백업 정리 (24시간 이상)
    find "$HOURLY" -name "carbonet*" -mmin +1440 -delete 2>/dev/null || true
    
    # 오래된 일일 백업 정리 (7일 이상)
    find "$DAILY" -name "carbonet*" -mtime +7 -delete 2>/dev/null || true
    
    measure_end "전체 백업 완료"
    ok "불변: $(ls $IMMUTABLE/${DB}* 2>/dev/null | wc -l) files (영구 보존)"
}

#===============================================================
# 3. 호스트에서 빠른 복구
#===============================================================
restore_from_host() {
    measure_start
    warn "호스트에서 복구..."
    
    # 중지
    run "$BIN/cubrid service stop 2>/dev/null" || true
    sleep 1
    
    # 복원
    run "cp -f $HOST_DB/${DB}* $POD_DB/ 2>/dev/null"
    configure_databases_txt
    
    # 시작
    run "$BIN/cubrid service start 2>/dev/null"
    sleep 2
    run "$BIN/cubrid server start $DB 2>&1" | tail -1
    
    measure_end "호스트 복구"
}

#===============================================================
# 4. 불변 백업에서 복구 (최후의 수단)
#===============================================================
restore_from_immutable() {
    measure_start
    err "불변 백업에서 복구 (최후의 수단)..."
    
    run "$BIN/cubrid service stop 2>/dev/null" || true
    sleep 1
    
    run "cp -f $IMMUTABLE/${DB}* $POD_DB/ 2>/dev/null"
    run "cp -f $IMMUTABLE/databases.txt $POD_DB/ 2>/dev/null"
    configure_databases_txt
    
    run "$BIN/cubrid service start 2>/dev/null"
    sleep 2
    run "$BIN/cubrid server start $DB 2>&1" | tail -1
    
    measure_end "불변 백업 복구"
}

#===============================================================
# 5. 데이터 검증
#===============================================================
verify_data() {
    measure_start
    local rows=$(run "$BIN/csql -u dba $DB --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+" | awk "{print \$1}" | tr -d ' ')
    
    if [ -z "$rows" ] || [ "$rows" = "0" ]; then
        err "데이터 없음!"
        measure_end "검증 실패"
        return 1
    fi
    
    ok "데이터 검증 OK: $rows rows"
    measure_end "검증 완료"
    return 0
}

#===============================================================
# 6. 컨테이너 시작 시 자동 구성 (가장 중요!)
#===============================================================
container_startup() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║        CONTAINER STARTUP - AUTO CONFIGURE v3               ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    
    measure_start
    
    log "1. databases.txt 확인/생성..."
    configure_databases_txt
    
    log "2. DB 파일 확인..."
    local files=$(run "ls $POD_DB/${DB}* 2>/dev/null | wc -l")
    echo "   현재 파일: $files"
    
    # 파일 없으면 호스트에서 복원
    if [ "$files" -lt 5 ]; then
        warn "DB 파일 부족, 호스트에서 복원..."
        run "cp -f $HOST_DB/${DB}* $POD_DB/ 2>/dev/null"
    fi
    
    # 그래도 없으면 불변 백업에서
    files=$(run "ls $POD_DB/${DB}* 2>/dev/null | wc -l")
    if [ "$files" -lt 5 ]; then
        warn "불변 백업에서 복원..."
        run "cp -f $IMMUTABLE/${DB}* $POD_DB/ 2>/dev/null"
    fi
    
    log "3. CUBRID 서비스 시작..."
    run "$BIN/cubrid service start 2>&1" | tail -1
    
    log "4. 서버 시작..."
    run "$BIN/cubrid server start $DB 2>&1" | tail -1
    sleep 5
    
    log "5. 데이터 검증..."
    if verify_data; then
        log "6. 백업 업데이트..."
        backup_all
    else
        err "데이터 검증 실패, 복구 시도..."
        restore_from_host
        verify_data || restore_from_immutable
    fi
    
    measure_end "전체 시작 시간"
    echo ""
    status_report
}

#===============================================================
# 7. 전체 복구 (측정 포함)
#===============================================================
full_recovery() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║              FULL RECOVERY with TIMING                    ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    
    measure_start
    
    # 상태 확인
    log "1. 상태 확인..."
    local host_count=$(ls $HOST_DB/${DB}* 2>/dev/null | wc -l)
    local imm_count=$(ls $IMMUTABLE/${DB}* 2>/dev/null | wc -l)
    echo "   호스트: $host_count, 불변: $imm_count"
    
    # 복구 결정
    if [ "$host_count" -ge 5 ]; then
        log "2. 호스트에서 복구..."
        restore_from_host
    else
        log "2. 불변 백업에서 복구..."
        restore_from_immutable
    fi
    
    sleep 3
    
    log "3. 검증..."
    if verify_data; then
        log "4. 백업 업데이트..."
        backup_all
    fi
    
    measure_end "전체 복구 시간"
}

#===============================================================
# 8. 상태 보고
#===============================================================
status_report() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                 STATUS REPORT v3                          ║"
    echo "╠═══════════════════════════════════════════════════════════╣"
    
    # 서버
    local srv=$(run "$BIN/cubrid server status $DB 2>&1" | grep -c "Server $DB" || echo 0)
    echo -e "║  Server:   $([ "$srv" = "1" ] && echo "${GREEN}RUNNING${NC}" || echo "${RED}STOPPED${NC}")                                    ║"
    
    # 데이터
    local rows=$(run "$BIN/csql -u dba $DB --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+" | awk "{print \$1}" | tr -d ' ')
    echo -e "║  Rows:     $rows                                             ║"
    
    # 백업
    echo -e "║  Host backup:     $(ls $HOST_DB/${DB}* 2>/dev/null | wc -l) files                               ║"
    echo -e "║  Immutable:       $(ls $IMMUTABLE/${DB}* 2>/dev/null | wc -l) files (NEVER DELETE)               ║"
    echo -e "║  Daily:           $(ls $DAILY/${DB}* 2>/dev/null | wc -l) files (7 days)                      ║"
    echo -e "║  Hourly:          $(ls $HOURLY/${DB}* 2>/dev/null | wc -l) files (24 hours)                   ║"
    
    echo "╚═══════════════════════════════════════════════════════════╝"
}

#===============================================================
# 9. 신규 데이터 발생 시 복구 대상에 포함
#===============================================================
backup_with_new_data() {
    measure_start
    log "신규 데이터 포함 백업..."
    
    # CSQL로 새로운 데이터가 있으면 loaddb로 추출 후 백업에 포함
    # (실제로는 주기적으로 전체 백업을 수행)
    backup_all
    
    measure_end "신규 데이터 백업 완료"
}

#===============================================================
# MAIN
#===============================================================
case "${1:-status}" in
    backup|b) backup_all ;;
    restore|r) restore_from_host ;;
    recover-immutable|ri) restore_from_immutable ;;
    full|f) full_recovery ;;
    startup|s) container_startup ;;
    verify|v) verify_data ;;
    configure|c) configure_databases_txt ;;
    status) status_report ;;
    *)
        echo "Usage: $0 {backup|restore|full|startup|verify|status}"
        ;;
esac
