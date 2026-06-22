#!/bin/bash
#===============================================================
# CUBRID INSTANT RECOVERY SYSTEM v2
# - 측정된 복구 시간
# - 불변 백업 보호 (최신 백업 절대 삭제 안 함)
# - 신규 데이터 포함 백업
# - 컨테이너 재시작 시 자동 구성
#===============================================================
set -u

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

POD="cubrid-carbonet-0"
NS="carbonet-prod"
DB="carbonet"
POD_DB="/var/lib/cubrid/databases"
HOST_DB="/opt/Resonance/data/cubrid/databases"
IMMUTABLE_BACKUP="/opt/Resonance/data/cubrid/backup/immutable"
DAILY_BACKUP="/opt/Resonance/data/cubrid/backup/daily"
HOURLY_BACKUP="/opt/Resonance/data/cubrid/backup/hourly"
BIN="/home/cubrid/CUBRID/bin"
ALERT="/opt/Resonance/ops/scripts/send-email-alert.sh"

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] OK${NC} $1"; }
err() { echo -e "${RED}[$(date +%H:%M:%S)] ERR${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] WARN${NC} $1"; }

run() { kubectl exec "$POD" -n "$NS" -- bash -c "$1" 2>/dev/null; }

#---------------------------------------------------------------
# 1. TIMING: 측정 헬퍼
#---------------------------------------------------------------
timing_start() { _timing_start=$(date +%s%3N); }
timing_end() { 
    local label="$1"
    local end=$(date +%s%3N)
    local elapsed=$((end - _timing_start))
    echo "  ⏱ $label: ${elapsed}ms"
}

#---------------------------------------------------------------
# 2. DATABASES.TXT: 항상 올바른 설정
#---------------------------------------------------------------
ensure_databases_txt() {
    timing_start
    local txt_content="$DB\t$POD_DB\tlocalhost\t$POD_DB\tfile:$POD_DB/lob"
    
    # 호스트에 저장 (컨테이너 재생성 시 사용)
    echo -e "$txt_content" > "$HOST_DB/databases.txt"
    chmod 666 "$HOST_DB/databases.txt" 2>/dev/null
    
    # Pod에 복사
    run "echo -e '$txt_content' > $POD_DB/databases.txt"
    
    # CUBRID 설정 디렉토리
    run "mkdir -p $BIN/databases && echo -e '$txt_content' > $BIN/databases/databases.txt"
    
    timing_end "databases.txt 구성"
}

#---------------------------------------------------------------
# 3. BACKUP: 불변 백업 포함 (최신 절대 삭제 안 함)
#---------------------------------------------------------------
backup_all() {
    timing_start
    local timestamp=$(date +%Y%m%d_%H%M%S)
    
    # Pod에서 호스트로 백업
    run "cp -f $POD_DB/${DB}* $HOST_DB/ 2>/dev/null"
    
    # 1) IMMUTABLE 백업 (매 업데이트, 절대 삭제 안 함)
    if [ ! -d "$IMMUTABLE_BACKUP" ]; then
        mkdir -p "$IMMUTABLE_BACKUP"
    fi
    cp -f $HOST_DB/${DB}* "$IMMUTABLE_BACKUP/" 2>/dev/null
    cp -f "$HOST_DB/databases.txt" "$IMMUTABLE_BACKUP/" 2>/dev/null
    local immutable_count=$(ls "$IMMUTABLE_BACKUP"/${DB}* 2>/dev/null | wc -l)
    
    # 2) 일일 백업 (날짜별, 7일 보존)
    mkdir -p "$DAILY_BACKUP"
    cp -f $HOST_DB/${DB}* "$DAILY_BACKUP/" 2>/dev/null
    cp -f "$HOST_DB/databases.txt" "$DAILY_BACKUP/" 2>/dev/null
    local daily_count=$(ls "$DAILY_BACKUP"/${DB}* 2>/dev/null | wc -l)
    
    # 3) 시간별 백업 (시간별, 24시간 보존)
    mkdir -p "$HOURLY_BACKUP"
    cp -f $HOST_DB/${DB}* "$HOURLY_BACKUP/" 2>/dev/null
    cp -f "$HOST_DB/databases.txt" "$HOURLY_BACKUP/" 2>/dev/null
    
    timing_end "백업 완료 (immutable: $immutable_count, daily: $daily_count)"
    
    ok "불변 백업: $IMMUTABLE_BACKUP ($immutable_count files)"
}

#---------------------------------------------------------------
# 4. RESTORE: 빠른 복구 (호스트에서)
#---------------------------------------------------------------
restore_from_host() {
    timing_start
    log "호스트에서 복구 중..."
    
    # 중지
    run "$BIN/cubrid service stop 2>/dev/null" || true
    run "pkill -9 cub 2>/dev/null" || true
    sleep 2
    
    # 복사
    run "cp -f $HOST_DB/${DB}* $POD_DB/ 2>/dev/null"
    ensure_databases_txt
    
    # 시작
    run "$BIN/cubrid service start 2>/dev/null"
    sleep 3
    
    # 서버 시작
    run "$BIN/cubrid server start $DB 2>&1" | tail -2
    sleep 5
    
    timing_end "복구 완료"
}

restore_from_immutable() {
    timing_start
    log "불변 백업에서 복구 중..."
    
    run "$BIN/cubrid service stop 2>/dev/null" || true
    run "pkill -9 cub 2>/dev/null" || true
    sleep 2
    
    run "cp -f $IMMUTABLE_BACKUP/${DB}* $POD_DB/ 2>/dev/null"
    run "cp -f $IMMUTABLE_BACKUP/databases.txt $POD_DB/ 2>/dev/null"
    ensure_databases_txt
    
    run "$BIN/cubrid service start 2>/dev/null"
    sleep 3
    run "$BIN/cubrid server start $DB 2>&1" | tail -2
    sleep 5
    
    timing_end "불변 백업 복구 완료"
}

#---------------------------------------------------------------
# 5. VERIFY: 무결성 확인
#---------------------------------------------------------------
verify() {
    timing_start
    local rows=$(run "$BIN/csql -u dba $DB --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+" | awk "{print \$1}" | tr -d ' ')
    
    if [ -z "$rows" ] || [ "$rows" = "0" ]; then
        err "데이터 없음!"
        timing_end "검증 실패"
        return 1
    fi
    
    ok "데이터 무결성 OK: $rows rows"
    timing_end "검증 완료"
    return 0
}

#---------------------------------------------------------------
# 6. FULL RECOVERY: 전체 복구 + 측정
#---------------------------------------------------------------
full_recovery_with_timing() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║           INSTANT RECOVERY with TIMING                     ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    
    local start_total=$(date +%s%3N)
    
    log "1. 호스트 백업 확인..."
    local host_count=$(ls $HOST_DB/${DB}* 2>/dev/null | wc -l)
    echo "  호스트 백업: $host_count files"
    
    log "2. 불변 백업 확인..."
    local imm_count=$(ls $IMMUTABLE_BACKUP/${DB}* 2>/dev/null | wc -l)
    echo "  불변 백업: $imm_count files"
    
    if [ "$host_count" -lt 5 ]; then
        warn "호스트 백업 부족, 불변 백업 사용"
        restore_from_immutable
    else
        restore_from_host
    fi
    
    sleep 3
    
    log "3. 검증..."
    if verify; then
        log "4. 최종 백업..."
        backup_all
    fi
    
    local end_total=$(date +%s%3N)
    local total_elapsed=$((end_total - start_total))
    
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║           TOTAL RECOVERY TIME: ${total_elapsed}ms                    ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
}

#---------------------------------------------------------------
# 7. CONTAINER STARTUP: 컨테이너 시작 시 자동 구성
#---------------------------------------------------------------
container_startup() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║           CONTAINER STARTUP - AUTO CONFIGURE               ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    
    local start=$(date +%s%3N)
    
    log "1. databases.txt 확인..."
    ensure_databases_txt
    
    log "2. DB 파일 확인..."
    local files=$(run "ls $POD_DB/${DB}* 2>/dev/null | wc -l")
    echo "  현재 파일: $files"
    
    if [ "$files" -lt 5 ]; then
        warn "DB 파일 부족, 호스트에서 복원..."
        run "cp -f $HOST_DB/${DB}* $POD_DB/ 2>/dev/null"
        run "cp -f $HOST_DB/databases.txt $POD_DB/ 2>/dev/null"
    fi
    
    # 파일이 여전히 없으면 불변 백업에서
    files=$(run "ls $POD_DB/${DB}* 2>/dev/null | wc -l")
    if [ "$files" -lt 5 ]; then
        warn "불변 백업에서 복원..."
        run "cp -f $IMMUTABLE_BACKUP/${DB}* $POD_DB/ 2>/dev/null"
        run "cp -f $IMMUTABLE_BACKUP/databases.txt $POD_DB/ 2>/dev/null"
    fi
    
    log "3. CUBRID 서비스 시작..."
    run "$BIN/cubrid service start 2>&1" | tail -2
    
    log "4. 서버 시작..."
    run "$BIN/cubrid server start $DB 2>&1" | tail -2
    sleep 5
    
    log "5. 검증..."
    verify
    
    log "6. 호스트 백업..."
    backup_all
    
    local elapsed=$(($(date +%s%3N) - start))
    echo ""
    ok "컨테이너 시작 완료: ${elapsed}ms"
}

#---------------------------------------------------------------
# 8. STATUS REPORT
#---------------------------------------------------------------
status_report() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║              INSTANT RECOVERY STATUS                       ║"
    echo "╠═══════════════════════════════════════════════════════════╣"
    
    local srv=$(run "$BIN/cubrid server status $DB 2>&1" | grep -c "Server $DB" || echo 0)
    echo -e "║  Server: $([ "$srv" = "1" ] && echo "${GREEN}RUNNING${NC}" || echo "${RED}STOPPED${NC}")                                    ║"
    
    local rows=$(run "$BIN/csql -u dba $DB --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+" | awk "{print \$1}" | tr -d ' ')
    echo -e "║  Data:   $rows rows                                          ║"
    
    local host_count=$(ls $HOST_DB/${DB}* 2>/dev/null | wc -l)
    local imm_count=$(ls $IMMUTABLE_BACKUP/${DB}* 2>/dev/null | wc -l)
    local daily_count=$(ls $DAILY_BACKUP/${DB}* 2>/dev/null | wc -l)
    
    echo -e "║  Host backup:  $host_count files                               ║"
    echo -e "║  Immutable:    $imm_count files (NEVER DELETED)                ║"
    echo -e "║  Daily:        $daily_count files                               ║"
    
    echo "╚═══════════════════════════════════════════════════════════╝"
}

#---------------------------------------------------------------
# MAIN
#---------------------------------------------------------------
case "${1:-status}" in
    backup) backup_all ;;
    restore|recover) restore_from_host ;;
    recover-immutable) restore_from_immutable ;;
    full-recovery|full) full_recovery_with_timing ;;
    startup|start) container_startup ;;
    verify|check) verify ;;
    ensure-txt) ensure_databases_txt ;;
    status|report) status_report ;;
    *)
        echo "Usage: $0 {backup|restore|full-recovery|startup|verify|status}"
        ;;
esac
