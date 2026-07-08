# DEPRECATED: CUBRID 제거됨 — 사용 금지
echo "[DEPRECATED] unified-dashboard.sh: CUBRID는 제거됨. 이 스크립트는 더 이상 사용되지 않습니다."
exit 1

#!/bin/bash
#============================================
# Unified Dashboard - Complete Status View
# - DB status + backup status + new data tracking
# - Error detection + recovery status
# - Process version + rollback status
# - Timing logs + performance metrics
#============================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; MAGENTA='\033[0;35m'; NC='\033[0m'

NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
POD="cubrid-carbonet-0"
LOG_DB="/opt/Resonance/var/lib/cubrid_operations.db"
CUBRID_BIN="/home/cubrid/CUBRID/bin"
BACKUP_DIR="/opt/Resonance/data/cubrid/backup"
PROCESS_BACKUP="/opt/Resonance/var/process-backups"
TIMING_LOG="/opt/Resonance/var/log/process-timing.log"
GIT_REPO="/opt/Resonance/data/process-versions"

run() { kubectl exec $POD -n $NAMESPACE -- bash -c "$1" 2>/dev/null; }

#============================================
# DB STATUS
#============================================
show_db_status() {
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                     DATABASE STATUS                              ║${NC}"
    echo -e "${CYAN}╠═══════════════════════════════════════════════════════════════════╣${NC}"
    
    # Server status
    local server_status=$(run "\$CUBRID_BIN/cubrid server status $DB_NAME 2>&1 | grep -c 'running'")
    if [ "$server_status" = "1" ]; then
        echo -e "${CYAN}║${NC}  Server:       ${GREEN}running${NC}                                            ${CYAN}║${NC}"
    else
        echo -e "${CYAN}║${NC}  Server:       ${RED}STOPPED${NC}                                            ${CYAN}║${NC}"
    fi
    
    # Row count
    local rows=$(run "\$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' ')
    echo -e "${CYAN}║${NC}  Rows:         ${rows:-unknown}                                               ${CYAN}║${NC}"
    
    # Table count
    local tables=$(run "\$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SHOW TABLES;' 2>&1 | grep -v NOTIFICATION | tail -n +4 | wc -l")
    echo -e "${CYAN}║${NC}  Tables:      $tables                                              ${CYAN}║${NC}"
    
    # Log file
    local log_size=$(run "ls -lh /var/lib/cubrid/databases/${DB_NAME}_lgat 2>/dev/null | awk '{print \$5}'")
    echo -e "${CYAN}║${NC}  Log file:    ${log_size:-unknown}                                              ${CYAN}║${NC}"
    
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
}

#============================================
# BACKUP STATUS
#============================================
show_backup_status() {
    echo ""
    echo -e "${MAGENTA}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║                     BACKUP STATUS                                 ║${NC}"
    echo -e "${MAGENTA}╠═══════════════════════════════════════════════════════════════════╣${NC}"
    
    # Full backups
    echo -e "${MAGENTA}║${NC}  Full Backups:                                                 ${MAGENTA}║${NC}"
    for backup in $(find "$BACKUP_DIR" -maxdepth 1 -type d -name "${DB_NAME}-*" 2>/dev/null | sort -r | head -3); do
        local name=$(basename "$backup")
        local size=$(du -sh "$backup" 2>/dev/null | cut -f1)
        local date=$(ls -l --time-style=long-iso "$backup" 2>/dev/null | awk '{print $6, $7}' | cut -d' ' -f2)
        printf "${MAGENTA}║${NC}    - %-20s %6s %s                      ${MAGENTA}║${NC}\n" "$name" "$size" "$date"
    done
    
    # Incremental
    local inc_count=$(find "$BACKUP_DIR/incremental" -maxdepth 1 -type d 2>/dev/null | wc -l)
    ((inc_count--)) 2>/dev/null || inc_count=0
    echo -e "${MAGENTA}║${NC}  Incremental:  $inc_count                                             ${MAGENTA}║${NC}"
    
    # Last backup info from SQLite
    if [ -f "$LOG_DB" ]; then
        local last_backup=$(python3 -c "
import sqlite3
conn=sqlite3.connect('$LOG_DB')
cur=conn.execute('SELECT backup_path, datetime(timestamp) FROM backups ORDER BY timestamp DESC LIMIT 1')
row=cur.fetchone()
if row: print(f'{row[0]} | {row[1]}')
conn.close()
" 2>/dev/null)
        if [ -n "$last_backup" ]; then
            echo -e "${MAGENTA}║${NC}  Last backup:  $last_backup   ${MAGENTA}║${NC}"
        fi
    fi
    
    echo -e "${MAGENTA}╚═══════════════════════════════════════════════════════════════════╝${NC}"
}

#============================================
# NEW DATA TRACKING
#============================================
show_new_data_tracking() {
    echo ""
    echo -e "${YELLOW}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║                  NEW DATA TRACKING                                 ║${NC}"
    echo -e "${YELLOW}╠═══════════════════════════════════════════════════════════════════╣${NC}"
    
    # Check for new data since last backup
    if [ -f "$LOG_DB" ]; then
        local last_backup_rows=$(python3 -c "
import sqlite3
conn=sqlite3.connect('$LOG_DB')
cur=conn.execute('SELECT row_count FROM backups WHERE status=\"completed\" ORDER BY timestamp DESC LIMIT 1')
row=cur.fetchone()
print(row[0] if row else '0')
conn.close()
" 2>/dev/null)
        
        local current_rows=$(run "\$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' ')
        
        local diff=$((current_rows - last_backup_rows))
        
        echo -e "${YELLOW}║${NC}  Last backup rows:  $last_backup_rows                                    ${YELLOW}║${NC}"
        echo -e "${YELLOW}║${NC}  Current rows:       $current_rows                                        ${YELLOW}║${NC}"
        
        if [ "$diff" -gt 0 ]; then
            echo -e "${YELLOW}║${NC}  New data:          ${GREEN}+$diff rows${NC}                                      ${YELLOW}║${NC}"
            echo -e "${YELLOW}║${NC}  Status:            ${GREEN}BACKUP NEEDED${NC}                                   ${YELLOW}║${NC}"
        elif [ "$diff" -lt 0 ]; then
            echo -e "${YELLOW}║${NC}  Data change:       ${RED}$diff rows${NC}                                     ${YELLOW}║${NC}"
            echo -e "${YELLOW}║${NC}  Status:            ${RED}INVESTIGATE${NC}                                     ${YELLOW}║${NC}"
        else
            echo -e "${YELLOW}║${NC}  Status:            ${GREEN}UP TO DATE${NC}                                       ${YELLOW}║${NC}"
        fi
    else
        echo -e "${YELLOW}║${NC}  No tracking data available                                     ${YELLOW}║${NC}"
    fi
    
    echo -e "${YELLOW}╚═══════════════════════════════════════════════════════════════════╝${NC}"
}

#============================================
# RECOVERY & ERROR STATUS
#============================================
show_recovery_status() {
    echo ""
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║               RECOVERY & ERROR STATUS                             ║${NC}"
    echo -e "${RED}╠═══════════════════════════════════════════════════════════════════╣${NC}"
    
    # Recent recovery attempts
    if [ -f "$LOG_DB" ]; then
        echo -e "${RED}║${NC}  Recent Recoveries:                                            ${RED}║${NC}"
        
        python3 -c "
import sqlite3
conn=sqlite3.connect('$LOG_DB')
cur=conn.execute('SELECT error_type, status, duration_sec, datetime(timestamp) FROM recovery_log ORDER BY timestamp DESC LIMIT 3')
for row in cur.fetchall():
    status_icon = '✓' if row[1] == 'success' else '✗'
    print(f'  {status_icon} {row[0]} | {row[1]} | {row[2]}s | {row[3]}')
conn.close()
" 2>/dev/null | while read line; do
            echo -e "${RED}║${NC}  $line                                                    ${RED}║${NC}"
        done
        
        # Last error
        local last_error=$(python3 -c "
import sqlite3
conn=sqlite3.connect('$LOG_DB')
cur=conn.execute('SELECT error_type FROM recovery_log WHERE status!=\"success\" ORDER BY timestamp DESC LIMIT 1')
row=cur.fetchone()
print(row[0] if row else 'none')
conn.close()
" 2>/dev/null)
        
        echo -e "${RED}║${NC}  Last error:      $last_error                                ${RED}║${NC}"
    else
        echo -e "${RED}║${NC}  No recovery history                                           ${RED}║${NC}"
    fi
    
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════════╝${NC}"
}

#============================================
# PROCESS VERSION STATUS
#============================================
show_process_status() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║               PROCESS VERSION STATUS                             ║${NC}"
    echo -e "${BLUE}╠═══════════════════════════════════════════════════════════════════╣${NC}"
    
    echo -e "${BLUE}║${NC}  Script                   Current Version                     ${BLUE}║${NC}"
    
    for script in cubrid-recover-v4.sh ai-guardian-v2.sh backup-guardian-v2.sh error-guardian.sh; do
        local current_checksum=$(md5sum "/opt/Resonance/ops/scripts/$script" 2>/dev/null | cut -d' ' -f1)
        local latest_saved=$(ls -t "$GIT_REPO/$script/versions/"*.sh 2>/dev/null | head -1)
        local latest_checksum=""
        
        if [ -n "$latest_saved" ]; then
            latest_checksum=$(md5sum "$latest_saved" 2>/dev/null | cut -d' ' -f1)
        fi
        
        local status="${GREEN}ok${NC}"
        if [ "$current_checksum" != "$latest_checksum" ] && [ -n "$latest_checksum" ]; then
            status="${YELLOW}modified${NC}"
        fi
        
        printf "${BLUE}║${NC}  %-25s %-35s ${BLUE}║${NC}\n" "$script" "$status"
    done
    
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════╝${NC}"
}

#============================================
# TIMING & PERFORMANCE
#============================================
show_timing() {
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║               TIMING & PERFORMANCE                               ║${NC}"
    echo -e "${CYAN}╠═══════════════════════════════════════════════════════════════════╣${NC}"
    
    if [ -f "$TIMING_LOG" ]; then
        echo -e "${CYAN}║${NC}  Recent Process Timings:                                     ${CYAN}║${NC}"
        
        tail -5 "$TIMING_LOG" 2>/dev/null | while read line; do
            local dt=$(echo "$line" | cut -d'|' -f1)
            local proc=$(echo "$line" | cut -d'|' -f2)
            local dur=$(echo "$line" | cut -d'|' -f3)
            printf "${CYAN}║${NC}    %s | %-15s | %4ss                         ${CYAN}║${NC}\n" "$dt" "$proc" "$dur"
        done
        
        # Average times
        if [ -f "$LOG_DB" ]; then
            echo -e "${CYAN}║${NC}  Averages:                                                   ${CYAN}║${NC}"
            python3 -c "
import sqlite3
conn=sqlite3.connect('$LOG_DB')
cur=conn.execute('SELECT process_name, AVG(duration_sec), COUNT(*) FROM timing_logs GROUP BY process_name LIMIT 5')
for row in cur.fetchall():
    print(f'  {row[0]}: {row[1]:.1f}s avg ({row[2]} runs)')
conn.close()
" 2>/dev/null | while read line; do
            echo -e "${CYAN}║${NC}  $line                                             ${CYAN}║${NC}"
        done
        fi
    else
        echo -e "${CYAN}║${NC}  No timing data yet                                           ${CYAN}║${NC}"
    fi
    
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
}

#============================================
# QUICK ACTIONS
#============================================
show_actions() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    QUICK ACTIONS                                  ║${NC}"
    echo -e "${GREEN}╠═══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}                                                                     ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  backup         - Create full backup                            ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  recover        - Run recovery                                  ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  guardian       - Start error guardian                         ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  save-process   - Save current process versions                ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  health          - Quick health check                           ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                                     ${GREEN}║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
}

#============================================
# MAIN
#============================================
main() {
    echo ""
    echo -e "${MAGENTA}╔═══════════════════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║${NC}              ${CYAN}CUBRID UNIFIED DASHBOARD$(date +%Y-%m-%d_%H:%M)${NC}                ${MAGENTA}║${NC}"
    echo -e "${MAGENTA}╚═══════════════════════════════════════════════════════════════════════════════════════════╝${NC}"
    
    show_db_status
    show_backup_status
    show_new_data_tracking
    show_recovery_status
    show_process_status
    show_timing
    show_actions
    
    echo ""
}

case "${1:-status}" in
    status|all) main ;;
    db) show_db_status ;;
    backup) show_backup_status ;;
    tracking) show_new_data_tracking ;;
    recovery) show_recovery_status ;;
    process) show_process_status ;;
    timing) show_timing ;;
    *)
        echo "Usage: $0 {status|db|backup|tracking|recovery|process|timing}"
        ;;
esac
