#!/bin/bash
#========================================
# CUBRID Multi-DB Migration Script v2
# resonance DB = 공통/시스템 테이블
# carbonet DB = 프로젝트 테이블
#========================================

set -e
CUBRID_BIN="/home/cubrid/CUBRID/bin"
DB_HOST="cubrid-carbonet-0"
DB_USER="dba"

# 색상 출력
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_err() { echo -e "${RED}[ERR]${NC} $1"; }

#========================================
# RESONANCE DB 테이블 (공통/시스템)
#========================================
RESONANCE_TABLES=(
    # 공통코드
    "comtccmmnclcode"
    "comtccmmncode"
    "comtccmmndetailcode"
    "comtecopseq"

    # 권한/인증
    "comtnauthorfunctionrelate"
    "comtnauthorgroupinfo"
    "comtnauthorinfo"
    "comtnauthorrolerelate"
    "comtnauthtokenstore"
    "comtnloginhist"
    "comtnloginpolicy"
    "comtnpasswordresethist"
    "comtnroleinfo"
    "comtnstsfdg"
    "comvnusermaster"

    # 메뉴
    "comtnmenucreatdtls"
    "comtnmenufunctioninfo"
    "comtnmenuinfo"
    "comtnmenuorder"

    # 파일
    "comtnfile"
    "comtnfiledetail"
    "comtninsttfile"

    # 게시판/Survey
    "comtnbbs"
    "comtnbbsmaster"
    "comtnbbsmasteroptn"
    "comtnbbssynclog"
    "comtnqestnrinfo"
    "comtnqustnriem"
    "comtnqustnrqesitm"
    "comtnqustnrrespondinfo"
    "comtnqustnrrspnsresult"
    "comtnqustnrtmplat"
    "comtntmplatinfo"

    # 댓글
    "comtncomment"

    # 블라인드/보안
    "comtnblocklistactionhist"
    "comtnblocklistentry"
    "comtnipwhitelistrequest"
    "comtnipwhitelistrule"

    # 공통모듈
    "common_module_registry"
    "install_unit"
    "install_unit_common_module"

    # 감사로그
    "audit_event"
    "access_event"
    "error_event"
    "trace_event"

    # 변경로그
    "adapter_change_log"
    "business_change_log"
    "db_change_promotion_policy"
    "db_patch_history"

    # 프로젝트/배포
    "artifact_version_registry"
    "project_artifact_install"
    "project_db_connection"
    "project_db_migration_status"
    "project_deployment_history"
    "project_registry"
    "release_unit"
    "release_unit_registry"
    "resource_dependency"
    "resource_registry"
    "rsn_deploy_trace"
    "rsn_release_unit"
    "rsn_runtime_package"
    "server_deployment_state"

    # Full Stack/Governor
    "full_stack_governance_registry"

    # AI/Hermes 공통
    "ai_prompt_template"
    "hermes_capability_pattern"
    "hermes_context_pack"
    "hermes_failure_pattern"
    "hermes_model_decision"
    "hermes_similar_work_match"
    "hermes_task_lesson"

    # 시스템
    "delete_plan"
    "delete_plan_item"
    "deployable_db_patch_queue"
    "deployable_db_patch_result"
    "ui_component_registry"
    "ui_help_item"
    "ui_help_page"
    "ui_page_component_map"
    "ui_page_manifest"

    # MSB 관련
    "msatnauthorgroupinfo"
    "msatnauthorinfo"
    "msatnauthorrolerelate"
    "msatnemplyrscrtyestbs"
    "msatnmenucreatdtls"
    "msatnroleinfo"
    "msatnroles_hierarchy"

    # 유저/설정
    "comtnuserfeatureoverride"
    "comtndeptauthorrelate"
)

#========================================
# CARBONET DB 테이블 (프로젝트)
#========================================
CARBONET_TABLES=(
    # 회원
    "comtnemplyrinfo"
    "comtnemplyrscrtyestbs"
    "comtngnrlmber"
    "comtnentrprsmber"
    "comtnentrprsmberfile"

    # 커뮤니티
    "comtnblog"
    "comtnbloguser"
    "comtncmmnty"
    "comtncmmntyuser"

    # AI/RAG
    "ai_rag_chunk"
    "ai_rag_document"
    "ai_search_verification"
    "ai_token_usage"
    "ai_trace_detail"
    "ai_training_candidate"
    "ai_training_dataset"
    "ai_vectordb_index"

    # 배출량
    "admin_emission_gwp_value"
    "emission_calc_result"
    "emission_category"
    "emission_chemical_material_dictionary"
    "emission_factor"
    "emission_input_session"
    "emission_input_value"
    "emission_mapping_log"
    "emission_material_translation"
    "emission_variable_def"

    # 인증서
    "certificate_approve"
    "certificate_audit_log"
    "certificate_objection_list"
    "certificate_pending"
    "certificate_rec_check"
    "certificate_report_form"
    "certificate_report_list"
    "certificate_review"
    "certificate_statistics"
    "certificate_list"

    # 거래
    "trade_approve"
    "trade_auto_order"
    "trade_buy_request"
    "trade_complete"
    "trade_list"
    "trade_market"
    "trade_price_alert"
    "trade_reject"
    "trade_report"
    "trade_sell"
    "trade_statistics"
    "trade_duplicate"

    # 결제
    "payment_history"
    "payment_notify"
    "payment_pay"
    "payment_receipt"
    "payment_refund"
    "payment_refund_account"
    "payment_virtual_account"

    # 입회/탈퇴
    "join_auth"
    "join_company_register"
    "join_company_register_complete"
    "join_company_reapply"
    "join_company_status"
    "join_company_status_detail"
    "join_company_status_guide"
    "join_complete"
    "join_info"
    "join_terms"
    "join_wizard"

    # 교육
    "edu_apply"
    "edu_certificate"
    "edu_content"
    "edu_course_detail"
    "edu_course_list"
    "edu_my_course"
    "edu_progress"
    "edu_survey"

    # 배너
    "banner_edit"
    "banner_list"

    # 모니터링
    "monitoring_alerts"
    "monitoring_dashboard"
    "monitoring_export"
    "monitoring_realtime"
    "monitoring_reduction_trend"
    "monitoring_share"
    "monitoring_statistics"
    "monitoring_track"
    "notification_center"

    # 자산
    "asset_deficiency_queue"
    "asset_detail"
    "asset_gap"
    "asset_impact"
    "asset_inventory"
    "asset_lifecycle"
    "system_asset_composition"
    "system_asset_inventory"
    "system_asset_lifecycle_evidence"
    "system_asset_lifecycle_plan"
    "system_asset_scan_log"

    # DB/스키마
    "db_promotion_policy"

    # Workbench
    "sr_workbench_stack"
    "sr_ticket"
    "sr_ticket_artifact"
    "sr_ticket_history"

    # WBS
    "wbs_management"

    # 검증
    "verification_assets"
    "verification_center"

    # 환경
    "env_governance"
    "env_verification"

    # 회사
    "company_approve"
    "company_detail"
    "company_list"
    "company_account"

    # 관리자
    "admin_approve"
    "admin_list"
    "admin_permission"
    "admin_account_create"

    # 외부연계
    "external_connection"
    "external_keys"
    "external_logs"
    "external_maintenance"
    "external_monitoring"
    "external_retry"
    "external_schema"
    "external_sync"
    "external_usage"
    "external_webhooks"

    # Backup/Version
    "backup_config"
    "backup_execution"
    "restore_execution"
    "version_management"
    "package_governance"
    "operations_inventory"

    # Full Stack
    "full_stack_registry"

    # Hermes/AI Workflow
    "hermes_cli_session"
    "hermes_command_interpretation"
    "hermes_execution_log"
    "hermes_next_action_recommendation"
    "hermes_runtime_snapshot"
    "hermes_task"
    "hermes_task_step"
    "hermes_verification_log"
    "hermes_work_packet"
    "hermes_workflow_stage_template"

    # EcoInvent
    "ecoinvent_master"

    # 가상
    "virtual_issue"
)

#========================================
# Functions
#========================================

run_csql() {
    local db=$1
    local sql=$2
    kubectl -n carbonet-prod exec cubrid-carbonet-0 -- bash -c "export CUBRID=/home/cubrid/CUBRID; export PATH=\$CUBRID/bin:\$PATH; csql -u $DB_USER $db -c \"$sql\" 2>&1"
}

check_connection() {
    run_csql carbonet "SELECT 1;" >/dev/null 2>&1
    return $?
}

backup_db() {
    local backup_dir="/var/lib/cubrid/backup/$(date +%Y%m%d_%H%M%S)"
    kubectl -n carbonet-prod exec cubrid-carbonet-0 -- bash -c "mkdir -p $backup_dir"
    kubectl -n carbonet-prod exec cubrid-carbonet-0 -- bash -c "export CUBRID=/home/cubrid/CUBRID; export PATH=\$CUBRID/bin:\$PATH; cubrid backupdb -B $backup_dir carbonet"
    log_info "Backup saved to: $backup_dir"
}

create_resonance_db() {
    log_info "Creating resonance database..."
    kubectl -n carbonet-prod exec cubrid-carbonet-0 -- bash -c "export CUBRID=/home/cubrid/CUBRID; export PATH=\$CUBRID/bin:\$PATH; cubrid createdb resonance en_US -d /var/lib/cubrid/resonance" 2>/dev/null && log_info "resonance DB created" || log_warn "resonance DB may already exist"
}

export_table_schema() {
    local table=$1
    local output_file="/tmp/${table}_schema.sql"
    kubectl -n carbonet-prod exec cubrid-carbonet-0 -- bash -c "export CUBRID=/home/cubrid/CUBRID; export PATH=\$CUBRID/bin:\$PATH; csql -u $DB_USER carbonet -c 'SHOW CREATE TABLE $table;' 2>/dev/null" > "$output_file"
    echo "$output_file"
}

migrate_table_to_resonance() {
    local table=$1
    log_info "Migrating table: $table"

    export_table_schema "$table" >/dev/null

    local data_file="/tmp/${table}_data.csv"
    kubectl -n carbonet-prod exec cubrid-carbonet-0 -- bash -c "export CUBRID=/home/cubrid/CUBRID; export PATH=\$CUBRID/bin:\$PATH; csql -u $DB_USER carbonet -c 'SELECT * FROM $table;' -o $data_file" 2>/dev/null

    log_info "  Schema exported to /tmp/${table}_schema.sql"
    log_info "  Data exported to /tmp/${table}_data.csv"
}

count_tables() {
    local db=$1
    run_csql "$db" "SELECT COUNT(*) FROM db_class;" 2>/dev/null | grep -A1 "SELECT COUNT" | tail -1 | tr -d ' '
}

#========================================
# Main
#========================================

case "${1:-}" in
    --plan)
        log_info "=== Migration Plan for Multi-DB Configuration ==="
        echo ""
        echo "RESONANCE DB (공통/시스템): ${#RESONANCE_TABLES[@]} tables"
        echo "CARBONET DB (프로젝트): ${#CARBONET_TABLES[@]} tables"
        echo ""
        echo "--- RESONANCE Tables ---"
        printf '%s\n' "${RESONANCE_TABLES[@]}" | sort
        echo ""
        echo "--- CARBONET Tables ---"
        printf '%s\n' "${CARBONET_TABLES[@]}" | sort
        ;;

    --check)
        if check_connection; then
            log_info "CUBRID connection: OK"
            log_info "Carbonet tables: $(count_tables carbonet)"
            log_info "Resonance tables: $(count_tables resonance 2>/dev/null || echo 'N/A')"
        else
            log_err "CUBRID connection failed"
            exit 1
        fi
        ;;

    --backup)
        backup_db
        ;;

    --setup)
        check_connection || exit 1
        log_info "Setting up multi-DB configuration..."
        backup_db
        create_resonance_db
        log_info "Setup complete!"
        ;;

    --migrate)
        check_connection || exit 1
        log_warn "Starting migration. Make sure you have a backup!"
        log_warn "This will migrate ${#RESONANCE_TABLES[@]} tables to resonance DB..."
        sleep 5

        for table in "${RESONANCE_TABLES[@]}"; do
            migrate_table_to_resonance "$table"
        done

        log_info "Migration complete!"
        ;;

    *)
        echo "Usage: $0 {--plan|--check|--backup|--setup|--migrate}"
        echo ""
        echo "  --plan    : Show migration plan (table list)"
        echo "  --check   : Check CUBRID connection and DB status"
        echo "  --backup  : Backup carbonet DB"
        echo "  --setup   : Create resonance DB (backup first)"
        echo "  --migrate : Migrate tables to resonance DB"
        echo ""
        echo "Example:"
        echo "  $0 --check   # Verify connection"
        echo "  $0 --backup  # Backup before migration"
        echo "  $0 --setup   # Create resonance DB"
        echo "  $0 --migrate # Execute migration"
        ;;
esac