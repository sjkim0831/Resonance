#!/bin/bash
# DEPRECATED: CUBRID 제거됨 — 사용 금지
# PostgreSQL 환경: postgres-patroni-0/1/2 (Patroni HA)
echo "[DEPRECATED] cubrid-change-tracker: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#===============================================================
# CUBRID CHANGE TRACKER - 신규 데이터 즉시 기록
# - SQLite에 모든 변경 사항 로깅
# - 증분 백업 (변경분만)
# - 용량 관리 자동화
#===============================================================
set -u

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'

POD="cubrid-carbonet-0"
NS="carbonet-prod"
DB="carbonet"
BIN="/home/cubrid/CUBRID/bin"
CHANGE_DB="/opt/Resonance/var/lib/cubrid_changes.db"
HOST_DB="/opt/Resonance/data/cubrid/databases"

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] OK${NC} $1"; }

run() { kubectl exec "$POD" -n "$NS" -- bash -c "$1" 2>/dev/null; }

#---------------------------------------------------------------
# 1. 변경 추적 DB 초기화
#---------------------------------------------------------------
init_change_tracker() {
    mkdir -p /opt/Resonance/var/lib
    sqlite3 "$CHANGE_DB" << 'EOSQL'
CREATE TABLE IF NOT EXISTS change_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    row_id TEXT,
    column_data TEXT, -- JSON of changed columns
    sql_query TEXT, -- Actual SQL executed
    verified INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_timestamp ON change_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_table ON change_log(table_name);
CREATE TABLE IF NOT EXISTS snapshot_info (
    id INTEGER PRIMARY KEY,
    snapshot_time TEXT,
    row_count INTEGER,
    status TEXT
);
EOSQL
    ok "변경 추적 DB 초기화 완료"
}

#---------------------------------------------------------------
# 2. 현재 상태 스냅샷 생성
#---------------------------------------------------------------
create_snapshot() {
    local tables=$(run "$BIN/csql -u dba $DB --no-auto-commit -c \"SELECT class_name FROM db_class WHERE class_name NOT LIKE 'db_%' AND class_name NOT LIKE 'cqt_%' ORDER BY class_name;\" 2>&1" | grep -E "^\s+" | sed 's/^ *//')
    
    echo "=== 스냅샷 생성 중 ==="
    for table in $tables; do
        local count=$(run "$BIN/csql -u dba $DB --no-auto-commit -c \"SELECT COUNT(*) FROM $table;\" 2>&1" | grep -E "^\s+[0-9]+" | awk "{print \$1}" | tr -d ' ')
        sqlite3 "$CHANGE_DB" "INSERT INTO snapshot_info (snapshot_time, row_count, status) VALUES ('$(date -Iseconds)', $count, 'snap');"
        echo "  $table: $count rows"
    done
    ok "스냅샷 생성 완료"
}

#---------------------------------------------------------------
# 3. 모든 테이블의 현재 데이터 SQL로 추출
#---------------------------------------------------------------
export_all_data() {
    local output_dir="/opt/Resonance/data/cubrid/backup/sql"
    mkdir -p "$output_dir"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    
    echo "=== 전체 데이터 SQL 추출 ==="
    
    # Schema
    run "$BIN/csql -u dba $DB --no-auto-commit -s < /dev/null 2>/dev/null"
    kubectl exec "$POD" -n "$NS" -- bash -c "
        $BIN/csql -u dba $DB --no-auto-commit -c \"SELECT class_name, class_type FROM db_class WHERE class_name NOT LIKE 'db_%' ORDER BY class_name;\" 2>&1
    " | grep -v NOTIFICATION | grep -E "^\s+" | while read line; do
        local table=$(echo "$line" | awk '{print $1}')
        # Export each table as INSERT statements
        run "$BIN/csql -u dba $DB --no-auto-commit -c \"SELECT * FROM $table;\" 2>&1" | grep -v NOTIFICATION > "$output_dir/${table}_data.txt"
    done
    
    ok "SQL 데이터 추출 완료: $output_dir"
}

#---------------------------------------------------------------
# 4. 특정 테이블만 증분 추출 (새 데이터만)
#---------------------------------------------------------------
export_incremental() {
    local table=$1
    local last_export=$(sqlite3 "$CHANGE_DB" "SELECT MAX(timestamp) FROM change_log WHERE table_name='$table' AND verified=1" 2>/dev/null)
    
    if [ -z "$last_export" ]; then
        echo "전체 추출: $table"
        # 전체 추출
    else
        echo "증분 추출: $table (since $last_export)"
        # 증분 추출 (새로 추가된 것만)
    fi
}

#---------------------------------------------------------------
# 5. 용량 관리 - 오래된 파일 정리
#---------------------------------------------------------------
cleanup_old_files() {
    echo "=== 용량 관리 ==="
    
    # 1. 시간별 백업 (24시간 이상)
    local hourly_count=$(ls /opt/Resonance/data/cubrid/backup/hourly/*.txt 2>/dev/null | wc -l)
    if [ "$hourly_count" -gt 24 ]; then
        find /opt/Resonance/data/cubrid/backup/hourly -name "*.txt" -mmin +1440 -delete 2>/dev/null
        echo "  시간별 백업 정리: $(ls /opt/Resonance/data/cubrid/backup/hourly/*.txt 2>/dev/null | wc -l) remaining"
    fi
    
    # 2. SQL 로그 (30일 이상)
    find /opt/Resonance/var/log -name "changes_*.log" -mtime +30 -delete 2>/dev/null
    echo "  30일 이상 변경 로그 정리됨"
    
    # 3. SQLite 변경 로그 (항상 유지, 안 지움)
    local sqlite_size=$(du -sh "$CHANGE_DB" 2>/dev/null | awk '{print $1}')
    echo "  변경 추적 DB: $sqlite_size"
    
    ok "용량 관리 완료"
}

#---------------------------------------------------------------
# 6. 빠른 검증 (COUNT만)
#---------------------------------------------------------------
quick_verify() {
    local rows=$(run "$BIN/csql -u dba $DB --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+" | awk "{print \$1}" | tr -d ' ')
    echo "$rows"
}

#---------------------------------------------------------------
# 7. 복원 체크리스트 출력
#---------------------------------------------------------------
show_restore_checklist() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║              복원 체크리스트                                ║"
    echo "╠═══════════════════════════════════════════════════════════╣"
    echo "║                                                           ║"
    echo "║  1. Binary 복원 (빠름, 1-2분)                             ║"
    echo "║     cp -r /opt/Resonance/data/cubrid/backup/immutable/*  ║"
    echo "║          /opt/Resonance/data/cubrid/databases/           ║"
    echo "║                                                           ║"
    echo "║  2. SQL 복원 (완전, 5-10분)                               ║"
    echo "║     - schema 로드 (csql)                                  ║"
    echo "║     - objects 로드 (loaddb)                               ║"
    echo "║     - indexes 로드 (csql)                                 ║"
    echo "║                                                           ║"
    echo "║  3. 변경 추적 DB (항상 유지)                             ║"
    echo "║     /opt/Resonance/var/lib/cubrid_changes.db             ║"
    echo "║     - 모든 변경 이력 보관                                 ║"
    echo "║                                                           ║"
    echo "║  4. 호스트 백업 (자동, 3분마다)                           ║"
    echo "║     /opt/Resonance/data/cubrid/databases/                ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
}

case "${1:-init}" in
    init) init_change_tracker; create_snapshot ;;
    snapshot) create_snapshot ;;
    export) export_all_data ;;
    cleanup) cleanup_old_files ;;
    verify) quick_verify ;;
    checklist) show_restore_checklist ;;
    *) echo "Usage: $0 {init|snapshot|export|cleanup|verify|checklist}" ;;
esac
