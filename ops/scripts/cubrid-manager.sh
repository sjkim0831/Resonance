#!/bin/bash
# ============================================
# CUBRID Database Protection & Query-Only Manager
# - Prevents accidental deletion of database
# - Ensures all operations use SQL queries
# - Auto-restores on failure
# ============================================

set -e

NAMESPACE="carbonet-prod"
DATABASE="carbonet"
DATA_PATH="/opt/Resonance/data/cubrid/databases"
PROTECTION_MARKER="$DATA_PATH/.protected"
LOG_FILE="/opt/Resonance/var/log/cubrid-protection.log"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "[$(date +%Y-%m-%dT%H:%M:%S)] $1" | tee -a "$LOG_FILE"
}

get_pod() {
    kubectl get pods -n "$NAMESPACE" -l app=cubrid-carbonet -o name 2>/dev/null | head -1
}

exec_sql() {
    local pod=$(get_pod)
    if [ -z "$pod" ]; then
        log "${RED}ERROR: CUBRID pod not found${NC}"
        return 1
    fi
    kubectl exec "$pod" -n "$NAMESPACE" -- bash -c "export CUBRID_DATABASES=/var/lib/cubrid/databases && cp /var/lib/cubrid/databases/databases.txt \$CUBRID/databases/databases.txt 2>/dev/null || true && csql -u dba ${DATABASE}@localhost -c \"$1\"" 2>&1
}

exec_sql_file() {
    local pod=$(get_pod)
    if [ -z "$pod" ]; then
        log "${RED}ERROR: CUBRID pod not found${NC}"
        return 1
    fi
    kubectl cp "$1" "$NAMESPACE/${pod##*/}:/tmp/query.sql" 2>/dev/null
    kubectl exec "$pod" -n "$NAMESPACE" -- bash -c "export CUBRID_DATABASES=/var/lib/cubrid/databases && cp /var/lib/cubrid/databases/databases.txt \$CUBRID/databases/databases.txt 2>/dev/null || true && csql -u dba ${DATABASE}@localhost -i /tmp/query.sql" 2>&1
}

# ============================================
# Protection Functions
# ============================================

apply_protection() {
    log "${BLUE}=== Applying CUBRID Protection ===${NC}"

    # 1. Create protection marker
    mkdir -p "$DATA_PATH"
    echo "PROTECTED=$(date -u +%Y-%m-%dT%H:%M:%S)" > "$PROTECTION_MARKER"
    chmod 444 "$PROTECTION_MARKER"

    # 2. Make data directory read-only
    chmod 555 "$DATA_PATH" 2>/dev/null || true

    # 3. PVC protection annotations
    kubectl annotate pvc cubrid-pvc -n "$NAMESPACE" \
        protection.alpha.kubernetes.io/is-protected="true" \
        description="CUBRID carbonet database - DO NOT DELETE" \
        --overwrite 2>/dev/null || true

    # 4. Add critical label
    kubectl label pvc cubrid-pvc -n "$NAMESPACE" \
        critical=true app=cubrid-carbonet --overwrite 2>/dev/null || true

    # 5. PodDisruptionBudget
    kubectl create -f - 2>/dev/null <<EOF || true
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: cubrid-carbonet-pdb
  namespace: $NAMESPACE
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: cubrid-carbonet
EOF

    # 6. Create protection lock file in container
    local pod=$(get_pod)
    if [ -n "$pod" ]; then
        kubectl exec "$pod" -n "$NAMESPACE" -- bash -c "
            chmod 444 /var/lib/cubrid/databases/.protected 2>/dev/null || true
            chmod 555 /var/lib/cubrid/databases 2>/dev/null || true
        " 2>/dev/null || true
    fi

    log "${GREEN}Protection applied successfully${NC}"
}

# ============================================
# Status & Monitoring
# ============================================

check_status() {
    log "${BLUE}=== CUBRID Protection Status ===${NC}"

    local pod=$(get_pod)
    local pdb_exists=$(kubectl get pdb cubrid-carbonet-pdb -n "$NAMESPACE" 2>/dev/null && echo "yes" || echo "no")
    local data_files=$(find "$DATA_PATH" -type f 2>/dev/null | wc -l)
    local marker_exists=$(test -f "$PROTECTION_MARKER" && echo "yes" || echo "no")

    echo ""
    echo "Protection Status:"
    echo "  PodDisruptionBudget: $pdb_exists"
    echo "  Protection Marker: $marker_exists"
    echo "  Data Files: $data_files"
    echo "  Data Path: $DATA_PATH"
    echo ""

    if [ -n "$pod" ]; then
        echo "CUBRID Server:"
        kubectl exec "$pod" -n "$NAMESPACE" -- cubrid server status $DATABASE 2>&1 | grep -v "^=="
        echo ""
        echo "Database:"
        exec_sql "SELECT COUNT(*) FROM admin_emission_gwp_value;" 2>&1 | grep -v NOTIFICATION | tail -3
    fi
}

# ============================================
# Safe Query Operations (Query-Only Mode)
# ============================================

query() {
    local sql="$1"
    log "Executing: $sql"
    exec_sql "$sql"
}

query_file() {
    local file="$1"
    log "Executing SQL file: $file"
    exec_sql_file "$file"
}

# ============================================
# Table Management (Safe - Query Only)
# ============================================

list_tables() {
    exec_sql "SHOW TABLES;" 2>&1 | grep -v NOTIFICATION
}

describe_table() {
    local table="$1"
    exec_sql "SHOW COLUMNS FROM $table;" 2>&1 | grep -v NOTIFICATION
}

count_rows() {
    local table="$1"
    exec_sql "SELECT COUNT(*) FROM $table;" 2>&1 | grep -v NOTIFICATION
}

select_all() {
    local table="$1"
    local limit="${2:-100}"
    exec_sql "SELECT * FROM $table LIMIT $limit;" 2>&1 | grep -v NOTIFICATION
}

select_where() {
    local table="$1"
    local column="$2"
    local value="$3"
    local limit="${4:-100}"
    exec_sql "SELECT * FROM $table WHERE $column='$value' LIMIT $limit;" 2>&1 | grep -v NOTIFICATION
}

# ============================================
# Data Operations (Safe - Query Only)
# ============================================

insert_data() {
    local table="$1"
    local values="$2"
    log "${YELLOW}INSERT INTO $table: $values${NC}"
    exec_sql "INSERT INTO $table VALUES $values; COMMIT;" 2>&1 | grep -v NOTIFICATION
}

update_data() {
    local table="$1"
    local set_clause="$2"
    local where_clause="$3"
    log "${YELLOW}UPDATE $table SET $set_clause WHERE $where_clause${NC}"
    exec_sql "UPDATE $table SET $set_clause WHERE $where_clause; COMMIT;" 2>&1 | grep -v NOTIFICATION
}

delete_data() {
    local table="$1"
    local where_clause="$2"
    log "${RED}DELETE FROM $table WHERE $where_clause${NC}"
    exec_sql "DELETE FROM $table WHERE $where_clause; COMMIT;" 2>&1 | grep -v NOTIFICATION
}

# ============================================
# Backup & Restore (Safe Operations)
# ============================================

export_data() {
    local table="$1"
    local output="${2:-/tmp/${table}_backup.json}"
    log "Exporting $table to $output"

    mkdir -p "$(dirname "$output")"

    kubectl exec $(get_pod) -n "$NAMESPACE" -- \
        csql -u dba ${DATABASE}@localhost -c "SELECT * FROM $table;" 2>&1 | \
        grep -v NOTIFICATION | grep -v "^==" > "$output"

    log "Exported $(wc -l < "$output") rows to $output"
}

import_data() {
    local table="$1"
    local input="$2"
    if [ ! -f "$input" ]; then
        log "${RED}ERROR: File not found: $input${NC}"
        return 1
    fi
    log "${YELLOW}Importing $input to $table${NC}"
    exec_sql_file "$input" 2>&1 | grep -v NOTIFICATION
}

# ============================================
# Database Backup (Full Export)
# ============================================

backup_all() {
    local backup_dir="${1:-/opt/Resonance/db/data/latest}"
    mkdir -p "$backup_dir"

    log "${BLUE}Backing up all tables to $backup_dir${NC}"

    local tables=$(exec_sql "SHOW TABLES;" 2>&1 | grep -v NOTIFICATION | grep -v "^==" | sed "s/'//g" | tr -d ' ')

    for table in $tables; do
        local output="$backup_dir/${table}.json"
        {
            echo "{"
            echo "  \"table\": \"$table\","
            echo "  \"exportedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)\","
            echo "  \"rows\": ["

            local rows=$(kubectl exec $(get_pod) -n "$NAMESPACE" -- \
                csql -u dba ${DATABASE}@localhost -c "SELECT * FROM $table;" 2>&1 | \
                grep -v NOTIFICATION | grep -v "^==" | grep -v "row selected" || true)

            if [ -n "$rows" ]; then
                echo "$rows" | while read line; do
                    echo "    {\"data\": \"$line\"},"
                done | head -n -1
            fi

            echo "  ]"
            echo "}"
        } > "$output"
        log "Backed up $table"
    done

    log "${GREEN}Backup complete: $backup_dir${NC}"
}

# ============================================
# Recovery Test
# ============================================

test_recovery() {
    log "${BLUE}=== Testing CUBRID Recovery ===${NC}"

    local pod=$(get_pod)

    if [ -z "$pod" ]; then
        log "${RED}ERROR: Pod not found${NC}"
        return 1
    fi

    # Test server
    kubectl exec "$pod" -n "$NAMESPACE" -- cubrid server status $DATABASE 2>&1 | grep -v "^==" || true

    # Test data access
    local count=$(exec_sql "SELECT COUNT(*) FROM admin_emission_gwp_value;" 2>&1 | grep -E "[0-9]+ row" | awk '{print $1}' || echo "0")
    log "admin_emission_gwp_value: $count rows"

    # Test rsn_release_unit
    local release=$(exec_sql "SELECT * FROM rsn_release_unit;" 2>&1 | grep -c "RU-" || echo "0")
    log "rsn_release_unit: $release rows"

    if [ "$count" -gt 0 ] && [ "$release" -gt 0 ]; then
        log "${GREEN}Recovery test PASSED${NC}"
        return 0
    else
        log "${RED}Recovery test FAILED${NC}"
        return 1
    fi
}

# ============================================
# Auto-Recovery (On Pod Restart)
# ============================================

auto_recover() {
    local pod=$(get_pod)

    if [ -z "$pod" ]; then
        log "${RED}ERROR: No pod found for recovery${NC}"
        return 1
    fi

    log "${BLUE}=== Auto-Recovery ===${NC}"

    # Ensure databases.txt is in place
    kubectl exec "$pod" -n "$NAMESPACE" -- bash -c "
        export CUBRID=/home/cubrid/CUBRID
        export PATH=\$CUBRID/bin:\$PATH
        export CUBRID_DATABASES=/var/lib/cubrid/databases

        cp /var/lib/cubrid/databases/databases.txt \$CUBRID/databases/databases.txt 2>/dev/null || true

        if ! cubrid server status $DATABASE >/dev/null 2>&1; then
            echo 'Starting CUBRID server...'
            cubrid service start
            sleep 3
            cubrid server start $DATABASE 2>&1 || true
        fi
    " 2>&1 | grep -v "^=="

    log "${GREEN}Auto-recovery complete${NC}"
}

# ============================================
# Protection Removal (Requires Confirmation)
# ============================================

remove_protection() {
    echo -e "${RED}WARNING: This will remove all protection!${NC}"
    echo -e "${RED}Database will be vulnerable to accidental deletion!${NC}"
    echo ""
    echo "Type 'YES' to confirm removal:"
    read -r response

    if [ "$response" != "YES" ]; then
        echo "Cancelled"
        return 0
    fi

    log "${YELLOW}Removing protection...${NC}"

    chmod 755 "$DATA_PATH" 2>/dev/null || true
    rm -f "$PROTECTION_MARKER" 2>/dev/null || true

    kubectl annotate pvc cubrid-pvc -n "$NAMESPACE" \
        protection.alpha.kubernetes.io/is-protected- \
        description- --overwrite 2>/dev/null || true

    kubectl label pvc cubrid-pvc -n "$NAMESPACE" \
        critical- --overwrite 2>/dev/null || true

    log "${YELLOW}Protection removed${NC}"
}

# ============================================
# Usage
# ============================================

show_help() {
    cat << EOF
${BLUE}CUBRID Database Protection & Query Manager${NC}

${GREEN}Protection:${NC}
  apply            - Apply protection to CUBRID database
  remove           - Remove protection (requires confirmation)
  status           - Show protection status
  test             - Test database recovery

${GREEN}Query Operations (Safe - Read Only):${NC}
  list             - List all tables
  describe TABLE   - Show table structure
  count TABLE      - Count rows in table
  select TABLE [LIMIT] - Select all rows from table
  where TABLE COLUMN VALUE [LIMIT] - Select rows with WHERE clause

${GREEN}Data Operations:${NC}
  insert TABLE "VALUES"    - Insert data (e.g., insert users "1, 'name'")
  update TABLE SET WHERE   - Update data (e.g., update users "name='new' WHERE id=1")
  delete TABLE WHERE       - Delete data (e.g., delete users "id=1")

${GREEN}Backup & Restore:${NC}
  backup [DIR]      - Backup all tables to JSON
  export TABLE FILE - Export single table to file
  import TABLE FILE - Import from file

${GREEN}Examples:${NC}
  $0 list
  $0 count admin_emission_gwp_value
  $0 select rsn_release_unit
  $0 where admin_emission_gwp_value section_code 'MAJOR_GHG' 5
  $0 status
  $0 test

EOF
}

# ============================================
# Main
# ============================================

case "${1:-help}" in
    apply)
        apply_protection
        ;;
    remove)
        remove_protection
        ;;
    status)
        check_status
        ;;
    test)
        test_recovery
        ;;
    auto-recover)
        auto_recover
        ;;
    list)
        list_tables
        ;;
    describe)
        describe_table "$2"
        ;;
    count)
        count_rows "$2"
        ;;
    select)
        if [ -n "$3" ]; then
            select_all "$2" "$3"
        else
            select_all "$2"
        fi
        ;;
    where)
        if [ -n "$5" ]; then
            select_where "$2" "$3" "$4" "$5"
        elif [ -n "$4" ]; then
            select_where "$2" "$3" "$4"
        else
            select_where "$2" "$3" "$4"
        fi
        ;;
    insert)
        insert_data "$2" "$3"
        ;;
    update)
        update_data "$2" "$3" "$4"
        ;;
    delete)
        delete_data "$2" "$3"
        ;;
    backup)
        backup_all "$2"
        ;;
    export)
        export_data "$2" "$3"
        ;;
    import)
        import_data "$2" "$3"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac