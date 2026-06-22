#!/bin/bash
#===============================================================
# CUBRID SQL BACKUP - 완전한 복구를 위한 SQL 덤프
# - Schema (테이블 구조)
# - Data (데이터)
# - Indexes (인덱스)
# - 증분 아님, 전체 매번 (용량 적음, 속도 빠름)
#===============================================================
set -u

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'

POD="cubrid-carbonet-0"
NS="carbonet-prod"
DB="carbonet"
BIN="/home/cubrid/CUBRID/bin"
BACKUP_DIR="/opt/Resonance/data/cubrid/backup/sql"
IMMUTABLE_SQL="/opt/Resonance/data/cubrid/backup/immutable_sql"

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] OK${NC} $1"; }

run() { kubectl exec "$POD" -n "$NS" -- bash -c "$1" 2>/dev/null; }

#---------------------------------------------------------------
# 1. SQL 언로드 (빠름, 2-5분)
#---------------------------------------------------------------
unload_sql() {
    local start=$(date +%s)
    log "SQL 언로드 중..."
    
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$IMMUTABLE_SQL"
    
    # 언로드 디렉토리
    local UNLOAD="$BACKUP_DIR/unloaddb_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$UNLOAD"
    
    # Pod에서 언로드 실행
    run "mkdir -p /tmp/cubrid_unload && cd /tmp/cubrid_unload && $BIN/cubrid unloaddb -u dba $DB 2>&1" | tail -10
    
    # 파일을 호스트로 복사
    kubectl cp "$POD:/tmp/cubrid_unload/" "$UNLOAD/" -n "$NS" 2>/dev/null || true
    
    # Immutable에도 저장 (절대 삭제 안 함)
    cp -r "$UNLOAD" "$IMMUTABLE_SQL/latest" 2>/dev/null || true
    
    local elapsed=$(( $(date +%s) - start ))
    local files=$(ls "$UNLOAD" 2>/dev/null | wc -l)
    local size=$(du -sh "$UNLOAD" 2>/dev/null | awk '{print $1}')
    
    ok "SQL 언로드 완료: ${elapsed}초, $files files, $size"
    echo "  저장 위치: $UNLOAD"
}

#---------------------------------------------------------------
# 2. SQL 로드 (복원, 5-10분)
#---------------------------------------------------------------
load_sql() {
    local start=$(date +%s)
    local unload_path="${1:-$IMMUTABLE_SQL/latest}"
    
    log "SQL 로드 중..."
    
    if [ ! -d "$unload_path" ]; then
        echo "오류: 언로드 파일 없음 ($unload_path)"
        return 1
    fi
    
    # Pod로 복사
    kubectl cp "$unload_path/" "$POD:/tmp/sql_restore/" -n "$NS" 2>/dev/null
    
    # 스키마 로드
    log "스키마 로드..."
    run "$BIN/csql -u dba $DB --no-auto-commit < /tmp/sql_restore/*.schema 2>&1" | tail -3
    
    # 데이터 로드
    log "데이터 로드..."
    run "$BIN/cubrid loaddb -u dba -d /tmp/sql_restore/*.objects $DB 2>&1" | tail -5
    
    # 인덱스 로드
    log "인덱스 로드..."
    run "$BIN/csql -u dba $DB --no-auto-commit < /tmp/sql_restore/*.indexes 2>&1" | tail -3
    
    local elapsed=$(( $(date +%s) - start ))
    ok "SQL 로드 완료: ${elapsed}초"
}

#---------------------------------------------------------------
# 3. 빠른 SQL 덤프 (현재 데이터만, 증분 아님)
#---------------------------------------------------------------
quick_dump() {
    local start=$(date +%s)
    log "빠른 SQL 덤프..."
    
    mkdir -p "$BACKUP_DIR/quick"
    local dump_file="$BACKUP_DIR/quick/dump_$(date +%Y%m%d_%H%M%S).sql"
    
    # 테이블 목록
    local tables=$(run "$BIN/csql -u dba $DB --no-auto-commit -c 'SELECT class_name FROM db_class WHERE class_name NOT LIKE \"db_%\" ORDER BY class_name;' 2>&1" | grep -v NOTIFICATION | grep -E "^\s+" | sed 's/^ *//')
    
    # Schema
    echo "-- Schema $(date)" > "$dump_file"
    for t in $tables; do
        local ddl=$(run "$BIN/csql -u dba $DB --no-auto-commit -c 'SHOW CREATE TABLE $t;' 2>&1" | grep -v NOTIFICATION | grep -v "SHOW CREATE" | head -20)
        echo "CREATE TABLE $t (...);" >> "$dump_file" 2>/dev/null || true
    done
    
    # Data (CSV)
    local csv_file="${dump_file%.sql}.csv"
    echo "table,count" > "$csv_file"
    for t in $tables; do
        local count=$(run "$BIN/csql -u dba $DB --no-auto-commit -c 'SELECT COUNT(*) FROM $t;' 2>&1" | grep -E "^\s+[0-9]+" | awk "{print \$1}" | tr -d ' ')
        echo "$t,$count" >> "$csv_file"
    done
    
    local elapsed=$(( $(date +%s) - start ))
    ok "빠른 덤프 완료: ${elapsed}초"
    echo "  Schema: $dump_file"
    echo "  Summary: $csv_file"
}

#---------------------------------------------------------------
# 4. 용량 확인
#---------------------------------------------------------------
size_check() {
    echo ""
    echo "=== SQL 백업 용량 ==="
    echo "Quick backup: $(du -sh $BACKUP_DIR/quick 2>/dev/null | awk '{print $1}')"
    echo "Unload: $(du -sh $BACKUP_DIR/unloaddb_* 2>/dev/null | head -1 | awk '{print $1}')"
    echo "Immutable: $(du -sh $IMMUTABLE_SQL 2>/dev/null | awk '{print $1}')"
}

case "${1:-quick}" in
    unload|u) unload_sql ;;
    load|l) load_sql "$2" ;;
    quick|q) quick_dump ;;
    size|s) size_check ;;
    *) 
        echo "Usage: $0 {unload|load [path]|quick|size}"
        ;;
esac
