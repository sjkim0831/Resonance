#!/bin/bash
#============================================
# CUBRID Multi-Tenant Support v2
# - Independent backup per customer
# - Isolated recovery
# - Per-customer alerting
#============================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

LOG_DB="/opt/Resonance/var/lib/cubrid_operations.db"
TENANT_BASE="/opt/Resonance/data/cubrid/tenants"
TENANT_DB="$TENANT_BASE/tenants.sqlite"
ALERTER="/opt/Resonance/ops/scripts/cubrid-alerter.sh"

mkdir -p "$TENANT_BASE"

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
log_ok() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1"; }
log_err() { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1"; }

#============================================
# INIT TENANT DB
#============================================
init_tenant_db() {
    python3 << 'EOFPY'
import sqlite3
import os
os.makedirs('/opt/Resonance/data/cubrid/tenants', exist_ok=True)
conn = sqlite3.connect('/opt/Resonance/data/cubrid/tenants/tenants.sqlite')
c = conn.cursor()

c.execute('''CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    db_name TEXT NOT NULL,
    namespace TEXT DEFAULT 'carbonet-prod',
    pod_name TEXT DEFAULT 'cubrid-carbonet-0',
    backup_dir TEXT,
    alert_email TEXT,
    slack_webhook TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
)''')

c.execute('''CREATE TABLE IF NOT EXISTS tenant_backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER,
    backup_path TEXT,
    size_mb INTEGER,
    row_count INTEGER,
    status TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
)''')

c.execute('''CREATE TABLE IF NOT EXISTS tenant_recoveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER,
    backup_id INTEGER,
    status TEXT,
    duration_sec INTEGER,
    rows_restored INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
)''')

conn.commit()
conn.close()
print("Tenant database initialized")
EOFPY
}

#============================================
# TENANT MANAGEMENT
#============================================
add_tenant() {
    local name="$1"
    local db_name="${2:-carbonet}"
    local namespace="${3:-carbonet-prod}"
    local pod="${4:-cubrid-carbonet-0}"
    
    if [ -z "$name" ]; then
        echo "Usage: $0 add-tenant <name> <db_name> [namespace] [pod]"
        return 1
    fi
    
    local backup_dir="$TENANT_BASE/$name/backup"
    mkdir -p "$backup_dir"
    
    python3 << EOFPY
import sqlite3
conn = sqlite3.connect('$TENANT_DB')
conn.execute('''INSERT INTO tenants (name, db_name, namespace, pod_name, backup_dir)
    VALUES (?, ?, ?, ?, ?)''',
    ('$name', '$db_name', '$namespace', '$pod', '$backup_dir'))
conn.commit()
conn.close()
EOFPY
    
    log_ok "Tenant added: $name (db: $db_name)"
}

list_tenants() {
    echo "╔═══════════════════════════════════════════════════════════════════════════╗"
    echo "║                           TENANTS                                          ║"
    echo "╠═════════╤══════════════╤═════════╤══════════╤════════╤═════════════════════╣"
    printf "║ %-7s │ %-12s │ %-7s │ %-8s │ %-6s │ %-s ║\n" "ID" "Name" "DB" "Status" "Backups" "Last Recovery"
    echo "╠═════════╪══════════════╪═════════╪══════════╪════════╪═════════════════════╣"
    
    python3 << 'EOFPY'
import sqlite3
conn = sqlite3.connect('$TENANT_DB')
cur = conn.execute('''SELECT t.id, t.name, t.db_name, t.status,
    (SELECT COUNT(*) FROM tenant_backups WHERE tenant_id=t.id),
    (SELECT datetime(created_at) FROM tenant_recoveries WHERE tenant_id=t.id ORDER BY created_at DESC LIMIT 1)
    FROM tenants t ORDER BY t.name''')

for row in cur.fetchall():
    last_recovery = row[5] if row[5] else "Never"
    print(f"║ {row[0]:<7} │ {row[1]:<12} │ {row[2]:<7} │ {row[3]:<8} │ {row[4]:<6} │ {last_recovery} ║")
conn.close()
EOFPY
    
    echo "╚═════════╧══════════════╧═════════╧══════════╧════════╧═════════════════════╝"
}

#============================================
# PER-TENANT BACKUP
#============================================
backup_tenant() {
    local tenant_name="$1"
    
    if [ -z "$tenant_name" ]; then
        echo "Usage: $0 backup-tenant <tenant_name>"
        return 1
    fi
    
    local tenant_info=$(python3 -c "
import sqlite3
conn = sqlite3.connect('$TENANT_DB')
cur = conn.execute('SELECT id, db_name, namespace, pod_name, backup_dir FROM tenants WHERE name=?', ('$tenant_name',))
row = cur.fetchone()
if row:
    print(f'{row[0]}|{row[1]}|{row[2]}|{row[3]}|{row[4]}')
conn.close()
" 2>/dev/null)
    
    if [ -z "$tenant_info" ]; then
        log_err "Tenant not found: $tenant_name"
        return 1
    fi
    
    local tenant_id=$(echo "$tenant_info" | cut -d'|' -f1)
    local db_name=$(echo "$tenant_info" | cut -d'|' -f2)
    local namespace=$(echo "$tenant_info" | cut -d'|' -f3)
    local pod=$(echo "$tenant_info" | cut -d'|' -f4)
    local backup_dir=$(echo "$tenant_info" | cut -d'|' -f5)
    
    log "Starting backup for tenant: $tenant_name"
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="$backup_dir/backup-$timestamp"
    local start=$(date +%s)
    
    mkdir -p "$backup_path/unloaddb"
    
    # Stop server
    kubectl exec "$pod" -n "$namespace" -- bash -c "export CUBRID=/home/cubrid/CUBRID && \$CUBRID/bin/cubrid server stop $db_name 2>&1 | tail -1 || true"
    sleep 3
    
    # Unload
    kubectl exec "$pod" -n "$namespace" -- bash -c "mkdir -p /tmp/backup && cd /tmp/backup && export CUBRID=/home/cubrid/CUBRID && \$CUBRID/bin/cubrid unloaddb -u dba -S ${db_name} 2>&1 | tail -5"
    
    # Copy
    kubectl cp "$namespace/$pod:/tmp/backup/unloaddb" "$backup_path/unloaddb" 2>&1 | tail -2
    
    # Restart server
    kubectl exec "$pod" -n "$namespace" -- bash -c "export CUBRID=/home/cubrid/CUBRID && \$CUBRID/bin/cubrid server start $db_name 2>&1 | tail -2"
    sleep 5
    
    # Get row count
    local rows=$(kubectl exec "$pod" -n "$namespace" -- bash -c "export CUBRID=/home/cubrid/CUBRID && \$CUBRID/bin/csql -u dba ${db_name}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '[0-9]+' | head -1 | tr -d ' ")
    
    # Save metadata
    cat > "$backup_path/METADATA.json" << EOF
{
    "tenant": "$tenant_name",
    "tenant_id": $tenant_id,
    "db_name": "$db_name",
    "timestamp": "$timestamp",
    "rows": ${rows:-0},
    "size": "$(du -sh $backup_path | cut -f1)"
}
EOF
    
    # Log to DB
    python3 << EOFPY
import sqlite3
conn = sqlite3.connect('$TENANT_DB')
conn.execute('INSERT INTO tenant_backups (tenant_id, backup_path, size_mb, row_count, status) VALUES (?, ?, ?, ?, ?)',
    ($tenant_id, '$backup_path', $(du -sm "$backup_path" 2>/dev/null | cut -f1), ${rows:-0}, 'completed'))
conn.commit()
conn.close()
EOFPY
    
    local duration=$(($(date +%s) - start))
    log_ok "Backup complete: ${duration}s (rows: ${rows:-0})"
    
    # Alert if configured
    local alert_email=$(python3 -c "import sqlite3; conn=sqlite3.connect('$TENANT_DB'); r=conn.execute('SELECT alert_email FROM tenants WHERE name=?',('$tenant_name',)).fetchone(); print(r[0] if r else ''); conn.close()" 2>/dev/null)
    if [ -n "$alert_email" ]; then
        $ALERTER backup-success "$backup_path" "$(du -sh $backup_path | cut -f1)"
    fi
}

#============================================
# PER-TENANT RECOVERY
#============================================
recover_tenant() {
    local tenant_name="$1"
    local backup_path="$2"
    
    if [ -z "$tenant_name" ]; then
        echo "Usage: $0 recover-tenant <tenant_name> [backup_path]"
        return 1
    fi
    
    local tenant_info=$(python3 -c "
import sqlite3
conn = sqlite3.connect('$TENANT_DB')
cur = conn.execute('SELECT id, db_name, namespace, pod_name FROM tenants WHERE name=?', ('$tenant_name',))
row = cur.fetchone()
if row:
    print(f'{row[0]}|{row[1]}|{row[2]|{row[3]}')
conn.close()
" 2>/dev/null)
    
    if [ -z "$tenant_info" ]; then
        log_err "Tenant not found: $tenant_name"
        return 1
    fi
    
    local tenant_id=$(echo "$tenant_info" | cut -d'|' -f1)
    local db_name=$(echo "$tenant_info" | cut -d'|' -f2)
    local namespace=$(echo "$tenant_info" | cut -d'|' -f3)
    local pod=$(echo "$tenant_info" | cut -d'|' -f4)
    
    if [ -z "$backup_path" ]; then
        backup_path=$(python3 -c "
import sqlite3
conn = sqlite3.connect('$TENANT_DB')
cur = conn.execute('SELECT backup_path FROM tenant_backups WHERE tenant_id=? ORDER BY created_at DESC LIMIT 1', ($tenant_id,))
row = cur.fetchone()
print(row[0] if row else '')
conn.close()
" 2>/dev/null)
    fi
    
    if [ ! -d "$backup_path/unloaddb" ]; then
        log_err "Backup not found: $backup_path"
        return 1
    fi
    
    log "Recovering tenant: $tenant_name from $backup_path"
    
    local start=$(date +%s)
    
    # Stop server
    kubectl exec "$pod" -n "$namespace" -- bash -c "export CUBRID=/home/cubrid/CUBRID && \$CUBRID/bin/cubrid server stop $db_name 2>&1 | tail -1 || true"
    sleep 3
    
    # Clean
    kubectl exec "$pod" -n "$namespace" -- bash -c "cd /var/lib/cubrid/databases && rm -f ${db_name}* *_vinf *_lgat *_lgar* 2>/dev/null || true"
    kubectl exec "$pod" -n "$namespace" -- bash -c "> /var/lib/cubrid/databases/databases.txt"
    
    # Create DB
    kubectl exec "$pod" -n "$namespace" -- bash -c "export CUBRID=/home/cubrid/CUBRID && cd /var/lib/cubrid/databases && \$CUBRID/bin/cubrid createdb --db-volume-size=200M --log-volume-size=100M $db_name en_US.iso88591 2>&1 | tail -3"
    
    # Configure
    kubectl exec "$pod" -n "$namespace" -- bash -c "export CUBRID=/home/cubrid/CUBRID && cat > /var/lib/cubrid/databases/databases.txt << EOF
${db_name}\t/var/lib/cubrid/databases\tlocalhost\t/var/lib/cubrid/databases\tfile:/var/lib/cubrid/databases/lob
EOF
cp /var/lib/cubrid/databases/databases.txt \$CUBRID/databases/databases.txt"
    
    # Start server
    kubectl exec "$pod" -n "$namespace" -- bash -c "export CUBRID=/home/cubrid/CUBRID && \$CUBRID/bin/cubrid server start $db_name 2>&1 | tail -2"
    sleep 5
    
    # Copy backup
    kubectl exec "$pod" -n "$namespace" -- bash -c "rm -rf /tmp/backup; mkdir -p /tmp/backup"
    kubectl cp "$backup_path/unloaddb" "$namespace/$pod:/tmp/backup/" 2>&1 | tail -2
    
    # Load
    kubectl exec "$pod" -n "$namespace" -- bash -c "export CUBRID=/home/cubrid/CUBRID && cd /tmp/backup && \$CUBRID/bin/cubrid loaddb -u dba -s ${db_name}_schema $db_name 2>&1 | tail -2"
    kubectl exec "$pod" -n "$namespace" -- bash -c "export CUBRID=/home/cubrid/CUBRID && cd /tmp/backup && \$CUBRID/bin/cubrid loaddb -u dba -d ${db_name}_objects $db_name 2>&1 | tail -2"
    kubectl exec "$pod" -n "$namespace" -- bash -c "export CUBRID=/home/cubrid/CUBRID && cd /tmp/backup && \$CUBRID/bin/cubrid loaddb -u dba -i ${db_name}_indexes $db_name 2>&1 | tail -2"
    
    # Verify
    sleep 3
    local rows=$(kubectl exec "$pod" -n "$namespace" -- bash -c "export CUBRID=/home/cubrid/CUBRID && \$CUBRID/bin/csql -u dba ${db_name}@localhost --no-auto-commit -c 'SELECT COUNT(*) FROM admin_emission_gwp_value;' 2>&1 | grep -E '[0-9]+' | head -1 | tr -d ' ")
    
    local duration=$(($(date +%s) - start))
    
    # Log
    python3 << EOFPY
import sqlite3
conn = sqlite3.connect('$TENANT_DB')
conn.execute('INSERT INTO tenant_recoveries (tenant_id, backup_id, status, duration_sec, rows_restored) VALUES (?, ?, ?, ?, ?)',
    ($tenant_id, NULL, 'success', $duration, ${rows:-0}))
conn.commit()
conn.close()
EOFPY
    
    log_ok "Recovery complete: ${duration}s (rows: ${rows:-0})"
    
    # Alert
    $ALERTER recovery-success "$duration" "${rows:-0}"
}

#============================================
# ENTRY
#============================================
case "${1:-help}" in
    init) init_tenant_db ;;
    add-tenant) add_tenant "$2" "$3" "$4" "$5" ;;
    list-tenants) list_tenants ;;
    backup-tenant) backup_tenant "$2" ;;
    recover-tenant) recover_tenant "$2" "$3" ;;
    *)
        echo "Usage: $0 {init|add-tenant|list-tenants|backup-tenant|recover-tenant}"
        ;;
esac
