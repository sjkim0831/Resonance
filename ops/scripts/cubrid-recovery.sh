#!/usr/bin/env bash
#===========================================
# CUBRID Recovery & Re-installation Script
# For when CUBRID DB is completely lost
#===========================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_SOURCE="$ROOT_DIR/db/data/latest"
SCHEMA_FILE="$ROOT_DIR/db/migrations/flyway/V1__baseline_schema.sql"
KUBECTL="kubectl -n carbonet-prod"

log() { echo "[$(date '+%Y-%m-%dT%H:%M:%S')] [CUBRID-RECOVER] $*"; }

#===========================================
# Step 1: Check PVC exists
#===========================================
check_pvc() {
    log "=== Checking PVC ==="

    local pvc_name=$($KUBECTL get pvc | grep cubrid | awk '{print $1}' | head -1)

    if [[ -z "$pvc_name" ]]; then
        log "ERROR: No CUBRID PVC found"
        exit 1
    fi

    log "PVC found: $pvc_name"

    local pvc_status=$($KUBECTL get pvc "$pvc_name" -o jsonpath='{.status.phase}')
    log "PVC status: $pvc_status"

    if [[ "$pvc_status" != "Bound" ]]; then
        log "ERROR: PVC not bound"
        exit 1
    fi
}

#===========================================
# Step 2: Delete corrupted StatefulSet/PVC
#===========================================
cleanup() {
    log "=== Cleaning up corrupted resources ==="

    # Stop the pod
    log "Deleting current pod..."
    $KUBECTL delete pod cubrid-carbonet-0 --grace-period=0 2>/dev/null || true

    # Wait for deletion
    sleep 5

    # Note: We keep PVC to preserve data
    log "Cleanup complete (PVC preserved)"
}

#===========================================
# Step 3: Recreate CUBRID StatefulSet
#===========================================
recreate_statefulset() {
    log "=== Recreating CUBRID StatefulSet ==="

    # Delete existing
    $KUBECTL delete statefulset cubrid-carbonet --cascade=false 2>/dev/null || true
    $KUBECTL delete service cubrid-carbonet 2>/dev/null || true

    wait

    # Apply StatefulSet manifest
    cat << 'EOF' | $KUBECTL apply -f -
apiVersion: v1
kind: Service
metadata:
  name: cubrid-carbonet
  namespace: carbonet-prod
spec:
  clusterIP: None
  selector:
    app: cubrid-carbonet
  ports:
  - port: 33000
    targetPort: 33000
    protocol: TCP
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: cubrid-carbonet
  namespace: carbonet-prod
spec:
  serviceName: cubrid-carbonet
  replicas: 1
  selector:
    matchLabels:
      app: cubrid-carbonet
  template:
    metadata:
      labels:
        app: cubrid-carbonet
    spec:
      terminationGracePeriodSeconds: 30
      securityContext:
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
      initContainers:
      - name: cleanup-cubrid-ipc
        image: busybox:1.36
        securityContext:
          privileged: true
        command:
        - sh
        - -c
        - |
          echo "=== CUBRID IPC cleanup ==="
          mkdir -p /var/lib/cubrid/databases
          mkdir -p /var/lib/cubrid/carbonet/databases
          mkdir -p /var/lib/cubrid/carbonet/log
          mkdir -p /var/lib/cubrid/carbonet/databases/lob

          # Clean IPC
          for pid in /proc/[0-9]*; do
            if [ -L "$pid/exe" ]; then
              target=$(readlink "$pid/exe" 2>/dev/null)
              if [[ "$target" == *cubrid* ]]; then
                kill -9 $(basename $pid) 2>/dev/null || true
              fi
            fi
          done

          # SHM cleanup
          for seg in $(ipcs -m 2>/dev/null | grep "0x0003" | awk '{print $2}'); do
            ipcrm -m $seg 2>/dev/null || true
          done

          # Semaphore cleanup
          for sem in $(ipcs -s 2>/dev/null | grep "0x0003" | awk '{print $2}'); do
            ipcrm -s $sem 2>/dev/null || true
          done

          # Create databases.txt
          echo "carbonet /var/lib/cubrid/carbonet/databases carbonet localhost /var/lib/cubrid/carbonet/databases file:/var/lib/cubrid/carbonet/databases/lob" > /var/lib/cubrid/databases/databases.txt
          chmod 644 /var/lib/cubrid/databases/databases.txt
          echo "=== IPC cleanup complete ==="
        volumeMounts:
        - name: cubrid-data
          mountPath: /var/lib/cubrid
      containers:
      - name: cubrid
        image: docker.io/cubrid/cubrid:11.4
        command:
        - sh
        - -c
        - |
          echo "=== CUBRID container starting ==="

          chmod 644 /var/lib/cubrid/databases/databases.txt 2>/dev/null || true

          export CUBRID=/home/cubrid/CUBRID
          export PATH=$CUBRID/bin:$PATH
          export LD_LIBRARY_PATH=$CUBRID/lib:$LD_LIBRARY_PATH

          echo "=== Starting CUBRID service ==="
          cubrid service start

          sleep 5

          # Check if database exists
          if ! cubrid server status carbonet >/dev/null 2>&1; then
            echo "=== Creating database ==="
            cubrid createdb carbonet ko_KR.utf8 --db-volume-size=500M || true
          fi

          cubrid server start carbonet 2>/dev/null || true
          cubrid broker start 2>/dev/null || true

          echo "=== CUBRID service status ==="
          cubrid service status

          chmod 444 /var/lib/cubrid/databases/databases.txt 2>/dev/null || true

          echo "=== CUBRID running, waiting ==="
          tail -f /dev/null
        ports:
        - containerPort: 33000
          protocol: TCP
        resources:
          limits:
            cpu: "2"
            memory: 4Gi
          requests:
            cpu: 250m
            memory: 1Gi
        stdin: true
        tty: true
        volumeMounts:
        - name: cubrid-data
          mountPath: /var/lib/cubrid
      volumes:
      - name: cubrid-data
        persistentVolumeClaim:
          claimName: cubrid-pvc
EOF

    log "StatefulSet created"
}

#===========================================
# Step 4: Wait for CUBRID to be ready
#===========================================
wait_ready() {
    log "=== Waiting for CUBRID to be ready ==="

    local max_attempts=30
    local attempt=0

    while [[ $attempt -lt $max_attempts ]]; do
        ((attempt++))

        if $KUBECTL exec cubrid-carbonet-0 -- cubrid server status carbonet >/dev/null 2>&1; then
            log "CUBRID is ready"
            return 0
        fi

        echo -n "."
        sleep 5
    done

    echo ""
    log "WARNING: CUBRID not ready after ${max_attempts} attempts"
    return 1
}

#===========================================
# Step 5: Restore data from Git backup
#===========================================
restore_data() {
    log "=== Restoring data from Git backup ==="

    if [[ ! -d "$BACKUP_SOURCE" ]]; then
        log "WARNING: No backup source found at $BACKUP_SOURCE"
        log "Run 'git pull' to get the latest backup"
        return 1
    fi

    local table_count
    table_count=$(ls "$BACKUP_SOURCE"/*.json 2>/dev/null | grep -v manifest | wc -l)

    log "Found $table_count tables to restore"

    # Restore each table
    for file in "$BACKUP_SOURCE"/*.json; do
        [[ -f "$file" ]] || continue
        table=$(basename "$file" .json)

        if [[ "$table" == "manifest" ]]; then
            continue
        fi

        log "Restoring: $table"

        python3 - << PYTHON
import json
import subprocess

with open('$file', 'r') as f:
    data = json.load(f)

table = data['table']
rows = data.get('rows', [])

if not rows:
    # Empty table - just truncate
    subprocess.run([
        'kubectl', 'exec', 'cubrid-carbonet-0', '-n', 'carbonet-prod', '--',
        'csql', '-u', 'dba', 'carbonet', '-c', f'TRUNCATE {table};'
    ], capture_output=True)
    print(f"  Truncated (empty)")
else:
    cols = list(rows[0].keys())
    vals_list = []
    for row in rows:
        vals = []
        for c in cols:
            v = row.get(c)
            if v is None or v == '':
                vals.append('NULL')
            else:
                vals.append(f"'{v.replace(\"'\", \"''\")}'")
        vals_list.append(f"({', '.join(vals)})")

    batch_size = 500
    for i in range(0, len(vals_list), batch_size):
        batch = vals_list[i:i+batch_size]
        sql = f"INSERT INTO {table} ({', '.join(cols)}) VALUES {', '.join(batch)};"
        result = subprocess.run([
            'kubectl', 'exec', 'cubrid-carbonet-0', '-n', 'carbonet-prod', '--',
            'csql', '-u', 'dba', 'carbonet', '-c', sql
        ], capture_output=True, text=True)

        if result.returncode != 0:
            print(f"  Error: {result.stderr[:100]}")

    print(f"  Restored {len(rows)} rows")
PYTHON
    done

    log "Data restore complete"
}

#===========================================
# Step 6: Verify restore
#===========================================
verify() {
    log "=== Verifying restore ==="

    local table_count
    table_count=$($KUBECTL exec cubrid-carbonet-0 -- \
        csql -u dba carbonet -c "SELECT COUNT(*) FROM db_class WHERE owner_name = 'dba';" 2>/dev/null | \
        grep -v "^==" | grep -v "^$" | awk 'NR==2{print $1}')

    log "Tables in DB: $table_count"

    local row_count
    row_count=$($KUBECTL exec cubrid-carbonet-0 -- \
        csql -u dba carbonet -c "SELECT SUM(C) FROM (SELECT COUNT(*) C FROM db_class WHERE owner_name = 'dba' GROUP BY class_name);" 2>/dev/null | \
        grep -v "^==" | tail -1)

    log "Total rows: estimated from table count"
}

#===========================================
# Full recovery process
#===========================================
full_recovery() {
    log "=== Starting FULL CUBRID Recovery ==="

    check_pvc
    cleanup
    recreate_statefulset

    # Wait for pod to start
    log "Waiting for pod to start..."
    $KUBECTL wait --for=condition=Ready pod/cubrid-carbonet-0 --timeout=120s 2>/dev/null || {
        log "Pod not ready, checking status..."
        $KUBECTL get pod cubrid-carbonet-0
    }

    wait_ready
    verify

    # Ask about data restore
    read -p "Restore data from Git backup? (yes/no): " confirm
    if [[ "$confirm" == "yes" ]]; then
        restore_data
    fi

    log "=== CUBRID Recovery Complete ==="
}

#===========================================
# Quick check
#===========================================
check() {
    log "=== CUBRID Status Check ==="

    if $KUBECTL exec cubrid-carbonet-0 -- cubrid server status carbonet >/dev/null 2>&1; then
        log "CUBRID Server: RUNNING"
    else
        log "CUBRID Server: NOT RUNNING"
    fi

    if $KUBECTL exec cubrid-carbonet-0 -- cubrid broker status >/dev/null 2>&1; then
        log "CUBRID Broker: RUNNING"
    else
        log "CUBRID Broker: NOT RUNNING"
    fi

    local table_count
    table_count=$($KUBECTL exec cubrid-carbonet-0 -- \
        csql -u dba carbonet -c "SELECT COUNT(*) FROM db_class;" 2>/dev/null | \
        grep -v "^==" | awk 'NR==2{print $1}' || echo "ERROR")

    log "Tables: $table_count"

    # Check backup
    if [[ -d "$BACKUP_SOURCE" ]]; then
        local backup_tables
        backup_tables=$(ls "$BACKUP_SOURCE"/*.json 2>/dev/null | grep -v manifest | wc -l)
        log "Git Backup Tables: $backup_tables"
    else
        log "Git Backup: NOT FOUND"
    fi
}

#===========================================
# Main
#===========================================
case "${1:-}" in
    recover|full)
        full_recovery
        ;;
    check|status)
        check
        ;;
    restore)
        restore_data
        ;;
    cleanup)
        cleanup
        ;;
    recreate)
        recreate_statefulset
        ;;
    *)
        echo "CUBRID Recovery Script"
        echo ""
        echo "Usage: $0 {recover|check|restore|cleanup|recreate}"
        echo ""
        echo "Commands:"
        echo "  recover  - Full recovery (cleanup + recreate + restore)"
        echo "  check    - Check CUBRID status"
        echo "  restore  - Restore data from Git backup"
        echo "  cleanup  - Clean up corrupted resources"
        echo "  recreate - Recreate StatefulSet only"
        ;;
esac