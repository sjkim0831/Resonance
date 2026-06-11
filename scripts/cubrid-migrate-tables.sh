#!/bin/bash
#========================================
# CUBRID Multi-DB Migration Script v3
# Full migration from carbonet to resonance
#========================================

set -e
CUBRID_BIN="/home/cubrid/CUBRID/bin"
NAMESPACE="carbonet-prod"
POD="cubrid-carbonet-0"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_err() { echo -e "${RED}[ERR]${NC} $1"; }

# exec in pod
pod_exec() {
    kubectl -n "$NAMESPACE" exec "$POD" -- bash -c "$1" 2>&1
}

# RESONANCE TABLES (89 tables - common/system)
RESONANCE_TABLES=(
    "access_event" "adapter_change_log" "ai_prompt_template"
    "artifact_version_registry" "audit_event" "business_change_log"
    "common_module_registry" "comtccmmnclcode" "comtccmmncode"
    "comtccmmndetailcode" "comtecopseq" "comtnauthorfunctionrelate"
    "comtnauthorgroupinfo" "comtnauthorinfo" "comtnauthorrolerelate"
    "comtnauthtokenstore" "comtnbbs" "comtnbbsmaster" "comtnbbsmasteroptn"
    "comtnbbssynclog" "comtnblocklistactionhist" "comtnblocklistentry"
    "comtncomment" "comtndeptauthorrelate" "comtnfile" "comtnfiledetail"
    "comtninsttfile" "comtnipwhitelistrequest" "comtnipwhitelistrule"
    "comtnloginhist" "comtnloginpolicy" "comtnmenucreatdtls"
    "comtnmenufunctioninfo" "comtnmenuinfo" "comtnmenuorder"
    "comtnpasswordresethist" "comtnqestnrinfo" "comtnqustnriem"
    "comtnqustnrqesitm" "comtnqustnrrespondinfo" "comtnqustnrrspnsresult"
    "comtnqustnrtmplat" "comtnroleinfo" "comtnstsfdg" "comtntmplatinfo"
    "comtnuserfeatureoverride" "comvnusermaster" "db_change_promotion_policy"
    "db_patch_history" "delete_plan" "delete_plan_item"
    "deployable_db_patch_queue" "deployable_db_patch_result" "error_event"
    "full_stack_governance_registry" "hermes_capability_pattern"
    "hermes_context_pack" "hermes_failure_pattern" "hermes_model_decision"
    "hermes_similar_work_match" "hermes_task_lesson" "install_unit"
    "install_unit_common_module" "msatnauthorgroupinfo" "msatnauthorinfo"
    "msatnauthorrolerelate" "msatnemplyrscrtyestbs" "msatnmenucreatdtls"
    "msatnroleinfo" "msatnroles_hierarchy" "project_artifact_install"
    "project_db_connection" "project_db_migration_status"
    "project_deployment_history" "project_registry" "release_unit"
    "release_unit_registry" "resource_dependency" "resource_registry"
    "rsn_deploy_trace" "rsn_release_unit" "rsn_runtime_package"
    "server_deployment_state" "trace_event" "ui_component_registry"
    "ui_help_item" "ui_help_page" "ui_page_component_map" "ui_page_manifest"
)

# Start resonance server
start_resonance() {
    pod_exec "export CUBRID=/home/cubrid/CUBRID; export PATH=\$CUBRID/bin:\$PATH; cubrid server start resonance 2>/dev/null"
}

# Check table exists in carbonet
table_exists() {
    local table=$1
    local count=$(pod_exec "export CUBRID=/home/cubrid/CUBRID; export PATH=\$CUBRID/bin:\$PATH; csql -u dba carbonet -c 'SELECT COUNT(*) FROM $table;'" 2>/dev/null | grep -A1 "COUNT" | tail -1 | tr -d ' ')
    [ "$count" != "" ] && [ "$count" != "0" ] && echo "$count" || echo "0"
}

# Export table schema
export_schema() {
    local table=$1
    local tmp_file="/tmp/${table}_schema.sql"
    pod_exec "export CUBRID=/home/cubrid/CUBRID; export PATH=\$CUBRID/bin:\$PATH; csql -u dba carbonet --no-auto-commit -c 'SHOW CREATE TABLE $table;' 2>/dev/null" | grep -v "^==" | grep -v "SHOW CREATE" > "$tmp_file"
    echo "$tmp_file"
}

# Export table data
export_data() {
    local table=$1
    local tmp_file="/tmp/${table}_data.csv"
    pod_exec "export CUBRID=/home/cubrid/CUBRID; export PATH=\$CUBRID/bin:\$PATH; csql -u dba carbonet -c 'SELECT * FROM $table;' -o $tmp_file --csv 2>/dev/null"
    echo "$tmp_file"
}

# Create table in resonance
create_table_in_resonance() {
    local table=$1
    local schema_file=$(export_schema "$table")
    if [ -s "$schema_file" ]; then
        pod_exec "cat $schema_file" | pod_exec "export CUBRID=/home/cubrid/CUBRID; export PATH=\$CUBRID/bin:\$PATH; csql -u dba resonance" 2>/dev/null
    fi
}

# Import data to resonance
import_data_to_resonance() {
    local table=$1
    local data_file=$(export_data "$table")
    local row_count=$(pod_exec "wc -l $data_file 2>/dev/null" | awk '{print $1}')
    if [ "$row_count" -gt 1 ]; then
        # Use LOAD DATA approach via csql
        pod_exec "export CUBRID=/home/cubrid/CUBRID; export PATH=\$CUBRID/bin:\$PATH; csql -u dba resonance -c \"
        LOAD CSV FROM '$data_file' INTO $table
        --csv-header
        --table $table
        --delimiter ','
        \" 2>/dev/null || log_warn "LOAD CSV failed for $table, trying INSERT"
    fi
}

# Alternative: Direct INSERT from SELECT
migrate_table_data() {
    local table=$1
    local row_count=$(table_exists "$table")
    if [ "$row_count" -gt 0 ]; then
        log_info "Migrating $table ($row_count rows)"

        # Get columns
        local cols=$(pod_exec "export CUBRID=/home/cubrid/CUBRID; export PATH=\$CUBRID/bin:\$PATH; csql -u dba carbonet -c 'SELECT column_name FROM db_attribute WHERE class_name = '$table' ORDER BY attr_order;' 2>/dev/null" | grep -v "SELECT" | grep -v "^$" | tr '\n' ',' | sed 's/,$//')

        if [ -n "$cols" ]; then
            # Insert into resonance using SELECT from carbonet
            pod_exec "export CUBRID=/home/cubrid/CUBRID; export PATH=\$CUBRID/bin:\$PATH; csql -u dba resonance -c 'INSERT INTO $table SELECT * FROM carbonet.$table;' 2>/dev/null" || log_warn "Failed to migrate $table"
        fi
    fi
}

# Main migration
migrate() {
    log_info "Starting migration of ${#RESONANCE_TABLES[@]} tables to resonance DB..."
    start_resonance
    sleep 2

    for table in "${RESONANCE_TABLES[@]}"; do
        if table_exists "$table" >/dev/null 2>&1; then
            migrate_table_data "$table"
        else
            log_warn "Table not found in carbonet: $table"
        fi
    done

    log_info "Migration complete"
}

# Verify
verify() {
    log_info "Verifying migration..."
    local resonance_count=$(pod_exec "export CUBRID=/home/cubrid/CUBRID; export PATH=\$CUBRID/bin:\$PATH; csql -u dba resonance -c 'SELECT COUNT(*) FROM db_class WHERE class_name NOT LIKE \"db_%\";'" 2>/dev/null | grep -A1 "COUNT" | tail -1 | tr -d ' ')
    log_info "resonance DB tables: $resonance_count"

    local carbonet_count=$(pod_exec "export CUBRID=/home/cubrid/CUBRID; export PATH=\$CUBRID/bin:\$PATH; csql -u dba carbonet -c 'SELECT COUNT(*) FROM db_class WHERE class_name NOT LIKE \"db_%\";'" 2>/dev/null | grep -A1 "COUNT" | tail -1 | tr -d ' ')
    log_info "carbonet DB tables: $carbonet_count"
}

case "${1:-}" in
    --migrate)
        migrate
        ;;
    --verify)
        verify
        ;;
    --start)
        start_resonance
        ;;
    *)
        echo "Usage: $0 {--migrate|--verify|--start}"
        ;;
esac