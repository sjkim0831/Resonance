#!/bin/bash
#===============================================================
# CUBRID LIVE REPLICATION - Trigger 기반 실시간 복제
# 메인 DB (carbonet) → 백업 DB (carbonet_bak) 실시간 동기화
#===============================================================
set -u

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

POD="cubrid-carbonet-0"
NS="carbonet-prod"
MAIN_DB="carbonet"
BACKUP_DB="carbonet_bak"
BIN="/home/cubrid/CUBRID/bin"

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] OK${NC} $1"; }
err() { echo -e "${RED}[$(date +%H:%M:%S)] ERR${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] WARN${NC} $1"; }

run_main() { kubectl exec "$POD" -n "$NS" -- bash -c "$1" 2>/dev/null; }
run_bak() { kubectl exec "$POD" -n "$NS" -- bash -c "$1" 2>/dev/null; }

#---------------------------------------------------------------
# 1. 백업 DB에 스키마 복사 ( Structure만, 데이터 없이)
#---------------------------------------------------------------
copy_schema() {
    log "스키마 복사 중..."
    
    # 메인 DB의 테이블 목록 가져오기
    local tables=$(run_main "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"SELECT class_name FROM db_class WHERE class_name NOT LIKE 'db_%' AND class_name NOT LIKE 'cqt_%' ORDER BY class_name;\" 2>&1" | grep -v NOTIFICATION | grep -E "^\s+" | sed 's/^ *//')
    
    local count=0
    for tbl in $tables; do
        # 테이블 DDL 생성 (CUBRID는 직접 DDL 추출이 어려우므로 다른 방법 사용)
        # Foreign key, indexes 없이 structure만 복사
        
        # 백업 DB에 테이블 생성 (structure만)
        run_bak "$BIN/csql -u dba $BACKUP_DB --no-auto-commit -c \"
            CREATE TABLE $tbl AS SELECT * FROM $MAIN_DB.$tbl WHERE 1=0;
        \" 2>&1" | grep -v NOTIFICATION | head -1 || true
        
        count=$((count + 1))
    done
    
    ok "스키마 복사 완료: $count tables"
}

#---------------------------------------------------------------
# 2. 트리거 생성 (INSERT/UPDATE/DELETE용)
#---------------------------------------------------------------
create_triggers() {
    log "트리거 생성 중..."
    
    # 메인 DB의 테이블 목록
    local tables=$(run_main "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"SELECT class_name FROM db_class WHERE class_name NOT LIKE 'db_%' AND class_name NOT LIKE 'cqt_%' ORDER BY class_name;\" 2>&1" | grep -v NOTIFICATION | grep -E "^\s+" | sed 's/^ *//')
    
    local count=0
    for tbl in $tables; do
        # 기존 트리거 삭제 (있는 경우)
        run_main "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"DROP TRIGGER IF EXISTS repl_insert_$tbl;\" 2>&1" | grep -v NOTIFICATION || true
        run_main "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"DROP TRIGGER IF EXISTS repl_update_$tbl;\" 2>&1" | grep -v NOTIFICATION || true
        run_main "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"DROP TRIGGER IF EXISTS repl_delete_$tbl;\" 2>&1" | grep -v NOTIFICATION || true
        
        # INSERT 트리거 (백업 DB에 동일 INSERT)
        run_main "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"
            CREATE TRIGGER repl_insert_$tbl 
            BEFORE INSERT ON $tbl
            EXECUTE (
                INSERT INTO $BACKUP_DB.$tbl VALUES (NEW.*);
            );
        \" 2>&1" | grep -v NOTIFICATION || true
        
        # UPDATE 트리거
        run_main "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"
            CREATE TRIGGER repl_update_$tbl 
            BEFORE UPDATE ON $tbl
            EXECUTE (
                INSERT INTO $BACKUP_DB.$tbl VALUES (NEW.*);
            );
        \" 2>&1" | grep -v NOTIFICATION || true
        
        # DELETE 트리거
        run_main "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"
            CREATE TRIGGER repl_delete_$tbl 
            BEFORE DELETE ON $tbl
            EXECUTE (
                DELETE FROM $BACKUP_DB.$tbl WHERE CURRENT OF cursor;
            );
        \" 2>&1" | grep -v NOTIFICATION || true
        
        count=$((count + 1))
    done
    
    ok "트리거 생성 완료: $count tables"
}

#---------------------------------------------------------------
# 3. 초기 데이터 동기화 (현재 데이터 백업 DB에 복사)
#---------------------------------------------------------------
sync_initial_data() {
    log "초기 데이터 동기화 중..."
    
    # 메인 DB의 테이블 목록
    local tables=$(run_main "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"SELECT class_name FROM db_class WHERE class_name NOT LIKE 'db_%' AND class_name NOT LIKE 'cqt_%' ORDER BY class_name;\" 2>&1" | grep -v NOTIFICATION | grep -E "^\s+" | sed 's/^ *//')
    
    local total_rows=0
    for tbl in $tables; do
        # 데이터 복사
        local rows=$(run_main "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"
            INSERT INTO $BACKUP_DB.$tbl SELECT * FROM $MAIN_DB.$tbl;
            SELECT COUNT(*) FROM $tbl;
        \" 2>&1" | grep -E "^\s+[0-9]+" | tail -1 | awk '{print $1}' | tr -d ' ')
        
        total_rows=$((total_rows + rows))
    done
    
    ok "초기 동기화 완료: $total_rows rows"
}

#---------------------------------------------------------------
# 4. 복제 상태 확인
#---------------------------------------------------------------
check_status() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║            LIVE REPLICATION STATUS                        ║"
    echo "╠═══════════════════════════════════════════════════════════╣"
    
    # 메인 DB
    local main_rows=$(run_main "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+" | awk '{print $1}' | tr -d ' ')
    echo -e "║  Main DB:   $main_rows rows (carbonet)                    ║"
    
    # 백업 DB
    local bak_rows=$(run_bak "$BIN/csql -u dba $BACKUP_DB --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+" | awk '{print $1}' | tr -d ' ')
    echo -e "║  Backup DB: $bak_rows rows (carbonet_bak)                ║"
    
    # 트리거 확인
    local triggers=$(run_main "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c 'SHOW TRIGGERS;' 2>&1" | grep -c "REPL_" || echo 0)
    echo -e "║  Triggers:  $triggers active                              ║"
    
    echo "╚═══════════════════════════════════════════════════════════╝"
}

#---------------------------------------------------------------
# 5. 실시간 복제 테스트
#---------------------------------------------------------------
test_replication() {
    log "복제 테스트 중..."
    
    # 메인 DB에 테스트 레코드 삽입
    local test_id="TEST_$(date +%H%M%S)"
    
    run_main "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"
        INSERT INTO admin_emission_gwp_value (row_id, emission_type, gwp_co2, unit, year, facility_code) 
        VALUES ('$test_id', 'TEST', 999.99, 'ton', 2026, 'TEST01');
        SELECT '$test_id' as test_id;
    \" 2>&1" | grep -E "$test_id" | head -1
    
    sleep 2
    
    # 백업 DB에서 확인
    local bak_test=$(run_bak "$BIN/csql -u dba $BACKUP_DB --no-auto-commit -c \"SELECT row_id FROM admin_emission_gwp_value WHERE row_id='$test_id';\" 2>&1" | grep -E "^\s+$test_id" | wc -l)
    
    if [ "$bak_test" = "1" ]; then
        ok "복제 테스트 성공! ($test_id)"
        # 테스트 레코드 삭제
        run_main "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"DELETE FROM admin_emission_gwp_value WHERE row_id='$test_id';\" 2>&1" | grep -v NOTIFICATION || true
        return 0
    else
        err "복제 테스트 실패"
        return 1
    fi
}

#---------------------------------------------------------------
# 6. 복제 중지
#---------------------------------------------------------------
stop_replication() {
    log "트리거 삭제 중..."
    
    local tables=$(run_main "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"SELECT class_name FROM db_class WHERE class_name NOT LIKE 'db_%' AND class_name NOT LIKE 'cqt_%' ORDER BY class_name;\" 2>&1" | grep -v NOTIFICATION | grep -E "^\s+" | sed 's/^ *//')
    
    for tbl in $tables; do
        run_main "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"DROP TRIGGER IF EXISTS repl_insert_$tbl;\" 2>&1" | grep -v NOTIFICATION || true
        run_main "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"DROP TRIGGER IF EXISTS repl_update_$tbl;\" 2>&1" | grep -v NOTIFICATION || true
        run_main "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"DROP TRIGGER IF EXISTS repl_delete_$tbl;\" 2>&1" | grep -v NOTIFICATION || true
    done
    
    ok "복제 중지됨 (트리거 삭제 완료)"
}

case "${1:-status}" in
    setup|s) copy_schema; sync_initial_data; create_triggers ;;
    sync|si) sync_initial_data ;;
    triggers|t) create_triggers ;;
    test) test_replication ;;
    stop|x) stop_replication ;;
    status) check_status ;;
    *)
        echo "Usage: $0 {setup|triggers|test|stop|status}"
        ;;
esac
