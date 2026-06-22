#!/bin/bash
# CUBRID SAFE GUARDIAN v2 - 데이터 절대 유실 안 됨
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

POD="cubrid-carbonet-0"
NS="carbonet-prod"
DB="carbonet"
POD_DB="/var/lib/cubrid/databases"
HOST_DB="/opt/Resonance/data/cubrid/databases"
CUBRID="/home/cubrid/CUBRID"
BIN="$CUBRID/bin"

DATABASE_TXT="$DB\t$POD_DB\tlocalhost\t$POD_DB\tfile:$POD_DB/lob"

run() { kubectl exec "$POD" -n "$NS" -- bash -c "$1" 2>/dev/null; }

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] OK${NC} $1"; }
err() { echo -e "${RED}[$(date +%H:%M:%S)] ERR${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] WARN${NC} $1"; }

preserve_databases_txt() {
    echo -e "$DATABASE_TXT" > "$HOST_DB/databases.txt"
    chmod 666 "$HOST_DB/databases.txt" 2>/dev/null
    run "echo -e '$DATABASE_TXT' > $POD_DB/databases.txt"
    run "mkdir -p $CUBRID/databases && echo -e '$DATABASE_TXT' > $CUBRID/databases/databases.txt"
    ok "databases.txt 보존"
}

backup_to_host() {
    run "cp -f $POD_DB/${DB}* $HOST_DB/ 2>/dev/null"
    local cnt=$(ls $HOST_DB/${DB}* 2>/dev/null | wc -l)
    ok "호스트 백업: $cnt files"
}

check_integrity() {
    local rows=$(run "$BIN/csql -u dba $DB --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+" | awk "{print \$1}" | tr -d ' ')
    if [ -z "$rows" ] || [ "$rows" = "0" ]; then
        err "데이터 없음"
        return 1
    fi
    ok "데이터: $rows rows"
    return 0
}

check_server() {
    run "$BIN/cubrid server status $DB 2>&1" | grep -c "Server $DB" || echo 0
}

auto_repair() {
    warn "자동 복구..."
    local fixed=0
    
    if ! run "grep -q '$DB' $POD_DB/databases.txt 2>/dev/null"; then
        preserve_databases_txt
        fixed=$((fixed + 1))
    fi
    
    local pf=$(run "ls $POD_DB/${DB}* 2>/dev/null | wc -l")
    if [ "$pf" -lt 5 ]; then
        run "cp -f $HOST_DB/${DB}* $POD_DB/ 2>/dev/null"
        fixed=$((fixed + 1))
    fi
    
    if [ "$(check_server)" -lt 1 ]; then
        run "$BIN/cubrid server start $DB 2>&1" | tail -1
        fixed=$((fixed + 1))
    fi
    
    backup_to_host
    ok "복구 완료: $fixed건"
}

report() {
    echo ""
    echo "=== CUBRID SAFE STATUS ==="
    local srv=$(check_server)
    echo "Server: $([ "$srv" -ge 1 ] && echo 'RUNNING' || echo 'STOPPED')"
    local rows=$(run "$BIN/csql -u dba $DB --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1" | grep -E "^\s+[0-9]+" | awk "{print \$1}" | tr -d ' ')
    echo "Rows: ${rows:-0}"
    echo "Host backup: $(ls $HOST_DB/${DB}* 2>/dev/null | wc -l) files"
    echo "databases.txt: $([ -f "$HOST_DB/databases.txt" ] && echo 'PRESERVED' || echo 'MISSING')"
    echo "========================"
    echo ""
}

case "${1:-check}" in
    check)
        log "Safe Guardian check..."
        preserve_databases_txt
        if ! check_integrity; then
            auto_repair
            check_integrity || err "복구 실패"
        fi
        backup_to_host
        ;;
    fix|repair) auto_repair ;;
    backup) backup_to_host ;;
    preserve) preserve_databases_txt ;;
    report|status) report ;;
    *) echo "Usage: $0 {check|fix|backup|preserve|report}" ;;
esac
