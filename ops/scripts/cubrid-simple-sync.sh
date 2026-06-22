#!/bin/bash
# Simple sync: carbonet -> carbonet_bak
POD="cubrid-carbonet-0"
NS="carbonet-prod"
BIN="/home/cubrid/CUBRID/bin"

run() { kubectl exec "$POD" -n "$NS" -- bash -c "$1" 2>/dev/null; }

sync_tables() {
    echo "[$(date +%H:%M:%S)] Sync carbonet -> carbonet_bak"
    
    local tables=$(run "$BIN/csql -u dba carbonet --no-auto-commit -c 'SELECT class_name FROM db_class WHERE class_name LIKE '\''admin_%'\'' ORDER BY class_name;' 2>&1" | grep -v NOTIFICATION | grep -E "^\s+" | sed 's/^ *//' | tr -d "'")
    
    for tbl in $tables; do
        local main_count=$(run "$BIN/csql -u dba carbonet --no-auto-commit -c \"SELECT COUNT(*) FROM $tbl;\" 2>&1" | grep -E "^\s+[0-9]+" | awk '{print $1}')
        local bak_count=$(run "$BIN/csql -u dba carbonet_bak --no-auto-commit -c \"SELECT COUNT(*) FROM $tbl;\" 2>&1" | grep -E "^\s+[0-9]+" | awk '{print $1}')
        
        if [ "$main_count" != "$bak_count" ]; then
            echo "  SYNC: $tbl ($main_count -> $bak_count)"
            run "$BIN/csql -u dba carbonet_bak --no-auto-commit -c \"DELETE FROM $tbl;\" 2>/dev/null
            run "$BIN/csql -u dba carbonet_bak --no-auto-commit -c \"INSERT INTO $tbl SELECT * FROM carbonet.$tbl;\" 2>/dev/null
        fi
    done
    
    echo "[$(date +%H:%M:%S)] Done"
}

show_status() {
    echo "=== STATUS ==="
    local m=$(run "$BIN/csql -u dba carbonet --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+" | awk '{print $1}')
    local b=$(run "$BIN/csql -u dba carbonet_bak --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+" | awk '{print $1}')
    echo "carbonet: ${m:-0}"
    echo "carbonet_bak: ${b:-0}"
}

case "${1:-status}" in
    sync|s) sync_tables ;;
    status) show_status ;;
    *) show_status ;;
esac
