# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] cubrid-live-sync.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/bin/bash
# CUBRID LIVE SYNC - 실시간 복제
POD="cubrid-carbonet-0"
NS="carbonet-prod"
MAIN_DB="carbonet"
BACKUP_DB="carbonet_bak"
BIN="/home/cubrid/CUBRID/bin"

run() { kubectl exec "$POD" -n "$NS" -- bash -c "$1" 2>/dev/null; }

get_count() {
    local db=$1
    local tbl=$2
    run "$BIN/csql -u dba $db --no-auto-commit -c \"SELECT COUNT(*) FROM $tbl;\" 2>&1" | grep -E "^\s+[0-9]+" | awk '{print $1}'
}

sync_tables() {
    echo "[SYNC] 테이블 동기화..."
    local tables=$(run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c 'SELECT class_name FROM db_class WHERE class_name LIKE '\''admin_%'\'' ORDER BY class_name;' 2>&1" | grep -v NOTIFICATION | grep -E "^\s+" | sed 's/^ *//')
    
    local synced=0
    for tbl in $tables; do
        local m=$(get_count $MAIN_DB $tbl)
        local b=$(get_count $BACKUP_DB $tbl)
        
        if [ "$m" != "$b" ]; then
            echo "  SYNC: $tbl (M=$m -> B=$b)"
            run "$BIN/csql -u dba $BACKUP_DB --no-auto-commit -c \"DELETE FROM $tbl;\" 2>/dev/null
            run "$BIN/csql -u dba $BACKUP_DB --no-auto-commit -c \"INSERT INTO $tbl SELECT * FROM $MAIN_DB.$tbl;\" 2>/dev/null
            synced=$((synced + 1))
        fi
    done
    
    if [ "$synced" = "0" ]; then
        echo "  변경 없음 - 모두 동기화됨"
    else
        echo "  $synced tables 동기화됨"
    fi
}

full_sync() {
    echo "[FULL] 전체 동기화..."
    local tables=$(run "$BIN/csql -u dba $MAIN_DB --no-auto-commit -c 'SELECT class_name FROM db_class WHERE class_name LIKE '\''admin_%'\'' ORDER BY class_name;' 2>&1" | grep -v NOTIFICATION | grep -E "^\s+" | sed 's/^ *//')
    
    for tbl in $tables; do
        run "$BIN/csql -u dba $BACKUP_DB --no-auto-commit -c \"DELETE FROM $tbl;\" 2>/dev/null
        run "$BIN/csql -u dba $BACKUP_DB --no-auto-commit -c \"INSERT INTO $tbl SELECT * FROM $MAIN_DB.$tbl;\" 2>/dev/null
        echo "  $tbl synced"
    done
    echo "전체 동기화 완료"
}

status() {
    echo ""
    echo "=== LIVE SYNC STATUS ==="
    local m=$(get_count $MAIN_DB "admin_emission_gwp_value")
    local b=$(get_count $BACKUP_DB "admin_emission_gwp_value")
    echo "Main DB:   $m rows"
    echo "Backup DB: $b rows"
    echo "Sync:      $([ "$m" = "$b" ] && echo 'OK' || echo 'SYNC NEEDED')"
}

case "${1:-status}" in
    sync|s) sync_tables ;;
    full|f) full_sync ;;
    status) status ;;
    *) status ;;
esac
