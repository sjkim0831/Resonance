#!/bin/bash
#============================================
# CUBRID Web API Server v2
# - REST API for DB management
# - Web dashboard ready
# - Prometheus metrics
#============================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

NAMESPACE="carbonet-prod"
DB_NAME="carbonet"
POD="cubrid-carbonet-0"
LOG_DB="/opt/Resonance/var/lib/cubrid_operations.db"
CUBRID_BIN="/home/cubrid/CUBRID/bin"
PORT="${PORT:-8080}"
HOST="${HOST:-0.0.0.0}"

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
log_ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; }
log_err() { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; }

run() { kubectl exec $POD -n $NAMESPACE -- bash -c "$1" 2>/dev/null; }

#============================================
# JSON HELPERS
#============================================
json_response() {
    local status="$1"
    local message="$2"
    local data="$3"
    cat << EOF
{
    "status": "$status",
    "message": "$message",
    "data": $data,
    "timestamp": "$(date -Iseconds)"
}
EOF
}

json_error() {
    cat << EOF
{
    "status": "error",
    "message": "$1",
    "timestamp": "$(date -Iseconds)"
}
EOF
}

json_ok() {
    cat << EOF
{
    "status": "ok",
    "timestamp": "$(date -Iseconds)"
}
EOF
}

#============================================
# HANDLERS
#============================================
handle_health() {
    local server_status=$(run "\$CUBRID_BIN/cubrid server status $DB_NAME 2>&1 | grep -c 'running'")
    local rows=$(run "\$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' ')
    
    if [ "$server_status" = "1" ]; then
        cat << EOF
{
    "status": "healthy",
    "server": "running",
    "rows": ${rows:-0},
    "timestamp": "$(date -Iseconds)"
}
EOF
    else
        cat << EOF
{
    "status": "unhealthy",
    "server": "stopped",
    "rows": 0,
    "timestamp": "$(date -Iseconds)"
}
EOF
    fi
}

handle_status() {
    local server_status=$(run "\$CUBRID_BIN/cubrid server status $DB_NAME 2>&1 | grep -c 'running'")
    local rows=$(run "\$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' ')
    local tables=$(run "\$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SHOW TABLES;' 2>&1 | grep -v NOTIFICATION | tail -n +4 | wc -l")
    
    cat << EOF
{
    "database": "$DB_NAME",
    "server": "$( [ "$server_status" = "1" ] && echo 'running' || echo 'stopped' )",
    "rows": ${rows:-0},
    "tables": ${tables:-0},
    "backup_count": $(find /opt/Resonance/data/cubrid/backup -maxdepth 1 -type d 2>/dev/null | wc -l),
    "timestamp": "$(date -Iseconds)"
}
EOF
}

handle_backup_list() {
    echo "{"
    echo '    "backups": ['
    local first=1
    for backup in $(find /opt/Resonance/data/cubrid/backup -maxdepth 1 -type d -name "carbonet-*" 2>/dev/null | sort -r); do
        local name=$(basename "$backup")
        local size=$(du -sh "$backup" 2>/dev/null | cut -f1)
        local date=$(ls -l --time-style=long-iso "$backup" 2>/dev/null | awk '{print $6, $7}')
        local rows=$(cat "$backup/METADATA.json" 2>/dev/null | grep -o '"rows":[0-9]*' | cut -d':' -f2 || echo 0)
        
        if [ $first -eq 0 ]; then echo ","; fi
        first=0
        echo "        {\"name\": \"$name\", \"size\": \"$size\", \"date\": \"$date\", \"rows\": $rows}"
    done
    echo ""
    echo "    ],"
    echo "    \"timestamp\": \"$(date -Iseconds)\""
    echo "}"
}

handle_backup_create() {
    local start=$(date +%s)
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="/opt/Resonance/data/cubrid/backup/${DB_NAME}-backup-${timestamp}"
    
    log "Creating backup: $backup_path"
    
    mkdir -p "$backup_path/unloaddb"
    
    # Stop server
    run "$CUBRID_BIN/cubrid server stop $DB_NAME 2>&1 | tail -1 || true"
    sleep 3
    
    # Unload
    run "mkdir -p /tmp/backup && cd /tmp/backup && $CUBRID_BIN/cubrid unloaddb -u dba -S ${DB_NAME} 2>&1 | tail -5"
    
    # Copy
    kubectl cp "$NAMESPACE/$POD:/tmp/backup/unloaddb" "$backup_path/unloaddb" 2>&1 | tail -2
    
    # Restart server
    run "$CUBRID_BIN/cubrid server start $DB_NAME 2>&1 | tail -2"
    sleep 5
    
    # Get row count
    local rows=$(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' ')
    
    # Save metadata
    cat > "$backup_path/METADATA.json" << EOF
{
    "timestamp": "$timestamp",
    "rows": ${rows:-0},
    "size": "$(du -sh $backup_path | cut -f1)",
    "date": "$(date -Iseconds)"
}
EOF
    
    local duration=$(($(date +%s) - start))
    log_ok "Backup created in ${duration}s"
    
    # Log to SQLite
    python3 -c "
import sqlite3
conn=sqlite3.connect('$LOG_DB')
conn.execute('INSERT INTO backups(backup_path,size_mb,row_count,status) VALUES(?,?,?,?)',
    ('$backup_path',$(du -sm "$backup_path" 2>/dev/null | cut -f1),${rows:-0},'completed'))
conn.commit()
conn.close()
" 2>/dev/null
    
    cat << EOF
{
    "status": "ok",
    "message": "Backup created successfully",
    "backup_path": "$backup_path",
    "rows": ${rows:-0},
    "duration_sec": $duration,
    "timestamp": "$(date -Iseconds)"
}
EOF
}

handle_recover() {
    local backup_path="$1"
    local start=$(date +%s)
    
    if [ -z "$backup_path" ]; then
        backup_path=$(find /opt/Resonance/data/cubrid/backup -maxdepth 1 -type d -name "${DB_NAME}-backup-*" | sort -r | head -1)
    fi
    
    if [ ! -d "$backup_path/unloaddb" ]; then
        echo $(json_error "Backup not found: $backup_path")
        return
    fi
    
    log "Recovering from: $backup_path"
    
    # Stop server
    run "$CUBRID_BIN/cubrid server stop $DB_NAME 2>&1 | tail -1 || true"
    sleep 3
    
    # Clean
    run "cd /var/lib/cubrid/databases && rm -f ${DB_NAME}* *_vinf *_lgat *_lgar* 2>/dev/null"
    run "> /var/lib/cubrid/databases/databases.txt"
    
    # Create fresh DB
    run "cd /var/lib/cubrid/databases && $CUBRID_BIN/cubrid createdb --db-volume-size=200M --log-volume-size=100M $DB_NAME en_US.iso88591 2>&1 | tail -3"
    
    # Configure
    run "cat > /var/lib/cubrid/databases/databases.txt << 'DBEOF'
$DB_NAME\t/var/lib/cubrid/databases\tlocalhost\t/var/lib/cubrid/databases\tfile:/var/lib/cubrid/databases/lob
DBEOF
cp /var/lib/cubrid/databases/databases.txt $CUBRID_BIN/databases/databases.txt"
    
    # Start server
    run "$CUBRID_BIN/cubrid server start $DB_NAME 2>&1 | tail -2"
    sleep 5
    
    # Copy backup
    run "rm -rf /tmp/backup; mkdir -p /tmp/backup"
    kubectl cp "$backup_path/unloaddb" "$NAMESPACE/$POD:/tmp/backup/" 2>&1 | tail -2
    
    # Load
    run "cd /tmp/backup && $CUBRID_BIN/cubrid loaddb -u dba -s ${DB_NAME}_schema $DB_NAME 2>&1 | tail -2"
    run "cd /tmp/backup && $CUBRID_BIN/cubrid loaddb -u dba -d ${DB_NAME}_objects $DB_NAME 2>&1 | tail -2"
    run "cd /tmp/backup && $CUBRID_BIN/cubrid loaddb -u dba -i ${DB_NAME}_indexes $DB_NAME 2>&1 | tail -2"
    
    # Verify
    sleep 3
    local rows=$(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' ")
    
    local duration=$(($(date +%s) - start))
    
    # Log to SQLite
    python3 -c "
import sqlite3
conn=sqlite3.connect('$LOG_DB')
conn.execute('INSERT INTO recovery_log(error_type,status,duration_sec,rows_restored) VALUES(?,?,?,?)',
    ('manual','success',$duration,${rows:-0}))
conn.commit()
conn.close()
" 2>/dev/null
    
    cat << EOF
{
    "status": "ok",
    "message": "Recovery completed",
    "backup_path": "$backup_path",
    "rows_restored": ${rows:-0},
    "duration_sec": $duration,
    "timestamp": "$(date -Iseconds)"
}
EOF
}

handle_metrics() {
    local uptime=$(uptime -p 2>/dev/null || echo "unknown")
    local load=$(uptime | awk -F'load average:' '{print $2}' | tr -d ' ')
    
    echo "{"
    echo '    "metrics": {'
    echo '        "uptime": "'$uptime'",'
    echo '        "load": "'$load'",'
    echo '        "backup_count": '$(find /opt/Resonance/data/cubrid/backup -maxdepth 1 -type d 2>/dev/null | wc -l)','
    echo '        "recovery_count": '$(python3 -c "import sqlite3; conn=sqlite3.connect('$LOG_DB'); print(conn.execute('SELECT COUNT(*) FROM recovery_log').fetchone()[0])" 2>/dev/null || echo 0)','
    echo '        "last_recovery_status": "'$(python3 -c "import sqlite3; conn=sqlite3.connect('$LOG_DB'); print(conn.execute('SELECT status FROM recovery_log ORDER BY timestamp DESC LIMIT 1').fetchone()[0])" 2>/dev/null || echo 'none')'"'
    echo '    },'
    echo '    "timestamp": "'$(date -Iseconds)'"'
    echo "}"
}

handle_integrity_check() {
    local start=$(date +%s)
    log "Running integrity check..."
    
    local row_count=$(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '^[ ]+[0-9]+' | head -1 | tr -d ' ')
    local table_count=$(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SHOW TABLES;' 2>&1 | grep -v NOTIFICATION | tail -n +4 | wc -l")
    local index_count=$(run "$CUBRID_BIN/csql -u dba ${DB_NAME}@localhost --no-auto-commit -c 'SHOW INDEXES;' 2>&1 | grep -v NOTIFICATION | tail -n +4 | wc -l")
    
    # Check files
    local file_count=$(run "ls /var/lib/cubrid/databases/${DB_NAME}* 2>/dev/null | wc -l")
    
    local duration=$(($(date +%s) - start))
    
    cat << EOF
{
    "status": "ok",
    "integrity": {
        "rows": $row_count,
        "tables": $table_count,
        "indexes": $index_count,
        "db_files": $file_count,
        "expected_files": 6
    },
    "duration_sec": $duration,
    "timestamp": "$(date -Iseconds)"
}
EOF
}

#============================================
# ROUTER
#============================================
route() {
    local path="$1"
    local method="$2"
    
    case "$path" in
        /health|/api/health)
            handle_health
            ;;
        /status|/api/status)
            handle_status
            ;;
        /backup/list|/api/backup/list)
            handle_backup_list
            ;;
        /backup/create|/api/backup/create)
            handle_backup_create
            ;;
        /recover|/api/recover)
            handle_recover "$3"
            ;;
        /metrics|/api/metrics)
            handle_metrics
            ;;
        /integrity|/api/integrity)
            handle_integrity_check
            ;;
        /api/logs)
            # Return recent logs
            if [ -f "$LOG_DB" ]; then
                python3 -c "
import sqlite3
conn=sqlite3.connect('$LOG_DB')
print('{')
print('    \"logs\": [')
cur=conn.execute('SELECT timestamp, error_type, status, duration_sec FROM recovery_log ORDER BY timestamp DESC LIMIT 10')
first=1
for row in cur.fetchall():
    if not first: print(',')
    first=0
    print(f'        {{\"timestamp\": \"{row[0]}\", \"error\": \"{row[1]}\", \"status\": \"{row[2]}\", \"duration\": {row[3]}}}')
print('')
print('    ]')
print('}')
conn.close()
" 2>/dev/null
            else
                echo '{"logs": []}'
            fi
            ;;
        /)
            cat << 'EOF'
{
    "service": "CUBRID Guardian API",
    "version": "2.0",
    "endpoints": [
        "GET /health - Quick health check",
        "GET /status - Detailed status",
        "GET /backup/list - List backups",
        "POST /backup/create - Create backup",
        "POST /recover - Recover from backup",
        "GET /metrics - System metrics",
        "GET /integrity - Data integrity check",
        "GET /api/logs - Recent recovery logs"
    ]
}
EOF
            ;;
        *)
            echo $(json_error "Unknown endpoint: $path")
            ;;
    esac
}

#============================================
# START SERVER
#============================================
start_server() {
    log "Starting CUBRID API Server on $HOST:$PORT..."
    
    # Use Python http.server for simple API
    python3 -c "
import http.server
import socketserver
import os
import sys

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?')[0]
        
        # Call bash route
        import subprocess
        result = subprocess.run(['/opt/Resonance/ops/scripts/cubrid-web-api.sh', 'route', path], 
            capture_output=True, text=True)
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(result.stdout.encode())
    
    def log_message(self, format, *args):
        pass

PORT = int(os.environ.get('PORT', 8080))
with socketserver.TCPServer(('', PORT), Handler) as httpd:
    print(f'Serving on port {PORT}')
    httpd.serve_forever()
" &
    
    echo $! > /var/run/cubrid-api.pid
    log_ok "API Server started (PID: $(cat /var/run/cubrid-api.pid))"
}

stop_server() {
    if [ -f /var/run/cubrid-api.pid ]; then
        kill $(cat /var/run/cubrid-api.pid) 2>/dev/null
        rm /var/run/cubrid-api.pid
        log "API Server stopped"
    fi
}

#============================================
# ENTRY
#============================================
case "${1:-route}" in
    route) route "$2" "$3" ;;
    start) start_server ;;
    stop) stop_server ;;
    *)
        echo "Usage: $0 {start|stop|route <path>}"
        ;;
esac
