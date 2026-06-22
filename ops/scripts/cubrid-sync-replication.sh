#!/bin/bash
#===============================================================
# CUBRID LIVE SYNC REPLICATION
# - 1분마다 메인 DB → 백업 DB 동기화
# - 변경 추적 테이블 사용
# - 실용적인 Near Real-time 복제
#===============================================================
set -u

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

POD="cubrid-carbonet-0"
NS="carbonet-prod"
MAIN_DB="carbonet"
BACKUP_DB="carbonet_bak"
BIN="/home/cubrid/CUBRID/bin"
SYNC_LOG="/opt/Resonance/var/log/sync-replication.log"

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] OK${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] WARN${NC} $1"; }

run() { kubectl exec "$POD" -n "$NS" -- bash -c "$1" 2>/dev/null; }

#---------------------------------------------------------------
# 1. 변경 추적 테이블 생성 (메인 DB에)
#---------------------------------------------------------------
create_change_table() {
    log "변경 추적 테이블 생성..."
    
    run "$BIN/csql -u dba $MAIN_DB --no-auto-commit << 'EOSQL'
CREATE TABLE IF NOT EXISTS _sync_change_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(256) NOT NULL,
    operation VARCHAR(10) NOT NULL,
    row_key VARCHAR(512),
    synced BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sync_unsynced ON _sync_change_log(synced, created_at);
EOSQL
" 2>&1 | grep -v NOTIFICATION | tail -2
    
    ok "변경 추적 테이블 생성 완료"
}

#---------------------------------------------------------------
# 2. 모든 테이블에 트리거 생성 (변경 추적용)
#---------------------------------------------------------------
create_triggers() {
    log "변경 추적 트리거 생성..."
    
    local tables=$(run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"SELECT class_name FROM db_class WHERE class_name NOT LIKE 'db_%' AND class_name NOT LIKE 'cqt_%' AND class_name NOT LIKE '_sync%' ORDER BY class_name;\" 2>&1" | grep -v NOTIFICATION | grep -E "^\s+" | sed 's/^ *//')
    
    local count=0
    for tbl in $tables; do
        # 기존 트리거 삭제
        run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"DROP TRIGGER IF EXISTS sync_i_$tbl;\" 2>/dev/null || true
        run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"DROP TRIGGER IF EXISTS sync_u_$tbl;\" 2>/dev/null || true
        run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"DROP TRIGGER IF EXISTS sync_d_$tbl;\" 2>/dev/null || true
        
        # PRIMARY KEY 컬럼명 가져오기 (row_key용)
        local pk_col=$(run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"SHOW INDEX IN $tbl WHERE KEY_NAME = 'pk' OR KEY_NAME LIKE '%pky%' OR KEY_NAME = 'PRIMARY' LIMIT 1;\" 2>&1" | grep -v NOTIFICATION | awk '{print $5}' | head -1)
        
        if [ -z "$pk_col" ]; then
            pk_col="row_id"
        fi
        
        # INSERT 트리거
        run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"
            CREATE TRIGGER sync_i_$tbl 
            AFTER INSERT ON $tbl
            EXECUTE (
                INSERT INTO _sync_change_log (table_name, operation, row_key)
                VALUES ('$tbl', 'INSERT', NEW.$pk_col);
            );
        \" 2>/dev/null || true
        
        # UPDATE 트리거
        run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"
            CREATE TRIGGER sync_u_$tbl 
            AFTER UPDATE ON $tbl
            EXECUTE (
                INSERT INTO _sync_change_log (table_name, operation, row_key)
                VALUES ('$tbl', 'UPDATE', NEW.$pk_col);
            );
        \" 2>/dev/null || true
        
        # DELETE 트리거
        run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"
            CREATE TRIGGER sync_d_$tbl 
            AFTER DELETE ON $tbl
            EXECUTE (
                INSERT INTO _sync_change_log (table_name, operation, row_key)
                VALUES ('$tbl', 'DELETE', OLD.$pk_col);
            );
        \" 2>/dev/null || true
        
        count=$((count + 1))
    done
    
    ok "변경 추적 트리거 생성 완료: $count tables"
}

#---------------------------------------------------------------
# 3. 백업 DB 초기화 (스키마만 복사, 데이터 없이)
#---------------------------------------------------------------
init_backup_schema() {
    log "백업 DB 스키마 초기화..."
    
    local tables=$(run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"SELECT class_name FROM db_class WHERE class_name NOT LIKE 'db_%' AND class_name NOT LIKE 'cqt_%' AND class_name NOT LIKE '_sync%' ORDER BY class_name;\" 2>&1" | grep -v NOTIFICATION | grep -E "^\s+" | sed 's/^ *//')
    
    local count=0
    for tbl in $tables; do
        # 백업 DB에 테이블 있으면 삭제
        run "$BIN/csql -u dba $BACKUP_DB --no-auto-commit -c \"DROP TABLE IF EXISTS $tbl;\" 2>/dev/null || true
        
        # 메인 DB에서 스키마 가져와서 백업 DB에 생성
        run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"CREATE TABLE $BACKUP_DB.$tbl AS SELECT * FROM $MAIN_DB.$tbl WHERE 1=0;\" 2>/dev/null || true
        
        count=$((count + 1))
    done
    
    ok "백업 DB 스키마 초기화 완료: $count tables"
}

#---------------------------------------------------------------
# 4. 초기 전체 동기화 (한 번만 실행)
#---------------------------------------------------------------
full_sync() {
    log "초기 전체 동기화..."
    
    local tables=$(run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"SELECT class_name FROM db_class WHERE class_name NOT LIKE 'db_%' AND class_name NOT LIKE 'cqt_%' AND class_name NOT LIKE '_sync%' ORDER BY class_name;\" 2>&1" | grep -v NOTIFICATION | grep -E "^\s+" | sed 's/^ *//')
    
    local total=0
    for tbl in $tables; do
        # 백업 DB 비우기
        run "$BIN/csql -u dba $BACKUP_DB --no-auto-commit -c \"DELETE FROM $tbl;\" 2>/dev/null || true
        
        # 전체 데이터 복사
        local rows=$(run "$BIN/csql -u dba $BACKUP_DB --no-auto-commit -c \"
            INSERT INTO $tbl SELECT * FROM $MAIN_DB.$tbl;
            SELECT COUNT(*) FROM $tbl;
        \" 2>&1" | grep -E "^\s+[0-9]+" | tail -1 | awk '{print $1}' | tr -d ' ')
        
        total=$((total + rows))
    done
    
    ok "초기 동기화 완료: $total rows"
}

#---------------------------------------------------------------
# 5. 증분 동기화 (1분마다 실행) - 핵심 기능
#---------------------------------------------------------------
incremental_sync() {
    log "증분 동기화 실행..."
    
    # 아직 동기화 안 된 변경 사항 가져오기
    local changes=$(run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"
        SELECT id, table_name, operation, row_key 
        FROM _sync_change_log 
        WHERE synced = FALSE 
        ORDER BY id 
        LIMIT 1000;
    \" 2>&1" | grep -v NOTIFICATION)
    
    if [ -z "$changes" ] || [ $(echo "$changes" | wc -l) -lt 2 ]; then
        ok "동기화할 변경 사항 없음"
        return 0
    fi
    
    local count=0
    local synced_ids=""
    
    # 각 변경 사항 처리
    echo "$changes" | while read line; do
        local id=$(echo "$line" | awk '{print $1}' | tr -d ' ')
        local tbl=$(echo "$line" | awk '{print $2}' | tr -d ' ')
        local op=$(echo "$line" | awk '{print $3}' | tr -d ' ')
        local row_key=$(echo "$line" | awk '{print $4}' | tr -d ' ' | sed "s/'/''/g")
        
        if [ -z "$id" ] || [ "$id" = "id" ]; then
            continue
        fi
        
        # 백업 DB에 적용
        case "$op" in
            INSERT)
                # 메인 DB에서 데이터 가져와서 백업 DB에 INSERT
                run "$BIN/csql -u dba $BACKUP_DB --no-auto-commit -c \"
                    INSERT INTO $tbl SELECT * FROM $MAIN_DB.$tbl WHERE row_id = '$row_key';
                \" 2>/dev/null || true
                ;;
            UPDATE)
                # 메인 DB에서 데이터 가져와서 백업 DB에 UPDATE (또는 DELETE 후 INSERT)
                run "$BIN/csql -u dba $BACKUP_DB --no-auto-commit -c \"
                    DELETE FROM $tbl WHERE row_id = '$row_key';
                    INSERT INTO $tbl SELECT * FROM $MAIN_DB.$tbl WHERE row_id = '$row_key';
                \" 2>/dev/null || true
                ;;
            DELETE)
                run "$BIN/csql -u dba $BACKUP_DB --no-auto-commit -c \"DELETE FROM $tbl WHERE row_id = '$row_key';\" 2>/dev/null || true
                ;;
        esac
        
        # 동기화 완료 표시
        run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"UPDATE _sync_change_log SET synced = TRUE WHERE id = $id;\" 2>/dev/null || true
        
        count=$((count + 1))
        synced_ids="$synced_ids,$id"
    done
    
    ok "증분 동기화 완료: $count changes"
}

#---------------------------------------------------------------
# 6. 상태 확인
#---------------------------------------------------------------
status() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║            SYNC REPLICATION STATUS                        ║"
    echo "╠═══════════════════════════════════════════════════════════╣"
    
    # 메인 DB
    local main_rows=$(run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+" | awk '{print $1}' | tr -d ' ')
    echo -e "║  Main DB:   $main_rows rows                               ║"
    
    # 백업 DB
    local bak_rows=$(run "$BIN/csql -u dba $BACKUP_DB --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+" | awk '{print $1}' | tr -d ' ')
    echo -e "║  Backup DB: $bak_rows rows                               ║"
    
    # 동기화 대기
    local pending=$(run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c 'SELECT COUNT(*) FROM _sync_change_log WHERE synced = FALSE;' 2>&1" | grep -E "^\s+[0-9]+" | awk '{print $1}' | tr -d ' ')
    echo -e "║  Pending:   $pending changes                              ║"
    
    # 트리거 수
    local triggers=$(run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c 'SHOW TRIGGERS;' 2>&1" | grep -c "sync_" || echo 0)
    echo -e "║  Triggers:  $triggers active                              ║"
    
    echo "╚═══════════════════════════════════════════════════════════╝"
}

#---------------------------------------------------------------
# 7. 복제 중지
#---------------------------------------------------------------
stop() {
    log "복제 중지..."
    
    local tables=$(run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"SELECT class_name FROM db_class WHERE class_name NOT LIKE 'db_%' AND class_name NOT LIKE 'cqt_%' AND class_name NOT LIKE '_sync%' ORDER BY class_name;\" 2>&1" | grep -v NOTIFICATION | grep -E "^\s+" | sed 's/^ *//')
    
    for tbl in $tables; do
        run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"DROP TRIGGER IF EXISTS sync_i_$tbl;\" 2>/dev/null || true
        run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"DROP TRIGGER IF EXISTS sync_u_$tbl;\" 2>/dev/null || true
        run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c \"DROP TRIGGER IF EXISTS sync_d_$tbl;\" 2>/dev/null || true
    done
    
    ok "복제 중지됨"
}

case "${1:-status}" in
    init) create_change_table; create_triggers; init_backup_schema; full_sync ;;
    setup) create_change_table; create_triggers ;;
    sync|s) incremental_sync ;;
    full|f) full_sync ;;
    status) status ;;
    stop|x) stop ;;
    *) echo "Usage: $0 {init|setup|sync|full|status|stop}" ;;
esac
